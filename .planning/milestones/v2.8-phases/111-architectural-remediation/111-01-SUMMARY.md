---
phase: 111-architectural-remediation
plan: 01
subsystem: auth
tags: [pinia, firestore, onsnapshot, race-condition, vue, epoch-guard]

# Dependency graph
requires:
  - phase: 110-architectural-review
    provides: "ARCH-001 finding — the memberUnsub onSnapshot race in auth.ts's loadOrgContext (the sole High finding, 0 Critical)"
provides:
  - "Store-layer epoch/generation guard in auth.ts's loadOrgContext preventing a superseded call from winning the memberUnsub onSnapshot race or orphaning a listener"
  - "UI in-flight guard on AppShell.vue's exit-to-owner-console button (mirrors switchingId/enteringOrgId)"
  - "Regression test proving an interleaved loadOrgContext call leaves exactly one live members listener"
affects: [112-security-review, 113-security-remediation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scope generation/epoch counter (loadOrgContextEpoch) captured at the top of an async function and re-checked immediately before its last shared-mutable-state write, with no await in between — a lightweight defense-in-depth pattern usable anywhere a shared singleton listener/resource is assigned from an async function that can be called concurrently."

key-files:
  created: []
  modified:
    - src/stores/auth.ts
    - src/components/AppShell.vue
    - src/stores/__tests__/auth.test.ts

key-decisions:
  - "Scoped the epoch guard strictly to the memberUnsub onSnapshot assignment (per locked 111-CONTEXT.md) — a superseded call's earlier writes (orgId, orgName, settings, etc. via applyOrgSnapshot) are NOT epoch-guarded. This is intentional: ARCH-001's own instance is a listener-leak bug, not a proven cross-tenant data bleed, and widening the guard's scope was explicitly out of scope for this plan."
  - "Used `let loadOrgContextEpoch = 0` (module scope, next to memberUnsub) and `const myEpoch = ++loadOrgContextEpoch` captured immediately after the R213 deactivatedOrgMessage reset — Claude's discretion per 111-CONTEXT.md."
  - "Named the AppShell.vue in-flight ref `exiting` (Claude's discretion) — early-return guard, set-before/clear-in-finally around the awaited authStore.exitSuperAdminView() call, `:disabled` bound with visible disabled affordance classes."
  - "Regression test drives the race through the store's real onAuthStateChanged callback (two overlapping triggerAuthStateChange(mockUser) calls, neither awaited before the second fires) rather than exporting loadOrgContext — matches the plan's explicit instruction and the sibling church-switch re-subscribe test drives selectOrg twice, fully awaited, with no overlap."

requirements-completed: [R321]

coverage:
  - id: D1
    description: "Store-layer epoch guard in auth.ts's loadOrgContext prevents a superseded/interleaved call from winning the memberUnsub onSnapshot race or orphaning a members listener"
    requirement: "R321"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#loadOrgContext memberUnsub epoch guard (ARCH-001, Phase 111) > an interleaved second loadOrgContext call leaves exactly one live members listener — no orphan"
        status: pass
    human_judgment: false
  - id: D2
    description: "Church-switch re-subscribe path (quick 260901-lua) is unregressed — a normal, non-overlapping org switch still unsubscribes the prior members listener and opens a fresh one"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#loadOrgContext memberUnsub epoch guard (ARCH-001, Phase 111) > a normal, non-overlapping church switch still opens a fresh members listener (re-subscribe path unregressed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AppShell.vue's exit-to-owner-console button is disabled while an exit is in flight, and onExitSuperAdminView is re-entrancy-guarded"
    requirement: "R321"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build, includes test files) — exit 0; grep ':disabled=\"exiting\"' src/components/AppShell.vue — match"
        status: pass
    human_judgment: true
    rationale: "No dedicated component test exercises the double-click UX; automated verification covers type-correctness and the presence of the binding, but the visible disabled affordance and actual double-click behavior in the running app were not click-tested. Low risk given the store-layer guard (D1) is the durable defense-in-depth and already covers the underlying race independent of this UI layer."

# Metrics
duration: 45min
completed: 2026-09-02
status: complete
---

# Phase 111 Plan 01: ARCH-001 Remediation Summary

**Closed the sole High architectural finding (ARCH-001) with a store-layer epoch guard in auth.ts's `loadOrgContext` plus a matching UI in-flight guard on AppShell.vue's exit button, both proven by a regression test and a full no-regression gate (type-check + app-suite baseline + render-service 39/39).**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-02T13:11:11Z
- **Tasks:** 3 (2 code tasks + 1 verification-only task)
- **Files modified:** 3

