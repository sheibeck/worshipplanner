# Phase 138: Field Fixes — Church-Picker Deep-Link & Service-Update Email Link - Research

**Researched:** 2026-09-09
**Domain:** Two independent, already-diagnosed defect fixes in a shipped Vue 3 + Pinia + Firebase app —
client-side org-selection persistence (`src/stores/auth.ts`) and a Cloud-Functions-backed transactional
email body (`src/components/ReLockNotifyPrompt.vue` → `functions/src/messageTokens.ts`).
**Confidence:** HIGH — every claim below is grounded in this pass's direct reads of the real files
(line numbers cited), not the milestone-level research alone.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Church-Picker Persistence (R428)**
- Two-tier storage: keep `sessionStorage` as the primary remembered-org store and add a **uid-scoped
  `localStorage` fallback**, changed only inside `src/stores/auth.ts`'s three private helpers
  (`readRememberedOrg` / `rememberOrg` / `clearRememberedOrg`). A genuinely-new tab (empty sessionStorage)
  restores the active org from the localStorage fallback; same-session per-tab behavior is unchanged. This
  needs zero changes to `loadOrgContext`, `needsOrgSelection`, or the router guard.
- No cross-tab live sync — a new tab reads the persisted org on load only; do NOT add a `storage`-event
  listener that live-switches an open tab's active org (preserves the deliberate per-tab isolation the
  original `sessionStorage` design chose, documented at `src/stores/auth.ts:64-70`).
- Sign-out clears BOTH tiers — the existing logout clear call must clear the new `localStorage` key too,
  so a different user signing in next on a shared computer sees no leftover church (no cross-account leak).
- Stale-membership re-validation preserved — the persisted org is honored only if it is still in the
  user's memberships (`ids.includes(remembered)` in `loadOrgContext`). A user removed from an org since it
  was last remembered is not silently routed into it.

**Service-Update Email Link (R434)**
- Root-cause fix: append `{{service_link}}` to `ReLockNotifyPrompt.vue`'s **auto-generated re-lock
  notice body** (the diagnosed gap — that body never contained the token).
- Ensure-link precondition: guarantee a share link exists before the email is sent (ensure/self-heal
  via the existing `ensureShareLink`/`resolveServiceLink` path). If a link genuinely cannot be produced,
  omit the link line gracefully — never substitute an empty/broken token into the email (Pitfall 9).
- Dead `attachServiceLink` field: out of scope for this phase (optional defense-in-depth). The R434
  requirement is satisfied by the auto-body fix + ensure-link guard.

### Claude's Discretion
- Exact `localStorage` key name/shape (mirror the existing `SELECTED_ORG_STORAGE_KEY` uid-scoping).
- Whether the ensure-link step lives client-side (before `queueServiceMessage`) or server-side in the
  send handler — planner/executor decides based on where the null-link risk actually is.

### Deferred Ideas (OUT OF SCOPE)
- Wiring the dead `attachServiceLink` composer option (defense-in-depth, not required for R434).
- Dedicated `{{report_time}}`/`{{rehearsal_dates}}` merge tokens (v2 TIME-EXTRA-03).
- Any rehearsal/report time work (Phase 139), Vamps (Phase 140/141), broader messaging/notification
  redesign, router-guard changes, cross-tab live sync, restoring org from a `?org=` deep-link query param.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R428 | Multi-church member opening a nav link in a new tab / deep link lands on the intended page, not the church picker; stale-membership re-validation, sign-out clearing, no cross-account leak, single-church users unaffected. | Verified exact current `auth.ts` code (lines 65-98, 525-527, 886-924) below; confirms the diff surface is exactly the three private helpers + one logout line, no `loadOrgContext`/router changes needed. |
| R434 | Every service-update / re-lock notification email includes a working link to the plan; the share link is guaranteed to exist before send. | Verified `ReLockNotifyPrompt.vue`'s `bodyText`/`onSend` (lines 297-330), `ensureShareLink` (`services.ts:1159+`), `resolveServiceLink` (`functions/src/index.ts:1990-2012`), and `renderMessageTokens` (`messageTokens.ts:47-63`) below; confirms the fix is a body-string append + a client-side `ensureShareLink` call before `queueServiceMessage`. |
</phase_requirements>

## Summary

Both defects are exactly as diagnosed in `.planning/research/ARCHITECTURE.md` and `PITFALLS.md`
(milestone-level research) — this pass re-verified every cited line against the live source and found
**no surprises and no drift**. Both fixes are small, isolated, and independent of each other.

