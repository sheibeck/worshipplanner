import { describe, it, expect } from 'vitest'
import {
  computeLastUsedDate,
  isLockedStatus,
  serviceDateToMillis,
  serviceToLastUsedInput,
  type LastUsedServiceInput,
} from '@/utils/lastUsed'

describe('isLockedStatus', () => {
  it('draft is NOT locked', () => {
    expect(isLockedStatus('draft')).toBe(false)
  })

  it('planned is locked', () => {
    expect(isLockedStatus('planned')).toBe(true)
  })

  it('exported is locked', () => {
    expect(isLockedStatus('exported')).toBe(true)
  })
})

describe('computeLastUsedDate', () => {
  it('returns null for a song in NO service', () => {
    expect(computeLastUsedDate('song-1', [])).toBeNull()
  })

  it('returns null for a song only in DRAFT services (no locked service)', () => {
    const services: LastUsedServiceInput[] = [
      { status: 'draft', date: '2026-09-06', songIds: ['song-1'] },
    ]
    expect(computeLastUsedDate('song-1', services)).toBeNull()
  })

  it('returns the single locked date when the song is in exactly one locked service', () => {
    const services: LastUsedServiceInput[] = [
      { status: 'planned', date: '2026-09-06', songIds: ['song-1'] },
    ]
    expect(computeLastUsedDate('song-1', services)).toBe('2026-09-06')
  })

  it('returns the MAX date across multiple locked services — later date wins', () => {
    const services: LastUsedServiceInput[] = [
      { status: 'planned', date: '2026-08-11', songIds: ['song-1'] },
      { status: 'exported', date: '2026-09-06', songIds: ['song-1'] },
    ]
    expect(computeLastUsedDate('song-1', services)).toBe('2026-09-06')
  })

  it('an earlier locked service does not lower an already-later MAX', () => {
    const services: LastUsedServiceInput[] = [
      { status: 'exported', date: '2026-09-06', songIds: ['song-1'] },
      { status: 'planned', date: '2026-08-11', songIds: ['song-1'] },
    ]
    expect(computeLastUsedDate('song-1', services)).toBe('2026-09-06')
  })

  it('a tie: two locked services on the same date returns that date', () => {
    const services: LastUsedServiceInput[] = [
      { status: 'planned', date: '2026-09-06', songIds: ['song-1'] },
      { status: 'exported', date: '2026-09-06', songIds: ['song-1'] },
    ]
    expect(computeLastUsedDate('song-1', services)).toBe('2026-09-06')
  })

  it('only planned and exported count as locked — draft never contributes even with a later date', () => {
    const services: LastUsedServiceInput[] = [
      { status: 'planned', date: '2026-08-11', songIds: ['song-1'] },
      { status: 'draft', date: '2026-12-25', songIds: ['song-1'] },
    ]
    expect(computeLastUsedDate('song-1', services)).toBe('2026-08-11')
  })

  it('ignores locked services that do not contain the song', () => {
    const services: LastUsedServiceInput[] = [
      { status: 'planned', date: '2026-09-06', songIds: ['song-2'] },
    ]
    expect(computeLastUsedDate('song-1', services)).toBeNull()
  })

  it('does not throw on empty input', () => {
    expect(() => computeLastUsedDate('song-1', [])).not.toThrow()
  })
})

describe('serviceDateToMillis', () => {
  // WR-03 (84-REVIEW): UTC-midnight, not local-midnight — deterministic
  // regardless of the executing process's ambient timezone.
  it('matches the UTC-midnight parse convention', () => {
    expect(serviceDateToMillis('2026-09-06')).toBe(Date.UTC(2026, 8, 6))
  })

  it('is monotonic with calendar order', () => {
    expect(serviceDateToMillis('2026-08-11')).toBeLessThan(serviceDateToMillis('2026-09-06'))
  })

  it('is independent of the host process TZ (no local-time parse remains)', () => {
    expect(serviceDateToMillis('2026-01-01')).toBe(Date.UTC(2026, 0, 1))
    expect(serviceDateToMillis('2026-12-31')).toBe(Date.UTC(2026, 11, 31))
  })
})

describe('serviceToLastUsedInput', () => {
  it('extracts songIds from SONG slots only, ignoring other slot kinds and null songIds', () => {
    const service = {
      status: 'planned',
      date: '2026-09-06',
      slots: [
        { kind: 'SONG', songId: 'song-1' },
        { kind: 'SCRIPTURE', songId: undefined },
        { kind: 'SONG', songId: null },
        { kind: 'SONG', songId: 'song-2' },
        { kind: 'PRAYER' },
      ],
    }
    expect(serviceToLastUsedInput(service)).toEqual({
      status: 'planned',
      date: '2026-09-06',
      songIds: ['song-1', 'song-2'],
    })
  })

  it('returns an empty songIds array when the service has no SONG slots', () => {
    const service = { status: 'draft', date: '2026-09-06', slots: [{ kind: 'PRAYER' }] }
    expect(serviceToLastUsedInput(service)).toEqual({ status: 'draft', date: '2026-09-06', songIds: [] })
  })
})
