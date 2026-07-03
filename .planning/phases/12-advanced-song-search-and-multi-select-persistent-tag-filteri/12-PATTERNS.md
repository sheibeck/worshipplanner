# Phase 12: Advanced song search and multi-select persistent tag filtering - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 8 (6 modify, 1 create, 1 persistence helper — create)
**Analogs found:** 7 / 8 (localStorage persistence has no in-repo analog — new self-contained pattern)

All patterns below are from the SAME codebase the executor will edit. Prefer these verbatim over RESEARCH.md examples. Stack: Vue 3 `<script setup lang="ts">` + Pinia + Tailwind v4 + Firebase. Dark-mode canonical palette gray-950/900/800; indigo accent; pink for user-tag identity.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/utils/songSearch.ts` (MODIFY) | utility (pure function) | transform | itself — `songMatchesQuery()` (in-place extension) | exact |
| `src/stores/songs.ts` (MODIFY) | store (Pinia) | CRUD + filter-state | itself — `filteredSongs` computed + filter refs | exact |
| `src/components/TagFilterChecklist.vue` (CREATE) | component (shared control) | request-response (v-model emits) | `src/components/SongFilters.vue` (emit style) + `TeamTagPill.vue` (pink chip) | role-match |
| `src/components/SongFilters.vue` (MODIFY) | component (filter row) | request-response | itself (remove 2 `<select>`, mount `TagFilterChecklist`) | exact |
| `src/components/SongSlotPicker.vue` (MODIFY) | component (Teleport dropdown) | request-response | itself (swap 2 `<select>` for `TagFilterChecklist`, share engine) | exact |
| `src/views/SongsView.vue` (MODIFY) | view (host wiring) | request-response | itself (`SongFilters` ↔ store `v-model` binding block) | exact |
| `src/views/ServiceEditorView.vue` (MODIFY) | view (editor) | event-driven | itself — D-14 modal + `removeSlot()` gate | exact |
| shared tag-filter state + localStorage (CREATE — see D-14) | store/composable | file-I/O (localStorage) | `src/stores/songs.ts` ref+computed pattern; NO localStorage analog exists | partial (persistence new) |

**Integration recommendation (D-14, Claude's Discretion in CONTEXT):** Expose the shared tag-filter state (checked-tags Set + hide flag) from the **existing `songs` Pinia store** rather than a new composable. Rationale: `filteredSongs` already lives there and already consumes `songMatchesQuery`; both surfaces already import `useSongStore`/`songMatchesQuery`; `orgId` is already in that store for the persistence key. Lowest-friction integration per D-14 note.

---

## Pattern Assignments

### `src/utils/songSearch.ts` (utility, transform) — D-01 to D-05, D-07

**Analog:** itself. Current `songMatchesQuery()` is a single case-insensitive substring match. Extend to multi-term AND + `prefix:value` field scoping + natural two-word phrase pre-parse. Keep the function signature `(song: Song, query: string): boolean` so all callers (`songs.ts` line 40, `SongSlotPicker.vue` line 280) are unchanged.

**Current implementation to extend** (lines 10-31):
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
  if (song.tags?.some((t) => t.toLowerCase().includes(q))) return true
  if (song.notes?.toLowerCase().includes(q)) return true
  if (song.arrangements.some((a) => a.key.toLowerCase() === q)) return true

  return false
}
```

**Field set is authoritative** — a bare term (no prefix) must match this exact field union (D-03: "current `songMatchesQuery` field set"): title, ccliNumber, author, themes, teamTags, vwTypes (number + `VW_TYPE_LABELS[vw]`), tags (user), notes, arrangement key (exact).

**Prefix → field mapping (D-03/D-04):**
| Prefix | Field | Match rule |
|--------|-------|-----------|
| `type:` | `vwTypes` (number `1/2/3`) + `VW_TYPE_LABELS[vw]` | case-insensitive **substring** |
| `key:` | `arrangements[].key` | **exact**, case-insensitive (`key:E` ≠ Em/Eb) |
| `tag:` | `song.tags` (user tags) | case-insensitive substring |
| `theme:` | `song.themes` (PC themes) | case-insensitive substring |
| `team:` | `song.teamTags` | case-insensitive substring |
| (none) | full field union above | current per-field rules (key stays exact) |

