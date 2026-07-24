---
estimated_steps: 21
estimated_files: 2
skills_used: []
---

# T02: Scripture slides Pinia store with Firestore CRUD and tests

**Why:** The store provides the persistence layer for scripture readings, following the proven songLyrics store pattern. Components in T03/T04 depend on this for CRUD operations.

**Do:**
1. Create `src/stores/scriptureSlides.ts` as a Pinia store (`useScriptureSlides`):
   - Follow `src/stores/songLyrics.ts` pattern exactly: `defineStore`, `ref`/`computed`, Firestore subscription
   - Firestore path: `organizations/{orgId}/scriptureReadings/{id}`
   - `subscribeReadings(orgId: string)` — `onSnapshot` with `orderBy('updatedAt', 'desc')` for real-time sync
   - `unsubscribeReadings()` — cleanup listener
   - `readings` ref with `ScriptureReading[]`, `isLoading` ref
   - `createReading(orgId, data)` — `addDoc` with `serverTimestamp()` on createdAt/updatedAt
   - `updateReading(orgId, readingId, data)` — `updateDoc` with `serverTimestamp()` on updatedAt (for auto-save patches)
   - `getReading(orgId, readingId)` — `getDoc` for single-read access
   - `currentReading` computed — most recent reading (first in desc-ordered list)

2. Create `src/stores/__tests__/scriptureSlides.test.ts`:
   - Mock Firestore (`vi.mock('firebase/firestore')`) following songLyrics test pattern
   - Test subscribeReadings sets up onSnapshot listener
   - Test createReading calls addDoc with correct path and serverTimestamp
   - Test updateReading calls updateDoc with correct path
   - Test unsubscribeReadings cleans up listener
   - Test currentReading computed returns first item
   - Test isLoading transitions

**Done-when:** `npx vitest run src/stores/__tests__/scriptureSlides.test.ts` passes. Store exports `useScriptureSlides` with subscribe/create/update/unsubscribe/getReading functions.

## Inputs

- `src/stores/songLyrics.ts`
- `src/types/scriptureReading.ts`
- `src/types/service.ts`

## Expected Output

- `src/stores/scriptureSlides.ts`
- `src/stores/__tests__/scriptureSlides.test.ts`

## Verification

npx vitest run src/stores/__tests__/scriptureSlides.test.ts
