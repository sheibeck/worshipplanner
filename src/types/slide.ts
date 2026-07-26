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
   * Render carriers for attached media (Phase 22 R013/R014, refactored Phase 24
   * D-04). For a slide resolved from a stored `SlideGroup` entry, `audioUrl`
   * is filled by two-level precedence — the entry's OWN audio first, falling
   * back to the group's `bedAudioUrl` — and `videoUrl` always comes from the
   * group's `bedVideoUrl` (video has no per-slide layer). For a slot with no
   * materialized group yet, the deprecated slot-level `audioUrl`/`videoUrl`
   * fields still land on only the first emitted slide (the pre-Phase-24
   * behaviour), preserved for data that has not migrated. Never persisted
   * standalone on the (ephemeral, regenerated) assembled slide.
   */
  audioUrl?: string
  videoUrl?: string
  /**
   * Per-slide audio loop flag (D-04, R030). Copied ONLY from a
   * `GroupSlideEntry.audioLoop` when this slide's audio resolved from that
   * entry itself — never set when the audio resolved from the group's bed,
   * because a bed never loops.
   */
  audioLoop?: boolean
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
 * A video slide — a single dropped video, appended to a `SlideGroup` as its
 * own entry (D-17, R032). Its own source lives on `videoSrc`, deliberately
 * NOT `videoUrl` — `SlideBase.videoUrl` is the group-BED carrier that
 * `resolveEntryMedia` fills from `group.bedVideoUrl`, and `emitFromGroup`
 * conditionally spreads that carrier over the resolved content. If a video
 * slide's own source used the same key, a group that ALSO has a bed video
 * would silently overwrite the slide's own footage with the bed's. Do not
 * "tidy" these two field names together.
 *
 * `ImportedDeck.slides` is deliberately NOT widened to include this type —
 * PPTX decks contain no video (D-17).
 */
export interface VideoSlide extends SlideBase {
  contentKind: 'video'
  videoSrc: string
  originalFileName?: string
}

/**
 * Discriminated union of all slide variants.
 *
 * Narrow on `contentKind` (and further on shape-specific fields) to access
 * variant-specific properties.
 */
export type Slide = LyricSlide | CopyrightSlide | ScriptureSlide | TextSlide | ImageSlide | VideoSlide

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
  /**
   * Set when this slide was resolved from a stored `SlideGroup` entry — the
   * group's Firestore doc id (equals the anchoring `ServiceSlot.id`, D-01).
   * Absent on the no-group fallback derivation path.
   */
  groupId?: string
  /**
   * Equals the stored `GroupSlideEntry.id` this slide was resolved from.
   * Never recomputed from slot index or emission order — Phase 23's WR-02
   * keys `PresentationViewer`'s media children on this id. Absent on the
   * fallback path.
   */
  groupSlideId?: string
  /**
   * True when `slide.audioUrl` was resolved from the group's `bedAudioUrl`
   * rather than the entry's own audio (D-04) — lets `PresentationViewer` key
   * its `AudioPlayer` to the GROUP so a bed keeps playing across slide
   * transitions within that group (R030).
   */
  audioFromBed?: boolean
  /** True when `slide.videoUrl` was resolved from the group's `bedVideoUrl`. */
  videoFromBed?: boolean
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
