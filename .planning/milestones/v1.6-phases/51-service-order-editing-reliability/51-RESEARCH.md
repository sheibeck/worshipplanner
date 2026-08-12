# Phase 51: Service Order Editing Reliability - Research

**Researched:** 2026-08-11
**Domain:** Vue 3 + SortableJS DOM-ownership on cross-list drag; Firestore `undefined`-value writes; read-surface vs. editor render-order divergence
**Confidence:** HIGH (all three root causes confirmed by direct code reading — file:line cited; no external lookups needed)

## Summary

This is a correctness/reliability phase for three defects (R110, R111, R112) in the service-order editing surfaces. All three were isolated by reading the actual handlers and render paths in this session — no library research was required because the machinery, the shared ordering contract (`slotTypes.ts`), and the strip-undefined helper already exist in the codebase.

- **R110 (phantom duplicate on cross-section drag)** — CONFIRMED as a SortableJS ↔ Vue DOM-ownership conflict, exactly as the CONTEXT hypothesis states. The reactive logic in both `onSlotSortEnd` (`ServiceEditorView.vue:1881`) and `onTemplateSortEnd` (`ServiceTemplateEditor.vue:338`) is already correct (reassigns `moved.section`, rebuilds via `flattenBySection`). Neither handler reverts SortableJS's physical DOM move before the reactive update. Because each section is a separate `<ul>` and rows are keyed on `slot.id`, a cross-`<ul>` move leaves an orphaned, handler-less clone in the source list. Same-section reorder works because the node never changes parent `<ul>`.
- **R111 (save error moving item back to "No Section")** — CONFIRMED. The live-plan save funnel `services.ts::updateService` (line 299) spreads `...data` straight into `updateDoc` with **no** `stripUndefined`. The section dropdown (`onSectionChange`, `ServiceEditorView.vue:1774`) sets `slot.section = undefined` (an explicit own-key), which survives `reindexSlots`/`onSave` into the `slots` payload and reaches Firestore raw → "Unsupported field value: undefined". `ServiceTemplateEditor.vue` does not hit this because it strips at save (line 442).
- **R112 (empty items sink to the bottom on listing + share until text typed)** — CONFIRMED as an editor-vs-read-surface render-order divergence. The editor **regroups by section at render time** (`slotSectionGroups`/`slotsBySection`, `ServiceEditorView.vue:1726-1748`), so it always looks section-major regardless of the underlying array order. The two read surfaces render the **raw persisted array order** with no regrouping: `ServiceCard.vue:125-135` (listing) and `ShareView.vue:30` (share snapshot). New services persist slots in **template/insertion order** (`buildSlotsFromTemplate` + `createService` never call `orderSlotsBySection`), and the load/remote-merge watcher does not normalize either. Any editor write triggers `onSave`, which runs `orderSlotsBySection` and re-persists section-major — which is exactly why "typing text fixes it."

**Primary recommendation:** Write one RED reproduction test per defect FIRST (the CONTEXT/CLAUDE.md mandate), then fix each at its source: (R110) revert SortableJS's DOM mutation in `onEnd` before the reactive update — or bump a container `:key` nonce — in both editors; (R111) apply `stripUndefined` in the `updateService` store funnel so every live-plan write path is safe; (R112) route both read surfaces (`ServiceCard` and `buildServiceSnapshot`) through `orderSlotsBySection` so they render section-major like the editor. Keep the v1.4 per-section Sortable architecture and the Phase 41 share-refresh path intact.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Fix at the source of the desync, never mask with a reload.** Success criterion 4: all three symptoms must stay fixed without a page refresh.
- **Write a failing reproduction test FIRST (RED → GREEN)** for each of the three defects before touching production code. Reuse the v1.4 DOM-derived synthetic-`onEnd` harness pattern (`ServiceEditorView.test.ts`).
- **R110 fix:** in `onEnd`, revert SortableJS's DOM mutation BEFORE applying the reactive update (move `evt.item` back to its origin list/position, or equivalent), so Vue remains the sole DOM owner. Keep the v1.4 per-section Sortable architecture — do NOT swap libraries or rebuild the grouping model.
- **R111 fix:** never send raw `undefined` (strip, or `deleteField`) on the live service save.
- **R112 fix:** make both read surfaces (Services listing + public share snapshot) render in the SAME section-major order the editor uses — reuse `orderSlotsBySection`/`groupBySection`+`flattenBySection` from `slotTypes.ts`, not any content/body-dependent sort.
- **All three surfaces in scope:** `ServiceEditorView.vue` (live plan), `ServiceTemplateEditor.vue` (default template), plus an audit of `SlideGrid.vue`'s copy-pasted reorder for the same DOM-ownership class.
- **Preserve the v1.5 Phase 41 share-snapshot refresh** (`maybeRefreshShareLink`/`ensureShareLink`) — R112 is a read-ORDER fix, not a snapshot-write change.
- **No new features, no behavior changes beyond correctness.** Five fixed sections, palette, dropdown, autosave stay exactly as they are.

