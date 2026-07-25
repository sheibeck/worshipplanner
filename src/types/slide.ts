/**
 * Unified Slide type with contentKind discriminator.
 *
 * S01 defines 'lyric' only; later slices add 'scripture', 'imported',
 * 'text', 'image', and 'video'.
 */

/** All slide content kinds the system will eventually support. */
export type SlideContentKind = 'lyric' | 'scripture' | 'imported' | 'text' | 'image' | 'video'

/** Fields shared by every slide regardless of content kind. */
export interface SlideBase {
  id: string
  position: number
  contentKind: SlideContentKind
  /**
   * Render carriers for a slot's attached media (Phase 22, R013/R014).
   * The assembler fills these from `ServiceSlot`'s `MediaAttachableSlot`
   * fields on the first slide it emits for that slot — they are never
   * persisted standalone on the (ephemeral, regenerated) assembled slide.
   */
  audioUrl?: string
  videoUrl?: string
}

/** A lyric slide — one section of a song's lyrics. */
export interface LyricSlide extends SlideBase {
  contentKind: 'lyric'
  sectionId: string
  sectionLabel: string
  lines: string[]
}

/** A copyright slide shown at the start/end of a song's lyric slides. */
export interface CopyrightSlide extends SlideBase {
  contentKind: 'lyric'
  title: string
  authors: string[]
  ccliSongNumber: string
  copyrightLines: string[]
  ccliLicenseNumber: string
}

export interface CongregationalSection {
  speaker: 'LEADER' | 'CONGREGATION'
  text: string
  verseRange?: string
}

/** A scripture slide — one chunk of a Bible passage. */
export interface ScriptureSlide extends SlideBase {
  contentKind: 'scripture'
  reference: string
  bookRef: import('./service').ScriptureRef
  text: string
  verseRange: string
  readingMode: 'normal' | 'congregational'
  sections?: CongregationalSection[]
}

/**
 * A text slide — freeform text content (prayer/message/hymn placeholder slides,
 * future section-title slides). Backs slots that have no dedicated slide type.
 */
export interface TextSlide extends SlideBase {
  contentKind: 'text'
  title?: string
  body: string
}

/**
 * An image slide — a single imported image (from a parsed PPTX slide or a
 * direct image upload). Backs the IMPORTED slot kind (Phase 21) alongside
 * TextSlide within an ImportedDeck.
 */
export interface ImageSlide extends SlideBase {
  contentKind: 'image'
  imageUrl: string
  altText?: string
}

/**
 * Discriminated union of all slide variants.
 *
 * Narrow on `contentKind` (and further on shape-specific fields) to access
 * variant-specific properties.
 */
export type Slide = LyricSlide | CopyrightSlide | ScriptureSlide | TextSlide | ImageSlide

/**
 * Wraps a single unified Slide with the service-slot provenance that produced it.
 * Emitted by the assembly engine — the assembled slideshow is `AssembledSlide[]`,
 * never a parallel slide hierarchy (D001).
 */
export interface AssembledSlide {
  slide: Slide
  slotIndex: number
  slotKind: import('./service').SlotKind
  section?: import('./service').ServiceSection
  sourceId: string | null
}

/**
 * A section-grouped view of assembled slides for the preview panel.
 * `section` is `undefined` for legacy slots that predate the section field.
 */
export interface AssembledSection {
  section: import('./service').ServiceSection | undefined
  label: string
  slides: AssembledSlide[]
}
