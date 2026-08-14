---
phase: 61
slug: automatic-notifications-lock-scheduled-reminder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling. Full per-requirement test design lives in
> `61-RESEARCH.md` § Validation Architecture — this file is the execution-time sampling contract the
> planner's tasks map onto. TWO suites (app/jsdom + functions/node); sampling is per-suite. The load-bearing
> assertions are SC4 idempotency (no double reminder / no double dispatch) and SC2 never-on-draft/off.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Client framework** | vitest (app suite, jsdom) — `vite.config.ts` |
| **Functions framework** | vitest (functions suite, **node** env) — `functions/vitest.config.ts` |
| **Client quick run** | `npx vitest run <file>` |
| **Functions quick run** | `cd functions && npm test` (scope with `... -- src/index.test.ts`) |
| **Full app suite** | `npx vitest run` (2-file known-failing baseline: `storage.rules.test.ts`, `RosterView.test.ts`) |
| **Client type gate** | `npm run type-check` (vue-tsc --build; NOT `-p tsconfig.app.json`) |
| **Functions type gate** | `cd functions && npm run build` (= `tsc`) |
| **Estimated runtime** | client scoped ~5–20s; functions scoped ~5–15s; full app suite ~300s (use an extended Bash timeout) |

> ⚠ The `sendScheduledReminders` cron + scheduled-dispatch handler tests live in the **functions** suite,
> mirroring `cleanupOrphanRendersHandler` (`getFirestore`/collectionGroup fake, provider MOCKED). NO deploy.
> The lock hook tests live in the **client** suite (spy on the store call + queueServiceMessage wrapper).

---

## Sampling Rate

- **After every task commit:** the scoped quick run for the suite that task touched.
- **After every plan wave:** BOTH `npx vitest run` + `cd functions && npm test`, and both type gates.
- **Before `/gsd-verify-work`:** app suite at baseline, functions suite green, both type gates clean.
- **Max feedback latency:** ~20s per suite (full app suite ~300s at wave boundaries).

---

## Per-Task Verification Map

> Seeded here; the gsd-planner populates one row per task. Derived from `61-RESEARCH.md` § Validation
> Architecture (R144, R145, SC1–SC4).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills)_ | | | R144 | never-on-draft/off | lock hook: draft→locked auto-enqueue lock-notification, gated + first-lock-only; lockSnapshots/current written | unit (client) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend | ⬜ pending |
| _(planner fills)_ | | | R144 | send-path plumbing | MessageType accepts 'lock-notification'; queueServiceMessage enqueues it | unit (functions) | `cd functions && npm test` | ✅ extend | ⬜ pending |
| _(planner fills)_ | | | R145 | idempotent + never-draft | cron: N-days-before in org tz, skip draft/off, reminderSentAt no-double-send | unit (functions) | `cd functions && npm test` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R145 | scheduled dispatch idempotent | due scheduled message → fresh queued doc via transactional claim; retry no double | unit (functions) | `cd functions && npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `functions/src/index.test.ts` — new `sendScheduledReminders` handler tests (fires on the right
      org-tz date; skips draft; kill-switch/reminder-off skip; `reminderSentAt` idempotent no-double-send;
      scheduled-message dispatch idempotent) — mirror the `cleanupOrphanRendersHandler` mock shape
- [ ] `functions/src/index.test.ts` — `MessageType` accepts `'lock-notification'` (extend the queueServiceMessage tests)
- [ ] `src/views/__tests__/ServiceEditorView.test.ts` — lock-hook tests (auto-enqueue on first lock behind
      the gates; NOT on re-lock; NOT when off/default-off; lockSnapshots/current write; the inline banner
      confirmation line states)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real reminder email fires N days before | R145 | Requires deployed cron + Resend + a dated service + a day to pass | OWNER: after deploy + secret + DNS, set a service N days out, confirm the reminder sends at the org-local date |
| The lock email actually reaches inboxes on first lock | R144 | Requires deployed send path + Resend | OWNER: lock a draft with lockNotify on; confirm assigned volunteers receive the email |
| The lock-time confirmation line renders in the banner | R144 | Visual judgment | Lock a draft with lockNotify on; confirm the amber banner shows "Notified N assigned volunteers" |

> These route to `verification_deferred_human` (owner at `/gsd-verify-work 61`), PLUS owner deploy of
> `sendScheduledReminders` (+ any index). All lock-hook + cron LOGIC is automated with the provider mocked.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable per suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
