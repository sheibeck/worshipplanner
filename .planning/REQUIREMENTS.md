# Requirements: WorshipPlanner — v2.5 Invite Email & Non-Google Onboarding

**Defined:** 2026-08-30
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating through the full song stable and respecting team configurations.
**Milestone goal:** Every invited user gets an invite email, non-Google users can set a password and sign in, and an owner can switch onboarding emails on/off.

> REQ-ID numbering continues the project's global `R###` sequence from v2.4 (last: R287). This milestone: **R288–R294**.
>
> **Origin:** vetting the non-Gmail login path surfaced that the in-app TeamView invite only wrote Firestore docs — it never sent an email or provisioned an Auth account, so non-Google invitees had no discoverable way to get a password and "reset password" could not help (Firebase cannot reset a password for a not-yet-existing account). Full root cause & the chosen mechanism: `.planning/debug/resolved/non-gmail-password-setup.md`.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Invite Email Delivery

- [x] **R288**: When a team member is invited through the in-app invite UI (TeamView), the system sends that person a **real invite email** — no invitee is left with no notification. (Subject to the owner toggle, R293.)
- [x] **R289**: A **Google / Gmail** invitee receives a **"you've been invited — sign in with Google using this address"** notification email (no password step and no pre-created email/password account, avoiding Google↔password account-linking conflicts).
- [x] **R290**: A **non-Google** invitee receives an email containing a secure **"set your password" link** that lets them establish a password and then sign in with email/password.

### Non-Google Account Onboarding

- [x] **R291**: Inviting a non-Google user **provisions their sign-in account server-side** (Cloud Function creating the Firebase Auth account + a `generatePasswordResetLink()` set-password link), so a brand-new invitee (e.g. `bob@someemail.com`) can set a password and sign in **without being told an undocumented "type a password into Sign in" trick**.
- [x] **R292**: On the login screen, an invited user has a **discoverable path to set / reset their password** (not buried), and email/password sign-in surfaces a **clear, actionable message** when the provider is unavailable (`auth/operation-not-allowed`) instead of the generic "Sign-in failed."

### Owner Console Control

- [x] **R293**: An owner can **turn onboarding / invite emails on or off** from the Owner Console (`ConfigurationTab`, backed by `appConfig`); when off, invites still record membership but send **no email**, and the invite function honors the setting.

### Non-Regression & Delivery Safety

- [x] **R294**: Existing **Google sign-in** and the existing **invite-acceptance flow** (`ensureUserDocument` granting membership on first authenticated sign-in) continue to work unchanged, and a failure to send the invite email **never prevents the invite/membership record from being written** (email is best-effort, membership is authoritative).

## Future Requirements (deferred)

- Per-org (rather than global) onboarding-email toggle, if churches later need independent control — global via `appConfig` is sufficient for now.
- Resend-verified custom sending domain for invite mail (tracked as backlog 999.6 / the `functions/DEPLOY-EMAIL-DOMAIN.md` runbook) — an owner-run DNS prerequisite, not code.

## Out of Scope

- **Enabling the Firebase Auth Email/Password provider** — an owner-run Firebase Console action (Authentication → Sign-in method), a prerequisite for email/password onboarding, not application code. Flagged for owner verification.
- **Completing Resend DNS domain verification** — owner-run ops (`functions/DEPLOY-EMAIL-DOMAIN.md`); until done, the default `onboarding@resend.dev` sender only delivers to the Resend account owner's inbox. Real delivery to arbitrary invitees depends on it, but the code path is independent.
- Redesigning the broader invitation / RBAC model — this milestone fixes onboarding delivery, not roles.
- Passwordless / magic-link sign-in — explicitly rejected in favor of the set-password-link mechanism.

## Traceability

*(Filled by the roadmap — each requirement maps to exactly one phase.)*

| Requirement | Phase |
|-------------|-------|
| R288 | Phase 100 |
| R289 | Phase 99 |
| R290 | Phase 99 |
| R291 | Phase 99 |
| R292 | Phase 100 |
| R293 | Phase 99 |
| R294 | Phase 100 |
