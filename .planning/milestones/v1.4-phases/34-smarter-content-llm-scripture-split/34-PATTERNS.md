# Phase 34 (Gap Closure): Mount `CongregationalEditor.vue` — Pattern Map

**Mapped:** 2026-08-03
**Scope:** ONLY the reachability gap recorded in `34-VERIFICATION.md` / `PENDING-VERIFICATION.md` item
34.2. R064's structural correctness work (schema/validator/boundaries) is done and out of scope here.
**Files analyzed:** 4 to modify, 1 to mount, plus test analogs
**Analogs found:** 5/5

## ★★ Two premises in the orchestrator brief are WRONG — read before planning

### 1. The `edit-in-scripture` → `navigate-to-scripture-editor` relay is LIVE but does NOT open any editor

Confirmed by direct read, `src/views/ServiceEditorView.vue:1487-1506`:

```javascript
// ── Scripture editor expansion state ──────────────────────────────────────────
/**
 * Handles the "Edit in scripture" request relayed up through SlidesTab's
 * `navigate-to-scripture-editor` event ... Switches to the Service Order tab and
 * brings the plan item's ROW into view: R047 removed the expandable
 * slides-editor panel, so the row's own `ScriptureInput` is now the thing
 * being navigated to — it is where the reference, and therefore the slide,
 * is edited.
 */
async function handleNavigateToScriptureEditor(index: number): Promise<void> {
  const slot = localService.value?.slots[index]
  if (!slot || slot.kind !== 'SCRIPTURE') return
  activeTab.value = 'service-order'
  await nextTick()
  const row = document.querySelector(`[data-scripture-slot-index="${index}"]`)
  row?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
}
```

This is a **scroll-to-row**, not a mount point. R047 deliberately repurposed the relay this way after
deleting the old expandable panel. **The mount seam does not exist and must be built** — either by
making this handler open something new (e.g. a drawer/modal hosting `CongregationalEditor.vue`, keyed
per WR-04 below), or by adding a distinct affordance. Do not assume this handler already does the job.

### 2. `CongregationalEditor.vue` itself still writes to the REJECTED separate-document model

Confirmed by direct read, `src/components/CongregationalEditor.vue:130-227,285-291,322-340`. The
component:
- imports `useScriptureSlides` (`src/stores/scriptureSlides.ts`) and calls `store.createReading` /
  `store.updateReading` — a **separate `ScriptureReading` Firestore document**, keyed by
  `props.readingId`.
- on mount, loads that document via `store.getReading(props.orgId, props.readingId)`.
- persists `congregationalSections` onto **that document**, not onto the `ScriptureSlot`.

This is exactly the model `R047` explicitly rejected (`3da5fe4` superseded by `5c531b1`; see
`REQUIREMENTS.md:94-96`). CONTEXT.md's locked direction is (b) — extend `ScriptureSlot` with
`congregationalSections` and thread it through `slideGroupMaterializer`/`slideshowAssembler`. **This
means `CongregationalEditor.vue`'s persistence layer (not just its mount point) must change** — the
`useScriptureSlides` store calls in `onFetchPassage`/`doAutoSave`/`onMounted` need to be replaced with
direct slot mutation (pattern below), or the editor needs a new prop-driven save callback. This is a
larger change than "mount an existing, working component" — flag this explicitly in planning.

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|-----------------|----------------|
| `src/types/service.ts` (`ScriptureSlot`) | model | CRUD (add field) | `ScriptureSlot.readingMode` (same interface, `:59-70`) | exact — same file, same interface |
| `src/utils/slideGroupMaterializer.ts` (`deriveGroupEntries`/`sourceSignature` SCRIPTURE cases) | transform | CRUD/derive | existing SCRIPTURE branch, `:71-84` and `:132-138` | exact — same function, extend not replace |
| `src/utils/slideshowAssembler.ts` (`resolveEntryContent` + fallback path) | transform | request-response (materialize) | existing SCRIPTURE branches, `:139-157` and `:397-417` | exact — TWO call sites, both must change |
| `src/components/CongregationalEditor.vue` (persistence rewrite) | component | CRUD (edit) | `onScriptureChange` slot-mutation pattern, `ServiceEditorView.vue:2810-2824` | role-match — different layer (component vs view), same mutation shape |
| Mount point (new, in `ServiceEditorView.vue` or a drawer) | component/provider | request-response | `handleNavigateToScriptureEditor`, `ServiceEditorView.vue:1499-1506` (target of the rewrite) | exact — this IS the seam, currently a no-op scroll |
| Test file for slot/materializer change | test | — | `src/utils/__tests__/slideGroupMaterializer.test.ts:1447-1518` (`HI-01` scripture-collapse describe block) | exact |
| Test file for assembler change | test | — | `src/utils/__tests__/slideshowAssembler.test.ts` SCRIPTURE cases (mirrors both `resolveEntryContent`/fallback paths) | exact |
| Test file for editor persistence rewrite | test | — | `src/components/__tests__/CongregationalEditor.test.ts:1-33` (Pinia/auto-unmount setup) | exact — same file, extend |

## Pattern Assignments

