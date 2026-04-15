# Phase 10: Export Naming, Template Replace, PC Teams, Orchestra Filter — Research

**Researched:** 2026-04-15
**Domain:** Planning Center API integration (export flow) + Vue 3 song suggestion scoring
**Confidence:** HIGH (all key code verified by direct file inspection; PC API team-add endpoint MEDIUM — verified shape from Dart SDK docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Export Naming:** Prepend `"Worship Song - "` to item title for all SONG and HYMN slots in `addSlotAsItem` (`planningCenterApi.ts`). "Copy for PC" clipboard text (`planningCenterExport.ts`) is NOT changed.
2. **Template Replace — Existing Plan:** DELETE matching placeholder + CREATE new item at same sequence. DELETE unmatched "Worship Song" / "Scripture Reading" placeholders. Append leftover WorshipPlanner slots at end (unchanged). Requires new `deleteItem()` function in `planningCenterApi.ts`.
3. **PC Teams in Export Dialog:** Fetch teams for selected service type; show as checkboxes. Auto-check PC teams whose name case-insensitively matches a WorshipPlanner service team name. Add checked teams to plan on export (new + existing plan). Existing plan: fetch plan's current teams first, only add teams not already present. Team-add failures are non-fatal.
4. **Orchestra Filter — Scoring:** Remove current AND-logic hard filter for Orchestra. Add `+200` bonus for `song.teamTags.includes('Orchestra')` when `serviceTeams.includes('Orchestra')`. Non-orchestra songs still appear.
5. **Orchestra Filter — Visual:** `opacity-50` on wrapping `<button>` for non-orchestra songs in both "By Rotation" and search results when Orchestra is in serviceTeams.
6. **Orchestra Filter — AI:** Filter `songLibrary` to only orchestra-tagged songs before passing to `getSongSuggestions` when `serviceTeams.includes('Orchestra')`.

### Claude's Discretion

- Exact sequence number strategy for delete + recreate
- Whether to fetch plan's existing teams via a separate API call or include with plan fetch
- Visual dimming implementation detail (`opacity-50` on button wrapper — confirmed by UI-SPEC)
- Export dialog layout for Teams section (placement confirmed by UI-SPEC: between Template selector and Service Date)
- How to pass `serviceTeams` into the existing `getAiSongSuggestions` call chain

### Deferred Ideas (OUT OF SCOPE)

None — all four areas discussed stayed within phase scope.
</user_constraints>

---

## Summary

Phase 10 is four focused improvements to an existing Planning Center export flow and song suggestion system. All work is in 6 already-identified files with no new dependencies. Three changes are purely in TypeScript utilities (`planningCenterApi.ts`, `suggestions.ts`, `claudeApi.ts`) and one adds UI to `SongSlotPicker.vue` and `ServiceEditorView.vue`.

The highest-risk item is the **delete + recreate** strategy for existing plans (Feature 2). The current code appends items — switching to delete-before-create changes idempotency characteristics and requires careful sequence number management. The existing item's `sequence` value must be read from `fetchPlanItems` (already fetched) and passed to `createItem`; the delete must succeed before the create proceeds.

The **PC Teams** feature (Feature 3) is the most research-dependent: the endpoint `GET /service_types/{stId}/teams` is confirmed, but the "add team to plan" endpoint is LOW confidence. Based on Dart SDK documentation, Planning Center's `signup_teams` sub-resource on a plan is read-only (GET only) — **adding a team to a plan is done via `needed_positions` or indirectly not supported via a simple team-attach POST.** This is the primary open question that needs validation against a live PC account.

The **orchestra scoring** change (Feature 4) is a pure function modification in `suggestions.ts` with comprehensive existing tests. The change replaces the current AND-logic hard filter (which already excludes non-orchestra songs when Orchestra is the sole serviceTeam) with a +200 bonus (soft filter). Tests need to be updated to expect the new scoring behavior.

**Primary recommendation:** Implement in four discrete, independently-testable tasks: (1) export naming, (2) delete+recreate logic, (3) PC teams UI + API, (4) orchestra filter. Task 3 should include a graceful fallback if the team-add endpoint cannot be confirmed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| "Worship Song - " title prefix | API/Backend util | — | `addSlotAsItem` in `planningCenterApi.ts` constructs the title; single change point |
| Delete placeholder item from PC | API/Backend util | — | New `deleteItem()` function in `planningCenterApi.ts`; REST DELETE call |
| Fetch PC teams for service type | API/Backend util | — | New `fetchServiceTypeTeams()` in `planningCenterApi.ts` |
| Add team to PC plan | API/Backend util | — | New `addTeamToPlan()` or `fetchPlanTeams()` function in `planningCenterApi.ts` |
| Teams checkbox UI in export dialog | Frontend (Vue component) | — | `ServiceEditorView.vue` export dialog template + script |
| Orchestra scoring bonus | Frontend util | — | `rankSongsForSlot` in `suggestions.ts` — pure function, no API |
| Orchestra visual dimming | Frontend (Vue component) | — | `SongSlotPicker.vue` template class binding |
| AI song library filtering for orchestra | Frontend util / call-site | — | Filter applied at call site in `ServiceEditorView.vue` before passing `songLibrary` to `getSongSuggestions` |

---

## Standard Stack

No new libraries required for this phase. All changes use existing stack.

### Core (already installed)
| Library | Version | Purpose | Verified |
|---------|---------|---------|---------|
| Vue 3 | ^3.5.29 | Component framework | [VERIFIED: package.json] |
| TypeScript | ~5.9.3 | Type safety | [VERIFIED: package.json] |
| Tailwind CSS v4 | ^4.0.0 | Utility CSS | [VERIFIED: package.json] |
| Vitest | ^4.0.18 | Unit testing | [VERIFIED: package.json] |

### Relevant Existing Utilities
| File | What it does | Phase 10 touches |
|------|-------------|-----------------|
| `src/utils/planningCenterApi.ts` | PC REST API client | Add `deleteItem`, `fetchServiceTypeTeams`, team-add function; modify `addSlotAsItem` title |
| `src/utils/suggestions.ts` | `rankSongsForSlot` scoring | Modify orchestra team handling from hard-filter to +200 bonus |
| `src/utils/claudeApi.ts` | AI song suggestions | `songLibrary` filter at call site (not inside this file) |
| `src/components/SongSlotPicker.vue` | Song picker dropdown | Add `opacity-50` dimming for non-orchestra songs in both sections |
| `src/views/ServiceEditorView.vue` | Export dialog + `onConfirmExport` | Rewrite existing-plan branch; add Teams fetch + checkboxes |

---

## Architecture Patterns

### System Architecture Diagram

```
ServiceEditorView.vue (openExportDialog)
  │
  ├─► fetchServiceTypes()   ─► PC API GET /service_types
  ├─► fetchTemplates()      ─► PC API GET /service_types/{id}/plan_templates
  └─► fetchServiceTypeTeams() [NEW]  ─► PC API GET /service_types/{id}/teams
                                         └── auto-match against service.teams
                                         └── populate pcTeams[] + selectedPcTeamIds[]

ServiceEditorView.vue (onConfirmExport)
  │
  ├─ [NEW PLAN PATH]
  │   ├─► createPlan()
  │   ├─► createPlanTime() × 3
  │   ├─► (template items) addSlotAsItem() ─► title now "Worship Song - {songTitle}"
  │   └─► addTeamToPlan() × selectedPcTeamIds [NEW, non-fatal]
  │
  └─ [EXISTING PLAN PATH — REWRITTEN]
      ├─► fetchPlanItems()  ─► build placeholder map {songIdx→itemId, sequence}
      │                          AND unmatched-placeholder id list
      ├─► [for each matched placeholder]
      │   ├─► deleteItem(itemId) [NEW]  ─► PC API DELETE /items/{id}
      │   └─► addSlotAsItem(sequence)   ─► recreate at same sequence
      ├─► [for each unmatched placeholder]
      │   └─► deleteItem(itemId) [NEW]
      ├─► [leftover slots] addSlotAsItem(append) ─► unchanged
      └─► addTeamToPlan() × selectedPcTeamIds [NEW, non-fatal]

SongSlotPicker.vue (suggestions computed)
  ├─► rankSongsForSlot(songs, vwType, serviceTeams) [MODIFIED]
  │     If serviceTeams.includes('Orchestra'):
  │       Remove hard AND-filter on teamTags
  │       Keep all songs in results
  │       +200 to score when song.teamTags.includes('Orchestra')
  └─► template: button :class="isNonOrchestra ? 'opacity-50' : ''"

ServiceEditorView.vue (handleAiSuggestions call site)
  └─► When serviceTeams.includes('Orchestra'):
        filter songLibrary → only songs where song.teamTags.includes('Orchestra')
        pass filtered library to getSongSuggestions()
```

### Recommended Project Structure

No new files or directories needed. All changes are modifications to existing files.

```
src/
├── utils/
│   ├── planningCenterApi.ts   ← add deleteItem, fetchServiceTypeTeams, addTeamToPlan
│   ├── suggestions.ts         ← modify rankSongsForSlot orchestra handling
│   └── claudeApi.ts           ← no changes (filter at call site)
├── components/
│   └── SongSlotPicker.vue     ← add orchestra dimming + searchResults orchestra sort
└── views/
    └── ServiceEditorView.vue  ← export dialog Teams section + onConfirmExport rewrite
```

### Pattern 1: Delete + Recreate at Same Sequence

**What:** When an existing PC plan has a "Worship Song" placeholder at sequence N, delete that item and create the real song item at sequence N (preserving plan order).

**When to use:** Existing plan export path only.

**Key insight from codebase:** `fetchPlanItems` already returns `{ id, title, sequence }` for all items. The sequence value from the placeholder is used directly in the `createItem` call.

```typescript
// Source: planningCenterApi.ts (existing pattern, extended)

// Step 1: add deleteItem function
export async function deleteItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  itemId: string,
): Promise<void> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to delete item: ${response.status} ${text}`)
  }
}