### Claude's Discretion
- Exact fix mechanics (DOM-revert vs. nonce-keyed container re-render), helper extraction vs. in-place, and test structure — subject to: repro-test-first, fix-at-source, and all four success criteria observable without a refresh.
- Extract a shared cross-list-drag helper **only if it reduces risk**; otherwise apply the identical in-place fix to each editor and cover both with tests.

### Deferred Ideas (OUT OF SCOPE)
- None. (Item-editing enhancements like the notes field and Miscellaneous default-no-slides are Phase 54; the template relocation is Phase 52.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R110 | Dragging a service item into a section places exactly ONE item there, no phantom "No Section" duplicate — in BOTH the default-template editor and the live service plan. | Root cause = SortableJS DOM-ownership conflict on cross-`<ul>` drag; `onSlotSortEnd`/`onTemplateSortEnd` reactive logic already correct but never reverts Sortable's DOM move. Fix pattern (DOM-revert or nonce `:key`) + in-codebase nonce precedent (`SlideGrid.vue:262,1141`) documented below. RED-test caveat: the existing mocked Sortable elides the real DOM move — the repro must inject it. |
| R111 | Moving a sectioned item back to "No Section" via the dropdown saves successfully, no error. | Root cause = `services.ts::updateService` (line 302) writes `...data` without `stripUndefined`; `onSectionChange` sets `slot.section = undefined`, which reaches `updateDoc` raw. Fix = strip in the funnel. Template editor already strips (line 442) — the fix mirrors it. |
| R112 | Services listing + public share link show items in the same order as the edit screen, INCLUDING empty-bodied items. | Root cause = editor regroups at render (`slotSectionGroups`); listing (`ServiceCard`) and share (`ShareView`/`buildServiceSnapshot`) render raw persisted order; new services persist in template order (`buildSlotsFromTemplate`/`createService` skip `orderSlotsBySection`). Fix = route both read surfaces through `orderSlotsBySection`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-section drag reorder (R110) | Client (Vue component ↔ SortableJS DOM) | — | Pure client DOM-ownership bug; no persistence-layer involvement. The reactive state and the Firestore write are already correct. |
| Section-change persistence (R111) | API/data (Pinia `services` store → Firestore `updateDoc`) | Client (dropdown handler sets `undefined`) | The `undefined`-rejection is a Firestore write-contract concern; the durable fix belongs in the store funnel that every write path shares. |
| Read-surface item ordering (R112) | Client render (listing card + share view) | Data (snapshot build in store) | Ordering is a presentation contract; the editor already owns it via render-time regrouping — the two read surfaces must adopt the same transform. |

## Project Constraints (from CLAUDE.md)

These are load-bearing for the planner's verification gates — get the commands exactly right:

- **Type gate:** `npm run type-check` (= `vue-tsc --build`, which typechecks the **test files** too). Do NOT use `vue-tsc --noEmit -p tsconfig.app.json` as the gate — it silently skips tests and has hidden real errors before. `-p tsconfig.app.json` is fine only as a fast inner-loop check.
- **App test suite:** `npx vitest run --dir src --exclude '**/rules.test.ts'` **or** bare `npx vitest run`. Do NOT use `npx vitest run src/` (picks up `render-service/src/render.test.ts` → Vitest version-mismatch crash) and do NOT use `npx vitest run --dir src` alone (bypasses the `vite.config.ts` exclude → runs `src/rules.test.ts`, which fails without an emulator).
- **Known-failing baseline (2 files, NOT regressions):** `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation — environment, not code) and `src/views/__tests__/RosterView.test.ts` (stale assertion). A green run for this phase means: these two still fail for their known reasons and nothing else is red.
- **Rules suite** (`npm run test:rules`) is not needed for this phase — no `firestore.rules`/`storage.rules` changes are in scope.
- `.env.local` must be present (symlink/copy from `C:\projects\worshipplanner\.env.local`) or component tests that import Firebase config fail to load.

## Standard Stack

No new dependencies. This phase edits existing code only. Relevant existing modules:

| Module | Purpose | Role in this phase |
|--------|---------|--------------------|
| `sortablejs` (already installed) | Per-section drag instances | R110 — the DOM-ownership conflict lives at this integration seam; do NOT swap it |
| `src/utils/slotTypes.ts` | `groupBySection`, `flattenBySection`, `orderSlotsBySection`, `reindexSlots` — the single ordering contract | R110 (already used), R112 (route read surfaces through it) |
| `src/utils/stripUndefined.ts` | Recursively drops `undefined` for Firestore safety; preserves `null`/`FieldValue` sentinels | R111 — apply in the `updateService` funnel |

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** All work uses modules already present in the repo (`sortablejs`, `slotTypes.ts`, `stripUndefined.ts`). No registry verification required.

## Root-Cause Analysis (the core deliverable)

### R110 — Phantom "No Section" duplicate on cross-section drag  **[VERIFIED: code read]**

**Confirmed mechanism (CONTEXT hypothesis CONFIRMED, not refuted):**

The reactive state logic is already correct in both editors:
- `ServiceEditorView.vue:1881-1922` (`onSlotSortEnd`): reads `evt.oldDraggableIndex`/`evt.newDraggableIndex` and `evt.from/to.dataset.section` (line 1895-1900), works in the grouped model, sets `moved.section = toKey` (line 1911), rebuilds via `reindexSlots(flattenBySection(grouped))` (line 1921), assigns `localService.value.slots` (line 1922). This is the proven-correct v1.4 machinery.
- `ServiceTemplateEditor.vue:338-361` (`onTemplateSortEnd`): identical shape — `moved.section = toKey` (line 353) / `undefined` (line 355), `draft.value = flattenBySection(grouped)` (line 360).

Neither handler reverts SortableJS's physical DOM mutation. The render structure guarantees the conflict:
- Each section is its **own `<ul>` container** created by a **separate `Sortable.create`** instance (`ServiceEditorView.vue:1971-2003`; `ServiceTemplateEditor.vue:363-399`), sharing one cross-section drag group (`group: 'service-slots'` / `'template-items'`, `ServiceEditorView.vue:1989`, `ServiceTemplateEditor.vue:385`).
- Rows are keyed on stable id: `<div class="slot-item" ... :key="slot.id">` (`ServiceEditorView.vue:866-871`); `:key="entry.id"` (`ServiceTemplateEditor.vue:85-86`).

On a **cross-section** drag, SortableJS physically detaches the dragged `<li>`/`.slot-item` from the source `<ul>` and re-appends it into the target `<ul>` **before** `onEnd` fires. The subsequent reactive re-render is computed **per container** (`slotSectionGroups`), and Vue's keyed patch bookkeeping for each `<ul>` caches vnode `.el` references that no longer match actual parentage after Sortable's move — leaving a second, event-handler-less clone in the **source** ("No Section") list. It cannot be deleted (no Vue listeners bound) and vanishes on refresh (full re-render from state). **Same-section** reorder never changes the parent `<ul>`, so Vue reconciles cleanly — which is exactly why intra-section drags work and only cross-section drags spawn the phantom. This matches the owner's verbatim repro (add Song at No Section → drag to Worship → 2 songs, the real one shows "Worship", the phantom shows "No Section").

**Evidence the current handlers do NOT revert:** No reference to `evt.item`, no `insertBefore`/`appendChild`/`.remove()` DOM call, and no container `:key` nonce bump anywhere in `onSlotSortEnd` or `onTemplateSortEnd` (verified by grep across both files).

**Fix pattern (two valid options; Claude's discretion per CONTEXT):**
1. **DOM-revert (CONTEXT's stated preference):** at the top of `onEnd`, before mutating the reactive array, move `evt.item` back to its origin: re-insert it into `evt.from` at `evt.oldDraggableIndex` (accounting for non-`.slot-item` siblings — the empty-section placeholder is `v-if`'d out once a section has items, so a populated source container's only children are `.slot-item`, but a robust revert should insert relative to the original sibling, not a raw index). Then apply the existing reactive update and let Vue own the DOM.
2. **Nonce-keyed container re-render (proven in THIS codebase):** `SlideGrid.vue:262` renders its card list with `:key="gridRenderNonce"` and bumps `gridRenderNonce.value += 1` (line 1141) to force Vue to discard and rebuild the Sortable-mutated container from state. Applying the same to the affected section container(s) after a cross-section drag reclaims the orphaned node. This is lower-risk to implement (no manual index math) and already blessed here.

**Shareability:** Both editors have byte-for-byte the same handler shape and vulnerability, so a single tested helper (e.g. `revertSortableDomMove(evt)` or a small composable) is attractive — but CONTEXT gates extraction on "only if it does not force a risky refactor of two working handlers." Recommendation: if going the DOM-revert route, extract the ~5-line revert into a pure `src/utils/` helper (trivially unit-testable in isolation) and call it from both `onEnd`s; if going the nonce route, apply in place (the nonce ref is component-local state, poorly suited to extraction).

**SlideGrid audit result: NOT affected by the R110 class.** `SlideGrid.vue:1076-1084` creates a **single** Sortable instance with **no `group` option** → items can only reorder within one container; there is no cross-`<ul>` move, so no DOM-ownership phantom. Its `gridRenderNonce` is used only on the error-revert path (line 1141), not needed on success because same-container keyed diff is robust. No fix needed in SlideGrid; it is the *source* of the nonce technique, not a victim of the bug.

### R111 — Save error moving an item back to "No Section"  **[VERIFIED: code read]**

**Confirmed path (client → store → Firestore):**
1. Dropdown change → `onSectionChange(index, '')` (`ServiceEditorView.vue:1774-1781`) sets `slot.section = value === '' ? undefined : ...` → `slot.section = undefined` as an **explicit own property** (line 1779), then `reindexSlots(orderSlotsBySection(...))` (line 1780). `reindexSlots` spreads `{ ...slot, position }` (`slotTypes.ts:134`) — it **preserves** the `section: undefined` key.
2. `isDirty` flips → debounced `onSave` (`ServiceEditorView.vue:3678`) builds `payload.slots = reindexSlots(orderSlotsBySection(data.slots))` (line 3702-3710) — the `section: undefined` key rides through into `payload`.
3. `serviceStore.updateService(id, payload)` (line 3718) → `updateDoc(doc(...), { ...data, updatedAt: serverTimestamp() })` (`services.ts:302-305`) — **no `stripUndefined`**. Firestore rejects any `undefined` field value at any depth → throw: *"Unsupported field value: undefined (found in document ...)"*.

**Why the drag path does NOT trigger R111:** the ungrouped/"No Section" container is configured `put: false` (`ServiceEditorView.vue:1989`), so nothing can be dragged INTO No Section; `onSlotSortEnd` only ever sets `moved.section = toKey` for a real section (line 1911) — never `undefined`. R111 is exclusively the **dropdown → autosave** path, consistent with the requirement wording.

**Why the template editor is immune:** `ServiceTemplateEditor.vue:442` does `const payload = stripUndefined(draft.value)` before its save, even though `onTemplateSortEnd` sets `moved.section = undefined` (line 355). The live plan simply lacks the equivalent strip.

**Fix (recommended — single funnel, defense in depth):** apply `stripUndefined` inside `services.ts::updateService`:
```ts
// services.ts:302 — was: { ...data, updatedAt: serverTimestamp() }
await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
  ...stripUndefined(data),
  updatedAt: serverTimestamp(),   // FieldValue sentinel added AFTER stripping (stripUndefined preserves it, but keep the ordering the helper's docstring mandates)
})
```
This covers **every** live-plan write path at once — the autosave `onSave`, the direct drag-reorder write (`ServiceEditorView.vue:1935`), `assignSongToSlot`/`clearSongFromSlot` — not just the dropdown. `stripUndefined` recurses the `slots` array and drops the `section` key from the affected slot object; because `updateDoc({ slots: [...] })` **replaces the entire array field**, an omitted key reads back as `section === undefined` = "No Section" (identical to how `createSlot` omits the key for a section-less slot, `slotTypes.ts:81`). Note: `deleteField()` is NOT usable here — it operates on document field paths, not on elements inside an array; omission is the correct and sufficient mechanism.

**Guardrails:** `stripUndefined` preserves `null`, `''`, `0`, `false`, and `FieldValue` sentinels (`stripUndefined.ts:8-10,17-20`) — so `sermonPassage: null`, empty strings, and `serverTimestamp()` are untouched. The role-override paths (`setRoleOverride`/`clearRoleOverride`, `services.ts:436,459`) use `updateDoc` directly with `deleteField()` and do NOT flow through `updateService`, so they are unaffected.

### R112 — Empty-bodied items sink to the bottom on listing + share until text typed  **[VERIFIED: code read]**

**Confirmed divergence:** the editor and the two read surfaces use **different** ordering strategies.
- **Editor (correct-looking):** renders via `slotSectionGroups` (`ServiceEditorView.vue:1737-1748`) built from `slotsBySection` = `groupBySection(slots.map(...), slot => slot.section)` (line 1726-1732). This **regroups by section at render time**, so the editor is section-major **regardless of the underlying `slots` array order.**
- **Listing (`ServiceCard.vue:125-135`):** `openingSlots`/`sendingSlots` are `service.slots.slice(0, messageIndex)` / `.slice(messageIndex+1)` — **raw persisted array order**, no regrouping.
- **Share (`ShareView.vue:30`):** `v-for="(slot, index) in serviceSnapshot.slots"` — renders the persisted snapshot's slots array in raw order. The snapshot is built by `buildServiceSnapshot` (`services.ts:103-145`), which maps `service.slots` directly (line 106-118,139) preserving raw order.

**Where the raw array becomes non-section-major:**
- `buildSlotsFromTemplate` (`slotTypes.ts:362-380`) builds a new service's slots in **template-entry order** and calls only `reindexSlots` — **never `orderSlotsBySection`.**
- `createService` (`services.ts:232-244`) persists those slots as-is. So a freshly-created service's stored `slots` array reflects template/insertion order, which need not be section-major.
- The load/remote-merge watcher (`ServiceEditorView.vue:2240-2241, 2265-2269`) loads `backfillSlotIds(found)` verbatim — it does **not** normalize order either.

**Why "typing text fixes it":** an empty item is simply one the user has not yet edited. The moment ANY editor mutation occurs (typing into the MISC/MESSAGE/ANNOUNCEMENTS `body` textarea, dragging, a section change), the debounced `onSave` runs `reindexSlots(orderSlotsBySection(data.slots))` (`ServiceEditorView.vue:3702`) and **re-persists the array section-major**; `maybeRefreshShareLink` then rewrites the share snapshot from that normalized array (`services.ts:660-694`). The listing (live `onSnapshot`) and the share both snap into correct order. The body text is not causal to the sort — it is merely where the user's first normalizing edit lands. This exactly matches the owner's tell ("putting text into a Miscellaneous item's input box made it suddenly show up in the proper order").

**Fix (route both read surfaces through the shared contract — CONTEXT's stated approach):**
1. **Listing:** in `ServiceCard.vue`, compute an ordered array once and slice from it:
   ```ts
   const orderedSlots = computed(() => orderSlotsBySection(props.service.slots))
   const messageIndex = computed(() => orderedSlots.value.findIndex(s => s.kind === 'MESSAGE'))
   const openingSlots = computed(() => orderedSlots.value.slice(0, messageIndex.value))
   const sendingSlots = computed(() => orderedSlots.value.slice(messageIndex.value + 1))
   ```
2. **Share:** in `buildServiceSnapshot` (`services.ts:103`), order before mapping BPM:
   ```ts
   const orderedSlots = orderSlotsBySection(service.slots)
   const slotsWithBpm = orderedSlots.map(slot => { ... })   // was service.slots.map(...)
   ```
   This is a read-order transform inside the snapshot *build*; it does NOT change *when/whether* the snapshot is written, so the Phase 41 `maybeRefreshShareLink`/`ensureShareLink` refresh cadence is untouched (CONTEXT constraint honored).

`orderSlotsBySection` is identity-preserving (`slotTypes.ts:214-220`) — it returns the original array reference when already ordered, so this adds no churn for already-normalized services. Routing the read surfaces through it makes them section-major **deterministically**, independent of whether a normalizing save has fired yet — which is stronger than only normalizing on create (though the planner may ALSO choose to normalize in `createService`/`buildSlotsFromTemplate` as belt-and-braces; the read-surface fix is the one that satisfies R112 without a data migration for existing services).

## Testing Strategy (RED reproduction, per CLAUDE.md + CONTEXT mandate)

### Existing harness (reuse it)
`ServiceEditorView.test.ts:66-107` mocks `sortablejs` with a **capturing** mock: `Sortable.create(el, options)` pushes `{ el, options }` to `sortableCaptures` and returns `{ destroy }`. Tests resolve a section's capture via `captureForSection(section)` and invoke `capture.options.onEnd({ oldDraggableIndex, newDraggableIndex, item, from, to })` directly (see the synthetic events at lines 2911-2916, 4151-4159, and the DOM-derived cross-section helper at 4100-4159). `ServiceTemplateEditor.test.ts` and `SlideGrid.test.ts` share this pattern.

### CRITICAL caveat for the R110 RED test
The mocked `Sortable.create` **does not perform any real DOM mutation** — it only captures options. So a test that merely calls `onEnd` with a synthetic event exercises the (already-correct) *reactive* logic and will **pass green even against today's buggy code** — it cannot reproduce the phantom, because the phantom is caused by SortableJS's **real** cross-`<ul>` DOM move that the mock elides. To write a genuinely RED test the plan must **simulate the physical move**: before invoking `onEnd`, manually detach the dragged `.slot-item` node from the source `section-list-{from}` container and append it into the `section-list-{to}` container (mirroring what real Sortable does), THEN invoke `onEnd`, THEN await a re-render and assert:
- source container (`[data-testid="section-list-ungrouped"]` / the "No Section" list) has **zero** leftover `.slot-item` for the moved id, and
- the target section has **exactly one** `.slot-item` for that id (no duplicate anywhere in the tree).

This drives the DOM-revert (or nonce) fix. Document this harness gap prominently — it is the single subtlest part of the phase and the most likely place a "passing" test gives false confidence.

### R111 RED test
Unit-test the store or the save path: set a slot's `section` to `undefined` and assert the value handed to `updateDoc` contains **no** `undefined` (or assert the mocked `updateDoc` is not called with a payload that would throw). The `services.test.ts` suite already mocks `firebase/firestore`; assert `stripUndefined` is applied by inspecting the `updateDoc` mock's call args for an absent `section` key on the affected slot. Alternatively, drive `onSectionChange(index, '')` in the component test and assert autosave completes without an error state.

### R112 RED test
- **Listing:** mount `ServiceCard` with a service whose `slots` array is **deliberately not section-major** (e.g. an empty MISC in the `worship` section placed last in the raw array). Assert the rendered `openingSlots`/`sendingSlots` order matches `orderSlotsBySection` (empty item appears in its section band, not at the bottom). RED against current code (renders raw order).
- **Share:** unit-test `buildServiceSnapshot` with the same non-section-major fixture; assert the returned `slots` are section-major. RED today.

### Commands (verbatim from CLAUDE.md — the planner inherits these as gates)
- Type gate: `npm run type-check`
- App suite: `npx vitest run --dir src --exclude '**/rules.test.ts'` (or bare `npx vitest run`)
- Scoped inner loop (examples): `npx vitest run src/views/__tests__/ServiceEditorView.test.ts`, `npx vitest run src/stores/__tests__/services.test.ts`, `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts`
- Known-failing baseline (must remain the ONLY red, and only for their known reasons): `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section-major ordering for read surfaces | A new comparator / body-aware sort | `orderSlotsBySection` (`slotTypes.ts:214`) | It's the single source of truth the editor already uses; a second rule guarantees future drift |
| Firestore-safe payloads | Manual `delete obj.section` / ad-hoc guards | `stripUndefined` (`stripUndefined.ts`) | Recurses arrays + nested objects, preserves `null`/`FieldValue`; already the template editor's proven pattern |
| Reclaiming Sortable-mutated DOM | A bespoke MutationObserver or `$forceUpdate` | DOM-revert of `evt.item`, or the `SlideGrid` `gridRenderNonce` `:key` bump | Both are minimal, testable, and the nonce is already blessed in this repo |

