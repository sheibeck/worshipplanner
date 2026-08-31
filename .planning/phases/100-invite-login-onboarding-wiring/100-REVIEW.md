---
phase: 100-invite-login-onboarding-wiring
reviewed: 2026-08-31T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/views/TeamView.vue
  - src/views/LoginView.vue
  - src/views/__tests__/TeamView.test.ts
  - src/views/__tests__/LoginView.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: resolved
fix_dispositions:
  - id: WR-01
    disposition: FIXED
    commit: 53e2140c
    note: "invitedFeedback auto-clear timer is now id-tracked; a pending timer is cleared before a new invite starts one, so a rapid second invite's message can't be wiped by the first's stale timer."
  - id: WR-02
    disposition: FIXED
    commit: 53e2140c
    note: "Added a dedicated 'skipped-existing' copy branch ('they already have an account…') + test, so the UI no longer falls into the 'couldn't send' failure copy for that kind."
  - id: IN-01
    disposition: ACCEPTED
    note: "popup-closed-by-user fallthrough in LoginView leaking a raw Firebase string — pre-existing, outside this phase's diff (confirmed via git show). Not introduced here; candidate for a future polish pass."
  - id: IN-02
    disposition: ACCEPTED
    note: "TeamView onMounted not re-attaching Firestore listeners if orgId resolves after mount — pre-existing, outside this phase's diff."
  - id: IN-03
    disposition: ACCEPTED
    note: "Test-file pure-function duplication that could drift from the real component guards — pre-existing testing pattern; the new mounted TeamView block + LoginView.test.ts already test the real component behavior for this phase's changes."
---

# Phase 100: Code Review Report

**Status:** resolved (WR-01 + WR-02 fixed in 53e2140c; 3 pre-existing Info items accepted — see fix_dispositions)
**Reviewed:** 2026-08-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase wires the client to an already-shipped Phase 99 callable
(`sendInviteOnboardingEmail`) and adds actionable login copy. The core R294
resilience contract holds up under inspection: the callable is invoked
strictly after `await batch.commit()`, inside its own nested `try/catch`
that only `console.error`s (never rethrows, never sets `inviteError`, never
reverts the batch), `isInviting` is cleared in the outer `finally`, and every
`await` on the callable is inside a `try` so there is no unhandled promise
rejection path. The locally-declared `SendInviteOnboardingEmailRequest` /
`SendInviteOnboardingEmailResponse` types are byte-for-byte identical to
`functions/src/inviteOnboarding.ts`'s exported interfaces (confirmed by
direct comparison), and the callable is invoked with `{ orgId, email:
normalized }` — the same normalized (`trim().toLowerCase()`) value used as
the invite doc's key, matching what the callable's own `CR-01` gate
(`orgRef.collection('invites').doc(normalizedEmail)`) requires to find a
pending invite. The three honest-copy branches in `onInvite` correctly map
`{ emailSent, kind }` (and the call-error/null case) to distinct,
non-overclaiming strings, and this is exercised by real mounted-component
tests, not just unit-level pure-function tests. `LoginView`'s new
`auth/operation-not-allowed` mapping is actionable and correctly scoped —
the discoverability hint sits inside the `v-if="!showForgotPassword"` block
and does not leak into the reset-password sub-view, confirmed by both
reading the template and a dedicated test.

