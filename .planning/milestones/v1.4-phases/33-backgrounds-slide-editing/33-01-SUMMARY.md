---
phase: 33-backgrounds-slide-editing
plan: 01
subsystem: slides
tags: [vue, typescript, slideshow-assembler, firestore-model, vitest]

# Dependency graph
requires: []
provides:
  - "backgroundImageUrl on GroupSlideEntry, SlideGroup, SongLyrics (greenfield, no migration)"
  - "backgroundImageUrl + backgroundSource on SlideBase (resolved, never persisted standalone)"
  - "resolveEntryMedia extended with the slide → group → song background cascade"
  - "emitFromGroup threads a song lookup (lyric/copyright kinds only) into resolveEntryMedia"
affects: [33-02, 33-03, 33-05, 33-06, 33-07, 33-08, 33-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extend the existing media resolver (resolveEntryMedia) for a new cascade rather than writing a second resolver"
    - "Tri-state single field ('slide' | 'group' | 'song') for cascade provenance instead of independent booleans"
    - "Conditional-spread idiom (media.field ? {field} : {}) keeps an unset resolved field genuinely absent, never present-and-undefined"

key-files:
  created: []
  modified:
    - src/types/slideGroup.ts
    - src/types/songLyrics.ts
    - src/types/slide.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slideshowAssembler.test.ts

key-decisions:
  - "backgroundImageUrl/backgroundSource live on SlideBase only (not mirrored onto AssembledSlide), resolving a notation split between 33-UI-SPEC.md and 33-PATTERNS.md so the pair can never drift apart the way audioUrl/audioFromBed historically did"
  - "Background is computed BEFORE the video kind's early return in resolveEntryMedia and returned from that branch too — a video slide inherits a background but never inherits bed audio (deliberate divergence, 33-UI-SPEC.md §9)"
  - "Song lookup at the emitFromGroup call site is scoped to lyric/copyright source kinds only; every other kind passes undefined, since non-SONG groups (PRAYER/SCRIPTURE/MESSAGE/HYMN/IMPORTED/video/text) have no owning SongLyrics document"

patterns-established:
  - "Any future third-tier cascade in this codebase should extend resolveEntryMedia the same way, not fork a parallel resolver"

requirements-completed: [R055, R056, R057]

coverage:
  - id: D1
    description: "GroupSlideEntry, SlideGroup and SongLyrics each carry a new optional backgroundImageUrl field; SlideBase carries the resolved backgroundImageUrl plus a tri-state backgroundSource field"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveEntryMedia resolves slide → group → song, most specific wins, with backgroundSource recording which tier supplied the value; unset fields are genuinely absent"
    requirement: "R056"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — background cascade (R055/R056/R057) — an entry with its own background wins even when the group AND the song also have one"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — background cascade (R055/R056/R057) — an entry with no background in a group that has one, song also has one, resolves the group's"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — background cascade (R055/R056/R057) — nothing set at any level leaves both fields genuinely absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "A PRAYER/SCRIPTURE-style group with no owning song (song argument undefined) resolves its group-tier background without throwing"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — background cascade (R055/R056/R057) — a PRAYER group with no owning song resolves its group background without throwing"
        status: pass
    human_judgment: false
  - id: D4
    description: "A video-kind entry resolves a background through the ordinary cascade while still resolving no bed audio — the audio carve-out is deliberately not copied to background"
    requirement: "R056"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — background cascade (R055/R056/R057) — a video entry with no background of its own, in a group that has one, resolves backgroundSource: 'group' while still resolving no bed audio"
        status: pass
    human_judgment: false
  - id: D5
    description: "Song-level backgroundImageUrl is greenfield on SongLyrics with no migration/deprecation shim, per D-19"
    requirement: "R057"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-02
status: complete
---

# Phase 33 Plan 01: Background Data Model & Cascade Summary

**Three-level `backgroundImageUrl` fields (slide/group/song) plus a resolved tri-state `backgroundSource`, wired into `resolveEntryMedia`'s existing slide/group precedence — computed ahead of the video audio carve-out so a video slide keeps its background but not its bed audio.**

## Performance

- **Duration:** ~5 min (commit-to-commit)
- **Started:** 2026-08-02T23:22:35-04:00 (Task 1 commit)
- **Completed:** 2026-08-02T23:27:55-04:00 (Task 2 commit)
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments
- Added `backgroundImageUrl?: string` to `GroupSlideEntry` and `SlideGroup` (`src/types/slideGroup.ts`), to `SongLyrics` (`src/types/songLyrics.ts`), and both `backgroundImageUrl?: string` / `backgroundSource?: 'slide' | 'group' | 'song'` to `SlideBase` (`src/types/slide.ts`) — all five doc-commented the way their audio siblings already are.
- Extended `resolveEntryMedia` (`src/utils/slideshowAssembler.ts`) to accept a new `song: SongLyrics | undefined` parameter and resolve the slide → group → song background cascade, using the file's existing conditional-assignment idiom so an unresolved field is absent, never present-and-undefined.
- Threaded the song lookup at the `emitFromGroup` call site, scoped to `lyric`/`copyright` source kinds only (every other kind passes `undefined`).
- Added a `background cascade (R055/R056/R057)` describe block to `slideshowAssembler.test.ts` with 8 tests covering the four-way cascade, the absent-song tier, the video divergence, an empty-slides group, and a stale-extra-property entry robustness case.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the three stored background fields and the two resolved fields** - `04fedd9` (feat)
2. **Task 2: Extend resolveEntryMedia with the slide/group/song cascade** - `4c9151c` (feat)

_No TDD tasks in this plan — Task 2 wrote implementation and tests together per its `tdd="true"` behavior-block-driven action, not as separate RED/GREEN commits (the plan's `<action>` directs writing the extended function and its test block as one unit, consistent with how this file's other feature commits are structured)._

## Files Created/Modified
- `src/types/slideGroup.ts` - `GroupSlideEntry.backgroundImageUrl` and `SlideGroup.backgroundImageUrl`
- `src/types/songLyrics.ts` - `SongLyrics.backgroundImageUrl` (greenfield, D-19)
- `src/types/slide.ts` - `SlideBase.backgroundImageUrl` and `SlideBase.backgroundSource` tri-state
- `src/utils/slideshowAssembler.ts` - `resolveEntryMedia` signature change (`song` param), background cascade computed before the video early return, `emitFromGroup` song lookup and spread
- `src/utils/__tests__/slideshowAssembler.test.ts` - new `background cascade (R055/R056/R057)` describe block, 8 tests

## Decisions Made

- **Notation split resolved in favour of `SlideBase`-only fields.** `33-UI-SPEC.md`'s Design System table named these `AssembledSlide.backgroundImageUrl`/`.backgroundSource`, while `33-PATTERNS.md`'s authoritative `SlideCard.vue` excerpt read `props.assembledSlide.slide.backgroundSource`. Per the plan's explicit instruction, both fields live on `SlideBase` only — every consumer reaches them as `assembledSlide.slide.backgroundImageUrl` / `.backgroundSource`. They are NOT mirrored onto `AssembledSlide`.
- **`backgroundSource` is a single tri-state field**, not two independent booleans — matches the plan's and UI-SPEC's explicit reasoning that a 3-level cascade needs three mutually exclusive states.
- **The video/background asymmetry is intentional and now load-bearing in code + tests, not just prose.** See the landmine section below.

## Deviations from Plan

None — plan executed exactly as written. Both landmines called out in the execution context were handled as specified; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

None.

## The Two Landmines — how they were handled

### ★ Landmine 1 — Pitfall 3 (absent-song tier)

`resolveEntryMedia` now takes `song: SongLyrics | undefined` as its third parameter. Inside the function, the song tier is dereferenced with optional chaining (`song?.backgroundImageUrl`) in both the `backgroundImageUrl` cascade expression and the `backgroundSource` ternary. At the `emitFromGroup` call site, the song lookup only happens for `entry.sourceRef.kind === 'lyric' || entry.sourceRef.kind === 'copyright'` — every other source kind (`text`, `video`, `scripture`, `imported`) passes `undefined`, exactly matching how non-SONG groups (PRAYER/SCRIPTURE/MESSAGE/HYMN/IMPORTED) have no owning `SongLyrics` document at all.

The named test is `'a PRAYER group with no owning song resolves its group background without throwing (no SongLyrics document exists for this group)'` — its title contains both "PRAYER" and "no owning song" per the acceptance criterion. It constructs a PRAYER slot/group whose sole entry has `sourceRef: { kind: 'text' }` (never `lyric`/`copyright`), asserts `assembleSlideshow` does not throw, and asserts the group-tier background resolves correctly (`backgroundSource: 'group'`).

### ★ Landmine 2 — Pitfall 1 (video/background asymmetry)

The background cascade (`backgroundImageUrl`/`backgroundSource` computation) sits at the TOP of `resolveEntryMedia`, above the `if (entry.sourceRef.kind === 'video')` early return. The video branch now builds its own `videoMedia` object and spreads the already-computed background fields onto it before returning — so a video-kind entry still resolves a background through the ordinary cascade. The video branch's audio behavior is completely unchanged: it still returns `audioFromBed: false` and never resolves the group's bed audio.

A code comment sits directly above the cascade computation, citing `33-UI-SPEC.md §9` and explaining explicitly that the audio suppression is deliberately NOT extended to background — for a future reader who might otherwise "fix" the asymmetry into false consistency.

The named test is `"a video entry with no background of its own, in a group that has one, resolves backgroundSource: 'group' while still resolving no bed audio"` — it asserts BOTH `slide.backgroundSource === 'group'` AND `'audioUrl' in slide === false` AND `audioFromBed === false` in the same test, per the plan's requirement that both assertions live together so the asymmetry can't be silently dropped by a future partial edit.

**For future readers of this codebase:** if you see the video early-return branch in `resolveEntryMedia` and are tempted to make it return `{ audioFromBed: false }` bare again (matching the pre-Phase-33 shape), do not — that would silently delete a video slide's background. The asymmetry between audio (suppressed for video) and background (not suppressed for video) is the deliberate, tested behavior.

## Next Phase Readiness

- All type fields and the resolved cascade are in place and green (`npm run type-check` exits 0; `npx vitest run src/` matches the documented 2-file/9-test known-failing baseline with no new regressions — `src/utils/__tests__/slideshowAssembler.test.ts` itself is 58/58 passing).
- `resolveEntryMedia` is the ONLY function in `src/` that resolves a background — no second resolver was introduced.
- Wave 2 (33-02 and later plans) can build purely on top of `AssembledSlide.slide.backgroundImageUrl` / `.slide.backgroundSource` as already-resolved, reactive values — no component needs to re-derive the cascade. In particular: `SlideCard.vue`'s provenance chip, `EditSlideDrawer.vue`'s preview box, and the group/song `BackgroundControl.vue` affordances (33-03/33-05/33-06/33-07/33-08) should all read these two fields directly off the already-assembled slide, never compute their own precedence.
- No storage.rules or firestore.rules change was needed or made in this plan (out of scope for 33-01; confirmed not required by 33-RESEARCH.md's Research Question 1/Pitfall 4 for the fields this plan added — they carry no independent write surface yet, that's 33-03/33-06/33-08's job).

---
*Phase: 33-backgrounds-slide-editing*
*Completed: 2026-08-02*

## Self-Check: PASSED

All created/modified files present on disk; both task commits (`04fedd9`, `4c9151c`) found in git log.
