---
phase: 26-edit-slide-drawer-risk-medium
plan: 07
subsystem: ui
tags: [vue, vue-router, unsaved-guard, slide-groups, source-ref-kind]

# Dependency graph
requires:
  - phase: 26-02
    provides: "songEditLink.ts's buildSongEditLink/SongEditTab — the song-editor navigation contract this plan's 'Edit in song' affordance calls directly"
  - phase: 26-03
    provides: "SlidesTab.vue's exposed requestEditInScripture() — the scripture relay this plan's 'Edit in scripture' affordance triggers via an emit"
  - phase: 26-05
    provides: "EditSlideDrawer.vue's shell, selection seam, and fresh-base label/notes write helper — extended (not replaced) by this plan's body-write and route logic"
provides:
  - "EditSlideDrawer.vue: the Slide Text section, keyed on GroupSlideEntry.sourceRef.kind (D-15's six-row matrix) — read-only for lyric/copyright/scripture/imported, editable for authored text, omitted for video"
  - "EditSlideDrawer.vue: a hand-written slide's body writes through the same fresh-base compare-and-swap helper 26-05 established, replacing only sourceRef.body"
  - "EditSlideDrawer.vue: 'Edit in song' (lyrics/details tab) and 'Edit in scripture' (relay emit) routes, both guarded by useUnsavedGuard with a cancel-before-navigate discipline"
  - "SlidesTab.vue: relays the drawer's edit-in-scripture emit to its own requestEditInScripture()"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branch key discipline: the Slide Text section is keyed on the STORED entry's sourceRef.kind, never the resolved slide's contentKind — an imported picture and imported text share sourceRef.kind 'imported' despite differing contentKind, and a hand-written slide shares contentKind 'text' with an imported text slide despite differing sourceRef.kind. Every branch carries an inline comment naming the key and why."
    - "Nested-field fresh-base write: extends 26-05's fresh-base compare-and-swap helper to a THIRD field ('body') that lives on a nested sourceRef object rather than a sibling top-level key — the write replaces only sourceRef.body, spreading the rest of sourceRef so other members (the short default title) survive intact."
    - "Cancel-before-navigate, not flush-before-navigate: accepting the unsaved-edit confirmation cancels the pending debounced write (clears the timer, drops the pending value) rather than flushing it, so the discarded edit provably never lands — the opposite of this component's own unmount-time best-effort flush."

key-files:
  created: []
  modified:
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts

key-decisions:
  - "For the lyric-section and imported-text read-only variants, reused slideDisplay.ts's existing slideBodyText helper (it already produces exactly what's needed — joined lines, or a TextSlide's body) rather than re-deriving. For the copyright and scripture variants, rendered fields directly from the resolved slide instead, since slideBodyText's copyright branch returns only the title (insufficient) and its scripture branch prepends the reference (already shown in the context line above, so reusing it would duplicate that text)."
  - "An imported entry whose resolved content is a picture renders NO separate read-only text block and NO caption at all — the picture is already the preview above, so there are no 'words' for a caption to describe. This is a deliberate reading of the UI-SPEC's 'no separate words block' language; the alternative (an empty labeled section) was rejected as adding a hollow section with nothing to say."
  - "The Slide Text section's outer wrapper still renders its 'Slide Text' label for every non-video kind, including the imported-picture sub-case, so the section's presence/absence boundary stays exactly 'omitted only for video' (matching the UI-SPEC's D-12/D-15 distinction) rather than conflating 'no caption' with 'no section'."
  - "The unsaved-edit guard's snapshot spans label, notes, AND body uniformly (even though body is only ever non-empty for a text-kind entry) — simpler than a per-kind-scoped guard instance, and harmless since a non-text entry's local body ref never changes, so it can never spuriously read as dirty."
  - "cancelPendingWrites() clears ALL three fields' pending debounce timers on accept, not just the one field visibly focused when the route was followed — a user could plausibly have typed into label, notes, or (for authored text) body before clicking either link, and the confirmation's promise ('discard them') is about every unsaved edit, not just one field."
  - "Guard baseline is re-captured after every successful write AND after every entry-switch resync (both the 'different entry' and the 'same entry, persisted value changed elsewhere' branches) — anything that makes the local field values match what's actually persisted must reset the dirty baseline, or the guard would report a false positive on the next click."

requirements-completed: [R033, R018]

