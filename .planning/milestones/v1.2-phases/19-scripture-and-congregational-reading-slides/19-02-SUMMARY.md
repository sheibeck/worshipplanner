---
phase: 19-scripture-and-congregational-reading-slides
plan: 02
subsystem: scripture-persistence
tags: [pinia, firestore, store, tdd, scripture]
dependency-graph:
  requires:
    - "19-01 (ScriptureReading type)"
  provides:
    - "useScriptureSlides Pinia store (CRUD + real-time subscription)"
  affects:
    - "19-03 (ScriptureSlideEditor CRUD + auto-save)"
    - "19-04 (CongregationalEditor CRUD + auto-save)"
tech-stack:
  added: []
  patterns:
    - "Pinia setup store with onSnapshot subscription (mirrors songLyrics)"
    - "Server-timestamped createdAt/updatedAt on write"
key-files:
  created:
    - src/stores/scriptureSlides.ts
    - src/stores/__tests__/scriptureSlides.test.ts
  modified: []
metrics:
  completed: 2026-07-24
status: complete
---

# Phase 19 Plan 02: useScriptureSlides store Summary

**Status: COMPLETE** — built and committed in `d25623b`.

Added the `useScriptureSlides` Pinia store: Firestore CRUD with a real-time subscription over `organizations/{orgId}/scriptureReadings`, following the songLyrics store pattern.

## What Was Built

`src/stores/scriptureSlides.ts` — a Pinia setup store exposing:
- State: `readings` (`ScriptureReading[]`), `isLoading`.
- `currentReading` computed — the first (most recently updated) reading.
- `subscribeReadings(orgId)` — `onSnapshot` on the `scriptureReadings` collection ordered by `updatedAt desc`, tearing down any prior subscription first.
- `unsubscribeReadings()` — unsubscribes and resets state.
- `createReading(orgId, data)` — `addDoc` with `serverTimestamp()` `createdAt`/`updatedAt`, returns the new doc id.
- `updateReading(orgId, readingId, data)` — `updateDoc` patch with a fresh `updatedAt`.
- `getReading(orgId, readingId)` — single-doc `getDoc`, returns `null` when absent.

## Test Coverage

`src/stores/__tests__/scriptureSlides.test.ts` — 15 unit tests with mocked Firestore covering subscribe/unsubscribe lifecycle, create (id + timestamps), update (patch + updatedAt), get (present / absent), and the `currentReading` computed. Green at UAT (part of the 71/71 suite).

## Referencing Commit

- `d25623b` — "Added useScriptureSlides Pinia store with Firestore CRUD, real-time subscription" (`src/stores/scriptureSlides.ts`, `src/stores/__tests__/scriptureSlides.test.ts`).

## Self-Check: PASSED

- FOUND: src/stores/scriptureSlides.ts (subscribeReadings, createReading, updateReading, getReading, currentReading)
- FOUND: src/stores/__tests__/scriptureSlides.test.ts
- FOUND commit: d25623b
