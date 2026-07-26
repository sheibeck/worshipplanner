---
phase: 24-slide-group-model-and-migration
reviewed: 2026-07-26T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - src/types/slideGroup.ts
  - src/types/service.ts
  - src/types/slide.ts
  - src/utils/slotTypes.ts
  - src/utils/slideGroupMaterializer.ts
  - src/utils/slideshowAssembler.ts
  - src/stores/slideGroups.ts
  - src/composables/useSlideshowAssembly.ts
  - src/components/AudioPlayer.vue
  - src/components/PresentationViewer.vue
  - src/views/ServiceEditorView.vue
  - src/utils/__tests__/slotTypes.test.ts
  - src/utils/__tests__/slideGroupMaterializer.test.ts
  - src/utils/__tests__/slideshowAssembler.test.ts
  - src/stores/__tests__/slideGroups.test.ts
  - src/composables/__tests__/useSlideshowAssembly.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/components/__tests__/AudioPlayer.test.ts
  - src/components/__tests__/PresentationViewer.test.ts
  - src/stores/__tests__/services.test.ts
  - src/components/__tests__/ServiceCard.test.ts
  - src/components/__tests__/ServicePrintLayout.test.ts
  - src/components/__tests__/ServiceScriptureIntegration.test.ts
  - src/utils/__tests__/planningCenterApi.test.ts
  - src/utils/__tests__/planningCenterExport.test.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-07-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Phase 24 introduces the `SlideGroup` model, deterministic-id CRUD in `stores/slideGroups.ts`, the pure `slideGroupMaterializer.ts`/`slideshowAssembler.ts` engines, and the reactive wiring in `useSlideshowAssembly.ts`. The bulk of the D-01 (slot-id backfill), D-05 (bed-media migration), and write-amplification concerns called out in the phase brief are handled correctly and are well covered by tests: `backfillSlotIds`'s two-argument form genuinely avoids re-anchoring groups on remote merges, reorder issues zero group writes (verified by a dedicated test), the delete cascade awaits `deleteGroup` before splicing the slot, and `stripUndefined` is applied recursively before every Firestore write.

However, one BLOCKER-class defect was found in the song reconciliation path: **reassigning the song on an already-materialized SONG slot does not detect that the slot's `songId` itself changed**, and the additive-only merge in `reconcileSongGroup` silently blends the previous song's copyright/lyric entries with the new song's, producing a corrupted, permanently-mixed slide group with no confirm gate and no test coverage of the scenario. This is reachable through the completely ordinary "pick a different song for this slot" workflow (`SongSlotPicker` → `onSelectSong`), not an edge case.

Two further WARNING-level issues were found around a narrow write race between `materializeGroupIfMissing` and `setGroupBedMedia`'s skeleton-create path, and around the `SlotMediaAttachment` control's blind spot for legacy (not-yet-materialized) bed media. One INFO-level test-coverage gap is also noted.

## Critical Issues

### CR-01: Reassigning a SONG slot's song corrupts the slide group with blended content from the old and new song

**File:** `src/utils/slideGroupMaterializer.ts:209-269` (`reconcileSongGroup`), consumed unconditionally from `src/composables/useSlideshowAssembly.ts:305-333, 348-372`, reachable from `src/views/ServiceEditorView.vue:1916-1927` (`onSelectSong`)

**Issue:**
`reconcileSongGroup` diffs the group's stored lyric entries against the *current* slot's song by `sourceRef.sectionId` only, and reuses the stored leading/trailing `copyright` entries purely by array position (`storedCopyrightEntries[0]` / `[length-1]`). It never checks whether the slot's `songId` itself changed relative to what the stored entries reference:

```ts
// reconcileSongGroup — no songId-identity check anywhere in this function
const storedLyricEntries = group.slides.filter(isLyricEntry)
const storedBySectionId = new Map(storedLyricEntries.map((entry) => [entry.sourceRef.sectionId, entry]))
const storedCopyrightEntries = group.slides.filter(isCopyrightEntry).sort((a, b) => a.order - b.order)
const leadingCopyright = storedCopyrightEntries[0]
const trailingCopyright = storedCopyrightEntries.length >= 2 ? storedCopyrightEntries[storedCopyrightEntries.length - 1] : undefined
```

