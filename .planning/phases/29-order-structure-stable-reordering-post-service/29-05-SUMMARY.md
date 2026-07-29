---
phase: 29-order-structure-stable-reordering-post-service
plan: 05
subsystem: ui
tags: [vue, service-editor, section-model, print, planning-center, slideshow-assembly]

# Dependency graph
requires:
  - phase: 29-order-structure-stable-reordering-post-service (plan 03)
    provides: "Per-section render (slotSectionGroups), stable slot.id key, multi-instance Sortable lifecycle, empty-section placeholder shell in ServiceEditorView.vue — this plan's fifth section rides that machinery unmodified"
  - phase: 29-order-structure-stable-reordering-post-service (plan 04)
    provides: "SlideGrid.vue's stable reorder/append fix — proves the reorder mechanism is trustworthy before this plan widens the section count it operates over"
provides:
  - "'post-service' as the fifth, last SERVICE_SECTIONS member — purely additive, ServiceSlot.section stays optional, zero migration/backfill against shipped v1.0 documents"
  - "Post-Service-specific empty-placeholder copy (UI-SPEC §2) in ServiceEditorView.vue, the one Post-Service-specific piece of UI this phase is allowed to add"
  - "Confirmation-by-test audit of the four downstream consumers (useSlideshowAssembly.ts, ServicePrintLayout.vue, planningCenterExport.ts, SlidePlanRail.vue) — none needed a source change"
  - "Owner-verified real browser cross-section drag (jsdom-unreachable check)"
affects: [30, 35, 36, 37]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Widen-by-one-array-entry: every consumer that already iterates SERVICE_SECTIONS or service.slots in array order (rather than naming sections as literals) absorbs a new section with zero source changes — proven here, not assumed, by dedicated tests per consumer."

key-files:
  created: []
  modified:
    - src/types/service.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/utils/__tests__/slotTypes.test.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/components/__tests__/ServicePrintLayout.test.ts
    - src/utils/__tests__/planningCenterExport.test.ts

key-decisions:
  - "No migration, no backfill write, no source change beyond src/types/service.ts and the one placeholder-copy branch in ServiceEditorView.vue — every other file in scope is a test file, confirming rather than modifying consumer behavior."
  - "Post-Service gets a purpose-naming empty-placeholder copy variant (UI-SPEC §2) and nothing else distinguishing it visually — no icon, accent, or subtitle, per UI-SPEC §4's explicit instruction not to front-run Phase 36's Service Order rebuild."
  - "Every slot kind is accepted in Post-Service, proven by a dedicated test mounting SONG/IMPORTED/PRAYER slots all under section: 'post-service' with no per-section kind restriction anywhere in the render path."

requirements-completed: [R042, R043]

