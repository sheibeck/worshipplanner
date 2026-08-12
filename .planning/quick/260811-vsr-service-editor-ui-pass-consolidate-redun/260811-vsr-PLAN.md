---
phase: 260811-vsr-service-editor-ui-pass
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServiceEditorView.vue
  - src/components/ServicePrintLayout.vue
  - src/utils/planningCenterApi.ts
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/components/__tests__/ServicePrintLayout.test.ts
  - src/utils/__tests__/planningCenterApi.test.ts
autonomous: true
requirements: [VSR-1, VSR-2, VSR-3, VSR-4, VSR-5]
# VSR-1 notes-canonical consolidation + notes ?? body read-fallback (CONTEXT decision 1)
# VSR-2 stacked three-rail row layout + badge + capped column + mobile (CONTEXT decision 2 / DESIGN-SPEC)
# VSR-3 muted/dashed "No Section" band (CONTEXT decision 3)
# VSR-4 per-row ⋯ menu owns Move-to-section + Delete (CONTEXT update block)
# VSR-5 plain kinds get exactly ONE input each (CONTEXT update block)

must_haves:
  truths:
    - "Plain kinds (Prayer, Misc, Announcements, Message) render exactly ONE free-text field in the editor (VSR-1/VSR-5)."
    - "That single field reads `notes ?? body` and writes `notes`; a legacy body-only item still displays and exports correctly (VSR-1)."
    - "ServicePrintLayout and Planning Center export read `notes ?? body` for MESSAGE/ANNOUNCEMENTS/MISC (VSR-1)."
    - "Each row is a three-rail layout: drag handle · colored per-kind badge · stacked field column · right-aligned action rail; notes stacked full-width (no side-by-side); list capped to a readable width; single-stack below sm (VSR-2)."
    - "A per-row editor-only ⋯ menu provides Move-to-section (calls onSectionChange) and Delete (calls removeSlot); the inline section <select> and inline ✕ are gone (VSR-4)."
    - "The ungrouped bucket renders a muted/dashed No-Section band when non-empty (VSR-3)."
    - "Every canEditService gate and viewer/locked read-only branch is preserved; body/linkUrl/linkLabel remain on the types and in Firestore (UI-removal only)."
  artifacts:
    - src/views/ServiceEditorView.vue
    - src/components/ServicePrintLayout.vue
    - src/utils/planningCenterApi.ts
  key_links:
    - "slotFreeText(slot) = notes ?? body — single read source for the consolidated field (editor :value AND viewer display)."
    - "⋯ menu Move-to-section item → onSectionChange(index, value); Delete item → removeSlot(index)."
    - "kindBadgeClass(kind) → per-kind Tailwind pill classes; badge text = slotLabel(slot, index)."
    - "No-Section band renders iff the 'ungrouped' group is present and non-empty."
---

<objective>
Redesign the Service Order tab in `ServiceEditorView.vue` to match the owner's Claude Design
mockup (see `260811-vsr-DESIGN-SPEC.md`): a capped readable column of unified "three-rail" rows
(colored per-kind badge → stacked field+notes → right-aligned action rail), notes-canonical
consolidation so plain items show ONE field, a per-row ⋯ menu that owns section-change + delete,
a labeled muted/dashed "No Section" band, and a mobile single-stack.

This is a LAYOUT + MARKUP + control-relocation change only. No data model changes, no behavior
rewrite. Every `canEditService` gate, viewer/locked read-only branch, Sortable/drag wiring
(`group.key` + `slotRenderNonce` bump), `slotLabel` naming, `groupBySection` ordering, the
add-to-service palette and per-section add-item menus, and the `body`/`linkUrl`/`linkLabel` data
model are preserved. Only the notes-canonical consolidation and the ⋯-menu control relocation
change data-flow, both non-destructively.

