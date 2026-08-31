---
phase: 103-manual-fallback-when-bible-api-is-off
plan: 01
subsystem: ui
tags: [vue, vitest, bible-gateway, settings-gating]

# Dependency graph
requires:
  - phase: 101-org-level-bible-api-master-gate
    provides: authStore.isBibleApiEnabled computed
  - phase: 102-scripture-fetch-dispatcher-disabled-branch
    provides: "{status:'disabled'} dispatcher branch that Plan 02 will fill"
provides:
  - "bibleGatewayLink(ref, version?) exported from src/utils/scripture.ts — a reusable BibleGateway deep-link builder for the manual fallback"
  - "Settings 'Bible Translation' card hidden when an org's Bible API is off, mirroring the AI Features card gate"
affects: [103-02-manual-fallback-editor-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL builder delegates its reference string to the single canonical formatScriptureReference formatter rather than re-deriving it"
    - "Settings card visibility gated by a read-only authStore computed via v-if on the card's root div, mirroring the existing aiMasterEnabled pattern"

key-files:
  created: []
  modified:
    - src/utils/scripture.ts
    - src/utils/__tests__/scripture.test.ts
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts

key-decisions:
  - "bibleGatewayLink placed immediately after scriptureWebLink in scripture.ts (plan suggested ~line 87-104 near nltLink/scriptureWebLink) rather than earlier in the file, keeping all BibleGateway-related link builders adjacent"
  - "Empty-string version is treated as absent (falsy check), matching the plan's explicit empty-string test case rather than only checking for undefined"

requirements-completed: [R298, R300]

coverage:
  - id: D1
    description: "bibleGatewayLink(ref, version) returns a correct BibleGateway passage URL, URL-encoding the reference and optional version, omitting &version= when absent or empty"
    requirement: "R298"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scripture.test.ts#describe('bibleGatewayLink')"
        status: pass
    human_judgment: false
  - id: D2
    description: "Settings 'Bible Translation' card is hidden entirely when authStore.isBibleApiEnabled is false, and renders unchanged (ESV/NLT options, save logic) when true"
    requirement: "R300"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#describe('SettingsView Bible Translation card visibility (R300)')"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#describe('SettingsView Bible Translation card (R090) — 45-02')"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-31
status: complete
---

# Phase 103 Plan 01: BibleGateway Link Builder + Settings Card Gate Summary

**Added `bibleGatewayLink(ref, version?)` to scripture.ts and gated the Settings "Bible Translation" card behind `authStore.isBibleApiEnabled`, mirroring the existing AI Features card gate exactly.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-31T20:56:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `bibleGatewayLink` exported from `src/utils/scripture.ts`, delegating the search string to the canonical `formatScriptureReference` formatter and URL-encoding both the reference and an optional version, appending `&version=` only when a non-empty version string is supplied.
- 5 new unit test cases covering: verse-range + version, single-verse + no version (asserts no `&version=`), chapter-only + version, multi-word book name encoding, and an empty-string version treated as absent.
- Settings "Bible Translation" card wrapped in `v-if="authStore.isBibleApiEnabled"`, mirroring the "AI Features" card's `v-if="authStore.aiMasterEnabled"` gate exactly — no change to `bibleVersionInput`, the ESV/NLT radios, `onChangeBibleVersion`, or the save/persist logic.
- New `describe('SettingsView Bible Translation card visibility (R300)')` block with two tests (hidden when off, shown when on); `mockBibleApiEnabled` (default `true`) added to the test harness and reset in all 9 pre-existing `beforeEach` blocks so every prior R090 Bible Translation test keeps seeing the card.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the bibleGatewayLink deep-link builder + unit tests (R298)** - `449a1ae2` (feat)
2. **Task 2: Gate the Settings "Bible Translation" card on isBibleApiEnabled + visibility tests (R300)** - `d7322325` (feat)

## Files Created/Modified
- `src/utils/scripture.ts` - added `bibleGatewayLink(ref, version?)` next to `scriptureWebLink`
- `src/utils/__tests__/scripture.test.ts` - added `describe('bibleGatewayLink')` with 5 test cases
- `src/views/SettingsView.vue` - added `v-if="authStore.isBibleApiEnabled"` to the Bible Translation card's root div
- `src/views/__tests__/SettingsView.test.ts` - added `mockBibleApiEnabled` module var + `isBibleApiEnabled` getter on the mocked auth store, reset it in all 9 existing `beforeEach` blocks, added the new R300 visibility describe block

## Decisions Made
- Placed `bibleGatewayLink` immediately after `scriptureWebLink` (adjacent to the other BibleGateway/ESV link builders) rather than earlier in the file, for discoverability.
- Treated an empty-string `version` argument as absent via a plain falsy check (`version ? ... : ...`), matching the plan's explicit empty-string test case.

## Deviations from Plan

None - plan executed exactly as written.

One execution-only wrinkle (not a plan deviation, no code impact): `SettingsView.test.ts` uses CRLF line endings throughout. The 9 `beforeEach` block insertions were made with a CRLF-aware script to avoid corrupting line endings; final file state and diff are clean (`git diff --stat` shows only additive line insertions, no line-ending churn beyond the new lines).

## Issues Encountered
None - both task verifications passed on the first implementation pass.

## User Setup Required
None - no external service configuration required. This phase is client-only; no deploy performed (per CLAUDE.md/CONTEXT.md deploy note).

## Next Phase Readiness
- Plan 02 (manual-fallback editor UI in `ScriptureInput.vue` / `CongregationalEditor.vue`) can now import `bibleGatewayLink` from `src/utils/scripture.ts` directly.
- No blockers. `npm run type-check` is clean; `npx vitest run` shows exactly the documented 2-file baseline (`src/storage.rules.test.ts`, `src/stores/appConfig.test.ts`) with no new regressions.

---
*Phase: 103-manual-fallback-when-bible-api-is-off*
*Completed: 2026-08-31*

## Self-Check: PASSED

All created/modified files confirmed present on disk; both task commits (`449a1ae2`, `d7322325`) confirmed in git log.
