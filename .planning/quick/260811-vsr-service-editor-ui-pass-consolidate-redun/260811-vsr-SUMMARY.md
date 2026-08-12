---
phase: 260811-vsr-service-editor-ui-pass
plan: 01
subsystem: ui
tags: [vue, tailwind, service-editor, notes-canonical, aria-menu, responsive, planning-center]

# Dependency graph
requires:
  - phase: 54 (v1.5, archived)
    provides: slot-level notes field (side-by-side sm:w-64 layout, now walked back)
  - phase: 43 (v1.5, archived)
    provides: shared MESSAGE/ANNOUNCEMENTS/MISC body textarea + PC-export bodyDescription
provides:
  - "Notes-canonical consolidation: plain kinds render ONE free-text field (notes ?? body read, notes write)"
  - "Read-side consumers (ServicePrintLayout, Planning Center export) migrated to notes ?? body"
  - "Per-row ⋯ menu owning Move-to-section + Delete (replaces inline section <select> and inline ✕)"
  - "Three-rail row layout (handle · badge rail · field column · action rail), capped, mobile single-stack"
  - "kindBadgeClass(kind) per-kind colored badge; slotFreeText/notesPlaceholder helpers"
  - "Muted/dashed No-Section band for the ungrouped bucket"
affects: [service-editor, planning-center-export, service-print, slot-layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "notes-canonical read-fallback: read `notes ?? body`, write `notes`; legacy `body` retained (non-destructive)"
    - "Inline ARIA menu mirroring SlideActionMenu (trigger + fixed backdrop + absolute role=menu panel), single-open keyed on stable id"
    - "Three-rail responsive row: flex-col below sm, flex-row items-start at sm+ (QuarterView recipe)"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/components/ServicePrintLayout.vue
    - src/utils/planningCenterApi.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/__tests__/ServicePrintLayout.test.ts
    - src/utils/__tests__/planningCenterApi.test.ts

key-decisions:
  - "Consolidated field is an <input type=text> (single-line), not a textarea — migrated E-11 to drop its embedded newline (jsdom sanitizes newlines out of text inputs)"
  - "Migrated ALL section-select / remove-control tests (not just the plan-named ones) to drive the ⋯ menu via 3 shared module-level helpers — required to keep the suite green at the 2-file baseline"
  - "Badge rail uses sm:w-32 and always renders the kind label; SONG's vwTypes SongBadge kept separately in the field column"
  - "No-Section band deliberately NOT section-header-* testid and carries no count/add-item, preserving the 'exactly 5 headers' assertions"

patterns-established:
  - "slotFreeText(slot) = notes ?? (slot as NonAssignableSlot).body — single read source for the consolidated field"
  - "kindBadgeClass(kind) central per-kind Tailwind pill map (muted/dark gray+indigo theme)"

requirements-completed: [VSR-1, VSR-2, VSR-3, VSR-4, VSR-5]

coverage:
  - id: D1
    description: "Plain kinds (Prayer/Message/Announcements/Misc) render exactly ONE free-text field reading notes ?? body and writing notes; legacy body-only items still display/print/export (VSR-1/VSR-5)"
    requirement: "VSR-1"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#E-02/E-06/E-09/E-11; R122 (a)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/ServicePrintLayout.test.ts#notes-canonical print (notes ?? body)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/planningCenterApi.test.ts#notes-canonical export (notes ?? body)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-row ⋯ menu owns Move-to-section (onSectionChange) and Delete (removeSlot); inline section select and ✕ removed; menu absent for viewers/locked; closes on outside-click/selection (VSR-4)"
    requirement: "VSR-4"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#per-row ⋯ menu (260811-vsr) describe (single-open, outside-click, move, no-section, delete-confirm) + non-editor absence"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three-rail stacked row layout (handle · w-32 badge rail · field column · right action rail), capped at max-w-[1060px], per-kind colored badge via kindBadgeClass, notes full-width (no sm:w-64) (VSR-2)"
    requirement: "VSR-2"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#R122 (b) three-rail + (b2) per-kind badge kindBadgeClass/slotLabel"
        status: pass
    human_judgment: true
    rationale: "Automated tests prove structure/classes/badge text, but the visual feel, spacing rhythm, badge tints, and mobile single-stack at ~390px are owner visual judgments jsdom cannot make — deferred to PENDING-VERIFICATION.md under the v1.6 grant."
  - id: D4
    description: "Muted/dashed No-Section band for the ungrouped bucket when non-empty, distinct from the 5 real section headers; absent when all slots are sectioned (VSR-3)"
    requirement: "VSR-3"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#renders a muted/dashed no-section-band; does not render when every slot is sectioned"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-08-12
status: complete
---

# Quick Task 260811-vsr: Service Order editor UI pass — consolidate, three-rail, ⋯ menu, No-Section band

**Redesigned the Service Order tab into a capped three-rail row layout (colored per-kind badge → stacked field + full-width notes → right ⋯ menu), consolidated plain kinds to one notes-canonical field (`notes ?? body` read, `notes` write) with print + Planning Center consumers migrated, relocated section-change + delete into a per-row ⋯ menu, and added a muted/dashed "No Section" band — data model untouched.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-12T03:34:07Z
- **Completed:** 2026-08-12T04:14:44Z
- **Tasks:** 4 (each an atomic commit)
- **Files modified:** 6

## Accomplishments
- **VSR-1/VSR-5:** Prayer/Message/Announcements/Misc now render exactly ONE free-text field. It reads `notes ?? body` (legacy body-only items still show/print/export) and writes `notes`. `body`/`linkUrl`/`linkLabel` retained on the type and in Firestore — UI removal only. `ServicePrintLayout` and Planning Center export migrated to `notes ?? body` (MESSAGE's `sermonPassage` fallback preserved).
- **VSR-4:** A per-row, editor-only ⋯ menu owns Move-to-section (→ `onSectionChange`) and Delete (→ `removeSlot`). The inline section `<select>` and inline ✕ are gone. Mirrors `SlideActionMenu`'s ARIA pattern inline; single-open keyed on `slot.id`; closes on outside-click and selection; absent for viewers/locked.
- **VSR-2:** Every row is a four-zone three-rail layout (drag handle · `sm:w-32` colored per-kind badge rail · `flex-1` field column with the selector/content stacked above a full-width notes field · right-aligned action rail). List column capped at `max-w-[1060px]`; row is single-stack below `sm`. Per-kind badge tints via `kindBadgeClass`.
- **VSR-3:** The ungrouped/legacy bucket gets a muted/dashed "No Section" band when non-empty, distinct from the real section headers.

## Task Commits

1. **Task 1: Notes-canonical consolidation + migrate read-side consumers** — `35cdc0e` (feat)
2. **Task 2: Per-row ⋯ menu owns Move-to-section + Delete** — `72b4301` (feat)
3. **Task 3: Three-rail stacked row layout + per-kind badge + capped column** — `d0157d9` (feat)
4. **Task 4: Muted/dashed No-Section band** — `1094282` (feat)

_Note: Task 1 was a TDD-flagged task; executed as a single atomic feat commit (test + impl together) since the test migration and source change are inseparable for a markup consolidation._

## Files Created/Modified
- `src/views/ServiceEditorView.vue` — consolidated field (slotFreeText/notesPlaceholder), removed plain-kind body textarea + Prayer link inputs, per-row ⋯ menu (openRowMenuId/toggleRowMenu), three-rail layout + kindBadgeClass + badge rail, No-Section band, list-column cap
- `src/components/ServicePrintLayout.vue` — MESSAGE/ANNOUNCEMENTS/MISC render `notes ?? body`
- `src/utils/planningCenterApi.ts` — ANNOUNCEMENTS/MISC/MESSAGE export `bodyDescription(slot.notes ?? slot.body)`
- `src/views/__tests__/ServiceEditorView.test.ts` — migrated body/notes tests, migrated ALL section-select + remove-control tests to the ⋯ menu (3 shared helpers), added menu/badge/No-Section tests
- `src/components/__tests__/ServicePrintLayout.test.ts` — added notes-canonical print cases
- `src/utils/__tests__/planningCenterApi.test.ts` — added notes-canonical export cases

## Decisions Made
- The consolidated field is a single-line `<input type="text">` (the pre-existing notes field), not a multi-line textarea. jsdom sanitizes newlines out of text inputs, so the migrated E-11 verbatim round-trip drops its embedded newline and asserts space/multi-byte/emoji only.
- The plan named only a subset of section-select tests to migrate, but removing the inline `<select>` and `title="Remove element"` control broke ~18 more tests across 5 describes. All were migrated to the ⋯ menu via three shared module-level helpers (`openRowMenu`, `moveSlotViaRowMenu`, `deleteSlotViaRowMenu`) plus a rewritten `openDeleteConfirm`. This was required to satisfy the hard constraint that any non-baseline failure is a regression.
- Kept SONG's vwTypes `SongBadge` inside the field column (separate from the new kind badge rail), per DESIGN-SPEC.

## Deviations from Plan

None that changed behavior or scope. All source changes match the plan's specified data-flow (notes-canonical consolidation + control relocation only). The only expansion beyond the plan's literal wording was **test coverage**: migrating the full set of `section-select`/`Remove element` test usages (not just the plan-listed ones) to the ⋯ menu — necessary and in-scope "update tests in lockstep," no production-behavior impact.

## Issues Encountered
- Restructuring the `.slot-item` row required rebalancing nested `<div>`s (collapsing the Phase-54 side-by-side wrapper + selector column + notes column into one field column). Verified structurally clean via `vue-tsc --build` (template compiles) before running tests.

## Verification

- **Type gate:** `npm run type-check` (vue-tsc --build) — clean after every task.
- **App suite:** `npx vitest run --dir src --exclude '**/rules.test.ts'` — **2 failed / 97 passed files; 13 failed tests total = the EXACT known baseline**: `src/storage.rules.test.ts` (12, Storage-emulator cross-service limitation) and `src/views/__tests__/RosterView.test.ts` (1, stale assertion). No other regression.
- **Per-file (task gates):** `ServiceEditorView.test.ts` 274 passed; `ServicePrintLayout.test.ts` + `planningCenterApi.test.ts` all passed.
- **Spot-check:** confirmed no consumer reads bare `slot.body` for plain kinds — ServicePrintLayout, planningCenterApi, and the editor field all read `notes ?? body` / `slotFreeText`.

## User Setup Required
None.

## Deferred (owner visual verification)
Owner visual/feel + mobile (~390px) verification is DEFERRED under the v1.6 standing autonomy grant and recorded in `.planning/PENDING-VERIFICATION.md` (new "Quick task 260811-vsr" section). Not self-approved.

## Known Stubs
None.

## Next Phase Readiness
- Automated gates green at the known 2-file baseline; owner visual/mobile pass is the only outstanding item and is logged for deferred verification.

## Self-Check: PASSED
- All four task commits found in history (35cdc0e, 72b4301, d0157d9, 1094282).
- Modified files present; SUMMARY.md and PENDING-VERIFICATION.md written.

---
*Quick task: 260811-vsr-service-editor-ui-pass*
*Completed: 2026-08-12*
