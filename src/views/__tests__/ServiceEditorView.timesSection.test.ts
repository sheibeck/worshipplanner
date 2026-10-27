import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { shallowMount, enableAutoUnmount } from '@vue/test-utils'
import ServiceTimesPanel from '@/components/ServiceTimesPanel.vue'
import { reactive, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Service } from '@/types/service'
import type { Timestamp } from 'firebase/firestore'

// Phase 143 (R441-R444): the Times tab wiring. Mock scaffold mirrors
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
    rehearsalTimeDefaults?: string[]
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
  delete mockAuthState.settings.rehearsalTimeDefaults
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

async function mountView(overrides: Partial<Service> = {}, extraStubs: Record<string, unknown> = {}) {
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
        ...extraStubs,
      },
    },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

type TimesVm = {
  localService: {
    notes: string
    reportTime?: string
    rehearsals?: Array<{ id: string; date: string; time: string }>
  }
  onAddRehearsal: (payload: { date: string; time: string }) => void
  onRemoveRehearsal: (id: string) => void
  onRehearsalDateChange: (id: string, date: string) => void
  onRehearsalTimeChange: (id: string, time: string) => void
  onReportTimeChange: (time: string) => void
}

type Wrapper = Awaited<ReturnType<typeof mountView>>

const R1 = { id: 'r1', date: '2026-03-05', time: '19:00' }
const U1 = { id: 'u1', date: '', time: '19:00' }
const T1 = { id: 't1', date: '2026-03-04', time: '' }

const wait900 = () => new Promise((resolve) => setTimeout(resolve, 900))
const panelOf = (w: Wrapper) => w.findComponent(ServiceTimesPanel)
const vmOf = (w: Wrapper) => w.vm as unknown as TimesVm

