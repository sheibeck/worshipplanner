import { describe, it, expect } from 'vitest'
import {
  BIBLE_BOOKS,
  esvLink,
  scripturesOverlap,
  parseScriptureInput,
  formatScriptureReference,
  scriptureRefFromSlot,
  congregationalSlideFieldsFromSlot,
  scriptureSlotAfterReferenceChange,
} from '@/utils/scripture'
import type { ScriptureRef, ScriptureSlot } from '@/types/service'
import type { CongregationalSection } from '@/types/slide'

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

// R064: congregationalSlideFieldsFromSlot is the ONE congregational-ness
// predicate in the slot -> slide path. Every case here backstops the
// byte-exactness claim the assembler tests (34-05 Task 2) depend on.
describe('congregationalSlideFieldsFromSlot', () => {
  it('a slot with no congregationalSections returns normal mode with NO own "sections" property', () => {
    const slot = makeSlot({ congregationalSections: undefined })
    const result = congregationalSlideFieldsFromSlot(slot)
    expect(result.readingMode).toBe('normal')
    expect(Object.prototype.hasOwnProperty.call(result, 'sections')).toBe(false)
  })

  it('a slot with an empty congregationalSections array also returns normal mode with no "sections" property', () => {
    const slot = makeSlot({ congregationalSections: [] })
    const result = congregationalSlideFieldsFromSlot(slot)
    expect(result.readingMode).toBe('normal')
    expect(Object.prototype.hasOwnProperty.call(result, 'sections')).toBe(false)
  })

  it('a slot with one section returns congregational mode and that one-element array', () => {
    const sections = [makeSection()]
    const slot = makeSlot({ congregationalSections: sections })
    const result = congregationalSlideFieldsFromSlot(slot)
    expect(result.readingMode).toBe('congregational')
    expect(result.sections).toBe(sections)
  })

  it('a slot with three sections returns all three, in stored order, with no re-sorting', () => {
    const sections = [
      makeSection({ speaker: 'LEADER', text: 'One' }),
      makeSection({ speaker: 'CONGREGATION', text: 'Two' }),
      makeSection({ speaker: 'LEADER', text: 'Three' }),
    ]
    const slot = makeSlot({ congregationalSections: sections })
    const result = congregationalSlideFieldsFromSlot(slot)
    expect(result.sections).toEqual(sections)
    expect(result.sections!.map((s) => s.text)).toEqual(['One', 'Two', 'Three'])
  })

  it('two adjacent sections sharing the same speaker are both returned, unmerged', () => {
    const sections = [
      makeSection({ speaker: 'CONGREGATION', text: 'Part A' }),
      makeSection({ speaker: 'CONGREGATION', text: 'Part B' }),
    ]
    const slot = makeSlot({ congregationalSections: sections })
    const result = congregationalSlideFieldsFromSlot(slot)
    expect(result.sections).toHaveLength(2)
    expect(result.sections![0]!.speaker).toBe('CONGREGATION')
    expect(result.sections![1]!.speaker).toBe('CONGREGATION')
  })

  it('a section containing curly quotes and an em dash round-trips with strict === equality', () => {
    const text = '‘He restores my soul’ — “he leads me”'
    const sections = [makeSection({ text })]
    const slot = makeSlot({ congregationalSections: sections })
    const result = congregationalSlideFieldsFromSlot(slot)
    expect(result.sections![0]!.text === text).toBe(true)
  })

  it('source inspection: performs no string-transforming or array-reordering operation', () => {
    const src = congregationalSlideFieldsFromSlot.toString()
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
