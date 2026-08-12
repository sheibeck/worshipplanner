import { describe, it, expect } from 'vitest'
import type { LyricSection } from '@/types/songLyrics'
import {
  ADD_SECTION_KINDS,
  addSection,
  buildSectionRows,
  deriveSectionKind,
  duplicateRow,
  mintSectionId,
  moveRow,
  normalizeLyricOrder,
  normalizeParsedSections,
  removeRow,
  sliceSectionIntoSlides,
  uniqueSectionLabel,
} from '@/utils/songSectionOrder'

const verse1: LyricSection = { id: 'verse-1', label: 'Verse 1', lines: ['line a', 'line b'] }
const chorus: LyricSection = { id: 'chorus', label: 'Chorus', lines: ['line c', 'line d'] }
const bridge: LyricSection = { id: 'bridge', label: 'Bridge', lines: ['line e'] }

describe('buildSectionRows', () => {
  it('derives numbered rows, marking repeats and their original position', () => {
    const rows = buildSectionRows([verse1, chorus], ['chorus', 'verse-1', 'chorus'])

    expect(rows).toHaveLength(3)

    expect(rows[0]).toMatchObject({
      sectionId: 'chorus',
      position: 1,
      occurrenceIndex: 0,
      isRepeat: false,
      repeatOfPosition: null,
    })
    expect(rows[1]).toMatchObject({
      sectionId: 'verse-1',
      position: 2,
      occurrenceIndex: 0,
      isRepeat: false,
      repeatOfPosition: null,
    })
    expect(rows[2]).toMatchObject({
      sectionId: 'chorus',
      position: 3,
      occurrenceIndex: 1,
      isRepeat: true,
      repeatOfPosition: 1,
    })
  })

  it('gives every row a rowKey unique within the returned array', () => {
    const rows = buildSectionRows([verse1, chorus], ['chorus', 'verse-1', 'chorus'])
    const keys = new Set(rows.map((row) => row.rowKey))
    expect(keys.size).toBe(rows.length)
  })

  it('skips an order id that resolves to no pooled section', () => {
    const rows = buildSectionRows([verse1], ['verse-1', 'missing-id'])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.sectionId).toBe('verse-1')
  })

  it('returns an empty array for an empty order', () => {
    expect(buildSectionRows([verse1, chorus], [])).toEqual([])
  })

  it('does not mutate its inputs', () => {
    const sections = [verse1, chorus]
    const order = ['chorus', 'verse-1', 'chorus']
    const sectionsClone = JSON.parse(JSON.stringify(sections))
    const orderClone = JSON.parse(JSON.stringify(order))

    buildSectionRows(sections, order)

    expect(sections).toEqual(sectionsClone)
    expect(order).toEqual(orderClone)
  })

  // WR-01: `stableKey` lets a caller track UI state per physical row across
  // a reorder, independent of the positionally-derived `rowKey`.
  describe('stableKey (WR-01)', () => {
    it('falls back to rowKey when slotIds is omitted', () => {
      const rows = buildSectionRows([verse1, chorus], ['chorus', 'verse-1', 'chorus'])
      expect(rows.map((r) => r.stableKey)).toEqual(rows.map((r) => r.rowKey))
    })

    it('falls back to rowKey when slotIds length does not match order length', () => {
      const rows = buildSectionRows([verse1, chorus], ['chorus', 'verse-1', 'chorus'], ['a', 'b'])
      expect(rows.map((r) => r.stableKey)).toEqual(rows.map((r) => r.rowKey))
    })

    it('uses the supplied slotIds, positionally, when lengths match', () => {
      const rows = buildSectionRows([verse1, chorus], ['chorus', 'verse-1', 'chorus'], ['s1', 's2', 's3'])
      expect(rows.map((r) => r.stableKey)).toEqual(['s1', 's2', 's3'])
    })

    it('keeps a slotId attached to its order index even when the section it points to becomes the earlier or later occurrence after reordering the order array', () => {
      // Before: [chorus(s1), verse-1(s2), chorus(s3)] — s3 is the repeat.
      const before = buildSectionRows([verse1, chorus], ['chorus', 'verse-1', 'chorus'], ['s1', 's2', 's3'])
      const repeatBefore = before.find((r) => r.isRepeat)!
      expect(repeatBefore.stableKey).toBe('s3')

      // After swapping the two chorus slots' positions (s1 now last): the
      // slotId travels with its order slot, not with "being a repeat".
      const after = buildSectionRows([verse1, chorus], ['verse-1', 'chorus', 'chorus'], ['s2', 's3', 's1'])
      const repeatAfter = after.find((r) => r.isRepeat)!
      expect(repeatAfter.stableKey).toBe('s1')
      const followedAfter = after.find((r) => !r.isRepeat && r.sectionId === 'chorus')!
      expect(followedAfter.stableKey).toBe('s3')
    })
  })
})

