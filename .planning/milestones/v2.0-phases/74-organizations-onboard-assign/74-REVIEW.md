---
phase: 74-organizations-onboard-assign
reviewed: 2026-08-21T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - functions/src/orgProvisioning.ts
  - functions/src/orgProvisioning.test.ts
  - functions/src/orgTemplateSeed.ts
  - functions/src/orgTemplateSeed.test.ts
  - functions/src/index.ts
  - src/components/admin/OrganizationsTab.vue
  - src/components/admin/__tests__/OrganizationsTab.test.ts
  - src/views/__tests__/OwnerConsoleView.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 74: Code Review Report

**Reviewed:** 2026-08-21
**Depth:** deep (cross-file: compared server ports against `src/utils/slotTypes.ts`, `src/types/organization.ts`, `src/utils/orgName.ts`, `src/utils/slug.ts`, `src/stores/auth.ts`, `src/views/TeamView.vue`, and `functions/src/superAdminClaims.ts`)
**Files Reviewed:** 8
**Status:** issues_found (no Critical findings)

## Summary

Reviewed the three org-provisioning callables (`onboardOrganization`, `assignOrgAdmin`, `listOrganizations`), the ported template/settings seed, the `index.ts` export wiring, and the `OrganizationsTab.vue` UI + both test files.

The security-relevant claims in the review brief all check out under direct inspection and cross-reference against the established precedent (`setSuperAdminClaimHandler`, `parsePptxHandler`):

- **Caller gate**: `assertSuperAdminCaller` rejects `!request.auth` → `unauthenticated`, then `request.auth.token.superAdmin !== true` → `permission-denied`, then independently re-reads `superAdmins/{callerUid}` and rejects on non-existence → `permission-denied`. All three callables call it as their first line. Matches `setSuperAdminClaimHandler`'s pattern exactly (superAdminClaims.ts:106-128).
- **R202 atomicity**: `resolveAdminTarget` (the only Auth network call) runs before `db.runTransaction`; the transaction's only read is `tx.get(nameRef)`, and it is issued before any `tx.set`. If the name exists, it throws before any write. All four logical writes (orgNames claim, org doc + settings, member/invite doc, `users/{uid}.orgIds` merge) are enqueued inside that single transaction — no post-commit step. Firestore's transaction retry-on-conflict semantics correctly serialize two concurrent onboards of the same name (second retry re-reads `nameRef`, now sees it exists, throws `already-exists`). Verified against `orgProvisioning.test.ts`'s explicit "single atomic commit" and "no-strand" tests.
- **R206 additive**: `writeAdminAssignment` is the single shared helper (an `AdminWriter` structural interface satisfied by both `Transaction` and `WriteBatch`), and always uses `FieldValue.arrayUnion(orgId)` via a merge-`set` for `users/{uid}.orgIds` — never `.update()`, never a literal-array overwrite. Both callables route through it with no divergent copy.
- **R205 no-account discrimination**: `resolveAdminTarget` only takes the invite branch on `err.code === 'auth/user-not-found'`; every other code is logged and rethrown, unlike the blanket catch in `setSuperAdminClaimHandler` (superAdminClaims.ts:151-154) which this module deliberately does NOT mirror for this path. Confirmed by `orgProvisioning.test.ts`'s `auth/internal-error` tests on both callables.
- **orgNames uniqueness**: `normalizeOrgName`/`deriveSlug` are byte-for-byte identical to `src/utils/orgName.ts`/`src/utils/slug.ts`, and the `{orgId}` doc shape matches the client's own `claimOrgName` convention — no format divergence between admin-provisioned and self-onboarded orgs.
- **listOrganizations**: returns only `{orgId, name, createdAt, memberCount}` — no `settings`, `createdBy`, or member emails leak. Member counts use the `members` subcollection's `count()` aggregate (one lightweight query per org), not a full member-doc scan.
- **UI**: `OrganizationsTab.vue` imports no Firestore write helpers, only `httpsCallable`; assign feedback/error are keyed per `orgId` and verified test-scoped ("scopes feedback/error per-row" test); `friendlyCallableError` correctly maps `already-exists` → "That church name is taken."; no unescaped user input is injected (Vue text interpolation only).
- **Template/settings port**: `buildSuggestedTemplateEntries`'s 9-entry `{kind, section}` sequence and `buildDefaultOrgSettings`'s literal were traced field-by-field against `src/utils/slotTypes.ts::buildSlots('1-2-2-3')`/`defaultSectionForPosition` and `src/types/organization.ts::DEFAULT_ORG_SETTINGS` — both match exactly.

Three Warning-level correctness/robustness gaps were found (none security-critical, none data-loss-at-scale) — see below.

## Warnings

### WR-01: `writeAdminAssignment` overwrites an existing member doc with no prior read, silently resetting `joinedAt`

