---
phase: 52-default-service-template
plan: 03
subsystem: ui
tags: [vue, tailwind, service-template, settings, vitest]

# Dependency graph
requires:
  - phase: 44-default-service-template
    provides: ServiceTemplateEditor.vue slide-out + the Settings "Services" card host
  - phase: 51-service-card
    provides: ServicesView.vue as the Services listing host (ServiceCard render site)
provides:
  - Editor-gated cog on the Services page that opens the default-service-template editor (R113)
  - Settings page no longer hosts a Services template card
  - src/views/__tests__/ServicesView.test.ts (first test file for ServicesView)
affects: [52-01, 52-02, verify-work, default-service-template]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Host-agnostic Teleport-to-body slide-out relocated by moving only its trigger + mount"
    - "Editor-gated control via v-if=authStore.isEditor (viewer never sees the cog), matching the sibling New Service button"

key-files:
  created:
    - src/views/__tests__/ServicesView.test.ts
  modified:
    - src/views/ServicesView.vue
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts

key-decisions:
  - "Cog uses v-if (hidden for viewers), not the prior :disabled convention — matches the sibling New Service button (RESEARCH A2 permits either)"
  - "SettingsView test block relocated to a single card-is-gone negative assertion; open/gate/close coverage moved into ServicesView.test.ts (no dropped coverage)"
  - "Removed now-unused body()/DOMWrapper test helper from SettingsView.test.ts to keep vue-tsc --build clean"

patterns-established:
  - "Relocating a Teleport-to-body panel: move trigger + mount + local ref only; component structure untouched"

requirements-completed: [R113]

coverage:
  - id: D1
    description: "Editor-gated cog on the Services page opens the service-template-editor slide-out; a viewer never sees the cog"
    requirement: R113
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServicesView.test.ts#ServicesView default-template cog (R113)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Settings page no longer renders a Services template card (no open-template-editor button, no template-summary)"
    requirement: R113
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView — no Services template card (R113)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-11
status: complete
---

# Phase 52 Plan 03: Relocate default-service-template editor to a Services-page cog Summary

**The default-service-template editor moved off the main Settings page to an editor-gated cog next to "New Service" on the Services page; the editor component is structurally unchanged (only its trigger + mount moved).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-11T16:24Z
- **Completed:** 2026-08-11T16:36Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Added an editor-gated cog (`data-testid="open-template-editor"`, `v-if="authStore.isEditor"`) to the ServicesView action bar, between the flex spacer and the New Service button, plus the `<ServiceTemplateEditor :is-open @close>` mount and a `templateEditorOpen` ref.
- Created `src/views/__tests__/ServicesView.test.ts` (ServicesView's first test file) covering: cog exists for an editor, click opens the teleported slide-out, close control closes it, and the cog is absent for a viewer.
- Removed the Services card, the editor mount, the dead `ServiceTemplateEditor`/`groupBySection`/`SERVICE_SECTIONS` imports, and the `templateEditorOpen` ref + `templateSummary` computed from SettingsView.vue.
- Relocated the SettingsView "Services card" test block to a single card-is-gone negative assertion; the open/gate/close behavior now lives in ServicesView.test.ts.

## Task Commits

Each task was committed atomically:

1. **Task 1: ServicesView — cog trigger + editor mount + new test** - `ed5d37c` (feat)
2. **Task 2: SettingsView — remove Services card + dead code + relocate test** - `b1f58fc` (feat)

**Plan metadata:** (docs commit — this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `src/views/ServicesView.vue` - Added the editor-gated cog, the ServiceTemplateEditor mount, its import, and the `templateEditorOpen` ref.
- `src/views/__tests__/ServicesView.test.ts` - New: cog-exists / editor-gated / opens-closes coverage for R113 (reactive auth + services store mocks, sortablejs + firebase mocks for the mounted editor).
- `src/views/SettingsView.vue` - Removed the Services card block, editor mount, dead imports (`ServiceTemplateEditor`, `groupBySection`, `SERVICE_SECTIONS`), the `templateEditorOpen` ref, and the `templateSummary` computed.
- `src/views/__tests__/SettingsView.test.ts` - Replaced the `Services card (R086)` describe block with a single card-is-gone assertion; removed the now-unused `body()`/`DOMWrapper` helper to keep vue-tsc clean.

## Decisions Made
- **Cog uses `v-if="authStore.isEditor"`** (hidden for viewers) rather than the moved button's prior `:disabled` convention. RESEARCH A2 permits either; `v-if` matches the sibling New Service button, so a viewer sees a consistent editor-only action bar.
- **Coverage relocated, not dropped.** The Services-card open/gate/close assertions were the reason the editor was tested through a teleport `body()` helper on SettingsView; those assertions moved wholesale to ServicesView.test.ts, and SettingsView keeps only a proof that the card is gone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed now-unused `body()` helper + `DOMWrapper` import from SettingsView.test.ts**
- **Found during:** Task 2 (SettingsView test relocation)
- **Issue:** Deleting the Services-card describe block left the `body()` teleport helper and its `DOMWrapper` import unreferenced; `npm run type-check` (vue-tsc --build, which checks test files) would flag them under `noUnusedLocals`.
- **Fix:** Removed the helper and the `DOMWrapper` import, keeping `enableAutoUnmount(afterEach)` (still used).
- **Files modified:** src/views/__tests__/SettingsView.test.ts
- **Verification:** `npm run type-check` clean.
- **Committed in:** `b1f58fc` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the type gate clean after the planned test-block removal. No scope creep.

## Issues Encountered
None. The plan's file:line seams matched the real code; the editor mounted cleanly from the new host on the first test run.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R113 complete. This plan touched only the two view files + their tests and does not overlap with 52-01 (util/store) or 52-02 (editor-internal) work.
- **Gate status:** `npm run type-check` clean; `ServicesView.test.ts` (4) + `SettingsView.test.ts` (25) green; full app suite at the exactly-2-file known baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) — no regression.
- **Deferred per v1.6 autonomy grant:** manual click-through of the Services-page cog / confirming the Settings card is visually gone (human-verify deferred, not blocking).

## Self-Check: PASSED

---
*Phase: 52-default-service-template*
*Completed: 2026-08-11*
