# Phase 129: Admin Resend — Email & Copy - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 4 (2 modified backend, 1 modified client, 1 modified test)
**Analogs found:** 4 / 4 (all in-repo; no RESEARCH.md fallback needed)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `functions/src/index.ts` (new `adminVolunteerLink` onCall + handler) | callable / controller | request-response | `queueServiceMessageHandler` + `export const queueServiceMessage` (same file, L1661/L1829) and `requestVolunteerLinkHandler` sibling (L2492/L2629) | exact |
| `functions/src/volunteerLink.ts` (refactor shared core to expose mint step) | service | transform / email-send | itself, current `mintAndSendVolunteerLink` (L48-74) | exact (self, extend) |
| `src/views/RosterView.vue` (per-volunteer email/copy affordance) | component (view) | request-response + clipboard | drawer "Status actions" block (same file, L393-457) + `httpsCallable` call in `ServiceEditorView.vue` L3142 + clipboard copy `ServiceEditorView.vue` L4056-4064 | role + flow match |
| `functions/src/index.test.ts` (tests for new callable) | test | — | `describe("requestVolunteerLinkHandler")` L5873-5972 | exact |

## Pattern Assignments

### `functions/src/index.ts` — new `adminVolunteerLink` callable (callable, request-response)

**Analogs:** `queueServiceMessageHandler` (authz re-check) + `requestVolunteerLinkHandler` (roster gate + shared-core call) — both in this same file.

**Auth + editor/admin re-check** — copy verbatim from `queueServiceMessageHandler`, `functions/src/index.ts:1664-1721`. This is the exact members-role gate the CONTEXT mandates. Note it re-reads `members/{uid}` from the *server-resolved* `orgRef`, never trusting the client orgId:
```typescript
if (!request.auth) {
  throw new HttpsError("unauthenticated", "Sign in required.");
}
// ...
const orgRef = db.collection("organizations").doc(orgId);
const memberDoc = await orgRef.collection("members").doc(request.auth.uid).get();
if (!memberDoc.exists) {
  throw new HttpsError("permission-denied", "You are not a member of this organization.");
}
const role = (memberDoc.data() as { role?: string } | undefined)?.role;
if (role !== "editor" && role !== "admin") {
  throw new HttpsError("permission-denied", "You must be an editor to send messages.");
}
```
Adapt the final error string (e.g. "You must be an editor to send sign-in links.").

**Input validation shape** — mirror `requestVolunteerLinkHandler` L2506-2511 (type-check, not just truthiness) since this is a callable receiving arbitrary JSON. Add a `mode` enum guard rejecting anything other than `'email' | 'copy'` (model on `MESSAGE_TYPES.includes(type)` enum-reject, L1688-1690).

**Roster fetch + lowercase compare** — copy from `requestVolunteerLinkHandler`, `functions/src/index.ts:2575-2584`. Full-fetch + in-memory case-insensitive match (NEVER a `.where('email','==')` query — `Person.email` is un-normalized free text). Also grab `orgName`/`slug` resolution at L2577-2579:
```typescript
const orgRef = db.collection("organizations").doc(orgId);
const [orgSnap, peopleSnap] = await Promise.all([orgRef.get(), orgRef.collection("people").get()]);
const orgData = orgSnap.data() as { name?: string | null; slug?: string | null } | undefined;
const orgName = fromDisplayName(orgData?.name);
const slug = requestedSlug ?? orgData?.slug ?? "";
const isRosterMatch = peopleSnap.docs.some((d) => {
  const person = d.data() as { email?: string } | undefined;
  return (person?.email ?? "").trim().toLowerCase() === emailLower;
});
```

**CRITICAL DIVERGENCE from the sibling — do NOT copy the enumeration machinery.** The public `requestVolunteerLinkHandler` is enumeration-safe: generic response, rate limiters (`volunteerLinkRateLimits` / `volunteerLinkOrgCounters`), timing pad (`padVolunteerLinkResponse`), swallowed mint errors. Per CONTEXT decisions, the authenticated admin path deliberately does NONE of these. A not-on-roster / no-email target returns an **honest** `HttpsError` (e.g. `failed-precondition` / `not-found`), and mint/send errors propagate normally. Skip L2516-2567 (rate limiters), L2451-2483 (pad), and L2591-2620 (error-swallow + pad).

**onCall wrapper + secret binding + re-export** — model on `export const requestVolunteerLink` at `functions/src/index.ts:2629-2632`. The new callable DOES need `RESEND_API_KEY` (email mode sends):
```typescript
export const adminVolunteerLink = onCall(
  { secrets: [RESEND_API_KEY] },
  adminVolunteerLinkHandler,
);
```
Re-export is inline in this file (same as the sibling); no separate `index.ts` barrel edit needed. ⚠ MEMORY: a new function must be re-exported from `functions/src/index.ts` or `firebase deploy` drops it — the inline `export const` satisfies this.

**Return shape** — `mode:'email'` → `{ sent: true }`; `mode:'copy'` → `{ link }`. Define a `AdminVolunteerLinkRequest`/`Response` interface pair mirroring `RequestVolunteerLinkRequest`/`Response` at L2420-2431.

---

### `functions/src/volunteerLink.ts` — expose the mint step (service, transform + email-send)

**Analog:** itself — `mintAndSendVolunteerLink`, `functions/src/volunteerLink.ts:48-74`.

