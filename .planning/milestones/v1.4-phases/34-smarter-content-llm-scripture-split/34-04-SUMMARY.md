---
phase: 34-smarter-content-llm-scripture-split
plan: 04
subsystem: ui
tags: [vue, congregational-reading, ai-split, toasts, r064]

requires:
  - phase: 34-smarter-content-llm-scripture-split (plan 01)
    provides: "computeBoundaries, hasSplittableBoundaries — gates the affordance's visibility"
  - phase: 34-smarter-content-llm-scripture-split (plan 03)
    provides: "splitCongregationalReading(rawText): Promise<CongregationalSection[] | null> — never throws internally, awaited directly"
provides:
  - "data-testid=\"ai-split-btn\" opt-in affordance in CongregationalEditor.vue — the phase's only new data-testid"
  - "onAiSplit(): wholesale-replace-on-success, untouched-on-failure, single R041 failure toast via useToasts"
  - "Two open Phase 34 entries in .planning/PENDING-VERIFICATION.md: empirical split determinism, and the owner decision blocking editor reachability"
affects: []

tech-stack:
  added: []
  patterns:
    - "Additive AI affordance pattern: gate visibility with a pure structural check (hasSplittableBoundaries), wholesale-replace on success, untouched-plus-toast on any failure path (null or thrown) — no merge, no partial application, ever"

key-files:
  created: []
  modified:
    - src/components/CongregationalEditor.vue
    - src/components/__tests__/CongregationalEditor.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "Split Task 1/Task 2 into two genuine RED/GREEN cycles rather than combining them (unlike 34-03's justified combination) — Task 1's onAiSplit deliberately has no catch/toast wiring, so Task 2's null/reject tests were genuinely RED against Task 1's code (confirmed by two real 'Unhandled Rejection' warnings from vitest), not simulated RED."
  - "sectionsSnapshot() reads DOM (speaker-toggle text + preview-section text) rather than an internal expose, since sections itself is not part of the component's public seam (only currentReadingId is, for the unrelated E4 backstop) — the DOM is the honest external observation point for 'did anything change' on a failure."
  - "Fixed a TS18048 possibly-undefined on a regex match-group index in a new test (unrelated pre-existing gap in the file, but introduced by this plan's own test) — Rule 1 auto-fix, one-line non-null assertion."

patterns-established:
  - "Pattern: an opt-in AI affordance beside an existing manual action mirrors the manual button's exact class-binding/spinner/label structure so the two read as one control group, rather than introducing new visual language."

requirements-completed: [R064]

coverage:
  - id: D1
    description: "A passage yielding fewer than two legal boundaries cannot be split — ai-split-btn is disabled and no call is issued; the manual sections from the fetch remain exactly as built"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#AI split (34-04, Task 1) > empty edge: stays disabled and issues no split call..."
        status: pass
    human_judgment: false
  - id: D2
    description: "A successful split replaces sections wholesale in the returned order (never merged, appended, or re-sorted), and rendered text is strictly === to the returned text including non-ASCII punctuation"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#AI split (34-04, Task 1) > on success, replaces sections wholesale..."
        status: pass
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#AI split (34-04, Task 1) > encoding backstop: rendered section text is strictly === ..."
        status: pass
    human_judgment: false
  - id: D3
    description: "Every failure path (null result, thrown/rejected call) pushes exactly one verbatim useToasts message, leaves sections byte-identical to a pre-click snapshot, clears isSplitting so the button recovers, and pushes zero toasts on success"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#AI split (34-04, Task 2) — 5 tests covering null/reject toast+snapshot, isSplitting recovery, zero-toast-on-success"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pre-existing manual-flow test suite (19 tests) passes completely unmodified, and a dedicated regression test confirms the manual speaker-toggle and manual Fetch Passage flow both keep working after a failed AI split"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts — all 19 pre-existing tests + #AI split (34-04, Task 2) > regression: after a failed split..."
        status: pass
    human_judgment: false
  - id: D5
    description: "The two items this phase cannot close itself (empirical split determinism on Psalm 136/24; the owner decision blocking CongregationalEditor.vue's reachability) are recorded, open, unresolved, in .planning/PENDING-VERIFICATION.md"
    verification:
      - kind: other
        ref: "node -e verification script asserting Psalm 136/24 and 'CongregationalEditor'/'mounted nowhere' text present — see Task 3 <verify> block"
        status: pass
    human_judgment: true
    rationale: "Both entries are explicitly owner-only: one needs a live Anthropic API call this environment cannot make, the other needs an owner decision this plan was told not to make. Neither may ever be marked passed by an automated step."

