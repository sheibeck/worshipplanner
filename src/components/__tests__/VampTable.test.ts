import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VampTable from '../VampTable.vue'
import type { Vamp } from '@/types/vamp'

// Mirrors SongTable.test.ts's pattern: mock the store module directly with a
// singleton object so a test can observe searchQuery mutations, and drive
// filteredVamps independently of the `vamps` prop.
let mockFilteredVamps: Vamp[] = []
const mockVampStore = {
  searchQuery: '',
  get filteredVamps() {
    return mockFilteredVamps
  },
}

vi.mock('@/stores/vamps', () => ({
  useVampStore: () => mockVampStore,
}))

function makeVamp(overrides: Partial<Vamp> = {}): Vamp {
  return {
    id: 'vamp-1',
    name: 'Open Response',
    key: 'G',
    tempo: '68 bpm',
    attachment: null,
    createdAt: {} as never,
    updatedAt: {} as never,
    ...overrides,
  }
}

function mountTable(vamps: Vamp[] = [makeVamp()], loading = false) {
  mockFilteredVamps = vamps
  return mount(VampTable, { props: { vamps, loading } })
}

describe('VampTable', () => {
  beforeEach(() => {
    mockVampStore.searchQuery = ''
  })

  it('renders one row per vamp with name/key/tempo, and an em-dash for a tempo-less vamp', () => {
    const vamps = [
      makeVamp({ id: 'v1', name: 'Open Response', key: 'G', tempo: '68 bpm' }),
      makeVamp({ id: 'v2', name: 'Quiet Reflection', key: 'D', tempo: undefined }),
      makeVamp({ id: 'v3', name: 'Call to Worship', key: 'A', tempo: '92 bpm' }),
    ]
    const wrapper = mountTable(vamps)
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('Open Response')
    expect(rows[0]!.text()).toContain('G')
    expect(rows[0]!.text()).toContain('68 bpm')
    expect(rows[1]!.text()).toContain('—')
  })

  it('renders "No MP3 attached" for a vamp with a null attachment, and the fileName for one with an attachment', () => {
    const vamps = [
      makeVamp({ id: 'v1', attachment: null }),
      makeVamp({
        id: 'v2',
        attachment: {
          storagePath: 'orgs/org-1/vamp-files/v2/u1/track.mp3',
          downloadUrl: 'https://example.com/track.mp3',
          fileName: 'track.mp3',
          mimeType: 'audio/mpeg',
          sizeBytes: 100,
          createdAt: {} as never,
          createdBy: 'user-1',
        },
      }),
    ]
    const wrapper = mountTable(vamps)
    expect(wrapper.text()).toContain('No MP3 attached')
    expect(wrapper.text()).toContain('track.mp3')
  })

  it('typing in the search input sets the store searchQuery', async () => {
    const wrapper = mountTable([makeVamp()])
    const input = wrapper.get('[data-testid="vamp-search-input"]')
    await input.setValue('open g')
    expect(mockVampStore.searchQuery).toBe('open g')
  })

  it('clicking a row emits select with that vamp', async () => {
    const vamp = makeVamp()
    const wrapper = mountTable([vamp])
    await wrapper.get('tbody tr').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([vamp])
  })

  it('shows a sub-head with the total vamp count and the count with audio', () => {
    const vamps = [
      makeVamp({ id: 'v1', attachment: null }),
      makeVamp({
        id: 'v2',
        attachment: {
          storagePath: 'orgs/org-1/vamp-files/v2/u1/track.mp3',
          downloadUrl: 'https://example.com/track.mp3',
          fileName: 'track.mp3',
          mimeType: 'audio/mpeg',
          sizeBytes: 100,
          createdAt: {} as never,
          createdBy: 'user-1',
        },
      }),
    ]
    const wrapper = mountTable(vamps)
    expect(wrapper.get('[data-testid="vamp-subhead"]').text()).toBe('2 vamps · 1 with audio')
  })

  it('shows the empty-library state and emits add when no vamps exist', async () => {
    const wrapper = mountTable([])
    expect(wrapper.text()).toContain('Your vamp library is empty')
    const addButton = wrapper.findAll('button').find((b) => b.text().includes('Add Vamp'))
    expect(addButton).toBeTruthy()
    await addButton!.trigger('click')
    expect(wrapper.emitted('add')).toBeTruthy()
  })
})
