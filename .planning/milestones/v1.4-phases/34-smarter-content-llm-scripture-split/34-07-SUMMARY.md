---
phase: 34-smarter-content-llm-scripture-split
plan: 07
subsystem: ui
tags: [vue, typescript, vitest, scripture, congregational-reading, slides, modal]

# Dependency graph
requires:
  - phase: 34-smarter-content-llm-scripture-split (plan 05)
    provides: "ScriptureSlot.congregationalSections and the shared scripture.ts helpers (congregationalSlideFieldsFromSlot, scriptureSlotAfterReferenceChange) this plan consumes rather than reimplements"
  - phase: 34-smarter-content-llm-scripture-split (plan 06)
    provides: "CongregationalEditor.vue as a pure controlled component — props { reference, sections }, emits { update:sections, update:reference, close } — with no persistence of its own"
  - phase: 34-smarter-content-llm-scripture-split (plan 10)
    provides: "serviceSaveStatusVisible / hasVisibleSaveStatus and the sticky save-status bar's chrome-gate pattern this plan extends with a second condition"
provides:
  - "CongregationalEditor.vue mounted by application code — the R064 reachability gap 34-VERIFICATION.md recorded is closed"
  - "Two slide-side routes (the 3-dot action menu's edit-in-scripture key, and the Edit Slide Drawer's new Slide Text control) converging on ONE relay (requestEditInScripture) and ONE mounted editor"
  - "A keyed Teleported modal in ServiceEditorView.vue hosting CongregationalEditor, wired onto ScriptureSlot.congregationalSections through the existing useAutoSave over localService"
  - "Exactly one save-status live region on the service:{serviceId} surface at any moment, even with the modal open"
