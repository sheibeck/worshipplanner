/**
 * Phase 126 Plan 04 — MyScheduleView is the volunteer's post-sign-in landing.
 * Covers the four documented states (empty/populated/loading/error) plus the
 * Rehearse-target contract per 126-UI-SPEC.md. Mirrors ServiceCard.test.ts's
 * router-link stub convention (a real <a :href> so href assertions work) and
 * ServicesView.test.ts's reactive-mock-store convention for the stores this
 * view reads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import MyScheduleView from '../MyScheduleView.vue'
import type { MyScheduleDoc } from '@/stores/mySchedule'

enableAutoUnmount(afterEach)

const globalStubs = {
  'router-link': {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
  // My Schedule now renders inside the shared AppShell (left-menu chrome) like
  // every other authed view. AppShell pulls in AppSidebar (useRoute/auth), so
  // stub it to a bare slot passthrough — this view's own content is under test.
  AppShell: {
    template: '<div><slot /></div>',
  },
}

const mockSelectOrg = vi.fn()
const mockAuthState = reactive<{ user: { email: string; displayName: string } | null }>({
  user: { email: 'Dana@Example.com', displayName: 'Dana Reyes' },
})
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    ...mockAuthState,
    selectOrg: mockSelectOrg,
  }),
}))

const mockLoadMySchedule = vi.fn()
const mockScheduleState = reactive<{
  docs: MyScheduleDoc[]
  isLoading: boolean
  error: string | null
  selectedChurch: string | null
}>({
  docs: [],
  isLoading: false,
  error: null,
  selectedChurch: null,
})
// Phase 130 (R403/R404/R405) — churches/filteredDocs mirror the real store's
// derivation exactly (mySchedule.ts) so tests only ever need to set
// mockScheduleState.docs/selectedChurch, never hand-maintain a parallel list.
vi.mock('@/stores/mySchedule', () => ({
  useMyScheduleStore: () => ({
    get docs() {
      return mockScheduleState.docs
    },
    get isLoading() {
      return mockScheduleState.isLoading
    },
    get error() {
      return mockScheduleState.error
    },
    get selectedChurch() {
      return mockScheduleState.selectedChurch
    },
    set selectedChurch(value: string | null) {
      mockScheduleState.selectedChurch = value
    },
    get churches() {
      const byOrgId = new Map<string, string | undefined>()
      for (const d of mockScheduleState.docs) {
        if (!byOrgId.has(d.orgId)) byOrgId.set(d.orgId, d.orgName)
      }
      return [...byOrgId.entries()].map(([orgId, orgName]) => ({ orgId, orgName }))
    },
    get filteredDocs() {
      if (!mockScheduleState.selectedChurch) return mockScheduleState.docs
      return mockScheduleState.docs.filter((d) => d.orgId === mockScheduleState.selectedChurch)
    },
    loadMySchedule: mockLoadMySchedule,
  }),
}))

function makeDoc(overrides: Partial<MyScheduleDoc> = {}): MyScheduleDoc {
  return {
    serviceId: 'svc-1',
    orgId: 'org-1',
    serviceDate: '2026-09-06',
    title: 'Sunday Worship',
    status: 'planned',
    assignedEmailsLower: ['dana@example.com'],
    rolesByEmailLower: { 'dana@example.com': ['Acoustic guitar'] },
    songs: [
      {
        id: 'song-1',
        title: 'Amazing Grace',
        attachments: [{ id: 'att-1', name: 'chart.pdf', kind: 'document' }],
      },
    ],
    // Phase 127 (T-127-01): required fields on RehearseAccessDoc — empty is a
    // valid fixture default (this view's tests don't exercise Order of
    // Service/Who's Serving rendering).
    orderOfService: [],
    roleAssignments: [],
    ...overrides,
  }
}

describe('MyScheduleView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // A fixed Sunday so "This week"/"Later this month"/"Past services"
    // bucketing (via groupMySchedule's real now=new Date() default) is
    // deterministic — mirrors myScheduleGrouping.test.ts's own fixed clock.
    vi.setSystemTime(new Date(2026, 8, 6, 9, 0, 0))
    mockScheduleState.docs = []
    mockScheduleState.isLoading = false
    mockScheduleState.error = null
    mockScheduleState.selectedChurch = null
    mockLoadMySchedule.mockClear()
    mockSelectOrg.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls loadMySchedule on mount', () => {
    mount(MyScheduleView, { global: { stubs: globalStubs } })
    expect(mockLoadMySchedule).toHaveBeenCalledOnce()
  })

  describe('loading state', () => {
    it('shows the loading copy while isLoading is true', () => {
      mockScheduleState.isLoading = true
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })
      expect(wrapper.text()).toContain('Loading your schedule')
    })
  })

  describe('error state', () => {
    it('shows the load-failure copy and a Retry control that calls loadMySchedule again', async () => {
      mockScheduleState.error = 'permission-denied'
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })
      expect(wrapper.text()).toContain("Couldn't load your schedule")
      mockLoadMySchedule.mockClear()

      await wrapper.get('[data-testid="retry-load"]').trigger('click')
      expect(mockLoadMySchedule).toHaveBeenCalledOnce()
    })
  })

  describe('empty state', () => {
    it('renders the empty state (no multi-email affordance)', () => {
      mockScheduleState.docs = []
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })

      const empty = wrapper.get('[data-testid="empty-state"]')
      expect(empty.text()).toContain("You don't have any upcoming services.")
      // The "check a different email" affordance was removed — volunteers use
      // a single email, so it no longer makes sense.
      expect(wrapper.find('[data-testid="check-different-email-empty"]').exists()).toBe(false)
    })
  })

  describe('populated state', () => {
    it('renders grouped section headers, the Next up pill on the soonest card, and Rehearse links to /volunteer/service/:serviceId', () => {
      mockScheduleState.docs = [
        makeDoc({ serviceId: 'svc-this-week', title: 'Sunday Worship', serviceDate: '2026-09-06' }),
        makeDoc({ serviceId: 'svc-later', title: 'Youth Night', serviceDate: '2026-09-20' }),
        makeDoc({ serviceId: 'svc-past', title: 'Old Service', serviceDate: '2026-08-01' }),
      ]
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })

      expect(wrapper.text()).toContain('This week')
      expect(wrapper.text()).toContain('Later this month')
      expect(wrapper.text()).toContain('Past services')

      const cards = wrapper.findAll('[data-testid="schedule-card"]')
      // Past services are collapsed by default — only the 2 upcoming cards render.
      expect(cards).toHaveLength(2)

      const nextUpCard = cards.find((c) => c.text().includes('Sunday Worship'))!
      expect(nextUpCard.find('[data-testid="next-up-pill"]').exists()).toBe(true)
      expect(nextUpCard.attributes('href')).toBe('/volunteer/service/svc-this-week')

      const laterCard = cards.find((c) => c.text().includes('Youth Night'))!
      expect(laterCard.find('[data-testid="next-up-pill"]').exists()).toBe(false)
      expect(laterCard.attributes('href')).toBe('/volunteer/service/svc-later')
    })

    it('reveals the past section on toggle, with an Open service link for the past card', async () => {
      mockScheduleState.docs = [makeDoc({ serviceId: 'svc-past', title: 'Old Service', serviceDate: '2026-08-01' })]
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })

      expect(wrapper.find('[data-testid="schedule-card"]').exists()).toBe(false)
      await wrapper.get('[data-testid="toggle-past"]').trigger('click')

      const card = wrapper.get('[data-testid="schedule-card"]')
      expect(card.text()).toContain('Open service')
      expect(card.attributes('href')).toBe('/volunteer/service/svc-past')
    })

    it('shows the first-name-only greeting, never displayLabel\'s "Dana R." form', () => {
      mockScheduleState.docs = [makeDoc()]
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })
      expect(wrapper.get('h1').text()).toMatch(/^Good (morning|afternoon|evening), Dana$/)
    })

    it('WR-03 (126-REVIEW): shows an explicit "no upcoming services" line when every assignment is past, instead of a bare greeting', () => {
      mockScheduleState.docs = [makeDoc({ serviceId: 'svc-past', title: 'Old Service', serviceDate: '2026-08-01' })]
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })
      expect(wrapper.text()).toContain('No upcoming services — see your past services below.')
      // Past stays collapsed by default (170 above) — this line is the ONLY
      // visible content difference, not an implicit expand.
      expect(wrapper.find('[data-testid="schedule-card"]').exists()).toBe(false)
    })
  })

  /**
   * Phase 130 Plan 02 (R403/R404/R405). The church filter is a pure
   * client-side filter over mySchedule.docs — never a data-scope switch.
   */
  describe('church filter (R403/R404/R405, Phase 130)', () => {
    it('renders no filter for a single-church volunteer (R405)', () => {
      mockScheduleState.docs = [makeDoc({ orgId: 'org-1', orgName: 'Grace Fellowship' })]
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })
      expect(wrapper.find('[data-testid="church-filter"]').exists()).toBe(false)
    })

    it('renders no filter when there are zero docs (R405)', () => {
      mockScheduleState.docs = []
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })
      expect(wrapper.find('[data-testid="church-filter"]').exists()).toBe(false)
    })

    it('renders the filter with an "All churches" default plus one option per church, labeled by orgName (R403/R404)', () => {
      mockScheduleState.docs = [
        makeDoc({ serviceId: 'svc-1', orgId: 'org-1', orgName: 'Grace Fellowship' }),
        makeDoc({ serviceId: 'svc-2', orgId: 'org-2', orgName: undefined }),
      ]
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })

      const select = wrapper.get('[data-testid="church-filter"]')
      const options = select.findAll('option')
      expect(options.map((o) => o.text())).toEqual(['All churches', 'Grace Fellowship', 'Unnamed church'])
    })

    it('selecting a church scopes the rendered cards to that church and never calls authStore.selectOrg (R403)', async () => {
      mockScheduleState.docs = [
        makeDoc({ serviceId: 'svc-1', orgId: 'org-1', orgName: 'Grace Fellowship', title: 'Grace Service', serviceDate: '2026-09-06' }),
        makeDoc({ serviceId: 'svc-2', orgId: 'org-2', orgName: 'Hillside Chapel', title: 'Hillside Service', serviceDate: '2026-09-07' }),
      ]
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })

      let cards = wrapper.findAll('[data-testid="schedule-card"]')
      expect(cards).toHaveLength(2)

      await wrapper.get('[data-testid="church-filter"]').setValue('org-2')

      cards = wrapper.findAll('[data-testid="schedule-card"]')
      expect(cards).toHaveLength(1)
      expect(cards[0]!.text()).toContain('Hillside Service')
      expect(mockSelectOrg).not.toHaveBeenCalled()
    })

    it('shows a filtered-empty message when the selection matches zero of the loaded docs while docs overall is non-empty (R404)', async () => {
      // A church option always has >=1 matching doc when chosen through the
      // rendered <select> (options are derived from docs). This exercises
      // the defensive "stale selection" path per 130-UI-SPEC.md's Copywriting
      // Contract directly, since resetStaleSelection() only re-validates on
      // the next loadMySchedule() call, not on every docs read.
      mockScheduleState.docs = [
        makeDoc({ serviceId: 'svc-1', orgId: 'org-1', orgName: 'Grace Fellowship', serviceDate: '2026-09-06' }),
        makeDoc({ serviceId: 'svc-2', orgId: 'org-2', orgName: 'Hillside Chapel', serviceDate: '2026-09-07' }),
      ]
      mockScheduleState.selectedChurch = 'org-3'
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })

      const filteredEmpty = wrapper.get('[data-testid="filtered-empty"]')
      expect(filteredEmpty.text()).toContain('No upcoming services for Unnamed church.')
      expect(wrapper.find('[data-testid="schedule-card"]').exists()).toBe(false)
    })

    it('choosing "All churches" clears the filter and restores every card', async () => {
      mockScheduleState.docs = [
        makeDoc({ serviceId: 'svc-1', orgId: 'org-1', orgName: 'Grace Fellowship', serviceDate: '2026-09-06' }),
        makeDoc({ serviceId: 'svc-2', orgId: 'org-2', orgName: 'Hillside Chapel', serviceDate: '2026-09-07' }),
      ]
      const wrapper = mount(MyScheduleView, { global: { stubs: globalStubs } })

      await wrapper.get('[data-testid="church-filter"]').setValue('org-2')
      expect(wrapper.findAll('[data-testid="schedule-card"]')).toHaveLength(1)

      await wrapper.get('[data-testid="church-filter"]').setValue('')
      expect(wrapper.findAll('[data-testid="schedule-card"]')).toHaveLength(2)
    })
  })
})
