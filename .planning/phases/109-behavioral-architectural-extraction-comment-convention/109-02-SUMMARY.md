---
phase: 109-behavioral-architectural-extraction-comment-convention
plan: 02
subsystem: docs
tags: [firestore-rules, storage-rules, cloud-functions, comment-convention, R318]

# Dependency graph
requires:
  - phase: 108-comment-audit-decision-rationale-extraction
    provides: the classified Bucket B "Phase 109 Handoff" worklist (108-COMMENT-INVENTORY.md) naming a target map doc per backend entry
provides:
  - Backend (functions/src/** + firestore.rules + storage.rules) behavioral/architectural narration relocated into .planning/codebase/ map docs
  - 76 backend source comments shrunk to "See .planning/codebase/<DOC>.md (<section>)" pointers
affects: [109-03, 109-04, 109-05 (append to the same four map docs, serialized by wave)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-file '### functions/src/<module>.ts' or '### firestore.rules' subsections under a '## Backend <X> Notes (R318)' section in each map doc, holding relocated narration verbatim-in-spirit."
    - "Source comment shrunk to a one-line pointer + at most one residual line of inline why/gotcha/invariant that code cannot convey."

key-files:
  created: []
  modified:
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/CONCERNS.md
    - .planning/codebase/STACK.md
    - firestore.rules
    - storage.rules
    - functions/src/index.ts
    - functions/src/appConfig.ts
    - functions/src/backfillLastUsed.ts
    - functions/src/backfillOrgClaims.ts
    - functions/src/inviteOnboarding.ts
    - functions/src/orgMembershipClaims.ts
    - functions/src/orgProvisioning.ts
    - functions/src/orgTemplateSeed.ts
    - functions/src/pptxParser.ts
    - functions/src/serviceRoles.ts
    - functions/src/superAdminClaims.ts
    - functions/src/adminEmail.ts
    - functions/src/messageTokens.ts
    - functions/src/params.ts
    - functions/src/renderInvoker.ts
    - functions/src/webhookSignature.ts

key-decisions:
  - "Grouped relocated narration under new '### <source-file>' subsections in each map doc rather than shoehorning into pre-existing sections, per the plan's explicit allowance — the backend entries are numerous and file-scoped, so per-file subsections keep pointers traceable to exactly one section."
  - "Where a single handoff entry's comment block ran on past its stated line range (its neighbors in the same block, e.g. cleanupOrphanBackgrounds' FLOOR GUARD detail, or cleanupOrphanRenders' age-guard detail), the full remaining text was captured into the map doc rather than left as an orphaned code comment, then the source was shrunk completely — this avoided leaving dangling half-sentences after the initial pointer edit."
  - "Two entries (functions/src/index.ts:3249-3265 messageWebhook, :3272-3289 resolveRecipientRef, :3350-3371 messageWebhookHandler) were corrected from an initial mis-file into ARCHITECTURE.md to their handoff-assigned target INTEGRATIONS.md before committing — caught via the entry-count reconciliation."

requirements-completed: [R318]

coverage:
  - id: D1
    description: "Every Bucket-B handoff entry for functions/src/**, firestore.rules, and storage.rules (76 entries) relocated into the target map doc or explicitly kept inline (none dropped)"
    requirement: "R318"
    verification:
      - kind: other
        ref: "grep count of handoff entries (76) vs. relocated pointer count (42 Task 1 + 34 Task 2 = 76)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Comment-only diff: no executable/rules-logic line changed in any of the 18 touched source files"
    requirement: "R318"
    verification:
      - kind: other
        ref: "git diff -U0 <files> | filtered to non-comment +/- lines -> zero matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero behavior change proven by type-check + app suite + rules suite showing no NEW failures vs. baseline"
    requirement: "R318"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build) — exit 0"
        status: pass
      - kind: unit
        ref: "functions/: npx tsc --noEmit -p tsconfig.json — exit 0"
        status: pass
      - kind: integration
        ref: "npx vitest run — 183/184 files pass; only src/storage.rules.test.ts fails (documented env-limitation baseline)"
        status: pass
      - kind: integration
        ref: "npx vitest run --config vitest.rules.config.ts — src/rules.test.ts 200/200 pass; storage.rules.test.ts fails identically to baseline"
        status: pass
    human_judgment: false

duration: 60min
completed: 2026-09-02
status: complete
---

# Phase 109 Plan 02: Backend Behavioral/Architectural Comment Relocation Summary

**Relocated 76 backend "how it works" comments from functions/src/**, firestore.rules, and storage.rules into the ARCHITECTURE/INTEGRATIONS/CONCERNS/STACK map docs, shrinking each source comment to a "See .planning/codebase/<DOC>.md (<section>)" pointer — zero drops, comment-only diff.**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-09-01T23:15:00-04:00 (approx)
- **Completed:** 2026-09-02T03:48:57Z
- **Tasks:** 3
- **Files modified:** 22 (4 map docs + 18 source files)

## Accomplishments
- Relocated all 42 Task 1 entries (firestore.rules: 11, storage.rules: 2, functions/src/index.ts: 29) into ARCHITECTURE.md/INTEGRATIONS.md/CONCERNS.md, replacing the source comments with map-doc pointers.
- Relocated all 34 Task 2 entries across the remaining 15 functions/src modules (appConfig, backfillLastUsed, backfillOrgClaims, inviteOnboarding, orgMembershipClaims, orgProvisioning, orgTemplateSeed, pptxParser, serviceRoles, superAdminClaims, adminEmail, messageTokens, params, renderInvoker, webhookSignature) into the same four map docs.
- Reconciled the completeness count: grepping the 108-COMMENT-INVENTORY.md "Phase 109 Handoff" section for bolded paths starting `functions/src/` or exactly `firestore.rules`/`storage.rules` yields exactly 76 entries — matching the 42+34 relocated count with zero drops and zero "kept inline" carve-outs needed (every entry had genuine narration worth relocating).
- Proved zero behavior change: `npm run type-check` (vue-tsc --build) and the functions package's own `tsc --noEmit` both exit 0; `npx vitest run` shows the same 1-file baseline (`src/storage.rules.test.ts`, a documented Storage-emulator env limitation); `npx vitest run --config vitest.rules.config.ts` against the already-running emulator shows `src/rules.test.ts` at 200/200 (matching the CLAUDE.md-documented baseline) with `storage.rules.test.ts` failing identically to its known baseline (no new failures).

## Task Commits

1. **Task 1: Relocate + shrink functions/src/index.ts and the rules files** - `a40e0fdc` (docs)
2. **Task 2: Relocate + shrink the remaining functions/src modules** - `724ba45a` (docs)
3. **Task 3: Prove no behavior change + backend completeness count** - verification-only, no additional commit (all checks passed against the state left by Tasks 1-2)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified
- `.planning/codebase/ARCHITECTURE.md` - added "Backend Behavioral Notes (R318)" section with per-file subsections for firestore.rules, storage.rules, and 8 functions/src modules
- `.planning/codebase/INTEGRATIONS.md` - added "Backend Integration Notes (R318)" section with per-file subsections for firestore.rules, storage.rules, and 8 functions/src modules
- `.planning/codebase/CONCERNS.md` - added "Backend Concern Notes (R318)" section covering functions/src/index.ts and orgMembershipClaims.ts
- `.planning/codebase/STACK.md` - added "Backend Stack Notes (R318)" section covering functions/src/messageTokens.ts
- `firestore.rules` / `storage.rules` - 11 + 2 comments shrunk to map-doc pointers
- `functions/src/index.ts` - 29 comments shrunk to map-doc pointers
- 14 other `functions/src/*.ts` modules - 34 comments shrunk to map-doc pointers across appConfig, backfillLastUsed, backfillOrgClaims, inviteOnboarding, orgMembershipClaims, orgProvisioning, orgTemplateSeed, pptxParser, serviceRoles, superAdminClaims, adminEmail, messageTokens, params, renderInvoker, webhookSignature

## Decisions Made
- Grouped relocated narration under new `### <source-file>` subsections in each map doc (e.g. `### functions/src/index.ts`) rather than trying to fit 76 entries into the docs' pre-existing thematic sections — the plan explicitly sanctions this ("Create a new `### ` subsection only where no existing section fits... a heading naming `functions/src/index.ts`"), and per-file subsections keep every pointer traceable to exactly one unambiguous section.
- Where a handoff entry's comment ran on beyond its recorded line range into an adjacent bullet list that was part of the same logical block (e.g. `cleanupOrphanBackgrounds`'s FLOOR GUARD/BACKGROUND_PATH_GUARD detail, `cleanupOrphanRenders`'s staleness-guard detail, `cleanupPptxSources`'s full safety-contract bullet list), the full remaining text was captured into the map doc entry and the source comment was shrunk completely, rather than leaving a truncated fragment mid-comment. This was caught by grep-verifying each shrink point for orphaned trailing lines immediately after editing.
- Caught and corrected a target-doc mis-file during Task 1: `messageWebhook`/`resolveRecipientRef`/`messageWebhookHandler` (functions/src/index.ts:3249-3265, 3272-3289, 3350-3371) are handoff-assigned to INTEGRATIONS.md, but were initially drafted into ARCHITECTURE.md. Found via cross-checking the compiled per-doc entry lists before committing; moved to INTEGRATIONS.md and removed from ARCHITECTURE.md before the Task 1 commit landed.

## Deviations from Plan

None - plan executed exactly as written. No entries required a "kept inline" carve-out (every Bucket B entry in scope carried genuine relocatable "how it works" narration); no architectural changes; no auth gates.

## Issues Encountered

- Line numbers in the 108-COMMENT-INVENTORY.md handoff (captured before Phase 108's own R317 ADR-pointer shrinks landed) no longer matched the current file's line numbers by the time this plan ran. Resolved by matching each entry to its source comment by distinctive quoted phrases/content rather than by line number, then verifying via the automated pointer-count checks in each task's `<verify>` block.
- One initial target-doc mis-file (see Decisions Made) — caught before commit via cross-checking the compiled ARCH/INTEG/CONCERNS/STACK entry lists against the Bucket B `-> _DOC_` annotations in 108-COMMENT-INVENTORY.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 109-03, 109-04, 109-05 append to the same four map docs (ARCHITECTURE.md, INTEGRATIONS.md, CONCERNS.md, STACK.md) for their own trees; they are serialized by wave after this plan (Wave 1) to avoid concurrent writes to the same doc files.
- The `See .planning/codebase/<DOC>.md (<section>)` pointer convention (established in 109-01's CONVENTIONS.md, applied here for the backend tree) is now demonstrated at scale (76 relocations across 18 files) and ready to be followed identically by the remaining R318 plans.

---
*Phase: 109-behavioral-architectural-extraction-comment-convention*
*Completed: 2026-09-02*
