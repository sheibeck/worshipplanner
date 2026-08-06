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

## From 17-04 execution (2026-07-22)

- **`src/views/__tests__/ServiceEditorView.test.ts` — Print/Copy-for-PC mount tests
  timing out (5000ms):** RESOLVED by 17-04. 17-04 legitimately grew `ServiceEditorView.vue`
  (Roles tab template + `useRosterStore`/`useQuartersStore` imports), pushing the *first*
  cold SFC transform + template-compile of this 2200+ line component over vitest's default
  5s per-test timeout on a loaded machine. Fixed within 17-04's own test file by warming
  the transform once in a top-level `beforeAll(…, 30000)` so each individual test's timer
  measures only a warm mount (per-test time dropped to ~350ms). Not deferred — closed.

- **`src/views/__tests__/RosterView.test.ts` — "wraps Roles config in CollapsibleSection"**:
  still deferred for 17-04 as well. 17-04 only modifies `ServiceEditorView.vue` and its
  test; the stale RosterView assertion (tab renamed "Roles config" → "Roles" in `df1ca34`,
  pre-dating this phase) is untouched by 17-04 and remains out of scope. It only became
  visible because `.env.local` now lets `RosterView.test.ts` load (it previously failed at
  module import with `Firebase: Error (auth/invalid-api-key)`).
