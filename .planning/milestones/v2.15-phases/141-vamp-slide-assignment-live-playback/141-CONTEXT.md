# Phase 141: Vamp Slide Assignment & Live Playback - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A planner assigns a vamp (from the Phase 140 library) to a slide in the service editor, and that vamp plays
audibly and reliably while the slide is live in Run the Service, with no silent failures. Delivers R437
(assign / change / clear a vamp on a slide), R438 (plays + loops while live; single audio owner, no echo),
R439 (explicit arm gesture + visible blocked-audio warning), and R440 (deleting an assigned vamp warns with
the affected-service count but is allowed).

**Owner decision (2026-09-13, overrides the R438/R439 wording about output windows):** vamp audio plays
**only from the computer running the service — the Run control window**. None of the selected outputs
(Audience, Confidence, Video) carry audio. This removes the cross-window autoplay-delegation and
triple-play-echo risks the v2.15 research flagged as the milestone's headline risk.

Out of boundary: crossfade between vamps; propagating a replaced vamp MP3 to existing assignments; a
per-output audio setting; vamp playback in Rehearse mode; anything Phase 140 already shipped.
</domain>

<decisions>
## Implementation Decisions

### Assignment model & editor UX (R437)
- **Denormalize, don't resolve live.** Assigning writes the vamp's `attachment.downloadUrl` into the
  entry's existing `GroupSlideEntry.audioUrl` through the same fresh-base write path `attachSlideAudio`
  already uses (`EditSlideDrawer.vue` → `slideGroupsStore.replaceGroupSlides`), sets `audioLoop: true`,
  and adds two **display-only** fields to `GroupSlideEntry`: `vampId?: string` and `vampLabel?: string`
  (e.g. `Open Response · G`). The presentation pipeline (`slideshowAssembler.ts`, `resolveEntryMedia`,
  `useSlideshowAssembly.ts`, the output views) is NOT changed — it keeps reading `audioUrl`/`audioLoop`.
  Precedent: `SongSlot.songTitle`/`songKey` are denormalized at assignment and never live-updated.
- **Picker lives in the slide drawer's existing audio section.** A "Choose a vamp" button beside the
  existing upload affordance opens a searchable list (name · key · tempo; vamps with no MP3 are listed but
  disabled). Once assigned, the audio row reads "Vamp: {vampLabel}" with **Change** and **Clear** actions.
- **Assignment forces loop on** (a vamp is a bed by definition); the existing loop checkbox stays editable.
- **Clear** removes `vampId`, `vampLabel`, `audioUrl`, and `audioLoop` in one write. Assigning over a
  manually uploaded slide audio replaces it with no extra confirmation (matches replacing audio today).

### Live playback & audibility (R438) — control-window audio owner
- **The Run control window is the single audio owner.** `RunControlView` mounts one `AudioPlayer` bound to
  the live slide's `audioUrl`/`audioLoop`; it plays when a slide with audio goes live, loops natively,
  and pauses on slide change, blackout, and Run exit. No crossfade.
- **All three outputs are silent.** `AudienceOutputView`, `ConfidenceOutputView`, and `VideoOutputView`
  pass a new `suppressAudio` prop (mirroring the shipped `suppressBackground` mechanism) down to
  `SlideCanvas`, which then never mounts `AudioPlayer`. This applies to ALL per-slide audio, not only
  vamp-sourced audio, so there is exactly one audio owner and no echo by construction.
- **Operator visibility:** a "♪ Vamp: {vampLabel}" badge on the live and next preview cards, plus a
  playing indicator on the transport/control bar while audio is audible.

### Arming audio & failure surfacing (R439)
- **Explicit arm toggle on the Run control bar:** "Audio: Off / Armed". Clicking it is the R439 gesture —
  it happens in the same window that plays audio, so it satisfies browser autoplay policy directly (no
  postMessage delegation, no output-window overlays). It also primes the audio element (a muted
  play/pause) so the first vamp starts without a second click.
- **Starts Off every Run session** (in-memory, not persisted); the toggle pulses amber whenever the live
  or next slide carries audio while Off, so the operator is prompted before the slide goes live.
- **Failures are visible in the control window:** if `play()` is rejected while armed, `AudioPlayer`'s
  existing `autoplay-blocked` emit drives a persistent amber "Audio blocked — click to play" warning with
  a one-click retry; a media `error` (e.g. a deleted file) shows "Audio unavailable". Never silent.
- Re-entering Run (or a hot reload) resets the arm state to Off.

### Delete warning (R440)
- **Best-effort affected-service count** before deleting a vamp: a `getDocs` scan of the org's
  `slideGroups` for entries whose `vampId` matches, joined to services with `date >= today`, counting
  distinct services (mirrors the `resyncRehearseAccessForSong` cross-collection scan in `services.ts`).
  The `VampSlideOver` delete confirm reads "Assigned in N upcoming service(s) — those slides keep their
  audio." If the scan fails, show a generic "may be assigned to slides" warning. Deletion is never blocked.
