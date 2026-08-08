import { describe, it, expect } from 'vitest'
import { assembleSlideshow } from '@/utils/slideshowAssembler'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import type {
  Service,
  ServiceSlot,
  SongSlot,
  ScriptureSlot,
  NonAssignableSlot,
  HymnSlot,
  ImportedSlot,
} from '@/types/service'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { ImportedDeck } from '@/types/importedDeck'
import type { ScriptureSlide, CopyrightSlide, LyricSlide, TextSlide, ImageSlide, VideoSlide, CongregationalSection } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import type { PptxRenderDoc } from '@/types/pptxRender'
import type { Timestamp } from 'firebase/firestore'
import { slotLabel, reindexSlots, orderSlotsBySection } from '@/utils/slotTypes'
import { resolveImportedRender, importedEntryIdentities, type ImportedRenderResolution } from '@/utils/importedRenderReconciler'
import { slideContentLabel } from '@/components/slides/slideDisplay'
import { resolveTranslationSource } from '@/utils/scripture'

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp

function makeService(slots: ServiceSlot[]): Service {
  return {
    id: 'svc-1',
    date: '2026-01-04',
    name: 'Test Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'draft',
    slots,
    sermonPassage: null,
    notes: '',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  }
}

function makeSongLyrics(overrides: Partial<SongLyrics> = {}): SongLyrics {
  return {
    id: 'lyrics-1',
    songId: 'song-1',
    sections: [
      { id: 'verse-1', label: 'Verse 1', lines: ['Line A', 'Line B'] },
      { id: 'chorus', label: 'Chorus', lines: ['Line C'] },
    ],
    copyright: {
      title: 'Amazing Grace',
      authors: ['John Newton'],
      ccliSongNumber: '12345',
      copyrightLines: ['Public Domain'],
      ccliLicenseNumber: '6789',
    },
    performanceOrder: [],
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  }
}

function makeScriptureSlide(overrides: Partial<ScriptureSlide> = {}): ScriptureSlide {
  return {
    id: 'ss-1',
    position: 0,
    contentKind: 'scripture',
    reference: 'John 3:16',
    bookRef: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 },
    text: 'For God so loved the world...',
    verseRange: '16',
    readingMode: 'normal',
    ...overrides,
  }
}

function makeScriptureReading(overrides: Partial<ScriptureReading> = {}): ScriptureReading {
  return {
    id: 'reading-1',
    reference: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 18 },
    displayReference: 'John 3:16-18',
    rawText: 'For God so loved the world...',
    readingMode: 'normal',
    slides: [
      makeScriptureSlide({ id: 'ss-1', position: 0, verseRange: '16' }),
      makeScriptureSlide({ id: 'ss-2', position: 1, verseRange: '17' }),
    ],
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  }
}

function makeImportedDeck(overrides: Partial<ImportedDeck> = {}): ImportedDeck {
  return {
    id: 'deck-1',
    sourceFileName: 'announcements.pptx',
    section: 'pre-service',
    slides: [
      { id: 'is-1', position: 0, contentKind: 'text', title: 'Welcome', body: 'Welcome to church' } as TextSlide,
      { id: 'is-2', position: 1, contentKind: 'image', imageUrl: 'https://example.com/a.png', altText: 'slide 2' } as ImageSlide,
    ],
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  }
}

function makeInputs(overrides: Partial<AssemblyInputs> = {}): AssemblyInputs {
  return {
    songLyricsById: new Map(),
    scriptureReadingsById: new Map(),
    importedDecksById: new Map(),
    groupsBySlotId: new Map(),
    ...overrides,
  }
}

function makeSlideGroup(overrides: Partial<SlideGroup> = {}): SlideGroup {
  return {
    id: 'group-1',
    serviceId: 'svc-1',
    slotId: 'group-1',
    slides: [],
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  }
}

function makeGroupSlideEntry(overrides: Partial<GroupSlideEntry> = {}): GroupSlideEntry {
  return {
    id: 'entry-1',
    order: 0,
    sourceRef: { kind: 'text' },
    ...overrides,
  }
}

function songSlot(overrides: Partial<SongSlot> = {}): SongSlot {
  return {
    kind: 'SONG',
    id: 'slot-song-0',
    position: 0,
    requiredVwType: 1,
    songId: null,
    songTitle: null,
    songKey: null,
    ...overrides,
  }
}

// R047: the slot's OWN reference is the scripture slide's source, so the
// default fixture carries one. It formats to "John 3:16-18" — deliberately the
// same string `makeScriptureReading`'s displayReference used, so tests written
// against the old reading-document source keep asserting the same text.
// Pass `book: null` to model a scripture item whose reference is not filled in.
function scriptureSlot(overrides: Partial<ScriptureSlot> = {}): ScriptureSlot {
  return {
    kind: 'SCRIPTURE',
    id: 'slot-scripture-0',
    position: 0,
    book: 'John',
    chapter: 3,
    verseStart: 16,
    verseEnd: 18,
    ...overrides,
  }
}

function importedSlot(overrides: Partial<ImportedSlot> = {}): ImportedSlot {
  return {
    kind: 'IMPORTED',
    id: 'slot-imported-0',
    position: 0,
    importId: null,
    ...overrides,
  }
}

describe('assembleSlideshow — song resolution', () => {
  it('emits leading copyright, ordered section slides, trailing copyright for a 2-section song', () => {
    const slot = songSlot({ songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(4)
    expect(result[0]!.slide.contentKind).toBe('lyric')
    expect((result[0]!.slide as CopyrightSlide).title).toBe('Amazing Grace')
    expect((result[1]!.slide as LyricSlide).sectionId).toBe('verse-1')
    expect((result[2]!.slide as LyricSlide).sectionId).toBe('chorus')
    expect((result[3]!.slide as CopyrightSlide).title).toBe('Amazing Grace')
  })

  it('every emitted slide from a song slot carries slotIndex, slotKind, section, and sourceId', () => {
    const slot = songSlot({ songId: 'song-1', section: 'worship' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result = assembleSlideshow(service, inputs)

    for (const assembled of result) {
      expect(assembled.slotIndex).toBe(0)
      expect(assembled.slotKind).toBe('SONG')
      expect(assembled.section).toBe('worship')
      expect(assembled.sourceId).toBe('song-1')
    }
  })

  it('resolves the section order from the lyrics document performanceOrder field', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: ['chorus', 'verse-1'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect((result[1]!.slide as LyricSlide).sectionId).toBe('chorus')
    expect((result[2]!.slide as LyricSlide).sectionId).toBe('verse-1')
  })

  it('skips order entries that do not resolve to a known lyrics.section, without throwing', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'bogus-section', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    expect(() => assembleSlideshow(service, inputs)).not.toThrow()
    const result = assembleSlideshow(service, inputs)
    expect(result).toHaveLength(4)
    expect((result[1]!.slide as LyricSlide).sectionId).toBe('verse-1')
    expect((result[2]!.slide as LyricSlide).sectionId).toBe('chorus')
  })

  it('a SONG slot with songId === null contributes nothing', () => {
    const slot = songSlot({ songId: null })
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())
    expect(result).toHaveLength(0)
  })

  it('a SONG slot whose songId is absent from songLyricsById contributes nothing', () => {
    const slot = songSlot({ songId: 'unloaded-song' })
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())
    expect(result).toHaveLength(0)
  })
})

// R060 — the fallback (not-yet-materialized) path's copyright bracket. Every
// song group carries a copyright entry at its first and last position as a
// deliberate safety margin beyond the documented convention (at least once
// per song) — never framed here as a licensing mandate. `emitFallback` is
// called once before the section loop and once after it
// (slideshowAssembler.ts:379,393), neither gated on `order.length`, so this
// block PINS existing, already-shipped behavior; it adds no new emission.
describe('assembleSlideshow — R060 copyright bracket (fallback path)', () => {
  // Classifies an assembled slide as "copyright" by the presence of
  // `ccliSongNumber` on its slide payload — NOT by `contentKind`, which is
  // `'lyric'` for both `CopyrightSlide` and `LyricSlide` (src/types/slide.ts)
  // and would therefore classify every lyric slide as copyright too.
  function isCopyrightSlide(assembled: { slide: unknown }): boolean {
    return Object.prototype.hasOwnProperty.call(assembled.slide as object, 'ccliSongNumber')
  }

  function copyrightIndices(result: { slide: unknown }[]): number[] {
    return result.reduce<number[]>((acc, assembled, index) => {
      if (isCopyrightSlide(assembled)) acc.push(index)
      return acc
    }, [])
  }

  it('an empty performanceOrder still assembles exactly 2 adjacent copyright slides, nothing between them', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: [] })
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(2)
    expect(isCopyrightSlide(result[0]!)).toBe(true)
    expect(isCopyrightSlide(result[1]!)).toBe(true)
  })

  it('a one-section song assembles to copyright, lyric, copyright — the two copyright slides never merge', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1'] })
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(3)
    expect(isCopyrightSlide(result[0]!)).toBe(true)
    expect(isCopyrightSlide(result[1]!)).toBe(false)
    expect((result[1]!.slide as LyricSlide).sectionId).toBe('verse-1')
    expect(isCopyrightSlide(result[2]!)).toBe(true)
  })

  it.each([0, 1, 2, 5])(
    'for an order of length %i, the first and last assembled slides are copyright and nothing strictly between them is',
    (orderLength) => {
      const sections = Array.from({ length: Math.max(orderLength, 2) }, (_, i) => ({
        id: `verse-${i}`,
        label: `Verse ${i}`,
        lines: [`Line ${i}`],
      }))
      const performanceOrder = sections.slice(0, orderLength).map((s) => s.id)
      const slot = songSlot({ songId: 'song-1' })
      const service = makeService([slot])
      const lyrics = makeSongLyrics({ sections, performanceOrder })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = assembleSlideshow(service, inputs)

      expect(result).toHaveLength(orderLength + 2)
      expect(isCopyrightSlide(result[0]!)).toBe(true)
      expect(isCopyrightSlide(result[result.length - 1]!)).toBe(true)
      for (let i = 1; i < result.length - 1; i++) {
        expect(isCopyrightSlide(result[i]!)).toBe(false)
      }
    },
  )

  it('the bracket is structural, not sorted: copyright indices are exactly [0, length - 1]', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const result = assembleSlideshow(service, inputs)

    expect(copyrightIndices(result)).toEqual([0, result.length - 1])
  })

  it('an empty copyright object still produces both bracket slides, with no field rendering the literal undefined', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({
      performanceOrder: [],
      copyright: {
        title: '',
        authors: [],
        ccliSongNumber: '',
        copyrightLines: [],
        ccliLicenseNumber: '',
      },
    })
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(2)
    for (const assembled of result) {
      expect(isCopyrightSlide(assembled)).toBe(true)
      const copyright = assembled.slide as CopyrightSlide
      // Assert the actual empty-string identity the fixture sets, not a
      // stringified guess — `.toBe('')` fails for both the real `undefined`
      // value and the literal string `"undefined"`, whereas
      // `.not.toBe('undefined')` is trivially satisfied by a real `undefined`
      // (Object.is(undefined, 'undefined') === false).
      expect(copyright.title).toBe('')
      expect(copyright.ccliSongNumber).toBe('')
      expect(copyright.ccliLicenseNumber).toBe('')
      for (const line of copyright.copyrightLines) {
        expect(line).not.toBeUndefined()
        expect(typeof line).toBe('string')
      }
      for (const author of copyright.authors) {
        expect(author).not.toBeUndefined()
        expect(typeof author).toBe('string')
      }
    }
  })

  it('a SONG slot whose songId has no entry in songLyricsById emits zero slides — never one copyright without its pair', () => {
    const slot = songSlot({ songId: 'unresolvable-song' })
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())

    expect(result).toHaveLength(0)
  })
})