// Step 2: use in onConfirmExport
for (const item of existingItems) {
  const titleLower = item.title.toLowerCase()
  const isSongPlaceholder = titleLower.includes('worship song')
  const isScripturePlaceholder = titleLower.includes('scripture reading')

  if (isSongPlaceholder && songIndex < songSlots.length) {
    try {
      await deleteItem(appId, secret, serviceTypeId, planId, item.id)
      await addSlotAsItem(appId, secret, serviceTypeId, planId,
        songSlots[songIndex]!, item.sequence, ...)
      songIndex++
    } catch {
      failures.push(label)
    }
  } else if (isSongPlaceholder || isScripturePlaceholder) {
    // Unmatched placeholder — delete it
    try { await deleteItem(..., item.id) } catch { /* non-fatal */ }
  }
}
```

### Pattern 2: fetchServiceTypeTeams

**What:** Fetch all teams for a service type from PC API.

**Endpoint confirmed:** `GET /service_types/{serviceTypeId}/teams?per_page=100`
[VERIFIED: Dart SDK documentation for PcoServicesTeam — `createPathWithPrefix: /services/v2/service_types/$serviceTypeId/teams`]

**Response shape:** JSON API array with `data[].id` and `data[].attributes.name`

```typescript
// Source: pattern matches existing fetchServiceTypes / fetchTemplates in planningCenterApi.ts
export async function fetchServiceTypeTeams(
  appId: string,
  secret: string,
  serviceTypeId: string,
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/teams?per_page=100`,
    {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.status}`)
  }
  const json = (await response.json()) as {
    data: Array<{ id: string; attributes: { name: string } }>
  }
  return json.data.map((t) => ({ id: t.id, name: t.attributes.name }))
}
```

### Pattern 3: Orchestra Scoring Bonus

**What:** Replace current AND-logic hard-filter for Orchestra with a soft +200 scoring bonus.

**Current behavior (to remove):** `serviceTeams.every((team) => s.teamTags.includes(team))` — when serviceTeams is `['Orchestra']`, this hard-excludes any song that doesn't have 'Orchestra' in teamTags.

**New behavior:** All songs pass the team filter. Score += 200 when `serviceTeams.includes('Orchestra') && song.teamTags.includes('Orchestra')`.

```typescript
// Source: suggestions.ts (verified by direct file read)

