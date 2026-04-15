# Phase 10: Export Naming, Template Replace, PC Teams, Orchestra Filter — Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Four incremental improvements to PC integration quality and song suggestion accuracy:
1. **Export naming** — prefix all song/hymn item titles with "Worship Song - " in PC API export
2. **Template replace** — when exporting to an existing PC plan, replace matching placeholder items (delete + recreate) instead of appending alongside them; delete unmatched placeholders
3. **PC Teams in export dialog** — show PC team list as checkboxes in the export dialog; add selected teams to the plan on export
4. **Orchestra filter** — when Orchestra is a service team, show all songs in the picker but surface orchestra-tagged songs first (scoring + visual dimming for non-orchestra); filter AI song suggestions to orchestra-tagged songs only

Out of scope: general song tagging changes, PC sync, reverse import of PC plans into WorshipPlanner.
</domain>

<decisions>
## Implementation Decisions

### 1. Export Naming
- **Change:** Prepend `"Worship Song - "` to the item title for all SONG and HYMN slots when creating PC items via the API export
- **Scope:** API export only (`addSlotAsItem` in `planningCenterApi.ts`) — the "Copy for PC" clipboard text (`planningCenterExport.ts`) is NOT changed
- **SONG example:** slot.songTitle `"I Believe"` → PC item title `"Worship Song - I Believe"`
- **HYMN example:** `"Holy, Holy, Holy #1 (vv. 1-3)"` → `"Worship Song - Holy, Holy, Holy #1 (vv. 1-3)"`
- **All slots:** Applies to all song positions — worship songs (1-4) AND sending song — no differentiation by slot position

### 2. Existing Plan: Replace Instead of Append
- **Current behavior:** `addSlotAsItem` calls `createItem` (POST) even for placeholder matches, leaving the old placeholder intact alongside the new item
- **New behavior:** When a matching placeholder is found in the existing PC plan, DELETE that placeholder item and CREATE the new item at the same sequence number
- **Matching rules (unchanged):** `title.toLowerCase().includes('worship song')` → song placeholder; `title.toLowerCase().includes('scripture reading')` → scripture placeholder
- **Unmatched placeholders:** Any "Worship Song" or "Scripture Reading" placeholder that didn't get matched to a WorshipPlanner slot → DELETE from PC plan (do not leave behind)
- **Leftover slots:** WorshipPlanner slots that have no matching placeholder in the PC plan → append at end (current behavior, unchanged)
- **New API needed:** `deleteItem(appId, secret, serviceTypeId, planId, itemId)` — `DELETE /service_types/{stId}/plans/{planId}/items/{itemId}` — add to `planningCenterApi.ts`

