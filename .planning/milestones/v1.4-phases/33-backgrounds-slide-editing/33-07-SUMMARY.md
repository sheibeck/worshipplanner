---
phase: 33-backgrounds-slide-editing
plan: 07
subsystem: ui
tags: [vue3, typescript, firestore, slide-editing, background-image, drawer]

# Dependency graph
requires:
  - phase: 33-01
    provides: "GroupSlideEntry/SlideGroup/SlideBase backgroundImageUrl + AssembledSlide.slide.backgroundSource, resolveEntryMedia's slide→group→song cascade"
  - phase: 33-02
    provides: "slideActionMenuItems()/MenuItemKey/MenuItem, backgroundImageLabel() in slideDisplay.ts"
  - phase: 33-03
    provides: "useBackgroundUpload() composable (image/*, 10MB cap, orgs/{orgId}/backgrounds/**)"
  - phase: 33-04
    provides: "EditSlideDrawer.vue with the audioScope UI already removed — this plan's mode/background/pendingAction work landed on top of that clean state"
provides:
  - "EditSlideDrawer.vue mode prop ('details' | 'lyrics', default 'details') gating Slide Label/Audio/Notes/footer and relocating the hand-authored editable textarea to lyrics mode"
  - "EditSlideDrawer.vue Slide Background section (drawer-background-section): three-state rendering, canMutateBackground gate, useBackgroundUpload wiring, drawer-preview CSS background-image treatment"
  - "EditSlideDrawer.vue pendingAction prop + pending-action-consumed emit — a nonce-keyed seam for a future menu to dispatch Duplicate/Delete without forking either write path"
