import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  FieldValue,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";
import { buildDefaultOrgSettings } from "./orgTemplateSeed";
import { patchNestedClaimKey } from "./claimsHelpers";
import { DEACTIVATED_ORGS_CLAIM_KEY } from "./orgMembershipClaims";
import { RESEND_API_KEY } from "./params";
import { sendAdminOnboardingEmail } from "./adminEmail";

// --- orgProvisioning (Phase 74, R196-R206: the owner-console org-provisioning
// callables) ----------------------------------------------------------------
//
// This module deliberately does NOT call initializeApp() at module scope --
// mirrors superAdminClaims.ts / orgMembershipClaims.ts: functions/src/index.ts
// already does that for the deployed runtime. Calling it here would break
// that caller.
//
// All three callables are gated by the SAME dual super-admin caller check
// (assertSuperAdminCaller) that setSuperAdminClaimHandler established:
// reject an unauthenticated caller, reject a caller whose ID-token claim
// lacks superAdmin, AND independently re-read superAdmins/{callerUid} from
// Firestore -- never trust a client-declared authority flag alone.
//
// Neither callable ever writes a custom claim itself -- the members/{uid}
// write below is what fires syncOrgMembershipClaim (orgMembershipClaims.ts),
// which is the SOLE claim writer for org membership, mirroring the
// source-doc -> trigger -> claim indirection already established elsewhere
// in this codebase.

/**
 * Normalize an organization display name into a stable, Firestore-doc-id-safe
 * uniqueness KEY (for the `orgNames/{key}` registry). Ported byte-for-byte
 * from `src/utils/orgName.ts::normalizeOrgName` (pure, no Firestore imports)
 * -- do not reimplement its slug-fallback differently.
 *
 * Exported (Phase 77, R217/R218) so `orgDeletion.ts` can compute the same
 * `orgNames/{nameKey}` id when guarding the deletion cascade's `orgNames`
 * cleanup -- imported, never duplicated.
 */
export function normalizeOrgName(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!key || /^\.+$/.test(key)) return deriveSlug(name);
  return key;
}

/**
 * Ported byte-for-byte from `src/utils/slug.ts::deriveSlug` -- the fallback
 * `normalizeOrgName` uses when a name has no usable non-dot/non-slash
 * characters at all. Pure, no imports.
 */
function deriveSlug(orgName: string): string {
  return orgName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** See ADR-0049 (docs/adr/0049-never-attempt-the-revoke-after-a-failed-claim-patch-mirrors.md) */
function assertValidEmailFormat(email: string): void {
  const trimmed = email.trim();
  if (!trimmed || trimmed.includes("/") || !trimmed.includes("@") || !trimmed.includes(".")) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }
}

/**
 * The single caller-gate helper applied verbatim by all three handlers below
 * (R200/R204) -- mirrors setSuperAdminClaimHandler (superAdminClaims.ts:106-128)
 * exactly. Factoring it into one function keeps the dual re-verification from
 * drifting between handlers. Returns the verified caller uid.
 *
 * Exported (Phase 77, R216) so `deleteOrganizationHandler` (orgDeletion.ts)
 * reuses this SAME gate verbatim rather than forking a second implementation
 * -- T-77-01.
 */
export async function assertSuperAdminCaller(request: CallableRequest<unknown>): Promise<string> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  if (request.auth.token.superAdmin !== true) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }
  const callerDoc = await getFirestore().collection("superAdmins").doc(request.auth.uid).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }
  return request.auth.uid;
}

/** The classified outcome of resolving an admin-assignment target by email. */
export type AdminTarget =
  | { kind: "existing"; uid: string; displayName: string; email: string }
  | { kind: "invite"; email: string };

/** See ADR-0050 (docs/adr/0050-resolves-an-admin-assignment-target-by-email-the-only-networ.md) */
export async function resolveAdminTarget(email: string): Promise<AdminTarget> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const targetUser = await getAuth().getUserByEmail(normalizedEmail);
    return {
      kind: "existing",
      uid: targetUser.uid,
      displayName: targetUser.displayName ?? "",
      email: normalizedEmail,
    };
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/user-not-found") {
      return { kind: "invite", email: normalizedEmail };
    }
    console.error("[orgProvisioning] resolveAdminTarget: getUserByEmail failed:", err);
    throw err;
  }
}

