# Quick Task: Login never auto-creates an org; multi-church login picker

**Date:** 2026-08-22
**Type:** Bug fix + small feature (client-only; no deploy)

## Problem (found in v2.0 emulator UAT)

Signing in auto-provisioned an organization for any org-less user
(`src/stores/auth.ts` `ensureUserDocument`, the `if (!hasOrg)` branch). During
testing this ran twice on a fresh sign-in (auth-state race), producing "Jouc's
Church" **and** "Jouc's Church 2". Root cause of the "Zome Church has 0 members"
symptom was a **test-data typo** (`jouctajaxx@` invited vs `jouctasjaxx@` signed
up) — the invite path itself works; the missing-match fell through to auto-create.

## Owner directives

1. Signing in must NEVER create an organization — only a super-admin creates orgs
   (via `onboardOrganization`).
2. An assigned/invited user, on login, joins the church they were assigned to.
3. An org-less, un-invited user sees an empty "no church yet" state.
4. A user in multiple churches gets a login-time picker; switching churches =
   log out and back in.

## Plan

- **auth.ts**: remove the auto-create-org branch; keep invite consumption; add
  `memberships` + `needsOrgSelection`/`hasNoOrg`/`requiresOrgSelection` +
  `selectOrg`; resolve the active org from a session-remembered choice (else the
  sole org, else none); clear the choice on logout.
- **SelectChurchView.vue** (new, `/select-church`): church list picker + empty
  state + log out.
- **router**: org-selection gate — org-scoped routes redirect a needs-selection /
  no-org user to `/select-church` (owner-console exempt; picker redirects back
  once an org is active).
- **Tests**: auth store (no auto-create, invite still consumed, multi-org select,
  no-org) + SelectChurchView + carried-forward suites.
