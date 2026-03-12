import { describe, it, expect } from 'vitest'
import { mapRowToSong, detectDuplicates, parseArrangementFromRow } from '@/utils/csvImport'
import type { Song } from '@/types/song'
import { Timestamp } from 'firebase/firestore'

// Helper to create a minimal existing Song for duplicate detection tests
function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '22025',
    author: 'John Newton',
    themes: [],
    notes: '',
    vwTypes: [],
    teamTags: [],
    arrangements: [],
    lastUsedAt: null,
    hidden: false,
    pcSongId: null,
    createdAt: Timestamp.fromMillis(0),
    updatedAt: Timestamp.fromMillis(0),
    ...overrides,
  }
}

describe('mapRowToSong', () => {
  it('maps "Title" header to song title', () => {
    const row = { Title: 'Amazing Grace', 'CCLI Number': '22025', Author: 'John Newton' }
    const result = mapRowToSong(row)
    expect(result.title).toBe('Amazing Grace')
  })

  it('maps "Song Title" header variant to song title', () => {
    const row = { 'Song Title': 'Holy Holy Holy', 'CCLI Number': '123' }
    const result = mapRowToSong(row)
    expect(result.title).toBe('Holy Holy Holy')
  })

  it('maps "CCLI Number" header to ccliNumber', () => {
    const row = { Title: 'Test', 'CCLI Number': '12345' }
    const result = mapRowToSong(row)
    expect(result.ccliNumber).toBe('12345')
  })

  it('maps "CCLI" header variant to ccliNumber', () => {
    const row = { Title: 'Test', CCLI: '12345' }
    const result = mapRowToSong(row)
    expect(result.ccliNumber).toBe('12345')
  })

  it('maps "CCLI #" header variant to ccliNumber', () => {
    const row = { Title: 'Test', 'CCLI #': '12345' }
    const result = mapRowToSong(row)
    expect(result.ccliNumber).toBe('12345')
  })

  it('maps "Author" header to author', () => {
    const row = { Title: 'Test', Author: 'Chris Tomlin' }
    const result = mapRowToSong(row)
    expect(result.author).toBe('Chris Tomlin')
  })

  it('maps "Copyright" header variant to author', () => {
    const row = { Title: 'Test', Copyright: 'Hillsong' }
    const result = mapRowToSong(row)
    expect(result.author).toBe('Hillsong')
  })

  it('maps "Themes" header to themes array split on comma', () => {
    const row = { Title: 'Test', Themes: 'Worship, Praise, Christmas' }
    const result = mapRowToSong(row)
    expect(result.themes).toEqual(['Worship', 'Praise', 'Christmas'])
  })

  it('maps "Tags" header variant to themes array', () => {
    const row = { Title: 'Test', Tags: 'Easter,Advent' }
    const result = mapRowToSong(row)
    expect(result.themes).toEqual(['Easter', 'Advent'])
  })

  it('maps Notes header to notes', () => {
    const row = { Title: 'Test', Notes: 'Important song' }
    const result = mapRowToSong(row)
    expect(result.notes).toBe('Important song')
  })

  it('sets vwType to null always (user categorizes later)', () => {
    const row = { Title: 'Test' }
    const result = mapRowToSong(row)
    expect(result.vwTypes).toEqual([])
  })

  it('starts with isDuplicate false', () => {
    const row = { Title: 'Test' }
    const result = mapRowToSong(row)
    expect(result.isDuplicate).toBe(false)
  })

  it('has empty _warnings for valid rows', () => {
    const row = { Title: 'Test', 'CCLI Number': '111' }
    const result = mapRowToSong(row)
    expect(result._warnings).toEqual([])
  })

  it('adds "Missing title" warning for empty title', () => {
    const row = { Title: '', Author: 'Someone' }
    const result = mapRowToSong(row)
    expect(result._warnings).toContain('Missing title')
  })

  it('adds "Missing title" warning when title headers absent', () => {
    const row = { Author: 'Someone', Notes: 'test' }
    const result = mapRowToSong(row)
    expect(result._warnings).toContain('Missing title')
  })

  it('computes song-level teamTags as union of arrangement teamTags', () => {
    const row = {
      Title: 'Test Song',
      'Arrangement 1 Name': 'Standard',
      'Arrangement 1 Tags': 'Band, Acoustic',
      'Arrangement 2 Name': 'Full Band',
      'Arrangement 2 Tags': 'Band, Orchestra',
    }
    const result = mapRowToSong(row)
    expect(result.teamTags).toEqual(expect.arrayContaining(['Band', 'Acoustic', 'Orchestra']))
    expect(result.teamTags.length).toBe(3) // Union, no duplicates
  })
})

