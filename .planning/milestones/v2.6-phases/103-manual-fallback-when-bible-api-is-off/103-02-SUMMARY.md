---
phase: 103-manual-fallback-when-bible-api-is-off
plan: 02
subsystem: ui
tags: [vue, vitest, bible-gateway, congregational-reading, ai-gate-independence]

# Dependency graph
requires:
  - phase: 103-01
    provides: "bibleGatewayLink(ref, version?) exported from src/utils/scripture.ts"
  - phase: 102-scripture-fetch-dispatcher-disabled-branch
    provides: "{status:'disabled'} dispatcher branch this plan fills in both editors"
provides:
  - "ScriptureInput.vue disabled-branch fallback: intro copy + BibleGateway deep-link + paste-into-previewText textarea"
  - "CongregationalEditor.vue disabled-branch fallback: intro copy + BibleGateway deep-link + paste-into-rawPassage/text textarea, AI-split gate kept independent"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual-fallback textarea writes directly into the SAME reactive state the fetched-text path already used (previewText in ScriptureInput; rawPassage+text in CongregationalEditor), rather than introducing a parallel content path"
    - "Fallback UI gated purely on !authStore.isBibleApiEnabled, with zero coupling to the AI gate (authStore.isAiEnabled) — proven by two opposing independence tests in CongregationalEditor"

key-files:
  created: []
  modified:
    - src/components/ScriptureInput.vue
    - src/components/__tests__/ScriptureInput.test.ts
    - src/components/CongregationalEditor.vue
    - src/components/__tests__/CongregationalEditor.test.ts

key-decisions:
  - "ScriptureInput's paste textarea binds straight to previewText (the existing preview-panel state) rather than an intermediate ref, since the component is preview-only and previewText already IS the canonical fetched-preview content"
  - "CongregationalEditor's paste textarea uses a dedicated pastedText ref + explicit @input handler (not v-model straight into text) because the paste content must be transformed (stripVerseMarkers + 'Leader\\n' seed) before landing in rawPassage/text — mirroring autoFetch's ok-branch assignment exactly"
  - "Applied the paste transform on every 'input' event (not blur) for both components, matching the simplicity of a single paste-and-done flow and avoiding an extra explicit 'apply' action not required by the UI-SPEC"

requirements-completed: [R298, R299]

