import { describe, it, expect } from 'vitest'
import {
  BIBLE_BOOKS,
  esvLink,
  nltLink,
  scriptureWebLink,
  bibleGatewayLink,
  scripturesOverlap,
  parseScriptureInput,
  formatScriptureReference,
  scriptureRefFromSlot,
  congregationalSectionsFromSlot,
  congregationalSectionFromRef,
  scriptureSlotAfterReferenceChange,
  scriptureAttribution,
  resolveTranslationSource,
} from '@/utils/scripture'
import type { ScriptureRef, ScriptureSlot } from '@/types/service'
import type { CongregationalSection } from '@/types/slide'
import type { SourceRef } from '@/types/slideGroup'

function makeSlot(overrides: Partial<ScriptureSlot> = {}): ScriptureSlot {
  return {
    kind: 'SCRIPTURE',
    id: 'slot-0',
    position: 0,
    book: 'John',
    chapter: 3,
    verseStart: 16,
    verseEnd: 18,
    ...overrides,
  }
}

// R047: these two are the whole source chain for a scripture slide — the slot's
// reference in, the projected string out. No reading document in between.
describe('formatScriptureReference', () => {
  it('renders a verse range', () => {
    expect(formatScriptureReference({ book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 })).toBe('Romans 8:1-11')
  })

  it('renders a single verse without a spurious range', () => {
    expect(formatScriptureReference({ book: 'Romans', chapter: 8, verseStart: 28 })).toBe('Romans 8:28')
  })

  it('renders a whole chapter', () => {
    expect(formatScriptureReference({ book: 'Psalms', chapter: 23 })).toBe('Psalms 23')
  })

  it('round-trips what parseScriptureInput produces', () => {
    const parsed = parseScriptureInput('Psalms 103:1-5')!
    expect(formatScriptureReference(parsed)).toBe('Psalms 103:1-5')
  })

  // HI-02: `verseEnd === verseStart` is reachable — `parseScriptureInput`
  // produces it for "John 3:16-16" (Math.min/Math.max over [16,16]), and
  // `ScriptureInput.onSelectAiScripture` writes whatever the AI returns. The
  // rail, the grid header and the drawer context line all collapsed that case;
  // only this formatter (and therefore the projected slide and the Planning
  // Center plan title) spelled it out as a degenerate range.
  it('collapses a degenerate range to a single verse', () => {
    expect(formatScriptureReference({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 })).toBe('John 3:16')
  })

  it('collapses what parseScriptureInput makes of a typed degenerate range', () => {
    const parsed = parseScriptureInput('John 3:16-16')!
    expect(parsed.verseStart).toBe(16)
    expect(parsed.verseEnd).toBe(16)
    expect(formatScriptureReference(parsed)).toBe('John 3:16')
  })
})

describe('scriptureRefFromSlot', () => {
  it('reads the slot\'s own reference fields', () => {
    expect(scriptureRefFromSlot(makeSlot())).toEqual({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 18 })
  })

  it('accepts a whole-chapter reference — verses are optional', () => {
    expect(scriptureRefFromSlot(makeSlot({ verseStart: null, verseEnd: null }))).toEqual({ book: 'John', chapter: 3 })
  })

  it('omits an absent verseEnd rather than emitting null', () => {
    const ref = scriptureRefFromSlot(makeSlot({ verseEnd: null }))
    expect(ref).toEqual({ book: 'John', chapter: 3, verseStart: 16 })
    expect(ref).not.toHaveProperty('verseEnd')
  })

  it('returns null when the reference has not been filled in — this is what derives zero slides', () => {
    expect(scriptureRefFromSlot(makeSlot({ book: null }))).toBeNull()
    expect(scriptureRefFromSlot(makeSlot({ chapter: null }))).toBeNull()
    expect(scriptureRefFromSlot(makeSlot({ book: null, chapter: null, verseStart: null, verseEnd: null }))).toBeNull()
  })
})

describe('BIBLE_BOOKS', () => {
  it('contains exactly 66 books', () => {
    expect(BIBLE_BOOKS).toHaveLength(66)
  })

  it('starts with Genesis', () => {
    expect(BIBLE_BOOKS[0]).toBe('Genesis')
  })

  it('ends with Revelation', () => {
    expect(BIBLE_BOOKS[65]).toBe('Revelation')
  })

  it('contains Psalms', () => {
    expect(BIBLE_BOOKS).toContain('Psalms')
  })

  it('contains John', () => {
    expect(BIBLE_BOOKS).toContain('John')
  })
})