**Key insight:** every piece needed already exists in the codebase. This phase is about *routing existing helpers to the right seams*, not writing new machinery.

## Common Pitfalls

### Pitfall 1: A green R110 test that proves nothing
**What goes wrong:** calling the captured `onEnd` with a synthetic event passes on buggy code because the mocked Sortable never moved a node.
**How to avoid:** the RED test MUST physically relocate the `.slot-item` node between containers before calling `onEnd` (see Testing Strategy). Assert on rendered DOM (`findAll('.slot-item')` counts per container), not on the reactive `slots` array (which is already correct).

### Pitfall 2: Reintroducing R111 via a partial fix
**What goes wrong:** stripping `undefined` only in `onSectionChange` or only in `onSave` leaves the direct drag write (`ServiceEditorView.vue:1935`) and future callers exposed.
**How to avoid:** strip in the `updateService` funnel so all live-plan writes are covered by one change.

### Pitfall 3: Breaking autosave stability with new array references
**What goes wrong:** wrapping read paths in `orderSlotsBySection` is safe (identity-preserving), but naively re-normalizing `localService.slots` on the LOAD/merge watcher could manufacture a false `isDirty` or a never-converging remote-merge comparison (the exact hazard `orderSlotsBySection`/`backfillSlotIds` were designed around — see `slotTypes.ts:206-220,242-252`).
**How to avoid:** apply the R112 fix in the **read surfaces** (`ServiceCard`, `buildServiceSnapshot`) only. Do NOT add ordering into the editor's load/merge watcher.

