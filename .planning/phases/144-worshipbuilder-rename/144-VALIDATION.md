---
phase: 144
slug: worshipbuilder-rename
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-27
---

# Phase 144 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `144-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest — root 4.0.x (jsdom) + `functions/` 4.1.10 (node) |
| **Config file** | `vite.config.ts` (root `test:` block); `functions/vitest.config.ts` |
| **Quick run command** | `npx vitest run src/brandName.test.ts` ; `cd functions && npx vitest run src/adminEmail.test.ts src/inviteOnboarding.test.ts src/volunteerLink.test.ts` |
| **Full suite command** | `npx vitest run` (baseline: only `src/storage.rules.test.ts` fails) + `cd functions && npx vitest run` + `npm run type-check` |
| **Estimated runtime** | ~10 s quick · ~14 min root full |

---

## Sampling Rate

- **After every task commit:** the quick command relevant to the files touched
- **After every plan wave:** root `npx vitest run` + `cd functions && npx vitest run` + `npm run type-check`
- **Before `/gsd-verify-work`:** all three green (root at the 1-file baseline)
- **Max feedback latency:** ~30 s (targeted)

---

## Per-Task Verification Map

Requirement-level map (task IDs filled once PLAN.md files exist).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | R446 | — | N/A | guard (static scan) | `npx vitest run src/brandName.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R446 | — | N/A | component | `npx vitest run src/components/__tests__/AppSidebar.test.ts src/components/__tests__/AppShell.test.ts src/components/__tests__/ServicePrintLayout.test.ts src/views/__tests__/LoginView.test.ts src/views/__tests__/SelectChurchView.test.ts src/views/__tests__/VolunteerRequestView.test.ts src/views/__tests__/VolunteerLinkCompleteView.test.ts src/views/__tests__/ShareView.test.ts src/views/__tests__/QuarterShareView.test.ts` | ✅ (add assertions) | ⬜ pending |
| TBD | TBD | TBD | R447 | — | Email display name sanitizer untouched | unit | `cd functions && npx vitest run src/adminEmail.test.ts src/inviteOnboarding.test.ts src/volunteerLink.test.ts` | ✅ (update/add) | ⬜ pending |
| TBD | TBD | TBD | R446/R447 | — | Internal identifiers unchanged | review gate | `git diff --stat` shows no change to `package.json`, `firebase.json`, `.firebaserc`, `functions/lib` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/brandName.test.ts` — negative guard (no `Worship ?Planner` in user-facing source) + positive table (U1–U14, E1–E12 contain `WorshipBuilder`)
- Framework install: none. Never run with `--dir src` (bypasses the root excludes).

---

## Manual-Only Verifications

Batched to the v2.16 milestone-end owner UAT (PENDING, not owner-accepted).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real emails show WorshipBuilder | R447 | Needs a functions deploy + real send | After the milestone-end deploy, send yourself an invite and a volunteer sign-in link; subject/body say WorshipBuilder |
| Returning user keeps sign-in + saved settings after the rename ships | R446 | Production state | After deploy, reload the app signed in: still signed in, same church, Run monitor setup intact |
| Browser tab title | R446 | Visual | Tab reads "WorshipBuilder" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
