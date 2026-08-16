---
phase: 64-composer-refinements
plan: 04
subsystem: messaging-history
tags: [R155, ui, presentation, service-messages]
requires: [ServiceMessageHistory.vue, serviceMessages.ts]
provides: [aged-queued-failed-to-send-pill]
affects: [src/components/ServiceMessageHistory.vue]
tech-stack:
  added: []
  patterns: [pure-age-helper, shared-status-derivation]
key-files:
  created: []
  modified:
    - src/components/ServiceMessageHistory.vue
    - src/components/__tests__/ServiceMessageHistory.test.ts
decisions:
  - "STUCK_THRESHOLD_MS = 300000 (5 min); age = Date.now() - createdAt.toMillis()"
  - "null createdAt is treated as NOT stuck (keep spinner) — never flash Failed on a fresh serverTimestamp sentinel"
  - "Both statusPill and sendTimeLabel call the shared isStuck() helper so the pill and time line never disagree"
  - "Copy is 'Failed to send' with NO retry action — resend-from-history is a deferred enhancement"
metrics:
  duration: ~6m
  completed: 2026-08-15
status: complete
---

# Phase 64 Plan 04: R155 History — Aged Queued "Failed to send" Summary

Killed the perpetual grey "Sending…" spinner in `ServiceMessageHistory.vue`: a `queued`/`sending`
message whose server-set `createdAt` is older than 5 minutes now surfaces the existing red
"Failed to send" pill (no spinner) instead of spinning forever; recent (< 5 min) and null-createdAt
rows keep the spinner. Read-only presentation over existing fields — no write path, no retry action.

## What changed

- Added module-level `const STUCK_THRESHOLD_MS = 5 * 60 * 1000` (300000 ms) and a pure
  `isStuck(message)` helper returning `(status === 'queued' || 'sending') && createdAt != null &&
  Date.now() - createdAt.toMillis() > STUCK_THRESHOLD_MS`. The explicit `createdAt != null` guard
  keeps a fresh serverTimestamp sentinel from flashing "Failed".
- `statusPill`: the `queued`/`sending` branch returns the `failed` red recipe verbatim
  (`bg-red-900/50 text-red-300 border-red-800`, `spinner: false`) with label `'Failed to send'`
  when `isStuck`; otherwise the unchanged grey `'Sending…'` spinner pill. `failed`/`partial`/
  `scheduled`/`sent` cases untouched.
- `sendTimeLabel`: the `sending`/`queued` branch mirrors the same age check —
  `isStuck(message) ? 'Failed to send' : 'Sending…'` — so the time line never disagrees with the pill.
- Tests: added an aged-queued (> 5 min → 'Failed to send', red, no spinner + time line agrees),
  a recent-sending (< 5 min → keeps grey spinner), and a null-createdAt guard case. The existing
  status matrix stays green because the default `makeMessage` `createdAt` is 60s ago (recent).

## Deviations from Plan

None — plan executed exactly as written.

## Deferred

- Resend-from-history / retry action is explicitly deferred (no write path added). The copy is
  "Failed to send", not "Stuck — retry"; a stuck message shows a terminal-looking state only.

## Gate output

- `npx vitest run src/components/__tests__/ServiceMessageHistory.test.ts` — **19 passed (1 file)**.
- `npm run type-check` (`vue-tsc --build`) — **clean**, no output.
- `npx vitest run` (full app suite) — **114 passed / 2 failed files**, at the known 2-file baseline:
  `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation) and
  `src/views/__tests__/RosterView.test.ts` (stale 'Roles config' assertion). No NEW failing file —
  no regression. Duration ~244s (a timeout would not be a failure).

## Commits

- `0aa6c9a` test(64-04): add failing tests for aged queued/sending 'Failed to send' pill (RED)
- `bd59a89` feat(64-04): surface aged queued/sending rows as 'Failed to send' in history (GREEN)

## Self-Check: PASSED

- `src/components/ServiceMessageHistory.vue` — FOUND (modified)
- `src/components/__tests__/ServiceMessageHistory.test.ts` — FOUND (modified)
- Commit `0aa6c9a` — FOUND
- Commit `bd59a89` — FOUND
