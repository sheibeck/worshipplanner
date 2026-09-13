# Phase 141: Vamp Slide Assignment & Live Playback - Research

**Researched:** 2026-09-13
**Domain:** Vue 3 + Pinia + Firebase per-slide media assignment and single-window audio playback in a
live worship-presentation control surface
**Confidence:** HIGH — every claim below is grounded in the real files read this session
(`EditSlideDrawer.vue`, `slideGroup.ts`, `AudioPlayer.vue`, `SlideCanvas.vue`, `slideshowAssembler.ts`,
`AudienceOutputView.vue`/`ConfidenceOutputView.vue`/`VideoOutputView.vue`/`FullscreenSlideOutput.vue`,
`RunControlView.vue`, `useRunControl.ts`, `RunHeader.vue`, `RunPreviewPair.vue`, `vamps.ts`,
`VampSlideOver.vue`, `slideGroups.ts`, `firestore.rules`, `stripUndefined.ts`, `myScheduleGrouping.ts`,
`services.ts`, `ServiceEditorView.vue`, `orgScopedStores.ts`, the Phase 140 summaries, and the v2.15
ARCHITECTURE.md/PITFALLS.md research)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase boundary:** A planner assigns a vamp (from the Phase 140 library) to a slide in the service
editor, and that vamp plays audibly and reliably while the slide is live in Run the Service, with no
silent failures. Delivers R437 (assign/change/clear a vamp on a slide), R438 (plays + loops while live;
single audio owner, no echo), R439 (explicit arm gesture + visible blocked-audio warning), and R440
(deleting an assigned vamp warns with the affected-service count but is allowed).

**Owner decision (2026-09-13, overrides the R438/R439 wording about output windows):** vamp audio plays
**only from the computer running the service — the Run control window**. None of the selected outputs
(Audience, Confidence, Video) carry audio. This removes the cross-window autoplay-delegation and
triple-play-echo risks the v2.15 research flagged as the milestone's headline risk.

Out of boundary: crossfade between vamps; propagating a replaced vamp MP3 to existing assignments; a
per-output audio setting; vamp playback in Rehearse mode; anything Phase 140 already shipped.

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
  distinct services (mirrors the `resyncRehearseAccessForSong` cross-collection scan pattern in
  `services.ts`). The `VampSlideOver` delete confirm reads "Assigned in N upcoming service(s) — those
  slides keep their audio." If the scan fails, show a generic "may be assigned to slides" warning.
  Deletion is never blocked.
- **Assigned slides keep playing:** when the scan finds any assignment (any service, not only upcoming),
  `deleteVamp` deletes the vamp doc but **keeps the MP3 in Storage**; when nothing is assigned it deletes
  both (Phase 140 behavior). The warning copy states which case applies.
- **Editor display after delete:** the slide drawer keeps showing "Vamp: {vampLabel}" from the denormalized
  label with a muted "(no longer in library)" hint when `vampId` doesn't resolve; Clear still works.
- **Replaced MP3 after assignment:** assigned slides keep the old URL (same accepted staleness as a renamed
  song); the picker's Change action re-points a slide. No propagation.

### Claude's Discretion
- Exact placement/styling of the arm toggle, playing indicator, and preview-card badge within the
  existing `RunHeader` / transport bar / `RunPreviewPair` components. **Resolved by 141-UI-SPEC.md
  (APPROVED)** — see Component Specifications §3/§4/§5/§6 there; the planner should treat the UI-SPEC's
  concrete markup/testids as locked, not merely discretionary, since it has already passed the 6-dimension
  checker.
- Whether the vamp picker is a new small component (`VampPicker.vue`) or inline in `EditSlideDrawer.vue`
  (a separate component is preferred for testability). **Resolved by 141-UI-SPEC.md**: a new
  `VampPicker.vue`, mounted inline (not Teleport/modal) inside `EditSlideDrawer.vue`'s existing
  `data-testid="drawer-audio-section"` block.
- How the pre-delete scan is exposed (`useVampStore.countAssignments(vampId)` vs a util) and its query
  shape, as long as it is best-effort and never blocks the delete on failure.

### Deferred Ideas (OUT OF SCOPE)
- Crossfade between consecutive vamps (needs a dual-source audio architecture).
- Propagating a replaced vamp MP3 to already-assigned slides.
- Per-output audio routing (e.g. audio on a specific output) — explicitly not wanted now.
- Vamp playback inside Rehearse mode.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R437 | A planner can assign a vamp to a slide (audioUrl denormalized + display-only vampId/vampLabel), clearable/changeable. | Exact write-path precedent (`attachSlideAudio` → `replaceGroupSlides`) identified at `EditSlideDrawer.vue:867-874`; `GroupSlideEntry` field-addition site identified at `slideGroup.ts:55-75`; new `VampPicker.vue` component contract fully specified in 141-UI-SPEC.md §1/§2. |
| R438 | Live slide with a vamp plays + loops until slide changes/cleared, audible ONLY from the Run control window (owner override). | Playback owner moved from output windows to `RunControlView` — new `AudioPlayer` mount point identified (none exists there today); `suppressAudio` prop design mirrors the shipped `suppressBackground` mechanism on `SlideCanvas.vue:332-341,403-408`; all 3 output-facing `SlideCanvas` mount sites enumerated (`FullscreenSlideOutput.vue` ×2, `ConfidenceOutputView.vue` ×2). |
| R439 | Explicit arm gesture on Run/control screen; visible warning when still blocked after arming. | `AudioPlayer.vue`'s existing `autoplay-blocked`/`error` emits (lines 91-95, 56-57) are the exact hooks; 141-UI-SPEC.md §3/§4/§5 give the concrete arm-toggle/banner/unavailable-indicator markup; `useRunControl.ts`'s existing `postBlackout`/`endServiceTeardown`/`endRehearsal` are the reset points. |
| R440 | Deleting an assigned vamp warns with affected-service count but allows deletion; assigned slides keep audio (Storage MP3 kept when assigned). | `resyncRehearseAccessForSong` (`services.ts:791+`) is the exact cross-collection `getDocs` scan precedent; `todayYmd()` (`myScheduleGrouping.ts:23`) is the exact date-comparison helper to reuse; `firestore.rules:453` confirms an editor can `list` `slideGroups` org-wide with no rule change; `vamps.ts`'s `deleteVamp` (lines 93-104) is the exact function to branch. |
</phase_requirements>

## Summary

This phase is unusually well-specified going into planning: CONTEXT.md locks the data model, the write
paths, and (critically) an owner override that **replaces** the audio-output architecture the earlier
v2.15 research (ARCHITECTURE.md/PITFALLS.md) and REQUIREMENTS.md's R438/R439 prose describe. Those
documents say "audible from the Audience output only, Confidence/Video muted" and describe a
cross-window `postMessage` audio-unlock handshake between the Run control screen and the output windows.
**That design is superseded.** The 2026-09-13 owner decision is: **all three outputs (Audience,
Confidence, Video) are silent; the Run control window itself is the one and only audio owner.** This is
simpler to implement and testable in a single document (no BroadcastChannel audio message, no
cross-window autoplay delegation), and it eliminates Pitfall 2 (triple-play echo) by construction rather
than by a suppression flag on two of three outputs. The planner should build to CONTEXT.md's model and
should NOT reintroduce the output-audio machinery the older research describes — that machinery is not
needed for this phase and reintroducing it would be scope creep against an explicit, dated owner decision.

