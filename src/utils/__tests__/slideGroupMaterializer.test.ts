import { describe, it, expect } from 'vitest'
import {
  deriveGroupEntries,
  sourceSignature,
  buildInitialGroup,
  hasCustomization,
  reconcileSongGroup,
  reconcileScriptureGroup,
  reconcileImportedGroup,
  reconcileGroup,
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
    groupsBySlotId: new Map(),
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
  it('never sets bedAudioUrl — no legacy slot-media migration exists under D-19', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })

    const group = buildInitialGroup(slot, 'svc-1', inputs)

    expect('bedAudioUrl' in group).toBe(false)
    expect(group.id).toBe('slot-1')
    expect(group.slotId).toBe('slot-1')
    expect(group.serviceId).toBe('svc-1')
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

  it('is true when any entry is a non-derivable video entry (D-17 ripple)', () => {
    const group = makeGroup({
      slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } }],
    })
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

  it('D-08: a within-song section change (same song) never reports a swap', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const lyrics = threeSectionLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus', 'bridge']]]),
    })

    const result = reconcileSongGroup(group, slot, inputs)

    expect(result.songSwap).toBeUndefined()
  })

  it('D-08: a song plan item with no song assigned returns the unchanged result with no swap detail', () => {
    const slot = songSlot({ id: 'slot-1', songId: null })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const inputs = makeInputs()

    const result = reconcileSongGroup(group, slot, inputs)

    expect(result).toEqual({ needsConfirm: false, changed: false, slides: group.slides })
    expect(result.songSwap).toBeUndefined()
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

  // --- CR-01 regression: a songId change is a source-IDENTITY swap, not a
  // section-level edit — it must never run through the additive merge above,
  // which would blend the old song's copyright/lyric entries with the new
  // song's. Routed through the same signature+customization confirm gate
  // reconcileUnstableIdGroup uses for scripture/imported groups.
  describe('song identity swap (CR-01)', () => {
    const songBLyrics = () =>
      makeSongLyrics({
        songId: 'song-b',
        sections: [{ id: 'verse-1-b', label: 'Verse 1', lines: ['Song B line'] }],
      })

    it('an uncustomized group is replaced wholesale when slot.songId changes to a different song', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
      const group = makeStoredSongGroup(twoSectionStoredSlides) // all entries reference song-1
      const lyrics = songBLyrics()
      const inputs = makeInputs({
        songLyricsById: new Map([['song-b', lyrics]]),
        performanceOrderById: new Map([['song-b', ['verse-1-b']]]),
      })

      const result = reconcileSongGroup(group, slot, inputs)

      expect(result.needsConfirm).toBe(false)
      expect(result.changed).toBe(true)
      // Every entry references ONLY the new song — no blended song-1 leftovers.
      for (const entry of result.slides) {
        if (entry.sourceRef.kind === 'lyric' || entry.sourceRef.kind === 'copyright') {
          expect(entry.sourceRef.songId).toBe('song-b')
        }
      }
      expect(result.slides.some((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'verse-1-b')).toBe(
        true,
      )
    })

    it('a customized group requires confirm when slot.songId changes to a different song, and the stored slides are left untouched', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        {
          id: 'e-verse-1',
          order: 1,
          sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
          label: 'Custom Verse Label',
          audioUrl: 'https://example.com/verse.mp3',
        },
        { id: 'e-copyright-trail', order: 2, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      const lyrics = songBLyrics()
      const inputs = makeInputs({
        songLyricsById: new Map([['song-b', lyrics]]),
        performanceOrderById: new Map([['song-b', ['verse-1-b']]]),
      })

      const result = reconcileSongGroup(group, slot, inputs)

      expect(result.needsConfirm).toBe(true)
      expect(result.changed).toBe(false)
      expect(result.slides).toEqual(group.slides)
      expect(result.proposed).toBeDefined()
      expect(result.proposed!.every((e) => e.sourceRef.kind !== 'lyric' || e.sourceRef.songId === 'song-b')).toBe(
        true,
      )
      expect(result.loss).toEqual({ customizedEntries: 1, withAudio: 1, withNotes: 0 })
    })

    // D-08: the reconciler must name the OLD and NEW song on a customized
    // identity swap — the confirm dialog's copy needs both ids to render
    // "This plan item was reassigned from Song A to Song B" (26-RESEARCH.md
    // Pattern 3, "The D-08 song-name gap").
    it('D-08: a customized song-identity swap reports old song A and new song B on songSwap', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        {
          id: 'e-verse-1',
          order: 1,
          sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
          label: 'Custom Verse Label',
        },
        { id: 'e-copyright-trail', order: 2, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      const lyrics = songBLyrics()
      const inputs = makeInputs({
        songLyricsById: new Map([['song-b', lyrics]]),
        performanceOrderById: new Map([['song-b', ['verse-1-b']]]),
      })

      const result = reconcileSongGroup(group, slot, inputs)

      expect(result.needsConfirm).toBe(true)
      expect(result.songSwap).toEqual({ oldSongId: 'song-1', newSongId: 'song-b' })
    })

    it('D-08: an UNcustomized song-identity swap replaces silently and reports no swap detail', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
      const group = makeStoredSongGroup(twoSectionStoredSlides) // uncustomized — no label/notes/audio
      const lyrics = songBLyrics()
      const inputs = makeInputs({
        songLyricsById: new Map([['song-b', lyrics]]),
        performanceOrderById: new Map([['song-b', ['verse-1-b']]]),
      })

      const result = reconcileSongGroup(group, slot, inputs)

      expect(result.needsConfirm).toBe(false)
      expect(result.changed).toBe(true)
      expect(result.songSwap).toBeUndefined()
    })

    it('a SONG slot whose songId changes must not retain the previous song copyright or produce unresolvable lyric entries referencing the old song', () => {
      // The exact CR-01 reproduction: an uncustomized group materialized for
      // Song A, then the user picks Song B for the same slot. The additive
      // merge's "retained-but-unresolvable" rule must never fire here — the
      // whole group is replaced, so no song-1-referencing entry survives.
      const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
      const group = makeStoredSongGroup(twoSectionStoredSlides) // song-1 copyright + 2 lyric entries
      const lyrics = songBLyrics()
      const inputs = makeInputs({
        songLyricsById: new Map([['song-b', lyrics]]),
        performanceOrderById: new Map([['song-b', ['verse-1-b']]]),
      })

      const result = reconcileSongGroup(group, slot, inputs)

      const staleSongOneEntries = result.slides.filter(
        (e) =>
          (e.sourceRef.kind === 'lyric' || e.sourceRef.kind === 'copyright') && e.sourceRef.songId === 'song-1',
      )
      expect(staleSongOneEntries).toHaveLength(0)
    })
  })
})

