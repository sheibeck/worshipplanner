# Phase 142: Slides Tab panel UX from Claude Design - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 3 grey areas, all recommendations accepted by the owner

<domain>
## Phase Boundary

Rework the Slides tab's per-group options strip (`SlideGrid.vue`'s
`slide-grid-group-media-panel`) to match **Turn 7 variant 7a** of the owner's
Claude Design "Slides Tab" mockup (`docs/design/slides-tab.dc.html`, re-pulled
2026-09-19 via DesignSync — Turns 6 and 7 are new since the 2026-08-03 pull).

The mockup's model: a group has **three settings** — *how it shows*
(Display: Full-screen / Banner), *what's behind it* (Background), and *what it
sounds like* (Audio, ONE slot that is either an uploaded track or a vamp).
Production today stacks four unlike buttons in one row (a size toggle, two
audio buttons, a background button) and drops the vamp picker as a slide-over.

7a replaces that with **one 34px row of three chips**, each stating its current
value and opening its own small floating popover on click. Nothing expands the
page. Unset Background/Audio chips read "Add" on a dashed outline; Display
always has a value.

**In scope:** the group strip in `SlideGrid.vue` and the three controls it
composes (`SlotVideoOutputControl`, `SlideGroupMusicControl`, `BackgroundControl`
at the group call site); the group-bed write path so an MP3-less vamp can be
assigned; a "recent backgrounds in this service" source for the Background
popover.

**Out of scope:** the per-slide `EditSlideDrawer` (keeps its own audio /
background surfaces and its `VampPickerSlideOver`); the song-level
`BackgroundControl` call site; Turns 1–5 of the design file; the plan rail,
slide grid cards, and drop target (unchanged by Turn 7).

</domain>

<decisions>
## Implementation Decisions

### Layout variant & panel structure
- Implement mockup variant **7a** — three chips (Display · Background · Audio), each opening its own small popover anchored below the chip; only one popover open at a time; click-outside / Esc closes.
- The other controls that live in the same panel today — `SlotLoopControl` (MISC/ANNOUNCEMENTS), the Congregational-reading button (Scripture), and Remove-imported-entries — stay as secondary buttons **after the three chips on the same row**. They are per-kind actions, not group settings; the chips always lead. Their existing gates and testids are preserved.
- Locked service / non-editor: chips are **visible but inert** — they state the current setup, drop the ▾ caret, and open no popover (matches `SlotVideoOutputControl`'s visible-but-inert rule; replaces today's hide-when-locked behavior for music/background).
- Visual tokens: map the mockup's hex palette onto the app's existing Tailwind tokens (gray-900/800/700 surfaces, indigo accents, amber for the no-MP3 warning) — same transcription approach Phases 137/141 used for this design file. Do not port the mockup's hex values verbatim.

### Audio slot (Track ⟂ Vamp)
- Audio is **one slot** with a None / Track / Vamp segmented control at the top of the popover. Choosing Vamp clears an uploaded track; uploading a Track clears the vamp; None clears both. This matches today's data (`bedAudioUrl` + optional `bedVampId`/`bedVampLabel`) — no schema change, but the write path must clear the other half explicitly (`clearAudio` flag semantics, not undefined).
- A vamp **with no MP3 may be assigned**: store `bedVampId` + `bedVampLabel` with no `bedAudioUrl`. The chip reads amber "♪ Vamp C · no MP3"; the popover's Vamp state shows "⚠ No MP3 attached yet — band plays it live." Live playback silently skips a bed with no URL. Today's `onAttachGroupVamp` early-return on a missing `downloadUrl` is removed for this path.
- Vamp picking happens **inline in the popover** (search box + list, per 7a) by reusing `VampPicker` in fill mode. This replaces the `VampPickerSlideOver` for the *group* strip only; the per-slide drawer keeps its slide-over.
- Track state row: filename · duration when known · ▶ preview (chromeless `AudioPlayer`, same accessible name as today) · **Replace** (file input) · Remove.

### Background & Display chips
- Background popover: **None · recent-in-this-service thumbnails · ＋ upload**. ＋ is also a drop target for an image file. "Recents" = the distinct background URLs already set on other groups (and songs) in this service, most-recent-first, capped to a handful; the currently-set one is highlighted.
- Group whose background is **inherited from the song**: chip reads "Background · *file* (song)" with a solid outline; the popover explains the background is managed on the song and offers no override — preserves the existing owner rule (no group-level override of a song background).
- Display popover: Full-screen / Banner **thumbnail tiles** + hint copy — "Lower third over the live camera feed. Video output only." for Banner, "Fills the screen on every output." for Full-screen. Same `videoOutput.mode` write as today.
- Chip states: Display always shows a value (Full-screen is the default); unset Background/Audio read **"Add"** on a dashed outline so unset is visibly different from set. The row ends (right-aligned, muted) with "applies to all N slides in this group, unless a slide sets its own".

