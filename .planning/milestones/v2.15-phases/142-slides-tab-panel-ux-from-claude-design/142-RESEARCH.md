# Phase 142: Slides Tab panel UX from Claude Design - Research

**Researched:** 2026-09-19
**Domain:** Vue 3 SFC refactor of an existing Firestore-backed panel (chip/popover UI rework, no new libraries)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Layout variant & panel structure**
- Implement mockup variant **7a** — three chips (Display · Background · Audio), each opening its own small popover anchored below the chip; only one popover open at a time; click-outside / Esc closes.
- The other controls that live in the same panel today — `SlotLoopControl` (MISC/ANNOUNCEMENTS), the Congregational-reading button (Scripture), and Remove-imported-entries — stay as secondary buttons **after the three chips on the same row**. They are per-kind actions, not group settings; the chips always lead. Their existing gates and testids are preserved.
- Locked service / non-editor: chips are **visible but inert** — they state the current setup, drop the ▾ caret, and open no popover (matches `SlotVideoOutputControl`'s visible-but-inert rule; replaces today's hide-when-locked behavior for music/background).
- Visual tokens: map the mockup's hex palette onto the app's existing Tailwind tokens (gray-900/800/700 surfaces, indigo accents, amber for the no-MP3 warning) — same transcription approach Phases 137/141 used for this design file. Do not port the mockup's hex values verbatim.

**Audio slot (Track ⟂ Vamp)**
- Audio is **one slot** with a None / Track / Vamp segmented control at the top of the popover. Choosing Vamp clears an uploaded track; uploading a Track clears the vamp; None clears both. This matches today's data (`bedAudioUrl` + optional `bedVampId`/`bedVampLabel`) — no schema change, but the write path must clear the other half explicitly (`clearAudio` flag semantics, not undefined).
- A vamp **with no MP3 may be assigned**: store `bedVampId` + `bedVampLabel` with no `bedAudioUrl`. The chip reads amber "♪ Vamp C · no MP3"; the popover's Vamp state shows "⚠ No MP3 attached yet — band plays it live." Live playback silently skips a bed with no URL. Today's `onAttachGroupVamp` early-return on a missing `downloadUrl` is removed for this path.
- Vamp picking happens **inline in the popover** (search box + list, per 7a) by reusing `VampPicker` in fill mode. This replaces the `VampPickerSlideOver` for the *group* strip only; the per-slide drawer keeps its slide-over.
- Track state row: filename · duration when known · ▶ preview (chromeless `AudioPlayer`, same accessible name as today) · **Replace** (file input) · Remove.

**Background & Display chips**
- Background popover: **None · recent-in-this-service thumbnails · ＋ upload**. ＋ is also a drop target for an image file. "Recents" = the distinct background URLs already set on other groups (and songs) in this service, most-recent-first, capped to a handful; the currently-set one is highlighted.
- Group whose background is **inherited from the song**: chip reads "Background · *file* (song)" with a solid outline; the popover explains the background is managed on the song and offers no override — preserves the existing owner rule (no group-level override of a song background).
- Display popover: Full-screen / Banner **thumbnail tiles** + hint copy — "Lower third over the live camera feed. Video output only." for Banner, "Fills the screen on every output." for Full-screen. Same `videoOutput.mode` write as today.
- Chip states: Display always shows a value (Full-screen is the default); unset Background/Audio read **"Add"** on a dashed outline so unset is visibly different from set. The row ends (right-aligned, muted) with "applies to all N slides in this group, unless a slide sets its own".

### Claude's Discretion
- Exact popover widths/offsets (mockup: 232px, audio 258px), focus management, and whether the popover is a Teleport or inline-absolute — pick whatever avoids clipping inside the scrolling grid.
- How "recents" are gathered (from the already-loaded slide groups for the service vs. a small computed in `SlidesTab`).
- Whether the three chips become one new component (`SlideGroupSetupStrip.vue`) wrapping the existing controls' logic, or the existing controls are restyled in place — preserve existing emit contracts and testids where tests depend on them.

### Deferred Ideas (OUT OF SCOPE)
- 7b / 6b (summary line + inline strip or setup sheet with live preview) — not chosen; revisit only if 7a's popovers prove cramped on small screens.
- Per-slide overrides UI in the drawer are untouched; a future pass could give the drawer the same chip vocabulary.

**Note:** `142-UI-SPEC.md` (APPROVED 6/6) has since resolved every "Claude's Discretion" item above —
component split (`SlideGroupSetupStrip.vue`, new), no Teleport (plain absolute, viewport-edge-flip
computed on open), and recents gathered in `SlidesTab.vue` from already-loaded props (Finding 6 below
confirms this is achievable without a new Firestore read, with one caveat). Treat the UI-SPEC's
resolutions as locked, not as alternatives to re-evaluate.
</user_constraints>

## Summary

