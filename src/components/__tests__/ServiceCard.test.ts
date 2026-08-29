import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ServiceCard from '../ServiceCard.vue'
import type { Service } from '@/types/service'
import type { Timestamp } from 'firebase/firestore'

// Hoisted so the R284 navigation cases can assert against the SAME push spy the
// component calls (a spy created inside the factory would be unreachable).
const pushSpy = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushSpy,
  }),
}))

vi.mock('@/stores/services', () => ({
  useServiceStore: () => ({
    orgId: 'org-1',
    createShareToken: vi.fn(() => Promise.resolve('mock-token')),
  }),
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    songs: [],
  }),
}))

// ServiceCard reads bibleVersion to route its scripture reader links to the
// church's chosen translation (ESV.org vs BibleGateway/NLT). It also reads orgId
// for the R284 Run gate — a mutable hoisted holder lets a case null it.
const authState = vi.hoisted(() => ({ orgId: 'org-1' as string | null }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    settings: { bibleVersion: 'ESV' },
    get orgId() {
      return authState.orgId
    },
  }),
}))

const mockTimestamp = { toDate: () => new Date('2026-03-04') } as unknown as Timestamp

const mockService: Service = {
  id: 'svc-001',
  date: '2026-03-08',
  name: '',
  progression: '1-2-2-3',
  teams: ['Choir'],
  status: 'draft',
  slots: [
    {
      kind: 'SONG',
      id: 'slot-song-1',
      position: 1,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Amazing Grace',
      songKey: 'G',
    },
    {
      kind: 'SONG',
      id: 'slot-song-2',
      position: 2,
      requiredVwType: 2,
      songId: null,
      songTitle: null,
      songKey: null,
    },
    {
      kind: 'SONG',
      id: 'slot-song-3',
      position: 3,
      requiredVwType: 2,
      songId: 'song-3',
      songTitle: 'Holy Holy Holy',
      songKey: 'E',
    },
    { kind: 'PRAYER', id: 'slot-prayer-4', position: 4 },
    { kind: 'MESSAGE', id: 'slot-message-5', position: 5 },
  ],
  sermonPassage: null,
  notes: '',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

// R112 fixture: a service whose `slots` array is DELIBERATELY NOT section-major.
// A sending-section song appears EARLY (index 1, before the MESSAGE) and an
// empty-bodied worship MISC appears LATE (index 3, after the MESSAGE). The
// editor renders section-major order, so the listing must too: the empty MISC
// belongs in the worship band (before the "--- Message ---" divider), NOT sunk
// to the bottom, and the sending song belongs after the divider.
const mockServiceUnordered: Service = {
  id: 'svc-order',
  date: '2026-03-08',
  name: '',
  progression: '1-2-2-3',
  teams: [],
  status: 'draft',
  slots: [
    {
      kind: 'SONG',
      id: 'u-song-worship',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Amazing Grace',
      songKey: 'G',
      section: 'worship',
    },
    {
      kind: 'SONG',
      id: 'u-song-sending',
      position: 1,
      requiredVwType: 3,
      songId: 'song-2',
      songTitle: 'Doxology',
      songKey: 'C',
      section: 'sending',
    },
    { kind: 'MESSAGE', id: 'u-message', position: 2, section: 'message' },
    { kind: 'MISC', id: 'u-misc-worship', position: 3, section: 'worship' },
    {
      kind: 'SONG',
      id: 'u-song-worship-2',
      position: 4,
      requiredVwType: 2,
      songId: 'song-3',
      songTitle: 'Holy Holy Holy',
      songKey: 'E',
      section: 'worship',
    },
  ],
  sermonPassage: null,
  notes: '',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

// R284 fixtures: LOCKED services (status !== 'draft') so canRun is true when an
// orgId is set. One 'planned' and one 'exported' to prove isLocked covers both
// non-draft statuses.
const mockServicePlanned: Service = { ...mockService, id: 'svc-planned', status: 'planned' }
const mockServiceExported: Service = { ...mockService, id: 'svc-exported', status: 'exported' }

const globalStubs = {
  'router-link': {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
}

describe('ServiceCard', () => {
  it('renders formatted date with month and day', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockService },
      global: { stubs: globalStubs },
    })
    expect(wrapper.text()).toContain('Mar')
    expect(wrapper.text()).toContain('8')
  })

  it('renders Message in slot summary', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockService },
      global: { stubs: globalStubs },
    })
    expect(wrapper.text()).toContain('Message')
  })

  it('renders song titles from filled song slots', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockService },
      global: { stubs: globalStubs },
    })
    expect(wrapper.text()).toContain('Amazing Grace')
    expect(wrapper.text()).toContain('Holy Holy Holy')
  })

  it('renders "Empty" for unfilled song slots', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockService },
      global: { stubs: globalStubs },
    })
    expect(wrapper.text()).toContain('Empty')
  })

  it('renders status badge text', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockService },
      global: { stubs: globalStubs },
    })
    expect(wrapper.text()).toContain('draft')
  })

  it('links to the correct /services/:id URL', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockService },
      global: { stubs: globalStubs },
    })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/services/svc-001')
  })

  it('uses flex-col layout with pinned footer', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockService },
      global: { stubs: globalStubs },
    })
    // Root element uses flex column layout
    const root = wrapper.element as HTMLElement
    expect(root.className).toContain('flex')
    expect(root.className).toContain('flex-col')
    expect(root.className).toContain('h-full')

    // Body area grows to fill space
    const body = wrapper.find('a')
    expect(body.classes()).toContain('flex-1')

    // Footer does not shrink
    const footer = wrapper.find('[title="Share"]').element.closest('div')!
    expect(footer.className).toContain('shrink-0')
  })

  // R112 — the listing must render slots in the editor's section-major order,
  // including empty-bodied items, with no edit and no refresh. On the pre-fix
  // code the listing renders the RAW persisted array order, so the empty
  // worship MISC sinks below the "--- Message ---" divider (RED).
  it('renders slots in section-major order including an empty-bodied item (R112)', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockServiceUnordered },
      global: { stubs: globalStubs },
    })
    const text = wrapper.text()
    const miscIdx = text.indexOf('Miscellaneous')
    const dividerIdx = text.indexOf('--- Message ---')
    const doxologyIdx = text.indexOf('Doxology')

    // The empty worship MISC is rendered at all...
    expect(miscIdx).toBeGreaterThan(-1)
    // ...and sits in its worship band, BEFORE the message divider — not sunk
    // to the bottom until text is typed.
    expect(miscIdx).toBeLessThan(dividerIdx)
    // The sending-section song renders AFTER the message divider.
    expect(doxologyIdx).toBeGreaterThan(dividerIdx)
  })
})