/**
 * A minimal structural interface exposing just the `set` method
 * `writeAdminAssignment` needs -- `Transaction` and `WriteBatch`'s
 * overloaded generic `set` signatures don't reliably unify under a plain
 * `Transaction | WriteBatch` union type, so this interface is the shared
 * contract both satisfy structurally.
 */
interface AdminWriter {
  set(
    ref: DocumentReference,
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): unknown;
}

/**
 * The SINGLE shared write-only helper (R206/R199/R203/R205) used by BOTH
 * `onboardOrganizationHandler` (passing a `Transaction`) and
 * `assignOrgAdminHandler` (passing a `WriteBatch`) -- no reads, no
 * commit/await, it only enqueues writes on the caller-supplied `writer`. This
 * is the ONLY place any members/invite write happens, so the R206 additive
 * `arrayUnion` guarantee lives in exactly one implementation.
 *
 * `target.kind === 'existing'`: writes the members/{uid} doc AND appends
  * See ADR-0051 (docs/adr/0051-if-this-admin-is-already-a-member-of-this-org-preserve-their.md)
 * `target.kind === 'invite'`: writes the invites/{email} + inviteLookup/{email}
 * artifacts src/stores/auth.ts's ensureUserDocument already reads on next
 * sign-in -- no dangling membership, no silent failure (R205).
 */
function writeAdminAssignment(
  writer: AdminWriter,
  db: Firestore,
  orgId: string,
  target: AdminTarget,
  callerUid: string,
  existingJoinedAt?: unknown,
): void {
  if (target.kind === "existing") {
    const memberRef = db.collection("organizations").doc(orgId).collection("members").doc(target.uid);
    writer.set(memberRef, {
      role: "editor",
      joinedAt: existingJoinedAt ?? FieldValue.serverTimestamp(),
      displayName: target.displayName,
      email: target.email,
    });
    const userRef = db.collection("users").doc(target.uid);
    writer.set(userRef, { orgIds: FieldValue.arrayUnion(orgId) }, { merge: true });
    return;
  }

  const inviteRef = db.collection("organizations").doc(orgId).collection("invites").doc(target.email);
  writer.set(inviteRef, {
    role: "editor",
    invitedAt: FieldValue.serverTimestamp(),
    invitedBy: callerUid,
  });
  const lookupRef = db.collection("inviteLookup").doc(target.email);
  writer.set(lookupRef, { orgId, role: "editor" });
}

// --- onboardOrganization (R197-R202, R199) ----------------------------------

export interface OnboardOrganizationRequest {
  name: string;
  adminEmail: string;
}

export interface OnboardOrganizationResponse {
  status: "added" | "invited";
  orgId: string;
  name: string;
  /** True iff the best-effort admin-onboarding notification email resolved
   * (quick task 260823). A false value NEVER means onboarding failed -- the
   * org is already created; the email is best-effort and its failure is
   * swallowed (logged) so the console could surface delivery status later. */
  emailSent: boolean;
}

/**
 * The testable handler body, exported separately from the onCall wrapper
 * below -- mirrors setSuperAdminClaimHandler/setSuperAdminClaim.
 *
 * R202 ATOMICITY: `resolveAdminTarget` (the ONLY Auth network call) runs
 * BEFORE any Firestore write, then ALL writes happen inside ONE
 * `runTransaction` -- the single read is `tx.get(orgNames/{nameKey})` first
 * (all tx.get calls must precede all tx writes, a hard Firestore
 * constraint); if that doc exists, throw `already-exists` before any write.
 * Otherwise every write -- orgNames claim, organizations/{orgId} + seeded
 * settings, AND the first-admin membership/invite via writeAdminAssignment
 * -- is enqueued on that SAME transaction. There is NO post-commit
 * admin-assignment step, so a transient failure (an aborted transaction, or
 * a non-user-not-found error from resolveAdminTarget before it) commits
 * nothing, and a clean same-name retry succeeds without manual cleanup.
 */
