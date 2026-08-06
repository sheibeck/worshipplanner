# Phase 18: Song Lyric Slides and Editor - Context

**Ported from:** gsdpi slice S01 (`.gsd/milestones/M001/slices/S01/`). This phase was planned and executed under the legacy gsdpi tooling and is COMPLETE — code is built, tested, and committed. This file records the phase's goal, scope, and acceptance for the gsd-core record.

## Goal

**Demo:** Paste CCLI lyrics, see auto-split slides with copyright, arrange performance order with repeats, edit and revert with auto-save.

Deliver the foundational slide system: CCLI SongSelect paste → auto-parsed lyric sections → slide editor with performance order → copyright compliance → auto-save → light versioning. No slide types, lyric storage, or slide editor exist prior to this phase. The Song type had metadata (title, ccliNumber, author, arrangements) but zero lyric content — everything in this phase is net-new.

## Requirements

Owned by this phase:

- **R001** (core-capability): CCLI SongSelect paste auto-splits into lyric sections with correct section labels.
- **R002** (compliance): Copyright info (title, authors, CCLI song number, copyright lines, license number) extracted and displayed on first/last lyric slides.
- **R003** (core-capability): Performance order builder allows adding, removing, and reordering sections with repeats via drag-and-drop (e.g. Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus).
- **R004** (continuity): Light version history on lyrics — version snapshots on explicit save, revert to any previous version (undo/revert, not branching).
- **R017** (failure-visibility): Auto-save with 800ms debounce persists edits as the user works; a status indicator shows save state.
- **R019** (constraint): Unified Slide data model — single type with a `contentKind` discriminator field established.
- **R020** (constraint): Single canonical song version — lyrics stored per-song in a catalog subcollection, not per-service copies.

Supporting:

- **R018** (quality-attribute): Dark-first polished UI usable by non-technical volunteers on first attempt.

## Scope

**In scope:** unified Slide type, song-lyrics types, CCLI paste parser, reusable auto-save composable, song-lyrics Pinia store (Firestore subcollection CRUD + versioning), lyric paste dialog, lyric editor, performance-order builder, version-history UI, and SongSlideOver lyrics-tab integration.

**Out of scope (later phases):** scripture/congregational slides (Phase 19), service sections and slide auto-assembly (Phase 20), PowerPoint/announcement/sermon import (Phase 21), media attachments (Phase 22), full presentation/preview mode (Phase 23). The editor's per-section preview is card-style only; full-screen presentation rendering is a later phase.

## Data Model Decisions

- Lyrics stored as a subcollection `organizations/{orgId}/songs/{songId}/lyrics`, one doc per version (light versioning); active version is the most recent. Lyrics are NOT embedded on the Song doc (would bloat list-view reads).
- The unified `Slide` type carries a `contentKind` discriminator; this phase implements only `contentKind: 'lyric'`. Later phases add `'scripture'`, `'imported'`, etc.
- Performance order lives on the Song doc as `performanceOrder: string[]` (lightweight, accessible without loading full lyric text).
- Firestore rules already cover the new subcollection via the wildcard `match /{collection}/{docId}` under organizations — no rule change needed.

## Acceptance

Verified via UAT (browser-executable, verdict PASS): 100 unit tests across 8 test files pass. CCLI paste and parse produces correct sections/labels/copyright; section editing auto-saves with 800ms debounce and status indicator; performance-order builder supports add/reorder/repeat/reset; version history lists versions and reverts append-only; discard guard prompts on unsaved paste; edge cases (empty paste, no-marker paste, all sections removed, single version) handled. One live-Firestore-reload persistence check was marked NEEDS-HUMAN (store tests confirm the write path; browser automation was unavailable at UAT time).
