---
phase: 47-congregational-reading-divider-ux
plan: 03
subsystem: presenter-grid-drawer-render
tags: [presenter, slide-display, edit-drawer, congregational-reading, r097, all-role]
dependency-graph:
  requires:
    - "CongregationalSection.speaker ALL (47-01)"
    - "scripture SourceRef.speaker ALL (47-01)"
    - "ScriptureSlide.isFirstSection field (47-01)"
  provides:
    - "slideshowAssembler.ts isFirstSection assignment (both content-resolution paths)"
    - "PresentationViewer.vue R097 reference gating + 3-way speaker render"
    - "slideDisplay.ts 3-way speakerDisplayName + R097 slideBodyText gating"
    - "EditSlideDrawer.vue 3-way speaker cycle (LEADER -> CONGREGATION -> ALL -> LEADER)"
  affects:
    - "Presenter surface (PresentationViewer.vue)"
    - "Slide grid card eyebrow/footer (slideDisplay.ts consumers: SlideCard, plan rail)"
    - "Edit Slide Drawer speaker control"
tech-stack:
  added: []
  patterns:
    - "isFirstSection computed at assembly time from ordinal (entry.order / localSeq), never re-derived downstream"
    - "3-way role maps kept as literal Tailwind class strings, never a computed template string"
    - "Single NEXT_SPEAKER cycle table replacing a binary ternary, so widening to a 4th role touches one place"
key-files:
  created: []
  modified:
    - src/utils/slideshowAssembler.ts
    - src/components/PresentationViewer.vue
    - src/components/slides/slideDisplay.ts
    - src/components/slides/EditSlideDrawer.vue
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/components/__tests__/PresentationViewer.test.ts
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
decisions:
  - "isFirstSection is set as a plain boolean field directly inside the section-present branch of each content-resolution path (not a conditional-spread), since that branch already structurally guarantees a Reference-state slide never reaches it — simpler than nesting a second conditional spread inside an already-branched ternary/if"
  - "PresentationViewer's speaker label and colour widened via a computed function returning a literal string per role, matching the existing speakerColorClass literal-class convention, rather than routing through slideDisplay.ts's speakerDisplayName (kept the two render paths' existing independent styles rather than introducing a new cross-file dependency not requested by the plan)"
  - "EditSlideDrawer's 3-way cycle expressed as a single NEXT_SPEAKER lookup table rather than three inline ternaries, so a future 4th role only touches one place"
metrics:
  duration: "~35m"
  completed: 2026-08-08
status: complete
---

# Phase 47 Plan 03: Presenter/Grid-Card/Drawer Render for R097 and the ALL Role Summary

Threaded plan 01's `ScriptureSlide.isFirstSection` field through both `slideshowAssembler.ts` content-resolution paths so R097 ("first slide shows the reference, later slides show only the speaker label") is a real, newly-built behavior rather than the no-op it was before this plan, and widened every binary Leader/Congregation render site (`PresentationViewer.vue`, `slideDisplay.ts`, `EditSlideDrawer.vue`) to a proper 3-way Leader/Congregation/All control with violet-300 as the third colour.

## What Was Built

