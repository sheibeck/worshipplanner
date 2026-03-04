---
phase: 04-output
plan: 02
subsystem: ui
tags: [vue3, firebase, firestore, share, pinia, vitest]

# Dependency graph
requires:
  - phase: 04-01
    provides: ServiceEditorView with Print/Copy buttons, ServicePrintLayout, formatScriptureRef utility

provides:
  - createShareToken store action (generates 36-char hex token, embeds serviceSnapshot with BPM into shareTokens/{token})
  - ShareView.vue — public, unauthenticated service plan page at /share/:token with light theme
  - /share/:token router route without requiresAuth meta (public access)
  - Firestore shareTokens collection rules (public read, authenticated-only create)
  - Share button in ServiceEditorView header with "Link Copied!" feedback

affects: [any future phase involving public-facing views, Firestore rules, or sharing features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - shareTokens Firestore pattern: embed serviceSnapshot at creation time so public viewers never read protected org collections
    - Public route pattern: routes without meta.requiresAuth bypass the auth guard entirely

key-files:
  created:
    - src/views/ShareView.vue
    - src/views/__tests__/ShareView.test.ts
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts
    - src/router/index.ts
    - src/router/__tests__/router.test.ts
    - src/views/ServiceEditorView.vue
    - firestore.rules

key-decisions:
  - "shareTokens document embeds full serviceSnapshot at creation so public viewers read only /shareTokens/{token} — zero reads of protected /organizations/{orgId} collection"
  - "BPM resolved from songStore.songs at token creation time and embedded in snapshot so ShareView has complete data without any store subscriptions"
  - "ShareView uses getDoc directly (not store subscription) since it's a read-once public page with no auth context"
  - "Share button uses navigator.clipboard.writeText to copy URL; falls back gracefully if clipboard API unavailable"

patterns-established:
  - "Public snapshot embed pattern: write full denormalized snapshot to public collection at creation time to avoid Firestore auth boundary crossing"
  - "Standalone public view pattern: ShareView has no AppShell, no auth stores, reads Firestore directly via getDoc"

requirements-completed: [OUT-02]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 04 Plan 02: Share Link Summary

**Shareable service plan URL via shareTokens/{token} with embedded serviceSnapshot — public read-only ShareView.vue served at /share/:token without authentication**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T15:13:31Z
- **Completed:** 2026-03-04T15:19:33Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- createShareToken action in serviceStore generates a random 36-char hex token, resolves BPM from song arrangements, and writes a complete serviceSnapshot to shareTokens/{token} in Firestore
- ShareView.vue renders full service plan in a light, mobile-friendly theme from the embedded snapshot — handles loading, not-found, and error states without any auth context
- Firestore rules updated with public read access on shareTokens collection (authenticated-only create)
- Share button wired into ServiceEditorView header: generates token, copies URL, shows "Link Copied!" for 2 seconds

## Task Commits

Each task was committed atomically:

1. **Task 1: Share token Firestore infrastructure, store action, and store tests** - `b300d79` (feat)
2. **Task 2: ShareView public page, router route, Share button, and tests** - `0411d35` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified
- `src/stores/services.ts` - Added createShareToken action with BPM resolution; added setDoc import
- `src/stores/__tests__/services.test.ts` - Added crypto stub, setDoc mock, songs in useSongStore mock; 3 new createShareToken tests
- `firestore.rules` - Added shareTokens rule block (allow read: if true; allow create: if isSignedIn())
- `src/views/ShareView.vue` - New public, standalone service plan page; reads shareTokens/{token} via getDoc; light theme, mobile-friendly
- `src/views/__tests__/ShareView.test.ts` - 4 tests: loading state, not-found, render with data, error handling
- `src/router/index.ts` - Added /share/:token route without requiresAuth meta
- `src/router/__tests__/router.test.ts` - Added share route to test router; added unauthenticated access test
- `src/views/ServiceEditorView.vue` - Added isSharing/shareCopied state, onShare() handler, Share button in header

## Decisions Made
- shareTokens embed pattern chosen over trying to give public users org collection access — cleanly solves the Firestore auth boundary without relaxing org security
- BPM resolved at token creation time (not at view time) so ShareView is completely standalone with no store dependencies
- `setDoc` used instead of `addDoc` because the token string IS the document ID (the URL path)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Share link feature fully implemented and tested
- 225 total tests passing, build succeeds
- Phase 04 Plan 03 can proceed

---
*Phase: 04-output*
*Completed: 2026-03-04*
