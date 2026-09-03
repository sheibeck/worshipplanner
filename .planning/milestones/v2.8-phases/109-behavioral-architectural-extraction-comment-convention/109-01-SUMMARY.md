---
phase: 109-behavioral-architectural-extraction-comment-convention
plan: 01
subsystem: docs
tags: [conventions, documentation, adr, codebase-maps]

# Dependency graph
requires:
  - phase: 108-comment-audit-decision-rationale-extraction
    provides: docs/adr/ ADR pointer form and store (R317)
provides:
  - "A written 'Comment Convention' section in .planning/codebase/CONVENTIONS.md defining the short-inline-comment rule and the two durable stores (ADRs for rationale, .planning/codebase/ for behavior)"
  - "A CLAUDE.md pointer line making the convention discoverable to future sessions"
affects: [109-02, 109-03, 109-04, 109-05, future-comment-authoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comment pointer convention: '// See ADR-NNNN (...)' for rationale, '// See .planning/codebase/<DOC>.md (<section>)' for behavior/architecture narration"

key-files:
  created: []
  modified:
    - .planning/codebase/CONVENTIONS.md
    - CLAUDE.md

key-decisions:
  - "Convention lives in CONVENTIONS.md as a new '## Comment Convention' section, distinct from and cross-referencing the existing '## Comments' section, per 109-CONTEXT's 'Convention doc home' decision."
  - "CLAUDE.md gets exactly one pointer line (no restated rationale), per 109-CONTEXT's discoverability requirement."

requirements-completed: [R319]

coverage:
  - id: D1
    description: "'## Comment Convention' section added to CONVENTIONS.md stating comments stay short, naming all three stores (inline, docs/adr/, .planning/codebase/), and documenting both pointer forms"
    requirement: "R319"
    verification:
      - kind: other
        ref: "grep -q '## Comment Convention' .planning/codebase/CONVENTIONS.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "One-line CLAUDE.md pointer to the Comment Convention section"
    requirement: "R319"
    verification:
      - kind: other
        ref: "grep -q 'codebase/CONVENTIONS.md' CLAUDE.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "No behavior change; repository still type-checks cleanly after the docs-only edit"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-09-02
status: complete
---

# Phase 109 Plan 01: Comment Convention Summary

**Wrote the durable "Comment Convention" section in CONVENTIONS.md (short inline comments; rationale in ADRs; behavior/architecture in `.planning/codebase/` map docs; two documented pointer forms) plus a one-line CLAUDE.md pointer, satisfying R319.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-02T02:53:00Z
- **Completed:** 2026-09-02T03:03:24Z
- **Tasks:** 2 completed
- **Files modified:** 2 (`.planning/codebase/CONVENTIONS.md`, `CLAUDE.md`)

## Accomplishments
- Added a new `## Comment Convention` section to `.planning/codebase/CONVENTIONS.md` (distinct from, and cross-referencing, the pre-existing `## Comments` section) that states the shrink policy, names all three stores (inline, `docs/adr/`, `.planning/codebase/`), documents both pointer forms verbatim (`// See ADR-NNNN (...)` and `// See .planning/codebase/<DOC>.md (<section>)`), and gives a one-line "where things live" summary table.
- Added a single discoverable pointer line to `CLAUDE.md` (placed just before the existing `## graphify` section) directing future sessions to the new convention without restating its content.
- Confirmed the change is docs-only: `git status --porcelain` after staging showed only the two target files touched (an unrelated pre-existing `.planning/STATE.md` modification from earlier in the milestone was left untouched, out of scope for this plan) and `npm run type-check` (`vue-tsc --build`) exits clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the Comment Convention section + CLAUDE.md pointer** - `68b619f2` (docs)
2. **Task 2: Prove no behavior change (docs-only)** - verification-only task, no files modified, no separate commit (confirmed via `git status --porcelain` and `npm run type-check`, both clean)

**Plan metadata:** committed as part of this SUMMARY's final commit.

## Files Created/Modified
- `.planning/codebase/CONVENTIONS.md` - new `## Comment Convention` section (shrink policy, three stores, two pointer forms, summary table)
- `CLAUDE.md` - one-line pointer to the Comment Convention section, placed ahead of the `## graphify` section

## Decisions Made
- Convention section is co-located in CONVENTIONS.md (per 109-CONTEXT's "Convention doc home" decision) rather than in a new standalone doc, since it directly extends the file's existing "Comments" section and sits alongside the behavior docs (`.planning/codebase/`) that now bear the extraction load.
- CLAUDE.md pointer kept to exactly one line with no restated rationale, per the plan's explicit instruction and 109-CONTEXT's discoverability requirement — the goal is a single, low-friction discovery path, not a duplicate copy of the convention.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Task 2 required no file changes (docs-only plan, no source/test files touched), so it produced no separate commit beyond Task 1's — `git status --porcelain` and `npm run type-check` both confirmed the acceptance criteria without further action.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The written convention is now in place and discoverable, so plans 109-02 through 109-05 (the R318 Bucket-B relocation work) can cite it when relocating behavioral/architectural comments into the `.planning/codebase/` map docs and shrinking source comments to short pointers.
- No blockers.

---
*Phase: 109-behavioral-architectural-extraction-comment-convention*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: .planning/codebase/CONVENTIONS.md
- FOUND: CLAUDE.md
- FOUND: .planning/phases/109-behavioral-architectural-extraction-comment-convention/109-01-SUMMARY.md
- FOUND commit: 68b619f2
