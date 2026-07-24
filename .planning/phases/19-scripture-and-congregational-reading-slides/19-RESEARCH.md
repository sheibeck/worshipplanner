# Phase 19 Research: Scripture and Congregational Reading Slides

> Faithfully ported from gsdpi slice S02 research (milestone M001). "Slice"/"task" renamed to "phase"/"plan" where natural; task IDs T01–T05 map to plans 19-01 through 19-05.

## Executive Summary

Phase 19 builds scripture slide generation from the ESV API with automatic splitting for long passages, plus a congregational reading mode (Leader/Congregation labels). The existing codebase provides:
- Unified Slide type with contentKind discriminator (`src/types/slide.ts`)
- ESV API integration via Cloud Function proxy (`src/utils/esvApi.ts`)
- Scripture parsing, validation, and overlap detection (`src/utils/scripture.ts`)
- Claude AI scripture suggestions (`src/utils/claudeApi.ts`)
- Auto-save composable pattern (`src/composables/useAutoSave.ts`)
- Pinia store patterns with Firestore binding (`src/stores/songLyrics.ts`)

This phase must extend the Slide discriminated union to include `ScriptureSlide` (and congregational sections), implement passage-splitting logic, and build editor UIs for both variants. The reusable patterns (auto-save, store architecture, type safety) directly apply.

---

## What Exists

### 1. Slide Type System
**File:** `src/types/slide.ts`

Currently defines:
- `SlideContentKind = 'lyric' | 'scripture' | 'imported' | 'text' | 'image' | 'video'` (already includes 'scripture' as a placeholder)
- `SlideBase` interface with `id`, `position`, `contentKind`
- `LyricSlide` and `CopyrightSlide` concrete types
- Discriminated union: `type Slide = LyricSlide | CopyrightSlide`

**Gap:** must add `ScriptureSlide` (and congregational sections) to the union.

### 2. ESV API Integration
**File:** `src/utils/esvApi.ts`

Provides:
- `fetchPassageText(query: string): Promise<string>` — fetches passage from ESV via `/api/esv/v3/passage/text/`
- Server-side proxy injects ESV API key (Cloud Function: `functions/src/index.ts`)
- Passes params: `include-verse-numbers: true`, `include-headings/footnotes/references: false`

**Returns:** Unprocessed passage text (e.g., "Romans 3:23 For all have sinned...", may be 1000+ chars for long passages)

**Gap:** must implement passage-splitting logic to break long passages into displayable chunks (~30–60 words per slide or ~5–10 verses).

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

### 5. Auto-Save & Store Patterns
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

**Gap:** determine whether to extend songLyrics store or create a separate scripture-focused store.

### 6. Existing Scripture UI Components
**File:** `src/components/ScriptureInput.vue`

Advanced scripture input with:
- Manual text parsing (calls `parseScriptureInput()`)
- Preview passage text via `fetchPassageText()`
- AI search integration (`getScriptureSuggestions()`)
- ESV.org link generation
- Sermon overlap warnings

**File:** `src/components/ScriptureRotationTable.vue`

Visualization of scripture usage patterns across services (context only).

### 7. Song Editor Pattern (Reference)
**File:** `src/components/SongLyricEditor.vue`

Demonstrates the pattern this phase should follow:
- Subscribe to data in `onMounted()`, unsubscribe in `onUnmounted()`
- Maintain local editable state
- Watch local state → auto-save via `useAutoSave()`
- Distinguish dirty tracking from save versioning

---

## What Phase 19 Must Build

### 1. Slide Type Extensions
**File:** `src/types/slide.ts` (modify)

Add a concrete scripture slide type and congregational sections:

```typescript
export interface ScriptureSlide extends SlideBase {
  contentKind: 'scripture'
  reference: ScriptureRef          // {book, chapter, verseStart?, verseEnd?}
  text: string                      // Passage text (single chunk or auto-split chunk)
  isAutoSplit: boolean              // true if this chunk is from passage auto-split
  splitIndex?: number               // 0-based index within the auto-split set
  totalSplits?: number              // Total number of chunks from this passage
}
```

**Design Decision:** Congregational content is modeled as a variant of scripture content (a `readingMode: 'normal' | 'congregational'` field plus optional congregational sections) rather than a separate `contentKind`, keeping the discriminated union simple.

### 2. Passage Splitting Logic
**New file:** `src/utils/scriptureSplitter.ts`

Algorithm to split long passage text:

```typescript
export function splitPassage(
  passageText: string,
  reference: ScriptureRef,
  maxWordsPerSlide: number = 50,
): PassageSplit[]
```

**Challenges:**
- Passage text from ESV API includes verse numbers but no structural markers
- Must infer verse boundaries by parsing numbers in brackets or prefix patterns
- Long chapters (Psalm 119: 176 verses) must split into many slides
- Prefer splitting at verse boundaries rather than mid-verse

**Approach:**
1. Extract verse numbers from ESV text
2. Accumulate verses until word count exceeds threshold
3. Emit a split at that boundary
4. Repeat until end

**Risk:** ESV API params don't guarantee a consistent verse-number format. May need to test live ESV API responses to finalize logic.

### 3. Scripture Store
Create a scripture-focused store mirroring the songLyrics pattern (real-time Firestore subscription, CRUD), rather than overloading the songLyrics store.

### 4. Scripture Editor Component
**New file:** `src/components/ScriptureSlideEditor.vue`

UI for editing a scripture slide group: passage reference input, "Fetch & Auto-Split", preview of fetched text, list of splits with inline preview, edit/remove, auto-save status.

