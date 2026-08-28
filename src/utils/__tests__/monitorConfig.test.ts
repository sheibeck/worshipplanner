import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeFingerprint,
  saveMapping,
  loadMapping,
  matchMapping,
  MONITOR_CONFIG_STORAGE_KEY,
} from '@/utils/monitorConfig'
import type { ScreenLike, MonitorMapping } from '@/utils/monitorConfig'

/** A minimal in-memory Storage-like stub, clearable between tests. */
function makeMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

/** A Storage-like stub whose getItem/setItem always throw (private-mode simulation). */
function makeThrowingStorage(): Storage {
  return {
    getItem: () => {
      throw new Error('storage disabled')
    },
    setItem: () => {
      throw new Error('storage disabled')
    },
    removeItem: () => {
      throw new Error('storage disabled')
    },
    clear: () => {
      throw new Error('storage disabled')
    },
    key: () => {
      throw new Error('storage disabled')
    },
    length: 0,
  } as Storage
}

function makeScreen(overrides: Partial<ScreenLike> = {}): ScreenLike {
  return {
    label: 'Screen 1',
    width: 1920,
    height: 1080,
    left: 0,
    top: 0,
    isPrimary: true,
    ...overrides,
  }
}

describe('computeFingerprint', () => {
  it('returns an identical string for two screens sharing label + resolution + position + isPrimary', () => {
    const a = makeScreen()
    const b = makeScreen()
    expect(computeFingerprint(a)).toBe(computeFingerprint(b))
  })

  it('differs when label differs', () => {
    const a = makeScreen({ label: 'Screen 1' })
    const b = makeScreen({ label: 'Screen 2' })
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b))
  })

  it('differs when width differs', () => {
    const a = makeScreen({ width: 1920 })
    const b = makeScreen({ width: 1280 })
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b))
  })

  it('differs when height differs', () => {
    const a = makeScreen({ height: 1080 })
    const b = makeScreen({ height: 720 })
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b))
  })

  it('differs when left differs', () => {
    const a = makeScreen({ left: 0 })
    const b = makeScreen({ left: 1920 })
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b))
  })

  it('differs when top differs', () => {
    const a = makeScreen({ top: 0 })
    const b = makeScreen({ top: 100 })
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b))
  })

  it('differs when isPrimary differs', () => {
    const a = makeScreen({ isPrimary: true })
    const b = makeScreen({ isPrimary: false })
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b))
  })

  it('degrades a missing label to a fixed placeholder rather than throwing', () => {
    const a = makeScreen({ label: undefined })
    expect(() => computeFingerprint(a)).not.toThrow()
    expect(typeof computeFingerprint(a)).toBe('string')
  })
})

describe('saveMapping / loadMapping', () => {
  let storage: Storage

  beforeEach(() => {
    storage = makeMemoryStorage()
  })

  it('round-trips a saved mapping', () => {
    const mapping: MonitorMapping = {
      assignments: [
        { fingerprint: 'fp-audience', role: 'audience' },
        { fingerprint: 'fp-confidence', role: 'confidence' },
      ],
      savedAt: 1700000000000,
    }
    saveMapping(mapping, storage)
    expect(loadMapping(storage)).toEqual(mapping)
  })

  it('returns null when nothing has been saved', () => {
    expect(loadMapping(storage)).toBeNull()
  })

  it('returns null (never throws) when the stored value is malformed JSON', () => {
    storage.setItem(MONITOR_CONFIG_STORAGE_KEY, '{not valid json')
    expect(() => loadMapping(storage)).not.toThrow()
    expect(loadMapping(storage)).toBeNull()
  })

  it('returns null when the stored value is valid JSON but the wrong shape', () => {
    storage.setItem(MONITOR_CONFIG_STORAGE_KEY, JSON.stringify({ unrelated: true }))
    expect(loadMapping(storage)).toBeNull()
  })

  it('saveMapping never throws when the storage backend throws; it silently no-ops', () => {
    const throwing = makeThrowingStorage()
    const mapping: MonitorMapping = { assignments: [{ fingerprint: 'fp-1', role: 'audience' }], savedAt: 1 }
    expect(() => saveMapping(mapping, throwing)).not.toThrow()
  })

  it('loadMapping never throws when the storage backend throws; it returns null', () => {
    const throwing = makeThrowingStorage()
    expect(() => loadMapping(throwing)).not.toThrow()
    expect(loadMapping(throwing)).toBeNull()
  })

  it('persists under a fixed device-scoped key with no uid/org interpolation', () => {
    expect(MONITOR_CONFIG_STORAGE_KEY).toBe('wp:runMonitorConfig:v1')
    const mapping: MonitorMapping = { assignments: [], savedAt: 1 }
    saveMapping(mapping, storage)
    expect(storage.getItem(MONITOR_CONFIG_STORAGE_KEY)).not.toBeNull()
  })

  it('saveMapping/loadMapping never throw (and degrade to no-op/null) when merely REFERENCING the global localStorage getter throws — no storageOverride, so resolveStorage\'s global-access branch is genuinely exercised', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: localStorage access blocked')
      },
    })
    try {
      const mapping: MonitorMapping = { assignments: [{ fingerprint: 'fp-1', role: 'audience' }], savedAt: 1 }
      expect(() => saveMapping(mapping)).not.toThrow()
      expect(() => loadMapping()).not.toThrow()
      expect(loadMapping()).toBeNull()
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor)
      } else {
        delete (globalThis as { localStorage?: unknown }).localStorage
      }
    }
  })
})

describe('matchMapping', () => {
  it('returns matched when every saved fingerprint is present among live screens', () => {
    const saved: MonitorMapping = {
      assignments: [
        { fingerprint: computeFingerprint(makeScreen({ label: 'A' })), role: 'audience' },
        { fingerprint: computeFingerprint(makeScreen({ label: 'B', left: 1920 })), role: 'confidence' },
      ],
      savedAt: 1,
    }
    const liveScreens = [makeScreen({ label: 'A' }), makeScreen({ label: 'B', left: 1920 })]
    const result = matchMapping(saved, liveScreens)
    expect(result.status).toBe('matched')
  })

  it('returns needs-reprompt when a saved fingerprint is absent from the live set', () => {
    const saved: MonitorMapping = {
      assignments: [{ fingerprint: computeFingerprint(makeScreen({ label: 'A' })), role: 'audience' }],
      savedAt: 1,
    }
    const liveScreens = [makeScreen({ label: 'Totally Different', width: 800, height: 600, left: 500, top: 500, isPrimary: false })]
    const result = matchMapping(saved, liveScreens)
    expect(result.status).toBe('needs-reprompt')
  })

  it('returns needs-reprompt when a NEW live screen not present in the saved mapping is plugged in (a genuinely added monitor)', () => {
    const saved: MonitorMapping = {
      assignments: [
        { fingerprint: computeFingerprint(makeScreen({ label: 'A' })), role: 'audience' },
        { fingerprint: computeFingerprint(makeScreen({ label: 'B', left: 1920 })), role: 'confidence' },
      ],
      savedAt: 1,
    }
    // Both previously-saved screens are still live (subset check alone would say
    // "matched"), PLUS a genuinely new third screen the mapping knows nothing about.
    const liveScreens = [
      makeScreen({ label: 'A' }),
      makeScreen({ label: 'B', left: 1920 }),
      makeScreen({ label: 'C', left: 3840, isPrimary: false }),
    ]
    const result = matchMapping(saved, liveScreens)
    expect(result.status).toBe('needs-reprompt')
  })
})
