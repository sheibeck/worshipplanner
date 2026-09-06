# Phase 129: Admin Resend — Email & Copy - Research

**Researched:** 2026-09-06
**Domain:** Firebase Callable Functions (authenticated, editor-gated) + Resend transactional email + Vue clipboard UX
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Reuse the shared core (R402 = one code path):** the mint/send logic lives in Phase 128's
  `functions/src/volunteerLink.ts` (`mintAndSendVolunteerLink`). Phase 129 adds a SECOND callable that
  reuses that SAME core — it does NOT reimplement minting/sending.
- **A NEW authenticated callable** (e.g. `adminVolunteerLink` / `sendVolunteerLinkForAdmin`), distinct from
  the public `requestVolunteerLink`:
  - **Authenticated** — `request.auth` required; server-side editor/admin re-check of membership in the
    named org (mirror `queueServiceMessageHandler` ~L1712: `members/{uid}` role ∈ {editor, admin}); never
    trust the client-declared orgId.
  - **Roster-gated** — the target email must be on `organizations/{orgId}/people` (same in-memory lowercase
    compare as Phase 128). Mint uses the normalized `emailLower` (the CR-02 fix — send to the normalized
    address).
  - **mode: 'email'** → mint + send via the shared core, return `{ sent: true }`.
  - **mode: 'copy'** → mint via the shared core, return `{ link }` (the raw sign-in link string) to the
    admin client for clipboard. This is NOT enumeration-sensitive (caller is an authenticated editor who
    can already see the roster), so it deliberately does NOT need the public callable's enumeration-safe /
    rate-limit / timing-pad machinery. A NOT-on-roster / no-email target returns a normal, honest error to
    the admin (unlike the public path).
  - Re-exported from `functions/src/index.ts`, `secrets: [RESEND_API_KEY]`.
- **Volunteers page UI (RosterView.vue):** a per-volunteer affordance offering "Email sign-in link" and
  "Copy sign-in link" (only for people who have an email). Copy uses `navigator.clipboard.writeText`.
- **Trust/impersonation tradeoff (accepted, document in threat model):** an editor minting a volunteer's
  account-level sign-in link can effectively sign in as that (read-only) volunteer. Accepted for this app's
  trust model (small church; editor already has full org access; volunteer view is read-only). The copy
  path also sidesteps prod Resend test-mode entirely.
- **UAT deferred** to the batched pass (PENDING). Do NOT deploy to prod this phase.

### Claude's Discretion

- Exact callable name (`adminVolunteerLink` vs `sendVolunteerLinkForAdmin` — CONTEXT.md offered both as
  examples, not a locked name).
- How `volunteerLink.ts` is refactored internally to expose the raw link for `mode: 'copy'` (see
  Architecture Patterns — Pitfall 1 below; this was NOT specified in CONTEXT.md and needs a decision).
- Exact wording/placement of the two UI actions inside RosterView's edit drawer, and the toast/confirmation
  copy — CONTEXT.md says "match existing conventions," not literal text.

### Deferred Ideas (OUT OF SCOPE)

None — scope is fixed by R400–R402.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R400 | Editor/admin can **email** a rostered volunteer their sign-in link as a standalone message | New authenticated callable, `mode: 'email'` branch, reuses `mintAndSendVolunteerLink` — see Architecture Patterns |
| R401 | Editor/admin can **copy** a rostered volunteer's sign-in link to clipboard | New authenticated callable, `mode: 'copy'` branch (needs `volunteerLink.ts` refactor to return the link — see Pitfall 1); client `navigator.clipboard.writeText` — see Code Examples |
| R402 | Admin resend only mints for roster people with an email, reusing the same server-side mint/send core (one code path, one authz model) | Roster-gate pattern copied from `requestVolunteerLinkHandler`; single shared `mintAndSendVolunteerLink`/mint-only helper — see Don't Hand-Roll |
</phase_requirements>

## Summary

This phase is small and almost entirely a composition exercise: Phase 128 already built the hard parts
(Admin-SDK link minting, Resend send, roster-gate-by-email, org-name/slug resolution). Phase 129 adds one
new **authenticated** Cloud Function callable that editors/admins invoke from the Volunteers page, gated by
the exact `members/{uid}` role re-check already used by `queueServiceMessageHandler`, and a roster-gate
copied verbatim (in-memory lowercase compare, `emailLower` normalization) from `requestVolunteerLinkHandler`.
Because the caller is a trusted, already-authenticated editor who can already see the full roster in the UI,
none of Phase 128's enumeration-safety machinery (generic response body, timing pad, per-email/per-org rate
limits) is needed — a straight `HttpsError` on "not on roster" or "no email" is fine and is in fact more
useful to the admin than a public generic message would be.

