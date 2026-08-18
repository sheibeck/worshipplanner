---
phase: 60-delivery-history-bounce-webhook
plan: 03
subsystem: ui
tags: [vue, pinia, firestore, onsnapshot, vue-router, messaging, delivery-history, bounce]

# Dependency graph
requires:
  - phase: 58-messaging-foundation
    provides: "isMessagingEnabled() kill-switch, isOrgMember read rules for services/{id}/messages + /recipients, per-service messaging-defaults panel"
  - phase: 59-message-composer-send
    provides: "messages/{id} doc shape (type/status/subject/scheduledFor/sentAt/deliveryCounts), recipients/{id} doc (personId/name/email/status/bounceReason), MessageComposer + messageComposerOpen"
  - phase: 60-delivery-history-bounce-webhook
    provides: "60-01/60-02 webhook writes recipients/{id}.status='bounced' + bounceReason + bouncedAt and messages/{id}.deliveryCounts.bounced"
provides:
  - "serviceMessages read store: single-listener nested subscribe to services/{id}/messages (newest-first) + lazy status=='bounced' recipients read"
  - "ServiceMessageHistory.vue read-only panel: type badges, counts, send time, status pills, red N-bounced expand, Fix email deep-link"
  - "ServiceEditorView mount + kill-switch/editor gate for the history panel"
  - "RosterView ?edit={personId} deep-link handler (additive, graceful fallback)"
affects: [messaging, delivery-history, roster, service-editor, phase-61, phase-62]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nested-subcollection onSnapshot read store (songLyrics.ts::subscribeLyrics idiom) for services/{id}/messages — NESTED-path reads only, no client collectionGroup, so Phase 58 isOrgMember rules suffice"
    - "Pure props-in/emit-out read-only list component (LyricVersionHistory idiom): parent owns the subscription, component tests with plain fixtures and no Firebase mock"
    - "Query-param deep-link handler resilient to useRoute() being undefined (optional-chained) so it never regresses router-free unit tests"

key-files:
  created:
    - "src/stores/serviceMessages.ts - nested subscribe + lazy bounced-recipients read; ServiceMessageDoc/BouncedRecipient client types"
    - "src/stores/__tests__/serviceMessages.test.ts"
    - "src/components/ServiceMessageHistory.vue - read-only history card + bounce surfacing"
    - "src/components/__tests__/ServiceMessageHistory.test.ts"
    - "src/views/__tests__/RosterViewEditQuery.test.ts"
  modified:
    - "src/views/ServiceEditorView.vue - mount + gate the panel, subscribe/teardown the store, wire newMessage/expand"
    - "src/views/RosterView.vue - additive ?edit={personId} deep-link handler"
    - "src/views/__tests__/ServiceEditorView.test.ts - serviceMessages store mock + present/absent assertions"

key-decisions:
  - "New dedicated serviceMessages Pinia store (not services.ts) — matches the songLyrics.ts per-subcollection store precedent; services.ts is the top-level collection store, not the nested-read precedent"
  - "Missing deliveryCounts.bounced leaf treated as 0 in the client map so older Phase-59 docs never show a false bounce indicator (panel renders correctly even before 60-02 deploys)"
  - "Panel HIDDEN (v-if) when messaging off OR non-editor — kill-switch hides the reference surface (UI-SPEC #0), deliberately differing from the composer's disabled entry"
  - "Fix email is a router-link to /volunteers?edit={personId} AND emits fixAddress; RosterView reads the query additively with a plain-/volunteers graceful fallback"
  - "ServiceMessageHistory is pure props-in/emit-out; ServiceEditorView owns the store subscription and the lazy expand read"

patterns-established:
  - "Nested-path client reads (never client collectionGroup) keep new read surfaces under existing isOrgMember rules — no new Firestore rule"
  - "Deep-link query handlers use optional-chained useRoute() so adding router reads never breaks router-free component tests"

requirements-completed: [R142, R143]

coverage:
  - id: D1
    description: "serviceMessages store: one onSnapshot on services/{id}/messages newest-first (single-listener guard, isLoading), missing bounced leaf -> 0, and a lazy nested status=='bounced' getDocs"
    requirement: "R142"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/serviceMessages.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "ServiceMessageHistory panel: newest-first rows, type badges, counts, send time, status pills (none for clean sent), red N-bounced expand with reason + Fix email deep-link, empty/loading/error, 0/1/many pluralization"
    requirement: "R143"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ServiceMessageHistory.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Panel mounted below the messaging-defaults panel and gated v-if=(isMessagingEnabled() && canEditService) — present for editor+on, absent when off or non-editor"
    requirement: "R142"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#delivery-history panel mount (60-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "RosterView opens a person's edit form from ?edit={personId}; unknown id / no query is a graceful no-op"
    requirement: "R143"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RosterViewEditQuery.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual/interaction UAT — panel layout matches DESIGN-messaging.md §5b, a real hard bounce surfaces the red indicator, and Fix email navigates to the exact roster record"
    verification: []
    human_judgment: true
    rationale: "Visual layout, live-bounce surfacing (depends on 60-01/60-02 deploy), and cross-view navigation are owner UAT at /gsd-verify-work 60 — routed to PENDING-VERIFICATION.md as deferred, never marked passed by automation."

# Metrics
duration: 17min
completed: 2026-08-14
status: complete
---

# Phase 60 Plan 03: "Sent on this service" delivery-history panel Summary