export async function onboardOrganizationHandler(
  request: CallableRequest<OnboardOrganizationRequest>,
): Promise<OnboardOrganizationResponse> {
  const callerUid = await assertSuperAdminCaller(request);

  const { name, adminEmail } = request.data ?? ({} as OnboardOrganizationRequest);
  if (typeof name !== "string" || name.trim() === "") {
    throw new HttpsError("invalid-argument", "name is required.");
  }
  if (typeof adminEmail !== "string" || adminEmail.trim() === "") {
    throw new HttpsError("invalid-argument", "adminEmail is required.");
  }
  assertValidEmailFormat(adminEmail);

  const nameKey = normalizeOrgName(name);
  const db = getFirestore();

  // The only Auth network call -- resolved BEFORE any write so a rethrown
  // transient failure here strands nothing (R202).
  const target = await resolveAdminTarget(adminEmail);

  // Mint the org id up front (client-side, no network round trip) so it can
  // be threaded into the same transaction as the name claim.
  const orgRef = db.collection("organizations").doc();
  const orgId = orgRef.id;
  const nameRef = db.collection("orgNames").doc(nameKey);

  await db.runTransaction(async (tx) => {
    // ALL tx.get calls must precede ALL tx writes -- this is the only read.
    const nameSnap = await tx.get(nameRef);
    if (nameSnap.exists) {
      throw new HttpsError("already-exists", "That church name is taken.");
    }

    tx.set(nameRef, { orgId });
    tx.set(orgRef, {
      name,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: callerUid,
      settings: buildDefaultOrgSettings(),
    });
    // The first-admin write is enqueued on THIS SAME transaction -- no
    // post-commit step can strand an admin-less org (R202).
    writeAdminAssignment(tx, db, orgId, target, callerUid);
  });

  // Best-effort admin-onboarding email (quick task 260823) -- ALWAYS after the
  // transaction commits, NEVER inside it. A send failure MUST NOT fail
  // onboarding: the org is already created, so we swallow + log any error and
  // report it via `emailSent: false`. Maps the resolved target kind to the
  // notification copy ('existing' account -> 'added'; no account -> 'invited').
  let emailSent = false;
  try {
    await sendAdminOnboardingEmail({
      db,
      to: target.email,
      orgName: name,
      kind: target.kind === "existing" ? "added" : "invited",
    });
    emailSent = true;
  } catch (err) {
    console.error(
      `[orgProvisioning] onboardOrganization: admin email failed for orgId=${orgId}, to=${target.email} (onboarding still succeeded):`,
      err,
    );
  }

  return { status: target.kind === "existing" ? "added" : "invited", orgId, name, emailSent };
}

// onboardOrganization binds RESEND_API_KEY (moved to ./params so this module can
// hold it without a circular import) -- the ONLY new key-holding surface this
// task adds; the send happens post-transaction, best-effort.
export const onboardOrganization = onCall({ secrets: [RESEND_API_KEY] }, onboardOrganizationHandler);

// --- assignOrgAdmin (R203-R206) ---------------------------------------------

export interface AssignOrgAdminRequest {
  orgId: string;
  email: string;
}

export interface AssignOrgAdminResponse {
  status: "added" | "invited";
  uid?: string;
}

/**
 * The testable handler body, exported separately from the onCall wrapper
 * below.
 *
 * Orphan guard (T-74-06): rejects a typo'd/nonexistent `orgId` BEFORE any
 * write, so no orphaned membership is ever created under an id with no
 * matching org.
 *
 * Reuses the EXACT same `writeAdminAssignment` helper `onboardOrganization`
 * uses -- here the `writer` is a `WriteBatch` (there, a `Transaction`) --
 * so the R206 additive `arrayUnion` guarantee never forks into two
 * implementations.
 */
export async function assignOrgAdminHandler(
  request: CallableRequest<AssignOrgAdminRequest>,
): Promise<AssignOrgAdminResponse> {
  const callerUid = await assertSuperAdminCaller(request);

  const { orgId, email } = request.data ?? ({} as AssignOrgAdminRequest);
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }
  if (typeof email !== "string" || email.trim() === "") {
    throw new HttpsError("invalid-argument", "email is required.");
  }
  assertValidEmailFormat(email);

  const db = getFirestore();

  const orgSnap = await db.collection("organizations").doc(orgId).get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `No organization found for id "${orgId}".`);
  }

  // See ADR-0044 (docs/adr/0044-belt-and-suspenders-76-review-md-refuse-to-grow-membership-o.md)
  const orgActive = (orgSnap.data() as { active?: boolean } | undefined)?.active ?? true;
  if (!orgActive) {
    throw new HttpsError("failed-precondition", "Reactivate the church before assigning admins.");
  }

  const target = await resolveAdminTarget(email);

  // See ADR-0051 (docs/adr/0051-if-this-admin-is-already-a-member-of-this-org-preserve-their.md)
  let existingJoinedAt: unknown;
  if (target.kind === "existing") {
    const memberSnap = await db
      .collection("organizations")
      .doc(orgId)
      .collection("members")
      .doc(target.uid)
      .get();
    if (memberSnap.exists) {
      existingJoinedAt = memberSnap.data()?.joinedAt;
    }
  }

  const batch = db.batch();
  writeAdminAssignment(batch, db, orgId, target, callerUid, existingJoinedAt);
  await batch.commit();

  if (target.kind === "existing") {
    return { status: "added", uid: target.uid };
  }
  return { status: "invited" };
}

