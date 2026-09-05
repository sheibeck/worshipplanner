/**
 * Phase 52, Plan 03 (R113) — ServicesView is the new host for the default
 * service template editor, relocated off the main Settings page. This file
 * covers ONLY the relocated cog trigger + mount contract:
 *   (1) an editor sees the cog (data-testid="open-template-editor"),
 *   (2) clicking it opens the teleported service-template-editor slide-out,
 *       and the editor's own close control closes it, and
 *   (3) a viewer (non-editor) never sees the cog.
 *
 * The editor's own internal open/close/reset/save behavior is already covered
 * by ServiceTemplateEditor.test.ts — it is NOT re-tested here.
 *
 * ServiceTemplateEditor.vue lives inside a `<Teleport to="body">` (structural
 * port of EditSlideDrawer.vue), so once opened its markup is NOT inside the
 * mounted `wrapper`'s vnode tree — read it through a DOMWrapper over
 * `document.body`, mirroring SettingsView.test.ts's own `body()` helper.
 * `enableAutoUnmount` keeps one test's teleported panel from leaking into the
 * next test's document.body.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { Options as SortableOptions } from 'sortablejs'
import ServicesView from '../ServicesView.vue'
import type { ServiceTemplateEntry } from '@/types/organization'

enableAutoUnmount(afterEach)

function body(): DOMWrapper<HTMLElement> {
  return new DOMWrapper(document.body)
}

// ── firebase mocks (ServiceTemplateEditor.onSave reaches updateDoc) ──────────
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  updateDoc: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/firebase', () => ({
  db: {},
}))

// ── sortablejs capture harness — the editor calls Sortable.create() on its
//    per-section lists once open; jsdom never fires a real drag, so a
//    no-op capturing mock keeps the mount clean (ServiceTemplateEditor.test.ts). ──
vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((_el: HTMLElement, _options: SortableOptions) => ({ destroy: vi.fn() })),
  },
}))

// ── vue-router: ServicesView calls useRouter() ───────────────────────────────
const mockPush = vi.fn(() => Promise.resolve())
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// ── @/stores/auth — reactive mock. ServicesView reads isEditor/orgId; the
//    mounted ServiceTemplateEditor also calls useAuthStore() and reads
//    settings.defaultServiceTemplate + isEditor. ──
const mockAuthState = reactive<{
  orgId: string | null
  isEditor: boolean
  settings: { defaultServiceTemplate: ServiceTemplateEntry[] }
}>({
  orgId: 'org-1',
  isEditor: true,
  settings: { defaultServiceTemplate: [] },
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

// ── @/stores/services — ServicesView subscribes/reads the service list ───────
const mockServiceState = reactive<{
  isLoading: boolean
  services: unknown[]
}>({
  isLoading: false,
  services: [],
})
const mockSubscribe = vi.fn()
const mockUnsubscribeAll = vi.fn()
const mockCreateService = vi.fn(() => Promise.resolve('new-service-id'))

vi.mock('@/stores/services', () => ({
  useServiceStore: () => ({
    get isLoading() {
      return mockServiceState.isLoading
    },
    get services() {
      return mockServiceState.services
    },
    subscribe: mockSubscribe,
    unsubscribeAll: mockUnsubscribeAll,
    createService: mockCreateService,
  }),
}))

// Phase 79 (R229/R241): ServicesView mounts NewServiceDialog unconditionally
// (not behind a v-if), and both it and ServicesView itself now read the
// shared teams store — without this mock, `useTeamsStore()` throws "no
// active Pinia" the instant the view sets up (no test in this file installs
// a Pinia instance; every store is vi.mock-ed, same convention as
// @/stores/services above). Seeded with the default 4 team names so any
// future test asserting on NewServiceDialog's checkbox row inside this view
// keeps finding them.
const mockTeamsState = reactive<{ teams: { id: string; name: string; order: number }[]; orgId: string | null }>({
  teams: [
    { id: 'team-choir', name: 'Choir', order: 0 },
    { id: 'team-orchestra', name: 'Orchestra', order: 1 },
    { id: 'team-communion', name: 'Communion', order: 2 },
    { id: 'team-special', name: 'Special', order: 3 },
  ],
  orgId: null,
})
const mockTeamsSubscribe = vi.fn()
const mockTeamsUnsubscribeAll = vi.fn()
const mockSeedDefaultTeamsIfEmpty = vi.fn()

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => ({
    get teams() {
      return mockTeamsState.teams
    },
    get orgId() {
      return mockTeamsState.orgId
    },
    subscribe: mockTeamsSubscribe,
    unsubscribeAll: mockTeamsUnsubscribeAll,
    seedDefaultTeamsIfEmpty: mockSeedDefaultTeamsIfEmpty,
  }),
}))

function mountServicesView() {
  return mount(ServicesView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
      },
    },
  })
}

beforeEach(() => {
  mockAuthState.orgId = 'org-1'
  mockAuthState.isEditor = true
  mockAuthState.settings.defaultServiceTemplate = []
  mockServiceState.isLoading = false
  mockServiceState.services = []
  mockPush.mockClear()
  mockSubscribe.mockClear()
  mockUnsubscribeAll.mockClear()
  mockCreateService.mockClear()
  mockTeamsState.orgId = null
  mockTeamsSubscribe.mockClear()
  mockTeamsUnsubscribeAll.mockClear()
  mockSeedDefaultTeamsIfEmpty.mockClear()
})

describe('ServicesView default-template cog (R113)', () => {
  it('renders the editor-gated cog for an editor', () => {
    const wrapper = mountServicesView()
    expect(wrapper.find('[data-testid="open-template-editor"]').exists()).toBe(true)
  })

  it('clicking the cog opens the teleported service-template-editor slide-out', async () => {
    const wrapper = mountServicesView()
    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(false)

    await wrapper.get('[data-testid="open-template-editor"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(true)
  })

  it('the editor close control closes the slide-out', async () => {
    const wrapper = mountServicesView()
    await wrapper.get('[data-testid="open-template-editor"]').trigger('click')
    await flushPromises()
    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(true)

    await body().get('[data-testid="service-template-editor-close"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(false)
  })

  it('does not render the cog for a non-editor (viewer)', () => {
    mockAuthState.isEditor = false
    const wrapper = mountServicesView()
    expect(wrapper.find('[data-testid="open-template-editor"]').exists()).toBe(false)
  })
})

describe('church switch re-subscribe (260901-lua)', () => {
  it('subscribes with the live new org id on switch and tears down the prior church', async () => {
    mockAuthState.orgId = 'org-1'
    mountServicesView()
    await flushPromises()

    expect(mockSubscribe).toHaveBeenCalledWith('org-1')

    mockSubscribe.mockClear()
    mockUnsubscribeAll.mockClear()

    // In-place church switch — no route change, no remount.
    mockAuthState.orgId = 'org-2'
    await flushPromises()

    expect(mockUnsubscribeAll).toHaveBeenCalled()
    expect(mockSubscribe).toHaveBeenCalledWith('org-2')
    expect(mockSubscribe).not.toHaveBeenCalledWith('org-1')
  })
})

describe('teamsStore teardown on org switch (R353/ARCH-002)', () => {
  it('tears down teamsStore locally on org switch, matching RosterView/DashboardView/TeamView', async () => {
    mockAuthState.orgId = 'org-1'
    mountServicesView()
    await flushPromises()

    mockTeamsUnsubscribeAll.mockClear()

    // In-place church switch — no route change, no remount.
    mockAuthState.orgId = 'org-2'
    await flushPromises()

    expect(mockTeamsUnsubscribeAll).toHaveBeenCalled()
  })
})
