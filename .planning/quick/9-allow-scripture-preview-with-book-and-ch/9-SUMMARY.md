---
phase: quick-9
plan: 01
subsystem: scripture-input
tags: [scripture, preview, esv, ux, partial-input]
dependency_graph:
  requires: []
  provides: [canPreview computed in ScriptureInput]
  affects: [ScriptureInput.vue, ESV link, Preview button]
tech_stack:
  added: []
  patterns: [computed gating with canPreview, conditional passageQuery construction]
key_files:
  created: []
  modified:
    - src/components/ScriptureInput.vue
    - src/components/__tests__/ScriptureInput.test.ts
decisions:
  - canPreview computed added alongside isComplete — separation of concerns: canPreview gates UI affordances, isComplete gates data emit
  - passageQuery conditionally includes verses: "Book Ch" when no verses, "Book Ch:start-end" when verses present
  - verseStart/verseEnd of 0 treated as falsy (same as empty) for verse inclusion in query
metrics:
  duration_minutes: 8
  completed_date: "2026-03-04"
  tasks_completed: 1
  files_modified: 2
---

# Quick Task 9: Allow Scripture Preview with Book and Chapter Only — Summary

**One-liner:** Added `canPreview` computed to ScriptureInput gating ESV link and preview button on book+chapter only, while keeping `isComplete` as the 4-field gate for the modelValue emit.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for canPreview partial fields | 7eb8513 | ScriptureInput.test.ts |
| 1 (GREEN) | canPreview computed and preview/ESV gating | 2ba8775 | ScriptureInput.vue |

## What Was Built

### ScriptureInput.vue Changes

**New computed: `canPreview`**
```typescript
const canPreview = computed(() => {
  return !!localBook.value && !!localChapter.value
})
```
Requires only book and chapter — no verses needed.

**Updated `esvUrl`** — uses `canPreview` instead of `isComplete`, so the ESV link appears as soon as book and chapter are selected.

**Updated `passageQuery`** — conditionally includes verses:
```typescript
const passageQuery = computed(() => {
  if (!canPreview.value) return ''
  const base = `${localBook.value} ${localChapter.value}`
  if (localVerseStart.value && localVerseEnd.value) {
    return `${base}:${localVerseStart.value}-${localVerseEnd.value}`
  }
  return base
})
```
Produces "John 3" (chapter only) or "John 3:16-17" (with verses).

**Updated `showPreviewButton`** — uses `canPreview` instead of `isComplete`.

**Updated template v-if on ESV link** — changed from `v-if="isComplete"` to `v-if="canPreview"`.

**`isComplete` unchanged** — still requires all 4 fields, still gates `currentRef` and the `update:modelValue` emit.

### ScriptureInput.test.ts Changes

- Updated `esvLink` mock signature to match actual 2-parameter interface (`book`, `chapter`)
- Added `vi.mock('@/utils/esvApi')` to prevent real network calls during tests
- Added `describe('Preview with partial fields')` block with 6 new tests:
  - ESV link visible when only book+chapter filled
  - ESV link not visible when both empty
  - Preview button visible when only book+chapter filled
  - passageQuery is "Book Ch" without verses
  - passageQuery includes verse range when all 4 fields filled
  - `update:modelValue` still emits `null` when only book+chapter filled

## Verification

- All 13 tests pass: `npx vitest run src/components/__tests__/ScriptureInput.test.ts`
- No type errors: `npx vue-tsc --noEmit`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected esvLink mock signature in test file**
- **Found during:** Setting up RED tests
- **Issue:** Existing `esvLink` mock had 4 parameters but actual `esvLink(book, chapter)` only takes 2
- **Fix:** Updated mock to `vi.fn((book: string, chapter: number) => ...)` matching actual signature
- **Files modified:** src/components/__tests__/ScriptureInput.test.ts
- **Commit:** 7eb8513

## Self-Check

Files exist:
- src/components/ScriptureInput.vue — FOUND
- src/components/__tests__/ScriptureInput.test.ts — FOUND

Commits exist:
- 7eb8513 — test(quick-9-01): add failing tests for canPreview with book+chapter only
- 2ba8775 — feat(quick-9-01): add canPreview computed and update preview/ESV gating

## Self-Check: PASSED