## Accomplishments
- `src/stores/auth.ts`: module-scope `loadOrgContextEpoch` generation counter, captured into `myEpoch` at the top of every `loadOrgContext` call, re-checked immediately before the `memberUnsub` `onSnapshot` assignment. A superseded call now returns before creating any listener at all — nothing to leak, nothing to orphan. Protects every caller of `loadOrgContext` uniformly (`selectOrg`, `enterOrgAsSuperAdmin`'s sibling `exitSuperAdminView`, `logout`'s re-entry, and the initial `onAuthStateChanged` load).
- `src/components/AppShell.vue`: `exiting` in-flight ref guarding `onExitSuperAdminView` (early-return + set-before/clear-in-finally), bound to the exit button's `:disabled`, mirroring `switchingId` (AppSidebar.vue) / `enteringOrgId` (OrganizationsTab.vue).
- `src/stores/__tests__/auth.test.ts`: extended the `onSnapshot` firebase/firestore mock to return a distinct, trackable `vi.fn()` unsubscribe spy per call (tracked in `mockOnSnapshotUnsubs`), and added two regression tests — one proving the race is closed (fails without the guard, verified empirically by temporarily disabling the guard and re-running), one proving the church-switch re-subscribe path is unregressed.
- Full no-regression gate run and recorded below: `npm run type-check` exits 0; bare `npx vitest run` at the documented baseline (183/184 files passed, only `src/storage.rules.test.ts` failing — a documented Storage-emulator environment limitation, not a regression); `render-service` 39/39.

## Task Commits

Each task was committed atomically:

1. **Task 1: Store-layer epoch guard in auth.ts loadOrgContext + regression test** - `b0c62bb7` (feat)
2. **Task 2: UI in-flight guard on AppShell.vue's exit button** - `7f0ebeec` (feat)
3. **Task 3: No-regression gate — type-check + full app suite (baseline) + render-service** - no commit (verification-only task, no source changes)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/stores/auth.ts` - Added `loadOrgContextEpoch` module-scope counter + `myEpoch` capture at the top of `loadOrgContext` + a re-check gate immediately before the `memberUnsub` `onSnapshot` assignment
- `src/components/AppShell.vue` - Added `exiting` ref + re-entrancy guard around `onExitSuperAdminView` + `:disabled="exiting"` on the exit button with a disabled affordance
- `src/stores/__tests__/auth.test.ts` - Extended the `onSnapshot` mock to return trackable unsubscribe spies; added the "loadOrgContext memberUnsub epoch guard (ARCH-001, Phase 111)" describe block with two tests

## Decisions Made
- Scoped the fix strictly to the `memberUnsub`/`onSnapshot` assignment race, per the locked 111-CONTEXT.md decision — other `loadOrgContext` state (orgId, orgName, settings, etc.) is NOT epoch-guarded; a superseded call can still write stale org data before it reaches the guarded line. This matches the finding's actual severity (listener leak, not a proven cross-tenant data bleed) and the plan's explicit scope boundary.
- Verified the regression test is meaningful (not a false-positive) by temporarily disabling the epoch check (`if (false && myEpoch !== loadOrgContextEpoch)`) and re-running the suite: the new test failed as expected (`onSnapshot` called 2 times instead of 1), then restored the guard and re-verified all 115 tests in the file pass.

## Deviations from Plan

None - plan executed exactly as written. Both layers (store-layer epoch guard, UI in-flight guard) implemented per 111-CONTEXT.md's locked decisions; regression test added per the plan's `<action>` block; no architectural changes, no new dependencies, no production deploy.

## Issues Encountered

None. The main design effort went into constructing a regression test that reliably exercises the race without relying on fragile microtask-timing assumptions — resolved by recognizing the epoch guard's correctness does not depend on resolution *order* (only on the newer call's epoch capture happening before the older call reaches its own check, which is true by construction given both calls are fired without awaiting the first).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ARCH-001 is fully remediated (both layers) and covered by a regression test that fails without the fix.
- No production deploy was performed (client-only change, per plan) — this is built/tested/committed only, awaiting the next phase (112 — Security Review) or a deploy decision outside this plan's scope.
- The consolidated Medium/Low backlog entry (ARCH-002..023) is a separate deliverable of Phase 111 (not this plan) per 111-CONTEXT.md's triage decision.

---
*Phase: 111-architectural-remediation*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: src/stores/auth.ts
- FOUND: src/components/AppShell.vue
- FOUND: src/stores/__tests__/auth.test.ts
- FOUND: .planning/phases/111-architectural-remediation/111-01-SUMMARY.md
- FOUND: commit b0c62bb7 (Task 1)
- FOUND: commit 7f0ebeec (Task 2)