coverage:
  - id: D1
    description: "ScriptureInput: when Bible API is off and a reference is typed, the intro copy, a correct BibleGateway deep-link (target=_blank rel=noopener, encoded reference + version), and a paste textarea all render; pasted text appears in the shared preview panel; the empty-state helper shows with no reference; nothing renders when Bible API is on"
    requirement: "R298, R299"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ScriptureInput.test.ts#describe('Manual fallback when Bible API is off (103-02, R298/R299)')"
        status: pass
    human_judgment: false
  - id: D2
    description: "CongregationalEditor: when Bible API is off, the intro copy, deep-link, and paste textarea render; pasted text populates rawPassage/text so Save persists parsed sections; the existing `---`-delimited textarea remains present and functional"
    requirement: "R298, R299"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts (deep-link + paste->Save tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gate independence: Bible-off + AI-on runs the existing Split-with-AI action on the pasted text; Bible-off + AI-off hides the split button entirely while paste + manual sectioning still work — proving the Bible gate and AI gate are never coupled"
    requirement: "R299"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#describe('INDEPENDENCE: ...')"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-08-31
status: complete
---

# Phase 103 Plan 02: Manual Fallback UI in Both Scripture Editors Summary

**Filled the existing `{status:'disabled'}` no-op branches in `ScriptureInput.vue` and `CongregationalEditor.vue` with a first-class, non-error fallback: intro copy, an "Open in BibleGateway" deep-link, and a paste textarea whose text flows into the same downstream state the fetched text always used — with the congregational AI-split action verified to stay gated strictly independently of the Bible-API gate.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-31
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `ScriptureInput.vue`: added a fallback block, rendered only when `!authStore.isBibleApiEnabled`, containing the UI-SPEC intro copy, an "Open in BibleGateway" anchor (`target="_blank" rel="noopener"`) built by a new `fallbackBibleGatewayLink` computed calling `bibleGatewayLink(currentRef, effectiveVersion)`, and a paste textarea bound directly to the existing `previewText` ref — so pasted text renders in the same preview panel the fetched preview text always used. An empty-state helper shows when nothing has been pasted; the anchor is hidden when no reference is entered; nothing in the block renders when Bible API is enabled.
- `CongregationalEditor.vue`: added the mirror fallback block above the existing `---`-delimited textarea, using a new `fallbackBibleGatewayLink` computed (`bibleGatewayLink(props.reference, props.bibleVersion ?? authStore.settings.bibleVersion)`, matching `autoFetch`'s version resolution exactly) and a new `pastedText` ref + `onPasteInput` handler that writes `stripVerseMarkers(pasted)` into `rawPassage` and seeds `text` with `Leader\n<stripped>` — byte-for-byte the same assignment `autoFetch`'s `status==='ok'` branch performs. This makes `hasPassageToSplit` true on paste, so the existing `onAiSplit`/`splitCongregationalReading` and `onSave`/`parseCongregationalText` paths operate on pasted text with no new code in either.
- Verified and locked in the gate-independence requirement (R299) with two opposing tests: Bible-off + AI-on shows the "Split with AI" button and calls `splitCongregationalReading` with the pasted text; Bible-off + AI-off hides the button entirely while the paste path still populates the reading. No `isBibleApiEnabled` condition was added anywhere near the AI split button or `onAiSplit`.
- 4 new tests in `ScriptureInput.test.ts` (deep-link + textarea rendering, paste-to-preview-panel, no-reference empty state, enabled-path absence) and 5 new tests in `CongregationalEditor.test.ts` (deep-link + textarea rendering, paste-to-Save round trip, the two independence cases, enabled-path absence).

## Task Commits

Each task was committed atomically:

1. **Task 1: ScriptureInput.vue disabled-branch fallback UI + tests (R298 deep-link, R299 paste)** - `20805a75` (feat)
2. **Task 2: CongregationalEditor.vue disabled-branch fallback UI + AI-independence tests (R298, R299)** - `3329699d` (feat)

## Files Created/Modified

- `src/components/ScriptureInput.vue` - added the disabled-branch fallback block (intro + deep-link + paste textarea bound to `previewText`), the `bibleGatewayLink` import, and the `fallbackBibleGatewayLink` computed
- `src/components/__tests__/ScriptureInput.test.ts` - added `bibleGatewayLink` to the `@/utils/scripture` mock factory and a new `describe('Manual fallback when Bible API is off (103-02, R298/R299)')` block with 4 tests
- `src/components/CongregationalEditor.vue` - added the disabled-branch fallback block, the `bibleGatewayLink` import, the `pastedText` ref, the `fallbackBibleGatewayLink` computed, and the `onPasteInput` handler
- `src/components/__tests__/CongregationalEditor.test.ts` - added 5 new tests covering deep-link rendering, paste->Save, and the two AI-gate independence cases

## Decisions Made

- ScriptureInput's paste textarea binds directly to `previewText` (no intermediate state) since the component is preview-only and `previewText` already is the canonical displayed content — this is literally the plan's instructed behavior ("write the pasted value into previewText").
- CongregationalEditor's paste textarea uses a dedicated `pastedText` display ref plus an explicit `@input` handler (rather than v-model straight into `text`) because the paste content must be transformed (`stripVerseMarkers` + `Leader\n` seed) before it becomes valid editor content — mirroring `autoFetch`'s assignment exactly rather than inventing a second transform path.
- Applied both paste transforms on every `input` event rather than gating behind blur/an explicit "Use this text" button — the plan left this at Claude's discretion, and a live update matches the natural single-paste-then-done flow with no extra affordance needed.

## Deviations from Plan

None — plan executed exactly as written. Both fallback blocks were placed as instructed (ScriptureInput: near the preview button/panel, after the reader link; CongregationalEditor: above the existing textarea, after the fetch-error notice), and the AI split gate in CongregationalEditor was left untouched — no `isBibleApiEnabled` condition was added to it, verified by the two INDEPENDENCE tests passing.

## Issues Encountered

None — both task verifications (`npx vitest run` on the respective test file, `npm run type-check`) passed on the first implementation pass. A full bare `npx vitest run` afterward showed exactly the two documented baseline failures (`src/storage.rules.test.ts`, `src/stores/appConfig.test.ts`) with zero new regressions across 4792 passing tests.

## User Setup Required

None — no external service configuration required. This phase is client-only; no deploy performed (per CLAUDE.md/CONTEXT.md deploy note — `firebase deploy` was not run).

## Next Phase Readiness

- Phase 103 (v2.6's last phase) is now functionally complete: R298 (BibleGateway deep-link), R299 (paste-in fallback with independent AI gate), and R300 (Settings card hide, from Plan 01) are all implemented and tested.
- No blockers. `npm run type-check` is clean; the app test suite shows only the pre-existing 2-file baseline.
- The milestone-end, owner-gated deploy batch (Hosting) remains pending per CONTEXT.md's deploy note — not run in this phase, per client-only scope.

---
*Phase: 103-manual-fallback-when-bible-api-is-off*
*Completed: 2026-08-31*

## Self-Check: PASSED

All modified files confirmed present on disk; both task commits (`20805a75`, `3329699d`) confirmed in git log.
