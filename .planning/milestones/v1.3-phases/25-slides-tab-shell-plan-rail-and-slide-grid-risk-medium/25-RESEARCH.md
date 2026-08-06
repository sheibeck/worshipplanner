# Phase 25: Slides Tab Shell — Plan Rail and Slide Grid - Research

**Researched:** 2026-07-26
**Domain:** Vue 3 SPA UI over a brand-new (Phase 24), never-exercised persisted data layer — slide
groups, lazy materialization/reconciliation, drag-reorder, file-drop import.
**Confidence:** HIGH (every claim below is grounded by directly reading the actual Phase 24 source
and its tests — this is not a generic-framework research task; the external ecosystem surface is
zero new packages).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mockup-vs-locked-decision conflicts** — Phase 24 wins wherever the ROADMAP prose / mockup disagree:
- **D-01** — No `UNANCHORED` block. Omitted entirely; Phase 24 D-03 made every group belong to a
  plan item, so orphans cannot exist. Explicitly deferred for later revisit (user, 2026-07-25).
- **D-02** — No page-level `⇪ Import` header button. Cut as redundant with the per-group action and
  the grid drop target.
- **D-03** — No `Generate missing slides` header button. Obsolete under Phase 24 D-02.
- **D-04** — Rail note reads "order locked ⇄ Service Order" now (anticipates Phase 27's tab rename;
  the tab *button* itself stays "Slides" this phase).

**Plan rail behaviour and states:**
- **D-05** — First group in plan order is auto-selected when the Slides tab opens.
- **D-06** — No drag affordance on the rail at all. Not draggable and must not look draggable.
- **D-07** — Empty service shows a rail empty state pointing at the Service Order tab.
- **D-08** — Zero-slide groups are shown with count `0`; grid renders empty state + drop target.

**Slide grid — cards and density:**
- **D-09** — Ship Grid only; defer the `List` view.
- **D-10** — Card content is text body + kind badge + slide number + label + audio chip. True
  formatted-slide rendering remains deferred.
- **D-11** — Slides ARE drag-reorderable within their group (the one place drag is correct on this
  tab; the rail is not).
- **D-12** — Clicking a card sets selection state and wires the seam Phase 26 fills. No drawer
  renders yet, but the click must not be a dead click.

**Drop target and import:**
- **D-13** — A dedicated drop tile at the end of the grid, plus a whole-grid highlight on dragover.
- **D-14** — Accept PPTX, images, video AND audio. Audio is special: attaches as the group bed, does
  not append a slide.
- **D-15** — Reuse `PptxImportModal.vue` from Phase 21 for the PPTX path rather than a second import
  implementation.
- **D-16** — Imports append at the END of the selected group (R032's exact words), not at the
  current selection point.

### Claude's Discretion

Component decomposition (single `SlidesTab.vue` vs rail/grid/card split), how selection state is held
and shared with the future drawer, grid CSS layout and responsive breakpoints, drag-reorder library
choice (SortableJS is already used for the slot list — reuse is preferred but not mandated), empty-
state copy, and how the drop target distinguishes the four accepted file types.

### Deferred Ideas (OUT OF SCOPE)

- `UNANCHORED` / orphaned slides and reassignment — needs an orphan model D-03 deliberately removed.
- `List` view toggle — unrequired scope under R031.
- Formatted slide rendering on cards — showing real slide visuals rather than text bodies.
- Page-level `⇪ Import` and `Generate missing slides` header buttons — cut, see D-02/D-03.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R031 | A Slides tab where all slide editing lives — a plan rail mirroring service order (not draggable) plus a slide grid for the selected group. | Architecture Patterns §1-2 (rail/grid data flow), Pattern 3 (selection→grid filter), Code Examples §1-2 |
| R032 | A slide deck, image, video or audio file can be added at any point in the service — imports and media append to the selected group. | Architecture Patterns §4-6 (PptxImportModal reuse gap, video-slide data-model gap, audio/video-to-bed path), Common Pitfalls §5-7 |
| R018 (supporting) | Polished, intuitive editor UX for non-technical volunteers. | Common Pitfalls (id-churn flicker, pending-reconciliation visibility), UI-SPEC's copy/a11y contract (already approved, out of this doc's scope to re-litigate) |

</phase_requirements>

## Summary

Phase 24 shipped a complete, code-reviewed data layer (`useSlideGroups` store, the pure
`slideGroupMaterializer.ts`, and the group-aware `slideshowAssembler.ts`/`useSlideshowAssembly.ts`)
but it has never been driven by a real UI. Phase 25's job is almost entirely about correctly meeting
that layer as its first real consumer — not about inventing new Vue patterns. Three concrete,
previously-undocumented seam gaps surfaced during this research and are the highest-value findings
for the planner:

1. **`useSlideshowAssembly` has no "slides of one group" getter.** It returns a flat, all-slots
   `assembledSlideshow: AssembledSlide[]` (each entry carries `slotIndex`, and only entries resolved
   from a materialized group also carry `groupId`/`groupSlideId`). The grid must derive "this group's
   slides" itself by filtering on `slotIndex === (the selected slot's current array index)` — filtering
   by `groupId` alone silently drops the pre-materialization fallback window (see Pattern 2).
2. **`PptxImportModal.vue`'s existing confirm handler creates a brand-new plan item** (a new
   `ImportedSlot` + `ImportedDeck`), not an append to an existing group. D-15's "reuse" instruction
   and D-16's "append to the selected group" instruction are both real, but satisfying both means
   Phase 25 must intercept the modal's `confirmed` event differently than `ServiceEditorView.vue`
   does today — read the newly created deck's slides and mint new `GroupSlideEntry` objects onto the
   *selected group*, not call `createSlot('IMPORTED', ...)` (see Pattern 4 / Pitfall 5).
