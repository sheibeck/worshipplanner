---
quick_id: 260909-ai-multichurch-gate
slug: ai-multichurch-gate
status: in-progress
date: 2026-09-09
---

# Quick task: AI/Bible gate follows the active church (multi-church fix)

## Problem

A multi-church owner enabled AI on a non-primary church and still got
`403 "AI features are disabled for your organization"` when using
"suggest scripture". Root cause (confirmed with the owner): the server-side
gate `checkOrgAiEnablement` reads the org from the **login token's primary
`orgId` claim** (`resolveOrgId` = `orgIds[0]`, baked in at sign-in). The
in-app church switcher changes `authStore.orgId` **without a new login**, so
the claim never follows the switch. The client gates on the *viewed* church
(shows the button) while the server checks the *primary* church (403). Same
latent gap affected the Bible-API gate (`checkOrgBibleEnablement`).

Not caused by the 260908-pca PC fix — the AI gate is untouched by it and has
behaved this way since v2.2/Phase 82.

## Fix (owner chose the proper code fix over a config workaround)

Make the AI/Bible enablement gate evaluate the church the user is **actively
viewing**, validated against the **verified token** so it stays secure.

- **Server** (`functions/src/index.ts`): new exported `resolveActiveOrgId(decoded,
  headerOrgId)` — honors a client `X-Org-Id` header ONLY when the token proves
  the caller may act there: a member (the verified `orgs` claim map has the key)
  or a super-admin (`superAdmin === true`, enters any org without a membership
  doc). Otherwise falls back to the primary `orgId` claim. Both proxy branches
  (anthropic; esv/nlt) now resolve via it. The per-**uid** rate limiter is
  untouched, so quota attribution doesn't change.
- **Client** (`src/utils/appAuth.ts`): `getAppAuthHeaders()` now also sends
  `X-Org-Id: authStore.orgId` (the active church). Wrapped in try/catch — if
  Pinia isn't active the header is omitted and the server falls back to the
  primary claim (prior behavior).

## Security posture

Backward-compatible and fail-safe: a missing/invalid header → primary claim
(current behavior). The header can NEVER widen access for a non-member /
non-super-admin — it is validated against claims that are part of the signed
ID token, not trusted on its own.

## Verification

- Frontend: `npm run type-check` clean; `appAuth.test.ts` 4/4; PC + claude
  suites still green (they mock `getAppAuthHeaders`).
- Functions: `npm --prefix functions run build` clean; full suite **721/721**
  (new `resolveActiveOrgId` block: member→header, super-admin→header,
  non-member→primary, no/empty header→primary, no primary→null,
  non-strict-true superAdmin→primary).

## Deploy

Needs **functions** (the `api` proxy) AND **hosting** (the client header).
Owner granted blanket prod deploy (2026-09-08). `firebase deploy --only
functions:api,hosting`.

## Non-goals

- No change to rate-limit / usage-ledger attribution (stays per-uid).
- No change to the primary-org claim mechanics or the login flow.