### `src/types/service.ts` — extend `ScriptureSlot`

**Current shape** (`:59-70`):
```typescript
export interface ScriptureSlot extends MediaAttachableSlot {
  kind: 'SCRIPTURE'
  position: number
  book: string | null
  chapter: number | null
  verseStart: number | null
  verseEnd: number | null
  scriptureReadingId?: string | null
  readingMode?: 'normal' | 'congregational'
  section?: ServiceSection
}
```
Add `congregationalSections?: CongregationalSection[]` (import type from `src/types/slide.ts:70-74`,
the same type `ScriptureSlide.sections` and `CongregationalEditor.vue`'s `sections` ref already use —
no new type needed, just a new field carrying the existing type onto the slot).

`scriptureReadingId` stays — `slideshowAssembler.ts:90-94`'s comment marks it a "legacy stored id ...
surfaced if present, purely so an old entry's sourceId does not change shape underneath a consumer."
Do not repurpose it; add the new field alongside it.

### `src/utils/slideGroupMaterializer.ts` — SCRIPTURE derivation and signature

**Analog — current SCRIPTURE case, `deriveGroupEntries`** (`:71-84`):
```typescript
case 'SCRIPTURE': {
  // R047: exactly ONE reference-only entry, derived from the slot's OWN
  // reference fields ...
  if (!scriptureRefFromSlot(slot)) return []
  return [{ id: crypto.randomUUID(), order: 0, sourceRef: { kind: 'scripture' as const } }]
}
```
No structural change needed here — the entry stays a single reference-only `SourceRef`, payload-free.
`congregationalSections` is resolved LIVE off the slot at assembly time (matching how `book`/`chapter`
already are), not baked into the stored entry. This mirrors R047's own reasoning for why the ref carries
no payload (comment at `:78-82`): "The ref carries no payload... which is what lets a passage change
carry the stored entry's id/audio forward... instead of minting a fresh id."

**Analog — `sourceSignature` SCRIPTURE case** (`:132-138`):
```typescript
case 'SCRIPTURE': {
  const scriptureRef = scriptureRefFromSlot(slot)
  return scriptureRef ? formatScriptureReference(scriptureRef) : undefined
}
```
If `congregationalSections` should trigger group-signature invalidation (so a manual/AI edit to the
sections is detected as a "source changed" event the same way a passage edit is), this signature needs
to fold in the sections too — e.g. append a serialized section digest. **Verify against the actual
downstream consumer of this signature before changing it** — R047's comment at `:107-114` frames the
signature as a "cheap change-detection proxy," and `rebuildUnstableIdGroup` (`:653-664`) does NOT gate
on it ("Deliberately does NOT gate on the stored `sourceSignature`"), so it may not need to change at
all for the sections to reach a rebuilt slide. Confirm before touching.

### `src/utils/slideshowAssembler.ts` — TWO call sites materialize a `ScriptureSlide`, both need the same change

R047's own comment (`slideshowAssembler.ts:401-404`) already names this as a pair: "identical to the
stored-group resolution path above, so a slot never visibly changes slide content the moment its group
document materializes." Confirmed there are exactly two, matching the orchestrator brief's warning
about Phase 35's three-group-construction-path finding (here it is two, not three).

**Call site 1 — `resolveEntryContent`, stored-group path** (`:139-157`):
```typescript
case 'scripture': {
  // R047: a scripture entry is reference-only — never the passage text —
  // and its reference is resolved LIVE from the owning slot ...
  if (slot.kind !== 'SCRIPTURE') return undefined
  const scriptureRef = scriptureRefFromSlot(slot)
  if (!scriptureRef) return undefined
  const content: Omit<ScriptureSlide, 'id' | 'position'> = {
    contentKind: 'scripture',
    reference: formatScriptureReference(scriptureRef),
    bookRef: scriptureRef,
    text: '',
    verseRange: '',
    readingMode: 'normal',
  }
  return content
}
```

**Call site 2 — fallback path, group-not-yet-materialized** (`:397-417`):
```typescript
case 'SCRIPTURE': {
  const scriptureRef = scriptureRefFromSlot(slot)
  if (!scriptureRef) break
  const content: Omit<ScriptureSlide, 'id' | 'position'> = {
    contentKind: 'scripture',
    reference: formatScriptureReference(scriptureRef),
    bookRef: scriptureRef,
    text: '',
    verseRange: '',
    readingMode: 'normal',
  }
  emitFallback(slot, index, content, null, 0)
  break
}
```

Both build the same `Omit<ScriptureSlide, 'id'|'position'>` shape with `readingMode: 'normal'` and
`sections` omitted (the field is optional on `ScriptureSlide`, `src/types/slide.ts:83-84`). Closing the
gap means: **in both places**, read `slot.readingMode` and `slot.congregationalSections` and set
`readingMode: slot.readingMode ?? 'normal'` and (when congregational and sections present)
`sections: slot.congregationalSections`. Both sites must change identically or the two paths will
disagree on whether a congregational reading renders — the exact class of bug R047's own comment at
`:401-404` was written to prevent.

### `src/components/CongregationalEditor.vue` — persistence rewrite (this is new work, not just a mount)

