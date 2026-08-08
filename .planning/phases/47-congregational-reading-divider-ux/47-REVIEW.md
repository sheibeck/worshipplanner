---
phase: 47-congregational-reading-divider-ux
reviewed: 2026-08-08T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/components/CongregationalEditor.vue
  - src/utils/scriptureSplitter.ts
  - src/utils/claudeApi.ts
  - src/types/slide.ts
  - src/types/slideGroup.ts
  - src/utils/slideshowAssembler.ts
  - src/components/PresentationViewer.vue
  - src/components/slides/slideDisplay.ts
  - src/components/slides/EditSlideDrawer.vue
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: clean
fixed_at: 2026-08-08T22:00:00Z
fix_report: 47-REVIEW-FIX.md
---

# Phase 47: Code Review Report

**Reviewed:** 2026-08-08
**Depth:** deep
**Files Reviewed:** 9 (listed above; `EditSlideDrawer.vue` included alongside the 8 named in scope since it is one of the plan's own `files_modified`)
**Status:** clean — all 6 findings resolved (1 critical, 3 warning, 2 info). See
[47-REVIEW-FIX.md](./47-REVIEW-FIX.md) for the fix-by-fix detail and commit hashes.

## Summary

The type/schema widen (plan 01), the presenter/grid/drawer 3-way render + R097 reference
gating (plan 03), and the ALL-role plumbing are all correctly and consistently implemented —
`SPLIT_SCHEMA`/`validateSplitResult` are widened together, every binary LEADER/CONGREGATION
ternary in `PresentationViewer.vue`/`slideDisplay.ts`/`EditSlideDrawer.vue` is now a proper
3-way match using literal Tailwind classes, `isFirstSection` is set identically on both
assembler content-resolution paths, and `translationSource` is stamped once and never
re-derived. The divider insert/remove math in `CongregationalEditor.vue` is index-correct
(snapped strictly to `computeBoundaries`, correct speaker inheritance on both operations).

The one real defect is in `CongregationalEditor.vue`'s new async seed handling: nothing
prevents a user from triggering a second seed, a hand-edit, or a re-fetch while an in-flight
"Split with AI" request is still pending, and the AI response handler unconditionally
overwrites the current draft when it resolves — bypassing the very `hasManuallyEdited`
re-seed-confirm guard this phase built specifically to prevent silent data loss. Because
`update:sections` feeds directly into `ServiceEditorView`'s auto-save, this is not just a
transient UI glitch — a stale AI response can silently overwrite a user's own later edits (or
splice mismatched text across a re-fetched passage) in the persisted service document. Two
further warnings and two info items round out the findings below.

## Critical Issues

### CR-01: In-flight "Split with AI" request has no lock, generation check, or button-disable — a late response silently overwrites later edits/seeds and can corrupt data across a re-fetch

