import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { isClaimsTooLargeError, mergeAndSetCustomClaims, mergeSetAndClearCustomClaims } from "./claimsHelpers";

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

/** The exact top-level custom-claim keys this module ever writes for the primary org. */
export const ORG_CLAIM_KEYS = ["orgId", "role"] as const;

/**
 * The additive multi-org claim key added by 73-01-PLAN.md (R207). Carries a
 * full `{ [orgId]: role }` map alongside the UNCHANGED primary `orgId`/`role`
 * keys above -- storage.rules reads it as `request.auth.token.orgs`.
 */
export const ORGS_CLAIM_KEY = "orgs";

/**
 * Phase 76 (R212-R214): the additive, independent claim key `setOrgActive`
 * (orgProvisioning.ts) fans out to every member of a deactivated org. Lives
 * alongside -- never replacing or filtering -- the `orgs` map/legacy
 * `orgId`/`role` keys above. `computeOrgsClaimForUid`/`buildOrgsMapClaim`/
 * `decideMembershipClaim` are UNTOUCHED by this phase (76-RESEARCH.md
 * Pattern 1) -- this is purely net-new claim surface, read by
 * storage.rules' isOrgDeactivatedForCaller(orgId).
 */
export const DEACTIVATED_ORGS_CLAIM_KEY = "deactivatedOrgs";
export type DeactivatedOrgsClaim = Record<string, true>;

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
 * The widened claim shape (R207): the UNCHANGED primary `{ orgId, role }`
 * plus the new additive `orgs` map carrying every org the user currently
 * belongs to. Purely additive -- ORG_CLAIM_KEYS / OrgMembershipClaim /
 * buildOrgMembershipClaim keep their exact pre-existing semantics below.
 */
export type OrgMembershipClaims = OrgMembershipClaim & { orgs: Record<string, OrgMembershipRole> };

/**
 * Builds the `{ orgId, role }` claim object in the exact locked shape from
 * 40-CONTEXT.md's D-01/D-02/D-03: two readable top-level keys and nothing
 * else. Normalises a legacy `role` of `'admin'` to `'editor'`.
 */
export function buildOrgMembershipClaim(orgId: string, role: string): OrgMembershipClaim {
  const normalizedRole: OrgMembershipRole = role === "admin" ? "editor" : (role as OrgMembershipRole);
  return { orgId, role: normalizedRole };
}

/**
 * The shared, no-drift `orgs`-map builder (73-CONTEXT.md D-11): the ONE
 * place multi-org role normalisation lives, imported by both
 * computeOrgsClaimForUid below and plan 73-03's backfill so the trigger and
 * the backfill can never drift on what an `orgs` map should contain.
 * Normalises each membership's role exactly as buildOrgMembershipClaim does
 * (`admin` -> `editor`) and skips any membership whose role is undefined --
 * a live members doc with no `role` field never enters the map.
 */
export function buildOrgsMapClaim(
  memberships: Array<{ orgId: string; role: string | undefined }>,
): Record<string, OrgMembershipRole> {
  const orgs: Record<string, OrgMembershipRole> = {};
  for (const { orgId, role } of memberships) {
    if (role === undefined) continue;
    orgs[orgId] = role === "admin" ? "editor" : (role as OrgMembershipRole);
  }
  return orgs;
}

/**
 * Structural guard, in the spirit of index.ts's MEDIA_PATH_GUARD -- mirrors
 * backfillOrgClaims.ts's resolveOrgId byte-for-byte (D-11: one guard shared
 * by the trigger and the backfill). A `members` document is only ever a real
 * membership candidate when it is a child of an `organizations/{orgId}`
 * document. `collectionGroup('members')` matches ANY subcollection literally
 * named `members` anywhere in the database, so this guard is applied to
 * every candidate before it can affect a claim. Returns the org id on
 * success, undefined when the guard fails.
 */
export function resolveOrgId(memberDoc: QueryDocumentSnapshot): string | undefined {
  const orgDoc = memberDoc.ref.parent.parent;
  if (!orgDoc) return undefined;
  if (orgDoc.parent.id !== "organizations") return undefined;
  return orgDoc.id;
}

