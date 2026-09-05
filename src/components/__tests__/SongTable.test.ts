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
  files: true,
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
let mockPcEnabled = true
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get vwModeEnabled() { return mockVwModeEnabled },
    settings: {
      get pcEnabled() { return mockPcEnabled },
    },
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
      files: true,
    }
    mockVwModeEnabled = true
    mockPcEnabled = true
    mockSongStore.searchQuery = ''
    mockUpdateSong.mockClear()
    mockToggleColumn.mockClear()
    mockResetColumns.mockClear()
  })

  describe('empty-state import button (KHB-01, KHB-02)', () => {
    it('renders an "Import Songs" button (not "Import from CSV") when pcEnabled is true, and clicking it emits import', async () => {
      const wrapper = mountTable([])
      const buttons = wrapper.findAll('button')
      const importButton = buttons.find((b) => b.text().includes('Import Songs'))
      expect(importButton).toBeTruthy()
      expect(wrapper.text()).not.toContain('Import from CSV')
      await importButton!.trigger('click')
      expect(wrapper.emitted('import')).toBeTruthy()
    })

    it('does not render the Import Songs button when pcEnabled is false, but keeps the Add Song button', () => {
      mockPcEnabled = false
      const wrapper = mountTable([])
      const buttons = wrapper.findAll('button')
      expect(buttons.some((b) => b.text().includes('Import Songs'))).toBe(false)
      expect(buttons.some((b) => b.text().includes('Add Song'))).toBe(true)
    })

    it('the empty-state Add Song button emits add when clicked', async () => {
      const wrapper = mountTable([])
      const addButton = wrapper.findAll('button').find((b) => b.text().includes('Add Song'))
      expect(addButton).toBeTruthy()
      await addButton!.trigger('click')
      expect(wrapper.emitted('add')).toBeTruthy()
    })
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
        makeSong({ tags: ['Christmas', 'Choir'], themes: ['Grace'] }),
      ])
      const text = wrapper.text()
      expect(text).toContain('Christmas')
      expect(text).toContain('Grace')
      // Team tags are folded into the flat tags set upstream (D-01/D-12) — 'Choir'
      // renders as an ordinary tag pill alongside 'Christmas', not a separate team pill.
      expect(text).toContain('Choir')
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

    // WR-01: a whitespace-token de-dupe check breaks for multi-word tag/theme
    // values (e.g. "tag:Christmas Eve" fragments into two tokens on split).
    it('does not stack duplicates when a multi-word tag pill is clicked twice', async () => {
      const wrapper = mountTable([makeSong({ tags: ['Christmas Eve'], themes: [] })])
      const tagPill = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Christmas Eve' && s.attributes('title') === 'Filter by this tag')
      expect(tagPill).toBeTruthy()
      await tagPill!.trigger('click')
      await tagPill!.trigger('click')
      expect(mockSongStore.searchQuery).toBe('tag:Christmas Eve')
    })

    it('does not stack duplicates when a multi-word theme pill is clicked twice', async () => {
      const wrapper = mountTable([makeSong({ tags: [], themes: ['Christmas Eve'] })])
      const themePill = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Christmas Eve' && s.attributes('title') === 'Filter by this theme')
      expect(themePill).toBeTruthy()
      await themePill!.trigger('click')
      await themePill!.trigger('click')
      expect(mockSongStore.searchQuery).toBe('theme:Christmas Eve')
    })

    it('does not falsely de-dupe a multi-word term against a different prior term with overlapping prefix', async () => {
      mockSongStore.searchQuery = 'tag:Christmas'
      const wrapper = mountTable([makeSong({ tags: ['Christmas Eve'], themes: [] })])
      const tagPill = wrapper
        .findAll('span')
        .find((s) => s.text() === 'Christmas Eve' && s.attributes('title') === 'Filter by this tag')
      await tagPill!.trigger('click')
      expect(mockSongStore.searchQuery).toBe('tag:Christmas tag:Christmas Eve')
    })
  })

  describe('Files column (R362)', () => {
    it('renders the Files header when columnVisibility.files is true', () => {
      const wrapper = mountTable()
      const headers = wrapper.findAll('th').map((th) => th.text())
      expect(headers.some((h) => h.includes('Files'))).toBe(true)
    })

    it('does not render the Files header or cells when columnVisibility.files is false', () => {
      mockColumnVisibility = { ...mockColumnVisibility, files: false }
      const wrapper = mountTable([makeSong({ attachments: [] })])
      const headers = wrapper.findAll('th').map((th) => th.text())
      expect(headers.some((h) => h.includes('Files'))).toBe(false)
      expect(wrapper.text()).not.toContain('none')
    })

    it("renders 'none' for a song with an empty attachments array", () => {
      const wrapper = mountTable([makeSong({ attachments: [] })])
      expect(wrapper.text()).toContain('none')
    })

    it("renders 'none' without throwing for a legacy song with no attachments field", () => {
      const song = makeSong()
      delete (song as { attachments?: unknown }).attachments
      expect(() => mountTable([song])).not.toThrow()
      const wrapper = mountTable([song])
      expect(wrapper.text()).toContain('none')
    })

    it("renders '1 file' for a song with exactly one attachment", () => {
      const wrapper = mountTable([
        makeSong({
          attachments: [
            { id: 'a1', kind: 'document', name: 'chart.pdf', createdAt: {} as never, createdBy: 'u1' },
          ],
        }),
      ])
      expect(wrapper.text()).toContain('1 file')
      // Guard against a naive substring match also matching "N files".
      expect(wrapper.text()).not.toMatch(/\d+ files/)
    })

    it("renders 'N files' for a song with two or more attachments", () => {
      const wrapper = mountTable([
        makeSong({
          attachments: [
            { id: 'a1', kind: 'document', name: 'chart.pdf', createdAt: {} as never, createdBy: 'u1' },
            { id: 'a2', kind: 'audio', name: 'track.mp3', createdAt: {} as never, createdBy: 'u1' },
          ],
        }),
      ])
      expect(wrapper.text()).toContain('2 files')
    })

    it('includes a Files checkbox in the cog menu that calls toggleColumn on change', async () => {
      const wrapper = mountTable()
      const cogButton = wrapper.find('button[aria-label="Column settings"]')
      await cogButton.trigger('click')
      const filesLabel = wrapper
        .findAll('label')
        .find((l) => l.text().includes('Files'))
      expect(filesLabel).toBeTruthy()
      const checkbox = filesLabel!.find('input[type="checkbox"]')
      await checkbox.trigger('change')
      expect(mockToggleColumn).toHaveBeenCalledWith('files')
    })
  })
})
