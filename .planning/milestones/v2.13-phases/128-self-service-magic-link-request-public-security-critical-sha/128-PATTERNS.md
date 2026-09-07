# Phase 128: Self-Service Magic-Link Request (public, security-critical) + shared mint/send core - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 8 (3 new server, 1 new view, 4 edited)
**Analogs found:** 8 / 8 (every piece is copy-adjacent to shipped code — this phase adds only security composition, no new integration)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `functions/src/volunteerLink.ts` (NEW) | service (shared core) | request-response / email-I/O | `functions/src/adminEmail.ts` | exact (standalone Resend send) |
| `functions/src/volunteerLink.test.ts` (NEW) | test | — | `functions/src/index.test.ts` (getAuth/Resend/Firestore mocks) | role-match |
| `functions/src/index.ts` — `requestVolunteerLinkHandler` + `requestVolunteerLink` export (EDIT) | controller (public onCall) | request-response | `queueServiceMessageHandler`+`queueServiceMessage` (validation/limiter shape) and `parsePptx`/`onboardOrganization` (onCall wrapper + secrets) | exact composite |
| `functions/src/index.test.ts` — new `describe` block (EDIT) | test | — | existing `queueServiceMessageHandler` + `checkAndConsumeRateLimit` suites | exact |
| `src/views/VolunteerRequestView.vue` (NEW) | component (public view) | request-response | `src/views/VolunteerSignInView.vue` (layout) + `src/views/ShareView.vue` (public slug read) | exact composite |
| `src/router/index.ts` — add `/:slug/volunteer` (EDIT) | route | — | `/:slug/service-:date` memorable-share route (`src/router/index.ts:216-223`) | exact |
| `src/views/LoginView.vue` — "Are you a volunteer?" entry (EDIT) | component | — | existing static route + `router.push({name})` sites | role-match |
| `src/views/VolunteerLinkCompleteView.vue` — "request a new link" (EDIT) | component | — | its own error state (`:53-60`) + `useRoute().query` read | exact |

## Pattern Assignments

### `functions/src/volunteerLink.ts` (service, shared mint/send core) — NEW

**Analog:** `functions/src/adminEmail.ts` (mirror its shape exactly; add the mint step before the send).

**Imports pattern** (`functions/src/adminEmail.ts:1-9`):
```typescript
import type { Firestore } from "firebase-admin/firestore";
import { Resend } from "resend";
import { getAppConfig } from "./appConfig";
import {
  RESEND_API_KEY,
  SERVICE_SHARE_BASE_URL,
  bareEmailAddress,
  fromDisplayName,
} from "./params";
// ADD for the mint step:
import { getAuth } from "firebase-admin/auth";
```

**Standalone-send core shape** (`functions/src/adminEmail.ts:74-92`) — resolve AppConfig, build header-safe From, `new Resend(...)`, `send`:
```typescript
export async function sendAdminOnboardingEmail(args: SendAdminOnboardingEmailArgs): Promise<void> {
  const { db, to, orgName, kind } = args;
  const config = await getAppConfig(db);
  const fromEmail = bareEmailAddress(config.sender.fromAddress);
  const displayName = fromDisplayName(orgName);
  const from = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;
  // ... build subject/text ...
  const resend = new Resend(RESEND_API_KEY.value());
  await resend.emails.send({ from, to, subject, text });
}
```
For `mintAndSendVolunteerLink`, INSERT the mint (below) between the From build and the send, and use a NEW standalone subject/body (NOT a service-reminder template).

**Admin-SDK mint call + actionCodeSettings** (`functions/src/index.ts:2087-2090, 2199-2202`):
```typescript
const rehearseActionCodeSettings = {
  url: `${SERVICE_SHARE_BASE_URL.value().trim().replace(/\/+$/, "")}/volunteer/verify`,
  handleCodeInApp: true,
};
const rehearseLink = await getAuth().generateSignInWithEmailLink(
  target.email,
  rehearseActionCodeSettings,
);
```
For this phase, append `?slug=${encodeURIComponent(slug)}` to `url` BEFORE the mint (Firebase appends its `apiKey`/`oobCode`/`mode` with `&`, preserving the query string — R399 slug round-trip).

**Base-URL guard** (`functions/src/adminEmail.ts:33-37`) — blank base means omit gracefully, never render a broken URL. Reuse `resolveAppBaseUrl()`'s idiom.

---

### `functions/src/index.ts` — `requestVolunteerLinkHandler` + `requestVolunteerLink` (controller, public onCall) — EDIT

**Analog (handler body):** `queueServiceMessageHandler` (`functions/src/index.ts:1660-1823`) for the validation → limiter → work skeleton — but STRIP the auth/membership re-check (this callable is PUBLIC).

