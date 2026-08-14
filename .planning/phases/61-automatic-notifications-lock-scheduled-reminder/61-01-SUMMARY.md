---
phase: 61-automatic-notifications-lock-scheduled-reminder
plan: 01
subsystem: functions
tags: [messaging, notifications, timezone, date-math, cloud-functions]
requires:
  - "queueServiceMessageHandler (59-02) enum gate at functions/src/index.ts:987"
  - "createQueuedMessage shaper + QueuedMessageDoc (59-02)"
  - "formatServiceDate UTC-pin precedent (functions/src/index.ts:1120-1130)"
provides:
  - "'lock-notification' MessageType (enables 61-04 client lock enqueue + 61-02 reminder send)"
  - "todayInTimeZone(timeZone, now) exported pure helper (org-local YYYY-MM-DD)"
  - "minusDays(dateYmd, n) exported pure helper (UTC-pinned calendar-day subtraction)"
affects:
  - "61-02 sendScheduledRemindersHandler (imports todayInTimeZone/minusDays by name)"
  - "61-04 client lock enqueue (depends on 'lock-notification' in MESSAGE_TYPES)"
  - "Phase 62 relock-notification (extends the same two lines)"
tech-stack:
  added: []
  patterns:
    - "Intl.DateTimeFormat('en-CA', { timeZone }) for org-local YYYY-MM-DD (Node 22 full ICU, no npm package)"
    - "UTC-pinned date arithmetic (new Date(`${ymd}T00:00:00Z`) + setUTCDate) for DST-immune calendar-day math"
    - "MessageType enum extension via BOTH union + MESSAGE_TYPES array (single validation source)"
key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts
decisions:
  - "Compute org-local date with Intl.DateTimeFormat('en-CA') — NO date library (61-RESEARCH § Timezone Feasibility; supply-chain gate avoided for a one-liner)"
  - "minusDays UTC-pins with a trailing Z so DST never shifts the calendar-day count (same discipline as formatServiceDate)"
  - "Widen the enum only — auth re-check and kill-switch re-read untouched; asserted by regression tests"
metrics:
  duration: "~5m"
  completed: 2026-08-14
  commits: 4
  tasks: 2
  files-modified: 2
status: complete
---

# Phase 61 Plan 01: Lock-Notification Type + Org-Local Date Primitives Summary

Added `'lock-notification'` to the `MessageType` union + `MESSAGE_TYPES` validation array so `queueServiceMessage` accepts the automatic lock email without touching its auth/kill-switch gates, and added two exported pure helpers — `todayInTimeZone(timeZone, now)` (org-local `YYYY-MM-DD` via `Intl.DateTimeFormat('en-CA')`, no npm package) and `minusDays(dateYmd, n)` (UTC-pinned, DST-immune calendar-day subtraction) — that the 61-02 reminder cron will import by name.

## What Was Built

### Task 1 — `'lock-notification'` MessageType
- Appended `"lock-notification"` to the `MessageType` union (`functions/src/index.ts:832`) and to the `MESSAGE_TYPES: readonly MessageType[]` array. The enum gate at `:987` reads `MESSAGE_TYPES.includes(type)`, so the new value is accepted with no gate edit; `createQueuedMessage` and `QueuedMessageDoc.type` are typed off `MessageType` and picked it up with zero further edits.
- Left a doc comment noting Phase 62 extends the same two lines for `'relock-notification'`.
- Tests (extended the existing `queueServiceMessageHandler` describe block, reusing its fake-org fixture and `.set` spy): an editor with messaging on enqueues one `'lock-notification'` doc (`status: 'queued'`) and returns `{ messageId }`; an unknown type still throws `invalid-argument`; a viewer sending `'lock-notification'` still gets `permission-denied`; a kill-switch-off editor still gets `failed-precondition`. These prove the enum widened without loosening V4/V5.

### Task 2 — `todayInTimeZone` + `minusDays`
- `export function todayInTimeZone(timeZone, now = new Date()): string` — `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day }).format(now)`, yielding `YYYY-MM-DD` directly. No package (Node 22 full ICU).
- `export function minusDays(dateYmd, n): string` — UTC-pins `new Date(`${dateYmd}T00:00:00Z`)`, `setUTCDate(getUTCDate() - n)`, returns `toISOString().slice(0, 10)`. The `Z` makes it a pure calendar-day count immune to DST.
- Both placed near `formatServiceDate` (pure region, above the send helpers); no Firestore/firebase-admin dependency.
- Tests: `America/Chicago` and `Pacific/Kiritimati` diverge on the same UTC instant (`2026-08-14T04:30:00Z` → `2026-08-13` vs `2026-08-14`, the R133 boundary); `Asia/Tokyo` yields a 10-char ISO-ordered string; `minusDays('2026-08-14', 7) === '2026-08-07'`; DST-week subtraction (`minusDays('2026-03-09', 1) === '2026-03-08'`, `minusDays('2026-03-15', 7) === '2026-03-08'`).

## Deviations from Plan

None — plan executed exactly as written. Two exports, one enum member, tests only in `functions/src/index.test.ts`; no package installed, nothing deployed, no secret set.

## TDD Gate Compliance

Both tasks followed RED → GREEN. Git log shows `test(61-01)` then `feat(61-01)` for each (four commits total). No REFACTOR needed.

## Verification Results

- `cd functions && npx vitest run src/index.test.ts` — 123 passed (1 file).
- `cd functions && npm run build` (tsc) — clean, no output.
- `cd functions && npm test` (full functions suite) — 224 passed (8 files).
- `npx vitest run` (root app suite) — touches only `functions/`; expected to stay at the CLAUDE.md 2-file known-failing baseline (`src/storage.rules.test.ts` env limitation, `src/views/__tests__/RosterView.test.ts` stale assertion). Root run exceeds the Bash timeout — a timeout is not a failure per plan.

## Threat Mitigations Applied

- T-61-01a (Elevation): enum widened only; auth re-check + kill-switch re-read untouched — asserted by viewer→permission-denied and kill-switch-off→failed-precondition tests.
- T-61-01b (Timezone correctness): `todayInTimeZone` org-local via `Intl`; `minusDays` UTC-pinned — asserted by two-zone divergence + DST-week tests.
- T-61-01c (Input validation): enum gate unchanged; unknown type still `invalid-argument`.
- T-61-SC: zero packages installed.

## Self-Check: PASSED

- functions/src/index.ts — FOUND (lock-notification, todayInTimeZone, minusDays present)
- functions/src/index.test.ts — FOUND (new tests present, green)
- Commits 26f0e5e6, 901fd9c5, 696f2f61, 096a7800 — FOUND in git log