**Implementation shape (Claude's Discretion on regex vs tokenizer; D-05 phrase pre-parse BEFORE splitting):**
```typescript
// 1. Pre-parse natural two-word phrases (D-05): "type 1" -> "type:1", "key A" -> "key:A"
//    ONLY these two patterns. A lone number/letter is NOT inferred (avoids false matches).
// 2. Tokenize on whitespace, BUT keep "prefix: value" (space after colon, D-02) as one token.
//    Both `key:E` and `key: E` must parse to prefix=key value=E (trim after colon).
// 3. Every token must match (AND, D-01). A prefixed token checks only its field;
//    a bare token runs the existing full-field substring check.
export function songMatchesQuery(song: Song, query: string): boolean {
  // ...pre-parse -> tokens -> tokens.every(t => matchesToken(song, t))
}
```
Keep `getPrimaryArrangement()` / `getPrimaryKey()` (lines 37-48) untouched — unrelated exports.

**Convention:** `import type { Arrangement, Song } from '@/types/song'` and `import { VW_TYPE_LABELS } from '@/types/song'` (path alias `@/`, `import type` for types). Keep this style.

---

### `src/stores/songs.ts` (store, filter-state) — D-08 to D-14

**Analog:** itself. Rework the two user-tag string refs into the new checklist model + persistence, and update `filteredSongs`.

**Current filter refs to change** (lines 27-32):
```typescript
const searchQuery = ref('')
const filterVwType = ref<1 | 2 | 3 | 'uncategorized' | null>(null)
const filterKey = ref('')
const filterTag = ref('')
const filterTagInclude = ref('')   // ← REMOVE (single-tag "show only")
const filterTagExclude = ref('')   // ← REMOVE (single-tag "hide")
```

**Replace with checklist model (D-08/D-09/D-10):**
```typescript
// Checked user tags (OR-combined in show mode; exclusion set in hide mode)
const tagFilterChecked = ref<Set<string>>(new Set())
// D-10: false = show-only (default), true = hide checked tags
const tagFilterHide = ref(false)
```

**Current `filteredSongs` computed to update** (lines 36-63) — replace the two `matchesTagInclude`/`matchesTagExclude` lines with the checklist logic; keep everything else (hidden guard, search, vwType, key, team-tag) intact:
```typescript
const filteredSongs = computed(() => {
  return songs.value.filter((song) => {
    if (song.hidden === true) return false
    const matchesSearch = songMatchesQuery(song, searchQuery.value)
    const matchesVwType = filterVwType.value === null || /* ...unchanged... */
    const matchesKey = !filterKey.value || song.arrangements.some((a) => a.key === filterKey.value)
    const matchesTag = !filterTag.value || song.teamTags.includes(filterTag.value)

    // D-09/D-10: checklist replaces include/exclude selects
    const checked = tagFilterChecked.value
    let matchesUserTags = true
    if (checked.size > 0) {
      const carriesChecked = (song.tags ?? []).some((t) => checked.has(t))
      matchesUserTags = tagFilterHide.value ? !carriesChecked : carriesChecked
    }
    return matchesSearch && matchesVwType && matchesKey && matchesTag && matchesUserTags
  })
})
```

**Clear action (D-11):** add a `clearTagFilter()` that does `tagFilterChecked.value = new Set(); tagFilterHide.value = false` (scoped to tags only — does NOT touch `searchQuery`/`filterVwType`/`filterKey`).

**Persistence (D-12/D-13) — NO in-repo analog; new self-contained pattern.** Nothing in `src/` uses `localStorage` today. Introduce it here (or in a tiny helper the store imports). Guidance:
- Persist ONLY `tagFilterChecked` (as array) + `tagFilterHide`. Not search/vwType/key (D-12).
- Key per user/org to avoid cross-account bleed (D-13). Derive from `useAuthStore().user?.uid` and/or store's own `orgId.value` (already present, lines 24/69). Example key: `wp:tagFilter:v1:${orgId}:${uid}`.
- Serialize `Set` via `Array.from(...)`; deserialize via `new Set(parsed)`.
- Wrap read AND write in `try/catch` — **fail silently** to in-memory-only (UI-SPEC error contract: quota/private-mode degrade gracefully, no user-facing error).
- Save via a Pinia `watch([tagFilterChecked, tagFilterHide], persist, { deep: true })`, and hydrate on store init / when `orgId`+`uid` become known (auth resolves async — hydrate after both are set; mirror how `subscribe(orgId)` is called from the view once `authStore.orgId` resolves).

**Existing error-handling convention in this store** (upsert path, lines 236-242 use `error: unknown` casts elsewhere; store methods are plain async). For localStorage, use a minimal guard:
```typescript
try { localStorage.setItem(key, JSON.stringify(payload)) } catch { /* ignore: private mode / quota */ }
```

**Export additions** in the `return { ... }` block (lines 221-240): add `tagFilterChecked`, `tagFilterHide`, `clearTagFilter`, and remove `filterTagInclude`, `filterTagExclude`.

**Convention:** store uses `ref`/`computed` from `'vue'`, `defineStore('songs', () => {...})` setup style, path alias imports (`@/firebase`, `@/types/song`, `@/utils/songSearch`).

---

### `src/components/TagFilterChecklist.vue` (CREATE — component, request-response) — D-08 to D-11, UI-SPEC "Tag checklist"

**Analog for emit/prop shape:** `SongFilters.vue`. **Analog for pink chip styling:** `TeamTagPill.vue` `user` variant. **Analog for scroll containment:** `SongSlotPicker.vue` dropdown (`max-h-[600px] overflow-y-auto`).

This is a single shared SFC consumed by BOTH `SongFilters.vue` and `SongSlotPicker.vue` (D-07/D-14). It should be **presentational + v-model** — bind to the store's shared state via `v-model` at the two call sites (do NOT let it read the store directly, so it stays reusable and testable). Recommended props/emits (v-model convention matches `SongFilters.vue` lines 91-110):

```typescript
const props = defineProps<{
  availableUserTags: string[]        // distinct Song.tags across catalog (computed in host)
  checkedTags: Set<string>           // v-model:checkedTags -> store.tagFilterChecked
  hide: boolean                      // v-model:hide -> store.tagFilterHide
}>()
const emit = defineEmits<{
  'update:checkedTags': [value: Set<string>]
  'update:hide': [value: boolean]
  clear: []                          // host calls store.clearTagFilter()
}>()
```
Toggling a row emits a NEW Set (immutable update, so Vue reactivity fires): `const next = new Set(props.checkedTags); next.has(tag) ? next.delete(tag) : next.add(tag); emit('update:checkedTags', next)`.

**Emit convention to copy from `SongFilters.vue`** (the `$emit('update:X', ...)` + `defineEmits` pattern):
```typescript
// SongFilters.vue lines 103-110
const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:filterVwType': [value: 1 | 2 | 3 | 'uncategorized' | null]
  // ...
}>()
```

**Checkbox row styling (UI-SPEC Interaction contract).** Per row: `py-1` density, inside `max-h-48 overflow-y-auto` bounded scroll container. Checked = pink identity (from `TeamTagPill.vue` `user` variant), focus ring indigo. Unchecked border matches existing inputs (`border-gray-700` on `bg-gray-800`).

**Pink `user` variant to carry forward** (`TeamTagPill.vue` lines 17-21 — static map avoids Tailwind v4 purge of dynamic strings; replicate this static-class discipline for any variant/state classes):
```typescript
const variantClasses = {
  team:  'bg-gray-800 text-gray-400 border-gray-700',
  theme: 'bg-teal-900/50 text-teal-300 border-teal-800',
  user:  'bg-pink-900/50 text-pink-300 border-pink-800',  // ← checked chip identity
} as const
```
Checked row/checkbox: `border-pink-800 bg-pink-900/50 text-pink-300`; focus ring: `focus:outline-none focus:ring-1 focus:ring-indigo-500` (app-wide accent — do NOT recolor focus ring to pink).

**"Hide tags" toggle (UI-SPEC):** small checkbox/switch at top, label `"Hide tags"`, `title="Invert: hide checked tags instead of showing only them"`. Indigo-accented when ON (`bg-indigo-600` / `text-indigo-*`). When ON, apply a persistent whole-list cue (e.g. a `(hiding)` caption near the header) so inverted mode is legible even when the toggle scrolls out of view.

**"Clear tags" action (UI-SPEC / D-11):** plain gray text link, NOT accent-colored — copy the "Change song" link style verbatim from `SongSlotPicker.vue` line 19:
```html
class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
```
Label `"Clear tags"`, `title="Clear tag filter"`. Emits `clear` (host resets store).

**Empty state (UI-SPEC copywriting):** when `availableUserTags.length === 0` — heading `"No tags yet"`, body `"Add tags to songs in the Songs panel to filter by them here."` Copy the existing muted empty-state style used in `SongSlotPicker.vue` lines 156-162 (`text-sm text-gray-400` heading + `text-xs text-gray-500` body, centered `px-4 py-6 text-center`).

**Typography (UI-SPEC):** rows/labels use weight **400** (regular); emphasis (toggle-on, heading) uses **600** (semibold). Do NOT use `font-medium` (500) in this new component — that legacy weight is intentionally excluded this phase.

---

### `src/components/SongFilters.vue` (MODIFY, component) — D-06, D-08

**Analog:** itself. Keep the search input (lines 22-28) and the VW-type/Key/team-tag `<select>`s (lines 35-65) — D-06 says dropdowns stay. **Remove ONLY the two user-tag selects** (lines 67-85, the `focus:ring-pink-500` ones bound to `filterTagInclude`/`filterTagExclude`) and mount `<TagFilterChecklist>` in their place.

Drop these from props/emits (lines 96-97, 108-109): `filterTagInclude`, `filterTagExclude`, `update:filterTagInclude`, `update:filterTagExclude`. Add binding for the checklist (bound to store via the host, see SongsView below). Keep `availableUserTags` prop (already computed in `SongsView.vue` lines 226-232).

**Existing input styling to preserve** (search box, line 27) — reuse verbatim for consistency:
```html
class="w-full rounded-md bg-gray-800 border border-gray-700 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
```
Placeholder stays `"Search title, CCLI, theme, tag, category..."` (UI-SPEC — may add a `title=` tooltip for `tag:`/`key:`/`type:`/`theme:`/`team:` but must NOT grow input height).

---

### `src/components/SongSlotPicker.vue` (MODIFY, component) — D-07, D-14

**Analog:** itself. Two changes: (1) already imports and calls the shared `songMatchesQuery` (line 214, 280) — no engine change needed here, it inherits the D-01–D-05 upgrade for free. (2) Replace the two local tag `<select>`s (lines 48-64) + their local state (`includeTag`/`excludeTag` lines 249-250, `tagFilteredSongs` lines 262-268, watches lines 336-337) with the SHARED `<TagFilterChecklist>` bound to the store's shared tag state (D-14).

**Current local tag filter to remove** (lines 249-268):
```typescript
const includeTag = ref('')
const excludeTag = ref('')
const tagFilteredSongs = computed<Song[]>(() =>
  props.songs.filter(
    (s) =>
      (!includeTag.value || (s.tags?.includes(includeTag.value) ?? false)) &&
      (!excludeTag.value || !(s.tags?.includes(excludeTag.value) ?? false)),
  ),
)
```
Rework `tagFilteredSongs` to consume the SHARED store state (checked Set + hide flag), matching the store's `filteredSongs` OR/hide logic, so picker and panel behave identically. The picker receives `:songs="songStore.songs"` (ServiceEditorView line 577); it can `import { useSongStore } from '@/stores/songs'` to read the shared `tagFilterChecked`/`tagFilterHide`, OR the checklist binds via `v-model` to store refs directly at this call site. Keep `searchResults` (lines 276-291) reading from the (now shared-)tag-filtered base.

**Sticky header placement (UI-SPEC + quick-task 260701-awp):** the checklist replaces the two `<select>`s inside the existing sticky bar (lines 40-65). Keep the compact `p-2` padding and `sticky top-0 z-10 bg-gray-800` container. Do NOT reintroduce vertical bloat. Placeholder stays `"Search songs..."`.

**Existing picker search input styling** (line 46) — leave as-is:
```html
class="w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
```

**Keep the load-more IntersectionObserver batching** (lines 303-359). Update the reset watches (lines 336-337) that currently watch `includeTag`/`excludeTag` to instead watch the shared store tag state so `visibleCount` resets on filter change.

---

### `src/views/SongsView.vue` (MODIFY, view wiring) — D-11, D-14

**Analog:** itself — the `<SongFilters v-model:.../>` block (lines 65-75). Remove the two removed v-model bindings; keep the rest. The `availableUserTags` computed (lines 226-232) already exists — reuse it as the checklist's tag universe.

**Current binding block to edit** (lines 65-75):
```html
<SongFilters
  v-model:searchQuery="songStore.searchQuery"
  v-model:filterVwType="songStore.filterVwType"
  v-model:filterKey="songStore.filterKey"
  v-model:filterTag="songStore.filterTag"
  v-model:filterTagInclude="songStore.filterTagInclude"   <!-- REMOVE -->
  v-model:filterTagExclude="songStore.filterTagExclude"   <!-- REMOVE -->
  :availableKeys="availableKeys"
  :availableTags="availableTags"
  :availableUserTags="availableUserTags"
/>
```
Replace the two removed lines with the shared checklist bindings (e.g. `v-model:checkedTags="songStore.tagFilterChecked"`, `v-model:hide="songStore.tagFilterHide"` passed through `SongFilters` to `TagFilterChecklist`, and wire `@clear="songStore.clearTagFilter()"`). `availableUserTags` computed to reuse (lines 226-232):
```typescript
const availableUserTags = computed(() => {
  const tags = new Set<string>()
  songStore.songs.forEach((song) => { (song.tags ?? []).forEach((tag) => tags.add(tag)) })
  return Array.from(tags).sort()
})
```

**Store lifecycle to mirror for persistence hydration** (lines 280-299): `subscribe(orgId)` is called from `onMounted` once `authStore.orgId` resolves. Hydrate the persisted tag filter at an analogous point (after uid+orgId known).

---

### `src/views/ServiceEditorView.vue` (MODIFY, view) — D-15, D-16

**Analog:** itself — the D-14 modal is reused VERBATIM; only two changes: (1) `removeSlot()` gating widens to include empty slots, (2) heading/body copy becomes element-type-aware and generic. Do NOT build a second modal.

**Gating change — `removeSlot()` (lines 1341-1354).** Today empty slots delete silently via `performRemoveSlot(index)`. D-15 requires ALL removals to confirm:
```typescript
function removeSlot(index: number) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  // D-15: confirm ALL element removals, including empty/blank rows (was: only isSlotPopulated)
  pendingDeleteIndex.value = index
  pendingDeleteIsClear.value = false
  showSlotDeleteConfirm.value = true
}
```
`isSlotPopulated()` (lines 1314-1331) is NO LONGER used to gate `removeSlot` — but keep it (it may still be referenced elsewhere; verify usages before deleting). `onClearSong()` (lines 1388-1404) is a DISTINCT action and keeps its OWN existing D-14 gate/copy (D-16 note) — do not touch it.

**Modal state to reuse as-is** (lines 956-959):
```typescript
const showSlotDeleteConfirm = ref(false)
const pendingDeleteIndex = ref<number | null>(null)
const pendingDeleteIsClear = ref(false)
```

**`confirmSlotDelete()` (lines 1356-1371)** already handles both the clear path (`pendingDeleteIsClear`) and the remove path (`performRemoveSlot`). No change needed to its logic — the empty-slot case flows through `performRemoveSlot(pendingDeleteIndex.value)` unchanged.

**Modal markup to REUSE (only heading/body copy generalizes)** — lines 230-254:
```html
<!-- Slot delete confirmation dialog (D-14) -->
<Teleport to="body">
  <div v-if="showSlotDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
      <h2 class="text-base font-semibold text-gray-100 mb-2">Remove this item?</h2>          <!-- ← change copy -->
      <p class="text-sm text-gray-400 mb-6">This will delete the assigned song, ...</p>       <!-- ← change copy -->
      <div class="flex justify-end gap-3">
        <button type="button"
          @click="showSlotDeleteConfirm = false; pendingDeleteIndex = null; pendingDeleteIsClear = false"
          class="rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700">
          Cancel
        </button>
        <button type="button" @click="confirmSlotDelete"
          class="rounded-md px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors">
          Remove
        </button>
      </div>
    </div>
  </div>
</Teleport>
```

**Copy change (UI-SPEC copywriting contract — D-16 generic wording):**
- Heading: `"Remove this element from the plan?"`
- Body: `"This will remove {element type} from the service plan. This cannot be undone."` where `{element type}` is `"this song"` / `"this scripture"` / `"this element"` etc. Derive from `slot.kind` (`SlotKind = 'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE' | 'HYMN'`, `src/types/service.ts:6`) at gating time — e.g. store a `pendingDeleteKind` or compute a label from `slots[pendingDeleteIndex]`.
- Buttons stay EXACTLY `"Cancel"` / `"Remove"` (red-700→red-600). Do NOT rename to "Delete"/"Confirm".

**Note — the modal shares state with the clear-song path.** When the modal is opened by `onClearSong()` (`pendingDeleteIsClear = true`) it should keep the clear-oriented copy, while `removeSlot()` (`pendingDeleteIsClear = false`) uses the new element-removal copy. Since one modal serves both, drive the heading/body off `pendingDeleteIsClear` (and the element kind) so each entry point reads correctly. This is a copy branch, not a second modal.

---

## Shared Patterns

### Pinia setup-store filter state
**Source:** `src/stores/songs.ts` lines 21-63, 221-240
**Apply to:** the new shared tag-filter state.
```typescript
export const useSongStore = defineStore('songs', () => {
  const filterKey = ref('')                       // ref-per-filter pattern
  const filteredSongs = computed(() => songs.value.filter((song) => { /* AND of matchers */ }))
  return { /* expose every ref + computed + action */ }
})
```

### v-model component binding (parent ↔ store)
**Source:** `src/views/SongsView.vue` lines 65-75 (host) + `src/components/SongFilters.vue` lines 22-28, 91-120 (child)
**Apply to:** `TagFilterChecklist` mounting in both `SongFilters` and `SongSlotPicker`.
Child reads `:value` / props, emits `update:X`; parent binds `v-model:X="store.X"`. Non-trivial casts go through a handler (see `onVwTypeChange`, `SongFilters.vue` lines 112-120).

### Teleport confirmation modal (backdrop + red confirm)
**Source:** `src/views/ServiceEditorView.vue` lines 230-254
**Apply to:** D-15 empty-slot confirmation (REUSE this exact modal). Backdrop `fixed inset-0 z-50 bg-black/60`; dialog `bg-gray-900 border-gray-700 rounded-xl shadow-2xl p-6 max-w-sm`; heading `text-base font-semibold text-gray-100`; body `text-sm text-gray-400`; Cancel = gray, confirm = `bg-red-700 hover:bg-red-600`.
> Note: CONTEXT D-16 references "backdrop z-40 / dialog z-50" from Phase 11; the ACTUAL current markup uses a single `z-50` overlay (`fixed inset-0 z-50 ... bg-black/60`) containing the dialog. Match the CURRENT markup above, not the historical description.

### Pink = user-tag identity
**Source:** `src/components/TeamTagPill.vue` lines 17-21
**Apply to:** checked chips/rows in `TagFilterChecklist`. `bg-pink-900/50 text-pink-300 border-pink-800`. Use a static class map (never dynamic string concatenation) so Tailwind v4 does not purge the classes.

### Focus ring accent
**Source:** ubiquitous — `SongFilters.vue` line 27, `SongSlotPicker.vue` line 46, `ServiceEditorView.vue` line 745
**Apply to:** all new interactive controls. `focus:outline-none focus:ring-1 focus:ring-indigo-500` (indigo is the app-wide interactive accent; pink is identity-only, not focus).

### Muted empty-state block
**Source:** `src/components/SongSlotPicker.vue` lines 156-162
**Apply to:** `TagFilterChecklist` "No tags yet" and picker "No songs match" states. `px-4 py-6 text-center`, heading `text-sm text-gray-400`, body `text-xs text-gray-500`.

### Ghost/link action styling
**Source:** `src/components/SongSlotPicker.vue` line 19 ("Change song"); `src/views/SongsView.vue` line 102 ("Clear selection")
**Apply to:** "Clear tags" action. `text-xs text-gray-500 hover:text-gray-300 transition-colors`.

---

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| localStorage persistence of tag filter (D-12/D-13) | store/composable | file-I/O | No `localStorage` usage exists anywhere in `src/` yet. New self-contained pattern. Follow guidance in the `songs.ts` section: JSON-serialize (Set→Array), per-user/org key from `authStore.user?.uid` + store `orgId`, `try/catch` silent-fail, `watch`-to-persist + hydrate-on-init. No prior in-repo example to copy; RESEARCH.md/standard localStorage idioms apply. |

---

## Metadata

**Analog search scope:** `src/utils/`, `src/stores/`, `src/components/`, `src/views/`, `src/types/`
**Files read for extraction:** `songSearch.ts`, `songs.ts`, `auth.ts`, `SongFilters.vue`, `SongSlotPicker.vue`, `SongsView.vue`, `ServiceEditorView.vue` (lines 225-289, 740-820, 1300-1404, 956-959), `TeamTagPill.vue`, `types/song.ts`, `types/service.ts`
**Pattern extraction date:** 2026-07-01