**R428 (church-picker):** `src/stores/auth.ts:70-98` currently persists the remembered org in
`sessionStorage` only, via three private module-scope functions (`readRememberedOrg`, `rememberOrg`,
`clearRememberedOrg`), all called from exactly one read site (`loadOrgContext` at line 525) and one
logout site (`logout()` at line 893, wired at the top of the sign-out branch). The fix is additive-only:
add a second `localStorage` key (`SELECTED_ORG_LOCAL_KEY`, same `{uid, orgId}` JSON shape) as a fallback
tier inside the three helpers, and add its `removeItem` call next to the existing `clearRememberedOrg()`
call at logout. `loadOrgContext`'s `ids.includes(remembered)` guard (line 527) is untouched — it operates
on whatever string the helper returns, regardless of which storage tier answered.

**R434 (service-update email link):** The re-lock notice's `bodyText` computed
(`ReLockNotifyPrompt.vue:297-300`) is auto-generated purely from the change diff and never contains the
`{{service_link}}` token — confirmed verbatim, matching ARCHITECTURE.md's citation exactly. The
`options: { attachServiceLink: true }` sent alongside it (line 325) is a dead field — confirmed:
`sendQueuedMessageHandler` (`functions/src/index.ts:2029+`) never reads `message.options?.attachServiceLink`
anywhere in its body; the only place `{{service_link}}` ever gets substituted is `renderMessageTokens`
(`messageTokens.ts:47-63`) finding a literal token string in the body. The fix is a body-string append
(`'', 'View the full plan: {{service_link}}'`) plus a client-side pre-send `ensureShareLink(props.service,
props.orgId)` call — `ReLockNotifyPrompt.vue` already receives both `service: Service` and `orgId: string`
as props (lines 190-196), and `ensureShareLink(service, orgIdValue): Promise<string>` is already exported
from the services store (`services.ts:1159`, `1320`) with an established, idempotent, soft-fail call
pattern already used identically at `markAsPlanned` (`services.ts:736`, try/catch, log-only, never blocks
the caller).

