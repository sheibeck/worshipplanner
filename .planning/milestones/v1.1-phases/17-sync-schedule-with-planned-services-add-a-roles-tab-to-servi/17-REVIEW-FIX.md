---
phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi
fixed_at: 2026-07-23T13:26:52Z
review_path: .planning/phases/17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi/17-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-07-23T13:26:52Z
**Source review:** .planning/phases/17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi/17-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 3 (CR-01, WR-01, WR-02) — REVIEW.md frontmatter
  claims `warning: 3` but the document body only contains two Warning findings (WR-01, WR-02);
  no WR-03 heading exists anywhere in 17-REVIEW.md. See "Data Discrepancy" note below.
- Already resolved (no change needed): 1 (CR-01)
- Fixed: 2 (WR-01, WR-02)
- Skipped: 0 fixable findings skipped — 1 finding (WR-03) does not exist in the source document
  and could not be parsed or fixed.

## Already Resolved

### CR-01: Viewer-generated share links silently drop "Who's Serving"

**File:** `src/views/ServiceEditorView.vue:914-928`
**Status:** no_change_needed — already fixed prior to this run.

Verified the Share button already has `v-if="authStore.isEditor"` (commit `5441629`,
`fix(17): gate Share button to editors (CR-01)`), matching the Delete button precedent
described in the review's recommended fix (option a). No further action taken.

## Fixed Issues

### WR-01: Roles tab silently stays empty for a real editor who lands directly on `/services/:id` before `authStore.isEditor` resolves

**Files modified:** `src/views/ServiceEditorView.vue`
**Commit:** `1033094`
**Applied fix:** Added `watch(() => authStore.isEditor, (isEditor) => { if (isEditor) initStores() })`
immediately after the `initStores()` definition. `initStores()`'s existing `if (!rosterStore.orgId)` /
`if (!quartersStore.orgId)` guards make repeat calls idempotent, so this re-runs the roster/quarters
subscription once `authStore.isEditor` flips from `false` to `true` post-mount, instead of relying
solely on the one-time check in `onMounted`. Matches the review's recommended fix exactly.

**Note on recovery:** This fix (and WR-02 below) had already been applied and committed by a prior
run of this same fixer that was interrupted before its cleanup tail completed (orphan worktree +
branch found via the recovery sentinel at the start of this session). The commit was verified clean
(working tree had no uncommitted changes) and its diff was inspected and confirmed correct before
completing the interrupted run's fast-forward/cleanup. No re-fix was applied — only verification.

### WR-02: Lost-update race in the Roles tab override checkbox handler

**Files modified:** `src/views/ServiceEditorView.vue`
**Commit:** `fa156ea`
**Applied fix:** `onToggleOverridePerson` now optimistically mutates
`localService.value.roleAssignmentOverrides[assignment.roleId]` synchronously (before awaiting
`serviceStore.setRoleOverride`), so a same-tick second toggle for a different person on the same
role reads the just-applied local state instead of a stale `effectivePersonIds` baseline. On write
failure, the optimistic update is rolled back to its previous value (or deleted if there was none)
and the error is logged. Matches the review's recommended fix (optimistic local update).

**Additional work — regression test coverage:** Neither prior commit included new tests exercising
the fixed behavior specifically (existing `ServiceEditorView.test.ts` tests all set `isEditor`
before mount and never toggle two different people for the same role). Per the fix-agent
instructions ("Add/adjust tests where a fix changes behavior"), this run added two regression
tests to `src/views/__tests__/ServiceEditorView.test.ts` (commit `d59e3de`, made in the same
isolated worktree, on top of the already-existing WR-01/WR-02 fix commits):

- `editor: roster/quarters are subscribed once authStore.isEditor flips true after mount (WR-01)`
- `editor: rapid toggles of two different people for the same role do not clobber each other (WR-02)`

This required converting the test file's `authStore` mock from a plain per-test `let mockIsEditor`
value to a Vue `reactive()` object (`mockAuthState`), since Vue's `watch()` cannot observe a
plain-object property mutation — the mock needed to mirror the real Pinia store's reactivity for
the WR-01 test to be meaningful. Both new tests were verified to **fail** against the pre-fix code
(temporarily reverted locally, not committed) and **pass** against the fixed code, confirming they
are valid regression coverage and not false positives. A third roster fixture (`Carol`, `role-vox`)
was added to give the WR-02 test two role-vox-eligible candidates to toggle.

**Verification:**
- `npx vue-tsc --build`: clean, no errors.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/views/__tests__/ShareView.test.ts`:
  18/18 passed.
- Full suite (`npx vitest run`): 777/778 passed; the 1 failure is the pre-existing, out-of-scope
  `RosterView.test.ts` ("Roles config" `CollapsibleSection` assertion) explicitly excluded from
  this task's scope. Not touched.

## Data Discrepancy — WR-03 does not exist in 17-REVIEW.md

The task instructions referenced a **WR-03** finding with "apply the recommended fix from
REVIEW.md," and the REVIEW.md YAML frontmatter declares `warning: 3` / `total: 8`. However, the
document body (`.planning/phases/17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi/17-REVIEW.md`)
contains only `WR-01` and `WR-02` under `## Warnings` — no `### WR-03` heading appears anywhere in
the file (confirmed via full-file read and a targeted search for `WR-03`). The body's actual
finding count is 1 Critical + 2 Warning + 4 Info = 7, one short of the frontmatter's declared
total of 8.

No fix was attempted for a nonexistent finding. This is flagged here rather than silently
ignored so a human can reconcile the review artifact (either the frontmatter count is stale, or a
Warning finding was dropped when 17-REVIEW.md was last written/edited).

## Skipped Issues

None of the parseable findings were skipped — CR-01 required no change (already fixed), and both
WR-01 and WR-02 were successfully applied/verified. The only "skip" is the WR-03 finding that does
not exist in the source document (see Data Discrepancy above), which cannot be fixed because there
is nothing to parse.

---

_Fixed: 2026-07-23T13:26:52Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
