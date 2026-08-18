---
phase: 62-relock-change-notice-scoped-diff
plan: 03
subsystem: client/messaging
tags: [client, vue, messaging, modal, relock, change-notice, recipients]
requires:
  - "'relock-notification' + changeDiff accepted by queueServiceMessage (62-01)"
  - "ChangeEntry type exported from @/utils/serviceLockDiff (62-02)"
  - "resolveRecipients + MESSAGING_TEAM_LABELS + RecipientSelection (Phase 58)"
  - "PptxImportModal shell + MessageComposer recipient/Reaches-N idioms (Phase 59)"
provides:
  - "ReLockNotifyPrompt.vue — the re-lock change-notice modal (checkable typed diff, affected-vs-everyone recipient choice, live Reaches-N)"
  - "Emits `sent` on a successful relock-notification send and `cancel` on Lock quietly / dismiss — the two signals 62-04's lock hook maps to the snapshot overwrite"
affects:
  - "62-04 re-lock lock-hook opens this modal on a non-empty diff with messaging ON and maps sent/cancel to the lockSnapshots/current overwrite"
tech-stack:
  added: []
  patterns:
    - "Local re-declared callable request interface (client cannot import from functions/), extended with changeDiff: ChangeEntry[]"
    - "Checked-flags ref<boolean[]> keyed by entry index; computed affectedUnion = first-seen distinct union across checked entries"
    - "Selector-only + changeDiff payload crosses the boundary — never a resolved email list (server re-resolves)"
    - "Route around the failure-only ToastHost: no success toast, parent closes on `sent`"
key-files:
  created:
    - src/components/ReLockNotifyPrompt.vue
    - src/components/__tests__/ReLockNotifyPrompt.test.ts
  modified: []
key-decisions:
  - "Send logic (footer, onSend, disabled/error states) authored inside Task 1's single-file component GREEN rather than deferred to a Task 2 feat commit — the .vue is one cohesive file per 62-UI-SPEC; Task 2 is the send-wiring test coverage that pins the behavior"
  - "changeDiff = the currently-CHECKED entries (the honest audit of what was communicated); recipientSelector = affected-union (default) or includeEveryone; individualPersonIds always []"
  - "On send reject the modal emits NEITHER sent NOR cancel so the parent leaves lockSnapshots/current untouched (SC4 safe-retry basis)"
requirements-completed: [R146, R147, R148]
coverage:
  - deliverable: "Checkable typed ChangeEntry list — one default-checked row per entry with type badge + description + MESSAGING_TEAM_LABELS team chips (R146)"
    verification:
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#renders one checkable row per ChangeEntry with its type badge, description, and team-label chips"
        status: pass
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#starts with every row CHECKED and the recipient choice on Affected teams"
        status: pass
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#renders a pluralization-safe change-count line"
        status: pass
    human_judgment: false
  - deliverable: "Affected-vs-everyone recipient choice + live Reaches-N recomputing on check/uncheck and choice switch (R147 / SC2)"
    verification:
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#Affected teams (default) resolves to the union of affectedTeams across CHECKED rows"
        status: pass
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#unchecking the broad rows narrows the union to a single team and re-lowers Reaches-N"
        status: pass
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#switching to Everyone recomputes over every assigned role regardless of the checked union"
        status: pass
    human_judgment: false
  - deliverable: "Send notice enqueues type:relock-notification with the selector + changeDiff=checked entries + attachServiceLink, emits `sent` on success, inline re-enabling error emitting nothing on failure (R146 / R148 / SC4)"
    verification:
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#calls queueServiceMessage once with type:relock-notification, the selector, and changeDiff = the CHECKED entries"
        status: pass
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#sends changeDiff = only the CHECKED entries and the Everyone selector when Everyone is chosen"
        status: pass
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#a rejected send shows the inline error, re-enables Send, and emits NEITHER sent NOR cancel"
        status: pass
    human_judgment: false
  - deliverable: "Lock quietly always enabled (SC3) + ✕/backdrop/Escape emit cancel with no send; Send disabled at zero-checked/zero-reachable/in-flight"
    verification:
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#Lock quietly emits cancel and NEVER calls queueServiceMessage"
        status: pass
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#Lock quietly stays enabled and emits cancel even when the selection reaches zero people"
        status: pass
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#Escape emits cancel with no send"
        status: pass
      - kind: test
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts#Send is disabled and reads Sending… while a send is in flight"
        status: pass
    human_judgment: false
  - deliverable: "Live re-lock notice reads correctly and a real notice reaches the checked teams (deployed send path)"
    verification: []
    human_judgment: true
    rationale: "Requires the deployed queueServiceMessage callable and a real re-lock; deferred to the owner at /gsd-verify-work 62 per the v1.7 no-deploy grant (verification_deferred_human)."
