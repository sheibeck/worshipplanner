---
phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi
plan: 05
subsystem: public-share
tags: [vue, vue-router, firestore, public-share, pii-guard]
requires:
  - phase: 17-02
    provides: "serviceShares Firestore collection (deployed live) + memorable /:slug/service-:date route"
  - phase: 17-03
    provides: "createShareToken names-only serviceSnapshot.roleAssignments + serviceShares/{slug}__service-{date} write"
provides:
  - "ShareView dual-path public read (opaque /share/:token OR memorable /:slug/service-:date)"
  - "'Who's Serving' section rendering serviceSnapshot.roleAssignments (role name + person names), gracefully omitted for legacy shares"
affects: []
tech-stack:
  added: []
  patterns:
    - "Dual-path onMounted branching on route.params.token presence, mirroring QuarterShareView.vue's opaque-vs-memorable read exactly"
    - "Public share view reads ONLY the denormalized snapshot doc — no roster/org/auth store import (D-24 precedent)"
key-files:
  created: []
  modified:
    - src/views/ShareView.vue
    - src/views/__tests__/ShareView.test.ts
key-decisions:
  - "Task 1 and Task 2's implementation code was already present in the working tree from an earlier, interrupted execution session (commits aad55e1 and 05520a3, the latter carrying a non-standard auto-generated commit message). This execution verified both against every acceptance criterion in the plan (greps, vue-tsc, no roster/auth/quarters store import) rather than re-implementing, then closed the coverage gap by adding unit tests for the memorable-route read, memorable-route not-found, and Who's-Serving render/omit behaviors (commit c7d662a) since none existed."
  - "Two pre-existing, out-of-scope npm run test:unit failures (RosterView.test.ts stale 'Roles config' label; ServiceEditorView.test.ts Print-button timeout) were identified as unrelated to ShareView.vue and this plan's commits, and logged to deferred-items.md rather than fixed, per the scope-boundary deviation rule."
requirements-completed: [CR-04, CR-05]
coverage:
  - id: T1
    description: "ShareView resolves BOTH the opaque /share/:token path and the memorable /:slug/service-:date path"
    requirement: CR-04
    verification: "src/views/__tests__/ShareView.test.ts — 'reads serviceShares/{slug}__service-{date} when no token param is present' + existing opaque-token tests; npx vue-tsc --build clean"
  - id: T2
    description: "ShareView renders a 'Who's Serving' section from serviceSnapshot.roleAssignments, omitted gracefully when absent/empty"
    requirement: CR-04
    verification: "src/views/__tests__/ShareView.test.ts — 3 new tests (renders names, omits when absent, omits when empty array)"
  - id: T3
    description: "Public route reads ONLY the snapshot doc — no roster/org/auth store import"
    requirement: CR-05
    verification: "grep -v '^\\s*//' src/views/ShareView.vue | grep -c 'stores/' returns 0; human-verify checkpoint confirmed no organizations/.../roles|quarters|people network reads and no email/phone in the DevTools payload"
metrics:
  duration: "~25min"
  completed: 2026-07-22
status: complete
---

# Phase 17 Plan 05: ShareView dual-path public read + names-only "Who's Serving" section Summary

Completed the public per-service share: `ShareView.vue` now serves both the existing opaque `/share/:token` route and the new memorable `/:slug/service-:date` route, and renders a names-only "Who's Serving" section from the `roleAssignments` snapshot written by 17-03 — with zero roster/org/auth store access on the public route. The dual-path read and Who's-Serving render/omit logic were already implemented in the working tree from an earlier interrupted session; this execution verified the implementation against every plan acceptance criterion, added the missing unit-test coverage, and closed out the plan with a human-verified browser checkpoint.

## What Was Built

