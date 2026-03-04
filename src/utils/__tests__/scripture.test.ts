import { describe, it, expect } from 'vitest'
import { BIBLE_BOOKS, esvLink, scripturesOverlap } from '@/utils/scripture'
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
  it('generates correct URL for Psalm 23:1-6', () => {
    expect(esvLink('Psalm', 23, 1, 6)).toBe('https://www.esv.org/Psalm+23%3A1-6/')
  })

  it('generates correct URL for 1 John 3:16-18 (spaces become +)', () => {
    expect(esvLink('1 John', 3, 16, 18)).toBe('https://www.esv.org/1+John+3%3A16-18/')
  })

  it('generates correct URL for John 3:16-17', () => {
    expect(esvLink('John', 3, 16, 17)).toBe('https://www.esv.org/John+3%3A16-17/')
  })

  it('handles single-word book names', () => {
    expect(esvLink('Romans', 8, 1, 4)).toBe('https://www.esv.org/Romans+8%3A1-4/')
  })

  it('handles books with numbers (e.g., 2 Corinthians)', () => {
    expect(esvLink('2 Corinthians', 5, 17, 21)).toBe('https://www.esv.org/2+Corinthians+5%3A17-21/')
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
