import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { shallowMount, enableAutoUnmount, DOMWrapper, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import type { Options as SortableOptions } from 'sortablejs'
import type { Service } from '@/types/service'
import type { Song } from '@/types/song'
import type { Person, Role, Quarter } from '@/types/roster'
import type { Timestamp } from 'firebase/firestore'
import type { SlideGroup } from '@/types/slideGroup'
import PresentationViewer from '@/components/PresentationViewer.vue'
import SlidesTab from '@/components/slides/SlidesTab.vue'

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

// ── Phase 29-01: multi-instance Sortable capture harness (R044) ────────────────
// This file mounts the REAL SortableJS library today — no mock existed here
// before this phase. `Sortable.create()` only wires native drag listeners (no
// test above triggers a real browser drag), so replacing it with a capturing
// mock is behavior-neutral for every describe block preceding this one.
// `sortableCaptures` records EVERY `Sortable.create` call with its container
// element and options, so a test can invoke `onEnd` directly against the exact
// options the mounted component registered — generalizes the single-capture
// pattern already used in SlideGrid.test.ts to the multi-instance shape 29-03
// introduces (one Sortable instance per section container).
interface SortableCapture {
  el: HTMLElement
  options: SortableOptions
}
let sortableCaptures: SortableCapture[] = []
const mockSlotSortableDestroy = vi.fn()
vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((el: HTMLElement, options: SortableOptions) => {
      sortableCaptures.push({ el, options })
      return { destroy: mockSlotSortableDestroy }
    }),
  },
}))

function resetSortableCaptures(): void {
  sortableCaptures = []
  mockSlotSortableDestroy.mockClear()
}

/** Resolves the capture whose container carries `data-section="{section}"` —
 *  only resolves once 29-03 splits the flat slot list into per-section
 *  containers. Resolves to `undefined` against today's flat render. */
function captureForSection(section: string): SortableCapture | undefined {
  return sortableCaptures.find((c) => c.el.dataset.section === section)
}

/** Resolves the single capture with NO `data-section` attribute — today's flat
 *  container. Stops resolving once every container carries a section (29-03). */
function flatCapture(): SortableCapture | undefined {
  return sortableCaptures.find((c) => c.el.dataset.section === undefined)
}

// The reported ZTXcpNRcJTalEQp42fTx shape: 8 slots, section-major, across the
// four ORIGINAL sections — deliberately no 'post-service' slot, so this fixture
// pins the reorder-repro tests to the pre-29-05 four-section shape while the
// Post-Service section itself (always rendered, empty here) is covered by its
// own tests below.
//   s1 SONG pre-service · s2 SONG worship · s3 SONG worship · s4 SCRIPTURE worship
//   s5 MESSAGE message · s6 PRAYER message · s7 SONG sending · s8 PRAYER sending
function makeSectionedService(): Service {
  return {
    ...mockService,
    slots: [
      { kind: 'SONG', id: 's1', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'pre-service' },
      { kind: 'SONG', id: 's2', position: 1, requiredVwType: 2, songId: null, songTitle: null, songKey: null, section: 'worship' },
      { kind: 'SONG', id: 's3', position: 2, requiredVwType: 2, songId: null, songTitle: null, songKey: null, section: 'worship' },
      { kind: 'SCRIPTURE', id: 's4', position: 3, book: null, chapter: null, verseStart: null, verseEnd: null, section: 'worship' },
      { kind: 'MESSAGE', id: 's5', position: 4, section: 'message' },
      { kind: 'PRAYER', id: 's6', position: 5, section: 'message' },
      { kind: 'SONG', id: 's7', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null, section: 'sending' },
      { kind: 'PRAYER', id: 's8', position: 7, section: 'sending' },
    ],
  }
}

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

// useSlideshowAssembly (24-04) also reads groupsBySlotId from this store, and
// ServiceEditorView itself (24-06) calls deleteGroup/setGroupBedMedia
// directly — unmocked, useSlideGroups() calls getActivePinia() against a
// Pinia instance this test never installs. Stateful (not a static stub) so
// the Phase 24-06 delete-cascade and media-retarget tests can control which
// groups exist and inspect what was written — mirrors the reactive-stub
// pattern in src/composables/__tests__/useSlideshowAssembly.test.ts.
const mockSlideGroupsState = reactive<{ groups: SlideGroup[] }>({ groups: [] })
const mockSubscribeGroups = vi.fn()
const mockUnsubscribeGroups = vi.fn()
const mockMaterializeGroupIfMissing = vi.fn((_orgId: string, _input: unknown) => Promise.resolve(true))
const mockDeleteGroup = vi.fn((_orgId: string, _slotId: string) => Promise.resolve())
const mockSetGroupBedMedia = vi.fn((_orgId: string, _slotId: string, _patch: unknown) => Promise.resolve())
const mockReplaceGroupSlides = vi.fn((_orgId: string, _slotId: string, _slides: unknown, _sig?: string) => Promise.resolve())

vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    groups: mockSlideGroupsState.groups,
    isLoading: false,
    get groupsBySlotId() {
      const map = new Map<string, SlideGroup>()
      for (const group of mockSlideGroupsState.groups) map.set(group.slotId, group)
      return map
    },
    subscribeGroups: mockSubscribeGroups,
    unsubscribeGroups: mockUnsubscribeGroups,
    materializeGroupIfMissing: mockMaterializeGroupIfMissing,
    deleteGroup: mockDeleteGroup,
    setGroupBedMedia: mockSetGroupBedMedia,
    replaceGroupSlides: mockReplaceGroupSlides,
  }),
}))

/**
 * Walks an element's ancestor chain checking for an inline `display: none`
 * (how `v-show` toggles visibility) — VTU's own `isVisible()` does not
 * reliably reflect an ancestor's inline style in this jsdom environment, so
 * the Slides-tab panel-visibility tests (Phase 25-03) check directly.
 */
function isVShowHidden(wrapper: { element: Element }): boolean {
  let el: HTMLElement | null = wrapper.element as HTMLElement
  while (el) {
    if (el.style?.display === 'none') return true
    el = el.parentElement
  }
  return false
}

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
const mockUpdateService = vi.fn((_id: string, _data: unknown) => Promise.resolve())

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

