# Phase 100: Invite & Login Onboarding Wiring - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 2 modified source files + 2 test files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/views/TeamView.vue` (`onInvite`) | controller/component action | request-response (best-effort callable after Firestore write) | `src/components/admin/OrganizationsTab.vue` (`onboardOrganization` call, lines 264-273, 469-490) | role-match (best client-side `httpsCallable` analog in repo) |
| `src/views/LoginView.vue` (`mapFirebaseError` + template hint) | component / error-mapping | request-response (Firebase Auth SDK) | `src/views/LoginView.vue` itself — existing `mapFirebaseError` switch (lines 180-193) and `handleForgotPassword` flow (line ~230+) | exact (extending in place, no external analog needed) |
| `src/views/__tests__/TeamView.test.ts` | test | unit (currently pure-function only, no mount) | `src/components/admin/__tests__/OrganizationsTab.test.ts` (name-keyed `httpsCallable` mock, lines 21-116) | role-match — TeamView.test.ts today does NOT mount the component or mock firebase; the callable-call test will need a new mounted-component block modeled on this file |
| `src/views/__tests__/LoginView.test.ts` | test | N/A — file does not exist yet | none in `__tests__` dirs for LoginView | no analog — must be created from scratch, or covered by extending TeamView-adjacent conventions (mount + auth store mock) |

## Pattern Assignments

### `src/views/TeamView.vue` — extend `onInvite` (lines 238-301)

**Analog:** `src/components/admin/OrganizationsTab.vue`

**Imports pattern** (`OrganizationsTab.vue` lines 197-200):
```typescript
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
```
TeamView.vue does not currently import `httpsCallable`/`functions` — add both, matching this exact import path convention (`@/firebase`, not a relative path).

**Local request/response type declaration pattern** (`OrganizationsTab.vue` lines 264-273):
```typescript
interface OnboardOrganizationRequest {
  name: string
  adminEmail: string
}

interface OnboardOrganizationResponse {
  status: 'added' | 'invited'
  orgId: string
  name: string
}
```
Comment convention above a similar undeployed/new-callable type (lines 250-253):
```typescript
// Phase 82 (R242) — mirrors functions/src/orgProvisioning.ts's
// setOrgAiEnabledHandler request/response contract exactly (Plan 01). The
// callable ships UNDEPLOYED with Plan 01 (client-only this plan); tests mock
// httpsCallable, so an undeployed target does not block this plan.
```
For this phase, declare locally in TeamView.vue (do NOT import from `functions/`, which is a separate build target):
```typescript
interface SendInviteOnboardingEmailRequest {
  orgId: string
  email: string
}

interface SendInviteOnboardingEmailResponse {
  emailSent: boolean
  kind: 'google-notify' | 'set-password' | 'skipped-disabled'
}
```
(Mirrors `functions/src/inviteOnboarding.ts`'s actual return shape — confirm field names against that file at implementation time.)

**Core call pattern — call site + try/catch** (`OrganizationsTab.vue` lines 467-490):
```typescript
isOnboarding.value = true
try {
  const onboardOrganization = httpsCallable<OnboardOrganizationRequest, OnboardOrganizationResponse>(
    functions,
    'onboardOrganization',
  )
  const result = await onboardOrganization({ name, adminEmail: email })
  onboardedFeedback.value = { name, status: result.data.status }
  churchName.value = ''
  adminEmail.value = ''
  await refreshOrgs()

  // Clear success feedback after 2 seconds (mirrors ConfigurationTab's
  // Grant/Granted! recipe).
  setTimeout(() => {
    onboardedFeedback.value = null
  }, 2000)
} catch (err) {
  console.error('[OrganizationsTab] onboardOrganization error:', err)
  onboardError.value = friendlyCallableError(err)
} finally {
  isOnboarding.value = false
}
```

**How to adapt for R294 (best-effort, must NOT fail the invite):** TeamView's `onInvite` (lines 264-300) already has its own outer try/catch wrapping `batch.commit()`. The new callable call must be a SEPARATE, NESTED try/catch placed AFTER `await batch.commit()` succeeds, so a callable failure never lands in the outer `catch` that sets `inviteError.value`:
```typescript
await batch.commit()

// Invite docs are authoritative and already committed above. The
// onboarding email is best-effort (R294) — its own try/catch so a
// rejected/undeployed callable never reverts or fails the invite.
let emailResult: SendInviteOnboardingEmailResponse | null = null
try {
  const sendInviteOnboardingEmail = httpsCallable<
    SendInviteOnboardingEmailRequest,
    SendInviteOnboardingEmailResponse
  >(functions, 'sendInviteOnboardingEmail')
  const result = await sendInviteOnboardingEmail({ orgId, email: normalized })
  emailResult = result.data
} catch (err) {
  console.error('[TeamView] sendInviteOnboardingEmail error (non-fatal):', err)
}

// Honest, result-driven success copy (R288/UI-SPEC state table).
if (emailResult?.emailSent) {
  invitedFeedback.value = `Invite email sent to ${normalized}.`
} else if (emailResult?.kind === 'skipped-disabled') {
  invitedFeedback.value = `${normalized} added — onboarding emails are turned off, so let them know to sign in with this address.`
} else {
  invitedFeedback.value = `${normalized} added — we couldn't send the invite email, so let them know to sign in with this address.`
}
```
Note: `invitedFeedback` is currently typed/used as the bare email string (line 287, `invitedFeedback.value = normalized`) with the template hardcoding the rest of the sentence (lines 38-40 of TeamView.vue: `{{ invitedFeedback }} added to the pending list — no email is sent...`). This phase changes `invitedFeedback` to hold the FULL message string, so the template's hardcoded trailing copy (lines 39-40) must be removed — just render `{{ invitedFeedback }}` directly.

**Error handling pattern reference** (`OrganizationsTab.vue` lines 405-424, `friendlyCallableError`): not required verbatim for TeamView since R294 mandates swallowing the callable error entirely (no error copy shown to user for callable failures) — only `console.error` + fallback feedback text, per the UI-SPEC table's "Send failed" row.

---

### `src/views/LoginView.vue` — `mapFirebaseError` + discoverability hint

**Analog:** itself (extend the existing switch and template in place; no external analog needed — this is the smallest possible pattern-following change).

**Current switch** (lines 180-193):
```typescript
function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
      return 'Incorrect password. Try again or reset your password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    case 'auth/popup-closed-by-user':
      return ''
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    default:
      return `Sign-in failed. Please try again.`
  }
}
```
**Add new case** (per UI-SPEC section 2 / CONTEXT R292):
```typescript
    case 'auth/operation-not-allowed':
      return "Email/password sign-in isn't enabled for this app yet — ask your administrator to enable it."
