---
phase: quick-4
plan: "01"
subsystem: scripture-input
tags: [esv-api, preview, scripture, component]
dependency_graph:
  requires: []
  provides: [esv-passage-preview]
  affects: [ScriptureInput, ServiceEditorView]
tech_stack:
  added: []
  patterns: [native-fetch-with-auth, computed-derived-query, ref-state-for-async]
key_files:
  created:
    - src/utils/esvApi.ts
  modified:
    - src/components/ScriptureInput.vue
decisions:
  - "esvApi.ts is a thin fetch wrapper with no caching — preview is on-demand only"
  - "showPreviewButton uses query-string comparison (not field watchers) to detect stale previews"
  - "onFieldChange clears preview state synchronously so stale text never lingers"
metrics:
  duration_minutes: 10
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_changed: 2
---

# Quick Task 4: ESV API Scripture Preview in Editor Summary

**One-liner:** ESV API preview button in ScriptureInput fetches passage text via VITE_ESV_API_KEY with loading, error, and stale-detection states.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create ESV API service module | 87ee4f9 | src/utils/esvApi.ts |
| 2 | Add preview button and passage display to ScriptureInput | b3318cf | src/components/ScriptureInput.vue |

## What Was Built

**src/utils/esvApi.ts** — Single-function module that calls `https://api.esv.org/v3/passage/text/` with the configured query params (no headings, no footnotes, verse numbers on, no copyright). Uses `VITE_ESV_API_KEY` in the Authorization header. Returns `passages[0].trim()` or empty string; throws on non-ok response.

**ScriptureInput.vue additions:**
- `passageQuery` computed builds query string (`Book Ch:Start-End`) from local refs
- `showPreviewButton` shows button when fields are complete AND query differs from last fetched ref
- `fetchPreview` async handler manages loading/error/text state
- `onFieldChange` extended to clear preview state when any field changes after a fetch
- Preview button (eye icon / spinner) with `text-xs text-indigo-400` matching ESV link style
- Passage text panel: `bg-gray-800/50 border-gray-700 max-h-48 overflow-y-auto whitespace-pre-line`
- Error panel: `text-red-400 bg-red-950/50 border-red-800/50`

## Verification

- `npx vue-tsc --noEmit` passes with no errors
- `npx vitest run src/components/__tests__/ScriptureInput.test.ts` — 6/6 tests pass

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- src/utils/esvApi.ts: FOUND
- src/components/ScriptureInput.vue: FOUND (modified)
- Commit 87ee4f9: FOUND
- Commit b3318cf: FOUND
