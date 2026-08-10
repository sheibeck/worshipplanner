import { describe, it, expect } from 'vitest'
import type { Timestamp } from 'firebase/firestore'
import type { ImportedDeck } from '@/types/importedDeck'
import type { PptxRenderDoc } from '@/types/pptxRender'
import type { TextSlide, ImageSlide } from '@/types/slide'
import {
  RENDERED_PAGE_IDENTITY_PREFIX,
  resolveImportedRender,
  importedEntryIdentities,
  renderedPageNumberFromIdentity,
  importedEntryContent,
  importedSourceSignature,
  type ImportedRenderResolution,
} from '../importedRenderReconciler'

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp

function makeSlide(i: number): TextSlide | ImageSlide {
  return i % 2 === 0
    ? ({ id: `is-${i}`, position: i - 1, contentKind: 'text', body: `body ${i}` } as TextSlide)
    : ({ id: `is-${i}`, position: i - 1, contentKind: 'image', imageUrl: `https://example.com/${i}.png` } as ImageSlide)
}

function makeDeck(overrides: Partial<ImportedDeck> = {}): ImportedDeck {
  return {
    id: 'deck-1',
    sourceFileName: 'deck.pptx',
    section: 'pre-service',
    slides: [1, 2, 3, 4, 5].map(makeSlide),
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    renderImportId: 'render-1',
    ...overrides,
  }
}

describe('RENDERED_PAGE_IDENTITY_PREFIX', () => {
  it("is 'rendered-page-'", () => {
    expect(RENDERED_PAGE_IDENTITY_PREFIX).toBe('rendered-page-')
  })
})

describe('resolveImportedRender', () => {
  it('a deck with no renderImportId resolves to parsed, whatever render is', () => {
    const deck = makeDeck({ renderImportId: undefined })
    const readyRender: PptxRenderDoc = { status: 'ready', renderedCount: 5 }
    expect(resolveImportedRender(deck, readyRender)).toEqual({ mode: 'parsed', entryCount: 5 })
    expect(resolveImportedRender(deck, undefined)).toEqual({ mode: 'parsed', entryCount: 5 })
  })

  it('render === undefined resolves to pending', () => {
    const deck = makeDeck()
    expect(resolveImportedRender(deck, undefined)).toEqual({ mode: 'pending', entryCount: 5 })
  })

  it("render.status 'pending' resolves to pending", () => {
    const deck = makeDeck()
    const render: PptxRenderDoc = { status: 'pending' }
    expect(resolveImportedRender(deck, render)).toEqual({ mode: 'pending', entryCount: 5 })
  })

  it("render.status 'failed' resolves to failed, carrying failureReason", () => {
    const deck = makeDeck()
    const render: PptxRenderDoc = { status: 'failed', failureReason: 'render-service-error' }
    expect(resolveImportedRender(deck, render)).toEqual({
      mode: 'failed',
      entryCount: 5,
      failureReason: 'render-service-error',
    })
  })

  it("render.status 'failed' with a non-zero renderedCount (incomplete-render) still resolves to failed, keeping deck.slides.length as entryCount", () => {
    const deck = makeDeck()
    const render: PptxRenderDoc = { status: 'failed', renderedCount: 3, failureReason: 'incomplete-render' }
    expect(resolveImportedRender(deck, render)).toEqual({
      mode: 'failed',
      entryCount: 5,
      failureReason: 'incomplete-render',
    })
  })

  describe('renderedCount reconciliation against a 5-parsed-slide deck, ready status', () => {
    const deck = makeDeck()

    it('renderedCount 3 (< parsed) resolves to 3 ready entries', () => {
      const render: PptxRenderDoc = { status: 'ready', renderedCount: 3 }
      expect(resolveImportedRender(deck, render)).toEqual({ mode: 'ready', entryCount: 3 })
    })

    it('renderedCount 5 (== parsed) resolves to 5 ready entries', () => {
      const render: PptxRenderDoc = { status: 'ready', renderedCount: 5 }
      expect(resolveImportedRender(deck, render)).toEqual({ mode: 'ready', entryCount: 5 })
    })

    it('renderedCount 8 (> parsed) resolves to 8 ready entries', () => {
      const render: PptxRenderDoc = { status: 'ready', renderedCount: 8 }
      expect(resolveImportedRender(deck, render)).toEqual({ mode: 'ready', entryCount: 8 })
    })

    it('renderedCount 0 is the self-contradictory carve-out: resolves to failed, 5 entries, no failureReason', () => {
      const render: PptxRenderDoc = { status: 'ready', renderedCount: 0 }
      expect(resolveImportedRender(deck, render)).toEqual({ mode: 'failed', entryCount: 5 })
    })

    it('renderedCount absent on a ready doc is the same carve-out: resolves to failed, 5 entries, no failureReason', () => {
      const render: PptxRenderDoc = { status: 'ready' }
      expect(resolveImportedRender(deck, render)).toEqual({ mode: 'failed', entryCount: 5 })
    })
  })

  it('a deck with zero parsed slides and no render resolves to parsed/0 with no throw', () => {
    const deck = makeDeck({ slides: [] })
    expect(() => resolveImportedRender(deck, undefined)).not.toThrow()
    // no renderImportId change here — this deck still HAS a renderImportId, so
    // with no render doc at all it is pending, not parsed; assert that shape too.
    expect(resolveImportedRender(deck, undefined)).toEqual({ mode: 'pending', entryCount: 0 })
  })

  it('a deck with zero parsed slides and no renderImportId resolves to parsed/0 with no throw', () => {
    const deck = makeDeck({ slides: [], renderImportId: undefined })
    expect(() => resolveImportedRender(deck, undefined)).not.toThrow()
    expect(resolveImportedRender(deck, undefined)).toEqual({ mode: 'parsed', entryCount: 0 })
  })
})