describe('deriveSectionKind (R120)', () => {
  it('strips a single trailing arabic number for every real label shape', () => {
    expect(deriveSectionKind('Verse 1')).toBe('Verse')
    expect(deriveSectionKind('Verse')).toBe('Verse')
    expect(deriveSectionKind('Chorus')).toBe('Chorus')
    expect(deriveSectionKind('Pre-Chorus')).toBe('Pre-Chorus')
    expect(deriveSectionKind('Pre-Chorus 2')).toBe('Pre-Chorus')
    expect(deriveSectionKind('Bridge')).toBe('Bridge')
    expect(deriveSectionKind('Section 1')).toBe('Section')
  })
})

describe('buildSectionRows displayLabel (R120)', () => {
  it('numbers a bare "Verse" after pasted "Verse 1"/"Verse 2" as "Verse 3" (the bug)', () => {
    const v1: LyricSection = { id: 'verse-1', label: 'Verse 1', lines: ['a'] }
    const v2: LyricSection = { id: 'verse-2', label: 'Verse 2', lines: ['b'] }
    const vBare: LyricSection = { id: 'verse', label: 'Verse', lines: ['c'] }

    const rows = buildSectionRows([v1, v2, vBare], ['verse-1', 'verse-2', 'verse'])

    expect(rows.map((r) => r.displayLabel)).toEqual(['Verse 1', 'Verse 2', 'Verse 3'])
  })

  it('numbers per KIND by position, not by global row position', () => {
    const v1: LyricSection = { id: 'verse-1', label: 'Verse 1', lines: ['a'] }
    const c: LyricSection = { id: 'chorus', label: 'Chorus', lines: ['b'] }
    const v2: LyricSection = { id: 'verse-2', label: 'Verse 2', lines: ['c'] }

    const rows = buildSectionRows([v1, c, v2], ['verse-1', 'chorus', 'verse-2'])

    expect(rows.map((r) => r.displayLabel)).toEqual(['Verse 1', 'Chorus 1', 'Verse 2'])
  })

  it('reuses the same displayLabel/number on both rows of a repeat', () => {
    const rows = buildSectionRows([verse1, chorus], ['chorus', 'verse-1', 'chorus'])
    expect(rows[0]?.displayLabel).toBe('Chorus 1')
    expect(rows[2]?.displayLabel).toBe('Chorus 1')
    expect(rows[1]?.displayLabel).toBe('Verse 1')
  })

  it('numbers a lone section of a kind as "{Kind} 1" (nothing unnumbered)', () => {
    const rows = buildSectionRows([chorus], ['chorus'])
    expect(rows[0]?.displayLabel).toBe('Chorus 1')
  })

  it('never mutates the stored section.label', () => {
    const v1: LyricSection = { id: 'verse-1', label: 'Verse 1', lines: ['a'] }
    const vBare: LyricSection = { id: 'verse', label: 'Verse', lines: ['c'] }
    const sections = [v1, vBare]
    const labelsBefore = sections.map((s) => s.label)

    buildSectionRows(sections, ['verse-1', 'verse'])

    expect(sections.map((s) => s.label)).toEqual(labelsBefore)
    expect(vBare.label).toBe('Verse')
  })
})

