import { describe, it, expect, vi } from 'vitest'
import { mintShareToken, pickAdoptableToken, shareTokenCreatedAtMillis } from '@/utils/shareTokens'
import type { ShareTokenCandidate } from '@/utils/shareTokens'

// Stub crypto for a deterministic, always-available getRandomValues in this environment
// (jsdom/node under Vitest may not expose it), mirroring services.test.ts lines 10-16. The
// stub is deterministic by design, so this file must never assert that two mints differ.
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i + 1
    return arr
  }),
})

describe('mintShareToken', () => {
  it('returns a string of length exactly 36', () => {
    expect(mintShareToken()).toHaveLength(36)
  })

  it('matches a lowercase-hex-only pattern anchored at both ends', () => {
    expect(mintShareToken()).toMatch(/^[0-9a-f]{36}$/)
  })
})

describe('shareTokenCreatedAtMillis', () => {
  it('returns the toMillis() value for a Firestore Timestamp-like object', () => {
    const ts = { toMillis: () => 1700000000000 }
    const result = shareTokenCreatedAtMillis(ts)
    expect(result).toBe(1700000000000)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('returns seconds*1000 plus the nanosecond remainder for a {seconds,nanoseconds} object', () => {
    const result = shareTokenCreatedAtMillis({ seconds: 1700000000, nanoseconds: 500000000 })
    expect(result).toBe(1700000000000 + 500)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('returns epoch milliseconds for a Date', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    const result = shareTokenCreatedAtMillis(date)
    expect(result).toBe(date.getTime())
    expect(Number.isFinite(result)).toBe(true)
  })

  it('returns 0 for null', () => {
    const result = shareTokenCreatedAtMillis(null)
    expect(result).toBe(0)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('returns 0 for undefined', () => {
    const result = shareTokenCreatedAtMillis(undefined)
    expect(result).toBe(0)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('returns 0 for an empty object', () => {
    const result = shareTokenCreatedAtMillis({})
    expect(result).toBe(0)
    expect(Number.isFinite(result)).toBe(true)
  })
})

describe('pickAdoptableToken', () => {
  it('1. returns null for an empty array', () => {
    expect(pickAdoptableToken([], 'org-1')).toBeNull()
  })

  it('2. returns the single candidate id for the acting org', () => {
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-only', orgId: 'org-1', createdAt: { seconds: 100, nanoseconds: 0 } },
    ]
    expect(pickAdoptableToken(candidates, 'org-1')).toBe('tok-only')
  })

  it('3. returns the newer id when supplied oldest-first', () => {
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-old', orgId: 'org-1', createdAt: { seconds: 100, nanoseconds: 0 } },
      { id: 'tok-new', orgId: 'org-1', createdAt: { seconds: 200, nanoseconds: 0 } },
    ]
    expect(pickAdoptableToken(candidates, 'org-1')).toBe('tok-new')
  })

  it('4. returns the same newer id when supplied newest-first (order independence)', () => {
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-new', orgId: 'org-1', createdAt: { seconds: 200, nanoseconds: 0 } },
      { id: 'tok-old', orgId: 'org-1', createdAt: { seconds: 100, nanoseconds: 0 } },
    ]
    expect(pickAdoptableToken(candidates, 'org-1')).toBe('tok-new')
  })

  it('5. breaks a byte-identical createdAt tie via lexicographically greatest id', () => {
    // WR-01 (41-REVIEW): array order (tok-a, tok-b) MATCHES alphabetical order, i.e. the
    // order a stable sort with a no-op/absent tiebreak would already produce unchanged.
    // Only the real tiebreak (b.id.localeCompare(a.id), which sorts the greatest id first)
    // reorders this to 'tok-b' — a no-op comparator would leave 'tok-a' first and fail here.
    const createdAt = { seconds: 500, nanoseconds: 0 }
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-a', orgId: 'org-1', createdAt },
      { id: 'tok-b', orgId: 'org-1', createdAt },
    ]
    expect(pickAdoptableToken(candidates, 'org-1')).toBe('tok-b')
  })

  it('6. a null createdAt loses to a resolved timestamp and does not throw', () => {
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-pending', orgId: 'org-1', createdAt: null },
      { id: 'tok-resolved', orgId: 'org-1', createdAt: { seconds: 100, nanoseconds: 0 } },
    ]
    expect(() => pickAdoptableToken(candidates, 'org-1')).not.toThrow()
    expect(pickAdoptableToken(candidates, 'org-1')).toBe('tok-resolved')
  })

  it('7. two null createdAt values still resolve deterministically via the id tiebreak', () => {
    // WR-01 (41-REVIEW): array order (tok-a, tok-b) MATCHES alphabetical order — see test 5's
    // comment for why the input order must oppose the expected output to actually exercise the
    // tiebreak rather than just observing stable-sort's order preservation.
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-a', orgId: 'org-1', createdAt: null },
      { id: 'tok-b', orgId: 'org-1', createdAt: null },
    ]
    expect(pickAdoptableToken(candidates, 'org-1')).toBe('tok-b')
  })

  it('8a. discards a candidate from a different org, returning null when it is the only one', () => {
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-foreign', orgId: 'org-2', createdAt: { seconds: 100, nanoseconds: 0 } },
    ]
    expect(pickAdoptableToken(candidates, 'org-1')).toBeNull()
  })

  it('8b. filters by org BEFORE sorting: a newer foreign-org candidate does not win', () => {
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-legit', orgId: 'org-1', createdAt: { seconds: 100, nanoseconds: 0 } },
      { id: 'tok-foreign-newer', orgId: 'org-2', createdAt: { seconds: 999, nanoseconds: 0 } },
    ]
    expect(pickAdoptableToken(candidates, 'org-1')).toBe('tok-legit')
  })

  it('9. does not mutate the input array', () => {
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-b', orgId: 'org-1', createdAt: { seconds: 200, nanoseconds: 0 } },
      { id: 'tok-a', orgId: 'org-1', createdAt: { seconds: 100, nanoseconds: 0 } },
    ]
    const idsBefore = candidates.map((c) => c.id)
    pickAdoptableToken(candidates, 'org-1')
    expect(candidates.map((c) => c.id)).toEqual(idsBefore)
    expect(candidates).toEqual([
      { id: 'tok-b', orgId: 'org-1', createdAt: { seconds: 200, nanoseconds: 0 } },
      { id: 'tok-a', orgId: 'org-1', createdAt: { seconds: 100, nanoseconds: 0 } },
    ])
  })

  it('mixed shapes: a Date, a {seconds} object, and a toMillis() object sort correctly together', () => {
    const oldest = new Date('2026-01-01T00:00:00.000Z') // 1767225600000
    const middle = { seconds: Math.floor(oldest.getTime() / 1000) + 1000, nanoseconds: 0 }
    const newest = { toMillis: () => oldest.getTime() + 5_000_000 }
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-oldest', orgId: 'org-1', createdAt: oldest },
      { id: 'tok-newest', orgId: 'org-1', createdAt: newest },
      { id: 'tok-middle', orgId: 'org-1', createdAt: middle },
    ]
    expect(pickAdoptableToken(candidates, 'org-1')).toBe('tok-newest')
  })

  it('discards a candidate whose orgId is missing entirely', () => {
    const candidates: ShareTokenCandidate[] = [
      { id: 'tok-no-org', createdAt: { seconds: 100, nanoseconds: 0 } },
    ]
    expect(pickAdoptableToken(candidates, 'org-1')).toBeNull()
  })
})
