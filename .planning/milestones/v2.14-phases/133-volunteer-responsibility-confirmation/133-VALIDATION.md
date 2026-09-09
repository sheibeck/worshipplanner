---
phase: 133
slug: volunteer-responsibility-confirmation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-07
---

# Phase 133 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from
> `133-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (app suite) + `firebase emulators:exec` (rules suite) — both already configured |
| **Config file** | `vite.config.ts` (app), `vitest.rules.config.ts` (rules) |
| **Quick run command** | `npx vitest run src/utils/__tests__/confirmations.test.ts src/utils/__tests__/messagingRecipients.test.ts` |
| **Full suite command** | `npx vitest run` (app; baseline failing file = `src/storage.rules.test.ts` only) + `npm run test:rules` (rules; or `npx vitest run --config vitest.rules.config.ts` against a running emulator per CLAUDE.md) |
| **Estimated runtime** | app ~6 min · rules ~30–60 s |

---

## Sampling Rate

- **After every task commit:** run the quick command (pure-function + targeted rules file).
- **After every plan wave:** `npx vitest run` (full app) + `npm run test:rules`.
- **Before `/gsd-verify-work` (phase gate):** both full suites green, plus `npm run type-check`
  (`vue-tsc --build`, not `-p tsconfig.app.json`).
- **Max feedback latency:** ~60 s (quick), ~6 min (full).

---

## Per-Requirement Verification Map

| Req | Plan | Wave | Threat Ref | Secure Behavior | Test Type | Automated Command |
|-----|------|------|-----------|-----------------|-----------|-------------------|
| R410 | 133-01 | 1 | T-133-01..06 | Volunteer writes ONLY own confirmation doc for a service they're assigned to; cross-tenant/cross-service/other-volunteer writes DENIED; no plan/order/roster mutation | rules ALLOW/DENY (12 cases) + unit | `npx vitest run --config vitest.rules.config.ts` + `npx vitest run src/utils/__tests__/confirmations.test.ts` |
| R410 | 133-02 | 2 | T-133-07..09 | "I've got it" writes the caller's own confirmation only; un-confirm (delete) allowed | component | `npx vitest run src/views/__tests__/VolunteerServiceView*.test.ts` |
| R411 | 133-03 | 2 | T-133-10..11 | Roster status chip reflects live confirmation via `onSnapshot` (no one-time `getDoc`/`getDocs` in display path) | component (fake onSnapshot) | `npx vitest run src/views/__tests__/ServiceEditorView*.test.ts` |
| R412 | 133-01/04 | 1/2 | T-133-12..15 | Relock flips ONLY stale `confirmed`→`needsReconfirmation`; unchanged assignment keys untouched (no full-collection rewrite) | unit | `npx vitest run src/stores/__tests__/services.test.ts` + `src/utils/__tests__/confirmations.test.ts` |
| R413 | 133-05 | 2 | T-133-16..18 | `unconfirmedOnly` re-resolved AUTHORITATIVELY server-side (Admin SDK reads `confirmations`), client preview never trusted | unit (client + server ports) | `npx vitest run src/utils/__tests__/messagingRecipients.test.ts` + `cd functions && npm test -- serviceRoles.test.ts` |

---

## Wave 0 Requirements (test scaffolding to create before/with implementation)

- [ ] `src/rules.test.ts` — new `confirmations` subcollection describe block covering all 12 ALLOW/DENY cases.
- [ ] `src/utils/__tests__/confirmations.test.ts` — pure-model tests (`confirmationKey`, `computeValidConfirmationKeys`, reconcile logic).
- [ ] `src/stores/__tests__/services.test.ts` — new describe block for the relock reconciliation (fixture: a pre-existing `confirmed` doc whose `roleId` is dropped from the next relock's resolved assignments).
- [ ] `src/utils/__tests__/messagingRecipients.test.ts` — create if absent (grep found none); mirror `serviceRoles.test.ts` convention; add `unconfirmedOnly` coverage.
- [ ] `functions/src/serviceRoles.test.ts` — server-side `unconfirmedOnly` mirror test.

---

## Manual-Only Verifications (deferred to milestone-end UAT)

- Visual: the "I've got it" control on the volunteer surface and the roster status chips read correctly and
  update live in a real browser (batched to `.planning/v2.14-DEFERRED-VERIFICATION.md`).
- Live rules behavior against the deployed backend (rules deploy is owner-gated).
