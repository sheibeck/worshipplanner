---
phase: 142-slides-tab-panel-ux-from-claude-design
reviewed: 2026-09-19T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/components/AudioPlayer.vue
  - src/components/VampPicker.vue
  - src/components/slides/BackgroundControl.vue
  - src/components/slides/SlideGrid.vue
  - src/components/slides/SlideGroupMusicControl.vue
  - src/components/slides/SlideGroupSetupStrip.vue
  - src/components/slides/SlidesTab.vue
  - src/components/slides/SlotVideoOutputControl.vue
  - src/stores/slideGroups.ts
  - src/components/__tests__/AudioPlayer.test.ts
  - src/components/__tests__/VampPicker.test.ts
  - src/components/slides/__tests__/BackgroundControl.test.ts
  - src/components/slides/__tests__/SlideGrid.test.ts
  - src/components/slides/__tests__/SlideGroupMusicControl.test.ts
  - src/components/slides/__tests__/SlideGroupSetupStrip.test.ts
  - src/components/slides/__tests__/SlidesTab.test.ts
  - src/components/slides/__tests__/SlotVideoOutputControl.test.ts
  - src/stores/__tests__/slideGroups.test.ts
  - src/utils/__tests__/slideshowAssembler.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 142: Code Review Report

**Reviewed:** 2026-09-19
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the 142 chip-popover rework (`SlideGroupSetupStrip.vue`), the collapsed one-audio-slot
control (`SlideGroupMusicControl.vue`), the `chip-popover` variant of `BackgroundControl.vue`, the
tiled `SlotVideoOutputControl.vue`, and the `setGroupBedMedia` no-MP3-vamp fix in
`src/stores/slideGroups.ts`, plus their test files.

The store write paths (`setGroupBedMedia`, `setGroupBackground`, `replaceGroupSlides`) are correct
and thoroughly tested: `deleteField()` sentinels are used everywhere a field must actually be
removed (never `undefined`, which `stripUndefined()` would otherwise silently erase before the
write), the four `bedAudioUrl`/`bedVampId` branch combinations in `setGroupBedMedia` are all
covered including the new no-MP3-vamp branch, and every `SlideGrid.vue` write handler that a
child control can trigger re-checks `canWriteGroupMedia`/`canMutateGroup` itself rather than
trusting the template's `v-if` gate alone. The drop-to-upload path in `BackgroundControl.vue`
routes through the same `useBackgroundUpload` composable (and its type/size `validate()`) as the
click-to-upload path, so drag-and-drop gets identical validation. The `recentBackgrounds`
derivation in `SlidesTab.vue` reads only already-subscribed data (`groupsBySlotId`,
`assembledSlideshow`), dedupes by URL, and caps at 4 with no new Firestore reads. No XSS/URL-
injection surface was found in the thumbnail/filename rendering — both `:src` and
`:style="{backgroundImage: ...}"` bindings go through the CSSOM/DOM property setters Vue uses,
not string/HTML interpolation, and text labels are text-interpolated (auto-escaped).

One real gap was found in `SlideGroupSetupStrip.vue`'s popover lifecycle: the popover does not
close when the `editable` prop flips from `true` to `false` while it is open (e.g. another
collaborator locks the service mid-edit) — see WR-01. Two lower-severity notes are also listed
below.

## Warnings

### WR-01: Open popover survives `editable` flipping to `false` mid-session, leaving dead-end interactive controls

**File:** `src/components/slides/SlideGroupSetupStrip.vue:40-90` (popover render), `src/components/slides/SlideGroupSetupStrip.vue:310-323` (openChip watcher)

**Issue:** The popover `<div v-if="openChip === chip.id">` is a sibling of the `v-if="editable" ... v-else` chip toggle, not nested inside it, and the three child controls it mounts are given `:editable="true"` / `is-editor="true"` **hardcoded**, per the comment at lines 71-74 ("the chip's own `editable` gate is the single source of lockedness ... the popover only ever mounts for an editable chip in the first place"). That invariant only holds at the moment the popover is *opened*. There is no `watch(() => props.editable, ...)` (only a watcher on `selectedSlot.id`, lines 331-333) to force-close an already-open popover if `editable` (i.e. `canWriteGroupMedia = isEditor && !serviceLocked` in `SlideGrid.vue`) becomes `false` while it's still open — e.g. a collaborator finalizes/locks the service in another tab while this user has the Audio or Background popover open.

