---
phase: 35-presentation-correctness-lyric-editor
reviewed: 2026-08-03T10:59:42Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/components/PresentationViewer.vue
  - src/components/slides/SlidesTab.vue
  - src/views/ServiceEditorView.vue
  - src/components/LyricPasteRegion.vue
  - src/components/SongLyricEditor.vue
  - src/components/__tests__/PresentationViewer.test.ts
  - src/components/slides/__tests__/SlidesTab.test.ts
  - src/components/__tests__/LyricPasteRegion.test.ts
  - src/components/__tests__/SongLyricEditor.test.ts
  - src/utils/__tests__/slideshowAssembler.test.ts
  - src/utils/__tests__/slideGroupMaterializer.test.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: findings
---

# Phase 35: Code Review Report

**Reviewed:** 2026-08-03T10:59:42Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** findings

## Summary

Reviewed the R059/R060/R061 presentation-correctness changes and the R065/R066 inline
lyric-paste region. The five requirements are implemented as specified in
35-UI-SPEC.md, and the production diff for R060 is genuinely empty (verified directly
with `git diff 995ead4..HEAD`) — that requirement really was closed by tests alone, not
silently re-emitted.

**R061 index mapping (the ★ focus item):** traced the full path —
`SlidesTab.presentStartIndex`'s three-rung fallback ladder never lets a `findIndex` miss
(`-1`) escape into `PresentationViewer`'s clamp (every branch is guarded with `>= 0`
before returning, and the final rung is a literal `0`); `PresentationViewer`'s
`currentIndex` seed and the pre-existing length-change `watch()` use the identical
clamp formula, and the watch does not fire on mount (no `immediate: true`), so it cannot
stomp the seed at mount time. In production, `PresentationViewer` is mounted fresh each
time via `v-if="presenting"` with `presentStartIndex` already assigned to the *same*
`assembledSlideshow` array reference `SlidesTab` computed it against — so there is no
window where the seed and the mounted `slides` prop can disagree. No defect found here.

**P-02 completability (the ★ focus item):** confirmed no dead end exists — zero
sections detected leaves `Cancel`/`‹ Back` reachable (unsaved-guard only fires when
`rawText.trim()` is non-empty, and it's empty in the zero-sections-but-user-typed-only-
whitespace case too); a rejected `saveLyrics` leaves `rawText` and the checked override
intact and surfaces `paste-save-error`, with `isSaving` reset so retry is possible; the
back-link and Cancel share the identical guard function (`onCancel`). No defect found.

**Multi-root component (the ★ focus item):** `LyricPasteRegion.vue`'s two sibling roots
receive no fallthrough attributes at the one call site that mounts it, so no dev-mode
warning fires today; flagged below as a latent-brittleness Info item rather than a bug.
The `v-if`/`v-else` swap in `SongLyricEditor.vue` is a true mount/unmount (not `v-show`),
confirmed by reading the template directly, so the reopen-reset behavior (E6) is real.

**Deletion cleanliness:** `LyricPasteDialog.vue` and its test are gone with zero
remaining references anywhere in `src/` (confirmed by direct grep, not by re-trusting
the SUMMARY/VERIFICATION claim).

**R059 deletion:** clean — no dangling wrapper, no empty conditional, no orphaned import
in `PresentationViewer.vue`'s lyric branch.

One real finding surfaced under the "tests passing for the wrong reason" focus item (see
WR-01) — a weak assertion in the R060 backstop test that doesn't actually test what its
own comment claims. Everything else below is Info-level.

## Warnings

### WR-01: `slideshowAssembler.test.ts`'s "no literal undefined" assertion doesn't test what it claims

