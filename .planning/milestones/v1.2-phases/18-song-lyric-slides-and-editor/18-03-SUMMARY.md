---
phase: 18-song-lyric-slides-and-editor
plan: 03
status: complete
requirements: [R004, R020]
commits:
  - 76589a0 feat(M001-S01-T03): add songLyrics Pinia store with Firestore subcollection CRUD
key-files:
  created:
    - src/stores/songLyrics.ts
    - src/stores/__tests__/songLyrics.test.ts
  modified:
    - src/types/song.ts
    - src/stores/songs.ts
---

# Phase 18 Plan 03: Song Lyrics Pinia Store — Summary

**COMPLETE.** Built the Pinia store backing the lyrics subcollection with CRUD, live subscription, and append-only light versioning (R004), plus the `performanceOrder` field on the Song doc (R020 — lyrics live per-song in the catalog, not per-service copies).

## What Was Built

- **`src/stores/songLyrics.ts`** — `defineStore` mirroring `src/stores/songs.ts`. Exposes:
  - `subscribeLyrics(orgId, songId)` — `onSnapshot` on `organizations/{orgId}/songs/{songId}/lyrics`, ordered `createdAt desc`, into a reactive `SongLyrics[]`.
  - `currentLyrics` computed — most recent doc (the active version); `lyricVersions` computed — all docs for history display.
  - `saveLyrics(...)` — creates a NEW subcollection doc (each explicit save = a new version).
  - `updateCurrentLyrics(...)` — updates the active doc in place (auto-save path; does not spawn a version).
  - `revertToVersion(...)` — copies a prior version's data into a new doc (append-only revert).
  - `updatePerformanceOrder(orgId, songId, order)` — writes `performanceOrder` on the Song doc itself, not the lyrics subcollection.
  - `unsubscribeLyrics()` — detaches the snapshot listener.
- **`src/types/song.ts`** — added optional `performanceOrder: string[]` (and threaded through the upsert input type).
- **`src/stores/songs.ts`** — `subscribe()` normalizes missing `performanceOrder` to `[]` for legacy docs, following the existing tags/removedThemes normalization pattern.

## Design Notes

The active-version-is-most-recent model means auto-save mutates the current doc in place while "Save Version" and revert append new docs — giving light versioning without a branching model. Performance order deliberately lives on the Song doc so services can build slideshows without loading full lyric text.

## Verification

`npx vitest run src/stores/__tests__/songLyrics.test.ts` — 20 tests pass, mocking `firebase/firestore` per the `songs.test.ts` pattern, covering subscribe/current/save/updateCurrent/revert/updatePerformanceOrder/unsubscribe. Confirmed at phase UAT.