export const assignOrgAdmin = onCall(assignOrgAdminHandler);

// --- listOrganizations (R196) ------------------------------------------------

export interface OrgSummary {
  orgId: string;
  name: string;
  createdAt: unknown;
  memberCount: number;
  pendingCount: number;
  /** Phase 76 (R212-R214): `false` only when the org doc explicitly carries
   * `active: false`. Absent (every pre-Phase-76 org) or explicit `true` both
   * read as active -- default-true, backward-compatible (see setOrgActive
   * and firestore.rules' isOrgActive for the same default). */
  active: boolean;
  /** Phase 82 (R242): the super-admin-only master AI gate. `false` when
   * absent -- the INVERSE default from `active` above, matching R242's "AI
   * is OFF by default for every organization (including newly-onboarded
   * ones)" -- only an EXPLICIT `aiMasterEnabled: true` reads as enabled. */
  aiMasterEnabled: boolean;
  /** Phase 101 (R295): the super-admin-only master Bible-API gate. `false`
   * when absent -- same INVERSE-default posture as `aiMasterEnabled`: a
   * fresh/legacy org has the Bible API off until a super-admin explicitly
   * enables it, no migration of existing orgs. */
  bibleApiEnabled: boolean;
}

export interface ListOrganizationsResponse {
  organizations: OrgSummary[];
}

/**
 * The testable handler body, exported separately from the onCall wrapper
 * below. Reads every `organizations` doc and computes each member count and
 * pending-invite count server-side via the members and invites subcollections'
 * `count()` aggregate queries (Promise.all across orgs, and Promise.all across
 * the two aggregates within each org so they fire concurrently) -- keeps
 * firestore.rules unchanged (no broadened client read of organizations/*
 * across every org).
 */
export async function listOrganizationsHandler(
  request: CallableRequest<void>,
): Promise<ListOrganizationsResponse> {
  await assertSuperAdminCaller(request);

  const db = getFirestore();
  const orgsSnap = await db.collection("organizations").get();
  const organizations = await Promise.all(
    orgsSnap.docs.map(async (orgDoc) => {
      const [membersCountSnap, invitesCountSnap] = await Promise.all([
        orgDoc.ref.collection("members").count().get(),
        orgDoc.ref.collection("invites").count().get(),
      ]);
      const data = orgDoc.data() as {
        name?: string;
        createdAt?: unknown;
        active?: boolean;
        aiMasterEnabled?: boolean;
        bibleApiEnabled?: boolean;
      };
      return {
        orgId: orgDoc.id,
        name: data.name ?? "(unnamed)",
        createdAt: data.createdAt ?? null,
        memberCount: membersCountSnap.data().count,
        pendingCount: invitesCountSnap.data().count,
        active: data.active ?? true,
        aiMasterEnabled: data.aiMasterEnabled ?? false,
        bibleApiEnabled: data.bibleApiEnabled ?? false,
      };
    }),
  );

  return { organizations };
}

export const listOrganizations = onCall(listOrganizationsHandler);

// --- setOrgActive (R212-R214: church deactivation/reactivation) ------------

export interface SetOrgActiveRequest {
  orgId: string;
  active: boolean;
}

export interface SetOrgActiveResponse {
  orgId: string;
  active: boolean;
  memberCount: number;
  /** See ADR-0052 (docs/adr/0052-the-testable-handler-body-exported-separately-from-the-oncal.md) */
  claimFailures: number;
  /** See ADR-0049 (docs/adr/0049-never-attempt-the-revoke-after-a-failed-claim-patch-mirrors.md) */
  revokeFailures: number;
}

