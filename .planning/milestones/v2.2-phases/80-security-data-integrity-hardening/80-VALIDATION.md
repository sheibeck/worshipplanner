---
phase: 80
slug: security-data-integrity-hardening
status: planned
nyquist_compliant: true
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
| 80-01-T1 | 80-01 | 1 | R232 | T-80-01 | inviteLookup create gated to target-org editor; non-editor + mismatched-orgId DENY; invite→first-login acceptance (Test B/D) re-confirmed green | rules/emulator ALLOW+DENY+regression | `npm run test:rules` (or `npx vitest run --config vitest.rules.config.ts -t "inviteLookup\|Members create"`) | ✅ src/rules.test.ts (new describe) | ⬜ pending |
| 80-01-T2 | 80-01 | 1 | R233 | T-80-02 | org createdBy immutable on update: DENY createdBy-change, ALLOW ordinary edit; existing editor-edit regression adjusted to preserve createdBy | rules/emulator DENY+ALLOW | `npm run test:rules` (or `npx vitest run --config vitest.rules.config.ts -t "createdBy\|write org doc"`) | ✅ src/rules.test.ts (new cases) | ⬜ pending |
| 80-01-T3 | 80-01 | 1 | R232, R233 | — | rules ship UNDEPLOYED; exact `firebase deploy --only firestore:rules` hand-over recorded | doc gate | `grep -c "firebase deploy --only firestore:rules" .planning/PENDING-VERIFICATION.md` | ✅ .planning/PENDING-VERIFICATION.md | ⬜ pending |
| 80-02-T1 | 80-02 | 1 | R234 | T-80-04, T-80-05 | deleteService revokes all three share artifacts (shareTokens query incl. multiple; serviceShareLinks; serviceShares), existence-guarded; never-shared service deletes without throw | unit (mocked Firestore) | `npx vitest run src/stores/__tests__/services.test.ts -t "deleteService"` | ✅ src/stores/__tests__/services.test.ts | ⬜ pending |
| 80-02-T2 | 80-02 | 1 | R234 | — | revocation block is type-clean and non-regressing | type + unit | `npm run type-check && npx vitest run src/stores/__tests__/services.test.ts` | ✅ existing | ⬜ pending |
| 80-03-T1 | 80-03 | 1 | R235 | T-80-06 | rebuildSongGroup clears a removed song's slides (reprise-safe, idempotent); bug-lock test at ~686-694 REWRITTEN; two-slot reprise-independence probe added | unit (pure fn) | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` | ✅ slideGroupMaterializer.test.ts (rewrite + new) | ⬜ pending |
| 80-03-T2 | 80-03 | 1 | R236 | T-80-07 | pending renderState shows amber aria-live notice + disables customization (canMutate AND canMutateBackground); pending-render wins over serviceLocked; ready-state unchanged | component | `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts && npm run type-check` | ✅ EditSlideDrawer.test.ts (new cases) | ⬜ pending |

*Coverage: R232 → ALLOW/DENY rules tests + existing invite-acceptance regressions (Test B/D) re-confirmed green (80-01-T1); R233 → ALLOW normal-edit / DENY createdBy-change, existing editor-edit regression adjusted to preserve createdBy (80-01-T2); R234 → unit test that deleteService revokes all three share-artifact types incl. multi-shareTokens + never-shared no-throw (80-02-T1); R235 → `slideGroupMaterializer.test.ts:686-694` bug-lock test REWRITTEN to assert reprise-safe clear-on-removal, + idempotence + two-slot reprise probe (80-03-T1); R236 → component test that a pending renderState warns/disables customization incl. background (80-03-T2).*

---

## Wave 0 Requirements

- [ ] Rules ALLOW/DENY cases for `inviteLookup` create-gate (R232) in `src/rules.test.ts`; re-confirm the existing invite→first-login acceptance regressions still pass. → **80-01-T1**
- [ ] Rules ALLOW/DENY cases for org `createdBy` immutability on update (R233). → **80-01-T2**
- [ ] Unit test: `deleteService` share-artifact revocation across `shareTokens` (query, multiple) / `serviceShareLinks` / `serviceShares` (R234). → **80-02-T1**
- [ ] Rewrite `slideGroupMaterializer.test.ts:686-694` (Phase 30 W-03 bug-lock) to assert the fixed clear-on-removal behavior (R235); + idempotence + two-slot reprise-independence probe (the one true Wave 0 gap). → **80-03-T1**
- [ ] Component test: `EditSlideDrawer.vue` pending-render warn/disable, incl. the `canMutateBackground` gate (R236). → **80-03-T2**

*All target test files already exist with established fixtures/helpers; every Wave 0 item is a new `it()` inside an existing `describe` block (or a rewrite of an existing case), created inside its owning implementation task — no separate scaffold task, no new framework/config work. `nyquist_compliant: true` (every task has an `<automated>` verify command); `wave_0_complete` flips to true once execution lands these tests.*

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
