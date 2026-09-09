---
phase: 138
slug: field-fixes-church-picker-deep-link-service-update-email-lin
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-09
---

# Phase 138 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom) |
| **Config file** | `vite.config.ts` (excludes `src/rules.test.ts` + `render-service/**`) |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npx vitest run` (baseline = 1 known-failing file: `storage.rules.test.ts`) |
| **Estimated runtime** | ~30–60 seconds |

Type-check gate: `npm run type-check` (vue-tsc --build — checks test files too), NOT `-p tsconfig.app.json`.

---

## Sampling Rate

- **After every task commit:** Run the changed test file via `npx vitest run <file>`
- **After every plan wave:** Run `npx vitest run` (expect only the `storage.rules.test.ts` baseline failure)
- **Before `/gsd-verify-work`:** Full suite green except the documented baseline
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _seeded by planner_ | — | — | R428 / R434 | — | — | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Auth-store test coverage for the new two-tier remembered-org storage (new-tab restore from the
  `localStorage` fallback; sign-out clears both tiers; a persisted-but-non-member org is not honored) — R428.
- [ ] `ReLockNotifyPrompt.test.ts` needs a `vi.mock('@/stores/services', …)` added (currently no Pinia/store
  mock) so the new `ensureShareLink` call + `{{service_link}}`-in-body assertion can be tested — R434
  (Wave-0 gap flagged by research).

*Final list finalized by the planner's per-task verify maps and validate-phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real new-tab restore in a browser | R428 | jsdom can't fully model a genuinely-new tab's empty sessionStorage vs. shared localStorage | Deferred to batched UAT: right-click a nav link → open in new tab as a multi-church user → lands on the page, not the picker |

*Automated unit coverage exists for the storage-helper logic; the above is the end-to-end browser confirmation only.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
