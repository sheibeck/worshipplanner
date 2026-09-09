---
quick_id: 260908-pca
slug: pc-prod-auth-401
status: in-progress
date: 2026-09-08
---

# Quick task: Planning Center integration returns 401 in production

## Description

Two Planning Center production failures reported by the owner, plus one deferred
AI-gate diagnosis:

1. **PRIMARY — PC "Invalid Credentials" 401 in production.** Saving/validating
   Planning Center credentials works locally but always fails with 401 in
   production. Same root cause makes export impossible and leaves the saved
   credentials "empty" (Save & Validate never succeeds, so nothing persists).
2. **Cosmetic — Settings screen wording.** The help link points at the
   deprecated `planningcenteronline.com/api_passwords`; the field is labeled
   "App ID". Planning Center now issues Personal Access Tokens at
   `api.planningcenteronline.com/personal_access_tokens` with a **Client Id**.
3. **DEFERRED — AI 403.** Separate issue; not a mechanical code fix. See below.

## Root cause (#1)

`functions/src/index.ts` puts `planningcenter` in the `AUTH_REQUIRED` set
(R339 / SEC-A-01, Phase 117). The deployed proxy verifies an `X-App-Auth`
Firebase ID token and returns **401 "Authentication required"** before
forwarding to Planning Center when the header is absent. Every PC fetch in
`src/utils/planningCenterApi.ts` and `src/utils/pcSongImport.ts` sends only
`Authorization: Basic <appId:secret>` + `Accept` — never `X-App-Auth`. Dev
works because the Vite proxy (`vite.config.ts`) has no auth guard; production
(Cloud Function proxy) rejects it. The working AI/Bible calls already attach
`X-App-Auth` via `getAppAuthHeaders()` (`src/utils/appAuth.ts`).

## Changes

- **#1** Attach `...(await getAppAuthHeaders())` to every PC proxy fetch in
  `src/utils/planningCenterApi.ts` (~24 sites) and `src/utils/pcSongImport.ts`.
  Update `planningCenterApi.test.ts` + `pcSongImport.test.ts` to mock
  `getAppAuthHeaders`. (Delegated to a subagent; reviewed here.)
- **#2** `src/views/SettingsView.vue`: help link → `.../personal_access_tokens`,
  "App ID" label/placeholder → "Client Id". Comment in `SettingsView.test.ts`
  updated for accuracy.

## Verification

- `npm run type-check` clean.
- `npx vitest run src/utils/__tests__/planningCenterApi.test.ts
  src/utils/__tests__/pcSongImport.test.ts src/views/__tests__/SettingsView.test.ts`
  green.
- Deploy hosting (frontend-only fix; no functions change) — **confirm with owner
  first** — then owner re-enters Client Id + Secret in prod Settings and confirms
  Save & Validate succeeds and export works.

## Deferred: AI 403 (#3)

Server gates on the token-claim org's top-level `aiMasterEnabled`
(`checkOrgAiEnablement`, read via `resolveOrgId` = the `orgId` custom claim on
the ID token), NOT the church currently viewed. Owner confirmed the Super
Admin → Organizations master toggle is ON for the same church, yet still 403s.
Most likely a token-claim/org mismatch (super-admin view-as, multi-church
switch without token refresh, or the master write landing on a different org
doc than the token claim). Needs production inspection of the org doc's
`aiMasterEnabled` field and the user's `orgId` claim — out of scope for this
mechanical fix; tracked for follow-up.

## Non-goals

- No change to `functions/` — the proxy auth guard is correct and stays.
- No relaxing of the `AUTH_REQUIRED` open-relay protection.