3. **There is no `VideoSlide` content kind anywhere in this codebase.** `SlideContentKind` reserves
   the literal `'video'`, but no interface implements it and `ImportedDeck.slides` is typed
   `(TextSlide | ImageSlide)[]` only. Phase 24's `resolveEntryMedia` states plainly that "video has no
   per-slide layer" — video is bed-only, by design. The UI-SPEC's copy line ("PPTX, image, and video
   appends a slide") is written against a data model that cannot do that for video today. See Pattern
   5 / Open Question 1 for the recommended resolution (treat dropped video like audio: set the group
   bed, don't append a slide).

**Primary recommendation:** Build the rail and grid as thin, prop-driven views over data
`ServiceEditorView.vue` already assembles (it is the SOLE owner of `useSlideshowAssembly()` — child
components must never call it a second time); route every slide/bed mutation through the existing
`useSlideGroups()` store actions (`replaceGroupSlides`, `setGroupBedMedia`) exactly as `24-06`
already does for slot-media retargeting; reuse `PptxImportModal.vue`, `useMediaUpload`, `AudioPlayer`,
and the existing `SortableJS` handle/draggable pattern verbatim rather than rebuilding any of them;
and treat dropped video as bed media (like audio), not as an appended slide, given the current
absence of a per-slide video content kind.

## Architectural Responsibility Map

This is a client-side Firebase SPA — there is no SSR tier. "Backend" here means Cloud Functions
(`parsePptx`) and Firestore/Storage, not an app server.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan rail rendering + selection | Browser/Client | Database/Storage | Vue component renders reactive Pinia state; `slideGroups`' `onSnapshot` (Database/Storage) feeds it live, no server round-trip on click |
| Slide grid rendering (cards) | Browser/Client | Database/Storage | `assembledSlideshow` is a pure client-side computed over Firestore-backed stores; nothing renders server-side |
| Slide reorder (drag, D-11) | Browser/Client | Database/Storage | SortableJS drag is 100% client; the reindexed array is written via `replaceGroupSlides` (Database/Storage) |
| PPTX import (D-15/D-16) | Browser/Client | API/Backend + Database/Storage | Client uploads to Storage; the `parsePptx` Cloud Function (API/Backend) does server-side extraction; result persists to Firestore |
| Image/video/audio drop (D-14) | Browser/Client | Database/Storage | Direct client upload via `useMediaUpload`/`pptxUpload.ts` to Storage, then a Firestore write (`setGroupBedMedia` or an `ImportedDeck`) |
| Pending-reconciliation surfacing | Browser/Client | Database/Storage | `pendingReconciliations` is a synchronous computed already returned by `useSlideshowAssembly`; Phase 25 only needs to render it, not compute it |

## Standard Stack

No new external packages this phase. Every capability is met by code already shipped in this
repository — introducing a second drag library, a second file-upload composable, or a second import
modal would be the "Don't Hand-Roll" violation this section exists to prevent.

### Core (existing, reused verbatim)
| Component/Module | Location | Purpose | Why Standard Here |
|---|---|---|---|
| `sortablejs` v1.15.7 [VERIFIED: package.json] | `package.json` dependency | Drag-reorder | Already the app's ONE drag library (Phase 20-04's slot list); D-11 is "the one place drag is correct on this tab" — reuse the identical `handle`/`draggable` scoping pattern |
| `useSlideGroups()` | `src/stores/slideGroups.ts` | ALL group writes (materialize/delete/bed-media/slide-replace) | "The ONLY module... that talks to Firestore about groups" per its own header comment — every write in this phase must ride these four actions, never a new path |
| `useSlideshowAssembly()` | `src/composables/useSlideshowAssembly.ts` | Assembled slideshow, `groupsBySlotId`, `pendingReconciliations`, lazy materialization | Already the SOLE org-scoped subscription owner for the whole `ServiceEditorView` page (see Pitfall 1) |
| `PptxImportModal.vue` | `src/components/PptxImportModal.vue` | PPTX + direct-image import UI, upload, server parse, preview, confirm | D-15 mandates reuse; needs a small additive extension for drag-and-drop hand-off (Pitfall 5) |
| `useMediaUpload()` | `src/composables/useMediaUpload.ts` | Validated audio/video upload to `orgs/{orgId}/media/{id}/{name}` | Already validates MIME (`audio/*`/`video/*`) and the 50MB cap; reused unchanged for the drop tile's audio/video paths |
| `AudioPlayer.vue` | `src/components/AudioPlayer.vue` | Audio preview, gained `loop` prop in 24-04 | Group-music preview control (`▶ Preview group music`) |
| `SlotMediaAttachment.vue` | `src/components/SlotMediaAttachment.vue` | Existing attach/preview/remove control, retargeted at the group bed in 24-06 | Explicit starting point per CONTEXT for the "Music for this group" control |

### Supporting
| Library | Purpose | When to Use |
|---|---|---|
| Native HTML5 Drag and Drop (`dragenter`/`dragover`/`drop`, `DataTransfer.files`) | Whole-grid dragover highlight + drop tile (D-13) | No library needed — standard browser API already used nowhere else in this codebase for file drop, but is the correct baseline tool here (no new dependency) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Reusing SortableJS's existing `handle`/`draggable` pattern | A dedicated card-grid drag library (e.g. `vuedraggable`) | Would add a second drag dependency for a single-container reorder use case SortableJS already solves identically elsewhere in this app — rejected, matches "Claude's Discretion" wording ("reuse is preferred") |

**Installation:** None — no `npm install` needed this phase.

## Package Legitimacy Audit

Not applicable — this phase installs zero new packages. `sortablejs` (^1.15.7) and
`@types/sortablejs` (^1.15.9) are pre-existing dependencies from Phase 20, already vetted and in
production use. No package legitimacy check is required.

## Architecture Patterns

### System Architecture Diagram

```
                         ServiceEditorView.vue (SOLE owner)
                         ─────────────────────────────────
                         useSlideGroups()  ──┐
                         useSlideshowAssembly()│  (org-scoped onSnapshot subscriptions:
                              │                │   scriptureSlides, importedSlides, slideGroups)
                              │                │
        ┌─────────────────────┴────────────────┴─────────────────┐
        │  assembledSlideshow (flat, all slots)                   │
        │  groupsBySlotId: Map<slotId, SlideGroup>                │
        │  pendingReconciliations: PendingReconciliation[]        │
        │  localService.slots (position-ordered, stable slot ids)│
        └─────────────────────────┬────────────────────────────────┘
                                   │ props (one-way data down)
                                   ▼
                    ┌──────────────────────────────┐
                    │  SlidesTab.vue (new, Phase 25) │
                    └──────────────┬───────────────┘
                    ┌──────────────┴───────────────┐
                    ▼                               ▼
          PlanRail.vue (new)                SlideGrid.vue (new)
          - iterates localService.slots      - selectedSlotId ──► look up
            in position order                  slot's CURRENT array index
          - looks up groupsBySlotId.get(id)    in localService.slots
            for count/bed/kind                - filter assembledSlideshow
          - click ⇒ emit('select', slotId)      by slotIndex === that index
          - NO drag (D-06)                    - render SlideCard.vue per entry
                                               - drag-reorder (SortableJS,
                                                 handle: '.drag-handle',
                                                 draggable: '.slide-card')
                                               - on drop ⇒ reindex ⇒
                                                 slideGroupsStore
                                                   .replaceGroupSlides(
                                                     orgId, selectedSlotId,
                                                     reindexed entries)
                                               - drop-tile / whole-grid
                                                 dragover ⇒ route by file
                                                 MIME (Pattern 4/5)
                                               - pendingReconciliations
                                                 .find(p => p.slotId ===
                                                   selectedSlotId) ⇒
                                                 passive banner (Pattern 6)
```

