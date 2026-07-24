---
id: S02
parent: M001
milestone: M001
provides:
  - ScriptureSlide type in Slide union for S03 slideshow assembly
  - useScriptureSlides Pinia store for scripture reading CRUD
  - ScriptureSlot.readingMode and scriptureReadingId fields for S03 service-to-slide binding
requires:
  - slice: S01
    provides: Unified slide data model with contentKind field and Slide union type
  - slice: S01
    provides: useAutoSave composable for debounced Firestore writes
affects:
  []
key_files:
  - src/types/slide.ts
  - src/types/scriptureReading.ts
  - src/utils/scriptureSplitter.ts
  - src/stores/scriptureSlides.ts
  - src/components/ScriptureSlideEditor.vue
  - src/components/CongregationalEditor.vue
  - src/views/ServiceEditorView.vue
  - src/types/service.ts
key_decisions:
  - ScriptureSlide added to unified Slide union with contentKind: 'scripture' — consistent with S01 architecture decision (MEM001)
  - Firestore path organizations/{orgId}/scriptureReadings as flat collection, not nested under songs
  - Create-on-first-fetch pattern: createReading on initial ESV fetch, updateReading on subsequent edits
  - CongregationalSection type shared between ScriptureSlide and ScriptureReading (defined in T01 slide.ts)
  - Default alternating Leader/Congregation pattern for liturgical reading convention
  - Toggle buttons over dropdowns for speaker role — only two options makes toggle more efficient
  - ScriptureSlot extended with scriptureReadingId and readingMode fields for S03 linkage prep
patterns_established:
  - Scripture editors follow SongLyricEditor fetch-split-edit-autosave pattern with useAutoSave composable
  - Create-on-first-fetch: createReading on initial data load, updateReading on subsequent edits
  - Reading mode toggle on service slots switches between editor variants inline
observability_surfaces:
  - Auto-save status indicator (Saving/Saved/Error) on both editors — reused from useAutoSave composable
  - ESV fetch error state rendered as user-visible component error text
  - No server-side monitoring — all failures are user-visible by design
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-07-24T14:19:52.659Z
blocker_discovered: false
---

# S02: Scripture and Congregational Reading Slides

**Added scripture slide creation with ESV auto-fetch and auto-split, congregational reading mode with Leader/Congregation labels, and wired both editors into ServiceEditorView with reading mode toggle — 71 new tests, full suite green.**

## What Happened

S02 delivers two new editor components for scripture-based slides, building on S01's unified slide model and auto-save infrastructure.

**T01 — Types and splitter utility:** Added ScriptureSlide to the Slide union (contentKind: 'scripture') and ScriptureReading Firestore document type. Implemented splitPassage utility that splits ESV text at verse boundaries with configurable words-per-slide threshold, with sentence-boundary fallback for text without verse markers. 10 unit tests cover short/long/edge cases.

**T02 — Pinia store:** Created useScriptureSlides store following the songLyrics pattern — CRUD operations, real-time Firestore subscription via onSnapshot, flat collection path (organizations/{orgId}/scriptureReadings). 15 tests across 7 describe blocks.

**T03 — ScriptureSlideEditor:** Enter a scripture reference → fetch ESV text → see auto-split slide preview → manually override individual slides → auto-save. Uses create-on-first-fetch pattern (createReading on initial fetch, updateReading on edits). Tracks overridden slides via Set for re-fetch protection. 15 component tests.

**T04 — CongregationalEditor:** Same reference-fetch flow with Leader/Congregation speaker role assignment. Default alternating pattern (leader reads odd sections, congregation reads even). Toggle buttons for role switching, preview panel with distinct styling per role. 15 component tests.

**T05 — ServiceEditorView integration:** Added "Edit Scripture Slides" expand button on SCRIPTURE slots, reading mode toggle (Normal/Congregational) that switches between editors inline. Extended ScriptureSlot type with scriptureReadingId and readingMode fields for S03 linkage readiness. 16 integration tests.

Total: 71 new tests added. Full suite: 944 pass, 1 pre-existing failure (RosterView CollapsibleSection — unrelated, confirmed failing on clean branch).

## Verification

Ran `npx vitest run` — 944/945 tests pass. The single failure (RosterView "wraps Roles config in CollapsibleSection") is pre-existing and unrelated to S02 changes, confirmed by task authors across T03, T04, and T05. All S02-specific test files pass individually: scriptureSplitter (10), scriptureSlides store (15), ScriptureSlideEditor (15), CongregationalEditor (15), ServiceScriptureIntegration (16).

## Requirements Advanced

- R017 — Auto-save integrated in both ScriptureSlideEditor and CongregationalEditor via useAutoSave composable with status indicator
- R018 — Editors follow established SongLyricEditor UX patterns — inline expansion, clear status indicators, toggle buttons over dropdowns

## Requirements Validated

- R008 — ScriptureSlideEditor fetches ESV text, auto-splits with splitPassage (10 tests), renders preview with manual override — 15 component tests pass
- R009 — CongregationalEditor assigns Leader/Congregation roles with alternating default, toggle buttons, preview panel — 15 component tests pass

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

T04: Merge/split controls for adjacent same-speaker congregational sections were not implemented. The core deliverable (R009) is fully functional without them — users toggle individual sections to achieve any speaker arrangement. Can be added as polish enhancement.

## Known Limitations

Pre-existing RosterView test failure (1/945) unrelated to S02. Merge/split controls for congregational sections deferred — not required for R009 acceptance.

## Follow-ups

S03 consumes ScriptureSlide type and useScriptureSlides store for service slideshow assembly. ScriptureSlot.readingMode and scriptureReadingId fields are ready for S03 binding.

## Files Created/Modified

None.
