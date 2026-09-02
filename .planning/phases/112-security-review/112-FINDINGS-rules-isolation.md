# 112-01 Findings: Firestore & Storage Security Rules + Multi-Tenant Data Isolation

**Plan:** 112-01 (dimension A: Firestore & Storage security rules; dimension B: multi-tenant data isolation)
**Reviewed:** 2026-09-02
**Reviewer:** executor agent, self-conducted (no sub-agent spawning available)
**Scope:** `firestore.rules` (450 lines), `storage.rules` (79 lines), `src/rules.test.ts`,
`src/storage.rules.test.ts`, `functions/src/orgMembershipClaims.ts`, `functions/src/orgProvisioning.ts`,
`src/stores/auth.ts` (org-creation/membership call sites). Review-only — no code, rules, or config
files were modified; nothing was deployed.

Out of scope for this file (see plan boundary): ARCH-005 and ARCH-018 (Phase 110 handoff items) are
assessed under plan 112-02 (`112-FINDINGS-auth-functions.md`), not here — this file references them
only where a rules-level observation directly overlaps. Share-token/public-page PII depth review is
plan 112-03's scope (`112-FINDINGS-share-cost.md`); public-read rules noted here are flagged briefly
with a pointer, not independently scored, to avoid duplicate/conflicting severities across files.

---

## Live rules-test evidence

**Command run (exact, as specified):**
```
npx vitest run --config vitest.rules.config.ts
```

