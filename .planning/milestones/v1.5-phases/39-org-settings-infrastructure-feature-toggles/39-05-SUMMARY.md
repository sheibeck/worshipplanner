---
phase: 39-org-settings-infrastructure-feature-toggles
plan: 05
subsystem: planning-center
tags: [vue, feature-toggle, planning-center, hide-dont-disable]

# Dependency graph
requires:
  - phase: 39-02
    provides: "authStore.settings — the typed OrgSettings ref, DEFAULT_ORG_SETTINGS"
provides:
  - "ActionBarContext.pcEnabled — composed onto buildExportOrCopyItem's existing hasPcCredentials gate"
  - "Five of six Planning Center entry points hidden when authStore.settings.pcEnabled is false"
affects: [39-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-entry-point v-if composition — Planning Center has no single choke point the way claudeApi.ts does for AI, so each surface carries its own composed condition rather than one shared guard"
    - "Getter-backed vi.mock('@/stores/auth', ...) for toggling a reactive setting mid-suite (reused from 39-04's precedent, applied to a previously-bare hand-rolled mock)"

key-files:
  created: []
  modified:
    - src/views/serviceEditorActionBar.ts
    - src/views/__tests__/serviceEditorActionBar.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/RosterView.vue
    - src/views/__tests__/RosterView.test.ts
    - src/views/SongsView.vue
    - src/views/__tests__/SongsView.test.ts

key-decisions:
  - "buildExportOrCopyItem's gate stays a SINGLE composed early return (!ctx.hasPcCredentials || !ctx.pcEnabled) rather than two checks, per the plan's explicit anti-drift requirement — verified by grep -c \"if (!ctx.hasPcCredentials\" == 1"
  - "onExportToPC's early return is belt-and-suspenders: surface 1 already hides the button, but the function-level guard protects against a stale bundle or residual DOM node invoking export directly"
  - "The set-up-Planning-Center hint row composes authStore.settings.pcEnabled onto its existing !hasPcCredentials && canEditService && activeTab==='service-order' condition — resolves 39-RESEARCH.md Open Question 1 as 'hide when disabled', matching 39-UI-SPEC.md's hide-entirely contract"
  - "RosterView.test.ts's pre-existing hand-rolled auth mock (bare { orgId: 'org-1' }, no settings field) was extended with a getter-backed settings.pcEnabled — the same class of gap 39-04 found and fixed in ServiceEditorView.test.ts, caught proactively here per the plan's explicit watch-for-this-breakage note rather than discovered as a full-suite failure"

patterns-established:
  - "Pattern: when a plan's own upstream SUMMARY warns a specific breakage class exists (hand-rolled auth mock missing a new store field), grep every declared test file's auth mock BEFORE running it, not after a failure surfaces"

requirements-completed: [R089]

coverage:
  - id: D1
    description: "buildExportOrCopyItem omits export-pc when pcEnabled is false, even with credentials present; still omits when credentials are absent and pcEnabled is true; still emits when both are satisfied; every pre-existing action-bar test passes unmodified"
    requirement: "R089"
    verification:
      - kind: unit
        ref: "src/views/__tests__/serviceEditorActionBar.test.ts#pcEnabled (39-05, R089) > pcEnabled false, hasPcCredentials true: export-pc is absent from service-order"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/serviceEditorActionBar.test.ts#pcEnabled (39-05, R089) > pcEnabled true, hasPcCredentials true: export-pc is present in service-order"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/serviceEditorActionBar.test.ts#pcEnabled (39-05, R089) > pcEnabled false, hasPcCredentials false: export-pc is still absent (both gates agree)"
        status: pass
    human_judgment: false
  - id: D2
    description: "onExportToPC refuses to open the export dialog when the integration is off, independently of the action-bar item's presence"
    requirement: "R089"
    verification: []
    human_judgment: true
    rationale: "Source-asserted only (grep -c \"settings.pcEnabled\" ServiceEditorView.vue == 3, confirmed). No test mounts ServiceEditorView.vue and calls onExportToPC directly with pcEnabled false — the plan's acceptance criteria for this task are source-count assertions, not a new component test, matching how the pre-existing hasPcCredentials half of this same guard is verified today."
  - id: D3
    description: "The set-up-Planning-Center hint row hides when pcEnabled is false, in addition to its existing credentials-present condition"
    requirement: "R089"
    verification: []
    human_judgment: true
    rationale: "Source-asserted only (grep -c \"settings.pcEnabled\" ServiceEditorView.vue == 3, confirmed, and the condition text itself). Same rationale as D2 — no existing ServiceEditorView.vue mount test exercises this row; the plan's verify block is source-level for this task."
  - id: D4
    description: "Both RosterView.vue import triggers (toolbar button, empty-state CTA) hide when pcEnabled is false; Add person manually stays"
    requirement: "R089"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RosterView.test.ts#RosterView — pcEnabled (39-05, R089) > pcEnabled false: both \"Import from Planning Center\" triggers are absent, \"Add person manually\" still renders"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/RosterView.test.ts#RosterView — pcEnabled (39-05, R089) > pcEnabled true: the empty-state \"Import from Planning Center\" trigger renders"
        status: pass
    human_judgment: false
  - id: D5
    description: "SongsView.vue's Import Songs trigger hides when pcEnabled is false; Add Song stays"
    requirement: "R089"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SongsView.test.ts#SongsView (Wave 0 harness — Phase 39) > pcEnabled false: the \"Import Songs\" trigger is absent, other toolbar buttons still render"
        status: pass
    human_judgment: false
  - id: D6
    description: "No task in this plan reads, writes or clears pcAppId/pcSecret, or touches roster/service documents"
    requirement: "R089"
    verification:
      - kind: other
        ref: "grep -cE \"onClearPcCredentials|setPcCredentials\" src/views/RosterView.vue src/views/SongsView.vue == 0 for both files; git diff --name-only per task matches exactly the task's declared <files>"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-06
status: complete
---

# Phase 39 Plan 05: Planning Center Toggle Enforcement Summary

**Five of the six enumerated Planning Center entry points (export action-bar item, export dialog invocation, the set-up hint row, both roster import triggers, and the song import trigger) are hidden with `v-if`/composed-early-return gates on `authStore.settings.pcEnabled`, with the export item's gate proven at the data level and no credential or already-imported data path touched.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-06T20:12:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `ActionBarContext.pcEnabled` added as a **required** boolean member (forces every call site to supply it), composed into `buildExportOrCopyItem`'s existing single early return (`!ctx.hasPcCredentials || !ctx.pcEnabled`) rather than a second competing check
- `ServiceEditorView.vue`'s action-bar context build threads `pcEnabled: authStore.settings.pcEnabled` as a sibling of `hasPcCredentials`
- `onExportToPC`'s early return extended with the same condition — a belt-and-suspenders guard against invocation from a stale bundle or residual DOM node once the action-bar button is gone
- The "set up Planning Center" hint row composes `authStore.settings.pcEnabled` onto its existing condition, resolving 39-RESEARCH.md's Open Question 1 as "hide when disabled" per the plan's locked resolution
- `serviceEditorActionBar.test.ts`'s `makeContext()` gets `pcEnabled: true` in its defaults (every pre-existing test keeps passing unmodified) plus 3 new data-level cases under `describe('pcEnabled (39-05, R089)')`, matching the file's established assertion style
- Both `RosterView.vue` import occurrences (toolbar button, empty-state CTA) and `SongsView.vue`'s `Import Songs` trigger gated with `v-if="authStore.settings.pcEnabled"` — full DOM removal, no class/handler/icon/label changes
- `RosterView.test.ts`'s pre-existing **hand-rolled, bare** auth mock (`{ orgId: 'org-1' }`, no `settings` field at all) was extended with a getter-backed `settings.pcEnabled`, proactively avoiding the exact breakage class 39-04 discovered and fixed in `ServiceEditorView.test.ts` — caught here before running the file once, not after a cascading failure
- `SongsView.test.ts`'s Wave 0 harness (39-01) already carried the `settings.pcEnabled` getter-mock and the `findImportSongsButton()` selector helper — reused verbatim, extended with one off-case test
- `RosterView.test.ts` extended with 2 new cases in a `describe('RosterView — pcEnabled (39-05, R089)')` block, selectable via `-t "pcEnabled"`; file-level `beforeEach` resets `mockPcEnabled = true` so the flip in one test cannot leak into a later describe block

## Task Commits

1. **Task 1: Gate the export path — action bar, dialog invocation, and the set-up hint** - `7f30adc` (feat)
2. **Task 2: Gate the roster and song import triggers** - `807f26f` (feat)

## Files Created/Modified

- `src/views/serviceEditorActionBar.ts` — `pcEnabled` added to `ActionBarContext`; `buildExportOrCopyItem`'s gate composed; head comment and function-level JSDoc extended
- `src/views/__tests__/serviceEditorActionBar.test.ts` — `pcEnabled: true` added to `makeContext()` defaults; 3 new data-level cases
- `src/views/ServiceEditorView.vue` — `pcEnabled` threaded into the action-bar context build; `onExportToPC` early return extended; set-up hint row condition composed (3 occurrences of `settings.pcEnabled`, source-verified)
- `src/views/RosterView.vue` — both import occurrences gated (2 occurrences of `settings.pcEnabled`, source-verified)
- `src/views/__tests__/RosterView.test.ts` — hand-rolled auth mock extended with getter-backed `settings.pcEnabled`; 2 new pcEnabled cases; file-level `beforeEach` reset added
- `src/views/SongsView.vue` — import trigger gated (1 occurrence of `settings.pcEnabled`, source-verified)
- `src/views/__tests__/SongsView.test.ts` — 1 new off-case test reusing the Wave 0 `findImportSongsButton()` helper

## Decisions Made

- Kept `buildExportOrCopyItem`'s gate as one composed `if` statement rather than splitting into two guard clauses, matching 39-RESEARCH.md's explicit anti-pattern warning about the two gates drifting apart if implemented as competing checks.
- Extended `RosterView.test.ts`'s bare hand-rolled auth mock (`{ orgId: 'org-1' }`) to a getter-backed shape (`SongTable.test.ts:39` precedent, already used by `SongsView.test.ts`'s Wave 0 harness) rather than a static `settings: { pcEnabled: true }` object, so the new pcEnabled-off tests can flip the value mid-suite without a second `vi.mock` or a remount trick.
- Did not add a component-level test asserting `onExportToPC`'s refusal or the hint row's hiding directly — the plan's own acceptance criteria for Task 1 are source-count `grep` assertions (`settings.pcEnabled` appearing exactly 3 times in `ServiceEditorView.vue`), matching how the pre-existing `hasPcCredentials` half of the same two gates is verified today (no test calls `onExportToPC` with no credentials either). Recorded as backstop coverage (D2/D3) rather than invented test coverage beyond the plan's own gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/Rule 3 - anticipated breakage, pre-empted] `RosterView.test.ts`'s hand-rolled auth mock had no `settings` field at all**
- **Found during:** Task 2, before running the test file (per the plan's explicit `<watch_for_this_specific_breakage>` instruction citing 39-04's `ServiceEditorView.test.ts` discovery)
- **Issue:** `RosterView.test.ts` mocked `@/stores/auth` as a bare `{ orgId: 'org-1' }` — no `settings` object of any kind, not even a static one. Adding `v-if="authStore.settings.pcEnabled"` to `RosterView.vue` would have thrown `Cannot read properties of undefined (reading 'pcEnabled')` at mount, breaking all 15 tests in the file (not just the pre-existing 1-test baseline failure).
- **Fix:** Added `settings: { get pcEnabled() { return mockPcEnabled } }` to the mock, with a module-level `mockPcEnabled` variable defaulting to `true` and a file-level `beforeEach` resetting it, mirroring the getter-mock shape already established in `SongsView.test.ts` and `SongTable.test.ts`.
- **Files modified:** `src/views/__tests__/RosterView.test.ts` (already declared in this task's `<files>` — no scope expansion)
- **Verification:** `npx vitest run src/views/__tests__/RosterView.test.ts` — 14/15 pass, the one failure being the pre-existing documented stale assertion (`wraps Roles config in CollapsibleSection`), unchanged from baseline.
- **Committed in:** `807f26f` (Task 2 commit)

---

**Total deviations:** 1 (pre-empted, not auto-fixed-after-failure) — the mock extension was made proactively per the plan's own warning, so no full-suite failure was ever produced or needed to be diagnosed.
**Impact on plan:** None on scope — the file was already declared in this task's `<files>` list; the fix is exactly the kind of test-harness gap the plan told this executor to expect.

## Surface Status (per the plan's six-surface work list)

| # | Surface | Status |
|---|---|---|
| 1 | Export-to-PC action-bar item | Gated (Task 1) — composed on `buildExportOrCopyItem`'s existing early return |
| 2 | Export dialog invocation (`onExportToPC`) | Gated (Task 1) — early return extended |
| 3 | "Set up Planning Center" hint row | Gated (Task 1) — condition composed, resolved as "hide when disabled" |
| 4 | Roster import trigger (both occurrences) | Gated (Task 2) |
| 5 | Song import trigger | Gated (Task 2) |
| 6 | Credentials display/edit block | Delivered by 39-03 (not this plan) |

All six surfaces accounted for.

## Issues Encountered

None beyond the pre-empted mock gap above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

R089 is fully satisfied: every Planning Center entry point in scope hides when the integration is off, the export path is doubly guarded (action-bar omission + function-level refusal), and no task in this plan reads, writes or clears `pcAppId`/`pcSecret`, roster people, or service `exported` status. 39-06 can proceed independently.

---
*Phase: 39-org-settings-infrastructure-feature-toggles*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: src/views/serviceEditorActionBar.ts (pcEnabled composed gate, grep-verified)
- FOUND: 7f30adc (Task 1 commit)
- FOUND: 807f26f (Task 2 commit)
- FOUND: src/views/__tests__/RosterView.test.ts (mock extension + new pcEnabled cases)
- FOUND: src/views/__tests__/SongsView.test.ts (new pcEnabled-off case)
