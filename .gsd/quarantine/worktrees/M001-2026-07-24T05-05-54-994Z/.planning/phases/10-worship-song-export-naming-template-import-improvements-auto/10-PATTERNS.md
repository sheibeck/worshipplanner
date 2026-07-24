# Phase 10: Export Naming, Template Replace, PC Teams, Orchestra Filter — Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 5 modified files (no new files)
**Analogs found:** 5 / 5 (all modifications target existing files with strong self-referential patterns)

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/utils/planningCenterApi.ts` | utility (API client) | request-response | Self — existing `fetchTemplates`, `createItem`, `updateItem` functions | exact |
| `src/utils/suggestions.ts` | utility (pure function) | transform | Self — existing `rankSongsForSlot` scoring logic | exact |
| `src/views/ServiceEditorView.vue` | view (orchestrator) | request-response + CRUD | Self — existing `onExportToPC`, `onConfirmExport`, export dialog refs/template | exact |
| `src/components/SongSlotPicker.vue` | component | request-response | Self — existing `suggestions` computed + button template rows | exact |
| `src/utils/__tests__/planningCenterApi.test.ts` | test | — | Self — existing `fetchTemplates`, `createItem` test blocks | exact |
| `src/utils/__tests__/suggestions.test.ts` | test | — | Self — existing `'team filtering'` and `'scoring'` describe blocks | exact |

---

## Pattern Assignments

### `src/utils/planningCenterApi.ts` — Four changes

#### Change 1: `addSlotAsItem` — Title prefix for SONG and HYMN slots

**Analog:** Lines 695–758 of the same file — the existing `addSlotAsItem` SONG and HYMN branches.

**Current SONG title construction** (line 700):
```typescript
const title = slot.songTitle ?? '[Empty Song]'
```

**New SONG title construction** — prefix with `"Worship Song - "`:
```typescript
const title = `Worship Song - ${slot.songTitle ?? '[Empty Song]'}`
```

**Current HYMN title construction** (lines 749–751):
```typescript
const numPart = slot.hymnNumber ? ` #${slot.hymnNumber}` : ''
const versesPart = slot.verses ? ` (vv. ${slot.verses})` : ''
const title = `${slot.hymnName}${numPart}${versesPart}`
```

**New HYMN title construction** — prefix with `"Worship Song - "`:
```typescript
const numPart = slot.hymnNumber ? ` #${slot.hymnNumber}` : ''
const versesPart = slot.verses ? ` (vv. ${slot.verses})` : ''
const title = `Worship Song - ${slot.hymnName}${numPart}${versesPart}`
```

---

#### Change 2: New `deleteItem` function

**Analog:** `updateItem` (lines 415–466) — same URL pattern, same auth header, same error-with-text pattern; except DELETE has no request body and no response body to parse.

**Copy pattern from `updateItem`** (lines 443–465):
```typescript
const response = await fetch(
  `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}`,
  {
    method: 'PATCH',
    headers: {
      Authorization: basicAuthHeader(appId, secret),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ... }),
  },
)

if (!response.ok) {
  const text = await response.text()
  throw new Error(`Failed to update item: ${response.status} ${text}`)
}
```

**New `deleteItem` — same URL, method `DELETE`, no body, no response body:**
```typescript
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

**Placement:** Add after `updateItem` (after line 466), before `searchSongByCcli`.

---

#### Change 3: New `fetchServiceTypeTeams` function

**Analog:** `fetchTemplates` (lines 78–99) — identical shape: GET with `?per_page=100`, same auth header, same JSON:API `data[].attributes.name` mapping, same error throw pattern.

**Copy pattern from `fetchTemplates`** (lines 78–99):
```typescript
export async function fetchTemplates(
  appId: string,
  secret: string,
  serviceTypeId: string,
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plan_templates?per_page=100`,
    {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.status}`)
  }
  const json = (await response.json()) as {
    data: Array<{ id: string; attributes: { name: string } }>
  }
  return json.data.map((t) => ({ id: t.id, name: t.attributes.name }))
}
```