/**
 * Recomputes the full `orgs` map for `uid` from the SURVIVING
 * organizations/*\/members/{uid} documents -- NEVER from users/{uid}.orgIds.
 * 73-RESEARCH.md Pattern 1 proves `orgIds` is structurally overwrite-broken:
 * both the invite-acceptance and org-auto-create paths in src/stores/auth.ts
 * RESET it to a single-element array rather than appending, so it can never
 * list a second org, and it is also never updated on a client-side member
 * deletion. A live collectionGroup scan of the actual membership documents
 * is the only authoritative source for "which orgs does this uid currently
 * belong to".
 *
 * This runs an UNFILTERED collectionGroup('members') scan, filtered
 * client-side to `doc.id === uid` -- Firestore collection-group queries
 * cannot filter by document-ID equality across differing parent paths
 * (73-RESEARCH.md Pattern 2: FieldPath.documentId() equality requires the
 * full path, including the not-yet-known parent org id), so this is the
 * correct query shape, not a missed optimisation. This is proportionate at
 * this project's current scale (a handful of users per org); if a future
 * cost audit finds the per-write full scan material, the documented
 * scale-out path is a denormalised `uid` field on every member doc plus a
 * collection-group field-override index (see backfillOrgClaims.ts's own D-10
 * scale note for the sibling pattern) -- do not build that speculatively.
 *
 * Firestore's default read/query mode is strongly consistent, so calling
 * this immediately after the SAME event's own triggering write has
 * committed is race-free -- a delete just committed by this very trigger is
 * guaranteed to already be absent from this scan.
 */
export async function computeOrgsClaimForUid(uid: string): Promise<Record<string, OrgMembershipRole>> {
  const snapshot = await getFirestore().collectionGroup("members").get();
  const memberships: Array<{ orgId: string; role: string | undefined }> = [];
  for (const memberDoc of snapshot.docs) {
    if (memberDoc.id !== uid) continue;
    const orgId = resolveOrgId(memberDoc);
    if (orgId === undefined) continue;
    const role = (memberDoc.data() as { role?: string } | undefined)?.role;
    memberships.push({ orgId, role });
  }
  return buildOrgsMapClaim(memberships);
}

/** See ADR-0044 (docs/adr/0044-belt-and-suspenders-76-review-md-refuse-to-grow-membership-o.md) */
export async function computeDeactivatedOrgsClaimForUid(
  orgIds: string[],
): Promise<DeactivatedOrgsClaim> {
  const db = getFirestore();
  const states = await Promise.all(
    orgIds.map(async (orgId) => {
      const orgSnap = await db.collection("organizations").doc(orgId).get();
      const active = orgSnap.exists
        ? ((orgSnap.data() as { active?: boolean } | undefined)?.active ?? true)
        : true;
      return { orgId, active };
    }),
  );
  const deactivatedOrgs: DeactivatedOrgsClaim = {};
  for (const { orgId, active } of states) {
    if (active === false) deactivatedOrgs[orgId] = true;
  }
  return deactivatedOrgs;
}

export interface DecideMembershipClaimParams {
  uid: string;
  orgId: string;
  /** See ADR-0045 (docs/adr/0045-whether-the-member-document-exists-after-this-write-false-on.md) */
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
 * SCOPE (unchanged by 73-01-PLAN.md, deliberate): this function decides ONLY
 * the primary `{ orgId, role }` claim -- it never sets or clears a claim for
 * a non-primary org, and its return contract stays exactly what it was
 * before the multi-org widening so plan 40-04's backfill (untouched this
 * wave) keeps working unmodified. The MULTI-ORG `orgs` map that closes the
 * "non-primary org" gap this docblock used to describe as a known limitation
 * is computed separately, by computeOrgsClaimForUid below, and merged in by
 * syncOrgMembershipClaimHandler on every write regardless of what this
 * function decides for the primary keys (R207/R208).
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

  // See ADR-0045 (docs/adr/0045-whether-the-member-document-exists-after-this-write-false-on.md)
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
 * Shallow-equal for two `orgs` maps. `undefined` (no `orgs` claim key at
 * all -- a legacy pre-widening token) is treated as equivalent to `{}` (a
 * freshly-computed empty map for a user with zero surviving memberships), so
 * a legacy claim for a user with no memberships correctly compares as
 * "already current" rather than triggering a spurious write.
 *
 * Exported (IN-01, 73-REVIEW.md) so backfillOrgClaims.ts imports this SAME
 * implementation rather than maintaining its own verbatim copy -- the two
 * signatures had already started to drift (this one accepts `undefined` for
 * `current`, the old backfill copy required a non-optional `Record`), which
 * is exactly the kind of divergence a shared helper (mirroring
 * buildOrgsMapClaim/resolveOrgId's existing pattern) prevents.
 */
export function orgsMapsEqual(
  current: Record<string, OrgMembershipRole> | undefined,
  next: Record<string, OrgMembershipRole>,
): boolean {
  const currentMap = current ?? {};
  const currentKeys = Object.keys(currentMap);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) return false;
  return currentKeys.every((key) => currentMap[key] === next[key]);
}

