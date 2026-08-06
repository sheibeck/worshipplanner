---
phase: 33-backgrounds-slide-editing
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/types/slideGroup.ts
  - src/types/songLyrics.ts
  - src/types/slide.ts
  - src/utils/slideshowAssembler.ts
  - src/composables/useBackgroundUpload.ts
  - src/components/slides/slideDisplay.ts
  - src/components/slides/SlideActionMenu.vue
  - src/components/slides/BackgroundControl.vue
  - src/components/slides/SlideCard.vue
  - src/components/slides/SlideGrid.vue
  - src/components/slides/SlidesTab.vue
  - src/components/slides/EditSlideDrawer.vue
  - src/components/SongLyricEditor.vue
  - src/stores/slideGroups.ts
  - src/stores/songLyrics.ts
  - src/composables/useUnsavedGuard.ts
  - src/utils/slideGroupMaterializer.ts
  - src/utils/__tests__/slideshowAssembler.test.ts
  - src/components/slides/__tests__/SlideGrid.test.ts
  - src/components/slides/__tests__/SlideActionMenu.test.ts
  - src/components/slides/__tests__/SlideCard.test.ts
  - src/components/slides/__tests__/SlidesTab.test.ts
  - src/components/slides/__tests__/EditSlideDrawer.test.ts
  - src/components/__tests__/SongLyricEditor.test.ts
  - src/stores/__tests__/slideGroups.test.ts
  - src/stores/__tests__/songLyrics.test.ts
  - src/composables/__tests__/useBackgroundUpload.test.ts
  - src/components/slides/__tests__/BackgroundControl.test.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-08-03
**Depth:** standard
**Files Reviewed:** 15 source files (+ 12 test files cross-referenced)
**Status:** issues_found

## Summary

Phase 33 delivers the slide/group/song background cascade, the 3-dot `SlideActionMenu.vue`,
the `EditSlideDrawer.vue` details/lyrics split, and the R058 audio-scope removal. The design is
careful and the plumbing 33-VERIFICATION.md already checked (P-01 delete routing, the video/
background asymmetry, the optional-chained song tier for non-SONG groups) is genuinely correct —
I independently re-traced all of it and found no fault with what the verifier already confirmed.

This review looked past what was already checked and found four new WARNING-level defects, all in
areas the verification report did not examine: (1) the background cascade silently skips the
song tier for any non-`lyric`/`copyright` entry living inside a SONG group — a state
`slideGroupMaterializer.ts` itself proves is real and preserved, not merely hypothetical; (2) the
grid's single-menu-open state (`openMenuEntryId`) is never reset when the selected plan item
changes, so a menu can silently reappear "open" on a card the user never re-triggered; (3)
`SlideActionMenu.vue` never moves focus into its own panel on open, so Escape — the one keyboard
behavior 33-CONTEXT.md explicitly mandates — does nothing until the user has first tabbed past the
trigger, and the test suite for this dispatches keydown directly on the panel, masking the gap;
and (4) the "Discard unsaved changes?" guard this drawer imports (`useUnsavedGuard`) is now
entirely dead code — `capture()` is called but `isDirty`/`confirmDiscard` are never read anywhere
in the file, unlike its three sibling consumers, which quantifies (with a concrete grep) the
already-disclosed 33-09 regression rather than just restating it.

None of these are crashes, data loss, or security issues — all four are classified WARNING. Two
smaller INFO items round out the report.

## Warnings

### WR-01: Background cascade silently skips the song tier for non-`lyric`/`copyright` entries inside a SONG group

**File:** `src/utils/slideshowAssembler.ts:306-320` (also `src/components/slides/SlideGrid.vue:519-542`, `src/utils/slideGroupMaterializer.ts:606-617`)

**Issue:** `emitFromGroup`'s song lookup is keyed on the entry's own `sourceRef.kind`, not on the
group's owning song:

```ts
const song =
  entry.sourceRef.kind === 'lyric' || entry.sourceRef.kind === 'copyright'
    ? inputs.songLyricsById.get(entry.sourceRef.songId)
    : undefined
const media = resolveEntryMedia(group, entry, song)
```

