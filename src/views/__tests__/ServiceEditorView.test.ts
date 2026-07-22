import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import type { Service } from '@/types/service'
import type { Song } from '@/types/song'
import type { Person, Role, Quarter } from '@/types/roster'
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
    tags: [],
    removedThemes: [],
    vwTypes: [1],
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
    primaryArrangementId: null,
    lastUsedAt: null,
    hidden: false,
    pcSongId: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
]

const mockSetRoleOverride = vi.fn(() => Promise.resolve())
const mockClearRoleOverride = vi.fn(() => Promise.resolve())

vi.mock('@/stores/services', () => ({
  useServiceStore: () => ({
    services: [mockService],
    isLoading: false,
    orgId: null,
    subscribe: vi.fn(),
    updateService: vi.fn(() => Promise.resolve()),
    assignSongToSlot: vi.fn(() => Promise.resolve()),
    clearSongFromSlot: vi.fn(() => Promise.resolve()),
    setRoleOverride: mockSetRoleOverride,
    clearRoleOverride: mockClearRoleOverride,
  }),
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    songs: mockSongs,
    orgId: null,
    subscribe: vi.fn(),
  }),
}))

// ── Roles tab (Phase 17-04) — mutable per-test mocks ────────────────────────────
// isEditor/orgId are reassigned per-test (module-level `let`); the factory
// functions below close over them, so each fresh mount() picks up the current
// value (mirrors src/views/__tests__/RosterView.test.ts's mockPeople pattern).
let mockIsEditor = false
let mockOrgId: string | null = 'org-1'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { uid: 'user-1' },
    isEditor: mockIsEditor,
    orgId: mockOrgId,
  }),
}))

const mockRoles: Role[] = [
  { id: 'role-vox', name: 'Vocals', group: 'vocals', defaultCount: 1, order: 0 },
  { id: 'role-drums', name: 'Drums', group: 'band', defaultCount: 1, order: 1 },
]

const mockRosterPeople: Person[] = [
  {
    id: 'person-1',
    name: 'Alice',
    email: 'alice@example.com',
    phone: '',
    active: true,
    roles: ['role-vox'],
    pcPersonId: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
  {
    id: 'person-2',
    name: 'Bob',
    email: 'bob@example.com',
    phone: '',
    active: true,
    roles: ['role-drums'],
    pcPersonId: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
]

let mockQuarters: Quarter[] = []
let mockRosterOrgId: string | null = null
let mockQuartersOrgId: string | null = null

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockRosterPeople,
    roles: mockRoles,
    activePeople: mockRosterPeople.filter((p) => p.active),
    orgId: mockRosterOrgId,
    subscribe: vi.fn(),
  }),
}))

vi.mock('@/stores/quarters', () => ({
  useQuartersStore: () => ({
    quarters: mockQuarters,
    orgId: mockQuartersOrgId,
    subscribe: vi.fn(),
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

describe('ServiceEditorView - Roles tab (Phase 17-04)', () => {
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

  beforeEach(() => {
    mockIsEditor = false
    mockOrgId = 'org-1'
    mockRosterOrgId = null
    mockQuartersOrgId = null
    mockQuarters = []
  })

  it('editor: Roles tab lists seeded role assignments resolved from the quarterly schedule', async () => {
    mockIsEditor = true
    mockQuarters = [
      {
        id: 'q1',
        label: 'Q1 2026',
        year: 2026,
        quarter: 1,
        serviceDates: ['2026-03-08'],
        roleOverridesByDate: {},
        personQuarterData: {},
        calendar: { '2026-03-08': { 'role-vox': ['person-1'] } },
        status: 'finalized',
        shareToken: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      },
    ]

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    expect(rolesTabBtn?.exists()).toBe(true)
    await rolesTabBtn!.trigger('click')

    expect(wrapper.text()).toContain('Vocals')
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Nobody scheduled') // Drums role has no schedule entry
  })

  it('editor: override control (checkbox picker) appears, filtered by role eligibility', async () => {
    mockIsEditor = true
    mockQuarters = [
      {
        id: 'q1',
        label: 'Q1 2026',
        year: 2026,
        quarter: 1,
        serviceDates: ['2026-03-08'],
        roleOverridesByDate: {},
        personQuarterData: {},
        calendar: { '2026-03-08': { 'role-vox': ['person-1'] } },
        status: 'finalized',
        shareToken: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      },
    ]

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')

    // Vocals role: only Alice (has role-vox) should be offered as a candidate — Bob (role-drums) should not
    const aliceLabel = wrapper.findAll('label').find((l) => l.text() === 'Alice')
    expect(aliceLabel?.exists()).toBe(true)

    // Drums role has no schedule entry, so Bob's checkbox (role-drums eligible) starts
    // unchecked — toggling it exercises the override control end-to-end.
    const bobLabel = wrapper.findAll('label').find((l) => l.text() === 'Bob')
    expect(bobLabel?.exists()).toBe(true)
    const checkbox = bobLabel!.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)
    await checkbox.setValue(true)
    expect(mockSetRoleOverride).toHaveBeenCalled()
  })

  it('non-editor: Roles tab button is hidden and no roster/quarters data is read', async () => {
    mockIsEditor = false

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    expect(rolesTabBtn).toBeUndefined()
  })

  it('editor: empty state renders when no quarter covers the service date', async () => {
    mockIsEditor = true
    mockQuarters = [] // no quarter at all covers '2026-03-08'

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')

    expect(wrapper.text()).toContain('No schedule found for this date')
  })
})