### Pitfall 4: Disturbing the Phase 41 share refresh
**What goes wrong:** moving ordering logic into `maybeRefreshShareLink` or `writeSharePayload` control-flow could alter refresh cadence/soft-fail behavior.
**How to avoid:** put the R112 share fix inside `buildServiceSnapshot`'s data mapping only — a pure transform of what's serialized, not of when it's written.

### Pitfall 5: Using `deleteField()` for R111
**What goes wrong:** `deleteField()` cannot target an element inside an array; it throws or no-ops.
**How to avoid:** omit the key (via `stripUndefined`); the whole `slots` array is replaced on each write, so omission = "No Section".

## Runtime State Inventory

Not a rename/migration phase, but relevant persisted/runtime state:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Firestore `organizations/{orgId}/services/{id}.slots` — existing services may hold non-section-major arrays (persisted before any normalizing save). Firestore share docs (`shareTokens/{token}`, `serviceShares/...`) hold `serviceSnapshot.slots` in whatever order the last refresh wrote. | **No data migration required.** The R112 read-surface fix (`orderSlotsBySection` at render/snapshot-build) makes existing unnormalized documents display correctly without touching stored data. Share docs self-heal on the next `maybeRefreshShareLink` (any edit). |
| Live service config | None. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None changed. `.env.local` still required to run tests/build (CLAUDE.md). | None. |
| Build artifacts | None. | None. |