duration: ~35min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 04: The Opt-In "Split with AI" Affordance Summary

**Wired `splitCongregationalReading()` into `CongregationalEditor.vue` as an explicit, gated, opt-in `data-testid="ai-split-btn"` that either replaces sections wholesale or changes nothing and says so via one R041 toast — closing R064 end to end while recording the two things this phase cannot settle by itself: empirical split determinism (needs a live API call) and the editor's total unreachability in production (needs an owner decision).**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-03
- **Tasks:** 3 (two `tdd="true"`, one plain `auto`)
- **Files modified:** 3 (2 existing source/test files, 1 existing planning doc)

## Accomplishments

- **Task 1 — the affordance.** Added `data-testid="ai-split-btn"` beside the existing Fetch Passage
  button, mirroring its disabled/spinner/label structure exactly. `canAiSplit` is a computed gated by
  `rawText.value.length > 0 && hasSplittableBoundaries(computeBoundaries(rawText.value))` (34-01's
  exports, called live on the component's own state — no mock, no duplication of the boundary logic).
  `onAiSplit()` awaits `splitCongregationalReading(rawText.value)` (34-03) and, on a non-null result,
  assigns `sections.value = result` — a whole replacement, never a merge, never a sort. `isSplitting`
  clears in a `finally` so the button always recovers. `onFetchPassage`, `buildAlternatingSections`,
  `toggleSpeaker`, `doAutoSave`, the `useAutoSave` call, `onMounted`, `onUnmounted` and `defineExpose`
  are byte-unchanged — confirmed by `git diff`, which shows only the new button/imports/state/handler
  hunks.
- **Task 2 — the failure path.** `onAiSplit` now wraps the awaited call in try/catch. A `null` result
  and a thrown/rejected call both push the same verbatim toast via the existing `useToasts` store
  (Phase 32/R041's failure-only surface — no success variant added, none needed) and leave
  `sections.value` completely untouched — no clearing, no placeholder, no partial array. A comment above
  the `catch` records this as R064's "additive and never blocking" guarantee in code. No new inline
  error element and no new `data-testid` were added — `ai-split-btn` remains the phase's only one,
  proven by a dedicated inventory test that scans the rendered HTML for every `data-testid` and asserts
  each belongs to a known prefix.
- **Task 3 — the two items this phase cannot close.** Appended a `## Phase 34` section to
  `.planning/PENDING-VERIFICATION.md` (after Phase 33, matching the file's existing per-phase format,
  nothing clobbered) with two entries, both recorded open (`☐`), neither self-approved:
  1. Empirical split determinism on Psalm 136 (repeated congregational refrain) and Psalm 24
     (call-and-response), run more than once each — genuinely deferred, since no live Anthropic API
     access exists in this environment and a fixture would give false confidence about exactly what's
     under test. Names the comma-exclusion tuning knob (34-01's `CLAUSE_END_PATTERN`) as the first thing
     to revisit if real output reads wrong.
  2. The owner decision blocking reachability: `CongregationalEditor.vue` is mounted nowhere in
     production (no route, no parent, no dynamic import outside its own test), so ROADMAP success
     criterion 1 is false today for an actual user. Records both persistence-shape options (re-link the
     separate `ScriptureReading` document — explicitly rejected by R047 — vs. add
     `congregationalSections` to `ScriptureSlot` and carry it through `slideGroupMaterializer`, the
     direction R047 actually took) and the `WR-04` call-site contract (`readingId`-keyed mount required)
     for whoever eventually wires this up.
- Ran `requirements mark-complete R064` — this plan's explicit responsibility as the phase's last plan,
  since R064's full end-to-end claim (the model layer + validator + call shape + UI wiring, all
  reachable together) isn't true until this plan lands. 34-01/34-02/34-03 all correctly declined it.

## Task Commits

1. **Task 1 RED — failing tests for the affordance** — `89b2e43` (test)
2. **Task 1 GREEN — wire the affordance** — `bca1458` (feat)
3. **Task 2 RED — failing tests for the failure path** — `f736b3f` (test)
4. **Task 2 GREEN — failure toast + untouched sections** — `8635896` (feat)
5. **Task 3 — the two PENDING-VERIFICATION.md entries** — `000aa73` (docs)

**Plan metadata:** committed below (`docs(34-04): complete plan`).

_Note: both TDD tasks followed a genuine RED → GREEN cycle — confirmed for Task 2 by two real
"Unhandled Rejection" warnings vitest printed against the pre-fix component (the null-result and
reject-path toast assertions failed with `expected [] to have a length of 1 but got +0`), not a
simulated or combined RED state._

## Files Created/Modified

- `src/components/CongregationalEditor.vue` (modified, additive) — new `ai-split-btn` button, new
  imports (`splitCongregationalReading`, `computeBoundaries`, `hasSplittableBoundaries`, `useToasts`),
  new `isSplitting`/`canAiSplit`/`onAiSplit`/`AI_SPLIT_FAILURE_TEXT` symbols, and a `const toasts =
  useToasts()` store instance. Everything else in the file is unchanged.
- `src/components/__tests__/CongregationalEditor.test.ts` (modified, additive) — new
  `splitCongregationalReading` mock (`vi.mock('@/utils/claudeApi', ...)`), a `useToasts` import, and two
  new nested `describe` blocks (13 new tests total: 7 for Task 1, 6 for Task 2) appended after the last
  pre-existing test. No pre-existing test's body was touched.
- `.planning/PENDING-VERIFICATION.md` (modified, additive) — one new `## Phase 34` section with two
  entries, inserted after the existing Phase 33 section and before `## Notes and failures`. No prior
  content was altered.

## Decisions Made

- **Genuinely separate RED/GREEN cycles per task**, rather than 34-03's justified single-commit
  combination — Task 1's `onAiSplit` intentionally shipped without a `catch`/toast, so Task 2's new
  null/reject tests were real RED against real code, not a simulated gate. See Task Commits note above.
- **`sectionsSnapshot()` reads the DOM**, not an internal `sections` expose, for the failure-path
  "unchanged" assertions — `sections` is not part of this component's public test seam (only
  `currentReadingId` is, exposed for the unrelated E4 partial-backstop test), so extending the seam
  just for this plan's tests would have been scope creep. The DOM is the honest external observation
  point.
- **Fixed a `TS18048` possibly-undefined** on a regex match-group access in the new data-testid
  inventory test (`m[1]` from `matchAll`) — a Rule 1 auto-fix (own test bug, not the plan), one-line
  non-null assertion, caught by `npm run type-check` before the Task 2 commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in my own test, not the plan] Possibly-undefined regex match group**