duration: 14 min
completed: 2026-08-15
status: complete
---

# Phase 62 Plan 03: Re-lock change-notice modal (ReLockNotifyPrompt.vue) Summary

Shipped `src/components/ReLockNotifyPrompt.vue` — the dedicated re-lock change-notice modal that lists the typed `ChangeEntry[]` diff as default-checked checkable rows (type badge + description + affected-team chips), offers an affected-teams-default vs everyone recipient choice with a live `resolveRecipients`-backed "Reaches N", enqueues a `relock-notification` via `queueServiceMessage` (selector + checked-entry `changeDiff`, never an email list), and pairs a primary "Send notice" with an always-available "Lock quietly" that (with ✕/backdrop/Escape) emits `cancel`.

## Accomplishments

- **Checkable typed diff (R146):** one `<label>`-wrapped row per `ChangeEntry`, all default-checked, each with the shipped native checkbox recipe, a muted Phase-60 type badge (SONG/ORDER/ROLE/NOTES/SLIDES), the `text-sm` description, and one read-only team chip per `affectedTeams` group via `MESSAGING_TEAM_LABELS` (band→Worship / tech→Tech / vocals→Vocals / other→Hosts). A pluralization-safe "{N} change|changes since the last lock" count line sits above the list.
- **Recipient choice + live Reaches-N (R147 / SC2):** a `role="radiogroup"` with "Affected teams" (default = the first-seen distinct union of `affectedTeams` across the CHECKED rows) and "Everyone on this service" (`includeEveryone:true`). A `text-xs aria-live="polite"` "Reaches {N} {person|people}" (+ muted "· {M} {has|have} no email") recomputes on every check/uncheck and on the choice switch via `resolveRecipients(service, quarters, roles, people, selection).reachable.length`, pluralization-safe at 0/1/many.
- **Send wiring (R146 / R148):** "Send notice" calls the same `queueServiceMessage` callable the composer uses, with `type:'relock-notification'`, `recipientSelector` from the choice, `changeDiff` = the CHECKED entries, `options.attachServiceLink:true`/`sendCopyToSelf:false`, `scheduledFor:null`, and an auto-generated subject/body summarizing the checked entries. On resolve it emits `sent` (no success toast — routes around the failure-only ToastHost); on reject it shows the inline `text-red-400` error, re-enables Send, and emits nothing (parent leaves the snapshot untouched — SC4 safe retry). The local `RelockQueueMessageRequest` interface is re-declared client-side (the client cannot import from `functions/`), carrying only the selector + the audit diff.
- **Lock quietly + dismiss (SC3):** "Lock quietly" is never disabled and emits `cancel` with no send; ✕ / backdrop click / Escape all route to the same `onCancel` (dismiss = quiet-lock semantics). Send is disabled (real `disabled` attr + explanatory `title`) at zero-checked OR zero-reachable OR in-flight ("Sending…"); Lock quietly stays enabled in every case.
- **Modal shell + a11y:** the `PptxImportModal` `<Teleport>` + backdrop + fade/scale `Transition` shell (`max-w-lg`), `role="dialog" aria-modal="true"` with `aria-labelledby`/`aria-describedby`, the amber already-locked subline, and the ✕ close glyph.

## Task Commits

| Task | Gate | Commit | Description |
| ---- | ---- | ------ | ----------- |
| 1 | RED | 610edda2 | failing tests for shell, checkable diff, live Reaches-N |
| 1 | GREEN | c9cca9b7 | ReLockNotifyPrompt modal shell + checkable ChangeEntry list + recipient choice + Reaches-N (whole single-file component, incl. footer/send) |
| 2 | TEST | 0bb30f21 | send-wiring, Lock quietly, dismiss, and disabled/error state coverage |

## Verification / Gate Output

