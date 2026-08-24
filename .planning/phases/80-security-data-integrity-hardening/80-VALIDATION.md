---
phase: 80
slug: security-data-integrity-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-24
---

# Phase 80 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **App framework** | vitest 4.0.x (jsdom) — `npx vitest run` (excludes `src/rules.test.ts`, `render-service/**`) |
| **Rules framework** | `src/rules.test.ts` under the Firestore emulator — run via `npm run test:rules` (its own emulator) OR, if an emulator is already up, `npx vitest run --config vitest.rules.config.ts`. NOTE (CLAUDE.md): rules tests are EXCLUDED from the default `npx vitest run` — a bare run does NOT prove rules. |
| **Type gate** | `npm run type-check` (`vue-tsc --build`) |
| **Baseline** | app suite 2-file known-failing baseline (`storage.rules.test.ts`, `RosterView.test.ts`) |
| **Estimated runtime** | app ~60–120s; rules suite ~30–60s under emulator |

---

## Sampling Rate

- **After every task commit:** changed test files + `npm run type-check`; for a rules change, the rules suite under the emulator.
- **After every plan wave:** `npx vitest run` at baseline + the rules suite green.
- **Before `/gsd-verify-work`:** app suite at baseline, type-check clean, rules suite green.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _planner fills rows_ | | | R232–R236 | T-80-* | see below | rules / unit / component | rules-emulator / `npx vitest run …` | — | ⬜ pending |

*The planner MUST map: R232 → ALLOW/DENY rules tests + the existing invite-acceptance regressions (rules.test.ts Test B/D) re-confirmed green; R233 → ALLOW normal-edit / DENY createdBy-change rules tests; R234 → unit test that deleteService deletes all three share-artifact types incl. multi-shareTokens; R235 → the `slideGroupMaterializer.test.ts:686-694` bug-locking test REWRITTEN to assert slides are cleared on song removal (reprise-safe); R236 → component test that a pending renderState warns/disables customization.*

---

## Wave 0 Requirements

- [ ] Rules ALLOW/DENY cases for `inviteLookup` create-gate (R232) in `src/rules.test.ts`; re-confirm the existing invite→first-login acceptance regressions still pass.
- [ ] Rules ALLOW/DENY cases for org `createdBy` immutability on update (R233).
- [ ] Unit test: `deleteService` share-artifact revocation across `shareTokens` (query, multiple) / `serviceShareLinks` / `serviceShares` (R234).
- [ ] Rewrite `slideGroupMaterializer.test.ts:686-694` (Phase 30 W-03 bug-lock) to assert the fixed clear-on-removal behavior (R235).
- [ ] Component test: `EditSlideDrawer.vue` pending-render warn/disable (R236).

*Existing vitest + rules-emulator infrastructure otherwise covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deployed rules behave in prod (self-invite blocked; createdBy immutable) | R232, R233 | Needs the owner-run `firebase deploy --only firestore:rules` + a real session | After deploy: attempt a forged inviteLookup create as a non-editor (expect deny); attempt an editor createdBy rewrite (expect deny) |
| Deleted service's real share URL no longer resolves | R234 | Live share link + browser | Share a service, delete it, open the old link — expect it dead |
| Pending-slide warning during a real PPTX render | R236 | Live async render timing | Import a deck, open EditSlideDrawer on a still-rendering slide, confirm the warning + disabled customization |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