**Input guard** (`functions/src/index.ts:1679-1684`) — the ONLY branch allowed to differ from the generic response (structural, non-membership-revealing → `invalid-argument`):
```typescript
if (!orgId || !serviceId || ...) {
  throw new HttpsError("invalid-argument", "orgId, serviceId, ... are all required.");
}
```
For this phase: reject missing `orgId`/`email` and malformed email (shallow `includes('@') && includes('.')` convention, RESEARCH § Don't Hand-Roll) with `invalid-argument`; EVERYTHING else returns the uniform generic response.

**REMOVE this membership re-check block** (`functions/src/index.ts:1712-1720`) — it is the authz model for the Phase 129 ADMIN path, NOT this public path. The public gate is roster-membership + rate-limit, never `members` role:
```typescript
// DO NOT copy for the public callable:
const memberDoc = await orgRef.collection("members").doc(request.auth.uid).get();
if (!memberDoc.exists) { throw new HttpsError("permission-denied", ...); }
```

**Rate limiter** (`functions/src/index.ts:391-422`, `checkAndConsumeRateLimit`) — generic, takes an arbitrary key + DEDICATED collection name; call site pattern mirrors `functions/src/index.ts:1772-1787`:
```typescript
const rateLimitKey = `${orgId}::${email.trim().toLowerCase()}`;
const rate = await checkAndConsumeRateLimit(
  db,
  rateLimitKey,
  { maxPerMin: VOLUNTEER_LINK_MAX_PER_MIN, maxPerDay: VOLUNTEER_LINK_MAX_PER_DAY },
  Date.now(),
  "volunteerLinkRateLimits",   // DEDICATED — never shares aiRateLimits/msgEnqueueRateLimits
);
// over limit → SAME generic response (NOT resource-exhausted), then return
```
Note: `queueServiceMessage` throws `resource-exhausted` when over limit (`:1782-1787`) — this phase must NOT, because a distinct error is an enumeration signal. Return the generic response instead.

**Roster gate — full-fetch + in-memory case-insensitive match** (`functions/src/index.ts:2040-2044`), NEVER a `.where('email','==',...)` query (Person.email is un-normalized free text, RESEARCH Pitfall 3):
```typescript
const peopleSnap = await orgRef.collection("people").get();
// compare person.email?.trim().toLowerCase() === input.trim().toLowerCase()
```

**onCall wrapper with secrets** (`functions/src/orgProvisioning.ts:252`) — the exact secrets-binding form:
```typescript
export const onboardOrganization = onCall({ secrets: [RESEND_API_KEY] }, onboardOrganizationHandler);
```
Apply as: `export const requestVolunteerLink = onCall({ secrets: [RESEND_API_KEY] }, requestVolunteerLinkHandler);`
Contrast `parsePptx` (`:914-917`, options-only, no secrets) and `queueServiceMessage` (`:1828`, NO secrets — R131). This callable DOES need the secret (single-callable design); bind it to no other new function.

**MUST re-export from `index.ts`** — the handler + the `onCall` wrapper both live in / are exported from `functions/src/index.ts` (like every callable above). No predeploy build hook; an unexported function fails `firebase deploy`. Keep only the shared *core* in `volunteerLink.ts`.

---

### `functions/src/index.test.ts` + `functions/src/volunteerLink.test.ts` (test) — NEW/EDIT

**Analog:** `functions/src/index.test.ts` (imports handlers directly from `./index` — `:9-43`; mocks `getAuth` from `firebase-admin/auth` `:7`, `getFirestore` `:6`, and Resend). Colocate a new `describe("requestVolunteerLinkHandler", ...)` with the existing `queueServiceMessageHandler`/`checkAndConsumeRateLimit` suites (harness at `functions/src/index.test.ts:4156+`).

Cover the RESEARCH ALLOW/DENY matrix (128-RESEARCH.md § Security Domain): roster hit/miss, cross-org isolation, under/over rate limit, missing/malformed input, and the TIMING-1 elapsed-ms tolerance assertion. For each DENY, assert `resend.emails.send` (and `generateSignInWithEmailLink`) were NOT called and the response body is byte-identical to ALLOW.

---

### `src/views/VolunteerRequestView.vue` (component, public view) — NEW

**Analog (layout/markup + states):** `src/views/VolunteerSignInView.vue:1-40` — same dark card shell (`min-h-screen bg-gray-950 ... max-w-sm`, `bg-gray-900 border border-gray-800 rounded-xl`), same email-input + submit form idiom.

**Analog (public slug → doc resolve on mount):** `src/views/ShareView.vue:202-231` — `onMounted` async `getDoc(doc(db, ...))` with a `notFound` boolean + try/catch/finally loading flag. Adapt to read `orgSlugs/{slug}`:
```typescript
const snap = await getDoc(doc(db, 'orgSlugs', route.params.slug as string))
if (!snap.exists()) { notFound.value = true } else { orgId.value = snap.data().orgId }
```
No existing client site READS `orgSlugs` (it is only claim-written via `src/utils/slug.ts:54`), but the rule is public-get (`firestore.rules` orgSlugs; proven by `src/rules.test.ts:925-929`), so a direct unauthenticated `getDoc` is the intended access path (ADR-0007).

**Analog (client callable invocation):** `src/views/ServiceEditorView.vue:3142-3154` / `src/components/MessageComposer.vue:604`:
```typescript
import { httpsCallable } from 'firebase/functions'
await httpsCallable<{ orgId: string; email: string }, { message: string }>(
  functions, 'requestVolunteerLink',
)({ orgId, email })
```
Always show the uniform confirmation on resolve; do not branch UI on outcome.

---

### `src/router/index.ts` — add `/:slug/volunteer` (route) — EDIT

**Analog:** the memorable-share route (`src/router/index.ts:216-223`), appended in the SAME trailing block after all static routes (D-19 — static beats dynamic, never shadows `/songs` etc.):
```typescript
{
  path: '/:slug/service-:date(\\d{4}-\\d{2}-\\d{2})',
  name: 'service-memorable-share',
  component: () => import('../views/ShareView.vue'),
  // Intentionally no meta.requiresAuth — public route ... Appended after all static routes ...
},
```
Add `{ path: '/:slug/volunteer', name: 'volunteer-request', component: () => import('../views/VolunteerRequestView.vue') }` — NO `meta.requiresAuth`. Do NOT confuse with the existing 1-segment `/volunteer` (`:168-172`, `requiresAuth: true`) — RESEARCH Pitfall 5. Target it via named route `{ name: 'volunteer-request', params: { slug } }`.

---

### `src/views/VolunteerLinkCompleteView.vue` — "request a new link" (component) — EDIT

**Analog (its own error state):** `src/views/VolunteerLinkCompleteView.vue:52-60` (`v-else-if="volunteerAuth.errorMessage"` block) — add the affordance here. Reads the slug from the continue-URL query (already imports from `@/stores/volunteerAuth`; add `useRoute`):
```typescript
const requestNewLinkTarget = computed(() =>
  typeof route.query.slug === 'string'
    ? { name: 'volunteer-request', params: { slug: route.query.slug } }
    : { name: 'volunteer-home' })   // fallback
```

---

### `src/views/LoginView.vue` — "Are you a volunteer?" entry (component) — EDIT

**Analog:** existing named-route navigation sites. NOTE the open UX gap (128-RESEARCH.md Open Question 1): the login page has no slug in context. Recommended (RESEARCH): point at the generic `/volunteer` page (`VolunteerSignInView.vue`) extended with a "find your church" `getDoc(orgSlugs/{input})` lookup that then `router.push({ name: 'volunteer-request', params: { slug } })`. This is a plan-time decision, not a blocker.

## Shared Patterns

### Header-safe From construction
**Source:** `functions/src/params.ts:33-48` (`fromDisplayName` strips CR/LF + quotes; `bareEmailAddress` peels nested `<…>`).
**Apply to:** `functions/src/volunteerLink.ts` (and reused by Phase 129).
```typescript
const fromEmail = bareEmailAddress(config.sender.fromAddress);
const from = orgName ? `"${fromDisplayName(orgName)}" <${fromEmail}>` : fromEmail;
```

### Secret declaration + smallest-surface binding
**Source:** `functions/src/params.ts:6-12` (`RESEND_API_KEY = defineSecret(...)`), bound per-wrapper via `secrets: [RESEND_API_KEY]` (`functions/src/orgProvisioning.ts:252`).
**Apply to:** ONLY `requestVolunteerLink`'s wrapper. No other new function declares it (R131).

### Generic per-key Firestore rate limiter (fail-open)
**Source:** `functions/src/index.ts:391-422`.
**Apply to:** `requestVolunteerLinkHandler`, dedicated `volunteerLinkRateLimits` collection. Wrap the call in try/catch and fail OPEN on a Firestore hiccup (limiter is a cost guardrail, not the security control) — mirror `functions/src/index.ts:1788-1798`.

### Enumeration-safe uniform response
**Source (contrast):** `queueServiceMessageHandler`'s distinct `HttpsError` codes (`functions/src/index.ts:1714-1719, 1767-1787`) — this phase must NOT reproduce distinct codes for roster-miss / rate-limited. Only structural input errors differ.
**Apply to:** all non-input branches return `{ message: "If you're on this church's team, a sign-in link is on its way." }`. Plus a timing-pad on no-match/rate-limited branches (RESEARCH Pitfall 2 / A4 — flagged for plan-review).

## No Analog Found

None. Every building block exists in this codebase. The one item with no exact analog — a client-side READ of `orgSlugs/{slug}` — is covered by the public-get rule (proven by `src/rules.test.ts:925-929`) and the generic `getDoc` mount pattern in `ShareView.vue:202-231`; only the collection differs.

The genuinely new engineering (no analog because it is a composition, not an integration): the ORDER and UNIFORMITY of roster-gate + rate-limit + response-shape + timing-pad. Planner should treat this as the security-critical core, not boilerplate.

## Metadata

**Analog search scope:** `functions/src/` (adminEmail, params, appConfig, index, orgProvisioning, index.test), `src/views/` (ShareView, VolunteerSignInView, VolunteerLinkCompleteView, ServiceEditorView), `src/router/index.ts`, `src/utils/slug.ts`, `src/rules.test.ts`, client `httpsCallable` call sites.
**Files scanned:** ~14
**Pattern extraction date:** 2026-09-06
