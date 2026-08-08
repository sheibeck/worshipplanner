import { describe, expect, it } from 'vitest'
import {
  BOUNDARY_MARKER_CLOSE,
  BOUNDARY_MARKER_OPEN,
  computeBoundaries,
  embedBoundaryMarkers,
  hasSplittableBoundaries,
  sliceAtBoundaries,
  stripVerseMarkers,
  verseRangeForBoundaryRange,
  verseRangeForSlice,
} from '@/utils/scriptureBoundaries'

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
    // For empty text, 0 and text.length are the same value, so the Set
    // collapses them into a single entry — still correctly "0 and length".
    const boundaries = computeBoundaries('')
    expect(boundaries).toEqual([0])
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

/** Removes every `⟦N⟧` marker token so a marked-up copy can be compared
 * back against its untouched source. Used only by the tests below — never
 * a stand-in for the module's own `stripVerseMarkers`, which strips verse
 * numbers, not boundary markers. */
function stripAllMarkerTokens(marked: string): string {
  return marked.replace(/⟦\d+⟧/g, '')
}

// Encoding backstop fixture: curly opening/closing double quotes (U+201C/U+201D),
// a curly apostrophe (U+2019), and an em dash (U+2014). Source-match equality
// must hold over this exact string with strict `===`, no normalization.
const NON_ASCII_FIXTURE =
  '[1] She said, “It’s good”—very good. ' +
  '[2] The Lord reigns; let the earth rejoice.'

describe('embedBoundaryMarkers', () => {
  it('inserts exactly boundaries.length markers, and stripping them reproduces the input exactly (===)', () => {
    const text = '[1] In the beginning God created the heavens. [2] And the earth was without form.'
    const boundaries = computeBoundaries(text)
    const marked = embedBoundaryMarkers(text, boundaries)
    expect(marked).not.toBeNull()

    const markerCount = [...marked!.matchAll(/⟦\d+⟧/g)].length
    expect(markerCount).toBe(boundaries.length)

    const stripped = stripAllMarkerTokens(marked!)
    expect(stripped === text).toBe(true)
  })

  it('places the marker at array position i immediately before the character at boundaries[i]', () => {
    const text = 'One. Two. Three.'
    const boundaries = computeBoundaries(text)
    const marked = embedBoundaryMarkers(text, boundaries)
    expect(marked).not.toBeNull()

    boundaries.forEach((boundary, i) => {
      const markerToken = `${BOUNDARY_MARKER_OPEN}${i}${BOUNDARY_MARKER_CLOSE}`
      const markerIndex = marked!.indexOf(markerToken)
      expect(markerIndex).toBeGreaterThanOrEqual(0)
      // Everything before this marker token, with every marker token
      // stripped out, must equal the source text up to this boundary.
      const prefixWithoutMarkers = stripAllMarkerTokens(marked!.slice(0, markerIndex))
      expect(prefixWithoutMarkers).toBe(text.slice(0, boundary))
    })
  })

  it('returns null when the source text already contains a marker delimiter', () => {
    const text = `Already has ${BOUNDARY_MARKER_OPEN}0${BOUNDARY_MARKER_CLOSE} embedded in it.`
    const boundaries = computeBoundaries(text)
    expect(embedBoundaryMarkers(text, boundaries)).toBeNull()
  })

  it('returns null when the source text already contains only the close delimiter', () => {
    const text = `Stray close delimiter ${BOUNDARY_MARKER_CLOSE} here.`
    const boundaries = computeBoundaries(text)
    expect(embedBoundaryMarkers(text, boundaries)).toBeNull()
  })

  it('encoding backstop: marker round-trip survives non-ASCII punctuation with strict === equality', () => {
    const boundaries = computeBoundaries(NON_ASCII_FIXTURE)
    const marked = embedBoundaryMarkers(NON_ASCII_FIXTURE, boundaries)
    expect(marked).not.toBeNull()

    const stripped = stripAllMarkerTokens(marked!)
    expect(stripped === NON_ASCII_FIXTURE).toBe(true)
  })
})

