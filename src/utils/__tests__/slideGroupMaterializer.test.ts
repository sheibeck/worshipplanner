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
import { congregationalSectionFromRef } from '@/utils/scripture'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import type { SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ImportedSlot } from '@/types/service'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { ImportedDeck } from '@/types/importedDeck'
import type { PptxRenderDoc } from '@/types/pptxRender'
import type { ScriptureSlide, TextSlide, ImageSlide, CongregationalSection } from '@/types/slide'
import type { SlideGroup } from '@/types/slideGroup'
import type { Timestamp } from 'firebase/firestore'
import { RENDERED_PAGE_IDENTITY_PREFIX } from '@/utils/importedRenderReconciler'

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

// R047: the slot's OWN reference is the scripture slide's source, so the
// default fixture carries one, formatting to "John 3:16-18". Pass `book: null`
// to model a scripture item whose reference is not filled in yet.
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

function makeSection(overrides: Partial<CongregationalSection> = {}): CongregationalSection {
  return {
    speaker: 'LEADER',
    text: 'The Lord is my shepherd;',
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

  // Phase 53 (R117/R118): the split is resolved LIVE at assembly, never stored.
  // The stored slide-group model must therefore be UNCHANGED — a split section
  // referenced twice in performanceOrder still yields exactly one lyric entry
  // per occurrence, with no split payload leaking onto the entry. This documents
  // that R118 (duplicate a split as one unit) needs zero group-model change.
  it('R118: a split section referenced twice yields exactly one lyric entry per occurrence, no split payload on the entry', () => {
    const slot = songSlot({ songId: 'song-1' })
    const lyrics = makeSongLyrics({
      sections: [{ id: 'verse-1', label: 'Verse 1', lines: ['L0', 'L1', 'L2', 'L3'], slideBreaks: [2] }],
      performanceOrder: ['verse-1', 'verse-1'],
    })
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const entries = deriveGroupEntries(slot, inputs)

    // copyright, lyric, lyric, copyright — one lyric entry per occurrence, NOT
    // pre-split into 2 slides per occurrence.
    expect(entries.map((e) => e.sourceRef.kind)).toEqual(['copyright', 'lyric', 'lyric', 'copyright'])
    const lyricEntries = entries.filter((e) => e.sourceRef.kind === 'lyric')
    expect(lyricEntries).toHaveLength(2)
    expect(new Set(entries.map((e) => e.id)).size).toBe(4)
    for (const entry of lyricEntries) {
      expect(entry.sourceRef.kind === 'lyric' && entry.sourceRef.sectionId).toBe('verse-1')
      const raw = entry as unknown as Record<string, unknown>
      expect(raw).not.toHaveProperty('slideBreaks')
      expect(raw).not.toHaveProperty('lines')
    }
  })
})

describe('deriveGroupEntries — SCRIPTURE', () => {
  it('derives exactly ONE reference-only entry carrying no payload at all (R047)', () => {
    const slot = scriptureSlot()

    const entries = deriveGroupEntries(slot, makeInputs())

    expect(entries).toHaveLength(1)
    expect(entries[0]!.sourceRef).toEqual({ kind: 'scripture' })
    expect(entries[0]!.sourceRef).not.toHaveProperty('innerSlideId')
    expect(entries[0]!.sourceRef).not.toHaveProperty('scriptureReadingId')
  })

  it('a SCRIPTURE slot with no reference filled in derives zero entries', () => {
    const slot = scriptureSlot({ book: null, chapter: null, verseStart: null, verseEnd: null })
    expect(deriveGroupEntries(slot, makeInputs())).toEqual([])
  })

  it('a whole-chapter reference (no verses) is a valid source and derives its one entry', () => {
    const slot = scriptureSlot({ verseStart: null, verseEnd: null })
    expect(deriveGroupEntries(slot, makeInputs())).toHaveLength(1)
  })

  // R047: the reading-document indirection is gone. A slot derives its slide
  // from its own reference whether or not any reading document exists — that
  // dependency is exactly what used to make a scripture item produce no slide.
  it('derives its entry with NO reading document loaded at all', () => {
    const slot = scriptureSlot({ scriptureReadingId: 'unloaded-reading' })
    expect(deriveGroupEntries(slot, makeInputs())).toHaveLength(1)
  })
})

