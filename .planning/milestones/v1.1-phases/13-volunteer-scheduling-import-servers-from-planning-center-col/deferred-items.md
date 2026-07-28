# Deferred Items — Phase 13

Items discovered during plan execution that are out of scope for the current task
(pre-existing, unrelated to the files being modified) and therefore not auto-fixed
per the executor's scope-boundary rule.

## From Plan 13-05

- **`src/views/__tests__/ServiceEditorView.test.ts` — "Print button exists and clicking
  it calls window.print() once" times out (5000ms) intermittently.** Observed during
  `npm run test:unit` full-suite run while executing 13-05 (roster.ts store). Not caused
  by roster.ts/roster.test.ts changes (13-05 touches only `src/stores/roster.ts` and
  `src/stores/__tests__/roster.test.ts`; ServiceEditorView is unrelated Phase 3/4 code).
  Passed on 2 of the other 2 tests in the same describe block. Likely flaky/timing-
  related (window.print() mock + async mount). Not fixed here — out of scope for 13-05.
