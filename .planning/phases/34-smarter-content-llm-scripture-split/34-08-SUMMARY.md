---
phase: 34-smarter-content-llm-scripture-split
plan: 08
subsystem: content-model
tags: [vue, typescript, vitest, scripture, phase-gate, requirements, roadmap]

# Dependency graph
requires:
  - phase: 34-smarter-content-llm-scripture-split (plans 05-07)
    provides: "The composed slot -> group -> slide path this plan asserts end to end: ScriptureSlot.congregationalSections, congregationalSlideFieldsFromSlot, both slideshowAssembler call sites, the CongregationalEditor prop/emit rewrite, and the keyed modal mount on the scripture slide"
  - phase: 34-smarter-content-llm-scripture-split (plans 09-12)
    provides: "R070 (background at presentation time), R071 (no-credentials explanation), the merged group-media panel, and the save-status chrome gate — the four owner UAT findings this plan's records must keep distinct from R064"
provides:
  - "congregationalReadingPipeline.test.ts — the composed contract proof 34-VERIFICATION.md's Truth 1 found missing"
  - "34-VALIDATION.md's Gap Closure section covering all eight closure plans with the correct requirement per row"
  - "PENDING-VERIFICATION.md item 34.2 resolved with the full mount-seam decision; items 34.3-34.6 opened, none self-approved"
  - "REQUIREMENTS.md: R064's delivered-shape note describes R064 only and names both open human items; R070 names its open item; R071 flips to Complete with the F5 verdict"
  - "ROADMAP.md Phase 34 at 12/12 plans executed"
