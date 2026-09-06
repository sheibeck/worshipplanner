/**
 * Phase 127 Plan 06 — VolunteerServiceView is the standalone, read-only
 * tri-tab shell that replaces VolunteerServicePlaceholderView at
 * /volunteer/service/:serviceId. Mounts REAL child components (RehearseSongList/
 * Detail/FileReader/AudioPlayerBar, VolunteerOrderOfService/StageLayoutTab —
 * all already unit-tested in Plans 02-04) rather than stubbing them, so this
 * suite verifies the actual integration wiring: tab state/keyboard nav
 * (R384), the whole-view state machine (useVolunteerServiceDoc, mocked), and
 * the desktop 3-column / mobile drill-down Rehearse layout with a single
 * persistent player (R391). Mirrors MyScheduleView.test.ts's mocking
 * conventions for vue-router/@/stores/auth/@/stores/volunteerAuth.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import VolunteerServiceView from '../VolunteerServiceView.vue'
import RehearseSongList from '@/components/rehearse/RehearseSongList.vue'
import RehearseSongDetail from '@/components/rehearse/RehearseSongDetail.vue'
import RehearseFileReader from '@/components/rehearse/RehearseFileReader.vue'
import RehearseAudioPlayerBar from '@/components/rehearse/RehearseAudioPlayerBar.vue'
import VolunteerOrderOfService from '@/components/rehearse/VolunteerOrderOfService.vue'
import VolunteerStageLayoutTab from '@/components/rehearse/VolunteerStageLayoutTab.vue'
import type { RehearseAccessDoc } from '@/utils/rehearseAccess'
import type { VolunteerServiceDocState } from '@/composables/useVolunteerServiceDoc'

enableAutoUnmount(afterEach)

const globalStubs = {
  'router-link': {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
}

const mockPush = vi.fn(() => Promise.resolve())
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { serviceId: 'svc-1' } }),
  useRouter: () => ({ push: mockPush }),
}))

const mockAuthState = reactive<{ user: { email: string; displayName: string; uid: string } | null }>({
  user: { email: 'dana@example.com', displayName: 'Dana Reyes', uid: 'uid-1' },
})
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

const mockSignOut = vi.fn(() => Promise.resolve())
vi.mock('@/stores/volunteerAuth', () => ({
  useVolunteerAuthStore: () => ({ signOut: mockSignOut }),
}))

const mockState = ref<VolunteerServiceDocState>('loading')
const mockDoc = ref<RehearseAccessDoc | null>(null)
const mockRetry = vi.fn()
vi.mock('@/composables/useVolunteerServiceDoc', () => ({
  useVolunteerServiceDoc: vi.fn(() => ({ state: mockState, doc: mockDoc, retry: mockRetry })),
}))

function makeDoc(overrides: Partial<RehearseAccessDoc> = {}): RehearseAccessDoc {
  return {
    serviceId: 'svc-1',
    orgId: 'org-1',
    serviceDate: '2026-09-14',
    title: 'Sunday Worship',
    status: 'planned',
    assignedEmailsLower: ['dana@example.com'],
    rolesByEmailLower: { 'dana@example.com': ['Acoustic guitar'] },
    songs: [
      {
        id: 'song-1',
        title: 'Way Maker',
        keyOrArrangement: 'Bb',
        bpm: 72,
        attachments: [
          { id: 'att-pdf-1', name: 'Way Maker.pdf', kind: 'document', downloadUrl: 'https://example.com/pdf1' },
          { id: 'att-mp3-1', name: 'Way Maker (live).mp3', kind: 'audio', downloadUrl: 'https://example.com/mp3-1' },
        ],
      },
      {
        id: 'song-2',
        title: 'Great Are You Lord',
        keyOrArrangement: 'G',
        bpm: null,
        attachments: [],
      },
    ],
    orderOfService: [],
    roleAssignments: [],
    ...overrides,
  }
}

describe('VolunteerServiceView', () => {
  beforeEach(() => {
    mockState.value = 'loading'
    mockDoc.value = null
    mockRetry.mockClear()
    mockPush.mockClear()
  })

  it('shows the loading copy while state is loading', () => {
    const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
    expect(wrapper.text()).toContain('Loading this service')
  })

  it('shows the access-denied copy with a Back to My Schedule link', () => {
    mockState.value = 'access-denied'
    const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
    expect(wrapper.text()).toContain("You don't have access to this service, or it's no longer available.")
    const link = wrapper.find('a[href="/my-schedule"]')
    expect(link.exists()).toBe(true)
  })

  it('shows the load-failure copy and Retry calls the composable retry()', async () => {
    mockState.value = 'load-failure'
    const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
    expect(wrapper.text()).toContain("Couldn't load this service. Check your connection and try again.")
    await wrapper.find('[data-testid="vsv-retry"]').trigger('click')
    expect(mockRetry).toHaveBeenCalledOnce()
  })

  it('never mounts ServiceEditorView-only chrome — the populated view has no editing affordance', () => {
    mockState.value = 'loaded'
    mockDoc.value = makeDoc()
    const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
    // No component in this tree exposes editing (no "Print for tech", no
    // draft/save affordance) — the source file itself imports no
    // ServiceEditorView, verified statically at authoring time.
    expect(wrapper.text()).not.toContain('Print for tech')
  })

  describe('populated', () => {
    beforeEach(() => {
      mockState.value = 'loaded'
      mockDoc.value = makeDoc()
    })

    it('renders the service header (name + date) and Rehearse is the default active tab', () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      expect(wrapper.text()).toContain('Sunday Worship')
      expect(wrapper.find('#vsv-tab-rehearse').attributes('aria-selected')).toBe('true')
      expect(wrapper.find('#vsv-tab-order').attributes('aria-selected')).toBe('false')
      expect(wrapper.find('#vsv-tab-stage').attributes('aria-selected')).toBe('false')
    })

    it('switches tabs on click', async () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      await wrapper.find('#vsv-tab-order').trigger('click')
      expect(wrapper.find('#vsv-tab-order').attributes('aria-selected')).toBe('true')
      expect(wrapper.find('#vsv-tab-rehearse').attributes('aria-selected')).toBe('false')

      await wrapper.find('#vsv-tab-stage').trigger('click')
      expect(wrapper.find('#vsv-tab-stage').attributes('aria-selected')).toBe('true')
    })

    it('switches tabs on ArrowRight/ArrowLeft/Home/End (roving tabindex)', async () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      const tablist = wrapper.find('[role="tablist"]')

      await tablist.trigger('keydown', { key: 'ArrowRight' })
      expect(wrapper.find('#vsv-tab-order').attributes('aria-selected')).toBe('true')

      await tablist.trigger('keydown', { key: 'ArrowRight' })
      expect(wrapper.find('#vsv-tab-stage').attributes('aria-selected')).toBe('true')

      // Wraps around
      await tablist.trigger('keydown', { key: 'ArrowRight' })
      expect(wrapper.find('#vsv-tab-rehearse').attributes('aria-selected')).toBe('true')

      await tablist.trigger('keydown', { key: 'ArrowLeft' })
      expect(wrapper.find('#vsv-tab-stage').attributes('aria-selected')).toBe('true')

      await tablist.trigger('keydown', { key: 'Home' })
      expect(wrapper.find('#vsv-tab-rehearse').attributes('aria-selected')).toBe('true')

      await tablist.trigger('keydown', { key: 'End' })
      expect(wrapper.find('#vsv-tab-stage').attributes('aria-selected')).toBe('true')
    })

    it('mounts all three tab bodies (Rehearse leaves, Order of Service, Stage Layout)', () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      expect(wrapper.findAllComponents(RehearseSongList).length).toBeGreaterThan(0)
      expect(wrapper.findComponent(RehearseSongDetail).exists()).toBe(true)
      expect(wrapper.findComponent(RehearseFileReader).exists()).toBe(true)
      expect(wrapper.findComponent(VolunteerOrderOfService).exists()).toBe(true)
      expect(wrapper.findComponent(VolunteerStageLayoutTab).exists()).toBe(true)
    })

    it('selects the first song by default', () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      const detail = wrapper.findComponent(RehearseSongDetail)
      expect(detail.props('song')?.id).toBe('song-1')
    })

    it('shows the empty-song-list copy when the service has zero songs', () => {
      mockDoc.value = makeDoc({ songs: [] })
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      expect(wrapper.text()).toContain('No songs in this service yet.')
    })

    it('renders both the desktop 3-column layout and the mobile drill-down layout, with exactly ONE persistent player', () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      expect(wrapper.find('[data-testid="rehearse-desktop-layout"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="rehearse-mobile-layout"]').exists()).toBe(true)
      expect(wrapper.findAllComponents(RehearseAudioPlayerBar).length).toBe(1)
    })

    it('mobile Rehearse starts on the song list screen (no reader/back-button chrome yet)', () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      expect(wrapper.find('[data-testid="vsv-mobile-back-to-list"]').exists()).toBe(false)
      // Desktop always has RehearseSongList; mobile also shows it on the
      // initial 'list' screen — both are real instances of the same component.
      expect(wrapper.findAllComponents(RehearseSongList).length).toBe(2)
    })

    it('selecting a song updates the detail panel and advances the mobile screen to detail', async () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      const desktopList = wrapper.findAllComponents(RehearseSongList)[0]!
      await desktopList.vm.$emit('select', 'song-2')

      expect(wrapper.findComponent(RehearseSongDetail).props('song')?.id).toBe('song-2')
      // Mobile advanced off the list screen — the back-to-list button and
      // detail panel now render on mobile too.
      expect(wrapper.find('[data-testid="vsv-mobile-back-to-list"]').exists()).toBe(true)
      expect(wrapper.findAllComponents(RehearseSongDetail).length).toBe(2)
    })

    it('a Play toggle sets the shared active track on the single player', async () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      const detail = wrapper.findComponent(RehearseSongDetail)
      const track = { id: 'att-mp3-1', name: 'Way Maker (live).mp3', kind: 'audio' as const, downloadUrl: 'https://example.com/mp3-1' }
      await detail.vm.$emit('play', track)

      const player = wrapper.findComponent(RehearseAudioPlayerBar)
      expect(player.props('track')).toEqual(track)
    })

    it('an open-pdf sets the reader attachment and advances mobile to the reader screen (link-first)', async () => {
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      const detail = wrapper.findComponent(RehearseSongDetail)
      const attachment = { id: 'att-pdf-1', name: 'Way Maker.pdf', kind: 'document' as const, downloadUrl: 'https://example.com/pdf1' }
      await detail.vm.$emit('open-pdf', attachment)

      const readers = wrapper.findAllComponents(RehearseFileReader)
      expect(readers.length).toBe(2)
      for (const reader of readers) {
        expect(reader.props('attachment')?.id).toBe('att-pdf-1')
      }
      const mobileReader = readers.find((r) => r.props('mobileLinkFirst') === true)
      expect(mobileReader).toBeDefined()
    })

    it('feeds Order of Service and Stage Layout tabs from the loaded doc', () => {
      mockDoc.value = makeDoc({
        stageLayout: { elements: [{ id: 'm1', label: 'Mic', zone: 'onstage', xPct: 10, yPct: 20 }] },
      })
      const wrapper = mount(VolunteerServiceView, { global: { stubs: globalStubs } })
      expect(wrapper.findComponent(VolunteerOrderOfService).props('orderOfService')).toEqual([])
      expect(wrapper.findComponent(VolunteerStageLayoutTab).props('elements')).toEqual([
        { id: 'm1', label: 'Mic', zone: 'onstage', xPct: 10, yPct: 20 },
      ])
    })
  })
})
