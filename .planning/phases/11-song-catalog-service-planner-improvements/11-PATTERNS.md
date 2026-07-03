# Phase 11: Song Catalog & Service Planner Improvements - Pattern Map

**Mapped:** 2026-06-30
**Files analyzed:** 14 modified files
**Analogs found:** 14 / 14 (all files already exist and are being extended — the "analog" for each is its own current implementation plus a sibling that already solves the same sub-problem)

> This phase modifies existing files rather than creating new ones. For each file the primary pattern to copy is the file's OWN existing convention, supplemented by a concrete sibling that already solves the exact sub-problem (e.g. `hidden` preservation in `upsertSongs`, IntersectionObserver batching in `SongTable`, the Teleport modal in `NewServiceDialog`). All excerpts below are real code with line numbers.

---

## File Classification

| File | Role | Data Flow | Closest Analog (already-solved sibling) | Match |
|------|------|-----------|-----------------------------------------|-------|
| `src/types/song.ts` | model | transform | existing `themes: string[]` / `hidden` fields in same file | exact |
| `src/utils/songSearch.ts` | utility | transform | existing `songMatchesQuery()` body (same file) | exact |
| `src/stores/songs.ts` | store | CRUD | existing `hidden` preservation in `upsertSongs()` (same file) | exact |
| `src/components/SongTable.vue` | component | event-driven (scroll) | existing `toggleSort` + IntersectionObserver batching (same file) | exact |
| `src/components/SongFilters.vue` | component | request-response | existing team-tag `<select>` filter (same file) | exact |
| `src/components/TeamTagPill.vue` | component | transform | existing pill + `SongBadge.vue` `badgeClasses` variant map | exact |
| `src/components/SongBadge.vue` | component | transform | existing badge (info-only already) | exact |
| `src/components/SongSlideOver.vue` | component | CRUD (form) | existing `toggleSongTag()` + `themesInput` (same file) | exact |
| `src/components/SongSlotPicker.vue` | component | event-driven (scroll) | `SongTable.vue` IntersectionObserver batching | role+flow |
| `src/views/SongsView.vue` | view | request-response | existing `SongFilters`/`SongTable` wiring + `availableTags` (same file) | exact |
| `src/views/ServiceEditorView.vue` | view | event-driven | existing autosave watcher + Sortable `onEnd` + `showDeleteConfirm` Teleport (same file) | exact |
| `src/components/NewServiceDialog.vue` | component | (reference only) | its own Teleport+Transition modal — pattern source, not modified | exact |
| `src/stores/services.ts` | store | CRUD | existing `updateService()` (same file) | exact |
| `src/utils/pcSongImport.ts` | utility | transform | existing `mapPcSongToUpsert()` (already parses `themes`) | exact |
| `src/utils/claudeApi.ts` | utility | request-response | existing `getSongSuggestions()` (same file) | exact |

---

## Pattern Assignments

### `src/types/song.ts` (model, transform)

**D-01, D-02.** Add `tags: string[]` to `Song`. `UpsertSongInput` is `Omit<Song, ...>` so it inherits `tags` automatically — no separate edit needed.

**Copy the existing field placement** (song.ts:23-46):
```typescript
export interface Song {
  id: string
  title: string
  ccliNumber: string
  author: string
  themes: string[]        // PC-imported thematic keywords (do NOT reuse)
  notes: string
  vwTypes: VWType[]
  teamTags: string[]      // team compatibility (do NOT reuse)
  arrangements: Arrangement[]
  primaryArrangementId: string | null
  lastUsedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
  pcSongId: string | null
  hidden: boolean
  // ADD: tags: string[]  // D-01 user-defined tags (e.g. "Christmas")
}

export type UpsertSongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>
```
Note: `themes` and `teamTags` are already distinct array fields — `tags` is a third parallel array. Firestore legacy docs lack `tags`; normalize to `[]` in the store subscribe mapper (see `songs.ts` below).

---

### `src/utils/songSearch.ts` (utility, transform)

