---
phase: 60-delivery-history-bounce-webhook
plan: 01
subsystem: api
tags: [webhook, svix, hmac, node-crypto, firestore-index, resend, security]

# Dependency graph
requires:
  - phase: 59-messaging-send
    provides: "recipients/{id}.providerMessageId (Resend data.id) and tags array sent at send time — the addressing keys the webhook resolves against"
provides:
  - "verifySvixSignature(rawBody, headers, secret, toleranceSec) — pure, exported, dependency-free node:crypto Svix HMAC-SHA256 verifier (functions/src/webhookSignature.ts)"
  - "REPLAY_TOLERANCE_SEC=300 named constant (tagged confirm-against-real-event)"
  - "recipients.providerMessageId COLLECTION_GROUP fieldOverride in firestore.indexes.json (deploy-gated) enabling 60-02's addressing fallback"
affects: [60-02, messageWebhook, bounce-handling, addressing-fallback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure/exported signature-verify split: the trust-boundary primitive is a dependency-free function unit-testable in isolation, called BEFORE any Firestore access (research Pattern 4)"
    - "Length-guarded crypto.timingSafeEqual: a wrong-length candidate is a clean false, never a throw/500 (Pitfall 2)"
    - "Space-delimited multi-v1 signature header accepted on ANY match (key rotation)"

key-files:
  created:
    - functions/src/webhookSignature.ts
    - functions/src/webhookSignature.test.ts
  modified:
    - firestore.indexes.json

key-decisions:
  - "Verify manually with node:crypto — NO svix npm package (locked default, avoids the package-legitimacy gate for ~30 lines)"
  - "REPLAY_TOLERANCE_SEC=300 (Svix library default) as a named [ASSUMED] constant to confirm against a real Resend event"
  - "Collection-group index shipped UNDEPLOYED; firebase deploy --only firestore:indexes is an owner step in PENDING-VERIFICATION.md"

patterns-established:
  - "Pattern: trust-boundary verifier is pure + exported so 60-02 imports verifySvixSignature by name and calls it first-thing"
  - "Pattern: test helper reuses the identical whsec_+base64+HMAC-SHA256 steps so the 'valid' branch is genuinely valid (research A5)"

requirements-completed: [R143]

coverage:
  - id: D1
    description: "Pure Svix HMAC-SHA256 verifier: a genuinely-valid v1 signature over the raw body returns true; every failure mode (missing/blank header, tampered body, wrong-length candidate, stale/non-finite timestamp) returns false and never throws; multi-v1 header accepts any matching entry; whsec_ base64 secret decode path"
    requirement: "R143"
    verification:
      - kind: unit
        ref: "functions/src/webhookSignature.test.ts (15 tests) via `cd functions && npx vitest run src/webhookSignature.test.ts`"
        status: pass
    human_judgment: false
  - id: D2
    description: "REPLAY_TOLERANCE_SEC (±300s / 5 min) is the correct window for real Resend events"
    verification: []
    human_judgment: true
    rationale: "The 5-min window is the Svix library default [ASSUMED] — only a real Resend event log at owner verification can confirm legitimate events are not rejected (research A1 / Open Question 1)."
  - id: D3
    description: "firestore.indexes.json declares the recipients.providerMessageId COLLECTION_GROUP index so 60-02's collectionGroup fallback query does not throw FAILED_PRECONDITION once deployed"
    requirement: "R143"
    verification:
      - kind: unit
        ref: "node -e assertion (fieldOverride present, COLLECTION_GROUP scope present, well-formed JSON)"
        status: pass
      - kind: manual_procedural
        ref: "owner: firebase deploy --only firestore:indexes (PENDING-VERIFICATION.md)"
        status: unknown
    human_judgment: true
    rationale: "The index is shipped UNDEPLOYED by the v1.7 grant; only the owner deploy + Enabled-in-console confirmation proves the fallback query resolves in production."

# Metrics
duration: 9min
completed: 2026-08-14
status: complete
---

# Phase 60 Plan 01: Webhook Signature Verifier + Addressing-Fallback Index Summary

**Pure, exported node:crypto Svix HMAC-SHA256 verifier (`verifySvixSignature`) with length-guarded timing-safe compare, key-rotation multi-`v1,` support, and a ±300s replay window, plus the deploy-gated `recipients.providerMessageId` collection-group index — no npm dependency, nothing deployed.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-08-14T17:35:46Z
- **Completed:** 2026-08-14T17:45:07Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 edited)

