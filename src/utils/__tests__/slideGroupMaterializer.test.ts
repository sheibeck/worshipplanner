import { describe, it, expect } from 'vitest'
import {
  deriveGroupEntries,
  sourceSignature,
  buildInitialGroup,
  rebuildSongGroup,
  rebuildScriptureGroup,
  rebuildImportedGroup,
  rebuildGroup,
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
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
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
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
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
  it('derives exactly ONE reference-only entry, with no innerSlideId, regardless of how many slides the reading itself carries (R047)', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(1)
    expect(entries[0]!.sourceRef).toEqual({ kind: 'scripture', scriptureReadingId: 'reading-1' })
    expect(entries[0]!.sourceRef).not.toHaveProperty('innerSlideId')
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
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
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

describe('rebuildSongGroup', () => {
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
      performanceOrder: ['verse-1', 'chorus', 'bridge'],
    })

  it('a song that gains a Bridge yields stored entries untouched plus a new lyric entry for it', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const lyrics = threeSectionLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result = rebuildSongGroup(group, slot, inputs)

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
    })

    const result = rebuildSongGroup(group, slot, inputs)

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

    const result = rebuildSongGroup(group, slot, inputs)

    const chorusEntry = result.slides.find((e) => e.id === 'e-chorus')
    expect(chorusEntry).toBeDefined()
    expect(chorusEntry?.label).toBe('Keep Me')
    expect(chorusEntry?.notes).toBe('Old note')
  })

  it('a song plan item with no song assigned returns the unchanged result', () => {
    const slot = songSlot({ id: 'slot-1', songId: null })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const inputs = makeInputs()

    const result = rebuildSongGroup(group, slot, inputs)

    expect(result).toEqual({ changed: false, slides: group.slides })
  })

  it('reconciling an already-in-sync group returns changed: false and an entry list deep-equal to the stored one', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result = rebuildSongGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('never duplicates the two copyright entries — exactly one leading, one trailing', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeStoredSongGroup(twoSectionStoredSlides)
    const lyrics = threeSectionLyrics()
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })

    const result = rebuildSongGroup(group, slot, inputs)

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
    })

    const result = rebuildSongGroup(group, slot, inputs)

    expect(result.slides.map((e) => e.order)).toEqual(result.slides.map((_, i) => i))
  })

  // --- CR-01 / R046 regression: a songId change is a source-IDENTITY swap,
  // not a section-level edit — it must never run through the additive merge
  // above, which would blend the old song's copyright/lyric entries with the
  // new song's. Phase 30 (R046) makes this branch UNCONDITIONAL — no confirm
  // gate survives — so this describe now proves the swap writes immediately
  // AND that a hand-added video/authored-text entry survives it (T-30-02-01).
  describe('song identity swap (CR-01, R046 — unconditional)', () => {
    const songBLyrics = () =>
      makeSongLyrics({
        songId: 'song-b',
        sections: [{ id: 'verse-1-b', label: 'Verse 1', lines: ['Song B line'] }],
        performanceOrder: ['verse-1-b'],
      })

    it('a group with no non-derivable entries is replaced wholesale when slot.songId changes to a different song, immediately, with no confirm state anywhere on the result', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
      const group = makeStoredSongGroup(twoSectionStoredSlides) // all entries reference song-1
      const lyrics = songBLyrics()
      const inputs = makeInputs({
        songLyricsById: new Map([['song-b', lyrics]]),
      })

      const result = rebuildSongGroup(group, slot, inputs)

      expect(result.changed).toBe(true)
      expect(Object.keys(result).sort()).toEqual(['changed', 'slides'])
      // Every entry references ONLY the new song — no blended song-1 leftovers.
      const songRefEntries = result.slides.filter(
        (e): e is typeof e & { sourceRef: { songId: string } } =>
          e.sourceRef.kind === 'lyric' || e.sourceRef.kind === 'copyright',
      )
      expect(songRefEntries.every((e) => e.sourceRef.songId === 'song-b')).toBe(true)
      expect(result.slides.some((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'verse-1-b')).toBe(
        true,
      )
    })

    it('a group with a labeled/audio lyric entry (source-derived, not non-derivable) is STILL replaced wholesale — R046 has no confirm step left to preserve it', () => {
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
      })

      const result = rebuildSongGroup(group, slot, inputs)

      expect(result.changed).toBe(true)
      const staleSongOneEntries = result.slides.filter(
        (e) => (e.sourceRef.kind === 'lyric' || e.sourceRef.kind === 'copyright') && e.sourceRef.songId === 'song-1',
      )
      expect(staleSongOneEntries).toHaveLength(0)
    })

    it('a video entry and an authored-text entry both survive a song-identity swap, spliced ahead of the trailing copyright', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
      const group = makeStoredSongGroup([
        ...twoSectionStoredSlides.slice(0, 3),
        { id: 'e-video', order: 3, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
        { id: 'e-authored', order: 4, sourceRef: { kind: 'text', title: 'My Slide', body: 'My words' } },
        { ...twoSectionStoredSlides[3]!, order: 5 },
      ])
      const lyrics = songBLyrics()
      const inputs = makeInputs({
        songLyricsById: new Map([['song-b', lyrics]]),
      })

      const result = rebuildSongGroup(group, slot, inputs)

      expect(result.changed).toBe(true)
      const videoEntry = result.slides.find((e) => e.id === 'e-video')
      const authoredEntry = result.slides.find((e) => e.id === 'e-authored')
      expect(videoEntry?.sourceRef).toEqual({ kind: 'video', videoSrc: 'https://example.com/dropped.mp4' })
      expect(authoredEntry?.sourceRef).toEqual({ kind: 'text', title: 'My Slide', body: 'My words' })
      const trailingCopyrightIndex = result.slides.length - 1
      expect(result.slides[trailingCopyrightIndex]!.sourceRef.kind).toBe('copyright')
      expect(result.slides.findIndex((e) => e.id === 'e-video')).toBeLessThan(trailingCopyrightIndex)
      expect(result.slides.findIndex((e) => e.id === 'e-authored')).toBeLessThan(trailingCopyrightIndex)
    })

    it('T-30-02-04: a song-identity swap whose new song lyrics have not loaded yet returns the group untouched with changed: false, never blanking it', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
      const group = makeStoredSongGroup(twoSectionStoredSlides) // song-1 entries; song-b not in inputs
      const inputs = makeInputs() // song-b's lyrics not loaded

      const result = rebuildSongGroup(group, slot, inputs)

      expect(result).toEqual({ changed: false, slides: group.slides })
    })
  })

  // Phase 26-09 Task 1: a copied song-section slide (the panel's Duplicate
  // action, Task 2) stores TWO entries referencing the SAME sectionId. This
  // additive merge must keep BOTH — the pre-26-09 behavior collapsed a
  // repeated sectionId to its last-seen entry, which would silently swallow
  // the copy on the very next reconciliation, with no confirm gate, because
  // this path never confirm-gates.
  describe('duplicate-tolerant merge (Phase 26-09 Task 1)', () => {
    function storedSlidesWithDuplicateVerse(): SlideGroup['slides'] {
      return [
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        {
          id: 'e-verse-1-copy',
          order: 2,
          sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
          label: 'Copy label',
          notes: 'Copy note',
          audioUrl: 'https://example.com/copy.mp3',
          audioLoop: true,
        },
        { id: 'e-chorus', order: 3, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-copyright-trail', order: 4, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ]
    }

    it('keeps BOTH stored entries for the same song section, in stored order, each with its own id', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup(storedSlidesWithDuplicateVerse())
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
      const inputs = makeInputs({
        songLyricsById: new Map([['song-1', lyrics]]),
      })

      const result = rebuildSongGroup(group, slot, inputs)

      const verseEntries = result.slides.filter(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'verse-1',
      )
      expect(verseEntries).toHaveLength(2)
      expect(verseEntries.map((e) => e.id)).toEqual(['e-verse-1', 'e-verse-1-copy'])
      expect(new Set(verseEntries.map((e) => e.id)).size).toBe(2)
    })

    it('the surviving copies keep their own label, notes, audio and loop values', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup(storedSlidesWithDuplicateVerse())
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
      const inputs = makeInputs({
        songLyricsById: new Map([['song-1', lyrics]]),
      })

      const result = rebuildSongGroup(group, slot, inputs)

      const copyEntry = result.slides.find((e) => e.id === 'e-verse-1-copy')
      expect(copyEntry?.label).toBe('Copy label')
      expect(copyEntry?.notes).toBe('Copy note')
      expect(copyEntry?.audioUrl).toBe('https://example.com/copy.mp3')
      expect(copyEntry?.audioLoop).toBe(true)

      const originalEntry = result.slides.find((e) => e.id === 'e-verse-1')
      expect(originalEntry?.label).toBeUndefined()
    })

    it('one entry per section still behaves exactly as before this change', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup(twoSectionStoredSlides)
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
      const inputs = makeInputs({
        songLyricsById: new Map([['song-1', lyrics]]),
      })

      const result = rebuildSongGroup(group, slot, inputs)

      expect(result.changed).toBe(false)
      expect(result.slides).toEqual(group.slides)
    })

    it('order values stay contiguous from 0 across a duplicated section, an inserted section, and a retained-unresolvable one', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-verse-1-copy', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        {
          id: 'e-outro',
          order: 3,
          sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'outro' },
          label: 'Keep me',
        },
        { id: 'e-copyright-trail', order: 4, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      // 'outro' no longer resolves; 'bridge' is newly present.
      const lyrics = makeSongLyrics({
        sections: [
          { id: 'verse-1', label: 'Verse 1', lines: ['Line A'] },
          { id: 'bridge', label: 'Bridge', lines: ['Line D'] },
        ],
        performanceOrder: ['verse-1', 'bridge'],
      })
      const inputs = makeInputs({
        songLyricsById: new Map([['song-1', lyrics]]),
      })

      const result = rebuildSongGroup(group, slot, inputs)

      expect(result.slides.map((e) => e.order)).toEqual(result.slides.map((_, i) => i))
      const verseEntries = result.slides.filter(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'verse-1',
      )
      expect(verseEntries).toHaveLength(2)
      const bridgeEntry = result.slides.find(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'bridge',
      )
      expect(bridgeEntry).toBeDefined()
      const outroEntry = result.slides.find((e) => e.id === 'e-outro')
      expect(outroEntry).toBeDefined()
      expect(outroEntry?.label).toBe('Keep me')
      const copyrightEntries = result.slides.filter((e) => e.sourceRef.kind === 'copyright')
      expect(copyrightEntries).toHaveLength(2)
    })
  })

  // Plan 28-03: D-02 makes a repeated section a first-class part of the
  // order, so a chorus referenced N times shares one sectionId across N
  // stored entries. The pre-fix merge loop re-emitted the WHOLE stored array
  // on every occurrence of that sectionId in freshOrder, multiplying entries
  // on every reconciliation pass (4 -> 8 -> 16). This block proves the
  // occurrence-aware replacement: stored entries are consumed positionally
  // (occurrence i takes stored entry i), any stored surplus is emitted next
  // to the LAST occurrence (preserving Phase 26-09's duplicate-survival
  // guarantee), and the whole thing is idempotent under repeated passes.
  describe('occurrence-aware repeat merge (D-02, Plan 28-03)', () => {
    function repeatLyrics(overrides: Partial<SongLyrics> = {}): SongLyrics {
      return makeSongLyrics({
        sections: [
          { id: 'verse-1', label: 'Verse 1', lines: ['Line A'] },
          { id: 'chorus', label: 'Chorus', lines: ['Line C'] },
          { id: 'verse-2', label: 'Verse 2', lines: ['Line B'] },
        ],
        performanceOrder: ['verse-1', 'chorus', 'verse-2', 'chorus'],
        ...overrides,
      })
    }

    it('a section referenced twice with one stored entry per occurrence merges to exactly two entries, preserving each stored id, and reports no change', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-chorus-1', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-verse-2', order: 3, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-2' } },
        { id: 'e-chorus-2', order: 4, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-copyright-trail', order: 5, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', repeatLyrics()]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      expect(result.changed).toBe(false)
      const chorusEntries = result.slides.filter(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus',
      )
      expect(chorusEntries.map((e) => e.id)).toEqual(['e-chorus-1', 'e-chorus-2'])
      expect(result.slides).toEqual(group.slides)
    })

    it('is idempotent: feeding the merge output back in as the stored slides reconciles to a value-equal result, with the repeated section entry count still equal to its occurrence count', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-chorus-1', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-verse-2', order: 3, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-2' } },
        { id: 'e-chorus-2', order: 4, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-copyright-trail', order: 5, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', repeatLyrics()]]) })

      const firstPass = rebuildSongGroup(group, slot, inputs)
      const regroup = makeStoredSongGroup(firstPass.slides)
      const secondPass = rebuildSongGroup(regroup, slot, inputs)

      expect(secondPass.slides).toEqual(firstPass.slides)
      expect(secondPass.changed).toBe(false)
      const chorusEntries = secondPass.slides.filter(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus',
      )
      expect(chorusEntries).toHaveLength(2)
    })

    it('26-09 regression: one occurrence with TWO stored entries keeps both, adjacent, at the section position', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-chorus-1', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-chorus-2', order: 3, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-copyright-trail', order: 4, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      const chorusEntries = result.slides.filter(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus',
      )
      expect(chorusEntries.map((e) => e.id)).toEqual(['e-chorus-1', 'e-chorus-2'])
      expect(result.changed).toBe(false)

      // A second pass must not grow this — this is the exact defect this
      // plan closes: pre-fix, this would have gone 2 -> 4 -> 8.
      const secondPass = rebuildSongGroup(makeStoredSongGroup(result.slides), slot, inputs)
      const secondChorusEntries = secondPass.slides.filter(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus',
      )
      expect(secondChorusEntries).toHaveLength(2)
    })

    it('N=2 occurrences with M=3 stored entries: two consumed positionally, the surplus emitted next to the LAST occurrence, and a second pass is value-equal', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const lyrics = makeSongLyrics({ performanceOrder: ['chorus', 'verse-1', 'chorus'] })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-chorus-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-verse-1', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-chorus-2', order: 3, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-chorus-3', order: 4, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-copyright-trail', order: 5, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      const chorusEntries = result.slides.filter(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus',
      )
      expect(chorusEntries).toHaveLength(3)
      expect(chorusEntries.map((e) => e.id)).toEqual(['e-chorus-1', 'e-chorus-2', 'e-chorus-3'])
      // The surplus (e-chorus-3) sits immediately after the last occurrence
      // (e-chorus-2), which is itself immediately after verse-1.
      const ids = result.slides.map((e) => e.id)
      expect(ids.indexOf('e-chorus-3')).toBe(ids.indexOf('e-chorus-2') + 1)

      const secondPass = rebuildSongGroup(makeStoredSongGroup(result.slides), slot, inputs)
      expect(secondPass.slides).toEqual(result.slides)
    })

    it('N=2 occurrences with M=1 stored entry: the first occurrence keeps the stored entry, the second occurrence mints a fresh entry with a distinct id', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const lyrics = makeSongLyrics({ performanceOrder: ['chorus', 'verse-1', 'chorus'] })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-chorus-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-verse-1', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-copyright-trail', order: 3, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      const chorusEntries = result.slides.filter(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus',
      )
      expect(chorusEntries).toHaveLength(2)
      expect(chorusEntries[0]!.id).toBe('e-chorus-1')
      expect(chorusEntries[1]!.id).not.toBe('e-chorus-1')
      expect(new Set(chorusEntries.map((e) => e.id)).size).toBe(2)
    })

    it('occurrence-level customisation stays on the occurrence it was set on: audio on the second stored chorus entry appears only on the second chorus entry in the merge', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus', 'chorus'] })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-chorus-1', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        {
          id: 'e-chorus-2',
          order: 3,
          sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' },
          audioUrl: 'https://example.com/second.mp3',
        },
        { id: 'e-copyright-trail', order: 4, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      const chorusEntries = result.slides.filter(
        (e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus',
      )
      expect(chorusEntries).toHaveLength(2)
      expect(chorusEntries[0]!.audioUrl).toBeUndefined()
      expect(chorusEntries[1]!.audioUrl).toBe('https://example.com/second.mp3')
    })

    it('a stored entry whose section id is absent from the fresh order is still retained, after the resolvable run and before the trailing copyright, alongside a repeated section', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-chorus-1', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        { id: 'e-chorus-2', order: 3, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' } },
        {
          id: 'e-outro',
          order: 4,
          sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'outro' },
          label: 'Keep me',
        },
        { id: 'e-copyright-trail', order: 5, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      // 'outro' no longer resolves; 'chorus' is referenced twice.
      const lyrics = makeSongLyrics({
        sections: [
          { id: 'verse-1', label: 'Verse 1', lines: ['Line A'] },
          { id: 'chorus', label: 'Chorus', lines: ['Line C'] },
        ],
        performanceOrder: ['verse-1', 'chorus', 'chorus'],
      })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      const outroIndex = result.slides.findIndex((e) => e.id === 'e-outro')
      const trailingCopyrightIndex = result.slides.length - 1
      const lastChorusIndex = result.slides.map((e) => e.id).lastIndexOf('e-chorus-2')
      expect(outroIndex).toBeGreaterThan(lastChorusIndex)
      expect(outroIndex).toBeLessThan(trailingCopyrightIndex)
      expect(result.slides[outroIndex]!.label).toBe('Keep me')
    })
  })
})

