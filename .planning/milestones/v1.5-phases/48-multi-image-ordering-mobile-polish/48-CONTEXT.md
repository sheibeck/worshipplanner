# Phase 48: Multi-Image Ordering & Mobile Polish - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey-area answers proposed and accepted at Claude's
discretion under the v1.5 standing autonomy grant (STATE.md, 2026-08-06). Several success criteria
carry their own **locked implementation notes** in REQUIREMENTS.md/ROADMAP.md (the `Intl.Collator`
call, the "reuse the exact desktop SortableJS config" mandate, the `QuarterView.vue` recipe) — those
are honored, not re-opened.

<domain>
## Phase Boundary

Two loosely-related clusters, deliberately sequenced last (nothing else still touches
drag-and-drop order logic concurrently):

1. **Multi-image import ordering (R098):** dropping several images at once produces slides in
   filename **natural order** (`slide2` before `slide10`).
2. **Mobile & layout polish (R099-R103):** the Slides tab and the service edit screen work on a
   phone; buttons stack; Print/Share move to the top action bar; Undo becomes a link; the
   dashboard Getting Started panel can be dismissed.

Requirements: **R098** (natural-order multi-image), **R099** (Slides tab on phone), **R100**
(buttons stack on the service edit screen), **R101** (Print/Share in the top action bar), **R102**
(Undo is a link beside last-saved), **R103** (Getting Started dismissible).

**Research posture (ROADMAP mandate):** skip research for R098 (native `Intl.Collator`, a solved
problem); **audit-first** for R099-R103 — the phase researcher reads the Slides tab's *actual*
mobile-blocking layout before scoping, rather than assuming scope research could not verify.
</domain>

<decisions>
## Implementation Decisions

### Multi-Image Ordering (R098)
- **Sort the images bucket in `classifyFiles` (`src/components/slides/dropRouting.ts`)** with
  `Intl.Collator({ numeric: true, sensitivity: 'base' })` on `file.name`, before the function
  returns — so every consumer of `classifyFiles` gets natural order. No new dependency.
- **Images bucket only.** R098 is about multi-image drops; leave `decks`/`videos`/`audioFiles`
  ordering unchanged (a multi-PPTX drop routes to a single deck anyway). Sorting only the images
  bucket is the minimal, targeted change.
- **Proven by test:** a drop of `slide2.png, slide10.png, slide1.png` classifies to
  `[slide1, slide2, slide10]` — the numeric-collation trap (`slide2` before `slide10`) is the
  explicit acceptance case.

### Mobile Usability (R099, R100)
- **Audit-first (R099):** the researcher audits `SlidesTab.vue` / `SlideGrid.vue`'s real
  mobile-blocking layout (fixed widths, horizontal overflow, tap-target sizes) at phone width and
  reports concrete blockers before the plan scopes fixes. Do NOT assume the scope.
- **Touch reordering reuses the EXACT desktop SortableJS config** with touch-only options added
  (`delay` / `delayOnTouchOnly` / `touchStartThreshold`), NOT a reconfiguration — locked by R099
  to avoid reproducing the documented index bug (reproduction case `ZTXcpNRcJTalEQp42fTx`). The
  existing `*DraggableIndex` correctness must be preserved.