- `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` → **20 passed (1 file)**.
- `npm run type-check` (`vue-tsc --build`, typechecks the test file too) → **clean, no errors**.
- `npx vitest run` (full app suite) → **2 failed | 114 passed (116 files); 13 failed | 3563 passed (3576 tests)** — the 13 failing tests are exactly the documented known-failing baseline (`src/storage.rules.test.ts` Storage-emulator cross-service limitation + `src/views/__tests__/RosterView.test.ts` stale assertion), identical to 62-01's same-day baseline (13 failed). `ReLockNotifyPrompt.test.ts` is among the 114 passed; no other file regressed.
  - **Explicit confirmations:** the rejected-send test ("a rejected send shows the inline error, re-enables Send, and emits NEITHER sent NOR cancel") **passes** — the load-bearing SC4 safe-retry basis. The Lock-quietly-no-send test ("Lock quietly emits cancel and NEVER calls queueServiceMessage") **passes**.

## TDD Gate Compliance

Task 1 followed a strict RED (610edda2) → GREEN (c9cca9b7) cycle. Task 2 is a **test-addition** commit (0bb30f21): its send/disabled/error/cancel behavior was authored inside Task 1's single-file GREEN component (the `.vue` is one cohesive file per 62-UI-SPEC), so a fresh Task 2 RED against the Task-1 component would not have failed. Documented as deviation #1 below. All 20 tests pass; a `test(...)` and a `feat(...)` commit both exist for the plan.

## Deviations from Plan

**1. [Rule 3 - Cohesion] Task 2 implementation front-loaded into Task 1's component GREEN**
- **Found during:** Task 1
- **Issue:** The plan splits the modal into two TDD tasks (Task 1 shell/list/choice/Reaches-N; Task 2 send/Lock-quietly/disabled/error), but the footer, `onSend`, `onCancel`, and disabled/error state are part of the same single `ReLockNotifyPrompt.vue` file and are structurally interdependent with the shell. Authoring them together produced one coherent, compilable component rather than an intermediate component with dangling footer markup.
- **Fix:** The full component landed in Task 1's GREEN (c9cca9b7). Task 2 (0bb30f21) adds the send-wiring test coverage that pins the behavior. The net artifact set and every plan behavior/verify item are satisfied.
- **Files modified:** src/components/ReLockNotifyPrompt.vue (Task 1), src/components/__tests__/ReLockNotifyPrompt.test.ts (both tasks)
- **Verification:** 20/20 scoped tests pass; type-check clean; app suite at baseline.
- **Commit:** c9cca9b7 (impl), 0bb30f21 (Task 2 tests)

**Total deviations:** 1 auto-applied (1 cohesion/ordering). **Impact:** none on deliverables — both artifacts exist, all behaviors verified; only the per-task commit boundary shifted.

## Known Stubs

None — the modal renders the `ChangeEntry[]` it is handed and wires a real (deploy-gated) `queueServiceMessage` call. No hardcoded empty data flows to the UI.

## Threat Flags

None new. Send passes only the `recipientSelector` + `changeDiff` (team labels/descriptions, no emails) — the client `reachableCount` is a `resolveRecipients` estimate for the Reaches-N line only; the server re-resolves and re-checks the kill-switch (T-62-03a/T-62-03c mitigated, asserted by the selector-only + no-`@example.com` payload test). The affected union derives only from CHECKED entries (T-62-03b). A rejected send emits nothing, leaving the snapshot as the safe basis (T-62-03d). Zero packages installed (T-62-SC accept).

## Next Phase Readiness

Ready for 62-04. `ReLockNotifyPrompt.vue` is the client surface the re-lock lock-hook opens on a non-empty diff with messaging ON; it emits `sent` (send succeeded) and `cancel` (Lock quietly / dismiss), both of which 62-04 maps to the `lockSnapshots/current` overwrite. The send path rides the deploy-gated `queueServiceMessage` (shared with Phase 59) — no deploy, secret, or new package in this plan; the deployed-path manual check is deferred to the owner at `/gsd-verify-work 62` (verification_deferred_human).

## Self-Check: PASSED

- `src/components/ReLockNotifyPrompt.vue` exists (checkable ChangeEntry rows, affected-vs-everyone choice, live Reaches-N, Send notice + Lock quietly).
- `src/components/__tests__/ReLockNotifyPrompt.test.ts` exists (20 passing tests).
- Commits 610edda2, c9cca9b7, 0bb30f21 present in `git log`.
