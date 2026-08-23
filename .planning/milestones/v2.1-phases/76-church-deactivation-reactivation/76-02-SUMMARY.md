---
phase: 76-church-deactivation-reactivation
plan: 02
subsystem: auth
tags: [vue, pinia, firebase-functions-callable, ux]

# Dependency graph
requires:
  - phase: 76-church-deactivation-reactivation (76-01)
    provides: "setOrgActive({orgId,active}) callable, deactivatedOrgs claim, organizations/{orgId}.active field, firestore.rules isOrgActive gate"
provides:
  - "auth.ts deactivatedOrgMessage/hasDeactivatedOrg state, widened requiresOrgSelection, memberships[].active"
  - "SelectChurchView.vue greys out + labels a deactivated org, renders the store's deactivation message"
  - "OrganizationsTab.vue Deactivate/Reactivate control calling setOrgActive, with a Deactivated badge"
affects: [77-church-deletion, 78-super-admin-enter-any-church]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resetOrgContext() helper in auth.ts factors the full org-context reset (memberUnsub/orgId/orgName/.../settings) so the pre-existing no-org branch and the two new deactivation branches (denied read, defensive active:false) can never drift apart"
    - "Client login-block treats a getDoc REJECTION as the deactivation signal itself, rather than trusting a client-read boolean — matches what firestore.rules actually does post-76-01 (denies the read outright for a non-super-admin)"

key-files:
  created: []
  modified:
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts
    - src/views/SelectChurchView.vue
    - src/views/__tests__/SelectChurchView.test.ts
    - src/components/admin/OrganizationsTab.vue
    - src/components/admin/__tests__/OrganizationsTab.test.ts

key-decisions:
  - "Widened memberships to {id,name,active} rather than adding a separate lookup — the church picker and the login-block share one data source, so a caught getDoc failure (deactivation, orphaned membership, or transient error) collapses into the SAME generic active:false, never leaking which case occurred (T-76-08)"
  - "Deactivation detection has two layers: primary (a caught getDoc rejection, the real post-76-01 shape) and a defensive secondary check (a successfully-read active:false org) for a non-super-admin — the second layer is structurally unreachable today but costs nothing and guards against a future rules loosening"
  - "The Organizations tab's Deactivate/Reactivate control lives in its own always-visible block within the Actions cell (not gated by the existing assign-form v-if/v-else), so it stays available even while a row's assign-admin sub-form is open"

requirements-completed: [R213, R212, R214]

coverage:
  - id: D1
    description: "loadOrgContext wraps the primary-org getDoc in try/catch; a denied read (or defensive active:false data) resets org context and sets deactivatedOrgMessage instead of stranding isReady"
    requirement: R213
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#deactivated org login-block (R213, Phase 76)"
        status: pass
    human_judgment: false
  - id: D2
    description: "requiresOrgSelection widened to hasDeactivatedOrg so a single-org-deactivated user is routed to /select-church; a super-admin's own read of a deactivated org is not blocked"
    requirement: R213
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#deactivated org login-block (R213, Phase 76)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SelectChurchView greys out, disables, and labels '(deactivated)' any membership with active:false, never dropping it from the list; renders the store's deactivatedOrgMessage as a distinct block"
    requirement: R213
    verification:
      - kind: unit
        ref: "src/views/__tests__/SelectChurchView.test.ts#deactivated org greying (R213, Phase 76)"
        status: pass
    human_judgment: false
  - id: D4
    description: "OrganizationsTab.vue's Deactivate/Reactivate button calls setOrgActive({orgId,active}) with the exact contract 76-01 implements, WR-03 double-submit guarded, reflecting a Deactivated badge and Reactivate/Deactivate label from org.active"
    requirement: R212
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- deactivate/reactivate (R212, R214)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A failed toggle shows the friendly error and does not call refreshOrgs(); a successful toggle refreshes the row so a reactivated member's next load resolves with no manual per-member step"
    requirement: R214
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#a failed toggle shows the friendly error message and does NOT call refreshOrgs()"
        status: pass
    human_judgment: false

