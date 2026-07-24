---
estimated_steps: 22
estimated_files: 2
skills_used: []
---

# T03: ScriptureSlideEditor component with ESV fetch, auto-split preview, and auto-save

**Why:** This is the main user-facing deliverable for normal scripture slides (R008). A volunteer enters a scripture reference, sees the ESV text auto-fetched and split into slide-sized chunks, can manually override any slide, and edits auto-save.

**Do:**
1. Create `src/components/ScriptureSlideEditor.vue`:
   - Props: `orgId: string`, `readingId?: string` (edit mode) or no readingId (create mode)
   - Scripture reference input: reuse `parseScriptureInput` from `src/utils/scripture.ts` for parsing. Provide a text input with the same dark-first styling as ScriptureInput.vue (bg-gray-800, border-gray-700, text-gray-100).
   - "Fetch Passage" button: calls `fetchPassageText(query)` from `src/utils/esvApi.ts`, displays loading spinner during fetch
   - Auto-split preview: once ESV text is fetched, call `splitPassage()` from `src/utils/scriptureSplitter.ts` to generate slides. Display each slide chunk in a card with its verse range label.
   - Manual override: each slide card has an editable textarea so the user can adjust text. Edits mark the slide as manually overridden (so re-fetch doesn't clobber edits).
   - Auto-save: integrate `useAutoSave` from `src/composables/useAutoSave.ts` with 800ms debounce. On first fetch, call `createReading()` from the store. On subsequent edits, call `updateReading()`. Show save status indicator (idle/pending/saving/saved).
   - Error handling: show inline error if ESV fetch fails ("Could not load passage. Check your connection and try again.") following the pattern in ScriptureInput.vue.
   - Subscribe/unsubscribe in onMounted/onUnmounted when editing existing reading.

2. Create `src/components/__tests__/ScriptureSlideEditor.test.ts`:
   - Mock `fetchPassageText`, `splitPassage`, `useAutoSave`, and `useScriptureSlides` store
   - Test: renders reference input and fetch button
   - Test: entering valid reference enables fetch button
   - Test: clicking fetch calls fetchPassageText with correct query
   - Test: after fetch, displays split slides with verse range labels
   - Test: editing a slide textarea updates local state
   - Test: auto-save triggers on slide edits (useAutoSave called with save function)
   - Test: shows error message when ESV fetch fails
   - Test: shows save status indicator

**Done-when:** `npx vitest run src/components/__tests__/ScriptureSlideEditor.test.ts` passes. Component renders reference input, fetches ESV text, displays auto-split slides, allows manual override, and integrates auto-save.

## Inputs

- `src/utils/scriptureSplitter.ts`
- `src/utils/esvApi.ts`
- `src/utils/scripture.ts`
- `src/composables/useAutoSave.ts`
- `src/stores/scriptureSlides.ts`
- `src/components/ScriptureInput.vue`
- `src/components/SongLyricEditor.vue`
- `src/types/scriptureReading.ts`
- `src/types/slide.ts`

## Expected Output

- `src/components/ScriptureSlideEditor.vue`
- `src/components/__tests__/ScriptureSlideEditor.test.ts`

## Verification

npx vitest run src/components/__tests__/ScriptureSlideEditor.test.ts