- **Button stacking (R100):** copy `QuarterView.vue`'s existing responsive button-stacking recipe
  (the Schedule screen's flex-col→flex-row-at-breakpoint pattern) onto the service edit screen's
  action row, using the same breakpoint for consistency — not a bespoke new pattern.

### Layout Polish (R101, R102, R103)
- **Print + Share → top contextual action bar (R101):** add `print` and `share` action keys to
  `src/views/serviceEditorActionBar.ts` (the shared declarative bar, alongside `export-pc` / `save`
  / `present`) and render them via `ContextualActionBar.vue`; remove them from the page-bottom
  "Print, Share, Delete" row (`ServiceEditorView.vue` ~line 1300). **Delete stays at the bottom** —
  R101 names only Print and Share, and keeping a destructive action out of the top bar is correct.
- **Undo → link beside last-saved text (R102):** the current Undo *button*
  (`ServiceEditorView.vue` ~line 104, among the primary actions) becomes a subtle text link
  adjacent to the save-status / last-saved indicator — off the primary-action row. Keep the
  Ctrl+Z binding and the snapshot-exists gating.
- **Getting Started dismissible (R103):** add a dismiss control (an `×`) to
  `src/components/GettingStarted.vue`, persisted so it stays dismissed across reloads. **Persist in
  `localStorage`** (per-device) — this is dashboard onboarding UI, not church data; it warrants no
  Firestore/OrgSettings schema change. The dismiss is **independent of** the existing
  `v-if="!allDone"` auto-hide (a user can dismiss it before finishing the steps). No un-dismiss UI
  is in scope.

### Claude's Discretion
- The exact mobile breakpoint values (match QuarterView), the dismiss control's icon/placement, the
  Undo link's exact wording/position beside the save status, and the precise action-bar ordering of
  the new Print/Share keys — all at Claude's discretion within the decisions above. The UI-SPEC
  (next step) locks the visual contract.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/slides/dropRouting.ts` — `classifyFiles` (line 41): the one place the images
  bucket is built; the R098 sort goes here.
- `src/views/QuarterView.vue` — the responsive button-stacking recipe to copy (R100).
- `src/views/serviceEditorActionBar.ts` — the declarative top action-bar model (keys:
  `suggest-all-songs`, `export-pc`, `save`, `present`); add `print`/`share` here (R101).
- `src/components/ContextualActionBar.vue` — renders the action bar (36-03 / R068).
- `src/views/ServiceEditorView.vue` — the service edit screen: Undo button (~line 104), the
  page-bottom "Print, Share, Delete" row (~line 1300), and the action row that must stack on
  mobile (R100/R101/R102). NOTE: the autosave-failure message was moved to its own line below the
  save-area row (out-of-band `136fd0a`) — do not reflow it back inline (STATE.md ⚠).
- `src/components/GettingStarted.vue` — `v-if="!allDone"` onboarding panel (Firestore-driven step
  completion), rendered in `DashboardView.vue` for editors; add the R103 dismiss + localStorage.
- `src/components/slides/SlidesTab.vue`, `SlideGrid.vue` — the Slides-tab surfaces to audit for
  mobile (R099); they carry the desktop SortableJS config to reuse verbatim for touch.

### Established Patterns
- The action bar is declarative (`serviceEditorActionBar.ts` returns keyed actions consumed by
  `ContextualActionBar.vue`) — extend it by adding keys, not by hand-placing buttons.
- SortableJS `onEnd` correctness depends on `*DraggableIndex` (not `oldIndex`/`newIndex`) and a
  stable `v-for` key of `slot.id` — the v1.4 research root-caused the drag bugs here; touch reuse
  must not regress it.

### Integration Points
- `classifyFiles` (R098); `serviceEditorActionBar.ts` + `ContextualActionBar.vue` +
  `ServiceEditorView.vue` (R101/R102); `SlidesTab.vue`/`SlideGrid.vue` (R099); `ServiceEditorView`
  action row + `QuarterView` recipe (R100); `GettingStarted.vue` + `localStorage` (R103).
</code_context>

<specifics>
## Specific Ideas

- R098's canonical trap is `slide2` vs `slide10` — the acceptance test must assert numeric
  collation, not lexicographic.
- R099's landmine is the SortableJS index bug (`ZTXcpNRcJTalEQp42fTx`) — reuse the exact desktop
  config + touch-only options; do not reconfigure.
- Delete deliberately does NOT move to the top action bar (R101 is Print + Share only).
- The autosave-failure message's own-line placement (out-of-band `136fd0a`) must survive any
  action-row reflow.
</specifics>

<deferred>
## Deferred Ideas

- Sorting the non-image drop buckets (decks/videos/audio) — out of R098's scope.
- A way to un-dismiss / bring back the Getting Started panel — not requested.
- Broader mobile work beyond the Slides tab and the service edit screen (e.g. every other view) —
  R099/R100 name exactly those two surfaces.
- Moving Delete to the top action bar — deliberately excluded (destructive action stays bottom).
</deferred>