**New `fetchServiceTypeTeams` — same structure, different URL path:**
```typescript
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

**Placement:** Add after `fetchTemplates` (after line 99), before `fetchPlans`.

---

#### Change 4: New `addTeamToPlan` function (needed_positions endpoint)

**Analog:** `createPlan` (lines 198–226) — POST with JSON:API body, returns created resource ID, same auth + Content-Type headers, same error-with-text pattern.

**Copy pattern from `createPlan`** (lines 204–225):
```typescript
const response = await fetch(`${PC_BASE_URL}/service_types/${serviceTypeId}/plans`, {
  method: 'POST',
  headers: {
    Authorization: basicAuthHeader(appId, secret),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: {
      type: 'Plan',
      attributes: { title },
    },
  }),
})

if (!response.ok) {
  const text = await response.text()
  throw new Error(`Failed to create plan: ${response.status} ${text}`)
}
```

**New `addTeamToPlan` — POST to needed_positions with team relationship:**
```typescript
export async function addTeamToPlan(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  teamId: string,
  timeId?: string,
): Promise<void> {
  const relationships: Record<string, unknown> = {
    team: { data: { type: 'Team', id: teamId } },
  }
  if (timeId) {
    relationships.time = { data: { type: 'PlanTime', id: timeId } }
  }

  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/needed_positions`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'NeededPosition',
          attributes: { quantity: 1 },
          relationships,
        },
      }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to add team to plan: ${response.status} ${text}`)
  }
}
```

**Note:** This endpoint is MEDIUM confidence (see RESEARCH.md Pitfall 1). Callers must wrap in `try/catch` with non-fatal handling (see Shared Patterns: Partial Failure Tolerance below).

---

### `src/utils/suggestions.ts` — Orchestra scoring change

**Analog:** Lines 36–43 (team filter) and lines 58–68 (scoring map) of the same file.

**Current team filter block** (lines 36–43 — the AND-logic to modify):
```typescript
const teamFiltered =
  serviceTeams.length === 0
    ? songs
    : songs.filter(
        (s) =>
          s.teamTags.length === 0 ||
          serviceTeams.every((team) => s.teamTags.includes(team)),
      )
```

**Current scoring** (lines 66–68 — where orchestra bonus inserts):
```typescript
// Type bonus: matching VW type gets +100 (soft priority, not a hard filter)
const typeBonus = song.vwTypes.includes(requiredVwType) ? 100 : 0
score += typeBonus
```

**New team filter block — extract Orchestra out of AND-logic:**
```typescript
// Orchestra is a soft-bonus team, not a hard-filter team
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
```

**New scoring lines — add orchestraBonus after typeBonus:**
```typescript
// Type bonus: matching VW type gets +100 (soft priority, not a hard filter)
const typeBonus = song.vwTypes.includes(requiredVwType) ? 100 : 0
// Orchestra bonus: +200 when service is orchestra and song is orchestra-tagged
const orchestraBonus = hasOrchestra && song.teamTags.includes('Orchestra') ? 200 : 0
score += typeBonus + orchestraBonus
```

**JSDoc update** — update the `@param serviceTeams` line (line 21) to reflect the new behavior:
```typescript
 * @param serviceTeams - Active teams for this service. Orchestra uses soft +200 bonus;
 *                       all other teams use AND-logic hard filter.
```

---

### `src/views/ServiceEditorView.vue` — Three changes

#### Change 1: Export dialog ref declarations

**Analog:** Lines 886–893 (existing export dialog `ref` declarations).

**Current state block** (lines 886–893):
```typescript
const showExportDialog = ref(false)
const exportServiceTypes = ref<Array<{ id: string; name: string }>>([])
const exportTemplates = ref<Array<{ id: string; name: string }>>([])
const exportSelectedServiceTypeId = ref('')
const exportSelectedTemplateId = ref('')
const exportLoading = ref(false)
const existingPlan = ref<{ id: string; title: string; dates: string } | null>(null)
const exportMode = ref<'new' | 'existing'>('new')
```

**Add after `exportMode` ref** — two new refs following same naming convention:
```typescript
const pcTeams = ref<Array<{ id: string; name: string }>>([])
const selectedPcTeamIds = ref<string[]>([])
```

---

#### Change 2: `onExportToPC` / `onServiceTypeChange` — fetch teams

**Analog:** Lines 1498–1547 — the existing `onExportToPC` (which fetches service types + templates in a single loading phase) and `onServiceTypeChange` (which resets + refetches on service type change).

**Current `onExportToPC` fetch block** (lines 1510–1524) — add `fetchServiceTypeTeams` call in the same try block:
```typescript
exportServiceTypes.value = await fetchServiceTypes(appId, secret)

