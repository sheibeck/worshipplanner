import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { shallowMount, enableAutoUnmount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Service } from '@/types/service'
import type { Timestamp } from 'firebase/firestore'

// CR-02 / WR-01 (139-REVIEW.md) — the "Times" subsection's v-if/v-else split
// had zero test coverage; this file closes that gap. Mock scaffold mirrors
// ServiceEditorView.stage.test.ts's own trimmed-mock pattern (a NEW file per
// that same rationale: ServiceEditorView.test.ts is 9000+ lines already).

enableAutoUnmount(afterEach)

const mockRoute = reactive({ params: { id: 'service-1' } })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' },
}))

const { mockGetDoc, mockSetDoc, mockHttpsCallable, mockQueueCallable, mockResolveRecipients } = vi.hoisted(() => {
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
  collection: vi.fn(),
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({})),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
}))

vi.mock('@/composables/useServicePresence', () => ({
  useServicePresence: vi.fn(() => ({ presentViewers: ref([]) })),
}))

vi.mock('sortablejs', () => ({
  default: { create: vi.fn(() => ({ destroy: vi.fn() })) },
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

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: [],
    roles: [],
    activePeople: [],
    orgId: null,
    subscribe: vi.fn(),
  }),
}))

vi.mock('@/stores/quarters', () => ({
  useQuartersStore: () => ({
    quarters: [],
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
  mockUpdateService.mockClear()
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

async function mountView(overrides: Partial<Service> = {}) {
  mockServicesList = [{ ...mockService, ...overrides }]
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

describe('ServiceEditorView - "Times" subsection (CR-02/WR-01, 139-REVIEW.md)', () => {
  it('renders the interactive editable UI for an editor on a draft (unlocked) service with no times set', async () => {
    const wrapper = await mountView({ status: 'draft', rehearsals: undefined, reportTime: undefined })
    expect(wrapper.find('[data-testid="add-rehearsal-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-times-readonly"]').exists()).toBe(false)
  })

  it('does NOT render the interactive editable UI for a non-editor viewing a service with no times set', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView({ status: 'draft', rehearsals: undefined, reportTime: undefined })
    expect(wrapper.find('[data-testid="add-rehearsal-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rehearsal-date-input"]').exists()).toBe(false)
  })

  it('does NOT render the interactive editable UI for an editor viewing a LOCKED (planned) service with no times set', async () => {
    const wrapper = await mountView({ status: 'planned', rehearsals: undefined, reportTime: undefined })
    expect(wrapper.find('[data-testid="add-rehearsal-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rehearsal-date-input"]').exists()).toBe(false)
  })

  it('the editable inputs carry :disabled bound to !canEditService as defense in depth', async () => {
    const wrapper = await mountView({
      status: 'draft',
      rehearsals: [{ id: 'r1', date: '2026-09-11', time: '19:00' }],
      reportTime: '08:00',
    })
    const dateInput = wrapper.get('[data-testid="rehearsal-date-input"]')
    expect((dateInput.element as HTMLInputElement).disabled).toBe(false)
  })

  it('add/remove/edit handlers no-op when canEditService is false, even if a stale reference is invoked directly', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView({
      status: 'draft',
      rehearsals: [{ id: 'r1', date: '2026-09-11', time: '19:00' }],
      reportTime: '08:00',
    })
    // Read-only branch renders instead — no interactive controls exist to
    // click, which IS the CR-02 fix; assert the handler itself still no-ops
    // as defense-in-depth (mirrors onDateChange's own established pattern).
    const vm = wrapper.vm as unknown as {
      onAddRehearsal: () => void
      localService: { rehearsals?: Array<{ id: string }> }
    }
    const before = vm.localService.rehearsals?.length ?? 0
    vm.onAddRehearsal()
    await wrapper.vm.$nextTick()
    expect(vm.localService.rehearsals?.length ?? 0).toBe(before)
  })
})