**Task 1 — Failing tests (RED)**
Added tests to all three render/assembly test files encoding the R097 and ALL-role contract before any implementation change, confirmed red against current code:
- `slideshowAssembler.test.ts`: extended the existing 2-section dual-path parity case to assert `isFirstSection` is `true` on slide 0 and `false` on slide 1, agreeing on both the stored-group and fallback paths; added a new 3-section case (including an ALL speaker) proving the same parity plus role pass-through; added a case proving a Reference-state slide carries no `isFirstSection` field at all (`hasOwnProperty` false).
- `PresentationViewer.test.ts`: widened the `congregationalScriptureSlide` test helper to accept an `isFirstSection` parameter (default `true`, so every pre-existing single-slide fixture keeps behaving as before); added assertions to the existing two-section test that `presentation-scripture-reference` is present on the first slide and absent on the second; added a new test for a 3-section reading proving the ALL speaker renders "All:" in `text-violet-300` as the only class delta versus Leader's `text-sky-300`, with the reference still suppressed on the later ALL slide.
- `slideDisplay.test.ts`: extended `speakerDisplayName`'s test to assert `'ALL' -> 'All'`; converted the existing scripture-section `slideBodyText` case into an explicit first-section (`isFirstSection: true`) case and added two new cases — a later-section case (reference omitted) and a Reference-state case (reference always present, unaffected); added cases proving `slideContentLabel`'s eyebrow and `slideFooterLabel`'s footer are NOT reference-gated (both still name the speaker, including ALL, on a later-section slide).

**Task 2 — R097 assembler + 3-way presenter/grid-card render (GREEN)**
- `slideshowAssembler.ts`: set `isFirstSection: entry.order === 0` in `resolveEntryContent`'s scripture case (stored-group path, section-present branch only) and `isFirstSection: localSeq === 0` in the `SCRIPTURE` fallback branch's `sections.forEach` — the two ordinals that already existed in each function's scope, so no new state was introduced. A Reference-state slide (`section === null` / no sections) never gets the field at all. The assembler remains role-agnostic; `speaker` (including `'ALL'`) passes through unchanged on both paths.
- `PresentationViewer.vue`: added an `isFirstSection` computed mirroring `isCongregational`'s shape (true only when the current slide is a congregational scripture slide whose `isFirstSection` flag is `true`). Gated the `presentation-scripture-reference` paragraph on `v-if="!isCongregational || isFirstSection"`. Extracted the inline speaker-label ternary into a `speakerLabelText` computed and widened `speakerColorClass` to a 3-way `if`-chain returning literal `'text-sky-300'` / `'text-amber-300'` / `'text-violet-300'` — never a computed template string, per the file's existing doc comment on why that would silently produce no CSS.
- `slideDisplay.ts`: widened `speakerDisplayName` to a 3-way match (`'ALL' -> 'All'`), which propagates automatically to every existing consumer (rail label, grid eyebrow/footer, drawer) with no other call-site change. Gated `slideBodyText`'s scripture-case reference prefix on `!slide.section || slide.isFirstSection` — a later section slide (section present, `isFirstSection` falsy) now returns only its own words + attribution suffix, with no reference line. `slideContentLabel`'s eyebrow and `slideFooterLabel`'s footer were left untouched (not reference-gated), per the plan's explicit key_link.

**Task 3 — 3-way Edit Slide Drawer speaker cycle**
- `EditSlideDrawer.vue`: replaced `onSpeakerToggle`'s binary ternary with a `NEXT_SPEAKER` lookup table (`LEADER -> CONGREGATION -> ALL -> LEADER`), fixing the Pitfall-5 defect where the old ternary silently mapped any non-LEADER value — including a future ALL value — straight back to LEADER on one click. Every other property of the handler (the `canMutate` re-check inside the handler, reading `props.group.slides` as the base, mapping only the selected entry, awaiting `replaceGroupSlides`, passing `sourceSignature` through undebounced) is byte-identical to before. Recoloured the `drawer-speaker-toggle` button from the indigo/amber binary to the same sky/amber/violet used everywhere else, removing the pre-existing collision between "LEADER role colour" and the indigo UI-accent colour. `speakerLabel` needed no change — it already reads through the now-3-way `speakerDisplayName`.
- `EditSlideDrawer.test.ts`: updated the existing "activating it writes only that entry's speaker flipped" test, whose CONGREGATION-entry click now correctly advances to ALL (not LEADER) under the widened cycle; added a full three-click LEADER→CONGREGATION→ALL→LEADER cycle test asserting the exact `replaceGroupSlides` payload speaker each time; added a case proving an ALL entry's label reads "All", is coloured `text-violet-300` (not `text-indigo-300`), and advances to LEADER on click.

