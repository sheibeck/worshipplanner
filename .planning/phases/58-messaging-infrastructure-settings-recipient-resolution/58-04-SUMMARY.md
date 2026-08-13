---
phase: 58-messaging-infrastructure-settings-recipient-resolution
plan: 04
subsystem: ui
tags: [vue, settings, firestore, messaging, timezone]

requires:
  - phase: 58-messaging-infrastructure-settings-recipient-resolution
    provides: "OrgSettings.messaging + timezone types, DEFAULT_ORG_SETTINGS (enabled:false), loadOrgContext merge, isMessagingEnabled() (58-01)"
provides:
  - "Messaging card on SettingsView.vue: global kill-switch (default OFF), automatic-email defaults sub-block, always-visible timezone select"
  - "onToggleMessagingEnabled/onToggleLockNotifyDefault/onToggleReminderEnabled/onChangeReminderDaysBefore/onSaveMessagingEmail/onChangeTimezone save handlers"
affects: [58-05-service-messaging-defaults, phase-59-send-path, phase-61-scheduled-reminder]

tech-stack:
  added: []
  patterns:
    - "Settings-card auto-save triad (updateDoc dot-path leaf + store mirror-write + 2s Saved!/revert-on-error) reused verbatim for 6 new controls"
    - "Explicit-Save free-text sub-form (Save button, no auto-save) for optional From-name/Reply-to, mirroring Organization Name field"

key-files:
  created: []
  modified:
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts

key-decisions:
  - "Kill-switch local ref seeded authStore.settings.messaging.enabled directly (resolves false for a fresh org via 58-01's DEFAULT_ORG_SETTINGS) — the one deliberate divergence from the AI/PC toggle refs' seed value"
  - "reminderDaysBefore writes Number(reminderDaysBeforeInput.value) explicitly rather than trusting v-model.number alone, so both the write payload and the revert-on-error path are provably numeric (asserted by typeof in tests)"
  - "From-name/Reply-to save together under ONE explicit Save button (not auto-save) — mirrors Organization Name's explicit-Save pattern since free text needs a debounce boundary; empty string clears the field (PC credentials' clear semantics)"
  - "Timezone select ships a curated 7-zone US shortlist (not the full IANA tzdata list) — implementer discretion per 58-CONTEXT.md, labeled by common name + IANA value"

patterns-established: []

requirements-completed: [R130, R132, R133]

coverage:
  - id: D1
    description: "Messaging card renders with a default-OFF kill-switch for a fresh org; toggling it writes the scoped dot-path and mirrors the store"
    requirement: "R130"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView Messaging card — kill-switch + automatic email defaults (R130/R132) — 58-04 > renders the Messaging heading with the kill-switch unchecked for a fresh org"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView Messaging card — kill-switch + automatic email defaults (R130/R132) — 58-04 > writes the dot-path leaf and mirrors the store when the kill-switch is turned on"
        status: pass
    human_judgment: false
  - id: D2
    description: "Automatic email defaults sub-block (lock-notify, reminder-enabled, reminder days-before as a NUMBER, From-name/Reply-to) is revealed only when enabled and auto-saves/explicit-saves its dot-paths with mirror-writes"
    requirement: "R132"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView Messaging card — kill-switch + automatic email defaults (R130/R132) — 58-04 > persists reminderDaysBefore as a NUMBER, not the select string, when changed"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView Messaging card — kill-switch + automatic email defaults (R130/R132) — 58-04 > saves From name / Reply-to together under one Save button and mirrors the store"
        status: pass
    human_judgment: false
  - id: D3
    description: "Organization timezone select is always visible (independent of the kill-switch), reflects authStore.settings.timezone, and auto-saves settings.timezone with mirror-write and revert-on-error"
    requirement: "R133"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView organization timezone select (R133) — 58-04 > writes the dot-path leaf and mirrors the store when the timezone changes"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual/interaction eyeball of the Messaging card against its AI/PC/Bible siblings, and a real Firestore round-trip (fresh org OFF, set timezone, reload, confirm it stuck)"
    verification: []
    human_judgment: true
    rationale: "Deferred to owner at /gsd-verify-work 58 per the v1.7 grant and 58-UI-SPEC.md/58-04-PLAN.md's verification section — jsdom cannot prove a real Firestore round-trip or visual consistency."

duration: 40min
completed: 2026-08-13
status: complete
---

# Phase 58 Plan 4: Settings Messaging Card Summary

