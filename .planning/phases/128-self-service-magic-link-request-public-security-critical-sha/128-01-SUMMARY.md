---
phase: 128-self-service-magic-link-request-public-security-critical-sha
plan: 01
subsystem: functions (Cloud Functions) -- self-service volunteer magic-link request
tags: [security-critical, public-callable, rate-limit, enumeration-safety, resend, firebase-auth-email-link]
dependency-graph:
  requires: []
  provides:
    - functions/src/volunteerLink.ts::mintAndSendVolunteerLink
    - functions/src/index.ts::requestVolunteerLinkHandler
    - functions/src/index.ts::requestVolunteerLink (onCall export, secrets:[RESEND_API_KEY])
    - "volunteerLinkRateLimits Firestore collection (dedicated fixed-window counter)"
  affects:
    - functions/src/index.ts (new public onCall surface; second RESEND_API_KEY binding)
tech-stack:
  added: []
  patterns:
    - "Shared mint/send core module (mirrors functions/src/adminEmail.ts's standalone-send shape)"
    - "Public/unauthenticated onCall gated by roster-membership + dedicated rate limiter instead of request.auth"
    - "Timing-pad mitigation (setTimeout to a target elapsed-ms floor) on top of a byte-identical response body, to close an enumeration-via-timing side channel"
key-files:
  created:
    - functions/src/volunteerLink.ts
    - functions/src/volunteerLink.test.ts
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts
decisions:
  - "Rate limit ceilings hardcoded (VOLUNTEER_LINK_MAX_PER_MIN=1, _MAX_PER_DAY=5, _TARGET_RESPONSE_MS=1200ms), env-overridable via readNumericKnob, and exported from index.ts so the security test matrix can assert the pad and seed rate-limit windows precisely without duplicating magic numbers -- avoids the AppConfig client-duplicate-sync burden (128-RESEARCH Alternatives Considered)."
  - "slug for the continueUrl: accepts an optional `slug` field on the request payload, falling back to the org doc's own `slug` field (organizations/{orgId}.slug) when absent -- no reverse orgSlugs lookup needed since organizations/{orgId} already carries its own slug (src/types/organization.ts:112)."
  - "Timing pad implemented as a single `setTimeout`-based await to a fixed elapsed-ms floor on the no-match and rate-limited branches only; the roster-hit branch does its real work and returns without padding, since its own mint+send latency approximates the target in production."
metrics:
  duration: "~1.5 hours"
  completed: 2026-09-06
status: complete
---

# Phase 128 Plan 01: Self-Service Magic-Link Request — Server Core Summary

Shared Admin-SDK mint/send core plus a public, unauthenticated, roster-gated, rate-limited,
enumeration-safe (body AND timing) `requestVolunteerLink` Cloud Function callable.

## What was built

1. **`functions/src/volunteerLink.ts`** — `mintAndSendVolunteerLink({ db, to, orgName, slug })`, the
   sole application path that combines `getAuth().generateSignInWithEmailLink` (Admin-SDK mint) with
   `resend.emails.send` (delivery). Mirrors `adminEmail.ts`'s standalone-send shape exactly: resolves
   `AppConfig`, builds a header-safe From via `bareEmailAddress` + `fromDisplayName`, resolves the base
   URL via the `resolveAppBaseUrl` idiom, mints a link whose `url` carries `?slug=` **before** Firebase
   appends its own `apiKey`/`oobCode`/`mode` params, and sends a standalone (non-reminder) one-off
   subject/body. Reused by Phase 129's admin-resend callable (R402).

2. **`functions/src/index.ts` — `requestVolunteerLinkHandler` + `requestVolunteerLink`** — a PUBLIC
   onCall (no `request.auth` check; contrast `queueServiceMessageHandler`'s members-role re-check,
   which does not apply here). Gate order:
   - Structural input guard (`orgId`/`email` required, shallow `includes('@')&&includes('.')` format
     check) — the ONLY branch allowed to return a distinct code (`invalid-argument`), since it carries
     no membership information.
   - Fail-open `checkAndConsumeRateLimit` keyed `${orgId}::${emailLower}` on a **dedicated**
     `volunteerLinkRateLimits` collection (never `aiRateLimits`/`msgEnqueueRateLimits`). Over-limit →
     the identical generic response, no roster lookup, no send — never `resource-exhausted`.
   - Roster gate: `organizations/{orgId}` doc + `people` subcollection full-fetch, in-memory
     case-insensitive email match (never a `.where('email','==',...)` query — `Person.email` is
     un-normalized free text). Scoped strictly to the request's own `orgId` (cross-org isolation).
   - Timing pad: no-match and rate-limited branches `await` a `setTimeout` up to
     `VOLUNTEER_LINK_TARGET_RESPONSE_MS` (1200ms default) before returning, so their latency doesn't
     leak roster membership even though the response body is already identical.
   - On roster-hit: `await mintAndSendVolunteerLink(...)`, then return the generic response.
   - `requestVolunteerLink = onCall({ secrets: [RESEND_API_KEY] }, requestVolunteerLinkHandler)` — the
     ONLY other function besides `sendQueuedMessage` that binds `RESEND_API_KEY` (R131 smallest
     key-holding surface: no other new function declares it).

