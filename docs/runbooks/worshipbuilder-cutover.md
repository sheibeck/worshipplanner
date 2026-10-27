# WorshipBuilder domain cutover — owner runbook (R453)

> ★★ **NOTHING IN THIS REPOSITORY RUNS ANY COMMAND IN THIS FILE.** Every production step is
> owner-run and marked **Owner confirms before running**. Run the commands in Git Bash from the
> repo root on `master`. Pick a quiet window, never during a service, and allow about an hour.

Rationale for every choice here lives in `docs/adr/0247-app-home-is-worshipbuilder-web-app-old-addresses-redirect.md`.

---

## What this does

- The app moves to https://worshipbuilder.web.app.
- The old addresses (https://worship-planner-bc515.web.app and https://worship-planner-bc515.firebaseapp.com) become a plain redirect (HTTP 302) to the same page, keeping the path and query (the browser keeps any `#section` part). Emailed volunteer links, share links and bookmarks keep working.
- Saved per-computer setup does not move (owner decision 2026-10-27). Each Run computer re-sets it once in Step 7, and any tab left open needs a page refresh after the update.
- The Google sign-in `authDomain` stays `worship-planner-bc515.firebaseapp.com` until backlog 999.14. So the old site must never be deleted or disabled, and its `/__/*` sign-in paths are never redirected.
- The old origins stay in Storage CORS and in Auth authorized domains.
- Deploy order and why: allowlists first, then the new site, then functions (emails switch to the new address only once it is live), then the new-domain smoke test (so it exercises the new email links), and the redirect last, only after the smoke passes.

---

## Step 0 — Pre-flight (local, no production change)

Nothing here touches production. Everything must pass before Step 1.

```bash
git status
git log -1
npm run type-check
npx vitest run
(cd functions && npx vitest run && npm run build)
npm run build
firebase target
```

- `git status` shows a clean tree on `master`. The full `npx vitest run` baseline is that only `src/storage.rules.test.ts` fails (a known Storage-emulator limit).
- `npm run build` needs `.env.local` in the repo root.
- `firebase target` shows `app` -> `worshipbuilder` and `legacy` -> `worship-planner-bc515`.

Check the Auth domain setting (prints status only, never the value):

```bash
grep -qE '^VITE_FIREBASE_AUTH_DOMAIN=worship-planner-bc515\.firebaseapp\.com[[:space:]]*$' .env.local && echo "authDomain: OK (unchanged)" || echo "authDomain: unexpected value - stop"
```

**Owner confirms before running.** Fix the share base URL. In a text editor, set the line in `functions/.env` to `SERVICE_SHARE_BASE_URL=https://worshipbuilder.web.app`. This file is local and never committed. The `functions/.env.local` localhost value is for the emulator and stays. A value in `functions/.env` wins over the code default at deploy time, so this fix is required.

Then check it (status only):

```bash
grep -qE '^SERVICE_SHARE_BASE_URL=https://worshipbuilder\.web\.app[[:space:]]*$' functions/.env && echo "share base URL: OK (new origin)" || echo "share base URL: NOT the new origin - fix before Step 4"
```

PowerShell equivalent:

```powershell
if (Select-String -Path functions/.env -Pattern '^SERVICE_SHARE_BASE_URL=https://worshipbuilder\.web\.app\s*$' -Quiet) { 'share base URL: OK (new origin)' } else { 'share base URL: NOT the new origin - fix before Step 4' }
```

These checks end in `[[:space:]]*$`, so they read a Windows (CRLF) file correctly, and they print only OK or NOT OK, never the line or any other value.

---

## Step 1 — Apply Storage CORS (production)

**Owner confirms before running.** Precondition: every Step 0 check passed.

`update` replaces the bucket's whole CORS config with the contents of `storage-cors.json`. View it, apply it, view it again; expect five origins afterwards (the two new ones plus the old ones and localhost).

```bash
gcloud storage buckets describe gs://worship-planner-bc515.firebasestorage.app --format="default(cors_config)"
gcloud storage buckets update gs://worship-planner-bc515.firebasestorage.app --cors-file=storage-cors.json
gcloud storage buckets describe gs://worship-planner-bc515.firebasestorage.app --format="default(cors_config)"
```

---

## Step 2 — Add the authorized domain (production)

**Owner confirms before running.** Precondition: the Step 1 describe shows five origins.

Firebase console -> Authentication -> Settings -> Authorized domains:

- Confirm `worshipbuilder.web.app` is listed.
- Add `worshipbuilder.firebaseapp.com`.
- Keep `worship-planner-bc515.web.app`, `worship-planner-bc515.firebaseapp.com` and `localhost`.

---

## Step 3 — Deploy the app to the new site (production)

**Owner confirms before running.** Precondition: the Step 2 domain list is saved.

Never run `firebase deploy` or `firebase deploy --only hosting` before Step 6: both also publish the old-address redirect before the smoke test (a plain `firebase deploy` also ships rules and functions). Use only the targeted commands in this runbook.

```bash
firebase deploy --only hosting:app
```

Verify (expect `200 text/html` for the first two, a no-cache header, and `401` for the last):

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://worshipbuilder.web.app/
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://worshipbuilder.web.app/services/smoke-check
curl -sI https://worshipbuilder.web.app/ | grep -i '^cache-control'
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://worshipbuilder.web.app/api/esv/v3/passage/text/
```

The last line must be the api function answering (401), not `200 text/html` (that would be the SPA fallback swallowing `/api`).

---

## Step 4 — Deploy functions (production)

**Owner confirms before running.** Precondition: the Step 0 share base URL check printed OK and the Step 3 curls passed.

```bash
firebase deploy --only functions
```

This rebuilds `functions/lib` first and also ships the Phase 144 email copy.

New-origin link check: send yourself an invite or a test message and confirm its links start with https://worshipbuilder.web.app. If they still name the old address, the `functions/.env` line is wrong: fix it, re-run the Step 0 check and redeploy functions before Step 5.

---

## Step 5 — Smoke-test the new domain (before the redirect)

Precondition: the Step 4 link check passed. In a browser on https://worshipbuilder.web.app:

- Google sign-in through the popup (it still names `worship-planner-bc515.firebaseapp.com`).
- Password sign-in.
- Request a volunteer magic link now (after Step 4 it links to the new address) and open it.
- Upload a song file and download it (the Save dialog proves Storage CORS).
- Open a share link from a message sent after Step 4.

If Google sign-in fails with an origin error, stop: do not run Step 6. The fix to try is Google Cloud console -> APIs & Services -> Credentials -> the Web client -> Authorized JavaScript origins, add `https://worshipbuilder.web.app`. **Owner confirms before running.** This is an assumption from research (A2), not a verified requirement.

---

## Step 6 — Turn on the old-address redirect (production)

**Owner confirms before running.** Precondition: every Step 5 check passed. Never during a service.

The old site is configuration plus one static page, so there is no build step.

```bash
firebase deploy --only hosting:legacy
```

Verify the reserved sign-in paths are still served on the old auth domain (expect `200 text/html` and `200 application/json`):

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://worship-planner-bc515.firebaseapp.com/__/auth/handler
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://worship-planner-bc515.firebaseapp.com/__/firebase/init.json
```

Verify the redirects (each prints `302` and the target):

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://worship-planner-bc515.web.app/
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://worship-planner-bc515.web.app/share/smoke-check?x=1&y=2"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://worship-planner-bc515.firebaseapp.com/services/smoke-check/
```

Expected, in order: `302 https://worshipbuilder.web.app/`, `302 https://worshipbuilder.web.app/share/smoke-check?x=1&y=2` and `302 https://worshipbuilder.web.app/services/smoke-check/`.

Check an escaped character inside a query value:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://worship-planner-bc515.web.app/share/smoke-check?y=a%2Fb"
```

Expect `...?y=a%2Fb`. If it prints `a%252Fb`, write that down: production re-encodes escaped characters inside query values. The app's own links (share tokens, volunteer slugs, sign-in codes) never contain them, so this is not a rollback trigger.

Browser check: https://worship-planner-bc515.web.app/share/smoke-check?x=1#top must land on https://worshipbuilder.web.app/share/smoke-check?x=1#top.

If either `/__/` check is not 200, or a redirect drops the path or the query, go to the Rollback section now (Google sign-in depends on `/__/auth/*`).

---

## Step 7 — Each person and each Run computer

**Owner confirms before running** (each person acts on their own computer):

- Everyone must sign in once on https://worshipbuilder.web.app, because sign-ins are per address. A magic link requested before the cutover still works but asks for the email again.
- Saved setup does not carry over from the old address (owner decision 2026-10-27). On each Run computer: open the new address, sign in, select the church again, re-create the Run monitor setup (assignments and nicknames) and the video key color, then check Run's monitor setup shows them.
- Re-grant Window management (multi-screen) when Chrome asks, or via the site-settings icon -> Window management -> Allow.
- Re-grant Automatic Fullscreen for https://worshipbuilder.web.app in the same place it was granted for the old address (the per-computer setting or the `AutomaticFullscreenAllowedForUrls` policy). It is best-effort; the per-display "Go fullscreen" buttons are the reliable fallback.
- Update bookmarks and home-screen shortcuts (the old ones keep redirecting).

---

## Step 8 — Optional console renames

**Owner confirms before running.** Cosmetic and independent of the steps above:

- Firebase console -> Project settings -> General -> Public-facing name -> WorshipBuilder.
- Google Cloud console -> APIs & Services -> OAuth consent screen -> App name -> WorshipBuilder.

---

## Rollback

**Owner confirms before running** any rollback.

- Before Step 6: the old address still serves the app, so fix forward. If emails must revert, restore the old `SERVICE_SHARE_BASE_URL` line in `functions/.env` and redeploy functions.
- After Step 6: put the app back on the old address. Either use the console (Hosting -> worship-planner-bc515 -> Release history -> the last release before the redirect -> menu -> Roll back), or run:

```bash
firebase hosting:clone worshipbuilder:live worship-planner-bc515:live
```

Because the redirect is a 302, browsers do not remember it, so the rollback reaches every browser at once.

Never delete or disable the old site, and never remove the old origins from CORS or authorized domains, until backlog 999.14.

---

## Post-cutover smoke checklist

- [ ] https://worshipbuilder.web.app/ answers 200 text/html and a deep path (`/services/smoke-check`) also does (Step 3).
- [ ] `/api/esv/v3/passage/text/` on the new site answers 401, not the SPA page (Step 3).
- [ ] A fresh invite or test message has links starting with https://worshipbuilder.web.app (Step 4).
- [ ] Google sign-in, password sign-in and a fresh volunteer magic link work on the new address (Step 5).
- [ ] A song file uploads and downloads with the Save dialog (Step 5).
- [ ] `/__/auth/handler` is 200 text/html and `/__/firebase/init.json` is 200 application/json on `worship-planner-bc515.firebaseapp.com` (Step 6).
- [ ] The old addresses answer 302 to the same path and query on the new address; the `?y=a%2Fb` result is written down (Step 6).
- [ ] An old bookmark and an old share link with a `#section` land on the same page on the new address (Step 6).
- [ ] One Run computer end to end: signed in, church selected, monitor setup and video key color re-created, Window management and Automatic Fullscreen re-granted, fullscreen works (Step 7).
