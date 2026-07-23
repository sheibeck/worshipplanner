# S01 Research: Song Lyric Slides and Editor

**Depth:** Deep research — CCLI paste parsing is novel (no prior art in codebase), unified slide data model is new, performance order builder requires drag-and-drop UX, and auto-save infrastructure must be adapted from a different context (services → songs).

## Summary

S01 delivers the foundational slide system: CCLI SongSelect paste → auto-parsed lyric sections → slide editor with performance order → copyright compliance → auto-save → light versioning. No slide types, lyric storage, or slide editor exist yet. The Song type has metadata (title, ccliNumber, author, arrangements) but zero lyric content. Everything in this slice is net-new.

## Requirements Covered

- **R001** (core-capability): CCLI SongSelect paste → auto-split into slides by section markers
- **R002** (compliance): CCLI copyright info on first/last lyric slides (title, authors, CCLI number, license number)
- **R003** (core-capability): Performance order builder with section repeats (Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus)
- **R004** (continuity): Light version history on lyrics — undo/revert, not branching versions
- **R017** (failure-visibility): Auto-save on slide editing surfaces — debounced Firestore writes as user works
- **R018** (quality-attribute): Polished, intuitive editor for non-technical volunteers — usable on first attempt
- **R019** (constraint): Unified slide data model — single type with content-kind field
- **R020** (constraint): Single canonical song version — services reference live, not copies

## Recommendation

### Data Model: Subcollection vs. Embedded

**Recommendation: Store lyrics as a subcollection `organizations/{orgId}/songs/{songId}/lyrics`** containing one doc per song version (light versioning). Each doc holds the parsed sections, copyright metadata, and a timestamp. The active version is the most recent.

**Why not embedded in the Song doc?** Lyrics can be large (20+ sections × multiple lines each), the Song doc is already loaded in list views for filtering/search (loading lyrics for every song in the catalog would be wasteful), and subcollections naturally support versioning (one doc per snapshot).

The unified slide data model (R019) maps to a `Slide` type with a `contentKind` discriminator field. For S01, only `contentKind: 'lyric'` exists. S02 adds `'scripture'`, S04 adds `'imported'`, etc.

### Performance Order: Separate from Lyrics

The performance order (R003) is an ordered array of section references: `['verse-1', 'chorus', 'verse-2', 'chorus', 'bridge', 'chorus']`. This lives on the Song doc itself (not in the lyrics subcollection) because it's lightweight and needs to be accessible without loading full lyric text — services reference it to build slideshows in S03.

## Implementation Landscape

### What Exists

| Asset | Path | Relevance |
|---|---|---|
| Song type | `src/types/song.ts` | Needs `lyrics` and `performanceOrder` fields or subcollection refs |
| Song store | `src/stores/songs.ts` | Will grow a lyrics subcollection subscription and CRUD |
| SongSlideOver | `src/components/SongSlideOver.vue` | Existing song editor — lyrics tab/panel extends this or lives alongside it |
| Auto-save pattern | `src/views/ServiceEditorView.vue:1295-1347` | 800ms debounced watcher pattern to reuse for lyric auto-save |
| useUnsavedGuard | `src/composables/useUnsavedGuard.ts` | Dirty-check composable for Save button state |
| SortableJS | `sortablejs` (installed) | Used in ServiceEditorView for slot reordering — reuse for performance order |
| CollapsibleSection | `src/components/CollapsibleSection.vue` | Reusable accordion pattern for lyric sections in editor |
| Firestore rules | `firestore.rules:62-64` | Wildcard `match /{collection}/{docId}` under orgs covers any new subcollection |
| Tailwind v4 | `@tailwindcss/vite` plugin | Dark-first design, utility classes, no tailwind.config file (v4 CSS-based config) |

### What Must Be Built

