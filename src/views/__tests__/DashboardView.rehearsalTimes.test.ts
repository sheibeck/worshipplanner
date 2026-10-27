import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { ref } from 'vue'
import type { Service } from '@/types/service'
import DashboardView from '../DashboardView.vue'

// R445 — pins the R433 times label on the dashboard next/following rows.
// The view reads the LIVE Service, so it filters + sorts itself.

function makeService(overrides: Partial<Service>): Service {
  return {
    id: 'svc',
    date: '2099-03-08',
    name: 'Sunday',
    progression: '1-2-2-3',
    teams: [],
    status: 'draft',
    slots: [],
    sermonPassage: null,
    notes: '',
    ...overrides,
  } as Service
}

const mockServices = vi.hoisted(() => ({ value: [] as unknown[] }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isEditor: true,
    orgId: 'org-1',
    user: { displayName: 'Test', email: 'test@example.com' },
    vwModeEnabled: false,
  }),
}))
vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    songs: [],
    visibleSongs: [],
    subscribe: vi.fn(),
    unsubscribeAll: vi.fn(),
  }),
}))
vi.mock('@/stores/services', () => ({
  useServiceStore: () => ({
    get services() {
      return mockServices.value
    },
    subscribe: vi.fn(),
    unsubscribeAll: vi.fn(),
  }),
}))
vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({ people: [], subscribe: vi.fn(), unsubscribeAll: vi.fn() }),
}))
vi.mock('@/composables/useUnconfirmedVolunteers', () => ({
  useUnconfirmedVolunteers: () => ({
    rows: ref([]),
    loading: ref(false),
    error: ref(null),
    hasStaleAssignmentData: ref(false),
  }),
}))
vi.mock('@/composables/usePresenceRollup', () => ({
  usePresenceRollup: () => ({ activeEditors: ref([]) }),
}))

function mountDashboard() {
  return mount(DashboardView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        GettingStarted: true,
        'router-link': { template: '<a><slot /></a>' },
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

enableAutoUnmount(afterEach)

describe('R445: dashboard report/rehearsal times regression (R433)', () => {
  it('R445: next service renders the sorted dated rehearsals and report time, hiding undated/untimed rows', () => {
    mockServices.value = [
      makeService({
        id: 'next',
        date: '2099-03-08',
        reportTime: '08:00',
        rehearsals: [
          { id: 'r2', date: '2099-03-06', time: '19:00' },
          { id: 'u1', date: '', time: '19:00' },
          { id: 'r1', date: '2099-03-05', time: '18:30' },
          { id: 'u2', date: '2099-03-04', time: '' },
        ],
      }),
    ]
    const wrapper = mountDashboard()
    expect(norm(wrapper.get('[data-testid="dashboard-next-service-times"]').text())).toBe(
      'Report 8:00 AM · Rehearsals: Mar 5, 6:30 PM; Mar 6, 7:00 PM',
    )
  })

  it('R445: a following service with only non-displayable rows and no report time renders no times element', () => {
    mockServices.value = [
      makeService({ id: 'next', date: '2099-03-08' }),
      makeService({
        id: 'f1',
        date: '2099-03-15',
        rehearsals: [
          { id: 'u1', date: '', time: '19:00' },
          { id: 'u2', date: '2099-03-12', time: '' },
        ],
      }),
    ]
    const wrapper = mountDashboard()
    expect(wrapper.find('[data-testid="dashboard-following-service-times"]').exists()).toBe(false)
  })

  it('R445: a following service with one dated row and no report time renders the singular label', () => {
    mockServices.value = [
      makeService({ id: 'next', date: '2099-03-08' }),
      makeService({
        id: 'f1',
        date: '2099-03-15',
        rehearsals: [{ id: 'r1', date: '2099-03-12', time: '19:00' }],
      }),
    ]
    const wrapper = mountDashboard()
    expect(norm(wrapper.get('[data-testid="dashboard-following-service-times"]').text())).toBe(
      'Rehearsal: Mar 12, 7:00 PM',
    )
  })
})
