import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SongTable from '../SongTable.vue'
import type { Song } from '@/types/song'

// Mirrors QuarterGrid.test.ts's pattern: mock the store modules directly rather
// than pulling in @pinia/testing (not a project dependency) or a real Pinia +
// firebase mock stack.
const mockUpdateSong = vi.fn(() => Promise.resolve())
const mockToggleColumn = vi.fn()
const mockResetColumns = vi.fn()
let mockColumnVisibility: Record<string, boolean> = {
  category: true,
  key: true,
  ccli: true,
  lastUsed: true,
  tags: true,
  themes: true,
}

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    get columnVisibility() { return mockColumnVisibility },
    allUserTags: [] as string[],
    updateSong: mockUpdateSong,
    toggleColumn: mockToggleColumn,
    resetColumns: mockResetColumns,
  }),
}))

let mockVwModeEnabled = true
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get vwModeEnabled() { return mockVwModeEnabled },
  }),
}))

// jsdom does not implement IntersectionObserver — SongTable's onMounted sets one
// up for scroll-based load-more. Stub it so mount() doesn't throw.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '12345',
    author: 'John Newton',
    themes: ['Grace', 'Redemption'],
    notes: '',
    vwTypes: [1],
    teamTags: ['Choir'],
    arrangements: [],
    primaryArrangementId: null,
    lastUsedAt: null,
    createdAt: {} as never,
    updatedAt: {} as never,
    pcSongId: null,
    hidden: false,
    tags: ['Christmas'],
    removedThemes: [],
    ...overrides,
  }
}

function mountTable(songs: Song[] = [makeSong()]) {
  return mount(SongTable, { props: { songs, loading: false } })
}

describe('SongTable', () => {
  beforeEach(() => {
    mockColumnVisibility = {
      category: true,
      key: true,
      ccli: true,
      lastUsed: true,
      tags: true,
      themes: true,
    }
    mockVwModeEnabled = true
    mockUpdateSong.mockClear()
    mockToggleColumn.mockClear()
    mockResetColumns.mockClear()
  })

  describe('column visibility', () => {
    it('does not render the Themes column header when columnVisibility.themes is false', () => {
      mockColumnVisibility = { ...mockColumnVisibility, themes: false }
      const wrapper = mountTable()
      const headers = wrapper.findAll('th').map((th) => th.text())
      expect(headers.some((h) => h.includes('Themes'))).toBe(false)
    })

    it('renders the Themes column header when columnVisibility.themes is true', () => {
      const wrapper = mountTable()
      const headers = wrapper.findAll('th').map((th) => th.text())
      expect(headers.some((h) => h.includes('Themes'))).toBe(true)
    })
  })

  describe('VW mode gating', () => {
    it('does not render the Category column header when vwModeEnabled is false', () => {
      mockVwModeEnabled = false
      const wrapper = mountTable()
      const headers = wrapper.findAll('th').map((th) => th.text())
      expect(headers.some((h) => h.includes('Category'))).toBe(false)
    })

    it('renders the Category column header when vwModeEnabled is true', () => {
      const wrapper = mountTable()
      const headers = wrapper.findAll('th').map((th) => th.text())
      expect(headers.some((h) => h.includes('Category'))).toBe(true)
    })
  })

  describe('Tags/Themes split', () => {
    it('renders tags in the Tags cell and themes in the Themes cell, with no team pills', () => {
      const wrapper = mountTable([
        makeSong({ tags: ['Christmas'], themes: ['Grace'], teamTags: ['Choir'] }),
      ])
      const text = wrapper.text()
      expect(text).toContain('Christmas')
      expect(text).toContain('Grace')
      // Team pills are gone — folded into tags upstream (D-01/D-12).
      expect(text).not.toContain('Choir')
    })
  })
})
