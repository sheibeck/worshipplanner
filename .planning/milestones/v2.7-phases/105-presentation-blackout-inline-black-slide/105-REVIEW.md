---
phase: 105-presentation-blackout-inline-black-slide
reviewed: 2026-09-01T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/types/slide.ts
  - src/types/songLyrics.ts
  - src/utils/songSectionOrder.ts
  - src/utils/slideshowAssembler.ts
  - src/components/slides/slideDisplay.ts
  - src/components/slides/SlideCanvas.vue
  - src/components/SongLyricEditor.vue
  - src/components/slides/SlideCard.vue
  - src/views/ConfidenceOutputView.vue
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: fixed
---

# Phase 105: Code Review Report

**Reviewed:** 2026-09-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the blackout/inline-black-slide data model (`slide.ts`, `songLyrics.ts`), the numbering-integrity
helpers (`songSectionOrder.ts`), the assembler (`slideshowAssembler.ts`), the display-label helpers
(`slideDisplay.ts`), and the four consuming surfaces (`SlideCanvas.vue`, `SongLyricEditor.vue`,
`SlideCard.vue`, `ConfidenceOutputView.vue`).

R304 (numbering integrity) and R305 (Confidence-monitor blackout suppression) are implemented correctly
and are well covered by tests — `buildSectionRows` excludes a blackout row from per-kind numbering at the
right point, `addSection('BLACKOUT')` reuses the existing collision guard byte-for-byte, and
`ConfidenceOutputView.vue`'s removal of the runtime-blackout overlay is clean, isolated, and leaves the
audience-only wire protocol untouched.

R303 ("no background image... anywhere," 105-UI-SPEC.md) has a real gap: on the stored-group assembly
path, a blackout slide can still be assigned `backgroundImageUrl`/`backgroundSource` from the normal
slide→group→song cascade, contradicting both the UI-SPEC and the `BlackoutSlide` type's own doc comment
that claims this never happens. `SlideCanvas.vue` correctly forces the field to `null` at render time, so
the audience/confidence/preview render surfaces are unaffected — but `SlideCard.vue`'s read-only grid card
(one of the four surfaces this phase explicitly targets) reads `backgroundSource` directly and will show a
"From group"/"From song"/"Background" provenance chip on a blackout card whenever its owning group or song
has a background configured, which is common (many songs carry a song-level background). See CR-01.

Two secondary findings: a newly-added blackout branch in `resolveEntryContent` is unreachable dead code
whose accompanying test does not actually exercise it (WR-01), and `SongLyricEditor.vue`'s dirty-check
never compares `section.kind`, a latent gap in the equality check that happens to be unreachable via
today's UI (WR-02).

## Critical Issues

### CR-01: Blackout slides can still carry a resolved background image/provenance on the stored-group assembler path, leaking a background chip onto the Slides-tab card

**File:** `src/utils/slideshowAssembler.ts:449-457`
**Issue:**
`emitFromGroup` unconditionally spreads `media.backgroundImageUrl`/`media.backgroundSource` onto every
emitted slide, including a blackout one:

```ts
const slide = {
  ...content,
  id: slideId,
  position: globalPosition,
  ...(media.audioUrl ? { audioUrl: media.audioUrl } : {}),
  ...(media.audioLoop ? { audioLoop: true } : {}),
  ...(media.backgroundImageUrl ? { backgroundImageUrl: media.backgroundImageUrl } : {}),
  ...(media.backgroundSource ? { backgroundSource: media.backgroundSource } : {}),
} as Slide
```

`media` comes from `resolveEntryMedia(group, entry, song)` (line 444), which special-cases only
`entry.sourceRef.kind === 'video'` for suppression (line 350) — it has no knowledge that the underlying
`LyricSection` is `kind: 'blackout'` (that check happens one level up, in the caller at lines 546-550, and
is never passed down). So when a blackout `LyricSection` lives inside a `SONG` group whose group or song
has a background image configured (a common case — `SongLyricEditor.vue`'s own "song background" row
makes this trivial to set), the emitted `AssembledSlide` for the blackout slide carries a real
`backgroundImageUrl`/`backgroundSource`.

This directly contradicts:
- `src/types/slide.ts:208-213`'s `BlackoutSlide` doc comment: *"the assembler never populates
  `backgroundImageUrl`/`backgroundSource` for one"* — false on this path.
- `105-UI-SPEC.md`'s R303 content contract (line 181): *"Full solid black... no background image... no
  organizational label."*

The visible symptom is in **`src/components/slides/SlideCard.vue:158-163`**, which reads
`backgroundSource` straight off the assembled slide with no blackout guard:

```vue
<span
  v-if="backgroundSource"
  ...
  data-testid="slide-card-background-chip"
>{{ backgroundSource === 'slide' ? 'Background' : backgroundSource === 'group' ? 'From group' : 'From song' }}</span>
```