describe('rebuildScriptureGroup', () => {
  function makeInSyncScriptureGroup(slot: ScriptureSlot, inputs: AssemblyInputs): SlideGroup {
    return makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: deriveGroupEntries(slot, inputs),
    })
  }

  it('an already-in-sync group rebuilds to changed: false with stored entries untouched', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeInSyncScriptureGroup(slot, inputs)

    const result = rebuildScriptureGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('editing a passage IN PLACE (ScriptureSlideEditor.vue updates the SAME reading document — scriptureReadingId never changes) reports changed: false, with no confirm state anywhere on the result — the new reference is resolved LIVE at render time (Task 1), not written here', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeInSyncScriptureGroup(slot, inputs)

    // Same scriptureReadingId — only the document's own content differs.
    const editedReading = makeScriptureReading({ displayReference: 'John 3:16-18 (expanded)' })
    const editedInputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', editedReading]]) })

    const result = rebuildScriptureGroup(group, slot, editedInputs)

    expect(Object.keys(result).sort()).toEqual(['changed', 'slides'])
    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('T-30-02-03: a passage change preserves the stored entry\'s id, label, notes and attached audio — only the resolved reference changes', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeInSyncScriptureGroup(slot, inputs)
    group.slides[0] = {
      ...group.slides[0]!,
      label: 'Call to worship',
      notes: 'Read slowly',
      audioUrl: 'https://example.com/slide-audio.mp3',
      audioLoop: true,
    }
    const storedId = group.slides[0]!.id

    const widenedReading = makeScriptureReading({ displayReference: 'John 3:16-18 (expanded)' })
    const widenedInputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', widenedReading]]) })

    const result = rebuildScriptureGroup(group, slot, widenedInputs)

    expect(result.slides).toHaveLength(1)
    const rebuilt = result.slides[0]!
    expect(rebuilt.id).toBe(storedId)
    expect(rebuilt.label).toBe('Call to worship')
    expect(rebuilt.notes).toBe('Read slowly')
    expect(rebuilt.audioUrl).toBe('https://example.com/slide-audio.mp3')
    expect(rebuilt.audioLoop).toBe(true)
    expect(rebuilt.sourceRef).toEqual({ kind: 'scripture', scriptureReadingId: 'reading-1' })
  })

  it('T-30-02-03: swapping to a DIFFERENT reading still yields exactly one entry, carrying the previous entry\'s id and audio, now pointing at the new reading', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeInSyncScriptureGroup(slot, inputs)
    group.slides[0] = { ...group.slides[0]!, audioUrl: 'https://example.com/slide-audio.mp3' }
    const storedId = group.slides[0]!.id

    const newReading = makeScriptureReading({ id: 'reading-2', displayReference: 'Psalm 23:1-6' })
    const newSlot = scriptureSlot({ scriptureReadingId: 'reading-2' })
    const newInputs = makeInputs({ scriptureReadingsById: new Map([['reading-2', newReading]]) })

    const result = rebuildScriptureGroup(group, newSlot, newInputs)

    expect(result.slides).toHaveLength(1)
    expect(result.slides[0]!.id).toBe(storedId)
    expect(result.slides[0]!.audioUrl).toBe('https://example.com/slide-audio.mp3')
    expect(result.slides[0]!.sourceRef).toEqual({ kind: 'scripture', scriptureReadingId: 'reading-2' })
  })

  it('T-30-02-04: a reading absent from the inputs map (not yet loaded) leaves the group untouched, changed: false, never emptying it', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeInSyncScriptureGroup(slot, inputs)

    const result = rebuildScriptureGroup(group, slot, makeInputs())

    expect(result).toEqual({ changed: false, slides: group.slides })
  })
})

