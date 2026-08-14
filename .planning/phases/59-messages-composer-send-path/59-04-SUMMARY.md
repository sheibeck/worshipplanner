---
phase: 59-messages-composer-send-path
plan: 04
subsystem: frontend
tags: [messaging, composer, action-bar, vue, tdd, client-callable, recipients]

# Dependency graph
requires:
  - phase: 58-messages-composer
    provides: resolveRecipients + MESSAGING_TEAM_LABELS + RecipientSelection (messagingRecipients.ts) + isMessagingEnabled() kill-switch guard
  - phase: 59-messages-composer-send-path
    plan: 02
    provides: queueServiceMessage onCall contract (QueueMessageRequest/QueueMessageResponse shapes the client wrapper mirrors)
provides:
  - "✉ Messages action-bar item (buildMessagesItem) — editor-gated, disabled-with-tooltip when messaging off"
  - "MessageComposer.vue — teams-first recipients, 3 types, merge-token body, live Reaches-N, options, selector-only Send"
  - "client queueServiceMessage callable wrapper (inside MessageComposer.vue) — selector-only payload"
  - "'mail' ActionBarIcon member + its ContextualActionBar render arm"
affects: [ServiceEditorView, phase-60-delivery-webhook, phase-61-scheduled-cron]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "editor-gated action-bar item that DIVERGES from hide-on-fail: present-but-disabled with a Settings tooltip for discoverability (UI-SPEC #0)"
    - "PptxImportModal shell reused verbatim (Teleport + dual Transition + three-region flex + guarded onCancel), widened to max-w-2xl"
    - "client onCall wrapper co-located inside the component (httpsCallable parsePptx precedent), selector-only payload — server re-resolves recipients"
    - "type-seeding behind a dirty guard so switching message type never destroys an edited draft"
    - "caret token insertion storing the RAW template; the authoritative per-recipient render is server-side (R139)"

key-files:
  created:
    - src/components/MessageComposer.vue
    - src/components/__tests__/MessageComposer.test.ts
  modified:
    - src/views/serviceEditorActionBar.ts
    - src/views/__tests__/serviceEditorActionBar.test.ts
    - src/components/actionBarItems.ts
    - src/components/ContextualActionBar.vue
    - src/views/ServiceEditorView.vue

key-decisions:
  - "✉ Messages is DISABLED-not-hidden when messaging is off (UI-SPEC #0) — a deliberate divergence from buildShareItem's hide-on-fail and the WR-01 AI hide-don't-disable rule, stated in the builder's doc-comment for discoverability"
  - "added a 'mail' ActionBarIcon member (no existing icon fit) + an envelope render arm in ContextualActionBar.vue — the render arm is required for the new icon to appear, a small justified addition beyond the plan's files_modified"
  - "the queueServiceMessage client wrapper lives INSIDE MessageComposer.vue (59-PATTERNS) with locally re-declared request types (client cannot import from functions/); only the recipientSelector crosses — never a resolved email list"
  - "sample-preview token render is a pure local function (no buildServiceSnapshot / Pinia dependency) so the composer stays store-light and testable; the body still stores the raw template"
  - "message-type seeding uses TYPE_DEFAULTS behind subjectDirty/bodyDirty guards; One-off is a blank compose, Reminder seeds {{their_roles}}, Share-link pre-inserts {{service_link}}"

requirements-completed: [R136, R137, R138, R140, R141]