coverage:
  - id: D1
    description: "'post-service' is the fifth, last member of ServiceSection/SERVICE_SECTIONS/SERVICE_SECTION_LABELS; ServiceSlot.section stays optional so no migration or backfill write was issued against shipped v1.0 service documents"
    requirement: "R042"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#groupBySection > buckets a post-service slot under the fifth (last) SERVICE_SECTIONS key, alongside the other four (29-05)"
        status: pass
      - kind: other
        ref: "grep -c \"post-service\" src/types/service.ts == 4 (union, array, label map, doc comment)"
        status: pass
      - kind: other
        ref: "git diff --name-only across both task commits lists exactly the 7 files.in this plan's files_modified — no migration/backfill file added"
        status: pass
    human_judgment: false
  - id: D2
    description: "The five sections render in fixed order, Post-Service last, always visible including when empty; the Post-Service placeholder carries the UI-SPEC §2 purpose-naming copy while the other four keep the generic copy"
    requirement: "R043"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Section headers and slideshow preview (Phase 20-04) > renders all five section headers unconditionally, in SERVICE_SECTIONS order, Post-Service last (29-05)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Section headers and slideshow preview (Phase 20-04) > renders all five section headers, with placeholders, and routes every slot into the trailing ungrouped container for a legacy service (29-03/29-05)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Section headers and slideshow preview (Phase 20-04) > the Post-Service empty placeholder carries the purpose-naming UI-SPEC §2 copy; Pre-Service (also empty in this fixture) carries the generic copy (29-05)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Section headers and slideshow preview (Phase 20-04) > a Post-Service slot renders inside the Post-Service container and every slot kind is accepted there (29-05)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > creates one Sortable instance per rendered section list container, sharing the group name; the ungrouped container is pull-only (put: false)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Post-Service flows through to the slideshow assembly, positioned after Sending and before the trailing Ungrouped group, with the empty-section-omission behavior for the assembled slideshow output unchanged"
    requirement: "R042"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#useSlideshowAssembly > assembledSections places a Post-Service group after Sending and before the trailing Ungrouped group, and still omits sections with no slides (29-05)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Post-Service items render/export last for a section-major slots array in the print layout and the Planning Center export, with zero source changes to either file"
    requirement: "R042"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ServicePrintLayout.test.ts#ServicePrintLayout > renders a Post-Service item last for a section-major slots array (29-05)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/planningCenterExport.test.ts#formatForPlanningCenter > exports a Post-Service item last for a section-major slots array (29-05)"
        status: pass
    human_judgment: false
  - id: D5
    description: "SlidePlanRail.vue was audited by reading (not test-covered): it carries no section references at all (D-06, order locked, no drag), so Post-Service plan items need no special-casing there"
    verification: []
    human_judgment: true
    rationale: "Confirmed by reading the component's full source (props, computed rows, template) rather than by test — the plan's own instruction was to record this as audited-no-test-needed rather than invent a test for an absent concern. No behavior exists to assert against."
  - id: D6
    description: "A real cross-section browser drag lands where dropped and survives a reload — jsdom cannot synthesize a genuine OS drag"
    verification: []
    human_judgment: true
    rationale: "jsdom cannot synthesize genuine SortableJS drag events. The plan's Task 3 explicitly prohibited self-approval or simulation; the owner ran the app and verified the full checklist (five headers in order, header non-draggability, mid-section cross-section drop, drop into the empty Post-Service section, multi-position within-section drag, reload persistence, Slides tab reorder + append-at-end, offline-drag revert message) directly in a running browser and reported success."

duration: ~55min
completed: 2026-07-28
status: complete
---

# Phase 29 Plan 05: Post-Service Section and Downstream Consumer Audit Summary

**Widened `SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS`/`ServiceSection` to a fifth, last member (`'post-service'`) with zero migration and zero source changes anywhere except `src/types/service.ts` and one placeholder-copy branch in `ServiceEditorView.vue` — confirmed by test, not assumed, that all four downstream consumers (slideshow assembly, print layout, Planning Center export, plan rail) already propagate it correctly.**

## Performance

- **Duration:** ~55 min active work (Tasks 1-2), plus a checkpoint wait for owner browser verification (Task 3)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 7