describe('rebuildImportedGroup', () => {
  it('an already-in-sync group rebuilds to changed: false', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const group = makeGroup({ sourceSignature: sourceSignature(slot, inputs), slides: deriveGroupEntries(slot, inputs) })

    const result = rebuildImportedGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
  })

  it('a re-import with an added slide rebuilds unconditionally, immediately, with no confirm state on the result — even when the group carries a labeled entry', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const group = makeGroup({ sourceSignature: sourceSignature(slot, inputs), slides: deriveGroupEntries(slot, inputs) })
    const labeledGroup: SlideGroup = {
      ...group,
      slides: group.slides.map((e, i) => (i === 0 ? { ...e, label: 'Custom' } : e)),
    }

    const widenedDeck = makeImportedDeck({
      slides: [
        { id: 'is-1', position: 0, contentKind: 'text', title: 'Welcome', body: 'Welcome to church' } as TextSlide,
        { id: 'is-2', position: 1, contentKind: 'image', imageUrl: 'https://example.com/a.png', altText: 'slide 2' } as ImageSlide,
        { id: 'is-3', position: 2, contentKind: 'text', title: 'Announcement', body: 'New announcement' } as TextSlide,
      ],
    })
    const widenedInputs = makeInputs({ importedDecksById: new Map([['deck-1', widenedDeck]]) })

    const result = rebuildImportedGroup(labeledGroup, slot, widenedInputs)

    expect(Object.keys(result).sort()).toEqual(['changed', 'slides'])
    expect(result.changed).toBe(true)
    expect(result.slides).toHaveLength(3)
    // is-1 and is-2 keys still resolve — is-1's stored label carries through
    // via carryStoredDerivedEntries; is-3 is a fresh key, minted new.
    const carriedIs1 = result.slides.find(
      (e) => e.sourceRef.kind === 'imported' && e.sourceRef.innerSlideId === 'is-1',
    )
    expect(carriedIs1?.label).toBe('Custom')
  })

  it('T-30-02-04: a deck absent from the inputs map (not yet loaded) leaves the group untouched, changed: false', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const group = makeGroup({ sourceSignature: sourceSignature(slot, inputs), slides: deriveGroupEntries(slot, inputs) })

    const result = rebuildImportedGroup(group, slot, makeInputs())

    expect(result).toEqual({ changed: false, slides: group.slides })
  })

  it('an obsolete innerSlideId (a re-import with fewer slides) is dropped, not carried as surplus', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const group = makeGroup({ sourceSignature: sourceSignature(slot, inputs), slides: deriveGroupEntries(slot, inputs) })

    const shrunkDeck = makeImportedDeck({
      slides: [{ id: 'is-1', position: 0, contentKind: 'text', title: 'Welcome', body: 'Welcome to church' } as TextSlide],
    })
    const shrunkInputs = makeInputs({ importedDecksById: new Map([['deck-1', shrunkDeck]]) })

    const result = rebuildImportedGroup(group, slot, shrunkInputs)

    expect(result.slides).toHaveLength(1)
    expect(result.slides.some((e) => e.sourceRef.kind === 'imported' && e.sourceRef.innerSlideId === 'is-2')).toBe(
      false,
    )
  })
})

