---
phase: 46-global-slide-typography
plan: 01
subsystem: infra
tags: [fontsource, web-fonts, self-hosted, license-compliance, vitest]

requires:
  - phase: 39-org-settings-infrastructure-feature-toggles
    provides: typed OrgSettings shape and the single loadOrgContext defaults-merge point this phase's later plans extend
provides:
  - Five self-hosted @fontsource packages (inter, open-sans, poppins, lora, source-serif-4) pinned at 5.3.0
  - src/config/slideFonts.ts — SLIDE_FONTS registry and SLIDE_FONT_FAMILY_NAMES
  - Per-family license verified directly against each package's own LICENSE file (all OFL-1.1)
  - Corrected per-family weight ramps (Open Sans includes 500; Source Serif 4 includes 300 and 500; Lora excludes 300)
affects: [46-02-css-variables-and-font-loading, 46-03-settings-slide-typography-card, 46-04-render-site-application]

tech-stack:
  added: ["@fontsource/inter@5.3.0", "@fontsource/open-sans@5.3.0", "@fontsource/poppins@5.3.0", "@fontsource/lora@5.3.0", "@fontsource/source-serif-4@5.3.0"]
  patterns: ["Typed font registry (Record<family, definition>) as single source of truth for family list, weight ramp, package name, category, and license"]

key-files:
  created:
    - src/config/slideFonts.ts
    - src/config/__tests__/slideFonts.test.ts
    - .planning/phases/46-global-slide-typography/deferred-items.md
  modified:
    - package.json
    - package-lock.json
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "Built SLIDE_FONTS from 46-RESEARCH.md's CORRECTED weight table, not 46-UI-SPEC.md's — Open Sans ships 500 and Source Serif 4 ships 300+500, both omitted by the UI-SPEC's unverified draft."
  - "Task 1's package-legitimacy checkpoint was pre-resolved per the plan's own instructions and the STATE.md v1.5 standing autonomy grant: recorded DEFERRED (never self-approved) in PENDING-VERIFICATION.md, execution proceeded to Task 2 on the strength of RESEARCH.md's direct tarball + registry verification."
  - "licenseUrl points to each package's fontsource.org license page (https://fontsource.org/fonts/<slug>/license) rather than a raw GitHub LICENSE-file URL, matching the package's own declared homepage convention."

patterns-established:
  - "Font registry pattern: Record<family, {family, package, category, weights, license, licenseUrl}> plus a derived Object.keys() name list, verified per-field against the installed package's own files rather than assumed by analogy."

requirements-completed: []
requirements-partial:
  - id: R093
    note: "License-evidence and supply-chain foundation only (success criterion 4). The five packages are installed and SLIDE_FONTS is built and verified, but the Settings picker, OrgSettings.slideTypography field, CSS-variable application, and presenter font-load gate are 46-02/46-03/46-04's work."

coverage:
  - id: D1
    description: "Five @fontsource/* packages installed and pinned at 5.3.0 with integrity hashes in package-lock.json"
    requirement: "R093"
    verification:
      - kind: other
        ref: "package.json/package-lock.json inspection — all five at 5.3.0 with sha512 integrity hashes; postinstall scripts confirmed null on all five via node_modules/@fontsource/*/package.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "SLIDE_FONTS registry with exactly five entries, each carrying a package-LICENSE-verified OFL-1.1 license and the corrected weight ramp"
    requirement: "R093"
    verification:
      - kind: unit
        ref: "src/config/__tests__/slideFonts.test.ts — 8/8 passing (family keys, Inter-first, OFL-1.1+licenseUrl, Lora excludes 300, Open Sans/Source Serif 4 include 500, no weight outside 300-700, SLIDE_FONT_FAMILY_NAMES derivation, package/category shape)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Package-legitimacy checkpoint for all five @fontsource/* packages"
    human_judgment: true
    rationale: "Per the plan's own resolution instructions, the owner's final legitimacy sign-off is deferred (not self-approved) and recorded in PENDING-VERIFICATION.md for owner review, even though RESEARCH.md already performed direct tarball + registry verification."
    verification: []

duration: 17min
completed: 2026-08-08
status: complete
---

# Phase 46 Plan 01: Fontsource Install & SLIDE_FONTS Registry Summary

**Five self-hosted @fontsource packages (Inter, Open Sans, Poppins, Lora, Source Serif 4) pinned at 5.3.0, with a typed `SLIDE_FONTS` registry whose license and weight-ramp claims were verified directly against each package's own LICENSE/CSS files rather than assumed.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-08T16:54:14Z
- **Completed:** 2026-08-08T17:11:08Z
- **Tasks:** 2 (Task 1 checkpoint deferred + Task 2 install/registry)
- **Files modified:** 6 (package.json, package-lock.json, src/config/slideFonts.ts, src/config/__tests__/slideFonts.test.ts, .planning/PENDING-VERIFICATION.md, .planning/phases/46-global-slide-typography/deferred-items.md)

