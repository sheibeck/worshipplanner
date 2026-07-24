# S02 Research: Scripture and Congregational Reading Slides

## Executive Summary

S02 builds scripture slide generation from the ESV API with automatic splitting for long passages, plus a congregational reading mode (Leader/Congregation labels). The existing codebase provides:
- Unified Slide type with contentKind discriminator (S01: `src/types/slide.ts`)
- ESV API integration via Cloud Function proxy (`src/utils/esvApi.ts`)
- Scripture parsing, validation, and overlap detection (`src/utils/scripture.ts`)
- Claude AI scripture suggestions (`src/utils/claudeApi.ts`)
- Auto-save composable pattern (S01: `src/composables/useAutoSave.ts`)
- Pinia store patterns with Firestore binding (S01: `src/stores/songLyrics.ts`)

S02 must extend the Slide discriminated union to include `ScriptureSlide` and `CongregationalSlide` types, implement passage-splitting logic, and build editor UIs for both variants. The reusable patterns from S01 (auto-save, store architecture, type safety) directly apply.

---

## What Exists

### 1. Slide Type System (S01)
**File:** `src/types/slide.ts`

Currently defines:
- `SlideContentKind = 'lyric' | 'scripture' | 'imported' | 'text' | 'image' | 'video'` (already includes 'scripture' as a placeholder)
- `SlideBase` interface with `id`, `position`, `contentKind`
- `LyricSlide` and `CopyrightSlide` concrete types
- Discriminated union: `type Slide = LyricSlide | CopyrightSlide`

**Gap:** S02 must add `ScriptureSlide` and `CongregationalSlide` to the union.

### 2. ESV API Integration
**File:** `src/utils/esvApi.ts`

Provides:
- `fetchPassageText(query: string): Promise<string>` — fetches passage from ESV via `/api/esv/v3/passage/text/`
- Server-side proxy injects ESV API key (Cloud Function: `functions/src/index.ts`)
- Passes params: `include-verse-numbers: true`, `include-headings/footnotes/references: false`

**Returns:** Unprocessed passage text (e.g., "Romans 3:23 For all have sinned...", may be 1000+ chars for long passages)

**Gap:** S02 must implement passage-splitting logic to break long passages into displayable chunks (~30–60 words per slide or ~5–10 verses).

### 3. Scripture Parsing & Utilities
**File:** `src/utils/scripture.ts`

Provides:
- `BIBLE_BOOKS` — 66-book Protestant canon list
- `parseScriptureInput(text: string): ScriptureRef | null` — parses "Romans 8:28" or "1 Corinthians 1:3-5" into `{book, chapter, verseStart?, verseEnd?}`
- `esvLink(book, chapter): string` — generates ESV.org URL
- `scripturesOverlap(reading, sermon): boolean` — checks if two passage refs overlap

**Gap:** No logic to split already-fetched passage text into visual chunks.

### 4. AI Scripture Suggestions
**File:** `src/utils/claudeApi.ts`

Provides:
- `getScriptureSuggestions(params)` — Claude AI suggests passages based on sermon context
- Validates suggestions against the canon
- Used by `ScriptureInput.vue` for AI-powered passage discovery

**Note:** Not needed for auto-split; provided for context on scripture workflow.

### 5. Auto-Save & Store Patterns (S01)
**Composable:** `src/composables/useAutoSave.ts`

Provides reusable auto-save:
- Watches a reactive data source, debounces (default 800ms), calls save function
- Status transitions: idle → pending → saving → saved → idle
- Inflight guard prevents concurrent saves

**Store:** `src/stores/songLyrics.ts` (Pinia)

Patterns used:
- Firestore real-time subscriptions with `onSnapshot`
- CRUD ops: `saveLyrics()` (new version), `updateCurrentLyrics()` (in-place), `revertToVersion()`
- Computed versioning: most recent version = "current active"
- Server timestamps for auto-dating

**Gap:** S02 needs to determine whether to extend songLyrics store or create a separate scripture-focused store.

### 6. Existing Scripture UI Components
**File:** `src/components/ScriptureInput.vue`

Advanced scripture input with:
- Manual text parsing (calls `parseScriptureInput()`)
- Preview passage text via `fetchPassageText()`
- AI search integration (`getScriptureSuggestions()`)
- ESV.org link generation
- Sermon overlap warnings

**File:** `src/components/ScriptureRotationTable.vue`