describe('D-17 / T-30-02-01 — hand-added video and authored-text entries survive every rebuild path', () => {
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
      performanceOrder: ['verse-1', 'chorus', 'bridge'],
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
    })

    const result = rebuildSongGroup(group, slot, inputs)

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
    })

    const result = rebuildSongGroup(group, slot, inputs)

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
    })

    const result = rebuildSongGroup(group, slot, inputs)

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

  it('a dropped video on a SCRIPTURE group survives a reading swap, appended after the (single, carried) scripture entry', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...deriveGroupEntries(slot, inputs),
        { id: 'e-video', order: 1, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    })

    const newReading = makeScriptureReading({ id: 'reading-2', displayReference: 'Psalm 23:1-6' })
    const newSlot = scriptureSlot({ scriptureReadingId: 'reading-2' })
    const newInputs = makeInputs({ scriptureReadingsById: new Map([['reading-2', newReading]]) })

    const result = rebuildScriptureGroup(group, newSlot, newInputs)

    expect(result.changed).toBe(true)
    const videoEntry = result.slides.find((e) => e.id === 'e-video')
    expect(videoEntry?.sourceRef).toEqual({ kind: 'video', videoSrc: 'https://example.com/dropped.mp4' })
    const scriptureEntry = result.slides.find((e) => e.sourceRef.kind === 'scripture')
    expect(scriptureEntry?.sourceRef).toEqual({ kind: 'scripture', scriptureReadingId: 'reading-2' })
    expect(result.slides).toHaveLength(2)
  })

  it('an authored-text entry on an IMPORTED group survives a re-import, appended after the carried/fresh deck entries', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...deriveGroupEntries(slot, inputs),
        { id: 'e-authored', order: 99, sourceRef: { kind: 'text', title: 'My Slide', body: 'My words' } },
      ],
    })

    const newDeck = makeImportedDeck({
      slides: [
        { id: 'new-1', position: 0, contentKind: 'text', title: 'New', body: 'New body' } as TextSlide,
      ],
    })
    const newInputs = makeInputs({ importedDecksById: new Map([['deck-1', newDeck]]) })

    const result = rebuildImportedGroup(group, slot, newInputs)

    expect(result.changed).toBe(true)
    const authoredEntry = result.slides.find((e) => e.id === 'e-authored')
    expect(authoredEntry?.sourceRef).toEqual({ kind: 'text', title: 'My Slide', body: 'My words' })
    expect(result.slides[result.slides.length - 1]!.id).toBe('e-authored')
  })
})

