---
phase: 76
slug: church-deactivation-reactivation
verdict: SECURED
threats_closed: 10
threats_open: 0
asvs_level: 1
audited: 2026-08-23
---

# Phase 76 — Security Verdict: SECURED

Threat-mitigation register for the org lifecycle (deactivate/reactivate) feature, covering both
76-01-PLAN.md (server + `firestore.rules`/`storage.rules`) and 76-02-PLAN.md (client login-block +
UI). T-76-10 (and its low-severity twin T-76-06) were identified in a follow-up security pass after
76-REVIEW.md's code review closed — a verified, exploitable privilege-escalation in
`firestore.rules` that let an ordinary org editor bypass the entire lifecycle-toggle mechanism via
a direct client write. Both are now CLOSED. Verified **live** against `firestore.rules` and the
passing emulator/unit test suites, not documentation.

| Threat | Category | Sev | Disposition | Evidence |
|--------|----------|-----|-------------|----------|
| T-76-01 | Elevation of Privilege — `setOrgActive` callable | critical | mitigate | `assertSuperAdminCaller` (dual claim + Firestore re-check) gates the callable; caller-gate unit tests cover unauthenticated/no-claim/no-doc. |
| T-76-02 | Elevation of Privilege — stale already-issued ID token | medium | accept | `revokeRefreshTokens(uid)` on deactivate bounds exposure to ≤1h; client login-block is the fast layer, not the enforcement boundary. |
| T-76-03 | Elevation of Privilege — `storage.rules` legacy claim arm bypass | high | mitigate | `isOrgDeactivatedForCaller` wraps the WHOLE `isOrgMemberByClaim` OR-expression; proven by a dedicated legacy-arm DENY test. |
| T-76-04 | Tampering — `patchNestedClaimKey` claim-write path | critical | mitigate | Single read-mutate-write of the full claims object, never a bare replace; unit test proves `superAdmin`/`orgs`/a sibling `deactivatedOrgs` entry all survive a deactivate/reactivate round trip. |
| T-76-05 | Tampering/DoS — `storage.rules` cross-service lookup regression | high | mitigate | Storage enforcement stays CLAIM-ONLY (`deactivatedOrgs`); never reintroduces `firestore.get()`/`exists()` into `storage.rules` (the 2026-08-06 incident class). |
| T-76-06 | Repudiation — Org lifecycle audit trail (`deactivatedBy`/`reactivatedBy` forgery) | low | **mitigate (was: accept)** | **Re-scoped and closed by this pass.** Originally accepted on the premise that these fields are "server-written provenance fields (never client-settable)" — but `firestore.rules` had no field-level enforcement of that premise until now. `organizations/{orgId}`'s new `preservesLifecycleFields()` guard (`firestore.rules:93-117`) denies any ordinary-editor write that creates or changes `deactivatedBy`/`reactivatedBy` (or the other 3 lifecycle fields), closing the actual gap the original disposition assumed was already closed. Proven by `src/rules.test.ts:418-442` (`DENIES an ordinary editor from forging deactivatedBy...` / `...deactivatedAt/reactivatedAt/reactivatedBy...`). |
| T-76-07 | Elevation of Privilege — client-side login-block (`auth.ts`) | medium | accept | Explicitly UX-only; a bypassed client is independently denied by `firestore.rules`/`storage.rules` regardless. |
| T-76-08 | Information Disclosure — membership-list/primary-org `getDoc` failure path | low | mitigate | Every `getDoc` failure collapses into the same generic id-fallback + generic deactivation copy; no raw error codes surfaced. |
| T-76-09 | Denial of Service (self-inflicted UX break) — `loadOrgContext`'s primary-org read | high | mitigate | Wrapped in try/catch; `isReady` always set; dedicated `auth.test.ts` case for a rejected `getDoc`. |
| **T-76-10** | **Elevation of Privilege — `organizations/{orgId}` unrestricted editor write** | **critical** | **mitigate** | **Closed by this pass.** `organizations/{orgId}` previously had `allow write: if isOrgEditor(orgId)` with NO field restriction — any ordinary editor (not a super-admin) could `updateDoc(organizations/{orgId}, {active:false, deactivatedAt:..., deactivatedBy:'forged'})` directly from the client, bypassing the super-admin-gated `setOrgActive` callable entirely, the `deactivatedOrgs` claim fan-out, and `revokeRefreshTokens` — violating R212 ("client never writes org status directly") and letting any editor take their whole org offline (or forge a fraudulent reactivation) while creating a Firestore-denied-but-Storage-open half-deactivated state. Fixed at `firestore.rules:75-117`: a new `preservesLifecycleFields()` guard (mirroring the `services/{docId}` block's `diff().affectedKeys()` idiom, `firestore.rules:143`) is ANDed into both `allow write` and `allow create` for `organizations/{orgId}`, denying any create/update that introduces or changes `active`, `deactivatedAt`, `deactivatedBy`, `reactivatedAt`, or `reactivatedBy`. Exempted only for a genuine super-admin (`isSuperAdmin()`, same narrow OR pattern already used by `isOrgActive`/`isOrgMember`/`isOrgEditor`) — not a new escalation surface, since a super-admin already sits above this boundary elsewhere (`appConfig`, `superAdmins`). Ordinary editors retain full write access to legitimate org fields (name, slug, `settings.*`, `pcAppId`/`pcSecret`, etc.) — no regression to the Settings page, proven by the existing "editor can write to org doc (update name)" test plus a new "ALLOWS the same editor to update a non-lifecycle field" regression test. Proven DENIED by `src/rules.test.ts:407-464` (`Org lifecycle field guard (T-76-10/T-76-06)`): an ordinary editor is denied setting `active:false`, forging `deactivatedBy`, and forging `deactivatedAt`/`reactivatedAt`/`reactivatedBy`; a viewer remains denied entirely; the editor's non-lifecycle `name` update still succeeds. |
| T-76-SC | Tampering — npm/pip/cargo installs | low | accept | No new packages installed by this pass; the fix is a `firestore.rules` change + test additions only. |

**Fix commit:** `c906fdd9` — `fix(76): T-76-10/T-76-06 restrict organizations/{orgId} writes to protect lifecycle fields`
(`firestore.rules`, `src/rules.test.ts`; `functions/package*.json` untouched; not deployed — deploy is
owner-gated and the existing deploy command already includes `firestore:rules`).

**Gates run:**
- Rules-emulator suite (`npx vitest run --config vitest.rules.config.ts`, against the running
  emulator): **201/201 passed** (179 in `src/rules.test.ts` incl. 5 new T-76-10/T-76-06 tests, 22 in
  `src/storage.rules.test.ts`).
- `cd functions && npx vitest run`: **520/520 passed** (14 files) — functions untouched by this fix,
  confirmed no regression.
- `npm run type-check` (`vue-tsc --build`): **clean**.
- `npx vitest run` (app suite, root): **4046/4068 passed** (133/135 files). The 2 failing files
  (`src/storage.rules.test.ts` — needs the dedicated `vitest.rules.config.ts` wiring, times out under
  the root config's default 5s per-test timeout even with the emulator up; `src/views/__tests__/RosterView.test.ts` —
  pre-existing stale UI assertion) are EXACTLY CLAUDE.md's documented known-failing baseline, unrelated
  to this fix.

**Accept:** T-76-02, T-76-07, T-76-SC (unchanged from 76-01/76-02-PLAN.md's original threat model —
no new information this pass). **Unregistered flags:** none. **Open threats: 0.**
