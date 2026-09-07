// Phase 135 Plan 03 (R418) — pure staleness-filter tests for presenceRollup.
// Mirrors unconfirmedAssignments.test.ts's convention: no Firestore/Pinia,
// pure function only, isPresenceStale reused (not reimplemented).

import { describe, it, expect } from 'vitest'
import { activePresenceRows, type PresenceRollupRow } from '@/utils/presenceRollup'
import { PRESENCE_STALE_TTL_MS } from '@/utils/presence'

function row(overrides: Partial<PresenceRollupRow> = {}): PresenceRollupRow {
  return {
    serviceId: 'svc-1',
    serviceName: 'Sunday AM',
    uid: 'user-1',
    displayName: 'Alice',
    lastSeenMs: 1_000_000,
    ...overrides,
  }
}

describe('activePresenceRows', () => {
  it('keeps a row with lastSeenMs within the ttl of nowMs', () => {
    const nowMs = 1_000_000 + 10_000
    const input = [row({ lastSeenMs: 1_000_000 })]

    const result = activePresenceRows(input, nowMs, PRESENCE_STALE_TTL_MS)

    expect(result).toEqual(input)
  })

  it('drops a row with lastSeenMs older than the ttl', () => {
    const nowMs = 1_000_000 + PRESENCE_STALE_TTL_MS + 1
    const input = [row({ lastSeenMs: 1_000_000 })]

    const result = activePresenceRows(input, nowMs, PRESENCE_STALE_TTL_MS)

    expect(result).toEqual([])
  })

  it('drops a row with a null lastSeenMs (treated as stale)', () => {
    const input = [row({ lastSeenMs: null })]

    const result = activePresenceRows(input, Date.now(), PRESENCE_STALE_TTL_MS)

    expect(result).toEqual([])
  })

  it('drops a row with a NaN lastSeenMs (treated as stale)', () => {
    const input = [row({ lastSeenMs: NaN })]

    const result = activePresenceRows(input, Date.now(), PRESENCE_STALE_TTL_MS)

    expect(result).toEqual([])
  })

  it('returns [] for empty input', () => {
    expect(activePresenceRows([], Date.now(), PRESENCE_STALE_TTL_MS)).toEqual([])
  })

  it('preserves all input fields on a kept row', () => {
    const nowMs = 1_000_000
    const input = [
      row({
        serviceId: 'svc-2',
        serviceName: 'Wednesday PM',
        uid: 'user-2',
        displayName: 'Bob',
        lastSeenMs: 999_000,
      }),
    ]

    const result = activePresenceRows(input, nowMs, PRESENCE_STALE_TTL_MS)

    expect(result).toEqual(input)
  })
})
