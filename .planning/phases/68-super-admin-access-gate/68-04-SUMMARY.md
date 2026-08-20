---
phase: 68-super-admin-access-gate
plan: 04
subsystem: auth
tags: [vue-router, pinia, firebase-auth, firebase-functions, httpsCallable, custom-claims]

requires:
  - phase: 68-super-admin-access-gate (plan 01/02/03, other waves)
    provides: "superAdmin custom claim + syncSuperAdminClaim trigger + setSuperAdminClaim onCall + isSuperAdmin() Firestore rules (referenced by name only; no compile dependency)"
provides:
  - "authStore.isSuperAdmin — read from the existing getIdTokenResult claims, no extra round-trip"
  - "authStore.refreshSuperAdminClaim() — forces one fresh claim read, used by the route guard"
  - "requiresSuperAdmin route guard + /owner-console route"
  - "isSuperAdmin-gated 'Owner Console' nav entry in AppSidebar.vue"
  - "OwnerConsoleView.vue — console shell + super-admin roster (list/grant/revoke) via setSuperAdminClaim callable"
affects: [phase-70-config-editor-panels]

tech-stack:
  added: []
  patterns:
    - "httpsCallable(functions, 'name') using the shared @/firebase functions export — matches MessageComposer.vue/ReLockNotifyPrompt.vue/PptxImportModal.vue's existing convention (not a fresh getFunctions() call)"
    - "Client route guard as convenience-only gate; real enforcement deferred to Firestore rules + onCall server-side caller re-check"

key-files:
  created:
    - src/views/OwnerConsoleView.vue
  modified:
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts
    - src/router/index.ts
    - src/components/AppSidebar.vue

key-decisions:
  - "Used the existing shared `functions` export from src/firebase/index.ts (httpsCallable(functions, 'setSuperAdminClaim')) instead of PATTERNS.md's getFunctions() suggestion — matches the codebase's actual established convention (MessageComposer.vue, ReLockNotifyPrompt.vue, PptxImportModal.vue all do this)."
  - "Revoke/grant both key off targetEmail (not targetUid) since the superAdmins/{uid} doc already carries email for display, keeping the callable's request shape symmetric for both operations."
  - "Own row shows a 'You' label instead of a Revoke button (mirrors TeamView.vue's self-row guard), preventing accidental self-lockout from the console."
  - "isSuperAdmin resets to false on both logout() and the onAuthStateChanged sign-out branch, matching how orgId/userRole/etc. are already reset — prevents state leaking across signed-out/signed-in sessions."

requirements-completed: [R177, R179]

coverage:
  - id: D1
    description: "authStore.isSuperAdmin is surfaced from the existing getIdTokenResult claims read (no extra Firestore round-trip); refreshSuperAdminClaim() forces a fresh read for the route guard."
    requirement: "R177"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#isSuperAdmin (R177)"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#refreshSuperAdminClaim (R177, Pitfall 4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "requiresSuperAdmin route guard + /owner-console route + gated 'Owner Console' nav entry: a super-admin reaches the console and sees the nav entry; a non-super-admin is redirected client-side and does not see the nav entry."
    requirement: "R177"
    verification: []
    human_judgment: true
    rationale: "No router-guard unit-test precedent exists in this repo (router.test.ts's local test router does not even cover the existing requiresEditor guard) — matches the plan's own verification section, which explicitly defers this to manual UAT via /gsd-verify-work 68."
  - id: D3
    description: "OwnerConsoleView hosts a live super-admin roster (onSnapshot list, grant-by-email, revoke-with-confirm) that performs privileged writes only through the setSuperAdminClaim callable — no direct client write to superAdmins/*."
    requirement: "R179"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build) — clean"
        status: pass
    human_judgment: true
    rationale: "The callable (setSuperAdminClaim, from Plan 02) does not exist in the deployed/emulated backend yet — grant/revoke against a real user and observing the roster update + error surfacing requires manual UAT once Plans 02/03 are also in place, per the plan's explicit deferral."

duration: 9min
completed: 2026-08-20
status: complete
---

# Phase 68 Plan 04: Owner Console Client Gate + Roster Shell Summary

**Client-side super-admin gate (Pinia store flag + router guard + gated nav) and a minimal Owner Console shell with a live super-admin roster (grant/revoke) driven entirely through the `setSuperAdminClaim` Cloud Function callable.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-20T15:29:19Z
- **Completed:** 2026-08-20T15:38:01Z
- **Tasks:** 2 / 2
- **Files modified:** 4 modified, 1 created