// Reset the stateful slideGroups mock before every test so a test that
// populates `mockSlideGroupsState.groups` never leaks into a later one that
// assumes the default empty-groups state.
beforeEach(() => {
  mockSlideGroupsState.groups = []
  mockSubscribeGroups.mockClear()
  mockUnsubscribeGroups.mockClear()
  mockMaterializeGroupIfMissing.mockClear()
  mockDeleteGroup.mockClear()
  mockSetGroupBedMedia.mockClear()
  mockReplaceGroupSlides.mockClear()
})

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

  // Restated for 29-03: headers are no longer conditional on "does this section have a
  // slot" (showsSectionHeaderAt was deleted) — every SERVICE_SECTIONS member renders its
  // own header unconditionally, in fixed SERVICE_SECTIONS order, whether or not it holds
  // items (R043).
  it('renders all five section headers unconditionally, in SERVICE_SECTIONS order, Post-Service last (29-05)', async () => {
    mockServicesList = [buildSectionedService()] // no Pre-Service or Post-Service slot — still renders both headers
    const wrapper = await mountView()

    const headers = wrapper.findAll('[data-testid^="section-header-"]')
    expect(headers).toHaveLength(5)
    expect(headers[0]?.text()).toContain('Pre-Service')
    expect(headers[1]?.text()).toContain('Worship')
    expect(headers[2]?.text()).toContain('Message')
    expect(headers[3]?.text()).toContain('Sending')
    expect(headers[4]?.text()).toContain('Post-Service')
  })

  it('renders all five section headers, with placeholders, and routes every slot into the trailing ungrouped container for a legacy service (29-03/29-05)', async () => {
    mockServicesList = [mockService] // default fixture: no slot carries a `section` field
    const wrapper = await mountView()

    const headers = wrapper.findAll('[data-testid^="section-header-"]')
    expect(headers).toHaveLength(5)
    for (const section of ['pre-service', 'worship', 'message', 'sending', 'post-service']) {
      expect(wrapper.find(`[data-testid="section-empty-${section}"]`).exists()).toBe(true)
      expect(wrapper.find(`[data-testid="section-list-${section}"] .slot-item`).exists()).toBe(false)
    }
    const ungrouped = wrapper.find('[data-testid="section-list-ungrouped"]')
    expect(ungrouped.exists()).toBe(true)
    expect(ungrouped.findAll('.slot-item')).toHaveLength(mockService.slots.length)
  })

  it('renders an empty-section placeholder as a live drop target for a section with no slots (29-03)', async () => {
    mockServicesList = [buildSectionedService()] // no Pre-Service slot
    const wrapper = await mountView()

    const preServiceList = wrapper.find('[data-testid="section-list-pre-service"]')
    expect(preServiceList.exists()).toBe(true)
    const placeholder = preServiceList.find('[data-testid="section-empty-pre-service"]')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toContain('No items yet')
  })

  it('the Post-Service empty placeholder carries the purpose-naming UI-SPEC §2 copy; Pre-Service (also empty in this fixture) carries the generic copy (29-05)', async () => {
    mockServicesList = [buildSectionedService()] // no Pre-Service or Post-Service slot — both render empty
    const wrapper = await mountView()

    const postServicePlaceholder = wrapper.find('[data-testid="section-empty-post-service"]')
    expect(postServicePlaceholder.exists()).toBe(true)
    expect(postServicePlaceholder.text()).toContain(
      'Drag an item here, or set its Section to Post-Service — runs as people exit, e.g. a cycling announcement deck.',
    )

    const preServicePlaceholder = wrapper.find('[data-testid="section-empty-pre-service"]')
    expect(preServicePlaceholder.exists()).toBe(true)
    expect(preServicePlaceholder.text()).toContain('Drag an item here, or set its Section to Pre-Service.')
  })

  it('a Post-Service slot renders inside the Post-Service container and every slot kind is accepted there (29-05)', async () => {
    mockServicesList = [{
      ...mockService,
      slots: [
        { kind: 'SONG', id: 'ps-song', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'post-service' },
        { kind: 'IMPORTED', id: 'ps-imported', position: 1, importId: null, section: 'post-service' },
        { kind: 'PRAYER', id: 'ps-prayer', position: 2, section: 'post-service' },
      ],
    }]
    const wrapper = await mountView()

    const postServiceCards = wrapper.find('[data-testid="section-list-post-service"]').findAll('.slot-item')
    expect(postServiceCards.map((c) => c.attributes('data-slot-id'))).toEqual(['ps-song', 'ps-imported', 'ps-prayer'])
    expect(wrapper.find('[data-testid="section-empty-post-service"]').exists()).toBe(false)
  })

  it('every slot card carries data-slot-id equal to its slot.id, in section-major id order across containers (29-03)', async () => {
    mockServicesList = [makeSectionedService()] // s1..s8 already section-major: pre-service, worship x3, message x2, sending x2
    const wrapper = await mountView()

    const cards = wrapper.findAll('.slot-item')
    expect(cards.map((c) => c.attributes('data-slot-id'))).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'])
  })

  it("changing a slot's section via the select moves its card into the target section's container and renumbers positions section-major (29-03)", async () => {
    mockAuthState.isEditor = true
    mockServicesList = [buildSectionedService()] // slot-0/1 worship, slot-2 message, slot-3 sending
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // slot-3 (currently 'sending') -> reassign to 'worship'. It should now render inside
    // the worship container, after the two existing worship cards.
    const selects = wrapper.findAll('[data-testid="section-select"]')
    await selects[3]?.setValue('worship')
    await wrapper.vm.$nextTick()

    const worshipCards = wrapper.find('[data-testid="section-list-worship"]').findAll('.slot-item')
    expect(worshipCards.map((c) => c.attributes('data-slot-id'))).toEqual(['slot-0', 'slot-1', 'slot-3'])
    expect(wrapper.find('[data-testid="section-list-sending"]').find('.slot-item').exists()).toBe(false)

    // Section-major reindex (onSectionChange composes reindexSlots(orderSlotsBySection(...))):
    // the array's absolute index now runs 0..3 in the NEW order — moved slot-3 becomes array
    // index 2 (worship's third card), and message's now-lone slot-2 becomes array index 3.
    // Each card's `data-testid="slot-{index}"` reflects that renumbered absolute index directly,
    // without needing to wait on the (separately covered) debounced autosave write.
    expect(worshipCards.map((c) => c.attributes('data-testid'))).toEqual(['slot-0', 'slot-1', 'slot-2'])
    const messageCards = wrapper.find('[data-testid="section-list-message"]').findAll('.slot-item')
    expect(messageCards.map((c) => c.attributes('data-slot-id'))).toEqual(['slot-2'])
    expect(messageCards.map((c) => c.attributes('data-testid'))).toEqual(['slot-3'])
  })

  it('adding a slot inherits the section of the current last slot, landing at the end of that section rather than in the ungrouped container (29-03)', async () => {
    mockAuthState.isEditor = true
    mockServicesList = [buildSectionedService()] // last slot (slot-3) is 'sending'
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const addElementBtn = wrapper.findAll('button').find((b) => b.text() === 'Add Element')
    await addElementBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    const songBtn = wrapper.findAll('button').find((b) => b.text() === 'Song')
    await songBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const sendingCards = wrapper.find('[data-testid="section-list-sending"]').findAll('.slot-item')
    expect(sendingCards).toHaveLength(2)
    expect(wrapper.find('[data-testid="section-list-ungrouped"]').exists()).toBe(false)
  })

  it('does not mount PresentationViewer on initial render', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(false)
  })

  it('mounts PresentationViewer when the Slides tab emits present (D-05), and unmounts it when PresentationViewer emits exit', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    await wrapper.findComponent(SlidesTab).vm.$emit('present')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(true)

    await wrapper.findComponent(PresentationViewer).vm.$emit('exit')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(false)
  })

  it('passes the same assembledSlideshow array instance to PresentationViewer across re-renders, confirming it is not rebuilt locally', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    await wrapper.findComponent(SlidesTab).vm.$emit('present')
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

    // Third edit + save: the ids captured this time must match the first — as a SET, not
    // as an ordered array. Assigning slot-2 a section now also reorders the array
    // section-major (29-03: onSectionChange reindexes via orderSlotsBySection), so slot-2
    // legitimately moves to the front; what R028 actually guarantees is that no id is
    // dropped or re-minted across the stale remote merge, not that array order is stable
    // across an unrelated ordering change this same edit triggers.
    selects = wrapper.findAll('[data-testid="section-select"]')
    await selects[2]!.setValue('sending')
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).toHaveBeenCalledTimes(2)
    const secondPayload = mockUpdateService.mock.calls[1]![1] as { slots: Array<{ id?: string }> }
    const secondIds = secondPayload.slots.map((s) => s.id)

    expect([...secondIds].sort()).toEqual([...firstIds].sort())
  })
})

