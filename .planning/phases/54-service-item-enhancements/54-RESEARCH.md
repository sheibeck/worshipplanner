# Phase 54: Service Item Enhancements - Research

**Researched:** 2026-08-11
**Domain:** Vue 3 SFC editing surface (ServiceEditorView) + pure slide-group materializer (TypeScript)
**Confidence:** HIGH (every claim traced to file:line in live `src/`; no external sources needed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **R122 field model:** Add `notes?: string` to the shared base `MediaAttachableSlot` (`service.ts:39`) — one additive optional field covers all 5 slot kinds. Firestore schemaless, no migration.
- **R122 UI:** Plain-text input (single-line `<input>` or small `<textarea>`) beside each item's selector in `ServiceEditorView.vue`. Rich-text/formatting explicitly OUT of scope.
- **R122 consistency:** Selector and notes share ONE layout wrapper so every kind looks the same (selector on one side, notes on the other).
- **R122 autosave:** Wire notes through the editor's existing autosave path (same path `body`/`section` use); benefit from Phase 51's `stripUndefined` so an empty value never writes raw `undefined`.
- **R122 responsive:** Side-by-side on desktop, stacked on small screens, reusing the QuarterView / Phase 48 `flex`/`sm:` recipe. Do NOT invent a new responsive pattern.
- **R123:** Give MISC its OWN branch in `deriveGroupEntries` returning `[]` (no derived entries), leaving ANNOUNCEMENTS/PRAYER/MESSAGE/HYMN on the existing one-text-slide behavior. The derived-vs-user-added split must keep hand-added slides on a MISC item.

### Claude's Discretion
- Notes input element (single-line input vs. small textarea), exact wrapper markup, and whether R123 is one derivation-site branch or a fuller MISC split — subject to: additive/optional model (no migration), the QuarterView responsive recipe (no new pattern), hand-added MISC slides preserved, and `npm run type-check` (vue-tsc --build) clean with every `switch (slot.kind)` staying exhaustive.

### Deferred Ideas (OUT OF SCOPE)
- Rich-text / formatting in the notes field — R122 is a plain-text input.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R122 | Every service item exposes a notes field beside its selector; side-by-side desktop / stacked mobile; consistent across item types | Single render seam identified at `ServiceEditorView.vue:891` (the `flex-1 min-w-0` content div that hosts every kind's selector chain); `notes?` on `MediaAttachableSlot` reaches all 5 kinds cast-free; responsive recipe reused from `QuarterView.vue:6`; autosave + `stripUndefined` path verified end-to-end |
| R123 | Miscellaneous items default to no slides; slides can still be added when the user chooses | One-line split of MISC in `deriveGroupEntries` (`slideGroupMaterializer.ts:157-162`) returning `[]`; dispatch trace proves new MISC items create no group; hand-add path (`SlideGrid.onAddSlide` → `ensureGroupMaterialized`) proven to work on an empty MISC group and to survive every rebuild |
</phase_requirements>

## Summary

This is a brownfield UI + pure-function phase on mature, well-commented code. **No new packages, no external dependencies, no security surface, no data migration.** Both requirements are small, surgical changes with a definitive backward-compat story.

**R122** resolves to a single shared render seam: the `<div class="flex-1 min-w-0">` at `ServiceEditorView.vue:891` already wraps the per-kind selector `v-if/v-else-if` chain for all six kinds (SONG/SCRIPTURE/PRAYER/MESSAGE·ANNOUNCEMENTS·MISC/HYMN/IMPORTED). Wrapping that div's contents in a two-column responsive flex — selector on the left, a shared `notes` input written ONCE on the right — gives every kind an identical notes affordance with zero per-kind duplication. Because `notes?` lives on the base `MediaAttachableSlot`, `slot.notes` is reachable with **no type cast** (unlike `body`/`linkUrl`, which require `as NonAssignableSlot`). Mutating `slot.notes` on `localService` arms the existing `useAutoSave`, whose write runs the whole service (slots included) through `stripUndefined`, which recurses into the `slots[]` array and drops a `notes: undefined` — so an emptied notes never writes raw `undefined`.

**R123** resolves to ONE change: split `case 'MISC':` out of the fall-through group in `deriveGroupEntries` to `return []`. The dispatch trace proves this is sufficient and safe: a new MISC item derives zero slides, so `materializationCandidates` never creates a group document (it skips zero-slide derivations); an existing MISC item's stored group is left completely untouched because `rebuildGroup`'s MISC branch is a no-op and the materialize watcher skips slots that already have a group. Hand-added slides carry `sourceRef.title:'New slide'`/`body:''` (both defined), which the `isSlotDerivableRef` predicate treats as user work — so they survive even under a hypothetical active-removal path.

**Primary recommendation:** Do the minimal R123 change (one branch in `deriveGroupEntries`) and the minimal R122 change (one shared two-column flex wrapper + one shared notes input inside `ServiceEditorView.vue:891`). Correct the CONTEXT assumption that existing MISC items lose their blank slide — they do not, and that is the safe outcome.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-item notes input + responsive layout (R122) | Frontend (Vue SFC) | — | Pure presentation + reactive local edit; no backend logic |
| Notes persistence (R122) | Client store → Firestore | — | Rides the existing `useAutoSave`→`services.ts` document write; schemaless field, no server change |
| MISC default-no-slides derivation (R123) | Pure util (`slideGroupMaterializer.ts`) | Composable dispatch (`useSlideshowAssembly.ts`) | Materializer is a pure function; the composable's watchers decide when to create/rebuild groups |
| Hand-add slide to MISC (R123) | Component (`SlideGrid.vue`) → store | Composable (`ensureGroupMaterialized`) | Existing on-demand materialize + append path; unchanged by this phase |

## Standard Stack

No new libraries. This phase uses only what already ships:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue | 3.x SFC | The editing view | Existing app framework |
| Vitest | ^4.0.18 `[VERIFIED: package.json:59]` | Unit/component tests | Existing test runner |
| vue-tsc | ^3.2.5 `[VERIFIED: package.json:60]` | Type-check gate (`vue-tsc --build`) | Existing gate, checks test files too |

**Installation:** none — no `npm install` step in this phase.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. (Confirmed: R122 is a plain HTML input + Tailwind classes already in use; R123 edits an existing pure function.)

## R122 — Render Seam (definitive, with file:line evidence)

### The ONE shared wrapper spot
`ServiceEditorView.vue` renders each item as a flex row:

```
line 875-876:  <div class="slot-item ... flex items-start gap-2">
line 884:        <div v-if="canEditService" ...drag-handle>            ← col 1: drag handle
line 891:        <div class="flex-1 min-w-0">                          ← col 2: SELECTOR CHAIN  ★ THE SEAM
line 893:          <template v-if="slot.kind === 'SONG'">   …
line 995:          <template v-else-if="slot.kind === 'SCRIPTURE'"> …
line 1036:         <template v-else-if="slot.kind === 'PRAYER'"> …
line 1086:         <template v-else-if="MESSAGE | ANNOUNCEMENTS | MISC"> …
line 1107:         <template v-else-if="slot.kind === 'HYMN'"> …
line 1146:         <template v-else-if="slot.kind === 'IMPORTED'"> …
line 1153:       </div>                                                 ← end col 2
line 1160:       <select data-testid="section-select" ...>             ← col 3: section
line 1173:       <button remove>                                       ← col 4: remove
line 1184:     </div>
```

**The seam is the `<div class="flex-1 min-w-0">` at line 891.** It is the single element that already hosts every kind's selector. Put the notes input **inside** this div, beside the selector chain — NOT as a 4th sibling of the row (that would break the `[handle | content | section | remove]` column layout and put notes away from the selector, defeating the "beside the selector" intent).

### Recommended shape (Claude's discretion — single-seam, zero per-kind duplication)
Wrap the existing chain and one shared notes input in a two-column responsive flex inside line 891:

```vue
<!-- Slot content -->
<div class="flex-1 min-w-0">
  <div class="flex flex-col sm:flex-row sm:items-start gap-3">
    <!-- Selector column: the EXISTING v-if/v-else-if chain, unchanged -->
    <div class="flex-1 min-w-0">
      <template v-if="slot.kind === 'SONG'"> … </template>
      <!-- … all six existing kind branches, moved verbatim … -->
    </div>

    <!-- Notes column: written ONCE, shared by every kind (R122 consistency) -->
    <div v-if="canEditService" class="sm:w-64 flex-shrink-0">
      <input
        :value="slot.notes"
        @input="slot.notes = ($event.target as HTMLInputElement).value || undefined"
        type="text"
        placeholder="Notes (e.g. who leads, who sings which parts)"
        data-testid="slot-notes-input"
        class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
      />
    </div>
    <!-- Viewer/locked read-only variant, mirroring the body pattern at :1102 -->
    <p v-else-if="slot.notes" data-testid="slot-notes-text" class="sm:w-64 flex-shrink-0 text-xs text-gray-400 whitespace-pre-wrap">{{ slot.notes }}</p>
  </div>
</div>
```

Notes on this shape:
- `slot.notes` needs **no cast** — `notes?` is on `MediaAttachableSlot` (base of all 5 interfaces), unlike `body` which is cast `as NonAssignableSlot` at `:1094`. `[VERIFIED: service.ts:39-111]`
- Gate the editor input on `canEditService` and provide a viewer/locked read-only branch, matching the existing body treatment at `:1092-1103`. `[VERIFIED: ServiceEditorView.vue:1092-1103]`
- `sm:w-64 flex-shrink-0` for the notes column (fixed on desktop) OR `flex-1` for an equal split — Claude's discretion. Fixed width keeps the selector dominant, which matches the owner's "we have space to put a notes field next to it."

### `notes?` on `MediaAttachableSlot` is the right single field
All five slot interfaces extend `MediaAttachableSlot`: `SongSlot` (`:50`), `ScriptureSlot` (`:60`), `NonAssignableSlot` (`:73`, covers PRAYER/MESSAGE/ANNOUNCEMENTS/MISC), `HymnSlot` (`:90`), `ImportedSlot` (`:104`). Adding `notes?: string` at `:39` gives every item a notes field at once. `[VERIFIED: service.ts:39-111]`

> ⚠ **Naming coexistence to flag for the planner/tests:** `Service.notes` already exists as a **required top-level** `notes: string` at `service.ts:130` (a service-level field). The new `MediaAttachableSlot.notes` is a **slot-level optional** field on a different object. They do not collide (different objects), but tests and PR review must not conflate them. `[VERIFIED: service.ts:130]`

### Autosave + stripUndefined flow (verified end-to-end)
1. Mutating `slot.notes` mutates the reactive `localService` (same mechanism as `body` at `:1095`, `linkUrl` at `:1045`). `[VERIFIED: ServiceEditorView.vue:1094-1095]`
2. `useAutoSave(localService, …)` is the one persistence path (imported `:1387`, instantiated `:2176`, calls `onSave` `:2183`/`:3713`). `[VERIFIED: ServiceEditorView.vue:1387,2176-2183,3713]`
3. `onSave` writes through `services.ts`, which applies `...stripUndefined(data)` before the FieldValue sentinels. `[VERIFIED: stores/services.ts:325]`
4. `stripUndefined` maps arrays element-wise and recurses plain objects, dropping only `undefined` (preserving `''`, `null`, `0`, `false`). So a `slots[i].notes === undefined` is stripped at any depth. `[VERIFIED: utils/stripUndefined.ts:12-27]`

**Conclusion:** Setting `slot.notes = value || undefined` on empty keeps documents clean and never writes raw `undefined` (Phase 51's fix already covers this). Plain `slot.notes = value` (persisting `''`) is equally safe — matches the existing `body` convention at `:1095`. Recommend `|| undefined` to honor the additive/optional model.

## R122 — Responsive Recipe (reuse, do not invent)

The sanctioned Phase 48 recipe for two-block side-by-side/stacked is the QuarterView header pattern:

- **Canonical two-block recipe:** `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4` `[VERIFIED: QuarterView.vue:6]`
- **Button-cluster variant (also Phase 48, already copied into this view):** `flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto` `[VERIFIED: QuarterView.vue:13 and ServiceEditorView.vue:101]`

For selector | notes, adapt the canonical recipe (concrete class strings):

| Element | Classes | Effect |
|---------|---------|--------|
| Wrapper | `flex flex-col sm:flex-row sm:items-start gap-3` | Stacked below `sm`, side-by-side at/above |
| Selector column | `flex-1 min-w-0` | Takes remaining width; `min-w-0` prevents overflow |
| Notes column | `sm:w-64 flex-shrink-0` (or `flex-1`) | Fixed 16rem on desktop; full width when stacked |

`sm:` (640px) is the project-wide breakpoint used by every responsive surface here (48-03). Below it the flex-col stacks notes under the selector; at/above it `sm:flex-row` places them side-by-side. No new utility, no config change.

## R123 — Materializer Change (definitive, smallest)

### The one change
`slideGroupMaterializer.ts:157-162` currently groups MISC with the one-text-slide kinds:

```ts
// BEFORE (:157-162)
case 'PRAYER':
case 'MESSAGE':
case 'ANNOUNCEMENTS':
case 'MISC':
case 'HYMN':
  return [{ id: crypto.randomUUID(), order: 0, sourceRef: { kind: 'text' } }]
```

Split MISC into its own branch:

```ts
// AFTER
case 'MISC':
  return []
case 'PRAYER':
case 'MESSAGE':
case 'ANNOUNCEMENTS':
case 'HYMN':
  return [{ id: crypto.randomUUID(), order: 0, sourceRef: { kind: 'text' } }]
```

This is the **only** required edit. Switch stays exhaustive (MISC still covered in the other three switches' text group), so `vue-tsc --build` stays clean and the CLAUDE.md exhaustive-switch rule holds. `[VERIFIED: slideGroupMaterializer.ts:51-164]`

### Sibling `case 'MISC':` sites — which need splitting (audit)

| Site | Location | Current MISC behavior | Needs MISC split? | Why |
|------|----------|----------------------|-------------------|-----|
| `deriveGroupEntries` | `:157-162` | Returns one `{kind:'text'}` entry | **YES — the one change** | This is the derivation that must return `[]` for MISC |
| `sourceSignature` | `:242-248` | Returns `undefined` | **No** | A no-slide MISC group correctly signs `undefined`; leaving MISC in the group is right |
| `isSlotDerivableRef` | `:294-309` | `ref.kind === 'text' && title === undefined && body === undefined` | **No** | Never reached for MISC — `rebuildGroup` MISC is a no-op that never calls `survivingEntries`/`isSlotDerivableRef`. Harmless; keeps exhaustive |
| `rebuildGroup` | `:930-945` | Returns `{ changed: false, slides: group.slides }` | **No — and MUST stay** | This no-op is precisely what preserves existing MISC groups AND hand-added slides. Changing it is the risky path |

**Smallest safe change = split only `deriveGroupEntries`.** The other three switches keep MISC in the text fall-through group with zero behavioral effect.

### Why the minimal change is sufficient (dispatch trace)
- **New MISC item:** `materializationCandidates` builds `buildInitialGroup` → `deriveGroupEntries` → `[]`; then `if (input.slides.length === 0) continue` — **no group document is created at all.** MISC starts with zero slides. `[VERIFIED: useSlideshowAssembly.ts:470-477]`
- **Existing MISC item (stored group holds one blank text slide):**
  - Materialize watcher **skips** it: `if (slideGroupsStore.groupsBySlotId.has(slot.id)) continue`. `[VERIFIED: useSlideshowAssembly.ts:466]`
  - Rebuild watcher runs `rebuildGroup` → MISC returns `{ changed: false }` → `if (!result.changed) continue` → **no write, group untouched.** `[VERIFIED: useSlideshowAssembly.ts:648-649; slideGroupMaterializer.ts:941-943]`

## Backward-Compat Verdict (definitive) — CORRECTS the CONTEXT assumption

> CONTEXT.md (§R123) states: *"Changing the default to no-slides removes that auto-derived slide from existing MISC items on the next materialize."*

**That assumption is FALSE for the minimal change, and the true behavior is safer.**

- Existing production MISC items **keep** their one auto-derived blank text slide. It does **not** disappear, because (a) the materialize watcher skips any slot that already has a group, and (b) `rebuildGroup`'s MISC branch is a no-op. `[VERIFIED: useSlideshowAssembly.ts:466, 648-649; slideGroupMaterializer.ts:941-943]`
- This is **safe**: nothing is deleted; zero risk to user content. R123's requirement — "Miscellaneous items **default** to no slides; slides can still be added" — is satisfied for **new** items, and existing items retaining a benign, user-deletable blank text slide is a legacy cosmetic, not a defect.
- **No BLOCKER.** No path in the minimal change deletes real user content.

**Optional (NOT recommended) active-removal path:** If the planner wants existing MISC items to also become empty, `rebuildGroup`'s MISC branch would need to actively drop derived slides (via `survivingEntries`). That is *also* safe for hand-added slides (see below) but is more code and more risk, and it would delete the blank auto-slide on existing items. Recommend leaving `rebuildGroup` MISC as a no-op and flagging this as an explicit planner decision. If chosen, it must set `changed` correctly and route through `replaceGroupSlides` with `baseSlides` for concurrent-write safety — extra surface for a cosmetic gain.

## Hand-Added Slide Survival (proven)

### The add path works on an empty MISC group
`SlideGrid.vue::onAddSlide` (`:759-790`):
1. Calls `ensureGroupMaterialized(slotId)` first. `[VERIFIED: SlideGrid.vue:764]`
2. `ensureGroupMaterialized` **deliberately does NOT skip a zero-slide derivation** (unlike `materializationCandidates`): it calls `buildInitialGroup` (MISC → `slides: []`) then `materializeGroupIfMissing`, creating an empty group document `{ slides: [] }`. `[VERIFIED: useSlideshowAssembly.ts:588-593; slideGroups.ts:113-130]`
3. Appends `newEntry` with `sourceRef: { kind: 'text', title: 'New slide', body: '' }` and persists via `replaceGroupSlides`. `[VERIFIED: SlideGrid.vue:767-786]`

So a MISC item that starts with no slides **can** receive a hand-added slide. R123's "slides can still be added when the user chooses" is fully satisfied.

### The hand-added slide survives every rebuild
- With the minimal change, `rebuildGroup` MISC is a no-op → the group (and any hand-added slide) is never touched. `[VERIFIED: slideGroupMaterializer.ts:941-943]`
- Even under the active-removal path: a hand-added slide carries `title: 'New slide'` (**not** undefined) and `body: ''` (**not** undefined), so `isSlotDerivableRef` returns **false** → it is USER work → `survivingEntries` keeps it. The auto-derived blank slide (`{ kind: 'text' }`, title/body undefined) returns **true** → droppable. Clean, deliberate distinction — no user content at risk either way. `[VERIFIED: slideGroupMaterializer.ts:302-308; SlideGrid.vue:776]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persist an emptied notes without raw `undefined` | A custom cleanup before the Firestore write | Existing `stripUndefined` on the `services.ts` write path | Already recurses into `slots[]` at any depth (Phase 51) |
| Create a group so a slide can be added to an empty MISC | New "materialize empty group" logic | Existing `ensureGroupMaterialized` | It already tolerates zero-slide derivations by design |
| Preserve hand-added slides through rebuilds | A new MISC-specific carry path | The existing derived-vs-user split (`isSlotDerivableRef`/`survivingEntries`) or simply the no-op `rebuildGroup` | The title/body distinction already classifies hand-added slides as user work |
| Responsive selector/notes layout | A new breakpoint/utility | The `flex flex-col sm:flex-row` recipe from QuarterView | Phase 48 already sanctioned it project-wide |

**Key insight:** Both requirements are satisfied by *leaning on machinery that already exists*. The only net-new code is a two-column flex wrapper + one input (R122) and a one-branch split (R123).

## Runtime State Inventory

Not a rename/refactor/migration phase, but the R123 backward-compat question touches stored state, so stated explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `slideGroups/{slotId}` docs for production MISC items each hold one blank `{kind:'text'}` entry | **None** — left untouched by the minimal change; not deleted, not migrated. Safe. |
| Stored data | Slot-level `notes` — new optional field | None — schemaless additive; absent on all existing slots, renders empty |
| Live service config | None | None — no external service holds MISC/notes state |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

**Nothing deletes or rewrites existing user content — verified via the dispatch trace above.**

## Common Pitfalls

### Pitfall 1: Placing the notes input as a sibling of the slot row
**What goes wrong:** Adding notes as a 4th child of the `flex items-start gap-2` row (`:876`) pushes it next to the section `<select>`/remove button, away from the selector, and breaks the column layout.
**How to avoid:** Put notes **inside** the `flex-1 min-w-0` content div (`:891`), in a two-column flex with the selector chain.
**Warning sign:** Notes appears right of the section dropdown, or the remove button wraps.

### Pitfall 2: Casting `slot.notes`
**What goes wrong:** Copying the `body` pattern's `(slot as NonAssignableSlot)` cast for notes.
**How to avoid:** `notes?` is on the base `MediaAttachableSlot`, so `slot.notes` needs no cast on any kind. A cast would narrow incorrectly and could fail `vue-tsc --build`.

### Pitfall 3: Splitting MISC in `rebuildGroup` to force existing items empty
**What goes wrong:** Making `rebuildGroup` MISC actively rebuild risks concurrent-write bugs and deletes the existing blank auto-slide — a behavior change the requirement does not demand.
**How to avoid:** Keep `rebuildGroup` MISC a no-op. Only `deriveGroupEntries` changes.

### Pitfall 4: Using the narrower type-check
**What goes wrong:** `vue-tsc --noEmit -p tsconfig.app.json` skips test files; a `TS2339` in a test survives.
**How to avoid:** Gate with `npm run type-check` (= `vue-tsc --build`) per CLAUDE.md.

## Code Examples

### R123 — the split (verified against current source)
```ts
// slideGroupMaterializer.ts::deriveGroupEntries — replace the :157-162 block
case 'MISC':
  return []
case 'PRAYER':
case 'MESSAGE':
case 'ANNOUNCEMENTS':
case 'HYMN':
  return [{ id: crypto.randomUUID(), order: 0, sourceRef: { kind: 'text' } }]
```

### R122 — notes input (cast-free, autosave-wired)
```vue
<input
  :value="slot.notes"
  @input="slot.notes = ($event.target as HTMLInputElement).value || undefined"
  type="text"
  placeholder="Notes (e.g. who leads, who sings which parts)"
  data-testid="slot-notes-input"
  class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
/>
```

## State of the Art

No framework/version shifts relevant here. Tailwind `sm:` breakpoint, Vue 3 SFC reactivity, and the pure-materializer pattern are all current in this repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (`vue-tsc` ^3.2.5 for type gate) `[VERIFIED: package.json:59-60]` |
| Config file | `vite.config.ts` (app suite; excludes `src/rules.test.ts`), `vitest.rules.config.ts` (rules suite) |
| Quick run command | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` (fast inner loop) |
| Full suite command | `npx vitest run` (bare) — **or** `npx vitest run --dir src --exclude '**/rules.test.ts'` |
| Type gate | `npm run type-check` (= `vue-tsc --build`, checks test files too) — NOT `-p tsconfig.app.json` |

> ⚠ Per CLAUDE.md: a run reporting `src/rules.test.ts` failing is a **tooling artifact of the command**, not a regression. Rules suite is **not** exercised this phase (no `firestore.rules`/`storage.rules` change).

### Known-failing baseline (must remain exactly these two)
- `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation — environment, not a defect this phase touches)
- `src/views/__tests__/RosterView.test.ts` (stale assertion)

"Green" for this phase = the app suite passes except those two.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R123 | `deriveGroupEntries(MISC)` returns `[]` | unit | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` | ✅ (add MISC case; existing `PRAYER/MESSAGE/HYMN` describe at `:348-376` does NOT cover MISC, so no assertion breaks) |
| R123 | ANNOUNCEMENTS/PRAYER/MESSAGE/HYMN still derive one `{kind:'text'}` entry | unit | same | ✅ (add ANNOUNCEMENTS assertion for completeness) |
| R123 | `rebuildGroup(MISC)` is a no-op → hand-added slide (`{kind:'text',title:'New slide',body:''}`) survives unchanged | unit | same | ✅ (add) |
| R123 | `rebuildGroup(MISC)` on a group holding only the auto `{kind:'text'}` entry returns `changed:false` (blank slide persists) | unit | same | ✅ (add — documents the backward-compat verdict) |
| R122 | Notes input renders beside the selector for each kind (`data-testid="slot-notes-input"`) | component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ (extend; 11 existing `slot-*` testid assertions to mirror) |
| R122 | Editing notes flows to autosave; emptied notes does not persist raw `undefined` | component/store | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ (extend — assert `stripUndefined` drops `slots[].notes` when undefined) |
| R122 | Responsive wrapper classes present (`flex flex-col sm:flex-row`) | component | ServiceEditorView test | ✅ (extend) |
| R122 | `notes?` type on all 5 slot kinds | type | `npm run type-check` | n/a (no dedicated `service.ts` type test file; covered by build) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` (R123) / `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` (R122) + `npm run type-check`
- **Per wave merge:** `npx vitest run` (bare) — expect only the 2-file baseline red
- **Phase gate:** `npm run type-check` clean AND full app suite green-except-baseline before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/utils/__tests__/slideGroupMaterializer.test.ts` — add a `deriveGroupEntries — MISC` describe (returns `[]`) + hand-add-survival + auto-slide-persists rebuild tests — covers R123
- [ ] `src/views/__tests__/ServiceEditorView.test.ts` — add notes-input-per-kind + responsive-class + autosave-wiring assertions — covers R122
- [ ] `src/stores/__tests__/services.test.ts` — add slot-level `notes` round-trip + `undefined`-stripped assertion — covers R122 persistence
- Framework install: none (Vitest already present)

## Environment Availability

Skipped — no external tools/services/runtimes beyond the existing toolchain (`npm`, Vitest, vue-tsc), which the repo already depends on. No emulator needed (no rules change). `.env.local` is required only for emulator/build, not for these unit/component tests.

## Security Domain

`security_enforcement` posture: this phase adds one optional plain-text field and edits a pure derivation function. No auth, session, access-control, cryptography, or new input-sink surface is introduced.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | minimal | Notes is a plain-text string rendered via Vue text interpolation (`{{ }}`) / bound `:value`, which auto-escapes — no `v-html`, no injection sink. Firestore rejects `undefined` (handled by `stripUndefined`) |
| V2/V3/V4/V6 | no | No authn/session/access-control/crypto change; slot writes ride the existing service-document rules unchanged |

Threat note: do NOT render notes with `v-html`; keep it text interpolation (the read-only branch above uses `whitespace-pre-wrap` on a `<p>`, which is safe).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Notes column fixed width `sm:w-64` is the preferred split (vs. equal `flex-1`) | R122 render seam | Cosmetic only; owner may prefer equal split — Claude's discretion per CONTEXT |
| A2 | Leaving existing MISC items' blank auto-slide in place (not force-emptying them) satisfies R123's intent | Backward-compat verdict | If the owner expects existing MISC items to also show zero slides, the optional active-removal path is needed (still safe for hand-added slides). Flagged for planner decision |
| A3 | Single-line `<input>` (not `<textarea>`) for notes | R122 render seam | Cosmetic; CONTEXT lists both as acceptable — Claude's discretion |

## Open Questions

1. **Should existing production MISC items retroactively drop their blank auto-slide?**
   - What we know: The minimal change leaves them untouched (safe, nothing deleted). New items get zero slides.
   - What's unclear: Whether the owner reads R123 "default to no slides" as also applying to already-created items.
   - Recommendation: Ship the minimal change (existing items keep their deletable blank slide). If the owner wants existing items empty too, add the active-removal path in `rebuildGroup` MISC as a follow-up task — hand-added slides are provably safe under it.

## Sources

### Primary (HIGH confidence — live source, this session)
- `src/types/service.ts:39-130` — `MediaAttachableSlot` base, 5 slot interfaces, `Service.notes` coexistence
- `src/views/ServiceEditorView.vue:875-1184` — per-item render seam; :1387/:2176/:3713 autosave wiring; :1092-1103 body/read-only pattern
- `src/views/QuarterView.vue:6,13` — responsive recipe (Phase 48)
- `src/utils/slideGroupMaterializer.ts:157-162, 242-248, 294-309, 930-945` — MISC derivation + sibling switches
- `src/composables/useSlideshowAssembly.ts:447-480, 540-546, 560-599, 630-659` — materialize/rebuild dispatch, `ensureGroupMaterialized`
- `src/stores/slideGroups.ts:113-130` — `materializeGroupIfMissing`
- `src/components/slides/SlideGrid.vue:759-790` — `onAddSlide` hand-add path
- `src/utils/stripUndefined.ts:12-27` — recursive undefined-stripping
- `src/utils/__tests__/slideGroupMaterializer.test.ts:348-376` — existing derive tests (no MISC coverage)
- `package.json:10-13,59-60` — test/type-check scripts and versions

### Secondary / Tertiary
None — no external lookups were required for this brownfield phase.

## Metadata

**Confidence breakdown:**
- R122 render seam: HIGH — single seam identified with exact line numbers; base-field cast-free access verified
- R122 responsive: HIGH — reused verbatim from an existing sanctioned recipe
- R123 change: HIGH — one-line split; full dispatch trace confirms sufficiency
- Backward-compat: HIGH — traced through materialize + rebuild watchers; corrects the CONTEXT assumption with evidence
- Hand-add survival: HIGH — proven via `ensureGroupMaterialized` + `isSlotDerivableRef` title/body distinction

**Research date:** 2026-08-11
**Valid until:** 2026-09-10 (stable brownfield code; only invalidated by edits to the cited files)
