---
phase: 77-church-deletion-cascade-cleanup
plan: 02
subsystem: ui
tags: [vue, vitest, admin-console, dialog, confirm-to-delete]

# Dependency graph
requires:
  - phase: 77-church-deletion-cascade-cleanup (Plan 01)
    provides: "deleteOrganization({orgId, confirmName}) super-admin-gated callable + firestore.rules unconditional client-delete DENY"
  - phase: 76-church-deactivation-reactivation
    provides: "organizations/{orgId}.active field; the Deactivate/Reactivate control convention this Delete control mirrors"
  - phase: 71-media-cleanup-lifecycle (CleanupEnableConfirmDialog.vue)
    provides: "Teleport/focus-trap dialog shell (backdrop+panel Transition, hand-rolled Tab/Shift+Tab trap, focus-on-open/close)"
provides:
  - "DeleteOrgConfirmDialog.vue — a genuinely new type-to-confirm (exact, case-sensitive, trim-only) destructive dialog component"
  - "OrganizationsTab.vue Delete control, gated on org.active === false, wired to deleteOrganization"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type-to-confirm destructive gate: structurally :disabled button (typedName.trim() !== orgName, no lowercasing) rather than a visual-only warning"
    - "Page-level (not per-row) success banner for an action that removes the row it would otherwise attach feedback to"

key-files:
  created:
    - src/components/admin/DeleteOrgConfirmDialog.vue
    - src/components/admin/__tests__/DeleteOrgConfirmDialog.test.ts
  modified:
    - src/components/admin/OrganizationsTab.vue
    - src/components/admin/__tests__/OrganizationsTab.test.ts

key-decisions:
  - "Copied CleanupEnableConfirmDialog's Teleport/focus-trap shell verbatim but deliberately did NOT copy its isBlocked/hard-block dual-button pattern -- that existed for R190's structural never-deletable fail-safe, which doesn't apply here since typing the correct name is something the user CAN do"
  - "Delete button destructive-red unconditionally (no wouldDeleteCount>0-style conditional) -- every delete here is destructive by definition"
  - "friendlyCallableError extended with failed-precondition and invalid-argument branches rather than a new helper, keeping one error-mapping surface for the whole component"

requirements-completed: [R216, R220, R221]

coverage:
  - id: D1
    description: "DeleteOrgConfirmDialog: Delete button structurally disabled until the typed value exactly (case-sensitive, trim-only) matches orgName; enables on exact match"
    requirement: R220
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/DeleteOrgConfirmDialog.test.ts#disables the Delete button while the text input is empty / keeps the Delete button disabled when the typed value does not exactly match orgName / enables the Delete button when the typed value exactly matches orgName (trimmed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "DeleteOrgConfirmDialog echoes org name + member/pending counts, labels the action irreversible, emits confirm(typedName)/cancel, and guards every dismissal path (Cancel/backdrop/Escape) while confirming"
    requirement: R220
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/DeleteOrgConfirmDialog.test.ts (15 tests, full file)"
        status: pass
    human_judgment: false
  - id: D3
    description: "OrganizationsTab Delete control enabled ONLY for org.active === false (disabled for an active org row)"
    requirement: R220
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- delete (R220/R221) > disables the Delete button for an active org row and enables it for a deactivated row"
        status: pass
    human_judgment: false
  - id: D4
    description: "Confirming calls deleteOrganization with {orgId, confirmName: typedName}; on success the dialog closes, a summary banner appears, and the list refetches (row disappears)"
    requirement: R221
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- delete (R220/R221) > confirming with the correct typed name calls deleteOrganization, closes the dialog, shows a success banner, and refetches the list"
        status: pass
    human_judgment: false
  - id: D5
    description: "On failure (failed-precondition / invalid-argument), the dialog stays open showing the mapped, specific error via friendlyCallableError -- never a silent close"
    requirement: R220
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- delete (R220/R221) > on a rejected call (failed-precondition), the dialog stays open... / a rejected call with a name-mismatch code shows the mismatch error, not a generic one"
        status: pass
    human_judgment: false
  - id: D6
    description: "This component never writes organizations/*, orgNames/*, or inviteLookup/* directly -- deleteOrganization is the only channel (T-77-09)"
    requirement: R216
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- no direct writes (R200/R204) (name-keyed httpsCallable mock throws on any callable other than the five named selectors, including deleteOrganization)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-08-22
status: complete
---