affects: [34-08, 34-12, presentation-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reused relay, replaced handler body — SlidesTab's requestEditInScripture()/navigate-to-scripture-editor wiring is unchanged; only handleNavigateToScriptureEditor's body (what happens on arrival) changed from tab-switch-plus-scroll to opening a keyed modal"
    - "Teleported modal keyed on record identity (WR-04) — CongregationalEditor is mounted :key=\"congregationalSlot.id\" because it seeds its editable state once at setup and is not reactive to a later prop change; the key forces a fresh instance on every slot swap"
    - "Suppress the page's live region while a second one on the same surface id is open, rather than giving the second region a different surface id — two regions with different ids would disagree; two regions with the same id and both mounted would double-announce and make a data-testid selector ambiguous"

key-files:
  created: []
  modified:
    - src/components/slides/slideDisplay.ts
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "The mount seam is the SLIDE, not the Service Order row — per owner UAT finding F1 (34-UAT.md), superseding this plan's original Service Order row design. Both slide-side entry points (action menu, drawer) converge on the same relay."
  - "No free-text scripture override anywhere — the owner was shown the D-13/D-15 shadow-copy tension and explicitly declined it. The only route to slide text is fetch-then-split inside CongregationalEditor."
  - "Suppress, don't re-id, the page's save-status bar while the modal is open — giving the modal a different surface id would create two DISAGREEING statuses, which the plan's threat register (T-34-07-06) explicitly calls worse than the double-announce problem it would solve."

requirements-completed: [R064]

coverage:
  - id: D1
    description: "Both slide-side routes (3-dot menu's edit-in-scripture key, relabelled 'Edit scripture text' with default tone; drawer's new drawer-edit-scripture-text-btn) converge on the same requestEditInScripture() relay, which opens the same one mounted CongregationalEditor"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#slideActionMenuItems (R063, 33-UI-SPEC.md §3) — 34-07 cases"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#34-07 — the drawer Slide Text route to the scripture editor"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts#Menu dispatch / WR-04 — drawer route cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "CongregationalEditor.vue is mounted by application code (ServiceEditorView.vue) — grep -rl 'CongregationalEditor' src --include=*.vue includes ServiceEditorView.vue, and grep -rc '<CongregationalEditor' src --include=*.vue totals 1 across the whole tree"
    requirement: "R064"
    verification:
      - kind: other
        ref: "grep -rl \"CongregationalEditor\" src --include=*.vue; grep -rc \"<CongregationalEditor\" src --include=*.vue"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - congregational reading (34-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "update:sections lands on ScriptureSlot.congregationalSections via the existing spread-and-reassign shape, persisted by the one existing useAutoSave over localService; update:reference routes through scriptureSlotAfterReferenceChange, which also clears a reading that no longer belongs to the slot on a reference change"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#relays navigate-to-scripture-editor for a SCRIPTURE slot / #update:reference routes through onScriptureChange"
        status: pass
    human_judgment: false
  - id: D4
    description: "The panel is mounted keyed on the slot's id (WR-04) — a slot swap forces a fresh CongregationalEditor instance, re-seeds from the new slot's props, and a post-swap write lands on the new slot only, leaving the first slot's stored sections byte-unchanged"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - WR-04 keyed mount (34-07 Task 3)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Exactly one save-status live region exists on the service:{serviceId} surface at any moment — the page's sticky bar's v-if gains congregationalSlotIndex === null, proven by a document-scoped (not wrapper-scoped) count assertion, since the modal is Teleported to body"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#exactly one [data-testid=\"save-status\"] exists in the whole document while the modal is open..."
        status: pass
    human_judgment: false
  - id: D6
    description: "A locked/non-editor service offers no route from either entry point and accepts no section write; nothing on a scripture path mentions a lyrics route (negative /lyric/i guard on both the menu label and the drawer caption)"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#for a service whose status is planned (locked), relaying renders no modal"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#no item returned for a scripture entry ever mentions lyrics / EditSlideDrawer.test.ts#the scripture caption names the editor it opens AND fails a case-insensitive /lyric/ test"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 07: Mount the Congregational-Reading Editor on the Scripture Slide Summary

**Closed the R064 reachability gap `34-VERIFICATION.md` recorded — `CongregationalEditor.vue` is now mounted by `ServiceEditorView.vue` as a keyed, Teleported modal reachable from two slide-side routes that converge on one relay, with sections written onto `ScriptureSlot.congregationalSections` through the existing autosave and exactly one save-status live region on screen at any moment.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-03T20:43:00-04:00
- **Completed:** 2026-08-03T21:07:11-04:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- **The feature is reachable.** Per owner UAT finding F1 (`34-UAT.md`), the mount seam moved from the Service Order row (this plan's original design) to the SLIDE itself: the 3-dot action menu's `edit-in-scripture` key (relabelled "Edit scripture text", default tone instead of `nav`) and the Edit Slide Drawer's new `drawer-edit-scripture-text-btn` control both funnel through the SAME `requestEditInScripture()` relay `SlidesTab.vue` already owned, so there is exactly one editor surface with two routes into it.
- **The relay is reused, the destination is replaced.** `handleNavigateToScriptureEditor`'s name, signature, and binding are untouched; its body no longer switches tabs and scrolls (R047's now-obsolete destination) — it validates the index/kind/permission exactly as before, then opens a keyed modal over the Slides tab where the request originated, so the user is never dragged off the tab they were working in.
- **`CongregationalEditor.vue` is mounted by application code.** A `Teleport`ed modal in `ServiceEditorView.vue`, same shape as the existing Planning Center export dialog, keyed `:key="congregationalSlot.id"` (WR-04) so a slot swap forces a fresh instance rather than silently reusing one seeded from the first slot it ever saw — proven by a dedicated swap test, not assumed from the `:key` attribute.
- **Sections land on the slot and persist through the existing autosave.** `onCongregationalSectionsChange` writes `update:sections` onto `ScriptureSlot.congregationalSections` via the same spread-and-reassign shape `onScriptureChange` already used; `onScriptureChange` itself now routes through 34-05's `scriptureSlotAfterReferenceChange`, which also owns clearing a stale congregational reading when the reference changes to a different passage.
- **One save-status region, not two.** The modal header renders the shared `SaveStatusIndicator` on the same `service:{serviceId}` surface id the page's sticky bar uses (R041 stays intact behind the modal); that sticky bar's `v-if` gained `congregationalSlotIndex === null` so the two never coexist. Pinned by a document-scoped (not `wrapper`-scoped) count assertion, since the modal is Teleported to `body`.
- **No free-text scripture override exists anywhere** — the owner's binding decision. The only route to slide text is a passage fetch followed by a split, inside `CongregationalEditor` itself.

## Task Commits

Each task was committed atomically:

1. **Task 1: Give the slide two honest routes to the editor — action menu and drawer — converging on one relay** - `64ac7a8` (feat)
2. **Task 2: Mount the editor — replace the relay handler's body with a keyed modal, and wire its emits onto the slot** - `90aeefc` (feat)
3. **Task 3: Prove the WR-04 keyed-mount contract — a slot swap yields a fresh component instance** - `8bb9dd5` (test)

**Plan metadata:** (this commit) `docs(34-07): complete mount-congregational-editor-on-scripture-slide plan`

## Files Created/Modified

- `src/components/slides/slideDisplay.ts` — `MENU_ITEM_LABELS['edit-in-scripture']` relabelled "Edit scripture text"; `menuItemToneFor` no longer classes it as navigation (default tone, matching `edit-details`)
- `src/components/slides/__tests__/slideDisplay.test.ts` — new label/tone/order regression cases plus a case-insensitive `/lyric/` negative guard for both `canMutate` values
- `src/components/slides/EditSlideDrawer.vue` — new `edit-scripture-text` emit (no payload); scripture branch of the Slide Text section gains a `canMutate`-gated `drawer-edit-scripture-text-btn`; `SCRIPTURE_TEXT_CAPTION` rewritten to name what the control opens, with no mention of a lyrics route
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` — control presence/absence-when-locked/single-emit-per-click cases, plus the positive caption assertion AND its `/lyric/` negative guard scoped to the caption element (never the whole file, since the `text`-kind branch legitimately keeps its own lyrics caption)
- `src/components/slides/SlidesTab.vue` — `onDrawerEditScriptureText()` runs the same WR-04 unsaved-drawer guard the menu path runs, closes the drawer, and calls the same `requestEditInScripture()`; the menu's `edit-in-scripture` case now also closes the drawer first
- `src/components/slides/__tests__/SlidesTab.test.ts` — drawer-emit convergence cases (array index, drawer closes) plus the cancelled/confirmed guard cases in the WR-04 describe block
- `src/views/ServiceEditorView.vue` — static import of `CongregationalEditor`, `congregationalSlotIndex`/`congregationalSlot`, `handleNavigateToScriptureEditor`'s body replaced (no longer async, no `nextTick`/`scrollIntoView`), `closeCongregationalEditor`, `onCongregationalSectionsChange`, the keyed `Teleport`ed modal (new test ids `congregational-editor-modal`/`congregational-editor-panel`/`congregational-editor-close`), `onScriptureChange` now calls `scriptureSlotAfterReferenceChange`, sticky save-status bar's `v-if` extended with `congregationalSlotIndex === null`
- `src/views/__tests__/ServiceEditorView.test.ts` — rewrote the pre-existing "Edit in scripture plumbing" relay tests to assert the new modal destination (not the removed tab-switch-and-scroll); added a "congregational reading (34-07)" describe block that mounts `CongregationalEditor` for real; added a "WR-04 keyed mount (34-07 Task 3)" describe block proving the slot-swap contract

## Decisions Made

- **The mount seam is the slide, not the Service Order row** — this plan's `★ REVISED` header explains the pivot from the original design to the owner's F1 finding; both slide-side routes converge on the one relay `SlidesTab.vue` already owned.
- **Suppress the page's save-status region rather than give the modal a different surface id.** A different id would make the two regions disagree about status; suppressing the page's copy while the modal is open keeps one aggregator, one save path, one surface id, with status visible throughout.
- **No new persistence path.** `onCongregationalSectionsChange` adds no save call of any kind — the plan's `key_links` are explicit that the existing `useAutoSave(localService, ...)` is the only persistence route, exactly as it is for `onScriptureChange`/`onSelectSong`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Grep acceptance criterion for `requestEditInScripture()` initially read 4, not 3**
- **Found during:** Task 1, post-implementation grep verification
- **Issue:** The new comment above `onDrawerEditScriptureText` referenced `` `requestEditInScripture()` `` in backticks, which is a literal substring match for the plan's exact `grep -c` acceptance criterion (expected `3`: the declaration plus the two convergent call sites).
- **Fix:** Reworded the comment to reference `` `requestEditInScripture` `` (no parens) instead, leaving the two real call sites and the one declaration as the only matches.
- **Files modified:** `src/components/slides/SlidesTab.vue`
- **Verification:** `grep -c "requestEditInScripture()" src/components/slides/SlidesTab.vue` now outputs `3`.
- **Committed in:** `64ac7a8` (Task 1 commit)

**2. [Rule 1 - Bug, test-authoring] `shallowMount` auto-stubs every child regardless of whether it's listed in `stubs`**
- **Found during:** Task 2's new "congregational reading (34-07)" describe block, and again independently while writing Task 3's WR-04 swap test
- **Issue:** Both new test blocks intended to mount `CongregationalEditor` for real (per the plan's explicit instruction — "the new block must mount it for real so the panel's props and emits are exercised") but omitted an explicit `CongregationalEditor: false` entry in the `stubs` map. `shallowMount` auto-stubs every child component by default regardless of whether it appears in `stubs` at all — only an explicit `false` opts a given component OUT of that default. The tests were passing vacuously (a stubbed component still forwards `vm.$emit` calls, so the prop-wiring/emit-convergence assertions worked, but the WR-04 seeding-text assertions failed outright once written, since a stub renders no real template content).
- **Fix:** Added `CongregationalEditor: false` to both describe blocks' `stubs` maps.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** Both blocks' tests pass with the real component mounted; the WR-04 seeding-text assertions (which require real rendered content) now exercise genuine behavior instead of a stub's attribute dump.
- **Committed in:** `8bb9dd5` (Task 3 commit, alongside the new WR-04 block)

**3. [Rule 1 - Bug, test-authoring] Teleported modal content invisible to `wrapper.find` under `shallowMount` without `teleport: false`**
- **Found during:** Task 2, first run of the rewritten "Edit in scripture plumbing" describe block
- **Issue:** `shallowMount` discards `<Teleport>` children by default unless the `teleport: false` stub is set — an existing, established convention elsewhere in this same test file (the service-lifecycle-transitions describe block already does this for the export/reopen/delete dialogs). The "Edit in scripture plumbing" block's `mountView()` helper predates this plan and never needed it, since no prior test in that block queried Teleported content.
- **Fix:** Added `teleport: false` to that block's `mountView()` stubs, matching the established pattern.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** All rewritten relay tests in that block pass, correctly finding the Teleported `congregational-editor-modal` via a `document.body`-scoped `DOMWrapper`.
- **Committed in:** `90aeefc` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking acceptance-criteria collision, 2 test-authoring corrections). All confined to test files or a comment; zero deviations in shipped component/view behavior from what the plan specified.
**Impact on plan:** No scope creep. All three were required to make the plan's own acceptance criteria and stated intent ("mount it for real") actually true, given `@vue/test-utils`'s real stubbing/teleport behavior.

## Issues Encountered

None beyond the three items documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **R064's reachability gap is closed.** `34-VERIFICATION.md`'s Truth 1 ("A scripture item can be split into a leader/congregation congregational reading") previously FAILED solely because `CongregationalEditor.vue` had zero production mount points; that mount now exists, is reachable from both slide-side routes, and is proven by tests that mount the real component rather than a stub.
- **Nothing on a scripture path names an action it does not perform.** Both the relabelled menu item and the rewritten drawer caption were verified against a case-insensitive `/lyric/` guard, scoped correctly (the drawer's `text`-kind branch legitimately keeps its own lyrics caption at a different testid and was left untouched).
- **34-08 and 34-12** (both still incomplete per `init.execute-phase`) are unaffected by this plan's scope — no shared files were touched outside the eight listed above.
- Full-suite regression check (`npx vitest run --dir src`, 2403 tests): 2394 passing, 9 failing — all 9 are the documented pre-existing baseline (`src/storage.rules.test.ts` needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` has one stale assertion). Zero new failures introduced by this plan.
- `npm run type-check` (`vue-tsc --build`) exits 0.
- No blockers. `PENDING-VERIFICATION.md` item 34.2 (the reachability/data-model decision) is now resolved by this plan's shipped code; item 34.1 (empirical AI-split determinism against a live Anthropic API) remains open and out of this plan's scope, unchanged.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 8 modified files verified present on disk; all 3 task commits (`64ac7a8`, `90aeefc`, `8bb9dd5`) verified present in git log.
