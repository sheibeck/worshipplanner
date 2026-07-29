# Phase 30: Slides Mirror the Plan — Hard Lock & Reconciliation Removed - Research

**Researched:** 2026-07-28
**Domain:** Brownfield deletion + behavioral rewrite of a shipped Vue 3 + Firebase subsystem (slide-group reconciliation), inside a greenfield (never-deployed) area of the codebase
**Confidence:** HIGH — every consumer claim below is grep-verified against live `src/` files read in full in this session, not inferred from the graph (which is 270 commits / 79 hours stale and resolves into `.gsd/quarantine/worktrees/**`, confirmed via `graphify status`; it was not used for any claim in this document). The one area with genuine design latitude (exact idempotent-rebuild shape) is presented as a concrete recommendation with its tradeoffs stated, not as a verified fact.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**"Always mirror" semantics**
- Source-derived slides rebuild; hand-added slides survive, appended after. The rebuild replaces only what came from the source. This honors Phase 24 D-02 ("never silently drop a user's added slide") without needing a dialog — which is what makes deleting the confirm gate safe.
- Any change to the service item's source triggers a rebuild — song swap, scripture passage change, deck re-import, or a service-order move. Reactive, not manual.
- Both order AND membership are locked. Group sequence follows service-order sequence, and a group exists for exactly the service items that exist. Deleting a service item deletes its group.
- The passive "diverged" banner is removed entirely. With auto-mirroring there is no divergence state left to communicate.

**Deleting the subsystem**
- Leave stored `dismissedSignature` values in Firestore; remove the field from the type (`src/types/slideGroup.ts:57`). Per D-19 the slide area is greenfield — never deployed, never seen by a user — so the stored values are meaningless residue. A cleanup write against every group document to delete a field nothing reads is risk for no benefit. This is the explicit leave-vs-backfill decision the ROADMAP required; it is recorded here rather than made by omission.
- Delete the reconciliation tests outright — no `describe.skip`. A skipped suite passes vacuously and reads as coverage. `ReconcileConfirmModal.test.ts` goes entirely, with the component.
- KEEP the `replaceGroupSlides` concurrent-write transaction merge. It is a generic conflict guard, unrelated to the confirm UX, and it matters *more* once every write becomes unconditional.
- Prove removal by grep + type-check. Zero occurrences across `src/` of `reconcileSongGroup`, `dismissedSignature`, `ReconcileResult`, `needsConfirm`, `dismissReconciliation` — including dynamic imports and template/string references a symbol search alone would miss.

**Song groups read-only (R054) and scripture defaults (R047)**
- A song group blocks ALL slide CRUD and reorder in the Slides tab — no add, edit, delete, duplicate, or drag within the group. The group still participates in service-order sequence (which it does not control) and still accepts group-level media.
- The user gets the existing "Edit in song" link (Phase 26's `songEditLink.ts`) plus a visible read-only affordance, so it reads as deliberate rather than broken.
- A scripture slide defaults to ONE slide showing the passage REFERENCE ONLY — e.g. "Psalm 103:1–5" — not the scripture text. Full scripture text is added only through the congregational reading feature (R064, Phase 34).
  > *"Just one slide for scripture that has the passage reference only. Full scripture can be added in congregational follow-up."* — owner, 2026-07-28
  This keeps Phase 34 purely additive instead of a rewrite of this phase, and removes any "what if the passage is long" question. R047's wording in REQUIREMENTS.md was tightened to match, because "one slide carrying the passage" was ambiguous between reference and text.
- A passage change replaces the slide's content outright. The slide is source-derived; a changed passage means the old reference is simply wrong. Users must not be silently hand-editing scripture.

**Rebuild mechanics and proving the lock**
- Groups stay PERSISTED and are rebuilt deterministically on every service-order write — not derived on read. Groups carry state the service order does not (group media, backgrounds, hand-added slides), which a pure derive-on-read would destroy.
- Rebuild MUST be idempotent, and that must be asserted. Running it twice is byte-identical. The v1.3 compounding bug (2→4→8→16 slide duplication) came from a non-idempotent rebuild on the additive path — the path with no confirm gate. After this phase, *every* path is that path.
- Prove the lock with a property test: for any permutation of the service order, group sequence equals slot sequence. Not example-based.
- One human-verify item: swap a song on a real service and confirm the slides update with no prompt.

### Claude's Discretion
- The visual treatment of the read-only affordance on song groups (follow UI-SPEC once written).
- Whether the rebuild lives in `slideGroupMaterializer.ts` or moves up into `useSlideshowAssembly.ts`.
- How hand-added slides are distinguished from source-derived ones in the model (a flag, provenance field, or positional convention) — pick whatever survives the idempotence assertion most simply.

### Deferred Ideas (OUT OF SCOPE)
- Background images at group/slide/song level — Phase 33 (R055-R057).
- The 3-dot menu and split Edit details / Edit lyrics drawers — Phase 33 (R051, R052).
- LLM congregational reading splits — Phase 34 (R064). This phase deliberately leaves scripture slides as reference-only so Phase 34 is additive.
- CCLI/copyright placement on first and last slide — Phase 35 (R060).
- Marking the Slides tab to signal "a change needs your attention" — auto-mirroring removes the need; revisit only if it proves insufficient in practice.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R045 | Slide-group sequence and membership always mirror the service order; reordering a service item reorders its slide group with no second manual step. | §4 (order derivation) shows this is now ~free — `service.slots` is already section-major and stable-id-anchored post-Phase 29; §3's cascade-delete confirms membership tracking. |
| R046 | Changing the song on a service item rewrites that group's slides to the new song automatically, with no review/confirm step. | §2/§3 give the exact song-identity-swap code path (`reconcileSongGroup:238-267`) and the concrete unconditional-rebuild replacement, including the non-derivable-entry-survival fix a naive deletion would miss. |
| R047 | Changing a scripture passage updates its scripture slide; defaults to ONE slide showing the passage reference only. | §5 traces `ScriptureReading.displayReference` (already computed, already stored) as the exact field to render, and the minimal `deriveGroupEntries`/`resolveSlideContent` SCRIPTURE-case change needed — zero new types. |
| R048 | Reconciliation/confirm flow removed — `ReconcileConfirmModal`, `dismissedSignature`, confirm branches — replaced by one unconditional path. Keep `replaceGroupSlides`'s transaction merge. | §1 is the full verified consumer inventory (10 source files + 8 test files, corrects the ROADMAP's "9 files, 4 tests" claim) and the exact keep/cut line inside each file. |
| R054 | Song groups are read-only in the Slides tab — no create, update, delete, or reorder of their slides. | §6 enumerates every mutation entry point in `SlideGrid.vue` and `EditSlideDrawer.vue` gated only on `isEditor` today, and flags the critical `EditSlideDrawer.test.ts` fixture-default risk (92 of 93 mounts default to a SONG `planItem`). |
</phase_requirements>

## Summary

This phase deletes a shipped-but-never-deployed reconciliation subsystem and replaces it with an unconditional, idempotent rebuild — then locks song-group structure so there is nothing left to reconcile. The consumer inventory the ROADMAP flagged as needing verification is **larger than documented**: the real count is **10 source files plus 8 test files** (not "9 files plus tests" with "4 tests"), because the original grep pass used a symbol list that omitted the plural `pendingReconciliations` prop and the `PendingReconciliation` type — which is exactly why `SlidesTab.vue`, `ServiceEditorView.vue`, and `slideDisplay.ts` appeared to "not surface" in that pass. All three hold real, load-bearing references (prop declarations/passthrough, a type export, and a whole confirm-copy function respectively), confirmed by direct read in this session. A previously undocumented tenth file, `src/components/slides/__tests__/slideDisplay.test.ts`, has a full `describe('reconciliationConfirmCopy', …)` block that must also be deleted.

