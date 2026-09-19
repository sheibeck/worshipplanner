---
phase: 142-slides-tab-panel-ux-from-claude-design
reviewed: 2026-09-19T03:10:00Z
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
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 142: Code Review Report

**Reviewed:** 2026-09-19
**Depth:** standard
**Files Reviewed:** 18
**Status:** clean

## Summary

Re-review (--auto iteration 2 of 3). Since the prior review (`142-REVIEW.iter2.md`), only
`src/components/slides/SlideGroupSetupStrip.vue` and its test file changed (commit `38adec2e`),
fixing WR-01 (open popover surviving `editable` flipping to `false` mid-session). All other files
in scope are byte-identical to what iteration 1 reviewed and found sound.

**WR-01 fix verified correct and complete:**
- The popover's `v-if` is now `openChip === chip.id && editable` (line 41), so it unmounts
  immediately when `editable` goes false, independent of the new watcher.
- A new `watch(() => props.editable, (editable) => { if (!editable) close() })` (lines 339-341)
  sets `openChip.value = null` the moment the prop flips. This routes through the existing
  `watch(openChip, ...)` handler's `else` branch (lines 319-322), which unconditionally calls
  `document.removeEventListener('pointerdown', ...)` / `window.removeEventListener('keydown', ...)`
  — so listeners are drained on the forced close exactly as they are on a normal close, with no new
  leak. `removeEventListener` is a safe no-op if the listener was already absent, so there is no
  double-removal hazard even given the redundant `v-if` + watcher paths both tearing the popover
  down on the same tick.
- No new focus regression: the `editable` watcher calls `close()`, not `closeAndRefocus()`, so it
  never attempts `chipRefs[id]?.focus()` against a chip that has already unmounted to an inert
  `<span>` — the exact no-op the prior review flagged as a secondary symptom of the same root
  cause. When a focused popover control is removed from the DOM mid-interaction, focus falls back
  to `<body>` per standard browser behavior, which is acceptable for an externally-triggered lock
  (no worse than `SlideGrid.vue`'s own Sortable teardown on `serviceLocked`, which similarly does
  not attempt to restore focus).
- New regression test `SlideGroupSetupStrip.test.ts` ("editable flipping to false while a popover
  is open closes it and removes its listeners (WR-01)") mounts with the Audio popover open, flips
  `editable` to `false` via `setProps`, and asserts both that the popover unmounts and that
  `document.removeEventListener('pointerdown', ...)` / `window.removeEventListener('keydown', ...)`
  are each called exactly once. Ran `SlideGroupSetupStrip.test.ts` and `SlideGrid.test.ts` directly:
  both green (175/175 tests across the 2 files). `npm run type-check` (the CLAUDE.md-mandated
  `vue-tsc --build` gate, not the narrower `-p tsconfig.app.json` form) also passed clean.

No new Critical or Warning findings surfaced on the full-scope re-scan. The two Info items from
the prior review are unchanged (neither touches the fixed file) and are retained below for
continuity; they do not affect `status`.

## Info

### IN-01: `SlidesTab.vue`'s `recentBackgrounds` sort reimplements ad-hoc Firestore-timestamp coercion instead of the existing safe helper

**File:** `src/components/slides/SlidesTab.vue:276-278`

**Issue:**
```ts
const aSeconds = (a.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0
const bSeconds = (b.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0
return bSeconds - aSeconds
```
This only handles the `{ seconds }` Firestore-`Timestamp` shape (silently treating any other shape
— a plain `Date`, a raw `number`, or a `toMillis()`-bearing object from a differently-hydrated
store — as `0`, i.e. "oldest"), and it discards `nanoseconds`, so two backgrounds attached within
the same second sort arbitrarily. The codebase already has a hardened version of exactly this
coercion, `shareTokenCreatedAtMillis` in `src/utils/shareTokens.ts:35-52`, which handles
`toMillis()`, `{seconds, nanoseconds}`, `Date`, and raw `number` shapes, and is documented to
"never throw, never return `NaN`". It's scoped/named for `shareTokens` specifically, but the
pattern (and the `NaN`-safety it buys) is worth reusing or extracting rather than re-deriving a
narrower version here. In production this will work correctly (`updatedAt` really is always a
Firestore `Timestamp` off `onSnapshot`), so this is a maintainability/consistency note, not a
functional bug.

**Fix:** Either import/generalize `shareTokenCreatedAtMillis` (e.g. rename/export it as a
general-purpose `firestoreTimestampMillis` helper) or add the `nanoseconds` term locally for
sub-second stability:
```ts
const aMillis = ((a.updatedAt as { seconds?: number; nanoseconds?: number } | undefined)?.seconds ?? 0) * 1000
  + ((a.updatedAt as { nanoseconds?: number } | undefined)?.nanoseconds ?? 0) / 1e6
```

### IN-02: Watcher comment assumes popover transitions always pass through `null`, which is false

**File:** `src/components/slides/SlideGroupSetupStrip.vue:310-323`

**Issue:** The `watch(openChip, ...)` handler's `if (id) { add listeners } else { remove listeners }`
shape implicitly assumes each *open* transition is paired with a preceding *close* (`null`)
transition, so listeners are added once per open and removed once per close. But `toggle(id)`
(lines 264-267) can jump directly from one open chip to a different one without ever passing
through `null` — clicking the Background chip while the Audio popover is open sets
`openChip.value` straight from `'audio'` to `'background'`, so the watcher's `id` branch runs
again and calls `document.addEventListener('pointerdown', onPointerDown)` /
`window.addEventListener('keydown', onKeydown)` a second time with the *same* function references,
with no matching `removeEventListener` in between. This is harmless in practice only because
`addEventListener` is a documented no-op for a duplicate `(type, listener)` pair on the same
target — but it means the "added once on open, removed once on close" framing in the code/tests
isn't quite what happens for a chip-to-chip switch, and the accounting would go wrong if
`onPointerDown`/`onKeydown` were ever changed to non-stable references (e.g. inlined closures).
Unaffected by the WR-01 fix (which only adds a third, `editable`-driven path into the existing
`close()` → `openChip = null` → watcher-`else` teardown, not a new add path).

**Fix:** No functional fix required. If tightened, remove-then-add unconditionally inside the
truthy branch, or track a local "listeners active" boolean, to make the invariant explicit rather
than relying on the browser's de-duplication behavior.

---

_Reviewed: 2026-09-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