describe('esvLink', () => {
  it('generates correct URL for Psalm 23', () => {
    expect(esvLink('Psalm', 23)).toBe('https://www.esv.org/Psalm+23')
  })

  it('generates correct URL for 1 John 3 (spaces become +)', () => {
    expect(esvLink('1 John', 3)).toBe('https://www.esv.org/1+John+3')
  })

  it('generates correct URL for John 3', () => {
    expect(esvLink('John', 3)).toBe('https://www.esv.org/John+3')
  })

  it('handles single-word book names', () => {
    expect(esvLink('Romans', 8)).toBe('https://www.esv.org/Romans+8')
  })

  it('handles books with numbers (e.g., 2 Corinthians)', () => {
    expect(esvLink('2 Corinthians', 5)).toBe('https://www.esv.org/2+Corinthians+5')
  })
})

describe('nltLink', () => {
  it('points at BibleGateway with the NLT version param', () => {
    expect(nltLink('John', 3)).toBe(
      'https://www.biblegateway.com/passage/?search=John%203&version=NLT',
    )
  })

  it('URL-encodes multi-word book names', () => {
    expect(nltLink('1 John', 3)).toBe(
      'https://www.biblegateway.com/passage/?search=1%20John%203&version=NLT',
    )
  })
})

describe('scriptureWebLink', () => {
  it('routes ESV to esv.org', () => {
    expect(scriptureWebLink('John', 3, 'ESV')).toBe('https://www.esv.org/John+3')
  })

  it('routes NLT to BibleGateway', () => {
    expect(scriptureWebLink('John', 3, 'NLT')).toBe(
      'https://www.biblegateway.com/passage/?search=John%203&version=NLT',
    )
  })
})

// R298: the manual fallback deep-link, usable with ANY version — not tied
// to the ESV/NLT scriptureWebLink pair above.
describe('bibleGatewayLink', () => {
  it('builds a verse-range search with the version param', () => {
    expect(bibleGatewayLink({ book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 }, 'NLT')).toBe(
      'https://www.biblegateway.com/passage/?search=Romans%208%3A1-11&version=NLT',
    )
  })

  it('omits &version= when no version is supplied', () => {
    const url = bibleGatewayLink({ book: 'Romans', chapter: 8, verseStart: 28 })
    expect(url).toBe('https://www.biblegateway.com/passage/?search=Romans%208%3A28')
    expect(url).not.toContain('&version=')
  })

  it('builds a chapter-only search with the version param', () => {
    expect(bibleGatewayLink({ book: 'Romans', chapter: 8 }, 'ESV')).toBe(
      'https://www.biblegateway.com/passage/?search=Romans%208&version=ESV',
    )
  })

  it('URL-encodes a multi-word book name', () => {
    const url = bibleGatewayLink({ book: '1 Corinthians', chapter: 13, verseStart: 4, verseEnd: 7 })
    expect(url).toBe('https://www.biblegateway.com/passage/?search=1%20Corinthians%2013%3A4-7')
  })

  it('treats an empty-string version as absent', () => {
    const url = bibleGatewayLink({ book: 'Romans', chapter: 8, verseStart: 28 }, '')
    expect(url).not.toContain('&version=')
  })
})

