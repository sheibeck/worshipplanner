import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  buildOrgsMapClaim,
  decideMembershipClaim,
  orgsMapsEqual,
  resolveOrgId,
  type MembershipClaimDecision,
  type OrgMembershipClaim,
  type OrgMembershipRole,
} from "./orgMembershipClaims";
import { isClaimsTooLargeError, mergeAndSetCustomClaims } from "./claimsHelpers";

// --- backfillOrgMembershipClaims (R074/R075: give the two existing users the claim) ---
//
// PURPOSE: syncOrgMembershipClaim (./orgMembershipClaims.ts) only fires on FUTURE
// writes to organizations/{orgId}/members/{uid}. Members whose document was already
// in place before that trigger was deployed have never had it rewritten, so without
// this backfill they carry no claim until something touches their member doc again.
//
// WIDENED (73-03-PLAN.md, R210): this script now also backfills the additive `orgs`
// map (73-01-PLAN.md, R207) for every existing user, not just the primary
// `{ orgId, role }` claim -- the trigger's per-write orgs recompute
// (computeOrgsClaimForUid) only ever runs on a FUTURE membership write, exactly the
// same gap the original backfill closed for the primary claim. This backfill closes
// it for `orgs` too, from a single grouped scan (see "SINGLE SCAN" below), and writes
// through mergeAndSetCustomClaims rather than a bare setCustomUserClaims so a
// superAdmin grant (Phase 68) is never wiped by a backfill run (R208/T-73-01).
//
// THIS IS A NODE SCRIPT, NOT A DEPLOYED FUNCTION (D-12). It is run by the owner with
// admin credentials and is deliberately NOT exported from functions/src/index.ts --
// it is not part of the deployable function surface.
//
// SCALE (D-10): population is 2 active users + 1 never-accepted invite (owner,
// 2026-08-06 -- see 40-CONTEXT.md "the population is two users"). No cursor, no
// pagination, no batching, no rate limiting, no resume-from-offset. A single
// collectionGroup('members').get() is correct and complete at this size. Do not add
// any scale machinery here -- it would be speculative complexity for a set that fits
// on one screen.
//
// SINGLE SCAN, GROUPED BY UID IN MEMORY (73-RESEARCH.md Pattern 4): the ONE
// collectionGroup('members').get() below is grouped by uid in memory into a per-uid
// membership list. This is deliberately NOT the trigger's per-write
// computeOrgsClaimForUid (orgMembershipClaims.ts) -- that helper does its OWN fresh
// collectionGroup('members').get() scan, which is correct for a single uid on a
// single write but would turn this backfill into an O(n) re-scan (one full-collection
// scan per user) if called from inside this loop. Reusing it here would be exactly
// the anti-pattern 73-RESEARCH.md warns against.
//
// SHARED DECISION LOGIC (DISC-02, T-40-05, D-11): this script imports
// decideMembershipClaim AND buildOrgsMapClaim AND resolveOrgId from
// ./orgMembershipClaims rather than reimplementing primary-org resolution, role
// normalisation, the orgs-map shape, or the structural members-doc guard. A second
// implementation of "what should this user's claim be" would drift from the trigger
// and could write a claim to production that disagrees with what the trigger would
// have written.
//
// SAFETY (D-13/D-14, T-40-10): dry run is the default. Nothing is written to Auth
// unless --apply is passed. The CLI wrapper below prints the resolved project id and a
// dry-run banner before doing any work, so a rehearsal can never be mistaken for the
// real thing.
//
// THE NEVER-ACCEPTED INVITE: a pending invite lives at
// organizations/{orgId}/invites/{email} and inviteLookup/{email} -- it has NO
// organizations/{orgId}/members/{uid} document. Because this script only ever reads
// the `members` collection group, a pending invite is structurally never visited. Its
// claim is set by the trigger at the moment the invite is accepted (see
// src/stores/auth.ts's ensureUserDocument / loadOrgContext, plan 40-03), not by this
// backfill.

/** Options controlling whether decisions are actually written to Firebase Auth. */
export interface BackfillOptions {
  /** When false (the default), every account is classified but nothing is written. */
  apply: boolean;
}

/** One account this run could not classify or write cleanly. */
export interface BackfillFailure {
  uid: string;
  orgId: string;
  error: string;
}

export interface BackfillSummary {
  processed: number;
  skipped: number;
  failed: BackfillFailure[];
}

/** One surviving organizations/{orgId}/members/{uid} membership for a given uid. */
interface MembershipCandidate {
  orgId: string;
  role: string | undefined;
}

