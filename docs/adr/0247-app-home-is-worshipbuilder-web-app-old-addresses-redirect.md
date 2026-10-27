# 0247. App home is worshipbuilder.web.app; the old addresses redirect there

## Status

Accepted

## Context

v2.16 Phase 145 (R448-R453) moves the app to https://worshipbuilder.web.app. The old addresses (worship-planner-bc515.web.app and worship-planner-bc515.firebaseapp.com) must keep working for emailed volunteer links, share links and bookmarks, and Google sign-in still runs through the old firebaseapp.com auth domain until backlog 999.14.

Owner scope cut, 2026-10-27: the owner is the sole user, so nothing is carried across from the old address. R452 (settings carry) is descoped, there is no legacy `/api` and no open-tab handling. The old addresses are a plain redirect.

## Decision

- **(a) Two targeted hosting sites.** `app` -> `worshipbuilder` and `legacy` -> `worship-planner-bc515`, in a two-block `hosting` array in `firebase.json` with `.firebaserc` targets. Every block is targeted. A bare `firebase deploy --only hosting` publishes both and is never used.
- **(b) Plain Hosting redirect, not a client page.** Nothing is carried across (R452 descoped). The legacy site keeps no `/api/**` rewrite. An open tab needs one page refresh after the update (accepted loss).
- **(c) Two regex rules.** `^/$` comes first, because an empty capture does not compile into the destination (Hosting emulator). The catch-all then never matches a path beginning `/__`. The docs serve reserved `/__/*` ahead of redirects, but the emulator applied a plain catch-all to `/__/firebase/init.json`, and Google sign-in, password reset and magic links use the old firebaseapp.com `/__/auth/*` until backlog 999.14, so the legacy site lives until then. `/__`-prefixed paths on the old site are deliberately not redirected: they are answered by Firebase's reserved handlers or 404, because Firebase Auth uses `/__/*` on the old auth domain until backlog 999.14.
- **(d) Type 302, not 301.** Browsers do not cache a 302, so a rollback reaches everyone at once. 301 is a 999.14 decision when the old site retires.
- **(e) Query and fragment.** Hosting appends the original query (emulator-verified; production is checked by runbook Step 6), and the browser keeps the original fragment (RFC 9110 §10.2.2). Escaped characters inside query values may be re-encoded; the app's own link families (share tokens, volunteer slugs, sign-in codes) carry none.
- **(f) One-file `legacy-site/`.** The legacy public dir is a committed single static page, so no build output is committed and the site has a harmless fallback page.
- **(g) SERVICE_SHARE_BASE_URL.** The code default is the new origin, but `functions/.env` wins at deploy, so the owner fix is a runbook pre-flight with a quiet, CRLF-tolerant status check (a whole-line `-x` match or bare `$` anchor rejects a CRLF line).
- **(h) Allowlists.** Storage CORS gains two origins and Auth authorized domains gain `worshipbuilder.firebaseapp.com`. The old ones are kept until 999.14.
- **(i) Deploy order and no production change here.** Allowlists, `hosting:app`, functions, new-domain smoke test, then `hosting:legacy`, so the smoke exercises the new share base URL and the redirect goes live only after it passes. Phase 145 itself changes no production; the owner runs `docs/runbooks/worshipbuilder-cutover.md`.

## Consequences

Each Run computer re-sets its setup once (church, monitor setup, video key color, window permissions). The old site cannot be retired before backlog 999.14. Reopening a settings carry would need a new requirement. Runbook order and wording are string-guarded by `cutoverRunbook.test.ts`; production behavior is confirmed only at the milestone-end cutover.

## Source comments

- `src/__tests__/firebaseHostingTargets.test.ts`
- `src/__tests__/legacyOriginLiterals.test.ts`
- `src/__tests__/storageCors.test.ts`
- `src/__tests__/cutoverRunbook.test.ts`
- `functions/src/params.test.ts`
