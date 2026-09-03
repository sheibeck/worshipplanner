---
phase: 108-comment-audit-decision-rationale-extraction
plan: 01
subsystem: docs
tags: [comments-as-specs, audit, adr-prep, codebase-map-prep, triage]

# Dependency graph
requires: []
provides:
  - "108-COMMENT-INVENTORY.md: a complete triage inventory of every load-bearing comment across src/**, functions/src/**, render-service/src/**, firestore.rules, storage.rules, classified into Decision-Rationale (382), Behavioral/Architectural (309), and Genuinely-Local (5) buckets"
  - "Bucket A (Decision-Rationale) with file:line, tag id(s), qualifying source doc, summary, and verbatim text for every R-/WR-/CR-/Pitfall-tagged comment"
  - "Tag Collision Index flagging that bare tag ids (WR-01, CR-01, etc.) are per-file/per-review labels, not a global namespace"
  - "Bucket B (Behavioral/Architectural) with file:line, short description, and a suggested .planning/codebase/ target doc for every untagged 'how it works' comment"
  - "Phase 109 Handoff section: the complete Bucket B worklist grouped by target doc, verified entry-count-identical to Bucket B"
affects: [108-comment-audit-decision-rationale-extraction/108-02, 109]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grep-first comment audit: tag-vocabulary grep -> contiguous-comment-block expansion -> per-file grouping, done programmatically against the real source tree rather than the stale knowledge graph"
    - "Bucket-exclusive classification with a machine-verified zero-overlap check across all three buckets"

key-files:
  created:
    - .planning/phases/108-comment-audit-decision-rationale-extraction/108-COMMENT-INVENTORY.md
  modified: []

key-decisions:
  - "Tag ids (WR-01, WR-02, CR-01, Pitfall, R-02) are reused per-file/per-review-round in this codebase, not globally unique — documented explicitly in a Tag Collision Index so plan 108-02 groups ADR candidates by (tag id + qualifying doc), never by bare tag id alone, avoiding accidental merges of unrelated decisions"
  - "Bucket B (untagged) scan is deliberately scoped to long block comments (>=10 lines) and explicit NOTE:/WARNING:/HACK:/IMPORTANT:/CAUTION: labels rather than every comment in the tree, documented as a 'lightweight, not exhaustive' method per the plan's own framing, given this codebase's unusually high comment density"
  - "3 candidate blocks (pure @param/@returns JSDoc with no rationale content) were read and excluded as not load-bearing rather than force-classified into a bucket"
  - "Bucket B target-doc suggestions use a path/keyword heuristic (INTEGRATIONS.md for third-party API mentions, CONCERNS.md for explicit limitation/deferred language, STACK.md for library-choice rationale, ARCHITECTURE.md as the default for cross-cutting 'how it works' narration) — Phase 109 should treat these as a starting point, not a final classification"

requirements-completed: [R316]

coverage:
  - id: D1
    description: "108-COMMENT-INVENTORY.md exists with Bucket A (Decision-Rationale, 382 entries with file:line + tags + summary + verbatim text)"
    requirement: "R316"
    verification:
      - kind: other
        ref: "grep -q 'Decision-Rationale' 108-COMMENT-INVENTORY.md; spot-check functions/src/orgMembershipClaims.ts CR-01/WR-01/WR-03 and firestore.rules tagged lines all present"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bucket B (Behavioral/Architectural, 309 entries) and Bucket C (Genuinely-Local, 5 entries) classified with zero cross-bucket file:line duplication, each Bucket B entry naming a suggested Phase 109 target doc"
    requirement: "R316"
    verification:
      - kind: other
        ref: "programmatic overlap check across all three bucket ranges (script output: A&B=0, A&C=0, B&C=0 overlapping file:line pairs)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Document header (scope/method/date/load-bearing definition), per-tree/per-bucket summary table, and a complete Phase 109 Handoff section re-listing every Bucket B entry (309==309, verified)"
    requirement: "R316"
    verification:
      - kind: other
        ref: "grep -q 'Phase 109 Handoff' 108-COMMENT-INVENTORY.md; handoff entry count (309) programmatically confirmed equal to Bucket B entry count (309)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero source/test/rules files modified across the entire plan (audit-only, comment-only phase)"
    verification:
      - kind: other
        ref: "git status --short after each task commit and after the plan's final commit — only 108-COMMENT-INVENTORY.md ever appears"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-01
status: complete
---

# Phase 108 Plan 01: Comment Audit & Triage Inventory Summary

**Grep-first triage inventory of all 696 load-bearing comments across the runtime codebase, classified into Decision-Rationale (382, ready for ADR extraction in 108-02), Behavioral/Architectural (309, handed off to Phase 109), and Genuinely-Local (5) buckets, with a Tag Collision Index warning that this codebase's WR-/CR- tags are per-file labels, not a global namespace.**

## Performance

- **Duration:** 13 min (recorded plan-execution window; the underlying grep/extract/classify/generate work spanned a much longer analysis pass)
- **Started:** 2026-09-01T21:04:12Z
- **Completed:** 2026-09-01T21:17:05Z
- **Tasks:** 3
- **Files modified:** 1 (`.planning/phases/108-comment-audit-decision-rationale-extraction/108-COMMENT-INVENTORY.md`, created)

## Accomplishments