Reading the primary use case: a user opens the Slides tab → `ServiceEditorView` (already mounted,
already subscribed) hands the rail its ordered slot list + group map → the rail auto-selects the
first group (D-05) → the grid filters the ALREADY-COMPUTED `assembledSlideshow` down to that one
group's slides → user drags a card → `SlideGrid` calls the store action directly → Firestore
`onSnapshot` round-trips the write back through `groupsBySlotId` → `assembledSlideshow` recomputes →
the grid re-renders. No new subscription, no new save path, no new drag library.

### Recommended Project Structure
```
src/
├── components/
│   ├── slides/                      # new folder for this phase's components (discretion: naming)
│   │   ├── SlidesTab.vue            # third tab panel, mounted under v-show="activeTab === 'slides'"
│   │   ├── PlanRail.vue             # rail: kind badge, count, title, bed line, empty state
│   │   ├── SlideGrid.vue            # grid: header, cards, drop tile, group-music control
│   │   └── SlideCard.vue            # one card: badge/body/number/label/audio chip/drag handle
│   ├── PptxImportModal.vue          # EXISTING — reused, small additive extension (Pitfall 5)
│   ├── SlotMediaAttachment.vue      # EXISTING — building block for "Music for this group"
│   └── AudioPlayer.vue              # EXISTING — group-music preview
```
(Single-file `SlidesTab.vue` with no sub-split is equally valid — this is explicit Claude's
Discretion. The split above is recommended only because the rail/grid/card boundary maps cleanly
onto D-06 vs D-11's opposite drag rules, which is easier to enforce in review as separate files.)

### Pattern 1: ServiceEditorView is the sole `useSlideshowAssembly()` owner

**What:** Only `ServiceEditorView.vue` calls `useSlideshowAssembly(...)`. Every new Slides-tab
component receives `assembledSlideshow`, `groupsBySlotId`, and `pendingReconciliations` as **props**
(or via `provide`/`inject` if the tree gets deep) — never by calling the composable again themselves.

**When to use:** Always, for this phase.

**Why (verified precedent):** `21-06`'s locked decision states this explicitly for a sibling
component: *"`ImportedSlideEditor` omits store `subscribeDecks`/`unsubscribeDecks` — `useSlideshowAssembly` already owns a single org-scoped `importedSlides` subscription for the whole `ServiceEditorView` page; a per-editor unsubscribe would tear that down and break the live Slideshow Preview."* Calling `useSlideshowAssembly()` a second time in a child component would not break the Pinia store subscriptions (those are store-level and deduped by `subscribedOrgId`), but it WOULD instantiate a second, independent copy of the composable's own local reactive state — its own `materializingSlotIds` Set, its own `pendingReconciliationsMap`, its own `watch()`/`onUnmounted()` lifecycle tied to the child's mount/unmount — running redundant materialize/reconcile watchers.

```typescript
// Source: src/composables/useSlideshowAssembly.ts (read directly, Phase 25 research)
// ServiceEditorView.vue line 1460-1465 — the ONE call site:
const orgIdRef = computed(() => authStore.orgId)
const {
  assembledSections,
  assembledSlideshow,
  isLoading: slideshowLoading,   // NOTE: this is the LYRICS-loading flag only — see Pitfall 3
  groupsBySlotId,
} = useSlideshowAssembly(localService, orgIdRef, { canWrite: computed(() => authStore.isEditor) })
```

Writes are different: `useSlideGroups()` (the Pinia store, not the composable) IS safe to call
directly from a child component — it is a plain singleton store, exactly like `ServiceEditorView`
already does for `slideGroupsStore.deleteGroup(...)` / `setGroupBedMedia(...)`.

### Pattern 2: Deriving "the slides of the currently selected group"

**What:** `useSlideshowAssembly` returns one flat array, `assembledSlideshow: AssembledSlide[]`, for
the WHOLE service — there is no per-group getter. Each entry carries `slotIndex` (the slot's array
index in `service.slots`, captured BEFORE position-sorting) always; it carries `groupId`/`groupSlideId`
ONLY when resolved via the group-aware path (`emitFromGroup` in `slideshowAssembler.ts`).

**The concrete answer:** filter by `slotIndex`, not by `groupId`.

```typescript
// Source: src/utils/slideshowAssembler.ts (read directly) — emitFallback (no group yet) sets
// only slotIndex; emitFromGroup (materialized) sets slotIndex AND groupId/groupSlideId. Filtering
// on groupId alone would show nothing during the brief window before the group document's
// onSnapshot round-trip lands — even though the fallback path already renders real content.
const selectedSlotIndex = computed(() =>
  localService.value?.slots.findIndex((s) => s.id === selectedSlotId.value) ?? -1
)
const selectedGroupSlides = computed(() =>
  selectedSlotIndex.value === -1
    ? []
    : assembledSlideshow.value.filter((s) => s.slotIndex === selectedSlotIndex.value)
)
```

**Why this matters:** the D-08 "zero-slide group" empty state and the "loading" skeleton state both
depend on this being correct. A slot whose group hasn't materialized yet (a SONG slot with no song
assigned) legitimately produces zero fallback-path slides too — `deriveGroupEntries`'s SONG branch
returns `[]` when `songId` is null, and `materializationCandidates` skips creating a group at all for
a zero-slide result (D-02: "groups are always populated... by not creating a document at all, not by
creating an empty one"). So `selectedGroupSlides.value.length === 0` is the correct, single test for
D-08's empty state regardless of whether a group document exists yet.

### Pattern 3: `groupsBySlotId` for rail metadata; two DIFFERENT `isLoading` flags exist

**What:** The rail's kind badge/count/bed-line data comes from `groupsBySlotId.get(slot.id)` — a
`SlideGroup | undefined`. `group.slides.length` is the count (D-08 shows `0` rather than hiding the
row); `group.bedAudioUrl`/`group.bedVideoUrl` gate the `♪ group music` line.

**The gotcha:** `useSlideshowAssembly()`'s returned `isLoading` ref is **only the per-song lyrics
loader's** loading state (`ref(false)`, toggled around `loadMissingLyrics`) — it does **not** include
`useSlideGroups()`'s own `isLoading` (true until the org-scoped `slideGroups` collection's first
`onSnapshot` fires). For the rail's D-07-adjacent loading/skeleton state, call `useSlideGroups()`
directly (it's the same singleton store `ServiceEditorView` already imports as `slideGroupsStore`)
and read `.isLoading` from it — do not assume the composable's `isLoading` covers group-subscription
loading, it does not.

### Pattern 4: PptxImportModal's existing confirm path creates a NEW plan item — Phase 25 needs a different handler

**What:** Today, `ServiceEditorView.vue`'s `onImportConfirmed` (the modal's ONLY existing caller)
does this:

