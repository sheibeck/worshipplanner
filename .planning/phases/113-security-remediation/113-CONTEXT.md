# Phase 113: Security Remediation - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Remediate the Critical/High security findings from the Phase 112 report
(`.planning/phases/112-security-review/112-SECURITY-REVIEW.md`) and triage Medium/Low to backlog.
From Phase 112: **1 Critical (SEC-S-01), 2 High (SEC-ISO-01, SEC-ISO-02), 11 Medium/Low**.

Any Firestore/Storage rules or Cloud Functions authorization change carries a REAL ALLOW-case (and,
for SEC-S-01, DENY-case) emulator test proving the fix — not only a deny-case pass. `npm run type-check`
+ the full suite must pass. Then — because SEC-S-01 is a proven LIVE production cross-tenant leak — the
`firestore.rules` fix is DEPLOYED to production, with an explicit per-deploy owner confirmation at deploy
time (owner decision 2026-09-02; consciously overrides R323's default build/commit-only-UNDEPLOYED for
this live-Critical case).

Out of scope: fixing Medium/Low (→ backlog).
</domain>

<decisions>
## Implementation Decisions

### Remediation (accepted by owner 2026-09-02)
- **SEC-S-01 (Critical) — fix:** split `allow read: if true` into `allow get: if true; allow list: if false;`
  for `shareTokens` (firestore.rules:340-341), `quarterShares` (:387-388), `serviceShares` (:404-405).
  Narrowest change that keeps the shipped `getDoc`-by-id flow while closing collection enumeration.
  - Tests (in `src/rules.test.ts`): DENY-case `assertFails(getDocs(collection(...)))` for all three
    (the regression proof), plus ALLOW-case `assertSucceeds(getDoc(doc(..., '<seeded-id>')))` for all
    three (the existing shareTokens get test at ~:1242 must keep passing; add the two siblings).
- **SEC-ISO-01 (High) — fix: REMOVE the legacy branch outright.** Remove the client-side
  `organizations/{orgId}` `allow create` (firestore.rules:125-130) and the `members/{uid}` Flow-1
  "org creation" branch (:150-159). `onboardOrganization` (Admin SDK, confirmed deployed) is the only
  sanctioned provisioning path; no client writes this shape. Update the pinning test at
  `src/rules.test.ts:268` to `assertFails`. Keep Flow-2 (invite acceptance via `inviteLookup`) intact
  and prove it still succeeds (ALLOW-case).
- **SEC-ISO-02 (High) — fix:** add `getAuth().revokeRefreshTokens(uid)` to the "clear" branch of
  `syncOrgMembershipClaimHandler` (functions/src/orgMembershipClaims.ts:245-319), mirroring
  `orgProvisioning.ts:461`. Tests: a functions-level unit test asserting `revokeRefreshTokens` is
  called with the removed uid on member-doc delete (mirror `orgProvisioning.test.ts`'s pattern). The
  Storage ALLOW-case (a remaining member still has access) needs the Storage emulator — if it is not
  reachable this session, author the test and note it as run-when-emulator-available (do NOT let the
  known storage.rules cross-service `exists()` env limitation block the phase).
- **Medium/Low triage:** ONE consolidated backlog entry (999.x) for the 11 Medium/Low security findings
  (SEC-A-01, ARCH-018, SEC-R-03, SEC-S-02, SEC-C-01, and the Lows) referencing the Phase 112 report.
  No stubs; none fixed here.

### Deploy posture (owner decision 2026-09-02 — overrides R323 default for this live Critical)
- After build+test+commit, DEPLOY the `firestore.rules` fix (SEC-S-01 + SEC-ISO-01) to production. Claude
  will ask for an explicit per-deploy confirmation immediately before running `firebase deploy` (per the
  standing deploy-policy-confirm-then-deploy). The SEC-ISO-02 functions change deploys in the same
  confirmed step (rebuild functions first; the trigger is already exported from index.ts — verify) OR is
  handed over — decide at deploy time.
- A yes here (planning) is NOT the deploy authorization; the deploy step re-confirms.

### Locked at milestone start (REQUIREMENTS.md v2.8 scope)
- Fix Critical/High; triage Medium/Low to backlog.
- Rules/functions authz change requires a real ALLOW-case emulator test (R323), not only a deny pass.
- `npm run type-check` + full suite pass; no new regressions.

### Claude's Discretion
- Exact rules-test names, the functions unit-test shape, and the consolidated backlog entry wording/number.
- Whether to attempt starting the Storage emulator for the SEC-ISO-02 ALLOW-case, or defer that one test
  with a clear note (the functions-level unit test is the primary proof for SEC-ISO-02).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / patterns
- `firestore.rules` share collections (shareTokens/quarterShares/serviceShares), the org-provisioning
  create branches, and `src/rules.test.ts` (rules suite via `vitest.rules.config.ts`; emulator on :8080).
- `revokeRefreshTokens` precedent: `functions/src/orgProvisioning.ts:461` (deactivation) and
  `functions/src/superAdminClaims.ts:126` — mirror their call pattern in `orgMembershipClaims.ts`.
- Rules-testing discipline (CLAUDE.md): run rules via `npx vitest run --config vitest.rules.config.ts`
  when an emulator is up (it is, :8080); bare `npx vitest run` EXCLUDES the rules suite. The 2
  storage.rules allow-case failures are a documented cross-service `exists()` env limitation.
- Deploy hygiene (memory functions-must-reexport-from-index): rebuild functions before deploy; a new
  function must be re-exported from functions/src/index.ts (SEC-ISO-02 edits an existing trigger — verify
  it's still exported; no new function added).

### Integration Points
- `firestore.rules` (SEC-S-01, SEC-ISO-01), `src/rules.test.ts` (rules tests),
  `functions/src/orgMembershipClaims.ts` + its test (SEC-ISO-02), `.planning/ROADMAP.md` (M/L backlog).

</code_context>

<specifics>
## Specific Ideas

- SEC-S-01 is live in prod — this is the priority fix; its DENY-case test (getDocs collection fails) is
  the regression proof, and the deploy closes the actual leak.
- SEC-ISO-01: removing the branch must NOT break invite acceptance (Flow 2) — prove Flow 2 still allows.
- SEC-ISO-02: the functions-level unit test (`revokeRefreshTokens` called with uid) is the primary,
  emulator-independent proof; the Storage ALLOW-case is secondary/deferrable.

</specifics>

<deferred>
## Deferred Ideas

- The 11 Medium/Low security findings → the consolidated 999.x backlog entry.
- SEC-ISO-02 Storage ALLOW-case test IF the Storage emulator is unreachable this session (author + note).

</deferred>
