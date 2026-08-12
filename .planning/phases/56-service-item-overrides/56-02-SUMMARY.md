---
phase: 56-service-item-overrides
plan: 02
subsystem: ui
tags: [vue, service-editor, scripture, bible-version, esv, nlt, planning-center, congregational]

# Dependency graph
requires:
  - phase: 56-01
    provides: the phase-56 override pattern (optional non-destructive per-item field, editor selector + downstream threading)
  - phase: 260809-vvq (quick)
    provides: the org-default bibleVersion already threaded into addSlotAsItem's SCRIPTURE branch
provides:
  - Optional bibleVersion? on ScriptureSlot (per-item ESV/NLT override, non-destructive)
  - Effective-version resolution (slot.bibleVersion ?? org default) at PC export + ScriptureInput preview + CongregationalEditor split
  - Per-item version selector in the Scripture editor row
affects: [planning-center-export, congregational-readings, scripture-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Effective-version resolution: `slot.bibleVersion ?? orgDefault` applied at each version-dependent fetch site; the raw override is passed to children which each apply the fallback (so an unset slot is byte-identical to today)"
    - "Two-way branch `=== 'NLT' ? NLT : ESV` at every routing site — any corrupt/absent value safely defaults to ESV (T-56-10)"

key-files:
  created: []
  modified:
    - src/types/service.ts
    - src/utils/planningCenterApi.ts
    - src/views/ServiceEditorView.vue
    - src/components/ScriptureInput.vue
    - src/components/CongregationalEditor.vue

key-decisions:
  - "Wired only the three version-dependent passage-fetch surfaces (PC export routing, ScriptureInput preview, CongregationalEditor split) per the plan's Scope Disclosure; slide materialization/preview/print are reference-only no-ops, documented not changed"
  - "Children receive the RAW override prop and apply `?? org default` themselves — so none of the ~12 addSlotAsItem call sites and no unset slot behavior changed"
  - "CongregationalEditor stamps the effective version as translationSource (R092 provenance) at split time"

patterns-established:
  - "Per-item override selector: 'Default (<org>)' clears to undefined, explicit ESV/NLT sets the key; stripUndefined drops the cleared key"

requirements-completed: [R128]

coverage:
  - id: D1
    description: "PC export SCRIPTURE fetch routes by the effective version (slot.bibleVersion ?? org default); title unchanged"
    requirement: R128
    verification:
      - kind: unit
        ref: "src/utils/__tests__/planningCenterApi.test.ts#R128 per-item bibleVersion override (PC export routing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Scripture-row version selector round-trips (NLT -> slot.bibleVersion; Default -> undefined) and is hidden for viewers"
    requirement: R128
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#R128: the Scripture-row version selector round-trips (choose NLT -> slot.bibleVersion, choose Default -> undefined)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#R128: the version selector is absent for viewers (non-canEditService)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ScriptureInput preview fetch routes by prop bibleVersion ?? org default"
    requirement: R128
    verification:
      - kind: unit
        ref: "src/components/__tests__/ScriptureInput.test.ts#R128: prop bibleVersion=NLT routes the preview fetch to nltApi even though the org default is ESV"
        status: pass
    human_judgment: false
  - id: D4
    description: "CongregationalEditor split fetch routes by prop bibleVersion ?? org default and stamps the effective translationSource"
    requirement: R128
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#R128: prop bibleVersion=NLT routes the auto-fetch to NLT and stamps NLT even when the org default is ESV"
        status: pass
    human_judgment: false
  - id: D5
    description: "Version selector styling within the three-rail row; end-to-end override across preview/split/PC export"
    requirement: R128
    verification: []
    human_judgment: true
    rationale: "Owner visual/functional verification deferred under the v1.6 standing grant; recorded in PENDING-VERIFICATION.md."

# Metrics
duration: ~30min
completed: 2026-08-12
status: complete
---

# Phase 56 Plan 02: Scripture Per-Item Bible-Version Override Summary

**An optional per-item ESV/NLT override on a Scripture service item, honored at the three surfaces where passage text is actually produced — Planning Center export routing, the editor reference preview, and the congregational split fetch — while reference-only slide/preview/print stay version-agnostic by design.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 (both TDD)
- **Files modified:** 9 (5 source + 4 test)

## Accomplishments
- Added optional `bibleVersion?: 'ESV' | 'NLT'` to `ScriptureSlot` — non-destructive, absent => org default (no migration).
- PC export SCRIPTURE branch now resolves `(slot as ScriptureSlot).bibleVersion ?? bibleVersion` for the fetch routing; the org-default param stays the fallback so no call site changed and the title is unchanged.
- `ScriptureInput` and `CongregationalEditor` gained an optional `bibleVersion` prop and resolve `props.bibleVersion ?? authStore.settings.bibleVersion`; CongregationalEditor stamps the effective version as `translationSource`.
- Added a per-item version selector to the Scripture editor row (editor-only) with "Default (<org>)"/ESV/NLT; it passes the raw override to both children.
- Honored the plan's Scope Disclosure exactly: only the three version-dependent passage-fetch surfaces were wired; slide materialization / projected slide / print were left unchanged as documented reference-only no-ops.

## Task Commits

1. **Task 1: ScriptureSlot.bibleVersion type + PC export version routing** - `4ae5fbd` (feat)
2. **Task 2: Scripture-row version selector + thread effective version into ScriptureInput preview and CongregationalEditor** - `bde3e84` (feat)

_TDD tasks: implementation + tests committed together per task._

## Files Created/Modified
- `src/types/service.ts` - added `bibleVersion?: 'ESV' | 'NLT'` to `ScriptureSlot` with D-01 doc comment
- `src/utils/planningCenterApi.ts` - SCRIPTURE fetch routing resolves the effective version; `ScriptureSlot` import added
- `src/views/ServiceEditorView.vue` - per-item version selector in the SCRIPTURE row; `bibleVersion` prop passed to `ScriptureInput` and `CongregationalEditor`
- `src/components/ScriptureInput.vue` - optional `bibleVersion` prop; `fetchPassageByOrgSetting` resolves `props.bibleVersion ?? org default`
- `src/components/CongregationalEditor.vue` - optional `bibleVersion` prop; `autoFetch` + `onSave` fallback resolve `props.bibleVersion ?? org default`; stamps effective `translationSource`
- Test files: `planningCenterApi.test.ts`, `ServiceEditorView.test.ts`, `ScriptureInput.test.ts`, `CongregationalEditor.test.ts`

## Decisions Made
- Followed the plan's traced scope exactly; did not expand the override into the reference-only materialization/preview/print surfaces (verified the trace holds against live files).

## Deviations from Plan
None - plan executed exactly as written. (The ServiceEditorView tests assert the selector round-trip and viewer-absence directly; the child prop-routing is proven in `ScriptureInput.test.ts` / `CongregationalEditor.test.ts` where the prop drives the fetch — equivalent coverage to a stub-prop assertion, which would be brittle against the `ScriptureInput: true` shallow stub.)

## Gate Results
- `npm run type-check` (vue-tsc --build): clean after both tasks.
- Task 1 targeted suite (planningCenterApi): 125 passed.
- Task 2 targeted suites (ServiceEditorView, ScriptureInput, CongregationalEditor): 331 passed.
- Full app suite `npx vitest run --dir src --exclude '**/rules.test.ts'`: 3112 passed, 13 failed across EXACTLY the 2 known-baseline files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`). No other regression. (Test total rose from 3113 to 3125 across the phase — 12 net new tests.)

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- R128 complete; the per-item override is live across PC export + editor fetches.
- Owner visual/functional verification of the selector styling and the end-to-end override is deferred (PENDING-VERIFICATION.md, Phase 56 section).
- Phase 57 (R129) owns the template-editor visual redesign — out of scope here.

---
*Phase: 56-service-item-overrides*
*Completed: 2026-08-12*

## Self-Check: PASSED

All listed files exist on disk; all task commits (4ae5fbd, bde3e84) present in git.
