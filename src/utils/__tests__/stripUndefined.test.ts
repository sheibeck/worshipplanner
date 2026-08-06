import { describe, it, expect } from 'vitest'
import { stripUndefined } from '../stripUndefined'

describe('stripUndefined', () => {
  it('removes top-level undefined keys', () => {
    expect(stripUndefined({ a: 1, b: undefined })).toEqual({ a: 1 })
  })

  it('preserves null, 0, empty string, and false (only undefined is dropped)', () => {
    expect(stripUndefined({ a: null, b: 0, c: '', d: false })).toEqual({
      a: null,
      b: 0,
      c: '',
      d: false,
    })
  })

  it('strips undefined inside nested objects', () => {
    expect(stripUndefined({ a: { b: undefined, c: 2 } })).toEqual({ a: { c: 2 } })
  })

  it('strips undefined inside arrays of objects (the slide-array case)', () => {
    // Mirrors the PPTX import bug: title-less text slides and altText-less image slides.
    expect(
      stripUndefined({
        sourceFileName: 'sermon.pptx',
        slides: [
          { contentKind: 'text', title: undefined, body: 'Point 1' },
          { contentKind: 'text', title: 'Heading', body: 'Point 2' },
          { contentKind: 'image', imageUrl: 'u', altText: undefined },
        ],
      }),
    ).toEqual({
      sourceFileName: 'sermon.pptx',
      slides: [
        { contentKind: 'text', body: 'Point 1' },
        { contentKind: 'text', title: 'Heading', body: 'Point 2' },
        { contentKind: 'image', imageUrl: 'u' },
      ],
    })
  })

  it('preserves Date instances (not treated as plain objects)', () => {
    const d = new Date(0)
    expect(stripUndefined({ when: d })).toEqual({ when: d })
  })

  it('returns primitives unchanged', () => {
    expect(stripUndefined('x')).toBe('x')
    expect(stripUndefined(5)).toBe(5)
    expect(stripUndefined(null)).toBe(null)
  })
})
