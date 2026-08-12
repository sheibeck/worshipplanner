import { describe, it, expect } from 'vitest'
import { SLIDE_FONTS, SLIDE_FONT_FAMILY_NAMES } from '@/config/slideFonts'

describe('slideFonts registry', () => {
  it('has exactly the six expected family keys', () => {
    expect(Object.keys(SLIDE_FONTS).sort()).toEqual(
      ['Inter', 'Lora', 'Open Sans', 'Poppins', 'Roboto', 'Source Serif 4'].sort(),
    )
    expect(Object.keys(SLIDE_FONTS)).toHaveLength(6)
  })

  it('lists Inter first', () => {
    expect(Object.keys(SLIDE_FONTS)[0]).toBe('Inter')
    expect(SLIDE_FONT_FAMILY_NAMES[0]).toBe('Inter')
  })

  it('adds Roboto with the full 300-700 ramp and OFL-1.1 (R126)', () => {
    const roboto = SLIDE_FONTS['Roboto']!
    expect(roboto.package).toBe('@fontsource/roboto')
    expect(roboto.category).toBe('sans')
    expect(roboto.weights).toEqual([300, 400, 500, 600, 700])
    expect(roboto.license).toBe('OFL-1.1')
  })

  it('gives every entry an OFL-1.1 license and a non-empty licenseUrl', () => {
    for (const [name, def] of Object.entries(SLIDE_FONTS)) {
      expect(def.license, `${name} license`).toBe('OFL-1.1')
      expect(typeof def.licenseUrl, `${name} licenseUrl type`).toBe('string')
      expect(def.licenseUrl.length, `${name} licenseUrl non-empty`).toBeGreaterThan(0)
    }
  })

  it('excludes 300 from Lora (no Light weight shipped)', () => {
    expect(SLIDE_FONTS['Lora']!.weights).not.toContain(300)
  })

  it('includes 500 for Open Sans and Source Serif 4 (corrected from UI-SPEC)', () => {
    expect(SLIDE_FONTS['Open Sans']!.weights).toContain(500)
    expect(SLIDE_FONTS['Source Serif 4']!.weights).toContain(500)
  })

  it('never lists a weight outside the locked 300-700 ramp', () => {
    for (const [name, def] of Object.entries(SLIDE_FONTS)) {
      for (const weight of def.weights) {
        expect(weight, `${name} weight ${weight}`).toBeGreaterThanOrEqual(300)
        expect(weight, `${name} weight ${weight}`).toBeLessThanOrEqual(700)
      }
    }
  })

  it('derives SLIDE_FONT_FAMILY_NAMES from the registry keys', () => {
    expect(SLIDE_FONT_FAMILY_NAMES).toEqual(Object.keys(SLIDE_FONTS))
  })

  it('gives every entry a package name and a sans/serif category', () => {
    for (const [name, def] of Object.entries(SLIDE_FONTS)) {
      expect(def.package, `${name} package`).toMatch(/^@fontsource\//)
      expect(['sans', 'serif'], `${name} category`).toContain(def.category)
      expect(def.family).toBe(name)
    }
  })
})