affects: [33-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mode-gated template sections via a single new v-if clause appended to each existing gate, never a template/component split"
    - "background mutation gate (canMutateBackground) deliberately composed WITHOUT the song-group exclusion canMutate carries — documented inline so a reviewer doesn't 'fix' it into consistency"
    - "pendingAction nonce-keyed watcher: re-checks the drawer's own permission gate before acting, emits a consumed signal exactly once per nonce regardless of whether the gate permitted the action, so the parent's pending state can never get stuck"

key-files:
  created: []
  modified:
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts

key-decisions:
  - "canMutateBackground = isEditor && !serviceLocked (no isSongGroup exclusion) — the one gate in this drawer that deliberately diverges from canMutate, per 33-CONTEXT.md's explicit statement that a song group's reduced menu still offers background-setting"
  - "'Set for this slide only' performs a direct copy-then-override write of the currently resolved url (attachSlideBackground), not a toggle into the upload UI — followed the PLAN's explicit action text over 33-UI-SPEC §5's looser prose, since the plan is the authoritative execution artifact and its acceptance criteria are unambiguous"
  - "pending-action-consumed emits once per handled nonce UNCONDITIONALLY (even when canMutate is false) — only the actual mutation (confirm-state flip / duplicate write) is gated. This prevents a parent's pending state getting stuck when a menu dispatches an action the drawer correctly refuses; the plan's wording was ambiguous on this exact point, so this is a documented design choice, not a deviation from an explicit instruction"
  - "lowerLevelBackgroundLabel (the State-3 'the group's/song's still applies' caption) can only prove the GROUP tier (read directly off the group prop already passed to this drawer) — no plan in this phase threads a song-level background lookup into EditSlideDrawer.vue, so the 'song' branch of that caption is unreachable from available props. Documented as a known, scoped gap rather than silently guessed at (see Known Gaps below) — showing a caption this component cannot verify was judged a worse failure than omitting it, given this phase's own framing of 'an override the user cannot see' as its sharpest UI risk"

requirements-completed: [R052, R056]

coverage:
  - id: D1
    description: "EditSlideDrawer.vue gains a mode prop ('details' | 'lyrics', default 'details') that gates Slide Label/Slide Audio/Notes/footer-actions to details mode and relocates the hand-authored text editable textarea to lyrics mode only; details mode shows a read-only preview + 'Edit this slide's text via Edit lyrics' caption instead. Neither the component nor its test file was split."
    requirement: "R052"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts — 'mode: details | lyrics' describe block (9 cases)"
        status: pass
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "New Slide Background section renders three mutually exclusive states (none / inherited-with-override-CTA / own-with-remove), is never omitted for a video-kind entry, and lets a SONG-group entry set/remove its own background while every other mutation control in the drawer stays absent for it."
    requirement: "R056"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts — 'Slide Background' describe block (18 cases)"
        status: pass
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D3
    description: "pendingAction seam: a delete pendingAction sets the drawer's EXISTING showDeleteConfirm state and never calls the delete store action directly (P-01); a duplicate pendingAction runs the existing duplicate write; both re-check canMutate before acting; pending-action-consumed fires once per handled nonce."
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts — 'pendingAction seam for Duplicate/Delete' describe block (7 cases)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-08-03
status: complete
---

# Phase 33 Plan 07: EditSlideDrawer mode split, Slide Background, pendingAction seam Summary

**`EditSlideDrawer.vue` gained a `mode: 'details' | 'lyrics'` prop (one component, no tabs), a three-state Slide Background section wired through `useBackgroundUpload`, and a nonce-keyed `pendingAction` seam that routes menu-dispatched Delete onto the drawer's existing confirm rather than a second, quieter path.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-03T04:55:09Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **Task 1 — mode prop and per-mode section gating.** `EditSlideDrawer.vue` gained `mode?: 'details' | 'lyrics'` (defaults `'details'`, so every pre-existing fixture behaves unchanged). Slide Label, Slide Audio, Notes and the footer-actions row are all now gated `&& mode === 'details'`. The hand-authored `text`-kind entry's editable textarea (`drawer-slide-text-editable`) relocated to `lyrics` mode with its markup byte-identical to before; `details` mode now shows a read-only preview plus the caption "Edit this slide's text via Edit lyrics" instead. The header title binds to a new `drawerTitle` computed ("Edit Slide Details" / "Edit Slide Lyrics"). No mode watcher was added — the two modes never edit overlapping fields (details has no textarea after this change), so a mode switch on the same entry has nothing to flush; the existing entry-change watcher is untouched.
- **Task 2 — the Slide Background section.** A new `drawer-background-section` renders directly after Slide Audio and before Notes, in `details` mode only, but — unlike Slide Audio immediately above it — is never wrapped in `!isVideo` (33-UI-SPEC §9's deliberate divergence: a video's own picture already covers whatever's behind it, so background is never suppressed for video). Reads `resolvedBackgroundUrl`/`backgroundSource` straight off `assembledSlide.slide` (never re-derives the cascade). A new `canMutateBackground = isEditor && !serviceLocked` gate — the one gate in this drawer that deliberately omits the `isSongGroup` exclusion `canMutate` carries, with an inline comment explaining why (R054's "canonical, edited only from Song Lyrics" rule was never written to cover a per-slide background). Wired through `useBackgroundUpload` with the identical fail-writes-nothing contract the audio attach already documents; remove omits the `backgroundImageUrl` key rather than setting it `undefined`; "Set for this slide only" performs a direct copy-then-override attach of the currently resolved url (not a fresh upload). The `drawer-preview` box now carries the resolved background as a CSS `background-image` when one resolves.
- **Task 3 — the pendingAction seam.** A new `pendingAction?: { key: 'duplicate' | 'delete'; nonce: number } | null` prop (default `null`) and `pending-action-consumed` emit let a future menu dispatch Duplicate/Delete into this drawer without a second write path. A nonce-tracking watcher re-checks `canMutate` before acting on either key: the delete key sets the EXISTING `showDeleteConfirm` ref (never calls the delete action directly — P-01), the duplicate key calls the existing `onDuplicate()`. `pending-action-consumed` emits once per handled nonce regardless of whether the action was permitted, so a menu-dispatched request the drawer correctly refuses (locked service, viewer, song group) never leaves the parent's pending state stuck.

## Task Commits

Given the tight coupling between all three tasks (same two files, Task 2's gating depends on Task 1's mode structure, and holistic verification was faster/safer than a fragile manual `git add -p` hunk split — see Deviations below), the implementation landed as two atomic commits rather than three:

1. **Tasks 1–3 (component implementation)** - `0568489` (feat) — mode prop/gating, Slide Background section, pendingAction seam, all in `EditSlideDrawer.vue`.
2. **Tasks 1–3 (test coverage)** - `6358a32` (test) — the three new describe blocks plus fixture updates to existing blocks whose subject moved.

**Plan metadata:** pending (this commit).

## Files Created/Modified

- `src/components/slides/EditSlideDrawer.vue` — `mode` prop + `drawerTitle` computed; Slide Label/Audio/Notes/footer gated on `mode === 'details'`; the `text`-kind branch split into a `lyrics`-mode editable path (unchanged markup) and a `details`-mode read-only + caption path; new Slide Background section (`resolvedBackgroundUrl`, `backgroundSource`, `ownBackgroundUrl`, `backgroundFileName`, `canMutateBackground`, `lowerLevelBackgroundLabel`, `attachSlideBackground`/`onBackgroundFileSelected`/`onSetOverrideFromResolved`/`onRemoveSlideBackground`, wired to `useBackgroundUpload`); `drawer-preview`'s new CSS background-image binding; `pendingAction` prop + `pending-action-consumed` emit + the nonce-keyed watcher.
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` — new `useBackgroundUpload` mock block (mirrors the existing `useMediaUpload` mock shape) and `makeImageFile`/`selectBackgroundAttachFile`/`makeOwnBackgroundFixtures` helpers; three new describe blocks ("mode: details | lyrics", "Slide Background", "pendingAction seam for Duplicate/Delete"); the shell block's title assertion updated to "Edit Slide Details"; the "hand-written slide edited here" block and its per-kind-matrix sibling test now mount `mode: 'lyrics'`; the R054 song-group textarea assertion also mounts `mode: 'lyrics'` so it still exercises `canMutate` rather than passing trivially on the details-mode default.

## Decisions Made

- **`canMutateBackground` intentionally diverges from `canMutate`.** Composed as `isEditor && !serviceLocked` with no `isSongGroup` exclusion, per 33-CONTEXT.md's explicit statement that a song group's reduced menu still offers background-setting even though every other mutation control (label, notes, duplicate, delete, editable text) stays absent for it. Flagged inline with a comment so a future reviewer doesn't "fix" it into matching the surrounding pattern.
- **"Set for this slide only" is a direct copy-write, not an upload-UI toggle.** 33-UI-SPEC §5's prose says it "reuses the file-picker markup... toggles into the attach affordance," but this plan's own Task 2 behavior list and action text are explicit and unambiguous: "writes the CURRENTLY RESOLVED url onto the entry as its own — a copy-then-override, not a fresh upload." Followed the plan (the authoritative execution artifact) over the looser UI-SPEC wording; the acceptance criteria don't test the click behavior directly but this is the literal instruction and is what got implemented and tested (`"Set for this slide only" writes the currently resolved url...` test).
- **`pending-action-consumed` emits unconditionally per handled nonce.** The plan's prose is genuinely ambiguous on whether the emit is inside or outside the `canMutate` conditional ("Then emit pending-action-consumed so the parent clears its own state" follows the canMutate-gated action description, but the separate behavior-list bullet states the emit happens for "either transition" without qualification). Chose the interpretation that prevents a parent's pending state from getting permanently stuck when a menu dispatches an action this drawer correctly refuses (locked service / viewer / song group) — a more robust contract than leaving the parent unable to clear its own state. Documented here since it's a genuine judgment call, not literal plan text.

## Deviations from Plan

### Auto-fixed / Judgment-call Issues

**1. [Rule 3-adjacent — practical/tooling constraint] Two commits instead of three, per implementation area rather than per task**

- **Found during:** Task commit sequencing, after all three tasks were implemented and verified together.
- **Issue:** The task_commit_protocol calls for one commit per task. All three tasks live in the same two files and are tightly interleaved (Task 2's background section depends on Task 1's mode-gated template structure being in place; Task 1's `props`/`withDefaults` edit and Task 3's `pendingAction` prop both landed in the same block). A clean per-task split via `git add -p` risked either fragile hunk selection or committing an intermediate state that doesn't type-check/pass tests on its own (violating the spirit of atomic, independently-verifiable commits more than a coarser split would). A `git checkout --`-based revert-and-redo (to reconstruct the three states cleanly) was attempted and blocked by the environment's permission classifier as a destructive-looking operation.
- **Resolution:** Committed as two atomic, fully-verified commits: one `feat` covering the component implementation for all three tasks, one `test` covering all three tasks' test coverage — both commits individually pass `npm run type-check` and the full `EditSlideDrawer.test.ts` suite (verified after each commit, not just once at the end).
- **Files affected:** `src/components/slides/EditSlideDrawer.vue`, `src/components/slides/__tests__/EditSlideDrawer.test.ts`.
- **Verification:** `git log --oneline -5` shows both commits; `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts` (146/146 passing) and `npm run type-check` (exit 0) both re-run against the post-commit `HEAD` state.
- **Impact:** Traceability is coarser than the ideal (task-level) granularity but the work is fully and correctly captured, atomic, and independently verified. No scope creep, no functional deviation.

**2. [Documented gap, not silently worked around] The State-3 remove-caption's "song" branch is unreachable from this drawer's available props**

- **Found during:** Task 2, implementing `lowerLevelBackgroundLabel` (the "Removing only this slide's background — the {group's/song's} still applies." caption).
- **Issue:** `EditSlideDrawer.vue` receives `group` (with its own `backgroundImageUrl`, directly readable) but no `song` document — no plan in this phase (including 33-09, verified) threads a song-level background lookup into this component, and `AssembledSlide.slide.backgroundSource` only ever reflects the ACTIVE winning tier (always `'slide'` whenever the entry has its own value), never what's suppressed beneath it. The GROUP branch of the caption is therefore provable directly; the SONG branch is not.
- **Resolution:** `lowerLevelBackgroundLabel` returns `'group'` when `props.group?.backgroundImageUrl` is set, and `null` (no caption) otherwise — it never asserts a `'song'` caption it cannot verify. This is deliberately conservative: showing a caption this component cannot confirm would risk the inverse of this phase's own named "sharpest UI risk" (an override the user cannot see) — a FALSE claim that a background survives when it doesn't. Documented inline in the code with a comment pointing back to this SUMMARY.
- **Files affected:** `src/components/slides/EditSlideDrawer.vue` (`lowerLevelBackgroundLabel` computed).
- **Verification:** The plan's own acceptance criteria only test the group-caption case ("ends with `the group's still applies.` when both a group and a song background exist beneath the entry's own") — this is fully covered. The song-only case is not asserted anywhere (by design, since it cannot be proven).
- **Impact:** A slide whose own background overrides ONLY a song-level background (no group background beneath it) will show NO remove-caption at all, rather than "the song's still applies." This is a narrower UI gap than a wrong caption would be, and does not affect the actual cascade resolution (slide→group→song), only this one informational caption's completeness. **Flagged for Wave 4 (33-09) and any future phase touching this drawer:** closing this gap needs a `song` background lookup threaded into `EditSlideDrawer.vue`, out of this plan's file scope.

---

**Total deviations:** 2 (1 tooling/process constraint, 1 documented data-availability gap)
**Impact on plan:** No functional regressions, no scope creep. Both deviations are transparency/traceability items, not correctness defects — all of this plan's stated acceptance criteria pass.

## Issues Encountered

- Several of my first-draft background-section tests set `entry.backgroundImageUrl` without a matching `assembledSlide.slide.backgroundImageUrl`/`backgroundSource: 'slide'` override — since `resolvedBackgroundUrl` (which the State-1/2/3 branching keys on) reads from `assembledSlide`, not `entry`, directly, these fixtures would have silently exercised State 1 instead of the intended State 3. Caught and fixed before committing by re-deriving each fixture through a new `makeOwnBackgroundFixtures()` helper that keeps both in sync, mirroring how the real resolver would produce them.
- `git checkout --` (scoped to the two changed files, attempting a clean revert-and-redo for per-task commits) was denied by the environment's permission classifier as a destructive-looking action. Resolved by committing the already-fully-verified work as two commits (component + tests) instead — see Deviation 1 above.

## User Setup Required

None — no external service configuration required. `orgs/{orgId}/backgrounds/**` and `storage.rules` were already confirmed unchanged/sufficient by 33-03's research; this plan introduces no new Storage paths or rules.

## Next Phase Readiness

**For Wave 4 (33-09), which also touches `EditSlideDrawer.vue`:**

- The `mode` prop, `drawerTitle` computed, and every section's mode-gating are in place and stable — 33-09 can build the `SlidesTab.vue`/`SlideActionMenu.vue` wiring against `mode: 'details' | 'lyrics'` as specified.
- The `pendingAction` prop and `pending-action-consumed` emit are fully implemented, tested, and ready for `SlidesTab.vue` to dispatch into (`{ key: 'duplicate' | 'delete', nonce: number }`). No changes to this seam are anticipated from 33-09's own plan text.
- 33-09's own "Deliberate deletions" table assigns removal of the in-body "Edit in song"/"Edit in scripture" link buttons and the `edit-in-scripture` emit to itself — this plan deliberately left those untouched (confirmed: no `drawer-edit-in-song-link`/`drawer-edit-in-scripture-link` markup was touched by this plan), so 33-09's wiring points there are clean.
- **Known gap for a future phase to close (see Deviation 2):** the State-3 remove-caption's "song" branch cannot be proven from this drawer's current props. If a future phase threads song-level background data into `EditSlideDrawer.vue` (e.g., for another reason), revisiting `lowerLevelBackgroundLabel` to add the song branch would be a small, additive change.
- **Test evidence:** `EditSlideDrawer.test.ts` grew from 108 `it()` / 11 `describe()` (post-33-04 baseline, confirmed via `git show HEAD~2:...` before this plan's commits) to 142 `it()` / 14 `describe()` (146 executed test cases, `it.each` expansion accounted for) — 0 splits, 1 component file, 1 test file, confirmed via `ls | grep -c EditSlideDrawer` returning 1 for both. Full suite (`npx vitest run src/`) shows 2 failed files / 9 failed tests / 2089 passed — exactly the documented non-defect baseline (`src/storage.rules.test.ts` needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` has a pre-existing stale assertion), with zero new regressions. `npm run type-check` (`vue-tsc --build`) exits 0.
- No blockers.

---
*Phase: 33-backgrounds-slide-editing*
*Completed: 2026-08-03*

## Self-Check: PASSED

Both modified files confirmed present on disk; both commit hashes (`0568489`, `6358a32`) confirmed present in git log.