For a `lyric`/`copyright` entry this is fine — every such entry carries its own `songId` and it
always equals the SONG group's own song. But `slideGroupMaterializer.ts:606-617`'s own reconciler
comment proves a SONG group's `slides` array can legitimately contain entries whose
`sourceRef.kind` is `text` or `video` ("a video entry appended by a drop, or a user-authored text
entry... is not part of the lyric/copyright rebuild above and would otherwise silently
disappear" — the reconciler explicitly carries them through by value). For any such entry, `song`
above resolves to `undefined` regardless of which song actually owns the group, so
`resolveEntryMedia`'s `song?.backgroundImageUrl` fallback is skipped — the cascade degrades from
three tiers (slide → group → song) to two (slide → group) for exactly these entries, even though
every sibling `lyric`/`copyright` slide in the *same* group correctly falls all the way through to
the song.

Concretely: a SONG group whose song has a background set, whose group has none, will show `From
song` chips and the song's image on every lyric/copyright card — but a `text`/`video` entry
sitting in the same group (reachable via legacy data predating R054's Phase-30 lockdown, which
`slideGroupMaterializer.ts` still preserves on every rebuild) renders `No background` and no chip
at all, an inconsistency exactly matching the "override the user cannot see" risk 33-CONTEXT.md
names as this phase's sharpest failure mode — except here it's an *inherited value the user cannot
see*, not an override.

Confirmed untested: `slideshowAssembler.test.ts`'s `background cascade (R055/R056/R057)` describe
block (lines 1106-1302) only ever uses `sourceRef: { kind: 'lyric', ... }` entries inside a SONG
group; no case exercises a `text`/`video`/`imported` entry whose OWNING group is a SONG group with
a song-level background set.

**Fix:** Derive `song` from the group's owning slot/song id rather than the individual entry's
`sourceRef`, e.g. thread the slot's `songId` (available wherever `emitFromGroup` is called, via
the SONG-slot branch) so every entry in a SONG group — regardless of its own `sourceRef.kind` —
resolves against the same song document:

```ts
// emitFromGroup already has `slot` in scope
const song =
  slot.kind === 'SONG' && slot.songId
    ? inputs.songLyricsById.get(slot.songId)
    : entry.sourceRef.kind === 'lyric' || entry.sourceRef.kind === 'copyright'
      ? inputs.songLyricsById.get(entry.sourceRef.songId)
      : undefined
```

Add a regression test: a SONG group containing one `lyric` entry and one `text` entry, song has a
background, group does not — assert both entries resolve `backgroundSource: 'song'`.

### WR-02: `SlideGrid.vue`'s `openMenuEntryId` is never reset when the selected plan item changes — a menu can silently reopen

**File:** `src/components/slides/SlideGrid.vue:372-381`

**Issue:** `openMenuEntryId` is the single ref that enforces "exactly one menu open at a time"
(33-UI-SPEC.md §2), but it is local, persistent state on a `SlideGrid` instance that is **not**
remounted when `SlidesTab.vue`'s rail selection changes plan item — only its `selectedSlot`/`group`
props change, and `cards` (line 355-365) recomputes to a different filtered list. Nothing in this
file watches `props.selectedSlot` (or `props.group`) to clear `openMenuEntryId`:

```ts
const openMenuEntryId = ref<string | null>(null)

function onCardMenuToggle(slideId: string): void {
  openMenuEntryId.value = openMenuEntryId.value === slideId ? null : slideId
}
```

Sequence that reproduces it: open card A's menu in plan item 1 (`openMenuEntryId = 'A'`) → select
plan item 2 in the rail (card A's `SlideActionMenu` unmounts along with its row, `open` becomes a
moot false since no card matches) → select plan item 1 again. `cards` recomputes and again
includes a card whose `assembledSlide.slide.id === 'A'` (same stored `GroupSlideEntry.id`, since
group document ids are stable) — `menuOpen="openMenuEntryId === card.assembledSlide.slide.id"`
immediately evaluates `true` on (re)mount, so the menu panel **opens itself** with no click, tap,
or keypress from the user.

Confirmed untested: `SlideGrid.test.ts`'s `menu ownership (33-08 Task 3)` describe block (lines
800-865) never changes `selectedSlot`/`group` props while a menu is open.

**Fix:** Reset the ref whenever the selected group changes:

```ts
watch(() => props.selectedSlot?.id, () => {
  openMenuEntryId.value = null
})
```

### WR-03: `SlideActionMenu.vue` never moves focus into its own panel on open — Escape (and standard ARIA menu-button semantics) don't work until the user manually tabs past the trigger

**File:** `src/components/slides/SlideActionMenu.vue:2-56, 119-123`

**Issue:** The trigger `<button>` and the `role="menu"` panel `<div>` are DOM **siblings**, not
ancestor/descendant:

```html
<div class="relative" data-testid="slide-action-menu">
  <button ... @click.stop="onTriggerClick">...</button>
  <div v-if="open" class="fixed inset-0 z-10" @click="close" />
  <Transition><div v-if="open" role="menu" @keydown="onPanelKeydown">...</div></Transition>
</div>
```

`onPanelKeydown` is bound to the panel `<div>`'s own `@keydown`, which only receives events that
originate from an element **inside** it. Nothing in this component ever calls `.focus()` on the
panel or its first item when `open` becomes `true` (contrast with `EditSlideDrawer.vue:551-552`,
which does `await nextTick(); panelRef.value?.focus()` on its own open transition). So: a keyboard
user tabs to the trigger and presses Enter/Space — the click handler fires and `open` flips true,
but focus **stays on the trigger button**, which is outside the panel. Pressing Escape at that
moment — the single most natural first action after opening a menu — reaches no listener at all
and does nothing; the menu stays open. Escape only works once the user has tabbed at least once
more, moving focus from the trigger into the panel's first `menuitem` button.

This also means the component doesn't follow the WAI-ARIA menu-button pattern's expectation that
opening a menu moves focus onto it (typically the first item) — a screen-reader user has no
signal that focus is still sitting on the trigger after "activating" the menu.

The component's own doc comment even states the limitation without recognizing it as a bug: "*Escape
closes and returns focus to the trigger... implemented via the panel's own `@keydown.escape`...
so it only fires while the panel actually has focus inside it.*" — true, but nothing ever puts
focus there.

**Test masks the gap:** `SlideActionMenu.test.ts:76-88` verifies Escape by calling
`panel.trigger('keydown', { key: 'Escape' })` directly on the panel wrapper — this dispatches a
synthetic event straight at the listener, bypassing the real DOM focus/bubble path a keyboard user
actually goes through. The test proves the handler function is wired correctly; it does not prove
Escape works from the state a real keyboard user is actually in immediately after opening the
menu.

**Fix:** Focus the panel (or its first `menuitem`) when `open` transitions to `true`:

```ts
const panelRef = ref<HTMLElement | null>(null)
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  panelRef.value?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
})
```

and add a test that dispatches the Enter/Space keydown on the *trigger* (not the panel) and then
asserts `document.activeElement` is inside the panel before separately testing Escape.

### WR-04: The "Discard unsaved changes?" guard is now dead code in `EditSlideDrawer.vue` — `capture()` is called but `isDirty`/`confirmDiscard` are never read

**File:** `src/components/slides/EditSlideDrawer.vue:531-533, 922-930`

**Issue:** 33-VERIFICATION.md already flagged, as a disclosed known gap, that the "Discard unsaved
changes?" prompt that used to guard the removed in-body "Edit in song"/"Edit in scripture" link
buttons was not carried into the new menu-dispatched navigation. This review traced the concrete
mechanism: `useUnsavedGuard`'s own doc comment (`src/composables/useUnsavedGuard.ts:12-21`)
documents its intended usage as calling `confirmDiscard()` from the component's close handler —
and every OTHER consumer in this codebase does exactly that:

```
src/components/AvailabilityDrawer.vue:559:  if (!unsavedGuard.confirmDiscard()) return
src/views/RosterView.vue:529:             if (!unsavedGuard.confirmDiscard()) return
src/components/SongSlideOver.vue:541:     if (!unsavedGuard.confirmDiscard()) return
```

`EditSlideDrawer.vue` is the only consumer that never calls `confirmDiscard()` (or reads
`isDirty`) anywhere — a whole-file grep turns up exactly one use of the returned object,
`unsavedGuard.capture()`:

```ts
const unsavedGuard = useUnsavedGuard(() => ({ label: localLabel.value, notes: localNotes.value, body: localBody.value }))
function captureGuardBaseline(): void { unsavedGuard.capture() }
```