// ── Slot delete cascades to its group (Phase 24-06 Task 2, R029) ───────────────

describe('ServiceEditorView - slot delete cascades to its group (Phase 24-06 Task 2, R029)', () => {
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
          // shallowMount auto-stubs <Teleport> (its default `shallow` behavior
          // treats ANY non-root component — including Vue's built-in Teleport
          // — as stubbable, discarding its children) UNLESS explicitly opted
          // out here. Without this, the slot-delete confirm dialog's content
          // never reaches document.body and every assertion below silently
          // finds nothing.
          teleport: false,
        },
      },
    })
  }

  // The slot-delete confirm dialog renders via <Teleport to="body"> — Vue
  // Test Utils' documented pattern for asserting against teleported content
  // (see src/components/__tests__/PptxImportModal.test.ts).
  function body() {
    return new DOMWrapper(document.body)
  }

  function buildGroup(slotId: string, overrides: Partial<SlideGroup> = {}): SlideGroup {
    return {
      id: slotId,
      slotId,
      serviceId: 'service-1',
      slides: [],
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      ...overrides,
    }
  }

  async function openDeleteConfirm(wrapper: Awaited<ReturnType<typeof mountView>>, index: number) {
    const removeButtons = wrapper.findAll('[title="Remove element"]')
    await removeButtons[index]!.trigger('click')
    await wrapper.vm.$nextTick()
  }

  function confirmButton() {
    return body().findAll('button').find((b) => b.text() === 'Remove')
  }

  function cancelButton() {
    return body().findAll('button').find((b) => b.text() === 'Cancel')
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [mockService]
    mockUpdateService.mockClear()
  })

  it('confirming a remove-element delete calls deleteGroup with the slot id BEFORE the splice', async () => {
    let resolveDelete!: () => void
    mockDeleteGroup.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveDelete = resolve }))

    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await confirmButton()!.trigger('click')
    await wrapper.vm.$nextTick()

    // deleteGroup has been called, but its promise is still pending — the
    // splice must not have happened yet.
    expect(mockDeleteGroup).toHaveBeenCalledWith('org-1', 'slot-0')
    expect(wrapper.findAll('[data-testid="section-select"]')).toHaveLength(9)

    resolveDelete()
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid="section-select"]')).toHaveLength(8)
  })

  it('R045 membership lock: after a confirmed remove-element delete, the removed slot id no longer appears in the view and no further group delete is issued for it', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await confirmButton()!.trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    // Membership: the removed slot's id is gone from the rendered slot list.
    const remainingSlotIds = wrapper.findAll('[data-slot-id]').map((w) => w.attributes('data-slot-id'))
    expect(remainingSlotIds).not.toContain('slot-0')

    const callsAfterDelete = mockDeleteGroup.mock.calls.length
    expect(callsAfterDelete).toBe(1)

    // Locked, not just cascaded once: further ticks (e.g. an unrelated
    // autosave/reactivity pass) issue no repeat delete for the same slot.
    await flushPromises()
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))

    expect(mockDeleteGroup).toHaveBeenCalledTimes(callsAfterDelete)
    expect(mockDeleteGroup).toHaveBeenCalledWith('org-1', 'slot-0')
  })

  it('cancelling calls neither deleteGroup nor the splice, leaving the slot list unchanged', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await cancelButton()!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockDeleteGroup).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="section-select"]')).toHaveLength(9)
  })

  it('names the true slide count and attached audio for a group with six slides and bed audio, and never claims attached video (D-18)', async () => {
    mockSlideGroupsState.groups = [
      buildGroup('slot-0', {
        bedAudioUrl: 'https://example.com/bed.mp3',
        slides: Array.from({ length: 6 }, (_, i) => ({
          id: `slide-${i}`,
          order: i,
          sourceRef: { kind: 'text' } as const,
        })),
      }),
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    const dialogText = body().text()
    expect(dialogText).toContain('6')
    expect(dialogText).toContain('attached audio')
    expect(dialogText).not.toContain('attached video')
  })

  it('names operator notes and per-slide audio when present, with no group bed', async () => {
    mockSlideGroupsState.groups = [
      buildGroup('slot-0', {
        slides: [
          { id: 'slide-0', order: 0, sourceRef: { kind: 'text' }, notes: 'watch the tempo change' },
          { id: 'slide-1', order: 1, sourceRef: { kind: 'text' }, audioUrl: 'https://example.com/slide-audio.mp3' },
        ],
      }),
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    const dialogText = body().text()
    expect(dialogText).toContain('operator notes')
    expect(dialogText).toContain('per-slide audio')
  })

  it('makes no attached-media claim for a group with no media and no notes', async () => {
    mockSlideGroupsState.groups = [
      buildGroup('slot-0', { slides: [{ id: 'slide-0', order: 0, sourceRef: { kind: 'text' } }] }),
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    const dialogText = body().text()
    expect(dialogText).toContain('with no attached audio or notes')
  })

  it('names zero slides and still completes the delete when the slot has no group', async () => {
    mockSlideGroupsState.groups = [] // no group at all for slot-0
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    expect(body().text()).toContain('0 slides')

    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(mockDeleteGroup).toHaveBeenCalledWith('org-1', 'slot-0')
    expect(wrapper.findAll('[data-testid="section-select"]')).toHaveLength(8)
  })

  it('deleting one of two slots referencing the same song calls deleteGroup exactly once, with that slot id', async () => {
    mockServicesList = [{
      ...mockService,
      slots: [
        { kind: 'SONG', id: 'dup-a', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
        { kind: 'SONG', id: 'dup-b', position: 1, requiredVwType: 2, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
      ],
    }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(mockDeleteGroup).toHaveBeenCalledTimes(1)
    expect(mockDeleteGroup).toHaveBeenCalledWith('org-1', 'dup-a')
  })

  it('deleting a middle slot leaves the surviving slots ids unchanged after reindexSlots', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Absorb the autosave watcher's first-ever trigger (see the Task 1 tests'
    // comment for why this is needed in this synchronous-mock environment) with an edit
    // on slot-8. Since 29-03 onSectionChange reorders section-major, this ALSO moves
    // slot-8 to the front of the render (ahead of the still-ungrouped slot-0..slot-7) —
    // the remove-button index below accounts for that reordering.
    const selects = wrapper.findAll('[data-testid="section-select"]')
    await selects[8]!.setValue('sending')

    // Post-reorder remove-button order is [slot-8, slot-0, slot-1, slot-2, slot-3, slot-4,
    // slot-5, slot-6, slot-7] — slot-4 (this test's target) is now at button index 5.
    await openDeleteConfirm(wrapper, 5)
    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    await new Promise((resolve) => setTimeout(resolve, 900))

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id?: string; position: number }> }
    expect(payload.slots.map((s) => s.id)).toEqual([
      'slot-8', 'slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-5', 'slot-6', 'slot-7',
    ])
    expect(payload.slots.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('the clear-song branch calls deleteGroup zero times', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const clearSongBtn = wrapper.find('[title="Remove song"]')
    expect(clearSongBtn.exists()).toBe(true)
    await clearSongBtn.trigger('click')
    await wrapper.vm.$nextTick()

    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(mockDeleteGroup).not.toHaveBeenCalled()
  })

  it('a failed group delete leaves the slot in place (T-24-06-02)', async () => {
    mockDeleteGroup.mockRejectedValueOnce(new Error('network error'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid="section-select"]')).toHaveLength(9)

    errSpy.mockRestore()
  })
})

// ── Slides tab: third tab button and panel (Phase 25-03) ────────────────────────

describe('ServiceEditorView - Slides tab (Phase 25-03)', () => {
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
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [mockService]
  })

  it('renders three tab buttons, the third reading Slides', async () => {
    const wrapper = await mountView()
    const tabButtons = wrapper.findAll('button').filter((b) => ['Service Order', 'Roles', 'Slides'].includes(b.text()))
    expect(tabButtons.map((b) => b.text())).toEqual(['Service Order', 'Roles', 'Slides'])
  })

  it('viewer: the Slides button is present while the Roles button is not', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()
    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    const rolesBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    expect(slidesBtn?.exists()).toBe(true)
    expect(rolesBtn).toBeUndefined()
  })

  it('clicking Slides shows the slides panel and hides the service order panel', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(false)

    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    expect(slidesBtn?.exists()).toBe(true)
    await slidesBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(isVShowHidden(wrapper.findComponent(SlidesTab))).toBe(false)
    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(true)
  })

  it('the default active tab is unchanged (still opens on Service Order)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(false)
  })

  it('the slides panel receives the assembled slideshow and the groups map as props', async () => {
    mockSlideGroupsState.groups = [
      { id: 'slot-0', slotId: 'slot-0', serviceId: 'service-1', slides: [], createdAt: mockTimestamp, updatedAt: mockTimestamp },
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.exists()).toBe(true)
    expect(slidesTab.props('assembledSlideshow')).toBeDefined()
    expect(Array.isArray(slidesTab.props('assembledSlideshow'))).toBe(true)
    expect(slidesTab.props('groupsBySlotId')).toBeInstanceOf(Map)
    expect((slidesTab.props('groupsBySlotId') as Map<string, unknown>).has('slot-0')).toBe(true)
    expect(slidesTab.props()).not.toHaveProperty('pendingReconciliations')
    expect(slidesTab.props('slots')).toEqual(mockService.slots)
    expect(slidesTab.props('serviceId')).toBe('service-1')
    expect(slidesTab.props('isEditor')).toBe(true)
  })

  it('passes the on-demand group materializer down to the slides panel (25-05 Task 1)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.props('ensureGroupMaterialized')).toBeInstanceOf(Function)
  })

  it('the slides panel is told it is active only while the Slides tab is selected', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    let slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.props('active')).toBe(false)

    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    await slidesBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.props('active')).toBe(true)

    const serviceOrderBtn = wrapper.findAll('button').find((b) => b.text() === 'Service Order')
    await serviceOrderBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.props('active')).toBe(false)
  })

  it('renders no page-level import control and no generate-missing-slides control anywhere on the page', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).not.toContain('Generate missing slides')
    // The existing per-item "Import PowerPoint" menu entries are unrelated
    // page-level actions this phase does not touch — only a NEW page-level
    // "⇪ Import" header button (D-02) is prohibited.
    expect(wrapper.find('[data-testid="page-level-import"]').exists()).toBe(false)
  })

  it('the first tab button still reads Service Order', async () => {
    const wrapper = await mountView()
    const firstTabBtn = wrapper.findAll('button').filter((b) => ['Service Order', 'Roles', 'Slides'].includes(b.text()))[0]
    expect(firstTabBtn?.text()).toBe('Service Order')
  })

  it('the first tab panel is reachable by a stable data-testid seam (27-02)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const panel = wrapper.find('[data-testid="service-order-panel"]')
    expect(panel.exists()).toBe(true)
    expect(isVShowHidden(panel)).toBe(false)
  })
})

