---
phase: 104-notification-multi-church-foundations
verified: 2026-09-01T06:30:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 104: Notification & Multi-Church Foundations Verification Report

**Phase Goal:** Every warning/error/info message in the app can be dismissed and stops reappearing
once its underlying condition resolves, and a multi-org member can switch their active church from
the top-bar user menu without signing out.
**Verified:** 2026-09-01
**Status:** passed
**Re-verification:** No — initial verification (deferred to milestone end per autonomous run)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every warning/error/info message surfaced anywhere in the app has a working manual-dismiss control, through one shared notification system (R309). | ✓ VERIFIED | `src/stores/toasts.ts` generalized to 4 severities with `dismiss(id)`; `src/components/ToastHost.vue` renders a real `<button aria-label="Dismiss">` on every card in both shapes (compact + rich). `ToastHost.test.ts` (9 tests) and `toasts.test.ts` (16 tests) pass, including a dedicated dismiss-removes-immediately test. |
| 2 | The Run screen's "monitors not configured" warning disappears automatically once monitors are configured, with no manual dismiss required for it to clear (R310). | ✓ VERIFIED | `useRunControl.ts`'s `onScreensChange()` calls `notifications.setSticky('monitor-reassign', …)` on mismatch and `notifications.clearSticky('monitor-reassign')` on benign-refresh/reopen/exit/unmount (lines 499-528, 936-943, 1295-1298). `RunControlView.output.test.ts` (39 tests, incl. explicit set/clear/exit-clears-sticky assertions) passes. |
| 3 | A user belonging to multiple churches can open the top-bar user menu, see each church with their role in it, and switch active church without signing out — distinct from the super-admin "enter any church" path (R311). | ✓ VERIFIED | This app has no literal top bar; its one user-menu surface is the `AppSidebar.vue` footer (confirmed — `AppShell.vue`/`AppSidebar.vue` contain no header/top-bar component), matching CONTEXT.md's explicit clarification ("this app's user menu is the sidebar footer… not a top bar"). `hasSwitcher = memberships.length > 1 && !viewingAsSuperAdmin` gates the switcher off super-admin enter-any-church mode; each row shows the church name + Editor/Viewer badge (`m.role`); clicking calls `authStore.selectOrg(m.id)` only — never `enterOrgAsSuperAdmin()`. `AppSidebar.test.ts` (12 tests: no-switcher single-org, no-switcher super-admin-viewing, role badges, active-church non-interactive, deactivated disabled, selectOrg call) all pass. |
| 4 | After switching churches, every org-scoped store/view reflects only the newly selected church's data and the user's role there — no stale data from the previous church survives the switch (R312). | ✓ VERIFIED | `authStore.selectOrg()` calls `resetOrgScopedStores()` before `loadOrgContext()` (`auth.ts:689-700`). Code review found (CR-01) that `TeamView.vue`/`GettingStarted.vue` held their own non-reactive `onMounted`-only `onSnapshot` listeners outside the Pinia reset registry — a real in-place-switch leak — and it was fixed: both now `watch(() => authStore.orgId, …, { immediate: true })`, tearing down and re-subscribing on every org change (`TeamView.vue:521-542`, `GettingStarted.vue:121-144`). `orgScopedStores.ts` carries the `STAGELAYOUTS-RESET-OBLIGATION` marker, since resolved by Phase 107 (stage layout stored as an additive field on the SERVICE doc, no new store, R312 satisfied with zero further code change). `TeamView.test.ts`/`GettingStarted.test.ts` pass. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/toasts.ts` | 4-severity store, sticky/transient lifetimes, back-compat push() | ✓ VERIFIED | `push`, `dismiss`, `setSticky`, `clearSticky` all present and exported; 16 passing tests |
| `src/components/ToastHost.vue` | Global host, severities, mandatory dismiss, two card shapes | ✓ VERIFIED | Renders 4 severities via `SEVERITY` map, compact + rich shapes, dismiss button on every card; 9 passing tests |
| `src/App.vue` | ToastHost mounted at root (not AppShell) | ✓ VERIFIED | `<ToastHost />` sibling of `<RouterView>` in `App.vue`; removed from `AppShell.vue` |
| `src/stores/auth.ts` | `memberships[].role`, `selectOrg()` distinct from `enterOrgAsSuperAdmin()` | ✓ VERIFIED | `roleFor()` resolves per-org role from claim (auth.ts:550-565); `selectOrg` (689-700) and `enterOrgAsSuperAdmin` (702+) are separate functions |
| `src/components/AppSidebar.vue` | Church switcher UI | ✓ VERIFIED | Switcher trigger + ARIA menu panel + role badges + selectOrg wiring present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ToastHost.vue` | `App.vue` | mounted as sibling of `<RouterView>` | ✓ WIRED | Confirmed in App.vue source; also removed from AppShell.vue |
| `useRunControl.ts` | `notifications` store | `setSticky`/`clearSticky('monitor-reassign')` | ✓ WIRED | 6 call sites across set (mismatch) and clear (benign-refresh, reopen, teardown, unmount) paths |
| `AppSidebar.vue` | `authStore.selectOrg()` | church-switcher row click → `handleSwitch()` | ✓ WIRED | Never calls `enterOrgAsSuperAdmin()`; gated off when `viewingAsSuperAdmin` is set |
| `authStore.selectOrg()` | `resetOrgScopedStores()` | awaited before `loadOrgContext()` | ✓ WIRED | `auth.ts:697-699` |
| `TeamView.vue` / `GettingStarted.vue` | `authStore.orgId` | reactive `watch(..., {immediate:true})` (CR-01 fix) | ✓ WIRED | Confirmed post-review fix present in both files — closes the in-place-switch data leak the initial implementation missed |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Notification store dismiss/sticky/clearSticky semantics | `npx vitest run src/stores/__tests__/toasts.test.ts` | 16/16 passed | ✓ PASS |
| ToastHost renders severities + dismiss | `npx vitest run src/components/__tests__/ToastHost.test.ts` | 9/9 passed | ✓ PASS |
| RunControlView monitor-reassign sticky set/clear (R310 proof) | `npx vitest run src/views/__tests__/RunControlView.output.test.ts` | 39/39 passed | ✓ PASS |
| MonitorSetupView save-outcome sticky | `npx vitest run src/views/__tests__/MonitorSetupView.test.ts` | 10/10 passed | ✓ PASS |
| auth.ts memberships role threading | `npx vitest run src/stores/__tests__/auth.test.ts` | 113/113 passed | ✓ PASS |
| AppSidebar church switcher (R311/R312) | `npx vitest run src/components/__tests__/AppSidebar.test.ts` | 12/12 passed | ✓ PASS |
| AppShell (ToastHost removed, mock widened) | `npx vitest run src/components/__tests__/AppShell.test.ts` | 5/5 passed | ✓ PASS |
| TeamView (CR-01 reactive watch fix) | `npx vitest run src/views/__tests__/TeamView.test.ts` | 13/13 passed | ✓ PASS |
| GettingStarted (CR-01 reactive watch fix) | `npx vitest run src/components/__tests__/GettingStarted.test.ts` | 7/7 passed | ✓ PASS |
| RunControlView (setActivePinia now required) | `npx vitest run src/views/__tests__/RunControlView.test.ts` | 27/27 passed | ✓ PASS |
| `npm run type-check` (vue-tsc --build, includes test files) | `npm run type-check` | clean, no output | ✓ PASS |
| Full workspace suite (`npx vitest run`, run once) | `npx vitest run` | 181/183 files passed, 4954/4981 tests passed | ✓ PASS (baseline) |