Purpose: make the service-editing screen consistent, tidy, and mobile-friendly, and give
un-sectioned items a clear home — the owner's authoritative visual target.
Output: restructured `ServiceEditorView.vue` rows + read-side consumers migrated to `notes ?? body`
+ tests updated in lockstep. type-check clean; app suite green at the 2-file known baseline.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260811-vsr-service-editor-ui-pass-consolidate-redun/260811-vsr-DESIGN-SPEC.md
@.planning/quick/260811-vsr-service-editor-ui-pass-consolidate-redun/260811-vsr-CONTEXT.md
@.planning/STATE.md
@CLAUDE.md

# Primary edit target and its verified seams (file is ~2800 lines — confirm anchors before editing)
@src/views/ServiceEditorView.vue
# Read-side consumers of the consolidated free-text field
@src/components/ServicePrintLayout.vue
@src/utils/planningCenterApi.ts
# The codebase's ARIA-menu precedent to mirror for the ⋯ menu (backdrop + absolute panel pattern)
@src/components/slides/SlideActionMenu.vue

## Confirmed seams (verified 2026-08-11)
- Row root `.slot-item` (`flex items-start gap-2`) at ServiceEditorView.vue:880–883; drag handle :889;
  content `.flex-1 min-w-0` :896; Phase-54 side-by-side wrapper `flex flex-col sm:flex-row` :903.
- Per-kind chain: SONG :907 (has SongBadge :912); SCRIPTURE :1009 (label-left/picker-right at :1010);
  PRAYER :1050 (linkLabel input :1057 + linkUrl input :1064 + viewer link :1086 — REMOVE from UI, keep
  data); MESSAGE/ANNOUNCEMENTS/MISC shared body `<textarea>` :1106 (`data-testid="slot-body-input"`,
  `bodyPlaceholder(kind)`) with viewer `slot-body-text` :1116 / `slot-body-empty` :1117; HYMN :1121;
  IMPORTED :1160.
- Shared notes field (ALL kinds) in `sm:w-64` column :1173–1184: input `:value="slot.notes"`
  (`data-testid="slot-notes-input"`), writes `slot.notes = value || undefined`; viewer `slot-notes-text`
  :1183.
- Inline section `<select data-testid="section-select">` :1194–1204 (options: "No section" +
  `SERVICE_SECTIONS`→`SERVICE_SECTION_LABELS`; `@change="onSectionChange(index, value)"`).
- Inline remove ✕ button `@click="removeSlot(index)"` :1207–1217.
- Section band header :806–821 (`sectionSlideCount(group.entries)` :813, add-item popover
  `openSectionAddKey`/`toggleSectionAdd` :819/:831); ungrouped bucket has NO header
  (`slotSectionGroups` pushes `{ key:'ungrouped', label:null }` at :1788; container :846 renders
  `data-testid="section-list-ungrouped"`, no header comment near :843).
