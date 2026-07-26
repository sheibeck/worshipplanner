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
import type { ScriptureSlide, CopyrightSlide, LyricSlide, TextSlide, ImageSlide } from '@/types/slide'
import type { Timestamp } from 'firebase/firestore'
import { slotLabel } from '@/utils/slotTypes'

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
    performanceOrderById: new Map(),
    scriptureReadingsById: new Map(),
    importedDecksById: new Map(),
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

function scriptureSlot(overrides: Partial<ScriptureSlot> = {}): ScriptureSlot {
  return {
    kind: 'SCRIPTURE',
    id: 'slot-scripture-0',
    position: 0,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
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
  it('a SONG slot with audioUrl set carries it ONLY on the first emitted (leading copyright) slide', () => {
    const slot = songSlot({ songId: 'song-1', audioUrl: 'https://example.com/track.mp3' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    const result = assembleSlideshow(service, inputs)

    expect(result).toHaveLength(4)
    expect(result[0]!.slide.audioUrl).toBe('https://example.com/track.mp3')
    expect(result[1]!.slide.audioUrl).toBeUndefined()
    expect(result[2]!.slide.audioUrl).toBeUndefined()
    expect(result[3]!.slide.audioUrl).toBeUndefined()
    expect(result[0]!.slide.videoUrl).toBeUndefined()
  })

  it('a slot with no media produces slides whose audioUrl and videoUrl are both undefined', () => {
    const slot = songSlot({ songId: 'song-1' })
    const service = makeService([slot])
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    const result = assembleSlideshow(service, inputs)

    for (const assembled of result) {
      expect(assembled.slide.audioUrl).toBeUndefined()
      expect(assembled.slide.videoUrl).toBeUndefined()
    }
  })

  it('a single-slide MESSAGE slot with videoUrl set carries it on its one emitted slide', () => {
    const slot: NonAssignableSlot = { kind: 'MESSAGE', id: 'slot-message-0', position: 0, videoUrl: 'https://example.com/announcement.mp4' }
    const service = makeService([slot])

    const result = assembleSlideshow(service, makeInputs())

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.videoUrl).toBe('https://example.com/announcement.mp4')
    expect(result[0]!.slide.audioUrl).toBeUndefined()
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

    const lyrics1 = makeSongLyrics()
    const lyrics2 = makeSongLyrics({
      songId: 'song-2',
      sections: [{ id: 'verse-1', label: 'Verse 1', lines: ['Line X'] }],
      performanceOrder: ['verse-1'],
    })
    const reading = makeScriptureReading()

    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics1], ['song-2', lyrics2]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
      scriptureReadingsById: new Map([['reading-1', reading]]),
    })

    const service = makeService([songSlotWorship, scriptureSlotWorship, prayerSlotMessage, songSlotSending])
    const result = assembleSlideshow(service, inputs)

    // song-1: copyright, verse-1, chorus, copyright (4) — worship
    // reading-1: 2 slides — worship
    // prayer: 1 slide — message
    // song-2: copyright, verse-1, copyright (3) — sending
    expect(result.map((r) => r.section)).toEqual([
      'worship', 'worship', 'worship', 'worship',
      'worship', 'worship',
      'message',
      'sending', 'sending', 'sending',
    ])
    expect(result.filter((r) => r.section === 'worship')).toHaveLength(6)
    expect(result.filter((r) => r.section === 'message')).toHaveLength(1)
    expect(result.filter((r) => r.section === 'sending')).toHaveLength(3)
  })
})
