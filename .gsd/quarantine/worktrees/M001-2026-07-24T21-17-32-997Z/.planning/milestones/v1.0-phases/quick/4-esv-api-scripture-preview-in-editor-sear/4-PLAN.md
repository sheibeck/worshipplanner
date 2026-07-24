---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/esvApi.ts
  - src/components/ScriptureInput.vue
autonomous: true
requirements: [ESV-PREVIEW]
must_haves:
  truths:
    - "Preview button appears when all scripture fields (book, chapter, verseStart, verseEnd) are filled"
    - "Clicking Preview fetches passage text from ESV API and displays it below the input fields"
    - "Preview text shows actual verse content so user can verify before committing"
    - "Loading state shown while fetch is in progress"
    - "Error state shown if ESV API call fails"
  artifacts:
    - path: "src/utils/esvApi.ts"
      provides: "ESV API fetch helper"
      exports: ["fetchPassageText"]
    - path: "src/components/ScriptureInput.vue"
      provides: "Preview button and expandable passage display"
  key_links:
    - from: "src/components/ScriptureInput.vue"
      to: "src/utils/esvApi.ts"
      via: "import fetchPassageText"
      pattern: "fetchPassageText"
    - from: "src/utils/esvApi.ts"
      to: "https://api.esv.org/v3/passage/text/"
      via: "fetch with Authorization header"
      pattern: "api\\.esv\\.org"
---

<objective>
Add ESV API scripture preview to the ScriptureInput component so users can see the actual passage text before committing to a scripture selection.

Purpose: Let worship planners verify they have the right passage (correct verses, correct scope) before locking it into a service slot.
Output: New `src/utils/esvApi.ts` service module + updated `ScriptureInput.vue` with preview button and text display.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/utils/scripture.ts
@src/components/ScriptureInput.vue
@src/types/service.ts

<interfaces>
From src/types/service.ts:
```typescript
export interface ScriptureRef {
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
}
```

From src/components/ScriptureInput.vue:
```typescript
// Props
const props = defineProps<{
  modelValue: ScriptureRef | null
  sermonPassage: ScriptureRef | null
  showOverlapWarning?: boolean
  label: string
}>()

// Existing computed
const isComplete = computed(() => {
  return !!localBook.value && !!localChapter.value && !!localVerseStart.value && !!localVerseEnd.value
})
```

From src/utils/scripture.ts:
```typescript
export const BIBLE_BOOKS: readonly string[]
export function esvLink(book: string, chapter: number): string
export function scripturesOverlap(reading: ScriptureRef, sermon: ScriptureRef): boolean
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create ESV API service module</name>
  <files>src/utils/esvApi.ts</files>
  <action>
Create `src/utils/esvApi.ts` with a single exported function:

```typescript
export async function fetchPassageText(query: string): Promise<string>
```

Implementation:
1. Build URL: `https://api.esv.org/v3/passage/text/?q=${encodeURIComponent(query)}` with these fixed query params appended:
   - `include-headings=false`
   - `include-footnotes=false`
   - `include-verse-numbers=true`
   - `include-short-copyright=false`
   - `include-passage-references=false`
2. Use native `fetch` with header: `Authorization: Token ${import.meta.env.VITE_ESV_API_KEY}`
3. If response is not ok, throw `new Error('Failed to fetch passage')`.
4. Parse JSON response. The shape is `{ passages: string[], ... }`. Return `passages[0]?.trim() ?? ''`.
5. If passages array is empty or first element is empty string after trim, return empty string (caller handles display).

The `query` parameter will be a formatted reference string like `"John 3:16-17"` or `"Psalms 23:1-6"` -- the caller builds this from ScriptureRef fields.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>src/utils/esvApi.ts exists, exports fetchPassageText, type-checks cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Add preview button and passage display to ScriptureInput</name>
  <files>src/components/ScriptureInput.vue</files>
  <action>
Modify `src/components/ScriptureInput.vue` to add a Preview button and passage text panel.

**Script setup additions:**

1. Import `fetchPassageText` from `@/utils/esvApi`.
2. Add three new refs:
   - `previewText = ref<string>('')` -- the fetched passage text
   - `previewLoading = ref(false)` -- loading spinner state
   - `previewError = ref<string>('')` -- error message
