# Phase 47: Congregational Reading Divider UX - Research

**Researched:** 2026-08-08
**Domain:** Vue 3 SFC editor rework (hand-divide UI) + presenter/grid rendering (3-way speaker role) — no new external dependencies
**Confidence:** HIGH (every claim below is grounded in direct reads of the actual source files under `src/`, not the stale graph — see note below)

> **Graph freshness note:** `gsd-tools graphify status` reports `stale: true`, 65h old, 914 commits
> behind (`built_at_commit cff14e9` vs current `016ec80`), and a graph query for this phase's terms
> returned zero nodes. Per CLAUDE.md's standing warning, the graph was not trusted for this research —
> every file/line reference below was verified by direct `Read`/`Grep` against `src/` on disk, not
> against graph output.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Divider Editing Model (R095)**
- Boundaries snap to legal break points, never arbitrary text ranges. Reuse Phase 34's
  `computeBoundaries` / `splitPassage` (verse/clause boundaries) as the set of places a divider
  may fall — this is exactly why R095 and FEATURES.md reject free-range selection (pattern e).
- Primary gesture (pattern a): clicking the gap between two adjacent verses reveals a thin `+`
  affordance that inserts a boundary (splits one segment into two at that point); clicking an
  existing boundary removes it (merges the two neighbors). Both snapped to `computeBoundaries`.
- Single editable structure: keep `CongregationalSection[]` — `{ speaker, text, verseRange,
  translationSource }` — as THE structure all three seeds write to. Extend `speaker` to
  `'LEADER' | 'CONGREGATION' | 'ALL'`. This is the `{ text, role }[]` R096 names.
- Per-segment labeling (pattern c): each segment carries a 3-way segmented-control chip
  (Leader / Congregation / All), not a dropdown. Non-adjacent segments sharing a label (a
  recurring refrain — Psalm 136) is inherently supported: any segment may take any of the 3 roles.
- Rejected (locked): drag-handles (pattern b) and free-range/select-text-then-label (pattern e).
  If segment reordering is ever needed, up/down move — never drag.
- Touch: the gap `+` is a generously-sized tap target and the 3-way chip is the touch-first
  labeling control, so the editor is usable on a phone.

**The Three Seeds (R096)**
- After Fetch Passage, present three equally-available seed actions:
  1. Split with AI — the existing `splitCongregationalReading` call, shown only when
     `authStore.settings.aiEnabled`.
  2. Alternate Leader/Congregation — the existing `buildAlternatingSections` logic, now a
     one-click deterministic seed (no network) rather than an automatic on-fetch action.
  3. Start blank — every verse its own segment, all defaulting to Leader; the user hand-divides
     and labels from there.
- Behavior change (disclosed): fetch no longer auto-commits the alternating split. Fetch renders
  the passage; the user picks a seed.
- All three write the identical `CongregationalSection[]`; after any seed the user can freely
  re-divide (gap `+`) and re-label (chips) — no seed is a dead end.
- AI-off path is fully functional: Alternate + Blank + hand-editing require no AI at all.

**The ALL Role & Slide Rendering (R097)**
- Add `'ALL'` to `CongregationalSection.speaker`. Additive and safe: existing data has only
  LEADER/CONGREGATION; ALL is new, so no migration is needed.
- Presenter: the speaker-label render is currently a binary ternary (line ~199) with two colours
  (sky/amber). Extend to three: `Leader:` / `Congregation:` / `All:`, each with a distinct colour
  (ALL gets a third hue), label always shown as text. The grid card render (`slideDisplay.ts`)
  gets the same 3-way label.
- R097: the slideshow assembler already builds one slide per section with the reference resolved
  live. Confirm/implement: the first section slide of a reading shows the scripture reference;
  every later section slide shows only the speaker label.
- No print work — congregational slides render on the slide surfaces; the printed Order of
  Service is out of scope.

### Claude's Discretion
- Exact ALL colour/hue, the `+` gap affordance visuals and hit-area, the segmented-control chip
  styling, whether to keep the current modal shell or restructure it, and all copy — at Claude's
  discretion within the decisions above. **Resolved by 47-UI-SPEC.md**: ALL = violet-300/violet-900/50
  (chip)/violet-600/70 (border); gap `+` = 44×44 tap wrapper around a 24px visual circle,
  hover/focus-revealed on desktop, `opacity-40` persistent on touch; chip = `h-10` options,
  `px-2.5 text-xs font-semibold uppercase tracking-wider`; modal shell kept as-is (existing
  Teleported panel in `ServiceEditorView.vue`); re-seed confirm copy specified verbatim (see
  UI-SPEC § Copywriting Contract).

### Deferred Ideas (OUT OF SCOPE)
- Segment reordering (drag or move-buttons) — not required by R095-R097 (dividers define order by
  position); build only if a concrete need surfaces. Drag is explicitly rejected regardless.
- Mid-clause / arbitrary-range dividers — rejected by R095 + FEATURES.md (pattern e overkill).
- Printed-bulletin typography for responsive readings — print surface is out of scope.
- Broader mobile layout polish — Phase 48 (this editor just must be touch-usable).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R095 | A user can divide a scripture passage into Leader, Congregation and All sections by hand, placing the dividers themselves. | § Architecture Patterns Pattern 1 (internal boundary-index model reusing `scriptureBoundaries.ts`); § Code Examples (gap-click insert/remove); § Common Pitfalls 1–3 |
| R096 | The AI-proposed split is offered as one starting point among several — alongside one-click alternating assignment and starting blank — and disappears entirely when AI is off. Depends on R088. | § Architecture Patterns Pattern 2 (the three seeds, and the missing "Blank" splitter function); § Don't Hand-Roll; `authStore.settings.aiEnabled` gate already proven at `claudeApi.ts` module entry (R088, Phase 39, code-complete) |
| R097 | The first slide of a congregational reading shows the scripture reference; every later slide shows only the speaker label. | § Architecture Patterns Pattern 3 — **this is NOT currently implemented**, contrary to CONTEXT.md's assumption that "Phase 38 laid most of this." Every congregational section slide today shows BOTH the reference AND the speaker label. See the flagged finding below Pattern 3 for the exact fix (new `isFirstSection` field + 3 call-site changes). |
</phase_requirements>

## Summary