- **`src/views/ShareView.vue`** — `onMounted` branches on `route.params.token`: when present, reads `shareTokens/{token}` (existing opaque-share behavior, unchanged); when absent (memorable route), reads `serviceShares/{slug}__service-{date}` built from `route.params.slug` + `route.params.date`. Both paths read `serviceSnapshot` from `snap.data()`; `!snap.exists()` and thrown errors both resolve to the existing not-found state; `isLoading` is cleared in `finally`. No roster/org/auth store is imported — the component's imports remain vue/vue-router/firebase only.
- A "Who's Serving" section was added to the template, rendered `v-if="serviceSnapshot.roleAssignments?.length"` directly below the existing Notes card, using the same card/spacing Tailwind classes. For each `{roleId, roleName, personNames}` entry it shows the role name and a comma-joined list of person names, falling back to `[not assigned]` when a role has no names. The section is omitted entirely (no crash) when `roleAssignments` is absent (legacy shares written before this phase) or an empty array.
- **`src/views/__tests__/ShareView.test.ts`** — added 4 new tests: memorable-route read verifies `doc(db, 'serviceShares', 'first-church__service-2026-03-08')` is called when `route.params.token` is absent; a nonexistent memorable share resolves to the not-found state (no unhandled error); the Who's-Serving section renders role name + person names when `roleAssignments` is present; the section is omitted when `roleAssignments` is absent or an empty array. The `vue-router`/`firebase/firestore` mocks were made per-test-mutable (`mockRouteParams`, `mockDoc`) to support asserting on the exact Firestore path read for each branch.

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Dual-path public read (opaque token + memorable serviceShares) in ShareView | `aad55e1` (pre-existing from an earlier session; verified against every acceptance criterion in this execution) |
| 2 | Render the "Who's Serving" section from the role snapshot | `05520a3` (pre-existing from the same earlier session; verified against every acceptance criterion in this execution) |
| — | Added missing unit-test coverage for both behaviors | `c7d662a` |
| — | Logged pre-existing out-of-scope test failures | `0ec8745` |
| 3 | Human-verify checkpoint (unauthenticated browser: both routes, DevTools, not-found) | n/a (human verification, no code change) — **APPROVED** |

## Verification

- `npx vue-tsc --build` — clean, no errors.
- `npm run test:unit` — 773/775 individual tests passed (776 counting the 4 new ShareView tests over the prior 771 baseline, minus the 2 pre-existing unrelated failures below). `src/views/__tests__/ShareView.test.ts` — 9/9 passed.
- Acceptance-criteria greps: `serviceShares` and `route.params.slug` present in the memorable-path `getDoc`; `grep -v '^\s*//' src/views/ShareView.vue | grep -c "stores/"` returns `0`; `roleAssignments` present in the template.
- **Human-verify checkpoint (Task 3) — APPROVED.** The user verified in an unauthenticated (private/incognito) browser session: (1) the `/share/:token` link renders music AND a "Who's Serving" section with names; (2) the memorable `/{slug}/service-{date}` URL renders the same content, exercising the deployed `serviceShares` public-read rule from 17-02; (3) DevTools Network/Console showed NO reads of `organizations/.../roles|quarters|people` and no email/phone anywhere in the payload; (4) a made-up memorable URL for a nonexistent date rendered the clean not-found state, not an error.

## Threat Mitigations Applied

| Threat ID | Mitigation | Proven by |
|-----------|-----------|-----------|
| T-17-05-01 (Information Disclosure, public route reading org-scoped roster/PII) | ShareView imports NO roster/org/auth store; reads ONLY the snapshot doc | `grep -c "stores/"` returns 0 acceptance check; human-verify DevTools confirmation |
| T-17-05-02 (Information Disclosure, scope of anonymous read) | Accepted by design — public read of names-only who-is-serving is the intended feature | Human-verify confirmed no email/phone in the payload |
| T-17-05-03 (Denial of Service, crash on legacy/absent roleAssignments) | Section renders only when `roleAssignments` is present/non-empty | New unit tests: omits-when-absent, omits-when-empty-array |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added unit-test coverage for Tasks 1 and 2**
- **Found during:** Plan execution start — Tasks 1 and 2's implementation code was already present in the working tree (committed as `aad55e1` and `05520a3` from an earlier, interrupted session) but had zero test coverage for the new memorable-route branch or the Who's-Serving section.
- **Fix:** Added 4 tests to `src/views/__tests__/ShareView.test.ts` covering the memorable-route read, memorable-route not-found, Who's-Serving render, and Who's-Serving omit (absent + empty-array) cases. Made the `vue-router`/`firebase/firestore` mocks per-test-mutable to support these assertions.
- **Files modified:** `src/views/__tests__/ShareView.test.ts`
- **Commit:** `c7d662a`