describe('scripturesOverlap', () => {
  it('returns true when same book, same chapter, overlapping verse ranges', () => {
    const reading: ScriptureRef = { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 6 }
    const sermon: ScriptureRef = { book: 'Psalm', chapter: 23, verseStart: 4, verseEnd: 10 }
    expect(scripturesOverlap(reading, sermon)).toBe(true)
  })

  it('returns true when verse ranges are identical', () => {
    const reading: ScriptureRef = { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 }
    const sermon: ScriptureRef = { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 }
    expect(scripturesOverlap(reading, sermon)).toBe(true)
  })

  it('returns true when reading contains sermon', () => {
    const reading: ScriptureRef = { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 39 }
    const sermon: ScriptureRef = { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 30 }
    expect(scripturesOverlap(reading, sermon)).toBe(true)
  })

  it('returns false when different books', () => {
    const reading: ScriptureRef = { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 6 }
    const sermon: ScriptureRef = { book: 'John', chapter: 23, verseStart: 1, verseEnd: 6 }
    expect(scripturesOverlap(reading, sermon)).toBe(false)
  })

  it('returns false when different chapters', () => {
    const reading: ScriptureRef = { book: 'John', chapter: 3, verseStart: 1, verseEnd: 21 }
    const sermon: ScriptureRef = { book: 'John', chapter: 4, verseStart: 1, verseEnd: 21 }
    expect(scripturesOverlap(reading, sermon)).toBe(false)
  })

  it('returns false when non-overlapping verse ranges', () => {
    const reading: ScriptureRef = { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 3 }
    const sermon: ScriptureRef = { book: 'Psalm', chapter: 23, verseStart: 4, verseEnd: 6 }
    expect(scripturesOverlap(reading, sermon)).toBe(false)
  })

  it('returns true when verse ranges are adjacent at boundary (touching)', () => {
    // verseStart <= sermon.verseEnd (4 <= 4) && verseEnd >= sermon.verseStart (4 >= 4)
    const reading: ScriptureRef = { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 4 }
    const sermon: ScriptureRef = { book: 'Psalm', chapter: 23, verseStart: 4, verseEnd: 8 }
    expect(scripturesOverlap(reading, sermon)).toBe(true)
  })
})

