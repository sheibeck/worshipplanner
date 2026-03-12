import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import type { Service } from '@/types/service'
import type { Song } from '@/types/song'
import type { Timestamp } from 'firebase/firestore'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'service-1' } }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ data: () => ({ orgIds: ['org-1'] }) })),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({})),
}))

const mockTimestamp = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp

const mockService: Service = {
  id: 'service-1',
  date: '2026-03-08',
  name: '',
  progression: '1-2-2-3',
  teams: ['Choir'],
  status: 'draft',
  slots: [
    { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
    { kind: 'SCRIPTURE', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
    { kind: 'SONG', position: 2, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
    { kind: 'PRAYER', position: 3 },
    { kind: 'SCRIPTURE', position: 4, book: null, chapter: null, verseStart: null, verseEnd: null },
    { kind: 'SONG', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
    { kind: 'SONG', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
    { kind: 'MESSAGE', position: 7 },
    { kind: 'SONG', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
  ],
  sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
  notes: '',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

const mockSongs: Song[] = [
  {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '22025',
    author: 'John Newton',
    themes: [],
    notes: '',
    vwTypes: [1],
    teamTags: [],
    arrangements: [
      {
        id: 'arr-1a',
        name: 'Standard',
        key: 'G',
        bpm: 84,
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

vi.mock('@/stores/services', () => ({
  useServiceStore: () => ({
    services: [mockService],
    isLoading: false,
    orgId: null,
    subscribe: vi.fn(),
    updateService: vi.fn(() => Promise.resolve()),
    assignSongToSlot: vi.fn(() => Promise.resolve()),
    clearSongFromSlot: vi.fn(() => Promise.resolve()),
  }),
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    songs: mockSongs,
    orgId: null,
    subscribe: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { uid: 'user-1' },
  }),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ServiceEditorView - Print and Copy for PC buttons', () => {
  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
      writable: true,
      configurable: true,
    })
  })

  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          RouterLink: { template: '<a><slot /></a>' },
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  it('Print button exists and clicking it calls window.print() once', async () => {
    const wrapper = await mountView()
    const printBtn = wrapper.find('[data-testid="print-btn"]')
    expect(printBtn.exists()).toBe(true)
    await printBtn.trigger('click')
    expect(window.print).toHaveBeenCalledTimes(1)
  })

  it('Copy for PC button exists and clicking it shows "Copied!" text', async () => {
    const wrapper = await mountView()
    const copyBtn = wrapper.find('[data-testid="copy-pc-btn"]')
    expect(copyBtn.exists()).toBe(true)
    await copyBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(copyBtn.text()).toContain('Copied!')
  })

  it('Copy for PC button calls navigator.clipboard.writeText with a non-empty string', async () => {
    const wrapper = await mountView()
    const copyBtn = wrapper.find('[data-testid="copy-pc-btn"]')
    await copyBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('ORDER OF SERVICE'),
    )
  })
})
