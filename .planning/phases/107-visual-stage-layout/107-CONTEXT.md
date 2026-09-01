# Phase 107: Visual Stage Layout - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, auto-optimized from v2.7 research STACK/ARCHITECTURE/PITFALLS + owner decisions)

<domain>
## Phase Boundary

A **visual, per-service stage plot** so tech/sound can see at a glance where every instrument, mic, and
monitor goes. On a dedicated **Stage Layout tab** of a service, a user drags labeled markers onto a
**freeform canvas** with **on-stage and off-stage (side) zones**, positions them anywhere, gives each a
**free-text label** (including a one-off speaker's mic), and the layout is **saved per service** and
viewable **read-only** wherever the service is shared/printed. In scope: R313, R314, R315. This is the
app's FIRST freeform drag surface (drag-corruption history in v1.4/v1.6 — build carefully). Out of scope:
any rehearsal/storage/file-upload work; a constrained equipment-icon library; auto-seeding a layout from a
previous service.
</domain>

<decisions>
## Implementation Decisions

### Storage & data model (R315) — the key architecture call
- **Store the stage layout as an ADDITIVE, OPTIONAL field on the SERVICE document** (e.g.
  `stageLayout?: { elements: StageMarker[] }`), NOT a new top-level collection or subcollection. Rationale:
  the service doc already denormalizes slots and is the org-scoped single source of truth; a bounded set of
  ~10–30 tiny marker objects is negligible against the 1MB doc limit. This choice **avoids a new Firestore
  collection, avoids ANY new `firestore.rules` block, and avoids a new Pinia store** — the layout rides the
  service's existing read/write rules, its existing `onSnapshot`, and the existing autosave path.
- **This RESOLVES the Phase-104 `STAGELAYOUTS-RESET-OBLIGATION` marker** in `orgScopedStores.ts`: because
  the layout lives on the service doc (owned by the already-reset services store), a church switch cannot
  leak a prior church's layout — there is no separate store to register. Update/close that marker comment
  accordingly (turn it from a TODO into a resolved note). Confirm no separate org-scoped stage store is
  introduced.
- **StageMarker shape:** `{ id, label: string (free text), kind?: 'instrument'|'mic'|'monitor'|'other',
  zone: 'onstage'|'offstage', xPct: number, yPct: number }`. The **label is the source of truth**; `kind`
  is an optional light visual accent (color/dot/icon-hint), NOT a required constrained picker. Positions
  are **percentages within their zone** (0–100), so they are **resize-stable** (R314) and render correctly
  on any viewport, print, or share page.

### Canvas & interaction (R313, R314)
- **Freeform absolute-positioned DOM + native Pointer Events** — NOT Konva/vue-konva, interactjs, or the
  existing SortableJS list pattern (all wrong-fit per STACK research). Markers are absolutely positioned by
  `xPct/yPct` inside their zone container; drag = pointerdown/pointermove/pointerup updating the percentages.
  Must work with touch (pointer events cover mouse + touch). Clamp positions to [0,100] within the zone.
- **Two zones:** an on-stage area and an off-stage (side) area (owner's church keeps drums/piano off to the
  side), each a drop region; a marker belongs to exactly one zone and its percentages are relative to that
  zone. Moving a marker between zones is allowed (drag across / a zone control).
- **Authoring controls:** add a marker (choose/enter a free-text label, optional kind), edit a marker's
  label/kind, delete a marker; drag to reposition. Include the ability to add a marker labeled for a
  **one-off speaker's microphone** (just a normal free-text marker — no special type needed) (R314).
- **Round-trip integrity (R314):** positions persist and reload exactly; stay stable across a viewport
  resize (guaranteed by percentage coords). Plan explicit tests for save→reload round-trip and a
  resize-stability assertion.

### Tab, lock, and read-only rendering (R313, R315)
- **A dedicated "Stage Layout" tab** on the service editor (alongside Service Order / Slides / Roles),
  consistent with the existing tabbed service UX.
- **Editability follows the service Draft/locked model** (consistent with Service Order/Slides/Roles which
  lock when leaving Draft): editable while Draft, **read-only when the service is locked**, with the
  existing Reopen-for-editing path to change it. (If planning finds the app's lock model doesn't cleanly
  extend here, flag it — but default to matching the existing lock behavior.)
- **Read-only rendering on share + print (R315):** denormalize `stageLayout` into the frozen
  `ServiceSnapshot` via `buildServiceSnapshot()` (mirroring the existing `roleAssignments` PII-safe
  projection), so the public **unauthenticated** share page and the print layout render the plot **read-only
  WITHOUT granting any new org-scoped Firestore/Storage access** (this is the safe pattern the ARCHITECTURE
  research prescribes — never open new public rules for this). A shared/printed layout is view-only:
  positions, labels, kinds, zones — no drag handles, no edit controls.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- The service **type** (src/types/…service…) — additive optional `stageLayout` field.
- The **service editor** with its tabbed UX (Service Order / Slides / Roles tabs) — add the Stage Layout tab
  following the same tab pattern; respect the existing Draft/locked gating used by the other tabs.
- The **autosave path** used by the service editor — stage-layout edits persist through it (like `notes`).
- `buildServiceSnapshot()` / the `ServiceSnapshot` type + `ShareView.vue` + the print layout — the read-only
  projection surface (mirror the `roleAssignments` denormalization for the layout).
- `src/stores/orgScopedStores.ts` — contains the Phase-104 `STAGELAYOUTS-RESET-OBLIGATION` marker to RESOLVE
  (no new store needed; the services store already covers it).

### Established Patterns
- Additive, optional, no-migration model changes (every prior milestone).
- Draft-only editing with an explicit Reopen path; leaving Draft locks the editable service surfaces.
- The public share page reads ONLY the frozen snapshot — never org-scoped collections; denormalize into the
  snapshot instead of widening rules (this is a hard security rule for this app).
- Teleport/absolute positioning conventions already used for overlays.

### Integration Points
- Service editor tab (authoring canvas) → `service.stageLayout` field → existing service save/autosave →
  `buildServiceSnapshot()` denormalization → ShareView + print read-only render.
- `orgScopedStores.ts` marker resolution (R312 obligation closed).
</code_context>

<specifics>
## Specific Ideas

- Owner intent (verbatim): "Ability to create a stage layout for any given service so our sound people know
  what sound equipment to setup … which instruments are going where on the stage, or off the side of the
  stage (our church has drums and piano off the stage on the side). We'll also want to know where any extra
  microphones go for someone who might come up to speak for just one part of the service … a way for us to
  lay this out visually for our tech people. Maybe this is a tab on the service?" → freeform visual canvas,
  on/off-stage zones, free-text markers incl. a one-off speaker mic, a tab on the service.
</specifics>

<deferred>
## Deferred Ideas

- Auto-seeding a new service's stage layout from the org's last-used layout (a P2 differentiator from
  FEATURES.md) — not this phase.
- A constrained equipment-icon library / drag-from-palette of typed gear — free-text labeled markers are the
  agreed approach; an icon library is out of scope.
- Per-marker rotation, monitor mixes / input-list / DI details — DAW-grade stage-plot features are scope creep.
</deferred>
