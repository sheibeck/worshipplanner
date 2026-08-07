# Phase 44: Default Service Template - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas proposed in batch, owner accepted with one override

<domain>
## Phase Boundary

A church defines, in Settings, the default set and order of items that make up a new blank service,
and every new blank service is built from that template. The template stores **item types and their
section/order only** — never chosen content (no specific song, scripture, or body text). Vertical
Worship typing is computed at service-creation time from the church's chosen progression and is
**never** frozen into the stored template.

In scope: the `OrgSettings` template field + its default, the Settings "Services" template editor,
and new-blank-service creation reading the template. Out of scope: retro-applying a template to
existing services, and any per-service template override.
</domain>

<decisions>
## Implementation Decisions

### Area 1 — Template storage & shape
- **Storage:** a new `defaultServiceTemplate` field on `OrgSettings` (`src/types/organization.ts`),
  merged through the single existing merge point in `auth.ts::loadOrgContext` under
  `DEFAULT_ORG_SETTINGS`. This is the field the `OrgSettings` JSDoc already anticipates ("Phase 44's
  default service template"). No second defaults-merge point may be introduced — same contract Phases
  39/45/46 follow.
- **Entry shape:** each template entry holds `{ kind, section }` only — the item's `SlotKind` (from
  Phase 43's finalized palette) and its `ServiceSection`. **No chosen content** (no songId, scripture
  reference, or body) is stored in the template.
- **Order:** array order **is** the creation/display order; concrete `position` values are derived at
  service-creation time (mirroring how `buildSlots` assigns positions), not stored in the template.
- **⚠ OVERRIDE (owner, 2026-08-07) — fallback when no template is set:** default to an **EMPTY
  service**, NOT `buildSlots(progression)`. This **supersedes R087's "`buildSlots()` becomes the
  fallback" clause and ROADMAP success criterion #2** — corrected, dated, in REQUIREMENTS.md/ROADMAP.md
  this phase. `buildSlots`' 1-2-3 content is repurposed as the **"Reset to 1-2-3 default"** preset the
  editor can load (see Area 2), rather than an automatic fallback.
  - **Disclosed implication:** on ship, every existing church (none has a configured template yet) gets
    an **empty** new service instead of today's automatic 1-2-3 — until it configures a template or
    clicks "Reset to 1-2-3 default." Owner accepted this knowingly.

### Area 2 — Settings editor UX
- **Location:** a new **Services** section in `SettingsView.vue`, opening a **slide-out editor** that
  reuses existing slot primitives (consistent with the success criterion).
- **Build the list:** reuse **Phase 43's finalized add-item palette** to add items, existing
  **SortableJS drag-reorder** to order them, and a per-item remove.
- **Section per item:** yes — each template item is assigned to one of the five `ServiceSection`s.
- **Empty / reset:** an empty template is valid; provide a **"Reset to 1-2-3 default"** affordance that
  populates the template with the current `buildSlots` 1-2-3 shape (item types + sections only).

### Area 3 — New-service creation & VW typing
- **Apply when:** only at **new blank service creation** — the create-service action builds slots from
  the template (or empty, per the Area 1 override).
- **VW typing timing (LOCKED by R087 `[ARCH]`):** VW types are computed **at creation** from the
  church's chosen progression (`PROGRESSION_SLOT_TYPES` in `slotTypes.ts`) and are **never** stored in
  the template. Toggling VW mode later never leaves stale types on an already-created service.
- **VW mode off:** template song slots become plain `SONG` (no vwType) at creation.
- **Existing services:** never retro-applied — the template affects only newly created services.

### Claude's Discretion
- Exact `defaultServiceTemplate` TypeScript shape (array element interface name, whether section is a
  required field on each entry), the slide-out component's file placement, and the reset-preset
  derivation mechanics — all at the planner/executor's discretion within the decisions above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/slotTypes.ts` — `buildSlots(progression)` (the current hard-coded 1-2-3 default, becomes
  the reset preset), `PROGRESSION_SLOT_TYPES`, section-default mapping.
- `src/types/organization.ts` — `OrgSettings` (extend with one field + one `DEFAULT_ORG_SETTINGS`
  entry, per its contract JSDoc), `Organization`.
- `src/stores/auth.ts` — `loadOrgContext` (the single OrgSettings defaults-merge point).
- `src/stores/services.ts` — `buildSlots` usage on new-service creation (the call site to reroute).
- `src/views/SettingsView.vue` — the Settings page to add the Services section to.
- Phase 43's add-item palette + slot primitives in `ServiceEditorView.vue` (`createSlot`, `SlotKind`,
  section assignment, SortableJS reorder) — reuse for the template editor.

### Established Patterns
- Nested `OrgSettings` with a single `loadOrgContext` merge; consumers read `authStore.settings.<field>`
  with no local `?? default`.
- SortableJS drag-reorder with `slot.id` keys (per v1.4 RESEARCH — stable id keys, `*DraggableIndex`).
- Section model: the five `ServiceSection`s (incl. Post-Service).

### Integration Points
- `OrgSettings` / `DEFAULT_ORG_SETTINGS` / `loadOrgContext` (storage + defaults).
- New-blank-service creation path in `src/stores/services.ts` (template read + slot build).
- `SettingsView.vue` (new Services section + slide-out editor).
</code_context>

<specifics>
## Specific Ideas

- The empty-service fallback override (Area 1) is the one departure from the ROADMAP/R087 default and is
  the single most important thing planning must honor and the dated requirement-correction must reflect.
- The template must store types/sections only — content-freezing is explicitly prohibited (mirrors the
  R087 [ARCH] "never frozen" discipline applied to content as well as VW types).
</specifics>

<deferred>
## Deferred Ideas

- Retro-applying a template (or offering migration) to existing services — explicitly out of scope.
- Multiple named templates / per-service-type templates — not in this phase.
</deferred>