/** See ADR-0052 (docs/adr/0052-the-testable-handler-body-exported-separately-from-the-oncal.md) */
export async function setOrgActiveHandler(
  request: CallableRequest<SetOrgActiveRequest>,
): Promise<SetOrgActiveResponse> {
  const callerUid = await assertSuperAdminCaller(request);

  const { orgId, active } = request.data ?? ({} as SetOrgActiveRequest);
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }
  if (typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "active (boolean) is required.");
  }

  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `No organization found for id "${orgId}".`);
  }

  const currentActive = (orgSnap.data() as { active?: boolean } | undefined)?.active ?? true;
  if (currentActive !== active) {
    await orgRef.set(
      active
        ? { active: true, reactivatedAt: FieldValue.serverTimestamp(), reactivatedBy: callerUid }
        : { active: false, deactivatedAt: FieldValue.serverTimestamp(), deactivatedBy: callerUid },
      { merge: true },
    );
  }

  const membersSnap = await orgRef.collection("members").get();
  const results = await Promise.allSettled(
    membersSnap.docs.map(async (memberDoc) => {
      const uid = memberDoc.id;
      let claimFailed = false;
      let revokeFailed = false;
      try {
        await patchNestedClaimKey(uid, DEACTIVATED_ORGS_CLAIM_KEY, orgId, active ? undefined : true);
      } catch (err) {
        claimFailed = true;
        console.error(`[orgProvisioning] setOrgActive: claim patch failed for uid=${uid}, orgId=${orgId}:`, err);
      }
      // See ADR-0049 (docs/adr/0049-never-attempt-the-revoke-after-a-failed-claim-patch-mirrors.md)
      if (!active && !claimFailed) {
        try {
          await getAuth().revokeRefreshTokens(uid);
        } catch (err) {
          revokeFailed = true;
          console.error(`[orgProvisioning] setOrgActive: revokeRefreshTokens failed for uid=${uid}:`, err);
        }
      }
      return { claimFailed, revokeFailed };
    }),
  );
  let claimFailures = 0;
  let revokeFailures = 0;
  for (const result of results) {
    if (result.status === "rejected") {
      // Not expected in practice (both awaits above are individually
      // try/caught), but fail closed: count an unexpected outer rejection
      // toward claimFailures so it is never silently dropped.
      claimFailures += 1;
      continue;
    }
    if (result.value.claimFailed) claimFailures += 1;
    if (result.value.revokeFailed) revokeFailures += 1;
  }

  return { orgId, active, memberCount: membersSnap.size, claimFailures, revokeFailures };
}

export const setOrgActive = onCall(setOrgActiveHandler);

// --- setOrgAiEnabled (R242/R243: per-org master AI gate) --------------------

export interface SetOrgAiEnabledRequest {
  orgId: string;
  aiEnabled: boolean;
}

export interface SetOrgAiEnabledResponse {
  orgId: string;
  aiEnabled: boolean;
}

/**
 * The testable handler body, exported separately from the onCall wrapper
 * below -- mirrors setOrgActiveHandler's shape (caller gate, input
 * validation, org-existence check, same-state-aware merge write) but WITHOUT
 * the member-claim fan-out: AI enablement carries no Storage-side
 * enforcement or refresh-token revocation requirement (unlike deactivation,
 * which must cut off a member's live Storage access), so there is nothing
 * analogous to patch per member here.
 *
 * R243 forced-off (the one real behavioral difference from setOrgActive):
  * See ADR-0053 (docs/adr/0053-the-disable-branch-writes-both-aimasterenabled-false-and.md)
 * worry about there.
 */
