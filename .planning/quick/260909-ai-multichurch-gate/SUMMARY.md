---
quick_id: 260909-ai-multichurch-gate
slug: ai-multichurch-gate
status: complete
date: 2026-09-09
---

# Summary: AI/Bible gate follows the active church (multi-church fix)

## Problem

Multi-church owner got `403 "AI features are disabled for your organization"`
on "suggest scripture" for a non-primary church even though AI was enabled
there. The server gate read the **login token's primary `orgId` claim**
(`orgIds[0]`), which does NOT follow the in-app church switcher — so the client
gated on the viewed church while the server gated on the primary one. (Not
related to the 260908-pca PC fix; the AI gate predates it, v2.2/Phase 82.)

## Fix

- **Server** (`functions/src/index.ts`): new `resolveActiveOrgId(decoded,
  headerOrgId)` honors a client `X-Org-Id` header only when the verified token
  proves the caller may act there — member (`orgs` claim map) or super-admin
  (`superAdmin === true`) — else falls back to the primary `orgId` claim. Both
  proxy branches (anthropic; esv/nlt) use it. Per-uid rate limiter untouched.
- **Client** (`src/utils/appAuth.ts`): `getAppAuthHeaders()` sends
  `X-Org-Id = authStore.orgId`; try/catch omits it if Pinia isn't active
  (server then falls back to the primary claim).

Fail-safe & backward-compatible: a missing/invalid header keeps prior behavior
and can never widen access for a non-member.

## Verification

- Frontend: `npm run type-check` clean; `appAuth.test.ts` 4/4; PC + claude
  suites green.
- Functions: build clean; full suite **721/721** (+7 `resolveActiveOrgId`).

## Deploy

✅ **DEPLOYED to production 2026-09-09** — `firebase deploy --only
functions:api,hosting` (owner blanket deploy). The `api` function updated and
hosting released the rebuilt client. **Owner test:** switch to the church where
AI is enabled and run "suggest scripture" — it should now succeed.