// D1: a SCRIPTURE slot with congregational sections derives N entries — one
// per section, carrying that section's own content — the same
// one-entry-per-fragment shape IMPORTED already uses.
describe('deriveGroupEntries — SCRIPTURE congregational (D1)', () => {
  it('a slot with three sections derives three entries in stored order, each carrying that section\'s own speaker and text', () => {
    const sections = [
      makeSection({ speaker: 'LEADER', text: 'One' }),
      makeSection({ speaker: 'CONGREGATION', text: 'Two' }),
      makeSection({ speaker: 'LEADER', text: 'Three' }),
    ]
    const slot = scriptureSlot({ congregationalSections: sections })

    const entries = deriveGroupEntries(slot, makeInputs())

    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.order)).toEqual([0, 1, 2])
    expect(entries.map((e) => (e.sourceRef as { speaker?: string }).speaker)).toEqual([
      'LEADER',
      'CONGREGATION',
      'LEADER',
    ])
    expect(entries.map((e) => (e.sourceRef as { text?: string }).text)).toEqual(['One', 'Two', 'Three'])
  })

  it('each derived section entry has a distinct freshly minted id', () => {
    const sections = [makeSection({ text: 'One' }), makeSection({ text: 'Two' }), makeSection({ text: 'Three' })]
    const slot = scriptureSlot({ congregationalSections: sections })

    const entries = deriveGroupEntries(slot, makeInputs())

    expect(new Set(entries.map((e) => e.id)).size).toBe(3)
  })

  it('a section with a verseRange carries it onto the entry; a section without one leaves the entry with no verseRange key at all', () => {
    const sections = [makeSection({ text: 'With range', verseRange: '1' }), makeSection({ text: 'No range' })]
    const slot = scriptureSlot({ congregationalSections: sections })

    const entries = deriveGroupEntries(slot, makeInputs())

    expect((entries[0]!.sourceRef as { verseRange?: string }).verseRange).toBe('1')
    expect(Object.prototype.hasOwnProperty.call(entries[1]!.sourceRef, 'verseRange')).toBe(false)
  })

  it('a SCRIPTURE slot with sections but no reference still derives zero entries', () => {
    const slot = scriptureSlot({
      book: null,
      chapter: null,
      verseStart: null,
      verseEnd: null,
      congregationalSections: [makeSection()],
    })
    expect(deriveGroupEntries(slot, makeInputs())).toEqual([])
  })

  it('an empty congregationalSections array still derives exactly ONE payload-free entry, unchanged from the no-sections case', () => {
    const slot = scriptureSlot({ congregationalSections: [] })
    const entries = deriveGroupEntries(slot, makeInputs())
    expect(entries).toHaveLength(1)
    expect(entries[0]!.sourceRef).toEqual({ kind: 'scripture' })
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

describe('deriveGroupEntries — MISC (R123)', () => {
  it('a MISC slot derives NO slides (empty array)', () => {
    const slot: NonAssignableSlot = { kind: 'MISC', id: 'slot-misc-0', position: 0 }
    const entries = deriveGroupEntries(slot, makeInputs())
    expect(entries).toEqual([])
  })

  it('an ANNOUNCEMENTS slot still derives exactly one text entry (sibling regression)', () => {
    const slot: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'slot-ann-0', position: 0 }
    const entries = deriveGroupEntries(slot, makeInputs())
    expect(entries).toHaveLength(1)
    expect(entries[0]!.sourceRef).toEqual({ kind: 'text' })
  })
})

describe('rebuildGroup — MISC no-op (R123 backward-compat)', () => {
  it('preserves an existing MISC group\'s legacy blank auto-slide unchanged', () => {
    const slot: NonAssignableSlot = { kind: 'MISC', id: 'slot-misc-0', position: 0 }
    const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }] })

    const result = rebuildGroup(group, slot, makeInputs())

    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('preserves a hand-added MISC slide unchanged', () => {
    const slot: NonAssignableSlot = { kind: 'MISC', id: 'slot-misc-0', position: 0 }
    const group = makeGroup({
      slides: [{ id: 'h1', order: 0, sourceRef: { kind: 'text', title: 'New slide', body: '' } }],
    })

    const result = rebuildGroup(group, slot, makeInputs())

    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
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

  // D1: sourceSignature is now the durable marker `rebuildScriptureGroup`
  // decides DETACH vs rebuild against, so it must fold sections IN (the
  // reverse of R064's original claim, which this plan reverses).
  describe('SCRIPTURE — congregational sections fold into the signature (D1)', () => {
    it('with NO sections, the signature is byte-identical to the bare formatted reference — unchanged from before this phase', () => {
      const slot = scriptureSlot()
      const inputs = makeInputs()
      expect(sourceSignature(slot, inputs)).toBe('John 3:16-18')
    })

    it('differs between no sections, one section, and three sections', () => {
      const inputs = makeInputs()
      const sigNone = sourceSignature(scriptureSlot(), inputs)
      const sigOne = sourceSignature(scriptureSlot({ congregationalSections: [makeSection()] }), inputs)
      const sigThree = sourceSignature(
        scriptureSlot({
          congregationalSections: [
            makeSection({ text: 'One' }),
            makeSection({ speaker: 'CONGREGATION', text: 'Two' }),
            makeSection({ text: 'Three' }),
          ],
        }),
        inputs,
      )
      expect(sigNone).not.toBe(sigOne)
      expect(sigOne).not.toBe(sigThree)
      expect(sigNone).not.toBe(sigThree)
    })

    it('differs when a single section\'s text changes', () => {
      const inputs = makeInputs()
      const sigA = sourceSignature(scriptureSlot({ congregationalSections: [makeSection({ text: 'Alpha' })] }), inputs)
      const sigB = sourceSignature(scriptureSlot({ congregationalSections: [makeSection({ text: 'Beta' })] }), inputs)
      expect(sigA).not.toBe(sigB)
    })

    it('differs when a single section\'s speaker flips', () => {
      const inputs = makeInputs()
      const sigLeader = sourceSignature(
        scriptureSlot({ congregationalSections: [makeSection({ speaker: 'LEADER' })] }),
        inputs,
      )
      const sigCongregation = sourceSignature(
        scriptureSlot({ congregationalSections: [makeSection({ speaker: 'CONGREGATION' })] }),
        inputs,
      )
      expect(sigLeader).not.toBe(sigCongregation)
    })

    it('is order-sensitive: the same two sections in reversed order sign differently', () => {
      const inputs = makeInputs()
      const a = makeSection({ speaker: 'LEADER', text: 'First' })
      const b = makeSection({ speaker: 'CONGREGATION', text: 'Second' })
      const sigAB = sourceSignature(scriptureSlot({ congregationalSections: [a, b] }), inputs)
      const sigBA = sourceSignature(scriptureSlot({ congregationalSections: [b, a] }), inputs)
      expect(sigAB).not.toBe(sigBA)
    })

    it('an empty congregationalSections array signs identically to no sections at all', () => {
      const inputs = makeInputs()
      expect(sourceSignature(scriptureSlot({ congregationalSections: [] }), inputs)).toBe(
        sourceSignature(scriptureSlot(), inputs),
      )
    })
  })
})

// R092/T-45-31 (Phase 45): translation provenance threads from a stamped
// CongregationalSection into the produced SourceRef with no re-derivation,
// and neither sourceSignature nor a materializer rebuild ever reads the
// org's current bibleVersion setting to decide anything.
describe('deriveGroupEntries — translationSource passthrough (Phase 45, R092)', () => {
  it('a section carrying translationSource: \'NLT\' spreads that value onto the produced SourceRef, unchanged', () => {
    const sections = [
      makeSection({ text: 'One', translationSource: 'NLT' }),
      makeSection({ text: 'Two', translationSource: 'ESV' }),
    ]
    const slot = scriptureSlot({ congregationalSections: sections })

    const entries = deriveGroupEntries(slot, makeInputs())

    expect((entries[0]!.sourceRef as { translationSource?: string }).translationSource).toBe('NLT')
    expect((entries[1]!.sourceRef as { translationSource?: string }).translationSource).toBe('ESV')
  })

  it('a section with no translationSource produces a SourceRef with no translationSource key at all', () => {
    const sections = [makeSection({ text: 'Field-less' })]
    const slot = scriptureSlot({ congregationalSections: sections })

    const entries = deriveGroupEntries(slot, makeInputs())

    expect(Object.prototype.hasOwnProperty.call(entries[0]!.sourceRef, 'translationSource')).toBe(false)
  })
})

describe('R092 invariant — a bibleVersion setting change never alters an already-materialized group (Phase 45)', () => {
  it('NAMED R092 invariant: sourceSignature is identical for congregational sections that differ ONLY in translationSource — the signature cannot be the thing a setting change would flip', () => {
    const inputs = makeInputs()
    const esvSections = [makeSection({ translationSource: 'ESV' })]
    const nltSections = [makeSection({ translationSource: 'NLT' })]

    const sigEsv = sourceSignature(scriptureSlot({ congregationalSections: esvSections }), inputs)
    const sigNlt = sourceSignature(scriptureSlot({ congregationalSections: nltSections }), inputs)

    expect(sigEsv).toBe(sigNlt)
  })

  it('NAMED R092 invariant: a DETACHED congregational group materialized while stamped \'ESV\' still reports changed:false and returns its stored slides reference-equal — re-running the materializer never overwrites a section\'s stored translationSource with any current setting value', () => {
    const esvSections: CongregationalSection[] = [
      { speaker: 'LEADER', text: 'The Lord is my shepherd;', translationSource: 'ESV' },
      { speaker: 'CONGREGATION', text: 'I shall not want.', translationSource: 'ESV' },
    ]
    const slot = scriptureSlot({ congregationalSections: esvSections })
    const inputs = makeInputs()
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: deriveGroupEntries(slot, inputs),
    })

    // Every stored entry carries the ESV stamp from materialization time.
    for (const entry of group.slides) {
      expect((entry.sourceRef as { translationSource?: string }).translationSource).toBe('ESV')
    }

    // Simulate the org's bibleVersion setting having since flipped to 'NLT':
    // the SLOT itself is unchanged (its stored sections are exactly what
    // they were at materialization time) — `rebuildScriptureGroup` and
    // `sourceSignature` take no OrgSettings argument at all, so this call is
    // indistinguishable from "the setting never changed." That is the
    // guarantee: there is nothing here for a setting change to touch.
    const result = rebuildScriptureGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides).toBe(group.slides)
    for (const entry of result.slides) {
      expect((entry.sourceRef as { translationSource?: string }).translationSource).toBe('ESV')
    }
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

  // R047: the entry's sourceRef carries no reference at all, so a passage
  // change never changes the STORED shape — the new reference is resolved live
  // at render time from the slot. `changed: false` here is the point: editing a
  // passage costs no group write.
  it('editing the passage reports changed: false, with no confirm state anywhere on the result — the new reference is resolved LIVE at render time, not written here', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = makeInSyncScriptureGroup(slot, inputs)

    const editedSlot = scriptureSlot({ book: 'Psalms', chapter: 103, verseStart: 1, verseEnd: 5 })

    const result = rebuildScriptureGroup(group, editedSlot, inputs)

    expect(Object.keys(result).sort()).toEqual(['changed', 'slides'])
    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
  })

  it('T-30-02-03: a passage change preserves the stored entry\'s id, label, notes and attached audio', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = makeInSyncScriptureGroup(slot, inputs)
    group.slides[0] = {
      ...group.slides[0]!,
      label: 'Call to worship',
      notes: 'Read slowly',
      audioUrl: 'https://example.com/slide-audio.mp3',
      audioLoop: true,
    }
    const storedId = group.slides[0]!.id

    const widenedSlot = scriptureSlot({ verseEnd: 21 })

    const result = rebuildScriptureGroup(group, widenedSlot, inputs)

    expect(result.slides).toHaveLength(1)
    const rebuilt = result.slides[0]!
    expect(rebuilt.id).toBe(storedId)
    expect(rebuilt.label).toBe('Call to worship')
    expect(rebuilt.notes).toBe('Read slowly')
    expect(rebuilt.audioUrl).toBe('https://example.com/slide-audio.mp3')
    expect(rebuilt.audioLoop).toBe(true)
    expect(rebuilt.sourceRef).toEqual({ kind: 'scripture' })
  })

  it('T-30-02-03: swapping to an entirely different passage still yields exactly one entry, carrying the previous entry\'s id and audio', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = makeInSyncScriptureGroup(slot, inputs)
    group.slides[0] = { ...group.slides[0]!, audioUrl: 'https://example.com/slide-audio.mp3' }
    const storedId = group.slides[0]!.id

    const newSlot = scriptureSlot({ book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 })

    const result = rebuildScriptureGroup(group, newSlot, inputs)

    expect(result.slides).toHaveLength(1)
    expect(result.slides[0]!.id).toBe(storedId)
    expect(result.slides[0]!.audioUrl).toBe('https://example.com/slide-audio.mp3')
    expect(result.slides[0]!.sourceRef).toEqual({ kind: 'scripture' })
  })

  it('T-30-02-04: clearing the slot\'s reference leaves the group untouched, changed: false, never emptying it', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = makeInSyncScriptureGroup(slot, inputs)

    const clearedSlot = scriptureSlot({ book: null, chapter: null, verseStart: null, verseEnd: null })
    const result = rebuildScriptureGroup(group, clearedSlot, inputs)

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

  it('a dropped video on a SCRIPTURE group survives a passage swap, still after the single carried scripture entry', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...deriveGroupEntries(slot, inputs),
        { id: 'e-video', order: 1, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    })

    const newSlot = scriptureSlot({ book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 })

    const result = rebuildScriptureGroup(group, newSlot, inputs)

    // R047: the stored shape is reference-free, so a passage swap needs no
    // write at all — the survival guarantee is that the video is still there
    // and still second, not that the group churned.
    expect(result.changed).toBe(false)
    expect(result.slides).toHaveLength(2)
    expect(result.slides[0]!.sourceRef).toEqual({ kind: 'scripture' })
    const videoEntry = result.slides[1]!
    expect(videoEntry.id).toBe('e-video')
    expect(videoEntry.sourceRef).toEqual({ kind: 'video', videoSrc: 'https://example.com/dropped.mp4' })
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

// ── BL-01 / BL-02 (Phase 30 code review) ─────────────────────────────────────
//
// The generalized carry rebuild bought idempotence at the cost of preservation:
// it emitted only what the CURRENT derivation produced, in the DERIVATION's own
// order, and recognised only `video`/authored-`text` as user work. Everything
// else a user can legitimately put into a SCRIPTURE or IMPORTED group — an
// imported deck, dropped images, a drag-reorder — was destroyed by the first
// unconditional rebuild, with no dialog. These are the two closing contracts.
describe('BL-01 — a stored entry no slot-kind derivation could have produced is user work and survives', () => {
  it('an imported deck appended into a SCRIPTURE group survives a passage change', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const derived = deriveGroupEntries(slot, inputs)
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...derived,
        { id: 'e-deck-b-1', order: 1, sourceRef: { kind: 'imported', importId: 'deck-b', innerSlideId: 'b1' } },
        { id: 'e-deck-b-2', order: 2, sourceRef: { kind: 'imported', importId: 'deck-b', innerSlideId: 'b2' } },
      ],
    })

    const newSlot = scriptureSlot({ book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 })
    const result = rebuildScriptureGroup(group, newSlot, inputs)

    expect(result.slides.map((e) => e.id)).toEqual([derived[0]!.id, 'e-deck-b-1', 'e-deck-b-2'])
    // The stored shape is reference-free (R047), so nothing needed rewriting.
    expect(result.changed).toBe(false)
  })

  it('images dropped onto a SCRIPTURE group (imported refs from a foreign deck) survive a passage change', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const derived = deriveGroupEntries(slot, inputs)
    const group = makeGroup({
      slides: [
        ...derived,
        { id: 'e-image', order: 1, sourceRef: { kind: 'imported', importId: 'dropped-images', innerSlideId: 'img-1' } },
      ],
    })

    const result = rebuildScriptureGroup(group, scriptureSlot({ chapter: 4 }), inputs)

    expect(result.slides.some((e) => e.id === 'e-image')).toBe(true)
  })

  it('a SECOND deck imported into an IMPORTED group survives a rebuild of the slot\'s own deck', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const derived = deriveGroupEntries(slot, inputs)
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...derived,
        { id: 'e-deck-b-1', order: 2, sourceRef: { kind: 'imported', importId: 'deck-b', innerSlideId: 'b1' } },
        { id: 'e-deck-b-2', order: 3, sourceRef: { kind: 'imported', importId: 'deck-b', innerSlideId: 'b2' } },
      ],
    })

    const result = rebuildImportedGroup(group, slot, inputs)

    expect(result.slides.map((e) => e.id)).toEqual([
      derived[0]!.id,
      derived[1]!.id,
      'e-deck-b-1',
      'e-deck-b-2',
    ])
    expect(result.changed).toBe(false)
  })

  it('the intended drop still happens: a matching importId whose innerSlideId the re-import no longer produces is dropped, in the SAME group where a foreign deck\'s entry survives', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const derived = deriveGroupEntries(slot, inputs)
    const group = makeGroup({
      slides: [
        ...derived,
        { id: 'e-deck-b-1', order: 2, sourceRef: { kind: 'imported', importId: 'deck-b', innerSlideId: 'b1' } },
      ],
    })

    const shrunkDeck = makeImportedDeck({
      slides: [{ id: 'is-1', position: 0, contentKind: 'text', title: 'Welcome', body: 'Welcome to church' } as TextSlide],
    })
    const shrunkInputs = makeInputs({ importedDecksById: new Map([['deck-1', shrunkDeck]]) })

    const result = rebuildImportedGroup(group, slot, shrunkInputs)

    // deck-1's own is-2 is gone — the source stopped producing it.
    expect(
      result.slides.some((e) => e.sourceRef.kind === 'imported' && e.sourceRef.innerSlideId === 'is-2'),
    ).toBe(false)
    // deck-b's entry is user work, not deck-1's derivation — it stays.
    expect(result.slides.some((e) => e.id === 'e-deck-b-1')).toBe(true)
    expect(result.changed).toBe(true)
  })
})