## Accomplishments
- `authStore.isSuperAdmin` surfaced from the same `getIdTokenResult(user, true)` read `refreshOrgClaim` already performs (zero extra round-trip); new `refreshSuperAdminClaim()` action forces one fresh claim read for the router guard.
- `/owner-console` route + `requiresSuperAdmin` guard added, mirroring the existing `requiresEditor` guard, redirecting non-super-admins to `services`; the guard forces a claim refresh before deciding (closes the just-granted-refresh gap, Pitfall 4).
- `AppSidebar.vue` gets an `isSuperAdmin`-gated "Owner Console" nav entry, visually separated (separator + its own group) from the per-org Admins/Settings group.
- `OwnerConsoleView.vue` built: minimal shell (page header + card sections, matching `SettingsView.vue`) hosting a super-admin roster (`TeamView.vue`'s onSnapshot-list + email-invite + remove-with-confirm patterns) that grants/revokes exclusively through `httpsCallable(functions, 'setSuperAdminClaim')` — never a direct client write to `superAdmins/*`. A clearly-labeled placeholder section is left for Phase 70's config-editor panels.

## Task Commits

Each task was committed atomically:

1. **Task 1: Surface isSuperAdmin in auth store + add requiresSuperAdmin route/guard + gated nav entry** - `9737aeb5` (feat)
2. **Task 2: Build OwnerConsoleView.vue shell + super-admin roster (list / grant / revoke)** - `386f930e` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/stores/auth.ts` - `isSuperAdmin` ref + `refreshSuperAdminClaim()` action, read from existing token-claims read; reset on logout/sign-out
- `src/stores/__tests__/auth.test.ts` - coverage for `isSuperAdmin` propagation and `refreshSuperAdminClaim` (success, no-user, throw-and-swallow)
- `src/router/index.ts` - `requiresSuperAdmin` route meta, `/owner-console` route, `beforeEach` guard branch
- `src/components/AppSidebar.vue` - `isSuperAdmin`-gated "Owner Console" nav entry
- `src/views/OwnerConsoleView.vue` - **(new)** console shell + super-admin roster panel

## Decisions Made
- Reused the repo's existing shared `functions` export (`import { functions } from '@/firebase'`) for the `httpsCallable` call, rather than the pattern doc's `getFunctions()` suggestion — matches every other `httpsCallable` call site in this codebase (`MessageComposer.vue`, `ReLockNotifyPrompt.vue`, `PptxImportModal.vue`).
- Grant and revoke both key off `targetEmail` (the roster doc already stores email), keeping the callable's request shape symmetric.
- Mirrored `TeamView.vue`'s self-row guard ("You" label, no action buttons on your own row) to prevent a super-admin from accidentally revoking themselves.

## Deviations from Plan

None - plan executed exactly as written. (The `functions`-export choice above is a same-behavior implementation detail, not a deviation from any locked decision — CONTEXT.md's "Claude's Discretion" section explicitly leaves the roster markup/module choices open.)

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan ships client code only; nothing is deployed (per the v1.9 hand-over discipline, Firestore rules / Cloud Functions from Plans 02/03 remain owner-deployed).

## Manual UAT Deferred (per plan's `<verification>` section and the v1.9 autonomy grant)

Not run in this session — recorded here, not marked passed:

- **R177:** Signed in as a super-admin, confirm the "Owner Console" nav entry appears and `/owner-console` loads; signed in as an ordinary user, confirm the nav entry is absent and a direct visit to `/owner-console` redirects to the safe default (`services`).
- **R179 UI:** From the console, grant a test user by email and then revoke them; confirm the roster updates live and that the callable's `permission-denied`/`not-found` errors surface as readable messages.

Both require the `setSuperAdminClaim` callable and `isSuperAdmin()` rules from Plans 02/03 to be present (locally via emulator or deployed) to exercise end-to-end — this plan wires the real callable name/shape but has no compile or runtime dependency on those plans (per its frontmatter `depends_on: []`).

## Next Phase Readiness
- The `/owner-console` shell has a clearly-labeled placeholder section ready for Phase 70's config-editor panels — no config-editing logic was added here, keeping that phase's scope clean.
- `authStore.isSuperAdmin` / `refreshSuperAdminClaim()` are now available for any other super-admin-gated surface Phase 69-71 might need.
- Manual UAT items above should be run together with Plans 02/03's UAT once all three waves of Phase 68 land, since they share the same end-to-end flow.

---
*Phase: 68-super-admin-access-gate*
*Completed: 2026-08-20*

## Self-Check: PASSED

All modified/created files and both task commit hashes verified present on disk / in git log.
