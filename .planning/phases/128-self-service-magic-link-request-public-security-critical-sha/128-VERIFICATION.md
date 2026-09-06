---
phase: 128-self-service-magic-link-request-public-security-critical-sha
verified: 2026-09-06T19:30:50Z
status: human_needed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Request a magic link for a real rostered email in a real (test-mode Resend) environment and click through to sign in"
    expected: "Exactly one email arrives at the Resend test-mode inbox (owner inbox only, per known prod caveat), and clicking the link signs the volunteer in at /volunteer/verify"
    why_human: "Requires a live Resend send + a real inbox + real click-through; deferred to a single batched UAT pass at v2.13 milestone end per 128-VALIDATION.md's Manual-Only Verifications and 128-02-SUMMARY.md's stated policy — status: deferred-batched (PENDING, not accepted)"
  - test: "Submit repeated requests for the same email+church in the live app and confirm the rate limit is felt (no email after the ceiling) with no visible membership leak"
    expected: "After 1/min or 5/day, further requests show the same generic confirmation with no additional email sent"
    why_human: "Requires real timing across real requests against deployed infra; deferred to the same batched UAT pass — status: deferred-batched (PENDING, not accepted)"
---

# Phase 128: Self-Service Magic-Link Request (public, security-critical) + shared mint/send core Verification Report

**Phase Goal:** A volunteer can obtain their own passwordless sign-in link on demand from a public,
church-scoped page — safely (enumeration-safe, roster-gated, rate-limited) through a shared server-side
Admin-SDK mint/send core — and can recover from an expired or invalid link without help.
**Verified:** 2026-09-06T19:30:50Z
**Status:** human_needed (all code-level truths VERIFIED; two live-service items deferred-batched per milestone UAT policy — not failures)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria, R394–R399)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A volunteer visits `/{church-slug}/volunteer`, sees the church's name resolved from `orgSlugs`, and an unknown/expired slug shows a clear "church not found" state (R394) | ✓ VERIFIED | `src/views/VolunteerRequestView.vue` reads `orgSlugs/{slug}` via public `getDoc`; not-found and reject both render "We couldn't find that church". `src/views/__tests__/VolunteerRequestView.test.ts` (8/8 pass) proves found/not-found/reject/name-absent-fallback states. Rule: `firestore.rules:554` `allow get: if true` on `orgSlugs`. |
| 2 | Submitting any email returns the identical confirmation regardless of roster outcome — never reveals membership (R395) | ✓ VERIFIED | Server: `VOLUNTEER_LINK_GENERIC_RESPONSE` is the sole return value on every non-input branch (`functions/src/index.ts:2456-2547`); `index.test.ts` "byte-identical body" test deep-equals a DENY-1 vs ALLOW-1 response. Client: confirmation render never reads the resolved `message` (`VolunteerRequestView.vue:145-147`); component test "renders the identical confirmation regardless of the resolved message value" passes. |
| 3 | A sign-in link is minted server-side (Admin SDK) and sent via Resend only when the email is on that specific church's roster; non-roster produces no email but the same confirmation (R396) | ✓ VERIFIED | `functions/src/volunteerLink.ts::mintAndSendVolunteerLink` is the sole mint+send path (Admin SDK `generateSignInWithEmailLink` + `resend.emails.send`), called only on roster match (`index.ts:2546`). Roster gate is an in-memory case-insensitive compare over `organizations/{orgId}/people`, never `.where('email','==',...)`. `index.test.ts` DENY-1 (roster-miss, no mint/send), DENY-2 (cross-org — org A email under org B → no send), ALLOW-1 (case-insensitive roster-hit → mint+send called once), ALLOW-2 (same email, two orgs, independent per-org success) all pass. |
| 4 | The public endpoint is rate-limited per email+church, carries a threat model with ALLOW/DENY tests proving it can't be used to spam/fan-out/enumerate (R397) | ✓ VERIFIED | Dedicated `volunteerLinkRateLimits` collection keyed `` `${orgId}::${emailLower}` `` (`index.ts:2504-2510`), fail-open on Firestore hiccup, never `resource-exhausted`/`permission-denied`. Threat model in `128-01-PLAN.md` (T-128-01..07, STRIDE, ASVS L1). `index.test.ts` DENY-3a (per-minute), DENY-3b (per-day), fail-open case, TIMING-1 (timing-pad tolerance-band assertion) all pass — 13/13 tests in the `requestVolunteerLinkHandler` suite. |
| 5 | A volunteer reaches the request from the login page's "Are you a volunteer?" entry, and from an expired/invalid link via a one-tap "request a new link" returning to the same church (R398, R399) | ✓ VERIFIED | `LoginView.vue` renders the exact link, navigating by name to `volunteer-home` (now public — `requiresAuth` removed, `isVolunteerRoute` retained, `src/router/index.ts:180-184`). `VolunteerSignInView.vue` "Find your church" section resolves `orgSlugs` and `router.push`es to `volunteer-request` by name. `VolunteerLinkCompleteView.vue`'s error state renders "Request a new link" targeting `{ name: 'volunteer-request', params: { slug: route.query.slug } }`, falling back to `volunteer-home` when absent. `router.test.ts` (21 tests), `LoginView.test.ts` (7 tests), `VolunteerLinkCompleteView.test.ts` (4 tests) all pass, including a direct assertion against the real production router's route meta. |