describe('BL-02 — a SCRIPTURE/IMPORTED group\'s stored slide ORDER is the user\'s and survives every rebuild', () => {
  function threeSlideDeck(): ReturnType<typeof makeImportedDeck> {
    return makeImportedDeck({
      slides: [
        { id: 'is-1', position: 0, contentKind: 'text', title: 'One', body: 'One' } as TextSlide,
        { id: 'is-2', position: 1, contentKind: 'text', title: 'Two', body: 'Two' } as TextSlide,
        { id: 'is-3', position: 2, contentKind: 'text', title: 'Three', body: 'Three' } as TextSlide,
      ],
    })
  }

  function innerIds(slides: SlideGroup['slides']): (string | undefined)[] {
    return slides.map((e) => (e.sourceRef.kind === 'imported' ? e.sourceRef.innerSlideId : undefined))
  }

  it('a reordered imported group rebuilds to changed: false — a drag-reorder is not reverted within one round trip', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', threeSlideDeck()]]) })
    const derived = deriveGroupEntries(slot, inputs)
    // The user drags i3 to the front: SlideGrid.onEnd writes [e3, e2, e1].
    const reordered = [derived[2]!, derived[1]!, derived[0]!].map((e, index) => ({ ...e, order: index }))
    const group = makeGroup({ sourceSignature: sourceSignature(slot, inputs), slides: reordered })

    const result = rebuildImportedGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
    expect(innerIds(result.slides)).toEqual(['is-3', 'is-2', 'is-1'])
  })

  it('a surviving hand-added video stays where the user put it rather than moving to the end', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', threeSlideDeck()]]) })
    const derived = deriveGroupEntries(slot, inputs)
    // The user dropped a video BETWEEN the first and second deck slides.
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        { ...derived[0]!, order: 0 },
        { id: 'e-video', order: 1, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
        { ...derived[1]!, order: 2 },
        { ...derived[2]!, order: 3 },
      ],
    })

    const result = rebuildImportedGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides.map((e) => e.id)).toEqual([derived[0]!.id, 'e-video', derived[1]!.id, derived[2]!.id])
  })

  it('a reordered SCRIPTURE group keeps its hand-added entry ahead of the derived reference slide', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const derived = deriveGroupEntries(slot, inputs)
    const group = makeGroup({
      slides: [
        { id: 'e-video', order: 0, sourceRef: { kind: 'video', videoSrc: 'https://example.com/intro.mp4' } },
        { ...derived[0]!, order: 1 },
      ],
    })

    const result = rebuildScriptureGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides.map((e) => e.id)).toEqual(['e-video', derived[0]!.id])
  })

  it('a re-import that mints entirely fresh innerSlideIds lands the whole new deck block where the old deck block was — ahead of an entry the user appended after it', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', threeSlideDeck()]]) })
    const derived = deriveGroupEntries(slot, inputs)
    const group = makeGroup({
      slides: [
        ...derived,
        { id: 'e-video', order: 3, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    })

    // A re-import: every innerSlideId is new, so NO derived entry has a stored
    // position to sort by.
    const reimported = makeImportedDeck({
      slides: [
        { id: 'fresh-1', position: 0, contentKind: 'text', title: 'One', body: 'One' } as TextSlide,
        { id: 'fresh-2', position: 1, contentKind: 'text', title: 'Two', body: 'Two' } as TextSlide,
      ],
    })
    const reimportedInputs = makeInputs({ importedDecksById: new Map([['deck-1', reimported]]) })

    const result = rebuildImportedGroup(group, slot, reimportedInputs)

    expect(innerIds(result.slides)).toEqual(['fresh-1', 'fresh-2', undefined])
    expect(result.slides[2]!.id).toBe('e-video')
  })

  it('a newly-added deck slide joins the deck block rather than jumping past a hand-added entry', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', makeImportedDeck()]]) })
    const derived = deriveGroupEntries(slot, inputs) // is-1, is-2
    const group = makeGroup({
      slides: [
        ...derived,
        { id: 'e-video', order: 2, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    })

    const widened = makeImportedDeck({
      slides: [
        { id: 'is-1', position: 0, contentKind: 'text', title: 'Welcome', body: 'Welcome to church' } as TextSlide,
        { id: 'is-2', position: 1, contentKind: 'image', imageUrl: 'https://example.com/a.png', altText: 'slide 2' } as ImageSlide,
        { id: 'is-3', position: 2, contentKind: 'text', title: 'Third', body: 'Third' } as TextSlide,
      ],
    })
    const widenedInputs = makeInputs({ importedDecksById: new Map([['deck-1', widened]]) })

    const result = rebuildImportedGroup(group, slot, widenedInputs)

    expect(innerIds(result.slides)).toEqual(['is-1', 'is-2', 'is-3', undefined])
    expect(result.slides[3]!.id).toBe('e-video')
  })

  it('the rebuild stays idempotent: a second pass over its own output is byte-identical', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', threeSlideDeck()]]) })
    const derived = deriveGroupEntries(slot, inputs)
    const group = makeGroup({
      slides: [
        { ...derived[2]!, order: 0 },
        { id: 'e-video', order: 1, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
        { ...derived[0]!, order: 2 },
      ],
    })

    const first = rebuildImportedGroup(group, slot, inputs)
    const second = rebuildImportedGroup({ ...group, slides: first.slides }, slot, inputs)

    expect(second.changed).toBe(false)
    expect(second.slides).toEqual(first.slides)
  })
})

