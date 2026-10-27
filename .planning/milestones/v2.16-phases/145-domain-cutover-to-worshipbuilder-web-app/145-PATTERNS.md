# Phase 145: Domain Cutover - Pattern Map

**Mapped:** 2026-10-27
**Files analyzed:** 27 new/modified
**Analogs found:** 22 / 27 (the rest use RESEARCH.md code examples)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `firebase.json` (hosting -> array, 2 targets) | config | n/a | itself (current single block) | exact |
| `.firebaserc` (targets; produce via `firebase target:apply`) | config | n/a | itself | exact |
| `storage-cors.json` (+2 origins) | config | n/a | itself | exact |
| `functions/src/params.ts` (default URL) | config | n/a | itself L22-24 | exact |
| `functions/DEPLOY-EMAIL-DOMAIN.md` (L66 URL text) | doc | n/a | itself | exact |
| `.gitignore` (+`dist-legacy/`) | config | n/a | existing `dist/` line | exact |
| `package.json` (+`build:legacy`) | config | n/a | `"build-only": "vite build"` | exact |
| `vite.config.legacy.ts` | config | batch | `vite.config.ts` (minus env guards) | role-match |
| `src/legacy/index.html`, `src/legacy/main.ts` | entry (bridge) | transform | `index.html` / `src/main.ts` | partial |
| `src/originHandoff/allowlist.ts` | utility (validators) | transform | `src/utils/monitorConfig.ts` | exact |
| `src/originHandoff/codec.ts` | utility | transform | RESEARCH "Codec" example | no analog |
| `src/originHandoff/bridge.ts` | utility | request-response | RESEARCH Pattern 3 | no analog |
| `src/originHandoff/apply.ts` | service | file-I/O (localStorage) | `src/stores/auth.ts` L70-111 | role-match |
| `src/originHandoff/bootstrap.ts` | side-effect module | event-driven | none (new pattern) | no analog |
| `src/main.ts` (first import + toast) | entry | event-driven | itself + `useRunControl.ts:765-768` setSticky | exact |
| `src/utils/monitorConfig.ts` (export 2 predicates) | utility | transform | itself L118, L210 | exact |
| `src/__tests__/firebaseHostingHeaders.test.ts` (adapt; has a NUL byte) | test | config-shape | itself | exact |
| `src/__tests__/firebaseHostingTargets.test.ts` | test | config-shape | `firebaseFunctionsPredeploy.test.ts` | exact |
| `src/__tests__/storageCors.test.ts` | test | config-shape | `firebaseFunctionsPredeploy.test.ts` | exact |
| `src/__tests__/legacyOriginLiterals.test.ts` | test | source-scan | `src/__tests__/brandName.test.ts` | exact |
| `src/__tests__/cutoverRunbook.test.ts` | test | string-scan | `firebaseFunctionsPredeploy.test.ts` | role-match |
| `src/originHandoff/__tests__/{allowlist,apply,bridge,mainOrder}.test.ts` | test | unit | `src/utils/__tests__/monitorConfig.test.ts` | role-match |
| `src/originHandoff/__tests__/legacyBuild.test.ts` | test | build integration | none | no analog |
| `docs/runbooks/worshipbuilder-cutover.md` | doc | n/a | `functions/DEPLOY-EMAIL-DOMAIN.md`, `render-service/DEPLOY.md` | role-match |
| `docs/adr/0247-*.md` | doc | n/a | `docs/adr/0246-*.md` | exact |

## Pattern Assignments

### `src/__tests__/firebaseHostingTargets.test.ts` and `storageCors.test.ts` (test, config-shape)

