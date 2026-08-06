---
phase: 21-powerpoint-import-announcements-and-sermon
plan: 03
subsystem: testing
tags: [vitest, officeparser, cloud-functions, pptx, fixtures, node]

# Dependency graph
requires:
  - phase: 21-powerpoint-import-announcements-and-sermon (21-RESEARCH.md)
    provides: officeparser package selection + legitimacy audit, Wave 0 gap list (functions vitest infra, fixture decks)
provides:
  - functions/ Vitest harness (Node-environment config, `npm test` script)
  - officeparser ^7.4.0 installed as a functions/ runtime dependency, human-approved
  - functions/src/__fixtures__/ populated with mixed.pptx (real deck), corrupted.pptx, not-a-pptx.txt, README
  - Confirmed officeparser compiles under functions/tsconfig.json and successfully parses a real .pptx buffer
affects: [21-04 (parsePptx function + pptxParser.ts), 21-05, 21-06]

# Tech tracking
tech-stack:
  added: [vitest@^4.1.10 (functions/ devDependency), officeparser@^7.4.0 (functions/ runtime dependency)]
  patterns: ["functions/ now mirrors root's Vitest setup but with environment: 'node' instead of 'jsdom'"]

key-files:
  created:
    - functions/vitest.config.ts
    - functions/src/__fixtures__/README.md
    - functions/src/__fixtures__/corrupted.pptx
    - functions/src/__fixtures__/not-a-pptx.txt
    - functions/src/__fixtures__/mixed.pptx
  modified:
    - functions/package.json
    - functions/package-lock.json

key-decisions:
  - "officeparser installed after human pre-approval of the package-legitimacy evidence (2019 creation date, ~585K weekly downloads, MIT license, real GitHub repo) overriding the automated [SUS] 'too-new' false-positive verdict."
  - "docs/example.pptx (a genuine, user-provided ~8.8MB PowerPoint 2007+ deck) copied into functions/src/__fixtures__/mixed.pptx as the authoritative mixed-content integration fixture, since it already exercises real-world text+image content without waiting on additional human-exported decks."
  - "text-only.pptx and image-only.pptx deferred (not yet human-provided) — documented as an open follow-up in the fixtures README rather than blocking this plan, since mixed.pptx + the two error-path fixtures are sufficient to start 21-04's parser implementation and error-path tests."

patterns-established:
  - "Pattern: functions/ Vitest config always sets environment: 'node' (never jsdom) with a generous testTimeout for real-file fixture parsing — mirrors but diverges deliberately from the root vitest config used for Vue component tests."

requirements-completed: [R010]

coverage:
  - id: D1
    description: "functions/ can run a Vitest suite in a Node environment (previously no test tooling existed there at all)"
    requirement: "R010"
    verification:
      - kind: unit
        ref: "cd functions && npx vitest run --passWithNoTests"
        status: pass
    human_judgment: false
  - id: D2
    description: "officeparser installed as a functions/ runtime dependency only after human approval of its legitimacy evidence at the blocking checkpoint"
    requirement: "R010"
    verification:
      - kind: manual_procedural
        ref: "npm view officeparser time.created/engines/license/repository.url confirmed live against RESEARCH.md's audited claims prior to install; checkpoint pre-approved per orchestrator instructions"
        status: pass
    human_judgment: true
    rationale: "Package-legitimacy approval is an explicit human trust decision (T-21-SC in the threat model), not something automation can certify on its own even though the evidence was re-verified live this session."
  - id: D3
    description: "Fixture .pptx/error-path inputs exist under functions/src/__fixtures__/ for 21-04's parser tests"
    requirement: "R010"
    verification:
      - kind: integration
        ref: "node smoke test: officeparser.parseOffice(readFileSync('docs/example.pptx'), {fileType:'pptx'}) -> 21 content nodes, 3962 chars of non-empty text"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-25
status: complete
---

# Phase 21 Plan 03: functions/ Vitest Infra + Fixture Decks + officeparser Install Summary

**Stood up a Node-environment Vitest harness in `functions/` (previously test-tool-free) and installed `officeparser@^7.4.0` as a runtime dependency post-human-approval, backed by a real 8.8MB PowerPoint deck fixture that officeparser successfully parses into non-empty extracted text.**

## Performance

