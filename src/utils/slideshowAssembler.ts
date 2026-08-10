/**
 * Slideshow auto-assembly engine (R005, refactored Phase 24 D-02/D-04).
 *
 * `assembleSlideshow` is a PURE function: it takes a Service and pre-loaded
 * content maps and returns a flat, ordered `AssembledSlide[]`. It performs no
 * Firestore reads and touches no Pinia store or Vue reactivity — callers
 * (the reactive composable in 20-03/24-04) are responsible for loading the
 * content maps and re-invoking this function when inputs change. Because
 * output order is derived solely from `service.slots` sorted by `position`
 * (and, within a slot, `GroupSlideEntry.order`), reordering the input slots
 * deterministically reorders the output (the R006 contract).
 *
 * Two resolution paths, per slot:
 * 1. A slot with a materialized `SlideGroup` (`inputs.groupsBySlotId`) joins
 *    that group's stored structure against LIVE canonical content resolved
 *    through each entry's `sourceRef` (D-02) — editing a song's lyrics
 *    changes the assembled text with no group write. Slide ids equal the
 *    stored `GroupSlideEntry.id`, never recomputed (Phase 23 WR-02). Audio
 *    resolves via D-04's two-level precedence (`resolveEntryMedia`); video
 *    has no bed layer (D-18) and resolves only from a video slide's own
 *    `sourceRef` in `resolveEntryContent`.
 * 2. A slot with NO materialized group yet falls back to deriving the
 *    slideshow directly from the slot's own source (today's pre-Phase-24
 *    behaviour), so the app stays coherent before 24-05/24-06 wire up
 *    reactive group subscription and lazy materialization. Fallback slide
 *    ids are derived from the slot's stable `id` (not slot array index), so
 *    a pre-materialization render cannot churn Vue keys across recomputes.
 */
import type { Service, ServiceSlot, ScriptureRef } from '@/types/service'
import type { AssembledSlide, Slide, LyricSlide, CopyrightSlide, ScriptureSlide, TextSlide, VideoSlide } from '@/types/slide'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { ImportedDeck } from '@/types/importedDeck'
import type { SlideGroup, GroupSlideEntry, SourceRef } from '@/types/slideGroup'
import type { PptxRenderDoc } from '@/types/pptxRender'
import { slotLabel } from './slotTypes'
import {
  formatScriptureReference,
  scriptureRefFromSlot,
  congregationalSectionsFromSlot,
  congregationalSectionFromRef,
} from './scripture'
import { resolveImportedRender, importedEntryIdentities, importedEntryContent } from './importedRenderReconciler'

/** Content maps the assembly engine resolves slots against. Pre-loaded by the caller. */
export interface AssemblyInputs {
  songLyricsById: Map<string, SongLyrics>
  scriptureReadingsById: Map<string, ScriptureReading>
  importedDecksById: Map<string, ImportedDeck>
  /**
   * Stored slide-group structure keyed by the anchoring `ServiceSlot.id`
   * (D-01). REQUIRED — an empty map is the legitimate "no groups
   * materialized yet" state and every slot falls through to the fallback
   * derivation path, producing today's output.
   */
  groupsBySlotId: Map<string, SlideGroup>
  /**
   * Phase 42 (R079/R080) render-status documents, keyed by
   * `ImportedDeck.renderImportId` — NOT by `ImportedDeck.id`/
   * `ImportedSlot.importId`, which is what the sibling `importedDecksById`
   * above is keyed by. The two identifiers are deliberately distinct
   * (`src/types/importedDeck.ts:19-30`); conflating them shows one deck's
   * render status under another deck's identity (T-42-07). OPTIONAL — an
   * absent map is the legitimate "no render data loaded" state, and for a
   * deck with no `renderImportId` this must behave byte-identically to
   * today's parsed-text-only path regardless of whether this map is present.
   */
  pptxRendersByImportId?: Map<string, PptxRenderDoc>
  /**
   * Phase 42 (R079/R080) resolved rendered-page download URLs, keyed by
   * `ImportedDeck.renderImportId` (same keying caveat as
   * `pptxRendersByImportId` above — NOT `ImportedDeck.id`). Array index `i`
   * holds the URL for page `i + 1` — the single 1-based↔0-based boundary in
   * the whole phase; every other consumer goes through
   * `renderedPageNumberFromIdentity` instead of touching this index
   * directly. OPTIONAL for the same "no render data loaded yet" reason as
   * `pptxRendersByImportId`.
   */
  renderedImageUrlsByImportId?: Map<string, string[]>
}

