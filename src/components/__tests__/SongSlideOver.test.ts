import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SongSlideOver from '../SongSlideOver.vue'
import { MAJOR_KEYS } from '@/constants/keys'
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
    orgId: 'org-1',
  }),
}))

vi.mock('../SongLyricEditor.vue', () => ({
  default: { name: 'SongLyricEditor', template: '<div data-testid="song-lyric-editor" />', props: ['songId', 'orgId'] },
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

function makeArrangement(overrides: Partial<Song['arrangements'][number]> = {}): Song['arrangements'][number] {
  return {
    id: 'a1',
    name: 'Default',
    key: 'G',
    bpm: null,
    lengthSeconds: null,
    chordChartUrl: '',
    notes: '',
    teamTags: [],
    ...overrides,
  }
}

// The drawer's watch(() => props.open, ...) seeds form state from a false->true
// transition (mirrors real usage — SongsView mounts it once with open=false and
// flips it true on edit-click). Mount closed, then open it so that seeding runs.
async function mountDrawer(song: Song | null, initialTab?: 'details' | 'lyrics') {
  const wrapper = mount(SongSlideOver, {
    props: { open: false, song, initialTab },
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

describe('SongSlideOver — key (R249)', () => {
  beforeEach(() => {
    mockVwModeEnabled = true
    mockAddSong.mockClear()
    mockUpdateSong.mockClear()
    mockDeleteSong.mockClear()
  })

  it('shows the single arrangement key and persists an edit onto it via updateSong', async () => {
    const song = makeSong({ arrangements: [makeArrangement({ id: 'a1', key: 'G' })], primaryArrangementId: null })
    const wrapper = await mountDrawer(song)

    const keyInput = wrapper.find('[data-testid="song-key-input"]')
    expect(keyInput.exists()).toBe(true)
    expect((keyInput.element as HTMLInputElement).value).toBe('G')

    await keyInput.setValue('D')
    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')

    expect(mockUpdateSong).toHaveBeenCalledTimes(1)
    const [, data] = mockUpdateSong.mock.calls[0]!
    expect((data.arrangements as { key: string }[])[0]!.key).toBe('D')
  })

  it('edits the primary arrangement (second one) and leaves the first untouched', async () => {
    const song = makeSong({
      arrangements: [
        makeArrangement({ id: 'a1', key: 'G' }),
        makeArrangement({ id: 'a2', key: 'C' }),
      ],
      primaryArrangementId: 'a2',
    })
    const wrapper = await mountDrawer(song)

    const keyInput = wrapper.find('[data-testid="song-key-input"]')
    expect((keyInput.element as HTMLInputElement).value).toBe('C')

    await keyInput.setValue('E')
    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')

    expect(mockUpdateSong).toHaveBeenCalledTimes(1)
    const [, data] = mockUpdateSong.mock.calls[0]!
    const arrangements = data.arrangements as { id: string; key: string }[]
    expect(arrangements.find((a) => a.id === 'a2')!.key).toBe('E')
    expect(arrangements.find((a) => a.id === 'a1')!.key).toBe('G')
  })

  it('falls back to arrangements[0] when primaryArrangementId is null with multiple arrangements', async () => {
    const song = makeSong({
      arrangements: [
        makeArrangement({ id: 'a1', key: 'G' }),
        makeArrangement({ id: 'a2', key: 'C' }),
      ],
      primaryArrangementId: null,
    })
    const wrapper = await mountDrawer(song)

    const keyInput = wrapper.find('[data-testid="song-key-input"]')
    expect((keyInput.element as HTMLInputElement).value).toBe('G')

    await keyInput.setValue('A')
    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')

    expect(mockUpdateSong).toHaveBeenCalledTimes(1)
    const [, data] = mockUpdateSong.mock.calls[0]!
    const arrangements = data.arrangements as { id: string; key: string }[]
    expect(arrangements.find((a) => a.id === 'a1')!.key).toBe('A')
    expect(arrangements.find((a) => a.id === 'a2')!.key).toBe('C')
  })

  it('mints a default arrangement without crashing when a zero-arrangement song gets a key edit', async () => {
    const song = makeSong({ arrangements: [], primaryArrangementId: null })
    const wrapper = await mountDrawer(song)

    const keyInput = wrapper.find('[data-testid="song-key-input"]')
    expect(keyInput.exists()).toBe(true)
    expect((keyInput.element as HTMLInputElement).value).toBe('')

    await keyInput.setValue('A')
    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')

    expect(mockUpdateSong).toHaveBeenCalledTimes(1)
    const [, data] = mockUpdateSong.mock.calls[0]!
    const arrangements = data.arrangements as { id: string; key: string }[]
    expect(arrangements.length).toBe(1)
    expect(arrangements[0]!.key).toBe('A')
    expect(data.primaryArrangementId).toBe(arrangements[0]!.id)
  })

  // R258: the Key input gains a native datalist typeahead sourced from the
  // shared MAJOR_KEYS constant — it suggests but does not restrict entry.
  it('renders a datalist of the 14 major keys for the Key input', async () => {
    const song = makeSong({ arrangements: [makeArrangement({ id: 'a1', key: 'G' })], primaryArrangementId: null })
    const wrapper = await mountDrawer(song)

    const keyInput = wrapper.find('[data-testid="song-key-input"]')
    expect(keyInput.attributes('list')).toBe('ss-key-options')

    const datalist = wrapper.find('datalist#ss-key-options')
    expect(datalist.exists()).toBe(true)
    const optionValues = datalist.findAll('option').map((o) => o.attributes('value'))
    expect(optionValues).toEqual(MAJOR_KEYS as unknown as string[])
  })

  it('accepts and persists a free-typed key not present in MAJOR_KEYS', async () => {
    const song = makeSong({ arrangements: [makeArrangement({ id: 'a1', key: 'G' })], primaryArrangementId: null })
    const wrapper = await mountDrawer(song)

    const keyInput = wrapper.find('[data-testid="song-key-input"]')
    await keyInput.setValue('Am')
    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')

    expect(mockUpdateSong).toHaveBeenCalledTimes(1)
    const [, data] = mockUpdateSong.mock.calls[0]!
    expect((data.arrangements as { key: string }[])[0]!.key).toBe('Am')
  })
})

describe('SongSlideOver — tabs', () => {
  beforeEach(() => {
    mockVwModeEnabled = true
    mockAddSong.mockClear()
    mockUpdateSong.mockClear()
    mockDeleteSong.mockClear()
  })

  it('shows Details and Lyrics tabs in edit mode', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song)
    expect(wrapper.find('[data-testid="tab-details"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-lyrics"]').exists()).toBe(true)
  })

  it('does not show tabs in create mode', async () => {
    const wrapper = await mountDrawer(null)
    expect(wrapper.find('[data-testid="tab-details"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tab-lyrics"]').exists()).toBe(false)
  })

  it('defaults to Details tab showing the form fields', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song)
    expect(wrapper.find('input[placeholder="Song title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lyrics-tab-content"]').exists()).toBe(false)
  })

  it('switches to Lyrics tab on click', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song)
    await wrapper.find('[data-testid="tab-lyrics"]').trigger('click')
    expect(wrapper.find('[data-testid="lyrics-tab-content"]').exists()).toBe(true)
    expect(wrapper.find('input[placeholder="Song title"]').exists()).toBe(false)
  })

  // 28-02 Task 3 (R035/D-01): the Lyrics tab mounts ONE editor and no second
  // list — PerformanceOrderBuilder is deleted from disk, so the Lyrics tab's
  // only child surface is the lyric editor (plus version history, out of
  // scope here). Regression guard against reintroducing a second list.
  it('mounts the lyric editor and no second list on the Lyrics tab', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song)
    await wrapper.find('[data-testid="tab-lyrics"]').trigger('click')
    expect(wrapper.find('[data-testid="song-lyric-editor"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="performance-order-builder"]').exists()).toBe(false)
  })

  // Task 1 (28-04, R035): the Lyrics tab panel itself must stop scrolling — the
  // editor owns the sole scroll region. With SongLyricEditor stubbed out here,
  // this proves SongSlideOver's OWN markup contributes zero scroll containers;
  // the real editor's single scroll region is verified against the actual
  // component in SongLyricEditor.test.ts.
  it('renders the Lyrics tab as a non-scrolling flex column with no scroll wrapper of its own', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song)
    await wrapper.find('[data-testid="tab-lyrics"]').trigger('click')

    const tabContent = wrapper.find('[data-testid="lyrics-tab-content"]')
    expect(tabContent.exists()).toBe(true)
    expect(tabContent.classes().join(' ')).not.toMatch(/overflow-y-auto|overflow-auto/)
    expect(wrapper.findAll('[class*="overflow-y-auto"]')).toHaveLength(0)
  })
})

