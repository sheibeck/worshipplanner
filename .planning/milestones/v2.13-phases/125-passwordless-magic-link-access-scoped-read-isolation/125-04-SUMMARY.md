---
phase: 125-passwordless-magic-link-access-scoped-read-isolation
plan: 04
subsystem: auth
tags: [firebase-auth, email-link, vue-router, pinia, passwordless]

# Dependency graph
requires:
  - phase: 125 (plan 03)
    provides: "actionCodeSettings.url targeting /volunteer/verify, minted server-side and embedded in the existing v1.7 messaging emails"
provides:
  - "src/stores/volunteerAuth.ts — isEmailLink()/completeSignIn()/signOut() email-link completion flow, reusing auth.ts's single onAuthStateChanged listener and logout()"
  - "src/views/VolunteerLinkCompleteView.vue (/volunteer/verify) and src/views/VolunteerSignInView.vue (/volunteer) — the volunteer's sign-in completion + landing surface"
  - "isVolunteerRoute RouteMeta + widened org-selection gate — a zero-membership authenticated volunteer reaches /volunteer without bouncing to /select-church"
affects: [126-my-schedule, 127-rehearse-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-device email re-entry never trusts a URL query param — localStorage.emailForSignIn or an explicit re-entry argument only (T-125-14)"
    - "A second, structurally distinct identity class (authenticated, zero-membership) reuses the existing auth.ts session/identity plumbing rather than forking a parallel onAuthStateChanged listener"
    - "Router-level isVolunteerRoute exemption is explicit UI defense-in-depth only — the enforced boundary is firestore.rules (Plan 125-01), independent of this flag"

key-files:
  created:
    - src/stores/volunteerAuth.ts
    - src/stores/__tests__/volunteerAuth.test.ts
    - src/views/VolunteerLinkCompleteView.vue
    - src/views/VolunteerSignInView.vue
  modified:
    - src/router/index.ts
    - src/router/__tests__/router.test.ts

key-decisions:
  - "completeSignIn() never throws — it sets reactive needsEmailReentry/errorMessage state and resolves false, so both views can branch on store state without try/catch scaffolding"
  - "A failed completion (e.g. auth/operation-not-allowed) deliberately leaves the stored email in localStorage so the volunteer can retry the same link once the owner enables the provider, instead of forcing a fresh cross-device re-entry"
  - "VolunteerSignInView's unauthenticated cross-device affordance pre-stores the entered email into localStorage.emailForSignIn (same key volunteerAuth.ts reads) rather than attempting a functional sign-in with no link URL present — this lets a link opened next on the SAME device skip the verify page's re-entry prompt entirely"
  - "No /my-schedule route added this plan (deferred to Phase 126, per plan's explicit build-safety instruction) — the isVolunteerRoute gate exemption ships now so Phase 126 only needs to add a route+meta, not touch the guard again"

patterns-established:
  - "Cross-device email re-entry: localStorage first, explicit re-entry argument second, URL query param NEVER (mirrors Firebase's own documented pattern)"
  - "isVolunteerRoute RouteMeta flag for any future volunteer-surface route (Phase 126/127 routes should reuse it, not reinvent a parallel exemption)"

requirements-completed: [R374, R376]

coverage:
  - id: D1
    description: "volunteerAuth store completes signInWithEmailLink using the localStorage-stored email, clearing storage on success, with no password API ever imported/called"
    requirement: "R374"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/volunteerAuth.test.ts#completes sign-in using the stored email and clears localStorage"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/volunteerAuth.test.ts#this store module never imports a password-based Firebase auth function"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cross-device fallback: completeSignIn sets needsEmailReentry and does not call Firebase when no stored email is present; completes once a re-entered email is supplied; never reads the email from a URL query param"
    requirement: "R374"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/volunteerAuth.test.ts#does NOT call signInWithEmailLink and sets needsEmailReentry when no stored email/re-entry is given"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/volunteerAuth.test.ts#completes sign-in once an email is supplied via re-entry, and clears the reentry flag"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/volunteerAuth.test.ts#never reads the email from a URL query param — a malicious ?email= is ignored in favor of the stored value"
        status: pass
    human_judgment: false
  - id: D3
    description: "Invalid/expired link and auth/operation-not-allowed both surface a friendly error via errorMessage without throwing"
    requirement: "R374"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/volunteerAuth.test.ts#sets an error state and never calls signInWithEmailLink when the URL is not a valid sign-in link"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/volunteerAuth.test.ts#surfaces a friendly error on auth/operation-not-allowed without throwing"
        status: pass
    human_judgment: false
  - id: D4
    description: "VolunteerLinkCompleteView completes sign-in on mount and redirects to /volunteer on success; renders the email re-entry form when needsEmailReentry; shows the error state for invalid link / operation-not-allowed"
    requirement: "R374"
    verification:
      - kind: other
        ref: "npm run type-check"
        status: pass
    human_judgment: true
    rationale: "No component-mount test was added for this view (plan's task verify step was npm run type-check only); confirming the mount->completeSignIn->redirect wiring visually/behaviorally against a real or emulator-backed email-link click is deferred to the plan's own batched manual UAT step."
  - id: D5
    description: "VolunteerSignInView shows a user chip (name/initials + roster email) and explicit Sign out (delegating to auth.ts logout) when authenticated; shows email-link guidance plus a pre-store-email affordance when not; contains no password field or planner controls"
    requirement: "R376"
    verification:
      - kind: other
        ref: "npm run type-check"
        status: pass
    human_judgment: true
    rationale: "Same as D4 — no dedicated component test was added; the session-survives-refresh and sign-out-returns-to-guidance behaviors are visual/session-state facts best confirmed in the plan's deferred manual UAT (click a real emailed link, refresh, sign out)."
  - id: D6
    description: "isVolunteerRoute RouteMeta + widened org-selection gate: a requiresOrgSelection (zero-membership) volunteer reaches /volunteer without redirect; a non-volunteer requiresAuth route still redirects to /select-church; an unauthenticated visitor to /volunteer still redirects to /login; no /my-schedule route added"
    requirement: "R376"
    verification:
      - kind: unit
        ref: "src/router/__tests__/router.test.ts#a zero-membership (requiresOrgSelection) volunteer reaches /volunteer WITHOUT being redirected to /select-church"
        status: pass
      - kind: unit
        ref: "src/router/__tests__/router.test.ts#a plain requiresAuth non-volunteer route STILL redirects a requiresOrgSelection user to /select-church"
        status: pass
      - kind: unit
        ref: "src/router/__tests__/router.test.ts#an unauthenticated visitor to /volunteer still redirects to /login (isVolunteerRoute exempts org-selection only, not auth itself)"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-06
status: complete
---

# Phase 125 Plan 04: Volunteer Passwordless Sign-In Completion, Session & Router Exemption Summary

**A `volunteerAuth` Pinia store completes `signInWithEmailLink` (with a tested cross-device fallback and zero password APIs), two thin volunteer views expose a persistent session + explicit sign-out, and a widened router org-selection gate stops a zero-membership volunteer from bouncing to the empty `/select-church` picker.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-09-06T00:04:11-04:00 (first task commit)
- **Completed:** 2026-09-06T00:17:10-04:00
- **Tasks:** 3 completed
- **Files modified:** 6

## Accomplishments
- `src/stores/volunteerAuth.ts` exposes `isEmailLink(url)` and `completeSignIn(url, reenteredEmail?)`: reads `localStorage.emailForSignIn`, falls back to an explicit re-entry argument for the cross-device case, calls `signInWithEmailLink`, clears storage on success, and never reads the email from a URL query param (session-fixation mitigation, T-125-14). `signOut()` delegates to `auth.ts`'s `logout()` — no second `onAuthStateChanged` listener was added.
- `VolunteerLinkCompleteView.vue` (`/volunteer/verify`) runs the completion on mount, redirects to `/volunteer` on success, renders an email re-entry form on cross-device, and shows a friendly error for an invalid/expired link or `auth/operation-not-allowed` (mirroring `LoginView.vue`'s existing v2.5 handling).
- `VolunteerSignInView.vue` (`/volunteer`) shows a signed-in user chip ("Dana R." + roster email) with the exact CONTEXT.md caption and an explicit Sign out button when authenticated; shows email-link guidance plus a pre-store-email affordance for the cross-device case when not.
- `src/router/index.ts` gained `isVolunteerRoute?: boolean` on `RouteMeta`, the two new routes, and the widened org-selection gate (`!to.meta.requiresSuperAdmin && !to.meta.isVolunteerRoute && to.name !== 'select-church'`) — the single most important non-obvious wiring fix in this plan (RESEARCH.md Pitfall 1). No `/my-schedule` route was added, per the plan's explicit instruction (its component ships in Phase 126).
- `src/router/__tests__/router.test.ts` gained a `'volunteer route exemption (Pitfall 1)'` block proving all three cases: a requiresOrgSelection volunteer reaches `/volunteer`, a non-volunteer requiresAuth route still redirects to `/select-church`, and an unauthenticated visitor to `/volunteer` still redirects to `/login`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): add failing test for volunteerAuth** - `2d1b42f5` (test)
1. **Task 1 (GREEN): implement volunteerAuth store** - `33aee314` (feat)
2. **Task 2: Volunteer completion + landing views** - `5506e4ae` (feat)
3. **Task 3: Router isVolunteerRoute exemption + volunteer routes** - `94ce1c81` (feat)

**Plan metadata:** commit created below (docs: complete plan)

_Task 1 was `tdd="true"` per plan frontmatter: a RED commit (failing import, 0 tests ran) preceded the GREEN implementation commit._

## Files Created/Modified
- `src/stores/volunteerAuth.ts` - Pinia setup store: `isEmailLink`, `completeSignIn`, `signOut`, `needsEmailReentry`, `errorMessage`
- `src/stores/__tests__/volunteerAuth.test.ts` - 9 unit tests covering happy path, cross-device fallback, invalid link, operation-not-allowed, session-fixation guard, and sign-out delegation
- `src/views/VolunteerLinkCompleteView.vue` - `/volunteer/verify` completion route (mount-time `completeSignIn`, redirect, re-entry form, error state)
- `src/views/VolunteerSignInView.vue` - `/volunteer` landing (user chip + sign-out, or guidance + pre-store-email affordance)
- `src/router/index.ts` - `isVolunteerRoute` RouteMeta, `/volunteer/verify` + `/volunteer` routes, widened org-selection gate
- `src/router/__tests__/router.test.ts` - mocked `stores/auth`, added `/select-church` + `/volunteer` test routes, replicated the widened gate, added the exemption describe block

## Decisions Made
- `completeSignIn()` never throws; all failure/pending states are reactive store fields (`needsEmailReentry`, `errorMessage`) so both views branch on state rather than try/catch — matches the store's own test suite design.
- A failed completion deliberately does NOT clear the stored email, so a volunteer whose sign-in fails only because the owner hasn't yet enabled the Email-link provider can retry the identical link without re-entering their address.
- `VolunteerSignInView`'s cross-device "re-entry" affordance is a pre-store (writes `localStorage.emailForSignIn` ahead of the volunteer opening the link on this device) rather than an attempted sign-in with no link present — there is no functional way to complete `signInWithEmailLink` without the link's own URL, so the only useful action available at `/volunteer` itself is priming localStorage for whichever device the volunteer opens the link on next.
- No `/my-schedule` route was added in this plan (explicit plan instruction — its component is built in Phase 126; a lazy import to a non-existent file would break the build). The `isVolunteerRoute` gate exemption is already in place for Phase 126 to reuse without touching the guard again.

## Deviations from Plan

None - plan executed exactly as written. The only additions beyond the plan's literal action text were the `auth/operation-not-allowed` test case and the `VolunteerSignInView` pre-store-email affordance, both of which are explicitly called for by the plan's own `<action>`/`<read_first>` text (mirroring `LoginView.vue`'s handling; "a re-entry entry point for the cross-device case") rather than out-of-scope additions.

## Issues Encountered
None.

## User Setup Required

None new for this plan — the owner prerequisite (Firebase Console Email-link provider + Authorized domains) was already tracked in Plan 03's SUMMARY.md and applies identically here; this plan's automated verification (unit tests, type-check, full suite) is unaffected by it. A real end-to-end click-the-emailed-link/refresh/sign-out pass remains part of the plan's own deferred manual UAT step (see `<verification>` in 125-04-PLAN.md).

## Next Phase Readiness
- `volunteerAuth` store, both views, and the `isVolunteerRoute` router exemption are all in place for Phase 126 (My Schedule) to build on directly — it only needs to add its own route(s) with `{ requiresAuth: true, isVolunteerRoute: true }`, no guard changes required.
- The R377 scoped-read isolation mechanism (`rehearseAccess` projection + firestore.rules) is out of this plan's scope (owned by Plan 125-01/125-02) — this plan only ships the client-side identity/session/routing half of the phase.
- Full suite result at completion: `npx vitest run` → 196/197 files passed, 5254/5289 tests passed, 35 skipped; the single failing file is the pre-existing, documented `src/storage.rules.test.ts` baseline (Storage-emulator `firestore.exists()` limitation, unrelated to this plan). `npm run type-check` clean throughout.

---
*Phase: 125-passwordless-magic-link-access-scoped-read-isolation*
*Completed: 2026-09-06*

## Self-Check: PASSED
