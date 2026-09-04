import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  FONT_LOAD_TIMEOUT_MS,
  FONT_CSS_LOADERS,
  cssVarsFor,
  snapWeight,
  waitForSlideFont,
} from '@/utils/slideTypography'

describe('slideTypography', () => {
  describe('FONT_LOAD_TIMEOUT_MS', () => {
    it('bounds the font-load gate at 3000ms', () => {
      expect(FONT_LOAD_TIMEOUT_MS).toBe(3000)
    })
  })

  describe('cssVarsFor', () => {
    it('returns the serif stack for a serif family', () => {
      const vars = cssVarsFor({ fontFamily: 'Lora', fontWeight: 600 })
      expect(vars).toEqual({
        '--slide-font-family': '"Lora", ui-serif, Georgia, serif',
        '--slide-font-weight': 600,
      })
    })

    it('returns the sans stack for a sans-category family', () => {
      const vars = cssVarsFor({ fontFamily: 'Inter', fontWeight: 400 })
      expect(vars).toEqual({
        '--slide-font-family': '"Inter", ui-sans-serif, system-ui, sans-serif',
        '--slide-font-weight': 400,
      })
    })

    it('falls back to Inter/400 for undefined input', () => {
      const vars = cssVarsFor(undefined)
      expect(vars).toEqual({
        '--slide-font-family': '"Inter", ui-sans-serif, system-ui, sans-serif',
        '--slide-font-weight': 400,
      })
    })

    it('falls back to Inter/400 for a tampered value (unknown family, unreachable weight)', () => {
      const vars = cssVarsFor({
        fontFamily: 'Comic Sans MS',
        fontWeight: 250,
      })
      expect(vars).toEqual({
        '--slide-font-family': '"Inter", ui-sans-serif, system-ui, sans-serif',
        '--slide-font-weight': 400,
      })
    })
  })

  describe('FONT_CSS_LOADERS (R126 Roboto wiring)', () => {
    it('registers a Roboto loader key alongside the other five families', () => {
      // Direct membership assertion (plan-checker advisory): loadFontCss
      // no-ops for an unknown family, so proving Roboto is a real loader key
      // is stronger than proving loadFontCss merely resolves.
      expect(FONT_CSS_LOADERS).toHaveProperty('Roboto')
      expect(typeof FONT_CSS_LOADERS['Roboto']).toBe('function')
      expect(Object.keys(FONT_CSS_LOADERS).sort()).toEqual(
        ['Inter', 'Lora', 'Open Sans', 'Poppins', 'Roboto', 'Source Serif 4'].sort(),
      )
    })
  })

  describe('snapWeight', () => {
    it('snaps to 400 when the family does not ship the requested weight', () => {
      expect(snapWeight('Lora', 300)).toBe(400)
    })

    it('keeps a weight that is reachable for the family', () => {
      expect(snapWeight('Inter', 300)).toBe(300)
    })

    it('snaps to 400 for an unknown family', () => {
      expect(snapWeight('Unknown', 700)).toBe(400)
    })
  })

  describe('waitForSlideFont', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('resolves ready when document.fonts.ready and document.fonts.load both settle', async () => {
      Object.defineProperty(document, 'fonts', {
        value: {
          ready: Promise.resolve(),
          load: vi.fn().mockResolvedValue([]),
        },
        configurable: true,
        writable: true,
      })

      const resultPromise = waitForSlideFont('Inter', 400)
      // Let the microtask queue settle without needing real timers.
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise
      expect(result).toBe(true)
    })

    it('resolves not-ready after FONT_LOAD_TIMEOUT_MS when the load promise never settles', async () => {
      Object.defineProperty(document, 'fonts', {
        value: {
          ready: Promise.resolve(),
          load: vi.fn(() => new Promise(() => {})),
        },
        configurable: true,
        writable: true,
      })

      const resultPromise = waitForSlideFont('Inter', 400)
      await vi.advanceTimersByTimeAsync(FONT_LOAD_TIMEOUT_MS)
      const result = await resultPromise
      expect(result).toBe(false)
    })

    // WR-02 (46-REVIEW.md): a REJECTED document.fonts.load() is a failed
    // load, not a stalled one — must resolve `false` immediately (well
    // before the timeout), not reject/propagate through Promise.race.
    it('resolves not-ready (does not reject) when document.fonts.load() rejects', async () => {
      Object.defineProperty(document, 'fonts', {
        value: {
          ready: Promise.resolve(),
          load: vi.fn(() => Promise.reject(new Error('font decode error'))),
        },
        configurable: true,
        writable: true,
      })

      const resultPromise = waitForSlideFont('Inter', 400)
      await vi.advanceTimersByTimeAsync(0)
      await expect(resultPromise).resolves.toBe(false)
    })
  })
})
