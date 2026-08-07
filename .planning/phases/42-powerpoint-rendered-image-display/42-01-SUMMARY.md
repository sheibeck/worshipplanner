---
phase: 42-powerpoint-rendered-image-display
plan: 01
subsystem: auth
tags: [firestore-rules, security-rules, firebase-emulator, pptx-render]

# Dependency graph
requires:
  - phase: 41-sharing-correctness
    provides: the still-pending `firebase deploy --only firestore:rules` handoff this plan amends rather than duplicates
provides:
  - "firestore.rules: dedicated match /pptxRenders/{importId} block granting member-tier read"
  - "firestore.rules: generic wildcard's write clause now excludes pptxRenders, closing a live production write hole"
  - "src/rules.test.ts: pptxRenders describe block, 1 DENY-write + 1 ALLOW-read + 2 cross-tenant/anon DENY-read + 1 DENY-create"
  - ".planning/PENDING-VERIFICATION.md: Phase 41's deploy checkbox amended to cover both phases' clauses"
affects: [42-02, 42-03, 42-04, 42-05, 42-06, 42-07, 42-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Third generic-wildcard write exclusion, same comment convention as services/slideGroups (D-01)"
    - "Emulator-proven RED-then-GREEN regression proof for a rules fix: same assertion, assertSucceeds pre-fix -> assertFails post-fix"

key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "D-01/D-02 premise (contested by functions/src/index.ts:144-148 and 42-CONTEXT.md's first draft) proven TRUE by an emulator write, not assumed: an org editor's updateDoc against organizations/orgA/pptxRenders/import-1 succeeded pre-fix"
  - "Read grant is member-tier (isOrgMember), not editor-tier (isOrgEditor) — a viewer already reads the deck's parsed content, so render status carries no additional sensitivity (T-42-02, accepted)"
  - "D-17: storage.rules left untouched — orgs/{orgId}/{allPaths=**} already covers rendered pages"
  - "D-18: amended Phase 41's existing PENDING-VERIFICATION.md checkbox rather than adding a second deploy handoff — owner still runs exactly one firebase deploy --only firestore:rules"

patterns-established:
  - "Rules-fix regression proof: write the assertion against CURRENT behavior first (assertSucceeds), commit it standalone, then flip to assertFails in the fix commit — makes the RED->GREEN transition visible in git history without a formal TDD gate"

requirements-completed: [R080]

coverage:
  - id: D1
    description: "An org editor's client-SDK write to organizations/{orgId}/pptxRenders/{importId} is denied by the emulator after this plan; the pre-fix write succeeding was proven first"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/rules.test.ts#pptxRenders — org-member read, no client write > DENY (T-42-01, was PROBE pre-fix) — an org editor cannot write a pptxRenders doc via the generic wildcard"
        status: pass
    human_judgment: false
  - id: D2
    description: "A viewer-role org member can read organizations/{orgId}/pptxRenders/{importId}; a foreign-org editor and an unauthenticated caller cannot"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/rules.test.ts#pptxRenders — org-member read, no client write > ALLOW (D-02) — a viewer-role member of orgA reads a pptxRenders doc"
        status: pass
      - kind: unit
        ref: "src/rules.test.ts#pptxRenders — org-member read, no client write > DENY (T-42-03) — an editor of a DIFFERENT org cannot read orgA's pptxRenders doc"
        status: pass
      - kind: unit
        ref: "src/rules.test.ts#pptxRenders — org-member read, no client write > DENY (T-42-03) — an unauthenticated caller cannot read orgA's pptxRenders doc"
        status: pass
    human_judgment: false
  - id: D3
    description: "The generic wildcard's write clause excludes services, slideGroups AND pptxRenders, documented in the same LOAD-BEARING voice as the first two"
    verification:
      - kind: unit
        ref: "grep -v '^\\s*//' firestore.rules | grep -c \"collection != 'pptxRenders'\" -> 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase 41's PENDING-VERIFICATION.md deploy handoff amended in place — no second deploy checkbox added, no deploy command run"
    verification:
      - kind: other
        ref: "grep -c 'firebase deploy --only firestore:rules' .planning/PENDING-VERIFICATION.md — 2 before and after (both pre-existing, unrelated to this phase); grep -c pptxRenders -> 6, all inside the Phase 41 entry"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-07
status: complete
---

# Phase 42 Plan 01: Close the pptxRenders write hole, grant member-tier read Summary

**Closed a live-in-production Firestore write hole letting any org editor forge a `pptxRenders` render-status doc to `ready`, and made read access an intentional member-tier grant instead of an accident of wildcard fallthrough — both proven RED-then-GREEN against the real emulator.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-07T09:48:12Z
- **Completed:** 2026-08-07T09:55:42Z
- **Tasks:** 3
- **Files modified:** 3 (`firestore.rules`, `src/rules.test.ts`, `.planning/PENDING-VERIFICATION.md`)

## Accomplishments

- Proved the phase's contested premise (D-01) with an executed emulator assertion, not a reading:
  an org editor's `updateDoc` on `organizations/orgA/pptxRenders/import-1` **succeeded** against the
  unmodified `firestore.rules` — confirming `functions/src/index.ts:144-148`'s "the catch-all denies
  client access" claim was wrong, exactly as 42-CONTEXT.md's SUPERSEDED correction block predicted.
- Closed the hole: `firestore.rules`'s generic single-segment wildcard now excludes `pptxRenders` from
  its `allow write` clause (third exclusion alongside `services`/`slideGroups`), and a dedicated
  `match /pptxRenders/{importId} { allow read: if isOrgMember(orgId); }` block grants read at member
  tier — proven with the same assertion flipped from `assertSucceeds` to `assertFails`, plus an ALLOW
  case (viewer-role read) so the fix is proven both ways, not just deny-only (CLAUDE.md's mandate).
- Amended Phase 41's existing `PENDING-VERIFICATION.md` deploy checkbox rather than adding a second
  handoff — the owner still has exactly one `firebase deploy --only firestore:rules` to run, and its
  text now names the live production exposure explicitly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — prove the pptxRenders write hole exists, in the emulator, before changing anything** - `4bead11` (test)
2. **Task 2: Close the write hole, grant member-tier read, and flip the suite to ALLOW + DENY** - `c58bd40` (fix)
3. **Task 3: Amend Phase 41's pending deploy handoff — do not add a second one** - `9e10878` (docs)

**Plan metadata:** (this commit, following)

## Rules Suite: Before/After Case Counts (same style as `41-01-SUMMARY.md`)

| Point | `src/rules.test.ts` test count | Notes |
|---|---|---|
| Before Task 1 | 120 | baseline, unchanged from Phase 41 |
| After Task 1 (probe added) | 121 | `PROBE (pre-fix)` case, `assertSucceeds` — **PASSED** against unmodified rules |
| After Task 2 (fix + full suite) | 125 | probe flipped to `assertFails` (now named `DENY (T-42-01, was PROBE pre-fix)`) + 4 new cases (ALLOW read, 2 DENY reads, 1 DENY create) |
| Full rules suite (`src/rules.test.ts` + `src/storage.rules.test.ts`) | **138/138 passing** | includes the storage suite's allow cases, run against a live Storage emulator this session |

**Task 1 probe — exact quoted result (pre-fix, run against unmodified `firestore.rules`):**
```
✓ src/rules.test.ts > pptxRenders — org-member read, no client write >
  PROBE (pre-fix) — an org editor CAN currently write a pptxRenders doc via the generic wildcard  359ms
Test Files  1 passed | 1 skipped (2)
     Tests  1 passed | 133 skipped (134)
```

**Task 2 flip — exact quoted result (post-fix):**
```
✓ src/rules.test.ts > pptxRenders — org-member read, no client write >
  DENY (T-42-01, was PROBE pre-fix) — an org editor cannot write a pptxRenders doc via the generic wildcard  282ms
✓ src/rules.test.ts > pptxRenders — org-member read, no client write >
  ALLOW (D-02) — a viewer-role member of orgA reads a pptxRenders doc — the grant is member-tier, not editor-tier  120ms
✓ src/rules.test.ts > pptxRenders — org-member read, no client write >
  DENY (T-42-03) — an editor of a DIFFERENT org cannot read orgA's pptxRenders doc  110ms
✓ src/rules.test.ts > pptxRenders — org-member read, no client write >
  DENY (T-42-03) — an unauthenticated caller cannot read orgA's pptxRenders doc  89ms
✓ src/rules.test.ts > pptxRenders — org-member read, no client write >
  DENY (D-02) — a viewer-role member of orgA cannot create a new pptxRenders doc  75ms
Test Files  1 passed | 1 skipped (2)
     Tests  5 passed | 133 skipped (138)
```

**Full unfiltered rules suite:**
```
✓ src/rules.test.ts (125 tests) 9531ms
✓ src/storage.rules.test.ts (13 tests) 4075ms
Test Files  2 passed (2)
     Tests  138 passed (138)
```
Ran via `npx vitest run --config vitest.rules.config.ts` against an already-running Firestore/Storage
emulator (port 8080/9199 were occupied, so `npm run test:rules`'s own emulator spin-up was skipped per
CLAUDE.md's documented fallback).

## Files Created/Modified

- `firestore.rules` — new `match /pptxRenders/{importId}` block (read only, member tier); generic
  wildcard's `allow write` clause extended with `collection != 'pptxRenders'`; comment block extended
  to document the third exclusion in the same "LOAD-BEARING" voice as the first two.
- `src/rules.test.ts` — new `describe('pptxRenders — org-member read, no client write')` block:
  1 write-DENY (formerly the pre-fix probe), 1 read-ALLOW (viewer role), 2 read-DENY (cross-org editor,
  unauthenticated), 1 create-DENY (viewer role, no create path exists).
- `.planning/PENDING-VERIFICATION.md` — Phase 41's entry amended with a Phase 42-01 update block and
  an extended deploy checkbox naming both phases' clauses; no second `## Phase 42` section or duplicate
  deploy checkbox added.

## Decisions Made

- Confirmed D-01/D-02's premise with an emulator write rather than trusting the rules-file reading in
  `42-CONTEXT.md` — the PROBE task existed specifically because that premise contradicted
  `functions/src/index.ts:144-148`'s own comment, and CLAUDE.md's standing lesson ("a test explained
  away as an environment quirk is an untested assertion") applies equally to a claim never tested at all.
- Kept the read grant at member tier (`isOrgMember`), not editor tier, per D-02 — a viewer already sees
  the deck's parsed content and structure through `importedSlides`/`slideGroups`, so render status
  (`status`, `renderedCount`, `failureReason`) carries no additional sensitivity (T-42-02, accepted).
- Left `storage.rules` untouched per D-17 — rendered pages already fall under the existing
  `orgs/{orgId}/{allPaths=**}` org-member read grant.
- Amended Phase 41's existing deploy checkbox instead of adding a second one (D-18) — one deploy still
  covers both phases' `firestore.rules` clauses.

## Deviations from Plan

None — plan executed exactly as written. The premise was NOT falsified (Task 1's probe passed exactly
as the plan anticipated as the primary branch), so Task 2 and Task 3 proceeded as planned.

## Issues Encountered

None. A Firestore + Storage emulator was already running locally (port 8080/9199 occupied), so
`npm run test:rules`'s own emulator spin-up would have hit a port conflict — used the documented
CLAUDE.md fallback (`npx vitest run --config vitest.rules.config.ts` against the running emulator)
instead, exactly as anticipated by the plan's `<read_first>` guidance.

## User Setup Required

None — no external service configuration required. **A deploy remains outstanding** (unrelated to user
setup): the owner must still run `firebase deploy --only firestore:rules` per the amended Phase 41
entry in `.planning/PENDING-VERIFICATION.md`. Until that deploy lands, the write hole this plan closes
in the *rules source* remains live in *production*.

## Next Phase Readiness

- The `pptxRenders` read path is now intentional and emulator-proven at member tier — every later plan
  in this phase (42-02 through 42-08) that subscribes to `organizations/{orgId}/pptxRenders/{importId}`
  from a browser client can rely on this grant.
- No blockers for 42-02. The one open item — the owner's single, still-undeployed
  `firebase deploy --only firestore:rules` — is disclosed and tracked, not a blocker to further
  client-side development (per the standing autonomy grant, deploys are the owner's step).

---
*Phase: 42-powerpoint-rendered-image-display*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: firestore.rules
- FOUND: src/rules.test.ts
- FOUND: .planning/PENDING-VERIFICATION.md
- FOUND: .planning/phases/42-powerpoint-rendered-image-display/42-01-SUMMARY.md
- FOUND: 4bead11 (Task 1 commit)
- FOUND: c58bd40 (Task 2 commit)
- FOUND: 9e10878 (Task 3 commit)
