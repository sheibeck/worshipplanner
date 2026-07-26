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
   * Render carrier for attached audio (Phase 22 R013/R014, refactored Phase 24
   * D-04). For a slide resolved from a stored `SlideGroup` entry, `audioUrl`
   * is filled by two-level precedence — the entry's OWN audio first, falling
   * back to the group's `bedAudioUrl`. The bed is audio-only (D-18) — video is
   * slide-only and never has a bed carrier. For a slot with no materialized
   * group yet, this is simply unset — there is no legacy slot-level media
   * fallback (D-19: the slide area has never shipped). Never persisted
   * standalone on the (ephemeral, regenerated) assembled slide.
   */
  audioUrl?: string
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
 * own entry (D-17, R032). Its own source lives on `videoSrc`. Video is
 * slide-only (D-18) — there is no group bed video, so `videoSrc` names this
 * slide's own footage with nothing to collide with.
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
