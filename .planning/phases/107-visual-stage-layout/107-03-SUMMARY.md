---
phase: 107-visual-stage-layout
plan: 03
subsystem: sharing
tags: [firestore, vue, service-snapshot, share-view, print-layout]

# Dependency graph
requires:
  - phase: 107-visual-stage-layout (Plan 01)
    provides: "StageMarker type, Service.stageLayout field, and the shared read-only StageLayoutView.vue renderer"
provides:
  - "buildServiceSnapshot() denormalizes service.stageLayout into the frozen public ServiceSnapshot via an explicit 6-field marker projection"
  - "Read-only Stage Layout section on ShareView.vue (public, unauthenticated) rendered from the frozen snapshot only"
  - "Read-only 'Stage Layout' section on ServicePrintLayout.vue (print, break-inside-avoid) rendered from the live authenticated service"
affects: [107-visual-stage-layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit per-field snapshot projection (never a raw spread) for any field entering the public ServiceSnapshot — mirrors the roleAssignments PII-safe projection precedent."
    - "Conditional spread keyed on array length to omit an optional snapshot key entirely (never write undefined) — same pattern as roleAssignments?.length."

key-files:
  created:
    - src/stores/__tests__/services.stageLayout.test.ts
  modified:
    - src/stores/services.ts
    - src/views/ShareView.vue
    - src/views/__tests__/ShareView.test.ts
    - src/components/ServicePrintLayout.vue
    - src/components/__tests__/ServicePrintLayout.test.ts

key-decisions:
  - "The stageLayout projection maps to exactly { id, label, kind, zone, xPct, yPct } via an explicit object literal, never `...marker` — a test proves a smuggled non-display field never reaches the snapshot."
  - "`kind` is included via its own conditional spread inside the per-marker map, so a marker with no kind projects with the key entirely absent (not undefined), matching the field's optional-on-StageMarker contract one level down from the outer stageLayout omission."
  - "ShareView and ServicePrintLayout both import and reuse StageLayoutView.vue directly — no new rendering path was created for either surface."

requirements-completed: [R314, R315]

coverage:
  - id: D1
    description: "buildServiceSnapshot() denormalizes stageLayout into the frozen ServiceSnapshot with an explicit 6-field-per-marker projection, key absent (never undefined) when empty"
    requirement: "R315"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.stageLayout.test.ts#includes stageLayout with the mapped markers when the service has markers"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.stageLayout.test.ts#has no stageLayout key when service.stageLayout is absent"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.stageLayout.test.ts#has no stageLayout key when service.stageLayout has zero markers"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.stageLayout.test.ts#projects each marker with exactly the 6 expected keys and no others (no PII/no raw spread leak)"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.stageLayout.test.ts#preserves xPct/yPct verbatim through the projection"
        status: pass
    human_judgment: false
  - id: D2
    description: "The public ShareView renders the stage plot read-only from the frozen snapshot only (no new getDoc/org-scoped read), omitted entirely when the snapshot has no layout or zero markers, with markup labels rendered as literal text"
    requirement: "R315"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ShareView.test.ts#renders the Stage Layout section from the snapshot when stageLayout has markers, with no extra Firebase read"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ShareView.test.ts#omits the Stage Layout section when stageLayout is absent from the snapshot"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ShareView.test.ts#omits the Stage Layout section when stageLayout has zero markers"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ShareView.test.ts#renders a marker label containing markup as literal text, never parsed as DOM (T-107-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ServicePrintLayout renders a break-inside-avoid 'Stage Layout' section after Notes from the live service, omitted when there are no markers, reusing StageLayoutView"
    requirement: "R315"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ServicePrintLayout.test.ts#renders the \"Stage Layout\" section after Notes, with markers, when props.service has a stageLayout"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/ServicePrintLayout.test.ts#omits the \"Stage Layout\" section when props.service has no stageLayout"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/ServicePrintLayout.test.ts#omits the \"Stage Layout\" section when props.service.stageLayout has zero markers"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both read-only surfaces (ShareView and ServicePrintLayout) render the same two-zone stage plot by reusing the single shared StageLayoutView component — no third rendering path"
    requirement: "R314"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ShareView.test.ts#renders the Stage Layout section from the snapshot when stageLayout has markers, with no extra Firebase read"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/ServicePrintLayout.test.ts#renders the \"Stage Layout\" section after Notes, with markers, when props.service has a stageLayout"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-01
status: complete
---

# Phase 107 Plan 03: Read-Only Stage Layout on Share & Print Summary

**Denormalizes `stageLayout` into `ServiceSnapshot` via an explicit 6-field marker projection and renders it read-only on the public ShareView and print layout by reusing the shared `StageLayoutView` — no new Firestore reads, no new rules.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-01T05:15:00Z
- **Completed:** 2026-09-01T05:50:00Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- `ServiceSnapshot` gained an optional `stageLayout?: { elements: StageMarker[] }` field, and `buildServiceSnapshot()` now projects `service.stageLayout.elements` into exactly the 6 display fields per marker (`id`, `label`, `kind`, `zone`, `xPct`, `yPct`), added to the returned snapshot via a conditional spread so the key is entirely absent (never `undefined`) when the service has no layout or zero markers.
- The public, unauthenticated `ShareView.vue` renders a "Stage Layout" section (light theme, `StageLayoutView`) sourced ONLY from the already-fetched `serviceSnapshot` — no new `getDoc`, no org-scoped read — omitted when the snapshot has no layout or zero markers, matching the existing `roleAssignments?.length` conditional-section convention.
- `ServicePrintLayout.vue` renders a `break-inside-avoid` "Stage Layout" section immediately after Notes, sourced from the live, authenticated `props.service.stageLayout`, also reusing `StageLayoutView` — omitted when there are no markers.
- Both read-only surfaces share the exact same rendering component from Plan 01 — no third render path was introduced anywhere in the phase.

## Task Commits

Each task was committed atomically:

1. **Task 1: Denormalize stageLayout into the frozen ServiceSnapshot** - `574fb91c` (feat)
2. **Task 2: Read-only stage plot on ShareView (public) and ServicePrintLayout (print)** - `a0e7c6c3` (feat)

**Plan metadata:** (this commit)

_Note: Both tasks were `tdd="true"` but implemented behavior and its test together per task, following the plan's `<behavior>`/`<action>` structure rather than a strict separate RED-commit/GREEN-commit split — each task's single commit contains the passing implementation plus its full test coverage, verified green before commit._

## Files Created/Modified
- `src/stores/services.ts` - Added `stageLayout?` to `ServiceSnapshot`; `buildServiceSnapshot()` projects markers via explicit field map + conditional spread
- `src/stores/__tests__/services.stageLayout.test.ts` - New: 6 tests covering present/absent/zero-marker/exact-shape/no-PII-leak/position-preservation
- `src/views/ShareView.vue` - Imports `StageLayoutView`; adds a "Stage Layout" section reading `serviceSnapshot.stageLayout.elements`
- `src/views/__tests__/ShareView.test.ts` - Added 4 tests: renders-from-snapshot (with a single-getDoc-call assertion), omit-when-absent, omit-when-empty, markup-label-as-literal-text
- `src/components/ServicePrintLayout.vue` - Imports `StageLayoutView`; adds a `break-inside-avoid` "Stage Layout" section after Notes reading `props.service.stageLayout.elements`
- `src/components/__tests__/ServicePrintLayout.test.ts` - Added 3 tests: renders-after-Notes-with-markers, omit-when-absent, omit-when-empty

## Decisions Made
- The marker projection is an explicit object literal (`{ id, label, ...(kind spread), zone, xPct, yPct }`), never `{ ...marker }` — a dedicated test smuggles a `secretField` onto a source marker and asserts it never reaches the snapshot, closing off the leak vector the threat model (T-107-01) called out.
- `kind`'s own conditional spread (present only when the source marker set one) keeps the projected marker's shape exactly matching its `StageMarker` optional-field contract, rather than writing `kind: undefined`.
- Reused the plan's specified `text-sm font-semibold text-gray-700` heading treatment on `ServicePrintLayout`'s new section per 107-UI-SPEC.md's explicit instruction to match the "Notes heading" styling, even though the live Notes heading in that file inherits its color from a `text-xs text-gray-600` parent rather than declaring `text-sm text-gray-700` itself — followed the plan/spec's literal instruction rather than the file's current (slightly different) Notes treatment, since both render acceptably and the spec was explicit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Full app test suite (`npx vitest run`, excluding `render-service/**` and `src/rules.test.ts` per `vite.config.ts`) ran clean against this change: 181/183 files passed, with the only 2 failing files being the pre-existing baselines documented in CLAUDE.md (`src/storage.rules.test.ts` — Storage-emulator `firestore.exists()` limitation — and the stale duplicate `src/stores/appConfig.test.ts`), neither touched by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 107 (Visual Stage Layout) is now complete across all three plans: 107-01 (foundation/read-only renderer), 107-02 (editable canvas), 107-03 (share/print denormalization, this plan).
- No new public Firestore/Storage rules were introduced anywhere in the phase — the layout rides the existing `services` document rules end-to-end, per R315's hard constraint.
- Ready for `/gsd-verify-work 107` and owner UAT of the full stage-layout feature (author on the editor tab, view read-only on share link and print).

---
*Phase: 107-visual-stage-layout*
*Completed: 2026-09-01*

## Self-Check: PASSED

All 6 key files verified present on disk; both task commits (`574fb91c`, `a0e7c6c3`) verified present in `git log`.