describe('sliceSectionIntoSlides (R117)', () => {
  it('returns exactly one group (the section lines) when slideBreaks is undefined', () => {
    const section: LyricSection = { id: 'v', label: 'Verse', lines: ['a', 'b', 'c'] }
    expect(sliceSectionIntoSlides(section)).toEqual([['a', 'b', 'c']])
  })

  it('returns exactly one group when slideBreaks is empty', () => {
    const section: LyricSection = { id: 'v', label: 'Verse', lines: ['a', 'b'], slideBreaks: [] }
    expect(sliceSectionIntoSlides(section)).toEqual([['a', 'b']])
  })

  it('splits an 8-line section at break [4] into two groups of four (owner chorus example)', () => {
    const lines = ['1', '2', '3', '4', '5', '6', '7', '8']
    const section: LyricSection = { id: 'c', label: 'Chorus', lines, slideBreaks: [4] }
    expect(sliceSectionIntoSlides(section)).toEqual([
      ['1', '2', '3', '4'],
      ['5', '6', '7', '8'],
    ])
  })

  it('splits a 7-line section at breaks [2,5] into three consecutive groups', () => {
    const lines = ['0', '1', '2', '3', '4', '5', '6']
    const section: LyricSection = { id: 'v', label: 'Verse', lines, slideBreaks: [2, 5] }
    expect(sliceSectionIntoSlides(section)).toEqual([
      ['0', '1'],
      ['2', '3', '4'],
      ['5', '6'],
    ])
  })

  it('ignores out-of-range break indices (0, n and beyond) — collapses to one group', () => {
    const lines = ['a', 'b', 'c', 'd', 'e', 'f'] // n = 6
    for (const bad of [[0], [6], [99]]) {
      const section: LyricSection = { id: 'v', label: 'Verse', lines, slideBreaks: bad }
      expect(sliceSectionIntoSlides(section)).toEqual([lines])
    }
  })

  it('dedupes, sorts and integer-filters unsorted/duplicate/non-integer input [5,2,2,3.5]', () => {
    const lines = ['0', '1', '2', '3', '4', '5', '6'] // n = 7, breaks -> {2,5}
    const section: LyricSection = { id: 'v', label: 'Verse', lines, slideBreaks: [5, 2, 2, 3.5] }
    expect(sliceSectionIntoSlides(section)).toEqual([
      ['0', '1'],
      ['2', '3', '4'],
      ['5', '6'],
    ])
  })

  it('never throws on legacy/corrupt input', () => {
    const lines = ['a', 'b']
    expect(() =>
      sliceSectionIntoSlides({ id: 'v', label: 'V', lines, slideBreaks: [-1, 99, 0, 1.5] }),
    ).not.toThrow()
  })

  it('does not mutate section.lines or section.slideBreaks', () => {
    const lines = ['0', '1', '2', '3', '4', '5', '6']
    const slideBreaks = [5, 2, 2, 3.5]
    const section: LyricSection = { id: 'v', label: 'Verse', lines, slideBreaks }
    const linesClone = [...lines]
    const breaksClone = [...slideBreaks]

    sliceSectionIntoSlides(section)

    expect(section.lines).toBe(lines)
    expect(section.lines).toEqual(linesClone)
    expect(section.slideBreaks).toBe(slideBreaks)
    expect(section.slideBreaks).toEqual(breaksClone)
  })
})

