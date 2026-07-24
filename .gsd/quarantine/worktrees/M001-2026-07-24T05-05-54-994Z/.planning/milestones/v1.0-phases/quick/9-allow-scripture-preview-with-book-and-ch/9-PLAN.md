---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ScriptureInput.vue
  - src/components/__tests__/ScriptureInput.test.ts
autonomous: true
requirements: [QUICK-9]
must_haves:
  truths:
    - "Preview button appears when only book and chapter are filled (no verses required)"
    - "ESV link appears when only book and chapter are filled (no verses required)"
    - "Preview query is 'Book Ch' when no verses, 'Book Ch:start-end' when verses present"
    - "isComplete still requires all 4 fields for update:modelValue emit"
    - "Preview button still works correctly when all 4 fields are filled"
  artifacts:
    - path: "src/components/ScriptureInput.vue"
      provides: "canPreview computed, updated passageQuery and showPreviewButton"
      contains: "canPreview"
    - path: "src/components/__tests__/ScriptureInput.test.ts"
      provides: "Tests for preview with book+chapter only"
  key_links:
    - from: "ScriptureInput.vue canPreview"
      to: "showPreviewButton computed"
      via: "canPreview replaces isComplete for preview gating"
      pattern: "canPreview"
    - from: "ScriptureInput.vue canPreview"
      to: "esvUrl computed"
      via: "canPreview replaces isComplete for ESV link visibility"
      pattern: "canPreview"
    - from: "ScriptureInput.vue passageQuery"
      to: "fetchPreview function"
      via: "conditional verse inclusion in query string"
      pattern: "localVerseStart.*localVerseEnd"
---

<objective>
Allow scripture preview (ESV link + preview button + fetch) when only book and chapter are filled in, without requiring verse start/end fields.

Purpose: Users often want to preview an entire chapter or don't yet know exact verses. Currently blocked until all 4 fields are filled.
Output: Updated ScriptureInput.vue with `canPreview` computed, updated tests.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/ScriptureInput.vue
@src/components/__tests__/ScriptureInput.test.ts
@src/utils/scripture.ts (esvLink takes book + chapter only, no verse args)
@src/utils/esvApi.ts (fetchPassageText accepts query string like "John 3" or "John 3:16-17")
</context>

<interfaces>
<!-- Key contracts the executor needs -->

From src/utils/scripture.ts:
```typescript
export function esvLink(book: string, chapter: number): string
// Already takes only book + chapter -- no change needed
```

From src/utils/esvApi.ts:
```typescript
export async function fetchPassageText(query: string): Promise<string>
// Accepts any ESV API query string: "John 3", "John 3:16-17", etc.
```

From src/types/service.ts:
```typescript
interface ScriptureRef {
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
}
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add canPreview computed and update preview/ESV gating</name>
  <files>src/components/ScriptureInput.vue, src/components/__tests__/ScriptureInput.test.ts</files>
  <behavior>
    - Test: ESV link visible when modelValue has only book + chapter (verseStart/verseEnd empty)
    - Test: Preview button visible when modelValue has only book + chapter
    - Test: passageQuery is "John 3" when book=John, chapter=3, no verses
    - Test: passageQuery is "John 3:16-17" when all 4 fields filled
    - Test: ESV link still visible when all 4 fields filled (existing behavior preserved)
    - Test: update:modelValue emits null when only book+chapter (isComplete unchanged)
  </behavior>
  <action>
In ScriptureInput.vue:

1. Add a `canPreview` computed after `isComplete`:
```typescript
const canPreview = computed(() => {
  return !!localBook.value && !!localChapter.value
})
```

2. Update `esvUrl` to use `canPreview` instead of `isComplete`:
```typescript
const esvUrl = computed(() => {
  if (!canPreview.value) return ''
  return esvLink(localBook.value as string, localChapter.value as number)
})
```

3. Update the template `v-if="isComplete"` on the ESV link `<a>` tag (line 48) to `v-if="canPreview"`.

4. Update `passageQuery` to use `canPreview` and conditionally include verses:
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

5. Update `showPreviewButton` to use `canPreview` instead of `isComplete`:
```typescript
const showPreviewButton = computed(() => canPreview.value && passageQuery.value !== previewRef.value)
```

6. Keep `isComplete` exactly as-is -- it still gates `currentRef` and the `update:modelValue` emit.

7. In `onFieldChange`, the existing `passageQuery.value !== previewRef.value` check will naturally clear preview when the query changes (e.g., user changes chapter after previewing), which is correct behavior.

In ScriptureInput.test.ts:

Add a new `describe('Preview with partial fields')` block with tests for the behaviors listed above. Mock esvApi's fetchPassageText to avoid real API calls (it's already not imported in current tests, but the new tests that check preview button visibility may need it).
  </action>
  <verify>
    <automated>cd /c/projects/worshipplanner && npx vitest run src/components/__tests__/ScriptureInput.test.ts</automated>
  </verify>
  <done>
    - canPreview computed exists, requires only book + chapter
    - ESV link and preview button appear with just book + chapter filled
    - passageQuery produces "Book Ch" without verses, "Book Ch:start-end" with verses
    - isComplete unchanged -- still requires all 4 fields for modelValue emit
    - All existing tests pass, new tests for partial-field preview pass
  </done>
</task>

</tasks>

<verification>
- `npx vitest run src/components/__tests__/ScriptureInput.test.ts` -- all tests pass
- `npx vue-tsc --noEmit` -- no type errors
- Manual: In the app, select a book and chapter without filling verses. ESV link and Preview button should appear. Clicking Preview should fetch the full chapter text.
</verification>

<success_criteria>
- Preview button and ESV link appear when only book + chapter are filled
- Preview fetches "Book Ch" (full chapter) when no verses specified
- Preview fetches "Book Ch:start-end" when verses are specified
- isComplete still requires all 4 fields (modelValue emit behavior unchanged)
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/9-allow-scripture-preview-with-book-and-ch/9-SUMMARY.md`
</output>
