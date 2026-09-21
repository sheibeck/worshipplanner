---
phase: 138-field-fixes-church-picker-deep-link-service-update-email-lin
plan: 01
subsystem: auth
tags: [pinia, localStorage, sessionStorage, multi-tenant, vitest]

requires: []
provides:
  - "Two-tier remembered-org storage in src/stores/auth.ts (sessionStorage primary + uid-scoped localStorage fallback)"
  - "New-tab / deep-link restore of the active org for multi-church members (R428)"
affects: [138-02]

tech-stack:
  added: []
  patterns:
    - "Two-tier browser storage fallback: primary tier wins when present, secondary tier consulted only when primary is empty, both written/cleared together, each access independently try/catch-guarded"

key-files:
  created: []
  modified:
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts

key-decisions:
  - "New localStorage key SELECTED_ORG_LOCAL_KEY = 'wp.selectedOrg.persist', same uid-scoped {uid, orgId} JSON shape as the existing sessionStorage key"
  - "clearRememberedOrg() folds the second removeItem into its own body (it IS the logout call site) rather than adding a second call at the logout site, keeping both tiers structurally impossible to desync"
  - "No storage-event listener added — new tab reads the persisted org on load only, preserving the deliberate no-cross-tab-live-sync design"

patterns-established:
  - "Two-tier browser storage fallback (Pattern 1 from 138-RESEARCH.md) — reusable for any future 'per-tab isolation by default, recoverable in a genuinely new tab' state"

requirements-completed: [R428]

coverage:
  - id: D1
    description: "A genuinely-new tab (empty sessionStorage, populated uid-scoped localStorage) restores the active org from the localStorage fallback instead of bouncing to the church picker"
    requirement: "R428"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#restores the active org from the localStorage fallback in a new tab"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signing out clears BOTH the sessionStorage and localStorage remembered-org tiers, so a different user on a shared computer sees no leftover church"
    requirement: "R428"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#clears both the sessionStorage and localStorage remembered-org tiers"
        status: pass
    human_judgment: false
  - id: D3
    description: "A persisted org id no longer in the user's memberships is not honored — loadOrgContext's ids.includes(remembered) guard still gates the localStorage-sourced value"
    requirement: "R428"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#does not honor a stale persisted org from localStorage the user is not a member of"
        status: pass
    human_judgment: false
  - id: D4
    description: "A single-church user is unaffected — still resolves via the ids.length === 1 fallback regardless of storage state (regression check)"
    requirement: "R428"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#a single-org user goes straight in (no selection required)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real-browser new-tab restore (right-click a nav link -> open in new tab as a multi-church member -> lands on the intended page, not the picker) — jsdom cannot model a genuinely-new tab's empty sessionStorage vs. shared localStorage"
    verification: []
    human_judgment: true
    rationale: "Per 138-VALIDATION.md's Manual-Only Verifications table, this is deferred to batched UAT — automated unit coverage proves the storage-helper logic but not the real multi-tab browser behavior."

duration: 25min
completed: 2026-09-09
status: complete
---

# Phase 138 Plan 01: Two-Tier Remembered-Org Storage Summary

**Uid-scoped localStorage fallback tier added to auth.ts's remembered-org helpers so a genuinely-new browser tab restores a multi-church member's active org instead of bouncing to /select-church (R428).**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-09T17:21:00Z
- **Completed:** 2026-09-09T17:46:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `readRememberedOrg`/`rememberOrg`/`clearRememberedOrg` in `src/stores/auth.ts` now read/write/clear a second, uid-scoped `localStorage` tier (`wp.selectedOrg.persist`) in addition to the existing `sessionStorage` tier (`wp.selectedOrg`)
- `readRememberedOrg` tries sessionStorage first, falls through to localStorage only when sessionStorage yields nothing, and applies the identical `parsed.uid === uid && typeof parsed.orgId === 'string'` validation on both branches
- `clearRememberedOrg()` — the single logout call site — now clears both tiers in one function body, each access independently try/catch-guarded so a privacy-mode failure in one tier never skips the other
- Three new unit tests added (new-tab restore, sign-out clears both tiers, stale-non-member org not honored) plus `localStorage.clear()` added to the top-level `beforeEach`
- `loadOrgContext`'s `ids.includes(remembered)` stale-membership guard, `needsOrgSelection`, `requiresOrgSelection`, and `src/router/index.ts` are all byte-for-byte unchanged (confirmed via `git diff`)

