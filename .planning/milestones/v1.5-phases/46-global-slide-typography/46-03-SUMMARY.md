---
phase: 46-global-slide-typography
plan: 03
subsystem: frontend
tags: [vue, settings, typography, font-loading, vitest]

requires:
  - phase: 46-global-slide-typography
    plan: 02
    provides: "OrgSettings.slideTypography field/default and src/utils/slideTypography.ts (cssVarsFor, snapWeight, loadFontCss) — the single implementation this card's save/preview/family-change logic all consume"
provides:
  - "Slide Typography card in src/views/SettingsView.vue — font-family select, per-family weight select, Small/Medium/Large size radios, and a live Preview panel"
  - "The single write point for authStore.settings.slideTypography, writing the three settings.slideTypography.* leaf dot-paths in one updateDoc call"
  - "Family-change weight snap (via snapWeight) + on-demand loadFontCss for the previewed family"
affects: [46-04-render-site-application]

tech-stack:
  added: []
  patterns:
    - "Slide Typography card mirrors the Bible Translation card's exact shell/gating/save-revert pattern (rounded-lg bg-gray-900 card, editor-gated controls, leaf-dot-path updateDoc + whole-object store mirror, 2s Saved! feedback, revert-on-error)"
    - "Live Preview panel binds the same cssVarsFor() the render sites (46-04) will consume, so the Settings preview and the actual slides can never visually diverge"

key-files:
  created: []
  modified:
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts

key-decisions:
  - "The mirror-write assigns the WHOLE slideTypography object (authStore.settings.slideTypography = newValue) rather than three independent field mirrors — family/weight/scale are always saved together as one selection (unlike the independent boolean toggles elsewhere in Settings), so a single-object mirror is the correct granularity even though the Firestore write itself stays three separate leaf dot-paths."
  - "Split the plan's Task 1/Task 2 boundary as: Task 1 ships a working card with save wired directly to family/weight/scale changes (no snap/preview yet); Task 2 replaces the family-change handler with the snap-then-loadFontCss sequence and adds the Preview panel — keeps both commits independently working and testable rather than landing a broken intermediate state."
  - "Task 1 also touched SettingsView.test.ts to add mockSlideTypography get/set stubs to the existing auth-store mock (not new test cases — the existing 23 tests would otherwise crash on `authStore.settings.slideTypography.fontFamily` being undefined). New test cases were deferred to Task 3 per the plan."
  - "SettingsView.test.ts partially mocks @/utils/slideTypography (vi.importActual + override), keeping the REAL cssVarsFor/snapWeight so the snap test and the Preview's cssVarsFor assertions exercise the genuine SLIDE_FONTS ramp, while replacing only loadFontCss with a spy (no real @fontsource dynamic import in jsdom)."

patterns-established: []

requirements-completed: [R093]

