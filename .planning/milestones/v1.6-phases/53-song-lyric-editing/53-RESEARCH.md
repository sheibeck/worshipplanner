# Phase 53: Song Lyric Editing - Research

**Researched:** 2026-08-11
**Domain:** Vue 3 SPA — pure song pool/order model, the slide assembler seam, Firestore-persisted additive schema
**Confidence:** HIGH (all findings verified against live source with file:line evidence)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **R117** — A split is an internal slide-boundary structure on the ONE `LyricSection`, NOT multiple
  sections. Add an optional additive field to `LyricSection` dividing its `lines` into consecutive
  slide groups. Absent field = one slide (backward compatible). One-section-per-split is what makes
  R118 and R120 automatic.
- **R118** — Falls out of the R117 model: `duplicateRow` duplicates the section-id reference; the
  pooled section (with its split) is shared, so the duplicate shows the same multi-slide unit. Confirm
  the assembler emits every split slide on BOTH the first and the duplicated occurrence. No change to
  `duplicateRow` expected.
- **R119** — Add `'Pre-Chorus'` to `ADD_SECTION_KINDS` and every other place kinds are enumerated.
- **R120** — Derive the displayed number per KIND by position at render time, not from a stored suffix.
  First Verse = "Verse 1"; a Verse added after two existing Verses = "Verse 3"; both slides of a split
  "Verse 1" stay "Verse 1"; nothing unnumbered. Research chooses parse-label vs `kind` field, lowest
  risk that keeps existing pasted data correct.
- **R121** — Paste commit button reads "Save" when the song has no existing lyrics; keep a
  replace-style label when lyrics already exist.
- **Backward compatibility** — Treat ALL `LyricSection`/`SongLyrics` model changes as additive and
  optional (default-absent, read-time tolerant), NO destructive migration. Do NOT assume greenfield —
  v1.4/v1.5 shipped to production 2026-08-10. A numbering change must not rewrite stored `label`.

### Claude's Discretion
- Exact split representation (`slideBreaks: number[]` vs slides array), the R120 kind-source choice
  (parse-label vs `kind` field), the precise split UI affordance, and the R121 label for the
  existing-lyrics case — subject to: one-section-per-split (R118/R120 must not regress),
  additive/optional model changes (no migration), type-check clean, assembler emits correct N slides.

### Deferred Ideas (OUT OF SCOPE)
- AI-assisted / automatic slide splitting. v1.6's split is MANUAL only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R117 | Any lyric item can be manually split into multiple slides (user chooses line breaks) | Additive `slideBreaks?: number[]` on `LyricSection`; pure slicing helper in `songSectionOrder.ts`; assembler seam resolves it live (§Assembler Seam, §Split Representation) |
| R118 | Duplicating a split item duplicates the whole multi-slide unit | Automatic — `performanceOrder` repeat → two stored lyric entries → each resolves live to N split slides. No `duplicateRow` change (§Assembler Seam → R118) |
| R119 | Pre-Chorus is an addable item type alongside Verse/Chorus | Add `'Pre-Chorus'` to `ADD_SECTION_KINDS`; CCLI parser ALREADY recognizes it; slugs cleanly to `pre-chorus` (§R119) |
| R120 | Sections numbered by position among same-kind; split slides share the one number; none unnumbered | Render-time derivation in `buildSectionRows`; parse kind from label; leaves stored `label` untouched (§R120) |
| R121 | First-paste commit button reads "Save" not "Replace Lyrics" | Derive from `currentSectionCount === 0` in `LyricPasteRegion.vue` (§R121) |
</phase_requirements>

## Summary

Phase 53 extends the Phase 28 pool/order song model with four additive, non-destructive capabilities.
The single load-bearing question — where a `LyricSection` becomes slides — resolves cleanly: **the split
is authored as additive metadata on the lyrics document and resolved LIVE at slide-assembly time**,
never baked into the stored slide-group structure. This mirrors the codebase's own R105 synthetic
reference-slide precedent (`${slot.id}:ref`, emitted at assembly, not stored) and the D-02 contract
that editing a song's lyrics changes assembled output with no group write. The consequence is that the
stored slide-group model (`deriveGroupEntries`, `rebuildSongGroup`, `carryStoredDerivedEntries`,
`sourceSignature`) needs **zero change**, R118 duplication works for free, and changing a split needs no
group rewrite.

The other four requirements are small and low-risk. R119's Pre-Chorus is already recognized by the CCLI
parser — only the editor palette (`ADD_SECTION_KINDS`) must add it. R120's "unnamed Verse" bug is a
real defect in `addSection`/`uniqueSectionLabel`, fixed by deriving the displayed number per-kind by
position in `buildSectionRows` (leaving stored labels untouched). R121 is a one-line label swap driven
by the already-passed `currentSectionCount` prop.

**Backward-compat verdict: production song-lyric data almost certainly EXISTS** (the editor is fully
wired and reachable, writing to a live Firestore subcollection, and shipped in v1.2/v1.3, well before
the v1.4/v1.5 production deploys of 2026-08-10). Every model change in this phase is additive-optional
and read-tolerant, with no migration and no change to how an existing song's stored data renders.