**Primary recommendation:** Implement both fixes as the minimal diffs already spelled out in
ARCHITECTURE.md's "Church-picker fix" and "Emails" sections — do not re-derive an alternative design.
The only implementation decision genuinely open (per CONTEXT.md's "Claude's Discretion") is confirmed
resolvable in favor of **client-side** ensure-link: the component already has `service` + `orgId` as
props and the store already exposes `ensureShareLink` with a proven soft-fail pattern at another call
site — a server-side equivalent would require duplicating `ensureShareLink`'s Firestore
read/adopt/mint/transaction logic (currently client-SDK-only, in `services.ts`) inside
`functions/src/index.ts`, which is strictly more code for the same outcome.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Active-org persistence across tabs (R428) | Browser / Client | — | Pure client storage-API concern (`sessionStorage`/`localStorage`); no server round-trip, no schema change. |
| Stale-membership re-validation of a persisted org | Browser / Client | — | `ids.includes(remembered)` runs against `authStore`'s already-resolved claims/memberships in `loadOrgContext`; no new backend read needed. |
| Re-lock notice email body composition (R434) | Browser / Client | API / Backend | The Vue component composes the auto-generated body string (client); the Cloud Function (`sendQueuedMessageHandler`) performs the actual `{{service_link}}` token substitution and send (backend). Both must agree on the token literal. |
| Share-link existence guarantee before send (R434) | Browser / Client | — | `ensureShareLink` is a client-SDK Firestore transaction living in the Pinia `services` store; the natural call site is client-side, immediately before `queueServiceMessage`, mirroring the existing `markAsPlanned` self-heal call. |

## Package Legitimacy Audit

Not applicable — this phase installs no new npm/pip/cargo packages. Both fixes use only
already-present dependencies (`sessionStorage`/`localStorage` browser APIs, the existing
`firebase/functions` `httpsCallable`, and the existing Pinia `services` store).

## Verified Current Code (file:line, read this pass)

### R428 — `src/stores/auth.ts`

```typescript
// auth.ts:65-98 (verbatim, read 2026-09-09)
// Per-session memory of which church a multi-org user chose to enter. Kept in
// sessionStorage (NOT localStorage) so it survives a page refresh but a full
// logout clears it — matching "log out and back in to switch churches". Keyed
// by uid so one browser session can't leak a choice across accounts. Every
// access is guarded: sessionStorage throws in some privacy modes.
const SELECTED_ORG_STORAGE_KEY = 'wp.selectedOrg'

function readRememberedOrg(uid: string): string | null {
  try {
    const raw = sessionStorage.getItem(SELECTED_ORG_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { uid?: string; orgId?: string }
    return parsed.uid === uid && typeof parsed.orgId === 'string' ? parsed.orgId : null
  } catch {
    return null
  }
}

function rememberOrg(uid: string, orgId: string): void {
  try {
    sessionStorage.setItem(SELECTED_ORG_STORAGE_KEY, JSON.stringify({ uid, orgId }))
  } catch {
    // sessionStorage unavailable (private mode / disabled) — the choice simply
    // won't persist across a refresh; not fatal.
  }
}

function clearRememberedOrg(): void {
  try {
    sessionStorage.removeItem(SELECTED_ORG_STORAGE_KEY)
  } catch {
    // ignore — see rememberOrg
  }
}
```

- `loadOrgContext` (`auth.ts:444+`) calls `readRememberedOrg(uid)` **exactly once**, at line 525:
  `const remembered = readRememberedOrg(uid)`, then line 527:
  `remembered && ids.includes(remembered) ? remembered : ids.length === 1 ? ids[0]! : null`.
  This is the stale-membership guard that MUST be preserved verbatim — it operates on whatever string
  the helper returns, so adding a second storage tier inside the helper requires zero change here.
- `logout()` (`auth.ts:886-924`) calls `clearRememberedOrg()` unconditionally at line 893, near the top
  of the sign-out branch, before `signOut(auth)` — this is the single call site to extend with the new
  key's `localStorage.removeItem`.
- `needsOrgSelection` (line 183) and `requiresOrgSelection` (line 207) are downstream computeds that
  read `orgId.value` — they are not touched by this fix, confirmed no direct references to the storage
  helpers outside `loadOrgContext`/`logout`.
- No other call sites of `readRememberedOrg`/`rememberOrg`/`clearRememberedOrg` exist in `auth.ts` beyond
  those enumerated (grep-confirmed this pass).

**Confirmed diff surface:** exactly the three helper functions (add a `localStorage` fallback tier) +
one additional `removeItem` call inside the existing `logout()` function body, at the same call site
`clearRememberedOrg()` already occupies. No changes to `loadOrgContext`, `needsOrgSelection`,
`requiresOrgSelection`, or `src/router/index.ts`.

### R434 — `src/components/ReLockNotifyPrompt.vue` + email plumbing

```vue
<!-- ReLockNotifyPrompt.vue:190-196 (props, verbatim) -->
const props = defineProps<{
  ...
  service: Service
  ...
  orgId: string
  ...
}>()
```

```typescript
// ReLockNotifyPrompt.vue:293-330 (verbatim, read 2026-09-09)
const subject = computed(() => {
  const n = checkedEntries.value.length
  return `Service updated: ${n} ${n === 1 ? 'change' : 'changes'} since the last lock`
})
const bodyText = computed(() => {
  const lines = checkedEntries.value.map((e) => `- ${e.description}`)
  return ['Here's what changed since the last lock:', '', ...lines].join('\n')
})
// ...
async function onSend() {
  if (sendDisabled.value) return
  sending.value = true
  sendError.value = ''
  try {
    const queueServiceMessage = httpsCallable<RelockQueueMessageRequest, { messageId: string }>(functions, 'queueServiceMessage')
    await queueServiceMessage({
      orgId: props.orgId,
      serviceId: props.service.id,
      type: 'relock-notification',
      subject: subject.value,
      body: bodyText.value,
      recipientSelector: { /* ... */ },
      options: {
        attachServiceLink: true,   // dead field — confirmed unread server-side
        sendCopyToSelf: false,
      },
      scheduledFor: null,
      changeDiff: checkedEntries.value,
    })
    emit('sent')
  } catch (err) { /* ... */ }
}
```

- `bodyText` never contains the literal string `{{service_link}}` — confirmed by full read of lines
  280-340; the only tokens in this file are the auto-generated diff lines.
- No import of the `services` Pinia store exists in this file today (`ReLockNotifyPrompt.vue:182-188`
  full import list confirmed) — adding a client-side ensure-link call requires a **new** import:
  `import { useServicesStore } from '@/stores/services'`.
- `attachServiceLink: true` is set at line 325 but **confirmed dead**: grepped
  `functions/src/index.ts` for `attachServiceLink` — it appears only at its interface declaration
  (`MessageOptions`, line 1632) and this one call site's payload (line 1382, a *different* caller —
  the initial-lock email, also setting it but also never reading it back); `sendQueuedMessageHandler`
  (the actual send path, `index.ts:2029-2200+`) has no reference to `attachServiceLink` anywhere in its
  body. Confirmed by direct read of the handler, not just grep absence.
