# Quick Task 3: Auto-populate PC item metadata from last scheduled item

**Completed:** 2026-03-06
**Commits:** da3ace4, 4d3823c

## What was done

When exporting SONG slots to Planning Center, the system now carries forward metadata from the song's last scheduled item — replicating the behavior users see when linking songs directly in the PC UI.

### New functions

- **`fetchLastScheduledItem(appId, secret, pcSongId)`** — Calls `GET /songs/{id}/last_scheduled_item?include=item_notes` to retrieve the last item's length and all item notes (Person, Vocals, Livestream Sound, Sanctuary Sound, etc.)
- **`createItemNote(appId, secret, stId, planId, itemId, categoryId, content)`** — Posts an item note to a newly created item

### Updated flow in `addSlotAsItem` (SONG branch)

1. CCLI lookup finds PC song → fetch arrangements (existing)
2. **NEW:** Fetch last scheduled item for this PC song
3. **NEW:** Use the previous item's `length` when creating the new item
4. Create item with song + arrangement relationships (existing)
5. **NEW:** Copy each item note from the previous item to the new item (best-effort, per-note error swallowing)

### Also fixed in this session

- Added `song` relationship to `createItem` POST body (was only sending `arrangement`)
- Changed `item_type` decision from `arrangementId ? 'song'` to `pcSongId ? 'song'` — songs matched by CCLI are always `'song'` type even without arrangements

## Test coverage

13 new tests added (63 total in planningCenterApi.test.ts):
- `fetchLastScheduledItem`: success, null data, error, non-ItemNote filtering
- `createItemNote`: correct POST body, auth header, success/error
- `addSlotAsItem` integration: length copy, note copy, null history fallback, note failure resilience

## Files changed

- `src/utils/planningCenterApi.ts`
- `src/utils/__tests__/planningCenterApi.test.ts`
