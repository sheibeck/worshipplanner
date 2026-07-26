import { describe, it, expect } from 'vitest'
import {
  deriveGroupEntries,
  sourceSignature,
  buildInitialGroup,
  hasCustomization,
  reconcileSongGroup,
} from '@/utils/slideGroupMaterializer'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import type { SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ImportedSlot } from '@/types/service'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { ImportedDeck } from '@/types/importedDeck'
import type { ScriptureSlide, TextSlide, ImageSlide } from '@/types/slide'
import type { SlideGroup } from '@/types/slideGroup'
import type { Timestamp } from 'firebase/firestore'

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp

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
      makeScriptureSlide({ id: 'ss-1', position: 0, verseRange: '16', text: 'For God so loved the world' }),
      makeScriptureSlide({ id: 'ss-2', position: 1, verseRange: '17', text: 'that he gave his only Son' }),
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

function makeGroup(overrides: Partial<SlideGroup> = {}): SlideGroup {
  return {
    id: 'slot-1',
    serviceId: 'svc-1',
    slotId: 'slot-1',
    slides: [],
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  }
}

describe('deriveGroupEntries — SONG', () => {
  it('derives copyright, lyric, lyric, copyright in order for a 2-section song', () => {
    const slot = songSlot({ songId: 'song-1' })
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(4)
    expect(entries.map((e) => e.sourceRef.kind)).toEqual(['copyright', 'lyric', 'lyric', 'copyright'])
    expect(entries.map((e) => e.order)).toEqual([0, 1, 2, 3])
    expect(new Set(entries.map((e) => e.id)).size).toBe(4)
  })

  it('a SONG slot with null songId derives zero entries', () => {
    const slot = songSlot({ songId: null })
    expect(deriveGroupEntries(slot, makeInputs())).toEqual([])
  })

  it('a SONG slot whose lyrics are absent from the input map derives zero entries', () => {
    const slot = songSlot({ songId: 'unloaded-song' })
    expect(deriveGroupEntries(slot, makeInputs())).toEqual([])
  })

  it('no derived entry contains slide text', () => {
    const slot = songSlot({ songId: 'song-1' })
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    const entries = deriveGroupEntries(slot, inputs)
    for (const entry of entries) {
      const raw = entry as unknown as Record<string, unknown>
      expect(raw).not.toHaveProperty('text')
      expect(raw).not.toHaveProperty('lines')
      expect(raw).not.toHaveProperty('body')
    }
  })
})

describe('deriveGroupEntries — SCRIPTURE', () => {
  it('derives one scripture entry per inner slide, carrying its id in sourceRef.innerSlideId', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.sourceRef)).toEqual([
      { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'ss-1' },
      { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'ss-2' },
    ])
  })

  it('a SCRIPTURE slot with no scriptureReadingId derives zero entries', () => {
    const slot = scriptureSlot()
    expect(deriveGroupEntries(slot, makeInputs())).toEqual([])
  })

  it('a SCRIPTURE slot whose reading id is absent from the input map derives zero entries', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'unloaded-reading' })
    expect(deriveGroupEntries(slot, makeInputs())).toEqual([])
  })
})

describe('deriveGroupEntries — IMPORTED', () => {
  it('derives one imported entry per deck slide', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.sourceRef)).toEqual([
      { kind: 'imported', importId: 'deck-1', innerSlideId: 'is-1' },
      { kind: 'imported', importId: 'deck-1', innerSlideId: 'is-2' },
    ])
  })

  it('an IMPORTED slot with no importId derives zero entries', () => {
    const slot = importedSlot()
    expect(deriveGroupEntries(slot, makeInputs())).toEqual([])
  })
})