## Accomplishments
- Installed `@fontsource/inter`, `@fontsource/open-sans`, `@fontsource/poppins`, `@fontsource/lora`, `@fontsource/source-serif-4`, all pinned at `5.3.0` with integrity hashes in `package-lock.json`
- Built `src/config/slideFonts.ts` — `SLIDE_FONTS` (5 entries) + `SLIDE_FONT_FAMILY_NAMES` (Inter first) — from 46-RESEARCH.md's package-verified weight table, not the UI-SPEC's unverified draft
- Confirmed every family's `LICENSE` file directly (`node_modules/@fontsource/<pkg>/LICENSE`): all five read "This Font Software is licensed under the SIL Open Font License, Version 1.1" — `license: 'OFL-1.1'` on every entry is evidence-backed, not assumed by analogy to Inter
- Confirmed the actual shipped `*.css` weight files per package on disk, matching the corrected ramp exactly: Inter/Poppins/Open Sans/Source Serif 4 all reach 300-700 (Open Sans and Source Serif 4 include 500 as RESEARCH corrected); Lora ships only 400-700 (no 300)
- Confirmed no package carries a `postinstall` script (`scripts: {}` on all five `package.json`s)
- 8/8 new unit tests green; `npm run type-check` (`vue-tsc --build`) clean

## Task Commits

1. **Task 1: Package-legitimacy checkpoint (deferred)** - `d346ad6` (docs)
2. **Task 2: Install packages + build SLIDE_FONTS registry** - `bc7849b` (feat)
3. **Out-of-scope discovery logged** - `30a2621` (docs)

_No plan-metadata commit table entry duplicated here; see Files Created/Modified below._

## Files Created/Modified
- `package.json` / `package-lock.json` - five `@fontsource/*` deps pinned at `^5.3.0` (resolves to `5.3.0`)
- `src/config/slideFonts.ts` - `SLIDE_FONTS` registry + `SLIDE_FONT_FAMILY_NAMES`
- `src/config/__tests__/slideFonts.test.ts` - 8 tests proving registry shape, license, and weight-ramp correctness
- `.planning/PENDING-VERIFICATION.md` - Phase 46 section recording Task 1's checkpoint as DEFERRED
- `.planning/phases/46-global-slide-typography/deferred-items.md` - logged an out-of-scope, pre-existing full-suite failure (see Issues Encountered)

## Decisions Made
- Built the registry strictly from 46-RESEARCH.md's corrected table (Open Sans includes 500; Source Serif 4 includes 300 and 500; Lora excludes 300) — confirmed independently by listing each package's shipped `*.css` weight files on disk, which matched the RESEARCH table exactly.
- `licenseUrl` uses each package's `https://fontsource.org/fonts/<slug>/license` page (matches the `homepage` field each package's own `package.json` declares) rather than a raw GitHub blob URL.
- Task 1's checkpoint was pre-resolved per the plan's explicit instructions and the STATE.md v1.5 standing autonomy grant: recorded DEFERRED in `.planning/PENDING-VERIFICATION.md` § Phase 46 (never marked "verified by owner"), and execution proceeded straight to Task 2 since 46-RESEARCH.md already performed direct npm-registry + tarball verification (all five resolve to `github.com/fontsource/font-files`, weekly downloads 104K-2.37M, `postinstall: null` on every package). The `SUS`/`too-new` verdict from `gsd-tools query package-legitimacy check` is a documented false positive from `@fontsource`'s catalog-wide lockstep release cadence, not a genuine supply-chain signal.

## Deviations from Plan

None - plan executed exactly as written (Task 1's checkpoint resolution and Task 2's build both followed the plan's own explicit instructions).

## Issues Encountered

**Full-suite verification surfaced a third failing file beyond the documented 2-file baseline.** `npx vitest run` reported `3 failed | 98 passed (101)` test files: the two documented baseline failures (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) plus `render-service/src/render.test.ts`, which fails with `Error: [vitest] No "default" export is defined on the "node:child_process" mock`. Investigated and confirmed **not caused by this plan**: `render-service/src/render.test.ts` was last touched in Phase 37 (`846eaec`) and this plan touched only `package.json`/`package-lock.json` (root deps) and `src/config/`. The failure is the workspace/tooling version-mismatch CLAUDE.md documents for `render-service`'s own newer Vitest (4.1.10) vs the root's (4.0.18) — surfacing here even under the bare `npx vitest run` form CLAUDE.md recommends as the safe one. Logged to `deferred-items.md` per the SCOPE BOUNDARY rule rather than fixed; the scoped test run (`npx vitest run src/config/__tests__/slideFonts.test.ts`) and `npm run type-check` — this plan's own verification gates — are both clean.

## User Setup Required

None - no external service configuration required. The owner's outstanding action is the deferred package-legitimacy confirmation recorded in `.planning/PENDING-VERIFICATION.md` § Phase 46 — informational sign-off only, not a setup step.

## Next Phase Readiness

`SLIDE_FONTS` and `SLIDE_FONT_FAMILY_NAMES` are ready for 46-02 (`OrgSettings.slideTypography` field + `src/utils/slideTypography.ts` helpers + CSS variables + eager `main.ts` import) and 46-03 (Settings card) to consume as their single source of truth for family list, weight ramp, package name, and category. No blockers. The render-service full-suite artifact noted above is unrelated and does not block downstream plans in this phase.

---
*Phase: 46-global-slide-typography*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: src/config/slideFonts.ts
- FOUND: src/config/__tests__/slideFonts.test.ts
- FOUND: .planning/phases/46-global-slide-typography/46-01-SUMMARY.md
- FOUND: .planning/phases/46-global-slide-typography/deferred-items.md
- FOUND commit: d346ad6
- FOUND commit: bc7849b
- FOUND commit: 30a2621
