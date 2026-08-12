---
phase: 54-service-item-enhancements
plan: 01
subsystem: slides
tags: [materializer, service-items, misc, R123]
requires:
  - deriveGroupEntries (pure derivation switch)
  - rebuildGroup MISC no-op fall-through
provides:
  - MISC items derive zero slides by default
affects:
  - src/composables/useSlideshowAssembly.ts (materializationCandidates skips zero-slide derivations)
tech-stack:
  added: []
  patterns:
    - "One-branch split of an exhaustive discriminated-union switch — no default"
key-files:
  created: []
  modified:
    - src/utils/slideGroupMaterializer.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
decisions:
  - "The ONLY production change is `case 'MISC': return []` in deriveGroupEntries; every sibling MISC site (sourceSignature, isSlotDerivableRef, rebuildGroup) stays untouched so existing MISC data is byte-identical."
metrics:
  duration: ~6m
  completed: 2026-08-11
status: complete
---

# Phase 54 Plan 01: MISC Item Derives No Slides (R123) Summary

A new Miscellaneous service item now materializes with zero derived slides — `deriveGroupEntries(MISC)` returns `[]` instead of one blank text slide — while every other item type and all existing MISC data are left untouched.

## What Was Built

- **`deriveGroupEntries` MISC branch (R123):** Split `case 'MISC': return []` out of the one-text-slide fall-through in `src/utils/slideGroupMaterializer.ts`. ANNOUNCEMENTS/PRAYER/MESSAGE/HYMN remain in the group returning the single `{ kind: 'text' }` entry. A new MISC slot now derives nothing, so `materializationCandidates` skips creating a group document for it; the user can still hand-add slides.
- **Tests (RED-first):** Added two describes to `slideGroupMaterializer.test.ts`:
  - `deriveGroupEntries — MISC (R123)`: MISC derives `[]` (the RED driver), plus an ANNOUNCEMENTS sibling-regression assertion (still one text entry).
  - `rebuildGroup — MISC no-op (R123 backward-compat)`: an existing MISC group's legacy blank auto-slide persists (`changed:false`), and a hand-added MISC slide (`{kind:'text', title:'New slide', body:''}`) survives unchanged.

## Backward Compatibility

`rebuildGroup(MISC)` was deliberately left as a no-op (`{ changed: false, slides: group.slides }`). Because the watcher skips slots that already have a group and `rebuildGroup` never rewrites MISC groups, every existing MISC item keeps its previously-derived blank slide and any hand-added slides — nothing is deleted or rewritten. This was pinned by the two BWC tests, which passed both before and after the production change.

## Verification

- `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` — 131 passed (all four new assertions green).
- `npm run type-check` (vue-tsc --build) — clean; the `switch (slot.kind)` in `deriveGroupEntries` stays exhaustive with no `default`.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — 3054 passed, 13 failed across exactly the 2 known-baseline files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`). No regression beyond baseline.

## RED-first Gate Compliance

- RED commit `3dd5e4d` (`test(54-01): ...`) — added the failing MISC-derives-`[]` assertion; run reported exactly one new failing test, the other three new tests passed against unchanged source.
- GREEN commit `afccdc5` (`feat(54-01): ...`) — one-branch split; all 131 materializer tests pass.
- No REFACTOR needed.

## Deviations from Plan

None — plan executed exactly as written.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | RED — pin MISC-derives-nothing, sibling regression, MISC rebuild no-op | 3dd5e4d | src/utils/__tests__/slideGroupMaterializer.test.ts |
| 2 | GREEN — split `case 'MISC': return []` out of the fall-through | afccdc5 | src/utils/slideGroupMaterializer.ts |

## Self-Check: PASSED
