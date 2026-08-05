import { describe, it, expect } from 'vitest'
import { formatScriptureRef } from '@/utils/planningCenterExport'

describe('formatScriptureRef', () => {
  it('formats a scripture reference correctly', () => {
    const ref = { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 }
    expect(formatScriptureRef(ref)).toBe('Romans 8:1-11')
  })

  // HI-02: this previously enshrined 'John 3:16-16'. The rail, the grid header
  // and the drawer context line have always collapsed an equal-verse range to a
  // single verse; the exported plan title and the projected slide must not
  // disagree with them.
  it('collapses a degenerate range to a single verse, matching the projected slide', () => {
    const ref = { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }
    expect(formatScriptureRef(ref)).toBe('John 3:16')
  })

  it('formats a single verse with no verseEnd at all', () => {
    expect(formatScriptureRef({ book: 'Romans', chapter: 8, verseStart: 28 })).toBe('Romans 8:28')
  })
})
