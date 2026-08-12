# Phase 57: Template-Editor UX Parity - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning
**Mode:** Autonomous (owner scope addition; standing v1.6 grant — auto-decide grey areas, defer human
verification, STOP before milestone lifecycle, no deploys)

<domain>
## Phase Boundary

Apply the just-shipped Service Order redesign (quick task 260811-vsr) to the **Edit Default Template**
screen so it looks and feels consistent with the live service editor (R129). `ServiceTemplateEditor.vue`
today mirrors the *pre-redesign* `ServiceEditorView.vue` pattern (inline section `<select>` + inline ✕
remove, ungrouped bucket with no header, per-kind inline label headings). This phase brings it to
parity with the *post-redesign* service editor:

- Unified **three-rail rows**: drag handle · colored per-kind **badge** rail · stacked **field column** ·
  **action rail** with a per-row **⋯ menu**.
- The per-row **⋯ menu owns Move-to-section + Delete** — remove the inline `template-section-select`
  and the inline `template-item-remove` ✕.
- A muted/dashed **"No Section" band** for the ungrouped/legacy bucket (today it has no header).
- **Colored per-kind badges** (the same `kindBadgeClass` mapping the service editor now uses) and
  **mobile-friendly stacking**.

**Visual/structural parity only — no behavior change.** All template-editor functionality is preserved:
SortableJS per-section reorder + cross-section drag (the `templateRenderNonce` rebuild), add-item
palette, the MISC **label** input (added in Phase 56), the MISC/ANNOUNCEMENTS **body** input, section
assignment, reset, and save.

</domain>

<decisions>
## Implementation Decisions

- **Source of truth = 260811-vsr.** Mirror `.planning/quick/260811-vsr-service-editor-ui-pass-consolidate-redun/260811-vsr-DESIGN-SPEC.md`
  and `...-SUMMARY.md`, and the *implemented* result in `ServiceEditorView.vue` (the three-rail row,
  `kindBadgeClass`, the per-row ⋯ menu pattern, the No-Section band). Keep the app's dark **indigo**
  Tailwind theme — no foreign palette, no `max-w-[1060px]` cap (that cap was removed from the service
  editor on owner feedback 2026-08-12; do NOT reintroduce it here).
- **Share, don't fork, `kindBadgeClass`.** The service editor's per-kind badge class helper should be
  **extracted to a shared location** (e.g. `src/utils/slotTypes.ts`, beside `slotLabel`) and imported by
  BOTH `ServiceEditorView.vue` and `ServiceTemplateEditor.vue`, so the two screens can never drift.
  Planner: confirm where `kindBadgeClass` currently lives (added to ServiceEditorView in 260811-vsr) and
  extract it; update the service editor to import the shared version (behavior-identical).
- **Per-row ⋯ menu** replaces the inline `template-section-select` (:139) and inline `template-item-remove`
  (:157): items are **Move to section →** (the same `SERVICE_SECTIONS` + "No section" set, calling the
  existing `onSectionChange`-equivalent `changeSection`/handler) and **Delete** (calling the existing
  `removeEntry(entry.id)`). Mirror the service editor's ⋯ menu (single-open state keyed on `entry.id`,
  backdrop + `role="menu"` panel, `data-testid`s). No lock gating needed (the template editor has no
  draft/lifecycle lock) — but keep whatever edit-gating the component already applies.
- **Field column per kind (template semantics — simpler than the live editor):** template entries carry
  only `{ id, kind, section?, label?, body? }` — there are NO song/scripture pickers here. So the field
  column shows: for **MISC** the `label` input (its name, default "Miscellaneous" placeholder) + the
  `body` input; for **ANNOUNCEMENTS** the `body` input; for other kinds (SONG/SCRIPTURE/PRAYER/MESSAGE/
  HYMN/IMPORTED) just the badge names it (no content field in a template). The template editor already
  has a SINGLE field per kind (no notes-vs-body redundancy to consolidate) — this phase RESTYLES that
  into the field column, it does not add or remove fields. Keep the existing `entryDisplayName`/MISC
  label display.
- **"No Section" band:** the ungrouped `sectionGroups` bucket (`group.label` falsy) gets a muted/dashed
  header labeled "No Section", distinct from the real `template-section-header-*` headers (own testid,
  e.g. `template-no-section-band`; no count/add control), rendered only when non-empty. Mirror the
  service editor's `no-section-band`.

### Claude's Discretion
- Exact badge extraction location + shared helper name, the ⋯-menu markup details, precise spacing of
  the template three-rail row, and the No-Section band wording/testid — all at planner/executor
  discretion, subject to: share `kindBadgeClass`, ⋯ owns move+delete, No-Section band present, no
  behavior/data change, app indigo theme, no width cap.

</decisions>

<code_context>
## Existing Code Insights (verified 2026-08-12)

- `src/components/settings/ServiceTemplateEditor.vue` (527 lines): section groups `sectionGroups` (:347,
  `groupBySection` over `draft` with a trailing unlabeled bucket); section header `:62` (`v-if="group.label"`,
  `template-section-header-${group.key}`); section list `:72` (`template-section-list-${group.key}`,
  `data-section`); empty placeholder `:81`; per-entry row `v-for="entry in group.entries"` `:90` with
  `.drag-handle` `:98`; MISC label input `:115`; MISC/ANNOUNCEMENTS body input `:128`; inline section
  `<select data-testid="template-section-select">` `:139`; inline remove `data-testid="template-item-remove"
  @click="removeEntry(entry.id)"` `:157`.
- Script: `Sortable` (:240); helpers imported from `@/utils/slotTypes` (:243) — `slotLabel`, `createSlot`,
  `groupBySection`, `flattenBySection`, `buildSuggestedTemplateEntries`; `templateKindLabel` `:262`
  (wraps `slotLabel(createSlot(kind))`); `addEntry` `:303`; `removeEntry` `:306`; section-change handler
  `:313`; `entryDisplayName` `:338` (MISC label); `templateRenderNonce` (cross-section drag rebuild).
- `ServiceTemplateEntry` shape: `{ id, kind, section?, label?, body? }` — `label?`/`body?` added by Phase
  52/56 (`src/types/organization.ts`).
- Parity target (already implemented): `src/views/ServiceEditorView.vue` three-rail row, `kindBadgeClass`
  helper, per-row ⋯ menu (`row-menu-trigger-*`/`row-menu-panel-*`/`row-menu-move-*`/`row-menu-delete-*`),
  `no-section-band`. Tests: `src/components/settings/__tests__/ServiceTemplateEditor.test.ts` (drives
  `template-section-select`/`template-item-remove` today — migrate to the ⋯ menu in lockstep).

</code_context>

<specifics>
## Specific Ideas / Owner Words

- "the updates we did for the Service Edit screen for the UX, we need to apply similar treatment to the
  Edit Default Template screen. And the changes for Miscellaneous label should also apply to that." (The
  MISC label already landed in Phase 56; this phase is the visual/UX parity.)
- The design is directional, not prescriptive — keep template-editor features the mockup doesn't show
  (SortableJS reorder, add-item palette, reset), exactly as the service editor kept its features.

</specifics>

<deferred>
## Deferred / Out of Scope
- No behavior/data changes — purely visual/structural parity. `ServiceTemplateEntry` shape unchanged.
- Owner visual verification DEFERRED per the standing grant (record in PENDING-VERIFICATION.md).
</deferred>