**D-05.** Extend `songMatchesQuery()` to also match arrangement `key`, `notes`, and `tags`. The current body is the exact pattern — append three checks (songSearch.ts:11-29):
```typescript
export function songMatchesQuery(song: Song, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true

  if (song.title.toLowerCase().includes(q)) return true
  if (String(song.ccliNumber).includes(q)) return true
  if (song.author?.toLowerCase().includes(q)) return true
  if (song.themes.some((t) => t.toLowerCase().includes(q))) return true
  if (song.teamTags.some((t) => t.toLowerCase().includes(q))) return true
  if (
    song.vwTypes.some(
      (vw) => String(vw) === q || VW_TYPE_LABELS[vw].toLowerCase().includes(q),
    )
  ) {
    return true
  }
  // ADD (D-05):
  //   if (song.tags?.some((t) => t.toLowerCase().includes(q))) return true
  //   if (song.notes?.toLowerCase().includes(q)) return true
  //   if (song.arrangements.some((a) => a.key.toLowerCase() === q)) return true   // NB: docstring currently says keys are excluded — update it
  return false
}
```
IMPORTANT: The current JSDoc (songSearch.ts:4-10) explicitly says "Does NOT match arrangement keys." D-05 reverses this — update the docstring too.

**Test pattern** — extend `src/utils/__tests__/songSearch.test.ts`. The `makeSong()` factory (songSearch.test.ts:5-27) already provides `themes`, `notes`, `arrangements[].key`; add a `tags` field to it and add `it('matches tags')` / `it('matches notes')` / `it('matches key')` cases mirroring songSearch.test.ts:40-45.

---

### `src/stores/songs.ts` (store, CRUD)

**D-02 (tag preservation on import) + D-08 (theme merge) + legacy `[]` backfill.**

**Legacy normalization** — copy the `vwTypes` normalization block in `subscribe()` (songs.ts:66-76) and add a `tags` default:
```typescript
unsubscribeFn = onSnapshot(q, (snap) => {
  songs.value = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    if (!Array.isArray(data.vwTypes)) {
      data.vwTypes = data.vwType != null ? [data.vwType] : []
    }
    // ADD: if (!Array.isArray(data.tags)) data.tags = []
    return { id: d.id, ...data } as Song
  })
  isLoading.value = false
})
```

**Import preservation** — the `hidden` preservation in `upsertSongs()` is the EXACT pattern D-02 wants. Copy it for `tags`, and add theme-merge for D-08 (songs.ts:147-172):
```typescript
if (existing) {
  const {
    vwTypes: incomingVwTypes,
    hidden: _hidden,
    primaryArrangementId: incomingPrimary,
    ...restIncoming
  } = incoming
  const updateData: Record<string, unknown> = {
    ...restIncoming,
    hidden: existing.hidden ?? false,     // ← preserve pattern to copy for tags
    updatedAt: serverTimestamp(),
  }
  if (incomingVwTypes.length > 0) {
    updateData.vwTypes = incomingVwTypes
  }
  // ... primaryArrangementId preservation ...
  await updateDoc(doc(db, 'organizations', orgId.value!, 'songs', existing.id), updateData)
}
```
For D-02: also destructure `tags: _tags` out of `incoming` and set `updateData.tags = existing.tags ?? []` — NEVER let import overwrite user tags (identical to `hidden`).
For D-08: merge themes rather than clobber — `updateData.themes = Array.from(new Set([...(existing.themes ?? []), ...incoming.themes]))` (import currently spreads `restIncoming` which includes `themes`, so this needs an explicit override to merge instead of replace).
For new-doc branch (songs.ts:173-181): add `tags: incoming.tags ?? []`.

**Filter state for tag hide/show (D-03)** — extend the `filteredSongs` computed (songs.ts:34-55). Current tag filter is single-value `filterTag` team-tag inclusion (songs.ts:50-51):
```typescript
const matchesTag =
  !filterTag.value || song.teamTags.includes(filterTag.value)
```
Add two new refs mirroring `filterTag` (songs.ts:27-31) — e.g. `filterTagInclude` and `filterTagExclude` (user `tags`), and add to the computed:
```typescript
const matchesTagInclude = !filterTagInclude.value || song.tags?.includes(filterTagInclude.value)
const matchesTagExclude = !filterTagExclude.value || !song.tags?.includes(filterTagExclude.value)
```
Export the new refs from the store `return {}` block (songs.ts:202-219) exactly like `filterTag` is exported.

---

