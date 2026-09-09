---
phase: 138
slug: field-fixes-church-picker-deep-link-service-update-email-lin
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-09
validated: 2026-09-09
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

| Task ID | Plan | Wave | Requirement | Secure/Correct Behavior | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|--------------------------|-----------|--------------------|------|--------|
| auth-store | — | 0 | R428 | New-tab restore from localStorage fallback (`wp.selectedOrg.persist`) lands the user in their remembered org instead of the church picker | unit | `npx vitest run src/stores/__tests__/auth.test.ts` | `src/stores/__tests__/auth.test.ts` | ✅ green |
| auth-store | — | 0 | R428 | `logout()` clears BOTH the sessionStorage tier (`wp.selectedOrg`) and the localStorage fallback tier (`wp.selectedOrg.persist`) | unit | `npx vitest run src/stores/__tests__/auth.test.ts` | `src/stores/__tests__/auth.test.ts` | ✅ green |
| auth-store | — | 0 | R428 | A persisted-but-stale org the user is no longer a member of is NOT honored from the localStorage tier — falls through to the church picker | unit | `npx vitest run src/stores/__tests__/auth.test.ts` | `src/stores/__tests__/auth.test.ts` | ✅ green |
| auth-store | — | 0 | R428 | A single-org user's flow is unaffected by the new two-tier storage (goes straight in, no selection required) | unit | `npx vitest run src/stores/__tests__/auth.test.ts` | `src/stores/__tests__/auth.test.ts` | ✅ green |
| relock-notify-prompt | — | 0 | R434 | `{{service_link}}` token + "View the full plan:" line appears in the sent body when `ensureShareLink` resolves a URL | unit | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | `src/components/__tests__/ReLockNotifyPrompt.test.ts` | ✅ green |
| relock-notify-prompt | — | 0 | R434 | `ensureShareLink(service, orgId)` is called and resolves before `queueServiceMessage` fires (ordering asserted via `invocationCallOrder`) | unit | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | `src/components/__tests__/ReLockNotifyPrompt.test.ts` | ✅ green |
| relock-notify-prompt | — | 0 | R434 | A rejected `ensureShareLink` is swallowed (non-blocking) — the notice still sends and emits `sent` | unit | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | `src/components/__tests__/ReLockNotifyPrompt.test.ts` | ✅ green |
| relock-notify-prompt | — | 0 | R434 | An empty-string link resolution omits the plan-link line entirely (no dangling label / no bare `{{service_link}}`) | unit | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | `src/components/__tests__/ReLockNotifyPrompt.test.ts` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Run confirmed 2026-09-09:** `npx vitest run src/stores/__tests__/auth.test.ts src/components/__tests__/ReLockNotifyPrompt.test.ts` → 2 files, 149 tests, all passed (125 + 24). All R428/R434 behaviors listed above and in Wave 0 were independently re-verified in this pass (not merely re-cited from the SUMMARY) — every gap named by research already has a real, executed, passing assertion. No new test files were needed.

---

## Wave 0 Requirements

- [x] Auth-store test coverage for the new two-tier remembered-org storage (new-tab restore from the
  `localStorage` fallback; sign-out clears both tiers; a persisted-but-non-member org is not honored) — R428.
  Confirmed present and passing in `src/stores/__tests__/auth.test.ts` (see "restores the active org from
  the localStorage fallback in a new tab", "clears both the sessionStorage and localStorage remembered-org
  tiers", "does not honor a stale persisted org from localStorage the user is not a member of", and "a
  single-org user goes straight in").
- [x] `ReLockNotifyPrompt.test.ts` needs a `vi.mock('@/stores/services', …)` added (currently no Pinia/store
  mock) so the new `ensureShareLink` call + `{{service_link}}`-in-body assertion can be tested — R434
  (Wave-0 gap flagged by research). Confirmed present: `vi.mock('@/stores/services', ...)` with a
  `mockEnsureShareLink` spy, plus 3 dedicated tests (token-in-body, called-before-send with ordering,
  non-blocking rejection swallow, and empty-string graceful omission).

Both Wave-0 gaps were already closed by the implementer before this validation pass; this pass re-ran
both files to confirm the tests exist, exercise the exact behavior described, and pass — not merely that
a file with a matching name exists.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real new-tab restore in a browser | R428 | jsdom can't fully model a genuinely-new tab's empty sessionStorage vs. shared localStorage | Deferred to batched UAT: right-click a nav link → open in new tab as a multi-church user → lands on the page, not the picker |

*Automated unit coverage exists for the storage-helper logic; the above is the end-to-end browser confirmation only.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-09 by Nyquist auditor (retroactive gap-fill pass). R428 and R434 both have
real, executed, passing behavioral test coverage. The one remaining gap (genuinely-new-tab restore in a
real browser) is correctly scoped to Manual-Only Verifications — jsdom cannot model a new tab's isolated
sessionStorage vs. shared localStorage, so it is not a Wave-0 gap, it is an inherent jsdom limitation with
unit coverage already substituting for the underlying storage-helper logic.