/** A Slide variant's fields minus the id/position this engine assigns on emit. */
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never
type SlideContent = DistributiveOmit<Slide, 'id' | 'position'>

/**
 * R105 (Phase 49): the SINGLE producer of reference-only scripture slide
 * content — a plain scripture reference slide AND the dedicated leading
 * reference slide of a congregational reading are byte-identical by
 * construction (AC3). Called from all THREE reference-slide sites:
 * `resolveEntryContent`'s `section === null` branch, the SCRIPTURE fallback's
 * `sections.length === 0` branch, and the new synthetic leading-slide emission
 * on both assembly paths. `readingMode: 'normal'`, empty `text`/`verseRange`,
 * and NO `section` field — exactly today's plain reference-slide shape.
 */
function buildScriptureReferenceContent(ref: ScriptureRef): Omit<ScriptureSlide, 'id' | 'position'> {
  return {
    contentKind: 'scripture',
    reference: formatScriptureReference(ref),
    bookRef: ref,
    text: '',
    verseRange: '',
    readingMode: 'normal',
  }
}

function buildCopyrightSlideContent(lyrics: SongLyrics): Omit<CopyrightSlide, 'id' | 'position'> {
  return {
    contentKind: 'lyric',
    title: lyrics.copyright.title,
    authors: lyrics.copyright.authors,
    ccliSongNumber: lyrics.copyright.ccliSongNumber,
    copyrightLines: lyrics.copyright.copyrightLines,
    ccliLicenseNumber: lyrics.copyright.ccliLicenseNumber,
  }
}

/** The `text`-kind entry has no fields of its own — its content depends on
 * which text-backed slot kind (PRAYER/MESSAGE/HYMN) owns the group. */
function buildTextContentForSlot(slot: ServiceSlot): Omit<TextSlide, 'id' | 'position'> | undefined {
  switch (slot.kind) {
    case 'PRAYER':
    case 'MESSAGE':
    case 'ANNOUNCEMENTS':
    case 'MISC':
      // The congregation-facing projected slide shows the kind label, NOT the
      // planner's `body` text (43-01 recorded decision, see 43-01-SUMMARY.md).
      // `sourceSignature` returns `undefined` for every text-backed kind, so a
      // projected slide derived from `body` would have no change-detection
      // signal and a `body` edit would leave a stale materialized group
      // behind. Team-facing print/share surfaces (plan 04) DO render `body`.
      return { contentKind: 'text', title: slotLabel(slot), body: slotLabel(slot) }
    case 'HYMN': {
      const body = slot.verses ? `${slot.hymnName}\n\n${slot.verses}` : slot.hymnName
      return { contentKind: 'text', title: slotLabel(slot), body }
    }
    default:
      return undefined
  }
}

/** The canonical id a group-resolved slide's `sourceId` derives from, mirroring
 * the fallback path's `sourceId` semantics (songId/scriptureReadingId/importId/null). */
function sourceIdForRef(ref: SourceRef): string | null {
  switch (ref.kind) {
    case 'lyric':
    case 'copyright':
      return ref.songId
    case 'scripture':
      // R047: a slot-derived reference has no canonical record behind it. A
      // legacy stored id is surfaced if present, purely so an old entry's
      // sourceId does not change shape underneath a consumer.
      return ref.scriptureReadingId ?? null
    case 'imported':
      return ref.importId
    case 'text':
    case 'video':
      // A dropped video has no canonical record behind it (D-17) — same
      // no-canonical-record convention as the `text` case.
      return null
  }
}

/**
 * Resolves a stored `GroupSlideEntry`'s content against LIVE canonical
 * sources (D-02). Returns `undefined` when the entry's source no longer
 * resolves — the caller OMITS such an entry from the assembled output rather
 * than substituting a placeholder, because the assembled slideshow feeds a
 * live projector. The entry remains stored, unaffected.
 */
