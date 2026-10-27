# Phase 145: Domain Cutover to worshipbuilder.web.app - Context

**Gathered:** 2026-10-27
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — owner instruction 2026-10-27 "take all your recommendations": every
grey-area answer below is the recommended option, auto-accepted. Owner's earlier explicit choice
(2026-10-27 scoping): old domain = **redirect + carry settings**.

<domain>
## Phase Boundary

Make `https://worshipbuilder.web.app` the app's single home: the `worshipbuilder` Hosting site serves the
app; every generated link points there; origin allowlists include it; and the old
`worship-planner-bc515.web.app` / `.firebaseapp.com` addresses become a **bridge** that sends each request to
the same path/query/hash on the new domain and carries that browser's saved per-browser setup across.
Includes the owner's cutover runbook. Requirements R448–R453.

**Build vs. apply:** everything (config, code, tests, runbook) is built and verified in this phase.
**No production change is applied here** — Storage CORS re-apply, Auth authorized-domain change, the new-site
deploy and the old-site bridge deploy are owner-gated, per-deploy confirmed, at milestone end (they also
ship the Phase 144 rename and the Phase 143 Times tab).

</domain>

<decisions>
## Implementation Decisions

### Old-domain bridge (R451, R452)
- The old default site (`worship-planner-bc515`, which answers both `.web.app` and `.firebaseapp.com`)
  serves a **tiny dedicated bridge page**, not the app bundle. The bridge logic lives in a tested TS module
  (e.g. `src/originHandoff/` — encode on the old origin, decode/validate on the new) and is built by a small
  separate Vite build (e.g. `vite.legacy.config.ts` → `dist-legacy/`, npm script `build:legacy`) into a
  minimal HTML page with the script inlined or tiny.
- Bridge behavior: read the browser's **allowlisted** `wp`-prefixed localStorage keys, serialize them into
  the URL **fragment** (never sent to any server), and `location.replace()` to
  `https://worshipbuilder.web.app` + the original path + query, preserving the original hash (encode it in
  the fragment and restore it on arrival). A `<noscript>` fallback links to the new domain root.
- **Once per browser:** after a successful hand-off the bridge marks the old origin (a `wp:` flag) and later
  visits redirect immediately with no payload.
- The old site keeps the `/api/**` → `api` function rewrite so still-open old tabs don't break mid-session;
  every other path goes to the bridge.

### Receiving side (R452)
- On app boot — before Pinia stores read localStorage — the app checks the fragment for the hand-off payload,
  validates it, imports **only allowlisted keys with a per-key shape validator**, and **only fills keys that
  are absent** on the new origin (never overwrites). It then removes the payload from the URL with
  `history.replaceState` and restores the original hash if there was one. Malformed/oversized/unknown entries
  are dropped silently (a crafted link cannot plant a non-allowlisted or malformed key).
- **Moved keys:** Run monitor config (`wp:runMonitorConfig:v2`), video key color (`wp:videoKeyColor:v1`),
  selected church (`wp.selectedOrg.persist` — still re-validated against memberships by the existing auth
  guard), My Schedule selected church, song-list column/visibility prefs, collapsible-section states,
  getting-started dismissal. Research enumerates the exact keys/patterns from `src/` (`localStorage` usage).
- **Never moved:** Firebase Auth state (IndexedDB) and anything auth-adjacent, including the magic-link
  `emailForSignIn` key (the app already handles e-mail re-entry). Rehearse audio playback positions are
  optional (Claude's discretion).
- After a hand-off, show a **one-time dismissible notice** via the existing system-wide notification store:
  "WorshipBuilder has a new address — update your bookmarks to worshipbuilder.web.app."

### Hosting + links (R448, R449)
- `firebase.json` becomes a two-target hosting array with `.firebaserc` targets: `app` → site
  `worshipbuilder` (public `dist`, the existing `/api/**` rewrite, SPA fallback, cache headers, `npm run
  build` predeploy) and `legacy` → site `worship-planner-bc515` (public `dist-legacy`, `/api/**` rewrite, `**`
  → bridge, `build:legacy` predeploy). Deploy commands become `firebase deploy --only hosting:app` /
  `hosting:legacy`.
- `SERVICE_SHARE_BASE_URL` default (`functions/src/params.ts`) → `https://worshipbuilder.web.app`; confirm no
  `functions/.env*` override pins the old value. Grep all app + function code for hard-coded
  `worship-planner-bc515.web.app` / `.firebaseapp.com` URLs; client link builders that use
  `window.location.origin` follow the new domain automatically.
- The Firebase web config `authDomain` stays `worship-planner-bc515.firebaseapp.com` this milestone (switch is
  backlog 999.14).

### Google sign-in safety (R451)
- **Research must prove** that Firebase Hosting's reserved `/__/*` namespace (notably `/__/auth/handler`,
  `/__/auth/iframe`, `/__/firebase/init.json`) is still served on the old default site after its `**` rewrite
  points at the bridge — or the legacy config must explicitly exclude `/__/**`. Google sign-in on the new
  domain must keep working through the old `firebaseapp.com` auth domain.

### Allowlists (R450)
- Add the new origins and **keep the old ones** for now: `storage-cors.json` gains
  `https://worshipbuilder.web.app` and `https://worshipbuilder.firebaseapp.com`; Auth authorized domains gain
  `worshipbuilder.firebaseapp.com` (`worshipbuilder.web.app` is already present, verified 2026-10-27).
  Research checks for any other origin-scoped config (CSP headers, render-service CORS, function Origin
  checks, App Check, OAuth client origins).

