---
phase: 25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium
reviewed: 2026-07-26T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/components/slides/SlidesTab.vue
  - src/components/slides/SlidePlanRail.vue
  - src/components/slides/SlideGrid.vue
  - src/components/slides/SlideCard.vue
  - src/components/slides/SlideDropTarget.vue
  - src/components/slides/SlideGroupMusicControl.vue
  - src/components/slides/slideDisplay.ts
  - src/components/slides/dropRouting.ts
  - src/composables/useSlideshowAssembly.ts
  - src/stores/slideGroups.ts
  - src/utils/slideshowAssembler.ts
  - src/utils/slideGroupMaterializer.ts
  - src/types/slide.ts
  - src/types/slideGroup.ts
  - src/types/service.ts
  - src/components/PptxImportModal.vue
  - src/components/PresentationViewer.vue
  - src/components/SlideshowPreview.vue
  - src/components/SlotMediaAttachment.vue
  - src/views/ServiceEditorView.vue
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-07-26
**Depth:** standard
**Files Reviewed:** 20 (plus the 8 files under `src/components/slides/__tests__/`)
**Status:** issues_found

## Summary

The mid-phase bed-video deletion (D-18/D-19) is clean: `git grep` for `bedVideoUrl`/`videoFromBed`
turns up nothing in `src/`, `displaySlotAudioUrl` has no video sibling left in
`ServiceEditorView.vue`, `SlotMediaAttachment.vue` is audio-only with its video affordance fully
removed, and `PresentationViewer.vue`/`SlideshowPreview.vue`/`slideshowAssembler.ts` all read
video exclusively from a video slide's own `videoSrc`. Phase 24 D-01's `backfillSlotIds` lazy
migration is untouched and still wired into both `ServiceEditorView.vue` load-watcher branches.
Write-path discipline holds: every slide-group mutation in `SlideGrid.vue` goes through
`useSlideGroups()` (`replaceGroupSlides`/`setGroupBedMedia`), never `ServiceEditorView`'s
`localService` autosave, and this is asserted directly in `SlideGrid.test.ts` (`mockUpdateService`
never called). `PptxImportModal.vue`'s new `defineExpose` entry point is additive — the existing
Phase 21 `onImportConfirmed` handler in `ServiceEditorView.vue` is untouched and the two import
paths (new plan item vs. append-to-selected-group) cannot interfere, since each owns its own
`showImportModal` ref in its own component scope. Drop routing (`dropRouting.ts`) correctly
special-cases PPTX-by-extension, routes video to its own appended entry (never a bed — D-17/D-18),
routes audio to the bed only, and reports every skipped file rather than silently dropping it.
Tailwind class maps (`KIND_BADGE_CLASSES`) are fully static, and the test suite has a dedicated
assertion against template-string interpolation. Bed-audio test coverage was not weakened alongside
the deliberate bed-video test deletions — `SlideGroupMusicControl.test.ts`/`SlideGrid.test.ts`'s
audio-bed assertions are intact and specific.

Two BLOCKER-level concurrency bugs were found in the group-write layer, both squarely inside this
phase's stated risk area ("races between concurrent appends, and between an append and the
automatic materialization path"). One is a genuine gap left by Phase 24's own WR-01 fix (the fix
only guarded one direction of a two-way race). The other is new to this phase: none of 25-05/25-06/
25-07's write paths (add-slide, drag-reorder, PPTX/image append, video append) guard against a
double-invocation of their own async handler, so a fast double-click or an overlapping drop can
silently discard a just-written slide entry. A third, lower-confidence WARNING notes that a group's
bed audio still layers onto a video slide's own playback in the presentation viewer, which sits
uneasily next to D-18's stated intent that a video slide is a fully self-contained unit.

## Critical Issues

### CR-01: `materializeGroupIfMissing`'s non-merge `setDoc` can silently erase a concurrently-attached group bed (asymmetric WR-01 race)

**File:** `src/stores/slideGroups.ts:94-107` (materialize) and `:150-181` (bed write)
**Issue:**

Phase 24's WR-01 review-fix (commit `aae8407`) made `setGroupBedMedia`'s skeleton-create a
`{ merge: true }` write specifically because it races `materializeGroupIfMissing`: both functions
independently `getDoc` the same not-yet-existing `slideGroups/{slotId}` document and, on absence,
`setDoc`. The fix only protects ONE direction of that race — a concurrently-landing
`materializeGroupIfMissing` write's `slides` field survives the skeleton's `{ merge: true }` create
because merge only touches the keys present in its own payload.

`materializeGroupIfMissing` itself was never updated and still issues a **plain, non-merge**
`setDoc`:

