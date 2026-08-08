---
phase: 45
slug: esv-nlt-bible-version-selection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase from 45-RESEARCH.md § Validation Architecture. Per-task map filled by the planner / validate-phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (app: Vue 3 + jsdom) · functions: its own vitest/jest config under `functions/` |
| **Config file** | vite.config.ts (app; excludes src/rules.test.ts) · functions/ has its own test setup |
| **Quick run command** | `npx vitest run --dir src --exclude '**/rules.test.ts' <changed test files>` |
| **Full suite command** | `npx vitest run --dir src --exclude '**/rules.test.ts'` (app) + the functions test command for `functions/src/index.test.ts` / `nltApi` tests |
| **Type gate** | `npm run type-check` (vue-tsc --build) for the app; `tsc`/build for `functions/` |
| **Estimated runtime** | ~70s app suite |

---

## Sampling Rate

- **After every task commit:** quick run over the task's touched test files (app and/or functions).
- **After every plan wave:** full app suite + functions tests.
- **Before `/gsd-verify-work`:** app suite at the documented 2-file baseline (storage.rules.test.ts, RosterView.test.ts), `npm run type-check` at 0, and functions tests green.
- **Max feedback latency:** ~70 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills per plan/task)_ | | | R090 / R091 / R092 | — | | unit | `npx vitest run --dir src ...` | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure (vitest + vue-tsc + functions test setup) covers all phase requirements — no framework install needed.
- The NLT proxy's HTML-stripping must be tested against the REAL sample shape documented in 45-RESEARCH.md (verse_export/vn, .a-tn/.tn footnotes, headings), including the empty-body-on-bad-ref case and the `[N]` bracketed-verse-number output convention `parseVerses` depends on.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real end-to-end NLT fetch through the DEPLOYED proxy (church set to NLT → new scripture renders with (NLT)) | R090/R091 | Requires the owner to deploy the NLT Cloud Function + set the NLT_API_KEY function secret (deploy-gated) | Owner check — recorded to PENDING-VERIFICATION.md § Phase 45 |
| Changing the setting leaves existing slides' text + attribution unchanged | R092 | Live click-through across a real service | Owner check — PENDING-VERIFICATION.md § Phase 45 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] NLT proxy tested against the real documented sample shape (incl. empty-body + bracket-number convention)
- [ ] No watch-mode flags
- [ ] Feedback latency < 70s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
