# Phase 33: Backgrounds & Slide Editing - Research

**Researched:** 2026-08-02
**Domain:** Vue 3 SPA slide-editing UI + Firebase Storage/Firestore media model (no new external libraries)
**Confidence:** HIGH

## Summary

This phase has an unusually strong starting position: 33-UI-SPEC.md is an APPROVED (6/6) design
contract that already carries the per-type menu table, component markup, copy, and four
independently-verified source-code findings. This RESEARCH.md's job was narrower than usual — verify
the UI-SPEC's five highest-value claims against the live codebase rather than re-derive design, and
surface anything the planner needs that the UI-SPEC's scope didn't cover (test architecture, security
posture, requirement traceability). All five verification targets came back **confirmed, not
contradicted** — this is a rare "the spec's claims all check out" research pass, not a routine one.

**The two claims that mattered most both verified true:** (1) a `orgs/{orgId}/backgrounds/**` Storage
path is structurally exempt from `cleanupExpiredMedia` (its `MEDIA_PATH_GUARD` regex only matches
`orgs/[^/]+/media/`) and needs **no `storage.rules` change** — it falls into the existing generic
`orgs/{orgId}/{allPaths=**}` block, which already grants org-member read/write at a 25MB cap, same
auth model as the `media/` path. (2) `audioScope` truly has exactly one write path and one read path
in the entire codebase (`EditSlideDrawer.vue` writes it, `slideGroups.ts:213-215` reads it for
round-trip display only) — no assembler, presenter, or print-layout code reads it, so deleting it is
safe with zero hidden consumers.