describe('reconcileScriptureGroup', () => {
  function makeInSyncScriptureGroup(slot: ScriptureSlot, inputs: AssemblyInputs): SlideGroup {
    return makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: deriveGroupEntries(slot, inputs),
    })
  }

  it('an unchanged signature returns needsConfirm false, changed false, stored entries untouched', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeInSyncScriptureGroup(slot, inputs)

    const result = reconcileScriptureGroup(group, slot, inputs)

    expect(result.needsConfirm).toBe(false)
    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('a diverged signature on an uncustomized group returns fresh entries with needsConfirm false, changed true', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeInSyncScriptureGroup(slot, inputs)

    const widenedReading = makeScriptureReading({
      slides: [
        makeScriptureSlide({ id: 'ss-1', position: 0, verseRange: '16', text: 'For God so loved the world' }),
        makeScriptureSlide({ id: 'ss-2', position: 1, verseRange: '17', text: 'that he gave his only Son' }),
        makeScriptureSlide({ id: 'ss-3', position: 2, verseRange: '18', text: 'that whoever believes in him' }),
      ],
    })
    const widenedInputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', widenedReading]]) })

    const result = reconcileScriptureGroup(group, slot, widenedInputs)

    expect(result.needsConfirm).toBe(false)
    expect(result.changed).toBe(true)
    expect(result.slides).toHaveLength(3)
  })

  it('a diverged signature on a customized group returns needsConfirm true, stored entries unchanged, plus a proposed list and loss summary', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeInSyncScriptureGroup(slot, inputs)
    group.slides[0]!.audioUrl = 'https://example.com/slide-audio.mp3'

    const widenedReading = makeScriptureReading({
      slides: [
        makeScriptureSlide({ id: 'ss-1', position: 0, verseRange: '16', text: 'For God so loved the world' }),
        makeScriptureSlide({ id: 'ss-2', position: 1, verseRange: '17', text: 'that he gave his only Son' }),
        makeScriptureSlide({ id: 'ss-3', position: 2, verseRange: '18', text: 'that whoever believes in him' }),
      ],
    })
    const widenedInputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', widenedReading]]) })

    const result = reconcileScriptureGroup(group, slot, widenedInputs)

    expect(result.needsConfirm).toBe(true)
    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
    expect(result.proposed).toHaveLength(3)
    expect(result.loss?.customizedEntries).toBe(1)
    expect(result.loss?.withAudio).toBe(1)
    // D-08 field is specific to song identity — a confirmation-required
    // scripture group must never report a swap.
    expect(result.songSwap).toBeUndefined()
  })

  it('detects divergence when slide count is unchanged but text changed', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeInSyncScriptureGroup(slot, inputs)

    const editedReading = makeScriptureReading({
      slides: [
        makeScriptureSlide({ id: 'ss-1', position: 0, verseRange: '16', text: 'A completely different verse text' }),
        makeScriptureSlide({ id: 'ss-2', position: 1, verseRange: '17', text: 'that he gave his only Son' }),
      ],
    })
    const editedInputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', editedReading]]) })

    const result = reconcileScriptureGroup(group, slot, editedInputs)

    expect(result.changed).toBe(true)
  })
})