// Task 2 (26-02): an opening-tab input, read inside the SAME watcher that resets
// the tab on every open — a value applied anywhere else is discarded, since that
// watcher unconditionally resets the tab today.
describe('SongSlideOver — opening tab (initialTab prop)', () => {
  beforeEach(() => {
    mockVwModeEnabled = true
    mockAddSong.mockClear()
    mockUpdateSong.mockClear()
    mockDeleteSong.mockClear()
  })

  it('opens on Details when no opening tab is supplied (unchanged default)', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song)
    expect(wrapper.find('input[placeholder="Song title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lyrics-tab-content"]').exists()).toBe(false)
  })

  it('opens on Lyrics when the lyrics tab is requested', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song, 'lyrics')
    expect(wrapper.find('[data-testid="lyrics-tab-content"]').exists()).toBe(true)
    expect(wrapper.find('input[placeholder="Song title"]').exists()).toBe(false)
  })

  it('opens on Details when the details tab is explicitly requested', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song, 'details')
    expect(wrapper.find('input[placeholder="Song title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lyrics-tab-content"]').exists()).toBe(false)
  })

  it('honours a newly requested tab on close-then-reopen rather than the previous request', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song, 'lyrics')
    expect(wrapper.find('[data-testid="lyrics-tab-content"]').exists()).toBe(true)

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ initialTab: 'details' })
    await wrapper.setProps({ open: true })

    expect(wrapper.find('input[placeholder="Song title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lyrics-tab-content"]').exists()).toBe(false)
  })

  it('still allows a manual tab click after opening on a requested tab', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song, 'lyrics')
    expect(wrapper.find('[data-testid="lyrics-tab-content"]').exists()).toBe(true)

    await wrapper.find('[data-testid="tab-details"]').trigger('click')

    expect(wrapper.find('input[placeholder="Song title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lyrics-tab-content"]').exists()).toBe(false)
  })

  it('leaves create mode unaffected — no tab bar even with an opening tab requested', async () => {
    const wrapper = await mountDrawer(null, 'lyrics')
    expect(wrapper.find('[data-testid="tab-bar"]').exists()).toBe(false)
    expect(wrapper.find('input[placeholder="Song title"]').exists()).toBe(true)
  })
})

