---
quick_id: 260714-e7o
slug: roles-save-button-feedback
date: 2026-07-14
status: complete
---

# Quick Task: Roles tab Save button feedback

## Problem
On the Volunteers → Roles tab (`RolesConfigPanel.vue`), clicking "Save Role" awaits
`updateRole` but gives no visual feedback — you can't tell anything happened.

## Solution
Add a transient state machine to the Save buttons:
- Per-role Save: while awaiting → "Saving…" (disabled); on success → "Saved ✓" green
  for ~1.8s, then back to "Save Role".
- Add Role: on success (fields already clear) → flash "Added ✓" green for ~1.8s.

Track `savingRoleId`, `savedRoleId`, and `roleAdded` refs with cleared timers.

## Files
- `src/components/RolesConfigPanel.vue`

## Verification
- `npm run type-check` + `npm run build-only` pass.

## Commits
1. Roles Save button feedback