The one real design gap CONTEXT.md leaves open: `mintAndSendVolunteerLink` in `functions/src/volunteerLink.ts`
currently **mints and sends in one call and returns `void`** — it has no way to hand back the raw link
string for the `mode: 'copy'` path. Closing this gap without violating R402's "one code path" requirement
means a small, mechanical refactor of `volunteerLink.ts` (extract the mint step into its own exported
function that both the existing send-flow and the new copy-flow call) rather than writing new mint logic —
see Architecture Patterns, Pitfall 1.

**Primary recommendation:** Refactor `functions/src/volunteerLink.ts` to expose a `mintVolunteerLink(args): Promise<string>` helper (pure Admin-SDK mint, no Resend), have `mintAndSendVolunteerLink` call it internally before sending (so the mint code path is still singular), then add a new authenticated callable `adminVolunteerLink` in `functions/src/index.ts` — editor/admin re-check, roster-gate, `mode: 'email' | 'copy'` — that calls `mintAndSendVolunteerLink` for `'email'` and `mintVolunteerLink` for `'copy'`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Editor/admin authz re-check (`members/{uid}` role) | API / Backend | — | Must never trust the client's declared orgId/role; server-side Admin SDK read, mirrors `queueServiceMessageHandler` exactly. |
| Roster gate (email ∈ `organizations/{orgId}/people`) | API / Backend | — | Same reasoning as Phase 128 — must happen server-side against Admin SDK data, not client-readable Firestore rules. |
| Link minting (`generateSignInWithEmailLink`) | API / Backend | — | Admin-SDK-only capability, unchanged from Phase 128. |
| Email delivery (Resend) | API / Backend | — | Secret-holding (`RESEND_API_KEY`) work stays server-side, unchanged from Phase 128. |
| Per-volunteer "Email" / "Copy" affordance rendering | Browser / Client | — | Pure UI — RosterView.vue's edit drawer, gated on `person.email` truthiness (a UX nicety, NOT the security control). |
| Clipboard write | Browser / Client | — | `navigator.clipboard.writeText` is a browser API; the server only ever returns the link string, never writes to the clipboard itself. |
| Toast/confirmation feedback | Browser / Client | — | Local component state (`xCopied` ref + `setTimeout`), matching `ServiceCard.vue`/`QuarterView.vue`'s existing share-copy pattern. |

## Standard Stack

### Core

No new packages this phase — 100% reuse of what Phase 128 already installed and verified.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-functions` | `^7.3.2` [VERIFIED: functions/package.json] | `onCall`, `CallableRequest`, `HttpsError` for the new callable | Already the only callable framework in this codebase |
| `firebase-admin` | `^13.10.0` [VERIFIED: functions/package.json] | `getAuth().generateSignInWithEmailLink`, `getFirestore()` | Already used by every mint/roster-gate path |
| `resend` | `6.19.0` [VERIFIED: functions/package.json] | Transactional email send for `mode: 'email'` | Already the app's only email provider (`RESEND_API_KEY`) |

### Supporting

None — no new client packages either. `navigator.clipboard` is a browser built-in already used
elsewhere in this codebase (no polyfill/library in use — see Code Examples).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One callable with `mode: 'email' \| 'copy'` | Two separate callables (`emailVolunteerLink`, `copyVolunteerLink`) | CONTEXT.md explicitly locks the single-callable-with-mode design (R402 "one code path"); two callables would duplicate the authz+roster-gate block. Rejected — not researched further. |
| Refactoring `volunteerLink.ts` to expose `mintVolunteerLink` | Having the new callable call `getAuth().generateSignInWithEmailLink` directly, bypassing `volunteerLink.ts` | Would violate R402's "reuses the same server-side mint/send core" — the mint step (URL construction with the `slug` query param, `resolveAppBaseUrl()`) would silently duplicate and could drift from the public path. Rejected. |

## Package Legitimacy Audit

No new external packages are installed in this phase (100% reuse of `firebase-functions`,
`firebase-admin`, `resend`, already present in `functions/package.json` since Phase 128, and the
browser-native `navigator.clipboard` API on the client). The Package Legitimacy Gate is not applicable.

**Packages removed due to [SLOP] verdict:** none (N/A — no new packages)
**Packages flagged as suspicious [SUS]:** none (N/A — no new packages)

## Architecture Patterns

### System Architecture Diagram

```
RosterView.vue (edit drawer, per-volunteer)
  │
  │ person.email exists? ──no──> affordance hidden
  │  │yes
  │  ▼
  ├─[Email sign-in link]──┐         ┌─[Copy sign-in link]──┐
  │                       │         │                       │
  ▼                       ▼         ▼                       ▼
httpsCallable(functions, 'adminVolunteerLink')
  { orgId, email, mode: 'email' | 'copy' }
        │
        ▼
