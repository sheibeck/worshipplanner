# Phase 26: Edit Slide Drawer - Research

**Researched:** 2026-07-26
**Domain:** Vue 3 slide-over UI over an existing Firestore-backed slide-group data model; a group-level reconciliation confirm flow
**Confidence:** HIGH

## Summary

Phase 26 is almost entirely **integration work against code that already exists and already works**.
There are no new npm packages, no new Firestore collections, and — with one exception — no new
fields on existing types. The three hard parts are: (1) wiring a drawer component into the
`selectedSlideId` seam `SlidesTab.vue`/`SlideGrid.vue`/`SlideCard.vue` already expose and documented
in their own header comments, (2) turning `SlideGrid.vue`'s existing passive `reconciliationNotice`
into a real confirm dialog that calls `replaceGroupSlides`, and (3) closing one real, already-flagged
data-model gap: `PendingReconciliation` has no field for the old/new song names D-08's copy needs.

The single most load-bearing fact this research establishes, because the UI-SPEC and CONTEXT.md both
gesture at it without stating it in code terms: **for a materialized group, `AssembledSlide.slide.id`
IS `GroupSlideEntry.id`, verbatim, with no transform.** `slideshowAssembler.ts`'s `emitFromGroup`
(lines 279–297) sets `slide.id = entry.id` directly — never a derived or composite id. This means
`selectedSlideId` (which is `assembledSlide.slide.id`, set by `SlideCard.vue`'s `@select` emit) can be
looked up directly against `group.slides.find(e => e.id === selectedSlideId)` with **no intermediate
mapping step, no `groupSlideId` indirection needed** (that field exists on `AssembledSlide` too, and
is redundant with `slide.id` for the group-resolved path — it exists for the same reason but adds no
new information here). The one caveat: this equality holds **only** on the group-resolved emission
path. The no-group-yet fallback path (`emitFallback`, used before a group has materialized) mints a
synthetic `${slot.id}:${localSeq}` id that has no `GroupSlideEntry` counterpart at all — see Pitfall 1.

**Primary recommendation:** Build the drawer as a new `EditSlideDrawer.vue` mounted inside
`SlidesTab.vue` (sibling to `SlideGrid`, not nested inside it — it needs `orgId`/`serviceId` plus the
selected group and entry, all of which `SlidesTab.vue` already holds or can derive), driven by a
`selectedEntry = computed(() => selectedGroup.value?.slides.find(e => e.id === selectedSlideId.value) ?? null)`.
Every write is a read-modify-write of `selectedGroup.value.slides` through `replaceGroupSlides`, always
passing `baseSlides` (CR-02 CAS contract). The reconciliation modal is a second, independent component
launched from `SlideGrid.vue`'s existing (currently inert) banner, never nested inside the drawer.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drawer open/close, field editing, autosave | Browser / Client (Vue component tree under `SlidesTab.vue`) | — | Pure UI state + Pinia store calls; no server logic needed |
| Slide entry persistence (label/notes/audio/duplicate/delete) | API / Backend via `useSlideGroups` store → Firestore | Database / Storage | `replaceGroupSlides`/`setGroupBedMedia` already own every write path; no new backend surface |
| Reconciliation decision (needsConfirm / proposed / loss) | API / Backend logic, pre-computed | Browser / Client (renders it) | `slideGroupMaterializer.ts` (pure) + `useSlideshowAssembly.ts` (reactive wrapper) already compute this; the modal only renders and dispatches the user's choice |
| Durable dismissal of a reconciliation | Database / Storage (a stamp on `SlideGroup`) | Browser / Client (compares against current signature) | Must survive reload/multi-tab — cannot live in component state |
| Navigation to song/scripture editor | Browser / Client (Vue Router + same-page tab switch) | — | `/songs` has no per-id route today; needs a query-param convention (see Pitfall 4), not a new route |
| Media upload (new audio file) | Browser / Client → Storage direct upload | — | `useMediaUpload` already does this; unchanged |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — Fixed-position overlay reusing `SongSlideOver.vue`'s pattern; nothing underneath reflows (R033).
- **D-02** — Live-apply per field, not a staged Save/Cancel buffer. Label/notes/audio scope/loop write through the store as they change.
- **D-03** — The drawer follows the selection (`selectedSlideId`); never closes on a selection change.
- **D-04** — Ship `Duplicate`; defer `Tag` and `Details` (undefined behavior, mockup-only).
- **D-05** — Reconciliation confirm is its OWN modal, launched from Phase 25's passive banner — a GROUP-level decision, not slide-level.
- **D-06** — No diff view in the reconciliation dialog (user override of the recommended diff view). Warning copy must be as concrete as possible without one: counts and kinds.
- **D-07** — Two actions: `Apply source changes` / `Dismiss`. **`Dismiss` is DURABLE** — must not re-prompt for the same unchanged signature on every load.
- **D-08** — The song-identity swap reuses this dialog with specific copy naming the old and new song (closes Phase 24's CR-01 blocker).
- **D-09** — `All slides in this group` writes the GROUP BED via `setGroupBedMedia`, not per-entry copies.
- **D-10** — Slide beats bed (already implemented precedence, extended to video by 25-REVIEW-FIX WR-01).
- **D-11** — `Loop until the next slide` is a per-slide flag only; a group bed never loops.
- **D-12** — No audio control on a video slide (hard `v-if`, not disabled-looking).
- **D-13** — Slide text is read-only here (D002/D007); no per-service text override path.
- **D-14** — "Edit in song" navigates by ROUTE to the song's lyrics editor, not a deep link into current editor internals (Phase 28 reworks that editor next).
- **D-15** — The affordance is per `sourceRef.kind` (lyric/copyright/scripture/imported/video/text) — see the per-kind table below.
- **D-16** — Confirm before navigating away if the drawer holds unsaved edits.

### Claude's Discretion

Drawer width and responsive behavior; whether Save/Cancel render at all given D-02's live-apply (UI-SPEC already resolved this to autosave-status indicator only — no buttons); how the durable dismissal in D-07 is persisted (a field on the group vs. a signature stamp — this research recommends a concrete shape, see below); the duplicate-slide id/label convention; preview rendering fidelity inside the drawer; component decomposition.

### Deferred Ideas (OUT OF SCOPE)

- `Tag` and `Details` mockup affordances (D-04).
- A source-vs-group diff view for reconciliation (D-06, explicitly traded away).
- Per-service slide text overrides (D002/D007, permanently out).
- Keyboard slide reordering (SortableJS provides none; pre-existing gap, not this phase's job).
- `UNANCHORED`/orphaned slides (still deferred from Phase 24).
- The Service Order tab rename and Phase 18-23 surface removal (Phase 27).
- The song lyrics editor rework (Phase 28) — do not couple to its current internal structure.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R033 | Edit Slide drawer floating over the page without reflow, carrying preview/label/read-only text with "Edit in song" link/audio scope+loop/operator notes/delete | Drawer architecture, per-kind text table, audio scope/loop semantics, and duplicate/delete flows below all map directly to this requirement's clauses |
| R029 (deferred confirm-flow debt) | Deleting a plan item deletes its slide group behind an explicit warning — the reconciliation confirm dialog Phases 24/25 both deferred | `## Reconciliation Confirm Flow` section below: exact `ReconcileResult`/`PendingReconciliation` shapes, the durable-dismissal design, and the D-08 song-swap data gap and its fix |

</phase_requirements>

## Standard Stack

No new packages. Every dependency this phase needs is already installed and already used by the exact
patterns this phase reuses.

### Core (already installed, reused verbatim)
| Library | Version (installed) | Purpose | Why Standard (for this phase) |
|---------|---------|---------|--------------|
| vue | ^3.5.29 | Component framework, `Teleport`, `Transition` | `SongSlideOver.vue`'s exact pattern is the reuse target (D-01) |
| pinia | ^3.0.4 | `useSlideGroups` store — the only write surface | Already the sole write path for every slide-group mutation |
| sortablejs | ^1.15.7 | Unrelated to this phase's own writes, but the grid's existing drag-reorder must keep working alongside the new drawer | No new usage; listed for completeness |
| vue-router | ^5.0.3 (per `package.json`) | Route to `/songs` for D-14's "Edit in song" | `/songs` has no per-song route param today — a query-param convention must be added (see Pitfall 4), not a new route |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `useMediaUpload` (`src/composables/useMediaUpload.ts`) | Audio file upload to Storage | Attaching a NEW audio file from the drawer, both scopes |
| `useUnsavedGuard` (`src/composables/useUnsavedGuard.ts`) | Dirty-check + `window.confirm` discard gate | D-16's "confirm before navigating away" — reuse verbatim, do not invent new copy |

### Alternatives Considered

None — this phase is scoped by CONTEXT.md to reuse `SongSlideOver.vue`'s pattern and the Phase 24/25
store actions exactly. There is no library decision to make.

**Installation:** none required.

## Package Legitimacy Audit

Not applicable — this phase installs no new external packages. Every dependency used is already
present in `package.json` and already exercised by shipped Phase 21–25 code.

## Architecture Patterns

### System Architecture Diagram

```
User clicks a SlideCard in SlideGrid.vue
        │  emits 'select' with slide.id
        ▼
SlideGrid.vue ── re-emits 'select' ──▶ SlidesTab.vue
                                            │ sets selectedSlideId.value = slideId
                                            │
                                            ▼
                                   selectedGroup (computed, existing)
                                            │
                                            ▼
                          selectedEntry = selectedGroup.slides
                                            .find(e => e.id === selectedSlideId)   ◀── NEW computed
                                            │
                    ┌───────────────────────┴────────────────────────┐
                    ▼                                                ▼
           EditSlideDrawer.vue (NEW)                     (no entry found → drawer
           mounted as a SIBLING of SlideGrid                does not render, per
           inside SlidesTab.vue's template                  D-03's "follows
                    │                                        selectedSlideId")
                    │ field edit (debounced 800ms
                    │ text / immediate toggle)
                    ▼
      read group.slides (fresh from selectedGroup prop)
      → splice/replace the ONE entry by id
      → replaceGroupSlides(orgId, slotId, updatedSlides,
                             group.sourceSignature, group.slides)
                    │
                    ▼
           Firestore write (CAS via runTransaction,
           since baseSlides is always passed)
                    │
                    ▼
        onSnapshot round-trip → groupsBySlotId updates
                    │
                    ▼
        selectedGroup / selectedEntry recompute → drawer
        re-renders with the persisted value (round-trip,
        not optimistic local-only state)


Reconciliation (independent flow, NOT inside the drawer):

SlideGrid.vue's reconciliationNotice (existing banner)
        │  made clickable
        ▼
ReconciliationConfirmModal.vue (NEW, separate Teleport)
        │  reads pendingForSelected: PendingReconciliation
        │
   ┌────┴─────┐
   ▼          ▼
"Apply       "Dismiss"
source        │
changes"      │ writes SlideGroup.dismissedSignature = group.sourceSignature (NEW field)
   │          │ (or freshSignature if diverged from stored sourceSignature)
   ▼          ▼
replaceGroupSlides(          pendingReconciliationsMap entry for this slotId
  orgId, slotId,             is filtered out at read time by comparing
  result.proposed,           dismissedSignature against the CURRENT freshSignature —
  freshSignature)            a NEW divergence changes freshSignature and un-dismisses it
```

### Recommended Project Structure

```
src/components/slides/
├── SlidesTab.vue                  # existing — mounts EditSlideDrawer as a new sibling of SlideGrid
├── SlideGrid.vue                  # existing — reconciliationNotice becomes clickable; mounts the new modal
├── EditSlideDrawer.vue             # NEW — the R033 drawer itself
├── ReconciliationConfirmModal.vue  # NEW — the R029 confirm dialog (separate from the drawer, D-05)
├── slideDisplay.ts                # existing — widen PendingReconciliation (see gap below)
└── __tests__/
    ├── EditSlideDrawer.test.ts             # NEW
    └── ReconciliationConfirmModal.test.ts  # NEW
```

Sub-decomposition inside `EditSlideDrawer.vue` (Claude's Discretion per CONTEXT.md, but a per-kind
split keeps the "one big switch statement" risk down): a `SlideTextField.vue` (or similarly scoped
sub-component) for the per-kind text/link block is reasonable given the per-kind matrix's size, but a
single-file drawer with internal `v-if` branches is also acceptable — CONTEXT.md leaves this open.

### Pattern 1: Resolving the selected entry (the crux, Research Focus #1)

**What:** `selectedSlideId` (from `SlidesTab.vue`, already exists) equals a `GroupSlideEntry.id`
directly for any slide resolved from a materialized group — no transform needed.

**Why:** `slideshowAssembler.ts` line 283: `id: entry.id` (never recomputed — Phase 23's WR-02
contract keys media components on this id, so the assembler is contractually forbidden from ever
diverging `slide.id` from `entry.id` on the group-resolved path).

**Example:**
```typescript
// Source: src/utils/slideshowAssembler.ts:279-297 (emitFromGroup), verified by direct read
// New computed to add in SlidesTab.vue, immediately after the existing `selectedGroup`:
const selectedEntry = computed<GroupSlideEntry | null>(() => {
  if (!selectedGroup.value || selectedSlideId.value === null) return null
  return selectedGroup.value.slides.find((e) => e.id === selectedSlideId.value) ?? null
})
```

**When to use:** Every read the drawer needs (current label/notes/audio/loop/sourceRef) and every
write (read-modify-write of `selectedGroup.value.slides`) goes through this single lookup — do not
re-derive it a second way, and do not consult `AssembledSlide.groupSlideId` as if it were a different
value (it is the same value, only present for slides that already resolved through the group path).

### Pattern 2: Read-modify-write via `replaceGroupSlides` with `baseSlides` (Research Focus #2)

**What:** `replaceGroupSlides(orgId, slotId, slides, sourceSignature?, baseSlides?)`
(`src/stores/slideGroups.ts:250-278`). There is **no per-entry update helper** — every mutation,
including editing one field of one entry, replaces the WHOLE `slides` array.

**Why:** Confirmed by direct read — this is the ONLY write function for the `slides` array, used
identically by `onAddSlide`, `onImportConfirmed`, `appendVideoEntries`, and the reorder handler in
`SlideGrid.vue`, plus `applyReconciliationOutcomes` in `useSlideshowAssembly.ts`. `baseSlides`, when
supplied, upgrades the call from a plain `updateDoc` to a `runTransaction` compare-and-swap: entries
present on the LIVE document but absent from both `baseSlides` and the caller's own `slides` payload
are treated as concurrently-added and re-appended (see `mergeConcurrentlyAddedEntries`, lines 289–300)
rather than silently dropped.

**CAS contract for this phase's writes:** `baseSlides` must always be the exact `group.slides` array
the drawer read just before computing its own next array — i.e. `selectedGroup.value.slides` at the
moment the debounced write fires, NOT a value captured when the drawer first opened (the group can
have changed underneath a long-open drawer — e.g. a reconciliation just landed).

```typescript
// Source: src/stores/slideGroups.ts:250-278, direct read
async function updateEntryField(field: 'label' | 'notes', value: string): Promise<void> {
  if (!selectedGroup.value || !selectedEntry.value) return
  const base = selectedGroup.value.slides
  const next = base.map((e) => (e.id === selectedEntry.value!.id ? { ...e, [field]: value } : e))
  await slideGroupsStore.replaceGroupSlides(
    props.orgId, props.selectedSlot!.id, next, selectedGroup.value.sourceSignature, base,
  )
}
```

**Note on an update helper:** CONTEXT.md's Claude's Discretion explicitly leaves open "whether a
per-entry update helper should exist instead." Given every OTHER call site in this codebase
(`onAddSlide`, `onImportConfirmed`, reorder, reconciliation-apply) already does its own inline
`[...entries, x]`/`.map()`/`.filter()` transform before calling `replaceGroupSlides`, a thin
`updateEntry(orgId, slotId, entryId, patch: Partial<GroupSlideEntry>, base)` helper co-located with
the drawer (not in the store — the store's contract is deliberately "accepts a whole array") would
reduce duplication across the drawer's several field-writes (label, notes, audioUrl, audioLoop,
audioScope, text-kind body) without changing the store's shape. Recommended, not mandatory.

### Pattern 3: Reconciliation confirm — apply / dismiss (Research Focus #3)

**What today's `needsConfirm` result carries:** `ReconcileResult` (`slideGroupMaterializer.ts:347-353`):
```typescript
export interface ReconcileResult {
  needsConfirm: boolean
  changed: boolean
  slides: GroupSlideEntry[]
  proposed?: GroupSlideEntry[]   // the fresh derivation the user would get on "Apply"
  loss?: { customizedEntries: number; withAudio: number; withNotes: number }
}
```
`PendingReconciliation` (both the canonical copy in `useSlideshowAssembly.ts:74-78` and the
deliberately-duplicated local copy in `slideDisplay.ts:142-146`, per 25-03's "no composable import"
constraint) mirrors `{ slotId, proposed, loss }` only.

**What "Apply source changes" must DO:** call `replaceGroupSlides(orgId, slotId, pendingEntry.proposed, freshSignature)`
— i.e. exactly what `applyReconciliationOutcomes` already does for the NON-confirm-required
(`!needsConfirm && changed`) branch, just triggered by the user's click instead of the watcher. The
`freshSignature` value is NOT stored on `PendingReconciliation` today (`useSlideshowAssembly.ts`'s
`reconciliationOutcomes` computed has it locally as `outcome.freshSignature` but never threads it into
the `PendingReconciliation` map entry it stores at line 430-435). **This is a second small gap**: widen
`PendingReconciliation` to also carry `freshSignature?: string` so the modal's "Apply" handler can
call `replaceGroupSlides` with the correct signature without recomputing it (recomputing it would
require re-importing `sourceSignature`/`AssemblyInputs` into a component that currently imports
neither, per 25-04's "no composable" constraint).

**The D-08 song-name gap (confirmed, exact fix):** `reconcileSongGroup`'s CR-01 branch (lines 262–274)
detects a song-identity swap via `storedSongIds` (a `Set<string>` of the OLD song's id(s) found on
stored lyric/copyright entries) vs. `slot.songId` (the NEW song, already assigned). It has both ids in
scope at the point it returns `needsConfirm: true` but returns neither. Fix:

1. Widen `ReconcileResult` with an optional `songSwap?: { oldSongId: string; newSongId: string }`,
   populated only in this one branch of `reconcileSongGroup`.
2. In `useSlideshowAssembly.ts`'s `reconciliationOutcomes` computed, when `result.songSwap` is
   present, resolve `oldSongTitle`/`newSongTitle` via `songStore.songs.find(s => s.id === songSwap.oldSongId)?.title`
   (the composable already has `songStore` in scope — `useSongStore()` at line 131 — and `slot.songTitle`
   directly gives the new title without a lookup, though resolving both symmetrically through
   `songStore.songs` is simpler and handles a stale/removed old song by falling back to a generic
   label).
3. Widen `PendingReconciliation` (both copies) with optional `oldSongTitle?: string; newSongTitle?: string`.

This keeps `slideGroupMaterializer.ts` pure (it never reads a song title, only ids it already has) and
keeps the title resolution in the one layer that already imports the song catalog.

**Durable dismissal (D-07) — recommended shape:** add `dismissedSignature?: string` to `SlideGroup`
(`src/types/slideGroup.ts`), written via a new scoped store action (mirroring `setGroupBedMedia`'s
dot-path-only update — never a whole-document `replaceGroupSlides` call, since dismissal touches
neither `slides` nor the bed). On "Dismiss," write
`dismissedSignature = freshSignature` (the CURRENT diverged signature, not the OLD stored one — this
is what makes a NEW divergence re-prompt: `reconciliationOutcomes`'s existing `freshSignature !==
group.sourceSignature` check gates entry into the pending set at all, and a second filter —
`freshSignature !== group.dismissedSignature` — gates whether a needsConfirm result actually surfaces
to the UI or is suppressed as "already seen and declined"). Concretely, in
`applyReconciliationOutcomes`/`pendingReconciliationsMap`, change the "add to pending map" condition
from `if (!pendingReconciliationsMap.has(outcome.slotId))` to also check
`outcome.freshSignature !== outcome.group.dismissedSignature` before adding. `sourceSignature` (what
was last WRITTEN) and `dismissedSignature` (what was last DECLINED) are deliberately two different
fields — collapsing them into one would make an actual "Apply" indistinguishable from a "Dismiss" the
next time the same signature is compared.

```typescript
// New store action, mirrors setGroupBedMedia's scoped-write shape exactly (src/stores/slideGroups.ts)
async function dismissReconciliation(orgId: string, slotId: string, signature: string): Promise<void> {
  const ref = doc(db, 'organizations', orgId, 'slideGroups', slotId)
  await updateDoc(ref, { dismissedSignature: signature, updatedAt: serverTimestamp() })
}
```

### Pattern 4: Duplicate (Research Focus #4)

**What a duplicate must change:** `id` (new `crypto.randomUUID()` — MUST be freshly minted, never
copied; invariant 2 in `slideGroup.ts` requires every entry's id to be unique and stable, and
`PresentationViewer`'s WR-02 media-child keying would otherwise collide two components on one id).
`order` shifts every later entry by one (mirrors the existing `nextOrder` pattern used everywhere
else in this codebase — `onAddSlide`, `appendVideoEntries`). `label`/`notes`/`audioUrl`/`audioScope`/
`audioLoop` and `sourceRef` are all copied BY VALUE from the original (this is "duplicate this slide,"
not "insert a blank slide after this one").

**id-minting scheme already established (verified, `slideGroupMaterializer.ts`/`SlideGrid.vue`):**
every entry id in this codebase is `crypto.randomUUID()`, minted at the moment of creation, never
derived from content or position. Duplicate must follow this exactly — do not slugify the label or
derive an id from the source ref, both of which would risk a collision with reconciliation's
by-`sectionId`/by-signature matching (which keys ONLY on `sourceRef` shape, never on `GroupSlideEntry.id`
itself, so a duplicated entry's fresh id cannot break reconciliation matching either way — but a
non-random id COULD collide with a future append).

**Selection follows the duplicate, not the original** (per UI-SPEC): after the write, set
`selectedSlideId.value = newEntry.id` in `SlidesTab.vue` (the write is fire-and-forget from the
drawer's perspective, but the id is known client-side before the write even lands, since it's
generated locally — no need to wait for the Firestore round trip to know what to select).

```typescript
// Source: pattern mirrors src/components/slides/SlideGrid.vue's onAddSlide (lines 304-331), direct read
async function onDuplicate(): Promise<void> {
  if (!selectedGroup.value || !selectedEntry.value) return
  const base = selectedGroup.value.slides
  const original = selectedEntry.value
  const duplicate: GroupSlideEntry = { ...original, id: crypto.randomUUID() }
  const idx = base.findIndex((e) => e.id === original.id)
  const next = [
    ...base.slice(0, idx + 1),
    duplicate,
    ...base.slice(idx + 1),
  ].map((e, i) => ({ ...e, order: i }))
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.selectedSlot!.id, next, selectedGroup.value.sourceSignature, base)
  selectedSlideId.value = duplicate.id  // exposed setter needed from SlidesTab, or emit up to it
}
```

### Pattern 5: Per-kind drawer shape (Research Focus #5)

Confirmed keyed on `GroupSlideEntry.sourceRef.kind`, NOT `Slide.contentKind` (both the UI-SPEC and
this research verified this independently by reading `src/types/slideGroup.ts`'s `SourceRef` union
against `src/types/slide.ts`'s `Slide` union — a PPTX-imported image and a PPTX-imported text slide
both carry `sourceRef.kind: 'imported'` while their resolved `contentKind` differs).

| `sourceRef.kind` | Field treatment | Navigation target |
|---|---|---|
| `lyric` | read-only, section lines | `Edit in song` → `/songs` query-param, Lyrics tab (see Pitfall 4 for the concrete mechanism — no route param exists today) |
| `copyright` | read-only, title/authors/CCLI#/license# | `Edit in song` → `/songs` query-param, **Details** tab (copyright fields live there) |
| `scripture` | read-only, passage text | `Edit in scripture` → same-page `activeTab = 'music'` (ServiceEditorView.vue's own tab ref) + expand that slot's `ScriptureSlideEditor` (see Pitfall 5 for the exact plumbing gap) |
| `imported` | read-only (PPTX text) or `<img>` alone | none |
| `video` | Slide Text section omitted entirely | none |
| `text` | editable `<textarea>`, 800ms debounce | none — "the drawer IS its home" |

## Reconciliation Confirm Flow

Covered in depth under Pattern 3 above. Summary of the write paths the modal needs:

| Action | Write | Signature used |
|---|---|---|
| `Apply source changes` | `replaceGroupSlides(orgId, slotId, pending.proposed, freshSignature)` — no `baseSlides` needed here since `proposed` is a full fresh derivation, not a delta (matches the existing watcher's own call at `useSlideshowAssembly.ts:449-455`, which DOES pass `outcome.group.slides` as `baseSlides` — **the modal should do the same**, for consistency with the CAS contract every other write path follows) | `pending.freshSignature` (needs to be added to `PendingReconciliation`, see gap above) |
| `Dismiss` | new scoped action `dismissReconciliation(orgId, slotId, freshSignature)` | writes `dismissedSignature` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide-over panel mechanics (Teleport, transitions, focus trap) | A new floating-panel implementation | `SongSlideOver.vue`'s exact markup/classes/transition timings (D-01) | Already shipped, already tested, already matches the app's established motion language |
| Compare-and-swap on concurrent writes | A custom optimistic-locking scheme | `replaceGroupSlides`'s existing `baseSlides`/`runTransaction` contract | Already handles the append-vs-append and append-vs-reorder races; reinventing it risks silently regressing CR-02's fix |
| Unsaved-edit confirm | A new confirm dialog/copy | `useUnsavedGuard` verbatim, same copy | D-16 explicitly says reuse, not invent |
| Media-degraded-state UI | A new "file missing" component | The `mediaFailed`/`onMediaError`/"Media unavailable" pattern `PresentationViewer.vue` already implements (see Pitfall 6 — this pattern is NOT inside `AudioPlayer.vue` itself) | Consistent visual language for the one other place this codebase already handles an expired-media file |
| Delete confirmation UI | A new modal | `SongSlideOver.vue`'s inline confirm-block shell (`rounded-lg bg-red-900/20 border border-red-800 p-4`) | UI-SPEC already specifies reusing this exact shell |

**Key insight:** every "don't hand-roll" item in this phase already has a shipped, working reference
implementation inside this same codebase (not a third-party library) — the discipline needed is
reading the reference correctly and reusing its exact contract, not searching for an external solution.

## Common Pitfalls

### Pitfall 1: The fallback-path id window (no `GroupSlideEntry` behind `selectedSlideId`)

**What goes wrong:** Immediately after a service loads (or a brand-new plan item is added), a slide
can render via `emitFallback` before its group has materialized. Its `slide.id` is a synthetic
`${slot.id}:${localSeq}` string with NO corresponding `GroupSlideEntry` — `selectedGroup.value.slides
.find(e => e.id === selectedSlideId.value)` returns `undefined` even though a card is selected.
**Why it happens:** `materializationCandidates`'s watcher (`useSlideshowAssembly.ts:259-289`) is
asynchronous (Firestore round trip); the fallback path exists specifically to render something during
that window.
**How to avoid:** the drawer must treat "selected slide id has no matching entry" as equivalent to "no
slide selected" (do not render, or render a lightweight loading state) rather than crashing on
`selectedEntry.value!`. In practice this window is sub-second for SONG/SCRIPTURE/IMPORTED slots with
real content (Phase 24 D-02 auto-materializes eagerly), so a simple `v-if="selectedEntry"` guard on
the drawer is sufficient — no special-cased spinner needed.
**Warning signs:** a test that selects a card the instant it renders (without `flushPromises()`
between mount and the materialize watcher's write) will hit this window; existing `SlideGrid.test.ts`
already awaits `flushPromises()` after mount for exactly this class of race.

### Pitfall 2: `replaceGroupSlides` is a full-array replace — a stale `baseSlides` silently discards work

**What goes wrong:** if the drawer captures `group.slides` once when it opens and reuses that same
captured array as `baseSlides` for every subsequent debounced write during a long-open session, any
Firestore-side change that landed in between (a reconciliation apply, another tab's edit) gets
silently overwritten on the NEXT drawer write even though CR-02's CAS mechanism exists specifically to
prevent this class of bug.
**Why it happens:** `baseSlides` protects against a race relative to when it was READ, not relative to
when the component was mounted.
**How to avoid:** always read `selectedGroup.value.slides` (a live prop/computed, not a captured
local) fresh at the moment each write's payload is computed — see Pattern 2's example, which does
exactly this.
**Warning signs:** a drawer left open across two edits from two different browser tabs where the
second tab's edit reverts the first.

### Pitfall 3: Teleport + shallowMount interactions (established codebase gotcha, applies twice here)

**What goes wrong:** `shallowMount` auto-stubs `<Teleport>` (renders nothing inside it), so assertions
against the drawer's OR the reconciliation modal's rendered content silently find nothing and tests
false-pass on an empty assertion, or false-fail on "element not found."
**Why it happens:** documented repeatedly in this codebase (`24-06`, `25-07` review notes) — this is a
known, recurring Vue Test Utils behavior, not new.
**How to avoid:** `mount()` (not `shallowMount`) with `stubs: { teleport: false }` when asserting
Teleported content directly, OR wrap assertions in `new DOMWrapper(document.body)` and call
`enableAutoUnmount(afterEach)` at the top of the test file so successive tests' Teleported nodes don't
leak into each other's assertions. **This phase has TWO independently Teleported surfaces** (the
drawer AND the reconciliation modal) — a test exercising both in the same file needs the auto-unmount
guard even more than a single-Teleport component would, since a leaked drawer node from a prior test
can satisfy a `find()` intended for the modal.

### Pitfall 4: `/songs` has no per-song route today — D-14's "navigate by route" needs a small addition, not a new route

**What goes wrong:** assuming a route like `/songs/:id` exists (it doesn't — confirmed by reading
`src/router/index.ts`: `/songs` is a flat list route with no id param) and trying to "route to it"
literally would 404 or silently do nothing.
**Why it happens:** `SongSlideOver.vue` is opened today purely from **local component state** in
`SongsView.vue` (`selectedSong`/`slideOverOpen` refs set by a row click) — there is no URL-addressable
song-detail state at all.
**How to avoid:** this codebase already has the exact needed precedent —
`SongsView.vue`'s `onMounted` already reads `route.query.import === 'true'` to auto-open the PC-import
modal, then clears the param via `router.replace()` (lines 287-296). The same one-shot query-param
convention should be extended: `router.push({ name: 'songs', query: { edit: songId, tab: 'lyrics' } })`
from the drawer, and a widened `onMounted` block in `SongsView.vue` that resolves `selectedSong` from
`songStore` by the `edit` query id, opens `slideOverOpen`, and sets `SongSlideOver`'s `activeTab` to
the `tab` query value (`SongSlideOver.vue` already has an internal `activeTab` ref — it would need a
prop or an exposed setter to be driven externally, since today it's purely internal and always resets
to `'details'` on open). **This is real new code in `SongsView.vue` and a small prop/expose widening in
`SongSlideOver.vue`, not an existing seam** — flag for the planner as its own task, not an incidental
line inside the drawer's own file.
**Warning signs:** a plan that treats "Edit in song" as "just use `router.push({ name: 'songs' })`" and
stops there will land on the song LIST, not the specific song's editor — D-14/D-15's requirement is
unmet.

### Pitfall 5: "Edit in scripture" needs cross-component plumbing ServiceEditorView.vue doesn't expose today

**What goes wrong:** the UI-SPEC says this link "switches the CURRENT service editor to its first tab
... and scrolls/focuses that slot's inline `ScriptureSlideEditor`" — but the scripture editor panel is
gated behind a PER-SLOT `expandedScriptureSlots: Set<number>` ref that lives entirely inside
`ServiceEditorView.vue` (`toggleScriptureEditor`, line 1333), collapsed by default. The drawer lives
several components deep inside `SlidesTab.vue` → `SlideGrid.vue`, which have no access to
`ServiceEditorView.vue`'s local `activeTab`/`expandedScriptureSlots` refs today — everything below
`ServiceEditorView.vue` is deliberately prop-driven with no upward store/composable reach (documented
constraint in `SlidesTab.vue`'s own header comment).
**Why it happens:** the Slides tab tree was built prop-down/emit-up on purpose (Phase 25's design), so
nothing under it can reach into `ServiceEditorView.vue`'s local component state directly.
**How to avoid:** thread an emit chain (drawer → `SlideGrid` → `SlidesTab` → `ServiceEditorView`) for
an event like `navigate-to-scripture-editor(slotArrayIndex: number)`, which `ServiceEditorView.vue`
handles by setting `activeTab.value = 'music'`, calling its existing `toggleScriptureEditor(index)`
(guarded so it only EXPANDS, never toggles closed, if already expanded — `toggleScriptureEditor`'s
current implementation should be checked for idempotency before reuse), then `nextTick()` + scrolling
the corresponding slot row into view (a `data-testid` or ref keyed on slot index already exists via
`scripture-editor-panel`, usable as a scroll target). **This is real new plumbing across four
components, not a one-line link** — flag for the planner as its own task with its own wave, since it
touches `ServiceEditorView.vue` (a file every other Phase 24-25 plan has deliberately minimized changes
to).
**Warning signs:** a plan that implements this as a plain `<a>`/router-link with no emit chain will
have no way to actually expand the collapsed scripture editor or switch tabs.

### Pitfall 6: The "reuse AudioPlayer's degraded-state text" instruction is slightly imprecise — the pattern lives one layer up

**What goes wrong:** `AudioPlayer.vue` itself (read directly) renders NO "Unavailable"/"Media
unavailable" text anywhere — it only emits an `error` event on the native `<audio>` element's `@error`.
The actual "Media unavailable" text and the `mediaFailed` state-tracking pattern the UI-SPEC's
Copywriting Contract references live in `PresentationViewer.vue` (its own `mediaFailed` ref +
`onMediaError` handler + a `<p data-testid="presentation-media-unavailable">Media unavailable</p>`),
NOT inside `AudioPlayer.vue`.
**Why it happens:** `AudioPlayer.vue` is a dumb, reusable primitive by design (Phase 23) — degraded-
state UI is deliberately the CONSUMING component's responsibility, not baked into the player.
**How to avoid:** the drawer needs its OWN `mediaFailed`-style ref and its OWN `@error` handler on its
own `AudioPlayer` instance, rendering its own "Unavailable" badge (per the UI-SPEC's own wording, on
the file row) — reusing the COPY and the PATTERN (listen for `@error`, flip a local ref, render a
small text/badge), not a shared component or composable that doesn't exist.
**Warning signs:** a plan task that says "pass a prop to AudioPlayer to show the unavailable state"
will not work — `AudioPlayer.vue` has no such prop and none should be added; the state belongs to the
caller.

### Pitfall 7: `SongSlideOver.vue`'s own pattern HAS a scrim — the drawer must actively omit it

**What goes wrong:** copying `SongSlideOver.vue`'s markup wholesale (as D-01 instructs, "reuse its
pattern") would also copy its backdrop `<div class="fixed inset-0 z-40 bg-black/30" @click="onCancel">`
block (lines 12-16 of that file) — but the UI-SPEC's Mockup Correction #7 explicitly requires NO scrim
at all for this drawer, since the grid must stay clickable underneath (D-03).
**Why it happens:** "reuse the pattern" is true for the panel shell/transitions/close-icon but
deliberately false for the backdrop — this is called out as a load-bearing deviation in the UI-SPEC,
not an oversight.
**How to avoid:** when adapting `SongSlideOver.vue`'s template, drop the entire backdrop `<Transition>`
block; keep only the panel `<Transition>` block. Do not wire `@click` on any full-screen element to
close the drawer — only the ✕ icon and `Escape` close it (per UI-SPEC).
**Warning signs:** a visual review showing the grid behind the drawer as dimmed/unclickable, or a click
on the grid unexpectedly closing the drawer.

## Code Examples

### Deriving the selected entry and its live group (drop-in for `SlidesTab.vue`)
```typescript
// Source: pattern derived from SlidesTab.vue's existing `selectedGroup` computed
// (lines 162-165), extended per Pattern 1 above.
const selectedEntry = computed<GroupSlideEntry | null>(() => {
  if (!selectedGroup.value || selectedSlideId.value === null) return null
  return selectedGroup.value.slides.find((e) => e.id === selectedSlideId.value) ?? null
})
```

### Audio scope write routing (D-09/D-10/D-11 — new file attach)
```typescript
// New file attached while scope pill = 'This slide only':
async function attachSlideAudio(url: string): Promise<void> {
  if (!selectedGroup.value || !selectedEntry.value) return
  const base = selectedGroup.value.slides
  const next = base.map((e) =>
    e.id === selectedEntry.value!.id ? { ...e, audioUrl: url, audioScope: 'slide' as const } : e,
  )
  await slideGroupsStore.replaceGroupSlides(orgId, slotId, next, selectedGroup.value.sourceSignature, base)
}

// New file attached while scope pill = 'All slides in this group' (D-09):
async function attachGroupAudio(url: string): Promise<void> {
  if (!selectedSlot.value) return
  // Entry's own audioUrl stays unset; audioScope stamped for UI round-trip only
  // (already-shipped 24-02 convention — the assembler never interprets it).
  await slideGroupsStore.setGroupBedMedia(orgId, selectedSlot.value.id, { serviceId, bedAudioUrl: url })
  if (selectedGroup.value && selectedEntry.value) {
    const base = selectedGroup.value.slides
    const next = base.map((e) =>
      e.id === selectedEntry.value!.id ? { ...e, audioScope: 'group' as const } : e,
    )
    await slideGroupsStore.replaceGroupSlides(orgId, slotId, next, selectedGroup.value.sourceSignature, base)
  }
}
```

## Runtime State Inventory

Not applicable — this is a greenfield addition to the Phase 24/25 slide-area model (D-19's boundary:
everything from Phase 18 onward is greenfield, nothing deployed). No migration, no legacy read path.
The one new field this phase adds (`SlideGroup.dismissedSignature`) needs no backfill — its absence on
every existing document is a valid, meaningful "never dismissed" state, handled by an `undefined !==
freshSignature` comparison that is true by default.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `dismissedSignature` as a new field on `SlideGroup` (rather than a separate collection/document) is the right persistence shape for D-07's durable dismissal | Pattern 3 | Low — CONTEXT.md explicitly leaves this as Claude's Discretion; a separate doc would work too but adds a second read for no benefit given `SlideGroup` is already subscribed live |
| A2 | `toggleScriptureEditor`'s current implementation can be made idempotent (expand-only) without behavioral regression to its existing toggle-closed use from its own button | Pitfall 5 | Medium — if it's a strict toggle, a second click on "Edit in scripture" while already expanded would collapse it instead of re-focusing; verify the function body before reusing it as an expand-only call |
| A3 | A thin `updateEntry()` helper co-located with the drawer (not in the store) is preferable to inlining `.map()` transforms at every call site | Pattern 2 | Low — either shape works; this is a code-organization preference, not a correctness concern |

## Open Questions

1. **Where does the `dismissReconciliation` store action live, and does it need its own CAS?**
   - What we know: it's a scoped single-field write (mirrors `setGroupBedMedia`'s shape), so a plain
     `updateDoc` (no transaction) is almost certainly sufficient — the field only tracks "have I seen
     and declined THIS exact signature," and a lost race between two dismissals of the same signature
     is harmless (both write the same value).
   - What's unclear: whether a race between a dismissal and a concurrent `Apply` (from a second tab)
     needs special handling — e.g. tab A dismisses signature S while tab B applies, changing
     `sourceSignature` away from S in the same moment. The dismissal write would still land, but would
     be comparing against a now-stale S.
   - Recommendation: no special handling needed — the next reconciliation computation naturally
     recomputes `freshSignature` against the CURRENT slot state and compares against the NEW
     `group.sourceSignature`, making a stale `dismissedSignature` value harmless (it simply won't match
     the new signature either, so it doesn't suppress anything it shouldn't).

2. **Does `SongSlideOver.vue` need a new prop to open directly on a specific tab, or should `SongsView.vue` set it via a ref/expose after mount?**
   - What we know: `SongSlideOver.vue`'s `activeTab` is purely internal, reset to `'details'` in its
     own `watch(() => props.open, ...)` handler (line 400) every time it opens.
   - What's unclear: whether to add an `initialTab?: 'details' | 'lyrics'` prop (clean, but couples the
     component to this phase's caller) or have `SongsView.vue` set `activeTab` via `defineExpose` after
     the watcher runs (fragile — depends on tick timing).
   - Recommendation: add the prop — it's the smaller, more testable change, and `SongSlideOver.vue`'s
     existing `watch` handler already has a natural place to read it (`activeTab.value = props.initialTab ?? 'details'`).

## Environment Availability

Not applicable — no external tools, services, or runtimes beyond what every other Phase 24-25 plan
already depends on (Firebase emulator, `.env.local`). No new dependency surface.

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json`'s `workflow` block — treated as
enabled per the default rule.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + `@vue/test-utils` |
| Config file | existing project `vitest` config (no new config needed) |
| Quick run command | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts src/components/slides/__tests__/ReconciliationConfirmModal.test.ts` |
| Full suite command | `npx vitest run src/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R033 | Drawer opens for `selectedSlideId`, follows selection changes, does not close on reselect (D-03) | unit (component) | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts` | ❌ Wave 0 |
| R033 | Label/notes/audio-scope/loop writes call `replaceGroupSlides`/`setGroupBedMedia` with correct `baseSlides` CAS args | unit (component, mocked stores) | same file | ❌ Wave 0 |
| R033 | Duplicate mints a fresh id, shifts `order`, selects the new entry | unit (component) | same file | ❌ Wave 0 |
| R033 | Delete shows the inline confirm with the correct one-of-four copy variant (audio/notes/both/neither) | unit (component) | same file | ❌ Wave 0 |
| R033 | Per-kind matrix: `lyric`/`copyright` show "Edit in song," `scripture` shows "Edit in scripture," `imported`/`video` show neither, `text` is inline-editable | unit (component, parametrized per kind) | same file | ❌ Wave 0 |
| R033 (D-16) | Navigating away with unsaved (debounced-pending) edits triggers `useUnsavedGuard`'s confirm | unit (component) | same file | ❌ Wave 0 |
| R029 | `needsConfirm` reconciliation renders the modal with correct singular/plural/media-clause copy | unit (component) | `npx vitest run src/components/slides/__tests__/ReconciliationConfirmModal.test.ts` | ❌ Wave 0 |
| R029 (D-07) | Dismiss writes `dismissedSignature`; a later render with the SAME `sourceSignature` does not re-show the modal/banner; a NEW divergence does | unit (composable/store) | `npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts` (existing file, extend) | ✅ existing file extended |
| R029 (D-08) | Song-swap variant renders `oldSongTitle`/`newSongTitle` copy correctly | unit (component + materializer) | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts src/components/slides/__tests__/ReconciliationConfirmModal.test.ts` | ✅ existing files extended |

### Sampling Rate
- **Per task commit:** the quick run command above (drawer + modal test files)
- **Per wave merge:** `npx vitest run src/components/slides/ src/composables/ src/utils/`
- **Phase gate:** `npx vitest run src/` full suite green (excluding the pre-existing, documented
  failures: `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`, and everything under
  `.gsd/quarantine/worktrees/**`) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/components/slides/__tests__/EditSlideDrawer.test.ts` — new file, covers R033
- [ ] `src/components/slides/__tests__/ReconciliationConfirmModal.test.ts` — new file, covers R029
- [ ] Extend `src/utils/__tests__/slideGroupMaterializer.test.ts` — add cases for the widened
      `ReconcileResult.songSwap` field
- [ ] Extend `src/composables/__tests__/useSlideshowAssembly.test.ts` (confirm exact filename before
      planning — verify it exists under that path) — add cases for `dismissedSignature` filtering and
      `PendingReconciliation.freshSignature`/`oldSongTitle`/`newSongTitle` threading
- Framework install: none — Vitest and Vue Test Utils are already configured project-wide.

## Security Domain

`security_enforcement` is not explicitly disabled in config — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — this phase adds no auth surface |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Every write this phase adds goes through `useSlideGroups` store actions, which are already gated by Firestore rules requiring `isOrgEditor(orgId)` (existing rule, unchanged) — the drawer/modal must gate their write-triggering UI on `isEditor` exactly as `SlideGrid.vue`/`SlideGroupMusicControl.vue` already do (`v-if="isEditor"`), never rely on the UI hiding alone |
| V5 Input Validation | yes | Label/notes text fields need no new validation beyond what `stripUndefined`/Firestore schema already provide; audio file validation already lives in `useMediaUpload` (MIME type + 50MB cap) |
| V6 Cryptography | no | No new crypto surface — `crypto.randomUUID()` usage is id generation, not cryptographic protection |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A viewer (non-editor) triggering a write via a route/query-param manipulation (e.g. crafting `?edit=<songId>` directly) | Elevation of Privilege | Firestore rules already deny non-editor writes server-side (defense in depth); the drawer/modal's write-triggering controls must additionally be `v-if="isEditor"`-gated client-side so a viewer never even sees the affordance, matching the existing pattern throughout `src/components/slides/` |
| A stale `baseSlides` CAS silently discarding a concurrent user's work (data-loss, not a security breach per se, but a failure-visibility concern R029 cares about) | Tampering (unintentional) | Always pass the FRESH `group.slides` as `baseSlides` at write time (Pitfall 2) |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `src/components/slides/SlidesTab.vue`, `SlideGrid.vue`, `SlideCard.vue`, `slideDisplay.ts` — the Phase 25 seam
- `src/types/slideGroup.ts`, `src/types/slide.ts` — `SourceRef`/`Slide`/`AssembledSlide` shapes
- `src/stores/slideGroups.ts` — `replaceGroupSlides`, `setGroupBedMedia`, CR-02's CAS mechanism
- `src/utils/slideGroupMaterializer.ts` — `reconcileGroup`/`reconcileSongGroup`/`hasCustomization`/`ReconcileResult`
- `src/utils/slideshowAssembler.ts` — `emitFromGroup`'s `id: entry.id` (the Pattern 1 crux fact)
- `src/composables/useSlideshowAssembly.ts` — `PendingReconciliation`, `pendingReconciliationsMap`, `applyReconciliationOutcomes`
- `src/components/SongSlideOver.vue`, `src/composables/useUnsavedGuard.ts` — the slide-over/unsaved-guard reuse targets
- `src/components/SlotMediaAttachment.vue`, `src/components/slides/SlideGroupMusicControl.vue` — audio attach/remove UI precedent
- `src/composables/useMediaUpload.ts`, `src/components/AudioPlayer.vue` — upload + playback primitives
- `src/views/ServiceEditorView.vue` — `deleteConfirmBody` (Phase 24 D-03 copy precedent), `activeTab`, `expandedScriptureSlots`/`toggleScriptureEditor`, the Slides-tab mount site
- `src/components/PresentationViewer.vue` — the actual `mediaFailed`/"Media unavailable" pattern (Pitfall 6)
- `src/views/SongsView.vue`, `src/router/index.ts` — confirms no per-song route exists; the `?import=true` query-param precedent (Pitfall 4)
- `.planning/phases/26-.../26-CONTEXT.md`, `26-UI-SPEC.md`, `.planning/phases/25-.../25-CONTEXT.md`, `.planning/STATE.md`, `.planning/milestones/v1.2-REQUIREMENTS.md`

### Secondary / Tertiary

None used. This phase required no external library research, no WebSearch, and no Context7 lookup —
every fact needed is internal-codebase-verifiable, and all internal facts above were confirmed by
direct file reads in this session rather than assumed from training data. No package-legitimacy check
was run since no new packages are introduced.

**Note on the knowledge graph:** `.planning/graphs/graph.json` exists but reports `stale: true` (30h
old, 116 commits behind current HEAD as of this research — Phase 25's plans 02-07 landed after the
last graph build). Direct source reads were used in preference to graph queries for this reason; the
graph was not queried further since it would very likely under-represent Phase 25's just-shipped
`slideGroups`/`slideGroupMaterializer`/`slideshowAssembler` structure this phase depends on most
heavily. Recommend `/gsd:graphify build` before Phase 27's research, once Phase 26 also lands.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every pattern reused was read directly from its source file this session
- Architecture: HIGH — the Pattern 1 crux (id equality) is verified against `slideshowAssembler.ts` source, not inferred
- Pitfalls: HIGH — every pitfall above traces to a specific, quoted line range in a specific file read this session; none are speculative
- Reconciliation gap (D-08 song names, `freshSignature` threading, durable dismissal): MEDIUM — the GAP itself is HIGH confidence (confirmed absent by direct read), but the RECOMMENDED FIX SHAPE (new fields, which layer resolves titles) is this researcher's design judgment, not something already decided in the codebase — flagged accordingly in the Assumptions Log

**Research date:** 2026-07-26
**Valid until:** 30 days, or immediately upon Phase 26 execution landing (several facts here — especially the exact line numbers cited — will shift the moment this phase's own commits land)