A blackout card in the read-only Slides-tab grid — one of the four render/preview surfaces this phase
explicitly targets (105-UI-SPEC.md's own "Slides tab read-only grid card" section, which specifies only a
`bg-black` pane + `BLACKOUT`/`Solid black`/`Black Slide` labels, with no mention of a background chip) —
will show a "From group" or "From song" chip on a slide that is supposed to carry no background at all.
The same pollution is visible to any other out-of-scope consumer that reads `slide.backgroundImageUrl`
directly (e.g. `EditSlideDrawer.vue:711` `resolvedBackgroundUrl`), so a planner editing a blackout slide's
details would see a background-image preview/removal control for a slide that is defined to have none.

`SlideCanvas.vue` (the actual audience/confidence/preview render surface) is unaffected — its
`currentBackgroundUrl` computed checks `contentKind === 'blackout'` first (line 374) and forces `null`
regardless — so this bug is invisible on the projector, but it IS visible in the app's own management UI,
and it falsifies the type's documented invariant.

No test caught this: `slideshowAssembler.test.ts`'s blackout `describe` block (lines 1594-1812) never sets
`group.backgroundImageUrl`/`song.backgroundImageUrl` on a blackout fixture, and `SlideCard.test.ts`'s
blackout block never combines a blackout slide with a `backgroundSource`.

**Fix:** suppress background for a blackout content kind the same way `emitFromGroup` already special-cases
audio precedence for video, e.g.:

```ts
const slide = {
  ...content,
  id: slideId,
  position: globalPosition,
  ...(media.audioUrl ? { audioUrl: media.audioUrl } : {}),
  ...(media.audioLoop ? { audioLoop: true } : {}),
  ...(content.contentKind !== 'blackout' && media.backgroundImageUrl
    ? { backgroundImageUrl: media.backgroundImageUrl }
    : {}),
  ...(content.contentKind !== 'blackout' && media.backgroundSource
    ? { backgroundSource: media.backgroundSource }
    : {}),
} as Slide
```

Add a regression test asserting a blackout `AssembledSlide` carries no `backgroundImageUrl`/
`backgroundSource` even when the owning group/song has one configured, and add a `SlideCard.test.ts` case
asserting the background chip never renders for a blackout card regardless of `backgroundSource`.

## Warnings

### WR-01: `resolveEntryContent`'s blackout branch is unreachable dead code; its test doesn't exercise it

**File:** `src/utils/slideshowAssembler.ts:184-189`
**Issue:** The blackout branch added to `resolveEntryContent`'s `case 'lyric':`:

```ts
case 'lyric': {
  const lyrics = inputs.songLyricsById.get(ref.songId)
  if (!lyrics) return undefined
  const section = lyrics.sections.find((s) => s.id === ref.sectionId)
  if (!section) return undefined
  if (section.kind === 'blackout') {
    const blackoutContent: Omit<BlackoutSlide, 'id' | 'position'> = { contentKind: 'blackout' }
    return blackoutContent
  }
  ...
```

`resolveEntryContent` is a private (unexported) function called from exactly one place —
`assembleSlideshow`'s entry loop, line 566 — and that call only happens for entries whose
`entry.sourceRef.kind !== 'lyric'` (every `'lyric'`-kind entry is fully handled and `continue`s at lines
537-565, *before* line 566 is ever reached). So `resolveEntryContent`'s own `case 'lyric':` branch,
including the new blackout arm, can never execute via `assembleSlideshow` — this was already true before
Phase 105 (the pre-existing non-blackout lyric branch inside `resolveEntryContent` was dead for the same
reason, per the Phase 53/R117 comment at line 535), and this phase added more dead code to it.

`slideshowAssembler.test.ts:1606-1627`'s `describe('resolveEntryContent (lyric case)', ...)` block calls
`assembleSlideshow` end-to-end and asserts `result[0]!.slide.contentKind === 'blackout'` — which passes,
but via the loop's own inline blackout handling (lines 546-550), not via `resolveEntryContent`. The test
name and 105-01-SUMMARY.md's claim of "3 lyric-resolution call sites" (`resolveEntryContent`'s lyric case,
the stored-group loop, the no-group fallback loop) overstate coverage: only 2 of those 3 are live code
paths.

**Fix:** Either delete the now-doubly-dead blackout arm (and the surrounding dead `case 'lyric':` branch)
from `resolveEntryContent` since the loop already owns lyric resolution, or — if it's being kept
deliberately as a defensive/future-proofing measure per the line-535 comment — rename the misleading test
`describe` block (e.g. `'blackout via the stored-group entry loop (not resolveEntryContent)'`) so a future
reader doesn't rely on it as proof that `resolveEntryContent`'s lyric case is exercised.

