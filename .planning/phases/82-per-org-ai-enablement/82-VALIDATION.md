---
phase: 82
slug: per-org-ai-enablement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-24
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **App framework** | vitest 4.0.x (jsdom) — `npx vitest run` (excludes `src/rules.test.ts`, `render-service/**`) |
| **Rules framework** | `src/rules.test.ts` under the Firestore emulator — `npm run test:rules` (own emulator) or `npx vitest run --config vitest.rules.config.ts` against a running one. Rules tests are EXCLUDED from the default `npx vitest run`. |
| **Functions suite** | `cd functions && npx vitest run …` (node env) — for the new callable + AI-proxy gating |
| **Type gate** | `npm run type-check` (`vue-tsc --build`) |
| **Baseline** | app suite 2-file known-failing baseline (`storage.rules.test.ts`, `RosterView.test.ts`) |

---

## Sampling Rate

- **After every task commit:** changed test files + `npm run type-check`; rules change → rules suite under the emulator; functions change → functions suite.
- **After every plan wave:** `npx vitest run` at baseline + rules/functions suites green.
- **Before `/gsd-verify-work`:** app at baseline, type-check clean, rules + functions green.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| _planner fills rows_ | | | R242, R243 | rules / functions / component | rules-emulator / `cd functions && npx vitest run` / `npx vitest run` | ⬜ pending |

*Coverage the planner must map: R242 → rules ALLOW/DENY that a super-admin (Admin SDK) can set `aiMasterEnabled` and an org editor + a super-admin CLIENT write are DENIED (mirror the `active` lifecycle-field tests); a functions test for `setOrgAiEnabled` (super-admin gate + write + same-state short-circuit); OFF-by-default proven (absent field ⇒ AI off). R243 → a component test that the Settings "AI Features" card is hidden when the org's `aiMasterEnabled` is off; a functions test that the disable branch also writes `settings.aiEnabled:false` (forced-off, literal); and (if server gating is in scope) a functions test that the AI proxy refuses fail-closed when the master gate is off.*

---

## Wave 0 Requirements

- [ ] Rules ALLOW/DENY for `aiMasterEnabled` in the `lifecycleFields()` allow-list (R242) — `src/rules.test.ts`.
- [ ] `functions` test for the new `setOrgAiEnabled` super-admin callable incl. the disable-branch `settings.aiEnabled:false` forced-off write (R242, R243).
- [ ] Component test: Settings "AI Features" card hidden when `aiMasterEnabled` is off (R243).
- [ ] Owner Console `OrganizationsTab` per-row AI toggle test (calls the callable, reflects state) (R242).
- [ ] (If in scope) functions test: AI proxy refuses fail-closed when the org master gate is off (R243 server enforcement).

*Existing vitest + rules-emulator + functions infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Super-admin toggles a real org's AI on/off in prod; org's AI panel appears/disappears | R242, R243 | Needs deployed callable/rules + a real super-admin session + the affected member's reload | After deploy: as super-admin toggle an org's AI; as that org's member reload Settings and confirm the AI card shows/hides; confirm AI OFF for a fresh org |
| Berean re-enable after OFF-by-default cutover | R242 | Live data migration effect | After deploy, a super-admin must re-enable AI for Berean (it goes OFF by default) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
