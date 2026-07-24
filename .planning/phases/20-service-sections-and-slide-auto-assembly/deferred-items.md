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
