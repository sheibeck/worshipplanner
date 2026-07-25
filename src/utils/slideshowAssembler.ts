/**
 * Slideshow auto-assembly engine (R005).
 *
 * `assembleSlideshow` is a PURE function: it takes a Service and pre-loaded
 * content maps and returns a flat, ordered `AssembledSlide[]`. It performs no
 * Firestore reads and touches no Pinia store or Vue reactivity — callers
 * (the reactive composable in 20-03) are responsible for loading the content
 * maps and re-invoking this function when inputs change. Because output order
 * is derived solely from `service.slots` sorted by `position`, reordering the
 * input slots deterministically reorders the output (the R006 contract,
 * proven at this pure-function layer).
 */
import type { Service, ServiceSlot } from '@/types/service'
import type { AssembledSlide, Slide, LyricSlide, CopyrightSlide, TextSlide } from '@/types/slide'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { ImportedDeck } from '@/types/importedDeck'
import { slotLabel } from './slotTypes'

/** Content maps the assembly engine resolves slots against. Pre-loaded by the caller. */
export interface AssemblyInputs {
  songLyricsById: Map<string, SongLyrics>
  performanceOrderById: Map<string, string[]>
  scriptureReadingsById: Map<string, ScriptureReading>
  importedDecksById: Map<string, ImportedDeck>
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
  // Tracks which slots have already had their (first-emitted-slide-only) media
  // attached, keyed by slotIndex — a slot's audioUrl/videoUrl land on only the
  // FIRST AssembledSlide it produces (e.g. the leading copyright slide for a
  // SONG), never on subsequent slides of a multi-slide slot.
  const slotsWithMediaAttached = new Set<number>()

  const emit = (
    slot: ServiceSlot,
    slotIndex: number,
    content: SlideContent,
    sourceId: string | null,
    localSeq: number,
  ): void => {
    const slide = { ...content, id: `${slotIndex}:${localSeq}`, position: globalPosition } as Slide
    if (!slotsWithMediaAttached.has(slotIndex)) {
      slotsWithMediaAttached.add(slotIndex)
      if (slot.audioUrl) slide.audioUrl = slot.audioUrl
      if (slot.videoUrl) slide.videoUrl = slot.videoUrl
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

  for (const { slot, index } of sorted) {
    switch (slot.kind) {
      case 'SONG': {
        if (!slot.songId) break
        const lyrics = inputs.songLyricsById.get(slot.songId)
        if (!lyrics) break

        const order = resolveSongOrder(slot.songId, lyrics, inputs)
        const copyrightContent = buildCopyrightSlideContent(lyrics)

        let localSeq = 0
        emit(slot, index, copyrightContent, slot.songId, localSeq++)

        for (const sectionId of order) {
          const section = lyrics.sections.find((s) => s.id === sectionId)
          if (!section) continue
          const lyricContent: Omit<LyricSlide, 'id' | 'position'> = {
            contentKind: 'lyric',
            sectionId: section.id,
            sectionLabel: section.label,
            lines: section.lines,
          }
          emit(slot, index, lyricContent, slot.songId, localSeq++)
        }

        emit(slot, index, copyrightContent, slot.songId, localSeq++)
        break
      }

      case 'SCRIPTURE': {
        if (!slot.scriptureReadingId) break
        const reading: ScriptureReading | undefined = inputs.scriptureReadingsById.get(slot.scriptureReadingId)
        if (!reading) break

        reading.slides.forEach((innerSlide, localSeq) => {
          const { id: _id, position: _position, ...rest } = innerSlide
          emit(slot, index, rest, slot.scriptureReadingId!, localSeq)
        })
        break
      }

      case 'IMPORTED': {
        if (!slot.importId) break
        const deck: ImportedDeck | undefined = inputs.importedDecksById.get(slot.importId)
        if (!deck) break

        deck.slides.forEach((innerSlide, localSeq) => {
          const { id: _id, position: _position, ...rest } = innerSlide
          emit(slot, index, rest, slot.importId!, localSeq)
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
        emit(slot, index, content, null, 0)
        break
      }

      case 'HYMN': {
        const body = slot.verses ? `${slot.hymnName}\n\n${slot.verses}` : slot.hymnName
        const content: Omit<TextSlide, 'id' | 'position'> = {
          contentKind: 'text',
          title: slotLabel(slot),
          body,
        }
        emit(slot, index, content, null, 0)
        break
      }
    }
  }

  return assembled
}