coverage:
  - id: D1
    description: "The Slide Text section renders the per-kind matrix (lyric/copyright/scripture/imported-text read-only with the source's exact caption; imported-picture and video render nothing extra; authored text renders editable), keyed on sourceRef.kind never contentKind, with no override/unlink/copy-for-this-service control anywhere"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-07 Task 1 — per-kind Slide Text)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A hand-written slide's body is editable, live-applies through the same fresh-base compare-and-swap write 26-05 established (replacing only sourceRef.body, preserving id/order/other sourceRef members), debounced to one write, flushed on entry-switch, gated on write capability, and never reverts the typed value on a rejected write"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-07 Task 2 — hand-written slide edited here)"
        status: pass
    human_judgment: false
  - id: D3
    description: "'Edit in song' pushes 26-02's link contract (lyrics tab for a section, details tab for copyright); 'Edit in scripture' emits a request the Slides tab relays through 26-03's plumbing with the plan item's raw array index; neither route renders for imported/video/text kinds or for a viewer without write capability"
    requirement: R018
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-07 Task 3 — routes away, guarded)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Edit Slide drawer wiring (Phase 26-05 Task 2) > relays the drawer's edit-in-scripture request through requestEditInScripture (Phase 26-07 Task 3)..."
        status: pass
    human_judgment: false
  - id: D4
    description: "Following either route with a pending edit asks for confirmation using useUnsavedGuard's exact existing wording; declining leaves the pending write intact so it still lands; accepting cancels the pending write before navigating so the confirmation is truthful and nothing lands afterward"
    requirement: R018
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-07 Task 3 — routes away, guarded) > typing then following a route, declining/accepting the confirmation..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Cross-view manual verification: 'Edit in song' lands on the right song and tab (not the song list); 'Edit in scripture' switches the service editor's tab and brings the requested plan item's scripture editor into view and expanded; typing then following a route then accepting the confirmation genuinely discards the typed value in the running app"
    verification: []
    human_judgment: true
    rationale: "Deferred to the milestone's batch human-verify per this plan's own <verify><human-check> block (workflow.verifier is false; see STATE.md) — jsdom cannot assert real cross-view navigation landing on the correct tab/scroll position, only that the correct router.push payload or emit occurred."

# Metrics
duration: ~55min
completed: 2026-07-27
status: complete
---

# Phase 26 Plan 07: Slide Text — per-kind treatment, hand-written editing, and guarded routes away Summary

**The Edit Slide drawer's Slide Text section, keyed on `GroupSlideEntry.sourceRef.kind` (never the resolved slide's `contentKind`): read-only per source for song/scripture/imported content with an "Edit in song"/"Edit in scripture" link, live inline editing for a hand-written slide through 26-05's fresh-base write helper, and both routes guarded by a cancel-before-navigate unsaved-edit confirmation.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files modified:** 4 (0 created)

## Accomplishments
- Added the Slide Text section to `EditSlideDrawer.vue`, branching on `props.entry.sourceRef.kind` with an inline comment naming the key and why — the single decision the phase's UI-SPEC calls "the most load-bearing table," since branching on `contentKind` instead would silently hand an imported picture a lyrics-editing route.
- Song lyric-section and copyright slides render read-only with the UI-SPEC's exact shared caption; scripture renders read-only with its own caption; an imported entry renders read-only text with its own caption OR (for a picture) nothing extra, since the picture is already the preview above; a video slide omits the whole section; a hand-written (`text`-kind) slide renders an editable field instead of a read-only block.
- Wired the hand-written slide's editable body through 26-05's exact fresh-base compare-and-swap write helper, extended to a third field whose value lives on a NESTED `sourceRef.body` rather than a sibling top-level key — the write replaces only `body`, spreading the rest of `sourceRef` so other members (the short default title `SlideGrid.vue`'s `onAddSlide` stamps a new hand-added slide with) survive intact, and the entry's `id`/`order` are never touched.
- Added both routes away: "Edit in song" builds 26-02's link contract (lyrics tab for a lyric section, details tab for copyright — a deliberate refinement since the two source kinds surface different fields) and pushes it via `vue-router`; "Edit in scripture" emits a request `SlidesTab.vue` relays to its own `requestEditInScripture()` (26-03's plumbing), never reaching page state directly.
- Guarded both routes with `useUnsavedGuard`, reusing its exact existing confirmation copy verbatim. Accepting the confirmation cancels the pending debounced write (clears the timer, drops the pending value) BEFORE navigating — the opposite of this component's own unmount-time best-effort flush — so the confirmation is truthful: a discarded edit provably never lands. Declining leaves the pending write untouched so it still lands normally.

## Task Commits

1. **Task 1: The words section, decided by where the words come from**
   - `59b85b7` feat(26-07): add per-kind Slide Text section, keyed on sourceRef.kind
