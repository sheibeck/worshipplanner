---
phase: 63
slug: messages-tab-always-visible-history
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-15
---

# Phase 63 — Validation Strategy

> Single-suite (client/jsdom) phase — one file (`src/views/ServiceEditorView.vue`) + its test. A tab
> relocation + one gate fix. The load-bearing assertions: the Messages tab is editor+messaging gated, both
> panels render inside it (not the Service Order tab), and the history stays visible on a LOCKED service.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app suite, jsdom) — `vite.config.ts` |
| **Quick run** | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` |
| **Full app suite** | `npx vitest run` (2-file known-failing baseline: `storage.rules.test.ts`, `RosterView.test.ts`; ~300s, extended timeout) |
| **Type gate** | `npm run type-check` (vue-tsc --build; NOT `-p tsconfig.app.json`) — the `activeTab` union must include `'messages'` |
| **Estimated runtime** | scoped ~10–30s |

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` + `npm run type-check`.
- **Before `/gsd-verify-work`:** full app suite at baseline, type-check clean.
- **Max feedback latency:** ~30s scoped.

---

## Per-Task Verification Map

> Seeded here; the gsd-planner populates one row per task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 63-01-T1 | 63-01 | 1 | R149 | T-63-01a, T-63-01c, T-63-01d | Messages tab (editor+messaging gated) hosts the defaults + history inside `messages-panel`; both absent from `service-order-panel`; `buildActionBarItems('messages')` returns `[]` and the ✉ composer entry stays on the Service Order action bar (SC3) | unit (client) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/views/__tests__/serviceEditorActionBar.test.ts` | ✅ extend | ⬜ pending |
| 63-01-T2 | 63-01 | 1 | R150 | T-63-01b | history renders on a LOCKED service (`status: 'planned'`, `canEditService` gate dropped → `isMessagingEnabled() && authStore.isEditor`); hidden for viewer / messaging-off; defaults panel keeps its locked-read-only summary | unit (client) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/views/__tests__/ServiceEditorView.test.ts` — extend: Messages tab present for editor+messaging-on,
      absent for viewer / messaging-off; the defaults panel + ServiceMessageHistory render under the Messages
      tab and NOT under the Service Order tab; the history renders on a locked service (R150).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The Messages tab looks right + panels read correctly | R149 | Visual judgment | Open a service, click Messages; confirm defaults + "Sent on this service" render there, gone from Service Order |
| History stays visible after locking | R150 | Full-app interaction | Lock a service; open Messages; confirm the history is still shown (read-only) |

> Route to `verification_deferred_human` (owner at `/gsd-verify-work 63`). All tab-gating + panel-presence +
> locked-visibility LOGIC is automated.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (both tasks carry an `<automated>` scoped vitest command; no MISSING scaffolds)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (2/2 tasks automated)
- [x] Wave 0 covers all MISSING references (none — the test files exist and are extended, not created)
- [x] No watch-mode flags
- [x] Feedback latency < 30s scoped
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** map filled by gsd-planner 2026-08-15 (plan 63-01, 2 tasks, wave 1); nyquist_compliant set true.