Visualization of scripture usage patterns across services (not slide-related; context only).

### 7. Song Editor Pattern (Reference)
**File:** `src/components/SongLyricEditor.vue`

Demonstrates pattern S02 should follow:
- Subscribe to data in `onMounted()`, unsubscribe in `onUnmounted()`
- Maintain local editable state (`editableSections`)
- Watch local state → auto-save via `useAutoSave()`
- Distinguish dirty tracking from save versioning
- Call `useAutoSave()` with watch source, save function, isDirty computed

---

## What S02 Must Build

### 1. Slide Type Extensions
**File:** `src/types/slide.ts` (modify)

Add two concrete slide types:

```typescript
export interface ScriptureSlide extends SlideBase {
  contentKind: 'scripture'
  reference: ScriptureRef          // {book, chapter, verseStart?, verseEnd?}
  text: string                      // Passage text (single chunk or auto-split chunk)
  isAutoSplit: boolean              // true if this chunk is from passage auto-split
  splitIndex?: number               // 0-based index within the auto-split set
  totalSplits?: number              // Total number of chunks from this passage
}

export interface CongregationalSlide extends SlideBase {
  contentKind: 'scripture'  // Re-use 'scripture' kind or distinguish from ScriptureSlide?
  reference: ScriptureRef
  text: string
  readingMode: 'congregational'
  sections: Array<{
    speaker: 'LEADER' | 'CONGREGATION'
    text: string
    verseRange?: string  // e.g. "v. 1-3"
  }>
}

// Update union:
export type Slide = LyricSlide | CopyrightSlide | ScriptureSlide | CongregationalSlide
```

**Design Decision:** Should `CongregationalSlide` use `contentKind: 'scripture'` (grouped) or a new kind like `'congregational'`? Current Slide type suggests contentKind is purely discriminator; both variants are scripture-based content. **Recommendation:** Use `contentKind: 'scripture'` and add a `readingMode?: 'normal' | 'congregational'` field to ScriptureSlide; CongregationalSlide becomes a variant of ScriptureSlide. Simpler type union.

### 2. Passage Splitting Logic
**New file:** `src/utils/scriptureSplitter.ts`

Algorithm to split long passage text:

```typescript
interface PassageSplit {
  text: string
  verseRange?: string  // inferred from passage structure
}

export function splitPassage(
  passageText: string,
  reference: ScriptureRef,
  maxWordsPerSlide: number = 50,
): PassageSplit[]
```

**Challenges:**
- Passage text from ESV API includes verse numbers (e.g., "23 For all have sinned") but no structural markers
- Must infer verse boundaries by parsing numbers in brackets or prefix patterns
- Long chapters (Psalm 119: 176 verses) must split into ~3–5 slides
- Prefer splitting at verse boundaries rather than mid-verse

**Approach:**
1. Extract verse numbers from ESV text (regex: `^\d+\s+` for verse-start pattern)
2. Accumulate verses until word count exceeds threshold
3. Emit a split at that boundary
4. Repeat until end

**Risk:** ESV API params don't guarantee a consistent verse-number format. May need to test live ESV API responses to finalize logic.

### 3. Scripture Store (or songLyrics extension)
**Option A — Extend songLyrics store:**

Add methods to `src/stores/songLyrics.ts`:
- `updateScriptureSlides(orgId, songId, lyricsId, slides: ScriptureSlide[])`
- No new store; reuse songLyrics versioning model

**Option B — Create scripture-focused store:**

New file: `src/stores/scriptureSlides.ts` mirroring songLyrics pattern.

**Recommendation:** Option A. Scripture slides are tightly coupled to a song's performance (like sections/lyrics). Sharing the versioning model makes sense: "edit song lyrics or scripture slides → create new version together." Simpler data model.

### 4. Scripture Editor Component
**New file:** `src/components/ScriptureEditor.vue`

UI for editing a single scripture slide or group:

Template:
- Input field for passage reference (reuse `ScriptureInput.vue` logic or extract shared component)
- Button to "Fetch & Auto-Split" passage
- Preview of fetched text
- List of splits with inline preview
- Edit / remove split buttons
- Auto-save status

Script:
- Props: `orgId`, `songId`, `lyricsId`, `initialSlide?: ScriptureSlide`
- Data: `reference`, `passageText`, `splits`, `autoSaveStatus`
- Call `fetchPassageText()` → `splitPassage()` → populate `splits`
- Use `useAutoSave()` to save splits back to store on change
- Emit `@update:slides` to parent (or rely on store subscription)