# Metrics
duration: ~1h
completed: 2026-08-22
status: complete
---

# Phase 76 Plan 02: Church Deactivation/Reactivation — Client Login-Block + UI Summary

**Client-side login-block in `loadOrgContext` (getDoc rejection = deactivation signal), a greyed-out/labeled church picker, and a Deactivate/Reactivate control on the Organizations tab — completing R213's UX half alongside 76-01's server-enforced boundary, and delivering R212/R214's client trigger.**

## Performance

- **Duration:** ~1h
- **Completed:** 2026-08-22
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments
- `src/stores/auth.ts`: `loadOrgContext`'s primary-org `getDoc` is now wrapped in try/catch — a denied read (the real post-76-01 shape for a deactivated org's ordinary member) resets org context via a new shared `resetOrgContext()` helper and sets `deactivatedOrgMessage`, instead of propagating an uncaught rejection that would strand `isReady` and blank the app (T-76-09). A defensive second layer also catches a successfully-read `active:false` doc for a non-super-admin. `requiresOrgSelection` is widened with `hasDeactivatedOrg` to route the single-org-deactivated case to `/select-church`. `memberships` is widened to `{id, name, active}`; a caught per-org read failure (deactivation or orphaned membership) conservatively defaults `active: false`. A super-admin's own successful read of a deactivated org is never blocked.
- `src/views/SelectChurchView.vue`: each church-option button is disabled and labeled "(deactivated)" when `m.active === false` (a missing `active` field still reads as enabled — proven by a dedicated test). `authStore.deactivatedOrgMessage` renders as a distinct amber message block above the picker, separate from the view's own `selectOrg`-try/catch error.
- `src/components/admin/OrganizationsTab.vue`: each row gets a Deactivate/Reactivate button calling `httpsCallable(functions, 'setOrgActive')({orgId, active: !org.active})`, matching 76-01's `setOrgActiveHandler` request/response contract exactly. WR-03 double-submit guarded (`togglingOrgId`), per-row error/feedback state mirroring the existing assign-admin pattern, a "Deactivated" badge next to the church name, and a success-triggered `refreshOrgs()` (skipped on failure). The component still writes no Firestore documents directly.

## Task Commits

1. **Task 1: Client login-block for a deactivated org (R213)** - `a302a5ae` (feat)
2. **Task 2: Church picker greys out a deactivated org (R213)** - `edb54a7b` (feat)
3. **Task 3: Deactivate/Reactivate control on the Organizations tab (R212, R214)** - `c1dfeaa6` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `src/stores/auth.ts` - `deactivatedOrgMessage`/`hasDeactivatedOrg`, widened `requiresOrgSelection`/`memberships`, `resetOrgContext()` helper, try/catch around the primary-org `getDoc`
- `src/stores/__tests__/auth.test.ts` - new `deactivated org login-block (R213, Phase 76)` describe block (10 tests); updated two pre-existing multi-org assertions to the widened `{id,name,active}` membership shape
- `src/views/SelectChurchView.vue` - disabled + `(deactivated)`-labeled church-option buttons, `deactivatedOrgMessage` block
- `src/views/__tests__/SelectChurchView.test.ts` - new `deactivated org greying (R213, Phase 76)` describe block (5 tests)
- `src/components/admin/OrganizationsTab.vue` - `OrgSummary.active`, `SetOrgActiveRequest`/`SetOrgActiveResponse` types, `onToggleActive`, Deactivate/Reactivate button + Deactivated badge
- `src/components/admin/__tests__/OrganizationsTab.test.ts` - `mockSetOrgActive` (name-keyed httpsCallable dispatch), `active: true` default on the `makeOrg` fixture, new `OrganizationsTab -- deactivate/reactivate (R212, R214)` describe block (5 tests)

