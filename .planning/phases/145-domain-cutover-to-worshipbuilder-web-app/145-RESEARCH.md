# Phase 145: Domain Cutover to worshipbuilder.web.app - Research

**Researched:** 2026-10-27
**Domain:** Firebase Hosting multi-site config, cross-origin localStorage hand-off (URL fragment), origin allowlists, owner runbook
**Confidence:** HIGH on hosting/reserved-URL/code inventory (empirically verified against the live sites and firebase-tools source); MEDIUM on Chrome permission scope and OAuth-origin behaviour (documented as [ASSUMED] where the docs are silent)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Old-domain bridge (R451, R452)**
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

**Receiving side (R452)**
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

**Hosting + links (R448, R449)**
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

**Google sign-in safety (R451)**
- **Research must prove** that Firebase Hosting's reserved `/__/*` namespace (notably `/__/auth/handler`,
  `/__/auth/iframe`, `/__/firebase/init.json`) is still served on the old default site after its `**` rewrite
  points at the bridge — or the legacy config must explicitly exclude `/__/**`. Google sign-in on the new
  domain must keep working through the old `firebaseapp.com` auth domain.

**Allowlists (R450)**
- Add the new origins and **keep the old ones** for now: `storage-cors.json` gains
  `https://worshipbuilder.web.app` and `https://worshipbuilder.firebaseapp.com`; Auth authorized domains gain
  `worshipbuilder.firebaseapp.com` (`worshipbuilder.web.app` is already present, verified 2026-10-27).
  Research checks for any other origin-scoped config (CSP headers, render-service CORS, function Origin
  checks, App Check, OAuth client origins).

**Runbook (R453)**
- A cutover runbook in `docs/` (e.g. `docs/runbooks/worshipbuilder-cutover.md`) with ordered steps and exact
  commands: pre-flight (tests green, functions build), apply Storage CORS, add authorized domain, deploy
  functions (ships 144 email copy + new share base URL) and `hosting:app`, smoke-test the new domain, then
  deploy `hosting:legacy` (bridge) — **never during a service**; the one-time sign-in on the new domain;
  re-granting the window-placement (multi-screen) permission and re-checking monitor setup on each Run
  computer; optional console renames (Firebase public-facing project name, OAuth consent-screen app name);
  rollback (redeploy the app build to the legacy target); post-cutover smoke checklist. Each production step
  is marked "owner confirms before running".

**Build vs. apply:** everything (config, code, tests, runbook) is built and verified in this phase.
**No production change is applied here** — Storage CORS re-apply, Auth authorized-domain change, the new-site
deploy and the old-site bridge deploy are owner-gated, per-deploy confirmed, at milestone end.

### Claude's Discretion
- Exact module/file names, payload encoding (base64url JSON), size cap, fragment key name, and how the
  legacy build inlines its script.
- Whether to add the sign-in-email key to the never-move list explicitly in code (yes, as a documented
  denylist) — and whether to move rehearse playback positions.
- Test strategy for the bridge (jsdom unit tests of encode/decode/validate + a build-output assertion).

### Deferred Ideas (OUT OF SCOPE)
- Switching `authDomain` to the new domain and a custom domain + verified Resend sender — backlog 999.14.
- Removing the old origins from Storage CORS / authorized domains after a transition period.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R448 | `worshipbuilder` Hosting site is the single deploy target for the app (`/api/**` rewrite, SPA fallback, cache headers), docs reference it | "Hosting config shape" below: two-block `hosting` array, `target: app`, `.firebaserc` targets produced by `firebase target:apply` (verified locally); existing `firebaseHostingHeaders.test.ts` must be adapted to the array shape |
| R449 | Every generated link points at `https://worshipbuilder.web.app`; no hard-coded old-domain URL in app/function code | Link inventory below. **Critical: gitignored `functions/.env` pins the OLD value and beats the `params.ts` default at deploy** |
| R450 | Every origin allowlist includes the new domain before cutover | Origin-allowlist inventory: only Storage CORS + Auth authorized domains are origin-scoped; no CSP, no App Check, no function Origin checks, render-service not browser-facing |
| R451 | Old addresses redirect to same path/query/hash on the new domain | Bridge design; reserved `/__/*` namespace proven to survive the SPA `**` rewrite (live curl evidence + docs priority list) |
| R452 | First visit through an old address carries allowlisted, shape-validated per-browser setup; fill-if-absent; no auth state; crafted link cannot plant keys | Complete localStorage inventory with per-key shapes/validators; boot-order analysis (`import` hoisting + `createWebHistory`); Security Domain |
| R453 | Cutover runbook (ordered steps, timing, one-time sign-in, window permission re-grant, console renames, rollback, smoke checklist) | Runbook Facts section (rollback via console "Roll back" / `hosting:clone`, per-origin storage/permission facts, recommended deploy order) |
</phase_requirements>

## Summary

The hosting half is low-risk and now empirically verified. Firebase Hosting reserves the `/__/*` namespace and
serves it **before** redirects, static files and rewrites (documented priority list), and the live default
site already proves it: today `worship-planner-bc515.web.app` has the same `**` → `/index.html` SPA rewrite the
bridge will use, an arbitrary deep path returns the SPA shell (200 text/html), yet `/__/auth/handler`,
`/__/auth/iframe` and `/__/firebase/init.json` all return their real content (init.json is `application/json`).
So pointing the legacy `**` rewrite at the bridge page cannot break Google sign-in, which stays on
`authDomain = worship-planner-bc515.firebaseapp.com`. The new `worshipbuilder` site exists (confirmed via
`firebase hosting:sites:list`, read-only) but has never been released (live GET returns "Site Not Found").

The single biggest planning risk is **not** in the hosting config: the gitignored local file `functions/.env`
currently contains a `SERVICE_SHARE_BASE_URL=` line that points at the OLD domain (checked with a boolean grep,
value not printed). `firebase deploy` loads `functions/.env` first and only falls back to the `defineString`
`default`, so changing `functions/src/params.ts` alone will NOT move any generated link (share links in
reminder emails, magic-link continue URLs, invite/admin email sign-in links) in production. The runbook and the
plan must handle this explicitly (owner edits/removes the line before the functions deploy; a pre-flight grep
check; plan must not assume the default is live).

The second-biggest risk is the hand-off module's boot order. `src/main.ts` statically imports `./router`; ES
imports are evaluated before the module body, and `createWebHistory()` snapshots `window.location`
(including the hash) when `router/index.ts` is evaluated. A fragment import placed in the `main.ts` body is
therefore too late. The import must run from a side-effect module that is the **first** import in `main.ts`.
The "fragment-only transport" also dictates the redirect URL is built by **string concatenation onto a constant
origin** (never `new URL(path, base)`, which treats a `//evil.com` pathname as protocol-relative).