```ts
async function materializeGroupIfMissing(orgId: string, input: SlideGroupInput): Promise<boolean> {
  const ref = doc(db, 'organizations', orgId, 'slideGroups', input.slotId)
  const existing = await getDoc(ref)
  if (existing.exists()) return false
  await setDoc(ref, {
    ...stripUndefined(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return true
}
```

`input` (from `buildInitialGroup`) never carries a bed field (D-19 — a freshly materialized group
always starts with no bed). If this write lands **after** `setGroupBedMedia`'s merge-skeleton
write has already landed, this is a full-document, non-merge `setDoc` — it replaces the entire
document with a payload that has no `bedAudioUrl` key at all, silently erasing the bed the user
just attached.

The race window is real and not contrived: 25-06/25-07 deliberately call `setGroupBedMedia`
directly (attach group music, drop audio) with **no** `ensureGroupMaterialized` call first — both
`onAttachGroupMusic`'s and `attachDroppedAudio`'s own doc comments in `SlideGrid.vue` say this is
intentional ("`setGroupBedMedia`'s own merging skeleton-create already covers a plan item with no
group document yet"). Meanwhile `useSlideshowAssembly.ts`'s automatic `materializeCandidates`
watcher (`materializeGroupIfMissing`) fires reactively for every slot with resolvable content the
moment the Slides tab (or the page) mounts — precisely the moment a user might also be attaching
bed music to a plan item whose group hasn't materialized yet.

**Fix:** Make `materializeGroupIfMissing`'s create a merge write too (merge only protects against
being clobbered — it never clobbers a field it doesn't itself set), or fold the two create paths
into one via a Firestore transaction that reads-then-writes atomically:

```ts
await setDoc(ref, {
  ...stripUndefined(input),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
}, { merge: true })
```

Add a regression test mirroring `slideGroups.test.ts`'s existing WR-01 case but in the reverse
order: `setGroupBedMedia`'s skeleton lands first, `materializeGroupIfMissing` lands second, assert
`bedAudioUrl` survives.

### CR-02: Group-slide write paths have no in-flight guard — a fast double-invocation silently loses a just-added entry

**File:** `src/components/slides/SlideGrid.vue:296-437` (`onAddSlide`, `onImportConfirmed`,
`appendVideoEntries`), `:552-587` (drag `onEnd`)
**Issue:**

Every one of this phase's write paths follows the same shape: call `ensureGroupMaterialized(slotId)`
(or read `props.group` directly for drag-reorder) to get a snapshot of `entries`, append/reorder
locally, then call `slideGroupsStore.replaceGroupSlides(orgId, slotId, newEntries, sourceSignature)`
— a plain `updateDoc` with no optimistic-concurrency check against what's actually stored.

None of the triggering UI controls guard against being invoked twice before the first write's
Firestore round trip lands and the store's `groupsBySlotId` map catches up:

- The `＋ Add slide` button (`slide-grid-add-slide`) has no `disabled` binding tied to a pending
  write — a fast double-click fires `onAddSlide` twice. Both calls read the **same** `entries`
  snapshot (the group doc/`existing.slides` hasn't reflected the first call's write yet), each
  computes its own new entry, and each calls `replaceGroupSlides` with `[...entries, newEntry]`.
  The second write **overwrites** the first: the first click's added slide is silently discarded
  with no error surfaced anywhere.
- The same shape applies to `onImportConfirmed` (import) and `appendVideoEntries` (video drop) —
  e.g. dropping a video file onto the grid tile while an add-slide click from a moment earlier is
  still in flight loses whichever entry belonged to the write that lands first.
- Drag-reorder's `onEnd` reads `props.group.slides` fresh from props at call time (per its own
  comment), which is somewhat more resistant since it re-derives from the latest prop, but it is
  still vulnerable to the exact same last-write-wins loss if a reorder completes while an
  add-slide/import/video-append write from the same group is still in flight — the reorder's
  `sorted` array is built from whatever `props.group.slides` currently holds, which will not yet
  include an unlanded concurrent append.

This is a genuine data-loss risk on ordinary, single-user interaction (rapid double-click is a
common UI mistake), not just a multi-tab edge case. `replaceGroupSlides` itself performs no
transaction and no compare against the document's current `slides`/`sourceSignature` before
writing — the `sourceSignature` parameter is passed through unchanged and never verified against
what's actually stored.

**Fix:** Either (a) add a per-slot in-flight guard in `SlideGrid.vue` (a `ref<Set<string>>` or a
simple boolean disabling the triggering controls while a write for the current group is
outstanding, mirroring the `materializingSlotIds` re-entrancy guard already used in
`useSlideshowAssembly.ts`), or (b) move the read-modify-write into a Firestore transaction
(`runTransaction`) inside `replaceGroupSlides` so two concurrent callers serialize against the
live document instead of a stale local snapshot. Given how many independent call sites share this
shape (add-slide, import, video-append, drag-reorder, and the reconciliation watcher in
`useSlideshowAssembly.ts`), fixing it once inside `replaceGroupSlides` (option b) is more robust
than guarding every caller individually.

