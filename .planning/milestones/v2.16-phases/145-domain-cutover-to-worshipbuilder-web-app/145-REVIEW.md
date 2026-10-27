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
  warning: 0
  info: 5
  total: 5
status: clean
---

# Phase 145: Code Review Report

> Written by the gsd-code-reviewer agent (sonnet, re-review iteration 2); its harness forbids writing report files,
> so the orchestrator saved its returned report here. The iteration-1 report (3 warnings) is in git at d939c040.

**Reviewed:** 2026-10-27
**Depth:** standard (iteration 2 of the fix loop)
**Files Reviewed:** 19
**Status:** clean (Info items only)

## Summary

Re-review after fix commits 7c722401 (WR-01), 56f85a1b (WR-02) and 71602d73 (WR-03). All three warnings are fixed
correctly and introduced no new Critical or Warning problem.

- **WR-01 verified.** Runbook Step 3 names both `firebase deploy` and `firebase deploy --only hosting`, says both
  publish the old-address redirect, and that a plain `firebase deploy` also ships rules and functions. ADR-0247
  decision (a) says the same. The new test asserts the Step 3 body contains both backticked forms; the Step 3 fence
  still holds only `--only hosting:app`.
- **WR-02 verified.** Step 0 is now `(cd functions && npx vitest run && npm run build)`; a failing step can no longer
  strand the shell in `functions/`.
- **WR-03 verified.** Rollback has a fenced post-rollback `curl` on `https://worship-planner-bc515.web.app/` expecting
  `200 text/html`, not `302`, and a prose warning (outside any fence) that `firebase.json` still holds the redirect and
  names the three deploy forms that would re-enable it.

Regression checks on the edits:
- **Section order:** the 11 H2 headings are unchanged and in order.
- **"Owner confirms before running":** present on Steps 1, 2, 3, 4, 6, 7, 8, the Step 0 env fix, Step 5's fix
  paragraph and Rollback (test requires `>= 6`).
- **Env checks:** still `grep -q ... && echo ... || echo ...` and `Select-String ... -Quiet`, status-only, with the
  `[[:space:]]*$` CRLF tolerance. No secret value is printed.
- **Fences:** every fenced `firebase deploy` is `--only hosting:app`, `hosting:legacy` or `functions`; the rollback
  `hosting:clone` fence is not a deploy.

## Info

### IN-01: Test helper treats `$` in the replacement as a special pattern

**File:** `src/__tests__/firebaseHostingTargets.test.ts:51`
**Issue:** `rule.destination.replace(':1', m[1] ?? '')` interprets `$&`, `$1` etc. inside the captured path. No
current input contains `$`; a future case would compute a wrong expected value.
**Fix:** `rule.destination.replace(':1', () => m[1] ?? '')`.

### IN-02: Host-invariance test is near-tautological; `//` double slash only documented

**File:** `src/__tests__/firebaseHostingTargets.test.ts:126-140` and `:121`
**Issue:** Every destination starts with the fixed origin, so the host test can only fail if the destination literal
changes (separately asserted). `//evil.com/x` -> `https://worshipbuilder.web.app//evil.com/x` is not an open
redirect but a doubled-slash URL the test locks in as expected. Low impact.
**Fix:** Keep the case, comment that the double slash is accepted; optionally fold the host test into the exact-rule
test.

### IN-03: `legacy-site/index.html` is unreachable in practice

**File:** `legacy-site/index.html`, `firebase.json:57-68`
**Issue:** `^/$` and the catch-all cover `/` and `/index.html`; reserved `/__/*` paths are served by Firebase. The
page exists only to satisfy the non-empty `public` directory; ADR (f) calls it a "harmless fallback page".
**Fix:** Reword ADR (f) to say it only satisfies the `public` directory. No code change.

### IN-04: `DEPLOY-EMAIL-DOMAIN.md` still says `SERVICE_SHARE_BASE_URL` is "intentionally left alone"

**File:** `functions/DEPLOY-EMAIL-DOMAIN.md:63-72`
**Issue:** That paragraph sits next to a sentence saying the cutover requires checking `functions/.env`; a reader
could skip a required step.
**Fix:** Retitle, e.g. "SERVICE_SHARE_BASE_URL is not changed by this runbook (the cutover runbook owns it)".

### IN-05: Rollback warning is broader than needed and the rollback check is not test-guarded

**File:** `docs/runbooks/worshipbuilder-cutover.md:222`, `src/__tests__/cutoverRunbook.test.ts:110-124`
**Issue:** "Deploy nothing under hosting" also covers `--only hosting:app`, which is safe (it does not touch the legacy
site). Separately, the post-rollback `curl` and the armed-config warning have no test assertion, so deleting them
would pass CI. Neither is a correctness defect.
**Fix:** Reword to "deploy nothing that includes the legacy site (...); `--only hosting:app` stays safe", and
optionally assert the Rollback body contains `firebase deploy --only hosting:legacy` and `200 text/html`.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
