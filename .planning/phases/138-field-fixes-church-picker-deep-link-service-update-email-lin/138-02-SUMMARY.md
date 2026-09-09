---
phase: 138-field-fixes-church-picker-deep-link-service-update-email-lin
plan: 02
subsystem: messaging
tags: [vue, pinia, firebase-functions, service-messaging, share-links]

requires:
  - phase: 113
    provides: ensureShareLink idempotent mint-or-adopt share-link store method
provides:
  - Re-lock/service-update notice emails always attempt to include a working plan link
  - Client-side ensureShareLink precondition before every re-lock notice send
affects: [messaging, ReLockNotifyPrompt, ServiceEditorView]

tech-stack:
  added: []
  patterns:
    - "Client-side idempotent self-heal-before-send (ensureShareLink), soft-fail via log-only try/catch — mirrors markAsPlanned/createService"
    - "Client-side graceful token-line omission based on an awaited return value, rather than a server-side conditional guard"

key-files:
  created: []
  modified:
    - src/components/ReLockNotifyPrompt.vue
    - src/components/__tests__/ReLockNotifyPrompt.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "A1 resolved as client-side graceful omission: the sent body includes the {{service_link}} line only when the awaited ensureShareLink return value is a non-empty string; no server-side guard was added to sendQueuedMessageHandler (explicitly out of scope per CONTEXT.md)."
  - "ensureShareLink call site is client-side (not server-side) — the component already has service/orgId as props and the store already exposes the idempotent, soft-fail-proven ensureShareLink."

patterns-established:
  - "Deviation: vi.hoisted() any test-store mock property read EAGERLY as a top-level key of a vi.mock(...) factory's returned object (not merely closed-over inside a deferred useServiceStore() arrow) whenever a component under test gains a new top-level import of that mocked module — matches this file's existing mockRouterPush/mockGetSongSuggestions convention."

requirements-completed: [R434]

coverage:
  - id: D1
    description: "onSend() calls ensureShareLink(props.service, props.orgId) before queueServiceMessage, mirroring markAsPlanned's soft-fail pattern; a rejection is logged and never blocks the send."
    requirement: "R434"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#calls ensureShareLink with the service and orgId before queueServiceMessage"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#a rejected ensureShareLink is swallowed (non-blocking) and the message still sends"
        status: pass
    human_judgment: false
  - id: D2
    description: "The sent body includes a plan-link line carrying the {{service_link}} token when a share link resolves."
    requirement: "R434"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#the service_link token appears in the sent body when a share link resolves"
        status: pass
    human_judgment: false
  - id: D3
    description: "A genuinely link-less service (ensureShareLink resolves empty) omits the whole plan-link line — no dangling label, no empty token."
    requirement: "R434"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#omits the plan-link line entirely when ensureShareLink resolves an empty string"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real production email delivery of the plan link (end-to-end, live Firestore/token resolution/render) reads correctly in an actual sent email."
    verification: []
    human_judgment: true
    rationale: "Unit tests mock ensureShareLink and the queueServiceMessage callable; the actual server-side token substitution (renderMessageTokens) has its own passing regression suite (functions/messageTokens.test.ts) but an end-to-end email send was not exercised this plan — deferred to batched UAT per the phase's Manual-Only Verifications."

duration: 45min
completed: 2026-09-09
status: complete
---

# Phase 138 Plan 02: Service-Update Email Link Summary

**R434 fix — ReLockNotifyPrompt.vue now guarantees a share link via `ensureShareLink` before send and appends a `{{service_link}}` plan-link line to the notice body, gracefully omitted when no link can be produced**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-09T17:40:00Z
- **Completed:** 2026-09-09T18:25:20Z
- **Tasks:** 1 (TDD: test → feat), plus 1 auto-fixed regression
- **Files modified:** 3

## Accomplishments
- The auto-generated re-lock/service-update notice body now carries a `View the full plan: {{service_link}}` line whenever a share link exists or can be minted, using the server's already-shipped `renderMessageTokens` substitution — no new server plumbing.
- `onSend()` now awaits `useServiceStore().ensureShareLink(props.service, props.orgId)` before sending, in a log-only soft-fail try/catch identical in shape to `markAsPlanned`'s (`services.ts:735-740`) and `createService`'s (`services.ts:477-491`) established self-heal pattern — a mint failure never blocks the notice.
- A genuinely link-less service (mint failed and was swallowed) degrades gracefully: the whole plan-link line is omitted rather than shipping a dangling `View the full plan:` label with nothing after it (the A1 open-question resolution, client-side).
- Found and fixed a real regression this plan's own change introduced in `ServiceEditorView.test.ts` (see Deviations) — full suite verified back to the documented single-file baseline.

## Task Commits

TDD task, committed RED then GREEN, plus one Rule-1 auto-fix commit for a regression this plan's change surfaced:

