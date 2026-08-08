import { describe, expect, it } from 'vitest'
import { splitPassage, splitPerVerse } from '@/utils/scriptureSplitter'
import type { ScriptureRef } from '@/types/service'

const ref: ScriptureRef = { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 39 }

describe('splitPassage', () => {
  it('returns empty array for empty text', () => {
    expect(splitPassage('', ref)).toEqual([])
    expect(splitPassage('   ', ref)).toEqual([])
  })

  it('produces a single slide for a single verse', () => {
    const text = '[28] And we know that for those who love God all things work together for good.'
    const slides = splitPassage(text, ref)
    expect(slides).toHaveLength(1)
    expect(slides[0]!.contentKind).toBe('scripture')
    expect(slides[0]!.verseRange).toBe('v. 28')
    expect(slides[0]!.text).toContain('And we know')
    expect(slides[0]!.readingMode).toBe('normal')
    expect(slides[0]!.reference).toBe('Romans 8:28-39')
  })

  it('produces a single slide for a short passage under the threshold', () => {
    const text =
      '[28] And we know that for those who love God all things work together for good. ' +
      '[29] For those whom he foreknew he also predestined.'
    const slides = splitPassage(text, ref)
    expect(slides).toHaveLength(1)
    expect(slides[0]!.verseRange).toBe('vv. 28-29')
  })

  it('splits a medium passage into 2-3 slides at verse boundaries', () => {
    const verses = Array.from({ length: 6 }, (_, i) => {
      const num = 28 + i
      return `[${num}] ${'word '.repeat(20).trim()}.`
    }).join(' ')
    const slides = splitPassage(verses, ref, { wordsPerSlide: 50 })
    expect(slides.length).toBeGreaterThanOrEqual(2)
    expect(slides.length).toBeLessThanOrEqual(3)
    for (const slide of slides) {
      expect(slide.contentKind).toBe('scripture')
      expect(slide.bookRef).toEqual(ref)
    }
  })

  it('splits a long psalm-length passage into many slides', () => {
    const verses = Array.from({ length: 20 }, (_, i) => {
      const num = i + 1
      return `[${num}] ${'word '.repeat(15).trim()}.`
    }).join(' ')
    const psalmRef: ScriptureRef = { book: 'Psalm', chapter: 119, verseStart: 1, verseEnd: 20 }
    const slides = splitPassage(verses, psalmRef, { wordsPerSlide: 50 })
    expect(slides.length).toBeGreaterThanOrEqual(4)
    expect(slides[0]!.position).toBe(0)
    expect(slides[slides.length - 1]!.position).toBe(slides.length - 1)
  })

  it('falls back to sentence-boundary split when no verse markers exist', () => {
    const text =
      'The Lord is my shepherd. I shall not want. He makes me lie down in green pastures. ' +
      'He leads me beside still waters. He restores my soul. He leads me in paths of ' +
      'righteousness for his name sake. Even though I walk through the valley of the shadow of ' +
      'death I will fear no evil for you are with me.'
    const slides = splitPassage(text, ref, { wordsPerSlide: 30 })
    expect(slides.length).toBeGreaterThanOrEqual(2)
    for (const slide of slides) {
      expect(slide.verseRange).toBe('')
    }
  })

  it('respects custom wordsPerSlide option', () => {
    const verses = Array.from({ length: 4 }, (_, i) => {
      const num = i + 1
      return `[${num}] ${'word '.repeat(10).trim()}.`
    }).join(' ')
    const smallRef: ScriptureRef = { book: 'John', chapter: 3, verseStart: 1, verseEnd: 4 }
    const slidesSmall = splitPassage(verses, smallRef, { wordsPerSlide: 15 })
    const slidesLarge = splitPassage(verses, smallRef, { wordsPerSlide: 100 })
    expect(slidesSmall.length).toBeGreaterThan(slidesLarge.length)
  })

  it('generates correct verse range labels', () => {
    const text =
      '[1] First verse words here. [2] Second verse words here. [3] Third verse words here.'
    const singleRef: ScriptureRef = { book: 'Genesis', chapter: 1, verseStart: 1, verseEnd: 3 }
    const slides = splitPassage(text, singleRef, { wordsPerSlide: 10 })
    expect(slides.length).toBeGreaterThanOrEqual(2)
    for (const slide of slides) {
      expect(slide.verseRange).toMatch(/^v{1,2}\.\s\d+(-\d+)?$/)
    }
  })

  it('assigns sequential positions starting from 0', () => {
    const verses = Array.from({ length: 8 }, (_, i) => {
      return `[${i + 1}] ${'word '.repeat(20).trim()}.`
    }).join(' ')
    const posRef: ScriptureRef = { book: 'Matthew', chapter: 5, verseStart: 1, verseEnd: 8 }
    const slides = splitPassage(verses, posRef, { wordsPerSlide: 50 })
    slides.forEach((slide, i) => {
      expect(slide.position).toBe(i)
      expect(slide.id).toBe(`scripture-${i}`)
    })
  })

  it('formats reference string correctly for various ref shapes', () => {
    const chapterOnly: ScriptureRef = { book: 'Psalm', chapter: 23 }
    const singleVerse: ScriptureRef = { book: 'John', chapter: 3, verseStart: 16 }
    const range: ScriptureRef = { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 39 }

    const slides1 = splitPassage('[1] Test.', chapterOnly)
    expect(slides1[0]!.reference).toBe('Psalm 23')

    const slides2 = splitPassage('[16] Test.', singleVerse)
    expect(slides2[0]!.reference).toBe('John 3:16')

    const slides3 = splitPassage('[28] Test.', range)
    expect(slides3[0]!.reference).toBe('Romans 8:28-39')
  })
})

describe('splitPerVerse', () => {
  it('returns empty array for empty text', () => {
    expect(splitPerVerse('')).toEqual([])
    expect(splitPerVerse('   ')).toEqual([])
  })

  it('returns exactly one entry per verse for a 20-verse fixture, with ascending single-number verseRanges', () => {
    const verses = Array.from({ length: 20 }, (_, i) => {
      const num = i + 1
      return `[${num}] ${'word '.repeat(15).trim()}.`
    }).join(' ')

    const entries = splitPerVerse(verses)

    expect(entries).toHaveLength(20)
    entries.forEach((entry, i) => {
      expect(entry.verseRange).toBe(String(i + 1))
    })
  })

  it('returns a single entry with verseRange "" for text with no verse markers', () => {
    const text = 'The Lord is my shepherd; I shall not want.'
    const entries = splitPerVerse(text)

    expect(entries).toHaveLength(1)
    expect(entries[0]!.verseRange).toBe('')
    expect(entries[0]!.text).toBe(text)
  })

  it('produces one-entry-per-verse where splitPassage groups the same fixture into fewer slides, proving the two functions differ', () => {
    const verses = Array.from({ length: 6 }, (_, i) => {
      const num = 28 + i
      return `[${num}] ${'word '.repeat(20).trim()}.`
    }).join(' ')
    const ref: ScriptureRef = { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 33 }

    const grouped = splitPassage(verses, ref, { wordsPerSlide: 50 })
    const perVerse = splitPerVerse(verses)

    expect(perVerse).toHaveLength(6)
    expect(grouped.length).toBeLessThan(perVerse.length)
  })

  it('strips the verse marker and trims each entry text', () => {
    const text = '[1]   First verse words.   [2]   Second verse words.  '
    const entries = splitPerVerse(text)

    expect(entries).toHaveLength(2)
    expect(entries[0]!.text).toBe('First verse words.')
    expect(entries[1]!.text).toBe('Second verse words.')
  })
})