and `onClose()`/`onKeydown()` (lines 531-539) both emit `close` unconditionally, with no
`confirmDiscard()` gate. Since the two navigation handlers that used to call it
(`onEditInSong`/`onEditInScripture`) were deleted outright in 33-09 rather than the guard being
re-wired to the drawer's own close path, `isDirty`/`confirmDiscard` are now fully unreachable dead
exports from this call site — the guard exists in the file only to seed a baseline that nothing
ever checks.

Practically: the data-loss risk is low (an in-flight debounced edit is still flushed
best-effort via `onUnmounted`'s `flushAll()`, and SPA navigation via `router.push` doesn't tear
down the JS runtime, so the write generally still lands) — but the user-facing warning that used
to let someone *choose to stay* and watch the save complete is gone, and there is now dead,
misleading code in this file that looks like a guard is active when it is not.

**Fix:** Either wire `confirmDiscard()` into `onClose`/`onKeydown` (matching the other three
consumers) and/or into the menu-dispatched navigation path in `SlidesTab.vue`'s `onMenuAction`, or
— if the product decision is genuinely "flush-and-go, no prompt" — remove the now-vestigial
`useUnsavedGuard` import/instance from `EditSlideDrawer.vue` entirely so a future reader doesn't
mistake `captureGuardBaseline()` calls for an active guard.

## Info

### IN-01: Background Storage objects are never cleaned up after removal or replacement

**File:** `src/composables/useBackgroundUpload.ts:55-64`

**Issue:** The `orgs/{orgId}/backgrounds/` prefix is deliberately exempt from
`cleanupExpiredMedia`'s 14-day orphan sweep (`MEDIA_PATH_GUARD` only matches `media/`) — the
comment frames this as intentional so an *attached* background is never swept out from under a
live document. But nothing else in this phase deletes the old Storage object when a background is
**removed** (`onRemoveSlideBackground`/`onRemoveGroupBackground`/`onRemoveSongBackground` all only
clear the Firestore field) or **replaced** (attaching a new background never deletes the URL it
overwrote). Combined with the sweep exemption, every removed/replaced background image becomes a
permanently orphaned object in Storage with no code path that will ever delete it — an unbounded,
silent storage cost that grows with usage.

**Fix:** Out of scope to fix within this phase's own review, but worth tracking: either delete the
previous Storage object (best-effort, non-blocking) inside `onRemoveSlideBackground`-style
handlers and the attach path's overwrite case, or add a narrower orphan-sweep rule for
`backgrounds/` that only fires when no Firestore document references the URL (harder, but avoids
the live-document-race the current exemption exists to prevent).

### IN-02: `SlideActionMenu.vue`'s item buttons don't stop click propagation, unlike the trigger

**File:** `src/components/slides/SlideActionMenu.vue:37-52`, `src/components/slides/SlideCard.vue:9`

**Issue:** The trigger button uses `@click.stop` specifically so opening the menu never bubbles
into the card's own `@click="emit('select', ...)"` handler (33-UI-SPEC.md's own stated rationale).
Every menu **item** button, however, has a plain `@click="onItemClick(item)"` with no `.stop` —
so selecting any item (Duplicate, Delete Slide, Edit in song, etc.) still bubbles up through the
panel → the wrapping `absolute` div → the card root, firing the card's own `select` handler a
second time, in addition to the intended `menu-select` emit. `SlidesTab.vue`'s own doc comment
(`:390-393`) treats this as acceptable ("a menu action always implies its card is the one being
acted on" / "harmless no-op if it did," per the 33-UI-SPEC's own reasoning for the trigger), and
functionally it is idempotent here — but it is an inconsistency worth a comment at minimum: the
trigger's `.stop` idiom implies every interactive control inside this menu follows the same
discipline, and a future item type (e.g. one that does something non-idempotent on repeated
selection) would inherit this silently.

**Fix:** Either add `@click.stop` to the item buttons for consistency with the trigger's own
documented idiom, or add a one-line comment at the item-button markup explaining that the bubble
is intentional and known-harmless (so a future reviewer doesn't have to re-derive it).

---

_Reviewed: 2026-08-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