### Runbook (R453)
- A cutover runbook in `docs/` (e.g. `docs/runbooks/worshipbuilder-cutover.md`) with ordered steps and exact
  commands: pre-flight (tests green, functions build), apply Storage CORS, add authorized domain, deploy
  functions (ships 144 email copy + new share base URL) and `hosting:app`, smoke-test the new domain, then
  deploy `hosting:legacy` (bridge) — **never during a service**; the one-time sign-in on the new domain;
  re-granting the window-placement (multi-screen) permission and re-checking monitor setup on each Run
  computer; optional console renames (Firebase public-facing project name, OAuth consent-screen app name);
  rollback (redeploy the app build to the legacy target); post-cutover smoke checklist. Each production step
  is marked "owner confirms before running".

### Claude's Discretion
- Exact module/file names, payload encoding (base64url JSON), size cap, fragment key name, and how the
  legacy build inlines its script.
- Whether to add the sign-in-email key to the never-move list explicitly in code (yes, as a documented
  denylist) — and whether to move rehearse playback positions.
- Test strategy for the bridge (jsdom unit tests of encode/decode/validate + a build-output assertion).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/monitorConfig.ts` (`MONITOR_CONFIG_STORAGE_KEY`, `VIDEO_KEY_COLOR_STORAGE_KEY`) — existing
  parse/validate helpers for monitor config are the natural shape validators.
- `src/stores/auth.ts` (`SELECTED_ORG_LOCAL_KEY = 'wp.selectedOrg.persist'`) — existing parse/stale-membership
  logic.
- System-wide dismissible notification store (v2.7, Phase 104) for the arrival notice.
- `src/__tests__/firebaseHostingHeaders.test.ts` / `firebaseFunctionsPredeploy.test.ts` — precedent for
  asserting `firebase.json` shape in tests (note: the former contains NUL bytes; write new tests as UTF-8).

### Established Patterns
- `firebase.json` currently: one unnamed hosting block (`public: dist`, `predeploy: npm run build`,
  `/api/**` → `api`, `**` → `/index.html`, cache headers); functions block has
  `predeploy: npm --prefix functions run build` (Phase 144). `.firebaserc` has only the default project.
- `vite.config.ts` aborts `vite build` when `VITE_FIREBASE_*` env vars are missing — the legacy build must
  not depend on Firebase config (or must not trip that guard).
- Production deploys need per-deploy owner confirmation (memory: deploy-policy-confirm-then-deploy).

### Integration Points
- `functions/src/params.ts:22-24` `SERVICE_SHARE_BASE_URL` default.
- `storage-cors.json` (origins list).
- App entry `src/main.ts` (boot-time import before router/store init).
- `index.html` / app bootstrap.

</code_context>

<specifics>
## Specific Ideas

Owner context: the church's Run computers (projection) carry per-origin monitor setup and window-placement
permission; a naive origin move silently wipes them. The cutover must not happen during a service.

</specifics>

<deferred>
## Deferred Ideas

- Switching `authDomain` to the new domain and a custom domain + verified Resend sender — backlog 999.14.
- Removing the old origins from Storage CORS / authorized domains after a transition period.

</deferred>

## Amendment — research-driven decisions (2026-10-27, recommendations auto-accepted)

- **`functions/.env` pins the old share base URL.** The gitignored local `functions/.env` sets
  `SERVICE_SHARE_BASE_URL` to the old domain and wins over the `params.ts` default at deploy time. Change the
  `params.ts` default anyway (code + tests), and make updating the local `functions/.env` value to
  `https://worshipbuilder.web.app` an explicit **runbook pre-flight step** (owner-confirmed; the file is not
  committed). The runbook must include a check that prints only whether the key matches the new origin —
  never the file's other values.
- **Deploy order:** `hosting:app` first (new site live), then functions (emails start linking to the new
  site), then smoke tests, then `hosting:legacy` (bridge). Supersedes the order sketched above.
- **Reserved paths:** Firebase Hosting serves `/__/*` before redirects/rewrites (docs + live check), so no
  explicit exclusion is needed. The legacy site must stay alive (as the bridge) until backlog 999.14 moves
  `authDomain`, because Google sign-in, password-reset and magic-link flows use
  `worship-planner-bc515.firebaseapp.com/__/auth/*`.
- **Moved keys** (explicit allowlist, not a prefix scan): `wp:runMonitorConfig:v2`, `wp:videoKeyColor:v1`,
  `wp.selectedOrg.persist`, `volunteerSelectedChurch`, `wp:songTableColumns:v1:{org}:{uid}`,
  `wp:tagFilter:v2:{org}:{uid}` (tag filters move too), `wp:gettingStartedDismissed`. Never moved:
  `emailForSignIn`, Firebase Auth state, sessionStorage `wp.selectedOrg`, `rehearse-audio-position:*`, the
  bridge's own flag.
- **Boot order:** the import runs from a side-effect module imported **first** in `src/main.ts` (vue-router's
  `createWebHistory` snapshots `location` at module evaluation). Build the redirect target by string
  concatenation onto the constant origin after collapsing leading `//` (never `new URL(path, base)`).
- **Legacy build:** `vite.config.legacy.ts` → `dist-legacy/` (gitignored), bridge entry under `src/legacy/`.
- **Docs:** update the old-domain URL in `functions/DEPLOY-EMAIL-DOMAIN.md`.
- **Runbook additions:** tabs left open on the old origin need one reload after the bridge deploy; Chrome's
  Automatic Fullscreen setting/policy is origin-listed and must be re-granted with window-placement; Google
  sign-in on the new domain is smoke-tested **before** the bridge deploy (OAuth-origin behavior is
  [ASSUMED] fine); rollback = console "Roll back" on the legacy site or
  `firebase hosting:clone worshipbuilder:live worship-planner-bc515:live`.