### `src/components/SongTable.vue` (component, event-driven scroll)

**D-06 (themes/tags pills), D-07 (all-column sort). Also the batching template source for D-12.**

**All-column sort** — the current mechanism only handles `title` (SongTable.vue:203-225). `SortField` is a literal type `'title'` and `sortedSongs` does a naive `a[sortField].toLowerCase()` which only works for string fields:
```typescript
type SortField = 'title'
type SortDir = 'asc' | 'desc'
const sortField = ref<SortField>('title')
const sortDir = ref<SortDir>('asc')

function toggleSort(field: SortField) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'asc'
  }
}

const sortedSongs = computed(() => {
  return [...props.songs].sort((a, b) => {
    const aVal = a[sortField.value].toLowerCase()
    const bVal = b[sortField.value].toLowerCase()
    const cmp = aVal.localeCompare(bVal)
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})
```
D-07 needs `SortField = 'title' | 'category' | 'key' | 'ccli' | 'lastUsed'`. Replace the naive comparator with per-field extractors: `category` → `song.vwTypes[0] ?? 99`; `key` → `getPrimaryKey(song)` (already imported, songSearch.ts:44); `ccli` → numeric `Number(song.ccliNumber)`; `lastUsed` → `song.lastUsedAt?.toMillis() ?? 0`. Default stays `title` asc (D-07). The sort-arrow SVG block (SongTable.vue:75-102) is currently inline in the Title `<th>` only — extract it to a reusable snippet or repeat it per header (SongTable.vue:105-119 are the currently-unsortable headers). Discretion D (CONTEXT :55) says "sort arrows already exist for Title — replicate."

**IntersectionObserver batching (THE reference for D-12)** — copy verbatim to `SongSlotPicker`. (SongTable.vue:228-268):
```typescript
const BATCH_SIZE = 50
const visibleCount = ref(BATCH_SIZE)
const visibleSongs = computed(() => sortedSongs.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < sortedSongs.value.length)

function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, sortedSongs.value.length)
}

watch(sortField, () => { visibleCount.value = BATCH_SIZE })
watch(sortDir, () => { visibleCount.value = BATCH_SIZE })
watch(() => props.songs, () => { visibleCount.value = BATCH_SIZE })  // reset on filter change

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value) {
        loadMore()
      }
    },
    { rootMargin: '200px' }
  )
  if (sentinelRef.value) observer.observe(sentinelRef.value)
})

onUnmounted(() => { observer?.disconnect() })
```
The `<div ref="sentinelRef" class="h-1" />` sentinel + "Showing X of Y" footer (SongTable.vue:177-181) complete the pattern.

**Pills (D-06)** — the current "Tags" cell renders only `teamTags` via `TeamTagPill` (SongTable.vue:164-173):
```html
<td class="px-4 py-3">
  <div class="flex flex-wrap gap-1">
    <TeamTagPill v-for="tag in song.teamTags" :key="tag" :tag="tag" />
    <span v-if="song.teamTags.length === 0" class="text-gray-600">&mdash;</span>
  </div>
</td>
```
D-06 adds `themes` and user `tags` as visually-distinct pills. Add a `variant` prop to `TeamTagPill` (see below) and render three groups: `song.teamTags` (variant="team"), `song.themes` (variant="theme"), `song.tags` (variant="user"). For inline add/remove (D-04b) add a small "+" affordance in this cell that mutates `song.tags` and calls `songStore.updateSong(song.id, { tags })`.

**Bulk-tag selection (D-04c)** — discretion D (CONTEXT :51) says pick the approach "most consistent with existing SongTable.vue." The table currently emits `@select` on row click (SongTable.vue:123-128). A checkbox column + action bar is the recommended affordance; the row-click `@emit('select', song)` must be guarded (e.g. `@click.stop` on the checkbox) so selection ≠ opening the slide-over. See `BatchQuickAssign.vue` (imported in SongsView.vue:142) as an existing multi-select action-bar precedent.

---

### `src/components/TeamTagPill.vue` (component, transform)

