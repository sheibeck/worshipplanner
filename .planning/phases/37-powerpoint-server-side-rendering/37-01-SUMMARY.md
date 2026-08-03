---
phase: 37-powerpoint-server-side-rendering
plan: 01
subsystem: infra
tags: [docker, libreoffice, poppler, fontconfig, cloud-run, vitest, express, google-cloud-storage]

# Dependency graph
requires: []
provides:
  - "render-service/ — standalone Node/TypeScript project (own package.json, tsconfig.json, vitest.config.ts) outside functions/, so Firebase's buildpack-based functions deploy can never try to build it"
  - "render-service/Dockerfile — two-stage LibreOffice + Poppler + open-fonts-only container definition with a build-time dpkg font-provenance assertion"
  - "render-service/fontconfig/60-metric-compat-aliases.conf — Calibri->Carlito / Cambria->Caladea substitution mapping"
  - "render-service/src/dockerfile.test.ts — 15 text-only assertions gating the font policy, no Docker daemon required"
affects: [37-02, 37-03, 37-06]

# Tech tracking
tech-stack:
  added: ["express@^5.2.1", "@google-cloud/storage@^7.21.0", "typescript@~5.7.0 (devDep)", "vitest@^4.1.10 (devDep)", "@types/express@^5.0.0", "@types/node@^22.0.0"]
  patterns:
    - "Standalone sibling project (render-service/) outside functions/ to avoid Firebase buildpack pickup"
    - "Two-stage Dockerfile: full-deps builder stage for tsc, --omit=dev lean runtime stage"
    - "Text-only Dockerfile assertions (readFileSync, region-scoped regex) as a build-time-equivalent test gate with no Docker daemon"

key-files:
  created:
    - render-service/package.json
    - render-service/package-lock.json
    - render-service/tsconfig.json
    - render-service/vitest.config.ts
    - render-service/.dockerignore
    - render-service/.gitignore
    - render-service/src/placeholder.ts
    - render-service/Dockerfile
    - render-service/fontconfig/60-metric-compat-aliases.conf
    - render-service/src/dockerfile.test.ts
  modified: []

key-decisions:
  - "Followed the plan's two-stage Dockerfile correction over 37-RESEARCH.md's single-stage sketch — a single-stage npm ci --omit=dev then npm run build fails because typescript is a devDependency"
  - "Added render-service/src/placeholder.ts (Rule 1 auto-fix): tsconfig.json's exclude: [\"src/**/*.test.ts\"] means dockerfile.test.ts does not count as an input for tsc's include resolution, so an empty/all-test-excluded src/ tree fails TS18003 (\"No inputs were found\"). Verified this empirically before adding the fix. Delete this file once 37-02 lands render.ts/server.ts/main.ts."
  - "Package legitimacy checkpoint (Task 1) recorded as DEFERRED, not owner-approved, per STATE.md's standing autonomy grant — see below"

patterns-established:
  - "render-service/src/dockerfile.test.ts's normalizeDockerfile + extractAptInstallPackages helpers: strip comment lines, join backslash-continued RUN lines, then extract only the apt-get install package-token list so negative font assertions never false-fail against the Dockerfile's legitimate dpkg-assertion RUN line (which mentions the same Microsoft font names as search terms)"

requirements-completed: [R062]

coverage:
  - id: D1
    description: "render-service/ exists as a standalone, type-clean Node project outside functions/, with express + @google-cloud/storage deps and no firebase-admin/firebase-functions"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "cd render-service && npx vitest run --passWithNoTests"
        status: pass
      - kind: unit
        ref: "cd render-service && npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dockerfile installs LibreOffice Impress, Poppler and only the three metric-compatible open font packages, with a build-time dpkg provenance assertion that fails on a Microsoft core-font package"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "render-service/src/dockerfile.test.ts — 'Dockerfile font policy' describe block (12 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "fontconfig alias file maps Calibri->Carlito and Cambria->Caladea, closing 37-RESEARCH.md's assumption A4 (font availability != font substitution)"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "render-service/src/dockerfile.test.ts — 'fontconfig alias file' describe block (3 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Package legitimacy checkpoint for express, @google-cloud/storage, @types/express, @types/node — resolved source repos recorded and confirmed to match 37-RESEARCH.md's audit"
    requirement: "R062"
    verification: []
    human_judgment: true
    rationale: "STATE.md's standing autonomy grant requires this checkpoint be deferred and disclosed, never self-approved — an owner decision, not something a test can pass on the owner's behalf."

duration: 25min
completed: 2026-08-03
status: complete
---

# Phase 37 Plan 01: Render-Service Scaffold and Font-Policy Gate Summary

