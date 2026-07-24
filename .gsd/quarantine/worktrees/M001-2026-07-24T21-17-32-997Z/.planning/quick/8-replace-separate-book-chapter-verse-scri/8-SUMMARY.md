---
phase: quick
plan: 8
subsystem: scripture-input
tags: [ux, scripture, parsing, freeform-input, tdd]
dependency_graph:
  requires: []
  provides: [parseScriptureInput, freeform-scripture-input]
  affects: [ScriptureInput.vue, scripture.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, freeform text parsing, regex-based book resolution]
key_files:
  created: []
  modified:
    - src/utils/scripture.ts
    - src/utils/__tests__/scripture.test.ts
    - src/components/ScriptureInput.vue
    - src/components/__tests__/ScriptureInput.test.ts
decisions:
  - Prefix matching requires >=4 chars to prevent short ambiguous tokens like 'joh' from matching 'John'
  - formatRef helper formats ScriptureRef to string for populating text input on mount and after AI selection
  - parseError shown inline below text input; cleared when text is empty
  - isComplete computed kept (void-suppressed) for potential future template use
metrics:
  duration: 12m
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 8: Replace Separate Book/Chapter/Verse Fields with Freeform Scripture Input

**One-liner:** Replaced four-field scripture selector (Book dropdown + Chapter + VerseStart + VerseEnd) with a single freeform text input backed by `parseScriptureInput()` — users type "Isaiah 53:1-6" instead of selecting fields individually.

## What Was Built

### Task 1: parseScriptureInput utility (TDD)

Added `parseScriptureInput(text: string): ScriptureRef | null` to `src/utils/scripture.ts`.

Algorithm:
1. Trim input; return null if empty
2. Regex `/^(.+?)\s+(\d+)(?::(.+))?$/` splits book token, chapter, and optional verse expression
3. Book resolution: exact case-insensitive match wins; unique prefix match (>=4 chars) as fallback; ambiguous/no match returns null
4. Multi-range verse expression ("1-10,15-20"): collects all numbers, verseStart=min, verseEnd=max
5. Returns ScriptureRef with canonical book casing from BIBLE_BOOKS

Tests added: 15 new tests covering empty input, exact/prefix/ambiguous book matching, all verse formats, numbered and multi-word books.

### Task 2: Freeform ScriptureInput.vue

Replaced the 4-field block (lines 117-157) with a single `<input type="text">` with `v-model="localText"` and `@input="onTextInput"`.

Script changes:
- Replaced `localBook`, `localChapter`, `localVerseStart`, `localVerseEnd` refs with `localText` and `parseError`
- Added `formatRef()` helper to convert ScriptureRef → display string
- `currentRef` computed now delegates to `parseScriptureInput(localText.value)`
- `onTextInput()` emits parsed ref or null, sets parse error hint
- `onSelectAiScripture()` uses `formatRef()` to populate text then calls `onTextInput()`
- All computed properties (`canPreview`, `esvUrl`, `passageQuery`, `hasOverlap`) updated to read from `currentRef`

Component test updates:
- Removed "Book dropdown" describe block (select element gone)
- Added "Freeform text input" describe block with 5 tests
- Added "modelValue population" describe block with 4 tests verifying text input initialises from props
- ESV/Overlap/Preview tests adapted to pass modelValue directly (component formats on mount)

## Commits

| Hash | Description |
|------|-------------|
| a278816 | test(quick-8): add failing tests for parseScriptureInput (TDD RED) |
| 8f5c76f | feat(quick-8): implement parseScriptureInput in scripture.ts (TDD GREEN) |
| 7941ca2 | feat(quick-8): replace 4-field scripture UI with freeform text input |

## Test Results

- scripture.test.ts: 32 tests passed (17 existing + 15 new)
- ScriptureInput.test.ts: 21 tests passed (entirely new suite)
- Full suite: 407 tests across 20 files — all passed, no regressions

## Deviations from Plan

**1. [Rule 1 - Bug] Prefix match minimum length threshold**
- **Found during:** Task 1 GREEN phase
- **Issue:** `'joh 3:16'` returned a result because 'joh' uniquely prefix-matched 'John'. Plan specified this should return null.
- **Fix:** Added minimum prefix length of 4 characters before allowing prefix matching. 'joh' (3 chars) fails; 'Psalm' (5 chars) still matches 'Psalms'.
- **Files modified:** src/utils/scripture.ts
- **Commit:** 8f5c76f

## Self-Check: PASSED

- src/utils/scripture.ts — FOUND
- src/utils/__tests__/scripture.test.ts — FOUND
- src/components/ScriptureInput.vue — FOUND
- src/components/__tests__/ScriptureInput.test.ts — FOUND
- Commit a278816 — FOUND
- Commit 8f5c76f — FOUND
- Commit 7941ca2 — FOUND