Two non-blocking issues remain: a stale-timer race in `TeamView`'s
success-message auto-clear, and a response-type union member
(`skipped-existing`) with no corresponding, semantically-accurate copy
branch. Neither risks data loss or breaks the best-effort contract. A few
`Info`-level pre-existing quirks (not part of this phase's diff) are noted
for completeness but do not block this phase.

## Warnings

### WR-01: `invitedFeedback` auto-clear timer can wipe a newer invite's message

**File:** `src/views/TeamView.vue:331-334`
**Issue:** After a successful invite, a bare `setTimeout(() => { invitedFeedback.value = null }, 2000)` is scheduled with no id tracking. If a second invite is submitted within that 2-second window (isInviting is already `false` again by the time the timer would fire, so the button is clickable), the second invite sets a new `invitedFeedback` value, but the *first* invite's un-cancelled timer still fires ~2s after the first invite and unconditionally nulls out `invitedFeedback` — clearing the second invite's just-shown success message regardless of how recently it was set. This is a real, reachable race for an admin adding several people back-to-back (a plausible workflow for this exact feature), not just a double-click edge case.
**Fix:** Track the timeout handle and clear the previous one before scheduling a new one (and clear it on `onUnmounted` too, for hygiene):
```ts
let feedbackClearTimer: ReturnType<typeof setTimeout> | null = null

// ...inside onInvite, replace the bare setTimeout with:
if (feedbackClearTimer) clearTimeout(feedbackClearTimer)
feedbackClearTimer = setTimeout(() => {
  invitedFeedback.value = null
  feedbackClearTimer = null
}, 2000)

// ...and in onUnmounted:
if (feedbackClearTimer) clearTimeout(feedbackClearTimer)
```

### WR-02: `skipped-existing` union member has no dedicated, honest copy branch

**File:** `src/views/TeamView.vue:189-192, 320-326`
**Issue:** `SendInviteOnboardingEmailResponse.kind` is declared as a 4-member union (`'google-notify' | 'set-password' | 'skipped-disabled' | 'skipped-existing'`), correctly mirroring the callable's type. The copy-mapping `if/else if/else` only special-cases `emailSent: true` and `kind === 'skipped-disabled'`; every other combination — including a hypothetical `{ emailSent: false, kind: 'skipped-existing' }` — falls into the generic "we couldn't send the invite email" branch. `skipped-existing` semantically means "we deliberately did not send because ___" (e.g., an existing account), which is a different, non-failure story than "we tried and it failed." Today this is inert because `functions/src/inviteOnboarding.ts`'s handler never actually returns `kind: 'skipped-existing'` (verified — every path returns `google-notify`, `set-password`, or `skipped-disabled`), so no user will see the misleading copy yet. But the type contract promises this value is possible, and the client-side copy silently mislabels it as a failure if the backend is ever extended to return it (e.g., a future "user already has an account, skip the whole flow" branch), regressing the "honest copy never overclaims/underclaims" contract this phase is explicitly about.
**Fix:** Either narrow the local response type to the 3 kinds the handler can currently produce (and re-widen when the backend adds the 4th), or add an explicit branch for `kind === 'skipped-existing'` with accurate wording, e.g.:
```ts
} else if (emailResult?.kind === 'skipped-existing') {
  invitedFeedback.value = `${normalized} added — they already have an account, so let them know to sign in with this address.`
} else if (emailResult?.kind === 'skipped-disabled') {
  ...
```

## Info

### IN-01: Pre-existing `auth/popup-closed-by-user` fallthrough can surface a raw Firebase message

**File:** `src/views/LoginView.vue:191, 213`
**Issue:** Not part of this phase's diff (confirmed via `git show ae360577` — only the `operation-not-allowed` case and the hint paragraph were added), but worth flagging since it sits directly next to code this phase touched. `mapFirebaseError('auth/popup-closed-by-user')` returns `''` (intending "show nothing" when the user intentionally closes the Google popup). In `handleGoogleSignIn`'s catch, `errorMessage.value = msg || firebaseErr?.message || 'An unexpected error occurred.'` treats `''` as falsy and falls through to `firebaseErr?.message`, which for this Firebase Auth error is typically a raw string like `"Firebase: Popup closed by user (auth/popup-closed-by-user)."` — surfacing an internal error string to the user in exactly the case the code appears to intend to stay silent. This predates Phase 100 and is out of scope to fix here, but flagging so it isn't mistaken for phase-100-introduced behavior.
**Fix (for a future phase):** `errorMessage.value = msg !== '' ? (msg || firebaseErr?.message || 'An unexpected error occurred.') : ''`, or an explicit early return for the empty-string case.

### IN-02: `TeamView.onMounted` never re-attaches listeners if `orgId` resolves after mount

**File:** `src/views/TeamView.vue:418-443`
**Issue:** Pre-existing (unchanged by this phase's diff — confirmed via `git show 30588a75`). `onMounted` reads `authStore.orgId` once and returns early (`if (!orgId) return`) without setting up either `onSnapshot` listener if it's falsy at that instant. There is no `watch`/`watchEffect` on `authStore.orgId` to retry attaching listeners once auth/org resolution completes asynchronously. If `TeamView` is ever mounted before `orgId` is populated (e.g., a fast client-side navigation racing org bootstrap), the template's `v-if="!authStore.orgId"` loading gate would flip away once `orgId` arrives, but `members`/`pendingInvites` would remain permanently empty since the snapshot subscriptions were never created. Flagging for awareness; not introduced by and not required to be fixed by this phase.

### IN-03: Test-file pure-function duplicates can silently drift from the component

**File:** `src/views/__tests__/TeamView.test.ts:70-124`
**Issue:** Pre-existing pattern, not new to this phase. `normalizeEmail`, `isValidEmailFormat`, `isDuplicateMember`, `isDuplicateInvite`, `canRemoveMember`, `canDemoteEditor` are hand-copied re-implementations of logic that lives inline in `TeamView.vue`'s `<script setup>` (which does not export these helpers for direct import). Because `<script setup>` doesn't expose named exports, this duplication is somewhat structurally forced today, but it means these "unit" tests validate a parallel implementation, not the actual guard logic exercised by `onInvite`/`onToggleRole`/`onConfirmRemove`. A future edit to the real guards (e.g., changing the last-editor rule) could pass this test suite while breaking production behavior. The mounted-component tests added in this phase (`onInvite → sendInviteOnboardingEmail (mounted)`) are the more trustworthy coverage and don't have this problem.

---

_Reviewed: 2026-08-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