## Accomplishments
- `functions/src/webhookSignature.ts` — a pure, dependency-free (`node:crypto` only) `verifySvixSignature(rawBody, headers, secret, toleranceSec)` implementing the CONFIRMED Svix scheme byte-for-byte: `whsec_`-strip + base64-decode key bytes, signed content `` `${svix-id}.${svix-timestamp}.${rawBody}` ``, HMAC-SHA256 → base64, space-delimited multi-`v1,` header accepted on ANY match, length-guarded `crypto.timingSafeEqual`, and a `REPLAY_TOLERANCE_SEC=300` named/tagged constant. Returns a boolean and never throws on bad input.
- `functions/src/webhookSignature.test.ts` — 15 tests over every behavior row with a self-consistent `svixHeadersFor` helper that signs fixtures with the same algorithm (so "valid" is genuinely valid), including explicit `not.toThrow()` assertions for the wrong-length and missing-header cases.
- `firestore.indexes.json` — added the `recipients.providerMessageId` COLLECTION_GROUP single-field `fieldOverride` (kept both `indexes` and `fieldOverrides` top-level keys; `indexes` stays `[]`), enabling 60-02's `collectionGroup('recipients').where('providerMessageId','==', …)` addressing fallback once deployed.

## Task Commits

1. **Task 1 (RED): failing tests for the verifier** - `2c3dd98` (test)
2. **Task 1 (GREEN): Svix HMAC verifier** - `3c319fc` (feat)
3. **Task 2: recipients.providerMessageId collection-group index** - `71dac78` (feat)

_TDD: Task 1 = test → feat (no refactor needed; implementation was clean on first pass)._

## Gate Output (verbatim key lines)

- **Verifier unit test** (`cd functions && npx vitest run src/webhookSignature.test.ts`):
  `Test Files  1 passed (1)` / `Tests  15 passed (15)`
- **Functions build** (`cd functions && npm run build` = `tsc`): exit 0, clean (no output).
- **Full functions suite** (`cd functions && npm test`):
  `Test Files  8 passed (8)` / `Tests  193 passed (193)`
- **Root app suite** (`npx vitest run`):
  `Test Files  2 failed | 109 passed (111)` / `Tests  13 failed | 3410 passed (3423)` — the 2 failing files are EXACTLY the CLAUDE.md known baseline (`src/storage.rules.test.ts` — Storage-emulator cross-service `firestore.exists()` limitation + no emulator up; `src/views/__tests__/RosterView.test.ts` — stale "Roles config" assertion). No NEW failing file → regression-free. The new functions test lives under `functions/src/` and is not collected by the root jsdom run.
- **Indexes assertion** (`node -e "…"`):
  `recipients.providerMessageId collection-group index present and JSON well-formed`

## Files Created/Modified
- `functions/src/webhookSignature.ts` - Pure node:crypto Svix HMAC-SHA256 verifier + `REPLAY_TOLERANCE_SEC`.
- `functions/src/webhookSignature.test.ts` - 15-test suite; self-consistent signing helper.
- `firestore.indexes.json` - Added the deploy-gated `recipients.providerMessageId` COLLECTION_GROUP fieldOverride.

## Decisions Made
- Manual `node:crypto` verification over the `svix` package (locked default; the scheme is ~30 lines and fully documented, and adding a functions-only package would trip the full legitimacy gate for no benefit).
- `REPLAY_TOLERANCE_SEC=300` as a named, `[ASSUMED]`-tagged constant (Svix library default) to be confirmed against a real Resend event.
- Collection-group index ships UNDEPLOYED; the `firebase deploy --only firestore:indexes` is routed to the owner in PENDING-VERIFICATION.md (not marked passed).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The root app suite exceeded the default 2-minute Bash timeout on the first run (the full jsdom suite takes ~237s); re-ran with an extended timeout and it completed at the expected 2-file baseline. Not a regression.

## User Setup Required
**Owner pre-deploy steps recorded in `.planning/PENDING-VERIFICATION.md` (NOT marked passed):**
- `firebase deploy --only firestore:indexes` — build the `recipients.providerMessageId` collection-group index (must reach **Enabled** in the console before 60-02's fallback query runs live).
- Confirm `REPLAY_TOLERANCE_SEC` (±5 min) against a real Resend event at `/gsd-verify-work 60`; loosen the named constant if legitimate events are rejected.
- (60-02) `firebase functions:secrets:set RESEND_WEBHOOK_SECRET`, `firebase deploy --only functions:messageWebhook`, and Resend dashboard webhook-URL + signing-secret config — handed over when 60-02's `messageWebhook` lands.

## Next Phase Readiness
- `verifySvixSignature` is exported and ready for 60-02's `messageWebhookHandler` to import by name and call BEFORE any Firestore access.
- The addressing-fallback index exists in `firestore.indexes.json`, so 60-02's `collectionGroup('recipients').where('providerMessageId','==', data.email_id)` is a real fallback (pending owner deploy), not a stub.
- No secret set, no deploy, no `.env.local` change this plan (v1.7 grant honored).

## Self-Check: PASSED
- `functions/src/webhookSignature.ts` — FOUND
- `functions/src/webhookSignature.test.ts` — FOUND
- `firestore.indexes.json` (recipients.providerMessageId fieldOverride) — FOUND
- Commit `2c3dd98` (test) — FOUND
- Commit `3c319fc` (feat verifier) — FOUND
- Commit `71dac78` (feat index) — FOUND

---
*Phase: 60-delivery-history-bounce-webhook*
*Completed: 2026-08-14*
