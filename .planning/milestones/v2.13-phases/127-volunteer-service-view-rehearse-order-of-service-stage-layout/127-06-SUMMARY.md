---
phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout
plan: 06
subsystem: volunteer-service-view
tags: [vue, view, router, rehearse, tabs, mobile-reflow, integration]

# Dependency graph
requires:
  - phase: 127-05
    provides: "useVolunteerServiceDoc(serviceId) — orgId-from-store resolution + live get-arm re-fetch + 4-state machine"
  - phase: 127-02
    provides: "RehearseSongList.vue / RehearseSongDetail.vue"
  - phase: 127-03
    provides: "RehearseFileReader.vue / RehearseAudioPlayerBar.vue"
  - phase: 127-04
    provides: "VolunteerOrderOfService.vue / VolunteerStageLayoutTab.vue"
provides:
  - "src/views/VolunteerServiceView.vue — the standalone, read-only tri-tab shell that replaces VolunteerServicePlaceholderView at /volunteer/service/:serviceId (R384, R391)"
  - "/volunteer/service/:serviceId now resolves to a real, functional volunteer-facing screen (route swap + placeholder removal)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Duplicate-render-gated-by-CSS-breakpoint for structurally different DOM trees (3-column desktop vs. drill-down mobile) — two full instances of RehearseSongList/RehearseSongDetail/RehearseFileReader exist in the DOM simultaneously, one under `hidden sm:flex`, one under `sm:hidden`, rather than a single JS-driven conditional mount. The ONE RehearseAudioPlayerBar instance is the exception — rendered once, outside both branches, per 127-PATTERNS.md Pattern 3."
    - "Whole-view state machine (loading/access-denied/load-failure/populated) driven entirely by a composable's reactive state, with the top bar always rendered above all four branches — mirrors MyScheduleView.vue's own loading/error/empty/populated structure."

key-files:
  created:
    - src/views/VolunteerServiceView.vue
    - src/views/__tests__/VolunteerServiceView.test.ts
  modified:
    - src/router/index.ts
  deleted:
    - src/views/VolunteerServicePlaceholderView.vue

key-decisions:
  - "RehearseAudioPlayerBar is always mounted with `fixed-bottom` true (not conditionally `!isDesktop` via the existing `useIsMobile` composable) — the must_haves only require ONE persistent instance outside both conditional chains, never that it distinguish desktop-inline vs. mobile-pinned CSS. Adding JS breakpoint tracking for a purely cosmetic difference the acceptance criteria don't test would add untested surface for no required behavior — same scope-boundary reasoning 127-03's SUMMARY used for its own 'no autoplay' call."
  - "Song selection (`selectSong`) and open-pdf (`onOpenPdf`) handlers are shared verbatim between the desktop and mobile branches — both always set `mobileScreen`, which is simply unused/harmless on the desktop branch. This avoids two near-duplicate handler sets for the same semantic action."
  - "`selectedAttachment` resets to `undefined` whenever a different song is selected — not explicitly required by must_haves, but prevents a stale PDF from a previously-selected song appearing in the reader before the volunteer taps a new one (Rule 1-adjacent correctness call, not a deviation since no must_have contradicts it)."
  - "No `ccliNumber` prop is passed to RehearseSongDetail — `RehearseSong` (Plan 01/02's projection) never added a CCLI field to the doc, so the component's own graceful-omission default (`ccliNumber` undefined) is used as-is. Not a deviation: 127-UI-SPEC.md flagged this as the planner's discretion and Plans 01/02 already decided not to add it."

requirements-completed: [R384, R391]