### Claude's Discretion
- Exact popover widths/offsets (mockup: 232px, audio 258px), focus management, and whether the popover is a Teleport or inline-absolute — pick whatever avoids clipping inside the scrolling grid.
- How "recents" are gathered (from the already-loaded slide groups for the service vs. a small computed in `SlidesTab`).
- Whether the three chips become one new component (`SlideGroupSetupStrip.vue`) wrapping the existing controls' logic, or the existing controls are restyled in place — preserve existing emit contracts and testids where tests depend on them.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/slides/SlideGrid.vue` — owns the panel (`data-testid="slide-grid-group-media-panel"`) and every group write: `onAttachGroupMusic`, `onRemoveGroupMusic` (explicit `clearAudio`), `onAttachGroupVamp`, `onAttachGroupBackground`, `onRemoveGroupBackground` (explicit `clearBackground`); gates `canWriteGroupMedia` (song-group carve-out), `showGroupMusicControl`, `showGroupBackgroundControl`, `showVideoOutputControl`, `canLoopSlot`, `showCongregationalControl`, `showRemoveImportedControl`.
- `src/components/slides/SlotVideoOutputControl.vue` — Full-screen/Banner radiogroup writing `videoOutput.mode`; visible-but-inert when `!editable`.
- `src/components/slides/SlideGroupMusicControl.vue` — emit-only (`attach` / `remove` / `attach-vamp`); `useMediaUpload`; chromeless `AudioPlayer` preview; `bedAudioLabel` from `slideDisplay.ts`; vamp-stale detection.
- `src/components/slides/BackgroundControl.vue` — emit-only; `useBackgroundUpload`; `inheritedFrom` provenance row suppresses the add affordance.
- `src/components/VampPicker.vue` (fill mode, from quick 260918-pms) and `src/components/VampPickerSlideOver.vue`.
- `src/stores/slideGroups` — `setGroupBedMedia(orgId, slotId, { serviceId, bedAudioUrl, bedVampId, bedVampLabel })`; `vampStore.vamps` / `isLoading`.
- `src/types/vamp.ts` — `Vamp.attachment` is optional/null (the no-MP3 case already exists in the type).

### Established Patterns
- Controls are emit-only; `SlideGrid` is the single write owner for group media (25-06 / 33-08 / 260918-nm2).
- "Don't render an empty box" (31-UI-SPEC E5): the panel wrapper carries the disjunction of its children's gates.
- Clears use explicit flags (`clearAudio`, `clearBackground`) because `stripUndefined()` would erase an undefined-URL intent before Firestore.
- Tests assert on `data-testid`s (`slide-grid-group-background`, `group-music-*`, `background-control-*`, `slot-video-output-*`); keep or deliberately migrate them with the tests.
- Comment convention: short inline comments; rationale in ADRs / map docs (`.planning/codebase/CONVENTIONS.md`).

### Integration Points
- `SlideGrid.vue` template lines ~139–240 (the panel) and the write handlers ~679–800.
- `SlidesTab.vue` passes `group`, `selectedSlot`, `orgId`, `serviceId` into `SlideGrid`; recents need the service's other groups — check what `SlidesTab` already holds.
- Live playback (`Run the Service` / output windows) must tolerate `bedVampId` set with no `bedAudioUrl`.
- `src/components/slides/__tests__/` — `SlideGrid`, `SlideGroupMusicControl`, `BackgroundControl`, `SlotVideoOutputControl` tests.

</code_context>

<specifics>
## Specific Ideas

- Design source: `docs/design/slides-tab.dc.html` → section "Turn 7 — One thin line", `<div id="7a">` (chips + popovers) and the `Component.renderVals()` block at the bottom (`chips`, `sizeHint`, `audioTabs`, `vampRows`, `POP_LEFT`). Turn 6's `6a` card bodies are the fuller reference for each popover's contents (Background "Change/Remove", Audio "Loops until the group ends.", Display hint copy).
- Empty-state note from the mockup, verbatim intent: "Display always has a value (Full-screen is the default); the other two read 'Add' on a dashed outline, so unset is visibly different from set."
- Audio caption in the mockup: "one source per group"; Silent state copy: "Silent — the room mix carries this group."

</specifics>

<deferred>
## Deferred Ideas

- 7b / 6b (summary line + inline strip or setup sheet with live preview) — not chosen; revisit only if 7a's popovers prove cramped on small screens.
- Per-slide overrides UI in the drawer are untouched; a future pass could give the drawer the same chip vocabulary.

</deferred>
