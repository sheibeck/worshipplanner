# Architecture Research — v1.4 "Service and Slides"

**Domain:** Brownfield integration into a shipped Vue 3 + Firebase worship-planning app
**Researched:** 2026-07-28
**Confidence:** HIGH — every finding below is cited to a real file/line read in this session, not inferred from conventions. The one place confidence drops to MEDIUM (the autosave/song-change bug) is flagged explicitly with its reasoning chain.

## System Overview (as it exists today)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ServiceEditorView.vue (2,717 lines)                                   │
│  activeTab: 'service-order' | 'roles' | 'slides'                      │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │ Service Order    │  │ Roles        │  │ Slides (SlidesTab.vue) │   │
│  │ (this file,      │  │ (Phase 17)   │  │  SlidePlanRail         │   │
│  │  inline template) │  │              │  │  SlideGrid             │   │
│  │  - slot list      │  │              │  │  EditSlideDrawer       │   │
│  │  - SortableJS #1  │  │              │  │  SortableJS #2         │   │
│  └────────┬─────────┘  └──────────────┘  └───────────┬────────────┘   │
│           │  localService: Ref<Service|null>          │                │
│           │  (own hand-rolled autosave, ~150 lines)    │                │
│           └───────────────┬────────────────────────────┘                │
│                            │ useSlideshowAssembly(service, orgId)       │
└────────────────────────────┼───────────────────────────────────────────┘
                             ▼
        ┌────────────────────────────────────────────┐
        │ slideGroupMaterializer.ts (pure)             │
        │  deriveGroupEntries / reconcileGroup /        │
        │  reconcileSongGroup / reconcileUnstableIdGroup│
        └───────────────────┬───────────────────────────┘
                             ▼
        ┌────────────────────────────────────────────┐
        │ stores/slideGroups.ts (Firestore)            │
        │  organizations/{orgId}/slideGroups/{slotId}  │
        │  materializeGroupIfMissing / replaceGroupSlides│
        │  dismissReconciliation / setGroupBedMedia     │
        └────────────────────────────────────────────┘

        ┌────────────────────────────────────────────┐
        │ Cloud Functions (functions/src/index.ts)     │
        │  parsePptx (text) → orgs/{orgId}/pptx-imports/│
        │                       {importId}/images/*.png │
        │  cleanupExpiredMedia → orgs/{orgId}/media/*   │
        │  ONLY (regex-guarded, never pptx-imports/)    │
        └────────────────────────────────────────────┘
```

`Service`/`ServiceSlot` (`src/types/service.ts`) are the PRODUCTION boundary — shipped v1.0, real
user data, must be migrated carefully. Everything under `slideGroups`, `ImportedDeck`, `SongLyrics`,
and `src/components/slides/**` is GREENFIELD per D-19 (STATE.md) — reshape freely, no migration.

---

## 1. Drag-and-drop root cause — service `ZTXcpNRcJTalEQp42fTx`

**Confidence: HIGH.** Found by reading `src/views/ServiceEditorView.vue` lines 519–537 (template) and
1413–1467 (Sortable setup), cross-checked against `node_modules/sortablejs/modular/sortable.esm.js`
(v1.15.7) lines 1200–1202 and 1897–1907.

### The three compounding bugs (all in the same `onEnd` handler)

**Bug A — `evt.oldIndex`/`evt.newIndex` count section-header DOM nodes SortableJS never scoped them out of.**

The template renders section headers and slot rows as *siblings in the same flat container*
(`ServiceEditorView.vue:520-536`):

```html
<div ref="slotContainerRef" class="space-y-1.5">
  <template v-for="(slot, index) in localService.slots" :key="slot.kind + '-' + slot.position">
    <div v-if="showsSectionHeaderAt(index)" class="section-header" ...>...</div>
    <div class="slot-item" ...>...</div>
  </template>
</div>
```

`Sortable.create(el, { draggable: '.slot-item', ... })` is documented (and the code's own comment at
line 1422-1426 claims) to "scope both drag eligibility AND index counting… to `.slot-item`." **That
claim is false.** SortableJS's source (`sortable.esm.js:1201-1202`) computes two *separate* indices:

```js
oldIndex = index(target);                      // counts EVERY child of the container
oldDraggableIndex = index(target, options.draggable);  // counts only .slot-item children
```

`onEnd` in `ServiceEditorView.vue:1430-1444` uses `evt.oldIndex`/`evt.newIndex` — the **all-children**
index — as the splice indices into `localService.value.slots`, an array that has **no entries for
section headers**:

```js
const slots = [...localService.value.slots]
const moved = slots.splice(evt.oldIndex, 1)[0]   // evt.oldIndex includes header divs
slots.splice(evt.newIndex, 0, moved)
```

Section headers appear *between every section transition* — precisely where a cross-section drag
starts or lands. The number of headers preceding a given row varies with scroll position and drag
distance, so every drag that crosses (or lands near) a section boundary splices the data array at an
offset index. This is a **data-corruption** bug, not just a render glitch: it explains "the wrong item
lands" (splice at wrong index), "sections duplicate or vanish" (an item removed from one section's
range and inserted into another's), and "Sending renders mid-list" (an item physically relocated in
the array despite its `section` field being untouched — `showsSectionHeaderAt` then sees a
`prevSection !== slot.section` transition it didn't expect and renders another header for the same
section further down). The fix is `evt.oldDraggableIndex`/`evt.newDraggableIndex`, which SortableJS
already computes and exposes for exactly this situation — the code just never reads them.

**Bug B — the "revert the DOM move" logic is not a revert; it's a partial, single-step nudge.**

```js
const parent = evt.item.parentNode
if (parent) {
  const ref = parent.children[evt.oldIndex]
  parent.insertBefore(evt.item, evt.oldIndex < evt.newIndex ? ref?.nextSibling ?? null : ref ?? null)
}
```

The comment (line 1433) says this exists so "Vue's reactive render is the single source of truth
(prevents snap-back)" — i.e., undo SortableJS's physical DOM move before Vue re-renders from state, the
classic SortableJS/Vue conflict the research question names directly. But walk it through for a
multi-position drag, e.g. dragging index 0 to index 3 in `[A,B,C,D]`: after SortableJS's real move the
DOM is `[B,C,D,A]`. `parent.children[evt.oldIndex=0]` is now `B` (SortableJS already moved things), and
since `0 < 3`, the code inserts `A` before `B.nextSibling` (`C`), producing `[B,A,C,D]` — **not**
`[A,B,C,D]`. It only ever undoes a single adjacent swap; anything that moves more than one slot leaves
the DOM in a state that matches neither the pre-drag order nor the (correct) post-splice data order.
Vue's subsequent patch then has to reconcile against DOM nodes that are already wrong, which is the
second source of "wrong item visible" and why a hard remount (page refresh, which throws away this
corrupted DOM/vnode tree and rebuilds fresh from `localService.value.slots`) is the only thing that
reliably fixes it — exactly the reported symptom.

**Bug C — the `v-for` key is unstable across every reorder, so Vue can't do a minimal patch even where Bug A/B don't apply.**

```html
:key="slot.kind + '-' + slot.position"
```

`reindexSlots()` (`src/utils/slotTypes.ts:97-99`) reassigns `position` to the array index on *every*
add/remove/reorder: `slots.map((slot, index) => ({ ...slot, position: index }))`. That means **every
slot's key downstream of a move changes on every single drag** (two SONG slots swapping index 2 and 5
both get a new key, and so does everything between them). Vue's keyed diff then can't recognize "this
is the same row, just relocated" for most of the list — it destroys and recreates vnodes instead of
moving them — compounding the already-corrupted DOM from Bug B. The codebase already has the right
stable identity sitting right there and uses it elsewhere for exactly this reason: `ServiceSlot.id`
(`MediaAttachableSlot.id`, `src/types/service.ts:33-42`, minted by `createSlot()`/`buildSlots()`,
explicitly documented as "never array index or `position`, both of which a drag-reorder rewrites" —
this is the anchor `slideGroups/{slotId}` depends on). The Service Order tab's own `:key` violates the
invariant the rest of the codebase was built around.

**Confirmation this is a systemic pattern, not a one-off:** `SlideGrid.vue`'s own Sortable instance
(`src/components/slides/SlideGrid.vue:657-717`) is explicitly documented as reusing "the exact
SortableJS pattern already established in `ServiceEditorView.vue`'s slot list" (line 641-643) — same
`evt.oldIndex`/`newIndex` splice, same single-step DOM "revert." It gets away with it for *within-group
reorder* because its `:key="card.assembledSlide.slide.id"` (line 132) is stable (Bug C doesn't apply
there), but it has its own instance of Bug A: `SlideDropTarget` (line 141) is rendered as a sibling in
the same `cardsContainerRef` container, "deliberately NOT given the `.slide-card` class" — so it's
excluded from `draggable` but still counted by `evt.oldIndex`/`newIndex`, always sitting one past the
end. That is very likely the mechanism behind the separately reported "new slides landing
second-to-last" defect (an append/drop index computed against the whole-children count lands one slot
short of where the data array actually ends).

### Recommended ordering model

Make the five sections structurally immovable by not representing them as *inferred labels on a flat
array* at all:

1. **Keep `ServiceSlot.position` as a plain array-index integer** (no need for fractional ranks —
   `reindexSlots()` already normalizes it correctly on every mutation; the bug was never the ordering
   *representation*, it was the *DOM/index arithmetic* built on top of it).
2. **Stop rendering section headers as siblings inside the Sortable-managed container.** Render each of
   the five sections as its **own** `<div>` with its **own** `Sortable.create(...)` instance, scoped
   with SortableJS's `group` option (e.g. `group: 'service-order'`) so items can still be dragged
   *between* section containers. This makes `evt.oldIndex`/`evt.newIndex` trustworthy again — because
   there is nothing else in a section's container to miscount — and it makes the five section headers
   literally non-draggable (they're not `Sortable`-owned elements at all), directly satisfying "the five
   sections... never reorderable."
3. **On `onEnd`, splice/insert using `evt.oldDraggableIndex`/`evt.newDraggableIndex`** (already computed
   by SortableJS) if a single flat array approach is kept instead of per-section instances — this alone
   fixes Bug A without a bigger refactor, but per-section containers are the more robust fix because it
   makes cross-section drags explicit (`onAdd`/`onRemove` events fire with a `toEl.dataset.section`) and
   removes the need to infer section membership from array order at all.
4. **Fix `onEnd`'s DOM-revert to a real revert or drop it.** Once (2) is done, `evt.item` never needs
   the manual `insertBefore` dance — a per-section Sortable list only ever needs to worry about single
   local moves, and Vue's own patch (keyed correctly per point 5) can safely re-render from state
   without the hand-rolled DOM surgery. If a flat-array approach is kept instead, replace the current
   single-step nudge with SortableJS's documented pattern: capture the full pre-drag `Array.from(parent.children)` order in `onStart`, and on `onEnd` restore that exact array order via a loop of
   `insertBefore` calls (not one), *before* mutating `localService.value.slots`.
5. **Key `v-for` on `slot.id`**, not `slot.kind + '-' + slot.position`. This is a one-line, always-safe
   fix, independent of everything else above, and should land first — cheapest, and it's the same
   invariant slide groups already depend on.
6. **`SERVICE_SECTION` membership should be assignable only by drop target, never by direct field edit
   racing a drag** — i.e., delete the free-standing `<select>` in `onSectionChange` (line 1381-1386;
   currently the *only* way `slot.section` changes outside a drag) or keep it only as a fallback for
   assistive-tech users, but route it through the same "always land in a valid position within that
   section's container" logic a drop uses, so a select-driven section change can't produce a
   non-contiguous section run either.

This is the SAME underlying pattern for both known reorder defects (Service Order tab AND SlideGrid's
"new slides landing second-to-last") — fixing the shared mechanism once (stable key + correct
index source + real per-container scoping) closes both, and should be planned as one phase, not two.

---

## 2. Adding a Post-Service section (production data)

**Confidence: HIGH.**

The four-section list is defined in exactly one place as the union type + const array
(`src/types/service.ts:13-22`):

```ts
export type ServiceSection = 'pre-service' | 'worship' | 'message' | 'sending'
export const SERVICE_SECTIONS: readonly ServiceSection[] = ['pre-service', 'worship', 'message', 'sending']
export const SERVICE_SECTION_LABELS: Record<ServiceSection, string> = { ... }
```

Adding `'post-service'` to the union + both consts is safe and additive: `ServiceSlot.section` is
already **optional** (`section?: ServiceSection` on every slot variant), and every consumer already
handles the section-absent case as a distinct "legacy/ungrouped" bucket — meaning an *existing* v1.0
service document with no `section` field on its slots, or with only the four existing values, needs
**zero migration**. No script, no backfill. This is squarely inside D-19's "no migration needed"
guidance even though it touches `ServiceSlot` (production), because the change is additive to an
optional field's allowed value set, not a shape change to required data.

**Places that consume `SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS` and must be checked for hard-coding
of "four":**

| File | What it does | Post-Service impact |
|------|---------------|----------------------|
| `src/utils/slotTypes.ts:139-143` (`defaultSectionForPosition`) | Hard-codes `position===7→message`, `position===8→sending`, else `worship` for the **default 9-slot template** (`buildSlots`) | No change needed — the default template has no Post-Service slot; Post-Service starts empty and is populated by the user adding an item to it, same as today's Pre-Service (already documented as having "no default slot" in the same comment block, line 134-137) |
| `src/composables/useSlideshowAssembly.ts:544-561` (`assembledSections`) | Iterates `SERVICE_SECTIONS` to build the grouped preview | Automatic — adding the 5th value to the const array is sufficient, no code change |
| `ServiceEditorView.vue` — `showsSectionHeaderAt`, `onSectionChange`'s `<option v-for="s in SERVICE_SECTIONS">` (line 899) | Section-header rendering, section-assignment dropdown | Automatic once `SERVICE_SECTIONS` includes the 5th value — but this is also exactly the code path being rebuilt for the drag-drop fix (§1), so land that first |
| **Assembler** (`src/utils/slideshowAssembler.ts`) — verify at plan time whether it reads `SERVICE_SECTIONS` directly or only reads `slot.section` per-slide (I did not find a hard 4-count check reading the surrounding code; grep this file specifically before landing) | Section label carried onto `AssembledSlide.section`/`AssembledSection` | Likely automatic |
| **Plan rail** (`SlidePlanRail.vue`) | Mirrors service order sections in the Slides tab | Must be audited for any `SERVICE_SECTIONS.length` / index-4 assumption |
| **Print** (`ServicePrintLayout.vue`) | Renders the printable order of service | Must be audited — printed layouts are a common place a hard-coded "last section" heading/footer assumption hides |
| **Share** (`ShareView.vue`, `QuarterShareView.vue`) | Read-only public view | Same audit as print |
| **Planning Center export** (`src/utils/planningCenterExport.ts`) | Builds PC plan items from slots | Sections aren't part of the PC item shape today (slots map 1:1 to PC items by kind/position) — verify it doesn't filter/label by section anywhere, but this is lower risk than print/share since PC export is kind-driven, not section-driven |

**Recommended sequencing relative to §1:** land the fixed/immovable five-section ordering model FIRST
(with only the existing four sections, proving the per-section-container Sortable approach works),
THEN add `'post-service'` as the fifth container — adding a section to an already-correct structural
model is a one-line type change plus a UI audit; adding it to the *current* flat-array-with-inferred-headers
model would just be adding a fifth way for Bug A/B/C to manifest.

---

## 3. Hard-locking slide groups to service order — deleting reconciliation

**Confidence: HIGH** on the architecture recommendation and the full consumer enumeration (all found by
direct grep + read of every hit).

### Recommended architecture: keep groups persisted, but make every service-order write deterministically rebuild them — delete the "diverged, ask the user" branch entirely

`SlideGroup` documents are useful to keep **persisted** (not derive-on-read) because they carry
per-slide state that has no other home: `label`, `notes`, `audioUrl`/`audioScope`/`audioLoop` per slide,
`bedAudioUrl`, and (new in v1.4) backgrounds. Deriving on every read would either lose that
user-authored state or require re-deriving it from nothing, which is what reconciliation's
`hasCustomization`/`isNonDerivableEntry` machinery exists to protect *today* — and that protection is
precisely the mechanism the milestone wants removed. The replacement rule is simpler than reconciliation,
not more complex: **the SONG/SCRIPTURE/IMPORTED slot's *structural* shape (section order, membership,
count) is not something the user is allowed to diverge from anymore** (per "Song groups read-only in the
Slides tab," already a v1.4 decision in STATE.md's Key Decisions table). Once slide *structure* can no
longer diverge, there's nothing left to reconcile — only content-derived entries (`lyric`/`scripture`/
`imported`/`copyright`) plus user-added ones (`video`, authored `text`) need to be re-merged
deterministically on every write, always, with no confirm gate, because there is no longer a "the user
customized structure and might lose it" case for the four content kinds — group-level backgrounds and
per-slide backgrounds (§7) attach to `GroupSlideEntry`/`SlideGroup` by id, which `deriveGroupEntries`
already preserves via `buildInitialGroup`'s "content changed, not identity" contract.

Concretely: `reconcileSongGroup`'s **additive merge** logic (the by-`sectionId`, positional-consumption
merge that already never confirm-gates — `slideGroupMaterializer.ts:238-392`) is close to what should
remain, **minus the song-identity-swap confirm branch** (lines 250-267) — a song swap becomes an
unconditional silent replace, matching "Swapping a song silently rewrites its slides" verbatim from
PROJECT.md. `reconcileScriptureGroup`/`reconcileImportedGroup` (`reconcileUnstableIdGroup`,
lines 437-458) collapse from a three-branch (unchanged / silent-replace / confirm-required) shape to
two (unchanged / always-replace) — deleting only the `hasCustomization` branch.

**When this rebuild should run:** the existing wiring in `useSlideshowAssembly.ts` already has the right
shape — `reconciliationOutcomes` is a synchronous `computed` recalculated on every `service`/store change,
and `applyReconciliationOutcomes` is the async effect that writes. Keep that plumbing; delete only the
`needsConfirm` branch and everything that exists to serve it.

### Every consumer of the reconciliation path that must be unwound

| File | Symbol(s) | Disposition |
|------|-----------|--------------|
| `src/utils/slideGroupMaterializer.ts` | `hasCustomization`, `isNonDerivableEntry`, `computeLoss`, the `needsConfirm`/`songSwap` branches of `reconcileSongGroup` and `reconcileUnstableIdGroup`, `ReconcileResult.needsConfirm`/`.proposed`/`.loss`/`.songSwap` fields | Delete the confirm branches; keep the additive-merge / signature-diff *replace* logic, made unconditional |
| `src/composables/useSlideshowAssembly.ts` | `pendingReconciliationsMap`, `PendingReconciliation` interface, `pendingReconciliations` return value, the `needsConfirm` branch inside `applyReconciliationOutcomes` (lines 454-496), `dismissedSignature` comparison (lines 464-478) | Delete entirely — `applyReconciliationOutcomes` becomes "always write the outcome," no map, no confirm state |
| `src/types/slideGroup.ts` | `SlideGroup.dismissedSignature` field (lines 44-57) | Delete field |
| `src/stores/slideGroups.ts` | `dismissReconciliation` function (lines 223-226) | Delete function; **keep** `replaceGroupSlides`'s `baseSlides`/`runTransaction` concurrency-merge (lines 278-330) — that's a generically useful concurrent-write guard unrelated to the confirm UX, still needed once writes become unconditional |
| `src/components/slides/ReconcileConfirmModal.vue` | Whole component | Delete file |
| `src/components/slides/SlideGrid.vue` | `reconciliationNotice` computed, `showReconcileModal`, `pendingForSelected`, `onApplyReconciliation`, `onDismissReconciliation`, the `<ReconcileConfirmModal>` template block (lines 81-90), the passive-banner block (lines 64-80), `pendingReconciliations` prop | Delete all; `pendingReconciliations` prop removed from the component's prop contract |
| `src/components/slides/SlidesTab.vue` | `pendingReconciliations` prop passthrough (lines 45, 139) | Delete prop passthrough |
| `src/components/slides/slideDisplay.ts` | `PendingReconciliation` interface (line 148), `EnsureGroupMaterializedResult` (unaffected — keep; it's the on-demand materializer contract, unrelated to reconciliation) | Delete `PendingReconciliation` |
| `src/views/ServiceEditorView.vue` | `pendingReconciliations`/`ensureGroupMaterialized` destructured from `useSlideshowAssembly` and passed to `SlidesTab` (lines 1028, 1032, 1393-1394) | Delete `pendingReconciliations` wiring; **keep** `ensureGroupMaterialized` — unrelated (on-demand create, not reconcile) |
| Tests | `slideGroupMaterializer.test.ts`, `useSlideshowAssembly.test.ts`, `SlideGrid.test.ts`, `SlidesTab.test.ts`, `ReconcileConfirmModal.test.ts`, `slideGroups.test.ts`, and any `EditSlideDrawer.test.ts` cases exercising the confirm path | Every confirm-path test case deleted; additive-merge / signature-diff test cases updated to assert unconditional replacement instead of a `needsConfirm: true` result |

**Note on `EditSlideDrawer.vue`:** grep found it as a *file* referencing reconciliation types (via the
composable's return shape passed through `SlidesTab`), but its own logic ("Edit in song"/"Edit in
scripture" links, per-slide label/notes/audio/delete) is independent of the confirm flow — it should
need no direct code change from this deletion beyond whatever prop-shape ripple `SlidesTab`/`SlideGrid`
changes cause.

**Build-order dependency (stated explicitly by the downstream-consumer prompt, confirmed by the code):**
delete reconciliation-confirm *before* building the "hard mirror" unconditional-rebuild behavior — they
are the same code path (`reconcileGroup`/`applyReconciliationOutcomes`), so this isn't really two
sequential phases so much as one phase that both deletes the confirm branch and makes the remaining
branch unconditional in the same change. Land it AFTER §1's ordering-model fix, because "hard-locked to
service order" only means something once service order itself stops corrupting on drag.

---

## 4. Draft-only editing — where the gate genuinely enforces vs. is cosmetic

**Confidence: HIGH.**

### Current state (verified, not assumed)

- **Firestore rules** (`firestore.rules:51-53`): `match /services/{docId} { allow write: if isOrgEditor(orgId); }` — **role-only, zero status check.** Any org editor can write to a `planned` or `exported` service directly today; nothing in the security layer distinguishes status.
- **Router** (`src/router/index.ts:60-63`): `/services/:id` has `meta: { requiresAuth: true }` **only** — no `requiresEditor`, confirmed by the file's own comment elsewhere ("`/services/:id` has no `requiresEditor` route guard... a non-editor viewer can land here"). The router is not a status-gate candidate at all today; it doesn't even gate role.
- **Pinia store** (`src/stores/services.ts:84-90`): `updateService(id, data)` is a generic `updateDoc` wrapper with no status awareness — any caller (autosave, drag-drop, AI accept, role override) can write regardless of status.
- **Component-level gating**: exactly one computed, `isExportedLocked = computed(() => localService.value?.status === 'exported')` (`ServiceEditorView.vue:1357-1359`), consumed by **~15+ separate `v-if`/`:disabled` template checks** scattered through the Service Order tab (song picker, scripture input, sermon passage editor, AI-suggest button, etc.) — each one hand-repeats `authStore.isEditor && !isExportedLocked`. **`planned` is currently NOT locked at all** — only `exported` is. This is both incomplete (doesn't cover the milestone's "leaving Draft locks... " requirement) and purely cosmetic (a network-level write, a stale tab, or a bypassed component still succeeds against Firestore).

### Where the gate belongs — minimum genuinely-enforcing set

1. **Firestore rules — the only layer that is actually enforcing.** Add a status check to the
   `/services/{docId}` write rule: allow update only when `resource.data.status == 'draft'`, **OR** the
   write is exactly the reopen-to-draft transition (`request.resource.data.status == 'draft' &&
   resource.data.status != 'draft'`, i.e. the one mutation allowed to originate from a non-draft
   document) **OR** the draft→planned/exported transition itself (status changing forward, which today's
   `onSave()` already special-cases for `lastUsedAt` bumping — see §6). This needs field-level nuance
   (Firestore rules can inspect `request.resource.data` vs `resource.data` diffs), not just a boolean —
   plan this as its own rules-design task, not a one-line addition, and pair it with `test:rules`
   coverage (the project already has a rules-emulator test harness per `storage.rules.test.ts`'s sibling
   pattern).
2. **Store-level guard as defense-in-depth, not the source of truth.** `serviceStore.updateService`
   could early-return (or throw) when attempting to write slot/roleAssignment fields against a
   non-draft, non-reopening service — this gives a clean error surface for accidental client bugs
   (e.g., a stray autosave firing after a reopen race) without relying on the Firestore round-trip to
   catch it. This is a real second layer, not cosmetic, because it runs on every call site (autosave,
   drag-drop-immediate-save, AI accept, section change) without needing each one to remember to check.
3. **Component-level disabling is UX, not enforcement — keep it, but centralize it.** Replace the
   ~15-repetition pattern with a single computed (e.g. `isEditable = computed(() =>
   authStore.isEditor && localService.value?.status === 'draft')`) consumed everywhere `isExportedLocked`
   is today, extended to cover `planned` as well as `exported`. This is necessary for a good UI (don't
   show pickers/inputs a save would reject) but must never be treated as the enforcement layer — it's
   the layer that's easiest to bypass (devtools, a stale build, a second browser tab).
4. **Router is not a natural fit** for a *status* gate (it already skips even *role* gating on this
   route by design — viewers land here too, for read-only). Leave routing as-is; the tab-level
   `isEditable` computed already accounts for both role and status uniformly.

### The reopen-to-draft transition

This is the one deliberate exception every layer above must special-case identically: `status:
'planned'|'exported' → 'draft'` must be the *one* write a non-draft service still accepts, and (per
PROJECT.md's decision table) it must warn when `pcExportedAt`/`pcPlanId` are already set (the service
was actually exported to Planning Center) so the warning lives at the point of the status-changing
action, not scattered through field-level disables. Firestore rules need an explicit allowance for
this exact status transition (see point 1); the store action that performs it should be a dedicated
`reopenService(id)` (mirroring `setRoleOverride`'s scoped-write precedent already in `services.ts`)
rather than routing through the generic `updateService`, so the rules-side exception can be scoped
tightly to that one write shape instead of accepting arbitrary field changes alongside a status flip.

---

## 5. PPTX server-side image rendering — integration with the existing pipeline

**Confidence: HIGH** on integration points; the rendering technology choice itself is out of scope for
this architecture doc (a STACK.md concern).

### Existing pipeline (verified in `functions/src/index.ts` and `pptxParser.ts`)

- `parsePptx` (`onCall`, `functions/src/index.ts:199-202`) — text-only extraction. Auth-gated
  (`request.auth` + independent `organizations/{orgId}/members/{uid}` re-check, never trusting the
  client-declared `orgId` alone), storage-path-gated (`storagePath` must start with
  `orgs/${orgId}/pptx-imports/`), and **never deletes the source object on any path** (explicit
  invariant in the doc comment, line 148-150 — "this function never issues a delete call at all").
- Extracted images already live at `orgs/{orgId}/pptx-imports/{importId}/images/{n}.{ext}`
  (`pptxParser.ts:166, 210`), written via `bucket.file(path).save(imageBuffer, ...)`.
- `cleanupExpiredMedia` (`onSchedule`, `index.ts:254-301`) is **structurally incapable** of touching
  this path: `MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//` (line 241) is checked *before* any delete
  decision, and the comment states explicitly it "imports NO Firestore API at all" and only ever
  lists/deletes objects under `orgs/{orgId}/media/`. `pptx-imports/` is outside that prefix by
  construction — this is not a coincidence to preserve carefully, it's a structural guarantee already
  in place.

### Recommended integration for server-side rendering

1. **New Cloud Function, not a modification of `parsePptx`.** Keep text extraction (`parsePptx`) and
   image rendering as separate callables (or make rendering an optional second phase of the same
   upload flow) — text parsing is fast/cheap and already ships; full-fidelity rendering (headless
   LibreOffice/PowerPoint conversion or similar) is a heavier, slower, more failure-prone operation that
   deserves its own timeout/memory profile (the existing `parsePptx` is already tuned tight at
   `{ memory: "1GiB", timeoutSeconds: 120 }` — rendering will likely need more of both) and its own
   error path that degrades gracefully to text-only rather than failing the whole import.
2. **Rendered images belong under the SAME `pptx-imports/{importId}/` prefix**, e.g.
   `orgs/{orgId}/pptx-imports/{importId}/rendered/{n}.png` — sibling to the existing `images/` folder,
   not a new top-level namespace. This is what makes them automatically exempt from
   `cleanupExpiredMedia` with **zero changes** to that function or its guard regex; putting rendered
   images under `orgs/{orgId}/media/` instead would be a real, avoidable landmine (that path IS subject
   to the 14-day retention delete, which is wrong for a permanently-referenced rendered slide).
3. **Slide model reference point:** `ImportedDeck.slides: (TextSlide | ImageSlide)[]`
   (`src/types/importedDeck.ts:16`) and `ImageSlide { contentKind: 'image'; imageUrl; altText? }`
   (`src/types/slide.ts:86-90`) already exist and are exactly the right shape for "one slide, one
   rendered image." The milestone's "retaining parsed text as a layer" requirement means widening
   `ImageSlide` with an optional field (e.g. `parsedText?: string`) rather than keeping the parsed text
   as a separate `TextSlide` sibling — a rendered PPTX slide should be **one** `ImageSlide` entry with
   its extracted text attached as metadata (searchable/labelable, per the milestone), not two entries a
   user could get out of sync. This is inside the greenfield boundary (`ImportedDeck`/`Slide` types,
   Phase 21+, never shipped) — reshape freely, no migration.
4. **`deriveGroupEntries`'s `'IMPORTED'` case** (`slideGroupMaterializer.ts:75-85`) already maps
   `deck.slides` 1:1 into `GroupSlideEntry[]` by index — no change needed there once `ImageSlide` carries
   the rendered URL; the materializer doesn't care whether the image came from text-extraction or
   full-render, only that `ImportedDeck.slides[i]` resolves to something displayable.
5. **`sourceSignature`'s `'IMPORTED'` branch** (`slideGroupMaterializer.ts:128-134`) currently signs on
   `s.contentKind === 'image' ? s.imageUrl : s.body` — this keeps working unchanged if rendered slides
   stay `contentKind: 'image'`, but must be revisited if `parsedText` is added as a field on `ImageSlide`
   (decide whether a same-image-different-text edit should count as a signature change; likely yes,
   since under §3's "always rebuild" model this only matters for *detecting* a genuine re-import, not
   for gating a confirm).

---

## 6. App-wide save-status store + fixing Service Order autosave

**Confidence: HIGH** on the architectural placement question; **MEDIUM** on the specific autosave-bug
root cause (strong, code-evidenced hypothesis below, not empirically reproduced by running the app in
this session).

### `useAutoSave` exists and is NOT used by `ServiceEditorView.vue`

`src/composables/useAutoSave.ts` is a real, tested, reusable composable (`status`/`flush`/`cleanup`,
800ms debounce, inflight guard, first-trigger suppression) — its own doc comment says it was "extracted
from ServiceEditorView's pattern." It IS consumed by `SongLyricEditor.vue`, `ScriptureSlideEditor.vue`,
and `CongregationalEditor.vue` (confirmed via grep). **`ServiceEditorView.vue` still hand-rolls its own
~150-line duplicate** (`autosaveStatus`/`autosaveTimer`/`autosaveInitialized`/`autosaveSaving`/
`previousService` module-level state, lines 1210-1215, plus the watcher at 1607-1657 and the
drag-drop-immediate-save special case at 1445-1463) — it predates the extraction and was never migrated.
This duplication is itself an architectural defect worth fixing regardless of the specific bug below:
two independent implementations of the same debounce/inflight/status-lifecycle logic will keep drifting
(the hand-rolled copy has already accumulated its own patch comments — "D-15", "D-16", "D-17" — each one
a symptom-level fix layered onto growing complexity the shared composable doesn't have).

### Where the global save-status store belongs

A new `useSaveStatus` Pinia store (or a plain composable backed by one shared `ref`, consistent with
how `authStore`/`songStore` etc. are structured) should sit **above** `useAutoSave`, not replace it:
`useAutoSave` stays the per-editing-surface debounce/save mechanism (one instance per tab/composable
consumer — Service Order, Roles, Slides, Song Lyrics, Scripture editor each keep their own save
lifecycle since they write to different documents/fields on different schedules); the new store is a
**thin aggregator** each `useAutoSave` instance reports its `status` into (e.g. via a small wrapper that
calls `saveStatusStore.report(sourceId, status)` inside `useAutoSave`'s own status-setting points, or by
having each consumer `watch()` its own `status` ref and forward it). The persistent inline "Saving… /
Saved HH:MM" indicator the milestone wants is then a single global UI element reading the aggregator,
while each individual editing surface still owns its own debounce timing and dirty-detection — this
avoids collapsing five independently-timed save flows into one shared timer, which would either coarsen
the debounce for surfaces that don't need it or create false "Saving…" flicker across unrelated tabs.
**Toast-on-failure-only** should also route through this same aggregator (a `status: 'error'` value
`useAutoSave` doesn't currently have — it needs a fifth status added to `AutoSaveStatus`, since today's
type is `'idle'|'pending'|'saving'|'saved'` with no failure state at all; `flush()`/the debounced saver
currently let a thrown `saveFn()` propagate as an **unhandled rejection with no status change**, which
is itself worth fixing as part of this work regardless of the specific song-select bug below).

### The song-change-never-autosaves bug — root-cause hypothesis

Every direct mutation path for `songId` (`onSelectSong` at `ServiceEditorView.vue:1867-1878`,
`onClearSong`'s no-confirm-needed branch at 1880-1896, `confirmSlotDelete`'s clear-song branch at
1829-1837, `acceptAiSong` at 2078-2085, all funneling through `onSelectSong`) performs a textbook-correct
Vue 3 reactive mutation: `localService.value.slots[index] = { ...slot, songId, songTitle, songKey }`.
Under Vue 3's Proxy-based reactivity this **should** trigger the `deep: true` watcher on `localService`
(`ServiceEditorView.vue:1607-1657`) exactly like any other field edit — there is no Vue-2-style
"array index assignment isn't reactive" trap here. Having ruled that out, the strongest evidenced
mechanism is a **flag-reset race between the two `localService`-adjacent watchers**, both declared in
this same file:

1. **`onSave()` (line 2658-2702) explicitly destructures `updatedAt` out of the write payload**:
   `const { id, createdAt, updatedAt, ...data } = localService.value` — the client never locally tracks
   the true post-save server timestamp.
2. **`serviceStore.updateService()` (`src/stores/services.ts:84-90`) always writes
   `updatedAt: serverTimestamp()` server-side**, regardless of what the client sent.
3. Every save's resulting `onSnapshot` echo therefore lands in `serviceStore.services` carrying a
   **new, server-resolved `updatedAt`** that the client's `originalService.value`/`localService.value`
   never held — so `JSON.stringify` comparison in the "remote update" watcher
   (`ServiceEditorView.vue:1546-1590`, specifically `remoteJson !== localJson` at line 1578) is
   **virtually guaranteed to be true on every single save's own echo, not just on genuine remote
   changes from another client.**
4. That branch (entered because, right after a save completes, `autosaveStatus.value` is `'idle'`
   or `'saved'` — exactly the condition it checks) reassigns `localService.value`/`originalService.value`
   **and unconditionally resets `autosaveInitialized = false`** (line 1583) on every one of these
   self-echoes — i.e., after every save, not just after a genuine concurrent edit from someone else.
5. The autosave watcher's very next deep-watch trigger — **whatever mutation happens to cause it**,
   with no way to distinguish "the mutation that reset this flag" from "an unrelated subsequent user
   edit" — gets silently swallowed by the `if (!autosaveInitialized) { autosaveInitialized = true;
   return }` guard (lines 1615-1618).
6. Fields edited by **continuous input** (typing in the notes/sermon-topic textarea, retyping a
   scripture reference) self-heal: even if one keystroke's trigger lands in the swallowed window, the
   very next keystroke fires the watcher again with the flag now `true`. **A song pick is a single,
   discrete, one-shot mutation** — if that one click happens to land in the (short, but real — every
   save's Firestore round-trip echo, typically well under the 3-second "Saved" fade window) post-echo
   reset window, it is dropped with **no error, no retry, and no visible symptom other than "it didn't
   save."** This matches "changing a song currently never fired autosave" far more precisely than a
   pervasive reactivity failure would (which would also break every other field, and it doesn't).

**Recommended fix, in order of confidence:** (a) stop resetting `autosaveInitialized` on a
self-echo — compare the incoming snapshot's `updatedAt` against a value the client DID capture from its
own last successful save (have `onSave()`/the reorder-immediate-save path store the server-confirmed
`updatedAt` it gets back, or simply compare everything *except* `updatedAt`/`createdAt` when deciding
`remoteJson !== localJson`, since those two fields are the only ones the client never locally
tracks accurately); (b) once that's fixed, migrate `ServiceEditorView.vue` off the hand-rolled autosave
onto the shared `useAutoSave` composable (removing the duplicate `autosaveInitialized` boolean entirely
in favor of the composable's own, better-isolated, single-purpose guard) rather than patching the
hand-rolled version a fourth time (D-15/D-16/D-17 are already three prior patches to this same block).
This should be verified empirically (a manual repro: pick a song immediately after a prior save's echo
lands, confirm it silently doesn't persist) before committing to the exact fix shape — the mechanism
above is strongly evidenced but not yet reproduced live.

---

## 7. Backgrounds and the 3-dot menu / split drawers

**Confidence: MEDIUM** — the model-shape recommendation is grounded in the existing `SlideGroup`/
`GroupSlideEntry`/`Song` shapes actually read; the drawer split is a UI restructuring the milestone
scopes explicitly, and this section describes the *data* implications, not the visual design (that's a
UI-SPEC concern for the relevant phase).

### Background image data model

Three distinct scopes, matching three distinct existing anchors already in the codebase:

- **Whole slide group** — `SlideGroup` already carries group-scoped media (`bedAudioUrl`,
  `sourceSignature`) at `organizations/{orgId}/slideGroups/{slotId}` (`src/types/slideGroup.ts:34-61`).
  A `backgroundImageUrl?: string` field belongs here, at the same level as `bedAudioUrl`, and should
  follow `setGroupBedMedia`'s scoped-write pattern (`slideGroups.ts:173-204` — `updateDoc` touching only
  the one field + `updatedAt`, with a skeleton-create fallback for a not-yet-materialized group) rather
  than a full-document rewrite, for the same concurrency reasons documented there.
- **Single slide** — `GroupSlideEntry` (`slideGroup.ts:68-80`) already carries per-slide overrides
  (`label`, `notes`, `audioUrl`, `audioScope`, `audioLoop`). A `backgroundImageUrl?: string` field
  belongs here too, alongside those, with the SAME "slide overrides group" precedence pattern the
  existing audio fields already establish (`AudioPlayer`/`SlideBase.audioUrl`'s doc comment describes
  "two-level precedence — the entry's OWN audio first, falling back to the group's `bedAudioUrl`" —
  backgrounds should mirror this exactly: per-slide background wins, else group background, else none).
- **Whole song (set from the Song Lyrics editor)** — this is the one scope with **no existing anchor in
  the slide-group model at all**, because it needs to live on the canonical `Song`/`SongLyrics` record
  (`src/types/song.ts`/`src/types/songLyrics.ts`), not on any per-service `SlideGroup` — a song's
  background must be visible in *every* service that uses the song, matching D002's "single canonical
  song lyric version… services reference live, not as copies" precedent already governing lyrics
  themselves. Add `backgroundImageUrl?: string` to `SongLyrics` (greenfield, Phase 18+, no migration per
  D-19), and have `deriveGroupEntries`'s `'SONG'` case (`slideGroupMaterializer.ts:30-57`) read it as the
  bottom of the same three-level precedence chain (slide entry → group → song).

**Precedence resolution point:** wherever `assembleSlideshow`/the presentation layer currently resolves
`audioUrl` per slide (the "slide beats bed" logic referenced throughout `slideGroupMaterializer.ts`'s
comments) is the natural place to add the equivalent `backgroundImageUrl` resolution — same shape,
same file, extend rather than invent a parallel mechanism.

### Splitting the Edit Slide drawer

`EditSlideDrawer.vue` (1,050 lines) is currently a single scrimless floating panel
(`src/components/slides/EditSlideDrawer.vue`, shipped Phase 26) that surfaces every editable concern in
one scroll region per slide: label, notes, audio scope/loop, an inline-editable text body
(`drawer-slide-text-editable`, D-13's "one editable exception"), delete, and the "Edit in song"/
"Edit in scripture" cross-navigation links (`onEditInSong`, line 938-943, via `songEditLink.ts`). It has
no internal tab component today — the milestone's "single multi-tab Edit Slide drawer" describes this
one-panel-does-everything shape, not a literal `<Tabs>` widget, and the ask is to split it into two
separate drawer instances reached via a 3-dot menu instead of the current click-to-select-opens-drawer
flow:

- **"Edit details"** — label, notes, audio (scope/loop), background (new), delete, and the cross-nav
  links. This is metadata *about* the slide, independent of its content.
- **"Edit lyrics"** — the inline-editable text body (today's `drawer-slide-text-editable` path), scoped
  to the one case D-13 already carves out as editable in-place (a hand-authored text slide — song
  lyrics themselves stay read-only here per the "song groups read-only in the Slides tab" v1.4 decision,
  edited only from the Song Lyrics screen).

Given the milestone's requirement that "song groups [are] read-only here," the "Edit lyrics" drawer is
scoped narrowly — it applies to hand-authored text slides (PRAYER/MESSAGE/HYMN placeholder text, or a
user-added blank slide) and NOT to SONG-group lyric entries, which route to "Edit in song" instead. This
means the two-drawer split is less "two views of the same data" and more "two different affordances
that happen to share the same trigger point (3-dot menu) and the same underlying `GroupSlideEntry`" —
worth confirming against the Claude Design wireframes (`Slides Tab.dc.html`) at plan time, since the
exact condition for which drawer a given slide's 3-dot menu opens (or whether both are always available,
with "Edit lyrics" disabled for read-only content) is a UI decision this research doc can't settle from
the code alone.

---

## Recommended build order

Ordered to respect the dependencies explicitly named in this research and in PROJECT.md's milestone
scoping — later items build on structural guarantees earlier ones establish:

1. **Fix the `v-for` key** (`slot.kind + '-' + slot.position` → `slot.id`) in `ServiceEditorView.vue` —
   cheapest possible change, always-correct, unblocks nothing but itself, do first as a quick win that
   also removes one of the three compounding drag-drop bugs immediately.
2. **Fixed five-section ordering model** (§1) — per-section Sortable containers (or, at minimum,
   `evt.oldDraggableIndex`/`newDraggableIndex` + a real multi-step DOM revert), applied to BOTH
   `ServiceEditorView.vue`'s slot list and `SlideGrid.vue`'s card grid (same root pattern, same fix
   shape, do together). This is the prerequisite for §2 (Post-Service) and for "slides mirror the plan"
   meaning anything, so it must land before both.
3. **Post-Service section** (§2) — additive type change once the ordering model is trustworthy; audit
   print/share/plan-rail/PC-export for hard-coded four-section assumptions.
4. **Delete reconciliation, make slide-group rebuild unconditional** (§3) — depends on #2/#3 only in
   that "service order" must be a stable source of truth first; otherwise independent. Enumerated
   consumer list above is the removal checklist.
5. **Draft-only editing + reopen** (§4) — independent of #1-4; can be built in parallel, but sequence
   its Firestore-rules change carefully against #1's drag-drop-immediate-save path (a reorder mid-flight
   during a status transition needs the same rule to hold).
6. **Save-status store + Service Order autosave fix** (§6) — the `autosaveInitialized`-reset race fix
   should land before the global save-status UI is wired to it, so the UI doesn't faithfully surface a
   still-broken "silently didn't save" state; migrating `ServiceEditorView` onto `useAutoSave` can follow
   once the root cause is confirmed.
7. **PPTX server-side rendering** (§5) — independent of the above; can proceed in parallel, gated only
   on the `ImageSlide`/`ImportedDeck` type widening being greenfield-safe (it is).
8. **Backgrounds + drawer split** (§7) — backgrounds' data model depends on §3's group/entry rebuild
   being the stable, unconditional path (a background set on a `GroupSlideEntry` that reconciliation can
   still silently discard would be a regression); the drawer split is a UI restructuring best sequenced
   after backgrounds exist as fields to display, so both land last.

## Sources

- `src/types/service.ts`, `src/utils/slotTypes.ts`, `src/views/ServiceEditorView.vue` — read in full for
  ordering model, autosave, and section logic.
- `src/components/slides/SlideGrid.vue`, `EditSlideDrawer.vue`, `SlidesTab.vue`, `slideDisplay.ts` — read
  for the Slides tab's parallel Sortable instance and reconciliation consumers.
- `src/utils/slideGroupMaterializer.ts`, `src/composables/useSlideshowAssembly.ts`,
  `src/stores/slideGroups.ts`, `src/types/slideGroup.ts` — read in full for reconciliation architecture.
- `src/composables/useAutoSave.ts`, `src/stores/services.ts` — read for save-status architecture.
- `functions/src/index.ts`, `functions/src/pptxParser.ts` — read for the PPTX/media-cleanup Cloud
  Function boundary.
- `firestore.rules`, `src/router/index.ts` — read for RBAC/status-gate enforcement layers.
- `node_modules/sortablejs/modular/sortable.esm.js` (v1.15.7) — read to confirm `oldIndex`/`newIndex`
  vs `oldDraggableIndex`/`newDraggableIndex` semantics, the load-bearing evidence for §1.
- `.planning/PROJECT.md`, `.planning/STATE.md` — milestone scope, D-18/D-19 greenfield/production
  boundary, v1.3 standing decisions.

---
*Architecture research for: WorshipPlanner v1.4 "Service and Slides"*
*Researched: 2026-07-28*