```typescript
// Source: src/views/ServiceEditorView.vue lines 1342-1349 (existing, unchanged code)
function onImportConfirmed(payload: { importId: string; section: ServiceSection }) {
  if (!localService.value) return
  const newSlot = createSlot('IMPORTED', undefined, payload.section) as ImportedSlot
  newSlot.importId = payload.importId
  localService.value.slots.push(newSlot)          // <- creates a BRAND NEW plan item
  localService.value.slots = reindexSlots(localService.value.slots)
  showImportModal.value = false
}
```

This is exactly the wrong shape for D-16 ("imports append to the SELECTED group"). D-15 says reuse
the modal; it does not say reuse this handler. The modal's `createDeck()` call (inside
`onConfirm()`, `src/components/PptxImportModal.vue`) already persists a real `ImportedDeck` document
with real, individually-addressable `slides: (TextSlide | ImageSlide)[]` (each with its own stable
`id`, minted via `crypto.randomUUID()` at import time). Phase 25's `confirmed` handler must instead:

```typescript
// Recommended pattern (not existing code — composed from verified store/type contracts):
async function onGroupImportConfirmed(payload: { importId: string; section: ServiceSection }) {
  const group = groupsBySlotId.value.get(selectedSlotId.value)
  const deck = await importedSlidesStore.getDeck(authStore.orgId!, payload.importId) // src/stores/importedSlides.ts
  if (!group || !deck) return
  const startOrder = group.slides.length > 0
    ? Math.max(...group.slides.map((e) => e.order)) + 1
    : 0
  const newEntries: GroupSlideEntry[] = deck.slides.map((innerSlide, i) => ({
    id: crypto.randomUUID(),
    order: startOrder + i,
    sourceRef: { kind: 'imported', importId: payload.importId, innerSlideId: innerSlide.id },
  }))
  await slideGroupsStore.replaceGroupSlides(
    authStore.orgId!,
    selectedSlotId.value,
    [...group.slides, ...newEntries],
    group.sourceSignature, // unchanged — this write does not touch the group's reconciliation signature
  )
  showImportModal.value = false
}
```

No new `ImportedSlot` is created and `createSlot`/`reindexSlots` are never called for this path — the
plan (rail) is completely untouched by an import; only the selected group's `slides` array grows.
`PptxImportModal`'s required `section` prop can be satisfied with the selected slot's own `section`
(it is a required prop of the modal regardless, used only for the `ImportedDeck.section` field — it
has no bearing on which group the entries land in).

### Pattern 5: Video has no per-slide content kind — treat a dropped video like audio (bed only)

**What:** `SlideContentKind` (`src/types/slide.ts`) declares the literal type member `'video'`, but
**no interface implements it** — `Slide = LyricSlide | CopyrightSlide | ScriptureSlide | TextSlide |
ImageSlide` has five members, not six, and `ImportedDeck.slides` is typed
`(TextSlide | ImageSlide)[]` only (`src/types/importedDeck.ts`). `GroupSlideEntry.sourceRef`
(`src/types/slideGroup.ts`) has exactly five kinds — `lyric | copyright | scripture | imported |
text` — none of which can represent a standalone video slide. `resolveEntryMedia`
(`slideshowAssembler.ts`) states the design intent directly in its own comment: *"Video has no
per-slide layer (Pattern 4) — it is always the group bed."*

**Conflict:** the UI-SPEC's approved copy (Copywriting Contract) reads *"PPTX, image, and video
appends a slide · audio sets this group's music."* That line is correct for PPTX/image but not
achievable for video against the current, locked (already-shipped) Phase 24 data model — a video
slide-kind, an `ImportedDeck` video member, and assembler support would all need to be added, which
is out of a "shell" phase's scope and not something Phase 24 anticipated.

**Recommended resolution (flagged, not silently decided — see Open Question 1):** route a dropped
video file through the SAME path as audio — `useMediaUpload().uploadMedia(file, orgId)` (already
validates `video/*`, already enforces the 50MB cap) followed by
`slideGroupsStore.setGroupBedMedia(orgId, selectedSlotId, { serviceId, bedVideoUrl: url })`. This
sets the group's video bed (already rendered across the whole group by `PresentationViewer`, per
Phase 23), rather than attempting to append a slide the data model cannot represent. The drop-tile
subtext copy would then need a one-line correction (owner sign-off, since the UI-SPEC is otherwise
already approved) to `"PPTX and image append a slide · video and audio set this group's music"` — or
equivalent. Do not invent a `VideoSlide` type to satisfy the existing copy inside this phase; that is
new data-model surface area belonging to a dedicated phase, not a shell UI phase.

### Pattern 6: `pendingReconciliations` — the real Phase 24/26 seam

**What:** `useSlideshowAssembly()` already computes and exposes `pendingReconciliations:
PendingReconciliation[]` (`{ slotId, proposed: GroupSlideEntry[], loss?: {...} }`). Its own doc
comment states the contract explicitly: *"A confirm-required reconciliation... this phase ships the
state, not the dialog"* (written by 24-05, referring to Phase 26 building the dialog).