describe('importedEntryIdentities', () => {
  const deck = makeDeck()

  it("mode 'ready' mints rendered-page-1..N synthetic identities", () => {
    const resolution: ImportedRenderResolution = { mode: 'ready', entryCount: 3 }
    expect(importedEntryIdentities(deck, resolution)).toEqual([
      'rendered-page-1',
      'rendered-page-2',
      'rendered-page-3',
    ])
  })

  it('any non-ready mode uses deck.slides ids, sliced to entryCount', () => {
    const resolution: ImportedRenderResolution = { mode: 'parsed', entryCount: 3 }
    expect(importedEntryIdentities(deck, resolution)).toEqual(['is-1', 'is-2', 'is-3'])
  })

  it('pending mode uses deck.slides ids at full entryCount', () => {
    const resolution: ImportedRenderResolution = { mode: 'pending', entryCount: 5 }
    expect(importedEntryIdentities(deck, resolution)).toEqual(['is-1', 'is-2', 'is-3', 'is-4', 'is-5'])
  })

  it("the returned array's length always equals resolution.entryCount", () => {
    const cases: ImportedRenderResolution[] = [
      { mode: 'parsed', entryCount: 5 },
      { mode: 'pending', entryCount: 5 },
      { mode: 'failed', entryCount: 5 },
      { mode: 'ready', entryCount: 8 },
    ]
    for (const resolution of cases) {
      expect(importedEntryIdentities(deck, resolution)).toHaveLength(resolution.entryCount)
    }
  })
})

describe('renderedPageNumberFromIdentity', () => {
  it("'rendered-page-12' -> 12", () => {
    expect(renderedPageNumberFromIdentity('rendered-page-12')).toBe(12)
  })

  it("'rendered-page-1' -> 1", () => {
    expect(renderedPageNumberFromIdentity('rendered-page-1')).toBe(1)
  })

  it('a parsed uuid -> null', () => {
    expect(renderedPageNumberFromIdentity('is-1')).toBeNull()
  })

  it("'rendered-page-0' -> null (no page 0)", () => {
    expect(renderedPageNumberFromIdentity('rendered-page-0')).toBeNull()
  })

  it("'rendered-page-x' -> null", () => {
    expect(renderedPageNumberFromIdentity('rendered-page-x')).toBeNull()
  })
})

