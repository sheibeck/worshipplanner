---
phase: 107-visual-stage-layout
plan: 01
subsystem: ui
tags: [vue3, typescript, tailwind, vitest, tdd, stage-plot, geometry]

# Dependency graph
requires: []
provides:
  - "StageMarker type + additive optional Service.stageLayout field (no migration, stripUndefined-safe)"
  - "Pure geometry helpers (src/utils/stageLayout.ts): clampPct, pctWithinRect, zoneFromPoint, createMarker, markerKindAccentClass, MARKER_KINDS"
  - "Shared read-only StageLayoutView.vue (props-only, no store/Firebase import) reusable across editor-locked, share, and print surfaces"
  - "Resolved Phase-104 STAGELAYOUTS-RESET-OBLIGATION marker in src/stores/orgScopedStores.ts (R312 satisfied by the services store, no new store)"
affects: [107-02-drag-editor, 107-03-share-print]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Percentage-coordinate storage (xPct/yPct in [0,100] of a zone box) for resize-stable, reload-exact drag positions (R314) — no pixel storage, no resize recompute step"
    - "Static literal Tailwind class strings per kind/theme (markerKindAccentClass) to keep Tailwind v4 purge-safe, mirroring kindBadgeClass() in slotTypes.ts"
    - "Additive optional field on an existing document (Service.stageLayout) instead of a new collection/store, mirroring messaging/notes/loop lifecycle"

key-files:
  created:
    - src/utils/stageLayout.ts
    - src/utils/__tests__/stageLayout.test.ts
    - src/components/stage/StageLayoutView.vue
    - src/components/stage/__tests__/StageLayoutView.test.ts
  modified:
    - src/types/service.ts
    - src/stores/orgScopedStores.ts

key-decisions:
  - "StageMarker.kind is optional and omitted entirely (never kind: undefined) when unset, matching the codebase's absent-key convention (createSlot precedent)"
  - "markerKindAccentClass returns complete literal class strings per kind x theme branch (no string concatenation) for Tailwind v4 purge safety"
  - "STAGELAYOUTS-RESET-OBLIGATION token retained verbatim in orgScopedStores.ts (Phase 104 verification greps for it), rewritten to a RESOLVED note rather than removed"

patterns-established:
  - "Pattern: percentage-based drag-position storage for any future freeform canvas surface in this app"
  - "Pattern: one shared read-only rendering component consumed by editor-locked, share, and print contexts via a theme prop"

requirements-completed: [R313, R314, R315]

