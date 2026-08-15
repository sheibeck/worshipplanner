---
phase: 62
slug: relock-change-notice-scoped-diff
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-14
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling. Full per-requirement test design lives in
> `62-RESEARCH.md` § Validation Architecture — this file is the execution-time sampling contract. TWO
> suites (app/jsdom + functions/node). The heaviest unit target is the PURE `diffServiceSnapshots` (every
> type + the ROLE-narrow/others-broad affectedTeams rule + empty-diff). The load-bearing client assertions
> are the re-lock branch (prompt-on-change, silent-overwrite-on-no-change, overwrite-ONLY-on-confirm = SC4).

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
| **Estimated runtime** | client scoped ~5–20s; functions scoped ~5–15s; full app suite ~300s (extended Bash timeout) |

> ⚠ Phase 61's first-lock tests in `ServiceEditorView.test.ts` assert `slideGroupsFingerprint: null` —
> Phase 62 writes a REAL fingerprint map, so those assertions must be UPDATED (a stub realized, not a
> regression). The pure `diffServiceSnapshots` + fingerprint helper are testable with plain fixtures (no mocks).

---

## Sampling Rate

- **After every task commit:** the scoped quick run for the suite that task touched.
- **After every plan wave:** BOTH `npx vitest run` + `cd functions && npm test`, and both type gates.
- **Before `/gsd-verify-work`:** app suite at baseline, functions suite green, both type gates clean.
- **Max feedback latency:** ~20s per suite (full app suite ~300s at wave boundaries).

---

## Per-Task Verification Map

> Seeded here; the gsd-planner populates one row per task. Derived from `62-RESEARCH.md` § Validation
> Architecture (R146, R147, R148, SC1–SC4).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 62-01 T1 | 62-01 | 1 | R146 | T-62-01a/c | MessageType/MESSAGE_TYPES accept 'relock-notification' (enum gate); unknown type + non-editor/kill-switch-off still rejected | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ✅ extend | ⬜ pending |
| 62-01 T2 | 62-01 | 1 | R148 | T-62-01b/d | changeDiff widened to ChangeEntry[] \| null; persisted array when provided, null otherwise; every other type byte-unchanged; audit doc immutable | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ✅ extend | ⬜ pending |
| 62-02 T1 | 62-02 | 1 | R146 (SLIDES) | T-62-02b/c | fingerprintSlideGroups: deterministic per-group hash of ordered sourceRef identities; add/remove/reorder/authored-edit → changed; A1 documented | unit (client) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | ❌ W0 | ⬜ pending |
| 62-02 T2 | 62-02 | 1 | R146/R147 | T-62-02a/b | diffServiceSnapshots: SONG/ORDER/ROLE/NOTES/SLIDES (+slot add/remove) detection; ROLE-narrow/others-broad affectedTeams; empty-diff → [] | unit (client) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | ❌ W0 | ⬜ pending |
| 62-03 T1 | 62-03 | 2 | R146/R147 | T-62-03b | ReLockNotifyPrompt: checkable typed rows + team chips; affected-vs-everyone; Reaches-N recompute on check/uncheck + choice switch | unit (client) | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | ❌ W0 | ⬜ pending |
| 62-03 T2 | 62-03 | 2 | R146/R148 | T-62-03a/c/d | Send → queueServiceMessage type:'relock-notification' + changeDiff=checked; Lock-quietly/dismiss emit cancel; disabled/error states; failed send keeps snapshot | unit (client) | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | ❌ W0 | ⬜ pending |
| 62-04 T1 | 62-04 | 3 | R146 | T-62-04b | real slideGroupsFingerprint on every lock (replaces P61 null stub); first-lock auto-send unchanged; P61 null-fingerprint assertions updated | unit (client) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend | ⬜ pending |
| 62-04 T2 | 62-04 | 3 | R146/R148/SC4 | T-62-04a/c | re-lock diff opens prompt on change / silent overwrite on empty or messaging-off; overwrite lockSnapshots ONLY on confirm (sent OR cancel); overwrite-timing asserted | unit (client) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/serviceLockDiff.test.ts` — new (pure diff every type + affectedTeams rule +
      empty-diff; fingerprint determinism)
- [ ] `src/components/__tests__/ReLockNotifyPrompt.test.ts` — new (checkable list, Reaches-N, affected-vs-
      everyone, Send vs Lock-quietly, disabled/error states)
- [ ] `functions/src/index.test.ts` — extend for `'relock-notification'` + `changeDiff` persisted
- [ ] `src/views/__tests__/ServiceEditorView.test.ts` — extend (re-lock branch) AND update the Phase 61
      first-lock `slideGroupsFingerprint: null` assertions to the real fingerprint

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The re-lock prompt matches the design + entries read correctly | R146 | Visual/interaction judgment | Lock a service, reopen, edit a song/role/order/notes/slides, re-lock; confirm the typed checkable diff |
| A real re-lock notice reaches only the affected teams | R147 | Requires deployed send path + Resend | OWNER: after deploy, re-lock with a ROLE change checked → only that team is emailed |
| "Lock quietly" re-locks with no email + resets the diff basis | R148 | Full-app interaction | Re-lock via Lock quietly; confirm no send; edit + re-lock again → diff is vs the quiet-lock state |

> These route to `verification_deferred_human` (owner at `/gsd-verify-work 62`), PLUS the owner deploy of
> the send path (shared with 59). All diff/fingerprint/modal/hook LOGIC is automated.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 8 tasks carry an `<automated>` command; the four missing test files are CREATED in-plan by their own tasks (`serviceLockDiff.test.ts`, `ReLockNotifyPrompt.test.ts`) or EXTENDED (`functions/src/index.test.ts`, `ServiceEditorView.test.ts`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every task ends in a scoped vitest run
- [x] Wave 0 covers all MISSING references — the two new test files are authored alongside their production code (TDD tasks); the two extended suites already exist
- [x] No watch-mode flags — all commands are `vitest run` (one-shot), not `vitest` watch
- [x] Feedback latency acceptable per suite — client scoped ~5–20s, functions scoped ~5–15s; full app suite ~300s at wave boundaries only
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-08-14 — 4 plans / 8 tasks mapped; every task has an automated verify; the pure `diffServiceSnapshots` + fingerprint determinism (62-02) and the SC4 overwrite-only-on-confirm test (62-04 T2) are the load-bearing gates. Manual-only rows remain owner-deferred (deployed send path).
