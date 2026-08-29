// OS + browser detection for the Fullscreen Setup Helper (Phase 98, R286).
// Pure and framework-free — no Vue, Firebase, or Pinia imports — mirroring
// monitorConfig.ts's dependency-free module style so this stays trivially
// unit-testable.
//
// Both detectOS/detectBrowser read ONLY the injected `nav` param inside their
// bodies — the default value (`navigator`) is the ONE place the global is
// named, matching monitorConfig.ts's `resolveStorage(storage?)` injectable-
// seam idiom (98-PATTERNS "Pure-utility-module discipline"). This makes both
// functions testable with plain fixture objects, never a mutated global.
//
// Detection prefers `navigator.userAgentData` (Chromium-only Client Hints)
// and falls back to UA-string regex parsing when it is absent — the jsdom
// default, and also the real-world path for any non-Chromium browser
// (Firefox/Safari never populate userAgentData at all).

/** Minimal structural shape this module needs from a live/fixture navigator. */
export interface NavigatorLike {
  userAgent: string
  platform?: string
  userAgentData?: {
    platform?: string
    brands?: Array<{ brand: string }>
  }
}

export type DetectedOS = 'windows' | 'macos' | 'linux' | 'unknown'
export type DetectedBrowser = 'chrome' | 'edge' | 'other'

/**
 * Classifies the current OS from `nav`. Prefers `userAgentData.platform`,
 * then `navigator.platform`, then the UA string itself — any of the three
 * may carry the "Win"/"Mac"/"Linux" token depending on API availability.
 * Linux excludes Android (whose UA also contains "Linux").
 */
export function detectOS(nav: NavigatorLike = navigator): DetectedOS {
  const platform = nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent
  if (/win/i.test(platform)) return 'windows'
  if (/mac/i.test(platform)) return 'macos'
  if (/linux/i.test(platform) && !/android/i.test(nav.userAgent)) return 'linux'
  return 'unknown'
}

/**
 * Classifies the current browser from `nav`. Edge is checked BEFORE Chrome
 * in both the userAgentData brands list and the UA-string fallback, because
 * Edge's own UA string also contains the "Chrome/" token (it is Chromium-
 * based) — checking Chrome first would misclassify every Edge install.
 */
export function detectBrowser(nav: NavigatorLike = navigator): DetectedBrowser {
  const brands = nav.userAgentData?.brands
  if (brands) {
    const names = brands.map((b) => b.brand)
    if (names.some((b) => b.includes('Microsoft Edge'))) return 'edge'
    if (names.some((b) => b.includes('Google Chrome'))) return 'chrome'
    return 'other'
  }
  const ua = nav.userAgent
  if (/Edg\//.test(ua)) return 'edge' // new Edge token is "Edg/", not "Edge/"
  if (/Chrome\//.test(ua)) return 'chrome' // "Chrome/" also appears in Edge's UA — checked after Edge above
  return 'other'
}

/** Human-readable OS label for UI copy ("Download setup file for {browserLabel} on {osLabel}" — R286). */
export function osLabel(os: DetectedOS): string {
  switch (os) {
    case 'windows':
      return 'Windows'
    case 'macos':
      return 'macOS'
    case 'linux':
      return 'Linux'
    default:
      return 'your computer'
  }
}

/** Human-readable browser label for UI copy. */
export function browserLabel(browser: DetectedBrowser): string {
  switch (browser) {
    case 'chrome':
      return 'Chrome'
    case 'edge':
      return 'Microsoft Edge'
    default:
      return 'your browser'
  }
}
