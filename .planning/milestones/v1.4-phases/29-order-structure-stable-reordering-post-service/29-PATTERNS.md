# Phase 29: Order Structure — Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 6 direct edits + 4 audited consumers
**Analogs found:** 5 / 6 (SongLyricEditor.vue is a same-shape analog but out-of-scope-do-not-edit)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/views/ServiceEditorView.vue` (Sortable block, ~1413-1467) | component (drag controller) | event-driven + CRUD (Firestore write) | itself (refactor target) — structurally closest sibling is `SlideGrid.vue:647-716` | exact-shape, self-refactor |
| `src/components/slides/SlideGrid.vue` (Sortable block, ~647-716) | component (drag controller) | event-driven + CRUD | `ServiceEditorView.vue:1413-1467` (the original it copy-pasted from) | exact |
| `src/types/service.ts` (`ServiceSection`/`SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS`, lines 13-22) | model / enum | n/a (static const) | itself — no other string-union+array pair to add a member to in this codebase; treat this file as its own precedent | n/a — first of its kind |
| `src/composables/useSlideshowAssembly.ts:544-559` (`assembledSections`) | transform | batch (array group-by) | already-correct consumer — no change needed beyond it inheriting the 5th section for free | exact, read-only audit |
| `src/components/ServicePrintLayout.vue:17` | component | request-response (render) | iterates `props.service.slots` directly (position order), no section enumeration — no change needed | exact, read-only audit |
| `src/utils/planningCenterExport.ts:56` | service (transform) | batch | iterates `service.slots` directly, no section enumeration — no change needed | exact, read-only audit |
| `src/components/slides/SlidePlanRail.vue` | component | request-response (render) | no section references at all today (D-06: order locked, no drag) — no change needed | exact, read-only audit |
| Test fixtures: `SlideGrid.test.ts`, `ServiceEditorView.test.ts` | test | event-driven (mocked Sortable) | `SlideGrid.test.ts:91-101` (existing capture pattern) | exact |

**Bottom line on the four "downstream consumers" named in CONTEXT.md:** all four already iterate
`SERVICE_SECTIONS` (`useSlideshowAssembly.ts:548`) or `service.slots` directly in array order
(`ServicePrintLayout.vue:17`, `planningCenterExport.ts:56`) — none hard-codes "four sections" or
enumerates section names literally. The audit's expected finding is **no code change required** in
these four files; Post-Service flows through once `SERVICE_SECTIONS` gains the fifth member. Grep
confirms zero literal occurrences of `'pre-service'`/`'sending'`/etc. outside `service.ts`,
`slotTypes.ts`, and the two editor components. Still worth a green-run assertion in tests, not a
source edit.

## Pattern Assignments

### `src/views/ServiceEditorView.vue` — Sortable refactor (controller, event-driven)

**Analog:** itself, current lines 1413-1467, plus the v-for at 520-536.

**Current single-instance setup** (lines 1415-1420):
```typescript
const slotContainerRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

