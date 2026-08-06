# Phase 35: Presentation Correctness & Lyric Editor - Research

**Researched:** 2026-08-03
**Domain:** Vue 3 SPA presentation rendering, slide-group assembly engine, inline form conversion
**Confidence:** HIGH

## Summary

This phase is five requirements across two unrelated clusters, and the research below finds that
**three of the five (R059, R060, R061) require no new business logic at all** — R059 is a one-block
deletion, R060 is (exhaustively, not just plausibly) already satisfied on both assembly paths and
needs a regression test, and R061 needs a start-index computed in `SlidesTab.vue` and threaded through
one new prop. R065/R066 are the real construction work, fully specified by 35-UI-SPEC.md, and the
remaining risk there is procedural: losing tested parsing/save coverage during the modal→inline move.

**R060, verified exhaustively (not just spot-checked):** every group-construction path this codebase has —
fresh materialization (`deriveGroupEntries`), the song-identity-swap branch of `rebuildSongGroup`, and its
additive-merge branch — unconditionally produces exactly two copyright entries bracketing a song's lyric
slides, regardless of `performanceOrder` length (including zero), regardless of how many copyright entries
are already stored (0, 1, 2, or corrupted 3+), and regardless of whether the song's `copyright` object is
populated. The additive-merge branch actively **self-heals**: any stray middle copyright entry beyond the
first and last is silently dropped on the next rebuild, converging back to exactly two. The one theoretical
gap found — `ensureGroupMaterialized`'s deliberate zero-slide bypass, which *could* create a group with zero
copyright entries — is proven **unreachable for SONG slots today** because every SlideGrid write path that
calls it is gated behind `canMutateGroup`, which explicitly excludes song groups (R054). This is recorded
as a pitfall to guard against regressing, not a defect to fix.