// ── "Edit in scripture" plumbing (Phase 26-03, D-15) ────────────────────────────
// The drawer built in 26-05/26-07 relays a request up through SlidesTab's
// `navigate-to-scripture-editor` event. Here the SlidesTab is shallow-mount
// stubbed, so tests emit that event directly on the stub — the same seam a
// real drawer will use once wired.

describe('ServiceEditorView - Edit in scripture plumbing (Phase 26-03)', () => {
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
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [mockService]
  })

  it('switches to the Service Order tab and expands the requested scripture plan item\'s editor', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Start on the Slides tab so the tab switch is observable.
    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    await slidesBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(true)

    // slot-1 is the populated SCRIPTURE plan item (raw array index 1).
    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(false)
    const panel = wrapper.find('[data-scripture-panel-index="1"]')
    expect(panel.exists()).toBe(true)
  })

  it('asking twice never collapses the editor — the second request is a no-op, not a toggle', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-scripture-panel-index="1"]').exists()).toBe(true)

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-scripture-panel-index="1"]').exists()).toBe(true)
  })

  it('the existing hand-operated button still opens then closes on alternate clicks', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const btn = wrapper.find('[data-testid="edit-scripture-slides-btn"]')
    expect(btn.exists()).toBe(true)

    await btn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="scripture-editor-panel"]').exists()).toBe(true)

    await btn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="scripture-editor-panel"]').exists()).toBe(false)
  })

  it('an out-of-range index changes nothing and does not throw', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(() => wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 999)).not.toThrow()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="scripture-editor-panel"]').exists()).toBe(false)
  })

  it('a request naming a non-scripture plan item changes nothing', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // slot-0 is a SONG plan item.
    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 0)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="scripture-editor-panel"]').exists()).toBe(false)
  })

  it('expanding one plan item\'s editor never expands or collapses another\'s', async () => {
    // Make both slot-1 and slot-4 populated scripture items so two panels can exist.
    const twoScriptureService: Service = {
      ...mockService,
      slots: mockService.slots.map((slot) =>
        slot.id === 'slot-4'
          ? { ...slot, book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }
          : slot,
      ),
    }
    mockServicesList = [twoScriptureService]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-scripture-panel-index="1"]').exists()).toBe(true)
    expect(wrapper.find('[data-scripture-panel-index="4"]').exists()).toBe(false)
  })
})