watch(slotContainerRef, (el) => {
  if (el && !sortableInstance) {
    sortableInstance = Sortable.create(el, {
```
**Copy:** the `watch(ref, ..., { flush: 'post' })` lifecycle shape, `handle: '.drag-handle'`,
`draggable: '.slot-item'`, `animation: 150`, `ghostClass: 'opacity-30'` — all carry over unchanged
per UI-SPEC §1.

**Change to a keyed-map-of-instances.** No existing precedent for multiple Sortable instances exists
in this codebase (see "No Multi-Instance Precedent" below) — model it as `Map<ServiceSection,
Sortable>` keyed by section, built by a `setSectionListRef(section, el)` ref-callback (per UI-SPEC
§1 markup) instead of a single `ref`. Destroy-and-recreate on teardown follows the guard pattern
already used in `SlideGrid.vue:652-655,712-714` (`destroySortable()` + the `else if` branch of the
watcher) — that is the correct analog for teardown, not `ServiceEditorView.vue` (which never tears
down its single instance today).

**Bug 1 — wrong index source** (lines 1431, 1440, 1442):
```typescript
async onEnd(evt) {
  if (!localService.value || evt.oldIndex == null || evt.newIndex == null) return
  if (evt.oldIndex === evt.newIndex) return
```
Change to `evt.oldDraggableIndex` / `evt.newDraggableIndex`. Once sections are separate containers,
this mostly self-corrects (no header siblings in the container at all — see UI-SPEC §1's "isn't even
in the same DOM subtree" note) — but the CONTEXT.md regression guard explicitly wants an assertion
that the handler reads the Draggable-prefixed properties, so make the change explicit rather than
relying on the header removal alone.

**Bug 2 — false comment** (lines 1422-1427): delete entirely, per CONTEXT.md code_context. Do not
carry any variant of this comment into the new per-section handler.

**Bug 3 — D-16 single-step DOM revert** (lines 1433-1438):
```typescript
// D-16: revert SortableJS's DOM move so Vue's reactive render is the single source of truth (prevents snap-back)
const parent = evt.item.parentNode
if (parent) {
  const ref = parent.children[evt.oldIndex]
  parent.insertBefore(evt.item, evt.oldIndex < evt.newIndex ? ref?.nextSibling ?? null : ref ?? null)
}
```
**Remove this block entirely** per CONTEXT.md's explicit decision — this is a deliberate
simplification once `slot.id` is a stable key, not a defect to preserve. **Do not copy this block
into any new code**, and note that `SlideGrid.vue:672-679` and `SongLyricEditor.vue`'s equivalent
still carry it — SlideGrid's copy must also be removed in this phase (SongLyricEditor's is Phase
28/out of scope, leave as-is).

**Save-failure revert — new code, no existing analog for the revert-on-reject half.** The
`try`/`finally` at lines 1453-1462 has no `catch`:
```typescript
try {
  await serviceStore.updateService(serviceId.value, { slots: reindexed })
  originalService.value = JSON.parse(JSON.stringify(localService.value))
  autosaveStatus.value = 'saved'
  setTimeout(() => {
    if (autosaveStatus.value === 'saved') autosaveStatus.value = 'idle'
  }, 3000)
} finally {
  autosaveSaving = false
}
```
Add a `catch (err)`: revert `localService.value.slots` to the pre-drag snapshot (capture it before
the splice, e.g. `const preDragSlots = localService.value.slots`), set
`autosaveStatus.value = 'error'`, and `console.error('[ServiceEditorView] reorder save failed:', err)`
per the CONVENTIONS.md error-logging pattern (`[moduleName] operation:`). No other file in this
codebase reverts optimistic state on a Firestore rejection — this is new ground; use the
CONVENTIONS.md try/catch shape as the template, not any existing revert-on-failure example, because
none exists (see "No Save-Failure-Revert Precedent" below).

**v-for key** (line 521):
```html
<template v-for="(slot, index) in localService.slots" :key="slot.kind + '-' + slot.position">
```
Change `:key` to `slot.id`. Per UI-SPEC §1, restructure the `v-for` to iterate `SERVICE_SECTIONS`
outer / `slot.id`-keyed inner, per the markup skeleton already specified there (do not re-derive it
here — UI-SPEC §1 is authoritative for the template shape).

---

### `src/components/slides/SlideGrid.vue` — same three defects (controller, event-driven)

**Analog:** `ServiceEditorView.vue`'s pre-fix code is the historical source; **after** fixing
`ServiceEditorView.vue` first (per CONTEXT.md's discretion note: "extract only if it falls out
naturally"), treat the fixed `ServiceEditorView.vue` as the template for the equivalent index-source
and revert-block fixes here. Note SlideGrid.vue is a **single-section list already** (no section
headers, no per-section split needed) — only two of the three defects apply structurally:

- **Index source** (lines 670-671, 677, 689): `evt.oldIndex`/`evt.newIndex` → `oldDraggableIndex`/
  `newDraggableIndex`. Applies even though there's no header sibling here today, per CONTEXT.md's
  explicit call-out that this is "the same root-cause family" (R050 — "new slide lands
  second-to-last").
- **D-16 revert block** (lines 672-679) — remove, same as ServiceEditorView.vue.
- **No section-header key issue here** — SlideGrid has no `v-for` over sections; skip.

**Save-failure — existing silent-catch to fix** (lines 707-708):
```typescript
} catch (err) {
  console.error('Failed to reorder slides:', err)
}
```
This already has a `catch`, unlike ServiceEditorView.vue — but it's silent (no revert, no user
surface). Add: revert local `entries` (per UI-SPEC §5, capture a pre-drag snapshot before the
splice/reorder), and set a new `reorderError` ref that the UI-SPEC §5 template renders. Follow the
existing `mediaUploadError` inline-message pattern already in this same file (`SlideGrid.vue:99-103`
per UI-SPEC) for the render side — that IS the closest analog for "inline transient error text,"
reuse its class conventions.

---

### `src/types/service.ts` — enum extension (model, n/a)

**No prior precedent for extending a string-union + const-array pair in this codebase** — grep for
other `Record<X, string>` + `readonly X[]` pairs found none matching this shape elsewhere in
`src/types/`. Treat this file's own existing structure as the template for itself:

```typescript
// lines 13-22 today
export type ServiceSection = 'pre-service' | 'worship' | 'message' | 'sending'

export const SERVICE_SECTIONS: readonly ServiceSection[] = ['pre-service', 'worship', 'message', 'sending']

export const SERVICE_SECTION_LABELS: Record<ServiceSection, string> = {
  'pre-service': 'Pre-Service',
  worship: 'Worship',
  message: 'Message',
  sending: 'Sending',
}
```
Add `'post-service'` to all three in the same order (append last, per UI-SPEC §4 "always renders
fifth/last"). Update the line-9 comment ("Exactly these four members — no others") to five, and the
file's D005 reference stays but should note the Phase 29 addition inline (per CONVENTIONS.md design-
reference comment style, `(D-XX)`/`(R-XX)`).

**Consumers to re-verify after the change** (all confirmed to already iterate the array/type
correctly, not hard-code members — see file classification table above):
- `src/composables/useSlideshowAssembly.ts:548` — `for (const section of SERVICE_SECTIONS)` — picks
  up Post-Service automatically.
- `src/views/ServiceEditorView.vue:899` — `<option v-for="s in SERVICE_SECTIONS">` dropdown — picks
  up Post-Service automatically (per CONTEXT.md's own note).
- `src/components/slides/SlideGrid.vue:449` — `SERVICE_SECTIONS[0] ?? 'pre-service'` fallback for
  import section — no change needed, fallback logic is order-independent.
- `src/utils/slotTypes.ts:139` `defaultSectionForPosition()` — **check this one specifically**; it
  maps a slot's array position to a default section and may have off-by-one or last-section
  assumptions baked in from when there were 4. Read it before assuming it's safe.
- `src/types/slide.ts:124,153`, `src/types/importedDeck.ts:15`, `src/components/PptxImportModal.vue`,
  `src/components/PresentationViewer.vue:414` — all consume `ServiceSection` as a type or via
  `SERVICE_SECTION_LABELS[section]` lookup — structurally safe, no enumeration to update.

---

## Shared Patterns

### Multi-instance Sortable lifecycle — NO EXISTING PRECEDENT
No file in this codebase creates more than one `Sortable` instance concurrently. All three existing
call sites (`ServiceEditorView.vue:1420`, `SlideGrid.vue:661`, `SongLyricEditor.vue:523`) manage
exactly one instance on exactly one container ref, built via `watch(ref, ..., { flush: 'post' })`.
**Phase 29 establishes this pattern for the first time.** Use `SlideGrid.vue:650-655,712-714`'s
create/destroy guard (`canReorder` computed + `destroySortable()` + the watcher's `else if` branch)
as the closest available teardown template, generalized to a `Map<ServiceSection, Sortable>` keyed
collection: create-if-missing per section container, destroy-and-clear entries whose container ref
goes away (e.g., on unmount) via the same guard shape repeated per key.

### The three `Sortable.create` call sites — comparison

| File | Container | Draggable selector | Group | Cross-container? |
|---|---|---|---|---|
| `ServiceEditorView.vue:1420` | flat list, all slots + headers | `.slot-item` | none (single instance, no `group`) | no |
| `SlideGrid.vue:661` | flat list, one selected slot's slides | `.slide-card` | none | no |
| `SongLyricEditor.vue:523` (OUT OF SCOPE, Phase 28) | flat list, song sections | `.section-row` | none | no |

None of the three configures SortableJS `group` today — Phase 29 is also the first use of `group`
for cross-container drag (per CONTEXT.md's decision to use a shared group name, e.g.
`'service-slots'`). **Best template: `ServiceEditorView.vue`'s own current config** (`handle`,
`draggable`, `animation: 150`, `ghostClass: 'opacity-30'`) — copy those four options unchanged into
each of the five per-section instances, add `group: 'service-slots'` to each, and add `onMove` (new,
per UI-SPEC §3) to drive the `dragOverSection` highlight ref.

### Test capture pattern for Sortable — extend to multiple instances
**Analog:** `SlideGrid.test.ts:91-101` (also `SongLyricEditor.test.ts:8-20`, same shape):
```typescript
let capturedSortableOptions: SortableOptions | undefined
const mockSortableDestroy = vi.fn()
vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((_el: HTMLElement, options: SortableOptions) => {
      capturedSortableOptions = options
      return { destroy: mockSortableDestroy }
    }),
  },
}))
```
**Copy the mock shape**, but change `capturedSortableOptions` (singular) to a `Map<ServiceSection,
SortableOptions>` or an array of `{ el, options }` captures, since `Sortable.create` will now be
called once per section (5 times for `ServiceEditorView.vue`'s new tests). The mock `create` function
needs to also capture which container it was called on (e.g. via `_el.dataset.section` if the test
sets that attribute, or by call order matching `SERVICE_SECTIONS`) so each test can invoke the right
section's `onEnd` directly. `ServiceEditorView.test.ts` has no existing Sortable mock (grep found none
in that file) — this phase adds the first one there, modeled on `SlideGrid.test.ts`'s mock plus the
multi-instance extension above.

**Fixture requirement (CONTEXT.md):** existing fixtures (`SlideGrid.test.ts:417`,
`SongLyricEditor.test.ts:454`) build header-free flat arrays and call `onEnd` with hand-passed
indices — this is why the bug shipped. New fixtures must include section-header-shaped entries in
whatever container-modeling the test uses (even though the real fix removes headers from the
draggable container's DOM subtree, the *test* setup should still exercise the multi-section split
so a regression that re-merges containers gets caught), and assertions must read `moved.id` /
compare `slot.id` before/after — never assert on array index.

### Error/logging convention
**Analog:** `CONVENTIONS.md` Error Handling section + `SlideGrid.vue:707-708`'s existing (if
insufficient) catch. Use `console.error('[ServiceEditorView] <op>:', err)` /
`console.error('[SlideGrid] <op>:', err)` bracket-module-name format for the new catch blocks.

### Save-failure state surfacing — NO EXISTING REVERT-ON-REJECT PRECEDENT
Grep across `src/` for other optimistic-local-state-revert-on-Firestore-rejection patterns found
none — every other `try/catch` around a Firestore write in this codebase either logs-and-returns-null
(CONVENTIONS.md's documented pattern for services/utils) or, in components, simply lets the write
fail without reverting already-applied local mutations. **This phase's `autosaveStatus === 'error'`
state and `SlideGrid.vue`'s `reorderError` ref are new UI patterns**, though their *rendering* reuses
the existing inline-message convention:
- `ServiceEditorView.vue:374`'s `exportError` banner (destructive color contract: `red-400` text).
- `SlideGrid.vue:94-103`'s `mediaUploadError`/`rejectionNotice` inline block — closest structural
  analog for a conditionally-rendered `<div v-if="...">` error row with `red-400` text and a
  `data-testid`.
Both are cited directly in UI-SPEC §5 with concrete markup — use that markup, not new styling.

### Empty-state / placeholder precedent
**Analog:** `SlideGrid.vue:94-103`'s conditional inline-message block is the closest *structural*
analog for "conditionally-rendered bordered/dashed container with placeholder text," though it's an
error banner, not an empty-state. No existing "always-visible empty list placeholder + live drop
target" component exists in this codebase prior to Phase 29 — UI-SPEC §2 is authoritative and fully
specified (`border-dashed border-gray-800`, `text-gray-500`/`text-gray-600`, `rounded-lg p-4`); it
already follows the dark-theme conventions (`gray-950`/`gray-900`/`gray-800` scale) documented in
`CONVENTIONS.md`'s Styling section — copy UI-SPEC §2's markup verbatim, no further analog search
needed.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Multi-instance Sortable lifecycle (Map-keyed create/destroy) | component pattern | event-driven | First use in codebase; closest partial analog is `SlideGrid.vue`'s single-instance create/destroy guard (see Shared Patterns above) |
| Save-failure local-state revert | component pattern | request-response (optimistic UI) | No existing revert-on-reject anywhere in `src/`; CONVENTIONS.md's try/catch shape is the only applicable template, not a concrete revert example |
| String-union + const-array member addition | model | n/a | `service.ts` lines 13-22 are the only instance of this shape in `src/types/`; no prior "add a member" precedent to point to |

## Metadata

**Analog search scope:** `src/views/`, `src/components/`, `src/components/slides/`, `src/types/`,
`src/utils/`, `src/composables/`, plus their `__tests__` directories.
**Files scanned:** ~15 direct reads/greps across the three Sortable call sites, both test files,
`service.ts`, `slotTypes.ts`, `useSlideshowAssembly.ts`, `ServicePrintLayout.vue`,
`planningCenterExport.ts`, `SlidePlanRail.vue`.
**Pattern extraction date:** 2026-07-28