describe('assembleSlideshow — scripture resolution', () => {
  it('emits exactly ONE reference-only slide, built from the slot\'s own reference (R047)', () => {
    const slot = scriptureSlot()
    const service = makeService([slot])

    const result = assembleSlideshow(service, makeInputs())

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.contentKind).toBe('scripture')
    expect((result[0]!.slide as ScriptureSlide).reference).toBe('John 3:16-18')
    expect((result[0]!.slide as ScriptureSlide).bookRef).toEqual({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 18 })
    expect((result[0]!.slide as ScriptureSlide).text).toBe('')
    expect((result[0]!.slide as ScriptureSlide).verseRange).toBe('')
    expect((result[0]!.slide as ScriptureSlide).readingMode).toBe('normal')
  })

  it('a single-verse reference renders without a spurious range', () => {
    const slot = scriptureSlot({ verseStart: 16, verseEnd: null })
    const result = assembleSlideshow(makeService([slot]), makeInputs())
    expect((result[0]!.slide as ScriptureSlide).reference).toBe('John 3:16')
  })

  it('a whole-chapter reference renders as the bare chapter', () => {
    const slot = scriptureSlot({ verseStart: null, verseEnd: null })
    const result = assembleSlideshow(makeService([slot]), makeInputs())
    expect((result[0]!.slide as ScriptureSlide).reference).toBe('John 3')
  })

  it('every emitted slide from a scripture slot carries slotIndex, slotKind, section, and a null sourceId', () => {
    const slot = scriptureSlot({ section: 'worship' })
    const service = makeService([slot])

    const result = assembleSlideshow(service, makeInputs())

    expect(result).toHaveLength(1)
    for (const assembled of result) {
      expect(assembled.slotIndex).toBe(0)
      expect(assembled.slotKind).toBe('SCRIPTURE')
      expect(assembled.section).toBe('worship')
      // R047: a slot-derived reference has no canonical record behind it.
      expect(assembled.sourceId).toBeNull()
    }
  })

  it('a SCRIPTURE slot with no reference filled in contributes nothing', () => {
    const slot = scriptureSlot({ book: null, chapter: null, verseStart: null, verseEnd: null })
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())
    expect(result).toHaveLength(0)
  })

  // R047: this is the defect the owner hit — the slide used to require a
  // reading document that only an ESV fetch could create, so a scripture item
  // with a perfectly good reference rendered nothing.
  it('a SCRIPTURE slot renders from its reference with NO reading document loaded', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'unloaded-reading' })
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())
    expect(result).toHaveLength(1)
    expect((result[0]!.slide as ScriptureSlide).reference).toBe('John 3:16-18')
  })
})

function makeCongregationalSection(overrides: Partial<CongregationalSection> = {}): CongregationalSection {
  return {
    speaker: 'LEADER',
    text: 'The Lord is my shepherd;',
    ...overrides,
  }
}

// D1: a congregational scripture slot now produces N slides — one per
// section — not one slide carrying a stacked `sections` array. Both scripture
// call sites (resolveEntryContent's stored-group path and the SCRIPTURE
// fallback branch) must agree slide-for-slide; the parity cases are
// load-bearing: they assemble ONE slot fixture through both paths and assert
// the emitted scripture slides agree.
describe('assembleSlideshow — congregational reading (D1)', () => {
  function sectionEntry(section: CongregationalSection, order: number, id: string): GroupSlideEntry {
    return makeGroupSlideEntry({
      id,
      order,
      sourceRef: {
        kind: 'scripture',
        speaker: section.speaker,
        text: section.text,
        ...(section.verseRange !== undefined ? { verseRange: section.verseRange } : {}),
      },
    })
  }

  function assembleViaStoredGroup(slot: ScriptureSlot, sections: CongregationalSection[]) {
    const entries =
      sections.length === 0
        ? [makeGroupSlideEntry({ id: 'entry-scripture', order: 0, sourceRef: { kind: 'scripture' } })]
        : sections.map((section, i) => sectionEntry(section, i, `entry-scripture-${i}`))
    const group = makeSlideGroup({ id: slot.id, slotId: slot.id, slides: entries })
    const inputs = makeInputs({ groupsBySlotId: new Map([[slot.id, group]]) })
    return assembleSlideshow(makeService([slot]), inputs)
  }

  function assembleViaFallback(slot: ScriptureSlot) {
    return assembleSlideshow(makeService([slot]), makeInputs())
  }

  it('dual-path parity: a slot WITH congregationalSections yields the same number of slides, same readingMode/section content, on both paths', () => {
    const sections = [
      makeCongregationalSection({ speaker: 'LEADER', text: 'One' }),
      makeCongregationalSection({ speaker: 'CONGREGATION', text: 'Two' }),
    ]
    const slot = scriptureSlot({ id: 'slot-scripture-0', congregationalSections: sections })

    const storedResult = assembleViaStoredGroup(slot, sections)
    const fallbackResult = assembleViaFallback(slot)

    expect(storedResult).toHaveLength(2)
    expect(fallbackResult).toHaveLength(2)

    for (let i = 0; i < 2; i++) {
      const storedSlide = storedResult[i]!.slide as ScriptureSlide
      const fallbackSlide = fallbackResult[i]!.slide as ScriptureSlide
      expect(storedSlide.readingMode).toBe(fallbackSlide.readingMode)
      expect(storedSlide.readingMode).toBe('congregational')
      expect(storedSlide.text).toBe(fallbackSlide.text)
      expect(storedSlide.text).toBe(sections[i]!.text)
      expect(storedSlide.section).toEqual(sections[i])
      expect(fallbackSlide.section).toEqual(sections[i])
    }
  })

  it('dual-path parity: a slot with NO congregationalSections yields the identical backward-compatible shape on both paths', () => {
    const slot = scriptureSlot({ id: 'slot-scripture-0' })

    const storedResult = assembleViaStoredGroup(slot, [])
    const fallbackResult = assembleViaFallback(slot)

    expect(storedResult).toHaveLength(1)
    expect(fallbackResult).toHaveLength(1)

    const storedSlide = storedResult[0]!.slide as ScriptureSlide
    const fallbackSlide = fallbackResult[0]!.slide as ScriptureSlide

    for (const slide of [storedSlide, fallbackSlide]) {
      expect(slide.readingMode).toBe('normal')
      expect(slide.text).toBe('')
      expect(slide.verseRange).toBe('')
      expect(Object.prototype.hasOwnProperty.call(slide, 'section')).toBe(false)
    }
    expect(storedSlide.readingMode).toBe(fallbackSlide.readingMode)
  })

  it('a slot with three sections assembles to three slides, in stored order, each carrying its own section', () => {
    const sections = [
      makeCongregationalSection({ speaker: 'LEADER', text: 'First' }),
      makeCongregationalSection({ speaker: 'CONGREGATION', text: 'Second' }),
      makeCongregationalSection({ speaker: 'LEADER', text: 'Third' }),
    ]
    const slot = scriptureSlot({ congregationalSections: sections })
    const result = assembleSlideshow(makeService([slot]), makeInputs())

    expect(result).toHaveLength(3)
    const slides = result.map((r) => r.slide as ScriptureSlide)
    expect(slides.map((s) => s.text)).toEqual(['First', 'Second', 'Third'])
    for (let i = 0; i < 3; i++) {
      expect(slides[i]!.readingMode).toBe('congregational')
      expect(slides[i]!.section).toEqual(sections[i])
      // Every section slide carries the same reference/bookRef.
      expect(slides[i]!.reference).toBe(slides[0]!.reference)
      expect(slides[i]!.bookRef).toEqual(slides[0]!.bookRef)
    }
  })

  it('same-speaker adjacent sections produce two separate slides, unmerged', () => {
    const sections = [
      makeCongregationalSection({ speaker: 'CONGREGATION', text: 'Part A' }),
      makeCongregationalSection({ speaker: 'CONGREGATION', text: 'Part B' }),
    ]
    const slot = scriptureSlot({ congregationalSections: sections })
    const result = assembleSlideshow(makeService([slot]), makeInputs())

    expect(result).toHaveLength(2)
    const slides = result.map((r) => r.slide as ScriptureSlide)
    expect(slides[0]!.section!.speaker).toBe('CONGREGATION')
    expect(slides[1]!.section!.speaker).toBe('CONGREGATION')
    expect(slides[0]!.text).toBe('Part A')
    expect(slides[1]!.text).toBe('Part B')
  })

  it('non-ASCII section text survives to the slide with strict === equality', () => {
    const text = '‘He restores my soul’ — “he leads me”'
    const slot = scriptureSlot({ congregationalSections: [makeCongregationalSection({ text })] })
    const result = assembleSlideshow(makeService([slot]), makeInputs())
    const slide = result[0]!.slide as ScriptureSlide
    expect(slide.text === text).toBe(true)
    expect(slide.section!.text === text).toBe(true)
  })

  it('each section slide\'s id is its own group entry\'s id — distinct ids matching the stored entries', () => {
    const sections = [
      makeCongregationalSection({ text: 'One' }),
      makeCongregationalSection({ text: 'Two' }),
      makeCongregationalSection({ text: 'Three' }),
    ]
    const slot = scriptureSlot({ id: 'slot-scripture-0', congregationalSections: sections })
    const result = assembleViaStoredGroup(slot, sections)

    expect(result.map((r) => r.slide.id)).toEqual(['entry-scripture-0', 'entry-scripture-1', 'entry-scripture-2'])
    expect(new Set(result.map((r) => r.slide.id)).size).toBe(3)
  })

  it('concatenating the assembled slides\' section text, in order, reproduces the source with nothing duplicated or dropped', () => {
    const sourcePassage = 'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures.'
    const sections = [
      makeCongregationalSection({ speaker: 'LEADER', text: 'The Lord is my shepherd; I shall not want. ' }),
      makeCongregationalSection({ speaker: 'CONGREGATION', text: 'He makes me lie down in green pastures.' }),
    ]
    const slot = scriptureSlot({ congregationalSections: sections })
    const result = assembleSlideshow(makeService([slot]), makeInputs())

    const reconstructed = result.map((r) => (r.slide as ScriptureSlide).text).join('')
    expect(reconstructed).toBe(sourcePassage)
  })

  it('adding congregationalSections to a slot does not change slide id/position/sourceId/groupId/groupSlideId for the stored-group path\'s first slide', () => {
    const withoutSections = scriptureSlot({ id: 'slot-scripture-0' })
    const withSections = scriptureSlot({
      id: 'slot-scripture-0',
      congregationalSections: [makeCongregationalSection()],
    })

    const resultWithout = assembleViaStoredGroup(withoutSections, [])
    const resultWith = assembleViaStoredGroup(withSections, [makeCongregationalSection()])

    expect(resultWith[0]!.slide.position).toBe(resultWithout[0]!.slide.position)
    expect(resultWith[0]!.sourceId).toBe(resultWithout[0]!.sourceId)
    expect(resultWith[0]!.groupId).toBe(resultWithout[0]!.groupId)
  })
})

