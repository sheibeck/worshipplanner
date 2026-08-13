---
phase: 58
slug: messaging-infrastructure-settings-recipient-resolution
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-13
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Full validation architecture
> (per-requirement test design) lives in `58-RESEARCH.md` § Validation Architecture — this file is the
> execution-time sampling contract the planner's tasks map onto.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app suite, jsdom) + a separate Firestore rules suite (node) |
| **Config file** | `vite.config.ts` (app suite) · `vitest.rules.config.ts` (rules suite, via emulator) |
| **Quick run command** | `npx vitest run <file>` (scoped to the touched test file) |
| **Full suite command** | `npx vitest run` (2-file known-failing baseline per CLAUDE.md) |
| **Rules command** | `npm run test:rules` — OR, if an emulator is already up, `npx vitest run --config vitest.rules.config.ts` |
| **Type gate** | `npm run type-check` (vue-tsc --build — typechecks tests too; NOT `-p tsconfig.app.json`) |
| **Estimated runtime** | app-suite scoped ~5–20s; rules suite ~30–60s (emulator start) |

> ⚠ Per CLAUDE.md: the new `firestore.rules` ALLOW-case test runs in the **rules** suite, never the
> default `npx vitest run` app suite (which excludes `src/rules.test.ts`). Do NOT use `vitest run --dir src`.

---

## Sampling Rate

- **After every task commit:** Run the scoped `npx vitest run <touched test file>`.
- **After every plan wave:** Run `npx vitest run` (app suite) + `npm run type-check`.
- **Before `/gsd-verify-work`:** App suite green (at baseline), type-check clean, and the rules suite's
  new messaging ALLOW/deny cases green against a running emulator.
- **Max feedback latency:** ~20s (app) / ~60s (rules).

---

## Per-Task Verification Map

> Seeded by plan-phase; the planner populates one row per task with its `<automated>` verify command.
> Derived from `58-RESEARCH.md` § Validation Architecture (R130/R132/R133/R134/R135).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills)_ | | | R134/R135 | — | recipient dedup + unreachable count | unit | `npx vitest run src/utils/__tests__/messagingRecipients.test.ts` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R130 | — | kill-switch default OFF + choke point | unit | `npx vitest run src/utils/__tests__/messaging.test.ts` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R132/R133 | — | inherit/override + timezone persist | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ | ⬜ pending |
| _(planner fills)_ | | | R130/R132 (rules) | T-58-rules | member-read / editor-create ALLOW + deny | integration | `npm run test:rules` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/messagingRecipients.test.ts` — new (pure resolver: dedup, unreachable, teams, everyone)
- [ ] `src/utils/__tests__/messaging.test.ts` — new (isMessagingEnabled gate; default-OFF)
- [ ] Rules test cases for `messages`/`recipients`/`lockSnapshots` — new, in the rules suite, with a genuine ALLOW-case
- [ ] R132/R133 assertions extend EXISTING `src/stores/__tests__/services.test.ts` (no new file)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Messaging card renders + matches AI/PC/Bible cards visually | R130 | Visual consistency judgment | Open Settings, compare the new Messaging card to its siblings; toggle the kill-switch |
| Per-service defaults panel is Draft-editable / locked read-only | R132 | Full-app interaction | On a Draft service edit an override; lock it; confirm the panel goes read-only |
| Timezone select persists | R133 | Full-app round-trip | Set a timezone, reload, confirm it stuck |

> These are the items that route to `verification_deferred_human` under the v1.7 grant (owner verifies
> at `/gsd-verify-work 58`). The rules ALLOW-case and all resolver/gate logic are automated above.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
