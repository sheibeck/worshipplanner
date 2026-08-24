---
phase: 81-polish-ops-close-out
plan: 02
subsystem: ui
tags: [vue, accessibility, a11y, owner-console, useId]

requires:
  - phase: 81-polish-ops-close-out (plan 01, if any)
    provides: n/a — this plan has no depends_on

provides:
  - Real accessible names on the ConfigurationTab super-admin grant email input
  - Real accessible names on the OrganizationsTab onboard "Church name"/"First admin email" inputs
  - aria-label (no static id) on the per-row OrganizationsTab assign-admin input inside v-for
  - useId()-generated, per-instance-unique label/input association in ConfigTextField.vue

affects: [81-03 (tab-strip ARIA retrofit), any future a11y sweep of the Owner Console]

tech-stack:
  added: []
  patterns:
    - "Single-instance form inputs get a real <label for> + static id; inputs repeated inside v-for get aria-label with no id/for pair, to avoid duplicate-id collisions across rows"
    - "Vue 3.5 useId() for shared-component label/input association — avoids plumbing an id prop through every call site and avoids slugifying label text (which could collide)"

key-files:
  created:
    - src/components/admin/__tests__/ConfigurationTab.test.ts
  modified:
    - src/components/admin/ConfigurationTab.vue
    - src/components/admin/OrganizationsTab.vue
    - src/components/admin/ConfigTextField.vue
    - src/components/admin/__tests__/OrganizationsTab.test.ts
    - src/components/admin/__tests__/ConfigTextField.test.ts

key-decisions:
  - "Used aria-label (not a per-row-unique id/for pair) on OrganizationsTab's per-row assign input, per RESEARCH Pitfall 5 — avoids duplicate ids across v-for rows"
  - "Used useId() in ConfigTextField instead of a slugified label or a plumbed id prop — zero call-site changes, guaranteed per-instance uniqueness"
  - "Did NOT add eslint-plugin-vuejs-accessibility per orchestrator instruction (flagged [SUS]/too-new by package-legitimacy gate) — fixed the fully-enumerated defect list directly instead"

patterns-established:
  - "Owner Console form-input accessible-name convention: real <label for> for single-instance inputs, aria-label for v-for-repeated inputs"

requirements-completed: [R239]

coverage:
  - id: D1
    description: "ConfigurationTab's grant email input has a programmatic accessible name via an associated <label for>"
    requirement: "R239"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/ConfigurationTab.test.ts#renders a <label> associated (for -> id) with the grant email input, with non-empty text"
        status: pass
    human_judgment: false
  - id: D2
    description: "OrganizationsTab's onboard 'Church name' and 'First admin email' inputs each have an associated <label for>"
    requirement: "R239"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#associates the \"Church name\" and \"First admin email\" onboard inputs with real labels"
        status: pass
    human_judgment: false
  - id: D3
    description: "OrganizationsTab's per-row assign-admin input (inside v-for) uses aria-label with no static id, avoiding duplicate ids across rows"
    requirement: "R239"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#exposes the per-row assign input via aria-label, with no static id, across a two-org list"
        status: pass
    human_judgment: false
  - id: D4
    description: "ConfigTextField's <label> for matches its <input> id via useId(), and two instances on one page produce distinct ids"
    requirement: "R239"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/ConfigTextField.test.ts#associates the <label> with the <input> via a non-empty, matching for/id pair"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/ConfigTextField.test.ts#produces distinct input ids across two instances on one page (no collision between e.g. Sender fromName/fromAddress)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-24
status: complete
---

# Phase 81 Plan 02: Owner Console form labels/accessible names Summary

**Real `<label for>` and `aria-label` accessible names added to all 4 previously placeholder-only Owner Console inputs, plus `useId()`-based label/input association in the shared `ConfigTextField.vue`.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-24T10:18:00Z
- **Completed:** 2026-08-24T10:53:00Z
- **Tasks:** 3
- **Files modified:** 6 (3 source, 2 extended test files, 1 new test file)

