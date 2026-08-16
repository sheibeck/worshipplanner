---
phase: 64
slug: composer-refinements
status: draft
nyquist_compliant: false
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

> Seeded here; the gsd-planner populates one row per task. Derived from `64-RESEARCH.md` § Validation Architecture.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills)_ | | | R151 | — | MESSAGING_TEAM_LABELS = Band/Vocals/Tech/Other; the 4 hard-coded Worship/Hosts test assertions updated | unit (client) | `npx vitest run src/utils/__tests__/messagingRecipients.test.ts` | ✅ extend | ⬜ pending |
| _(planner fills)_ | | | R154 (server) | — | renderMessageTokens renders `{{name}}` per recipient; song_list still supported | unit (functions) | `cd functions && npm test` | ✅ extend | ⬜ pending |
| _(planner fills)_ | | | R152/R153/R154(client)/R156 | — | add-person adds+bumps Reaches-N; preview always-live; token chips (Name, no song_list); types seed distinct + Reminder→everyone | unit (client) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | ✅ extend | ⬜ pending |
| _(planner fills)_ | | | R155 | — | Send shows spinner + disables; success toast removed; history aged-queued(>5min)→"Failed to send" | unit (client) | `npx vitest run src/components/__tests__/MessageComposer.test.ts src/components/__tests__/ServiceMessageHistory.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing test files EXTENDED (none new): `src/utils/__tests__/messagingRecipients.test.ts` (labels),
      `functions/src/messageTokens.test.ts` (`{{name}}`), `src/components/__tests__/MessageComposer.test.ts`
      (add-person, live preview, tokens, spinner, no-toast, type seeding), `src/components/__tests__/ServiceMessageHistory.test.ts`
      (aged-queued → failed). Update the label assertions in `ReLockNotifyPrompt.test.ts` +
      `ServiceEditorView.test.ts` mock that hard-code Worship/Hosts.

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s scoped
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