**File:** `src/utils/__tests__/slideshowAssembler.test.ts:347-378`
**Issue:** The test `'an empty copyright object still produces both bracket slides, with
no field rendering the literal undefined'` asserts:
```ts
expect(copyright.title).not.toBe('undefined')
expect(copyright.ccliSongNumber).not.toBe('undefined')
...
```
`.not.toBe('undefined')` compares against the *string* `'undefined'`. If any of these
fields were ever the actual JavaScript value `undefined` (not the empty string the
fixture sets them to), this assertion still **passes** — `Object.is(undefined,
'undefined')` is `false`, so `.not.toBe('undefined')` is trivially satisfied by a real
`undefined`. The test's own docstring claims to guard against "no field rendering the
literal undefined," which is exactly the class of bug this assertion cannot catch: a
genuinely-undefined field reaching the template would render as empty text in Vue (safe)
or, if ever coerced through string interpolation elsewhere (e.g. `` `${x}` ``), would
produce the *string* `"undefined"` — but only the latter path is covered here. Given
`CopyrightInfo`'s fields are typed as required `string`/`string[]` at compile time, the
underlying production code is not currently exposed to this gap, but the test provides
no runtime protection if a malformed Firestore document (loaded through a lenient
`as SongLyrics` cast, as Firestore reads commonly are) ever surfaced `undefined` for one
of these fields.
**Fix:** Assert against the actual value, not a stringified guess:
```ts
expect(copyright.title).toBeDefined()
expect(copyright.title).not.toBeUndefined()
expect(typeof copyright.title).toBe('string')
```
or more directly, assert the empty-string identity the fixture actually sets
(`expect(copyright.title).toBe('')`), which both proves the field resolved and that no
stray `undefined`/`"undefined"` leaked in.

## Info

### IN-01: `LyricPasteRegion.vue`'s `pasteTextareaRef` is bound but never used

**File:** `src/components/LyricPasteRegion.vue:23,138`
**Issue:** `pasteTextareaRef` is declared (`ref<HTMLTextAreaElement | null>(null)`) and
attached to the textarea via `ref="pasteTextareaRef"`, but nothing in the component ever
reads it — no `.focus()` on mount, no imperative access anywhere. This is dead
plumbing (it existed, equally unused, on the deleted `LyricPasteDialog.vue`'s
`textareaRef`, so it's carried forward rather than newly introduced, but it is still new
code in this file). Left in place it reads as if autofocus was intended but never wired
up.
**Fix:** Either remove the unused ref, or wire the plausible intended behavior:
```ts
import { onMounted } from 'vue'
onMounted(() => pasteTextareaRef.value?.focus())
```

### IN-02: `LyricPasteRegion.vue`'s multi-root shape silently drops any future fallthrough attribute

**File:** `src/components/LyricPasteRegion.vue:1-13` (root `lyrics-paste-header` div) and
`:15` (root `paste-region` div)
**Issue:** The component has two sibling root elements, so Vue 3 disables automatic
`$attrs` inheritance for it. Today's sole call site
(`src/components/SongLyricEditor.vue:257-264`) passes only declared props/events, so
nothing is silently dropped and no dev-mode warning fires. But this is incidental, not
declared: nothing in the component documents that fallthrough is unsupported, and the
first future caller that adds a `class`, `id`, or `data-*` attribute at the call site
will get a runtime "extraneous non-props attributes ... could not be automatically
inherited" warning with the attribute applied nowhere, rather than a compile-time signal.
**Fix:** Add an explicit `defineOptions({ inheritAttrs: false })` (documents the
intent even though it's already Vue's default for multi-root components) and/or a
comment noting which root, if any, a future caller should target via `v-bind="$attrs"`.

### IN-03: No integration-level test exercises the full `SlidesTab → ServiceEditorView → PresentationViewer` start-index wire

**File:** `src/views/ServiceEditorView.vue:1704-1706`
**Issue:** `onPresent(startIndex)` assigns `presentStartIndex.value` before flipping
`presenting.value = true` — order matters (a comment at `:1697-1699` says so
explicitly) so `PresentationViewer` never mounts with a stale index. This ordering is
verified today only by direct source reading (per 35-VERIFICATION.md) and by two
separate unit suites that each test one half of the chain
(`SlidesTab.test.ts` proves the emitted payload; `PresentationViewer.test.ts` proves the
prop is consumed correctly) — no test mounts `ServiceEditorView` itself and asserts the
assignment-then-flip ordering survives a future refactor (e.g., someone reordering the
two lines, or changing `onPresent` to an `async` function that awaits between them).
**Fix:** Optional — a small `ServiceEditorView.test.ts` case that spies on `SlidesTab`'s
`present` emit and asserts `PresentationViewer`'s `initial-index` prop equals the
emitted payload on the very first render after the click would close this gap. Not
blocking; the two halves are each solidly tested and the glue is two lines of
straightforward, comment-guarded code.

---

_Reviewed: 2026-08-03T10:59:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
