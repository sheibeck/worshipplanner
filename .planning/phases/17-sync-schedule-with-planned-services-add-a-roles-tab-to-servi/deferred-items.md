# Deferred Items — Phase 17

Out-of-scope failures discovered during `npm run test:unit` wave-gate runs. Not fixed
per the executor's scope boundary (only auto-fix issues directly caused by the current
plan's changes). Logged here for a future plan/quick-task to pick up.

## From 17-05 execution (2026-07-22)

- **`src/views/__tests__/RosterView.test.ts` — "wraps Roles config in CollapsibleSection"**
  fails: `expect(wrapper.text()).toContain('Roles config')`. The tab label was renamed
  from "Roles config" to "Roles" in commit `df1ca34` (`tweak(volunteers): rename "Roles
  config" tab to "Roles"`), predating this plan. The test assertion was never updated.
  Not touched by 17-05 (only modifies `src/views/ShareView.vue` and its test file).

- **`src/views/__tests__/ServiceEditorView.test.ts` — "Print button exists and clicking
  it calls window.print() once"** times out (5000ms). Unrelated to ShareView.vue or the
  serviceShares/roleAssignments surface this plan touches; pre-existing before this
  plan's commits (confirmed via `git log` — no `17-05` commits touch
  `ServiceEditorView.vue` or its test).

Both were present before and after 17-05's commits; scope-excluded here.
