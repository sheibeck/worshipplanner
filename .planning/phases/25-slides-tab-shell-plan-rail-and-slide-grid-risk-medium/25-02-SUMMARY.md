---
phase: 25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium
plan: 02
subsystem: slides-data-model
tags: [slide-model, video-slide, bed-video-removal, slideshow-assembler, presentation-viewer, d-18, d-19]

requires:
  - phase: 25-01
    provides: VideoSlide interface, video/authored-text SourceRef members, assembler resolution for video entries
provides:
  - Bed video deleted end-to-end (types, assembler, materializer, store, PresentationViewer, SlideshowPreview, ServiceEditorView)
  - Video slide rendering in Present mode (PresentationViewer) and Slideshow Preview (compact video card)
  - setGroupBedMedia narrowed to an audio-only patch surface
  - displaySlotVideoUrl and SlotMediaAttachment's video-attach affordance removed (D-19 dead-legacy cleanup)
affects: [26-slide-editing-drawer, 27-service-order-tab-rename, presentation/preview surfaces]

tech-stack:
  added: []
  patterns:
    - "A slide kind with no bed layer resolves its media purely from its own contentKind-narrowed field (VideoSlide.videoSrc), never through a group-level carrier — the pattern the old bed-video path violated"
    - "bodyIsCaption-style 'demote text while an overlay media renders' logic is only valid when the two can coexist on the SAME slide; once video is slide-only, that coexistence is structurally impossible and the demotion logic becomes provably dead code, removed rather than left inert"

key-files:
  created: []
  modified:
    - src/types/slide.ts
    - src/types/slideGroup.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/slideGroupMaterializer.ts
    - src/stores/slideGroups.ts
    - src/components/PresentationViewer.vue
    - src/components/SlideshowPreview.vue
    - src/components/SlotMediaAttachment.vue
    - src/views/ServiceEditorView.vue
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/stores/__tests__/slideGroups.test.ts
    - src/components/__tests__/PresentationViewer.test.ts
    - src/components/__tests__/SlideshowPreview.test.ts
    - src/components/__tests__/SlotMediaAttachment.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts

decisions:
  - "The assembler's pre-group fallback path (emitFallback) also carried a legacy slot.videoUrl onto the emitted slide — deleted alongside the rest since SlideBase.videoUrl no longer exists to receive it (Rule 1/3: would have been a type error, and is itself bed-video-adjacent legacy D-18 rules out)"
  - "bodyIsCaption removed from PresentationViewer entirely — it existed only to demote a slide's own body text while a bed video rendered alongside it; a video slide never has a body to demote (VideoSlide has no title/body), so the concept is provably dead under D-18, not merely unused"
  - "currentVideoKey simplified to a pure per-slide key (slide.id + videoSrc) — video's group-continuity key branch only ever existed to keep ONE bed player mounted across a group; with no bed, every video slide is its own single-slide unit"
  - "SlotMediaAttachment.vue's video upload input/preview/remove-video affordance removed even though the plan's file list didn't name it — deviation beyond stated scope (Rule 1/2): after ServiceEditorView drops its update:videoUrl listener, the video file input would still accept a file, upload it to Storage, and silently discard the result with no error, a wasted write and a broken control rather than a graceful no-op. useMediaUpload.ts (the shared upload composable, still used for legitimate video-slide drops) was left untouched"
  - "SlideshowPreview's video card reuses the existing eyebrow-label styling convention and a data-testid of preview-slide-video (the same name the old bed-video attached-media block used) since the two can never coexist post-D-18"

metrics:
  duration: ~45min
  completed: 2026-07-26
status: complete
---

# Phase 25 Plan 02: Delete Bed Video, Render Video Slides Summary

Bed video is deleted end to end — `SlideGroup.bedVideoUrl`, `SlideBase.videoUrl`, `AssembledSlide.videoFromBed`, the D-05 slot-video migration term, and every rendering/write path that touched them are gone, not deprecated — while the `VideoSlide` type 25-01 introduced now actually renders: as its own slide in Present mode (`PresentationViewer.vue`, reusing the existing chromeless `VideoPlayer`/degraded-state machinery verbatim) and as a compact identifiable card in the Slideshow Preview list. Bed **audio** (D-04 precedence, `audioFromBed`, cross-group continuity) is untouched — every bed-audio test passes with its assertions unmodified.

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified:** 16