// R284 — a viewer-inclusive Run affordance on each LOCKED listing row, gated on
// isLocked (status !== 'draft') && !!authStore.orgId, navigating to /run/:id?org=
// with @click.stop so it does not also open the card-body editor link.
describe('ServiceCard — Run affordance (R284)', () => {
  const RUN_SEL = '[data-testid="run-service-card-btn"]'

  beforeEach(() => {
    authState.orgId = 'org-1'
    pushSpy.mockClear()
  })

  it('shows Run on a locked (planned) row for an org member', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockServicePlanned },
      global: { stubs: globalStubs },
    })
    expect(wrapper.find(RUN_SEL).exists()).toBe(true)
  })

  it('shows Run on an exported row too (isLocked covers both non-draft statuses)', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockServiceExported },
      global: { stubs: globalStubs },
    })
    expect(wrapper.find(RUN_SEL).exists()).toBe(true)
  })

  it('hides Run on a draft row', () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockService },
      global: { stubs: globalStubs },
    })
    expect(wrapper.find(RUN_SEL).exists()).toBe(false)
  })

  it('hides Run when orgId is null (no active org)', () => {
    authState.orgId = null
    const wrapper = mount(ServiceCard, {
      props: { service: mockServicePlanned },
      global: { stubs: globalStubs },
    })
    expect(wrapper.find(RUN_SEL).exists()).toBe(false)
  })

  it('navigates to /run/:id?org= on click without opening the editor', async () => {
    const wrapper = mount(ServiceCard, {
      props: { service: mockServicePlanned },
      global: { stubs: globalStubs },
    })
    await wrapper.find(RUN_SEL).trigger('click')
    // @click.stop keeps the card-body router-link from also firing — a single
    // /run push (never a /services push) is sufficient proof.
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy).toHaveBeenCalledWith(
      '/run/' + encodeURIComponent(mockServicePlanned.id) + '?org=org-1',
    )
  })
})