// R092/T-45-31 (Phase 45): a SourceRef's stamped translationSource threads
// onto the assembled ScriptureSlide with no re-derivation, on both the
// stored-group and no-group fallback paths — never read from any org
// setting, which this function's inputs don't even carry.
describe('assembleSlideshow — translationSource passthrough (Phase 45, R092)', () => {
  function sectionEntryWithSource(section: CongregationalSection, order: number, id: string): GroupSlideEntry {
    return makeGroupSlideEntry({
      id,
      order,
      sourceRef: {
        kind: 'scripture',
        speaker: section.speaker,
        text: section.text,
        ...(section.verseRange !== undefined ? { verseRange: section.verseRange } : {}),
        ...(section.translationSource !== undefined ? { translationSource: section.translationSource } : {}),
      },
    })
  }

  it('stored-group path: a SourceRef carrying translationSource: \'NLT\' threads onto ScriptureSlide.translationSource', () => {
    const section = makeCongregationalSection({ text: 'One', translationSource: 'NLT' })
    const slot = scriptureSlot({ id: 'slot-scripture-0', congregationalSections: [section] })
    const entry = sectionEntryWithSource(section, 0, 'entry-scripture-0')
    const group = makeSlideGroup({ id: slot.id, slotId: slot.id, slides: [entry] })
    const inputs = makeInputs({ groupsBySlotId: new Map([[slot.id, group]]) })

    const result = assembleSlideshow(makeService([slot]), inputs)

    expect((result[0]!.slide as ScriptureSlide).translationSource).toBe('NLT')
  })

  it('stored-group path: a SourceRef with no translationSource yields a ScriptureSlide with no translationSource key at all', () => {
    const section = makeCongregationalSection({ text: 'Field-less' })
    const slot = scriptureSlot({ id: 'slot-scripture-0', congregationalSections: [section] })
    const entry = sectionEntryWithSource(section, 0, 'entry-scripture-0')
    const group = makeSlideGroup({ id: slot.id, slotId: slot.id, slides: [entry] })
    const inputs = makeInputs({ groupsBySlotId: new Map([[slot.id, group]]) })

    const result = assembleSlideshow(makeService([slot]), inputs)

    expect(Object.prototype.hasOwnProperty.call(result[0]!.slide, 'translationSource')).toBe(false)
  })

  it('no-group fallback path: a slot section carrying translationSource: \'ESV\' threads onto the fallback-derived ScriptureSlide', () => {
    const section = makeCongregationalSection({ text: 'One', translationSource: 'ESV' })
    const slot = scriptureSlot({ congregationalSections: [section] })

    const result = assembleSlideshow(makeService([slot]), makeInputs())

    expect((result[0]!.slide as ScriptureSlide).translationSource).toBe('ESV')
  })

  it('the Reference-state (non-congregational) branch never carries translationSource — no body text exists there to attribute (Pitfall 3)', () => {
    const slot = scriptureSlot({ id: 'slot-scripture-0' })

    const fallbackResult = assembleSlideshow(makeService([slot]), makeInputs())
    const group = makeSlideGroup({
      id: slot.id,
      slotId: slot.id,
      slides: [makeGroupSlideEntry({ id: 'entry-scripture', order: 0, sourceRef: { kind: 'scripture' } })],
    })
    const storedResult = assembleSlideshow(makeService([slot]), makeInputs({ groupsBySlotId: new Map([[slot.id, group]]) }))

    expect(Object.prototype.hasOwnProperty.call(fallbackResult[0]!.slide, 'translationSource')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(storedResult[0]!.slide, 'translationSource')).toBe(false)
  })

  it('NAMED R092 invariant: resolveTranslationSource on a field-less assembled slide resolves to \'ESV\', independent of any org setting the assembler was never given', () => {
    const slot = scriptureSlot({ congregationalSections: [makeCongregationalSection({ text: 'Pre-phase section' })] })
    const result = assembleSlideshow(makeService([slot]), makeInputs())
    const slide = result[0]!.slide as ScriptureSlide

    expect(slide.translationSource).toBeUndefined()
    expect(resolveTranslationSource(slide)).toBe('ESV')
  })
})

describe('assembleSlideshow — imported deck resolution', () => {
  it('emits one AssembledSlide per deck.slides entry, in deck order, with slotKind IMPORTED and sourceId equal to importId', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const service = makeService([slot])
    const deck = makeImportedDeck()
    const inputs = makeInputs({
      importedDecksById: new Map([['deck-1', deck]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(deck.slides.length)
    expect(result[0]!.slotKind).toBe('IMPORTED')
    expect(result[0]!.sourceId).toBe('deck-1')
    expect(result[1]!.sourceId).toBe('deck-1')
  })

  it('mixed text+image deck slides pass their contentKind through unchanged, in order', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const service = makeService([slot])
    const deck = makeImportedDeck()
    const inputs = makeInputs({
      importedDecksById: new Map([['deck-1', deck]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.slide.contentKind).toBe('text')
    expect((result[0]!.slide as TextSlide).body).toBe('Welcome to church')
    expect(result[1]!.slide.contentKind).toBe('image')
    expect((result[1]!.slide as ImageSlide).imageUrl).toBe('https://example.com/a.png')
  })

  it('every emitted slide from an imported slot carries slotIndex, slotKind, and section', () => {
    const slot = importedSlot({ importId: 'deck-1', section: 'pre-service' })
    const service = makeService([slot])
    const deck = makeImportedDeck()
    const inputs = makeInputs({
      importedDecksById: new Map([['deck-1', deck]]),
    })

    const result = assembleSlideshow(service, inputs)

    for (const assembled of result) {
      expect(assembled.slotIndex).toBe(0)
      expect(assembled.slotKind).toBe('IMPORTED')
      expect(assembled.section).toBe('pre-service')
    }
  })

  it('an IMPORTED slot with importId null contributes nothing', () => {
    const slot = importedSlot({ importId: null })
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())
    expect(result).toHaveLength(0)
  })

  it('an IMPORTED slot whose importId is absent from importedDecksById contributes nothing', () => {
    const slot = importedSlot({ importId: 'unloaded-deck' })
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())
    expect(result).toHaveLength(0)
  })
})

describe('assembleSlideshow — text/hymn slots', () => {
  it('PRAYER slot emits exactly one TextSlide-backed AssembledSlide with sourceId null', () => {
    const slot: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 }
    const service = makeService([slot])

    const result = assembleSlideshow(service, makeInputs())

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.contentKind).toBe('text')
    expect(result[0]!.sourceId).toBeNull()
    expect((result[0]!.slide as TextSlide).title).toBe(slotLabel(slot))
  })

  it('MESSAGE slot emits exactly one TextSlide-backed AssembledSlide with sourceId null', () => {
    const slot: NonAssignableSlot = { kind: 'MESSAGE', id: 'slot-message-0', position: 0 }
    const service = makeService([slot])

    const result = assembleSlideshow(service, makeInputs())

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.contentKind).toBe('text')
    expect(result[0]!.sourceId).toBeNull()
    expect((result[0]!.slide as TextSlide).title).toBe(slotLabel(slot))
  })

  it('HYMN slot emits exactly one TextSlide-backed AssembledSlide whose body reflects hymnName and verses', () => {
    const slot: HymnSlot = { kind: 'HYMN', id: 'slot-hymn-0', position: 0, hymnName: 'How Great Thou Art', hymnNumber: '12', verses: '1, 2, 4' }
    const service = makeService([slot])

    const result = assembleSlideshow(service, makeInputs())

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.contentKind).toBe('text')
    expect(result[0]!.sourceId).toBeNull()
    const body = (result[0]!.slide as TextSlide).body
    expect(body).toContain('How Great Thou Art')
    expect(body).toContain('1, 2, 4')
  })

  it('HYMN slot with no verses reflects hymnName only in body', () => {
    const slot: HymnSlot = { kind: 'HYMN', id: 'slot-hymn-0', position: 0, hymnName: 'Holy, Holy, Holy', hymnNumber: '', verses: '' }
    const service = makeService([slot])

    const result = assembleSlideshow(service, makeInputs())

    expect((result[0]!.slide as TextSlide).body).toBe('Holy, Holy, Holy')
  })
})

