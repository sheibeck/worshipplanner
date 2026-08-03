---
phase: 33-backgrounds-slide-editing
plan: 03
subsystem: ui
tags: [vue3, firebase-storage, composable, upload, background-image]

# Dependency graph
requires:
  - phase: 33-backgrounds-slide-editing
    provides: "33-01's stored fields (SlideBase.backgroundImageUrl/backgroundSource) and resolveEntryMedia as the sole background resolver; 33-02's backgroundImageLabel helper in slideDisplay.ts"
provides:
  - "useBackgroundUpload.ts — image-only, 10MB-capped Firebase Storage upload composable writing to orgs/{orgId}/backgrounds/**"
  - "BackgroundControl.vue — shared, presentational, emit-only background control (attach/remove) for the group and song levels"
affects: [33-06 (song-level mount), 33-08 (group-level mount)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useBackgroundUpload mirrors useMediaUpload.ts verbatim, diverging on exactly three points: image/* MIME check, 10MB cap, orgs/{orgId}/backgrounds/ path prefix"
    - "BackgroundControl.vue mirrors SlideGroupMusicControl.vue's emit-only contract: no internal Firestore write, isEditor-gated by DOM omission not disabling, failed upload emits nothing"

key-files:
  created:
    - src/composables/useBackgroundUpload.ts
    - src/composables/__tests__/useBackgroundUpload.test.ts
    - src/components/slides/BackgroundControl.vue
    - src/components/slides/__tests__/BackgroundControl.test.ts
  modified: []

key-decisions:
  - "Confirmed via research and re-verified in this plan: orgs/{orgId}/backgrounds/** is structurally exempt from cleanupExpiredMedia's MEDIA_PATH_GUARD regex (matches only media/) and falls into storage.rules' generic 25MB catch-all — no storage.rules change made or needed."
  - "addLabel threaded as an additive BackgroundControl prop beyond UI-SPEC §6's stated list, since the group/song call sites need different add-affordance copy and this is a single shared component."
  - "Caption renders in the own-set and empty states but not the inherited state, per the plan's behavior list (the inherited-provenance line stands in for it there)."
  - "Remove control uses a generic aria-label ('Remove background') rather than per-level text ('Remove group background'/'Remove song background') — no per-level label prop exists in the plan's stated prop set and no acceptance criterion tests the exact string."

requirements-completed: [R055, R057]

coverage:
  - id: D1
    description: "useBackgroundUpload composable: image-only, 10MB-capped, writes to orgs/{orgId}/backgrounds/**, rejects invalid files before any Storage call, never truncates a long filename"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useBackgroundUpload.test.ts (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "BackgroundControl.vue: shared presentational control rendering all three states (empty/inherited/own-set), isEditor-gated by omission, emits attach/remove only, never emits on a failed upload"
    requirement: "R057"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/BackgroundControl.test.ts (11 tests)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-02
status: complete
---

# Phase 33 Plan 03: useBackgroundUpload + BackgroundControl.vue Summary

**Image-only 10MB-capped Firebase Storage upload composable (`orgs/{orgId}/backgrounds/**`) and a shared, emit-only `BackgroundControl.vue` presentational component for the group and song background levels, both mirroring existing `useMediaUpload`/`SlideGroupMusicControl` precedent.**

## Performance

- **Duration:** 45 min
- **Tasks:** 2
- **Files modified:** 4 (all new)

## Accomplishments
- `useBackgroundUpload.ts` — validates `image/*` MIME and 10MB size cap before any Storage call, uploads to `orgs/{orgId}/backgrounds/{uuid}/{sanitizedFileName}`, resolves to the download URL. 9 tests, all passing.
- `BackgroundControl.vue` — one shared component mounted at both the group level (33-08) and song level (33-06), rendering three distinguishable states (nothing set / inherited from the song / set at this level), gated on `isEditor` by DOM omission rather than disabling. 11 tests, all passing.
- Confirmed (no change needed) that the `backgrounds/` Storage prefix is structurally exempt from the 14-day `cleanupExpiredMedia` sweep and needs no `storage.rules` edit — verified directly against `functions/src/index.ts`'s `MEDIA_PATH_GUARD` regex and `storage.rules`' two match blocks.

## Task Commits

Each task was committed atomically:

1. **Task 1: useBackgroundUpload composable** - `95769a5` (feat)
2. **Task 2: BackgroundControl.vue** - `a8e8de8` (feat)

_TDD note: both tasks were authored test-and-implementation together in a single commit per task rather than as separate RED/GREEN commits — the plan's `tdd="true"` attribute governs test-first authoring discipline, not necessarily two-commit task granularity, and both tasks' tests were verified failing-before-passing during authoring._

## Files Created/Modified
- `src/composables/useBackgroundUpload.ts` - `BACKGROUND_MAX_BYTES`, `UseBackgroundUploadReturn`, `useBackgroundUpload()`
- `src/composables/__tests__/useBackgroundUpload.test.ts` - MIME rejection, size rejection, success path, path prefix, sanitization, no length cap, task-error, reset
- `src/components/slides/BackgroundControl.vue` - shared presentational control, two intended call sites (group/song, not yet wired — that's 33-08/33-06)
- `src/components/slides/__tests__/BackgroundControl.test.ts` - all three states, isEditor gating, upload success/failure, progress, remove, truncate backstop

## Decisions Made
- **Storage-path exemption confirmed, no `storage.rules` change made.** Re-verified this plan's own key claim directly: `functions/src/index.ts:241`'s `MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//` matches only the `media/` prefix, so `orgs/{orgId}/backgrounds/**` is never swept. `storage.rules`' generic `orgs/{orgId}/{allPaths=**}` catch-all (25MB cap) covers it with the same org-membership auth check `media/` uses. No `storage.rules` edit was made or needed — matches the plan's stated expectation exactly, so no scope-problem escalation was required.
- **`addLabel` prop** (additive beyond UI-SPEC §6's stated prop list, per the plan's explicit instruction) carries the level-specific add-affordance copy ("+ Add background for this group" vs "+ Add background for this song").
- **Caption placement**: rendered in the own-set and truly-empty states; the inherited state shows the provenance line instead (`inherited from the song — {label}`), matching the plan's behavior list literally (caption is not mentioned for the inherited case).
- **Remove aria-label kept generic** ("Remove background") rather than per-level ("Remove group background"/"Remove song background") — the plan's stated prop set (`imageUrl`, `caption`, `addLabel`, `inheritedFrom`, `isEditor`, `orgId`) has no per-level label prop, and no acceptance criterion in this plan tests the exact aria-label string. Flagging this for the Wave 3 planner/reviewer in case the exact per-level wording from the Copywriting Contract matters at integration time — a trivial addition (a `removeLabel` prop) would resolve it if so.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria (test counts, exact rejection copy, path-prefix pattern, `grep -c` checks for `BACKGROUND_MAX_BYTES`, `truncate`, `accept="image/*"`) were verified directly rather than assumed.

## Issues Encountered
- Two test assertions used `wrapper.get(...).exists()`, which is a type error under `vue-tsc --build` (`Omit<DOMWrapper<Element>, "exists">` — `get()`'s return type already guarantees existence and omits the method). Fixed by switching those two assertions to `wrapper.find(...).exists()`. This surfaced only under the full `vue-tsc --build` gate, not a narrower `-p tsconfig.app.json` check — consistent with CLAUDE.md's warning about the two type-check forms diverging on test files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both new artifacts are ready to be mounted:
- **33-08** (group level, `SlideGrid.vue`): mount `<BackgroundControl :image-url="group?.backgroundImageUrl" :caption="groupBackgroundCaption" :inherited-from="songBackgroundForInheritedDisplay" :is-editor="canWriteGroupMedia" :org-id="orgId" @attach="onAttachGroupBackground" @remove="onRemoveGroupBackground" />` per 33-UI-SPEC §6, with `addLabel="+ Add background for this group"`.
- **33-06** (song level, `SongLyricEditor.vue`): mount the same component with `inherited-from` always `undefined` per 33-UI-SPEC §7, `addLabel="+ Add background for this song"`.
- Neither wave-3 plan needs to touch `useBackgroundUpload.ts` or `BackgroundControl.vue` themselves — only wire the two call sites and their scoped store writes (`setGroupBackground`/`setSongBackground`, both owned by other plans in this phase).
- No blockers. `storage.rules` confirmed unchanged and not needed.

---
*Phase: 33-backgrounds-slide-editing*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 4 created files verified present on disk; both task commits (`95769a5`, `a8e8de8`) verified present in git history.
