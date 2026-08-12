# Phase 53: Song Lyric Editing - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (owner away — grey areas auto-decided at Claude's discretion, grounded in a live read of `songSectionOrder.ts`, `songLyrics.ts`, and `LyricPasteRegion.vue`)

<domain>
## Phase Boundary

Song-slide editing is intuitive for a non-technical user: split a section into slides by hand,
duplicate a split as one unit, add Pre-Choruses, get position-based numbering, and a clearer
first-save button. Requirements R117 (manual split into slides), R118 (duplicate a split as a unit),
R119 (Pre-Chorus item), R120 (position-based numbering), R121 ("Save" on first paste). This is the
milestone's largest new-build. AI auto-splitting is explicitly OUT of scope (deferred to backlog).

The editor is `SongLyricEditor.vue` (706 lines), built on `songSectionOrder.ts`'s pool+order model
(v1.3 Phase 28): `SongLyrics.sections` is an unordered POOL of `LyricSection { id, label, lines[] }`;
`performanceOrder` is the ordered list of id-references that IS the slide order (a repeated id = the
same section shown again, a reference not a copy — D-02).

</domain>

<decisions>
## Implementation Decisions

### R117 — Manual split into slides (the core new design)
- **A split is an internal slide-boundary structure on the ONE `LyricSection`, not multiple sections.**
  Add an optional field to `LyricSection` (e.g. `slideBreaks?: number[]` — sorted line indices where a
  new slide begins, OR an equivalent slides-grouping) that divides the section's `lines` into
  consecutive slide groups. This mirrors v1.4 Phase 34's scripture congregational boundary-index model
  (`computeBoundaries`/`sliceAtBoundaries` in the scripture path) — the section's `lines` stay the
  canonical text; the split is additive metadata.
- **Why one section, not many:** the owner's decision (PROJECT.md "A split song section is one logical
  unit") is that the split must NOT leak into numbering (R120) or duplication (R118). Keeping the
  section a single pool entry makes both automatic: numbering is per-section, and a duplicate of the
  reference carries the whole split.
