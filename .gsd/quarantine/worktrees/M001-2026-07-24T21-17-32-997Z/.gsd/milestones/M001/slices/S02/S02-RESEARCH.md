# S02: Scripture and Congregational Reading Slides — Research

**Date:** 2026-07-24

## Summary

S02 adds scripture slide generation from the ESV API with automatic splitting for long passages, plus a congregational reading mode with Leader/Congregation labels. The existing codebase provides strong foundations: a unified Slide type with `contentKind: 'scripture'` already declared (but no concrete interface), a working ESV API proxy (`fetchPassageText`), scripture reference parsing (`parseScriptureInput`), and the auto-save composable from S01.

The prior research (now superseded) proposed storing scripture slides inside the `songLyrics` store. **This is architecturally wrong.** Scripture readings are NOT songs — they're standalone content referenced from service `ScriptureSlot` entries. The corrected approach creates a dedicated `useScriptureSlides` store with its own Firestore collection, paralleling how `songLyrics` works for songs but scoped to scripture readings.

The core technical risk is the passage-splitting algorithm: ESV API returns plain text with `[N]` verse markers, and the splitter must handle verse-boundary splitting for passages ranging from a single verse to Psalm 119 (176 verses). The ESV API integration itself is proven — the proxy, auth, and fetch path all work today.

## Recommendation

**Architecture:** Create a standalone `scriptureSlides` Pinia store with its own Firestore path (`organizations/{orgId}/scriptureReadings/{id}`). Each document stores the reference, fetched ESV text, generated slides (auto-split or manually edited), and optional congregational reading sections. This keeps scripture readings independent of songs and allows S03 to reference them from service slots via a `scriptureReadingId` field.

**Type model:** Add `ScriptureSlide` to the Slide union with `contentKind: 'scripture'`. Use a `readingMode: 'normal' | 'congregational'` field to distinguish variants — no separate `CongregationalSlide` type needed. Congregational mode adds a `sections` array with `speaker: 'LEADER' | 'CONGREGATION'` labels.

**Build order:** Types first (T01), then splitter utility (T02), then store (T03), then ScriptureSlideEditor component (T04), then CongregationalEditor (T05), then integration into the service editor flow (T06).

## Implementation Landscape

### Key Files