**Standalone `render-service/` Cloud Run project scaffolded outside `functions/`, with a two-stage LibreOffice+Poppler Dockerfile whose open-font-only policy (Carlito/Caladea/Liberation, never Microsoft fonts) is proven by a 15-assertion text-only test — no Docker daemon, nothing built, nothing deployed.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-03T15:55:00Z (approx, first file write)
- **Completed:** 2026-08-03T16:04:25Z
- **Tasks:** 3 (1 checkpoint deferred, 2 auto)
- **Files modified:** 10 created, 0 modified

## Accomplishments
- `render-service/` scaffolded as a fully standalone Node/TypeScript project (package.json, tsconfig.json, vitest.config.ts, .dockerignore, .gitignore) outside `functions/`, so Firebase's buildpack-based functions deploy can never attempt to build it.
- Two-stage `Dockerfile` authored: a `builder` stage running a full `npm ci` (so `tsc` is present) + `npm run build`, and a lean `runtime` stage installing LibreOffice Impress, Poppler, and only the three metric-compatible open font packages with `--no-install-recommends`, plus a build-time `dpkg -l | grep` assertion that fails the build if a Microsoft core-font package is ever present.
- `fontconfig/60-metric-compat-aliases.conf` authored, mapping Calibri->Carlito and Cambria->Caladea — closes 37-RESEARCH.md's Pitfall 2 / assumption A4 (font *availability* is not the same as font *substitution*).
- `src/dockerfile.test.ts` — 15 text-only assertions (readFileSync against the Dockerfile, no Docker daemon) proving the font policy is a **gate**, not an intention. The negative Microsoft-font assertion is region-scoped to the extracted `apt-get install` package-token list (not the whole file), which was empirically verified two ways: (a) an in-memory simulated-removal test inside the suite itself, and (b) manually deleting `fonts-crosextra-carlito` from the Dockerfile on disk, confirming 3 of the 15 tests fail, then restoring the file and confirming all 15 pass again.
- Package legitimacy checkpoint (Task 1) run mechanically (`npm view ... repository` for all four new deps) and its disposition recorded honestly as **DEFERRED**, per the standing autonomy grant — never self-approved.

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate for the four new render-service dependencies** — checkpoint, no commit (mechanical `npm view` checks only; disposition recorded below, not code)
2. **Task 2: Scaffold the standalone render-service/ project** - `0af4660` (feat)
3. **Task 3: Author the Dockerfile with the font policy as a build-time assertion, and gate it with a text test** - `4203de5` (feat)

**Plan metadata commit:** pending (this commit, made after this SUMMARY is written)