3. **`functions/src/index.test.ts` — `describe("requestVolunteerLinkHandler", ...)`** — the full
   ALLOW/DENY + TIMING matrix (13 tests): DENY-1 (roster-miss), DENY-2 (cross-org), DENY-3a/b (minute
   and day rate-limit), a fail-open rate-limiter case, a bogus/forged-orgId case (T-128-05), DENY-4/5
   (missing/malformed input → `invalid-argument`), ALLOW-1 (roster-hit, case-insensitive match),
   ALLOW-2 (same email, two orgs, independent success), a byte-identical DENY-vs-ALLOW body assertion,
   and TIMING-1 (fake-timer-based elapsed-ms assertion proving the pad masks the hit branch's real
   latency within a 150ms tolerance band around the 1200ms target).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a pre-existing test whose invariant the new code legitimately changes**
- **Found during:** Task 2 (`cd functions && npm test` regression check after adding
  `requestVolunteerLink`)
- **Issue:** `index.test.ts`'s `"SOURCE INSPECTION: RESEND_API_KEY is bound to EXACTLY ONE Function,
  and it is sendQueuedMessage"` test source-inspects `index.ts` and asserted exactly one
  `secrets: [RESEND_API_KEY]` binding existed. Phase 128's design (CONTEXT.md, RESEARCH.md,
  threat model T-128-06) explicitly and correctly adds a SECOND, sanctioned binding for the new
  public callable — the old assertion was now testing an invariant the plan intentionally supersedes.
- **Fix:** Rewrote the test to assert the invariant it was actually meant to protect: exactly TWO
  bindings exist, one inside `sendQueuedMessage`'s wrapper and one inside `requestVolunteerLink`'s
  wrapper — i.e. "no OTHER new function declares the secret" rather than "exactly one binding forever".
- **Files modified:** `functions/src/index.test.ts`
- **Commit:** 37bda74b

**2. [Rule 1 - Bug] TS strictness errors in Task 1's own test file, surfaced by `functions && npm run build`**
- **Found during:** Task 2's `npm run build` gate (build type-checks all files, not just touched ones)
- **Issue:** `volunteerLink.test.ts`'s hoisted `vi.fn()` mocks had no parameter types, so
  `.mock.calls[0]` inferred as an empty tuple `[]`; casting the destructured result with `as [string, {...}]`
  tripped `TS2352` ("neither type sufficiently overlaps").
- **Fix:** Typed the hoisted mock functions' parameters directly (`vi.fn(async (_args: FakeSendArgs) => ...)`,
  `vi.fn(async (_email: string, _settings: FakeActionCodeSettings) => ...)`) instead of casting the
  call-site destructuring — removed the now-unnecessary `as [...]` casts.
- **Files modified:** `functions/src/volunteerLink.test.ts`
- **Commit:** 37bda74b

**3. [Rule 2 - grey area, documented not auto-scope-expanded] Exported `VOLUNTEER_LINK_MAX_PER_MIN`/`_MAX_PER_DAY`/`_TARGET_RESPONSE_MS` from `index.ts`**
- **Rationale:** The plan's artifact list names these constants but does not explicitly require export.
  Exporting them lets the Task 3 security matrix assert the timing pad and seed rate-limit windows
  against the real production ceilings instead of duplicating magic numbers that could silently drift
  out of sync with the implementation. Low-risk (three `const` exports, no behavior change).
- **Files modified:** `functions/src/index.ts`
- **Commit:** c7c183ab

No other deviations — plan executed as written otherwise.

## Known Stubs

None. The client-side UI wiring (public request page, login-page entry point, verify-page
"request a new link" affordance) is Wave 2 (128-02), out of this plan's scope by design (this plan is
scoped to the security-critical server core + callable).

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers — every threat register entry
(T-128-01 through T-128-07) was implemented as specified: uniform generic response, timing pad,
dedicated rate-limit collection, org-scoped roster fetch, and the single RESEND_API_KEY binding. No
new network endpoints, auth paths, or schema changes outside that register were introduced.

## Verification

- `cd functions && npx vitest run src/volunteerLink.test.ts` — 4/4 passed.
- `cd functions && npm run build` — clean (wrapper + handler compile and are exported from `index.ts`).
- `cd functions && npx vitest run src/index.test.ts -t requestVolunteerLinkHandler` — 13/13 passed
  (309 other tests in the file skipped by `-t` filter, not run/broken).
- `cd functions && npm test` (full functions suite) — **685/685 passed**, 19 test files.
- `npm run type-check` (root, `vue-tsc --build`) — clean, run three times across the three task
  commits.
- `grep -n "export const requestVolunteerLink = onCall" functions/src/index.ts` — present.
- `grep -n "volunteerLinkRateLimits" functions/src/index.ts` — present (limiter call site).
- `grep` for `resource-exhausted`/`permission-denied` near the volunteer-link code — absent (confirmed
  no enumeration-signaling error codes are thrown from `requestVolunteerLinkHandler`).
- App suite (`npx vitest run`, root) launched as a background verification pass; this plan touches
  only `functions/` files and does not modify any `src/` file, so no regression is expected against the
  documented baseline (`src/storage.rules.test.ts` only).

## Self-Check: PASSED

- FOUND: functions/src/volunteerLink.ts
- FOUND: functions/src/volunteerLink.test.ts
- FOUND: functions/src/index.ts
- FOUND: functions/src/index.test.ts
- FOUND commit: 5bbbf0cb (Task 1)
- FOUND commit: 37bda74b (Task 2)
- FOUND commit: c7c183ab (Task 3)