// Default to service type whose name contains "Sunday", else first
const sundayType = exportServiceTypes.value.find(t =>
  t.name.toLowerCase().includes('sunday')
)
exportSelectedServiceTypeId.value = sundayType?.id ?? exportServiceTypes.value[0]?.id ?? ''

// Fetch templates for selected service type
if (exportSelectedServiceTypeId.value) {
  exportTemplates.value = await fetchTemplates(appId, secret, exportSelectedServiceTypeId.value)
  exportSelectedTemplateId.value = exportTemplates.value[0]?.id ?? ''

  // Check if a plan already exists for this date
  await checkForExistingPlan()
}
```

**Add teams fetch after templates fetch** (inside the `if (exportSelectedServiceTypeId.value)` block, after `checkForExistingPlan()`):
```typescript
// Fetch PC teams for auto-match
pcTeams.value = await fetchServiceTypeTeams(appId, secret, exportSelectedServiceTypeId.value)
selectedPcTeamIds.value = pcTeams.value
  .filter((pcTeam) =>
    (localService.value?.teams ?? []).some(
      (svcTeam) => svcTeam.toLowerCase() === pcTeam.name.toLowerCase()
    )
  )
  .map((t) => t.id)
```

**Current `onServiceTypeChange` reset block** (lines 1536–1538):
```typescript
exportTemplates.value = []
exportSelectedTemplateId.value = ''
existingPlan.value = null
exportMode.value = 'new'
```

**Add team reset to `onServiceTypeChange`** (same reset pattern, before `try`):
```typescript
pcTeams.value = []
selectedPcTeamIds.value = []
```

And add teams fetch inside the `try` block after templates:
```typescript
pcTeams.value = await fetchServiceTypeTeams(appId, secret, exportSelectedServiceTypeId.value)
selectedPcTeamIds.value = pcTeams.value
  .filter((pcTeam) =>
    (localService.value?.teams ?? []).some(
      (svcTeam) => svcTeam.toLowerCase() === pcTeam.name.toLowerCase()
    )
  )
  .map((t) => t.id)
```

---

#### Change 3: Export dialog template — Teams section + updated info text

**Analog:** Lines 275–285 (Template selector `<div>`) — same label + select pattern; and lines 252–273 (existing plan info section).

**Existing template selector markup pattern** (lines 276–285):
```html
<div v-if="exportMode === 'new'" class="mb-3">
  <label class="block text-xs text-gray-400 mb-1">Template</label>
  <select
    v-model="exportSelectedTemplateId"
    class="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
  >
    <option value="">No template (blank plan)</option>
    <option v-for="t in exportTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
  </select>
</div>
```

**New Teams section** — insert between Template selector and Service Date (after line 285, before the existing plan info `<p>` at line 288). Use checkbox list instead of select; same label/mb-3 wrapper:
```html
<!-- PC Teams -->
<div v-if="pcTeams.length > 0" class="mb-3">
  <label class="block text-xs text-gray-400 mb-1">Teams</label>
  <div class="space-y-1">
    <label
      v-for="team in pcTeams"
      :key="team.id"
      class="flex items-center gap-2 text-sm text-gray-200 cursor-pointer"
    >
      <input
        type="checkbox"
        :value="team.id"
        v-model="selectedPcTeamIds"
        class="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
      />
      {{ team.name }}
    </label>
  </div>
</div>
```

**Updated info text for existing plan mode** — change current line 288:
```html
<!-- Before -->
<p v-if="exportMode === 'existing'" class="text-xs text-gray-500 mb-3">Songs replace "Worship Song" items and scriptures replace "Scripture Reading" items in the plan. Any extras are appended at the end.</p>