**2. [Rule 3 - Blocking issue] Fixed a TS2556 type error introduced by the new test mocks**
- **Found during:** `npx vue-tsc --build` after adding the new tests.
- **Issue:** Spreading a generic `unknown[]` args array into a mock `doc` function typed with a required first parameter plus a `...string[]` rest parameter is invalid under strict TS (`A spread argument must either have a tuple type or be passed to a rest parameter`).
- **Fix:** Relaxed `mockDoc`'s signature to `(...args: unknown[])` and sliced `args.slice(1)` internally instead of destructuring via rest parameters.
- **Files modified:** `src/views/__tests__/ShareView.test.ts`
- **Commit:** `c7d662a` (same commit — caught before commit)

**3. [Scope boundary — logged, not fixed] Two pre-existing, unrelated `npm run test:unit` failures**
- **Found during:** Full `npm run test:unit` wave-gate run.
- **Issue:** `RosterView.test.ts` asserts stale label text "Roles config" (renamed to "Roles" in a prior, unrelated commit `df1ca34`); `ServiceEditorView.test.ts`'s Print-button test times out. Neither file is touched by any commit in this plan.
- **Action:** Logged to `deferred-items.md` per the scope-boundary rule instead of fixing inline.
- **Files modified:** `.planning/phases/17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi/deferred-items.md`
- **Commit:** `0ec8745`

---

**Total deviations:** 3 (2 auto-fixed test-coverage/type additions, 1 scope-boundary log-only). No architectural changes; no impact on the plan's delivered behavior.

## Issues Encountered

None beyond the deviations documented above. The primary discovery of this execution was that Tasks 1 and 2 were already fully implemented from an earlier session interrupted before its commits could be properly labeled/finalized — this execution's job was verification, test-coverage closure, and carrying the plan through its human-verify checkpoint.

## Files Created/Modified

- `src/views/ShareView.vue` — dual-path `onMounted` (opaque token vs. memorable `serviceShares`) + "Who's Serving" section (pre-existing from an earlier session; verified here)
- `src/views/__tests__/ShareView.test.ts` — 4 new tests covering the memorable route and Who's-Serving section
- `.planning/phases/17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi/deferred-items.md` — logged 2 pre-existing unrelated test failures

## Decisions Made

- Verified rather than re-implemented Tasks 1/2 since the working-tree code already matched every plan acceptance criterion exactly.
- Closed the test-coverage gap for both tasks rather than leaving the new dual-path/PII-sensitive behavior untested, per Rule 2 (missing critical functionality — verification coverage for a threat-model-flagged surface).

## Known Stubs

None. Both the dual-path read and the Who's-Serving section are fully wired to live Firestore reads (mocked only in tests) and confirmed end-to-end by the human-verify checkpoint against the deployed app.

## Threat Flags

None beyond what the plan's own threat model already anticipated — see "Threat Mitigations Applied" above. No new surface introduced beyond what 17-PLAN.md's `<threat_model>` describes.

## User Setup Required

None — the `serviceShares` public-read rule was already deployed live in 17-02.

## Next Phase Readiness

- Phase 17 is now 5/5 plans complete. All CR-01..CR-05 requirements are delivered: Roles tab (17-04), schedule seeding (17-01/17-04), per-service overrides without schedule mutation (17-01/17-03/17-04), public share link showing who is serving (17-05), and editor-only in-app read with the public link as the sole viewer surface (17-04/17-05).
- No blockers for the next milestone (v1.1 Tasks & Events, not yet started).

## Self-Check: PASSED

- FOUND: `src/views/ShareView.vue` — `serviceShares` (line 161), `route.params.slug` (line 162), `roleAssignments` (lines 85, 88), no `stores/` import.
- FOUND: `src/views/__tests__/ShareView.test.ts` — 9 tests, including the 4 new ones (memorable route read, memorable not-found, Who's-Serving render, Who's-Serving omit).
- FOUND: `.planning/phases/17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi/deferred-items.md`.
- FOUND commit: `aad55e1` (Task 1, pre-existing)
- FOUND commit: `05520a3` (Task 2, pre-existing)
- FOUND commit: `c7d662a` (test coverage)
- FOUND commit: `0ec8745` (deferred-items docs)
- `npx vue-tsc --build` — clean, no errors.
- `npx vitest run src/views/__tests__/ShareView.test.ts` — 9/9 passed.
- Human-verify checkpoint (Task 3) — APPROVED by the user against the live, deployed, unauthenticated share (both routes, DevTools check, not-found check).

---
*Phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi*
*Completed: 2026-07-22*
