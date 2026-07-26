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
import type { Service, ServiceSlot } from '@/types/service'
import type { AssembledSlide, Slide, LyricSlide, CopyrightSlide, TextSlide, VideoSlide } from '@/types/slide'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { ImportedDeck } from '@/types/importedDeck'
import type { SlideGroup, GroupSlideEntry, SourceRef } from '@/types/slideGroup'
import { slotLabel } from './slotTypes'

/** Content maps the assembly engine resolves slots against. Pre-loaded by the caller. */
export interface AssemblyInputs {
  songLyricsById: Map<string, SongLyrics>
  performanceOrderById: Map<string, string[]>
  scriptureReadingsById: Map<string, ScriptureReading>
  importedDecksById: Map<string, ImportedDeck>
  /**
   * Stored slide-group structure keyed by the anchoring `ServiceSlot.id`
   * (D-01). REQUIRED — an empty map is the legitimate "no groups
   * materialized yet" state and every slot falls through to the fallback
   * derivation path, producing today's output.
   */
  groupsBySlotId: Map<string, SlideGroup>
}

/** A Slide variant's fields minus the id/position this engine assigns on emit. */
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never
type SlideContent = DistributiveOmit<Slide, 'id' | 'position'>

/**
 * Order-source precedence for a song's lyric sections (research fallback chain):
 * 1. `performanceOrderById.get(songId)` if present and non-empty
 * 2. `lyrics.performanceOrder` if non-empty
 * 3. `lyrics.sections` mapped in stored order
 */
function resolveSongOrder(songId: string, lyrics: SongLyrics, inputs: AssemblyInputs): string[] {
  const explicitOrder = inputs.performanceOrderById.get(songId)
  if (explicitOrder && explicitOrder.length > 0) return explicitOrder
  if (lyrics.performanceOrder.length > 0) return lyrics.performanceOrder
  return lyrics.sections.map((section) => section.id)
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
      return ref.scriptureReadingId
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
      const reading = inputs.scriptureReadingsById.get(ref.scriptureReadingId)
      if (!reading) return undefined
      const innerSlide = reading.slides.find((s) => s.id === ref.innerSlideId)
      if (!innerSlide) return undefined
      const { id: _id, position: _position, ...rest } = innerSlide
      return rest
    }

    case 'imported': {
      const deck = inputs.importedDecksById.get(ref.importId)
      if (!deck) return undefined
      const innerSlide = deck.slides.find((s) => s.id === ref.innerSlideId)
      if (!innerSlide) return undefined
      const { id: _id, position: _position, ...rest } = innerSlide
      return rest
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

/** D-04 two-level audio precedence for one group entry. Video has no bed layer (D-18) — a video slide's own source resolves through `resolveEntryContent`, not here. */
interface ResolvedGroupMedia {
  audioUrl?: string
  audioLoop?: boolean
  audioFromBed: boolean
}

function resolveEntryMedia(group: SlideGroup, entry: GroupSlideEntry): ResolvedGroupMedia {
  // Effective audio: the entry's OWN audio wins; otherwise fall back to the
  // group's bed. `audioFromBed` is true only in the fallback case.
  const audioFromBed = !entry.audioUrl && !!group.bedAudioUrl
  const resolvedAudioUrl = entry.audioUrl ?? group.bedAudioUrl

  const media: ResolvedGroupMedia = { audioFromBed }
  if (resolvedAudioUrl) media.audioUrl = resolvedAudioUrl
  // A group bed never loops (D-04) — audioLoop is copied ONLY when the audio
  // came from the entry itself, never when it resolved from the bed.
  if (!audioFromBed && entry.audioUrl && entry.audioLoop) media.audioLoop = true
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
  // Fallback-path-only bookkeeping: a slot with no materialized group yet
  // keeps the pre-Phase-24 first-emitted-slide-only media rule (D-04
  // REPLACES this rule on the group path — it is not extended there), so a
  // not-yet-migrated service keeps behaving exactly as it did before.
  const slotsWithMediaAttached = new Set<number>()

  const emitFallback = (
    slot: ServiceSlot,
    slotIndex: number,
    content: SlideContent,
    sourceId: string | null,
    localSeq: number,
  ): void => {
    // Fallback ids derive from the slot's stable id (not the slot's array
    // index), so a pre-materialization render is stable across recomputes.
    const slide = { ...content, id: `${slot.id}:${localSeq}`, position: globalPosition } as Slide
    if (!slotsWithMediaAttached.has(slotIndex)) {
      slotsWithMediaAttached.add(slotIndex)
      if (slot.audioUrl) slide.audioUrl = slot.audioUrl
      // A legacy slot-level videoUrl is dropped, not migrated (D-18/D-19) —
      // there is no bed-video carrier left on SlideBase to assign it to.
    }
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
    const media = resolveEntryMedia(group, entry)
    const slide = {
      ...content,
      // Never recompute — the stored GroupSlideEntry.id IS the slide id
      // (Phase 23 WR-02 keys media children on it).
      id: entry.id,
      position: globalPosition,
      ...(media.audioUrl ? { audioUrl: media.audioUrl } : {}),
      ...(media.audioLoop ? { audioLoop: true } : {}),
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

  for (const { slot, index } of sorted) {
    const group = inputs.groupsBySlotId.get(slot.id)
    if (group) {
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

        const order = resolveSongOrder(slot.songId, lyrics, inputs)
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
        if (!slot.scriptureReadingId) break
        const reading: ScriptureReading | undefined = inputs.scriptureReadingsById.get(slot.scriptureReadingId)
        if (!reading) break

        reading.slides.forEach((innerSlide, localSeq) => {
          const { id: _id, position: _position, ...rest } = innerSlide
          emitFallback(slot, index, rest, slot.scriptureReadingId!, localSeq)
        })
        break
      }

      case 'IMPORTED': {
        if (!slot.importId) break
        const deck: ImportedDeck | undefined = inputs.importedDecksById.get(slot.importId)
        if (!deck) break

        deck.slides.forEach((innerSlide, localSeq) => {
          const { id: _id, position: _position, ...rest } = innerSlide
          emitFallback(slot, index, rest, slot.importId!, localSeq)
        })
        break
      }

      case 'PRAYER':
      case 'MESSAGE': {
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
