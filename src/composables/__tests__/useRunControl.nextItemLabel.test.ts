/**
 * Phase 115 Plan 02 (R331). Pure unit tests for deriveNextItemLabel — the
 * filmstrip end-cap's next-item derivation. Plain RailRow arrays, no mounting.
 */
import { describe, it, expect } from 'vitest'
import { deriveNextItemLabel, type RailRow } from '../useRunControl'

function row(index: number, title: string): RailRow {
  return { index, section: '', title, count: 1, hasSlides: true, isActive: false }
}

describe('deriveNextItemLabel (R331)', () => {
  it('returns the next row title when the middle item is active', () => {
    const rows = [row(0, 'Call to Worship'), row(1, 'Opening Song'), row(2, 'Sermon')]
    expect(deriveNextItemLabel(rows, 1)).toBe('Sermon')
  })

  it('returns null when the last item is active (end of service)', () => {
    const rows = [row(0, 'Call to Worship'), row(1, 'Opening Song'), row(2, 'Sermon')]
    expect(deriveNextItemLabel(rows, 2)).toBe(null)
  })

  it('returns null when currentSlotIndex is null (pre-live)', () => {
    const rows = [row(0, 'Call to Worship'), row(1, 'Opening Song')]
    expect(deriveNextItemLabel(rows, null)).toBe(null)
  })

  it('returns null when currentSlotIndex is not found in rows', () => {
    const rows = [row(0, 'Call to Worship'), row(1, 'Opening Song')]
    expect(deriveNextItemLabel(rows, 99)).toBe(null)
  })
})