3. Add a `previewRef` ref to track which ScriptureRef the current preview corresponds to (so we can detect when fields change): `previewRef = ref<string>('')` (stores the query string that was fetched).
4. Add a computed `passageQuery` that builds the ESV query string from local fields:
   ```typescript
   const passageQuery = computed(() => {
     if (!isComplete.value) return ''
     return `${localBook.value} ${localChapter.value}:${localVerseStart.value}-${localVerseEnd.value}`
   })
   ```
5. Add computed `showPreviewButton`:
   ```typescript
   const showPreviewButton = computed(() => isComplete.value && passageQuery.value !== previewRef.value)
   ```
   This shows the button when fields are complete AND either no preview has been fetched yet, or the fields changed since last preview.
6. Add `fetchPreview` async function:
   ```typescript
   async function fetchPreview() {
     const query = passageQuery.value
     if (!query) return
     previewLoading.value = true
     previewError.value = ''
     previewText.value = ''
     try {
       const text = await fetchPassageText(query)
       previewText.value = text || 'No passage text found for this reference.'
       previewRef.value = query
     } catch {
       previewError.value = 'Could not load passage. Check your connection and try again.'
     } finally {
       previewLoading.value = false
     }
   }
   ```
7. Clear preview when fields change: in the existing `onFieldChange` function, add at the end:
   ```typescript
   if (passageQuery.value !== previewRef.value) {
     previewText.value = ''
     previewRef.value = ''
     previewError.value = ''
   }
   ```

**Template additions (insert between the ESV link `<a>` and the overlap warning `<div>`):**

8. Add Preview button -- shown when `showPreviewButton` is true OR `previewLoading` is true:
   ```html
   <button
     v-if="showPreviewButton || previewLoading"
     @click="fetchPreview"
     :disabled="previewLoading"
     type="button"
     class="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-wait"
   >
     <svg v-if="!previewLoading" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
       <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
       <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
     </svg>
     <svg v-else class="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
       <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
       <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
     </svg>
     {{ previewLoading ? 'Loading...' : 'Preview passage' }}
   </button>
   ```

9. Add passage text display panel -- shown when `previewText` is truthy:
   ```html
   <div
     v-if="previewText"
     class="text-sm text-gray-300 bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto"
   >
     {{ previewText }}
   </div>
   ```

10. Add error display -- shown when `previewError` is truthy:
    ```html
    <div
      v-if="previewError"
      class="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded px-2 py-1"
    >
      {{ previewError }}
    </div>
    ```

**Styling notes:**
- Preview button uses same `text-xs text-indigo-400` style as the existing "View on ESV.org" link for visual consistency.
- Passage panel uses `bg-gray-800/50` to sit subtly below the inputs (matches dark mode palette from project decisions).
- `max-h-48 overflow-y-auto` prevents long passages from blowing out the layout.
- `whitespace-pre-line` preserves verse line breaks from the ESV API response.
- Eye icon (heroicons outline eye) for the preview button; spinning circle for loading.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -30 && npx vitest run src/components/__tests__/ScriptureInput.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>ScriptureInput shows "Preview passage" button when all fields filled. Clicking it fetches and displays the ESV passage text in a panel below the inputs. Loading spinner shown during fetch. Error message shown on failure. Preview clears when fields change. Existing ScriptureInput tests still pass.</done>
</task>

</tasks>

<verification>
- `npx vue-tsc --noEmit` passes with no type errors
- `npx vitest run` passes all existing tests (ScriptureInput tests, scripture util tests)
- Visual: Fill in book/chapter/verse fields in any scripture input (sermon passage or reading slot) -- "Preview passage" button appears
- Visual: Click "Preview passage" -- spinner shows briefly, then actual ESV text appears in a gray panel
- Visual: Change a field after previewing -- preview text clears, button reappears
- Visual: Disconnect network and click Preview -- red error message appears
</verification>

<success_criteria>
1. `src/utils/esvApi.ts` exports `fetchPassageText` that calls ESV API with correct auth header and query params
2. ScriptureInput shows "Preview passage" button only when all four fields are filled
3. Clicking Preview fetches and displays the actual passage text from ESV API
4. Loading spinner shown during fetch, error message on failure
5. Preview clears when scripture fields are modified (prompting re-fetch)
6. All existing tests pass, no type errors
</success_criteria>

<output>
After completion, create `.planning/quick/4-esv-api-scripture-preview-in-editor-sear/4-SUMMARY.md`
</output>
