---
id: T02
parent: S02
milestone: M001
key_files:
  - src/stores/scriptureSlides.ts
  - src/stores/__tests__/scriptureSlides.test.ts
key_decisions:
  - Firestore path is organizations/{orgId}/scriptureReadings (flat collection, not nested under songs)
  - Store returns new doc ID from createReading for immediate caller use
  - getReading returns null (not throws) for missing docs — callers handle gracefully
duration: 
verification_result: passed
completed_at: 2026-07-24T13:53:12.385Z
blocker_discovered: false
---

# T02: Added useScriptureSlides Pinia store with Firestore CRUD, real-time subscription, and 15 passing tests

**Added useScriptureSlides Pinia store with Firestore CRUD, real-time subscription, and 15 passing tests**

## What Happened

Created `src/stores/scriptureSlides.ts` following the proven `songLyrics.ts` pattern exactly. The store provides:

- **subscribeReadings(orgId)** — real-time `onSnapshot` listener on `organizations/{orgId}/scriptureReadings` ordered by `updatedAt desc`
- **unsubscribeReadings()** — cleanup listener with state reset
- **createReading(orgId, data)** — `addDoc` with `serverTimestamp()` on both createdAt/updatedAt, returns the new doc ID
- **updateReading(orgId, readingId, data)** — `updateDoc` with `serverTimestamp()` on updatedAt only (for auto-save patches)
- **getReading(orgId, readingId)** — `getDoc` for single-read access, returns null when doc doesn't exist
- **currentReading** computed — first item in the desc-ordered list (most recently updated)
- **readings** ref and **isLoading** ref for reactive state

The Firestore collection path is `organizations/{orgId}/scriptureReadings` (flat, not nested under songs like lyrics). The store is simpler than songLyrics since scripture readings don't need versioning or performance order — they're standalone documents.

Test file mirrors the songLyrics test structure with Firestore mocks, snapshot simulation helpers, and covers all CRUD operations plus edge cases (null returns, safe double-unsubscribe, listener replacement).

## Failure Modes

The store has one external dependency: Firestore. Failure paths:
- **onSnapshot connection loss**: Firestore SDK handles reconnection internally; `isLoading` stays at its last value (false after first snapshot). The component layer (T03) will surface stale-data indicators.
- **addDoc/updateDoc/getDoc network failure**: These return rejected Promises that bubble to the calling component. No silent swallowing — the component's error handling (T03 auto-save status) will catch and display.
- **getReading on nonexistent doc**: Returns `null` explicitly (tested). Callers must handle the null case.

## Load Profile

At 10x load (~10x concurrent scripture readings per org): Firestore `onSnapshot` is per-org, not per-reading, so a single listener handles any number of readings. The `readings` array grows linearly but scripture readings are small documents. No pagination needed at 10x — Firestore snapshot listeners handle thousands of docs efficiently. The bottleneck would be Firestore read quotas, which are managed at the Firebase project level, not in-app.

## Negative Tests

- `getReading` returns null for nonexistent doc (line ~196 in test)
- `unsubscribeReadings` is safe to call with no active subscription (line ~227)
- `currentReading` returns null when readings array is empty (line ~94)
- `subscribeReadings` replaces previous listener without leak (line ~119)
- `updateReading` does not overwrite `createdAt` (asserted via `expect(data.createdAt).toBeUndefined()`)

## Verification

Ran `npx vitest run src/stores/__tests__/scriptureSlides.test.ts` — all 15 tests pass across 7 describe blocks: initial state (3), subscribeReadings (4), currentReading (2), createReading (1), updateReading (1), getReading (2), unsubscribeReadings (2).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/stores/__tests__/scriptureSlides.test.ts` | 0 | pass | 7558ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/stores/scriptureSlides.ts`
- `src/stores/__tests__/scriptureSlides.test.ts`