**Primary recommendation:** Two-block `hosting` array (`app`, `legacy`), a dependency-free `src/originHandoff/`
module (allowlist + per-key validators + base64url JSON in `#wph1=` fragment) shared by a Vite-built
`src/legacy/` bridge page and a side-effect `bootstrap.ts` imported first in `main.ts`; change the
`params.ts` default AND make the runbook fix `functions/.env`; write the runbook to `docs/runbooks/`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Serve the app at worshipbuilder.web.app | CDN / Static (Hosting site `worshipbuilder`) | API (`/api/**` rewrite to `api` function) | Hosting site owns static bundle + SPA fallback + cache headers |
| Old-address redirect + settings carry | Browser / Client (bridge page JS) | CDN / Static (legacy Hosting site serves the page) | Only client JS can read the old origin's localStorage; a server 301 cannot (and cannot carry data) |
| Hand-off validation + import | Browser / Client (boot module) | — | localStorage is client-only; validation is the security boundary |
| Generated links in emails / share links | API / Backend (`SERVICE_SHARE_BASE_URL` param) | Browser / Client (`window.location.origin` builders) | Server-built links need an explicit base; client builders self-follow the origin |
| Google sign-in handler | CDN / Static (reserved `/__/auth/*` on default site) | — | Firebase-served; unchanged because `authDomain` is unchanged |
| Storage download CORS | Database / Storage (bucket CORS config) | — | Bucket-level allowlist; applied with gcloud, not by deploy |
| Auth authorized domains | Firebase Auth config (console/Admin API) | — | Not in git; owner-gated production change |
| Arrival notice | Browser / Client (Pinia `toasts` store, `ToastHost` in `App.vue`) | — | Existing system-wide notification surface |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase-tools (CLI, already installed) | 15.29.0 | `target:apply`, `deploy --only hosting:<target>`, `hosting:clone` | Verified locally; lifecycle-hook source read |
| vite (already a devDependency) | 7.3.1 | Second tiny build (`vite.config.legacy.ts`) for the bridge | Prototype built a 0.34 kB html + 0.38 kB js bridge with no plugins |
| vitest (already) | 4.0.18 | Unit tests for the hand-off module, config-shape tests | Existing root suite |
| vue-router / pinia | 5.0.3 / 3.x (already) | Boot order constraints; `useToasts().setSticky` for the notice | Existing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `TextEncoder` / `btoa` / `atob` (platform) | — | UTF-8 safe base64url (nicknames may be non-ASCII) | In the hand-off codec; no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Emitted hashed JS file for the bridge | `vite-plugin-singlefile` / custom inline plugin | Extra dependency for ~0.4 kB; the `**` no-cache header keeps the HTML fresh and the hashed script is immutable. Not worth it. |
| `.firebaserc` targets (locked) | `"site": "<id>"` key in each hosting block | Works without `.firebaserc` edits, but CONTEXT locks targets; keep targets. |

**Installation:** none. **No new npm packages are required** — everything is built from existing devDependencies and platform APIs.

**Version verification:** `firebase --version` → 15.29.0; `node_modules/vite` 7.3.1; `node_modules/vitest` 4.0.18; `node_modules/vue-router` 5.0.3; `node_modules/firebase` 12.10.0 (all read from local installs this session).

## Package Legitimacy Audit

No external packages are installed by this phase (Vite/Vitest/firebase-tools are already present; the codec uses platform APIs).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none new) | — | — | — | — | — | N/A |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 OLD ORIGIN (worship-planner-bc515.web.app | .firebaseapp.com)            NEW ORIGIN (worshipbuilder.web.app)
 ───────────────────────────────────────────────────────────            ──────────────────────────────────
 any path/query/#hash ──► Hosting site "worship-planner-bc515" (target: legacy)
                           │ priority: /__/* reserved (served by Firebase, untouched)
                           │           /api/** ──rewrite──► Cloud Function `api` (still-open old tabs)
                           │           **      ──rewrite──► /index.html = bridge page
                           ▼
                       bridge.js (src/legacy/bridge.ts, imports src/originHandoff/encode)
                           1. flag wp:handoffDone? ── yes ─► redirect, no payload
                           2. read ALLOWLISTED localStorage keys (never emailForSignIn/auth)
                           3. payload = {v:1, h:<orig #hash>, k:{key:rawString,...}} ─► base64url
                           4. set flag wp:handoffDone, then
                              location.replace( 'https://worshipbuilder.web.app' + normPath + search
                                                + '#wph1=' + payload )     ◄── fragment never leaves browser
                                                                   │
                                                                   ▼
                                  Hosting site "worshipbuilder" (target: app) serves SPA shell
                                  main.ts:  import './originHandoff/bootstrap'   ◄── FIRST import
                                     (runs before ./router → createWebHistory snapshots location)
                                     a. parse #wph1=…   b. size/shape caps   c. allowlist+pattern match
                                     d. per-key validator, REBUILD value   e. setItem only if absent
                                     f. history.replaceState(strip fragment, restore original #hash)
                                  then createPinia → app.use(router) → mount
                                  if payload consumed: useToasts().setSticky('origin-handoff', …)
 Google sign-in (unchanged):  app ─popup─► https://worship-planner-bc515.firebaseapp.com/__/auth/handler (reserved, legacy site)
```

### Recommended Project Structure
```
src/
├── originHandoff/
│   ├── allowlist.ts        # ALLOWED_KEYS + dynamic patterns + DENYLIST + per-key validators (pure)
│   ├── codec.ts            # encodePayload/decodePayload (base64url JSON, caps) (pure)
│   ├── bridge.ts           # collectFromStorage(), buildRedirectUrl(loc) (pure; testable)
│   ├── apply.ts            # applyFragment(loc, storage, history) → {consumed, imported}
│   ├── bootstrap.ts        # side-effect: runs apply at import time; exports result for main.ts
│   └── __tests__/*.test.ts # MUST live in a __tests__ dir (tsconfig.vitest.json includes src/**/__tests__/* only)
├── legacy/
│   ├── index.html          # <noscript> link + <script type="module" src="./main.ts">
│   └── main.ts             # imports ../originHandoff/{allowlist,codec,bridge}; NO vue/firebase/pinia imports
vite.config.legacy.ts       # name matches tsconfig.node.json include "vite.config.*" (so it is type-checked)
dist-legacy/                # build output → add `dist-legacy/` to .gitignore (only `dist/` is ignored today)
docs/runbooks/worshipbuilder-cutover.md
docs/adr/0247-….md          # rationale (project convention: decisions live in ADRs)
```

### Pattern 1: Hosting config shape (verified)
**What:** Two blocks, each with `target`; every block MUST have a `target` — in `firebase-tools` 15.29.0's `lifecycleHooks.js`, `getReleventConfigs` keeps `!config.target || onlyTargets.includes(config.target)`, i.e. a target-less block runs its `predeploy` on EVERY `--only hosting:x` deploy. `predeploy` runs only for the targeted blocks (source read this session).
```json
"hosting": [
  {
    "target": "app",
    "public": "dist",
    "predeploy": ["npm run build"],
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/**", "function": "api" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [ /* unchanged: ** no-cache; /assets/** immutable */ ]
  },
  {
    "target": "legacy",
    "public": "dist-legacy",
    "predeploy": ["npm run build:legacy"],
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/**", "function": "api" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [ /* same two entries: ** no-cache, /assets/** immutable */ ]
  }
]
```
`functions` block keeps `"predeploy": ["npm --prefix functions run build"]` (guarded by existing `firebaseFunctionsPredeploy.test.ts`; do not touch).
`.firebaserc` — produce it with the CLI (offline, writes only the file; verified in a scratch dir):
```
firebase target:apply hosting app worshipbuilder
firebase target:apply hosting legacy worship-planner-bc515
```
Resulting shape (note the CLI also adds `"etags": {}`):
```json
{ "projects": { "default": "worship-planner-bc515" },
  "targets": { "worship-planner-bc515": { "hosting": {
      "app": ["worshipbuilder"], "legacy": ["worship-planner-bc515"] } } },
  "etags": {} }