## Decisions Made
- Widened `memberships` to include `active` rather than a parallel lookup — one data source serves both the login-block and the picker, and a caught read failure (deactivation, orphaned membership, or transient error) collapses into the same generic `active: false` + generic deactivation copy, per T-76-08.
- Kept the defensive `active === false && !isSuperAdmin` check even though it's structurally unreachable today (the rules deny the read outright) — cheap insurance against a future rules loosening, per the plan's explicit instruction.
- Placed the Deactivate/Reactivate button in its own always-visible block within the Actions cell, independent of the existing assign-admin form's `v-if`/`v-else`, so it stays available regardless of whether a row's assign sub-form is open.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing `auth.test.ts` assertions needed updating for the widened `memberships` shape**
- **Found during:** Task 1, first test run after widening `memberships` to `{id, name, active}`
- **Issue:** `memberships` is a `toEqual`-checked array; two pre-existing tests ("a user in multiple orgs must pick one" and "falls back to the org id when an org name cannot be read") asserted the old `{id, name}` shape exactly. Adding the `active` field to every returned membership object made these `toEqual` calls fail on the new key, even though no assertion about the *feature itself* was wrong.
- **Fix:** Updated both assertions to include the (correct, default-true / catch-default-false) `active` value alongside the existing `id`/`name` fields — no change to test intent, purely reflecting the intentionally widened return type.
- **Files modified:** `src/stores/__tests__/auth.test.ts`
- **Verification:** Full `auth.test.ts` suite (85 tests) passes.
- **Committed in:** `a302a5ae` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — necessary test adaptation to an intentionally widened type, not a functional bug)
**Impact on plan:** No scope creep; the plan itself specifies the widened `memberships` shape as the required behavior. This deviation is the direct, expected consequence of that change on two assertions that predate it.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None — no external service configuration required. This plan is CLIENT-ONLY: no `firestore.rules`/`storage.rules`/Cloud Functions changes, no secrets. The app-hosting deploy is the owner's normal step for shipping these UI changes; there is nothing additional to deploy beyond 76-01's already-hand-over'd `firebase deploy --only firestore:rules,storage,functions:setOrgActive`.

## Next Phase Readiness
- R213 is now complete end-to-end: 76-01 enforces the deny at `firestore.rules`/`storage.rules`, and this plan ensures the client never surfaces that denial as a blank app — always a clear "this church is deactivated" message.
- R212/R214's client trigger (the Organizations tab control) is wired to 76-01's exact `setOrgActive` contract; combined with 76-01's server-side claim fan-out, a reactivated member's next load resolves cleanly with no manual per-member step.
- Ready for Phase 77 (deletion gated on deactivated) and Phase 78 (super-admin enter-any-church) to build on this UX layer.
- No blockers.

## Gate Results

- `npm run type-check` (`vue-tsc --build`) — **clean**, run after each task.
- `npx vitest run src/stores/__tests__/auth.test.ts src/views/__tests__/SelectChurchView.test.ts src/components/admin/__tests__/OrganizationsTab.test.ts` — **121/121 pass** (85 + 8 + 28), zero regressions to any pre-existing test in these three files.
- `npx vitest run` (full app suite) — **Test Files: 2 failed | 133 passed (135)**, **Tests: 21 failed | 4030 passed (4051)** — exactly the documented known-failing baseline (`src/storage.rules.test.ts`, Storage emulator not running in this environment; `src/views/__tests__/RosterView.test.ts`'s pre-existing stale "CollapsibleSection" assertion). No other file regressed; every deactivation-related test across all three touched suites passed.
- Rules-emulator suite — not run; this plan makes no `firestore.rules`/`storage.rules`/Cloud Functions changes (76-01 owns those, already verified in 76-01-SUMMARY.md).

---
*Phase: 76-church-deactivation-reactivation*
*Completed: 2026-08-22*

## Self-Check: PASSED

All 6 modified source/test files and this SUMMARY.md verified present on disk; all three task commits (`a302a5ae`, `edb54a7b`, `c1dfeaa6`) verified present in `git log --oneline --all`.
