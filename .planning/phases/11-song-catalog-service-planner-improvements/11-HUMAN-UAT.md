---
status: resolved
phase: 11-song-catalog-service-planner-improvements
source: [11-VERIFICATION.md]
started: 2026-07-01T12:00:00Z
updated: 2026-07-13
resolution: "user approved feature-complete 2026-07-13"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Drag a slot from position 1 to position 3 (snap-back, D-16)
expected: Slot remains at position 3 with no revert to original position.
result: [pending]

### 2. After a drag reorder, refresh the page within ~1 second (immediate persist, D-15)
expected: The new order persists across the page reload (proves immediate updateService call).
result: [pending]

### 3. Drag a slot then quickly click another slot or element (stuck-dirty, D-17)
expected: The save-button highlight clears on its own within ~3s (no stuck-dirty state).
result: [pending]

### 4. On a slot with an assigned song, click the red X delete button (delete confirm, D-14)
expected: A confirmation modal appears ("Remove this item?") with Cancel and Remove buttons.
result: [pending]

### 5. On an EMPTY slot, click the delete X (isSlotPopulated branch, D-14)
expected: Slot removes immediately with NO confirmation modal.
result: [pending]

### 6. Open a scripture slot preview, then click the close (x) on the preview panel (preview-close isolation, D-13)
expected: Only the preview panel closes; the slot is NOT deleted.
result: [pending]

### 7. Click each Songs-list column header — Title, Category, Key, CCLI, Last Used (all-column sort, D-07)
expected: Each header sorts ascending; clicking again flips to descending with an arrow indicator on the active column. Default load is Title ascending.
result: [pending]

### 8. Confirm each song row shows team (gray), theme (teal), and user (pink) pills (three-pill visual, D-06)
expected: Three pill colors are visually distinguishable; empty rows show an em-dash.
result: [pending]

### 9. Add user tag 'Christmas' in the editor form, save (form tag edit, D-04a)
expected: Tag persists and renders as a pink pill on the song-list row after save.
result: [pending]

### 10. Use inline '+' to add a tag and pill 'x' to remove one (inline tag edit, D-04b)
expected: Both inline add and inline remove persist across page reload.
result: [pending]

### 11. Select 2-3 songs via checkboxes; bulk-apply then bulk-remove 'Christmas' (bulk tag edit, D-04c)
expected: All selected songs gain then lose the 'Christmas' pink pill; selection clears after each action.
result: [pending]

### 12. Use 'Show only tag = Christmas' then 'Hide tag = Christmas' in the song list (list tag filter, D-03 list)
expected: Show-only leaves only tagged songs; Hide removes tagged songs; blank option restores all.
result: [pending]

### 13. Open the song picker on any slot and scroll past the initial list (IntersectionObserver batching, D-12)
expected: Picker loads beyond the first 50 songs in batches as you scroll; a "Showing X of Y" footer updates.
result: [pending]

### 14. Open a VW Type 1 slot picker; confirm Type 2/3 songs appear mixed in (type-agnostic, D-09/D-10)
expected: Songs of all types appear in rotation order; the VW badge is visible but songs are NOT sorted by type match.
result: [pending]

### 15. Confirm picker rows show gray team, teal theme, and pink user pills (picker pills, D-06 picker)
expected: Three visually-distinct pill types appear on rows that have data in each field.
result: [pending]

### 16. Use 'Show only tag' and 'Hide tag' selects in the picker header (picker tag filter, D-03 picker)
expected: Show-only shows only tagged songs in rotation + search; Hide removes them; filter is independent of the catalog-page tag filter.
result: [pending]

### 17. Trigger AI Picks on a slot with sermon context set (broad AI + hidden exclusion, D-11/D-18)
expected: Suggestions span multiple VW types; no hidden/soft-deleted songs appear; reason text reflects sermon themes.
result: [pending]

## Summary

total: 17
passed: 0
issues: 0
pending: 17
skipped: 0
blocked: 0

## Gaps
