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

// backfillOrgMembershipClaims (R074/R075: give the two existing users the claim)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/backfillOrgClaims.ts)
// THIS IS A NODE SCRIPT, NOT A DEPLOYED FUNCTION. SCALE (D-10): population is 2 users -- do not add scale machinery.

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
 * Iterates every organizations/*\/members/* document ONCE, grouped by uid in memory.
 * See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/backfillOrgClaims.ts)
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

      // See ADR-0011 (docs/adr/0011-decision-action-is-skip-reason-not-primary-org-or.md)
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
      // See ADR-0012 (docs/adr/0012-the-1000-byte-custom-claims-cap-throws-auth-claims-too-large.md)
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
// See ADR-0013 (docs/adr/0013-node-lib-backfillorgclaims-js-dry-run-default-node.md)
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
