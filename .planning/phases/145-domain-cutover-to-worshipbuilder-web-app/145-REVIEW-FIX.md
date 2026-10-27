---
phase: 145-domain-cutover-to-worshipbuilder-web-app
fixed_at: 2026-10-27T00:00:00Z
review_path: .planning/phases/145-domain-cutover-to-worshipbuilder-web-app/145-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 145: Code Review Fix Report

> Written by the gsd-code-fixer agent (sonnet); its harness forbids writing report files, so the orchestrator saved
> its returned report here. The fixer worked directly on `master` (worktrees are disabled for this project).

**Fixed at:** 2026-10-27
**Source review:** .planning/phases/145-domain-cutover-to-worshipbuilder-web-app/145-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (critical_warning; IN-01..IN-04 out of scope)
- Fixed: 3
- Skipped: 0

Checks before each commit: `npx vitest run src/__tests__/cutoverRunbook.test.ts` 17/17 and `npm run type-check`
exit 0. WR-01's new assertion was shown to fail (16/17) with the warning text removed, then the text was restored.

## Fixed Issues

### WR-01: Bare-deploy warning is narrower than the real hazard

**Files modified:** `docs/runbooks/worshipbuilder-cutover.md`, `docs/adr/0247-app-home-is-worshipbuilder-web-app-old-addresses-redirect.md`, `src/__tests__/cutoverRunbook.test.ts`
**Commit:** 7c722401
**Applied fix:** Step 3 now says never to run `firebase deploy` or `firebase deploy --only hosting` before Step 6
(both publish the old-address redirect; a plain `firebase deploy` also ships rules and functions). ADR-0247 decision
(a) says the same. New test "Step 3 warns off the untargeted deploy forms that would publish the redirect" asserts
the Step 3 body contains both command forms.

### WR-02: Step 0 leaves the shell in `functions/` when a step fails

**Files modified:** `docs/runbooks/worshipbuilder-cutover.md`
**Commit:** 56f85a1b
**Applied fix:** `cd functions && npx vitest run && npm run build && cd ..` is now the subshell
`(cd functions && npx vitest run && npm run build)`.

### WR-03: Rollback leaves the redirect config armed

**Files modified:** `docs/runbooks/worshipbuilder-cutover.md`
**Commit:** 71602d73
**Applied fix:** Rollback now has a fenced post-rollback check on `https://worship-planner-bc515.web.app/` (expect
`200 text/html`, not `302`) and warns that `firebase.json` still holds the redirect, so `firebase deploy`,
`firebase deploy --only hosting` and `firebase deploy --only hosting:legacy` would all re-enable it (prose only, so no
untargeted deploy command appears in a fence). Section order, "Owner confirms before running" markers and the
`Roll back` / `302` phrases are unchanged.

---

_Fixed: 2026-10-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