```
Insert before `default:`, consistent with the other single-line return statements.

**Template insertion point for the discoverability hint** — near the "Forgot password?" button (lines 89-97):
```html
<div class="text-center">
  <button
    type="button"
    @click="showForgotPassword = true; errorMessage = ''"
    class="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
  >
    Forgot password?
  </button>
</div>
```
Add a short helper `<p>` using the existing `text-gray-400`/`text-xs` treatment seen elsewhere in the form (e.g. line 7's `text-sm text-gray-400`), placed above or below this block, inside the `v-if="!showForgotPassword"` branch (so it's visible on the sign-in form, not the reset form):
```html
<p class="text-xs text-gray-500 text-center">
  Invited by email? Open the link we sent to set your password — or reset it below.
</p>
```
Exact wording/placement is Claude's discretion per CONTEXT.md; must not alter `showForgotPassword`/`handleForgotPassword`/Google button behavior.

---

### `src/views/__tests__/TeamView.test.ts` — extend for callable + copy branches

**Analog:** `src/components/admin/__tests__/OrganizationsTab.test.ts` (lines 1-120) — the only file in the repo demonstrating a name-keyed `httpsCallable` mock with `@vue/test-utils` mount + `flushPromises`.

**Critical gap:** `TeamView.test.ts` currently (lines 1-90+) contains ONLY pure duplicated helper functions (`normalizeEmail`, `isValidEmailFormat`, etc.) re-implemented inline — it does NOT `import TeamView from '../TeamView.vue'`, does NOT mount the component, and does NOT mock `firebase/functions` or `firebase/firestore`. To test the new callable branch and the 3 copy states, a NEW mounted-component test block must be added (or a new describe block), following `OrganizationsTab.test.ts`'s structure:

```typescript
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamView from '../TeamView.vue'

enableAutoUnmount(afterEach)

const { mockSendInviteOnboardingEmail } = vi.hoisted(() => ({
  mockSendInviteOnboardingEmail: vi.fn<() => Promise<{ data: { emailSent: boolean; kind: string } }>>(
    () => Promise.resolve({ data: { emailSent: true, kind: 'set-password' } }),
  ),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_fns: unknown, name: string) => {
    if (name === 'sendInviteOnboardingEmail') return mockSendInviteOnboardingEmail
    throw new Error(`Unexpected callable name: ${name}`)
  }),
}))

