# Phase 54: Service Item Enhancements - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (owner away — grey areas auto-decided at Claude's discretion, grounded in a live read of `service.ts` slot types and `slideGroupMaterializer.ts`)

<domain>
## Phase Boundary

Every service item can carry leader/parts notes in a consistent, responsive layout, and Miscellaneous
items start clean with no slides. Requirements R122 (a plain-text notes field beside each item's
selector, side-by-side on desktop / stacked on mobile, consistent across item types) and R123
(Miscellaneous items default to no slides, with slide-add still available). Builds on Phase 51's stable
service-order editing surface.

</domain>

<decisions>
## Implementation Decisions

### R122 — Notes field beside each item's selector
- **Add `notes?: string` to the shared base `MediaAttachableSlot`** (`service.ts:39`) — every slot kind
  (SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ImportedSlot) extends it, so one additive
  optional field gives every item a notes field at once. Firestore schemaless → persists for free; no
  migration.
- Render a **plain-text input** (single-line `<input>` or a small `<textarea>`) beside each item's
  selector in `ServiceEditorView.vue`, for "who leads this" / "who sings which parts". Rich-text /
  formatting is explicitly OUT of scope.
- **Consistent placement across item types:** the selector (song picker / scripture picker / body input
  / etc.) and the notes input share one layout wrapper so every item kind looks the same — a selector
  on one side, notes on the other.
- Wire the notes value through the editor's **existing autosave** path (the same path slot `section` /
  `body` use), so a notes edit saves like any other slot edit (and benefits from Phase 51's
  `stripUndefined` fix — an empty notes value should not write raw `undefined`).

### R122 — Responsive layout
- **Side-by-side on desktop, stacked on small screens**, reusing the project's existing mobile-stacking
  recipe from `QuarterView.vue` (the same flex/`sm:` pattern v1.5 Phase 48 applied to the service edit
  screen — do NOT invent a new responsive pattern). The selector keeps its width on desktop; the notes
  field sits alongside and drops below on narrow viewports.

### R123 — Miscellaneous items default to no slides
- Today MISC is grouped with PRAYER/MESSAGE/ANNOUNCEMENTS/HYMN in `deriveGroupEntries`
  (`slideGroupMaterializer.ts:157-162`) and returns exactly ONE derived text slide
  (`[{ id, order:0, sourceRef:{ kind:'text' } }]`). R123 makes a Miscellaneous item's materialized
  slide group **start empty**.
- **Give MISC its OWN branch** in `deriveGroupEntries` returning **no derived entries** (`[]`), leaving
  ANNOUNCEMENTS (and PRAYER/MESSAGE/HYMN) on the existing one-text-slide behavior. The materializer's
  existing derived-vs-user-added split must keep any **hand-added slides** on a MISC item (slide-add
  stays available — "slides can still be added when the user chooses").
- **Backward-compat — research MUST map this:** existing production MISC items currently carry one
  auto-derived blank text slide. Changing the default to no-slides removes that auto-derived slide from
  existing MISC items on the next materialize. Confirm (a) that this is safe (the auto-slide is an empty
  text slide, not user content), (b) that a MISC item with a genuinely hand-added slide keeps it, and
  (c) whether the sibling case tables in `slideGroupMaterializer.ts` (the `case 'MISC':` at ~:244,
  ~:305, ~:941 — media, signature, rebuild) need MISC split out too for consistency, or only the
  derivation site. Prefer the smallest change that makes new AND existing MISC items default to no
  slides while preserving hand-added ones.

### Claude's Discretion
- Notes input element (single-line input vs. small textarea), exact wrapper markup, and whether the
  R123 change is one derivation-site branch or a fuller MISC split are at Claude's discretion, subject
  to: additive/optional model change (no migration), the QuarterView responsive recipe (no new
  pattern), hand-added MISC slides preserved, and `npm run type-check` (vue-tsc --build) clean with
  every `switch (slot.kind)` staying exhaustive.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/service.ts` — `MediaAttachableSlot` base (add `notes?`), the 5 slot interfaces.
- `src/views/ServiceEditorView.vue` — the service-order item rendering (where the notes input + the
  responsive wrapper go, per-item); also the autosave path (Phase 51 `stripUndefined`).
- `src/views/QuarterView.vue` — the responsive side-by-side/stacked recipe to reuse (v1.5 Phase 48).
- `src/utils/slideGroupMaterializer.ts` — `deriveGroupEntries` (:157 the MISC derivation to split),
  plus the sibling `case 'MISC':` sites (~:244 media, ~:305 signature, ~:941 rebuild) to audit.

### Established Patterns
- All slots extend `MediaAttachableSlot`; slot fields are additive/optional and persist schemaless.
- `switch (slot.kind)` is exhaustive with no `default` across the codebase (Phase 43) — keep it so.
- The v1.5 Phase 48 responsive service-edit stacking is the sanctioned mobile recipe.
- The materializer already distinguishes derived vs. hand-added slides (used by IMPORTED and others) —
  R123 relies on that so hand-added MISC slides survive.

### Integration Points
- `service.ts` (`notes?` on base), `ServiceEditorView.vue` (notes UI + responsive layout),
  `slideGroupMaterializer.ts` (MISC → no derived slides, hand-add preserved).

</code_context>

<specifics>
## Specific Ideas

- Owner: "We want a way to type in information about an item to denote who is leading that item. For
  instance, when we add a song, we want to be able to note who is singing what parts, etc. This can be a
  simple input box where we can type notes. The inputs we have on all our service items... take up the
  entire width of the screen, which can be very long. I think we have space to put a notes field next to
  it. When on smaller screens we can stack it. We want some consistency between the field types. So, if
  it's a song, there's a song selector, and an input. If it's a scripture there is a Scripture selector
  and an input."
- Owner: "Miscellaneous items in the service order should default to no slides. We can still add them in
  if needed, but by default no slides."

</specifics>

<deferred>
## Deferred Ideas

- Rich-text / formatting in the notes field — OUT of scope (REQUIREMENTS Out of Scope): R122 is a
  plain-text input.

</deferred>
