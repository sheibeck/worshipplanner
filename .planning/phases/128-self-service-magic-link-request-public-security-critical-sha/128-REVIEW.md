---
phase: 128-self-service-magic-link-request-public-security-critical-sha
reviewed: 2026-09-06T00:00:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - functions/src/volunteerLink.ts
  - functions/src/index.ts
  - functions/src/index.test.ts
  - functions/src/params.ts
  - src/views/VolunteerRequestView.vue
  - src/router/index.ts
  - src/views/LoginView.vue
  - src/views/VolunteerSignInView.vue
  - src/views/VolunteerLinkCompleteView.vue
  - src/utils/slug.ts
  - firestore.rules
  - src/rules.test.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: remediated
remediated: 2026-09-06T00:00:00Z
remediation_summary:
  fixed: [CR-01, CR-02, CR-03, WR-01, WR-02, WR-04]
  wont_fix: [WR-03, IN-01, IN-02]
  gates:
    functions_index_volunteerlink_vitest: pass (332)
    functions_full_npm_test: pass (690)
    root_type_check: pass
    functions_tsc_noEmit: pass
    rules_orgSlugs_vitest: pass (10, against already-running emulator)
---

# Phase 128: Code Review Report — Security Review (Self-Service Volunteer Magic Link)

**Reviewed:** 2026-09-06
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This is a security review of the PUBLIC, unauthenticated `requestVolunteerLink` callable and its
supporting surface (shared mint/send core, request/verify/landing pages, router exposure, and the
`orgSlugs` public-read registry's new `name` denormalization).

The response-uniformity half of the enumeration-safety design (R395) is well built: every
resolvable branch (`invalid-argument` aside) returns the byte-identical `VOLUNTEER_LINK_GENERIC_RESPONSE`
object, the client never branches on the resolved message, and the roster/rate-limit gates are
correctly scoped per-`orgId` (cross-org isolation holds — `DENY-2`/`ALLOW-2` in
`functions/src/index.test.ts` prove this).

However, the **timing half** of that same guarantee has a real gap (the pad is only applied to the
branches that are *supposed* to be slow, never to the real roster-hit branch, which can run
significantly faster than the fixed floor), and — more seriously — **the roster-hit send path
itself is unguarded**: any failure inside `mintAndSendVolunteerLink` (including a trivially
inducible one caused by the handler sending to the raw, non-normalized email instead of the
already-computed lowercase/trimmed form) escapes as an uncaught exception, producing a directly
observable, different client outcome from every other branch. That is the exact side channel R395
was written to close, and it is closable with a small, local fix (wrap the send, pad on all paths).
The remaining findings are lower-severity gaps in rate-limiter breadth and test coverage of the new
`orgSlugs.name` write.

## Critical Issues

### CR-01: The roster-hit send path is unguarded — any failure produces an observably different (non-generic) response, defeating the enumeration-safety design

> **RESOLVED (2026-09-06):** Wrapped `mintAndSendVolunteerLink` in try/catch in
> `requestVolunteerLinkHandler`; any mint/send failure is logged server-side and falls through to
> the SAME `VOLUNTEER_LINK_GENERIC_RESPONSE` (then padded, see CR-03). Proven by two new tests
> (`CR-01`: failing Resend `mockSend.mockRejectedValue`; `CR-01 (mint failure)`: throwing
> `generateSignInWithEmailLink`) that assert the handler RESOLVES the generic response rather than
> rejecting — both fail against the pre-fix unguarded `await`.

**File:** `functions/src/index.ts:2546-2547`, `functions/src/volunteerLink.ts:48-74`

**Issue:**
Every other branch of `requestVolunteerLinkHandler` (rate-limited, roster-miss) is wrapped so it
always resolves to `VOLUNTEER_LINK_GENERIC_RESPONSE`. The one real branch — a roster hit — is not:

```ts
// functions/src/index.ts:2546-2547 (no try/catch)
await mintAndSendVolunteerLink({ db, to: email, orgName, slug });
return VOLUNTEER_LINK_GENERIC_RESPONSE;
```

`mintAndSendVolunteerLink` does three fallible network/IO operations with nothing guarding them:
`getAppConfig(db)` (Firestore read), `getAuth().generateSignInWithEmailLink(to, ...)` (Admin SDK
call to Firebase Auth), and `resend.emails.send(...)` (Resend HTTP call). If ANY of these throws —
a transient Resend outage, an Admin SDK auth/invalid-email rejection (see CR-02 for a concrete
trigger), a rate limit on Resend's side, a Firestore blip on the `appConfig` read — the exception
propagates out of `requestVolunteerLinkHandler` uncaught. `onCall` converts an unrecognized thrown
error into `HttpsError('internal', 'INTERNAL')`, which the client sees as a **rejected promise**,
not a resolved `{ message: ... }`.

The frontend then takes a **different UI branch**:

```ts
// src/views/VolunteerRequestView.vue:148-152
} catch {
  genuineError.value = 'Something went wrong. Please try again in a moment.'
}
```

...which renders the request FORM WITH AN ERROR BANNER, not the "Check your email" confirmation
screen. A roster-miss or rate-limited request can *never* reach this state (they resolve, they
never throw) — only a roster HIT that also fails downstream can. This means: any input that
reliably makes a genuine hit fail (see CR-02) while a genuine miss cannot fail the same way is a
full enumeration oracle, no timing measurement required. It's also a plain reliability bug even
absent an attacker: a legitimate volunteer whose one attempt lands during a brief Resend hiccup is
told "something went wrong" instead of "check your email," and — because they are then still
inside `VOLUNTEER_LINK_MAX_PER_MIN`/`VOLUNTEER_LINK_MAX_PER_DAY` — a retry within the window may
consume their limited daily budget without a working prior send actually having gone out.

No test in `functions/src/index.test.ts`'s ALLOW/DENY/TIMING matrix exercises a
`mintAndSendVolunteerLink` failure — every `ALLOW-*` test uses a `mockSend` that always resolves.

**Fix:**
```ts
// functions/src/index.ts
try {
  await mintAndSendVolunteerLink({ db, to: emailLower, orgName, slug });
} catch (mintErr) {
  console.error("[requestVolunteerLink] mint/send failed for a roster hit:", {
    message: mintErr instanceof Error ? mintErr.message : String(mintErr),
  });
  // fall through to the SAME generic response — a delivery failure must never
  // be observable to the caller, exactly like a rate-limited/no-match branch.
}
await padVolunteerLinkResponse(startedAtMs); // see CR-03 — pad this branch too
return VOLUNTEER_LINK_GENERIC_RESPONSE;
```
Add a test asserting that when `mockSend` (or `generateSignInWithEmailLink`) rejects on a genuine
roster hit, the handler still resolves `GENERIC_RESPONSE` (not a rejected promise).

---

### CR-02: `mintAndSendVolunteerLink` is called with the raw, unnormalized email — a trivially craftable input turns a roster hit into the CR-01 failure mode

> **RESOLVED (2026-09-06):** The send now targets the already-computed `emailLower`
> (`email.trim().toLowerCase()`), eliminating the trim/normalization mismatch oracle. Proven by new
> test `CR-02`: submitting `"  Volunteer@Example.COM  "` for a roster email of
> `volunteer@example.com` yields the generic response AND both the mint and send receive the
> normalized `volunteer@example.com` (fails against the pre-fix raw-`email` send).

**File:** `functions/src/index.ts:2497`, `:2546`

**Issue:**
The handler computes a normalized form for matching, but never uses it for the actual send:

```ts
const emailLower = email.trim().toLowerCase();       // line 2497 — used for rate-limit key + roster match only
...
const isRosterMatch = peopleSnap.docs.some((d) => {
  const person = d.data() as { email?: string } | undefined;
  return (person?.email ?? "").trim().toLowerCase() === emailLower;   // trims/lowers for the COMPARE
});
...
await mintAndSendVolunteerLink({ db, to: email, orgName, slug });     // line 2546 — sends the RAW `email`
```

Because this is a public, directly-invocable callable (not gated behind the Vue frontend, which
happens to call `.trim()` on the value before invoking it — `VolunteerRequestView.vue:133`), any
caller can submit e.g. `" victim@example.com"` (leading space) or other formatting that
`isShallowValidEmail` (just checks for `@` and `.`) accepts, and that `.trim().toLowerCase()`
normalizes away for the roster comparison, but that Firebase Admin's own email-format validation
inside `generateSignInWithEmailLink` is likely to reject (`auth/invalid-email` — leading/trailing
whitespace is not a valid RFC 5321 mailbox in Admin SDK's validator).

**Concrete attack:** to test whether `victim@example.com` is on `org1`'s roster, submit the SAME
candidate email twice: once clean, once with a leading space. A roster MISS returns the generic
response either time (the roster-miss branch never calls `mintAndSendVolunteerLink`, so the
malformed variant makes no difference). A roster HIT resolves normally for the clean submission but
— per CR-01 — throws (and surfaces as `genuineError` client-side) for the space-prefixed one. The
divergence between the two outcomes for the SAME candidate confirms roster membership, entirely
without timing measurement.

**Fix:** Use the already-computed `emailLower` as the send target (or at minimum `email.trim()`, to
avoid unexpectedly delivering to a differently-cased-but-equivalent address):
```ts
await mintAndSendVolunteerLink({ db, to: emailLower, orgName, slug });
```

---

### CR-03: The timing pad is only applied to the branches that are supposed to be slow — the real roster-hit branch is never padded, leaving the pad's own purpose only half-closed

> **RESOLVED (2026-09-06):** `padVolunteerLinkResponse(startedAtMs)` is now called on the roster-hit
> branch too (after the guarded send), so hit and miss both rise to the
> `VOLUNTEER_LINK_TARGET_RESPONSE_MS` floor. `TIMING-1` was rewritten: it now simulates a realistic
> sub-target hit latency (200ms) and asserts `allowElapsed >= target - tolerance` and
> `|allowElapsed - denyElapsed| <= tolerance` — this fails against the pre-fix unpadded hit branch
> (which lands at ~200ms). The residual overshoot case (real latency > target) is noted as WR-03.

**File:** `functions/src/index.ts:2445-2548`

**Issue:**
`padVolunteerLinkResponse` (line 2466) is invoked on the rate-limited branch (line 2512) and the
roster-miss branch (line 2542), forcing both up to a `VOLUNTEER_LINK_TARGET_RESPONSE_MS` (default
1200ms) floor. The roster-HIT branch (lines 2546-2547) is **never padded** — its elapsed time is
whatever `mintAndSendVolunteerLink`'s real network work (an Admin SDK call + a Resend HTTP POST)
happens to take, with no floor and no ceiling.

128-RESEARCH.md's own Pitfall 2 / Assumption A4 frames this as "timing-pad the no-match branch...
against the typical hit-branch latency" — i.e., the intent was for hit and non-hit latencies to
converge. In production, a mint+send round-trip commonly completes well under 1200ms (an Admin SDK
in-region call plus one small transactional-email POST). If that holds here, an attacker sampling
many candidate emails against one org sees two clusters: a fast, variable cluster (roster hits) and
a hard floor at ~1200ms (misses/rate-limited) — precisely the enumeration-via-timing channel this
mechanism exists to close, just inverted from the naive "hit is slower" case the pad defends
against.

The shipped test (`TIMING-1`, `functions/src/index.test.ts:6162-6205`) cannot catch this: it
deliberately sets the simulated hit latency to `VOLUNTEER_LINK_TARGET_RESPONSE_MS - 100`, i.e. it
constructs the one scenario where an unpadded hit branch happens to land inside the assertion's
tolerance band. It provides no evidence about the realistic case (hit latency well under the
target, e.g. 200-400ms) where the gap is externally observable.

**Fix:** Pad the hit branch too (after the fix in CR-01, so mint/send failures also land here):
```ts
try {
  await mintAndSendVolunteerLink({ db, to: emailLower, orgName, slug });
} catch (mintErr) { /* log only, see CR-01 */ }
await padVolunteerLinkResponse(startedAtMs);
return VOLUNTEER_LINK_GENERIC_RESPONSE;
```
Also consider what happens when real mint+send latency *exceeds* the target (Resend degraded,
retries) — `padVolunteerLinkResponse` is a no-op once `remaining <= 0`, so an overshoot on the hit
branch would still be observable in that direction. A more robust fix caps total elapsed time via
`Promise.race` against the pad target for ALL branches, not just the fast ones, though the simple
fix above closes the common case.

## Warnings

### WR-01: No aggregate per-org or per-caller throttle — the per-`(orgId,email)` limiter does not bound total request volume against one organization

> **RESOLVED (2026-09-06):** Added an aggregate per-org daily throttle
> (`VOLUNTEER_LINK_MAX_PER_ORG_PER_DAY`, default 300, env-overridable) via `checkAndConsumeOrgEmailQuota`
> on a DEDICATED `volunteerLinkOrgCounters` collection, checked BEFORE the roster read. Over-limit
> returns the same generic response (padded, no roster read, no send) and the throttle fails OPEN
> consistent with the existing per-email limiter. Proven by new tests: `WR-01` over-limit (seeded org
> counter → generic response, no send/mint — fails against pre-fix code which sends) and `WR-01`
> fail-open. App Check was NOT added (out of scope; CONTEXT.md locked this as a no-App-Check public
> callable — noted for a future hardening pass).

**File:** `functions/src/index.ts:2496-2544`

**Issue:** `checkAndConsumeRateLimit` is keyed on `${orgId}::${emailLower}` (line 2506), so it
throttles repeats of the *same* email, but places no ceiling on the number of *distinct* emails an
attacker can try against one `orgId`. Every single request — hit or miss — performs an unconditional
full read of `organizations/{orgId}/people` (line 2531: `orgRef.collection("people").get()`), so a
script rotating through a large candidate list against one real `orgId` gets unlimited, unthrottled
full-roster reads (cost amplification), and — combined with CR-03 — an effectively unlimited timing
sample budget for enumerating the roster by latency. This codebase already has a per-org quota
primitive built for exactly this shape of problem (`checkAndConsumeOrgEmailQuota`, used elsewhere
for PPTX import and messaging quotas) that was not applied here.

**Fix:** Layer an aggregate per-`orgId` daily ceiling (dedicated collection, e.g.
`volunteerLinkOrgCounters`) on top of the existing per-`(orgId,email)` limiter, checked before the
roster read; consider also requiring Firebase App Check on this callable, since it has no other
caller-identity signal.

### WR-02: `orgSlugs`'s new `name` field is written by `claimSlug` but never exercised by the firestore.rules test suite

> **RESOLVED (2026-09-06):** Added three `src/rules.test.ts` cases: (1) an org editor CAN create
> `orgSlugs/{slug}` with `{ orgId, name }`; (2) an unauthenticated `getDoc` returns `name` intact;
> (3) a non-member is STILL denied even with a `name` field present (write-breadth unchanged). Ran
> against the already-running Firestore emulator: 10/10 orgSlugs cases pass. Confirmed
> `firestore.rules:556` already permits the `name` key (no `.keys().hasOnly()` guard) — **no rule
> change was required**; the create ALLOW passing is the proof.

**File:** `src/utils/slug.ts:56-76`, `firestore.rules:549-558`, `src/rules.test.ts:924-979`

**Issue:** `claimSlug` now denormalizes `{ orgId, name }` onto `orgSlugs/{slug}` when an org name is
supplied (`src/utils/slug.ts:65`). The current create rule —
`allow create: if isOrgEditor(request.resource.data.orgId);` (`firestore.rules:556`) — does not
restrict which keys may be present, so this write passes today; no rules change was required. But
`src/rules.test.ts`'s entire `orgSlugs` describe block (lines 924-979, "WR-01") only ever calls
`setDoc(doc(db, 'orgSlugs', slug), { orgId: 'orgA' })` — never with a `name` field. This is an
untested write shape: a future, well-intentioned tightening of the create rule (e.g. adding a
`.keys().hasOnly([...])` guard, a common follow-up to a "public read" collection review) could
silently break `claimSlug`'s name denormalization with no red test to catch it.

**Fix:** Add a rules test asserting `setDoc(doc(db, 'orgSlugs', slug), { orgId: 'orgA', name: 'Grace Church' })`
succeeds for an org editor, and that an unauthenticated `getDoc` of that doc returns `name` intact.

### WR-03: The 1200ms timing-pad target is a static, unmonitored assumption about "typical hit latency"

> **WON'T FIX THIS PHASE (2026-09-06):** As the finding itself states, not urgent to fix here. Left
> as a documented follow-up (telemetry on pre-pad hit-branch elapsed time to periodically validate
> the constant, and/or a `Promise.race` ceiling for the overshoot case). Tracked alongside the CR-03
> overshoot note.

**File:** `functions/src/index.ts:2439-2448`

**Issue:** `VOLUNTEER_LINK_TARGET_RESPONSE_MS` defaults to a hardcoded 1200ms with no telemetry
verifying it tracks the real p50/p95 of `mintAndSendVolunteerLink`'s actual network latency over
time. If Resend's or Firebase Auth's typical latency drifts meaningfully away from 1200ms in either
direction post-launch, the padding silently stops matching reality with no alert — this compounds
CR-03 (which shows the pad doesn't even apply to the hit branch today) but would remain a latent
risk even after that fix, since a fixed constant needs periodic reality-checking.

**Fix:** Not urgent to fix in this phase, but worth a follow-up: log actual hit-branch elapsed time
(pre-pad) so the constant can be periodically validated/tuned, or fetch a p95 from existing metrics.

### WR-04: No type validation on `orgId`/`email` beyond truthiness

> **RESOLVED (2026-09-06):** The guard is now
> `if (typeof orgId !== "string" || typeof email !== "string" || !orgId || !email) throw invalid-argument`.
> A malformed shape carries no membership information, so it is safe to reject distinctly. Proven by
> new test `WR-04` (non-string `orgId: 123` and object `email` both throw `invalid-argument`) — fails
> against the pre-fix truthiness-only guard, which let a non-string `orgId` fall through to a
> generic-response/`internal` path.

**File:** `functions/src/index.ts:2484-2496`

**Issue:** `request.data` is typed as `RequestVolunteerLinkRequest`, but at runtime a public
callable can receive arbitrary JSON. The only guard is `if (!orgId || !email)` (line 2489), which
passes for any truthy non-string value (e.g. `orgId: 123`, `orgId: {}`). `db.collection("organizations").doc(orgId)`
and `` `${orgId}::${emailLower}` `` both assume a string; a non-string `orgId` would throw inside
the Admin SDK (`.doc()` requires a string), again escaping unguarded as an uncaught exception (same
`internal` HttpsError pattern as CR-01, though here it affects EVERY branch equally so it isn't an
enumeration oracle by itself — just a reliability/DoS-adjacent gap for malformed payloads).

**Fix:** `if (typeof orgId !== "string" || typeof email !== "string" || !orgId || !email) throw new HttpsError("invalid-argument", ...)`.

## Info

### IN-01: `isShallowValidEmail` is duplicated verbatim across backend and frontend

> **WON'T FIX THIS PHASE (2026-09-06):** Skipped per the finding's own guidance — extracting a shared
> validator across the backend (`functions/`) and frontend (`src/`) build boundaries is not trivial
> (they are separate TS projects with no shared module), and the finding rates it not-urgent given the
> codebase's existing precedent of duplicating this exact check. Revisit only if a third copy appears.

**File:** `functions/src/index.ts:2461-2463`, `src/views/VolunteerRequestView.vue:126-128`

**Issue:** Both copies are identical (`value.includes('@') && value.includes('.')`), each with its
own comment referencing "the codebase's established shallow email-format convention." Harmless
today, but a drift risk if one copy is ever tightened (e.g. to reject a bare `@.`) without the
other being updated in lockstep.

**Fix:** Not urgent given the codebase's existing precedent of duplicating this exact check (per the
comments); consider extracting to a shared validator only if a third copy appears.

### IN-02: Client-supplied `slug` is not cross-checked against `orgId` before being embedded in the minted continue-URL

> **WON'T FIX THIS PHASE (2026-09-06):** Skipped — the finding documents no security impact (the value
> is `encodeURIComponent`-escaped, and every downstream consumer navigates via a named Vue Router
> route, so no injection/open-redirect). The worst case is a purely cosmetic recovery-link mismatch.
> Not worth the added coupling this phase; left as documented for completeness.

**File:** `functions/src/index.ts:2534`

**Issue:** `const slug = requestedSlug ?? orgData?.slug ?? "";` trusts the caller-supplied `slug`
field outright rather than falling back to the org's own `slug` only when the caller's value looks
inconsistent. There is no meaningful security impact — the value is `encodeURIComponent`-escaped
before being placed in the query string (`volunteerLink.ts:60`), so no query-parameter injection is
possible, and every downstream consumer of the round-tripped `slug` (`VolunteerLinkCompleteView.vue:98-102`)
navigates via a named Vue Router route (`{ name: 'volunteer-request', params: { slug } }`), never a
raw redirect — so no open redirect either. Worst case: a caller could request org A's real link but
supply org B's slug, causing the "request a new link" recovery button to point at org B's public
page instead of org A's. Purely cosmetic; noting for completeness since this was explicitly in
scope for the review.

**Fix:** Optional: ignore `requestedSlug` when it doesn't match `orgData?.slug` (once resolved),
falling back to the org's own slug in that case.

---

_Reviewed: 2026-09-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