- `resolveServiceLink` (`functions/src/index.ts:1990-2012`, verbatim):
  ```typescript
  async function resolveServiceLink(db, orgId: string, serviceId: string): Promise<string> {
    const base = SERVICE_SHARE_BASE_URL.value().trim()
    if (base === '') return ''
    const snap = await db.collection('shareTokens').where('serviceId', '==', serviceId).get()
    const candidates = snap.docs.map(...).filter((c) => c.orgId === orgId)
    if (candidates.length === 0) return ''   // <-- the A1 empty-substitution case (Pitfall 9)
    candidates.sort((a, b) => b.createdMs - a.createdMs)
    return `${base...}/share/${candidates[0]!.token}`
  }
  ```
  Called once per send at `index.ts:2160`: `const serviceLink = await resolveServiceLink(db, orgId, serviceId)`.
  This function only **reads** — it never mints a token. If no `shareTokens` doc exists yet for the
  service, it returns `''`, and `renderMessageTokens` (`messageTokens.ts:47,56`:
  `service_link: ctx.serviceLink`) will substitute an empty string wherever `{{service_link}}` appears
  in the body — confirming Pitfall 9 exactly as diagnosed.
- `ensureShareLink` (`src/stores/services.ts:1159-1230`, client-side, Pinia `services` store,
  exported at line 1320) is the **mint-or-adopt** counterpart: identity-doc read first (steady state,
  idempotent), else adopt an already-circulated token or mint a fresh one via a Firestore transaction.
  Confirmed idempotent — calling it repeatedly on an already-shared service is a no-op read plus a
  `writeSharePayload` refresh, never mints a duplicate token.
  **Two existing call sites already use this exact soft-fail pattern**, both confirmed by direct read:
  - `createService` (`services.ts:477-491`): `try { await ensureShareLink(created, orgId.value) } catch (err) { console.error(...) }` — "a share problem must never fail the user's create."
  - `markAsPlanned` (`services.ts:735-740`): `try { await ensureShareLink({ ...service, status: 'planned' }, orgId.value) } catch (err) { console.error(...) }` — "a failure here must never roll back the already-succeeded status transition."

**Confirmed fix, two parts, both needed for R434's full guarantee:**
1. Append a link line to `bodyText`'s computed: e.g.
   `['Here's what changed since the last lock:', '', ...lines, '', 'View the full plan: {{service_link}}'].join('\n')`.
   `renderMessageTokens` already substitutes this token correctly for every other caller (`LOCK_BODY`,
   `MessageComposer.vue`'s reminder/share-link defaults) — this alone is a proven, working pattern for
   this specific token.
2. Add `await servicesStore.ensureShareLink(props.service, props.orgId)` in `onSend()`, before the
   `queueServiceMessage(...)` call, wrapped in the same soft-fail try/catch style as `createService`/
   `markAsPlanned` (log-and-continue — a share-link mint failure must never block sending the notice
   itself; `resolveServiceLink` server-side will legitimately return `''` in that edge case, and the
   email will read without a dangling label only if the template appends the link as its own line,
   which is why part 1 phrases it as `'View the full plan: {{service_link}}'` rather than embedding the
   token mid-sentence — a bare empty substitution at the end of a line is far less jarring than one
   mid-sentence, though a fully graceful degrade would detect the empty-string case and omit the whole
   line; see Common Pitfalls below for the tradeoff).
   This mirrors `markAsPlanned`'s exact call shape — `props.service` already has the shape `ensureShareLink`
   expects (a full `Service` object with `.id`), and `props.orgId` is already a plain string prop, so no
   new prop threading is needed.

## Architecture Patterns

### Pattern 1: Two-tier browser storage fallback (R428)

**What:** Primary tier (`sessionStorage`) wins when present; a secondary tier (`localStorage`) is
consulted only when the primary tier has nothing, and both tiers are written/cleared together.

**When to use:** Any state that needs "per-tab isolation by default, but recoverable in a genuinely new
tab" — this is the general shape, not vamp/rehearsal-specific.

**Example:**
```typescript
// src/stores/auth.ts — recommended shape (mirrors ARCHITECTURE.md's diff exactly)
const SELECTED_ORG_STORAGE_KEY = 'wp.selectedOrg'          // sessionStorage — UNCHANGED, still primary
const SELECTED_ORG_LOCAL_KEY = 'wp.selectedOrg.persist'      // NEW localStorage key, same {uid, orgId} shape

function readRememberedOrg(uid: string): string | null {
  try {
    const raw = sessionStorage.getItem(SELECTED_ORG_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { uid?: string; orgId?: string }
      if (parsed.uid === uid && typeof parsed.orgId === 'string') return parsed.orgId
    }
  } catch { /* fall through */ }
  try {
    const raw = localStorage.getItem(SELECTED_ORG_LOCAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { uid?: string; orgId?: string }
    return parsed.uid === uid && typeof parsed.orgId === 'string' ? parsed.orgId : null
  } catch {
    return null
  }
}

function rememberOrg(uid: string, orgId: string): void {
  const payload = JSON.stringify({ uid, orgId })
  try { sessionStorage.setItem(SELECTED_ORG_STORAGE_KEY, payload) } catch { /* ignore */ }
  try { localStorage.setItem(SELECTED_ORG_LOCAL_KEY, payload) } catch { /* ignore */ }
}

function clearRememberedOrg(): void {
  try { sessionStorage.removeItem(SELECTED_ORG_STORAGE_KEY) } catch { /* ignore */ }
  try { localStorage.removeItem(SELECTED_ORG_LOCAL_KEY) } catch { /* ignore */ }  // preserves "logout clears it"
}
```

Note: `clearRememberedOrg()` already IS the logout call site (`auth.ts:893`), so folding the
`localStorage.removeItem` into the function body itself (rather than adding a second call at the logout
site) is the simplest, least-error-prone diff — one function change, not two call sites to keep in sync.

### Pattern 2: Idempotent, soft-fail share-link self-heal before a send (R434)

**What:** Before any code path that promises "the plan link works," call `ensureShareLink` and swallow
failures (log only) — never let a link-mint failure block the primary action (create, lock, or here,
send-a-notice).

**When to use:** Any future send/notify path that also carries `{{service_link}}` in its body should
follow this same precondition, per Pitfall 9's general lesson (not fixed here — the dead
`attachServiceLink` field / other callers are explicitly out of scope for this phase).

