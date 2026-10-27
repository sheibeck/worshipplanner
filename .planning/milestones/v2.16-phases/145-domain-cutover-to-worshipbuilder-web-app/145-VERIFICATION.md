---
phase: 145-domain-cutover-to-worshipbuilder-web-app
verified: 2026-10-27T19:00:00Z
status: human_needed
score: 5/5 automatable roadmap success criteria verified (SC4 descoped, consistently)
behavior_unverified: 0
overrides_applied: 0
re_verification: false
gaps: []
human_verification:
  - test: "Runbook Steps 1-2: re-apply Storage CORS from storage-cors.json, then add worshipbuilder.firebaseapp.com to Auth authorized domains"
    expected: "describe shows five origins afterwards; authorized-domains list shows worshipbuilder.web.app + worshipbuilder.firebaseapp.com plus the old entries and localhost"
    why_human: "Production writes (gcloud + Firebase console). Owner-confirmed per deploy; batched to v2.16 milestone-end UAT, PENDING (not owner-accepted)."
  - test: "Runbook Step 3: firebase deploy --only hosting:app, then the four curl checks"
    expected: "200 text/html on / and /services/smoke-check, no-cache header, 401 (not SPA HTML) on /api/esv/v3/passage/text/"
    why_human: "Production deploy; confirms the app block + /api/** rewrite on the real worshipbuilder site."
  - test: "Runbook Step 4: firebase deploy --only functions, after the owner edits the local functions/.env SERVICE_SHARE_BASE_URL line"
    expected: "A fresh invite/test message has links starting https://worshipbuilder.web.app. NOTE: functions/.env (gitignored, not touched by this phase) currently still carries the OLD base URL, and a value there overrides the new code default at deploy, so the R449 default is not effective in production until the owner makes that edit (runbook Step 0 covers it with a status-only check)."
    why_human: "Production deploy plus a local secret-bearing file the phase is forbidden to edit."
  - test: "Runbook Step 5: new-domain smoke test (Google popup sign-in, password sign-in, fresh volunteer magic link, song upload + download Save dialog, share link)"
    expected: "All succeed on https://worshipbuilder.web.app before the redirect is enabled. If Google sign-in shows an origin error, add https://worshipbuilder.web.app to the OAuth Web client's Authorized JavaScript origins (research assumption A2, unverified)."
    why_human: "Real OAuth/email/Storage CORS flows; cannot be exercised without production."
  - test: "Runbook Step 6: firebase deploy --only hosting:legacy, then the curl checks"
    expected: "302 Location keeps path and query (/, /share/smoke-check?x=1&y=2, /services/smoke-check/); /__/auth/handler 200 text/html and /__/firebase/init.json 200 application/json still served on worship-planner-bc515.firebaseapp.com; record the ?y=a%2Fb result (a%252Fb would mean production re-encodes). Browser check: old share link with #top lands on the same path+query+hash."
    why_human: "Production Hosting behavior (reserved /__/* precedence over redirects, query preservation) was proven only in the local Hosting emulator; the Plan 01 backstop truth defers confirmation to this step. Hash preservation relies on RFC 9110 browser behavior."
  - test: "Runbook Step 7: on each Run computer re-sign-in, re-select church, re-create Run monitor setup and video key color, re-grant Window management and Automatic Fullscreen"
    expected: "Run fullscreen works on the new origin"
    why_human: "Per-origin browser state and OS/browser permissions."
  - test: "Runbook Rollback understanding / dry read, and end-to-end runbook walk on cutover day"
    expected: "Owner can follow the order, and the rollback (console Roll back or hosting:clone) restores 200 text/html on the old address. Note the runbook warns firebase.json still holds the redirect after a rollback."
    why_human: "Owner process; cannot be proven by tests."
---

# Phase 145: Domain Cutover to worshipbuilder.web.app Verification Report

**Phase Goal:** The app lives at `https://worshipbuilder.web.app`: it is served, linked and allowlisted there. Every old address keeps working by sending people to the same page on the new domain. The owner has an ordered runbook for the owner-gated production cutover (R452 settings carry-over descoped by the owner 2026-10-27).
**Verified:** 2026-10-27
**Status:** human_needed
**Re-verification:** No, initial verification

