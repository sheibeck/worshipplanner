import { describe, it, expect } from 'vitest'
import { songMatchesQuery, getPrimaryArrangement, getPrimaryKey } from '@/utils/songSearch'
import type { Song, VWType } from '@/types/song'

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '22025',
    author: 'John Newton',
    themes: ['grace', 'salvation'],
    notes: '',
    vwTypes: [1] as VWType[],
    teamTags: ['Choir'],
    tags: [],
    arrangements: [
      { id: 'arr-1', name: 'Standard', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
      { id: 'arr-2', name: 'Orchestra', key: 'A', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
    ],
    primaryArrangementId: null,
    lastUsedAt: null,
    createdAt: { toMillis: () => 0 } as never,
    updatedAt: { toMillis: () => 0 } as never,
    pcSongId: null,
    hidden: false,
    ...overrides,
  }
}

describe('songMatchesQuery', () => {
  it('returns true for empty query', () => {
    expect(songMatchesQuery(makeSong(), '')).toBe(true)
    expect(songMatchesQuery(makeSong(), '   ')).toBe(true)
  })

  it('matches title case-insensitively', () => {
    expect(songMatchesQuery(makeSong(), 'amazing')).toBe(true)
    expect(songMatchesQuery(makeSong(), 'GRACE')).toBe(true)
  })

  it('matches CCLI number', () => {
    expect(songMatchesQuery(makeSong(), '22025')).toBe(true)
  })

  it('matches author', () => {
    expect(songMatchesQuery(makeSong(), 'newton')).toBe(true)
  })

  it('matches a theme', () => {
    expect(songMatchesQuery(makeSong(), 'salvation')).toBe(true)
  })

  it('matches a team tag', () => {
    expect(songMatchesQuery(makeSong(), 'choir')).toBe(true)
  })

  it('matches category by number and by label', () => {
    expect(songMatchesQuery(makeSong({ vwTypes: [1] }), '1')).toBe(true)
    expect(songMatchesQuery(makeSong({ vwTypes: [1] }), 'call to worship')).toBe(true)
    expect(songMatchesQuery(makeSong({ vwTypes: [2] }), 'intimate')).toBe(true)
  })

  it('matches user tags (case-insensitive substring)', () => {
    const song = makeSong({ tags: ['Christmas'] })
    expect(songMatchesQuery(song, 'christmas')).toBe(true)
    expect(songMatchesQuery(song, 'Christ')).toBe(true)
  })

  it('matches notes (case-insensitive substring)', () => {
    const song = makeSong({ notes: 'quiet intro, builds slowly' })
    expect(songMatchesQuery(song, 'quiet intro')).toBe(true)
    expect(songMatchesQuery(song, 'INTRO')).toBe(true)
  })

  it('matches arrangement key exactly (case-insensitive)', () => {
    // arr-1 has key 'G', arr-2 has key 'A'
    const song = makeSong()
    expect(songMatchesQuery(song, 'g')).toBe(true)
    expect(songMatchesQuery(song, 'G')).toBe(true)
    expect(songMatchesQuery(song, 'a')).toBe(true)
    // Partial key should NOT match (exact match only)
    const songBb = makeSong({ title: 'Zzz', author: '', themes: [], teamTags: [], tags: [], ccliNumber: '', vwTypes: [],
      arrangements: [{ id: 'arr-1', name: 'Std', key: 'Bb', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] })
    expect(songMatchesQuery(songBb, 'b')).toBe(false)
  })

  it('returns false when nothing matches', () => {
    expect(songMatchesQuery(makeSong(), 'xylophone')).toBe(false)
  })
})

describe('getPrimaryArrangement / getPrimaryKey', () => {
  it('returns the arrangement matching primaryArrangementId', () => {
    const song = makeSong({ primaryArrangementId: 'arr-2' })
    expect(getPrimaryArrangement(song)?.id).toBe('arr-2')
    expect(getPrimaryKey(song)).toBe('A')
  })

  it('falls back to first arrangement when primaryArrangementId is null', () => {
    const song = makeSong({ primaryArrangementId: null })
    expect(getPrimaryArrangement(song)?.id).toBe('arr-1')
    expect(getPrimaryKey(song)).toBe('G')
  })

  it('falls back to first arrangement when primaryArrangementId is stale', () => {
    const song = makeSong({ primaryArrangementId: 'arr-gone' })
    expect(getPrimaryKey(song)).toBe('G')
  })

  it('returns empty string when there are no arrangements', () => {
    const song = makeSong({ arrangements: [], primaryArrangementId: null })
    expect(getPrimaryArrangement(song)).toBeUndefined()
    expect(getPrimaryKey(song)).toBe('')
  })
})