**Scope note:** `vitest.rules.config.ts` targets `projectId: 'test-project'` against the emulator at
`127.0.0.1:8080` (Firestore) / `127.0.0.1:9199` (Storage). Production is `worship-planner-bc515` — an
entirely separate GCP project. Running this suite cannot touch prod data; confirmed by design (the
harness's `initializeTestEnvironment` never references a real project) and by the CLAUDE.md-documented
convention for this exact command.

**Pre-flight emulator check (added to ground the result — not part of the plan's literal command, but
necessary to explain the outcome below):**
```
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080   -> 200  (Firestore emulator UP)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9199   -> 000  (Storage emulator DOWN)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000   -> 000  (Emulator UI DOWN)
```
Only a standalone Firestore emulator is running (matching the plan's stated assumption "a Firestore
emulator is running on :8080" — a full `firebase emulators:start` with Storage/UI was NOT active).

**Verbatim result:**
```
✓ src/rules.test.ts (200 tests) 19469ms

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/storage.rules.test.ts [ src/storage.rules.test.ts ]
TypeError: fetch failed
 ❯ loadStorageRules node_modules/@firebase/rules-unit-testing/dist/esm/index.esm.js:409:18
 ❯ initializeTestEnvironment node_modules/@firebase/rules-unit-testing/dist/esm/index.esm.js:490:9
 ❯ src/storage.rules.test.ts:15:13
Caused by: Error: connect ECONNREFUSED 127.0.0.1:9199

 FAIL  src/storage.rules.test.ts [ src/storage.rules.test.ts ]
TypeError: Cannot read properties of undefined (reading 'cleanup')
 ❯ src/storage.rules.test.ts:38:17

 Test Files  1 failed | 1 passed (2)
      Tests  200 passed | 26 skipped (226)
```

**Interpretation — Firestore rules (`src/rules.test.ts`): 200/200 PASS, 0 failures.** This is real
allow/deny evidence exercised against the live emulator: org membership scoping (`isOrgMember`/
`isOrgEditor`), the R104 self-service-membership closure (Flow 1 org-creation / Flow 2 invite
acceptance), service draft-lock transitions (R036/R037), slideGroups lock/immutability, pptxRenders
Admin-SDK-only writes, messages/recipients Admin-SDK-only writes, lockSnapshots org scoping, the
`/{collection}/{docId}` wildcard exclusions (T-42-01), org lifecycle-field guards (T-76-10/T-76-06),
`preservesCreatedBy()` (ADR-0003), `isOrgActive`/`isSuperAdmin`/R225 super-admin arms, and cross-org
denial cases throughout, all passed with no regressions. The `Property superAdmin is undefined on
object.` lines visible in stderr are the emulator's verbose per-clause evaluation trace on denied
writes (an unset claim key evaluated in a boolean expression, not an error) — every one of those
tests still reported PASS; they are not evidence of a defect.

**Interpretation — Storage rules (`src/storage.rules.test.ts`): 0/26 executed — suite-level
connection failure, an ENVIRONMENT gap, not a rules defect.** `beforeAll` could not reach the Storage
emulator (`ECONNREFUSED 127.0.0.1:9199`, confirmed independently by the pre-flight curl check above),
so none of its 26 `it()` bodies ran; Vitest reports them as "skipped" because the suite crashed before
any test body executed. **This is a materially different failure mode than the one CLAUDE.md
documents** ("2 known cross-service `firestore.exists()` ALLOW-case failures") — and static review of
the current `storage.rules` (below) shows why: **that documented defect no longer applies to the code
as it stands.** `storage.rules`' own comments (lines 42-49) and `src/storage.rules.test.ts`'s dedicated
static-assertion test (`storage.rules — claim-only membership (Deploy 2, R075 guard)`, lines 396-441)
confirm the cross-service `firestore.exists()` fallback arm was REMOVED at Deploy 2 (2026-08-12);
membership is now proven solely by the custom auth claim (`isOrgMemberByClaim`), which is fully
emulator-verifiable with no cross-service dependency. **CLAUDE.md's "storage.rules IS A REAL DEFECT"
section is stale** relative to the current rules file — it describes a defect class that was fixed and
guarded against regression by the very test that could not run this session for the unrelated reason
of no Storage emulator being available. This review could not independently re-confirm (via live
emulator evidence) that the current claim-only `storage.rules` behaves as documented; that
confirmation is deferred to whoever next runs `firebase emulators:start` (Storage) locally, or CI. No
code was changed to attempt to start the emulator (review-only + not in this plan's scope).

**Coverage gap this leaves for this review:** every Storage-side isolation/authorization claim in this
findings file below is grounded in **static code reading only**, not live emulator evidence, because
the Storage emulator was not reachable this session. This is recorded explicitly per finding below.

**Source/rules modification check:**
```
git status --porcelain -- src functions firestore.rules storage.rules
```
Empty — confirmed no source, functions, or `*.rules` files were modified during this review.

---

## Critical/High

### SEC-ISO-01 — [High] Legacy client-side org self-provisioning path is still rule-live, bypassing the intended super-admin-gated provisioning flow

**Location:** `firestore.rules:125-130` (`organizations/{orgId}` `allow create`); `firestore.rules:150-159`
(`members/{uid}` `allow create`, Flow 1 — "org creation"). Cross-referenced against
`src/stores/auth.ts:744-808` (`ensureUserDocument`) and `src/rules.test.ts:268-287` (test:
`'ALLOWS the founder of a brand-new org to create their own first membership...'`).

**Observed behavior (static + test-suite evidence):**
- `firestore.rules` grants `allow create` on `organizations/{orgId}` to **any signed-in user**
  (`isSignedIn() && request.resource.data.createdBy == request.auth.uid`) — no super-admin check, no
  invite, no pre-existing relationship to the org required.
- The companion `members/{uid}` `allow create` "Flow 1" grants the SAME caller the right to write
  their own first membership doc with `role: 'editor'` in the same atomic batch, proven by
  `getAfter(.../organizations/$(orgId)).data.createdBy == request.auth.uid`.
- `src/rules.test.ts` (line 268, currently passing per the Task 1 live run above) explicitly
  **exercises and expects this to succeed**: `'ALLOWS the founder of a brand-new org to create their
  own first membership, via a real writeBatch matching ensureUserDocument'`.
- But `src/stores/auth.ts`'s `ensureUserDocument` — the ONLY client function the test claims to
  mirror — no longer contains this org-creation branch. Its full logic (lines 744-808) is: update the
  user profile doc, then check `inviteLookup/{email}` for a pending invite and accept it if present;
  **"No pending invite: a signed-in user is NEVER auto-provisioned an organization. Organizations are
  created only by a super-admin via the `onboardOrganization` callable"** (auth.ts:803-806, verbatim).
  A repo-wide search (`grep -rn "createdBy" src/`, `grep` for `organizations'` + `setDoc`/`addDoc`
  writes) found **zero** client code paths that write an `organizations/{orgId}` doc — the only
  writer of this shape left in the codebase is the test file that pins the rule's own (now-legacy)
  contract.
- The rules file's own comment at line 125-128 concedes this: "no legitimate client-side
  org-creation flow sets these fields; org provisioning (`orgProvisioning.ts`) always writes via the
  Admin SDK, bypassing rules" — acknowledging the SANCTIONED path bypasses this rule entirely, while
  leaving the rule itself open for anyone who calls the Firestore SDK directly (no UI required).

**Impact:** Any authenticated user — including one with zero org invites and zero legitimate business
relationship to the product — can self-provision an unlimited number of organizations directly via the
Firebase JS SDK (no UI, no server-side authorization, no super-admin approval), each time becoming that
org's founding `editor`. This directly contradicts the documented, current provisioning model
("Organizations are created only by a super-admin"). Compounding impact: `orgSlugs/{slug}` and
`orgNames/{nameKey}` are create-once (first-writer-wins) and gated only by `isOrgEditor(request.resource
.data.orgId)` (firestore.rules:368-384) — since the self-provisioned org makes the attacker an editor of
it immediately, they can also claim/squat a legitimate church's slug or display name before that church
is ever onboarded through the sanctioned flow, denying the real church that name permanently (org names/
slugs have no separate uniqueness authority beyond first-writer-wins). This is an authorization-bypass
class finding: the intended provisioning gate is a super-admin-only Cloud Function, but the data-layer
rule that would need to close the legacy path to make that gate authoritative was never tightened when
the client stopped using it.

**Required ALLOW-case emulator test for a Phase 113 fix:** the fix will TIGHTEN `organizations/{orgId}`
`allow create` (and the `members/{uid}` Flow 1 branch) to require `isSuperAdmin()` (or remove the legacy
branch outright once `onboardOrganization`'s Admin-SDK path is confirmed as the sole intended writer).
The regression proof Phase 113 must add is an **ALLOW-case** proving legitimate access is preserved
post-fix: (1) invite acceptance (Flow 2, `members/{uid}` create via `inviteLookup`) still succeeds for
an ordinary signed-in user with a real invite — unaffected by this fix since Flow 2 is untouched; (2) a
genuine super-admin performing the same self-service org-creation batch still succeeds if that path is
kept super-admin-gated rather than deleted. The existing test at `src/rules.test.ts:268` ("ALLOWS the
founder of a brand-new org...", currently an ordinary non-super-admin context) must be updated to either
`assertFails` (path removed) or reseeded with `superAdmin: true` (path narrowed) — whichever the Phase
113 plan selects — so the suite continues to pin the corrected contract rather than a stale one.

---

### SEC-ISO-02 — [High] Member removal does not revoke refresh tokens; Storage access (claim-only) can outlive Firestore-doc-based membership by up to the token's remaining lifetime

**Location:** `functions/src/orgMembershipClaims.ts:245-319` (`syncOrgMembershipClaimHandler`,
triggered by `onDocumentWritten("organizations/{orgId}/members/{uid}")`, `functions/src/orgMembershipClaims.ts:321-331`);
`storage.rules:13-49` (`isOrgMemberByClaim`, claim-only membership).

**Observed behavior (static evidence — Storage emulator unavailable this session, see Coverage gap
above):**
- Firestore-side membership (`isOrgMember`/`isOrgEditor` in `firestore.rules`) is checked via a live
  `exists()`/`get()` on `organizations/{orgId}/members/{uid}` — when an editor deletes that doc (member
  removal), Firestore access is revoked **immediately**, on the very next request; no propagation lag.
- Storage-side membership (`isOrgMemberByClaim` in `storage.rules`) is **claim-only by deliberate
  design** (Deploy 2, 2026-08-12 — see the "Live rules-test evidence" section above) — it reads
  `request.auth.token.orgId`/`.role`/`.orgs`, never the live Firestore doc. `syncOrgMembershipClaimHandler`
  DOES update/clear these claims on member-doc delete (the "clear" branch, line 276-283) — but a custom
  claim update alone does not invalidate a user's already-issued ID token or refresh token; the Admin SDK
  requires an explicit `getAuth().revokeRefreshTokens(uid)` call to force re-authentication before stale
  claims stop being honored.
- `grep -rn "revokeRefreshTokens" functions/src` shows this call exists in exactly two places:
  `functions/src/orgProvisioning.ts:461` (the `setOrgActive` org-deactivation handler, T-76-10) and
  `functions/src/superAdminClaims.ts:126` (super-admin grant/revoke). **`orgMembershipClaims.ts` — the
  file that handles ordinary per-member removal — calls it nowhere.** This is a direct, load-bearing
  asymmetry with the org-deactivation path, which the codebase's own T-76-10 fix already established as
  the correct pattern for exactly this class of problem (claim-only Storage access + a revocation event
  = call `revokeRefreshTokens`), but that pattern was never extended to individual member removal.

**Impact:** When an org editor removes a member (TeamView "Remove member," a routine and common
operational action — e.g., offboarding a volunteer or terminated staff member), that member's Firestore
access is cut off immediately, but their Storage access (PPTX imports, media attachments under
`orgs/{orgId}/**`) is governed solely by their already-issued auth claims, which remain valid and
unrevoked. The Firebase JS SDK auto-refreshes ID tokens roughly every ~55 minutes while a client session
stays open (picking up the new, cleared claims at that point) — so the exposure window is bounded, but
can be up to that full interval, during which a just-removed member can still read/write org media/PPTX
files directly via Storage. This is a real, currently-unmitigated authz weakness under a realistic and
common operational trigger (member removal), not a contrived edge case.

**Required ALLOW-case emulator test for a Phase 113 fix:** the fix is adding `getAuth().revokeRefreshTokens(uid)`
to the "clear" branch of `syncOrgMembershipClaimHandler` (mirroring `orgProvisioning.ts:461`'s pattern).
Because `revokeRefreshTokens` is an Admin SDK call with no Storage-Rules-emulator-observable side effect
by itself, the regression proof is two-part and must include an ALLOW case so the fix is proven not to
over-revoke: (1) an **ALLOW-case** Storage-rules test (in `src/storage.rules.test.ts`, once the Storage
emulator is reachable) proving a REMAINING member of the same org, with an unrelated member's doc having
just been deleted, still has unaffected read/write access (i.e., the revoke targets only the removed
uid, not the whole org) — this is the test that must be ALLOW, not deny, to prove no over-broad
blast radius; (2) a functions-level unit test (mirroring `orgProvisioning.test.ts`'s existing
`revokeRefreshTokens`-assertion pattern, e.g. `expect(revokeRefreshTokens).toHaveBeenCalledWith(uid)`)
proving the "clear" branch now calls it on removal.

---

## Medium/Low

### SEC-R-03 — [Medium] `services/{docId}` ordinary-draft-edit update branch does not restrict which fields may change, permitting `createdBy` (and other) provenance-field forgery

**Location:** `firestore.rules:197-201` (`services/{docId}` `allow update`, branch 1: `storedStatus() ==
'draft'`).

**Observed behavior:** Unlike `organizations/{orgId}`'s `allow update` (`firestore.rules:124`, guarded
by `preservesCreatedBy()` per ADR-0003, and `preservesLifecycleFields()`), the `services/{docId}`
"ordinary editing while draft" branch has no field-diff restriction at all — any key, including
`createdBy`, `orgId`-adjacent metadata, or any other stored field, can be rewritten by any org editor
while the document's stored status is `draft`. `slideGroups`, `messages`, and `lockSnapshots` documents
have the same characteristic (no `createdBy` guard anywhere in their update/create rules).

**Impact:** An org editor can forge the `createdBy`/authorship attribution on a service document (or
similarly-unguarded nested docs) while it is in draft. No downstream authorization logic in the
reviewed rules keys off `services.createdBy` (delete is `isOrgEditor(orgId)`-only, independent of
authorship), so this is a provenance/audit-trail integrity gap within a single org, not a cross-tenant
or privilege-escalation issue — defense-in-depth, Medium per the rubric ("a bug needing specific
conditions").

**Not required to carry an ALLOW-case test note** (Medium/Low tier — per plan scope, only Critical/High
rules findings require this).

---

### SEC-ISO-04 — [Low, already tracked] Super-admin `isOrgEditor` universal grant permits self-write of a membership doc for any org (IN-02 / ARCH-018)

**Location:** `firestore.rules:28-43` (`isOrgEditor`), `firestore.rules:141-143` (`members/{uid}`
`allow write: if isOrgEditor(orgId)`). Documented in `.planning/codebase/ARCHITECTURE.md` §
"Backend Behavioral Notes (R318) § firestore.rules" ("IN-02, 78-REVIEW.md / T-78-03 accepted residual")
and already flagged as `ARCH-018` in `110-ARCHITECTURE-REVIEW.md` for re-evaluation under a security
lens.

**Note (not independently scored here):** this is the SAME underlying rule condition as ARCH-018, which
the Phase 112 CONTEXT explicitly assigns to plan 112-02 (`112-FINDINGS-auth-functions.md`) for its own
security-lens severity call ("re-evaluate ARCH-018... not merely echoed as an accepted architectural
note"). Recorded here only so the rules-review pass does not silently omit it — do not double-count or
assign a conflicting severity in the consolidated report; 112-02's assessment is authoritative for
ARCH-018/IN-02.

---

### SEC-ISO-05 — [Low] Org member role `'admin'` is functionally identical to `'editor'` in every rule and client check found

**Location:** `firestore.rules:28-43` (`isOrgEditor` — `role in ['editor', 'admin']`, no rule
distinguishes the two); `src/stores/auth.ts:585,592,595` (`role === 'admin'` is normalized down to
`'editor'` client-side in all three sites found).

**Observed behavior:** A member with `role: 'editor'` can, via `firestore.rules:141-143`'s
`allow write: if isOrgEditor(orgId)` on the `members/{uid}` subcollection, write ANY member doc in the
org including their own — e.g. set `role: 'admin'` on themselves. A quick repo-wide check
(`grep -rn "role === 'admin'"`) found no capability in the reviewed source that treats `'admin'`
differently from `'editor'` — the client normalizes `'admin'` back down to `'editor'` on read
(`auth.ts:585,592,595`). Net effect: this "escalation" grants no additional privilege anywhere
currently checked in this review.

**Impact:** Low/informational as reviewed here. Flagging because a FUTURE feature that DOES gate on
`role === 'admin'` specifically (e.g. a billing action, a Cloud Function authorization check) would
silently inherit this self-escalation path with no additional rules change required — worth a pointer
into plan 112-02's Cloud-Functions-authorization dimension, which is better positioned to confirm no
callable currently checks for `'admin'` specifically.

---

### SEC-ISO-06 — [Low, informational — deferred to 112-03] Public-read (`allow read: if true`) collections cross multi-tenant boundaries by design

**Location:** `firestore.rules:341` (`shareTokens/{token}`), `firestore.rules:369` (`orgSlugs/{slug}`),
`firestore.rules:381` (`orgNames/{nameKey}`), `firestore.rules:388` (`quarterShares/{shareId}`),
`firestore.rules:405` (`serviceShares/{shareId}`).

**Observed behavior:** These five collections grant unauthenticated public read with no per-caller org
scoping — by design (share links, slug/name uniqueness registries). Each is a deliberate exception to
the org-isolation posture enforced everywhere else in the file, already documented inline (e.g.
`firestore.rules:338-339`: "Share tokens: public read (anyone with token URL)...").

**Impact:** Not independently scored here — this is squarely plan 112-03's assigned dimension
("share-token/public-page exposure and PII handling"). Recorded so this rules-focused pass does not
silently omit the existence of these grants from the file that reviews the rules text; 112-03 owns the
depth-of-exposure assessment (what fields each doc carries, whether guessability/enumeration matters,
PII content).

---

## Artifacts this phase produces

This file (`112-FINDINGS-rules-isolation.md`) is one of three disjoint per-dimension findings files for
Phase 112 (alongside `112-FINDINGS-auth-functions.md` from plan 112-02 and `112-FINDINGS-share-cost.md`
from plan 112-03). Plan 112-04 consolidates all three into the single ranked
`.planning/phases/112-security-review/112-SECURITY-REVIEW.md`, which Phase 113 reads to scope its
Critical/High remediation (Medium/Low findings route to backlog per the CONTEXT-locked severity
rubric).

## Summary

| ID | Severity | Dimension | Location |
|----|----------|-----------|----------|
| SEC-ISO-01 | High | Rules + Isolation | firestore.rules:125-130, 150-159 |
| SEC-ISO-02 | High | Isolation (Storage claim lag) | functions/src/orgMembershipClaims.ts:245-319; storage.rules:13-49 |
| SEC-R-03 | Medium | Rules (provenance) | firestore.rules:197-201 |
| SEC-ISO-04 | Low (tracked elsewhere) | Isolation | firestore.rules:28-43, 141-143 (= ARCH-018/IN-02, owned by 112-02) |
| SEC-ISO-05 | Low | Isolation (role semantics) | firestore.rules:28-43; src/stores/auth.ts:585,592,595 |
| SEC-ISO-06 | Low (informational) | Isolation (deferred to 112-03) | firestore.rules:341,369,381,388,405 |

No source, functions, or `*.rules` files were modified during this review (`git status --porcelain --
src functions firestore.rules storage.rules` is empty, verified above). No deploy occurred.