describe('assembleSlideshow — reorder ordering (R006)', () => {
  it('swapping two slots positions reorders the assembled output correspondingly, with no other change', () => {
    const slotA: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 }
    const slotB: NonAssignableSlot = { kind: 'MESSAGE', id: 'slot-message-1', position: 1 }

    const before = assembleSlideshow(makeService([slotA, slotB]), makeInputs())
    expect(before.map((s) => s.slotKind)).toEqual(['PRAYER', 'MESSAGE'])

    const swappedA: NonAssignableSlot = { ...slotA, position: 1 }
    const swappedB: NonAssignableSlot = { ...slotB, position: 0 }
    const after = assembleSlideshow(makeService([swappedA, swappedB]), makeInputs())

    expect(after.map((s) => s.slotKind)).toEqual(['MESSAGE', 'PRAYER'])
    // Content is otherwise unchanged — only order differs.
    expect(after.map((s) => (s.slide as TextSlide).title).sort()).toEqual(
      before.map((s) => (s.slide as TextSlide).title).sort(),
    )
  })
})

describe('assembleSlideshow — media propagation (R013/R014)', () => {
  it('a slot with no group produces slides whose audioUrl is undefined (D-19: no legacy slot-media fallback)', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(4)
    for (const assembled of result) {
      expect(assembled.slide.audioUrl).toBeUndefined()
    }
  })
})

describe('assembleSlideshow — section metadata pass-through', () => {
  it('a legacy service whose slots all have section === undefined produces AssembledSlides all with section === undefined', () => {
    const slots: ServiceSlot[] = [
      { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 },
      { kind: 'MESSAGE', id: 'slot-message-1', position: 1 },
    ]
    const service = makeService(slots)

    const result = assembleSlideshow(service, makeInputs())

    expect(result.length).toBeGreaterThan(0)
    for (const assembled of result) {
      expect(assembled.section).toBeUndefined()
    }
  })

  it('a mixed service (song + scripture + prayer) spanning worship/message/sending produces correct per-slide section metadata', () => {
    const songSlotWorship = songSlot({ songId: 'song-1', section: 'worship' })
    const scriptureSlotWorship = scriptureSlot({ scriptureReadingId: 'reading-1', section: 'worship', position: 1 })
    const prayerSlotMessage: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-2', position: 2, section: 'message' }
    const songSlotSending = songSlot({ songId: 'song-2', section: 'sending', position: 3 })

    const lyrics1 = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const lyrics2 = makeSongLyrics({
      songId: 'song-2',
      sections: [{ id: 'verse-1', label: 'Verse 1', lines: ['Line X'] }],
      performanceOrder: ['verse-1'],
    })
    const reading = makeScriptureReading()

    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics1], ['song-2', lyrics2]]),
      scriptureReadingsById: new Map([['reading-1', reading]]),
    })

    const service = makeService([songSlotWorship, scriptureSlotWorship, prayerSlotMessage, songSlotSending])
    const result = assembleSlideshow(service, inputs)

    // song-1: copyright, verse-1, chorus, copyright (4) — worship
    // reading-1: 1 reference-only slide (R047) — worship
    // prayer: 1 slide — message
    // song-2: copyright, verse-1, copyright (3) — sending
    expect(result.map((r) => r.section)).toEqual([
      'worship', 'worship', 'worship', 'worship',
      'worship',
      'message',
      'sending', 'sending', 'sending',
    ])
    expect(result.filter((r) => r.section === 'worship')).toHaveLength(5)
    expect(result.filter((r) => r.section === 'message')).toHaveLength(1)
    expect(result.filter((r) => r.section === 'sending')).toHaveLength(3)
  })
})

