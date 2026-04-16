---
quick_id: 260416-dd1
plan: 01
subsystem: song-picker
tags: [ux, song-picker, team-tags, dropdown]
key_files:
  modified:
    - src/components/SongSlotPicker.vue
decisions:
  - Sliced rotation list to 15 (not unlimited) to bound render cost on large libraries
  - TeamTagPill added to both By Rotation and Search Results rows; AI Picks left unchanged per scope
metrics:
  duration: ~5 minutes
  completed: 2026-04-16
---

# Quick 260416-dd1: Song Picker Improvements Summary

**One-liner:** Expanded song picker dropdown to 600px, raised rotation list cap from 5 to 15, and added TeamTagPill team-tag display to rotation and search-result rows.

## Changes Made

### Task 1: Expand dropdown panel height and increase rotation slice

**File:** `src/components/SongSlotPicker.vue`

1. **Panel height** — `max-h-80` (320px) → `max-h-[600px]` on the dropdown `<div>` (line 36).
2. **Positioning constant** — `const maxH = 320` → `const maxH = 600` inside `openDropdown()` so the flip-above / cap-to-available-space logic stays consistent with the new CSS cap.
3. **Rotation slice** — `results.slice(0, 5)` → `results.slice(0, 15)` in the `suggestions` computed property.

### Task 2: Render team tags on rotation and search-result rows

**File:** `src/components/SongSlotPicker.vue`

1. Imported `TeamTagPill` from `@/components/TeamTagPill.vue` alongside `SongBadge`.
2. Added a `v-if="result.song.teamTags.length > 0"` tag pill block (`flex flex-wrap gap-1 mt-1`) inside the `By Rotation` button rows, after the key + last-used line.
3. Added the same pattern to `Search Results` button rows, after the key span.
4. AI Picks rows are unchanged.

## Verification

- `npm run type-check` — passed (no errors)
- `npx vitest run` — 426/426 tests passed, 20 test files

## Deviations from Plan

None — plan executed exactly as written.

## Visual Verification Needed

Open a service with a SONG slot, click the picker, and confirm:
- Dropdown is noticeably taller (~600px when viewport allows)
- By Rotation list shows up to 15 songs
- Team tag pills appear below key/last-used on rotation and search rows
- Songs with no tags show no pill row
- SongBadge (VW type) still renders on the right
- AI Picks section unchanged
- Short-viewport flip/cap behavior still works

## Commit

`8f90d50` — feat: expand song picker height and show song tags in rotation list

## Self-Check: PASSED

- `src/components/SongSlotPicker.vue` confirmed modified with all four changes
- Commit `8f90d50` exists in git log
- Type check: clean
- Tests: 426/426 passing