2. **Task 2: A hand-written slide is edited here**
   - `16adba8` test(26-07): verify hand-written slide edits persist through the source ref
   *(implementation shipped in Task 1's commit — see Deviations below)*
3. **Task 3: Both routes away, each guarded against losing unsaved work**
   - `7dd6729` feat(26-07): wire edit-in-song/edit-in-scripture routes, guarded by unsaved-edit confirmation

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified
- `src/components/slides/EditSlideDrawer.vue` — the Slide Text section (per-kind branch, captions, editable authored-text field), the extended fresh-base write helper (`body` field), `useUnsavedGuard` wiring, and the two route handlers (`onEditInSong`, `onEditInScripture`)
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` — three new `describe` blocks (53 new tests total across Tasks 1–3) plus per-`sourceRef.kind` fixture builders (`makeLyricFixtures`, `makeCopyrightFixtures`, `makeScriptureFixtures`, `makeImportedTextFixtures`, `makeImportedImageFixtures`, `makeAuthoredTextFixtures`, `makeVideoFixtures`) and a `vue-router` mock
- `src/components/slides/SlidesTab.vue` — one new listener (`@edit-in-scripture="requestEditInScripture"`) relaying the drawer's request to the existing 26-03 plumbing, plus a header-comment update
- `src/components/slides/__tests__/SlidesTab.test.ts` — one new test verifying the relay emits the plan item's raw array index

## Decisions Made
See `key-decisions` in the frontmatter above for the six load-bearing calls (reuse-vs-re-derive for `slideBodyText`, the imported-picture caption/section boundary, the guard's uniform three-field snapshot, cancel-all-three-fields-on-accept, and re-capturing the guard baseline on every resync path).

## Deviations from Plan

### Process deviation (documented, not a Rule 1-4 fix)

**Tasks 1, 2, and 3's implementation code was authored together in one component build**, matching 26-05's own documented precedent for this same file. `EditSlideDrawer.vue` is a single, cohesive Vue SFC — the per-kind Slide Text section (Task 1), the hand-written body's write logic (Task 2), and the two route handlers plus unsaved-guard wiring (Task 3) are threaded through the same template and the same debounce/write-helper machinery, and building them in three separate passes would have meant repeatedly reopening and re-threading the same functions. Task 1's own RED→GREEN cycle was followed as literally as the codebase allows given this: the full implementation and Task 1's dedicated 37-test suite were committed together (`59b85b7`), then Task 2's dedicated 7-test suite was added and run against the ALREADY-PRESENT Task 2 implementation as its own commit (`16adba8`) with no further source changes, and Task 3's dedicated 9-test suite plus the small, genuinely Task-3-only `SlidesTab.vue` wiring (`@edit-in-scripture` listener + header comment) landed together as the final commit (`7dd6729`). Every acceptance criterion for all three tasks has dedicated, currently-passing tests, and the commit history accurately reflects which file changes are exclusively Task 3's own (the `SlidesTab.vue` diff) versus which were authored earlier as part of the same component build.

No Rule 1–4 auto-fixes were needed — the plan's own action/acceptance-criteria text was followed as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- This was the last plan depending on Wave 1/2's navigation and shell plumbing (26-02, 26-03, 26-05) — 26-07 is the one place both destination halves (song-edit link, scripture relay) finally get called from a real sender.
- The four `<human-check>` items across this plan and its dependencies (drawer layout/scrim behavior from 26-05; "Edit in song"/"Edit in scripture" landing correctly; this plan's typed-then-discarded-value check) are all deferred to the milestone's batch human-verify per `workflow.verifier: false` (see STATE.md) — none block phase completion.
- Full verification: `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts src/components/slides/__tests__/SlidesTab.test.ts` — 79 passed, 0 failed. `npx vitest run src/components/slides/` — 240 passed, 0 failed. `npx vitest run src/` (full suite) — 10 failed FILES, matching the documented baseline exactly (8 under `.gsd/quarantine/worktrees/**` + `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`), 158 passed files. `npm run type-check` reports 0 errors. `npm run build` succeeds.

## Known Stubs

None. No hardcoded empty/placeholder values were introduced; every read-only variant renders live data from the resolved slide, and the authored-text field is fully wired to the store.

## Threat Flags

None beyond what 26-07-PLAN.md's own `<threat_model>` already registers (T-26-07-01 through T-26-07-05, all `mitigate` or `accept` — all implemented/verified as designed: the guard's cancel-before-navigate discipline and its test coverage satisfy T-26-07-01; the source-kind branch key with its explanatory comment and the parametrised per-kind test satisfy T-26-07-02; both routes and the authored-text field are gated on `isEditor` satisfying T-26-07-03; all text renders through framework interpolation, never raw HTML, satisfying T-26-07-05).

---
*Phase: 26-edit-slide-drawer-risk-medium*
*Completed: 2026-07-27*

## Self-Check: PASSED