<!-- After -->
<p v-if="exportMode === 'existing'" class="text-xs text-gray-500 mb-3">Songs replace "Worship Song" placeholders and scriptures replace "Scripture Reading" placeholders. Unmatched placeholders are removed. Extras are appended at the end.</p>
```

---

#### Change 4: `onConfirmExport` — existing plan branch rewrite + team-add

**Analog:** Lines 1566–1622 (existing plan branch) and lines 1745–1752 (partial failure reporting).

**Existing plan branch currently** (lines 1566–1622) — appends without deleting placeholders. The entire loop body must be replaced so that matched placeholders are deleted before recreating, and unmatched placeholders are deleted.

**Pattern for partial failure collection** (lines 1559, 1584–1587, 1747–1748):
```typescript
const failures: string[] = []
// ...
try {
  await addSlotAsItem(...)
  songIndex++
} catch {
  const label = slot.kind === 'SONG' ? ((slot as any).songTitle ?? 'Song') : ((slot as any).hymnName ?? 'Hymn')
  failures.push(label)
}
// ...
if (failures.length > 0) {
  exportError.value = `Plan ${exportMode.value === 'existing' ? 'updated' : 'created'} but ${failures.length} item(s) failed: ${failures.join(', ')}`
}
```

**New existing plan branch structure** — collect placeholder matches first, then delete, then recreate:
```typescript
if (exportMode.value === 'existing' && existingPlan.value) {
  planId = existingPlan.value.id

  const existingItems = await fetchPlanItems(appId, secret, serviceTypeId, planId)
  let songIndex = 0
  let scriptureIndex = 0
  const unmatchedPlaceholderIds: string[] = []

  // First pass: match placeholders to WorshipPlanner slots
  const songMatches: Array<{ item: typeof existingItems[0]; slot: typeof songSlots[0] }> = []
  const scriptureMatches: Array<{ item: typeof existingItems[0]; slot: typeof scriptureSlots[0] }> = []

  for (const item of existingItems) {
    const titleLower = item.title.toLowerCase()
    const isSongPlaceholder = titleLower.includes('worship song')
    const isScripturePlaceholder = titleLower.includes('scripture reading')

    if (isSongPlaceholder && songIndex < songSlots.length) {
      songMatches.push({ item, slot: songSlots[songIndex]! })
      songIndex++
    } else if (isScripturePlaceholder && scriptureIndex < scriptureSlots.length) {
      scriptureMatches.push({ item, slot: scriptureSlots[scriptureIndex]! })
      scriptureIndex++
    } else if (isSongPlaceholder || isScripturePlaceholder) {
      // Unmatched placeholder — will be deleted
      unmatchedPlaceholderIds.push(item.id)
    }
  }

  // Delete unmatched placeholders (non-fatal)
  for (const itemId of unmatchedPlaceholderIds) {
    try { await deleteItem(appId, secret, serviceTypeId, planId, itemId) } catch { /* non-fatal */ }
  }

  // Delete + recreate matched song placeholders
  for (const { item, slot } of songMatches) {
    try {
      await deleteItem(appId, secret, serviceTypeId, planId, item.id)
      await addSlotAsItem(appId, secret, serviceTypeId, planId, slot, item.sequence, songStore.songs, localService.value.sermonPassage)
    } catch {
      const label = slot.kind === 'SONG' ? ((slot as any).songTitle ?? 'Song') : ((slot as any).hymnName ?? 'Hymn')
      failures.push(label)
    }
  }

  // Delete + recreate matched scripture placeholders
  for (const { item, slot } of scriptureMatches) {
    try {
      await deleteItem(appId, secret, serviceTypeId, planId, item.id)
      await addSlotAsItem(appId, secret, serviceTypeId, planId, slot, item.sequence, songStore.songs, localService.value.sermonPassage)
    } catch {
      failures.push('Scripture')
    }
  }

  // Append leftover (unmatched WorshipPlanner) slots
  let sequence = existingItems.length > 0
    ? Math.max(...existingItems.map(i => i.sequence)) + 1
    : 1

  for (let i = songIndex; i < songSlots.length; i++) {
    // ... same append pattern as current code (lines 1605-1612)
  }
  for (let i = scriptureIndex; i < scriptureSlots.length; i++) {
    // ... same append pattern as current code (lines 1615-1621)
  }
}
```

**Add team-add after plan creation / existing plan update** — in both branches, after all slots are added, before `serviceStore.updateService`. Use the non-fatal pattern (`.catch(() => {})`):
```typescript
// Add selected PC teams to plan (non-fatal — consistent with existing .catch(() => {}) pattern)
for (const teamId of selectedPcTeamIds.value) {
  try {
    await addTeamToPlan(appId, secret, serviceTypeId, planId, teamId)
  } catch {
    // Non-fatal: team-add failures do not block export completion
  }
}
```

**AI songLibrary filter for orchestra** — at the call site in `ServiceEditorView.vue` where `getSongSuggestions` is called. Locate the existing `getSongSuggestions` call (search for `getSongSuggestions` in ServiceEditorView.vue). Before constructing params, add:
```typescript
const isOrchestraService = localService.value.teams?.includes('Orchestra') ?? false
const filteredSongLibrary = isOrchestraService
  ? songStore.songs.filter((s) => s.teamTags.includes('Orchestra'))
  : songStore.songs