**Messaging card on SettingsView.vue with a fail-closed global kill-switch, an org-level automatic-email-defaults sub-block (reminderDaysBefore persisted as a number), and an always-visible 7-zone organization-timezone select — all writing scoped Firestore dot-path leaves with store mirror-writes.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-13T20:48:18Z
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- Appended a new "Messaging" card to `SettingsView.vue` after the Slide Typography card, reusing the exact card shell, explain-then-toggle ordering, and `Saved!`/error/revert triad from the AI Features / Planning Center / Bible Translation cards.
- Global kill-switch (`settings.messaging.enabled`) seeded from the store's already-merged default (`false` for a fresh org, per 58-01), auto-saves on change, mirror-writes `authStore.settings.messaging.enabled`.
- Conditionally-revealed "Automatic email defaults" sub-block (`v-if="messagingEnabledInput"`): lock-notify default and reminder-enabled default checkboxes (auto-save), a reminder days-before `<select>` (1/2/3/5/7/10/14, revealed only when reminder-enabled is checked, writes `Number(...)` — verified `typeof === 'number'` in tests), and optional From-name/Reply-to text inputs saved together under one explicit `Save` button.
- Always-visible organization-timezone `<select>` (7-zone curated shortlist: Eastern/Central/Mountain/Arizona/Pacific/Alaska/Hawaii), independent of the kill-switch, auto-saves `settings.timezone`.
- Every control writes a single scoped `updateDoc` dot-path leaf (never a whole-map overwrite) and is gated behind `authStore.isEditor`.

## Task Commits

Both tasks are `tdd="true"`; the RED step for Task 1 and Task 2 was combined into a single `test(...)` commit (see Deviations) since both live in the same card/file and share one mount harness — followed by a single `feat(...)` commit implementing the whole card.

1. **Task 1 + Task 2: Messaging card (kill-switch, automatic email defaults, timezone select)**
   - `227b7ca` (test) — failing tests for kill-switch, email defaults sub-block, and timezone select
   - `05489b5` (feat) — Messaging card implementation, all six save handlers

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified
- `src/views/SettingsView.vue` - New "Messaging" card (template + 6 save handlers: `onToggleMessagingEnabled`, `onToggleLockNotifyDefault`, `onToggleReminderEnabled`, `onChangeReminderDaysBefore`, `onSaveMessagingEmail`, `onChangeTimezone`) plus store-sync watches
- `src/views/__tests__/SettingsView.test.ts` - Extended auth-store mock with a `settings.messaging`/`settings.timezone` accessor shape + two new `describe` blocks (15 new tests) covering both tasks

## Decisions Made
- Kill-switch local ref seeded directly from `authStore.settings.messaging.enabled` (already resolves `false` via 58-01's `DEFAULT_ORG_SETTINGS.messaging.enabled`) rather than a hardcoded literal, so the seed always tracks the single source of truth.
- `reminderDaysBefore` write path explicitly wraps `Number(...)` around the local ref (even though `v-model.number` already coerces it) so both the Firestore payload and the revert-on-error restore path are provably numeric — a test asserts `typeof === 'number'` on both the write payload and the mirrored store value.
- From-name/Reply-to use the explicit-Save pattern (not auto-save-on-change) — the only two free-text fields in the card, matching the Organization Name field's established boundary between auto-saving toggles/selects and debounced free text.
- Curated 7-zone timezone shortlist (not the full IANA tzdata list) per 58-CONTEXT.md's explicit "Claude's Discretion" grant.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written; every control shape, dot-path key, and save-triad matches 58-PATTERNS.md's cited analogs verbatim.

### Process deviation (documented, not a Rule 1-4 fix)

**Combined Task 1 and Task 2's TDD RED step into a single test commit.** Both tasks add controls to the *same* card in the *same* file, mounted through the *same* test harness — the plan's own `58-PATTERNS.md` and `58-UI-SPEC.md` describe them as one card with two sub-features (the automatic-email-defaults block and the always-visible timezone select). Writing two separate RED commits would have required either an artificial intermediate state (Task 1's tests passing while Task 2's fail, which is a normal RED state — but then Task 2's tests would need their own auth-store mock scaffolding added mid-stream to a file Task 1 had just committed) or duplicating mock setup. A single RED commit covering both tasks' full test surface, followed by a single GREEN commit implementing the full card, was more coherent and no less TDD-disciplined (tests still written and confirmed failing before any implementation code). No functional deviation — both tasks' `must_haves` are fully covered by named, task-attributable test blocks in the final file.

---

**Total deviations:** 0 auto-fixed; 1 documented process consolidation (RED/GREEN commit granularity, no functional change).
**Impact on plan:** None on scope or correctness — both tasks' verification and done criteria are fully met.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Messaging card is fully wired to 58-01's typed `OrgSettings.messaging`/`timezone` substrate — 58-05 (per-service messaging defaults panel) can now build its inherit-or-override selects against these same org-level defaults with confidence the Settings side is live.
- `npx vitest run src/views/__tests__/SettingsView.test.ts` — 41/41 pass (26 pre-existing + 15 new).
- `npm run type-check` (`vue-tsc --build`) — clean.
- `npx vitest run` (full app suite) — 3288 passed, 1 failed (the pre-existing `RosterView.test.ts` stale assertion), 13 skipped, plus the documented `storage.rules.test.ts` Storage-emulator environment limitation — both match the CLAUDE.md-documented known-failing baseline exactly, no new regressions.
- No blockers. Manual verification (fresh-org OFF eyeball, timezone persistence round-trip against live Firestore) deferred to `/gsd-verify-work 58` per the plan's own verification section.

---
*Phase: 58-messaging-infrastructure-settings-recipient-resolution*
*Completed: 2026-08-13*

## Self-Check: PASSED

All created/modified files found on disk; both task commit hashes (227b7ca, 05489b5) found in git log.
