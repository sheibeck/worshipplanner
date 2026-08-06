# Deferred items — Phase 21

## 21-06: Pre-existing `ServiceEditorView.test.ts` Pinia failure (out of scope)

**Found during:** Task 2 verification (ran `npx vitest run src/views/__tests__/ServiceEditorView.test.ts`
as an extra sanity check beyond the plan's own `<verify>` command, which only targets
`slotTypes.test.ts`/`slideshowAssembler.test.ts`).

**Symptom:** All suites in `src/views/__tests__/ServiceEditorView.test.ts` fail at mount with
`[🍍]: "getActivePinia()" was called but there was no active Pinia`, thrown from
`useSlideshowAssembly` (`src/composables/useSlideshowAssembly.ts:74`) when it calls
`useImportedSlides()`.

**Root cause:** `useSlideshowAssembly.ts` has called `useImportedSlides()` unconditionally since
21-01. `useSlideshowAssembly.test.ts` was updated in 21-01 to mock `@/stores/importedSlides`
(documented in 21-01-SUMMARY.md's Rule-1 deviation), but `ServiceEditorView.test.ts` — which
mounts the whole view and therefore also exercises `useSlideshowAssembly` — was never given the
equivalent mock. This is a latent regression from 21-01, not something introduced by 21-06.

**Verified pre-existing:** Confirmed via `git stash` on `src/views/ServiceEditorView.vue` alone
(reverting only 21-06's Task 2 edits, keeping Task 1's new files) — the same failure reproduces
identically against the pre-21-06 baseline. 21-06 does not change this file's Pinia store usage
in any way that would explain the failure.

**Scope decision:** Out of scope for 21-06 per the executor's scope-boundary rule (pre-existing
failures in files not modified by the current task's `files_modified` list are logged, not
fixed). `ServiceEditorView.test.ts` is not in 21-06's `files_modified`. Not fixed here.

**Suggested fix (for whoever picks this up):** Add a `vi.mock('@/stores/importedSlides', ...)`
stub to `ServiceEditorView.test.ts` mirroring the pattern already established in
`useSlideshowAssembly.test.ts` (reactive `decks: []` + `isLoading: false` + `vi.fn()` methods for
`subscribeDecks`/`unsubscribeDecks`/`createDeck`/`updateDeck`/`getDeck`).