describe('HI-01 — a pre-R047 scripture group collapses to exactly ONE entry', () => {
  it('a 3-entry legacy scripture group (each entry carrying its own innerSlideId) rebuilds to one entry, not three', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = makeGroup({
      slides: [
        { id: 'e-1', order: 0, sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'scripture-0' } },
        { id: 'e-2', order: 1, sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'scripture-1' } },
        { id: 'e-3', order: 2, sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'scripture-2' } },
      ],
    })

    const result = rebuildScriptureGroup(group, slot, inputs)

    expect(result.changed).toBe(true)
    expect(result.slides).toHaveLength(1)
    // The FIRST stored entry is the one carried — its id, label, notes and
    // audio come forward onto the single reference slide.
    expect(result.slides[0]!.id).toBe('e-1')
    expect(result.slides[0]!.sourceRef).toEqual({ kind: 'scripture' })
  })

  it('the collapse is stable — a second rebuild of the collapsed group is a no-op', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = makeGroup({
      slides: [
        { id: 'e-1', order: 0, sourceRef: { kind: 'scripture', innerSlideId: 'scripture-0' } },
        { id: 'e-2', order: 1, sourceRef: { kind: 'scripture', innerSlideId: 'scripture-1' } },
      ],
    })

    const first = rebuildScriptureGroup(group, slot, inputs)
    const second = rebuildScriptureGroup({ ...group, slides: first.slides }, slot, inputs)

    expect(second.changed).toBe(false)
    expect(second.slides).toEqual(first.slides)
  })

  it('a legacy scripture group\'s hand-added video is not collapsed away with the surplus reference entries', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = makeGroup({
      slides: [
        { id: 'e-1', order: 0, sourceRef: { kind: 'scripture', innerSlideId: 'scripture-0' } },
        { id: 'e-2', order: 1, sourceRef: { kind: 'scripture', innerSlideId: 'scripture-1' } },
        { id: 'e-video', order: 2, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    })

    const result = rebuildScriptureGroup(group, slot, inputs)

    expect(result.slides.map((e) => e.id)).toEqual(['e-1', 'e-video'])
  })
})

