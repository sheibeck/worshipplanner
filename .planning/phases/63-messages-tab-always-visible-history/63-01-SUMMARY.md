---
phase: 63-messages-tab-always-visible-history
plan: 01
subsystem: ui
tags: [vue, service-editor, messaging, tabs, action-bar, tdd]

# Dependency graph
requires:
  - phase: 58-05
    provides: Messaging defaults panel (per-service overrides + Draft-editable/locked-read-only branches)
  - phase: 60-03
    provides: "Sent on this service" ServiceMessageHistory panel (R142/R143)
  - phase: 59-04
    provides: ✉ Messages composer action-bar entry (buildServiceOrderItems, R136)
provides:
  - Dedicated Messages tab in the Service Editor (4th button, after Roles), gated authStore.isEditor && isMessagingEnabled()
  - Messaging-defaults panel + ServiceMessageHistory relocated into a v-show messages-panel (out of the Service Order tab)
  - R150 fix — delivery history renders on a LOCKED service (gate dropped canEditService)
  - ActionBarTab widened with 'messages'; buildActionBarItems('messages') returns []
affects: [service-editor, messaging, service-message-history, action-bar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tab-button + v-show panel idiom copied verbatim from the Roles tab; messaging kill-switch composed onto the editor gate"
    - "Relocation proven by CONTAINER (which panel a surface resolves inside), since v-show keeps both panels in the DOM"
    - "Display-gate invariant (viewer-hidden / kill-switch) lives on the history's OWN v-if, not on the tab button alone"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/serviceEditorActionBar.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/views/__tests__/serviceEditorActionBar.test.ts

key-decisions:
  - "Tab order Service Order · Slides · Roles · Messages (append last, least disruption)"
  - "History gate isMessagingEnabled() && authStore.isEditor — drop ONLY canEditService (removing its embedded !isLocked), keep the editor term so a viewer stays out"
  - "Messages tab exposes no action-bar items (buildActionBarItems('messages') === []); the ✉ Messages composer stays on the Service Order bar (SC3 unchanged)"
  - "Test tab-button lookups scoped to the tab-only rounded-t-md class — the action-bar ✉ composer button also renders text 'Messages' (present-but-disabled when off), so a bare text match was ambiguous"

patterns-established:
  - "Messaging kill-switch (isMessagingEnabled) composed onto an editor gate for a new tab, mirroring the ✉ entry's gating"

requirements-completed: [R149, R150]

coverage:
  - id: D1
    description: "Messages tab button appears after Roles for an editor with messaging ON; absent for a viewer and when messaging is OFF (R149)"
    requirement: R149
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#shows the Messages tab button for an editor with messaging ON"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#HIDES the Messages tab button for a viewer (non-editor)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#HIDES the Messages tab button when org messaging is OFF"
        status: pass
    human_judgment: false
  - id: D2
    description: "Messaging-defaults panel + ServiceMessageHistory relocate INTO the messages-panel and no longer inside service-order-panel (R149)"
    requirement: R149
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#relocates the defaults panel + history INTO the messages-panel (not service-order-panel)"
        status: pass
    human_judgment: false
  - id: D3
    description: "R150 — the delivery history renders on a LOCKED service (status planned) for an editor; still hidden for a viewer / messaging-off"
    requirement: R150
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#R150: on a LOCKED service the history STILL renders for an editor with messaging ON"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#locked service: a viewer (non-editor) still hides the history"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#locked service: messaging OFF still hides the history"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildActionBarItems('messages') returns []; the ✉ Messages composer key stays on the Service Order tab (SC3)"
    verification:
      - kind: unit
        ref: "src/views/__tests__/serviceEditorActionBar.test.ts#MESSAGES EMPTY: the messages item list has length 0 across the same cartesian product"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/serviceEditorActionBar.test.ts#SC3: the ✉ Messages composer key stays on the Service Order tab (not the Messages tab)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual UAT — the Messages tab looks right and the history is visible when the service is locked (read-only)"
    verification: []
    human_judgment: true
    rationale: "Visual/layout adequacy and the locked-service read-only appearance are not asserted by any unit test — deferred to the owner at /gsd-verify-work 63 (no deploy, no .env.local per the v1.8 grant)."

# Metrics
duration: 18 min
completed: 2026-08-15
status: complete
---

# Phase 63 Plan 01: Messages tab + always-visible delivery history Summary

**A dedicated Messages tab (4th, after Roles) that relocates the messaging-defaults panel and the "Sent on this service" ServiceMessageHistory out of the Service Order tab, plus the R150 gate fix so the history stays visible on a locked service.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-08-15
- **Tasks:** 2 (both TDD)
- **Files modified:** 4

## Accomplishments
- Added a Messages tab button, mirroring the Roles button verbatim with `authStore.isEditor && isMessagingEnabled()` gating (append last).
- Moved the messaging-defaults panel (`messaging-defaults-panel`) and the `ServiceMessageHistory` mount (`service-message-history`) byte-for-byte into a new `v-show="activeTab === 'messages'"` `messages-panel`; their internal Draft-editable / locked-read-only / viewer branches and all props/events are untouched.
- R150 fix: the history gate changed from `isMessagingEnabled() && canEditService` to `isMessagingEnabled() && authStore.isEditor` — it now renders on a LOCKED service while a viewer / messaging-off org still hides it.
- Widened `activeTab` and `ActionBarTab` unions with `'messages'` in lockstep; `buildActionBarItems('messages')` returns `[]` (the ✉ composer entry stays on the Service Order bar — SC3 unchanged).

## Task Commits

1. **Task 1 (RED): failing tests for Messages tab, relocation, R150** - `119f038e` (test)
2. **Task 1 (GREEN): source + test disambiguation** - `cb2c0e6c` (feat)
3. **Task 2 (R150 regression):** covered by the Task 1 RED test commit (`119f038e`); no source change (the gate was set in Task 1), tests pass with the Task 1 source.

_Note: this is a TDD plan — Task 2's regression tests were authored in the RED commit and validated GREEN by the Task 1 gate change; no dedicated Task 2 source commit exists because the plan specifies none._

## Files Created/Modified
- `src/views/ServiceEditorView.vue` - Messages tab button; relocated defaults + history into `messages-panel`; widened `activeTab`; R150 history gate.
- `src/views/serviceEditorActionBar.ts` - `ActionBarTab` widened with `'messages'`; `buildActionBarItems` returns `[]` for `'messages'`.
- `src/views/__tests__/ServiceEditorView.test.ts` - Messages tab presence/absence, relocation container assertions, R150 locked-service regression describe.
- `src/views/__tests__/serviceEditorActionBar.test.ts` - MESSAGES-EMPTY + SC3 composer-key-stays-on-service-order cases.

## Decisions Made
- Followed the plan's locked decisions exactly (tab order, gate composition, no restyle).
- Test-only disambiguation: scoped the Messages tab-button lookup to the tab-only `rounded-t-md` class because the ContextualActionBar's ✉ Messages composer entry (rendered real in these tests) also produces a `<button>Messages</button>` that is present-but-disabled when messaging is off. Without the class filter, the "hides Messages tab when messaging OFF" assertion matched the action-bar button. This is a precision fix in the test, not a source/behavior change.

## Deviations from Plan

None - plan executed exactly as written. (The tab-button test selector was scoped to the `rounded-t-md` tab class to disambiguate from the action-bar ✉ composer button; this refines the test's precision without altering any planned source behavior.)

## Issues Encountered
- The initial GREEN run had one failing assertion ("hides Messages tab button when messaging OFF") because the action-bar ✉ composer button also renders text "Messages" (present-but-disabled when off). Resolved by scoping the tab-button lookup to the tab-only `rounded-t-md` class. Re-run: 373/373 scoped tests pass.

## Gate Results
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/views/__tests__/serviceEditorActionBar.test.ts` — **373 passed (2 files)**.
- `npm run type-check` (vue-tsc --build) — **clean** (no output / exit 0).
- `npx vitest run` (full app suite) — **114 passed | 2 failed (13 tests)**; the 2 failing files are the documented known-failing baseline: `src/storage.rules.test.ts` (Storage emulator cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). No NEW failing app-suite file.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Code-complete for R149/R150. Visual UAT (tab looks right; history visible when locked) is deferred to the owner at `/gsd-verify-work 63` and recorded in `.planning/PENDING-VERIFICATION.md` as `verification_deferred_human` (NOT marked passed).
- No deploy and no `.env.local` were required or performed (v1.8 grant). This is the first plan of milestone v1.8.

---
*Phase: 63-messages-tab-always-visible-history*
*Completed: 2026-08-15*

## Self-Check: PASSED
- `src/views/ServiceEditorView.vue` modified (Messages tab + relocation + R150 gate) — verified on disk.
- `src/views/serviceEditorActionBar.ts` modified (ActionBarTab + buildActionBarItems) — verified on disk.
- Commits `119f038e` (test), `cb2c0e6c` (feat) present in `git log`.
- Scoped tests 373/373 green; type-check clean; full app suite at the 2-file baseline.
