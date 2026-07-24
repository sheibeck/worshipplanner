---
id: T05
parent: S02
milestone: M001
key_files:
  - src/views/ServiceEditorView.vue
  - src/types/service.ts
  - src/components/__tests__/ServiceScriptureIntegration.test.ts
key_decisions:
  - Added scriptureReadingId and readingMode as optional fields on ScriptureSlot (minimal S03 linkage prep, not full wiring)
  - Used expandedScriptureSlots Set keyed by slot index to independently track which scripture slots have editors open
  - Default readingMode to 'normal' when undefined for backward compatibility with existing ScriptureSlot data
duration: 
verification_result: passed
completed_at: 2026-07-24T14:14:07.506Z
blocker_discovered: false
---

# T05: Wired ScriptureSlideEditor and CongregationalEditor into ServiceEditorView with reading mode toggle and 16 passing integration tests

**Wired ScriptureSlideEditor and CongregationalEditor into ServiceEditorView with reading mode toggle and 16 passing integration tests**

## What Happened

Extended the SCRIPTURE slot template in ServiceEditorView to include an "Edit Scripture Slides" button that expands an inline editor panel. Added a reading mode toggle (Normal Reading / Congregational Reading) that switches between ScriptureSlideEditor and CongregationalEditor components. The toggle updates a `readingMode` field on the ScriptureSlot.

Key implementation details:
1. Added `scriptureReadingId` and `readingMode` optional fields to `ScriptureSlot` type in `src/types/service.ts` for S03 linkage readiness
2. Added `expandedScriptureSlots` Set state to track which scripture slots have their editor panel open
3. Added `getSlotReadingMode()` helper that defaults to 'normal' when readingMode is undefined
4. Added `setReadingMode()` that updates the slot's readingMode and triggers autosave via existing deep watcher
5. Editor panel only shows for editors, when not exported-locked, and when the scripture reference is populated
6. Both ScriptureSlideEditor and CongregationalEditor receive `orgId` and optional `readingId` props

Created 16 integration tests covering: button visibility (editor/viewer/locked/empty-ref), editor expansion/collapse, reading mode toggle switching, correct editor component rendering per mode, readingMode slot mutation, default mode fallback, scriptureReadingId passthrough, and orgId passthrough.

## Verification

Ran `npx vitest run src/components/__tests__/ServiceScriptureIntegration.test.ts` — 16/16 tests passed. Ran `npx vitest run` full suite — 944 passed, 1 failed (pre-existing RosterView test failure confirmed by stash-and-rerun).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/__tests__/ServiceScriptureIntegration.test.ts` | 0 | pass | 7713ms |
| 2 | `npx vitest run` | 0 | pass (1 pre-existing failure in RosterView unrelated to changes) | 113102ms |

## Deviations

none

## Known Issues

Pre-existing RosterView test failure (wraps Roles config in CollapsibleSection) — unrelated to this task, confirmed failing on clean branch.

## Files Created/Modified

- `src/views/ServiceEditorView.vue`
- `src/types/service.ts`
- `src/components/__tests__/ServiceScriptureIntegration.test.ts`