adminVolunteerLinkHandler (functions/src/index.ts, NEW)
  1. request.auth required ──absent──> HttpsError('unauthenticated')
  2. members/{uid}.get() ──missing/role∉{editor,admin}──> HttpsError('permission-denied')
  3. organizations/{orgId} + /people fetch (Promise.all, same shape as Phase 128)
  4. in-memory lowercase compare: email ∈ people[].email ──miss──> HttpsError('not-found' or 'failed-precondition')
  5. mode branch:
       'email' ──> mintAndSendVolunteerLink({ db, to: emailLower, orgName, slug })  ──> { sent: true }
       'copy'  ──> mintVolunteerLink({ db, to: emailLower, slug })                  ──> { link }
        │                                                                                │
        ▼                                                                                ▼
volunteerLink.ts (functions/src/volunteerLink.ts, REFACTORED)
  mintVolunteerLink(args): Promise<string>       <-- NEW, extracted mint-only step
  mintAndSendVolunteerLink(args): Promise<void>  <-- EXISTING, now calls mintVolunteerLink() internally
        │
        ▼
  getAuth().generateSignInWithEmailLink(...)  (Admin SDK — the ONLY place this is called)
        │
        ▼ ('email' branch only)
  Resend.emails.send(...)

Client receives { sent: true } or { link } ──> RosterView.vue shows a toast, or writes `link`
  to navigator.clipboard and shows a "Copied!" confirmation.
```

### Recommended Project Structure

No new files/directories — this phase extends two existing files:

```
functions/src/
├── volunteerLink.ts     # extend: export mintVolunteerLink(); mintAndSendVolunteerLink() calls it
├── index.ts             # add: AdminVolunteerLinkRequest/Response types, adminVolunteerLinkHandler,
│                         #      export const adminVolunteerLink = onCall({ secrets: [RESEND_API_KEY] }, ...)
└── index.test.ts         # add: describe("adminVolunteerLinkHandler", ...) suite

src/views/
├── RosterView.vue        # extend: edit-drawer "Sign-in link" section + two action handlers
└── __tests__/
    └── RosterView.test.ts  # add: httpsCallable mock + clipboard mock + assertions
```

### Pattern 1: Editor/admin authz re-check (mirror `queueServiceMessageHandler`)

**What:** Independent server-side re-check of the caller's org membership + role, never trusting a
client-declared orgId or role claim.
**When to use:** Every authenticated callable that performs a privileged, org-scoped write or side effect.
**Example:**
```typescript
// Source: functions/src/index.ts:1661-1721 (queueServiceMessageHandler) — exact pattern to mirror
export async function adminVolunteerLinkHandler(
  request: CallableRequest<AdminVolunteerLinkRequest>,
): Promise<AdminVolunteerLinkResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { orgId, email, mode } = request.data ?? ({} as AdminVolunteerLinkRequest);
  if (typeof orgId !== "string" || typeof email !== "string" || !orgId || !email) {
    throw new HttpsError("invalid-argument", "orgId and email are required.");
  }
  if (mode !== "email" && mode !== "copy") {
    throw new HttpsError("invalid-argument", 'mode must be "email" or "copy".');
  }

  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);

  // Independent editor-tier re-check — never trust the client-declared orgId.
  const memberDoc = await orgRef.collection("members").doc(request.auth.uid).get();
  if (!memberDoc.exists) {
    throw new HttpsError("permission-denied", "You are not a member of this organization.");
  }
  const role = (memberDoc.data() as { role?: string } | undefined)?.role;
  if (role !== "editor" && role !== "admin") {
    throw new HttpsError("permission-denied", "You must be an editor to send sign-in links.");
  }
  // ... roster gate + mint/send follow (Pattern 2 below)
}
```

### Pattern 2: Roster gate (mirror `requestVolunteerLinkHandler`, but HONEST errors this time)

**What:** Full `people` collection fetch + in-memory lowercase email compare — never a `.where('email','==',...)`
query (email is un-normalized free text — see 128-RESEARCH Pitfall 3, still true here).
**When to use:** Any server-side check of "is this email on this org's roster."
**Example:**
```typescript
// Source: functions/src/index.ts:2569-2589 (requestVolunteerLinkHandler), adapted — this phase's
// version is allowed to return a DISTINCT, honest error on miss (caller is a trusted editor, not the
// public — no enumeration concern per CONTEXT.md).
const emailLower = email.trim().toLowerCase();
const [orgSnap, peopleSnap] = await Promise.all([orgRef.get(), orgRef.collection("people").get()]);
const orgData = orgSnap.data() as { name?: string | null; slug?: string | null } | undefined;
const orgName = fromDisplayName(orgData?.name);
const slug = orgData?.slug ?? "";