The remaining engineering work is four small, well-isolated slices reusing shipped primitives with zero
new npm dependencies: (1) two additive optional fields on `GroupSlideEntry` plus a new `VampPicker.vue`
wired into `EditSlideDrawer.vue`'s existing audio section and fresh-base write helper; (2) a `suppressAudio`
prop on `SlideCanvas.vue` (a narrow mirror of the shipped `suppressBackground` prop) applied at exactly 4
call sites across 3 output-view files, plus a brand-new `AudioPlayer` mount inside `RunControlView`
driven by `useRunControl.ts`'s existing `current`/`blackout`/`live` state; (3) an arm-toggle/banner UI
layer in `RunHeader.vue`/`RunControlView.vue` consuming `AudioPlayer`'s already-shipped
`autoplay-blocked`/`error` events — no new browser API surface to learn; (4) a best-effort pre-delete
scan in `vamps.ts`/`VampSlideOver.vue` mirroring the already-proven `resyncRehearseAccessForSong` pattern.

Two non-obvious findings from this pass, both load-bearing for the plan and not mentioned in CONTEXT.md
or the UI-SPEC:

1. **`useVampStore` is not subscribed anywhere the Slides tab can reach it.** Today `vampStore.subscribe(orgId)`
   is called only from `SongsView.vue` (`SongsView.vue:446`). `ServiceEditorView.vue`'s own `initStores()`
   subscribes `serviceStore`/`songStore` unconditionally and `rosterStore`/`quartersStore`/`teamsStore`
   inside an `authStore.isEditor` gate (`ServiceEditorView.vue:3157-3185`) — vamps is missing entirely. Without
   adding `vampStore.subscribe(orgId)` there, a user who opens Slides directly (never having visited the
   Vamps tab) sees an empty picker with no error, which looks like "no vamps exist" — a silent functional
   gap, not caught by CONTEXT.md's scope statement. It must go **inside** the `isEditor` gate (see Pitfalls
   below — `vamps` is editor-read-gated in `firestore.rules`, a viewer subscribing would get denied).
2. **The presentation pipeline is deliberately NOT touched (CONTEXT.md), so `vampLabel` cannot flow through
   `AssembledSlide`.** The ♪ badge on `RunPreviewPair`'s current/next panes therefore cannot read
   `current.slide.vampLabel` — that field doesn't exist on `Slide`. It must be resolved by a **second,
   independent lookup**: `AssembledSlide.groupId`/`groupSlideId` (already emitted by the assembler, used
   today only as a Vue `:key`) index into `useSlideGroups().groupsBySlotId` to find the raw
   `GroupSlideEntry` and read its `.vampLabel` directly — bypassing the assembled/resolved slide entirely.
   This is additive and requires zero assembler changes, exactly matching the "no new render surface"
   framing, but it is a distinct code path the planner must call out as its own task.