describe('rebuildGroup dispatcher', () => {
  it('dispatches SONG to the additive rebuild', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const lyrics = makeSongLyrics({ performanceOrder: ['verse-1', 'chorus'] })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-1', lyrics]]),
    })
    const group = makeGroup({ id: 'slot-1', slotId: 'slot-1', slides: deriveGroupEntries(slot, inputs) })

    const result = rebuildGroup(group, slot, inputs)

    expect(Object.keys(result).sort()).toEqual(['changed', 'slides'])
    expect(result.changed).toBe(false)
  })

  it('dispatches SCRIPTURE and IMPORTED to the generalized carry rebuild', () => {
    const scripture = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const scriptureInputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const scriptureGroup = makeGroup({
      sourceSignature: sourceSignature(scripture, scriptureInputs),
      slides: deriveGroupEntries(scripture, scriptureInputs),
    })
    const scriptureResult = rebuildGroup(scriptureGroup, scripture, scriptureInputs)
    expect(scriptureResult.changed).toBe(false)

    const deck = makeImportedDeck()
    const imported = importedSlot({ importId: 'deck-1' })
    const importedInputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const importedGroup = makeGroup({
      sourceSignature: sourceSignature(imported, importedInputs),
      slides: deriveGroupEntries(imported, importedInputs),
    })
    const importedResult = rebuildGroup(importedGroup, imported, importedInputs)
    expect(importedResult.changed).toBe(false)
  })

  it('a text-kind slot returns the stored slides with changed: false', () => {
    const slot: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 }
    const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }] })

    const result = rebuildGroup(group, slot, makeInputs())

    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('CR-01/R046: a SONG slot whose songId changes to a different song rebuilds wholesale through rebuildGroup, unconditionally', () => {
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
      performanceOrder: ['verse-1-b'],
    })
    const inputs = makeInputs({
      songLyricsById: new Map([['song-b', lyrics]]),
    })

    const result = rebuildGroup(group, slot, inputs)

    expect(result.changed).toBe(true)
    expect(result.slides.every((e) => e.sourceRef.kind !== 'lyric' || e.sourceRef.songId === 'song-b')).toBe(true)
  })
})