- **Assigned slides keep playing:** when the scan finds any assignment (any service, not only upcoming),
  `deleteVamp` deletes the vamp doc but **keeps the MP3 in Storage**; when nothing is assigned it deletes
  both (Phase 140 behavior). The warning copy states which case applies.
- **Editor display after delete:** the slide drawer keeps showing "Vamp: {vampLabel}" from the denormalized
  label with a muted "(no longer in library)" hint when `vampId` doesn't resolve; Clear still works.
- **Replaced MP3 after assignment:** assigned slides keep the old URL (same accepted staleness as a renamed
  song); the picker's Change action re-points a slide. No propagation.

### Claude's Discretion
- Exact placement/styling of the arm toggle, playing indicator, and preview-card badge within the
  existing `RunHeader` / transport bar / `RunPreviewPair` components.
- Whether the vamp picker is a new small component (`VampPicker.vue`) or inline in `EditSlideDrawer.vue`
  (a separate component is preferred for testability).
- How the pre-delete scan is exposed (`useVampStore.countAssignments(vampId)` vs a util) and its query
  shape, as long as it is best-effort and never blocks the delete on failure.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / Analogs
- `src/components/slides/EditSlideDrawer.vue` — `attachSlideAudio(url)` (fresh-base write via
  `replaceGroupSlides`), `loopChecked`, `onAudioError` → `audioFailed` "Unavailable" affordance. The vamp
  picker hooks in here.
- `src/types/slideGroup.ts` (`GroupSlideEntry.audioUrl` / `audioLoop`) — add `vampId?` / `vampLabel?`.
- `src/components/AudioPlayer.vue` — exposed `play()`/`pause()`, `loop` prop, emits `autoplay-blocked`
  and `error`. Reused as the control-window player.
- `src/components/slides/SlideCanvas.vue` — mounts `AudioPlayer` for `slide.audioUrl`; gains
  `suppressAudio` (mirror `suppressBackground` in `ConfidenceOutputView.vue`).
- `src/views/RunControlView.vue`, `src/components/run/RunHeader.vue`, `RunDisplaysPanel.vue`,
  `RunPreviewPair` — the control-screen surfaces for the arm toggle, warning, and badges.
- `src/composables/useRunControl.ts` (`postIndex`, `postBlackout`, `current`/`next`) — the live slide
  source for the control-window player.
- `src/stores/vamps.ts` (`deleteVamp`, `setAttachment`), `src/components/VampSlideOver.vue` (delete
  confirm) — extend for R440.
- `src/stores/services.ts` `resyncRehearseAccessForSong` — the cross-collection `getDocs` scan pattern.

### Established Patterns
- Denormalize-at-assignment (`SongSlot.songTitle`/`songKey`); per-slide media cascade via
  `resolveEntryMedia`; output views stripped of interactive elements (ADR-0209/0211) — which is exactly why
  audio ownership moves to the control window.
- Run state fans out over a BroadcastChannel (`runChannel.ts` `RunState { index, blackout, seq }`); the
  control window already holds `current`/`next`, so no new channel message is needed for audio.
- Editor-gated writes; church-switch-safe stores.

### Integration Points
- `EditSlideDrawer.vue` audio section (picker + Vamp label + Clear/Change).
- `RunControlView.vue` (AudioPlayer mount + arm toggle + warning + badges).
- `AudienceOutputView.vue` / `ConfidenceOutputView.vue` / `VideoOutputView.vue` → `SlideCanvas.vue`
  (`suppressAudio`).
- `VampSlideOver.vue` delete confirm + `vamps.ts` `deleteVamp` (assignment scan, conditional Storage keep).
</code_context>

<specifics>
## Specific Ideas
- Owner: "Output audio only goes to the computer running the service, not any of the selected outputs."
- Unit tests to add: `GroupSlideEntry` vamp fields + Clear semantics; picker assign/change/clear writes;
  control-window player binding (plays on live change, pauses on change/blackout/exit, honors arm state);
  `autoplay-blocked` → warning; `suppressAudio` on all three output views; `deleteVamp` conditional Storage
  keep + affected-service count; VampSlideOver warning copy.
- Real-speaker UAT (fresh browser profile, actual service run) batched to
  `.planning/v2.15-DEFERRED-VERIFICATION.md` per the v2.15 owner policy.
</specifics>

<deferred>
## Deferred Ideas
- Crossfade between consecutive vamps (needs a dual-source audio architecture).
- Propagating a replaced vamp MP3 to already-assigned slides.
- Per-output audio routing (e.g. audio on a specific output) — explicitly not wanted now.
- Vamp playback inside Rehearse mode.
</deferred>