const isRosterMatch = peopleSnap.docs.some((d) => {
  const person = d.data() as { email?: string } | undefined;
  return (person?.email ?? "").trim().toLowerCase() === emailLower;
});
if (!isRosterMatch) {
  throw new HttpsError("failed-precondition", "This person is not on the roster with that email.");
}
```

### Pattern 3: Client callable invocation (mirror `ServiceEditorView.vue`'s `queueServiceMessage` call)

**What:** Typed `httpsCallable` invocation from a Vue component.
**Example:**
```typescript
// Source: src/views/ServiceEditorView.vue:3142-3150
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'

interface AdminVolunteerLinkRequest { orgId: string; email: string; mode: 'email' | 'copy' }
interface AdminVolunteerLinkResponse { sent?: true; link?: string }

const call = httpsCallable<AdminVolunteerLinkRequest, AdminVolunteerLinkResponse>(
  functions,
  'adminVolunteerLink',
)
const result = await call({ orgId: authStore.orgId!, email: person.email, mode: 'copy' })
```

### Anti-Patterns to Avoid

- **Re-implementing enumeration-safety machinery here:** the public callable's generic response body,
  timing pad, and rate limiters exist specifically because that endpoint is unauthenticated and
  world-callable. Porting that ceremony into this authenticated, editor-gated callable adds pure
  complexity with no security benefit — CONTEXT.md explicitly rejects it. A normal `HttpsError` on
  "not on roster" is the right, more-useful behavior here.
- **Duplicating the mint call:** don't write a second `getAuth().generateSignInWithEmailLink(...)` call
  site in `index.ts`. Extract the mint step from `volunteerLink.ts` instead (Pitfall 1) so there remains
  exactly one place in the codebase that calls it, preserving the "single code path" spirit of R402 for
  the mint step, not just the send step.
- **Querying `.where('email', '==', ...)`:** `Person.email` is free-text and not normalized at rest —
  a query-based lookup misses case/whitespace variants that the in-memory lowercase compare catches
  (same pitfall documented in 128-RESEARCH).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Minting a passwordless sign-in link | A new `generateSignInWithEmailLink` call site | `mintVolunteerLink` (extracted from `volunteerLink.ts`) | R402 requires one mint code path; a second call site risks the URL-construction details (slug query param ordering, `resolveAppBaseUrl()` trimming) drifting from the public path. |
| Sending the email | A new Resend call in `index.ts` | `mintAndSendVolunteerLink` (existing, unchanged send logic) | Already handles `From` header construction (`fromDisplayName`/`bareEmailAddress`), subject/body copy, and appConfig read — no reason to duplicate. |
| Copy-to-clipboard UX | A new toast/notification component | The existing `xCopied` ref + `setTimeout(...,2000)` pattern (`ServiceCard.vue`, `QuarterView.vue`) | Matches CONTEXT.md's "match existing conventions" instruction; introducing a new toast primitive for one button is unjustified scope. |

**Key insight:** This entire phase is glue code around Phase 128's core. The only genuinely new logic is
(a) the authz re-check (copy-paste from `queueServiceMessageHandler`), (b) the `mode` branch, and (c) the
`volunteerLink.ts` refactor to expose the raw link. Resist the temptation to "improve" or generalize any of
the copied patterns — verbatim reuse is what keeps this phase small and keeps R402's single-code-path
property true in practice, not just in the callable's shape.

## Common Pitfalls

### Pitfall 1: `mintAndSendVolunteerLink` cannot serve the `copy` mode as written today

**What goes wrong:** `functions/src/volunteerLink.ts`'s `mintAndSendVolunteerLink(args): Promise<void>`
combines mint + send in one call and discards the link after sending. CONTEXT.md's `mode: 'copy'` design
assumes the shared core can hand back `{ link }` without necessarily sending — but as written, it cannot.
**Why it happens:** Phase 128 had no `copy` use case, so the function was reasonably shaped to do exactly
one thing (mint-then-send) and return nothing.
**How to avoid:** Extract the mint step into its own exported function:
```typescript
// functions/src/volunteerLink.ts
export async function mintVolunteerLink(args: {
  to: string; slug: string;
}): Promise<string> {
  const baseUrl = resolveAppBaseUrl();
  const actionCodeSettings = {
    url: `${baseUrl}/volunteer/verify?slug=${encodeURIComponent(args.slug)}`,
    handleCodeInApp: true,
  };
  return getAuth().generateSignInWithEmailLink(args.to, actionCodeSettings);
}