// R064/D1: Phase 34's PATTERNS.md claimed `slideGroupMaterializer.ts` needs NO
// structural change for congregational sections, and that claim held through
// Phase 34 — a scripture group stayed exactly one payload-free entry and its
// signature stayed byte-identical regardless of sections, because sections
// were resolved LIVE off the slot at assembly time with no group involvement.
// Phase 38 (D1) reverses BOTH halves of that claim on purpose: converting to
// congregational now DOES change the group's structure (N entries, one per
// section) and DOES change what the signature folds in (the sections
// themselves), because the whole point of D1 is a group that detaches from
// the slot instead of resolving it live. This block is the positive
// replacement for the old claim, not a deletion of it.
describe('R064/D1 — congregational sections DO reshape the group and DO fold into the signature', () => {
  it('deriveGroupEntries on a SCRIPTURE slot WITH congregationalSections returns one entry PER section, not one payload-free entry', () => {
    const slot = scriptureSlot({
      congregationalSections: [
        { speaker: 'LEADER', text: 'The Lord is my shepherd;' },
        { speaker: 'CONGREGATION', text: 'I shall not want.' },
      ],
    })
    const inputs = makeInputs()

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(2)
    expect(entries.every((e) => e.sourceRef.kind === 'scripture')).toBe(true)
    expect(entries.every((e) => congregationalSectionFromRef(e.sourceRef) !== null)).toBe(true)
  })

  it('entry count differs with and without congregationalSections — one entry without, N entries with', () => {
    const withoutSections = scriptureSlot()
    const withSections = scriptureSlot({
      congregationalSections: [{ speaker: 'LEADER', text: 'Section text' }],
    })
    const inputs = makeInputs()

    const entriesWithout = deriveGroupEntries(withoutSections, inputs)
    const entriesWith = deriveGroupEntries(withSections, inputs)

    expect(entriesWithout).toHaveLength(1)
    expect(entriesWithout[0]!.sourceRef).toEqual({ kind: 'scripture' })
    expect(entriesWith).toHaveLength(1)
    expect(congregationalSectionFromRef(entriesWith[0]!.sourceRef)).not.toBeNull()
  })

  it('sourceSignature now DIFFERS across slots that differ only in congregationalSections (absent, one section, three different sections)', () => {
    const inputs = makeInputs()
    const slotAbsent = scriptureSlot()
    const slotOneSection = scriptureSlot({
      congregationalSections: [{ speaker: 'LEADER', text: 'One section only' }],
    })
    const slotThreeSections = scriptureSlot({
      congregationalSections: [
        { speaker: 'LEADER', text: 'First distinct text' },
        { speaker: 'CONGREGATION', text: 'Second distinct text' },
        { speaker: 'LEADER', text: 'Third distinct text' },
      ],
    })

    const sigAbsent = sourceSignature(slotAbsent, inputs)
    const sigOne = sourceSignature(slotOneSection, inputs)
    const sigThree = sourceSignature(slotThreeSections, inputs)

    expect(sigAbsent).not.toBe(sigOne)
    expect(sigOne).not.toBe(sigThree)
    // The no-sections case is unchanged from before this phase — the guard
    // against Phase 30's hard lock being disturbed for every existing
    // Reference-state group.
    expect(sigAbsent).toBe('John 3:16-18')
  })
})