All automatable must-haves hold in the codebase and every gate is green. The goal is a production cutover that this phase deliberately does not perform, so what remains is owner-run production verification (below), not a code gap.

## Goal Achievement

### Observable Truths (ROADMAP success criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | SC1 / R448: hosting deploy publishes the app to worshipbuilder.web.app as the single app target with `/api/**` -> `api`, SPA fallback and cache headers; docs name it | VERIFIED (config + docs) | `firebase.json` `hosting` is an array of two blocks; block `app` has public `dist`, predeploy `npm run build`, rewrites `/api/**`->function `api` then `**`->`/index.html`, unchanged `**` no-cache and `/assets/**` immutable headers. `.firebaserc` maps `app`->`worshipbuilder`, `legacy`->`worship-planner-bc515`, default project unchanged. `.planning/codebase/INTEGRATIONS.md` L94-107 names `hosting:app` / `hosting:legacy` and warns off a target-less hosting deploy. `firebaseHostingTargets.test.ts` (30) + `firebaseHostingHeaders.test.ts` (3, reads `loadHostingBlock('app')`) pass. Actual publish: production, see human items. |
| 2 | SC1 / R449: every generated link points at the new origin; no hard-coded old-domain URL in app/function code | VERIFIED | `functions/src/params.ts` L24-26: `SERVICE_SHARE_BASE_URL` default `https://worshipbuilder.web.app`. `functions/src/params.test.ts` pins it; one-slash tests added in adminEmail/inviteOnboarding/volunteerLink/index tests. Repo-wide grep for the old origins outside tests/docs/ignored files: only `storage-cors.json` (intended old origins) and the doc/ADR prose; none in `src/` or `functions/src` non-test code. `legacyOriginLiterals.test.ts` (3, with self-test) passes. Builders untouched; client-side builders carry no old literal. Caveat: the owner's gitignored `functions/.env` still carries the old base URL and overrides the default at deploy; the runbook Step 0 has the required fix + status-only check (human item). |
| 3 | SC2 / R450: allowlists include the new domain before cutover (Storage CORS, authorized domain) | VERIFIED (file side) / human (apply) | `storage-cors.json` lists exactly five origins: the two old, `http://localhost:5173`, `https://worshipbuilder.web.app`, `https://worshipbuilder.firebaseapp.com`; `storageCors.test.ts` (4) asserts set-equality, no `*`, no blank, no trailing slash. Applying to the bucket and adding the authorized domain are runbook Steps 1-2 (production, owner-gated). |
| 4 | SC3 / R451: old addresses send every request to the same path, query and hash on the new domain; reserved `/__/*` paths excepted and still served | VERIFIED (config + model) / production unverified | `firebase.json` legacy block keys are exactly target/public/ignore/redirects; two type-302 regex rules (`^/$` and `^/((?:[^_]|_(?:[^_]|$)).*)$`) to the constant `https://worshipbuilder.web.app/`; no rewrite/predeploy/header/cleanUrls/i18n. `legacy-site/index.html` is a static noindex page with no script and no old-origin host. `firebaseHostingTargets.test.ts` evaluates the regexes: `/`, `/services/abc/` (trailing slash kept), `//evil.com/x` stay on the new origin; `/__/auth/handler`, `/__/auth/iframe`, `/__/auth/action`, `/__/firebase/init.json`, `/__` return no redirect. Query/hash preservation and reserved-path precedence in production are the Plan 01 `backstop` truth, confirmed only by runbook Step 6 (human item). |
| 5 | SC4 / R452: settings carry-over | DESCOPED, consistent | Owner decision 2026-10-27. REQUIREMENTS.md L96 strikethrough with "Descoped 2026-10-27 (owner decision)", traceability row `R452 | Phase 145 | Descoped (owner, 2026-10-27)`, counts "Descoped: 1 ... 12 active", phase line "R452 descoped"; ROADMAP Phase 145 requirements line and SC4 strikethrough with descope note; STATE.md L23; ADR-0247 L11/L16; runbook states nothing is carried and Step 7 re-sets once. No originHandoff/bridge/legacy-build code exists (legacy block has no predeploy or rewrite). Not silently dropped. |
| 6 | SC5 / R453: ordered owner runbook (allowlists, deploy order, not during a service, one-time sign-in, window-placement re-grant, optional renames, rollback, smoke checklist) | VERIFIED (document) / human (owner walk) | `docs/runbooks/worshipbuilder-cutover.md`: Step 0 pre-flight (quiet CRLF-tolerant status-only authDomain and `functions/.env` checks, Bash + PowerShell) -> Step 1 CORS -> Step 2 authorized domain -> Step 3 `hosting:app` (+ bare-deploy warning, WR-01) -> Step 4 functions + new-origin link check -> Step 5 new-domain smoke -> Step 6 `hosting:legacy` with `/__/*` and `%{redirect_url}` curls -> Step 7 per-person/Run computer -> Step 8 renames -> Rollback (console or `hosting:clone`; WR-03 armed-config warning + post-rollback check) -> post-cutover checklist. "Owner confirms before running" on every production step. `cutoverRunbook.test.ts` (17) guards order, command placement, quiet env checks, targeted-only deploy lines, and bans hand-off/carry/legacy-build wording. Post-execution review fixes WR-01/02/03 are present in the file (commits 7c722401, 56f85a1b, 71602d73). |
| 7 | ADR-0247 exists, is indexed, and every `docs/adr/0247-...` pointer in src/ and functions/src resolves | VERIFIED | File present; `docs/adr/README.md` L267 row; pointer grep over `src functions/src` prints exactly the one ADR filename. |
| 8 | Prohibition: no production change applied in this phase | VERIFIED by judgment (non-authoritative), flagged | Commit range `c59dab23..HEAD` touches only config, tests, docs, `legacy-site/`, planning files; no `.planning/graphs/`, `dist-legacy/`, `functions/lib/`, `functions/.env`. `git ls-files functions/.env` empty (ignored). Local `firebase-debug.log` (gitignored) shows only an emulator start with read-only GETs and a token exchange; no deploy/hosting write. A deploy leaves no git trace, so this stays `unverified-prohibition: human review recommended`. |
| 9 | Prohibition: legacy block has no rewrite/predeploy/header/cleanUrls/trailingSlash/i18n and no redirect matches `/__`; no old origins removed from CORS | VERIFIED | Direct read of `firebase.json` and `storage-cors.json`, plus the test assertions above. |
| 10 | Prohibition: no `.planning/graphs/*`, `dist-legacy/`, `functions/lib/`, `functions/.env` staged or committed | VERIFIED | `git log --name-only c59dab23..HEAD` lists none of these. Working-tree-modified graph files are pre-existing and unstaged. |