## Deviations from Plan

**1. [Rule 1 — clarification, not a bug]** The plan's Task 2 action described adding `isFirstSection` "via the same conditional-spread style the file already uses for translationSource." Implemented instead as a plain boolean field directly inside each content-resolution path's already-branched section-present object literal (not wrapped in an additional `...(condition ? {...} : {})` spread) — the surrounding `section === null ? {...} : {...}` ternary (stored-group path) and the `sections.length === 0` early-return (fallback path) already structurally guarantee the field is never reached on a Reference-state slide, so a second conditional spread would have been redundant. Verified with a dedicated test (`hasOwnProperty(slide, 'isFirstSection') === false` on a Reference-state slide) that the intended absence still holds.

No other deviations — plan executed as written, including the exact three-task TDD-flagged structure (Task 1 red, Task 2/3 green).

## Verification

- `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts src/components/__tests__/PresentationViewer.test.ts src/components/slides/__tests__/slideDisplay.test.ts src/components/slides/__tests__/EditSlideDrawer.test.ts` — 434/434 passed (93 + 100 + 73 + 168).
- `npm run type-check` (`vue-tsc --build`, the CLAUDE.md-mandated gate that also typechecks test files) — clean, no errors.
- Full app suite `npx vitest run --dir src --exclude '**/rules.test.ts'` — 2 files / 13 tests failed, 92 files / 2914 tests passed. The 2 failing files are exactly CLAUDE.md's documented baseline (`src/storage.rules.test.ts` — the known `firestore.exists()` Storage-emulator cross-service limitation; `src/views/__tests__/RosterView.test.ts` — stale assertion) — no new failing file introduced by this plan.
- R097 proven by test: `PresentationViewer.test.ts`'s "two consecutive sections" case now asserts `presentation-scripture-reference` is present on the first section slide and absent on the second; the new 3-section ALL test confirms the reference stays suppressed on a later ALL slide too. `slideDisplay.test.ts` proves the same at the `slideBodyText` layer, plus proves the eyebrow/footer are NOT reference-gated.
- Manual (deferred to `/gsd-verify-work` per the v1.5 standing grant): presenting a hand-divided reading live and confirming Leader/Congregation/All read distinctly at projection distance, and that the reference genuinely disappears after the first slide on a real projector.

## Known Stubs

None. This plan touches only render/assembly logic for already-existing data — no new UI surface with a placeholder data source.

## Threat Flags

None. Both threat register entries this plan addresses (T-47-04 speaker colour/label, T-47-05 drawer speaker-cycle tampering) were resolved exactly as their disposition specified: the role label is always rendered as text so colour is never the sole signal, `speakerColorClass` returns literal classes, and the 3-way cycle removes the binary toggle's silent ALL→LEADER corruption while reusing the existing `canMutate`-gated, rules-enforced write path unchanged. No new network/auth/file-access surface was introduced.

## Self-Check: PASSED

- FOUND: src/utils/slideshowAssembler.ts
- FOUND: src/components/PresentationViewer.vue
- FOUND: src/components/slides/slideDisplay.ts
- FOUND: src/components/slides/EditSlideDrawer.vue
- FOUND: src/utils/__tests__/slideshowAssembler.test.ts
- FOUND: src/components/__tests__/PresentationViewer.test.ts
- FOUND: src/components/slides/__tests__/slideDisplay.test.ts
- FOUND: src/components/slides/__tests__/EditSlideDrawer.test.ts
- FOUND commit: 6b31431 (test(47-03): add failing tests for R097 reference gating, ALL role render, isFirstSection)
- FOUND commit: c694e66 (feat(47-03): implement R097 reference gating and 3-way ALL role render)
- FOUND commit: c2c18d9 (feat(47-03): widen Edit Slide Drawer speaker control to a 3-way cycle)