### WR-02: `SongLyricEditor.vue`'s `isDirty` never compares `section.kind`

**File:** `src/components/SongLyricEditor.vue:510-539`
**Issue:** The `isDirty` computed walks each section comparing `id`, `label`, `lines` (length + per-element),
and `slideBreaks`, but never compares `kind`:

```ts
if (a.id !== b.id || a.label !== b.label) return true
if (a.lines.length !== b.lines.length) return true
for (let j = 0; j < a.lines.length; j++) {
  if (a.lines[j] !== b.lines[j]) return true
}
// ... slideBreaks compared here, kind never compared
```

Today this is unreachable: the only way a section's `kind` is ever set is at mint time inside
`addSection('BLACKOUT')`, which always mints a brand-new id, so an id/label match between `cur` and
`editableState` currently implies a `kind` match too. But the omission is a real gap in an otherwise
field-by-field equality check that already goes out of its way to catch `slideBreaks`-only changes (the
R117 comment right above it). If a future change ever mutates `kind` on an existing section in place (e.g.
a "convert this row to a black slide" affordance, or a repair path), this dirty-check would silently treat
the document as clean and the change would never reach `doAutoSave`.

**Fix:** Add the comparison alongside the existing field checks:

```ts
if (a.id !== b.id || a.label !== b.label || (a.kind ?? 'lyric') !== (b.kind ?? 'lyric')) return true
```

---

## Fix Log (2026-09-01)

All 3 findings fixed. One commit per finding — none shared touched lines.

### CR-01: Blackout slides could still carry a resolved background image/provenance on the stored-group assembler path — **fixed**

**Files:** `src/utils/slideshowAssembler.ts`, `src/utils/__tests__/slideshowAssembler.test.ts`
**Commit:** `f2c2d228`
**Approach:** Applied the review's suggested fix as written — gated both
`backgroundImageUrl`/`backgroundSource` spreads in `emitFromGroup` on
`content.contentKind !== 'blackout'`, since `resolveEntryMedia` only knows
about `'video'` suppression and has no view of the resolved content kind.
Added a regression test (`'never carries backgroundImageUrl/backgroundSource
even when the group AND song both have one configured'`) proving a blackout
`AssembledSlide` has neither field set even when both tiers have a background
configured. `SlideCard.test.ts` (43 tests) reverified passing — no changes
needed there since the chip's precondition (`backgroundSource` truthy) can no
longer be met for a blackout slide.

### WR-01: `resolveEntryContent`'s blackout branch was unreachable dead code; its test didn't exercise it — **fixed**

**Files:** `src/utils/slideshowAssembler.ts`, `src/utils/__tests__/slideshowAssembler.test.ts`, `.planning/phases/105-presentation-blackout-inline-black-slide/105-01-SUMMARY.md`
**Commit:** `8fa3a7e6`
**Approach:** Took the review's first option — deleted the dead blackout arm
from `resolveEntryContent`'s `case 'lyric':` (the whole branch stays
unreachable from `assembleSlideshow` for pre-existing reasons unrelated to
this phase; left a comment pointing at the loop's own inline handling).
Renamed the misleadingly-named
`describe('resolveEntryContent (lyric case)', ...)` block to
`describe('blackout via the stored-group entry loop (not resolveEntryContent)',
...)` with a comment explaining what it actually exercises. Corrected the "3
lyric-resolution call sites" / "all three lyric-resolution sites" overstatement
in `105-01-SUMMARY.md` (provides list, tech-stack patterns, patterns-established,
Accomplishments, Files Modified, and Decisions Made sections) to the accurate
reachable count of 2 (stored-group entry loop, no-group fallback loop), with
inline correction notes citing this review rather than silently rewriting history.

### WR-02: `SongLyricEditor.vue`'s `isDirty` never compared `section.kind` — **fixed**

**File:** `src/components/SongLyricEditor.vue`
**Commit:** `5faecddd`
**Approach:** Applied the review's suggested fix verbatim — added
`(a.kind ?? 'lyric') !== (b.kind ?? 'lyric')` to the existing id/label
equality check in `isDirty`'s per-section walk, with a comment explaining why
this is currently unreachable via today's UI but matters for future in-place
`kind` mutations.

### Verification

`npm run type-check` (`vue-tsc --build`, typechecks tests) clean after all
three commits. Scoped tests
(`npx vitest run src/utils/__tests__/slideshowAssembler.test.ts
src/components/__tests__/SongLyricEditor.test.ts
src/components/slides/__tests__/SlideCard.test.ts`) — 244 tests, 3 files, all
passing. `src/storage.rules.test.ts` and the stale duplicate
`src/stores/appConfig.test.ts` are pre-existing baselines, not touched by
this pass.

---

_Reviewed: 2026-09-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-09-01_
_Fixer: Claude (gsd-code-fixer)_