**Example:**
```typescript
// ReLockNotifyPrompt.vue — recommended addition, mirrors services.ts:735-740 exactly
import { useServicesStore } from '@/stores/services'
const servicesStore = useServicesStore()

async function onSend() {
  if (sendDisabled.value) return
  sending.value = true
  sendError.value = ''
  try {
    try {
      await servicesStore.ensureShareLink(props.service, props.orgId)
    } catch (err) {
      console.error('[ReLockNotifyPrompt] ensureShareLink self-heal failed (non-blocking):', err)
    }
    const queueServiceMessage = httpsCallable<RelockQueueMessageRequest, { messageId: string }>(functions, 'queueServiceMessage')
    await queueServiceMessage({ /* unchanged */ })
    emit('sent')
  } catch (err) { /* unchanged */ }
}
```

### Anti-Patterns to Avoid

- **Treating `sessionStorage` → `localStorage` as a drop-in API swap (Pitfall 10):** it is not — three
  separate behaviors (stale-membership validation, sign-out cleanup, per-tab isolation) were built
  around the old API's specific properties. Reuse `readRememberedOrg`'s existing validation verbatim;
  do not write a fresh, unvalidated localStorage read path.
- **Adding a `storage`-event listener "for completeness":** explicitly out of scope per CONTEXT.md — a
  `storage` event fires in *other* open tabs on `localStorage` writes; listening for it would silently
  reintroduce live cross-tab org-switching, which the original `sessionStorage` design deliberately
  avoided.
- **Fixing R434 by making `attachServiceLink` do something (defense-in-depth):** explicitly deferred by
  CONTEXT.md. Touching `sendQueuedMessageHandler` (the shared send path for every message type) raises
  the review bar for a phase whose scope is one caller's body string. Do the two-part fix above only.
- **Embedding `{{service_link}}` mid-sentence without considering the empty-string case:** per Pitfall 9,
  `resolveServiceLink` legitimately returns `''` for a tokenless service; even with the `ensureShareLink`
  precondition (which greatly reduces but does not mathematically eliminate this — e.g. `ensureShareLink`
  itself could throw and be swallowed), phrase the appended line so an empty substitution reads as
  merely missing a URL after a label, not as a broken sentence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Guaranteeing a share link exists before an email references it | A new server-side mint-or-adopt routine inside `sendQueuedMessageHandler` | The existing client-side `ensureShareLink` (`services.ts:1159`), called before `queueServiceMessage`, mirroring `markAsPlanned`'s call | `ensureShareLink` already handles the identity-doc/adopt/mint/transaction dance correctly and idempotently; duplicating it server-side (where the SDK/transaction shape differs, Admin SDK vs. client SDK) is strictly more code and a second place for the mint logic to drift. |
| Validating a persisted org id against current memberships | A new validation check inside the new `localStorage` read path | The existing `ids.includes(remembered)` guard in `loadOrgContext` (`auth.ts:527`), which already runs regardless of which storage tier answered | The guard is storage-tier-agnostic by construction — it just needs a string, and the helper functions are the only thing that changes. |