// D1: `rebuildScriptureGroup`'s two-state machine — DETACHED (materialized
// from the current reading, freely editable, never re-derived) vs the
// Reference state's original slot-driven rebuild. `congregationalSectionFromRef`
// import above is reused for these assertions.
describe('rebuildScriptureGroup — the two-state machine (D1)', () => {
  function inSyncCongregationalGroup(slot: ScriptureSlot, inputs: AssemblyInputs): SlideGroup {
    return makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: deriveGroupEntries(slot, inputs),
    })
  }

  const threeSections: CongregationalSection[] = [
    { speaker: 'LEADER', text: 'The Lord is my shepherd; I shall not want.' },
    { speaker: 'CONGREGATION', text: 'He makes me lie down in green pastures.' },
    { speaker: 'LEADER', text: 'He leads me beside still waters.' },
  ]

  it('DETACH: a group already materialized from the slot\'s current reading rebuilds to changed: false, slides reference-equal to the stored ones', () => {
    const slot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const group = inSyncCongregationalGroup(slot, inputs)

    const result = rebuildScriptureGroup(group, slot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides).toBe(group.slides)
  })

  it('DETACH: still changed: false after the caller has removed one entry', () => {
    const slot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const group = inSyncCongregationalGroup(slot, inputs)
    const withOneDeleted: SlideGroup = { ...group, slides: group.slides.slice(0, 2) }

    const result = rebuildScriptureGroup(withOneDeleted, slot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides).toBe(withOneDeleted.slides)
    expect(result.slides).toHaveLength(2)
  })

  it('DETACH: still changed: false, empty, after the caller has removed every entry', () => {
    const slot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const group = inSyncCongregationalGroup(slot, inputs)
    const emptied: SlideGroup = { ...group, slides: [] }

    const result = rebuildScriptureGroup(emptied, slot, inputs)

    expect(result).toEqual({ changed: false, slides: [] })
  })

  it('CONVERT: a group holding one payload-free entry, on a slot with three sections and a stale signature, rebuilds to three section entries in section order, the first carrying the stored entry\'s id and audioUrl', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [{ ...deriveGroupEntries(slot, inputs)[0]!, audioUrl: 'https://example.com/call-to-worship.mp3' }],
    })
    const storedId = group.slides[0]!.id

    const congregationalSlot = scriptureSlot({ congregationalSections: threeSections })
    const result = rebuildScriptureGroup(group, congregationalSlot, inputs)

    expect(result.changed).toBe(true)
    expect(result.slides).toHaveLength(3)
    expect(result.slides.map((e) => congregationalSectionFromRef(e.sourceRef)?.text)).toEqual(
      threeSections.map((s) => s.text),
    )
    expect(result.slides[0]!.id).toBe(storedId)
    expect(result.slides[0]!.audioUrl).toBe('https://example.com/call-to-worship.mp3')
  })

  it('RE-SPLIT: a converted group re-run against a slot whose sections changed to two rebuilds to exactly two section entries — never five, never growing', () => {
    const slot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const group = inSyncCongregationalGroup(slot, inputs)

    const twoSections: CongregationalSection[] = [
      { speaker: 'LEADER', text: 'Reworded first half.' },
      { speaker: 'CONGREGATION', text: 'Reworded second half.' },
    ]
    const resplitSlot = scriptureSlot({ congregationalSections: twoSections })

    const result = rebuildScriptureGroup(group, resplitSlot, inputs)

    expect(result.changed).toBe(true)
    expect(result.slides).toHaveLength(2)
    expect(result.slides.map((e) => congregationalSectionFromRef(e.sourceRef)?.text)).toEqual(
      twoSections.map((s) => s.text),
    )
  })

  it('DESTROY: a group holding three section entries, on a slot whose reference changed and whose sections were therefore cleared, rebuilds to exactly ONE payload-free entry', () => {
    const slot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const group = inSyncCongregationalGroup(slot, inputs)

    // scriptureSlotAfterReferenceChange clears congregationalSections on a
    // reference change — model the slot AFTER that clearing, with the NEW
    // reference already written.
    const newPassageSlot = scriptureSlot({ book: 'Psalms', chapter: 100, verseStart: 1, verseEnd: 5 })

    const result = rebuildScriptureGroup(group, newPassageSlot, inputs)

    expect(result.changed).toBe(true)
    expect(result.slides).toHaveLength(1)
    expect(result.slides[0]!.sourceRef).toEqual({ kind: 'scripture' })
  })

  it('CLEARED REFERENCE: a group holding three section entries, on a slot whose reference is now null, rebuilds to zero scripture entries while retaining a hand-added video entry', () => {
    const slot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const inSync = inSyncCongregationalGroup(slot, inputs)
    const group: SlideGroup = {
      ...inSync,
      slides: [
        ...inSync.slides,
        { id: 'e-video', order: 3, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } },
      ],
    }

    const clearedSlot = scriptureSlot({ book: null, chapter: null, verseStart: null, verseEnd: null })
    const result = rebuildScriptureGroup(group, clearedSlot, inputs)

    expect(result.changed).toBe(true)
    expect(result.slides).toEqual([{ id: 'e-video', order: 0, sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' } }])
  })

  it('CLEARED REFERENCE, Reference state: a group holding one payload-free entry, on a slot whose reference is now null, still rebuilds to changed: false with the group untouched (T-30-02-04 unchanged)', () => {
    const slot = scriptureSlot()
    const inputs = makeInputs()
    const group = inSyncCongregationalGroup(slot, inputs)

    const clearedSlot = scriptureSlot({ book: null, chapter: null, verseStart: null, verseEnd: null })
    const result = rebuildScriptureGroup(group, clearedSlot, inputs)

    expect(result).toEqual({ changed: false, slides: group.slides })
  })

  it('IDEMPOTENCE: DETACH, CONVERT, RE-SPLIT and DESTROY are all changed: false on a second pass', () => {
    const inputs = makeInputs()

    // DETACH is trivially idempotent by construction (branch 1 always
    // returns changed: false) — proven above. Prove the other three by
    // feeding each result back in as the new stored group.
    const convertSlotBase = scriptureSlot()
    const convertGroup = makeGroup({
      sourceSignature: sourceSignature(convertSlotBase, inputs),
      slides: deriveGroupEntries(convertSlotBase, inputs),
    })
    const convertSlot = scriptureSlot({ congregationalSections: threeSections })
    const convertFirst = rebuildScriptureGroup(convertGroup, convertSlot, inputs)
    const convertRegrouped: SlideGroup = { ...convertGroup, sourceSignature: sourceSignature(convertSlot, inputs), slides: convertFirst.slides }
    const convertSecond = rebuildScriptureGroup(convertRegrouped, convertSlot, inputs)
    expect(convertSecond.changed).toBe(false)
    expect(convertSecond.slides).toEqual(convertFirst.slides)

    const resplitSections: CongregationalSection[] = [
      { speaker: 'LEADER', text: 'Reworded first half.' },
      { speaker: 'CONGREGATION', text: 'Reworded second half.' },
    ]
    const resplitSlot = scriptureSlot({ congregationalSections: resplitSections })
    const resplitFirst = rebuildScriptureGroup(convertRegrouped, resplitSlot, inputs)
    const resplitRegrouped: SlideGroup = { ...convertRegrouped, sourceSignature: sourceSignature(resplitSlot, inputs), slides: resplitFirst.slides }
    const resplitSecond = rebuildScriptureGroup(resplitRegrouped, resplitSlot, inputs)
    expect(resplitSecond.changed).toBe(false)
    expect(resplitSecond.slides).toEqual(resplitFirst.slides)

    const destroySlot = scriptureSlot({ book: 'Psalms', chapter: 100, verseStart: 1, verseEnd: 5 })
    const destroyFirst = rebuildScriptureGroup(resplitRegrouped, destroySlot, inputs)
    const destroyRegrouped: SlideGroup = { ...resplitRegrouped, sourceSignature: sourceSignature(destroySlot, inputs), slides: destroyFirst.slides }
    const destroySecond = rebuildScriptureGroup(destroyRegrouped, destroySlot, inputs)
    expect(destroySecond.changed).toBe(false)
    expect(destroySecond.slides).toEqual(destroyFirst.slides)
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

  it('buildInitialGroup immediately followed by rebuildGroup reports no change — a freshly materialised group is already in sync', () => {
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

// R060 — the two materialized-path copyright brackets: fresh derivation
// (`deriveGroupEntries`) and rebuild self-healing (`rebuildSongGroup`). Both
// pushes in `deriveGroupEntries`'s SONG case and both merge pushes in
// `rebuildSongGroup` (slideGroupMaterializer.ts:54/:66, :562-566/:619-623)
// are already unconditional — this block PINS that existing behavior, as a
// deliberate safety margin beyond the documented convention, never as a
// licensing mandate. It adds no new emission.
//
// Dependency note (Pitfall 2, 35-RESEARCH.md): `ensureGroupMaterialized`'s
// zero-slide bypass (useSlideshowAssembly.ts:388-427) could persist a
// bracket-less SONG group, but every call site sits behind `canMutateGroup`,
// which excludes song groups (R054, SlideGrid.vue:335). A future phase that
// relaxes R054 must revisit that bypass before it can reach a SONG slot.
describe('R060 — copyright bracket (materialized paths)', () => {
  // On this path the source ref is a clean discriminator — unlike the
  // assembled-slide path, no `contentKind` ambiguity exists here.
  function copyrightIndices(entries: { sourceRef: { kind: string } }[]): number[] {
    return entries.reduce<number[]>((acc, entry, index) => {
      if (entry.sourceRef.kind === 'copyright') acc.push(index)
      return acc
    }, [])
  }

  describe('deriveGroupEntries — fresh materialization', () => {
    it('an empty performanceOrder still derives exactly 2 copyright entries with order [0, 1]', () => {
      const slot = songSlot({ songId: 'song-1' })
      const lyrics = makeSongLyrics({ performanceOrder: [] })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const entries = deriveGroupEntries(slot, inputs)

      expect(entries).toHaveLength(2)
      expect(entries.every((e) => e.sourceRef.kind === 'copyright')).toBe(true)
      expect(entries.map((e) => e.order)).toEqual([0, 1])
    })

    it('a one-section order derives copyright, lyric, copyright — the two copyright entries have distinct ids', () => {
      const slot = songSlot({ songId: 'song-1' })
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1'] })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const entries = deriveGroupEntries(slot, inputs)

      expect(entries.map((e) => e.sourceRef.kind)).toEqual(['copyright', 'lyric', 'copyright'])
      expect(entries[0]!.id).not.toBe(entries[2]!.id)
    })

    it('a five-section order derives a first-and-last copyright bracket with a contiguous 0..n order', () => {
      const sections = Array.from({ length: 5 }, (_, i) => ({
        id: `verse-${i}`,
        label: `Verse ${i}`,
        lines: [`Line ${i}`],
      }))
      const slot = songSlot({ songId: 'song-1' })
      const lyrics = makeSongLyrics({ sections, performanceOrder: sections.map((s) => s.id) })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const entries = deriveGroupEntries(slot, inputs)

      expect(entries).toHaveLength(7)
      expect(entries[0]!.sourceRef.kind).toBe('copyright')
      expect(entries[entries.length - 1]!.sourceRef.kind).toBe('copyright')
      for (let i = 1; i < entries.length - 1; i++) {
        expect(entries[i]!.sourceRef.kind).not.toBe('copyright')
      }
      expect(entries.map((e) => e.order)).toEqual([0, 1, 2, 3, 4, 5, 6])
    })
  })

  describe('rebuildSongGroup — self-healing', () => {
    function makeStoredSongGroup(slides: SlideGroup['slides']): SlideGroup {
      return { id: 'slot-1', serviceId: 'svc-1', slotId: 'slot-1', slides, createdAt: mockTimestamp, updatedAt: mockTimestamp }
    }

    it('one stored copyright entry (leading only) self-heals to exactly 2, minting a genuinely new trailing entry', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
      ])
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1'] })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      const copyrightEntries = result.slides.filter((e) => e.sourceRef.kind === 'copyright')
      expect(copyrightEntries).toHaveLength(2)
      expect(copyrightEntries[0]!.id).toBe('e-copyright-lead')
      const storedIds = new Set(group.slides.map((e) => e.id))
      expect(storedIds.has(copyrightEntries[1]!.id)).toBe(false)
    })

    it('zero stored copyright entries self-heal to exactly 2, both freshly minted', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup([
        { id: 'e-verse-1', order: 0, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
      ])
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1'] })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      const copyrightEntries = result.slides.filter((e) => e.sourceRef.kind === 'copyright')
      expect(copyrightEntries).toHaveLength(2)
      const storedIds = new Set(group.slides.map((e) => e.id))
      expect(copyrightEntries.every((e) => !storedIds.has(e.id))).toBe(true)
    })

    it('three stored copyright entries (corrupted/hand-edited data) self-heal to 2, keeping first-as-leading and last-as-trailing, dropping the middle', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-copyright-middle', order: 1, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-copyright-trail', order: 3, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1'] })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      const copyrightEntries = result.slides.filter((e) => e.sourceRef.kind === 'copyright')
      expect(copyrightEntries).toHaveLength(2)
      expect(copyrightEntries.map((e) => e.id)).toEqual(['e-copyright-lead', 'e-copyright-trail'])
      expect(result.slides.some((e) => e.id === 'e-copyright-middle')).toBe(false)
    })

    it('an empty performanceOrder still rebuilds to a bracket — 2 copyright entries, no lyric entry between them', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const group = makeStoredSongGroup([
        { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        { id: 'e-copyright-trail', order: 2, sourceRef: { kind: 'copyright', songId: 'song-1' } },
      ])
      // The song's performanceOrder is now empty and its sections gone too —
      // the lyric entry no longer resolves against freshOrder.
      const lyrics = makeSongLyrics({ sections: [], performanceOrder: [] })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const result = rebuildSongGroup(group, slot, inputs)

      const indices = copyrightIndices(result.slides)
      expect(indices).toEqual([0, result.slides.length - 1])
      expect(result.slides.filter((e) => e.sourceRef.kind === 'copyright')).toHaveLength(2)
    })

    it('across 0/1/3-stored-copyright rebuilds, copyright entries sit at index 0 and length-1 with contiguous order from 0', () => {
      const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
      const lyrics = makeSongLyrics({ performanceOrder: ['verse-1'] })
      const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

      const fixtures: SlideGroup['slides'][] = [
        // zero stored copyright entries
        [{ id: 'e-verse-1', order: 0, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } }],
        // one stored copyright entry
        [
          { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
          { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
        ],
        // three stored copyright entries
        [
          { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId: 'song-1' } },
          { id: 'e-copyright-middle', order: 1, sourceRef: { kind: 'copyright', songId: 'song-1' } },
          { id: 'e-verse-1', order: 2, sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' } },
          { id: 'e-copyright-trail', order: 3, sourceRef: { kind: 'copyright', songId: 'song-1' } },
        ],
      ]

      for (const slides of fixtures) {
        const group = makeStoredSongGroup(slides)
        const result = rebuildSongGroup(group, slot, inputs)

        expect(copyrightIndices(result.slides)).toEqual([0, result.slides.length - 1])
        expect(result.slides.map((e) => e.order)).toEqual(result.slides.map((_, i) => i))
      }
    })
  })
})

// ---------------------------------------------------------------------------
// Phase 42 (42-04): IMPORTED render-reconciliation fixtures, local to the four
// describe blocks below. Deliberately NOT folded into the shared fixtures
// above `deriveGroupEntries — IMPORTED` — every existing IMPORTED fixture in
// this file has no `renderImportId` on purpose, so the pre-existing 108 tests
// prove the byte-identical parsed-mode fallthrough (D-16) untouched by any of
// this.
// ---------------------------------------------------------------------------

/** A 5-parsed-slide deck carrying a `renderImportId`, so it resolves through
 * every mode `resolveImportedRender` can produce rather than always `parsed`. */
function makeRenderedImportedDeck(overrides: Partial<ImportedDeck> = {}): ImportedDeck {
  return makeImportedDeck({
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
 * `render` is provided, that render document registered under the deck's OWN
 * `renderImportId` (never under `deck.id` — T-42-07's two-identifier design). */
function makeRenderInputs(
  deck: ImportedDeck,
  render: PptxRenderDoc | undefined,
  overrides: Partial<AssemblyInputs> = {},
): AssemblyInputs {
  const pptxRendersByImportId = new Map<string, PptxRenderDoc>()
  if (render && deck.renderImportId) pptxRendersByImportId.set(deck.renderImportId, render)
  return makeInputs({
    importedDecksById: new Map([[deck.id, deck]]),
    pptxRendersByImportId,
    ...overrides,
  })
}

describe('deriveGroupEntries — IMPORTED with a render', () => {
  it('T-42-07: a deck with no renderImportId derives its parsed entries unchanged even when a render document for another id is present in the map', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck() // no renderImportId — the wrong-deck guard case
    const inputs = makeInputs({
      importedDecksById: new Map([['deck-1', deck]]),
      pptxRendersByImportId: new Map([['some-other-render-id', makeRenderDoc({ status: 'ready', renderedCount: 99 })]]),
    })

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.sourceRef)).toEqual([
      { kind: 'imported', importId: 'deck-1', innerSlideId: 'is-1' },
      { kind: 'imported', importId: 'deck-1', innerSlideId: 'is-2' },
    ])
  })

  it('a pending render derives entries equal to the parsed count, every innerSlideId a parsed inner slide id', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeRenderedImportedDeck()
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'pending' }))

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(5)
    expect(entries.map((e) => (e.sourceRef as { innerSlideId: string }).innerSlideId)).toEqual([
      'is-1',
      'is-2',
      'is-3',
      'is-4',
      'is-5',
    ])
  })

  it('a failed render derives entries equal to the parsed count, every innerSlideId a parsed inner slide id', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeRenderedImportedDeck()
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'failed', failureReason: 'render-timeout' }))

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(5)
    expect(
      entries.every(
        (e) => e.sourceRef.kind === 'imported' && !e.sourceRef.innerSlideId.startsWith(RENDERED_PAGE_IDENTITY_PREFIX),
      ),
    ).toBe(true)
  })

  it.each([
    { renderedCount: 3 },
    { renderedCount: 5 },
    { renderedCount: 8 },
  ])(
    'ROADMAP criterion 3 / D-05: a ready render with renderedCount=$renderedCount derives exactly $renderedCount synthetic rendered-page entries, unconditional on the parsed count of 5',
    ({ renderedCount }) => {
      const slot = importedSlot({ importId: 'deck-1' })
      const deck = makeRenderedImportedDeck()
      const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount }))

      const entries = deriveGroupEntries(slot, inputs)

      expect(entries).toHaveLength(renderedCount)
      expect(
        entries.every(
          (e, i) =>
            e.sourceRef.kind === 'imported' && e.sourceRef.innerSlideId === `${RENDERED_PAGE_IDENTITY_PREFIX}${i + 1}`,
        ),
      ).toBe(true)
      // None of these synthetic identities is a parsed inner slide id.
      const parsedIds = new Set(deck.slides.map((s) => s.id))
      expect(
        entries.every((e) => e.sourceRef.kind === 'imported' && !parsedIds.has(e.sourceRef.innerSlideId)),
      ).toBe(true)
    },
  )

  it('D-05 named carve-out: a self-contradictory ready render with renderedCount=0 resolves to failed and derives the parsed count with parsed inner slide ids, not zero entries', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeRenderedImportedDeck()
    const inputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 0 }))

    const entries = deriveGroupEntries(slot, inputs)

    expect(entries).toHaveLength(5)
    expect(
      entries.every(
        (e) => e.sourceRef.kind === 'imported' && !e.sourceRef.innerSlideId.startsWith(RENDERED_PAGE_IDENTITY_PREFIX),
      ),
    ).toBe(true)
  })
})