## Warnings

### WR-01: A group's bed audio still layers onto a video slide's own playback, in tension with D-18

**File:** `src/utils/slideshowAssembler.ts:194-213` (`resolveEntryMedia`), `:254-282`
(`emitFromGroup`); `src/components/PresentationViewer.vue:355-366` (`currentAudioUrl`/
`currentVideoUrl`)
**Issue:**

`resolveEntryMedia` computes the D-04 two-level audio precedence (`entry.audioUrl ?? group.bedAudioUrl`)
uniformly for every `GroupSlideEntry`, regardless of `sourceRef.kind`. `emitFromGroup` calls it for
every entry in the loop, including `kind: 'video'` entries — so a video entry inside a group that
has a `bedAudioUrl` (and no per-slide `entry.audioUrl` of its own) receives `slide.audioUrl =
group.bedAudioUrl` in addition to its own `videoSrc`.

`PresentationViewer.vue` renders both media elements independently and unconditionally:
`currentVideoUrl` (from `slide.contentKind === 'video' ? videoSrc : null`) mounts a `VideoPlayer`,
and `currentAudioUrl` (`slide.audioUrl`) mounts an `AudioPlayer`, with no exclusivity between the
two. `VideoPlayer.vue` starts **unmuted** by default (`muted.value = false`, only flipping to muted
on an autoplay-policy retry) — so a video slide inheriting a group bed would play its own
(unmuted) audio track and the bed's `AudioPlayer` simultaneously, with no on-screen indication that
two audio sources are active.

D-18's stated model is "video is slide-only... there is nothing else on a video slide competing
with it for the screen" (`SlideGrid.vue`'s own doc comment) and "there is no group bed video, so
there is nothing for [`videoSrc`] to collide with" (`src/types/slide.ts`), which reads as intending
a video slide to be a self-contained unit. Whether a bed audio track is *supposed* to keep playing
underneath a video slide in the same group is not stated as a deliberate decision anywhere in the
reviewed docs/comments — it currently happens as a side effect of `resolveEntryMedia` not
discriminating on entry kind.

**Fix:** If this is intentional (bed music continuing under a dropped video clip), state it
explicitly in `resolveEntryMedia`'s doc comment and add a test asserting it. If it is not
intentional, exclude `kind: 'video'` entries from bed-audio fallback in `resolveEntryMedia`:

```ts
function resolveEntryMedia(group: SlideGroup, entry: GroupSlideEntry): ResolvedGroupMedia {
  if (entry.sourceRef.kind === 'video') {
    // Video slides carry their own audio track; a group bed never layers onto one.
    return { audioFromBed: false }
  }
  // ...existing precedence...
}
```

### WR-02: No test exercises the CR-01/CR-02 race conditions

**File:** `src/stores/__tests__/slideGroups.test.ts`, `src/components/slides/__tests__/SlideGrid.test.ts`
**Issue:** Both `slideGroups.test.ts` (per its WR-01 history) and `SlideGrid.test.ts` mock
`replaceGroupSlides`/`setGroupBedMedia` as simple resolved promises and never simulate two
overlapping in-flight calls resolving out of order — so neither CR-01 nor CR-02 would be caught by
the current suite even after landing.
**Fix:** Add a regression test for CR-01 (reverse-order landing of the two skeleton-create paths,
as noted above) and for CR-02 (two `onAddSlide`/`appendVideoEntries` invocations where the mocked
`ensureGroupMaterialized`/`replaceGroupSlides` resolve out of order, asserting both entries survive
once whichever fix is chosen lands).

## Info

### IN-01: `slideDisplay.ts`'s `bedAudioLabel` and rail bed-label wiring have no test for a group whose bed is on a video-only group

**File:** `src/components/slides/SlidePlanRail.vue:127`, `src/components/slides/slideDisplay.ts:167-177`
**Issue:** `bedLabel` reads `group?.bedAudioUrl` unconditionally, independent of what kinds of
entries the group holds. This is correct per the code, but no test in `SlidePlanRail.test.ts`
covers a group whose only entries are `video` kind alongside a bed — the same gap WR-01 above flags
at the assembler level shows up here too as an untested combination, worth covering once WR-01 is
resolved one way or the other.
**Fix:** Add a rail test asserting the bed label still renders for a video-only group with
`bedAudioUrl` set, once the intended behavior from WR-01 is confirmed.

---

_Reviewed: 2026-07-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
