import { describe, it, expect } from 'vitest'
import {
  clampPct,
  pctWithinRect,
  zoneFromPoint,
  createMarker,
  markerKindAccentClass,
  MARKER_KINDS,
} from '../stageLayout'

const rect = (overrides?: Partial<{ left: number; top: number; width: number; height: number }>) => ({
  left: 100,
  top: 50,
  width: 400,
  height: 200,
  ...overrides,
})

describe('stageLayout helpers', () => {
  describe('clampPct', () => {
    it('clamps a value below 0 to 0', () => {
      expect(clampPct(-5)).toBe(0)
    })

    it('clamps a value above 100 to 100', () => {
      expect(clampPct(140)).toBe(100)
    })

    it('passes through a value already inside [0,100] unchanged', () => {
      expect(clampPct(37.5)).toBe(37.5)
    })
  })

  describe('pctWithinRect', () => {
    it('returns 0,0 for a point at the rect top-left corner', () => {
      const r = rect()
      expect(pctWithinRect(r.left, r.top, r)).toEqual({ xPct: 0, yPct: 0 })
    })

    it('returns 100,100 for a point at the rect bottom-right corner', () => {
      const r = rect()
      expect(pctWithinRect(r.left + r.width, r.top + r.height, r)).toEqual({ xPct: 100, yPct: 100 })
    })

    it('returns the correct mid-point percentage', () => {
      const r = rect()
      expect(pctWithinRect(r.left + r.width / 2, r.top + r.height / 2, r)).toEqual({ xPct: 50, yPct: 50 })
    })

    it('clamps rather than exceeds [0,100] for a point outside the rect', () => {
      const r = rect()
      expect(pctWithinRect(r.left - 1000, r.top - 1000, r)).toEqual({ xPct: 0, yPct: 0 })
      expect(pctWithinRect(r.left + r.width + 1000, r.top + r.height + 1000, r)).toEqual({ xPct: 100, yPct: 100 })
    })

    it('round-trips pct -> pixel -> pct within floating tolerance (R314 resize stability)', () => {
      const r = rect({ left: 37, top: 12, width: 733, height: 291 })
      const samplePcts = [0, 1.5, 12.34, 50, 66.667, 99.9, 100]
      for (const xPct of samplePcts) {
        for (const yPct of samplePcts) {
          const clientX = r.left + (xPct / 100) * r.width
          const clientY = r.top + (yPct / 100) * r.height
          const result = pctWithinRect(clientX, clientY, r)
          expect(result.xPct).toBeCloseTo(xPct, 6)
          expect(result.yPct).toBeCloseTo(yPct, 6)
        }
      }
    })
  })

  describe('zoneFromPoint', () => {
    const onstage = rect({ left: 0, top: 0, width: 300, height: 300 })
    const offstage = rect({ left: 400, top: 0, width: 200, height: 300 })

    it('returns onstage when the point is inside the onstage rect', () => {
      expect(zoneFromPoint(150, 150, { onstage, offstage }, 'onstage')).toBe('onstage')
    })

    it('returns offstage when the point is inside the offstage rect', () => {
      expect(zoneFromPoint(450, 150, { onstage, offstage }, 'offstage')).toBe('offstage')
    })

    it('returns the fallback zone when the point is inside neither rect', () => {
      expect(zoneFromPoint(350, 150, { onstage, offstage }, 'onstage')).toBe('onstage')
      expect(zoneFromPoint(350, 150, { onstage, offstage }, 'offstage')).toBe('offstage')
    })
  })

  describe('createMarker', () => {
    it('returns a StageMarker with a unique id and the given label/zone/position', () => {
      const marker = createMarker({ label: 'Drums', zone: 'offstage', xPct: 20, yPct: 30 })
      expect(marker.id).toBeTruthy()
      expect(typeof marker.id).toBe('string')
      expect(marker.label).toBe('Drums')
      expect(marker.zone).toBe('offstage')
      expect(marker.xPct).toBe(20)
      expect(marker.yPct).toBe(30)
    })

    it('mints a different id on each call', () => {
      const a = createMarker({ label: 'A', zone: 'onstage', xPct: 10, yPct: 10 })
      const b = createMarker({ label: 'B', zone: 'onstage', xPct: 10, yPct: 10 })
      expect(a.id).not.toBe(b.id)
    })

    it('omits the kind key entirely when kind is not supplied (never kind: undefined)', () => {
      const marker = createMarker({ label: 'Piano', zone: 'offstage', xPct: 40, yPct: 60 })
      expect('kind' in marker).toBe(false)
    })

    it('includes kind when supplied', () => {
      const marker = createMarker({ label: 'Lead Vocal', zone: 'onstage', xPct: 50, yPct: 20, kind: 'mic' })
      expect(marker.kind).toBe('mic')
    })
  })

  describe('markerKindAccentClass', () => {
    it('returns the dark sky class for instrument in dark theme', () => {
      expect(markerKindAccentClass('instrument', 'dark')).toBe('bg-sky-950 border-sky-800 text-sky-300')
    })

    it('returns the dark emerald class for mic in dark theme', () => {
      expect(markerKindAccentClass('mic', 'dark')).toBe('bg-emerald-950 border-emerald-800 text-emerald-300')
    })

    it('returns the dark amber class for monitor in dark theme', () => {
      expect(markerKindAccentClass('monitor', 'dark')).toBe('bg-amber-950 border-amber-800 text-amber-300')
    })

    it('returns the dark neutral class for other/undefined in dark theme', () => {
      expect(markerKindAccentClass('other', 'dark')).toBe('bg-gray-800 border-gray-600 text-gray-300')
      expect(markerKindAccentClass(undefined, 'dark')).toBe('bg-gray-800 border-gray-600 text-gray-300')
    })

    it('returns a lighter-tint equivalent for each kind in light theme', () => {
      expect(markerKindAccentClass('instrument', 'light')).toBe('bg-sky-100 border-sky-300 text-sky-700')
      expect(markerKindAccentClass('mic', 'light')).toBe('bg-emerald-100 border-emerald-300 text-emerald-700')
      expect(markerKindAccentClass('monitor', 'light')).toBe('bg-amber-100 border-amber-300 text-amber-700')
      expect(markerKindAccentClass('other', 'light')).toBe('bg-gray-100 border-gray-300 text-gray-700')
      expect(markerKindAccentClass(undefined, 'light')).toBe('bg-gray-100 border-gray-300 text-gray-700')
    })

    it('defaults to dark theme when theme is not supplied', () => {
      expect(markerKindAccentClass('mic')).toBe('bg-emerald-950 border-emerald-800 text-emerald-300')
    })
  })

  describe('MARKER_KINDS', () => {
    it('contains exactly the four kinds in order', () => {
      expect(MARKER_KINDS).toEqual(['instrument', 'mic', 'monitor', 'other'])
    })
  })
})