## Code Examples (from this codebase — the seams to touch)

### Correct reactive reorder (already present — do NOT change the state logic)
```ts
// ServiceEditorView.vue:1906-1922 — the model-level move is correct; only the DOM is unmanaged
const grouped = groupBySection(localService.value.slots, (s) => s.section)
const moved = bucketForKey(grouped, fromKey).splice(oldDraggableIndex, 1)[0]
if (toKey !== 'ungrouped') moved.section = toKey
bucketForKey(grouped, toKey).splice(newDraggableIndex, 0, moved)
localService.value.slots = reindexSlots(flattenBySection(grouped))
```

### In-codebase nonce-rebuild precedent (R110 option 2)
```ts
// SlideGrid.vue:262  container render
:key="gridRenderNonce"
// SlideGrid.vue:1141  force a rebuild-from-state
gridRenderNonce.value += 1
```

### The R111 one-line funnel fix
```ts
// services.ts:302
await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
  ...stripUndefined(data),
  updatedAt: serverTimestamp(),
})
```

## State of the Art

| Old (current) Approach | Corrected Approach | Impact |
|------------------------|--------------------|--------|
| Editor regroups at render; read surfaces render raw array order | Both read surfaces route through `orderSlotsBySection` | R112 fixed; all three surfaces agree without a save/refresh |
| `updateService` writes `...data` raw | `...stripUndefined(data)` | R111 fixed; every live-plan write path is `undefined`-safe |
| `onEnd` updates reactive state but ignores Sortable's DOM move | Revert the DOM move (or nonce-rebuild the container) before/around the reactive update | R110 fixed; no phantom on cross-section drags in either editor |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The DOM-revert vs. nonce-`:key` choice for R110 is equivalent in correctness; nonce is lower-risk to implement here. | R110 fix pattern | Low — both are proven; the RED test (asserting no duplicate `.slot-item`) gates whichever is chosen. If DOM-revert index math is subtly wrong, the test catches it. |
| A2 | Stripping `undefined` in `updateService` has no unwanted side effects on other callers (song assignment, drag write, roles). | R111 fix | Low — verified: role paths bypass `updateService`; `stripUndefined` preserves `null`/`FieldValue`. Planner should still run the full `services.test.ts` suite. |
| A3 | Existing Firestore services with non-section-major arrays need no migration because read surfaces normalize at render. | R112 / Runtime State | Low — the fix is a pure display transform; stored order is irrelevant to what's shown. |

