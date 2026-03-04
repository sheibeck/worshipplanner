import { describe, it, expect } from 'vitest'
import { rankSongsForSlot } from '@/utils/suggestions'
import type { Song } from '@/types/song'

// Helper to create a mock Song with lastUsedAt as a timestamp-like object
function makeSong(overrides: Partial<Song> & { lastUsedMs?: number }): Song {
  const { lastUsedMs, ...rest } = overrides
  return {
    id: 'song-1',
    title: 'Test Song',
    ccliNumber: '',
    author: '',
    themes: [],
    notes: '',
    vwType: 1,
    teamTags: [],
    arrangements: [],
    lastUsedAt: lastUsedMs != null ? { toMillis: () => lastUsedMs } as any : null,
    createdAt: { toMillis: () => 0 } as any,
    updatedAt: { toMillis: () => 0 } as any,
    ...rest,
  }
}

const NOW_MS = new Date('2026-03-04T00:00:00Z').getTime()
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const TWO_WEEKS_MS = 2 * ONE_WEEK_MS
const THREE_WEEKS_MS = 3 * ONE_WEEK_MS
const TEN_WEEKS_MS = 10 * ONE_WEEK_MS

describe('rankSongsForSlot - VW type filtering', () => {
  it('returns empty array when no songs match required VW type', () => {
    const songs = [makeSong({ id: 's1', vwType: 2 }), makeSong({ id: 's2', vwType: 3 })]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results).toHaveLength(0)
  })

  it('returns empty array when songs array is empty', () => {
    const results = rankSongsForSlot([], 1, [], NOW_MS)
    expect(results).toHaveLength(0)
  })

  it('only returns songs matching the required VW type', () => {
    const songs = [
      makeSong({ id: 's1', title: 'Type 1 Song', vwType: 1 }),
      makeSong({ id: 's2', title: 'Type 2 Song', vwType: 2 }),
      makeSong({ id: 's3', title: 'Another Type 1', vwType: 1 }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.song.id)).toContain('s1')
    expect(results.map((r) => r.song.id)).toContain('s3')
  })

  it('filters songs with null vwType out of results', () => {
    const songs = [
      makeSong({ id: 's1', vwType: 1 }),
      makeSong({ id: 's2', vwType: null }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results).toHaveLength(1)
    expect(results[0].song.id).toBe('s1')
  })
})

