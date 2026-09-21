---
phase: 138-field-fixes-church-picker-deep-link-service-update-email-lin
reviewed: 2026-09-09T18:37:23Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - src/stores/auth.ts
  - src/stores/__tests__/auth.test.ts
  - src/components/ReLockNotifyPrompt.vue
  - src/components/__tests__/ReLockNotifyPrompt.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 138: Code Review Report

**Reviewed:** 2026-09-09T18:37:23Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the two independent field fixes in this phase against their locked decisions and threat
models: the two-tier (sessionStorage + uid-scoped localStorage) remembered-org persistence in
`src/stores/auth.ts` (R428), and the plan-link + `ensureShareLink` soft-fail precondition in
`src/components/ReLockNotifyPrompt.vue` (R434), plus the `vi.hoisted()` test-hoisting fix in
`ServiceEditorView.test.ts`.

**R428 (church-picker):** Traced `readRememberedOrg`/`rememberOrg`/`clearRememberedOrg` line-by-line
against `loadOrgContext`'s `ids.includes(remembered)` guard (auth.ts:552-554, confirmed byte-for-byte
unchanged via `git diff`) and the `logout()` call site (auth.ts:920, confirmed synchronous, before any
`await`, so no partial-clear window). Both storage tiers apply the identical `{uid, orgId}` shape
validation before being trusted; a value for a mismatched uid or a non-member org id is rejected
regardless of which tier produced it. Each tier's read/write/clear is independently try/catched, so a
privacy-mode block on one tier never skips the other. No `storage`-event listener was added (per the
locked "no cross-tab live sync" decision). All three new auth-store tests (new-tab restore, sign-out
clears both tiers, stale-non-member-org not honored) exercise real gaps against `mockMultiOrg()`'s
`org-1`/`org-2` membership fixture and a genuinely non-member `org-not-mine` id — not tautological.

**R434 (email link):** Traced `onSend()`'s soft-fail `ensureShareLink` call through to
`src/stores/services.ts:1159-1231` — confirmed idempotent (steady-state read / adopt / mint, guarded by
a transaction) and confirmed its `writeSharePayload` call persists to the same `shareTokens/{token}`
collection that the server's `resolveServiceLink` (`functions/src/index.ts:1990-2012`) queries at
send-time, so the client-minted token is actually resolvable server-side. The `{{service_link}}`
literal matches the token `messageTokens.ts:56` substitutes. The empty-link graceful-omission path
(`shareLink.trim()`) correctly omits the entire line, never a dangling label or bare token.

Ran the three touched test files (`auth.test.ts`, `ReLockNotifyPrompt.test.ts`,
`ServiceEditorView.test.ts`): 498/498 pass. `npm run type-check` (`vue-tsc --build`, catches test-file
type errors per CLAUDE.md) is clean. ESLint on the five reviewed files reports only pre-existing
underscore-prefixed unused-arg noise in `ServiceEditorView.test.ts` at lines outside this phase's diff
hunks (verified against `git show 70c8150f`) — not phase-introduced.

No BLOCKER findings. One WARNING (a test-double gap that could mask a future real bug behind a
soft-fail) and one INFO (a misleading local variable name).

## Warnings

### WR-01: `ServiceEditorView.test.ts`'s shared services-store mock omits `ensureShareLink`, leaving `ReLockNotifyPrompt`'s real send path unexercised in that harness

**File:** `src/views/__tests__/ServiceEditorView.test.ts:453-475`
**Issue:** `ReLockNotifyPrompt.vue` is mounted as a **real** (non-stubbed) child component in this file's
re-lock describe block (`wrapper.findComponent(ReLockNotifyPrompt)`), and per 138-02 it now calls
`servicesStore.ensureShareLink(props.service, props.orgId)` inside `onSend()`. The `vi.mock('@/stores/services', ...)`
factory in this file (updated by 138-02's `vi.hoisted()` fix for the TDZ issue, but not otherwise
extended) does not expose an `ensureShareLink` property. Today this is masked because every test in the
`describe('ServiceEditorView - re-lock change-notice prompt ...')` block drives resolution by emitting
`sent`/`cancel` directly on the mounted VM (`prompt(wrapper).vm.$emit('sent')`) rather than clicking the
component's own "Send notice" button — so `onSend()` (and therefore the missing mock method) is never
actually invoked from this file today.

If a future test in this suite exercises the real click-to-send path (e.g. a regression test asserting
the queued message's `body` contains the plan-link line, mirroring the dedicated coverage already in
`ReLockNotifyPrompt.test.ts`), `servicesStore.ensureShareLink(...)` would throw
`TypeError: ... is not a function`. Because that call sits inside `onSend`'s own soft-fail `try/catch`
(`ReLockNotifyPrompt.vue:319-323`), the error would be silently swallowed and logged as
`ensureShareLink self-heal failed (non-blocking)` — indistinguishable from a genuine mint failure — and
the resulting assertion would see the link line correctly omitted, masking the fact that the mock, not
production logic, is what failed. This is a latent test-quality gap, not a runtime defect in shipped
code (the dedicated `ReLockNotifyPrompt.test.ts` mock is correct and exercises the real path).
**Fix:** Add `ensureShareLink: vi.fn(() => Promise.resolve('mock-share-token'))` (or reuse
`mockCreateShareToken`) to the `useServiceStore` mock in `ServiceEditorView.test.ts`'s
`vi.mock('@/stores/services', ...)` factory, e.g.:
```ts
useServiceStore: () => ({
  // ...existing fields
  createShareToken: mockCreateShareToken,
  ensureShareLink: mockCreateShareToken, // ReLockNotifyPrompt's R434 soft-fail precondition
  isOwnWriteEcho: (id: string) => mockOwnWriteEchoIds.includes(id),
}),
```

## Info

### IN-01: `shareLink` variable in `onSend()` actually holds a share *token*, not a resolved link

**File:** `src/components/ReLockNotifyPrompt.vue:318-320`
**Issue:** `let shareLink = ''` is assigned from `servicesStore.ensureShareLink(...)`, but
`ensureShareLink`'s own docstring (`src/stores/services.ts:1154-1158`) states it "resolves THE one
stable **token** for a service" and its return type/behavior is a bare token string (e.g.
`'mock-share-token'` in tests), not a full URL. Only the truthiness of the value is used here (to decide
whether to append the plan-link line), so this has no functional effect, but the name invites a future
maintainer to assume `shareLink` is a URL and log/display it as one.
**Fix:** Rename to `shareToken` (or `linkToken`) for clarity, e.g. `let shareToken = ''` /
`shareToken = await servicesStore.ensureShareLink(...)` / `shareToken.trim() ? ... : ...`.

---

_Reviewed: 2026-09-09T18:37:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
