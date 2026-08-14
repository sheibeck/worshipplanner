---
phase: 60
slug: delivery-history-bounce-webhook
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling. Full per-requirement/per-invariant test design lives
> in `60-RESEARCH.md` § Validation Architecture — this file is the execution-time sampling contract the
> planner's tasks map onto. TWO suites (app/jsdom + functions/node); sampling is per-suite. The webhook is
> the milestone's new unauthenticated trust boundary — its security invariants carry the heaviest tests.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Client framework** | vitest (app suite, jsdom) — `vite.config.ts` |
| **Functions framework** | vitest (functions suite, **node** env) — `functions/vitest.config.ts` |
| **Client quick run** | `npx vitest run <file>` |
| **Functions quick run** | `cd functions && npm test` (scope with `... -- src/index.test.ts`) |
| **Full app suite** | `npx vitest run` (2-file known-failing baseline: `storage.rules.test.ts`, `RosterView.test.ts`) |
| **Client type gate** | `npm run type-check` (vue-tsc --build; NOT `-p tsconfig.app.json`) |
| **Functions type gate** | `cd functions && npm run build` (= `tsc`) |
| **Estimated runtime** | client scoped ~5–20s; functions scoped ~5–15s |

> ⚠ The `messageWebhook` handler tests live in the **functions** suite. `firebase-functions/v2/https` is NOT
> mocked (the handler is tested directly); the `getFirestore` fake must be extended with `runTransaction`
> and (for the fallback) `collectionGroup`, and the bounce count is written as a literal inside the
> transaction (the FieldValue mock exposes only `serverTimestamp`). NO deploy this phase.

---

## Sampling Rate

- **After every task commit:** the scoped quick run for the suite that task touched.
- **After every plan wave:** BOTH `npx vitest run` + `cd functions && npm test`, and both type gates
  (`npm run type-check` + `cd functions && npm run build`).
- **Before `/gsd-verify-work`:** app suite at baseline, functions suite green, both type gates clean.
- **Max feedback latency:** ~20s per suite.

---

## Per-Task Verification Map

> Seeded here; the gsd-planner populates one row per task. Derived from `60-RESEARCH.md` § Validation
> Architecture (R142, R143) + the webhook security invariants.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills)_ | | | R143 | verify-first | HMAC over rawBody; bad/missing sig → 401, ZERO Firestore access | unit (functions) | `cd functions && npm test` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R143 | idempotent-count | duplicate bounce event → status bounced once, deliveryCounts.bounced == 1 | unit (functions) | `cd functions && npm test` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R143 | addressing | tags primary + providerMessageId collectionGroup fallback resolve the right recipient | unit (functions) | `cd functions && npm test` | ❌ W0 | ⬜ pending |
| _(planner fills)_ | | | R142/R143 | read-only history | panel lists messages (type/count/time); bounce indicator + fix-address deep link | unit (client) | `npx vitest run src/components/__tests__/ServiceMessageHistory.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `functions/src/webhookSignature.ts` (or inline) — pure `node:crypto` Svix HMAC verifier + its test
      (valid, tampered, missing header, wrong length, stale timestamp, multiple `v1,` sigs)
- [ ] `functions/src/index.test.ts` — new `messageWebhook` handler tests (verify-first zero-write on bad
      sig; idempotent duplicate; tags path + providerMessageId fallback); extend the `getFirestore` fake
      with `runTransaction`/`collectionGroup`
- [ ] `src/components/__tests__/ServiceMessageHistory.test.ts` — new (list render, empty/loading, bounce
      expand, fix-address link)
- [ ] Any new store read for the service `messages`/`recipients` subcollection — test alongside its store

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real hard bounce flips the history to "bounced" | R143 | Requires deployed webhook + Resend dashboard webhook config + a real bounce | OWNER: after deploy + `RESEND_WEBHOOK_SECRET` set + webhook URL configured, send to an invalid address; confirm the history shows the bounce |
| The "Sent on this service" panel matches the design + lists sends | R142 | Visual/interaction judgment | Open a service that has sent messages; compare to DESIGN-messaging.md §5b; verify type/count/time |
| Fix-address deep link opens the right roster person | R143 | Full-app navigation | Click "Fix email" on a bounced recipient; confirm it lands on that person in the roster |

> These route to `verification_deferred_human` (owner at `/gsd-verify-work 60`), PLUS the owner deploy/secret/
> webhook-URL setup. All webhook LOGIC + signature verification + idempotency + panel rendering are automated.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s per suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
