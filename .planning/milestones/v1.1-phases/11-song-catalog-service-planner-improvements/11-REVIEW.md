---
phase: 11-song-catalog-service-planner-improvements
reviewed: 2026-07-01T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/components/ScriptureInput.vue
  - src/components/SongFilters.vue
  - src/components/SongSlideOver.vue
  - src/components/SongSlotPicker.vue
  - src/components/SongTable.vue
  - src/components/TeamTagPill.vue
  - src/stores/songs.ts
  - src/types/song.ts
  - src/utils/claudeApi.ts
  - src/utils/csvImport.ts
  - src/utils/pcSongImport.ts
  - src/utils/songSearch.ts
  - src/utils/suggestions.ts
  - src/views/ServiceEditorView.vue
  - src/views/SongsView.vue
findings:
  critical: 0
  warning: 6
  info: 8
  total: 14
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-01
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the Phase 11 source changes: the user-controlled `tags` field, full-field search, PC re-import tag/theme preservation, the service-editor drag/delete/autosave fixes, catalog browsing UX (sorting, pills, bulk tag editing), and the browsable `SongSlotPicker` with IntersectionObserver batching.

Overall the code is careful and defensive — legacy-doc normalization (`vwTypes`/`tags`), tag/theme preservation on upsert, and the autosave in-flight guards are all handled well. No critical security or data-loss issues were found. Vue `{{ }}` interpolation is used throughout, so there is no template HTML-injection surface.

The main correctness concern is a **key-selection inconsistency** in `SongSlotPicker`: selecting a song assigns `arrangements[0].key` instead of the primary/play key that the rest of the UI displays (`getPrimaryKey`), which undercuts the phase's own primary-key feature. There is also an **unsanitized user-controlled `href`** on Prayer/Message link slots (a `javascript:` URL vector) that is worth hardening given services are shareable. The remaining items are reactivity/robustness edge cases and quality cleanups.

## Warnings

### WR-01: Song picker assigns the first arrangement's key, not the primary/play key

**File:** `src/components/SongSlotPicker.vue:435-437`
**Issue:** `onSelect` builds the emitted key from `song.arrangements[0]?.key`, but the picker *displays* `preferredKey(song)` → `getPrimaryKey(song)` (which honors `primaryArrangementId`). For any song whose primary arrangement is not `arrangements[0]`, the slot gets a different key than the one shown in the list — directly contradicting the Phase 11 primary-key feature. The AI-accept path (`ServiceEditorView.acceptAiSong` → `getPrimaryKey`) and the CSV/PC import path both use the primary key, so only manual picker selection is inconsistent.
**Fix:**
```ts
import { getPrimaryKey } from '@/utils/songSearch'

function onSelect(song: Song) {
  const key = getPrimaryKey(song)
  emit('select', { id: song.id, title: song.title, key })
  closeDropdown()
}
```

### WR-02: Unsanitized user-controlled URL rendered into `href` (javascript: vector)

**File:** `src/views/ServiceEditorView.vue:648-655, 663-668, 694-701, 709-715`
**Issue:** Prayer/Message `linkUrl` is stored free-text and bound directly to `:href` for both editor and viewer. A value such as `javascript:alert(document.cookie)` would execute on click. Services are shareable (`createShareToken` / `/share/:token`), so a malicious or careless editor can persist a link that later runs in a viewer's context. `type="url"` on the input is not a security control (it only validates on form submit and does not block `javascript:`).
**Fix:** Validate/normalize the scheme before binding, e.g. a helper that only allows `http(s):` and `mailto:`:
```ts
function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : undefined
  } catch {
    return undefined
  }
}
```
Bind `:href="safeHref((slot as NonAssignableSlot).linkUrl)"` and hide the anchor when it returns `undefined`.

### WR-03: `sortKey` mixes number and string and compares them inconsistently

