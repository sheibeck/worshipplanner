---
status: complete
date: 2026-08-22
type: bugfix+feature
deploy: none (client-only)
---

# Summary: Login never auto-creates an org; multi-church login picker

Found during v2.0 emulator UAT: signing in auto-provisioned an org for any
org-less user, and the auth-state race ran it twice ("Jouc's Church" +
"Jouc's Church 2"). The "Zome Church 0 members" symptom was a test-data typo
(`jouctajaxx@` invited vs `jouctasjaxx@` signed up) — the invite path works.

## Changes (all client-side — no deploy)

- **`src/stores/auth.ts`** — removed the `ensureUserDocument` auto-create-org
  branch: login now only *joins* an org via a pending invite. Added
  `memberships`, `needsOrgSelection`/`hasNoOrg`/`requiresOrgSelection`, and
  `selectOrg`; the active org resolves from a sessionStorage-remembered choice
  (else the sole org, else none), cleared on logout so switching = log out/in.
  Removed now-dead imports (`collection`, `normalizeOrgName`, `claimOrgName`).
- **`src/views/SelectChurchView.vue`** (new, route `/select-church`) — church
  picker for multi-church users, empty state for no-church users, log out.
- **`src/router/index.ts`** — org-selection gate redirects needs-selection /
  no-org users to the picker on org-scoped routes (owner-console exempt); the
  picker redirects back once an org is active; login redirect honors it too.

## Verification

- `npm run type-check` (vue-tsc --build): clean, exit 0.
- Targeted suites: `auth.test.ts` (75), `SelectChurchView.test.ts` (3),
  `router.test.ts` (9) — all pass.
- Full app suite (`npx vitest run`): 3986 passed; only the documented 2-file
  baseline fails (`storage.rules.test.ts`, `RosterView.test.ts`) — no new
  regressions.

## Follow-ups (not done here)

- Emulator has junk from the old behavior ("Jouc's Church" x2 + typo'd Zome
  invite) — offered a targeted scrub so the invite→join→picker flow can be
  re-tested cleanly.
- Not addressed (out of scope): showing pending invites in the super-admin
  Organizations list so "0 members, 1 invited" is legible.