describe('normalizeLyricOrder', () => {
  it('drops order ids that resolve to nothing', () => {
    const result = normalizeLyricOrder([verse1, chorus], ['verse-1', 'ghost', 'chorus'])
    expect(result.performanceOrder).toEqual(['verse-1', 'chorus'])
    expect(result.sections).toEqual([verse1, chorus])
  })

  it('drops pooled sections sharing an id with an earlier pooled section, keeping the first', () => {
    const duplicatePool = [verse1, chorus, { ...chorus, lines: ['different'] }]
    const result = normalizeLyricOrder(duplicatePool, ['verse-1', 'chorus'])
    expect(result.sections).toEqual([verse1, chorus])
  })

  it('seeds the order from the pool sequence when the surviving order is empty but the pool is not', () => {
    const result = normalizeLyricOrder([verse1, chorus], ['ghost-only'])
    expect(result.performanceOrder).toEqual(['verse-1', 'chorus'])
    expect(result.sections).toEqual([verse1, chorus])
  })

  it('drops pooled sections referenced zero times', () => {
    const result = normalizeLyricOrder([verse1, chorus, bridge], ['verse-1', 'chorus'])
    expect(result.sections).toEqual([verse1, chorus])
    expect(result.performanceOrder).toEqual(['verse-1', 'chorus'])
  })

  it('returns a value-equal result for input already satisfying the invariants', () => {
    const result = normalizeLyricOrder([verse1, chorus], ['verse-1', 'chorus'])
    expect(result.sections).toEqual([verse1, chorus])
    expect(result.performanceOrder).toEqual(['verse-1', 'chorus'])
  })

  it('does not mutate its inputs', () => {
    const sections = [verse1, chorus, bridge]
    const order = ['verse-1', 'ghost', 'chorus']
    const sectionsClone = JSON.parse(JSON.stringify(sections))
    const orderClone = JSON.parse(JSON.stringify(order))

    normalizeLyricOrder(sections, order)

    expect(sections).toEqual(sectionsClone)
    expect(order).toEqual(orderClone)
  })
})

