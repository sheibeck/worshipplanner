# Phase 36: UI Rework — Service Order & Contextual Action Bars - Context

**Gathered:** 2026-08-03
**Status:** Ready for UI-SPEC, then planning
**Mode:** Smart discuss (autonomous). Grey areas below are proposed with recommendations and
auto-accepted under the STATE.md standing autonomy grant. **Accepted answers are Claude's
recommendations, not owner statements — reversible defaults.** Where a wireframe answers a question,
the wireframe wins over any recommendation here.

<domain>
## Phase Boundary

The Service Order tab is rebuilt against the Claude Design wireframes, and one contextual action-bar
pattern is applied across every tabbed screen. Requirements: **R053, R067, R068, R069**.

**In scope:** the Service Order tab's layout rebuild against "Turn 3 — Service Order tab"; one shared
contextual action-bar component used by all three tabs; moving `Suggest All Songs` and `Copy for PC`
out of the always-visible page header; the Present button's placement per design "1a"; moving
`＋ Add slide` and `Add music to this group` into the action bar; making the group's existing
drag-and-drop zone the import affordance and deleting the separate `⇪ Import into this group` button;
and reordering the tabs so Roles is last.

**Out of scope:** any change to what the actions *do* — this phase moves and reorganizes controls, it
does not re-implement their handlers; the Slides grid's own internals beyond the affordances named
above; Phase 34's congregational modal; the presentation renderer; anything touching `functions/` or
`render-service/`.

**This phase is deliberately sequenced LAST among the milestone's UI work.** R068 depends on the
Service Order (Phase 31) and Slides (Phase 33) layouts both being final. They now are.

</domain>

<decisions>
## Implementation Decisions

### ★ Verified starting state — established by direct source read, not assumed

| Fact | Evidence |
|---|---|
| Tab order today is **Service Order · Roles · Slides** | `ServiceEditorView.vue:666`, `:677`, `:692`; state at `:1469` is `ref<'service-order' \| 'roles' \| 'slides'>` |
| `Suggest All Songs` and `Copy for PC` live in the **page header**, outside every tab panel — which is exactly why they appear on all three tabs | `ServiceEditorView.vue:114-130` and `:198-213`; the tab panels start at `:701` |
| The separate import button exists and is named **`⇪ Import into this group`** | `SlideGrid.vue:32-33` |
| The group grid **already has** full drag-and-drop file handling | `SlideGrid.vue:149-159` — `onGridDragEnter`/`onGridDragOver`, with a dragleave counter and a files-only guard |
| `＋ Add slide` is a grid-local button | `SlideGrid.vue:24-26`, testid `slide-grid-add-slide` |
| The Present button already lives on the Slides tab | `SlidesTab.vue:3-17` |
| Both wireframes this phase's criteria name are present in the re-pulled design file | `docs/design/slides-tab.dc.html` contains `Turn 3 — Service Order tab` and `1a Plan rail · slide grid · Edit Slide drawer — two states` |

**R053's dropzone work is smaller than it reads.** The dropzone already exists and already accepts
files; the requirement is to make it *clickable* as the import affordance and delete the separate
button. Do not rebuild the drag handling.

### ★★ A collision this phase MUST resolve, not discover late

**Phase 34's plan `34-11` merged the group music and group background controls into one panel**
(`SlideGrid.vue`, testid `slide-grid-group-media-panel`) in direct response to an owner UAT finding
(F2) — landed 2026-08-03, commits `98fdd29`/`2938d01`.

**R053 now moves `Add music to this group` into the contextual action bar**, which pulls one half back
out of the panel the owner just asked to have merged.

This is a real tension between an owner request and a requirement, and it must be settled explicitly
rather than resolved by whichever code is written last:

- **Recommendation (accepted):** keep the merged panel as the home for *group background*, and move
  only the *music* control to the action bar if — and only if — the "Turn 3" wireframe shows it there.
  **If the wireframe shows both controls staying in the panel, the wireframe wins and R053's
  music-control clause is recorded as superseded by owner finding F2**, with the reason written into
  REQUIREMENTS.md rather than silently dropped.
- The UI-SPEC must answer this from the wireframe. Do not let a planner guess it.
- `34-11` deliberately kept its change small "so as not to collide with Phase 36" and left a note in
  the code saying so. Read that note before editing.

### Contextual Action Bar (R068)

- **One shared component**, not three per-tab implementations — R068's words are "one shared
  contextual-action-bar pattern", and three copies is the shape that produced this requirement.
