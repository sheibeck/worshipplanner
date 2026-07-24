---
id: T03
parent: S01
milestone: M001
key_files:
  - src/stores/songLyrics.ts
  - src/stores/__tests__/songLyrics.test.ts
  - src/types/song.ts
  - src/stores/songs.ts
key_decisions:
  - Each saveLyrics call creates a new Firestore doc (append-only versioning per R004), while updateCurrentLyrics patches the active doc in place for auto-save efficiency
  - revertToVersion copies old version data into a new doc rather than mutating — preserves full audit trail
  - performanceOrder lives on the Song doc (not lyrics subcollection) so it persists across lyric version changes
duration: 
verification_result: passed
completed_at: 2026-07-24T13:08:11.379Z
blocker_discovered: false
---

# T03: Song Lyrics Pinia store with Firestore subcollection CRUD, real-time subscription, version snapshots, and performance order updates — 20 passing tests

**Song Lyrics Pinia store with Firestore subcollection CRUD, real-time subscription, version snapshots, and performance order updates — 20 passing tests**

## What Happened

## What Happened

All four plan steps were already implemented by prior task work (T01/T02 likely scaffolded these files):

1. **`src/stores/songLyrics.ts`** — Full Pinia store with: `subscribeLyrics` (onSnapshot on `organizations/{orgId}/songs/{songId}/lyrics`, ordered by `createdAt desc`), `currentLyrics` computed (first/newest doc), `lyricVersions` computed (all docs), `saveLyrics` (addDoc for new version — R004 light versioning), `updateCurrentLyrics` (updateDoc in place for auto-save), `revertToVersion` (getDoc + addDoc copy with fresh timestamps), `updatePerformanceOrder` (updateDoc on Song doc), and `unsubscribeLyrics` (cleanup).

2. **`src/types/song.ts`** — `performanceOrder?: string[]` field already present on `Song` type (line 43).

3. **`src/stores/songs.ts`** — `performanceOrder` normalization to `[]` for legacy docs already present in subscribe handler (lines 271-273), matching the existing tags/removedThemes normalization pattern.

4. **`src/stores/__tests__/songLyrics.test.ts`** — 20 tests covering: initial state (4), subscribeLyrics with listener management and legacy field normalization (5), currentLyrics computed (2), lyricVersions computed (1), saveLyrics (1), updateCurrentLyrics with createdAt preservation (2), revertToVersion including nonexistent doc guard (2), updatePerformanceOrder (1), unsubscribeLyrics with safe-call-when-inactive (2).

## Failure Modes

- **Firestore connection loss**: onSnapshot handles reconnection natively; the store's `isLoading` stays at its last state. No custom error handling needed — Firestore SDK retries transparently.
- **getDoc in revertToVersion**: guarded with `exists()` check — returns early if the version doc is missing (e.g., deleted between UI display and revert click).
- **Concurrent writes**: Firestore's last-write-wins semantics apply to `updateCurrentLyrics`. Auto-save debouncing (provided by `useAutoSave` composable from T02) mitigates rapid concurrent writes from the same client.

## Load Profile

- Lyrics subcollection is per-song — typical count is 1-10 versions. At 10x load (100 versions), the onSnapshot query returns all docs ordered by `createdAt desc`; Firestore handles this efficiently with the index. No pagination needed at this scale.
- `updatePerformanceOrder` writes a single array field on the Song doc — constant cost regardless of load.

## Negative Tests

- `revertToVersion` — nonexistent version doc returns early without creating a new doc (line 292-306 of test)
- `unsubscribeLyrics` — safe to call when no subscription is active (line 341-345)
- `subscribeLyrics` — defaults `performanceOrder` to `[]` for legacy docs missing the field (line 156-177)
- `updateCurrentLyrics` — does not overwrite `createdAt` (line 257-269)

## Verification

Ran `npx vitest run src/stores/__tests__/songLyrics.test.ts --reporter=verbose` — all 20 tests passed in 4.14s.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/stores/__tests__/songLyrics.test.ts --reporter=verbose` | 0 | pass | 16110ms |

## Deviations

None — all four plan steps were already implemented. Verified existing code matches the task plan exactly.

## Known Issues

None

## Files Created/Modified

- `src/stores/songLyrics.ts`
- `src/stores/__tests__/songLyrics.test.ts`
- `src/types/song.ts`
- `src/stores/songs.ts`
