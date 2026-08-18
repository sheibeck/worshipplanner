---
phase: 62-relock-change-notice-scoped-diff
plan: 01
subsystem: functions/messaging
tags: [functions, messaging, send-path, audit-trail, enum]
requires:
  - "queueServiceMessage callable + createQueuedMessage shaper (Phase 59)"
  - "lock-notification enum precedent (Phase 61)"
provides:
  - "'relock-notification' accepted by the queueServiceMessage enum gate"
  - "changeDiff widened to ChangeEntry[] | null, threaded request -> handler -> shaper"
  - "functions-local ChangeEntry interface { type; description; affectedTeams }"
affects:
  - "62-03 modal Send (depends on 'relock-notification' in MESSAGE_TYPES)"
  - "62-04 re-lock enqueue (depends on the changeDiff audit field)"
tech-stack:
  added: []
  patterns:
    - "Optional/nullable field normalized `?? null` in the shaper (Firestore rejects undefined)"
    - "Enum extension via BOTH the union member and the readonly array; gate reads MESSAGE_TYPES.includes"
key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts
key-decisions:
  - "ChangeEntry is a functions-LOCAL interface; affectedTeams stays string[] (no shared package, no RoleGroup import)"
  - "changeDiff is optional on QueueMessageRequest and deliberately NOT in the required-field guard, so absence never throws"
requirements-completed: [R146, R148]
coverage:
  - deliverable: "queueServiceMessage accepts type:'relock-notification' (editor + kill-switch on) and still rejects unknown types / non-editor / kill-switch-off"
    verification:
      - kind: test
        ref: "functions/src/index.test.ts#enqueues a type:'relock-notification' from an editor with messaging on"
        status: pass
      - kind: test
        ref: "functions/src/index.test.ts#still rejects an unknown type after the relock-notification enum add"
        status: pass
      - kind: test
        ref: "functions/src/index.test.ts#still rejects a viewer sending 'relock-notification'"
        status: pass
      - kind: test
        ref: "functions/src/index.test.ts#still rejects 'relock-notification' when the kill-switch is off"
        status: pass
    human_judgment: false
  - deliverable: "createQueuedMessage / handler persist a provided changeDiff array and write null when absent (every other type byte-unchanged)"
    verification:
      - kind: test
        ref: "functions/src/index.test.ts#persists a provided changeDiff array as the audit trail"
        status: pass
      - kind: test
        ref: "functions/src/index.test.ts#normalizes an absent changeDiff to null"
        status: pass
      - kind: test
        ref: "functions/src/index.test.ts#threads a changeDiff array into the messages/{id} doc for a relock-notification enqueue"
        status: pass
      - kind: test
        ref: "functions/src/index.test.ts#writes changeDiff:null for an ordinary enqueue that provides no changeDiff"
        status: pass
    human_judgment: false
duration: 6 min
completed: 2026-08-14
status: complete
---

# Phase 62 Plan 01: Functions send-path plumbing for the re-lock notice Summary

Added `'relock-notification'` to the `queueServiceMessage` type enum and widened the message `changeDiff` field from a hard-coded `null` to `ChangeEntry[] | null`, threaded through the callable request, handler, and shared shaper so a re-lock notice persists its scoped-diff audit trail while every other message type stays byte-identical.

## Accomplishments

- **`'relock-notification'` enum add (R146):** appended the literal to BOTH the `MessageType` union and the `MESSAGE_TYPES` readonly array (`functions/src/index.ts`). The `MESSAGE_TYPES.includes(type)` gate now admits it with no gate edit — exactly the extension point the pre-authorizing comment anticipated. The editor re-check and kill-switch re-read are untouched.
- **`changeDiff` widening (R148):** declared a functions-local `ChangeEntry` interface `{ type: string; description: string; affectedTeams: string[] }`; widened `QueuedMessageDoc.changeDiff` to `ChangeEntry[] | null`; added an OPTIONAL `changeDiff?: ChangeEntry[] | null` to `QueueMessageRequest`; shaped `input.changeDiff ?? null` in `createQueuedMessage`; and threaded `changeDiff` through the handler destructure into the enqueue call. It is deliberately kept out of the required-field guard so its absence never throws.
- **No-regression guarantee:** because the field is optional and normalized `?? null`, every oneoff/reminder/share-link/lock-notification enqueue still writes `changeDiff: null`.
- **Tests:** extended `functions/src/index.test.ts` with relock-notification enqueue/reject cases (mirroring the 61-01 lock-notification cases) and changeDiff persist/null cases at both the `createQueuedMessage` and handler levels.

## Task Commits

| Task | Gate | Commit | Description |
| ---- | ---- | ------ | ----------- |
| 1 | RED | 4e2c786f | failing tests for relock-notification message type |
| 1 | GREEN | c08b1054 | add relock-notification to MessageType and MESSAGE_TYPES |
| 2 | RED | 28df6f40 | failing tests for changeDiff audit trail field |
| 2 | GREEN | ac53897c | widen changeDiff to ChangeEntry[] \| null through the send path |

## Verification / Gate Output

- `cd functions && npx vitest run src/index.test.ts` → **156 passed (1 file)**.
- `cd functions && npm test` (full functions suite) → **257 passed (8 files)**.
- `cd functions && npm run build` (`tsc`) → **clean, no errors**.
- `npx vitest run` (root app suite) → **2 failed | 112 passed (114 files); 13 failed | 3517 passed (3530 tests)** — the failing files are exactly the documented known-failing baseline `src/storage.rules.test.ts` (Storage-emulator cross-service limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). Both are pre-existing and unrelated to `functions/`. No regression.

## TDD Gate Compliance

Both tasks followed RED → GREEN. Each RED commit added tests that failed for the right reason (the enum gate rejecting `'relock-notification'` with `invalid-argument`; the shaper returning hard-coded `null`), and each GREEN commit made them pass. No REFACTOR needed.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — the change adds one enum member plus one optional, immutable-after-create audit field. No new endpoint, auth path, or trust boundary; the editor re-check (`:1396-1404`) and kill-switch re-read (`:1409-1418`) are unchanged and re-asserted by tests. No package installed, nothing deployed.

## Next Phase Readiness

Ready for 62-02. The server-side contract 62-03 (modal Send) and 62-04 (re-lock enqueue) depend on is now in place: `'relock-notification'` is accepted and `changeDiff` persists as a tamper-proof audit on the immutable `messages/{id}` doc. The send Functions this rides remain deploy-gated (shared with Phase 59); the owner deploys later — no deploy, secret, or new package in this plan.

## Self-Check: PASSED

- `functions/src/index.ts` exists and carries `"relock-notification"` in both `MessageType` and `MESSAGE_TYPES`, the `ChangeEntry` interface, and `changeDiff: input.changeDiff ?? null`.
- `functions/src/index.test.ts` exists with the new relock-notification and changeDiff cases.
- Commits 4e2c786f, c08b1054, 28df6f40, ac53897c present in `git log`.