// Then pass filteredSongLibrary as the songLibrary param (not songStore.songs)
```

---

### `src/components/SongSlotPicker.vue` — Orchestra visual dimming

**Analog:** Lines 106–127 ("By Rotation" `<button>` loop) and lines 144–156 ("Search Results" `<button>` loop) — the existing song row button elements.

**Current By Rotation button** (lines 106–127):
```html
<button
  v-for="result in suggestions"
  :key="result.song.id"
  type="button"
  @click="onSelect(result.song)"
  class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors"
>
```

**Current Search Results button** (lines 145–150):
```html
<button
  v-for="song in searchResults"
  :key="song.id"
  type="button"
  @click="onSelect(song)"
  class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors"
>
```

**New helper computed** — add after existing `resolvedAiSuggestions` computed (after line 228) in the `<script setup>` block:
```typescript
const isOrchestraService = computed(() => props.serviceTeams.includes('Orchestra'))

function isNonOrchestraSong(song: Song): boolean {
  return isOrchestraService.value && !song.teamTags.includes('Orchestra')
}
```

**Updated By Rotation button** — change `class` to `:class` binding:
```html
<button
  v-for="result in suggestions"
  :key="result.song.id"
  type="button"
  @click="onSelect(result.song)"
  :class="['w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors',
           isNonOrchestraSong(result.song) ? 'opacity-50' : '']"
>
```

**Updated Search Results button** — same dimming pattern:
```html
<button
  v-for="song in searchResults"
  :key="song.id"
  type="button"
  @click="onSelect(song)"
  :class="['w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors',
           isNonOrchestraSong(song) ? 'opacity-50' : '']"
