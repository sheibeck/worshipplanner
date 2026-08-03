import { describe, expect, it } from 'vitest'
import { computeBoundaries, hasSplittableBoundaries } from '@/utils/scriptureBoundaries'

/** Every fixture in this suite must satisfy the same three structural
 * invariants: the array starts at 0, ends at text.length, and is strictly
 * ascending with no duplicate values. Asserted centrally so every new
 * fixture automatically gets this coverage. */
function assertWellFormed(text: string, boundaries: number[]) {
  expect(boundaries[0]).toBe(0)
  expect(boundaries[boundaries.length - 1]).toBe(text.length)
  for (let i = 1; i < boundaries.length; i++) {
    expect(boundaries[i]!).toBeGreaterThan(boundaries[i - 1]!)
  }
  expect(new Set(boundaries).size).toBe(boundaries.length)
}

describe('computeBoundaries', () => {
  it('places a boundary immediately after each verse marker and its trailing whitespace', () => {
    const text = '[1] In the beginning God created the heavens. [2] And the earth was without form.'
    const boundaries = computeBoundaries(text)
    assertWellFormed(text, boundaries)

    const firstVerseWordsStart = text.indexOf('In the beginning')
    const secondVerseWordsStart = text.indexOf('And the earth')
    expect(boundaries).toContain(firstVerseWordsStart)
    expect(boundaries).toContain(secondVerseWordsStart)
  })

  it('places a boundary immediately after each clause-ending mark followed by whitespace', () => {
    const text = 'Period. Exclaim! Question? Semi; Colon: Next word.'
    const boundaries = computeBoundaries(text)
    assertWellFormed(text, boundaries)

    expect(boundaries).toContain(text.indexOf('Exclaim'))
    expect(boundaries).toContain(text.indexOf('Question'))
    expect(boundaries).toContain(text.indexOf('Semi'))
    expect(boundaries).toContain(text.indexOf('Colon'))
    expect(boundaries).toContain(text.indexOf('Next word'))
  })

  it('does NOT create a boundary after a comma followed by whitespace', () => {
    const text = 'For God so loved the world, that he gave his only Son.'
    const boundaries = computeBoundaries(text)
    assertWellFormed(text, boundaries)

    const afterComma = text.indexOf('that he gave')
    expect(boundaries).not.toContain(afterComma)
    // The only internal boundary should be after the period, not the comma.
    expect(boundaries).toEqual([0, text.length])
  })

  it('always includes position 0 and text.length as anchors, even for a single-clause passage', () => {
    const text = 'no punctuation here'
    const boundaries = computeBoundaries(text)
    expect(boundaries).toEqual([0, text.length])
  })

  it('always includes position 0 and text.length as anchors for empty text', () => {
    const boundaries = computeBoundaries('')
    expect(boundaries).toEqual([0, 0])
  })

  it('returns a strictly ascending array with no duplicates when a clause-ending mark and a verse marker resolve to adjacent/overlapping regions', () => {
    // The clause boundary (right after ". ") lands exactly where the verse
    // marker "[3]" begins — a realistic ESV shape (end of one verse,
    // immediately followed by the next verse's number) that exercises the
    // Set-based dedup even though the two patterns match different
    // substrings.
    const text = 'Selah. [3] More words follow after the marker.'
    const boundaries = computeBoundaries(text)
    assertWellFormed(text, boundaries)

    expect(boundaries).toContain(text.indexOf('[3]'))
    expect(boundaries).toContain(text.indexOf('More words'))
  })

  it('yields a boundary before each refrain in a Psalm-136-shaped fixture, not only at verse starts', () => {
    // Psalm 136's archetypal shape: verses joined by a semicolon-separated
    // refrain repeated across many verses. This is the shape most likely to
    // expose a boundary bug — the archetypal responsive reading.
    const text =
      '[1] Give thanks to the Lord, for he is good; for his steadfast love endures forever. ' +
      '[2] Give thanks to the God of gods; for his steadfast love endures forever. ' +
      '[3] Give thanks to the Lord of lords; for his steadfast love endures forever.'
    const boundaries = computeBoundaries(text)
    assertWellFormed(text, boundaries)

    // A boundary must exist right before each refrain (after the semicolon
    // + whitespace), not merely at each verse's own start.
    const refrainStarts = [...text.matchAll(/for his steadfast love/g)].map((m) => m.index!)
    expect(refrainStarts).toHaveLength(3)
    for (const start of refrainStarts) {
      expect(boundaries).toContain(start)
    }

    // And a boundary must also exist at each verse start.
    expect(boundaries).toContain(text.indexOf('Give thanks to the God of gods'))
    expect(boundaries).toContain(text.indexOf('Give thanks to the Lord of lords'))
  })
})

describe('hasSplittableBoundaries', () => {
  it('returns false for a single-clause passage (only the two anchors)', () => {
    expect(hasSplittableBoundaries(computeBoundaries('no punctuation here'))).toBe(false)
  })

  it('returns false for empty text', () => {
    expect(hasSplittableBoundaries(computeBoundaries(''))).toBe(false)
  })

  it('returns true once at least one internal boundary exists', () => {
    const boundaries = computeBoundaries('First sentence. Second sentence.')
    expect(hasSplittableBoundaries(boundaries)).toBe(true)
  })
})