describe('reconcileImportedGroup', () => {
  it('behaves identically to the scripture reconciler, differing only in source kind', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const group = makeGroup({ sourceSignature: sourceSignature(slot, inputs), slides: deriveGroupEntries(slot, inputs) })

    const inSync = reconcileImportedGroup(group, slot, inputs)
    expect(inSync.needsConfirm).toBe(false)
    expect(inSync.changed).toBe(false)

    const widenedDeck = makeImportedDeck({
      slides: [
        { id: 'is-1', position: 0, contentKind: 'text', title: 'Welcome', body: 'Welcome to church' } as TextSlide,
        { id: 'is-2', position: 1, contentKind: 'image', imageUrl: 'https://example.com/a.png', altText: 'slide 2' } as ImageSlide,
        { id: 'is-3', position: 2, contentKind: 'text', title: 'Announcement', body: 'New announcement' } as TextSlide,
      ],
    })
    const widenedInputs = makeInputs({ importedDecksById: new Map([['deck-1', widenedDeck]]) })

    const uncustomized = reconcileImportedGroup(group, slot, widenedInputs)
    expect(uncustomized.needsConfirm).toBe(false)
    expect(uncustomized.changed).toBe(true)
    expect(uncustomized.slides).toHaveLength(3)

    const customizedGroup: SlideGroup = {
      ...group,
      slides: group.slides.map((e, i) => (i === 0 ? { ...e, label: 'Custom' } : e)),
    }
    const customized = reconcileImportedGroup(customizedGroup, slot, widenedInputs)
    expect(customized.needsConfirm).toBe(true)
    expect(customized.proposed).toHaveLength(3)
  })
})

