import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { clearClaimKeys, mergeAndSetCustomClaims } from "./claimsHelpers";

// --- syncOrgMembershipClaim (R074/R075: the claim storage.rules reads) --
//
// This module deliberately does NOT call initializeApp() at module scope.
// functions/src/index.ts already does that for the deployed runtime, and
// plan 40-04's backfill script does it for the owner-run CLI runtime.
// Calling it here would break one of the two callers.
//
// The claim this module computes is consumed directly by storage.rules'
// isOrgMemberByClaim(orgId) helper (plan 40-01) as
// request.auth.token.orgId / request.auth.token.role. The two readable
// top-level key names below are byte-for-byte what that rule reads --
// changing either name here without updating storage.rules would silently
// break the claim arm while every test on both sides kept passing.

/** The exact top-level custom-claim keys this module ever writes. */
export const ORG_CLAIM_KEYS = ["orgId", "role"] as const;

/**
 * The role shape the claim ever carries. Legacy `admin` values are
 * normalised to `editor` by buildOrgMembershipClaim below -- `admin` never
 * appears as a claim value, matching what loadOrgContext already shows the
 * user (src/stores/auth.ts:171).
 */
export type OrgMembershipRole = "editor" | "viewer";

export interface OrgMembershipClaim {
  orgId: string;
  role: OrgMembershipRole;
}

/**
 * Builds the `{ orgId, role }` claim object in the exact locked shape from
 * 40-CONTEXT.md's D-01/D-02/D-03: two readable top-level keys and nothing
 * else. Normalises a legacy `role` of `'admin'` to `'editor'`.
 */
export function buildOrgMembershipClaim(orgId: string, role: string): OrgMembershipClaim {
  const normalizedRole: OrgMembershipRole = role === "admin" ? "editor" : (role as OrgMembershipRole);
  return { orgId, role: normalizedRole };
}

export interface DecideMembershipClaimParams {
  uid: string;
  orgId: string;
  /**
   * Whether the member document exists AFTER this write. false only for a
   * genuine delete -- this is the real create/update/delete signal, threaded
   * explicitly rather than inferred from `role` (WR-01: `role === undefined`
   * alone is ambiguous between "document deleted" and "document exists but
   * has no role field").
   */
  documentExists: boolean;
  /**
   * The document's `role` field. Only meaningful when `documentExists` is
   * true -- when `documentExists` is false this is always undefined too
   * (a deleted document has no fields), but callers must not rely on
   * `role === undefined` alone to mean "deleted".
   */
  role: string | undefined;
}

export type MembershipClaimSkipReason =
  | "not-primary-org"
  | "no-user-doc"
  | "already-current"
  | "missing-role";

export type MembershipClaimDecision =
  | { action: "set"; claims: OrgMembershipClaim }
  | { action: "clear" }
  | { action: "skip"; reason: MembershipClaimSkipReason };

/**
 * The single shared decision function (40-02-PLAN.md DISC-02). Both the
 * trigger below and plan 40-04's backfill import this rather than
 * reimplementing the rule, so the two can never drift.
 *
 * ★ KNOWN LIMITATION (D-01/D-04, deliberate, not an oversight): the claim
 * this function ever produces carries the user's PRIMARY org only
 * (`users/{uid}.orgIds[0]`). A user belonging to more than one organisation
 * is covered for their NON-primary orgs by storage.rules' Firestore-
 * membership arm alone -- this function will never set or clear a claim on
 * their behalf for a non-primary org. This is why the Firestore arm cannot
 * be removed for multi-org users even after the owner's second deploy.
 */