describe('deriveGroupEntries — PRAYER/MESSAGE/HYMN', () => {
  it('a PRAYER slot derives exactly one text entry', () => {
    const slot: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 }
    const entries = deriveGroupEntries(slot, makeInputs())
    expect(entries).toHaveLength(1)
    expect(entries[0]!.sourceRef).toEqual({ kind: 'text' })
  })

  it('a MESSAGE slot derives exactly one text entry', () => {
    const slot: NonAssignableSlot = { kind: 'MESSAGE', id: 'slot-message-0', position: 0 }
    const entries = deriveGroupEntries(slot, makeInputs())
    expect(entries).toHaveLength(1)
    expect(entries[0]!.sourceRef).toEqual({ kind: 'text' })
  })

  it('a HYMN slot derives exactly one text entry', () => {
    const slot: HymnSlot = {
      kind: 'HYMN',
      id: 'slot-hymn-0',
      position: 0,
      hymnName: 'How Great Thou Art',
      hymnNumber: '12',
      verses: '',
    }
    const entries = deriveGroupEntries(slot, makeInputs())
    expect(entries).toHaveLength(1)
    expect(entries[0]!.sourceRef).toEqual({ kind: 'text' })
  })
})

describe('buildInitialGroup', () => {
  it('copies audioUrl/videoUrl onto bedAudioUrl/bedVideoUrl when present', () => {
    const slot = songSlot({
      id: 'slot-1',
      songId: 'song-1',
      audioUrl: 'https://example.com/a.mp3',
      videoUrl: 'https://example.com/a.mp4',
    })
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    const group = buildInitialGroup(slot, 'svc-1', inputs)

    expect(group.bedAudioUrl).toBe('https://example.com/a.mp3')
    expect(group.bedVideoUrl).toBe('https://example.com/a.mp4')
    expect(group.id).toBe('slot-1')
    expect(group.slotId).toBe('slot-1')
    expect(group.serviceId).toBe('svc-1')
  })

  it('omits bedAudioUrl/bedVideoUrl entirely when the slot has neither', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    const group = buildInitialGroup(slot, 'svc-1', inputs)

    expect('bedAudioUrl' in group).toBe(false)
    expect('bedVideoUrl' in group).toBe(false)
  })

  it("does not clear or rewrite the slot's deprecated audioUrl/videoUrl fields", () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1', audioUrl: 'https://example.com/a.mp3' })
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    buildInitialGroup(slot, 'svc-1', inputs)

    expect(slot.audioUrl).toBe('https://example.com/a.mp3')
  })
})

describe('sourceSignature', () => {
  it('returns undefined for text-kind slots (PRAYER/MESSAGE/HYMN)', () => {
    const slot: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 }
    expect(sourceSignature(slot, makeInputs())).toBeUndefined()
  })

  it('returns a defined signature for a resolvable scripture slot', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    expect(sourceSignature(slot, inputs)).toBeDefined()
  })
})

describe('hasCustomization', () => {
  it('is false for a group with no label/notes/audio/bed media', () => {
    const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }] })
    expect(hasCustomization(group)).toBe(false)
  })

  it('is true when any entry has a label', () => {
    const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' }, label: 'Custom' }] })
    expect(hasCustomization(group)).toBe(true)
  })

  it('is true when any entry has notes', () => {
    const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' }, notes: 'Note' }] })
    expect(hasCustomization(group)).toBe(true)
  })

  it('is true when any entry has audioUrl', () => {
    const group = makeGroup({
      slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' }, audioUrl: 'https://example.com/x.mp3' }],
    })
    expect(hasCustomization(group)).toBe(true)
  })

  it('is true when the group has a bedAudioUrl', () => {
    const group = makeGroup({ bedAudioUrl: 'https://example.com/bed.mp3', slides: [] })
    expect(hasCustomization(group)).toBe(true)
  })

  it('is true when the group has a bedVideoUrl', () => {
    const group = makeGroup({ bedVideoUrl: 'https://example.com/bed.mp4', slides: [] })
    expect(hasCustomization(group)).toBe(true)
  })
})