// Cross-cutting guarantees Task 2 must prove hold on EVERY rebuild path, not
// just SONG's (where they were already exercised pre-Phase-30): a dropped
// video surviving a same-reading-id passage edit (not just a reading swap),
// and idempotence — re-running a rebuild over its own output is byte-
// identical — for the scripture, imported, and song-swap paths specifically.
// The song ADDITIVE path's N=M/N<M/N>M idempotence is already asserted in
// 'occurrence-aware repeat merge (D-02, Plan 28-03)' above; this block does
// not repeat it.
describe('T-30-02 — cross-cutting survival and idempotence', () => {
  it('a dropped video on a SCRIPTURE group survives a same-reading-id passage edit (not just a reading swap)', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...deriveGroupEntries(slot, inputs),
        { id: 'e-video', order: 1, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    })

    const editedReading = makeScriptureReading({ displayReference: 'John 3:16-18 (edited)' })
    const editedInputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', editedReading]]) })

    const result = rebuildScriptureGroup(group, slot, editedInputs)

    expect(result.slides.some((e) => e.id === 'e-video')).toBe(true)
  })

  it('idempotence: re-running rebuildScriptureGroup over its own output after a reading swap is byte-identical on the second pass', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'reading-1' })
    const reading = makeScriptureReading()
    const inputs = makeInputs({ scriptureReadingsById: new Map([['reading-1', reading]]) })
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        { ...deriveGroupEntries(slot, inputs)[0]!, audioUrl: 'https://example.com/audio.mp3' },
        { id: 'e-video', order: 1, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    })

    const newReading = makeScriptureReading({ id: 'reading-2', displayReference: 'Psalm 23:1-6' })
    const newSlot = scriptureSlot({ scriptureReadingId: 'reading-2' })
    const newInputs = makeInputs({ scriptureReadingsById: new Map([['reading-2', newReading]]) })

    const firstPass = rebuildScriptureGroup(group, newSlot, newInputs)
    const regrouped = makeGroup({ ...group, slides: firstPass.slides })
    const secondPass = rebuildScriptureGroup(regrouped, newSlot, newInputs)

    expect(secondPass.changed).toBe(false)
    expect(secondPass.slides).toEqual(firstPass.slides)
  })

  it('idempotence: re-running rebuildImportedGroup over its own output after a re-import is byte-identical on the second pass', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...deriveGroupEntries(slot, inputs),
        { id: 'e-authored', order: 99, sourceRef: { kind: 'text', title: 'My Slide', body: 'My words' } },
      ],
    })

    const widenedDeck = makeImportedDeck({
      slides: [
        ...deck.slides,
        { id: 'is-3', position: 2, contentKind: 'text', title: 'Announcement', body: 'New announcement' } as TextSlide,
      ],
    })
    const widenedInputs = makeInputs({ importedDecksById: new Map([['deck-1', widenedDeck]]) })

    const firstPass = rebuildImportedGroup(group, slot, widenedInputs)
    const regrouped = makeGroup({ ...group, slides: firstPass.slides })
    const secondPass = rebuildImportedGroup(regrouped, slot, widenedInputs)

    expect(secondPass.changed).toBe(false)
    expect(secondPass.slides).toEqual(firstPass.slides)
  })

  it('idempotence: re-running rebuildSongGroup over its own output after a song-identity swap (with a surviving video entry) is byte-identical on the second pass', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
    const group = makeGroup({
      id: 'slot-1',
      slotId: 'slot-1',
      slides: [
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-video', order: 2, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
        { id: 'e-copyright-trail', order: 3, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ],
    })
    const lyrics = makeSongLyrics({
      songId: 'song-b',
      sections: [{ id: 'verse-1-b', label: 'Verse 1', lines: ['Song B line'] }],
      performanceOrder: ['verse-1-b'],
    })
    const inputs = makeInputs({ songLyricsById: new Map([['song-b', lyrics]]) })

    const firstPass = rebuildSongGroup(group, slot, inputs)
    const regrouped = makeGroup({ ...group, slides: firstPass.slides })
    const secondPass = rebuildSongGroup(regrouped, slot, inputs)

    expect(secondPass.changed).toBe(false)
    expect(secondPass.slides).toEqual(firstPass.slides)
    expect(secondPass.slides.some((e) => e.id === 'e-video')).toBe(true)
  })
})