describe('sourceSignature — IMPORTED render folding', () => {
  it('R079/D-09: pending, failed, ready/3 and ready/4 all produce distinct signatures for the same deck', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeRenderedImportedDeck()

    const pending = sourceSignature(slot, makeRenderInputs(deck, makeRenderDoc({ status: 'pending' })))
    const failed = sourceSignature(slot, makeRenderInputs(deck, makeRenderDoc({ status: 'failed' })))
    const ready3 = sourceSignature(slot, makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 3 })))
    const ready4 = sourceSignature(slot, makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 4 })))

    expect(new Set([pending, failed, ready3, ready4]).size).toBe(4)
  })

  it('D-09: the absent-render-document case signs identically to the explicit pending case, since both resolve to the same mode', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeRenderedImportedDeck()

    const explicitPending = sourceSignature(slot, makeRenderInputs(deck, makeRenderDoc({ status: 'pending' })))
    const absentRenderDoc = sourceSignature(slot, makeRenderInputs(deck, undefined))

    expect(explicitPending).toBe(absentRenderDoc)
  })

  it("T-42-10: two decks whose parsed text differs only by where a literal pipe falls do not collide — the old `${count}:${texts.join('|')}` form would have", () => {
    const slotA = importedSlot({ importId: 'deck-a' })
    const deckA = makeImportedDeck({
      id: 'deck-a',
      slides: [
        { id: 'a-1', position: 0, contentKind: 'text', body: 'x|y' } as TextSlide,
        { id: 'a-2', position: 1, contentKind: 'text', body: 'z' } as TextSlide,
      ],
    })
    const inputsA = makeInputs({ importedDecksById: new Map([['deck-a', deckA]]) })

    const slotB = importedSlot({ importId: 'deck-b' })
    const deckB = makeImportedDeck({
      id: 'deck-b',
      slides: [
        { id: 'b-1', position: 0, contentKind: 'text', body: 'x' } as TextSlide,
        { id: 'b-2', position: 1, contentKind: 'text', body: 'y|z' } as TextSlide,
      ],
    })
    const inputsB = makeInputs({ importedDecksById: new Map([['deck-b', deckB]]) })

    // Sanity: both decks DO collide under the pre-Phase-42 encoding this test
    // guards against, so the assertion below is meaningful rather than
    // vacuous.
    const oldEncoding = (deck: ImportedDeck) => {
      const texts = deck.slides.map((s) => (s.contentKind === 'image' ? s.imageUrl : s.body))
      return `${texts.length}:${texts.join('|')}`
    }
    expect(oldEncoding(deckA)).toBe(oldEncoding(deckB))

    expect(sourceSignature(slotA, inputsA)).not.toBe(sourceSignature(slotB, inputsB))
  })
})

