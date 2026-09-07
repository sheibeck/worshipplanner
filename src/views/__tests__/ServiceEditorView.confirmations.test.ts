import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { shallowMount, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Options as SortableOptions } from 'sortablejs'
import type { Service } from '@/types/service'
import type { Person, Role, Quarter } from '@/types/roster'
import type { Timestamp } from 'firebase/firestore'

// Mirrors the mount/mock harness in ServiceEditorView.stage.test.ts — a NEW
// file per the plan (133-03), same rationale: ServiceEditorView.test.ts is
// already 9000+ lines, so a dedicated file for this feature's onSnapshot
// harness is more maintainable than a 51st describe block there. Only what
// Task 1/2 (R411 live confirmation status chips) need is asserted here —
// every other tab's behavior is covered by the existing files.

enableAutoUnmount(afterEach)

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRoute = reactive({ params: { id: 'service-1' } })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' },
}))

// `onSnapshotCalls` captures every onSnapshot registration this component
// makes so the test can find the confirmations listener (identified by its
// `collection()`-built path) and fire fake snapshot emissions at it directly
// — proving the chip is LIVE (onSnapshot-driven), not a one-time fetch.
const {
  mockGetDoc,
  mockSetDoc,
  mockHttpsCallable,
  mockQueueCallable,
  mockResolveRecipients,
  mockOnSnapshot,
  onSnapshotCalls,
} = vi.hoisted(() => {
  type FakeDoc = { data: () => unknown }
  type FakeSnapshot = { docs: FakeDoc[] }
  const onSnapshotCalls: { path: string; onNext: (snap: FakeSnapshot) => void }[] = []
  const mockOnSnapshot = vi.fn(
    (ref: { __path?: string } | undefined, onNext: (snap: FakeSnapshot) => void, _onError?: unknown) => {
      onSnapshotCalls.push({ path: ref?.__path ?? '', onNext })
      return () => {}
    },
  )
  const mockQueueCallable = vi.fn<(...a: unknown[]) => Promise<{ data: { messageId: string } }>>(() =>
    Promise.resolve({ data: { messageId: 'msg-1' } }),
  )
  return {
    mockGetDoc: vi.fn<(...a: unknown[]) => Promise<{ exists: () => boolean; data?: () => Record<string, unknown> }>>(
      () => Promise.resolve({ exists: () => false, data: () => ({ orgIds: ['org-1'] }) }),
    ),
    mockSetDoc: vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve()),
    mockQueueCallable,
    mockHttpsCallable: vi.fn<(...a: unknown[]) => typeof mockQueueCallable>(() => mockQueueCallable),
    mockResolveRecipients: vi.fn<
      (...a: unknown[]) => { reachable: Array<{ id: string; name: string; email: string }>; unreachableCount: number }
    >(() => ({ reachable: [], unreachableCount: 0 })),
    mockOnSnapshot,
    onSnapshotCalls,
  }
})

vi.mock('@/firebase', () => ({ auth: {}, db: {}, functions: {} }))

vi.mock('firebase/functions', () => ({
  httpsCallable: (...a: unknown[]) => mockHttpsCallable(...a),
}))

vi.mock('@/utils/messagingRecipients', () => ({
  resolveRecipients: (...a: unknown[]) => mockResolveRecipients(...a),
  MESSAGING_TEAM_LABELS: { band: 'Band', tech: 'Tech', vocals: 'Vocals', other: 'Other' },
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  // Builds a distinguishable path marker so onSnapshotCalls can find the
  // confirmations listener specifically (component code passes
  // `collection(db, 'organizations', orgId, 'services', svcId, 'confirmations')`).
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ __path: segments.join('/') })),
  doc: vi.fn(() => ({})),
  onSnapshot: mockOnSnapshot,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({})),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
}))

const mockSlotSortableDestroy = vi.fn()
vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((_el: HTMLElement, _options: SortableOptions) => ({ destroy: mockSlotSortableDestroy })),
  },
}))

vi.mock('@/stores/scriptureSlides', () => ({
  useScriptureSlides: () => ({
    readings: [],
    isLoading: false,
    subscribeReadings: vi.fn(),
    unsubscribeReadings: vi.fn(),
  }),
}))

vi.mock('@/stores/importedSlides', () => ({
  useImportedSlides: () => ({
    decks: [],
    isLoading: false,
    subscribeDecks: vi.fn(),
    unsubscribeDecks: vi.fn(),
  }),
}))

vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    groups: [],
    isLoading: false,
    groupsBySlotId: new Map(),
    subscribeGroups: vi.fn(),
    unsubscribeGroups: vi.fn(),
    materializeGroupIfMissing: vi.fn(() => Promise.resolve(true)),
    deleteGroup: vi.fn(() => Promise.resolve()),
    setGroupBedMedia: vi.fn(() => Promise.resolve()),
    replaceGroupSlides: vi.fn(() => Promise.resolve()),
  }),
}))