// Plan 28-03 Task 2: `deriveGroupEntries` and `sourceSignature` already walk
// the resolved order element-by-element, so they are expected to already be
// correct for a section referenced more than once — this block locks that in
// with a test, and proves the materialise-then-reconcile round trip stays
// stable, and that the live-reference guarantee (D002/D007 — a slide entry
// stores a reference, never text) holds across every occurrence of a
// repeated section.
describe('repeated section — derivation and round-trip parity (Plan 28-03 Task 2)', () => {
  function repeatedThreeTimesLyrics(overrides: Partial<SongLyrics> = {}): SongLyrics {
    return makeSongLyrics({
      sections: [
        { id: 'verse-1', label: 'Verse 1', lines: ['Line A'] },
        { id: 'chorus', label: 'Chorus', lines: ['Line C'] },
      ],
      performanceOrder: ['chorus', 'verse-1', 'chorus', 'verse-1', 'chorus'],
      ...overrides,
    })
  }

  it('deriveGroupEntries emits one lyric entry per occurrence, each with a distinct id, plus leading and trailing copyright', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const lyrics = repeatedThreeTimesLyrics()
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(7) // copyright + 5 order entries + copyright
    expect(entries.map((e) => e.sourceRef.kind)).toEqual([
      'copyright',
      'lyric',
      'lyric',
      'lyric',
      'lyric',
      'lyric',
      'copyright',
    ])
    const chorusEntries = entries.filter((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus')
    expect(chorusEntries).toHaveLength(3)
    expect(new Set(chorusEntries.map((e) => e.id)).size).toBe(3)
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length)
  })

  it('sourceSignature reflects the repeated section once per occurrence, and changes when the shared section is edited', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const lyrics = repeatedThreeTimesLyrics()
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const signature = sourceSignature(slot, inputs)
    expect(signature).toBeDefined()
    // Signature is `${count}:${joined texts}` — count must equal the number
    // of ORDER entries (5), not the number of distinct sections (2).
    expect(signature!.startsWith('5:')).toBe(true)

    const editedLyrics = repeatedThreeTimesLyrics({
      sections: [
        { id: 'verse-1', label: 'Verse 1', lines: ['Line A'] },
        { id: 'chorus', label: 'Chorus', lines: ['Edited chorus line'] },
      ],
    })
    const editedInputs = makeInputs({ songLyricsById: new Map([['song-1', editedLyrics]]) })
    const editedSignature = sourceSignature(slot, editedInputs)

    expect(editedSignature).not.toBe(signature)
    expect(editedSignature!.startsWith('5:')).toBe(true)
  })

  it('buildInitialGroup immediately followed by reconcileGroup reports no change — a freshly materialised group is already reconciled', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const lyrics = repeatedThreeTimesLyrics()
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const initial = buildInitialGroup(slot, 'svc-1', inputs)
    const group: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }

    const result = rebuildGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('editing the shared section and reconciling again keeps the same entries with the same ids and reports no structural change, while every occurrence resolves the edited text', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const lyrics = repeatedThreeTimesLyrics()
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const initial = buildInitialGroup(slot, 'svc-1', inputs)
    const group: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }
    const originalChorusIds = group.slides
      .filter((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus')
      .map((e) => e.id)

    const editedLyrics = repeatedThreeTimesLyrics({
      sections: [
        { id: 'verse-1', label: 'Verse 1', lines: ['Line A'] },
        { id: 'chorus', label: 'Chorus', lines: ['Edited chorus line'] },
      ],
    })
    const editedInputs = makeInputs({ songLyricsById: new Map([['song-1', editedLyrics]]) })

    const result = rebuildGroup(group, slot, editedInputs)

    // No entry changed — text is never stored on the entry (D002/D007).
    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
    const resultChorusIds = result.slides
      .filter((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus')
      .map((e) => e.id)
    expect(resultChorusIds).toEqual(originalChorusIds)

    // The live-reference half of the guarantee: every chorus occurrence
    // resolves to the SAME edited section text — content lives on the
    // canonical section, never on the entry.
    const chorusEntries = result.slides.filter(
      (e): e is typeof e & { sourceRef: { sectionId: string } } =>
        e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'chorus',
    )
    expect(chorusEntries.length).toBeGreaterThan(0)
    for (const entry of chorusEntries) {
      const section = editedLyrics.sections.find((s) => s.id === entry.sourceRef.sectionId)
      expect(section?.lines).toEqual(['Edited chorus line'])
    }
  })
})