describe('rankSongsForSlot - team filtering', () => {
  it('returns all matching songs when serviceTeams is empty', () => {
    const songs = [
      makeSong({ id: 's1', vwType: 1, teamTags: ['Choir'] }),
      makeSong({ id: 's2', vwType: 1, teamTags: ['Orchestra'] }),
      makeSong({ id: 's3', vwType: 1, teamTags: [] }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results).toHaveLength(3)
  })

  it('includes songs with empty teamTags regardless of serviceTeams (universal songs)', () => {
    const songs = [makeSong({ id: 's1', vwType: 1, teamTags: [] })]
    const results = rankSongsForSlot(songs, 1, ['Choir'], NOW_MS)
    expect(results).toHaveLength(1)
    expect(results[0].song.id).toBe('s1')
  })

  it('includes songs that have all required team tags (AND logic)', () => {
    const songs = [
      makeSong({ id: 's1', vwType: 1, teamTags: ['Choir', 'Orchestra'] }),
    ]
    const results = rankSongsForSlot(songs, 1, ['Choir', 'Orchestra'], NOW_MS)
    expect(results).toHaveLength(1)
  })

  it('excludes songs missing any required team tag', () => {
    const songs = [
      makeSong({ id: 's1', vwType: 1, teamTags: ['Choir'] }), // missing Orchestra
    ]
    const results = rankSongsForSlot(songs, 1, ['Choir', 'Orchestra'], NOW_MS)
    expect(results).toHaveLength(0)
  })

  it('excludes songs with only some matching team tags', () => {
    const songs = [
      makeSong({ id: 's1', vwType: 1, teamTags: ['Orchestra'] }),
    ]
    const results = rankSongsForSlot(songs, 1, ['Choir', 'Orchestra'], NOW_MS)
    expect(results).toHaveLength(0)
  })
})

describe('rankSongsForSlot - scoring', () => {
  it('never-used songs get score 500', () => {
    const songs = [makeSong({ id: 's1', vwType: 1, lastUsedMs: undefined })]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0].score).toBe(500)
    expect(results[0].weeksAgo).toBeNull()
    expect(results[0].isRecent).toBe(false)
  })

  it('recently-used songs (within 2 weeks) get score below 100', () => {
    const songs = [
      makeSong({ id: 's1', vwType: 1, lastUsedMs: NOW_MS - ONE_WEEK_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0].score).toBeLessThan(100)
    expect(results[0].isRecent).toBe(true)
  })

  it('songs used exactly 1 week ago are recent with score 60', () => {
    const songs = [
      makeSong({ id: 's1', vwType: 1, lastUsedMs: NOW_MS - ONE_WEEK_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0].score).toBe(60) // 50 + 1*10
    expect(results[0].weeksAgo).toBe(1)
  })

  it('songs used more than 2 weeks ago get score 200 or above', () => {
    const songs = [
      makeSong({ id: 's1', vwType: 1, lastUsedMs: NOW_MS - THREE_WEEKS_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0].score).toBeGreaterThanOrEqual(200)
    expect(results[0].isRecent).toBe(false)
  })

  it('songs used 3 weeks ago get score 245', () => {
    const songs = [
      makeSong({ id: 's1', vwType: 1, lastUsedMs: NOW_MS - THREE_WEEKS_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0].score).toBe(245) // 200 + 3*15
    expect(results[0].weeksAgo).toBe(3)
  })

  it('older songs score higher than newer songs (staleness scoring)', () => {
    const songs = [
      makeSong({ id: 's_old', vwType: 1, lastUsedMs: NOW_MS - TEN_WEEKS_MS }),
      makeSong({ id: 's_new', vwType: 1, lastUsedMs: NOW_MS - THREE_WEEKS_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0].song.id).toBe('s_old')
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })
})

describe('rankSongsForSlot - sorting', () => {
  it('returns results sorted by score descending (best suggestions first)', () => {
    const songs = [
      makeSong({ id: 's_recent', vwType: 1, lastUsedMs: NOW_MS - ONE_WEEK_MS }),
      makeSong({ id: 's_never', vwType: 1, lastUsedMs: undefined }),
      makeSong({ id: 's_stale', vwType: 1, lastUsedMs: NOW_MS - TEN_WEEKS_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0].song.id).toBe('s_never') // score 500
    expect(results[1].song.id).toBe('s_stale') // score 200+ (10 weeks)
    expect(results[2].song.id).toBe('s_recent') // score < 100 (1 week)
  })

  it('songs used in last 2 weeks appear in results but with lower score (deprioritized, not hidden)', () => {
    const songs = [
      makeSong({ id: 's_recent', vwType: 1, lastUsedMs: NOW_MS - ONE_WEEK_MS }),
      makeSong({ id: 's_never', vwType: 1, lastUsedMs: undefined }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    // Both songs appear
    expect(results).toHaveLength(2)
    // Recent song is last
    expect(results[results.length - 1].song.id).toBe('s_recent')
    expect(results[0].song.id).toBe('s_never')
  })
})

describe('rankSongsForSlot - result shape', () => {
  it('returns SuggestionResult with song, score, weeksAgo, and isRecent', () => {
    const songs = [makeSong({ id: 's1', vwType: 2 })]
    const results = rankSongsForSlot(songs, 2, [], NOW_MS)
    expect(results[0]).toHaveProperty('song')
    expect(results[0]).toHaveProperty('score')
    expect(results[0]).toHaveProperty('weeksAgo')
    expect(results[0]).toHaveProperty('isRecent')
  })
})