## Accomplishments
- `ConfigurationTab.vue`'s super-admin grant email input now has a real associated `<label for="grant-email">`; new `ConfigurationTab.test.ts` (Wave 0 gap) covers it plus grant-submit behavior and the roster/appConfig subscriptions.
- `OrganizationsTab.vue`'s onboard "Church name" and "First admin email" inputs now have real associated labels (`onboard-church-name`, `onboard-admin-email`); the per-row assign-admin input (inside `v-for="org in orgs"`) uses `aria-label="Admin email"` with no static `id`, avoiding the duplicate-id collision RESEARCH.md's Pitfall 5 flagged.
- `ConfigTextField.vue` (shared by Sender/AI-Proxy cards) now generates a unique id via Vue's `useId()` and binds it to both the `<label for>` and the `<input id>` — no id prop plumbing, no label-text slugification risk.
- Zero auth-gating `v-if`/route-guard/`httpsCallable` logic touched — every change is presentational (label/id/aria attributes only).

## Task Commits

Each task was committed atomically:

1. **Task 1: Label the ConfigurationTab super-admin grant email input** - `5d08f614` (feat)
2. **Task 2: Label the Organizations onboard inputs and aria-label the per-row assign input** - `fc350db5` (feat)
3. **Task 3: Associate ConfigTextField's label with its input via a unique id** - `2cdd5180` (feat)

_No TDD RED/GREEN split was used — tests were written and asserted green alongside each template change per task, matching the plan's tdd="true" verify-loop shape (write → verify → commit)._

## Files Created/Modified
- `src/components/admin/ConfigurationTab.vue` - Added `<label for="grant-email">` + `id="grant-email"` on the grant email input
- `src/components/admin/__tests__/ConfigurationTab.test.ts` - New file: accessible-name, submit-behavior, and subscription-invariant assertions
- `src/components/admin/OrganizationsTab.vue` - Added labeled onboard inputs (`onboard-church-name`, `onboard-admin-email`); added `aria-label="Admin email"` (no id) on the per-row assign input
- `src/components/admin/__tests__/OrganizationsTab.test.ts` - Extended with a new `describe` block asserting the onboard labels and the per-row aria-label/no-id behavior
- `src/components/admin/ConfigTextField.vue` - `useId()`-generated `fieldId` bound to `:for`/`:id`
- `src/components/admin/__tests__/ConfigTextField.test.ts` - Extended with label/input association and cross-instance uniqueness (mounted under a shared host component, since `useId()` scopes to the owning app instance)

## Decisions Made
- Per-row assign input: `aria-label` instead of a per-row-unique `id`/`for` pair — simpler, and per RESEARCH.md's Pitfall 5 a static `id` retrofit inside `v-for` would produce duplicate ids across org rows.
- `ConfigTextField`: `useId()` over a slugified-label id or a plumbed `id`/`fieldId` prop — zero call-site changes across every consumer (Sender, AI-Proxy cards), and guarantees uniqueness even for identical label text (e.g. two "Display name" fields on different cards).
- Did not add `eslint-plugin-vuejs-accessibility` in this plan (per orchestrator/RESEARCH.md instruction — flagged `[SUS]`/too-new by the package-legitimacy gate, and the defect surface was already fully enumerated by RESEARCH.md, so the linter added no discovery value here).

## Deviations from Plan

None — plan executed exactly as written. All three tasks matched their `<action>`/`<verify>`/`<done>` specs; no Rule 1-4 auto-fixes were needed.

## Issues Encountered
- Initial `ConfigTextField.test.ts` uniqueness test mounted two separate `ConfigTextField` instances via two separate `mount()` calls, which each spin up their own Vue app — `useId()` resets per-app, so both got `id="v-0"` and the test failed. Fixed by mounting both instances under one host component (matching how they actually co-exist on the real Configuration tab), which correctly exercises `useId()`'s real per-app-instance uniqueness guarantee.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- R239 part 1 of 2 (form labels) is complete. Part 2 (ARIA tab semantics on the Configuration/Organizations tab strip and the matching `ServiceEditorView.vue` tab strip, per RESEARCH.md's Architecture Patterns section) is scoped to 81-03 and untouched by this plan.
- No blockers for 81-03: this plan did not modify `v-show`, `activeTab`, or any tab-strip markup.

---
*Phase: 81-polish-ops-close-out*
*Completed: 2026-08-24*

## Self-Check: PASSED
All created/modified files found on disk; all 3 task commit hashes (5d08f614, fc350db5, 2cdd5180) found in git log.
