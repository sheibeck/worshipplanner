---
phase: 129-admin-resend-email-copy
plan: 02
subsystem: ui
tags: [vue, firebase-functions, httpsCallable, clipboard, roster, toasts]

# Dependency graph
requires:
  - phase: 129-01
    provides: "adminVolunteerLink({orgId,email,mode}) authenticated callable — email mode returns {sent:true}, copy mode returns {link}"
provides:
  - "RosterView.vue drawer 'Sign-in Link' section (Email/Copy sign-in link) for a rostered volunteer with an email"
  - "onEmailSignInLink/onCopySignInLink handlers wired to adminVolunteerLink, with toast + label-flip feedback"
affects: [roster, volunteer-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed httpsCallable(functions, 'adminVolunteerLink') invocation, mirroring ServiceEditorView's queueServiceMessage call"
    - "Copy-to-clipboard transient label-flip idiom (local ref + setTimeout reset), mirroring ServiceEditorView's shareCopied/shareError"
    - "Client-local request/response interfaces duplicated (not imported) across the functions/src tsconfig boundary"

key-files:
  created: []
  modified:
    - src/views/RosterView.vue
    - src/views/__tests__/RosterView.test.ts
    - src/views/__tests__/RosterViewEditQuery.test.ts

key-decisions:
  - "Placed the affordance inside the existing Add/Edit drawer as a new section after Status, not a new per-row action menu — no new chrome, per UI-SPEC"
  - "Email success/error use the global toast store; Copy success/error use an inline button-label flip (no toast) — matches the established Roster/ServiceEditor split"
  - "No confirmation dialog before minting a volunteer's sign-in link — accepted trust tradeoff (T-129C-02), documented in the phase threat model, not re-litigated in the UI"

patterns-established:
  - "Separate busy refs per concurrent action (emailingLink/copyingLink) so one in-flight callable never disables the other button"

requirements-completed: [R400, R401]

coverage:
  - id: D1
    description: "Volunteer WITH an email shows 'Email sign-in link' and 'Copy sign-in link' buttons plus help copy in the edit drawer"
    requirement: "R400"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RosterView.test.ts#renders the Email/Copy sign-in link buttons and help copy for a person WITH an email"
        status: pass
    human_judgment: false
  - id: D2
    description: "Email sign-in link invokes adminVolunteerLink(mode:'email') and shows a success toast"
    requirement: "R400"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RosterView.test.ts#Email sign-in link calls adminVolunteerLink with mode:email and pushes a success toast"
        status: pass
    human_judgment: false
  - id: D3
    description: "Copy sign-in link invokes adminVolunteerLink(mode:'copy'), writes the link to the clipboard, and flips the button label to 'Link copied!'"
    requirement: "R401"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RosterView.test.ts#Copy sign-in link calls adminVolunteerLink with mode:copy, writes to clipboard, and flips the label"
        status: pass
    human_judgment: false
  - id: D4
    description: "Volunteer with NO email hides both buttons and shows an explanatory line instead"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RosterView.test.ts#hides the Email/Copy buttons and shows the explanatory line for a person with NO email"
        status: pass
    human_judgment: false
  - id: D5
    description: "A rejected email-mode callable pushes an error-variant toast and does not throw uncaught"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RosterView.test.ts#an email-mode callable rejection pushes an error-variant toast and does not throw"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual polish (button placement, spacing, wrap behavior, color) matches 129-UI-SPEC.md exactly"
    verification: []
    human_judgment: true
    rationale: "Visual/interaction fidelity to the UI-SPEC mock is a judgment call best confirmed by a human looking at the rendered drawer; deferred to the phase's batched UAT pass per CONTEXT.md."

# Metrics
duration: 27min
completed: 2026-09-06
status: complete
---

# Phase 129 Plan 02: RosterView Sign-in Link Drawer Summary

**RosterView drawer "Sign-in Link" section with Email/Copy affordances wired to Plan 01's `adminVolunteerLink` callable, plus a Rule-1 regression fix in a sibling test file.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-06T16:24:40-04:00 (first task commit)
- **Completed:** 2026-09-06T16:51:15-04:00 (last commit)
- **Tasks:** 2 (both from the plan) + 1 auto-fixed regression
- **Files modified:** 3

## Accomplishments
- Added a "Sign-in Link" section to RosterView's Add/Edit Volunteer drawer, immediately after the existing "Status" block, gated on `v-if="editingPerson"` so it never renders in Add-Volunteer mode.
- `onEmailSignInLink()` calls `httpsCallable(functions, 'adminVolunteerLink')({orgId, email, mode:'email'})` and surfaces a success toast (`variant: 'success'`) or an honest error toast on failure, toggling `emailingLink` around the call.
- `onCopySignInLink()` calls the callable with `mode:'copy'`, writes the returned link to `navigator.clipboard`, and flips the button's own label to "Link copied!" for ~2s (no toast) — mirroring `ServiceEditorView.vue`'s `shareCopied`/`shareError` idiom.
- A volunteer with no email sees an explanatory line ("Add an email address above...") instead of the two buttons.
- Added 5 new view tests covering: buttons+copy render for a person WITH an email, email-mode success toast, copy-mode clipboard write + label flip, no-email hidden state, and email-mode rejection toast.
- Fixed a Rule-1 regression in `RosterViewEditQuery.test.ts` (a sibling test file that mounts `RosterView.vue` without an active Pinia) surfaced by adding `useToasts()` to the component.

## Task Commits

Each task was committed atomically:

1. **Task 1: RosterView drawer "Sign-in Link" section + email/copy handlers (R400, R401)** - `ae35150a` (feat)
2. **Task 2: RosterView view tests — email/copy/clipboard/hidden-state (R400, R401)** - `dca0ae84` (test)

**Deviation fix:** `6ba82e3b` (fix) — regression in `RosterViewEditQuery.test.ts`, see Deviations below.

_No plan-metadata commit yet — this SUMMARY.md + STATE.md/ROADMAP.md update is committed separately per the executor's final_commit step._

## Files Created/Modified
- `src/views/RosterView.vue` - Added the "Sign-in Link" drawer section markup, `httpsCallable`/`functions`/`useToasts` imports, client-local `AdminVolunteerLinkRequest`/`Response` interfaces, `emailingLink`/`copyingLink`/`linkCopied`/`linkCopyError` refs, `linkCopyLabel` computed, and `onEmailSignInLink`/`onCopySignInLink` handlers.
- `src/views/__tests__/RosterView.test.ts` - Added `firebase/functions`/`@/firebase`/`@/stores/toasts` mocks, a clipboard stub, and a new describe block with 5 tests for the Sign-in Link section.
- `src/views/__tests__/RosterViewEditQuery.test.ts` - Added the same three mocks (Rule 1 fix) so this deep-link-only suite (no active Pinia) doesn't fail on the newly-added real `useToasts()` call.

## Decisions Made
- Section placement: inside the existing drawer as a sibling to "Status", not a new per-row action menu — RosterView has no existing row-level action-menu chrome, and inventing one would violate the UI-SPEC's "no new chrome" constraint.
- Email feedback via the global toast store (matching the app-wide error-toast convention, including its "Save failed." compact-shape prefix quirk); Copy feedback via an inline label flip only — no toast for copy, matching `ServiceEditorView`'s share-link precedent.
- No destructive-action confirmation dialog before minting/copying a link — accepted per the phase's threat model (T-129C-02), not re-litigated in this plan's UI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a Pinia-activation regression in `RosterViewEditQuery.test.ts`**
- **Found during:** Task 2 verification (full app suite run after the new tests passed)
- **Issue:** Adding `useToasts()` to `RosterView.vue`'s setup broke a sibling test file, `RosterViewEditQuery.test.ts`, which mounts the real component but never activates a Pinia instance (it mocks every other store directly via `vi.mock`, avoiding real Pinia entirely). All 3 of its tests failed with `"getActivePinia() was called but there was no active Pinia."`
- **Fix:** Added the same `vi.mock('@/firebase', ...)`, `vi.mock('firebase/functions', ...)`, and `vi.mock('@/stores/toasts', ...)` mocks that `RosterView.test.ts` already carries, so the sibling file never touches the real Pinia-backed store.
- **Files modified:** `src/views/__tests__/RosterViewEditQuery.test.ts`
- **Verification:** Full app suite re-run confirmed the documented baseline — only `src/storage.rules.test.ts` fails (34 pre-existing Storage-emulator-dependent failures); `Test Files 1 failed | 212 passed (213)`, `Tests 34 failed | 5458 passed (5492)`.
- **Committed in:** `6ba82e3b`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** Necessary to keep the app suite at its documented baseline; no scope creep — fix was scoped to the single affected test file.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both Phase 129 plans (backend callable + client drawer affordance) are now built and verified.
- Per CONTEXT.md, this phase is NOT deployed — owner UAT and deploy are deferred to the batched pass (PENDING).
- `npm run type-check` (vue-tsc --build) is clean; `npx vitest run` matches the documented baseline (only `storage.rules.test.ts` fails, Storage-emulator dependent, not a regression).

---
*Phase: 129-admin-resend-email-copy*
*Completed: 2026-09-06*

## Self-Check: PASSED

All referenced files (`src/views/RosterView.vue`, `src/views/__tests__/RosterView.test.ts`, `src/views/__tests__/RosterViewEditQuery.test.ts`, this SUMMARY.md) and all referenced commit hashes (`ae35150a`, `dca0ae84`, `6ba82e3b`) verified present.