>
```

**Orchestra-first sort in `searchResults` computed** — add secondary sort after the existing VW type sort (lines 213–217):
```typescript
const searchResults = computed<Song[]>(() => {
  if (!searchQuery.value) return []
  const q = searchQuery.value.toLowerCase()
  return props.songs
    .filter((s) => s.title.toLowerCase().includes(q))
    .sort((a, b) => {
      // Orchestra: orchestra-tagged songs sort above non-orchestra when service is orchestra
      if (isOrchestraService.value) {
        const aOrch = a.teamTags.includes('Orchestra') ? 1 : 0
        const bOrch = b.teamTags.includes('Orchestra') ? 1 : 0
        if (bOrch !== aOrch) return bOrch - aOrch
      }
      // VW type match secondary sort
      const aMatch = (a.vwTypes ?? []).includes(props.requiredVwType) ? 1 : 0
      const bMatch = (b.vwTypes ?? []).includes(props.requiredVwType) ? 1 : 0
      return bMatch - aMatch
    })
})
```

---

### `src/utils/__tests__/planningCenterApi.test.ts` — New test cases

**Analog:** Lines 150–176 (the `fetchTemplates` describe block) for `fetchServiceTypeTeams`; lines 179+ (`fetchTemplateItems` block) for `deleteItem`.

**Test structure to copy from `fetchTemplates` block** (lines 150–176):
```typescript
describe('fetchTemplates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns array of {id, name} from JSON:API response at /service_types/{id}/plan_templates', async () => {
    const mockResponse = {
      data: [
        { id: 'tmpl-1', attributes: { name: 'Standard Template' } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))
    const result = await fetchTemplates('app-id', 'secret', 'svc-type-1')
    expect(result).toEqual([{ id: 'tmpl-1', name: 'Standard Template' }])
    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/svc-type-1/plan_templates')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))
    await expect(fetchTemplates('app-id', 'secret', 'svc-type-1')).rejects.toThrow('Failed to fetch templates: 400')
  })
})
```

**New tests needed** (copy structure above):

1. `fetchServiceTypeTeams` — returns `{id, name}` from `data[].attributes.name`; URL contains `/service_types/{id}/teams`; throws on non-ok
2. `deleteItem` — sends DELETE to correct URL `/service_types/{stId}/plans/{planId}/items/{itemId}`; resolves void on 204; throws on non-ok with status text
3. `addSlotAsItem` SONG — title is `"Worship Song - I Believe"` (not just `"I Believe"`)
4. `addSlotAsItem` HYMN — title is `"Worship Song - Holy, Holy, Holy #1 (vv. 1-3)"`

**Import line to update** (line 27) — add `deleteItem`, `fetchServiceTypeTeams` to the existing named imports:
```typescript
import {
  validatePcCredentials,
  fetchServiceTypes,
  fetchTemplates,
  fetchServiceTypeTeams,   // NEW
  createPlan,
  fetchTemplateItems,
  createItem,
  updateItem,
  deleteItem,              // NEW
  addSlotAsItem,
  buildPlanTitle,
  searchSongByCcli,
  fetchSongArrangements,
  fetchLastScheduledItem,
  createItemNote,
} from '@/utils/planningCenterApi'
```

---

### `src/utils/__tests__/suggestions.test.ts` — New test cases + test updates

**Analog:** Lines 113–166 (the `'team filtering'` describe block) and lines 168–240 (the `'scoring'` describe block).

**Test helper to reuse** (lines 6–25):
```typescript
function makeSong(overrides: Partial<Omit<Song, 'vwTypes'>> & { lastUsedMs?: number; vwTypes?: VWType[] }): Song {
  const { lastUsedMs, ...rest } = overrides
  return {
    id: 'song-1',
    // ...
    teamTags: [],
    lastUsedAt: lastUsedMs != null ? { toMillis: () => lastUsedMs } as any : null,
    ...rest,
  }
}
```

**Existing tests that need updating** — `'team filtering'` tests at lines 155–165 use `serviceTeams: ['Orchestra']` and expect hard-filter exclusion. After the change, Orchestra-only does NOT hard-filter. These tests must be revised:

```typescript
// Line 155-165: this test will FAIL after the change — update expected behavior:
it('team filtering applies to all VW types (non-matching types also filtered by team)', () => {
  const songs = [
    makeSong({ id: 's1', vwTypes: [1], teamTags: ['Choir'] }),
    makeSong({ id: 's2', vwTypes: [2], teamTags: ['Choir'] }),
    makeSong({ id: 's3', vwTypes: [1], teamTags: [] }),
  ]
  const results = rankSongsForSlot(songs, 1, ['Orchestra'], NOW_MS)
  // BEFORE: only s3 returned (hard filter). AFTER: all 3 returned (Orchestra is soft bonus only)
  expect(results).toHaveLength(3)  // Changed from 1
})
```

**New tests to add** — add a new `describe('rankSongsForSlot - orchestra scoring bonus')` block:

```typescript
describe('rankSongsForSlot - orchestra scoring bonus', () => {
  it('orchestra-tagged song gets +200 bonus when Orchestra is in serviceTeams', () => {
    const songs = [
      makeSong({ id: 'orch', vwTypes: [1], teamTags: ['Orchestra'] }),
      makeSong({ id: 'plain', vwTypes: [1], teamTags: [] }),
    ]
    // Both never used: base 500 + type 100. Orch gets +200 extra = 800 vs 600
    const results = rankSongsForSlot(songs, 1, ['Orchestra'], NOW_MS)
    const orchResult = results.find((r) => r.song.id === 'orch')!
    const plainResult = results.find((r) => r.song.id === 'plain')!
    expect(orchResult.score - plainResult.score).toBe(200)
    expect(results[0]!.song.id).toBe('orch')
  })

  it('non-orchestra songs still appear in results when Orchestra is in serviceTeams', () => {
    const songs = [
      makeSong({ id: 'orch', vwTypes: [1], teamTags: ['Orchestra'] }),
      makeSong({ id: 'plain', vwTypes: [2], teamTags: [] }),
    ]
    const results = rankSongsForSlot(songs, 1, ['Orchestra'], NOW_MS)
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.song.id)).toContain('plain')
  })

  it('orchestra bonus is zero when Orchestra is NOT in serviceTeams', () => {
    const songs = [
      makeSong({ id: 'orch', vwTypes: [1], teamTags: ['Orchestra'] }),
    ]
    const withOrch = rankSongsForSlot(songs, 1, ['Orchestra'], NOW_MS)
    const withoutOrch = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(withOrch[0]!.score - withoutOrch[0]!.score).toBe(200)
  })

  it('Choir AND-logic still applies when serviceTeams includes both Choir and Orchestra', () => {
    const songs = [
      makeSong({ id: 'choir-only', vwTypes: [1], teamTags: ['Choir'] }),
      makeSong({ id: 'both', vwTypes: [1], teamTags: ['Choir', 'Orchestra'] }),
      makeSong({ id: 'universal', vwTypes: [1], teamTags: [] }),
    ]
    const results = rankSongsForSlot(songs, 1, ['Choir', 'Orchestra'], NOW_MS)
    // choir-only is excluded by Choir AND-logic (has Choir but not Orchestra is fine for Orchestra-soft,
    // BUT Choir is non-orchestra team — choir-only passes Choir AND-logic since it has Choir)
    // Wait: nonOrchestraTeams = ['Choir']; choir-only has 'Choir' → passes; both has 'Choir' → passes; universal passes
    expect(results).toHaveLength(3)
    // both should have +200 orchestraBonus on top of type bonus
    const bothResult = results.find((r) => r.song.id === 'both')!
    const choirResult = results.find((r) => r.song.id === 'choir-only')!
    expect(bothResult.score - choirResult.score).toBe(200)
  })
})
```

---

## Shared Patterns

### Partial Failure Tolerance
**Source:** `src/views/ServiceEditorView.vue` lines 1559, 1584–1587, 1747–1748
**Apply to:** All new API calls in `onConfirmExport` (team-add, delete-placeholder)

Pattern: wrap each call in `try/catch`, push label to `failures[]` for user-visible calls, use empty `catch` for non-fatal background calls:
```typescript
// User-visible item failure:
try {
  await someApiCall(...)
} catch {
  failures.push(labelString)
}