When that happens:
- The chip button itself swaps from `<button>` to an inert `<span>` (per the outer `v-if="editable"`), but the already-open popover keeps rendering with fully-interactive Upload/Replace/Remove/Vamp-pick controls, because those controls never re-read the real `canWriteGroupMedia` — they only ever see the hardcoded `true`.
- Clicking Remove/attach-vamp/Banner-tile now emits up to `SlideGrid.vue`'s handlers (`onRemoveGroupBackground`, `onAttachGroupVamp`, etc.), all of which correctly re-check `canWriteGroupMedia.value` and silently `return` — so no data corruption occurs, but the user gets **zero feedback** that their click did nothing.
- Worse, an in-flight **upload** (Background image or Track file) is not blocked by this stale state at all: `useBackgroundUpload`/`useMediaUpload` only validate file type/size and write to Cloud Storage — they have no `canWriteGroupMedia` awareness. A file picked through the stale popover actually uploads to Storage, and only the follow-up Firestore `attach` write is then dropped by `SlideGrid`'s guard, leaving an **orphaned Storage object** with no document referencing it.
- (Secondary, same root cause) `closeAndRefocus()`'s `chipRefs[id]?.focus()` silently no-ops on Escape once the button has unmounted to a `<span>`, since `setChipRef(id, null)` already deleted the ref — a minor consequence of the same missing close-on-lock behavior, not a separate bug.

This exact "lock flips mid-session while UI is mid-interaction" scenario is already treated as a first-class case elsewhere in this same file's sibling component: `SlideGrid.vue`'s Sortable instance is explicitly torn down and rebuilt when `serviceLocked` flips (tested at `SlideGrid.test.ts:2374`, "destroys the Sortable instance when the service locks and re-creates it on reopen"). No equivalent test exists for the strip's popover — `SlideGroupSetupStrip.test.ts` only exercises `editable: false` at **mount** time (line 231), never a live `false` transition while a popover is open.

**Fix:** Add a watcher mirroring the existing `selectedSlot.id` one, and pass the real `editable` value through instead of hardcoding `true`:
```ts
// SlideGroupSetupStrip.vue
watch(() => props.editable, (editable) => {
  if (!editable) close()
})
```
and thread `:editable="props.editable"` (renaming the child props to match, or keeping the hardcoded value but gating the popover's own `v-if` on `openChip === chip.id && editable` too) so a lock that lands mid-open closes the popover instead of leaving stale controls mounted.

## Info

### IN-01: `SlidesTab.vue`'s `recentBackgrounds` sort reimplements ad-hoc Firestore-timestamp coercion instead of the existing safe helper

**File:** `src/components/slides/SlidesTab.vue:276-278`

**Issue:**
```ts
const aSeconds = (a.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0
const bSeconds = (b.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0
return bSeconds - aSeconds
```
This only handles the `{ seconds }` Firestore-`Timestamp` shape (silently treating any other shape — a plain `Date`, a raw `number`, or a `toMillis()`-bearing object from a differently-hydrated store — as `0`, i.e. "oldest"), and it discards `nanoseconds`, so two backgrounds attached within the same second sort arbitrarily. The codebase already has a hardened version of exactly this coercion, `shareTokenCreatedAtMillis` in `src/utils/shareTokens.ts:35-52`, which handles `toMillis()`, `{seconds, nanoseconds}`, `Date`, and raw `number` shapes, and is documented to "never throw, never return `NaN`". It's scoped/named for `shareTokens` specifically, but the pattern (and the `NaN`-safety it buys) is worth reusing or extracting rather than re-deriving a narrower version here. In production this will work correctly (`updatedAt` really is always a Firestore `Timestamp` off `onSnapshot`), so this is a maintainability/consistency note, not a functional bug.

**Fix:** Either import/generalize `shareTokenCreatedAtMillis` (e.g. rename/export it as a general-purpose `firestoreTimestampMillis` helper) or add the `nanoseconds` term locally for sub-second stability:
```ts
const aMillis = ((a.updatedAt as { seconds?: number; nanoseconds?: number } | undefined)?.seconds ?? 0) * 1000
  + ((a.updatedAt as { nanoseconds?: number } | undefined)?.nanoseconds ?? 0) / 1e6
```

### IN-02: Watcher comment assumes popover transitions always pass through `null`, which is false

**File:** `src/components/slides/SlideGroupSetupStrip.vue:310-323`

**Issue:** The `watch(openChip, ...)` handler's `if (id) { add listeners } else { remove listeners }` shape implicitly assumes each *open* transition is paired with a preceding *close* (`null`) transition, so listeners are added once per open and removed once per close. But `toggle(id)` (lines 264-267) can jump directly from one open chip to a different one without ever passing through `null` — clicking the Background chip while the Audio popover is open sets `openChip.value` straight from `'audio'` to `'background'`, so the watcher's `id` branch runs again and calls `document.addEventListener('pointerdown', onPointerDown)` / `window.addEventListener('keydown', onKeydown)` a second time with the *same* function references, with no matching `removeEventListener` in between. This is harmless in practice only because `addEventListener` is a documented no-op for a duplicate `(type, listener)` pair on the same target — but it means the "added once on open, removed once on close" framing in the code/tests (`SlideGroupSetupStrip.test.ts:393`) isn't quite what happens for a chip-to-chip switch, and the accounting would go wrong if `onPointerDown`/`onKeydown` were ever changed to non-stable references (e.g. inlined closures).

**Fix:** No functional fix required. If tightened, remove-then-add unconditionally inside the truthy branch, or track a local "listeners active" boolean, to make the invariant explicit rather than relying on the browser's de-duplication behavior.

---

_Reviewed: 2026-09-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