- **Absent field = one slide** (today's behavior) → backward compatible.
- The manual UI lets the user place a break between any two adjacent lines of a section (e.g. an 8-line
  chorus → break after line 4 → two 4-line slides). Mirror the interaction the scripture congregational
  editor already ships (click-between-lines dividers) where it fits SongLyricEditor's list UI.

### R118 — Duplicate a split as one unit
- Falls out of the R117 model: `duplicateRow` (songSectionOrder.ts:185) duplicates the section-id
  reference; the pooled section (with its `slideBreaks`) is shared, so the duplicate shows the same
  multi-slide unit. **Confirm the slide ASSEMBLER emits every slide of a split section on BOTH the
  first and the duplicated occurrence.** No change to `duplicateRow` expected.

### R119 — Pre-Chorus
- Add `'Pre-Chorus'` to `ADD_SECTION_KINDS` (songSectionOrder.ts:15) and to any other place kinds are
  enumerated (add-section palette in `SongLyricEditor.vue`, and any label→kind derivation R120 adds).
  Ensure it flows through `addSection`/labeling/numbering like the existing kinds.

### R120 — Position-based numbering
- **Derive the displayed number per KIND by position at render time**, not from a stored suffix. The
  first Verse is "Verse 1"; a Verse added after two existing Verses is "Verse 3"; both slides of a
  split "Verse 1" stay "Verse 1"; nothing is left unnumbered.
- **Root cause of the owner's bug** ("adding a Verse produces an unnamed/misnumbered section"):
  `addSection` uses `uniqueSectionLabel(kind, existingLabels)`, which returns the bare kind ("Verse")
  when the exact string "Verse" is not among existing labels — but a CCLI paste labels sections
  "Verse 1"/"Verse 2", so "Verse" is free and the new section gets no number.
- **Fix:** compute the ordinal from position among same-kind sections. This requires a reliable KIND
  for each section — **research to choose** between (a) parsing the kind from the label (strip a
  trailing number) or (b) adding a `kind` field to `LyricSection`. Prefer the lowest-risk option that
  keeps existing pasted data correct. The derivation likely lives in `buildSectionRows` (or a sibling
  pure helper) so both the editor and any label consumer share it.

### R121 — "Save" on first paste
- `LyricPasteRegion.vue:110` renders `{{ isSaving ? 'Saving...' : 'Replace lyrics' }}`. Change the
  idle label to **"Save"** when the song has NO existing lyrics (first-time paste), keeping a
  replace-style label (or also "Save") when lyrics already exist — the helper text already explains it
  replaces lyrics. Thread a `hasExistingLyrics`/`isNewSong` prop from `SongLyricEditor.vue`.

### Backward compatibility (IMPORTANT — do NOT assume greenfield)
- v1.3 Phase 28's D-19 declared song-lyrics structures greenfield, but **v1.4 and v1.5 shipped to
  production (last deploy 2026-08-10)**, so real songs with lyrics may now exist. Treat all
  `LyricSection`/`SongLyrics` model changes as **additive and optional** (new fields default-absent,
  read-time tolerant), with **no destructive migration**. **Research MUST verify** whether production
  lyric data exists and confirm the additive approach is safe; if a stored-label numbering change would
  alter how existing songs display, prefer a derivation that leaves stored `label` untouched.

### Claude's Discretion
- Exact split representation (`slideBreaks: number[]` vs. a slides array), the kind-source choice for
  R120 (parse-label vs. `kind` field), the precise split UI affordance, and the R121 label for the
  existing-lyrics case are at Claude's discretion, subject to: one-section-per-split (R118/R120 must not
  regress), additive/optional model changes (no migration), exhaustiveness/type-check clean, and the
  slide assembler emitting the correct N slides.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/songSectionOrder.ts` — pure pool/order model: `buildSectionRows` (row derivation +
  numbering seam), `addSection`, `duplicateRow`, `removeRow`, `moveRow`, `normalizeLyricOrder`,
  `uniqueSectionLabel`, `ADD_SECTION_KINDS`. The numbering fix and Pre-Chorus land here.
- `src/types/songLyrics.ts` — `LyricSection { id, label, lines[] }` (extend with the split field),
  `SongLyrics { sections, performanceOrder, ... }`.
- `src/components/SongLyricEditor.vue` (706 lines) — the editor UI (add-section palette, per-section
  list, Duplicate/Remove/reorder); hosts the split UI + numbering display + the R121 prop source.
- `src/components/LyricPasteRegion.vue` — the paste surface; button at :110 (R121).
- v1.4 Phase 34 scripture boundary model (`computeBoundaries`, `sliceAtBoundaries`, congregational
  click-between dividers) — the closest existing analog for R117's split interaction and slicing.
- The slide ASSEMBLER for song groups (`slideGroupMaterializer.ts` / `slideshowAssembler.ts`) — must
  emit N slides for a split section; research maps the exact seam (song groups are read-only in the
  Slides tab, so the split is authored only in `SongLyricEditor`).

### Established Patterns
- Pool/order model: sections are canonical, `performanceOrder` is the slide order; repeats are
  references (D-02). Mutations go through the pure `songSectionOrder.ts` helpers.
- Additive optional fields persist for free (Firestore schemaless), but see the backward-compat note.
- `npm run type-check` (vue-tsc --build) is the gate; keep any `switch`/union exhaustive.

### Integration Points
- `songSectionOrder.ts` (numbering + Pre-Chorus + split helpers), `songLyrics.ts` (type),
  `SongLyricEditor.vue` (split UI + numbering + R121 prop), `LyricPasteRegion.vue` (R121 label),
  the song-group slide assembler (render N slides per split section).

</code_context>

<specifics>
## Specific Ideas

- Owner: "say I have a chorus that is 8 lines long. I'd like the Option to Split the Chorus into 2
  slides. I need to be able to manually decide what items go on which of the two slides. Once I do this,
  then when I 'duplicate' the chorus, it should be a duplicate of those 2 slides together."
- Owner: "The goal is to make song editing as intuitive and easy as possible for a user who may not be
  overly technical."
- Owner: "Add pre-chorus as an item you can add to a song lyrics."
- Owner: "I add a Verse by clicking on the Verse button. This verse gets added but is not called Verse.
  Not Verse 3 or anything. The numbering of these items in the song should be based on their position.
  The first Verse would be Verse 1."
- Owner: "If we split an item up then the second slide of Verse 1 is still Verse 1."
- Owner: "brand new song ... the button says 'Replace Lyrics'. That's confusing. I think we can just
  make this button read 'Save'. We already have helper text noting that it replaces lyrics."

</specifics>

<deferred>
## Deferred Ideas

- **AI-assisted / automatic slide splitting** — explicitly OUT of scope (REQUIREMENTS Future + Out of
  Scope). v1.6's split is manual only.

</deferred>