This phase reworks an existing, working, tested component (`CongregationalEditor.vue`, 319
lines) rather than building greenfield. No new npm packages are needed — every primitive (chip,
click-divider, modal) is hand-authored Tailwind, matching the rest of the codebase, and the only
"library" this phase touches is the codebase's own `scriptureBoundaries.ts`/`scriptureSplitter.ts`
infra already built in Phase 34 for the AI-split feature. The core engineering decision the
planner must get right is the **internal editing data model**: the click-divider interaction
cannot operate directly on `CongregationalSection[]` (which only carries derived text), because
inserting a divider mid-segment requires knowing where in the *original fetched text* that
segment's boundaries sit. The natural fix — already proven by `claudeApi.ts`'s existing AI-split
code — is an internal `{ speaker, startBoundary, endBoundary }[]` array indexing into the same
`computeBoundaries(rawText)` array the gap-`+` affordances render against, with
`CongregationalSection[]` derived from it via `sliceAtBoundaries`/`stripVerseMarkers`/
`verseRangeForSlice` (all three already exported from `scriptureBoundaries.ts`) only when
displaying or emitting. All three seeds (AI, Alternate, Blank) should produce this same internal
shape; "Alternate" and "Blank" need two small new pure functions (Alternate already exists as
`buildAlternatingSections`; Blank does not exist yet and must not be confused with `splitPassage`,
which groups multiple verses per segment by word count, not one-verse-per-segment as CONTEXT.md
specifies).

The second major finding is that **R097 is not implemented today**, despite CONTEXT.md's framing
("Phase 38 laid most of this — this phase verifies it holds"). Every congregational section slide
currently renders both `presentation-scripture-reference` (unconditionally, at the top of every
scripture-kind slide) and the speaker line — there is no code path that suppresses the reference
on slides after the first. The existing `PresentationViewer.test.ts` test at line ~789 explicitly
confirms both slides in a 2-section reading show `presentation-speaker`, but never asserts the
reference is absent on slide 2 — because today it is not. This is a real, additive feature to
build (not merely verify), touching `ScriptureSlide`'s type, both content-resolution paths
(`slideGroupMaterializer.ts::resolveEntryContent` and `slideshowAssembler.ts`'s SCRIPTURE fallback
branch), `PresentationViewer.vue`'s template, and `slideDisplay.ts::slideBodyText()` (which has the
identical "always prefixes the reference" bug for the grid card body preview).

The third finding is a **fourth ripple site** the UI-SPEC does not mention:
`EditSlideDrawer.vue`'s own `onSpeakerToggle`/`drawer-speaker-toggle` — a separate, already-shipped
(Phase 38-03) per-materialized-slide speaker control that does a hard binary flip
(`speaker === 'LEADER' ? 'CONGREGATION' : 'LEADER'`). Once `ALL` exists, clicking this toggle on an
ALL-labeled slide silently jumps to `LEADER` (skipping `CONGREGATION` entirely), and its colour
classes are `indigo-300`/`amber-300` — the same indigo/LEADER-colour collision the UI-SPEC already
flags and fixes in `CongregationalEditor.vue` itself, left unfixed here. The planner must decide
whether to widen this control to a proper 3-way cycle/chip or explicitly descope it with a stated
reason; leaving it as an untouched binary is a correctness bug once ALL ships.

**Primary recommendation:** Model the editor's internal state as boundary-indexed sections
(`{speaker, startBoundary, endBoundary}[]`), derive `CongregationalSection[]` from it via the
existing `scriptureBoundaries.ts` slice helpers, add an `isFirstSection` (or equivalent) field to
`ScriptureSlide` to make R097 real, and treat `EditSlideDrawer.vue`'s speaker toggle as an
in-scope ripple site alongside the three the UI-SPEC names explicitly.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hand-divide interaction (click gap, insert/remove boundary) | Browser / Client (Vue SFC, `CongregationalEditor.vue`) | — | Pure client-side editing of an in-memory draft; nothing persists until the parent emits |
| Three-seed generation (AI / Alternate / Blank) | Browser / Client (`CongregationalEditor.vue` calling pure utils) | API / Backend (AI seed only, via Claude API proxy) | Alternate and Blank are pure local functions (no network); AI seed is the one path that leaves the client, already routed through the existing `claudeApi.ts` choke point |
| `CongregationalSection[]` persistence | API / Backend (Firestore, via parent `ServiceEditorView.vue` → `ScriptureSlot`) | — | `CongregationalEditor.vue` is a controlled prop/emit component that persists nothing itself (WR-04, 34-06) — unchanged by this phase |
| 3-way speaker rendering (presenter, grid card, drawer) | Browser / Client (`PresentationViewer.vue`, `slideDisplay.ts`, `EditSlideDrawer.vue`) | — | All three are pure presentation of already-assembled `Slide` data; no new backend logic |
| First-slide-shows-reference logic (R097) | Browser / Client (rendering) + a small Data/Assembly change | Database / Storage (none — no schema migration; additive field) | The *decision* of "is this the first section" is computable at assembly time (`slideGroupMaterializer.ts` / `slideshowAssembler.ts`) from the entry's own ordinal position; rendering tiers just consume the resulting boolean |

## Standard Stack

### Core

No new runtime dependencies. This phase is a rework of existing Vue 3 SFCs using the app's
existing stack.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | ^3.5.29 (installed, verified via `package.json`) | SFC framework | Already the app's framework; no alternative considered |
| pinia | ^3.0.4 (installed) | `authStore.settings.aiEnabled` / `bibleVersion` reads | Already the app's store; `CongregationalEditor.vue` already imports it |
| typescript | ~5.9.3 (installed) | Type-checking the widened `CongregationalSection.speaker` union | `npm run type-check` (the `vue-tsc --build` form, per CLAUDE.md) is the gate |

### Supporting

No new supporting libraries. All interaction primitives (chip, `+` affordance, modal) are
hand-authored Tailwind, matching every other control in this file and in `PresentationViewer.vue`
— confirmed by 47-UI-SPEC.md's Design System section (no component library, no icon package, no
shadcn registry in this Vue 3 repo).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-authored click-divider + chip (locked) | A generic rich-text/annotation library (Prodigy-style span labeling) | Rejected in FEATURES.md § pattern (e) — real responsive readings never break mid-clause, so the extra flexibility (and its dependency weight) buys nothing needed here |
| Internal `{speaker, startBoundary, endBoundary}[]` model (recommended) | Storing only `CongregationalSection[]` and re-running `computeBoundaries` on concatenated segment text to find split points | Rejected: concatenated segment text loses the exact original character offsets once verse-marker text has been stripped (`stripVerseMarkers`), making later divider operations ambiguous. The boundary-indexed model is the only one that stays byte-exact against `rawText`, matching the same discipline `scriptureBoundaries.ts`'s own doc comments insist on for the AI path (see "THE ENCODING BACKSTOP" comment on `sliceAtBoundaries`) |