**Score:** all automatable roadmap criteria verified; 0 PRESENT_BEHAVIOR_UNVERIFIED truths in the automatable set; the three `backstop` truths (production redirect behavior, deploy/allowlist order, end-to-end runbook walk) are routed to human verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `firebase.json` | two targeted hosting blocks | VERIFIED | Exact shape above; non-hosting blocks intact |
| `.firebaserc` | target->site mapping | VERIFIED | app->worshipbuilder, legacy->worship-planner-bc515 |
| `legacy-site/index.html` | static moved page | VERIFIED | noindex, link to new origin, no script |
| `functions/src/params.ts` | new default | VERIFIED | L25 |
| `storage-cors.json` | five origins | VERIFIED | |
| `docs/runbooks/worshipbuilder-cutover.md` | runbook | VERIFIED | substantive, ordered, test-guarded |
| `docs/adr/0247-...md` + README row | ADR | VERIFIED | |
| `.planning/codebase/INTEGRATIONS.md` | targeted deploy docs | VERIFIED | |
| `functions/DEPLOY-EMAIL-DOMAIN.md` | default + .env override note | VERIFIED | L67 area |
| Tests: firebaseHostingTargets, firebaseHostingHeaders, storageCors, legacyOriginLiterals, cutoverRunbook, functions params.test | guards | VERIFIED | all pass, not stubs (executors proved RED then GREEN) |