**File:** `functions/src/orgProvisioning.ts:158-168`
**Issue:** When `target.kind === 'existing'`, `writeAdminAssignment` does a plain `writer.set(memberRef, {...})` (no `{merge: true}`, no prior read). This is correct and matches existing convention (`src/stores/auth.ts:418`, `TeamView.vue`) when the member doc is genuinely new. But `assignOrgAdmin` never checks whether the target email is *already* a member of `orgId` (e.g., previously invited as a `viewer`) before calling it. In that case the full doc — including the real historical `joinedAt` — is silently overwritten with `{role: "editor", joinedAt: serverTimestamp(), ...}`, losing the original join date with no read-then-merge guard. There is no security impact (role promotion to `editor` is the intended effect), but the timestamp reset is a real, provable data-loss defect for any org where the assigned admin was already a member.
**Fix:** Read the existing member doc (or pass a pre-fetched snapshot into `writeAdminAssignment`) and merge rather than overwrite when it already exists, e.g.:
```ts
const memberSnap = await memberRef.get();
writer.set(
  memberRef,
  {
    role: "editor",
    displayName: target.displayName,
    email: target.email,
    ...(memberSnap.exists ? {} : { joinedAt: FieldValue.serverTimestamp() }),
  },
  { merge: true },
);
```

### WR-02: No server-side email-format validation before using the email as a Firestore document ID

**File:** `functions/src/orgProvisioning.ts:98-115` (`resolveAdminTarget`), `171-178` (`writeAdminAssignment` invite branch), `215-221`/`294-296` (request validation)
**Issue:** `onboardOrganizationHandler`/`assignOrgAdminHandler` only check `adminEmail`/`email` for non-empty strings — there is no format validation before the value is lower-cased and used verbatim as the document ID for `organizations/{orgId}/invites/{email}` and `inviteLookup/{email}`. A value containing `/` (a plausible typo, e.g. `foo/bar@example.com`) produces an even-total-segment Firestore path once appended to the collection ref, which the Admin SDK will reject synchronously inside the transaction/batch — surfacing as an opaque `internal` error to the caller instead of a clear "invalid email" message. This mirrors an existing weak-validation pattern already present in `TeamView.vue`'s `isValidEmailFormat` (client-only, `'@' + '.'`), but this phase's server-side callables add zero validation of their own, unlike `setSuperAdminClaimHandler` which at least surfaces a friendly `not-found` on a bad `getUserByEmail` call. Only super-admins can reach this path (self-inflicted, not attacker-exploitable), so this is a robustness/UX issue, not a security hole.
**Fix:** Add a basic format guard before calling `resolveAdminTarget`, e.g. reject any email containing `/` or failing a minimal `^\S+@\S+\.\S+$` check with `invalid-argument`, mirroring the ceiling-clamp/allow-list "reject, don't silently trust" posture already used elsewhere in `functions/src/index.ts` (`enforceModelAndTokens`).

### WR-03: Onboard/assign forms lack a re-entrancy guard against Enter-key double-submit

**File:** `src/components/admin/OrganizationsTab.vue:18` (`@keydown.enter="onOnboard"`), `236-269` (`onOnboard`), `66` (`@keydown.enter="onConfirmAssign(org)"`), `285-313` (`onConfirmAssign`)
**Issue:** Both submit buttons are correctly `:disabled` while `isOnboarding`/`isAssigning` is true, but the email `<input>`'s `@keydown.enter` handler calls `onOnboard`/`onConfirmAssign` directly and is not gated by that same flag. Neither handler function itself checks `isOnboarding.value`/`isAssigning.value` before proceeding past validation. Rapidly pressing Enter in the email field while a request is in flight fires a second concurrent `httpsCallable` invocation. The server-side transaction correctly prevents a duplicate org (the second call gets `already-exists`), but the user sees a spurious "That church name is taken." error for their own just-submitted org — a confusing false-negative UX bug, and for `assignOrgAdmin` a redundant (though idempotent-ish, additive) second write.
**Fix:** Add an early return at the top of both handlers:
```ts
async function onOnboard() {
  if (isOnboarding.value) return
  onboardError.value = null
  // ...
}
async function onConfirmAssign(org: OrgSummary) {
  if (isAssigning.value) return
  const orgId = org.orgId
  // ...
}
```

## Info

### IN-01: `assignFeedback` is not cleared at the start of a retry, unlike `assignError`

**File:** `src/components/admin/OrganizationsTab.vue:285-289`
**Issue:** `onConfirmAssign` clears `assignError.value[orgId]` at entry but not `assignFeedback.value[orgId]`. If a super-admin successfully assigns an admin, then (without closing the row) triggers a second assign attempt in the same open session that fails, both the stale success message ("Added as admin.") and the new error render simultaneously in that row. Low-likelihood sequence (re-assigning immediately after success), but the asymmetry is easy to fix.
**Fix:** `delete assignFeedback.value[orgId]` alongside the existing `delete assignError.value[orgId]` at the top of `onConfirmAssign`.

### IN-02: Successful inline assign does not close the row control

**File:** `src/components/admin/OrganizationsTab.vue:296-306`
**Issue:** Unlike the onboard form (which clears its inputs and auto-hides its success message after 2s), a successful `assignOrgAdmin` call leaves `assigningOrgId` set — the inline email input, Assign/Cancel buttons, and the success message all remain visible indefinitely until the admin manually clicks "Cancel assign" or re-opens another row. Inconsistent with the onboard form's self-resetting pattern; not a functional defect.
**Fix:** Consider calling `cancelAssign()` (or a timed reset) after a successful assign, or explicitly document this as the intended "leave open for review" behavior.

---

_Reviewed: 2026-08-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