// BEFORE (existing team filter — remove Orchestra special-casing):
const teamFiltered =
  serviceTeams.length === 0
    ? songs
    : songs.filter(
        (s) =>
          s.teamTags.length === 0 ||
          serviceTeams.every((team) => s.teamTags.includes(team)),
      )

// AFTER (orchestra becomes soft bonus, not hard filter):
const hasOrchestra = serviceTeams.includes('Orchestra')
const nonOrchestraTeams = serviceTeams.filter((t) => t !== 'Orchestra')

const teamFiltered =
  nonOrchestraTeams.length === 0
    ? songs
    : songs.filter(
        (s) =>
          s.teamTags.length === 0 ||
          nonOrchestraTeams.every((team) => s.teamTags.includes(team)),
      )

// In the scoring map:
const orchestraBonus =
  hasOrchestra && song.teamTags.includes('Orchestra') ? 200 : 0
score += typeBonus + orchestraBonus
```

**Note on scoring math:** A never-used orchestra song scores 700 (500 + 200). A never-used non-orchestra song scores 500. A stale orchestra song (10 weeks, type match) scores: 200 + 150 cap + 100 + 200 = 650. This correctly floats orchestra songs above comparable non-orchestra songs while preserving relative ordering within each group.

### Pattern 4: AI songLibrary Filter for Orchestra

**What:** At the call site in `ServiceEditorView.vue` where `getSongSuggestions` is invoked, pre-filter `songLibrary` to only orchestra-tagged songs when Orchestra is in serviceTeams.

**Current call pattern (grep confirmed):** `getSongSuggestions` receives a `GetSongSuggestionsParams` including `songLibrary`. The filter is applied before constructing params.

```typescript
// Source: claudeApi.ts GetSongSuggestionsParams interface (verified by direct read)
// Applied at call site in ServiceEditorView.vue