**Primary recommendation:** Add `slideBreaks?: number[]` to `LyricSection`; add one pure slicing helper
`sliceSectionIntoSlides(section)` to `songSectionOrder.ts`; consume it at the TWO in-lockstep lyric
emission sites in `assembleSlideshow` (stored-group path + fallback path). Leave the slide-group
materializer, `rebuildSongGroup`, and `sourceSignature` untouched.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Authoring a split (choose line breaks) | Browser / Vue editor (`SongLyricEditor.vue`) | — | User interaction; mutates the reactive `editableState` through pure helpers |
| Persisting a split | Firestore (`.../songs/{id}/lyrics`) | — | Additive optional field on the canonical lyrics doc; schemaless, no migration |
| Split → N slides at presentation | Pure assembler (`slideshowAssembler.ts`) | — | D-02: resolved live from lyrics, not stored; the single presentation source of truth |
| Position numbering (R120) | Pure model (`songSectionOrder.ts::buildSectionRows`) | Vue editor (renders derived label) | Derivation is pure and shared; render-time only, stored label untouched |
| Pre-Chorus kind (R119) | Pure model (`ADD_SECTION_KINDS`) | CCLI parser (already done) | Kind enumeration is a single const; parser already recognizes it |
| First-paste button label (R121) | Vue component (`LyricPasteRegion.vue`) | — | Pure presentation; driven by existing `currentSectionCount` prop |

## Standard Stack

No new libraries. Everything lands in existing modules. [VERIFIED: codebase]

| Module | Role in this phase |
|--------|--------------------|
| `src/types/songLyrics.ts` | Add `slideBreaks?: number[]` to `LyricSection` (additive) |
| `src/utils/songSectionOrder.ts` | New pure `sliceSectionIntoSlides()` + R120 kind derivation in `buildSectionRows` |
| `src/utils/slideshowAssembler.ts` | THE seam — consume the slicing helper at both lyric-emission sites |
| `src/components/SongLyricEditor.vue` | Split UI, derived-label display, add Pre-Chorus palette entry |
| `src/components/LyricPasteRegion.vue` | R121 button label |
| `src/utils/ccliParser.ts` | Pre-Chorus already recognized — NO change needed |

### Installation
None. Pure Vue/TypeScript client changes only.

## Package Legitimacy Audit

N/A — this phase installs no external packages. All work lands in existing first-party modules.

## Architecture Patterns

### System Architecture Diagram — how a song section becomes slides today (and where the split hooks)

```
                            SONG EDITING                          PRESENTATION / SLIDES TAB
                            ───────────                           ─────────────────────────

  SongLyricEditor.vue                             assembleSlideshow(service, inputs)   [slideshowAssembler.ts]
    editableState { sections[], performanceOrder }        │
        │  (autosave, one write)                          ├─ slot HAS a materialized group? ─────────────┐
        ▼                                                 │                                              │
  Firestore: organizations/{org}/songs/{id}/lyrics        │   YES (stored-group path)      NO (fallback path)
    SongLyrics { sections[], performanceOrder[], ... }    │        │                             │
        │                                                 │        ▼                             ▼
        └──────── loaded into inputs.songLyricsById ──────┤   for each group.slides entry    for each sectionId
                                                          │   (sorted by .order):            in performanceOrder:
                                                          │        │                             │
                                                          │   resolveEntryContent()          build LyricSlide inline
                                                          │   lyric →  lines: section.lines  lines: section.lines
                                                          │        │  (slideshowAssembler     (slideshowAssembler
                                                          │        │   .ts:178-190)            .ts:537-547)
                                                          │        ▼                             ▼
                                                          │   emitFromGroup()  id=entry.id   emitFallback() id=slot.id:seq
                                                          │        │                             │
                                                          └────────┴──────────► AssembledSlide[] ┘
                                                                                       │
                                    ┌──────────────────────────────────────────────────┤
                                    ▼                                                  ▼
                            PresentationViewer                                 SlideGrid.vue (Slides tab)
                            (projector)                                        renders props.assembledSlideshow
                                                                               (SlideGrid.vue:555, :1059)

  ▓▓▓ THE SPLIT SEAM ▓▓▓  Both emission sites currently do `lines: section.lines` → ONE slide per section.
  Change: replace `section.lines` with `sliceSectionIntoSlides(section)` → 1..N line-groups → N slides.
  Split ids: `${entry.id}:${i}` (stored path) / incremented localSeq (fallback). NO group model change.
```

### Pattern 1: Split resolved LIVE at assembly, never stored in the group (RECOMMENDED)
**What:** `slideBreaks` lives only on the lyrics document. The slide-group's stored structure keeps
exactly one `lyric` entry per section occurrence (unchanged). The assembler slices that one entry's
section into N slides at emit time.
**When to use:** Always, for this phase.
**Why:** This is the D-02 contract already governing songs — "editing a song's lyrics changes the
assembled text with no group write" (`slideshowAssembler.ts:16-21`). It means:
- `deriveGroupEntries` (SONG case, `slideGroupMaterializer.ts:53-80`), `rebuildSongGroup`,
  `carryStoredDerivedEntries`, and `sourceSignature` need **no change**.
