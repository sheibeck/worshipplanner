---
phase: 50-slide-management-bulk-delete-provenance
plan: 01
subsystem: infra
tags: [firebase-hosting, cache-control, vitest, deploy-gated]

# Dependency graph
requires: []
provides:
  - "firebase.json hosting.headers entry serving /index.html with Cache-Control: no-cache, no-store, must-revalidate"
  - "src/__tests__/firebaseHostingHeaders.test.ts guarding the header against regression"
  - "confirmation that no service worker exists to cache the shell independently"
affects: [deploy, hosting]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Reading firebase.json from disk via node:fs in tests (not a static import) so the test proves the on-disk deploy config, not a bundled copy"]

key-files:
  created: [src/__tests__/firebaseHostingHeaders.test.ts]
  modified: [firebase.json]

key-decisions:
  - "Used the stricter `no-cache, no-store, must-revalidate` (a valid superset of the PRD's `max-age=0, must-revalidate`) per the plan's explicit allowance"
  - "Scoped the header entry to source: \"/index.html\" only — did not add a catch-all `**` no-cache header, which would have also stripped the immutable cache off hashed assets/* (LOCKED decision preserved)"
  - "No deploy was run — firebase deploy remains the owner's step per the STATE.md v1.5 standing NO-DEPLOYS grant; the vitest guard is the in-repo proof for this deploy-gated change"

requirements-completed: [R109]

coverage:
  - id: D1
    description: "firebase.json serves index.html with a no-cache/must-revalidate Cache-Control header, and hashed assets/* are not narrowed"
    requirement: "R109"
    verification:
      - kind: unit
        ref: "src/__tests__/firebaseHostingHeaders.test.ts#serves index.html with a no-cache/must-revalidate Cache-Control header"
        status: pass
      - kind: unit
        ref: "src/__tests__/firebaseHostingHeaders.test.ts#does not narrow the Cache-Control of hashed assets/* to no-cache"
        status: pass
    human_judgment: false
  - id: D2
    description: "No service worker is registered that could cache the shell independently of the hosting header"
    requirement: "R109"
    verification:
      - kind: other
        ref: "grep across src/, vite.config.ts, package.json for serviceWorker.register | vite-plugin-pwa | workbox — no matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "Actual post-deploy browser cache behavior (real deploy re-fetches index.html and the current hashed bundle)"
    verification: []
    human_judgment: true
    rationale: "Deploy-gated per the standing v1.5 NO-DEPLOYS grant — no firebase deploy was run, so this can only be confirmed by the owner after their own deploy"

# Metrics
duration: 15min
completed: 2026-08-10
status: complete
---

# Phase 50 Plan 01: Firebase Hosting No-Cache Shell Summary

**Added a `hosting.headers` entry to `firebase.json` serving `/index.html` with `Cache-Control: no-cache, no-store, must-revalidate`, guarded by an on-disk-reading vitest test, with hashed `assets/*` deliberately left on their existing immutable cache.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-10T20:35:39Z
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `firebase.json` now serves `/index.html` with a no-cache/must-revalidate `Cache-Control` header, so a post-deploy browser load always re-fetches the shell document (and thus the current hashed bundle reference), instead of running a stale cached shell.
- `assets/**` and all other hashed build output are left unlisted in `hosting.headers` — their existing long/immutable cache is untouched, preserving CDN cache efficiency for versioned assets.
- Added `src/__tests__/firebaseHostingHeaders.test.ts`, which reads `firebase.json` from disk (via `node:fs` + `JSON.parse`, not a static import) and asserts: (1) an `index.html` entry exists with a `Cache-Control` matching `no-cache|max-age=0` and `must-revalidate`, and (2) no `assets` glob entry narrows its cache to no-cache. This is the in-repo proof required because the change itself is deploy-gated.
- Confirmed by inspection (grep across `src/`, `vite.config.ts`, `package.json`) that no service worker is registered anywhere in the codebase — no `serviceWorker.register`, `vite-plugin-pwa`, or `workbox` usage exists — so the new hosting header is the sole cache authority for the SPA shell.

## Task Commits

Each task was committed atomically:

1. **Task 1: Serve index.html no-cache in firebase.json** - `fbeafc7` (feat)
2. **Task 2: Guard the header with a test, confirm no service worker** - `82354c3` (test)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `firebase.json` - Added `hosting.headers` array with one entry: `source: "/index.html"` → `Cache-Control: no-cache, no-store, must-revalidate`
- `src/__tests__/firebaseHostingHeaders.test.ts` - Reads `firebase.json` from disk and asserts the index.html no-cache header exists and no assets glob is narrowed

## Decisions Made
- Used the stricter `no-cache, no-store, must-revalidate` value rather than the PRD's `max-age=0, must-revalidate` — the plan explicitly allows either as satisfying R109, and the stricter form leaves no ambiguity about intermediate caches.
- Deliberately did not add a catch-all `**` header or an `assets/**` header entry — doing either would risk stripping the immutable cache off hashed build output, which the phase's LOCKED decision requires to stay untouched.
- Did not attempt to address the deep-SPA-route header-matching nuance the plan calls out (routes like `/services/123` rewrite to `index.html` but are matched by the header layer on their own request path) — the plan explicitly scopes that as a deploy-time/human-verify concern, not a blocker for this config change.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. **This change is deploy-gated**: `firebase.json` changes only take effect on the next `firebase deploy --only hosting` (or a combined deploy), which remains the owner's step per the STATE.md v1.5 standing NO-DEPLOYS grant. No deploy command was run as part of this plan.

## Next Phase Readiness
- R109 is satisfied in-repo: the config is correct, tested, and type-checks clean.
- The actual browser-cache behavior after a real production deploy is a deferred human-verify item (see phase-level `PENDING-VERIFICATION.md` once the phase completes) — not executed here, consistent with the standing NO-DEPLOYS grant.
- No blockers for subsequent plans in this phase (50-02 through 50-05 cover different R106-R109 concerns and were not touched by this plan).

---
*Phase: 50-slide-management-bulk-delete-provenance*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: firebase.json
- FOUND: src/__tests__/firebaseHostingHeaders.test.ts
- FOUND: .planning/phases/50-slide-management-bulk-delete-provenance/50-01-SUMMARY.md
- FOUND: fbeafc7
- FOUND: 82354c3
