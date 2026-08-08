---
phase: 45-esv-nlt-bible-version-selection
plan: 02
subsystem: settings
tags: [org-settings, firestore, vue, settings-ui, bible-version]

# Dependency graph
requires: []
provides:
  - "src/types/organization.ts: OrgSettings.bibleVersion: 'ESV' | 'NLT' + DEFAULT_ORG_SETTINGS.bibleVersion='NLT', flowing through the single existing auth.ts::loadOrgContext merge"
  - "src/views/SettingsView.vue: Bible Translation card — ESV/NLT radio, editor-gated, dot-path updateDoc('settings.bibleVersion') + authStore.settings.bibleVersion mirror-write"
affects: [45-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-option exclusive radio group for a settings enum choice (new shape in SettingsView.vue, alongside the existing boolean-checkbox toggles) — same save-on-@change, editor-gate, mirror-write, Saved!/error-revert contract as the sibling toggles, just applied to a non-boolean field"

key-files:
  created: []
  modified:
    - src/types/organization.ts
    - src/stores/__tests__/auth.test.ts
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts

key-decisions:
  - "No change to src/stores/auth.ts — verified the existing `{ ...DEFAULT_ORG_SETTINGS, ...orgSettings, vwModeEnabled: resolvedVwModeEnabled }` spread at loadOrgContext:201-205 already carries the new bibleVersion field through with no second merge point, per D-Area1's locked single-merge contract"
  - "Revert-on-error flips to 'the other option' (newValue === 'ESV' ? 'NLT' : 'ESV') rather than tracking a separate 'previous value' ref — safe because the field is a strict two-value union, and it mirrors the sibling boolean toggles' `= !newValue` revert shape exactly (45-UI-SPEC.md's own framing of the pattern)"
  - "Bible Translation card placed between the AI Features and Services cards in SettingsView.vue's template — no ordering constraint in the plan/UI-SPEC, chosen for topical proximity to the other R07x/R09x feature-gate cards"

requirements-completed: [R090]

coverage:
  - id: D1
    description: "OrgSettings.bibleVersion field + DEFAULT_ORG_SETTINGS='NLT', resolved through the single loadOrgContext merge: absent->NLT, stored ESV wins over default, DEFAULT constant itself is NLT"
    requirement: "R090"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#OrgSettings.bibleVersion (R090) — 3 new tests, 49 total passing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bible Translation card in SettingsView.vue: renders both option labels, checks the stored value, writes the settings.bibleVersion dot-path leaf on change, mirrors onto the store, shows Saved!/reverts+shows error on failure, editor-gated (disabled attrs + handler early-return)"
    requirement: "R090"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView Bible Translation card (R090) — 45-02 — 8 new tests, 23 total passing"
        status: pass
    human_judgment: false
  - id: D3
    description: "Visual match to sibling AI/PC/VW toggle cards — same card shell, spacing (including the inherited 12px header-to-body constant), typography, and copy verbatim from 45-UI-SPEC.md"
    verification: []
    human_judgment: true
    rationale: "jsdom unit tests prove markup/class presence but not rendered visual fidelity — deferred to the standing owner human-verify backstop per 45-02-PLAN.md's verification section, not blocking"

# Metrics
duration: ~10min
completed: 2026-08-08
status: complete
---

# Phase 45 Plan 02: OrgSettings.bibleVersion + Settings Bible Translation Card Summary

**Church-level `bibleVersion: 'ESV' | 'NLT'` field defaulting to NLT (owner's locked override) via the single existing `loadOrgContext` merge, plus a "Bible Translation" Settings card mirroring the AI/Planning Center/Vertical Worship toggle cards exactly.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-08T00:22Z (approx, first commit)
- **Completed:** 2026-08-08T00:32Z (last task commit)
- **Tasks:** 2 (each executed as TDD-shaped: tests written alongside the implementation, run to green before commit)
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments
- `OrgSettings.bibleVersion: 'ESV' | 'NLT'` added to `src/types/organization.ts`, plus `DEFAULT_ORG_SETTINGS.bibleVersion: 'NLT'` — the owner's 2026-08-07 locked override, documented inline as deliberately NOT the "preserve current behavior" ESV default.
- Confirmed (by reading, not editing) that `src/stores/auth.ts::loadOrgContext`'s existing `{ ...DEFAULT_ORG_SETTINGS, ...orgSettings, ... }` spread (lines 201-205) already carries the new field through with zero changes to `auth.ts` — the single-merge contract Phases 39/44 established stays intact, with no second defaults path introduced.
- Three new tests in `src/stores/__tests__/auth.test.ts` (`OrgSettings.bibleVersion (R090)` describe block): the DEFAULT constant is `'NLT'`; an org with no stored `bibleVersion` resolves to `'NLT'`; an org with stored `bibleVersion: 'ESV'` keeps `'ESV'` (stored value wins over the new default, so existing ESV-only churches are unaffected).
- New "Bible Translation" card in `src/views/SettingsView.vue`, structurally and visually identical to the AI Features card: explanatory copy first, then a two-option `ESV (English Standard Version)` / `NLT (New Living Translation)` radio group (`text-indigo-600 focus:ring-indigo-500`), editor-gated via `authStore.isEditor`, saving on `@change` via `onChangeBibleVersion` (dot-path `updateDoc({ 'settings.bibleVersion': newValue })` + `authStore.settings.bibleVersion` mirror-write + `Saved!` feedback for 2000ms), with revert-to-the-other-option + `Failed to save. Please try again.` on a rejected write.
- Eight new tests in `src/views/__tests__/SettingsView.test.ts` (`SettingsView Bible Translation card (R090) — 45-02` describe block): heading + both option labels render; the checked radio matches `authStore.settings.bibleVersion`; selecting ESV writes exactly `{ 'settings.bibleVersion': 'ESV' }` (single dot-path key, no whole-`settings` write); the store mirror-write + `Saved!` feedback fire; a rejected write reverts the selection and shows the shared failure string without mirror-writing the store; both radios carry `disabled` for a non-editor; and the handler early-returns (no `updateDoc` call, no store mutation) even if a non-editor's disabled input is force-changed in the DOM.

## Task Commits

1. **Task 1: OrgSettings.bibleVersion field + DEFAULT_ORG_SETTINGS + tests** - `e0f8192` (feat)
2. **Task 2: SettingsView.vue Bible Translation card + tests** - `48733be` (feat)

## Files Created/Modified
- `src/types/organization.ts` - Added `bibleVersion: 'ESV' | 'NLT'` to `OrgSettings` and `bibleVersion: 'NLT'` to `DEFAULT_ORG_SETTINGS`, each with a comment documenting the owner's locked NLT-default override
- `src/stores/__tests__/auth.test.ts` - New `OrgSettings.bibleVersion (R090)` describe block: DEFAULT constant, absent-key resolution, stored-value-wins (3 tests)
- `src/views/SettingsView.vue` - New Bible Translation card (template + `bibleVersionInput`/`bibleVersionSavedFeedback`/`bibleVersionSaveError` refs + a store-sync `watch` + `onChangeBibleVersion` handler)
- `src/views/__tests__/SettingsView.test.ts` - `mockBibleVersion` added to the `@/stores/auth` mock (getter/setter on `settings`, reset in every `beforeEach`); new `SettingsView Bible Translation card (R090) — 45-02` describe block (8 tests)

## Decisions Made
- Did not touch `src/stores/auth.ts` — the plan explicitly required verifying the existing merge already covers the new field rather than adding a second merge point, and reading `loadOrgContext:201-205` confirmed the `...DEFAULT_ORG_SETTINGS` spread already does so.
- Used the "flip to the other option" revert shape (`newValue === 'ESV' ? 'NLT' : 'ESV'`) instead of caching a separate previous-value ref, since the field is a strict two-value union and this is the direct radio-group analog of the sibling checkboxes' `!newValue` revert — no new state needed.
- Card placement: inserted between AI Features and Services in the template (no ordering requirement from the plan or UI-SPEC).

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed; the only "verification" step (confirming `auth.ts` needs no edit) was itself a plan instruction, not a deviation.

## Issues Encountered

None.

## Verification Results
- `npx vitest run src/stores/__tests__/auth.test.ts` — 49/49 passed (3 new).
- `npx vitest run src/views/__tests__/SettingsView.test.ts` — 23/23 passed (8 new).
- `npm run type-check` (vue-tsc --build) — clean, 0 errors.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — 2 failed files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), both the documented pre-existing baseline (see CLAUDE.md) — no new failing file introduced. 2825 passed, 13 skipped, 1 failed test (the known `RosterView.test.ts` stale assertion).

## User Setup Required

None new. Deferred owner human-verify item (per plan's verification section, non-blocking): visually confirm the Bible Translation card matches its sibling cards and the choice persists across reload — record to `.planning/PENDING-VERIFICATION.md` § Phase 45.

Note the existing Phase 45-01 deploy-coupling warning already in `PENDING-VERIFICATION.md`: the Settings default this plan wires (`'NLT'`) means new scripture fetches will fail until the owner deploys the NLT Cloud Function branch from 45-01 — no new action needed here, this plan does not change that warning's substance.

## Next Phase Readiness
- Plan 45-03 (per-slide `translationSource` provenance) and Plan 45-04 (consumption wiring: ESV/NLT fetch routing) both read `authStore.settings.bibleVersion`, which is now a real, tested, typed field — no blockers for either.
- No blockers.

---
*Phase: 45-esv-nlt-bible-version-selection*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: src/types/organization.ts
- FOUND: src/views/SettingsView.vue
- FOUND: .planning/phases/45-esv-nlt-bible-version-selection/45-02-SUMMARY.md
- FOUND commit: e0f8192 (feat: OrgSettings.bibleVersion field)
- FOUND commit: 48733be (feat: SettingsView.vue Bible Translation card)
