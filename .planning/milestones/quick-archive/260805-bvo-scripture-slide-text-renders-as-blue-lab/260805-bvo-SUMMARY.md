---
phase: quick-260805-bvo
plan: 01
subsystem: ui
tags: [vue, vitest, slides, presentation, drawer, menu]

requires: []
provides:
  - "Scripture reference on the Present screen renders as white slide content (text-gray-100) instead of an accented uppercase label, in both the normal and congregational sub-branches"
  - "EditSlideDrawer.vue has a single body (no mode prop) — Slide Label, Slide Text, Slide Audio, Notes and footer actions all render together, gated on canMutate alone"
  - "A non-song slide's 3-dot menu offers exactly one edit affordance (Edit details) plus Duplicate/Delete for a mutator — the edit-lyrics key is removed from MenuItemKey"
  - "A HYMN group's auto-derived pristine text slide gets the same editable body and menu as a hand-added one — the anti-shadow-copy Hymn carve-out is reversed on owner authority"
affects: [slides, presentation-viewer, service-editor]

tech-stack:
  added: []
  patterns:
    - "Exact-list toEqual menu assertions instead of negative containment, so a removed key cannot silently make a pin go vacuous"

key-files:
  created: []
  modified:
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/SlidesTab.vue
    - src/components/slides/slideDisplay.ts
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
    - src/components/slides/__tests__/SlidesTab.test.ts
    - src/components/slides/__tests__/SlideGrid.test.ts
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/components/slides/__tests__/SlideActionMenu.test.ts

key-decisions:
  - "Removed the mode prop from EditSlideDrawer.vue outright (Claude's discretion, CONTEXT.md-granted) rather than leaving an unreachable 'lyrics' path — costs more test churn but leaves zero dead branches; npm run type-check's excess-property errors were used as the exhaustive worklist for every leftover mode argument"
  - "Deleted the text branch's drawer-slide-text-caption entirely rather than rewording it, since there is no second mode left for a caption to point at"
  - "Kept the text case in slideActionMenuItems as its own switch branch even though it now returns the same list as imported/video, because text is the one kind whose body the drawer edits and whose contract is most likely to diverge again"
  - "Kept the now-unconsulted planItemKind parameter rather than removing it — removal would churn eight call sites for no behavioural gain, and this repo's ESLint (args: 'after-used') plus the root tsconfigs (no noUnusedParameters) do not flag it"

requirements-completed: [QUICK-260805-bvo]

coverage:
  - id: D1
    description: "Scripture reference renders as white slide content (text-gray-100), not an accented uppercase label, in both the normal and congregational sub-branches"
    requirement: "QUICK-260805-bvo"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#D1: a normal-mode ScriptureSlide renders its reference as white slide content, not an accented label"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#D1: a congregational ScriptureSlide renders its reference as white slide content too, without washing out the speaker tags"
        status: pass
    human_judgment: true
    rationale: "Task 1's <human-check> asks the owner to visually confirm the Present screen treatment and the two-level hierarchy on a real projected slide — a rendering/typography judgment automation cannot make."
  - id: D2
    description: "EditSlideDrawer has one body: Slide Label, the editable Slide Text, Slide Audio, Notes and footer actions all render together for a mutator, with no mode prop and no second caption/mode fork"
    requirement: "QUICK-260805-bvo"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#renders the owner's ask: Slide Label, the editable Slide Text, Slide Audio, Notes and the footer actions all together in ONE body"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#renders no editable slide-text textarea for a song group, even for a text-kind entry (R054/P-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A non-song slide's 3-dot menu offers exactly edit-details plus duplicate/delete for a mutator; a HYMN group's pristine text entry gets the identical list to a hand-added one; scripture and song menus are unchanged"
    requirement: "QUICK-260805-bvo"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#D2 (260805-bvo), owner-authorised reversal of the Hymn carve-out: a still-pristine Hymn text entry (no body) and a hand-added blank one (body: \"\") return IDENTICAL menu lists"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#R054/P-03: for a SONG group, every card menuItems equals exactly edit-details, edit-in-song"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#34-07: the scripture route item is labelled \"Edit scripture text\" with a default (non-nav) tone, key order unchanged"
        status: pass
    human_judgment: true
    rationale: "Task 3's <human-check> asks the owner to confirm the collapsed menu and single-body drawer in the running app, on a real Prayer item and a real Song group — a UX confirmation beyond what the unit-level exact-list assertions can prove alone."

duration: 25min
completed: 2026-08-05
status: complete
---

# Quick Task 260805-bvo: Scripture Slide Text + Edit Details/Lyrics Collapse Summary

