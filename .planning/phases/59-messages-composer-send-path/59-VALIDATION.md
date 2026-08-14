---
phase: 59
slug: messages-composer-send-path
# status lifecycle: draft (seeded here) → validated (set by plan-phase after planner fills the map)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Full per-requirement test design
> lives in `59-RESEARCH.md` § Validation Architecture — this file is the execution-time sampling contract
> the planner's tasks map onto. This phase spans TWO test suites (app/jsdom + functions/node), so the
> sampling rate below is per-suite.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Client framework** | vitest (app suite, jsdom) — `vite.config.ts` |
| **Functions framework** | vitest (functions suite, **node** env) — `functions/vitest.config.ts` (`include: src/**/*.test.ts`) |
| **Client quick run** | `npx vitest run <file>` (scoped to the touched client test) |
| **Functions quick run** | `cd functions && npm test` (= `vitest run`; scope with `... -- src/index.test.ts` if needed) |
| **Full app suite** | `npx vitest run` (2-file known-failing baseline per CLAUDE.md: `storage.rules.test.ts`, `RosterView.test.ts`) |
| **Client type gate** | `npm run type-check` (vue-tsc --build — typechecks tests too; NOT `-p tsconfig.app.json`) |
| **Functions type gate** | `cd functions && npm run build` (= `tsc`) |
| **Estimated runtime** | client scoped ~5–20s; functions scoped ~5–15s |

> ⚠ The send path is server-side. `sendQueuedMessage` and `queueServiceMessage` handler tests live in the
> **functions** suite with **Resend mocked** (`vi.mock("resend")` or a DI'd sender) and the existing
> `defineSecret` mock — no real email, no secret needed. NO deploy this phase (deploy-gated per grant).

---

## Sampling Rate

- **After every task commit:** run the scoped quick run for the suite that task touched (client → `npx
  vitest run <file>`; server → `cd functions && npm test`).
- **After every plan wave:** run BOTH `npx vitest run` (app suite) + `cd functions && npm test`, and both
  type gates (`npm run type-check` and `cd functions && npm run build`).
- **Before `/gsd-verify-work`:** app suite at baseline, functions suite green, both type gates clean.
- **Max feedback latency:** ~20s per suite.

---

## Per-Task Verification Map

> Seeded here; the planner (gsd-planner) populates one row per task with its `<automated>` verify command.
> Derived from `59-RESEARCH.md` § Validation Architecture (R131/R136–R141).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills)_ | | | R131 | send-secret-confinement | resend dep + ported resolver; secret bound only to trigger | unit (functions) | `cd functions && npm test` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R131 | server org+kill-switch re-check | queueServiceMessage enqueues only after re-validation | unit (functions) | `cd functions && npm test` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R131/R139 | idempotency + no-trust-client-list | sendQueuedMessage: txn claim, re-resolve, per-recipient render | unit (functions) | `cd functions && npm test` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R136–R141 | kill-switch gates surface; disabled Send states | composer selection, "Reaches N", tokens, options | unit (client) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `resend` pinned in `functions/package.json` (server-only; version `6.19.0`, NOT the too-new 6.20.0)
- [ ] `functions/src/serviceRoles.ts` — PORTED copy of `resolveServiceRoleAssignments` (functions/ cannot
      import `../src`), with type imports rewired; new `functions/src/serviceRoles.test.ts`
- [ ] `functions/src/*.test.ts` — new handler tests for `queueServiceMessage` + `sendQueuedMessage` with
      **Resend mocked**; extend `functions/src/index.test.ts` or add a dedicated file
- [ ] `src/components/__tests__/MessageComposer.test.ts` — new (composer render, selection, Reaches-N,
      token insert, options, disabled/error states)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real email actually reaches an inbox | R131/R139 | Requires deployed Function + Resend account + domain DNS | OWNER: after deploy + secret set + DNS auth, send a One-off to a test recipient; confirm delivery + per-recipient "their roles" |
| ✉ composer opens from the action bar and matches the design visually | R136 | Visual/interaction judgment | Open a service, click ✉ Messages, compare to DESIGN-messaging.md §5a; verify teams-first + Reaches-N updates live |
| Kill-switch OFF hides/disables the live send surface end-to-end | R131 | Full-app interaction | Turn messaging off in Settings; confirm the ✉ action is disabled with the tooltip |

> These route to `verification_deferred_human` under the v1.7 grant (owner verifies at `/gsd-verify-work
> 59`), PLUS the deploy/secret/DNS owner-setup steps. All send-path LOGIC is automated in the functions
> suite with Resend mocked.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s per suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
