---
phase: 129-admin-resend-email-copy
plan: 01
subsystem: api
tags: [firebase-functions, onCall, resend, authz, firestore]

# Dependency graph
requires:
  - phase: 128-self-service-magic-link-request-public-security-critical-sha
    provides: "mintAndSendVolunteerLink shared mint+send core, requestVolunteerLinkHandler roster-gate pattern"
provides:
  - "mintVolunteerLink(args): Promise<string> -- sole generateSignInWithEmailLink call site"
  - "adminVolunteerLinkHandler + export const adminVolunteerLink onCall -- authenticated, editor/admin-gated callable"
  - "AdminVolunteerLinkRequest/Response typed contract for the client (Plan 02)"
affects: [129-02 (RosterView.vue UI affordance for email/copy)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mint-only helper extracted from a mint+send composition so a second caller can obtain the artifact without triggering the side effect (R402 single code path)"
    - "authenticated callable authz re-check mirrors queueServiceMessageHandler's members/{uid} role gate verbatim, scoped to the server-resolved orgRef"
    - "honest HttpsError codes for an authenticated/trusted-caller path, deliberately omitting the sibling public callable's enumeration-safety machinery (generic response, rate limiters, timing pad)"

key-files:
  created: []
  modified:
    - functions/src/volunteerLink.ts
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "mintVolunteerLink extracted as the sole Admin-SDK mint call site; mintAndSendVolunteerLink composes it unchanged so Phase 128's requestVolunteerLinkHandler and its tests are byte-for-byte unaffected"
  - "adminVolunteerLink is a single callable with mode:'email'|'copy' (not two callables), per CONTEXT.md's locked one-code-path design"
  - "No enumeration-safety machinery (generic response/rate limiters/timing pad) ported to the admin path -- caller is an authenticated, roster-visible editor, so honest HttpsError codes are more useful"
  - "Updated a pre-existing R131 source-inspection test's hardcoded RESEND_API_KEY binding count from 2 to 3, since adminVolunteerLink legitimately adds the third (and only new) binding this phase"

patterns-established:
  - "Pattern: split a `mint+send` composition into `mint` + `mint-then-send` so a copy-without-send caller reuses the exact mint logic instead of duplicating it"

requirements-completed: [R400, R401, R402]

coverage:
  - id: D1
    description: "adminVolunteerLinkHandler mode:'email' on a roster hit sends via the shared mint/send core and returns { sent: true }"
    requirement: "R400"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#ALLOW-1: editor, roster hit, mode:'email' -> { sent: true }, sends via the shared core, mints emailLower exactly once"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#ALLOW-3: role 'admin' succeeds identically to 'editor' for both modes"
        status: pass
    human_judgment: false
  - id: D2
    description: "adminVolunteerLinkHandler mode:'copy' on a roster hit returns { link } without calling Resend"
    requirement: "R401"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#ALLOW-2: editor, roster hit, mode:'copy' -> { link }, does NOT call Resend, mints emailLower exactly once"
        status: pass
    human_judgment: false
  - id: D3
    description: "Single shared mint code path (mintVolunteerLink) used by both modes; roster-gated on emailLower; one authz model (editor/admin members re-check, honest errors)"
    requirement: "R402"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#DENY-1..6 (unauthenticated, non-member, viewer role, cross-org, not-on-roster, no-email, invalid-argument)"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#requestVolunteerLinkHandler (unchanged, Phase 128 regression guard)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-06
status: complete
---

# Phase 129 Plan 01: Admin Resend Backend Summary

**New authenticated `adminVolunteerLink` callable lets an editor/admin email or copy a rostered volunteer's sign-in link through Phase 128's single shared mint core, gated by an independent server-side members/{uid} role re-check.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 3 (`functions/src/volunteerLink.ts`, `functions/src/index.ts`, `functions/src/index.test.ts`)

## Accomplishments
- Extracted `mintVolunteerLink(args): Promise<string>` as the sole Admin-SDK mint call site; `mintAndSendVolunteerLink` now composes it, with the existing send behavior unchanged.
- Added `adminVolunteerLinkHandler` + `export const adminVolunteerLink = onCall({ secrets: [RESEND_API_KEY] }, ...)`: authenticated, editor/admin-gated (mirrors `queueServiceMessageHandler`'s `members/{uid}` role re-check, scoped to the server-resolved `orgRef`), roster-gated on `emailLower` via the same full-fetch + in-memory lowercase compare as `requestVolunteerLinkHandler`. `mode:'email'` sends via `mintAndSendVolunteerLink`; `mode:'copy'` returns the raw link via `mintVolunteerLink` alone (no send).
- Added a 10-case ALLOW/DENY test matrix in `index.test.ts` (nested inside the `requestVolunteerLinkHandler` describe to reuse its fake Firestore, extended with a `members/{uid}` fake) proving the authz gate, roster gate, honest-error behavior for not-on-roster/no-email targets, both mode outcomes, and the single shared mint path (exactly-once mint mock assertion in ALLOW-1/2).

## Task Commits

1. **Task 1: Extract mintVolunteerLink from volunteerLink.ts** - `0402ce97` (refactor)
2. **Task 2: Add authenticated adminVolunteerLink callable + handler + types** - `1cbe9b95` (feat)
3. **Task 3: adminVolunteerLinkHandler test suite** - `4cc91506` (test)

_Plan metadata commit follows this summary._

## Files Created/Modified
- `functions/src/volunteerLink.ts` - extracted `mintVolunteerLink`; `mintAndSendVolunteerLink` now composes it
- `functions/src/index.ts` - new `AdminVolunteerLinkRequest`/`Response` types, `adminVolunteerLinkHandler`, `export const adminVolunteerLink`
- `functions/src/index.test.ts` - new nested `adminVolunteerLinkHandler` describe block (10 tests); extended `fakeVolunteerDb`'s `makeOrgRef` with a `members` subcollection fake; updated the pre-existing R131 source-inspection test's binding count

## Decisions Made
- Named the callable `adminVolunteerLink` (CONTEXT.md offered this and `sendVolunteerLinkForAdmin` as examples, not locked).
- Not-on-roster / no-email target uses `HttpsError('failed-precondition', ...)` (CONTEXT.md left the exact code to discretion; any non-2xx code works, consistency matters more than the specific choice).
- Nested the new test describe block inside the existing `requestVolunteerLinkHandler` describe (rather than a sibling top-level describe) so it can directly reuse `fakeVolunteerDb`/`fakeVolunteerRequest`/`setGenerateLink` closures without duplicating fixture code; `vitest -t "adminVolunteerLinkHandler"` still matches nested test names correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a pre-existing test's hardcoded RESEND_API_KEY binding count**
- **Found during:** Task 3 (running the full `index.test.ts` suite after adding the new callable)
- **Issue:** A Phase-128-era source-inspection test (`SOURCE INSPECTION: RESEND_API_KEY is bound to EXACTLY the sendQueuedMessage and requestVolunteerLink Functions...`) hardcoded `expect(bindings).toHaveLength(2)`. Adding the intentional, plan-mandated third binding (`adminVolunteerLink`) broke this assertion even though the new binding is correct per the phase's own T-129-05 threat mitigation (bind the secret to exactly one new function, nothing else).
- **Fix:** Updated the test's expected count to 3, renamed its title to mention `adminVolunteerLink`, and added an explicit assertion that `adminVolunteerLink`'s own `onCall` block also declares the secret (matching the existing per-function assertion pattern for `sendQueuedMessage`/`requestVolunteerLink`).
- **Files modified:** functions/src/index.test.ts
- **Verification:** `cd functions && npx vitest run src/index.test.ts src/volunteerLink.test.ts` and `cd functions && npm test` both green (343 / 701 tests respectively).
- **Committed in:** 4cc91506 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — stale test assertion)
**Impact on plan:** Necessary to keep the full suite green; the underlying binding growth was explicitly planned and threat-modeled (T-129-05), only the test's hardcoded count was stale. No scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required. `RESEND_API_KEY` was already configured in Phase 128; this phase reuses it, does not deploy, and introduces no new secret.

## Next Phase Readiness
- Backend callable contract (`adminVolunteerLink`: request `{ orgId, email, mode }`, response `{ sent: true }` / `{ link }`, honest `HttpsError` on denial) is ready for Plan 02's `RosterView.vue` UI affordance.
- Not deployed to prod this phase (owner-gated batched UAT per CONTEXT.md) -- Plan 02 or a later phase must handle the `firebase deploy --only functions:adminVolunteerLink` step alongside UAT.
- All gates green: `cd functions && npx vitest run src/index.test.ts src/volunteerLink.test.ts` (343 tests), `cd functions && npm test` (701 tests), `cd functions && npx tsc --noEmit` (clean), `npm run type-check` (clean, `vue-tsc --build` form).

---
*Phase: 129-admin-resend-email-copy*
*Completed: 2026-09-06*

## Self-Check: PASSED
All created/modified files confirmed present; all task commit hashes (0402ce97, 1cbe9b95, 4cc91506) confirmed in git log.