describe('parseScriptureInput', () => {
  it('returns null for empty string', () => {
    expect(parseScriptureInput('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(parseScriptureInput('   ')).toBeNull()
  })

  it('returns null for book only (no chapter)', () => {
    expect(parseScriptureInput('John')).toBeNull()
  })

  it('returns null for partial/unrecognized book name', () => {
    expect(parseScriptureInput('joh 3:16')).toBeNull()
  })

  it('parses "Isaiah 53:1-6" correctly', () => {
    expect(parseScriptureInput('Isaiah 53:1-6')).toEqual({
      book: 'Isaiah',
      chapter: 53,
      verseStart: 1,
      verseEnd: 6,
    })
  })

  it('parses "Psalm 23" (chapter only, no verses)', () => {
    expect(parseScriptureInput('Psalm 23')).toEqual({
      book: 'Psalms',
      chapter: 23,
    })
  })

  it('parses "Romans 8:28" (single verse, no verseEnd)', () => {
    expect(parseScriptureInput('Romans 8:28')).toEqual({
      book: 'Romans',
      chapter: 8,
      verseStart: 28,
    })
  })

  it('parses "John 1:1-10,15-20" (multi-range: outer range)', () => {
    expect(parseScriptureInput('John 1:1-10,15-20')).toEqual({
      book: 'John',
      chapter: 1,
      verseStart: 1,
      verseEnd: 20,
    })
  })

  it('parses "John 1:1-2,6-9" (multi-range with comma: min/max outer range)', () => {
    expect(parseScriptureInput('John 1:1-2,6-9')).toEqual({
      book: 'John',
      chapter: 1,
      verseStart: 1,
      verseEnd: 9,
    })
  })

  it('parses "1 Corinthians 13:4-7" (numbered book)', () => {
    expect(parseScriptureInput('1 Corinthians 13:4-7')).toEqual({
      book: '1 Corinthians',
      chapter: 13,
      verseStart: 4,
      verseEnd: 7,
    })
  })

  it('parses "Song of Solomon 2:1" (multi-word book)', () => {
    expect(parseScriptureInput('Song of Solomon 2:1')).toEqual({
      book: 'Song of Solomon',
      chapter: 2,
      verseStart: 1,
    })
  })

  it('exact match wins: "John 3:16" resolves to John not 1/2/3 John', () => {
    const result = parseScriptureInput('John 3:16')
    expect(result?.book).toBe('John')
  })

  it('"1 john 4:8" resolves to "1 John" (case-insensitive)', () => {
    const result = parseScriptureInput('1 john 4:8')
    expect(result?.book).toBe('1 John')
  })

  it('case-insensitive exact match: "psalms 23" resolves to Psalms', () => {
    const result = parseScriptureInput('psalms 23')
    expect(result?.book).toBe('Psalms')
  })

  it('returns null for ambiguous prefix with multiple matches (no exact match)', () => {
    // 'Samuel' is ambiguous: matches '1 Samuel' and '2 Samuel' by prefix, no exact match
    expect(parseScriptureInput('Samuel 1:1')).toBeNull()
  })

  it('returns the canonical book casing', () => {
    const result = parseScriptureInput('isaiah 53:1')
    expect(result?.book).toBe('Isaiah')
  })
})

function makeSection(overrides: Partial<CongregationalSection> = {}): CongregationalSection {
  return {
    speaker: 'LEADER',
    text: 'The Lord is my shepherd;',
    ...overrides,
  }
}

// R064/D1: congregationalSectionsFromSlot is the ONE congregational-ness
// predicate on the SLOT side. Every case here backstops the byte-exactness
// claim the materializer/assembler tests depend on.
describe('congregationalSectionsFromSlot', () => {
  it('returns [] for a slot with no congregationalSections', () => {
    const slot = makeSlot({ congregationalSections: undefined })
    expect(congregationalSectionsFromSlot(slot)).toEqual([])
  })

  it('returns [] for an empty congregationalSections array', () => {
    const slot = makeSlot({ congregationalSections: [] })
    expect(congregationalSectionsFromSlot(slot)).toEqual([])
  })

  it('returns the stored array itself — same reference, same order, no copying — when non-empty', () => {
    const sections = [
      makeSection({ speaker: 'LEADER', text: 'One' }),
      makeSection({ speaker: 'CONGREGATION', text: 'Two' }),
      makeSection({ speaker: 'LEADER', text: 'Three' }),
    ]
    const slot = makeSlot({ congregationalSections: sections })
    const result = congregationalSectionsFromSlot(slot)
    expect(result).toBe(sections)
    expect(result.map((s) => s.text)).toEqual(['One', 'Two', 'Three'])
  })

  it('two adjacent sections sharing the same speaker are both returned, unmerged', () => {
    const sections = [
      makeSection({ speaker: 'CONGREGATION', text: 'Part A' }),
      makeSection({ speaker: 'CONGREGATION', text: 'Part B' }),
    ]
    const slot = makeSlot({ congregationalSections: sections })
    const result = congregationalSectionsFromSlot(slot)
    expect(result).toHaveLength(2)
    expect(result[0]!.speaker).toBe('CONGREGATION')
    expect(result[1]!.speaker).toBe('CONGREGATION')
  })

  it('a section containing curly quotes and an em dash round-trips with strict === equality', () => {
    const text = '‘He restores my soul’ — “he leads me”'
    const sections = [makeSection({ text })]
    const slot = makeSlot({ congregationalSections: sections })
    const result = congregationalSectionsFromSlot(slot)
    expect(result[0]!.text === text).toBe(true)
  })

  it('source inspection: performs no string-transforming or array-reordering operation', () => {
    const src = congregationalSectionsFromSlot.toString()
    expect(src).not.toMatch(/\.normalize\(/)
    expect(src).not.toMatch(/\.trim\(/)
    expect(src).not.toMatch(/\.replace\(/)
    expect(src).not.toMatch(/\.toLowerCase\(/)
    expect(src).not.toMatch(/\.toUpperCase\(/)
    expect(src).not.toMatch(/\.sort\(/)
    expect(src).not.toMatch(/\.map\(/)
    expect(src).not.toMatch(/\.filter\(/)
    expect(src).not.toMatch(/\.slice\(/)
    expect(src).not.toMatch(/\.concat\(/)
    expect(src).not.toMatch(/\[\s*\.\.\./)
  })
})

// R064/D1: congregationalSectionFromRef is the mirror predicate on the ENTRY
// side — the ONLY place any consumer decides whether a stored GroupSlideEntry
// is a congregational section slide.
describe('congregationalSectionFromRef', () => {
  it('returns null for every non-scripture ref', () => {
    const refs: SourceRef[] = [
      { kind: 'lyric', songId: 'song-1', sectionId: 'verse-1' },
      { kind: 'copyright', songId: 'song-1' },
      { kind: 'imported', importId: 'import-1', innerSlideId: 'inner-1' },
      { kind: 'text' },
      { kind: 'video', videoSrc: 'https://example.com/v.mp4' },
    ]
    for (const ref of refs) {
      expect(congregationalSectionFromRef(ref)).toBeNull()
    }
  })

  it('returns null for a payload-free scripture ref', () => {
    expect(congregationalSectionFromRef({ kind: 'scripture' })).toBeNull()
  })

  it('returns null for a legacy scripture ref carrying only scriptureReadingId/innerSlideId', () => {
    const ref: SourceRef = { kind: 'scripture', scriptureReadingId: 'reading-1', innerSlideId: 'scripture-0' }
    expect(congregationalSectionFromRef(ref)).toBeNull()
  })

  it('returns the reconstructed CongregationalSection when the ref carries a speaker', () => {
    const ref: SourceRef = { kind: 'scripture', speaker: 'LEADER', text: 'The Lord is my shepherd;' }
    expect(congregationalSectionFromRef(ref)).toEqual({ speaker: 'LEADER', text: 'The Lord is my shepherd;' })
  })

  it('a section reconstructed from a ref carrying a verseRange has that verseRange', () => {
    const ref: SourceRef = { kind: 'scripture', speaker: 'CONGREGATION', text: 'I shall not want.', verseRange: '1' }
    const section = congregationalSectionFromRef(ref)
    expect(section?.verseRange).toBe('1')
  })

  it('a section reconstructed from a ref with no verseRange has no verseRange key at all', () => {
    const ref: SourceRef = { kind: 'scripture', speaker: 'LEADER', text: 'No range here' }
    const section = congregationalSectionFromRef(ref)
    expect(Object.prototype.hasOwnProperty.call(section, 'verseRange')).toBe(false)
  })

  it('a ref carrying a speaker but no text reconstructs to an empty string, not undefined', () => {
    const ref: SourceRef = { kind: 'scripture', speaker: 'LEADER' }
    expect(congregationalSectionFromRef(ref)).toEqual({ speaker: 'LEADER', text: '' })
  })

  // IN-02 (47-REVIEW): defense-in-depth — a consumer that treats this
  // return value as a COMPLETE CongregationalSection should not silently
  // lose translation provenance.
  it('a section reconstructed from a ref carrying a translationSource has that translationSource', () => {
    const ref: SourceRef = {
      kind: 'scripture',
      speaker: 'CONGREGATION',
      text: 'for his steadfast love endures forever.',
      translationSource: 'NLT',
    }
    expect(congregationalSectionFromRef(ref)).toEqual({
      speaker: 'CONGREGATION',
      text: 'for his steadfast love endures forever.',
      translationSource: 'NLT',
    })
  })

  it('a section reconstructed from a ref with no translationSource has no translationSource key at all', () => {
    const ref: SourceRef = { kind: 'scripture', speaker: 'LEADER', text: 'No translation source here' }
    const section = congregationalSectionFromRef(ref)
    expect(Object.prototype.hasOwnProperty.call(section, 'translationSource')).toBe(false)
  })

  it('round trip: a three-section fixture including curly quotes and an em dash reconstructs with strictly === equal text', () => {
    const sections: CongregationalSection[] = [
      { speaker: 'LEADER', text: 'One' },
      { speaker: 'CONGREGATION', text: '‘He restores my soul’ — “he leads me”' },
      { speaker: 'LEADER', text: 'Three', verseRange: '3' },
    ]
    for (const section of sections) {
      const ref: SourceRef = {
        kind: 'scripture',
        speaker: section.speaker,
        text: section.text,
        ...(section.verseRange !== undefined ? { verseRange: section.verseRange } : {}),
      }
      const reconstructed = congregationalSectionFromRef(ref)
      expect(reconstructed?.text === section.text).toBe(true)
      expect(reconstructed).toEqual(section)
    }
  })
})

// R064: the stale-reading clearing rule — a stored congregational reading is
// never carried onto a passage it was not derived from.
describe('scriptureSlotAfterReferenceChange', () => {
  it('writes book/chapter/verseStart/verseEnd from the incoming ref, using null where the ref omits them', () => {
    const slot = makeSlot({ book: null, chapter: null, verseStart: null, verseEnd: null })
    const result = scriptureSlotAfterReferenceChange(slot, { book: 'Psalms', chapter: 23 })
    expect(result.book).toBe('Psalms')
    expect(result.chapter).toBe(23)
    expect(result.verseStart).toBeNull()
    expect(result.verseEnd).toBeNull()
  })

  it('preserves every other field on the slot', () => {
    const slot = makeSlot({ section: 'worship', id: 'slot-42' })
    const result = scriptureSlotAfterReferenceChange(slot, { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 })
    expect(result.section).toBe('worship')
    expect(result.id).toBe('slot-42')
  })

  it('a slot holding sections derived from Psalm 136:1-9, changed to Psalm 24, comes back with no congregationalSections key at all', () => {
    const sections = [makeSection()]
    const slot = makeSlot({ book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 9, congregationalSections: sections })
    const result = scriptureSlotAfterReferenceChange(slot, { book: 'Psalms', chapter: 24 })
    expect(Object.prototype.hasOwnProperty.call(result, 'congregationalSections')).toBe(false)
  })

  it('the same slot re-set to the identical reference leaves congregationalSections deep-equal to its original value', () => {
    const sections = [makeSection()]
    const slot = makeSlot({ book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 9, congregationalSections: sections })
    const result = scriptureSlotAfterReferenceChange(slot, { book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 9 })
    expect(result.congregationalSections).toEqual(sections)
  })

  it('clearing the reference entirely (a null ref) also drops congregationalSections', () => {
    const sections = [makeSection()]
    const slot = makeSlot({ book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 9, congregationalSections: sections })
    const result = scriptureSlotAfterReferenceChange(slot, null)
    expect(Object.prototype.hasOwnProperty.call(result, 'congregationalSections')).toBe(false)
    expect(result.book).toBeNull()
    expect(result.chapter).toBeNull()
  })

  it('a slot with no congregationalSections gains no such key from any reference change', () => {
    const slot = makeSlot({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 18 })
    const result = scriptureSlotAfterReferenceChange(slot, { book: 'Psalms', chapter: 24 })
    expect(Object.prototype.hasOwnProperty.call(result, 'congregationalSections')).toBe(false)
  })
})

// R091 (Phase 45): initials-only attribution, shared by every render site —
// CONTEXT.md Area 2 "build once, shared". No full copyright notice, ever.
describe('scriptureAttribution', () => {
  it("returns '(ESV)' for the ESV version", () => {
    expect(scriptureAttribution('ESV')).toBe('(ESV)')
  })

  it("returns '(NLT)' for the NLT version", () => {
    expect(scriptureAttribution('NLT')).toBe('(NLT)')
  })

  it('emits parenthesized initials only — no full copyright notice text', () => {
    expect(scriptureAttribution('ESV')).not.toMatch(/English Standard|copyright|Crossway/i)
    expect(scriptureAttribution('NLT')).not.toMatch(/New Living|copyright|Tyndale/i)
  })
})

// R092 (Phase 45): the ONE field-less-fallback decision point. This is the
// single most important test in the whole phase — see 45-RESEARCH.md § Don't
// Hand-Roll #4 and the "T-45-31" threat register entry in 45-03-PLAN.md.
describe('resolveTranslationSource', () => {
  it("returns 'NLT' when the slide carries translationSource: 'NLT'", () => {
    expect(resolveTranslationSource({ translationSource: 'NLT' })).toBe('NLT')
  })

  it("returns 'ESV' when the slide carries translationSource: 'ESV'", () => {
    expect(resolveTranslationSource({ translationSource: 'ESV' })).toBe('ESV')
  })

  it("returns 'ESV' — the hardcoded fallback — for a field-less pre-phase slide, independent of any org setting", () => {
    expect(resolveTranslationSource({})).toBe('ESV')
  })

  it("returns 'ESV' for a slide whose translationSource is explicitly undefined", () => {
    expect(resolveTranslationSource({ translationSource: undefined })).toBe('ESV')
  })

  // T-45-31: proves the correctness guarantee by source inspection, not just
  // by behavior — a future edit that adds `authStore`/`OrgSettings` back into
  // this function's own body would trip this test even if some clever import
  // alias hid it from a plain text search of the module's import list.
  it('never references authStore/OrgSettings/DEFAULT_ORG_SETTINGS in its own function body', () => {
    const src = resolveTranslationSource.toString()
    expect(src).not.toMatch(/authStore/)
    expect(src).not.toMatch(/OrgSettings/)
    expect(src).not.toMatch(/DEFAULT_ORG_SETTINGS/)
    expect(src).not.toMatch(/bibleVersion/)
  })

  // Belt-and-suspenders: also assert the whole module file never imports the
  // auth store or org-settings types at all, so a future edit cannot smuggle
  // a setting-read in through a module-level import used elsewhere in the
  // function (the .toString() check above only sees this function's body).
  it('the scripture.ts module imports no authStore / organization settings module at all', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const source = fs.readFileSync(path.resolve(__dirname, '../scripture.ts'), 'utf-8')
    expect(source).not.toMatch(/from ['"].*authStore['"]/)
    expect(source).not.toMatch(/from ['"].*\/organization['"]/)
    expect(source).not.toMatch(/useAuthStore/)
  })
})