```
The default site CAN be a target (the CLI accepts it; deploy itself was not run — see A5). `.firebaserc`, `firebase.json` and `storage-cors.json` are all git-tracked. **Footgun:** `firebase deploy --only hosting` (no `:target`) deploys BOTH sites; the runbook/docs must always use `hosting:app` / `hosting:legacy`. [CITED: firebase.google.com/docs/hosting/multisites, firebase-tools 15.29.0 source]

### Pattern 2: Boot-order-safe import (R452)
**What:** ES `import` statements are hoisted: all static imports of `main.ts` (including `./router`) evaluate before `main.ts`'s body. `useHistoryStateNavigation` calls `createCurrentLocation(base, window.location)` — which includes `search + hash` — at `createWebHistory()` time (`node_modules/vue-router/dist/vue-router.esm-browser.js:450-459,535-537`). So the fragment must be consumed (and the URL cleaned) by a module evaluated **earlier** than `./router`:
```ts
// src/main.ts
import './originHandoff/bootstrap'          // FIRST import: strips #wph1 + fills localStorage
import './assets/main.css'
...
import { takeHandoffResult } from './originHandoff/bootstrap'
...
app.use(createPinia())
if (takeHandoffResult().consumed) {
  useToasts().setSticky('origin-handoff', { variant: 'info',
    heading: 'WorshipBuilder has a new address',
    body: 'Update your bookmarks to worshipbuilder.web.app.' })
}
```
(`ToastHost` is mounted once in `App.vue` for every route, including `/login`, so the notice shows pre-sign-in. `setSticky` is keyed/idempotent.) No store reads localStorage at module-eval time (stores read lazily inside `use…Store()`/`setup()`), so first-import placement is sufficient. Restoring the hash: `url = new URL(location.href); url.hash = restored; history.replaceState(history.state, '', url.href)` inside try/catch (absolute same-origin href cannot navigate cross-origin). [VERIFIED: vue-router source read; src/main.ts, src/router/index.ts:30 `createWebHistory(import.meta.env.BASE_URL)`]

### Pattern 3: Redirect URL construction (injection-safe)
```ts
const NEW_ORIGIN = 'https://worshipbuilder.web.app'           // constant, never derived from input
const path = loc.pathname.replace(/^\/{2,}/, '/')               // '//evil.com/x' must stay a PATH on NEW_ORIGIN
const dest = NEW_ORIGIN + path + loc.search + '#wph1=' + payload
location.replace(dest)
```
Do **not** use `new URL(loc.pathname, NEW_ORIGIN)`: a pathname beginning `//host` resolves to `host`. Legacy pathnames like `/__/auth/handler` never reach the bridge (reserved).

### Pattern 4: Legacy Vite build that avoids the Firebase env guard
The guard (`vite.config.ts:24-40`) and the emulator-host plugin live only in `vite.config.ts`; `vite build --config vite.config.legacy.ts` never loads them. Root vitest only auto-discovers `vite.config.*`/`vitest.config.*` exact names, so `vite.config.legacy.ts` is invisible to it, yet matches tsconfig.node.json's `vite.config.*` include. Prototype (Vite 7.3.1, no plugins) output: `index.html` 0.34 kB + `assets/index-<hash>.js` 0.38 kB, `<noscript>` preserved.
```ts
// vite.config.legacy.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
export default defineConfig({
  root: fileURLToPath(new URL('./src/legacy', import.meta.url)),   // env files not loaded from repo root
  base: '/',
  build: { outDir: fileURLToPath(new URL('./dist-legacy', import.meta.url)),
           emptyOutDir: true, modulePreload: false, target: 'es2020' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
```
`package.json`: `"build:legacy": "vite build --config vite.config.legacy.ts"`. Because the entry lives under `src/`, `tsconfig.app.json` (`src/**/*`) type-checks it via `npm run type-check`. The entry must import only `src/originHandoff/{allowlist,codec,bridge}` (no Vue/Firebase/Pinia) — assert this in a build test (output JS contains no `firebase`/`vue` strings).

### Anti-Patterns to Avoid
- **Consuming the fragment in `main.ts` body** — router already snapshotted the hash (Pattern 2).
- **Scanning `localStorage` for `wp*` prefixes** — an allowlist of exact keys + anchored dynamic patterns only. One moved key (`volunteerSelectedChurch`) is not `wp`-prefixed and some wp-prefixed future keys must not move.
- **Pass-through of raw strings** — parse, validate, then **rebuild** the value from whitelisted fields and re-`JSON.stringify` (drops extra properties, normalizes).
- **Deriving the redirect host or restore path from payload/query** — only the constant origin and `location` fields.
- **Treating the default `params.ts` value as authoritative** — `functions/.env` wins at deploy.
- **`firebase deploy --only hosting`** after the array change — deploys both sites.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shape validation of the monitor mapping / video key color | New validators | Export the existing private `isValidMapping` and `isValidVideoKeyColor` from `src/utils/monitorConfig.ts` (tiny additive change) and reuse | Single source of truth incl. `NICKNAME_MAX_LENGTH=60` and `HEX_COLOR_PATTERN`; alt. without editing: `loadMapping(fakeStorage)` / `loadVideoKeyColor(fakeStorage)` accept a `Storage` override, but the latter returns a default on invalid so cannot signal "invalid" — prefer exporting the predicates |
| Arrival notice UI | A new banner | `useToasts().setSticky(key, {variant,heading,body})` | Existing keyed, idempotent, dismissible, rendered by `ToastHost` on every route |
| Base64url | A library | `TextEncoder` + `btoa`/`atob` + `-`/`_` swap | ~6 lines; must be UTF-8 safe (nicknames) |
| Rollback tooling | Custom scripts | Console "Roll back" or `firebase hosting:clone` | Built in (see Runbook Facts) |
| Hosting target wiring | Hand-edited `.firebaserc` | `firebase target:apply hosting …` | CLI writes the exact shape (verified) |

**Key insight:** the hand-off is an injection surface, so the shortest correct code is a small allowlist + the validators the app already trusts for the same values on every normal read.

## Per-origin Storage Inventory (R452)

Source: grep of `localStorage|sessionStorage|storageKey|*_KEY` across non-test `src/` (this session). No `IndexedDB`, `document.cookie` or `caches` usage exists in app code (Firebase SDK uses its own storage — never moved).

