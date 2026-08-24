/**
 * WR-02 (81-REVIEW): SongSlotPicker.vue — the highest-risk R240 consumer —
 * previously shipped with zero automated test coverage (a throwaway
 * verification test was run and deleted rather than committed). This file
 * mounts the REAL component (Teleport stubbed to render inline, per the
 * NewServiceDialog.test.ts precedent — everything else real, including the
 * real songs/auth Pinia stores) and covers:
 *   - AI-Picks / By-Rotation / Search-Results rows render
 *   - tag include/exclude filtering (via the shared SongBrowser) narrows
 *     what's shown
 *   - selecting a song emits `select` with the right payload and closes
 *     the dropdown
 *
 * IntersectionObserver is stubbed globally — jsdom does not implement it,
 * and SongSlotPicker's onMounted() constructs one unconditionally for the
 * load-more sentinel (D-12).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SongSlotPicker from '../SongSlotPicker.vue'
import { useAuthStore } from '@/stores/auth'
import type { Song } from '@/types/song'

enableAutoUnmount(afterEach)

class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Song',
    ccliNumber: '1',
    author: 'Author',
    themes: [],
    notes: '',
    vwTypes: [1],
    tags: [],
    removedThemes: [],
    arrangements: [{ id: 'arr-1', name: 'Default', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }],
    primaryArrangementId: null,
    lastUsedAt: null,
    createdAt: {} as never,
    updatedAt: {} as never,
    pcSongId: null,
    hidden: false,
    ...overrides,
  }
}

const songA = makeSong({ id: 'song-a', title: 'Amazing Grace', tags: ['grace'], arrangements: [{ id: 'arr-a', name: 'Default', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] })
const songB = makeSong({ id: 'song-b', title: 'How Great Thou Art', tags: ['praise'], arrangements: [{ id: 'arr-b', name: 'Default', key: 'C', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] })
const songC = makeSong({ id: 'song-c', title: 'Blessed Assurance', themes: ['assurance'], arrangements: [{ id: 'arr-c', name: 'Default', key: 'D', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] })

function mountPicker(propsOverrides: Record<string, unknown> = {}) {
  return mount(SongSlotPicker, {
    props: {
      requiredVwType: 1,
      serviceTeams: [],
      currentSongId: null,
      songs: [songA, songB, songC],
      ...propsOverrides,
    },
    global: {
      stubs: {
        // Matches NewServiceDialog.test.ts's precedent: render the teleported
        // content inline instead of moving it to document.body, so it stays
        // queryable through `wrapper`.
        Teleport: { template: '<div><slot /></div>' },
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

async function openDropdown(wrapper: ReturnType<typeof mountPicker>) {
  await wrapper.get('button').trigger('click')
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  // AI section off by default — individual tests opt back in.
  useAuthStore().settings.aiEnabled = false
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SongSlotPicker (WR-02, 81-REVIEW)', () => {
  it('shows the "Click to select a song" trigger when no song is assigned, and opens the dropdown on click', async () => {
    const wrapper = mountPicker()
    expect(wrapper.text()).toContain('Click to select a song')

    await openDropdown(wrapper)

    expect(wrapper.text()).toContain('By Rotation')
  })

  it('renders a By Rotation row for every provided song when there is no search query', async () => {
    const wrapper = mountPicker()
    await openDropdown(wrapper)

    expect(wrapper.text()).toContain('Amazing Grace')
    expect(wrapper.text()).toContain('How Great Thou Art')
    expect(wrapper.text()).toContain('Blessed Assurance')
  })

  it('typing in the search box switches to Search Results and narrows via songMatchesQuery', async () => {
    const wrapper = mountPicker()
    await openDropdown(wrapper)

    const input = wrapper.find('input[type="text"]')
    await input.setValue('How Great')

    expect(wrapper.text()).toContain('Search Results')
    expect(wrapper.text()).toContain('How Great Thou Art')
    expect(wrapper.text()).not.toContain('Amazing Grace')
    expect(wrapper.text()).not.toContain('Blessed Assurance')
  })

  it('shows the no-results copy when the search query matches nothing', async () => {
    const wrapper = mountPicker()
    await openDropdown(wrapper)

    const input = wrapper.find('input[type="text"]')
    await input.setValue('zzz-no-match')

    expect(wrapper.text()).toContain('No songs found matching "zzz-no-match"')
  })

  it('including a tag via the shared SongBrowser checklist narrows By Rotation to songs carrying that tag', async () => {
    const wrapper = mountPicker()
    await openDropdown(wrapper)

    // Open the Tags popover (TagFilterChecklist, shared via SongBrowser).
    const tagsButton = wrapper.findAll('button').find((b) => b.text().startsWith('Tags'))!
    await tagsButton.trigger('click')

    const graceRow = wrapper.findAll('.max-h-48 > div').find((r) => r.text().includes('grace'))!
    await graceRow.find('button[title="Show only songs with this tag"]').trigger('click')

    expect(wrapper.text()).toContain('Amazing Grace')
    expect(wrapper.text()).not.toContain('How Great Thou Art')
    expect(wrapper.text()).not.toContain('Blessed Assurance')
  })

  it('excluding a tag hides songs carrying it, even from Search Results', async () => {
    const wrapper = mountPicker()
    await openDropdown(wrapper)

    const tagsButton = wrapper.findAll('button').find((b) => b.text().startsWith('Tags'))!
    await tagsButton.trigger('click')

    const praiseRow = wrapper.findAll('.max-h-48 > div').find((r) => r.text().includes('praise'))!
    await praiseRow.find('button[title="Hide songs with this tag"]').trigger('click')

    expect(wrapper.text()).not.toContain('How Great Thou Art')
    expect(wrapper.text()).toContain('Amazing Grace')
    expect(wrapper.text()).toContain('Blessed Assurance')
  })

  it('selecting a song row emits select with its id/title/key and closes the dropdown', async () => {
    const wrapper = mountPicker()
    await openDropdown(wrapper)

    const row = wrapper.findAll('button').find((b) => b.text().includes('How Great Thou Art'))!
    await row.trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([{ id: 'song-b', title: 'How Great Thou Art', key: 'C' }])
    // Dropdown closed: the backdrop (only rendered while isOpen) is gone.
    expect(wrapper.find('.fixed.inset-0.z-30').exists()).toBe(false)
  })

  it('renders an AI Picks row from resolvedAiSuggestions when AI is enabled, and selecting it emits select', async () => {
    useAuthStore().settings.aiEnabled = true
    const wrapper = mountPicker({
      hasSermonContext: true,
      aiSuggestions: [{ songId: 'song-a', reason: 'Fits the sermon theme' }],
    })
    await openDropdown(wrapper)

    expect(wrapper.text()).toContain('AI Picks')
    expect(wrapper.text()).toContain('Fits the sermon theme')

    const aiRow = wrapper.findAll('button').find((b) => b.text().includes('Fits the sermon theme'))!
    await aiRow.trigger('click')

    expect(wrapper.emitted('select')![0]).toEqual([{ id: 'song-a', title: 'Amazing Grace', key: 'G' }])
  })

  it('omits an AI suggestion whose songId resolves to a hidden song', async () => {
    useAuthStore().settings.aiEnabled = true
    const hiddenSong = makeSong({ id: 'song-hidden', title: 'Hidden Song', hidden: true })
    const wrapper = mountPicker({
      songs: [songA, hiddenSong],
      hasSermonContext: true,
      aiSuggestions: [{ songId: 'song-hidden', reason: 'Should not show' }],
    })
    await openDropdown(wrapper)

    expect(wrapper.text()).not.toContain('Hidden Song')
    expect(wrapper.text()).not.toContain('Should not show')
  })
})
