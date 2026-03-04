import { describe, it, expect } from 'vitest'
import { formatForPlanningCenter, formatScriptureRef } from '@/utils/planningCenterExport'
import type { Service } from '@/types/service'
import type { Song } from '@/types/song'
import type { Timestamp } from 'firebase/firestore'

const mockTimestamp = { toDate: () => new Date('2026-03-04') } as unknown as Timestamp

const mockSongs: Song[] = [
  {
    id: 'song-0',
    title: 'Come Thou Fount',
    ccliNumber: '22025',
    author: 'Robert Robinson',
    themes: [],
    notes: '',
    vwType: 1,
    teamTags: [],
    arrangements: [
      {
        id: 'arr-0a',
        name: 'Standard',
        key: 'G',
        bpm: 96,
        lengthSeconds: null,
        chordChartUrl: '',
        notes: '',
        teamTags: [],
      },
    ],
    lastUsedAt: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
  {
    id: 'song-2',
    title: 'Great Is Thy Faithfulness',
    ccliNumber: '18723',
    author: 'Thomas Chisholm',
    themes: [],
    notes: '',
    vwType: 2,
    teamTags: [],
    arrangements: [
      {
        id: 'arr-2a',
        name: 'Standard',
        key: 'D',
        bpm: 72,
        lengthSeconds: null,
        chordChartUrl: '',
        notes: '',
        teamTags: [],
      },
    ],
    lastUsedAt: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
  {
    id: 'song-5',
    title: 'Holy Holy Holy',
    ccliNumber: '',
    author: 'Reginald Heber',
    themes: [],
    notes: '',
    vwType: 2,
    teamTags: [],
    arrangements: [
      {
        id: 'arr-5a',
        name: 'Standard',
        key: 'Eb',
        bpm: 80,
        lengthSeconds: null,
        chordChartUrl: '',
        notes: '',
        teamTags: [],
      },
    ],
    lastUsedAt: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
  {
    id: 'song-6',
    title: 'How Great Thou Art',
    ccliNumber: '14181',
    author: 'Carl Boberg',
    themes: [],
    notes: '',
    vwType: 3,
    teamTags: [],
    arrangements: [],
    lastUsedAt: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
  {
    id: 'song-8',
    title: 'Doxology',
    ccliNumber: '56266',
    author: 'Thomas Ken',
    themes: [],
    notes: '',
    vwType: 3,
    teamTags: [],
    arrangements: [],
    lastUsedAt: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
]

const mockService: Service = {
  id: 'svc-001',
  date: '2026-03-08',
  name: '',
  progression: '1-2-2-3',
  teams: ['Choir', 'Orchestra'],
  status: 'draft',
  slots: [
    { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-0', songTitle: 'Come Thou Fount', songKey: 'G' },
    { kind: 'SCRIPTURE', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
    { kind: 'SONG', position: 2, requiredVwType: 2, songId: 'song-2', songTitle: 'Great Is Thy Faithfulness', songKey: 'D' },
    { kind: 'PRAYER', position: 3 },
    { kind: 'SCRIPTURE', position: 4, book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
    { kind: 'SONG', position: 5, requiredVwType: 2, songId: 'song-5', songTitle: 'Holy Holy Holy', songKey: 'Eb' },
    { kind: 'SONG', position: 6, requiredVwType: 3, songId: 'song-6', songTitle: 'How Great Thou Art', songKey: 'A' },
    { kind: 'MESSAGE', position: 7 },
    { kind: 'SONG', position: 8, requiredVwType: 3, songId: 'song-8', songTitle: 'Doxology', songKey: 'G' },
  ],
  sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
  notes: 'Communion Sunday — extended prayer time',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

describe('formatForPlanningCenter', () => {
  it('includes the date in Month Day, Year format', () => {
    const result = formatForPlanningCenter(mockService, mockSongs)
    expect(result).toContain('March 8, 2026')
  })

  it('includes teams in the header', () => {
    const result = formatForPlanningCenter(mockService, mockSongs)
    expect(result).toContain('Teams: Choir, Orchestra')
  })

  it('includes progression in the header', () => {
    const result = formatForPlanningCenter(mockService, mockSongs)
    expect(result).toContain('Progression: 1-2-2-3')
  })

  it('formats song slots with title, key, and CCLI number', () => {
    const result = formatForPlanningCenter(mockService, mockSongs)
    expect(result).toContain('Song 1 -- Come Thou Fount (Key: G | CCLI #22025)')
  })

  it('omits CCLI when song has no CCLI number', () => {
    const result = formatForPlanningCenter(mockService, mockSongs)
    // Holy Holy Holy has empty CCLI
    expect(result).toContain('Song 3 -- Holy Holy Holy (Key: Eb)')
    expect(result).not.toContain('Holy Holy Holy (Key: Eb | CCLI #)')
  })

  it('formats scripture slots with book, chapter, and verse range', () => {
    const result = formatForPlanningCenter(mockService, mockSongs)
    expect(result).toContain('Scripture -- Psalms 23:1-6')
  })

  it('formats prayer slot as just "Prayer"', () => {
    const result = formatForPlanningCenter(mockService, mockSongs)
    expect(result).toContain('\nPrayer\n')
  })

  it('formats message slot with sermon passage when present', () => {
    const result = formatForPlanningCenter(mockService, mockSongs)
    expect(result).toContain('Message -- Romans 8:1-11')
  })

  it('formats message slot without passage when sermonPassage is null', () => {
    const serviceNoPassage: Service = { ...mockService, sermonPassage: null }
    const result = formatForPlanningCenter(serviceNoPassage, mockSongs)
    expect(result).toContain('\nMessage\n')
    expect(result).not.toContain('Message --')
  })

  it('shows [empty] for song slots with no songId', () => {
    const serviceEmptySlot: Service = {
      ...mockService,
      slots: mockService.slots.map((s) =>
        s.position === 0 ? { ...s, songId: null, songTitle: null, songKey: null } : s
      ),
    }
    const result = formatForPlanningCenter(serviceEmptySlot, mockSongs)
    expect(result).toContain('Song 1 -- [empty]')
  })

  it('includes notes section when notes are non-empty', () => {
    const result = formatForPlanningCenter(mockService, mockSongs)
    expect(result).toContain('Notes:')
    expect(result).toContain('Communion Sunday')
  })

  it('omits notes section when notes are empty', () => {
    const serviceNoNotes: Service = { ...mockService, notes: '' }
    const result = formatForPlanningCenter(serviceNoNotes, mockSongs)
    expect(result).not.toContain('Notes:')
  })

  it('includes service name when non-empty', () => {
    const serviceWithName: Service = { ...mockService, name: 'Easter Sunday' }
    const result = formatForPlanningCenter(serviceWithName, mockSongs)
    expect(result).toContain('Easter Sunday')
  })

  it('uses Standard Band when teams array is empty', () => {
    const serviceNoTeams: Service = { ...mockService, teams: [] }
    const result = formatForPlanningCenter(serviceNoTeams, mockSongs)
    expect(result).toContain('Teams: Standard Band')
  })
})

describe('formatForPlanningCenter - HYMN slots', () => {
  it('formats a filled HYMN slot as "Hymn -- {name} #{number} (vv. {verses})"', () => {
    const serviceWithHymn: Service = {
      ...mockService,
      slots: [
        { kind: 'HYMN', position: 0, hymnName: 'Amazing Grace', hymnNumber: '337', verses: '1, 3, 4' },
      ],
    }
    const result = formatForPlanningCenter(serviceWithHymn, mockSongs)
    expect(result).toContain('Hymn -- Amazing Grace #337 (vv. 1, 3, 4)')
  })

  it('formats a HYMN slot with empty hymnName as "Hymn -- [empty]"', () => {
    const serviceWithEmptyHymn: Service = {
      ...mockService,
      slots: [
        { kind: 'HYMN', position: 0, hymnName: '', hymnNumber: '', verses: '' },
      ],
    }
    const result = formatForPlanningCenter(serviceWithEmptyHymn, mockSongs)
    expect(result).toContain('Hymn -- [empty]')
  })
})

describe('formatScriptureRef', () => {
  it('formats a scripture reference correctly', () => {
    const ref = { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 }
    expect(formatScriptureRef(ref)).toBe('Romans 8:1-11')
  })

  it('formats single verse references', () => {
    const ref = { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }
    expect(formatScriptureRef(ref)).toBe('John 3:16-16')
  })
})