## Accomplishments

- Deleted the bed-video model from `SlideGroup`, `SlideBase`/`AssembledSlide`, `slideshowAssembler.ts` (`resolveEntryMedia`, `emitFromGroup`), `slideGroupMaterializer.ts` (D-05 migration term, `hasCustomization`), and `slideGroups.ts` (`setGroupBedMedia`'s patch surface narrowed to audio-only)
- Rewired `PresentationViewer.vue` so a video slide renders its own `videoSrc` through the existing `videoRef`/play/pause/error/autoplay-blocked wiring with zero new driving code, and removed `bodyIsCaption` as dead code once video could no longer coexist with a text-bearing slide
- Added an explicit video branch to `SlideshowPreview.vue`'s card chain (D-17/D-18) so a video slide no longer falls into the trailing text `v-else` and prints a `TextSlide`'s fields on an object that has none
- Removed `displaySlotVideoUrl`, the `bedVideoUrl` write path, and the `'attached video'` delete-warning term from `ServiceEditorView.vue`; removed `SlotMediaAttachment.vue`'s video-attach affordance entirely (D-19 collateral — the control exists solely to serve the now audio-only group bed)
- Verified the lazy `ServiceSlot.id` backfill (Phase 24 D-01) is untouched via its existing dedicated test suite, still green

## Task Commits

1. **Task 1: Delete the bed-video model from types, assembler, materializer and store** - `102d7ba` (feat)
2. **Task 2: Remove bed-video rendering and render the video slide in Present mode** - `0af4ce9` (feat)
3. **Task 3: Video card in Slideshow Preview, and strip the dead slot-media fallbacks** - `d2c2bec` (feat)

## Files Created/Modified

- `src/types/slide.ts` - removed `SlideBase.videoUrl` and `AssembledSlide.videoFromBed`; rewrote `VideoSlide`/`SlideBase.audioUrl` doc comments for the audio-only-bed model
- `src/types/slideGroup.ts` - removed `SlideGroup.bedVideoUrl`; rewrote the `video` `SourceRef` member's doc comment
- `src/utils/slideshowAssembler.ts` - removed `videoFromBed` from `ResolvedGroupMedia`/`resolveEntryMedia`/`emitFromGroup`; removed the fallback path's legacy `slot.videoUrl` carry-over
- `src/utils/slideGroupMaterializer.ts` - deleted the D-05 slot-video migration line; narrowed `hasCustomization`'s bed check to `bedAudioUrl`
- `src/stores/slideGroups.ts` - `setGroupBedMedia`'s `BedMediaPatch` and both write branches narrowed to audio-only
- `src/components/PresentationViewer.vue` - `currentVideoUrl` resolves from the video slide's own `videoSrc`; `currentVideoKey` simplified to per-slide; `bodyIsCaption` removed; `CardKind` widened with `video`
- `src/components/SlideshowPreview.vue` - added a video card branch; removed the bed-video attached-media block
- `src/components/SlotMediaAttachment.vue` - removed the video attach input, `videoUrl` prop, `update:videoUrl` emit, video preview/remove-video button
- `src/views/ServiceEditorView.vue` - removed `displaySlotVideoUrl`, `onSlotBedVideoChange`, the `bedVideoUrl` binding, and the `'attached video'` delete-warning term
- Six test files updated in lockstep (see Deviations/deleted-tests list below)

## Decisions Made

See frontmatter `decisions` — key ones: the fallback-path legacy-video fix, `bodyIsCaption` removal as dead code, `currentVideoKey` simplification, and the `SlotMediaAttachment.vue` scope-extension deviation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Assembler fallback path assigned a now-nonexistent field**
- **Found during:** Task 1
- **Issue:** `emitFallback` in `slideshowAssembler.ts` carried a legacy slot-level `videoUrl` onto the emitted slide's `videoUrl` field — after deleting `SlideBase.videoUrl` this would be a type error, and the behavior itself is exactly the bed-video-adjacent legacy D-18 rules out.
- **Fix:** Removed the assignment; a legacy slot `videoUrl` is now silently ignored in the fallback path, matching D-18/D-19.
- **Files modified:** `src/utils/slideshowAssembler.ts`, `src/utils/__tests__/slideshowAssembler.test.ts` (added a negative test)
- **Verification:** `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` — 48/48 pass; `npm run type-check` — 0 errors
- **Committed in:** `102d7ba`

**2. [Rule 1 - Bug] `bodyIsCaption` became dead/misleading code**
- **Found during:** Task 2
- **Issue:** `bodyIsCaption` demoted a slide's own body text while a bed video rendered alongside it — under D-18 a video slide never has a body (`VideoSlide` has no `title`/`body`), so the two can never coexist and the demotion logic is provably inert in every real render path, not merely unused.
- **Fix:** Removed `bodyIsCaption`; the three body-rendering branches (lyric/scripture/text) now always render at full `text-5xl` scale.
- **Files modified:** `src/components/PresentationViewer.vue`, `src/components/__tests__/PresentationViewer.test.ts`
- **Verification:** `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — 57/57 pass
- **Committed in:** `0af4ce9`

**3. [Rule 1/2 - Bug/Missing functionality, beyond stated file scope] `SlotMediaAttachment.vue`'s video affordance left as a silent-discard control**
- **Found during:** Task 3
- **Issue:** The plan's file list for Task 3 did not include `SlotMediaAttachment.vue`. But removing `ServiceEditorView.vue`'s `@update:videoUrl` listener (required by the plan's own acceptance criteria) would leave `SlotMediaAttachment`'s video file input fully functional in isolation — a user could pick a video file, have it uploaded to Firebase Storage, and then have the resulting URL silently discarded with no error and no explanation. That's a wasted Storage write and a broken-looking control, not a graceful no-op.
- **Fix:** Removed the video attach input, `videoUrl` prop, `update:videoUrl` emit, and video preview/remove-video button from `SlotMediaAttachment.vue` — the component exists solely to serve the group bed, which is now audio-only (D-18). Left `useMediaUpload.ts` (the shared upload composable) untouched since it's still used for legitimate video-slide drops elsewhere.
- **Files modified:** `src/components/SlotMediaAttachment.vue`, `src/components/__tests__/SlotMediaAttachment.test.ts`
- **Verification:** `npx vitest run src/components/__tests__/SlotMediaAttachment.test.ts` — 5/5 pass
- **Committed in:** `d2c2bec`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bug fixes, 1 Rule 1/2 scope-extension for correctness)
**Impact on plan:** All three were necessary for correctness (two would have been type errors or dead/misleading code; the third prevents a silently-broken UI control and wasted Storage writes). No unrelated scope creep — each traces directly to the bed-video deletion this plan performs.

## Deleted Tests (deletion discipline — one line each on why)

| Test | File | Why deleted |
|---|---|---|
| `bedVideoUrl resolves onto every entry in the group and videoFromBed is true on each` | `slideshowAssembler.test.ts` | Asserted bed-video resolution — the behavior no longer exists (D-18) |
| `a group with BOTH a bed video and a video entry assembles...` | `slideshowAssembler.test.ts` | Was "audio AND video bed together" style — reduced to an audio-bed-coexists-with-a-video-entry test, not deleted wholesale |
| `is true when the group has a bedVideoUrl` | `slideGroupMaterializer.test.ts` | Asserted a bed-video customization signal — replaced with a video-entry (D-17) customization test, since that's the only video-shaped customization signal left |
| `copies audioUrl/videoUrl onto bedAudioUrl/bedVideoUrl when present` | `slideGroupMaterializer.test.ts` | Reduced to the audio half; a new negative test proves a legacy slot `videoUrl` produces no bed field |
| `omits bedAudioUrl/bedVideoUrl entirely when the slot has neither` | `slideGroupMaterializer.test.ts` | Reduced to the audio half (bedVideoUrl no longer exists to omit) |
| `carries a Phase 22 slot bedAudioUrl/bedVideoUrl onto the single setDoc payload` | `slideGroups.test.ts` | Reduced to the audio half |
| `creates a skeleton document with slides: [] when the group does not exist yet` | `slideGroups.test.ts` | Modified to use `bedAudioUrl` (the `bedVideoUrl` patch member no longer exists) |
| `bedVideoSlide` helper + `advancing between two bed-carrying video slides of the SAME group leaves the VideoPlayer key unchanged` | `PresentationViewer.test.ts` | Asserted bed-video group continuity — replaced with a test proving two DIFFERENT video slides always get fresh instances (video has no bed continuity under D-18) |
| `a video-carrying slide renders presentation-body at text-2xl (caption)...` | `PresentationViewer.test.ts` | Asserted `bodyIsCaption` behavior, which is now dead code (see Deviation 2) |
| `the slide body reverts from caption scale to full Body scale once the attached video errors out (WR-05)` | `PresentationViewer.test.ts` | Same — asserted removed `bodyIsCaption` behavior |
| `renders an AudioPlayer for a slide with audioUrl and a VideoPlayer for a slide with videoUrl...` | `SlideshowPreview.test.ts` | Reduced to the audio half; two new tests cover the genuine video-card branch and a text-slide-unaffected-by-video-sibling case |
| `attaching video calls setGroupBedMedia for the bed video field` | `ServiceEditorView.test.ts` | Asserted the deleted `bedVideoUrl` write path |
| `the control displays urls from the group bed, not the deprecated slot fields` | `ServiceEditorView.test.ts` | Reduced to the audio half |
| `falls back to the slot's own deprecated audioUrl/videoUrl when no group has materialized yet (WR-02)` | `ServiceEditorView.test.ts` | Reduced to the audio half |
| `with videoUrl prop set, renders a VideoPlayer preview` | `SlotMediaAttachment.test.ts` | Asserted the removed video-preview affordance — replaced with a negative test proving no video input/preview renders |

Every bed-**audio** test in all six files passed with its assertions **unmodified** throughout.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Video is now unambiguously slide-only across the entire codebase: model, assembler, both render surfaces, and the service editor's media controls all agree.
- Phase 26 (Edit Slide drawer) can build on a clean `VideoSlide` with no bed-video shadow model to reconcile against.
- `git grep -n "bedVideoUrl\|videoFromBed" src/` and `git grep -n "displaySlotAudioUrl\|displaySlotVideoUrl" src/` (audio variant still present by design) both confirmed clean per the plan's acceptance criteria.
- Full `npx vitest run src/` — 150/160 files pass; the 10 failing files are exactly the pre-existing baseline (8 quarantined worktree duplicates never run/fixed, `storage.rules.test.ts` needing the emulator, and the stale `RosterView.test.ts` assertion) — no new failures introduced.
- `npm run type-check` — 0 errors. `npm run build` — succeeded.

---
*Phase: 25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium*
*Completed: 2026-07-26*

## Self-Check: PASSED

- `src/types/slide.ts` — FOUND
- `src/types/slideGroup.ts` — FOUND
- `src/utils/slideshowAssembler.ts` — FOUND
- `src/utils/slideGroupMaterializer.ts` — FOUND
- `src/stores/slideGroups.ts` — FOUND
- `src/components/PresentationViewer.vue` — FOUND
- `src/components/SlideshowPreview.vue` — FOUND
- `src/components/SlotMediaAttachment.vue` — FOUND
- `src/views/ServiceEditorView.vue` — FOUND
- Commit `102d7ba` — FOUND in `git log --oneline --all`
- Commit `0af4ce9` — FOUND in `git log --oneline --all`
- Commit `d2c2bec` — FOUND in `git log --oneline --all`

---

## Follow-up: D-19 audio-legacy purge

Plan 25-02 deleted the D-05 slot-media migration's **video** half but left the **audio**
half in place, and one success criterion in the original plan was reported as passing when
it was not (a slot-level `audioUrl` fallback still existed end to end). This follow-up
closes that gap under D-19 ("no legacy compatibility for any slide-related work — delete
it, don't deprecate it") as one atomic, compiling change. Committed as `fix(25-02): ...`.

### Deleted

**Source (4 files):**

- `src/utils/slideGroupMaterializer.ts` — `buildInitialGroup` no longer spreads
  `...(slot.audioUrl ? { bedAudioUrl: slot.audioUrl } : {})`. A freshly materialized group
  always starts with no bed; `setGroupBedMedia` is the only way one is ever set. Doc comment
  rewritten (previously described the D-05 migration as still active).
- `src/utils/slideshowAssembler.ts` — `emitFallback`'s media block (`slotsWithMediaAttached`
  bookkeeping Set + the `if (slot.audioUrl) slide.audioUrl = slot.audioUrl` assignment)
  removed entirely. The slide-emission half of the fallback path (for a slot with no
  materialized group yet) is untouched and continues to work — only the media aspect died,
  per the plan's explicit warning not to break non-media fallback emission.
- `src/views/ServiceEditorView.vue` — `displaySlotAudioUrl` now returns
  `groupsBySlotId.value.get(slot.id)?.bedAudioUrl` only, dropping the `?? slot.audioUrl`
  fallback. Doc comment rewritten (previously described the WR-02 legacy-fallback rationale,
  now obsolete) — same for the inline template comment above the `SlotMediaAttachment` usage.
- `src/types/service.ts` — `MediaAttachableSlot` loses both `audioUrl?: string` and
  `videoUrl?: string`. Interface keeps its name and its one remaining field, `id` (Phase 24
  D-01's anchor — still required for real production `ServiceSlot` documents). Doc comment
  rewritten to describe the current model rather than the removed legacy fields (kept the
  literal strings `audioUrl`/`videoUrl` OUT of the comment so `git grep -n audioUrl
  src/types/service.ts` returns nothing, per the success criterion).

**Stale doc comments updated (no behavior change, 3 files)** — all referenced the now-deleted
D-05 migration or WR-02 fallback as if still active:
- `src/stores/slideGroups.ts` — `materializeGroupIfMissing`'s doc comment
- `src/types/slideGroup.ts` — `SlideGroup.bedAudioUrl`'s doc comment
- `src/types/slide.ts` — `SlideBase.audioUrl`'s doc comment
- `src/composables/useSlideshowAssembly.ts` — the Task 2 section comment and the
  zero-slides-materializes-nothing comment (both referenced "D-05 migration" / "deprecated
  Phase-22 media stays readable")

### Deleted tests (asserted removed migration/fallback behavior)

| Test | File | Why deleted |
|---|---|---|
| `copies audioUrl onto bedAudioUrl when present` | `slideGroupMaterializer.test.ts` | Asserted the exact migration behavior just deleted |
| `does not clear or rewrite the slot's deprecated audioUrl field` | `slideGroupMaterializer.test.ts` | Asserted read-only migration semantics that no longer exist (there is no migration to read) |
| `a legacy slot videoUrl (Phase 22, un-migrated) produces no bed field on the materialized group` | `slideGroupMaterializer.test.ts` | The `videoUrl` field itself no longer exists on `MediaAttachableSlot`, so the fixture can't be constructed; behavior was already covered by the type deletion |
| `a SONG slot with audioUrl set carries it ONLY on the first emitted (leading copyright) slide` | `slideshowAssembler.test.ts` | Asserted the exact `emitFallback` legacy carry-over just deleted |
| `a legacy slot-level videoUrl (Phase 22) is dropped, not carried onto the emitted slide (D-18/D-19)` | `slideshowAssembler.test.ts` | `videoUrl` field no longer exists on the slot type; fixture can't be constructed |
| `a slot with no group still attaches its deprecated media to only its first emitted slide (fallback path unaffected by D-04)` | `slideshowAssembler.test.ts` | Asserted the exact legacy carry-over just deleted; replaced with a test proving NO `audioUrl` key is ever attached in the fallback path |
| `a legacy slot videoUrl (Phase 22, un-migrated) is ignored entirely — no slide carries a videoUrl` | `slideshowAssembler.test.ts` | `videoUrl` field no longer exists on the slot type; fixture can't be constructed |
| `falls back to the slot's own deprecated audioUrl when no group has materialized yet (WR-02)` | `ServiceEditorView.test.ts` | Asserted the exact fallback behavior just deleted from `displaySlotAudioUrl` |
| `prefers the materialized group bed over the slot's deprecated fields when both are present` | `ServiceEditorView.test.ts` | Asserted precedence between the group bed and a legacy field that no longer exists on the type |

### Modified tests (dropped the field from a fixture, kept the test — or adjusted the flow test's terminal assertion)

- `slideGroupMaterializer.test.ts` — `omits bedAudioUrl entirely when the slot has none`
  folded into the renamed `never sets bedAudioUrl — no legacy slot-media migration exists
  under D-19` (same assertion, no fixture needed since the field was never set)
- `slideshowAssembler.test.ts` — `a slot with no media produces slides whose audioUrl is
  undefined` renamed/merged to reflect there being no legacy fallback to bypass in the first
  place; assertion behavior is unchanged (audioUrl stays undefined for a slot with no group)
- `useSlideshowAssembly.test.ts` — `a SONG slot with songId null produces no call; assigning
  a song later produces exactly one call carrying bedAudioUrl` kept its flow assertions
  (no call while `songId` is null, exactly one call once a song is assigned) but dropped the
  `audioUrl` fixture field and changed the terminal assertion from
  `expect((input as SlideGroup).bedAudioUrl).toBe(...)` to
  `expect('bedAudioUrl' in (input as SlideGroup)).toBe(false)` — the call-flow behavior this
  test exists to cover (delayed song assignment triggers exactly one materialize call) is
  unrelated to the deleted migration and stays fully covered
- `ServiceEditorView.test.ts` — `the control displays the url from the group bed, not the
  deprecated slot field` renamed to `the control displays the url from the group bed`
  (fixture never referenced the deleted field; title updated only)

### Verification

- `git grep -nE "\.audioUrl|\.videoUrl" src/ | grep -v bedAudioUrl` — no hits are slot-level;
  all remaining are slide-level (`AssembledSlide.slide.audioUrl`), group-entry-level
  (`GroupSlideEntry.audioUrl`, D-04's kept two-level precedence feature), or
  `SlotMediaAttachment.vue`'s own unrelated component prop
- `git grep -n "audioUrl" src/types/service.ts` — zero hits (both the field and any comment
  mentioning the literal string are gone)
- Bed-audio tests (D-18: `bedAudioUrl` precedence, `audioFromBed`, cross-group continuity) —
  all pass with assertions unmodified
- Slot-id backfill (D-01) — `backfillSlotIds are identical...`, `a second identical id-less
  remote snapshot...` and related tests in `ServiceEditorView.test.ts` still pass unmodified
- `npm run type-check` — 0 errors
- `npm run build` — succeeds
- Targeted run (`npx vitest run` on all 4 touched test files) — 161 passed, 18 skipped, 0
  failed (the 18 skips are the pre-existing quarantine-worktree duplicate suite, unrelated)
- Full `npx vitest run src/` — 150/160 files pass; the 10 failing files are exactly the
  pre-existing baseline (8 quarantined worktree duplicates never run/fixed,
  `storage.rules.test.ts` needing the emulator, and `RosterView.test.ts`'s stale assertion) —
  no new failures introduced, file-set unchanged from before this follow-up

### Issues Encountered

None. All three deletion sites (materializer, assembler, ServiceEditorView) were exactly
where the plan's file list said they'd be; no additional call sites needed touching beyond
the doc-comment cleanup, which was done as a Rule 1/2-adjacent correctness pass (stale
comments describing removed behavior are misleading, not just cosmetic).