**Key insight:** both fixes are additive layers on top of already-correct, already-tested logic
(`loadOrgContext`'s membership guard; `renderMessageTokens`'s substitution; `ensureShareLink`'s
idempotent mint). The task is wiring, not new logic.

## Common Pitfalls

### Pitfall 1: Dropping one of the three sessionStorage-era guarantees when adding localStorage
**What goes wrong:** A naive "also write to localStorage" patch forgets (a) the `ids.includes` guard
still applies to the localStorage-sourced value, (b) sign-out clears the new key too, or (c) no
`storage`-event listener gets added.
**Why it happens:** `sessionStorage`/`localStorage` share an identical `getItem`/`setItem`/`removeItem`
API, making the swap look trivial when three separate behaviors actually depend on the specific storage
type, not the API shape.
**How to avoid:** Fold the localStorage fallback into the *existing* three helper functions (as shown
in Pattern 1) rather than writing new, parallel logic — this makes it structurally impossible to skip
the guard, since `loadOrgContext` only ever calls `readRememberedOrg` once.
**Warning signs:** a test that only covers "single user, single tab" — this needs an explicit test for
(a) a user removed from an org after selecting it, (b) sign-out then a different user's session, and
(c) two tabs open with different active orgs.

### Pitfall 2: The email link fix works in dev (service just created, auto-share-link succeeded) but fails silently for legacy services
**What goes wrong:** Testing only against a freshly created service (which already auto-generates a
share link at creation, `services.ts:470-491`) never exercises the tokenless path, so the append-only
fix "looks done" while a legacy/pre-auto-link service still gets `'View the full plan: '` with nothing
after it.
**Why it happens:** The happy path (service has a token) is the overwhelmingly common case in a dev
session with fresh test data.
**How to avoid:** Add a test (or manually verify) sending a re-lock notice for a service whose
`shareTokens`/`serviceShareLinks` docs do not yet exist — confirm `ensureShareLink` mints one and the
substituted body contains a real URL, not an empty string.
**Warning signs:** `resolveServiceLink` returning `''` for a service that has genuinely never been
shared or auto-share-link-generated (the "A1 empty substitution" case, `functions/src/index.test.ts:6024`).

## Code Examples

Verified patterns from this codebase (not third-party — both fixes are wiring onto existing, shipped
mechanisms):

### Existing soft-fail `ensureShareLink` call (the pattern to mirror)
```typescript
// Source: src/stores/services.ts:735-740 (verbatim)
try {
  await ensureShareLink({ ...service, status: 'planned' }, orgId.value)
} catch (err) {
  console.error(
    `markAsPlanned: share-link self-heal failed for service ${id} — the status transition already succeeded`,
    err,
  )
}
```

### Existing correct `{{service_link}}` usage elsewhere (proves the token substitution works)
```typescript
// Source: functions/src/messageTokens.ts:47,56 (verbatim excerpt)
export function renderMessageTokens(template: string, ctx: MessageTokenContext): string {
  // ...
  service_link: ctx.serviceLink,
  // ...
}
```
`LOCK_BODY` (`ServiceEditorView.vue:3139-3153`, the initial-lock email) and `MessageComposer.vue`'s
`reminder`/`share-link` defaults already embed `{{service_link}}` literally and it resolves correctly —
this is a proven pattern being extended to one more caller, not new plumbing.

## State of the Art

No external "state of the art" applies — this is an internal defect fix against the project's own,
already-established conventions. There is no old-vs-new approach shift; the fix is applying the
project's existing patterns (two-tier browser storage, idempotent self-heal-before-send) to one more
call site each.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phrasing the appended email line as `'View the full plan: {{service_link}}'` (a standalone line) is an acceptable interim degrade if `ensureShareLink` itself throws and is swallowed, versus fully detecting-and-omitting the line for a genuinely empty resolved link. CONTEXT.md says "omit the link line gracefully" — implementing a full detect-and-omit requires either a server-side check in `sendQueuedMessageHandler` (out of scope, touches shared send code) or trusting the client-side `ensureShareLink` precondition to make the empty case rare enough to accept. | Common Pitfalls / Verified Current Code | If the planner interprets "gracefully" as requiring a server-side conditional line-omission, the fix grows into the `attachServiceLink` defense-in-depth work explicitly deferred by CONTEXT.md. Low risk (rare edge case, non-blocking), but worth an explicit planner decision rather than silent assumption. |

**If this table is empty:** N/A — see A1 above. All other claims in this research were verified by
direct source reads this session (file:line citations throughout), not assumed.

## Open Questions