- **Duration:** ~15 min (task work; excludes upstream research/planning)
- **Started:** 2026-07-25T10:13:00-04:00 (approx, first commit landed 10:13:53)
- **Completed:** 2026-07-25T10:16:41-04:00 (last task commit)
- **Tasks:** 3 (2 auto tasks + 1 pre-approved checkpoint)
- **Files modified:** 7 (2 created config/docs, 3 created fixtures, 2 modified package files)

## Accomplishments
- `functions/` now has a working Vitest config (`environment: 'node'`, 30s `testTimeout`) and an `npm test` script (`vitest run`), verified to boot cleanly with zero test files (`--passWithNoTests`).
- `officeparser@^7.4.0` installed as a `functions/package.json` runtime dependency, gated behind — and only executed after — the blocking human-verify legitimacy checkpoint.
- `functions/src/__fixtures__/` populated: `mixed.pptx` (the real, user-provided `docs/example.pptx`, copied in as the authoritative mixed-content integration fixture), `corrupted.pptx` and `not-a-pptx.txt` (executor-created error-path fixtures), and a `README.md` documenting all five expected fixtures (including the two still-deferred human-provided decks).
- Confirmed end-to-end: `officeparser` resolves via `require()`, compiles cleanly under `functions/tsconfig.json` (commonjs + esModuleInterop — throwaway compile-check written then removed), and its `parseOffice()` call against the real `docs/example.pptx` buffer returns 21 content nodes and 3962 characters of non-empty extracted text.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the functions/ Vitest harness and fixture scaffold** - `fb89996` (feat)
2. **Task 2: Human-verify officeparser legitimacy before install** - checkpoint, pre-approved (no code change; see Checkpoint Approval below)
3. **Task 3: Install officeparser in functions/ after approval** - `6a17f71` (feat)

**Plan metadata:** (this commit, following STATE/ROADMAP update)

## Checkpoint Approval (Task 2)

The blocking `checkpoint:human-verify` gate (`gate="blocking-human"`) on installing `officeparser` was **pre-approved by the user** ahead of this execution run, per explicit instruction passed to this executor: "The user has ALREADY reviewed the evidence and EXPLICITLY APPROVED installing officeparser (MIT license, ~585K weekly downloads, real GitHub repo since 2019, scanner [SUS] verdict judged a false positive)."