## Files Created/Modified
- `render-service/package.json` — standalone manifest: `worship-planner-render-service`, `express@^5.2.1`, `@google-cloud/storage@^7.21.0`, devDeps mirroring `functions/`'s pins (`typescript@~5.7.0`, `vitest@^4.1.10`) plus `@types/express@^5.0.0`/`@types/node@^22.0.0`
- `render-service/package-lock.json` — produced by `npm install`
- `render-service/tsconfig.json` — mirrors `functions/tsconfig.json`; excludes `src/**/*.test.ts` from the compiled build output
- `render-service/vitest.config.ts` — node environment, `testTimeout: 10000` (shorter than `functions/`'s 30000 — no large fixture decks, every render test mocks `execFile`)
- `render-service/.dockerignore`, `render-service/.gitignore`
- `render-service/src/placeholder.ts` — scaffold placeholder keeping `tsc --noEmit` satisfiable until 37-02 lands real modules (see Deviations)
- `render-service/Dockerfile` — two-stage build; runtime stage's font policy and provenance assertion
- `render-service/fontconfig/60-metric-compat-aliases.conf` — fontconfig XML substitution aliases
- `render-service/src/dockerfile.test.ts` — 15 text-only assertions across two `describe` blocks

## Decisions Made
- **Followed the plan's Dockerfile correction, not 37-RESEARCH.md's sketch verbatim.** The research sketch's single-stage `npm ci --omit=dev` then `npm run build` fails because `typescript` is a devDependency; used the plan-specified two-stage build instead.
- **Package legitimacy checkpoint disposition: DEFERRED, not owner-approved.** Per STATE.md's `★★ STANDING AUTONOMY GRANT`, this `gate="blocking-human"` checkpoint was never self-approved. The mechanical `npm view` checks were run and all four resolved to their expected repos (see below); the checkpoint continues under the standing grant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `render-service/src/placeholder.ts` to keep `tsc --noEmit` satisfiable before 37-02 lands real modules**
- **Found during:** Task 2's verification step (`npx tsc --noEmit`)
- **Issue:** `tsconfig.json`'s `"exclude": ["src/**/*.test.ts"]` (as specified by the plan, to keep test files out of the compiled container image) means that with an empty `src/` (Task 2) or with only `dockerfile.test.ts` present (Task 3), `tsc`'s `include: ["src"]` resolves to zero net files — TypeScript raises `TS18003: No inputs were found`. Empirically confirmed both cases fail before the fix (exit code 2) and the plan's own acceptance criteria require `tsc --noEmit` to exit 0 at both Task 2 and Task 3 ("`npx tsc --noEmit` still exits 0").
- **Fix:** Added `render-service/src/placeholder.ts` — a one-line `export {}` module with a comment explaining its purpose and that it should be deleted once 37-02 adds `render.ts`/`server.ts`/`main.ts`. This does not collide with any file name owned by 37-02 per the plan's "Artifacts this phase produces" table.
- **Files modified:** `render-service/src/placeholder.ts` (new)
- **Verification:** `cd render-service && npx tsc --noEmit` exits 0 both immediately after Task 2 and after Task 3 (re-verified after `dockerfile.test.ts` was added).
- **Committed in:** `0af4660` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in the plan's own verification expectations, not in application logic)
**Impact on plan:** Necessary for the plan's stated acceptance criteria to be literally satisfiable; no scope creep — placeholder is 3 lines, exports nothing, and is explicitly flagged for deletion once 37-02 lands real source.

## Package Legitimacy Checkpoint — Task 1 (DEFERRED, not owner-approved)

Ran the mechanical `npm view ... repository` checks before any `npm install`, as instructed:

| Package | Resolved source repository | Matches 37-RESEARCH.md's audit? |
|---|---|---|
| `express` | `github.com/expressjs/express` | Yes — Approved (128.3M/wk) |
| `@google-cloud/storage` | `github.com/googleapis/google-cloud-node` (directory `handwritten/storage`) | Yes — Approved (15.5M/wk) |
| `@types/express` | `github.com/DefinitelyTyped/DefinitelyTyped` (directory `types/express`) | Not in 37-RESEARCH.md's table; canonical DefinitelyTyped source, consistent with `@types/*` convention |
| `@types/node` | `github.com/DefinitelyTyped/DefinitelyTyped` (directory `types/node`) | Not in 37-RESEARCH.md's table; canonical DefinitelyTyped source, consistent with `@types/*` convention |

**Disposition: DEFERRED under STATE.md's `★★ STANDING AUTONOMY GRANT`.** Not owner-approved. This item was NOT recorded as item 37.5 in `.planning/PENDING-VERIFICATION.md` directly by this plan — the plan's own `<resume-signal>` text anticipates this exact sequencing ("plan 37-06 creates that section; if you reach this task first, note the deferral in this plan's SUMMARY and 37-06 will transcribe it") — so this table is the authoritative record for 37-06 to transcribe into `.planning/PENDING-VERIFICATION.md` as item 37.5. `npm install` proceeded only after these mechanical checks were run and recorded, per Task 1's own `<action>` instructions.

## Issues Encountered
None beyond the `tsc --noEmit` / TS18003 deviation documented above.

## User Setup Required
None — no external service configuration required. `.env.local` was not touched.

## Threat Flags

None. All new surface (npm registry install, Debian apt install) is already covered by this plan's own `<threat_model>` (T-37-SC, T-37-01, T-37-02, T-37-03), each with a stated mitigation implemented in this plan.

## Next Phase Readiness

- `render-service/` exists, is type-clean, and its own test suite (`npx vitest run`, 15/15 passing) and `functions/`'s suite (26/26 passing, unaffected) are both green.
- **37-02 needs:** `render-service/src/render.ts`, `render-service/src/server.ts`, `render-service/src/main.ts` — the Dockerfile's `CMD ["node", "lib/main.js"]` and builder stage already assume `main.ts` compiles to `lib/main.js`; 37-02 must honor that name. **37-02 should delete `render-service/src/placeholder.ts`** once real source files exist (no longer needed once `src/` has a non-test `.ts` file).
- **37-06 needs to transcribe** this SUMMARY's Package Legitimacy Checkpoint table into `.planning/PENDING-VERIFICATION.md` as item 37.5, per the plan's own resume-signal instructions.
- **Confirmed: nothing was deployed or built as a container this run.** No `gcloud`, `docker build`, `docker push`, or `firebase deploy` command was executed at any point. `git log` for this plan's two commits shows only `npm install`, file authoring, and `npx vitest run` / `npx tsc --noEmit` invocations. The Dockerfile is reviewable source only.

---
*Phase: 37-powerpoint-server-side-rendering*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 10 created files verified present on disk; both task commits (`0af4660`, `4203de5`) verified present in `git log`.