**Analog:** `src/__tests__/firebaseFunctionsPredeploy.test.ts` (whole file, 15 lines)

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('firebase.json functions predeploy (Phase 144 WR-03)', () => {
  it('builds functions before every functions deploy', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf-8')) as {
      functions: Array<{ source: string; predeploy?: string[] }>
    }
    const fn = config.functions.find((f) => f.source === 'functions')
    expect(fn?.predeploy).toContain('npm --prefix functions run build')
  })
})
```

Reuse `resolve(process.cwd(), '<file>')` + `JSON.parse`. Assert for hosting:
- it is an array
- every block has `target`
- `app` has public `dist`, predeploy `npm run build`, and rewrites `/api/**`->function `api` then `**`->`/index.html`
- `legacy` has public `dist-legacy`, predeploy `npm run build:legacy`, rewrites exactly `/api/**` and `**`, and no `redirects`
- `.firebaserc` maps `app`->`worshipbuilder` and `legacy`->`worship-planner-bc515`
- the functions predeploy is retained (do not touch the existing test)

### `src/__tests__/firebaseHostingHeaders.test.ts` (adapt)

**Edit only `loadFirebaseConfig()`, lines ~7-20.** Current code:
```typescript
interface FirebaseHostingConfig { hosting: { headers?: FirebaseHeaderEntry[] } }
function loadFirebaseConfig(): FirebaseHostingConfig {
  const raw = readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf-8')
  return JSON.parse(raw) as FirebaseHostingConfig
}
```
Change it to find the block with `target === 'app'` and return `{ hosting: block }`. Add the same cache-header assertions against the `legacy` block.

The file has exactly one literal NUL byte, in `const PLACEHOLDER = '<NUL>'` inside `globToRegExp`. If Edit fails on it, rewrite the whole file as UTF-8 with `const PLACEHOLDER = '\u0000'`. The file's header comment already says Firebase matches header globs against the pre-rewrite request path (keep it).

### `src/__tests__/legacyOriginLiterals.test.ts` (test, source-scan)

**Analog:** `src/__tests__/brandName.test.ts`

Copy these pieces (lines 1-5, 45-95):
- the `walk` helper
- the `isTestPath` helper
- the `userFacingFiles` list
- the `read` helper
- the `stripJsComments` and `stripComments` helpers (comment-stripped scanning)

```typescript
const root = process.cwd()
function walk(dir: string): string[] {
  return readdirSync(resolve(root, dir), { recursive: true, encoding: 'utf8' }).map(
    (p) => `${dir}/${p.replace(/\\/g, '/')}`,
  )
}
function isTestPath(p: string): boolean {
  return /\.(test|spec)\.ts$/.test(p) || /(^|\/)(__tests__|__fixtures__|__mocks__)\//.test(p)
}
const userFacingFiles: string[] = [
  'index.html',
  ...walk('src').filter((p) => /\.(vue|ts)$/.test(p) && !isTestPath(p)),
  ...walk('functions/src').filter((p) => p.endsWith('.ts') && !isTestPath(p)),
]
describe('brand guard (R446/R447)', () => {
  it('...', () => {
    const offenders = userFacingFiles.filter((f) => hasOldName(f, read(f)))
    expect(offenders).toEqual([])
  })
```

For the new test, change the regex to `/worship-planner-bc515\.(web\.app|firebaseapp\.com)/`.

- The legitimate hits are `src/originHandoff/*` and `src/legacy/*` if they name the old host. Better to avoid naming it in code, since the bridge does not need to. If needed, use a file-scoped allowlist entry like the `ALLOWED` array (`{ file, phrase }`).
- Do not scan `storage-cors.json`.
- Also assert that `params.ts` contains `https://worshipbuilder.web.app`.

Mirror the `it.each(rows)` literal-count style for single-line assertions.

### `src/originHandoff/allowlist.ts` (validators)

**Analog:** `src/utils/monitorConfig.ts`

**Export these two predicates (additive).** Both are currently private.

`isValidMapping`, lines 118-137. Reuse as is; add your own caps (<=16 assignments, fingerprint <=200 chars):
```typescript
function isValidMapping(value: unknown): value is MonitorMapping {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { assignments?: unknown; savedAt?: unknown }
  if (!Array.isArray(v.assignments)) return false
  if (typeof v.savedAt !== 'number') return false
  return v.assignments.every((a) => { /* fingerprint string; role audience|confidence|video; nickname <= NICKNAME_MAX_LENGTH */ })
}
```

`isValidVideoKeyColor`, lines 210-216:
```typescript
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
function isValidVideoKeyColor(value: unknown): value is VideoKeyColor {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { enabled?: unknown; colorHex?: unknown }
  if (typeof v.enabled !== 'boolean') return false
  if (typeof v.colorHex !== 'string') return false
  return HEX_COLOR_PATTERN.test(v.colorHex)
}
```

Constants to import or mirror (not to rename):
- `MONITOR_CONFIG_STORAGE_KEY = 'wp:runMonitorConfig:v2'` (L52)
- `VIDEO_KEY_COLOR_STORAGE_KEY`
- `NICKNAME_MAX_LENGTH = 60`

**Note for the legacy bundle:** `src/legacy/main.ts` must not import `monitorConfig.ts` if that file pulls in non-trivial dependencies. The bridge only needs the key NAMES (allowlist.ts). Keep validators for the receiving side only, or split a `keys.ts` so the bridge bundle stays tiny and free of vue/firebase.

**Other keys** (shapes from RESEARCH inventory; no exported validators):

| Key | Source | Rule |
|---|---|---|
| `wp.selectedOrg.persist` | auth.ts L77 | `{uid, orgId}`, both `^[\w.-]{1,128}$`, rebuild via `JSON.stringify({uid, orgId})` |
| `volunteerSelectedChurch` | mySchedule.ts L28 | plain id string |
| `wp:tagFilter:v2:{org}:{uid}` | songs.ts L149 | `{include: string[], exclude: string[]}`, <=200 items, <=100 chars each |
| `wp:songTableColumns:v1:{org}:{uid}` | songs.ts L202 | only the 7 keys `category,key,ccli,lastUsed,tags,themes,files`, boolean values |
| `wp:gettingStartedDismissed` | GettingStarted.vue L91 | value must equal `'true'` |

**Denylist:** `emailForSignIn`, `firebase:*`, `wp.selectedOrg`, `rehearse-audio-position:*`, `wp:handoffDone:v1`, `__proto__`.

### `src/originHandoff/apply.ts` (storage write, fill-if-absent)

**Analog:** `src/stores/auth.ts` lines 70-111 (the selected-org persistence helpers)

Conventions to copy: every storage access is wrapped in its own `try/catch` with a one-line "not fatal" comment, and the parse is guarded.
```typescript
const SELECTED_ORG_LOCAL_KEY = 'wp.selectedOrg.persist'
function readRememberedOrg(uid: string): string | null {
  try {
    const raw = localStorage.getItem(SELECTED_ORG_LOCAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { uid?: string; orgId?: string }
    return parsed.uid === uid && typeof parsed.orgId === 'string' ? parsed.orgId : null
  } catch {
    return null
  }
}
function rememberOrg(uid: string, orgId: string): void {
  const payload = JSON.stringify({ uid, orgId })
  try { localStorage.setItem(SELECTED_ORG_LOCAL_KEY, payload) } catch {
    // localStorage unavailable — the new-tab fallback simply won't apply.
  }
}
```

Core loop: use RESEARCH "Receiving side core loop" (iterate `Object.entries(payload.k)`, `matchRule`, `validate`, `if (storage.getItem(key) === null) storage.setItem`).

Make `applyFragment(loc, storage, history)` take injected objects so jsdom tests can spy on `history.replaceState`.

### `src/main.ts` (modify) and `src/originHandoff/bootstrap.ts`

**Analog:** current `src/main.ts` (22 lines), and `src/composables/useRunControl.ts:765-768` for `setSticky` usage.

Current imports:
```typescript
import './assets/main.css'
import '@fontsource/inter/400.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
...
app.use(createPinia())
app.use(router)
app.mount('#app')
```

Required changes:
- Insert `import './originHandoff/bootstrap'` as the FIRST import. The `router` import snapshots `location` at module evaluation.
- After `app.use(createPinia())`, call `useToasts().setSticky('origin-handoff', {...})` only when the handoff result was consumed.

`setSticky` signature (`src/stores/toasts.ts:87`):
```typescript
function setSticky(key: string, opts: StickyOptions): string  // opts: {variant, heading, body, action?, link?}
```

It is keyed and idempotent. `ToastHost` is mounted once in `App.vue` (L22, import L28), so the toast also shows on /login.

Existing usage to mirror (`useRunControl.ts:765-768`):
```typescript
notifications.setSticky('monitor-reassign', { /* variant, heading, body */ })
```

Note: `main.ts` keeps its existing comment style (short, ADR/map-doc pointers, per CLAUDE.md). Add an ADR link comment rather than long prose.

`mainOrder.test.ts`: read `src/main.ts`, find the first non-comment `import` line, and assert it is `./originHandoff/bootstrap`.

### `vite.config.legacy.ts` and the `package.json` script

**Analog:** `vite.config.ts` (the env guard at L24-40 applies only when `command === 'build'` in that file). The legacy config must NOT import or copy the guard.

Use RESEARCH Pattern 4 verbatim. The file name matches `tsconfig.node.json`'s `vite.config.*` include, so it is type-checked.

`package.json` scripts, existing: `"build-only": "vite build"`. Add:
```
"build:legacy": "vite build --config vite.config.legacy.ts"
```

Also add `dist-legacy/` to `.gitignore`.

### `firebase.json` / `.firebaserc`

**Analog:** current `firebase.json` hosting block (L15-end), shown in the context above. Move the whole block into the array, add `"target": "app"`, then duplicate it as `legacy`. Keep the headers identical: `**` no-cache and `/assets/**` immutable.

The `functions` block is unchanged (`"predeploy": ["npm --prefix functions run build"]`).

Produce `.firebaserc` with:
```
firebase target:apply hosting app worshipbuilder
firebase target:apply hosting legacy worship-planner-bc515
```
Current `.firebaserc`: `{ "projects": { "default": "worship-planner-bc515" } }`.

### `storage-cors.json`

Current origin array (L3-7):
```json
"origin": [
  "https://worship-planner-bc515.web.app",
  "https://worship-planner-bc515.firebaseapp.com",
  "http://localhost:5173"
],
```
Append `https://worshipbuilder.web.app` and `https://worshipbuilder.firebaseapp.com`. Keep `method` as GET/HEAD and the other fields.

### `functions/src/params.ts`

Lines 22-24:
```typescript
export const SERVICE_SHARE_BASE_URL = defineString("SERVICE_SHARE_BASE_URL", {
  default: "https://worship-planner-bc515.web.app",
});
```
Change the default only. Keep the double-quote style of that file. Also fix the doc comment above (L15-21), which says "app's hosting domain".

### `docs/runbooks/worshipbuilder-cutover.md`

`docs/runbooks/` does not exist yet; create it.

**Analogs:** `functions/DEPLOY-EMAIL-DOMAIN.md` and `render-service/DEPLOY.md`. I read only the former.

Format to copy from `DEPLOY-EMAIL-DOMAIN.md`:
- Title: `# <Topic> — owner runbook (R###)`
- Opening `> ★★` blockquote stating what in the repo does and does not run commands (here: no commands are run by the repo; all production steps are owner-run)
- `## What this closes` section
- Horizontal-rule `---` separators between sections
- Ordered steps with exact commands, each marked "owner confirms before running"

Required strings (the `cutoverRunbook.test.ts` string-scan list from RESEARCH):
- `storage buckets update`
- `hosting:app`
- `hosting:legacy`
- `functions/.env`
- `hosting:clone`
- window-management re-grant
- "owner confirms"
- never during a service

Also include (CONTEXT Amendment):
- deploy order: functions/.env fix -> CORS and authorized domain -> `hosting:app` -> functions -> smoke -> `hosting:legacy`
- the `.env` check must print only whether the key matches the new origin, not other values
- reload of old tabs
- Automatic Fullscreen re-grant
- Google sign-in smoke test before the bridge deploy
- curl smoke commands for `/__/auth/handler` and `/__/firebase/init.json`
- a warning that `firebase deploy --only hosting` (no target) deploys both sites

### `functions/DEPLOY-EMAIL-DOMAIN.md`

Line ~66 names `https://worship-planner-bc515.web.app` as the hosting default. Update it to the new domain.

## Shared Patterns

### Defensive storage access
**Source:** `src/stores/auth.ts` L70-111, `src/utils/monitorConfig.ts`
**Apply to:** `apply.ts`, `bridge.ts`, `bootstrap.ts`

Every `localStorage` read, write and `JSON.parse` sits in its own `try/catch` that fails silently, with a short comment. Never throw during boot.

### Validate-then-rebuild
**Source:** `monitorConfig.ts` `isValidMapping` and `isValidVideoKeyColor` (T-114-01 and T-137-01 notes)
**Apply to:** every allowlist rule

Parse, validate, then re-`JSON.stringify` from whitelisted fields. Never pass the raw string through.

### Tests live in `__tests__/`
**Apply to:** all new tests

`tsconfig.vitest.json` includes only `src/**/__tests__/*`. Tests elsewhere are not covered by `npm run type-check`. The `legacyBuild` test needs `// @vitest-environment node`.

### Comment convention
**Source:** `CLAUDE.md` and `src/main.ts` style

Comments are short, with ADR pointers like `// See ADR-0143 (docs/adr/...)`. Rationale goes in a new ADR (0247, following 0246). Test headers use the `// R446/R447 brand guard. See ADR-0246 (...)` form.

### Always target hosting deploys
Use `--only hosting:app` and `--only hosting:legacy` in the runbook and any doc, never bare `hosting`.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `src/originHandoff/codec.ts` | utility | No base64url or fragment codec exists. Use RESEARCH "Codec" example (UTF-8 safe, `#wph1=`, 48 KiB cap). |
| `src/originHandoff/bridge.ts` | utility | No redirect builder exists. Use RESEARCH Pattern 3: constant origin plus string concat after collapsing leading `//`, never `new URL(path, base)`. |
| `src/originHandoff/bootstrap.ts` | side-effect module | No import-time side-effect module exists. Run `applyFragment` at import and export `takeHandoffResult()`. |
| `src/legacy/{index.html,main.ts}` | bridge entry | No second HTML entry exists. Keep a `<noscript>` link to the new origin and `<meta name="robots" content="noindex">`. Import only `originHandoff/{allowlist,codec,bridge}` (no vue/firebase/pinia). |
| `legacyBuild.test.ts` | integration test | No existing test runs a Vite build. Use the Vite JS API `build({ configFile: 'vite.config.legacy.ts', write: false })` and assert the output has the `<noscript>` link, the new-origin constant, and no `firebase` or `vue` strings. |

## Metadata

**Analog search scope:** `src/__tests__`, `src/utils`, `src/stores`, `src/main.ts`, `src/App.vue`, `vite.config.ts`, `package.json`, `firebase.json`, `.firebaserc`, `storage-cors.json`, `functions/src/params.ts`, `functions/DEPLOY-EMAIL-DOMAIN.md`

**Not read directly** (the RESEARCH.md inventory was used instead; the planner should open them when editing): `src/stores/songs.ts` L149/L202, `src/stores/mySchedule.ts` L28, `src/components/GettingStarted.vue` L91, and `render-service/DEPLOY.md`.

**Pattern extraction date:** 2026-10-27
