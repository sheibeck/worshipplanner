---
phase: 146-spec-standard
fixed_at: 2026-11-06T00:00:00Z
review_path: .planning/phases/146-spec-standard/146-REVIEW.md
iteration: 3
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 146: Code Review Fix Report

**Fixed at:** 2026-11-06
**Source review:** .planning/phases/146-spec-standard/146-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### WR-01: A criterion written without its list marker is silently dropped when it directly follows another item

**Files modified:** `src/__tests__/specCoverage.ts`, `src/__tests__/specCoverage.test.ts`
**Commit:** e4fe5c86
**Applied fix:** Added five cases to the "still reports" table first and saw four fail (`**AC-FIX-02** - b`, `  **AC-FIX-02** - b`, `  - **AC-FIX-02:** b`, `__AC-FIX-02__ - b`; the underscore bullet case already passed). Then changed `CRITERION_SHAPE` so the bullet is optional and a bold id counts as a definition when followed by a separator, or when closed by a colon inside the bold.

The review's suggested regex (`AC-...:?(?:\*\*|__)\s*[-–—:]`) did not make `  - **AC-FIX-02:** b` error. It still demands a separator after the closing bold, and in that input the colon sits inside the bold. The shipped regex treats the inner colon as the separator:
`(?:\*\*|__)AC-[A-Za-z0-9-]*(?::(?:\*\*|__)|(?:\*\*|__)\s*[-–—:])`.

The continuation table is unchanged and still passes (`**AC-FIX-01** does`, `  **AC-FIX-01** does`, plain `AC-FIX-01 when ...`, `  - AC-FIX-01 still holds`). Test titles cite only R456 and contain no AC id token.

**Verification:** `npx vitest run src/__tests__/specCoverage.test.ts` passes (167 tests). `npm run type-check` exits 0.

**Note on isolation:** I worked on master in the main checkout and not in a separate worktree. The four `.planning/graphs/*` files and the uncommitted phase review files are in the main tree and stay untouched. Only the two source files above were staged, by name.

---

_Fixed: 2026-11-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
