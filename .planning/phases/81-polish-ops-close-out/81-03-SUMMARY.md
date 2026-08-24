---
phase: 81-polish-ops-close-out
plan: 03
subsystem: ui
tags: [vue, aria, accessibility, wai-aria-apg, owner-console, service-editor]

# Dependency graph
requires:
  - phase: 81-polish-ops-close-out (plan 02)
    provides: eslint-plugin-vuejs-accessibility dev dependency + real label/aria-label fixes on Owner Console inputs (R239 part 1)
provides:
  - WAI-ARIA APG Tabs semantics (role=tablist/tab/tabpanel, aria-selected, aria-controls, aria-labelledby) on OwnerConsoleView.vue's Configuration/Organizations tab strip
  - Same ARIA tab semantics on ServiceEditorView.vue's Service Order/Slides/Roles/Messages tab strip
  - Regression test proving OrganizationsTab.vue stays mounted (onSnapshot listener stays live) across a Configuration<->Organizations tab switch
affects: [81-04-PLAN, future accessibility work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ARIA tab semantics bound to the SAME activeTab reactive expression already driving :class active styling — no second source of truth"
    - "v-show-always-mounted panels get role=tabpanel/id/aria-labelledby as additive attributes only; the mount strategy is never touched"

key-files:
  created: []
  modified:
    - src/views/OwnerConsoleView.vue
    - src/views/__tests__/OwnerConsoleView.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "Static ARIA + labels only — no roving-tabindex/arrow-key keyboard handlers, per CONTEXT.md's discretion note and RESEARCH Open Question 2"
  - "tabindex bound to activeTab (0 for the active tab, -1 for inactive) for the simplest APG-compliant static focus order, without a JS keydown handler"

requirements-completed: [R239]

coverage:
  - id: D1
    description: "Owner Console tab strip exposes role=tablist/tab/tabpanel + aria-selected/aria-controls/aria-labelledby bound to the existing activeTab state"
    requirement: R239
    verification:
      - kind: unit
        ref: "src/views/__tests__/OwnerConsoleView.test.ts#OwnerConsoleView — ARIA tab semantics (R239)"
        status: pass
    human_judgment: false
  - id: D2
    description: "OrganizationsTab.vue (and its onSnapshot listener) stays mounted across a setTab('configuration') switch — the v-show invariant is preserved by the ARIA retrofit"
    requirement: R239
    verification:
      - kind: unit
        ref: "src/views/__tests__/OwnerConsoleView.test.ts#never unmounts OrganizationsTab across a setTab switch back to Configuration (onSnapshot-survives regression, T-81-03-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ServiceEditorView tab strip (Service Order/Slides/Roles/Messages) exposes the same ARIA tab semantics, and the Roles/Messages authStore.isEditor/isMessagingEnabled() v-if gates are preserved verbatim"
    requirement: R239
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - ARIA tab semantics (R239)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-24
status: complete
---

# Phase 81 Plan 03: Service Editor + Owner Console ARIA Tab Semantics Summary

**WAI-ARIA APG Tabs pattern (role=tablist/tab/tabpanel, aria-selected, aria-controls, aria-labelledby) added to both the Owner Console and Service Editor tab strips, bound to each view's existing activeTab state, with a regression test proving the Owner Console panels' always-mounted onSnapshot listeners survive the retrofit.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-24T14:31:00Z (approx.)
- **Completed:** 2026-08-24T14:56:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `OwnerConsoleView.vue`'s Configuration/Organizations tab strip now exposes `role="tablist"` on the container and `role="tab"` + `aria-selected` + `aria-controls` + a stable `id` on each button; each panel gets `role="tabpanel"` + `id` + `aria-labelledby`, with `v-show` (never `v-if`) unchanged so `ConfigurationTab`/`OrganizationsTab` stay permanently mounted.
- `ServiceEditorView.vue`'s Service Order/Slides/Roles/Messages tab strip gets the identical ARIA treatment, including the two conditionally-rendered buttons (Roles gated on `authStore.isEditor`, Messages on `authStore.isEditor && isMessagingEnabled()`) — those `v-if` gates are untouched.
- New regression test asserts `wrapper.findComponent(OrganizationsTab).exists()` stays `true` after `setTab('configuration')` is triggered from the Organizations tab — the panel is v-show-hidden but never unmounted, so its `onSnapshot` subscription stays live (T-81-03-01 mitigation).
- New non-editor regression test on `ServiceEditorView.vue` confirms the Roles/Messages tab roles simply don't render when their gates are false (T-81-03-02 mitigation) — no weakening of the existing access gates.

## Task Commits

Each task was committed atomically:

1. **Task 1: ARIA tab semantics on the Owner Console tab strip + onSnapshot-survives-switch regression** - `57ee22e3` (feat)
2. **Task 2: ARIA tab semantics on the ServiceEditorView tab strip** - `01582e4d` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/views/OwnerConsoleView.vue` - `role="tablist"` on the tab container; `role="tab"` + `aria-selected` + `aria-controls` + `tabindex` + stable `id` on each button; `role="tabpanel"` + `id` + `aria-labelledby` on each `v-show` panel
- `src/views/__tests__/OwnerConsoleView.test.ts` - new `describe('OwnerConsoleView — ARIA tab semantics (R239)')` block (3 tests): tablist/tab/tabpanel role + attribute assertions, aria-selected updates on click, and the onSnapshot-survives-setTab regression
- `src/views/ServiceEditorView.vue` - same ARIA pattern on the Service Order/Slides/Roles/Messages tab strip and their four panels; the Roles/Messages `v-if` gates and every panel's `data-testid` are preserved verbatim
- `src/views/__tests__/ServiceEditorView.test.ts` - new `describe('ServiceEditorView - ARIA tab semantics (R239)')` block (4 tests): always-present tab roles/attributes, conditionally-rendered Roles/Messages tab roles/attributes, aria-selected updates on click, and a non-editor gate-preservation regression

## Decisions Made
- Bound `aria-selected`/`tabindex` to the exact same `activeTab === '<tab>'` expression already driving each button's `:class` active styling — no new reactive state, no risk of desyncing from the router-query deep-link sync (per RESEARCH Pitfall 4 / threat T-81-03-03).
- Shipped static ARIA + labels only; deferred roving-tabindex/arrow-key keyboard handlers as optional polish, per CONTEXT.md's discretion note and the plan's explicit instruction not to add keyboard-handler JS.
- Used `wrapper.findComponent(OrganizationsTab).exists()` (component existence, not DOM visibility) for the mount-survives-switch regression assertion — the plan's explicit guidance to avoid a false-positive from `v-show`'s `display:none` toggling looking like an unmount.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The full app test suite run (`npx vitest run`, no `--dir`) took a Bash tool timeout to complete (~330-375s) because it was executed against the live Firebase emulators already running in this environment (Storage 9199 / Firestore 8080 / etc.), which is what makes `storage.rules.test.ts`'s two documented allow-case failures reproduce instead of erroring out as connection-refused — confirming the CLAUDE.md-documented baseline rather than masking it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- R239 (Owner Console accessibility) is now fully closed across both 81-02 (labels) and 81-03 (tab semantics) — no remaining R239 work in this phase.
- 81-04-PLAN.md remains the only incomplete plan in phase 81.

---
*Phase: 81-polish-ops-close-out*
*Completed: 2026-08-24*

## Self-Check: PASSED
- FOUND: src/views/OwnerConsoleView.vue
- FOUND: src/views/__tests__/OwnerConsoleView.test.ts
- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- FOUND commit: 57ee22e3
- FOUND commit: 01582e4d