/**
 * Resolves the single PRIMARY-claim decision for a uid from its grouped-by-uid
 * membership list, via the shared decideMembershipClaim (D-11). At most one
 * membership can ever be the user's actual primary org -- decideMembershipClaim
 * independently re-derives the true primary from users/{uid}.orgIds on every call,
 * so trying each membership in order until one is NOT skipped for "not-primary-org"
 * converges on the real primary decision regardless of collectionGroup doc order,
 * without needing a separate primary-org lookup of our own.
 */
async function decidePrimaryClaim(
  uid: string,
  memberships: MembershipCandidate[],
): Promise<MembershipClaimDecision> {
  let decision: MembershipClaimDecision = { action: "skip", reason: "not-primary-org" };
  for (const membership of memberships) {
    decision = await decideMembershipClaim({
      uid,
      orgId: membership.orgId,
      documentExists: true,
      role: membership.role,
    });
    if (!(decision.action === "skip" && decision.reason === "not-primary-org")) {
      return decision;
    }
  }
  return decision;
}

/**
 * Iterates every organizations/*\/members/* document ONCE, grouped by uid in memory,
 * and for each uid reconciles ONE Admin SDK write carrying:
 *  - the PRIMARY `{ orgId, role }` claim, via the shared decideMembershipClaim on
 *    the user's primary-org membership (unchanged primary logic, D-11), and
 *  - the additive `orgs` map, via the shared buildOrgsMapClaim applied to this
 *    uid's in-memory group (no second scan, no second "what orgs" implementation).
 *
 * Idempotent by skip-if-already-matching (D-11, extended to `orgs`): re-running
 * this after an interruption is always safe -- every already-current account
 * (primary keys AND orgs both matching) is reported as skipped, not re-written,
 * and there is no cursor state that could itself go stale.
 *
 * Writes via mergeAndSetCustomClaims (R208/T-73-01), never a bare
 * setCustomUserClaims -- a bare replace would silently wipe an unrelated claim
 * (e.g. Phase 68's superAdmin:true) the moment this backfill next ran for that uid.
 */
export async function backfillOrgMembershipClaims(
  options: BackfillOptions,
): Promise<BackfillSummary> {
  const { apply } = options;

  let processed = 0;
  let skipped = 0;
  const failed: BackfillFailure[] = [];

  const snapshot = await getFirestore().collectionGroup("members").get();

  // Group the ONE scan's surviving docs by uid IN MEMORY (73-RESEARCH.md Pattern 4)
  // -- never re-scan collectionGroup('members') per uid or per membership.
  const membershipsByUid = new Map<string, MembershipCandidate[]>();
  for (const memberDoc of snapshot.docs) {
    const orgId = resolveOrgId(memberDoc);
    if (orgId === undefined) {
      // Structural guard failed. Not a real organizations/{orgId}/members/{uid}
      // document -- skip silently, uncounted, exactly like MEDIA_PATH_GUARD's
      // pre-scannedCount `continue`.
      continue;
    }

    const uid = memberDoc.id;
    const role = (memberDoc.data() as { role?: string } | undefined)?.role;
    const existing = membershipsByUid.get(uid);
    if (existing) {
      existing.push({ orgId, role });
    } else {
      membershipsByUid.set(uid, [{ orgId, role }]);
    }
  }

  for (const [uid, memberships] of membershipsByUid) {
    // memberships is always non-empty here: a uid only ever enters the map via the
    // push/set above, which always supplies at least one entry.
    const orgId = memberships[0]!.orgId;

    try {
      // The shared, no-drift orgs-map builder (D-11) -- the SAME function the
      // trigger uses, applied to this uid's in-memory group instead of a fresh scan.
      const desiredOrgs = buildOrgsMapClaim(memberships);

      const decision = await decidePrimaryClaim(uid, memberships);

      if (
        decision.action === "skip" &&
        (decision.reason === "no-user-doc" || decision.reason === "missing-role")
      ) {
        // Fully-conservative skip: the write is too ambiguous to act on at all --
        // mirrors syncOrgMembershipClaimHandler's identical carve-out for these two
        // reasons. Never touch orgs here either.
        skipped++;
        console.log(`[backfillOrgClaims] ${uid} (${orgId}): skip (${decision.reason})`);
        continue;
      }

      if (decision.action === "set") {
        // R208/T-73-01: ONE merge call carries the primary keys AND the recomputed
        // orgs map, preserving superAdmin (or any other unrelated claim) -- never
        // the bare setCustomUserClaims this replaced.
        const patch = { ...decision.claims, orgs: desiredOrgs };
        if (apply) {
          await mergeAndSetCustomClaims(uid, patch);
        }
        processed++;
        console.log(`[backfillOrgClaims] ${uid} (${orgId}): set`, patch);
        continue;
      }

      // decision.action is "skip" (reason "not-primary-org" or "already-current")
      // or "clear" (not reachable from this call site: decideMembershipClaim only
      // ever returns 'clear' when documentExists is false (WR-01), and
      // decidePrimaryClaim always passes documentExists: true). Either way the
      // primary keys are unaffected, but `orgs` still needs its own
      // skip-if-matching check -- this is what lets a non-primary-org membership
      // (or a primary membership whose claim is already current) still pick up a
      // changed orgs map.
      const existingUser = await getAuth().getUser(uid);
      const existingClaims = existingUser.customClaims as
        | (Partial<OrgMembershipClaim> & { orgs?: Record<string, OrgMembershipRole> })
        | undefined;
      const existingOrgs = existingClaims?.orgs ?? {};

      if (orgsMapsEqual(existingOrgs, desiredOrgs)) {
        skipped++;
        console.log(`[backfillOrgClaims] ${uid} (${orgId}): skip (already-current, orgs unchanged)`);
      } else {
        if (apply) {
          await mergeAndSetCustomClaims(uid, { orgs: desiredOrgs });
        }
        processed++;
        console.log(`[backfillOrgClaims] ${uid} (${orgId}): set (orgs-only)`, { orgs: desiredOrgs });
      }
    } catch (err) {
      // WR-02 (73-REVIEW.md): give the ~1000-byte custom-claims cap's
      // auth/claims-too-large error a distinguishable, greppable log line --
      // mirrors syncOrgMembershipClaimHandler's identical carve-out. Still
      // recorded in `failed` exactly as before; only the logging changes.
      if (isClaimsTooLargeError(err)) {
        console.error(
          `[backfillOrgClaims] CLAIM SIZE LIMIT EXCEEDED for uid=${uid} (${orgId}): custom claims exceeded the ~1000-byte cap and were not written`,
          err,
        );
      } else {
        console.error(`[backfillOrgClaims] ${uid} (${orgId}): failed`, err);
      }
      failed.push({ uid, orgId, error: String(err) });
    }
  }

  const summary: BackfillSummary = { processed, skipped, failed };
  console.log("[backfillOrgClaims] summary:", summary);
  return summary;
}

