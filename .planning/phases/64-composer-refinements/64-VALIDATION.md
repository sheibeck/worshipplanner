---
phase: 64
slug: composer-refinements
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-15
---

# Phase 64 — Validation Strategy

> Composer refinements across 4 shipped files. Mostly client (jsdom); ONE functions change (R154 server
> `{{name}}`). Load-bearing: the token render stays faithful client↔server; the add-person control actually
> adds; the history no longer shows a perpetual "Sending…"; and the label change + toast removal update the
> existing assertions they break (not new failures).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Client framework** | vitest (app suite, jsdom) — `vite.config.ts` |
| **Functions framework** | vitest (functions suite, node) — `functions/vitest.config.ts` |
| **Client quick run** | `npx vitest run <file>` |
| **Functions quick run** | `cd functions && npm test` |
| **Full app suite** | `npx vitest run` (2-file known-failing baseline: `storage.rules.test.ts`, `RosterView.test.ts`; ~300s, extended timeout) |
| **Client type gate** | `npm run type-check` (vue-tsc --build) |
| **Functions type gate** | `cd functions && npm run build` |
| **Estimated runtime** | client scoped ~10–30s; functions scoped ~5–15s |

---

## Sampling Rate

- **After every task commit:** the scoped quick run for the suite that task touched + its type gate.
- **After every plan wave:** `npx vitest run` (app suite) + `cd functions && npm test` if functions touched.
- **Before `/gsd-verify-work`:** app suite at baseline, functions suite green, both type gates clean.
- **Max feedback latency:** ~30s scoped.

---

## Per-Task Verification Map

> One row per task. Derived from `64-RESEARCH.md` § Validation Architecture. All target spec files EXIST
> (extend, not create) → no Wave 0 scaffold gaps. Waves: 1 = {64-01, 64-02, 64-04} (zero file overlap,
> parallel-capable; worktrees disabled → sequential); 2 = {64-03} depends_on 64-01 (both edit
> `MessageComposer.test.ts`).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 64-01·T1 | 64-01 | 1 | R151 | T-64-01a/b | MESSAGING_TEAM_LABELS = Band/Vocals/Tech/Other; the 4 hard-coded Worship/Hosts test assertions updated (mock :97 only, NOT the :1780 section header) | unit (client) | `npx vitest run src/utils/__tests__/messagingRecipients.test.ts src/components/__tests__/MessageComposer.test.ts src/components/__tests__/ReLockNotifyPrompt.test.ts src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend | ⬜ pending |
| 64-02·T1 | 64-02 | 1 | R154 (server) | T-64-02a/b/c | renderMessageTokens renders `{{name}}` per recipient (+ call site + ctx() helper); `{{song_list}}` still supported | unit (functions) | `cd functions && npm test && npm run build` | ✅ extend | ⬜ pending |
| 64-03·T1 | 64-03 | 2 | R152 / R153 / R154 (client) | T-64-03a/d/e | visible add-person picker adds+bumps Reaches-N (disabled when empty); preview always-live; token chips (Name, no song_list) + sample renders `{{name}}` | unit (client) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | ✅ extend | ⬜ pending |
| 64-03·T2 | 64-03 | 2 | R155 (composer) / R156 | T-64-03b/c | Send spinner + disabled + Cancel disabled; success toast removed (emit 'sent' kept); types seed distinct + Reminder→everyone behind recipientDirty | unit (client) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | ✅ extend | ⬜ pending |
| 64-04·T1 | 64-04 | 1 | R155 (history) | T-64-04a/b/c | aged-queued/sending (>5min) OR null-guard → red "Failed to send" pill (no spinner) in statusPill + sendTimeLabel; recent keeps spinner | unit (client) | `npx vitest run src/components/__tests__/ServiceMessageHistory.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing test files EXTENDED (none new — all verified present during planning): `src/utils/__tests__/messagingRecipients.test.ts` (labels),
      `functions/src/messageTokens.test.ts` (`{{name}}`), `src/components/__tests__/MessageComposer.test.ts`
      (add-person, live preview, tokens, spinner, no-toast, type seeding), `src/components/__tests__/ServiceMessageHistory.test.ts`
      (aged-queued → failed — confirmed present, uses `vi.useFakeTimers()` + FIXED_NOW; default `makeMessage` createdAt is 60s ago so the existing sending/failed matrix stays green). Update the label assertions in `ReLockNotifyPrompt.test.ts` +
      `ServiceEditorView.test.ts` mock (`:97` only) that hard-code Worship/Hosts. NO Wave 0 scaffold gaps — no framework install.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Composer reads right end-to-end | R151-R156 | Visual/interaction judgment | Open ✉ composer: labels Band/Vocals/Tech/Other; add a person; watch the live preview update as you type; switch types and see the seed; send and see the spinner |
| A real send delivers (needs deploy + real key) | R154/R155 | Requires deployed send path + real Resend key | OWNER: after deploy + real key, send; confirm `{{name}}` renders and no message hangs on "Sending…" |

> Route to `verification_deferred_human` (owner at `/gsd-verify-work 64`). All composer/render/history LOGIC
> is automated. The R154 server change ships UNDEPLOYED (owner redeploys the send path).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (5/5 tasks carry an `<automated>` command)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 covers all MISSING references (none missing — all spec files exist)
- [x] No watch-mode flags (all runs are `vitest run` / `npm test` / `npm run build`)
- [x] Feedback latency < 30s scoped (client scoped ~10–30s; functions scoped ~5–15s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** map filled by gsd-planner 2026-08-15 — nyquist_compliant true; awaiting execution.
