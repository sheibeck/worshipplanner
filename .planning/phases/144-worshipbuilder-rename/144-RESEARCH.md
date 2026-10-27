# Phase 144: WorshipBuilder Rename - Research

**Researched:** 2026-10-27
**Domain:** Copy-only string rename (Vue SFC text nodes, `index.html`, three Cloud Functions email modules) plus a regression-guard test
**Confidence:** HIGH (every claim below was checked against the repo this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Brand is **"WorshipBuilder"** — one word, capital W and B — on every surface: `index.html` `<title>`, `App.vue`, `AppSidebar.vue`, `AppShell.vue`, `LoginView`, `SelectChurchView`, `VolunteerSignInView`, `VolunteerRequestView`, `VolunteerLinkCompleteView`, footers ("Shared from WorshipBuilder" on `ShareView` x2 + `QuarterShareView`; "Generated from WorshipBuilder" on `ServicePrintLayout` + `RosterPrintLayout`).
- Email copy: every subject and body that names the app says WorshipBuilder — `functions/src/adminEmail.ts`, `functions/src/inviteOnboarding.ts`, `functions/src/volunteerLink.ts` (and tests `functions/src/adminEmail.test.ts`, `functions/src/index.test.ts`).
- NOT renamed: `src/utils/claudeApi.ts` "The worship planner applies the 1-2-3 paradigm…" (names the person); code comments/symbols mentioning WorshipPlanner (`pcSongImport.ts`, `roster.ts`, `ServiceEditorView.vue` comment); email **From** display name (`fromDisplayName`); favicon/logo (no PWA manifest); Firebase project id, `wp`-prefixed localStorage keys, `package.json` name, repo name.
- No deploy in this phase; ships with Phase 145's coordinated, owner-confirmed deploy (functions need a fresh `functions/lib` build and every function re-exported from `functions/src/index.ts`).
- Console-side names (Firebase public-facing name, OAuth consent-screen name) are Phase 145 runbook steps, not done here.

### Claude's Discretion
- Constant vs. edit each literal (prefer a constant only if it adds no churn to the 14 UI files; tests must assert rendered text either way).
- Add a regression guard (grep-style test) that fails if "Worship Planner" / "WorshipPlanner" reappears in user-facing source.

### Deferred Ideas (OUT OF SCOPE)
- Switching Auth `authDomain` so Google's account chooser names the new domain (backlog 999.14).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R446 | App name in the web app reads WorshipBuilder (tab title, shell/sidebar, login/church-picker, volunteer pages, "Shared from"/"Generated from" footers); internal identifiers untouched | Inventory U1-U14 verified (below); guard test + rendered assertions |
| R447 | Every outbound email naming the app says WorshipBuilder in subject and body | Inventory E1-E12 verified; existing + new functions test assertions |
</phase_requirements>

## Summary

The UI-SPEC inventory is **accurate and complete**. A case-insensitive repo-wide grep for `worship ?planner` (excluding `.planning`, `node_modules`, `functions/lib`, `docs`) returns exactly: the 14 UI literals U1-U14, the 12 email literals E1-E12 (adminEmail.ts L42,43,45,56,58,59,61; inviteOnboarding.ts L80,85,97,100; volunteerLink.ts L77), the two functions test assertions T1/T2 (`adminEmail.test.ts` L78, L97), the `index.test.ts` fixture (L5751/5757/5767), and the documented non-renames (3 code comments, `claudeApi.ts` lowercase prose, `package.json`/lockfile `name`). Nothing is assembled dynamically (no `'Worship' + 'Planner'`, no template interpolation of an app-name variable) and no other module (`params.ts`, `orgTemplateSeed.ts`, `index.ts`, `appConfig.ts`) contains the old name. `public/`, `firebase.json`, `storage.rules`, `firestore.rules` have no hits.

Two things the UI-SPEC does not say that planning needs: (a) the **root** `npx vitest run` ALSO collects `functions/src/*.test.ts` (only `functions/lib/**` is excluded in `vite.config.ts`) — they pass under both runners (verified: the 3 email suites, 29 tests, pass at root and in `functions/`); (b) only 6 of the 14 UI sites have a view/component test file already, so the guard test must carry the coverage for the rest.

**Primary recommendation:** Edit each literal in place (no constant), update T1/T2/T3, add one assertion each to the inviteOnboarding and volunteerLink tests, add `src/brandName.test.ts` (negative scan + positive per-file table), and add rendered-text assertions to the existing mounted view/component tests. Do not touch `functions/lib` (gitignored build output).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Brand text on screen | Browser / Client (Vue SFC templates, `index.html`) | — | Static text nodes in templates |
| Brand text in emails | API / Backend (Cloud Functions email builders) | — | Subject/body assembled server-side in three modules |
| Regression guard | Test tooling (root vitest, reads source files) | — | Static source scan; no runtime tier |

## Standard Stack

No new packages. Phase is edits plus tests using the existing toolchain: Vitest (root `vitest` 4.0.x, jsdom; `functions/` vitest `^4.1.10`, node), `@vue/test-utils`, `node:fs`/`node:path`. No Package Legitimacy Audit needed (nothing installed).

## Architecture Patterns

### Edit pattern
Replace only the brand token inside each existing literal; never touch class attributes or interpolations (`${orgName}`, `${to}`, `${baseUrl}`). Follow the UI-SPEC Copywriting Contract tables line by line.

### Test pattern for the regression guard (answers Q2)
- Location `src/brandName.test.ts` — matches root default include and is not excluded by `vite.config.ts` (`exclude`: `src/rules.test.ts`, `**/node_modules/**`, `functions/lib/**`, `render-service/**`). Runs under plain `npx vitest run`.
- File access: follow the existing precedent `src/__tests__/firebaseHostingHeaders.test.ts` — `import { readFileSync } from 'node:fs'` and `resolve(process.cwd(), …)` (cwd = repo root under the root runner; works in jsdom env). Do NOT use `--dir src`.
- Enumerate `src/**/*.vue` and `src/**/*.ts` (exclude `*.test.ts`, `__tests__/`) with `readdirSync(dir, { recursive: true })` (Node 22; project requires node 22 in functions engines) or a tiny recursive walker; plus explicit files `index.html`, `functions/src/adminEmail.ts`, `functions/src/inviteOnboarding.ts`, `functions/src/volunteerLink.ts`.
- Strip comments before matching, rather than only skipping line-leading markers: remove `/\*[\s\S]*?\*/`, `<!--[\s\S]*?-->`, and whole-line `^\s*//.*$` (multiline flag). Do not strip mid-line `//` (breaks URLs).
- Negative assertion: case-sensitive `/Worship ?Planner/` must have zero matches in the comment-stripped text. Because it is case-sensitive, `claudeApi.ts` ("worship planner", lowercase) and the email-address domain `worshipplanner.app` already do not match — no file-level allow-list is needed; document that in a one-line test comment. (Comments in `roster.ts:196`, `pcSongImport.ts:291`, `ServiceEditorView.vue:4068` are removed by the stripper — verified they are `//` / ` *` comment lines.)
- Also assert no wrong-brand variants: `/Worship[ -]Builder/` (space/hyphen) zero matches.
- Positive table: a `[file, expected literal]` list for U1-U14 and E1-E12 asserting `toContain('WorshipBuilder')` (or the full phrase), so a revert or a typo like "Worshipbuilder" fails. This covers the 5 sites with no existing test (see below) without mounting components.
- Scope note: src non-test sources are currently clean after stripping aside from the 14 UI literals, so scanning all `src/**/*.vue|ts` is safe and broader than the UI-SPEC minimum (which lists only `*.vue`); recommend the broader scan.

### Anti-Patterns to Avoid
- **Global find/replace of `WorshipPlanner`/`worshipplanner`:** would hit `package.json` name, lockfile, the `noreply@worshipplanner.app` fixture address (Phase 145), `claudeApi.ts` prose, and comments. Edit by the inventory only.
- **Hand-editing `functions/lib/*`:** gitignored build output (verified `git check-ignore functions/lib`); contains stale compiled copies including `.test.js`. Regenerated by `cd functions && npm run build` (`tsc`) at deploy time in Phase 145. Excluded from root vitest.
- **Constant for brand:** `index.html` cannot consume one and it adds an import to 14 files; locked recommendation is no constant.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive file listing for the guard | Custom glob engine | `readdirSync(dir, { recursive: true })` (Node 22) or a 6-line walker | Trivial; no new dependency (no `glob` package) |
| Comment stripping | Parser | The three regexes above | Sufficient for this repo's current content; guard is a tripwire, not a linter |

## Common Pitfalls

### Pitfall 1: Brittle assertion on the wrong test runner
**What goes wrong:** Verifying only with `cd functions && npm test` and missing that the root run collects the same files under jsdom (or vice versa).
**How to avoid:** Run both: `cd functions && npx vitest run` (node env, authoritative) and root `npx vitest run`. Both pass today for the email suites.

### Pitfall 2: Changing the fixture email address in `index.test.ts`
**What goes wrong:** T3 fixture is `"Worship Planner <noreply@worshipplanner.app>"`; replacing the whole string drifts the address and conflicts with the Phase 145 domain work.
**How to avoid:** Change only the display-name token: `"WorshipBuilder <noreply@worshipplanner.app>"`, `not.toContain("<WorshipBuilder")`, and the comment at L5751. Expected `from` (`"Test Church" <noreply@worshipplanner.app>`) stays byte-identical. (This fixture is a legacy decorated `fromAddress` stored in Firestore config; it does not feed any user-visible copy, so the change is cosmetic consistency — still follow the UI-SPEC.)

### Pitfall 3: Stale compiled `functions/lib` mistaken for source
**What goes wrong:** Greps/tests over `functions/lib` still show "Worship Planner" and look like missed edits.
**How to avoid:** Exclude `lib/` from every check; the guard reads `functions/src` only.

### Pitfall 4: Guard matching its own source
**What goes wrong:** `src/brandName.test.ts` contains the literal `Worship Planner` in its regex/messages and would be scanned.
**How to avoid:** The guard walk excludes `*.test.ts` and `__tests__`; additionally build the regex from split pieces or put the old-name literal only in a regex (test files are not scanned anyway).

### Pitfall 5: Mismatched assertion style in email tests
**What goes wrong:** `adminEmail.test.ts:97` asserts `toContain("Sign in to Worship Planner")` for the "added" kind with blank base URL; E2 changes that to `"Sign in to WorshipBuilder"`. Subject assertion at :78 is `toBe(...)` exact — must match E4 verbatim.

## Code Examples

### Guard skeleton (pattern from `src/__tests__/firebaseHostingHeaders.test.ts`)
```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = process.cwd()
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '')

function userFacingFiles(): string[] {
  const src = readdirSync(resolve(root, 'src'), { recursive: true, encoding: 'utf8' })
    .map((f) => join('src', f))
    .filter((f) => /\.(vue|ts)$/.test(f) && !/\.test\.ts$/.test(f) && !f.includes('__tests__'))
  return ['index.html', 'functions/src/adminEmail.ts',
    'functions/src/inviteOnboarding.ts', 'functions/src/volunteerLink.ts', ...src]
}

describe('R446/R447 brand name', () => {
  it('no "Worship Planner"/"WorshipPlanner" in user-facing source', () => {
    const offenders = userFacingFiles().filter((f) =>
      /Worship ?Planner/.test(strip(readFileSync(resolve(root, f), 'utf8'))))
    expect(offenders).toEqual([])
  })
})
```

## Tests to change / add (answers Q1, Q3)

**Functions (own config `functions/vitest.config.ts`: node env, `include: src/**/*.test.ts`; command `cd functions && npx vitest run` or `npm test`; baseline 3 email suites = 29 tests pass):**

| File | Change |
|------|--------|
| `functions/src/adminEmail.test.ts` L78 (`toBe` exact subject), L97 | T1/T2 per UI-SPEC |
| `functions/src/index.test.ts` L5751, 5757, 5767 | T3 (token only; keep address) |
| `functions/src/inviteOnboarding.test.ts` | Add brand assertions: google-notify test (~L282, `arg` has `text` only — extend cast to include `subject`) assert `subject` `toBe("You've been invited to <org> on WorshipBuilder")` and `text` contains `on WorshipBuilder`; set-password test (~L334) likewise. Org name comes from the `seedOrg` fixture — read it for the exact string. No existing assertion mentions the old name. |
| `functions/src/volunteerLink.test.ts` ~L101 | Add `expect(sendArgs.text).toContain("on WorshipBuilder")` (E12; subject names no app — leave existing subject assertions, esp. `not.toMatch(/invited/i)`). |

**Root app suite — existing tests that mount the affected components** (all mount real SFCs; none currently assert old name; no snapshots anywhere):
`src/components/__tests__/AppSidebar.test.ts` (U3), `AppShell.test.ts` (U4), `ServicePrintLayout.test.ts` (U13), `src/views/__tests__/LoginView.test.ts` (U5), `SelectChurchView.test.ts` (U6), `VolunteerRequestView.test.ts` (U8), `VolunteerLinkCompleteView.test.ts` (U9), `ShareView.test.ts` (U10/U11), `QuarterShareView.test.ts` (U12). Add `expect(wrapper.text()).toContain('WorshipBuilder')` (or `Shared from WorshipBuilder` / `Generated from WorshipBuilder`) in each — one new `it` per file; reuse the file's existing mount helper and mocks (ShareView has a `mount(ShareView)` helper at ~L103; ShareView L30 vs L149 are two different template branches — check which state each needs, or rely on the positive guard for the second).
**No test file exists** for `App.vue` (U2), `VolunteerSignInView.vue` (U7), `RosterPrintLayout.vue` (U14), `index.html` (U1): covered by the guard's positive table; do not create new mount harnesses for them (App.vue pulls router/auth/Firebase).

## Runtime State Inventory

Rename is copy-only; internal identifiers are explicitly unchanged.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Firestore app config may hold a legacy decorated `sender.fromAddress` ("Worship Planner <…>") — not read for user copy (From display name is the org name; `bareEmailAddress` peels it) | None |
| Live service config | None in repo; Firebase/OAuth console names deferred to Phase 145 runbook | None here |
| OS-registered state | None — verified by grep, no scheduler/pm2 refs | None |
| Secrets/env vars | None reference the display name; `wp` storage keys and project id unchanged | None |
| Build artifacts | `functions/lib/*` (gitignored) holds stale compiled "Worship Planner" strings | Rebuild `cd functions && npm run build` at Phase 145 deploy; never hand-edit |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | all tests | yes | repo-standard | — |
| Vitest (root and `functions/`) | tests | yes (functions v4.1.10 verified) | — | — |
| Firebase emulator | not needed | n/a | — | — |

Missing dependencies: none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (root 4.0.x jsdom; `functions/` 4.1.10 node) |
| Config file | `vite.config.ts` (root `test` block); `functions/vitest.config.ts` |
| Quick run command | `npx vitest run src/brandName.test.ts` ; `cd functions && npx vitest run src/adminEmail.test.ts src/inviteOnboarding.test.ts src/volunteerLink.test.ts` |
| Full suite command | `npx vitest run` (baseline: only `src/storage.rules.test.ts` fails) and `cd functions && npx vitest run`; type gate `npm run type-check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R446 | No old name in user-facing src; each of U1-U14 contains WorshipBuilder | guard (static scan) | `npx vitest run src/brandName.test.ts` | Wave 0 (new) |
| R446 | Rendered brand text in sidebar/shell/login/church-picker/volunteer/share/print | component | `npx vitest run src/components/__tests__/AppSidebar.test.ts src/components/__tests__/AppShell.test.ts src/components/__tests__/ServicePrintLayout.test.ts src/views/__tests__/LoginView.test.ts src/views/__tests__/SelectChurchView.test.ts src/views/__tests__/VolunteerRequestView.test.ts src/views/__tests__/VolunteerLinkCompleteView.test.ts src/views/__tests__/ShareView.test.ts src/views/__tests__/QuarterShareView.test.ts` | exist (add assertions) |
| R447 | Admin invite/added subject+body | unit | `cd functions && npx vitest run src/adminEmail.test.ts` | exists (T1/T2) |
| R447 | Invite onboarding (google-notify, set-password) subject+body | unit | `cd functions && npx vitest run src/inviteOnboarding.test.ts` | exists (add) |
| R447 | Volunteer magic-link body | unit | `cd functions && npx vitest run src/volunteerLink.test.ts` | exists (add) |
| R446/R447 | Non-renames intact (project id, `wp` keys, address domain) | review / grep | `git diff --stat` shows no `package.json`, `firebase*.json`, `.firebaserc`, `functions/lib` changes | n/a |

### Sampling Rate
- **Per task commit:** the quick command relevant to the files touched
- **Per wave merge:** root `npx vitest run` + `cd functions && npx vitest run` + `npm run type-check`
- **Phase gate:** all three green (root baseline excepting `src/storage.rules.test.ts`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/brandName.test.ts` — guard + positive table (R446/R447)
- No framework install needed. Do NOT run with `--dir src` (bypasses excludes).

## Security Domain

`security_enforcement` is not set to false (absent = enabled); applicable surface is negligible.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3/V4 | no | Auth, sessions, access control untouched (project id and sign-in identifiers unchanged) |
| V5 Input Validation | no | No new input; email strings only change a static token |
| V6 Cryptography | no | None |

Threat note: the only behavioral risk is a rename accidentally touching identifiers (Firebase project id, `wp` storage keys, `authDomain`, From address domain), which would break sign-ins/saved settings — mitigated by editing only the inventoried literals. Email header injection is not newly introduced: the changed strings are static text; `orgName` interpolation is pre-existing and unchanged.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `readdirSync(..., { recursive: true })` is available in the Node version running root tests (Node 22 per functions engines; Node >= 18.17/20.1 supports it) | Test pattern | Guard fails to load; fall back to a manual walker |

All other claims were verified by grep/run in this session.

## Open Questions

None blocking. Minor: confirm the exact org-name fixture string in `inviteOnboarding.test.ts` `seedOrg` when writing the subject assertion (read at plan/execute time).

## Sources

### Primary (HIGH confidence)
- Repo grep (case-insensitive `worship ?planner`) across source; `functions/vitest.config.ts`; `vite.config.ts` test excludes; `src/__tests__/firebaseHostingHeaders.test.ts` (file-read precedent); test runs of `adminEmail`/`inviteOnboarding`/`volunteerLink` suites under both runners (29 pass); `git check-ignore functions/lib`; `npx vitest list --filesOnly` (root collects `functions/src/*.test.ts`).
- `144-CONTEXT.md`, `144-UI-SPEC.md`, `REQUIREMENTS.md` R446-R447.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps
- Architecture/inventory: HIGH — grep-verified, matches UI-SPEC exactly
- Pitfalls: HIGH — observed in repo config

**Research date:** 2026-10-27
**Valid until:** 2026-11-26 (stable; invalidated only if new "Worship Planner" copy lands before execution — the guard catches it)