// ── No deck-editing or deck-import surface on the Service Order tab (Phase 27-03, R034) ──
// The imported-deck editor and both section-scoped PowerPoint/image import actions are
// removed from this tab (deck import now lives on the Slides tab, Phase 25-07). The
// imported plan item's own row — its heading and empty-state wording — is service
// structure and stays; only its slide-editing half leaves.

describe('ServiceEditorView - no deck editing or deck import on the Service Order tab (Phase 27-03)', () => {
  const importedSlidesService: Service = {
    ...mockService,
    slots: [
      ...mockService.slots,
      { kind: 'IMPORTED', id: 'slot-imported-with-id', position: 9, importId: 'import-1' },
      { kind: 'IMPORTED', id: 'slot-imported-empty', position: 10, importId: null },
    ],
  }

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
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [importedSlidesService]
  })

  it('offers no way to expand or view an imported deck editor', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="edit-imported-slides-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="imported-editor-panel"]').exists()).toBe(false)
  })

  it('offers no PowerPoint/image import action in the Add Element menu, and the modal it opened is gone', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const addElementBtn = wrapper.findAll('button').find((b) => b.text() === 'Add Element')
    expect(addElementBtn?.exists()).toBe(true)
    await addElementBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="add-import-announcements"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-import-sermon"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Import PowerPoint')
  })

  it('still offers the five non-import Add Element entries', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const addElementBtn = wrapper.findAll('button').find((b) => b.text() === 'Add Element')
    await addElementBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const menuLabels = wrapper.findAll('button').map((b) => b.text())
    expect(menuLabels).toEqual(expect.arrayContaining(['Song', 'Scripture Reading', 'Prayer', 'Message', 'Hymn']))
  })

  it('an existing imported plan item with a deck still renders its heading', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Imported Slides')
  })

  it('an existing imported plan item with no deck still renders its empty-state wording', async () => {
    mockServicesList = [
      {
        ...mockService,
        slots: [
          ...mockService.slots,
          { kind: 'IMPORTED', id: 'slot-imported-empty-only', position: 9, importId: null },
        ],
      },
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Imported Slides — Empty')
  })
})