// Non-fatal background call (team-add, unmatched placeholder delete):
try { await someApiCall(...) } catch { /* non-fatal */ }

// Or using .catch(() => {}) for plan times (existing pattern, lines 1647-1661):
await createPlanTime(...).catch(() => {})
```

---

### PC API Function Signature
**Source:** `src/utils/planningCenterApi.ts` lines 17–19, all existing exported functions
**Apply to:** All new exported functions (`deleteItem`, `fetchServiceTypeTeams`, `addTeamToPlan`)

All PC API functions share the same first two parameters and Basic Auth header construction:
```typescript
function basicAuthHeader(appId: string, secret: string): string {
  return 'Basic ' + btoa(appId + ':' + secret)
}

// Every exported function signature:
export async function functionName(
  appId: string,
  secret: string,
  serviceTypeId: string,
  // ...additional params
): Promise<ReturnType> {
  // headers always:
  headers: {
    Authorization: basicAuthHeader(appId, secret),
    Accept: 'application/json',
  }
```

---

### Export Dialog Form Field Pattern
**Source:** `src/views/ServiceEditorView.vue` lines 240–285 (Service Type + Template selectors)
**Apply to:** New Teams checkbox section in export dialog

Each form field in the export dialog uses the same wrapper + label pattern:
```html
<div class="mb-3">
  <label class="block text-xs text-gray-400 mb-1">Field Label</label>
  <!-- field control here -->
</div>
```

---

### Vitest `fetch` Mock Pattern
**Source:** `src/utils/__tests__/planningCenterApi.test.ts` lines 85–120 (`validatePcCredentials` and `fetchServiceTypes` describe blocks)
**Apply to:** All new test cases for `deleteItem`, `fetchServiceTypeTeams`

```typescript
describe('functionName', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('description', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }))
    const result = await functionName('app-id', 'secret', ...)
    expect(result).toEqual(expected)
    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/expected/path')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))
    await expect(functionName(...)).rejects.toThrow('Failed to ...: 400')
  })
})
```

---

## No Analog Found

None — all five files are self-analogous. Every change pattern is derived directly from existing code in the same file.

---

## Metadata

**Analog search scope:** `src/utils/planningCenterApi.ts`, `src/utils/suggestions.ts`, `src/utils/claudeApi.ts`, `src/components/SongSlotPicker.vue`, `src/views/ServiceEditorView.vue`, `src/utils/__tests__/planningCenterApi.test.ts`, `src/utils/__tests__/suggestions.test.ts`
**Files scanned:** 7 source files read in full
**Pattern extraction date:** 2026-04-15
