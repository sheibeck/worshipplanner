# Phase 24: Slide Group Model and Migration - Research

**Researched:** 2026-07-25
**Domain:** Firestore data modeling, schema migration, pure-function assembly refactor (Vue 3 + Pinia + Firestore)
**Confidence:** HIGH (all core findings verified by direct code reading; algorithmic recommendations for reconciliation are reasoned design, tagged accordingly)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — `ServiceSlot` gets a stable `id` (locked).** Add `id: string` to `ServiceSlot`, lazily
backfilled when an existing service is read. Slide groups anchor to `slotId`. Why not position:
reordering rewrites `position`, so a drag on the Service Order tab would silently re-point groups
at the wrong items. Why not a content key (kind + songId/importId): breaks when the same song
appears twice in one service, and follows the wrong thing when a slot's song is swapped.

**D-02 — Materialize group structure; keep text a live reference (locked).** A slide group *is*
persisted per service — which slides exist, their order, their audio, labels and notes. Song and
scripture text is NOT copied; it continues to render live from the canonical song/scripture record.
Consequences: editing a song's lyrics still updates every service referencing it; there is no
"Generate missing slides" button — groups are always populated; a group must reconcile when its
underlying source changes shape (song gains a verse, scripture range widens, PPTX re-imported).
The rule: never silently drop a user's added slide, audio, label or note.

**D-03 — Deleting a plan item deletes its slide group, behind a confirm (locked).** No orphans, no
unanchored bucket. The delete must be gated by an explicit warning that names what will be lost
(slide count, whether any attached audio/video or operator notes are among it) and requires
confirmation. A silent cascade is not acceptable (R029).

