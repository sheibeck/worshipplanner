---
phase: 52-default-service-template
plan: 02
subsystem: services
tags: [vue, typescript, template-editor, r114, r116]

# Dependency graph
requires:
  - phase: 52-01
    provides: "buildSuggestedTemplateEntries() shared preset; ServiceTemplateEntry.body?: string"
provides:
  - "Template editor seed button labelled 'Suggested Template' (testid template-reset retained), seeding via the shared buildSuggestedTemplateEntries()"
  - "template-item-body textarea for MISC/ANNOUNCEMENTS template rows, bound to entry.body via onBodyChange (empty → undefined)"
affects: [52-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source seed: editor applyReset consumes the same buildSuggestedTemplateEntries() the createService fallback uses — no forked 1-2-2-3 copy"
    - "Empty → undefined body normalization mirrors onSectionChange so stripUndefined keeps a cleared body absent from Firestore"
    - "Auto-escaped :value/@input textarea binding (no v-html) mirrors the live editor's MISC body input (T-52-03)"

key-files:
  created: []
  modified:
    - src/components/settings/ServiceTemplateEditor.vue
    - src/components/settings/__tests__/ServiceTemplateEditor.test.ts

key-decisions:
  - "Template body input scoped to MISC and ANNOUNCEMENTS (MISC is the R116 ask; ANNOUNCEMENTS mirrors the owner's literal 'more announcement slides' example); MESSAGE left without a template body input — the data path (52-01) supports all three, this is purely which rows show the control"
  - "applyReset replaced its inline buildSlots('1-2-2-3').map copy with the shared buildSuggestedTemplateEntries(); the now-dead buildSlots import was removed"
  - "No VW v-if existed on the seed button — R114 is a pure label/copy rename; confirmed and left untouched (no testid churn)"

patterns-established:
  - "onBodyChange follows onSectionChange's empty → undefined contract for optional-field edits"

requirements-completed: [R114, R116]

coverage:
  - id: E1
    description: "Seed button reads 'Suggested Template', keeps data-testid template-reset; confirm and empty-state copy carry no 1-2-3 / Vertical Worship framing (R114)"
    requirement: "R114"
    verification:
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#labels the seed button \"Suggested Template\" while keeping the template-reset testid"
        status: pass
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#shows the Replace Template confirm first when the draft is non-empty, and Cancel leaves it untouched"
        status: pass
    human_judgment: false
  - id: E2
    description: "Clicking 'Suggested Template' seeds the 9-entry suggested order via the shared buildSuggestedTemplateEntries() (empty applies immediately; non-empty confirms first) (R114)"
    requirement: "R114"
    verification:
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#applies directly (no confirm) when the draft is empty, loading a content-free 9-item shape"
        status: pass
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#Replace Template applies the 1-2-3 shape after the confirm"
        status: pass
    human_judgment: false
  - id: E3
    description: "MISC and ANNOUNCEMENTS template rows render a template-item-body textarea bound to entry.body; non-body kinds render none; typing persists through save; clearing to empty strips body (R116)"
    requirement: "R116"
    verification:
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#renders a template-item-body textarea for a MISC row, bound to entry.body"
        status: pass
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#renders a template-item-body textarea for an ANNOUNCEMENTS row"
        status: pass
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#renders no template-item-body textarea for non-body kinds (SONG / PRAYER)"
        status: pass
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#typing sets the draft entry body; the save payload carries the typed text"
        status: pass
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#clearing the body to empty leaves the saved entry bodyless (undefined stripped)"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-08-11
status: complete
---

# Phase 52 Plan 02: Default Service Template — Editor UI Summary

**Renamed the template editor's seed control to "Suggested Template" (seeding through the one shared `buildSuggestedTemplateEntries()` preset, no forked copy) and exposed a `template-item-body` textarea for MISC/ANNOUNCEMENTS rows bound to `ServiceTemplateEntry.body`, normalizing a cleared body back to absent.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-08-11T20:38:12Z
- **Completed:** 2026-08-11T20:47:33Z
- **Tasks:** 2 (each TDD RED→GREEN)
- **Files modified:** 2

## Accomplishments
- **R114:** The seed button now reads "Suggested Template" (data-testid `template-reset` unchanged). The confirm-on-non-empty copy and the empty-state copy both dropped the "standard 1-2-3 flow" / "Vertical Worship" framing. `applyReset` now seeds from the shared `buildSuggestedTemplateEntries()` (52-01) instead of an inline `buildSlots('1-2-2-3').map(...)` copy, and the now-dead `buildSlots` import was removed. Confirmed there was no VW `v-if` on the button — R114 was a pure label/copy rename with no testid churn.
- **R116 (UI half):** MISC and ANNOUNCEMENTS template rows now render a `template-item-body` textarea bound `:value="entry.body ?? ''"` with an `@input="onBodyChange(...)"`. `onBodyChange` mirrors `onSectionChange`'s empty → `undefined` rule, so a cleared body stays bodyless through `onSave`'s existing `stripUndefined` and never reaches Firestore as `body: undefined`. Non-body kinds (SONG/SCRIPTURE/PRAYER/MESSAGE) render no textarea.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED — Suggested Template label + confirm-copy assertions** - `32ea2f5` (test)
2. **Task 1 GREEN — rename seed control, seed via shared preset, drop buildSlots** - `004e975` (feat)
3. **Task 2 RED — template-item-body textarea assertions (MISC/ANNOUNCEMENTS)** - `34583f4` (test)
4. **Task 2 GREEN — expose the body textarea + onBodyChange handler** - `95c0156` (feat)

## Files Created/Modified
- `src/components/settings/ServiceTemplateEditor.vue` — Seed button label + confirm + empty-state copy reworded off the 1-2-3/VW framing; `applyReset` → `buildSuggestedTemplateEntries()`; `buildSlots` import removed; added the MISC/ANNOUNCEMENTS `template-item-body` textarea and the `onBodyChange` handler; reworded the seed-section comment.
- `src/components/settings/__tests__/ServiceTemplateEditor.test.ts` — Renamed the seed describe to "Suggested Template seed (R114)"; added a button-label assertion; updated the confirm-copy assertion; added a "template-item body (R116)" describe with 5 assertions (MISC renders + bound, ANNOUNCEMENTS renders, non-body kinds render none, typing persists through save, clearing strips body).

## Decisions Made
- Template body input scoped to **MISC and ANNOUNCEMENTS** only (recorded plan decision). MESSAGE is left without a template-body input; the 52-01 data path already supports all three body-bearing kinds, so this is purely which rows surface the control.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations
- **T-52-03 (stored XSS):** the body textarea renders only through Vue `:value` / `@input` auto-escaped binding; no `v-html` was introduced, matching the live editor's escaped body input.
- **T-52-05 (undefined→Firestore):** `onBodyChange` normalizes empty → `undefined`; `onSave`'s existing `stripUndefined` drops it — verified by the "clearing the body to empty leaves the saved entry bodyless" test.

## Verification
- `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` — **27 passed**.
- `npm run type-check` (vue-tsc --build, checks test files) — **clean**.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — 2 failed files / 13 failed tests, **exactly the documented baseline**: `src/storage.rules.test.ts` (12 fails, Storage-emulator cross-service limitation with no emulator up) + `src/views/__tests__/RosterView.test.ts` (1 stale assertion). This plan touches neither file; no regression introduced.

## Issues Encountered
None.

## User Setup Required
None.

## Self-Check: PASSED
- `src/components/settings/ServiceTemplateEditor.vue` and `src/components/settings/__tests__/ServiceTemplateEditor.test.ts`: modified and present.
- Commits `32ea2f5`, `004e975`, `34583f4`, `95c0156`: present in git log.

---
*Phase: 52-default-service-template*
*Completed: 2026-08-11*
