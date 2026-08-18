---
phase: 64-composer-refinements
plan: 03
subsystem: ui
tags: [vue, vitest, message-composer, tdd, jsdom, tokens]

# Dependency graph
requires:
  - phase: 64-01
    provides: R151 team-label assertions in MessageComposer.test.ts (shared test file — ordered after)
  - phase: 64-02
    provides: server {{name}} token render (client sample kept faithful to it)
provides:
  - Visible standalone add-someone <select> picker (disabled placeholder + empty-state)
  - Always-on live sample preview (showPreview ref + Preview button removed)
  - Token palette with {{name}} chip, {{song_list}} chip dropped; sample renders {{name}}
  - White in-button Send spinner with Send + Cancel disabled in flight
  - Success-toast removal (resolves the Phase 59 ToastHost "Save failed." misrender)
  - Aligned per-type seeds with recipientDirty guard (Reminder → Everyone when clean)
affects: [messaging, message-composer, verify-work, v1.8-milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recipientDirty flag mirrors subjectDirty/bodyDirty — a dirty guard gating an auto-default (Reminder → Everyone) without clobbering a manual choice"
    - "Success feedback via emit('sent') + modal close + history panel instead of the failure-only toast store"

key-files:
  created: []
  modified:
    - src/components/MessageComposer.vue
    - src/components/__tests__/MessageComposer.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "Kept the p.active filter on addablePeople — Person.active is a required boolean (roster.ts:19); the stated fallback was not needed"
  - "Kept the song_list fill line + songList computed in renderSample (harmless, mirrors the server retaining song_list) even though the chip was dropped"
  - "Reminder body copy drops {{their_roles}} in favour of {{name}}/{{service_link}}; the type-seeding test assertion was moved to {{service_link}}"

patterns-established:
  - "Pattern 1: dirty-guarded auto-default — a per-field '*Dirty' ref set in every mutation and reset in resetComposer, checked before an automatic seed"

requirements-completed: [R152, R153, R154, R155, R156]

coverage:
  - id: D1
    description: "R152 — visible standalone add-someone <select>: disabled '＋ Add someone…' placeholder, adds a removable pill + bumps Reaches N, disabled 'No one left to add' when empty"
    requirement: R152
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#add-someone picker (R152 — visible standalone select)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#adding an individual writes individualPersonIds; the added person is excluded from the picker"
        status: pass
    human_judgment: false
  - id: D2
    description: "R153 — sample-preview renders always (no Preview button / showPreview ref) and updates live as subject/body change"
    requirement: R153
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#renders the sample-preview on mount with NO Preview button, and updates live as the subject changes"
        status: pass
    human_judgment: false
  - id: D3
    description: "R154 client — token palette has a Name chip and no Song list chip; the sample renders {{name}} as the recipient's own name"
    requirement: R154
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#offers a Name token chip and NO Song list chip"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#renders {{name}} as the sample recipient own name in the preview"
        status: pass
    human_judgment: false
  - id: D4
    description: "R155 — Send shows a white in-button spinner + 'Sending…', stays disabled with Cancel disabled while sending; success pushes NO toast and still emits 'sent'"
    requirement: R155
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#shows an in-button spinner + \"Sending\" and disables Send/Cancel while the send is in flight (R155)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#calls queueServiceMessage with the recipient SELECTOR only — no raw email list crosses to the server"
        status: pass
    human_judgment: false
  - id: D5
    description: "R156 — aligned per-type seeds; Reminder defaults recipients to Everyone on a clean set behind the recipientDirty guard; One-off/Share-link never auto-set Everyone; subject/body dirty guards hold"
    requirement: R156
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#Reminder defaults recipients to Everyone when the recipient set is clean (R156)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#Reminder does NOT flip to Everyone after the user picked a team (recipientDirty guard)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#One-off and Share-link never auto-set Everyone"
        status: pass
    human_judgment: false
  - id: D6
    description: "Composer end-to-end visual UAT — add a person via the visible picker + Reaches N bump, live preview updates as you type/switch types, in-button spinner with no 'Save failed.' toast on send"
    verification: []
    human_judgment: true
    rationale: "Live-app visual/interaction behaviour of an undeployed callable; jsdom proves wiring but not the rendered look/feel. Deferred to the owner at /gsd-verify-work 64 (verification_deferred_human)."

# Metrics
duration: 13min
completed: 2026-08-16
status: complete
---

# Phase 64 Plan 03: Composer Refinements Summary

**MessageComposer client pass — a working visible add-person picker, an always-on live sample preview, a {{name}} token palette, a white in-button Send spinner with the misrendering success toast removed, and dirty-guarded per-type seeds that default Reminder to Everyone.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-16T02:00:28Z
- **Completed:** 2026-08-16T02:13:33Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 2 source (+ 1 planning doc)

## Accomplishments
- R152 — replaced the `<label>`-wrapped hidden select with a visible standalone `add-someone-select`: a disabled `＋ Add someone…` placeholder, reuses the unchanged `onAddIndividual`, and quietly disables with a `No one left to add` placeholder when the picker is empty.
- R153 — deleted the `showPreview` ref, the Preview button, and the `v-if` gate so the sample-preview renders always and updates live from the reactive `samplePreview` computed.
- R154 client — dropped the `{{song_list}}` chip, added `{{name}}`, and `renderSample` now fills `{{name}}` from the sample recipient's name (faithful to the 64-02 server render); the legacy `song_list` fill stays.
- R155 — added a white in-button spinner (`animate-spin`, `aria-hidden`) with Send + Cancel disabled while sending, and removed the success `toasts.push(...)` (+ the now-unused `useToasts` import) that the failure-only `ToastHost` misrendered as "Save failed."
- R156 — aligned `TYPE_DEFAULTS` copy and added a `recipientDirty` flag so `selectType('reminder')` defaults `includeEveryone` only when the recipient set is untouched.
- Marked the Phase 59 composer success-toast defect RESOLVED in PENDING-VERIFICATION.md and routed the composer end-to-end visual UAT there as DEFERRED.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: add-person picker / live preview / {{name}} tests** - `cc0bee37` (test)
2. **Task 1 GREEN: visible picker + always-on preview + {{name}} token** - `1292dda9` (feat)
3. **Task 2 RED: spinner / no-toast / Reminder-everyone tests** - `930c0204` (test)
4. **Task 2 GREEN: spinner + drop toast + type seeds + recipientDirty** - `18562de9` (feat)

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified
- `src/components/MessageComposer.vue` - Visible add-person select, always-on preview, `{{name}}` token + sample fill, Send spinner, success-toast removal, aligned `TYPE_DEFAULTS`, `recipientDirty` guard.
- `src/components/__tests__/MessageComposer.test.ts` - Added R152/R153/R154/R155/R156 behavior tests; flipped the success-toast assertion to `not.toHaveBeenCalled()`; moved the reminder-body assertion to `{{service_link}}`.
- `.planning/PENDING-VERIFICATION.md` - Marked the Phase 59 success-toast defect RESOLVED (by 64-03); added the 64-03 composer visual UAT as DEFERRED.

## Decisions Made
- Kept the `p.active` filter on `addablePeople` — `Person.active` is a required boolean (roster.ts:19), so the stated fallback (relax to exclude-already-selected only) was not needed.
- Kept the `song_list` fill line + `songList` computed in `renderSample` even though the chip was dropped — harmless and mirrors the server retaining `song_list`, so a legacy template still renders in the sample.
- The new Reminder body copy drops `{{their_roles}}` in favour of `{{name}}`/`{{service_link}}`; the existing type-seeding assertion was moved from `{{their_roles}}` to `{{service_link}}` (present in the new copy) per the plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Gate Results
- `npx vitest run src/components/__tests__/MessageComposer.test.ts` — **28 passed** (1 file).
- `npm run type-check` (`vue-tsc --build`, typechecks the test file) — **clean**.
- `npx vitest run` (full app suite) — **114 passed / 2 failed files**, exactly the known-failing baseline (`src/storage.rules.test.ts` — Storage-emulator cross-service `firestore.exists()` limitation; `src/views/__tests__/RosterView.test.ts` — stale assertion). **No new failing file.**

## User Setup Required
None - no external service configuration required. No deploy, no `.env.local`; the client calls the still-undeployed `queueServiceMessage` (mocked in tests).

## Next Phase Readiness
- Final plan of milestone v1.8 — all v1.8 composer refinements landed.
- Composer end-to-end visual UAT is deferred to the owner at `/gsd-verify-work 64` (recorded in PENDING-VERIFICATION.md as `verification_deferred_human`).

## Self-Check: PASSED

- Files present: `64-03-SUMMARY.md`, `MessageComposer.vue`, `MessageComposer.test.ts`.
- Commits present: `cc0bee37`, `1292dda9`, `930c0204`, `18562de9`.

---
*Phase: 64-composer-refinements*
*Completed: 2026-08-16*