- **The bar renders per-tab content via a slot or a declarative per-tab action list.** Recommendation
  (accepted): a declarative list — each tab supplies `{key, label, handler, disabled, tone}` items and
  the bar owns all markup. This keeps the "only relevant actions" guarantee checkable in a unit test
  against data rather than against rendered DOM in three places.
- **`Suggest All Songs` belongs to Service Order. `Copy for PC` / `Export to PC` belong to Service
  Order.** Neither may render on Slides or Roles — that is R068's concrete acceptance test.
- **Do not regress Phase 34's `34-12` work:** the no-credentials explanatory note
  (`data-testid="pc-credentials-missing-note"`, requirement **R071**) sits beside `Copy for PC` and
  must travel with it into the action bar, still gated on `canEditService && !hasPcCredentials`.
- **Do not regress the lock semantics.** Phase 31 made editing draft-only with a three-layer lock;
  every action moved into the bar keeps its existing `canEditService` / `isLocked` gating. Moving a
  control must not change who can press it.

### Tab order (R069)

Target order: **Service Order · Slides · Roles**. Today it is Service Order · Roles · Slides, so this
is a swap of the last two, in the markup at `ServiceEditorView.vue:666-695` and anywhere the order is
mirrored (tests, keyboard navigation, any index-based assertion). The union type at `:1469` is
order-independent and needs no change.

### Service Order rebuild (R067)

- **Rebuild against the wireframe, but preserve behavior.** Every existing capability of the tab keeps
  working: reordering, the section structure, scripture reference entry (R047's slot-as-source-of-truth
  shape), the lock banner, and the save-status bar Phase 34's `34-10` just corrected.
- **The save-status bar's chrome-strip-at-idle behavior is load-bearing and must survive the rebuild.**
  It was the fix for owner UAT finding F4. Re-introducing a `v-if` on that wrapper would both bring
  back the empty box and cost a screen-reader announcement.

### Claude's Discretion

- Markup structure and Tailwind class composition within the wireframe's visual result.
- Whether the action bar is one component file or a component plus a small types module.
- Test file organization for the new component.

</decisions>

<code_context>
## Existing Code Insights

### Integration Points
- **`src/views/ServiceEditorView.vue`** — owns the tab strip (`:666-695`), the tab state (`:1469`), the
  page-header action buttons (`:114-213`), the lock banner, the save-status bar (`:235-241`, chrome
  gated by `serviceSaveStatusVisible`), and Phase 34's congregational modal mount (`:570`). This file
  is the center of gravity for R067, R068 and R069 and is already large — expect the action-bar
  extraction to *reduce* it.
- **`src/components/slides/SlideGrid.vue`** — owns `＋ Add slide` (`:24-26`), `⇪ Import into this group`
  (`:32-33`), the merged group-media panel (34-11), and the grid-wide drag handling (`:149-159`).
- **`src/components/slides/SlidesTab.vue`** — owns the Present button (`:3-17`) and the
  `edit-in-scripture` relay Phase 34 now uses.

### Established Patterns
Vue 3 `<script setup>` + TypeScript, Tailwind, Pinia. Controls are gated by explicit
`canEditService` / `canMutate` / `canWriteGroupMedia` computeds rather than by role checks at the call
site. Components that render nothing meaningful **do not render an empty box** (31-UI-SPEC E5) — see
`SlideGrid.vue`'s wrapper gates and `34-10`'s chrome-strip variant. Tests use
`setActivePinia(createPinia())` and `enableAutoUnmount(afterEach)`.

</code_context>

<specifics>
## Specific Ideas

- **The acceptance test for R068 should be data-level, not DOM-level.** "Which actions does tab X
  expose?" answered against a declarative list is a test that cannot pass for the wrong reason; the
  same assertion made by querying rendered DOM in three places is the shape that let
  `Suggest All Songs` leak onto Roles in the first place.
- **This phase moves controls that other phases' tests assert on.** Expect to update test selectors in
  `ServiceEditorView.test.ts`, `SlidesTab.test.ts` and `SlideGrid.test.ts`. **An existing test edited to
  accommodate a moved control is legitimate; an existing test edited to accommodate a *changed
  behavior* is not.** Phases 33 and 35 both established that distinction — state which category each
  edit falls in.

</specifics>

<deferred>
## Deferred Ideas

- Any redesign of the Slides grid beyond the affordances R053 names.
- Consolidating the three tabs' panels into routed sub-views.
- The five open human-verify items from Phase 34 (`PENDING-VERIFICATION.md` 34.1, 34.3–34.6) — this
  phase does not close them and must not mark them passed.

</deferred>