const mockTimestamp = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp

// No SONG slots — keeps useSlideshowAssembly's per-song lyrics onSnapshot
// subscription from ever registering, so onSnapshotCalls contains exactly
// the ONE confirmations listener this plan adds.
const mockService: Service = {
  id: 'service-1',
  date: '2026-03-08',
  name: '',
  progression: '1-2-2-3',
  teams: ['Choir'],
  status: 'draft',
  slots: [],
  sermonPassage: null,
  notes: '',
  roleAssignmentOverrides: { 'role-vox': ['person-1', 'person-2'] },
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

let mockServicesList: Service[] = [mockService]
let mockServiceStoreOrgId: string | null = 'org-1'

const mockUpdateService = vi.fn((_id: string, _data: unknown) => Promise.resolve())

class ServiceLockedErrorStub extends Error {
  readonly serviceId: string
  readonly storedStatus: string
  constructor(serviceId: string, storedStatus: string, action = 'update') {
    super(`refusing to ${action} service ${serviceId} — its stored status is "${storedStatus}", not "draft".`)
    this.name = 'ServiceLockedError'
    this.serviceId = serviceId
    this.storedStatus = storedStatus
  }
}

vi.mock('@/stores/services', () => ({
  ServiceLockedError: ServiceLockedErrorStub,
  buildServiceSnapshot: vi.fn((svc: Service) => ({ name: svc.name, status: svc.status, slots: svc.slots })),
  useServiceStore: () => ({
    services: mockServicesList,
    isLoading: false,
    orgId: mockServiceStoreOrgId,
    subscribe: vi.fn(),
    updateService: mockUpdateService,
    markAsPlanned: vi.fn(() => Promise.resolve()),
    reopenService: vi.fn(() => Promise.resolve()),
    assignSongToSlot: vi.fn(() => Promise.resolve()),
    deleteService: vi.fn(() => Promise.resolve()),
    clearSongFromSlot: vi.fn(() => Promise.resolve()),
    setRoleOverride: vi.fn(() => Promise.resolve()),
    clearRoleOverride: vi.fn(() => Promise.resolve()),
    setServiceMessagingDefaults: vi.fn(() => Promise.resolve()),
    createShareToken: vi.fn(() => Promise.resolve('mock-share-token')),
    isOwnWriteEcho: () => false,
  }),
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    songs: [],
    aiCandidateSongs: [],
    orgId: null,
    subscribe: vi.fn(),
    updateSong: vi.fn(() => Promise.resolve()),
  }),
}))

vi.mock('@/utils/claudeApi', () => ({
  getSongSuggestions: vi.fn(() => Promise.resolve(null)),
  getScriptureSuggestions: vi.fn(() => Promise.resolve(null)),
  splitCongregationalReading: vi.fn(() => Promise.resolve(null)),
}))

const mockAuthState = reactive<{
  user: { uid: string }
  isEditor: boolean
  orgId: string | null
  hasPcCredentials: boolean
  pcCredentials: { appId: string; secret: string } | null
  settings: {
    aiEnabled: boolean
    pcEnabled: boolean
    vwModeEnabled: boolean
    bibleVersion: 'ESV' | 'NLT'
    messaging: { enabled: boolean; lockNotifyDefault: boolean; reminderEnabled: boolean; reminderDaysBefore: number }
  }
  isAiEnabled: boolean
}>({
  user: { uid: 'user-1' },
  isEditor: true,
  orgId: 'org-1',
  hasPcCredentials: false,
  pcCredentials: null,
  settings: {
    aiEnabled: true,
    pcEnabled: true,
    vwModeEnabled: true,
    bibleVersion: 'NLT',
    messaging: { enabled: false, lockNotifyDefault: false, reminderEnabled: false, reminderDaysBefore: 3 },
  },
  isAiEnabled: true,
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

vi.mock('@/utils/planningCenterApi', () => ({
  fetchServiceTypes: vi.fn(async () => []),
  fetchTemplates: vi.fn(async () => []),
  fetchServiceTypeTeams: vi.fn(async () => []),
  fetchPlans: vi.fn(async () => []),
  fetchPlanItems: vi.fn(async () => []),
  createPlan: vi.fn(async () => 'pc-plan-new'),
  fetchTemplateItems: vi.fn(async () => []),
  addSlotAsItem: vi.fn(async () => undefined),
  buildPlanTitle: vi.fn(() => 'Sunday Service'),
  createItem: vi.fn(async () => undefined),
  updateItem: vi.fn(async () => undefined),
  deleteItem: vi.fn(async () => undefined),
  createPlanTime: vi.fn(async () => undefined),
  fetchPlanNeededPositionTeamIds: vi.fn(async () => new Set<string>()),
  fetchTeamPositions: vi.fn(async () => []),
  addNeededPosition: vi.fn(async () => undefined),
}))

const mockRoles: Role[] = [{ id: 'role-vox', name: 'Vocals', group: 'band', defaultCount: 1, order: 0 }]

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
    roles: ['role-vox'],
    pcPersonId: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
]

const mockQuarters: Quarter[] = []

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockRosterPeople,
    roles: mockRoles,
    activePeople: mockRosterPeople.filter((p) => p.active),
    orgId: null,
    subscribe: vi.fn(),
  }),
}))