- **R118 is automatic:** a duplicate adds the section id twice in `performanceOrder`
  (`duplicateRow`, `songSectionOrder.ts:185`) → `deriveGroupEntries` emits two `lyric` entries (one per
  occurrence, positionally consumed by `rebuildSongGroup:699-717`) → each resolves LIVE to N split
  slides with distinct ids (`${entryA.id}:i` vs `${entryB.id}:i`). Both occurrences show the full
  multi-slide unit.
- **Changing a split needs no group write.** `sourceSignature`'s SONG case
  (`slideGroupMaterializer.ts:177-190`) already keys only on section text, not on breaks — so a
  break-only edit leaves the signature unchanged, no rebuild fires, and the live assembly picks up the
  new breaks immediately. This is correct and requires no signature change.

**Precedent in-repo:** R105's dedicated leading reference slide is synthesised at assembly time with a
suffix id `${slot.id}:ref` and is explicitly NOT a stored `GroupSlideEntry`
(`slideshowAssembler.ts:455-497`). Split slides use the same "synthesise at assembly, suffix the id"
technique.

**Example (stored-group path — slideshowAssembler.ts entry loop, ~:513):**
```typescript
// Source: current code at slideshowAssembler.ts:513-518 (to be modified)
const orderedEntries = [...group.slides].sort((a, b) => a.order - b.order)
for (const entry of orderedEntries) {
  if (entry.sourceRef.kind === 'lyric') {
    const lyrics = inputs.songLyricsById.get(entry.sourceRef.songId)
    const section = lyrics?.sections.find((s) => s.id === entry.sourceRef!.sectionId)
    if (!section) continue
    const slideLineGroups = sliceSectionIntoSlides(section)   // NEW pure helper, 1..N groups
    slideLineGroups.forEach((lines, i) => {
      const content: Omit<LyricSlide, 'id' | 'position'> = {
        contentKind: 'lyric', sectionId: section.id, sectionLabel: section.label, lines,
      }
      // One group → keep entry.id byte-identical (backward compatible). N groups → suffix.
      const slideId = slideLineGroups.length === 1 ? entry.id : `${entry.id}:${i}`
      emitFromGroup(slot, index, group, entry, content, slideId)  // thread id override
    })
    continue
  }
  const content = resolveEntryContent(slot, entry, inputs)
  if (!content) continue
  emitFromGroup(slot, index, group, entry, content)
}
```
The fallback SONG path (`slideshowAssembler.ts:537-547`) applies the same slicing, emitting one
`emitFallback` per line-group with the already-incrementing `localSeq` (ids stay distinct/stable).

### Anti-Pattern to Avoid: baking the split into the stored group
- **Emitting N `lyric` entries per section in `deriveGroupEntries` (with a `slideIndex` on the
  `SourceRef`):** REJECTED. It forces a `SourceRef` type change, a new identity key
  (`sectionId + slideIndex`) throughout `rebuildSongGroup`/`carryStoredDerivedEntries`, a
  `sourceSignature` change, and a group rewrite whenever a break moves. The live-assembly approach
  achieves the same rendered output with none of that churn and preserves D-02.

### Recommended touch map
```
src/types/songLyrics.ts               # + slideBreaks?: number[] on LyricSection
src/utils/songSectionOrder.ts         # + sliceSectionIntoSlides(); + deriveSectionKind() + numbering in buildSectionRows
src/utils/slideshowAssembler.ts       # THE SEAM: slice at both lyric-emission sites; thread slide-id override into emitFromGroup
src/components/SongLyricEditor.vue     # split UI; render derived label; add 'Pre-Chorus' (via ADD_SECTION_KINDS)
src/components/LyricPasteRegion.vue    # R121 button label from currentSectionCount === 0
```

## The Assembler Seam (highest priority — definitive answer)

### The current 1-section → 1-slide mapping (cited)
1. **Stored-group derivation** — `slideGroupMaterializer.ts::deriveGroupEntries`, SONG case, lines
   **53-80**: for each `sectionId` in `lyrics.performanceOrder` it pushes exactly ONE entry
   `{ kind: 'lyric', songId, sectionId }` (lines **67-75**), bracketed by leading/trailing copyright.
2. **Stored-group content resolution** — `slideshowAssembler.ts::resolveEntryContent`, `case 'lyric'`,
   lines **178-190**: resolves that one entry to ONE `LyricSlide` with `lines: section.lines` (line
   **187**). The entry loop at **513-518** emits exactly one slide per entry via `emitFromGroup`
   (**407-453**), keying the slide id on `entry.id` (**433-435**, Phase 23 WR-02).
3. **Fallback (no materialized group)** — `slideshowAssembler.ts`, SONG case, lines **524-551**: one
   `emitFallback` per `sectionId` with `lines: section.lines` (**540-546**), id `${slot.id}:${localSeq}`.

`SlideGrid.vue` (the Slides tab) renders from `props.assembledSlideshow`
(`SlideGrid.vue:555`, comment at `:1059`), i.e. the output of `assembleSlideshow`. So splitting at the
assembler makes the Slides-tab grid AND the projector both show N tiles — no separate grid change.

