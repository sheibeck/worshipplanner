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
    removedThemes: [],
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

describe('songMatchesQuery — field-scoped + phrases (Phase 12)', () => {
  it('matches tag: prefix as case-insensitive substring', () => {
    const song = makeSong({ tags: ['Orchestra'] })
    expect(songMatchesQuery(song, 'tag:orch')).toBe(true)
    expect(songMatchesQuery(song, 'tag:xyz')).toBe(false)
  })

  it('matches theme: prefix as case-insensitive substring', () => {
    const song = makeSong({ themes: ['Adoration'] })
    expect(songMatchesQuery(song, 'theme:ador')).toBe(true)
  })

  it('matches team: prefix as case-insensitive substring', () => {
    const song = makeSong({ teamTags: ['Choir'] })
    expect(songMatchesQuery(song, 'team:cho')).toBe(true)
  })

  it('matches type: prefix by number', () => {
    const song = makeSong({ vwTypes: [1] })
    expect(songMatchesQuery(song, 'type:1')).toBe(true)
    expect(songMatchesQuery(song, 'type:2')).toBe(false)
  })

  it('matches key: prefix exactly (case-insensitive)', () => {
    const song = makeSong({
      arrangements: [
        { id: 'arr-1', name: 'Std', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
        { id: 'arr-2', name: 'Alt', key: 'A', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
      ],
    })
    expect(songMatchesQuery(song, 'key:a')).toBe(true)
    expect(songMatchesQuery(song, 'key:e')).toBe(false)

    const songEm = makeSong({
      arrangements: [
        { id: 'arr-1', name: 'Std', key: 'Em', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
      ],
    })
    expect(songMatchesQuery(songEm, 'key:e')).toBe(false)
  })

  it('tolerates a space after the prefix colon', () => {
    const song = makeSong({
      arrangements: [
        { id: 'arr-1', name: 'Std', key: 'A', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
      ],
    })
    expect(songMatchesQuery(song, 'key: a')).toBe(true)
    expect(songMatchesQuery(song, 'key:a')).toBe(true)
  })

  it('recognizes natural two-word phrases "Type N" and "Key X"', () => {
    const songType1 = makeSong({ vwTypes: [1] })
    expect(songMatchesQuery(songType1, 'Type 1')).toBe(true)

    const songKeyA = makeSong({
      arrangements: [
        { id: 'arr-1', name: 'Std', key: 'A', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
      ],
    })
    expect(songMatchesQuery(songKeyA, 'Key A')).toBe(true)
  })

  it('does not infer type/key from a lone bare number or letter', () => {
    const song = makeSong({
      vwTypes: [2] as VWType[],
      title: 'Zzz',
      tags: [],
      themes: [],
      teamTags: [],
      ccliNumber: '',
      author: '',
      notes: '',
      arrangements: [],
    })
    expect(songMatchesQuery(song, '1')).toBe(false)
  })

  it('ANDs multiple field-scoped terms together', () => {
    const song = makeSong({
      tags: ['Orchestra'],
      arrangements: [
        { id: 'a', name: 'x', key: 'E', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
      ],
    })
    expect(songMatchesQuery(song, 'tag:orch key:E')).toBe(true)
    expect(songMatchesQuery(song, 'tag:orch key:G')).toBe(false)
  })

  it('ANDs multiple bare terms together', () => {
    const song = makeSong({ title: 'Amazing Grace' })
    expect(songMatchesQuery(song, 'amazing grace')).toBe(true)
    expect(songMatchesQuery(song, 'amazing xylophone')).toBe(false)
  })

  it('matches a multi-word field-scoped value as a single phrase (WR-02 fix)', () => {
    const song = makeSong({ tags: ['Christmas Eve'] })
    expect(songMatchesQuery(song, 'tag: christmas eve')).toBe(true)
    expect(songMatchesQuery(song, 'tag:christmas eve')).toBe(true)
    // A song without "eve" anywhere else should NOT match a query for an
    // unrelated single-word tag value.
    expect(songMatchesQuery(song, 'tag: christmas day')).toBe(false)
  })

  it('captures a multi-word field value up to the next recognized field prefix', () => {
    const song = makeSong({
      tags: ['Christmas Eve'],
      arrangements: [
        { id: 'a', name: 'x', key: 'E', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
      ],
    })
    expect(songMatchesQuery(song, 'tag: christmas eve key:E')).toBe(true)
    expect(songMatchesQuery(song, 'tag: christmas eve key:G')).toBe(false)
  })

  it('ANDs a multi-word field value with a separate bare term placed before it', () => {
    // A field-scoped value with no following recognized prefix greedily
    // captures the rest of the string, so a bare term must precede it to
    // remain a separate AND'd term (documented behavior of the greedy
    // to-end-of-string capture).
    const song = makeSong({ title: 'Silent Night', tags: ['Christmas Eve'] })
    expect(songMatchesQuery(song, 'silent tag: christmas eve')).toBe(true)
    expect(songMatchesQuery(song, 'xylophone tag: christmas eve')).toBe(false)
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