### 5. Congregational Reading Editor
**New file:** `src/components/CongregationalEditor.vue`

UI for splitting passage into Leader/Congregation sections:

Template:
- Same passage ref input as ScriptureEditor
- Interactive text editor where user highlights/selects sections
- Each section tagged with speaker role dropdown (LEADER / CONGREGATION)
- Preview of final alternating-speaker layout
- Auto-save status

Script:
- Props: `orgId`, `songId`, `lyricsId`, `initialSlide?: CongregationalSlide`
- Data: `reference`, `rawText`, `sections` (speaker + text pairs)
- Supports manual section splitting (no auto-split for congregational; user curates)
- Use `useAutoSave()` similarly to ScriptureEditor

### 6. Store Persistence
**File:** `src/stores/songLyrics.ts` (extend)

Add field to `SongLyrics` interface:

```typescript
export interface SongLyrics {
  // ... existing fields
  scriptureSlides?: (ScriptureSlide | CongregationalSlide)[]  // optional for backward compat
}
```

Or define a new nested structure if S03 / future slices add more content kinds.

**Firestore path:** `organizations/{orgId}/songs/{songId}/lyrics/{lyricsId}` already contains full SongLyrics doc. Add `scriptureSlides` array to existing doc.

### 7. Tests
**File:** `src/utils/__tests__/scriptureSplitter.test.ts`

Test cases:
- Split short passage (< threshold) → returns 1 chunk
- Split long passage (> threshold) → returns multiple chunks
- Verse boundary detection with various ESV formats
- Edge: passage with no verse numbers (fallback to word count)
- Edge: very long chapter (Psalm 119 → ~5+ chunks)

**File:** `src/components/__tests__/ScriptureEditor.test.ts`

Test cases:
- Render input field + fetch button
- Fetch passage → display text → verify splits render
- Edit split → auto-save fires
- Status transitions (pending → saving → saved)
- Empty state (no passage selected)

**File:** `src/components/__tests__/CongregationalEditor.test.ts`

Test cases:
- Render editable text with speaker role dropdowns
- Toggle speaker role → reflects in preview
- Auto-save on section change
- Status transitions

---

## Implementation Landscape

### Key Files & Build Order

**Phase 1: Types & Utilities**
1. `src/types/slide.ts` — add ScriptureSlide, CongregationalSlide to discriminated union
2. `src/utils/scriptureSplitter.ts` — implement passage splitting algorithm
3. `src/utils/__tests__/scriptureSplitter.test.ts` — test splitting logic

**Phase 2: Store & Persistence**
4. `src/stores/songLyrics.ts` — extend SongLyrics interface to include scriptureSlides array
5. Store tests — update `songLyrics.test.ts` to cover scripture slide CRUD

**Phase 3: Components & UX**
6. `src/components/ScriptureEditor.vue` — editor for auto-split scripture slides
7. `src/components/__tests__/ScriptureEditor.test.ts`
8. `src/components/CongregationalEditor.vue` — editor for congregational readings
9. `src/components/__tests__/CongregationalEditor.test.ts`

**Phase 4: Integration**
10. Integration point: Where S02 fits into the song/service slide flow (consumed by S03)
11. End-to-end test: Create song → add scripture slide → fetch/split → save version → verify Firestore

### Natural Seams for Task Decomposition

**T01 — Scripture Slide Types & Splitting Logic**
- `slide.ts` type definitions
- `scriptureSplitter.ts` algorithm + unit tests
- Acceptance: splitPassage() correctly splits example passages into ~3-5 chunks

**T02 — Store Integration**
- Extend `songLyrics.ts` to persist scripture slides
- Update Firestore schema (add scriptureSlides array to SongLyrics doc)
- Store tests for CRUD (create, read, update scripture slide array)
- Acceptance: scripture slides persist across page reload (live Firestore test)

**T03 — Scripture Editor Component**
- ScriptureEditor.vue (passage input + fetch + split preview + auto-save)
- Unit tests covering render, fetch, split display, auto-save status
- Acceptance: Can fetch Romans 8:28-39, see it split into 2 slides, edit/save each

**T04 — Congregational Reading Editor**
- CongregationalEditor.vue (manual section splitting, speaker role toggles)
- Unit tests for section edit, role change, auto-save
- Acceptance: Can split Isaiah 61:1-2 into LEADER/CONGREGATION sections, preview alternating pattern

