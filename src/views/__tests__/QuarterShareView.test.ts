import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// Mock vue-router — mirrors ShareView.test.ts's harness, extended with a mutable
// query object (view/name persistence) and a spy-able router.replace.
const mockRouterReplace = vi.fn()
let mockRouteQuery: Record<string, string> = {}

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: { token: 'test-token-123' },
    query: mockRouteQuery,
  })),
  useRouter: vi.fn(() => ({
    replace: mockRouterReplace,
  })),
}))

// Mock @/firebase
vi.mock('@/firebase', () => ({
  db: {},
}))

// Mock firebase/firestore — getDoc is controlled per test
const mockGetDoc = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    id: segments[segments.length - 1] ?? 'mock-id',
    path: segments.join('/'),
  })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}))

const mockSnapshot = {
  label: 'Q1 2026',
  serviceDates: ['2026-01-04', '2026-01-11'],
  roles: [
    { id: 'r1', name: 'Vocals', group: 'band' },
    { id: 'r2', name: 'Sound', group: 'tech' },
  ],
  calendar: {
    '2026-01-04': { r1: ['Alice', 'Bob'], r2: ['Carol'] },
    '2026-01-11': { r1: ['Bob'], r2: [] },
  },
}

async function mountQuarterShareView() {
  const { default: QuarterShareView } = await import('../QuarterShareView.vue')
  return mount(QuarterShareView)
}

describe('QuarterShareView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteQuery = {}
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ quarterSnapshot: mockSnapshot }),
    })
  })

  it('renders the matrix view by default with roles as columns and dates as rows', async () => {
    const wrapper = await mountQuarterShareView()
    await flushPromises()

    // Role columns
    expect(wrapper.text()).toContain('Vocals')
    expect(wrapper.text()).toContain('Sound')
    // Date rows with multi-person comma-separated cell
    expect(wrapper.text()).toContain('Alice, Bob')
    expect(wrapper.text()).toContain('Carol')
    // Matrix is a <table>
    expect(wrapper.find('table').exists()).toBe(true)
  })

  it('toggles to the list view when List is clicked', async () => {
    const wrapper = await mountQuarterShareView()
    await flushPromises()

    const listButton = wrapper.findAll('button').find((b) => b.text() === 'List')
    expect(listButton).toBeTruthy()
    await listButton!.trigger('click')
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alice')
  })

  it('hides dates where the filtered person serves nothing, in matrix view', async () => {
    const wrapper = await mountQuarterShareView()
    await flushPromises()

    const input = wrapper.find('input[placeholder="Filter by name…"]')
    expect(input.exists()).toBe(true)
    await input.setValue('Alice')
    await input.trigger('focus')
    await flushPromises()

    const candidate = wrapper.findAll('[data-role="name-candidate"]').find((c) => c.text() === 'Alice')
    expect(candidate).toBeTruthy()
    await candidate!.trigger('mousedown')
    await flushPromises()

    // Alice only serves on 2026-01-04 — 2026-01-11 should be hidden
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(wrapper.text()).toContain('Alice, Bob')
  })

  it('hides non-serving dates in list view too, and "Show everyone" clears the filter', async () => {
    const wrapper = await mountQuarterShareView()
    await flushPromises()

    const listButton = wrapper.findAll('button').find((b) => b.text() === 'List')
    await listButton!.trigger('click')
    await flushPromises()

    const input = wrapper.find('input[placeholder="Filter by name…"]')
    await input.setValue('Alice')
    await input.trigger('focus')
    await flushPromises()
    const candidate = wrapper.findAll('[data-role="name-candidate"]').find((c) => c.text() === 'Alice')
    await candidate!.trigger('mousedown')
    await flushPromises()

    expect(wrapper.text()).not.toContain('January 11')

    const clearButton = wrapper.findAll('button').find((b) => b.text() === 'Show everyone')
    expect(clearButton).toBeTruthy()
    await clearButton!.trigger('click')
    await flushPromises()

    // Clearing restores all dates
    expect(wrapper.text()).toContain('January 11')
  })
})