**Primary recommendation:** Extend `resolveEntryMedia` in `slideshowAssembler.ts` with a background
cascade sibling (do not write a second resolver); add `backgroundImageUrl` to the three greenfield
models with no migration; delete `audioScope` outright including its one confirmed read path; split
`EditSlideDrawer.vue` via a `mode` prop exactly as UI-SPEC §4 specifies; and treat `SlideActionMenu.vue`
as the codebase's **first** real ARIA menu (`role="menu"`, `aria-haspopup`) — no prior implementation
exists to imitate, only the ARIA-free `ServiceEditorView.vue:1084-1117` dropdown to borrow visual shell
from, not semantics.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Background image storage (upload bytes → URL) | Browser/Client (`useBackgroundUpload` composable, direct Firebase Storage SDK write) | Storage (Firebase Storage bucket, `orgs/{orgId}/backgrounds/**`) | Mirrors `useMediaUpload.ts` exactly — client uploads directly via `uploadBytesResumable`, no Cloud Function intermediary |
| Background cascade resolution (slide → group → song) | Browser/Client (pure function extension in `slideshowAssembler.ts`) | Database (Firestore — the three levels' stored URLs are the resolver's raw inputs) | `assembleSlideshow`/`resolveEntryMedia` run entirely client-side against pre-loaded maps; Firestore only supplies the fields being resolved, it does no resolution itself |
| Background rendering (compact edit preview only) | Browser/Client (`EditSlideDrawer.vue`'s `drawer-preview` box, CSS `background-image`) | — | Deliberately NOT `PresentationViewer.vue` or `SlideCard.vue`'s thumbnail — see Research Question 2 below |
| Slide select/edit decoupling | Browser/Client | — | Pure Vue component state (`SlidesTab.vue` refs); no backend involvement |
| 3-dot menu, type-varying item list | Browser/Client (pure function over already-loaded props) | — | `slideActionMenuItems` in `slideDisplay.ts`, synchronous, no store/composable reads |
| Drawer `mode: 'details'\|'lyrics'` split | Browser/Client | — | Vue component prop/local-state split; no data-model change beyond the new `backgroundImageUrl` fields |
| `audioScope` deletion | Browser/Client (type + component) | Database (Firestore documents naturally stop carrying meaning once the reader is gone — no migration write) | D-19: greenfield, delete the field and its one reader together, no backfill |
| Access control on new writes | Database (`firestore.rules`) + Storage (`storage.rules`) | Browser/Client (`canMutate`/`canWriteGroupMedia`/`canMutateBackground` gates) | Verified: neither rules file needs a change — see Research Question 1 |

## Standard Stack

No new libraries are introduced by this phase. Every dependency used is already installed and already
the established pattern in this exact folder.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase` (client SDK) | already a project dependency — `firebase/storage`'s `uploadBytesResumable`/`getDownloadURL` | Background image upload | Identical API surface `useMediaUpload.ts` already uses; no new SDK surface to learn |
| Vue 3 `<script setup>` + TypeScript | project-pinned | All new components (`SlideActionMenu.vue`, `BackgroundControl.vue`) | House convention, unchanged |
| Pinia (`useSlideGroups`, `useSongLyrics`) | project-pinned | Group/song background writes | Existing store write actions extended, not new stores |
| Vitest + `@vue/test-utils` | project-pinned | All new/changed tests | House convention |

### Supporting
None — no new supporting libraries.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `SlideActionMenu.vue` with plain Tailwind | Headless UI / Radix Vue `Menu` primitive | REQUIREMENTS.md's "Out of Scope" table and 33-UI-SPEC's "Design System" both rule this out explicitly — no component-library tooling exists in this Vue project (shadcn is React-only, correctly noted as not applicable) and adding one for a single menu is disproportionate. Every other dropdown in this codebase (`ServiceEditorView.vue:1084-1117`) is hand-rolled Tailwind too. |

**Installation:** none required — no `npm install` step for this phase.

**Version verification:** N/A — no new package versions to pin.

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new npm/external dependencies. All work uses the
already-installed `firebase` SDK (`firebase/storage`), existing Vue/Pinia/Vitest tooling already in
`package.json`, and hand-authored Tailwind markup with no new component-library package. No
`package-legitimacy check` run was needed — there is nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Browser (Vue 3 SPA)                                                     │
│                                                                          │
│  SlideCard.vue ──click(body)──▶ emit('select') ─────┐                  │
│      │ role="div" (was <button>, §1 fix)             │                  │
│      └─▶ SlideActionMenu.vue ──click(item)──▶ emit('select', key) ──┐  │
│                                                                       │  │
│  SlidesTab.vue                                                       │  │
│    onSelectSlide(id)         ─── SELECTION ONLY (R051 fix) ◀─────────┘  │
│    onMenuAction(id, key)     ─── opens EditSlideDrawer in mode ◀────────┘
│         │                                                                │
│         ├─ 'edit-details' / 'edit-lyrics' ──▶ drawerOpen=true, drawerMode│
│         ├─ 'edit-in-song' / 'edit-in-scripture' ──▶ router.push / relay │
│         └─ 'duplicate' / 'delete' ──▶ existing store actions (unchanged)│
│                                                                          │
│  EditSlideDrawer.vue (mode: 'details' | 'lyrics')                       │
│    reads: entry, group, planItem, assembledSlide (already-resolved)    │
│    'details' mode → Slide Background section → useBackgroundUpload ─┐  │
│                                                                       │  │
│  BackgroundControl.vue (shared, 2 call sites)                        │  │
│    SlideGrid.vue (group level)  ──attach/remove──▶ slideGroups store │  │
│    SongLyricEditor.vue (song level) ──attach/remove──▶ songLyrics store  │
│                                                                       ▼  │
│                                              useBackgroundUpload ────────┼──▶ Firebase Storage
│                                              (new composable,           │     orgs/{orgId}/backgrounds/**
│                                               image/* only, 10MB cap)   │     (no rules change needed)
└──────────────────────────────────────────────────────────────────────┼─┘
                                                                          │
   slideGroups store / songLyrics store ──Firestore write────────────────┤
        (backgroundImageUrl field on GroupSlideEntry/SlideGroup/SongLyrics)
                                                                          │
   slideshowAssembler.ts: resolveEntryMedia (extended)                   │
        reads GroupSlideEntry.backgroundImageUrl ?? SlideGroup.backgroundImageUrl
              ?? SongLyrics.backgroundImageUrl  ─── slide → group → song ─┘
        emits AssembledSlide.slide.backgroundImageUrl + .backgroundSource
                    │
                    ▼
        EditSlideDrawer.vue's `drawer-preview` box (CSS background-image)
        SlideCard.vue's provenance CHIP only (no image compositing — Phase 35)
        PresentationViewer.vue — NOT TOUCHED this phase (Phase 35 owns rendering fidelity)
```

### Recommended Project Structure
```
src/components/slides/
├── SlideActionMenu.vue        # NEW — the 3-dot menu, presentational, props-driven
├── BackgroundControl.vue      # NEW — shared group/song background control (2 call sites)
├── EditSlideDrawer.vue        # MODIFIED — gains `mode` prop, Slide Background section, loses audio-scope UI
├── SlideCard.vue              # MODIFIED — root <button> → <div role="button">, gains provenance chip
├── SlideGrid.vue              # MODIFIED — mounts SlideActionMenu per card, mounts group BackgroundControl
├── SlidesTab.vue              # MODIFIED — onSelectSlide split into select-only + onMenuAction
├── slideDisplay.ts            # MODIFIED — gains slideActionMenuItems() pure helper
src/composables/
└── useBackgroundUpload.ts     # NEW — sibling to useMediaUpload.ts, image/* only, 10MB cap
src/components/
└── SongLyricEditor.vue        # MODIFIED — mounts song-level BackgroundControl in header region
src/utils/
└── slideshowAssembler.ts      # MODIFIED — resolveEntryMedia extended with background cascade
src/types/
├── slideGroup.ts              # MODIFIED — GroupSlideEntry/SlideGroup gain backgroundImageUrl, lose audioScope
├── songLyrics.ts              # MODIFIED — SongLyrics gains backgroundImageUrl
└── slide.ts                   # MODIFIED — AssembledSlide/SlideBase gain backgroundImageUrl + backgroundSource
src/stores/
└── slideGroups.ts             # MODIFIED — loses the audioScope round-trip branch (~:213-215)
```

### Pattern 1: Extend the existing media resolver, never write a second one
**What:** `resolveEntryMedia` in `slideshowAssembler.ts` (~:215-231) already implements the exact
two/three-source precedence shape backgrounds need. Add a `backgroundImageUrl`/`backgroundSource`
computation inside the SAME function, returned alongside `audioUrl`/`audioFromBed`.
**When to use:** Always — CONTEXT.md and UI-SPEC both state this explicitly ("Backgrounds join it
rather than getting a parallel resolver").
**Example:**
```typescript
// Source: src/utils/slideshowAssembler.ts:215-231 (existing, verified 2026-08-02)
function resolveEntryMedia(group: SlideGroup, entry: GroupSlideEntry, song: SongLyrics | undefined): ResolvedGroupMedia {
  if (entry.sourceRef.kind === 'video') {
    return { audioFromBed: false } // ★ background is NOT carved out here — see Pitfall 1
  }
  const audioFromBed = !entry.audioUrl && !!group.bedAudioUrl
  const resolvedAudioUrl = entry.audioUrl ?? group.bedAudioUrl
  // NEW: three-level cascade, slide → group → song, most specific wins
  const backgroundImageUrl = entry.backgroundImageUrl ?? group.backgroundImageUrl ?? song?.backgroundImageUrl
  const backgroundSource = entry.backgroundImageUrl ? 'slide'
    : group.backgroundImageUrl ? 'group'
    : song?.backgroundImageUrl ? 'song'
    : undefined
  // ...
}
```
**Note:** the existing signature does not currently receive the song document — `resolveEntryContent`
already resolves `inputs.songLyricsById.get(ref.songId)` for lyric/copyright kinds, but `resolveEntryMedia`
is called generically for every kind including non-song groups (PRAYER/SCRIPTURE/etc., which have no
associated song at all). The planner must thread a `song: SongLyrics | undefined` parameter through
(only populated for SONG-kind groups) or perform the song lookup at the `emitFromGroup` call site and
pass it in — either is a small, mechanical addition, not a redesign.

### Pattern 2: `SlideActionMenu.vue` — the codebase's first real ARIA menu
**What:** `role="menu"`/`role="menuitem"`/`aria-haspopup`/`aria-expanded`, borrowing the click-away
backdrop + `z-10`/`z-20` layering idiom from `ServiceEditorView.vue`'s existing add-menu dropdown, but
adding real menu semantics that dropdown never had.
**When to use:** This one component only. Do not generalize into a shared primitive beyond what
33-UI-SPEC §2 already specifies — no second consumer exists yet.
**Example:** see 33-UI-SPEC.md § Phase-Specific Component Contracts §2 for the full verified markup —
reproduced there against real source citations, not re-derived here.

### Anti-Patterns to Avoid
- **Copying the audio video-carve-out to background:** `resolveEntryMedia`'s video branch returns early
  with `audioFromBed: false` — do NOT let a background computation added inside that same early-return
  branch. Background must resolve normally for video entries (CONTEXT.md's "deliberate divergence").
- **A second background resolver function:** would fork the precedence logic from the audio one and
  drift the moment either changes.
- **Nesting the menu trigger `<button>` inside `SlideCard.vue`'s existing `<button>` root:** invalid
  HTML (interactive content inside interactive content) — verified `SlideCard.vue:2-9` IS currently a
  `<button>` root; §1's fix (swap to `<div role="button" tabindex="0">`) is load-bearing, not optional.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image upload validation/progress | A bespoke fetch+XHR upload flow | A `useBackgroundUpload` composable that mirrors `useMediaUpload.ts`'s structure (validate → `uploadBytesResumable` → `getDownloadURL`) almost verbatim, swapping the MIME check to `image/*` and the cap to 10MB | `useMediaUpload.ts` already solved resumable-upload + progress + error-surfacing; forking a new implementation risks losing the "failed upload never clears an existing attachment" contract (T-25-06-03 precedent) |
| Cross-level "what's set where" provenance | Two booleans (`backgroundFromGroup`/`backgroundFromSong`) | One tri-state `backgroundSource?: 'slide'\|'group'\|'song'` | UI-SPEC already reasoned through why two booleans is wrong for a 3-level cascade (can represent an impossible state); confirmed correct during this research pass — do not "simplify" back to two booleans |
| Menu accessibility | A custom keydown-arrow roving-tabindex implementation | The stated, deliberate gap (Escape-only, native tab order) matching the one other dropdown's own precedent | 33-UI-SPEC and this research both confirm zero prior ARIA menu implementation exists to extend — building full roving-tabindex for one new control is disproportionate scope creep the CONTEXT/UI-SPEC explicitly declined |

**Key insight:** every "don't hand-roll" item in this phase is really "don't hand-roll something
DIFFERENT from the sibling pattern that already exists two files away." The risk here isn't reinventing
a wheel from scratch — it's drifting from an established, tested precedent (`useMediaUpload.ts`,
`resolveEntryMedia`, `SlideGroupMusicControl.vue`'s emit-only contract) by writing a parallel version
that looks similar but diverges subtly.

## Runtime State Inventory

**Not applicable — this is not a rename/refactor/migration phase.** New fields are added
(`backgroundImageUrl` at three levels) and one field is deleted (`audioScope`), but per D-19 this whole
area is greenfield with never-deployed data, so there is no runtime state to inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `audioScope: 'group'` may exist on already-written `GroupSlideEntry` documents from prior phases' testing/dev use, but D-19 explicitly waives migration for this entire area — the field simply becomes inert once its one reader (`slideGroups.ts:213-215`) is deleted | None — confirmed by this research: no other read path exists (see Research Question 3 below) |
| Live service config | None — no external service (n8n, Datadog, etc.) references `audioScope` or the new background fields | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None — no package rename, no installed-package rename | None |

## ★ Research Question 1 — The background upload path (VERIFIED, all three parts confirmed)

**Claim under test:** a new `useBackgroundUpload` composable writing to `orgs/{orgId}/backgrounds/**`
is structurally exempt from `cleanupExpiredMedia`'s sweep with no `storage.rules` change needed.

**Part A — structurally exempt from cleanup, VERIFIED.** `functions/src/index.ts:241`:
```typescript
export const MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//;
```
This regex matches ONLY paths beginning `orgs/{orgId}/media/`. A `orgs/{orgId}/backgrounds/{id}/{file}`
object never matches — `cleanupExpiredMedia`'s loop (`:269-274`) skips it unconditionally before any
age check, exactly the same class of exemption `pptx-imports/` already enjoys. `[VERIFIED: functions/src/index.ts:241,269-274, read directly]`

**Part B — no `storage.rules` change needed, VERIFIED.** `storage.rules` has two match blocks:
`orgs/{orgId}/media/{allPaths=**}` (50MB cap, `useMediaUpload`'s path) and the generic catch-all
`orgs/{orgId}/{allPaths=**}` (25MB cap — `26214400` bytes). A `backgrounds/` prefix does NOT match the
specific `media/` block, so it falls through to the generic block, which already grants read/write to
any org member with **no field- or prefix-specific restriction beyond the org-membership check and the
25MB size cap**. Since the copywriting contract caps background uploads at 10MB client-side (well under
25MB), no rules edit is required. `[VERIFIED: storage.rules:17-45, read directly]`

**Part C — same auth model as `media/`, VERIFIED.** Both blocks gate on the identical
`firestore.exists(.../members/$(request.auth.uid))` check — a background upload is exactly as protected
as an existing audio/video upload, with no new attack surface.

**Consequence for the planner:** the "no rules-testing budget" risk CONTEXT.md flagged does not
materialize. `npm run test:rules` is not needed for this phase — proceed without it, and do not add a
`storage.rules` edit task.

## ★ Research Question 2 — What actually consumes the resolved background

**Traced every consumer of `AssembledSlide`/`resolveGroupMedia`'s output:**

| Consumer | Renders background? | Verified |
|----------|---------------------|----------|
| `PresentationViewer.vue` | **No** — full read of the component (690 lines) shows no `backgroundImageUrl`/`backgroundUrl` reference anywhere; every slide kind renders on a flat `bg-black` root with no per-slide background layer | `[VERIFIED: src/components/PresentationViewer.vue, read directly]` |
| `ServicePrintLayout.vue` | **No** — this component doesn't consume `AssembledSlide` at all; it renders directly from `service.slots` (slot-level summary text for a printable service order, not a slide-by-slide visual) | `[VERIFIED: grep for AssembledSlide/assembleSlideshow — zero matches]` |
| `SlideCard.vue` (grid thumbnail) | **No image compositing** — UI-SPEC §8 deliberately scopes this to a provenance CHIP only (`Background`/`From group`/`From song`), not an actual background-image layer behind the card's existing flat preview | Per UI-SPEC §8, consistent with the phase's stated Phase-35 boundary |
| `EditSlideDrawer.vue`'s `drawer-preview` box | **Yes** — the ONLY surface this phase makes visually render the actual image, via CSS `background-image` on the existing `aspect-video` box at `:81` | `[VERIFIED: src/components/slides/EditSlideDrawer.vue:80-103, read directly — the box exists exactly where UI-SPEC §8 says]` |

**Resolution of the "stored and never rendered" risk the phase brief raised:** it does NOT apply. The
drawer's compact preview box is real, already exists, and is the surface this phase wires up — R055/56/57
are satisfied by (a) the cascade being computed and stored/resolved correctly, (b) the provenance being
visible via the card chip and drawer caption, and (c) the drawer preview actually showing the pixels.
`PresentationViewer.vue` legitimately stays untouched — CONTEXT.md's own scope boundary ("any change to
what a background looks like when presented... is Phase 35") is upheld by the drawer/chip pairing, not
violated by it.

## ★ Research Question 3 — Deleting `audioScope` safely (VERIFIED — exactly one read path, confirmed dead after removal)

**Full grep of `audioScope` across `src/` (excluding tests), verified 2026-08-02:**

| File | Line(s) | What it does |
|------|---------|--------------|
| `src/types/slideGroup.ts` | `:70` | The type field itself — deleted |
| `src/stores/slideGroups.ts` | `:213-215` | The ONE read path — documented in its own comment as existing "only" for round-trip display, feeding no assembler/presenter logic |
| `src/components/slides/EditSlideDrawer.vue` | `:678, :685-699, :932` | Both write routes (`attachSlideAudio` stamps `'slide'`, the group-scope branch stamps `'group'`) and the `resetLocalFields` initializer — all deleted together per R058/CONTEXT.md |
| `src/utils/slideshowAssembler.ts` | *(no match)* | Confirmed via direct read of the full file (405 lines) — `resolveEntryMedia` never references `audioScope`; its precedence is computed purely from `entry.audioUrl` vs `group.bedAudioUrl`, exactly as the "exists only for round-trip display" comment claims |
| `PresentationViewer.vue`, `ServicePrintLayout.vue` | *(no match)* | Confirmed no reference |

**Conclusion: CONTEXT.md's premise is confirmed true, not merely assumed.** `audioScope` has exactly
one write surface (the drawer) and one read surface (the store's round-trip-only branch), and the
resolver that actually decides playback precedence never looks at it. Deleting the field, the drawer's
scope-choice UI, and `slideGroups.ts:213-215` together leaves zero dangling readers.

**R058's premise (group control genuinely covers the case) — also confirmed.** `SlideGroupMusicControl.vue`
already provides a complete attach/preview/remove UI for group-wide bed audio (`:1-156`, full read),
wired into `SlideGrid.vue:73-82` via `canWriteGroupMedia` (which stays available on song groups too —
audio-only there). Removing the drawer's `'group'` scope choice removes a **second, redundant** write
path to the exact same `bedAudioUrl` field the music control already writes via `setGroupBedMedia` — it
is a pure subtraction, no capability gap opens.

**Test impact — 6 test blocks in `EditSlideDrawer.test.ts` reference `audioScope` directly** (lines 838,
849, 871, 890, 894, 906, 920, 1144, 1159, 1592, 1606 — spanning the "Phase 26-08 Task 1" describe block
at `:813-957` and touching the duplicate-copy assertions at `:1144-1159`). The planner should expect to
delete/rewrite this entire describe block, not patch it incrementally — the whole "scope choice and its
two write routes" test group no longer has a subject once the UI is gone.

## ★ Research Question 4 — Splitting `EditSlideDrawer.vue` into two modes

**File size:** `EditSlideDrawer.vue` is 1136 lines; its test file is 1639 lines across **12 describe
blocks** (verified via `grep '^describe('`):

| Describe block (line) | Phase | Belongs to `details` mode | Belongs to `lyrics` mode | Notes |
|---|---|---|---|---|
| Shell (`:211`) | 26-05 T1 | Shared (open/close, focus, Escape) | Shared | Unaffected by the split |
| Label/notes live-apply (`:324`) | 26-05 T3 | `details` | — | Label + Notes both stay in `details` per UI-SPEC §4 table |
| Per-kind Slide Text (`:503`) | 26-07 T1 | `details` (read-only variants) | `details` renders read-only preview; textarea moves | The read-only lyric/copyright/scripture/imported branches ALL stay in `details` per UI-SPEC §4 — only the hand-authored `text`-kind EDITABLE textarea relocates to `lyrics` mode |
| Hand-written slide edited here (`:591`) | 26-07 T2 | — | `lyrics` | This whole block's subject (the editable textarea) moves wholesale |
| Routes away, guarded (`:696`) | 26-07 T3 | `details` (nav links stay, minus the duplicate "Edit in song" button per UI-SPEC §4 — superseded by menu items) | — | Needs re-verification: UI-SPEC says the in-drawer "Edit in song"/"Edit in scripture" LINK BUTTON is removed since the menu now offers the same action — this test block's assertions on that link's presence will need rewriting, not just relocating |
| Audio scope + write routes (`:813`) | 26-08 T1 | **Deleted wholesale** (R058) | — | See Research Question 3 |
| Loop where it means something (`:958`) | 26-08 T2 | `details` (Slide Audio stays, unchanged except scope removal) | — | Kept, minus any scope-dependent setup |
| Missing audio file (`:1027`) | 26-08 T3 | `details` | — | Kept |
| Duplicate (`:1084`) | 26-09 T2 | `details` (footer) | — | Kept, but the copy-assertion at `:1144-1159` references `audioScope` and needs updating to drop that field |
| Delete (`:1227`) | 26-09 T3 | `details` (footer) | — | Kept |
| Song groups read-only (`:1365`) | R054 | `details` (song/copyright rows never open `lyrics`) | N/A | Confirms §3 row 1/7's "no Edit lyrics for song entries" |
| Locked service (`:1528`) | R036 | `details` + `lyrics` (both must respect `canMutate`/`canMutateBackground`) | Both | Needs a NEW assertion set for the background section's own lock behavior (UI-SPEC §11) |

**What would break if the drawer no longer opens on select:** every test in this file that currently
mounts the drawer via a fixture assuming `open: true` is unaffected (they set `open` directly as a
prop) — but any test asserting `SlidesTab.vue`'s `onSelectSlide` behavior (in `SlidesTab.test.ts`) that
checks `drawerOpen` flips true on card selection **will need to be inverted**: after the fix, selecting
a card must NOT open the drawer; only a menu action does.

**Planner guidance:** treat this less as "split one file" and more as "delete ~150 lines (audio-scope
UI + tests), relocate ~30 lines (the editable textarea) to a `lyrics`-mode branch, add ~60 lines (the
Background section, §5), and add a `mode` prop threading through every existing `v-if` in the template."
The component does not need a structural rewrite — the sections UI-SPEC §4's table lists already exist
as separable template blocks (`data-testid="drawer-*-section"` markers), so gating each on `mode` is
mechanical.

## ★ Research Question 5 — The R051 select/edit decoupling

**Confirmed the exact single coupling point.** `SlidesTab.vue:255-258`:
```typescript
function onSelectSlide(slideId: string): void {
  selectedSlideId.value = slideId
  drawerOpen.value = true   // ← THIS line is the R051 coupling; delete it
}
```
This is the ONLY place `drawerOpen` is set true on a plain selection. Two other write sites exist and
must NOT be touched:
- `selectSlideById` (`:265-268`) — the post-duplicate follow-selection handler, which correctly SHOULD
  keep opening the drawer (duplicating a slide implies staying in its details view).
- A new `onMenuAction` handler (to be added) — opens the drawer only when the menu's `select` emit
  carries an `'edit-details'`/`'edit-lyrics'` key.

**Selection itself stays fully intact.** `selectedSlideId` continues to drive:
- The plan rail's active-slide accent (via `SlideCard`'s `:selected` prop, unaffected by this change).
- `SlideGrid.vue`'s drop-target computation (unaffected — reads `selectedSlot`, not `selectedSlideId`).
- `EditSlideDrawer`'s own resolution — the drawer's `entry`/`assembledSlide` props are still derived
  from `selectedSlideId` (`SlidesTab.vue:304-322`), just no longer auto-opened by it.

**Nothing else currently depends on click-opens-drawer.** Grepped `SlideCard.vue`'s only emit
(`select`) — its single consumer is `SlideGrid.vue:137` (`@select="emit('select', $event)"`), which
relays unchanged to `SlidesTab.vue`'s `onSelectSlide`. No second listener anywhere hooks the card's
click for any other purpose (the drag grip already uses `@click.stop` to opt out of selection
entirely, per its existing comment at `SlideCard.vue:47`).

## Lower-Effort Findings

**Existing background-adjacent control shape (`SlideGroupMusicControl.vue`), verified structurally
sound as a sibling mechanical pattern.** Full read confirms: emit-only contract (`attach: [url]` /
`remove: []`), no Firestore write of its own, `useMediaUpload` composable usage, `isEditor`-gated
add/remove, unconditional preview. `BackgroundControl.vue` (UI-SPEC §6) should mirror this shape with
`useBackgroundUpload` swapped in — the emit contract, gating pattern, and "no write inside the
component" rule all transfer directly.

**Song-level control placement in `SongLyricEditor.vue` — verified against live source.** The header
(`:4-27`, `data-testid="lyrics-header"`) contains the `SaveStatusIndicator` (Phase 32) and the
Paste-lyrics/History buttons. UI-SPEC §7's placement — a new bordered row directly below this header,
gated on `v-if="currentLyrics"`, before the loading/empty-state conditional chain that starts at
`:30` — is structurally correct: it must be its own sibling `<div>` between the header (closes `:27`)
and the `v-if="songLyricsStore.isLoading"` branch (`:30`), not nested inside either. The write path
(`songLyricsStore.updateCurrentLyrics(orgId, songId, id, ...)`, called at `:362`) already exists and
handles every other field this editor writes — no new store action needed, only a new field in the
payload.

**Existing dropdown/menu accessibility precedent — confirmed there is exactly one, and it has NO ARIA
semantics.** `ServiceEditorView.vue:1084-1117` ("Add Element" dropdown) is the only prior
click-toggle/backdrop/panel pattern in the codebase (`z-10` backdrop, `z-20` panel, `w-44`/`w-44`-style
fixed width, `px-3 py-2 text-sm` items). A full-codebase grep for `role="menu"`, `aria-haspopup`, and
`role="listbox"` returned **zero matches** anywhere in `src/`. `SlideActionMenu.vue` is therefore the
first real ARIA menu implementation in this project — borrow the visual shell from the Add Element
dropdown, but the `role`/`aria-*` contract is new territory with no in-repo precedent to check against,
only the WAI-ARIA Menu Button pattern (external, not fetched this session — flagged as `[ASSUMED]`
below since the UI-SPEC's own contract, not an externally-verified ARIA spec citation, is what's being
implemented).

**The 8 UI-SPEC `backstop` items — what the code does today, so the planner can write real acceptance criteria:**

| Item | What the code does TODAY (before this phase) | What the planner needs to verify post-implementation |
|---|---|---|
| E1 `partial` — menu list before `planItemKind` resolves | Today there is no menu at all, so this failure mode doesn't yet exist — it is created by this phase. `SlidesTab.vue`'s `selectedSlot` (feeding `planItemKind`) is a computed derived synchronously from already-loaded `props.slots`, so in practice `planItemKind` is never actually `undefined` for a rendered card (the slot the card belongs to is, by construction, already loaded). The backstop is a defensive test, not a reachable-in-production bug — write the test, but do not expect to find a live repro | Unit test: mount `SlideActionMenu` (or call `slideActionMenuItems` directly) with `planItemKind: undefined` and a `text`-kind entry with `body: undefined`; assert the conservative (no "Edit lyrics") list, not the permissive one |
| E1 `overflow` — widest list (4 items) at 200px card width | `SlideGrid.vue:127`'s `minmax(200px,1fr)` is the real, live narrowest card width | Mounted-width test asserting the `w-40` (160px) panel anchored `right-0` never collides with the card's right edge at a 200px container |
| E2 `partial` — Hymn discriminator re-derives on stored-entry change | Today, `sourceRef.body` for a HYMN's auto-derived slide is genuinely `undefined` at creation (`slideshowAssembler.ts:74-77`'s `buildTextContentForSlot` HYMN branch never sets a `body` on the entry — it's derived at assembly time, not stored) and stays that way until a FUTURE write path sets it (no such path exists yet in this phase — it's a forward-compat backstop) | Unit test: a `text`-kind entry's `body` transitioning `undefined → defined` (simulated directly, since no in-phase UI writes it) re-derives the menu list without requiring a remount |
| E2 `overflow` — "Edit in scripture" (17 chars) at `w-40` | No existing text in this drawer/menu today is measured against a fixed-width wrap constraint this precisely — this is a genuinely new concern this phase introduces | Mounted test asserting no menu item's rendered text wraps to two lines at the `w-40` panel width |
| E3 `partial` — slide-level "own" vs "inherited" styling | No prior three-state background control exists to compare against — the closest analog, `SlideGroupMusicControl.vue`, is only ever two-state (set/unset), never three | Unit test on the drawer's Slide Background section: assert `Set for this slide only` never renders when `entry.backgroundImageUrl` is already defined, and `Remove` never renders when it is not |
| E3 `overflow` — long uploaded filename | `SlideGroupMusicControl.vue`'s `truncate text-sm` filename span (`:7`) is the existing precedent for a Storage-URL-derived filename overflow — background reuses `bedAudioLabel`'s decode logic (per UI-SPEC's own citation) with `truncate` on the display span, same idiom | Mounted-width test at the narrowest column width the group/song controls render in |
| E4 `partial` — chip staleness on same reactive tick | `SlideCard.vue`'s existing `hasAudio` chip (`:107`) is derived reactively from `props.assembledSlide.slide.audioUrl`, which recomputes automatically whenever `assembledSlideshow` (an already-reactive computed chain rooted in Firestore snapshots) changes — no manual refresh mechanism exists anywhere in this pipeline today, so the background chip inherits the same reactivity for free IF it is derived the same way (from the already-resolved `AssembledSlide`, never from a locally cached copy) | Test: clearing a group's background (via the store action) while a card with no override renders — assert the chip disappears within the same test's next tick, no manual re-fetch call in the test |
| E3 `long-text` (unresolved) — no filename length cap | Confirmed: `useMediaUpload.ts`'s `sanitizeFileName` (`:37-39`) strips disallowed characters but imposes NO maximum length; the same function will be reused/mirrored by `useBackgroundUpload` | Planner should treat "no upload-time filename length cap" as an accepted assumption per UI-SPEC's own note, not silently add a new cap |

## Common Pitfalls

### Pitfall 1: Copying the video audio-carve-out to background by reflex
**What goes wrong:** A developer sees `resolveEntryMedia`'s `if (entry.sourceRef.kind === 'video') return { audioFromBed: false }` early-return and assumes background should short-circuit the same way.
**Why it happens:** Pattern-matching on the existing code shape without reading CONTEXT.md's explicit
"deliberate divergence" callout.
**How to avoid:** Compute background resolution BEFORE or independently of the video early-return, so a
video entry still gets slide → group → song background resolution. UI-SPEC §9 documents the reasoning
in full; this research confirms the underlying `resolveEntryMedia` function structure that makes the
carve-out trivial to accidentally copy.
**Warning signs:** A test asserting a video slide's `backgroundImageUrl` is always `undefined` — that
test is wrong and should fail code review.

### Pitfall 2: Treating `EditSlideDrawer.vue`'s test file as "split into two files"
**What goes wrong:** Attempting to mechanically divide the 1639-line test file into
`EditSlideDrawer.details.test.ts` / `EditSlideDrawer.lyrics.test.ts` as a first step, before touching
the component.
**Why it happens:** "One component, `mode` prop" naturally suggests "two test suites" by analogy.
**How to avoid:** The component stays ONE file (`EditSlideDrawer.vue`) per CONTEXT.md's explicit
decision — there is no requirement to split the test file into two either. Splitting the test file is a
reasonable optional cleanup, not a load-bearing requirement; the planner should not treat it as blocking
work. Most existing describe blocks (label/notes, audio, duplicate, delete, locked-service) stay in
`details` mode and need no restructuring at all — see the Research Question 4 table for exactly which 2
of 12 blocks actually move or get deleted.

### Pitfall 3: Forgetting `SongLyrics` has no associated document for non-SONG groups
**What goes wrong:** Writing `resolveEntryMedia(group, entry, song)` and calling it uniformly for every
group kind, then dereferencing `song.backgroundImageUrl` unconditionally — `song` is `undefined` for
PRAYER/SCRIPTURE/MESSAGE/HYMN/IMPORTED groups (verified: `assembleSlideshow`'s `emitFromGroup` call site
has no song lookup at all today — only the SONG-kind fallback path at `:316-343` looks up
`inputs.songLyricsById`).
**Why it happens:** The three-level cascade description ("slide → group → song") reads as if every
group always has a song underneath it.
**How to avoid:** `song?.backgroundImageUrl` (optional chaining) at the resolution point, and thread the
song lookup only for `isSongGroup` groups — exactly as UI-SPEC §6 already handles this for the group
control's own `inheritedFrom` prop ("populated ONLY for a SONG group").
**Warning signs:** A crash or `undefined` reference the first time a PRAYER group's background is resolved.

### Pitfall 4: Assuming `firestore.rules` needs a field-level allowlist update
**What goes wrong:** Adding `backgroundImageUrl` write checks to `firestore.rules`' `slideGroups` or
`songs/lyrics` blocks defensively.
**Why it happens:** New fields sometimes require new rule clauses in other codebases.
**How to avoid:** Verified this session — `slideGroups`' `allow update` rule (`firestore.rules:109-112`)
only checks `serviceId` immutability and parent-draft status, no field allowlist. `songs/lyrics`'
`allow read, write: if isOrgEditor(orgId)` (`:133`) is similarly unrestricted by field. **No
`firestore.rules` change is needed for the new `backgroundImageUrl` fields at any of the three levels.**

## Code Examples

### The existing precedent `BackgroundControl.vue` should mirror (verified against live source)
```vue
<!-- Source: src/components/slides/SlideGroupMusicControl.vue (full file read, 2026-08-02) -->
<!-- Emit-only contract — no Firestore write inside the component itself -->
<script setup lang="ts">
import { useMediaUpload } from '@/composables/useMediaUpload'
const emit = defineEmits<{ attach: [url: string]; remove: [] }>()
const { progress, error, isUploading, uploadMedia, reset } = useMediaUpload()
async function onFileSelected(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  reset()
  try {
    const url = await uploadMedia(file, props.orgId)
    emit('attach', url)
  } catch {
    // uploadMedia already set `error` — a failed upload never clears an existing attachment
  }
}
</script>
```
`BackgroundControl.vue` should use `useBackgroundUpload` (new, image-only, 10MB) in place of
`useMediaUpload` (audio/video, 50MB) but keep every other structural element — the emit contract, the
"failed upload emits nothing" rule, the `isEditor`-gated add/remove — identical.

### The one-parameter change needed in the resolver's call site
```typescript
// Source: src/utils/slideshowAssembler.ts:279 (emitFromGroup, existing call site)
// BEFORE:
const media = resolveEntryMedia(group, entry)
// AFTER (song only looked up for SONG-kind groups, per Pitfall 3):
const song = entry.sourceRef.kind === 'lyric' || entry.sourceRef.kind === 'copyright'
  ? inputs.songLyricsById.get(entry.sourceRef.songId)
  : undefined
const media = resolveEntryMedia(group, entry, song)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Slide enters edit mode by clicking the card | Slide enters edit mode only via explicit 3-dot menu action | This phase (R051) | Dragging a slide can no longer accidentally trigger the drawer |
| One `EditSlideDrawer.vue` body for every field | Two modes (`details`/`lyrics`) in the same component | This phase (R052) | Menu items map directly to which fields a user sees, per type |
| Per-slide audio scope toggle (`'slide'`/`'group'`) | Deleted — group-wide audio set only via `SlideGroupMusicControl.vue` | This phase (R058), supersedes R030 | One less redundant write path; `audioScope` field removed entirely |

**Deprecated/outdated:** `GroupSlideEntry.audioScope` — removed this phase, not deprecated-and-kept
(D-19 forbids legacy shims in this area).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The WAI-ARIA "Menu Button" pattern's Escape-closes/no-roving-tabindex shape (as implemented per UI-SPEC §2/Accessibility Note) is an acceptable minimum for this codebase's first real ARIA menu — not independently re-verified against the current WAI-ARIA Authoring Practices spec this session (no web fetch performed; this phase's providers were all unavailable per `init.phase-op`'s `exa_search`/`brave_search`/`firecrawl: false`) | Lower-Effort Findings § "Existing dropdown/menu precedent" | Low — the UI-SPEC's contract (native button, `role="menu"`/`menuitem`, `aria-haspopup`, `aria-expanded`, Escape-only) is a reasonable minimal-viable ARIA menu regardless of exact spec wording, and CONTEXT.md already accepted this as a stated, deliberate gap matching existing codebase precedent (no roving-tabindex anywhere) |
| A2 | `resolveEntryMedia`'s song-lookup parameter (Pitfall 3 / Code Examples) needs to be threaded as a new function parameter rather than resolved some other way (e.g. inside `resolveEntryContent` and passed through `SlideContent`) — this is a design recommendation from this research, not something CONTEXT.md or UI-SPEC specified explicitly | Research Question 3 code example, Pitfall 3 | Low — either threading approach works; the planner has discretion here (CONTEXT.md's discretion list doesn't cover this specific wiring detail, but it's a mechanical implementation choice, not a product decision) |

**If this table is short:** most of this phase's factual claims were verified directly against live
source during this research session (file reads, greps, direct rule-file reads) rather than inferred —
see the inline `[VERIFIED: ...]` tags throughout. The two items above are genuinely LOW-risk judgment
calls, not unverified product claims.

## Open Questions

1. **Should `useBackgroundUpload` share code with `useMediaUpload` via a parameterized factory, or be a fully separate file?**
   - What we know: both need identical resumable-upload/progress/error plumbing, differing only in MIME
     check and size cap and Storage path prefix.
   - What's unclear: whether extracting a shared internal helper is worth the indirection for two call
     sites, or whether copy-with-modification (matching `useMediaUpload.ts`'s own precedent of NOT being
     itself extracted from an earlier upload composable) is more consistent with this codebase's style.
   - Recommendation: copy-with-modification, matching the codebase's existing pattern of one composable
     per media class rather than a generic parameterized uploader — lower risk, and CONTEXT.md's
     discretion list explicitly leaves "upload mechanics" to the planner.

2. **Exact wiring shape of `onMenuAction` in `SlidesTab.vue` for non-drawer items (`duplicate`, `delete`, `edit-in-song`, `edit-in-scripture`).**
   - What we know: `duplicate` and `edit-in-scripture` already have working emit/handler pairs on
     `EditSlideDrawer.vue` today (`emit('duplicate', ...)`, `emit('edit-in-scripture')`) that
     `SlidesTab.vue` already relays correctly.
   - What's unclear: whether the menu's `duplicate`/`delete` items should call the SAME store actions
     the drawer's footer buttons call today (bypassing the drawer's own confirm-delete UI, since the
     drawer isn't open when a menu delete fires), or whether delete-from-menu should open the drawer
     in `details` mode first, showing the confirm block there.
   - Recommendation: UI-SPEC's own menu doesn't sketch a delete-confirmation flow, and 33-CONTEXT.md's
     "Copywriting Contract" table states "Deleting a slide keeps its EXISTING confirm (`deleteSlideConfirmBody`,
     unchanged by this phase)" — this implies delete-from-menu should still route through the drawer's
     existing inline confirm UI (open `details` mode, land on the confirm state), not a separate
     confirmation surface. Flag this for the planner to confirm the exact UX (open-then-confirm vs.
     confirm-inline-in-menu) since UI-SPEC's menu contract doesn't fully specify it.

## Environment Availability

**Skipped — no external dependencies for this phase.** All work is in-repo Vue/TypeScript/Firebase-SDK
code with no new CLI tools, runtimes, or services. `firebase`, `node`, `npm` are all already required
and already available per this project's standing environment (per CLAUDE.md's `.env.local`
requirement, already satisfied in the main checkout this research ran against).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-pinned) + `@vue/test-utils` |
| Config file | `vite.config.ts` (app suite — excludes `src/rules.test.ts`), `vitest.rules.config.ts` (separate rules suite, not needed this phase per Research Question 1) |
| Quick run command | `npx vitest run src/components/slides src/composables/useBackgroundUpload.test.ts src/utils/slideshowAssembler.test.ts src/components/SongLyricEditor.test.ts` |
| Full suite command | `npx vitest run` (excludes `src/rules.test.ts` per `vite.config.ts` — this is EXPECTED per CLAUDE.md, not a gap) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R051 | Clicking a slide card selects but does not open the drawer | unit | `npx vitest run src/components/slides/__tests__/SlidesTab.test.ts -t "select"` | ✅ existing file, needs new/inverted assertions |
| R052 | 3-dot menu offers "Edit details"/"Edit lyrics" as separate drawer modes | unit | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts -t "mode"` | ❌ Wave 0 — new describe block(s) needed |
| R055 | Group background control sets/clears `SlideGroup.backgroundImageUrl` | unit | `npx vitest run src/components/slides/__tests__/BackgroundControl.test.ts` | ❌ Wave 0 |
| R056 | Slide-level background overrides group; cascade resolves slide → group → song; video does NOT suppress background | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts -t "background"` | ❌ Wave 0 — new cases in existing file |
| R057 | Song-level background set from Song Lyrics editor, applies wherever song appears | unit | `npx vitest run src/components/__tests__/SongLyricEditor.test.ts -t "background"` | ❌ Wave 0 — new cases in existing file |
| R058 | `audioScope`/"all slides in group" option removed from per-slide audio | unit | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts -t "audio"` | ✅ existing file — the `:813-957` describe block needs deletion/rewrite |
| R063 | Menu item list varies by `sourceRef.kind`/`planItemKind` per §3's table | unit | `npx vitest run src/components/slides/__tests__/slideDisplay.test.ts -t "slideActionMenuItems"` | ❌ Wave 0 — new pure-function test cases |

### Sampling Rate
- **Per task commit:** the targeted `-t` filtered command for that task's requirement (table above)
- **Per wave merge:** `npx vitest run src/components/slides src/utils/__tests__/slideshowAssembler.test.ts src/components/__tests__/SongLyricEditor.test.ts`
- **Phase gate:** `npm run type-check` (the `vue-tsc --build` form — NOT `-p tsconfig.app.json`, per
  CLAUDE.md's explicit warning that the narrower form silently skips test files and let 5 `TS2339`
  errors survive two phases previously) + full `npx vitest run` green against the documented 2-file/9-test
  baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts` — NOT the obsolete
  10-file `.gsd/` baseline, which no longer exists) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/composables/__tests__/useBackgroundUpload.test.ts` — validate MIME/size rejection, upload
      success path, mirrors `useMediaUpload.test.ts`'s existing structure if that file exists (verify
      before assuming — not confirmed to exist this session; if absent, author both the composable test
      AND its fixture pattern from scratch, following `SlideGroupMusicControl.test.ts`'s mocking approach)
- [ ] `src/components/slides/__tests__/SlideActionMenu.test.ts` — new file, covers open/close, item
      click emits, Escape-closes-and-returns-focus, and the E1/E2 backstop items from the UI Considerations table
- [ ] `src/components/slides/__tests__/BackgroundControl.test.ts` — new file, shared component, tested
      once and reused at both call sites' integration tests
- [ ] Existing `EditSlideDrawer.test.ts`'s `:813-957` describe block ("audio scope and its two write
      routes") — needs deletion/rewrite, not addition
- [ ] Existing `SlidesTab.test.ts` — needs an inverted assertion: selecting a card must NOT set `drawerOpen`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth changes this phase |
| V3 Session Management | No | No session changes this phase |
| V4 Access Control | Yes | Reuses existing `isEditor`/`serviceLocked`/`isSongGroup` composition pattern (`canMutate`, `canWriteGroupMedia`, and the new `canMutateBackground = isEditor && !serviceLocked`, deliberately NOT excluding song groups per UI-SPEC §5) — no new access-control primitive introduced, only new compositions of existing gates |
| V5 Input Validation | Yes | `useBackgroundUpload` mirrors `useMediaUpload`'s client-side MIME (`image/*`) and size (10MB) pre-validation, backstopped server-side by `storage.rules`' 25MB cap + org-membership check (Research Question 1) |
| V6 Cryptography | No | No new crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unrestricted file upload (arbitrary file type/size disguised as an image) | Tampering / Denial of Service | Client-side MIME + size pre-check (defense in depth, not authoritative) backed by `storage.rules`' authoritative 25MB server-side cap — same two-layer pattern `useMediaUpload`/`storage.rules` already establish for audio/video |
| Privilege escalation via a background write bypassing `serviceLocked` | Elevation of Privilege | `canMutateBackground` composes `!serviceLocked` exactly like every other write gate in this drawer — verified no new bypass path is introduced; UI-SPEC §5 explicitly calls out this gate as deliberately DIFFERENT from `canMutate` (it does NOT exclude song groups) and flags it for reviewer attention so it isn't mistakenly "fixed" to match the surrounding pattern |
| XSS via a user-uploaded filename rendered as text | Tampering | Vue's default text interpolation (`{{ }}`) auto-escapes; no `v-html` is used anywhere in the new markup (verified against UI-SPEC's own component contracts §2/§5/§6/§7 — all use `{{ }}` interpolation, never `v-html`) |

## Sources

### Primary (HIGH confidence — direct file reads/greps against live source this session)
- `src/utils/slideshowAssembler.ts` (full file, 405 lines) — resolver structure, video carve-out, `AssemblyInputs` shape
- `src/types/slide.ts`, `src/types/slideGroup.ts`, `src/types/songLyrics.ts` (relevant sections) — model shapes and insertion points
- `functions/src/index.ts` (`cleanupExpiredMedia` region, lines 139-310) — `MEDIA_PATH_GUARD` regex, dry-run safety gate
- `storage.rules` (full file, 46 lines) — both match blocks, size caps, auth checks
- `firestore.rules` (lines 85-155) — `slideGroups`/`songs/lyrics` write rules, no field allowlist
- `src/composables/useMediaUpload.ts` (full file, 119 lines) — the composable `useBackgroundUpload` mirrors
- `src/components/slides/SlideCard.vue`, `SlideGroupMusicControl.vue`, `SlideGrid.vue`, `SlidesTab.vue`, `EditSlideDrawer.vue` (all fully or substantially read) — every claim above about line numbers, gates, and coupling points verified directly
- `src/components/SongLyricEditor.vue` (header + write-path regions) — placement and `updateCurrentLyrics` confirmed
- `src/components/PresentationViewer.vue` (full file, 690 lines) — confirmed no background rendering exists
- `src/components/ServicePrintLayout.vue` (header region) — confirmed no `AssembledSlide` consumption
- `src/components/slides/slideDisplay.ts` (full file) — existing pure-helper convention confirmed
- `src/views/ServiceEditorView.vue` (Add Element dropdown region, lines 1084-1117) — sole existing dropdown precedent, confirmed no ARIA
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` (structure grep, 1639 lines / 12 describe blocks)
- `.planning/config.json`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `33-CONTEXT.md`, `33-UI-SPEC.md` — all read in full

### Secondary (MEDIUM confidence)
- None this session — no external documentation lookups were performed (no new libraries; research-plan
  seam providers were all unavailable per `init.phase-op`'s output, and none were needed for an
  internal-codebase-only phase).

### Tertiary (LOW confidence)
- A1 in the Assumptions Log (WAI-ARIA Menu Button pattern conformance, not independently re-verified against current spec text this session).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, every pattern verified against live source
- Architecture: HIGH — the resolver extension point, drawer mode split, and menu component are all
  verified against real line numbers, not inferred from the UI-SPEC alone
- Pitfalls: HIGH — all four pitfalls trace to specific verified code (the video carve-out, the
  non-existent song lookup for non-SONG groups, the rules-file read confirming no field allowlist)

**Research date:** 2026-08-02
**Valid until:** 30 days (stable internal codebase, no fast-moving external dependency)
