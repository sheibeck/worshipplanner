import { describe, it, expect } from 'vitest'
import {
  RENDERED_PAGE_PAD,
  renderedPrefixFor,
  renderedObjectName,
  renderedPagePath,
} from '../renderedPagePaths'

// The same regex `functions/src/index.ts`'s RENDERED_OBJECT_NAME uses to recount pages
// server-side — reproduced here (not imported; no shared package boundary) so a padding
// or numbering regression fails this test independently of the server code.
const RENDERED_OBJECT_NAME_RE = /^page-(\d{4})\.png$/

describe('renderedPagePaths', () => {
  it('RENDERED_PAGE_PAD is 4', () => {
    expect(RENDERED_PAGE_PAD).toBe(4)
  })

  describe('renderedObjectName', () => {
    it('page 1 zero-pads to page-0001.png', () => {
      expect(renderedObjectName(1)).toBe('page-0001.png')
    })

    it('page 7 zero-pads to page-0007.png', () => {
      expect(renderedObjectName(7)).toBe('page-0007.png')
    })

    it('page 12 (the last page of a 12-page deck) zero-pads to page-0012.png', () => {
      expect(renderedObjectName(12)).toBe('page-0012.png')
    })

    it('every produced object name matches the server RENDERED_OBJECT_NAME regex', () => {
      for (const page of [1, 2, 7, 9, 10, 11, 12]) {
        expect(renderedObjectName(page)).toMatch(RENDERED_OBJECT_NAME_RE)
      }
    })
  })

  describe('renderedPrefixFor', () => {
    it('is byte-identical to the server-side convention', () => {
      expect(renderedPrefixFor('orgA', 'imp-1')).toBe('orgs/orgA/pptx-imports/imp-1/rendered/')
    })
  })

  describe('renderedPagePath', () => {
    it('composes prefix + object name for page 1', () => {
      expect(renderedPagePath('orgA', 'imp-1', 1)).toBe(
        'orgs/orgA/pptx-imports/imp-1/rendered/page-0001.png',
      )
    })

    describe('a 12-page deck', () => {
      it('resolves the FIRST page to page-0001.png', () => {
        expect(renderedPagePath('orgA', 'imp-1', 1)).toBe(
          'orgs/orgA/pptx-imports/imp-1/rendered/page-0001.png',
        )
      })

      it('resolves the LAST page (12) to page-0012.png — the off-by-one guard', () => {
        expect(renderedPagePath('orgA', 'imp-1', 12)).toBe(
          'orgs/orgA/pptx-imports/imp-1/rendered/page-0012.png',
        )
      })
    })
  })
})