### 3. PC Teams in Export Dialog
- **What:** Fetch PC Teams for the selected service type and display as checkboxes in the export dialog
- **PC API:** Researcher to confirm exact endpoint — likely `GET /service_types/{stId}/teams` (returns team id + name)
- **Default pre-selection:** Auto-check any PC team whose name case-insensitively matches a WorshipPlanner service team name (e.g., service has "Orchestra" → PC "Orchestra" team auto-checked)
- **New plan export:** Add all checked teams to the newly created plan
- **Existing plan export:** Fetch teams already on the plan, only add checked teams not already present (no duplicates)
- **PC API for adding team to plan:** Researcher to confirm — may be `POST /service_types/{stId}/plans/{planId}/plan_people` with team relationship or a dedicated team-scheduling endpoint
- **PC API for fetching plan's existing teams:** Researcher to confirm — likely `GET /service_types/{stId}/plans/{planId}/plan_times` or a plan relationship
- **Failure handling:** Team-add failures are non-fatal (log, don't block export completion) — consistent with existing partial failure tolerance

### 4. Orchestra Filter for Song Suggestions
- **Scoring change in `rankSongsForSlot`:** When `serviceTeams.includes('Orchestra')`:
  - Remove the current AND-logic hard filter (non-orchestra songs were excluded entirely)
  - Instead: add a `+200` scoring bonus for songs that have `teamTags.includes('Orchestra')` (they float to the top)
  - Non-orchestra songs still appear in the list (needed for e.g. sending song) but score lower
- **Visual treatment in `SongSlotPicker.vue`:** When Orchestra is in `serviceTeams`:
  - Non-orchestra songs rendered with reduced opacity (e.g., `opacity-50` or `text-gray-500`) to de-emphasize them
  - Orchestra-tagged songs render at full brightness (normal style)
  - Applies to both "By Rotation" suggestions AND search results
- **AI suggestion filtering in `claudeApi.ts`:** When `serviceTeams.includes('Orchestra')` (caller passes serviceTeams to the AI function), filter `songLibrary` to only include songs where `song.teamTags.includes('Orchestra')` before building the prompt — AI only sees and suggests orchestra-eligible songs
- **Applies to all slots equally** — no special treatment for sending song vs worship song slots (same behavior)

### Claude's Discretion
- Exact sequence number strategy for delete + recreate (fetch existing items first, use same sequence value before delete, or use position index)
- Whether to fetch plan's existing teams via a separate API call or include with plan fetch
- Visual dimming implementation detail (opacity class, text color, or both)
- Export dialog layout for the Teams section (placement relative to service type / plan selection)
- How to pass `serviceTeams` into the existing `getAiSongSuggestions` call chain

</decisions>

<specifics>
## Specific Details

- The "Worship Song - " prefix is a literal string — no VW type label (not "Call to Worship - " or "Intimate - "), just the generic "Worship Song - " prefix for all song slots
- The PC Teams list is fetched fresh when the export dialog opens (alongside service types and templates) — not cached
- The orchestra scoring bonus is `+200` so it clearly outranks the type bonus (`+100`) and even the "never used" bonus (`+500` for truly new songs stays highest, but orchestra songs always appear above non-orchestra songs of comparable usage)
- The `deleteItem` API function needs to be added to `planningCenterApi.ts` (it's a simple DELETE with no body, just auth header)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `planningCenterApi.ts:addSlotAsItem` — SONG/HYMN title construction to modify for "Worship Song - " prefix
- `planningCenterApi.ts:updateItem` — exists but insufficient for song replacement (no relationship support); use delete + createItem instead
- `planningCenterApi.ts:createItem`, `fetchPlanItems` — used in existing plan flow
- `suggestions.ts:rankSongsForSlot` — scoring function to modify with orchestra bonus
- `SongSlotPicker.vue:suggestions computed` — passes `serviceTeams` already; add visual dimming on render
- `SongSlotPicker.vue:searchResults computed` — needs orchestra-first sorting when Orchestra in serviceTeams
- `claudeApi.ts:getAiSongSuggestions` — `songLibrary` param to filter before passing in
- `ServiceEditorView.vue:onConfirmExport` (~line 1549) — existing plan branch to rewrite; export dialog to extend with Teams section

### Integration Points
- `ServiceEditorView.vue`: Add Teams fetch + checkboxes to export dialog; rewrite existing plan replace logic
- `planningCenterApi.ts`: Add `deleteItem()`, add `fetchServiceTypeTeams()`, add team-add-to-plan function (researcher to confirm endpoint name)
- `suggestions.ts`: Modify `rankSongsForSlot` signature or behavior to accept orchestra context
- `SongSlotPicker.vue`: Add visual dimming for non-orchestra songs when Orchestra in serviceTeams
- `claudeApi.ts` (or call site): Filter songLibrary to orchestra-tagged songs when Orchestra in serviceTeams

### Pattern Notes
- PC API partial failure pattern: failures are collected and reported at the end, never abort the whole export
- Dark mode palette: `text-gray-500` / `opacity-50` for de-emphasized items
- Existing export dialog uses `exportLoading` state while fetching service types + templates — extend to also fetch Teams in that same loading phase

</code_context>

<canonical_refs>
## Canonical References

- `src/utils/planningCenterApi.ts` — PC API client (createItem, updateItem, addSlotAsItem, fetchPlanItems)
- `src/utils/planningCenterExport.ts` — "Copy for PC" text formatter (NOT changing in this phase)
- `src/utils/suggestions.ts` — rankSongsForSlot scoring logic
- `src/utils/claudeApi.ts` — AI song suggestion prompt builder
- `src/components/SongSlotPicker.vue` — song picker dropdown with AI + rotation suggestions
- `src/views/ServiceEditorView.vue` — export dialog and onConfirmExport handler

</canonical_refs>

<deferred>
## Deferred Ideas

None — all four areas discussed stayed within phase scope.

</deferred>

---

*Phase: 10-worship-song-export-naming-template-import-improvements-auto*
*Context gathered: 2026-04-15*