| # | Key / pattern | Where | Value shape | Existing validator to reuse | Recommendation |
|---|---------------|-------|-------------|-----------------------------|----------------|
| 1 | `wp:runMonitorConfig:v2` | `src/utils/monitorConfig.ts:52` | JSON `{assignments:[{fingerprint:string, role:'audience'\|'confidence'\|'video', nickname?:string≤60}], savedAt:number}` | `isValidMapping` (private; export it). Add own caps: ≤16 assignments, fingerprint ≤200 chars | **MOVE** |
| 2 | `wp:videoKeyColor:v1` | `monitorConfig.ts:196` | JSON `{enabled:boolean, colorHex:/^#[0-9a-fA-F]{6}$/}` | `isValidVideoKeyColor` (private; export it) | **MOVE** |
| 3 | `wp.selectedOrg.persist` | `src/stores/auth.ts:77,89-111` | JSON `{uid:string, orgId:string}`; consumer requires `parsed.uid === currentUid`, and `readRememberedOrg` result is used only if `ids.includes(remembered)` (auth.ts:552-554) | none exported; validate both strings `^[\w.-]{1,128}$` and rebuild | **MOVE** (inert for any other uid; membership-checked) |
| 4 | `volunteerSelectedChurch` | `src/stores/mySchedule.ts:28` (**not `wp`-prefixed**) | plain string orgId; `reconcileSelectedChurch` re-checks it against loaded `churches` | none; `^[\w.-]{1,128}$` | **MOVE** (explicit allowlist entry; CONTEXT lists "My Schedule selected church") |
| 5 | `wp:tagFilter:v2:{orgId}:{uid}` | `src/stores/songs.ts:149` | JSON `{include:string[], exclude:string[]}` | none; arrays of strings, ≤200 items, each ≤100 chars | **MOVE** (song-list filter pref); anchored pattern `^wp:tagFilter:v2:[\w-]{1,128}:[\w-]{1,128}$` |
| 6 | `wp:songTableColumns:v1:{orgId}:{uid}` | `songs.ts:202` | JSON `Record<string, boolean>`; defaults keys `category,key,ccli,lastUsed,tags,themes,files` (const is store-local, not exported) | none; accept only those 7 keys with boolean values | **MOVE**; anchored pattern |
| 7 | `wp:gettingStartedDismissed` | `src/components/GettingStarted.vue:91` | presence-only (`!== null`); value written is `'true'` | none; value must equal `'true'` | **MOVE** |
| 8 | CollapsibleSection `storageKey` (caller-supplied; values `'open'\|'closed'`) | `src/components/CollapsibleSection.vue:42-46` | `'open'`/`'closed'` | — | **NOTHING TO MOVE TODAY**: grep shows the component has **no consumer** in `src/` (only its own test), so zero keys exist. Do not allowlist an open-ended pattern; if a consumer is added later its literal key goes in the allowlist. Mention in the plan so "collapsible states" is not silently dropped. |
| 9 | `rehearse-audio-position:{uid}:{trackId}` | `RehearseAudioPlayerBar.vue:170,196,212` | numeric string, written on every `timeupdate` | trivially `Number.isFinite` | **NEVER MOVE** (discretion): unbounded key count (one per track), re-derivable, low value, and written continuously so it would bloat the payload |
| 10 | `emailForSignIn` | `VolunteerSignInView.vue:116,144`, `volunteerAuth.ts:12,60,72` | lowercase email string | — | **NEVER MOVE** (locked). Effect: a magic-link *requested on the old origin* and opened after cutover lands on the new origin without the stored email and the app's existing re-entry prompt appears (`volunteerAuth.ts:35,60`) |
| 11 | sessionStorage `wp.selectedOrg` (`auth.ts:76`) | per-tab | JSON `{uid,orgId}` | — | **NEVER MOVE** (per-tab, not cross-origin readable; localStorage tier #3 covers new tabs) |
| 12 | Firebase Auth persisted user (SDK-managed) | Firebase SDK | — | — | **NEVER MOVE** (locked; web sessions are single-origin: "Firebase Auth web sessions are single host origin and will be persisted for a single domain only" — firebase.google.com/docs/auth/web/auth-state-persistence) |
| 13 | `wp:handoffDone:v1` (new, old-origin flag) | bridge | `'1'` | — | Bridge-only; also add to denylist of keys that must never be accepted on the receiving side |

Notes: BroadcastChannel names (`wp-run-{serviceId}`) and `postMessage` `targetOrigin: window.location.origin` are same-origin by construction and need no change. Output-window `window.open` flow copies `sessionStorage` to children only with a preserved opener (`useRunControl.ts:810`) — unaffected.

## Link Inventory (R449)

| Site | File:line | Origin source | Action |
|------|-----------|---------------|--------|
| `SERVICE_SHARE_BASE_URL` definition | `functions/src/params.ts:22-24` | default `https://worship-planner-bc515.web.app` | **Change default** to `https://worshipbuilder.web.app`; fix the doc-comment |
| Share-link resolver (reminder/message `{{service_link}}`) | `functions/src/index.ts:1995,2011` | param | follows param |
| Rehearse magic-link `ActionCodeSettings.url` | `functions/src/index.ts:2169-2172` (`<base>/volunteer/verify`) | param | follows param |
| Volunteer link mint (self-service + admin copy) | `functions/src/volunteerLink.ts:35-55` | param | follows param |
| Invite/admin emails sign-in line | `functions/src/adminEmail.ts:33-58`, `inviteOnboarding.ts:58-98,239-240` (`generatePasswordResetLink(…,{url: baseUrl})`) | param | follows param |
| Client share/plan/quarter links | `ServiceEditorView.vue:4318,4351`, `ServiceCard.vue:295`, `QuarterView.vue:791-793` | `window.location.origin` | self-following |
| Settings host display | `SettingsView.vue:787` | `window.location.origin` | self-following |
| Claude proxy base | `claudeApi.ts:112` `${window.location.origin}/api/anthropic` | origin | self-following (same-origin `/api/**` rewrite on the new site) |
| `functions/DEPLOY-EMAIL-DOMAIN.md:66` | doc text names `https://worship-planner-bc515.web.app` as hosting default | — | update text to the new domain |
| Comment `functions/src/index.ts:1913`, `params.ts:19-20` | prose | — | fine (generic `*.web.app`) |

**Hard-coded old-domain URLs found in non-test, non-planning sources:** `functions/src/params.ts:23` (the default), `storage-cors.json:4-5` (deliberately kept), `functions/DEPLOY-EMAIL-DOMAIN.md:66`. `worship-planner-bc515` as a *project id* (seed scripts, `.firebaserc`, DEPLOY docs, `brandName.test.ts` allowlist) is not a URL and stays. No `render-service/` source contains an app URL.

**DEPLOY-TIME OVERRIDE (critical):** `functions/.env` (gitignored; confirmed by `git check-ignore`/`git ls-files`) contains a `SERVICE_SHARE_BASE_URL` line whose value matches the OLD domain (boolean grep: old=1, new=0, localhost=0; value not printed). `functions/.env.local` has the same key set to a localhost value (emulator use) [ASSUMED emulator-only]. Firebase docs: "the Firebase CLI first attempts to load their values from local .env files" and prompts only "if they are not present in those files and no `default` is set" (firebase.google.com/docs/functions/config-env). Consequence: `params.ts` default change is necessary (fresh checkouts, tests, R449 wording) but not sufficient; the owner's local `functions/.env` must be edited (or the line deleted) before `firebase deploy --only functions`. Because the file is gitignored the fix cannot be committed — it belongs in the runbook pre-flight with a verification command, e.g. `grep -E '^SERVICE_SHARE_BASE_URL=' functions/.env` (shows the value; this is a public URL, not a secret).

## Other Origin-Scoped Configuration (R450)

| Mechanism | Finding | Action |
|-----------|---------|--------|
| Storage bucket CORS | `storage-cors.json` lists old `.web.app`, old `.firebaseapp.com`, `http://localhost:5173`; methods GET/HEAD. Bucket: `worship-planner-bc515.firebasestorage.app` (render-service/DEPLOY.md correction note; PROJECT.md:300). `gcloud storage buckets update gs://BUCKET --cors-file=FILE` **sets the whole config from the file**; view with `gcloud storage buckets describe gs://BUCKET --format="default(cors_config)"` [CITED: docs.cloud.google.com/storage/docs/using-cors] | Add `https://worshipbuilder.web.app` and `https://worshipbuilder.firebaseapp.com`, keep the three existing origins. Apply = runbook only (never in this phase). |
| Firebase Auth authorized domains | `worshipbuilder.web.app` already present (CONTEXT, verified 2026-10-27); add `worshipbuilder.firebaseapp.com`. Email-link continue URLs must be on the authorized list [CITED: firebase.google.com/docs/auth/web/email-link-auth] | Runbook step (console: Authentication → Settings → Authorized domains [ASSUMED path]) |
| `firebase.json` headers / CSP | Only `Cache-Control` headers; no CSP, no `frame-ancestors`, no CORS headers (grep over repo, excl. node_modules/dist/docs) | Replicate cache headers on both blocks |
| `api` function Origin/Referer checks | None. `api` authenticates by `X-App-Auth` (Firebase ID token, origin-agnostic) and is same-origin through the Hosting rewrite; `grep` for `Origin|Referer|cors|Access-Control` in `functions/src` finds only unrelated hits | None |
| Callable functions CORS | Callables use `onCall` with no explicit `cors`; firebase-functions v7 types: "Defaults to true for CallableFunction" (`lib/v2/providers/https.d.ts`) → any origin | None |
| App Check | No `initializeAppCheck`/`appCheck` anywhere in `src/` or `functions/src` | None |
| render-service (Cloud Run) | Called by Cloud Functions, not browsers; no CORS/Origin code in its sources | None |
| Frontend `/api/*` proxy auth | Every proxy call attaches `getAppAuthHeaders()` (6 files); header-based, not origin-based | None (memory: missing it 401s in prod — new code must not add un-headered `/api` fetches) |
| OAuth client (Google) | `signInWithPopup` (`src/stores/auth.ts:871`) opens `https://<authDomain>/__/auth/handler`; `authDomain` stays the old firebaseapp.com (`VITE_FIREBASE_AUTH_DOMAIN`; `src/firebase/index.ts:9`; value `worship-planner-bc515.firebaseapp.com` per CONTEXT — `.env.local` not readable in this session). The OAuth redirect URI is `https://<authDomain>/__/auth/handler`; Firebase docs only require OAuth redirect-URI changes **when `authDomain` changes** [CITED: firebase.google.com/docs/auth/web/redirect-best-practices] | No OAuth client change this phase. [ASSUMED: authorized *JavaScript* origins are not consulted by the popup flow]. Smoke-test Google sign-in on the new domain before deploying the bridge. |

## Reserved `/__/*` Proof (R451 safety)

1. **Docs:** Hosting priority when there is a conflict: (1) reserved namespaces beginning `/__/*`, (2) configured redirects, (3) exact-match static content, (4) configured rewrites, (5) custom 404, (6) default 404. [CITED: firebase.google.com/docs/hosting/full-config] The reserved-URLs page: "Firebase Hosting reserves URLs in your site beginning with `/__`" and lists `/__/firebase/init.json` etc. [CITED: firebase.google.com/docs/hosting/reserved-urls] (that page does not itself name `/__/auth/handler`/`iframe`; they are the OAuth helper paths it alludes to).
2. **Live evidence (HTTP GET, this session):**
   - `https://worship-planner-bc515.web.app/some/deep/path` → 200 `text/html` (the SPA `**` rewrite is active on the default site today)
   - `https://worship-planner-bc515.firebaseapp.com/__/auth/handler` → 200 `text/html`; `/__/auth/iframe` → 200 `text/html`; `/__/firebase/init.json` → 200 `application/json` (not the SPA shell — the rewrite did not capture it); same for `.web.app/__/auth/handler`.
   - `https://worshipbuilder.web.app/__/auth/handler` → 200 even though that site has never had a release (`/` → 404 "Site Not Found").
3. **Conclusion [VERIFIED]:** pointing the legacy `**` rewrite at the bridge page is exactly the rewrite shape already live; `/__/*` keeps working. No explicit `/__/**` exclusion is needed (and Hosting glob negation is not documented, so do not invent one). Still add (a) a config test asserting the legacy block's rewrites are exactly `/api/**` and `**` and has no `redirects`, and (b) post-deploy curl smoke checks in the runbook.
4. **Why this matters beyond popup sign-in:** until the 999.14 authDomain switch, password-reset and magic-link emails route through `https://worship-planner-bc515.firebaseapp.com/__/auth/action|links` [CITED: email-link-auth page: link hosted at `PROJECT_ID.firebaseapp.com`]. The legacy site must therefore keep serving `/__/*` forever (until 999.14); never delete or "disable" the legacy site.

## Runbook Facts (R453)

| Topic | Fact | Source |
|-------|------|--------|
| Storage origin scope | `localStorage`/`sessionStorage` are separate per origin; other origins "can't access the same storage objects" | [CITED: developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API] |
| Auth persistence | "Firebase Auth web sessions are single host origin and will be persisted for a single domain only" → everyone signs in once on the new domain | [CITED: firebase.google.com/docs/auth/web/auth-state-persistence] |
| Window-management permission | Chrome: permission is requested on `getScreenDetails()`, "The browser persists permission grants", revocable via site info. Chrome docs do not literally say "per origin", but permissions are origin-keyed site settings | [CITED: developer.chrome.com/docs/capabilities/web-apis/window-management]; per-origin scope [ASSUMED] — the runbook step is "re-grant and re-check", which is correct either way |
| Automatic Fullscreen | Chrome's "Automatic Fullscreen" content setting / `AutomaticFullscreenAllowedForUrls` policy are per-allowed-origin; if either is configured for the old URL on a Run computer it must be re-granted/extended for `https://worshipbuilder.web.app` (best-effort per the owner's hardware findings; per-display "Go fullscreen" buttons are the reliable path) | [CITED: .planning/codebase/ARCHITECTURE.md § useOutputWindow "Automatic Fullscreen content setting"] |
| Monitor setup | Carried by hand-off (item #1) once; verify on each Run computer (Run → monitor setup should show "matched" with no reconfigure) | codebase |
| Rollback | (a) Console: Hosting → site → Release history → hover a release → ⋮ → **Roll back** (creates a new release serving the earlier version; live channel only). (b) CLI: `firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live`. For this cutover: restore the old app on the legacy site with the console roll-back to the last pre-bridge release, or `firebase hosting:clone worshipbuilder:live worship-planner-bc515:live`. There is no separate `firebase hosting:rollback` command. The CONTEXT phrase "redeploy the app build to the legacy target" is achievable without editing config via `hosting:clone` | [CITED: firebase.google.com/docs/hosting/manage-hosting-resources]; `firebase hosting:clone --help` (v15.29.0) |
| Recommended deploy order | functions env fix → (Storage CORS, authorized domain) → **`hosting:app` first**, smoke test → `functions` (so emails never link to a not-yet-live site; CONTEXT lists functions before hosting:app — flag this ordering choice to the owner) → `hosting:legacy`, last, never during a service | recommendation |
| Smoke commands | `curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://worship-planner-bc515.firebaseapp.com/__/auth/handler` (expect 200 text/html), `…/__/firebase/init.json` (200 application/json), `curl -sI https://worship-planner-bc515.web.app/share/abc?x=1` then open in browser to confirm redirect keeps path+query | live-tested pattern |
| Old-tab caveat | Tabs left open on the old origin hold the old bundle; lazy route chunks (`/assets/*.js`) will 404 into the bridge HTML after the legacy deploy → a one-time reload is needed. `/api/**` stays rewritten so in-flight calls work. Put in "don't cut over during a service" note | reasoning |
| Console renames | Firebase "public-facing name" and OAuth consent-screen app name are cosmetic, optional, independent of the cutover | CONTEXT |

## Common Pitfalls

### Pitfall 1: `functions/.env` silently pins the old base URL
**What goes wrong:** params default updated, tests green, functions deployed — emails/links still carry the old domain (which then bounces through the bridge, masking the bug).
**Why:** CLI loads `.env` values before `default`; file is gitignored so no PR shows it.
**How to avoid:** runbook pre-flight check + explicit owner edit; a plan task (docs) must tell the owner; do not claim R449 satisfied by the default alone.
**Warning signs:** a test email's link host is still `worship-planner-bc515.web.app`.

### Pitfall 2: Fragment consumed too late (router snapshot)
**What goes wrong:** landing URL `/services/1#wph1=…` makes vue-router treat `#wph1=…` as the route hash and later `replaceState` fights its history state; stores may already have read empty localStorage.
**How to avoid:** `bootstrap.ts` as the first `main.ts` import (Pattern 2); test via a source-order assertion (`main.ts` first non-comment import line) plus a jsdom test that `applyFragment` strips the URL before a router is created.

### Pitfall 3: Protocol-relative path injection
`https://worship-planner-bc515.web.app//evil.com/x` → bridge must collapse leading slashes and concatenate onto the constant origin (Pattern 3); on the receiving side `replaceState` with a bare `//evil.com` path would throw SecurityError — use the absolute-href form inside try/catch.

### Pitfall 4: Existing header test breaks on the array shape
`src/__tests__/firebaseHostingHeaders.test.ts` types `hosting` as an object and reads `hosting.headers`. With an array it silently yields `[]` (`?? []`) and the tests then fail (shell path has no Cache-Control). Fix by changing only `loadFirebaseConfig()` to return `{ hosting: <block with target 'app'> }`. The file contains exactly one literal NUL byte (the `PLACEHOLDER` constant) — editing with the Edit tool may fail on it; if so, rewrite the file as UTF-8 replacing that constant with `'\u0000'`. Also add the same cache-header assertions for the `legacy` block.

### Pitfall 5: New tests not type-checked
`tsconfig.vitest.json` includes only `src/**/__tests__/*`; tests elsewhere (e.g. `src/originHandoff/foo.test.ts`) are not covered by `npm run type-check`. Put tests in `__tests__/` dirs (CLAUDE.md: use `npm run type-check`, not `-p tsconfig.app.json`).

### Pitfall 6: `dist-legacy/` committed
`.gitignore` ignores only `dist/`. Add `dist-legacy/`.

### Pitfall 7: Hand-off marker race / bounce-tracking cleanup
The bridge sets `wp:handoffDone:v1` before redirecting; if the tab dies mid-redirect that browser never re-sends, and Chrome's bounce-tracking mitigation may purge an intermediary's storage [ASSUMED]. Both are benign by design: fill-if-absent makes re-sends idempotent; losing the flag only re-runs the hand-off. Document as accepted.

### Pitfall 8: `firebase deploy --only hosting` deploys both sites
Always target. Add a test that every hosting block has a `target` (otherwise its predeploy leaks into every targeted deploy — verified in `lifecycleHooks.js`).

## Code Examples

### Codec (pure, UTF-8 safe)
```ts
// src/originHandoff/codec.ts
export const FRAGMENT_PREFIX = '#wph1='
export const MAX_FRAGMENT_CHARS = 48 * 1024
const toB64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}
export interface HandoffPayload { v: 1; h?: string; k: Record<string, string> }
export function encodePayload(p: HandoffPayload): string { return FRAGMENT_PREFIX.slice(1) /* wph1= */ + toB64Url(JSON.stringify(p)) }
export function decodePayload(rawHash: string): HandoffPayload | null {
  try {
    if (!rawHash.startsWith(FRAGMENT_PREFIX) || rawHash.length > MAX_FRAGMENT_CHARS) return null
    const o: unknown = JSON.parse(fromB64Url(rawHash.slice(FRAGMENT_PREFIX.length)))
    if (typeof o !== 'object' || o === null || (o as { v?: unknown }).v !== 1) return null
    const k = (o as { k?: unknown }).k
    if (typeof k !== 'object' || k === null || Array.isArray(k)) return null
    return o as HandoffPayload   // values are still UNTRUSTED strings; allowlist.ts validates each
  } catch { return null }
}
```
### Receiving side core loop (iterate the PAYLOAD, match against allowlist; validators rebuild values)
```ts
for (const [key, raw] of Object.entries(payload.k).slice(0, MAX_ENTRIES)) {
  const rule = matchRule(key)                    // exact keys + anchored regexes; DENYLIST checked first
  if (!rule || typeof raw !== 'string' || raw.length > MAX_VALUE_CHARS) continue
  const clean = rule.validate(raw)               // returns canonical string or null
  if (clean === null) continue
  try { if (storage.getItem(key) === null) storage.setItem(key, clean) } catch { /* quota/private mode */ }
}
```
Suggested caps (Claude's discretion, tune in plan): fragment ≤ 48 KiB encoded, ≤ 40 entries, ≤ 8 KiB per value, restored hash ≤ 512 chars and must start with `#`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single unnamed `hosting` object | `hosting` array with `target` per site | Firebase multi-site hosting | Test helper + deploy commands change |
| HTTP 301 `redirects` for domain moves | Client bridge page | n/a — needed here because redirects cannot carry localStorage | Bridge is the only way to carry per-origin state |

**Deprecated/outdated:** none relevant; Dynamic Links are not used by this app.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Chrome's `window-management` grant (and Automatic Fullscreen setting) is keyed per origin | Runbook Facts | Low — runbook says "re-check on each Run computer"; if it were site-wide the step is a harmless no-op |
| A2 | Google sign-in popup does not consult OAuth client "Authorized JavaScript origins" for the app origin when `authDomain` is unchanged | Other Origin-Scoped Config | Medium — sign-in on the new domain would fail with an origin error; mitigated by the mandatory pre-bridge smoke test on the new domain |
| A3 | `authDomain` value is `worship-planner-bc515.firebaseapp.com` (taken from CONTEXT; `.env.local` unreadable here) | Other Origin-Scoped Config | Low — the build-time value is whatever `.env.local` holds at `npm run build`; verify in runbook pre-flight |
| A4 | `jsdom` vitest environment provides `TextEncoder`, `TextDecoder`, `btoa`, `atob` (Node 22 globals) | Code Examples | Low — verify in the first test; fall back to `// @vitest-environment node` per file |
| A5 | `firebase deploy --only hosting:legacy` works with the default site as a target (CLI accepted `target:apply` offline; deploy not run per instructions) | Pattern 1 | Low — standard; first real deploy is owner-confirmed anyway |
| A6 | A rewrite `{"source":"/api/**","function":"api"}` works from the `worshipbuilder` site (same project, us-central1 default) | Pattern 1 | Medium — runbook smoke test: unauthenticated `curl https://worshipbuilder.web.app/api/esv/...` should return the function's `401 AUTH_REQUIRED` JSON, not HTML |
| A7 | Console path "Authentication → Settings → Authorized domains" | Other Origin-Scoped Config | Low — UI wording only |
| A8 | `functions/.env.local` is emulator-only | Link Inventory | Low |
| A9 | Chrome bounce-tracking mitigation may delete the bridge's own flag | Pitfall 7 | Low — idempotent by design |
| A10 | `worshipbuilder.web.app` is already on Auth authorized domains (CONTEXT claims verified 2026-10-27; not re-verified here) | Other Origin-Scoped Config | Medium — runbook step should list both domains and confirm |

## Open Questions

1. **Deploy order functions vs hosting:app**
   - Known: CONTEXT lists functions before `hosting:app`; with the fixed base URL, a functions deploy first would make emails link to a site that returns "Site Not Found" until `hosting:app` lands.
   - Recommendation: runbook puts `hosting:app` first (both happen in one session); flag to owner as a deliberate deviation.
2. **Who edits `functions/.env`?**
   - The file is gitignored and local to the owner's checkout; the phase cannot commit the fix. Recommendation: runbook pre-flight step + the executor may edit the local file only if the owner approves (it is not production), otherwise leave a clearly marked owner action.
3. **Move `wp:tagFilter` too?** CONTEXT's "song-list column/visibility prefs" reads as columns; tag filters are the other song-list pref. Recommendation: move both (same pattern, cheap), flagged as discretionary.
4. **Does the legacy site need a favicon or `robots`/`noindex`?** Cosmetic; add `<meta name="robots" content="noindex">` to the bridge.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | v22.23.2 (engines `^20.19 \|\| >=22.12`) | — |
| firebase-tools | `target:apply`, config validation, runbook | ✓ | 15.29.0 | — |
| gcloud | runbook Storage CORS command (owner runs) | ✓ | SDK 579.0.0 | — |
| git | `vite.config.ts` (`git log` for version hash) | ✓ | — | not needed by legacy config |
| Hosting sites | R448/R451 | ✓ | `worship-planner-bc515` (default) and `worshipbuilder` both listed by `firebase hosting:sites:list` (read-only) | — |
| `.env.local` (Firebase web config) | `npm run build` for the `app` predeploy | present in main checkout (not readable by this agent); required in worktrees (CLAUDE.md `worktree-env-setup`) | — | `build:legacy` needs no env |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 (jsdom default; per-file `// @vitest-environment node` allowed) |
| Config file | `vite.config.ts` `test` block (root); `functions/vitest.config.ts` (functions) |
| Quick run command | `npx vitest run src/originHandoff src/__tests__` |
| Full suite command | `npx vitest run` (baseline: only `src/storage.rules.test.ts` fails), `npm run type-check`, `cd functions && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R448 | `hosting` is an array; blocks `app` (public `dist`, predeploy `npm run build`, rewrites `/api/**`→`api` then `**`→`/index.html`, cache headers) and `legacy` (public `dist-legacy`, predeploy `npm run build:legacy`, rewrites exactly `/api/**` + `**`, no `redirects`); every block has `target`; `functions` predeploy retained; `.firebaserc` maps `app→worshipbuilder`, `legacy→worship-planner-bc515` | unit (JSON shape) | `npx vitest run src/__tests__/firebaseHosting` | ❌ Wave 0 (new `firebaseHostingTargets.test.ts`; existing `firebaseHostingHeaders.test.ts` ✅ must be adapted) |
| R448 | Docs/scripts reference `hosting:app`; `build:legacy` script exists | unit (string) | `npx vitest run src/__tests__/firebaseHostingTargets.test.ts` | ❌ Wave 0 |
| R449 | `functions/src/params.ts` default is the new origin; no old-domain host literal in non-test `src/**` / `functions/src/**` | unit (source scan; mirror `brandName.test.ts` style, exclude `__tests__`/`*.test.ts`) | `npx vitest run src/__tests__/legacyOriginLiterals.test.ts` | ❌ Wave 0 |
| R449 | Server link builders honor the param (already covered: `adminEmail.test.ts`, `volunteerLink.test.ts`, `inviteOnboarding.test.ts`, `index.test.ts` use a fake base) | unit | `cd functions && npx vitest run` | ✅ existing |
| R450 | `storage-cors.json` contains all 5 origins (new `.web.app`, new `.firebaseapp.com`, old two, localhost) and still GET/HEAD | unit (JSON) | `npx vitest run src/__tests__/storageCors.test.ts` | ❌ Wave 0 |
| R451 | `buildRedirectUrl` keeps path+query, collapses `//`, host constant, original hash carried in payload; flag short-circuit (no payload) | unit (jsdom) | `npx vitest run src/originHandoff/__tests__/bridge.test.ts` | ❌ Wave 0 |
| R451 | Legacy build output: `index.html` has `<noscript>` link to the new origin, script contains the new origin constant and no `firebase`/`vue` code; built via Vite JS API `build({configFile, write:false})` under `// @vitest-environment node` | integration (build) | `npx vitest run src/originHandoff/__tests__/legacyBuild.test.ts` | ❌ Wave 0 |
| R451 | `/__/*` safety: legacy rewrites contain no pattern that could capture reserved paths beyond `**` (documented priority); live curl is runbook-only | unit + manual | (above config test); runbook smoke | ❌ Wave 0 / manual |
| R452 | allowlist/denylist: each of keys #1-#7 round-trips; `emailForSignIn`, `firebase:*`, `wp.selectedOrg`, `rehearse-audio-position:*`, `wp:handoffDone:v1`, `__proto__`, unknown `wp:*` keys dropped | unit | `npx vitest run src/originHandoff/__tests__/allowlist.test.ts` | ❌ Wave 0 |
| R452 | per-key validators: malformed JSON, wrong types, bad role, nickname >60, bad hex, oversize arrays/values, uid/org pattern, extra properties stripped | unit | `…/allowlist.test.ts` | ❌ Wave 0 |
| R452 | fill-if-absent (never overwrites), size/entry caps, bad base64/JSON/version → no-op, no fragment → no-op, `replaceState` strips fragment, original hash restored, `//evil` path does not navigate | unit (jsdom, spy on `history.replaceState`) | `npx vitest run src/originHandoff/__tests__/apply.test.ts` | ❌ Wave 0 |
| R452 | `main.ts` first import is `./originHandoff/bootstrap`; arrival notice raised via `useToasts().setSticky` only when consumed | unit (source order + store) | `npx vitest run src/originHandoff/__tests__/mainOrder.test.ts` | ❌ Wave 0 |
| R452 | Exported validators `isValidMapping`/`isValidVideoKeyColor` keep existing `monitorConfig.test.ts` green | unit | `npx vitest run src/utils/__tests__/monitorConfig.test.ts` | ✅ existing |
| R453 | Runbook exists at `docs/runbooks/worshipbuilder-cutover.md` and contains: `storage buckets update`, `hosting:app`, `hosting:legacy`, "functions/.env", rollback (`hosting:clone`), window-management re-grant, "owner confirms", never-during-a-service | unit (string) | `npx vitest run src/__tests__/cutoverRunbook.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/originHandoff src/__tests__` (< 30 s)
- **Per wave merge:** `npx vitest run` + `npm run type-check` (+ `cd functions && npx vitest run` when `params.ts` changes)
- **Phase gate:** full root suite at baseline (only `storage.rules.test.ts` failing), `npm run type-check` clean, functions suite green, `npm run build:legacy` produces `dist-legacy/index.html`, `npm run build` still passes the Firebase env guard (needs `.env.local`)

### Wave 0 Gaps
- [ ] `src/originHandoff/__tests__/{allowlist,apply,bridge,legacyBuild,mainOrder}.test.ts`
- [ ] `src/__tests__/{firebaseHostingTargets,legacyOriginLiterals,storageCors,cutoverRunbook}.test.ts`
- [ ] Adapt `src/__tests__/firebaseHostingHeaders.test.ts` (`loadFirebaseConfig` returns the `app` block; add `legacy` header assertions)
- [ ] Export `isValidMapping`, `isValidVideoKeyColor` from `src/utils/monitorConfig.ts`
- Framework install: none.

Manual-only (justified; batched to `.planning/v2.16-DEFERRED-VERIFICATION.md`, never owner-accepted until run): real Chrome Google sign-in on the deployed new domain, real redirect + hand-off from a browser with real monitor config, window-placement/Automatic Fullscreen re-grant on a Run computer, Storage CORS download Save-dialog, magic-link email end-to-end.

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` → included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (negative requirement) | Never transfer auth state; explicit denylist (`emailForSignIn`, `firebase:*`, anything not allowlisted); Google sign-in stays on the unchanged authDomain |
| V3 Session Management | yes | Sessions are single-origin (documented); users sign in once on the new origin; `wp.selectedOrg.persist` is uid-bound and membership re-validated (`auth.ts:552-554`) |
| V4 Access Control | yes | Imported church/org ids are only hints; Firestore rules + membership check remain the boundary |
| V5 Input Validation | yes — primary | Allowlist + anchored patterns + per-key validators + rebuild-from-whitelist + caps; fragment-only transport |
| V6 Cryptography | no | No crypto; do not add "signing" — the payload carries no secret and every value is validated on receipt |
| V13/V14 Config / HTTP | yes | Keep Cache-Control headers; no new origins in CORS beyond the 2 additions; legacy site keeps only `/api/**` + bridge |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted link `https://worshipbuilder.web.app/#wph1=<payload>` planting keys | Tampering | Allowlist (exact keys + anchored regex), per-key validator, fill-if-absent, entry/size caps; unknown keys dropped silently |
| Planting a key for a victim's uid/org | Tampering / Elevation | Keys embed uid (cannot be guessed usefully); org selection re-checked against live memberships; no key grants access |
| Prototype pollution via `__proto__`/`constructor` keys | Tampering | Iterate `Object.entries`, match against allowlist regexes (a `__proto__` key never matches); never `Object.assign` payload onto objects; rebuild values from whitelisted fields |
| Oversized payload / storage exhaustion DoS | DoS | Fragment ≤ 48 KiB, ≤ 40 entries, per-value cap, `try/catch` around `setItem`; fragment never hits the server |
| Open redirect via path / protocol-relative `//host` | Spoofing | Constant destination origin; string concat after collapsing leading `//`; `replaceState` with absolute same-origin href in try/catch |
| Fragment leaks in history/Referer | Information Disclosure | Fragments are not sent to servers or in `Referer`; `location.replace` adds no old-origin history entry; receiver `replaceState`s it away immediately; payload holds only UI preferences |
| XSS via nickname/colorHex/church name rendered later | Tampering | Existing guards reused (nickname ≤ 60, strict `#RRGGBB` before CSS interpolation, T-137-01); values rendered through Vue text interpolation; add test that invalid values are dropped |
| Stale/credentialed state exfiltration via bridge | Information Disclosure | Bridge reads only allowlisted keys; no cookies, no tokens, no IndexedDB |
| Reserved-path capture breaking auth | DoS | Documented priority + live evidence; config test + post-deploy curl checks |
| Un-headered `/api` calls from new code | Spoofing (401s in prod) | Use `getAppAuthHeaders()` (project memory) — N/A unless new fetches are added |

## Sources

### Primary (HIGH confidence)
- Firebase Hosting priority order — https://firebase.google.com/docs/hosting/full-config (reserved `/__/*` first, redirects, static, rewrites)
- Firebase Hosting reserved URLs — https://firebase.google.com/docs/hosting/reserved-urls
- Firebase Hosting multi-site — https://firebase.google.com/docs/hosting/multisites (`hosting` array, `target:apply`, `deploy --only hosting:TARGET`)
- Firebase manage releases / rollback / clone — https://firebase.google.com/docs/hosting/manage-hosting-resources
- Firebase Functions config/params — https://firebase.google.com/docs/functions/config-env (`.env` loaded before `default`)
- Firebase Auth email-link — https://firebase.google.com/docs/auth/web/email-link-auth (continue URL authorized-domain rule; link hosted at `PROJECT_ID.firebaseapp.com`)
- Firebase Auth persistence — https://firebase.google.com/docs/auth/web/auth-state-persistence (single-origin sessions)
- Firebase redirect best practices — https://firebase.google.com/docs/auth/web/redirect-best-practices (redirect-URI change only when authDomain changes)
- Cloud Storage CORS — https://docs.cloud.google.com/storage/docs/using-cors
- MDN Web Storage — https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
- Local verification: firebase-tools 15.29.0 (`target:apply` in scratch dir, `hosting:sites:list`, `lifecycleHooks.js`, `hosting:clone --help`); vue-router 5.0.3 dist source; firebase-functions v7 `https.d.ts`; Vite 7.3.1 prototype build; live HTTP GETs of the old and new sites
- Codebase: `src/main.ts`, `src/router/index.ts`, `src/stores/{auth,songs,mySchedule,toasts}.ts`, `src/utils/monitorConfig.ts`, `src/components/{GettingStarted,CollapsibleSection}.vue`, `RehearseAudioPlayerBar.vue`, `functions/src/{params,index,adminEmail,inviteOnboarding,volunteerLink}.ts`, `firebase.json`, `.firebaserc`, `storage-cors.json`, `vite.config.ts`, tsconfig files, `src/__tests__/*`

### Secondary (MEDIUM confidence)
- Chrome Window Management docs — https://developer.chrome.com/docs/capabilities/web-apis/window-management (persisted grants; per-origin scope not stated)
- `.planning/codebase/ARCHITECTURE.md` § Automatic Fullscreen content setting

### Tertiary (LOW confidence)
- Chrome bounce-tracking mitigation behaviour (A9); OAuth JavaScript-origin non-involvement in popup flow (A2) — training knowledge

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; tool versions read locally
- Architecture: HIGH — boot order and reserved-path behaviour verified from library source and live requests
- Pitfalls: HIGH for `.env` override, router snapshot, header-test breakage, target-less predeploy; MEDIUM for Chrome/OAuth specifics

**Research date:** 2026-10-27
**Valid until:** 2026-11-26 (stable platform behaviour; re-check firebase-tools target/hosting semantics if CLI major version changes)
