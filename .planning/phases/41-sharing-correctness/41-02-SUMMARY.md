---
phase: 41-sharing-correctness
plan: 02
subsystem: sharing
tags: [firestore, share-tokens, pure-function, unit-testing, composite-index]

# Dependency graph
requires: []
provides:
  - "src/utils/shareTokens.ts — mintShareToken(), shareTokenCreatedAtMillis(), pickAdoptableToken(), and the ShareTokenCandidate type, all pure and Firestore/Pinia-free"
  - "An adoption-ordering algorithm proven safe against the composite-index trap: equality-only query result, client-side sort, no orderBy anywhere in the diff"
affects: [41-03, 41-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure src/utils/ module with zero Firestore/Pinia imports, tested with plain literal fixtures (matches src/utils/serviceRoles.ts house style)"
    - "Firestore snapshot data mapped to a minimal structural type (ShareTokenCandidate) at the call boundary, keeping the decision logic testable without a mock"

key-files:
  created:
    - src/utils/shareTokens.ts
    - src/utils/__tests__/shareTokens.test.ts
  modified: []

key-decisions:
  - "Adoption query stays equality-only (where('serviceId','==',id)), no orderBy — client-side sort in pickAdoptableToken avoids the composite-index requirement that firestore.indexes.json doesn't declare and the emulator wouldn't catch"
  - "Org filter runs BEFORE the sort in pickAdoptableToken, not after — proven by an explicit foreign-org-candidate-is-newer test case (T-41-07)"
  - "Timestamp coercion (shareTokenCreatedAtMillis) never throws and never returns NaN — every unrecognized/null/non-finite shape returns 0, so a locally-pending serverTimestamp() sorts last deterministically instead of crashing the comparator"
  - "Tiebreak on identical createdAt is the lexicographically greatest document id (b.id.localeCompare(a.id)), documented as compensating for Firestore's non-guaranteed query iteration order"

patterns-established:
  - "Pattern 1: Extract a Firestore-adjacent decision into a pure utils/ function with a structural input type before wiring it to a live query, so the tricky edge cases (ties, missing timestamps, cross-tenant leakage) are provable with zero mock scaffolding"

requirements-completed: [R078]

coverage:
  - id: D1
    description: "mintShareToken() mints a 36-char lowercase-hex token using the same 18-byte crypto.getRandomValues generator as services.ts, unchanged entropy"
    requirement: "R078"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/shareTokens.test.ts#mintShareToken > returns a string of length exactly 36"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/shareTokens.test.ts#mintShareToken > matches a lowercase-hex-only pattern anchored at both ends"
        status: pass
    human_judgment: false
  - id: D2
    description: "shareTokenCreatedAtMillis() total-orders every real-world timestamp shape (Timestamp, {seconds,nanoseconds}, Date, number, null/undefined/empty-object) without throwing or returning NaN"
    requirement: "R078"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/shareTokens.test.ts#shareTokenCreatedAtMillis (6 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "pickAdoptableToken() selects the adoptable token deterministically: empty->null, single-candidate, newest-wins regardless of input order, identical-createdAt tiebreak by greatest doc id, null-createdAt sorts last without throwing, foreign-org candidates discarded even when newer, input array never mutated"
    requirement: "R078"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/shareTokens.test.ts#pickAdoptableToken (11 cases, 1-9 plus mixed-shapes and missing-orgId)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No composite-index-dependent query pattern (orderBy) exists anywhere in shareTokens.ts"
    requirement: "R078"
    verification:
      - kind: other
        ref: "grep -c 'orderBy' src/utils/shareTokens.ts → 0"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-08-07
status: complete
---

# Phase 41 Plan 02: Share-Token Mint and Adoption-Selection Utility Summary

**Pure `src/utils/shareTokens.ts` module extracting R078's mint and adopt-vs-mint decisions into dependency-free, exhaustively-tested functions — no Firestore, no Pinia, no mock, and no `orderBy` anywhere in the diff, closing off the composite-index production failure mode the research pass found.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-07
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- `mintShareToken()` — byte-for-byte copy of the existing 18-byte/36-hex `crypto.getRandomValues` generator from `services.ts:354-357`, no entropy change.
- `shareTokenCreatedAtMillis()` — total-orders every timestamp shape a `shareTokens` document can carry (`Timestamp`-like `toMillis()`, `{seconds,nanoseconds}`, `Date`, finite number, and everything else including `null`/pending `serverTimestamp()`) into milliseconds, never throwing and never producing `NaN`.
- `pickAdoptableToken()` — org-filters candidates BEFORE sorting (T-41-07 mitigation), then sorts a copy by `createdAt` descending with a lexicographically-greatest-id tiebreak, returning `null` when nothing is adoptable. Zero `orderBy` in the source, verified by grep.
- 20 tests in `src/utils/__tests__/shareTokens.test.ts` covering every case in the plan's `<behavior>` block plus mixed-timestamp-shape and non-mutation assertions — no `vi.mock` needed anywhere in the file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/utils/shareTokens.ts with the mint, timestamp-coercion, and adoption-selection functions** - `cb9321b` (feat)
2. **Task 2: Prove the adoption ordering exhaustively in src/utils/__tests__/shareTokens.test.ts** - `fe76142` (test)

## Files Created/Modified
- `src/utils/shareTokens.ts` - `mintShareToken`, `shareTokenCreatedAtMillis`, `pickAdoptableToken`, `ShareTokenCandidate` type. No Firestore/Pinia imports.
- `src/utils/__tests__/shareTokens.test.ts` - 20 tests, `vi.stubGlobal('crypto', ...)` for deterministic mint format assertions only (never asserts two mints differ).

## Exported Signatures (verbatim — Plan 03 imports these)

```typescript
export interface ShareTokenCandidate {
  id: string
  orgId?: unknown
  createdAt?: unknown
}

export function mintShareToken(): string
export function shareTokenCreatedAtMillis(value: unknown): number
export function pickAdoptableToken(candidates: ShareTokenCandidate[], orgId: string): string | null
```

**Test count:** 20 (`mintShareToken`: 2, `shareTokenCreatedAtMillis`: 6, `pickAdoptableToken`: 12 — the plan's 9 numbered cases plus mixed-shapes and missing-`orgId`).

## Decisions Made
- Kept the adoption query's ordering entirely client-side, per the plan's binding constraint — no `orderBy` was added anywhere, confirmed by `grep -c 'orderBy' src/utils/shareTokens.ts` returning `0`.
- `pickAdoptableToken`'s filter step runs strictly before the sort step (not merged into a single comparator), so the org-scoping guarantee (T-41-07) is structurally impossible to accidentally invert. The `8b` test case (foreign-org candidate with a newer `createdAt`) exists specifically to catch a filter-after-sort regression.
- `shareTokenCreatedAtMillis` returns `0` rather than throwing or propagating `NaN` from any unrecognized shape, matching the plan's explicit requirement that a `NaN` leaking into the comparator would silently destroy sort order rather than failing loudly.
- Used `sorted[0]?.id ?? null` (not `sorted[0].id`) to satisfy the strict TypeScript indexed-access check under `vue-tsc --build`; behaviorally identical since `sorted` is guaranteed non-empty by the preceding early return on `scoped.length === 0`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `vue-tsc --build` strict indexed-access error on `sorted[0].id`**
- **Found during:** Task 1 verification (`npm run type-check`)
- **Issue:** `TS2532: Object is possibly 'undefined'` on `return sorted[0].id` — the compiler cannot infer that `sorted` is non-empty from the earlier `scoped.length === 0` guard.
- **Fix:** Changed to `sorted[0]?.id ?? null`, which is behaviorally identical (the `??` branch is unreachable given the guard) but satisfies the strict check.
- **Files modified:** `src/utils/shareTokens.ts`
- **Verification:** `npm run type-check` reports 0 errors.
- **Committed in:** `cb9321b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/type-safety)
**Impact on plan:** Cosmetic type-safety fix only, no behavior change. No scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

`src/utils/shareTokens.ts`'s three exports are ready for Plan 03's `ensureShareLink` to import directly: map `getDocs(...).docs` into `ShareTokenCandidate[]` (`{ id: d.id, orgId: d.data().orgId, createdAt: d.data().createdAt }`), call `pickAdoptableToken(candidates, orgId)`, and fall back to `mintShareToken()` when it returns `null`. No blockers.

**Full app suite note (documented, not a regression):** `npx vitest run` shows 3 failing test files — the two documented baseline files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) plus `render-service/src/render.test.ts`, which fails on a pre-existing Vitest-version mismatch between the root workspace (`4.0.18`) and `render-service`'s own devDependency (`4.1.10`) — unrelated to this plan's files and outside its scope per CLAUDE.md's documented tooling note. `src/utils/__tests__/shareTokens.test.ts` itself: 20/20 passing.

---
*Phase: 41-sharing-correctness*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: src/utils/shareTokens.ts
- FOUND: src/utils/__tests__/shareTokens.test.ts
- FOUND: .planning/phases/41-sharing-correctness/41-02-SUMMARY.md
- FOUND: cb9321b
- FOUND: fe76142