- Collected every `R-`/`WR-`/`CR-`/`Pitfall`-tagged decision-rationale comment across `src/**`, `functions/src/**`, `render-service/src/**`, and `firestore.rules` (`storage.rules` carries none) — 382 entries, each with `file:line`, tag id(s), qualifying source doc, an extracted summary, and the full verbatim text plan 108-02 needs to lift into an ADR.
- Discovered and documented that this codebase's tag ids (`WR-01`, `WR-02`, `CR-01`, `CR-02`, `R-02`, `Pitfall`) are **reused per-file / per-review-round**, not globally unique — confirmed against the plan's own illustrative example (`useRunControl.ts`'s WR-01 vs. `orgMembershipClaims.ts`'s WR-01 are unrelated decisions) and built a Tag Collision Index enumerating every cross-file bare-tag reuse with its qualifying doc, so plan 108-02 does not accidentally merge unrelated rationale into one ADR.
- Ran a lightweight untagged scan (long block comments + explicit `NOTE:`/`WARNING:`/`HACK:`/`IMPORTANT:` labels) across the same trees, individually read and classified 314 candidates into Bucket B (Behavioral/Architectural, 309) and Bucket C (Genuinely-Local, 5), excluding 3 trivial `@param`/`@returns`-only JSDoc blocks as not load-bearing.
- Verified programmatically that no `file:line` appears under more than one bucket heading across the whole document (zero overlap between A/B, A/C, and B/C).
- Finalized the inventory with a header (scope, grep-first method with the stale-graph caveat, load-bearing definition), a per-tree/per-bucket summary count table, and a "Phase 109 Handoff" section that re-lists all 309 Bucket B entries grouped by suggested target doc, verified entry-count-identical to Bucket B.

## Task Commits

Each task was committed atomically:

1. **Task 1: Grep-first decision-rationale collection across all in-scope trees** - `ff3b9125` (docs)
2. **Task 2: Untagged load-bearing scan and three-way classification** - `2707ce94` (docs)
3. **Task 3: Finalize inventory header, summary table, and Phase 109 handoff section** - `fa386acf` (docs)

_Note: this is a discovery/audit plan — no `feat`/`fix` commits, no TDD cycle; all three commits are `docs`._

## Files Created/Modified

- `.planning/phases/108-comment-audit-decision-rationale-extraction/108-COMMENT-INVENTORY.md` - the complete triage inventory (header, summary table, Bucket A/B/C, Tag Collision Index, Phase 109 Handoff section); ~7,270 lines / ~488KB.

## Decisions Made

- Tag ids are locally scoped, not globally unique — documented in a Tag Collision Index rather than silently grouping by bare tag text, which would have produced factually wrong ADR groupings in 108-02.
- The untagged (Bucket B/C) scan is scoped to long block comments and explicitly-labeled notes rather than attempting to re-read literally every comment in the tree — documented as a "lightweight, not exhaustive" method in the inventory itself, consistent with the plan's own framing of Task 2, and appropriate given this codebase's unusually high comment density (confirmed by CLAUDE.md's own documentation style).
- Suggested Phase 109 target docs for Bucket B entries are heuristic (path + keyword based) — flagged in the inventory as a starting point for Phase 109 to refine, not a final classification.

## Deviations from Plan

None - plan executed exactly as written. The plan's own text anticipated the tag-collision finding (it gives the WR-01 example) and this execution surfaced and documented the full extent of that reuse across the codebase, which is squarely within Task 1's "note explicitly" instruction.

## Issues Encountered

- **Scale:** the tagged pass alone surfaced 418 raw grep hits (382 after merging contiguous comment lines into single blocks) and the untagged pass surfaced 1,603 raw candidates before filtering — far more than a plan of this size typically produces. Handled by building small Python extraction/classification scripts (grep-driven, verbatim text pulled directly from the real files) rather than hand-transcribing each entry, then spot-checking output quality against the raw source before assembling the final document. The resulting inventory is large (~488KB) but every entry is independently `file:line`-verifiable against the current tree.
- **Large-file write:** a single 336KB Bucket A markdown fragment risked exceeding a single `Write`/`Edit` call's reliable size. Built the document incrementally per the SUMMARY-writing guidance's large-file fallback pattern (split at safe markdown-section boundaries, write first chunk, then sentinel-replace-append each subsequent chunk) instead of one oversized call.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 108-02 (R317, ADR extraction) can consume Bucket A directly: every entry has file:line, tag id(s), qualifying doc, and verbatim text. Read the Tag Collision Index first to avoid merging unrelated decisions that share a bare tag.
- Phase 109 (R318, behavioral/architectural relocation) can consume the "Phase 109 Handoff" section directly: 309 entries, pre-grouped by suggested target `.planning/codebase/` doc.
- No blockers. The inventory's own "Method note" under Bucket B flags that the untagged scan is a best-effort, pattern-driven pass (not a byte-for-byte re-read of every comment in the tree) — Phase 109 may want a targeted follow-up read of any file it knows to carry complex behavior but that shows zero Bucket B hits here.

---
*Phase: 108-comment-audit-decision-rationale-extraction*
*Completed: 2026-09-01*

## Self-Check: PASSED

- FOUND: `.planning/phases/108-comment-audit-decision-rationale-extraction/108-COMMENT-INVENTORY.md`
- FOUND: `ff3b9125` (Task 1 commit)
- FOUND: `2707ce94` (Task 2 commit)
- FOUND: `fa386acf` (Task 3 commit)