coverage:
  - id: D1
    description: "Opening /volunteer/service/:serviceId renders VolunteerServiceView (never ServiceEditorView) with a top bar, service header (‹ My Schedule + name + date), and a Rehearse/Order of Service/Stage Layout tablist defaulting to Rehearse; tabs switch on click and ArrowRight/ArrowLeft/Home/End (roving tabindex)"
    requirement: "R384"
    verification:
      - kind: unit
        ref: "src/views/__tests__/VolunteerServiceView.test.ts — 'renders the service header...Rehearse is the default active tab', 'switches tabs on click', 'switches tabs on ArrowRight/ArrowLeft/Home/End'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The four whole-view states (loading/access-denied/load-failure/populated) render their distinct copy off useVolunteerServiceDoc's state machine, with Retry calling the composable's retry() and Back-to-My-Schedule linking to /my-schedule"
    requirement: "R384"
    verification:
      - kind: unit
        ref: "src/views/__tests__/VolunteerServiceView.test.ts — 'shows the loading copy', 'shows the access-denied copy with a Back to My Schedule link', 'shows the load-failure copy and Retry calls the composable retry()'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Populated state mounts the three tab bodies (Rehearse leaves, VolunteerOrderOfService, VolunteerStageLayoutTab), all fed from the loaded doc; the first song is selected by default and an empty song list shows the empty copy"
    requirement: "R384"
    verification:
      - kind: unit
        ref: "src/views/__tests__/VolunteerServiceView.test.ts — 'mounts all three tab bodies', 'selects the first song by default', 'shows the empty-song-list copy', 'feeds Order of Service and Stage Layout tabs from the loaded doc'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Desktop (>=sm) renders all three Rehearse columns simultaneously; mobile (<sm) renders a one-screen-at-a-time drill-down (list/detail/reader) driven by mobileScreen, with the mobile PDF reader link-first (mobileLinkFirst); exactly ONE RehearseAudioPlayerBar instance persists outside both conditional chains"
    requirement: "R391"
    verification:
      - kind: unit
        ref: "src/views/__tests__/VolunteerServiceView.test.ts — 'renders both the desktop 3-column layout and the mobile drill-down layout, with exactly ONE persistent player', 'mobile Rehearse starts on the song list screen', 'an open-pdf sets the reader attachment and advances mobile to the reader screen (link-first)'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Selecting a song updates the song detail panel and advances the mobile screen to detail; a Play toggle sets the single shared active track on the one player without changing the mobile screen; an open-pdf sets the reader attachment"
    requirement: "R391"
    verification:
      - kind: unit
        ref: "src/views/__tests__/VolunteerServiceView.test.ts — 'selecting a song updates the detail panel and advances the mobile screen to detail', 'a Play toggle sets the shared active track on the single player'"
        status: pass
    human_judgment: false
  - id: D6
    description: "The route /volunteer/service/:serviceId resolves to VolunteerServiceView (path/name/meta unchanged); the Phase 126 placeholder is deleted and unreferenced; production build succeeds with no dead import"
    requirement: "R384"
    verification:
      - kind: unit
        ref: "src/router/__tests__/router.test.ts (17/17, route name='volunteer-service' + params + meta unchanged)"
        status: pass
      - kind: other
        ref: "npm run build — succeeds; dist/assets/VolunteerServiceView-*.js emitted, no VolunteerServicePlaceholderView chunk"
        status: pass
    human_judgment: false
  - id: D7
    description: "npm run type-check is clean and the full app vitest suite shows no new failures beyond the documented storage.rules.test.ts baseline"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build, clean); npx vitest run — 209/210 files passed, 5395/5430 tests passed, only src/storage.rules.test.ts fails (documented Storage-emulator-dependent baseline, CLAUDE.md)"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-06
status: complete
---

# Phase 127 Plan 06: Volunteer Service View — Rehearse Shell, Route Swap Summary

**Built `VolunteerServiceView.vue` — the standalone, read-only tri-tab shell (top bar + service header + Rehearse/Order of Service/Stage Layout tabs) composing all five Wave-2 leaf components and driven by `useVolunteerServiceDoc`'s whole-view state machine — with a desktop 3-column Rehearse layout and a mobile drill-down reflow whose one persistent audio player never unmounts, then swapped `/volunteer/service/:serviceId` to it and deleted the Phase 126 build-safe placeholder.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-09-06T07:22:00-04:00
- **Completed:** 2026-09-06T07:40:21-04:00
- **Tasks:** 2/2
- **Files modified:** 4 (2 created, 1 modified, 1 deleted)

## Accomplishments

- Created `VolunteerServiceView.vue`: reads `serviceId` from the route (never `orgId` — delegated entirely to `useVolunteerServiceDoc`, T-127-02), renders the loading/access-denied/load-failure/populated branches with the exact UI-SPEC copy, and reuses `MyScheduleView.vue`'s top bar and `ServiceEditorView.vue`'s tablist/`handleTabKeydown` verbatim (neither source file modified). Rehearse is the default active tab; all three tabs are always present.
- Wired the Rehearse tab's shared state: `selectedSongId` (first song deterministic default), `selectedAttachment` (reader), and `activeTrack` (single player track) — `RehearseSongList`'s `select`, `RehearseSongDetail`'s `play`/`open-pdf` all flow into these. Desktop renders all three columns simultaneously (`hidden sm:flex`); mobile renders one screen at a time via `mobileScreen` (`sm:hidden`), with the mobile `RehearseFileReader` set `mobile-link-first`. Exactly ONE `RehearseAudioPlayerBar` instance is rendered outside both conditional chains, so playback survives every screen/tab navigation.
- Order of Service and Stage Layout panels mount `VolunteerOrderOfService`/`VolunteerStageLayoutTab` fed directly from the loaded doc's `orderOfService`/`roleAssignments`/`stageLayout?.elements`.
- Swapped the router's `/volunteer/service/:serviceId` component import from `VolunteerServicePlaceholderView.vue` to `VolunteerServiceView.vue` (path/name/meta byte-identical) and deleted the now-unreferenced placeholder file.
- 16 new unit tests mount the REAL child components (not stubs) — an integration-style suite that verifies the actual wiring rather than re-testing the already-unit-tested leaves.