**Read-only per-service delivery-history card (R142) with per-message hard-bounce surfacing (R143) — a nested-path `serviceMessages` onSnapshot store, a props-driven `ServiceMessageHistory.vue` card, its kill-switch/editor-gated mount in the Service Order tab, and a `/volunteers?edit={personId}` roster deep-link — reads only, no new Firestore rule, no deploy.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-08-14T14:15:00Z
- **Completed:** 2026-08-14T14:32:00Z
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- `serviceMessages` Pinia store: one `onSnapshot` on `services/{id}/messages` ordered `createdAt desc` (single-listener guard, `isLoading`), a missing `deliveryCounts.bounced` leaf normalized to 0, and a lazy one-shot `getDocs` of `messages/{id}/recipients where status=='bounced'` — NESTED-path reads only, so the Phase 58 `isOrgMember` rules already cover it (no new client rule).
- `ServiceMessageHistory.vue`: a pure props-in/emit-out card — newest-first rows with type badge (One-off / Reminder / Share link / Automatic), `{N} sent` count + send time (or "Scheduled for …"), status pills (none for a clean `sent`; Partial / Failed / Scheduled / Sending…), a red "N bounced" expand toggle revealing bounced recipients (name / email / reason with an "Address rejected" fallback) each with a "Fix email →" deep-link; empty / loading / error states and 0/1/many pluralization.
- Mounted + gated in `ServiceEditorView.vue` directly below the messaging-defaults panel, `v-if=(isMessagingEnabled() && canEditService)`; subscribes the store on serviceId/isEditor change, tears it down on unmount, and wires `newMessage → composer` and `expand → lazy bounced-recipients read`.
- `RosterView.vue` honors `/volunteers?edit={personId}` additively (opens that person's edit form on mount and on query/people change), with an unknown-id / no-query graceful fallback, resilient to `useRoute()` being undefined when mounted without a router.

## Task Commits

1. **Task 1: serviceMessages store (TDD)** - `e852a16` (test+feat)
2. **Task 2: ServiceMessageHistory.vue (TDD)** - `98442be` (test+feat)
3. **Task 3: mount + gate panel; RosterView ?edit=** - `3fc6a1e` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `src/stores/serviceMessages.ts` - nested subscribe + lazy bounced-recipients read; `ServiceMessageDoc` / `BouncedRecipient` functions-free client types
- `src/stores/__tests__/serviceMessages.test.ts` - single-listener, missing-bounced→0, lazy status=='bounced' read, isLoading
- `src/components/ServiceMessageHistory.vue` - read-only history card + bounce surfacing
- `src/components/__tests__/ServiceMessageHistory.test.ts` - 16 render/behavior tests
- `src/views/ServiceEditorView.vue` - panel mount + gate, store subscribe/teardown, expand handler
- `src/views/__tests__/ServiceEditorView.test.ts` - serviceMessages store mock + present/absent/non-editor assertions
- `src/views/RosterView.vue` - additive `?edit={personId}` handler
- `src/views/__tests__/RosterViewEditQuery.test.ts` - open / unknown / no-query cases

## Decisions Made
- Dedicated `serviceMessages` store (not `services.ts`) — matches the `songLyrics.ts` per-subcollection store precedent.
- Missing `deliveryCounts.bounced` → 0 in the client map (no false bounce indicator on older docs; panel works before 60-02 deploys).
- Kill-switch HIDES the panel (`v-if`) rather than disabling it — the reference surface teaches nothing when off; the composer's disabled ✉ carries discoverability.
- Fix email is a `router-link` to `/volunteers?edit={personId}` and also emits `fixAddress`; RosterView reads the query additively.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** None — all three tasks implemented as specified; the panel is read-only with no new write path and no new Firestore rule.

## Issues Encountered
- The initial `ServiceMessageHistory.vue` write omitted the closing `</script>` tag, which surfaced as a confusing `SFC "Element is missing end tag"` pointing at the `<script setup>` line. Root-caused via `@vue/compiler-sfc parse()` (reported the unclosed element), added the closing tag, and all 16 component tests passed. No functional impact.

## User Setup Required
None for this plan — read-only client surface, no env vars, no deploy, no `.env.local`. (The 60-01/60-02 webhook deploy + Resend dashboard config remain owner steps tracked separately in PENDING-VERIFICATION.md.)

## Next Phase Readiness
- R142 + R143 client surfaces complete; Phase 60 plans 01–03 all shipped.
- **Deferred to owner UAT** (`.planning/PENDING-VERIFICATION.md`, never marked passed): visual/interaction verification of the panel against DESIGN-messaging.md §5b, live hard-bounce surfacing (after 60-01/60-02 deploy), and the Fix-email navigation.
- Full app suite stays at the 2-file known-failing baseline (`storage.rules.test.ts` env limitation, `RosterView.test.ts` stale "Roles config" assertion); `npm run type-check` clean.

## Self-Check: PASSED

- Created files verified on disk: `src/stores/serviceMessages.ts`, `src/components/ServiceMessageHistory.vue`, `60-03-SUMMARY.md` (+ 3 test files).
- Task commits verified in git log: `e852a16`, `98442be`, `3fc6a1e`.
- Gates: serviceMessages.test.ts 8/8, ServiceMessageHistory.test.ts 16/16, ServiceEditorView.test.ts + RosterViewEditQuery.test.ts 299/299, `npm run type-check` clean, full app suite at the 2-file known-failing baseline.

---
*Phase: 60-delivery-history-bounce-webhook*
*Completed: 2026-08-14*