### Key Link Verification

| From | To | Status | Details |
| ---- | -- | ------ | ------- |
| firebaseHostingTargets.test.ts | firebase.json / .firebaserc | WIRED | reads and parses both; evaluates the redirect regexes |
| legacy block | legacy-site/index.html | WIRED | `public: legacy-site` |
| params.test.ts | params.ts | WIRED | captures `defineString` |
| legacyOriginLiterals.test.ts | src/, functions/src, index.html | WIRED | recursive scan with self-test |
| cutoverRunbook.test.ts | runbook | WIRED | section/fence parser |
| source ADR pointers | ADR-0247 | WIRED | grep resolves |

### Data-Flow Trace (Level 4)

Not applicable: no dynamic-data-rendering artifacts in this phase (config, docs, tests, one static page, one param default consumed by unchanged link builders).

### Behavioral Spot-Checks (Gates)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase tests | `npx vitest run` on the 6 phase/brand files | 6 files, 80 tests pass | PASS |
| Type gate | `npm run type-check` (vue-tsc --build) | exit 0 | PASS |
| Full app suite (run once, bare) | `npx vitest run` | 251 passed / 1 failed of 252 files; 6157 tests pass, 43 skipped; only `src/storage.rules.test.ts` failed (known baseline); no "Worker exited" crashes; 659 s | PASS (baseline) |
| Functions | `cd functions && npx vitest run` / `npx tsc --noEmit` | 20 files, 729 tests pass / exit 0 | PASS |
| Build | `npm run build` | built, exit 0 (env guard satisfied) | PASS |

### Probe Execution

None declared; SKIPPED (no probe scripts for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| R448 | 145-01, 145-03 | single `worshipbuilder` deploy target + docs | SATISFIED (publish pending owner) | firebase.json/.firebaserc/INTEGRATIONS.md |
| R449 | 145-02 | generated links on the new origin; no old literal | SATISFIED in code (owner `functions/.env` fix pending) | params.ts, scan test |
| R450 | 145-02, 145-03 | allowlists include new domain before cutover | SATISFIED file side; console/gcloud apply pending owner | storage-cors.json, runbook Steps 1-2 |
| R451 | 145-01, 145-03 | old addresses redirect to same path/query/hash | SATISFIED in config + model; production confirmation pending owner | firebase.json legacy block, Step 6 |
| R452 | none | settings carry-over | DESCOPED (owner 2026-10-27), consistently marked in REQUIREMENTS, ROADMAP, STATE, ADR, runbook | see truth 5 |
| R453 | 145-03 | owner cutover runbook | SATISFIED | runbook + guard test |

No orphaned requirements: REQUIREMENTS.md maps R448-R453 to Phase 145 and every ID appears in a PLAN `requirements` field or is explicitly descoped.

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX in any file the phase created or modified. Five Info items from 145-REVIEW.md (IN-01..IN-04 and one more) are advisory and out of scope; the three Warnings were fixed and re-reviewed clean.

### Human Verification Required

See frontmatter `human_verification` (7 items): CORS + authorized-domain apply, `hosting:app` deploy and curls, functions deploy with the `functions/.env` fix, new-domain smoke (Google/password/magic link/upload-download), `hosting:legacy` deploy with the Step 6 curl checks (302 Location, preserved query, reserved `/__/*`, `a%2Fb` record, hash in a browser), Run-computer re-grant, and a rollback/end-to-end runbook walk. These are batched to the v2.16 milestone-end owner UAT and remain PENDING, not owner-accepted.

### Gaps Summary

No automatable gaps. The phase built, tested and documented everything its scope covers (hosting split, new-origin links, CORS file, redirect with reserved-path safety, runbook, ADR) and deliberately applied nothing to production. Standing risk to surface at cutover: the unverified production behavior of the legacy redirect and the owner's local `functions/.env` override.

---

_Verified: 2026-10-27_
_Verifier: Claude (gsd-verifier)_