*(All three are LOW-risk and directly test-verifiable; no user confirmation required before planning.)*

## Open Questions

1. **Helper extraction for R110 (DOM-revert route only).**
   - What we know: both editors share the identical handler and bug; a pure `revertSortableDomMove(evt)` is trivially unit-testable.
   - What's unclear: whether the two `onEnd`s have diverged enough (template uses `ServiceTemplateEntry`, live uses `ServiceSlot`) that a shared helper adds indirection without real reuse.
   - Recommendation: extract only the DOM-revert step (which operates on `evt` DOM nodes, type-agnostic), not the whole handler. If choosing the nonce route, keep it in-place (component-local ref).

2. **Belt-and-braces normalization at create time (R112).**
   - What we know: routing read surfaces through `orderSlotsBySection` fully satisfies R112.
   - What's unclear: whether the planner also wants `createService`/`buildSlotsFromTemplate` to persist section-major so raw Firestore data is self-consistent going forward.
   - Recommendation: optional and low-risk (`orderSlotsBySection` is identity-preserving); treat as a nice-to-have, not required for R112 acceptance. Do NOT normalize in the load/merge watcher (Pitfall 3).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/npm + vitest | Running the app suite | ✓ (repo standard) | per repo | — |
| `.env.local` | Component tests that import Firebase config | Must be symlinked/copied per CLAUDE.md | — | Cannot run affected tests without it |
| Firebase emulator | NOT needed this phase (no rules changes) | n/a | — | — |

