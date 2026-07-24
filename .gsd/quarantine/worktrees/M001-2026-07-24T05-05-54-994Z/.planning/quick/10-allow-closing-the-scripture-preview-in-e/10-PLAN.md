---
phase: quick-10
plan: 10
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ScriptureInput.vue
  - src/components/__tests__/ScriptureInput.test.ts
autonomous: true
requirements:
  - QUICK-10
must_haves:
  truths:
    - "After previewing a scripture passage, the user can dismiss the preview panel"
    - "Clicking the close button hides the passage text and re-shows the 'Preview passage' button"
  artifacts:
    - path: "src/components/ScriptureInput.vue"
      provides: "Close button on the passage text panel"
      contains: "dismissPreview"
  key_links:
    - from: "close button (×)"
      to: "previewText / previewRef refs"
      via: "dismissPreview() sets both to empty string"
      pattern: "dismissPreview"
---

<objective>
Add a close/dismiss button to the scripture passage preview panel in ScriptureInput.vue so users can close the preview after reading it without having to clear or change the input field.

Purpose: The preview panel currently has no way to be dismissed — once opened it occupies space until the user edits the reference. This is a UX annoyance in the edit-mode service editor.
Output: ScriptureInput.vue with a close button on the previewText panel; test covering the dismiss behavior.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add dismiss button to the passage preview panel</name>
  <files>src/components/ScriptureInput.vue</files>
  <action>
In the `<template>` section, find the "Passage text panel" div (the `v-if="previewText"` div around line 161).

Wrap the existing layout into a flex container with `justify-between items-start gap-2`. Place the passage text in a `flex-1` wrapper, and add a close button to the right of it.

The close button should:
- Be `type="button"` (prevent form submit)
- Call `dismissPreview()` on click
- Use an `×` (× entity) or an SVG `X` icon styled to match the project's gray palette (`text-gray-500 hover:text-gray-300`)
- Have `aria-label="Close preview"` for accessibility
- Be small (`text-xs` or `h-4 w-4` icon), aligned to the top of the panel

Add a `dismissPreview()` function in the `<script setup>` section that resets the three preview refs:
```ts
function dismissPreview() {
  previewText.value = ''
  previewRef.value = ''
  previewError.value = ''
}
```

After dismissing, `showPreviewButton` will automatically become `true` again (its computed value depends on `previewRef !== passageQuery`), so the "Preview passage" button re-appears — no extra logic needed.

Do NOT change any other behavior (ESV link, parse logic, AI suggest, etc.).
  </action>
  <verify>
    <automated>npm run build -- --noEmit 2>&1 | tail -5</automated>
  </verify>
  <done>The previewText panel has a visible close button. Clicking it clears the panel and re-shows the "Preview passage" button. TypeScript compiles cleanly.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Test — close button dismisses the preview panel</name>
  <files>src/components/__tests__/ScriptureInput.test.ts</files>
  <behavior>
    - After fetchPreview resolves, the preview text is visible and a close button exists
    - Clicking the close button removes the preview text from the DOM
    - After closing, the "Preview passage" button is visible again
  </behavior>
  <action>
Add a new `describe('Preview dismiss', ...)` block to the existing test file. The existing `fetchPassageText` mock already resolves to `'Mocked passage text'`.

Test steps:
1. Mount with `modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 }` so the preview button is visible.
2. Find and click the "Preview passage" button (`wrapper.find('button', { text: /Preview passage/ })` or find by text content).
3. `await nextTick()` and `await flushPromises()` to let the async fetch resolve.
4. Assert `wrapper.text()` contains `'Mocked passage text'`.
5. Find the close button (`aria-label="Close preview"`) and click it.
6. `await nextTick()`.
7. Assert `wrapper.text()` does NOT contain `'Mocked passage text'`.
8. Assert `wrapper.text()` contains `'Preview passage'` (button re-appears).

Import `flushPromises` from `@vue/test-utils` and `nextTick` from `vue`.
  </action>
  <verify>
    <automated>npx vitest run src/components/__tests__/ScriptureInput.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>All tests in ScriptureInput.test.ts pass, including the new "Preview dismiss" block.</done>
</task>

</tasks>

<verification>
- `npx vitest run src/components/__tests__/ScriptureInput.test.ts` — all tests pass
- `npm run build -- --noEmit` (or `npx tsc --noEmit`) — no TypeScript errors
- Manual: open a service in edit mode, type a valid passage, click "Preview passage", read text, click × — panel disappears and "Preview passage" button returns
</verification>

<success_criteria>
- Close button (×) appears in the top-right corner of the passage preview panel
- Clicking it resets previewText/previewRef/previewError so the panel disappears
- The "Preview passage" button re-appears after dismissal
- No regressions in existing ScriptureInput tests
</success_criteria>

<output>
After completion, create `.planning/quick/10-allow-closing-the-scripture-preview-in-e/10-SUMMARY.md`
</output>
