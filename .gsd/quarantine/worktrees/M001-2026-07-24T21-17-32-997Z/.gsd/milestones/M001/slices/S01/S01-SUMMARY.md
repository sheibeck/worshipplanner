---
id: S01
parent: M001
milestone: M001
provides:
  - Unified Slide type with contentKind discriminator field (src/types/slide.ts)
  - Song lyric slide sequences stored per-song in catalog subcollection (src/stores/songLyrics.ts)
  - Slide CRUD operations and Pinia store for lyrics (src/stores/songLyrics.ts)
  - Auto-save infrastructure with debounced Firestore writes (src/composables/useAutoSave.ts)
  - Slide editor components for lyric content type (SongLyricEditor, PerformanceOrderBuilder, LyricVersionHistory)
  - Media attachment fields on unified slide model (audioUrl, videoUrl in src/types/slide.ts)
requires:
  []
affects:
  - S02
  - S03
  - S05
key_files:
  - src/types/slide.ts
  - src/types/songLyrics.ts
  - src/utils/ccliParser.ts
  - src/composables/useAutoSave.ts
  - src/stores/songLyrics.ts
  - src/components/LyricPasteDialog.vue
  - src/components/SongLyricEditor.vue
  - src/components/PerformanceOrderBuilder.vue
  - src/components/LyricVersionHistory.vue
  - src/components/SongSlideOver.vue
key_decisions:
  - Append-only versioning: saveLyrics creates new Firestore doc per version, updateCurrentLyrics patches active doc for auto-save efficiency, revertToVersion copies old data into new doc preserving audit trail
  - performanceOrder stored on Song doc (not lyrics subcollection) so it persists across lyric version changes
  - SortableJS DOM-revert pattern: revert DOM in onEnd, update reactive array, let Vue re-render as source of truth — same pattern as ServiceEditorView
  - window.confirm used for discard/revert guards — matches existing useUnsavedGuard pattern, appropriate for MVP
  - Tab bar hidden in SongSlideOver create mode since lyrics require existing song ID for Firestore subcollection
  - Unified Slide type with contentKind discriminator establishes the shared data model for all future content types (S02-S06)
patterns_established:
  - useAutoSave composable with 800ms debounce, dirty tracking, and status indicators — reusable for all future editor surfaces
  - CCLI paste → parse → preview → confirm flow as the primary content ingestion pattern
  - Append-only Firestore subcollection for version history with copy-on-revert
  - SortableJS DOM-revert drag-and-drop pattern for Vue reactivity compatibility
observability_surfaces:
  - Auto-save status indicator in SongLyricEditor (user-facing health signal)
  - Firestore real-time subscription error propagation via store isLoading/error state
drill_down_paths:
  - .gsd/milestones/M001/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T04-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T05-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T06-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T07-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-07-24T13:20:14.283Z
blocker_discovered: false
---

# S01: Song Lyric Slides and Editor

**CCLI paste parser, lyric editor with auto-save, performance order builder with drag-and-drop, version history with revert — 100 tests passing across 8 test files**

## What Happened

Slice S01 delivers the foundational song lyric editing system across 7 tasks:

**T01 — CCLI Parser & Types:** Created the unified Slide type with contentKind discriminator (R019) and the CCLI SongSelect paste parser that auto-splits lyrics into labeled sections (Verse, Chorus, Bridge, etc.) with copyright extraction (R001, R002). 19 tests.

**T02 — useAutoSave Composable:** Extracted the debounced auto-save pattern from ServiceEditorView into a reusable composable with 800ms debounce, dirty tracking, and save-state indicators (R017). 12 tests.

**T03 — Song Lyrics Pinia Store:** Built the Firestore subcollection CRUD store with real-time subscription, append-only version snapshots (R004), and performance order updates. Each saveLyrics creates a new doc; updateCurrentLyrics patches in-place for auto-save efficiency. performanceOrder lives on the Song doc to persist across lyric versions (R020). 20 tests.

