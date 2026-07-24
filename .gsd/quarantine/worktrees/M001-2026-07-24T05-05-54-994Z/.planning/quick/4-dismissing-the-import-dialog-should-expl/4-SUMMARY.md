---
phase: quick-4
plan: 1
subsystem: PcImportModal
tags: [ux, modal, import, pc]
dependency_graph:
  requires: []
  provides: [pc-import-dialog-no-backdrop-dismiss]
  affects: [src/components/PcImportModal.vue]
tech_stack:
  added: []
  patterns: [explicit-close-only modal]
key_files:
  created: []
  modified:
    - src/components/PcImportModal.vue
decisions:
  - Backdrop and wrapper click handlers removed entirely; onClose function retained for X and Cancel buttons
metrics:
  duration: "~3 minutes"
  completed: "2026-03-12"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 4: Dismissing the Import Dialog Should Be Explicit — Summary

**One-liner:** Removed backdrop and wrapper @click handlers from PcImportModal so the multi-step PC import flow cannot be accidentally dismissed by clicking outside the panel.

## What Was Done

Removed two click-to-dismiss handlers from `PcImportModal.vue`:

1. `@click="onClose"` on the backdrop `div` (class `fixed inset-0 z-40 bg-black/60`) — deleted entirely.
2. `@click.self="onClose"` on the modal wrapper `div` (class `fixed inset-0 z-50 flex items-center justify-center p-4`) — deleted entirely.

The `onClose` function itself was not touched. It still guards against closing during `fetching` and `importing` states, and is still called by the X button (header) and Cancel button (footer). The Done button calls `onDoneClose` as before.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove backdrop and wrapper click-to-dismiss handlers | 614d41c | src/components/PcImportModal.vue |

## Verification

```
grep -n "@click" src/components/PcImportModal.vue
```

Output confirmed: only lines 42 (X button), 163 (Cancel), 174 (Import), 184 (Retry), 194 (Confirm Import), 204 (Done) — no backdrop or wrapper @click lines present.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- src/components/PcImportModal.vue modified: CONFIRMED
- Commit 614d41c exists: CONFIRMED
- No backdrop @click handler: CONFIRMED
- No wrapper @click.self handler: CONFIRMED
- Three explicit close paths remain (X, Cancel, Done): CONFIRMED
