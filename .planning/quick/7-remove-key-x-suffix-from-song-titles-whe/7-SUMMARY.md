---
phase: quick
plan: 7
subsystem: pc-export
tags: [planning-center, export, song-title, quick-fix]
dependency_graph:
  requires: []
  provides: [bare-song-title-in-pc-export]
  affects: [src/utils/planningCenterApi.ts]
tech_stack:
  added: []
  patterns: [nullish-coalescing]
key_files:
  modified:
    - src/utils/planningCenterApi.ts
    - src/utils/__tests__/planningCenterApi.test.ts
key_decisions:
  - PC export titles use bare songTitle only; key annotation belongs in internal UI, not PC item names
metrics:
  duration: ~3 minutes
  completed: "2026-03-12T19:59:30Z"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 7: Remove (Key: X) Suffix from PC Export Song Titles

**One-liner:** PC export item titles now use bare song title (e.g., "Come Thou Fount") instead of "Come Thou Fount (Key: G)".

## What Was Done

Removed the `(Key: X)` annotation from song item titles sent to Planning Center during service plan export. The key information is internal UI data and not appropriate for PC item names.

### Task 1: Remove key suffix from addSlotAsItem

Changed title construction in `src/utils/planningCenterApi.ts` around line 700 from:

```typescript
const title = slot.songTitle
  ? `${slot.songTitle} (Key: ${slot.songKey ?? ''})`
  : '[Empty Song]'
```

to:

```typescript
const title = slot.songTitle ?? '[Empty Song]'
```

The `songKey` field is retained on the slot type — it is still used in UI display and print layout. Only the PC export title was changed.

**Commit:** c5ba328

### Task 2: Update tests to expect bare song titles

Updated 6 locations in `src/utils/__tests__/planningCenterApi.test.ts`:

1. `createItem` test fixture: `'Come Thou Fount (Key: G)'` → `'Come Thou Fount'`
2. `createItem` assertion: same update
3. `updateItem` test fixture: same update
4. `updateItem` assertion: same update
5. `addSlotAsItem` no-CCLI test description: updated to "bare song title"
6. `addSlotAsItem` no-CCLI assertion: same update

All 61 planningCenterApi tests pass. Full suite: 384 tests across 20 files — all pass.

**Commit:** 4ff3130

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `src/utils/planningCenterApi.ts` modified: confirmed
- `src/utils/__tests__/planningCenterApi.test.ts` modified: confirmed
- Commit c5ba328: confirmed
- Commit 4ff3130: confirmed
- All 384 tests passing: confirmed