### The single seam to change
**One conceptual seam = the lyric-slide emission in `assembleSlideshow`, realised at two call sites
that must stay in lockstep** (the same dual-path discipline the D1 scripture congregational work
established — stored-group path and fallback path must "agree slide-for-slide", see the comment at
`slideshowAssembler.ts:556-565`):

- **Stored-group path:** the `entry` loop at `slideshowAssembler.ts:513-518` + `emitFromGroup`
  (`:407-453`). A `lyric`-kind entry slices its section and emits 1..N slides.
- **Fallback path:** the SONG case at `slideshowAssembler.ts:537-547`. Same slicing, per line-group.

Both back onto **one pure helper** `sliceSectionIntoSlides(section): string[][]` in
`songSectionOrder.ts`. This is the only place the split's meaning is defined.

### Split slide id contract (WR-02 safe)
- 1 group (no split, the default and every existing song): keep `entry.id` verbatim (stored path) /
  existing `localSeq` (fallback). **Byte-identical to today** — no existing test or media key changes.
- N groups: `${entry.id}:${i}` (stored) — unique, stable across recomputes (`entry.id` is stable,
  `i` positional). All split slides of one section share the same resolved group media
  (`resolveEntryMedia(group, entry, song)`, `:430`), so the section's background/bed audio stays
  continuous across the split (audio keys on `group:{groupId}:{url}`, not slide id — see
  `slideshowAssembler.ts:469-497`). This matches the desired behavior: a split is one visual unit.
- Songs are read-only in the Slides tab (R054), so the `SlideGrid` `selectedEntry` direct-id lookup
  (`SlideGrid.vue:355-357`) never needs to resolve a `${entry.id}:${i}` split id to a `GroupSlideEntry`
  — the "synthetic id has no entry counterpart" case is already anticipated there (comment `:346-352`).

## Split Representation (R117)

**Recommended field:** add to `LyricSection` (`src/types/songLyrics.ts:14-21`):
```typescript
export interface LyricSection {
  id: string
  label: string
  lines: string[]
  /**
   * Optional manual slide-split (R117). Sorted, de-duped LINE indices `k`
   * (1 ≤ k ≤ lines.length - 1) each meaning "a new slide begins before lines[k]".
   * Absent or empty ⇒ the section is one slide (today's behavior). Additive and
   * read-tolerant: out-of-range or unsorted values are ignored by
   * sliceSectionIntoSlides, so a corrupt/legacy value can never throw.
   */
  slideBreaks?: number[]
}
```