describe('sliceAtBoundaries', () => {
  it('encoding backstop: returns text.slice(boundaries[i], boundaries[i+1]) exactly, strict ===', () => {
    const boundaries = computeBoundaries(NON_ASCII_FIXTURE)
    for (let i = 0; i < boundaries.length - 1; i++) {
      const sliced = sliceAtBoundaries(NON_ASCII_FIXTURE, boundaries, i, i + 1)
      const expected = NON_ASCII_FIXTURE.slice(boundaries[i]!, boundaries[i + 1]!)
      expect(sliced === expected).toBe(true)
    }
  })

  it('concatenating every adjacent-pair slice reproduces the whole source exactly (partition proof)', () => {
    const boundaries = computeBoundaries(NON_ASCII_FIXTURE)
    let reconstructed = ''
    for (let i = 0; i < boundaries.length - 1; i++) {
      reconstructed += sliceAtBoundaries(NON_ASCII_FIXTURE, boundaries, i, i + 1)
    }
    expect(reconstructed).toBe(NON_ASCII_FIXTURE)
  })

  it('performs exactly one slice call with no normalizing/trimming/comparison operation in its body', () => {
    // Guards the encoding backstop at the source level: this function must
    // never grow a .normalize()/.trim()/.replace()/.toLowerCase() call,
    // since any of those would silently defeat R064's byte-exactness claim.
    const src = sliceAtBoundaries.toString()
    expect(src).not.toMatch(/\.normalize\(/)
    expect(src).not.toMatch(/\.trim\(/)
    expect(src).not.toMatch(/\.replace\(/)
    expect(src).not.toMatch(/\.toLowerCase\(/)
    expect((src.match(/\.slice\(/g) ?? []).length).toBe(1)
  })
})

describe('stripVerseMarkers', () => {
  it('removes bracketed-digit runs and trims outer whitespace, changing nothing else', () => {
    const slice = ' [3] “It’s good”—very good. '
    expect(stripVerseMarkers(slice)).toBe('“It’s good”—very good.')
  })

  it('removes multiple verse markers throughout the slice', () => {
    const slice = '[5] one two [6] three four'
    expect(stripVerseMarkers(slice)).toBe('one two three four')
  })
})

describe('verseRangeForSlice', () => {
  it('returns a single number as a string when the slice carries one verse marker', () => {
    expect(verseRangeForSlice('[5] For God so loved the world.')).toBe('5')
  })

  it('returns a hyphenated range when the slice carries several verse markers', () => {
    expect(verseRangeForSlice('[5] one [6] two [7] three')).toBe('5-7')
  })

  it('returns undefined when the slice carries no verse marker', () => {
    expect(verseRangeForSlice('no markers here')).toBeUndefined()
  })
})

describe('verseRangeForBoundaryRange (WR-01, 47-REVIEW)', () => {
  it('excludes the next verse marker when a run-on verse has no terminal clause punctuation before it', () => {
    // No punctuation between "Lord" and "[2]" — the only legal boundary a
    // segment containing just verse 1 can end at is the START of verse 2's
    // own marker, so the raw slice necessarily contains "[2]" even though
    // none of verse 2's words are included.
    const text = '[1] Give thanks to the Lord [2] for he is good.'
    const boundaries = computeBoundaries(text)
    const verse2MarkerBoundary = boundaries.indexOf(text.indexOf('for he is good'))
    expect(verse2MarkerBoundary).toBeGreaterThan(0)

    expect(verseRangeForBoundaryRange(text, boundaries, 0, verse2MarkerBoundary)).toBe('1')

    // Sanity check proving this is a real regression this function fixes:
    // the raw-text-scanning verseRangeForSlice DOES over-report on the
    // identical slice.
    const slice = sliceAtBoundaries(text, boundaries, 0, verse2MarkerBoundary)
    expect(verseRangeForSlice(slice)).toBe('1-2')
  })

  it('includes every verse whose own marker boundary falls strictly before endBoundary', () => {
    const text = '[1] one. [2] two. [3] three.'
    const boundaries = computeBoundaries(text)
    const verse3MarkerBoundary = boundaries.indexOf(text.indexOf('three'))
    expect(verseRangeForBoundaryRange(text, boundaries, 0, verse3MarkerBoundary)).toBe('1-2')
  })

  it('reports a single verse number when only one marker boundary falls in range', () => {
    const text = '[1] one. [2] two. [3] three.'
    const boundaries = computeBoundaries(text)
    const verse2MarkerBoundary = boundaries.indexOf(text.indexOf('two'))
    expect(verseRangeForBoundaryRange(text, boundaries, 0, verse2MarkerBoundary)).toBe('1')
  })

  it('returns undefined when no verse marker boundary falls within the given range', () => {
    const text = 'First sentence. Second sentence.'
    const boundaries = computeBoundaries(text)
    expect(verseRangeForBoundaryRange(text, boundaries, 0, boundaries.length - 1)).toBeUndefined()
  })
})