// ── Reorder repro (Phase 29-01, R044) ────────────────────────────────────────
// Builds the FAILING reproduction of the reported ZTXcpNRcJTalEQp42fTx symptom
// (Sending mid-list, Message last, Worship appearing twice) before any source
// fix lands. Every fixture below includes section-header nodes as REAL
// siblings of the slot items — exactly as ServiceEditorView.vue renders them —
// and every index handed to `onEnd` is derived from that live DOM by
// `simulateSlotDrag`, never hand-passed. This is deliberate: the pre-existing
// tests above (and SlideGrid.test.ts's pre-29-01 shape) pass with the three
// defects still present precisely because their fixtures have no header
// siblings and their indices are typed in by hand. Every assertion below
// reads `slot.id` identity, never position/index.
describe('ServiceEditorView - Phase 29 reorder repro', () => {
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

  /** Resolves the container that holds `section`'s `.slot-item` nodes —
   *  prefers a scoped per-section container (the 29-03 shape); falls back to
   *  the single flat container that holds every `.slot-item` today. */
  function resolveSectionContainer(wrapper: Awaited<ReturnType<typeof mountView>>, section: string): HTMLElement {
    const scoped = wrapper.find(`[data-testid="section-list-${section}"]`)
    if (scoped.exists()) return scoped.element as HTMLElement
    const anySlotItem = wrapper.find('.slot-item')
    if (!anySlotItem.exists()) throw new Error('simulateSlotDrag: no .slot-item found in the rendered DOM')
    return anySlotItem.element.parentElement as HTMLElement
  }

  /** The `.slot-item` element children of `container` that belong to
   *  `section` — scanned as the siblings between `section-header-{section}`
   *  and the next `.section-header` (today's flat render), or every
   *  `.slot-item` child when the container has no header siblings at all
   *  (the 29-03 per-section shape). */
  function sectionSlotItems(container: HTMLElement, section: string): HTMLElement[] {
    const children = Array.from(container.children) as HTMLElement[]
    const headerIndex = children.findIndex((c) => c.dataset.testid === `section-header-${section}`)
    if (headerIndex === -1) {
      return children.filter((c) => c.classList.contains('slot-item'))
    }
    const items: HTMLElement[] = []
    for (let i = headerIndex + 1; i < children.length; i++) {
      const child = children[i]!
      if (child.classList.contains('section-header')) break
      if (child.classList.contains('slot-item')) items.push(child)
    }
    return items
  }

  function elementIndex(container: HTMLElement, node: HTMLElement): number {
    return Array.from(container.children).indexOf(node)
  }

  function draggableIndex(container: HTMLElement, node: HTMLElement): number {
    return Array.from(container.children)
      .filter((c) => (c as HTMLElement).classList.contains('slot-item'))
      .indexOf(node)
  }

  /**
   * Derives BOTH SortableJS index pairs from the LIVE rendered DOM and
   * invokes the matching capture's `onEnd` directly — never accepts a
   * hand-passed index. Works unchanged whether the source/destination
   * containers are today's single flat list (headers as siblings) or the
   * per-section containers 29-03 introduces.
   */
  async function simulateSlotDrag(
    wrapper: Awaited<ReturnType<typeof mountView>>,
    { fromSection, fromPos, toSection, toPos }: { fromSection: string; fromPos: number; toSection: string; toPos: number },
  ): Promise<void> {
    const fromContainer = resolveSectionContainer(wrapper, fromSection)
    const toContainer = resolveSectionContainer(wrapper, toSection)

    const fromItems = sectionSlotItems(fromContainer, fromSection)
    const item = fromItems[fromPos]
    if (!item) throw new Error(`simulateSlotDrag: no slot-item at ${fromSection}[${fromPos}]`)

    const oldIndex = elementIndex(fromContainer, item)
    const oldDraggableIndex = draggableIndex(fromContainer, item)

    // Destination items EXCLUDING the dragged node itself (relevant for a
    // within-section move, where `item` is still one of `toSection`'s
    // current children) — `toPos` indexes into this post-removal ordering,
    // matching the splice-out/splice-in mental model the fix itself uses.
    const toItemsExcludingSelf = sectionSlotItems(toContainer, toSection).filter((el) => el !== item)
    const destAnchor = toItemsExcludingSelf[toPos] ?? null

    let newIndex: number
    let newDraggableIndex: number
    if (destAnchor) {
      newIndex = elementIndex(toContainer, destAnchor)
      newDraggableIndex = draggableIndex(toContainer, destAnchor)
    } else if (toItemsExcludingSelf.length > 0) {
      // Past the last existing item in the destination section — land one
      // position after it.
      const lastEl = toItemsExcludingSelf[toItemsExcludingSelf.length - 1]!
      newIndex = elementIndex(toContainer, lastEl) + 1
      newDraggableIndex = draggableIndex(toContainer, lastEl) + 1
    } else {
      // Destination section has no OTHER items — land immediately after its
      // header. Not exercised by either repro test below (both target a
      // non-empty section), kept correct for reuse by later plans.
      const headerEl = Array.from(toContainer.children).find(
        (c) => (c as HTMLElement).dataset.testid === `section-header-${toSection}`,
      ) as HTMLElement | undefined
      newIndex = headerEl ? elementIndex(toContainer, headerEl) + 1 : 0
      newDraggableIndex = 0
    }

    const capture = captureForSection(fromSection) ?? flatCapture()
    if (!capture) throw new Error(`simulateSlotDrag: no Sortable capture resolved for section "${fromSection}"`)

    await capture.options.onEnd!({
      oldIndex,
      newIndex,
      oldDraggableIndex,
      newDraggableIndex,
      item,
      from: fromContainer,
      to: toContainer,
    } as never)
    await flushPromises()
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [makeSectionedService()]
    mockUpdateService.mockClear()
    resetSortableCaptures()
  })

  it('lands a service item exactly where it was dropped (R044)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Worship is [s2, s3, s4] — drag s4 (worship position 2) to the first
    // position of the message section (currently [s5, s6]).
    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 2, toSection: 'message', toPos: 0 })

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id: string; section?: string }> }
    const ids = payload.slots.map((s) => s.id)

    // Source removed from worship, inserted at the front of message — every
    // other section's internal order and the section-major ordering itself
    // are otherwise untouched.
    expect(ids).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'])
    expect(payload.slots.map((s) => s.section)).toEqual([
      'pre-service', 'worship', 'worship', 'message', 'message', 'message', 'sending', 'sending',
    ])
    // Pins the "Worship appeared twice" symptom directly: no id may repeat.
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('moves an item within its own section to a non-adjacent position (R044)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Worship is [s2, s3, s4] — drag s2 (position 0) to the last position —
    // the single-step DOM revert only undoes one adjacent step, so a
    // multi-position move is where DOM and persisted state diverge.
    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 0, toSection: 'worship', toPos: 2 })

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id: string }> }
    const ids = payload.slots.map((s) => s.id)

    expect(ids).toEqual(['s1', 's3', 's4', 's2', 's5', 's6', 's7', 's8'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('creates one Sortable instance per rendered section list container, sharing the group name; the ungrouped container is pull-only (put: false)', async () => {
    mockServicesList = [{
      ...makeSectionedService(),
      slots: [...makeSectionedService().slots, { kind: 'PRAYER', id: 's9', position: 8 }], // section-less -> ungrouped
    }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(sortableCaptures).toHaveLength(6) // 5 sections (including the always-rendered, empty Post-Service) + the ungrouped container
    for (const section of ['pre-service', 'worship', 'message', 'sending', 'post-service']) {
      expect(captureForSection(section)?.options.group).toBe('service-slots')
    }
    // The ungrouped container has no `data-section` attribute — flatCapture() resolves it.
    expect(flatCapture()?.options.group).toEqual({ name: 'service-slots', pull: true, put: false })
  })

  it('reads only the Draggable-suffixed indices — deliberately wrong un-prefixed oldIndex/newIndex do not affect the result', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const worshipCapture = captureForSection('worship')
    if (!worshipCapture) throw new Error('no worship capture resolved')

    // Same move as "moves an item within its own section..." above (s2 -> worship's last
    // position) but with oldIndex/newIndex set to values that would splice the WRONG slot
    // if the handler ever read them — it must not.
    await worshipCapture.options.onEnd!({
      oldIndex: 99,
      newIndex: 0,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: worshipCapture.el.children[0] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)
    await flushPromises()

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id: string }> }
    expect(payload.slots.map((s) => s.id)).toEqual(['s1', 's3', 's4', 's2', 's5', 's6', 's7', 's8'])
  })

  it('performs no write for a no-op drag (same section, same draggable index)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const worshipCapture = captureForSection('worship')
    if (!worshipCapture) throw new Error('no worship capture resolved')

    await worshipCapture.options.onEnd!({
      oldIndex: 0,
      newIndex: 0,
      oldDraggableIndex: 1,
      newDraggableIndex: 1,
      item: worshipCapture.el.children[1] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)
    await flushPromises()

    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('destroys every Sortable instance on unmount', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const instanceCount = sortableCaptures.length
    expect(instanceCount).toBeGreaterThan(0)
    mockSlotSortableDestroy.mockClear()
    wrapper.unmount()

    expect(mockSlotSortableDestroy).toHaveBeenCalledTimes(instanceCount)
  })

  // ── Save-failure revert and the 'error' autosave state (Task 3, T-29-09) ─────
  it('reverts to the pre-drag id sequence and surfaces the UI-SPEC §5 message when the reorder write rejects, logging once via the bracketed-module convention', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUpdateService.mockRejectedValueOnce(new Error('network error'))
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 0, toSection: 'worship', toPos: 2 })

    // Reverted: the write failed, so the editor must show the exact pre-drag id
    // sequence — never an order that was never persisted.
    const cards = wrapper.findAll('.slot-item')
    expect(cards.map((c) => c.attributes('data-slot-id'))).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'])

    const errorMsg = wrapper.find('[data-testid="autosave-error"]')
    expect(errorMsg.exists()).toBe(true)
    expect(errorMsg.text()).toBe("Couldn't save this order — reverted. Try dragging again.")

    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalledWith('[ServiceEditorView] reorder save failed:', expect.any(Error))

    errSpy.mockRestore()
  })

  it('a subsequent successful reorder clears the error state', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUpdateService.mockRejectedValueOnce(new Error('network error'))
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 0, toSection: 'worship', toPos: 2 })
    expect(wrapper.find('[data-testid="autosave-error"]').exists()).toBe(true)

    // Same move again — this time the write resolves (mockUpdateService's default
    // implementation, not overridden a second time).
    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 0, toSection: 'worship', toPos: 2 })
    expect(wrapper.find('[data-testid="autosave-error"]').exists()).toBe(false)

    errSpy.mockRestore()
  })

  // ── CR-01 regression: overlapping drags, first fails, second succeeds ────────
  // Reproduces the code-review BLOCKER empirically: SortableJS invokes `onEnd`
  // fire-and-forget (never awaited), so a second, faster drag can start — and its
  // write can succeed and persist — before an earlier drag's write settles. The
  // earlier drag's rejection must NOT restore a stale pre-drag snapshot that
  // discards the later, already-persisted edit, and must NOT leave a stale array
  // for the general autosave debounce to silently re-persist over the successful
  // write.
  it('a failed drag does not clobber (locally or via the debounce re-save) a later drag that already succeeded', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Drag A's write is held open until explicitly rejected below — this lets
    // drag B's write resolve first, matching the reviewer's empirical repro
    // timing (drag B's write settles BEFORE drag A's rejection is observed).
    let rejectDragA!: (err: Error) => void
    const dragAWrite = new Promise<void>((_resolve, reject) => {
      rejectDragA = reject
    })
    mockUpdateService.mockImplementationOnce(() => dragAWrite)

    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const worshipCapture = captureForSection('worship')
    if (!worshipCapture) throw new Error('no worship capture resolved')

    // Drag A: worship is [s2, s3, s4] — move s2 (draggableIndex 0) to the last
    // position (draggableIndex 2). Fire-and-forget: do NOT await the returned
    // promise, matching real SortableJS's `onEnd` invocation.
    void worshipCapture.options.onEnd!({
      oldIndex: 0,
      newIndex: 2,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: worshipCapture.el.children[0] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)

    // Let Vue apply drag A's synchronous optimistic mutation (worship is now
    // [s3, s4, s2] locally) before drag B reads state. Drag A's write is still
    // pending (dragAWrite unresolved) — this is the "overlapping" window.
    await wrapper.vm.$nextTick()
    expect(mockUpdateService).toHaveBeenCalledTimes(1)

    // Drag B: move s3 (now worship draggableIndex 0) to the last position
    // (draggableIndex 2). This write resolves via the default mock
    // (Promise.resolve()) and is fully awaited here, so it settles before
    // drag A's rejection below.
    await worshipCapture.options.onEnd!({
      oldIndex: 0,
      newIndex: 2,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: worshipCapture.el.children[0] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)

    expect(mockUpdateService).toHaveBeenCalledTimes(2)
    const dragBPayload = mockUpdateService.mock.calls[1]![1] as { slots: Array<{ id: string }> }
    // s3 -> s4 -> s2 -> s3: worship becomes [s4, s2, s3].
    expect(dragBPayload.slots.map((s) => s.id)).toEqual(['s1', 's4', 's2', 's3', 's5', 's6', 's7', 's8'])

    // Drag A's write now rejects — its stale, pre-both-drags snapshot must NOT
    // be restored over drag B's already-persisted result.
    rejectDragA(new Error('network error'))
    await flushPromises()

    // Drag B's persisted order must survive in local state...
    const cards = wrapper.findAll('.slot-item')
    expect(cards.map((c) => c.attributes('data-slot-id'))).toEqual(['s1', 's4', 's2', 's3', 's5', 's6', 's7', 's8'])

    // ...the error must be visible (not silent)...
    expect(wrapper.find('[data-testid="autosave-error"]').exists()).toBe(true)

    // ...and the general 800ms autosave debounce must NOT then silently
    // re-persist a stale array over drag B's committed write. A third call (or
    // a third call whose payload isn't drag B's order) means the bug is back.
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).toHaveBeenCalledTimes(2)

    errSpy.mockRestore()
  })
})