function resolveEntryContent(
  slot: ServiceSlot,
  entry: GroupSlideEntry,
  inputs: AssemblyInputs,
): SlideContent | undefined {
  const ref = entry.sourceRef
  switch (ref.kind) {
    case 'lyric': {
      const lyrics = inputs.songLyricsById.get(ref.songId)
      if (!lyrics) return undefined
      const section = lyrics.sections.find((s) => s.id === ref.sectionId)
      if (!section) return undefined
      const content: Omit<LyricSlide, 'id' | 'position'> = {
        contentKind: 'lyric',
        sectionId: section.id,
        sectionLabel: section.label,
        lines: section.lines,
      }
      return content
    }

    case 'copyright': {
      const lyrics = inputs.songLyricsById.get(ref.songId)
      if (!lyrics) return undefined
      return buildCopyrightSlideContent(lyrics)
    }

    case 'scripture': {
      // R047 (unchanged): `reference`/`bookRef` are ALWAYS resolved LIVE from
      // the owning slot — the slot is the canonical record for both a
      // Reference entry and a Congregational section entry — so an entry
      // whose slot has lost its reference still resolves to nothing here,
      // and editing the passage on the Service Order tab changes every
      // section slide's reference with no group write.
      if (slot.kind !== 'SCRIPTURE') return undefined
      const scriptureRef = scriptureRefFromSlot(slot)
      if (!scriptureRef) return undefined

      // D1/D2: `congregationalSectionFromRef` is the ONE place this function
      // decides which of the group's two states `entry` belongs to.
      // - null (a Reference entry): today's shape exactly — empty text/verseRange,
      //   readingMode 'normal', no `section` key at all.
      // - a section (a Congregational entry, D2): the entry's OWN stored words
      //   — there is no canonical record to resolve against once detached —
      //   with readingMode 'congregational' and the singular `section` field.
      //   Each assembled slide carries exactly one section (38-02).
      //
      // R105 (Phase 49): the reference eyebrow no longer lives on the first
      // section slide — it has its own dedicated leading slide, emitted at
      // assembly time (see the synthetic emission in `assembleSlideshow`). So
      // a section slide no longer carries any first/later distinction, and
      // `isFirstSection` is gone from the type entirely.
      const section = congregationalSectionFromRef(entry.sourceRef)
      const content: Omit<ScriptureSlide, 'id' | 'position'> =
        section === null
          ? buildScriptureReferenceContent(scriptureRef)
          : {
              contentKind: 'scripture',
              reference: formatScriptureReference(scriptureRef),
              bookRef: scriptureRef,
              text: section.text,
              verseRange: section.verseRange ?? '',
              readingMode: 'congregational',
              section,
              // R092: read back the passthrough SourceRef.translationSource —
              // never re-derived here. Absent when the ref carries none
              // (pre-phase entry), which resolveTranslationSource() later
              // reads as 'ESV'.
              ...(ref.translationSource !== undefined ? { translationSource: ref.translationSource } : {}),
            }
      return content
    }

    case 'imported': {
      const deck = inputs.importedDecksById.get(ref.importId)
      if (!deck) return undefined
      // Phase 42 (R079/R080): route through the ONE shared reconciler both
      // this stored-group path and the no-group fallback below call into —
      // the grid (slideGroupMaterializer.ts, 42-04) and the presenter must
      // never independently derive render state. LOAD-BEARING: for a
      // pending/failed render, `importedEntryContent` returns a DEFINED,
      // non-drawable object (never `undefined`), so the `if (!content)
      // continue` guard below can never omit it — omitting it would shorten
      // a live slideshow mid-service (42-UI-SPEC.md). Do not "tidy" that
      // guard into skipping render-state slides.
      const render = deck.renderImportId ? inputs.pptxRendersByImportId?.get(deck.renderImportId) : undefined
      const resolution = resolveImportedRender(deck, render)
      const urls = deck.renderImportId ? inputs.renderedImageUrlsByImportId?.get(deck.renderImportId) : undefined
      return importedEntryContent(deck, resolution, ref.innerSlideId, urls)
    }

    case 'text': {
      // A ref carrying its own authored body (D-17: a user-added blank slide)
      // wins over the slot-derived fallback. An authored body with no title
      // is valid; a ref with no authored body at all falls through unchanged
      // to today's slot-derived behavior.
      if (ref.body !== undefined) {
        const content: Omit<TextSlide, 'id' | 'position'> = {
          contentKind: 'text',
          ...(ref.title !== undefined ? { title: ref.title } : {}),
          body: ref.body,
        }
        return content
      }
      return buildTextContentForSlot(slot)
    }

    case 'video': {
      const content: Omit<VideoSlide, 'id' | 'position'> = {
        contentKind: 'video',
        videoSrc: ref.videoSrc,
        ...(ref.originalFileName !== undefined ? { originalFileName: ref.originalFileName } : {}),
      }
      return content
    }
  }
}

