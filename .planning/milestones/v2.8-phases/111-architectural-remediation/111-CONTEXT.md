# Phase 111: Architectural Remediation - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Remediate the Critical/High architectural findings from the Phase 110 report
(`.planning/phases/110-architectural-review/110-ARCHITECTURE-REVIEW.md`), and triage the Medium/Low
findings to the backlog. From Phase 110: **0 Critical, 1 High (ARCH-001), 22 Medium/Low**.

In scope: fix ARCH-001 (build + test + commit), and record the 22 Medium/Low findings in the backlog.
Build/commit only — **no production deploy** (ARCH-001 is a client-only store/component change; no
rules/functions touched).

Out of scope: fixing Medium/Low findings (deferred to backlog), security findings (Phase 112/113).
</domain>

<decisions>
## Implementation Decisions

### Remediation Approach (accepted by owner 2026-09-02)
- **ARCH-001 fix depth — BOTH layers:**
  1. **Store-layer generation/epoch token in `src/stores/auth.ts`** — an incrementing epoch captured at
     the top of each `loadOrgContext` call and re-checked immediately before the `memberUnsub =
     onSnapshot(...)` assignment (auth.ts:506-532), so a superseded/interleaved call can never win the
     `memberUnsub` race and never orphans a listener — defense-in-depth that protects ALL callers
     (`selectOrg` / `enterOrgAsSuperAdmin` / `exitSuperAdminView` / `logout`), not just the guarded ones.
     If a superseded call's onSnapshot must not remain live, tear down its own handle in that path.
  2. **UI in-flight guard on `AppShell.vue`'s exit button** — mirror the sibling `switchingId`
     (`AppSidebar.vue:271-281`) / `enteringOrgId` (`OrganizationsTab.vue:773-796`) pattern: an in-flight
     ref that disables `onExitSuperAdminView` (AppShell.vue:46-48,74-79) while the exit is running.
- **Medium/Low triage — ONE consolidated backlog entry:** add a single 999.x backlog item
  ("v2.8 Architectural Review — Medium/Low findings (ARCH-002..023)") that points at the report's
  `## Medium/Low (→ backlog)` section (which already carries full per-finding detail). Nothing is
  dropped; we avoid 22 near-empty stubs.
- **Strictly defer all Medium/Low** — do NOT fix any Medium/Low in this milestone, including trivial
  ones (e.g. the never-rendering `reopenPcWarning` date clause — a Medium data-flow finding in the
  report). Per locked milestone scope.

### Locked at milestone start (REQUIREMENTS.md v2.8 scope)
- Fix Critical/High; triage Medium/Low to backlog (not fixed here).
- No production deploy — remediation ships built/tested/committed only (ARCH-001 is client-only, so no
  rules/functions deploy is even implicated; still, do not deploy).
- `npm run type-check` and the full test/regression suite must pass after remediation, no new regressions.

### Claude's Discretion
- Exact epoch variable name / guard shape in auth.ts, and the in-flight ref name in AppShell.vue.
- Whether to add a focused regression test for the epoch guard (encouraged — a unit test that a
  superseded loadOrgContext cannot overwrite memberUnsub / leaks no listener).
- The consolidated backlog entry's exact wording/number.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / Patterns
- Sibling re-entrancy guards to mirror: `switchingId` in `src/components/AppSidebar.vue:271-281`
  (guards `selectOrg`), `enteringOrgId` in `src/components/admin/OrganizationsTab.vue:773-796`
  (guards `enterOrgAsSuperAdmin`).
- `memberUnsub` (module-scope) + `loadOrgContext`/`resetOrgContext` lifecycle in `src/stores/auth.ts`
  (:31, :301-316, :506-532, :617-636 exitSuperAdminView).
- The church-switch re-subscribe fix (quick 260901-lua) and `resetOrgScopedStores()` are the adjacent
  lifecycle machinery — the epoch guard must not break that flow.

### Established Patterns
- Type-check gate: `npm run type-check` (vue-tsc --build). App suite: bare `npx vitest run` (baseline =
  only `src/storage.rules.test.ts` failing). render-service: `cd render-service && npm test`.

### Integration Points
- `src/stores/auth.ts` (the fix's core), `src/components/AppShell.vue` (the UI guard),
  and any existing `src/stores/__tests__/auth.test.ts` (for a regression test).

</code_context>

<specifics>
## Specific Ideas

- ARCH-001's own instance resolves to the same destination org (super-admin's own church), so it is a
  listener-leak bug rather than a proven cross-tenant bleed — but the epoch guard is the durable
  defense-in-depth fix that also protects future `loadOrgContext` callers. Prioritize the store-layer
  epoch guard; the UI guard is the matching-pattern belt-and-braces.
- Verify the fix does not regress the church-switch re-subscribe path (the epoch must reset/behave
  correctly across selectOrg / enterOrgAsSuperAdmin / exit / logout).

</specifics>

<deferred>
## Deferred Ideas

- All 22 Medium/Low architectural findings (ARCH-002..023) → the consolidated 999.x backlog entry.
- Security findings and the Phase 112 handoff items (ARCH-005 undeployed provisioning functions,
  ARCH-018 super-admin isOrgEditor residual) → Phase 112/113.

</deferred>