**D-06.** Add a `variant` prop for three visually-distinct pill types. The current component is a single hardcoded style (TeamTagPill.vue:1-13):
```html
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
  {{ tag }}
</span>
```
Copy `SongBadge.vue`'s static-class-map pattern (SongBadge.vue:29-34) — a literal map prevents Tailwind v4 purge of dynamic strings:
```typescript
// Copy this exact pattern from SongBadge.vue:29-34
const variantClasses = {
  team:  'bg-gray-800 text-gray-400 border-gray-700',   // existing look = default
  theme: 'bg-teal-900/50 text-teal-300 border-teal-800',
  user:  'bg-pink-900/50 text-pink-300 border-pink-800',
} as const
```
Add `variant?: 'team' | 'theme' | 'user'` to `defineProps` (default `'team'` so existing call sites in `SongTable`, `SongSlotPicker` keep the current appearance). Colors are Claude's discretion (CONTEXT :50 — dark-mode gray-950/900/800 palette); `SongBadge` already uses blue/purple/amber, so choose distinct hues.

---

### `src/components/SongBadge.vue` (component, transform)

**D-10.** Already info-only — renders `Type {{ t }}` pills from `vwTypes` with no click behavior (SongBadge.vue:1-35). No structural change needed; it stays visible in the picker rows purely as display. The work is in `SongSlotPicker` (remove ranking bonus), not here. Reference for the color-map pattern reused by `TeamTagPill` (SongBadge.vue:30-34).

---

### `src/components/SongSlideOver.vue` (component, CRUD form)

**D-04a (tags in editor form) + D-08 (themes already editable here).**

The editor already has a themes text input and a toggle-tag UI. Copy the `teamTags` toggle mechanism for the new user `tags` field.

**Tag toggle UI** (SongSlideOver.vue:149-163) and handler (SongSlideOver.vue:369-376):
```typescript
function toggleSongTag(tag: string) {
  const idx = form.value.teamTags.indexOf(tag)
  if (idx >= 0) {
    form.value.teamTags.splice(idx, 1)
  } else {
    form.value.teamTags.push(tag)
  }
}
```
Add a parallel `form.tags: string[]`, a `toggleUserTag()` clone, and a free-text add input (user tags like "Christmas" are ad-hoc, unlike the predefined `PREDEFINED_TAGS` at SongSlideOver.vue:319). `themesInput` comma-parse pattern (SongSlideOver.vue:291,307,388-392) is the model for a free-text tag input.

**Save payload** (SongSlideOver.vue:407-420) — add `tags: form.value.tags` to the `data` object. Note this `FormState` interface (SongSlideOver.vue:248-257) and `emptyForm()`/`toForm()` (SongSlideOver.vue:261-288) must all gain the `tags` field, mirroring how `themes`/`teamTags` appear in all three.

---

### `src/components/SongSlotPicker.vue` (component, event-driven scroll)

**D-09, D-10, D-11 (type-agnostic), D-12 (batching), D-06 (pills), D-03 (tag filter).**

**Remove the `slice(0, 15)` cap (D-12 root cause)** (SongSlotPicker.vue:231-234):
```typescript
const suggestions = computed<SuggestionResult[]>(() => {
  const results = rankSongsForSlot(props.songs, props.requiredVwType, props.serviceTeams)
  return results.slice(0, 15)   // ← THIS is "stops after a handful". Replace with visibleCount batching.
})
```
Copy the SongTable IntersectionObserver block (SongTable.vue:228-268, quoted above) into this component. Apply the `visibleCount` slice to BOTH `suggestions` and `searchResults` (SongSlotPicker.vue:236-253) so the full catalog is scroll-reachable. Add a sentinel `<div>` inside the teleported dropdown panel (SongSlotPicker.vue:35-38 is the scroll container, `max-h-[600px] overflow-y-auto`).

**Remove type-match ranking (D-10)** — `searchResults` currently re-sorts by VW-type match (SongSlotPicker.vue:248-251):
```typescript
// REMOVE this secondary sort (D-10 — slot type must not influence ordering):
const aMatch = (a.vwTypes ?? []).includes(props.requiredVwType) ? 1 : 0
const bMatch = (b.vwTypes ?? []).includes(props.requiredVwType) ? 1 : 0
return bMatch - aMatch
```
And in `rankSongsForSlot` (suggestions.ts:71-72) the `typeBonus` of +100 must be removed/neutralized for the picker (D-10). Note `requiredVwType` prop (SongSlotPicker.vue:204) becomes display-only — `SongBadge` still shows it (SongSlotPicker.vue:90,139,181) as info (D-10), but it no longer ranks. Discretion: either drop the prop from ranking or pass a sentinel; simplest is to strip `typeBonus` in `suggestions.ts`.