coverage:
  - id: D1
    description: "Slide Typography card renders with heading, explanatory paragraph, and family/weight/size controls carrying the specified data-testids; editor-gated (disabled for non-editors)"
    requirement: "R093"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts — 'renders the Slide Typography heading, controls, and Preview panel', 'disables all three controls and blocks saving for a non-editor (viewer)'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Save writes the three settings.slideTypography.* leaf dot-paths in a single updateDoc call (never a whole-map write) and mirrors into authStore.settings.slideTypography; a save failure shows the exact error string and reverts the local selection"
    requirement: "R093"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts — 'saves family/weight/size as three leaf dot-paths and mirrors into the store', 'reverts the selection and surfaces the save-error string when the write rejects'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Changing family re-derives the weight options from SLIDE_FONTS[family].weights and snaps an unreachable weight (e.g. 300) to 400 before saving; Inter Light (300) is selectable"
    requirement: "R093"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts — 'snaps the weight to 400 when switching family to Lora while weight 300 is selected' (discoverable via -t \"snap\"), 'offers weight 300 (Inter Light) when Inter is the selected family'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The live Preview panel binds cssVarsFor(localSelection) and updates as family/weight/scale change, showing the sample line"
    requirement: "R093"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts — \"the live Preview reflects the current local selection's cssVarsFor output\""
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run type-check (vue-tsc --build) clean; full app suite at the documented pre-existing baseline with no new failures"
    requirement: "R093"
    verification:
      - kind: other
        ref: "npm run type-check clean after every task; npx vitest run (bare) reports 3 failed test files (src/storage.rules.test.ts, src/views/__tests__/RosterView.test.ts, render-service/src/render.test.ts) — all three pre-existing per .planning/phases/46-global-slide-typography/deferred-items.md, none touched by this plan's files"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-08
status: complete
---

# Phase 46 Plan 03: Settings "Slide Typography" Card Summary

**Added the "Slide Typography" card to Settings — font-family/weight selects, a Small/Medium/Large size control, and a live Preview bound to the shared `cssVarsFor` — as the single editor-gated write point for `authStore.settings.slideTypography`, with family-change weight snapping and on-demand font loading.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-08 (session start, first plan read)
- **Completed:** 2026-08-08
- **Tasks:** 3 (card markup + save; weight snap + preview; tests)
- **Files modified:** 2 (`src/views/SettingsView.vue`, `src/views/__tests__/SettingsView.test.ts`)

## Accomplishments

- Added a "Slide Typography" card to `SettingsView.vue`, mirroring the Bible Translation card's shell (`rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6`, `text-sm font-semibold text-gray-300` heading) and editor-gating pattern (`:disabled="!authStore.isEditor"`, `opacity-60 cursor-not-allowed` label state) exactly, per the UI-SPEC's Copywriting Contract verbatim copy (heading, explanatory paragraph, control labels, size labels, "Saved!"/error strings, and the sample preview line).
- Three controls — `slide-font-family-select`, `slide-font-weight-select`, and `slide-font-scale-sm|md|lg` radios — initialize from and stay synced with `authStore.settings.slideTypography` via a `watch`, and each change triggers `saveSlideTypography()`.
- `saveSlideTypography()` is editor-gated (`if (!authStore.orgId || !authStore.isEditor) return`), writes the three `settings.slideTypography.fontFamily/.fontWeight/.fontScale` leaf dot-paths in one `updateDoc` call (never a whole-map write), mirrors the whole object into `authStore.settings.slideTypography`, shows "Saved!" for 2s, and on failure shows "Couldn't save your slide typography settings. Try again." and reverts all three local refs to the last-saved values.
- `slideFontWeightOptions` computed re-derives the Weight `<select>`'s options from `SLIDE_FONTS[family].weights` every time the family changes.
- `onChangeSlideFontFamily()` calls `snapWeight(newFamily, currentWeight)` and assigns the result back to the local weight ref BEFORE saving — an unreachable weight (e.g. 300 selected, family switched to Lora which has no 300) snaps to 400 — and calls `loadFontCss(newFamily, snappedWeight)` to lazy-load that family's face on demand for the preview.
- Added a live Preview panel (`slide-typography-preview-label` + `slide-typography-preview`) whose `:style` binds `cssVarsFor({ fontFamily, fontWeight, fontScale })` from the local selection, applying `font-family: var(--slide-font-family)`, `font-weight: var(--slide-font-weight)`, and a scaled `font-size: calc(1rem * var(--slide-font-scale))`, rendering the sample line "Amazing grace, how sweet the sound." No spinner/error UI was added per the UI-SPEC's covered rows — a fetching family keeps the last face via the codebase's existing `font-display: swap` behavior, and a failed asset falls through the native CSS stack.
- Added a `describe('SettingsView Slide Typography card (R093) — 46-03', ...)` block with 7 test cases covering: rendering, three-leaf-dot-path save + store mirror, family-change snap (Inter 300 → Lora 400) with a `loadFontCss('Lora', 400)` assertion, save-error revert, non-editor gating (disabled controls + handler early-return), Inter weight-300 reachability, and the Preview's `cssVarsFor` reflection on family change.
- Extended the shared auth-store mock with a `mockSlideTypography` getter/setter (Task 1, required to keep the pre-existing 23 tests from crashing on the new `authStore.settings.slideTypography` read) and a partial `vi.mock('@/utils/slideTypography', ...)` that keeps the real `cssVarsFor`/`snapWeight` while spying on `loadFontCss` (Task 3).
- `npm run type-check` (`vue-tsc --build`) clean after every task. `npx vitest run src/views/__tests__/SettingsView.test.ts` green at 30/30 (23 pre-existing + 7 new).
- Full app suite (`npx vitest run`, bare) reports 3 failed test files — `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`, and `render-service/src/render.test.ts` — all three pre-existing per `.planning/phases/46-global-slide-typography/deferred-items.md` and CLAUDE.md's documented baseline; none touched by this plan's two files. 3030/3043 individual tests pass.

## Task Commits

1. **Task 1: Slide Typography card markup, local state, and editor-gated save** - `aac29a0` (feat)
2. **Task 2: Per-family weight re-derivation + snap, and the live Preview panel** - `09b760b` (feat)
3. **Task 3: SettingsView tests for save/persist, snap, editor gating, and Inter-300 reachability** - `87c20b3` (test)

## Files Created/Modified

- `src/views/SettingsView.vue` - Slide Typography card (family/weight/scale controls + live Preview panel), `saveSlideTypography()`, `onChangeSlideFontFamily()` (snap + on-demand load), `slideFontWeightOptions` and `slideTypographyPreviewStyle` computeds, watch on `authStore.settings.slideTypography`
- `src/views/__tests__/SettingsView.test.ts` - `mockSlideTypography` mock state + getter/setter, partial mock of `@/utils/slideTypography` (real `cssVarsFor`/`snapWeight`, spied `loadFontCss`), and the new Slide Typography `describe` block (7 tests)

## Decisions Made

- The Firestore write stays three independent leaf dot-paths (per the plan's explicit instruction, matching every sibling card's dot-path discipline and never clobbering a concurrent editor's write to a sibling `settings.*` key), but the local store mirror assigns the whole `slideTypography` object in one shot — family/weight/scale are inherently one selection saved together, unlike the independent boolean toggles elsewhere in this file.
- Split the plan's two markup/logic tasks so each commit leaves the card in a working, testable state: Task 1's family-change handler saves directly (no snap yet); Task 2 replaces its body with the snap + `loadFontCss` sequence and adds the Preview panel. This avoids a commit that ships a half-built card.
- Task 1 necessarily touched `SettingsView.test.ts` to extend the shared auth-store mock (`mockSlideTypography` getter/setter) — without it, all 23 pre-existing tests would crash on `authStore.settings.slideTypography.fontFamily` being `undefined`. This is a mock-shape fix, not new test coverage; new test cases were deferred to Task 3 as the plan specifies.

## Deviations from Plan

None — plan executed as written. The only addition beyond the plan's literal task text was extending the test mock's `settings` shape in Task 1 (see Decisions Made above), which is required scaffolding for Task 1's own verification command to pass, not a new feature.

## Known Stubs

None. The card is fully wired: it reads live from `SLIDE_FONTS`/`SLIDE_FONT_FAMILY_NAMES`, writes real Firestore dot-paths, mirrors into the real auth store, and the Preview renders the real `cssVarsFor` output — nothing here is a hardcoded/mock placeholder.

## Threat Flags

None beyond the plan's own declared `<threat_model>` (T-46-01, T-46-05). The save action only ever writes values sourced from `SLIDE_FONTS` keys and each family's own `weights` array (never free text), `snapWeight` guarantees a stored weight is always in-ramp, and the save control (and its handler guard) is gated on `authStore.isEditor` exactly like every sibling Settings card.

## Issues Encountered

None beyond the documented, pre-existing 3-file full-suite baseline (see Accomplishments) — out of scope per the SCOPE BOUNDARY rule and already logged in `deferred-items.md` from 46-01/46-02.

## User Setup Required

None.

## Next Phase Readiness

`authStore.settings.slideTypography` is now a live, editor-settable value with a real UI, ready for 46-04 to wire the three render sites (`PresentationViewer.vue`, the Slides grid, and the Edit Slide drawer preview) to consume the same `cssVarsFor()` this card's Preview already uses, and to wire `waitForSlideFont`/`FONT_LOAD_TIMEOUT_MS` into the presenter's `onMounted` for the R094 font-flash gate. No blockers.

---
*Phase: 46-global-slide-typography*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: src/views/SettingsView.vue
- FOUND: src/views/__tests__/SettingsView.test.ts
- FOUND commit: aac29a0
- FOUND commit: 09b760b
- FOUND commit: 87c20b3