# Phase 77 Plan 02: Church Deletion — Client Type-to-Confirm Dialog + Delete Control Summary

**New `DeleteOrgConfirmDialog.vue` type-to-confirm destructive dialog (exact, case-sensitive name match required) wired into `OrganizationsTab.vue`'s per-row Delete control, gated on `org.active === false` and calling Plan 01's `deleteOrganization` callable.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-22
- **Tasks:** 2/2
- **Files modified/created:** 4 (2 new, 2 modified)

## Accomplishments

- `DeleteOrgConfirmDialog.vue`: new standalone props-in/events-out component. Reuses `CleanupEnableConfirmDialog.vue`'s Teleport/backdrop+panel Transition/hand-rolled focus-trap shell verbatim; the type-to-confirm gate (exact, case-sensitive, trim-only match of the typed value against `orgName`) is genuinely new. Delete button is structurally `:disabled` (`confirming || typedName.trim() !== orgName`) until the match, styled destructive-red unconditionally. Body copy echoes `orgName`, `memberCount`, `pendingCount`, and explicitly states "This cannot be undone." Focus lands on Cancel on open (never Delete), restores to the pre-open element on close, and the typed-name input resets to empty on every reopen so a stale value from a different org's dialog never carries over. Every dismissal path (Cancel click, backdrop click, panel `@click.self`, Escape) is a no-op while `confirming` is true.
- `OrganizationsTab.vue`: added a Delete `<button>` per row, enabled only when `org.active === false` (mirroring the existing "Deactivated" badge's convention). Opens `DeleteOrgConfirmDialog`, rendered once at the component root. `onConfirmDelete` calls `httpsCallable('deleteOrganization')({orgId, confirmName: typedName})`; on success builds a page-level summary banner from the response (`membersUnlinked`/`invitesDeleted`/`storageObjectsDeleted`), closes the dialog, and `await refreshOrgs()` so the deleted row disappears; on failure keeps the dialog open with a `friendlyCallableError`-mapped message and never clears the targeted org. `friendlyCallableError` extended with `failed-precondition` ("Deactivate the church first.") and `invalid-argument` ("The name doesn't match.") branches.
- `DeleteOrganizationRequest`/`DeleteOrganizationResponse` interfaces mirror `functions/src/orgDeletion.ts`'s `deleteOrganizationHandler` contract exactly (same pattern as the file's existing `SetOrgActiveRequest`/`SetOrgActiveResponse` mirrors).
- 15 new tests in `DeleteOrgConfirmDialog.test.ts` and 6 new tests in `OrganizationsTab.test.ts` (`mockDeleteOrganization` added to the name-keyed `httpsCallable` dispatcher, same pattern as `mockSetOrgActive`).

## Task Commits

1. **Task 1: DeleteOrgConfirmDialog — type-to-confirm destructive dialog** - `83f2b800` (feat)
2. **Task 2: Wire the Delete control into OrganizationsTab** - `7701c31d` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `src/components/admin/DeleteOrgConfirmDialog.vue` (new) - type-to-confirm destructive dialog
- `src/components/admin/__tests__/DeleteOrgConfirmDialog.test.ts` (new) - 15 tests
- `src/components/admin/OrganizationsTab.vue` - Delete control, dialog wiring, `friendlyCallableError` error-code additions
- `src/components/admin/__tests__/OrganizationsTab.test.ts` - `mockDeleteOrganization` + 6 new tests

## Decisions Made