describe('parseArrangementFromRow', () => {
  it('returns null when arrangement name is empty', () => {
    const row = { Title: 'Test' }
    const result = parseArrangementFromRow(row, 1)
    expect(result).toBeNull()
  })

  it('parses arrangement name from "Arrangement N Name" column', () => {
    const row = { 'Arrangement 1 Name': 'Default' }
    const result = parseArrangementFromRow(row, 1)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Default')
  })

  it('parses arrangement name from "Arrangement N" column variant', () => {
    const row = { 'Arrangement 1': 'Acoustic' }
    const result = parseArrangementFromRow(row, 1)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Acoustic')
  })

  it('parses BPM as number', () => {
    const row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 BPM': '120' }
    const result = parseArrangementFromRow(row, 1)
    expect(result!.bpm).toBe(120)
  })

  it('parses BPM from Tempo column variant', () => {
    const row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 Tempo': '72' }
    const result = parseArrangementFromRow(row, 1)
    expect(result!.bpm).toBe(72)
  })

  it('sets BPM to null when empty', () => {
    const row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 BPM': '' }
    const result = parseArrangementFromRow(row, 1)
    expect(result!.bpm).toBeNull()
  })

  it('sets BPM to null when non-numeric', () => {
    const row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 BPM': 'fast' }
    const result = parseArrangementFromRow(row, 1)
    expect(result!.bpm).toBeNull()
  })

  it('parses key from "Arrangement N Keys" column', () => {
    const row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 Keys': 'G' }
    const result = parseArrangementFromRow(row, 1)
    expect(result!.key).toBe('G')
  })

  it('parses key from "Arrangement N Key" column variant', () => {
    const row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 Key': 'Bb' }
    const result = parseArrangementFromRow(row, 1)
    expect(result!.key).toBe('Bb')
  })

  it('parses teamTags from "Arrangement N Tags" column split on comma', () => {
    const row = { 'Arrangement 1 Name': 'Full Band', 'Arrangement 1 Tags': 'Band, Strings, Acoustic' }
    const result = parseArrangementFromRow(row, 1)
    expect(result!.teamTags).toEqual(['Band', 'Strings', 'Acoustic'])
  })

  it('generates a unique id for each arrangement', () => {
    const row1 = { 'Arrangement 1 Name': 'A' }
    const row2 = { 'Arrangement 2 Name': 'B' }
    const r1 = parseArrangementFromRow(row1, 1)
    const r2 = parseArrangementFromRow(row2, 2)
    expect(r1!.id).not.toBe(r2!.id)
    expect(r1!.id.length).toBeGreaterThan(0)
  })

  it('parses up to 5 arrangements from a row', () => {
    const row: Record<string, string> = {}
    for (let i = 1; i <= 5; i++) {
      row[`Arrangement ${i} Name`] = `Arr ${i}`
    }
    // Build full song and check 5 arrangements come back
    const song = mapRowToSong({ Title: 'Test', ...row })
    expect(song.arrangements.length).toBe(5)
  })
})

describe('detectDuplicates', () => {
  it('returns songs with isDuplicate false when no existing songs', () => {
    const row = { Title: 'New Song', 'CCLI Number': '99999' }
    const parsed = [mapRowToSong(row)]
    const result = detectDuplicates(parsed, [])
    expect(result[0]!.isDuplicate).toBe(false)
  })

  it('flags duplicate by CCLI number match', () => {
    const existing = [makeSong({ ccliNumber: '22025' })]
    const row = { Title: 'Amazing Grace Different Spelling', 'CCLI Number': '22025' }
    const parsed = [mapRowToSong(row)]
    const result = detectDuplicates(parsed, existing)
    expect(result[0]!.isDuplicate).toBe(true)
  })

  it('does not flag non-duplicate when CCLI numbers differ', () => {
    const existing = [makeSong({ ccliNumber: '11111' })]
    const row = { Title: 'Different Song', 'CCLI Number': '99999' }
    const parsed = [mapRowToSong(row)]
    const result = detectDuplicates(parsed, existing)
    expect(result[0]!.isDuplicate).toBe(false)
  })

  it('flags duplicate by case-insensitive title when no CCLI on parsed song', () => {
    const existing = [makeSong({ title: 'Amazing Grace', ccliNumber: '' })]
    const row = { Title: 'amazing grace', 'CCLI Number': '' }
    const parsed = [mapRowToSong(row)]
    const result = detectDuplicates(parsed, existing)
    expect(result[0]!.isDuplicate).toBe(true)
  })

  it('flags duplicate by title case-insensitively with uppercase/mixed', () => {
    const existing = [makeSong({ title: 'How Great Is Our God', ccliNumber: '' })]
    const row = { Title: 'HOW GREAT IS OUR GOD' }
    const parsed = [mapRowToSong(row)]
    const result = detectDuplicates(parsed, existing)
    expect(result[0]!.isDuplicate).toBe(true)
  })

  it('does not use title matching when parsed song has CCLI (even if title matches)', () => {
    const existing = [makeSong({ title: 'Amazing Grace', ccliNumber: '99999' })]
    // Parsed song has different CCLI but same title — should NOT be flagged (CCLI mismatch)
    const row = { Title: 'Amazing Grace', 'CCLI Number': '11111' }
    const parsed = [mapRowToSong(row)]
    const result = detectDuplicates(parsed, existing)
    expect(result[0]!.isDuplicate).toBe(false)
  })

  it('handles multiple songs: flags only actual duplicates', () => {
    const existing = [makeSong({ ccliNumber: '22025', title: 'Amazing Grace' })]
    const rows = [
      mapRowToSong({ Title: 'Amazing Grace', 'CCLI Number': '22025' }), // duplicate
      mapRowToSong({ Title: 'New Song', 'CCLI Number': '99999' }),       // new
    ]
    const result = detectDuplicates(rows, existing)
    expect(result[0]!.isDuplicate).toBe(true)
    expect(result[1]!.isDuplicate).toBe(false)
  })

  it('skips CCLI-based match when existing song has no CCLI', () => {
    const existing = [makeSong({ ccliNumber: '', title: 'Some Song' })]
    const row = { Title: 'Other Song', 'CCLI Number': '' }
    const parsed = [mapRowToSong(row)]
    const result = detectDuplicates(parsed, existing)
    expect(result[0]!.isDuplicate).toBe(false)
  })
})