**Pills (D-06)** — rows currently show only `teamTags` (SongSlotPicker.vue:128-137 rotation, 170-179 search). Add `themes` + `tags` pills using the new `TeamTagPill` `variant` prop, same as SongTable.

**Tag filter (D-03)** — add an include/exclude tag control inside the dropdown header (next to the search input at SongSlotPicker.vue:40-48) filtering `props.songs` by `song.tags` before ranking/searching.

**AI Picks broaden (D-11)** — the AI weighting happens upstream in `ServiceEditorView.suggestAllSongs()` / `fetchAiForSlot()` (see below); this component just displays `props.aiSuggestions` (SongSlotPicker.vue:255-263), so no AI change here beyond removing type-match ordering.

---

### `src/views/SongsView.vue` (view, request-response)

**D-03 (tag filter wiring), D-04c (bulk selection host).**

The view wires `SongFilters` ↔ store filter state and `SongTable` ↔ `filteredSongs` (SongsView.vue:65-81). `availableTags` is derived from `song.teamTags` (SongsView.vue:184-...); add a parallel `availableUserTags` derived from `song.tags` and pass to `SongFilters` for the new include/exclude selects. Bulk-tag action state (selected song IDs + apply/remove) lives here as the host view; `BatchQuickAssign.vue` (imported SongsView.vue:142) is the existing multi-select precedent to model.

---

### `src/views/ServiceEditorView.vue` (view, event-driven)

The single largest work item. Five discrete fixes:

**1. D-18 — AI hidden-song bug (~line 310).** `suggestAllSongs()` builds `librarySource` from `songStore.songs` (ALL songs, incl. hidden) (ServiceEditorView.vue:1306-1310):
```typescript
const isOrchestraService = (localService.value?.teams ?? []).includes('Orchestra')
const librarySource = isOrchestraService
  ? songStore.songs.filter((s) => s.teamTags.includes('Orchestra'))
  : songStore.songs                                  // ← BUG: includes hidden songs
```
Fix: filter out hidden first — `songStore.filteredSongs` already excludes hidden (songs.ts:36-37) but ALSO applies the UI search/type filters, which is wrong here. Use an explicit non-hidden base: `const base = songStore.songs.filter((s) => !s.hidden)` then apply the orchestra filter to `base`. The IDENTICAL bug exists in `fetchAiForSlot()` (ServiceEditorView.vue:1415-1418) — fix both. This finishes the Phase 9 "hidden excluded from AI planning" decision (09-CONTEXT.md:44,69).

**2. D-16/D-15 — SortableJS snap-back + immediate save.** The Sortable `onEnd` mutates the reactive array then no-ops in `nextTick` (ServiceEditorView.vue:974-995):
```typescript
watch(slotContainerRef, (el) => {
  if (el && !sortableInstance) {
    sortableInstance = Sortable.create(el, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'opacity-30',
      onEnd(evt) {
        if (!localService.value || evt.oldIndex == null || evt.newIndex == null) return
        if (evt.oldIndex === evt.newIndex) return
        const slots = [...localService.value.slots]
        const moved = slots.splice(evt.oldIndex, 1)[0]
        if (!moved) return
        slots.splice(evt.newIndex, 0, moved)
        localService.value.slots = reindexSlots(slots)
        nextTick(() => {
          // After Vue re-renders, Sortable DOM will be correct  ← empty, does nothing
        })
      },
    })
  }
}, { flush: 'post' })
```
Root cause (D-16): SortableJS physically moves the DOM node, then Vue re-renders from the reactive array — the two orderings fight, producing snap-back. The classic fix is to REVERT Sortable's DOM mutation before applying the Vue reactive change, so Vue is the single source of truth. Options (discretion, CONTEXT :53): (a) in `onEnd`, undo the DOM move (`evt.item` back to `evt.oldIndex`) before mutating the array, or (b) migrate to `vuedraggable` (choose lower-risk). The `:key` on the v-for (ServiceEditorView.vue:456 — `slot.position + '-' + slot.kind + '-' + index`) is index-dependent and may worsen reconciliation; a stable per-slot id key would help.
D-15: after `reindexSlots(slots)`, persist IMMEDIATELY rather than waiting for the 800ms debounce — call `onSave()` (or a lighter `serviceStore.updateService(serviceId.value, { slots })`, discretion CONTEXT :52) directly inside `onEnd`. `reindexSlots` is imported from `@/utils/slotTypes` (ServiceEditorView.vue:847).

