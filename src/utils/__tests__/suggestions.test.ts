import { describe, it, expect } from 'vitest'
import { rankSongsForSlot } from '@/utils/suggestions'
import type { Song, VWType } from '@/types/song'

// Helper to create a mock Song with lastUsedAt as a timestamp-like object
function makeSong(overrides: Partial<Omit<Song, 'vwTypes'>> & { lastUsedMs?: number; vwTypes?: VWType[] }): Song {
  const { lastUsedMs, ...rest } = overrides
  return {
    id: 'song-1',
    title: 'Test Song',
    ccliNumber: '',
    author: '',
    themes: [],
    notes: '',
    vwTypes: [1],
    teamTags: [],
    arrangements: [],
    lastUsedAt: lastUsedMs != null ? { toMillis: () => lastUsedMs } as any : null,
    createdAt: { toMillis: () => 0 } as any,
    updatedAt: { toMillis: () => 0 } as any,
    pcSongId: null,
    hidden: false,
    ...rest,
  }
}

const NOW_MS = new Date('2026-03-04T00:00:00Z').getTime()
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const TWO_WEEKS_MS = 2 * ONE_WEEK_MS
const THREE_WEEKS_MS = 3 * ONE_WEEK_MS
const TEN_WEEKS_MS = 10 * ONE_WEEK_MS

describe('rankSongsForSlot - VW type prioritization', () => {
  it('returns empty array when songs array is empty', () => {
    const results = rankSongsForSlot([], 1, [], NOW_MS)
    expect(results).toHaveLength(0)
  })

  it('returns ALL songs regardless of VW type (no hard filter)', () => {
    const songs = [
      makeSong({ id: 's1', title: 'Type 1 Song', vwTypes: [1] }),
      makeSong({ id: 's2', title: 'Type 2 Song', vwTypes: [2] }),
      makeSong({ id: 's3', title: 'Type 3 Song', vwTypes: [3] }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results).toHaveLength(3)
    expect(results.map((r) => r.song.id)).toContain('s1')
    expect(results.map((r) => r.song.id)).toContain('s2')
    expect(results.map((r) => r.song.id)).toContain('s3')
  })

  it('uncategorized songs (vwTypes: []) appear in results (not filtered out)', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1] }),
      makeSong({ id: 's2', vwTypes: [] }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.song.id)).toContain('s1')
    expect(results.map((r) => r.song.id)).toContain('s2')
  })

  it('songs matching requiredVwType score +100 higher than equivalent non-matching songs', () => {
    const songs = [
      makeSong({ id: 'match', vwTypes: [1] }),    // never used: 500 + 100 = 600
      makeSong({ id: 'nomatch', vwTypes: [2] }),   // never used: 500 + 0 = 500
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    const matchResult = results.find((r) => r.song.id === 'match')!
    const noMatchResult = results.find((r) => r.song.id === 'nomatch')!
    expect(matchResult.score - noMatchResult.score).toBe(100)
  })

  it('uncategorized songs appear in results with no typeBonus', () => {
    const songs = [
      makeSong({ id: 'no-type', vwTypes: [] }),   // never used: 500 + 0 = 500
      makeSong({ id: 'match', vwTypes: [2] }),     // never used: 500 + 100 = 600
    ]
    const results = rankSongsForSlot(songs, 2, [], NOW_MS)
    const nullResult = results.find((r) => r.song.id === 'no-type')!
    const matchResult = results.find((r) => r.song.id === 'match')!
    // no type gets no bonus (same base score), match gets +100
    expect(matchResult.score).toBe(600)
    expect(nullResult.score).toBe(500)
  })

  it('with mixed VW types, matching type sorts first given equal recency', () => {
    const songs = [
      makeSong({ id: 'type2', vwTypes: [2] }),        // non-matching, never used: 500
      makeSong({ id: 'type1', vwTypes: [1] }),         // matching, never used: 600
      makeSong({ id: 'no-type', vwTypes: [] }),        // no type, never used: 500
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.song.id).toBe('type1')   // matching type first
    // non-matching and null both score 500, order among them doesn't matter
    expect(results.map((r) => r.song.id)).toContain('type2')
    expect(results.map((r) => r.song.id)).toContain('no-type')
  })

  it('multi-type song gets type bonus when one of its types matches', () => {
    const songs = [
      makeSong({ id: 'multi', vwTypes: [1, 2] }),   // matches type 1: 500 + 100 = 600
      makeSong({ id: 'type3', vwTypes: [3] }),        // no match: 500 + 0 = 500
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    const multiResult = results.find((r) => r.song.id === 'multi')!
    const type3Result = results.find((r) => r.song.id === 'type3')!
    expect(multiResult.score).toBe(600)
    expect(type3Result.score).toBe(500)
  })
})