/**
 * D-04 two-level audio precedence for one group entry, plus the R055/R056/R057
 * three-level background cascade (slide → group → song). Video has no bed
 * layer (D-18) — a video slide's own source resolves through
 * `resolveEntryContent`, not here.
 */
interface ResolvedGroupMedia {
  audioUrl?: string
  audioLoop?: boolean
  audioFromBed: boolean
  backgroundImageUrl?: string
  backgroundSource?: 'slide' | 'group' | 'song'
}

/**
 * WR-01 behavioral decision (confirm at human-verify): a `video`-kind entry
 * NEVER resolves the group's bed audio, even when it has no `entry.audioUrl`
 * of its own and the group DOES have a `bedAudioUrl`. This extends D-04's
 * "slide beats group" precedence to video — a dropped video slide carries its
 * own soundtrack inside `videoSrc` (rendered by `PresentationViewer`'s own
 * `VideoPlayer`, unmuted by default), so layering the group's `AudioPlayer`
 * underneath it would play two unrelated audio sources at once with no
 * on-screen indication. The bed is not paused/stopped globally — it simply
 * resolves normally on whatever slide follows, since this function runs
 * independently per entry with no cross-entry state, matching D-18's framing
 * of a video slide as a self-contained unit.
 */
function resolveEntryMedia(
  group: SlideGroup,
  entry: GroupSlideEntry,
  song: SongLyrics | undefined,
): ResolvedGroupMedia {
  // R055/R056/R057: slide → group → song, most specific wins. Computed
  // BEFORE the video early return below (★ Pitfall 1, 33-RESEARCH.md) — a
  // video slide's own audio bed is deliberately suppressed (two audio
  // sources would collide audibly), but a video slide's background is NOT
  // suppressed the same way: a video's own picture already covers the
  // background, and there is no collision to avoid. See 33-UI-SPEC.md §9.
  // ★ Pitfall 3: `song` is legitimately `undefined` for non-SONG groups
  // (PRAYER/SCRIPTURE/MESSAGE/HYMN/IMPORTED) — optional-chain the song tier
  // so resolving a group with no owning song never throws.
  const backgroundImageUrl = entry.backgroundImageUrl ?? group.backgroundImageUrl ?? song?.backgroundImageUrl
  const backgroundSource: 'slide' | 'group' | 'song' | undefined = entry.backgroundImageUrl
    ? 'slide'
    : group.backgroundImageUrl
      ? 'group'
      : song?.backgroundImageUrl
        ? 'song'
        : undefined

  if (entry.sourceRef.kind === 'video') {
    const videoMedia: ResolvedGroupMedia = { audioFromBed: false }
    if (backgroundImageUrl) videoMedia.backgroundImageUrl = backgroundImageUrl
    if (backgroundSource) videoMedia.backgroundSource = backgroundSource
    return videoMedia
  }

  // Effective audio: the entry's OWN audio wins; otherwise fall back to the
  // group's bed. `audioFromBed` is true only in the fallback case.
  const audioFromBed = !entry.audioUrl && !!group.bedAudioUrl
  const resolvedAudioUrl = entry.audioUrl ?? group.bedAudioUrl

  const media: ResolvedGroupMedia = { audioFromBed }
  if (resolvedAudioUrl) media.audioUrl = resolvedAudioUrl
  // A group bed never loops (D-04) — audioLoop is copied ONLY when the audio
  // came from the entry itself, never when it resolved from the bed.
  if (!audioFromBed && entry.audioUrl && entry.audioLoop) media.audioLoop = true
  if (backgroundImageUrl) media.backgroundImageUrl = backgroundImageUrl
  if (backgroundSource) media.backgroundSource = backgroundSource
  return media
}

