---
phase: 62
slug: relock-change-notice-scoped-diff
status: draft
nyquist_compliant: false
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
| _(planner fills)_ | | | R146/R147 | pure diff | diffServiceSnapshots: SONG/ORDER/ROLE/NOTES/SLIDES detection + ROLE-narrow/others-broad affectedTeams + empty-diff | unit (client) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R146 (SLIDES) | fingerprint | slideGroupsFingerprint: deterministic per-group hash; deck add/remove/reorder/authored-edit → changed | unit (client) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R146/R148 | send-path plumbing | MessageType accepts 'relock-notification'; changeDiff persisted (not forced null) | unit (functions) | `cd functions && npm test` | ✅ extend | ⬜ pending |
| _(planner fills)_ | | | R147 | modal | ReLockNotifyPrompt: checkable entries → Reaches-N, affected-vs-everyone, Send vs Lock-quietly | unit (client) | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R146/R148/SC4 | lock-hook re-lock branch | re-lock diff opens prompt on change / silent overwrite on none; overwrite lockSnapshots ONLY on confirm | unit (client) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable per suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