**Primary recommendation:** implement in this order — (1) type + picker + editor write path, (2)
`suppressAudio` + the Run control `AudioPlayer` mount (R438's core), (3) arm/warning UI layered on top of
(2) (R439), (4) the delete-scan warning (R440, fully independent of 1-3 and safely parallelizable).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vamp→slide assignment (picker, write) | Frontend (Vue component + Pinia store) | Database (Firestore `slideGroups` doc) | Pure client write through the existing `replaceGroupSlides` fresh-base helper; no backend function involved. |
| Vamp audio playback while live | Browser / Client (Run control window's own `<audio>` element) | — | Owner-locked: audio plays from exactly one browser document (the operator's own tab), driven imperatively by `useRunControl.ts`'s `current`/`blackout` state — no server round-trip, no other window. |
| Output-window audio suppression | Browser / Client (`SlideCanvas.vue` conditional render) | — | A pure render-time gate (`suppressAudio` prop) — never mounting the `<audio>` element is structurally stronger than muting one after mount. |
| Autoplay-arm gesture + blocked-state UI | Browser / Client (Run control screen) | — | Browser autoplay policy is enforced per-document by the browser itself; the fix is a same-document user gesture, not a server or API concern. |
| Delete-time affected-service count | Frontend (Pinia store, `getDocs` scan) | Database (Firestore `slideGroups` + `services` collections) | Best-effort client-side read-then-count; no Cloud Function needed since the scan tolerates staleness and never blocks the delete. |
| Storage-cascade delete (keep-vs-remove MP3) | Frontend (Pinia store) | Storage (Firebase Storage `vamp-files/`) | Extends the already-shipped `deleteVamp`'s Storage cascade with a conditional branch — still client-driven, `storage.rules` already permits editor delete. |

## Standard Stack

No new libraries for this phase — every capability is built from primitives already shipped in this
codebase.

### Core (all pre-existing, reused verbatim)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 (`<script setup>`) | (project-pinned) | `VampPicker.vue`, `SlideCanvas.vue` prop addition, `RunHeader.vue`/`RunControlView.vue` additions | Existing SFC conventions throughout `src/components` |
| Pinia | (project-pinned) | `useVampStore` extension (`countAssignments`/conditional delete), no new store | Matches every other org-scoped store in this codebase |
| Firebase JS SDK (`firestore`, `storage`) | (project-pinned) | `getDocs` scan for R440; existing `deleteObject`/`deleteDoc` calls | Already the sole persistence layer; no alternative considered |
| Native `HTMLMediaElement` (`<audio>`) via the existing `AudioPlayer.vue` wrapper | n/a (browser API) | All playback, looping, and autoplay-block detection | `AudioPlayer.vue` already implements the `NotAllowedError` → `autoplay-blocked` emit and `AbortError` swallow this phase needs — see Code Examples |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | — |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A same-document arm gesture (locked) | A cross-window `postMessage` audio-unlock handshake (the ORIGINAL v2.15 PITFALLS.md Pitfall 1 recommendation) | Superseded by the 2026-09-13 owner decision — the control window IS the audio owner now, so there is no second document to unlock. Do not build this. |
| `vampId`-as-reference resolved live in the assembler (ARCHITECTURE.md Pattern 2's rejected alternative) | Denormalize at assignment (locked) | The codebase's own established convention (`SongSlot.songTitle`/`songKey`) and CONTEXT.md's explicit "no new render surface" constraint; a live-reference redesign would touch the assembler + 4 `useSlideshowAssembly.ts` call sites for a benefit (auto-propagation on vamp edit) explicitly deferred. |

**Installation:** none — no `npm install` step in this phase's plan.

**Version verification:** not applicable — no package.json changes.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new npm/PyPI/crates packages. Every dependency used
(`vue`, `pinia`, `firebase`) is already present in `package.json` and was vetted in prior phases. The
Package Legitimacy Gate is a no-op here; the planner should not add an install step for this phase and
should not run `npm view`/`package-legitimacy check` since there is nothing new to check.

**Packages removed due to [SLOP] verdict:** none — no packages proposed.
**Packages flagged as suspicious [SUS]:** none — no packages proposed.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  SERVICE EDITOR (Slides tab)                                                          │
│                                                                                        │
│   EditSlideDrawer.vue "drawer-audio-section"                                          │
│     ├─ (no vampId) → VampPicker.vue "Choose a vamp" ──► pick a vamp ──┐                │
│     └─ (vampId set) → "Vamp: {vampLabel}" row  ◄── Change / Clear ────┤               │
│                                                                        │               │
│         attachVampToSlide(vamp) / clearVampAssignment()               │               │
│                        │                                              │               │
│                        ▼                                              │               │
│         slideGroupsStore.replaceGroupSlides(...)  [existing fresh-base write]          │
│                        │                                                               │
└────────────────────────┼───────────────────────────────────────────────────────────────┘
                          ▼
        Firestore: organizations/{orgId}/slideGroups/{slotId}
          .slides[i] = { ...audioUrl, audioLoop, vampId, vampLabel }   (additive fields)
                          │
        ┌─────────────────┴──────────────────────────────────────────────┐
        ▼                                                                 ▼
  slideshowAssembler.ts → resolveEntryMedia()   [UNCHANGED]      useSlideGroups().groupsBySlotId
        │  reads audioUrl/audioLoop only                          [NEW read, RunControlView only]
        ▼                                                          reads vampId/vampLabel for the
  AssembledSlide.slide.audioUrl / .audioLoop                       ♪ badge — bypasses the assembler
        │                                                          entirely (see Summary finding #2)
        ├──────────────► SlideCanvas.vue (Audience/Confidence/Video outputs)
        │                    :suppress-audio="true"  ──► AudioPlayer NEVER mounted (R438: silent)
        │
        └──────────────► RunControlView.vue (NEW mount point)
                             <AudioPlayer ref="audioElRef" :src="current.slide.audioUrl"
                                          :loop="current.slide.audioLoop" />
                             driven by useRunControl.ts's watch(current)/watch(blackout)/
                             endServiceTeardown()/endRehearsal(), gated on armed.value
                             ├─ play() rejected (NotAllowedError) → 'autoplay-blocked'
                             │     → amber "Audio blocked — click to play" banner (R439)
                             └─ media 'error' (deleted file)
                                   → "Audio unavailable" indicator (R439)

  DELETE PATH (R440, independent of the above)
   VampSlideOver.vue "Delete vamp" click
        │
        ▼
   useVampStore().countAssignments(vampId)  [NEW, best-effort]
        │  getDocs(organizations/{orgId}/slideGroups)  — firestore.rules already allows
        │  filter entries where vampId matches → distinct serviceIds
        │  getDoc each service, keep where service.date >= todayYmd()
        ▼
   "Assigned in N upcoming service(s)…" warning line, prepended to the unchanged
   Phase 140 delete-confirm body
        │
        ▼
   deleteVamp(id) — branch: if ANY assignment found (any service, not just upcoming),
   delete the Firestore doc only (keep Storage MP3); else delete both (Phase 140 behavior)
```

### Recommended Project Structure

No new top-level folders. New/modified files, matching the existing flat `src/components`/`src/stores`
layout:

```
src/
├── components/
│   ├── VampPicker.vue                 # NEW — picker list, mounted inline in EditSlideDrawer
│   ├── slides/
│   │   ├── EditSlideDrawer.vue        # MODIFIED — vamp row + Change/Clear + write functions
│   │   └── SlideCanvas.vue            # MODIFIED — new `suppressAudio?: boolean` prop
│   ├── run/
│   │   ├── RunHeader.vue              # MODIFIED — arm toggle (per UI-SPEC §3)
│   │   └── RunPreviewPair.vue         # MODIFIED — ♪ badge (per UI-SPEC §6)
│   └── VampSlideOver.vue              # MODIFIED — R440 warning line (per UI-SPEC §7)
├── composables/
│   └── useRunControl.ts               # MODIFIED — armed/audioBlocked/audioUnavailable/
│                                       #   audioElRef/currentVampLabel/nextVampLabel/retryPlayAudio
├── stores/
│   └── vamps.ts                       # MODIFIED — countAssignments() + deleteVamp Storage-keep branch
├── types/
│   └── slideGroup.ts                  # MODIFIED — GroupSlideEntry.vampId?/vampLabel? (additive)
└── views/
    ├── RunControlView.vue             # MODIFIED — mounts <AudioPlayer ref="audioElRef">, banner
    ├── AudienceOutputView.vue         # unchanged (delegates to FullscreenSlideOutput)
    ├── ConfidenceOutputView.vue       # MODIFIED — :suppress-audio="true" ×2 (current+next panes)
    └── VideoOutputView.vue            # unchanged (delegates to FullscreenSlideOutput)
    (src/components/output/FullscreenSlideOutput.vue MODIFIED — :suppress-audio="true" ×2)
```

### Pattern 1: Fresh-base write for additive slide-entry fields (R437)

**What:** Every mutation to a `GroupSlideEntry` in this codebase reads `props.group.slides` as `base`,
maps a new array replacing/deleting keys on the target entry, and calls
`slideGroupsStore.replaceGroupSlides(orgId, slotId, next, sourceSignature, base)`. `replaceGroupSlides`
internally runs a transaction that merges any concurrently-added entries against the live document, so
`base` must be exactly the array the write was computed from (not a stale closure).

**When to use:** Every one of this phase's writes — assign, clear, and the loop-forced-on side effect all
go through this one function, exactly like `onLoopToggle`/`attachSlideAudio`/`removeSlideAudio` already do.

**Example (assign — new function, modeled on `attachSlideAudio` at `EditSlideDrawer.vue:867-874`):**
```typescript
// Source: EditSlideDrawer.vue:867-874 (attachSlideAudio), narrowed pattern for vamp assignment
async function attachVampToSlide(vamp: Vamp): Promise<void> {
  if (!props.group || !props.entry || !vamp.attachment) return
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) =>
    e.id === entryId
      ? { ...e, audioUrl: vamp.attachment!.downloadUrl, audioLoop: true, vampId: vamp.id, vampLabel: `${vamp.name} · ${vamp.key}` }
      : e,
  )
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
}
```

**Example (clear — MUST `delete` keys on a shallow copy, not set `undefined` inline, matching
`removeSlideAudio` at `EditSlideDrawer.vue:907-918` and `removeSlideBackground` at `:992-1004`):**
```typescript
// Source: EditSlideDrawer.vue:907-918 (removeSlideAudio), narrowed pattern for vamp clear
async function clearVampAssignment(): Promise<void> {
  if (!props.group || !props.entry) return
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) => {
    if (e.id !== entryId) return e
    const rest = { ...e }
    delete rest.vampId
    delete rest.vampLabel
    delete rest.audioUrl
    delete rest.audioLoop
    return rest
  })
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
}
```
Note: `replaceGroupSlides` already deep-strips `undefined` via `stripUndefined()` (confirmed recursive —
`src/utils/stripUndefined.ts:6-22`), so functionally either approach would reach Firestore clean. The
`delete`-on-a-copy idiom is the established convention in this exact file and should be followed for
consistency, not because `stripUndefined` requires it.

### Pattern 2: `suppressAudio` mirrors the shipped `suppressBackground` mechanism exactly

**What:** `SlideCanvas.vue` already has `suppressBackground?: boolean`
(`SlideCanvas.vue:332-341`) which forces `currentBackgroundUrl` to `null`
(`SlideCanvas.vue:403-408`) regardless of the slide's own resolved background. `suppressAudio` is the
identical shape applied to `currentAudioUrl` (`SlideCanvas.vue:387`) and the `<div v-if="currentAudioUrl
&& !mediaFailed">` wrapper that mounts `AudioPlayer` (`SlideCanvas.vue:249-264`).