describe('rankSongsForSlot - team filtering', () => {
  it('returns all songs when serviceTeams is empty (no team filter)', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1], teamTags: ['Choir'] }),
      makeSong({ id: 's2', vwTypes: [2], teamTags: ['Orchestra'] }),
      makeSong({ id: 's3', vwTypes: [1], teamTags: [] }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results).toHaveLength(3)
  })

  it('includes songs with empty teamTags regardless of serviceTeams (universal songs)', () => {
    const songs = [makeSong({ id: 's1', vwTypes: [1], teamTags: [] })]
    const results = rankSongsForSlot(songs, 1, ['Choir'], NOW_MS)
    expect(results).toHaveLength(1)
    expect(results[0]!.song.id).toBe('s1')
  })

  it('includes songs that have all required team tags (AND logic)', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1], teamTags: ['Choir', 'Orchestra'] }),
    ]
    const results = rankSongsForSlot(songs, 1, ['Choir', 'Orchestra'], NOW_MS)
    expect(results).toHaveLength(1)
  })

  it('excludes songs missing any required team tag', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1], teamTags: ['Choir'] }), // missing Orchestra
    ]
    const results = rankSongsForSlot(songs, 1, ['Choir', 'Orchestra'], NOW_MS)
    expect(results).toHaveLength(0)
  })

  it('excludes songs with only some matching team tags', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1], teamTags: ['Orchestra'] }),
    ]
    const results = rankSongsForSlot(songs, 1, ['Choir', 'Orchestra'], NOW_MS)
    expect(results).toHaveLength(0)
  })

  it('team filtering applies to all VW types (non-matching types also filtered by team)', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1], teamTags: ['Choir'] }),  // correct type, wrong team
      makeSong({ id: 's2', vwTypes: [2], teamTags: ['Choir'] }),  // wrong type, wrong team
      makeSong({ id: 's3', vwTypes: [1], teamTags: [] }),          // correct type, universal
    ]
    const results = rankSongsForSlot(songs, 1, ['Orchestra'], NOW_MS)
    // Only s3 (empty teamTags = universal) passes team filter
    expect(results).toHaveLength(1)
    expect(results[0]!.song.id).toBe('s3')
  })
})

describe('rankSongsForSlot - scoring', () => {
  it('never-used matching-type songs get score 600 (500 base + 100 typeBonus)', () => {
    const songs = [makeSong({ id: 's1', vwTypes: [1], lastUsedMs: undefined })]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.score).toBe(600)
    expect(results[0]!.weeksAgo).toBeNull()
    expect(results[0]!.isRecent).toBe(false)
  })

  it('never-used non-matching songs get score 500 (500 base + 0 typeBonus)', () => {
    const songs = [makeSong({ id: 's1', vwTypes: [2], lastUsedMs: undefined })]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.score).toBe(500)
  })

  it('recently-used matching songs (within 2 weeks) get score below 200', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1], lastUsedMs: NOW_MS - ONE_WEEK_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.score).toBeLessThan(200)
    expect(results[0]!.isRecent).toBe(true)
  })

  it('songs used exactly 1 week ago (matching type) get score 160 (60 + 100 typeBonus)', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1], lastUsedMs: NOW_MS - ONE_WEEK_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.score).toBe(160) // 50 + 1*10 + 100
    expect(results[0]!.weeksAgo).toBe(1)
  })

  it('songs used more than 2 weeks ago (matching type) get score 300 or above', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1], lastUsedMs: NOW_MS - THREE_WEEKS_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.score).toBeGreaterThanOrEqual(300)
    expect(results[0]!.isRecent).toBe(false)
  })

  it('songs used 3 weeks ago (matching type) get score 345 (245 + 100 typeBonus)', () => {
    const songs = [
      makeSong({ id: 's1', vwTypes: [1], lastUsedMs: NOW_MS - THREE_WEEKS_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.score).toBe(345) // 200 + 3*15 + 100
    expect(results[0]!.weeksAgo).toBe(3)
  })

  it('older songs score higher than newer songs of same type (staleness scoring)', () => {
    const songs = [
      makeSong({ id: 's_old', vwTypes: [1], lastUsedMs: NOW_MS - TEN_WEEKS_MS }),
      makeSong({ id: 's_new', vwTypes: [1], lastUsedMs: NOW_MS - THREE_WEEKS_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.song.id).toBe('s_old')
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score)
  })
})

describe('rankSongsForSlot - sorting', () => {
  it('returns results sorted by score descending (best suggestions first)', () => {
    const songs = [
      makeSong({ id: 's_recent', vwTypes: [1], lastUsedMs: NOW_MS - ONE_WEEK_MS }),
      makeSong({ id: 's_never', vwTypes: [1], lastUsedMs: undefined }),
      makeSong({ id: 's_stale', vwTypes: [1], lastUsedMs: NOW_MS - TEN_WEEKS_MS }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.song.id).toBe('s_never') // score 600 (500+100)
    expect(results[1]!.song.id).toBe('s_stale') // score 300+ (10 weeks + 100)
    expect(results[2]!.song.id).toBe('s_recent') // score < 200 (1 week + 100)
  })

  it('songs used in last 2 weeks appear in results but with lower score (deprioritized, not hidden)', () => {
    const songs = [
      makeSong({ id: 's_recent', vwTypes: [1], lastUsedMs: NOW_MS - ONE_WEEK_MS }),
      makeSong({ id: 's_never', vwTypes: [1], lastUsedMs: undefined }),
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    // Both songs appear
    expect(results).toHaveLength(2)
    // Recent song is last
    expect(results[results.length - 1]!.song.id).toBe('s_recent')
    expect(results[0]!.song.id).toBe('s_never')
  })

  it('matching-type songs rank above non-matching songs of same recency', () => {
    const songs = [
      makeSong({ id: 'type2-never', vwTypes: [2] }),  // 500+0=500
      makeSong({ id: 'type1-never', vwTypes: [1] }),  // 500+100=600
    ]
    const results = rankSongsForSlot(songs, 1, [], NOW_MS)
    expect(results[0]!.song.id).toBe('type1-never')
    expect(results[1]!.song.id).toBe('type2-never')
  })
})

describe('rankSongsForSlot - result shape', () => {
  it('returns SuggestionResult with song, score, weeksAgo, and isRecent', () => {
    const songs = [makeSong({ id: 's1', vwTypes: [2] })]
    const results = rankSongsForSlot(songs, 2, [], NOW_MS)
    expect(results[0]!).toHaveProperty('song')
    expect(results[0]!).toHaveProperty('score')
    expect(results[0]!).toHaveProperty('weeksAgo')
    expect(results[0]!).toHaveProperty('isRecent')
  })
})