describe('moveRow', () => {
  it('moves an entry from one index to another', () => {
    expect(moveRow(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('is a no-op returning an equal array for an out-of-range fromIndex', () => {
    const order = ['a', 'b', 'c']
    expect(moveRow(order, 5, 1)).toEqual(order)
  })

  it('is a no-op returning an equal array for an out-of-range toIndex', () => {
    const order = ['a', 'b', 'c']
    expect(moveRow(order, 0, 5)).toEqual(order)
  })

  it('does not mutate its input', () => {
    const order = ['a', 'b', 'c']
    const clone = [...order]
    moveRow(order, 0, 2)
    expect(order).toEqual(clone)
  })
})

describe('duplicateRow', () => {
  it('duplicates the row immediately after the one it was made from', () => {
    expect(duplicateRow(['a', 'b'], 0)).toEqual(['a', 'a', 'b'])
  })

  it('is a no-op returning an equal array for an out-of-range index', () => {
    const order = ['a', 'b']
    expect(duplicateRow(order, 9)).toEqual(order)
  })

  it('does not mutate its input', () => {
    const order = ['a', 'b']
    const clone = [...order]
    duplicateRow(order, 0)
    expect(order).toEqual(clone)
  })
})

describe('removeRow', () => {
  it('removes only one occurrence of a twice-referenced section, keeping it pooled', () => {
    const result = removeRow([verse1, chorus], ['chorus', 'verse-1', 'chorus'], 0)
    expect(result.performanceOrder).toEqual(['verse-1', 'chorus'])
    expect(result.sections).toEqual([verse1, chorus])
  })

  it('drops the section from the pool when removing its last occurrence', () => {
    const result = removeRow([verse1, chorus], ['verse-1', 'chorus'], 1)
    expect(result.performanceOrder).toEqual(['verse-1'])
    expect(result.sections).toEqual([verse1])
  })

  it('does not mutate its inputs', () => {
    const sections = [verse1, chorus]
    const order = ['chorus', 'verse-1', 'chorus']
    const sectionsClone = JSON.parse(JSON.stringify(sections))
    const orderClone = JSON.parse(JSON.stringify(order))

    removeRow(sections, order, 0)

    expect(sections).toEqual(sectionsClone)
    expect(order).toEqual(orderClone)
  })
})

describe('addSection', () => {
  it('mints a fresh "Chorus 2" label/id when Chorus already exists', () => {
    const result = addSection([verse1, chorus], ['verse-1', 'chorus'], 'Chorus')
    expect(result.performanceOrder).toEqual(['verse-1', 'chorus', result.newSectionId])

    const added = result.sections.find((section) => section.id === result.newSectionId)
    expect(added).toBeDefined()
    expect(added?.label).toBe('Chorus 2')
    expect(added?.lines).toEqual([])
    expect(result.newSectionId).not.toBe('chorus')
  })

  it('adds a section under the bare kind label when unused', () => {
    const result = addSection([verse1], ['verse-1'], 'Bridge')
    const added = result.sections.find((section) => section.id === result.newSectionId)
    expect(added?.label).toBe('Bridge')
    expect(added?.id).toBe('bridge')
  })

  it('does not mutate its inputs', () => {
    const sections = [verse1, chorus]
    const order = ['verse-1', 'chorus']
    const sectionsClone = JSON.parse(JSON.stringify(sections))
    const orderClone = JSON.parse(JSON.stringify(order))

    addSection(sections, order, 'Chorus')

    expect(sections).toEqual(sectionsClone)
    expect(order).toEqual(orderClone)
  })
})

describe('mintSectionId', () => {
  it('returns an id not present in the supplied list', () => {
    const id = mintSectionId('Chorus', ['chorus'])
    expect(['chorus']).not.toContain(id)
    expect(id).toBe('chorus-2')
  })

  it('returns the plain slug when unused', () => {
    expect(mintSectionId('Bridge', ['chorus'])).toBe('bridge')
  })
})

describe('uniqueSectionLabel', () => {
  it('returns the bare kind when unused', () => {
    expect(uniqueSectionLabel('Chorus', ['Verse 1'])).toBe('Chorus')
  })

  it('returns the smallest integer above one that makes it unused', () => {
    expect(uniqueSectionLabel('Chorus', ['Chorus'])).toBe('Chorus 2')
    expect(uniqueSectionLabel('Chorus', ['Chorus', 'Chorus 2'])).toBe('Chorus 3')
  })
})

describe('ADD_SECTION_KINDS', () => {
  it('holds the six quick-add kinds in mockup order, with Pre-Chorus after Chorus', () => {
    expect(ADD_SECTION_KINDS).toEqual(['Verse', 'Chorus', 'Pre-Chorus', 'Bridge', 'Tag', 'Ending'])
  })

  it('includes Pre-Chorus (R119)', () => {
    expect(ADD_SECTION_KINDS).toContain('Pre-Chorus')
  })
})

describe('Pre-Chorus (R119)', () => {
  it('mints id "pre-chorus" from the "Pre-Chorus" label (hyphen preserved, whitespace-free)', () => {
    expect(mintSectionId('Pre-Chorus', [])).toBe('pre-chorus')
  })

  it('addSection produces a section labelled "Pre-Chorus" with id "pre-chorus", appended to the order', () => {
    const result = addSection([], [], 'Pre-Chorus')
    const added = result.sections.find((section) => section.id === result.newSectionId)
    expect(added?.label).toBe('Pre-Chorus')
    expect(added?.id).toBe('pre-chorus')
    expect(result.performanceOrder).toEqual(['pre-chorus'])
  })

  it('deriveSectionKind maps "Pre-Chorus 2" back to "Pre-Chorus"', () => {
    expect(deriveSectionKind('Pre-Chorus 2')).toBe('Pre-Chorus')
  })
})

describe('normalizeParsedSections', () => {
  it('normalises a repeat marker (second Chorus block has no lines) into one pooled section referenced twice', () => {
    const parsed = {
      sections: [
        { id: 'chorus', label: 'Chorus', lines: ['Grace grace', 'How wonderful', 'Amazing', 'Sweet'] },
        { id: 'verse-1', label: 'Verse 1', lines: ['How sweet', 'The sound'] },
        { id: 'chorus', label: 'Chorus', lines: [] },
      ],
    }

    const result = normalizeParsedSections(parsed)

    expect(result.sections).toHaveLength(2)
    expect(result.performanceOrder).toHaveLength(3)
    expect(result.performanceOrder[0]).toBe(result.performanceOrder[2])
    expect(result.performanceOrder[0]).toBe('chorus')
    expect(result.performanceOrder[1]).toBe('verse-1')
  })

  it('normalises two Chorus blocks with IDENTICAL lines into one pooled section, two order entries', () => {
    const lines = ['Grace grace', 'How wonderful']
    const parsed = {
      sections: [
        { id: 'chorus', label: 'Chorus', lines: [...lines] },
        { id: 'chorus', label: 'Chorus', lines: [...lines] },
      ],
    }

    const result = normalizeParsedSections(parsed)

    expect(result.sections).toHaveLength(1)
    expect(result.performanceOrder).toEqual(['chorus', 'chorus'])
  })

  it('treats trailing-whitespace-only differences as identical (repeat), not distinct', () => {
    const parsed = {
      sections: [
        { id: 'chorus', label: 'Chorus', lines: ['Grace grace  ', 'How wonderful'] },
        { id: 'chorus', label: 'Chorus', lines: ['Grace grace', 'How wonderful  '] },
      ],
    }

    const result = normalizeParsedSections(parsed)
    expect(result.sections).toHaveLength(1)
    expect(result.performanceOrder).toEqual(['chorus', 'chorus'])
  })

  it('keeps two Chorus blocks with DIFFERENT non-empty lines as two distinct pooled sections', () => {
    const parsed = {
      sections: [
        { id: 'chorus', label: 'Chorus', lines: ['Grace grace', 'How wonderful'] },
        { id: 'chorus', label: 'Chorus', lines: ['Totally different', 'Second set of words'] },
      ],
    }

    const result = normalizeParsedSections(parsed)

    expect(result.sections).toHaveLength(2)
    expect(result.sections[0]?.label).toBe('Chorus')
    expect(result.sections[1]?.label).toBe('Chorus')
    expect(result.sections[0]?.id).not.toBe(result.sections[1]?.id)
    expect(result.performanceOrder).toHaveLength(2)
    expect(result.performanceOrder[0]).toBe(result.sections[0]?.id)
    expect(result.performanceOrder[1]).toBe(result.sections[1]?.id)
  })

  it('passes through a parse result with no repeated ids unchanged', () => {
    const parsed = {
      sections: [
        { id: 'verse-1', label: 'Verse 1', lines: ['a', 'b'] },
        { id: 'chorus', label: 'Chorus', lines: ['c', 'd'] },
        { id: 'bridge', label: 'Bridge', lines: ['e'] },
      ],
    }

    const result = normalizeParsedSections(parsed)

    expect(result.sections).toEqual(parsed.sections)
    expect(result.performanceOrder).toEqual(['verse-1', 'chorus', 'bridge'])
  })

  it('returns a pair that already satisfies the pool/order invariants', () => {
    const parsed = {
      sections: [
        { id: 'chorus', label: 'Chorus', lines: ['Grace grace', 'How wonderful'] },
        { id: 'verse-1', label: 'Verse 1', lines: ['How sweet', 'The sound'] },
        { id: 'chorus', label: 'Chorus', lines: [] },
        { id: 'chorus', label: 'Chorus', lines: ['Totally different'] },
      ],
    }

    const result = normalizeParsedSections(parsed)
    const renormalized = normalizeLyricOrder(result.sections, result.performanceOrder)

    expect(renormalized.sections).toEqual(result.sections)
    expect(renormalized.performanceOrder).toEqual(result.performanceOrder)
  })
})