describe('assembleSlideshow — stored group resolution (D-02, R028)', () => {
  it('with a group present for a slot, output slide ids equal the group entry ids in order-order', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const chorusEntry = makeGroupSlideEntry({
      id: 'entry-chorus',
      order: 1,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' },
    })
    const verseEntry = makeGroupSlideEntry({
      id: 'entry-verse',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({ id: 'slot-song-0', slotId: 'slot-song-0', slides: [chorusEntry, verseEntry] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result.map((r) => r.slide.id)).toEqual(['entry-verse', 'entry-chorus'])
    expect((result[0]!.slide as LyricSlide).sectionId).toBe('verse-1')
    expect((result[1]!.slide as LyricSlide).sectionId).toBe('chorus')
  })

  it('a lyric sourceRef resolves its text from songLyricsById at assembly time — editing lyrics changes assembled text with no group write', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const entry = makeGroupSlideEntry({
      id: 'entry-1',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({ id: 'slot-song-0', slotId: 'slot-song-0', slides: [entry] })
    const originalSlides = group.slides

    const lyricsV1 = makeSongLyrics()
    const resultV1 = assembleSlideshow(
      service,
      makeInputs({ songLyricsById: new Map([['song-1', lyricsV1]]), groupsBySlotId: new Map([['slot-song-0', group]]) }),
    )
    expect((resultV1[0]!.slide as LyricSlide).lines).toEqual(['Line A', 'Line B'])

    const lyricsV2 = makeSongLyrics({
      sections: [
        { id: 'verse-1', label: 'Verse 1', lines: ['Edited Line'] },
        { id: 'chorus', label: 'Chorus', lines: ['Line C'] },
      ],
    })
    const resultV2 = assembleSlideshow(
      service,
      makeInputs({ songLyricsById: new Map([['song-1', lyricsV2]]), groupsBySlotId: new Map([['slot-song-0', group]]) }),
    )
    expect((resultV2[0]!.slide as LyricSlide).lines).toEqual(['Edited Line'])
    // The stored group itself is never written to.
    expect(group.slides).toBe(originalSlides)
  })

  it('a copyright sourceRef resolves to the same copyright content the current implementation builds', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const entry = makeGroupSlideEntry({ id: 'entry-copy', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } })
    const group = makeSlideGroup({ id: 'slot-song-0', slotId: 'slot-song-0', slides: [entry] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.id).toBe('entry-copy')
    expect((result[0]!.slide as CopyrightSlide).title).toBe('Amazing Grace')
  })

  it('a stored scripture entry resolves reference-only from the SLOT, ignoring any legacy scriptureReadingId/innerSlideId it still carries (R047)', () => {
    const slot = scriptureSlot({ id: 'slot-scripture-0' })
    const service = makeService([slot])
    const entry = makeGroupSlideEntry({
      id: 'entry-scripture',
      order: 0,
      // A pre-R047 entry, written when the reading document was the source.
      sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'ss-2' },
    })
    const group = makeSlideGroup({ id: 'slot-scripture-0', slotId: 'slot-scripture-0', slides: [entry] })
    const inputs = makeInputs({ groupsBySlotId: new Map([['slot-scripture-0', group]]) })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.id).toBe('entry-scripture')
    expect((result[0]!.slide as ScriptureSlide).reference).toBe('John 3:16-18')
    expect((result[0]!.slide as ScriptureSlide).text).toBe('')
  })

  it('R047 reactive path: changing the SLOT\'s passage changes the assembled reference with no group write', () => {
    const entry = makeGroupSlideEntry({ id: 'entry-scripture', order: 0, sourceRef: { kind: 'scripture' } })
    const group = makeSlideGroup({ id: 'slot-scripture-0', slotId: 'slot-scripture-0', slides: [entry] })
    const originalSlides = group.slides
    const inputs = makeInputs({ groupsBySlotId: new Map([['slot-scripture-0', group]]) })

    const resultV1 = assembleSlideshow(
      makeService([scriptureSlot({ id: 'slot-scripture-0' })]),
      inputs,
    )
    expect((resultV1[0]!.slide as ScriptureSlide).reference).toBe('John 3:16-18')

    // The user edits the reference on the Service Order tab. Same slot, same
    // group document, same stored entry — only the slot's fields differ.
    const resultV2 = assembleSlideshow(
      makeService([scriptureSlot({ id: 'slot-scripture-0', book: 'Psalms', chapter: 103, verseStart: 1, verseEnd: 5 })]),
      inputs,
    )
    expect((resultV2[0]!.slide as ScriptureSlide).reference).toBe('Psalms 103:1-5')
    // The stored group entry is never written to — the update flows through
    // reactively at assembly time, no rebuild needed.
    expect(group.slides).toBe(originalSlides)
  })

  it('an imported sourceRef resolves its inner slide by innerSlideId', () => {
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const deck = makeImportedDeck()
    const entry = makeGroupSlideEntry({
      id: 'entry-imported',
      order: 0,
      sourceRef: { kind: 'imported', importId: 'deck-1', innerSlideId: 'is-2' },
    })
    const group = makeSlideGroup({ id: 'slot-imported-0', slotId: 'slot-imported-0', slides: [entry] })
    const inputs = makeInputs({
      importedDecksById: new Map([['deck-1', deck]]),
      groupsBySlotId: new Map([['slot-imported-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.id).toBe('entry-imported')
    expect(result[0]!.slide.contentKind).toBe('image')
    expect((result[0]!.slide as ImageSlide).imageUrl).toBe('https://example.com/a.png')
  })

  it('an entry whose source no longer resolves is omitted from the assembled output while the stored group is untouched', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const resolvingEntry = makeGroupSlideEntry({
      id: 'entry-resolves',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const goneEntry = makeGroupSlideEntry({
      id: 'entry-gone',
      order: 1,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'removed-section' },
    })
    const group = makeSlideGroup({ id: 'slot-song-0', slotId: 'slot-song-0', slides: [resolvingEntry, goneEntry] })
    const originalSlides = group.slides
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.id).toBe('entry-resolves')
    expect(group.slides).toBe(originalSlides)
    expect(group.slides).toHaveLength(2)
  })

  it('a slot with no group in groupsBySlotId still assembles via fallback derivation, with slide ids stable across two successive calls', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result1 = assembleSlideshow(service, inputs)
    const result2 = assembleSlideshow(service, inputs)

    expect(result1.map((r) => r.slide.id)).toEqual(result2.map((r) => r.slide.id))
    expect(result1[0]!.groupId).toBeUndefined()
    expect(result1[0]!.groupSlideId).toBeUndefined()
  })

  it('AssembledSlide carries groupId and groupSlideId when the slide came from a stored group', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const entry = makeGroupSlideEntry({
      id: 'entry-1',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({ id: 'slot-song-0', slotId: 'slot-song-0', slides: [entry] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.groupId).toBe('slot-song-0')
    expect(result[0]!.groupSlideId).toBe('entry-1')
  })

  it('emits strictly in slot position order across slots, and entry.order order within a group', () => {
    const slotSong = songSlot({ id: 'slot-a', songId: 'song-1', position: 1 })
    const slotPrayer: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-b', position: 0 }
    const service = makeService([slotSong, slotPrayer])
    const lyrics = makeSongLyrics()
    const chorusEntry = makeGroupSlideEntry({
      id: 'e-chorus',
      order: 1,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' },
    })
    const verseEntry = makeGroupSlideEntry({
      id: 'e-verse',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({ id: 'slot-a', slotId: 'slot-a', slides: [chorusEntry, verseEntry] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-a', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    // slot-b (position 0, PRAYER, fallback) emits first; slot-a's group
    // entries follow, ordered by entry.order (verse before chorus) despite
    // being stored chorus-first in the group.
    expect(result.map((r) => r.slide.id)).toEqual(['slot-b:0', 'e-verse', 'e-chorus'])
  })

  it("changing a slot's position changes group order in the output while leaving every GroupSlideEntry.order value untouched", () => {
    const slotSong = songSlot({ id: 'slot-song', songId: 'song-1', position: 0 })
    const slotPrayer: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer', position: 1 }
    const lyrics = makeSongLyrics()
    const entry = makeGroupSlideEntry({
      id: 'e-verse',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({ id: 'slot-song', slotId: 'slot-song', slides: [entry] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song', group]]),
    })

    const before = assembleSlideshow(makeService([slotSong, slotPrayer]), inputs)
    expect(before.map((r) => r.slide.id)).toEqual(['e-verse', 'slot-prayer:0'])

    const reorderedService = makeService([
      { ...slotSong, position: 1 },
      { ...slotPrayer, position: 0 },
    ])
    const after = assembleSlideshow(reorderedService, inputs)

    expect(after.map((r) => r.slide.id)).toEqual(['slot-prayer:0', 'e-verse'])
    expect(group.slides[0]!.order).toBe(0)
  })
})

describe('assembleSlideshow — D-04 two-level audio precedence (R030)', () => {
  it("an entry with its own audioUrl resolves to that url even when the group has a bed", () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const entry = makeGroupSlideEntry({
      id: 'entry-1',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
      audioUrl: 'https://example.com/own.mp3',
    })
    const group = makeSlideGroup({
      id: 'slot-song-0',
      slotId: 'slot-song-0',
      slides: [entry],
      bedAudioUrl: 'https://example.com/bed.mp3',
    })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.slide.audioUrl).toBe('https://example.com/own.mp3')
    expect(result[0]!.audioFromBed).toBe(false)
  })

  it('an entry with no audioUrl in a group with a bed resolves to the bed url', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const entry = makeGroupSlideEntry({
      id: 'entry-1',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({
      id: 'slot-song-0',
      slotId: 'slot-song-0',
      slides: [entry],
      bedAudioUrl: 'https://example.com/bed.mp3',
    })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.slide.audioUrl).toBe('https://example.com/bed.mp3')
    expect(result[0]!.audioFromBed).toBe(true)
  })

  it('three consecutive entries where only the middle carries its own audio emit bed, own, bed', () => {
    const slot = scriptureSlot({ id: 'slot-scripture-0', scriptureReadingId: 'reading-1' })
    const service = makeService([slot])
    const reading = makeScriptureReading({
      slides: [
        makeScriptureSlide({ id: 'ss-1', position: 0, verseRange: '16' }),
        makeScriptureSlide({ id: 'ss-2', position: 1, verseRange: '17' }),
        makeScriptureSlide({ id: 'ss-3', position: 2, verseRange: '18' }),
      ],
    })
    const entries: GroupSlideEntry[] = [
      makeGroupSlideEntry({
        id: 'e1',
        order: 0,
        sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'ss-1' },
      }),
      makeGroupSlideEntry({
        id: 'e2',
        order: 1,
        sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'ss-2' },
        audioUrl: 'https://example.com/own.mp3',
      }),
      makeGroupSlideEntry({
        id: 'e3',
        order: 2,
        sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'ss-3' },
      }),
    ]
    const group = makeSlideGroup({
      id: 'slot-scripture-0',
      slotId: 'slot-scripture-0',
      slides: entries,
      bedAudioUrl: 'https://example.com/bed.mp3',
    })
    const inputs = makeInputs({
      scriptureReadingsById: new Map([['reading-1', reading]]),
      groupsBySlotId: new Map([['slot-scripture-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result.map((r) => r.slide.audioUrl)).toEqual([
      'https://example.com/bed.mp3',
      'https://example.com/own.mp3',
      'https://example.com/bed.mp3',
    ])
    expect(result.map((r) => r.audioFromBed)).toEqual([true, false, true])
  })

  it('audioLoop is copied only when the entry itself set it; a bed-resolved slide never carries audioLoop even when a sibling entry set it', () => {
    const slot = scriptureSlot({ id: 'slot-scripture-0', scriptureReadingId: 'reading-1' })
    const service = makeService([slot])
    const reading = makeScriptureReading()
    const entries: GroupSlideEntry[] = [
      makeGroupSlideEntry({
        id: 'e1',
        order: 0,
        sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'ss-1' },
        audioUrl: 'https://example.com/own.mp3',
        audioLoop: true,
      }),
      makeGroupSlideEntry({
        id: 'e2',
        order: 1,
        sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'ss-2' },
      }),
    ]
    const group = makeSlideGroup({
      id: 'slot-scripture-0',
      slotId: 'slot-scripture-0',
      slides: entries,
      bedAudioUrl: 'https://example.com/bed.mp3',
    })
    const inputs = makeInputs({
      scriptureReadingsById: new Map([['reading-1', reading]]),
      groupsBySlotId: new Map([['slot-scripture-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.slide.audioLoop).toBe(true)
    expect('audioLoop' in result[1]!.slide).toBe(false)
  })

  it('a group with no bed and no per-slide audio on any entry emits slides with no audioUrl key at all', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const entry = makeGroupSlideEntry({
      id: 'e1',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({ id: 'slot-song-0', slotId: 'slot-song-0', slides: [entry] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect('audioUrl' in result[0]!.slide).toBe(false)
  })

  it('a slot with no group emits slides with no audioUrl at all (D-19: no legacy slot-media fallback exists to attach)', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(4)
    for (const assembled of result) {
      expect('audioUrl' in assembled.slide).toBe(false)
    }
    expect(result[0]!.audioFromBed).toBeUndefined()
  })
})

describe('assembleSlideshow — D-17 video entries and authored text entries', () => {
  it('a group entry with a video source ref assembles to one slide whose content kind is video and whose own source equals the stored entry source', () => {
    const slot = scriptureSlot({ id: 'slot-scripture-0', scriptureReadingId: 'reading-1' })
    const service = makeService([slot])
    const reading = makeScriptureReading()
    const videoEntry = makeGroupSlideEntry({
      id: 'entry-video',
      order: 0,
      sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' },
    })
    const group = makeSlideGroup({ id: 'slot-scripture-0', slotId: 'slot-scripture-0', slides: [videoEntry] })
    const inputs = makeInputs({
      scriptureReadingsById: new Map([['reading-1', reading]]),
      groupsBySlotId: new Map([['slot-scripture-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.contentKind).toBe('video')
    expect((result[0]!.slide as VideoSlide).videoSrc).toBe('https://example.com/dropped.mp4')
    expect(result[0]!.slide.id).toBe('entry-video')
    expect(result[0]!.sourceId).toBeNull()
  })

  it('WR-01: a video entry in a group that ALSO has an audio bed suppresses the bed — the video keeps its own source, no audioUrl is emitted, and the group\'s own bedAudioUrl field is unaffected', () => {
    const slot = scriptureSlot({ id: 'slot-scripture-0', scriptureReadingId: 'reading-1' })
    const service = makeService([slot])
    const reading = makeScriptureReading()
    const videoEntry = makeGroupSlideEntry({
      id: 'entry-video',
      order: 0,
      sourceRef: { kind: 'video', videoSrc: 'https://example.com/own-footage.mp4' },
    })
    const group = makeSlideGroup({
      id: 'slot-scripture-0',
      slotId: 'slot-scripture-0',
      slides: [videoEntry],
      bedAudioUrl: 'https://example.com/bed.mp3',
    })
    const inputs = makeInputs({
      scriptureReadingsById: new Map([['reading-1', reading]]),
      groupsBySlotId: new Map([['slot-scripture-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(1)
    expect((result[0]!.slide as VideoSlide).videoSrc).toBe('https://example.com/own-footage.mp4')
    expect('audioUrl' in result[0]!.slide).toBe(false)
    expect(result[0]!.audioFromBed).toBe(false)
    expect(group.bedAudioUrl).toBe('https://example.com/bed.mp3')
  })

  it('WR-01: the bed resumes on the next (non-video) slide immediately after a video entry suppressed it', () => {
    const slot = scriptureSlot({ id: 'slot-scripture-0', scriptureReadingId: 'reading-1' })
    const service = makeService([slot])
    const reading = makeScriptureReading({
      slides: [
        makeScriptureSlide({ id: 'ss-1', position: 0, verseRange: '1' }),
      ],
    })
    const videoEntry = makeGroupSlideEntry({
      id: 'entry-video',
      order: 0,
      sourceRef: { kind: 'video', videoSrc: 'https://example.com/own-footage.mp4' },
    })
    const scriptureEntry = makeGroupSlideEntry({
      id: 'entry-scripture',
      order: 1,
      sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'ss-1' },
    })
    const group = makeSlideGroup({
      id: 'slot-scripture-0',
      slotId: 'slot-scripture-0',
      slides: [videoEntry, scriptureEntry],
      bedAudioUrl: 'https://example.com/bed.mp3',
    })
    const inputs = makeInputs({
      scriptureReadingsById: new Map([['reading-1', reading]]),
      groupsBySlotId: new Map([['slot-scripture-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(2)
    expect('audioUrl' in result[0]!.slide).toBe(false)
    expect(result[0]!.audioFromBed).toBe(false)
    expect(result[1]!.slide.audioUrl).toBe('https://example.com/bed.mp3')
    expect(result[1]!.audioFromBed).toBe(true)
  })

  it('a text entry with authored title and body on a SONG slot assembles that title and body', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const authoredEntry = makeGroupSlideEntry({
      id: 'entry-authored',
      order: 0,
      sourceRef: { kind: 'text', title: 'My Slide', body: 'My authored words' },
    })
    const group = makeSlideGroup({ id: 'slot-song-0', slotId: 'slot-song-0', slides: [authoredEntry] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.contentKind).toBe('text')
    expect((result[0]!.slide as TextSlide).title).toBe('My Slide')
    expect((result[0]!.slide as TextSlide).body).toBe('My authored words')
  })

  it('a text entry with no authored content on a PRAYER slot assembles exactly what it does today', () => {
    const slot: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 }
    const service = makeService([slot])
    const plainEntry = makeGroupSlideEntry({ id: 'entry-plain', order: 0, sourceRef: { kind: 'text' } })
    const group = makeSlideGroup({ id: 'slot-prayer-0', slotId: 'slot-prayer-0', slides: [plainEntry] })
    const inputs = makeInputs({ groupsBySlotId: new Map([['slot-prayer-0', group]]) })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.contentKind).toBe('text')
    expect((result[0]!.slide as TextSlide).title).toBe(slotLabel(slot))
    expect((result[0]!.slide as TextSlide).body).toBe(slotLabel(slot))
  })
})

describe('assembleSlideshow — background cascade (R055/R056/R057)', () => {
  it("an entry with its own background wins even when the group AND the song also have one — backgroundSource is 'slide'", () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ backgroundImageUrl: 'https://example.com/song-bg.png' })
    const entry = makeGroupSlideEntry({
      id: 'entry-1',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
      backgroundImageUrl: 'https://example.com/slide-bg.png',
    })
    const group = makeSlideGroup({
      id: 'slot-song-0',
      slotId: 'slot-song-0',
      slides: [entry],
      backgroundImageUrl: 'https://example.com/group-bg.png',
    })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.slide.backgroundImageUrl).toBe('https://example.com/slide-bg.png')
    expect(result[0]!.slide.backgroundSource).toBe('slide')
  })

  it("an entry with no background in a group that has one, song also has one, resolves the group's — backgroundSource is 'group'", () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ backgroundImageUrl: 'https://example.com/song-bg.png' })
    const entry = makeGroupSlideEntry({
      id: 'entry-1',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({
      id: 'slot-song-0',
      slotId: 'slot-song-0',
      slides: [entry],
      backgroundImageUrl: 'https://example.com/group-bg.png',
    })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.slide.backgroundImageUrl).toBe('https://example.com/group-bg.png')
    expect(result[0]!.slide.backgroundSource).toBe('group')
  })

  it("an entry and group with no background fall through to the song's — backgroundSource is 'song'", () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ backgroundImageUrl: 'https://example.com/song-bg.png' })
    const entry = makeGroupSlideEntry({
      id: 'entry-1',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({ id: 'slot-song-0', slotId: 'slot-song-0', slides: [entry] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.slide.backgroundImageUrl).toBe('https://example.com/song-bg.png')
    expect(result[0]!.slide.backgroundSource).toBe('song')
  })

  it('nothing set at any level leaves both backgroundImageUrl and backgroundSource genuinely absent, never present-and-undefined', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const entry = makeGroupSlideEntry({
      id: 'entry-1',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const group = makeSlideGroup({ id: 'slot-song-0', slotId: 'slot-song-0', slides: [entry] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect('backgroundImageUrl' in result[0]!.slide).toBe(false)
    expect('backgroundSource' in result[0]!.slide).toBe(false)
  })

  // ★ Pitfall 3: a PRAYER group has no owning song at all — `song` is
  // `undefined` at the resolution point. Must resolve group-then-nothing
  // without throwing (optional chaining on the song tier).
  it('a PRAYER group with no owning song resolves its group background without throwing (no SongLyrics document exists for this group)', () => {
    const slot: import('@/types/service').NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 }
    const service = makeService([slot])
    const entry = makeGroupSlideEntry({ id: 'entry-prayer', order: 0, sourceRef: { kind: 'text' } })
    const group = makeSlideGroup({
      id: 'slot-prayer-0',
      slotId: 'slot-prayer-0',
      slides: [entry],
      backgroundImageUrl: 'https://example.com/group-bg.png',
    })
    const inputs = makeInputs({ groupsBySlotId: new Map([['slot-prayer-0', group]]) })

    expect(() => assembleSlideshow(service, inputs)).not.toThrow()
    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.slide.backgroundImageUrl).toBe('https://example.com/group-bg.png')
    expect(result[0]!.slide.backgroundSource).toBe('group')
  })

  // ★ Pitfall 1 / the deliberate divergence: a video slide DOES resolve a
  // background through the ordinary cascade — unlike audio, which it never
  // inherits from the group's bed. Both assertions live in the same test so
  // the asymmetry cannot be silently "fixed" away later.
  it("a video entry with no background of its own, in a group that has one, resolves backgroundSource: 'group' while still resolving no bed audio", () => {
    const slot = scriptureSlot({ id: 'slot-scripture-0', scriptureReadingId: 'reading-1' })
    const service = makeService([slot])
    const reading = makeScriptureReading()
    const videoEntry = makeGroupSlideEntry({
      id: 'entry-video',
      order: 0,
      sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' },
    })
    const group = makeSlideGroup({
      id: 'slot-scripture-0',
      slotId: 'slot-scripture-0',
      slides: [videoEntry],
      bedAudioUrl: 'https://example.com/bed.mp3',
      backgroundImageUrl: 'https://example.com/group-bg.png',
    })
    const inputs = makeInputs({
      scriptureReadingsById: new Map([['reading-1', reading]]),
      groupsBySlotId: new Map([['slot-scripture-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(1)
    // Background: resolves normally through the cascade.
    expect(result[0]!.slide.backgroundImageUrl).toBe('https://example.com/group-bg.png')
    expect(result[0]!.slide.backgroundSource).toBe('group')
    // Audio: still suppressed for video (WR-01, unchanged by this task).
    expect('audioUrl' in result[0]!.slide).toBe(false)
    expect(result[0]!.audioFromBed).toBe(false)
  })

  it('a group with backgroundImageUrl set and an empty slides array emits no slides and throws nothing', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const group = makeSlideGroup({
      id: 'slot-song-0',
      slotId: 'slot-song-0',
      slides: [],
      backgroundImageUrl: 'https://example.com/group-bg.png',
    })
    const inputs = makeInputs({ groupsBySlotId: new Map([['slot-song-0', group]]) })

    expect(() => assembleSlideshow(service, inputs)).not.toThrow()
    const result = assembleSlideshow(service, inputs)
    expect(result).toHaveLength(0)
  })

  it('an entry carrying a stale unknown extra property, with no audioUrl, in a group with a bed, still resolves audioUrl from the bed with audioFromBed true', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const entry = {
      id: 'entry-stale',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
      legacyUnknownField: 'leftover-from-a-prior-schema',
    } as unknown as GroupSlideEntry
    const group = makeSlideGroup({
      id: 'slot-song-0',
      slotId: 'slot-song-0',
      slides: [entry],
      bedAudioUrl: 'https://example.com/bed.mp3',
    })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result[0]!.slide.audioUrl).toBe('https://example.com/bed.mp3')
    expect(result[0]!.audioFromBed).toBe(true)
  })

  // WR-01 regression: a SONG group's `slides` array can legitimately contain
  // a `text`/`video` entry alongside its `lyric`/`copyright` entries
  // (slideGroupMaterializer.ts's reconciler carries such entries through by
  // value). Both must resolve the SAME song's background — keying the song
  // lookup on the entry's own `sourceRef.kind` alone left the `text` entry
  // unable to see the song tier even though its `lyric` sibling could.
  it('a SONG group containing one lyric entry and one text entry both resolve the song background — WR-01', () => {
    const slot = songSlot({ id: 'slot-song-0', songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ backgroundImageUrl: 'https://example.com/song-bg.png' })
    const lyricEntry = makeGroupSlideEntry({
      id: 'entry-lyric',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
    })
    const textEntry = makeGroupSlideEntry({
      id: 'entry-text',
      order: 1,
      sourceRef: { kind: 'text', title: 'Note', body: 'hand-added note' },
    })
    const group = makeSlideGroup({
      id: 'slot-song-0',
      slotId: 'slot-song-0',
      slides: [lyricEntry, textEntry],
    })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      groupsBySlotId: new Map([['slot-song-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    const lyricSlide = result.find((r) => r.slide.id === 'entry-lyric')
    const textSlide = result.find((r) => r.slide.id === 'entry-text')
    expect(lyricSlide!.slide.backgroundImageUrl).toBe('https://example.com/song-bg.png')
    expect(lyricSlide!.slide.backgroundSource).toBe('song')
    expect(textSlide!.slide.backgroundImageUrl).toBe('https://example.com/song-bg.png')
    expect(textSlide!.slide.backgroundSource).toBe('song')
  })
})

describe('assembleSlideshow — R045 order lock (permutation property)', () => {
  // Fisher-Yates shuffle. Plain Math.random is deliberate here — a seeded
  // generator is unnecessary because a failing arrangement is reported in
  // the assertion message, not a seed to reproduce it from.
  function shuffle<T>(items: T[]): T[] {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = copy[i]!
      copy[i] = copy[j]!
      copy[j] = tmp
    }
    return copy
  }

  // One fixed mixed slot array: SONG (fallback), SCRIPTURE (materialized),
  // PRAYER (fallback), IMPORTED (fallback), MESSAGE (materialized, hand-added
  // text entry), SONG (materialized) — spanning worship/message/sending/
  // post-service so the fifth section is not special-cased, and mixing
  // materialized-group slots with fallback-derivation slots (not
  // all-or-nothing). Distinct, recognisable ids on every slot.
  const permSlots: ServiceSlot[] = [
    songSlot({ id: 'slot-song-fallback', position: 0, section: 'worship', songId: 'song-1' }),
    scriptureSlot({
      id: 'slot-scripture-materialized',
      position: 1,
      section: 'worship',
      scriptureReadingId: 'reading-1',
    }),
    { kind: 'PRAYER', id: 'slot-prayer-fallback', position: 2, section: 'message' } as NonAssignableSlot,
    importedSlot({ id: 'slot-imported-fallback', position: 3, section: 'sending', importId: 'deck-1' }),
    { kind: 'MESSAGE', id: 'slot-message-materialized', position: 4, section: 'sending' } as NonAssignableSlot,
    songSlot({ id: 'slot-song-materialized', position: 5, section: 'post-service', songId: 'song-2' }),
  ]

  const permLyricsSong1 = makeSongLyrics({ songId: 'song-1', performanceOrder: ['verse-1', 'chorus'] })
  const permLyricsSong2 = makeSongLyrics({
    songId: 'song-2',
    sections: [{ id: 'verse-1', label: 'Verse 1', lines: ['Line X'] }],
    performanceOrder: ['verse-1'],
  })
  const permReading = makeScriptureReading({ id: 'reading-1' })
  const permDeck = makeImportedDeck({ id: 'deck-1' })

  const permScriptureGroup = makeSlideGroup({
    id: 'slot-scripture-materialized',
    slotId: 'slot-scripture-materialized',
    slides: [
      makeGroupSlideEntry({
        id: 'entry-scripture-materialized',
        order: 0,
        sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1' },
      }),
    ],
  })
  const permMessageGroup = makeSlideGroup({
    id: 'slot-message-materialized',
    slotId: 'slot-message-materialized',
    slides: [
      makeGroupSlideEntry({
        id: 'entry-message-materialized',
        order: 0,
        sourceRef: { kind: 'text', title: 'Announcement', body: 'Welcome everyone' },
      }),
    ],
  })
  const permSongGroup = makeSlideGroup({
    id: 'slot-song-materialized',
    slotId: 'slot-song-materialized',
    slides: [
      makeGroupSlideEntry({
        id: 'entry-song-materialized-verse',
        order: 0,
        sourceRef: { kind: 'lyric', songId: 'song-2', sectionId: 'verse-1' },
      }),
      makeGroupSlideEntry({
        id: 'entry-song-materialized-copyright',
        order: 1,
        sourceRef: { kind: 'copyright', songId: 'song-2' },
      }),
    ],
  })

  const permInputs = makeInputs({
    songLyricsById: new Map([
      ['song-1', permLyricsSong1],
      ['song-2', permLyricsSong2],
    ]),
    scriptureReadingsById: new Map([['reading-1', permReading]]),
    importedDecksById: new Map([['deck-1', permDeck]]),
    groupsBySlotId: new Map([
      ['slot-scripture-materialized', permScriptureGroup],
      ['slot-message-materialized', permMessageGroup],
      ['slot-song-materialized', permSongGroup],
    ]),
  })

  it('for 50 shuffled permutations of the fixed slot array, the assembled block order (collapsed by slot id) equals the normalized slots array order — materialized and fallback slots alike, every group contiguous', () => {
    for (let i = 0; i < 50; i++) {
      const shuffled = shuffle(permSlots)
      const normalized = reindexSlots(orderSlotsBySection(shuffled))
      const service = makeService(normalized)

      const result = assembleSlideshow(service, permInputs)

      // Map each emitted slide back to its slot via slotIndex, then collapse
      // consecutive duplicates. A non-contiguous group would produce a
      // repeated (non-consecutive) slot id here, which the toEqual below
      // catches against the normalized array's own id sequence.
      const collapsedIds: string[] = []
      for (const assembled of result) {
        const slotId = normalized[assembled.slotIndex]!.id
        if (collapsedIds[collapsedIds.length - 1] !== slotId) collapsedIds.push(slotId)
      }

      const expectedIds = normalized.map((slot) => slot.id)
      expect(
        collapsedIds,
        `iteration ${i}: shuffled arrangement was [${shuffled.map((slot) => slot.id).join(', ')}]`,
      ).toEqual(expectedIds)
    }
  })

  it('for the same 50 permutations, reindexSlots(orderSlotsBySection(...)) leaves every slot position equal to its own array index', () => {
    for (let i = 0; i < 50; i++) {
      const shuffled = shuffle(permSlots)
      const normalized = reindexSlots(orderSlotsBySection(shuffled))

      normalized.forEach((slot, index) => {
        expect(
          slot.position,
          `iteration ${i}: slot ${slot.id} sits at array index ${index} but carries position ${slot.position}`,
        ).toBe(index)
      })
    }
  })

  it('the owner-reported scenario: moving a scripture slot between two songs produces song, scripture, song in one step', () => {
    const songA = songSlot({ id: 'slot-song-a', position: 0, section: 'worship', songId: 'song-1' })
    const scripture = scriptureSlot({
      id: 'slot-scripture-b',
      position: 1,
      section: 'worship',
      scriptureReadingId: 'reading-1',
    })
    const songB = songSlot({ id: 'slot-song-c', position: 2, section: 'worship', songId: 'song-2' })

    // Owner's reported starting arrangement: scripture, song, song.
    const before = reindexSlots(orderSlotsBySection([scripture, songA, songB]))
    const beforeResult = assembleSlideshow(makeService(before), permInputs)
    const beforeIds = beforeResult.map((r) => before[r.slotIndex]!.id)
    const beforeCollapsed = beforeIds.filter((id, idx) => id !== beforeIds[idx - 1])
    expect(beforeCollapsed).toEqual(['slot-scripture-b', 'slot-song-a', 'slot-song-c'])

    // Move the scripture slot between the two songs — one step, no second action.
    const after = reindexSlots(orderSlotsBySection([songA, scripture, songB]))
    const afterResult = assembleSlideshow(makeService(after), permInputs)
    const afterIds = afterResult.map((r) => after[r.slotIndex]!.id)
    const afterCollapsed = afterIds.filter((id, idx) => id !== afterIds[idx - 1])
    expect(afterCollapsed).toEqual(['slot-song-a', 'slot-scripture-b', 'slot-song-c'])
  })
})

// ---------------------------------------------------------------------------
// Phase 42 (42-05): IMPORTED render-reconciliation fixtures, local to the two
// describe blocks below. Deliberately NOT folded into `makeImportedDeck`
// above — every existing IMPORTED fixture in this file has no
// `renderImportId` on purpose, so all 76 pre-existing tests continue to
// prove the byte-identical parsed-mode fallthrough (D-16) untouched by any
// of this.
// ---------------------------------------------------------------------------

/** A 5-parsed-slide deck carrying a `renderImportId`, so it resolves through
 * every mode `resolveImportedRender` can produce rather than always `parsed`. */
function makeRenderedImportedDeck(overrides: Partial<ImportedDeck> = {}): ImportedDeck {
  return makeImportedDeck({
    id: 'deck-1',
    renderImportId: 'render-1',
    slides: [
      { id: 'is-1', position: 0, contentKind: 'text', title: 'Slide 1', body: 'Body 1' } as TextSlide,
      { id: 'is-2', position: 1, contentKind: 'text', title: 'Slide 2', body: 'Body 2' } as TextSlide,
      { id: 'is-3', position: 2, contentKind: 'text', title: 'Slide 3', body: 'Body 3' } as TextSlide,
      { id: 'is-4', position: 3, contentKind: 'text', title: 'Slide 4', body: 'Body 4' } as TextSlide,
      { id: 'is-5', position: 4, contentKind: 'text', title: 'Slide 5', body: 'Body 5' } as TextSlide,
    ],
    ...overrides,
  })
}

function makeRenderDoc(overrides: Partial<PptxRenderDoc> = {}): PptxRenderDoc {
  return { status: 'pending', ...overrides }
}

/** Builds `AssemblyInputs` with `deck` registered under `deck.id` and, when
 * `render`/`urls` are provided, registered under the deck's OWN
 * `renderImportId` (never under `deck.id` — T-42-07's two-identifier design). */
function makeRenderInputs(
  deck: ImportedDeck,
  render: PptxRenderDoc | undefined,
  urls?: string[],
  overrides: Partial<AssemblyInputs> = {},
): AssemblyInputs {
  const pptxRendersByImportId = new Map<string, PptxRenderDoc>()
  if (render && deck.renderImportId) pptxRendersByImportId.set(deck.renderImportId, render)
  const renderedImageUrlsByImportId = new Map<string, string[]>()
  if (urls && deck.renderImportId) renderedImageUrlsByImportId.set(deck.renderImportId, urls)
  return makeInputs({
    importedDecksById: new Map([[deck.id, deck]]),
    pptxRendersByImportId,
    renderedImageUrlsByImportId,
    ...overrides,
  })
}

/** Mirrors what `slideGroupMaterializer.ts` (42-04) would have stored for
 * this (deck, resolution) pair — built through the SAME shared
 * `importedEntryIdentities` helper the materializer itself calls, so the
 * stored-group tests below exercise a group shaped exactly like production
 * would produce it, never a hand-picked shortcut. */
function groupEntriesForRender(deck: ImportedDeck, resolution: ImportedRenderResolution): GroupSlideEntry[] {
  return importedEntryIdentities(deck, resolution).map((innerSlideId, i) =>
    makeGroupSlideEntry({
      id: `entry-${innerSlideId}`,
      order: i,
      sourceRef: { kind: 'imported', importId: deck.id, innerSlideId },
    }),
  )
}

describe('resolveEntryContent — imported with a render (stored-group path, R079/R080)', () => {
  it('R080: page 1 and page 12 of a 12-page ready render resolve to their own distinct URLs', () => {
    const deck = makeRenderedImportedDeck()
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const urls = Array.from({ length: 12 }, (_, i) => `https://example.com/render-1/page-${i + 1}.png`)
    const entryFirst = makeGroupSlideEntry({
      id: 'entry-page-1',
      order: 0,
      sourceRef: { kind: 'imported', importId: 'deck-1', innerSlideId: 'rendered-page-1' },
    })
    const entryLast = makeGroupSlideEntry({
      id: 'entry-page-12',
      order: 1,
      sourceRef: { kind: 'imported', importId: 'deck-1', innerSlideId: 'rendered-page-12' },
    })
    const group = makeSlideGroup({ id: 'slot-imported-0', slotId: 'slot-imported-0', slides: [entryFirst, entryLast] })
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 12 }), urls, {
      groupsBySlotId: new Map([['slot-imported-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(2)
    expect((result[0]!.slide as ImageSlide).imageUrl).toBe(urls[0])
    expect((result[1]!.slide as ImageSlide).imageUrl).toBe(urls[11])
    expect((result[0]!.slide as ImageSlide).imageUrl).not.toBe((result[1]!.slide as ImageSlide).imageUrl)
  })

  it('R079: a pending render resolves every entry to a defined object with renderState "pending" and no parsed body text', () => {
    const deck = makeRenderedImportedDeck()
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const entries = deck.slides.map((s, i) =>
      makeGroupSlideEntry({
        id: `entry-${s.id}`,
        order: i,
        sourceRef: { kind: 'imported', importId: 'deck-1', innerSlideId: s.id },
      }),
    )
    const group = makeSlideGroup({ id: 'slot-imported-0', slotId: 'slot-imported-0', slides: entries })
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'pending' }), undefined, {
      groupsBySlotId: new Map([['slot-imported-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(5)
    for (const assembled of result) {
      const slide = assembled.slide as ImageSlide
      expect(slide.contentKind).toBe('image')
      expect(slide.renderState).toBe('pending')
      expect(slide.imageUrl).toBe('')
      expect((slide as unknown as Record<string, unknown>).body).toBeUndefined()
      expect((slide as unknown as Record<string, unknown>).title).toBeUndefined()
    }
  })

  it('R079: a failed render resolves every entry to a defined object carrying the failure reason straight off the document', () => {
    const deck = makeRenderedImportedDeck()
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const entries = deck.slides.map((s, i) =>
      makeGroupSlideEntry({
        id: `entry-${s.id}`,
        order: i,
        sourceRef: { kind: 'imported', importId: 'deck-1', innerSlideId: s.id },
      }),
    )
    const group = makeSlideGroup({ id: 'slot-imported-0', slotId: 'slot-imported-0', slides: entries })
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'failed', failureReason: 'render-timeout' }), undefined, {
      groupsBySlotId: new Map([['slot-imported-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(5)
    for (const assembled of result) {
      const slide = assembled.slide as ImageSlide
      expect(slide.renderState).toBe('failed')
      expect(slide.renderFailureReason).toBe('render-timeout')
      expect(slide.imageUrl).toBe('')
    }
  })

  it('R079: a ready render whose URL array has not resolved yet falls back to pending rather than a broken image or undefined', () => {
    const deck = makeRenderedImportedDeck()
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const resolution = resolveImportedRender(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }))
    const entries = groupEntriesForRender(deck, resolution)
    const group = makeSlideGroup({ id: 'slot-imported-0', slotId: 'slot-imported-0', slides: entries })
    // No urls array passed — models the async getDownloadURL cache not having caught up yet.
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }), undefined, {
      groupsBySlotId: new Map([['slot-imported-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(5)
    for (const assembled of result) {
      expect(assembled.slide).toBeDefined()
      const slide = assembled.slide as ImageSlide
      expect(slide.renderState).toBe('pending')
      expect(slide.imageUrl).toBe('')
    }
  })

  it('D-07: a ready/3 render over a 5-parsed-slide deck assembles exactly 3 slides', () => {
    const deck = makeRenderedImportedDeck()
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const resolution = resolveImportedRender(deck, makeRenderDoc({ status: 'ready', renderedCount: 3 }))
    const entries = groupEntriesForRender(deck, resolution)
    const group = makeSlideGroup({ id: 'slot-imported-0', slotId: 'slot-imported-0', slides: entries })
    const urls = ['url-1', 'url-2', 'url-3']
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 3 }), urls, {
      groupsBySlotId: new Map([['slot-imported-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(3)
  })

  it('D-07: a ready/8 render over a 5-parsed-slide deck assembles 8 slides — the 3 surplus present, not dropped, labeled IMAGE', () => {
    const deck = makeRenderedImportedDeck()
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const resolution = resolveImportedRender(deck, makeRenderDoc({ status: 'ready', renderedCount: 8 }))
    const entries = groupEntriesForRender(deck, resolution)
    const group = makeSlideGroup({ id: 'slot-imported-0', slotId: 'slot-imported-0', slides: entries })
    const urls = Array.from({ length: 8 }, (_, i) => `url-${i + 1}`)
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 8 }), urls, {
      groupsBySlotId: new Map([['slot-imported-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(8)
    for (const assembled of result) {
      expect(assembled.slide.contentKind).toBe('image')
      expect(slideContentLabel(assembled.slide)).toBe('IMAGE')
    }
  })

  it('D-06: for a ready render, no assembled slide carries any of the deck\'s parsed slide bodies (an absence assertion)', () => {
    const deck = makeRenderedImportedDeck()
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const resolution = resolveImportedRender(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }))
    const entries = groupEntriesForRender(deck, resolution)
    const group = makeSlideGroup({ id: 'slot-imported-0', slotId: 'slot-imported-0', slides: entries })
    const urls = Array.from({ length: 5 }, (_, i) => `url-${i + 1}`)
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }), urls, {
      groupsBySlotId: new Map([['slot-imported-0', group]]),
    })

    const result = assembleSlideshow(service, inputs)

    const parsedBodies = deck.slides.map((s) => (s.contentKind === 'text' ? s.body : s.imageUrl))
    for (const assembled of result) {
      const slide = assembled.slide as unknown as Record<string, unknown>
      expect(parsedBodies).not.toContain(slide.body)
      expect(parsedBodies).not.toContain(slide.title)
      expect(parsedBodies).not.toContain(slide.altText)
    }
  })
})

describe('assembleSlideshow fallback — IMPORTED with a render (no-group path, R079/R080)', () => {
  it('R079: the fallback path resolves a ready render content-for-content the same as the stored-group path (ids differ by construction)', () => {
    const deck = makeRenderedImportedDeck()
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const urls = ['url-1', 'url-2', 'url-3', 'url-4', 'url-5']

    const fallbackInputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }), urls)
    const fallbackResult = assembleSlideshow(service, fallbackInputs)

    const resolution = resolveImportedRender(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }))
    const groupEntries = groupEntriesForRender(deck, resolution)
    const group = makeSlideGroup({ id: 'slot-imported-0', slotId: 'slot-imported-0', slides: groupEntries })
    const groupInputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }), urls, {
      groupsBySlotId: new Map([['slot-imported-0', group]]),
    })
    const groupResult = assembleSlideshow(service, groupInputs)

    expect(fallbackResult).toHaveLength(groupResult.length)
    fallbackResult.forEach((assembled, i) => {
      expect(assembled.slide.contentKind).toBe(groupResult[i]!.slide.contentKind)
      expect((assembled.slide as ImageSlide).imageUrl).toBe((groupResult[i]!.slide as ImageSlide).imageUrl)
      // ids differ by construction — the fallback derives ids from slot.id, existing behaviour.
      expect(assembled.slide.id).not.toBe(groupResult[i]!.slide.id)
    })
  })

  it('R079/T-42-11: a pending render assembles the full parsed-count number of slides on the fallback path — none omitted by the content guard', () => {
    const deck = makeRenderedImportedDeck()
    const slot = importedSlot({ id: 'slot-imported-0', importId: 'deck-1' })
    const service = makeService([slot])
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'pending' }))

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(deck.slides.length)
    for (const assembled of result) {
      expect((assembled.slide as ImageSlide).renderState).toBe('pending')
    }
  })

  it('T-42-07: a deck with no renderImportId, sharing a service with a rendered deck, assembles exactly its own parsed slides', () => {
    const renderedDeck = makeRenderedImportedDeck({ id: 'deck-rendered' })
    const plainDeck = makeImportedDeck({ id: 'deck-plain' }) // no renderImportId (D-16) — 2 parsed slides
    const slotRendered = importedSlot({ id: 'slot-rendered', position: 0, importId: 'deck-rendered' })
    const slotPlain = importedSlot({ id: 'slot-plain', position: 1, importId: 'deck-plain' })
    const service = makeService([slotRendered, slotPlain])
    const urls = ['url-1', 'url-2', 'url-3']
    const inputs = makeInputs({
      importedDecksById: new Map([
        ['deck-rendered', renderedDeck],
        ['deck-plain', plainDeck],
      ]),
      pptxRendersByImportId: new Map([['render-1', makeRenderDoc({ status: 'ready', renderedCount: 3 })]]),
      renderedImageUrlsByImportId: new Map([['render-1', urls]]),
    })

    const result = assembleSlideshow(service, inputs)

    const renderedResults = result.filter((r) => r.slotIndex === 0)
    const plainResults = result.filter((r) => r.slotIndex === 1)

    expect(renderedResults).toHaveLength(3)
    for (const assembled of renderedResults) {
      expect(assembled.slide.contentKind).toBe('image')
    }

    expect(plainResults).toHaveLength(plainDeck.slides.length)
    expect(plainResults[0]!.slide.contentKind).toBe('text')
    const firstPlainSlide = plainDeck.slides[0] as TextSlide
    expect((plainResults[0]!.slide as TextSlide).body).toBe(firstPlainSlide.body)
  })
})
