---
phase: 125
slug: passwordless-magic-link-access-scoped-read-isolation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 125 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase; the planner fills the Per-Task Verification Map and Wave 0 from the PLANs, and
> `/gsd-validate-phase` finalizes it. RESEARCH.md carries the Validation Architecture this derives from.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app suite + rules suite) |
| **Config file** | `vite.config.ts` (app), `vitest.rules.config.ts` (Firestore/Storage rules) |
| **Quick run command** | `npx vitest run` (app; 1 known-failing baseline: `src/storage.rules.test.ts`) |
| **Full suite command** | `npx vitest run` + `npm run test:rules` + `npm run type-check` |
| **Estimated runtime** | ~60–120 seconds (app) + rules-emulator startup |

---

## Sampling Rate

- **After every task commit:** Run `npm run type-check` + the touched test file(s)
- **After every plan wave:** Run `npx vitest run` (app) and, for rules changes, `npm run test:rules`
- **Before `/gsd-verify-work`:** Full suite must be green (baseline exceptions per CLAUDE.md)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

*Planner fills this from the PLANs. R377 rules ALLOW/DENY cases MUST appear here as `test:rules` rows.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | R374–R377 | T-125-xx | — | rules/unit | `npm run test:rules` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Rules-emulator ALLOW/DENY test scaffolding for the volunteer read arm (R377) — extends the existing
      `src/rules.test.ts` harness
- [ ] Unit-test stubs for the magic-link sign-in completion + roster-email→assignment matching

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real magic-link email arrives + one-click sign-in end to end | R374, R375 | Requires a live Resend send + real inbox (deferred to batched UAT) | Trigger a reminder/share email to a rostered volunteer; click the link; confirm signed-in landing |

*The R377 isolation guarantee is NOT manual — it must be proven by emulator ALLOW/DENY tests.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
