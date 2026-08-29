// Phase 98 Plan 01 (R286). Pure-module test for osDetect.ts, mirroring
// monitorConfig.test.ts's plain fixture-object style — build `{ userAgent,
// platform, userAgentData }` fixtures rather than mutating the global
// navigator, so both the userAgentData path and the UA-string fallback path
// are exercised deterministically.
import { describe, it, expect } from 'vitest'
import { detectOS, detectBrowser, osLabel, browserLabel } from '@/utils/osDetect'
import type { NavigatorLike } from '@/utils/osDetect'

function makeNav(overrides: Partial<NavigatorLike> = {}): NavigatorLike {
  return {
    userAgent: 'Mozilla/5.0',
    ...overrides,
  }
}

describe('detectOS', () => {
  it('detects windows via userAgentData.platform', () => {
    const nav = makeNav({ userAgentData: { platform: 'Windows' } })
    expect(detectOS(nav)).toBe('windows')
  })

  it('detects macos via userAgentData.platform', () => {
    const nav = makeNav({ userAgentData: { platform: 'macOS' } })
    expect(detectOS(nav)).toBe('macos')
  })

  it('detects linux via userAgentData.platform', () => {
    const nav = makeNav({ userAgentData: { platform: 'Linux' } })
    expect(detectOS(nav)).toBe('linux')
  })

  it('falls back to navigator.platform when userAgentData is absent', () => {
    const nav = makeNav({ platform: 'Win32' })
    expect(detectOS(nav)).toBe('windows')
  })

  it('falls back to the UA string when both userAgentData and platform are absent', () => {
    const nav = makeNav({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    })
    expect(detectOS(nav)).toBe('windows')
  })

  it('excludes Android from the linux match', () => {
    const nav = makeNav({
      platform: 'Linux armv8l',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36',
    })
    expect(detectOS(nav)).toBe('unknown')
  })

  it('returns unknown for an unrecognized platform', () => {
    const nav = makeNav({ platform: 'FreeBSD', userAgent: 'Mozilla/5.0 (FreeBSD) Gecko/20100101 Firefox/128.0' })
    expect(detectOS(nav)).toBe('unknown')
  })
})

describe('detectBrowser', () => {
  it('detects edge via userAgentData.brands', () => {
    const nav = makeNav({
      userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Microsoft Edge' }, { brand: 'Not=A?Brand' }] },
    })
    expect(detectBrowser(nav)).toBe('edge')
  })

  it('detects chrome via userAgentData.brands', () => {
    const nav = makeNav({
      userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Google Chrome' }, { brand: 'Not=A?Brand' }] },
    })
    expect(detectBrowser(nav)).toBe('chrome')
  })

  it('checks Edge BEFORE Chrome when both brands are somehow present', () => {
    const nav = makeNav({
      userAgentData: { brands: [{ brand: 'Google Chrome' }, { brand: 'Microsoft Edge' }] },
    })
    expect(detectBrowser(nav)).toBe('edge')
  })

  it('returns other for a non-Chromium userAgentData.brands list', () => {
    const nav = makeNav({ userAgentData: { brands: [{ brand: 'Not=A?Brand' }] } })
    expect(detectBrowser(nav)).toBe('other')
  })

  it('falls back to UA-string parsing for Windows+Chrome when userAgentData is absent', () => {
    const nav = makeNav({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    })
    expect(detectBrowser(nav)).toBe('chrome')
  })

  it('falls back to UA-string parsing for Edge (checked before Chrome, since Edge UA also contains "Chrome/")', () => {
    const nav = makeNav({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
    })
    expect(detectBrowser(nav)).toBe('edge')
  })

  it('returns other for a non-Chromium UA string (e.g. Firefox)', () => {
    const nav = makeNav({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0' })
    expect(detectBrowser(nav)).toBe('other')
  })
})

describe('osLabel', () => {
  it('maps every DetectedOS to its human label', () => {
    expect(osLabel('windows')).toBe('Windows')
    expect(osLabel('macos')).toBe('macOS')
    expect(osLabel('linux')).toBe('Linux')
    expect(osLabel('unknown')).toBe('your computer')
  })
})

describe('browserLabel', () => {
  it('maps every DetectedBrowser to its human label', () => {
    expect(browserLabel('chrome')).toBe('Chrome')
    expect(browserLabel('edge')).toBe('Microsoft Edge')
    expect(browserLabel('other')).toBe('your browser')
  })
})