describe('reconcileSongGroup', () => {
  function makeStoredSongGroup(slides: SlideGroup['slides']): SlideGroup {
    return makeGroup({ id: 'slot-1', slotId: 'slot-1', slides })
  }

  const twoSectionStoredSlides: SlideGroup['slides'] = [
    { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
    { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
    { id: 'e-chorus', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
    { id: 'e-copyright-trail', order: 3, sourceRef: { kind: 'copyright', songId: 'song-1' } },
  ]

  const threeSectionLyrics = () =>
    makeSongLyrics({
      sections: [
        { id: 'verse-1', label: 'Verse 1', lines: ['Line A'] },
        { id: 'chorus', label: 'Chorus', lines: ['Line C'] },
        { id: 'bridge', label: 'Bridge', lines: ['Line D'] },
      ],
    })

  it('a song that gains a Bridge yields stored entries untouched plus a new lyric entry for it', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const lyrics = threeSectionLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus', 'bridge']]]),
    })

    const result = reconcileSongGroup(group, slot, inputs)

    expect(result.changed).toBe(true)
    expect(result.slides).toHaveLength(5)
    for (const storedId of ['e-copyright-lead', 'e-verse-1', 'e-chorus', 'e-copyright-trail']) {
      expect(result.slides.some((e) => e.id === storedId)).toBe(true)
    }
    const bridgeEntry = result.slides.find(
      (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'bridge',
    )
    expect(bridgeEntry).toBeDefined()
  })

  it('an entry with a label and audioUrl survives reconciliation with an unrelated new verse (Pitfall 4 regression)', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup([
      { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      {
        id: 'e-verse-1',
        order: 1,
        sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
        label: 'Custom Verse Label',
        audioUrl: 'https://example.com/verse.mp3',
      },
      { id: 'e-chorus', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
      { id: 'e-copyright-trail', order: 3, sourceRef: { kind: 'copyright', songId: 'song-1' } },
    ])
    const lyrics = threeSectionLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus', 'bridge']]]),
    })

    const result = reconcileSongGroup(group, slot, inputs)

    const verseEntry = result.slides.find((e) => e.id === 'e-verse-1')
    expect(verseEntry?.label).toBe('Custom Verse Label')
    expect(verseEntry?.audioUrl).toBe('https://example.com/verse.mp3')
    expect(result.slides.some((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'bridge')).toBe(true)
  })

  it('an entry whose sectionId no longer resolves is retained with its label/notes intact', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup([
      { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
      {
        id: 'e-chorus',
        order: 2,
        sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' },
        label: 'Keep Me',
        notes: 'Old note',
      },
      { id: 'e-copyright-trail', order: 3, sourceRef: { kind: 'copyright', songId: 'song-1' } },
    ])
    // 'chorus' section removed from the song's stored sections entirely.
    const lyrics = makeSongLyrics({
      sections: [{ id: 'verse-1', label: 'Verse 1', lines: ['Line A'] }],
      performanceOrder: ['verse-1'],
    })
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const result = reconcileSongGroup(group, slot, inputs)

    const chorusEntry = result.slides.find((e) => e.id === 'e-chorus')
    expect(chorusEntry).toBeDefined()
    expect(chorusEntry?.label).toBe('Keep Me')
    expect(chorusEntry?.notes).toBe('Old note')
  })

  it('reconciling an already-in-sync group returns changed: false and an entry list deep-equal to the stored one', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    const result = reconcileSongGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('never duplicates the two copyright entries — exactly one leading, one trailing', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const lyrics = threeSectionLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus', 'bridge']]]),
    })

    const result = reconcileSongGroup(group, slot, inputs)

    const copyrightEntries = result.slides.filter((e) => e.sourceRef.kind === 'copyright')
    expect(copyrightEntries).toHaveLength(2)
    expect(result.slides[0]!.sourceRef.kind).toBe('copyright')
    expect(result.slides[result.slides.length - 1]!.sourceRef.kind).toBe('copyright')
  })

  it('order values on the returned list are contiguous from 0', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const lyrics = threeSectionLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus', 'bridge']]]),
    })

    const result = reconcileSongGroup(group, slot, inputs)

    expect(result.slides.map((e) => e.order)).toEqual(result.slides.map((_, i) => i))
  })
})