describe('rebuildImportedGroup — render transitions', () => {
  it("D-10: a pending -> ready transition rebuilds exactly once, then rebuilding again against the SAME render document is changed: false", () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeRenderedImportedDeck()
    const pendingInputs = makeRenderInputs(deck, makeRenderDoc({ status: 'pending' }))

    const initial = buildInitialGroup(slot, 'svc-1', pendingInputs)
    const pendingLabeledSlides = initial.slides.map((e, i) =>
      i === 2 ? { ...e, label: 'Custom label (set while pending)', audioUrl: 'https://example.com/pending.mp3' } : e,
    )
    const storedGroup: SlideGroup = makeGroup({ ...initial, slides: pendingLabeledSlides })
    expect(storedGroup.slides).toHaveLength(5)
    const pendingCustomizedEntry = storedGroup.slides[2]!

    const readyInputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }))
    const firstRebuild = rebuildImportedGroup(storedGroup, slot, readyInputs)

    expect(firstRebuild.changed).toBe(true)
    expect(firstRebuild.slides).toHaveLength(5)
    expect(
      firstRebuild.slides.every(
        (e, i) =>
          e.sourceRef.kind === 'imported' && e.sourceRef.innerSlideId === `${RENDERED_PAGE_IDENTITY_PREFIX}${i + 1}`,
      ),
    ).toBe(true)

    // CR-01 (42-REVIEW.md), corrected 2026-08-07: `pending`/`failed` entries
    // key on `deck.slides[i].id`; `ready` entries key on the synthetic
    // `rendered-page-N` string. The two key spaces never overlap, so
    // `carryStoredDerivedEntries` cannot match the stored pending entry to its
    // post-render counterpart — the label/audio a user set while the render
    // was pending is DROPPED, and the entry's own `id` churns, on the very
    // first pending -> ready rebuild. This is the documented (not accidental)
    // behavior; `importedRenderReconciler.ts`'s `importedEntryIdentities` doc
    // comment used to claim the opposite. Asserting it here is what closes
    // the asymmetry with `Assumption A1` below, which pins the ready -> ready
    // case where the SAME identity scheme genuinely does carry customization
    // forward.
    const readyCounterpart = firstRebuild.slides[2]!
    expect(readyCounterpart.id).not.toBe(pendingCustomizedEntry.id)
    expect(readyCounterpart.label).toBeUndefined()
    expect(readyCounterpart.audioUrl).toBeUndefined()

    const rebuiltGroup: SlideGroup = { ...storedGroup, slides: firstRebuild.slides }
    const secondRebuild = rebuildImportedGroup(rebuiltGroup, slot, readyInputs)

    expect(secondRebuild.changed).toBe(false)
    expect(secondRebuild.slides).toEqual(firstRebuild.slides)
  })

  it('D-12: a failed -> ready transition is entry-for-entry identical (sourceRef, order, changed) to the pending -> ready transition', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeRenderedImportedDeck()
    const readyInputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }))

    const pendingInitial = buildInitialGroup(slot, 'svc-1', makeRenderInputs(deck, makeRenderDoc({ status: 'pending' })))
    const pendingStoredGroup: SlideGroup = makeGroup({ ...pendingInitial })
    const pendingToReady = rebuildImportedGroup(pendingStoredGroup, slot, readyInputs)

    const failedInitial = buildInitialGroup(
      slot,
      'svc-1',
      makeRenderInputs(deck, makeRenderDoc({ status: 'failed', failureReason: 'render-timeout' })),
    )
    const failedStoredGroup: SlideGroup = makeGroup({ ...failedInitial })
    const failedToReady = rebuildImportedGroup(failedStoredGroup, slot, readyInputs)

    expect(failedToReady.changed).toBe(pendingToReady.changed)
    expect(failedToReady.slides.map((e) => e.sourceRef)).toEqual(pendingToReady.slides.map((e) => e.sourceRef))
    expect(failedToReady.slides.map((e) => e.order)).toEqual(pendingToReady.slides.map((e) => e.order))
  })

  it('Assumption A1: the rendered-page-N identity is stable enough to carry a per-slide label/audio across a rebuild that leaves renderedCount unchanged', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeRenderedImportedDeck()
    const readyInputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }))

    const initial = buildInitialGroup(slot, 'svc-1', readyInputs)
    const storedGroup: SlideGroup = makeGroup({ ...initial })
    const labeledGroup: SlideGroup = {
      ...storedGroup,
      slides: storedGroup.slides.map((e, i) =>
        i === 2 ? { ...e, label: 'Custom label', audioUrl: 'https://example.com/a.mp3' } : e,
      ),
    }

    // Deriving twice from the SAME (deck, render) produces identical
    // synthetic identities both times — this is Assumption A1 itself.
    const firstDerivation = deriveGroupEntries(slot, readyInputs)
    const secondDerivation = deriveGroupEntries(slot, readyInputs)
    expect(firstDerivation.map((e) => e.sourceRef)).toEqual(secondDerivation.map((e) => e.sourceRef))

    const result = rebuildImportedGroup(labeledGroup, slot, readyInputs)

    expect(result.changed).toBe(false)
    const carried = result.slides[2]!
    expect(carried.id).toBe(labeledGroup.slides[2]!.id)
    expect(carried.label).toBe('Custom label')
    expect(carried.audioUrl).toBe('https://example.com/a.mp3')
  })
})

describe('rebuildImportedGroup — user work survives a render transition', () => {
  it('D-11 / Phase 24 D-02: an authored text entry and a video entry both survive a pending -> ready transition with unchanged ids, audioUrl and notes', () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeRenderedImportedDeck()
    const pendingInputs = makeRenderInputs(deck, makeRenderDoc({ status: 'pending' }))
    const pendingEntries = deriveGroupEntries(slot, pendingInputs)

    const storedGroup: SlideGroup = makeGroup({
      slides: [
        ...pendingEntries,
        {
          id: 'e-authored',
          order: pendingEntries.length,
          sourceRef: { kind: 'text', title: 'My Slide', body: 'My words' },
          audioUrl: 'https://example.com/a.mp3',
          notes: 'Read slowly',
        },
        {
          id: 'e-video',
          order: pendingEntries.length + 1,
          sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' },
        },
      ],
    })

    const readyInputs = makeRenderInputs(deck, makeRenderDoc({ status: 'ready', renderedCount: 5 }))
    const result = rebuildImportedGroup(storedGroup, slot, readyInputs)

    // Unconditional path — there is no confirm gate left to stall this
    // (Phase 30 deleted it): the result is a full rebuilt slide list, not the
    // untouched stored slides.
    expect(result.changed).toBe(true)
    expect(result.slides).toHaveLength(storedGroup.slides.length)

    const authored = result.slides.find((e) => e.id === 'e-authored')
    expect(authored).toBeDefined()
    expect(authored?.sourceRef).toEqual({ kind: 'text', title: 'My Slide', body: 'My words' })
    expect(authored?.audioUrl).toBe('https://example.com/a.mp3')
    expect(authored?.notes).toBe('Read slowly')

    const video = result.slides.find((e) => e.id === 'e-video')
    expect(video).toBeDefined()
    expect(video?.sourceRef).toEqual({ kind: 'video', videoSrc: 'https://example.com/dropped.mp4' })
  })
})