**Full-suite baseline confirmed exactly as documented:** the only 2 failing files are
`src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation,
documented in CLAUDE.md as a real-but-environment-scoped defect unrelated to this phase) and
`src/stores/appConfig.test.ts` (a stale duplicate of the passing `src/stores/__tests__/appConfig.test.ts`,
last touched in Phase 70, confirmed unmodified across all Phase 104 commits and logged in
`deferred-items.md`). No new failures were introduced by Phase 104.

### Code Review Findings — Verified Fixed (not just claimed)

The phase's own code review (`104-REVIEW.md`) found 1 critical + 4 warning + 3 info issues after the
initial implementation. Each fix was independently confirmed present in the current source (not just
trusted from the review's "fixed" log):

| ID | Finding | Verified Fix Location |
|----|---------|------------------------|
| CR-01 | In-place church switch leaked stale org data via non-reactive `onSnapshot` listeners outside `resetOrgScopedStores()` | `TeamView.vue:521-542`, `GettingStarted.vue:121-144` — both now `watch(() => authStore.orgId, …, { immediate: true })` |
| WR-01 | Sticky link hard-coded `rel="noopener"`, breaking the multi-org session-storage-dependent `/monitor-setup` new-tab flow | `ToastHost.vue:45-59` — `rel="noopener"` removed, comment explains why |
| WR-02 | Church-switch failure toast never auto-dismissed (opts-shape gap) | `AppSidebar.vue:290` — `toasts.push('Could not switch churches. Please try again.')` with no opts object (uses default 6000ms timer) |
| WR-03 | "Focus first item" could no-op on the non-focusable active-church row | `AppSidebar.vue:253` — query scoped to `button[role="menuitem"]` |
| WR-04 | `monitorChanged` not reset alongside the new `clearSticky` calls (state desync) | `useRunControl.ts:481-486, 936-943, 1295-1298` — `monitorChanged.value = false` added at all 3 sites |
| IN-01 | Save-outcome sticky could survive leaving the `'granted'` phase | `MonitorSetupView.vue:402-409` — `saveOutcome.value = 'idle'` in `handleDetectionFailure()` |
| IN-02 | Test suite mocked `useToasts()` entirely, missing the WR-02 class of regression | `AppSidebar.test.ts` — real Pinia-backed store + fake timers now assert self-clear behavior |
| IN-03 | `reassignRole` left stale after clear | `useRunControl.ts:482-486` — reset alongside `monitorChanged` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R309 | 104-01 | Every warning/error/info message can be manually dismissed, one shared system | ✓ SATISFIED | `toasts.ts`/`ToastHost.vue` generalized; dismiss button on every card, both shapes, all 4 severities |
| R310 | 104-01 | Condition-tied messages auto-clear; monitor-setup warning specifically | ✓ SATISFIED | `useRunControl.ts` setSticky/clearSticky('monitor-reassign') wired to the actual mismatch/resolve condition, not just a UI toggle |
| R311 | 104-02 | Multi-org member switches active church from user menu, without signing out, distinct from super-admin enter-any-church | ✓ SATISFIED | `AppSidebar.vue` switcher (this app's sidebar-footer user menu), gated off `viewingAsSuperAdmin`, calls `selectOrg()` only |
| R312 | 104-02 | Switching fully resets org-scoped state, no stale data, reflects new role | ✓ SATISFIED | `selectOrg()` → `resetOrgScopedStores()`; CR-01 closed the non-Pinia-listener gap the initial pass missed |

No orphaned requirements: REQUIREMENTS.md's Phase 104 row maps exactly R309-R312, matching the plans' declared `requirements:` fields.

### Anti-Patterns Found

None blocking. Scanned all Phase 104-touched files (`toasts.ts`, `ToastHost.vue`, `App.vue`,
`AppShell.vue`, `useRunControl.ts`, `RunControlView.vue`, `MonitorSetupView.vue`, `auth.ts`,
`orgScopedStores.ts`, `AppSidebar.vue`, `TeamView.vue`, `GettingStarted.vue`) for TBD/FIXME/XXX/TODO/
HACK/PLACEHOLDER markers and stub patterns — none found. The one `STAGELAYOUTS-RESET-OBLIGATION`
marker is a deliberate, resolved (per Phase 107) cross-phase note, not a debt marker, and is
referenced with its resolution inline.

### Human Verification Required

None required as a phase-completion blocker. The plans' own `<verification>` sections deferred two
items to owner UAT, both purely visual/live-environment judgments that automated checks cannot
reach and which do not gate this phase's goal achievement:

1. **Visual collision check** — whether the sticky monitor-reassign card's fixed bottom-right
   position visually collides with RunControlView's bottom transport/filmstrip chrome at real
   viewport sizes. Automated tests prove the store contract (set/clear/action) end-to-end; a pixel
   collision is a rendering judgment outside grep/unit-test reach.
2. **Live multi-church zero-stale-data-flash observation** — confirming with a genuine multi-org
   Firebase account that switching churches shows no visual flash of the prior church's data and the
   correct role, in real time. Automated coverage (CR-01 fix + resetOrgScopedStores + TeamView/
   GettingStarted watch fixes) proves the code paths are wired correctly; observing zero-flash timing
   in a live browser session against real Firestore is not reproducible from component/store mocks.

Both are explicitly named DEFERRED-to-owner-UAT in the plans, not undiscovered gaps — the code paths
they'd exercise are all independently verified above.

### Gaps Summary

No gaps. All 4 roadmap success criteria (R309-R312) are independently verified against live source,
not just SUMMARY.md/REVIEW.md claims. `npm run type-check` is clean. The full test suite shows
exactly the two documented, pre-existing, phase-unrelated baseline failures. The phase's own code
review found and fixed a genuine critical defect (CR-01, an R312 data leak from non-Pinia listeners)
plus 7 other issues — all 8 fixes were independently re-confirmed present in the current source
during this verification, not merely trusted from the review's fix log.

---

_Verified: 2026-09-01_
_Verifier: Claude (gsd-verifier)_