## Task Commits

Each task was committed atomically:

1. **Task 1: VolunteerServiceView.vue — tri-tab shell, whole-view states, desktop 3-column + mobile drill-down Rehearse** - `82e945a0` (feat)
2. **Task 2: Swap the route to VolunteerServiceView, remove the placeholder, and gate the production build** - `501fdd8a` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified

- `src/views/VolunteerServiceView.vue` - New. The standalone tri-tab read-only shell (R384, R391).
- `src/views/__tests__/VolunteerServiceView.test.ts` - New. 16 tests covering whole-view states, tab click/keyboard nav, populated tab-body mounts, first-song default, empty-list copy, desktop/mobile dual-layout with a single persistent player, song-select/play/open-pdf wiring, and Order/Stage tab prop feeds.
- `src/router/index.ts` - EDITED. `/volunteer/service/:serviceId` now imports `VolunteerServiceView.vue`; path/name/meta unchanged.
- `src/views/VolunteerServicePlaceholderView.vue` - DELETED. Superseded by `VolunteerServiceView.vue`.

## Decisions Made

- `RehearseAudioPlayerBar` always renders with `fixed-bottom` true rather than conditionally toggling based on a JS breakpoint (`useIsMobile`) — see key-decisions above; the must_haves require only a single persistent instance, not a desktop-inline/mobile-pinned CSS distinction.
- Shared `selectSong`/`onOpenPdf` handlers between the desktop and mobile branches (both set `mobileScreen`, harmless on desktop) rather than duplicating near-identical handler pairs.
- `selectedAttachment` resets on song change to avoid a stale PDF carrying over into the reader.
- No `ccliNumber` prop wired — the projection never carries it (Plan 01/02's own decision), so `RehearseSongDetail`'s existing graceful-omission default applies unchanged.

## Deviations from Plan

None — plan executed as written. Both tasks matched their `<action>`/`<acceptance_criteria>` exactly; the four "Decisions Made" above are within-scope implementation choices the plan explicitly left to planner/executor discretion (UI-SPEC's "planner's discretion" notes), not corrections to broken or missing plan behavior.

## Issues Encountered

One type error was caught and fixed during authoring (not a deviation from the *plan*, just a fixture typo caught by `npm run type-check`): the test fixture's stage-marker `zone` value used `'stage'` instead of the real `PublicStageMarker['zone']` union member `'onstage'`. Fixed before the first commit; `npm run type-check` is clean in the committed state.

## User Setup Required

None — no external service configuration required (application code + tests + router edit only; no Firebase console changes, no new environment variables).

## Next Phase Readiness

- Phase 127 (Volunteer Service View — Rehearse, Order of Service & Stage Layout) is functionally complete: a volunteer tapping a service card on My Schedule now reaches a real, working standalone Rehearse/Order of Service/Stage Layout view instead of the Phase 126 "coming soon" placeholder.
- `npm run type-check` is clean project-wide. `npx vitest run` (full app suite): 209/210 files, 5395/5430 tests passed — the only failure is the pre-existing, documented `src/storage.rules.test.ts` (Storage-emulator-dependent, unrelated to this plan; see CLAUDE.md). `npm run build` succeeds with `VolunteerServiceView` code-split into its own chunk and no reference to the deleted placeholder anywhere in the bundle.
- Manual/human-UAT (deferred, not blocking, per this plan's own `<verification>` section): end-to-end magic-link volunteer flow (My Schedule → open a service → Rehearse/Order/Stage) on both desktop and a real phone — tracked in 127-VALIDATION.md as Manual-Only.
- No blockers. This was the final plan (06 of 06) in Phase 127.

---
*Phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: src/views/VolunteerServiceView.vue
- FOUND: src/views/__tests__/VolunteerServiceView.test.ts
- CONFIRMED DELETED: src/views/VolunteerServicePlaceholderView.vue
- FOUND commit: 82e945a0
- FOUND commit: 501fdd8a
