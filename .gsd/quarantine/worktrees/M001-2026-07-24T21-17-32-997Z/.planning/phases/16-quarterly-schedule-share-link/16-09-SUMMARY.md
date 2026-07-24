---
phase: 16-quarterly-schedule-share-link
plan: 09
subsystem: sharing
tags: [firestore, vue3, pinia, share-link, slug]

# Dependency graph
requires:
  - phase: 16-quarterly-schedule-share-link
    provides: "src/utils/slug.ts (deriveSlug/claimSlug) and orgSlugs/quarterShares Firestore rules from plan 16-02"
provides:
  - "finalizeAndShare writes an overwrite-in-place quarterShares/{slug}__q{N}-{year} doc on every finalize"
  - "Settings 'Share URL slug' field with claim-based uniqueness and collision feedback"
affects: [16-quarter-share-view, quarterly-schedule-share-link-consumer-side]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual-edit collision surfacing: compare claimSlug's returned slug against the requested candidate; a mismatch means the exact slug was taken, surfaced as an explicit error rather than silently accepting the numeric-suffixed substitute"

key-files:
  created: []
  modified:
    - src/stores/quarters.ts
    - src/stores/__tests__/quarters.test.ts
    - src/views/SettingsView.vue

key-decisions:
  - "finalizeAndShare resolves/claims the org slug inline (getDoc on organizations/{orgId}, deriveSlug + claimSlug on first share) rather than routing through the auth store, keeping the auth store's shape unchanged per the plan's files_modified scope"
  - "Settings' manual slug save treats a claimSlug return value that differs from the requested candidate as a collision (shows the 'already taken' error) instead of silently accepting the auto-suffixed fallback, since D-18 distinguishes silent auto-derivation (finalize) from an explicit manual edit (Settings)"

patterns-established:
  - "Second Firestore write inside finalizeAndShare reuses the exact calendarWithNames/roles/label/serviceDates snapshot object shape already built for shareTokens, avoiding any duplicated name-resolution logic"

requirements-completed: [R-02]

# Metrics
duration: ~25min
completed: 2026-07-10
---

# Phase 16 Plan 09: Quarterly Schedule Share Link — Memorable-URL Producer Side Summary

**Settings gained an editable, claim-enforced "Share URL slug" field, and `finalizeAndShare` now writes a stable, overwrite-in-place `quarterShares/{slug}__q{N}-{year}` snapshot doc alongside the existing `shareTokens` write.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 3 (2 source, 1 test)

## Accomplishments
- `finalizeAndShare` (src/stores/quarters.ts) resolves the org's slug on every finalize — reading the org doc, deriving + claiming a slug via `deriveSlug`/`claimSlug` on first share, persisting it, then writing `quarterShares/{slug}__q{N}-{year}` with a stable doc ID so repeated finalizes overwrite in place instead of accumulating.
- The `quarterShares` snapshot reuses the exact `calendarWithNames`/roles/label/serviceDates object already built for `shareTokens` — no duplicated name-resolution logic, and no email/phone fields (D-24).
- Settings (`src/views/SettingsView.vue`) now has a "Share URL slug" field that loads the org's persisted slug (or a live-derived default from the org name), shows a live `{slug}`-filled helper string, and saves exclusively through `claimSlug`'s create-only `orgSlugs` claim — never a raw `updateDoc` of the slug field alone.
- A collision (the requested slug already claimed by another org) surfaces the exact UI-SPEC copy: "That URL is already taken — try a different one."

## Task Commits

Each task was committed atomically:

1. **Task 1: finalizeAndShare writes the quarterShares memorable-URL doc (overwrite-in-place)** - `f4f295f` (feat)
2. **Task 2: Settings "Share URL slug" field with uniqueness + collision handling** - `3e44989` (feat)

## Files Created/Modified
- `src/stores/quarters.ts` - `finalizeAndShare` now reads/derives/claims the org slug and writes the overwrite-in-place `quarterShares` doc after the existing `shareTokens` write and quarter status update
- `src/stores/__tests__/quarters.test.ts` - added a `getDoc` mock (org-doc read), fixed the `shareTokens` assertion to select by doc path (now one of several `setDoc` calls), and added two new tests covering the `quarterShares` write and the slug auto-derive/claim/persist path
- `src/views/SettingsView.vue` - new "Share URL slug" field (input, live helper preview, save button, error/success feedback), backed by `loadOrgSlug`/`onSaveSlug`

## Decisions Made
- Resolved the org slug directly via `getDoc(doc(db,'organizations',orgId))` inside `quarters.ts` and `SettingsView.vue` rather than adding a `slug` ref to the auth store — keeps this plan's file scope to exactly what the frontmatter's `files_modified` declares (`src/stores/quarters.ts`, `src/views/SettingsView.vue`).
- Manual Settings slug edits treat a `claimSlug` return value that differs from the typed candidate as a collision — shown as the UI-SPEC's "already taken" error — rather than silently accepting the numeric-suffixed fallback that `claimSlug` would otherwise return. This matches the plan's must_haves truth ("a collision surfaces the 'already taken' error") while leaving `claimSlug`'s existing silent-suffix behavior untouched for the finalize-time auto-derivation path (D-18's system-derived slug case).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated existing quarters.test.ts assertions/mocks to accommodate the new getDoc call and second setDoc write**
- **Found during:** Task 1
- **Issue:** `finalizeAndShare` gained a new `getDoc` call (org-doc slug read) not present in the test file's `firebase/firestore` mock, and a second `setDoc` call (`quarterShares`) that broke the existing `expect(setDoc).toHaveBeenCalledOnce()` assertion in the `shareTokens` write test.
- **Fix:** Added a `getDoc` mock keyed on the `organizations/{orgId}` doc path (backed by a resettable `mockOrgDoc` fixture), and changed the `shareTokens` test to select its `setDoc` call by doc path instead of assuming it's the only call. Added two new tests covering the `quarterShares` write and the slug-claim/persist path.
- **Files modified:** src/stores/__tests__/quarters.test.ts
- **Verification:** `npx vitest run src/stores/__tests__/quarters.test.ts` — 37/37 passing
- **Committed in:** f4f295f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the plan's own required verification (`quarters.test.ts` green) passing after the new write path was added. No scope creep — test-only changes plus the two required new tests for the plan's own deliverable.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (Runtime success requires the `orgSlugs`/`quarterShares` Firestore rules already deployed from plan 16-02, per this plan's `<verification>` note.)

## Next Phase Readiness
- The producer side (slug claim + `quarterShares` write) is complete and unit-tested; the consumer side (routing `/:slug/quarter:num-:year` to read from `quarterShares` in `QuarterShareView.vue`) is a separate plan in this phase and is unaffected by this plan's scope.
- No blockers identified.

---
*Phase: 16-quarterly-schedule-share-link*
*Completed: 2026-07-10*
