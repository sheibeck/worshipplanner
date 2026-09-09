---
quick_id: 260908-pca
slug: pc-prod-auth-401
status: complete
date: 2026-09-08
---

# Summary: Planning Center 401 in production

## What was wrong

Planning Center credential save/validate (and every PC call — export, import,
people/team fetches) returned **401 in production** while working in dev. The
"credentials are now empty" symptom followed from it: **Save & Validate** runs
`validatePcCredentials`, which got the 401 and reported "Invalid credentials",
so nothing ever persisted.

**Root cause:** `functions/src/index.ts` lists `planningcenter` in `AUTH_REQUIRED`
(R339 / SEC-A-01, Phase 117). The deployed Cloud Function proxy verifies an
`X-App-Auth` Firebase ID token and returns **401 "Authentication required"**
before forwarding to Planning Center when it's missing. Every PC fetch in
`planningCenterApi.ts` / `pcSongImport.ts` sent only `Authorization: Basic
<clientId:secret>` + `Accept` — never `X-App-Auth`. Dev worked because the Vite
proxy (`vite.config.ts`) has no auth guard. The AI/Bible calls were unaffected
because they already attach `X-App-Auth` via `getAppAuthHeaders()`.

## Changes

- **Fix #1 (the 401).** Added `...(await getAppAuthHeaders())` to **25** PC proxy
  fetch sites — 24 in `src/utils/planningCenterApi.ts` (every GET/POST/PATCH/DELETE
  across validate/service-types/plans/items/positions/people/songs/emails) and 1
  in `src/utils/pcSongImport.ts` (`fetchAllPcSongs`; its other calls delegate to
  the now-fixed helpers). Basic `Authorization` untouched. Tests mock
  `getAppAuthHeaders` (`vi.mock('@/utils/appAuth', ...)`), matching the
  claudeApi/nltApi test idiom; no existing assertion needed weakening.
- **Fix #2 (cosmetic).** `src/views/SettingsView.vue`: PC token help link →
  `https://api.planningcenteronline.com/personal_access_tokens`; "App ID"
  label + placeholder → "Client Id". Test comment updated for accuracy.

## Verification

- `npm run type-check` — clean.
- `npx vitest run` (planningCenterApi + pcSongImport + SettingsView) — **213/213
  pass**.

## Deploy

**Client-only (hosting); no `functions/` change.** ✅ **DEPLOYED to production
2026-09-08** via `firebase deploy --only hosting,firestore:rules` (owner granted
a blanket deploy). The hosting release also shipped every other frontend change
queued on master (260908-dgq/-owm/-nq5/-cou, 260903-dismissible-monitor-warnings,
20260905-slideout-close-button-only, 260901-lua, 260830-l9c), and 260908-nq5's
`firestore.rules` relaxation went live with the rules half. **Owner next step:**
re-enter **Client Id** + **Secret** (from
`api.planningcenteronline.com/personal_access_tokens`) in prod Settings and
confirm Save & Validate + export succeed.

## Deferred — AI 403 (separate issue)

`checkOrgAiEnablement` gates on the **token-claim** org's top-level
`aiMasterEnabled` (`resolveOrgId` reads the `orgId` custom claim), not the church
currently viewed. Owner confirmed the Super Admin → Organizations master toggle is
ON for the same church yet still 403s — most likely a token/claim vs. enabled-org
mismatch. Needs production inspection of the org doc + the user's `orgId` claim;
not fixed here.
