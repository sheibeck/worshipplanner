---
phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/views/ServiceEditorView.vue
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/components/slides/SlidesTab.vue
  - src/components/slides/__tests__/SlidesTab.test.ts
  - src/components/PresentationViewer.vue
  - src/components/ScriptureSlideEditor.vue
  - src/components/PptxImportModal.vue
  - src/components/slides/SlideGrid.vue
  - src/components/slides/SlideGroupMusicControl.vue
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-07-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 27 renamed the Service Order tab, stripped deck/media-editing surfaces from it, deleted
three orphaned components (`ImportedSlideEditor`, `SlotMediaAttachment`, `SlideshowPreview`) with
their tests, and moved the "Present" CTA to the Slides tab. This is a removal-heavy phase, so the
review traced the five load-bearing paths called out in the phase brief end to end rather than
just diffing the changed lines.

**What was verified as intact and correctly connected:**

- **D-01 `ServiceSlot.id` backfill** (`backfillSlotIds`, `src/utils/slotTypes.ts`) is untouched by
  this phase (last modified in Phase 24-01) and both call sites in the service-store watcher
  (initial load and remote-merge paths) are unchanged.
- **`ScriptureSlideEditor` reachability**: the full chain — `SlidesTab`'s `navigate-to-scripture-editor`
  emit → `ServiceEditorView.handleNavigateToScriptureEditor` → `activeTab.value = 'service-order'` →
  `expandScriptureEditor(index)` → scroll to `[data-scripture-panel-index]` — is intact and covered by
  tests (`ServiceEditorView.test.ts` lines 1275–1369), including the out-of-range and non-scripture
  no-op guards.
- **Section-assignment `<select>`** (`data-testid="section-select"`) and the **group-delete cascade**
  (`confirmSlotDelete` → `slideGroupsStore.deleteGroup` before `performRemoveSlot`, with a failure
  path that leaves the slot in place) are both present and unchanged in substance.
- **Group-bed audio write path**: `SlotMediaAttachment` (the old per-slot control) was correctly
  removed along with its handlers (`displaySlotAudioUrl`, `onSlotBedAudioChange`); the write path
  (`setGroupBedMedia`) now lives entirely in `SlideGroupMusicControl.vue` + `SlideGrid.vue`
  (`onAttachGroupMusic` / `onRemoveGroupMusic`), and the retired `ServiceEditorView.test.ts`
  assertions have direct, verified replacements in `SlideGroupMusicControl.test.ts` /
  `SlideGrid.test.ts` (confirmed by grep: `setGroupBedMedia`, `clearAudio`, `bedAudioUrl` all
  present in the successor suites).
- **Autosave**: the `localService` deep watch, 800ms debounce, `autosaveSaving` in-flight guard, and
  the idle/saved merge rule in the service-store watcher are all unchanged.
- **`PptxImportModal.vue`** is still imported and wired by `SlideGrid.vue` (append-to-group path),
  and **`PresentationViewer.vue`** is byte-for-byte unchanged from Phase 23 (confirmed via diff —
  Phase 27 only changed its *call site*, never the component itself).
- **The rename**: `activeTab` exists in five files total; grepped `SongSlideOver.vue`,
  `QuarterView.vue`, `RosterView.vue`, `ServicesView.vue` and confirmed each has its own unrelated
  `activeTab` union (`'details'|'lyrics'`, `'schedule'|'volunteers'|'serviceDates'`,
  `'volunteers'|'roles'`, `'services'|'rotation'|'scripture-rotation'`) — none renamed. Grepped the
  whole `ServiceEditorView.vue` for a stale `'music'` literal: the only surviving occurrence is
  inside a prose comment (`// ...renamed from 'music' in Phase 27...`), not a live comparison —
  every `v-show`/`:class`/`@click` binding uses `'service-order'` consistently.