- Copied `CleanupEnableConfirmDialog`'s Teleport/focus-trap shell verbatim, but deliberately did NOT copy its `isBlocked`/hard-block dual-button pattern (R190's structural "never deletable" fail-safe doesn't apply here — typing the correct name is something the user CAN do, so a single `<button :disabled>` gate is sufficient for R220).
- Delete button styled destructive-red unconditionally — no `wouldDeleteCount > 0`-style conditional, since every delete here is destructive by definition.
- `friendlyCallableError` extended in place (rather than a new helper) with `failed-precondition`/`invalid-argument` branches, keeping one error-mapping surface for the whole component; also folded in `unauthenticated` alongside the existing `permission-denied` branch since both map to the same generic permission message.
- Page-level `deleteFeedback` banner (not per-row) since the row is gone from the list after a successful delete — there's no row left to attach per-row feedback to, unlike Deactivate/Reactivate/Assign.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two test-authoring bugs found and fixed during the DeleteOrgConfirmDialog.test.ts RED/GREEN loop**
- **Found during:** Task 1, first test run against the finished component
- **Issue:** (a) `wrapper.findAll('div')[0]` for the backdrop click test resolved to the mount wrapper's own root element (not the backdrop) under this codebase's `attachTo: document.body` + custom Teleport-stub mounting convention — a positional index assumption that happened to be untested by `CleanupEnableConfirmDialog.test.ts`'s own backdrop test (which only asserts a negative/no-op case, so the same index bug there is invisible). (b) The "focus lands on Cancel" assertion compared `cancel.textContent` against the exact string `'Cancel'`, but the button's template whitespace produces `' Cancel '` with surrounding whitespace.
- **Fix:** (a) Selected the backdrop via its distinctive class (`wrapper.find('.z-40')`), matching the convention `CleanupEnableConfirmDialog.test.ts` already uses for its panel-wrapper lookup (`.z-50`) rather than a positional index. (b) Compared `cancel.textContent?.trim()` instead of the raw string.
- **Files modified:** `src/components/admin/__tests__/DeleteOrgConfirmDialog.test.ts` (test-only; no component code changed)
- **Verification:** Full `DeleteOrgConfirmDialog.test.ts` suite (15 tests) passes.
- **Committed in:** `83f2b800` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — both instances are test-authoring bugs surfaced while writing new tests, not defects in the shipped component or a regression to any existing test)
**Impact on plan:** Confined entirely to the new test file; no production code was touched to accommodate these fixes.

## Issues Encountered

See Deviations above — found and resolved during Task 1's own verification loop, not carried forward as an open problem.

## User Setup Required

None — no external service configuration required. This plan is client-only (no `firebase deploy`); Plan 01's `firebase deploy --only functions:deleteOrganization,firestore:rules` remains the outstanding server hand-over to the owner.

## Next Phase Readiness

- Both halves of R220 (server-side eligibility/name-match gate from Plan 01, client-side type-to-confirm UI from this plan) are now code-complete and independently unit-tested.
- **Deploy hand-over unchanged from 77-01-SUMMARY.md:** `firebase deploy --only functions:deleteOrganization,firestore:rules` is still required before the Delete control in this plan can function end-to-end against a real backend — `deleteOrganization` has never been deployed or invoked against real/emulator data.
- No blockers. The one auto-fixed deviation above is resolved within this plan's own Task 1 commit, not deferred.

## Gate Results

- `npm run type-check` (`vue-tsc --build`) — **clean**, both before and after Task 2.
- `npx vitest run DeleteOrgConfirmDialog.test.ts` — **15/15 pass**.
- `npx vitest run OrganizationsTab.test.ts` — **36/36 pass** (30 pre-existing + 6 new; zero regressions to the Phase 76 Deactivate/Reactivate control or the Phase 75 pending-badge).
- `npx vitest run` (full app suite) — **Test Files: 2 failed | 135 passed (137)**, **Tests: 22 failed | 4089 passed (4111)** — exactly the documented known-failing baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`'s stale `'Roles config'` assertion), with 21 new tests (15 + 6) added and passing, and no other file regressed.

---
*Phase: 77-church-deletion-cascade-cleanup*
*Completed: 2026-08-22*

## Self-Check: PASSED

All 4 created/modified files verified present on disk; both task commits (`83f2b800`, `7701c31d`) verified present in `git log --oneline --all`.
