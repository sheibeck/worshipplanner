---
phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout
plan: 03
subsystem: rehearse-ui
tags: [vue, presentational-component, rehearse, pdf-reader, audio-player, native-web-platform]

# Dependency graph
requires:
  - phase: 127-01
    provides: "RehearseAttachment shape (id/name/kind/downloadUrl/href/linkSource) these components render"
provides:
  - "src/components/rehearse/RehearseFileReader.vue — Column 3 / mobile Screen C: native-iframe desktop PDF panel + link-first mobile variant (R387, R391)"
  - "src/components/rehearse/RehearseAudioPlayerBar.vue — the single persistent bottom transport with play/pause, seek, time, whole-track speed, and Loop (R388, R389)"
affects: ["127-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Both components delegate entirely to native Web Platform APIs (browser PDF viewer via <iframe>, HTMLAudioElement) — zero new npm dependency, verified package.json unchanged before each commit."
    - "RehearseFileReader adapts SongFilePreviewModal.vue's loading/errored iframe state machine verbatim (Pitfall 3 reset-on-attachment-change watcher), stripped of Teleport/Transition/backdrop/focus-trap modal chrome for an always-visible inline panel."
    - "RehearseAudioPlayerBar mounts exactly ONE <audio class=sr-only> for its whole lifetime; selecting a new track updates :src reactively rather than v-if-toggling a second element — the 127-PATTERNS.md one-track-at-a-time invariant."
    - "Light per-uid+track localStorage playback-position persistence (Phase 125 decision) — write on @timeupdate, restore on @loadedmetadata, wrapped in try/catch so a private-browsing localStorage failure never breaks playback."

key-files:
  created:
    - src/components/rehearse/RehearseFileReader.vue
    - src/components/rehearse/RehearseAudioPlayerBar.vue
    - src/components/rehearse/__tests__/RehearseFileReader.test.ts
    - src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts
  modified: []

key-decisions:
  - "Kept whole-track speed (playbackRate) and Loop state on the RehearseAudioPlayerBar component instance (not reset) when the active track prop changes, rather than resetting to 1x/off per track — neither the plan's must_haves nor acceptance criteria specify reset-on-track-change behavior, and carrying the volunteer's chosen listening preference across songs in the same session is the less surprising default."
  - "Did NOT autoplay when a new track prop is set (e.g. from RehearseSongDetail's Play toggle emitting up to the shell). The plan's behavior bullets specify 'Play/pause toggles playback' as a distinct action from track selection; autoplaying on prop change was not a stated requirement and would have required speculative async-in-watcher handling with no acceptance criterion driving it. The player becomes visible/wired to the new track; a first press of the round Play button starts it. Flagged here rather than silently decided, since 127-UI-SPEC.md's prose could be read either way (see 'Deviations' — this was a scope-boundary call, not a Rule 1-3 fix)."
  - "Desktop errored-fallback Download in RehearseFileReader.vue uses a plain <a :href download> (copied verbatim from SongFilePreviewModal.vue's error state), while the MOBILE Download button uses the fetch->blob->objectURL pattern from SongFilesTab.vue as the plan explicitly requires for R391. These are two different code paths for two different UI affordances the plan itself distinguishes ('the errored fallback (copy + Download link)' vs. mobile's 'a Download secondary button (fetch->blob)') — not an inconsistency."

requirements-completed: [R387, R388, R389, R391]

coverage:
  - id: D1
    description: "Desktop PDF reader mounts a single <iframe :src=downloadUrl> with tabindex=-1, loading spinner until @load, and an errored fallback (copy + Download link) on @error — no pdf.js, no custom paginator"
    requirement: "R387"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseFileReader.test.ts (9 tests, all passing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reader resets loading/errored state on attachment CHANGE (Pitfall 3) — selecting a second song's PDF after the first errored shows a fresh spinner, never a stale error"
    requirement: "R387"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseFileReader.test.ts — 'Pitfall 3: resets loading/errored state when the attachment prop changes...' case"
        status: pass
    human_judgment: false
  - id: D3
    description: "Print opens attachment.downloadUrl via window.open(url,'_blank','noopener,noreferrer') — never iframe.contentWindow.print()"
    requirement: "R387"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseFileReader.test.ts — 'desktop: Print opens the download URL in a new tab via window.open(noopener)' case"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mobile (mobileLinkFirst) renders NO iframe — an Open PDF primary button (window.open) and a Download secondary button (fetch->blob, copied from SongFilesTab.vue) instead, plus a back affordance"
    requirement: "R391"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseFileReader.test.ts (mobile-link-first + mobile Download describe block, 3 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Audio player mounts exactly ONE native <audio class=sr-only> element for its whole lifetime; selecting a new track replaces the src reactively, never layering a second element"
    requirement: "R388"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts — 'mounts exactly one...' and 'selecting a new track REPLACES the src...' cases"
        status: pass
    human_judgment: false
  - id: D6
    description: "Play/pause toggles playback and updates the aria-label (Play {name} / Pause {name}); a native range seek is bound to currentTime; elapsed/total time render m:ss / m:ss in font-mono"
    requirement: "R388"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts — play/pause + aria-label case, seek/time-formatting case"
        status: pass
    human_judgment: false
  - id: D7
    description: "The speed pill cycles 1x -> 0.9x -> 0.75x -> 1.25x -> 1x setting audioEl.playbackRate; the Loop toggle sets audioEl.loop and is a real aria-pressed button"
    requirement: "R389"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts — speed-cycle and Loop-toggle cases"
        status: pass
    human_judgment: false
  - id: D8
    description: "Playback position persists to localStorage keyed by uid+track and restores on re-selecting the same track"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts — 'persists playback position...' and 'restores playback position...' cases"
        status: pass
    human_judgment: false
  - id: D9
    description: "No new npm dependency (no pdf.js/pdfjs-dist, no howler/wavesurfer); npm run type-check clean"
    verification:
      - kind: unit
        ref: "git diff --stat package.json (empty, both commits); npm run type-check (vue-tsc --build, clean, both commits)"
        status: pass
    human_judgment: false

duration: ~22min
completed: 2026-09-06
status: complete
---

# Phase 127 Plan 03: Rehearse File Reader & Audio Player Bar Summary

**Built the two "consume the media" leaf components for the volunteer Rehearse tab — `RehearseFileReader.vue` (a native-iframe desktop PDF panel with a link-first mobile variant, R387/R391) and `RehearseAudioPlayerBar.vue` (one persistent native `<audio>`-backed transport with play/pause, seek, time, whole-track speed, and Loop, R388/R389) — both delegating entirely to native Web Platform APIs with zero new npm dependency.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2/2
- **Files modified:** 4 (all created)

## Accomplishments

- Created `RehearseFileReader.vue`: desktop branch mounts a single `<iframe :src="attachment.downloadUrl" tabindex="-1">` with a loading-spinner overlay until `@load`, and an errored fallback (`"Couldn't preview this file."` + a Download link) on `@error`. The `loading`/`errored` reset watcher is carried over verbatim from `SongFilePreviewModal.vue` — keyed on attachment identity so a second song's PDF after the first one errored shows a fresh spinner, never a stale error (Pitfall 3). Print opens `attachment.downloadUrl` via `window.open(url, '_blank', 'noopener,noreferrer')`, never `iframe.contentWindow.print()` (cross-origin throw). The mobile (`mobileLinkFirst`) branch renders no iframe at all — a back button, an "Open PDF" primary button (`window.open`), and a "Download" secondary button (the fetch->blob->objectURL pattern copied unmodified from `SongFilesTab.vue`, per 124-REVIEW FIX A). No song/PDF selected renders the UI-SPEC empty copy.
- Created `RehearseAudioPlayerBar.vue`: exactly one native `<audio class="sr-only">` element for the component's whole lifetime — a reactive `:src="track.downloadUrl"` binding means selecting a new track replaces the source on the same element rather than mounting a second one. Custom transport chrome: a round play/pause button (`aria-label` toggles `Play {name}` / `Pause {name}`), a native `<input type="range">` seek bound to `currentTime`, `m:ss / m:ss` elapsed/total time in `font-mono`, a text-only speed pill cycling `1× → 0.9× → 0.75× → 1.25× → 1×` (sets `audioEl.playbackRate`), and a `aria-pressed` Loop toggle (sets `audioEl.loop`, indigo pill when active, using the net-new repeat glyph from the UI-SPEC Icon Inventory). Playback position persists to `localStorage` under a `rehearse-audio-position:{uid}:{trackId}` key on every `@timeupdate` (wrapped in try/catch for private-browsing/quota failures) and restores on `@loadedmetadata` when the same track is re-selected. Both the desktop inline layout (seek + speed + loop combined on one row) and the mobile `fixedBottom` stacked layout (seek on its own row, speed+loop on a third) share the same underlying controls and test ids.

## Task Commits

Each task was committed atomically:

1. **Task 1: RehearseFileReader.vue — native-iframe desktop PDF panel + link-first mobile variant** - `1d3fdb79` (feat)
2. **Task 2: RehearseAudioPlayerBar.vue — single persistent native player with play/pause, seek, time, speed, loop** - `ad16e3dc` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified

- `src/components/rehearse/RehearseFileReader.vue` - New. Column 3 desktop iframe reader + mobile Screen C link-first panel (R387, R391).
- `src/components/rehearse/RehearseAudioPlayerBar.vue` - New. The single persistent bottom transport (R388, R389) with light per-uid+track position persistence.
- `src/components/rehearse/__tests__/RehearseFileReader.test.ts` - New. 9 tests: empty state, desktop iframe mount + tabindex=-1, loading-spinner-until-@load, errored fallback + Download link, Pitfall-3 reset on attachment change, Print `window.open(noopener)`, mobile-link-first branch (no iframe, Open PDF/Download/Back present), mobile Open PDF `window.open` call, and the fetch-blob Download pattern.
- `src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts` - New. 10 tests: renders-nothing when no track, single `<audio>` element, track-replacement (not a second element), play/pause + aria-label toggle, seek/time-formatting (`m:ss / m:ss`), speed-cycle order + `playbackRate`, Loop toggle + `aria-pressed`, localStorage position persist + restore, and the mobile `fixedBottom` layout.

## Decisions Made

- Speed/Loop state carries forward across track changes rather than resetting per-track (see key-decisions above — no acceptance criterion required reset-on-change).
- No autoplay-on-track-select — Play/Pause is a distinct manual action from track selection, matching the plan's literal behavior bullets rather than an ambiguous UI-SPEC prose reading.
- Desktop error-fallback Download (plain `<a download>`, copied from `SongFilePreviewModal.vue`) intentionally differs from the mobile Download button (fetch->blob, required by R391) — two different plan-specified affordances, not an inconsistency.

## Deviations from Plan

None — plan executed as written. Both components delegate entirely to native Web Platform APIs with no new npm dependency; `package.json` diff is empty across both task commits.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required (application code + tests only; no Firebase console changes, no new environment variables).

## Next Phase Readiness

- `RehearseFileReader.vue` is ready for the Plan 06 shell to wire `RehearseSongDetail`'s `open-pdf` event to an `:attachment` prop (desktop) or drill into mobile Screen C, and its `back` event to pop the mobile drill-down stack.
- `RehearseAudioPlayerBar.vue` is ready for the Plan 06 shell to own the shared active-track ref that both `RehearseSongDetail`'s `play` event sets and this component's `:track` prop consumes — one instance persists across the desktop Column 3 and the mobile pinned-bottom position (`fixedBottom`).
- `npm run type-check` is clean after both task commits. `npx vitest run src/components/rehearse/__tests__/RehearseFileReader.test.ts` (9/9) and `npx vitest run src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts` (10/10) both pass.
- No blockers for Plan 06 (view shell/route) or the remaining Order of Service / Stage Layout plans, which do not depend on these two components.

---
*Phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: src/components/rehearse/RehearseFileReader.vue
- FOUND: src/components/rehearse/RehearseAudioPlayerBar.vue
- FOUND: src/components/rehearse/__tests__/RehearseFileReader.test.ts
- FOUND: src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts
- FOUND commit: 1d3fdb79
- FOUND commit: ad16e3dc