describe('ServiceEditorView - Times tab (Phase 143, R441-R444)', () => {
  it('R444 header removed: no time-related block sits above the tab strip for any role/status', async () => {
    const editor = await mountView({ status: 'draft', rehearsals: [R1] })
    expect(editor.find('[data-testid="service-times-section"]').exists()).toBe(false)
    editor.unmount()

    mockAuthState.isEditor = false
    const viewer = await mountView({ status: 'draft', rehearsals: [R1] })
    expect(viewer.find('[data-testid="service-times-section"]').exists()).toBe(false)
    viewer.unmount()

    mockAuthState.isEditor = true
    const planned = await mountView({ status: 'planned', rehearsals: [R1] })
    expect(planned.find('[data-testid="service-times-section"]').exists()).toBe(false)
  })

  it('R444 controls live in the panel: every report-time / rehearsal control is inside #svc-panel-times', async () => {
    const wrapper = await mountView(
      { status: 'draft', rehearsals: [R1], reportTime: '08:00' },
      { ServiceTimesPanel: false },
    )
    const matches = wrapper.findAll(
      '[data-testid="report-time-input"], [data-testid="rehearsal-date-input"], [data-testid="rehearsal-time-input"], [data-testid="add-rehearsal-form"]',
    )
    expect(matches.length).toBeGreaterThan(0)
    for (const m of matches) {
      expect(m.element.closest('#svc-panel-times')).not.toBeNull()
    }
  })

  it.each([
    ['editor', true],
    ['viewer', false],
  ])('R444 tab wiring: #svc-tab-times and #svc-panel-times are wired for the %s', async (_label, isEditor) => {
    mockAuthState.isEditor = isEditor
    const wrapper = await mountView({ status: 'draft', rehearsals: [R1] })
    const tab = wrapper.get('#svc-tab-times')
    expect(tab.attributes('role')).toBe('tab')
    expect(tab.attributes('aria-controls')).toBe('svc-panel-times')
    expect(tab.attributes('aria-selected')).toBe('false')

    const panel = wrapper.get('#svc-panel-times')
    expect(panel.attributes('role')).toBe('tabpanel')
    expect(panel.attributes('aria-labelledby')).toBe('svc-tab-times')
    expect(panel.attributes('data-testid')).toBe('times-panel')
    expect((panel.element as HTMLElement).style.display).toBe('none')

    await tab.trigger('click')
    expect(wrapper.get('#svc-tab-times').attributes('aria-selected')).toBe('true')
    expect((wrapper.get('#svc-panel-times').element as HTMLElement).style.display).not.toBe('none')
  })

  it('R444 gating: canEdit is true only for an editor on a draft service', async () => {
    const draftEditor = await mountView({ status: 'draft', rehearsals: [R1] })
    expect(panelOf(draftEditor).props('canEdit')).toBe(true)
    draftEditor.unmount()

    mockAuthState.isEditor = false
    const viewer = await mountView({ status: 'draft', rehearsals: [R1] })
    expect(panelOf(viewer).props('canEdit')).toBe(false)
    viewer.unmount()

    mockAuthState.isEditor = true
    const planned = await mountView({ status: 'planned', rehearsals: [R1] })
    expect(panelOf(planned).props('canEdit')).toBe(false)
  })

  it('R442 props forwarding: rehearsals / reportTime / serviceDate / defaultTimes reach the panel', async () => {
    mockAuthState.settings.rehearsalTimeDefaults = ['18:30', '19:00']
    const wrapper = await mountView({ status: 'draft', rehearsals: [R1], reportTime: '08:00' })
    const panel = panelOf(wrapper)
    expect(panel.props('rehearsals')).toEqual([R1])
    expect(panel.props('reportTime')).toBe('08:00')
    expect(panel.props('serviceDate')).toBe('2026-03-08')
    expect(panel.props('defaultTimes')).toEqual(['18:30', '19:00'])
    wrapper.unmount()

    delete mockAuthState.settings.rehearsalTimeDefaults
    const bare = await mountView({ status: 'draft', rehearsals: undefined, reportTime: undefined })
    expect(panelOf(bare).props('defaultTimes')).toEqual([])
    expect(panelOf(bare).props('rehearsals')).toEqual([])
  })

  describe('R443 attention dot', () => {
    const dotOf = (w: Wrapper) => w.find('[data-testid="times-tab-attention-dot"]')

    it.each([
      ['an undated row', [U1]],
      ['an untimed row', [T1]],
    ])('shows for an editor with %s', async (_label, rows) => {
      const wrapper = await mountView({ status: 'draft', rehearsals: rows })
      expect(dotOf(wrapper).exists()).toBe(true)
      expect(wrapper.get('#svc-tab-times').text()).toContain('(needs attention)')
    })

    it('shows for an editor on a planned (locked) service with an undated row', async () => {
      const wrapper = await mountView({ status: 'planned', rehearsals: [U1] })
      expect(dotOf(wrapper).exists()).toBe(true)
    })

    it('never shows for a viewer', async () => {
      mockAuthState.isEditor = false
      const wrapper = await mountView({ status: 'draft', rehearsals: [U1] })
      expect(dotOf(wrapper).exists()).toBe(false)
    })

    it.each([
      ['all rows displayable', [R1]],
      ['rehearsals undefined', undefined],
      ['rehearsals empty', []],
    ])('is absent for an editor when %s', async (_label, rows) => {
      const wrapper = await mountView({ status: 'draft', rehearsals: rows })
      expect(dotOf(wrapper).exists()).toBe(false)
      expect(wrapper.get('#svc-tab-times').text()).toBe('Times')
    })

    it('disappears once the planner dates the legacy row', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [{ ...U1 }] })
      expect(dotOf(wrapper).exists()).toBe(true)
      panelOf(wrapper).vm.$emit('date-change', { id: 'u1', date: '2026-03-05' })
      await wrapper.vm.$nextTick()
      expect(dotOf(wrapper).exists()).toBe(false)
    })
  })

  describe('R441 add handler', () => {
    it('adds exactly one dated+timed row with a non-empty string id per add event', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [] })
      panelOf(wrapper).vm.$emit('add', { date: '2026-03-05', time: '19:00' })
      await wrapper.vm.$nextTick()
      const rows = vmOf(wrapper).localService.rehearsals ?? []
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ date: '2026-03-05', time: '19:00' })
      expect(typeof rows[0].id).toBe('string')
      expect(rows[0].id.length).toBeGreaterThan(0)
    })

    it.each([
      ['empty date', { date: '', time: '19:00' }],
      ['empty time', { date: '2026-03-05', time: '' }],
      ['malformed date', { date: 'not-a-date', time: '19:00' }],
      ['malformed time', { date: '2026-03-05', time: '7pm' }],
    ])('ignores a payload with %s', async (_label, payload) => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [] })
      panelOf(wrapper).vm.$emit('add', payload)
      await wrapper.vm.$nextTick()
      expect(vmOf(wrapper).localService.rehearsals ?? []).toHaveLength(0)
    })
  })

  describe('R441 reject-clear and malformed edits in handlers', () => {
    const rowOf = (w: Wrapper, id: string) => (vmOf(w).localService.rehearsals ?? []).find((r) => r.id === id)

    it('a clear of a non-empty date or time is a no-op', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [{ ...R1 }] })
      panelOf(wrapper).vm.$emit('date-change', { id: 'r1', date: '' })
      panelOf(wrapper).vm.$emit('time-change', { id: 'r1', time: '' })
      await wrapper.vm.$nextTick()
      expect(rowOf(wrapper, 'r1')).toMatchObject({ date: '2026-03-05', time: '19:00' })
    })

    it('a valid date on a legacy undated row and a valid time on an untimed row are applied', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [{ ...U1 }, { ...T1 }] })
      panelOf(wrapper).vm.$emit('date-change', { id: 'u1', date: '2026-03-03' })
      panelOf(wrapper).vm.$emit('time-change', { id: 't1', time: '18:00' })
      await wrapper.vm.$nextTick()
      expect(rowOf(wrapper, 'u1')?.date).toBe('2026-03-03')
      expect(rowOf(wrapper, 't1')?.time).toBe('18:00')
    })

    it('remove deletes the row', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [{ ...R1 }] })
      panelOf(wrapper).vm.$emit('remove', 'r1')
      await wrapper.vm.$nextTick()
      expect(rowOf(wrapper, 'r1')).toBeUndefined()
    })

    it('report time can be set and cleared', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [] })
      panelOf(wrapper).vm.$emit('report-time-change', '09:00')
      await wrapper.vm.$nextTick()
      expect(vmOf(wrapper).localService.reportTime).toBe('09:00')
      panelOf(wrapper).vm.$emit('report-time-change', '')
      await wrapper.vm.$nextTick()
      expect(vmOf(wrapper).localService.reportTime ?? '').toBe('')
    })

    it('malformed non-empty edits are a no-op, never stored', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [{ ...R1 }, { ...U1 }] })
      panelOf(wrapper).vm.$emit('date-change', { id: 'r1', date: 'not-a-date' })
      panelOf(wrapper).vm.$emit('time-change', { id: 'r1', time: '7pm' })
      panelOf(wrapper).vm.$emit('date-change', { id: 'u1', date: 'not-a-date' })
      await wrapper.vm.$nextTick()
      expect(rowOf(wrapper, 'r1')).toMatchObject({ date: '2026-03-05', time: '19:00' })
      expect(rowOf(wrapper, 'u1')?.date).toBe('')
    })
  })

  describe('R036 gates (handlers self-gate on canEditService)', () => {
    const attempt = async (wrapper: Wrapper) => {
      const vm = vmOf(wrapper)
      const before = JSON.stringify(vm.localService)
      vm.onAddRehearsal({ date: '2026-03-05', time: '19:00' })
      vm.onRemoveRehearsal('r1')
      vm.onRehearsalDateChange('r1', '2026-03-09')
      vm.onRehearsalTimeChange('r1', '20:00')
      vm.onReportTimeChange('09:00')
      await wrapper.vm.$nextTick()
      expect(JSON.stringify(vm.localService)).toBe(before)
    }

    it('a viewer cannot mutate rehearsals or report time via a stale handler reference', async () => {
      mockAuthState.isEditor = false
      await attempt(await mountView({ status: 'draft', rehearsals: [{ ...R1 }], reportTime: '08:00' }))
    })

    it('an editor on a planned (locked) service cannot mutate either', async () => {
      await attempt(await mountView({ status: 'planned', rehearsals: [{ ...R1 }], reportTime: '08:00' }))
    })
  })

  describe('autosave', () => {
    it('R443 no write on load: legacy rows are neither rewritten nor autosaved', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [{ ...U1 }, { ...T1 }] })
      await wait900()
      expect(mockUpdateService).not.toHaveBeenCalled()
      expect(vmOf(wrapper).localService.rehearsals).toEqual([U1, T1])
    })

    it('R441 autosave: an add persists through updateService(id, { rehearsals, ... })', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [] })
      // The autosave watcher swallows its first localService trigger; touch notes once.
      vmOf(wrapper).localService.notes = 'warm-up touch'
      await wrapper.vm.$nextTick()
      panelOf(wrapper).vm.$emit('add', { date: '2026-03-05', time: '19:00' })
      await wrapper.vm.$nextTick()
      await wait900()
      expect(mockUpdateService).toHaveBeenCalled()
      const [id, data] = mockUpdateService.mock.calls[0] as [string, { rehearsals: Array<{ date: string; time: string }> }]
      expect(id).toBe('service-1')
      expect(data.rehearsals).toEqual([expect.objectContaining({ date: '2026-03-05', time: '19:00' })])
    })

    it('R444 tab switch mid-debounce neither cancels nor duplicates the pending save', async () => {
      const wrapper = await mountView({ status: 'draft', rehearsals: [] })
      await wrapper.get('#svc-tab-times').trigger('click')
      vmOf(wrapper).localService.notes = 'warm-up touch'
      await wrapper.vm.$nextTick()
      panelOf(wrapper).vm.$emit('add', { date: '2026-03-05', time: '19:00' })
      await wrapper.vm.$nextTick()
      await wrapper.get('#svc-tab-service-order').trigger('click')
      await wait900()
      expect(mockUpdateService).toHaveBeenCalledTimes(1)
      const [, data] = mockUpdateService.mock.calls[0] as [string, { rehearsals: Array<{ date: string }> }]
      expect(data.rehearsals).toEqual([expect.objectContaining({ date: '2026-03-05' })])
    })
  })

  it('R444 v-show persistence: an in-progress add form survives switching tabs away and back', async () => {
    const wrapper = await mountView({ status: 'draft', rehearsals: [] }, { ServiceTimesPanel: false })
    await wrapper.get('#svc-tab-times').trigger('click')
    const input = wrapper.get('[data-testid="new-rehearsal-date"]')
    await input.setValue('2026-03-05')
    await wrapper.get('#svc-tab-service-order').trigger('click')
    await wrapper.get('#svc-tab-times').trigger('click')
    expect((wrapper.get('[data-testid="new-rehearsal-date"]').element as HTMLInputElement).value).toBe('2026-03-05')
  })
})
