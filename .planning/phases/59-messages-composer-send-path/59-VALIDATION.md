---
phase: 59
slug: messages-composer-send-path
# status lifecycle: draft (seeded here) → validated (set by plan-phase after planner fills the map)
status: validated
nyquist_compliant: true
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

> One row per plan task, populated by gsd-planner. Derived from `59-RESEARCH.md` § Validation Architecture
> (R131/R136–R141). 10 tasks across 4 plans (2 waves). The checkpoint task (59-01 T1) is a blocking human
> legitimacy gate and carries no automated command by design.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 59-01·T1 | 59-01 | 1 | R131 | T-59-01b / T-59-SC | Human-verify resend@6.19.0 pin before install (SUS/too-new; never auto-approved) | checkpoint (human) | — (blocking human-verify, no automated) | n/a | ⬜ pending |
| 59-01·T2 | 59-01 | 1 | R131 | T-59-01a | resend is a functions-only exact-pinned dep, never in the client bundle | build (functions) | `cd functions && node -e "require.resolve('resend')"` | ✅ build gate | ⬜ pending |
| 59-01·T3 | 59-01 | 1 | R131/R139 | T-59-01c | ported pure resolver + per-recipient roleNames split (lockstep with client) | unit (functions) | `cd functions && npx vitest run src/serviceRoles.test.ts` | ❌ W0 (new) | ⬜ pending |
| 59-02·T1 | 59-02 | 1 | R141 | T-59-02e | createQueuedMessage shapes the doc (queued vs scheduled), no undefined leaves, no secret | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ✅ extend existing | ⬜ pending |
| 59-02·T2 | 59-02 | 1 | R131/R137 | T-59-02a/b/c/d | queueServiceMessage re-auths (editor), re-checks kill-switch, validates type/scheduledFor, enqueues | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ✅ extend existing | ⬜ pending |
| 59-03·T1 | 59-03 | 2 | R138/R139 | (token render) | renderMessageTokens: per-recipient their_roles, ordered song_list, empty-safe service_link | unit (functions) | `cd functions && npx vitest run src/messageTokens.test.ts` | ❌ W0 (new) | ⬜ pending |
| 59-03·T2 | 59-03 | 2 | R131/R139 | T-59-03a/b/c | idempotency txn (no double-send), server re-resolve (no client list), secret bound only here | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ✅ extend existing | ⬜ pending |
| 59-04·T1 | 59-04 | 2 | R136 | T-59-04b/c | ✉ action editor-gated + disabled-with-tooltip when messaging off (not hidden) | unit (client) | `npx vitest run src/views/__tests__/serviceEditorActionBar.test.ts` | ✅ extend existing | ⬜ pending |
| 59-04·T2 | 59-04 | 2 | R136/R137/R138/R140/R141 | T-59-04a/d | composer selection, "Reaches N" (0/1/many), token insert, options, disabled-Send, selector-only payload | unit (client) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | ❌ W0 (new) | ⬜ pending |
| 59-04·T3 | 59-04 | 2 | R136 | T-59-04c | required messagingEnabled/onMessages threaded; composer mounted (compile-enforced wiring) | typecheck (client) | `npm run type-check` | ✅ gate exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Requirement coverage across the map:** R131 (59-01·T2/T3, 59-02·T2, 59-03·T2), R136 (59-04·T1/T2/T3),
R137 (59-02·T2, 59-04·T2), R138 (59-03·T1, 59-04·T2), R139 (59-01·T3, 59-03·T1/T2, 59-04·T2 basis),
R140 (59-04·T2), R141 (59-02·T1, 59-04·T2). All 7 phase requirements are covered by at least one
automated task (R136 also has a compile-enforced wiring gate).

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the one exception, 59-01·T1, is a blocking human legitimacy checkpoint — exempt by design)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only the T1 checkpoint lacks one; T2/T3 immediately follow with scoped runs)
- [x] Wave 0 covers all MISSING references (new files: `functions/src/serviceRoles.test.ts`, `functions/src/messageTokens.test.ts`, `src/components/__tests__/MessageComposer.test.ts`; existing suites extended: `functions/src/index.test.ts`, `src/views/__tests__/serviceEditorActionBar.test.ts`)
- [x] No watch-mode flags (every command is `vitest run` / `npm run build` / `npm run type-check`)
- [x] Feedback latency < 20s per suite (scoped functions/client runs ~5–20s; the 59-04·T3 type-check gate is a compile-enforced wiring check, not a per-commit scoped run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated — 4 plans, 10 tasks mapped, all 7 requirements covered (2026-08-14).