- **The Present CTA move (D-05)**: exactly one `presenting` flag and one `PresentationViewer` mount
  exist in `ServiceEditorView.vue` (verified via diff of commit `64b5aaa` — the Service Order tab's
  old `SlideshowPreview` + `PresentationViewer` pair was removed in the same commit that added the
  Slides tab's `PresentationViewer` mount, so there was never a window with two). `SlidesTab.vue`'s
  new `canPresent` computed (`assembledSlideshow.length > 0`) is a verified faithful restatement of
  the deleted `SlideshowPreview.vue`'s own `canPresent`/`hasAnySlides` — that file's own doc comment
  stated `nonEmptySections.length > 0` was "Exactly equivalent to `assembledSlideshow.length > 0`",
  confirming no behavior drift.
- **Test-probe re-seating**: the five `data-testid="service-order-panel"` assertions in
  `ServiceEditorView.test.ts` route through a real `isVShowHidden()` helper that walks the DOM
  ancestor chain checking `el.style.display === 'none'` — not a probe that is unconditionally
  present regardless of tab state. Each of the five assertions toggles a tab and asserts both the
  before and after `v-show` state, so they exercise the actual conditional rather than trivially
  passing.

No over-deletion or half-connection was found in the five areas called out in the phase brief.

## Warnings

### WR-01: `SlidesTab.vue`'s new Present CTA has no direct test coverage

**File:** `src/components/slides/SlidesTab.vue:12-23`
**Issue:** The new `present-slideshow-cta` button and its `canPresent` disabled/enabled predicate
(`src/components/slides/SlidesTab.vue:167`) have no test in
`src/components/slides/__tests__/SlidesTab.test.ts` — that file's test suite covers selection,
drawer, and scripture-relay behavior but never mounts/clicks the Present button or asserts on
`canPresent`'s disabled state at 0 vs >0 assembled slides. Coverage for the *wiring* exists one
level up (`ServiceEditorView.test.ts` emits `'present'` directly on the `SlidesTab` stub), but that
only proves the parent reacts to the emit — it never exercises the button's own disabled-state
logic or that a real click actually fires the emit. A regression that flips `canPresent`'s
comparison (e.g. `< 0` instead of `> 0`) or removes `:disabled` would not be caught by any test.
**Fix:** Add a `SlidesTab.test.ts` case such as:
```ts
it('disables the Present button when there are no assembled slides, and enables it once there are', async () => {
  const wrapper = mountTab({ slots: [], assembledSlideshow: [] })
  await wrapper.vm.$nextTick()
  expect(wrapper.find('[data-testid="present-slideshow-cta"]').attributes('disabled')).toBeDefined()

  await wrapper.setProps({ assembledSlideshow: [makeAssembled(0, 'slide-1')] })
  await wrapper.vm.$nextTick()
  expect(wrapper.find('[data-testid="present-slideshow-cta"]').attributes('disabled')).toBeUndefined()

  await wrapper.find('[data-testid="present-slideshow-cta"]').trigger('click')
  expect(wrapper.emitted('present')).toBeTruthy()
})
```

## Info

### IN-01: `isSlotPopulated` is unreachable dead code

**File:** `src/views/ServiceEditorView.vue:1774-1794`
**Issue:** This function is defined but never called anywhere in the codebase (verified by
project-wide grep — the only match is its own declaration). It became dead when Phase 12-05
rewrote `removeSlot()` to unconditionally confirm every removal (commit `9eaf3760`, well before
Phase 27), so this predates the current phase and is not a regression it introduced. It is,
however, still present in a file this phase touched extensively, and its logic duplicates
`isSlotPopulated`'s own now-superseded gating concept — a future reader could reasonably assume it
is load-bearing (e.g. for the `pendingDeleteIsClear` gate in `onClearSong`, which actually
duplicates similar logic inline instead of reusing it).
**Fix:** Delete the function, or if a future feature is expected to need it, add a comment
explaining why it survives unreferenced. Given the phase's own theme (removing unused surfaces),
this is a natural companion cleanup, though out of this phase's stated scope.

### IN-02: `ScriptureSlideEditor.vue` and `PptxImportModal.vue` reviewed only as dependencies, not diff targets

**File:** `src/components/ScriptureSlideEditor.vue`, `src/components/PptxImportModal.vue`
**Issue:** Neither file appears in any of the five Phase 27 commits' diffs (confirmed via
`git log --follow` / commit stat inspection) — they were included in required reading purely to
verify they remain correctly wired after the surrounding removals, which they do. No code changes
were needed or made to either file by this phase. Noted here only so the absence of findings
against these two files isn't mistaken for them having been skipped.
**Fix:** None needed — informational only.

---

_Reviewed: 2026-07-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
