---
phase: 140-vamps-library-crud-storage
reviewed: 2026-09-13T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - storage.rules
  - src/components/VampSlideOver.vue
  - src/components/VampTable.vue
  - src/components/__tests__/VampSlideOver.test.ts
  - src/components/__tests__/VampTable.test.ts
  - src/composables/useVampFileUpload.ts
  - src/composables/__tests__/useVampFileUpload.test.ts
  - src/constants/keys.ts
  - src/rules.test.ts
  - src/storage.rules.test.ts
  - src/stores/orgScopedStores.ts
  - src/stores/vamps.ts
  - src/stores/__tests__/orgScopedStores.test.ts
  - src/stores/__tests__/vamps.test.ts
  - src/types/vamp.ts
  - src/utils/vampFiles.ts
  - src/utils/__tests__/vampFiles.test.ts
  - src/views/SongsView.vue
  - src/views/__tests__/SongsView.test.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 140: Code Review Report

**Reviewed:** 2026-09-13
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

`storage.rules`' new `vamp-files/` block and its catch-all exclusion are correct and well-tested — the
claim-only membership check, the editor gate on create/delete, the `audio/mpeg`-only + <50MB constraint,
the immutable `update: if false`, and the mandatory catch-all regex exclusion (with a dedicated regression
test proving the OR-combination fix) all mirror the already-shipped `song-files/` block faithfully. Church-
switch safety (`orgScopedStores.ts` + `SongsView.vue`'s two `watch(() => authStore.orgId, ...)` registrations)
is also correctly wired and tested.

The two real defects are both in the client feature surface, not the Storage rules: (1) `useVampFileUpload`'s
upload-progress/error/rejection state (`uploads`, `announcement`) is fully implemented but never rendered —
`VampSlideOver.vue` destructures only `addFile`, so a rejected or failed MP3 upload gives the user **zero**
feedback, unlike the `SongFilesTab.vue` pattern it claims to mirror; and (2) `SongsView.vue` passes the
already-search-filtered `vampStore.filteredVamps` as `VampTable`'s `vamps` prop, which the component's own
design assumes is the *unfiltered* list — collapsing the "no search matches" state into the "library is
empty" state and showing wrong sub-head counts while a search is active. A secondary, lower-severity gap is
that MP3 replace/remove never deletes the superseded Storage object, unlike the `removeSongAttachment`/
`hardDeleteSong` pattern it's meant to narrow.

## Critical Issues

### CR-01: MP3 upload failures/rejections are silently swallowed — no progress, error, or rejection UI

**File:** `src/components/VampSlideOver.vue:280` (and the whole MP3 section, `src/components/VampSlideOver.vue:121-207`)
**Issue:**
`useVampFileUpload()` returns `uploads` (per-file `uploading`/`error`/`rejected` rows with a user-facing
`message`) and `announcement` (an aria-live completion string) — see `src/composables/useVampFileUpload.ts:30-36`
and the `'error'`/`'rejected'` status writes at `src/composables/useVampFileUpload.ts:121-128` and `156-161`.
`VampSlideOver.vue` destructures only `addFile`:
```ts
const { addFile } = useVampFileUpload()
```
and never references `uploads`, `announcement`, `dismiss`, or `reset` anywhere in its template. Concretely:
- Drop a >50MB file, or a non-MP3, or lose network mid-upload → `addFile` pushes a `rejected`/`error` row with
  a message like `"'huge.mp3' is too large — max 50 MB."` — and the UI shows **nothing**. The dashed drop-zone
  just sits there unchanged; the user has no idea the attach failed.
- There is also no in-progress indicator, so a user can click the drop-zone again mid-upload and start a
  second upload for the same vamp; both eventually resolve and race on `updateVamp`, last-write-wins.

This is exactly the analog `SongFilesTab.vue` gets right — it renders both `uploads` (progress/error rows,
`src/components/SongFilesTab.vue:66-68`) and `announcement` (`src/components/SongFilesTab.vue:59-62`). The
Vamp editor's narrowed single-slot mirror dropped that half of the pattern.
**Fix:** Destructure `uploads`/`announcement` and render them, mirroring `SongFilesTab.vue`'s rows:
```ts
const { addFile, uploads } = useVampFileUpload()
```
```html
<div v-if="uploads.length > 0" class="space-y-2" data-testid="vamp-mp3-upload-rows">
  <div v-for="row in uploads" :key="row.id" class="px-3 py-2 rounded-md bg-gray-800/60 border border-gray-800">
    <p class="text-sm text-gray-200">{{ row.name }}</p>
    <p v-if="row.status === 'error' || row.status === 'rejected'" class="text-xs text-red-400">{{ row.message }}</p>
    <div v-else class="h-1 bg-gray-700 rounded"><div class="h-1 bg-indigo-500 rounded" :style="{ width: row.progress + '%' }" /></div>
  </div>
</div>
```
Also gate the drop-zone/click-to-browse against a same-vamp upload already `in uploads` to close the
double-upload race.

## Warnings

### WR-01: `VampTable`'s "library empty" vs "no search matches" states collapse into one, because `SongsView.vue` passes the already-filtered list as the `vamps` prop

**File:** `src/views/SongsView.vue:241`, `src/components/VampTable.vue:32-52`
**Issue:** `VampTable.vue`'s own header comment states the design intent explicitly:

> `props.vamps` drives the empty-library state and the sub-head counts [...] Rows render from
> `useVampStore().filteredVamps` (the store owns the name-OR-key filter)

i.e. `vamps` prop = total library (unfiltered), `vampStore.filteredVamps` = search-narrowed. The component
implements two distinct branches on that assumption:
```html
<div v-else-if="props.vamps.length === 0"> <!-- "Your vamp library is empty" + Add Vamp CTA -->
<div v-else-if="vampStore.filteredVamps.length === 0"> <!-- "No vamps match your search." -->
```
But `SongsView.vue` passes the **filtered** list as the prop:
```html
<VampTable :vamps="vampStore.filteredVamps" :loading="vampStore.isLoading" ... />
```
Since `props.vamps` and `vampStore.filteredVamps` are now the identical reference/value, the first branch
always wins whenever a search matches zero rows — a user who types a search with no hits sees **"Your vamp
library is empty"** with an "Add Vamp" call-to-action, not "No vamps match your search." The second branch
(tested in isolation in `VampTable.test.ts`) is dead in production. The sub-head text
(`{n} vamps · {m} with audio`, `src/components/VampTable.vue:122-125`) is also wrong while searching — it
reports the filtered count/audio-count, not the library total, so a 20-vamp library with a 2-result search
shows "2 vamps · 1 with audio" instead of the library totals the design comment promises.
**Fix:** Pass the unfiltered list:
```html
<VampTable :vamps="vampStore.vamps" :loading="vampStore.isLoading" @select="onSelectVamp" @add="onAddVamp" />
```

### WR-02: MP3 replace/remove never deletes the superseded Storage object — orphaned files accumulate forever

**File:** `src/components/VampSlideOver.vue:413-417` (`removeAttachment`), `src/composables/useVampFileUpload.ts:162-183` (upload-complete handler)
**Issue:** `useVampStore().deleteVamp()` correctly cleans up Storage on a full vamp delete
(`src/stores/vamps.ts:74-85`, best-effort `deleteObject`), mirroring `removeSongAttachment`/`hardDeleteSong`
in `src/stores/songs.ts` (`songs.ts:360-380`, `391-417`) which explicitly call `deleteObject` on the
attachment's old `storagePath` whenever an attachment is removed or replaced. The Vamp equivalents don't:
- `removeAttachment()` just does `vampStore.updateVamp(id, { attachment: null })` — the actual MP3 blob at
  `attachment.storagePath` is never deleted from Storage.
- The upload-complete handler in `useVampFileUpload.ts` overwrites the Firestore `attachment` field with the
  new upload's metadata but never deletes the *previous* attachment's `storagePath` first — every MP3 replace
  leaves the old file behind, permanently (this prefix is explicitly retention-sweep-exempt, so nothing will
  ever clean it up).
This also means: if a user deletes a vamp while an MP3 upload for it is still in flight, the upload's
eventual `updateVamp` call fails (`updateDoc` on a deleted doc) and is swallowed by the composable's
`.catch()` as an unsurfaced (per CR-01) error row — and that in-flight upload's Storage object is now
orphaned too, since `deleteVamp` only knew about the attachment that existed *before* the delete.
**Fix:** Before writing the new/null attachment, delete the prior `storagePath` if one exists (best-effort,
logged, non-blocking — same convention as `deleteVamp`):
```ts
// in removeAttachment() and in useVampFileUpload's on-complete handler, before updateVamp:
const previous = liveAttachment.value // or the pre-update vamp's attachment
if (previous?.storagePath) {
  try { await deleteObject(storageRef(storage, previous.storagePath)) }
  catch (err) { console.error('vamp attachment cleanup failed:', err) }
}
```

## Info

### IN-01: `VampTable.test.ts`'s test helper always sets `filteredVamps` equal to the `vamps` prop, so it can never catch WR-01

**File:** `src/components/__tests__/VampTable.test.ts:34-37`
**Issue:** `mountTable()` does `mockFilteredVamps = vamps; return mount(VampTable, { props: { vamps, loading } })` —
the mocked store's `filteredVamps` and the component's `vamps` prop are always the same array. No test ever
exercises `props.vamps.length > 0 && vampStore.filteredVamps.length === 0` (a non-empty library with a
search that matches nothing), which is exactly the scenario WR-01 breaks. This gap let the SongsView-side
wiring bug ship undetected even though the component itself has code for that state.
**Fix:** Add a case where the two diverge, e.g. `mockFilteredVamps = []` while `vamps` (prop) stays non-empty,
asserting `"No vamps match your search."` renders and the "Your vamp library is empty" CTA does not.

### IN-02: `authStore.orgId ?? ''` in `attach()` can construct a malformed Storage path if `orgId` is falsy

**File:** `src/components/VampSlideOver.vue:395`
**Issue:** `attach()` guards on a missing `vampId` (`if (!id) return`) but not on a missing `orgId` — it
falls back to `''`, which `vampFileStoragePath()` would turn into `orgs//vamp-files/...` (a malformed,
double-slash path) rather than failing loudly. In the normal flow `authStore.orgId` is always set while the
Songs page is mounted, so this is unlikely to trigger in practice, but the silent `?? ''` fallback masks the
failure mode instead of surfacing it.
**Fix:** Mirror the `vampId` guard: `if (!id || !authStore.orgId) return`.

---

_Reviewed: 2026-09-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