Reproduction (entirely normal editor workflow, no edge case):
1. A SONG slot gets Song A assigned. `useSlideshowAssembly`'s materialization watcher (`materializationCandidates`/`materializeCandidates`) creates a group whose `slides` are `[copyright(A), lyric(A, sectionId), ..., copyright(A)]`.
2. The user changes their mind and picks Song B for the *same slot* via `SongSlotPicker` → `onSelectSong` (`ServiceEditorView.vue:1916`). This directly mutates `slot.songId`/`songTitle`/`songKey` with **no confirm dialog and no group cleanup** — `onSelectSong` never touches `slideGroupsStore` at all.
3. `useSlideshowAssembly`'s `reconciliationOutcomes` computed re-runs (`slot.songId` is now Song B). Because a group already exists for this slot, `case 'SONG'` in `reconcileGroup` calls `reconcileSongGroup`, which is **always applied automatically, never confirm-gated** (`reconcileGroup`'s SONG branch hard-codes `needsConfirm: false`).
4. Inside `reconcileSongGroup`: `freshOrder`/`freshSectionIds` are computed from Song B's sections, so the new lyric entries created (`{ sourceRef: { kind: 'lyric', songId: songB, sectionId } }`) correctly reference Song B. But:
   - The **leading and trailing copyright entries are reused from the stored ones** (`leadingCopyright`/`trailingCopyright`), which still carry `sourceRef.songId === songA`.
   - The "retained-but-unresolvable" loop (`for (const entry of storedLyricEntries) if (!freshSectionIds.has(entry.sourceRef.sectionId)) merged.push(...)`) treats **every one of Song A's lyric entries as "unresolvable in the new source"** (since Song B's section ids are unrelated to Song A's) and **retains them permanently** rather than discarding them.
5. `slideGroupsStore.replaceGroupSlides` persists this blended list to Firestore — silently, with no user confirmation, in the very next reactive tick after the song is reassigned.

**Impact:**
- The assembled slideshow (`assembleSlideshow` → `resolveEntryContent`) will show Song A's leftover lyric sections mixed in with Song B's, because as long as Song A's lyrics remain cached in `songLyricsById` for that browser session, `resolveEntryContent` happily resolves the stale `sourceRef.songId === songA` entries.
- The copyright slides — which carry legally-relevant CCLI song number / license number / author attribution — **keep referencing Song A** even though the slot now displays Song B's lyrics. On a fresh session that never loads Song A's lyrics (a different device, or the same browser after the tab is closed and reopened later), `resolveEntryContent`'s `case 'copyright'`/`case 'lyric'` return `undefined` for the stale Song-A-referencing entries and they are silently *omitted* from the assembled output — meaning the persisted group permanently carries dead, unresolvable entries and, on some sessions, no copyright slide renders at all for that slot.
- There is no path to self-heal: the additive merge only ever adds/keeps, it never detects a full identity swap, so the corruption is permanent until a user manually removes the whole plan item (cascading `deleteGroup`) and re-adds it.
- No test in `slideGroupMaterializer.test.ts` or `useSlideshowAssembly.test.ts` exercises a `songId` change against an existing group — every `reconcileSongGroup` test fixture uses the same `songId: 'song-1'` throughout (only additions/removals of *sections within the same song* are tested).

**Fix:** Detect a songId identity change before running the additive merge, and route it through the same confirm-gated path already used for scripture/imported (`reconcileUnstableIdGroup`):

```ts
export function reconcileSongGroup(
  group: SlideGroup,
  slot: SongSlot,
  inputs: AssemblyInputs,
): ReconcileResult {
  const songId = slot.songId
  if (!songId) return { needsConfirm: false, changed: false, slides: group.slides }

  // NEW: detect a full song swap — any stored lyric/copyright entry whose
  // sourceRef.songId differs from the slot's CURRENT songId means the group
  // was built against a different song entirely; the additive by-sectionId
  // merge below is only valid for edits WITHIN the same song.
  const storedSongIds = new Set(
    group.slides
      .filter((e): e is GroupSlideEntry & { sourceRef: Extract<SourceRef, { kind: 'lyric' | 'copyright' }> } =>
        e.sourceRef.kind === 'lyric' || e.sourceRef.kind === 'copyright')
      .map((e) => e.sourceRef.songId),
  )
  if (storedSongIds.size > 0 && !storedSongIds.has(songId)) {
    if (!hasCustomization(group)) {
      return { needsConfirm: false, changed: true, slides: deriveGroupEntries(slot, inputs) }
    }
    return {
      needsConfirm: true,
      changed: false,
      slides: group.slides,
      proposed: deriveGroupEntries(slot, inputs),
      loss: computeLoss(group),
    }
  }

  // ...existing additive-by-sectionId merge, unchanged...
}
```
Also add a `reconcileGroup` dispatch update so a songId-swap result's `needsConfirm` can actually surface (currently `reconcileGroup`'s SONG branch discards `needsConfirm` from the result). Add test coverage in both `slideGroupMaterializer.test.ts` and `useSlideshowAssembly.test.ts` for "slot.songId changes to a different song, uncustomized group replaces wholesale" and "...customized group requires confirm."

## Warnings

### WR-01: `setGroupBedMedia`'s skeleton-create path can race `materializeGroupIfMissing` and drop the freshly-derived slide list

**File:** `src/stores/slideGroups.ts:139-169` (`setGroupBedMedia`), `src/stores/slideGroups.ts:94-107` (`materializeGroupIfMissing`)

