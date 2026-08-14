---
phase: 60
slug: delivery-history-bounce-webhook
status: planned
nyquist_compliant: true
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
| 60-01-T1 | 01 | 1 | R143 | T-60-01a/b/c/d (verify-first, replay, timing) | Pure Svix HMAC verifier over rawBody: valid→true; tampered/missing-header/wrong-length(no-throw)/stale-timestamp→false; multi-`v1,` accepts a match; whsec_ base64 decode | unit (functions) | `cd functions && npx vitest run src/webhookSignature.test.ts` | ❌ W0 | ⬜ pending |
| 60-01-T2 | 01 | 1 | R143 | T-60-02a (addressing) | recipients.providerMessageId COLLECTION_GROUP index present + JSON well-formed (enables 60-02 fallback query; deploy-gated) | config | `node -e "…firestore.indexes.json fieldOverride assertion…"` | ❌ W0 | ⬜ pending |
| 60-02-T1 | 02 | 2 | R143 | T-60-02a/c (addressing, idempotent-count) | resolveRecipientRef tags-primary + providerMessageId collectionGroup fallback (null on miss); recordBounce transition-guarded literal count → duplicate delivery keeps deliveryCounts.bounced == 1 | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ❌ W0 | ⬜ pending |
| 60-02-T2 | 02 | 2 | R143 | T-60-02a/b/d/f (verify-first) | HMAC over req.rawBody FIRST; bad/missing/stale sig → 401 (malformed→400) with ZERO Firestore access (getFirestore never called); soft/complaint/delivered/unresolvable → 200 no write | unit (functions) | `cd functions && npx vitest run src/index.test.ts` | ❌ W0 | ⬜ pending |
| 60-03-T1 | 03 | 1 | R142 | T-60-03b (read-only history) | serviceMessages store: single-listener nested subscribe to services/{id}/messages newest-first (missing bounced→0); lazy status=='bounced' recipients read (no client collectionGroup) | unit (client) | `npx vitest run src/stores/__tests__/serviceMessages.test.ts` | ❌ W0 | ⬜ pending |
| 60-03-T2 | 03 | 1 | R142/R143 | T-60-03a (read-only history) | Panel lists messages (type badge / count / send time / status pills); red bounce indicator + expand to bounced recipients (reason) + Fix email deep-link; empty/loading/error; 0/1/many pluralization | unit (client) | `npx vitest run src/components/__tests__/ServiceMessageHistory.test.ts` | ❌ W0 | ⬜ pending |
| 60-03-T3 | 03 | 1 | R142/R143 | T-60-03c/d (read-only history) | Panel mounted below defaults panel, HIDDEN when messaging off / non-editor (kill-switch v-if); RosterView ?edit={personId} opens the person's edit form with an unknown-id/no-query fallback | unit (client) + typecheck | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/views/__tests__/RosterViewEditQuery.test.ts && npm run type-check` | ❌ W0 | ⬜ pending |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (7 tasks across 60-01/60-02/60-03, each with an `<automated>` command; Wave-0 test scaffolds created in-plan)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has an automated gate)
- [x] Wave 0 covers all MISSING references (webhookSignature.test.ts, index.test.ts webhook describe + getFirestore fake extension, serviceMessages.test.ts, ServiceMessageHistory.test.ts, RosterViewEditQuery.test.ts, firestore.indexes.json)
- [x] No watch-mode flags (all `vitest run`, one-shot)
- [x] Feedback latency < 20s per suite (client scoped ~5–20s; functions scoped ~5–15s)
- [x] `nyquist_compliant: true` set in frontmatter

**Plan/wave map:** 60-01 (W1, verifier + collection-group index) · 60-03 (W1, client history panel — independent) · 60-02 (W2, messageWebhook handler — depends on 60-01's verifier + index). Worktrees disabled → executed sequentially.

**Approval:** planner-complete; awaiting execution.
