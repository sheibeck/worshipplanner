---
phase: 33-backgrounds-slide-editing
plan: 06
subsystem: ui
tags: [vue3, pinia, firestore, background-image, song-lyrics]

# Dependency graph
requires:
  - phase: 33-backgrounds-slide-editing
    provides: "33-01's SongLyrics.backgroundImageUrl field; 33-03's BackgroundControl.vue (emit-only, presentational) and useBackgroundUpload composable"
provides:
  - "songLyrics store's setSongBackground(orgId, songId, lyricsId, url) action — single-purpose write/clear of the song-level background field via explicit deleteField()"
  - "SongLyricEditor.vue's song-background-row: BackgroundControl mounted at the song (least-specific) cascade tier, gated on the auth store's isEditor"
affects: [33-08 (group-level BackgroundControl mount, same shared component)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "setSongBackground mirrors setGroupBedMedia's explicit-deleteField()-over-undefined idiom (slideGroups.ts), as a dedicated action separate from the autosave-typed updateCurrentLyrics"
    - "SongLyricEditor.vue's first direct useAuthStore import — gates the new control's add/remove affordances on isEditor without retrofitting a gate onto the rest of the (currently ungated) editor"

key-files:
  created: []
  modified:
    - src/stores/songLyrics.ts
    - src/stores/__tests__/songLyrics.test.ts
    - src/components/SongLyricEditor.vue
    - src/components/__tests__/SongLyricEditor.test.ts

key-decisions:
  - "Did NOT add a removeLabel prop to BackgroundControl.vue. 33-03's SUMMARY flagged this as an open nit (generic aria-label 'Remove background' vs the Copywriting Contract's per-level 'Remove song background'), but this plan's Task 2 action gives an exact, closed prop list to pass (imageUrl, caption, addLabel, orgId, isEditor) with no removeLabel — and no acceptance criterion in this plan tests the aria-label string. Left as-is to avoid unrequested component surface changes; flagging again for whoever wires 33-08 in case a shared-component removeLabel prop becomes worth adding then (it would need to stay optional so 33-08's mount is unaffected, since 33-08 was told the same open nit)."
  - "isEditor is read directly from useAuthStore inside SongLyricEditor.vue (a new import), not threaded as a new component prop — SongSlideOver.vue (this editor's only mount point) doesn't currently pass an isEditor prop, and adding one would touch a call site outside this plan's file list. Matches the plan's explicit instruction ('isEditor from the auth store's own isEditor computed')."
  - "Gating is scoped to the new background control only. The rest of SongLyricEditor.vue (section add/duplicate/remove/reorder, paste, history, save-version) has no editor gate today, and retrofitting one is out of scope per the plan — the Firestore rule on the lyrics subcollection already requires an org editor, so an unauthorized write elsewhere in this editor fails server-side rather than silently succeeding."

requirements-completed: [R057]

coverage:
  - id: D1
    description: "setSongBackground(orgId, songId, lyricsId, url) writes the background field (+ updatedAt) on a URL, and clears it via an explicit deleteField() sentinel on null — never touching sections or performanceOrder"
    requirement: "R057"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/songLyrics.test.ts — 'setSongBackground' describe block (3 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "BackgroundControl mounted as its own sibling row (song-background-row) between SongLyricEditor.vue's header and its loading/empty/scroll-region chain, with level-specific caption copy, no inheritedFrom prop ever, attach/remove wired to setSongBackground, and isEditor-gated add/remove"
    requirement: "R057"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts — 8 'background:' cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "A song background change propagates to every service using that song without a per-service write (R057's cascade guarantee) — the write targets exactly one field on the song's own canonical lyrics document, per D002"
    requirement: "R057"
    verification: []
    human_judgment: true
    rationale: "Cross-service propagation depends on resolveEntryMedia's cascade resolution (33-01, exercised by slideshowAssembler tests elsewhere), not on anything this plan's own file set changes — this plan proves only that the write is single-document/single-field (D2's 'never writes sections or performanceOrder' test) and defers the end-to-end 'shows up everywhere' claim to human/UAT verification, matching the plan's own must_haves statement marked verification: backstop."

duration: 45min
completed: 2026-08-03
status: complete
---

# Phase 33 Plan 06: Song-Level Background Control Summary

**A `setSongBackground` Pinia store action (explicit `deleteField()` clear, mirroring `setGroupBedMedia`) plus the existing `BackgroundControl.vue` mounted as a new sibling row in `SongLyricEditor.vue`, with the song's least-specific-tier caption copy and no `inheritedFrom`.**

## Performance

- **Duration:** 45 min
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments
- `setSongBackground(orgId, songId, lyricsId, url)` — a dedicated store action, separate from the autosave-typed `updateCurrentLyrics`, writing `backgroundImageUrl` + `updatedAt` on a URL and clearing via `deleteField()` on `null`.
- `SongLyricEditor.vue` mounts the shared `BackgroundControl.vue` (from 33-03, unmodified) inside a new `data-testid="song-background-row"` sibling `<div>`, placed between the header and the loading/empty/scroll-region chain — the header (including Phase 32's `SaveStatusIndicator`) is untouched.
- The mounted control never receives `inheritedFrom` — the song is the least-specific cascade tier, so there is nothing below it to display as inherited.
- Add/remove affordances gated on the auth store's `isEditor` (a new, scoped-to-this-control gate; the rest of the editor remains ungated, matching the plan's explicit scope decision).

## Task Commits

Each task was committed atomically:

1. **Task 1: setSongBackground store action** - `7d3535c` (feat)
2. **Task 2: Mount the song background control in SongLyricEditor.vue** - `e8cc0f3` (feat)

## Files Created/Modified
- `src/stores/songLyrics.ts` - `setSongBackground()` action + `deleteField` import
- `src/stores/__tests__/songLyrics.test.ts` - `deleteField` mock + 3 new `setSongBackground` cases (URL write, null-clears-via-sentinel, never touches sections/performanceOrder)
- `src/components/SongLyricEditor.vue` - `song-background-row`, `BackgroundControl` mount, `useAuthStore` import, `isEditor` computed, `onAttachSongBackground`/`onRemoveSongBackground` handlers
- `src/components/__tests__/SongLyricEditor.test.ts` - `useBackgroundUpload`/`useAuthStore` mocks, `mockSetSongBackground`, 8 new `background:`-prefixed test cases

## Decisions Made
- **No `removeLabel` prop added to `BackgroundControl.vue`.** The plan's Task 2 action names an exact, closed prop list (`imageUrl`, `caption`, `addLabel`, `orgId`, `isEditor`) with no `removeLabel`, and no acceptance criterion tests the aria-label string — so the shared component's generic `"Remove background"` aria-label (flagged as a non-blocking nit in 33-03's SUMMARY) is unchanged. Flagging again here for 33-08's integrator, since 33-08 mounts the same shared component and was told the identical nit.
- **`isEditor` read directly from `useAuthStore`** inside `SongLyricEditor.vue` rather than threaded through as a new prop, per the plan's explicit instruction. `SongSlideOver.vue` (the sole mount point) is untouched.
- **Gate scoped to the new control only** — deliberately did not retrofit an editor gate onto the rest of `SongLyricEditor.vue`, matching the plan's own stated rationale (the Firestore rule already enforces this server-side for every other write path in this editor).

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria (grep counts, exact caption strings, `inheritedFrom` omission, DOM placement, viewer gating) were verified directly.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 4 (whatever plan wires the resolved-cascade end-to-end UAT, and 33-08 for the group-level mount) can proceed: `setSongBackground` and the song-level `BackgroundControl` mount are both landed and tested in isolation.
- **`removeLabel` open question carries forward to 33-08.** If the exact per-level aria-label wording from the Copywriting Contract ("Remove group background" / "Remove song background") turns out to matter at integration/UAT time, the fix is a small, optional, additive prop on `BackgroundControl.vue` — trivial to add without disturbing either call site's existing props.
- No blockers. `npx vitest run src/` baseline unchanged: the only failures are the pre-existing, documented non-defects (`src/storage.rules.test.ts` — needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` — stale assertion), 9 tests / 2 files. Total suite: 2055 passing (2044 pre-33-06 baseline + 11 new tests from this plan).

---
*Phase: 33-backgrounds-slide-editing*
*Completed: 2026-08-03*

## Self-Check: PASSED

All modified files verified present on disk with the expected content; both task commits (`7d3535c`, `e8cc0f3`) verified present in `git log --oneline`.
