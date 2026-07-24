---
phase: 16-quarterly-schedule-share-link
plan: 02
subsystem: security
tags: [firestore-rules, slug, vitest, emulator, public-collections]

# Dependency graph
requires: []
provides:
  - "deriveSlug / RESERVED_SLUGS / claimSlug — memorable-URL slug derivation + create-once claim"
  - "orgSlugs + quarterShares Firestore security rules (deployed to production)"
affects: [16-09-share-slug-settings, 16-10-public-share-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "claimSlug: create-only setDoc(orgSlugs/{candidate}) with permission-denied → numeric-suffix retry (first-writer-wins, no transaction)"
    - "Public top-level collections (orgSlugs, quarterShares): allow read:true, write gated to isSignedIn(); orgSlugs create-once (update,delete:false)"

key-files:
  created:
    - src/utils/slug.ts
    - src/utils/__tests__/slug.test.ts
    - src/rules.test.ts
  modified:
    - firestore.rules

key-decisions:
  - "orgSlugs is create-once (allow update, delete: if false) — a re-derived slug abandons the old claim, never reclaims it (D-18)"
  - "quarterShares allows signed-in update (overwrite-in-place on finalize), unlike frozen shareTokens which are create-only (D-24)"
  - "Slug enumeration accepted as an intentional privacy tradeoff — memorable URLs are deliberately guessable (T-16-02-04, SPEC locked)"

patterns-established:
  - "First-writer-wins slug uniqueness via Firestore create-only rule + client-side suffix retry — no Cloud Function needed (T-16-02-06)"

requirements-completed: [R-02]

# Metrics
duration: 30min
completed: 2026-07-10
---

# Phase 16 Plan 02: Memorable-URL Data/Security Foundation Summary

**A pure `deriveSlug` + reserved-word guard + create-once `claimSlug`, plus the two new public collections' Firestore rules (`orgSlugs`, `quarterShares`) — verified by 7 slug unit tests and 30 emulator rules tests, and deployed live to production `worship-planner-bc515`.**

## Performance

- **Duration:** ~30 min (incl. checkpoint pause for production-deploy authorization)
- **Tasks:** 3 completed (Task 3 was a blocking human-action deploy gate)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Built `src/utils/slug.ts` via TDD: pure `deriveSlug(orgName)` (regex sanitize to `[a-z0-9-]+`, trims leading/trailing hyphens, cannot throw), `RESERVED_SLUGS` set (10 D-19 segments), and async `claimSlug(baseSlug, orgId)` that pre-filters reserved words then attempts create-only `setDoc(orgSlugs/{candidate})`, catching **permission-denied specifically** to increment a numeric suffix and retry (first-writer-wins).
- Added two top-level public match blocks in `firestore.rules` immediately before the catch-all: `orgSlugs` (read:true, create:isSignedIn, update/delete:false — create-once) and `quarterShares` (read:true, create/update:isSignedIn, delete:false — overwrite-in-place). Extended `src/rules.test.ts` with emulator cases for public read, signed-in create, first-writer-wins update denial, and unauthenticated write denial.
- Deployed the rules to the live production Firebase project (`firebase deploy --only firestore:rules` → compiled + released successfully) so the later share-URL consumer plans (16-09/16-10) have live rules to write against.

## Task Commits

1. **Task 1: slug utility (deriveSlug, RESERVED_SLUGS, claimSlug) — TDD** — `58c9e3e` (test, RED) → `8d1b4e6` (feat, GREEN)
2. **Task 2: orgSlugs + quarterShares Firestore rules + emulator tests** — `1ba8da5` (feat)
3. **Task 3: Deploy Firestore rules (blocking human-action gate)** — deploy side-effect, no code commit; released to production `worship-planner-bc515`

## Files Created/Modified
- `src/utils/slug.ts` — `deriveSlug`, `RESERVED_SLUGS`, `claimSlug` (create-only claim with permission-denied → suffix retry)
- `src/utils/__tests__/slug.test.ts` — 7 tests: hyphenation, non-alphanumeric stripping, hyphen trimming, reserved-word handling
- `firestore.rules` — `match /orgSlugs/{slug}` + `match /quarterShares/{shareId}` blocks (before catch-all)
- `src/rules.test.ts` — emulator describe blocks for the two new public collections

## Verification
- `npx vitest run src/utils/__tests__/slug.test.ts` — 7/7 pass
- `npm run test:rules` — 30/30 pass (incl. new orgSlugs create-once + public-read cases)
- `npx vue-tsc --build` — clean
- `firebase deploy --only firestore:rules` — rules compiled successfully and released to `cloud.firestore` (production)

## Decisions Made
See key-decisions above. Threat register (T-16-02-01..06) fully addressed: doc-ID injection (client sanitize), reserved-word squatting (pre-filter), unauthenticated write (rules), slug enumeration (accepted), PII leakage (writer-enforced in 16-09, names-only), collision race (create-only rule).

## Deviations from Plan
None. Task 3's production deploy required explicit user authorization (approved via checkpoint: "Deploy now"); the parallel worktree agent correctly could not perform the production deploy on a relayed approval — the orchestrator ran it from the main checkout after merge so the deployed rules match committed `firestore.rules`.

## Issues Encountered
Initial in-worktree deploy attempt was blocked by the permission system (production deploy from a relayed/auto-mode context). Resolved by merging the branch to `master` first, then running the deploy from the main checkout where the user's authorization applies. Deploy succeeded.

## User Setup Required
None remaining — rules are deployed. Share-URL writes (added in 16-09/16-10) will work against the live rules.

## Next Phase Readiness
- `claimSlug` / `deriveSlug` ready for 16-09's Settings "Share URL slug" field.
- `quarterShares` rules live for 16-10's public share-page consumer.
- No blockers.

---
*Phase: 16-quarterly-schedule-share-link*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created files verified present on disk; task commit hashes (58c9e3e, 8d1b4e6, 1ba8da5) present in git log; Firestore rules deploy confirmed released to production.
