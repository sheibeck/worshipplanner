---
phase: 41-sharing-correctness
verified: 2026-08-07T07:35:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 41: Sharing Correctness Verification Report

**Phase Goal:** A service's share link is created once and never changes, and it always shows the
current plan and current role overrides without anyone re-sharing.
**Verified:** 2026-08-07
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sharing a service for the first time creates exactly one persistent share-link document at `serviceShareLinks/{serviceId}` (top-level collection, not a field on `services/{docId}`) whose token never changes across repeat shares, edits, or role-override changes | ✓ VERIFIED | `src/stores/services.ts:536-599` `ensureShareLink` reads `serviceShareLinks/{serviceId}` first (steady state) and only mints/adopts when absent; `grep -c 'shareToken' src/types/service.ts` = 0 confirms no field on the service document. Stability proven by **call-count assertions**, not string equality (per the deterministic `crypto.getRandomValues` stub caution): `src/stores/__tests__/services.test.ts:891-914` asserts `mockTxSet` called exactly once and `getDocs` called exactly once across two `ensureShareLink` calls. Full `services.test.ts` run: 77/77 passing (confirmed by direct execution). |
| 2 | A previously-shared service's public view reflects the current plan and current role overrides after any service edit, without anyone re-pressing Share — the auto-refresh writes only to the share-link document and never back to `services/{docId}` | ✓ VERIFIED | `maybeRefreshShareLink` (`src/stores/services.ts:639-685`) hooked into exactly 3 write paths: `updateService:294`, `setRoleOverride:426`, `clearRoleOverride:450`. Confirmed via `grep -n 'async function'` that none of `markAsPlanned`/`reopenService`/`deleteService`/`createService` call it. **Absence assertion present** (not merely presence, per caution #2): test `T-41-02: the only services write is the user's own save — no write-back — while the two forward share writes DO happen` (`services.test.ts:1154-1178`) asserts `updateDoc` called **exactly once** (the user's own save) while independently confirming the two forward `setDoc` writes (`shareTokens` + `serviceShares`) happened, and that neither targets a `services` path. `maybeRefreshShareLink` calls `writeSharePayload` only — zero references to `ensureShareLink` in its body (confirmed by reading lines 639-685). |
| 3 | `firestore.rules`' loosened update rule for `shareTokens`/`serviceShares` ships with a passing ALLOW-case test run against the real emulator proving the new update path | ✓ VERIFIED | `firestore.rules:227-228` loosens `shareTokens`'s `allow update` from unconditional `if false` to `isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId`. **Executed directly against the running Firestore emulator during this verification** (`npx vitest run --config vitest.rules.config.ts`): 127/127 passing, including by name `ALLOW (ROADMAP criterion 3) — an editor of the owning org can refresh a shareTokens doc in place` (80ms, genuinely PASSED, verbose reporter confirmed) plus 5 DENY cases (cross-org, no-membership, orgId reassignment, unauthenticated, viewer-role) and the 14-case `serviceShareLinks` block including the load-bearing absence-tolerant ALLOW read. The stale "update stays false" assertion is gone (`grep -c 'update stays false' src/rules.test.ts` = 0). |
| 4 | Running the backfill against a service that already has several `shareTokens` documents adopts the most recent existing token rather than minting a new one | ✓ VERIFIED | `pickAdoptableToken` (`src/utils/shareTokens.ts`) org-filters then sorts by `createdAt` descending with a document-id tiebreak, with 20/20 passing pure-unit tests (`shareTokens.test.ts`) covering empty/single/ordered/reverse/tied/null-timestamp/foreign-org cases. `ensureShareLink` (`services.ts:550-566`) queries `shareTokens` with an equality-only filter (`where('serviceId','==', service.id)`, no `orderBy`/`limit` — confirmed `grep -c 'limit('` = 0, `grep -c 'orderBy('` = 1, the pre-existing `subscribe()` listener only), maps to `ShareTokenCandidate`, and calls `pickAdoptableToken`. Test `adoption picks the most recent of three pre-existing tokens and mints none (R078)` passes as part of the 77/77 `services.test.ts` run. |
| 5 | The snapshot's existing PII guard (names only, never the raw Person object) is proven intact after the rework; deploying the updated `firestore.rules` remains the owner's step, with the exact command handed off in this phase's notes | ✓ VERIFIED | `buildServiceSnapshot` (`services.ts:102+`) resolves `personId → personNames` via a `Map`, emitting no raw `Person`. Proven on **both** the create path (`the PII guard holds on the create path (T-41-03, ROADMAP criterion 5)`, services.test.ts:1038) and the refresh path (`T-41-03: the PII guard holds on the REFRESH path (ROADMAP criterion 5)`, services.test.ts:1180) against a roster fixture that deliberately carries `email`/`phone`. `.planning/PENDING-VERIFICATION.md:783-817` (Phase 41 section) carries the exact command `firebase deploy --only firestore:rules` with the load-bearing ordering constraint (rules deploy must land before/with any hosting deploy), plus the `deleteService` out-of-scope decision with a 4-point rationale. Nothing was deployed — `git diff --name-only` shows only source/test/planning files touched, no deploy commands in this phase's commit history. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firestore.rules` | `shareTokens` update loosened; new `serviceShareLinks` CRUD block | ✓ VERIFIED | Read in full; matches plan exactly, including the corrected null-`resource`-tolerant read clause (deviates intentionally — and correctly — from RESEARCH.md's originally-proposed buggy version) |
| `src/rules.test.ts` | 20 new/replaced emulator-backed tests | ✓ VERIFIED | 6 `shareTokens` cases (1 ALLOW + 5 DENY) + 14 `serviceShareLinks` cases, all present by name, all executed and PASSED against the real emulator during this verification |
| `src/utils/shareTokens.ts` | `mintShareToken`, `shareTokenCreatedAtMillis`, `pickAdoptableToken`, `ShareTokenCandidate` | ✓ VERIFIED | All 4 exports present, zero Firestore/Pinia imports, zero `orderBy` in source, 20/20 tests passing |
| `src/stores/services.ts` | `buildServiceSnapshot`, `writeSharePayload`, `ensureShareLink`, `maybeRefreshShareLink`, `createShareToken` wrapper, `shareLinkCache` | ✓ VERIFIED | All present and wired; `createShareToken` reduced to a 1-line delegating wrapper; both `onShare()` callers (`ServiceEditorView.vue:3513`, `ServiceCard.vue:213`) unchanged |
| `.planning/PENDING-VERIFICATION.md` | Owner deploy handoff + `deleteService` scope decision | ✓ VERIFIED | Phase 41 section present with exact command and ordering constraint |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `maybeRefreshShareLink` | `writeSharePayload` (never `ensureShareLink`) | direct call | ✓ WIRED | Confirmed by reading the function body (services.ts:639-685): one `writeSharePayload` call, zero `ensureShareLink` references |
| `shareTokens` update rule | `resource.data.orgId` | rules clause | ✓ WIRED | Present on every circulated `shareTokens` doc per `writeSharePayload`'s write shape |
| `serviceShareLinks` read rule | `ensureShareLink`'s first `getDoc` | null-resource tolerance | ✓ WIRED | Proven directly by the load-bearing emulator test (PASSED) reading a never-seeded doc and getting a clean not-found snapshot |
| `updateService`/`setRoleOverride`/`clearRoleOverride` | `maybeRefreshShareLink` | post-write hook | ✓ WIRED | Confirmed via grep at lines 294, 426, 450 — exactly 3 call sites, none in status-only or delete/create functions |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rules ALLOW case genuinely executes | `npx vitest run --config vitest.rules.config.ts --reporter=verbose` (run directly by verifier) | 127/127 passed; `ALLOW (ROADMAP criterion 3)` and `ALLOW, load-bearing (T-41-09)` both PASSED by name | ✓ PASS |
| App suite regression check | `npx vitest run --dir src --exclude '**/rules.test.ts' src/stores/__tests__/services.test.ts src/utils/__tests__/shareTokens.test.ts` | 97/97 passed (77 services + 20 shareTokens) | ✓ PASS |
| Type-check gate | `npm run type-check` (the `vue-tsc --build` form) | 0 errors | ✓ PASS |
| Full app suite baseline | `npx vitest run` (run directly by verifier) | 2729 passed, 13 failed across exactly 3 pre-existing files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`, `render-service/src/render.test.ts`) — matches documented baseline, no new failures | ✓ PASS |
| Debt-marker scan | grep TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER across all 6 phase-modified source files | 0 matches | ✓ PASS |
| No view/component files touched | `git diff --name-only 4466460 HEAD` | Exactly the expected file set: `firestore.rules`, `src/rules.test.ts`, `src/utils/shareTokens.ts`, `src/utils/__tests__/shareTokens.test.ts`, `src/stores/services.ts`, `src/stores/__tests__/services.test.ts`, plus `.planning/` docs | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R076 | 41-01, 41-03 | Share link created once, never changes | ✓ SATISFIED | `ensureShareLink` steady-state read + transactional create-if-absent; REQUIREMENTS.md marks Complete |
| R077 | 41-01, 41-04 | Shared service always shows current plan/overrides without re-sharing | ✓ SATISFIED | `maybeRefreshShareLink` hooked into 3 write paths; REQUIREMENTS.md marks Complete |
| R078 | 41-02, 41-03 | Already-circulated links keep working (adopt most recent) | ✓ SATISFIED | `pickAdoptableToken` + adoption query in `ensureShareLink`; REQUIREMENTS.md marks Complete |

No orphaned requirements: REQUIREMENTS.md's Phase 41 row set (R076, R077, R078) matches exactly the `requirements:` frontmatter declared across the 4 plans.

### Anti-Patterns Found

None. No debt markers, no stub returns, no empty handlers, no hardcoded-empty props found in any of the 6 phase-modified source files.

### Human Verification Required

None. All 5 ROADMAP success criteria have direct, executed test evidence (not merely code presence), including genuine ALLOW-case emulator execution performed independently by this verifier (not just re-reading SUMMARY claims).

### Gaps Summary

No gaps. All three cautions flagged for this verification were checked directly against source and confirmed non-vacuous:

1. **Token-stability caution** — the stability tests (`repeat share returns the same token...`) assert `mockTxSet`/`getDocs` call counts, not string equality. Confirmed by reading the test source (services.test.ts:891-914).
2. **Loop-safety absence caution** — the T-41-02 test asserts `updateDoc` called exactly once (the user's own save), not merely that the two forward writes happened. Confirmed by reading the test source (services.test.ts:1154-1178).
3. **Real-emulator ALLOW-case caution** — the rules suite was executed directly by this verifier against the running Firestore emulator (not re-read from a prior log), and the ALLOW cases were confirmed PASSED by name in verbose reporter output.

The `maybeRefreshShareLink → writeSharePayload` (never `ensureShareLink`) prohibition was also independently confirmed by reading the function body.

---

*Verified: 2026-08-07*
*Verifier: Claude (gsd-verifier)*