### 5. Congregational Reading Editor
**New file:** `src/components/CongregationalEditor.vue`

UI for splitting a passage into Leader/Congregation sections: same passage ref input, section speaker toggles (LEADER / CONGREGATION), preview of the alternating-speaker layout, auto-save status.

### 6. Store Persistence
Persist scripture readings as their own Firestore documents under `organizations/{orgId}/scriptureReadings`.

### 7. Tests
- `src/utils/__tests__/scriptureSplitter.test.ts` — short/long/edge/verse-boundary/no-verse-number fallback.
- `src/components/__tests__/ScriptureSlideEditor.test.ts` — render, fetch, split display, auto-save, empty state.
- `src/components/__tests__/CongregationalEditor.test.ts` — render sections, toggle speaker, auto-save, status transitions.

---

## Implementation Landscape

### Key Files & Build Order

**Plan 1: Types & Utilities**
1. `src/types/slide.ts` — add ScriptureSlide + congregational sections
2. `src/types/scriptureReading.ts` — ScriptureReading document type
3. `src/utils/scriptureSplitter.ts` — implement passage splitting algorithm
4. `src/utils/__tests__/scriptureSplitter.test.ts` — test splitting logic

**Plan 2: Store & Persistence**
5. `src/stores/scriptureSlides.ts` — Pinia store with Firestore CRUD
6. `src/stores/__tests__/scriptureSlides.test.ts`

**Plan 3–4: Components & UX**
7. `src/components/ScriptureSlideEditor.vue` + tests
8. `src/components/CongregationalEditor.vue` + tests

**Plan 5: Integration**
9. Wire both editors into the service editor / ScriptureSlot flow
10. Integration tests

### Natural Seams for Plan Decomposition

**Plan 19-01 (T01) — Scripture Slide Types & Splitting Logic**
- `slide.ts` + `scriptureReading.ts` type definitions
- `scriptureSplitter.ts` algorithm + unit tests
- Acceptance: `splitPassage()` correctly splits example passages into chunks

**Plan 19-02 (T02) — Store Integration**
- `scriptureSlides.ts` Pinia store + Firestore CRUD
- Store tests for CRUD
- Acceptance: scripture readings persist across page reload

**Plan 19-03 (T03) — Scripture Editor Component**
- `ScriptureSlideEditor.vue` (passage input + fetch + split preview + auto-save)
- Unit tests covering render, fetch, split display, auto-save status
- Acceptance: fetch Romans 8:28-39, see it split, edit/save each slide

**Plan 19-04 (T04) — Congregational Reading Editor**
- `CongregationalEditor.vue` (section splitting, speaker role toggles)
- Unit tests for section edit, role change, auto-save
- Acceptance: split a passage into LEADER/CONGREGATION sections, preview alternating pattern

**Plan 19-05 (T05) — Integration & UAT**
- Integrate both editors into the service editor flow + reading-mode toggle
- Integration tests + manual browser validation

---

## Risks & Constraints

### High-Priority Risks

1. **ESV API Verse-Number Format Variance** — response may not have consistent verse-number markers; splitting logic may fail silently. Mitigation: early spike with live ESV calls; add format detection. Owner: 19-01.

2. **Very Long Passages** — Psalm 119 (176 verses) could split into 10+ slides; UI assumes fewer. Mitigation: reasonable max-words-per-slide threshold; UI warning if a passage is very long. Owner: 19-01, 19-03.

3. **Congregational Reading: Verse Boundaries** — user-curated sections may start mid-verse. Mitigation: recommend section boundaries at verse breaks; allow partial verses but mark them. Owner: 19-04.

4. **Firestore Schema Compatibility** — Mitigation: use a dedicated `scriptureReadings` collection with optional fields for backward compat. Owner: 19-02.

### Medium-Priority Risks

5. **Auto-Save Concurrency** — rapid edits could race. Mitigation: debounced auto-save with clearTimeout; only the last change saves. Owner: 19-03, 19-04.

6. **Memory Usage** — long passages previewed for every split could bloat memory. Mitigation: lazy-load previews (nice-to-have). Owner: 19-03.

### Low-Priority Risks

7. **Type Safety: Discriminated Union Complexity** — multiple scripture variants could confuse type narrowing. Mitigation: keep the discriminator simple. Owner: 19-01.

8. **Testing ESV Live API** — tests calling `fetchPassageText()` fail offline. Mitigation: mock in unit tests; live ESV test via integration/UAT only. Owner: 19-01, 19-03.

---

## Recommendations for Phase 19

1. **Start with plan 19-01 (types + splitting logic):** establish the data model early; the splitting algorithm is the core novelty.
2. **Spike on ESV API response format** before the store plan to confirm verse-number format.
3. **Reuse the songLyrics store pattern** (versioning, auto-save, Firestore).
4. **Build ScriptureSlideEditor first, then CongregationalEditor** — auto-split is simpler than manual/alternating splitting.
5. **Defer the lazy-load preview optimization** — acceptable to load all split previews eagerly for MVP.
6. **Plan downstream touch points** — coordinate with the later slideshow-assembly phase on how scripture slides flow into the performance-order builder.

---

## Acceptance Criteria for Phase 19

- ScriptureSlide type + congregational sections in the discriminated union
- `splitPassage()` algorithm tested with multiple example passages (short, medium, long, edge cases)
- Scripture readings persist in Firestore
- ScriptureSlideEditor UI: fetch, preview, split list, auto-save status all functional
- CongregationalEditor UI: section splitting, speaker role toggle, auto-save
- 100% test pass rate (unit + integration)
- Manual browser UAT: add scripture slide to a service, toggle congregational mode, confirm display
