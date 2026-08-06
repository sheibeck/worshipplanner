import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { decideMembershipClaim } from "./orgMembershipClaims";

// --- backfillOrgMembershipClaims (R074/R075: give the two existing users the claim) ---
//
// PURPOSE: syncOrgMembershipClaim (./orgMembershipClaims.ts) only fires on FUTURE
// writes to organizations/{orgId}/members/{uid}. Members whose document was already
// in place before that trigger was deployed have never had it rewritten, so without
// this backfill they carry no claim until something touches their member doc again.
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
// SHARED DECISION LOGIC (DISC-02, T-40-05): this script imports decideMembershipClaim
// from ./orgMembershipClaims rather than reimplementing primary-org resolution, role
// normalisation, or the already-matching comparison. A second implementation of "what
// should this user's claim be" would drift from the trigger and could write a claim to
// production that disagrees with what the trigger would have written.
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

/**
 * Structural guard, in the spirit of index.ts's MEDIA_PATH_GUARD: a `members`
 * document is only ever a backfill candidate when it is a child of an
 * `organizations/{orgId}` document. `collectionGroup('members')` matches ANY
 * subcollection literally named `members` anywhere in the database, so this guard
 * is applied to every candidate BEFORE any decision is made -- a `members`
 * subcollection appearing anywhere else in the schema can never be acted on.
 * Returns the org id on success, undefined when the guard fails.
 */
function resolveOrgId(memberDoc: QueryDocumentSnapshot): string | undefined {
  const orgDoc = memberDoc.ref.parent.parent;
  if (!orgDoc) return undefined;
  if (orgDoc.parent.id !== "organizations") return undefined;
  return orgDoc.id;
}

/**
 * Iterates every organizations/*\/members/* document and, via the shared
 * decideMembershipClaim, sets the { orgId, role } custom claim for every account
 * whose primary org (users/{uid}.orgIds[0]) matches the membership doc's org.
 *
 * Idempotent by skip-if-already-matching (D-11): re-running this after an
 * interruption is always safe -- every already-current account is reported as
 * skipped, not re-written, and there is no cursor state that could itself go stale.
 */
export async function backfillOrgMembershipClaims(
  options: BackfillOptions,
): Promise<BackfillSummary> {
  const { apply } = options;

  let processed = 0;
  let skipped = 0;
  const failed: BackfillFailure[] = [];

  const snapshot = await getFirestore().collectionGroup("members").get();

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

    try {
      const decision = await decideMembershipClaim({ uid, orgId, role });

      switch (decision.action) {
        case "set":
          if (apply) {
            await getAuth().setCustomUserClaims(uid, decision.claims);
          }
          processed++;
          console.log(`[backfillOrgClaims] ${uid} (${orgId}): set`, decision.claims);
          break;
        case "skip":
          skipped++;
          console.log(`[backfillOrgClaims] ${uid} (${orgId}): skip (${decision.reason})`);
          break;
        case "clear":
          // Not reachable from a live members document -- a member doc that exists
          // always carries a role, so decideMembershipClaim never returns 'clear'
          // from this call site (role is only ever undefined on a delete, and a
          // deleted document is never returned by this query). Treated defensively
          // as skipped rather than assumed unreachable.
          skipped++;
          console.log(`[backfillOrgClaims] ${uid} (${orgId}): skip (clear-not-reachable)`);
          break;
      }
    } catch (err) {
      console.error(`[backfillOrgClaims] ${uid} (${orgId}): failed`, err);
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
if (require.main === module) {
  void (async () => {
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
  })();
}