The architectural shift is not "delete the confirm branch" alone — it is generalizing a survival guarantee that today only exists for SONG groups (their additive merge already carries video/hand-authored-text entries through untouched) so it also covers SCRIPTURE and IMPORTED groups, whose current three-branch reconciler has no such path: today, an *uncustomized* scripture/imported group is wholesale-replaced (losing nothing, because uncustomized), and a *customized* one is gated behind confirm (protecting a video/text entry by stalling). Once confirm is deleted, a naive "always wholesale-replace" would silently delete a user's dropped video the moment a scripture passage changes — regressing exactly the Phase 24 D-02 guarantee CONTEXT.md's "hand-added slides survive" decision exists to protect. §3 gives the concrete fix: filter non-derivable entries out before replacing, append them back after, for every slot kind, not just SONG.

R047's "reference-only" default is the cheapest part of this phase to implement correctly: `ScriptureReading.displayReference` (e.g. `"Psalm 103:1-5"`) is **already computed and persisted** on every `ScriptureReading` document (`src/components/ScriptureSlideEditor.vue:143/152`) — the SCRIPTURE case of `deriveGroupEntries` just needs to stop iterating `reading.slides` (the per-verse split, built for Phase 34's later congregational use) and instead emit exactly one entry whose resolved content carries `reference: reading.displayReference`, `text: ''`. No new type, no new field.

R054's biggest risk is not the production code — it's `EditSlideDrawer.test.ts`, whose `mountDrawer()` helper defaults `planItem` to `kind: 'SONG'` and is called 93 times, 92 of them without an override. Naively gating the drawer's edit controls on "is this a SONG group" will flip ~92 passing assertions to failing in one commit unless the fixture default is changed first. §6 gives the exact mechanism and file/line.

