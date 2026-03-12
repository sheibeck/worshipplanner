import { describe, it, expect } from 'vitest'
import { BIBLE_BOOKS, esvLink, scripturesOverlap, parseScriptureInput } from '@/utils/scripture'
import type { ScriptureRef } from '@/types/service'

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
