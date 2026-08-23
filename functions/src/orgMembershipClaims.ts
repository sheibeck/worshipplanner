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

/**
 * CR-01 fix (76-REVIEW.md): recomputes the FULL `deactivatedOrgs` claim map
 * for a set of surviving org memberships, reading each org's live `active`
 * field. This is the self-heal that closes the gap `setOrgActive`'s one-time
 * member fan-out (orgProvisioning.ts) cannot: a member who joins an
 * ALREADY-deactivated org AFTER that fan-out ran (via pending-invite
 * acceptance or assignOrgAdminHandler) never had `deactivatedOrgs[orgId]`
 * set for them. Calling this on EVERY `syncOrgMembershipClaim` write (any
 * members/{uid} create/update/delete) means the very write that adds the new
 * member also computes their deactivatedOrgs entry from the org's CURRENT
 * active state -- no dependency on `setOrgActive` having run again.
 *
 * `orgIds` should be exactly the keys of the freshly-computed `orgs` map
 * (computeOrgsClaimForUid's result) -- i.e. every org this uid currently has
 * a resolved role in. Reads run concurrently via Promise.all, one
 * `organizations/{orgId}` get per org (the same read shape firestore.rules'
 * isOrgActive() and orgProvisioning.ts's setOrgActiveHandler/
 * listOrganizationsHandler already use).
 *
 * A missing org doc, or a present doc with no `active` field, resolves to
 * ACTIVE (default-true, backward-compatible -- mirrors isOrgActive() and
 * setOrgActiveHandler's own `?? true`) -- such an org contributes NO entry to
 * the returned map, exactly like `buildOrgsMapClaim` never fabricates a key
 * that shouldn't be there. Only an org doc that explicitly reads
 * `active === false` gets a `{ [orgId]: true }` entry.
 */
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

/**
 * The `deactivatedOrgs`-map counterpart to orgsMapsEqual, same undefined-as-{}
 * treatment (CR-01, 76-REVIEW.md): a legacy token with no `deactivatedOrgs`
 * key at all compares equal to a freshly-computed empty map, so a member of
 * zero deactivated orgs never triggers a spurious claim write.
 */
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

/**
 * The testable handler body, exported separately from the onDocumentWritten
 * wrapper below -- mirrors requestPptxRenderHandler/requestPptxRender
 * (index.ts). Applies decideMembershipClaim's PRIMARY decision AND a
 * separately-recomputed multi-org `orgs` decision (R207/R208), merging both
 * into as few Admin SDK writes as the case allows.
 *
 * decideMembershipClaim only ever fires for the user's PRIMARY org (its
 * scope is unchanged, see its docblock above) -- but `orgs` must be
 * recomputed on EVERY write, primary or not, since a non-primary-org
 * join/leave never touches the primary claim yet must still update `orgs`
 * (73-RESEARCH.md System Architecture Diagram step 2). computeOrgsClaimForUid
 * is therefore called unconditionally except for the two fully-conservative
 * skip reasons ("no-user-doc", "missing-role") where the write is too
 * ambiguous to act on at all -- exactly the pre-widening behaviour for those
 * two cases, extended unchanged.
 *
 * The whole body is wrapped in try/catch and resolves with a failure
 * outcome rather than rethrowing -- a throw out of a Firestore trigger
 * causes Cloud Functions retries that would hammer the Auth API (T-40-08).
 *
 * CR-01 fix (76-REVIEW.md): ALSO recomputes the `deactivatedOrgs` claim on
 * every write that reaches computeOrgsClaimForUid (i.e. every write except
 * the two fully-conservative skips below), from the SAME surviving-orgs list
 * `orgs` is built from. This is the self-heal that closes the gap in
 * `setOrgActive`'s one-time member fan-out (orgProvisioning.ts): a member who
 * joins an ALREADY-deactivated org (pending-invite acceptance, or
 * assignOrgAdminHandler) fires THIS trigger, which now independently reads
 * that org's live `active` field and sets `deactivatedOrgs[orgId]`
 * accordingly -- no dependency on `setOrgActive` running again after they
 * join. It is also the WR-03 fix: a member removed then re-added mid-
 * deactivation recomputes fresh on rejoin rather than keeping a stale
 * fan-out-time value. `computeDeactivatedOrgsClaimForUid` reads ONLY the
 * orgs the recomputed `orgs` map actually lists (never a stale prior claim),
 * so a genuinely-active org always yields NO entry -- deactivatedOrgs never
 * grows a phantom key for a normal/reactivated membership.
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

    // Fully-conservative skips: the write is too ambiguous to act on at
    // all (no user doc, or a create/update with no role field -- WR-01).
    // Never touch orgs/deactivatedOrgs here either -- identical to
    // pre-widening behaviour.
    if (decision.action === "skip" && (decision.reason === "no-user-doc" || decision.reason === "missing-role")) {
      return { action: "skip", reason: decision.reason };
    }

    const desiredOrgs = await computeOrgsClaimForUid(uid);
    // CR-01: recomputed from the SAME surviving-org list `orgs` was just
    // built from -- every org this uid currently has a resolved role in.
    const desiredDeactivatedOrgs = await computeDeactivatedOrgsClaimForUid(Object.keys(desiredOrgs));

    switch (decision.action) {
      case "set":
        // R175: ONE merge call carries the primary keys AND the recomputed
        // orgs map, preserving superAdmin (or any other unrelated claim).
        // Spread decision.claims into a fresh object literal: OrgMembershipClaim
        // has no index signature, so passing it directly fails TS2345
        // against Record<string, unknown>. CR-01: deactivatedOrgs rides along
        // in this SAME write -- the write that creates/updates this member's
        // primary claim is exactly the moment their deactivated-org status
        // (if any) must also be established.
        await mergeAndSetCustomClaims(uid, {
          ...decision.claims,
          orgs: desiredOrgs,
          deactivatedOrgs: desiredDeactivatedOrgs,
        });
        return { action: "set" };
      case "clear": {
        // A genuine primary-membership delete. Clearing the primary keys and
        // recomputing `orgs` are INDEPENDENT effects (73-RESEARCH.md Pitfall
        // 2) -- NEVER blanket-clear orgs here; a still-valid second-org
        // membership must survive. WR-01 (73-REVIEW.md): this used to be TWO
        // sequential Admin SDK writes (clearClaimKeys then
        // mergeAndSetCustomClaims), which opened a brief TOCTOU window --
        // a token minted between the two writes could carry no orgId/role
        // but a STALE orgs map still listing the org just removed, retaining
        // Storage access via storage.rules' orgs[orgId] arm. Collapsed into
        // ONE atomic setCustomUserClaims call via mergeSetAndClearCustomClaims
        // (claimsHelpers.ts), which reads current claims once and applies the
        // clear+set in memory before the single write -- preserving
        // everything it doesn't explicitly touch (e.g. superAdmin).
        // CR-01: deactivatedOrgs is recomputed from the survivors here too,
        // so a primary-org delete that leaves the user still a member of a
        // deactivated second org keeps that entry, and drops the deleted
        // org's entry (if any) since it's no longer in desiredOrgs' keys.
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
    // WR-02 (73-REVIEW.md): the ~1000-byte custom-claims cap throws
    // auth/claims-too-large -- give it a distinguishable, greppable log line
    // rather than letting it blend into the generic failure path below.
    // Still fail-closed (return { action: "failed" }) -- this only changes
    // logging, never success behavior.
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
