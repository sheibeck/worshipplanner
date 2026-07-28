---
phase: 28-song-lyrics-editor-rework-risk-low
plan: 01
status: complete
completed: 2026-07-27
requirements: [R035]
key-files:
  created:
    - src/utils/songSectionOrder.ts
    - src/utils/__tests__/songSectionOrder.test.ts
  modified: []
---

# Plan 28-01 Summary — Section pool/order model and pure helpers

## What was built

`src/utils/songSectionOrder.ts` — the pure foundation the rest of Phase 28 consumes. It establishes the
**pool + order** model that replaces Phase 18's Available-Sections / Performance-Order split:

- a **pool** of canonical sections (each with a stable `sectionId`), and
- an **order** — a list of references into that pool.

A repeat is therefore a second *reference* to one pooled section, which is exactly **D-02**: editing the
chorus once updates every occurrence. This is D002's "single canonical version, reference don't copy"
applied at section granularity.

### Exported surface

| Export | Role |
|---|---|
| `SectionRow`, `AddSectionKind`, `ADD` | the row/derivation types option 2a renders |
| `buildSectionRows` | derives the numbered, linked-aware display rows from pool + order |
| `normalizeLyricOrder` | canonicalises an order against its pool |
| `moveRow`, `duplicateRow`, `removeRow`, `addSection` | the four order mutations 2a needs |
| `mintSectionId`, `uniqueSectionLabel` | id/label minting |
| `normalizeParsedSections` | **D006** — folds CCLI-pasted repeats into pool references |

`normalizeParsedSections` is the D006 guarantee: pasted CCLI text whose section markers repeat a chorus
produces ONE pooled section referenced N times, not N duplicated sections. Without it, every paste would
have re-created the duplication this phase exists to remove.

## Verification

- `npx vitest run src/utils/__tests__/songSectionOrder.test.ts` — **35/35 pass**
- **Purity confirmed:** `grep -cE "from '@/stores|from '@/firebase|from 'vue'"` → **0**. Waves 3-6 depend
  on this module staying pure.
- `npm run type-check` — 0 errors (`vue-tsc --build`, which covers the test tsconfig too)

## Commits

- `09fc6df` test(28-01): add failing tests for section pool/order model
- `e6f268f` feat(28-01): implement section pool/order model and row/mutation helpers (+261 lines)
- `44534af` test(28-01): add failing tests for CCLI paste repeat normalisation
- `dc77a5e` feat(28-01): normalize CCLI paste repeats into pool references (D006/D-02) (+75 lines)

Both tasks followed RED → GREEN.

## Deviations

**Bookkeeping only — the executor agent stalled after its final code commit**, before writing this
SUMMARY.md and committing STATE.md. It returned early waiting on a background task that never
reported. The orchestrator verified the delivered work independently against disk (both files present,
35/35 tests passing, purity grep clean, type-check 0) and completed the documentation step. **No code
was written or altered by the orchestrator** — only this summary and the tracking commit.

No deviations in the implementation itself.

## Notes for downstream plans

- **28-02** collapses the two competing order fields (`Song.performanceOrder` and
  `SongLyrics.performanceOrder`) onto one canonical source and deletes `PerformanceOrderBuilder.vue`.
- **28-03** must fix `reconcileSongGroup`'s repeat handling *before* D-02's repeats reach it — the
  planner identified that it currently pushes the whole stored-entries array per occurrence, which
  compounds (4 → 8 → 16) on an additive path with no confirm gate.
- **28-04/05** render and mutate through the helpers above; they should not re-implement ordering logic.