describe('importedEntryContent', () => {
  const deck = makeDeck()

  it("mode 'parsed' finds the slide by id and strips id/position", () => {
    const resolution: ImportedRenderResolution = { mode: 'parsed', entryCount: 5 }
    const content = importedEntryContent(deck, resolution, 'is-1', undefined)
    expect(content).toEqual({ contentKind: 'image', imageUrl: 'https://example.com/1.png' })
  })

  it("mode 'parsed' returns undefined when the id no longer resolves", () => {
    const resolution: ImportedRenderResolution = { mode: 'parsed', entryCount: 5 }
    expect(importedEntryContent(deck, resolution, 'does-not-exist', undefined)).toBeUndefined()
  })

  it("mode 'pending' returns a pending image placeholder with no deck text", () => {
    const resolution: ImportedRenderResolution = { mode: 'pending', entryCount: 5 }
    const content = importedEntryContent(deck, resolution, 'is-1', undefined)
    expect(content).toEqual({ contentKind: 'image', imageUrl: '', renderState: 'pending' })
    expect(JSON.stringify(content)).not.toContain('body 2')
    expect(JSON.stringify(content)).not.toContain('example.com')
  })

  it("mode 'failed' returns a failed image placeholder carrying the failureReason, with no deck text", () => {
    const resolution: ImportedRenderResolution = { mode: 'failed', entryCount: 5, failureReason: 'incomplete-render' }
    const content = importedEntryContent(deck, resolution, 'is-1', undefined)
    expect(content).toEqual({
      contentKind: 'image',
      imageUrl: '',
      renderState: 'failed',
      renderFailureReason: 'incomplete-render',
    })
    expect(JSON.stringify(content)).not.toContain('body 2')
    expect(JSON.stringify(content)).not.toContain('example.com')
  })

  it("mode 'failed' with no failureReason omits renderFailureReason entirely", () => {
    const resolution: ImportedRenderResolution = { mode: 'failed', entryCount: 5 }
    const content = importedEntryContent(deck, resolution, 'is-1', undefined)
    expect(content).toEqual({ contentKind: 'image', imageUrl: '', renderState: 'failed' })
    expect(content).not.toHaveProperty('renderFailureReason')
  })

  it("mode 'ready' with a resolved URL returns imageUrl and no renderState", () => {
    const resolution: ImportedRenderResolution = { mode: 'ready', entryCount: 3 }
    const urls = ['https://cdn.example.com/page-0001.png', 'https://cdn.example.com/page-0002.png', 'https://cdn.example.com/page-0003.png']
    const content = importedEntryContent(deck, resolution, 'rendered-page-2', urls)
    expect(content).toEqual({ contentKind: 'image', imageUrl: 'https://cdn.example.com/page-0002.png' })
    expect(content).not.toHaveProperty('renderState')
  })

  it("mode 'ready' with renderedUrls absent resolves to a pending placeholder, never a broken image", () => {
    const resolution: ImportedRenderResolution = { mode: 'ready', entryCount: 3 }
    const content = importedEntryContent(deck, resolution, 'rendered-page-1', undefined)
    expect(content).toEqual({ contentKind: 'image', imageUrl: '', renderState: 'pending' })
  })

  it("mode 'ready' with renderedUrls shorter than the requested page resolves to a pending placeholder", () => {
    const resolution: ImportedRenderResolution = { mode: 'ready', entryCount: 3 }
    const urls = ['https://cdn.example.com/page-0001.png']
    const content = importedEntryContent(deck, resolution, 'rendered-page-3', urls)
    expect(content).toEqual({ contentKind: 'image', imageUrl: '', renderState: 'pending' })
  })

  // Regression: a deck's slides manually added into ANOTHER slot's group (e.g. a
  // Prayer group) keep the deck's PARSED-slide id as innerSlideId, not the
  // synthetic `rendered-page-N` identity. When parsed and rendered counts match
  // 1:1, ready mode must resolve them positionally instead of hanging on the
  // "Rendering" spinner forever.
  it("mode 'ready' resolves a hand-added entry keyed by a PARSED-slide id to its positional page URL when parsed/rendered counts match 1:1", () => {
    const resolution: ImportedRenderResolution = { mode: 'ready', entryCount: 5 } // deck has 5 parsed slides
    const urls = [1, 2, 3, 4, 5].map((n) => `https://cdn.example.com/page-000${n}.png`)
    // 'is-3' is deck.slides[2] → page 3 → urls[2]
    const content = importedEntryContent(deck, resolution, 'is-3', urls)
    expect(content).toEqual({ contentKind: 'image', imageUrl: 'https://cdn.example.com/page-0003.png' })
    expect(content).not.toHaveProperty('renderState')
  })

  it("mode 'ready' with a parsed-slide id but MISMATCHED parsed/rendered counts stays pending (multi-image positional-pairing guard)", () => {
    const resolution: ImportedRenderResolution = { mode: 'ready', entryCount: 3 } // deck has 5 parsed slides — counts differ
    const urls = ['https://cdn.example.com/page-0001.png', 'https://cdn.example.com/page-0002.png', 'https://cdn.example.com/page-0003.png']
    const content = importedEntryContent(deck, resolution, 'is-2', urls)
    expect(content).toEqual({ contentKind: 'image', imageUrl: '', renderState: 'pending' })
  })
})

describe('importedSourceSignature', () => {
  it('two decks whose parsed text differs only by a literal pipe character produce DIFFERENT signatures', () => {
    const deckA = makeDeck({
      slides: [
        { id: 'is-1', position: 0, contentKind: 'text', body: 'x|y' } as TextSlide,
        { id: 'is-2', position: 1, contentKind: 'text', body: 'z' } as TextSlide,
      ],
    })
    const deckB = makeDeck({
      slides: [
        { id: 'is-1', position: 0, contentKind: 'text', body: 'x' } as TextSlide,
        { id: 'is-2', position: 1, contentKind: 'text', body: 'y|z' } as TextSlide,
      ],
    })
    const resolutionA: ImportedRenderResolution = { mode: 'parsed', entryCount: 2 }
    const resolutionB: ImportedRenderResolution = { mode: 'parsed', entryCount: 2 }
    expect(importedSourceSignature(deckA, resolutionA)).not.toBe(importedSourceSignature(deckB, resolutionB))
  })

  it('the same (deck, resolution) twice produces an identical string', () => {
    const deck = makeDeck()
    const resolution: ImportedRenderResolution = { mode: 'ready', entryCount: 5 }
    expect(importedSourceSignature(deck, resolution)).toBe(importedSourceSignature(deck, resolution))
  })

  it('the same deck at pending, at failed, at ready/3 and at ready/4 produces four distinct strings', () => {
    const deck = makeDeck()
    const signatures = new Set([
      importedSourceSignature(deck, { mode: 'pending', entryCount: 5 }),
      importedSourceSignature(deck, { mode: 'failed', entryCount: 5 }),
      importedSourceSignature(deck, { mode: 'ready', entryCount: 3 }),
      importedSourceSignature(deck, { mode: 'ready', entryCount: 4 }),
    ])
    expect(signatures.size).toBe(4)
  })
})
