import { describe, it, expect, vi } from 'vitest'

// deriveSlug/RESERVED_SLUGS are pure; claimSlug's Firestore create-only retry
// semantics are covered by the emulator-backed rules test (Task 2) — mock the
// Firestore/firebase modules here purely to avoid real Firebase app init at
// import time (`@/firebase`'s getAuth() throws on an invalid test API key).
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
}))
vi.mock('@/firebase', () => ({
  db: {},
}))

import { deriveSlug, RESERVED_SLUGS } from '@/utils/slug'

describe('deriveSlug', () => {
  it('lowercases and hyphenates a simple org name', () => {
    expect(deriveSlug('Grace Church')).toBe('grace-church')
  })

  it('strips non-alphanumerics to [a-z0-9-]+ only', () => {
    expect(deriveSlug("St. Paul's Community Church!")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    expect(deriveSlug("St. Paul's Community Church!")).toBe('st-paul-s-community-church')
  })

  it('trims leading/trailing hyphens produced by leading/trailing punctuation', () => {
    expect(deriveSlug('  --Grace Church--  ')).toBe('grace-church')
  })

  it('collapses runs of non-alphanumeric characters into a single hyphen', () => {
    expect(deriveSlug('Grace   &&&   Church')).toBe('grace-church')
  })

  it('matches the sanitization contract for arbitrary mixed input', () => {
    const result = deriveSlug('123 Main St. Fellowship (East Campus)')
    expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('a reserved word input derives to a value present in RESERVED_SLUGS', () => {
    const result = deriveSlug('Settings')
    expect(result).toBe('settings')
    expect(RESERVED_SLUGS.has(result)).toBe(true)
  })
})

describe('RESERVED_SLUGS', () => {
  it('contains all 12 reserved segments from D-19 (plus renamed /volunteers, /admins routes)', () => {
    const expected = [
      'songs',
      'roster',
      'volunteers',
      'schedule',
      'services',
      'team',
      'admins',
      'settings',
      'login',
      'share',
      'quarter-share',
      'public',
    ]
    expect(RESERVED_SLUGS.size).toBe(12)
    for (const word of expected) {
      expect(RESERVED_SLUGS.has(word)).toBe(true)
    }
  })
})