**Missing dependencies with no fallback:** none (assuming `.env.local` present per CLAUDE.md setup).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (Vue Test Utils + jsdom) |
| Config file | `vite.config.ts` (app suite exclude of `src/rules.test.ts`) / `vitest.rules.config.ts` (rules; not used here) |
| Quick run command | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` |
| Full suite command | `npx vitest run --dir src --exclude '**/rules.test.ts'` (or bare `npx vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R110 | Cross-section drag leaves no phantom in source list — live plan | unit (simulate DOM move + `onEnd`) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ (extend) |
| R110 | Cross-section drag leaves no phantom — default template | unit | `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` | ✅ (extend) |
| R111 | Section→"No Section" save carries no `undefined` | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ (extend) |
| R112 | Listing renders section-major incl. empty items | unit | `npx vitest run` (add `ServiceCard` test) | ❌ Wave 0 — no `ServiceCard.test.ts` yet |
| R112 | Share snapshot slots are section-major | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ (extend — `buildServiceSnapshot`) |

### Sampling Rate
- **Per task commit:** the scoped file command for the file touched.
- **Per wave merge:** full app suite `npx vitest run` + `npm run type-check`.
- **Phase gate:** full suite green (only the 2 known-baseline files red) + `npm run type-check` clean before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/components/__tests__/ServiceCard.test.ts` — new file; covers R112 listing order. (No existing test for `ServiceCard`.)
- [ ] Extend `ServiceEditorView.test.ts` with a **DOM-mutating** cross-section drag repro (the mock does not move nodes — see Pitfall 1).
- [ ] Extend `ServiceTemplateEditor.test.ts` with the same cross-section phantom repro.
- [ ] Extend `services.test.ts` for `updateService` `stripUndefined` (R111) and `buildServiceSnapshot` ordering (R112).
- [ ] No new framework/config install needed.

## Security Domain

Not a security-enforcement phase per se, but two ambient controls must be preserved (not weakened):
- **Org isolation / draft-lock:** `updateService`'s `assertWritable` gate (`services.ts:291-297`) and `canWriteSlideGroups`/`canEditService` (`ServiceEditorView.vue:1803,1863`) must remain in force. The R111 `stripUndefined` change is inside the write body, after `assertWritable` — it does not alter the lock.
- **PII guard in share snapshot:** `buildServiceSnapshot` deliberately resolves person IDs to names only (`services.ts:120-132`). The R112 change touches only slot *ordering*, not `roleAssignments` — do not alter the name-only resolution.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation / data integrity | yes | `stripUndefined` for Firestore write contract; no user-supplied strings newly trusted |
| V4 Access Control | yes (preserve) | Existing `assertWritable` draft-lock + `canEditService` gates — unchanged by this phase |

## Sources

### Primary (HIGH confidence — direct code read this session)
- `src/views/ServiceEditorView.vue` — `onSlotSortEnd` (1881-1969), Sortable setup (1971-2003), `onSectionChange` (1774-1781), `slotSectionGroups`/`slotsBySection` (1726-1748), `addSlot` (2632-2648), `onSave` (3678-3711), load/merge watcher (2217-2286), template markup (786-1178)
- `src/components/settings/ServiceTemplateEditor.vue` — `onTemplateSortEnd` (338-361), Sortable setup (363-399), save `stripUndefined` (442), markup/keys (55-117)
- `src/components/slides/SlideGrid.vue` — single-instance Sortable `onEnd` (1076-1145), `gridRenderNonce` (262, 1141)
- `src/stores/services.ts` — `updateService` (299-310), `buildServiceSnapshot` (103-145), `createService` (224-244), `maybeRefreshShareLink` (660-721)
- `src/components/ServiceCard.vue` — listing render (2-42, 125-135)
- `src/views/ShareView.vue` — share render (30), snapshot load (165-188)
- `src/utils/slotTypes.ts` — `groupBySection`/`flattenBySection`/`orderSlotsBySection`/`reindexSlots`/`buildSlotsFromTemplate` (133-380)
- `src/utils/stripUndefined.ts` — full file
- `src/views/__tests__/ServiceEditorView.test.ts` — Sortable capture mock (66-107), synthetic `onEnd`/DOM-derived helpers (2911-2916, 4100-4159)
- `CLAUDE.md` — type-check + two-suite testing discipline, known-failing baseline
- `.planning/phases/51-service-order-editing-reliability/51-CONTEXT.md`, `.planning/REQUIREMENTS.md`

### Secondary / Tertiary
- None — no external documentation lookup was required; every claim is grounded in repo code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all fixes use existing modules.
- R110 root cause: HIGH — reactive logic confirmed correct, DOM-revert absent, keyed per-section `<ul>` structure confirmed; matches owner repro exactly.
- R111 root cause: HIGH — full client→store→Firestore path traced; missing `stripUndefined` in funnel confirmed; template-editor immunity explains the asymmetry.
- R112 root cause: HIGH — editor regroup-at-render vs. read-surface raw-order confirmed; template-order persistence (`buildSlotsFromTemplate`/`createService`) confirmed; "typing fixes it" mechanism explained by `onSave` normalization.
- Pitfalls / test approach: HIGH — the mocked-Sortable-elides-DOM-move gap is verified against the harness source.

**Research date:** 2026-08-11
**Valid until:** stable (~30 days) — bug-fix phase against code read directly; only invalidated if the reorder handlers or `slotTypes.ts` change before planning.