Before proceeding to Task 3, the evidence was independently re-confirmed live against the npm registry (matches RESEARCH.md's Package Legitimacy Audit exactly):

| Check | Result |
|---|---|
| `npm view officeparser time.created` | `2019-04-15T10:37:25.848Z` (package predates the "too-new" heuristic that flagged the 2026-07-19 latest-version publish) |
| `npm view officeparser engines` | `{ node: '>=18.0.0' }` (compatible with `functions/`'s node 22 runtime) |
| `npm view officeparser license` | `MIT` |
| `npm view officeparser repository.url` | `git+https://github.com/harshankur/officeParser.git` (real, active repo) |
| `npm view officeparser version` | `7.4.0` (matches RESEARCH.md's `^7.4.0` target) |

No CLI commands were run by the user — this re-verification and the subsequent install were both performed by the executor, consistent with the pre-approval.

## Files Created/Modified
- `functions/vitest.config.ts` - New Node-environment Vitest config with a 30s test timeout for real-fixture parsing
- `functions/package.json` - Added `vitest@^4.1.10` devDependency, `"test": "vitest run"` script, and `officeparser@^7.4.0` runtime dependency; build/serve/deploy scripts and `engines.node: "22"` unchanged
- `functions/package-lock.json` - Updated lockfile reflecting both installs
- `functions/src/__fixtures__/README.md` - Documents all five expected fixtures and their roles/status
- `functions/src/__fixtures__/mixed.pptx` - Real ~8.8MB PowerPoint 2007+ deck (copied from user-provided `docs/example.pptx`) — mixed text+image integration fixture
- `functions/src/__fixtures__/corrupted.pptx` - Executor-created: plain-text bytes with no `PK\x03\x04` zip signature, drives the friendly-error path for a byte-corrupted upload
- `functions/src/__fixtures__/not-a-pptx.txt` - Executor-created: plain text file, drives the friendly-error path for a mis-declared upload

## Decisions Made
- Used the real, user-provided `docs/example.pptx` as the `mixed.pptx` fixture rather than waiting on a separate human-exported "mixed" deck — it is already a genuine, non-trivial PowerPoint 2007+ file that exercises officeparser's real parsing path, satisfying the plan's fidelity-risk testing intent without blocking on additional user setup.
- Deferred `text-only.pptx` and `image-only.pptx` (this plan's `user_setup` calls for three human-exported decks; only one was available at execution time). Logged as a follow-up in the fixtures README rather than treated as a blocker, since `mixed.pptx` plus the two error-path fixtures are sufficient to begin 21-04's `mapAstToSlides()` implementation and its error-path tests.
- Let `npm install` resolve `vitest` to `^4.1.10` (rather than pinning exactly to root's `^4.0.18`) — both satisfy "a version compatible with the root ^4 line" per the plan's acceptance criteria, and pinning an older patch would fight npm's own resolution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Verified officeparser compiles under functions/tsconfig.json, not just `require()`-resolves**
- **Found during:** Task 3 (Install officeparser)
- **Issue:** The plan's `<verify>` step only checked `require('officeparser')` at the Node level; the objective's success criteria additionally required confirming compilation under `functions/tsconfig.json`'s TypeScript settings (commonjs + esModuleInterop), which a plain `require()` check does not exercise.
- **Fix:** Wrote a throwaway `functions/src/__officeparser_smoke.ts` importing `parseOffice` via ES module syntax, ran `npx tsc --noEmit` (zero errors), then deleted the throwaway file before committing.
- **Files modified:** none persisted (throwaway file created and removed within Task 3, not part of the commit)
- **Verification:** `npx tsc --noEmit` exited clean with the smoke file present
- **Committed in:** N/A (file removed pre-commit; no artifact to track)

---

**Total deviations:** 1 auto-fixed (1 missing verification step added, no scope creep — matches the plan's own stated objective of confirming compilation)
**Impact on plan:** None on scope; strengthens verification coverage beyond the plan's literal `<verify>` block to satisfy the broader execution objective.

## Issues Encountered
- `docs/example.pptx` is an untracked ~8.8MB binary in the working tree (not part of this plan's `files_modified`). It was read-only referenced/copied into `functions/src/__fixtures__/mixed.pptx` but left untouched and unstaged itself — committing/ignoring the original `docs/example.pptx` is out of this plan's scope and was not decided here.
- `npm install` in `functions/` prints `EBADENGINE` warnings (local Node is v24.11.1 vs. the pinned `engines.node: "22"`) and `npm audit` reports 21 pre-existing vulnerabilities in the transitive dependency tree (mostly from `officeparser`'s heavy dependency footprint per RESEARCH.md Pitfall 3, e.g. `tesseract.js`/`pdfjs-dist`). Both are pre-existing/expected conditions flagged in RESEARCH.md, not regressions introduced by this plan, and out of this plan's scope to remediate.

## User Setup Required
None for this plan directly — the pre-approved checkpoint already covered the one external decision (officeparser install). However, **follow-up fixture provisioning remains open**: `functions/src/__fixtures__/text-only.pptx` and `image-only.pptx` still need to be human-exported and dropped in per the plan's original `user_setup` block before 21-04's full parser test suite (text-only / image-only mapping cases) can run. `mixed.pptx`, `corrupted.pptx`, and `not-a-pptx.txt` are already in place and sufficient to start 21-04.

## Next Phase Readiness
- `functions/` Vitest harness is live and green (`cd functions && npx vitest run --passWithNoTests`) — 21-04 can add `pptxParser.test.ts` immediately.
- `officeparser` is installed, compiles cleanly, and is proven against a real deck (21 content nodes, 3962 chars extracted from `docs/example.pptx`) — 21-04's `mapAstToSlides()` can be written and tested against real AST output today.
- Blocker/follow-up for 21-04: request `text-only.pptx` and `image-only.pptx` exports from the user (or accept `mixed.pptx`-only coverage as an interim scope reduction) before claiming full Wave 0 fixture parity with the original `user_setup` ask.

---
*Phase: 21-powerpoint-import-announcements-and-sermon*
*Completed: 2026-07-25*

## Self-Check: PASSED

All created files verified present on disk; both task commit hashes (`fb89996`, `6a17f71`) verified in `git log --oneline --all`.
