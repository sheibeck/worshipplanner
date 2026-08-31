---
phase: 100
slug: invite-login-onboarding-wiring
kind: UI-SPEC
scope: microcopy + one error state (no new layouts/components)
created: 2026-08-31
---

# Phase 100 — UI Design Contract

> This phase adds **no new screens or components** — it wires an existing Cloud Function into the existing
> TeamView invite form and adds microcopy + one error message to the existing LoginView. The "design" here
> is the exact copy contract and the states each string covers. Kept intentionally small (see
> `100-CONTEXT.md` for rationale).

## Surfaces

### 1. TeamView — invite success feedback (`src/views/TeamView.vue`)
Replaces the interim stopgap line. Copy is driven by the `{ emailSent, kind }` the callable returns (and by
a call error). All three are the green success/neutral feedback line already in the template
(`invitedFeedback`), and the invite is ALWAYS recorded regardless (R294).

| State | Condition | Copy |
|-------|-----------|------|
| Email sent | `emailSent === true` (`set-password` or `google-notify`) | `Invite email sent to {email}.` |
| Emails off | `kind === 'skipped-disabled'` | `{email} added — onboarding emails are turned off, so let them know to sign in with this address.` |
| Send failed | callable threw (best-effort) | `{email} added — we couldn't send the invite email, so let them know to sign in with this address.` |

- Button micro-state: keep the existing `Inviting…` / `Added!` / `Invite` progression.
- Error line (`inviteError`) stays reserved for genuine invite-write failures only (unchanged).

## UI Considerations

- covered: The invite always succeeds and shows feedback even when the email callable is disabled, fails,
  or is unreachable (the membership write is authoritative and precedes the best-effort call). — R294
- covered: A first-time invited (non-Google) user has a discoverable way to set a password from the login
  screen — the existing "Forgot password?" reset flow, made discoverable to invitees via a one-line hint. — R292
- covered: When Firebase Email/Password sign-in is disabled, the login error is specific and actionable
  (`auth/operation-not-allowed` → "…ask your administrator to enable it"), not the generic "Sign-in failed." — R292

### 2. LoginView — discoverability + error (`src/views/LoginView.vue`)
- **Helper line** (near the email/password sign-in form or the "Forgot password?" affordance):
  `Invited by email? Open the link we sent to set your password — or reset it below.` (exact wording is
  flexible; must convey: invitees use the emailed link OR the reset flow).
- **`mapFirebaseError` new case** — `auth/operation-not-allowed` →
  `Email/password sign-in isn't enabled for this app yet — ask your administrator to enable it.`
- No change to the reset flow, Google button, or `loginWithEmail` behavior.

## Visual/Style
- Reuse existing Tailwind classes and the established dark theme; no new colors, spacing, or components.
- Feedback text uses the existing `text-green-400` success treatment; error uses the existing red treatment.

## Out of scope
- New "accept invite / set password" landing route; any layout redesign; per-org toggle UI.
