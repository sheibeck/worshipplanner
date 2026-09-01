---
phase: 104-notification-multi-church-foundations
plan: 02
subsystem: auth
tags: [vue, pinia, firebase-auth, aria-menu, multi-tenant]

# Dependency graph
requires:
  - phase: 104-notification-multi-church-foundations
    provides: "104-01's generalized notification store (useToasts().push(msg, { variant })) and App.vue-root ToastHost, used here for the switcher's failure path"
provides:
  - "authStore.memberships entries carry a per-org role ('editor' | 'viewer'), resolved from the orgs custom claim"
  - "A sidebar-footer 'Switch church' menu (AppSidebar.vue) for multi-org members, switching via authStore.selectOrg() only"
  - "STAGELAYOUTS-RESET-OBLIGATION forward-obligation marker in orgScopedStores.ts for Phase 107's stageLayouts store"
affects: [107-stage-plans, auth, multi-tenant-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ARIA menu pattern (role=menu/menuitem, click-outside overlay, Escape-to-close+refocus, open-focuses-first-item) now has a second consumer beyond SlideActionMenu.vue, confirming it as the app's reusable dropdown idiom"

key-files:
  created: []
  modified:
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts
    - src/stores/orgScopedStores.ts
    - src/components/AppSidebar.vue
    - src/components/__tests__/AppSidebar.test.ts
    - src/components/__tests__/AppShell.test.ts

key-decisions:
  - "Role resolution defaults to 'viewer' whenever the claim lacks an explicit 'editor' string for an org, including the not-yet-caught-up case (org present in orgIds but absent from the claim) — never crashes or drops the membership entry."
  - "Switch guarded by a local switchingId ref that blocks starting a second concurrent selectOrg() call, while still following the UI-SPEC's literal 'disable that row only' visual contract."
  - "AppShell.test.ts's @/stores/auth mock (which mounts AppSidebar.vue for real as a child) needed memberships/orgId/superAdminOutsideOwnChurch added to match the real store's now-wider shape — a Rule 1 fix, not scope creep."

patterns-established:
  - "Second ARIA-menu consumer (AppSidebar's church switcher) validates SlideActionMenu.vue's pattern as the app's general-purpose dropdown, not a one-off."

requirements-completed: [R311, R312]

coverage:
  - id: D1
    description: "authStore.memberships entries carry role: 'editor' | 'viewer' resolved from the orgs claim, defaulting to 'viewer' for a viewer claim, an absent-from-claim org, or an org whose claim doesn't say 'editor'"
    requirement: "R311"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#memberships[].role (Phase 104, R311)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sidebar 'Switch church' menu renders for a multi-org member (memberships.length > 1), hidden for single-org users and for a super-admin currently viewing another church via enterOrgAsSuperAdmin"
    requirement: "R311"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — church switcher (R311/R312, Phase 104) > renders no switcher for a single-org member"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — church switcher (R311/R312, Phase 104) > renders no switcher for a multi-org member currently viewing another church as super-admin"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — church switcher (R311/R312, Phase 104) > renders the switcher trigger for a genuine multi-org member"
        status: pass
    human_judgment: false
  - id: D3
    description: "Panel lists one row per membership with the correct role badge; the active church renders non-interactively (aria-current, not a button); a deactivated church is disabled with a (deactivated) suffix"
    requirement: "R311"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — church switcher (R311/R312, Phase 104) > opens the panel and renders one row per membership with the correct role badge"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — church switcher (R311/R312, Phase 104) > renders the active church as a non-interactive row, not a click target"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — church switcher (R311/R312, Phase 104) > disables a deactivated church row and suffixes its name with (deactivated)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Clicking another church calls authStore.selectOrg(id) — never a parallel org-context path, never enterOrgAsSuperAdmin — and closes the panel on success; selectOrg() itself routes through resetOrgScopedStores() so no prior-church data survives (R312)"
    requirement: "R312"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — church switcher (R311/R312, Phase 104) > clicking another church calls selectOrg with that church id"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — church switcher (R311/R312, Phase 104) > closes the panel after a successful switch"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#logout > resets org-scoped stores before signOut (existing coverage of the shared resetOrgScopedStores() call selectOrg also uses)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A rejected selectOrg() re-enables the row, keeps the menu open, and surfaces the failure via the Phase 104 notification store (useToasts().push(msg, { variant: 'error' }))"
    requirement: "R312"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — church switcher (R311/R312, Phase 104) > surfaces a failed switch through the notification store with variant error and keeps the panel open"
        status: pass
    human_judgment: false
  - id: D6
    description: "STAGELAYOUTS-RESET-OBLIGATION forward-obligation marker present in orgScopedStores.ts's resetOrgScopedStores() for Phase 107"
    requirement: "R312"
    verification:
      - kind: other
        ref: "grep -q 'STAGELAYOUTS-RESET-OBLIGATION' src/stores/orgScopedStores.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Live end-to-end verification with a genuine multi-church account: switching reflects the new church's data with no stale prior-church flash, and the correct role, all without signing out"
    human_judgment: true
    rationale: "Requires a real multi-org Firebase account and live Firestore data across two orgs to observe the onSnapshot re-subscription timing and confirm zero stale-data flash — not reproducible from unit-level component/store mocks. Deferred to phase-level owner UAT per the plan's own verification section."

# Metrics
duration: 55min
completed: 2026-09-01
status: complete
---

# Phase 104 Plan 02: User-Menu Church Switcher Summary

**Sidebar "Switch church" ARIA menu (ported from SlideActionMenu.vue's pattern) letting a multi-org member switch active church via the existing `authStore.selectOrg()` + `resetOrgScopedStores()` primitive, with per-org role badges threaded onto `authStore.memberships` from the auth claim.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-01T01:05:00Z
- **Completed:** 2026-09-01T02:00:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `authStore.memberships` entries now carry `role: 'editor' | 'viewer'`, resolved per-entry from the `orgs` custom claim, defaulting safely to `'viewer'` (including the not-yet-caught-up claim case) — never crashes or drops a membership.
- `orgScopedStores.ts`'s `resetOrgScopedStores()` carries a `STAGELAYOUTS-RESET-OBLIGATION` marker comment recording the Phase 107 cross-phase obligation (R312 durability).
- `AppSidebar.vue`'s user block gained a multi-org "Switch church" menu — church name, Editor/Viewer role badge, active-church non-interactive row, deactivated-church disabling, per-row in-flight spinner, and a failure path that dogfoods the Phase 104 notification store instead of a bespoke inline error box.
- Switcher is strictly gated off for single-org users and for a super-admin currently viewing another church via `enterOrgAsSuperAdmin()` — the two switch mechanisms never render together (T-104-06).

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread per-org role onto memberships + add the Phase 107 R312 forward-obligation marker** - `b3ee1840` (feat)
2. **Task 2: Build the sidebar church switcher (R311) reusing selectOrg + the ARIA-menu pattern, dogfooding the notification store (R312)** - `29b65e22` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/stores/auth.ts` - `memberships` ref widened to `{ id, name, active, role }[]`; role resolved per-entry from `claimOrgs` in `loadOrgContext`
- `src/stores/__tests__/auth.test.ts` - new `memberships[].role` describe block (editor claim, viewer claim, absent-from-claim fallback); updated existing `memberships` fixture assertions for the new field
- `src/stores/orgScopedStores.ts` - `STAGELAYOUTS-RESET-OBLIGATION` forward-obligation comment in `resetOrgScopedStores()`
- `src/components/AppSidebar.vue` - church switcher trigger/panel/rows, `hasSwitcher` gate, `handleSwitch()` calling `authStore.selectOrg()` and `useToasts().push()` on failure
- `src/components/__tests__/AppSidebar.test.ts` - `memberships`/`viewingAsSuperAdmin`/`selectOrg` added to the auth mock, `@/stores/toasts` mock added, new church-switcher describe block (12 tests total in the file)
- `src/components/__tests__/AppShell.test.ts` - auth mock widened with `memberships`/`orgId`/`superAdminOutsideOwnChurch` (Rule 1 fix — AppSidebar.vue mounts for real inside AppShell's test and now reads these fields)

## Decisions Made
- Role defaults to `'viewer'` for any org the claim doesn't explicitly mark `'editor'`, matching the plan's stated posture and reusing the existing "never blank the list" pattern already established for `name`/`active`.
- Added a `switchingId !== null` guard at the top of `handleSwitch()` to prevent two concurrent `selectOrg()` calls from a rapid double-click across rows, while keeping the per-row `:disabled` binding scoped exactly to the clicked row per the UI-SPEC's literal contract (other rows visually stay enabled).
- Fixed `AppShell.test.ts`'s auth mock rather than loosening `AppSidebar.vue`'s `hasSwitcher` computed with an optional-chain fallback — the real store always initializes `memberships` to `[]`, so the correct fix is bringing the test double in line with that invariant, not defending production code against an impossible shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AppShell.test.ts's incomplete `@/stores/auth` mock**
- **Found during:** Task 2 (full-suite verification run)
- **Issue:** `AppShell.test.ts` mounts `AppSidebar.vue` for real as AppShell's child, and its `@/stores/auth` mock predates this plan — it had no `memberships`/`orgId` fields. The new `hasSwitcher` computed (`authStore.memberships.length > 1`) threw `TypeError: Cannot read properties of undefined (reading 'length')` on every AppShell test, since `memberships` was `undefined` in that mock.
- **Fix:** Added `memberships: []`, `orgId: null`, and `superAdminOutsideOwnChurch: false` to the mock, matching the real store's shape closely enough to render without crashing (mirrors the file's existing stated intent to "expose the handful of fields AppSidebar.vue reads").
- **Files modified:** `src/components/__tests__/AppShell.test.ts`
- **Verification:** All 5 previously-failing `AppShell.test.ts` tests pass; full suite re-run shows zero regressions beyond the pre-existing baseline.
- **Committed in:** `29b65e22` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary correctness fix surfaced by widening the auth store contract; no scope creep — confined to bringing a test double in line with the real store shape this plan changed.

## Issues Encountered
None beyond the AppShell.test.ts fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The `STAGELAYOUTS-RESET-OBLIGATION` marker in `orgScopedStores.ts` is in place and greppable for Phase 107 to find when it adds the `stageLayouts` store.
- Live multi-church UAT (D7 above) — confirming zero stale-data flash and correct role display with a genuine multi-org Firebase account — is deferred to phase-level owner verification per the plan's own `<verification>` section, not a blocker for this plan's completion.
- Both switcher and notification primitives (104-01 + 104-02) are now in place; Phase 104 as a whole is ready for phase-level UAT/closure.

---
*Phase: 104-notification-multi-church-foundations*
*Completed: 2026-09-01*

## Self-Check: PASSED