coverage:
  - id: D1
    description: "StageMarker type + additive optional Service.stageLayout field compiles with no migration required"
    requirement: "R313"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build over src + tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pure geometry helpers prove clamp, within-zone percentage conversion, pct<->pixel round-trip stability, and zone containment with fallback"
    requirement: "R314"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/stageLayout.test.ts (22 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "One shared read-only StageLayoutView renders the two-zone plot from percentages, is XSS-safe, and switches dark/light by theme prop"
    requirement: "R315"
    verification:
      - kind: unit
        ref: "src/components/stage/__tests__/StageLayoutView.test.ts (9 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase-104 STAGELAYOUTS-RESET-OBLIGATION marker resolved to a note; no new org-scoped store introduced (R312 covered by the services store)"
    verification:
      - kind: unit
        ref: "grep -q 'STAGELAYOUTS-RESET-OBLIGATION' src/stores/orgScopedStores.ts && grep -q 'RESOLVED' src/stores/orgScopedStores.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-09-01
status: complete
---

# Phase 107 Plan 01: Visual Stage Layout Foundation Summary

**Additive `Service.stageLayout` field + percentage-based geometry helpers + one shared read-only `StageLayoutView.vue`, laying the resize-stable foundation for the drag editor (Plan 02) and share/print render (Plan 03).**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-01T08:39:30Z (approx, first commit 08:40:19Z)
- **Completed:** 2026-09-01T08:45:16Z
- **Tasks:** 3
- **Files modified:** 6 (2 modified, 4 created)

## Accomplishments
- `StageMarker` type (`id`, `label`, `kind?`, `zone`, `xPct`, `yPct`) exported from `src/types/service.ts`, with an additive/optional `Service.stageLayout?: { elements: StageMarker[] }` field — absent = old behavior, emptied → `undefined` and dropped by the existing `stripUndefined` save path, no migration.
- Resolved the Phase-104 `STAGELAYOUTS-RESET-OBLIGATION` marker in `src/stores/orgScopedStores.ts`: rewrote it from a forward-obligation TODO into a RESOLVED note documenting that the layout lives on the service doc (owned by the already-reset `useServiceStore()`), so R312 is satisfied with no new org-scoped store and no code change to `resetOrgScopedStores()`.
- Pure, dependency-free geometry helpers in `src/utils/stageLayout.ts`: `clampPct`, `pctWithinRect` (with a proven pct→pixel→pct round-trip property, R314), `zoneFromPoint` (bounding-rect containment with a fallback-zone for drops outside any zone), `createMarker` (kind key omitted when absent), `markerKindAccentClass` (static literal Tailwind classes per kind/theme), and the `MARKER_KINDS` tuple. 22 unit tests, TDD RED→GREEN.
- The one shared read-only `StageLayoutView.vue`: renders two zone containers ("ON STAGE" / "OFF STAGE (SIDE)") with one chip per marker at `left: {xPct}%; top: {yPct}%`, no drag/edit/delete/add-marker affordances, labels bound via text interpolation only (proven XSS-safe against a markup-bearing label), dark theme by default with a `theme="light"` variant for ShareView/print. No Pinia/Firebase import — safe for the public unauthenticated ShareView. 9 render tests, TDD RED→GREEN.

## Task Commits

Each task was committed atomically:

1. **Task 1: StageMarker type + optional Service.stageLayout field + resolve the orgScopedStores marker** - `7c82f7f1` (feat)
2. **Task 2: Pure stage-layout geometry helpers with unit tests** - `1d346f0b` (test, RED) → `f5c7f3e4` (feat, GREEN)
3. **Task 3: Shared read-only StageLayoutView renderer** - `38ac164a` (test, RED) → `e412daf9` (feat, GREEN)

**Plan metadata:** (this commit)

_TDD tasks each have a test → feat commit pair; no refactor step was needed for either (implementation was already clean at GREEN)._

## Files Created/Modified
- `src/types/service.ts` - Added `StageMarker` interface and additive optional `Service.stageLayout` field
- `src/stores/orgScopedStores.ts` - Rewrote the `STAGELAYOUTS-RESET-OBLIGATION` comment block to a RESOLVED note; no teardown call added
- `src/utils/stageLayout.ts` - Pure geometry/factory helpers (clampPct, pctWithinRect, zoneFromPoint, createMarker, markerKindAccentClass, MARKER_KINDS)
- `src/utils/__tests__/stageLayout.test.ts` - 22 unit tests covering every helper behavior including the R314 round-trip property
- `src/components/stage/StageLayoutView.vue` - Shared read-only two-zone stage-plot renderer
- `src/components/stage/__tests__/StageLayoutView.test.ts` - 9 render tests including the XSS-safe-label and no-affordances assertions

## Decisions Made
- Followed 107-CONTEXT.md's storage decision exactly: additive field on `Service`, not a new `stageLayouts` collection/store — this is what let the Phase-104 obligation resolve with zero new store code.
- `createMarker` clamps `xPct`/`yPct` defensively via `clampPct` even though the plan's behavior spec didn't explicitly require it — cheap, harmless when the input is already in range, and consistent with the module's own invariant that every stored position is in `[0,100]`.
- `markerKindAccentClass`'s light-theme tint values (`-100`/`-300`/`-700` per hue family) were not pinned to an exact literal in 107-CONTEXT.md/UI-SPEC beyond "lighter-tint equivalents" — chose the standard Tailwind `-100` background / `-300` border / `-700` text triad per hue, consistent with the app's existing light-mode conventions (ShareView's `bg-gray-50 border-gray-200`-style pairing). Plan 03 (ShareView/print) can adjust the exact light-tint literals if a closer visual match is needed; the function signature and dark-theme values (which ARE pinned exactly in 107-UI-SPEC's kind table) are unaffected.

## Deviations from Plan

None - plan executed exactly as written. Both TDD tasks followed RED → GREEN with no auto-fixes needed; Task 1 needed no test scaffold (not marked `tdd="true"`) and passed type-check on the first attempt.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (drag editor, wave 2) can now import `StageMarker`, `Service.stageLayout`, every helper in `src/utils/stageLayout.ts`, and reuse `StageLayoutView.vue` directly for its locked-service read-only state — no further foundation work needed.
- Plan 03 (share/print, wave 2) can mount `StageLayoutView.vue` on the public `ShareView.vue` and the print layout with `theme="light"` — confirmed dependency-light (no store/Firebase import) so it is safe on the unauthenticated public page.
- Both wave-2 plans build against a settled type + component; no blockers identified.

---
*Phase: 107-visual-stage-layout*
*Completed: 2026-09-01*

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; all 5 task/gate commit hashes confirmed in `git log`.
