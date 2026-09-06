---
phase: 125-passwordless-magic-link-access-scoped-read-isolation
plan: 03
subsystem: messaging
tags: [firebase-admin, firebase-auth, email-link, resend, cloud-functions, magic-link]

# Dependency graph
requires:
  - phase: 125 (plan 01/02, if any prior)
    provides: R374 client-side email-link sign-in flow context (RESEARCH.md)
provides:
  - "{{rehearse_link}} merge token in functions/src/messageTokens.ts, rendered from a required rehearseLink field on MessageTokenContext"
  - "Per-recipient server-side magic sign-in link minted inside sendQueuedMessageHandler via getAuth().generateSignInWithEmailLink()"
  - "actionCodeSettings.url resolved from the existing SERVICE_SHARE_BASE_URL param + '/volunteer/verify' (no new param)"
affects: [126-my-schedule, 127-rehearse-ui, volunteer-sign-in-completion-route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side generateSignInWithEmailLink (Admin SDK) instead of client sendSignInLinkToEmail, to avoid a second Firebase-branded email"
    - "Per-recipient auth-link generation lives inside the SAME per-recipient try/catch as the existing resend.emails.send call, so one recipient's failure never aborts the batch"

key-files:
  created: []
  modified:
    - functions/src/messageTokens.ts
    - functions/src/messageTokens.test.ts
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "Reused the existing SERVICE_SHARE_BASE_URL param for the sign-in continue-URL base (appending /volunteer/verify) rather than adding a new Cloud Functions param, per RESEARCH.md Open Question 2 — no concrete path conflict was found"
  - "actionCodeSettings computed ONCE per message (same base URL for every recipient), not per-recipient, since only the target email argument to generateSignInWithEmailLink varies per recipient"

patterns-established:
  - "New merge tokens follow the exact one-field/one-replaceToken-line idiom already used by service_link"

requirements-completed: [R375]

coverage:
  - id: D1
    description: "MessageTokenContext gains a required rehearseLink field; renderMessageTokens substitutes {{rehearse_link}} identically to the existing service_link token"
    requirement: "R375"
    verification:
      - kind: unit
        ref: "functions/src/messageTokens.test.ts#replaces {{rehearse_link}} with THIS recipient's personal magic sign-in link (R375)"
        status: pass
      - kind: unit
        ref: "functions/src/messageTokens.test.ts#R375: the SAME body template renders a DIFFERENT {{rehearse_link}} for recipient A vs recipient B"
        status: pass
      - kind: unit
        ref: "functions/src/messageTokens.test.ts#a template WITHOUT {{rehearse_link}} is unaffected by the new token"
        status: pass
    human_judgment: false
  - id: D2
    description: "sendQueuedMessageHandler mints a per-recipient sign-in link server-side via getAuth().generateSignInWithEmailLink() inside the existing per-recipient try/catch, feeding tokenCtx.rehearseLink, without changing the resend.emails.send call shape or the sent/failed/partial rollup"
    requirement: "R375"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler (full describe block, 19 tests, all still pass with generateSignInWithEmailLink wired into the send loop)"
        status: pass
      - kind: other
        ref: "cd functions && npm run build (tsc)"
        status: pass
    human_judgment: true
    rationale: "Whether the emailed link actually completes sign-in in production requires the owner's Firebase Console Email-link provider + Authorized-domain setup (user_setup, not code) and a live Resend send — batched UAT per plan's <verification> section, not something this executor can prove standalone."
  - id: D3
    description: "A generateSignInWithEmailLink failure for one recipient marks only that recipient 'failed' and does not abort the send batch (T-125-13)"
    requirement: "R375"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#partial failure: one rejecting send → that recipient is 'failed', the batch continues, message rolls up to 'partial'"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-05
status: complete
---

# Phase 125 Plan 03: Server-Minted Magic Sign-In Link in the Existing Volunteer Email Summary

**Every reminder/share recipient's existing v1.7 email now carries a personal `{{rehearse_link}}` magic sign-in link minted server-side via `getAuth().generateSignInWithEmailLink()` inside `sendQueuedMessageHandler` — no second email, no new email system.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-05T23:53:00-04:00 (approx, first task commit at 23:55)
- **Completed:** 2026-09-05T23:58:50-04:00
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- `MessageTokenContext` gained a required `rehearseLink: string` field; `renderMessageTokens` substitutes `{{rehearse_link}}` using the exact same one-line `replaceToken` idiom as `service_link`.
- `sendQueuedMessageHandler` now computes `actionCodeSettings` (url = `SERVICE_SHARE_BASE_URL` + `/volunteer/verify`, `handleCodeInApp: true`) once per message, and inside the existing per-recipient try/catch calls `getAuth().generateSignInWithEmailLink(target.email, actionCodeSettings)` before building `tokenCtx`, feeding the result into `tokenCtx.rehearseLink`.
- Verified: `generateSignInWithEmailLink` returns a URL string only and never sends email itself, so the link rides the ONE existing Resend send — no client-side `sendSignInLinkToEmail` was added anywhere.
- A link-generation failure for one recipient falls into the existing catch block, marking only that recipient `'failed'`; the batch's `sent`/`failed`/`partial` rollup logic is unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the rehearseLink / {{rehearse_link}} merge token** - `237808f6` (feat)
2. **Task 2: Mint the link per recipient inside sendQueuedMessageHandler** - `e912321b` (feat, includes a Rule 3 test-mock fix)

**Plan metadata:** commit created below (docs: complete plan)

## Files Created/Modified
- `functions/src/messageTokens.ts` - Added `rehearseLink: string` to `MessageTokenContext` and the `{{rehearse_link}}` → `ctx.rehearseLink` substitution line
- `functions/src/messageTokens.test.ts` - Extended the shared `ctx()` fixture with a `rehearseLink` sample value; added 3 new assertions (renders the link, per-recipient variation, unaffected-when-absent)
- `functions/src/index.ts` - Added `rehearseActionCodeSettings` (computed once per message from `SERVICE_SHARE_BASE_URL` + `/volunteer/verify`) and the per-recipient `getAuth().generateSignInWithEmailLink()` call inside the existing send-loop try block
- `functions/src/index.test.ts` - Added `generateSignInWithEmailLink` to the module-level `firebase-admin/auth` mock; added a `beforeEach` re-pin of the full `getAuth()` mock shape inside the `sendQueuedMessageHandler` describe block (see Deviations)

## Decisions Made
- Reused the existing `SERVICE_SHARE_BASE_URL` param (same one `resolveServiceLink`/`resolveAppBaseUrl` already read) for the sign-in continue-URL base, rather than introducing a new Cloud Functions param — per RESEARCH.md Open Question 2, no concrete conflict was found between the `/share/:token` and `/volunteer/verify` path conventions.
- `actionCodeSettings` is computed ONCE per message (outside the per-recipient loop) since the base URL is identical for every recipient in a given send; only the `target.email` argument to `generateSignInWithEmailLink` varies per recipient.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `index.test.ts`'s `getAuth` mock was missing `generateSignInWithEmailLink`, breaking 19 existing `sendQueuedMessageHandler` tests**
- **Found during:** Task 2, after adding the `getAuth().generateSignInWithEmailLink()` call and running `cd functions && npm test`
- **Issue:** The module-level `vi.mock("firebase-admin/auth", ...)` factory returned an object without `generateSignInWithEmailLink`, so every recipient's link-generation call threw `... .generateSignInWithEmailLink is not a function`, which the (correctly-implemented) per-recipient catch turned into 19 previously-passing tests now asserting `'failed'`/`0 sends` instead of `'sent'`. Root cause was two-layered: (a) the top-level mock factory lacked the method, and (b) several EARLIER `describe` blocks in the same file call `vi.mocked(getAuth).mockReturnValue({...})` with a narrower shape (e.g. `verifyIdToken`-only fakes for `/api` auth tests) and never reset it, so by the time the `sendQueuedMessageHandler` describe ran later in the same file, `getAuth()` was still returning one of those narrower, stale overrides.
- **Fix:** Added `generateSignInWithEmailLink: vi.fn(async (email) => ...)` to the top-level mock factory, AND added a `beforeEach` inside the `sendQueuedMessageHandler` describe block that re-pins `vi.mocked(getAuth).mockReturnValue(...)` with the full shape (`verifyIdToken`, `getUser`, `generateSignInWithEmailLink`) before every test in that block, so it can never inherit a stale override from an earlier describe.
- **Files modified:** `functions/src/index.test.ts`
- **Verification:** `cd functions && npm test` — all 665 tests pass (was 19 failing before the fix); `cd functions && npm run build` succeeds
- **Committed in:** `e912321b` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was strictly necessary to keep the existing test suite green after the plan's own required change (per-recipient `generateSignInWithEmailLink` call) — no scope creep, no production code touched beyond what the plan specified.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

**External services require manual configuration** (owner-gated, tracked per plan frontmatter `user_setup`, not attempted by this executor):
1. Firebase Console → Authentication → Sign-in method → Email/Password → enable **Email link (passwordless sign-in)** on project `worship-planner-bc515`.
2. Firebase Console → Authentication → Settings → Authorized domains → add the app's hosting domain (the `SERVICE_SHARE_BASE_URL` host).

Local emulator testing and this plan's automated verification (`cd functions && npm test -- messageTokens`, `cd functions && npm run build`) are unaffected by these two owner-run steps — they only gate a real, production sign-in completing when a recipient clicks the emailed link. See the plan's `<verification>` section for the deferred batched-UAT step (send a real reminder/share to a rostered volunteer and confirm the link completes sign-in).

## Next Phase Readiness
- `functions/src/messageTokens.ts` and `functions/src/index.ts` are ready for Plan 04 (the `/volunteer/verify` completion route) to consume — the emailed link's continue-URL already targets that exact path.
- No blockers for Phase 126 (My Schedule) or Phase 127 (Rehearse UI); this plan only touches the messaging-send pipeline, not the client-side sign-in completion flow or the `rehearseAccess` scoped-read projection (both out of this plan's scope per its `files_modified` list).
- Owner prerequisite (Email-link provider + Authorized domains) remains open and must be completed before any production email's link can complete sign-in — flagged above, not blocking further code development.

---
*Phase: 125-passwordless-magic-link-access-scoped-read-isolation*
*Completed: 2026-09-05*
