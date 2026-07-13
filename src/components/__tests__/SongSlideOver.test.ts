import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SongSlideOver from '../SongSlideOver.vue'
import type { Song } from '@/types/song'

// Mirrors SongTable.test.ts's pattern: mock the store modules directly rather
// than pulling in @pinia/testing (not a project dependency) or a real Pinia +
// firebase mock stack.
const mockAddSong = vi.fn((_data: Record<string, unknown>) => Promise.resolve())
const mockUpdateSong = vi.fn((_id: string, _data: Record<string, unknown>) => Promise.resolve())
const mockDeleteSong = vi.fn((_id: string) => Promise.resolve())

const mockSongStore = {
  allUserTags: [] as string[],
  addSong: mockAddSong,
  updateSong: mockUpdateSong,
  deleteSong: mockDeleteSong,
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
    pcSongId: 'pc-1',
    hidden: false,
    tags: ['Christmas'],
    removedThemes: [],
    ...overrides,
  }
}

// The drawer's watch(() => props.open, ...) seeds form state from a false->true
// transition (mirrors real usage — SongsView mounts it once with open=false and
// flips it true on edit-click). Mount closed, then open it so that seeding runs.
async function mountDrawer(song: Song | null) {
  const wrapper = mount(SongSlideOver, {
    props: { open: false, song },
    global: {
      // Render Teleport's default slot in place — content actually teleported to
      // document.body isn't reachable via wrapper.find/findAll.
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
  await wrapper.setProps({ open: true })
  return wrapper
}

describe('SongSlideOver — save', () => {
  beforeEach(() => {
    mockVwModeEnabled = true
    mockAddSong.mockClear()
    mockUpdateSong.mockClear()
    mockDeleteSong.mockClear()
  })

  // CR-02 (D-14): removing a theme from the free-text Themes field must record
  // it into removedThemes on save so it doesn't reappear on the next PC re-import.
  it('appends a removed theme to removedThemes on save', async () => {
    const song = makeSong({ themes: ['Grace', 'Redemption'], removedThemes: [] })
    const wrapper = await mountDrawer(song)

    const themesInput = wrapper.find('input[placeholder="e.g. worship, praise, Easter"]')
    await themesInput.setValue('Grace')

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')
    expect(saveButton).toBeTruthy()
    await saveButton!.trigger('click')

    expect(mockUpdateSong).toHaveBeenCalledTimes(1)
    const [, data] = mockUpdateSong.mock.calls[0]!
    expect(data.themes).toEqual(['Grace'])
    expect(data.removedThemes).toEqual(['Redemption'])
  })

  it('merges a newly removed theme with any previously removedThemes (de-duped)', async () => {
    const song = makeSong({ themes: ['Grace', 'Redemption'], removedThemes: ['Old'] })
    const wrapper = await mountDrawer(song)

    const themesInput = wrapper.find('input[placeholder="e.g. worship, praise, Easter"]')
    await themesInput.setValue('Grace')

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')
    await saveButton!.trigger('click')

    expect(mockUpdateSong).toHaveBeenCalledTimes(1)
    const [, data] = mockUpdateSong.mock.calls[0]!
    expect(data.removedThemes).toEqual(expect.arrayContaining(['Old', 'Redemption']))
    expect((data.removedThemes as string[]).length).toBe(2)
  })

  // CR-02 (D-14): re-adding a previously-removed theme must prune it back out
  // of removedThemes so it's no longer suppressed on the next re-import.
  it('prunes a re-added theme from removedThemes on save', async () => {
    const song = makeSong({ themes: ['Grace'], removedThemes: ['Redemption'] })
    const wrapper = await mountDrawer(song)

    const themesInput = wrapper.find('input[placeholder="e.g. worship, praise, Easter"]')
    await themesInput.setValue('Grace, Redemption')

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')
    await saveButton!.trigger('click')

    expect(mockUpdateSong).toHaveBeenCalledTimes(1)
    const [, data] = mockUpdateSong.mock.calls[0]!
    expect(data.themes).toEqual(['Grace', 'Redemption'])
    expect(data.removedThemes).toEqual([])
  })

  it('leaves removedThemes unchanged when the themes set is untouched', async () => {
    const song = makeSong({ themes: ['Grace', 'Redemption'], removedThemes: ['Old'] })
    const wrapper = await mountDrawer(song)

    // Dirty a different field so Save is enabled without touching themesInput.
    await wrapper.find('input[placeholder="e.g. Hillsong"]').setValue('New Author')

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')
    await saveButton!.trigger('click')

    expect(mockUpdateSong).toHaveBeenCalledTimes(1)
    const [, data] = mockUpdateSong.mock.calls[0]!
    expect(data.removedThemes).toEqual(['Old'])
  })
})