**Why `slideBreaks: number[]` (break indices) over a `slides: string[][]` array:** the section's
`lines` stays the single canonical text (mirrors the scripture model's "the untouched text is the only
slicing source"). A slides array would duplicate the words and create a second source of truth that can
drift from `lines`; textarea edits in the editor (`SongLyricEditor.vue:186-192`, which writes
`section.lines`) would have to reconcile into it. Break indices are additive metadata over the existing
`lines` and need no reconciliation.

**Reuse of scripture Phase 34 helpers — verdict: parallel song-specific helper, do NOT reuse.**
`scriptureBoundaries.ts::computeBoundaries`/`sliceAtBoundaries` (`src/utils/scriptureBoundaries.ts:41-118`)
operate on CHARACTER offsets into a single passage STRING (the byte-exactness backstop for ESV text).
Songs split between whole LINES of a `string[]`, not at character positions, and there is no
byte-exactness contract to protect. The concepts are analogous (sorted boundary indices, absent =
no split, out-of-range tolerance) but the data types differ, so a small parallel helper is cleaner than
generalizing the char-offset code. [VERIFIED: codebase]

**The pure slicing helper (new, in `songSectionOrder.ts`):**
```typescript
// Pure — the ONLY definition of what a split means. Shared by the editor and both assembler paths.
export function sliceSectionIntoSlides(section: LyricSection): string[][] {
  const n = section.lines.length
  const breaks = (section.slideBreaks ?? [])
    .filter((k) => Number.isInteger(k) && k >= 1 && k < n)   // read-tolerant clamp
    .sort((a, b) => a - b)
  const unique = [...new Set(breaks)]
  if (unique.length === 0) return [section.lines]            // default: one slide
  const groups: string[][] = []
  let start = 0
  for (const k of unique) { groups.push(section.lines.slice(start, k)); start = k }
  groups.push(section.lines.slice(start))
  return groups
}
```

**Split UI affordance (Claude's discretion):** the editor already renders each expanded section's lines
in a single textarea (`SongLyricEditor.vue:185-193`). The lowest-friction affordance is click-between-line
dividers over a per-line rendering when a section is expanded — the same interaction the congregational
scripture editor ships (referenced in CONTEXT). The planner owns the exact UI; the data contract above is
what matters for the seam.

## R120 — Position Numbering (kind-source decision)

### Root cause (confirmed)
`addSection` (`songSectionOrder.ts:231-249`) labels via `uniqueSectionLabel(kind, existingLabels)`
(`:285-293`), which returns the **bare** kind when that exact string is unused. After a CCLI paste the
labels are "Verse 1"/"Verse 2" (parser `normaliseLabel`, `ccliParser.ts:46-55`), so "Verse" is free and
the first added Verse is stored/displayed as bare "Verse" — the owner's "unnamed/misnumbered" bug.
The editor displays the raw stored label (`SongLyricEditor.vue:120` and repeat at `:155`,
`row.section.label.toUpperCase()`). [VERIFIED: codebase]

### Decision: parse the kind from the label (option a) — NOT a `kind` field
- **Parse-from-label** derives the kind purely at render time and leaves stored `label` untouched —
  exactly the backward-compat requirement. Existing pasted songs have NO `kind` field, so option (b)
  would still need this same parse as a read-time fallback for every existing section; adding a stored
  field buys nothing and adds a write surface. Choose (a).
- **Derivation:** `deriveSectionKind(label) = label.replace(/\s+\d+$/, '').trim()`. Verified against all
  real labels: "Verse 1"→"Verse", "Chorus"→"Chorus", "Pre-Chorus"→"Pre-Chorus", "Pre-Chorus 2"→
  "Pre-Chorus", "Bridge"/"Tag"/"Ending" unchanged, bare "Verse" (the bug)→"Verse", "Section 1"→
  "Section". CCLI uses arabic numerals only (`SECTION_HEADER_RE`, `ccliParser.ts:9-10`), so a trailing
  `\s+\d+` strip is reliable; no roman-numeral handling needed.

### Where the derivation lives
In `buildSectionRows` (`songSectionOrder.ts:73-113`), which already computes per-row `position`,
`isRepeat`, and `repeatOfPosition`. Add a per-kind ordinal assigned on a section's FIRST occurrence and
reused by repeats (`isRepeat` rows already carry the section by reference), exposing a new
`SectionRow.displayLabel` (e.g. `"Verse 3"`). Because a split is within ONE section, both split slides
share that section's single number automatically — no extra logic. Sketch:
```typescript
// inside buildSectionRows, alongside the existing occurrence bookkeeping
const kindOrdinals = new Map<string, number>()        // kind -> count of UNIQUE sections seen
const numberBySectionId = new Map<string, number>()
// on a NON-repeat row:
const kind = deriveSectionKind(section.label)
const nextOrdinal = (kindOrdinals.get(kind) ?? 0) + 1
kindOrdinals.set(kind, nextOrdinal)
numberBySectionId.set(sectionId, nextOrdinal)
// displayLabel = `${kind} ${numberBySectionId.get(sectionId)}`  (repeats reuse the stored number)
```
The editor renders `row.displayLabel` at `SongLyricEditor.vue:120` and `:155` instead of
`row.section.label`. **Everything numbered** ("nothing left unnumbered"): a lone Chorus shows
"Chorus 1".

### Scope guard (backward-compat)
Recommend R120 changes only the **editor display**. The projected slide `sectionLabel` still comes from
the stored `label` (`slideshowAssembler.ts:186`, `:544`), so **no existing song's rendered/stored output
changes**. If the owner later wants projected labels renumbered too, the same pure `deriveSectionKind`
helper can be applied at assembly — flagged as an owner decision, not done by default (it would alter how
existing songs project). `addSection` may optionally also seed a correctly-numbered stored label for new
sections, but the render-time derivation is authoritative and makes that cosmetic.

## R119 — Pre-Chorus (enumeration audit)

Every place a kind is enumerated:
1. **`ADD_SECTION_KINDS`** (`songSectionOrder.ts:15`) — currently `['Verse','Chorus','Bridge','Tag','Ending']`.
   **ADD `'Pre-Chorus'`.** This is the editor palette source (`SongLyricEditor.vue:216` `v-for="kind in
   ADD_SECTION_KINDS"`), so the button appears automatically. `AddSectionKind` union (`:17`) widens
   automatically.
2. **CCLI parser** — ALREADY recognizes Pre-Chorus in `SECTION_HEADER_RE` (`ccliParser.ts:9-10`) and
   `PAREN_MARKER_RE` (`:16-17`), and `normaliseLabel` title-cases `pre-chorus`→`Pre-Chorus`
   (`:46-55`). **No change.** [VERIFIED: codebase]
3. **Numbering kind list (R120)** — `deriveSectionKind` is regex-based, no hard-coded kind list, so
   "Pre-Chorus"/"Pre-Chorus 2" derive correctly with no enumeration to update.

**Slug check:** `mintSectionId('Pre-Chorus', …)` → `slugifyLabel` (`songSectionOrder.ts:256-258`) =
`'pre-chorus'.trim().toLowerCase().replace(/\s+/g,'-')` = **`pre-chorus`** (no whitespace; existing
hyphen preserved). Matches the CCLI parser's `slugify` (`ccliParser.ts:35-40`), so a hand-added
Pre-Chorus and a pasted one share id `pre-chorus`. Clean. [VERIFIED: codebase]

## R121 — First-Paste Button Label

`LyricPasteRegion.vue` is mounted by `SongLyricEditor.vue:257-264` with props `songId`, `orgId`,
`currentSectionCount` (`:261`, = `sectionRows.length`). The commit button is at
`LyricPasteRegion.vue:103-110`; label at `:110` `{{ isSaving ? 'Saving...' : 'Replace lyrics' }}`.

**Recommendation:** derive "new song" from the ALREADY-passed `currentSectionCount` — **no new prop
needed**. Change `:110` to:
```
{{ isSaving ? 'Saving...' : (currentSectionCount === 0 ? 'Save' : 'Replace lyrics') }}
```
`currentSectionCount === 0` is exactly "first-time paste": the empty-state paste CTA
(`SongLyricEditor.vue:60-65`) is the only way to reach the paste region with no sections, and the
"Paste lyrics" header button (`:14-27`) only renders when `currentLyrics` exists (sections present). An
explicit `isNewSong`/`hasExistingLyrics` prop is an equally valid alternative (Claude's discretion) but
buys no correctness over the derived form. Consider hiding/softening the "Replaces the current 0
sections" helper span (`:95`) when count is 0 — minor, planner's call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide order & repeats | A second order list / copy-on-duplicate | Existing `performanceOrder` + `duplicateRow` (`songSectionOrder.ts:185`) | D-02 reference model already gives R118 for free |
| Making a split render N slides | New stored group entries per split slide | Live slicing in `assembleSlideshow` (this seam) | Preserves D-02, zero group-model churn, no rebuild-on-break-edit |
| Split slide ids | Ad-hoc unique ids | `${entry.id}:${i}` suffix (R105 `:ref` precedent) | Stable, WR-02-safe, byte-identical when unsplit |
| Kind of a section | New stored `kind` field + migration | `deriveSectionKind(label)` regex | Existing data has no field; parse works for all real labels; no migration |
| Pre-Chorus parsing | New parser rule | Already in `SECTION_HEADER_RE`/`PAREN_MARKER_RE` | Parser already ships it |

**Key insight:** the pool/order + live-assembly architecture was built so that section-level edits never
touch the stored slide group. R117–R120 fit that grain exactly; fighting it (baking splits into groups,
storing kinds) reintroduces the migration/rebuild complexity the model was designed to avoid.

## Common Pitfalls

### Pitfall 1: Regenerating a split slide's id per render
**What goes wrong:** `PresentationViewer` keys media children on slide id (Phase 23 WR-02). A
non-deterministic split id churns Vue keys and leaks/reinits media state.
**How to avoid:** derive the id positionally as `${entry.id}:${i}` (stored) / incrementing `localSeq`
(fallback). Never `crypto.randomUUID()` at emit time. **Warning sign:** a split song slide's background
image or audio flickers/reloads on unrelated re-renders.

### Pitfall 2: Diverging the two assembler paths
**What goes wrong:** applying the slice only on the stored-group path leaves a song rendering
differently before vs after its group materializes (the exact failure the D1 scripture comment guards
against, `slideshowAssembler.ts:556-565`).
**How to avoid:** both `:513-518` and `:537-547` call the same `sliceSectionIntoSlides`. Add a test that
asserts the two paths emit the same slide count/lines for a split section.

### Pitfall 3: Numbering off the global row position instead of per-kind
**What goes wrong:** reusing `SectionRow.position` (global 1..N, `songSectionOrder.ts:92`) as the number
gives "Verse 4" when a verse is the 4th ROW regardless of kind.
**How to avoid:** count UNIQUE sections **per derived kind**, assign on first occurrence, reuse for
repeats. **Warning sign:** a Chorus between two Verses bumps the next Verse's number.

### Pitfall 4: Rewriting stored labels for numbering
**What goes wrong:** persisting derived "Verse 3" back into `label` mutates existing production songs
and changes projected output.
**How to avoid:** derivation is render-time only; stored `label` is never written by R120.

### Pitfall 5: Out-of-range / stale `slideBreaks` after a text edit
**What goes wrong:** a break index `k` that exceeds `lines.length` after lines are deleted would slice
into emptiness.
**How to avoid:** `sliceSectionIntoSlides` clamps (`k >= 1 && k < n`) and ignores invalid values — the
read-tolerance the backward-compat rule requires. The editor should also drop now-invalid breaks when
lines are edited (planner detail), but the helper never trusts the input.

## Backward Compatibility (definitive verdict)

**Does production song-lyric data exist? — Almost certainly YES.**
Evidence (cannot query production, so reasoned from the code and shipping history):
- The lyric editor is **fully wired and reachable**: `SongsView.vue` → `SongTable.vue` →
  `SongSlideOver.vue` → `SongLyricEditor.vue`, with `LyricPasteRegion.vue` writing through
  `useSongLyricsStore().saveLyrics` to the live Firestore subcollection
  `organizations/{orgId}/songs/{songId}/lyrics` (`src/stores/songLyrics.ts:43,77,97`). [VERIFIED: codebase]
- The pool/order lyrics model shipped in **v1.2 Phase 18** (song lyric slides + editor) and was reworked
  in **v1.3 Phase 28** — both well before the **v1.4/v1.5 production deploys of 2026-08-10** (CLAUDE.md
  documents live production: `worship-planner-bc515`, deployed `storage.rules`, real PPTX imports).
- Real test fixtures exercise saved lyrics (`SongLyricsTab.r035.test.ts`, `SongLyricEditor.test.ts`,
  `LyricPasteRegion.test.ts`).
- **D-19's "greenfield / no read-time fallback" applies to the SLIDE-GROUP area** (the Slides tab, which
  had never shipped when D-19 was recorded — STATE.md §"No legacy compatibility anywhere in the slide
  area"), **NOT to the lyrics documents themselves.** Lyrics docs predate and outlive that boundary.

**Therefore treat lyrics documents as containing real user data.**

### Safe change shape
- **Additive optional fields only.** `slideBreaks?: number[]` is absent on every existing document;
  absent ⇒ one slide ⇒ byte-identical rendering. No `slidesEqual`/signature impact (SONG signature keys
  on text only, `slideGroupMaterializer.ts:177-190`).
- **Read-time tolerant.** `sliceSectionIntoSlides` clamps invalid indices; never throws on legacy/corrupt
  values.
- **No destructive migration.** No batch rewrite of any lyrics doc. Firestore is schemaless — the new
  field persists for free on the next normal autosave, only for songs the user actually splits.
- **Numbering leaves stored `label` untouched** (render-time derivation). No existing song's stored data
  or projected label changes.
- **No slide-group rewrite** for R117 — the split is resolved live; existing materialized song groups keep
  one entry per section.

### Anything that would alter how an existing song renders?
- The unsplit path keeps `entry.id` / `localSeq` and `lines: section.lines` verbatim → **no change**.
- The ONLY behavior that could shift an existing song is if R120's derived numbering were pushed into the
  projected `sectionLabel`. Recommendation keeps R120 editor-only, so existing projected output is
  unchanged. **Flag:** any decision to renumber projected labels is an owner call and must be verified
  against existing songs.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Section text stored per-slide (copy) | Pool/order references; text resolved live (D-02) | v1.3 Phase 28 | Splits must be metadata over `lines`, not a text copy |
| Reconcile-with-confirm slide groups | Unconditional idempotent rebuild per kind | Phase 30 | Split-at-assembly avoids touching rebuild entirely |
| Reference eyebrow on first section slide | Synthetic leading slide `${slot.id}:ref` at assembly | Phase 49 (R105) | Direct precedent for `${entry.id}:${i}` split ids |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The click-between-lines split UI is the intended affordance | Split Representation | Low — data contract is UI-agnostic; planner/UI-spec finalizes |
| A2 | R120 numbering is editor-display-only (projected label unchanged) | R120 scope guard | Medium — if owner wants projected renumbering, extend helper to assembler; changes existing songs' projection |
| A3 | A lone section of a kind should display "{Kind} 1" ("nothing unnumbered") | R120 | Low — matches REQUIREMENTS R120 wording; confirm at UAT |

## Open Questions

1. **Should projected slides (not just the editor) show the derived number?**
   - Known: assembler uses stored `label` (`slideshowAssembler.ts:186,544`); congregation slides rarely
     surface section labels.
   - Unclear: owner preference for projector consistency.
   - Recommendation: editor-only by default (backward-compat safe); reuse the pure helper at assembly
     only if the owner asks.
2. **Split UI: reuse the congregational click-between-lines component, or a song-local list?**
   - Recommendation: mirror the congregational divider interaction where it fits
     `SongLyricEditor`'s expanded-section list; planner + UI-spec decide the component.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @vue/test-utils (jsdom) |
| Config file | `vite.config.ts` (app suite; excludes `src/rules.test.ts`) |
| Quick run command | `npx vitest run --dir src --exclude '**/rules.test.ts' <path>` |
| Full suite command | `npx vitest run` (bare — honors the config exclude) |
| Type gate | `npm run type-check` (vue-tsc --build — typechecks tests too; the mandated gate) |

> ⚠ Per CLAUDE.md: use **`npx vitest run --dir src --exclude '**/rules.test.ts'`** or bare
> `npx vitest run`. Do NOT use `npx vitest run src/` (pulls in `render-service` on a version mismatch)
> and do NOT use `npx vitest run --dir src` alone (runs `rules.test.ts`). This phase touches no
> Firestore rules, so `npm run test:rules` is not required.
>
> **Known-failing 2-file baseline (not regressions):** `src/storage.rules.test.ts` (Storage-emulator
> cross-service `firestore.exists()` limitation — env, not defect) and
> `src/views/__tests__/RosterView.test.ts` (stale assertion). Green = these two only.

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File |
|-----|----------|-----------|-------------------|------|
| R117 | `sliceSectionIntoSlides`: breaks → N groups; absent → 1; clamps invalid | unit | `npx vitest run --dir src src/utils/__tests__/songSectionOrder.test.ts` | extend `songSectionOrder.test.ts` |
| R117 | Both assembler paths emit N slides for a split section (stored + fallback), ids `${entry.id}:i` | unit | `npx vitest run --dir src src/utils/__tests__/slideshowAssembler.test.ts` | extend `slideshowAssembler.test.ts` |
| R117 | Unsplit section unchanged (id `entry.id`, one slide) — regression | unit | same as above | `slideshowAssembler.test.ts` |
| R117 | Editor split affordance writes `slideBreaks` | component | `npx vitest run --dir src src/components/__tests__/SongLyricEditor.test.ts` | extend `SongLyricEditor.test.ts` |
| R118 | Duplicated split occurrence emits all N slides with distinct ids on both occurrences | unit | `slideshowAssembler.test.ts` | extend + `slideGroupMaterializer.test.ts` (repeat entries unchanged) |
| R119 | `'Pre-Chorus'` in `ADD_SECTION_KINDS`; slugs to `pre-chorus` via `mintSectionId` | unit | `songSectionOrder.test.ts` | extend |
| R119 | Add-Pre-Chorus palette button renders and adds a section | component | `SongLyricEditor.test.ts` | extend |
| R120 | `deriveSectionKind` strips trailing number for all real labels | unit | `songSectionOrder.test.ts` | extend |
| R120 | `buildSectionRows` derives per-kind ordinal; repeats/splits share number; nothing unnumbered | unit | `songSectionOrder.test.ts` | extend |
| R120 | Editor renders derived label; adding a Verse after pasted "Verse 1/2" shows "Verse 3" | component | `SongLyricEditor.test.ts` | extend |
| R121 | Button reads "Save" when `currentSectionCount === 0`, else "Replace lyrics" | component | `npx vitest run --dir src src/components/__tests__/LyricPasteRegion.test.ts` | extend `LyricPasteRegion.test.ts` |
| BWC | Legacy section (no `slideBreaks`) renders byte-identically; stored label never rewritten | unit | `slideshowAssembler.test.ts` + `songSectionOrder.test.ts` | extend |

### Sampling Rate
- **Per task commit:** the single changed unit/component file, e.g.
  `npx vitest run --dir src src/utils/__tests__/songSectionOrder.test.ts`.
- **Per wave merge:** `npx vitest run --dir src --exclude '**/rules.test.ts'` + `npm run type-check`.
- **Phase gate:** bare `npx vitest run` green to the 2-file baseline, `npm run type-check` clean, before
  `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `sliceSectionIntoSlides` tests — new function, no coverage yet (add to `songSectionOrder.test.ts`).
- [ ] `deriveSectionKind` + per-kind numbering tests — new (add to `songSectionOrder.test.ts`).
- [ ] Assembler split tests on BOTH paths incl. duplicate (R118) — extend `slideshowAssembler.test.ts`.
- [ ] No new framework/config/fixtures needed — all target files exist.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled). This phase is
client-side Vue with no new network surface, no auth/crypto, and no new external input beyond the
existing CCLI paste (already validated).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged |
| V3 Session Management | no | unchanged |
| V4 Access Control | yes (existing) | Firestore rule on `.../songs/{id}/lyrics` already requires an org editor; write path unchanged |
| V5 Input Validation | yes | `slideBreaks` are integers clamped to `[1, lines.length)` in `sliceSectionIntoSlides`; invalid/legacy values ignored, never thrown on |
| V6 Cryptography | no | none |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/oversized `slideBreaks` corrupting render | Tampering / DoS | Read-tolerant clamp + de-dup in the pure helper; absent-default |
| Cross-org write to another org's lyrics | Elevation | Existing Firestore rule (org-editor gate) — no rule change in this phase |

## Sources

### Primary (HIGH confidence — verified against live source this session)
- `src/utils/slideshowAssembler.ts` (assembler seam: lyric emission `:178-190`, `:513-518`, `:537-547`;
  synthetic-id precedent `:455-497`)
- `src/utils/slideGroupMaterializer.ts` (SONG derivation `:53-80`; `rebuildSongGroup` `:597-751`;
  `sourceSignature` `:177-190`)
- `src/utils/songSectionOrder.ts` (`buildSectionRows` `:73-113`; `addSection`/`uniqueSectionLabel`
  `:231-293`; `mintSectionId`/`slugifyLabel` `:256-278`; `duplicateRow` `:185`)
- `src/utils/ccliParser.ts` (Pre-Chorus recognition `:9-17`; `normaliseLabel` `:46-55`)
- `src/utils/scriptureBoundaries.ts` (Phase 34 analog `:41-118`)
- `src/types/songLyrics.ts`; `src/components/SongLyricEditor.vue`; `src/components/LyricPasteRegion.vue`;
  `src/stores/songLyrics.ts`; `src/components/slides/SlideGrid.vue` (`:555`, `:346-357`, `:1059`)
- `.planning/REQUIREMENTS.md` (R117–R121 `:63-79`); `CLAUDE.md` (test gates, prod boundary); `STATE.md`
  (D-19 slide-area scope); `.planning/config.json` (nyquist absent ⇒ enabled)

### Secondary / Tertiary
- None — no web sources needed; this is a first-party, code-only phase.

## Metadata

**Confidence breakdown:**
- Assembler seam: HIGH — traced end-to-end with line evidence; both emission paths and the grid
  consumer identified.
- Split representation: HIGH — additive field + pure helper; scripture analog compared and correctly
  rejected for reuse.
- R120 kind-source: HIGH — root cause reproduced from source; parse-from-label verified against all real
  label shapes.
- R119/R121: HIGH — parser already ships Pre-Chorus; R121 driven by an already-passed prop.
- Backward-compat: HIGH (data existence: MEDIUM-HIGH — inferred, cannot query production, but every
  recommended change is safe even if no data exists).

**Research date:** 2026-08-11
**Valid until:** 2026-09-10 (stable; internal codebase, no fast-moving external deps)