**T05 — Integration & UAT**
- Integrate both editors into song edit flow
- End-to-end UAT: add scripture slide to song → export to Planning Center (S03 concern) → verify display
- Manual browser validation: Create song, add congregational slide, confirm layout

---

## Risks & Constraints

### High-Priority Risks

1. **ESV API Verse-Number Format Variance**
   - Risk: ESV API response may not have consistent verse-number markers. Splitting logic may fail silently.
   - Mitigation: Early spike with live ESV API calls to understand exact response format. Add format detection to `scriptureSplitter.ts`.
   - Owner: T01

2. **Very Long Passages**
   - Risk: Psalm 119 (176 verses) or Matthew 24 could split into 10+ slides. UI design assumes ~3-5. Performance/UX untested.
   - Mitigation: Set reasonable max-verses-per-slide threshold (e.g., 20 verses). Add UI warning if passage exceeds this. Revisit in T03 if UX proves unwieldy.
   - Owner: T01, T03

3. **Congregational Reading: Verse Boundaries**
   - Risk: User-curated congregational sections may start mid-verse. UX unclear for how to represent partial verses.
   - Mitigation: Recommend section boundaries at verse breaks in UI; allow partial verses but mark as "manual split" vs. "verse boundary split."
   - Owner: T04

4. **Firestore Schema Compatibility**
   - Risk: Adding `scriptureSlides` array to SongLyrics doc could conflict with existing queries or cause bloat on large songbooks.
   - Mitigation: Use optional field (`scriptureSlides?: ...`) for backward compat. Plan optional future migration to separate subcollection if array grows large.
   - Owner: T02

### Medium-Priority Risks

5. **Auto-Save Concurrency**
   - Risk: User edits both lyrics and scripture slides simultaneously. Auto-save for each could create race conditions.
   - Mitigation: Both use same `updateCurrentLyrics()` store method. Firestore's optimistic locking handles conflicts. Test with rapid edits.
   - Owner: T03, T04

6. **Memory Usage**
   - Risk: Long passages (5000+ chars) previewed for every split in editor could bloat memory if user opens many passages.
   - Mitigation: Lazy-load previews; only fetch/render when split is expanded or user scrolls into view.
   - Owner: T03 (nice-to-have optimization)

### Low-Priority Risks

7. **Type Safety: Discriminated Union Complexity**
   - Risk: Multiple scripture variants (ScriptureSlide with readingMode: 'normal' | 'congregational') could confuse type narrowing.
   - Mitigation: Keep discriminator simple. Consider explicit `CongregationalSlide` type if complexity grows.
   - Owner: T01 (design review)

8. **Testing ESV Live API**
   - Risk: Tests that call fetchPassageText() will fail offline or if ESV API down.
   - Mitigation: Use mock in unit tests; live ESV test via integration/UAT phase only.
   - Owner: T01, T03 (test infrastructure)

---

## Recommendations for S02

1. **Start with T01 (types + splitting logic):** Establish data model early. Splitting algorithm is the core novelty; front-load this work.

2. **Spike on ESV API response format:** Before T02, run one live query to confirm verse-number format and plan splitting regex accordingly.

3. **Extend songLyrics store, don't create new:** Reuse versioning, auto-save, and Firestore patterns already proven in S01.

4. **Build ScriptureEditor first (T03), then CongregationalEditor (T04):** Auto-split is simpler; manual splitting adds complexity.

5. **Defer "lazy-load preview optimization":** Acceptable to load all split previews eagerly for MVP. Optimize in S03 if UX testing reveals memory issues.

6. **Plan S03 touch points:** S02 must coordinate with S03 on how scripture slides flow into performance order builder and Planning Center export. Likely S03 extends the slide editor UI to support adding/reordering scripture alongside lyrics.

---

## Acceptance Criteria for S02

- ✅ ScriptureSlide & CongregationalSlide types in discriminated union
- ✅ splitPassage() algorithm tested with 5+ example passages (short, medium, long, edge cases)
- ✅ Scripture slides persist in Firestore under SongLyrics doc
- ✅ ScriptureEditor UI: fetch, preview, split list, auto-save status all functional
- ✅ CongregationalEditor UI: manual section splitting, speaker role toggle, auto-save
- ✅ 100% test pass rate (unit + integration)
- ✅ Manual browser UAT: add scripture slide to song, export, confirm display (with S03 support)