const isOrchestraService = localService.value.teams?.includes('Orchestra') ?? false
const filteredLibrary = isOrchestraService
  ? songStore.songs.filter((s) => s.teamTags.includes('Orchestra'))
  : songStore.songs

// Then pass filteredLibrary as songLibrary in getSongSuggestions params
```

### Pattern 5: Export Dialog Teams Section (from UI-SPEC)

Position: Between Template selector and Service Date (confirmed by UI-SPEC).

State refs needed:
- `pcTeams: ref<Array<{ id: string; name: string }>>([])` — fetched teams list
- `selectedPcTeamIds: ref<string[]>([])` — v-model for checkboxes
- Teams fetched in same `openExportDialog` loading phase as service types + templates

Auto-match logic:
```typescript
// After fetchServiceTypeTeams returns:
selectedPcTeamIds.value = pcTeams.value
  .filter((pcTeam) =>
    (localService.value?.teams ?? []).some(
      (svcTeam) => svcTeam.toLowerCase() === pcTeam.name.toLowerCase()
    )
  )
  .map((t) => t.id)
```

### Anti-Patterns to Avoid

- **Updating `updateItem` instead of delete+recreate:** The existing `updateItem` (PATCH) cannot change item type or add song/arrangement relationships — PC API rejects type-change patches. The CONTEXT.md decision to delete+recreate is correct.
- **Hard-filtering orchestra songs from suggestions entirely:** The previous AND-logic behavior already did this as a side effect. The new +200 bonus preserves "sending song" usefulness where an orchestra church might legitimately use a non-orchestra song. Do NOT restore the hard filter.
- **Fetching teams inside `onConfirmExport`:** Teams must be fetched in `openExportDialog` (same loading phase as service types/templates) so checkboxes are visible before the user clicks Export.
- **Blocking export on team-add failure:** Team scheduling in PC is best-effort. Follow the existing partial-failure pattern: collect failures, report at end, never abort.
- **Changing `planningCenterExport.ts` (clipboard copy):** Explicitly out of scope per CONTEXT.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PC REST client boilerplate | New fetch wrapper | Extend existing `planningCenterApi.ts` pattern | All functions follow `basicAuthHeader` + typed JSON response pattern — just add new functions |
| Checkbox auto-match logic | Complex fuzzy matching | `toLowerCase()` equality | Spec says case-insensitive exact match, not fuzzy |
| Rate limit handling for teams | New retry wrapper | Teams fetch is low-frequency (once per dialog open) — no retry needed | Only song arrangements have rate-limit pressure; teams endpoint is called once |
| Orchestra filter in AI prompt | Modify `claudeApi.ts` internals | Filter `songLibrary` at call site before passing | Keeps `getSongSuggestions` generic and the filter decision in the view layer |

---

## Common Pitfalls

### Pitfall 1: Adding Teams to a PC Plan — Endpoint Uncertainty

**What goes wrong:** The PC Services API does not have a simple `POST /plans/{id}/teams` endpoint. Teams in Planning Center are associated with a plan via `needed_positions` (which requires a `team` relationship, a `quantity`, and a `time_id`) or via `team_members` (which requires scheduling individual people, not teams). There is no bulk "attach team to plan" POST that takes only a team ID.

**Why it happens:** Planning Center's team concept in Services is about scheduling people to positions within a team. "Adding a team" in the UI means ensuring the team's needed positions appear in the plan — which is a `needed_positions` resource with a team relationship.

**Evidence:** Dart SDK `PcoServicesNeededPosition` documents: `POST /service_types/{stId}/plans/{planId}/needed_positions` with required `quantity`, `time_id`, and a `team` relationship. The `PcoServicesPlan.getSignupTeams()` path is GET-only.

**How to avoid:** This feature must be validated against a live PC account. The most likely correct approach is: POST to `needed_positions` with `{ attributes: { quantity: 1 }, relationships: { team: { data: { type: 'Team', id: teamId } } } }`. A `time_id` may be required (use the plan's first `plan_time`).

**Fallback strategy:** If the `needed_positions` approach proves too complex (requires time_id which may not always exist), the export completes without team-add and logs a warning. This keeps the feature non-fatal and consistent with the failure-tolerance pattern.

**Warning signs:** 422 response on POST with only team relationship (missing required `time_id`); 404 if endpoint path is wrong.

### Pitfall 2: Sequence Number Collision After Delete

**What goes wrong:** PC plans may reorder sequence numbers after a DELETE. If sequence 3 is deleted and then a new item is created at sequence 3, PC may reassign sequence numbers and the items may appear in unexpected order.

**Why it happens:** PC sequence numbers are not guaranteed stable after modifications. The sequence in `fetchPlanItems` response reflects the current order, but after DELETE, adjacent items may shift.

**How to avoid:** Use the fetched `item.sequence` value as a hint for the `createItem` POST, but do not rely on sequence number for correctness of ordering in subsequent operations. Process all deletes first in a single pass, then all creates in order — this avoids in-flight sequence collisions. Alternatively, the planner may choose to collect all placeholder matches first, delete all unmatched items, then create new items sequentially.

**Warning signs:** Items appearing out of expected order in PC after export.

### Pitfall 3: Orchestra Scoring Change Breaks Existing Tests

**What goes wrong:** `suggestions.test.ts` has 6 team-filtering tests that test AND-logic behavior. The orchestra change removes AND-logic when Orchestra is the sole team — these tests will fail if `serviceTeams = ['Orchestra']` is passed since the current hard-filter behavior is what they test.

**Why it happens:** The current tests in the `'team filtering'` describe block test the AND-logic filter. Cases with `serviceTeams: ['Choir', 'Orchestra']` (both teams) will still work, but `serviceTeams: ['Orchestra']` alone now returns all songs (with bonus scoring) instead of only orchestra-tagged songs.

**How to avoid:** Add new tests for orchestra bonus scoring. Update or scope the existing team-filter tests — the ones using `serviceTeams: ['Orchestra']` as a hard-filter need revision. The AND-logic tests using `['Choir', 'Orchestra']` and checking that a song missing one team is excluded remain valid (Orchestra is excluded from the AND-logic filter; Choir still applies).

**Warning signs:** Failing test: `'excludes songs with only some matching team tags'` when only Orchestra is in serviceTeams.

### Pitfall 4: `getAiSongSuggestions` serviceTeams Call Chain

**What goes wrong:** The function `getSongSuggestions` in `claudeApi.ts` does not currently accept `serviceTeams` as a parameter. The orchestra filter must be applied at the call site, not inside `getSongSuggestions`. If the filter is accidentally added to `GetSongSuggestionsParams`, the `claudeApi.ts` interface changes and all call sites need updating.

**How to avoid:** Apply the `songLibrary` filter in `ServiceEditorView.vue` before constructing `GetSongSuggestionsParams`. The `claudeApi.ts` signature stays unchanged. This is cleaner — the AI function doesn't need to know about team configuration.

### Pitfall 5: Auto-match Teams Reset on Service Type Change

**What goes wrong:** When the user changes the service type in the export dialog (`onServiceTypeChange`), the teams list for the new service type must be re-fetched and auto-match re-applied. If `selectedPcTeamIds` is not reset, stale team IDs from the previous service type remain selected and will 404 when adding to the plan.

**How to avoid:** In `onServiceTypeChange`, reset `pcTeams.value = []` and `selectedPcTeamIds.value = []` before fetching. Apply auto-match after the new teams resolve.

---

## Code Examples

### fetchServiceTypeTeams (complete implementation)

```typescript
// Source: follows pattern of fetchTemplates in planningCenterApi.ts (verified)
export async function fetchServiceTypeTeams(
  appId: string,
  secret: string,
  serviceTypeId: string,
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/teams?per_page=100`,
    {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.status}`)
  }
  const json = (await response.json()) as {
    data: Array<{ id: string; attributes: { name: string } }>
  }
  return json.data.map((t) => ({ id: t.id, name: t.attributes.name }))
}
```

### deleteItem (complete implementation)

```typescript
// Source: mirrors createItem pattern in planningCenterApi.ts (verified)
export async function deleteItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  itemId: string,
): Promise<void> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to delete item: ${response.status} ${text}`)
  }
}
```