// ── R047: linking a newly minted scripture reading to its slot (Phase 30 verify) ──
// Verification defect: adding a scripture item produced NO slide on the Slides
// tab. Root cause was here, not in the materializer — ScriptureSlideEditor
// minted the reading document and kept the id in a local ref, so
// `slot.scriptureReadingId` stayed null and `deriveGroupEntries` correctly
// returned zero entries for a slot pointing at nothing.
describe('ServiceEditorView - R047 scripture reading link', () => {
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
          ScriptureSlideEditor: { name: 'ScriptureSlideEditor', props: ['orgId', 'readingId'], template: '<div />' },
          CongregationalEditor: { name: 'CongregationalEditor', props: ['orgId', 'readingId'], template: '<div />' },
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    // slot-1 is SCRIPTURE with a populated reference and NO scriptureReadingId.
    mockServicesList = [buildSectionedService()]
  })

  async function openScriptureEditor() {
    const wrapper = await mountView()
    const btn = wrapper.find('[data-testid="edit-scripture-slides-btn"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('starts with no reading linked to the scripture slot', async () => {
    const wrapper = await openScriptureEditor()
    const editor = wrapper.findComponent({ name: 'ScriptureSlideEditor' })
    expect(editor.exists()).toBe(true)
    expect(editor.props('readingId')).toBeUndefined()
  })

  it('writes the emitted reading id onto the slot, so the editor re-renders bound to it', async () => {
    const wrapper = await openScriptureEditor()
    const editor = wrapper.findComponent({ name: 'ScriptureSlideEditor' })

    editor.vm.$emit('reading-created', 'reading-xyz')
    await wrapper.vm.$nextTick()

    // The prop round-trip proves the id reached `localService.slots[index]`:
    // it can only come back down through the same `:readingId` binding.
    expect(wrapper.findComponent({ name: 'ScriptureSlideEditor' }).props('readingId')).toBe('reading-xyz')
  })

  // D-15: written immediately, NOT left to the 800ms debounce. That watcher is
  // armed by a `localService` replacement, so a nested slots[index] write does
  // not reliably re-arm it — the same brittleness the owner reported for song
  // changes, which Phase 32 owns. A dropped link here means the slot forgets
  // which passage it points at and the slide vanishes again.
  it('persists the link immediately, without waiting on the autosave debounce', async () => {
    const wrapper = await openScriptureEditor()
    mockUpdateService.mockClear()

    wrapper.findComponent({ name: 'ScriptureSlideEditor' }).vm.$emit('reading-created', 'reading-xyz')
    await flushPromises()

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const [, patch] = mockUpdateService.mock.calls[0] as [string, { slots: Array<Record<string, unknown>> }]
    const scriptureSlot = patch.slots.find((s) => s.kind === 'SCRIPTURE')
    expect(scriptureSlot?.scriptureReadingId).toBe('reading-xyz')
    // Every other slot is carried through untouched.
    expect(patch.slots).toHaveLength(buildSectionedService().slots.length)
  })

  it('is idempotent — re-emitting the id already stored writes nothing new', async () => {
    const wrapper = await openScriptureEditor()
    wrapper.findComponent({ name: 'ScriptureSlideEditor' }).vm.$emit('reading-created', 'reading-xyz')
    await flushPromises()

    mockUpdateService.mockClear()
    wrapper.findComponent({ name: 'ScriptureSlideEditor' }).vm.$emit('reading-created', 'reading-xyz')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(mockUpdateService).not.toHaveBeenCalled()
  })
})