export async function mintAndSendVolunteerLink(
  args: MintAndSendVolunteerLinkArgs,
): Promise<void> {
  const { db, to, orgName, slug } = args;
  const link = await mintVolunteerLink({ to, slug });   // now the ONLY mint call site
  const config = await getAppConfig(db);
  // ... unchanged from here: from-header, subject/text, resend.emails.send(...)
}
```
`adminVolunteerLinkHandler`'s `'copy'` branch then calls `mintVolunteerLink` directly (no `db`/`orgName`
needed — the copy path never touches Resend or appConfig); the `'email'` branch keeps calling the unchanged
`mintAndSendVolunteerLink`. This preserves "one mint code path" while cleanly separating "produce a link"
from "produce and deliver a link." Existing `requestVolunteerLinkHandler` and its test suite are
byte-for-byte unaffected (their call site, `mintAndSendVolunteerLink({ db, to, orgName, slug })`, keeps its
exact signature).
**Warning signs:** If the plan calls for `mode: 'copy'` to invoke `mintAndSendVolunteerLink` and read a
return value that doesn't exist (it returns `void`), or to skip the refactor and call
`getAuth().generateSignInWithEmailLink` a second time directly in `index.ts` — flag either as a deviation
from R402's single-code-path intent.

### Pitfall 2: Forgetting to re-export the new callable from `index.ts`

**What goes wrong:** A new function not re-exported from `functions/src/index.ts`'s top-level `export const`
fails `firebase deploy` with "No function matches the filter" — the deploy CLI only picks up
`export const <name> = onCall(...)` at that file's top level, not the internal handler.
**Why it happens:** No predeploy build hook catches this; a direct-handler unit test (calling
`adminVolunteerLinkHandler` directly, as this phase's tests will) passes regardless, hiding the omission
until an actual deploy attempt.
**How to avoid:** Add both the handler export (for testability, mirroring every other handler in this file)
AND the wrapped `onCall` export in the same file, at the bottom near `requestVolunteerLink`'s own export
block (functions/src/index.ts:2624-2632).
**Warning signs:** `firebase deploy --only functions:adminVolunteerLink` (or the full deploy) reports no
matching function; this phase does not deploy (CONTEXT.md: "Do NOT deploy to prod this phase"), so this
pitfall will not surface until a LATER deploy pass unless a smoke-checked build/lint step catches the
missing export first.

### Pitfall 3: Binding `RESEND_API_KEY` correctly without widening the key-holding surface further than necessary

**What goes wrong:** R131 ("smallest key-holding surface") is an established codebase convention — comments
at `functions/src/index.ts:2624-2628` and `:1826-1828` both call this out explicitly for
`requestVolunteerLink`/`queueServiceMessage`. Binding the secret to `adminVolunteerLink` is CONTEXT.md's
explicit instruction and is correct (the `'email'` mode does need Resend) — but it's worth stating outright
in the plan/comments so a future reader doesn't think it's an oversight, and so no OTHER new function in
this phase accidentally also declares `secrets: [RESEND_API_KEY]`.
**How to avoid:** Exactly one new `export const adminVolunteerLink = onCall({ secrets: [RESEND_API_KEY] }, ...)`
— nothing else in this phase's diff touches that secrets array.
**Warning signs:** A second function in the diff with `secrets: [RESEND_API_KEY]`.

## Runtime State Inventory

> N/A — this phase is not a rename/refactor/migration. It adds one new callable and one new UI affordance;
> no existing identifiers, collection names, or external service configuration change.

## Code Examples

### Copy-to-clipboard with transient confirmation (existing codebase convention)

```typescript
// Source: src/components/ServiceCard.vue:255-271 — exact pattern to mirror for RosterView's
// "Copy sign-in link" button (swap the URL source and the ref name).
const linkCopied = ref(false)
async function onCopySignInLink(person: Person) {
  if (!authStore.orgId || !person.email) return
  copyingId.value = person.id
  try {
    const result = await httpsCallable<AdminVolunteerLinkRequest, AdminVolunteerLinkResponse>(
      functions,
      'adminVolunteerLink',
    )({ orgId: authStore.orgId, email: person.email, mode: 'copy' })
    const link = result.data.link
    if (link && navigator.clipboard) {
      await navigator.clipboard.writeText(link)
    }
    linkCopied.value = true
    setTimeout(() => { linkCopied.value = false }, 2000)
  } catch (err) {
    console.error('Copy sign-in link failed:', err)
    copyError.value = 'Failed to copy sign-in link'
    setTimeout(() => { copyError.value = null }, 3000)
  } finally {
    copyingId.value = null
  }
}
```

### Send-mode handler call (server)

```typescript
// functions/src/index.ts — the 'email' branch inside adminVolunteerLinkHandler, after the
// authz re-check and roster gate (Patterns 1 & 2 above).
if (mode === "email") {
  await mintAndSendVolunteerLink({ db, to: emailLower, orgName, slug });
  return { sent: true };
}
// mode === "copy"
const link = await mintVolunteerLink({ to: emailLower, slug });
return { link };
```

## State of the Art

| Old Approach (Phase 128 only) | Current Approach (Phase 129 adds) | When Changed | Impact |
|--------------------------------|------------------------------------|---------------|--------|
| One PUBLIC, unauthenticated callable (`requestVolunteerLink`) with heavy enumeration-safety machinery | A SECOND, authenticated, editor-gated callable (`adminVolunteerLink`) with no enumeration machinery, sharing the mint core | This phase | Two distinct trust boundaries for the same underlying credential (a magic sign-in link), each with an authz model proportionate to its caller — public/anonymous vs. authenticated/privileged. |
| `mintAndSendVolunteerLink` is the only entry point into link minting | `mintVolunteerLink` becomes the lower-level primitive; `mintAndSendVolunteerLink` composes it with sending | This phase | Enables a mint-without-send caller (the copy path) without a second mint call site. |

**Deprecated/outdated:** Nothing in this codebase is deprecated by this phase — this is additive.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The callable will be named `adminVolunteerLink` (CONTEXT.md offered this and `sendVolunteerLinkForAdmin` as examples, not a lock) | Architecture Patterns, Code Examples | Low — cosmetic; planner/executor can pick either name consistently, just needs to match across index.ts export, client `httpsCallable` string, and tests. |
| A2 | The "not on roster" / "no email" error uses `HttpsError('failed-precondition', ...)` (a specific gRPC-style code was not locked by CONTEXT.md) | Architecture Patterns Pattern 2 | Low — any non-2xx HttpsError works; the plan should just pick one and be consistent between server throw and client catch-block messaging. |
| A3 | The "Sign-in link" UI section is placed in RosterView's edit-drawer "Status actions" area (mirroring the Deactivate/Reactivate block's `border-t` styling) rather than as an inline row-level icon button in the table | Client wiring / Code Examples | Low-Medium — a plan/executor could reasonably place it as row-hover icons instead; either satisfies R400/R401, but placement affects the UI-SPEC/plan-checker's expectations. Confirm during planning if a stronger visual spec is wanted. |

**If this table is empty:** N/A — see entries above; none are HIGH risk or contradict a locked CONTEXT.md decision.

## Open Questions

1. **Should the "not on roster with an email" admin-path error be silently swallowed in the UI, or shown as an explicit error banner?**
   - What we know: CONTEXT.md says "A NOT-on-roster / no-email target returns a normal, honest error to the admin (unlike the public path)."
   - What's unclear: The exact client-side error UX (toast vs inline banner vs disabled-button-so-it-never-fires). Given the UI already hides the affordance for people with no email, the only realistic trigger of this server error is a race (email removed between page load and click) — a rare edge case.
   - Recommendation: A short-lived error toast (mirroring `ServiceCard.vue`'s `shareError.value` + 3000ms timeout pattern) is sufficient; don't over-invest here.

## Environment Availability

> Skipped — this phase has no new external tool/service dependency. Resend and Firebase Functions/Admin
> SDK are already configured and verified working as of Phase 128 (see 128-RESEARCH.md's own Environment
> Availability section for that baseline). `navigator.clipboard` is a browser built-in already exercised
> by existing tests/production code in this app (`ServiceCard.vue`, `QuarterView.vue`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (functions: `functions/src/index.test.ts`, root: `npx vitest run`) |
| Config file | `functions/vitest.config.ts` (backend) / root `vite.config.ts` (frontend) — both pre-existing |
| Quick run command | `cd functions && npx vitest run index.test.ts -t "adminVolunteerLink"` |
| Full suite command | `cd functions && npm test` (backend) and `npx vitest run` (frontend, from repo root) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R400 | `mode: 'email'` on a roster hit calls `mintAndSendVolunteerLink` and returns `{ sent: true }` | unit | `cd functions && npx vitest run index.test.ts -t "ALLOW.*email"` | ❌ Wave 0 — new `describe("adminVolunteerLinkHandler")` block in `functions/src/index.test.ts` |
| R401 | `mode: 'copy'` on a roster hit calls `mintVolunteerLink` (not Resend) and returns `{ link }` | unit | `cd functions && npx vitest run index.test.ts -t "ALLOW.*copy"` | ❌ Wave 0 — same new describe block |
| R401 | RosterView's "Copy sign-in link" button calls the callable and writes the returned link to `navigator.clipboard` | unit (component) | `npx vitest run src/views/__tests__/RosterView.test.ts -t "copy sign-in link"` | ❌ Wave 0 — needs `vi.mock('firebase/functions')` + `Object.assign(navigator, { clipboard: { writeText: vi.fn() } })` added to `RosterView.test.ts` |
| R402 | Unauthenticated call → `unauthenticated`; non-member/non-editor caller → `permission-denied` | unit | `cd functions && npx vitest run index.test.ts -t "DENY.*auth"` | ❌ Wave 0 — mirror `queueServiceMessageHandler`'s existing DENY-auth tests (search `index.test.ts` for its `describe` block for the exact fake-request shape to copy) |
| R402 | Email not on `organizations/{orgId}/people`, or roster entry has no email → explicit error, no mint/send | unit | `cd functions && npx vitest run index.test.ts -t "DENY.*roster"` | ❌ Wave 0 — same new describe block, reuse `fakeVolunteerDb`-style fixture from the `requestVolunteerLinkHandler` suite (index.test.ts:5895) |
| R400 | An actual Resend delivery to a real inbox | manual-only | N/A — Resend is still prod test-mode (backlog 999.6); real-send verification is explicitly deferred to the batched UAT pass per CONTEXT.md | — |

### Sampling Rate

- **Per task commit:** `cd functions && npx vitest run index.test.ts -t "adminVolunteerLink"` (and the RosterView-scoped vitest command for the client task)
- **Per wave merge:** `cd functions && npm test` AND root `npx vitest run` (per CLAUDE.md — do not use `--dir src`, do not expect `storage.rules.test.ts` to pass, that's the known baseline)
- **Phase gate:** Full suite green (both suites) before `/gsd-verify-work`; `npm run type-check` (per CLAUDE.md — the `vue-tsc --build` form, not `-p tsconfig.app.json`) must also be clean, since this phase adds new exported types (`AdminVolunteerLinkRequest`/`Response`) shared between `index.ts` and `RosterView.vue`.

### Wave 0 Gaps

- [ ] `functions/src/index.test.ts` — new `describe("adminVolunteerLinkHandler")` block covering the ALLOW/DENY matrix above (can reuse the existing `fakeVolunteerDb`/`makeOrgRef` helper at index.test.ts:5895, extended with a `members` subcollection fake for the authz re-check)
- [ ] `src/views/__tests__/RosterView.test.ts` — add `vi.mock('firebase/functions', () => ({ httpsCallable: (...a) => mockHttpsCallable(...a) }))` (mirrors `ServiceEditorView.test.ts:93-95`) plus a `navigator.clipboard.writeText` stub
- [ ] No new test framework/config needed — both suites and their mocking conventions already exist.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth passwordless email-link mint, unchanged mechanism from Phase 128; this phase only adds a second, authenticated *request* path (the requester is an editor, not the eventual link user). |
| V3 Session Management | no (indirect) | Session establishment for the volunteer happens entirely in the existing, unchanged `completeSignIn` flow — out of scope here, same as Phase 128. |
| V4 Access Control | yes | TWO layers this phase: (1) `request.auth` + `members/{uid}` role ∈ {editor, admin} re-check (new — mirrors `queueServiceMessageHandler`); (2) roster-gate on `organizations/{orgId}/people` (reused from Phase 128). Both enforced server-side; the client's declared `orgId`/`mode` are never trusted for authorization decisions. |
| V5 Input Validation | yes | Shallow `orgId`/`email`/`mode` presence + type + enum checks before any Firestore/Resend work, mirroring `requestVolunteerLinkHandler`'s and `queueServiceMessageHandler`'s existing upfront-guard convention. |
| V6 Cryptography | no | No new cryptographic primitive — link tokens (`oobCode`) remain Firebase-Auth-internal, untouched by application code, same as Phase 128. |
| V11 Business Logic (rate limiting / abuse) | no (deliberately) | CONTEXT.md explicitly accepts NOT porting Phase 128's rate-limit/timing-pad machinery here: the caller is an authenticated, already-roster-visible editor, not an anonymous world-callable actor. This is a documented, accepted risk-acceptance, not an oversight — see Known Threat Patterns below. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Editor mints a volunteer's account-level link and effectively signs in as that volunteer (impersonation) | Elevation of Privilege | **Accepted tradeoff, not mitigated** (CONTEXT.md locked decision): the volunteer view is read-only, the editor already has full org access via their own credentials, and the church's trust model treats editors as fully trusted staff. Document this explicitly in the callable's code comments (mirroring the codebase's ADR-referencing comment convention) so a future reader doesn't mistake the absence of a mitigation for an oversight. |
| Non-member or non-editor calls the callable directly (bypassing the UI) | Elevation of Privilege | Server-side `members/{uid}` role re-check, independent of any client-declared role/orgId — identical mitigation shape to `queueServiceMessageHandler`. Must be an explicit ALLOW/DENY test case (see Validation Architecture). |
| Forged/arbitrary `orgId` from an authenticated-but-unrelated-org editor (editor of Org A probing Org B's roster) | Tampering / Elevation of Privilege | The `members/{uid}` check is scoped to `organizations/{orgId}/members/{request.auth.uid}` for the SUPPLIED `orgId` — an editor of Org A has no member doc under Org B, so the check fails closed. Must be an explicit DENY test case (cross-org, not just no-membership). |
| Copy-mode response leaking the raw link into logs/telemetry | Information Disclosure | Do not `console.log` the minted link anywhere in the new code path (the existing `mintAndSendVolunteerLink` already avoids logging the link itself, only logging error messages on failure — keep that convention). |
| Secret-surface expansion | Elevation of Privilege | `RESEND_API_KEY` binds to exactly one additional function (`adminVolunteerLink`) for its `'email'` mode — see Pitfall 3. No other new function in this phase touches that secret. |

**Recommended ALLOW/DENY test matrix** (mirrors Phase 128's `requestVolunteerLinkHandler` discipline, adapted for an authenticated/editor-gated callable):

| # | Case | Expected |
|---|------|----------|
| DENY-1 | `request.auth` absent | `HttpsError('unauthenticated', ...)` |
| DENY-2 | Authenticated, but no `members/{uid}` doc in the named org | `HttpsError('permission-denied', ...)` |
| DENY-3 | Authenticated member, but role is neither `editor` nor `admin` | `HttpsError('permission-denied', ...)` |
| DENY-4 | Authenticated editor of Org A, `orgId` = Org B (cross-org) | `HttpsError('permission-denied', ...)` — no member doc under Org B |
| DENY-5 | Email not present in `organizations/{orgId}/people` | Explicit, honest `HttpsError` (e.g. `failed-precondition`) — NOT a generic message; mint/send NOT called |
| DENY-6 | Missing/malformed `orgId`, `email`, or `mode` (not `'email'`/`'copy'`) | `HttpsError('invalid-argument', ...)` |
| ALLOW-1 | Editor/admin, roster hit, `mode: 'email'` | `mintAndSendVolunteerLink` called with `emailLower`; `resend.emails.send` invoked; returns `{ sent: true }` |
| ALLOW-2 | Editor/admin, roster hit, `mode: 'copy'` | `mintVolunteerLink` called with `emailLower`; `resend.emails.send` NOT invoked; returns `{ link }` matching the mocked `generateSignInWithEmailLink` output |
| ALLOW-3 | `admin` role (not just `editor`) succeeds identically to `editor` for both modes | Same outcomes as ALLOW-1/2 |

## Sources

### Primary (HIGH confidence)

- `functions/src/volunteerLink.ts` (read in full) — the shared mint/send core, its current `void`-returning
  signature, and exactly where the mint step needs extracting.
- `functions/src/index.ts:1661-1829` (`queueServiceMessageHandler`) — the authz re-check pattern to mirror.
- `functions/src/index.ts:2415-2632` (`requestVolunteerLinkHandler` + `requestVolunteerLink` export) — the
  sibling precedent, roster-gate logic, and the export-wiring convention (handler + `onCall` wrapper +
  `secrets: [RESEND_API_KEY]`).
- `functions/src/index.test.ts:5866-5995` — the existing `requestVolunteerLinkHandler` test suite's fake-db
  helper shape, reusable/extensible for the new callable's tests.
- `src/views/RosterView.vue` (read in full) — the Volunteers page structure, the edit-drawer's existing
  "Status actions" section (Deactivate/Reactivate/Delete) as the placement precedent, and confirmed
  `authStore.orgId`/`orgName`/`orgSlug`/`isEditor` availability.
- `src/components/ServiceCard.vue:255-271` and `src/views/QuarterView.vue:825-834` — the two existing
  `navigator.clipboard.writeText` + transient-confirmation precedents in this codebase.
- `src/views/ServiceEditorView.vue:3142-3150` and `src/views/__tests__/ServiceEditorView.test.ts:92-95` —
  the `httpsCallable` client invocation and its `vi.mock('firebase/functions')` test-mocking convention.
- `functions/package.json` — verified installed versions of `firebase-functions` (^7.3.2), `firebase-admin`
  (^13.10.0), `resend` (6.19.0); no version changes needed this phase.
- `.planning/phases/128-.../128-RESEARCH.md` (Security Domain, ASVS table, threat-pattern table) — the
  exact format precedent mirrored in this document's own Security Domain section.
- `.planning/REQUIREMENTS.md` (R400–R402) and `.planning/phases/129-.../129-CONTEXT.md` — phase scope and
  locked decisions.

### Secondary (MEDIUM confidence)

None — all findings this phase are grounded directly in the existing codebase (no external web research
was needed; CONTEXT.md itself notes "No project-research pass — all patterns exist in the codebase").

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions read directly from `functions/package.json`.
- Architecture: HIGH — every pattern cited is copy-adjacent to code already in this repository, verified by direct file reads.
- Pitfalls: HIGH — Pitfall 1 (the `mintAndSendVolunteerLink` void-return gap) was discovered by directly reading `volunteerLink.ts`'s current implementation, not inferred.

**Research date:** 2026-09-06
**Valid until:** No expiry driver (internal-codebase-only research, no external API/library version dependency) — re-verify only if Phase 128's `volunteerLink.ts` or `index.ts` change again before Phase 129 is planned/executed.