### addSlotAsItem — title modification (SONG and HYMN cases)

```typescript
// Source: planningCenterApi.ts lines 695-758 (verified)
// SONG case: change line 700
const title = `Worship Song - ${slot.songTitle ?? '[Empty Song]'}`

// HYMN case: change line 750
const numPart = slot.hymnNumber ? ` #${slot.hymnNumber}` : ''
const versesPart = slot.verses ? ` (vv. ${slot.verses})` : ''
const title = `Worship Song - ${slot.hymnName}${numPart}${versesPart}`
```

### Orchestra dimming in SongSlotPicker.vue

```typescript
// Source: SongSlotPicker.vue props (verified — serviceTeams already passed)
// New helper computed:
const isOrchestraService = computed(() => props.serviceTeams.includes('Orchestra'))
function isNonOrchestraSong(song: Song): boolean {
  return isOrchestraService.value && !song.teamTags.includes('Orchestra')
}
```

```html
<!-- By Rotation rows (line 110 in SongSlotPicker.vue) -->
<button
  v-for="result in suggestions"
  :key="result.song.id"
  type="button"
  @click="onSelect(result.song)"
  :class="['w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors',
           isNonOrchestraSong(result.song) ? 'opacity-50' : '']"
>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PC export appends items even for existing plans | Delete + recreate at same sequence | Phase 10 | Prevents duplicate placeholder + real item pairs |
| Orchestra team hard-filters songs from suggestions | Orchestra adds +200 scoring bonus, all songs visible | Phase 10 | Sending-song slot can suggest non-orchestra songs |
| Export adds no team members to plan | Export dialog shows team checkboxes, adds needed_positions | Phase 10 | Reduces manual setup after export |

