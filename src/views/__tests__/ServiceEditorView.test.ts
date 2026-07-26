import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { shallowMount, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { Service } from '@/types/service'
import type { Song } from '@/types/song'
import type { Person, Role, Quarter } from '@/types/roster'
import type { Timestamp } from 'firebase/firestore'
import SlideshowPreview from '@/components/SlideshowPreview.vue'
import PresentationViewer from '@/components/PresentationViewer.vue'

// Every test in this file mounts ServiceEditorView (a large component with a
// live autosave debounce timer + Sortable instance) but historically never
// unmounted the wrapper. Left un-unmounted, a test that mutates localService
// without waiting out the 800ms autosave debounce leaves a REAL timer running
// in the background — which can fire during a LATER test's own wait window
// and pollute the shared `mockUpdateService` spy's call count (Phase 24-06
// discovery: this blocked the new backfill tests' own call-count assertions,
// Rule 3). `enableAutoUnmount` runs `wrapper.unmount()` after every test,
// which triggers ServiceEditorView's existing `onUnmounted` cleanup
// (clearTimeout(autosaveTimer), sortableInstance?.destroy()).
enableAutoUnmount(afterEach)

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
  // useSlideshowAssembly's default lyrics loader (20-04) issues a one-shot
  // getDocs query — stub the whole chain so it resolves to "no lyrics doc"
  // rather than throwing on undefined firestore query builders.
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
}))

// useSlideshowAssembly (20-04) reads scripture readings from this store — mirrors
// the reactive-stub mocking pattern used by ScriptureSlideEditor.test.ts.
vi.mock('@/stores/scriptureSlides', () => ({
  useScriptureSlides: () => ({
    readings: [],
    isLoading: false,
    subscribeReadings: vi.fn(),
    unsubscribeReadings: vi.fn(),
  }),
}))

// useSlideshowAssembly (21-01) also reads imported decks from this store —
// unmocked, useImportedSlides() calls getActivePinia() against a Pinia
// instance this test never installs, crashing ServiceEditorView's setup().
// Same reactive-stub pattern as the scriptureSlides mock above.
vi.mock('@/stores/importedSlides', () => ({
  useImportedSlides: () => ({
    decks: [],
    isLoading: false,
    subscribeDecks: vi.fn(),
    unsubscribeDecks: vi.fn(),
  }),
}))

