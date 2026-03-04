import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: { token: 'test-token-123' },
  })),
}))

// Mock @/firebase
vi.mock('@/firebase', () => ({
  db: {},
}))

// Mock @/utils/planningCenterExport
vi.mock('@/utils/planningCenterExport', () => ({
  formatScriptureRef: vi.fn((ref: { book: string; chapter: number; verseStart: number; verseEnd: number }) =>
    `${ref.book} ${ref.chapter}:${ref.verseStart}-${ref.verseEnd}`
  ),
}))

// Mock @/utils/slotTypes
vi.mock('@/utils/slotTypes', () => ({
  slotLabel: vi.fn((slot: { kind: string }) => {
    switch (slot.kind) {
      case 'SONG': return 'Song'
      case 'SCRIPTURE': return 'Scripture Reading'
      case 'PRAYER': return 'Prayer'
      case 'MESSAGE': return 'Message'
      default: return slot.kind
    }
  }),
}))

// Mock firebase/firestore — getDoc is controlled per test
const mockGetDoc = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    id: segments[segments.length - 1] ?? 'mock-id',
    path: segments.join('/'),
  })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}))

const mockSnapshot = {
  date: '2026-03-08',
  name: 'Sunday Service',
  progression: '1-2-2-3',
  teams: ['Choir'],
  status: 'planned',
  sermonPassage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
  notes: 'Remember to mic the choir',
  slots: [
    {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-abc',
      songTitle: 'Amazing Grace',
      songKey: 'G',
      bpm: 120,
    },
    {
      kind: 'SCRIPTURE',
      position: 1,
      book: 'Psalm',
      chapter: 100,
      verseStart: 1,
      verseEnd: 5,
    },
    {
      kind: 'SONG',
      position: 2,
      requiredVwType: 2,
      songId: null,
      songTitle: null,
      songKey: null,
      bpm: null,
    },
    {
      kind: 'PRAYER',
      position: 3,
    },
    {
      kind: 'MESSAGE',
      position: 7,
    },
  ],
}

async function mountShareView() {
  const { default: ShareView } = await import('../ShareView.vue')
  return mount(ShareView)
}

describe('ShareView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', async () => {
    // Never resolve getDoc during this test
    mockGetDoc.mockReturnValue(new Promise(() => {}))
    const wrapper = await mountShareView()
    expect(wrapper.text()).toContain('Loading')
  })

  it('shows not-found state when token document does not exist', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => null,
    })
    const wrapper = await mountShareView()
    await flushPromises()
    expect(wrapper.text()).toContain('no longer available')
  })

  it('renders service snapshot data when token is valid', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ serviceSnapshot: mockSnapshot }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    // Date should be formatted
    expect(wrapper.text()).toContain('2026')
    // Song title
    expect(wrapper.text()).toContain('Amazing Grace')
    // Scripture reference text
    expect(wrapper.text()).toContain('Psalm')
    expect(wrapper.text()).toContain('100')
    // Notes
    expect(wrapper.text()).toContain('Remember to mic the choir')
  })

  it('renders not-found when getDoc throws an error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Permission denied'))
    const wrapper = await mountShareView()
    await flushPromises()
    expect(wrapper.text()).toContain('no longer available')
  })
})