1. **Task 1 (RED): failing tests for R434 plan-link + ensureShareLink precondition** - `ca0cf552` (test)
2. **Task 1 (GREEN): append plan-link line, guarded by ensureShareLink** - `e643df2a` (feat)
3. **Regression fix: vi.hoisted() two eagerly-read services-store test mocks** - `63fc1799` (fix)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/components/ReLockNotifyPrompt.vue` - new `useServiceStore` import/instantiation; `onSend()` awaits `ensureShareLink` (soft-fail) and conditionally appends the `{{service_link}}` plan-link line to the sent body.
- `src/components/__tests__/ReLockNotifyPrompt.test.ts` - new `vi.mock('@/stores/services', ...)` seam (this file had zero store mocks before) plus three new tests (token-in-body, ensureShareLink-called-before-send/rejection-non-blocking, graceful-omission-when-empty).
- `src/views/__tests__/ServiceEditorView.test.ts` - `ServiceLockedErrorStub` and `mockBuildServiceSnapshot` moved into `vi.hoisted()` so this file's pre-existing `vi.mock('@/stores/services', ...)` factory stays safe now that `ReLockNotifyPrompt.vue` (statically imported here) also imports that module.

## Decisions Made
- **A1 (open question) resolved as client-side graceful omission**, per the plan's explicit instruction: the `View the full plan:` line is included only when the awaited `ensureShareLink` return value is a non-empty (trimmed) string. No server-side guard was added to `sendQueuedMessageHandler` — that path, and the dead `attachServiceLink` field, remain explicitly out of scope (CONTEXT.md deferred ideas).
- The store's real exported symbol is `useServiceStore` (singular), not `useServicesStore` as written in the plan's prose/research — used the actual codebase name; no functional difference, just a naming correction sourced directly from `services.ts:366`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a vi.mock hoisting TDZ regression in ServiceEditorView.test.ts**
- **Found during:** Task 1 (wave-merge full-suite verification, after the GREEN commit)
- **Issue:** `ReLockNotifyPrompt.vue`'s new static `import { useServiceStore } from '@/stores/services'` is reached earlier in `ServiceEditorView.test.ts`'s static import graph (that file imports `ReLockNotifyPrompt.vue` directly, per its own R146/R148 comment, so its `findComponent` assertions can read the mounted prompt's props) than the test file's own top-level `class ServiceLockedErrorStub` and `const mockBuildServiceSnapshot` declarations. This shifted when the file's pre-existing `vi.mock('@/stores/services', ...)` factory resolves, throwing `ReferenceError: Cannot access '...' before initialization` and failing the entire suite (0 tests ran).
- **Fix:** Moved exactly the two identifiers read EAGERLY as direct properties of the factory's returned object (`ServiceLockedError: ServiceLockedErrorStub`, `buildServiceSnapshot: mockBuildServiceSnapshot`) into `vi.hoisted()`, mirroring this same file's existing `mockRouterPush`/`mockGetSongSuggestions` convention for exactly this class of problem. Everything else inside the factory's `useServiceStore: () => ({...})` arrow is only closed over (not eagerly read), so it stayed untouched and safe.
- **Files modified:** src/views/__tests__/ServiceEditorView.test.ts
- **Verification:** `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 349/349 tests pass; full-suite rerun confirmed back to the documented single-file (`storage.rules.test.ts`) baseline (225/226 files, 5708/5742 tests pass — the 34 failures are the pre-existing, CLAUDE.md-documented Storage-emulator env limitation, unrelated to this plan).
- **Committed in:** 63fc1799

---

**Total deviations:** 1 auto-fixed (1 bug — a regression this plan's own change surfaced in a downstream test file)
**Impact on plan:** Necessary for correctness (the full test suite must stay green); no scope creep — the fix touches only test-mock hoisting order in one file, no production code changed beyond what Task 1 already specified.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R434 is fully implemented and unit-tested; plan 138-01 (church-picker R428) is also complete on `master`. Both plans in Phase 138 are independent and non-overlapping (confirmed via file diff).
- End-to-end email verification (a real send showing the resolved link in an inbox) is deferred to the phase's batched UAT, per 138-VALIDATION.md's Manual-Only Verifications table — this plan's unit coverage proves the wiring, not the live Firestore/email round-trip.
- `functions/src/index.ts` and `options.attachServiceLink` remain untouched, as scoped.

---
*Phase: 138-field-fixes-church-picker-deep-link-service-update-email-lin*
*Completed: 2026-09-09*

## Self-Check: PASSED

All claimed files and commits verified present on disk / in git history:
- FOUND: src/components/ReLockNotifyPrompt.vue
- FOUND: src/components/__tests__/ReLockNotifyPrompt.test.ts
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- FOUND: .planning/phases/138-field-fixes-church-picker-deep-link-service-update-email-lin/138-02-SUMMARY.md
- FOUND commit: ca0cf552 (test)
- FOUND commit: e643df2a (feat)
- FOUND commit: 63fc1799 (fix)