**When to use:** All four output-facing `SlideCanvas` mount sites — never inside `RunPreviewPair.vue`'s
own preview-pane `SlideCanvas` usages, since those never call `.play()` today (no `ref` is bound) and are
therefore already inert; leaving them unsuppressed is harmless (see Pitfalls) but suppressing them too is
a reasonable, low-risk cleanup at the planner's discretion.

**Example:**
```vue
<!-- SlideCanvas.vue — narrow addition mirroring suppressBackground -->
<script setup lang="ts">
const props = defineProps<{
  slide: AssembledSlide | null
  suppressBackground?: boolean
  suppressAudio?: boolean   // NEW
  interactive?: boolean
}>()
const currentAudioUrl = computed<string | null>(() =>
  props.suppressAudio ? null : (props.slide?.slide.audioUrl ?? null),
)
</script>
```
```vue
<!-- FullscreenSlideOutput.vue — both SlideCanvas mounts (full-stage + video banner) -->
<SlideCanvas ref="slideCanvasRef" :slide="currentSlide" :interactive="false" :suppress-audio="true" />
<SlideCanvas ref="bannerSlideCanvasRef" :slide="currentSlide" :interactive="false" :suppress-audio="true" />
```
```vue
<!-- ConfidenceOutputView.vue — both current and next panes -->
<SlideCanvas ref="currentCanvasRef" :slide="currentSlide" :suppressBackground="true" :interactive="false" :suppress-audio="true" />
<SlideCanvas :slide="nextSlide" :suppressBackground="true" :interactive="false" :suppress-audio="true" />
```
Because `AudienceOutputView.vue` and `VideoOutputView.vue` are thin wrappers that delegate their entire
render to `FullscreenSlideOutput.vue` (`AudienceOutputView.vue:9`, `VideoOutputView.vue:6`), suppressing
audio inside `FullscreenSlideOutput.vue` covers BOTH of them with one edit — do not add a `suppressAudio`
prop to `AudienceOutputView.vue`/`VideoOutputView.vue` themselves (there is no per-output audio setting,
per CONTEXT.md's "Out of boundary" list); hardcode `true` directly at the `FullscreenSlideOutput.vue` call
sites.

### Pattern 3: The Run control window's own `AudioPlayer`, bound via a composable-owned template ref

**What:** `RunControlView.vue` mounts NO `SlideCanvas` of its own today (only `RunPreviewPair.vue` does,
for the on-screen/next-up preview thumbnails, and those never call `.play()`). This phase adds a brand
new, dedicated `AudioPlayer` instance directly in `RunControlView.vue`'s template, driven entirely from
`useRunControl.ts` — following the SAME pattern already used for `cancelBtnRef` (a `Ref` object defined
and returned by the composable, bound via `ref="cancelBtnRef"` in the view's template at
`RunControlView.vue:255`).

**When to use:** This is the ONE new mount point for R438/R439. Do not attempt to reuse or extend
`RunPreviewPair.vue`'s embedded `SlideCanvas`/`AudioPlayer` — it is display-only (`:interactive="false"`,
no exposed ref, no play() call anywhere), and CONTEXT.md's decision is a dedicated player, not repurposing
the preview one.

**Example (composable side, additive to the existing `useRunControl.ts` return block near
`current`/`blackout`):**
```typescript
// New in useRunControl.ts — follows the existing cancelBtnRef pattern (composable owns the ref,
// the view template binds it) and the existing watch(index, …)/pause-then-play sequencing already
// used by ConfidenceOutputView.vue/FullscreenSlideOutput.vue for their own media.
const audioElRef = ref<InstanceType<typeof AudioPlayer> | null>(null)
const armed = ref(false)
const audioBlocked = ref(false)
const audioUnavailable = ref(false)

function toggleArmed() {
  armed.value = !armed.value
  if (armed.value) void audioElRef.value?.play() // primes + starts the current slide's audio if any
  else audioElRef.value?.pause()
}

watch(current, async () => {
  audioBlocked.value = false
  audioUnavailable.value = false
  audioElRef.value?.pause()
  await nextTick()
  if (armed.value && !blackout.value) void audioElRef.value?.play()
})

watch(blackout, (v) => {
  if (v) audioElRef.value?.pause()
  else if (armed.value) void audioElRef.value?.play()
})

// Inside endServiceTeardown() and endRehearsal(), alongside the existing
// live.value = false / blackout.value = false lines:
//   armed.value = false
//   audioElRef.value?.pause()
```
```vue
<!-- RunControlView.vue template — new mount, sibling to RunHeader, no visible chrome
     (chromeless, like the drawer's own AudioPlayer usage at EditSlideDrawer.vue:299) -->
<AudioPlayer
  v-if="current?.slide.audioUrl"
  ref="audioElRef"
  chromeless
  :src="current.slide.audioUrl"
  :loop="current.slide.audioLoop"
  @autoplay-blocked="audioBlocked = true"
  @error="audioUnavailable = true"
/>
```

### Anti-Patterns to Avoid
- **Do not resurrect the cross-window `postMessage` audio-unlock handshake** described in the pre-2026-09-13
  v2.15 PITFALLS.md/ARCHITECTURE.md research. CONTEXT.md's owner override makes it unnecessary; building it
  anyway would add an entire message-passing surface (and its own tests) for a feature this phase does not
  need.