**Analog for direct slot mutation — `onScriptureChange`, `ServiceEditorView.vue:2810-2824`:**
```typescript
function onScriptureChange(index: number, ref: ScriptureRef | null) {
  if (!canEditService.value) return
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SCRIPTURE') {
    localService.value.slots[index] = {
      ...slot,
      book: ref?.book ?? null,
      chapter: ref?.chapter ?? null,
      verseStart: ref?.verseStart ?? null,
      verseEnd: ref?.verseEnd ?? null,
    } as ScriptureSlot
  }
}
```
This is the established shape for "write a new value onto a `ScriptureSlot` field": read the slot out
of `localService.value.slots[index]`, spread + overwrite, reassign the array index (triggers whatever
autosave watcher `ServiceEditorView.vue` already has on `localService`). The `CongregationalEditor.vue`
rewrite should follow this shape — replacing its current `store.createReading`/`store.updateReading`
calls (`:206-221`, `:285-291`) with either (a) an emitted event carrying the new sections back up to
whatever parent mounts it (parent then does the `onScriptureChange`-style spread), or (b) a passed-in
slot-index/update callback prop. Either way, **do not keep calling `useScriptureSlides`** — that store
targets the rejected document model.

**★ WR-04 load-bearing contract, unchanged and must be honored by the mount:**
`CongregationalEditor.vue:357-376` — `currentReadingId` and everything seeded from it (`surfaceId`,
`sections`, `referenceText`, `rawText`) are captured ONCE at `onMounted` and are NOT reactive to
`props.readingId` changing afterward. Whoever mounts this (new work) MUST key it (`:key="..."`) on
whatever identifies the current record — under the new slot-based model, most likely the slot's
`id`/array index — so swapping which scripture item is being edited forces a fresh component instance.
This still applies verbatim even after the persistence rewrite, since the underlying pattern (state
seeded once in `onMounted`) is unchanged by *what* gets persisted.

### Mount point — new work, `ServiceEditorView.vue` (or a drawer/modal)

**Analog — the existing no-op relay to rewrite, `ServiceEditorView.vue:1499-1506`** (quoted in full
above). The `edit-in-scripture` → `navigate-to-scripture-editor` → `handleNavigateToScriptureEditor`
chain (`SlidesTab.vue:428,462,486`, `ServiceEditorView.vue:1222`) is the existing, tested, live
relay — reuse the wiring, replace only the handler body. Do not re-invent a new menu item or event;
the 3-dot-menu action, its emission, and its `WR-04` unsaved-drawer guard (`SlidesTab.vue:448-462`,
"checked against the OPEN drawer... not the destination") are already correct and tested
(`SlidesTab.test.ts:815-948`).

**Nearest analog for "component mounted conditionally, keyed, inside `ServiceEditorView.vue`"**: the
existing R047-removed panel is gone, but the `SaveStatusIndicator`-bearing surfaces elsewhere in this
view (e.g. how other per-item editors are conditionally rendered with `v-if`/`:key` off an index) are
the shape to copy structurally — grep `ServiceEditorView.vue` for existing `:key="`-qualified
conditional child mounts before inventing a new pattern.

## Shared Patterns

### Slot mutation (writing any field back onto a `ScriptureSlot`)
**Source:** `ServiceEditorView.vue:2810-2824` (`onScriptureChange`)
**Apply to:** the new `congregationalSections`/`readingMode` write path, wherever it lands (parent
component or the editor itself if given a direct callback).
Shape: `localService.value.slots[index] = { ...slot, <newFields> } as ScriptureSlot`, relying on the
surrounding view's existing autosave.

### Dual-materialization-path parity (SCRIPTURE)
**Source:** `slideshowAssembler.ts:139-157` and `:397-417`
**Apply to:** any change to what a SCRIPTURE `ScriptureSlide` carries. Both sites currently build an
identical `Omit<ScriptureSlide,...>` literal and must be kept in lockstep — this codebase has already
been bitten by exactly this divergence class per the file's own R047 comment.

### Component-instance identity via `:key` for record-scoped editors
**Source:** `CongregationalEditor.vue:357-376` (WR-04 contract)
**Apply to:** whatever new mount point is built. Non-negotiable per the load-bearing comment; a naive
mount without `:key` will silently misattribute saves.

## No Analog Found

None — every file in the closure's scope has a same-file or same-role analog. The only genuinely new
construct is the mount point itself (a component that has never been mounted before), for which the
closest available pattern is the relay it replaces (`handleNavigateToScriptureEditor`).

## Metadata

**Analog search scope:** `src/types/`, `src/utils/slideGroupMaterializer.ts`,
`src/utils/slideshowAssembler.ts`, `src/components/CongregationalEditor.vue`,
`src/components/ScriptureInput.vue`, `src/views/ServiceEditorView.vue`,
`src/components/slides/SlidesTab.vue`, `src/stores/scriptureSlides.ts` (read for the rejected-model
confirmation, not as a pattern to copy), corresponding `__tests__` files.
**Files scanned:** ~15 (via grep) + 8 read in full/targeted ranges
**Pattern extraction date:** 2026-08-03