/**
 * Walks `service.slots` sorted ascending by `position` and resolves each slot
 * into zero or more `AssembledSlide`s, flattening the result into a single
 * ordered array. Empty slots (no songId/scriptureReadingId) and slots whose
 * referenced content isn't present in the input maps are skipped, not errored.
 */
export function assembleSlideshow(service: Service, inputs: AssemblyInputs): AssembledSlide[] {
  // Pair each slot with its own array index (the "source slot's array index"
  // that AssembledSlide.slotIndex carries) before sorting by position, so
  // slotIndex reflects provenance in service.slots regardless of position values.
  const indexed = service.slots.map((slot, index) => ({ slot, index }))
  const sorted = [...indexed].sort((a, b) => a.slot.position - b.slot.position)

  const assembled: AssembledSlide[] = []
  let globalPosition = 0

  const emitFallback = (
    slot: ServiceSlot,
    slotIndex: number,
    content: SlideContent,
    sourceId: string | null,
    // R105: normally the numeric section/section-index sequence; the synthetic
    // leading reference slide passes the string 'ref' so its id
    // (`${slot.id}:ref`) cannot collide with any numeric section id.
    localSeq: number | string,
  ): void => {
    // Fallback ids derive from the slot's stable id (not the slot's array
    // index), so a pre-materialization render is stable across recomputes.
    // No legacy slot-level audioUrl/videoUrl carry-over here (D-19) — the
    // slide area has never shipped, so there is no legacy media to honor;
    // a slot with no materialized group yet simply renders with no media.
    const slide = { ...content, id: `${slot.id}:${localSeq}`, position: globalPosition } as Slide
    assembled.push({
      slide,
      slotIndex,
      slotKind: slot.kind,
      section: slot.section,
      sourceId,
    })
    globalPosition += 1
  }

  const emitFromGroup = (
    slot: ServiceSlot,
    slotIndex: number,
    group: SlideGroup,
    entry: GroupSlideEntry,
    content: SlideContent,
  ): void => {
    // WR-01: song lookup keyed on the GROUP's owning song (via the slot),
    // not the individual entry's own `sourceRef.kind`. A SONG group's
    // `slides` array can legitimately contain `text`/`video` entries
    // (slideGroupMaterializer.ts's reconciler carries them through by value,
    // preserved from before R054's Phase-30 lockdown) — keying on
    // `entry.sourceRef.kind` alone left those entries unable to resolve the
    // song background tier even though every sibling lyric/copyright slide
    // in the SAME group correctly fell through to it. Every other slot kind
    // (PRAYER/SCRIPTURE/MESSAGE/HYMN/IMPORTED) has no owning song document,
    // so `song` stays `undefined` for them (★ Pitfall 3).
    const song =
      slot.kind === 'SONG' && slot.songId
        ? inputs.songLyricsById.get(slot.songId)
        : entry.sourceRef.kind === 'lyric' || entry.sourceRef.kind === 'copyright'
          ? inputs.songLyricsById.get(entry.sourceRef.songId)
          : undefined
    const media = resolveEntryMedia(group, entry, song)
    const slide = {
      ...content,
      // Never recompute — the stored GroupSlideEntry.id IS the slide id
      // (Phase 23 WR-02 keys media children on it).
      id: entry.id,
      position: globalPosition,
      ...(media.audioUrl ? { audioUrl: media.audioUrl } : {}),
      ...(media.audioLoop ? { audioLoop: true } : {}),
      ...(media.backgroundImageUrl ? { backgroundImageUrl: media.backgroundImageUrl } : {}),
      ...(media.backgroundSource ? { backgroundSource: media.backgroundSource } : {}),
    } as Slide
    assembled.push({
      slide,
      slotIndex,
      slotKind: slot.kind,
      section: slot.section,
      sourceId: sourceIdForRef(entry.sourceRef),
      groupId: group.id,
      groupSlideId: entry.id,
      audioFromBed: media.audioFromBed,
    })
    globalPosition += 1
  }

  /**
   * R105 (Phase 49, approach B): the dedicated leading reference slide of a
   * congregational reading on the STORED-GROUP path. It is NOT a stored
   * `GroupSlideEntry` (see 49-CONTEXT.md) — it is synthesised here, so it must
   * resolve group media the way an entry-less section slide would: background
   * from the GROUP tier (`backgroundSource: 'group'`), bed audio from
   * `group.bedAudioUrl` with `audioFromBed: true` and `groupId: group.id` set,
   * so the presenter's `AudioPlayer` key `group:{groupId}:{url}` stays
   * continuous across the reference->section transition (AC7). NO
   * `groupSlideId` is set — there is no entry, and media never keys on a
   * fabricated entry id (background reads `slide.backgroundImageUrl`, audio
   * keys on `groupId`); omitting it is what preserves the Phase 23 WR-02
   * invariant rather than inventing an id to violate it.
   */
  const emitSyntheticReferenceFromGroup = (
    slot: ServiceSlot,
    slotIndex: number,
    group: SlideGroup,
    ref: ScriptureRef,
  ): void => {
    const backgroundImageUrl = group.backgroundImageUrl
    const audioUrl = group.bedAudioUrl
    const slide = {
      ...buildScriptureReferenceContent(ref),
      id: `${slot.id}:ref`,
      position: globalPosition,
      ...(audioUrl ? { audioUrl } : {}),
      ...(backgroundImageUrl ? { backgroundImageUrl } : {}),
      ...(backgroundImageUrl ? { backgroundSource: 'group' as const } : {}),
    } as Slide
    assembled.push({
      slide,
      slotIndex,
      slotKind: slot.kind,
      section: slot.section,
      // A slot-derived reference has no canonical record behind it (R047).
      sourceId: null,
      groupId: group.id,
      // No groupSlideId — there is no entry (WR-02 boundary, see above).
      audioFromBed: !!audioUrl,
    })
    globalPosition += 1
  }

  for (const { slot, index } of sorted) {
    const group = inputs.groupsBySlotId.get(slot.id)
    if (group) {
      // R105 (approach B, LOCKED): a congregational SCRIPTURE reading gets a
      // dedicated leading reference slide emitted here, BEFORE the entry loop.
      // Gate on the SAME slot-side predicate the fallback path uses
      // (`congregationalSectionsFromSlot`) so the two paths agree on whether
      // to emit it — and so a PLAIN slot, whose stored group holds one
      // reference entry and zero sections, never gets a second synthetic
      // reference prepended.
      if (slot.kind === 'SCRIPTURE' && congregationalSectionsFromSlot(slot).length > 0) {
        const scriptureRef = scriptureRefFromSlot(slot)
        if (scriptureRef) emitSyntheticReferenceFromGroup(slot, index, group, scriptureRef)
      }
      const orderedEntries = [...group.slides].sort((a, b) => a.order - b.order)
      for (const entry of orderedEntries) {
        const content = resolveEntryContent(slot, entry, inputs)
        if (!content) continue // Entry's source no longer resolves — omitted, not placeholder'd.
        emitFromGroup(slot, index, group, entry, content)
      }
      continue
    }

    // No stored group for this slot yet — fall back to today's per-kind derivation.
    switch (slot.kind) {
      case 'SONG': {
        if (!slot.songId) break
        const lyrics = inputs.songLyricsById.get(slot.songId)
        if (!lyrics) break

        // The lyrics document's performanceOrder is the single source of
        // truth for a song's slide order (R035/D-03) — no precedence chain.
        const order = lyrics.performanceOrder
        const copyrightContent = buildCopyrightSlideContent(lyrics)

        let localSeq = 0
        emitFallback(slot, index, copyrightContent, slot.songId, localSeq++)

        for (const sectionId of order) {
          const section = lyrics.sections.find((s) => s.id === sectionId)
          if (!section) continue
          const lyricContent: Omit<LyricSlide, 'id' | 'position'> = {
            contentKind: 'lyric',
            sectionId: section.id,
            sectionLabel: section.label,
            lines: section.lines,
          }
          emitFallback(slot, index, lyricContent, slot.songId, localSeq++)
        }

        emitFallback(slot, index, copyrightContent, slot.songId, localSeq++)
        break
      }

      case 'SCRIPTURE': {
        const scriptureRef = scriptureRefFromSlot(slot)
        if (!scriptureRef) break

        // D1: the fallback path must agree slide-for-slide with the
        // stored-group path (`resolveEntryContent`'s scripture case) — a
        // slot's slide content must not visibly change the moment its group
        // document materializes. With no sections this is R047's original
        // single reference-only slide, unchanged. With sections present,
        // R105 emits the dedicated leading reference slide FIRST, then one
        // fallback slide per section, same fields as the stored-group path,
        // advancing the local sequence number per section so derived fallback
        // ids stay distinct and stable.
        const sections = congregationalSectionsFromSlot(slot)
        const reference = formatScriptureReference(scriptureRef)

        if (sections.length === 0) {
          // No canonical record id behind a slot-derived reference — same
          // convention `sourceIdForRef` now applies to a payload-free ref.
          emitFallback(slot, index, buildScriptureReferenceContent(scriptureRef), null, 0)
          break
        }

        // R105 (approach B): the dedicated leading reference slide, byte-
        // identical to a plain reference slide via the shared helper. The
        // fallback path carries NO media (D-19: no legacy slot-level media),
        // so this slide gets none either. Id suffix 'ref' keeps it clear of
        // the numeric section ids below.
        emitFallback(slot, index, buildScriptureReferenceContent(scriptureRef), null, 'ref')

        sections.forEach((section, localSeq) => {
          const content: Omit<ScriptureSlide, 'id' | 'position'> = {
            contentKind: 'scripture',
            reference,
            bookRef: scriptureRef,
            text: section.text,
            verseRange: section.verseRange ?? '',
            readingMode: 'congregational',
            section,
            // R092: same passthrough as the stored-group path above — read
            // straight off the slot's own section, never re-derived.
            ...(section.translationSource !== undefined ? { translationSource: section.translationSource } : {}),
          }
          emitFallback(slot, index, content, null, localSeq)
        })
        break
      }

      case 'IMPORTED': {
        if (!slot.importId) break
        const deck: ImportedDeck | undefined = inputs.importedDecksById.get(slot.importId)
        if (!deck) break

        // Phase 42 (R079/R080): the fallback path must agree slide-for-slide
        // with the stored-group path above — same reconciler, same identity
        // list, same content resolution — exactly as the SCRIPTURE fallback's
        // own comment already requires for its kind. Skip an identity ONLY
        // when the helper returns `undefined`, which can happen only in
        // `parsed` mode (a re-import that dropped an inner slide id).
        const render = deck.renderImportId ? inputs.pptxRendersByImportId?.get(deck.renderImportId) : undefined
        const resolution = resolveImportedRender(deck, render)
        const urls = deck.renderImportId ? inputs.renderedImageUrlsByImportId?.get(deck.renderImportId) : undefined
        const identities = importedEntryIdentities(deck, resolution)

        identities.forEach((innerSlideId, localSeq) => {
          const content = importedEntryContent(deck, resolution, innerSlideId, urls)
          if (!content) return
          emitFallback(slot, index, content, slot.importId!, localSeq)
        })
        break
      }

      case 'PRAYER':
      case 'MESSAGE':
      case 'ANNOUNCEMENTS':
      case 'MISC': {
        const content: Omit<TextSlide, 'id' | 'position'> = {
          contentKind: 'text',
          title: slotLabel(slot),
          body: slotLabel(slot),
        }
        emitFallback(slot, index, content, null, 0)
        break
      }

      case 'HYMN': {
        const body = slot.verses ? `${slot.hymnName}\n\n${slot.verses}` : slot.hymnName
        const content: Omit<TextSlide, 'id' | 'position'> = {
          contentKind: 'text',
          title: slotLabel(slot),
          body,
        }
        emitFallback(slot, index, content, null, 0)
        break
      }
    }
  }

  return assembled
}