**3. D-17 — stuck-dirty autosave bug.** The autosave state machine (ServiceEditorView.vue:917-922 state, 1124-1171 watcher):
```typescript
// State
const autosaveStatus = ref<'idle' | 'pending' | 'saving' | 'saved'>('idle')
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let autosaveInitialized = false   // suppress first-load trigger
let autosaveSaving = false        // inflight guard

// Watcher (deep) on localService
watch(localService, () => {
  if (!localService.value || !originalService.value) return
  if (!authStore.isEditor) return
  if (!autosaveInitialized) { autosaveInitialized = true; return }
  if (!isDirty.value) return

  autosaveStatus.value = 'pending'
  if (autosaveTimer) clearTimeout(autosaveTimer)
  const scheduleAutosave = () => {
    autosaveTimer = setTimeout(async () => {
      if (!isDirty.value) { autosaveStatus.value = 'idle'; return }
      if (autosaveSaving) { scheduleAutosave(); return }   // reschedule if inflight
      previousService.value = JSON.parse(JSON.stringify(originalService.value))
      autosaveSaving = true
      autosaveStatus.value = 'saving'
      try {
        await onSave()
        autosaveStatus.value = 'saved'
        setTimeout(() => { if (autosaveStatus.value === 'saved') autosaveStatus.value = 'idle' }, 3000)
      } finally {
        autosaveSaving = false
      }
    }, 800)
  }
  scheduleAutosave()
}, { deep: true })
```
The stuck-dirty scenario (D-17): a reorder or quick interaction sets `autosaveStatus = 'pending'` and schedules a timer, but if `onEnd`/`onSave` reassigns `localService.value` or the store `services` watcher (ServiceEditorView.vue:1074-1107) merges a remote update while `autosaveStatus === 'pending'`, `originalService` can be reset such that `isDirty` reads false at fire time OR the timer is cleared without ever firing. The save button highlights on `isDirty` (ServiceEditorView.vue:99-103, 191-195) but the watcher's early `return`s can leave `isDirty` true with no scheduled save. Fix approach: after making the reorder an immediate save (D-15), ensure any path that leaves `isDirty` true always (re)arms a timer or calls `onSave`; and ensure the `autosaveStatus === 'pending'` guard in the store-merge watcher (ServiceEditorView.vue:1088,1103) doesn't strand a dirty state. When wiring D-15's immediate save, set `autosaveStatus`/`autosaveSaving` consistently so the inflight guard can't deadlock.

**4. D-14 — delete confirmation for populated slots.** `removeSlot()` and `onClearSong()` currently mutate with no prompt (ServiceEditorView.vue:1256-1285):
```typescript
function removeSlot(index: number) {
  if (!localService.value) return
  localService.value.slots.splice(index, 1)
  localService.value.slots = reindexSlots(localService.value.slots)
}

function onClearSong(index: number) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SONG') {
    const updated: SongSlot = { ...slot, songId: null, songTitle: null, songKey: null }
    localService.value.slots[index] = updated
  }
}
```
D-14: prompt only when the slot is POPULATED (song assigned, scripture/message/hymn filled); empty slots delete silently. Reuse the EXISTING delete-service Teleport modal already in this file (ServiceEditorView.vue:202-228) — it's the exact z-40/z-50 Cancel+red-confirm pattern D-14 specifies:
```html
<Teleport to="body">
  <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
      <h2 class="text-base font-semibold text-gray-100 mb-2">Delete service?</h2>
      <p class="text-sm text-gray-400 mb-6">...</p>
      <div class="flex justify-end gap-3">
        <button @click="showDeleteConfirm = false" ...>Cancel</button>
        <button @click="onDelete" class="... bg-red-700 hover:bg-red-600 ...">Delete</button>
      </div>
    </div>
  </div>
</Teleport>
```
Add a second `showSlotDeleteConfirm` ref + `pendingDeleteIndex` and route the remove (ServiceEditorView.vue:734-744) and clear (ServiceEditorView.vue:497-508) buttons through it when populated. (`NewServiceDialog.vue` — see below — is the richer Transition variant if fancier animation is wanted, but this in-file modal is the closest and simplest analog.)

