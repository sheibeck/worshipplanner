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
  /**
   * Resolved background image (R055/R056/R057) — the winner of the slide →
   * group → song cascade `resolveEntryMedia` computes. Never persisted
   * standalone; regenerated on every assembly like `audioUrl`.
   */
  backgroundImageUrl?: string
  /**
   * Which tier supplied `backgroundImageUrl` — `'slide'` (this entry's own),
   * `'group'` (the owning `SlideGroup`'s), or `'song'` (the owning
   * `SongLyrics`' document's). Absent when no tier defined a background.
   * Deliberately a single tri-state field, not two booleans (R055/R056/R057)
   * — a 3-level cascade needs three mutually exclusive states. Lives on
   * `SlideBase` (not `AssembledSlide`) so it and `backgroundImageUrl` can
   * never drift apart the way `audioUrl`/`audioFromBed` historically did.
   */
  backgroundSource?: 'slide' | 'group' | 'song'
  /**
   * Phase 42 (R079/R080) render-state discriminator for a slide sourced from
   * a PPTX deck whose server-side render (`organizations/{orgId}/pptxRenders/
   * {importId}`) has not yet produced a usable page for it. This field's
   * PRESENCE is the discriminator every consumer must branch on FIRST, ahead
   * of `contentKind` — a slide carrying `renderState` never carries drawable
   * content (`SlideCard.vue`/`PresentationViewer.vue` render pending/failed
   * chrome instead of the normal `contentKind: 'image'` `<img>` path). Set
   * only by `src/utils/importedRenderReconciler.ts`'s `importedEntryContent`;
   * absent on every slide from every other content path (lyric, scripture,
   * text, video, or a rendered-ready image with a resolved URL).
   */
  renderState?: 'pending' | 'failed'
  /**
   * The raw machine slug copied unchanged off the render document's own
   * `failureReason` (e.g. `'incomplete-render'`, `'render-service-error'`).
   * Present only alongside `renderState: 'failed'`. Never rendered directly —
   * it MUST route through the failure-sentence lookup 42-06 introduces
   * (`slideDisplay.ts`), whose fallback arm exists precisely so an unmapped
   * slug never surfaces to a congregation as raw text (T-42-04). This field
   * carries the untranslated slug on purpose, named so that displaying it
   * verbatim looks obviously wrong at the call site.
   */
  renderFailureReason?: string
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
  /**
   * R095/R096/R097 (Phase 47): 'ALL' is an additive third value — every
   * section persisted before this phase carries only 'LEADER' or
   * 'CONGREGATION' and remains valid with no migration. 'ALL' marks a
   * section every voice reads together (unison), distinct from the
   * two-party call-and-response the original two values model.
   */
  speaker: 'LEADER' | 'CONGREGATION' | 'ALL'
  text: string
  verseRange?: string
  /**
   * R092 (Phase 45): which Bible translation this section's text was fetched
   * from, stamped ONCE by `CongregationalEditor.vue` at fetch time from the
   * church's CURRENT `bibleVersion` setting. OPTIONAL — a section created
   * before this phase has no such field and resolves to `'ESV'` at read time
   * via `resolveTranslationSource()` (the only source before this phase).
   * Never re-derived from the org's setting after stamping — that is the
   * whole point of the field (see `resolveTranslationSource` in
   * `src/utils/scripture.ts`).
   */
  translationSource?: 'ESV' | 'NLT'
}

/** A scripture slide — one chunk of a Bible passage. */
export interface ScriptureSlide extends SlideBase {
  contentKind: 'scripture'
  reference: string
  bookRef: import('./service').ScriptureRef
  text: string
  verseRange: string
  readingMode: 'normal' | 'congregational'
  /**
   * The ONE congregational section this slide carries, when it is a
   * Congregational-state slide (38-02). A congregational reading materializes
   * one slide per section (D1, phase 38-01) — this field is deliberately
   * singular, not a list, so "several sections stacked on one slide" is
   * unrepresentable. Absent entirely on a Reference-state slide.
   */
  section?: CongregationalSection
  /**
   * R092 (Phase 45): the translation this slide's text was fetched from,
   * threaded from the owning `CongregationalSection`/`SourceRef` with no
   * re-derivation at assembly time. OPTIONAL for the same field-less-fallback
   * reason as `CongregationalSection.translationSource` above — read this
   * only through `resolveTranslationSource()`, never a raw `??` against the
   * org's current setting.
   */
  translationSource?: 'ESV' | 'NLT'
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
