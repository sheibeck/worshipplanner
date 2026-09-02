---
phase: 109-behavioral-architectural-extraction-comment-convention
plan: 05
subsystem: docs
tags: [comments, architecture-docs, r318, pinia, vue, refactor]

# Dependency graph
requires:
  - phase: 109-behavioral-architectural-extraction-comment-convention
    provides: 109-02 (backend), 109-03 (utils), 109-04 (components/composables) relocated Bucket B entries into the same four map docs
provides:
  - Final R318 relocation sweep for src/stores/**, src/types/**, src/config/**, src/firebase/index.ts, src/main.ts, src/views/**
  - Phase-wide 309/309 Bucket B reconciliation (109-02 + 109-03 + 109-04 + 109-05, zero drops)
  - R318 marked complete in REQUIREMENTS.md
affects: [110-architecture-review, future-phases-reading-codebase-maps]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Store/Type/View '### <source-file>' subsections under R318 section headers in ARCHITECTURE.md/CONCERNS.md/INTEGRATIONS.md/STACK.md", "See .planning/codebase/<DOC>.md (<section> -> <file>) pointer convention"]

key-files:
  created: []
  modified:
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/CONCERNS.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/STACK.md
    - .planning/REQUIREMENTS.md
    - src/stores/appConfig.ts
    - src/stores/auth.ts
    - src/stores/quarters.ts
    - src/stores/services.ts
    - src/stores/songLyrics.ts
    - src/stores/toasts.ts
    - src/stores/orgScopedStores.ts
    - src/stores/pptxRenders.ts
    - src/stores/slideGroups.ts
    - src/types/organization.ts
    - src/types/pptxRender.ts
    - src/types/service.ts
    - src/types/slide.ts
    - src/types/slideGroup.ts
    - src/types/songLyrics.ts
    - src/types/importedDeck.ts
    - src/config/appConfigDefaults.ts
    - src/config/slideFonts.ts
    - src/firebase/index.ts
    - src/main.ts
    - src/views/ServiceEditorView.vue
    - src/views/serviceEditorActionBar.ts

key-decisions:
  - "68 in-scope Bucket B entries (27 in Task 1's stores/config/firebase/main, 41 in Task 2's types/views) all relocated and shrunk — zero kept-inline carve-outs; every entry carried genuine relocatable narration."
  - "firebase/index.ts's DEV-gate gotcha and main.ts's no-module-load-fullscreen gotcha kept as one-line inline residues alongside their pointers, per the plan's explicit guidance — these are load-bearing warnings code alone can't convey."
  - "services.ts's draft-only write-guard and stageLayout field-allowlist narration relocated to ARCHITECTURE.md with a one-line invariant kept inline, per plan guidance."
  - "Phase-wide reconciliation: 109-02 (76) + 109-03 (80) + 109-04 (85) + 109-05 (68) = 309, matching the 108 handoff's stated Completeness guarantee exactly. Zero drops."
  - "Two entries were missed on the first content-search pass (ServiceEditorView.vue's R247/84-01 lastUsedAt-recompute comments, near onMarkAsPlanned) because the grep patterns used for scripture/lock-related entries didn't include an R247-specific search term. Caught during Task 3's reconciliation count, not left silent — mirrors the same class of near-miss 109-04 documented for SlidesTab.vue."
  - "Also fixed two pre-existing pointer comments (main.ts, auth.ts x2) where 'See' and '.planning/codebase/' had wrapped onto separate lines — cosmetically fine to a human reader but would break naive single-line pointer-resolution tooling; normalized to keep the two tokens on the same line."

requirements-completed: [R318]

coverage:
  - id: D1
    description: "Every Bucket B handoff entry for src/stores/**, src/config/**, src/firebase/index.ts, and src/main.ts (27 entries) relocated into the map docs and source shrunk to pointers"
    requirement: R318
    verification:
      - kind: unit
        ref: "node pointer-count check (Task 1 files) >= 15 threshold; actual 22 raw / 27 after fix"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build) exit 0 after Task 1 commit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every Bucket B handoff entry for src/types/** and src/views/** (41 entries) relocated into the map docs and source shrunk to pointers"
    requirement: R318
    verification:
      - kind: unit
        ref: "node pointer-count check (Task 2 files) >= 18 threshold; actual 27 raw / 41 after fix"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build) exit 0 after Task 2 commit"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero behavior change: type-check clean and app test suite shows no NEW failures vs. baseline; render-service untouched at 39/39"
    requirement: R318
    verification:
      - kind: other
        ref: "npm run type-check -> exit 0"
        status: pass
      - kind: unit
        ref: "npx vitest run -> 183/184 files passed, 4968 passed / 26 skipped, only known-baseline src/storage.rules.test.ts failing (Storage emulator not running, documented environment limitation)"
        status: pass
      - kind: unit
        ref: "cd render-service && npm test -> 3/3 files, 39/39 tests passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase-wide completeness reconciliation: relocated + kept-inline entries across 109-02/03/04/05 equal the 108 handoff's stated 309 total, zero drops"
    requirement: R318
    verification:
      - kind: other
        ref: "arithmetic: 109-02 (76) + 109-03 (80) + 109-04 (85) + 109-05 (68) = 309"
        status: pass
      - kind: other
        ref: "node script confirming all 68 of this plan's `See .planning/codebase/<DOC>.md` pointers resolve to an existing `### <source-file>` subsection in the named doc (68/68 OK)"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-09-02
status: complete
---

# Phase 109 Plan 05: Store/Type/Config/Entry-Point/View Behavioral Comment Relocation Summary

**Final R318 sweep — relocated 68 behavioral/architectural comments from Pinia stores, TypeScript
domain types, app config, the Firebase/main entry points, and ServiceEditorView.vue into the
`.planning/codebase/` map docs, closing the phase-wide 309-entry reconciliation with zero drops.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-02T01:09Z (immediately after 109-04's completion)
- **Completed:** 2026-09-02T01:51Z
- **Tasks:** 3 (2 relocation tasks + 1 verification/reconciliation task)
- **Files modified:** 30 (22 source files + 4 map docs + REQUIREMENTS.md + this SUMMARY's own STATE/ROADMAP touch)

## Accomplishments

- Relocated all 27 in-scope Task 1 entries — `src/stores/appConfig.ts`, `auth.ts` (5), `quarters.ts`,
  `services.ts` (9), `songLyrics.ts`, `toasts.ts`, `orgScopedStores.ts`, `pptxRenders.ts`,
  `slideGroups.ts`, `src/config/appConfigDefaults.ts`, `slideFonts.ts`, `src/firebase/index.ts`,
  `src/main.ts` — into new "Store & Config"/"Store & Entry-Point" R318 subsections across
  ARCHITECTURE.md, CONCERNS.md, INTEGRATIONS.md, and STACK.md, then shrunk each source comment to a
  `See .planning/codebase/<DOC>.md (<section> -> <file>)` pointer.
- Relocated all 41 in-scope Task 2 entries — `src/types/organization.ts` (6), `pptxRender.ts`,
  `service.ts` (5), `slide.ts` (6), `slideGroup.ts` (2), `songLyrics.ts` (2), `importedDeck.ts`, and
  `src/views/ServiceEditorView.vue` (16) + `serviceEditorActionBar.ts` (2) — into new "Type & View"
  R318 subsections across the same four docs.
- Task 3 reconciliation caught 2 entries missed on the first content-search pass
  (`ServiceEditorView.vue`'s two R247/84-01 `lastUsedAt`-recompute comments bracketing
  `onMarkAsPlanned`) — relocated them into ARCHITECTURE.md and shrunk before finishing, and tightened
  one over-long residual comment (`services.ts::deleteService`) that had duplicated its
  INTEGRATIONS.md content instead of pointing to it.
- Confirmed phase-wide completeness: 109-02 (76) + 109-03 (80) + 109-04 (85) + 109-05 (68) = **309**,
  matching the 108-COMMENT-INVENTORY.md handoff's stated total exactly — zero drops across the whole
  R318 sweep. Marked R318 complete in REQUIREMENTS.md (checkbox + traceability table).
- Verified zero behavior change: `npm run type-check` (vue-tsc --build, which also typechecks test
  files) exits 0; bare `npx vitest run` shows 183/184 test files passing (4968 tests passed, 26
  skipped) with only the documented `src/storage.rules.test.ts` baseline failure (Storage emulator
  not running — a pre-existing environment limitation, not a regression); `render-service` (zero
  Bucket B entries all phase) still 39/39.

## Task Commits

1. **Task 1: Relocate + shrink src/stores/**, src/config/**, src/firebase/index.ts, src/main.ts** -
   `46d9b8ae` (refactor)
2. **Task 2: Relocate + shrink src/types/** and src/views/**** - `371f1424` (refactor)
3. **Task 3 fix: 2 missed ServiceEditorView.vue R247 entries + pointer line-wrap normalization** -
   `2dc25bf9` (fix)
4. **Task 3 cleanup: tighten services.ts deleteService pointer** - `89b3c2aa` (refactor)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `.planning/codebase/ARCHITECTURE.md` - added "Store & Config Behavioral Notes (R318)" and "Type &
  View Behavioral Notes (R318)" sections, 21 `### <file>` subsections total
- `.planning/codebase/CONCERNS.md` - added "Store & Config Concern Notes (R318)" and "Type Concern
  Notes (R318)" sections, 2 `### <file>` subsections
- `.planning/codebase/INTEGRATIONS.md` - added "Store Integration Notes (R318)" and "Type & View
  Integration Notes (R318)" sections, 6 `### <file>` subsections
- `.planning/codebase/STACK.md` - added "Store & Entry-Point Stack Notes (R318)" and "Type & View
  Stack Notes (R318)" sections, 8 `### <file>` subsections
- `.planning/REQUIREMENTS.md` - R318 checkbox marked `[x]`, traceability row updated to Complete
- 22 source files across `src/stores/`, `src/types/`, `src/config/`, `src/firebase/`, `src/main.ts`,
  `src/views/` - comments shrunk to pointers (see frontmatter `key-files.modified` for the full list)

## Decisions Made

See `key-decisions` in frontmatter: (1) zero kept-inline carve-outs — every one of the 68 in-scope
entries carried genuine relocatable narration; (2) two gotcha comments (firebase/index.ts's DEV gate,
main.ts's no-module-load-fullscreen note) kept a one-line residue inline alongside their pointer per
the plan's explicit instruction; (3) services.ts's R036 write-guard and stageLayout projection kept a
one-line invariant inline for the same reason; (4) phase-wide reconciliation confirms 309/309 with
zero drops; (5) two entries missed on the first grep pass were caught during Task 3 (documented as a
deviation below, not silently absorbed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two ServiceEditorView.vue handoff entries missed on first content-search pass**
- **Found during:** Task 3 (phase-wide reconciliation)
- **Issue:** The grep pattern list used to locate ServiceEditorView.vue's ARCHITECTURE.md-targeted
  entries did not include an R247-specific search term, so the two `lastUsedAt`-recompute comments
  bracketing `onMarkAsPlanned` (handoff lines 3225-3237 and 3262-3277) were left unrelocated after
  Task 2's commit, undercounting this plan's pointer total at 66 instead of the expected 68.
- **Fix:** Located both comments by grepping for `R247` directly, relocated their narration into
  ARCHITECTURE.md's `### src/views/ServiceEditorView.vue` subsection, and shrunk both source comments
  to pointers.
- **Files modified:** `.planning/codebase/ARCHITECTURE.md`, `src/views/ServiceEditorView.vue`
- **Verification:** Node script confirming exactly 68 `.planning/codebase/<DOC>.md` pointer
  occurrences across this plan's 22 touched source files, and that all 68 resolve to an existing
  `### <source-file>` subsection in their named doc; `npm run type-check` exits 0 after the fix.
- **Commit:** `2dc25bf9`

**2. [Rule 1 - Bug] Two pointer comments had "See" and ".planning/codebase/" split across a line wrap**
- **Found during:** Task 3 (phase-wide reconciliation, while writing the pointer-count verification
  script)
- **Issue:** `src/main.ts` and two entries in `src/stores/auth.ts` wrapped their pointer comment such
  that the word "See" ended one `//` line and ".planning/codebase/..." began the next — readable to a
  human but would silently under-count for any tooling that expects "See .planning/codebase/" as a
  contiguous substring on one line (the exact pattern the plan's own automated verify script uses).
- **Fix:** Reformatted all three comments so "See .planning/codebase/<DOC>.md" starts together on one
  line, moving the wrap point earlier in the sentence.
- **Files modified:** `src/main.ts`, `src/stores/auth.ts`
- **Verification:** `npm run type-check` exits 0; pointer-count script now reports 68/68 with zero
  mismatches.
- **Commit:** `2dc25bf9`

**3. [Rule 1 - Bug] services.ts::deleteService's residual comment duplicated its INTEGRATIONS.md content**
- **Found during:** Task 3, while spot-checking remaining long comment blocks in scope files
- **Issue:** The D-15/R234 comment shrunk in Task 1 still carried ~9 lines of narration that had also
  been fully relocated into INTEGRATIONS.md's `### src/stores/services.ts` subsection — not a missed
  relocation, but a partial-shrink that undercut the "reduce to what code alone cannot convey" intent.
- **Fix:** Tightened the inline comment to a two-line invariant + pointer, removing the duplicated
  prose (which remains intact in INTEGRATIONS.md).
- **Files modified:** `src/stores/services.ts`
- **Verification:** `git diff` confirms comment-only change; `npm run type-check` exits 0.
- **Commit:** `89b3c2aa`

---

**Total deviations:** 3 auto-fixed (1 bug — missed entries caught by reconciliation; 1 bug — pointer
formatting; 1 bug — residual duplication). All three were self-caught during this plan's own Task 3
verification step, exactly the safety net the plan's reconciliation requirement exists to provide.
**Impact on plan:** No scope creep — all three fixes are within this plan's own file set and R318
scope. No architectural changes; no auth gates.

## Issues Encountered

None beyond the three auto-fixed deviations above, all resolved within this plan's own verification
step before finishing.

## Known Stubs

None — this is a comment-only, docs-relocation plan with no UI/data-flow changes.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or schema changes were
introduced; T-109-10 (shared-JSDoc boundary-recovery hazard) did not recur since `slideGroups.ts`'s
one in-scope entry (the module docstring) was hand-edited as a single contiguous block, and
T-109-11 (silent entry drop between handoff and finished sweep) was the exact class of defect this
plan's own Task 3 reconciliation caught and fixed (see Deviations above).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **R318 is now fully satisfied phase-wide.** All 309 Bucket B "how it works" narrations from the
  108-COMMENT-INVENTORY.md handoff are relocated into `.planning/codebase/` map docs (or, for the
  small number of genuine code-only gotchas, kept as a one-line residue alongside a pointer), with
  zero drops confirmed by explicit reconciliation across all four R318 plans (109-02 through 109-05).
- ARCHITECTURE.md, CONCERNS.md, INTEGRATIONS.md, and STACK.md each now carry a complete set of
  `### <source-file>` subsections for every file touched across the sweep — a durable index for any
  future phase (starting with Phase 110's architecture review) that needs "how does this file work"
  context without re-deriving it from source comments.
- No blockers for Phase 110. The comment convention (R319, already complete) and the two extraction
  requirements (R317 ADR-pointer pattern, R318 map-doc pattern) are both now fully applied across the
  codebase's Bucket A and Bucket B comment population.

---
*Phase: 109-behavioral-architectural-extraction-comment-convention*
*Completed: 2026-09-02*

## Self-Check: PASSED

All claimed created/modified files exist on disk; all 4 task/fix commit hashes
(`46d9b8ae`, `371f1424`, `2dc25bf9`, `89b3c2aa`) verified present in git log.