// R334: a SongSelect deep link next to the song name, reusing SongTable.vue's
// exact CCLI link-out pattern; gated on the persisted `Song.ccliNumber`.
describe('SongSlideOver — SongSelect link (R334)', () => {
  it('shows a SongSelect link to the persisted ccliNumber, opening in a new noopener tab', async () => {
    const song = makeSong({ ccliNumber: '12345' })
    const wrapper = await mountDrawer(song)

    const link = wrapper.find('[data-testid="song-songselect-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://songselect.ccli.com/songs/12345')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('hides the SongSelect link when ccliNumber is empty', async () => {
    const song = makeSong({ ccliNumber: '' })
    const wrapper = await mountDrawer(song)

    expect(wrapper.find('[data-testid="song-songselect-link"]').exists()).toBe(false)
  })

  it('hides the SongSelect link in create mode (no song)', async () => {
    const wrapper = await mountDrawer(null)

    expect(wrapper.find('[data-testid="song-songselect-link"]').exists()).toBe(false)
  })

  it('keeps the SongSelect link visible on the Lyrics tab too — it lives in the shared header', async () => {
    const song = makeSong({ ccliNumber: '12345' })
    const wrapper = await mountDrawer(song)
    await wrapper.find('[data-testid="tab-lyrics"]').trigger('click')

    expect(wrapper.find('[data-testid="song-songselect-link"]').exists()).toBe(true)
  })
})

// R335: the header dismiss button reads "Close" (was "Cancel"); behavior
// (the unsaved-changes guard + emit('close')) is unchanged.
describe('SongSlideOver — header dismiss button reads "Close" (R335)', () => {
  it('the header no longer shows a "Cancel" button, and "Close" emits close', async () => {
    const song = makeSong()
    const wrapper = await mountDrawer(song)

    const buttons = wrapper.findAll('button')
    expect(buttons.some((b) => b.text() === 'Cancel')).toBe(false)
    const closeButton = buttons.find((b) => b.text() === 'Close')
    expect(closeButton).toBeTruthy()

    await closeButton!.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