1. **Should the "graceful omission" for a genuinely-empty resolved link be implemented in this phase?**
   - What we know: `ensureShareLink` called client-side before send makes the empty-link case rare
     (only if the mint itself throws and is swallowed, or `SERVICE_SHARE_BASE_URL` is unconfigured
     server-side).
   - What's unclear: whether CONTEXT.md's "omit the link line gracefully" phrase requires an explicit
     server-side conditional (checking `serviceLink === ''` before appending the rendered line) versus
     accepting the residual-empty-string case as sufficiently mitigated by the ensure-link precondition.
   - Recommendation: default to the two-part fix (body append + client-side `ensureShareLink` call) as
     CONTEXT.md's primary instruction; if the planner wants literal detect-and-omit, it requires a small,
     scoped addition inside `sendQueuedMessageHandler` right after computing `serviceLink`
     (`index.ts:2160`) — e.g. strip the `'View the full plan: {{service_link}}'` line from the rendered
     body only when `serviceLink === ''`. This is a few-line, single-caller-safe addition, distinct from
     wiring the shared `attachServiceLink` field (which is what's actually deferred).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (root suite: `4.0.x`, jsdom environment) |
| Config file | `vite.config.ts` (excludes `src/rules.test.ts` and `render-service/**`) |
| Quick run command | `npx vitest run src/stores/__tests__/auth.test.ts src/components/__tests__/ReLockNotifyPrompt.test.ts` |
| Full suite command | `npx vitest run` (bare — per CLAUDE.md, do NOT use `--dir src`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R428 | A genuinely-new-tab restore (empty sessionStorage, populated uid-scoped localStorage) resolves `loadOrgContext`'s active org from the localStorage fallback. | unit | `npx vitest run src/stores/__tests__/auth.test.ts -t "new tab"` | ✅ Extend existing `describe('multi-org selection', ...)` block (`auth.test.ts:493`) |
| R428 | Sign-out clears BOTH the sessionStorage key and the new localStorage key — a different user signing in next sees no leftover org. | unit | `npx vitest run src/stores/__tests__/auth.test.ts -t "clears"` | ✅ Extend existing `describe('logout', ...)` block (`auth.test.ts:398`) |
| R428 | A persisted-but-no-longer-member org (in localStorage) is NOT honored — `ids.includes(remembered)` still gates it. | unit | `npx vitest run src/stores/__tests__/auth.test.ts -t "stale"` | ✅ Extend `describe('multi-org selection', ...)` alongside the existing `'selectOrg ignores an org the user does not belong to'` test (`auth.test.ts:520`) |
| R428 | A single-church user is unaffected (still resolves via the `ids.length === 1` fallback regardless of storage state). | unit | same file, `-t "single-org"` | ✅ Existing test `'a single-org user goes straight in (no selection required)'` (`auth.test.ts:530`) already covers this path structurally — re-run after the fix to confirm no regression, no new test strictly required but recommended for explicitness |
| R434 | The auto-generated re-lock `bodyText` contains the literal `{{service_link}}` token. | unit | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts -t "service_link"` | ❌ Wave 0 — no existing assertion reads `bodyText`/`payload.body`; add one alongside the existing `'calls queueServiceMessage once...'` test (`ReLockNotifyPrompt.test.ts:234`) |
| R434 | `ensureShareLink` is called (with `props.service`/`props.orgId`) before `queueServiceMessage`, and a rejection from it does not block the send. | unit | same file, `-t "ensureShareLink"` | ❌ Wave 0 — requires a new `vi.mock('@/stores/services', ...)` in this test file (none exists today — this file currently sets up no Pinia/store mocks at all, confirmed by full-file grep) |
| R434 | The token substitution itself (`{{service_link}}` → a real URL) is proven correct — regression guard on the shared mechanism this fix depends on. | unit | `cd functions && npx vitest run messageTokens.test.ts` | ✅ Already exists — `functions/src/messageTokens.test.ts` |

### Sampling Rate
- **Per task commit:** `npx vitest run src/stores/__tests__/auth.test.ts src/components/__tests__/ReLockNotifyPrompt.test.ts`
- **Per wave merge:** `npx vitest run` (bare root suite — expect the documented 1-file `storage.rules.test.ts`
  baseline failure only, per CLAUDE.md; anything else is a regression)
- **Phase gate:** `npm run type-check` (uses `vue-tsc --build`, catches the test-file type errors the
  narrower `-p tsconfig.app.json` form misses) + full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/__tests__/ReLockNotifyPrompt.test.ts` — needs a new `vi.mock('@/stores/services', ...)`
      block (this file has zero Pinia/store mocking today) exposing a mockable `ensureShareLink`, so the
      new client-side call in `onSend()` doesn't throw "no active Pinia" or hit the real Firestore SDK
      during the test run.
- [ ] `src/components/__tests__/ReLockNotifyPrompt.test.ts` — needs a new assertion on `payload.body`
      (currently the `toMatchObject` at line 245-257 never checks `body`'s exact string) confirming it
      contains `{{service_link}}` after the fix.
- [ ] `src/stores/__tests__/auth.test.ts` — needs `localStorage.clear()` added alongside the existing
      `sessionStorage.clear()` in the top-level `beforeEach` (`auth.test.ts:247-253`), and 2-3 new tests
      in the existing `describe('multi-org selection', ...)` / `describe('logout', ...)` blocks per the
      table above.

*(No new test framework or config needed — both target files and frameworks already exist.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V3 Session Management | yes | Org-selection state is client-side UX state, not an authentication session — Firebase Auth's own `browserLocalPersistence` (IndexedDB) already handles the actual auth session and is unchanged by this phase. The `localStorage` addition here is a *preference*, uid-scoped and re-validated against live membership on every read — never trusted as an access-control decision on its own (the real gate remains the router's `requiresOrgSelection` + backend Firestore/Storage rules keyed on the user's actual claims). |
| V4 Access Control | yes | Unaffected — no change to `firestore.rules`/`storage.rules`; the persisted org id is only ever a UI convenience, gated by the pre-existing `ids.includes(remembered)` check before it is honored. |
| V5 Input Validation | n/a | No new user-input surface — both fixes operate on already-validated, already-typed internal state (`uid`, `orgId` strings from Firebase Auth claims; `Service`/`ChangeEntry` objects already typed). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shared/kiosk computer retains a previous user's org selection after sign-out | Information Disclosure (low severity — org *name* leak only, not data access) | Clear both storage tiers on sign-out (the R428 fix's explicit third guarantee); already the exact mitigation CONTEXT.md specifies. |
| A revoked member's stale persisted org id routes them toward an org they no longer belong to | Elevation of Privilege (mitigated, not exploitable) | The `ids.includes(remembered)` re-validation already rejects a stale id before it's honored; the router guard downstream would reject it regardless even if this check were somehow bypassed — defense in depth already in place, this phase must not remove it. |
| An "always link to the plan" email increases how often a share link leaves the app via email | Information Disclosure (already reviewed, not new) | No new mitigation needed — the share-link's own access-control surface was reviewed and hardened in v2.8 (SEC-S-01); this phase only changes how often an *already-reviewed* link is distributed, not what it exposes. |

## Sources

### Primary (HIGH confidence — direct source reads this session, 2026-09-09)
- `src/stores/auth.ts` (lines 60-160, 444-530, 886-924) — the three helper functions, `loadOrgContext`'s
  read site and guard, `logout()`'s clear call site.
- `src/components/ReLockNotifyPrompt.vue` (lines 1-60, 150-340) — props, `bodyText`/`subject` computeds,
  `onSend()`, imports.
- `functions/src/index.ts` (lines 1985-2200) — `resolveServiceLink`, `sendQueuedMessageHandler`, the
  `attachServiceLink` dead-field confirmation, `serviceLink` resolution at the send site.
- `src/stores/services.ts` (lines 460-495, 720-740, 1155-1230) — `createService`'s auto-mint,
  `markAsPlanned`'s self-heal, `ensureShareLink`'s full implementation and export.
- `functions/src/messageTokens.ts` (lines 47-63) — `renderMessageTokens`/`service_link` substitution.
- `src/stores/__tests__/auth.test.ts`, `src/components/__tests__/ReLockNotifyPrompt.test.ts` — existing
  test structure, `beforeEach` setup, current assertions (to identify Wave 0 gaps).

### Secondary (MEDIUM confidence — milestone-level research, itself HIGH confidence per its own sourcing)
- `.planning/research/ARCHITECTURE.md` ("Emails: minimal wiring" and "Church-picker fix" sections) —
  cross-checked against this pass's direct reads; no discrepancies found.
- `.planning/research/PITFALLS.md` (Pitfall 9, Pitfall 10) — cross-checked; both pitfalls' cited line
  numbers and behaviors confirmed accurate this pass.

### Tertiary
- None — this phase required no external/web research; it is a defect fix against this project's own,
  already-mapped source.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new dependencies, pure internal wiring fix.
- Architecture: HIGH — every cited file:line was read directly this session, not inferred.
- Pitfalls: HIGH — both pitfalls (10 for R428, 9 for R434) are grounded in this project's actual code
  and cross-verified against the live source this pass.

**Research date:** 2026-09-09
**Valid until:** Effectively indefinite for this narrow scope (no external dependency drift possible) —
re-verify only if `auth.ts`'s storage helpers or `ReLockNotifyPrompt.vue`'s send path change before this
phase executes.
