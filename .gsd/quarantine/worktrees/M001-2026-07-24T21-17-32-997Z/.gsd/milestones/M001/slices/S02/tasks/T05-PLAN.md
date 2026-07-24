---
estimated_steps: 17
estimated_files: 2
skills_used: []
---

# T05: Service editor integration and reading mode toggle

**Why:** Without wiring the new editors into the existing service editor UI, users have no way to access scripture slide creation. This task connects S02's editors to the existing ScriptureSlot UI in ServiceEditorView, completing the user-facing flow.

**Do:**
1. Extend `src/views/ServiceEditorView.vue` (or the component that renders ScriptureSlot entries):
   - When a ScriptureSlot is clicked/expanded, show an "Edit Scripture Slides" button that opens the ScriptureSlideEditor or CongregationalEditor
   - Add a reading mode toggle: "Normal Reading" vs "Congregational Reading" — switches between ScriptureSlideEditor and CongregationalEditor
   - The toggle sets `readingMode` on the ScriptureReading document
   - If a ScriptureSlot already has a `scriptureReadingId`, open the editor in edit mode. If not, open in create mode.
   - After creating a new reading, the slot can optionally store the `scriptureReadingId` for S03 linkage (add the field to ScriptureSlot type if not present — but note this is primarily S03's job, so keep the wiring minimal)

2. Create or extend tests:
   - `src/components/__tests__/ServiceScriptureIntegration.test.ts` (or add to existing ServiceEditorView tests if they exist)
   - Test: ScriptureSlot renders "Edit Scripture Slides" button
   - Test: clicking toggle switches between Normal and Congregational editor
   - Test: reading mode toggle emits correct readingMode value
   - Test: renders ScriptureSlideEditor when mode is 'normal'
   - Test: renders CongregationalEditor when mode is 'congregational'

3. Run full test suite to verify no regressions.

**Done-when:** `npx vitest run src/components/__tests__/ServiceScriptureIntegration.test.ts` passes. The reading mode toggle and editor launch points are wired into the service editor UI. `npx vitest run` full suite passes with no regressions.

## Inputs

- `src/views/ServiceEditorView.vue`
- `src/components/ScriptureSlideEditor.vue`
- `src/components/CongregationalEditor.vue`
- `src/components/ScriptureInput.vue`
- `src/stores/scriptureSlides.ts`
- `src/types/service.ts`
- `src/types/scriptureReading.ts`

## Expected Output

- `src/components/__tests__/ServiceScriptureIntegration.test.ts`

## Verification

npx vitest run src/components/__tests__/ServiceScriptureIntegration.test.ts && npx vitest run