**File:** `src/components/SongTable.vue:315-337`
**Issue:** `sortKey` returns a number for `category`/`ccli`/`lastUsed` and a string for `title`/`key`. The comparator only takes the numeric branch when *both* values are numbers. For the `category` sort, `song.vwTypes[0] ?? 99` yields a number, so that path is fine — but any song where `vwTypes` is momentarily a non-array (pre-normalization for a freshly written doc) would make `vwTypes[0]` throw. More concretely, `Number(song.ccliNumber) || 0` collapses all non-numeric/empty CCLIs to `0`, so blank and `"0"` CCLIs sort identically and cannot be distinguished from real zeros. Low-risk but produces surprising orderings.
**Fix:** Normalize per-field: for `ccli`, sort empty/blank last explicitly (e.g. return `Number.POSITIVE_INFINITY` for blank when ascending), and guard `vwTypes` with `(song.vwTypes ?? [])[0] ?? 99`.

### WR-04: `formatDate` calls `.toMillis()` / `.toDate()` on values that may be plain objects

**File:** `src/components/SongTable.vue:320, 456-463`
**Issue:** `sortKey` does `song.lastUsedAt?.toMillis()` and `formatDate` does `ts.toDate ? ts.toDate() : ...`. When a song doc is written locally (optimistic `serverTimestamp()` before the server round-trip) `lastUsedAt` can transiently be `null` or a non-Timestamp shape. `formatDate` is wrapped in try/catch, but `sortKey`'s `.toMillis()` is not — an unexpected shape there throws inside the `computed`, breaking the whole table render. The `?.` guards against `null`/`undefined` but not against an object lacking `toMillis`.
**Fix:** Guard on method presence: `return typeof song.lastUsedAt?.toMillis === 'function' ? song.lastUsedAt.toMillis() : 0`.

### WR-05: `onSave` derives the slot index from `localService` but writes via the store copy

**File:** `src/views/ServiceEditorView.vue:2106-2117` (with `src/stores/services.ts:91-111`)
**Issue:** For each newly-assigned song, `onSave` calls `assignSongToSlot(id, localService.value.slots.indexOf(songSlot), ...)`. `indexOf` is computed against the **local** slot array, but `assignSongToSlot` applies that index to the **store's** `services.value` copy. If the store copy and local copy have diverged (e.g. a concurrent remote update, or the immediate reorder-save path at lines 1011-1045 landed between edits), the index can point at the wrong slot and overwrite it. Immediately afterward `updateService(id, { slots: reindexSlots(data.slots) })` re-persists the full local slot array, so the net slot state is usually corrected — but the intermediate `assignSongToSlot` write can still momentarily clobber an unrelated slot and fire an extra Firestore write. The `assignSongToSlot` call here is redundant with the subsequent full-slot write; its only unique effect is `lastUsedAt`.
**Fix:** Drop the per-slot `assignSongToSlot` writes and instead update `lastUsedAt` directly on the song docs for `newSongIds` (a dedicated store method), then let the single `updateService(slots)` own the slot persistence.

### WR-06: Manual DOM reordering in the Sortable `onEnd` handler is index-fragile

**File:** `src/views/ServiceEditorView.vue:1014-1025`
**Issue:** The D-16 fix reverts SortableJS's move via `parent.insertBefore(evt.item, parent.children[evt.oldIndex] ...)`, relying on `parent.children` indices that SortableJS has *already mutated* by the time `onEnd` runs. Reading `parent.children[evt.oldIndex]` after the move can reference the wrong sibling (the moved node itself is still in its new DOM position), so the "revert" can insert at an off-by-one location. It usually self-corrects because Vue re-renders from `reindexed` on the next tick, but during that window the DOM order and the reactive order disagree, which is exactly the snap-back class of bug this code is trying to prevent. Note also the shadowing: the local `const ref` (line 1017) shadows the auto-imported Vue `ref`, which is confusing in this file.
**Fix:** Prefer letting Vue own the DOM entirely — either set `sortable`'s `onEnd` to not mutate and rely purely on reactive re-render (SortableJS + Vue integrations typically move the model, not the DOM), or capture the sibling reference *before* any DOM mutation. Rename the local `ref` variable to avoid shadowing.

## Info

### IN-01: `toggleUserTag` is dead code

**File:** `src/components/SongSlideOver.vue:422-429`
**Issue:** `toggleUserTag` is defined but never referenced in the template or script (user tags are managed via `addUserTags`/`removeUserTag`).
**Fix:** Remove the unused function.