**5. D-13 — decouple scripture-preview close from delete.** The delete (red X) button and the preview-close sit adjacent. The remove-element X is at ServiceEditorView.vue:734-744; scripture is rendered via `<ScriptureInput>` (ServiceEditorView.vue:570-580) whose preview-close is internal. Ensure closing the ScriptureInput preview does not bubble to `removeSlot`. Combined with D-14's confirmation, the fix is: (a) gate deletion behind the confirm modal, and (b) verify no `@click` on a preview-close element shares a handler with delete. Inspect `ScriptureInput.vue` if the preview-close lives there.

---

### `src/components/NewServiceDialog.vue` (component, reference only — NOT modified)

**D-14 richer modal reference.** The Teleport + dual-`Transition` (backdrop fade + dialog scale) pattern (NewServiceDialog.vue:2-118): backdrop `z-40 bg-black/60` with fade transition, dialog `z-50` with `scale-95→scale-100`, `@click.self="onCancel"` outside-click close, Cancel + primary buttons in a border-top footer. If the delete-confirm dialog should animate, copy this exact structure. For the minimal fix, the in-file `showDeleteConfirm` modal (ServiceEditorView.vue:202-228) is closer. CONTEXT D-14 (:41) explicitly names both as acceptable: "Reuse the existing Teleport modal pattern (as used by delete-service / NewServiceDialog.vue): backdrop z-40, dialog z-50, Cancel + red confirm buttons."

---

### `src/stores/services.ts` (store, CRUD)

**D-15 immediate-reorder persist target.** `updateService()` is the persist call for the reorder immediate-save (services.ts:78-84):
```typescript
async function updateService(id: string, data: Record<string, unknown>) {
  if (!orgId.value) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}
```
`assignSongToSlot()` (services.ts:91-116) and `clearSongFromSlot()` (services.ts:118-135) show the slot-map-then-`updateService` pattern; a lighter reorder persist (discretion CONTEXT :52) would be `updateService(serviceId, { slots: reindexedSlots })`. No signature change required — these are stable targets, likely unchanged this phase.

---

### `src/utils/pcSongImport.ts` (utility, transform)

**D-08 — themes ALREADY captured; D-02 — ensure tags round-trip.**

CONFIRMED: this is the PC import file that builds the upsert payload. `mapPcSongToUpsert()` ALREADY parses PC `themes` (pcSongImport.ts:86-92) and includes them in the payload (pcSongImport.ts:113-126):
```typescript
// themes ARE already parsed from PC (pcSongImport.ts:86-92):
const themes = attributes.themes
  ? attributes.themes.split(',').map((t) => t.trim()).filter(Boolean)
  : []

return {
  title: attributes.title,
  ccliNumber: attributes.ccli_number ?? '',
  author: attributes.author ?? '',
  themes,                       // ← D-08 already wired at the map layer
  notes: '',
  vwTypes,
  teamTags,
  arrangements: mappedArrangements,
  primaryArrangementId,
  lastUsedAt,
  pcSongId: pcSong.id,
  hidden: false,
  // ADD for D-01/D-02: tags: []   ← UpsertSongInput now requires tags
}
```
IMPORTANT nuance: D-08 says the map already exists but the MERGE was missing — currently `upsertSongs` spreads `restIncoming` which includes `themes`, so re-import OVERWRITES manually-added themes. The D-08 merge fix belongs in `songs.ts upsertSongs` (see above), NOT here. Here, only add `tags: []` to the returned object so the payload satisfies the extended `UpsertSongInput` type. `PcSongData.attributes` already declares `themes: string` (pcSongImport.ts:15-23). Existing tests in `src/utils/__tests__/pcSongImport.test.ts` will need the `tags: []` field in expected objects.

---

