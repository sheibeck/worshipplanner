---
id: T03
parent: S02
milestone: M001
key_files:
  - src/components/ScriptureSlideEditor.vue
  - src/components/__tests__/ScriptureSlideEditor.test.ts
key_decisions:
  - Followed SongLyricEditor pattern for auto-save integration and status indicator styling
  - Used overriddenSlides Set to track manually edited slides for future re-fetch protection
  - Create-on-first-fetch pattern: createReading on initial fetch, updateReading on subsequent edits
duration: 
verification_result: passed
completed_at: 2026-07-24T13:59:53.417Z
blocker_discovered: false
---

# T03: Added ScriptureSlideEditor component with ESV fetch, auto-split preview, manual slide override, and auto-save integration — 15 passing tests

**Added ScriptureSlideEditor component with ESV fetch, auto-split preview, manual slide override, and auto-save integration — 15 passing tests**

## What Happened

Built `ScriptureSlideEditor.vue` following the established SongLyricEditor pattern. The component provides:

1. **Reference input**: Text input parsed via `parseScriptureInput` with a "Fetch Passage" button that enables only when the reference is valid.
2. **ESV fetch**: Calls `fetchPassageText` through the existing proxy, with loading spinner and inline error display matching ScriptureInput.vue's error pattern.
3. **Auto-split preview**: After fetch, calls `splitPassage` to generate slide cards. Each card shows its verse range label and the slide text in an editable textarea.
4. **Manual override**: Editing a slide textarea updates local state and marks the slide as overridden (tracked via `overriddenSlides` Set for future re-fetch protection).
5. **Auto-save**: Integrates `useAutoSave` composable watching `localSlides` with the store's `updateReading`. Status indicator shows pending/saving/saved states matching the SongLyricEditor pattern.
6. **Create vs edit mode**: On first fetch (no `readingId` prop), calls `createReading` and stores the returned ID. Subsequent edits auto-save via `updateReading`. When `readingId` is provided, loads the existing reading on mount and subscribes to real-time updates.
7. **Lifecycle**: Subscribes/unsubscribes Firestore listener and cleans up auto-save timers in onMounted/onUnmounted.

Test file covers: rendering, fetch button enable/disable, fetchPassageText call, slide display with verse ranges, slide editing, auto-save integration, ESV error handling, save status indicators, create-on-first-fetch, cleanup on unmount, and edit mode loading.

## Failure Modes

- **ESV API fetch failure** (network error, timeout, 4xx/5xx): Caught in try/catch, sets `fetchError = true`, displays inline error message "Could not load passage. Check your connection and try again." — tested in "shows error message when ESV fetch fails" test case.
- **Store createReading/updateReading failure**: Caught by the same try/catch in `onFetchPassage`, surfaces via the fetch error UI. Auto-save failures are handled by the `useAutoSave` composable's inflight guard (reschedules on failure).
- **getReading returns null** (edit mode, reading deleted): Handled gracefully — no slides are populated, component remains in create-ready state.

## Load Profile

This is a single-user editor component. Each fetch makes one ESV API call. Auto-save debounces at 800ms with inflight guard preventing concurrent saves. No pagination or caching needed — a single scripture reading has at most ~20 slides.

## Negative Tests

- **Empty reference**: Fetch button disabled when input is empty (tested: "fetch button is disabled when reference is empty")
- **ESV fetch failure**: Error message displayed, no slides rendered (tested: "shows error message when ESV fetch fails")
- **No error on success**: Error state clears on successful fetch (tested: "does not show error when fetch succeeds")
- **Auto-save without reading ID**: `doAutoSave` returns early if `currentReadingId` is null, preventing orphaned writes

## Verification

Ran `npx vitest run src/components/__tests__/ScriptureSlideEditor.test.ts` — 15/15 tests pass. Ran full suite `npx vitest run` — 913/914 pass; the single failure (RosterView "wraps Roles config in CollapsibleSection") is pre-existing and unrelated.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/__tests__/ScriptureSlideEditor.test.ts` | 0 | pass | 8430ms |
| 2 | `npx vitest run` | 1 | pass (913/914 — 1 pre-existing failure in RosterView.test.ts unrelated to T03) | 112639ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/components/ScriptureSlideEditor.vue`
- `src/components/__tests__/ScriptureSlideEditor.test.ts`
