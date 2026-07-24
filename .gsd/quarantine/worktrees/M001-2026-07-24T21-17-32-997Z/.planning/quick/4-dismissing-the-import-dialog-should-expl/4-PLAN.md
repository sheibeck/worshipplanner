---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/PcImportModal.vue
autonomous: true
requirements:
  - QUICK-4
must_haves:
  truths:
    - Clicking the backdrop does not close the dialog
    - Clicking the modal wrapper area outside the panel does not close the dialog
    - The X button and Cancel button still close the dialog
    - The Done button still closes the dialog after a completed import
    - In-progress states (fetching, importing) still cannot be closed
  artifacts:
    - path: src/components/PcImportModal.vue
      provides: PC import dialog without backdrop dismiss
  key_links:
    - from: backdrop div
      to: onClose
      via: "@click handler — REMOVED"
    - from: modal wrapper div
      to: onClose
      via: "@click.self handler — REMOVED"
---

<objective>
Prevent accidental dismissal of the PC import dialog when clicking outside the panel.

Purpose: The multi-step import flow (idle -> fetching -> preview -> importing -> done) loses all progress if the user accidentally clicks outside the dialog. Explicit close actions (X button, Cancel, Done) are the only safe dismiss paths.
Output: PcImportModal.vue with backdrop and wrapper click handlers removed.
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
  <name>Task 1: Remove backdrop and wrapper click-to-dismiss handlers</name>
  <files>src/components/PcImportModal.vue</files>
  <action>
    In src/components/PcImportModal.vue, remove the two click handlers that dismiss the dialog on outside clicks:

    1. On the backdrop div (the `div` with `class="fixed inset-0 z-40 bg-black/60"`): remove `@click="onClose"` entirely.

    2. On the modal wrapper div (the `div` with `class="fixed inset-0 z-50 flex items-center justify-center p-4"`): remove `@click.self="onClose"` entirely.

    Do NOT touch:
    - The X button's `@click="onClose"` in the header (explicit close — keep)
    - The Cancel button's `@click="onClose"` in the footer (explicit close — keep)
    - The Done button's `@click="onDoneClose"` in the footer (explicit close — keep)
    - The `onClose` function itself and its fetching/importing guard (still needed for X and Cancel)
    - All other template markup, script logic, transitions, and styles

    After the change, the backdrop div should have no click handler at all. The modal wrapper div should have no click handler at all — it is purely a flex centering container.
  </action>
  <verify>
    <automated>grep -n "@click" src/components/PcImportModal.vue</automated>
    Expected output: only lines referencing the X button, Cancel button, and Done button click handlers — no backdrop or wrapper @click lines remain.
  </verify>
  <done>
    Clicking anywhere on the backdrop or the area outside the dialog panel does nothing. The X button, Cancel button, and Done button still dismiss the dialog. In-progress states cannot be closed via any outside click.
  </done>
</task>

</tasks>

<verification>
Run `grep -n "@click" src/components/PcImportModal.vue` and confirm:
- No `@click="onClose"` on the backdrop div
- No `@click.self="onClose"` on the wrapper div
- Three explicit close triggers remain: X button, Cancel button, Done button
</verification>

<success_criteria>
PcImportModal.vue has backdrop and wrapper click handlers removed. All explicit close buttons remain functional. The import flow cannot be accidentally dismissed by clicking outside.
</success_criteria>

<output>
After completion, create `.planning/quick/4-dismissing-the-import-dialog-should-expl/4-SUMMARY.md`
</output>