- `src/types/slide.ts` — Add `ScriptureSlide` interface to the discriminated union. Currently has `'scripture'` in `SlideContentKind` but no concrete type.
- `src/types/service.ts` — `ScriptureSlot` has `book, chapter, verseStart, verseEnd` fields. Will need `scriptureReadingId?: string` added for S03 linkage (not S02's job, but plan for it).
- `src/utils/esvApi.ts` — `fetchPassageText(query)` already works. Returns raw ESV text with `[N]` verse markers. No changes needed.
- `src/utils/scripture.ts` — `parseScriptureInput()`, `BIBLE_BOOKS`, `esvLink()`, `scripturesOverlap()` all exist. `parseScriptureInput` returns `ScriptureRef` — reused as the reference type for scripture slides.
- `src/utils/scriptureSplitter.ts` — **New.** Pure function to split ESV passage text into slide-sized chunks at verse boundaries.
- `src/stores/scriptureSlides.ts` — **New.** Pinia store for scripture reading CRUD. Mirrors `songLyrics.ts` pattern: `onSnapshot` subscription, `addDoc`/`updateDoc` for create/update, `serverTimestamp`.
- `src/components/ScriptureSlideEditor.vue` — **New.** Enter reference → fetch ESV text → auto-split into slides → manual override → auto-save.
- `src/components/CongregationalEditor.vue` — **New.** Same reference input, but user assigns Leader/Congregation roles to verse groups.
- `src/composables/useAutoSave.ts` — Reused as-is (800ms debounce, status indicators). No changes.
- `src/components/ScriptureInput.vue` — Existing component with reference parsing and ESV preview. Can be reused or its logic extracted for the new editors.

### Existing Patterns to Follow

**Store pattern** (from `src/stores/songLyrics.ts`):
- `onSnapshot` with `orderBy('updatedAt', 'desc')` for real-time sync
- `addDoc` for creation, `updateDoc` for auto-save patches
- `serverTimestamp()` on all writes
- Computed getters for current/active document

**Auto-save pattern** (from `src/composables/useAutoSave.ts`):
- Watch reactive data source → debounce 800ms → call save function
- `isDirty` computed gates saves, prevents save on initial load
- Status: idle → pending → saving → saved → idle

**Component pattern** (from `src/components/SongLyricEditor.vue`):
- Subscribe in `onMounted()`, unsubscribe in `onUnmounted()`
- Local editable state with deep watch
- Auto-save via `useAutoSave()` with isDirty guard
- Dark-first Tailwind styling consistent with existing components

### Type Design

```typescript
// Addition to src/types/slide.ts
export interface ScriptureSlide extends SlideBase {
  contentKind: 'scripture'
  reference: string           // "Romans 8:28-39" — display string
  bookRef: ScriptureRef       // Structured reference for linking
  text: string                // Passage text for this slide chunk
  verseRange: string          // "vv. 28-32" — verse range label
  readingMode: 'normal' | 'congregational'
  // Congregational-only fields (present when readingMode === 'congregational')
  sections?: Array<{
    speaker: 'LEADER' | 'CONGREGATION'
    text: string
    verseRange?: string
  }>
}

// Updated union
export type Slide = LyricSlide | CopyrightSlide | ScriptureSlide
```

### Firestore Schema

```
organizations/{orgId}/scriptureReadings/{id}
  ├── reference: ScriptureRef         // {book, chapter, verseStart?, verseEnd?}
  ├── displayReference: string        // "Romans 8:28-39"
  ├── rawText: string                 // Full ESV text as fetched
  ├── readingMode: 'normal' | 'congregational'
  ├── slides: ScriptureSlide[]        // Generated/edited slide chunks
  ├── congregationalSections?: Array<{speaker, text, verseRange}>
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp
```

### Passage Splitting Algorithm

ESV API returns text like: `[28] And we know that for those who love God all things work together for good, for those who are called according to his purpose. [29] For those whom he foreknew...`

Splitter approach:
1. Parse `[N]` markers to identify verse boundaries
2. Accumulate verses until word count exceeds threshold (~50 words per slide)
3. Split at the nearest verse boundary
4. Generate `verseRange` labels (e.g., "vv. 28-32")
5. Short passages (< threshold) → single slide, no splitting
6. Fallback: if no `[N]` markers found, split by sentence boundaries at word count threshold

Edge cases:
- Very long passages (Psalm 119): cap at ~5 words/verse average → many slides is OK
- Single verse: 1 slide, no split metadata
- Chapter without verse range: fetch entire chapter, split normally

### Build Order

1. **T01 — ScriptureSlide type + Slide union update** (unblocks everything)
   - Add `ScriptureSlide` interface to `src/types/slide.ts`
   - Add `ScriptureReading` type for Firestore documents to a new `src/types/scriptureReading.ts`
   - No runtime risk — purely type definitions

2. **T02 — Passage splitter utility + tests** (highest technical risk — front-load)
   - `src/utils/scriptureSplitter.ts` — `splitPassage(text, ref, opts)` → `ScriptureSlide[]`
   - `src/utils/__tests__/scriptureSplitter.test.ts` — 8+ tests covering short/medium/long passages, edge cases
   - First proof: this is the novel algorithm; everything else follows known patterns

3. **T03 — Scripture slides Pinia store + tests** (follows songLyrics pattern)
   - `src/stores/scriptureSlides.ts` — Firestore CRUD with real-time subscription
   - `src/stores/__tests__/scriptureSlides.test.ts` — mock Firestore, test create/read/update
   - Pattern is proven from S01; low risk

4. **T04 — ScriptureSlideEditor component + tests** (the main user-facing deliverable)
   - Enter reference → fetch ESV text → see auto-split slides → edit/override → auto-save
   - Reuse `ScriptureInput.vue` reference parsing or embed similar logic
   - `src/components/__tests__/ScriptureSlideEditor.test.ts`

5. **T05 — CongregationalEditor component + tests** (builds on T04)
   - Same reference flow, but user assigns LEADER/CONGREGATION to verse groups
   - Preview of alternating-speaker layout
   - `src/components/__tests__/CongregationalEditor.test.ts`

6. **T06 — Service editor integration** (wire into existing UI)
   - Extend `ServiceEditorView.vue` ScriptureSlot UI to open ScriptureSlideEditor/CongregationalEditor
   - Add toggle between normal and congregational reading modes
   - This is the integration seam consumed by S03

### Verification

- **T02**: `npx vitest run src/utils/__tests__/scriptureSplitter.test.ts` — splitter tests pass
- **T03**: `npx vitest run src/stores/__tests__/scriptureSlides.test.ts` — store tests pass
- **T04**: `npx vitest run src/components/__tests__/ScriptureSlideEditor.test.ts` — component tests pass
- **T05**: `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` — component tests pass
- **All**: `npx vitest run` — full suite passes with no regressions

### Dependencies from S01

Consumed from S01 (all verified present):
- `SlideBase` interface and `SlideContentKind` type (`src/types/slide.ts`)
- `useAutoSave` composable (`src/composables/useAutoSave.ts`)
- Store pattern: Firestore subscription + CRUD (`src/stores/songLyrics.ts` as reference)
- Dark-first Tailwind component styling patterns

### Forward Intelligence for S03

S03 ("Service Sections and Slide Auto-Assembly") will consume:
- `ScriptureSlide` type from the Slide union — for rendering scripture slides in the assembled slideshow
- `useScriptureSlides` store — for loading scripture reading data when assembling service slideshows
- The `scriptureReadingId` linkage from `ScriptureSlot` (added in T06 or deferred to S03)

**Watch-outs for S03:**
- Scripture slides are stored separately from song lyrics — the assembly engine must fetch from both `songLyrics` and `scriptureSlides` stores
- Congregational reading slides have a different render layout (speaker labels) — the presentation renderer must handle `readingMode: 'congregational'`

### Risks

1. **ESV API verse marker format** (medium risk, T02)
   - The `[N]` format is documented but not guaranteed across all ESV API versions
   - Mitigation: Add format detection with fallback to sentence-boundary splitting
   
2. **Very long passages producing many slides** (low risk, T02/T04)
   - Psalm 119 (176 verses) could produce 15+ slides
   - Mitigation: Show count warning in UI; user can narrow the verse range

3. **Auto-save race between scripture and lyric editors** (low risk, T04)
   - Scripture slides use a separate store/collection, so no conflict with songLyrics auto-save
   - Each store writes to its own Firestore path independently

### Skills

No additional skills needed. The work follows established patterns (store CRUD, component testing, utility functions). No unfamiliar libraries required — ESV API integration is already working.