coverage:
  - id: D1
    description: "✉ Messages action-bar item is editor-gated, ordered left of Share, and present-but-disabled with a Settings tooltip when isMessagingEnabled() is false (R136, UI-SPEC #0)"
    requirement: R136
    verification:
      - kind: unit
        ref: "src/views/__tests__/serviceEditorActionBar.test.ts#Messages (R136, 59-04) — present+enabled / disabled+tooltip / viewer-absent / ordered before share / handler identity / mail icon"
        status: pass
    human_judgment: false
  - id: D2
    description: "MessageComposer renders teams-first chips (MESSAGING_TEAM_LABELS) + Everyone + addable individuals, writing the { teams, individualPersonIds, includeEveryone } selector shape (R136)"
    requirement: R136
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#renders the four team chips + Everyone + Individuals; adding an individual writes individualPersonIds"
        status: pass
    human_judgment: false
  - id: D3
    description: "three message types seed subject/body defaults behind a dirty guard (One-off blank, Reminder seeds {{their_roles}}, Share-link pre-inserts {{service_link}}) (R137)"
    requirement: R137
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#message type seeding with a dirty guard (seeds when clean / preserves user-edited subject)"
        status: pass
    human_judgment: false
  - id: D4
    description: "token chips insert {{service_date}}/{{service_link}}/{{their_roles}}/{{song_list}} at the caret and the body stores the RAW template (R138)"
    requirement: R138
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#a token chip inserts {{token}} at the caret and the body stores the RAW template"
        status: pass
    human_judgment: false
  - id: D5
    description: "live 'Reaches N people' recomputes via resolveRecipients on every selection change, pluralizing 0/1/many for reachable and has/have for unreachable (R140, UI-SPEC :401 backstop)"
    requirement: R140
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#Reaches-N pluralization (0 people / 1 person + '1 has' / 2 people + '2 have')"
        status: pass
    human_judgment: false
  - id: D6
    description: "options write attachServiceLink (default on) / sendCopyToSelf / scheduledFor; schedule toggle reveals the datetime input and flips the primary label Send now↔Schedule send (R141)"
    requirement: R141
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#options + schedule reveal (defaults / reveal + label flip)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Send is disabled on zero-reachable / both-empty / past-scheduledFor / in-flight, and calls queueServiceMessage with the recipientSelector only — no raw email list crosses the boundary (R141/R131, T-59-04a/d)"
    requirement: R141
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#Send disabled states + Send calls queueServiceMessage with the selector only (asserts no @example.com in payload)"
        status: pass
    human_judgment: false
  - id: D8
    description: "send-failure shows the inline error (generic + kill-switch variant), re-enables Send, preserves the draft; success emits 'sent' + raises a toast (R141)"
    requirement: R141
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#Send (failure inline error + preserve draft / kill-switch variant / success emit + toast)"
        status: pass
    human_judgment: false
  - id: D9
    description: "the composer matches DESIGN-messaging.md §5a (teams-first layout, indigo accent, live Reaches-N) and the ✉ kill-switch disabled+tooltip reads correctly end-to-end in the running app"
    requirement: R136
    verification: []
    human_judgment: true
    rationale: "Visual/interaction adequacy and the end-to-end kill-switch reading are judgment-dependent and not asserted by any test; routed to PENDING-VERIFICATION.md item 59-04 for owner /gsd-verify-work 59 (v1.7 grant). Must NOT be marked passed here."

# Metrics
duration: 18min
completed: 2026-08-14
status: complete
---

# Phase 59 Plan 04: ✉ Messages Composer & Send Surface Summary

**Shipped the client send surface for v1.7 — a ✉ Messages action-bar entry point (editor-gated, present-but-disabled with a Settings tooltip when messaging is off) that opens the new `MessageComposer.vue`: teams-first recipient chips + individuals writing a `{ teams, individualPersonIds, includeEveryone }` selector, three message types seeding subject/body behind a dirty guard, a subject/body with caret-inserted merge tokens (raw template stored), a live pluralized "Reaches N" via the Phase 58 pure resolver, the three options with a schedule reveal, and a dynamic Send that calls the `queueServiceMessage` client callable with the recipient SELECTOR only — no email list crosses the boundary.**

## Performance
- **Duration:** ~18 min
- **Completed:** 2026-08-14
- **Tasks:** 3 (Tasks 1 & 2 TDD; Task 3 compile-enforced wiring)
- **Files:** 2 created, 5 modified