## Accomplishments
- `ServiceSection`/`SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS` (`src/types/service.ts`) widened from four to five members, `'post-service'` appended last in all three — `ServiceSlot.section` stays optional, so this is purely additive: every existing v1.0 service document simply renders the new section empty, with no migration or backfill write issued anywhere.
- `ServiceEditorView.vue`'s empty-section placeholder gained the one Post-Service-specific piece of UI this phase is scoped to add: the UI-SPEC §2 purpose-naming copy variant ("...runs as people exit, e.g. a cycling announcement deck.") for `post-service`, while the other four sections keep the generic "Drag an item here, or set its Section to {label}." line. No icon, accent, or header subtitle was added — UI-SPEC §4 is explicit that inventing bespoke Post-Service chrome here would front-run Phase 36's Service Order rebuild.
- `npx vue-tsc --build` run deliberately as a gate after widening the union — clean, confirming no exhaustive switch or `Record<ServiceSection, …>` literal anywhere assumed four members. The generic `Record<ServiceSection, T[]>` usages in `slotTypes.ts` and `ServiceEditorView.vue` (both driven by `SERVICE_SECTIONS.map(...)`/`Object.fromEntries`) absorbed the fifth key with no source change.
- **Confirmation-by-test audit of all four PATTERNS.md-named downstream consumers — the expected finding held for every one:**
  - `useSlideshowAssembly.ts`'s `assembledSections` iterates `SERVICE_SECTIONS` directly (`useSlideshowAssembly.ts:548`) — a Post-Service group now emits positioned after Sending and before the trailing `Ungrouped` group, and the existing empty-section-omission behavior for the *assembled slideshow* output (distinct from the editor's always-visible empty sections, R043) is unchanged, proven by a dedicated fixture with no worship/pre-service slots.
  - `ServicePrintLayout.vue` and `planningCenterExport.ts` have **no section awareness whatsoever** — both iterate `service.slots`/`props.service.slots` in raw array order. Since the section model guarantees section-major array order (`orderSlotsBySection`/`reindexSlots`, established in 29-03), a Post-Service item placed last in the array renders/exports last for free. Proven with a dedicated section-major fixture in each test file.
  - `SlidePlanRail.vue` was audited by reading (no test added, per the plan's explicit instruction not to invent a test for an absent concern): it carries zero `ServiceSection`/section references anywhere in its props, computed rows, or template (D-06 — order locked, no drag). Post-Service plan items flow through it unchanged, with no special-casing needed.
- Widened `groupBySection`/`flattenBySection` test coverage in `slotTypes.test.ts` with a dedicated Post-Service bucketing/flattening-last case — both helpers already iterate `SERVICE_SECTIONS`, so no source change was needed there either (also already covered indirectly by every pre-existing `for (const section of SERVICE_SECTIONS)` loop in that file, which picked up the fifth member automatically).
- Task 3 (checkpoint:human-verify, `gate="blocking"`) was **not** self-approved or simulated — jsdom cannot synthesize a genuine OS drag, which is the entire reason the plan wrote this as a manual step. The owner ran `npm run dev`, worked through the full checklist in a real browser (five headers in fixed order, header non-draggability, a mid-section cross-section drop landing exactly between two items, a drop into the empty Post-Service section, a multi-position within-section drag, reload persistence, a Slides-tab reorder + append-at-the-true-end, and the offline-drag revert message), and reported success directly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Post-Service to the section model and the editor** - `a05a338` (feat)
2. **Task 2: Confirm the four downstream consumers by test, not by rework** - `6f37bd6` (test)
3. **Task 3: Human verify — a real browser drag across sections** - checkpoint, no code commit (owner-performed verification only; see Deviations/coverage D6)

## Files Created/Modified
- `src/types/service.ts` - `ServiceSection` union, `SERVICE_SECTIONS` array, `SERVICE_SECTION_LABELS` map all widened to five members with `'post-service'`/`'Post-Service'` appended last; doc comment updated to state the correct count and the Phase 29 addition.
- `src/views/ServiceEditorView.vue` - Empty-section placeholder's body text branches on `group.key === 'post-service'` to render the UI-SPEC §2 purpose-naming copy; the other four sections render the pre-existing generic copy unchanged. No other line in this file needed editing — the per-section render/Sortable-lifecycle machinery built in 29-03 already iterates `SERVICE_SECTIONS` with no section-name literals.
- `src/views/__tests__/ServiceEditorView.test.ts` - Header-count assertions widened from four to five (with Post-Service last); the legacy-service test widened the same way; new tests added for the Post-Service placeholder-copy variant, a Post-Service slot rendering correctly with every slot kind accepted, and the Sortable-instance-count assertion updated from 5 to 6 (five sections including the always-rendered empty Post-Service, plus the ungrouped container). The `makeSectionedService()` fixture comment was updated to state it deliberately excludes Post-Service (pins the four-section reorder-repro tests to their original shape) rather than implying the section didn't exist yet.
- `src/utils/__tests__/slotTypes.test.ts` - New `groupBySection`/`flattenBySection` test cases exercising a `post-service` slot: buckets under the fifth key, flattens after every other named section but before the legacy bucket.
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - New `assembledSections` test asserting a Post-Service group's position (after Sending, before the trailing Ungrouped group) and that sections with zero slides are still omitted entirely from the assembled output.
- `src/components/__tests__/ServicePrintLayout.test.ts` - New test asserting a Post-Service item renders last for a section-major slots array.
- `src/utils/__tests__/planningCenterExport.test.ts` - New test asserting a Post-Service item exports last for a section-major slots array.

## Decisions Made
- No migration, no backfill write, and no source change beyond `src/types/service.ts` and the single placeholder-copy branch in `ServiceEditorView.vue` — every other file in this plan's scope is a test file. This was the plan's explicit hard constraint (T-29-15) and PATTERNS.md's predicted outcome; both held.
- Post-Service accepts every slot kind with no per-section restriction, matching every other section — proven by a dedicated test mounting SONG/IMPORTED/PRAYER slots all under `section: 'post-service'`.
- `SlidePlanRail.vue` recorded as audited-no-test-needed rather than given an invented test, per the plan's explicit instruction — the component genuinely has no section-related behavior to assert against.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed as specified; the four-consumer audit's expected finding (no source change needed) held for every consumer, which the plan itself flagged as the likely but not assumed outcome.

## Issues Encountered

### Phase-level observations (not this plan's own defects — recorded for the phase orchestrator)

**1. `src/utils/scheduler.ts` — stray uncommitted modification during this plan's session, since resolved.** Mid-session this file (a v1.1 volunteer-scheduling file no Phase 29 plan touches) showed an uncommitted local diff (`calendar[date] = { ...(existingCalendar[date] ?? {}) }` → `{ ...existingCalendar[date] }`). This plan correctly left it untouched per scope discipline and flagged it at the Task 3 checkpoint rather than editing or reverting it. The orchestrator subsequently diagnosed the cause: an ESLint autofix (`@typescript-eslint/no-unnecessary-condition` removing a provably-unnecessary `?? {}`), reproduced by an agent running `lint --fix` in the shared, unworktreed checkout — not a deliberate edit — and reverted it twice to keep Phase 29's diff clean. Worth noting for future sessions: any `lint --fix` run against this shared checkout (`branching_strategy: none`) can silently touch files outside the active plan's scope; no action needed from this plan.

**2. Wave 2 commit-attribution race (documented, not caused or fixed by this plan).** With `branching_strategy: none`, 29-03 and 29-04 ran in parallel against the same unworktreed checkout in an earlier wave. 29-03's `git add`/`git commit` swept up 29-04's already-staged `SlideGrid.vue`/`SlideGrid.test.ts` Task 3 changes into commit `91c4502`. No content was lost and no history was rewritten — both wave-2 SUMMARYs (`29-03-SUMMARY.md`, `29-04-SUMMARY.md`) already document this in full. Noting it here again as a phase-level infrastructure finding: any future phase running multiple plans in parallel against `branching_strategy: none` (no worktree isolation) should expect this class of commit-attribution noise, and should consider worktree isolation or serialized commit-sensitive steps across parallel plans in the same wave.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R042 (Post-Service exists, structural only) and R043 (five sections, fixed order, always visible) are both closed. Phase 29's full requirement set (R042-R044, R049, R050) is now complete.
- The section model is stable at five members for the rest of v1.4: Phase 30 (hard-lock/reconciliation removal), Phase 35 (presentation correctness), and Phase 36 (Service Order tab rebuild against the Claude Design "Turn 3" wireframes) can all build against `SERVICE_SECTIONS` as a closed five-member enumeration with no further widening expected.
- Phase 36 owns any bespoke Post-Service visual treatment (icon, accent, header subtitle) — this plan deliberately did not add any, per UI-SPEC §4.
- No blockers for the next phase. The `src/utils/scheduler.ts` and wave-2 commit-attribution observations above are informational only, already resolved or already documented elsewhere.

---
*Phase: 29-order-structure-stable-reordering-post-service*
*Completed: 2026-07-28*

## Self-Check: PASSED
All 7 modified files found on disk plus this SUMMARY.md itself; both task commit hashes (`a05a338`, `6f37bd6`) verified present in `git log`.
