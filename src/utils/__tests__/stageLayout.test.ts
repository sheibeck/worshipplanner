import { describe, it, expect } from 'vitest'
import {
  clampPct,
  pctWithinRect,
  zoneFromPosition,
  placementLabel,
  createMarker,
  isGearKind,
  isInstrumentKind,
  markerIsInstrument,
  isGearMarker,
  roleInstrumentIcon,
  stageMarkerIcon,
  stageMarkerTypeLabel,
  stageTypeLabel,
  stageTileSkinClass,
  stagePaletteSkinClass,
  stageMarkerSkinClass,
  buildStagePalette,
  STAGE_KINDS,
  STAGE_KIND_META,
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
    it('clamps below 0, above 100, passes through in-range', () => {
      expect(clampPct(-5)).toBe(0)
      expect(clampPct(140)).toBe(100)
      expect(clampPct(37.5)).toBe(37.5)
    })
  })

  describe('pctWithinRect', () => {
    it('maps corners and mid-point to 0/50/100', () => {
      const r = rect()
      expect(pctWithinRect(r.left, r.top, r)).toEqual({ xPct: 0, yPct: 0 })
      expect(pctWithinRect(r.left + r.width, r.top + r.height, r)).toEqual({ xPct: 100, yPct: 100 })
      expect(pctWithinRect(r.left + r.width / 2, r.top + r.height / 2, r)).toEqual({ xPct: 50, yPct: 50 })
    })

    it('clamps a point outside the rect rather than exceeding [0,100]', () => {
      const r = rect()
      expect(pctWithinRect(r.left - 1000, r.top - 1000, r)).toEqual({ xPct: 0, yPct: 0 })
      expect(pctWithinRect(r.left + r.width + 1000, r.top + r.height + 1000, r)).toEqual({ xPct: 100, yPct: 100 })
    })

    it('round-trips pct -> pixel -> pct within floating tolerance (R314)', () => {
      const r = rect({ left: 37, top: 12, width: 733, height: 291 })
      for (const p of [0, 1.5, 12.34, 50, 66.667, 99.9, 100]) {
        const clientX = r.left + (p / 100) * r.width
        const clientY = r.top + (p / 100) * r.height
        const res = pctWithinRect(clientX, clientY, r)
        expect(res.xPct).toBeCloseTo(p, 6)
        expect(res.yPct).toBeCloseTo(p, 6)
      }
    })
  })

  describe('zoneFromPosition / placementLabel', () => {
    it('derives onstage inside the platform band, offstage in wings/apron', () => {
      expect(zoneFromPosition(50, 30)).toBe('onstage')
      expect(zoneFromPosition(5, 30)).toBe('offstage')
      expect(zoneFromPosition(50, 80)).toBe('offstage')
    })
    it('labels the three placement buckets', () => {
      expect(placementLabel(50, 30)).toBe('On stage')
      expect(placementLabel(50, 80)).toBe('In front of the stage')
      expect(placementLabel(4, 30)).toBe('Off stage · in the wing')
    })
  })

  describe('createMarker', () => {
    it('mints a unique id, keeps label/position, derives zone', () => {
      const m = createMarker({ label: 'X', xPct: 20, yPct: 30 })
      expect(typeof m.id).toBe('string')
      expect(m.label).toBe('X')
      expect(m.xPct).toBe(20)
      expect(m.yPct).toBe(30)
      expect(m.zone).toBe('onstage')
    })
    it('mints a different id each call and clamps out-of-range', () => {
      const a = createMarker({ label: 'A', xPct: 140, yPct: -20 })
      const b = createMarker({ label: 'B', xPct: 10, yPct: 10 })
      expect(a.id).not.toBe(b.id)
      expect(a.xPct).toBe(100)
      expect(a.yPct).toBe(0)
    })
    it('carries a fixed kind, or a band role, and omits absent keys', () => {
      const kindM = createMarker({ label: '', xPct: 50, yPct: 20, kind: 'lead' })
      expect(kindM.kind).toBe('lead')
      expect('roleId' in kindM).toBe(false)

      const roleM = createMarker({ label: '', xPct: 50, yPct: 20, roleId: 'r1', roleName: 'Electric Guitar' })
      expect(roleM.roleId).toBe('r1')
      expect(roleM.roleName).toBe('Electric Guitar')
      expect('kind' in roleM).toBe(false)

      const bare = createMarker({ label: 'Y', xPct: 40, yPct: 60 })
      expect('kind' in bare).toBe(false)
      expect('roleId' in bare).toBe(false)
    })
  })

  describe('kind registry', () => {
    it('has the fixed kinds only — no hardcoded band instruments', () => {
      expect(STAGE_KINDS).toContain('orchestra')
      expect(STAGE_KINDS).toContain('instrument')
      expect(STAGE_KINDS).not.toContain('electric')
      expect(STAGE_KINDS).not.toContain('drums')
    })
    it('renames the generic mic to "Microphone"', () => {
      expect(STAGE_KIND_META.mic.label).toBe('Microphone')
    })
    it('isGearKind / isInstrumentKind split correctly', () => {
      expect(isGearKind('monitor')).toBe(true)
      expect(isGearKind('lead')).toBe(false)
      expect(isGearKind(undefined)).toBe(true)
      expect(isInstrumentKind('orchestra')).toBe(true)
      expect(isInstrumentKind('instrument')).toBe(true)
      expect(isInstrumentKind('lead')).toBe(false)
    })
  })

  describe('roleInstrumentIcon', () => {
    it('maps common instrument role names to glyphs, falling back to music', () => {
      expect(roleInstrumentIcon('Electric Guitar')).toBe('guitar')
      expect(roleInstrumentIcon('Bass')).toBe('guitar')
      expect(roleInstrumentIcon('Keys / Piano')).toBe('piano')
      expect(roleInstrumentIcon('Drums')).toBe('drum')
      expect(roleInstrumentIcon('Cello')).toBe('strings')
      expect(roleInstrumentIcon('Saxophone')).toBe('music')
    })
  })

  describe('marker-level display helpers (kind OR band role)', () => {
    it('markerIsInstrument / isGearMarker treat a band role as a performer instrument', () => {
      expect(markerIsInstrument({ roleName: 'Electric Guitar' })).toBe(true)
      expect(isGearMarker({ roleName: 'Electric Guitar' })).toBe(false)
      expect(markerIsInstrument({ kind: 'orchestra' })).toBe(true)
      expect(markerIsInstrument({ kind: 'monitor' })).toBe(false)
      expect(isGearMarker({ kind: 'monitor' })).toBe(true)
    })
    it('stageMarkerIcon prefers the role glyph, else the kind glyph', () => {
      expect(stageMarkerIcon({ roleName: 'Drums' })).toBe('drum')
      expect(stageMarkerIcon({ kind: 'lead' })).toBe('mic-stage')
      expect(stageMarkerIcon({})).toBe('dot')
    })
    it('stageMarkerTypeLabel shows the role name / kind label, plus "+ Vocal"', () => {
      expect(stageMarkerTypeLabel({ roleName: 'Electric Guitar' })).toBe('Electric Guitar')
      expect(stageMarkerTypeLabel({ roleName: 'Electric Guitar', withVocal: true })).toBe('Electric Guitar + Vocal')
      expect(stageMarkerTypeLabel({ kind: 'lead' })).toBe('Lead vocal')
      // withVocal only applies to instruments, not a plain vocal mic
      expect(stageMarkerTypeLabel({ kind: 'mic', withVocal: true })).toBe('Microphone')
    })
    it('stageTypeLabel (fixed kind) matches, with instrument-only vocal suffix', () => {
      expect(stageTypeLabel('orchestra')).toBe('Orchestra')
      expect(stageTypeLabel('orchestra', true)).toBe('Orchestra + Vocal')
      expect(stageTypeLabel('mic', true)).toBe('Microphone')
      expect(stageTypeLabel(undefined)).toBe('')
    })
  })

  describe('skin classes', () => {
    it('performer kinds/markers take the indigo accent, gear stays neutral', () => {
      expect(stageTileSkinClass('lead', 'dark')).toContain('indigo')
      expect(stageTileSkinClass('monitor', 'dark')).toContain('gray')
      expect(stageMarkerSkinClass({ roleName: 'Bass' }, 'dark')).toContain('indigo')
      expect(stageMarkerSkinClass({ kind: 'monitor' }, 'dark')).toContain('gray')
      expect(stagePaletteSkinClass(false, 'dark')).toContain('indigo')
      expect(stagePaletteSkinClass(true, 'dark')).toContain('gray')
    })
    it('selected swaps to the bright accent border in both themes', () => {
      expect(stageTileSkinClass('lead', 'dark', true)).toContain('border-indigo-400')
      expect(stageMarkerSkinClass({ roleName: 'Bass' }, 'light', true)).toContain('border-indigo-500')
      expect(stageTileSkinClass(undefined, 'light')).not.toContain('undefined')
    })
  })

  describe('buildStagePalette', () => {
    it('mirrors band roles in the Instruments group, then Orchestra + Instrument extras', () => {
      const groups = buildStagePalette([
        { id: 'r1', name: 'Electric Guitar' },
        { id: 'r2', name: 'Drums' },
      ])
      expect(groups.map((g) => g.name)).toEqual(['Vocals', 'Instruments', 'Mics & DI', 'Gear'])

      const instruments = groups.find((g) => g.name === 'Instruments')!
      const ids = instruments.items.map((i) => i.id)
      // Band roles first, then the two fixed extras.
      expect(ids).toEqual(['role-r1', 'role-r2', 'orchestra', 'instrument'])

      const electric = instruments.items[0]!
      expect(electric.roleId).toBe('r1')
      expect(electric.roleName).toBe('Electric Guitar')
      expect(electric.icon).toBe('guitar')
      expect(electric.gear).toBe(false)
      expect(electric.kind).toBeUndefined()
    })

    it('renders an empty Instruments-roles set (still shows the two extras) when there are no band roles', () => {
      const groups = buildStagePalette([])
      const instruments = groups.find((g) => g.name === 'Instruments')!
      expect(instruments.items.map((i) => i.id)).toEqual(['orchestra', 'instrument'])
    })

    it('keeps the fixed Vocals / Mics & DI / Gear kinds', () => {
      const groups = buildStagePalette([])
      expect(groups.find((g) => g.name === 'Vocals')!.items.map((i) => i.kind)).toEqual(['lead', 'vocal', 'choir'])
      expect(groups.find((g) => g.name === 'Mics & DI')!.items.map((i) => i.kind)).toEqual(['mic', 'di'])
      expect(groups.find((g) => g.name === 'Gear')!.items.map((i) => i.kind)).toEqual(['monitor', 'amp', 'stand', 'power', 'tv', 'misc', 'communion'])
    })
  })
})