**Installation:** None required — no new packages.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages (no `npm install` of any kind). All
work is a rework of existing first-party Vue/TypeScript files using already-installed
dependencies. The Package Legitimacy Gate protocol is skipped per its own stated scope ("Required
whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CongregationalEditor.vue (modal, controlled prop/emit — persists nothing)│
│                                                                           │
│  [Fetch Passage] ──fetch──> ESV/NLT proxy ──> rawText (verse-marked)     │
│         │                                         │                     │
│         │                          computeBoundaries(rawText)           │
│         │                          (Phase 34, reused verbatim)          │
│         │                                         │                     │
│         ▼                                         ▼                     │
│  [Choose a starting point]              boundaries: number[]            │
│    ┌─────────┬───────────┬────────┐    (legal break points — verse      │
│    │ AI split│ Alternate │ Blank  │     markers + clause ends)          │
│    └────┬────┴─────┬─────┴───┬────┘             │                       │
│         │           │         │                  │                     │
│   splitCongreg-  buildAlter-  NEW: one segment    │                     │
│   ationalReading nating       per verse (needs    │                     │
│   (network, AI-  Sections    a new function —     │                     │
│   gated)         (existing,  see Pitfall 4)       │                     │
│         │        no network)      │               │                     │
│         └───────────┬─────────────┘               │                     │
│                      ▼                             │                     │
│     internal draft: {speaker, startBoundary,       │                     │
│                       endBoundary}[]  <────────────┘                     │
│                      │  (recommended internal model — see Pattern 1)    │
│         ┌────────────┼─────────────────┐                                │
│         ▼            ▼                 ▼                                │
│    gap `+` click   3-way chip     re-seed with                          │
│    (insert/remove  (relabel any    hasManuallyEdited                    │
│    a boundary)     segment)        confirm gate                         │
│         │            │                 │                                │
│         └────────────┴─────────────────┘                                │
│                      ▼                                                  │
│     derive CongregationalSection[] via sliceAtBoundaries +               │
│     stripVerseMarkers + verseRangeForSlice (existing exports)           │
│                      │                                                  │
│              emit('update:sections', ...)                              │
└──────────────────────┼──────────────────────────────────────────────────┘
                        ▼
      ServiceEditorView.vue writes ScriptureSlot.congregationalSections
                        │
                        ▼
      slideGroupMaterializer.ts::deriveGroupEntries (SCRIPTURE case)
        — one GroupSlideEntry per section, entry.order = section index
                        │
                        ▼
      resolveEntryContent (stored-group path) / slideshowAssembler.ts
      fallback path — BOTH build one ScriptureSlide per section
        — MUST set isFirstSection: order === 0 (R097 fix, currently absent)
                        │
          ┌─────────────┴──────────────┐
          ▼                             ▼
  PresentationViewer.vue          slideDisplay.ts (grid card)
  — reference only if             — slideBodyText(): reference-prefix
    isFirstSection                  only if isFirstSection
  — speaker line always           — speakerDisplayName(): 3-way branch
    (3-way colour: sky/amber/       (LEADER/CONGREGATION/ALL)
    violet)
```

### Recommended Project Structure

No new files/folders are required. Modified files only:

```
src/
├── types/slide.ts                       # CongregationalSection.speaker union widened; ScriptureSlide gets isFirstSection
├── components/
│   ├── CongregationalEditor.vue         # full rework: internal boundary model, 3 seeds, gap-+ divider, 3-way chip
│   ├── PresentationViewer.vue           # speakerColorClass 3-way; reference gated on isFirstSection
│   └── slides/
│       ├── slideDisplay.ts              # speakerDisplayName 3-way; slideBodyText reference-gating
│       └── EditSlideDrawer.vue          # speaker toggle ripple — decide 3-way cycle vs. explicit descope
├── utils/
│   ├── scriptureSplitter.ts             # NEW: per-verse "Blank" seed splitter (do not reuse splitPassage's grouping)
│   ├── scriptureBoundaries.ts           # UNCHANGED — reused as-is for boundary computation + slicing
│   ├── slideGroupMaterializer.ts        # resolveEntryContent scripture case: set isFirstSection from entry.order
│   ├── slideshowAssembler.ts            # SCRIPTURE fallback branch: set isFirstSection from localSeq
│   └── claudeApi.ts                     # SPLIT_SCHEMA + validateSplitResult: widen speaker enum to include 'ALL'
└── types/slideGroup.ts                  # SourceRef.speaker union widened to include 'ALL'
```

### Pattern 1: Boundary-Indexed Internal Editing Model (R095)

**What:** Represent the editor's live draft as an array of `{ speaker, startBoundary, endBoundary
}` — indices into the SAME `boundaries: number[]` array (`computeBoundaries(rawText)`) that the
gap-`+` affordances render against — rather than as `CongregationalSection[]` directly.
`CongregationalSection[]` is a *derived, display/emit-time* projection of this internal array via
`sliceAtBoundaries` + `stripVerseMarkers` + `verseRangeForSlice` (all three already exported by
`scriptureBoundaries.ts` and already used by `claudeApi.ts::splitCongregationalReading` for
exactly this purpose).

**When to use:** Any time the editor needs to answer "does this click-point fall inside an
existing segment, and if so which one" — a question `CongregationalSection[]`'s plain `text`
field cannot answer once verse markers have been stripped out of it.

**Why this is the right model (not merely "a" model):** `claudeApi.ts` already proves this exact
representation works for the AI seed — its internal `SplitSection[]` (defined at line ~393) is
`{ speaker, startBoundary, endBoundary }`, validated for full coverage/no-gap/no-overlap by
`validateSplitResult`, then mapped to text-bearing sections only at the very end via
`sliceAtBoundaries`. Reusing that exact shape as the editor's single internal draft format means
Alternate and Blank seeds can be expressed as pure functions that emit the same shape, and the
gap-`+`/divider-remove operations become simple array splices:

- **Insert** a boundary at `boundaries[i]` inside segment `{speaker, start, end}` where `start < i
  < end`: replace that one entry with two — `{speaker, start, i}` and `{speaker, i, end}` — the
  new segment inherits the SAME speaker (CONTEXT.md's explicit requirement, so a user dividing a
  long Leader passage into two Leader parts never has to re-pick the role).
- **Remove** a boundary at `boundaries[i]` that currently separates segment A (`end === i`) from
  segment B (`start === i`): replace both with one `{speaker: A.speaker, start: A.start, end:
  B.end}` — keeps the FIRST (upper) segment's speaker role, per the UI-SPEC's Interaction Contract.

**Example (conceptual, illustrating the shape only):**
```typescript
// Source: this codebase's src/utils/claudeApi.ts (existing SplitSection shape, lines ~393-397)
// and src/utils/scriptureBoundaries.ts (existing exported slice helpers)
interface DraftSection {
  speaker: 'LEADER' | 'CONGREGATION' | 'ALL'
  startBoundary: number  // index into the SAME `boundaries` array used for gap affordances
  endBoundary: number
}

function toCongregationalSections(
  rawText: string,
  boundaries: number[],
  draft: DraftSection[],
  translationSource: 'ESV' | 'NLT',
): CongregationalSection[] {
  return draft.map(({ speaker, startBoundary, endBoundary }) => {
    const slice = sliceAtBoundaries(rawText, boundaries, startBoundary, endBoundary)
    return {
      speaker,
      text: stripVerseMarkers(slice),
      verseRange: verseRangeForSlice(slice),
      translationSource,
    }
  })
}
```

### Pattern 2: The Three Seeds — What Each Actually Produces

**What:** All three seeds must resolve to the SAME `DraftSection[]` shape from Pattern 1 (or
equivalently, directly to `CongregationalSection[]` if the planner decides not to adopt Pattern
1 — but then the click-divider math has to be re-derived by re-running `computeBoundaries` against
concatenated verse text, which loses byte-exactness once `stripVerseMarkers` has already run; not
recommended).

- **AI seed**: `splitCongregationalReading(rawText)` already returns `CongregationalSection[]`
  (not the boundary-indexed internal shape) — see `claudeApi.ts` lines 549-589. If Pattern 1 is
  adopted, either (a) change `splitCongregationalReading`'s return type to the pre-slice
  `SplitSection[]` shape and slice once in the editor (cleaner, avoids double-slicing), or (b) keep
  its current text-returning contract and re-derive approximate boundary indices by matching each
  returned section's `verseRange` back against `boundaries` (messier, not recommended). **Option
  (a) requires touching `claudeApi.ts`'s return type** — flag this for the planner as a decision
  point, since `claudeApi.ts` is otherwise a stable, heavily-invariant-commented file (see its own
  "Two invariants a future editor is most likely to break" comment at line ~532).
- **Alternate seed**: `CongregationalEditor.vue`'s own existing `buildAlternatingSections()`
  (lines 205-217) already does exactly what R096 wants — it just currently runs automatically
  inside `onFetchPassage()`. The only change needed is moving its invocation behind a seed-button
  click instead of an automatic call. It internally calls `splitPassage(text, scriptureRef)`
  (`scriptureSplitter.ts`), which groups verses into slides by a **50-word default threshold**
  (`DEFAULT_WORDS_PER_SLIDE`), NOT one verse per slide — this is fine for Alternate (that's its
  existing, proven behavior) but must not be confused with what Blank needs.
- **Blank seed — NEEDS A NEW FUNCTION.** CONTEXT.md is explicit: "every verse its own segment, all
  defaulting to Leader" (§ Decisions, The Three Seeds). `splitPassage` cannot be reused for this —
  it groups multiple verses per slide by word count. Neither can `computeBoundaries` alone, since
  its boundary set mixes verse-marker boundaries AND clause-ending-punctuation boundaries (see
  `scriptureBoundaries.ts`'s `VERSE_MARKER_PATTERN` vs `CLAUSE_END_PATTERN`) — Blank needs ONLY the
  verse-marker subset. Recommend a new exported function in `scriptureSplitter.ts` (sibling to
  `splitPassage`), e.g. `splitPerVerse(text: string): { text: string; verseRange: string }[]`,
  built the same way `parseVerses()` already works internally (regex `/\[(\d+)\]/`) but returning
  one entry per verse unconditionally (no word-count grouping). Each entry then maps to a
  `DraftSection`/`CongregationalSection` with `speaker: 'LEADER'`.

### Pattern 3: R097 — First Slide Shows Reference, Later Slides Show Speaker Only

**⚠ This is a gap to build, not a behavior to verify.** Traced end-to-end through the actual
render/assembly code (not assumed from CONTEXT.md's framing):

- `slideshowAssembler.ts`'s SCRIPTURE fallback branch (~line 501) builds `content.reference =
  formatScriptureReference(scriptureRef)` **identically for every section** via `sections.forEach
  ((section, localSeq) => {...})` — the same `reference` string on all N section slides, with no
  `localSeq === 0` branching anywhere.
- `slideGroupMaterializer.ts`'s `resolveEntryContent` scripture case (~line 177) does the same:
  `reference: formatScriptureReference(scriptureRef)` unconditionally, with no reference to
  `entry.order` at all today.
- `PresentationViewer.vue` (~line 159-164) renders `presentation-scripture-reference`
  UNCONDITIONALLY at the top of the whole `scripture` template block, before the `v-if=
  "isCongregational"` branch that adds the speaker line — so today EVERY congregational section
  slide shows BOTH the reference header and the speaker label.
- `slideDisplay.ts::slideBodyText()` (~line 190-205) has the identical bug for the grid-card body
  preview: `` `${slide.reference}\n${slide.text} ${...}` `` runs for every section slide with
  non-empty text, with no first-slide gating.
- The existing test `PresentationViewer.test.ts` (~line 789-819) proves this current behavior: it
  asserts BOTH slide 1 and slide 2 of a 2-section reading show their respective speaker lines, but
  never asserts anything about the reference element's presence/absence — because today it is
  present on both, unconditionally, and no test locks that in as either correct or incorrect.

**The fix, traced through where the "first" signal is available:**
- `deriveGroupEntries`'s SCRIPTURE case (`slideGroupMaterializer.ts` ~line 108) already sets
  `order: index` per section when building `GroupSlideEntry[]` for a FRESH conversion — and
  because a SCRIPTURE slot's SlideGroup is dedicated entirely to that one slot (never mixed with
  another slot's entries, unlike SONG's shared copyright+lyric group), `entry.order === 0`
  reliably identifies "the first section of this reading" inside `resolveEntryContent`.
- `slideshowAssembler.ts`'s fallback branch already has `localSeq` from `sections.forEach((section,
  localSeq) => ...)` — `localSeq === 0` is the equivalent signal on that path.
- Recommend adding one new optional field to `ScriptureSlide` (e.g. `isFirstSection?: boolean`),
  set to `entry.order === 0` / `localSeq === 0` respectively in both content-resolution paths
  (only meaningful when `section` is also present — a Reference-state slide has no section and no
  meaningful "first" concept).
- `PresentationViewer.vue`: wrap the `presentation-scripture-reference` paragraph in `v-if=
  "!isCongregational || isFirstSection"` (need a new `isFirstSection` computed mirroring
  `isCongregational`'s existing shape).
- `slideDisplay.ts::slideBodyText()`: only prefix `slide.reference` when `!slide.section ||
  slide.isFirstSection` is true; a later section slide's body becomes just its own text +
  attribution suffix (the speaker context is already surfaced separately via
  `slideContentLabel`'s eyebrow / `slideFooterLabel`, both of which already call
  `speakerDisplayName` per-slide regardless of position — these two do NOT need reference-gating,
  only `slideBodyText` does).

### Anti-Patterns to Avoid

- **Re-running `computeBoundaries` on already-sliced/stripped segment text mid-edit.** The whole
  point of the boundary-indexed model (Pattern 1) is that `boundaries` is computed exactly ONCE
  from the untouched `rawText` and threaded through every subsequent operation — this mirrors
  `claudeApi.ts`'s own explicitly-documented invariant #1 ("do not 'simplify' it away"). Recomputing
  boundaries against post-strip text desyncs indices from meaning the same way the AI path's doc
  comments warn against.
- **Treating `splitPassage`'s word-count grouping as a per-verse splitter for the Blank seed.**
  It groups by a 50-word default threshold; for anything longer than a couple of verses it will
  NOT produce one segment per verse, silently failing CONTEXT.md's explicit "every verse its own
  segment" requirement for Blank.
- **Widening `SourceRef.speaker`/`SPLIT_SCHEMA`'s enum without widening `validateSplitResult`'s
  runtime check.** `claudeApi.ts` line ~482 currently hard-checks `speaker !== 'LEADER' && speaker
  !== 'CONGREGATION'` — a schema-level enum widen alone does NOT make this validator accept
  `'ALL'`; both must change together or a model-proposed `'ALL'` segment gets silently discarded
  (the whole result, per this function's documented "one violation discards the entire result"
  contract) even after the type and schema both nominally support it.
- **Skipping `EditSlideDrawer.vue`'s speaker toggle.** It is not named in the UI-SPEC's ripple
  list, but it directly manipulates the same `speaker` field via its own `onSpeakerToggle`
  (`src/components/slides/EditSlideDrawer.vue` ~line 747) and will silently misbehave (ALL →
  LEADER on one click, skipping CONGREGATION) the moment ALL exists in stored data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding legal divider positions in scripture text | A custom regex/parser for "where can a responsive reading break" | `computeBoundaries()` (`scriptureBoundaries.ts`, Phase 34, already handles verse markers + clause-ending punctuation, already excludes commas deliberately per its own Pitfall-4 comment) | Already built, already tuned against real Psalm 136/24 text per the file's own doc comments; re-deriving it risks reproducing tuning mistakes already fixed once |
| Byte-exact text slicing for a segment | String concatenation / manual substring math per segment | `sliceAtBoundaries()` + `stripVerseMarkers()` + `verseRangeForSlice()` (`scriptureBoundaries.ts`, all exported) | These three functions ARE the "encoding backstop" the codebase already built specifically to guarantee character-for-character fidelity against non-ASCII punctuation (curly quotes, em dashes) — a hand-rolled slice risks silently corrupting scripture text |
| AI-gating | A second `aiEnabled` check inside `CongregationalEditor.vue`'s template | The existing module-entry guard in `claudeApi.ts::isAiEnabled()` (called inside `splitCongregationalReading`'s own `try` block) | R088's already-shipped, already-tested single choke point; a UI-only `v-if` without the underlying function-level guard is the exact anti-pattern R088's own pitfall note warns against |
| Speaker-name display strings | Re-deriving "Leader"/"Congregation"/"All" text in multiple components | `speakerDisplayName()` (`slideDisplay.ts`, already the single producer consumed by the rail, grid badge, and `EditSlideDrawer.vue`) | Widening this ONE function's switch to 3 branches propagates to every existing call site automatically — re-deriving the string elsewhere risks a spelling drift the codebase's own doc comments explicitly call out as the reason this function exists |

**Key insight:** Nearly everything this phase needs at the text-processing layer already exists
from Phase 34's AI-split work — the phase is genuinely an *interaction* rework (how a human
invokes these same primitives) more than a text-processing build. The one real gap is the
per-verse "Blank" splitter (Pattern 2), which is small (a simplified sibling of the existing
`parseVerses` internal helper) but does not yet exist anywhere in the codebase.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. `CongregationalSection.speaker`'s
union is *widened* (LEADER | CONGREGATION → LEADER | CONGREGATION | ALL), which is additive and
requires no data migration: existing stored sections only ever contain LEADER/CONGREGATION values,
which remain valid members of the widened union. Confirmed no other code path assumes the union is
exactly 2 values in a way that would break on a third (the two binary-ternary sites —
`PresentationViewer.vue`'s `speakerColorClass`/label and `EditSlideDrawer.vue`'s
`onSpeakerToggle` — are explicitly enumerated in this document precisely because a ternary silently
tolerates a widened union without erroring, it just produces the WRONG answer for the new value,
which is a logic bug to fix, not a data migration to run).

## Common Pitfalls

### Pitfall 1: Recomputing `boundaries` after `rawText` has already been consumed by a seed
**What goes wrong:** A divider inserted by the user lands at the wrong character offset, silently
producing a segment boundary mid-word or mid-verse-number.
**Why it happens:** `computeBoundaries(rawText)` must be computed exactly once per fetch and
threaded through every subsequent divider operation — recomputing it (even against the same
`rawText`) is safe in isolation, but if any intermediate step has mutated or re-derived a
*different* text string (e.g. accidentally passing already-`stripVerseMarkers`'d text back in),
the resulting boundary array silently disagrees with the internal draft's indices.
**How to avoid:** Store `boundaries` as a single `ref` computed once from `rawText` at fetch time,
alongside `rawText` itself, and never call `computeBoundaries` a second time within one fetch's
lifetime.
**Warning signs:** A divider that visually looks like it split "between verse 3 and verse 4" but
the resulting two segments' `verseRange` fields overlap or skip a verse.

### Pitfall 2: The AI seed's return shape doesn't match the internal draft model
**What goes wrong:** If Pattern 1's `DraftSection[]` internal model is adopted, `claudeApi.ts::
splitCongregationalReading` currently returns already-sliced `CongregationalSection[]`, not
boundary indices — plugging its result directly into a boundary-indexed draft without a conversion
step will type-error or silently lose the ability to further sub-divide an AI-produced segment.
**Why it happens:** `claudeApi.ts`'s existing contract was designed before this phase's click-
divider requirement existed; it slices immediately because until now nothing downstream needed the
indices afterward.
**How to avoid:** Either widen `splitCongregationalReading`'s return type to the pre-slice
`SplitSection[]` shape (requires updating its one existing test suite and its JSDoc, which
currently promises `CongregationalSection[] | null`), or accept AI-seeded segments as edit-once
text-only until a first divider operation, at which point re-locate their boundaries by matching
verse numbers back into `boundaries`. State this as an explicit decision point for the plan rather
than defaulting silently to one option.
**Warning signs:** A user picks "Split with AI" then tries to insert a divider inside one of the
AI's segments and nothing happens, or the wrong text moves.

### Pitfall 3: `hasSplittableBoundaries` gates AI-seed AVAILABILITY, not divider availability
**What goes wrong:** Reusing `canAiSplit`'s existing guard (`hasSplittableBoundaries(computeBoundaries
(rawText.value))`, requiring ≥3 boundary entries) to also decide whether the gap-`+` divider UI
renders at all would incorrectly hide ALL divider affordances for a passage with no internal legal
break (a single-verse fetch, e.g. "John 3:16") — but per the UI-SPEC's "populated — zero dividers"
row, the raw fetched passage should STILL render (as one undivided block) even when no split is
possible; there's simply nothing to click.
**Why it happens:** The AI button's existing guard and the divider UI's rendering condition look
similar but answer different questions ("can AI usefully split this" vs. "does a fetched passage
exist to display").
**How to avoid:** Keep `canAiSplit`/`hasSplittableBoundaries` scoped ONLY to the AI seed button's
enabled state (its original, still-correct purpose); gate the divider UI's existence purely on
`rawText.value.length > 0` (a passage has been fetched), independent of whether any internal
boundary exists.
**Warning signs:** A one-verse passage fetch shows no editor content at all instead of one
uneditable/undividable Leader block.

### Pitfall 4: Confusing "Start Blank" with the pre-seed zero-divider state
**What goes wrong:** Building "Start Blank" as merely "don't call any seed function, leave the raw
fetched text as one undivided segment" — which is what the UI-SPEC's "populated — zero dividers"
row describes as the pre-seed state, NOT what CONTEXT.md's Decisions section says Blank must do
("every verse its own segment, all defaulting to Leader").
**Why it happens:** The UI-SPEC's zero-dividers description and CONTEXT.md's Blank-seed
description are easy to conflate at a skim — they describe two different moments (before any seed
is picked, vs. after clicking "Start Blank").
**How to avoid:** Treat "no seed picked yet" (one giant undivided Leader block, dividers optional)
and "Start Blank clicked" (N segments, one per verse, all Leader, ready to re-label) as two
genuinely different states with two different section counts. Building the new `splitPerVerse`
function (Pattern 2) is what distinguishes them.
**Warning signs:** Clicking "Start Blank" on a 20-verse passage produces one segment instead of 20.

### Pitfall 5: `EditSlideDrawer.vue`'s binary toggle silently corrupts an ALL-labeled slide
**What goes wrong:** After this phase ships, opening a materialized ALL-speaker slide in the Edit
Slide Drawer and clicking its (unwidened) speaker toggle flips it straight to LEADER, silently
skipping CONGREGATION — a data-loss-adjacent surprise for a control that looks like a simple
binary switch.
**Why it happens:** `onSpeakerToggle`'s ternary (`section.speaker === 'LEADER' ? 'CONGREGATION' :
'LEADER'`) was written when only two values existed and evaluates any non-LEADER value (now
including ALL) to the false branch.
**How to avoid:** Either widen this control to a proper 3-way cycle/chip (recommended, for
consistency with the divider editor's own chip), or explicitly descope it with a documented reason
if the planner decides per-slide speaker editing outside the divider editor is out of this phase's
scope — but do not leave the binary ternary untouched and unremarked.
**Warning signs:** A code-review or manual test flips a slide from ALL and observes it become
LEADER instead of cycling to CONGREGATION.

## Code Examples

### Existing boundary-slicing pattern (reuse verbatim)

```typescript
// Source: src/utils/scriptureBoundaries.ts (this codebase, Phase 34) — already exported,
// already used by src/utils/claudeApi.ts::splitCongregationalReading
export function sliceAtBoundaries(
  text: string,
  boundaries: number[],
  startBoundary: number,
  endBoundary: number,
): string {
  return text.slice(boundaries[startBoundary], boundaries[endBoundary])
}
```

### Existing 3-way-ready speaker color test pattern (extend, don't replace)

```typescript
// Source: src/components/__tests__/PresentationViewer.test.ts (~line 830-834, this codebase)
// Pattern to extend to 3 values once ALL exists: diff two class lists and assert the ONLY
// difference is the colour class, proving label/size/weight/casing stay identical across roles.
const speaker1Classes = speaker1.classes().slice().sort()
const speaker2Classes = speaker2.classes().slice().sort()
expect(speaker1Classes).toContain('text-sky-300')
expect(speaker2Classes).toContain('text-amber-300')
expect(speaker1Classes.filter((c) => !speaker2Classes.includes(c))).toEqual(['text-sky-300'])
expect(speaker2Classes.filter((c) => !speaker1Classes.includes(c))).toEqual(['text-amber-300'])
// Extend: add a 3rd slide/section and assert its ONE delta is 'text-violet-300'.
```

### Existing AI-off gating pattern (reuse verbatim, do not reimplement)

```vue
<!-- Source: src/components/CongregationalEditor.vue (~line 46, this codebase) -->
<button v-if="authStore.settings.aiEnabled" ...>Split with AI</button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Fetch auto-commits an alternating split; AI is a separate opt-in override | Fetch renders raw text only; three equally-weighted seed buttons (AI/Alternate/Blank) | This phase (R096) | `buildAlternatingSections`'s call site moves from `onFetchPassage` to a new seed-button handler; existing tests asserting fetch auto-splits will need updating |
| Speaker is a binary toggle (click cycles LEADER↔CONGREGATION) | Speaker is a 3-way segmented chip (Leader/Congregation/All) | This phase (R095/UI-SPEC) | Three separate toggle/ternary sites need updating: `CongregationalEditor.vue`'s own toggle, `PresentationViewer.vue`'s label/colour ternary, `EditSlideDrawer.vue`'s drawer toggle |
| Congregational section slides always show reference + speaker | First section slide shows reference; later ones show speaker only | This phase (R097) — **newly built, not merely verified** | Requires a new `isFirstSection`-equivalent field threaded through both content-resolution paths and both render sites (presenter + grid card body text) |

**Deprecated/outdated:** None — no external API or library version changes in this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The AI seed's return type should be widened from `CongregationalSection[]` to the pre-slice `SplitSection[]`-equivalent shape so it fits the recommended internal boundary-indexed draft model | Pattern 2, Pitfall 2 | If the planner instead keeps `splitCongregationalReading`'s current text-returning contract, AI-seeded segments cannot be further sub-divided by the click-divider UI without a separate boundary-re-location step — a real UX gap for the AI path specifically, though Alternate/Blank/hand-edit remain unaffected |
| A2 | `entry.order === 0` reliably means "first section of a congregational reading" because a SCRIPTURE slot's SlideGroup is never shared with another slot's entries | Pattern 3 | Verified true by direct code read of `deriveGroupEntries`'s SCRIPTURE case and `AssemblyInputs.groupsBySlotId` being keyed per-slot — this is HIGH confidence, not a guess, but flagged here since R097's entire fix depends on it |
| A3 | `EditSlideDrawer.vue`'s speaker toggle is in-scope for this phase even though the UI-SPEC does not mention it | Summary, Pitfall 5 | If the planner deliberately descopes it (a legitimate call, since the UI-SPEC is the locked visual contract and doesn't name it), the risk is a known, documented gap rather than a silent one — but leaving it unaddressed AND unremarked would reintroduce the exact "explained away as not a defect" failure pattern CLAUDE.md's storage.rules incident warns against |