| Component | Purpose | Complexity |
|---|---|---|
| CCLI paste parser | `src/utils/ccliParser.ts` | Medium — two format variants (legacy/2023), section marker extraction, copyright parsing |
| Slide type definitions | `src/types/slide.ts` | Low — unified Slide type with contentKind discriminator |
| Song lyrics type | `src/types/songLyrics.ts` (or extend song.ts) | Low — LyricSection[], copyright metadata, version timestamp |
| Lyrics store (or extend songs store) | `src/stores/songLyrics.ts` | Medium — subcollection CRUD, auto-save with debounce, version snapshots |
| Lyric paste modal/dialog | `src/components/LyricPasteDialog.vue` | Medium — textarea for paste, preview of parsed sections, confirm/cancel |
| Song lyric editor view/panel | `src/components/SongLyricEditor.vue` | High — section display, inline editing, auto-save status indicator |
| Performance order builder | `src/components/PerformanceOrderBuilder.vue` | High — drag-and-drop reorder, add/remove sections, repeat support |
| Copyright display component | `src/components/CopyrightSlide.vue` | Low — renders copyright info (title, authors, CCLI#, license#) |
| Slide preview component | `src/components/SlidePreview.vue` | Medium — renders a single slide (lyric content + copyright) |
| Version history UI | `src/components/LyricVersionHistory.vue` | Low — list of saved versions with revert button |
| Firestore rules update | `firestore.rules` | Already covered by wildcard — no change needed |

### CCLI SongSelect Paste Format (Research Finding)

Two format variants exist (legacy and 2023+):

**Structure:**
```
Song Title
[blank line]
Section Label    (e.g. "Verse 1", "Chorus", "Bridge", "Pre-Chorus")
Lyric line 1
Lyric line 2
[double blank line between sections]
...
[footer: CCLI Song #, authors, copyright, license]
```

**Section labels** are Title Case with optional number: `Verse 1`, `Chorus`, `Bridge`, `Pre-Chorus`, `Ending`, `Tag`, `Misc`, `Intro`. Case-insensitive matching recommended.

**Footer differences:**
- Legacy: `CCLI Song # 1234567` → `Author One | Author Two` → `© 2011 Publisher` → `CCLI License # 00000`
- 2023+: `Author One, Author Two` → `CCLI Song #123456` → `© 2023 Publisher` → `CCLI License #00000`

**Edge cases for parser:**
1. Pre-Chorus can appear as section label OR as `(PRE-CHORUS)` in first lyric line
2. Bridge can appear as section label OR as `(BRIDGE)` in first lyric line
3. Authors use `|` (legacy) or `,` (2023) as delimiters
4. `©` can be Unicode U+00A9 or ASCII `(c)`
5. Space before `#` in CCLI lines varies
6. Multiple copyright lines possible
7. Section numbers may be omitted (treated as 1)

**Parser strategy:**
1. First non-blank line = title
2. Match section headers: `/^(Verse|Chorus|Bridge|Pre-Chorus|Ending|Tag|Misc|Intro)\s*\d*$/i`
3. Lines between header and next blank = section lyrics
4. Detect footer by `CCLI Song` prefix (or author line before `CCLI Song` in 2023 format)
5. Extract: CCLI song number, authors[], copyright lines[], CCLI license number

### Auto-Save Architecture

Reuse the ServiceEditorView pattern (`src/views/ServiceEditorView.vue:1295-1347`):
- Deep watcher on lyrics reactive state
- 800ms debounce timer
- Inflight guard prevents concurrent saves
- Status indicator: `idle → pending → saving → saved → idle`
- Snapshot pre-save for undo capability (R004 light versioning)

Extract to a composable `useAutoSave` so both ServiceEditorView and the lyric editor can share it.

### Performance Order Builder Design

- Display available sections from parsed lyrics (Verse 1, Chorus, Bridge, etc.)
- User builds an ordered list by clicking to add, dragging to reorder (SortableJS)
- Sections can repeat (same section appears multiple times in the order)
- Stored as: `performanceOrder: string[]` where each entry is a section ID like `'verse-1'`, `'chorus'`, `'bridge'`
- Default order: sections in their lyric definition order, each once

## Natural Seams (Independent Work Units)

### Seam 1: Types + CCLI Parser (no UI dependency)
- `src/types/slide.ts` — unified Slide type with `contentKind` discriminator
- `src/types/songLyrics.ts` — LyricSection, SongLyrics, CopyrightInfo types
- `src/utils/ccliParser.ts` — parse raw paste text into structured sections + copyright
- `src/utils/__tests__/ccliParser.test.ts` — unit tests for both format variants + edge cases

### Seam 2: Lyrics Store + Auto-Save Composable (depends on Seam 1 types)
- `src/composables/useAutoSave.ts` — extracted from ServiceEditorView's debounce pattern
- `src/stores/songLyrics.ts` — Firestore subcollection CRUD, subscription, version snapshot on save
- Refactor ServiceEditorView to use the extracted composable (optional — can defer)

### Seam 3: Paste Dialog + Lyric Editor UI (depends on Seam 1 + 2)
- `src/components/LyricPasteDialog.vue` — paste textarea, parse preview, confirm
- `src/components/SongLyricEditor.vue` — section display, inline edit, auto-save status, copyright display
- Integration with SongSlideOver or as a new view/tab

### Seam 4: Performance Order Builder (depends on Seam 1 + 2)
- `src/components/PerformanceOrderBuilder.vue` — drag-and-drop section ordering with repeats
- SortableJS integration following ServiceEditorView's pattern

### Seam 5: Version History (depends on Seam 2)
- `src/components/LyricVersionHistory.vue` — list snapshots, preview diff, revert button
- Lightweight: subcollection docs are already versioned by timestamp

## First Proof (Highest Risk / Biggest Unblocker)

**Seam 1: CCLI Parser** — this is the highest-risk component because:
1. The paste format has two variants with subtle differences
2. Edge cases (Pre-Chorus as parenthetical, missing section numbers, multiple copyright lines) could silently drop content
3. Every downstream component depends on correct parsing
4. It's purely algorithmic with zero UI dependency — can be built and tested first
5. Comprehensive unit tests validate the parser before any UI work begins

**Second priority: Seam 2 (Lyrics Store)** — establishes the Firestore data model that all UI components consume. Getting the subcollection structure right early prevents rework.

## Verification

### CCLI Parser
```bash
npx vitest run src/utils/__tests__/ccliParser.test.ts --reporter=verbose
```
Test cases: legacy format, 2023 format, missing section numbers, Pre-Chorus edge case, multiple copyright lines, empty paste, title-only paste, Unicode © vs ASCII (c).

### Lyrics Store
```bash
npx vitest run src/stores/__tests__/songLyrics.test.ts --reporter=verbose
```
Test cases: subscribe/unsubscribe, addLyrics, updateLyrics, version snapshot on save, auto-save debounce.

### Type Check
```bash
npx vue-tsc --build --noEmit
```

### Full Unit Suite
```bash
npx vitest run --reporter=verbose
```

## Constraints and Watch-Outs

1. **Firestore rules are already covered** — the wildcard `match /{collection}/{docId}` at `firestore.rules:62-64` under organizations allows editor read/write on any subcollection. No rule changes needed for `songs/{songId}/lyrics`.

2. **Song doc size** — Current Song docs are small (metadata only). Adding `performanceOrder: string[]` is fine. Lyrics text must NOT go on the Song doc — it would bloat list-view reads.

3. **SortableJS pattern** — Follow the ServiceEditorView pattern exactly: revert SortableJS DOM move, let Vue's reactive render be the single source of truth (prevents snap-back).

4. **Tailwind v4** — No `tailwind.config.js` file exists. This project uses Tailwind CSS v4 with the Vite plugin (`@tailwindcss/vite`). CSS-based configuration. All existing components use dark-first design (gray-800/900 backgrounds, gray-100/300 text, indigo accents).

5. **Auto-save timing** — 800ms debounce is proven in the service editor. Same timing for lyric editing avoids surprise save behavior.

6. **CCLI copyright compliance (R002)** — Copyright info MUST appear on first and last slides when rendered in a presentation. This is a CCLI license requirement, not just nice-to-have. The parser must extract: song title, author(s), CCLI song number, copyright line(s), and the user's CCLI license number (which may need to be stored in org settings).

7. **CCLI License Number** — The paste includes the user's CCLI license number in the footer. This should be stored at the organization level (not per-song) since it's the church's license. Need to check if org settings already have a field for this or if one needs to be added.

8. **Performance order is separate from lyrics** — The parsed sections define what's available. The performance order defines what gets shown and in what sequence. A song can have Verse 1, Verse 2, Verse 3, Chorus, Bridge — but the performance order might be: V1, C, V2, C, B, C, V3, C.

## Don't Hand-Roll

- **SortableJS** — already installed and used in ServiceEditorView. Use the same library and pattern for performance order drag-and-drop.
- **useUnsavedGuard** — existing composable at `src/composables/useUnsavedGuard.ts`. Use for the lyric editor's dirty-check.
- **Firestore onSnapshot** — existing subscription pattern in songs store. Mirror for lyrics subcollection.

## Open Questions for Planner

1. **Where does the lyric editor live?** Options: (a) New tab in SongSlideOver slide-over panel, (b) dedicated route `/songs/:id/lyrics`, (c) new full-page modal. Recommendation: (a) — keeps song editing in one place, follows existing UX pattern.

2. **CCLI License Number storage** — Does the org document already have a field for this? If not, needs an org settings field. Check during implementation.

3. **Slide preview fidelity** — How closely should the editor preview match the eventual presentation mode (S06)? For S01, a simple card-style preview per section is sufficient. Full-screen presentation rendering is S06's scope.

## Sources

- OpenLP CCLI file importer source code (authoritative open-source parser for SongSelect format)
- OpenLP test fixtures: `TestSong.txt` (legacy) and `TestSong2023.txt` (2023 format)
- Existing codebase: ServiceEditorView auto-save pattern, SongSlideOver editor pattern, SortableJS integration
- CCLI copyright display requirements: renewingworshipnc.org guidelines