**Issue:** Both functions independently `getDoc` the same `slideGroups/{slotId}` doc and, if it doesn't exist, call a bare (non-merge) `setDoc`. `useSlideshowAssembly`'s materialization watcher calls `materializeGroupIfMissing` automatically the moment a slot's source resolves; `ServiceEditorView.vue`'s `onSlotBedAudioChange`/`onSlotBedVideoChange` (`ServiceEditorView.vue:1412-1436`) call `setGroupBedMedia` the instant the user attaches media through `SlotMediaAttachment`. If a user attaches bed media to a slot within the same round-trip window as its first materialization (plausible: assign a song, then immediately attach an audio bed before the network write for materialization has landed), both `getDoc` calls can observe "not exists," and whichever `setDoc` lands last wins outright — Firestore's non-merge `setDoc` replaces the whole document. Since `setGroupBedMedia`'s skeleton payload is `{ id, slotId, serviceId, slides: [], bedAudioUrl|bedVideoUrl }`, if it lands *after* `materializeGroupIfMissing`'s fully-populated write, the group's real `slides` array is silently reset to `[]`, discarding the properly derived structure that a moment earlier resolved correctly. This directly contradicts the type file's stated invariant that "a group can never exist in a half-migrated state" and D-02's "groups are always populated."

**Fix:** Make both initial-create branches idempotent against this race by using `setDoc(ref, payload, { merge: true })` for the skeleton-creation path in `setGroupBedMedia`, so a concurrently-landing `materializeGroupIfMissing` write's `slides` field is preserved rather than overwritten:

```ts
await setDoc(
  ref,
  {
    ...stripUndefined({ id: slotId, slotId, serviceId: patch.serviceId, slides: [], bedAudioUrl: patch.bedAudioUrl, bedVideoUrl: patch.bedVideoUrl }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  { merge: true },
)
```
(Note `{merge:true}` alone doesn't fully solve ordering when *both* docs are created new, but it prevents the specific "populated slides get clobbered by an empty skeleton" data-loss direction, which is the actually damaging one — losing a bed-media write instead of losing derived structure is comparatively harmless since the user can re-attach media, but re-deriving lost slide structure requires a full slot delete/recreate.)

### WR-02: `SlotMediaAttachment`'s bound value is blind to legacy slot media until the group first materializes

**File:** `src/views/ServiceEditorView.vue:919-925`

**Issue:**
```vue
<SlotMediaAttachment
  :audioUrl="groupsBySlotId.get(slot.id)?.bedAudioUrl"
  :videoUrl="groupsBySlotId.get(slot.id)?.bedVideoUrl"
  ...
```
This reads ONLY from the materialized group's bed fields, never from the slot's still-present deprecated `audioUrl`/`videoUrl` (`MediaAttachableSlot`). For any slot whose group hasn't materialized yet — which includes every slot viewed only by non-editors (`canWrite` gates `materializationCandidates` to `[]` entirely for viewers, per `useSlideshowAssembly.ts:231-234`), and any SONG/SCRIPTURE/IMPORTED slot whose source isn't assigned yet — the control renders as if no media is attached, even though the legacy field on the slot document still carries a real URL. The presented slideshow itself is unaffected (the fallback assembly path in `slideshowAssembler.ts` still reads `slot.audioUrl`/`videoUrl` correctly), but the editor's own attach/detach UI is misleading for exactly the "half-migrated" legacy data this phase is meant to migrate safely.

**Fix:** Fall back to the slot's own deprecated fields when no group exists yet, mirroring the read-precedence already used elsewhere in this phase (group value first, slot legacy value second):
```ts
const displayAudioUrl = computed(() => (slotId: string, slot: ServiceSlot) =>
  groupsBySlotId.value.get(slotId)?.bedAudioUrl ?? slot.audioUrl)
```

## Info

### IN-01: No reconciliation test exercises a slot's `songId` changing against an already-materialized group

**File:** `src/utils/__tests__/slideGroupMaterializer.test.ts:371-516`, `src/composables/__tests__/useSlideshowAssembly.test.ts:594-655`

**Issue:** Every `reconcileSongGroup`/reconciliation test fixture keeps `slot.songId` constant across the "before" and "after" state (only lyric section membership changes). This gap in coverage is what let CR-01 ship undetected — the additive-merge contract ("gains a Bridge yields stored entries untouched plus a new entry") was verified thoroughly, but the "song itself changes" case, which is arguably the more common real-world action, has zero assertions anywhere in the suite.

**Fix:** Add the test cases described in CR-01's fix, verifying (a) an uncustomized group is replaced wholesale referencing the new songId only, and (b) a customized group produces `needsConfirm: true` with a `proposed` list referencing only the new songId, mirroring the existing `reconcileScriptureGroup`/`reconcileImportedGroup` coverage pattern.

---

_Reviewed: 2026-07-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
