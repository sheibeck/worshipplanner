# Phase 33: Backgrounds & Slide Editing - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey areas were proposed with recommendations and auto-accepted
under the STATE.md standing autonomy grant of 2026-07-30. Every accepted answer is Claude's
recommendation, not an owner statement — reversible defaults, not locked owner preferences.

<domain>
## Phase Boundary

Two related changes to the Slides tab. **Backgrounds:** an image can be set at three levels — one
slide, a whole group, or a song — resolved most-specific-wins wherever the assembler already resolves
per-slide audio. **Slide editing:** a slide enters edit mode only through an explicit 3-dot menu,
never by clicking the slide; that menu opens separate "Edit details" and "Edit lyrics" drawers, and
its item list varies by the service-item type the slide belongs to.

Requirements: **R055** (group background), **R056** (slide background, most-specific-wins),
**R057** (song background from the Song Lyrics editor), **R058** (per-slide audio loses its
"whole group" scope option), **R051** (edit only via 3-dot menu), **R052** ("Edit details" and
"Edit lyrics" as separate drawers), **R063** (options vary by service-item type).

**In scope:** `backgroundImageUrl` on `GroupSlideEntry`, `SlideGroup` and `SongLyrics`; the
resolution cascade in `slideshowAssembler.ts`; a new `SlideActionMenu.vue`; splitting
`EditSlideDrawer.vue` into two modes; deleting `audioScope`; the background-setting affordances at
all three levels.

**Out of scope:** the drop-zone-as-import rework and moving Add-slide/Add-music into the action bar
(**R053** — explicitly deferred to Phase 36 because its own text names the action bar as its target);
any change to what a background *looks like* when presented beyond rendering it (presentation
correctness is Phase 35); the Service Order tab.

</domain>

<decisions>
## Implementation Decisions

### Background Model & Precedence

- **Resolution extends `resolveGroupMedia` in `src/utils/slideshowAssembler.ts`** (~lines 197-229),
  the function that already owns per-slide media precedence. Backgrounds join it rather than getting
  a parallel resolver.
- **The cascade is slide → group → song, most specific wins** — exactly R056's prose. The song sits
  *least* specific because it is the shared canonical record; a service-specific choice must be able
  to beat it. (R056 states this as prose deliberately: arrow notation for this cascade appeared in
  both directions during v1.4 planning and reads backwards half the time. Do not "helpfully" add an
  arrow diagram.)
- **★ Deliberate divergence from the audio precedent: a video slide does NOT suppress an inherited
  background.** `slideshowAssembler.ts:204-205` records that a video slide never resolves the group's
  bed audio, because two sounds collide audibly. Two *visuals* do not collide the same way — a video
  slide's own picture already covers the background, so suppressing it buys nothing and would
  surprise. **Flag this divergence explicitly in the plan** rather than letting a reader assume the
  audio rule was copied wholesale.
- **Track provenance, mirroring `audioFromBed`.** The resolved slide should carry something like
  `backgroundFromGroup` / `backgroundFromSong` so the UI can show "inherited from group" versus "set
  on this slide". Without it the override is invisible and users cannot tell why a slide looks the
  way it does.
- `SongLyrics.backgroundImageUrl` is **greenfield — no migration**, per D-19 as extended to Phase 28's
  song-lyrics structures.

### The 3-Dot Menu & Decoupling Select from Edit

- **Clicking a slide body still SELECTS; it just no longer opens an editor.** Selection is load-bearing
  (it drives the plan rail and the drop target) and must not be removed. R051's actual goal is "slides
  can be dragged without triggering edit" — that is satisfied by breaking the select→edit coupling,
  not by making the card inert.
- **One new shared `SlideActionMenu.vue` in `src/components/slides/`.** No kebab/dropdown primitive
  exists anywhere in the slides folder today (the three `dropdown` hits elsewhere in
  `src/components/` are unrelated), and R063 requires the item list to vary by type — a props-driven
  contract, not copy-paste per card.
- **Accessibility contract:** trigger is a `<button>` with `aria-haspopup="menu"` and `aria-expanded`;
  items are `role="menuitem"`; Escape closes and returns focus to the trigger. Phase 25 already
  flagged that SortableJS provides no keyboard reordering in this grid — do not add a second keyboard
  gap on top of it.
- **Song groups DO get a menu, with a reduced item set.** R054 keeps song slides read-only in this
  tab, so the menu offers "Edit in song" and background-setting but not "Edit lyrics" or delete. A
  card with no menu at all reads as broken rather than as intentionally restricted.

### Two Drawers Instead of One

- **★ R052's premise is loose and is corrected here.** R052 says the change replaces "the arrow
  affordance and the multi-tab single drawer" — but `EditSlideDrawer.vue` as shipped has **sections,
  not tabs** (verified: `data-testid="drawer-*"` markers are sections; there is no tab bar). **Treat
  the requirement's intent as binding and its premise as inaccurate:** split the existing drawer's
  content into two separately-openable drawers. Do **not** build tabs in order to remove them.
  Record this as a premise correction in the plan — the same class of finding as Phase 27's two false
  ROADMAP premises, which were caught before anything broke.
- **One component with a `mode: 'details' | 'lyrics'` prop**, not two separate components. The
  scrimless floating-panel shell, the positioning, and the follows-selection behaviour are all shared
  (Phase 26 built them); only the body differs.
- **"Edit lyrics" is offered only for hand-authored text slides** — PRAYER / MESSAGE / blank. Never
  for SONG-group lyric entries, which stay read-only here and route to "Edit in song" (R054, Phase
  30). The ROADMAP note states this explicitly.
- **Only one drawer open at a time** — opening the second replaces the first. Two floating scrimless
  panels over a grid that stays clickable (Phase 26 D-03) is a layering problem with no upside.