- Script helpers: `slotLabel` (from `@/utils/slotTypes`, :1399 import) returns the kind label
  ("Song","Scripture Reading","Prayer","Message","Announcements","Miscellaneous","Hymn","Imported
  Slides"); `onSectionChange(index,value)` :1827; `removeSlot(index)` :2772; `bodyPlaceholder` :2723;
  `sectionSlideCount(entries)` :2689; `openSectionAddKey`/`toggleSectionAdd` :2696; `addSlot` :2701;
  `SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS` imported :1405; types imported :1406.
- Types (`src/types/service.ts`): `notes?` on base `MediaAttachableSlot` :60 (reachable cast-free on
  all kinds); `body?`/`linkUrl?`/`linkLabel?` on `NonAssignableSlot` :97–99. LEAVE these on the type.
- Consumers of `slot.body`: ServicePrintLayout.vue:64–83 (MESSAGE/ANNOUNCEMENTS/MISC `slot.body`);
  planningCenterApi.ts ANNOUNCEMENTS :1019, MISC :1029, MESSAGE :1040 (`bodyDescription(slot.body)`),
  `bodyDescription` helper :884.
- NOT a consumer: `slideGroupMaterializer.ts` returns `undefined` for MESSAGE/ANNOUNCEMENTS/MISC
  (:248–253) — plain items materialize no body-sourced slides; the `ref.body` at :313 is a slide ref,
  not `slot.body`. No change needed there. (DESIGN-SPEC's "any slide use in slideGroupMaterializer
  that reads body" resolves to NONE — confirmed.)

## Scope decisions recorded by the planner
- **Template editor is OUT of scope.** `ServiceTemplateEditor.vue` writes `entry.body`, threaded to a
  created slot's `body` via `buildSlotsFromTemplate`→`createSlot(...,entry.body)` (slotTypes.ts:394).
  The `notes ?? body` read-fallback in Task 1 fully and non-destructively covers template-instantiated
  items (they display, and re-persist to `notes` on next edit). Making the template write `notes` would
  force a change to the `ServiceTemplateEntry`/`OrgSettings`-adjacent type and `createSlot`'s signature
  — a settings-contract change beyond a layout UI pass, and STATE.md flags `OrgSettings` as load-bearing.
  Deliberately deferred; the read-fallback makes it safe to defer.
- **PC-export PRAYER stays description-less.** PRAYER's PC export sends no `description` today and gains
  none: the golden rule forbids "functional/data-flow changes beyond the notes-canonical consolidation
  and the control relocation," and adding PRAYER text to Planning Center is a new data-flow. The
  read-side migration is redirect-only — wherever a consumer reads `slot.body`, it now reads
  `notes ?? body`; PRAYER reads neither, so its migration is a no-op. PRAYER print (label-only,
  ServicePrintLayout.vue:53–55, outside the :64–81 body range) likewise unchanged.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (deliverable A): Notes-canonical consolidation of plain kinds + migrate read-side consumers</name>
  <files>src/views/ServiceEditorView.vue, src/components/ServicePrintLayout.vue, src/utils/planningCenterApi.ts, src/views/__tests__/ServiceEditorView.test.ts, src/components/__tests__/ServicePrintLayout.test.ts, src/utils/__tests__/planningCenterApi.test.ts</files>
  <behavior>
    - A MESSAGE/ANNOUNCEMENTS/MISC slot renders exactly ONE free-text field (the notes-canonical
      field); the second `slot-body-input` textarea no longer exists.
    - A PRAYER slot renders exactly ONE free-text field; the linkLabel/linkUrl inputs and the viewer
      link no longer exist.
    - The single field's displayed value = `notes ?? body`: a legacy slot carrying only `body` shows
      that text; typing into the field writes `slot.notes` (and `= value || undefined` when emptied),
      never `body`; a stored `linkUrl`/`linkLabel` on the same slot survives the edit untouched.
    - Selector kinds (Song/Scripture/Hymn/Imported) still render selector + one notes field; their
      notes value is unaffected (body is absent on those kinds, so `notes ?? body` === `notes`).
    - ServicePrintLayout renders `notes ?? body` for MESSAGE/ANNOUNCEMENTS/MISC (a notes-only slot
      prints its notes; a legacy body-only slot still prints its body).
    - Planning Center export sends `bodyDescription(slot.notes ?? slot.body)` for
      ANNOUNCEMENTS/MISC/MESSAGE (a notes-only slot exports its notes; a legacy body-only slot still
      exports its body; MESSAGE's sermonPassage fallback is preserved).
  </behavior>
  <action>
    Introduce a small helper `slotFreeText(slot: ServiceSlot): string | undefined` returning
    `slot.notes ?? (slot as NonAssignableSlot).body` (safe for all kinds: body is undefined on
    non-NonAssignable slots, so the expression collapses to `slot.notes` there). Introduce
    `notesPlaceholder(slot: ServiceSlot): string` returning a per-kind placeholder — PRAYER "Who is
    praying? (optional notes)", ANNOUNCEMENTS "Church-wide announcements", MESSAGE "Message notes or
    outline", MISC "Details", and for the selector kinds the existing "Notes (e.g. who leads, who
    sings which parts)" text; you may reuse/extend the existing `bodyPlaceholder` map.

    In ServiceEditorView.vue: (1) DELETE the MESSAGE/ANNOUNCEMENTS/MISC shared `<textarea>` editor
    block and its viewer `slot-body-text`/`slot-body-empty` paragraphs (:1106–1117), leaving that kind
    block with only its label/hint. (2) DELETE PRAYER's editor linkLabel/linkUrl inputs and the
    external-link anchor (:1056–1084) AND the PRAYER viewer link block (:1085–1093), leaving PRAYER
    with only its label/hint. (3) In the shared notes field (:1173–1184), bind the editor input
    `:value="slotFreeText(slot)"` (keep `@input` writing `slot.notes = value || undefined`), set
    `:placeholder="notesPlaceholder(slot)"`, and change the viewer branch to
    `v-else-if="slotFreeText(slot)"` displaying `{{ slotFreeText(slot) }}`. Keep the existing
    `data-testid="slot-notes-input"` and `slot-notes-text`. Keep plain-text only: `:value` +
    interpolation, never `v-html` (T-54-01). Do NOT remove `body`/`linkUrl`/`linkLabel` from
    `src/types/service.ts` — data retained.

    In ServicePrintLayout.vue: change the MESSAGE/ANNOUNCEMENTS/MISC render conditions and text
    (:64–83) from `slot.body` to `slot.notes ?? slot.body` (both the `v-if` trim-guard and the
    interpolated `{{ }}`). Leave the PRAYER branch (:53–55) unchanged.

    In planningCenterApi.ts: change the three `bodyDescription(slot.body)` call sites — ANNOUNCEMENTS
    (:1019), MISC (:1029), and MESSAGE's `const description` (:1040) — to
    `bodyDescription(slot.notes ?? slot.body)`. Preserve MESSAGE's `?? (sermonPassage ? ... )` fallback
    exactly. Leave the PRAYER branch (:1007–1013) unchanged (planner decision: no new PRAYER data-flow).

    Update tests in lockstep: in ServiceEditorView.test.ts, migrate the body-input cases (E-09 :2306,
    E-11 :2331, E-12 :2359 and any using `slot-body-input`/`slot-body-text`/`slot-body-empty`) to the
    consolidated field — query `slot-notes-input`, assert typing writes `slots[n].notes` (not `.body`),
    assert a slot mounted with only `body` shows that text via the field's value, and assert
    linkUrl/linkLabel survive. In planningCenterApi.test.ts and ServicePrintLayout.test.ts, add/adjust
    cases so a slot with `notes` exports/prints its notes, a legacy `body`-only slot still
    exports/prints its body, and MESSAGE's sermonPassage fallback still applies when both are absent.
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run --dir src --exclude '**/rules.test.ts' src/views/__tests__/ServiceEditorView.test.ts src/components/__tests__/ServicePrintLayout.test.ts src/utils/__tests__/planningCenterApi.test.ts</automated>
  </verify>
  <done>Plain kinds render exactly one free-text field; that field reads `notes ?? body` and writes `notes`; print + PC export read `notes ?? body` for the three body kinds; `body`/`linkUrl`/`linkLabel` remain on the type; type-check clean and the three updated test files pass.</done>
</task>

<task type="auto">
  <name>Task 2 (deliverable C): Per-row ⋯ menu owns Move-to-section + Delete; remove inline section select and ✕</name>
  <files>src/views/ServiceEditorView.vue, src/views/__tests__/ServiceEditorView.test.ts</files>
  <action>
    Replace the inline section `<select data-testid="section-select">` (:1194–1204) and the inline ✕
    remove button (:1207–1217) with a single editor-only ⋯ (three-dot) menu, gated `v-if="canEditService"`.
    Mirror the ARIA-menu pattern in `src/components/slides/SlideActionMenu.vue` INLINE within this file
    (do not import that slide-specific component): a `class="relative"` wrapper (`flex-shrink-0`);
    a trigger `<button>` with the three-dot SVG, `@click.stop`, `aria-haspopup="menu"`,
    `:aria-expanded`, `data-testid="row-menu-trigger-${slot.id}"`; a `fixed inset-0 z-10` backdrop
    `<div v-if=open @click=close>` for outside-click close; and an `absolute right-0 top-full` panel
    `role="menu"` (`data-testid="row-menu-panel-${slot.id}"`) holding: a "Move to section" group whose
    items are the section choices — a "No section" item plus one per `SERVICE_SECTIONS`
    (`SERVICE_SECTION_LABELS[s]`), each `role="menuitem"` calling `onSectionChange(index, s === noSection ? '' : s)`
    and then closing, with `data-testid="row-menu-move-${slot.id}-${value}"` (use `no-section` for the
    empty value) — followed by a destructive Delete item (`text-red-400`) calling `removeSlot(index)`
    then closing, `data-testid="row-menu-delete-${slot.id}"`.

    Add per-row open state: `const openRowMenuId = ref<string | null>(null)` and
    `function toggleRowMenu(id: string) { openRowMenuId.value = openRowMenuId.value === id ? null : id }`,
    keyed on `slot.id` (stable) so exactly one menu is open at a time — the single-open pattern
    SlideGrid uses. The trigger toggles; the backdrop and each menuitem close (set to null). Because
    the menu lives INSIDE the `.slot-item` row (the Sortable ITEM, not a Sortable container) it is not
    itself a draggable member — the popover is only open on click and closes on outside-click, so it
    never interferes with a drag. Do NOT change `onSectionChange` or `removeSlot` — reuse them as-is,
    preserving the existing delete-confirm flow and the section-major reindex.

    Update ServiceEditorView.test.ts: the section-change test (:1655–1680) that drives
    `[data-testid="section-select"]` must instead open the ⋯ menu
    (`row-menu-trigger-<slotId>`) and click the target `row-menu-move-<slotId>-<value>` item, then
    assert the SAME reindex/placement result. The locked-branch test asserting `section-select` is
    absent (:1757) stays valid (it is gone for everyone now); add an assertion that the ⋯ menu trigger
    is likewise absent when `!canEditService`. Add a focused test: opening a row's ⋯ menu and clicking
    Delete calls the remove flow (row count drops or the delete-confirm opens), and clicking a
    Move-to-section item reassigns `slot.section`.
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run --dir src --exclude '**/rules.test.ts' src/views/__tests__/ServiceEditorView.test.ts</automated>
  </verify>
  <done>No inline section `<select>` or inline ✕ remains; each editor row has a ⋯ menu whose Move-to-section items call `onSectionChange` and whose Delete item calls `removeSlot`; the menu is absent for viewers/locked; menu closes on outside-click and selection; type-check clean and ServiceEditorView tests pass.</done>
</task>

<task type="auto">
  <name>Task 3 (deliverable B): Three-rail stacked row layout + colored badge rail + capped column + mobile stack</name>
  <files>src/views/ServiceEditorView.vue, src/views/__tests__/ServiceEditorView.test.ts</files>
  <action>
    Restructure the `.slot-item` row (:880–1218) from
    `[handle] · [.flex-1 content with sm:flex-row side-by-side notes] · [⋯ menu]` into four
    top-aligned (`items-start`) horizontal zones, and cap the list column. PRESERVE on the row root:
    the `.slot-item` class, `data-testid="slot-${index}"`, `data-slot-id="${slot.id}"`, and the
    `.drag-handle` element (`v-if="canEditService"`) — Sortable and tests depend on all four.

    Zones: (1) drag handle — unchanged, far left. (2) Badge rail — `flex-none w-32`, holding ONE
    colored per-kind pill: uppercase `text-[10px] tracking-wider`, rounded, subtle bg+border, text =
    `slotLabel(slot, index)`, classes from a new central helper `kindBadgeClass(kind: SlotKind): string`
    mapping (muted/dark, on-theme per DESIGN-SPEC): SONG `bg-indigo-950 border border-indigo-800
    text-indigo-300`; SCRIPTURE `bg-cyan-950 border border-cyan-800 text-cyan-300`;
    ANNOUNCEMENTS+MESSAGE `bg-rose-950 border border-rose-900 text-rose-300`; PRAYER+MISC
    `bg-gray-800 border border-gray-600 text-gray-300`; HYMN `bg-amber-950 border border-amber-900
    text-amber-300`; IMPORTED `bg-gray-800 border border-gray-700 text-gray-400`. This badge REPLACES
    the per-kind inline `slotLabel` `<p>` headings inside each kind block — remove those headings.
    Keep SONG's `SongBadge` (vwTypes) inside the field column near the song display. The redundant
    "No assignment needed" hint may be dropped. (3) Field column — `flex-1 min-w-0 flex flex-col gap-2`:
    first the kind's selector/content (the existing per-kind chain, unchanged internally — song
    picker/display, scripture input, hymn inputs, imported, or nothing for plain kinds), then the
    consolidated free-text field (the notes-canonical field from Task 1). WALK BACK Phase 54's
    side-by-side: delete the `flex flex-col sm:flex-row sm:items-start` wrapper (:903) and the
    `sm:w-64 flex-shrink-0` notes column (:1173) — the notes field becomes full-width, stacked in the
    field column. (4) Action rail — `flex-none` right-aligned (`flex justify-end`), top-aligned,
    holding the Task-2 ⋯ menu (move its `relative` wrapper here). Optional decorative per-slot
    slide-count `text-[11px] text-gray-500` is at your discretion; omit unless trivial.

    Cap the item-list column: apply `max-w-[1060px]` on the list/flow container (the `space-y-1.5`
    wrapper around `slotSectionGroups`, near :792), NOT on each row.

    Mobile (below `sm`): each row collapses to a single vertical stack — top line = drag handle ·
    badge · spacer · (optional slide-count) · ⋯ menu on one row; then the selector/content field
    full-width; then the notes field full-width. Use Tailwind responsive utilities (the
    QuarterView/Phase-48 recipe): the four zones are `flex-col` below `sm` and the three-rail
    `flex-row items-start` at `sm` and up. No horizontal scrolling; tap targets ≥ ~34px.

    PRESERVE every `v-if="canEditService"` gate and viewer/locked branch inside each kind block
    (CLASS A/B semantics), the `data-scripture-slot-index` attribute, and all existing kind-content
    testids. Update ServiceEditorView.test.ts only where markup structure changed: add a case asserting
    a row renders its per-kind badge (e.g. a badge element carrying `kindBadgeClass` output / the kind
    label) and that the notes field is no longer inside an `sm:w-64` column; fix any selector that
    depended on the removed inline label `<p>` or the side-by-side wrapper.
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run --dir src --exclude '**/rules.test.ts' src/views/__tests__/ServiceEditorView.test.ts</automated>
  </verify>
  <done>Every row is a three-rail layout (handle · w-32 badge rail · stacked field column · right action rail) capped at max-w-[1060px], single-stack below sm; per-kind colored badge via `kindBadgeClass`; notes field full-width stacked (no sm:flex-row / sm:w-64); `.slot-item`/`data-testid=slot-N`/`data-slot-id`/`.drag-handle` preserved; all canEditService gates and viewer branches intact; type-check clean and tests pass.</done>
</task>

<task type="auto">
  <name>Task 4 (deliverable D): Muted/dashed "No Section" band for the ungrouped bucket</name>
  <files>src/views/ServiceEditorView.vue, src/views/__tests__/ServiceEditorView.test.ts</files>
  <action>
    Give the trailing ungrouped/legacy bucket (the `slotSectionGroups` entry with
    `key: 'ungrouped', label: null`, pushed only when non-empty at :1788) a header band, styled
    muted/dashed to read "not placed yet" and clearly distinct from the last real section
    (Post-Service). Render it ONLY for the ungrouped group and ONLY when its `entries.length > 0`
    (already guaranteed by the push condition, but guard in the template too).

    In the `<template v-for="group in slotSectionGroups">` block: today the real-section header
    (:806) is gated `v-if="group.label"`, so the ungrouped group renders no header. Add a sibling
    band rendered when `group.key === 'ungrouped'` (i.e. `!group.label`): a muted/dashed row
    (e.g. `border border-dashed border-gray-700 text-gray-500`, aligned to the section-header
    rhythm) with the label text "No Section" and `data-testid="no-section-band"`. Do NOT reuse the
    `section-header-${group.key}` testid and do NOT add a slide-count or add-item control to it —
    keep it distinct so the existing "exactly 5 `section-header-*`" and "no
    `section-slide-count-ungrouped`" assertions (:1811–1830) stay valid. Do not alter the ungrouped
    list container (`data-testid="section-list-ungrouped"`) or its Sortable wiring.

    Update ServiceEditorView.test.ts: add a case asserting `no-section-band` renders (with its label)
    when a legacy/ungrouped slot is present, and is absent when every slot is sectioned. Confirm the
    existing five-header and ungrouped-has-no-count/add-item assertions still hold.
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run --dir src --exclude '**/rules.test.ts' src/views/__tests__/ServiceEditorView.test.ts</automated>
  </verify>
  <done>When the ungrouped bucket is non-empty a muted/dashed `no-section-band` labeled "No Section" renders above its items, distinct from the real section headers (no count, no add-item, distinct testid); absent when all items are sectioned; the five real section headers and their assertions are unchanged; type-check clean and tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| viewer/locked → editor controls | A non-editor (viewer, or editor on a locked service) must never reach editor-only mutations (section-change, delete, field edits). |
| user text → rendered DOM | Free-text notes/body are user-supplied and rendered in the editor, print, and PC export. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-vsr-01 | Elevation of Privilege | Per-row ⋯ menu (trigger + Move-to-section + Delete) | high | mitigate | Gate the ⋯ trigger AND every menu item with `v-if="canEditService"`, exactly as the removed inline `<select>`/✕ were gated (CLASS A). Task 2 test asserts the trigger is absent when `!canEditService`. |
| T-vsr-02 | Tampering / Information Disclosure (XSS) | Consolidated free-text field (editor + viewer) and print/PC read paths | medium | mitigate | Plain text only: `:value` binding + `{{ }}` interpolation (auto-escape) everywhere; never `v-html` (existing T-54-01 rule). No new sink introduced — same rendering discipline as the fields being consolidated. |
| T-vsr-03 | Tampering (data loss) | notes-canonical migration | medium | mitigate | Non-destructive: read `notes ?? body`, write `notes` only; `body`/`linkUrl`/`linkLabel` retained on the type and never cleared; a stored `linkUrl`/`linkLabel` on the same slot survives an edit (asserted by Task 1's E-11-derived test). No data migration written. |

No package installs, no new external dependencies, no network/trust-boundary additions — layout +
markup + read-path redirect only.
</threat_model>

<verification>
Run after all four tasks:
- `npm run type-check` (vue-tsc --build — the CLAUDE.md gate; it typechecks test files too) is clean.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` is green at the 2-file known-failing baseline
  ONLY (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`). Any other failure is a
  regression to fix before done.
- Spot-confirm no consumer still reads bare `slot.body` for plain kinds: ServicePrintLayout and
  planningCenterApi read `notes ?? body`; ServiceEditorView's consolidated field reads
  `slotFreeText(slot)`.
</verification>

<success_criteria>
- Plain kinds (Prayer/Misc/Announcements/Message) render exactly ONE free-text field; it reads
  `notes ?? body` and writes `notes`; legacy body-only items still display, print, and export.
- Rows are the capped three-rail layout with per-kind colored badges, stacked full-width notes, and a
  right-aligned action rail; single-stack on mobile.
- The per-row ⋯ menu (editor-only) owns Move-to-section (→ `onSectionChange`) and Delete
  (→ `removeSlot`); no inline `<select>` or ✕ remains.
- A muted/dashed "No Section" band labels the ungrouped bucket when non-empty.
- All `canEditService` gates and viewer/locked branches preserved; `body`/`linkUrl`/`linkLabel`
  retained on the type and in Firestore; Sortable/drag wiring, `slotLabel`, `groupBySection`, the
  add-to-service palette and per-section add-item menus all intact.
- type-check clean; app suite green at the 2-file baseline.
- Owner visual verification (feel/spacing of the redesign, mobile) is DEFERRED per the v1.6 standing
  autonomy grant — record it in `.planning/PENDING-VERIFICATION.md`, do not treat it as a blocking
  checkpoint, and do not self-approve it.
</success_criteria>

<output>
Create `.planning/quick/260811-vsr-service-editor-ui-pass-consolidate-redun/260811-vsr-SUMMARY.md` when done.
</output>