// useSlideshowAssembly (24-04) also reads groupsBySlotId from this store —
// unmocked, useSlideGroups() calls getActivePinia() against a Pinia instance
// this test never installs. Same reactive-stub pattern as the two mocks above.
vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    groups: [],
    isLoading: false,
    groupsBySlotId: new Map(),
    subscribeGroups: vi.fn(),
    unsubscribeGroups: vi.fn(),
    materializeGroupIfMissing: vi.fn(),
    deleteGroup: vi.fn(),
    setGroupBedMedia: vi.fn(),
    replaceGroupSlides: vi.fn(),
  }),
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
    { kind: 'SONG', id: 'slot-0', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
    { kind: 'SCRIPTURE', id: 'slot-1', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
    { kind: 'SONG', id: 'slot-2', position: 2, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
    { kind: 'PRAYER', id: 'slot-3', position: 3 },
    { kind: 'SCRIPTURE', id: 'slot-4', position: 4, book: null, chapter: null, verseStart: null, verseEnd: null },
    { kind: 'SONG', id: 'slot-5', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
    { kind: 'SONG', id: 'slot-6', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
    { kind: 'MESSAGE', id: 'slot-7', position: 7 },
    { kind: 'SONG', id: 'slot-8', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
  ],
  sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
  notes: '',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

// Mutable per-test services list (20-04 section/preview tests swap in a sectioned
// fixture) — mirrors the mockQuarters/mockRosterOrgId pattern below: read fresh by
// useServiceStore() on every mount, so a test can reassign it before mountView().
let mockServicesList: Service[] = [mockService]

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

const mockSetRoleOverride = vi.fn(
  (_serviceId: string, _roleId: string, _personIds: string[]) => Promise.resolve(),
)
const mockClearRoleOverride = vi.fn(() => Promise.resolve())
// Hoisted (not created fresh per useServiceStore() call) so the Phase 24-06
// backfill tests below can inspect what the autosave path actually persisted.
const mockUpdateService = vi.fn(() => Promise.resolve())

vi.mock('@/stores/services', () => ({
  useServiceStore: () => ({
    services: mockServicesList,
    isLoading: false,
    orgId: null,
    subscribe: vi.fn(),
    updateService: mockUpdateService,
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
// `mockAuthState` is a Vue `reactive()` object (not a plain module-level `let`),
// so `watch(() => authStore.isEditor, ...)` inside the component can actually
// observe a post-mount transition — mirrors how the real Pinia store is
// reactive. Tests that need to flip isEditor after mount (WR-01 regression)
// mutate `mockAuthState.isEditor` directly and await a tick.
const mockAuthState = reactive<{ user: { uid: string }; isEditor: boolean; orgId: string | null }>({
  user: { uid: 'user-1' },
  isEditor: false,
  orgId: 'org-1',
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
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
  {
    id: 'person-3',
    name: 'Carol',
    email: 'carol@example.com',
    phone: '',
    active: true,
    // Second role-vox-eligible candidate — needed by the WR-02 rapid-toggle
    // regression test (two different people toggled for the same role).
    roles: ['role-vox'],
    pcPersonId: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
]

let mockQuarters: Quarter[] = []
let mockRosterOrgId: string | null = null
let mockQuartersOrgId: string | null = null

// Shared spies (not recreated per useRosterStore()/useQuartersStore() call) so
// the WR-01 regression test can assert initStores() re-subscribes once
// authStore.isEditor flips true after mount.
const mockRosterSubscribe = vi.fn()
const mockQuartersSubscribe = vi.fn()

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockRosterPeople,
    roles: mockRoles,
    activePeople: mockRosterPeople.filter((p) => p.active),
    orgId: mockRosterOrgId,
    subscribe: mockRosterSubscribe,
  }),
}))

vi.mock('@/stores/quarters', () => ({
  useQuartersStore: () => ({
    quarters: mockQuarters,
    orgId: mockQuartersOrgId,
    subscribe: mockQuartersSubscribe,
  }),
}))

// Warm the SFC transform + template compile once before any test. The first
// mount of this large (2200+ line) component can, on a loaded machine, exceed
// vitest's default 5s per-test timeout — which would flake whichever test
// happens to mount first. Paying that one-time cold cost here (with a generous
// timeout) keeps every individual test's timer measuring only a warm mount.
beforeAll(async () => {
  const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
  shallowMount(ServiceEditorView, {
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
  }).unmount()
}, 30000)

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
    mockAuthState.isEditor = false
    mockAuthState.orgId = 'org-1'
    mockRosterOrgId = null
    mockQuartersOrgId = null
    mockQuarters = []
    mockRosterSubscribe.mockClear()
    mockQuartersSubscribe.mockClear()
  })

  it('editor: Roles tab lists seeded role assignments resolved from the quarterly schedule', async () => {
    mockAuthState.isEditor = true
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
    mockAuthState.isEditor = true
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
    mockAuthState.isEditor = false

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    expect(rolesTabBtn).toBeUndefined()
  })

  it('editor: empty state renders when no quarter covers the service date', async () => {
    mockAuthState.isEditor = true
    mockQuarters = [] // no quarter at all covers '2026-03-08'

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')

    expect(wrapper.text()).toContain('No schedule found for this date')
  })

  // ── WR-01 regression ──────────────────────────────────────────────────────────
  // initStores() must re-subscribe roster/quarters once authStore.isEditor
  // resolves to true *after* mount (e.g. a real editor landing directly on
  // /services/:id before loadOrgContext() finishes) — not just when isEditor
  // was already true at mount time.
  it('editor: roster/quarters are subscribed once authStore.isEditor flips true after mount (WR-01)', async () => {
    // Simulate landing on the page before the role has resolved.
    mockAuthState.isEditor = false

    await mountView()

    // Not editor yet at mount time — must not have subscribed.
    expect(mockRosterSubscribe).not.toHaveBeenCalled()
    expect(mockQuartersSubscribe).not.toHaveBeenCalled()

    // Role resolves asynchronously (mirrors loadOrgContext() completing).
    mockAuthState.isEditor = true
    await Promise.resolve()
    await Promise.resolve()

    expect(mockRosterSubscribe).toHaveBeenCalledWith('org-1')
    expect(mockQuartersSubscribe).toHaveBeenCalledWith('org-1')
  })

  // ── WR-02 regression ──────────────────────────────────────────────────────────
  // Toggling two different people's checkboxes for the *same* role in quick
  // succession must not let the second write clobber the first — the
  // optimistic local update means the second toggle reads the just-applied
  // state instead of a stale pre-write baseline.
  it('editor: rapid toggles of two different people for the same role do not clobber each other (WR-02)', async () => {
    mockAuthState.isEditor = true
    mockQuarters = [
      {
        id: 'q1',
        label: 'Q1 2026',
        year: 2026,
        quarter: 1,
        serviceDates: ['2026-03-08'],
        roleOverridesByDate: {},
        personQuarterData: {},
        // Nobody scheduled for Vocals yet — both Alice and Carol are role-vox
        // eligible candidates offered in the checkbox group.
        calendar: { '2026-03-08': {} },
        status: 'finalized',
        shareToken: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      },
    ]

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')

    const aliceLabel = wrapper.findAll('label').find((l) => l.text() === 'Alice')
    const carolLabel = wrapper.findAll('label').find((l) => l.text() === 'Carol')
    expect(aliceLabel?.exists()).toBe(true)
    expect(carolLabel?.exists()).toBe(true)

    const aliceCheckbox = aliceLabel!.find('input[type="checkbox"]')
    const carolCheckbox = carolLabel!.find('input[type="checkbox"]')

    // Toggle Alice, then Carol, for the same role — awaiting each in turn
    // (this is exactly what the reactive-store round-trip fails to keep up
    // with pre-fix, since the mocked setRoleOverride never updates
    // serviceStore.services; only the optimistic local mutation does).
    await aliceCheckbox.setValue(true)
    await carolCheckbox.setValue(true)

    // The last write must include BOTH people, not just Carol.
    const lastCallArgs = mockSetRoleOverride.mock.calls[mockSetRoleOverride.mock.calls.length - 1]
    expect(lastCallArgs?.[1]).toBe('role-vox')
    expect(lastCallArgs?.[2]).toEqual(expect.arrayContaining(['person-1', 'person-3']))
    expect(lastCallArgs?.[2]).toHaveLength(2)
  })
})

// ── Sections and inline slideshow preview (Phase 20-04) ─────────────────────────

function buildSectionedService(): Service {
  return {
    ...mockService,
    slots: [
      { kind: 'SONG', id: 'slot-0', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G', section: 'worship' },
      { kind: 'SCRIPTURE', id: 'slot-1', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6, section: 'worship' },
      { kind: 'MESSAGE', id: 'slot-2', position: 2, section: 'message' },
      { kind: 'SONG', id: 'slot-3', position: 3, requiredVwType: 3, songId: null, songTitle: null, songKey: null, section: 'sending' },
    ],
  }
}

describe('ServiceEditorView - Section headers and slideshow preview (Phase 20-04)', () => {
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
          // props declared so wrapper.props('slides') resolves in the
          // array-identity test below — a bare template stub would treat
          // :slides/:is-loading as fallthrough attrs instead of tracked props.
          PresentationViewer: {
            props: ['slides', 'isLoading'],
            template: '<div data-testid="presentation-viewer-stub" />',
          },
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [mockService]
  })

  it('renders a section header above the first slot of each defined section', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    const headers = wrapper.findAll('[data-testid^="section-header-"]')
    expect(headers).toHaveLength(3)
    expect(headers[0]?.text()).toContain('Worship')
    expect(headers[1]?.text()).toContain('Message')
    expect(headers[2]?.text()).toContain('Sending')
  })

  it('renders zero section headers for a legacy service where every slot has section === undefined', async () => {
    mockServicesList = [mockService] // default fixture: no slot carries a `section` field
    const wrapper = await mountView()

    expect(wrapper.findAll('[data-testid^="section-header-"]')).toHaveLength(0)
  })

  it('mounts the SlideshowPreview panel bound to the live assembled sections', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    const preview = wrapper.findComponent(SlideshowPreview)
    expect(preview.exists()).toBe(true)
    expect(Array.isArray(preview.props('sections'))).toBe(true)
  })

  it('does not mount PresentationViewer on initial render', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(false)
  })

  it('mounts PresentationViewer when SlideshowPreview emits present, and unmounts it when PresentationViewer emits exit', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    await wrapper.findComponent(SlideshowPreview).vm.$emit('present')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(true)

    await wrapper.findComponent(PresentationViewer).vm.$emit('exit')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(false)
  })

  it('passes the same assembledSlideshow array instance to PresentationViewer across re-renders, confirming it is not rebuilt locally', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    await wrapper.findComponent(SlideshowPreview).vm.$emit('present')
    await wrapper.vm.$nextTick()

    const viewer = wrapper.findComponent(PresentationViewer)
    expect(viewer.exists()).toBe(true)
    const firstSlides = viewer.props('slides')
    expect(Array.isArray(firstSlides)).toBe(true)

    // Force a re-render with no underlying data change — a locally rebuilt
    // (re-flattened) array would produce a new reference here; the
    // composable's memoized `assembledSlideshow` computed does not.
    await wrapper.vm.$nextTick()
    const secondSlides = wrapper.findComponent(PresentationViewer).props('slides')
    expect(secondSlides).toBe(firstSlides)
  })

  it('editor: a per-slot section select is bound to slot.section and mutates it through the existing localService path', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    const selects = wrapper.findAll('[data-testid="section-select"]')
    // 4 slots in buildSectionedService(), one select per slot
    expect(selects).toHaveLength(4)
    // slot 3 (SONG, currently 'sending') -> reassign to 'worship'
    expect((selects[3]?.element as HTMLSelectElement).value).toBe('sending')
    await selects[3]?.setValue('worship')
    expect((selects[3]?.element as HTMLSelectElement).value).toBe('worship')
  })

  it('non-editor: no section select renders', async () => {
    mockAuthState.isEditor = false
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="section-select"]').exists()).toBe(false)
  })
})

