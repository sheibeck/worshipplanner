---
phase: 133-volunteer-responsibility-confirmation
plan: 05
subsystem: messaging
tags: [firestore, firebase-functions, vue, messaging, recipient-resolution]

# Dependency graph
requires:
  - phase: 133-01
    provides: confirmations subcollection (organizations/{orgId}/services/{serviceId}/confirmations/{roleId}_{emailLower}), confirmationKey helper (src/utils/confirmations.ts)
provides:
  - unconfirmedOnly recipient-filter flag on client RecipientSelection and server RecipientSelection/RecipientSelector
  - identical per-assignment unconfirmedOnly filtering hand-mirrored in resolveRecipients (client) and resolveMessageRecipients (server)
  - sendQueuedMessageHandler's authoritative confirmations read + confirmed-key filter (the only enforcement point)
  - MessageComposer "Unconfirmed only" toggle with its own live confirmations preview subscription
affects: [messaging, volunteer-confirmation, service-editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "unconfirmedOnly recipient-filter (R413): a pure additive parameter on both hand-mirrored resolvers, never a new send path"
    - "per-assignment (not per-person) confirmation qualification: a person is dropped only if EVERY matched roleId's confirmation key is in the confirmed set"

key-files:
  created: []
  modified:
    - src/utils/messagingRecipients.ts
    - src/utils/__tests__/messagingRecipients.test.ts
    - functions/src/serviceRoles.ts
    - functions/src/serviceRoles.test.ts
    - functions/src/index.ts
    - src/components/MessageComposer.vue
    - src/components/__tests__/MessageComposer.test.ts

key-decisions:
  - "unconfirmedOnly only filters people matched THROUGH a team assignment (tracked via a parallel roleIdsByPerson map, scoped identically to the existing roleNames tracking); a person added purely via individualPersonIds with no team-matched role has nothing to check and is never filtered — there is no assignment to be unconfirmed about."
  - "Server confirmed-key set is built from confirmations doc IDs directly (doc id IS \`${roleId}_${emailLower}\` by the R410 storage convention) rather than re-joining roleId/emailLower fields — one fewer moving part in the authoritative read."
  - "The extra confirmations Admin-SDK read in sendQueuedMessageHandler is added to the existing Promise.all as a conditional (Promise.resolve(null) when unconfirmedOnly is falsy) so non-nudge sends pay zero extra read cost."

requirements-completed: [R413]

coverage:
  - id: D1
    description: "unconfirmedOnly filter added to client resolveRecipients and server resolveMessageRecipients, keeping partially-unconfirmed people and dropping fully-confirmed ones, per-assignment not per-person"
    requirement: R413
    verification:
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#unconfirmedOnly (R413)"
        status: pass
      - kind: unit
        ref: "functions/src/serviceRoles.test.ts#unconfirmedOnly (R413 — server authoritative filter)"
        status: pass
    human_judgment: false
  - id: D2
    description: "sendQueuedMessageHandler re-resolves unconfirmedOnly authoritatively from the confirmations subcollection via the Admin SDK, never trusting the client's stored selector as the final list"
    requirement: R413
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts (full suite — 342 tests, no regression to sendQueuedMessageHandler's existing coverage)"
        status: pass
      - kind: other
        ref: "cd functions && npm run build (tsc clean)"
        status: pass
    human_judgment: false
  - id: D3
    description: "MessageComposer offers an 'Unconfirmed only' toggle that narrows the live 'Reaches N' preview via its own confirmations onSnapshot subscription, and persists unconfirmedOnly on the queued message's recipientSelector"
    requirement: R413
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#unconfirmed-only toggle preview (R413)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build, clean)"
        status: pass
    human_judgment: true
    rationale: "Visual/UX judgment of the toggle chip placement and live-narrowing behavior against a real Firebase-backed service is deferred UAT per the autonomous execution mode for this plan."

duration: 15min
completed: 2026-09-07
status: complete
---

# Phase 133 Plan 05: R413 Unconfirmed-Only Reminder Nudges Summary

**`unconfirmedOnly` recipient-filter flag added to both hand-mirrored messaging resolvers, with the server (`sendQueuedMessageHandler`) as the sole authoritative enforcement point via an Admin-SDK confirmations read — the client's `MessageComposer` toggle only ever computes an advisory preview.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-07T17:57:00Z (approx)
- **Completed:** 2026-09-07T18:10:00Z (approx)
- **Tasks:** 3/3 completed
- **Files modified:** 7

## Accomplishments
- `unconfirmedOnly?: boolean` added to `RecipientSelection` (client) and `RecipientSelection`/`RecipientSelector` (server); both `resolveRecipients` and `resolveMessageRecipients` gained an optional `confirmedKeys: Set<string>` parameter and identical per-assignment filtering logic.
- `sendQueuedMessageHandler` (`functions/src/index.ts`) now conditionally reads `serviceRef.collection('confirmations')` via the Admin SDK — only when `message.recipientSelector?.unconfirmedOnly` is true — builds a confirmed-key set from `status === 'confirmed'` docs (keyed by doc id), and filters the recipient resolution server-side. This is the authoritative send-list decision; the client's declared selector is never trusted.
- `MessageComposer.vue` gained an "Unconfirmed only" chip toggle, its own live `onSnapshot` subscription to the confirmations subcollection (mirroring `ServiceEditorView.vue`'s R411 discipline — never `getDoc`/`getDocs`), and persists `unconfirmedOnly` on the queued message's `recipientSelector`.
- No new send path, quota, or kill-switch code — reuses the existing `queueServiceMessage`/`sendQueuedMessage` pipeline exactly per the plan's `must_haves`.

## Task Commits

Each task was committed atomically:

1. **Task 1: unconfirmedOnly filter in both pure resolvers (client + server)** - `0198d54c` (feat)
2. **Task 2: Server authoritative re-resolve reads confirmations + filters** - `18d74d66` (feat)
3. **Task 3: MessageComposer unconfirmed-only toggle + preview** - `6eb38952` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

_Note: no TDD gate — tasks are `type="auto"` without `tdd="true"`; tests were added within each feat commit per the plan's own instruction._

## Files Created/Modified
- `src/utils/messagingRecipients.ts` - `unconfirmedOnly?: boolean` on `RecipientSelection`; `resolveRecipients` gained a `confirmedKeys` param and per-assignment filter (tracks matched roleIds per person via a parallel map, scoped to team-matched assignments only)
- `src/utils/__tests__/messagingRecipients.test.ts` - 4 new tests: per-assignment qualification (kept), fully-confirmed (dropped), `unconfirmedOnly:false` unchanged, needsReconfirmation/unconfirmed both still targeted
- `functions/src/serviceRoles.ts` - identical hand-mirrored port of the above (`unconfirmedOnly` on `RecipientSelection`, `confirmedKeys` param on `resolveMessageRecipients`, inline `${roleId}_${emailLower}` join — no `@/` alias into `src` from functions)
- `functions/src/serviceRoles.test.ts` - 3 new tests mirroring the client suite
- `functions/src/index.ts` - `unconfirmedOnly?: boolean` on `RecipientSelector`; `sendQueuedMessageHandler` conditionally reads the confirmations subcollection, builds the confirmed-key set from doc ids, and passes it through to `resolveMessageRecipients`
- `src/components/MessageComposer.vue` - "Unconfirmed only" toggle chip; own `onSnapshot` confirmations subscription (subscribes while open, tears down on close/unmount); `confirmedKeys` fed into the preview `resolveRecipients` call; `unconfirmedOnly` persisted on `queueServiceMessage`'s `recipientSelector`; reset on reopen
- `src/components/__tests__/MessageComposer.test.ts` - added `firebase/firestore` `onSnapshot`/`collection` mocks and `db` to the `@/firebase` mock (required by the new subscription — see Deviations); 3 new tests covering the live onSnapshot registration, the narrowed preview count, and the persisted `recipientSelector.unconfirmedOnly` payload

## Decisions Made
- Per-assignment qualification is scoped to TEAM-matched roleIds only (the same scope `roleNames`/`roleNamesByPerson` already use) — a person added purely via `individualPersonIds` with no team-matched role has no assignment to check and is never filtered by `unconfirmedOnly`. This mirrors the codebase's existing convention that individual-only additions carry no role association.
- The server's confirmed-key set uses confirmation doc IDs directly (`${roleId}_${emailLower}` is the storage key by R410 convention) rather than re-deriving from `roleId`/`emailLower` fields on each doc.
- The extra Admin-SDK confirmations read in `sendQueuedMessageHandler` is folded into the existing `Promise.all` as a conditional (`Promise.resolve(null)` when `unconfirmedOnly` is falsy) so every non-nudge send pays zero additional read cost.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] MessageComposer.test.ts needed new firebase/firestore + `db` mocks**
- **Found during:** Task 3 (MessageComposer unconfirmed-only toggle)
- **Issue:** Adding the composer's own `onSnapshot(collection(db, ...))` confirmations subscription (required by the plan's Task 3 action) introduced a new runtime dependency on `firebase/firestore`'s `collection`/`onSnapshot` and `@/firebase`'s `db` export. The existing test file's `vi.mock('@/firebase', ...)` only exported `functions`, and `firebase/firestore` was entirely unmocked — every existing test would have thrown on mount (`db` undefined → `collection(undefined, ...)` throws).
- **Fix:** Added `db: {}` to the `@/firebase` mock and a `vi.mock('firebase/firestore', ...)` stubbing `collection`/`onSnapshot`, mirroring the exact harness already established in `ServiceEditorView.confirmations.test.ts` (captured `onSnapshotCalls` array + a `confirmationsCall()` helper to fire fake snapshots).
- **Files modified:** `src/components/__tests__/MessageComposer.test.ts`
- **Verification:** All 34 tests in the file pass (31 pre-existing + 3 new)
- **Committed in:** `6eb38952` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Necessary to keep the pre-existing MessageComposer test suite passing after adding the plan-mandated Firestore subscription. No scope creep — the mock harness change is test-infrastructure-only, directly caused by Task 3's own required code change.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Deferred UAT

Per the autonomous-execution/UAT-deferred mode for this plan, the following is code-complete and auto-verified (unit tests + type-check + functions build) but not visually/functionally confirmed against a live service:

- Manual verification item from the plan's `<verification>` section: "with one role confirmed and one not, an unconfirmed-only nudge resolves (server-side) to only the unconfirmed person(s)" — the underlying logic is proven by both resolver test suites (client + server), but an end-to-end nudge send against a real service/confirmations state was not exercised live. Not appended to v2.14-DEFERRED-VERIFICATION.md per this plan's execution instructions.
- Resend test-mode caveat (backlog 999.6) is unaffected and unchanged — the nudge still functions; delivery breadth (beyond the owner's inbox) remains gated on DNS domain verification.

## Next Phase Readiness
R413 is code-complete: `unconfirmedOnly` targets only people with an unconfirmed/needs-reconfirmation assignment, the server re-resolves authoritatively from the confirmations subcollection, and no new send path/quota/kill-switch was introduced. This closes out Phase 133's requirement set (R410-R413, all four now implemented across Plans 01-05). No blockers for the next phase.

---
*Phase: 133-volunteer-responsibility-confirmation*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 8 files (7 modified + this SUMMARY.md) verified present on disk. All 3 task commit hashes (`0198d54c`, `18d74d66`, `6eb38952`) verified present in `git log --oneline --all`.