### `src/utils/claudeApi.ts` (utility, request-response)

**D-11 — broaden AI, no VW-type weighting.** `getSongSuggestions(params)` returns `Promise<AiSongSuggestion[] | null>` (claudeApi.ts:143-145) and receives `slotVwType` + `songLibrary` in `params` (claudeApi.ts:147-154). `AiSongSuggestion` is `{ songId, reason }` (claudeApi.ts:8-11). The library it suggests from is whatever the caller passes (built in `ServiceEditorView.suggestAllSongs`/`fetchAiForSlot`). D-11's "suggest broadly from whole non-hidden catalog, no VW weighting" is primarily a CALLER change (fix `librarySource` in ServiceEditorView per D-18, and stop passing type-weighted context). Within `claudeApi.ts`, review the system prompt / how `slotVwType` biases the model (claudeApi.ts:143-158+) and relax any hard VW-type instruction so picks are broad. Signature stays; `slotVwType` may become advisory-only or be dropped from the prompt.

---

## Shared Patterns

### Import-preservation (never clobber user data)
**Source:** `src/stores/songs.ts:147-172` — the `hidden: existing.hidden ?? false` preservation inside `upsertSongs`.
**Apply to:** the new `tags` field (D-02, must survive re-import) and `themes` merge (D-08, union not overwrite).
```typescript
const updateData: Record<string, unknown> = {
  ...restIncoming,
  hidden: existing.hidden ?? false,   // preserve
  updatedAt: serverTimestamp(),
}
// tags: existing.tags ?? []          // ADD — preserve user tags (never from import)
// themes: Array.from(new Set([...existing.themes, ...incoming.themes]))  // ADD — merge
```

### Legacy-field `[]` normalization on subscribe
**Source:** `src/stores/songs.ts:66-76` — `if (!Array.isArray(data.vwTypes)) data.vwTypes = ...`.
**Apply to:** default `tags` to `[]` for legacy docs (discretion CONTEXT :54).

### IntersectionObserver progressive rendering (BATCH_SIZE 50)
**Source:** `src/components/SongTable.vue:228-268` + sentinel `SongTable.vue:177`.
**Apply to:** `SongSlotPicker.vue` (D-12) — replace `slice(0, 15)` on both rotation and search lists.

### Static Tailwind class map (purge-safe variants)
**Source:** `src/components/SongBadge.vue:29-34` — literal `badgeClasses` object.
**Apply to:** `TeamTagPill.vue` new `variant` prop (D-06). Never build class strings dynamically (Tailwind v4 purges them).

### Teleport confirmation modal (z-40 backdrop / z-50 dialog, Cancel + red confirm)
**Source (minimal):** `src/views/ServiceEditorView.vue:202-228` (delete-service modal, already in-file).
**Source (animated):** `src/components/NewServiceDialog.vue:2-118` (dual Transition).
**Apply to:** delete-confirm for populated slots (D-14).

### Toggle-tag on a form array
**Source:** `src/components/SongSlideOver.vue:369-376` (`toggleSongTag`) + save payload `SongSlideOver.vue:407-420`.
**Apply to:** user `tags` in the song editor (D-04a).

### Slot-map then updateService (service slot mutation)
**Source:** `src/stores/services.ts:99-116` (`assignSongToSlot`).
**Apply to:** immediate reorder persist (D-15).

---

## No Analog Found

None. Every file in scope already exists with a directly-applicable in-file or sibling pattern.

---

## Metadata

**Analog search scope:** `src/types`, `src/utils`, `src/stores`, `src/components`, `src/views`, `src/utils/__tests__`.
**Files scanned:** song.ts, songSearch.ts, suggestions.ts, songs.ts, services.ts, claudeApi.ts, pcSongImport.ts, SongTable.vue, SongFilters.vue, TeamTagPill.vue, SongBadge.vue, SongSlideOver.vue, SongSlotPicker.vue, SongsView.vue, ServiceEditorView.vue, NewServiceDialog.vue, songSearch.test.ts.
**PC import file confirmed:** `src/utils/pcSongImport.ts` — `mapPcSongToUpsert()` (line 54) builds the `UpsertSongInput` and already parses `themes` (lines 86-92).
**Pattern extraction date:** 2026-06-30