## Accomplishments
- **✉ Messages action-bar item (`buildMessagesItem`, R136):** editor-gated like Share, ordered LEFT OF Share, and — DIVERGING from Share's hide-on-fail and the WR-01 AI hide-don't-disable rule — returned present-but-`disabled` with the tooltip "Turn on Messaging in Settings to email volunteers" when `messagingEnabled` is false (UI-SPEC #0, stated in the builder's doc-comment). `messagingEnabled` is a REQUIRED `ActionBarContext` field and `onMessages` a new `ActionBarHandlers` member, so the compiler forces the call site to supply both.
- **`MessageComposer.vue` (R136/R137/R138/R140/R141):** reuses the `PptxImportModal.vue` shell verbatim (Teleport + dual Transition, three-region flex, ✕/backdrop/Escape → one guarded `onCancel`), widened to `max-w-2xl`. Delivers the 11 sub-components per UI-SPEC: SEND TO team chips (`{label} · {count}`) + Everyone + Individuals panel, the unreachable helper, the 3-way MESSAGE TYPE segmented control, Subject + Body with the four ＋token chips (caret insertion, raw template), a labelled SAMPLE preview, the Options card with the schedule reveal, and the footer live "Reaches N" + dynamic Send.
- **Client `queueServiceMessage` wrapper (R141/R131):** co-located inside the component (mirrors `PptxImportModal`'s `parsePptx` wrapper), typed to the 59-02 contract via locally re-declared request types. Send builds `{ orgId, serviceId, type, subject, body, recipientSelector, options, scheduledFor }` — the selector only; the test asserts no `@example.com` address appears in the payload (T-59-04a). Success emits `sent` + raises a toast; failure shows the inline error (generic + kill-switch variant), re-enables Send, and preserves the draft.
- **Disabled-Send states (R141, T-59-04d):** zero-reachable (with explanatory `title`), both-empty subject/body, schedule-on with empty/past `scheduledFor` (inline "Pick a future date and time."), and in-flight.
- **`ServiceEditorView.vue` wiring (Task 3):** threaded `messagingEnabled: isMessagingEnabled()` + `onMessages` into `buildActionBarItems`, added `messageComposerOpen`, and mounted `<MessageComposer>` fed the quarters/roles/people the editor already loads (read-only). Compile-enforced by Task 1's required field/handler.

## Task Commits
1. **Task 1 (TDD RED):** failing action-bar tests + helper/expected-array updates — `8cd8084` (test)
2. **Task 1 (TDD GREEN):** `buildMessagesItem` + `messagingEnabled`/`onMessages` + `'mail'` icon & render arm — `80b8a31` (feat)
3. **Task 2 (TDD RED):** failing `MessageComposer.test.ts` — `d51e1ba` (test)
4. **Task 2 (TDD GREEN):** `MessageComposer.vue` — `580aef5` (feat)
5. **Task 3 (wiring):** mount + context threading in `ServiceEditorView.vue` — `60e9d36` (feat)

No REFACTOR commits — both GREEN implementations were clean (one inner-loop fix, below).

## Gate Output

**Action-bar suite** — `npx vitest run src/views/__tests__/serviceEditorActionBar.test.ts`:
```
 Test Files  1 passed (1)
      Tests  47 passed (47)
```

**Composer suite** — `npx vitest run src/components/__tests__/MessageComposer.test.ts`:
```
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

**Type-check (vue-tsc --build, typechecks tests too — CLAUDE.md)** — `npm run type-check`:
```
> vue-tsc --build
(exit 0, no diagnostics)
```

**Full app suite (stays at the 2-file known-failing baseline)** — `npx vitest run`:
```
 Test Files  2 failed | 108 passed (110)
      Tests  13 failed | 3395 passed (3408)
```
The 2 failing files are exactly the documented baseline — `src/storage.rules.test.ts` (Storage-emulator
cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (stale
"Roles config" assertion). The 13-failing-test signature is identical to the pre-plan baseline
(59-02-SUMMARY recorded the same 13). Passed rose by 55 (the 19 composer tests + the new action-bar
Messages tests); no NEW file failed.

## Deviations from Plan

### [Rule 3 - Blocking wiring] Added a 'mail' render arm to ContextualActionBar.vue
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan permits adding a `'mail'` member to the `ActionBarIcon` union in `actionBarItems.ts` (listed in `files_modified`) when no existing icon fits — none did. But a new icon member is inert without a render arm, and `ContextualActionBar.vue` (the sole renderer) was not in `files_modified`.
- **Fix:** Added an envelope `<svg>` `v-else-if="item.icon === 'mail'"` arm alongside the existing icon arms. Minimal, consistent with the existing icon set.
- **Files modified:** `src/components/ContextualActionBar.vue`
- **Verification:** action-bar suite green (asserts `icon === 'mail'` at the data level); type-check clean; no ContextualActionBar test regressed.
- **Commit:** `80b8a31`

**Total deviations:** 1 auto-fixed (Rule 3 — blocking wiring). **Impact:** none — a small, in-family render arm required for the new icon to appear; all gates green.

## Issues Encountered
- One inner-loop type-check fix within Task 2 (not a plan deviation): the sample-preview render initially used `String.prototype.replaceAll`, which is not in this project's TS lib target (`TS2550`). Replaced with a `split(token).join(value)` helper (`fillToken`) that works on any ES target. Fixed before the Task 3 type-check gate.

## Known Stubs
- **Sample-preview `{{service_link}}` renders `[service link]`** in the composer's SAMPLE box — intentional. The composer stores the RAW token template; the authoritative per-recipient render (real share link, personalized roles) happens server-side in `sendQueuedMessage` (59-03) at send time (R139). The SAMPLE box is explicitly labelled non-final per UI-SPEC #9. Not a data stub that blocks the plan's goal.

## Threat Flags
None — no new network endpoint, auth path, or trust-boundary surface was introduced. The composer calls the existing (59-02) `queueServiceMessage` callable with the selector only; the server re-authorizes, re-reads the kill-switch, and re-resolves recipients. The threat register's `mitigate` dispositions (T-59-04a selector-only payload, T-59-04b editor-gated, T-59-04c disabled-when-off, T-59-04d disabled-Send) are all covered by tests.

## User Setup Required
None runnable this plan. The client calls the (still-UNDEPLOYED) `queueServiceMessage` callable — expected under the v1.7 grant; the send path is exercised by tests, not a live deploy. No deploy, no `.env.local`, no secret changes. The visual/interaction UAT (composer vs DESIGN §5a; kill-switch disabled+tooltip end-to-end) is routed to `.planning/PENDING-VERIFICATION.md` item 59-04 for owner `/gsd-verify-work 59` — DEFERRED, not marked passed.

## Next Phase Readiness
- Phase 59 is COMPLETE (all four plans have summaries): server enqueue (59-02), send trigger (59-03), and the client composer (59-04) are built, tested, and UNDEPLOYED.
- **Blocker (intentional, owner):** the send path is undeployed and no `RESEND_API_KEY` is set — the owner completes the PENDING-VERIFICATION 59-01/59-02/59-03 pre-deploy steps (Resend account, secret, DNS, deploy) before live send, then the 59-04 visual UAT at `/gsd-verify-work 59`.
- Phase 60 (delivery webhook) consumes the `recipients/{id}` docs 59-03 writes; Phase 61 (scheduled cron) consumes the `scheduled` message docs this composer can now create via the schedule-for-later option.

---
*Phase: 59-messages-composer-send-path*
*Completed: 2026-08-14*

## Self-Check: PASSED
- `src/components/MessageComposer.vue` — FOUND
- `src/components/__tests__/MessageComposer.test.ts` — FOUND
- `src/views/serviceEditorActionBar.ts` (buildMessagesItem) — FOUND
- `src/views/ServiceEditorView.vue` (MessageComposer mount) — FOUND
- Commit `8cd8084` (test RED, action-bar) — FOUND
- Commit `80b8a31` (feat GREEN, action-bar item + mail icon) — FOUND
- Commit `d51e1ba` (test RED, MessageComposer) — FOUND
- Commit `580aef5` (feat GREEN, MessageComposer.vue) — FOUND
- Commit `60e9d36` (feat, ServiceEditorView wiring) — FOUND
