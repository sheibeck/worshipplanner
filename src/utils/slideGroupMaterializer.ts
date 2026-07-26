/**
 * Slide-group materializer and reconciler (Phase 24, D-02/D-05).
 *
 * This module is PURE: it performs no Firestore reads and touches no Pinia
 * store or Vue reactivity — callers (the composable in 24-05) load data,
 * decide, and write. Mirrors `slideshowAssembler.ts`'s stated purity
 * contract.
 *
 * `deriveGroupEntries` is the ONLY place a `GroupSlideEntry.id` is ever
 * minted (via `crypto.randomUUID()`) — the assembler (24-04) must never
 * regenerate one, since `PresentationViewer.vue` keys its per-slide
 * `AudioPlayer`/`VideoPlayer` child components on this id (Phase 23's WR-02
 * contract).
 */
import type { ServiceSlot } from '@/types/service'
import type { SlideGroup, GroupSlideEntry, SlideGroupInput } from '@/types/slideGroup'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import type { SongLyrics } from '@/types/songLyrics'

/**
 * Order-source precedence for a song's lyric sections — mirrors
 * `slideshowAssembler.ts::resolveSongOrder` exactly, so a group derived
 * today produces a slideshow byte-identical to what the pre-group assembler
 * produced: `performanceOrderById` entry if non-empty, else
 * `lyrics.performanceOrder` if non-empty, else `lyrics.sections` stored order.
 */
function resolveSongOrder(songId: string, lyrics: SongLyrics, inputs: AssemblyInputs): string[] {
  const explicitOrder = inputs.performanceOrderById.get(songId)
  if (explicitOrder && explicitOrder.length > 0) return explicitOrder
  if (lyrics.performanceOrder.length > 0) return lyrics.performanceOrder
  return lyrics.sections.map((section) => section.id)
}

/**
 * Derives a slide group's structure from its slot's canonical source.
 * Reproduces `assembleSlideshow`'s CURRENT per-kind emission order exactly —
 * a group derived today must produce a slideshow byte-identical to what the
 * pre-group assembler produced. Slide TEXT is never read or stored here
 * (D-02); only structural references (`sourceRef`) are minted.
 *
 * This is the ONLY place a `GroupSlideEntry.id` is ever minted.
 */
export function deriveGroupEntries(slot: ServiceSlot, inputs: AssemblyInputs): GroupSlideEntry[] {
  switch (slot.kind) {
    case 'SONG': {
      const songId = slot.songId
      if (!songId) return []
      const lyrics = inputs.songLyricsById.get(songId)
      if (!lyrics) return []

      const order = resolveSongOrder(songId, lyrics, inputs)
      const entries: GroupSlideEntry[] = []
      let idx = 0

      entries.push({ id: crypto.randomUUID(), order: idx++, sourceRef: { kind: 'copyright', songId } })

      for (const sectionId of order) {
        const section = lyrics.sections.find((s) => s.id === sectionId)
        if (!section) continue
        entries.push({
          id: crypto.randomUUID(),
          order: idx++,
          sourceRef: { kind: 'lyric', songId, sectionId: section.id },
        })
      }

      entries.push({ id: crypto.randomUUID(), order: idx++, sourceRef: { kind: 'copyright', songId } })

      return entries
    }

    case 'SCRIPTURE': {
      if (!slot.scriptureReadingId) return []
      const reading = inputs.scriptureReadingsById.get(slot.scriptureReadingId)
      if (!reading) return []

      return reading.slides.map((innerSlide, index) => ({
        id: crypto.randomUUID(),
        order: index,
        sourceRef: {
          kind: 'scripture' as const,
          scriptureReadingId: slot.scriptureReadingId!,
          innerSlideId: innerSlide.id,
        },
      }))
    }

    case 'IMPORTED': {
      if (!slot.importId) return []
      const deck = inputs.importedDecksById.get(slot.importId)
      if (!deck) return []

      return deck.slides.map((innerSlide, index) => ({
        id: crypto.randomUUID(),
        order: index,
        sourceRef: { kind: 'imported' as const, importId: slot.importId!, innerSlideId: innerSlide.id },
      }))
    }

    case 'PRAYER':
    case 'MESSAGE':
    case 'HYMN':
      return [{ id: crypto.randomUUID(), order: 0, sourceRef: { kind: 'text' } }]
  }
}

/**
 * Cheap change-detection proxy (RESEARCH.md Open Question 3): the source's
 * slide count prefixed onto its joined per-slide text (or image url,
 * whichever the inner slide carries), so both an added/removed slide AND an
 * equal-count text edit are detected (Assumptions Log A2). Returns
 * `undefined` for kinds with no external source (`text`). SONG never uses
 * this for reconciliation (it diffs by `sectionId` instead), but a signature
 * is still computed here for storage parity across group documents.
 */
export function sourceSignature(slot: ServiceSlot, inputs: AssemblyInputs): string | undefined {
  switch (slot.kind) {
    case 'SONG': {
      const songId = slot.songId
      if (!songId) return undefined
      const lyrics = inputs.songLyricsById.get(songId)
      if (!lyrics) return undefined

      const order = resolveSongOrder(songId, lyrics, inputs)
      const texts: string[] = []
      for (const sectionId of order) {
        const section = lyrics.sections.find((s) => s.id === sectionId)
        if (section) texts.push(section.lines.join(' '))
      }
      return `${texts.length}:${texts.join('|')}`
    }

    case 'SCRIPTURE': {
      if (!slot.scriptureReadingId) return undefined
      const reading = inputs.scriptureReadingsById.get(slot.scriptureReadingId)
      if (!reading) return undefined
      const texts = reading.slides.map((s) => s.text)
      return `${texts.length}:${texts.join('|')}`
    }

    case 'IMPORTED': {
      if (!slot.importId) return undefined
      const deck = inputs.importedDecksById.get(slot.importId)
      if (!deck) return undefined
      const texts = deck.slides.map((s) => (s.contentKind === 'image' ? s.imageUrl : s.body))
      return `${texts.length}:${texts.join('|')}`
    }

    case 'PRAYER':
    case 'MESSAGE':
    case 'HYMN':
      return undefined
  }
}

/**
 * Builds the input a group is first materialized from. Sets `id`/`slotId` to
 * `slot.id` (D-01's anchor), derives `slides`, computes `sourceSignature`,
 * and performs the D-05 migration: copies the slot's deprecated `audioUrl`/
 * `videoUrl` onto `bedAudioUrl`/`bedVideoUrl`, omitting each key entirely
 * (conditional spread, matching `createSlot()`'s discipline) when the slot
 * field is absent. It READS those deprecated slot fields; it never clears or
 * rewrites them, so a half-migrated organization can never lose media.
 */
export function buildInitialGroup(slot: ServiceSlot, serviceId: string, inputs: AssemblyInputs): SlideGroupInput {
  const signature = sourceSignature(slot, inputs)
  return {
    id: slot.id,
    slotId: slot.id,
    serviceId,
    slides: deriveGroupEntries(slot, inputs),
    ...(signature !== undefined ? { sourceSignature: signature } : {}),
    ...(slot.audioUrl ? { bedAudioUrl: slot.audioUrl } : {}),
    ...(slot.videoUrl ? { bedVideoUrl: slot.videoUrl } : {}),
  }
}

/** Gates the reconciliation confirm (Phase 26 dialog) — true when there is user-authored work to potentially lose. */
export function hasCustomization(group: SlideGroup): boolean {
  if (group.bedAudioUrl || group.bedVideoUrl) return true
  return group.slides.some((entry) => !!entry.label || !!entry.notes || !!entry.audioUrl)
}