## Open Questions

1. **Should `claudeApi.ts::splitCongregationalReading`'s return type change?**
   - What we know: its current contract (`CongregationalSection[] | null`) is documented with two
     explicit "invariants a future editor is most likely to break" — this phase's boundary-indexed
     model is exactly the kind of change those comments warn about touching carefully.
   - What's unclear: whether the planner should widen the return type (cleaner internal model,
     touches a stable/sensitive file) or add a small adapter in `CongregationalEditor.vue` that
     re-locates an AI-returned section's boundaries after the fact (keeps `claudeApi.ts` untouched,
     adds a small amount of re-derivation risk).
   - Recommendation: widen the return type — the file's own doc comments make clear its shape is
     already `{speaker, startBoundary, endBoundary}` internally (`SplitSection`) before the final
     `.map()` call slices it; returning that pre-slice shape (or exporting a second function that
     does) is a small, well-contained change directly in the grain of the existing code, not a
     workaround.

2. **Does `EditSlideDrawer.vue`'s speaker toggle get a 3-way widen in this phase?**
   - What we know: it is a real, already-shipped ripple site the UI-SPEC does not name; Pitfall 5
     documents the concrete bug if left untouched.
   - What's unclear: whether the owner considers post-materialization per-slide speaker editing
     in-scope for "the divider UX rework" or a separate concern belonging to a future phase.
   - Recommendation: widen it to a minimal 3-way cycle (three sequential clicks LEADER→CONGREGATION
     →ALL→LEADER) rather than a full chip, matching its existing compact single-button footprint
     in the drawer, and fix its indigo→sky colour mismatch in the same pass since it is the exact
     defect the UI-SPEC already fixes in `CongregationalEditor.vue`'s own preview.