// ── Slot id backfill on load (Phase 24-06 Task 1, R028) ─────────────────────────

describe('ServiceEditorView - slot id backfill on load (Phase 24-06 Task 1)', () => {
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

  // Simulates a pre-Phase-24 Firestore document: every slot lacks `id`. Real
  // legacy documents predate the TS type change, so bypassing it here with a
  // cast is the honest way to reproduce that shape.
  function buildLegacyService(): Service {
    return {
      ...mockService,
      slots: mockService.slots.map((slot) => {
        const clone: Record<string, unknown> = { ...(slot as unknown as Record<string, unknown>) }
        delete clone.id
        return clone
      }),
    } as unknown as Service
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockUpdateService.mockClear()
  })

  it('legacy (id-less) service loads with isDirty false and schedules no autosave through the debounce window', async () => {
    mockServicesList = [buildLegacyService()]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // If the backfill didn't apply identically to BOTH localService and
    // originalService, the JSON.stringify comparison behind isDirty would
    // mismatch immediately on load, rendering the "Unsaved changes" badge.
    expect(wrapper.text()).not.toContain('Unsaved changes')

    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('a service whose slots already have ids is untouched (no false dirty, no id churn)', async () => {
    mockServicesList = [{ ...mockService }] // default fixture: every slot already carries an id
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Unsaved changes')

    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('backfilled ids are identical across localService and originalService and persist through the next real save', async () => {
    mockServicesList = [buildLegacyService()]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Trigger an explicit edit so isDirty flips true and autosave schedules —
    // the same section-select idiom used by the Phase 20-04 tests above.
    const selects = wrapper.findAll('[data-testid="section-select"]')
    expect(selects.length).toBeGreaterThan(1)
    // The autosave watcher's very FIRST deep-watch trigger is always consumed
    // by the `autosaveInitialized` guard (by design — see the watcher's own
    // comment). In production that first trigger is the load event itself;
    // here it's this throwaway edit instead, because the mock store resolves
    // synchronously so the load watcher's `{ immediate: true }` fires and
    // assigns `localService.value` BEFORE the autosave watcher is even
    // created (it's declared later in the script) — so the load reassignment
    // has no watcher yet to consume it. The SECOND edit below is the one
    // this test actually asserts against.
    await selects[0]!.setValue('worship')
    await selects[1]!.setValue('message')

    await new Promise((resolve) => setTimeout(resolve, 900))

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id?: string }> }
    const ids = payload.slots.map((s) => s.id)
    // Every slot got a real, non-empty id...
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
    // ...and none of them collide — proving isDirty stayed false pre-edit
    // (see previous test) is only possible if localService/originalService
    // held byte-identical ids at load, and that those ids survive untouched
    // into the very next legitimate save.
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('a second identical id-less remote snapshot does not change previously backfilled ids (R028 remote-merge stability)', async () => {
    const reactiveServices = reactive([buildLegacyService()])
    mockServicesList = reactiveServices as unknown as Service[]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // First save: a throwaway edit absorbs the autosave watcher's very first
    // trigger (the `autosaveInitialized` guard — see the previous test's
    // comment for why that's this edit rather than the load event in this
    // synchronous-mock environment); the second edit is the real one this
    // save's ids are captured from.
    let selects = wrapper.findAll('[data-testid="section-select"]')
    await selects[0]!.setValue('worship')
    await selects[1]!.setValue('message')
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const firstPayload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id?: string }> }
    const firstIds = firstPayload.slots.map((s) => s.id)
    // Guard against a vacuous pass: without backfill every id would be
    // `undefined`, and `[undefined, ...] === [undefined, ...]` would trivially
    // satisfy the final equality check below without ever proving a real id
    // was minted and reused.
    expect(firstIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)

    // Simulate a second remote snapshot of the SAME still-id-less document
    // (e.g. a stale re-emission) — the remote-merge branch must reuse the
    // ids already held locally, not mint fresh ones. The reassignment inside
    // the load watcher resets `autosaveInitialized = false` and ALSO fires
    // the autosave watcher itself (a top-level ref reassignment always
    // triggers regardless of deep), so that reset is consumed by the merge
    // event itself — no extra throwaway edit is needed here.
    reactiveServices[0] = buildLegacyService()
    await wrapper.vm.$nextTick()

    // Third edit + save: the ids captured this time must match the first.
    selects = wrapper.findAll('[data-testid="section-select"]')
    await selects[2]!.setValue('sending')
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).toHaveBeenCalledTimes(2)
    const secondPayload = mockUpdateService.mock.calls[1]![1] as { slots: Array<{ id?: string }> }
    const secondIds = secondPayload.slots.map((s) => s.id)

    expect(secondIds).toEqual(firstIds)
  })
})