**R061's real work is the (group, slide) → flat-deck-index mapping**, not the UI. `SlidesTab.vue` already
holds `selectedSlotId`/`selectedSlideId`; the `assembledSlideshow` array it already receives as a prop is
already in the correct flat, position-sorted order — the mapping is a `findIndex` by slide id, with a
two-level fallback (group's first slide, then index 0) for a stale/missing selection.

**R059's blast radius is confirmed to be exactly one line.** No print, share, or PC-export surface renders
slide content at all (`ServicePrintLayout.vue` and `ShareView.vue` have zero references to slides); the
Slides-tab grid's own label helpers (`slideDisplay.ts:95,143`) are an editing/organizing surface, not a
"presenting or previewing" one, and are correctly out of R059's scope.

**Primary recommendation:** implement R059 (delete) and R065/R066 (build per 35-UI-SPEC.md verbatim) as
real code changes; implement R060 and R061 as, respectively, a regression test and a small threading change
— do not write new copyright-emission code for R060, it would triple-emit.

## Architectural Responsibility Map

This app is a Firebase-backed Vue 3 SPA with no server-rendering tier and no separate backend API layer —
Firestore is written to directly from the client, gated by security rules. The conventional
Browser/Frontend-Server/API/CDN/Database tiers don't map cleanly; the table below uses this app's actual
tiers: **Client — Component** (Vue template/render logic), **Client — Business Logic** (pure functions in
`src/utils/`, no reactivity, no I/O), and **Database — Firestore** (the persisted `SlideGroup` documents).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| R059 — suppress `sectionLabel` on lyric slides | Client — Component | — | Pure template deletion in `PresentationViewer.vue`; no data model or business-logic change (the field stays, per 35-CONTEXT.md) |
| R060 — copyright bracket on every song group | Client — Business Logic | Database — Firestore | The bracket is produced by `deriveGroupEntries`/`rebuildSongGroup` (pure functions) and then persisted as `SlideGroup.slides`; `slideshowAssembler.ts`'s fallback path produces the same bracket for not-yet-materialized groups with no persistence at all |
| R061 — present starts at the highlighted slide/group | Client — Component | — | The mapping (selection → flat deck index) is a pure computed in `SlidesTab.vue`; no store or Firestore involvement |
| R065 — missing-copyright warning + override gate | Client — Component | Client — Business Logic | The gate condition (`canConfirm`) is component state; the copyright detection it reads (`parsed.copyright.ccliSongNumber`) comes from the pure `parseCCLIPaste` function, unchanged |
| R066 — paste is inline, not modal | Client — Component | — | Presentation/host-chrome change only; the parsing and save call paths it wraps are unchanged pure/Firestore-write functions |

## Standard Stack

No new dependencies. This phase changes existing Vue 3 components and pure TypeScript utilities only.

### Core (already installed, unchanged versions)

| Library | Version (verified via `package.json`) | Purpose | Why Standard |
|---------|------|---------|--------------|
| vue | ^3.5.29 | Component framework | Existing stack |
| vitest | ^4.0.18 | Test runner | Existing stack |
| @vue/test-utils | ^2.4.6 | Component mounting in tests | Existing stack |
| vue-tsc | ^3.2.5 | Type-checking (`vue-tsc --build`, per `npm run type-check`) | Existing stack; per CLAUDE.md this is the ONLY sufficient type gate — `-p tsconfig.app.json` silently skips test files |

### Supporting

Not applicable — no new supporting libraries.

### Alternatives Considered

Not applicable — no library decision exists in this phase.

**Installation:** none required.

**Version verification:** confirmed by reading `package.json` directly (`[VERIFIED: package.json]`) rather
than a registry query, since no new package is being added.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages — every change is to existing Vue components
(`PresentationViewer.vue`, `SlidesTab.vue`, `ServiceEditorView.vue`, `SongLyricEditor.vue`,
`LyricPasteDialog.vue`) and existing pure utilities (`slideshowAssembler.ts`, `slideGroupMaterializer.ts`).
The Package Legitimacy Gate protocol is skipped per its own trigger condition ("whenever this phase installs
external packages").

## Architecture Patterns

### System Architecture Diagram — R061's present-start data flow

```
User clicks a slide/group in the Slides tab
        │
        ▼
SlidesTab.vue (selectedSlotId, selectedSlideId — already held, R026/R033)
        │
        │  computes startIndex from (selectedSlotId, selectedSlideId, assembledSlideshow prop):
        │    1. findIndex by slide.id in assembledSlideshow  → found: use it
        │    2. else findIndex by slotIndex === selectedSlotArrayIndex → found: group's first slide
        │    3. else → 0
        ▼
emit('present', startIndex)
        │
        ▼
ServiceEditorView.vue  (@present="onPresent")
        │  onPresent(startIndex) { presentStartIndex.value = startIndex; presenting.value = true }
        ▼
<PresentationViewer :slides="assembledSlideshow" :initial-index="presentStartIndex" ... />
        │
        ▼
PresentationViewer.vue
        │  const currentIndex = ref(clamp(props.initialIndex ?? 0, 0, slides.length - 1))
        ▼
Slide canvas renders slides[currentIndex] — same clamp-on-length-change watcher
already in place (PresentationViewer.vue:456-468) keeps this safe if the deck
shrinks after mount.
```

### System Architecture Diagram — R060's two independent bracket-producing paths

```
Song slot exists in service.slots
        │
        ├── Group NOT YET materialized ──────────────────────────────┐
        │   slideshowAssembler.ts::assembleSlideshow (fallback path)  │
        │     emitFallback(copyright)         ← ALWAYS, before loop  │
        │     for sectionId of order: emitFallback(lyric)            │  Both paths independently
        │     emitFallback(copyright)         ← ALWAYS, after loop   │  guarantee the bracket —
        │   (order.length === 0 → exactly 2 adjacent copyright        │  neither reads the other,
        │    slides, nothing between — degenerate but correct)       │  and materializing a group
        │                                                             │  never removes the fallback
        ├── Group materialized, first time ──────────────────────────┤  bracket that was already
        │   slideGroupMaterializer.ts::deriveGroupEntries (SONG)      │  showing.
        │     push(copyright) → loop(lyric) → push(copyright)         │
        │     — unconditional, mirrors the fallback path exactly     │
        │                                                             │
        └── Group materialized, rebuild (song edit / reorder) ───────┘
            slideGroupMaterializer.ts::rebuildSongGroup
              leadingCopyright  = storedCopyrightEntries[0]   (mint fresh if absent)
              trailingCopyright = storedCopyrightEntries[len>=2 ? last : undefined] (mint fresh if absent)
              — self-healing: any 3rd+ stored copyright entry is silently
                dropped (never carried into `merged`), converging back to 2
```

### Recommended Project Structure

No new files. Edits land in:
```
src/components/
├── PresentationViewer.vue      # R059 (delete block), R061 (initialIndex prop)
├── SongLyricEditor.vue         # R066 (host the inline paste region), R065 (warning card)
├── LyricPasteDialog.vue        # R066 — file fate is Claude's Discretion (35-UI-SPEC §4): inline
│                                #   as a child component (no Teleport/backdrop) OR fold into
│                                #   SongLyricEditor.vue directly. Either way its parsing/save
│                                #   logic (parseCCLIPaste, normalizeParsedSections, saveLyrics
│                                #   call) is kept byte-identical.
└── slides/
    └── SlidesTab.vue            # R061 (compute + emit startIndex)
src/views/
└── ServiceEditorView.vue        # R061 (thread startIndex to PresentationViewer)
src/utils/
└── slideGroupMaterializer.ts    # R060 — NO code change expected; regression test only
└── slideshowAssembler.ts        # R060 — NO code change expected; regression test only
```

### Pattern 1: Mapping a selection to a flat deck index (R061 — new, not in UI-SPEC)

**What:** `SlidesTab.vue` already exposes `selectedSlotArrayIndex` (the raw index into `service.slots`,
matching `AssembledSlide.slotIndex`) and `selectedSlideId`. The flat deck (`assembledSlideshow`) is already
in the correct presentation order (assembled by position). No new lookup structures are needed.
**When to use:** computing the `present` emit's payload.
**Example:**
```typescript
// SlidesTab.vue — new computed, alongside the existing selectedGroupAssembledSlides
const presentStartIndex = computed<number>(() => {
  if (selectedSlideId.value !== null) {
    const bySlide = props.assembledSlideshow.findIndex((a) => a.slide.id === selectedSlideId.value)
    if (bySlide >= 0) return bySlide
  }
  if (selectedSlotArrayIndex.value >= 0) {
    const byGroup = props.assembledSlideshow.findIndex((a) => a.slotIndex === selectedSlotArrayIndex.value)
    if (byGroup >= 0) return byGroup
  }
  return 0
})

// present button handler
function onPresentClick(): void {
  emit('present', presentStartIndex.value)
}
```
This matches 35-UI-SPEC.md's E3 `error` resolution verbatim: "fall back to the selected GROUP's first
slide per R061's literal wording; if the group itself is gone, fall back to index 0."

### Pattern 2: Seeding `PresentationViewer`'s `currentIndex` from a prop (R061)

**What:** `PresentationViewer.vue:318` currently hardcodes `const currentIndex = ref(0)`. It needs to seed
from a new optional prop, clamped the same way the existing length-change watcher already clamps
(`PresentationViewer.vue:456-468`) so the two mechanisms never disagree.
**When to use:** `PresentationViewer.vue`'s own setup, once.
**Example:**
```typescript
// Source: existing clamp formula reused verbatim from the length-change watcher (:459)
const props = defineProps<{
  slides: AssembledSlide[]
  isLoading?: boolean
  initialIndex?: number
}>()

const currentIndex = ref(
  Math.min(Math.max(props.initialIndex ?? 0, 0), Math.max(0, props.slides.length - 1)),
)
```
Do not route this through `goToIndex()` — that function's pause/reset/play lifecycle is for a slide
CHANGE while mounted; at mount there is no "outgoing" slide to pause. `onMounted`'s existing
`playCurrentMedia()` call already handles the first slide's media.

### Anti-Patterns to Avoid

- **Adding a third copyright-emission call for R060:** every path already emits exactly two. A third call
  (e.g. "just to be safe") produces 3+ copyright slides per group — a visible, easily-caught regression that
  this phase's own research states plainly should not happen.
- **Treating `selectedSlideId` as an index:** it is an assembled slide's `id` (string), not a position. The
  flat deck index must be resolved via `findIndex`, never parsed or cast.
- **Rewriting `parseCCLIPaste`/`normalizeParsedSections`/`saveLyrics` "while you're in there":** R066 is a
  host/chrome change. None of the three functions above needs new behavior for R065/R066 — `canConfirm`'s
  extra clause is the only new logic, and it lives in the CALLER (whichever component `LyricPasteDialog`'s
  logic ends up in), not in the parser.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting missing CCLI copyright in pasted text | A second parser or regex scan of `rawText` | `parsed.copyright.ccliSongNumber` from the EXISTING `parseCCLIPaste(rawText)` call | Already computed, already tested (19 tests in `ccliParser.test.ts`); a parallel check risks disagreeing with what actually gets saved |
| Folding a repeated section marker into one pooled section | New pooling logic inside the paste flow | `normalizeParsedSections` (`songSectionOrder.ts:336`) | Already handles the repeated-chorus case (8 tests), including the D-02/D006 pooling contract R066 must not regress |
| Clamping a slide index to a deck's bounds | A new bounds-check helper | The existing formula at `PresentationViewer.vue:459` (`Math.min(Math.max(...), Math.max(0, len-1))`) | Reuse verbatim for R061's seed value so both clamps agree by construction, not by two independently-written formulas happening to match |

**Key insight:** every piece of "new" logic this phase's two harder requirements (R061, R065/R066) need
is a thin composition of already-existing, already-tested pure functions or computed values. The actual new
surface area is small: one computed (`presentStartIndex`), one prop (`initialIndex`), one boolean expression
(`canConfirm`'s copyright-or-override clause), and one markup region (the inline paste UI, fully specified
by 35-UI-SPEC.md).

## Common Pitfalls

### Pitfall 1: Implementing R060 as new code instead of a regression test
**What goes wrong:** a plan or task reads "copyright visible on first and last slide" as an unimplemented
feature and adds a new emission call in `slideshowAssembler.ts` or `slideGroupMaterializer.ts`.
**Why it happens:** the requirement reads like new work, and neither file has a comment saying "this is
already done."
**How to avoid:** this research confirms (see Summary and the Architecture Diagram above) that both the
fallback path and both materialization paths already emit exactly two copyright entries unconditionally,
including for zero-lyric-section groups and for corrupted stored data (self-healing). Write the regression
test described in Open Question / Validation Architecture below instead.
**Warning signs:** a diff touching `emitFallback`, `deriveGroupEntries`, or `rebuildSongGroup`'s
copyright-entry logic for R060 should be treated as suspicious and re-justified against this research.

### Pitfall 2: The `ensureGroupMaterialized` zero-slide bypass reaching a SONG slot
**What goes wrong:** if any FUTURE write path calls `ensureGroupMaterialized` for a SONG slot before that
song's lyrics have loaded, `buildInitialGroup` → `deriveGroupEntries`'s SONG case returns `[]` (no
`lyrics` yet), and `materializeGroupIfMissing` would persist a group with **zero** copyright entries —
breaking R060's bracket, not merely leaving it unbuilt.
**Why it happens:** `ensureGroupMaterialized` (`useSlideshowAssembly.ts:388-427`) is a DELIBERATE exception
to the "never materialize a zero-slide group" rule the automatic watcher (`materializationCandidates`,
same file :277-308) follows — its own doc comment says so explicitly (`useSlideshowAssembly.ts:88-100`),
because it exists for non-song write paths (add slide, import, drop) where an empty starting point is
correct.
**How to avoid:** do not touch this codepath in Phase 35. It is currently unreachable for SONG slots: every
call site (`SlideGrid.vue:532,609,636`, inside `onAddSlide`/`onImportConfirmed`/`appendVideoEntries`) is
gated behind `canMutateGroup`, which is `computed(() => props.isEditor && !props.serviceLocked &&
!isSongGroup.value)` (`SlideGrid.vue:335`) — `isSongGroup` is explicitly excluded (R054: song groups are
read-only in the Slides tab). Flagged here so a future phase that relaxes R054 doesn't reopen this silently.
**Warning signs:** any new call to `ensureGroupMaterialized` from a code path not already excluded by
`isSongGroup`/`canMutateGroup`.

### Pitfall 3: Losing parsing/save test coverage in the modal→inline conversion
**What goes wrong:** `LyricPasteDialog.test.ts`'s 14 tests mount the dialog directly with an `open` prop.
Once the component's host changes (Teleport-modal → inline region gated on `pasteMode`), a naive port either
deletes coverage of the save path (`saveLyrics` call shape, the D006/D-02 repeated-chorus pooling contract)
or half-fixes tests to pass against the new markup without verifying the same assertions.
**Why it happens:** the mounting harness (`props: { open, songId, orgId }`) no longer matches whatever the
new component boundary is.
**How to avoid:** see the full test inventory in the Phase Requirements section below. Move — don't rewrite
— the 9 parsing/save-path tests; only the 2-3 chrome-mechanism tests (open/closed, reset-on-reopen) need
their trigger swapped from a prop to `pasteMode`/button-click. Two brand-new tests are needed for R065
(warning renders + blocks; override unblocks) since no prior test covers that behavior at all.
**Warning signs:** a diff to `LyricPasteDialog.test.ts` (or its successor) with a SMALLER assertion count
than the original 14 tests, or any assertion on `mockSaveLyrics` call shape / pooling that disappears rather
than relocates.

### Pitfall 4: Justifying R060 as a CCLI requirement in code or UI copy
**What goes wrong:** a code comment, commit message, or UI microcopy states or implies CCLI's license
requires first-and-last placement.
**Why it happens:** it is an easy, plausible-sounding shorthand for "why does this feature exist."
**How to avoid:** per REQUIREMENTS.md/STATE.md/35-CONTEXT.md, this is explicitly false — the real
convention (confirmed again this session, see CCLI License Text section below) is "at least once per song,
typically the last slide." First-AND-last is a deliberate safety margin this project chose, not a license
term. 35-UI-SPEC.md's own copywriting contract already avoids this; do not introduce it in code comments.
**Warning signs:** grep for `CCLI requires`, `CCLI mandates`, `license requires` in any new diff.

### Pitfall 5: Breaking "always completable" on the override checkbox
**What goes wrong:** `canConfirm`'s copyright-or-override clause is implemented so the checkbox ALSO
requires some other field (e.g. requiring at least a title) before it unblocks the save.
**Why it happens:** conflating "warn and let them add credits" with "warn and require SOME credits."
**How to avoid:** 35-UI-SPEC.md §4 is explicit and already gives the exact boolean:
`parsed.sections.length > 0 && (!!parsed.copyright.ccliSongNumber || overrideCopyright) && !isSaving`.
Checking the box ALONE must flip `canConfirm` true with nothing else required.
**Warning signs:** a `canConfirm` expression with more than these three clauses, or a test asserting the
checkbox alone is insufficient.

## Code Examples

### R059 — the exact deletion (verified against live source)

```html
<!-- Source: PresentationViewer.vue:48-54, verbatim as it exists today -->
<template v-if="slideKind === 'lyric'">
  <p
    data-testid="presentation-label"
    class="text-2xl font-semibold leading-[1.3] text-indigo-400 uppercase tracking-wider mb-8"
  >
    {{ (currentSlide.slide as LyricSlide).sectionLabel }}
  </p>
  <p
    data-testid="presentation-body"
    class="text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4]"
  >
    {{ (currentSlide.slide as LyricSlide).lines.join('\n') }}
  </p>
</template>
```
Delete the entire `<p data-testid="presentation-label">...</p>` block (lines 49-54). Leave the
`<p data-testid="presentation-body">` paragraph untouched. Do NOT touch the scripture branch's
`presentation-label` (`:87-91`, the passage reference — content, not organization) or the text branch's
(`:126-131`, the slide's own title) — both are out of R059's scope per 35-CONTEXT.md and 35-UI-SPEC.md §1.

### R060 — the regression test's shape (recommended, not existing)

```typescript
// Recommended addition to src/utils/__tests__/slideGroupMaterializer.test.ts
// and src/utils/__tests__/slideshowAssembler.test.ts — asserting the bracket
// this research found already holds, across the cases 35-CONTEXT.md names:
// empty performanceOrder, empty copyright object, corrupted stored data.
describe('R060 — copyright bracket', () => {
  it('brackets a song group with zero lyric sections (fallback path)', () => {
    // lyrics.performanceOrder === [] → assembleSlideshow still emits exactly
    // two adjacent copyright entries, nothing between them
  })
  it('brackets a freshly materialized song group regardless of order length', () => {
    // deriveGroupEntries(songSlot, inputs) — order.length === 0 and order.length === 5
    // both produce entries[0].sourceRef.kind === 'copyright' and entries.at(-1) === same
  })
  it('rebuildSongGroup self-heals a group with only ONE stored copyright entry', () => {
    // storedCopyrightEntries.length === 1 → trailingCopyright is undefined →
    // a fresh one is minted → result has exactly 2 copyright entries
  })
  it('rebuildSongGroup drops a stray THIRD copyright entry rather than keeping it', () => {
    // storedCopyrightEntries.length === 3 (corrupted/hand-edited data) →
    // merged output still has exactly 2 (first as leading, last as trailing,
    // the middle one silently dropped)
  })
})
```

## State of the Art

Not applicable in the "library ecosystem changed" sense — this is an internal-codebase-only phase. The one
relevant "old approach → current approach" is intra-codebase:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `LyricPasteDialog` as a Teleported modal | Inline region inside `SongLyricEditor.vue`'s own panel | This phase (R066) | Removes backdrop/escape-to-close/focus-trap chrome; the 480px host panel forces the old side-by-side textarea/preview split into a stacked layout (35-UI-SPEC.md §4) |
| Paste never blocks on missing copyright | Blocks, with an always-available override | This phase (R065, corrected 2026-08-03 per 35-CONTEXT.md in favor of the wireframe) | `canConfirm` gains a copyright-or-override clause |

**Deprecated/outdated:** none — no library or API this phase touches has moved versions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CCLI's real-world convention is "at least once per song, typically the last slide" (not first-and-last) | Common Pitfalls / CCLI License Text (below) | Sourced from third-party summaries of the CCLI license (Church Motion Graphics, Renewed Vision/ProPresenter support, Musicademy), not CCLI's own primary license text — CCLI's own site was not directly reachable this session either. If wrong, R060's "exceeds the legal minimum, not a mandate" framing (already the requirement's own stated position, independent of this research) would need revisiting — but no code or copy in this phase asserts a CCLI mandate either way, so the risk is confined to documentation accuracy, not runtime behavior. |

**All other claims in this research are `[VERIFIED]` against live source** (file + line references given
throughout) or `[CITED]` against 35-UI-SPEC.md, which is itself checker-approved (6/6). No other assumption
requires user confirmation before planning.

## Open Questions

1. **CCLI's primary license text — attempted again this session, still not retrieved.**
   - What we know: third-party summaries (Church Motion Graphics, Renewed Vision, Musicademy, a Kentucky
     Baptist convention PDF) consistently describe the requirement as "include copyright/CCLI info at least
     once per song, typically the last slide, during the song's performance — not bundled at the end of a
     medley or service." This is consistent with STATE.md's prior finding.
   - What's unclear: none of these are CCLI's own license agreement text. A direct fetch of CCLI's primary
     source was not attempted via a live browse tool in this session (WebSearch does not fetch full page
     text); this is the **second recorded failure** to pull the primary source (the first is documented in
     STATE.md/REQUIREMENTS.md).
   - Recommendation: proceed — R060 already frames itself as "exceeds the legal minimum" rather than citing
     CCLI, so this phase's code and copy need not (and per 35-CONTEXT.md, must not) reference CCLI's
     requirement at all. If the owner wants CCLI's exact text confirmed, that is a standalone research task
     independent of Phase 35's execution.

2. **`LyricPasteDialog.vue`'s post-conversion file fate.**
   - What we know: 35-UI-SPEC.md §4 explicitly leaves this to Claude's Discretion at plan time — either
     inline the logic into `SongLyricEditor.vue` directly, or keep `LyricPasteDialog.vue` as a child
     component mounted inline (no Teleport, no backdrop).
   - What's unclear: which choice minimizes test churn. Keeping it a separate (now chrome-less) child
     component lets `LyricPasteDialog.test.ts` largely keep mounting IT directly (swapping the `open` prop
     for a `pasteMode`-equivalent prop) — likely less test rewrite than a full inline. Folding it into
     `SongLyricEditor.vue` means those 14 tests move into `SongLyricEditor.test.ts`'s mount harness instead.
   - Recommendation: keep it a separate child component (rename optional, e.g. `LyricPasteRegion.vue`),
     mounted with `v-if="pasteMode"` and no Teleport/backdrop/`max-h-[85vh]`. This is the lower-test-churn
     path and matches 35-UI-SPEC.md's markup boundary (`data-testid="paste-region"` wraps a clean, separable
     subtree) — the file rename is a plan-time call, not a research one.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the existing Node/Vite/Vitest
toolchain already in continuous use across the milestone. All changes are to existing Vue components and
pure TypeScript utilities; no new environment variable, service, or CLI is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @vue/test-utils ^2.4.6 (Vue 3.5.29) |
| Config file | `vite.config.ts` (app suite; excludes `src/rules.test.ts`) — no new config needed |
| Quick run command | `npx vitest run src/components/__tests__/PresentationViewer.test.ts src/components/__tests__/LyricPasteDialog.test.ts src/components/__tests__/SongLyricEditor.test.ts src/utils/__tests__/slideGroupMaterializer.test.ts src/utils/__tests__/slideshowAssembler.test.ts src/components/slides/__tests__/SlidesTab.test.ts` |
| Full suite command | `npx vitest run src/` (per CLAUDE.md — excludes rules; non-defect baseline is `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`, 9 tests / 2 files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R059 | Lyric slide never shows `sectionLabel` when presenting | unit | `npx vitest run src/components/__tests__/PresentationViewer.test.ts -t "sectionLabel"` | ✅ (existing test at :460-464 must be UPDATED to assert absence, not presence — a required edit, not new coverage) |
| R059 | Scripture/text `presentation-label` unaffected | unit | `npx vitest run src/components/__tests__/PresentationViewer.test.ts -t "presentation-label"` | ✅ existing tests at :488, :541, :551 — must still pass unmodified |
| R060 | Fallback path brackets a song group (incl. empty order) | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` | ⚠ file exists; new `describe('R060...')` block needed — see Code Examples |
| R060 | Materialized-path brackets a song group (fresh + rebuild, incl. corrupted stored data) | unit | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` | ⚠ file exists; new test cases needed — see Code Examples |
| R061 | `presentStartIndex` resolves selected slide/group/nothing to the correct deck index | unit | `npx vitest run src/components/slides/__tests__/SlidesTab.test.ts -t "present"` | ⚠ Wave 0 gap — new test cases for the new computed |
| R061 | `PresentationViewer` seeds `currentIndex` from `initialIndex` prop, clamped | unit | `npx vitest run src/components/__tests__/PresentationViewer.test.ts -t "initialIndex"` | ⚠ Wave 0 gap — new prop, new tests |
| R065 | Missing-copyright warning renders; `Replace lyrics` disabled until override or CCLI number present | unit | `npx vitest run src/components/__tests__/LyricPasteDialog.test.ts -t "copyright"` (or successor file) | ⚠ Wave 0 gap — genuinely new behavior, no prior test |
| R065 | Override checkbox alone unblocks the save, independent of any other field | unit | same file, new test | ⚠ Wave 0 gap |
| R066 | Paste happens inline (no modal chrome, no Teleport/backdrop) in `SongLyricEditor.vue` | unit | `npx vitest run src/components/__tests__/SongLyricEditor.test.ts -t "paste"` | ⚠ existing tests only check button existence (`SongLyricEditor.test.ts:190-204`) with `LyricPasteDialog` FULLY STUBBED — new tests needed for the real inline region |
| R066 | Parsing/save logic (`parseCCLIPaste`, `normalizeParsedSections`, `saveLyrics` call shape, repeated-chorus pooling) unchanged | unit | `npx vitest run src/utils/__tests__/ccliParser.test.ts src/utils/__tests__/songSectionOrder.test.ts` | ✅ 19 + 8 tests respectively, byte-identical, must pass unmodified (these files are NOT touched by this phase) |

### Sampling Rate
- **Per task commit:** the quick-run command above, scoped further to the single file under active edit.
- **Per wave merge:** `npx vitest run src/` (full app suite).
- **Phase gate:** `npm run type-check` (vue-tsc --build, per CLAUDE.md — NOT `-p tsconfig.app.json`) AND
  `npx vitest run src/` green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/utils/__tests__/slideshowAssembler.test.ts` — add the R060 fallback-path bracket assertions
      (empty order, populated order — both already covered ELSEWHERE in the file for populated case; the
      empty-order case is the actual gap)
- [ ] `src/utils/__tests__/slideGroupMaterializer.test.ts` — add the R060 materialized-path bracket
      assertions, INCLUDING the corrupted-data self-healing cases (1 stored copyright entry, 3+ stored)
- [ ] `src/components/slides/__tests__/SlidesTab.test.ts` — add `presentStartIndex` computed tests (slide
      selected, group-only selected, nothing selected, stale/removed selection)
- [ ] `src/components/__tests__/PresentationViewer.test.ts` — add `initialIndex` prop tests (seeds
      correctly, clamps out-of-range values, defaults to 0 when absent); UPDATE the existing
      `sectionLabel`-presence test at :460-464 to assert absence
- [ ] `src/components/__tests__/LyricPasteDialog.test.ts` (or its successor file, per Open Question 2) —
      MOVE the 9 parsing/save-path tests (not rewrite), RESHAPE the 2-3 chrome-mechanism tests to trigger via
      `pasteMode`/button-click instead of an `open` prop, ADD 2 new tests for the R065 warning+override gate
- [ ] `src/components/__tests__/SongLyricEditor.test.ts` — the existing `LyricPasteDialog` stub
      (`SongLyricEditor.test.ts:139`) must be removed/updated once the dialog is genuinely inline; add tests
      for the header swap (`lyrics-header` ↔ `lyrics-paste-header`) and the unsaved-changes guard on
      `‹ Back to sections`/`Cancel`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — no auth surface touched |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No (verified, not merely assumed) | `SongLyricEditor.vue` is gated only on `authStore.isEditor` (`:306`) today and stays that way — confirmed NOT service-locked (reachable only from the Songs catalog via `SongSlideOver.vue`, never a service-scoped route, per 35-UI-SPEC.md §5, independently re-verified: no `serviceLocked` prop exists in `SongSlideOver.vue`'s or `SongLyricEditor.vue`'s prop chain) |
| V5 Input Validation | Yes | Pasted lyric text is rendered exclusively via Vue's default `{{ }}` text interpolation — `[VERIFIED: no v-html]` in both `LyricPasteDialog.vue` and `SongLyricEditor.vue` (grepped this session, zero matches) — so no new XSS surface is introduced by moving the same textarea/preview markup inline. The Firestore write path (`songLyricsStore.saveLyrics` → `addDoc`) is unchanged. |
| V6 Cryptography | No | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via pasted lyric/copyright text rendered on a projected surface | Tampering / Elevation of Privilege | Vue's default text interpolation (no `v-html` anywhere in the paste or presentation render paths) — already in place, unchanged by this phase |
| Unhandled save-rejection silently discarding a user's paste | Denial of Service (data loss, not availability) | R065's own scope area — `LyricPasteDialog.vue`'s current `onConfirm` has NO catch block (`try { ... } finally { isSaving.value = false }`, `:184-203`), so a rejected `saveLyrics()` call propagates as an unhandled rejection with the pasted text still in the (now-inline) textarea's `v-model` — 35-UI-SPEC.md's E4 `error` backstop (`paste-save-error`, `:214`) already specifies the fix: add a `catch` that sets a visible error and leaves `rawText` intact |

## Project Constraints (from CLAUDE.md)

- **Type-check gate:** `npm run type-check` (`vue-tsc --build`), never `-p tsconfig.app.json` — the latter
  silently skips test files and has previously hidden real `TS2339` errors across two full phases.
- **Two test suites, one excluded by default:** `npx vitest run` (app suite, excludes
  `src/rules.test.ts`) is this phase's gate — nothing in R059/R060/R061/R065/R066 touches Firestore
  security rules, so `npm run test:rules` is not required for this phase.
- **Known-failing baseline, not defects:** `src/storage.rules.test.ts` and
  `src/views/__tests__/RosterView.test.ts` — do not treat these as phase regressions if they were already
  failing before this phase's changes.
- **`.env.local` required in any worktree** this phase's work happens in, for the emulator/full-suite/build
  to function — copy or symlink from the main checkout per CLAUDE.md's documented procedure.
- **`.gsd/` is gone; the graph needs a rebuild** — this research did not rely on `gsd graphify query`
  results (the graph is stale per CLAUDE.md's own warning) and instead read live source directly via `Read`/
  `Grep` for every claim above.

## Sources

### Primary (HIGH confidence — verified against live source this session)

- `src/components/PresentationViewer.vue` — full file read; R059 target (`:48-54`), `currentIndex` seed
  point (`:318`), existing clamp formula (`:456-468`)
- `src/utils/slideshowAssembler.ts` — full file read; fallback-path copyright bracket (`:379,381-390,393`)
- `src/utils/slideGroupMaterializer.ts` — full file read; `deriveGroupEntries` (`:40-104`),
  `rebuildSongGroup` (`:476-630`), self-healing behavior for 1 and 3+ stored copyright entries
- `src/composables/useSlideshowAssembly.ts` (relevant sections) — `materializationCandidates` zero-slide
  skip (`:277-308`) vs. `ensureGroupMaterialized`'s deliberate non-skip (`:388-427`, doc comment `:88-100`)
- `src/components/slides/SlideGrid.vue` (relevant sections) — `canMutateGroup`/`isSongGroup` gating
  (`:317,335`), all three `ensureGroupMaterialized` call sites (`:532,609,636`)
- `src/components/slides/SlidesTab.vue` — full file read; `selectedSlotId`/`selectedSlideId` (`:186-187`),
  `present` emit (`:181`, click at `:19`), `selectedSlotArrayIndex` (`:247`)
- `src/views/ServiceEditorView.vue` (relevant sections) — `SlidesTab`/`PresentationViewer` mount (`:1203-
  1231`), `presenting` ref (`:1695`)
- `src/components/LyricPasteDialog.vue` — full file read (211 lines) — parsing/save call shape, `onConfirm`'s
  missing catch (`:184-203`), `onCancel` guard (`:205-210`)
- `src/components/SongLyricEditor.vue` — full file read — header/mount points for the inline conversion
  (`:4-27, 252-258, 293`)
- `src/components/__tests__/LyricPasteDialog.test.ts` — full file read, all 14 tests enumerated
- `src/components/__tests__/SongLyricEditor.test.ts` (relevant sections) — confirms the `LyricPasteDialog`
  stub and button-existence-only coverage (`:139, 190-204`)
- `src/components/__tests__/PresentationViewer.test.ts` (relevant sections) — the test at `:460-464` that
  must be updated for R059, and the scripture/text tests at `:488,541,551` that must stay unmodified
- `src/utils/__tests__/ccliParser.test.ts`, `src/utils/__tests__/songSectionOrder.test.ts` — counted (19 and
  8 tests respectively) to confirm untouched, load-bearing coverage
- `.planning/phases/35-presentation-correctness-lyric-editor/35-UI-SPEC.md` — checker-approved (6/6),
  authoritative for all R065/R066 markup/copy/state contracts
- `.planning/phases/35-presentation-correctness-lyric-editor/35-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — requirement text and prior-session findings
- `package.json` — dependency versions (`[VERIFIED: package.json]`)

### Secondary (MEDIUM confidence)

- `docs/design/slides-tab.dc.html` (Turn 2, lines 358-654) — the wireframe 35-UI-SPEC.md already transcribes
  faithfully; read via `docs/design/README.md`'s summary rather than the full 93KB export, since UI-SPEC.md
  is the checker-approved distillation of it

### Tertiary (LOW confidence — flagged for validation)

- CCLI license-text summaries (Church Motion Graphics, Renewed Vision/ProPresenter support, Musicademy) —
  third-party interpretations, not CCLI's own primary license text; see Assumptions Log A1 and Open
  Question 1. This is the second session in which the primary source was not retrieved.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, versions confirmed directly from `package.json`
- Architecture (R059/R060/R061): HIGH — every claim traced to specific file/line references and, for R060,
  exhaustively reasoned through every group-construction code path including edge/corrupted-data cases
- Architecture (R065/R066): HIGH — fully specified by checker-approved 35-UI-SPEC.md; this research adds
  only the test-migration inventory, which is directly read from the existing test files
- Pitfalls: HIGH — five of five are drawn from concrete, cited code paths, not speculation
- CCLI license text (Assumptions Log A1): LOW — third-party summaries only, primary source not retrieved a
  second time

**Research date:** 2026-08-03
**Valid until:** 30 days (stable internal codebase; no external API/library surface this phase depends on is
expected to change)
