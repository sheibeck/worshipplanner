---
estimated_steps: 22
estimated_files: 2
skills_used: []
---

# T04: CongregationalEditor component with Leader and Congregation section assignment

**Why:** This delivers R009 (congregational reading mode). Responsive/liturgical readings need Leader and Congregation parts clearly labeled so the congregation knows when to read aloud.

**Do:**
1. Create `src/components/CongregationalEditor.vue`:
   - Props: `orgId: string`, `readingId?: string` (edit mode) or no readingId (create mode)
   - Same reference input and ESV fetch flow as ScriptureSlideEditor — reuse `parseScriptureInput` and `fetchPassageText`
   - After ESV text is fetched, call `splitPassage()` to get initial verse chunks
   - Section assignment UI: each verse chunk gets a toggle or dropdown to assign speaker role: `'LEADER'` or `'CONGREGATION'`. Default alternating pattern (first chunk = LEADER, second = CONGREGATION, etc.).
   - Preview panel: shows the reading with alternating styling — Leader text in one style (e.g. bold), Congregation text in another (e.g. normal weight, slightly indented). Both with speaker labels.
   - Merge/split controls: user can merge adjacent same-speaker sections or split a section at a verse boundary
   - When saved, set `readingMode: 'congregational'` on the ScriptureReading document and populate `congregationalSections` array with `{ speaker, text, verseRange }` entries
   - Auto-save via `useAutoSave` — same pattern as ScriptureSlideEditor
   - Dark-first Tailwind styling consistent with existing editor components

2. Create `src/components/__tests__/CongregationalEditor.test.ts`:
   - Mock `fetchPassageText`, `splitPassage`, `useAutoSave`, and `useScriptureSlides` store
   - Test: renders reference input and fetch button
   - Test: after fetch, displays verse chunks with speaker role toggles
   - Test: default alternating speaker assignment (LEADER, CONGREGATION, LEADER, ...)
   - Test: toggling speaker role updates section assignment
   - Test: preview shows Leader/Congregation labels with distinct styling
   - Test: saved data includes readingMode 'congregational' and congregationalSections array
   - Test: auto-save triggers on section changes

**Done-when:** `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` passes. Component allows speaker role assignment to verse chunks with preview and auto-save.

## Inputs

- `src/utils/scriptureSplitter.ts`
- `src/utils/esvApi.ts`
- `src/utils/scripture.ts`
- `src/composables/useAutoSave.ts`
- `src/stores/scriptureSlides.ts`
- `src/components/ScriptureSlideEditor.vue`
- `src/types/scriptureReading.ts`
- `src/types/slide.ts`

## Expected Output

- `src/components/CongregationalEditor.vue`
- `src/components/__tests__/CongregationalEditor.test.ts`

## Verification

npx vitest run src/components/__tests__/CongregationalEditor.test.ts
