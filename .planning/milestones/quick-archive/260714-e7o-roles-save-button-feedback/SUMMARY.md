---
quick_id: 260714-e7o
slug: roles-save-button-feedback
date: 2026-07-14
status: complete
commits:
  - 895af68
---

# Summary: Roles tab Save button feedback

## What changed
`src/components/RolesConfigPanel.vue`:
- **Per-role Save**: added `savingRoleId` / `savedRoleId` state. While the store write
  is in flight the button shows "Saving…" (disabled); on success it turns green and
  reads "Saved ✓" for ~1.8s, then reverts to "Save Role".
- **Add Role**: added a `roleAdded` flash — the button turns green "Added ✓" for ~1.8s
  after a role is created (on top of the existing field-clear).
- Timers cleared on `onUnmounted`.

## Verification
- `npm run build` (type-check + vite) — passes.

## Notes
- Both "Save Role" buttons (per-role edit and Add Role) now give unambiguous feedback,
  resolving "hard to tell it did anything."