describe('D-17 — reconciliation carries video and authored-text entries through', () => {
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

  it('a song group holding a video entry keeps that entry (original id/source) after a reconciliation triggered by an added lyric section, positioned after the lyric run and before the trailing copyright', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup([
      ...twoSectionStoredSlides.slice(0, 3),
      { id: 'e-video', order: 3, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      { ...twoSectionStoredSlides[3]!, order: 4 },
    ])
    const lyrics = threeSectionLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus', 'bridge']]]),
    })

    const result = reconcileSongGroup(group, slot, inputs)

    const videoEntry = result.slides.find((e) => e.id === 'e-video')
    expect(videoEntry).toBeDefined()
    expect(videoEntry?.sourceRef).toEqual({ kind: 'video', videoSrc: 'https://example.com/dropped.mp4' })

    const videoIndex = result.slides.findIndex((e) => e.id === 'e-video')
    const bridgeIndex = result.slides.findIndex(
      (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'bridge',
    )
    const trailingCopyrightIndex = result.slides.length - 1
    expect(videoIndex).toBeGreaterThan(bridgeIndex)
    expect(videoIndex).toBeLessThan(trailingCopyrightIndex)
    expect(result.slides[trailingCopyrightIndex]!.sourceRef.kind).toBe('copyright')
  })

  it('a user-authored text entry survives the same song reconciliation', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup([
      ...twoSectionStoredSlides.slice(0, 3),
      { id: 'e-authored', order: 3, sourceRef: { kind: 'text', title: 'My Slide', body: 'My words' } },
      { ...twoSectionStoredSlides[3]!, order: 4 },
    ])
    const lyrics = threeSectionLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus', 'bridge']]]),
    })

    const result = reconcileSongGroup(group, slot, inputs)

    const authoredEntry = result.slides.find((e) => e.id === 'e-authored')
    expect(authoredEntry).toBeDefined()
    expect(authoredEntry?.sourceRef).toEqual({ kind: 'text', title: 'My Slide', body: 'My words' })
  })

  it('a group with neither video nor authored text reconciles to exactly the same result as before this change', () => {
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
    expect(result.slides.map((e) => e.sourceRef.kind)).toEqual([
      'copyright',
      'lyric',
      'lyric',
      'lyric',
      'copyright',
    ])
  })

  it('a scripture group whose only user work is a video entry reports as customized', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...deriveGroupEntries(slot, inputs),
        { id: 'e-video', order: 99, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    })

    expect(hasCustomization(group)).toBe(true)
  })

  it('that same group with a diverged signature returns the confirm-required outcome with the stored slides untouched, and the loss summary counts the video entry', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...deriveGroupEntries(slot, inputs),
        { id: 'e-video', order: 99, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    })

    const widenedReading = makeScriptureReading({
      slides: [
        makeScriptureSlide({ id: 'ss-1', position: 0, verseRange: '16', text: 'For God so loved the world' }),
        makeScriptureSlide({ id: 'ss-2', position: 1, verseRange: '17', text: 'that he gave his only Son' }),
        makeScriptureSlide({ id: 'ss-3', position: 2, verseRange: '18', text: 'that whoever believes in him' }),
      ],
    })
    const widenedInputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', widenedReading]]) })

    const result = reconcileScriptureGroup(group, slot, widenedInputs)

    expect(result.needsConfirm).toBe(true)
    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
    expect(result.loss?.customizedEntries).toBe(1)
  })
})

describe('reconcileGroup dispatcher', () => {
  it('dispatches SONG to the additive path (never confirm-gated)', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const lyrics = makeSongLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
      performanceOrderById: new Map([['song-1', ['verse-1', 'chorus']]]),
    })
    const group = makeGroup({ id: 'slot-1', slotId: 'slot-1', slides: deriveGroupEntries(slot, inputs) })

    const result = reconcileGroup(group, slot, inputs)

    expect(result.needsConfirm).toBe(false)
  })

  it('dispatches SCRIPTURE and IMPORTED to the confirm-gated path', () => {
    const scripture = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const scriptureInputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const scriptureGroup = makeGroup({
      sourceSignature: sourceSignature(scripture, scriptureInputs),
      slides: deriveGroupEntries(scripture, scriptureInputs),
    })
    const scriptureResult = reconcileGroup(scriptureGroup, scripture, scriptureInputs)
    expect(scriptureResult.needsConfirm).toBe(false)
    expect(scriptureResult.changed).toBe(false)

    const deck = makeImportedDeck()
    const imported = importedSlot({ importId: 'deck-1' })
    const importedInputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const importedGroup = makeGroup({
      sourceSignature: sourceSignature(imported, importedInputs),
      slides: deriveGroupEntries(imported, importedInputs),
    })
    const importedResult = reconcileGroup(importedGroup, imported, importedInputs)
    expect(importedResult.needsConfirm).toBe(false)
    expect(importedResult.changed).toBe(false)
  })

  it('a text-kind slot returns the stored slides with both flags false', () => {
    const slot: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 }
    const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }] })

    const result = reconcileGroup(group, slot, makeInputs())

    expect(result.needsConfirm).toBe(false)
    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('CR-01: a SONG slot with a customized group surfaces needsConfirm through reconcileGroup when songId changes to a different song', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
    const group = makeGroup({
      id: 'slot-1',
      slotId: 'slot-1',
      slides: [
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        {
          id: 'e-verse-1',
          order: 1,
          sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
          label: 'Custom Verse Label',
        },
        { id: 'e-copyright-trail', order: 2, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ],
    })
    const lyrics = makeSongLyrics({
      songId: 'song-b',
      sections: [{ id: 'verse-1-b', label: 'Verse 1', lines: ['Song B line'] }],
    })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-b', lyrics]]),
      performanceOrderById: new Map([['song-b', ['verse-1-b']]]),
    })

    const result = reconcileGroup(group, slot, inputs)

    expect(result.needsConfirm).toBe(true)
    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
    expect(result.proposed).toBeDefined()
  })
})