- **Found during:** Task 2, `npm run type-check` after the GREEN implementation
- **Issue:** `[...html.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1])` types `m[1]` as
  `string | undefined` under `vue-tsc --build`'s stricter test-file checking (the exact gap this
  project's own `CLAUDE.md` calls out — `-p tsconfig.app.json` would have silently skipped this file).
- **Fix:** Added a non-null assertion (`m[1]!`) — safe because the capture group is guaranteed present
  by the regex's own structure (a mandatory, non-optional group).
- **Files modified:** `src/components/__tests__/CongregationalEditor.test.ts`
- **Verification:** `npm run type-check` clean afterward; test still passes.
- **Committed in:** `8635896` (part of the Task 2 GREEN commit).

---

**Total deviations:** 1 auto-fixed (Rule 1, own-test bug caught by the type gate).
**Impact on plan:** None on scope or design — a one-line type-narrowing fix in a test this plan itself
wrote, caught by the exact gate `CLAUDE.md` documents as load-bearing.

## Issues Encountered

None beyond the self-caught type error above.

## User Setup Required

None — no external service configuration required. `functions/` is untouched, no package was
installed/upgraded/removed, and `package.json` is byte-unchanged (confirmed via `git diff --stat --
functions/ package.json src/types/`, which returned empty).

