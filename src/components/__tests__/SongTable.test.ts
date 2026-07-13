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

// Singleton store object so a test can observe searchQuery mutations made by
// the listing's click-to-filter (filterByPill) behavior.
const mockSongStore = {
  get columnVisibility() { return mockColumnVisibility },
  allUserTags: [] as string[],
  searchQuery: '',
  updateSong: mockUpdateSong,
  toggleColumn: mockToggleColumn,
  resetColumns: mockResetColumns,
}

vi.mock('@/stores/songs', () => ({
  useSongStore: () => mockSongStore,
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
    mockSongStore.searchQuery = ''
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

    it('does not render inline add/remove controls on the listing (display-only)', () => {
      const wrapper = mountTable([makeSong({ tags: ['Christmas'], themes: ['Grace'] })])
      // No inline edit inputs and no remove/add affordances in the listing pills —
      // editing lives on the edit screen (SongSlideOver).
      expect(wrapper.find('input[placeholder="tag name"]').exists()).toBe(false)
      expect(wrapper.find('input[placeholder="theme name"]').exists()).toBe(false)
      expect(wrapper.find('button[aria-label="Remove tag"]').exists()).toBe(false)
      expect(wrapper.find('button[aria-label="Remove theme"]').exists()).toBe(false)
    })
  })

  describe('click-to-filter', () => {
    it('sets a tag:-scoped search query when a tag pill is clicked', async () => {
      const wrapper = mountTable([makeSong({ tags: ['Christmas'], themes: [] })])
      const tagPill = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Christmas' && s.attributes('title') === 'Filter by this tag')
      expect(tagPill).toBeTruthy()
      await tagPill!.trigger('click')
      expect(mockSongStore.searchQuery).toBe('tag:Christmas')
    })

    it('sets a theme:-scoped search query when a theme pill is clicked', async () => {
      const wrapper = mountTable([makeSong({ tags: [], themes: ['Grace'] })])
      const themePill = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Grace' && s.attributes('title') === 'Filter by this theme')
      expect(themePill).toBeTruthy()
      await themePill!.trigger('click')
      expect(mockSongStore.searchQuery).toBe('theme:Grace')
    })

    it('sets a type:-scoped search query when a category badge is clicked', async () => {
      const wrapper = mountTable([makeSong({ vwTypes: [2] })])
      // The inner clickable pill (not the SongBadge wrapper span) carries cursor-pointer.
      const badge = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Type 2' && s.classes().includes('cursor-pointer'))
      expect(badge).toBeTruthy()
      await badge!.trigger('click')
      expect(mockSongStore.searchQuery).toBe('type:2')
    })

    it('appends (does not replace) when a second pill is clicked — additive AND', async () => {
      const wrapper = mountTable([makeSong({ vwTypes: [2], tags: ['Acoustic'], themes: [] })])
      const badge = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Type 2' && s.classes().includes('cursor-pointer'))
      await badge!.trigger('click')
      expect(mockSongStore.searchQuery).toBe('type:2')

      const tagPill = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Acoustic' && s.attributes('title') === 'Filter by this tag')
      await tagPill!.trigger('click')
      // Both terms present, space-separated, in click order.
      expect(mockSongStore.searchQuery).toBe('type:2 tag:Acoustic')
    })

    it('preserves free text the user already typed and appends the pill term', async () => {
      mockSongStore.searchQuery = 'grace'
      const wrapper = mountTable([makeSong({ tags: ['Acoustic'], themes: [] })])
      const tagPill = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Acoustic' && s.attributes('title') === 'Filter by this tag')
      await tagPill!.trigger('click')
      expect(mockSongStore.searchQuery).toBe('grace tag:Acoustic')
    })

    it('does not stack duplicates when the same pill is clicked twice', async () => {
      const wrapper = mountTable([makeSong({ tags: ['Acoustic'], themes: [] })])
      const tagPill = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Acoustic' && s.attributes('title') === 'Filter by this tag')
      await tagPill!.trigger('click')
      await tagPill!.trigger('click')
      expect(mockSongStore.searchQuery).toBe('tag:Acoustic')
    })
  })
})