**Score:** 5/5 roadmap truths verified (0 present-behavior-unverified)

### Security Must-Haves (explicit checklist from task)

| Must-have | Status | Evidence |
|-----------|--------|----------|
| Enumeration-safe byte-identical response across roster-hit/miss/throttled | ✓ VERIFIED | `VOLUNTEER_LINK_GENERIC_RESPONSE` constant returned unconditionally on all three branches; "byte-identical body" test deep-equals DENY vs ALLOW result. |
| No `resource-exhausted`/`permission-denied` leak | ✓ VERIFIED | `grep` of `requestVolunteerLinkHandler`'s body (`index.ts:2480-2548`) confirms neither string appears as a thrown code — only comments reference them as the anti-pattern to avoid. Only `invalid-argument` is thrown, and only for structurally missing/malformed input (carries no membership info). |
| Rate limiter on `volunteerLinkRateLimits` keyed by org+email | ✓ VERIFIED | `checkAndConsumeRateLimit(db, \`${orgId}::${emailLower}\`, ..., "volunteerLinkRateLimits")` (`index.ts:2504-2510`); the test harness's fake Firestore throws on any other collection name, and DENY-3a/3b seed and trip that exact collection. |
| Timing pad | ✓ VERIFIED | `padVolunteerLinkResponse` pads the no-match and rate-limited branches to `VOLUNTEER_LINK_TARGET_RESPONSE_MS` (1200ms default); TIMING-1 test proves both ALLOW and DENY branches land within a 150ms tolerance band of the target using fake timers and a simulated hit-branch latency under the target. |
| Cross-org denial | ✓ VERIFIED | DENY-2: an email on org A's roster requested under org B's orgId → generic response, no send. Roster fetch is scoped to `organizations/{orgId}/people` for the request's own orgId only (`index.ts:2530-2531`). |
| Roster gate = in-memory lowercase compare | ✓ VERIFIED | `peopleSnap.docs.some((d) => (person?.email ?? "").trim().toLowerCase() === emailLower)` (`index.ts:2536-2539`) — no `.where('email','==',...)` query anywhere in the handler. ALLOW-1 test seeds an upper-cased roster email and matches a lower-cased request email, proving case-insensitivity. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/volunteerLink.ts` | shared mint/send core | ✓ VERIFIED | Exports `mintAndSendVolunteerLink`; mirrors `adminEmail.ts` shape; `?slug=` placed before Firebase's appended params. |
| `functions/src/volunteerLink.test.ts` | unit coverage of the core | ✓ VERIFIED | 4/4 tests pass (`cd functions && npx vitest run src/volunteerLink.test.ts`). |
| `functions/src/index.ts` — `requestVolunteerLinkHandler` + `requestVolunteerLink` | public onCall | ✓ VERIFIED | Both present, exported (`grep "export const requestVolunteerLink = onCall"` matches at `index.ts:2555`); `secrets: [RESEND_API_KEY]` bound. |
| `functions/src/index.test.ts` — `describe("requestVolunteerLinkHandler")` | ALLOW/DENY+TIMING matrix | ✓ VERIFIED | 13/13 tests pass (DENY-1..5, ALLOW-1/2, bogus-orgId, fail-open, byte-identical, TIMING-1). |
| `src/views/VolunteerRequestView.vue` | public request page | ✓ VERIFIED | Present, substantive (4-state machine), wired via router. |
| `src/router/index.ts` — `volunteer-request` route | `/:slug/volunteer` | ✓ VERIFIED | Appended after all static/dynamic-slug routes (D-19); resolves correctly per `router.test.ts`. |
| `src/views/LoginView.vue` | "Are you a volunteer?" entry | ✓ VERIFIED | Link present, targets `volunteer-home` by name. |
| `src/views/VolunteerSignInView.vue` | "Find your church" lookup | ✓ VERIFIED | `getDoc(orgSlugs/{candidate})` + `router.push({ name: 'volunteer-request', ... })`. |
| `src/views/VolunteerLinkCompleteView.vue` | "Request a new link" recovery | ✓ VERIFIED | Computed target with slug/fallback logic; button rendered only in error state. |
| `src/utils/slug.ts` | `claimSlug` name denormalization | ✓ VERIFIED | Optional `orgName` param writes `{orgId, name}` onto `orgSlugs/{slug}`; no rules change needed (create rule has no field allowlist). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `requestVolunteerLink` onCall wrapper | `functions/src/index.ts` exports | `export const requestVolunteerLink = onCall(...)` | ✓ WIRED | No predeploy build hook risk — confirmed exported, not just defined. |
| `requestVolunteerLinkHandler` | `mintAndSendVolunteerLink` | roster-hit branch calls `await mintAndSendVolunteerLink({ db, to: email, orgName, slug })` | ✓ WIRED | `index.ts:2546`. |
| `VolunteerRequestView.vue` | `requestVolunteerLink` callable | `httpsCallable(functions, 'requestVolunteerLink')({ orgId, email, slug })` | ✓ WIRED | Confirmed by component test asserting exact call args. |
| `orgSlugs/{slug}` doc | `VolunteerRequestView.vue` church name | public `getDoc` read, `data().name` | ✓ WIRED | Falls back to generic copy when `name` absent (pre-existing slugs) — documented, accepted limitation (see below), not a functional bug. |
| Login page → `volunteer-home` → "Find your church" → `volunteer-request` → callable | full R398 chain | named-route navigation throughout | ✓ WIRED | `router.test.ts` proves `volunteer-home` no longer redirects unauthenticated visitors to `/login` (the R398/R399 blocker fix). |
| `VolunteerLinkCompleteView.vue` error state → `volunteer-request`/`volunteer-home` | `route.query.slug` round-trip | computed `requestNewLinkTarget` | ✓ WIRED | Slug originates from `mintAndSendVolunteerLink`'s `continueUrl` (`?slug=` placed before Firebase's own params) and survives to the verify page's query string. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R394 | 128-02 | Public church-scoped page, church name, "not found" state | ✓ SATISFIED | See Truth #1 above. |
| R395 | 128-01, 128-02 | Enumeration-safe identical confirmation | ✓ SATISFIED (code+tests); REQUIREMENTS.md checkbox is `[x]` | See Truth #2. |
| R396 | 128-01 | Roster-gated send, server-side mint via Admin SDK + Resend | ✓ SATISFIED (code+tests); REQUIREMENTS.md checkbox is `[ ]` | See Truth #3. Checkbox appears to intentionally remain unchecked pending the batched real-email-delivery UAT item explicitly called out in 128-VALIDATION.md's Manual-Only Verifications — not a code gap (see Gaps Summary). |
| R397 | 128-01 | Rate-limited, threat model + ALLOW/DENY tests | ✓ SATISFIED (code+tests); REQUIREMENTS.md checkbox is `[ ]` | See Truth #4. Same as R396 — checkbox likely pending the batched felt-rate-limit UAT item, not a code gap. |
| R398 | 128-02 | Login-page volunteer entry point | ✓ SATISFIED | See Truth #5. |
| R399 | 128-01, 128-02 | Verify-failure "request a new link" round-trip | ✓ SATISFIED | See Truth #5. |

No orphaned requirements — REQUIREMENTS.md traceability table maps all of R394-R399 to Phase 128 and both plans jointly declare exactly that set.

### Anti-Patterns Found

None. Grepped all phase-touched files (`functions/src/volunteerLink.ts`, `functions/src/index.ts`'s Phase 128 section, `src/views/VolunteerRequestView.vue`, `src/views/VolunteerSignInView.vue`, `src/views/VolunteerLinkCompleteView.vue`, `src/views/LoginView.vue`, `src/router/index.ts`, `src/utils/slug.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and placeholder-copy patterns — zero matches. No `resource-exhausted`/`permission-denied` in the handler body (the specific anti-pattern this phase's threat model calls out).

### Behavioral Spot-Checks / Test Execution (run live by this verifier, not taken from SUMMARY)

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Security ALLOW/DENY+TIMING matrix | `cd functions && npx vitest run src/index.test.ts -t requestVolunteerLinkHandler` | 13 passed, 310 skipped | ✓ PASS |
| Mint/send core unit tests | `cd functions && npx vitest run src/volunteerLink.test.ts` | 4 passed | ✓ PASS |
| Full functions suite | `cd functions && npm test` | 685/685 passed, 19 files | ✓ PASS |
| Root type-check | `npm run type-check` (vue-tsc --build) | clean, no output | ✓ PASS |
| Client component/router tests (this phase) | `npx vitest run src/views/__tests__/VolunteerRequestView.test.ts src/router/__tests__/router.test.ts src/views/__tests__/LoginView.test.ts src/views/__tests__/VolunteerLinkCompleteView.test.ts` | 40/40 passed | ✓ PASS |
| Full app suite (regression check) | `npx vitest run` (root) | 212/213 files passed, 5437/5471 tests passed; the only failing file is `src/storage.rules.test.ts` (34 tests, Storage-emulator cross-service-read limitation) | ✓ MATCHES DOCUMENTED BASELINE — no regression introduced by Phase 128 |

### Human Verification Required

1. **Real magic-link email delivery + sign-in click-through**
   **Test:** Request a link for a real rostered email in the deployed/test-mode environment.
   **Expected:** One email arrives (Resend test-mode → owner inbox only, per the known prod caveat) and its link signs the volunteer in.
   **Why human:** Requires live Resend send, a real inbox, and a real browser click-through — cannot be simulated by unit tests. Status: **deferred-batched (PENDING)**, per 128-VALIDATION.md's Manual-Only Verifications table and 128-02-SUMMARY.md's explicit statement that this is deferred to a single batched UAT pass at v2.13 milestone end.

2. **Felt rate-limit behavior end-to-end**
   **Test:** Submit repeated requests for the same email+church against the deployed endpoint.
   **Expected:** After the ceiling (1/min, 5/day), further requests return the same generic confirmation with no additional email sent, and no membership is leaked by timing or response shape.
   **Why human:** Requires real elapsed time across real network requests against live infrastructure. Status: **deferred-batched (PENDING)**, same milestone-end batched UAT pass.

### Observation (not a gap)

**orgSlugs name-denormalization limitation (accepted):** `orgSlugs/{slug}` is create-only (`allow update, delete: if false` — ADR-0007's first-writer-wins anti-hijack invariant), so `claimSlug`'s new optional `name` field is a point-in-time snapshot. Pre-existing production slugs claimed before this phase shipped, and any org that later renames, will show generic copy ("this church"/"your church") on `VolunteerRequestView` rather than the real church name, until/unless the org re-claims a slug. This is documented in `128-02-SUMMARY.md`, degrades gracefully (verified by the "shows the request form gracefully when the slug doc has no name field" test), and is cosmetic-only — never a security or functional blocker.

### Gaps Summary

No code-level gaps found. Every roadmap success criterion, every explicit security must-have, and R394-R399 are backed by both static evidence (source inspection, threat model) and passing automated tests re-run live by this verifier (not merely cited from SUMMARY.md). Root type-check is clean, the full functions suite is 685/685 green, and the full app suite matches the pre-existing documented baseline with zero regressions.

The two items in Human Verification Required are real-service behaviors (actual email delivery, felt rate-limit timing) that cannot be verified without a deployed environment and a live inbox — they were explicitly scoped as manual-only in 128-VALIDATION.md and are correctly labeled PENDING (not accepted) rather than silently passed. This is consistent with the phase's own stated policy of a single batched UAT pass at v2.13 milestone end, and is the reason `status: human_needed` rather than `passed` — no code changes are required to close them; they require the milestone-end deploy + owner UAT pass.

The REQUIREMENTS.md checkboxes for R396/R397 remain unchecked (`[ ]`) while R394/R395/R398/R399 are `[x]` — this is flagged as an observation, not a gap, because the code and automated-test evidence for R396 and R397 is complete and equally strong to the checked requirements; the unchecked state most likely reflects that R396/R397 are the two requirements with a live-service manual-verification component still pending, per the Manual-Only Verifications table above.

---

*Verified: 2026-09-06T19:30:50Z*
*Verifier: Claude (gsd-verifier)*
