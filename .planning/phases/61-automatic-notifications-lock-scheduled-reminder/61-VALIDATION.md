---
phase: 61
slug: automatic-notifications-lock-scheduled-reminder
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-14
planned_at: 2026-08-14
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
| 61-01·T1 | 61-01 | 1 | R144 (plumbing) | T-61-01a send-path plumbing | MessageType/MESSAGE_TYPES accept 'lock-notification'; queueServiceMessage enqueues it (editor+on) yet still rejects unknown types + non-editor/kill-switch-off | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ✅ extend | ⬜ pending |
| 61-01·T2 | 61-01 | 1 | R145 / R133 | T-61-01b tz correctness | todayInTimeZone('en-CA',{timeZone}) org-local date + UTC-pinned minusDays; two IANA zones diverge on one instant; DST-safe subtraction (pure helpers) | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ✅ extend | ⬜ pending |
| 61-02·T1 | 61-02 | 2 | R145 / SC3 / SC4 | T-61-02a/b/c idempotent + never-draft + tz | sendScheduledRemindersHandler: N-days-before in org tz, skip draft/kill-switch-off/reminder-off/not-due, enqueue type:'reminder', reminderSentAt no-double-send; onSchedule 04:00 no-secret wrapper | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ✅ extend | ⬜ pending |
| 61-03·T1 | 61-03 | 3 | R141 (P59 carryover) | T-61-03a/b/c dispatch idempotent | dispatchDueScheduledMessagesHandler: due scheduled message → transactional scheduled→dispatched claim + fresh status:'queued' doc via createQueuedMessage; retry no double; future skipped; single-field query, no index | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ✅ extend | ⬜ pending |
| 61-04·T1 | 61-04 | 2 | R144 / SC1 / SC2 | T-61-04a/b/c/d never-on-draft/off + non-blocking | lock hook: draft→locked first-lock auto-enqueue lock-notification gated (isMessagingEnabled + effective lockNotify + ≥1 reachable), lockSnapshots/current written every lock (read-before-write), enqueue own try/catch never re-raised into lifecycleError | unit (client) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend | ⬜ pending |
| 61-04·T2 | 61-04 | 2 | R144 | UI-SPEC #1 zero-one-many | lock-banner confirmation line: "Notified N assigned volunteer(s)." pluralized (sent), muted zero-reachable, muted error + Open Messages link, null renders nothing; aria-live='polite' | unit (client) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend | ⬜ pending |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 6 tasks carry a scoped `<automated>` command; both target test files already exist and are extended within each `tdd` task (no MISSING scaffold, so no separate Wave 0 plan)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every task has one
- [x] Wave 0 covers all MISSING references — none MISSING (`functions/src/index.test.ts` + `src/views/__tests__/ServiceEditorView.test.ts` both exist; the new `describe`/hook tests are written in-plan)
- [x] No watch-mode flags — all commands are `vitest run` / `tsc`
- [x] Feedback latency acceptable per suite — functions scoped ~5–15s, client scoped ~5–20s, full app suite ~300s at wave boundaries
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner, 2026-08-14) — 4 plans / 3 waves; SC4 (no double reminder / no double dispatch) and SC2 (never-on-draft/off) are the load-bearing automated assertions in 61-02·T1 / 61-03·T1 / 61-04·T1.
