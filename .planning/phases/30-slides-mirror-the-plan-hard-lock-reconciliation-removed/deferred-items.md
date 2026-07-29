# Deferred Items — Phase 30

Out-of-scope discoveries logged during execution, per the executor's Scope Boundary
(do not fix; do not re-run builds hoping they resolve themselves).

## 30-03: pre-existing `vitest/no-conditional-expect` lint errors in SlideGrid.test.ts

Found during: 30-03 Task 3, scoping `npx eslint` to the changed test file.

`src/components/slides/__tests__/SlideGrid.test.ts` has three pre-existing
`vitest/no-conditional-expect` errors (lines 421, 923, 924 as of this plan's HEAD), all
inside `for...if...expect(...)` loops unrelated to the R054 read-only work this plan adds.
Verified pre-existing by linting `git show HEAD:...SlideGrid.test.ts` before any edit in
this plan — the same three errors reproduce on the untouched original file.

Not fixed here: none of the three affected tests were touched by 30-03's Task 3 (they sit
in the pre-existing "add-slide control" and "video drop" describes), and the Scope
Boundary excludes issues not directly caused by the current task's changes.
