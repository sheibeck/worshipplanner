import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ServiceCard from '../ServiceCard.vue'
import type { Service } from '@/types/service'
import type { Timestamp } from 'firebase/firestore'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(() => Promise.resolve()),
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
      position: 1,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Amazing Grace',
      songKey: 'G',
    },
    {
      kind: 'SONG',
      position: 2,
      requiredVwType: 2,
      songId: null,
      songTitle: null,
      songKey: null,
    },
    {
      kind: 'SONG',
      position: 3,
      requiredVwType: 2,
      songId: 'song-3',
      songTitle: 'Holy Holy Holy',
      songKey: 'E',
    },
    { kind: 'PRAYER', position: 4 },
    { kind: 'MESSAGE', position: 5 },
  ],
  sermonPassage: null,
  notes: '',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

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
})