/** See ADR-0044 (docs/adr/0044-belt-and-suspenders-76-review-md-refuse-to-grow-membership-o.md) */
export function deactivatedOrgsMapsEqual(
  current: DeactivatedOrgsClaim | undefined,
  next: DeactivatedOrgsClaim,
): boolean {
  const currentMap = current ?? {};
  const currentKeys = Object.keys(currentMap);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) return false;
  return currentKeys.every((key) => currentMap[key] === next[key]);
}

/** See ADR-0046 (docs/adr/0046-two-cases-extended-unchanged-the-whole-body-is-wrapped-in-tr.md) */
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

    // See ADR-0045 (docs/adr/0045-whether-the-member-document-exists-after-this-write-false-on.md)
    if (decision.action === "skip" && (decision.reason === "no-user-doc" || decision.reason === "missing-role")) {
      return { action: "skip", reason: decision.reason };
    }

    const desiredOrgs = await computeOrgsClaimForUid(uid);
    // See ADR-0047 (docs/adr/0047-recomputed-from-the-same-surviving-org-list-orgs-was-just-bu.md)
    const desiredDeactivatedOrgs = await computeDeactivatedOrgsClaimForUid(Object.keys(desiredOrgs));

    switch (decision.action) {
      case "set":
        // See ADR-0047 (docs/adr/0047-recomputed-from-the-same-surviving-org-list-orgs-was-just-bu.md)
        await mergeAndSetCustomClaims(uid, {
          ...decision.claims,
          orgs: desiredOrgs,
          deactivatedOrgs: desiredDeactivatedOrgs,
        });
        return { action: "set" };
      case "clear": {
        // See ADR-0048 (docs/adr/0048-a-genuine-primary-membership-delete-clearing-the-primary-key.md)
        await mergeSetAndClearCustomClaims(uid, {
          set: { orgs: desiredOrgs, deactivatedOrgs: desiredDeactivatedOrgs },
          clear: ORG_CLAIM_KEYS,
        });
        return { action: "clear" };
      }
      case "skip": {
        // Primary keys are unaffected ("not-primary-org" or
        // "already-current"), but `orgs`/`deactivatedOrgs` still need
        // recomputing -- this is what makes a non-primary-org join/leave (or
        // an org's active flag flipping) update either claim even though the
        // primary decision never fires for it. Only write if either actually
        // changed; otherwise this is a genuine no-op skip.
        const existingUser = await getAuth().getUser(uid);
        const existingClaims = existingUser.customClaims as
          | { orgs?: Record<string, OrgMembershipRole>; deactivatedOrgs?: DeactivatedOrgsClaim }
          | undefined;
        const ordersUnchanged = orgsMapsEqual(existingClaims?.orgs, desiredOrgs);
        const deactivatedUnchanged = deactivatedOrgsMapsEqual(
          existingClaims?.deactivatedOrgs,
          desiredDeactivatedOrgs,
        );
        if (ordersUnchanged && deactivatedUnchanged) {
          return { action: "skip", reason: decision.reason };
        }
        await mergeAndSetCustomClaims(uid, { orgs: desiredOrgs, deactivatedOrgs: desiredDeactivatedOrgs });
        return { action: "set" };
      }
    }
  } catch (err) {
    // See ADR-0012 (docs/adr/0012-the-1000-byte-custom-claims-cap-throws-auth-claims-too-large.md)
    if (isClaimsTooLargeError(err)) {
      console.error(
        `[orgMembershipClaims] CLAIM SIZE LIMIT EXCEEDED for uid=${uid}: custom claims exceeded the ~1000-byte cap and were not written`,
        err,
      );
    } else {
      console.error("[orgMembershipClaims] syncOrgMembershipClaim:", err);
    }
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