export async function setOrgAiEnabledHandler(
  request: CallableRequest<SetOrgAiEnabledRequest>,
): Promise<SetOrgAiEnabledResponse> {
  const callerUid = await assertSuperAdminCaller(request);

  const { orgId, aiEnabled } = request.data ?? ({} as SetOrgAiEnabledRequest);
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }
  if (typeof aiEnabled !== "boolean") {
    throw new HttpsError("invalid-argument", "aiEnabled (boolean) is required.");
  }

  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `No organization found for id "${orgId}".`);
  }

  const orgData = orgSnap.data() as
    | { aiMasterEnabled?: boolean; settings?: { aiEnabled?: boolean } }
    | undefined;
  const currentAiMasterEnabled = orgData?.aiMasterEnabled ?? false;
  const currentSettingsAiEnabled = orgData?.settings?.aiEnabled ?? false;

  const alreadyInEffect = aiEnabled
    ? currentAiMasterEnabled === true
    : currentAiMasterEnabled === false && currentSettingsAiEnabled === false;

  if (!alreadyInEffect) {
    if (aiEnabled) {
      await orgRef.set(
        {
          aiMasterEnabled: true,
          aiEnabledAt: FieldValue.serverTimestamp(),
          aiEnabledBy: callerUid,
          // IN-01 (82-REVIEW): clear the opposite transition's audit fields
          // so a stale aiDisabledBy/aiDisabledAt from an earlier disable
          // can't be misread as "still disabled by X" once re-enabled.
          aiDisabledAt: FieldValue.delete(),
          aiDisabledBy: FieldValue.delete(),
        },
        { merge: true },
      );
    } else {
      await orgRef.set(
        {
          aiMasterEnabled: false,
          aiDisabledAt: FieldValue.serverTimestamp(),
          aiDisabledBy: callerUid,
          "settings.aiEnabled": false,
          // IN-01 (82-REVIEW): clear the opposite transition's audit fields.
          aiEnabledAt: FieldValue.delete(),
          aiEnabledBy: FieldValue.delete(),
        },
        { merge: true },
      );
    }
  }

  return { orgId, aiEnabled };
}

export const setOrgAiEnabled = onCall(setOrgAiEnabledHandler);

// --- setOrgBibleEnabled (R295: per-org master Bible-API gate) --------------

export interface SetOrgBibleEnabledRequest {
  orgId: string;
  enabled: boolean;
}

export interface SetOrgBibleEnabledResponse {
  orgId: string;
  enabled: boolean;
}

/**
 * The testable handler body, exported separately from the onCall wrapper
 * below -- modeled on setOrgActiveHandler's SIMPLER shape (caller gate,
 * input validation, org-existence check, same-state-aware merge write), NOT
 * setOrgAiEnabledHandler's dual-write shape: there is no church-editable
 * `settings.*` leaf for the Bible API this milestone (R295 decision -- that
 * leaf is deferred), so the DISABLE branch writes ONLY the master field plus
 * its audit siblings, never a forced-off `settings.*` dot-path key.
 *
 * Governs the Bible **API** (paid ESV/NLT proxy) only, not scripture
 * features in general -- an OFF org still does scripture manually (Phases
 * 102/103).
 */
export async function setOrgBibleEnabledHandler(
  request: CallableRequest<SetOrgBibleEnabledRequest>,
): Promise<SetOrgBibleEnabledResponse> {
  const callerUid = await assertSuperAdminCaller(request);

  const { orgId, enabled } = request.data ?? ({} as SetOrgBibleEnabledRequest);
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }
  if (typeof enabled !== "boolean") {
    throw new HttpsError("invalid-argument", "enabled (boolean) is required.");
  }

  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `No organization found for id "${orgId}".`);
  }

  const orgData = orgSnap.data() as { bibleApiEnabled?: boolean } | undefined;
  const currentBibleApiEnabled = orgData?.bibleApiEnabled ?? false;

  if (currentBibleApiEnabled !== enabled) {
    await orgRef.set(
      enabled
        ? {
            bibleApiEnabled: true,
            bibleApiEnabledAt: FieldValue.serverTimestamp(),
            bibleApiEnabledBy: callerUid,
            // Mirrors setOrgAiEnabled's IN-01 fix: clear the opposite
            // transition's audit fields so a stale bibleApiDisabledBy/At
            // from an earlier disable can't be misread as still current.
            bibleApiDisabledAt: FieldValue.delete(),
            bibleApiDisabledBy: FieldValue.delete(),
          }
        : {
            bibleApiEnabled: false,
            bibleApiDisabledAt: FieldValue.serverTimestamp(),
            bibleApiDisabledBy: callerUid,
            bibleApiEnabledAt: FieldValue.delete(),
            bibleApiEnabledBy: FieldValue.delete(),
          },
      { merge: true },
    );
  }

  return { orgId, enabled };
}

export const setOrgBibleEnabled = onCall(setOrgBibleEnabledHandler);