affects: [35-presentation-correctness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composition proof, not another unit test — a dedicated pipeline test file that reuses existing fixture-building helpers (scriptureSlot, makeInputs) but asserts across both materialization paths and a rebuild in one place, because the failure this phase closed was precisely that every individual piece passed while the composition reached no user"
    - "Inlining a consumer's own predicate instead of importing it, so the test proves AGREEMENT rather than assuming it: the pipeline test restates PresentationViewer's isCongregational condition verbatim rather than importing the component"

key-files:
  created:
    - src/utils/__tests__/congregationalReadingPipeline.test.ts
  modified:
    - .planning/phases/34-smarter-content-llm-scripture-split/34-VALIDATION.md
    - .planning/PENDING-VERIFICATION.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "R064's delivered-shape note was rewritten (not merely re-checked) even though the checkbox was already [x] — see Deviations. The note now names both open human items (34.1, 34.3) in the same breath as the delivery, and explicitly scopes itself to R064 only, keeping F2-F5 and R070/R071 out of its text."
  - "The gap-closure verification table in 34-VALIDATION.md assigns R070 to 34-09, R040/R041 to 34-10, R055 to 34-11, and R071 to 34-12 — deliberately NOT R064 for every row, per the plan's explicit instruction not to restate the false premise this phase already had to correct once."
  - "All three phase gates (type-check, vitest --dir src, build) were run BEFORE any REQUIREMENTS.md/ROADMAP.md edit, per the plan's explicit sequencing. The failing file set matched the documented 2-file baseline exactly (storage.rules.test.ts, RosterView.test.ts) — not a regression — so all three requirement statuses were corrected together."

requirements-completed: [R064]

coverage:
  - id: D1
    description: "congregationalReadingPipeline.test.ts asserts the composed slot -> group -> slide contract: fallback/stored-group parity, rebuild stability, same-speaker adjacency, text-adjacency partition proof, both backward-compatibility shapes, non-ASCII encoding backstop, and the inlined PresentationViewer predicate"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/congregationalReadingPipeline.test.ts (10 tests, ≥9 required)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "34-VALIDATION.md extended with a Gap Closure section (not overwritten) covering a task from all eight closure plans (34-05..34-12), each with a non-empty automated command and the correct requirement column"
    requirement: "R064"
    verification:
      - kind: other
        ref: 'grep -c "Gap Closure (plans 34-05" .planning/phases/34-smarter-content-llm-scripture-split/34-VALIDATION.md (2)'
        status: pass
    human_judgment: false
  - id: D3
    description: "PENDING-VERIFICATION.md item 34.2 resolved with the mount seam, the keyed-mount test, and the 2026-08-03 owner decision; items 34.3-34.6 opened as new, unapproved deferrals; item 34.1 untouched"
    requirement: "R064"
    verification:
      - kind: other
        ref: 'grep -c "34.3" .planning/PENDING-VERIFICATION.md (1); manual read confirms 34.1 still ☐, 34.4/34.5/34.6 all ☐'
        status: pass
    human_judgment: false
  - id: D4
    description: "The three-command phase gate (type-check, vitest --dir src, build) is green against the documented baseline, run BEFORE any status edit; R064/R070/R071 statuses in REQUIREMENTS.md and the ROADMAP Phase 34 plan count now match observed delivery"
    requirement: "R064"
    verification:
      - kind: other
        ref: "npm run type-check exit 0; npx vitest run --dir src: 2420/2429 passing, failing file set = documented 2-file baseline exactly; npm run build exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 60min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 08: Composed Pipeline Proof and Phase Gate Summary

**Proved the slot -> group -> slide composition end to end in one test file, extended the validation record without disturbing what was already there, resolved the blocking PENDING-VERIFICATION item and opened four new (unapproved) ones, ran the full three-command phase gate, and corrected R064/R070/R071 to match what the gate actually observed.**

## Performance

- **Duration:** ~60 min (including a ~4.5 min `npx vitest run --dir src` full-suite run)
- **Completed:** 2026-08-03T22:04:22-04:00
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- **The composition itself is now asserted, not merely inferred from three green test files.** `congregationalReadingPipeline.test.ts` (10 tests) proves: exactly ONE scripture slide for a three-section slot on both the fallback and stored-group materialization paths; deep-equal `readingMode`/`sections` across those two paths; stability of the stored sections across a `buildInitialGroup` -> `rebuildGroup` -> reassemble cycle; two consecutive same-speaker (`CONGREGATION`) sections surviving unmerged; a text-adjacency partition proof (concatenating the assembled sections reproduces the source passage exactly); both backward-compatibility shapes (absent and empty `congregationalSections` both yield `readingMode: 'normal'`, `text: ''`, `verseRange: ''`, no `sections` key); a non-ASCII (curly quotes, em dash) strict `===` round-trip; and agreement with `PresentationViewer.vue`'s own `isCongregational` predicate, restated inline rather than imported so the test proves agreement rather than assuming it.
- **34-VALIDATION.md gained a `Gap Closure (plans 34-05 .. 34-12)` section**, appended after the pre-existing `Manual-Only Verifications` section with every pre-existing heading left untouched. The new per-task table carries the CORRECT requirement per row — not R064 for all twelve plans: R070 for 34-09, R040/R041 for 34-10, R055 for 34-11, R071 for 34-12 — plus the two CLAUDE.md/STATE.md test-command hazards (the `vue-tsc --build` type gate, the `--dir src` scoping to dodge the `render-service/` substring collision) and a Manual-Only Verifications subsection for what jsdom genuinely cannot judge.
- **PENDING-VERIFICATION.md item 34.2 is now fully resolved** with the mount seam, the keyed-mount test, and the explicit 2026-08-03 owner decision (no free-text scripture override). Four new items opened, none self-approved: 34.3 (the now-reachable feature end to end), 34.4 (background scrim legibility, UAT F3), 34.5 (merged group-media panel, UAT F2), 34.6 (the org document's PC credential fields — presence/absence only). Item 34.1 is untouched.
- **The phase gate ran clean, in the required order (gate first, then records).** `npm run type-check` exits 0. `npx vitest run --dir src`: 2420/2429 passing; the failing FILE SET is exactly the documented baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts` — 9 tests, 2 files) — not a regression. `npm run build` succeeds.
- **R064, R070 and R071 all now match what the gate observed.** R064's delivered-shape note was rewritten to describe R064 only (structural guarantee + reachability closure, the keyed mount, the 2026-08-03 owner decision) and names both remaining open human items (34.1, 34.3) in the same breath as the delivery rather than a footnote. R070 gained a one-line note naming `currentBackgroundUrl`/scrim/video-precedence and open item 34.4. R071 flipped `[ ]` -> `[x]` with a note naming the F5 verdict and open item 34.6; its traceability row moved `Pending` -> `Complete`. `ROADMAP.md` Phase 34 now reads `12/12 plans executed`, and the planning-corrections note gained a closing paragraph distinguishing R064's reachability closure from the four owner UAT findings.

## Task Commits

Each task was committed atomically:

1. **Task 1: Assert the composed slot -> group -> slide contract in one place** - `92d1f74` (test)
2. **Task 2: Extend the validation strategy and resolve the blocking PENDING-VERIFICATION item** - `7767b4f` (docs)
3. **Task 3: Correct R064, R070 and R071 and the roadmap to match delivery, then run the phase gate** - `0050344` (docs)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `src/utils/__tests__/congregationalReadingPipeline.test.ts` — NEW. 10 tests proving the composed contract across both materialization paths and a rebuild.
- `.planning/phases/34-smarter-content-llm-scripture-split/34-VALIDATION.md` — `nyquist_compliant: false -> true`; new `Gap Closure (plans 34-05 .. 34-12)` section (per-task table, test-command hazards note, Manual-Only Verifications subsection); Validation Sign-Off boxes ticked where the new section satisfies them.
- `.planning/PENDING-VERIFICATION.md` — item 34.2 gains the explicit 2026-08-03 mount-seam decision sentence (no free-text override); items 34.3, 34.4, 34.5, 34.6 added, all `☐`; item 34.1 untouched.
- `.planning/REQUIREMENTS.md` — R064's delivered-shape note rewritten to describe R064 only and name open items 34.1/34.3; R070 gains a one-line delivered-shape note naming open item 34.4; R071 flips to `[x]` with a delivered-shape note naming the F5 verdict and open item 34.6; R071's traceability row moves `Pending` -> `Complete`.
- `.planning/ROADMAP.md` — Phase 34's `**Plans**:` line moves `11/12` -> `12/12`; `34-08-PLAN.md` checked off; planning-corrections note gains a closing paragraph.

## Decisions Made

- **Reused, not reinvented, existing fixture-building helpers.** The pipeline test's `makeService`/`makeInputs`/slot-fixture shapes mirror `slideshowAssembler.test.ts`'s established builders rather than inventing a second convention, per the plan's explicit instruction.
- **The gap-closure verification table assigns the requirement per PLAN, not blanket R064** — 34-09 -> R070 (plus R055/R056 context), 34-10 -> R040/R041, 34-11 -> R055, 34-12 -> R071 — because restating R064 across all twelve plans would repeat exactly the false premise 34-VERIFICATION.md already had to correct once (see Deviations below for the related finding).
- **Gate before records, strictly.** All three gate commands ran and were confirmed green before REQUIREMENTS.md/ROADMAP.md were touched in Task 3, per the plan's explicit sequencing and the standing autonomy grant's "never record a deferred check as passed."

## Deviations from Plan

### Reconciliation of the three prior deviations named in this plan's instructions

1. **34-11's `canWriteGroupMedia` song-group carve-out direction.** Confirmed by reading `SlideGrid.vue`'s `canWriteGroupMedia` computed and its own code comment directly: the gate deliberately omits the song-group exclusion `canMutateGroup` applies, so a song group keeps group-media write access on a draft service while remaining unable to mutate its slides. The shipped regression test in `SlideGrid.test.ts` (34-11 Task 2) matches this verified behavior, not the plan's literal (opposite-direction) wording. **Conclusion: the code and the shipped test are correct; the plan's acceptance-criteria wording was imprecise.**
2. **34-12's "for a draft service with credentials configured" acceptance criterion.** Confirmed by reading `ServiceEditorView.vue`'s Export-to-PC / Copy-for-PC template block: the gate is purely `v-if="authStore.hasPcCredentials"` / `v-else`, with no service-status condition anywhere in it. The shipped test in `ServiceEditorView.test.ts` (34-12 Task 3) asserts Copy for PC renders for a draft service with **no** credentials — the actual, unaffected behavior. **Conclusion: the code and the shipped test are correct; the plan's phrasing described a stale in-template comment, not the real `v-if`.**
3. **34-06's `update:sections` emission-count assertions.** Confirmed by reading `CongregationalEditor.vue`'s `canAiSplit` gating: the AI-split control can only become enabled after a successful Fetch Passage, which itself always emits `update:sections` once. Reaching an AI-split-failure state therefore always follows at least one prior `update:sections` emission, so a literal "is `undefined`" assertion is unreachable without contradicting the plan's own documented constraint. The two failure-path tests instead capture the emission count immediately before the failed split and assert it is unchanged immediately after. **Conclusion: the tests correctly prove the failed split itself adds zero emissions, which is the behavior the literal wording was trying to establish; the plan's literal phrasing was unreachable as written.**

All three read as plan-text imprecision rather than code defects, confirmed against live source in each case, not assumed.

### New finding: two requirement statuses were flipped out of turn, before this plan's phase gate ran

**Found during:** Task 3's `<read_first>` review of `REQUIREMENTS.md`, before any edit.

**Issue:** This plan's own frontmatter (`gap_closure: true`, and its Task 3 instructions) establishes that ONLY 34-08's phase gate is supposed to flip R064/R070/R071's statuses, conditional on the gate passing — 34-12's own SUMMARY explicitly names this convention ("its traceability row reads `Pending`, matching the convention that only 34-08's phase gate flips statuses to `Complete`"). Despite that, `git log` shows two prior plans' own `docs(...)` completion commits already flipped statuses ahead of the gate: 34-07's completion commit (`4250158`) flipped R064 from `[~]` to `[x]` and its traceability row from `Partial` to `Complete`; 34-09's completion commit similarly landed R070 as `[x]` from the start. Both are the same "flip before the gate confirms it" pattern this very plan's frontmatter warns against ("R064 was already flipped to Complete in error once and had to be corrected — do not repeat that by writing an optimistic status").

**Resolution:** This plan's Task 3 ran the full three-command phase gate FIRST regardless of the pre-existing checkbox state, and it passed clean (see Accomplishments). Because the gate genuinely passed, no revert was warranted — reverting a status to `[~]`/`Pending` only to immediately re-flip it to `[x]`/`Complete` moments later would add pure churn with no correctness benefit. Instead, Task 3 rewrote both entries' delivered-shape notes in full to meet this plan's actual content requirements (R064 scoped to R064 only, naming both open human items; R070 naming its open item) regardless of what the checkbox already said, and R071 — which had NOT been prematurely flipped — was flipped for the first time here, by this plan, after the gate confirmed it. Not reverted, not silently left as-is: documented here as a process deviation in two prior plans' own executor runs, distinct from anything this plan itself introduced.

**Files affected:** None modified beyond what Task 3 already needed to touch (`REQUIREMENTS.md`). No code change.

**Impact:** None on delivered behavior — the gate's actual outcome validates both premature flips were factually correct, just made out of the sequence this phase's own design specifies. Recorded per Rule-1-adjacent "auto-fixed process finding," not silently absorbed.

---

**Total deviations:** 1 new process finding (documented, not code-affecting) + 3 reconciliations of prior plans' documented deviations (all confirmed correct against live source, no further action needed).

## Issues Encountered

None beyond the process finding documented above. The full `npx vitest run --dir src` run took ~4.5 minutes (2429 tests across 80 files) and was run in the background per the environment's 120s foreground timeout; its exit code and failing-file-set were confirmed via the background task's completion output before any record was edited.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None. No new component or view was built by this plan; the pipeline test file exercises only existing pure functions with no hardcoded empty values flowing to a render path.

## Threat Flags

None. All four threats in this plan's `<threat_model>` were mitigated directly: the R064 status flip was made conditional on the three observed gates (T-34-08-01); the pipeline test asserts both materialization routes plus a rebuild produce identical sections (T-34-08-02); the backward-compatibility cases confirm a cleared slot returns to the reference-only shape (T-34-08-03); and the phase gate is exactly the three specified commands with no file under `functions/` or `render-service/` touched (T-34-08-04, confirmed by `git diff --stat` returning empty for both paths).

## Next Phase Readiness

- **Phase 34 is complete: 12/12 plans executed.** R064's reachability gap (34-VERIFICATION.md Truth 1) is closed and now composition-tested, not just piece-tested. R070 and R071 (the two requirements the UAT plans had to write) are both delivered and distinguished from R064's own scope throughout the record.
- **Six items remain open in PENDING-VERIFICATION.md for Phase 34**, all correctly unapproved: 34.1 (empirical split determinism, live Anthropic API required), 34.3 (the now-reachable feature end to end, live UI), 34.4 (background scrim legibility on a real projector), 34.5 (merged group-media panel reads as one), 34.6 (the org document's actual PC credential presence/absence — never values).
- No blockers. Nothing under `functions/` or `render-service/` was touched; nothing was deployed, containerized, or provisioned.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 5 created/modified files verified present on disk; all 3 task commits (`92d1f74`, `7767b4f`, `0050344`) verified present in git log.
