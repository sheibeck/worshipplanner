import { describe, it, expect } from 'vitest'
import { assembleSlideshow } from '@/utils/slideshowAssembler'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import type {
  Service,
  ServiceSlot,
  SongSlot,
  ScriptureSlot,
} from '@/types/service'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { ScriptureSlide, CopyrightSlide, LyricSlide } from '@/types/slide'
import type { Timestamp } from 'firebase/firestore'

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

function makeInputs(overrides: Partial<AssemblyInputs> = {}): AssemblyInputs {
  return {
    songLyricsById: new Map(),
    performanceOrderById: new Map(),
    scriptureReadingsById: new Map(),
    ...overrides,
  }
}

function songSlot(overrides: Partial<SongSlot> = {}): SongSlot {
  return {
    kind: 'SONG',
    position: 0,
    requiredVwType: 1,
    songId: null,
    songTitle: null,
    songKey: null,
    ...overrides,
  }
}

function scriptureSlot(overrides: Partial<ScriptureSlot> = {}): ScriptureSlot {
  return {
    kind: 'SCRIPTURE',
    position: 0,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    ...overrides,
  }
}

describe('assembleSlideshow — song resolution', () => {
  it('emits leading copyright, ordered section slides, trailing copyright for a 2-section song', () => {
    const slot = songSlot({ songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
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
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    const result = assembleSlideshow(service, inputs)

    for (const assembled of result) {
      expect(assembled.slotIndex).toBe(0)
      expect(assembled.slotKind).toBe('SONG')
      expect(assembled.section).toBe('worship')
      expect(assembled.sourceId).toBe('song-1')
    }
  })

  it('falls back to lyrics.performanceOrder when performanceOrderById has no entry for the song', () => {
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

  it('falls back to lyrics.sections stored order when both performanceOrderById and lyrics.performanceOrder are empty', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics({ performanceOrder: [] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect((result[1]!.slide as LyricSlide).sectionId).toBe('verse-1')
    expect((result[2]!.slide as LyricSlide).sectionId).toBe('chorus')
  })

  it('skips order entries that do not resolve to a known lyrics.section, without throwing', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'bogus-section', 'chorus']]]),
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

describe('assembleSlideshow — scripture resolution', () => {
  it('emits one AssembledSlide per reading.slides entry, in stored order, content unchanged', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const service = makeService([slot])
    const reading = makeScriptureReading()
    const inputs = makeInputs({
      scriptureReadingsById: new Map([['reading-1', reading]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(reading.slides.length)
    expect(result[0]!.slide.contentKind).toBe('scripture')
    expect((result[0]!.slide as ScriptureSlide).verseRange).toBe('16')
    expect((result[0]!.slide as ScriptureSlide).reference).toBe(reading.slides[0]!.reference)
    expect((result[0]!.slide as ScriptureSlide).text).toBe(reading.slides[0]!.text)
    expect((result[1]!.slide as ScriptureSlide).verseRange).toBe('17')
  })

  it('every emitted slide from a scripture slot carries slotIndex, slotKind, section, and sourceId', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1', section: 'worship' })
    const service = makeService([slot])
    const reading = makeScriptureReading()
    const inputs = makeInputs({
      scriptureReadingsById: new Map([['reading-1', reading]]),
    })

    const result = assembleSlideshow(service, inputs)

    for (const assembled of result) {
      expect(assembled.slotIndex).toBe(0)
      expect(assembled.slotKind).toBe('SCRIPTURE')
      expect(assembled.section).toBe('worship')
      expect(assembled.sourceId).toBe('reading-1')
    }
  })

  it('a SCRIPTURE slot with scriptureReadingId === null contributes nothing', () => {
    const slot = scriptureSlot({ scriptureReadingId: null })
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())
    expect(result).toHaveLength(0)
  })

  it('a SCRIPTURE slot with no scriptureReadingId field contributes nothing', () => {
    const slot = scriptureSlot()
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())
    expect(result).toHaveLength(0)
  })

  it('a SCRIPTURE slot whose scriptureReadingId is absent from scriptureReadingsById contributes nothing', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'unloaded-reading' })
    const service = makeService([slot])
    const result = assembleSlideshow(service, makeInputs())
    expect(result).toHaveLength(0)
  })
})