### Type-Varying Options (R063) & Removing Audio Scope (R058)

- **The per-type item list is a pure function over `sourceRef.kind`**, returning the menu items.
  Testable without mounting, and `src/components/slides/slideDisplay.ts` already establishes the
  pure-per-kind-helper convention in this exact folder.
- **`audioScope` is DELETED outright, not deprecated.** D-19 forbids legacy shims anywhere in the
  slide area and this data was never deployed. Remove the field from `GroupSlideEntry`, the drawer's
  scope toggle, and the scope-handling branch in `src/stores/slideGroups.ts` (~line 213) together.
- **No migration for entries that already stored `audioScope: 'group'`.** `slideGroups.ts:213-215`
  documents that the stored value "exists only" for round-trip display — delete the reader and the
  value becomes inert. **Confirm at plan time that no other read path survives** before deleting.
- **R058 is a subtraction, not a replacement.** Group-wide audio was already settable at group level
  via `SlideGroupMusicControl.vue`; R058 removes the *second* way of doing it. **Verify the group
  control genuinely covers the case before deleting the per-slide scope option** — if it does not,
  that gap is in scope and must be closed, or R058 leaves users unable to do something they could do
  before.

### Claude's Discretion

- Image upload mechanics for backgrounds — whether to reuse `src/composables/useMediaUpload.ts` and
  the existing storage prefixes, or add a background-specific path. Resolve during research against
  what the storage rules and `cleanupExpiredMedia`'s regex guard actually permit.
- Menu item ordering and exact labels beyond the two R052 names.
- Whether the background affordance lives inside the details drawer, in the menu, or both.
- Component/file naming and Tailwind choices.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/utils/slideshowAssembler.ts:197-229`** — `resolveGroupMedia` and `ResolvedGroupMedia`. The
  audio cascade is `entry.audioUrl ?? group.bedAudioUrl` with `audioFromBed` marking the fallback.
  This is the shape backgrounds extend. Note the video carve-out at `:204-205`.
- **`src/components/slides/slideDisplay.ts`** — the established pure-helper-per-kind convention.
- **`src/components/slides/EditSlideDrawer.vue`** — the Phase 26 scrimless floating panel. Sections
  are marked `data-testid="drawer-label-input"`, `drawer-preview`, `drawer-slide-text-section`,
  `drawer-copyright-block`, `drawer-edit-in-song-link`. `SONG_TEXT_CAPTION` (`:570`) and
  `onEditInSong` (`:1021`, via `buildSongEditLink`) are the read-only song path.
- **`src/components/slides/SlideGroupMusicControl.vue`** — the existing group-level media affordance;
  the group background control should sit alongside it, and it is what R058 relies on.
- **`src/composables/useMediaUpload.ts`** — existing upload path.

### Established Patterns

- Vue 3 `<script setup>` + TypeScript, Pinia, Tailwind, `data-testid` targeting, Vitest +
  `@vue/test-utils`. **As of Phase 32, component tests may install real Pinia** via
  `setActivePinia(createPinia())` — that precedent now exists and `enableAutoUnmount(afterEach)`
  proved load-bearing, not cosmetic (an un-unmounted wrapper's watcher can hijack the active Pinia).

### Integration Points

- **`src/types/slideGroup.ts:34-73`** — `SlideGroup` (has `bedAudioUrl`, `sourceSignature`, `slides`)
  and `GroupSlideEntry` (has `audioUrl`, `audioScope`, `audioLoop`). Both gain `backgroundImageUrl`;
  `audioScope` is deleted.
  ⚠ **`slides` is an EMBEDDED ARRAY, not a Firestore subcollection** — the header comment explains
  that a nested subcollection would fall through `firestore.rules`' single-segment catch-all to a
  global deny. Do not restructure it.
- **`src/types/songLyrics.ts:36-59`** — `SongLyrics` gains `backgroundImageUrl`.
- **`src/components/slides/SlideCard.vue:8`** — `@click="emit('select', …)"`. This is the coupling
  R051 breaks. Note `:47` already uses `@click.stop` on the grip so dragging never selects.
- **`src/stores/slideGroups.ts:213-215`** — the `audioScope: 'group'` persistence branch to delete.

</code_context>

<specifics>
## Specific Ideas

- The ROADMAP note is the sharpest instruction available: *"Add `backgroundImageUrl?: string` at three
  levels — `GroupSlideEntry` (per-slide), `SlideGroup` (group), `SongLyrics` (song, greenfield, no
  migration) — resolved wherever `assembleSlideshow` already resolves `audioUrl` per slide. The 'Edit
  lyrics' drawer applies only to hand-authored text slides (PRAYER/MESSAGE/blank), never SONG-group
  lyric entries."*
- **"Confirm against the Claude Design wireframes at plan time which drawer a given slide's 3-dot menu
  opens."** The ROADMAP says this explicitly. If the wireframes are not locatable in the repo, say so
  in the plan rather than inventing the mapping silently.

</specifics>

<deferred>
## Deferred Ideas

- **R053** — drop-zone-as-import, and moving "Add slide" / "Add music to this group" into the
  contextual action bar. Deferred to **Phase 36** by the ROADMAP's own reasoning: R053's text names
  R068 (the action bar) as its target, so building it before Phase 36 means building it twice.
- **Keyboard reordering of slides.** Still absent (SortableJS provides none) and still out of scope —
  flagged, not silently omitted, consistent with Phase 25.
- **Background rendering fidelity in the presented slideshow** — how a background composites with
  text, contrast/legibility on a projector. That is presentation correctness, Phase 35.
- **Backgrounds at the service or section level.** Only three levels are requested; a fourth is a new
  capability, not an extension.

</deferred>
