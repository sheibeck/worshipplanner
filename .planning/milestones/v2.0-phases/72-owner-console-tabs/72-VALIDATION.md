---
phase: 72
slug: owner-console-tabs
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 72 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.x (jsdom, @vue/test-utils) |
| **Config file** | vite.config.ts (test block) |
| **Quick run command** | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60s full suite; ~3s the single file |

---

## Sampling Rate

- **After every task commit:** Run the quick command (the OwnerConsoleView test file + any new tab test files)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite green at the documented 2-file baseline
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Seeded from RESEARCH §Validation Architecture; the planner refines Task IDs to match its wave/plan split.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 72-01-01 | 01 | 1 | R193 | — | Console renders two tabs; Configuration selected by default when no `?tab` query is present | unit (mount) | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` | ❌ W0 | ⬜ pending |
| 72-01-02 | 01 | 1 | R194 | — | Configuration pane renders the super-admins roster + all four config cards + deploy note; the two subscriptions (`superAdmins` onSnapshot, `appConfigStore.subscribe`) stay active on load regardless of active tab; all pre-existing OwnerConsoleView tests still green | unit (mount) | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` | ❌ W0 | ⬜ pending |
| 72-01-03 | 01 | 1 | R195 | — | `?tab=organizations` on initial load / refresh lands on the Organizations pane; clicking a tab updates the query via `router.replace` (no history push); invalid/absent tab normalizes to `configuration` | unit (mount + vue-router mock) | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New/updated tests in `src/views/__tests__/OwnerConsoleView.test.ts` (and any extracted-tab test files the planner adds) for R193/R194/R195 — reuse the existing firebase/auth mock harness and add the `vue-router` mock shape from `RosterViewEditQuery.test.ts` / `QuarterShareView.test.ts` (mutable `mockRouteQuery` + spy-able `router.replace`).
- [ ] Reuse the existing `isVShowHidden()` helper (per RESEARCH pitfall) to assert which pane is active — do NOT rely on VTU `isVisible()` against `v-show` in this jsdom setup.

*Existing vitest infrastructure otherwise covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real browser deep-link + refresh on `/owner-console?tab=organizations` lands on Organizations; visual tab-strip styling matches the app | R195 / UI-SPEC | jsdom cannot fully prove real vue-router query hydration + visual active-state rendering | Deferred to `/gsd-verify-work 72` (human UAT) per the v2.0 autonomy grant — record in PENDING-VERIFICATION.md, never as passed |

*Automated component tests cover the tab-selection logic; only the real-browser visual/deep-link confirmation is manual.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
