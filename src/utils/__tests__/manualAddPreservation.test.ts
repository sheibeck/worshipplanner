import { describe, it, expect } from 'vitest'
import {
  deriveGroupEntries,
  sourceSignature,
  rebuildSongGroup,
  rebuildScriptureGroup,
  rebuildImportedGroup,
  rebuildGroup,
} from '@/utils/slideGroupMaterializer'
import { congregationalSectionFromRef } from '@/utils/scripture'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import type { SongSlot, ScriptureSlot, ImportedSlot, NonAssignableSlot } from '@/types/service'
import type { SongLyrics } from '@/types/songLyrics'
import type { ImportedDeck } from '@/types/importedDeck'
import type { TextSlide, CongregationalSection } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import type { Timestamp } from 'firebase/firestore'

/**
 * R107 (Phase 50, Plan 02): a comprehensive preservation suite proving that
 * EVERY rebuild path in `slideGroupMaterializer.ts` — song swap, re-import,
 * every scripture rebuild branch including the scripture<->congregational
 * toggle, and the text-backed no-op path — preserves every manually-added
 * entry (imported PPTX, hand-added text/blank, added media) in its stored
 * position, while only auto-generated (derived) entries actually re-derive.
 *
 * This is a SIBLING to `slideGroupMaterializer.test.ts`, not a replacement —
 * that file already proves the underlying mechanisms (`isSlotDerivableRef`,
 * `survivingEntries`, `carryStoredDerivedEntries`, `orderedByStoredPosition`)
 * individually and in various single-manual-entry combinations (BL-01, BL-02,
 * D-17/T-30-02-01, HI-01). This file proves the SPECIFIC combinations R107's
 * planning read called out: THREE manual entry kinds (imported + authored
 * text + video) together, surviving together, across every rebuild branch —
 * including the ones the existing suite does not yet combine with a manual
 * imported entry: the SONG song-identity swap AND a within-song edit with all
 * three present at once; an IMPORTED group's own re-import while a FOREIGN
 * deck's entry is also present; and every branch of the scripture rebuild
 * state machine (Reference->Congregational convert, Congregational->Reference
 * destroy, Congregational re-split, DETACHED steady state, and CLEARED
 * REFERENCE) with all three manual kinds present together.
 */

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp

function makeInputs(overrides: Partial<AssemblyInputs> = {}): AssemblyInputs {
  return {
    songLyricsById: new Map(),
    scriptureReadingsById: new Map(),
    importedDecksById: new Map(),
    groupsBySlotId: new Map(),
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

function makeSongLyrics(
  songId: string,
  sections: { id: string; label: string; lines: string[] }[],
  performanceOrder: string[],
): SongLyrics {
  return {
    id: `lyrics-${songId}`,
    songId,
    sections,
    copyright: {
      title: 'Song Title',
      authors: ['Author'],
      ccliSongNumber: '12345',
      copyrightLines: ['Public Domain'],
      ccliLicenseNumber: '6789',
    },
    performanceOrder,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  }
}

function makeImportedDeck(overrides: Partial<ImportedDeck> = {}): ImportedDeck {
  return {
    id: 'deck-1',
    sourceFileName: 'announcements.pptx',
    section: 'pre-service',
    slides: [
      { id: 'is-1', position: 0, contentKind: 'text', title: 'Welcome', body: 'Welcome to church' } as TextSlide,
      { id: 'is-2', position: 1, contentKind: 'text', title: 'Second', body: 'Second slide' } as TextSlide,
    ],
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  }
}

// The three manual-add kinds R107 must preserve: an imported entry foreign to
// any deck the owning slot could itself derive, an authored (hand-typed)
// text entry (`title`/`body` set — '＋ Add slide' writes `body: ''`, never
// `undefined`, which is what makes it non-derivable rather than the
// auto-derived payload-free `text` entry), and a dropped video entry.
function manualImportedEntry(
  id: string,
  order: number,
  opts: { importId?: string; innerSlideId?: string } = {},
): GroupSlideEntry {
  return {
    id,
    order,
    sourceRef: { kind: 'imported', importId: opts.importId ?? 'foreign-deck', innerSlideId: opts.innerSlideId ?? 'foreign-1' },
  }
}

function manualTextEntry(id: string, order: number): GroupSlideEntry {
  return { id, order, sourceRef: { kind: 'text', title: 'Hand added', body: '' } }
}

function manualVideoEntry(id: string, order: number): GroupSlideEntry {
  return { id, order, sourceRef: { kind: 'video', videoSrc: 'https://example.com/manual.mp4' } }
}

function manualEntryIds(): string[] {
  return ['e-manual-imported', 'e-manual-text', 'e-manual-video']
}

function assertManualEntriesSurviveByRef(slides: SlideGroup['slides']): void {
  const imported = slides.find((e) => e.id === 'e-manual-imported')
  const text = slides.find((e) => e.id === 'e-manual-text')
  const video = slides.find((e) => e.id === 'e-manual-video')
  expect(imported).toBeDefined()
  expect(text).toBeDefined()
  expect(video).toBeDefined()
  expect(imported!.sourceRef).toEqual({ kind: 'imported', importId: 'foreign-deck', innerSlideId: 'foreign-1' })
  expect(text!.sourceRef).toEqual({ kind: 'text', title: 'Hand added', body: '' })
  expect(video!.sourceRef).toEqual({ kind: 'video', videoSrc: 'https://example.com/manual.mp4' })
}

describe('R107 — SONG group: imported + authored-text + video manual entries survive together', () => {
  function storedSongGroupSlides(songId: string): SlideGroup['slides'] {
    return [
      { id: 'e-copyright-lead', order: 0, sourceRef: { kind: 'copyright', songId } },
      { id: 'e-verse-1', order: 1, sourceRef: { kind: 'lyric', songId, sectionId: 'verse-1' } },
      { id: 'e-chorus', order: 2, sourceRef: { kind: 'lyric', songId, sectionId: 'chorus' } },
      manualImportedEntry('e-manual-imported', 3),
      manualTextEntry('e-manual-text', 4),
      manualVideoEntry('e-manual-video', 5),
      { id: 'e-copyright-trail', order: 6, sourceRef: { kind: 'copyright', songId } },
    ]
  }

  it('within-song section edit: all three manual entries survive, spliced ahead of the trailing copyright, while a new section is actually derived', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-1' })
    const group = makeGroup({ id: 'slot-1', slotId: 'slot-1', slides: storedSongGroupSlides('song-1') })
    const lyrics = makeSongLyrics(
      'song-1',
      [
        { id: 'verse-1', label: 'Verse 1', lines: ['Line A'] },
        { id: 'chorus', label: 'Chorus', lines: ['Line C'] },
        { id: 'bridge', label: 'Bridge', lines: ['Line D'] },
      ],
      ['verse-1', 'chorus', 'bridge'],
    )
    const inputs = makeInputs({ songLyricsById: new Map([['song-1', lyrics]]) })

    const result = rebuildSongGroup(group, slot, inputs)

    expect(result.changed).toBe(true)
    assertManualEntriesSurviveByRef(result.slides)

    // Only the derived side actually re-derived: the new Bridge section
    // exists, proving this is not merely "nothing changed."
    const bridgeEntry = result.slides.find((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'bridge')
    expect(bridgeEntry).toBeDefined()

    const trailingIndex = result.slides.length - 1
    expect(result.slides[trailingIndex]!.sourceRef.kind).toBe('copyright')
    for (const id of manualEntryIds()) {
      expect(result.slides.findIndex((e) => e.id === id)).toBeLessThan(trailingIndex)
    }
  })

  it('full song-identity swap: all three manual entries survive spliced ahead of the trailing copyright, while every lyric/copyright entry now references only the new song', () => {
    const slot = songSlot({ id: 'slot-1', songId: 'song-b' })
    const group = makeGroup({ id: 'slot-1', slotId: 'slot-1', slides: storedSongGroupSlides('song-1') })
    const lyricsB = makeSongLyrics('song-b', [{ id: 'verse-1-b', label: 'Verse 1', lines: ['B line'] }], ['verse-1-b'])
    const inputs = makeInputs({ songLyricsById: new Map([['song-b', lyricsB]]) })

    const result = rebuildSongGroup(group, slot, inputs)

    expect(result.changed).toBe(true)
    assertManualEntriesSurviveByRef(result.slides)

    // Only derived re-derives: every lyric/copyright entry now points at the
    // NEW song — no blended song-1 leftovers among the derived entries.
    const songRefEntries = result.slides.filter(
      (e): e is typeof e & { sourceRef: { songId: string } } => e.sourceRef.kind === 'lyric' || e.sourceRef.kind === 'copyright',
    )
    expect(songRefEntries.length).toBeGreaterThan(0)
    expect(songRefEntries.every((e) => e.sourceRef.songId === 'song-b')).toBe(true)
    expect(result.slides.some((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'verse-1-b')).toBe(true)

    const trailingIndex = result.slides.length - 1
    expect(result.slides[trailingIndex]!.sourceRef.kind).toBe('copyright')
    for (const id of manualEntryIds()) {
      expect(result.slides.findIndex((e) => e.id === id)).toBeLessThan(trailingIndex)
    }
  })
})

describe('R107 — IMPORTED group: own-deck re-import with a foreign-deck + text + video manual entries present', () => {
  it("re-importing the slot's own deck mints fresh innerSlideIds while a foreign-deck entry, an authored-text entry, and a video entry all survive byte-identical", () => {
    const slot = importedSlot({ importId: 'deck-1' })
    const deck = makeImportedDeck()
    const inputs = makeInputs({ importedDecksById: new Map([['deck-1', deck]]) })
    const derived = deriveGroupEntries(slot, inputs) // is-1, is-2 on deck-1
    const group = makeGroup({
      sourceSignature: sourceSignature(slot, inputs),
      slides: [
        ...derived,
        manualImportedEntry('e-manual-imported', 2, { importId: 'deck-foreign', innerSlideId: 'f-1' }),
        manualTextEntry('e-manual-text', 3),
        manualVideoEntry('e-manual-video', 4),
      ],
    })

    const reimportedDeck = makeImportedDeck({
      slides: [{ id: 'fresh-1', position: 0, contentKind: 'text', title: 'Fresh', body: 'Fresh body' } as TextSlide],
    })
    const reimportedInputs = makeInputs({ importedDecksById: new Map([['deck-1', reimportedDeck]]) })

    const result = rebuildImportedGroup(group, slot, reimportedInputs)

    expect(result.changed).toBe(true)
    // The text and video manual entries use the shared defaults; the
    // imported manual entry here deliberately overrides importId/innerSlideId
    // to model a genuinely FOREIGN deck, so it is asserted separately below.
    const text = result.slides.find((e) => e.id === 'e-manual-text')
    const video = result.slides.find((e) => e.id === 'e-manual-video')
    expect(text?.sourceRef).toEqual({ kind: 'text', title: 'Hand added', body: '' })
    expect(video?.sourceRef).toEqual({ kind: 'video', videoSrc: 'https://example.com/manual.mp4' })

    // Only the slot's OWN deck's derived entries actually re-derived: the
    // stale is-1/is-2 are gone, the fresh deck's own slide is present.
    const ownDeckIds = result.slides
      .filter((e) => e.sourceRef.kind === 'imported' && e.sourceRef.importId === 'deck-1')
      .map((e) => (e.sourceRef as { innerSlideId: string }).innerSlideId)
    expect(ownDeckIds).toEqual(['fresh-1'])

    // The foreign deck's entry is untouched — same id, same sourceRef.
    const foreignEntry = result.slides.find((e) => e.id === 'e-manual-imported')
    expect(foreignEntry?.sourceRef).toEqual({ kind: 'imported', importId: 'deck-foreign', innerSlideId: 'f-1' })
  })
})

describe('R107 — SCRIPTURE group: imported + authored-text + video manual entries survive every rebuild branch', () => {
  const threeSections: CongregationalSection[] = [
    { speaker: 'LEADER', text: 'The Lord is my shepherd;' },
    { speaker: 'CONGREGATION', text: 'I shall not want.' },
    { speaker: 'LEADER', text: 'He leads me beside still waters.' },
  ]

  function manualEntriesAt(startOrder: number): SlideGroup['slides'] {
    return [
      manualImportedEntry('e-manual-imported', startOrder),
      manualTextEntry('e-manual-text', startOrder + 1),
      manualVideoEntry('e-manual-video', startOrder + 2),
    ]
  }

  it('Reference -> Congregational (first conversion): manual entries survive; the derived reference entry becomes three section entries', () => {
    const referenceSlot = scriptureSlot()
    const inputs = makeInputs()
    const referenceEntries = deriveGroupEntries(referenceSlot, inputs)
    const group = makeGroup({
      sourceSignature: sourceSignature(referenceSlot, inputs),
      slides: [...referenceEntries, ...manualEntriesAt(1)],
    })

    const congregationalSlot = scriptureSlot({ congregationalSections: threeSections })
    const result = rebuildScriptureGroup(group, congregationalSlot, inputs)

    expect(result.changed).toBe(true)
    assertManualEntriesSurviveByRef(result.slides)

    const scriptureEntries = result.slides.filter((e) => e.sourceRef.kind === 'scripture')
    expect(scriptureEntries).toHaveLength(3)
    expect(scriptureEntries.map((e) => congregationalSectionFromRef(e.sourceRef)?.text)).toEqual(
      threeSections.map((s) => s.text),
    )
  })

  it('Congregational -> Reference (DESTROY): manual entries survive; the three section entries collapse to exactly one reference entry', () => {
    const congregationalSlot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const congregationalEntries = deriveGroupEntries(congregationalSlot, inputs)
    const group = makeGroup({
      sourceSignature: sourceSignature(congregationalSlot, inputs),
      slides: [...congregationalEntries, ...manualEntriesAt(3)],
    })

    const newPassageSlot = scriptureSlot({ book: 'Psalms', chapter: 100, verseStart: 1, verseEnd: 5 })
    const result = rebuildScriptureGroup(group, newPassageSlot, inputs)

    expect(result.changed).toBe(true)
    assertManualEntriesSurviveByRef(result.slides)

    const scriptureEntries = result.slides.filter((e) => e.sourceRef.kind === 'scripture')
    expect(scriptureEntries).toHaveLength(1)
    expect(scriptureEntries[0]!.sourceRef).toEqual({ kind: 'scripture' })
  })

  it('Congregational re-split (3 sections -> 2): manual entries survive; section entries REPLACE rather than grow (no compounding)', () => {
    const congregationalSlot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const congregationalEntries = deriveGroupEntries(congregationalSlot, inputs)
    const group = makeGroup({
      sourceSignature: sourceSignature(congregationalSlot, inputs),
      slides: [...congregationalEntries, ...manualEntriesAt(3)],
    })

    const twoSections: CongregationalSection[] = [
      { speaker: 'LEADER', text: 'Reworded first half.' },
      { speaker: 'CONGREGATION', text: 'Reworded second half.' },
    ]
    const resplitSlot = scriptureSlot({ congregationalSections: twoSections })
    const result = rebuildScriptureGroup(group, resplitSlot, inputs)

    expect(result.changed).toBe(true)
    assertManualEntriesSurviveByRef(result.slides)

    const scriptureEntries = result.slides.filter((e) => e.sourceRef.kind === 'scripture')
    expect(scriptureEntries).toHaveLength(2) // not 5 — replace, not grow
    expect(scriptureEntries.map((e) => congregationalSectionFromRef(e.sourceRef)?.text)).toEqual(
      twoSections.map((s) => s.text),
    )

    // A second pass over the re-split result is a no-op — no further growth.
    const regrouped = makeGroup({ sourceSignature: sourceSignature(resplitSlot, inputs), slides: result.slides })
    const secondPass = rebuildScriptureGroup(regrouped, resplitSlot, inputs)
    expect(secondPass.changed).toBe(false)
    expect(secondPass.slides.filter((e) => e.sourceRef.kind === 'scripture')).toHaveLength(2)
  })

  it('DETACHED steady state (stored signature matches the current reading): stored slides, including all three manual entries, are returned byte-untouched', () => {
    const congregationalSlot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const congregationalEntries = deriveGroupEntries(congregationalSlot, inputs)
    const group = makeGroup({
      sourceSignature: sourceSignature(congregationalSlot, inputs),
      slides: [...congregationalEntries, ...manualEntriesAt(3)],
    })

    const result = rebuildScriptureGroup(group, congregationalSlot, inputs)

    expect(result.changed).toBe(false)
    expect(result.slides).toBe(group.slides)
    assertManualEntriesSurviveByRef(result.slides)
  })

  it('CLEARED REFERENCE (reference removed entirely): section entries drop to zero, manual entries survive, and the result carries sourceSignature: null', () => {
    const congregationalSlot = scriptureSlot({ congregationalSections: threeSections })
    const inputs = makeInputs()
    const congregationalEntries = deriveGroupEntries(congregationalSlot, inputs)
    const group = makeGroup({
      sourceSignature: sourceSignature(congregationalSlot, inputs),
      slides: [...congregationalEntries, ...manualEntriesAt(3)],
    })

    const clearedSlot = scriptureSlot({ book: null, chapter: null, verseStart: null, verseEnd: null })
    const result = rebuildScriptureGroup(group, clearedSlot, inputs)

    expect(result.changed).toBe(true)
    expect(result.sourceSignature).toBeNull()
    assertManualEntriesSurviveByRef(result.slides)

    const scriptureEntries = result.slides.filter((e) => e.sourceRef.kind === 'scripture')
    expect(scriptureEntries).toHaveLength(0)
  })
})

describe('R107 — PRAYER (text-backed) group holding a hand-added imported entry', () => {
  it('rebuildGroup returns changed: false and the imported entry is byte-untouched', () => {
    const slot: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-0', position: 0 }
    const group = makeGroup({
      slides: [{ id: 'e-text', order: 0, sourceRef: { kind: 'text' } }, manualImportedEntry('e-manual-imported', 1)],
    })

    const result = rebuildGroup(group, slot, makeInputs())

    expect(result.changed).toBe(false)
    expect(result.slides).toEqual(group.slides)
    const importedEntry = result.slides.find((e) => e.id === 'e-manual-imported')
    expect(importedEntry?.sourceRef).toEqual({ kind: 'imported', importId: 'foreign-deck', innerSlideId: 'foreign-1' })
  })
})