**T04 — Lyric Paste Dialog:** Paste dialog with live preview of parsed sections, confirm/cancel guards using window.confirm, and default performance order derived from section order. 12 tests.

**T05 — Song Lyric Editor:** Main editor with inline section editing, auto-save status indicators, and copyright display gated on ccliSongNumber presence. Uses reactive editableSections with deep watch and isDirty guard to prevent auto-save on initial load (R017, R018). 13 tests.

**T06 — Performance Order Builder:** Drag-and-drop reorder using SortableJS with DOM-revert pattern (same as ServiceEditorView), section add/remove with repeat support, and reset-to-default (R003). 8 tests.

**T07 — Version History & SongSlideOver Integration:** LyricVersionHistory with confirm-to-revert, conditionally rendered when versions exist. SongSlideOver extended with tabbed Lyrics interface; tab bar hidden in create mode since lyrics require an existing song ID (R004, R018). 16 tests.

## Verification

Ran all 8 S01 test files together via `npx vitest run` — 100 tests passed in 12.11s (exit code 0). Test suites: ccliParser (19), useAutoSave (12), songLyrics store (20), LyricPasteDialog (12), SongLyricEditor (13), PerformanceOrderBuilder (8), LyricVersionHistory + SongSlideOver (16). Evidence: gsd_exec c4171d68-3b45-4cc9-ad2c-481c8fa273b2.

## Operational Readiness

This slice is entirely client-side UI with Firestore as the persistence layer. There are no custom backend services, Cloud Functions, or server processes introduced.

**Health signal:** The auto-save status indicator (useAutoSave composable) surfaces save state directly to the user — "Saving…", "Saved", or error state. Firestore real-time subscription keeps the UI in sync; onSnapshot errors propagate through the store's isLoading/error state.

**Failure signal:** Auto-save failures surface immediately via the status indicator in the editor UI. Firestore connectivity issues are visible through the real-time subscription dropping (lyrics stop updating). No backend alerting needed — failures are user-visible by design.

**Recovery:** Firestore handles offline persistence and retry natively. If auto-save fails, the user sees the status indicator and can retry. Version history provides rollback for data corruption (revertToVersion creates a new doc from the old version's data).

**Monitoring gaps:** No server-side logging of paste parse failures or save errors. Acceptable for S01 — analytics/error reporting is out of scope for this foundational slice.

## Requirements Advanced

None.

## Requirements Validated

- R001 — CCLI parser splits paste text into labeled sections (Verse, Chorus, Bridge, etc.) — 19 parser tests + LyricPasteDialog live preview confirms
- R002 — Copyright extraction (title, authors, CCLI song number, license) displayed in paste preview and editor — tested in ccliParser and SongLyricEditor test suites
- R003 — PerformanceOrderBuilder with drag-and-drop reorder, add/remove/repeat sections, reset-to-default — 8 tests
- R004 — Append-only version snapshots via saveLyrics, revertToVersion with confirm guard in LyricVersionHistory — 20 store tests + 16 component tests
- R017 — useAutoSave composable with 800ms debounce and status indicators integrated into SongLyricEditor — 12 composable tests + 13 editor tests
- R018 — Dark-first UI with intuitive tabbed interface in SongSlideOver, confirmation guards on discard/revert — tested across all component suites
- R019 — Unified Slide type with contentKind discriminator defined in src/types/slide.ts — used by all lyric components
- R020 — Lyrics stored in per-song Firestore subcollection (songs/{id}/lyrics), not per-service — enforced by songLyrics store design

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None — all 7 tasks completed as planned with no blockers or scope changes.

## Known Limitations

No Playwright e2e specs yet — browser-executable UAT relies on interactive browser_* checks at run-uat time. No server-side error logging for paste parse failures. window.confirm used for guards rather than custom modal — acceptable for MVP.

## Follow-ups

None.

## Files Created/Modified

None.