### IN-02: `isComplete` / `checkScriptureOverlap` kept alive with `void` to suppress unused warnings

**File:** `src/components/ScriptureInput.vue:293-296, 468` and `src/views/ServiceEditorView.vue:1634-1642`
**Issue:** Both computed/functions exist only to satisfy a future use, kept via `void isComplete` / `void checkScriptureOverlap`. This is dead code carried in the bundle and obscures intent.
**Fix:** Remove until actually needed; git history preserves them.

### IN-03: Debug `console.log` left in imported handler

**File:** `src/views/SongsView.vue:313`
**Issue:** `console.log(\`[SongsView] imported ${count} songs\`)` is a debug artifact in a user-facing handler.
**Fix:** Remove or gate behind a dev-only logger.

### IN-04: Unused `router` import in ServiceEditorView / unused `VWType`/`toggleUserTag` symbols

**File:** `src/views/SongsView.vue:168, 182` and related
**Issue:** `useRouter`/`router` is used (query cleanup) so it is fine, but confirm `router` in `SongsView` is only used once; several files carry symbols that are only referenced in commented/`void`'d paths. Minor cleanup opportunity across the phase.
**Fix:** Run `vue-tsc --noEmit` / eslint `no-unused-vars` and prune.

### IN-05: `availableTags` in SongSlideOver recomputed by scanning the whole store on every keystroke context

**File:** `src/components/SongSlideOver.vue:363-373`
**Issue:** `availableTags`/`songLevelTags` iterate every song and every arrangement to build a tag set. It is a `computed` (cached) so this only re-runs when `songStore.songs` changes, which is acceptable, but the same set is derived independently in `SongsView` (`availableTags`) and `SongSlotPicker` (`availableTags`). Three near-identical derivations risk drift.
**Fix:** Extract a shared `deriveTeamTags(songs)` / `deriveUserTags(songs)` helper in `utils/songSearch.ts`.

### IN-06: IntersectionObserver re-observes without unobserving; sentinel lifecycle relies on teleport timing

**File:** `src/components/SongSlotPicker.vue:344-356, 419-425`
**Issue:** `onMounted` calls `observer.observe(sentinelRef.value)` when the dropdown (and thus the teleported sentinel) is not yet rendered, so `sentinelRef.value` is `null` and the observe is a no-op; `openDropdown` re-observes after `nextTick`. Observing the same element twice is harmless (the spec dedupes), but the intent is murky and a future change to the sentinel element would leave a stale observation. `SongTable` has the same on-mount observe that works only because its sentinel is always in the DOM.
**Fix:** Observe only inside the `openDropdown` `nextTick` (drop the `onMounted` observe for the teleported case), and `observer.unobserve` on close.

### IN-07: `existingCcliNumbers` add/update counting can double-count a song as "updated"

**File:** `src/utils/pcSongImport.ts:280-291`
**Issue:** The added/updated tally in `importFromPc` classifies an incoming song as existing if it matches *any* of pcSongId / CCLI / title. That mirrors `upsertSongs` matching order, but the counts are computed against the pre-import store snapshot while `upsertSongs` matches incrementally; two incoming rows that collapse onto the same existing song (e.g. same title, blank CCLI) will both be counted as "updated," overstating the number. Cosmetic (summary only), no data impact.
**Fix:** Track a `Set` of already-matched existing IDs while tallying, mirroring the upsert loop, or compute the summary from `upsertSongs`' actual results.

### IN-08: `:key` on AI scripture results uses array index

**File:** `src/components/ScriptureInput.vue:57-58`
**Issue:** `v-for="(result, ri) in aiResults" :key="ri"` keys by index. Because `aiResults` is replaced wholesale (never spliced) and `expandedPreview` is also index-based, this is currently safe, but index keys are fragile if the list ever becomes mutable in place (stale preview expansion on the wrong row).
**Fix:** Key by a stable identity, e.g. `` `${result.book}-${result.chapter}-${result.verseStart}-${result.verseEnd}` ``.

---

_Reviewed: 2026-07-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