**Primary recommendation:** Delete the 10-file/8-test-file reconciliation surface in one atomic step (§1), generalize the additive-merge/non-derivable-survival pattern from SONG to all three source kinds inside `slideGroupMaterializer.ts` (§3), narrow `deriveGroupEntries`'s SCRIPTURE case to one reference-only entry (§5), and gate `SlideGrid.vue`/`EditSlideDrawer.vue`'s mutation controls on `slot.kind !== 'SONG'` — after first changing `EditSlideDrawer.test.ts`'s default fixture away from SONG (§6).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Slide-group structural rebuild (derive/merge on source change) | API/Backend-equivalent (pure `src/utils/slideGroupMaterializer.ts`) | — | Already a pure, store-free function layer; this phase extends it, does not relocate it. No server/Cloud-Function involvement — all client-side Firestore SDK. |
| Reactive trigger + write orchestration | Frontend composable (`useSlideshowAssembly.ts`) | — | Owns the synchronous-decide/async-write split; the only place that calls Firestore write actions for groups. |
| Persistence | Database (`organizations/{orgId}/slideGroups/{slotId}` via `stores/slideGroups.ts`) | — | Groups remain persisted, not derived-on-read (CONTEXT.md decision) — they carry state (bed audio, hand-added slides) the service order does not. |
| Song-group read-only enforcement (R054) | Browser/Client (component-level `v-if`/computed gating in `SlideGrid.vue`, `EditSlideDrawer.vue`) | — | UI-only lock, matching the phase's explicit scope (no Firestore-rules change proposed or needed here — `firestore.rules` has no `slideGroups`-specific rule today; adding kind-aware rules is out of scope and not requested by CONTEXT.md). |
| Order/membership lock (R045) | Already satisfied by existing data shape (`ServiceSlot.id` stability + Phase 29's section-major `slots` array) | Frontend composable (cascade-delete on slot removal) | No new "locking" mechanism needed for order; membership lock is the existing single delete-cascade call site, verified still correct. |
| Scripture reference resolution (R047) | Pure function (`slideGroupMaterializer.ts` + `slideshowAssembler.ts` content resolution) | — | Reads an already-stored field (`ScriptureReading.displayReference`); no new persistence, no Cloud Function. |

## Standard Stack

No new libraries. This phase is a deletion + internal-model refactor of existing, already-adopted code.

### Existing stack touched by this phase (versions as pinned in `package.json`, confirmed via local file read)
| Library | Version | Purpose | Why unchanged |
|---------|---------|---------|--------------|
| vue | ^3.5.29 | Reactivity/composables underlying `useSlideshowAssembly.ts` | No API surface this phase needs beyond `computed`/`watch`, already in use |
| pinia | ^3.0.4 | `stores/slideGroups.ts` | No store-shape change beyond deleting one action (`dismissReconciliation`) |
| firebase | ^12.0.0 | `runTransaction`/`updateDoc` in `replaceGroupSlides` (KEPT unchanged) | This phase explicitly keeps this mechanism; do not touch it |
| sortablejs | ^1.15.7 | `SlideGrid.vue`'s within-group drag | Gains one new gating condition (disabled for SONG groups); library usage unchanged |
| vitest / @vue/test-utils | ^4.0.18 / ^2.4.6 | All test-file changes in §1/§6 | No framework change |

### Alternatives Considered
None — this is a deletion phase; no new library decision exists to evaluate alternatives against.

**Installation:** None required.

## Package Legitimacy Audit

**Not applicable.** This phase installs no new packages (confirmed: every symbol touched resolves to first-party `src/` code or already-installed dependencies listed above). Skip the Package Legitimacy Gate.

## Architecture Patterns

### System Architecture Diagram — before and after

```
BEFORE (current, being deleted):

  ServiceEditorView.vue
        │ service (ref), authStore.isEditor
        ▼
  useSlideshowAssembly.ts
        │
        ├─ materializationCandidates (sync) ──► materializeGroupIfMissing() ──► Firestore create
        │
        └─ reconciliationOutcomes (sync, per slot)
                │
                ▼
          reconcileGroup(group, slot, inputs)  [slideGroupMaterializer.ts]
                │
        ┌───────┴────────────────────────────────┐
        ▼                                          ▼
  SONG: additive merge OR                    SCRIPTURE/IMPORTED: signature-diff
  song-identity-swap confirm-gate            + hasCustomization confirm-gate
        │                                          │
        └──────────────┬───────────────────────────┘
                        ▼
          { needsConfirm, changed, slides, proposed?, loss?, songSwap? }
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
     needsConfirm=false    needsConfirm=true
     → replaceGroupSlides  → pendingReconciliationsMap.set(slotId, …)
       (unconditional        │
        for THIS branch      ▼
        only)          SlideGrid.vue passive banner → "Review" → ReconcileConfirmModal.vue
                              │                              │
                              ▼                              ▼
                       dismissReconciliation()        replaceGroupSlides() (Apply)
                       (writes dismissedSignature)


AFTER (this phase):

  ServiceEditorView.vue
        │ service (ref), authStore.isEditor
        ▼
  useSlideshowAssembly.ts
        │
        ├─ materializationCandidates (sync) ──► materializeGroupIfMissing() ──► Firestore create   [UNCHANGED]
        │
        └─ rebuildOutcomes (sync, per slot)
                │
                ▼
          rebuildGroupEntries(group, slot, inputs)  [slideGroupMaterializer.ts]
                │
        ┌───────┴────────────────────────────────┐
        ▼                                          ▼
  SONG: additive merge, unconditional         SCRIPTURE/IMPORTED: signature-diff,
  on swap too (§3) — non-derivable            unconditional replace of DERIVED
  entries (video/authored-text)               entries only; non-derivable entries
  always survive, appended after              (video/authored-text) always survive,
                                               appended after (§3 — the new part)
        │                                          │
        └──────────────┬───────────────────────────┘
                        ▼
              { changed: boolean, slides: GroupSlideEntry[] }
                        │
                        ▼
         changed=true → replaceGroupSlides() (unconditional, no confirm state at all)
         changed=false → no write (pure optimization, not correctness-load-bearing)

  SlideGrid.vue / EditSlideDrawer.vue: mutation controls now also gated on
  `selectedSlot.kind !== 'SONG'` (R054) — SlideGroupMusicControl (group-level
  bed audio) is NOT gated by this, per CONTEXT.md ("still accepts group-level
  media").
```

### Recommended Project Structure
No new files/folders. Deletions and edits inside the existing structure:
```
src/
├── utils/
│   └── slideGroupMaterializer.ts     # EDIT: delete confirm branches, generalize non-derivable survival, narrow SCRIPTURE derivation
├── composables/
│   └── useSlideshowAssembly.ts        # EDIT: delete pendingReconciliationsMap/PendingReconciliation, simplify apply loop
├── stores/
│   └── slideGroups.ts                 # EDIT: delete dismissReconciliation; KEEP replaceGroupSlides unchanged
├── types/
│   └── slideGroup.ts                  # EDIT: delete dismissedSignature field
├── components/slides/
│   ├── slideDisplay.ts                # EDIT: delete PendingReconciliation, reconciliationConfirmCopy
│   ├── SlideGrid.vue                  # EDIT: delete reconciliation UI/writes; ADD R054 gating
│   ├── SlidesTab.vue                  # EDIT: delete pendingReconciliations prop passthrough
│   └── ReconcileConfirmModal.vue      # DELETE (whole file)
├── views/
│   └── ServiceEditorView.vue          # EDIT: delete pendingReconciliations wiring
└── utils/slideshowAssembler.ts        # EDIT (small): SCRIPTURE content-resolution reads displayReference, not innerSlideId lookup
```

### Pattern 1: Additive merge, generalized to a universal "non-derivable entries survive" rule

**What:** Today only `reconcileSongGroup`'s within-song-edit path preserves video/authored-text entries (`otherEntries`, `slideGroupMaterializer.ts:372-377`). Generalize this into a small shared helper both the SONG-swap path and the SCRIPTURE/IMPORTED path call.

**When to use:** Any time a slot's *source* structurally changes (song swapped, passage re-fetched, deck re-imported) and the group must fully replace its source-derived entries while never losing what the user added by hand.

**Example (recommended shape — not existing code, a design for the planner):**
```typescript
// slideGroupMaterializer.ts — shared helper, called by both the SONG-swap
// branch and the SCRIPTURE/IMPORTED branch.
function survivingEntries(group: SlideGroup): GroupSlideEntry[] {
  // isNonDerivableEntry already exists (line 176) — reuse verbatim, it is
  // exactly "a video entry, or a text entry with authored title/body."
  return group.slides.filter(isNonDerivableEntry)
}

// SONG branch — song-identity swap is no longer a confirm case. It is a
// full fresh derive of lyric/copyright content, but hand-added entries from
// the OLD song's group still ride through, spliced before the trailing
// copyright (matching where deriveGroupEntries always puts its own last entry).
function rebuildOnSongSwap(group: SlideGroup, slot: SongSlot, inputs: AssemblyInputs): GroupSlideEntry[] {
  const fresh = deriveGroupEntries(slot, inputs)         // [leadCopyright, ...lyrics, trailCopyright]
  const trailing = fresh[fresh.length - 1]!
  const withoutTrailing = fresh.slice(0, -1)
  const merged = [...withoutTrailing, ...survivingEntries(group), trailing]
  return merged.map((entry, i) => ({ ...entry, order: i }))
}

// SCRIPTURE/IMPORTED branch — replaces reconcileUnstableIdGroup's
// hasCustomization gate entirely with an unconditional derive + carry-through.
function rebuildUnstableIdGroup(
  group: SlideGroup,
  slot: ScriptureSlot | ImportedSlot,
  inputs: AssemblyInputs,
): { changed: boolean; slides: GroupSlideEntry[] } {
  const freshSignature = sourceSignature(slot, inputs)
  if (freshSignature === group.sourceSignature) {
    return { changed: false, slides: group.slides }
  }
  const fresh = deriveGroupEntries(slot, inputs)
  const merged = [...fresh, ...survivingEntries(group)].map((entry, i) => ({ ...entry, order: i }))
  return { changed: true, slides: merged }
}
```
**Idempotence check:** a second call with the same source and the just-written `group` — for SONG, `storedSongIds` now matches the current `songId`, so the swap branch is not entered again; it falls to the ordinary additive-merge path, which is already proven idempotent (28-03, 26-09's tests, kept and adapted per §1). For SCRIPTURE/IMPORTED, `freshSignature === group.sourceSignature` (the signature just written) short-circuits to `changed: false` — byte-identical by construction, no re-derivation even attempted.

### Pattern 2: Scripture reference-only slide (R047) — reuse existing field, no new type

**What:** `ScriptureReading.displayReference: string` (`src/types/scriptureReading.ts:8`) already holds the exact human-readable reference string (e.g. `"Psalm 103:1-5"`), set at creation/update time in `ScriptureSlideEditor.vue:143/152` from the same `query` string the passage was fetched with. `PresentationViewer.vue:90` already renders `ScriptureSlide.reference` prominently, separately from `.text` (line 119). This means the reference-only default needs zero new fields, zero new `SourceRef` variants, and zero new rendering code paths — only a narrower *derivation*.

**When to use:** `deriveGroupEntries`'s `'SCRIPTURE'` case (`slideGroupMaterializer.ts:59-73`) and the corresponding content-resolution branch in `slideshowAssembler.ts` (`:135-142`).

**Example:**
```typescript
// slideGroupMaterializer.ts — deriveGroupEntries, SCRIPTURE case (was: map every reading.slides[i])
case 'SCRIPTURE': {
  if (!slot.scriptureReadingId) return []
  const reading = inputs.scriptureReadingsById.get(slot.scriptureReadingId)
  if (!reading) return []
  // R047: exactly ONE entry, reference-only. innerSlideId is no longer used
  // to look up a specific reading.slides[i] — kept as an optional/sentinel
  // field only if Phase 34 needs to widen this again; do not remove
  // SourceRef's scripture shape, only change how many entries are minted.
  return [{
    id: crypto.randomUUID(),
    order: 0,
    sourceRef: { kind: 'scripture', scriptureReadingId: slot.scriptureReadingId },
  }]
}
```
```typescript
// slideshowAssembler.ts — resolveSlideContent, 'scripture' case (was: reading.slides.find(...))
case 'scripture': {
  const reading = inputs.scriptureReadingsById.get(ref.scriptureReadingId)
  if (!reading) return undefined
  const content: Omit<ScriptureSlide, 'id' | 'position'> = {
    contentKind: 'scripture',
    reference: reading.displayReference,   // "Psalm 103:1-5" — already computed, already stored
    bookRef: reading.reference,
    text: '',                              // reference-only default; congregational text is Phase 34's job
    verseRange: '',
    readingMode: 'normal',
  }
  return content
}
```
**Note on `sourceSignature`:** no change needed. `sourceSignature`'s SCRIPTURE branch (`slideGroupMaterializer.ts:120-126`) already signs on `reading.slides`' text content, which still changes whenever the passage is re-fetched (confirmed: `ScriptureSlideEditor.vue` mutates the SAME reading document in place via `updateReading` on every re-fetch after the first, per `onFetchPassage`, `ScriptureSlideEditor.vue:149-156` — the `scriptureReadingId` on the slot does not change on a passage edit). This means the existing signature mechanism correctly detects "passage changed" even though the group's own derived content (the reference string) no longer depends on `reading.slides` for its own display — the signature is a change-detector, not the content source.

### Pattern 3: Deriving group order/membership from the already-fixed slot array (R045) — mostly free

**What:** Phase 29 (just completed) made `service.slots` section-major at every mutation site via `groupBySection`/`flattenBySection`/`orderSlotsBySection` (`src/utils/slotTypes.ts`), and every group is anchored 1:1 to a stable `ServiceSlot.id` (Phase 24 D-01). `SlidePlanRail.vue` already renders `props.slots` in raw array order with no re-sort (`SlidePlanRail.vue:82-89, 111`), and `AssembledSlide.slotIndex` is the array index into that same order. This means **group sequence in the Slides tab already equals service-order sequence today, automatically, as a consequence of Phase 29's fix** — R045's "order" half needs no new locking mechanism in this phase, only verification (the property test, see Validation Architecture below).

**When to use:** Confirming R045 is satisfied; do not add a second ordering mechanism (e.g., re-sorting groups by a stored `order` field on the `SlideGroup` document) — that would create a second source of truth that could drift from `service.slots`.

**Membership half:** already correctly cascade-deleted at the ONE call site in `ServiceEditorView.vue:2016-2026` (`slideGroupsStore.deleteGroup(orgId, slotId)`, called synchronously with the slot-removal action, awaited before the slot is spliced locally). This is the single mutation path that removes a slot from `service.slots` in the whole codebase — the delete-element flow — so no other call site needs auditing for the same cascade. Group *creation* on membership growth is already automatic via `materializationCandidates`'s watch (`useSlideshowAssembly.ts:265-321`), unchanged by this phase.

### Anti-Patterns to Avoid
- **Wholesale-replacing SCRIPTURE/IMPORTED groups without carrying non-derivable entries forward.** This is the single most likely regression: it looks like the natural reading of "delete the confirm gate, always replace" but silently reintroduces the exact data-loss Phase 24 D-02 and the confirm gate existed to prevent — for a case (scripture/imported) that has never had this protection outside the confirm gate. See Pattern 1.
- **Re-deriving group order from a new stored field.** `service.slots`' own array order is already the single source of truth post-Phase-29; do not add a `SlideGroup.order` field or similar — see Pattern 3.
- **Treating `EditSlideDrawer.test.ts`'s current pass as "song editing already forbidden."** It is not — 92 of 93 `mountDrawer()` calls default to `kind: 'SONG'` and assert editable controls exist. See §6.
- **Deep-comparing objects to decide whether reconciliation "changed anything" as a correctness gate rather than a write-skip optimization.** The `changed` boolean (via `JSON.stringify` diff in the current SONG merge) must remain purely an optimization once confirm is gone — correctness comes from idempotence of the derive/merge functions themselves, not from gating writes on a diff.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proving "for any permutation, group order equals slot order" | A hand-picked set of 5-10 example test cases | A plain loop generating N (e.g. 50) shuffled permutations of a fixed slot array inside one `it()`, asserting the invariant on each — no new dependency | `fast-check` (or any property-testing library) is **not installed** in this project (confirmed: no match in `package.json` or `src/`) and adding one for a single, narrow-domain invariant (array-permutation equality) is disproportionate. A manual shuffle loop over `Array.from({length: 50})` with a seeded or `Math.random()`-based Fisher-Yates shuffle gives the same "not example-based" guarantee CONTEXT.md asks for, with zero new dependency risk. |
| Concurrent-write safety on `replaceGroupSlides` | A new locking/mutex mechanism, or a rewrite of the transaction merge | The EXISTING `runTransaction`/`mergeConcurrentlyAddedEntries` compare-and-swap (`slideGroups.ts:278-352`) | Explicitly named in CONTEXT.md as KEEP — it is a generic conflict guard unrelated to the confirm UX, and becomes more load-bearing once every write is unconditional, not less. Do not touch it. |

**Key insight:** every piece of genuinely hard concurrency/idempotence machinery this phase needs already exists in the codebase (the transaction merge, the positional-consumption additive merge). The actual net-new work is disciplined *deletion* plus *generalizing* one existing pattern (non-derivable-entry survival) to two more slot kinds — not new infrastructure.

## Runtime State Inventory

> This phase deletes code and a persisted field, and materially changes what a shipped-but-never-deployed subsystem produces. It is not a rename/refactor of a production-facing string, but the deletion checklist below answers the same underlying question CONTEXT.md's protocol demands: *after this phase's code ships, what runtime state still carries the old shape?*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `dismissedSignature` may exist on some `organizations/{orgId}/slideGroups/{slotId}` documents already written during Phase 24-28 development/testing. | **Leave in place** (CONTEXT.md's explicit decision) — remove the field from the TypeScript type only. No Firestore migration/backfill script. Existing documents keep the stray field; nothing ever reads it again after this phase, so it is inert, not a bug. |
| Live service config | None — no external service (Planning Center, ESV API, etc.) stores anything reconciliation-shaped. | None. |
| OS-registered state | None — no scheduled tasks, no pm2/launchd/systemd units reference this subsystem. | None. |
| Secrets/env vars | None — no env var or SOPS key names this subsystem. | None. |
| Build artifacts / installed packages | None — no package is added or removed; no stale egg-info/binary analog exists for a Vite/Vue frontend deletion. | None — a normal `npm run build`/`vitest` pass after the edits is sufficient; no reinstall step needed. |

**Verified none found in every category except "Stored data":** confirmed by grep across `functions/src/`, `firestore.rules`, `firestore.rules.test.ts`, and `package.json` scripts for any of the deleted symbols — zero hits outside `src/`.

## Common Pitfalls

### Pitfall 1: The ROADMAP's "9 files, 4 tests" figure undercounts by 1 source file and at least 4 test files
**What goes wrong:** Trusting the ROADMAP/STATE.md figure and stopping the consumer search once 9 source files are found and updated, leaving `slideDisplay.test.ts`'s `reconciliationConfirmCopy` describe block, `slideGroups.test.ts`'s `dismissReconciliation` describe block, and a `ServiceEditorView.test.ts` assertion (`pendingReconciliations` prop check, line ~1367) referencing deleted symbols — a type-check failure or a permanently-failing test the grep-based "prove removal" step (CONTEXT.md) is specifically designed to catch, but only if run against the FULL symbol list, not the narrower one CONTEXT.md's own earlier research pass used.
**Why it happens:** The original research grep list (visible in CONTEXT.md's own `<code_context>`) checked `reconcileSongGroup|ReconcileResult|ReconcileConfirmModal|dismissedSignature|dismissReconciliation|needsConfirm|pendingReconciliationsMap|songSwap` — it omits the plural `pendingReconciliations` (no `Map` suffix) and the bare type name `PendingReconciliation`, which is exactly what `SlidesTab.vue`, `ServiceEditorView.vue`, and `slideDisplay.ts` carry.
**How to avoid:** Use this document's §1 inventory (10 source + 8 test files) as the checklist, and re-run the FULL grep (including `pendingReconciliations`, `PendingReconciliation`, `hasCustomization`, `isNonDerivableEntry`, `computeLoss`) as the final "prove removal" step, not the narrower list.
**Warning signs:** `npm run type-check` failing on `SlidesTab.vue`/`ServiceEditorView.vue` after `useSlideshowAssembly.ts`'s return type narrows; `vitest` reporting failures in `slideDisplay.test.ts` or `slideGroups.test.ts` that were not in the pre-phase 10-file baseline.

### Pitfall 2: Deleting the confirm gate without generalizing non-derivable-entry survival regresses Phase 24 D-02 for SCRIPTURE/IMPORTED groups
**What goes wrong:** A scripture group with a user-dropped video entry loses that video silently the next time the passage is re-fetched, because the naive fix ("delete `hasCustomization`, always call `deriveGroupEntries`") throws away every stored entry, derivable or not.
**Why it happens:** Today this case is IMPOSSIBLE to hit — `hasCustomization` returning true (because of the video) is precisely what routes to the confirm gate instead of a silent replace. Deleting only the confirm branch, without also generalizing SONG's `otherEntries` carry-through pattern to this path, removes the protection along with the gate.
**How to avoid:** See Pattern 1 — every rebuild path (SONG swap included) must filter `isNonDerivableEntry` entries out before replacing, then splice them back in.
**Warning signs:** A test that drops a video into a SCRIPTURE/IMPORTED group, then changes the passage/re-imports, and asserts the video entry is gone — write this test FIRST (it does not exist today, because it was previously impossible to trigger) as the Wave 0 gap for this pitfall.

### Pitfall 3: `EditSlideDrawer.test.ts`'s default fixture is SONG-kind — R054 will invert ~92 assertions if the fixture isn't changed first
**What goes wrong:** Implementing R054 by adding `v-if="isEditor && !isSongGroup"` around the drawer's editing controls, then running the existing test suite, produces a wall of new failures — not because the feature is wrong, but because `mountDrawer()`'s default `planItem: makeSlot({ kind: 'SONG', ... })` (`EditSlideDrawer.test.ts:199`) is used by 92 of the file's 93 `mountDrawer()` calls, most of which assert label/notes/audio/duplicate/delete controls ARE rendered and functional.
**Why it happens:** The test file's shared fixture was written when every slot kind behaved identically; R054 introduces the first kind-dependent behavioral branch in this component.
**How to avoid:** Before touching `EditSlideDrawer.vue`, change `mountDrawer()`'s default `planItem.kind` to a non-SONG kind (e.g. `'MESSAGE'` or `'PRAYER'`) so the existing 92 tests continue exercising "an editable slide" as originally intended, then add a small, explicit new `describe('R054 — song groups are read-only', …)` block that mounts with `kind: 'SONG'` and asserts the controls are ABSENT (not just disabled) plus that "Edit in song" is present.
**Warning signs:** A wall of new EditSlideDrawer test failures immediately after adding the R054 gate, with no corresponding change to the fixture.

### Pitfall 4: SlideGrid's drop target must stay kind-aware, not all-or-nothing, for SONG groups
**What goes wrong:** Hiding `SlideDropTarget`/disabling `onFilesDropped` entirely for a SONG group blocks group-level bed-audio drops too, contradicting CONTEXT.md's "the group still... accepts group-level media."
**Why it happens:** `onFilesDropped` (`SlideGrid.vue:602-622`) is one dispatch function routing PPTX/image/video/audio to four different persistence paths; audio's path (`attachDroppedAudio` → `setGroupBedMedia`) is the ONE path that should keep working on a SONG group, while deck-import/video-append (which mutate `slides`) should not.
**How to avoid:** Branch `onFilesDropped` on `props.selectedSlot?.kind === 'SONG'`: if so, route only `resolved.audio` through `attachDroppedAudio`, and surface the existing rejection-notice mechanism (`showRejectionNotice`, already used for genuinely unsupported files) for `resolved.deck`/`resolved.images`/`resolved.videos`. The "+ Add slide" and "Import into this group" HEADER buttons (lines 16-29) should be `v-if`-removed outright for a SONG group (not merely disabled), matching R054's "no create."
**Warning signs:** A test dropping a video file onto a selected SONG group's grid and asserting a rejection notice, alongside a second test dropping an audio file onto the same group and asserting the group's `bedAudioUrl` updates — if either fails, the branch is miswired.

## Code Examples

### 1. Full verified consumer inventory (R048) — replaces and corrects ROADMAP's 9-file/4-test claim

**Source files (10, all grep-verified in this session — every line number is from a direct read, not the graph):**

| File | Symbol(s) found | Disposition |
|------|------------------|-------------|
| `src/utils/slideGroupMaterializer.ts` | `hasCustomization` (193-198), `isNonDerivableEntry` (176-181, KEEP — reused by Pattern 1), `computeLoss` (414-427), `ReconcileResult.needsConfirm/.proposed/.loss/.songSwap` (395-411), the confirm branches of `reconcileSongGroup` (250-267) and `reconcileUnstableIdGroup` (429-458) | Delete confirm branches + `computeLoss`; keep and reuse `isNonDerivableEntry`; keep and adapt the additive-merge core; narrow SCRIPTURE's `deriveGroupEntries` case (see Pattern 2) |
| `src/composables/useSlideshowAssembly.ts` | `PendingReconciliation` interface (75-94), `pendingReconciliationsMap` (394), `reconciliationOutcomes`'s CR-03 stale-pruning check (`!pendingReconciliationsMap.has(...)`, 421), `applyReconciliationOutcomes`'s `needsConfirm`/`dismissedSignature` branch (454-478), `resolveSongTitle` (448-450, becomes dead code once songSwap titles are unused), `pendingReconciliations` computed (540-542) and return value (578) | Delete entirely; the apply loop and outcomes computed both simplify (see Architecture Patterns "AFTER" diagram) |
| `src/types/slideGroup.ts` | `SlideGroup.dismissedSignature` field (57) | Delete field (type only — see Runtime State Inventory for the "leave stored values" decision) |
| `src/stores/slideGroups.ts` | `dismissReconciliation` function (223-226) | Delete function; **`replaceGroupSlides` (278-352) and `mergeConcurrentlyAddedEntries` (331-352) are UNCHANGED — do not touch** |
| `src/components/slides/ReconcileConfirmModal.vue` | Whole component | Delete file |
| `src/components/slides/SlideGrid.vue` | `pendingForSelected` (278-281), `reconciliationNotice` (289-295), `showReconcileModal` (298), `onApplyReconciliation`/`onDismissReconciliation` (313-347), two staleness `watch()`es (359-372), `<ReconcileConfirmModal>` template block (85-91), passive banner block (63-79), `pendingReconciliations` prop (226) and import (208, 211) | Delete all listed; ADD R054 gating (see Pitfall 3/4) in the same pass |
| `src/components/slides/SlidesTab.vue` | `pendingReconciliations` prop declaration (139) and passthrough to `SlideGrid` (45), `PendingReconciliation` type import (131) | Delete prop + import |
| `src/components/slides/slideDisplay.ts` | `PendingReconciliation` interface (148-157), `reconciliationConfirmCopy` function + its doc comment (159-216) | Delete both; `EnsureGroupMaterializedResult` (159-169 region, KEEP — unrelated, the on-demand materializer contract) and `deleteSlideConfirmBody` (228-241, KEEP) are unaffected |
| `src/views/ServiceEditorView.vue` | `pendingReconciliations` destructured from `useSlideshowAssembly()` (1476) and passed as a prop to `<SlidesTab>` (1071) | Delete both; `ensureGroupMaterialized` (also destructured on 1477) is UNRELATED — keep |
| `src/utils/slideshowAssembler.ts` | SCRIPTURE content-resolution branch (135-142) reads `reading.slides.find(...)` | Not a reconciliation symbol, but MUST change alongside R047 (see Pattern 2) — not previously listed in any ROADMAP/CONTEXT inventory |

**Test files (8, corrects CONTEXT.md's "4 tests" figure — 4 additional files found by this session's grep):**

| File | What must change | Confirmed by |
|------|-------------------|--------------|
| `src/components/slides/__tests__/ReconcileConfirmModal.test.ts` | Delete entirely (component deleted) | Already documented |
| `src/composables/__tests__/useSlideshowAssembly.test.ts` | Delete `describe('reconciliation (Task 3)', …)` (626-997, includes the song-identity-swap confirm cases), `describe('PendingReconciliation widening…', …)` (998-1251), `describe('durable decline suppression…', …)` (1252-1390), `describe('CR-03 — pending-reconciliation map pruned…', …)` (1391-1504); **UPDATE, do not delete**, `describe('D-17 — dropped video survives reconciliation…', …)` (1505-1634) to assert the generalized survival behavior now also covers SCRIPTURE/IMPORTED (Pitfall 2's Wave-0 gap); `describe('ensureGroupMaterialized…', …)` (1635+) is unrelated, keep | Already documented |
| `src/utils/__tests__/slideGroupMaterializer.test.ts` | Delete `describe('song identity swap (CR-01)', …)` (507-635) entirely; **UPDATE** `describe('reconcileSongGroup', …)` (336-505), `describe('duplicate-tolerant merge (Phase 26-09 Task 1)', …)` (638-757), and `describe('occurrence-aware repeat merge (D-02, Plan 28-03)', …)` (763-965) to drop `needsConfirm`/`songSwap` assertions but KEEP their idempotence/positional-consumption assertions verbatim (these are the exact regression guards CONTEXT.md calls out by name); update `describe('deriveGroupEntries — SCRIPTURE', …)` (192-217) for the one-entry-reference-only shape (R047) | Already documented (partially) |
| `src/stores/__tests__/slideGroups.test.ts` | Delete `describe('dismissReconciliation', …)` (512-570) | **New finding this session** |
| `src/components/slides/__tests__/SlideGrid.test.ts` | Delete `describe('reconciliation confirm dialog (26-06 Task 2)', …)` (1058+); remove `pendingReconciliations` from the `mountGrid` prop factory and every test passing it (used well beyond the one describe block — three standalone `it()`s at lines 327, 342, 351 also construct `PendingReconciliation` fixtures); ADD new tests for R054 gating (Add slide/Import buttons absent, Sortable disabled, drop-target audio-only) for a `kind: 'SONG'` selected slot | Already partially documented; scope corrected here |
| `src/components/slides/__tests__/SlidesTab.test.ts` | Remove `pendingReconciliations: []` boilerplate prop from the two mount call sites (lines 247, 502) | **New finding this session** |
| `src/components/slides/__tests__/slideDisplay.test.ts` | Delete `describe('reconciliationConfirmCopy', …)` (293-~420) and its `PendingReconciliation` import | **New finding this session — not in any prior inventory** |
| `src/views/__tests__/ServiceEditorView.test.ts` | Update the one assertion at line ~1354-1368 (`"the slides panel receives... the pending reconciliations as props"`) — either delete the test or repurpose it to assert the prop is GONE | **New finding this session** |

### 2. R054 mutation entry-point enumeration (SlideGrid.vue + EditSlideDrawer.vue)

Every one of these is gated ONLY on `isEditor` today; each needs an additional `slot.kind !== 'SONG'` condition (or an equivalent `canMutateGroup`/`isReadOnlyGroup` computed) — **except** the two marked KEEP UNCHANGED:

| Component | Control | Current gate (line) | New gate needed |
|-----------|---------|----------------------|------------------|
| `SlideGrid.vue` | "+ Add slide" button | `v-if="isEditor"` (17) | AND `!isSongGroup` |
| `SlideGrid.vue` | "Import into this group" button | `v-if="isEditor"` (24) | AND `!isSongGroup` |
| `SlideGrid.vue` | `SlideGroupMusicControl` (group bed audio attach/remove) | `:is-editor="isEditor"` (57) | **KEEP UNCHANGED** — "still accepts group-level media" |
| `SlideGrid.vue` | Sortable drag-reorder (`canReorder`) | `props.isEditor && props.group !== null` (680) | AND `!isSongGroup` |
| `SlideGrid.vue` | `SlideDropTarget` (drop zone existence) | `v-if="isEditor"` (150, 157) | See Pitfall 4 — keep visible, but branch `onFilesDropped` internally so only audio drops succeed on a SONG group |
| `EditSlideDrawer.vue` | Label input | `v-if="isEditor"` (81) | AND `!isSongGroup` |
| `EditSlideDrawer.vue` | Notes textarea | `v-if="isEditor"` (290) | AND `!isSongGroup` |
| `EditSlideDrawer.vue` | Audio scope choice / attach / remove | `v-if="isEditor"` (203, 235, 256) | AND `!isSongGroup` |
| `EditSlideDrawer.vue` | Duplicate / Delete footer actions | `v-if="isEditor"` (305) | AND `!isSongGroup` |
| `EditSlideDrawer.vue` | "Edit in song" link | `v-if="isEditor"` (114, 131) | **KEEP UNCHANGED** — this is the explicit alternative CONTEXT.md names |
| `EditSlideDrawer.vue` | Read-only affordance (new) | none today | ADD — visible indicator so the lock "reads as deliberate rather than broken" (CONTEXT.md) |

`isSongGroup` is naturally `props.planItem?.kind === 'SONG'` in `EditSlideDrawer.vue` (planItem is already a prop, `ServiceSlot | null`) and `props.selectedSlot?.kind === 'SONG'` in `SlideGrid.vue` (same prop, already present).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Three-branch reconcile (unchanged / silent-additive / confirm-required) per slot kind | One unconditional rebuild path per slot kind, non-derivable entries always survive | This phase (30) | `ReconcileResult`'s shape shrinks from 6 fields to 2 (`changed`, `slides`); `useSlideshowAssembly.ts` loses an entire reactive Map and its CR-03 staleness-pruning logic — net complexity reduction, not just deletion |
| Scripture group derives one entry per split slide (`reading.slides[i]`) | Scripture group derives exactly one reference-only entry | This phase (30), per R047 | `sourceRef.scripture.innerSlideId` becomes structurally unused for THIS phase's default path (kept in the type for Phase 34, which will need to re-derive per-fragment entries for congregational splits — a widening, not a rewrite, of this phase's derivation) |

**Deprecated/outdated:**
- `ReconcileConfirmModal.vue` and its confirm/dismiss UX: replaced by "there is nothing to confirm" — deleted, not disabled.
- `dismissedSignature` as a live field: replaced by nothing — the "declined divergence" concept no longer exists once every divergence is silently resolved.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommending the exact shape of the generalized "non-derivable entries survive" helper (Pattern 1) and the SCRIPTURE-only-reference derivation (Pattern 2) as concrete code — these are design recommendations grounded in verified existing code shapes, not verified-as-already-implemented facts. | Architecture Patterns §1/§2 | Low — CONTEXT.md explicitly leaves "how hand-added slides are distinguished" and "where the rebuild lives" to Claude's discretion; the planner may choose a different concrete mechanism as long as it satisfies the same idempotence/survival properties this research verifies are required. |
| A2 | A property test using a manual N=50 shuffle loop (no `fast-check`) satisfies CONTEXT.md's "not example-based" requirement for R045's order-lock proof. | Don't Hand-Roll | Low — if the planner/owner wants a real property-testing library for future phases' reuse, `fast-check` would need its own legitimacy check (not performed here, since it is a recommendation to NOT add it) before being introduced. |
| A3 | The recommended R054 gate (`slot.kind === 'SONG'`) is sufficient and no group can ever transition from non-SONG to containing lyric/copyright entries or vice versa in a way that would need a more granular per-entry gate. | Code Examples §2 | Medium — if a future phase allows converting a slot's kind in place (not currently possible; kind is fixed at slot creation per `createSlot`), a per-entry-kind gate would be needed instead. Not currently possible in this codebase; flagged for completeness. |

## Open Questions

1. **Should `reconcileGroup`/`reconcileSongGroup`/`reconcileScriptureGroup`/`reconcileImportedGroup` be renamed (e.g. to `rebuildGroup`/`rebuildSongGroup`/…) as part of this phase, or left named `reconcile*` with only their behavior changed?**
   - What we know: CONTEXT.md's "Claude's Discretion" section does not mention naming explicitly; the function names currently connote a review/confirm flow that no longer exists.
   - What's unclear: Whether a rename is worth the diff noise (touches every call site and test) versus behavior-only changes with a doc-comment update.
   - Recommendation: Rename — "reconcile" specifically implies "detect divergence, ask for a decision," which is the exact concept being deleted; keeping the name risks a future reader assuming a confirm path still exists somewhere. Low-risk, mechanical rename; do it in the same commit as the behavior change so `git blame`/history stays coherent.

2. **Does the SCRIPTURE reference-only entry (R047) need its `id` to be stable across a passage re-fetch (same `scriptureReadingId`, different `displayReference`), or is minting a fresh id on every passage change acceptable?**
   - What we know: `GroupSlideEntry.id` is documented as "minted once and never regenerated" because `PresentationViewer.vue` keys `AudioPlayer`/`VideoPlayer` on it (invariant 2, `slideGroup.ts:16-21`) — but a scripture reference entry carries no audio/video by default.
   - What's unclear: If a user later attaches per-slide audio to the scripture reference slide (not blocked by R054, which only locks SONG groups), does a subsequent passage change need to preserve that entry's id (and therefore its audio) or is "passage change replaces the slide's content outright" (CONTEXT.md) meant to also drop attached audio?
   - Recommendation: Given CONTEXT.md's literal wording ("replaces the slide's content outright... Users must not be silently hand-editing scripture"), treat this as a full replace including id (mint fresh), which also drops any attached audio — simplest, matches the "outright" language, and is a smaller behavioral surface for the planner to implement and test than a partial-preserve rule. Flag this specific behavior in the plan's acceptance criteria so it is an explicit, reviewed choice rather than an implicit one.

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependency. All work is inside the existing Vue/Firebase/Vitest toolchain already running in this repo (confirmed via `package.json`, no new CLI or service required).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @vue/test-utils ^2.4.6 |
| Config file | `vitest.config.ts` (existing, no change needed) |
| Quick run command | `npm run test:unit -- src/utils/__tests__/slideGroupMaterializer.test.ts src/composables/__tests__/useSlideshowAssembly.test.ts` |
| Full suite command | `npm run test:unit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R045 | For any permutation of `service.slots`, the Slides tab's group sequence equals slot sequence | unit (property-style, manual shuffle loop) | `npm run test:unit -- src/utils/__tests__/slideGroupMaterializer.test.ts` | ❌ Wave 0 — new test, no existing order-lock assertion |
| R045 | Deleting a service item deletes its group | unit | `npm run test:unit -- src/views/__tests__/ServiceEditorView.test.ts` | ✅ existing cascade-delete test at the `deleteGroup` call site (verify it still passes unmodified) |
| R046 | Song swap silently rewrites lyric/copyright entries to the new song, unconditionally | unit | `npm run test:unit -- src/utils/__tests__/slideGroupMaterializer.test.ts` | ⚠️ Wave 0 partial — existing `describe('song identity swap (CR-01)', …)` tests the OLD confirm behavior and must be rewritten, not just kept |
| R046 | Song swap preserves a hand-added video/text entry on the group (Pitfall 2) | unit | same file | ❌ Wave 0 — new test, previously impossible to trigger under the confirm gate |
| R047 | Scripture group derives exactly ONE entry whose resolved content shows `displayReference`, empty `text` | unit | `npm run test:unit -- src/utils/__tests__/slideGroupMaterializer.test.ts src/utils/__tests__/slideshowAssembler.test.ts` | ⚠️ Wave 0 — existing `describe('deriveGroupEntries — SCRIPTURE', …)` (lines 192-217) tests the OLD multi-entry shape |
| R047 | Passage change replaces the reference entry, preserving non-derivable siblings | unit | same files | ❌ Wave 0 — new test |
| R048 | Zero occurrences of every deleted symbol across `src/` | static/grep (not a vitest test) | `grep -rn "reconcileSongGroup\|ReconcileResult\|ReconcileConfirmModal\|dismissedSignature\|dismissReconciliation\|needsConfirm\|pendingReconciliationsMap\|songSwap\|pendingReconciliations\|PendingReconciliation\|hasCustomization\|isNonDerivableEntry\|computeLoss" src/` returning zero hits (except the two explicitly-kept `isNonDerivableEntry`/`hasCustomization`... — actually `hasCustomization` should be fully removed; verify the grep excludes only `isNonDerivableEntry`, which is kept and reused) | ❌ Wave 0 — add as an explicit CI/plan-verification step, not a vitest test |
| R048 | `replaceGroupSlides`'s transaction merge is unchanged and still passes its existing tests | unit | `npm run test:unit -- src/stores/__tests__/slideGroups.test.ts` | ✅ existing, must remain green with zero edits to the tested function |
| R054 | Song group: Add/Import/drag-reorder controls are absent (not disabled) from `SlideGrid.vue` | unit (component) | `npm run test:unit -- src/components/slides/__tests__/SlideGrid.test.ts` | ❌ Wave 0 — new tests |
| R054 | Song group: label/notes/audio/duplicate/delete controls absent from `EditSlideDrawer.vue`; "Edit in song" present | unit (component) | `npm run test:unit -- src/components/slides/__tests__/EditSlideDrawer.test.ts` | ❌ Wave 0 — new `describe` block, AND the fixture-default change (Pitfall 3) must land first |
| R054 | Song group still accepts a dropped/attached bed-audio file | unit (component) | `npm run test:unit -- src/components/slides/__tests__/SlideGrid.test.ts` | ❌ Wave 0 — new test |

### Sampling Rate
- **Per task commit:** `npm run test:unit -- <touched test file(s)>`
- **Per wave merge:** `npm run test:unit` (full suite) + `npm run type-check` (catches any remaining reference to a deleted export the test suite doesn't happen to import)
- **Phase gate:** Full suite green, full-suite failing-file-set equals the pre-existing 10-file baseline (8 quarantine debris + `storage.rules.test.ts` + `RosterView.test.ts`, per STATE.md) MINUS the reconciliation test files now deleted entirely — before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `slideGroupMaterializer.test.ts` — order/multiplicity-preserving property test for R045 (manual shuffle loop, no new dependency)
- [ ] `slideGroupMaterializer.test.ts` — song-swap-preserves-hand-added-entry test (Pitfall 2)
- [ ] `slideGroupMaterializer.test.ts` / `slideshowAssembler.test.ts` — rewritten SCRIPTURE derivation tests for the one-entry-reference-only shape (R047)
- [ ] `SlideGrid.test.ts` — R054 gating tests (Add/Import absent, reorder disabled, audio-drop-still-works)
- [ ] `EditSlideDrawer.test.ts` — fixture-default change away from `kind: 'SONG'` FIRST, then new R054 read-only describe block
- [ ] A grep-based "prove removal" verification step using the FULL symbol list in this document's Phase Requirements → Test Map row for R048 (not the narrower list CONTEXT.md's own earlier pass used)

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` (key absent → treat as enabled), so this section is included, though this phase's security surface is narrow.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected — no auth-flow change |
| V3 Session Management | No | Unaffected |
| V4 Access Control | Yes | R054's read-only lock is a UI-layer access-control decision (which entry points a signed-in editor may use), not a role/permission change. No Firestore-rules change is proposed or required — `firestore.rules` has no `slideGroups`-specific rule today (confirmed by grep: zero matches for `slideGroups` in `firestore.rules`), and this phase does not add one. This is a deliberate scope boundary, not an oversight: CONTEXT.md scopes R054 to "in the Slides tab" (a UI surface), consistent with the existing precedent that `isEditor`-only gating (no status/kind-aware Firestore rule) is how every other write-affordance in this subsystem (add-slide, drag-reorder, group bed media) is already gated. |
| V5 Input Validation | No new surface | No new user-input field is introduced by this phase (deletion + derivation-logic change only) |
| V6 Cryptography | No | Unaffected |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malicious/compromised client bypasses the UI-only R054 lock via devtools or a direct Firestore SDK call to mutate a SONG group's slides | Tampering | **Not mitigated by this phase** — this is the same class of gap ARCHITECTURE.md §4 already documents for the Draft-lock work (Phase 31): UI-only gating is real UX but not enforcement. If R054's read-only guarantee needs to be adversary-proof (not just editor-mistake-proof), that is a Firestore-rules change requiring the rule to read the anchoring `ServiceSlot.kind` from the parent service document — a cross-document rule read, non-trivial, and explicitly out of this phase's stated scope. Flag this as a residual risk in the plan, not silently accepted. |
| A stale client tab, still holding a reference to a since-deleted `SlideGroup`, calls `replaceGroupSlides` after another tab's slot-delete cascade already removed the document | Tampering/availability | Already mitigated — `replaceGroupSlides`'s `runTransaction` reads the live document inside the transaction; a `deleteDoc`'d document simply has `snap.exists()` false, and the existing code path (`liveSlides` defaults to `undefined` → `[]`) tolerates this without throwing. No new work needed; confirmed by reading `slideGroups.ts:295-305`. |

## Sources

### Primary (HIGH confidence — direct file reads this session)
- `src/utils/slideGroupMaterializer.ts` (full read) — reconciliation logic, additive merge, `isNonDerivableEntry`/`hasCustomization`/`computeLoss`
- `src/composables/useSlideshowAssembly.ts` (full read) — reactive orchestration, `PendingReconciliation`, apply loop
- `src/stores/slideGroups.ts` (full read) — `dismissReconciliation`, `replaceGroupSlides`, transaction merge
- `src/components/slides/SlideGrid.vue` (full read) — reconciliation UI, all mutation entry points for R054
- `src/components/slides/SlidesTab.vue` (relevant sections read) — prop passthrough
- `src/components/slides/slideDisplay.ts` (full read) — `PendingReconciliation`, `reconciliationConfirmCopy`, `EnsureGroupMaterializedResult`
- `src/components/slides/EditSlideDrawer.vue` (relevant sections read) — R054 mutation entry points, `planItem` prop
- `src/views/ServiceEditorView.vue` (relevant sections read) — `pendingReconciliations` wiring, `deleteGroup` cascade, `onSectionChange`
- `src/types/slideGroup.ts`, `src/types/service.ts`, `src/types/scriptureReading.ts`, `src/types/slide.ts` (full/relevant reads) — data model for R047/R054
- `src/utils/scriptureSplitter.ts`, `src/components/ScriptureSlideEditor.vue`, `src/utils/slideshowAssembler.ts` (relevant sections read) — `displayReference` provenance, scripture content resolution
- `src/utils/slotTypes.ts` (grep + relevant context) — Phase 29's `groupBySection`/`flattenBySection`/`orderSlotsBySection`
- `src/components/slides/SlidePlanRail.vue` (grep) — confirms raw-array-order rendering
- `firestore.rules`, `firestore.rules.test.ts` (grep) — confirms no `slideGroups`-specific rule exists
- Every listed test file (`ReconcileConfirmModal.test.ts`, `useSlideshowAssembly.test.ts`, `slideGroupMaterializer.test.ts`, `slideGroups.test.ts`, `SlideGrid.test.ts`, `SlidesTab.test.ts`, `slideDisplay.test.ts`, `ServiceEditorView.test.ts`, `EditSlideDrawer.test.ts`) — `describe` block enumeration via grep, fixture-default risk confirmed by direct read of `EditSlideDrawer.test.ts:192-209`
- `.planning/phases/30-.../30-CONTEXT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/research/ARCHITECTURE.md` — upstream decisions and prior research
- `node "gsd-tools.cjs" graphify status` — confirmed graph is 79 hours / 270 commits stale; not used for any claim in this document

### Secondary (MEDIUM confidence)
- None — no external documentation lookup was needed; this phase is entirely internal-codebase archaeology with no new library/API surface.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Consumer inventory (R048): HIGH — every file/line verified by direct read in this session, cross-checked against two independent symbol-list greps (the narrow one CONTEXT.md used, and a widened one that caught the 4 additional files)
- Unconditional-rebuild design (R046/R047): HIGH on the problem (non-derivable-entry-survival gap) and MEDIUM on the exact recommended code shape — CONTEXT.md explicitly leaves the precise mechanism to Claude's discretion, so the code in this document is a grounded recommendation, not a verified-correct implementation
- R054 mutation inventory: HIGH — every gate and its exact line number verified by direct read; the `EditSlideDrawer.test.ts` fixture-risk finding is HIGH confidence (grep-counted: 93 calls, 92 without override)
- Scripture reference-only design (R047): HIGH — `displayReference` field's existence, computation, and current consumption (`PresentationViewer.vue:90`) all directly verified

**Research date:** 2026-07-28
**Valid until:** Should be re-verified if Phase 29's post-completion state changes further before Phase 30 planning begins (unlikely — Phase 29 is marked complete 5/5), or after 14 days given this is an active-development milestone with phases landing daily.
