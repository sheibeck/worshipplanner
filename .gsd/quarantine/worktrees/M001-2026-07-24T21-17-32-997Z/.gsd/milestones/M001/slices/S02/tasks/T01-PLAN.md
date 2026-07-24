---
estimated_steps: 25
estimated_files: 4
skills_used: []
---

# T01: ScriptureSlide types, ScriptureReading type, and passage splitter with tests

**Why:** The ScriptureSlide type and passage splitter are the foundation for all S02 work. The splitter is the highest-risk algorithm (novel code, not a pattern copy), so it's front-loaded with thorough tests.

**Do:**
1. Add `ScriptureSlide` interface to `src/types/slide.ts`:
   - Extends `SlideBase` with `contentKind: 'scripture'`
   - Fields: `reference: string` (display string like "Romans 8:28-39"), `bookRef: ScriptureRef` (structured ref from `src/types/service.ts`), `text: string` (passage text for this slide chunk), `verseRange: string` (label like "vv. 28-32"), `readingMode: 'normal' | 'congregational'`, optional `sections?: Array<{ speaker: 'LEADER' | 'CONGREGATION'; text: string; verseRange?: string }>`
   - Update the `Slide` union: `export type Slide = LyricSlide | CopyrightSlide | ScriptureSlide`

2. Create `src/types/scriptureReading.ts` with the `ScriptureReading` interface for Firestore documents:
   - Fields: `id: string`, `reference: ScriptureRef`, `displayReference: string`, `rawText: string`, `readingMode: 'normal' | 'congregational'`, `slides: ScriptureSlide[]`, `congregationalSections?: Array<{ speaker: 'LEADER' | 'CONGREGATION'; text: string; verseRange?: string }>`, `createdAt: Timestamp`, `updatedAt: Timestamp`

3. Create `src/utils/scriptureSplitter.ts` — pure function `splitPassage(text: string, ref: ScriptureRef, opts?: { wordsPerSlide?: number }): ScriptureSlide[]`:
   - Parse `[N]` verse markers from ESV API output to identify verse boundaries
   - Accumulate verses until word count exceeds threshold (~50 words default)
   - Split at nearest verse boundary, generate `verseRange` labels
   - Short passages (below threshold) → single slide
   - Fallback: if no `[N]` markers found, split by sentence boundaries
   - Each returned slide gets `contentKind: 'scripture'`, `readingMode: 'normal'`, position assigned sequentially

4. Create `src/utils/__tests__/scriptureSplitter.test.ts` with 8+ tests:
   - Single verse → 1 slide, no split
   - Short passage (under threshold) → 1 slide
   - Medium passage → 2-3 slides at verse boundaries
   - Long passage (Psalm-length) → many slides
   - No verse markers fallback → sentence-boundary split
   - Custom wordsPerSlide option
   - Empty text → empty array
   - Verse range labels correct (e.g. "vv. 28-32", "v. 1" for single)

**Done-when:** `npx vitest run src/utils/__tests__/scriptureSplitter.test.ts` passes with 8+ tests. ScriptureSlide is exported from slide.ts and included in the Slide union. ScriptureReading type is exported from scriptureReading.ts.

## Inputs

- `src/types/slide.ts`
- `src/types/service.ts`
- `src/utils/esvApi.ts`

## Expected Output

- `src/types/scriptureReading.ts`
- `src/utils/scriptureSplitter.ts`
- `src/utils/__tests__/scriptureSplitter.test.ts`

## Verification

npx vitest run src/utils/__tests__/scriptureSplitter.test.ts
