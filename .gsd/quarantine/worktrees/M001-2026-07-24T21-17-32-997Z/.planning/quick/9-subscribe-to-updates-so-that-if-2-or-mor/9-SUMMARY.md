---
phase: quick-9
plan: 01
subsystem: service-editor
tags: [real-time, firestore, collaboration, autosave]
dependency_graph:
  requires: []
  provides: [real-time-multi-user-service-editor]
  affects: [ServiceEditorView]
tech_stack:
  added: []
  patterns: [reactive-merge-guard, autosave-status-gate]
key_files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
decisions:
  - Remote updates are applied only when autosaveStatus is idle or saved — pending/saving states protect in-progress edits
  - autosaveInitialized is reset after remote merge to prevent a spurious dirty-detection trigger on the next local mutation
  - A JSON equality guard skips re-renders when the remote snapshot matches local state (e.g., immediately after our own save completes)
metrics:
  duration: "5 minutes"
  completed_date: "2026-03-12"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 9: Real-time remote update merge in ServiceEditorView

**One-liner:** Extend the Firestore store watcher to merge remote service changes into the editor's local state when the user is not actively editing (autosaveStatus idle or saved).

## What Was Done

The `ServiceEditorView` component deep-clones a service into `localService` on first load and previously never re-applied remote changes. This meant two people viewing the same service editor would not see each other's changes without refreshing.

The fix extends the existing `watch(() => serviceStore.services, ...)` watcher with an `else if` branch. When `localService` is already populated and a new snapshot arrives from Firestore:

- **idle / saved:** merge the remote snapshot into both `localService` and `originalService`, and reset `autosaveInitialized` to prevent a false autosave trigger.
- **pending / saving:** skip — the user is actively editing; their next save will win.
- A JSON equality guard short-circuits the merge when the remote state already matches local state (prevents spurious re-renders after our own saves arrive back via onSnapshot).

The `ServicesView` listing was already fully reactive via the Pinia store — no changes were made there.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Apply remote updates to localService when editor is idle | 8fbc35b | src/views/ServiceEditorView.vue |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without errors (`npx vue-tsc --noEmit` clean)
- Manual verification required: open same service editor in two tabs, confirm changes propagate within Firestore latency (~200-500ms) and that in-progress typing in one tab is not interrupted by updates from the other

## Self-Check: PASSED

- `src/views/ServiceEditorView.vue` modified: confirmed
- Commit 8fbc35b exists: confirmed