export async function decideMembershipClaim(
  params: DecideMembershipClaimParams,
): Promise<MembershipClaimDecision> {
  const { uid, orgId, documentExists, role } = params;

  // Step 1: independently re-derive the primary org from Firestore. Never
  // fall back to trusting the event's orgId param alone -- this mirrors
  // parsePptxHandler's "never trust the caller-declared value alone,
  // independently re-verify" pattern (index.ts) and is the control for
  // threat T-40-05.
  const userSnap = await getFirestore().collection("users").doc(uid).get();
  const orgIds = userSnap.exists ? (userSnap.data()?.orgIds as string[] | undefined) : undefined;
  const primaryOrgId = orgIds !== undefined && orgIds.length > 0 ? orgIds[0] : undefined;

  if (primaryOrgId === undefined) {
    return { action: "skip", reason: "no-user-doc" };
  }

  // Step 2: this write must be for the user's PRIMARY org. Holds for
  // deletes too -- removing a non-primary membership must never clear the
  // primary claim.
  if (primaryOrgId !== orgId) {
    return { action: "skip", reason: "not-primary-org" };
  }

  // Step 3: a delete (documentExists === false) of the PRIMARY membership
  // clears rather than recomputes a new primary. TeamView.vue's client-side
  // deleteDoc does not update users/{uid}.orgIds, so orgIds[0] is itself
  // stale at this moment -- recomputing from it would produce a claim for an
  // org the user just left.
  if (!documentExists) {
    return { action: "clear" };
  }

  // Step 3b (WR-01): the document exists but has no `role` field -- e.g. a
  // manual Firestore Console edit, or a future write path that creates a
  // members/{uid} doc without setting role. This is NOT a delete, so it must
  // never take the clear branch above: clearing here would silently revoke a
  // still-valid membership's claim on ambiguous input. Skip defensively
  // instead -- a stale claim is the lesser harm; the delete path above
  // already handles genuine revocation explicitly.
  if (role === undefined) {
    return { action: "skip", reason: "missing-role" };
  }

  // Step 4: idempotency -- skip a redundant write if the claim already
  // matches on both keys. This also gives plan 40-04's backfill its D-11
  // skip-if-already-matching behaviour from this same code path.
  const claims = buildOrgMembershipClaim(orgId, role);
  const existingUser = await getAuth().getUser(uid);
  const existingClaims = existingUser.customClaims as Partial<OrgMembershipClaim> | undefined;
  if (existingClaims?.orgId === claims.orgId && existingClaims?.role === claims.role) {
    return { action: "skip", reason: "already-current" };
  }

  return { action: "set", claims };
}

export interface MemberDocData {
  role?: string;
}

export interface SyncOrgMembershipClaimParams {
  orgId: string;
  uid: string;
  /** Member document data after the write, or undefined for a delete. */
  after: MemberDocData | undefined;
}

export type SyncOrgMembershipClaimOutcome =
  | { action: "set" }
  | { action: "clear" }
  | { action: "skip"; reason: MembershipClaimSkipReason }
  | { action: "failed"; error: string };

/**
 * The testable handler body, exported separately from the onDocumentWritten
 * wrapper below -- mirrors requestPptxRenderHandler/requestPptxRender
 * (index.ts). Applies decideMembershipClaim's decision via the Admin SDK.
 *
 * The whole body is wrapped in try/catch and resolves with a failure
 * outcome rather than rethrowing -- a throw out of a Firestore trigger
 * causes Cloud Functions retries that would hammer the Auth API (T-40-08).
 */
export async function syncOrgMembershipClaimHandler(
  params: SyncOrgMembershipClaimParams,
): Promise<SyncOrgMembershipClaimOutcome> {
  const { orgId, uid, after } = params;

  try {
    const decision = await decideMembershipClaim({
      uid,
      orgId,
      documentExists: after !== undefined,
      role: after?.role,
    });

    switch (decision.action) {
      case "set":
        // R175: merges onto the user's existing claims rather than
        // replacing the whole object -- see claimsHelpers.ts. Spread into a
        // fresh object literal: OrgMembershipClaim has no index signature,
        // so passing it directly fails TS2345 against Record<string, unknown>.
        await mergeAndSetCustomClaims(uid, { ...decision.claims });
        return { action: "set" };
      case "clear":
        // R175: clears only { orgId, role } (ORG_CLAIM_KEYS), preserving
        // any other claim -- e.g. a granted superAdmin -- rather than
        // wiping the whole claims object via setCustomUserClaims(uid, null).
        await clearClaimKeys(uid, ORG_CLAIM_KEYS);
        return { action: "clear" };
      case "skip":
        return { action: "skip", reason: decision.reason };
    }
  } catch (err) {
    console.error("[orgMembershipClaims] syncOrgMembershipClaim:", err);
    return { action: "failed", error: String(err) };
  }
}

export const syncOrgMembershipClaim = onDocumentWritten(
  "organizations/{orgId}/members/{uid}",
  async (event) => {
    await syncOrgMembershipClaimHandler({
      orgId: event.params.orgId,
      uid: event.params.uid,
      after: event.data?.after.exists
        ? (event.data.after.data() as MemberDocData)
        : undefined,
    });
  },
);