This phase reworks an *already-shipped* production surface (`SlideGrid.vue`'s group-media panel) into
the three-chip/popover layout the owner approved in `142-UI-SPEC.md` (variant 7a). There is no new
technology here — no package to add, no new pattern to import — the work is: (1) a new wrapper component
(`SlideGroupSetupStrip.vue`) that composes the three existing controls behind chip/popover styling, (2) a
`variant` prop split on `BackgroundControl.vue` so its second call site (`SongLyricEditor.vue`, song-level
background) stays byte-for-byte unchanged, (3) a genuine, previously-undiscovered write-path bug fix in
`slideGroups.ts::setGroupBedMedia` that silently drops a no-MP3 vamp assignment today, and (4) a
substantial test-migration bill: `SlideGrid.test.ts` alone carries 42 references to the testids this
phase retires or relocates, across roughly 650 lines (three `describe` blocks: group music bar, group
vamp wiring, group background control, plus two "group media panel" gate-regression blocks).

Every claim about existing behavior below was verified against the live source in this session (file
paths, line-anchored) — nothing here is guessed. The one real code gap not previously flagged anywhere:
`SlideGroupMusicControl.vue`'s template is gated `v-if="audioUrl"` / `v-else-if="isEditor"` — with
`bedVampId` set and `bedAudioUrl` absent (the no-MP3-vamp case this phase must support), the component
renders as if nothing were assigned at all. This confirms the UI-SPEC's decision to rework the whole
component (segmented tabs driven by an `audioTab` derivation, not the old `v-if="audioUrl"` gate) is not
optional cleanup — it is required to make the no-MP3 case renderable at all.

**Primary recommendation:** build `SlideGroupSetupStrip.vue` as a thin composing wrapper (chips +
popover shell + `openChip` state) around the three existing controls, restyled/extended in place exactly
as `142-UI-SPEC.md`'s Component Specifications direct; fix `setGroupBedMedia`'s missing third patch
branch first (it is the one true logic bug, independent of any styling work, and every other change is
additive on top of a correct write path); budget one full pass through `SlideGrid.test.ts`'s five
group-media `describe` blocks as its own task, not a byproduct of the component work.

## Architectural Responsibility Map

This is a Firebase-client SPA (Vue 3 + Pinia + Firestore SDK) with no server-rendering tier and no
Cloud Function in this phase's write path — writes go directly from the browser through the Firestore
JS SDK, gated by `firestore.rules`, not through a backend API layer.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chip row / popover open-close / focus / Esc / click-outside | Browser / Client | — | Pure local UI state (`openChip` ref), no persistence |
| Display (Full-screen/Banner) write | Browser / Client → Database | — | `SlideGrid.vue`'s existing `@change` emit → `ServiceEditorView.vue` persists onto `slot.videoOutput` (unchanged by this phase) |
| Audio slot write (Track/Vamp/None) | Browser / Client → Database | — | `slideGroups.ts::setGroupBedMedia` writes Firestore directly via the client SDK; `firestore.rules`' `slideGroups` match block is the only backend enforcement |
| Background write (upload/select/clear) | Browser / Client → Database + Storage | — | `useBackgroundUpload` writes to Cloud Storage (`orgs/{orgId}/backgrounds/...`), then `slideGroups.ts::setGroupBackground` writes the resulting URL to Firestore |
| "Recent backgrounds in this service" | Browser / Client (derived) | — | Computed client-side from already-subscribed `groupsBySlotId` + `assembledSlideshow` props — no new Storage/Firestore read (verified, see Finding 6) |
| Live playback tolerance of `bedVampId` with no `bedAudioUrl` | Browser / Client (Run outputs) | — | `slideshowAssembler.ts` + `useRunControl.ts` — already correctly tolerant, verified, no change needed (Finding 3) |

<phase_requirements>
## Phase Requirements

No requirement IDs are mapped to Phase 142 yet — `.planning/ROADMAP.md`'s Phase 142 entry reads
`**Requirements**: TBD` and `.planning/REQUIREMENTS.md` is scoped to the v2.15 milestone (R428–R440,
all already shipped/traced to Phases 138–141); it defines no Phase 142 requirement block. This phase's
requirement surface is instead fully specified by `142-CONTEXT.md` (locked decisions) and
`142-UI-SPEC.md` (approved component/copy/testid/accessibility contract) — the planner should treat those
two documents as the requirement source of truth for this phase, or ask the owner whether to run a
requirements pass to assign R-IDs before planning. This research maps each CONTEXT.md decision area to
its code-level support below instead of to R-IDs.

| Decision area (CONTEXT.md) | Research Support |
|----|-------------|
| 7a chip/popover layout, locked-service inert chips | Verified current `SlideGrid.vue` panel structure, gates (`canWriteGroupMedia`, `showVideoOutputControl`), and `SlotVideoOutputControl.vue`'s existing `:disabled` (not span) locked treatment — see Findings 1, 2 |
| Audio slot: None/Track/Vamp, no-MP3 vamp assignable | Verified `setGroupBedMedia`'s missing patch branch (the actual bug) and `SlideGroupMusicControl.vue`'s `v-if="audioUrl"` gate gap — see Findings 4, 5 |
| Background: recents from other groups/songs in-service, no new read | Verified `SlidesTab.vue`'s existing props (`groupsBySlotId`, `assembledSlideshow`) are sufficient, and identified the one real gap (no `updatedAt` for song-sourced entries) — see Finding 6 |
| Popover pattern (Teleport vs absolute, click-outside, Esc) | Verified `SlideActionMenu.vue`'s existing overlay+Escape pattern and `VampPickerSlideOver.vue`'s window-keydown pattern as the two closest precedents; confirmed no existing `useClickOutside` composable — see Finding 7 |
| Testid contract preserved/retired | Enumerated the exact `describe` blocks and line ranges in `SlideGrid.test.ts` that assert on retired testids — see Finding 8 |
</phase_requirements>

## Standard Stack

No new dependencies. This phase is 100% additive/refactor work inside the existing stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | 3.5.43 [VERIFIED: package.json] | SFC framework | already the app's framework |
| vue-tsc | 3.3.11 [VERIFIED: package.json] | type-check gate (`npm run type-check`) | project-mandated gate, see CLAUDE.md |
| vitest | ^3.5.29 (app) / 4.1.10 (render-service, out of scope) [VERIFIED: package.json] | test runner | existing convention |
| firebase (firestore/storage client SDK) | already in use | writes for bed audio / background | unchanged write surface, same store functions |

### Supporting
No supporting libraries are newly introduced. `VampPicker.vue` gains one new boolean prop
(`allowUnattached`); no new component library, icon set, or positioning library (no floating-ui, no
Radix/Headless UI) — the app's Design System table in `142-UI-SPEC.md` explicitly records
"Component library | none (custom SFCs; no Radix/base-ui/headless-ui)".

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `position:absolute` popover + manual click-outside listener | `@floating-ui/vue` or Headless UI `Popover` | UI-SPEC already locked the hand-rolled approach ("no Teleport... plain `position:absolute`... computed at open time, not CSS-only"), consistent with the app's zero-component-library convention; introducing a library here would contradict `142-UI-SPEC.md`'s Design System contract and Registry Safety table (both say "none") |

**Installation:** none required.

**Version verification:** `npm view` was not run against a fresh registry since no new packages are
proposed; versions above are read directly from `package.json` (authoritative for this repo).

## Package Legitimacy Audit

**Not applicable — this phase installs no new external packages.** `VampPicker.vue`'s new
`allowUnattached` prop, `BackgroundControl.vue`'s new `variant` prop, and `SlideGroupSetupStrip.vue`
(new component) are all first-party code inside `src/components/`. No `package.json` change is
required or expected for this phase.

## Architecture Patterns

### System Architecture Diagram

```
SlidesTab.vue (props: groupsBySlotId, assembledSlideshow, orgId, serviceId, isEditor, serviceLocked)
   │
   ├─ derives `recentBackgrounds` (new, client-side, no new read — Finding 6)
   │      groupsBySlotId.values() → group.backgroundImageUrl + group.updatedAt
   │      assembledSlideshow.filter(backgroundSource === 'song') → song-inherited URLs (no updatedAt — gap)
   │      dedupe by URL, cap to 4, pass down as `recent-backgrounds` prop
   │
   ▼
SlideGrid.vue (selectedSlot, group, canWriteGroupMedia, showVideoOutputControl, ...)
   │  panel gate simplifies: v-if="Boolean(selectedSlot)" (was a 6-condition OR)
   │  write handlers UNCHANGED: onAttachGroupMusic / onRemoveGroupMusic / onAttachGroupVamp /
   │  onAttachGroupBackground / onRemoveGroupBackground / inline video-output @change
   │
   ▼
SlideGroupSetupStrip.vue (NEW — composes the 3 chips + popovers, owns `openChip` ref)
   │
   ├─ Display chip → popover → SlotVideoOutputControl.vue (restyled in place; script unchanged)
   │      emit('change', {mode}) ──────────────► SlideGrid's existing inline handler
   │
   ├─ Background chip → popover → BackgroundControl.vue variant="chip-popover" (NEW branch,
   │      additive; variant="panel"/default stays byte-identical for SongLyricEditor.vue)
   │      emit('attach', url) / emit('remove') ──► onAttachGroupBackground / onRemoveGroupBackground
   │
   └─ Audio chip → popover → SlideGroupMusicControl.vue (restyled in place: segmented
          None/Track/Vamp tabs replace old v-if="audioUrl" gate)
          ├─ Track tab: <input type=file> → useMediaUpload → emit('attach', url)
          ├─ Vamp tab: VampPicker fill allowUnattached → emit('attach-vamp', vamp)
          └─ None tab: emit('remove')
                 ▼
          slideGroups.ts::setGroupBedMedia (FIX REQUIRED — Finding 4)
                 ▼
          Firestore organizations/{orgId}/slideGroups/{slotId}
                 ▼
          slideshowAssembler.ts / useRunControl.ts (Run the Service outputs)
                 — already tolerant of bedVampId with no bedAudioUrl (Finding 3, no change needed)
```

### Recommended Project Structure

No new directories. New file:
```
src/components/slides/
├── SlideGroupSetupStrip.vue   # NEW — chip row + popover shell, composes the 3 controls
├── SlideGrid.vue              # MODIFIED — panel gate simplified, mounts the strip instead of 3 controls
├── SlideGroupMusicControl.vue # MODIFIED — restyled in place, new audioTab derivation
├── BackgroundControl.vue      # MODIFIED — new `variant="chip-popover"` branch, additive
├── SlotVideoOutputControl.vue # MODIFIED — restyled in place, script largely unchanged
└── SlotLoopControl.vue        # UNCHANGED (trailing slot, per CONTEXT.md)
```

### Pattern 1: Emit-only child controls, single write owner
**What:** Every group-media control (`SlideGroupMusicControl`, `BackgroundControl`,
`SlotVideoOutputControl`) is emit-only. `SlideGrid.vue` is the sole owner of the Firestore write calls
(`onAttachGroupMusic`, `onRemoveGroupMusic`, `onAttachGroupVamp`, `onAttachGroupBackground`,
`onRemoveGroupBackground`), established in 25-06/33-08/260918-nm2.
**When to use:** `142-UI-SPEC.md` Component Spec §7 confirms this pattern is preserved — the new
`SlideGroupSetupStrip.vue` must bubble six passthrough emits (`attach-music`, `remove-music`,
`attach-vamp`, `attach-background`, `remove-background`, `video-output-change`) up to `SlideGrid.vue`
rather than writing to the store itself.
**Example (existing, unchanged):**
```typescript
// Source: src/components/slides/SlideGrid.vue:681-693
async function onAttachGroupMusic(url: string): Promise<void> {
  if (!canWriteGroupMedia.value) return
  if (!props.selectedSlot) return
  try {
    await slideGroupsStore.setGroupBedMedia(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      bedAudioUrl: url,
    })
  } catch (err) {
    console.error('Failed to attach group music:', err)
  }
}
```

### Pattern 2: Explicit clear flags, never `undefined`-means-clear
**What:** `clearAudio` / `clearBackground` boolean flags are used for removal, because
`stripUndefined()` (the app's shared payload-sanitizer) would otherwise strip an `undefined` URL before
it reaches Firestore, and `deleteField()` is the only way to actually remove a field.
**When to use:** Any new "clear" affordance this phase adds (e.g. the Audio popover's `None` tab) must
call the existing `onRemoveGroupMusic`/`onRemoveGroupBackground` handlers (which already set
`clearAudio: true` / `clearBackground: true`) rather than emitting an empty-string URL.
**Example:**
```typescript
// Source: src/stores/slideGroups.ts:143-149
if (patch.clearAudio) {
  update.bedAudioUrl = deleteField()
  update.bedVampId = deleteField()
  update.bedVampLabel = deleteField()
} else if (patch.bedAudioUrl !== undefined) {
  // ... only branch that currently writes bedVampId/bedVampLabel — see Finding 4
}
```

### Anti-Patterns to Avoid
- **Re-deciding UI-SPEC-locked decisions:** `142-UI-SPEC.md` is APPROVED with a full Component
  Specification, Copywriting Contract, Testid Contract, and Accessibility Contract. This research
  supplies code-grounded facts to plan against it, not alternatives to it. Do not replan the popover
  positioning strategy, chip colors, or copy — those are locked.
- **Treating `patch.bedAudioUrl !== undefined` as sufficient to detect "a vamp was chosen":** it is not
  — a no-MP3 vamp selection has `bedAudioUrl: undefined` by construction (Finding 4). A patch-shape
  check on `bedVampId` presence, not `bedAudioUrl` presence, is required for the new branch.
- **Adding a document-level `mousedown`/`click` global listener without a matching `removeEventListener`
  on every exit path (Esc, outside-click, unmount, AND switching `selectedSlot`):** `SlideGrid.vue`
  already resets `openMenuEntryId` on `watch(() => props.selectedSlot?.id, ...)` — the new `openChip`
  ref in `SlideGroupSetupStrip.vue` needs the identical watcher, or a listener leaks / a stale popover
  stays "open" after switching groups.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover positioning / click-outside / focus return | A new generic composable, or a floating-ui/Headless-UI dependency | The `SlideActionMenu.vue` `fixed inset-0 @click=close` overlay pattern OR the `VampPickerSlideOver.vue` `watch(open) → addEventListener('keydown')` pattern — both already exist in this exact directory | UI-SPEC's Accessibility Contract already specifies a document-level `pointerdown` listener scoped to "a popover is open" (mirroring `VampPickerSlideOver.vue`'s lifecycle discipline) — reuse that lifecycle shape, don't invent a third one. `SlideActionMenu.vue`'s simpler `fixed inset-0` overlay-div click-outside is a legitimate lighter-weight alternative already proven in the same directory if the planner wants to avoid a document listener; either is "not hand-rolling from scratch," both are already-proven local precedent |
| Vamp search/filter/list rendering | A new list component | `VampPicker.vue` in `fill` mode (already built for 260918-pms) | Already handles loading/empty/no-match/disabled-row states; only needs one new prop (`allowUnattached`) |
| File upload progress/error/validation | New upload logic per popover | `useMediaUpload` (audio) / `useBackgroundUpload` (background) | Both already validate type + size, expose `progress`/`error`/`isUploading` refs, and are fully decoupled from the Firestore write (a failed upload can never corrupt slide/group data) — reuse verbatim, do not duplicate validation |
| Drag-and-drop file drop on the Background "＋" tile | New drop-zone library | Native `@dragover.prevent` / `@drop.prevent` + `event.dataTransfer.files[0]` passed straight into the existing `uploadBackground(file, orgId)` | `useBackgroundUpload.uploadBackground` takes a plain `File` regardless of source (input-change or drop) — no composable change needed, only a new template drop handler |

**Key insight:** every "hard part" of this phase (upload, vamp search, group-write plumbing, popover
open/close bookkeeping precedent) already has a working implementation somewhere in
`src/components/slides/` or `src/composables/`. The actual net-new logic is small: the `SlideGroupSetupStrip.vue`
shell, one Firestore patch-branch fix, one new prop each on two existing components, and a `variant`
branch on a third.

## Common Pitfalls

### Pitfall 1: The `setGroupBedMedia` no-MP3-vamp silent drop (the one real bug)
**What goes wrong:** Assigning a vamp with no MP3 attachment writes nothing to Firestore at all —
neither `bedVampId` nor `bedVampLabel` gets set, even though the caller intended to record the
assignment.
**Why it happens:** `setGroupBedMedia`'s `existing.exists()` branch (the common case — the group
document already exists once any prior media has been set) only writes `bedVampId`/`bedVampLabel`
*inside* the `else if (patch.bedAudioUrl !== undefined)` branch (`src/stores/slideGroups.ts:149-158`). A
no-MP3 vamp patch has `bedAudioUrl: undefined` by construction, so neither the `clearAudio` branch nor
the `bedAudioUrl !== undefined` branch fires — the `if`/`else if` falls through to nothing, and
`updateDoc` is called with only `{ updatedAt: serverTimestamp() }`.
**Asymmetry worth knowing:** the *other* branch (`!existing.exists()`, i.e. the group document doesn't
exist yet and this call is the first write) behaves differently — it calls `setDoc` with
`stripUndefined({ ..., bedAudioUrl: patch.bedAudioUrl, bedVampId: patch.bedVampId, bedVampLabel:
patch.bedVampLabel })`, and `stripUndefined()` only strips keys that are `undefined`, so `bedVampId`/
`bedVampLabel` (which ARE defined for a no-MP3 vamp patch) survive and get written correctly. **The bug
only manifests on the far more common "group already has a slideGroups doc" path** — this is worth
flagging to whoever writes the fix-verification test, since a naive test against a fresh/empty group
would pass by accident.
**How to avoid:** add a third branch, keyed on `patch.bedVampId` presence rather than `patch.bedAudioUrl`
presence: `else if (patch.bedVampId) { update.bedVampId = patch.bedVampId; update.bedVampLabel =
patch.bedVampLabel ?? ''; update.bedAudioUrl = deleteField() /* clear any stale Track/prior-vamp URL */ }`.
This must come *after* the existing `bedAudioUrl !== undefined` check (so a Track upload or an
MP3-having-vamp assignment, which both set `bedAudioUrl`, keep taking the existing branch) and it must
explicitly `deleteField()` `bedAudioUrl` — a merge/`updateDoc` call that simply omits the key leaves a
stale URL from a previous Track or MP3-vamp assignment in place, which is worse than doing nothing
(the chip would read the new vamp's amber "no MP3" state while a stale, wrong file keeps playing).
**Warning signs:** a test that asserts "assign a no-MP3 vamp" against a group fixture that already has
some prior media (the realistic case) will show `mockSetGroupBedMedia`/`updateDoc` receiving no
`bedVampId` key at all if this branch is missing.

### Pitfall 2: `SlideGroupMusicControl.vue`'s current template can't render the no-MP3-vamp state
**What goes wrong:** Today's template is `v-if="audioUrl"` for the "has media" branch and
`v-else-if="isEditor"` for the "add" branch. A group with `bedVampId` set and `bedAudioUrl` absent falls
through the *first* condition (false, `audioUrl` is falsy) into the second — it renders the plain
"+ Add music" / "+ Add a vamp for this group" buttons, as if nothing were assigned, silently hiding the
fact that a vamp *is* assigned (just with no MP3).
**Why it happens:** the component was built before the no-MP3-vamp case was reachable (today's
`onAttachGroupVamp` early-returns on a missing `downloadUrl`, so this state literally cannot occur in
production yet — Pitfall 1's fix is what first makes it reachable).
**How to avoid:** this is exactly why `142-UI-SPEC.md` replaces the `v-if="audioUrl"` gate with an
`audioTab` derivation (`'none'` when neither `audioUrl` nor `bedVampId` is set, `'vamp'` when
`bedVampId` is set regardless of `audioUrl`, else `'track'`) — the planner should treat this derivation
change as load-bearing, not cosmetic, and make sure a test explicitly covers "bedVampId set, audioUrl
absent" rendering the Vamp tab with the amber warning, not the empty-state "Add" buttons.
**Warning signs:** any new/updated test that mounts the control with `bedVampId` set and no `audioUrl`
and asserts on the OLD `group-music-choose-vamp`/`group-music-add` testids — those are the empty-state
buttons, and their presence in that scenario is the bug, not the fix.

### Pitfall 3: No `updatedAt` available for song-sourced background "recents" sorting
**What goes wrong:** `142-UI-SPEC.md`'s Component Spec §4 says recents are sorted "by the owning
group/song's `updatedAt` descending." Group-owned backgrounds genuinely have this — `SlideGroup.updatedAt:
Timestamp` (`src/types/slideGroup.ts:51`). But a *song-inherited* background (a SONG group whose own
background is empty, showing the song's background via `backgroundSource === 'song'` on its assembled
slides) has no `updatedAt` reachable from `SlidesTab.vue`'s existing props — `AssembledSlide` carries no
timestamp field, and `SlidesTab.vue` has no songs-store subscription at all (verified: no
`useSongs`/`songsById` import in either `SlidesTab.vue` or `ServiceEditorView.vue`).
**Why it happens:** song data was never threaded into the Slides tab component tree — only the
already-resolved (media-cascade-flattened) `assembledSlideshow` is, which intentionally drops
provenance-level metadata like timestamps.
**How to avoid:** this is a genuine open question for the planner (see Open Questions below), not a
research gap that can be silently papered over — a plausible resolution that stays inside the "no new
Firestore read" constraint is: sort the group-owned recents by `updatedAt` descending, then append any
additional song-sourced URLs (deduped) in `assembledSlideshow` plan order (a stable, if not truly
"most recent," ordering) rather than blocking the whole feature on adding a new song-store subscription.
**Warning signs:** a task that tries to read `song.updatedAt` from inside `SlidesTab.vue` without first
adding a new store subscription will not type-check — there is no such field reachable today.

### Pitfall 4: `vue-tsc --build` (not `-p tsconfig.app.json`) is the real type-check gate
**What goes wrong:** per CLAUDE.md, five `TS2339` errors survived two full phases because a narrower
`-p tsconfig.app.json` invocation was used as the gate and silently skipped test files.
**Why it happens:** `npm run type-check` runs `vue-tsc --build`, which includes test files;
`-p tsconfig.app.json` does not.
**How to avoid:** any plan verification step for this phase must run `npm run type-check`, especially
because this phase touches test files extensively (Finding 8) — a type error introduced only in a
migrated test file is exactly the failure mode CLAUDE.md documents.
**Warning signs:** a green `npm run build` or a narrow `vue-tsc -p tsconfig.app.json` with red
`npm run type-check` is the documented historical failure signature.

## Code Examples

### The exact existing panel gate this phase replaces
```html
<!-- Source: src/components/slides/SlideGrid.vue:518-521 (current) -->
<div
  v-if="showGroupMusicControl || showGroupBackgroundControl || showCongregationalControl || showRemoveImportedControl || canLoopSlot || showVideoOutputControl"
  class="mx-6 mt-3 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md border border-gray-800 bg-gray-900 px-3 py-2"
  data-testid="slide-grid-group-media-panel"
>
```
`142-UI-SPEC.md` Component Spec §7 directs this to simplify to `v-if="Boolean(selectedSlot)"` — verified
correct against the current gates: `showGroupMusicControl`/`showGroupBackgroundControl` are each
`Boolean(bedAudioUrl-or-backgroundImageUrl) || canWriteGroupMedia`, so they are already true whenever
`canWriteGroupMedia` is true (editor, unlocked service) — and the new Display chip always renders a
value once a group is selected, editor or not, locked or not, so the six-condition OR genuinely
collapses.

### Live playback already tolerates a bed vamp with no MP3 — verified, no change needed
```typescript
// Source: src/utils/slideshowAssembler.ts:296-306
const audioFromBed = !entry.audioUrl && !!group.bedAudioUrl
const resolvedAudioUrl = entry.audioUrl ?? group.bedAudioUrl

const media: ResolvedGroupMedia = { audioFromBed }
if (resolvedAudioUrl) media.audioUrl = resolvedAudioUrl   // undefined bedAudioUrl → no audioUrl set at all
// ...
if (audioFromBed && group.bedVampId) media.audioLoop = true  // audioFromBed requires bedAudioUrl truthy, so this never misfires on a no-MP3 bed
```
```typescript
// Source: src/composables/useRunControl.ts:335-343 — the ♪ badge label still resolves
// even when there's no audio to play, which is the intended UX (shows "assigned" state):
function vampLabelFor(slide: AssembledSlide | null): string | null {
  // ...
  if (!entry?.audioUrl && group.bedVampId) return group.bedVampLabel ?? ''
  return null
}
```
No task is needed against `slideshowAssembler.ts` or `useRunControl.ts` for this phase — both already
degrade correctly (silently skip audio, still show the label) for a `bedVampId`-with-no-`bedAudioUrl`
group.

### `VampPicker.vue`'s current disabled-row gate — the exact line the new `allowUnattached` prop must branch around
```html
<!-- Source: src/components/VampPicker.vue:48-49 and :80-81 -->
<button v-if="vamp.attachment?.downloadUrl" ... data-testid="vamp-picker-row" @click="emit('select', vamp)">
<div v-else aria-disabled="true" data-testid="vamp-picker-row-disabled">
```
`142-UI-SPEC.md` directs a new `allowUnattached?: boolean` prop (default `false`) so `EditSlideDrawer.vue`'s
existing call site (passes nothing) is unaffected, while the new Audio popover passes `allow-unattached` to
make the no-MP3 row clickable (still carrying the amber "No MP3" tag) instead of disabled.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Four unlike buttons in one row (size toggle, 2 audio buttons, background button) + `VampPickerSlideOver` slide-over for the group vamp picker | Three chips (Display/Background/Audio), each opening its own small popover; vamp picking inline via `VampPicker` `fill` mode inside the Audio popover | This phase (142), owner-approved 2026-09-19 via re-pulled Claude Design Turn 7 variant 7a | `VampPickerSlideOver.vue` stays in use for the per-slide drawer (`EditSlideDrawer.vue`, out of scope) but is retired from the *group* call site only |
| Group music/background controls hide entirely on a locked/non-editor service | Chips always render, visible-but-inert (span, no caret, no popover) when locked/non-editor | This phase | Matches `SlotVideoOutputControl.vue`'s existing visible-but-inert pattern, which the panel previously did NOT apply uniformly (music/background hid; video-output didn't) |
| `showGroupMusicControl`/`showGroupBackgroundControl` gate whether each control's wrapper renders at all | Chip existence is unconditional once a group is selected; `canWriteGroupMedia` now gates editability (button vs. span) only | This phase | The two booleans are retired from the template gate; `canWriteGroupMedia` alone remains as the editability check |

**Deprecated/outdated:**
- `slide-grid-group-background` (wrapper div testid) and `slide-grid-group-background-caption`: retired,
  folded into `slide-group-setup-chip-background`/`slide-group-setup-popover-background` and the
  strip-wide `slide-group-setup-caption` respectively (per Testid Contract in `142-UI-SPEC.md`).
- `group-music-add`, `group-music-choose-vamp`, `group-music-filename`, `group-music-scope`,
  `group-music-vamp-change`, `group-music-vamp-clear`, `group-music-vamp-label`, `group-music-vamp-stale`,
  `group-music-remove`: retired, replaced by the segmented-tab + Track/Vamp state testids.

## Findings Detail (numbered, referenced above)

**Finding 1 — Current panel structure** (`src/components/slides/SlideGrid.vue:139-263`, handlers
`679-800`): the panel wrapper (`slide-grid-group-media-panel`, line 141) currently composes, in order:
`SlotLoopControl` (canLoopSlot), `SlotVideoOutputControl` (showVideoOutputControl),
`SlideGroupMusicControl` (showGroupMusicControl), a `slide-grid-group-background` wrapper div around
`BackgroundControl` (showGroupBackgroundControl), the Congregational button, the Remove-imported button,
and the `groupBackgroundCaption` paragraph. Gates: `canWriteGroupMedia = isEditor && !serviceLocked`
(line ~583); `showGroupMusicControl = Boolean(group?.bedAudioUrl) || canWriteGroupMedia` (line ~588);
`showGroupBackgroundControl` mirrors it for `backgroundImageUrl` (line ~590); `showVideoOutputControl =
Boolean(selectedSlot) && isEditor && !serviceLocked` (locked service **hides** it, doesn't gray it out —
note this differs slightly from the component's own internal `:disabled` visible-but-inert styling,
which only ever fires when `showVideoOutputControl` is already true, i.e. it currently never renders
disabled in practice through this call site).

**Finding 2 — `SlotVideoOutputControl.vue`'s existing locked-state pattern** (full file read): uses
`:disabled="!editable"` on native `<button>`s (not a span swap) — this is the closest existing precedent
for "visible but inert," though it keeps `<button disabled>` semantics rather than converting to
`<span>`. `142-UI-SPEC.md`'s locked/non-editor chip pattern explicitly moves further — a plain `<span>`,
not a disabled button, with no `aria-haspopup`/`aria-expanded` at all. Both are legitimate "visible but
inert" but are not identical; the planner should follow the UI-SPEC's `<span>` directive for the new
chips rather than copying `SlotVideoOutputControl`'s `disabled`-attribute style verbatim, since the chip
also needs to drop its caret and stop being focusable, which `disabled` alone does for focus but not for
`aria-haspopup`/`aria-expanded` removal.

**Finding 3 — Live playback tolerance** (`src/utils/slideshowAssembler.ts:265-306`,
`src/composables/useRunControl.ts:328-343`): fully verified, see Code Examples above. No task required
against these files.

**Finding 4 — `setGroupBedMedia` bug** (`src/stores/slideGroups.ts:135-181`): fully verified, see
Pitfall 1 above. This is the one genuine logic fix in the phase.

**Finding 5 — `SlideGroupMusicControl.vue`'s render gap for the no-MP3-vamp state**
(`src/components/slides/SlideGroupMusicControl.vue`, full file read): see Pitfall 2. Also notable:
`isVampBed = computed(() => !!props.audioUrl && !!props.bedVampId)` (line 210) — this computed itself
requires `audioUrl` truthy, so even fixing only the template gate without changing this computed would
still miscategorize a no-MP3 vamp as "not a vamp bed." The `audioTab` derivation UI-SPEC specifies
(driven off `bedVampId` presence alone, not `audioUrl`) must replace uses of `isVampBed` for tab
selection, though `isVampBed`-style "has an MP3 vamp" logic may still be useful for other purposes (e.g.
whether to show the ▶ preview button, which needs an actual `audioUrl`).

**Finding 6 — Background "recents" source** (`src/components/slides/SlidesTab.vue:97-108`,
`src/utils/slideshowAssembler.ts:41` for `backgroundSource`, `src/types/slideGroup.ts:51` for
`updatedAt`): `SlidesTab.vue` already receives `groupsBySlotId: Map<string, SlideGroup>` (every slide
group for the service, each carrying its own `backgroundImageUrl` and `updatedAt: Timestamp`) and
`assembledSlideshow: AssembledSlide[]` (every slide, each carrying `backgroundImageUrl` +
`backgroundSource: 'slide' | 'group' | 'song' | undefined`). Recents can be built with zero new reads by
combining: (a) `[...groupsBySlotId.values()]` filtered to `backgroundImageUrl` truthy, sorted by
`updatedAt` descending — this part has real timestamps; (b) `assembledSlideshow.filter(s =>
s.backgroundSource === 'song')` for song-inherited URLs — this part has **no** `updatedAt` available
(see Pitfall 3, a genuine open question, not a settled fact). `SlideGrid.vue` already does the identical
`backgroundSource === 'song'` filter for its own single-group `songBackgroundForInheritedDisplay`
computed (line ~756), confirming the field and pattern both exist and are reliable — only the
service-wide/multi-group aggregation and the sort-key gap are new.

**Finding 7 — Popover/click-outside precedent** (`src/components/slides/SlideActionMenu.vue`,
`src/components/VampPickerSlideOver.vue`, both full files read): no existing `useClickOutside`
composable anywhere in `src/composables/` (grepped, zero hits for `click-outside|clickOutside|
useClickOutside` besides an unrelated Stage-layout match). Two real precedents exist: (1)
`SlideActionMenu.vue` uses a `<div v-if="open" class="fixed inset-0 z-10" @click="close" />` overlay for
click-outside (simple, proven, no document listener) plus a `@keydown` handler scoped to the panel
itself for Escape; (2) `VampPickerSlideOver.vue` uses `watch(() => props.open, ...)` to
`addEventListener`/`removeEventListener('keydown', ...)` on `window`, cleaned up in `onUnmounted`.
`142-UI-SPEC.md`'s Accessibility Contract specifies a document-level `pointerdown` listener (closer to
pattern 2's lifecycle, adapted for click rather than keydown) — this is locked; pattern 1 is noted here
only as a lighter-weight alternative already proven in the same directory, should the planner want to
avoid a global listener.

**Finding 8 — Test migration surface** (`src/components/slides/__tests__/SlideGrid.test.ts`, 2762
lines total, full grep read): 42 references to the panel/music/background/video-output testids this
phase touches, concentrated in five `describe` blocks — `'group music bar (25-06 Task 2)'` (line 596),
`'SlideGrid — group-level vamp bed wiring (260918-nm2)'` (line 695), `'group background control (33-08
Task 2)'` (line 840), `'group media panel (34-11 Task 1)'` (line 986), `'group media panel —
no-behaviour-change regression (34-11 Task 2)'` (line 1232) — spanning roughly lines 596–1232+ (the last
block's extent wasn't fully bounded in this pass; budget the whole 596–~1500 range as in-scope). Two
further per-item `describe` blocks (`'SlideGrid — per-item loop...'` line 2702, `'SlideGrid — per-item
Video output...'` line 2738) cover `SlotLoopControl`/`SlotVideoOutputControl` wiring and are lower-risk
since Loop is unchanged and `SlotVideoOutputControl`'s script is "largely unchanged" per UI-SPEC.
Smaller, single-component test files: `SlideGroupMusicControl.test.ts` (546 lines),
`BackgroundControl.test.ts` (307 lines — the `variant="panel"` default path must stay green
unmodified), `SlotVideoOutputControl.test.ts` (64 lines), `src/components/__tests__/VampPicker.test.ts`
(146 lines, needs new `allowUnattached` coverage), `VampPickerSlideOver.test.ts` (133 lines, unaffected —
its own call site is untouched). Test convention confirmed: `vitest` + `@vue/test-utils` (`mount`,
`flushPromises`, `enableAutoUnmount`), stores mocked via `vi.mock('@/stores/...', () => ({ useX: () => ({
...getters... }) }))` with mutable module-level `let mock... ` variables read through getters so
individual `it()` blocks can mutate them (see `SlideGrid.test.ts:19-42` for the exact pattern against
`useVampStore` and `useSlideGroups`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SlideGrid.test.ts`'s "group media panel" blocks fully span lines ~596–1232 with no additional scattered references beyond the 42 counted by grep | Finding 8 / Common Pitfalls | If more references exist outside this range (e.g. deep in the 1232–2702 span), the test-migration task is under-scoped; mitigate by re-grepping the exact testid list against the file before starting the test-migration task, not relying on this count alone |
| A2 | The recommended fallback for song-sourced background recents (append in `assembledSlideshow` plan order, no true recency sort) is an acceptable resolution of the CONTEXT.md "Claude's Discretion" recents-source item | Pitfall 3 / Finding 6 | If the owner expects true "most recently set" ordering across ALL sources including song-inherited ones, this fallback under-delivers; the alternative (thread a new songs-store subscription into `SlidesTab.vue`) is a small addition but does add a new read, which CONTEXT.md's discretion note explicitly tried to avoid — flag as a discuss-time question if the planner wants certainty before committing |

**If this table is empty:** N/A — see above.

## Open Questions

1. **How should song-inherited background "recents" be ordered given no `updatedAt` is available for
   them?**
   - What we know: group-owned recents have real `updatedAt` timestamps (`SlideGroup.updatedAt`);
     song-inherited ones (via `assembledSlideshow`'s `backgroundSource === 'song'`) have none reachable
     from `SlidesTab.vue` without a new store subscription.
   - What's unclear: whether "most-recent-first" from `142-UI-SPEC.md`'s Component Spec §4 is a hard
     requirement for song-sourced entries specifically, or whether a stable deterministic fallback
     (plan-position order) is acceptable since it was `142-CONTEXT.md`'s own "Claude's Discretion" item.
   - Recommendation: default to the fallback described in Pitfall 3 (group-owned sorted by `updatedAt`
     desc, song-sourced appended in assembled-slideshow order, deduped by URL, capped to 4 total) — it
     satisfies "no new Firestore read" and is a reasonable reading of "recent," but flag this choice
     explicitly in the plan so it's a visible decision, not a silent gap.

2. **Should `SlotVideoOutputControl.vue`'s existing `:disabled="!editable"` styling be fully replaced by
   the UI-SPEC's `<span>`-based inert pattern, or does the chip wrapper handle "inert" entirely at the
   `SlideGroupSetupStrip.vue` level (never mounting the popover/control at all when locked)?**
   - What we know: the UI-SPEC's locked/non-editor pill markup is a `<span>`, and its popover only ever
     mounts when a chip is `isOpen` — a locked/non-editor chip is never a `<button>`, so its popover
     (and the `SlotVideoOutputControl` instance inside it) never mounts in the first place.
   - What's unclear: whether `SlotVideoOutputControl.vue`'s own `editable` prop and `:disabled` styling
     become entirely dead code for the group-strip call site (since the wrapping chip already prevents
     the popover, and therefore the control, from ever rendering when locked), or whether it's still
     worth keeping `editable` wired through defensively.
   - Recommendation: keep `editable` wired through as `true` unconditionally from inside the popover
     (matching the UI-SPEC's own Component Spec §3 template, which passes no `:disabled` at all) — the
     chip-level gate is the single source of truth for lockedness; don't duplicate it inside the popover
     content.

## Environment Availability

No external dependencies beyond the existing dev toolchain (Node/npm, Firebase SDK, already-running
project). Skipped — this phase is Vue/TypeScript component work against the already-configured Firestore
project; no new CLI, service, or runtime is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.5.29 (app suite) [VERIFIED: package.json] |
| Config file | `vite.config.ts` (`test` block, excludes `src/rules.test.ts` and `render-service/**`) |
| Quick run command | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts src/components/slides/__tests__/SlideGroupMusicControl.test.ts src/components/slides/__tests__/BackgroundControl.test.ts src/components/slides/__tests__/SlotVideoOutputControl.test.ts src/components/__tests__/VampPicker.test.ts` |
| Full suite command | `npx vitest run` (2-file baseline per CLAUDE.md: only `src/storage.rules.test.ts` known-fails, an environment limitation, not a regression) |

### Phase Requirements → Test Map

No R-IDs exist for this phase (see `<phase_requirements>` above); mapped instead to CONTEXT.md decision
areas / UI-SPEC contract lines.

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| setGroupBedMedia fix | Assigning a no-MP3 vamp to an EXISTING group doc writes `bedVampId`/`bedVampLabel` and clears any stale `bedAudioUrl` | unit | `npx vitest run src/stores/__tests__/slideGroups.test.ts -t "bedVamp"` | ✅ `src/stores/__tests__/slideGroups.test.ts` exists — needs a new case for the existing-doc + no-MP3-vamp path |
| Chip states (Set/Unset/Vamp-no-MP3/Inherited/Open/Locked) | Each chip renders the correct pill class + value color + aria-label per §1's state table | unit | `npx vitest run src/components/slides/__tests__/SlideGroupSetupStrip.test.ts` (new file) | ❌ Wave 0 — new component, new test file |
| `audioTab` derivation | None/Track/Vamp tab selection derives correctly from `audioUrl`/`bedVampId` combinations, including the no-MP3 case | unit | `npx vitest run src/components/slides/__tests__/SlideGroupMusicControl.test.ts` | ✅ exists, needs new cases (currently the `v-if="audioUrl"` gate makes the no-MP3 case untestable — that's the bug) |
| `VampPicker allowUnattached` | A no-MP3 row is clickable and emits `select` when `allowUnattached` is true; stays disabled when false/absent (`EditSlideDrawer` call site unaffected) | unit | `npx vitest run src/components/__tests__/VampPicker.test.ts` | ✅ exists, needs new cases for the prop |
| `BackgroundControl variant="chip-popover"` additive branch | The default/`variant="panel"` branch renders byte-identically to today (regression); the new branch renders swatches/recents/upload | unit | `npx vitest run src/components/slides/__tests__/BackgroundControl.test.ts` | ✅ exists — the existing 307 lines ARE the regression suite for the untouched branch; add new cases for the new branch |
| Panel gate simplification | `slide-grid-group-media-panel` renders whenever `selectedSlot` is set, for every combination of locked/unlocked, editor/non-editor | unit | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts -t "group media panel"` | ✅ exists — "group media panel — no-behaviour-change regression" block (line 1232) is exactly this |
| Live playback tolerance (regression only, no fix needed) | A group with `bedVampId` set and no `bedAudioUrl` produces no `audioUrl` in the assembled slide, and the ♪ label still resolves | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` (confirm existing file covers this combination; add a case if not) | ✅ file likely exists — verify coverage of this exact combination during planning, do not assume |

### Sampling Rate
- **Per task commit:** the quick run command above (5 targeted files, well under 30s)
- **Per wave merge:** `npx vitest run` (full app suite, 2-file baseline)
- **Phase gate:** `npm run type-check` (vue-tsc --build, includes test files — CLAUDE.md-mandated gate)
  AND full `npx vitest run` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/slides/__tests__/SlideGroupSetupStrip.test.ts` — new file, covers the chip state
      table (§1), popover shell (§2), and the `openChip` single-open-at-a-time / reset-on-group-switch
      behavior
- [ ] A new case in `src/stores/__tests__/slideGroups.test.ts` for the `setGroupBedMedia` existing-doc +
      no-MP3-vamp patch shape (the actual bug fix's regression test)
- [ ] Confirm `src/utils/__tests__/slideshowAssembler.test.ts` (or equivalent) has an explicit case for
      `bedVampId` set with `bedAudioUrl` absent — if absent, add one; this is cheap insurance around
      Finding 3's "no change needed" claim
- [ ] No new test framework or config needed — vitest is already fully configured for this directory

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged — this phase touches no auth surface |
| V3 Session Management | no | unchanged |
| V4 Access Control | yes | `canWriteGroupMedia` (editor + not-locked) gate, already enforced client-side AND by `firestore.rules`' `slideGroups` match block (`isOrgEditor(orgId) && parentDraft(...)`) — verified no field-level rule restricts `bedVampId` presence without `bedAudioUrl` (checked `firestore.rules:444-475`), so the fix in Finding 4 introduces no new rules gap |
| V5 Input Validation | yes | `useMediaUpload`/`useBackgroundUpload`'s existing `validate()` functions (MIME-type + size cap) — unchanged, reused verbatim by the new popovers |
| V6 Cryptography | no | not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A non-editor or locked-service viewer triggers a write via a chip that should be inert | Elevation of Privilege | `canWriteGroupMedia` gate in `SlideGrid.vue` handlers is re-checked server-side by `firestore.rules`' `isOrgEditor(orgId) && parentDraft(...)` — the UI-level `<span>`-not-`<button>` inert rendering is a UX affordance, not the security boundary; this phase changes no rule and must not weaken this defense-in-depth (verified rules unchanged/sufficient) |
| Stale `bedAudioUrl` from a previous Track/vamp lingering after a no-MP3 vamp is assigned, causing wrong audio to keep playing live | Tampering (data integrity, not attacker-driven) | The Finding-4 fix's `deleteField()` on `bedAudioUrl` in the new patch branch is the mitigation — omitting it (a merge that just doesn't touch the key) would leave stale playback data, a real live-service correctness bug during a real church service, not merely a cosmetic one |

## Sources

### Primary (HIGH confidence — direct source-code inspection this session)
- `src/components/slides/SlideGrid.vue` — full template header, panel section (lines 1-263, 500-800)
- `src/stores/slideGroups.ts` — `setGroupBedMedia`/`setGroupBackground` (lines 100-210)
- `src/utils/slideshowAssembler.ts` — media resolution (lines 265-310)
- `src/composables/useRunControl.ts` — vamp label resolution (lines 320-350)
- `src/components/VampPicker.vue` — full file
- `src/components/VampPickerSlideOver.vue` — full file
- `src/components/slides/SlideGroupMusicControl.vue` — full file
- `src/components/slides/BackgroundControl.vue` — full file
- `src/components/slides/SlotVideoOutputControl.vue` — full file
- `src/components/slides/SlotLoopControl.vue` — header
- `src/components/slides/SlideActionMenu.vue` — full file
- `src/components/slides/SlidesTab.vue` — props/imports (lines 1-140)
- `src/types/slideGroup.ts`, `src/types/slide.ts`, `src/types/vamp.ts` (referenced) — field shapes
- `firestore.rules` (lines 444-502) — `slideGroups` access rules
- `src/components/slides/__tests__/SlideGrid.test.ts` — mocking convention + testid usage counts
- `package.json`, `vite.config.ts` — versions and test-exclude configuration
- `142-CONTEXT.md`, `142-UI-SPEC.md`, `docs/design/slides-tab.dc.html` (lines 20-275), `docs/design/README.md`

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 142 entry — confirmed "Requirements: TBD"
- `.planning/REQUIREMENTS.md` — confirmed no Phase 142 R-IDs exist in the current milestone doc
- `.planning/codebase/CONVENTIONS.md` — Comment Convention section

### Tertiary (LOW confidence)
- None — no WebSearch or external documentation lookups were needed for this phase; it is entirely a
  first-party codebase refactor with no new library surface.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all versions read directly from `package.json`
- Architecture: HIGH — every component/store/handler cited was read in full or in the specific relevant
  range this session, not recalled from training data
- Pitfalls: HIGH for Pitfalls 1/2/4 (directly verified in source); MEDIUM for Pitfall 3 (a genuine gap
  requiring a planning-time decision, not a verified bug)

**Research date:** 2026-09-19
**Valid until:** 2026-10-19 (30 days — stable first-party codebase, no external API/version drift risk)