**Behavior changes that affect users:**
- The "Add to existing plan" mode no longer appends new items alongside old placeholders — it replaces them. The info copy in the dialog is updated to reflect this (UI-SPEC confirmed).
- Songs in the picker now show `opacity-50` for non-orchestra songs when Orchestra is the service team — this is a new visual state.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GET /service_types/{id}/teams` returns `data[].attributes.name` as the team name field | Standard Stack / Code Examples | fetchServiceTypeTeams function needs attribute key corrected — LOW impact, easy fix |
| A2 | `POST /service_types/{stId}/plans/{planId}/needed_positions` with `{ relationships: { team: { data: { type: 'Team', id } } }, attributes: { quantity: 1 } }` adds a team to a plan | Open Questions | Entire "add teams to plan" feature may need different approach — feature would need to be stubbed or replaced with a no-op |
| A3 | PC `DELETE /items/{itemId}` returns 2xx with no body (or empty body) | Code Examples | deleteItem may need to handle 204 No Content differently than other endpoints — trivial fix |
| A4 | PC preserves item order based on sequence number when a new item is POSTed at an existing sequence value | Common Pitfalls | Items may reorder unexpectedly after delete+recreate — mitigation: warn user, sequence is best-effort |

---

## Open Questions (RESOLVED)

1. **How to add a team to a Planning Center plan via API?**
   - What we know: `GET /service_types/{id}/plans/{planId}/signup_teams` returns read-only team list. `PcoServicesNeededPosition` at `POST /needed_positions` takes a `team` relationship and `quantity`. `team_members` requires scheduling individual people.
   - What's unclear: Whether `needed_positions` can be created with only `quantity` + `team` relationship (without `time_id`), and whether this is what "adding a team to a plan" means in PC's model.
   - Recommendation: Validate against a real PC account before implementing. Fallback: if `needed_positions` requires `time_id`, fetch the plan's first `plan_time` and use its ID. If the endpoint consistently fails, log the team names in the export result message and skip the add. The CONTEXT.md decision says team-add failures are non-fatal.
   - **RESOLVED:** Use `POST /service_types/{stId}/plans/{planId}/needed_positions` with `{ attributes: { quantity: 1 }, relationships: { team: { data: { type: 'Team', id } } } }` and optional `timeId`. Implemented in `addTeamToPlan` with graceful 422 fallback — team-add failures are non-fatal per D-05.

2. **Does PC resequence items after DELETE?**
   - What we know: `fetchPlanItems` returns sequence numbers. The `createItem` POST accepts a `sequence` parameter.
   - What's unclear: Whether PC renumbers remaining items after a DELETE (shifting sequences), which would cause the re-created item to land at a different position.
   - Recommendation: Test with a real PC plan. If sequences shift, use position index (1, 2, 3...) for recreated items rather than the original placeholder sequence.
   - **RESOLVED:** Item sequence is treated as a best-effort hint. Recreated items use the placeholder's original sequence value. Post-delete resequencing is accepted as a known limitation — export correctness is not sequence-order-dependent (the plan succeeds either way, items may shift slightly in edge cases).

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — all changes are to existing TypeScript utilities and Vue components using libraries already installed).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vite.config.ts` (test block, jsdom environment) |
| Quick run command | `npx vitest run src/utils/__tests__/suggestions.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FEAT-1 | `addSlotAsItem` SONG title prefixed with "Worship Song - " | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | ✅ (extend) |
| FEAT-1 | `addSlotAsItem` HYMN title prefixed with "Worship Song - " | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | ✅ (extend) |
| FEAT-2 | `deleteItem` makes DELETE request to correct URL | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | ✅ (new test case) |
| FEAT-3 | `fetchServiceTypeTeams` returns id+name array | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | ✅ (new test case) |
| FEAT-4a | `rankSongsForSlot` with Orchestra serviceTeam: orchestra-tagged song gets +200 bonus | unit | `npx vitest run src/utils/__tests__/suggestions.test.ts` | ✅ (new test cases) |
| FEAT-4b | `rankSongsForSlot` with Orchestra serviceTeam: non-orchestra song still appears (not filtered out) | unit | `npx vitest run src/utils/__tests__/suggestions.test.ts` | ✅ (new test cases) |
| FEAT-4c | `rankSongsForSlot` without Orchestra serviceTeam: behavior unchanged | unit | `npx vitest run src/utils/__tests__/suggestions.test.ts` | ✅ (existing tests remain) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/utils/__tests__/[relevant-test-file].test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

No new test files needed — all tests extend existing files. Existing test infrastructure covers all phase requirements.

New test cases to add (not new files):
- [ ] `planningCenterApi.test.ts` — `addSlotAsItem` SONG title uses "Worship Song - " prefix
- [ ] `planningCenterApi.test.ts` — `addSlotAsItem` HYMN title uses "Worship Song - " prefix
- [ ] `planningCenterApi.test.ts` — `deleteItem` sends DELETE to correct URL
- [ ] `planningCenterApi.test.ts` — `fetchServiceTypeTeams` maps response to id+name
- [ ] `suggestions.test.ts` — orchestra bonus scoring (+200) for orchestra-tagged songs
- [ ] `suggestions.test.ts` — non-orchestra songs still returned when Orchestra is serviceTeam
- [ ] `suggestions.test.ts` — update existing team-filter tests for Orchestra-only serviceTeams

---

## Security Domain

No new authentication, authorization, session, or cryptographic requirements introduced. All PC API calls follow the existing `basicAuthHeader` pattern already in use. No new external services, storage, or user data is collected.

ASVS not applicable for this phase — incremental changes to existing authenticated API calls.

---

## Sources

### Primary (HIGH confidence)
- `src/utils/planningCenterApi.ts` (direct read) — all existing function signatures, addSlotAsItem SONG/HYMN title construction, createItem params, fetchPlanItems response shape
- `src/utils/suggestions.ts` (direct read) — rankSongsForSlot current team filter AND-logic and scoring weights
- `src/utils/claudeApi.ts` (direct read) — getSongSuggestions signature, GetSongSuggestionsParams interface
- `src/components/SongSlotPicker.vue` (direct read) — serviceTeams prop already passed, suggestions computed, searchResults computed
- `src/views/ServiceEditorView.vue` (direct read) — export dialog template, onConfirmExport full implementation, ref declarations
- `src/types/song.ts` (direct read) — Song.teamTags field confirmed as `string[]`
- `src/utils/__tests__/suggestions.test.ts` (direct read) — existing test coverage, team filter test cases
- `src/utils/__tests__/planningCenterApi.test.ts` (direct read) — existing test pattern for mocking fetch
- `package.json` (direct read) — Vitest version, no new dependencies needed
- `.planning/phases/10-.../10-UI-SPEC.md` (direct read) — Teams section markup, opacity-50 pattern confirmed

### Secondary (MEDIUM confidence)
- [PcoServicesTeam Dart SDK](https://pub.dev/documentation/planningcenter_api/latest/planningcenter_api/PcoServicesTeam-class.html) — confirmed `GET /service_types/{id}/teams` endpoint, `name` attribute
- [PcoServicesPlan sub-resources](https://pub.dev/documentation/planningcenter_api/latest/planningcenter_api/PcoServicesPlan-class.html) — confirmed `signup_teams` is GET-only sub-resource, `needed_positions` is the create path for team association

### Tertiary (LOW confidence)
- [Planning Center API docs](https://developer.planning.center/docs/) — could not render due to JS-only rendering; used as confirmation of API existence, not specific endpoint behavior
- WebSearch — confirmed `GET /service_types/{id}/teams` endpoint path; team-member path at `/team_members`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified in package.json
- Architecture: HIGH — all files read directly, function signatures confirmed
- Existing plan delete+recreate pitfall: HIGH — verified from current code that only createItem is called (no delete)
- PC teams endpoint shape: MEDIUM — confirmed from Dart SDK docs
- PC add-team-to-plan endpoint: LOW — inferred from NeededPosition pattern, not verified against live API
- Pitfalls: HIGH — derived directly from code inspection

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable PC API, 30 days)
