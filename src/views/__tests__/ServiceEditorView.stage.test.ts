import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { shallowMount, enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Options as SortableOptions } from 'sortablejs'
import type { Service, StageMarker } from '@/types/service'
import type { Timestamp } from 'firebase/firestore'
import StageLayoutEditor from '@/components/stage/StageLayoutEditor.vue'

// Mirrors the mount/mock harness in ServiceEditorView.test.ts (a NEW file per
// the plan — that file already has 9000+ lines and a big enough mock surface
// that duplicating the relevant subset here is more maintainable than adding
// a 51st describe block to it). Only what Task 2's Stage Layout wiring needs
// is asserted here — every other tab's behavior is covered by the existing file.

enableAutoUnmount(afterEach)

// ── Mocks (same shape as ServiceEditorView.test.ts) ─────────────────────────

const mockRoute = reactive({ params: { id: 'service-1' } })
const { mockRouterPush } = vi.hoisted(() => ({ mockRouterPush: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: mockRouterPush }),
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

const mockService: Service = {
  id: 'service-1',
  date: '2026-03-08',
  name: '',
  progression: '1-2-2-3',
  teams: ['Choir'],
  status: 'draft',
  slots: [
    { kind: 'SONG', id: 'slot-0', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
  ],
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
  mockAuthState.orgId = 'org-1'
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

async function goToStageTab(wrapper: Awaited<ReturnType<typeof mountView>>) {
  await wrapper.get('#svc-tab-stage').trigger('click')
  await wrapper.vm.$nextTick()
}

describe('ServiceEditorView - Stage Layout tab (Phase 107, R313/R314)', () => {
  it('renders the "Stage Layout" tab after Roles and before Messages for an editor', async () => {
    mockAuthState.settings.messaging.enabled = true
    const wrapper = await mountView()

    const tabIds = wrapper.findAll('button[role="tab"]').map((b) => b.attributes('id'))
    expect(tabIds).toEqual([
      'svc-tab-service-order',
      'svc-tab-slides',
      'svc-tab-roles',
      'svc-tab-stage',
      'svc-tab-messages',
    ])
    expect(wrapper.get('#svc-tab-stage').text()).toBe('Stage Layout')
  })

  it('is absent for a viewer (non-editor)', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()
    expect(wrapper.find('#svc-tab-stage').exists()).toBe(false)
  })

  it('the panel mounts StageLayoutEditor with the correct aria wiring and elements/editable props', async () => {
    const wrapper = await mountView()
    await goToStageTab(wrapper)

    const tab = wrapper.get('#svc-tab-stage')
    expect(tab.attributes('aria-selected')).toBe('true')
    expect(tab.attributes('aria-controls')).toBe('svc-panel-stage')

    const panel = wrapper.get('#svc-panel-stage')
    expect(panel.attributes('role')).toBe('tabpanel')
    expect(panel.attributes('aria-labelledby')).toBe('svc-tab-stage')

    const editor = wrapper.findComponent(StageLayoutEditor)
    expect(editor.exists()).toBe(true)
    expect(editor.props('elements')).toEqual([])
    expect(editor.props('editable')).toBe(true)
  })

  it('a locked service (left Draft) renders the editor with editable=false', async () => {
    const wrapper = await mountView({ status: 'planned' })
    await goToStageTab(wrapper)

    const editor = wrapper.findComponent(StageLayoutEditor)
    expect(editor.exists()).toBe(true)
    expect(editor.props('editable')).toBe(false)
  })

  it('an add event initializes stageLayout, mutates localService, and persists through the existing autosave path', async () => {
    const wrapper = await mountView()
    await goToStageTab(wrapper)

    const marker: StageMarker = { id: 'm1', label: 'Lead Vocal', kind: 'mic', zone: 'onstage', xPct: 50, yPct: 50 }
    await wrapper.findComponent(StageLayoutEditor).vm.$emit('add', marker)
    await wrapper.vm.$nextTick()

    // Mutated onto localService and passed back down as a prop (no separate
    // add-marker state anywhere else) — the "persists onto localService" half.
    expect(wrapper.findComponent(StageLayoutEditor).props('elements')).toEqual([marker])

    // The "triggers the autosave path" half — the SAME useAutoSave(localService)
    // deep-watch every other tab's mutation rides, debounced ~800ms, no second
    // save call introduced by this feature.
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const [, payload] = mockUpdateService.mock.calls[0]!
    expect((payload as { stageLayout: { elements: StageMarker[] } }).stageLayout).toEqual({ elements: [marker] })
  })

  it('update/move events replace the targeted marker in place', async () => {
    const marker: StageMarker = { id: 'm1', label: 'Lead Vocal', kind: 'mic', zone: 'onstage', xPct: 50, yPct: 50 }
    const wrapper = await mountView({ stageLayout: { elements: [marker] } })
    await goToStageTab(wrapper)

    const editor = wrapper.findComponent(StageLayoutEditor)
    expect(editor.props('elements')).toEqual([marker])

    const updated: StageMarker = { ...marker, label: 'Lead Vocalist', kind: 'other' }
    await editor.vm.$emit('update', updated)
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(StageLayoutEditor).props('elements')).toEqual([updated])

    await wrapper.findComponent(StageLayoutEditor).vm.$emit('move', { id: 'm1', zone: 'offstage', xPct: 10, yPct: 20 })
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(StageLayoutEditor).props('elements')).toEqual([
      { ...updated, zone: 'offstage', xPct: 10, yPct: 20 },
    ])
  })

  it('removing the LAST marker clears stageLayout back to undefined (elements prop reads [] again) and persists the clear through autosave', async () => {
    const marker: StageMarker = { id: 'm1', label: 'Drums', kind: 'instrument', zone: 'onstage', xPct: 30, yPct: 40 }
    const wrapper = await mountView({ stageLayout: { elements: [marker] } })
    await goToStageTab(wrapper)

    expect(wrapper.findComponent(StageLayoutEditor).props('elements')).toEqual([marker])

    await wrapper.findComponent(StageLayoutEditor).vm.$emit('remove', 'm1')
    await wrapper.vm.$nextTick()
    // `localService.stageLayout` is now undefined; the panel's `?? []` fallback
    // means the editor's prop reads back as an empty array either way.
    expect(wrapper.findComponent(StageLayoutEditor).props('elements')).toEqual([])

    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const [, payload] = mockUpdateService.mock.calls[0]!
    // stageLayout is a TOP-LEVEL field (unlike slot.loop/slot.notes, which ride
    // inside the wholesale-replaced `slots` array) — an omitted/undefined key
    // would leave the REMOTE field untouched, so ServiceEditorView's onSave
    // sends an explicit `null` to actually clear it.
    expect((payload as { stageLayout: unknown }).stageLayout).toBeNull()
  })

  it('removing one marker out of several keeps stageLayout populated with the remainder', async () => {
    const m1: StageMarker = { id: 'm1', label: 'Drums', zone: 'onstage', xPct: 30, yPct: 40 }
    const m2: StageMarker = { id: 'm2', label: 'Piano', zone: 'offstage', xPct: 60, yPct: 20 }
    const wrapper = await mountView({ stageLayout: { elements: [m1, m2] } })
    await goToStageTab(wrapper)

    await wrapper.findComponent(StageLayoutEditor).vm.$emit('remove', 'm1')
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(StageLayoutEditor).props('elements')).toEqual([m2])
  })

  it('add/update/remove/move handlers no-op when the service is locked (viewer-immune to a stray emit)', async () => {
    const marker: StageMarker = { id: 'm1', label: 'Drums', zone: 'onstage', xPct: 30, yPct: 40 }
    const wrapper = await mountView({ status: 'planned', stageLayout: { elements: [marker] } })
    await goToStageTab(wrapper)

    const editor = wrapper.findComponent(StageLayoutEditor)
    expect(editor.props('editable')).toBe(false)

    // Even if something emitted anyway, the handler's own canEditService guard
    // refuses it — mirrors onToggleLoop/onSectionChange's own guard pattern.
    await editor.vm.$emit('add', { id: 'm2', label: 'Piano', zone: 'onstage', xPct: 10, yPct: 10 })
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(StageLayoutEditor).props('elements')).toEqual([marker])

    await editor.vm.$emit('remove', 'm1')
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(StageLayoutEditor).props('elements')).toEqual([marker])
  })

  it('Arrow/Home/End roving-tabindex navigation includes the Stage Layout tab for an editor', async () => {
    mockAuthState.settings.messaging.enabled = true
    const wrapper = await mountView()
    await flushPromises()

    const tablist = wrapper.get('[role="tablist"]')
    await tablist.trigger('keydown', { key: 'ArrowLeft' })
    // Last visible tab for an editor with messaging on is Messages, so
    // ArrowLeft from the default Service Order tab wraps straight to it —
    // proving Stage Layout is correctly threaded into the SAME order used
    // elsewhere, not a dead end that breaks wrap-around.
    expect(wrapper.get('#svc-tab-messages').attributes('aria-selected')).toBe('true')

    await tablist.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.get('#svc-tab-stage').attributes('aria-selected')).toBe('true')
  })
})