vi.mock('@/firebase', () => ({
  functions: {},
  db: {}, // TeamView also uses Firestore (writeBatch/doc) — check existing firestore mock conventions elsewhere in the repo (e.g. RosterView.test.ts) if TeamView.vue's writeBatch/doc calls also need mocking for a full mount test.
}))
```
Also mock `firebase/firestore`'s `writeBatch`/`doc`/`serverTimestamp` (check `src/views/__tests__/RosterView.test.ts` or similar for the established Firestore mock shape used elsewhere, since TeamView.vue's `onInvite` calls these directly).

**Three copy-state assertions** (drive `mockSendInviteOnboardingEmail` per UI-SPEC table):
1. `mockResolvedValueOnce({ data: { emailSent: true, kind: 'set-password' } })` → expect `Invite email sent to {email}.`
2. `mockResolvedValueOnce({ data: { emailSent: false, kind: 'skipped-disabled' } })` → expect `{email} added — onboarding emails are turned off...`
3. `mockRejectedValueOnce(new Error('unreachable'))` → expect `{email} added — we couldn't send the invite email...` AND assert the invite still "succeeds" (no `inviteError` set, `isInviting` false).

---

### `src/views/__tests__/LoginView.test.ts` — does not exist; create new

**No analog exists** for a mounted LoginView test. Closest structural pattern for mount + Pinia + router stubbing: `src/components/admin/__tests__/OrganizationsTab.test.ts` (mount/flushPromises/enableAutoUnmount harness, `vi.mock('@/stores/auth', ...)` at lines 118-120) combined with LoginView's own `useRouter()`-may-be-undefined caveat noted in `OrganizationsTab.vue` lines 206-208 (`router?.` guard pattern) — check whether `LoginView.vue` already guards `router` similarly before assuming a router mock is required.

Minimum coverage per CONTEXT/UI-SPEC:
- `mapFirebaseError('auth/operation-not-allowed')` returns the actionable string (can be tested as a pure function if extracted/exported, or via mounted-component error-path simulation using a mocked `authStore.loginWithEmail` that rejects with `{ code: 'auth/operation-not-allowed' }`).
- The discoverability hint text is present in the rendered template when `showForgotPassword` is false.

## Shared Patterns

### Client `httpsCallable` invocation
**Source:** `src/components/admin/OrganizationsTab.vue` lines 197-200 (imports), 469-485 (call + try/catch)
**Apply to:** `src/views/TeamView.vue`'s `onInvite`
```typescript
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
...
const fn = httpsCallable<ReqType, RespType>(functions, 'functionName')
const result = await fn(payload)
// use result.data
```

### Locally-declared callable Req/Resp types (no cross-import from `functions/`)
**Source:** `src/components/admin/OrganizationsTab.vue` lines 264-273 (and the Phase-82 comment at 250-253 documenting the "ships UNDEPLOYED, tests mock httpsCallable" resilience posture)
**Apply to:** `src/views/TeamView.vue` — declare `SendInviteOnboardingEmailRequest`/`Response` locally, matching `functions/src/inviteOnboarding.ts`'s actual shape by inspection, not by import (confirmed: `functions/` and `src/` are separate build targets, and this is the established codebase convention for every existing callable type in `OrganizationsTab.vue`).

### Best-effort side-call that must not fail the primary write
**Source:** No prior exact analog exists in the codebase (`OrganizationsTab.vue`'s callables ARE the primary action, not a side-effect after a separate write) — this is a NEW pattern for this phase. Model it as: primary write (`batch.commit()`) completes and is followed by a nested try/catch for the callable, with `console.error` + graceful fallback copy on failure, never rethrowing into the outer catch that sets `inviteError`.

### Name-keyed `httpsCallable` test mock
**Source:** `src/components/admin/__tests__/OrganizationsTab.test.ts` lines 21-116
**Apply to:** `src/views/__tests__/TeamView.test.ts`'s new mounted-component test block
```typescript
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_fns: unknown, name: string) => {
    if (name === 'sendInviteOnboardingEmail') return mockSendInviteOnboardingEmail
    throw new Error(`Unexpected callable name: ${name}`)
  }),
}))
vi.mock('@/firebase', () => ({ functions: {} }))
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/views/__tests__/LoginView.test.ts` | test | request-response | File does not exist yet; no prior LoginView test to extend. Nearest structural analog is `OrganizationsTab.test.ts`'s mount/mock harness, adapted for `@/stores/auth` mocking instead of `firebase/functions`. |
| Best-effort-side-call-after-authoritative-write pattern | n/a | event-driven / fire-and-forget | No existing code in the repo performs a Firestore write followed by an independently-failable callable with copy branching on the callable's result; this phase establishes the pattern in `TeamView.vue` itself. |

## Metadata

**Analog search scope:** `src/views/`, `src/components/admin/`, `src/views/__tests__/`, `src/components/admin/__tests__/`
**Files scanned:** `TeamView.vue`, `LoginView.vue`, `OrganizationsTab.vue`, `TeamView.test.ts`, `OrganizationsTab.test.ts`
**Pattern extraction date:** 2026-08-31
