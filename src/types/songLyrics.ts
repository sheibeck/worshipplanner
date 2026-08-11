import type { Timestamp } from 'firebase/firestore'

/**
 * A single section of song lyrics (e.g. Verse 1, Chorus).
 *
 * A member of the canonical POOL (`SongLyrics.sections` / `ParsedCCLI.sections`) —
 * each `id` appears at most once across a document's pool. A section shown more
 * than once in the slide order is a REFERENCE to this same pooled entry, not a
 * copy (D-02): edit its `lines` once and every occurrence in
 * `SongLyrics.performanceOrder` reflects the edit. See `src/utils/songSectionOrder.ts`
 * for the pure helpers that derive rows from and safely mutate the
 * pool/order pair.
 */
export interface LyricSection {
  /** Slugified label — e.g. 'verse-1', 'chorus'. */
  id: string
  /** Human-readable label — e.g. 'Verse 1', 'Chorus'. */
  label: string
  /** Lyric lines for this section. */
  lines: string[]
  /**
   * Optional manual slide-split (R117). Sorted, de-duped LINE indices `k`
   * (1 ≤ k < lines.length) each meaning "a new slide begins before lines[k]".
   * Absent or empty ⇒ the section is one slide (today's behavior). Additive,
   * optional, and read-tolerant: `sliceSectionIntoSlides` ignores out-of-range,
   * unsorted, duplicate or non-integer values, so a legacy/corrupt value can
   * never throw. Backward compatible — every existing lyrics document lacks the
   * field and therefore renders as one slide per section.
   */
  slideBreaks?: number[]
}

/** CCLI copyright metadata extracted from a SongSelect paste. */
export interface CopyrightInfo {
  title: string
  authors: string[]
  ccliSongNumber: string
  copyrightLines: string[]
  ccliLicenseNumber: string
}

/**
 * A stored lyrics document — lives in the Firestore subcollection
 * organizations/{orgId}/songs/{songId}/lyrics.
 */
export interface SongLyrics {
  id: string
  songId: string
  /**
   * An unordered POOL of canonical section text — not a running order. Each
   * `LyricSection.id` in this array is unique. `performanceOrder` is what
   * decides the order (and repetition) sections appear in; this array never
   * repeats an id.
   */
  sections: LyricSection[]
  copyright: CopyrightInfo
  /**
   * The single ordered list of section-id references, and the slide order
   * itself (D-01/D-03 — there is no second list). A repeated id means the
   * same section shown again — a reference, so editing that section's text
   * changes every place it appears (D-02). Every id here resolves to a
   * pooled `sections` entry, and every pooled section is referenced at
   * least once; `src/utils/songSectionOrder.ts::normalizeLyricOrder`
   * enforces both directions of that invariant.
   */
  performanceOrder: string[]
  /** Song-level background image (R057) — the least specific tier of the slide/group/song cascade `resolveEntryMedia` resolves; greenfield, no migration (D-19). */
  backgroundImageUrl?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Output of the CCLI paste parser — no Firestore metadata. */
export interface ParsedCCLI {
  title: string
  sections: LyricSection[]
  copyright: CopyrightInfo
}
