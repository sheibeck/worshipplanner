import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ServicePrintLayout from '../ServicePrintLayout.vue'
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
    vwTypes: [1],
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
    hidden: false,
    pcSongId: null,
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
    vwTypes: [2],
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
    hidden: false,
    pcSongId: null,
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
    { kind: 'SONG', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
    { kind: 'SONG', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
    { kind: 'MESSAGE', position: 7 },
    { kind: 'SONG', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
  ],
  sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
  notes: 'Communion Sunday — extended prayer time',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

describe('ServicePrintLayout', () => {
  it('renders all 9 slot rows from the service prop', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService, songs: mockSongs },
    })
    // Each slot should be rendered; check slot container has 9 children
    const slotRows = wrapper.findAll('[data-slot-row]')
    expect(slotRows).toHaveLength(9)
  })

  it('renders song title and key for a populated song slot', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService, songs: mockSongs },
    })
    expect(wrapper.text()).toContain('Come Thou Fount')
    expect(wrapper.text()).toContain('Key: G')
  })

  it('renders BPM for a song slot when available from arrangement', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService, songs: mockSongs },
    })
    // Come Thou Fount has BPM 96 in the G arrangement
    expect(wrapper.text()).toContain('96')
  })

  it('renders "[not assigned]" for empty song slots (songId is null)', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService, songs: mockSongs },
    })
    expect(wrapper.text()).toContain('[not assigned]')
  })

  it('renders sermon passage in the Message row when sermonPassage exists', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService, songs: mockSongs },
    })
    expect(wrapper.text()).toContain('Romans 8:1-11')
  })

  it('does not render sermon passage in Message row when sermonPassage is null', () => {
    const serviceNoPassage: Service = { ...mockService, sermonPassage: null }
    const wrapper = mount(ServicePrintLayout, {
      props: { service: serviceNoPassage, songs: mockSongs },
    })
    // Should still have Message label but no passage text
    expect(wrapper.text()).toContain('Message')
    expect(wrapper.text()).not.toContain('Romans')
  })

  it('renders notes section when service.notes is non-empty', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService, songs: mockSongs },
    })
    expect(wrapper.text()).toContain('Notes')
    expect(wrapper.text()).toContain('Communion Sunday')
  })

  it('does not render notes section when service.notes is empty string', () => {
    const serviceNoNotes: Service = { ...mockService, notes: '' }
    const wrapper = mount(ServicePrintLayout, {
      props: { service: serviceNoNotes, songs: mockSongs },
    })
    expect(wrapper.text()).not.toContain('Notes')
  })

  it('renders the formatted date in the header', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService, songs: mockSongs },
    })
    // date: '2026-03-08' should render as "Sunday, March 8, 2026"
    expect(wrapper.text()).toContain('March 8, 2026')
  })

  it('renders teams display in the header', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService, songs: mockSongs },
    })
    expect(wrapper.text()).toContain('Choir')
    expect(wrapper.text()).toContain('Orchestra')
  })
})
