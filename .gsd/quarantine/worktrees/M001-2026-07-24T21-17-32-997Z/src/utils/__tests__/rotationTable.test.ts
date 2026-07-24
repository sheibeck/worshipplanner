import { describe, it, expect } from 'vitest'
import { computeRotationTable } from '@/utils/rotationTable'
import type { Service, SongSlot, ScriptureSlot, NonAssignableSlot } from '@/types/service'

function makeService(overrides: {
  id: string
  date: string
  songSlots?: Array<{ position: number; songId: string | null; songTitle: string | null }>
}): Service {
  const { id, date, songSlots = [] } = overrides

  const slots: Service['slots'] = [
    // Build a minimal 9-slot template with song slots filled from overrides
    {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: songSlots.find((s) => s.position === 0)?.songId ?? null,
      songTitle: songSlots.find((s) => s.position === 0)?.songTitle ?? null,
      songKey: null,
    } as SongSlot,
    { kind: 'SCRIPTURE', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null } as ScriptureSlot,
    {
      kind: 'SONG',
      position: 2,
      requiredVwType: 2,
      songId: songSlots.find((s) => s.position === 2)?.songId ?? null,
      songTitle: songSlots.find((s) => s.position === 2)?.songTitle ?? null,
      songKey: null,
    } as SongSlot,
    { kind: 'PRAYER', position: 3 } as NonAssignableSlot,
    { kind: 'SCRIPTURE', position: 4, book: null, chapter: null, verseStart: null, verseEnd: null } as ScriptureSlot,
    {
      kind: 'SONG',
      position: 5,
      requiredVwType: 2,
      songId: songSlots.find((s) => s.position === 5)?.songId ?? null,
      songTitle: songSlots.find((s) => s.position === 5)?.songTitle ?? null,
      songKey: null,
    } as SongSlot,
    {
      kind: 'SONG',
      position: 6,
      requiredVwType: 3,
      songId: songSlots.find((s) => s.position === 6)?.songId ?? null,
      songTitle: songSlots.find((s) => s.position === 6)?.songTitle ?? null,
      songKey: null,
    } as SongSlot,
    { kind: 'MESSAGE', position: 7 } as NonAssignableSlot,
    {
      kind: 'SONG',
      position: 8,
      requiredVwType: 3,
      songId: songSlots.find((s) => s.position === 8)?.songId ?? null,
      songTitle: songSlots.find((s) => s.position === 8)?.songTitle ?? null,
      songKey: null,
    } as SongSlot,
  ]

  return {
    id,
    date,
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'planned',
    slots,
    sermonPassage: null,
    notes: '',
    createdAt: { toMillis: () => 0 } as any,
    updatedAt: { toMillis: () => 0 } as any,
  }
}

describe('computeRotationTable', () => {
  it('returns empty array for empty services list', () => {
    const result = computeRotationTable([])
    expect(result).toHaveLength(0)
  })

  it('returns empty array when all slots are unfilled (songId null)', () => {
    const services = [makeService({ id: 'svc1', date: '2026-03-01' })]
    const result = computeRotationTable(services)
    expect(result).toHaveLength(0)
  })

  it('includes a song that appears in one service', () => {
    const services = [
      makeService({
        id: 'svc1',
        date: '2026-03-01',
        songSlots: [{ position: 0, songId: 'song-a', songTitle: 'Song A' }],
      }),
    ]
    const result = computeRotationTable(services)
    expect(result).toHaveLength(1)
    expect(result[0]!.songId).toBe('song-a')
    expect(result[0]!.songTitle).toBe('Song A')
    expect(result[0]!.dates).toEqual(['2026-03-01'])
  })

  it('collects all dates when a song appears in multiple services', () => {
    const services = [
      makeService({
        id: 'svc1',
        date: '2026-03-01',
        songSlots: [{ position: 0, songId: 'song-a', songTitle: 'Song A' }],
      }),
      makeService({
        id: 'svc2',
        date: '2026-03-08',
        songSlots: [{ position: 0, songId: 'song-a', songTitle: 'Song A' }],
      }),
    ]
    const result = computeRotationTable(services)
    expect(result).toHaveLength(1)
    expect(result[0]!.songId).toBe('song-a')
    expect(result[0]!.dates).toContain('2026-03-01')
    expect(result[0]!.dates).toContain('2026-03-08')
    expect(result[0]!.dates).toHaveLength(2)
  })

  it('handles multiple songs across multiple services', () => {
    const services = [
      makeService({
        id: 'svc1',
        date: '2026-03-01',
        songSlots: [
          { position: 0, songId: 'song-a', songTitle: 'Song A' },
          { position: 2, songId: 'song-b', songTitle: 'Song B' },
        ],
      }),
      makeService({
        id: 'svc2',
        date: '2026-03-08',
        songSlots: [
          { position: 0, songId: 'song-b', songTitle: 'Song B' },
          { position: 5, songId: 'song-c', songTitle: 'Song C' },
        ],
      }),
    ]
    const result = computeRotationTable(services)
    expect(result).toHaveLength(3)

    const songB = result.find((r) => r.songId === 'song-b')
    expect(songB).toBeDefined()
    expect(songB!.dates).toHaveLength(2)
  })

  it('skips slots with null songId (unfilled slots)', () => {
    const services = [
      makeService({
        id: 'svc1',
        date: '2026-03-01',
        songSlots: [
          { position: 0, songId: 'song-a', songTitle: 'Song A' },
          { position: 2, songId: null, songTitle: null },
        ],
      }),
    ]
    const result = computeRotationTable(services)
    expect(result).toHaveLength(1)
    expect(result[0]!.songId).toBe('song-a')
  })

  it('returns results sorted alphabetically by songTitle', () => {
    const services = [
      makeService({
        id: 'svc1',
        date: '2026-03-01',
        songSlots: [
          { position: 0, songId: 'song-z', songTitle: 'Zebra Song' },
          { position: 2, songId: 'song-a', songTitle: 'Amazing Grace' },
          { position: 5, songId: 'song-m', songTitle: 'Mighty to Save' },
        ],
      }),
    ]
    const result = computeRotationTable(services)
    expect(result[0]!.songTitle).toBe('Amazing Grace')
    expect(result[1]!.songTitle).toBe('Mighty to Save')
    expect(result[2]!.songTitle).toBe('Zebra Song')
  })

  it('does not include songs with no appearances (only filled slots count)', () => {
    const services = [makeService({ id: 'svc1', date: '2026-03-01', songSlots: [] })]
    const result = computeRotationTable(services)
    expect(result).toHaveLength(0)
  })

  it('handles same song in multiple slots in the same service', () => {
    const services = [
      makeService({
        id: 'svc1',
        date: '2026-03-01',
        songSlots: [
          { position: 0, songId: 'song-a', songTitle: 'Song A' },
          { position: 2, songId: 'song-a', songTitle: 'Song A' }, // same song twice
        ],
      }),
    ]
    const result = computeRotationTable(services)
    const entry = result.find((r) => r.songId === 'song-a')
    expect(entry).toBeDefined()
    // Date appears once per service (not once per slot)
    expect(entry!.dates).toHaveLength(1)
    expect(entry!.dates[0]).toBe('2026-03-01')
  })
})