vi.mock('@/stores/quarters', () => ({
  useQuartersStore: () => ({
    quarters: mockQuarters,
    orgId: null,
    subscribe: vi.fn(),
  }),
}))

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => ({
    teams: [],
    orgId: null,
    subscribe: vi.fn(),
    seedDefaultTeamsIfEmpty: vi.fn(),
  }),
}))

vi.mock('@/stores/serviceMessages', () => ({
  useServiceMessagesStore: () => ({
    messages: [],
    isLoading: false,
    subscribeServiceMessages: vi.fn(),
    unsubscribeServiceMessages: vi.fn(),
    fetchBouncedRecipients: vi.fn(() => Promise.resolve([])),
  }),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  mockRoute.params.id = 'service-1'
  mockServiceStoreOrgId = 'org-1'
  mockAuthState.isEditor = true
  mockAuthState.orgId = 'org-1'
  mockUpdateService.mockClear()
  onSnapshotCalls.length = 0
})

beforeAll(async () => {
  setActivePinia(createPinia())
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

async function mountView() {
  mockServicesList = [mockService]
  const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
  const wrapper = shallowMount(ServiceEditorView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        ContextualActionBar: false,
        RouterLink: { template: '<a><slot /></a>' },
        SaveStatusIndicator: false,
        ServicePrintLayout: true,
        SongBadge: true,
        SongSlotPicker: true,
        ScriptureInput: true,
        PresentationViewer: true,
      },
    },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

async function goToRolesTab(wrapper: Awaited<ReturnType<typeof mountView>>) {
  const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
  await rolesTabBtn!.trigger('click')
  await wrapper.vm.$nextTick()
}

function findConfirmationsListener() {
  const call = onSnapshotCalls.find((c) => c.path.includes('confirmations'))
  if (!call) throw new Error('confirmations onSnapshot listener was never registered')
  return call
}

describe('ServiceEditorView - Roles tab live confirmation status chips (Phase 133-03, R411)', () => {
  it('registers a live onSnapshot listener on the confirmations subcollection (not a one-time fetch)', async () => {
    const wrapper = await mountView()
    await goToRolesTab(wrapper)

    const call = findConfirmationsListener()
    expect(call.path).toBe('organizations/org-1/services/service-1/confirmations')
    expect(mockGetDoc).not.toHaveBeenCalled()
  })

  it('defaults every assignment to Unconfirmed before any confirmation doc exists', async () => {
    const wrapper = await mountView()
    await goToRolesTab(wrapper)

    expect(wrapper.get('[data-testid="role-confirm-chip-role-vox-person-1"]').text()).toBe('Unconfirmed')
    expect(wrapper.get('[data-testid="role-confirm-chip-role-vox-person-2"]').text()).toBe('Unconfirmed')
  })

  it('a live snapshot emission flips one person to Confirmed while an unconfirmed peer is untouched — no reload', async () => {
    const wrapper = await mountView()
    await goToRolesTab(wrapper)

    const { onNext } = findConfirmationsListener()
    onNext({
      docs: [{ data: () => ({ roleId: 'role-vox', emailLower: 'alice@example.com', status: 'confirmed' }) }],
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="role-confirm-chip-role-vox-person-1"]').text()).toBe('Confirmed')
    expect(wrapper.get('[data-testid="role-confirm-chip-role-vox-person-2"]').text()).toBe('Unconfirmed')
  })

  it('a subsequent snapshot emission flips the chip again to Needs reconfirmation (relock reconciliation) — live, in place', async () => {
    const wrapper = await mountView()
    await goToRolesTab(wrapper)

    const { onNext } = findConfirmationsListener()
    onNext({
      docs: [{ data: () => ({ roleId: 'role-vox', emailLower: 'alice@example.com', status: 'confirmed' }) }],
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="role-confirm-chip-role-vox-person-1"]').text()).toBe('Confirmed')

    onNext({
      docs: [{ data: () => ({ roleId: 'role-vox', emailLower: 'alice@example.com', status: 'needsReconfirmation' }) }],
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="role-confirm-chip-role-vox-person-1"]').text()).toBe('Needs reconfirmation')
    expect(wrapper.get('[data-testid="role-confirm-chip-role-vox-person-2"]').text()).toBe('Unconfirmed')
  })
})