// --- CLI wrapper -----------------------------------------------------------
//
// Guarded so importing this module (as backfillOrgClaims.test.ts does) never calls
// initializeApp() or touches a live project -- only running it directly does.
//
// Usage (after `npm run build` from functions/, per functions/DEPLOY-ORG-CLAIMS.md):
//   node lib/backfillOrgClaims.js            # dry run (default)
//   node lib/backfillOrgClaims.js --apply    # writes claims for real
//
// Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or
// `gcloud auth application-default login`, exactly like any other Admin SDK script.
//
// WR-02: the whole body is wrapped in try/catch. The initial
// `getFirestore().collectionGroup('members').get()` inside backfillOrgMembershipClaims
// is NOT covered by that function's own per-uid try/catch (only the loop body is) --
// a rejection there (bad/expired credentials, wrong project, network failure) previously
// propagated out of this IIFE as a raw unhandled rejection instead of the script's own
// diagnostic output, with no process.exitCode set. The owner runs this by hand against
// production credentials, so a readable "aborted before processing any account" message
// plus a non-zero exit code mirrors the per-account failure reporting already present.
//
// Extracted into a named, exported function (mirrors syncOrgMembershipClaimHandler's
// separation from the onDocumentWritten wrapper) so this top-level error path itself is
// unit-testable without requiring `require.main === module`.
export async function runBackfillCli(): Promise<void> {
  try {
    initializeApp();

    const apply = process.argv.includes("--apply");
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "(unresolved project id)";
    console.log(`[backfillOrgClaims] target project: ${projectId}`);
    if (apply) {
      console.log("[backfillOrgClaims] APPLY MODE -- claims will be written for real.");
    } else {
      console.log(
        "[backfillOrgClaims] ==== DRY RUN ==== no claims will be written. Pass --apply to write for real.",
      );
    }

    const summary = await backfillOrgMembershipClaims({ apply });
    if (summary.failed.length > 0) {
      console.error(
        `[backfillOrgClaims] ${summary.failed.length} account(s) failed -- see summary above.`,
      );
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(
      "[backfillOrgClaims] aborted before processing any account -- top-level failure:",
      err,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runBackfillCli();
}
