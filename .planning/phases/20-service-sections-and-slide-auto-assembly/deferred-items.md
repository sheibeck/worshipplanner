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
