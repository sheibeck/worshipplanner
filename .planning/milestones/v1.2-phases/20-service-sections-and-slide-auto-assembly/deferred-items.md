# Deferred Items — Phase 20

Out-of-scope discoveries logged during plan execution (SCOPE BOUNDARY rule — not fixed here).

## 20-01: Pre-existing `npm run type-check` failures unrelated to this plan

**Discovered during:** Task 1 verification (`npm run type-check`)

**Files:** `src/utils/ccliParser.ts`, `src/utils/__tests__/ccliParser.test.ts`,
`src/utils/scriptureSplitter.ts`, `src/utils/__tests__/scriptureSplitter.test.ts`

**Issue:** `npm run type-check` exits with code 2 due to ~40 pre-existing TS2532
("Object is possibly 'undefined'") and TS2345/TS2322 errors in these files. Confirmed
via `git stash` that these errors exist identically on the pre-Phase-20 baseline commit
(`1422012 docs(20): create phase plan`) — none were introduced by any 20-01 task.

**Scope decision:** Not fixed (out of scope — unrelated files, not touched by this plan's
`files_modified` list). Verified this plan's actual changed files (`src/types/service.ts`,
`src/types/slide.ts`, `src/utils/slotTypes.ts`) introduce zero new type-check errors by
diffing `npm run type-check` output filtered to those three filenames before/after each
task — no matches in either case.

**Recommendation:** A future cleanup task should tighten `ccliParser.ts` / `scriptureSplitter.ts`
null-safety (likely a stricter TS lib/tsconfig setting enabled since those files were written).

## 20-04: Pre-existing `npm run type-check` failure in ScriptureSlideEditor.test.ts, unrelated to the override-marker task

**Discovered during:** Task 3 verification (`npm run type-check`, run as `vue-tsc --build`)

**File:** `src/components/__tests__/ScriptureSlideEditor.test.ts` — the `'loads existing reading in
edit mode'` test's `mockGetReading.mockResolvedValueOnce({...})` call (line 269 in the post-20-04
file; unchanged by this plan's Task 3 edit, which only touched the earlier `describe` block adding
the new override-marker test).

**Issue:** `npm run type-check` (via `vue-tsc --build`) reports TS2345 — the mocked resolved value's
object literal isn't assignable to the mock's inferred `Promise<null>` return type (`mockGetReading =
vi.fn(() => Promise.resolve(null))` at file top gives `vi.fn` a `null`-only return-type inference
absent an explicit generic). Confirmed present verbatim in this file before Task 3's edit (read
directly during this plan's `<read_first>` step, prior to any change) — not introduced by the
override-marker change. Notably, a direct `npx vue-tsc --noEmit -p tsconfig.json` invocation does
NOT surface this error (likely differing `--build`/incremental-project-reference behavior vs. the
`npm run type-check` script's `vue-tsc --build`), which is itself a signal this is pre-existing build-
config noise rather than something the override-marker change caused.

**Scope decision:** Not fixed (out of scope — unrelated test code, not part of this plan's
`files_modified` list, and pre-dates this plan). Verified via targeted `vitest run` that all 16
`ScriptureSlideEditor.test.ts` tests (including the new override-marker test) pass, and that the
component file `src/components/ScriptureSlideEditor.vue` itself introduces zero new type-check
errors (filtered diff on that filename before/after the task showed no matches).

**Recommendation:** Add an explicit generic to `mockGetReading`'s `vi.fn<...>` declaration (e.g.
`vi.fn<() => Promise<ScriptureReading | null>>(...)`) in a future test-hygiene pass.

## 20-04: Pre-existing full-suite regression failures, unrelated to this plan

**Discovered during:** Task 3 verification (`npx vitest run`, full-suite regression gate)

**1. `src/views/__tests__/RosterView.test.ts` — stale assertion from a prior unrelated rename commit.**
`'wraps Roles config in CollapsibleSection'` asserts `wrapper.text()).toContain('Roles config')`, but
commit `df1ca34 tweak(volunteers): rename "Roles config" tab to "Roles"` (already on `milestone/M001`
before this plan started — unrelated to Phase 20/RosterView is not in this plan's `files_modified`)
renamed the tab label and left the test assertion stale. Reproduces identically running the test file
in isolation with zero Phase-20 changes applied. Not touched — out of scope.

**2. `.gsd/quarantine/worktrees/**` stale copies — untracked GSD housekeeping debris (same pattern
logged in 20-02/20-03's summaries).** Three quarantine worktree snapshots under
`.gsd/quarantine/worktrees/` each contain their own frozen copy of `RosterView.test.ts`,
`ServiceEditorView.test.ts`, and `rules.test.ts`. They fail for reasons unrelated to any Phase 20
change (the same stale `'Roles config'` assertion above; a Pinia-no-active-instance error because
those frozen copies predate this plan's `@/stores/scriptureSlides` mock addition; and
`rules.test.ts` needs a running Firestore emulator on `127.0.0.1:8080`, unavailable in this
environment). Confined entirely to `.gsd/quarantine/worktrees/**`, not `src/` — out of scope.

**3. `src/rules.test.ts` (real file) — 114 tests report `skipped`, not failed.** Requires a running
Firestore emulator (`npm run test:rules` per `CLAUDE.md`); the plain `npx vitest run` full-suite
invocation used for this plan's regression gate does not start one, so the file's own guard skips
its tests rather than failing. Expected, not a regression.

**Net result:** all Phase-20-04 `files_modified` tests pass (`SlideshowPreview.test.ts` 6/6,
`ServiceEditorView.test.ts` 14/14 real file, `ScriptureSlideEditor.test.ts` 16/16 real file); the
only non-skipped failures in the full-suite run are the three items above, all pre-existing and
unrelated to this plan's changes.