**Scripture reference recolored to white slide content (text-gray-100), and EditSlideDrawer collapsed from a two-mode (details/lyrics) shell to one body with a single "Edit details" menu affordance, including an owner-authorized reversal of the HYMN anti-shadow-copy carve-out.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-05T13:04:00Z
- **Completed:** 2026-08-05T13:22:43Z
- **Tasks:** 3 completed
- **Files modified:** 10

## Accomplishments

- **D1:** `PresentationViewer.vue`'s scripture branch reference (`presentation-label`) no longer renders as an accented `text-indigo-400 uppercase tracking-wider` label — it now carries `text-gray-100`, matching every other slide kind's content color, while retaining `text-2xl font-semibold leading-[1.3] mb-8` so a reference-plus-verse slide still shows two hierarchy levels. Both the normal and congregational sub-branches are covered by the single class edit; the Leader/Congregation speaker tags keep their own distinct accent treatment (asserted unchanged in the new congregational test).
- **D2:** `EditSlideDrawer.vue` now has exactly one body. The `mode: 'details' | 'lyrics'` prop, the `drawerTitle` computed, and every `mode === 'details'` conjunct are gone; every section (Slide Label, Slide Text, Slide Audio, Slide Background, Notes, footer actions) gates on `canMutate` alone. The text branch's textarea is shown/hidden purely by `canMutate` and seeded live with the entry's body — no second mode, no `drawer-slide-text-caption` pointing at a mode that no longer exists.
- **D2 (menu):** `slideActionMenuItems`'s `text` branch no longer computes `hasBody`/`offersEditLyrics`; every `text`-kind entry now returns `['edit-details', 'duplicate', 'delete']` (mutator) regardless of body-definedness or `planItemKind`. `'edit-lyrics'` is removed from `MenuItemKey`, its label row, and `SlidesTab.vue`'s dispatch switch.
- **HYMN reversal:** A HYMN group's auto-derived pristine text slide (`sourceRef.body === undefined`) now gets the identical menu and editable drawer body as a hand-added one — the anti-shadow-copy discriminator that used to withhold the second affordance from it is gone, per the owner's explicit, recorded authority. The stale code comment asserting the old rule is rewritten to record the reversal, its authority, and its accepted consequence (a HYMN slide can now diverge from its Service Order Hymn fields — accepted as temporary, T-bvo-03).
- **Carve-outs held:** R054/P-03 (song group `lyric`/`copyright` entries stay read-only, no editable body, no duplicate/delete) and D3 (scripture's menu — `edit-details` + `edit-in-scripture`, unchanged) are both pinned with exact-list assertions and verified unchanged.
- Ordering discipline followed as planned: Task 2 (drawer) landed before Task 3 (menu), so no intermediate commit ever left slide text uneditable.

## Task Commits

Each task was committed atomically:

1. **Task 1: Render the scripture reference as white slide content (D1)** - `2d63b0d` (fix)
2. **Task 2: Give the drawer one body that edits label AND text, and delete the mode prop (D2, part 1 of 2)** - `d92ecd9` (feat)
3. **Task 3: Collapse the menu to one edit affordance and remove the dead key (D2, part 2 of 2)** - `b250a9e` (feat)

**Plan metadata:** committed separately by the orchestrator (SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md are excluded from this executor's commits per instructions).

_Note: none of these three tasks used the RED→GREEN→REFACTOR TDD cycle as separate commits — each task's `tdd="true"` behavior/action pair (write failing test, then implement) was completed and verified within its own single commit, as the plan's task boundaries specify one commit per task._

## Files Created/Modified

- `src/components/PresentationViewer.vue` - Scripture reference class attribute change (D1) plus an explanatory comment; TextSlide title label at line ~146 left untouched
- `src/components/__tests__/PresentationViewer.test.ts` - Two new regression tests pinning the scripture reference's class list for normal and congregational sub-branches
- `src/components/slides/EditSlideDrawer.vue` - Removed the `mode` prop, `drawerTitle` computed, and every `mode === 'details'` gate; collapsed the text branch's two-mode fork into a single `canMutate` fork; deleted the now-pointless caption
- `src/components/slides/SlidesTab.vue` - Removed `drawerMode` state and the `:mode` binding; `edit-details` and (until Task 3) `edit-lyrics` fell through to one `drawerOpen.value = true`; Task 3 then removed the `edit-lyrics` case entirely and updated the dispatcher doc comments
- `src/components/slides/slideDisplay.ts` - Removed `'edit-lyrics'` from `MenuItemKey`/`MENU_ITEM_LABELS`; removed the `hasBody`/`offersEditLyrics` discriminator from the `text` case; rewrote the doc comment to record the D2 reversal, its authority, and the retained `planItemKind`/P-03 rationale
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` - Flipped ~20 `mountDrawer` call sites off the removed `mode` prop (using `npm run type-check`'s excess-property errors as the exhaustive worklist); rewrote the "one drawer body" describe block; strengthened the R054 song-group guard's comment
- `src/components/slides/__tests__/SlidesTab.test.ts` - Removed `drawer.props('mode')` assertions; removed `'mode'` from the manual stub's props array; deleted the now-impossible edit-lyrics dispatch test; retitled the two-dispatch drawer-stays-open test to use `edit-details` twice
- `src/components/slides/__tests__/SlideGrid.test.ts` - Flipped three menu-key assertions to exact-list `toEqual`: the per-kind distinguishing test, the SONG-group carve-out, and the HYMN-reversal test (both pristine and hand-added cards now assert the identical list)
- `src/components/slides/__tests__/slideDisplay.test.ts` - Flipped five `slideActionMenuItems` tests to exact-list assertions for the D2 reversal; added a new negative-label test mirroring the existing scripture guard
- `src/components/slides/__tests__/SlideActionMenu.test.ts` - Removed `'Edit lyrics'` from the `ALL_LABELS` overflow-backstop fixture and its "six fixed labels" comment (now five)

## Decisions Made

- Removed the `mode` prop from `EditSlideDrawer.vue` outright rather than keeping it as dead-but-present (CONTEXT.md's discretion grant, resolved toward "fewer dead branches"). This is stated explicitly in the plan and confirmed here as the path taken.
- Deleted `drawer-slide-text-caption`'s content for the `text` branch entirely (CONTEXT.md explicitly allowed deletion) rather than rewording it — there is nothing left for a caption to point at once the field is editable in place.
- Kept `case 'text'` as its own switch branch in `slideActionMenuItems` even though it now returns the same list as `imported`/`video`, per the plan's explicit instruction — it is the one kind whose body the drawer edits and the contract most likely to diverge again.
- Kept the now-unconsulted `planItemKind` parameter rather than removing it, since removal would churn eight call sites for no behavioural gain and this repo's ESLint (`args: 'after-used'`) plus tsconfig (no `noUnusedParameters`) do not flag it.

## Deviations from Plan

None — plan executed exactly as written across all three tasks, including task ordering (drawer before menu) and the two Claude's-discretion resolutions CONTEXT.md granted (both resolved as the plan itself states and as confirmed above).

## Issues Encountered

None. All RED→GREEN cycles behaved as predicted: `npm run type-check`'s excess-property errors on the removed `mode` prop served as the exhaustive worklist for Task 2's test-file cleanup, exactly as the plan anticipated, and the same held for `MENU_ITEM_LABELS`' `Record<MenuItemKey, string>` forcing function in Task 3.

## User Setup Required

None - no external service configuration required.

## Open Question for the Owner

`PresentationViewer.vue` line ~146 is a SECOND `presentation-label` element, carrying a `TextSlide`'s title, in the `slideKind === 'text'` branch. It still carries the accented `text-indigo-400 uppercase tracking-wider` class list that D1 removed from the scripture reference. After this task the two `presentation-label` elements diverge visually — scripture renders as white slide content, a text-slide title still renders as an accented label. This was reported by the owner as scripture-only and CONTEXT.md scoped the text-slide title out deliberately; a code comment at the scripture branch now records that the divergence is known and must not be "fixed" as drive-by cleanup. **Should the text-slide title follow the same white-content treatment, or is the label styling intentional for that kind?**

## Next Phase Readiness

Both reported defects are resolved and verified via the automated gates in `<verification>` (`npm run type-check`, the app suite at the known 2-file baseline, and all task-scoped suites green). The two `<human-check>` items from Tasks 1 and 3, plus the open question above, are the only items requiring the owner's own confirmation in the running app — everything else is ready as-is with no blockers for future phases.

---
*Phase: quick-260805-bvo*
*Completed: 2026-08-05*

## Self-Check: PASSED

- Commit `2d63b0d` (Task 1) — FOUND in git log
- Commit `d92ecd9` (Task 2) — FOUND in git log
- Commit `b250a9e` (Task 3) — FOUND in git log
- `src/components/PresentationViewer.vue` — FOUND on disk
- `src/components/slides/EditSlideDrawer.vue` — FOUND on disk
- `src/components/slides/slideDisplay.ts` — FOUND on disk
- `src/components/slides/SlidesTab.vue` — FOUND on disk
- `.planning/quick/260805-bvo-scripture-slide-text-renders-as-blue-lab/260805-bvo-SUMMARY.md` — FOUND on disk