- **Do not add `vampId`/`vampLabel` to the assembler's output (`AssembledSlide`/`Slide`).** CONTEXT.md is
  explicit that the presentation pipeline is unchanged. Resolve the badge's label via `groupsBySlotId`
  instead (Summary finding #2 / Pattern 4 below).
- **Do not gate `vampStore.subscribe(orgId)` outside the `authStore.isEditor` block** in
  `ServiceEditorView.vue`'s `initStores()` — the `vamps` Firestore collection is read-gated to editors only
  (see Pitfalls), so an ungated subscribe would throw a permission-denied for every viewer who opens a
  service.

### Pattern 4: Resolving `vampLabel` for the Run-screen badge without touching the assembler

**What:** `AssembledSlide` already carries `groupId` and `groupSlideId` (`slideshowAssembler.ts:391-392`),
today used only as a Vue `:key`. `useSlideGroups()` (the same Pinia singleton `useSlideshowAssembly.ts`
already subscribes via `slideGroupsStore.subscribeGroups(id)`, called transitively through
`useServiceAssembly()` which `useRunControl.ts` already calls) exposes `groupsBySlotId: ComputedRef<Map<string, SlideGroup>>`.
Since `SlideGroup.id === SlideGroup.slotId === groupId`, the raw (unresolved) `GroupSlideEntry` — and
therefore its `vampId`/`vampLabel` — is one map lookup + one array `.find()` away, with zero assembler
changes and zero new subscriptions.

**Example:**
```typescript
// New in useRunControl.ts (or a small pure helper it calls) — import useSlideGroups directly rather
// than widening useServiceAssembly's public return shape (lower blast radius: useServiceAssembly.ts
// today returns only { serviceId, orgIdRef, localService, assembledSlideshow }).
import { useSlideGroups } from '@/stores/slideGroups'
const slideGroupsStore = useSlideGroups()

function vampLabelFor(slide: AssembledSlide | null): string | null {
  if (!slide) return null
  const group = slideGroupsStore.groupsBySlotId.get(slide.groupId)
  const entry = group?.slides.find((e) => e.id === slide.groupSlideId)
  return entry?.vampLabel ?? null
}
const currentVampLabel = computed(() => vampLabelFor(current.value))
const nextVampLabel = computed(() => vampLabelFor(next.value))
```
This same lookup (entry's raw `vampId` vs. `useVampStore().vamps`) is also how the drawer's "(no longer in
library)" stale hint should be computed — do not derive staleness from anything on the assembled slide.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting a blocked/rejected `play()` call | A custom `try/catch` around `HTMLMediaElement.play()` in a new component | `AudioPlayer.vue`'s existing `play()` (lines 79-102) — already distinguishes `NotAllowedError` (→ `autoplay-blocked` emit) from `AbortError` (swallowed, a pause-interrupted-play artifact per ADR-0061) from any other rejection (re-thrown) | This exact distinction was already debugged and ADR'd once; re-deriving it risks reintroducing the `AbortError` false-positive bug ADR-0061 fixed. |
| A per-org/per-service "is this vamp assigned anywhere" query | A new Cloud Function or a denormalized `assignedVampIds` index | A client-side best-effort `getDocs` scan mirroring `resyncRehearseAccessForSong` (`services.ts:791+`) | The codebase's established convention for advisory (non-blocking) cross-collection checks is a client scan, not a server index — matches the "advisory only, not a hard block" philosophy CONTEXT.md states explicitly. |
| A "which services are upcoming" date comparison | A new date-math utility or a date library | `todayYmd()` (`myScheduleGrouping.ts:23`) plus plain string `>=` comparison (services already store `date: string` in `YYYY-MM-DD` form, `service.ts:221`) | This exact idiom is already the codebase-wide convention (`myScheduleGrouping.ts:50`, `ServicesView.vue:229-249`) — introducing a second date-comparison approach would fragment the convention. |
| Writing `undefined` to clear a nested array-entry field | A custom deep-clean helper | The `delete rest.<key>` idiom already used 2× in this exact file (`EditSlideDrawer.vue:907-918`, `:992-1004`), backstopped by `replaceGroupSlides`'s own `stripUndefined()` call | Two independent safety nets already exist; a third bespoke one adds nothing. |

**Key insight:** every piece of this phase has a near-identical, already-shipped precedent in the same
codebase. The planner's job is almost entirely "locate the precedent, narrow it" rather than "design
something new" — treat any task that doesn't cite an existing file/line as a signal to look harder before
writing new logic from scratch.

## Common Pitfalls

### Pitfall 1: `useVampStore` is never subscribed on the path that needs it
**What goes wrong:** A user opens a service's Slides tab directly (e.g., via a bookmarked URL, or simply
because Slides is visited before ever touching the Songs/Vamps tab in that session) and the new "Choose a
vamp" picker renders permanently empty — indistinguishable from "this org has no vamps yet," which is a
real, valid, differently-worded state (per 141-UI-SPEC.md's E1 empty-state copy). No error is thrown; it
just silently shows the wrong empty state.
**Why it happens:** `vampStore.subscribe(orgId)` is called from exactly one place today —
`SongsView.vue:446` — and nowhere else. `ServiceEditorView.vue`'s `initStores()` subscribes
`serviceStore`/`songStore` unconditionally and `rosterStore`/`quartersStore`/`teamsStore` inside an
`authStore.isEditor` gate (`ServiceEditorView.vue:3157-3185`), but was never touched by Phase 140 (out of
that phase's scope) and has no vamps entry.
**How to avoid:** Add `if (!vampStore.orgId) { vampStore.subscribe(orgId) }` to `initStores()`, **inside**
the `if (authStore.isEditor)` block (see Pitfall 2 for why it cannot go alongside `songStore`).
**Warning signs:** the picker shows "No vamps yet — add one from the Vamps tab" copy even though the
Vamps tab clearly has vamps with MP3s attached.

### Pitfall 2: Subscribing `vamps` ungated throws permission-denied for viewers
**What goes wrong:** If `vampStore.subscribe(orgId)` is added alongside `songStore.subscribe(orgId)`
(outside the `isEditor` gate, matching how `songStore` itself is subscribed), a non-editor viewer opening
any service triggers an `onSnapshot` listener against `organizations/{orgId}/vamps` that Firestore denies.
**Why it happens:** Per the Phase 140-02 summary, the `vamps` collection has NO dedicated `firestore.rules`
block — it falls through to the generic nested-collection catch-all
(`firestore.rules:508-513`), which requires `isOrgEditor(orgId)` for **both** read and write (unlike
`songs`, which has its own explicit `allow read, write: if isOrgEditor(orgId)` block but is still
editor-only too — actually check: `songStore` subscribes unconditionally because `songs` is *also*
editor-gated per `firestore.rules:481-482`, yet the app subscribes it for all users today. This is an
existing, pre-141 latent gap in `songStore`'s own subscribe-gating that this phase should NOT copy.).
**How to avoid:** Put `vampStore.subscribe(orgId)` inside the `if (authStore.isEditor)` block alongside
`rosterStore`/`quartersStore`/`teamsStore` — a viewer never sees the picker (`canMutate`-gated) and the
"Vamp: {vampLabel}" row is fully denormalized (no store lookup needed for a viewer), so nothing is lost by
scoping the subscription to editors only. The one viewer-visible feature that *would* need vamps data —
the "(no longer in library)" stale hint — simply never renders for a viewer; that is an acceptable,
narrow gap consistent with the existing read-gate, not a regression.
**Warning signs:** a Firestore permission-denied console error appears for a viewer account the moment
they open any service in the editor, immediately after this phase ships.

### Pitfall 3: The ♪ badge cannot be read off `AssembledSlide` — it isn't there
**What goes wrong:** A naive implementation tries `current.value?.slide.vampLabel` (mirroring how
`audioUrl`/`audioLoop` are read) and gets `undefined` for every slide, because `Slide`/`AssembledSlide`
never carries `vampId`/`vampLabel` — CONTEXT.md deliberately keeps the assembler pipeline unaware of vamps
entirely.
**Why it happens:** The denormalized fields live on the raw, unresolved `GroupSlideEntry` inside
`SlideGroup.slides[]`, one Firestore-shape layer below what `resolveEntryMedia`/the assembler ever expose
to a consumer.
**How to avoid:** Resolve the label via `useSlideGroups().groupsBySlotId.get(slide.groupId)?.slides.find(e => e.id === slide.groupSlideId)?.vampLabel`
(Pattern 4 above) — a lookup, not a slide-shape addition.
**Warning signs:** the ♪ badge never appears on the Run screen even for a slide the editor clearly shows
"Vamp: {vampLabel}" for.

### Pitfall 4: Writing the arm/blocked state machine as if slide-change and blackout are independent
**What goes wrong:** `blackout` and `current` (slide index) both change independently in
`useRunControl.ts`, and both must pause/resume audio correctly: going to black while a vamp plays must
pause it; clearing black should resume it (mirroring the existing loop-timer's own
`postBlackout` → `reconcileLoop()` pattern, `useRunControl.ts:191-200`); advancing past a slide with audio
while blacked out must NOT start playing audio the operator can't see is coming. A naive `watch(current)`
alone (no `blackout` interaction) either double-plays on unblack or plays through a blackout.
**Why it happens:** This phase is the first consumer of BOTH signals at once for a single piece of
behavior — the existing loop-timer precedent (`reconcileLoop`, referenced at `useRunControl.ts:169-174,
191-200`) already solved exactly this class of problem for slide auto-advance and is the pattern to mirror,
not reinvent.
**How to avoid:** Gate every `play()` call on `armed.value && !blackout.value`, and add the blackout-aware
watcher shown in Pattern 3 above (mirroring `reconcileLoop`'s own blackout-awareness).
**Warning signs:** audio keeps playing after "Go to black," or audio is silent after "Clear black" even
though the current slide has a vamp and audio is armed.

### Pitfall 5: `RunPreviewPair.vue`'s own embedded `SlideCanvas`/`AudioPlayer` is a harmless-but-confusing
dangling audio element
**What goes wrong:** `RunPreviewPair.vue` already mounts `<SlideCanvas :slide="current" :interactive="false">`
(and the same for `next`) with **no** `ref` and **no** `.play()` call anywhere in that file
(`RunPreviewPair.vue:58,103`). Since `AudioPlayer`'s `<audio>` element has `preload="none"` and no
`autoplay` attribute, this mounted-but-never-played element is inert today and will remain inert after this
phase ships (nothing new calls `.play()` on it) — it is not a live echo risk. However, a reviewer inspecting
the DOM during this phase's work may reasonably flag "why are there two `<audio>` elements for the same
slide in the control window" as a bug.
**Why it happens:** `RunPreviewPair.vue`'s `SlideCanvas` usage predates this phase and was built purely as
a visual thumbnail; it was never wired for playback.
**How to avoid:** Either (a) leave it as-is and note in the plan's SUMMARY that it is inert-by-construction
(no ref, no play() call), or (b) pass `:suppress-audio="true"` there too for cleanliness (zero functional
change, since it never played anyway) — (b) is the lower-surprise choice and is recommended as a small,
optional task.
**Warning signs:** a code reviewer or the `plan-checker` flags "two AudioPlayer mounts for the current
slide in RunControlView" as a duplicate-owner concern; this note preempts that.

### Pitfall 6: Conflating "output" with "Run control window" when reading the older v2.15 research
**What goes wrong:** REQUIREMENTS.md's own R438/R439 prose, STATE.md's milestone framing, and the
pre-2026-09-13 ARCHITECTURE.md/PITFALLS.md documents all describe an "Audience-output-only" audio model
with a cross-window unlock handshake. A planner reading only those documents (and not CONTEXT.md, which is
dated the same day and is explicitly an override) would build the wrong architecture.
**Why it happens:** CONTEXT.md's override was captured today (2026-09-13) via `/gsd-discuss-phase`, after
REQUIREMENTS.md and the research docs were written; those documents were never retroactively edited.
**How to avoid:** Treat CONTEXT.md's "Owner decision (2026-09-13, overrides the R438/R439 wording...)" as
the authoritative source for R438/R439's actual behavior. This RESEARCH.md's Standard Stack "Alternatives
Considered" table and the Architecture Patterns' "Anti-Patterns to Avoid" section both restate this
explicitly so it survives into planning even if CONTEXT.md is skimmed.
**Warning signs:** any task or verification step mentioning "Audience output plays audio," "Confidence/Video
muted," or a `postMessage`/`BroadcastChannel` audio-unlock message is building the superseded design.

## Code Examples

### `AudioPlayer.vue`'s existing autoplay-block/error contract (reused verbatim, not modified)
```typescript
// Source: src/components/AudioPlayer.vue:79-102 — already shipped, this phase only listens to it
async function play(): Promise<void> {
  const el = audioEl.value
  if (!el) return
  try {
    await el.play()
    showPlayAffordance.value = false
    emit('play')
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      emit('autoplay-blocked')
      showPlayAffordance.value = true
      return
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return // pause-interrupted-play, not a real failure — ADR-0061
    }
    throw err
  }
}
```

### `resyncRehearseAccessForSong`'s cross-collection scan shape (the R440 precedent)
```typescript
// Source: src/stores/services.ts:791-808 — the scan pattern to narrow for R440's vamp-assignment count.
// Narrow to: scan slideGroups (not services directly) for entries whose vampId matches, collect distinct
// serviceIds, then getDoc each service and keep where service.date >= todayYmd().
async function countAssignments(vampId: string): Promise<number | null> {
  const org = orgId.value
  if (!org) return null
  try {
    const groupsSnap = await getDocs(collection(db, 'organizations', org, 'slideGroups'))
    const serviceIds = new Set<string>()
    for (const d of groupsSnap.docs) {
      const data = d.data() as SlideGroup
      if (data.slides.some((e) => e.vampId === vampId)) serviceIds.add(data.serviceId)
    }
    if (serviceIds.size === 0) return 0
    const today = todayYmd()
    const results = await Promise.all(
      [...serviceIds].map((sid) => getDoc(doc(db, 'organizations', org, 'services', sid))),
    )
    return results.filter((s) => s.exists() && (s.data() as Service).date >= today).length
  } catch (err) {
    console.error('countAssignments: scan failed:', err)
    return null // caller renders the generic "may be assigned to slides" fallback
  }
}
```
Note: `countAssignments` returning `0` (found assignments, but none upcoming) is a DIFFERENT case from
`deleteVamp`'s Storage-keep decision, which per CONTEXT.md triggers on "**any** assignment (any service,
not only upcoming)" — the delete function must run its own any-assignment check (not reuse the
upcoming-only count), or `countAssignments` must be split into "has any assignment" (boolean, all
services) vs. "upcoming count" (the number shown in the UI). Flag this as a task-boundary decision for the
planner (see Open Questions).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| "Vamp audible from Audience output only, Confidence/Video muted" + cross-window autoplay-unlock handshake (REQUIREMENTS.md R438/R439 prose, ARCHITECTURE.md/PITFALLS.md) | "Vamp audible from the Run control window ONLY; all three outputs silent" (CONTEXT.md) | 2026-09-13, owner decision during `/gsd-discuss-phase` for this phase | Eliminates the cross-window audio-unlock handshake and the triple-play-echo pitfall by construction; simplifies both the implementation and its test surface to a single document. |

**Deprecated/outdated:** the "Audience-output audio owner" framing throughout REQUIREMENTS.md's R438/R439
text, ARCHITECTURE.md's Vamps data-flow diagram (`Data Flow → Vamps: assignment → playback`, which still
shows `AudioPlayer.vue → Audience/Confidence/Video outputs render identically`), and PITFALLS.md's
Pitfall 1/2 mitigation sections — all superseded by CONTEXT.md for this phase specifically. Do not "fix"
this RESEARCH.md's Architecture Patterns to match those older documents; they are the ones now stale.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vampLabel` format is `${vamp.name} · ${vamp.key}` (middle-dot separator) | Pattern 1 code example | Cosmetic only — CONTEXT.md gives this exact example ("Open Response · G") but does not formally pin the separator character/spacing as a contract; UI-SPEC's copy table repeats the same example, so this is LOW risk, effectively CITED by two independent locked docs rather than truly assumed. |
| A2 | `countAssignments`'s "upcoming" count and `deleteVamp`'s "any assignment" Storage-keep check are two separate queries/branches, not one shared boolean | Code Examples note | If the planner instead reuses one boolean for both, an editor could see "not assigned in any upcoming service" (0 shown) yet have the MP3 silently kept anyway (or vice versa) because the vamp is assigned to a PAST service only — a confusing but non-destructive mismatch between displayed count and actual Storage-cascade behavior. |
| A3 | `RunPreviewPair.vue`'s embedded, ref-less `SlideCanvas`/`AudioPlayer` is genuinely never played anywhere in the current codebase (verified by absence of a `ref` binding and absence of any `.play()` call in that file) | Pitfall 5 | If some other, unread code path does hold a ref into that instance and calls `.play()`, suppressing/leaving it unsuppressed could matter for echo; a targeted `grep -n "RunPreviewPair"` across the codebase during planning would confirm this is the only consumer. |

## Open Questions

1. **Should `countAssignments` return a single boolean-plus-count, or does `deleteVamp` need its own
   independent "any assignment, any service" query separate from the upcoming-only display count?**
   - What we know: CONTEXT.md's two paragraphs use different scopes — the displayed warning count is
     "upcoming service(s)" (`date >= today`), while the Storage-keep decision triggers on "any service, not
     only upcoming."
   - What's unclear: whether one `getDocs` scan (over ALL slideGroups regardless of parent service date)
     can cheaply serve both — computing the upcoming subset AND the any-assignment boolean from the same
     result set — or whether two separate calls are clearer to test independently.
   - Recommendation: one scan, two derived values (the code example above naturally supports this — the
     `serviceIds` set is "any assignment," and the date-filtered count is the upcoming subset) — this is a
     planning-time implementation-shape choice, not a product ambiguity, and should not block planning.

2. **Should `RunPreviewPair.vue`'s inert `SlideCanvas` instances also receive `:suppress-audio="true"`?**
   - What we know: they never play today and remain harmless after this phase (Pitfall 5, Assumption A3).
   - What's unclear: whether the plan-checker or a future refactor might one day wire a `ref`/`.play()`
     there, at which point an unsuppressed instance would become a real echo risk.
   - Recommendation: include it as a one-line, low-risk hardening task in the same plan that adds
     `suppressAudio` to `SlideCanvas.vue`, purely for defense-in-depth — not required for R438's must-haves,
     but essentially free once the prop exists.

## Environment Availability

Not applicable — this phase adds no new external tool/service/runtime dependency. Firebase
(Firestore/Storage), the Vue/Vite/Vitest toolchain, and the browser's native `<audio>` element are all
already in use by the shipped codebase and require no new setup.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-pinned; see `render-service/package.json` for the unrelated standalone pin — root app suite uses the root `vitest` install) |
| Config file | `vite.config.ts` (root) — excludes `src/rules.test.ts` and `render-service/**` |
| Quick run command | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts src/components/__tests__/VampPicker.test.ts src/stores/__tests__/vamps.test.ts src/components/__tests__/VampSlideOver.test.ts src/components/slides/__tests__/SlideCanvas.test.ts src/views/__tests__/RunControlView.test.ts` (per-task scoped subset; adjust filenames to whichever this task actually touches) |
| Full suite command | `npx vitest run` (per CLAUDE.md: excludes `src/rules.test.ts` and `render-service/**`; documented baseline is exactly one failing file, `src/storage.rules.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R437 | Assign a vamp writes `audioUrl`/`audioLoop:true`/`vampId`/`vampLabel` in one `replaceGroupSlides` call | unit | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts -t "vamp"` | ✅ EditSlideDrawer.test.ts exists — Wave 0 adds new `describe('vamp assignment')` cases |
| R437 | Change re-opens the picker with the current selection highlighted; Clear removes all four fields (no `undefined` written) | unit | `npx vitest run src/components/__tests__/VampPicker.test.ts` | ❌ Wave 0 — new file, mirrors `VampTable.test.ts`'s row/selection assertions |
| R438 | `suppressAudio` prevents `AudioPlayer` from mounting on `SlideCanvas` | unit | `npx vitest run src/components/slides/__tests__/SlideCanvas.test.ts -t "suppressAudio"` | ✅ File exists with a sibling `suppressBackground` describe block (`SlideCanvas.test.ts:339`) to mirror — Wave 0 adds the new describe block |
| R438 | All 3 output views pass `suppress-audio="true"` to every `SlideCanvas`/`FullscreenSlideOutput` mount | unit | `npx vitest run src/views/__tests__/AudienceOutputView.test.ts src/views/__tests__/ConfidenceOutputView.test.ts src/views/__tests__/VideoOutputView.test.ts` | ✅ All 3 files exist — Wave 0 adds assertions that the mounted `SlideCanvas` stub receives `suppressAudio: true` |
| R438 | `RunControlView`'s `AudioPlayer` plays on a slide-with-audio going live, loops per `audioLoop`, pauses on slide change/blackout/exit | unit | `npx vitest run src/views/__tests__/RunControlView.test.ts -t "audio"` | ✅ File exists (plus `RunControlView.loop.test.ts`/`RunControlView.output.test.ts` siblings to mirror for file-splitting style) — Wave 0 adds new cases, likely as a new `RunControlView.audio.test.ts` sibling file matching the existing `.loop.`/`.output.` naming convention |
| R439 | Arm toggle primes/starts audio; `autoplay-blocked` shows the banner with a working retry; media `error` shows "Audio unavailable"; state resets on exit/re-entry | unit | `npx vitest run src/views/__tests__/RunControlView.audio.test.ts` (new file) | ❌ Wave 0 |
| R440 | `deleteVamp` keeps the Storage MP3 when any assignment exists, deletes both when none exist | unit | `npx vitest run src/stores/__tests__/vamps.test.ts -t "delete"` | ✅ File exists — Wave 0 extends it |
| R440 | `VampSlideOver` delete-confirm shows the correct singular/plural/scan-failed warning line | unit | `npx vitest run src/components/__tests__/VampSlideOver.test.ts -t "delete"` | ✅ File exists — Wave 0 extends it |
| R438/R439 | Real-speaker audibility, real Chrome autoplay-policy behavior on a fresh profile, and genuine single-machine multi-monitor "no echo" confirmation | manual-only | n/a — jsdom mocks `HTMLMediaElement.play()` and cannot exercise Chrome's Media Engagement Index heuristic (PITFALLS.md, still valid despite the architecture change) | manual — batch into `.planning/v2.15-DEFERRED-VERIFICATION.md` per the milestone's established owner UAT-deferral policy |

### Sampling Rate
- **Per task commit:** the scoped Quick run command above, narrowed to the files that task's plan touches.
- **Per wave merge:** `npx vitest run` (full app suite) plus `npm run type-check` (must use the `vue-tsc
  --build` form per CLAUDE.md — the narrower `-p tsconfig.app.json` form has previously let real errors
  through for two full phases and must not be used as the gate).
- **Phase gate:** full suite green (documented baseline: exactly one failing file,
  `src/storage.rules.test.ts`) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/components/__tests__/VampPicker.test.ts` — new file, covers R437's picker rendering/selection/empty-states (mirror `VampTable.test.ts`'s structure).
- [ ] `src/views/__tests__/RunControlView.audio.test.ts` — new file, covers R438's playback binding + R439's arm/blocked/unavailable states (mirror the existing `RunControlView.loop.test.ts`/`RunControlView.output.test.ts` per-concern file-splitting convention rather than growing the base `RunControlView.test.ts` file further).
- [ ] Framework install: none — Vitest is already configured; no new test-framework setup needed.

*(No gaps for R437's EditSlideDrawer/type coverage, R438's SlideCanvas/output-view coverage, or R440's
vamps/VampSlideOver coverage — all extend already-existing, passing test files.)*

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` (not present at all in this
repo's config — treated as enabled per the default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unrelated — this phase adds no auth surface. |
| V3 Session Management | no | Unrelated. |
| V4 Access Control | yes | `firestore.rules`'s existing generic catch-all (`{collection}/{docId}` → `isOrgEditor(orgId)`) already gates the `vamps` collection and the `slideGroups`-specific block already gates writes to `isOrgEditor(orgId)` — no new rule needed for R437/R440's writes. The R440 `getDocs` scan is a **read**, already permitted by `slideGroups`'s `allow read: if isOrgMember(orgId)` (`firestore.rules:453`) and `services`'s `allow read: if isOrgMember(orgId)` (`firestore.rules:206`) — confirmed no rules change required. |
| V5 Input Validation | yes | The picker only ever writes a vamp's own `downloadUrl`/`id`/derived label — no free-text user input is written by this phase's new code paths (the vamp's `name`/`key`/`tempo` were already validated in Phase 140). |
| V6 Cryptography | no | Unrelated. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| An editor for Org A crafts a `vampId` belonging to Org B and assigns it to a slide, exfiltrating a cross-org `downloadUrl` into their own service | Information Disclosure | Not newly introduced by this phase — the picker only ever lists vamps from `useVampStore().vamps`, which is scoped by the store's own org-scoped `subscribe(orgId)` query (`vamps.ts:35-38`); a client attempting to fabricate a foreign `vampId` in the write would produce a `GroupSlideEntry.vampId` pointing at a doc it cannot read (denied by the existing `vamps` editor+org rule), but the **`audioUrl`/`downloadUrl` string itself is not access-controlled by Firestore rules at all** — Firebase Storage download URLs are unauthenticated-bearer-token URLs by design (this is pre-existing behavior for every song/background/vamp attachment in this codebase, not a new gap introduced by this phase; out of scope to fix here). |
| A viewer's browser attempts to subscribe to `organizations/{orgId}/vamps` and is denied | Denial of Service (self, cosmetic) | See Pitfall 2 — scope `vampStore.subscribe(orgId)` inside the `isEditor` gate so viewers never attempt a call they cannot complete; a permission-denied `onSnapshot` error is logged but does not crash the view (matches the existing `isPermissionDenied` handling pattern used elsewhere in `useSlideshowAssembly.ts`). |
| The R440 delete-confirm's affected-service count is spoofable/racy (an editor deletes a vamp between the scan completing and the confirm click) | Tampering (low severity) | Explicitly accepted by CONTEXT.md — "best-effort," "never blocks the deletion," and the fallback generic warning on scan failure. No mitigation needed beyond what's already specified. |

## Sources

### Primary (HIGH confidence — real files read this session)
- `src/components/slides/EditSlideDrawer.vue` — audio section, `attachSlideAudio`/`removeSlideAudio`/
  `onLoopToggle`, fresh-base write pattern, `canMutate` gating.
- `src/types/slideGroup.ts` — `GroupSlideEntry` shape and comment conventions for additive optional fields.
- `src/components/AudioPlayer.vue` — `play()`/`pause()`, `autoplay-blocked`/`error` emits, `chromeless` prop.
- `src/components/slides/SlideCanvas.vue` — `suppressBackground` mechanism, `currentAudioUrl`, media
  play/pause/reset lifecycle, `defineExpose({ play, pause })`.
- `src/utils/slideshowAssembler.ts` — `resolveEntryMedia`, `AssembledSlide` shape (`groupId`/`groupSlideId`).
- `src/views/AudienceOutputView.vue`, `ConfidenceOutputView.vue`, `VideoOutputView.vue`,
  `src/components/output/FullscreenSlideOutput.vue` — all `SlideCanvas` mount sites for the output tier.
- `src/views/RunControlView.vue`, `src/composables/useRunControl.ts`, `src/components/run/RunHeader.vue`,
  `src/components/run/RunPreviewPair.vue` — control-surface state machine (`live`/`blackout`/`current`/`next`),
  `endServiceTeardown`/`endRehearsal`, existing `cancelBtnRef` template-ref-from-composable pattern.
- `src/stores/vamps.ts`, `src/components/VampSlideOver.vue` — `deleteVamp`/`setAttachment`, delete-confirm UI.
- `src/stores/slideGroups.ts` — `replaceGroupSlides`, `groupsBySlotId`, `stripUndefined` usage.
- `src/utils/stripUndefined.ts` — confirmed recursive deep-strip behavior.
- `src/stores/services.ts` — `resyncRehearseAccessForSong` (R440's scan precedent).
- `src/utils/myScheduleGrouping.ts` — `todayYmd()` (R440's date-comparison precedent).
- `src/views/ServiceEditorView.vue` — `initStores()`, the missing `vampStore.subscribe` integration point.
- `src/stores/orgScopedStores.ts` — confirms `vamps` teardown is already registered (Phase 140), subscribe is
  not.
- `firestore.rules` — `services`/`slideGroups`/generic-catch-all read/write gates.
- `.planning/phases/140-vamps-library-crud-storage/140-0{1,2,3}-SUMMARY.md` — what Phase 140 actually shipped
  (`Vamp` type, `useVampStore`, `VampTable.vue`/`VampSlideOver.vue`, `storage.rules` `vamp-files/` block).

### Secondary (MEDIUM confidence — prior-session research, partially superseded)
- `.planning/research/ARCHITECTURE.md` — Pattern 2 (denormalize-at-assignment) still valid and reused
  verbatim; the "Vamps: assignment → playback" data-flow diagram is STALE for the audio-owner tier (see
  State of the Art).
- `.planning/research/PITFALLS.md` — Pitfall 1 (silent autoplay failure) and Pitfall 3 (stale denormalized
  URL) are still valid concerns this phase addresses; Pitfall 2's specific cross-window mitigation is
  superseded (the underlying "no echo" goal is still achieved, just by a simpler mechanism).

### Tertiary (LOW confidence — none used)
- none.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every primitive already shipped and read directly this session.
- Architecture: HIGH — every integration point cites a specific file and line range read this session; the
  two non-obvious findings (vamp store subscription gap, badge-resolution-off-pipeline) were independently
  verified via grep across the actual codebase, not inferred.
- Pitfalls: HIGH — six pitfalls, five derived from direct code inspection (not speculative), one (Pitfall 6)
  derived from a direct textual conflict between two dated project documents.

**Research date:** 2026-09-13
**Valid until:** 30 days (stable internal codebase, no third-party API surface) — but re-verify immediately
if CONTEXT.md's 2026-09-13 override is itself revisited, since large portions of this document's
Architecture Patterns section depend on it.