## Environment Availability

Skipped — this phase has no new external dependencies. It reuses the existing ESV/NLT proxy
functions (already deployed and tested, Phase 45) and the existing Claude API proxy (already
deployed and tested, gated by `authStore.settings.aiEnabled`, Phase 39). No new tool, service, or
CLI is introduced.

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` → treated as enabled per the
default rule.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (installed, `vitest.config.ts` at repo root, `environment: 'jsdom'`) |
| Config file | `vite.config.ts` (app suite `test` block) / `vitest.rules.config.ts` (unrelated, rules-only suite — not touched by this phase) |
| Quick run command | `npx vitest run src/components/__tests__/CongregationalEditor.test.ts src/components/__tests__/PresentationViewer.test.ts` |
| Full suite command | `npx vitest run --dir src --exclude '**/rules.test.ts'` (per CLAUDE.md — bare `npx vitest run` also works; do NOT use `npx vitest run src/`, which picks up `render-service/src/render.test.ts` by substring match and dies on a Vitest version mismatch) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R095 | Clicking a gap `+` inserts a divider, splitting one segment into two, new segment inherits the parent's speaker | unit (component) | `npx vitest run src/components/__tests__/CongregationalEditor.test.ts -t "divider"` | ❌ Wave 0 — new test cases, existing file |
| R095 | Clicking an existing divider merges two segments, keeping the upper segment's speaker | unit (component) | same file, new test case | ❌ Wave 0 |
| R095 | 3-way chip changes a segment's speaker to LEADER/CONGREGATION/ALL independently, including non-adjacent segments (Psalm 136 refrain case) | unit (component) | same file, new test case | ❌ Wave 0 |
| R096 | Three seed buttons render; AI seed hidden when `authStore.settings.aiEnabled` is false; Alternate/Blank remain fully functional with AI off | unit (component) | same file, existing `aiEnabled` gate pattern already present (extend, don't rewrite) | ✅ pattern exists — extend |
| R096 | Re-seeding after `hasManuallyEdited` shows a confirm; first seed pick on an unedited draft applies immediately | unit (component) | same file, new test case | ❌ Wave 0 |
| R096 | `translationSource` stamped once at fetch survives all three seeds and subsequent divider edits without restamping on a setting change | unit (component) | same file, existing `lastFetchedVersion` pattern (extend) | ✅ pattern exists — extend |
| R097 | First congregational section slide shows the reference; later section slides show only the speaker label | unit (component) | `npx vitest run src/components/__tests__/PresentationViewer.test.ts -t "congregational"` | ❌ Wave 0 — this is the gap identified in Pattern 3; the existing 2-slide test at ~line 789 needs a new assertion (reference absent on slide 2), not just a passing one |
| R097 (ALL role, presenter) | ALL-speaker slide renders `All:` in violet, distinct from Leader/Congregation | unit (component) | same file, new test case extending the existing sky/amber diff pattern (see Code Examples) | ❌ Wave 0 |
| R097 (ALL role, grid card) | Grid card / drawer eyebrow and footer label render `ALL`/`All` for an ALL-speaker slide | unit (component) | new/existing `slideDisplay.test.ts` if present, else new file | Need to confirm — check for `slideDisplay.test.ts` during planning |
| R095/R096 (AI seed schema) | `SPLIT_SCHEMA` and `validateSplitResult` accept `'ALL'` as a valid speaker value | unit (util) | existing `claudeApi.test.ts` (confirm filename during planning), new test case | Need to confirm during planning |

### Sampling Rate

- **Per task commit:** the quick run command above (2 targeted files)
- **Per wave merge:** `npx vitest run --dir src --exclude '**/rules.test.ts'` plus `npm run
  type-check`
- **Phase gate:** full suite green (accounting for the documented 2-file baseline —
  `src/storage.rules.test.ts` and `RosterView.test.ts` — before `/gsd-verify-work`)

### Wave 0 Gaps

- [ ] New test cases in `src/components/__tests__/CongregationalEditor.test.ts` for: gap-click
      insert/remove, 3-way chip (incl. non-adjacent shared label), the three seeds as equal
      first-class actions (not auto-fetch), the `hasManuallyEdited` re-seed confirm.
- [ ] New test cases in `src/components/__tests__/PresentationViewer.test.ts` for: R097's
      first-slide-reference/later-slides-speaker-only behavior (this is the one gap that requires
      a genuinely NEW assertion, since today's test only proves the OLD, soon-to-change behavior),
      and the ALL role's third colour.
- [ ] Confirm whether `src/components/slides/__tests__/slideDisplay.test.ts` exists — if not,
      create it to cover `speakerDisplayName`'s 3rd branch and `slideBodyText`'s reference-gating.
- [ ] Confirm the exact filename of `claudeApi.ts`'s existing test suite (referenced but not read
      in this research) and add a case proving `SPLIT_SCHEMA`/`validateSplitResult` accept `'ALL'`.
- [ ] Decide and test `EditSlideDrawer.vue`'s speaker-toggle ripple (Pitfall 5) — either its 3-way
      widen or its explicit descope.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled per the default
rule.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | This phase touches no auth flow — `authStore` is only read for existing settings (`aiEnabled`, `bibleVersion`), never written |
| V3 Session Management | No | Not touched |
| V4 Access Control | No (indirect only) | `CongregationalEditor.vue` remains a controlled prop/emit component; write authorization is enforced by the parent's existing Firestore rules on `ScriptureSlot`, unchanged by this phase |
| V5 Input Validation | Yes | The click-divider mechanism must only ever produce boundary indices drawn from `computeBoundaries(rawText)` — never an arbitrary user-supplied offset — preserving the exact structural guarantee `scriptureBoundaries.ts`'s own doc comments describe for the AI path ("a mid-sentence split... cannot be expressed... by construction"). The widened `SPLIT_SCHEMA`/`validateSplitResult` must reject any speaker value other than the 3 allowed literals, exactly as today's binary check does |
| V6 Cryptography | No | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A malformed/adversarial AI response introducing an out-of-range or off-boundary index | Tampering | Already mitigated by `validateSplitResult`'s existing range/adjacency/coverage checks (`claudeApi.ts` ~line 439-490) — widening the speaker enum must not weaken these numeric checks; the widened enum check (`speaker !== 'LEADER' && speaker !== 'CONGREGATION' && speaker !== 'ALL'`) is additive, not a relaxation |
| A hand-crafted click-divider index bypassing `boundaries` (e.g. a compromised/modified client bundle) | Tampering | Not a realistic new attack surface introduced by this phase — the editor is a controlled, client-side-only draft; the actual write to Firestore still goes through the parent's existing rules-enforced `ScriptureSlot` update path, unchanged by this phase. No new trust boundary is crossed |
| Scripture text corruption via a hand-rolled slice/strip implementation (regex or substring bugs) | Tampering (data integrity) | Reuse `sliceAtBoundaries`/`stripVerseMarkers` verbatim (see Don't Hand-Roll) — these are the codebase's existing "encoding backstop," already reviewed for exactly this concern |

## Sources

### Primary (HIGH confidence — direct source reads this session)
- `src/components/CongregationalEditor.vue` — current component being reworked, read in full
- `src/utils/scriptureBoundaries.ts` — `computeBoundaries`, `sliceAtBoundaries`,
  `stripVerseMarkers`, `verseRangeForSlice`, `embedBoundaryMarkers`, read in full
- `src/utils/scriptureSplitter.ts` — `splitPassage`, `parseVerses`, read in full
- `src/utils/claudeApi.ts` — `splitCongregationalReading`, `SPLIT_SCHEMA`, `validateSplitResult`,
  `isAiEnabled`, read in relevant sections
- `src/types/slide.ts` — `CongregationalSection`, `ScriptureSlide`, read in relevant sections
- `src/types/slideGroup.ts` — `SourceRef`, `GroupSlideEntry`, read in relevant sections
- `src/components/PresentationViewer.vue` — `isCongregational`, `speakerColorClass`, scripture
  template block, read in relevant sections
- `src/components/slides/slideDisplay.ts` — `speakerDisplayName`, `slideBodyText`,
  `slideContentLabel`, `slideFooterLabel`, read in relevant sections
- `src/components/slides/EditSlideDrawer.vue` — `onSpeakerToggle`, `sectionFromEntry`,
  `scripturePassageText`, read in relevant sections
- `src/utils/slideshowAssembler.ts` — `resolveEntryContent`, SCRIPTURE fallback branch, read in
  relevant sections
- `src/utils/slideGroupMaterializer.ts` — `deriveGroupEntries` SCRIPTURE case, `sourceSignature`,
  read in relevant sections
- `src/utils/scripture.ts` — `congregationalSectionsFromSlot`, `congregationalSectionFromRef`,
  `scriptureRefFromSlot`, read in relevant sections
- `src/utils/nltApi.ts` — `stripNltHtml`, confirming NLT text shares ESV's `[N]` verse-marker
  format that `computeBoundaries` depends on, read in full
- `src/components/__tests__/CongregationalEditor.test.ts` — existing test patterns/mocks, read in
  relevant sections
- `src/components/__tests__/PresentationViewer.test.ts` — existing congregational-render test
  assertions, read in relevant sections
- `package.json` — confirmed installed dependency versions (vue, pinia, typescript, vitest)
- `.planning/config.json` — confirmed `nyquist_validation`/`security_enforcement` are absent
  (both default to enabled)

### Secondary (MEDIUM confidence)
- `.planning/phases/47-congregational-reading-divider-ux/47-CONTEXT.md` — locked user decisions
  (owner-authored via autonomous discuss-phase, not independently re-verified against a live
  human this session, but treated as authoritative per the phase constraints)
- `.planning/phases/47-congregational-reading-divider-ux/47-UI-SPEC.md` — locked visual/interaction
  contract, generated by gsd-ui-researcher (same provenance caveat as CONTEXT.md)
- `.planning/research/FEATURES.md` § 1 — prior research session's interaction-pattern survey
  (subtitle-editor analog, pattern rejections) — this session's job was to verify it against the
  actual codebase, which it does

### Tertiary (LOW confidence)
- None used this session — all claims trace to either direct source reads or the two locked
  phase-scoping documents.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every existing dependency version confirmed by
  direct `package.json` read
- Architecture: HIGH — the boundary-indexed model, the three-seed gap analysis, and the R097
  finding are all traced through actual source code, not inferred from documentation
- Pitfalls: HIGH — all five pitfalls are grounded in specific line-numbered code, not generic
  domain knowledge
- R097 gap finding: HIGH confidence that it is a real, currently-unimplemented gap — verified by
  reading the actual template conditionals in `PresentationViewer.vue`, the actual field
  population in both `slideGroupMaterializer.ts` and `slideshowAssembler.ts`, and the actual
  existing test assertions in `PresentationViewer.test.ts` (which prove the current behavior,
  not the R097 behavior)

**Research date:** 2026-08-08
**Valid until:** 2026-09-07 (30 days — stable, no fast-moving external dependency in this phase's
scope; re-verify sooner only if Phase 45/46 code changes land on the same files before this phase
executes)