⚠ **Refactor required, not pure copy.** The current core returns `void` and *always* sends (L63 mint, L72-73 send). Phase 129 `mode:'copy'` needs the raw `link` WITHOUT sending, and `mode:'email'` still needs the composed mint+send (R402 "one code path"). Recommended shape that preserves R402:
- Extract a `mintVolunteerLink(args): Promise<string>` from the current L53-63 (config/base-url/actionCodeSettings/`generateSignInWithEmailLink`).
- Keep `mintAndSendVolunteerLink` as the email composition, now calling `mintVolunteerLink` then the L65-73 send body — so the existing `requestVolunteerLinkHandler` caller is unchanged and there is still exactly one mint+send composition.
- `adminVolunteerLink` copy-mode calls `mintVolunteerLink` alone; email-mode calls `mintAndSendVolunteerLink`.

Reuse the exact existing idioms: `resolveAppBaseUrl()` (L35-39), the slug-before-mint URL ordering (L59-63), and `MintAndSendVolunteerLinkArgs` (L20-29) as the arg contract. Preserve the CR-02 rule (callers pass the normalized `emailLower`).

---

### `src/views/RosterView.vue` — per-volunteer email/copy affordance (component)

**Analog A — where the affordance goes:** the drawer "Status actions" block, `src/views/RosterView.vue:393-457`. Add a sibling "Sign-in link" section below Status using the same chrome: an `<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">` header and the same small bordered buttons (L407-413 pattern). Gate the whole block on `editingPerson.email` (CONTEXT: only for people WITH an email). The row-level email is already shown at L161 (`person.email || '—'`).

**Analog B — callable invocation:** `src/views/ServiceEditorView.vue:3142-3160`. Match the typed `httpsCallable` + nested try/catch:
```typescript
await httpsCallable<QueueMessageRequest, { messageId: string }>(
  functions,
  'queueServiceMessage',
)({ orgId, /* ... */ })
```
For Phase 129:
```typescript
const { data } = await httpsCallable<AdminVolunteerLinkRequest, { sent?: boolean; link?: string }>(
  functions,
  'adminVolunteerLink',
)({ orgId, email: editingPerson.value.email, mode })
```
Import `functions` + `httpsCallable` the same way ServiceEditorView does (`firebase/functions` + `@/firebase` config). RosterView does not currently import these — add the imports (its import block is at L465-478).

**Analog C — copy-to-clipboard + transient confirmation:** `src/views/ServiceEditorView.vue:4056-4064` (share-link copy). Same `navigator.clipboard.writeText(...)` + a `ref` flag flipped true then reset via `setTimeout`. `QuarterView.vue:825-833` shows the defensive `if (navigator.clipboard)` guard variant. Use a local `ref` (e.g. `linkCopied`) reset after ~2s rather than inventing a toast — CONTEXT says "do not invent new chrome"; the copied-flag idiom is the established Roster/ServiceEditor convention.

Add `onEmailSignInLink` / `onCopySignInLink` handlers next to the existing drawer action handlers (`onDeactivateFromDrawer` at L634, etc.), each guarding on `editingPerson.value?.email`.

---

### `functions/src/index.test.ts` — tests for the new callable (test)

**Analog:** `describe("requestVolunteerLinkHandler")`, `functions/src/index.test.ts:5873-5972`.

- **Fake Firestore:** copy `fakeVolunteerDb` (L5895-5960) as the base — it already models `organizations/{orgId}` `.get()` and the `people` subcollection `.get()`. EXTEND `makeOrgRef` (L5928-5947) to also serve the `members/{uid}` subcollection (the new authz re-check reads it) — currently it throws on any subcollection other than `people` (L5944). Drop the rate-limit/org-counter collections if the admin path omits limiters.
- **Request builder:** copy `fakeVolunteerRequest` (L5962-5966) but set `auth: { uid, token: {} }` (this callable is authenticated) — see the authed builder idiom at L2278 / L592-601.
- **Mint mock:** reuse `setGenerateLink` (L5968-5972) and the hoisted `getAuth().generateSignInWithEmailLink` mock (module mock L107-117) to assert copy-mode returns the minted link.
- **Resend mock:** the hoisted `vi.mock("resend")` factory + `mockResolvedValue` (L179-188) — assert email-mode calls send and copy-mode does NOT.
- **appConfig:** `vi.mocked(getAppConfig).mockResolvedValue(DEFAULT_APP_CONFIG)` per-test (L194).
- New assertions the sibling lacks: unauthenticated → `unauthenticated`; non-member / viewer role → `permission-denied`; not-on-roster or no-email target → honest error (NOT a generic success — the opposite of the public path's enumeration-safe behavior).

## Shared Patterns

### Editor/admin authz re-check
**Source:** `functions/src/index.ts:1664-1721` (`queueServiceMessageHandler`)
**Apply to:** the new `adminVolunteerLink` handler. Server-resolved `orgRef`, `members/{uid}` role ∈ {editor, admin}, never trust client orgId.

### Roster gate (full-fetch + in-memory lowercase compare)
**Source:** `functions/src/index.ts:2575-2584` (`requestVolunteerLinkHandler`)
**Apply to:** the new handler. Use normalized `emailLower` for both the compare and the mint (CR-02).

### Shared mint/send core (R402 one code path)
**Source:** `functions/src/volunteerLink.ts:48-74`
**Apply to:** both email and copy modes, via the mint-extraction refactor above.

### Typed callable invocation
**Source:** `src/views/ServiceEditorView.vue:3142-3160`
**Apply to:** RosterView's email/copy handlers.

### Copy-to-clipboard + transient "Copied!" flag
**Source:** `src/views/ServiceEditorView.vue:4056-4064` (guard variant `QuarterView.vue:825-833`)
**Apply to:** RosterView copy-mode handler.

## No Analog Found

None — every file maps to an in-repo analog.

## Metadata

**Analog search scope:** `functions/src/` (index.ts, volunteerLink.ts, index.test.ts), `src/views/` (RosterView.vue, ServiceEditorView.vue, QuarterView.vue), `src/components/` (clipboard precedents)
**Files scanned:** 7
**Pattern extraction date:** 2026-09-06