## Task Commits

TDD task, two commits (RED -> GREEN):

1. **Task 1 (RED): add failing tests for two-tier remembered-org storage** - `e7ad44c5` (test)
2. **Task 1 (GREEN): add localStorage fallback tier for remembered org (R428)** - `a0fb0029` (feat)

**Plan metadata:** pending (docs: complete plan commit, made after this SUMMARY)

## Files Created/Modified
- `src/stores/auth.ts` - Added `SELECTED_ORG_LOCAL_KEY` constant and extended the three private helpers (`readRememberedOrg`, `rememberOrg`, `clearRememberedOrg`) with a localStorage fallback tier
- `src/stores/__tests__/auth.test.ts` - Added `localStorage.clear()` to `beforeEach`; added 3 new tests (new-tab restore, sign-out clears both tiers, stale-non-member not honored) to the `multi-org selection` and `logout` describe blocks

## Decisions Made
- Localstorage key name/shape: `SELECTED_ORG_LOCAL_KEY = 'wp.selectedOrg.persist'`, mirroring the existing `SELECTED_ORG_STORAGE_KEY`'s uid-scoped `{uid, orgId}` JSON shape (per CONTEXT.md's "Claude's Discretion")
- Folded the localStorage `removeItem` into `clearRememberedOrg()`'s existing body rather than adding a second call at the logout site, per RESEARCH.md Pattern 1's recommendation — keeps the two tiers structurally impossible to desync
- No `storage`-event listener added — preserves the locked "no cross-tab live sync" decision

## Deviations from Plan

None - plan executed exactly as written. The TDD gate sequence (RED test commit -> GREEN implementation commit) was followed per the plan's `tdd="true"` frontmatter.

## TDD Gate Compliance

- RED gate: `e7ad44c5` — `test(138-01): add failing tests for two-tier remembered-org storage` (2 of 3 new tests failed as expected pre-implementation; the third, "stale non-member", already passed because it asserts the pre-existing correct behavior — no code path yet wrote to `wp.selectedOrg.persist`, so `readRememberedOrg` correctly returned `null`)
- GREEN gate: `a0fb0029` — `feat(138-01): add localStorage fallback tier for remembered org (R428)` (all 125 tests in `auth.test.ts` pass)
- REFACTOR gate: not needed — implementation was clean on first pass, no refactor commit

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Results

- `npx vitest run src/stores/__tests__/auth.test.ts` — 125/125 pass
- `npm run type-check` (`vue-tsc --build`) — clean, no errors
- `npx vitest run` (bare, full suite) — 225/226 files pass, 5704/5738 tests pass; the only failing file is `src/storage.rules.test.ts` (34 tests), which is the documented pre-existing environment-limitation baseline per CLAUDE.md (Storage emulator's `firestore.exists()` is inert cross-service) — **not a regression from this plan's changes**
- Manual browser new-tab/deep-link verification deferred to batched UAT per 138-VALIDATION.md (jsdom cannot model a genuinely-new tab's storage isolation)

## Next Phase Readiness
- R428 (church-picker deep-link) is complete and unit-tested; ready for the batched manual UAT step (right-click a nav link -> open in new tab as a multi-church member)
- Plan 138-02 (R434 service-update email link fix) is independent of this plan and can proceed without waiting on UAT for this one

---
*Phase: 138-field-fixes-church-picker-deep-link-service-update-email-lin*
*Completed: 2026-09-09*

## Self-Check: PASSED

- FOUND: src/stores/auth.ts
- FOUND: src/stores/__tests__/auth.test.ts
- FOUND: e7ad44c5
- FOUND: a0fb0029
