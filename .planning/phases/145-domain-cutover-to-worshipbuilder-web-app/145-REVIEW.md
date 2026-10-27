---
phase: 145-domain-cutover-to-worshipbuilder-web-app
reviewed: 2026-10-27T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - .firebaserc
  - docs/adr/0247-app-home-is-worshipbuilder-web-app-old-addresses-redirect.md
  - docs/adr/README.md
  - docs/runbooks/worshipbuilder-cutover.md
  - firebase.json
  - functions/DEPLOY-EMAIL-DOMAIN.md
  - functions/src/adminEmail.test.ts
  - functions/src/index.test.ts
  - functions/src/inviteOnboarding.test.ts
  - functions/src/params.test.ts
  - functions/src/params.ts
  - functions/src/volunteerLink.test.ts
  - legacy-site/index.html
  - src/__tests__/cutoverRunbook.test.ts
  - src/__tests__/firebaseHostingHeaders.test.ts
  - src/__tests__/firebaseHostingTargets.test.ts
  - src/__tests__/legacyOriginLiterals.test.ts
  - src/__tests__/storageCors.test.ts
  - storage-cors.json
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 145: Code Review Report

> Written by the gsd-code-reviewer agent (sonnet, standard depth, diff base `c59dab23`). The agent's harness
> forbids it writing report files, so the orchestrator saved its returned report verbatim here.

## Summary

The redirect config, `.firebaserc` targets, CORS file, share-link default and trailing-slash tests are correct as
written. The findings concern operator safety in the runbook and test quality.

1. **Open redirect / wrong URL.** None. The destination host is the literal `https://worshipbuilder.web.app`, so
   `//evil.com/x` and `/@evil.com` stay on the new origin. `//x` yields a double slash in the destination path
   (IN-02). The query string is not in the destination; it relies on Hosting appending it, which runbook Step 6
   verifies in production.
2. **`/__/*` reachability.** Not redirected. `^/((?:[^_]|_(?:[^_]|$)).*)$` rejects `/__`, `/__/auth/handler`,
   `/__/firebase/init.json` and accepts `/_`, `/_x`, `/`. `^/$` is needed because the catch-all needs at least one
   character after the slash. The guard test covers these paths.
3. **`firebase.json` validity.** Valid for `--only hosting:app` and `--only hosting:legacy` (both blocks carry a
   `target`; `.firebaserc` maps both). The bare-deploy warning is incomplete (WR-01).
4. **Runbook commands.** Env checks are `grep -q` / `Select-String -Quiet` (status line only, no secret value);
   the `[[:space:]]*$` anchor tolerates CRLF; the CORS command targets
   `gs://worship-planner-bc515.firebasestorage.app`; `storage-cors.json` has the five expected origins;
   `firebase hosting:clone worshipbuilder:live worship-planner-bc515:live` is correct syntax.
5. **Guard tests fail on the regressions they claim to guard?** Yes, with caveats (IN-01, IN-02).
6. **Functions.** `resolveServiceLink`, `rehearseActionCodeSettings`, `adminEmail`, `inviteOnboarding` and
   `volunteerLink` all strip trailing slashes, so the new tests fail if stripping is removed. The `params.test.ts`
   default assertion is real (it checks the `defineString` call arguments).

## Warnings

### WR-01: Bare-deploy warning is narrower than the real hazard

**File:** `docs/runbooks/worshipbuilder-cutover.md:94` (also `docs/adr/0247-...md:15`)
**Issue:** With a two-block `hosting` array, both `firebase deploy --only hosting` and a plain `firebase deploy`
publish the `legacy` redirect; a plain `firebase deploy` also ships firestore rules, storage rules and functions.
The runbook says only "Never use a bare hosting deploy" and the ADR only that `--only hosting` is never used —
plain `firebase deploy` is named in neither. `--only hosting` was this project's normal hosting command, so habit
could turn the redirect on before the Step 5 smoke test. `cutoverRunbook.test.ts` checks fenced commands only, so it
would not catch prose that dropped the warning.
**Fix:** Name both forms in Step 3 ("Never run `firebase deploy` or `firebase deploy --only hosting` before Step 6:
they also publish the old-address redirect") and assert in the test that the Step 3 body contains
`firebase deploy --only hosting`.

### WR-02: Step 0 leaves the shell in `functions/` when a step fails

**File:** `docs/runbooks/worshipbuilder-cutover.md:31`
**Issue:** `cd functions && npx vitest run && npm run build && cd ..` leaves the shell in `functions/` if vitest or
the build fails; the next pasted lines then run in the wrong directory.
**Fix:** Use a subshell: `(cd functions && npx vitest run && npm run build)`.

### WR-03: Rollback leaves the redirect config armed

**File:** `docs/runbooks/worshipbuilder-cutover.md:208-216`
**Issue:** After `hosting:clone` or a console roll-back the old site serves the app again, but `firebase.json` still
holds the redirect, so any later `--only hosting:legacy`, `--only hosting` or plain `firebase deploy` silently
re-enables it. The section has no post-rollback verification either.
**Fix:** Warn that the repo config still redirects and nothing under hosting may be deployed until the cause is
fixed; add a check such as `curl -s -o /dev/null -w "%{http_code} %{content_type}\n"
https://worship-planner-bc515.web.app/` expecting `200 text/html`.

## Info

### IN-01: Test helper treats `$` in the replacement as a special pattern

**File:** `src/__tests__/firebaseHostingTargets.test.ts:51`
**Issue:** `rule.destination.replace(':1', m[1] ?? '')` interprets `$&`, `$1` etc. inside the captured path. No
current input contains `$`; a future case would compute a wrong expected value.
**Fix:** `rule.destination.replace(':1', () => m[1] ?? '')`.

### IN-02: Host-invariance test is near-tautological; `//` double slash only documented

**File:** `src/__tests__/firebaseHostingTargets.test.ts:126-140` and `:121`
**Issue:** Every destination starts with the fixed origin, so the host test can only fail if the destination literal
changes (separately asserted). `//evil.com/x` → `https://worshipbuilder.web.app//evil.com/x` is not an open
redirect but a doubled-slash URL the test locks in as expected. Low impact: the app's links never produce a leading
`//`.
**Fix:** Keep the case, comment that the double slash is accepted; optionally fold the host test into the exact-rule
test.

### IN-03: `legacy-site/index.html` is unreachable in practice

**File:** `legacy-site/index.html`, `firebase.json:57-68`
**Issue:** `^/$` and the catch-all cover `/` and `/index.html`; reserved `/__/*` paths are served by Firebase. The
page exists only to satisfy the non-empty `public` directory; ADR (f) calls it a "harmless fallback page".
**Fix:** Reword ADR (f) to say it only satisfies the `public` directory. No code change.

### IN-04: `DEPLOY-EMAIL-DOMAIN.md` still says `SERVICE_SHARE_BASE_URL` is "intentionally left alone"

**File:** `functions/DEPLOY-EMAIL-DOMAIN.md:63-72`
**Issue:** That paragraph now sits next to a sentence saying the cutover requires checking `functions/.env`; a reader
could skip a required step.
**Fix:** Retitle, e.g. "SERVICE_SHARE_BASE_URL is not changed by this runbook (the cutover runbook owns it)".

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