## Manual-Path Regression Confirmation

Per the plan's key constraint (P-03, "AI remains additive and never blocking"): all **19 pre-existing
tests in `CongregationalEditor.test.ts` pass completely unmodified** — not one assertion, fixture, or
mock in the pre-existing suite was touched. A dedicated new regression test additionally exercises the
manual speaker-toggle and the manual Fetch Passage flow **after** a failed AI split and confirms both
still work end to end, from a state the AI split had just failed against.

## Verification Evidence

- `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` — **32/32 pass** (19
  pre-existing unmodified + 7 Task 1 + 6 Task 2).
- `npm run type-check` (`vue-tsc --build`) — clean, at both the Task 1 and Task 2 gates (the Task 2 gate
  required the one-line fix above).
- `npx vitest run src/` — **2210 passed / 9 failed**, exact match to the documented baseline
  (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts` only). 2210 = 34-03's 2197 + 13
  new tests from this plan.
- `npm run build` — succeeds (`vite build` completes, `dist/` produced; one pre-existing chunk-size
  advisory warning, unrelated to this plan).
- `git diff --stat -- functions/ package.json src/types/` — empty. No file under `functions/` touched,
  `package.json` unchanged, no type in `src/types/` modified.
- `node -e "..."` (Task 3's own `<verify><automated>` check) — `ok`. Phase 34 section present in
  `.planning/PENDING-VERIFICATION.md` with both Psalm 136/24 and `CongregationalEditor`/"mounted
  nowhere" text confirmed present.
- `requirements mark-complete R064` — ran successfully; R064's checkbox and traceability-table row both
  flipped to complete.

## Next Phase Readiness

**Phase 34 is now code-complete.** R064's full claim — the structural correctness guarantee (boundary
indices, never model-supplied text, hard byte-match validation) *and* the additive UI wiring that never
degrades the manual path — is built and automated-tested end to end across all four plans in this
phase.

**Two things remain genuinely open, both recorded in `.planning/PENDING-VERIFICATION.md` § Phase 34,
neither self-approved:**

1. **Empirical split determinism** on Psalm 136 and Psalm 24 — needs a live Anthropic API call this
   environment cannot make.
2. **The owner decision blocking reachability** — `CongregationalEditor.vue` (and therefore this
   phase's entire AI split) is mounted nowhere in production. No user can reach it today. Resolving
   this requires the owner to choose between re-linking the rejected `ScriptureReading` document model
   or extending `ScriptureSlot` with `congregationalSections` and carrying it through
   `slideGroupMaterializer` — an owner-level data-model call this phase's plans were deliberately told
   not to make on the owner's behalf.

**No blockers for closing out Phase 34's plan work.** The phase's own gate results (above) are the
evidence a phase-level `/gsd-verify-work 34` or code review would need; both open items are
`human_needed`, matching the pattern already established for Phases 32 and 33.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: `src/components/CongregationalEditor.vue`
- FOUND: `src/components/__tests__/CongregationalEditor.test.ts`
- FOUND: `.planning/PENDING-VERIFICATION.md`
- FOUND: `.planning/phases/34-smarter-content-llm-scripture-split/34-04-SUMMARY.md`
- FOUND commit: `89b2e43` (test — Task 1 RED)
- FOUND commit: `bca1458` (feat — Task 1 GREEN)
- FOUND commit: `f736b3f` (test — Task 2 RED)
- FOUND commit: `8635896` (feat — Task 2 GREEN)
- FOUND commit: `000aa73` (docs — Task 3)