**D-04 — Audio precedence: slide beats group (Claude's discretion, stated).** Two audio layers: a
group bed that plays across the group, and per-slide audio with a scope toggle (`this slide only` /
`all slides in this group`) and a `loop until next slide` flag. Precedence: per-slide audio wins over
the group bed for that slide; the bed resumes on the next slide with no audio of its own. `loop` is
a per-slide flag only — a group bed does not loop. Overridable.

**D-05 — Phase 22 media migrates lazily (Claude's discretion, stated).** `MediaAttachableSlot.audioUrl`
/ `videoUrl` move onto the group as its bed. Migration happens on read, not as a one-time script: a
service loaded without groups gets them constructed, and any slot media found is carried onto the
new group's bed. The old fields stay tolerated (readable) but deprecated, so a half-migrated
Firestore never breaks. Risk is genuinely low — this model shipped in Phase 22 and was never
deployed.

### Claude's Discretion

Store shape, Firestore collection layout vs embedding groups in the service document, group/slide id
generation, the reconciliation algorithm for D-02, and how `slideshowAssembler` is refactored to read
groups instead of deriving from scratch.

### Deferred Ideas (OUT OF SCOPE)

- Orphaned/unanchored slides and reassignment — the mockup's `UNANCHORED` block, "reassign"
  affordance, any notion of a slide group surviving its plan item. Explicitly revisited later.
- "Generate missing slides" header button — obsolete under D-02.
- Page-level "⇪ Import" header button — cut as redundant.
- Per-service slide text overrides — permanently out; D002 + D007 keep text canonical.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R028 | Slide groups owned by service plan items — order/membership mirror the plan; content/media/audio independent | See "Where do groups live" + "Slot id backfill" — groups anchor to `ServiceSlot.id`, not array index/position, so plan reordering (`reindexSlots`) never re-points a group. |
| R029 | Deleting a plan item deletes its slide group behind an explicit warning naming what's lost + confirmation, never a silent cascade | See "Deletion cascade" in Architecture Patterns and the Pitfall on orphaned group docs. |
| R030 | Two-level audio (group bed + per-slide with scope/loop), replacing Phase 22 slot-level media; existing slot media migrates onto its group | See "Audio precedence" and "Migration" sections; existing `AudioPlayer`/`PresentationViewer` contract requires zero changes for precedence, one small addition for `loop`. |
| R018 (supporting) | Polished, intuitive editor UX — cross-cutting; this phase advances it by NOT introducing a second save path or silent data loss during migration | See autosave-path integration findings; group store gets its own scoped writes exactly like `roleAssignmentOverrides`, so the existing `localService` deep-watch is not overloaded. |
</phase_requirements>

## Summary

This phase has no UI risk and all its risk concentrated in three places: (1) giving `ServiceSlot` a
stable `id` without disturbing the existing autosave/reorder machinery, (2) choosing where slide
groups live in Firestore without creating a second, competing save path on the `Service` document,
and (3) designing a reconciliation algorithm for three source kinds (song lyrics, scripture, imported
decks) whose slide-id stability characteristics are **completely different from each other** — a fact
discovered only by reading the actual id-generation code, not documented anywhere.

**Primary recommendation:** Store slide groups as a sibling Firestore collection
`organizations/{orgId}/slideGroups/{slotId}` (deterministic doc id = the slot's own stable id — this
codebase already uses deterministic ids for exactly this collision-avoidance reason, see
`serviceShares/{slug}__service-{date}`). Do NOT embed groups in the `Service` document. Backfill
`ServiceSlot.id` inside the same `JSON.parse(JSON.stringify(found))` assignment that already runs on
service load — both `localService.value` and `originalService.value` must receive the backfilled
copy, so the existing `autosaveInitialized` first-fire-skip absorbs the backfill with zero code
changes to the guard itself. Reconcile additively wherever a source has content-stable ids (song
lyric sections); anywhere ids are positional or opaque-random (scripture, PPTX re-import), do not
attempt automatic diffing — detect a structure change and surface a D-03-style confirm before
altering anything, per the "never silently drop" rule.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `ServiceSlot.id` backfill | Frontend Server (composable/store layer) | — | Happens at the same point the existing `serviceStore.services` watcher already deep-clones the doc into `localService`; no new tier introduced. |
| Slide group storage | Database (Firestore) | API/Backend (Pinia store) | New sibling collection, mirrors `scriptureReadings`/`importedSlides` exactly; store layer owns subscribe/CRUD, same convention as every other content store. |
| Group materialization + reconciliation | API/Backend (new composable, e.g. `useSlideGroups`) | Database (write side-effect) | Must stay OUTSIDE the pure `assembleSlideshow` function (which the codebase deliberately keeps side-effect-free) — mirrors the existing pure-engine/reactive-wrapper split (`slideshowAssembler.ts` vs `useSlideshowAssembly.ts`). |
| Assembler (structure+text resolution) | API/Backend (pure util) | — | `assembleSlideshow` stays a pure function; it now reads stored group structure instead of deriving it, but still resolves live text against the same `AssemblyInputs` maps. |
| Audio/video precedence computation | API/Backend (pure util, inside assembler) | — | Precedence is a pure data transform (per-slide field beats group field); it does not touch the player components at all. |
| Slot delete → group delete cascade | Frontend Server (`ServiceEditorView.vue` handler) | Database (store delete call) | Mirrors the existing slot-delete handler location; adds one store call + one confirm-modal reuse. |
| Media playback (loop attribute, bed pause/resume) | Browser/Client (`AudioPlayer.vue`, `PresentationViewer.vue`) | — | Existing imperative-driving contract from Phase 23 already keys everything off `AssembledSlide.slide.audioUrl`; only a `loop` boolean pass-through is new browser-tier work, and it is a native HTML attribute, not new interactive UI. |

## Standard Stack

No new external packages are introduced by this phase — it is a Firestore schema change, a Pinia
store, a migration function, and an assembler refactor, all using libraries already in the project
(`firebase/firestore`, `pinia`, `vue`). **Package Legitimacy Audit: N/A — no packages to verify.**

### Existing conventions this phase must follow (verified in codebase)

| Convention | Source | Why it matters here |
|---|---|---|
| Content-store shape: `{ id, ...fields, createdAt, updatedAt }` doc with `onSnapshot` subscribe/unsubscribe pair | `src/stores/scriptureSlides.ts`, `src/stores/importedSlides.ts` | The new `slideGroups` store must be built identically — same function names (`subscribeGroups`/`unsubscribeGroups`), same `orderBy('updatedAt','desc')` query shape. |
| `stripUndefined()` before every `addDoc`/`updateDoc` write of a content doc with optional fields | `src/utils/stripUndefined.ts`, used in `src/stores/importedSlides.ts` | Slide-group docs will have several optional fields (`label`, `notes`, `audioUrl`, `audioLoop`) — Firestore rejects literal `undefined`. |
| Deterministic Firestore doc id to prevent duplicate-write races between two viewers | `src/stores/services.ts::createShareToken` → `serviceShares/{slug}__service-{date}` (STATE.md, Phase 17) | Directly reusable precedent for the exact race this phase's lazy materialization creates (two tabs both first-load the same group). |
| Scoped dot-path field write instead of whole-document/whole-array rewrite, to avoid two editors clobbering each other | `src/stores/services.ts::setRoleOverride`/`clearRoleOverride` (`roleAssignmentOverrides.${roleId}`) | The group store's later per-slide edit actions (Phase 25/26 UI) should write `slides.${i}.field`-style dot paths where practical rather than rewriting the whole `slides` array, exactly like this precedent. |
| `createSlot()` omits absent optional keys entirely (conditional spread), never writes `key: undefined` | `src/utils/slotTypes.ts` (Phase 20 discipline, called out in CONTEXT.md) | The `id` backfill and any new slot/group fields must preserve this byte-shape discipline. |

## Package Legitimacy Audit

Not applicable — this phase adds no new npm/PyPI/crates dependencies.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ServiceEditorView.vue                                                   │
│  - localService (deep-watched, autosaves slots[] incl. slot.id)         │
│  - slot delete handler → ALSO calls slideGroups store delete(slotId)    │
└───────────────┬───────────────────────────────────────────────────────--┘
                │ service (Ref<Service|null>), orgId
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ useSlideGroupAssembly (NEW composable, replaces/wraps useSlideshowAssembly) │
│                                                                          │
│  1. subscribeGroups(orgId) ─────────────► slideGroups store (Firestore) │
│     (organizations/{orgId}/slideGroups/{slotId})                        │
│                                                                          │
│  2. for each service.slots entry (post id-backfill):                    │
│       groupsBySlotId.get(slot.id)                                      │
│         ├─ MISSING  → materializeGroup(slot) [pure derive + one write]  │
│         ├─ PRESENT, shape matches source → use as-is                    │
│         └─ PRESENT, shape diverges (reconciliation trigger)             │
│               → additive merge (song: new sectionId) OR                │
│               → flag "needs confirm" (scripture/PPTX: unstable ids)     │
│                                                                          │
│  3. assembleSlideshow(groups, AssemblyInputs) ── PURE, resolves LIVE    │
│     text from songLyricsById / scriptureReadingsById / importedDecksById│
│     and resolves effective audioUrl/videoUrl/loop by precedence (D-04)  │
│                                                                          │
│  4. returns assembledSlideshow (flat, unchanged shape) ─────────────────┼──► PresentationViewer.vue (Phase 23, unchanged)
│              assembledSections (grouped by SERVICE_SECTION)             │
└─────────────────────────────────────────────────────────────────────────┘
```

Data enters at the Service document (slots, ordered), is joined against the new `slideGroups`
collection (structure + audio + labels + notes) and the three EXISTING content stores (live text),
and exits as the same flat `AssembledSlide[]` Phase 23 already consumes — no breaking change to that
consumer.

### Recommended Project Structure

```
src/
├── types/
│   ├── service.ts          # ServiceSlot gets `id: string`
│   ├── slide.ts            # SlideBase gets `audioLoop?: boolean` (D-04); AssembledSlide gets
│   │                       #   optional groupId/groupSlideId (additive, Phase 25 needs these)
│   └── slideGroup.ts        # NEW: SlideGroup, GroupSlideEntry, SourceRef types
├── stores/
│   └── slideGroups.ts       # NEW: mirrors scriptureSlides.ts/importedSlides.ts exactly
├── utils/
│   ├── slotTypes.ts         # createSlot() generates id: crypto.randomUUID(); backfillSlotId() helper
│   ├── slideGroupMaterializer.ts   # NEW: pure derive-group-from-source + pure reconcile-diff
│   └── slideshowAssembler.ts       # REFACTORED: reads groups, resolves live text + audio precedence
└── composables/
    └── useSlideGroupAssembly.ts    # NEW (or extend useSlideshowAssembly): subscribes groups,
                                      # triggers lazy materialize/reconcile writes, calls assembler
```

### Pattern 1: Deterministic doc id to make lazy materialization idempotent

**What:** Use the slot's own stable `id` as the Firestore document id for its slide group
(`doc(db, 'organizations', orgId, 'slideGroups', slot.id)` + `setDoc(..., data, { merge: false })`
guarded by a prior `getDoc` check), instead of `addDoc`'s random auto-id.

**When to use:** Any time a write is "create this thing if it doesn't already exist" and could race
across two simultaneously-open tabs/viewers — the exact situation Quick-task #9 and Phase 17's
`serviceShares` doc already solved in this codebase.

**Why it matters here:** `addDoc` generates a new random id on every call. If two viewers load the
same service at nearly the same instant and both find "no group for this slot" on read, both would
call `addDoc` and create TWO divergent group documents for the same slot — a duplicate-write bug that
is silent (no error) and very hard to notice, since only one may end up referenced depending on which
`onSnapshot` update wins the render race. A deterministic id turns the race into a harmless
overwrite-with-equivalent-content instead of a duplicate.

```typescript
// Source: pattern verbatim from src/stores/services.ts::createShareToken
// (organizations/{orgId}/serviceShares/{slug}__service-{date}), applied to slide groups.
async function materializeGroupIfMissing(orgId: string, slotId: string, initialData: SlideGroupInput) {
  const ref = doc(db, 'organizations', orgId, 'slideGroups', slotId)
  const existing = await getDoc(ref)
  if (existing.exists()) return existing.data() as SlideGroup
  await setDoc(ref, {
    ...stripUndefined(initialData),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return null // caller re-reads via the live onSnapshot subscription, not this return value
}
```

### Pattern 2: Backfill rides the existing "initial load" assignment, not a new mutation

**What:** `ServiceSlot.id` backfill must happen INSIDE the same `JSON.parse(JSON.stringify(found))`
step that already runs in `ServiceEditorView.vue`'s `watch(() => serviceStore.services, ...)` handler
(around line 1545), applied identically to BOTH `localService.value` and `originalService.value`.

**When to use:** Any lazy backfill that must not trip the autosave watcher.

**Why it matters here (verified by reading the actual watcher, not assumed):** The autosave watcher
(`watch(localService, ..., {deep:true})`) has an `autosaveInitialized` flag that is deliberately reset
to `false` every time a NEW service doc is loaded or a remote merge lands, and its callback's first
firing after that reset is unconditionally skipped (`if (!autosaveInitialized) { autosaveInitialized
= true; return }`) — **regardless of `isDirty`**. This means the backfill can be folded directly into
the value assigned at load time, at zero extra engineering cost, with no risk of a spurious autosave.
The critical detail: if `originalService.value` is NOT given the same backfilled ids as
`localService.value`, `isDirty` computes `true` forever (since the two JSON-stringified snapshots
never match again) — the save itself will still be harmless because `reindexSlots`'s spread
(`{...slot, position: index}`) preserves the `id` field through every subsequent save, but the UI's
dirty-state indicator would be permanently wrong. Backfill BOTH refs identically.

```typescript
// Source: pattern derived from src/views/ServiceEditorView.vue L1539-1572 (verified read)
// and src/utils/slotTypes.ts's createSlot() byte-shape discipline.
function backfillSlotIds(service: Service): Service {
  let changed = false
  const slots = service.slots.map((slot) => {
    if ('id' in slot && slot.id) return slot
    changed = true
    return { ...slot, id: crypto.randomUUID() }
  })
  return changed ? { ...service, slots } : service
}

// In the watcher:
const found = services.find((s) => s.id === serviceId.value)
if (!found) return
const backfilled = backfillSlotIds(found)
if (!localService.value) {
  localService.value = JSON.parse(JSON.stringify(backfilled))
  originalService.value = JSON.parse(JSON.stringify(backfilled))
  // ...unchanged
}
```

The next REAL user edit's autosave call already writes `slots: reindexSlots(data.slots)` — since
`reindexSlots` spreads every existing key including the now-present `id`, the backfilled ids persist
to Firestore as a natural side effect of the next legitimate save. No explicit "write the ids back"
step is needed, and none should be added (an explicit write-on-load would be exactly the "spurious
save on every load" the CONTEXT.md warns against).

### Pattern 3: Reconciliation — the three source kinds have fundamentally different id stability

This is the hardest part of the phase and deserves the most explicit treatment. Verified by reading
the actual id-generation code for all three source kinds (not assumed):

| Source kind | Slide id generation (verified) | Stability across a "shape changed" event |
|---|---|---|
| Song lyric section (`LyricSlide.sectionId`) | `id: slugify(label)` in `src/utils/ccliParser.ts` (e.g. `"verse-1"`, `"chorus"`) | **Content-derived, semi-stable.** Re-pasting updated CCLI text regenerates ids from labels — if labels are unchanged (`Verse 1`, `Chorus`, `Verse 2`), the same ids reappear even though the underlying lyric text changed. A genuinely NEW section (e.g. a newly-added `Bridge`) gets a genuinely new id. Duplicate labels would collide (pre-existing limitation, not introduced by this phase). |
| Scripture chunk (`ScriptureSlide.id`) | `id: \`scripture-${position}\`` in `src/utils/scriptureSplitter.ts` | **Purely positional, UNSTABLE.** The entire passage is re-split from scratch by word count on every fetch/edit; widening a verse range shifts word-count boundaries and can completely reassign which id maps to which text, including for slides that didn't conceptually change. There is no content key to match against. |
| Imported PPTX/image deck slide (`TextSlide`/`ImageSlide` in an `ImportedDeck`) | `id: crypto.randomUUID()` assigned client-side in `src/components/PptxImportModal.vue` at import-confirm time | **Stable for that deck's lifetime, opaque and discontinuous across a re-import.** There is no "replace this deck's slides in place" flow in the codebase today — `createDeck()` always makes a brand-new deck document with brand-new random ids. A "re-imported PPTX" is, structurally, an entirely different deck with zero id relationship to the old one. |

**Recommended reconciliation strategy (Claude's discretion per CONTEXT.md — reasoned design, not
sourced from external docs):**

1. **Song groups:** diff by `sectionId`. A `sectionId` present in the fresh resolution but absent
   from the stored group → **insert** a new `GroupSlideEntry` at the correct order position (additive,
   silent, safe — this is exactly "a song gains a verse"). A `sectionId` present in the stored group
   but absent from the fresh resolution → **do NOT delete automatically.** Leave the entry in place
   (it will simply fail to resolve live text — render a "this section was removed from the song"
   placeholder) and require the user to explicitly remove it via the group's normal slide-delete
   affordance (Phase 26). This is the concrete mechanism that satisfies "never silently drop a user's
   added slide, audio, label or note" — automatic reconciliation is **additive-only**; removals are
   always a user action.
2. **Scripture groups:** do not attempt id-based diffing (the ids are not content-stable). On every
   materialization check, compare `resolvedReading.slides.length` and the concatenated text hash
   against what was stored at last materialization (store a `sourceContentHash` string on the group
   alongside each `GroupSlideEntry`, computed from the source's raw text — a simple hash function is
   sufficient, no crypto library needed). If they diverge AND the group has any user customization
   (non-empty `label`, `notes`, or `audioUrl` on any slide) — **do not auto-apply**; surface a
   confirm dialog naming what would change, mirroring D-03's delete-warning UX, and let the user
   choose "replace structure" (loses customization, explicit) vs "keep as-is" (structure now stale
   relative to source until the user acts). If there is no customization to lose, replace silently —
   this is safe because nothing user-authored exists to drop.
3. **Imported-deck groups:** same confirm-gated pattern as scripture — a re-import is, by definition, a
   full replace (unrelated new ids), so gate it behind an explicit confirm whenever the existing group
   has per-slide customization, exactly like the scripture case.

**Do NOT build a generic content-diffing/LCS algorithm across all three kinds** — the id stability
differences make a single algorithm either unsafe (treating scripture ids as if stable) or wasted
effort (song lyric sections already give you a clean stable key for free). Three small,
kind-specific reconciliation functions are simpler and safer than one generic one.

### Pattern 4: Audio/video field split (data-model resolution of an apparent asymmetry)

R030 states audio has two levels (group bed + per-slide with scope/loop); D-05 says BOTH
`audioUrl` AND `videoUrl` migrate "onto the group as its bed." Read together, this is not a
contradiction: **video stays group-bed-only (single field, no per-slide override, no scope, no
loop)** — R030 and D-04 only ever discuss two AUDIO layers — while **audio gets the new two-level
treatment.** Recommended `SlideGroup` shape:

```typescript
// Source: derived from D-02/D-04/D-05/R030 read together (not externally sourced — architectural
// synthesis flagged for planner confirmation).
export interface SlideGroup {
  id: string              // == the anchoring ServiceSlot.id (deterministic doc id, Pattern 1)
  serviceId: string        // for the delete-cascade lookup and any future cross-service query
  slotId: string           // redundant with id but explicit for readability/query clarity
  bedAudioUrl?: string      // migrated from MediaAttachableSlot.audioUrl (D-05)
  bedVideoUrl?: string      // migrated from MediaAttachableSlot.videoUrl (D-05) — video has no per-slide layer
  slides: GroupSlideEntry[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface GroupSlideEntry {
  id: string                     // crypto.randomUUID() at creation — NEVER regenerated (WR-02 contract, see Pitfall below)
  order: number
  sourceRef: SourceRef            // pointer back to canonical content for LIVE text resolution
  label?: string
  notes?: string                 // operator-only (R033 territory; field defined here so Phase 26 has somewhere to write)
  audioUrl?: string               // per-slide audio (R030) — audio ONLY, no per-slide video
  audioScope?: 'slide' | 'group'  // UI toggle (R030); 'group' scope is a convenience alias for
                                  //   "set this as the bed" — see note below
  audioLoop?: boolean             // D-04: loop is per-slide only
}

export type SourceRef =
  | { kind: 'lyric'; songId: string; sectionId: string }
  | { kind: 'scripture'; scriptureReadingId: string; innerSlideId: string }
  | { kind: 'imported'; importId: string; innerSlideId: string }
  | { kind: 'text' } // PRAYER/MESSAGE/HYMN placeholder slides — no live source to resolve
```

**Open design point for the planner (flag, do not silently resolve):** when a `GroupSlideEntry` sets
`audioScope: 'group'`, should this literally write `bedAudioUrl` on the parent `SlideGroup` (single
source of truth, no ambiguity if multiple entries claim group scope), or should the assembler compute
"effective bed" as "the last slide-with-group-scope at or before the current position, else
`bedAudioUrl`"? The former (write directly to `bedAudioUrl`) is simpler and has zero ambiguity;
recommend it, but this is a Claude's-discretion point the plan should state explicitly rather than
leave implicit in code.

### Pattern 5: Pure assembler stays pure; materialization/reconciliation is a side-effecting caller

`assembleSlideshow` (`src/utils/slideshowAssembler.ts`) is explicitly documented as a pure function
("performs no Firestore reads and touches no Pinia store or Vue reactivity"). This phase must NOT
break that invariant. Group materialization (the `addDoc`/`setDoc` write when a slot has no group
yet) and reconciliation-confirm-gating are Firestore side effects and belong in the reactive
composable layer (`useSlideshowAssembly.ts` today, or a renamed/extended
`useSlideGroupAssembly.ts`), exactly mirroring the existing split established in Phase 20 between
`slideshowAssembler.ts` (pure) and `useSlideshowAssembly.ts` (reactive wrapper that loads content
maps and re-invokes the pure function). The refactored pure function's new job: given
`groupsBySlotId: Map<string, SlideGroup>` plus the SAME `AssemblyInputs` maps as today, walk
`service.slots` sorted by `position` (unchanged from today), look up each slot's group by `slot.id`,
and for each `GroupSlideEntry` resolve live text via `sourceRef` and effective audio via the
precedence rule (Pattern 4) — emitting the same `AssembledSlide[]` shape Phase 23 already consumes.

### Anti-Patterns to Avoid

- **Embedding `slideGroups` as an array field on the `Service` document.** Every autosave write on
  `ServiceEditorView` already rewrites the whole `slots` array (`updateService(id, {..., slots:
  reindexSlots(data.slots)})`) via the SAME 800ms-debounced whole-document write path used for
  sermon-topic edits, team toggles, and drag-reorder. Embedding groups there means every unrelated
  slot edit also re-serializes potentially dozens of slides' worth of label/notes/audio data on every
  autosave tick, and puts group-editing (Phase 25/26 UI) and slot-editing (existing UI) in a
  concurrent-write collision on the exact same document with no dot-path scoping — unlike
  `roleAssignmentOverrides`, which already got a dedicated scoped-write path (`setRoleOverride`)
  specifically to avoid this problem. Do not repeat the problem `setRoleOverride` was built to solve.
- **Using `addDoc` (random id) for group materialization.** Creates the two-tabs-race duplicate-doc
  bug described in Pattern 1. Use a deterministic id.
- **Treating scripture/imported-deck slide ids as content-stable.** They are not (see Pattern 3's
  table) — id-based diffing there will silently mismatch text to the wrong customization.
- **Writing an explicit "persist the backfilled ids" call on load.** Unnecessary — the existing
  autosave path already persists them opportunistically on the next real edit (Pattern 2). An
  explicit write-on-load is exactly the "spurious save on every load" CONTEXT.md warns against.
- **Regenerating `GroupSlideEntry.id` (or `Slide.id`) from position/index at assembly time**, the way
  today's `assembleSlideshow` does (`id: \`${slotIndex}:${localSeq}\``). `PresentationViewer.vue` keys
  its `AudioPlayer`/`VideoPlayer` child instances on `slide.id` specifically so a reorder or
  reconciliation doesn't leak stale muted/blocked state from one slide onto another (documented as
  "WR-02" in the existing code). Once slides are persisted, `Slide.id` must come from the stored
  `GroupSlideEntry.id` (a real stable UUID), never be recomputed from slot index or emission order.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preventing duplicate lazy-write races | A mutex/lock service, a Cloud Function transaction, or a "check-then-create" retry loop | Deterministic Firestore doc id (`doc id = slot.id`) + plain `setDoc` | Already the exact pattern this codebase uses for `serviceShares`; a lock/transaction is unnecessary complexity for a race whose worst case (without the fix) is a silently-overwritten duplicate, not data corruption. |
| Detecting "did the source content change shape" | A generic tree-diff/LCS library | Length/id comparison per source kind (Pattern 3) | The three source kinds have such different id semantics that a generic diff algorithm would need per-kind configuration anyway — a purpose-built comparison per kind is both simpler and more correct. |
| Undefined-field stripping before Firestore writes | Ad-hoc per-field `?? null` handling in the new store | `src/utils/stripUndefined.ts` (already exists, already used by `importedSlides.ts`) | Reuse, don't reinvent — it already handles arrays and nested plain objects correctly. |

**Key insight:** the temptation in this phase is to build a single generic "reconcile any list against
any source" utility. Resist it — the id-stability table in Pattern 3 shows the three source kinds
need genuinely different handling, and a generic abstraction over them would hide that difference
rather than expose it, making the "never silently drop" invariant harder to verify by inspection.

## Runtime State Inventory

This phase adds a required field (`ServiceSlot.id`) to every existing `Service` document's `slots`
array and migrates media fields from slot-level to group-level — both are schema migrations of
existing stored data, not a rename, but the same "what does a grep audit miss" discipline applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Every existing `Service` document's `slots[]` entries lack `id` (verified: `src/types/service.ts` — no variant has an `id` field prior to this phase; `src/utils/slotTypes.ts::createSlot`/`buildSlots` never emit one). Existing slots may carry `audioUrl`/`videoUrl` (Phase 22, shipped but never deployed per D-05's own risk note). | Lazy on-read backfill (Pattern 2) for `id`; lazy on-read migration onto the new group's bed (Pattern 1/4) for `audioUrl`/`videoUrl`. Both are code-path changes, NOT a one-time migration script — no batch job needed. |
| Live service config | None — no external service (Planning Center, ESV API) stores or references `ServiceSlot`/slide-group shape. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — no secret or env var name references slots or slides. | None. |
| Build artifacts | None — this phase adds a new collection/type/store; it does not rename or remove any package, binary, or installed artifact. | None. |

**The canonical question, answered:** after this phase ships, every `Service` document loaded through
`ServiceEditorView` gets its `slots[].id` populated in memory immediately and in Firestore on the
next real edit; every slot that had Phase 22 media gets a `slideGroups/{slotId}` document created on
first read, carrying that media onto `bedAudioUrl`/`bedVideoUrl`; nothing else in the system (Storage
paths, Cloud Functions, Planning Center export, share tokens) references the old shape in a way that
would break.

## Common Pitfalls

### Pitfall 1: Old Phase-22 media UI stays wired to fields the new assembler stops reading

**What goes wrong:** `SlotMediaAttachment.vue` (still mounted in `ServiceEditorView.vue`'s slot rows
today) writes to `slot.audioUrl`/`slot.videoUrl`. If, after this phase ships, the refactored assembler
reads media EXCLUSIVELY from `SlideGroup.bedAudioUrl`/`bedVideoUrl` (not from the slot at all), then
any NEW attachment a user makes via the still-visible OLD control silently stops reaching the
presentation — no error, just a video/audio that never plays. R034/Phase 27 is the phase that
formally removes Phase 18-23's slide-editing surfaces from the (renamed) Service Order tab, so this
old control is not automatically gone when Phase 24 ships.

**Why it happens:** D-05's migration is deliberately lazy/read-triggered, but it only fires when a
group is FIRST materialized for a slot — it is not a continuous bridge that re-syncs on every render.

**How to avoid:** Remove (or at minimum, stop rendering) `<SlotMediaAttachment>` and its
`onSlotAudioUrlChange`/`onSlotVideoUrlChange` handlers from `ServiceEditorView.vue` as part of THIS
phase's scope, even though the phase otherwise ships no UI — this is a UI *removal*, not a new
surface, and is explicitly named as retired in `docs/design/README.md`'s canonical references. Flag
this as an explicit task in the plan rather than letting it fall silently to Phase 27; note the
`ui-plan-gate: frontend: false` framing may need a one-line carve-out for "delete this component
usage" vs "build new UI."

**Warning signs:** A code-reviewer finds `slot.audioUrl` still being written anywhere after this phase
merges, or a manual test attaches media via the old control and it doesn't show up in
`PresentationViewer`.

### Pitfall 2: Reordering plan items must NOT touch group documents at all

**What goes wrong:** A naive implementation "helpfully" re-keys or re-writes group documents when
`reindexSlots` runs (e.g., trying to keep some `slotIndex`-based field in sync).

**Why it happens:** The existing assembler currently threads `slotIndex` (array position) through
`AssembledSlide.slotIndex` and even into the transient slide id (`${slotIndex}:${localSeq}`) — a
developer refactoring this code might reflexively try to preserve that pattern.

**How to avoid:** Once groups anchor to `slot.id` (stable across reorder) instead of `slotIndex`
(rewritten on every reorder by `reindexSlots`), NO write to any `slideGroups` document should ever be
triggered by a reorder. This is the entire point of D-01. Verify by test: reorder a service's slots
and assert the `slideGroups` store's `updateDoc`/`setDoc` mocks were never called.

**Warning signs:** A test that reorders slots and then asserts on Firestore write call counts to
`slideGroups` — if it's nonzero, D-01's guarantee has been violated.

### Pitfall 3: Deleting a slot without deleting its group leaves an orphan the UI can never reach

**What goes wrong:** The existing slot-delete handler (`localService.value.slots.splice(index, 1);
localService.value.slots = reindexSlots(...)`, around `ServiceEditorView.vue` line 1781) only touches
the in-memory `Service.slots` array. If the group-delete call is forgotten, the `slideGroups/{slotId}`
document is never removed — a genuine storage leak and a D-03/R029 violation (the plan item's group
must be deleted, not orphaned).

**How to avoid:** The slot-delete handler must, BEFORE (or atomically alongside) the splice, resolve
`slots[index].id`, look up (or already have, via the live `slideGroups` subscription) the matching
group, compute the warning copy (slide count + audio/video/notes present — the exact copy example
CONTEXT.md gives: *"Deleting 'This Is Our God' also deletes its 6 slides, including 1 attached audio
file."*), show the existing confirm-modal pattern (this codebase already has a delete-confirm flow
for slots — reuse its shape), and only on confirm perform BOTH the splice and the group-store delete
call together.

### Pitfall 4: Confusing "additive reconciliation" with "silent replace"

**What goes wrong:** A tempting shortcut for song-lyric reconciliation is "just re-run
`resolveSongOrder` and rebuild the group's slide list from scratch every time," discarding whatever
was stored. This is NOT additive reconciliation — it silently drops any label/notes/audio a user
attached to a specific `GroupSlideEntry`, directly violating D-02's rule.

**How to avoid:** Reconciliation must merge INTO the existing stored `slides[]` array by `sectionId`
(insert new entries for new sections; leave existing entries — including their customization — alone
for sections that still resolve; never delete/rebuild the whole array).

**Warning signs:** A reconciliation unit test that attaches a label to a `GroupSlideEntry`, then
triggers reconciliation with an unrelated new verse added to the song, and asserts the label
survives — if this test doesn't exist, or fails, the pitfall has been hit.

## Code Examples

### Slide-group store, mirroring the established content-store convention

```typescript
// Source: pattern verbatim from src/stores/importedSlides.ts (verified read), retargeted
// at organizations/{orgId}/slideGroups.
export const useSlideGroups = defineStore('slideGroups', () => {
  const groups = ref<SlideGroup[]>([])
  const isLoading = ref(true)
  let unsubscribeFn: Unsubscribe | null = null

  function subscribeGroups(orgId: string) {
    if (unsubscribeFn) unsubscribeFn()
    isLoading.value = true
    const q = query(collection(db, 'organizations', orgId, 'slideGroups'), orderBy('updatedAt', 'desc'))
    unsubscribeFn = onSnapshot(q, (snap) => {
      groups.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SlideGroup)
      isLoading.value = false
    })
  }

  function unsubscribeGroups() {
    unsubscribeFn?.(); unsubscribeFn = null; groups.value = []; isLoading.value = true
  }

  async function deleteGroup(orgId: string, slotId: string) {
    await deleteDoc(doc(db, 'organizations', orgId, 'slideGroups', slotId))
  }

  // materializeIfMissing / reconcile actions per Pattern 1/3 ...

  return { groups, isLoading, subscribeGroups, unsubscribeGroups, deleteGroup /* , ... */ }
})
```

### No Firestore rules changes needed for the new collection (verified)

```
// firestore.rules already has (verbatim, current file):
match /organizations/{orgId} {
  // ...
  match /{collection}/{docId} {
    allow read, write: if isOrgEditor(orgId);
  }
}
```

`organizations/{orgId}/slideGroups/{slotId}` is a single-segment subcollection directly under the
org — it matches this existing generic catch-all rule with ZERO changes required, exactly the way
`scriptureReadings` and `importedSlides` already do today with no dedicated rule block of their own.
**Explicit rules changes are only needed if slide-group content is ever stored as a DEEPER nested
subcollection** (e.g., `slideGroups/{slotId}/slides/{slideId}`) — the `lyrics` subcollection under
`songs` needed its own explicit block for exactly that reason (the generic catch-all only matches
single-segment paths). This phase's recommended shape (Pattern 4: `slides` as an embedded ARRAY
field, not a subcollection) avoids that entirely. **Because no rules file changes are required, the
STATE.md constraint to defer `test:rules`/emulator work does not block this phase's completion** — it
would only become relevant if the plan chooses a nested-subcollection shape instead of the
recommended embedded-array shape.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `audioScope: 'group'` should write directly to `bedAudioUrl` rather than being computed at assembly time from "last group-scoped entry before this position" | Pattern 4 | Low — this is presented as an explicit open design point for the planner to confirm/override, not silently baked in. If the alternate (computed) interpretation is wanted, the assembler's precedence function changes but the stored data shape does not need to. |
| A2 | A simple length/id-count comparison (plus a lightweight content hash) is sufficient to detect "scripture/imported source changed shape," rather than a more sophisticated diff | Pattern 3 | Medium — if a scripture range widens by exactly the same slide count (rare but possible, e.g. re-fetch after an ESV text correction of equal length), the naive length check would miss the change entirely and skip the confirm-gate. Recommend hashing concatenated slide text, not just counting slides, to reduce this risk (already reflected in the Pattern 3 text). |
| A3 | Removing `SlotMediaAttachment` from `ServiceEditorView.vue` belongs in Phase 24's scope (as a UI *removal*) rather than being deferred entirely to Phase 27 | Pitfall 1 | Medium — if the planner instead defers this to Phase 27, there will be a multi-phase window (24→27) where the old media-attach control is live but functionally inert; this must at minimum be called out explicitly in the plan as an accepted, temporary limitation rather than an unnoticed gap. |
| A4 | The 1 MiB Firestore document-size concern for embedding groups on the `Service` doc is a real risk in THIS project's usage pattern (multi-deck sermons, multiple attached media), not merely a theoretical limit | "Where do groups live" (Summary) | Low — even if actual document sizes stay well under 1 MiB in practice, the sibling-collection recommendation is independently justified by the write-collision/autosave-coupling argument, which holds regardless of document size. |

## Open Questions

1. **Does `audioScope: 'group'` write to `bedAudioUrl` directly, or get computed at assembly time?**
   - What we know: R030/D-04 define the toggle's two states in UX terms only.
   - What's unclear: which is simpler to implement correctly without ambiguity when a group has
     multiple slides.
   - Recommendation: write directly to `bedAudioUrl` (Pattern 4) — simpler, no ambiguity, and the plan
     should say so explicitly rather than let it be an implicit code choice.

2. **Should `SlotMediaAttachment` be removed/hidden in Phase 24, or left live until Phase 27?**
   - What we know: leaving it live creates a functionally-inert control (Pitfall 1); removing it is a
     UI change in a phase whose gate says `frontend: false`.
   - What's unclear: whether "remove a component's usage" counts as UI work requiring a UI-SPEC, or is
     small enough to be a plain refactor task.
   - Recommendation: treat as a refactor task (delete component usage + its two handler functions),
     not a UI-SPEC-requiring feature; call it out explicitly as a task in the plan.

3. **Content hash function for scripture/imported reconciliation shape-detection (Pattern 3, A2).**
   - What we know: any simple deterministic string hash (e.g., a small djb2/FNV implementation, or
     even `slides.map(s => s.text ?? s.imageUrl).join('|').length` as a cheaper proxy) is sufficient —
     cryptographic strength is not needed, this is change-detection, not security.
   - What's unclear: whether the plan should introduce a tiny hash utility or accept the cheaper
     length/text-concatenation proxy.
   - Recommendation: start with the cheaper proxy (no new utility, no new dependency); revisit only if
     it produces observed false negatives.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | none dedicated — unit tests run via the default Vite/Vitest config (`vite.config.ts`); a separate `vitest.rules.config.ts` exists ONLY for the (not-to-be-run-this-phase) Firestore/Storage rules suite. |
| Quick run command | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` (or whichever new test file), `npx vitest run src/stores/__tests__/slideGroups.test.ts` |
| Full suite command | `npx vitest run src/` (per STATE.md's documented safe-command list; do NOT run `npm run test:rules` and do NOT start/restart the emulator — a live user session may hold ports 8080/9199) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R028 | Reordering slots never re-points a group (write count to `slideGroups` mocks stays zero across a reorder) | unit (store/composable) | `npx vitest run src/composables/__tests__/useSlideGroupAssembly.test.ts` | ❌ Wave 0 |
| R028 | `ServiceSlot.id` backfill happens on load without marking the doc dirty or triggering an autosave write | unit (component/view) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` (extend existing file) | ✅ (extend existing file) |
| R029 | Deleting a slot deletes its group; the confirm copy names slide count + attached media/notes; declining leaves both intact | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` (extend) | ✅ (extend existing file) |
| R030 | Per-slide audio overrides the group bed for that slide only; the bed resumes on the next slide with no override | unit (pure assembler) | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` (extend existing file) | ✅ (extend existing file) |
| R030 | `audioLoop` is emitted on the resolved slide only when the SOURCE per-slide entry set it — group bed never carries loop | unit (pure assembler) | same file as above | ✅ (extend existing file) |
| D-02 | Song reconciliation is additive: new lyric section appears as a new `GroupSlideEntry`; removed section's existing entry (with its customization) is retained, not deleted | unit (new util) | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` | ❌ Wave 0 |
| D-02 | Scripture/imported reconciliation with existing customization surfaces a confirm-required flag rather than silently replacing | unit (new util) | same new file as above | ❌ Wave 0 |
| D-05 | Migration: a slot with `audioUrl`/`videoUrl` and no existing group produces a group whose `bedAudioUrl`/`bedVideoUrl` equal the slot's values, in one atomic create | unit (new store/util) | `npx vitest run src/stores/__tests__/slideGroups.test.ts` | ❌ Wave 0 |
| D-05 | Materialization is idempotent under a simulated concurrent double-call (deterministic id de-dupes; no duplicate document created) | unit (new store) | same new file as above | ❌ Wave 0 |
| — | Assembler output shape (`AssembledSlide[]`) stays compatible with `PresentationViewer.vue`'s existing consumption | unit (existing consumer test, regression) | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` (no changes expected, must stay green) | ✅ (regression guard only) |

### Sampling Rate

- **Per task commit:** the specific new/extended test file for that task (`npx vitest run <path>`)
- **Per wave merge:** `npx vitest run src/` (full suite — excludes `test:rules`/emulator per STATE.md constraint)
- **Phase gate:** Full suite green before `/gsd-verify-work`; `npm run type-check` and `npm run build`
  also green (both are on the documented safe-command list).

### Wave 0 Gaps

- [ ] `src/types/slideGroup.ts` — new types (`SlideGroup`, `GroupSlideEntry`, `SourceRef`) — no test
      file needed for pure type declarations, but downstream test files below depend on it existing.
- [ ] `src/stores/__tests__/slideGroups.test.ts` — new store test file, mirroring
      `src/stores/__tests__/scriptureSlides.test.ts`'s mocking convention (mock `firebase/firestore`
      module functions directly + mock `@/firebase`'s `db` export + a captured `snapshotCallback`).
      Covers subscribe/unsubscribe, delete, and the deterministic-id materialize-if-missing action.
- [ ] `src/utils/__tests__/slideGroupMaterializer.test.ts` — new pure-function test file for the
      derive-from-source and reconcile-diff logic (Pattern 3), independent of Firestore entirely
      (pure input/output, no mocking needed — matches `slideshowAssembler.test.ts`'s existing style).
- [ ] `src/composables/__tests__/useSlideGroupAssembly.test.ts` — new (or extends
      `useSlideshowAssembly.test.ts`) — covers the reactive wiring: subscribe-on-org-change,
      materialize-on-missing-group, and that a reorder never triggers a `slideGroups` write.

*(No gaps for R030's audio precedence — it extends the existing, already-covered
`slideshowAssembler.test.ts` pure-function suite, which already has full input/output coverage
patterns to follow.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — Firebase Auth, no new auth surface introduced by this phase. |
| V3 Session Management | no | Unchanged. |
| V4 Access Control | yes | Reuses the existing `isOrgEditor(orgId)` catch-all rule (`firestore.rules`, verified — no new rule block needed for a single-segment sibling collection under `organizations/{orgId}`, exactly like `scriptureReadings`/`importedSlides` today). |
| V5 Input Validation | yes | `stripUndefined()` before every write (existing utility); no new user-controlled URL fields are introduced beyond what Phase 22 already validates via `useMediaUpload`'s existing size/type checks and Storage rules' `request.resource.size` cap — media URLs simply move which document field references them, they are not newly user-supplied. |
| V6 Cryptography | no | No cryptographic material — `crypto.randomUUID()` usage here (slot/group-slide ids) is for uniqueness, not security, matching its existing non-cryptographic use in `pptxUpload.ts`/`csvImport.ts`. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org data leakage via a missing/mis-scoped Firestore rule for a new collection | Elevation of Privilege / Information Disclosure | Confirmed via direct rules-file reading that the generic `match /{collection}/{docId} { allow read, write: if isOrgEditor(orgId) }` catch-all under `organizations/{orgId}` already covers a new single-segment sibling collection — no new rule needed, hence no new attack surface, PROVIDED the plan does not introduce a deeper nested subcollection (which would fall through to the global deny-all until an explicit rule is added, mirroring why `lyrics` under `songs` needed its own block). |
| Duplicate/racing writes creating divergent state two viewers might disagree about | Tampering (data integrity, not confidentiality) | Deterministic doc id (Pattern 1) — not a confidentiality issue, but a correctness one; documented here because it's the phase's main "two simultaneous editors" risk, mirroring the precedent that motivated `roleAssignmentOverrides`'s scoped writes. |
| Silent data loss during migration/reconciliation | (Not a STRIDE category — an availability/integrity-of-user-work concern specific to this phase) | The additive-only reconciliation rule (Pattern 3) and confirm-gating for ambiguous cases (Pitfall 4) are the mitigation; this is the phase's actual "security-adjacent" risk in the loose sense of "don't destroy user data without consent," which R029 and D-02 both explicitly demand. |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)

- `src/types/service.ts` — `ServiceSlot` union, `MediaAttachableSlot`, `Service` shape (full read)
- `src/types/slide.ts` — `Slide` union, `AssembledSlide`, `AssembledSection`, `DistributiveOmit` (full read)
- `src/utils/slideshowAssembler.ts` — `assembleSlideshow` full implementation (full read)
- `src/composables/useSlideshowAssembly.ts` — reactive wrapper, subscribe/loading pattern (full read)
- `src/utils/slotTypes.ts` — `createSlot`, `reindexSlots`, `buildSlots`, section-omission discipline (full read)
- `src/stores/scriptureSlides.ts`, `src/stores/importedSlides.ts`, `src/stores/songLyrics.ts` — content-store conventions (full reads)
- `src/stores/services.ts` — `updateService`, `assignSongToSlot`, `setRoleOverride`/`clearRoleOverride` scoped-write precedent, `createShareToken` deterministic-id precedent (full read)
- `src/views/ServiceEditorView.vue` — autosave watcher, initial-load watcher, `autosaveInitialized` guard, Sortable reorder handler, slot delete/media handlers (targeted reads, ~400 lines across several ranges)
- `firestore.rules`, `storage.rules` — full reads; confirmed the generic catch-all covers a new sibling collection with zero changes
- `src/components/AudioPlayer.vue`, `src/components/SlotMediaAttachment.vue`, `src/components/PresentationViewer.vue` (targeted sections) — imperative media-driving contract, `slide.id`-keyed component instancing (WR-02)
- `src/types/scriptureReading.ts`, `src/types/importedDeck.ts` — confirmed embedded-array-field convention (`slides: Slide[]` on the doc, not a subcollection)
- `src/utils/ccliParser.ts`, `src/utils/scriptureSplitter.ts`, `src/components/PptxImportModal.vue` — verified the three different slide-id generation strategies (Pattern 3's central table)
- `src/utils/stripUndefined.ts` — verified utility to reuse
- `.planning/STATE.md` — milestone decisions, Phase 17 `serviceShares` deterministic-id precedent, sequential-main-tree/emulator constraints
- `.planning/phases/24-slide-group-model-and-migration/24-CONTEXT.md` — locked decisions D-01..D-05
- `.planning/milestones/v1.2-REQUIREMENTS.md` — R028-R030, R018

### Secondary (MEDIUM confidence)

- `docs/design/README.md` — turn map and mockup-vs-instruction deltas (design contract, not code; treated as directional guidance, not implementation detail)

### Tertiary (LOW confidence)

- None — this research was conducted entirely against the actual codebase; no web search was needed
  or performed, since every question the phase raises is answerable by reading how this specific
  project already generates ids, structures content stores, and drives autosave.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all conventions verified by direct reads of the exact files being extended.
- Architecture (group storage location, backfill timing, deletion cascade): HIGH — every claim traces to a specific verified line range in the codebase.
- Reconciliation algorithm: MEDIUM — the id-stability facts are HIGH confidence (verified code), but the recommended reconciliation ALGORITHM itself is Claude's architectural judgment (explicitly invited by CONTEXT.md's "Claude's Discretion" section), not sourced from external documentation. Flagged accordingly throughout and logged in the Assumptions table.
- Pitfalls: HIGH — all four are grounded in specific, named, currently-existing code paths, not speculative.

**Research date:** 2026-07-25
**Valid until:** 30 days (stable, internal-codebase-grounded research; re-verify if Phase 22/23 code changes materially before this phase executes, or if `docs/design/slides-tab.dc.html` is re-pulled with new turns before planning).