**What Phase 25 should do (defensible middle ground, since no locked decision covers this):** when
`pendingReconciliations.value.find(p => p.slotId === selectedSlotId.value)` is truthy for the
CURRENTLY SELECTED group, render a small, passive, non-blocking banner in the grid header area (e.g.
*"This group's source changed since it was set up — N slide(s) may need review. (Coming soon.)"*,
using the entry's `loss.customizedEntries` count) — and otherwise change nothing about the grid's
behavior. Concretely:
- **Do not** build any apply/reject affordance — that is explicitly Phase 26 scope (R033).
- **Do not** block drag-reorder or card selection while a reconciliation is pending — the underlying
  `group.slides` used by `assembledSlideshow` is deliberately left untouched by the reconciler when
  `needsConfirm: true` (`reconcileUnstableIdGroup` returns `slides: group.slides`, the STORED value,
  not the proposed one) — so the grid is still showing a real, valid, currently-correct slide list;
  there is nothing unsafe about continuing to reorder or select within it.
- **Do not** silently drop this state — R018 ("polished, intuitive... zero training") is violated by
  a grid that quietly renders stale content with no visible signal at all.

This is flagged as an assumption for user confirmation (Assumptions Log A1) rather than presented as
a locked decision, since neither `25-CONTEXT.md` nor the UI-SPEC mentions `pendingReconciliations` at
all — the gap is real and this is the most defensible resolution available, not an invented one.

### Pattern 7: SortableJS handle/draggable scoping (exact existing pattern to copy for D-11)

**What:** The existing slot list (`ServiceEditorView.vue` lines ~1488-1537) is the ONLY prior
SortableJS usage in this codebase. Copy its shape exactly for the slide-card grid, per D-11 (this
mirrors what the UI-SPEC's "Drag library" row already specifies).

```typescript
// Source: src/views/ServiceEditorView.vue (existing, read directly) — the pattern to replicate
// for SlideGrid.vue's card container (D-11), with '.slide-card'/'.drag-handle' substituted in.
watch(gridContainerRef, (el) => {
  if (el && !sortableInstance) {
    sortableInstance = Sortable.create(el, {
      handle: '.drag-handle',          // D-11: grip icon only, NOT whole-card drag
      draggable: '.slide-card',        // scopes BOTH eligibility AND oldIndex/newIndex math;
                                        // the drop tile must NOT carry this class (D-13: it is
                                        // always last and never reorderable)
      animation: 150,
      ghostClass: 'opacity-30',
      async onEnd(evt) {
        if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
        // Revert SortableJS's own DOM move so Vue's re-render is the single source of truth
        // (prevents the snap-back flash) — copy this exact revert dance verbatim:
        const parent = evt.item.parentNode
        if (parent) {
          const ref = parent.children[evt.oldIndex]
          parent.insertBefore(evt.item, evt.oldIndex < evt.newIndex ? ref?.nextSibling ?? null : ref ?? null)
        }
        const entries = [...group.slides]
        const moved = entries.splice(evt.oldIndex, 1)[0]
        if (!moved) return
        entries.splice(evt.newIndex, 0, moved)
        const reindexed = entries.map((e, i) => ({ ...e, order: i }))
        await slideGroupsStore.replaceGroupSlides(orgId, group.slotId, reindexed, group.sourceSignature)
      },
    })
  }
}, { flush: 'post' })
```

Unlike the existing slot-list reorder (which writes through `serviceStore.updateService` immediately,
bypassing the 800ms debounce, per its own D-15 comment), slide reorder writes through
`replaceGroupSlides` directly — there is no separate "immediate vs debounced" concern here since
`replaceGroupSlides` was never part of the `localService` autosave watch to begin with.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Drag-reorder for slide cards | A second drag library or hand-rolled pointer-event dragging | `sortablejs` with the exact `handle`/`draggable` scoping pattern above (Pattern 7) | Already solved, tested, and battle-hardened in this codebase for an identical single-container reorder use case |
| PPTX/image import | A second parse/preview/confirm flow | `PptxImportModal.vue` + a small `defineExpose` extension (Pitfall 5) | D-15 explicitly forbids a second implementation; the server-side `parsePptx` Cloud Function and `ImportedDeck` persistence are non-trivial and already correct |
| Audio/video upload + validation | A new upload composable | `useMediaUpload()` (already validates MIME + 50MB cap against `storage.rules`' matching ceiling) | Client-side validation must mirror the server rule exactly, and it already does — re-deriving the cap risks drift |
| Group writes (materialize/delete/bed/slides) | Direct Firestore calls from a new component | `useSlideGroups()` store actions only | The store's own header comment states it is "the ONLY module... that talks to Firestore about groups" specifically to prevent a second, competing save path (R018) |
| "Slides of the selected group" derivation | A new Firestore query or a new store getter | Filter the EXISTING `assembledSlideshow` by `slotIndex` (Pattern 2) | The composable already computes the full assembled array reactively; a second query would double-subscribe and could desync from the live preview |

**Key insight:** every "don't hand-roll" item above exists NOT because a generic library solves it
better, but because this SPECIFIC codebase already solved it correctly one phase or one component
ago — the risk in Phase 25 is re-deriving a slightly-different, slightly-wrong second version of
something that already works, not picking the wrong npm package.

## Common Pitfalls

### Pitfall 1: Calling `useSlideshowAssembly()` a second time in a child component
**What goes wrong:** A second composable instance runs its own materialize/reconcile watchers
redundantly (store-level dedup means no data corruption, but wasted writes/reads and two independent
`pendingReconciliationsMap`s that could disagree transiently).
**Why it happens:** Composables are easy to import anywhere; nothing stops a second call.
**How to avoid:** Pass `assembledSlideshow`/`groupsBySlotId`/`pendingReconciliations` down as props
from `ServiceEditorView.vue` (Pattern 1).
**Warning signs:** A new component importing `useSlideshowAssembly` at all.

### Pitfall 2: Filtering by `groupId` instead of `slotIndex`
**What goes wrong:** The grid appears empty for a slot whose group hasn't materialized yet, even
though the fallback-path assembler is already producing real slides for it.
**Why it happens:** `groupId` looks like the "correct" join key since it literally equals the slot's
group, but it's only set on the group-resolved emission path (Pattern 2).
**How to avoid:** Filter `assembledSlideshow` by `slotIndex === selectedSlot's array index` (works on
both paths).
**Warning signs:** A newly-added SONG slot with a song just assigned shows an empty grid for a beat
before "catching up."

### Pitfall 3: Assuming the composable's `isLoading` covers group-subscription loading
**What goes wrong:** The rail's skeleton/loading state never shows (or shows for the wrong duration)
because `useSlideshowAssembly().isLoading` only reflects the lyrics loader.
**How to avoid:** Read `useSlideGroups().isLoading` directly for group-subscription loading state
(Pattern 3).

### Pitfall 4: Slide id churn on materialization causes a visible re-key flicker
**What goes wrong:** Before a group materializes, fallback-path slide ids are `${slot.id}:${localSeq}`
(`slideshowAssembler.ts`'s `emitFallback`). The instant the group document's `onSnapshot` lands, the
SAME conceptual slides re-render with brand-new `entry.id` UUIDs (`emitFromGroup`). If `SlideCard`
components are keyed on `slide.id` in a `v-for`, Vue destroys and recreates every card DOM node at
that moment — a visible flicker, and any transient UI state (hover, in-progress drag) is lost.
**Why it happens:** The two emission paths deliberately use different id spaces (documented in both
files) — this is by design for reasons unrelated to the UI (WR-02's media-child-keying contract), but
the UI consequence was never addressed.
**How to avoid:** Either accept the one-time flicker (materialization typically completes within one
Firestore round-trip of opening the tab, so it's brief), or key cards on a synthesized index-based key
during the brief pre-materialization window if a smoother experience is wanted. Do not "fix" this by
changing the materializer's id-minting scheme — that would violate Phase 23's WR-02 contract for
media-child keying. Flag as a UAT item rather than silently engineering around it.
**Warning signs:** A newly-opened service (no groups materialized yet) shows a one-frame flash on its
first grid render.

### Pitfall 5: `PptxImportModal.vue` has no public API for a drag-and-dropped `File`
**What goes wrong:** The modal only reacts to its own internal `<input type="file">` `@change`
handlers (`onPptxInputChange`/`onImagesInputChange`) — there is no prop or exposed method to hand it
a `File` object obtained from the grid's own `drop` event.
**Why it happens:** The modal was built in Phase 21 for a picker-only UX; drag-and-drop hand-off from
an external drop zone was never a requirement then.
**How to avoid:** Add a small, additive `defineExpose({ importPptxFile, importImageFiles })` (or a
single `handleDroppedFile(file: File)` that dispatches internally on `file.name.endsWith('.pptx')` vs
`file.type.startsWith('image/')`) to `PptxImportModal.vue`, calling straight into the EXISTING
`importPptx(file)`/`importImages(files)` functions. This satisfies D-15 ("reuse... rather than
creating a second import implementation") because all upload/parse/preview/confirm logic still lives
in the one component — only the entry point gains a second caller.
**Warning signs:** Attempting to synthesize a `DataTransfer` and dispatch a fake `change` event on the
modal's hidden `<input>` — works but is a browser-compatibility-fragile hack; prefer the
`defineExpose` extension.

### Pitfall 6: Riding the wrong write path for group mutations
**What goes wrong:** A slide/bed edit silently gets lost or double-writes if it goes through
`localService`'s deep-watch autosave (800ms debounce) instead of the scoped `slideGroups` store
actions.
**Why it happens:** `ServiceEditorView.vue` has ONE dominant mutation pattern for slot fields
(mutate `localService.value.slots[index]`, let the deep watch pick it up) — it's easy to reflexively
follow that pattern for anything that "feels like" editing a slot.
**How to avoid:** Group data (`slides`, `bedAudioUrl`, `bedVideoUrl`) is NOT part of `Service`/
`ServiceSlot` at all — it lives in a sibling Firestore document (`slideGroups/{slotId}`). There is no
`localService.slots[i].slides` to mutate; the only correct write surface is
`slideGroupsStore.replaceGroupSlides`/`setGroupBedMedia`. This is already proven correct by 24-06's
`onSlotBedAudioChange`/`onSlotBedVideoChange` (Pattern 4/24-06 code, read directly) — copy that
shape, don't reinvent it.
**Warning signs:** Any new code path that reads `localService.value` when the intent is "add/reorder/
remove a slide" or "attach group media."

### Pitfall 7: Video drop treated as "append a slide" per UI-SPEC copy, without checking the data model
**What goes wrong:** A literal implementation of the UI-SPEC's copy ("video appends a slide") either
silently drops the dropped video, throws at `replaceGroupSlides` time (no `SourceRef` kind exists for
it), or requires unplanned new data-model work mid-phase.
**How to avoid:** See Pattern 5 — route video through `setGroupBedMedia` like audio, and flag the copy
mismatch (Open Question 1) rather than expanding Phase 24's locked model inside this shell phase.

### Pitfall 8 (already-known codebase gotchas — carried over verbatim, still load-bearing here)
- **Modals teleport to `<body>`.** Testing needs `new DOMWrapper(document.body)` + `enableAutoUnmount(afterEach)` (established in Phase 21, reused by 24-06's slot-delete-confirm test).
- **`shallowMount` auto-stubs `<Teleport>`** unless `stubs: { teleport: false }` is passed explicitly — confirmed directly in `24-06`'s own code comment and its test file.
- **`ServiceEditorView.test.ts` requires Pinia mocks for THREE stores** — `scriptureSlides`, `importedSlides`, AND `slideGroups` (all three are read by `useSlideshowAssembly`) — omitting any one crashes `useXStore()`'s `getActivePinia()` call at component setup. The `slideGroups` mock must be **stateful** (a `reactive()` wrapper), not a static stub, if the new tests need to assert what got written (mirrors the existing pattern at `ServiceEditorView.test.ts` lines 86-110).
- **Composable tests need `effectScope()` isolation.** `useSlideshowAssembly.test.ts` wraps every invocation in its own `effectScope()`, stopped in `afterEach`, because `onUnmounted` never fires for a composable invoked outside a component's setup — a leaked watcher from a prior test will fire again on later test data and corrupt assertions.
- **The autosave deep-watch leaks an 800ms timer without `enableAutoUnmount`.** Any new test that mounts `ServiceEditorView.vue` (even indirectly, to test the Slides tab within it) inherits this — always call `enableAutoUnmount(afterEach)` at the top of the test file.

## Code Examples

### Static kind-badge class map (Tailwind v4 purge-safe — verified existing pattern)
```typescript
// Source: src/components/SongBadge.vue (read directly) — the exact precedent the UI-SPEC's
// "Kind badge color map" cites. Copy this shape for the rail/card kind badge, do NOT interpolate.
const badgeClasses = {
  SONG: 'bg-indigo-950/50 text-indigo-300 border-indigo-800',
  HYMN: 'bg-indigo-950/50 text-indigo-300 border-indigo-800',
  SCRIPTURE: 'bg-teal-900/50 text-teal-300 border-teal-800',
  PRAYER: 'bg-gray-800 text-gray-400 border-gray-700',
  MESSAGE: 'bg-pink-900/50 text-pink-300 border-pink-800',
  IMPORTED: 'bg-amber-900/50 text-amber-300 border-amber-800',
} as const
// Template: :class="badgeClasses[slot.kind]"  — NEVER `bg-${kind}-900` (silently purged in prod build).
```

### ServiceEditorView.test.ts's three-store Pinia mock shape (copy for any new Slides-tab test)
```typescript
// Source: src/views/__tests__/ServiceEditorView.test.ts lines 57-110 (read directly)
vi.mock('@/stores/scriptureSlides', () => ({
  useScriptureSlides: () => ({ readings: [], isLoading: false, subscribeReadings: vi.fn(), unsubscribeReadings: vi.fn() }),
}))
vi.mock('@/stores/importedSlides', () => ({
  useImportedSlides: () => ({ decks: [], isLoading: false, subscribeDecks: vi.fn(), unsubscribeDecks: vi.fn() }),
}))
const mockSlideGroupsState = reactive<{ groups: SlideGroup[] }>({ groups: [] })
vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    groups: mockSlideGroupsState.groups,
    isLoading: false,
    get groupsBySlotId() {
      const map = new Map<string, SlideGroup>()
      for (const g of mockSlideGroupsState.groups) map.set(g.slotId, g)
      return map
    },
    subscribeGroups: vi.fn(), unsubscribeGroups: vi.fn(),
    materializeGroupIfMissing: vi.fn(() => Promise.resolve(true)),
    deleteGroup: vi.fn(() => Promise.resolve()),
    setGroupBedMedia: vi.fn(() => Promise.resolve()),
    replaceGroupSlides: vi.fn(() => Promise.resolve()),
  }),
}))
```

### Teleport + shallowMount assertion pattern (copy for testing the reused PptxImportModal / any confirm UI)
```typescript
// Source: src/views/__tests__/ServiceEditorView.test.ts lines 854-882 (read directly)
import { shallowMount, enableAutoUnmount, DOMWrapper } from '@vue/test-utils'
enableAutoUnmount(afterEach)

function mountView() {
  return shallowMount(ServiceEditorView, {
    global: { stubs: { /* ...other stubs..., */ teleport: false } }, // MUST be false, not omitted
  })
}
function body() { return new DOMWrapper(document.body) }
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Phase 25 should render a passive, non-blocking banner for a pending reconciliation on the selected group, and must NOT block reorder/selection while one is pending. | Architecture Patterns §6 (Pattern 6) | If wrong, either the phase ships silent-stale-data (violates R018/failure-visibility norms already established by R029) or the planner over-builds a mini-confirm-UI that duplicates Phase 26's scope and creates rework/conflict at 26 |
| A2 | A dropped video file should attach as the group's bed video (like audio), not append a slide, because no `VideoSlide`/`SourceRef` variant exists in the current (locked, Phase-24-shipped) data model. | Architecture Patterns §5 (Pattern 5) | If wrong (i.e., the team actually wants a real per-slide video kind now), this phase's scope silently grows to include new `Slide`/`SourceRef`/`ImportedDeck` types and assembler changes — a materially larger, cross-cutting change to Phase 24's already-shipped, code-reviewed model |
| A3 | The recommended `PptxImportModal.vue` extension is a `defineExpose`d method invoked directly (bypassing the internal `<input>`), rather than synthesizing a `DataTransfer` + dispatched `change` event. | Architecture Patterns §4/Pitfall 5 | Low risk either way (both are implementation-detail choices within the same component) — flagged only because the `defineExpose` approach is the one that best satisfies D-15's "not a second implementation" framing |

**If this table is empty:** N/A — see above; both entries surface a genuine cross-phase seam gap
that no locked decision in `25-CONTEXT.md` or the UI-SPEC resolves.

## Open Questions

1. **Should the UI-SPEC's drop-tile copy be corrected before/during implementation given Pattern 5?**
   - What we know: the current approved copy says video "appends a slide"; the data model cannot do
     that (Pattern 5).
   - What's unclear: whether the project owner wants a copy fix now (cheap, this phase) or wants to
     actually scope a `VideoSlide` type addition (expensive, belongs to a future phase).
   - Recommendation: fix the copy this phase (treat video like audio, bed-only) and note the future
     `VideoSlide` idea in `<deferred>` for a later milestone, consistent with how D-01/D-09/etc.
     already defer similar out-of-model asks. Surface this to the user via a `checkpoint:human-verify`
     if the planner wants explicit sign-off before diverging from the approved UI-SPEC text.

2. **Exact component decomposition** (Claude's Discretion, not truly "open" but worth flagging as a
   planner decision point): the Recommended Project Structure above is a suggestion, not a
   requirement — a single `SlidesTab.vue` is equally valid per CONTEXT's explicit discretion grant.

## Environment Availability

Skipped — this phase introduces no new external dependency, service, or CLI tool. `sortablejs`,
Firebase (Firestore/Storage/Functions), and every reused component are already present and configured
in this working tree (`.env.local` present per project conventions).

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest [VERIFIED: package.json devDependencies + vitest.config.ts] |
| Config file | `vitest.config.ts` (unit) — `vitest.rules.config.ts` is the SEPARATE emulator-only rules config, not relevant to this phase's component/composable tests |
| Quick run command | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` (or new `src/components/slides/__tests__/*.test.ts` files once created) |
| Full suite command | `npm run test:unit` (do NOT run `npm run test:rules` per project environment notes — a live emulator session may be held by the user) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| R031 | Rail renders groups in plan order, auto-selects first (D-05), zero-slide groups show count 0 (D-08), empty service shows D-07 empty state | unit (component) | `npx vitest run src/components/slides/__tests__/PlanRail.test.ts` | ❌ Wave 0 |
| R031 | Grid renders selected group's cards (via `slotIndex` filter, Pattern 2), card click sets `selectedSlideId` (D-12), drag-reorder writes `replaceGroupSlides` (D-11) | unit (component) | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` | ❌ Wave 0 |
| R032 | PPTX import appends `GroupSlideEntry` items to the SELECTED group (Pattern 4), not a new plan item | unit (component/integration) | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts -t "import"` | ❌ Wave 0 |
| R032 | Audio drop calls `setGroupBedMedia({ bedAudioUrl })`; video drop calls `setGroupBedMedia({ bedVideoUrl })` (Pattern 5/A2) | unit (component) | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts -t "drop"` | ❌ Wave 0 |
| R018 | Rail has no drag affordance (D-06) and no `cursor-grab`/handle classes render on rail rows | unit (component, negative assertion) | `npx vitest run src/components/slides/__tests__/PlanRail.test.ts -t "no drag"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant new component's quick-run command above.
- **Per wave merge:** `npm run test:unit` (full suite) — this phase touches `ServiceEditorView.vue`
  (adding the third tab), so the FULL existing `ServiceEditorView.test.ts` suite must stay green,
  not just new tests.
- **Phase gate:** Full suite green before `/gsd-verify-work`. Ignore the three known-pre-existing
  failures per project environment notes (`storage.rules.test.ts`, `RosterView.test.ts`, quarantine
  worktrees) — do not attempt to fix those as part of this phase's verification.

### Wave 0 Gaps
- [ ] `src/components/slides/__tests__/PlanRail.test.ts` — new, covers R031 rail behavior
- [ ] `src/components/slides/__tests__/SlideGrid.test.ts` — new, covers R031/R032 grid+drop+import behavior
- [ ] `src/components/slides/__tests__/SlideCard.test.ts` — new, covers D-10/D-12 card content + selection (small, may be folded into `SlideGrid.test.ts`)
- [ ] Extend `src/views/__tests__/ServiceEditorView.test.ts` — new `describe` block for the third tab button/panel wiring (`activeTab === 'slides'`), reusing the existing three-store mock already present in that file (Code Examples §2) — no NEW mock infrastructure needed, only new assertions
- [ ] `PptxImportModal.vue`'s `defineExpose` extension (Pitfall 5) needs its own new test coverage in the EXISTING `src/components/__tests__/PptxImportModal.test.ts` (extend, don't replace)
- Framework install: none — Vitest and `@vue/test-utils` are already project dependencies.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | Unchanged this phase — Firebase Auth session already established at the route level |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | `authStore.isEditor` gating, exactly as every existing write-capable control in `ServiceEditorView.vue` already does (`SlotMediaAttachment`, section-select, delete). All new rail/grid write actions (reorder, add slide, import, bed attach) must be hidden/disabled for non-editors, mirroring the existing pattern — never rely on UI-hiding alone since Firestore's `isOrgEditor(orgId)` rule is the actual enforcement boundary (already proven in place for `slideGroups` writes per `useSlideshowAssembly`'s `canWrite` gate) |
| V5 Input Validation | yes | File-type/size validation for the drop target: reuse `useMediaUpload`'s existing MIME-prefix + `MEDIA_MAX_BYTES` (50MB) validation for audio/video; PPTX/image validation is whatever `PptxImportModal`/`parsePptx` already enforce (out of this phase's scope to re-verify, unchanged) |
| V6 Cryptography | no | Not touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Unauthenticated/non-member write to `slideGroups` via a crafted client request | Tampering / Elevation of Privilege | Firestore security rules already gate `organizations/{orgId}/slideGroups/**` writes to org members with editor role (pre-existing, Phase 24 — not re-verified here since Phase 24 is out of this phase's scope, but the client-side `canWrite` gate in `useSlideshowAssembly` mirrors it and must not be the ONLY gate a new component relies on) |
| Oversized/wrong-MIME file dropped directly (bypassing the file `<input>`'s `accept` attribute, which is advisory only) | Denial of Service (storage bloat) / Tampering | `useMediaUpload`'s `validate()` function checks BOTH `file.type` prefix and `file.size` before any bytes leave the browser, and `storage.rules`' `orgs/{orgId}/media/**` write rule enforces the same 50MB ceiling server-side (`request.resource.size < 52428800`) — a native HTML5 drop event delivers raw `File` objects with no `accept`-attribute filtering at all, so the drop-target's own type-routing logic (Claude's Discretion item) MUST re-run this same validation itself rather than trusting the file's apparent extension |

## Sources

### Primary (HIGH confidence — read directly from the working tree this session)
- `src/stores/slideGroups.ts` — all four group write actions, their exact signatures and race-safety comments
- `src/utils/slideGroupMaterializer.ts` — `deriveGroupEntries`, `reconcileGroup`/`reconcileSongGroup`/`reconcileUnstableIdGroup`, `hasCustomization`
- `src/utils/slideshowAssembler.ts` — `assembleSlideshow`, `emitFallback` vs `emitFromGroup`, `resolveEntryMedia`
- `src/composables/useSlideshowAssembly.ts` — `pendingReconciliations`, `materializationCandidates`, the two `isLoading` flags, the single-subscription-owner comment
- `src/types/slideGroup.ts`, `src/types/slide.ts`, `src/types/service.ts`, `src/types/importedDeck.ts` — confirmed no `VideoSlide` variant exists anywhere
- `src/views/ServiceEditorView.vue` — tab bar (lines 397-420), Sortable pattern (1483-1537), `onImportConfirmed` (1342-1349), `onSlotBedAudioChange`/`onSlotBedVideoChange` (1433-1457), `confirmSlotDelete` group-cascade (1896-1929)
- `src/components/PptxImportModal.vue` — props/emits (220-229), `onConfirm`/`createDeck` call (383-398), no drag-and-drop entry point confirmed by full read
- `src/components/SlotMediaAttachment.vue`, `src/composables/useMediaUpload.ts` — validation rules, emit contract
- `storage.rules` — the 50MB media cap mirrored by `useMediaUpload`
- `src/components/SongBadge.vue` — the static-class-map Tailwind v4 purge-safety precedent
- `src/views/__tests__/ServiceEditorView.test.ts` — three-store Pinia mock shape, Teleport/`DOMWrapper`/`shallowMount` pattern (lines 57-110, 854-882)
- `src/composables/__tests__/useSlideshowAssembly.test.ts` — `effectScope()` isolation pattern
- `.planning/phases/24-slide-group-model-and-migration/24-CONTEXT.md`, `.planning/phases/25-.../25-CONTEXT.md`, `.planning/phases/25-.../25-UI-SPEC.md`, `.planning/milestones/v1.2-REQUIREMENTS.md`, `.planning/STATE.md`, `docs/design/README.md` — all read directly this session

### Secondary (MEDIUM confidence)
- None — no web/docs sources were needed; this phase's research surface is entirely internal to the
  already-checked-out codebase, per the explicit research focus scoping.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, every reused module read directly
- Architecture: HIGH — every pattern above is grounded in an actual file read this session, not inferred
- Pitfalls: HIGH for the seven newly-identified pitfalls (each backed by a direct code read); HIGH for the five carried-over pitfalls (each backed by the actual test file exhibiting the pattern)
- Open questions / assumptions: correctly flagged LOW-confidence-by-nature (they are genuine gaps neither CONTEXT.md nor the UI-SPEC resolves) — not presented as settled fact

**Research date:** 2026-07-26
**Valid until:** Until Phase 24's data-model files change again, or until the UI-SPEC/CONTEXT for this
phase is amended — this research is tightly coupled to the exact current state of
`slideGroups.ts`/`slideGroupMaterializer.ts`/`slideshowAssembler.ts`/`useSlideshowAssembly.ts`, all of
which are marked code-complete but not yet human-verified end-to-end (per STATE.md's outstanding
Phase 22-23 checkpoints — unrelated to this phase's own scope, noted only for completeness).