**RESOLVED** — commit `f81adf0` (`fix(47): CR-01 guard in-flight AI split against stale-response overwrite`). See [47-REVIEW-FIX.md](./47-REVIEW-FIX.md#cr-01) for detail.

**File:** `src/components/CongregationalEditor.vue:64-96, 490-528, 601-635`

**Issue:**
`applyAiSeed()` (490-513) reads `rawText.value` once before `await splitCongregationalReading(...)`,
but on resolution it maps the result back onto the draft via `alignSegmentsToBoundaries()`
(442-461), which reads `boundaries.value`/`rawText.value` **fresh at that later point in time**,
not the values captured before the `await`. Nothing in the template disables the competing
surfaces while `isSplitting` (or `isFetching`) is true:

- `seed-alternate-btn` (80-87) and `seed-blank-btn` (88-95) carry no `:disabled` tied to
  `isSplitting`/`isFetching` — only `ai-split-btn` (67) does.
- `fetch-btn` (32) is disabled only by its own `isFetching`, not by `isSplitting`.
- Every divider (`insertDivider`/`removeDivider`) and chip (`setSpeaker`) handler is reachable
  at all times, with no guard against a concurrently in-flight AI call.

Concretely reachable sequences:
1. User clicks "Split with AI" (`isSplitting = true`, `hasManuallyEdited` still `false` at the
   time of the click, so no confirm was shown or needed). While the request is in flight, the
   user inserts/removes a divider or picks a different seed (both fully clickable). When the AI
   response later arrives, `applyAiSeed` unconditionally does
   `draft.value = alignSegmentsToBoundaries(...)`, `hasManuallyEdited.value = false`, and
   `emitSections()` — silently discarding the user's intervening edit/seed choice with **no
   confirm dialog**, even though the whole point of `hasManuallyEdited`/`pendingSeed` is to
   never discard hand-edits without asking.
2. Worse: if the user instead re-fetches a *different* passage while the AI call for the
   *previous* passage is still in flight, `onFetchPassage` (601-635) immediately reassigns
   `rawText.value`/`boundaries.value`/`draft.value` to the new passage. When the stale AI
   response then resolves, `alignSegmentsToBoundaries` greedily walks the **new** `boundaries`/
   `rawText` trying to match the **old** passage's section text. Since no match can ever be
   found, the search loop (449-456) simply runs to `end = maxIndex` for the first segment and
   then, for every subsequent segment, computes `end = cursor + 1` with `cursor` already at
   `maxIndex` — producing a `DraftSection` with `startBoundary` one past `boundaries.length - 1`.
   `sliceAtBoundaries` then indexes `boundaries[maxIndex + 1]` (`undefined`), and
   `text.slice(x, undefined)` silently behaves as `text.slice(x)` (slice-to-end) rather than
   throwing — so the corrupted structure is not caught by any runtime check, and
   `emitSections()` still fires.
3. Because `update:sections` feeds `ServiceEditorView.onCongregationalSectionsChange`, which
   writes straight into `localService.value.slots[index]` under the existing `useAutoSave`
   pipeline (`src/views/ServiceEditorView.vue:1604-1619`, "the existing `useAutoSave`... is the
   one persistence path for this write"), this is not merely an in-memory glitch — the
   corrupted/overwritten structure can be auto-saved to Firestore with no user-visible warning.

This directly undermines the phase's own stated goal ("no seed is a dead end... every
edit/re-seed is confirm-gated") for the one seed that is asynchronous.

**Fix:**
Add a generation token (or simply disable every competing control while any async operation is
in flight) and re-validate staleness before applying the AI result:

```typescript
let seedGeneration = 0

async function applyAiSeed(): Promise<void> {
  if (!canAiSplit.value || isSplitting.value) return
  isSplitting.value = true
  const myGeneration = ++seedGeneration
  const textAtRequestTime = rawText.value
  try {
    const result = await splitCongregationalReading(textAtRequestTime)
    // Bail out if a fetch/edit/seed happened while this request was in flight.
    if (myGeneration !== seedGeneration || rawText.value !== textAtRequestTime) {
      toasts.push(AI_SPLIT_FAILURE_TEXT)
      return
    }
    if (result) {
      if (hasManuallyEdited.value) {
        // The user edited while we were waiting — respect the existing
        // re-seed confirm contract instead of silently overwriting.
        pendingAiResult.value = result
        pendingSeed.value = 'ai'
        return
      }
      draft.value = alignSegmentsToBoundaries(result.map((s) => ({ speaker: s.speaker, text: s.text })))
      hasManuallyEdited.value = false
      emitSections()
    } else {
      toasts.push(AI_SPLIT_FAILURE_TEXT)
    }
  } catch {
    toasts.push(AI_SPLIT_FAILURE_TEXT)
  } finally {
    isSplitting.value = false
  }
}
```

and disable the other seed/fetch controls while `isSplitting`/`isFetching` is true:

```html
<button
  type="button"
  data-testid="seed-alternate-btn"
  :disabled="isSplitting || isFetching"
  ...
>
```
```html
<button
  type="button"
  data-testid="fetch-btn"
  :disabled="!canFetch || isFetching || isSplitting"
  ...
>
```

## Warnings

### WR-01: Boundary-alignment can silently mislabel a segment's verse range by swallowing the next verse's marker

**RESOLVED** — commit `25d34ab` (`fix(47): WR-01 stop verse-range from swallowing the next verse's marker`). See [47-REVIEW-FIX.md](./47-REVIEW-FIX.md#wr-01) for detail.

**File:** `src/components/CongregationalEditor.vue:400-461` (interacting with the unchanged
`src/utils/scriptureBoundaries.ts:41-53, 137-142`)

**Issue:** `computeBoundaries` registers a boundary immediately **after** a verse marker (the
start of that verse's own content) via `VERSE_MARKER_PATTERN`, and separately registers a
boundary after clause-ending punctuation (`. ! ? ; :` + whitespace) via `CLAUSE_END_PATTERN`.
When a verse ends with clause-ending punctuation immediately before the next verse's marker,
both boundary sets agree and a segment's end lands cleanly right before the next marker. But
when a verse runs on into the next without such punctuation (extremely common in scripture —
genealogies, lists, continued sentences separated only by commas, which `CLAUSE_END_PATTERN`
deliberately excludes), there is *no* boundary at that exact "end of this verse's words" point.
`alignSegmentsToBoundaries`'s greedy search (442-461) then only finds a match once `end` reaches
the *next* verse's marker-start boundary — meaning the matched slice, before `stripVerseMarkers`
runs, still contains the next verse's own `[N]` marker embedded near its tail.
`congregationalSections`'s computed (403-414) calls `verseRangeForSlice(slice)` on that **raw**
(pre-strip) slice, and `verseRangeForSlice` (`scriptureBoundaries.ts:137-142`) reports **every**
`[N]` marker found in the slice — so a segment that visually and textually contains only verse 1
can display a verse-range label of "1-2" (or similar), because the stripped display text hides
the swallowed marker while the range calculation still sees it.

This is most exposed by two new capabilities this phase introduces: the per-verse "Start Blank"
seed (every verse gets its own segment, so this ambiguity is hit on essentially every verse
boundary in a passage without terminal clause punctuation) and free-hand divider placement
(a user inserting a divider exactly between two run-on verses hits the same ambiguity).
`scriptureBoundaries.ts` itself is unchanged by this phase, but Phase 47 is what newly exercises
this edge at a much higher rate outside the AI path (which previously was the only consumer of
this boundary system, and where the model was told to prefer sentence/verse-aligned splits).

**Fix:** Either (a) prefer the *smallest* legal boundary that produces a byte-exact match when
multiple candidates tie for the same stripped text (not applicable here since the candidates
differ in raw content), or more robustly (b) compute `verseRangeForSlice` against the slice
*after* excluding any trailing embedded marker that belongs to the *next* segment — e.g. derive
verse range from the segment's own `startBoundary`/`endBoundary` position within a
pre-parsed verse-number-per-boundary lookup table, rather than re-scanning raw text for `[N]`
occurrences that can span a foreign verse's own marker.

### WR-02: No detection/telemetry when the boundary-alignment search fails to find an honest match

**RESOLVED** — commit `8535ffc` (`fix(47): WR-02 detect and surface alignSegmentsToBoundaries match failures`). See [47-REVIEW-FIX.md](./47-REVIEW-FIX.md#wr-02) for detail.

**File:** `src/components/CongregationalEditor.vue:442-461`

**Issue:** `alignSegmentsToBoundaries`'s own doc comment states "an exact match always exists;
this loop is a search for WHERE it is, never a repair for when it isn't" — but the code has no
assertion enforcing that invariant. If it is ever violated (see CR-01's stale-passage scenario,
or WR-01's embedded-marker scenario producing an unexpected match position), the loop silently
terminates at `end = maxIndex` and proceeds as if nothing went wrong, producing a degenerate or
out-of-range `DraftSection` with no console warning, no toast, and no test failure signal at
runtime.

**Fix:** After the `while` loop, verify the candidate at the chosen `end` actually equals
`segment.text` before accepting it; if not, log a diagnostic (`console.error` at minimum, matching
this file's other failure paths) and fall back to treating the segment as unsplit/untouched
rather than silently emitting a boundary that does not correspond to the AI/seed's intended text:

```typescript
const candidate = stripVerseMarkers(sliceAtBoundaries(rawText.value, boundaries.value, cursor, end))
if (candidate !== segment.text) {
  console.error('[CongregationalEditor] alignSegmentsToBoundaries: no exact match found', { segment, cursor })
}
```

### WR-03: `insertDivider`/`removeDivider` shift every subsequent segment's `:key="idx"`, defeating Vue's diffing identity for the whole list on every edit

**RESOLVED** — commit `e287398` (`fix(47): WR-03 key the divider/segment v-for on a stable id, not array index`). See [47-REVIEW-FIX.md](./47-REVIEW-FIX.md#wr-03) for detail.

**File:** `src/components/CongregationalEditor.vue:136, 223`

**Issue:** Both the boundary-indexed draft's `<template v-for="(section, idx) in draft" :key="idx">`
and the legacy `mountedSections`'s `v-for="(section, idx) in mountedSections" :key="idx"` key on
the array index. Every `insertDivider`/`removeDivider` call changes `draft`'s length, so every
segment after the edit point is re-keyed to a different index than before — Vue will reconcile
each shifted `idx` as "the same logical node, new content" rather than "a different logical
node," rather than preserving DOM identity for segments that didn't actually move. There is no
functional bug today because segment cards hold no local component state, but this is exactly
the pattern that produces silent, hard-to-diagnose bugs the moment any per-card local state
(focus, an inline edit field, a CSS transition, a Popper/tooltip instance) is added later — and
it already means the browser's focus/scroll position can jump unexpectedly across a divider
insert/remove today.

**Fix:** Key on a value that is stable across a splice, e.g. a composite of the segment's own
boundaries at creation time or a synthesized id minted alongside each `DraftSection`:

```typescript
interface DraftSection {
  id: string // crypto.randomUUID(), minted once per segment, survives across draft ops
  speaker: DraftSpeaker
  startBoundary: number
  endBoundary: number
}
```
and `:key="section.id"` in the template.

## Info

### IN-01: `seed-alternate-btn`/`seed-blank-btn` carry no loading affordance while an unrelated AI request is in flight

**RESOLVED** — fixed as a side effect of commit `f81adf0` (CR-01), which disables and dims both buttons while `isSplitting || isFetching`. No separate commit was needed; see [47-REVIEW-FIX.md](./47-REVIEW-FIX.md#in-01) for detail.

**File:** `src/components/CongregationalEditor.vue:80-95`

**Issue:** While `isSplitting` is true, the two non-AI seed buttons show no visual indication
that another operation is running, even though (per CR-01) clicking them mid-flight is exactly
what triggers the silent-overwrite bug. Fixing CR-01 by disabling these buttons during
`isSplitting` will also resolve this cosmetic gap for free.

**Fix:** Covered by CR-01's fix (disable + optionally dim while `isSplitting || isFetching`).

### IN-02: `congregationalSectionFromRef` (unchanged helper, `src/utils/scripture.ts`) silently drops `translationSource` from its returned `CongregationalSection`, relying on call sites to re-read it off the raw `SourceRef` instead

**RESOLVED** — commit `b8dd29e` (`fix(47): IN-02 thread translationSource through congregationalSectionFromRef`). See [47-REVIEW-FIX.md](./47-REVIEW-FIX.md#in-02) for detail.

**File:** `src/utils/scripture.ts:240-247` (not in this phase's file list, but called by
`src/components/slides/EditSlideDrawer.vue:777-787`, a changed file)

**Issue:** `congregationalSectionFromRef` returns `{ speaker, text, verseRange? }` — it never
copies `ref.translationSource` onto the returned section, even though `SourceRef`'s scripture
variant carries it (`src/types/slideGroup.ts:167`). Today's only two consumers happen to be
safe: `slideshowAssembler.ts` re-reads `ref.translationSource` directly rather than through the
returned section, and `EditSlideDrawer.vue`'s `onSpeakerToggle` spreads the *entire* `sourceRef`
(preserving `translationSource` as a sibling field) rather than reconstructing it from the
helper's return value. This is not a live bug today, but it is a footgun: any future consumer
that treats `congregationalSectionFromRef`'s return value as a complete `CongregationalSection`
(as its name implies) will silently lose translation provenance.

**Fix:** Thread `translationSource` through the helper for defense-in-depth, even though no
current caller is affected:
```typescript
export function congregationalSectionFromRef(ref: SourceRef): CongregationalSection | null {
  if (ref.kind !== 'scripture' || ref.speaker === undefined) return null
  return {
    speaker: ref.speaker,
    text: ref.text ?? '',
    ...(ref.verseRange !== undefined ? { verseRange: ref.verseRange } : {}),
    ...(ref.translationSource !== undefined ? { translationSource: ref.translationSource } : {}),
  }
}
```

---

_Reviewed: 2026-08-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
