import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'

// Mock vue-router — params are mutable per-test via mockRouteParams
const mockRouteParams: Record<string, string | undefined> = { token: 'test-token-123' }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: mockRouteParams,
  })),
}))

// Mock @/firebase
vi.mock('@/firebase', () => ({
  db: {},
}))

// Mock @/utils/planningCenterExport
vi.mock('@/utils/planningCenterExport', () => ({
  formatScriptureRef: vi.fn((ref: { book: string; chapter: number; verseStart: number; verseEnd: number }) =>
    `${ref.book} ${ref.chapter}:${ref.verseStart}-${ref.verseEnd}`
  ),
}))

// Mock @/utils/slotTypes
vi.mock('@/utils/slotTypes', () => ({
  slotLabel: vi.fn((slot: { kind: string }) => {
    switch (slot.kind) {
      case 'SONG': return 'Song'
      case 'SCRIPTURE': return 'Scripture Reading'
      case 'PRAYER': return 'Prayer'
      case 'MESSAGE': return 'Message'
      default: return slot.kind
    }
  }),
  miscLabel: vi.fn((slot: { label?: string }) => slot.label?.trim() || 'Miscellaneous'),
}))

// Mock firebase/firestore — getDoc and doc are controlled/inspected per test
const mockGetDoc = vi.fn()
const mockDoc = vi.fn((...args: unknown[]) => {
  const segments = args.slice(1) as string[]
  return {
    id: segments[segments.length - 1] ?? 'mock-id',
    path: segments.join('/'),
  }
})
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}))

const mockSnapshot = {
  date: '2026-03-08',
  name: 'Sunday Service',
  progression: '1-2-2-3',
  teams: ['Choir'],
  status: 'planned',
  sermonPassage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
  notes: 'Remember to mic the choir',
  slots: [
    {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-abc',
      songTitle: 'Amazing Grace',
      songKey: 'G',
      bpm: 120,
    },
    {
      kind: 'SCRIPTURE',
      position: 1,
      book: 'Psalm',
      chapter: 100,
      verseStart: 1,
      verseEnd: 5,
    },
    {
      kind: 'SONG',
      position: 2,
      requiredVwType: 2,
      songId: null,
      songTitle: null,
      songKey: null,
      bpm: null,
    },
    {
      kind: 'PRAYER',
      position: 3,
    },
    {
      kind: 'MESSAGE',
      position: 7,
    },
  ],
}

async function mountShareView() {
  const { default: ShareView } = await import('../ShareView.vue')
  return mount(ShareView)
}

describe('ShareView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to the opaque-token shape by default; memorable-route tests override this.
    delete mockRouteParams.slug
    delete mockRouteParams.date
    mockRouteParams.token = 'test-token-123'
  })

  it('shows loading state initially', async () => {
    // Never resolve getDoc during this test
    mockGetDoc.mockReturnValue(new Promise(() => {}))
    const wrapper = await mountShareView()
    expect(wrapper.text()).toContain('Loading')
  })

  it('shows not-found state when token document does not exist', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => null,
    })
    const wrapper = await mountShareView()
    await flushPromises()
    expect(wrapper.text()).toContain('no longer available')
  })

  it('renders service snapshot data when token is valid', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ serviceSnapshot: mockSnapshot }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    // Date should be formatted
    expect(wrapper.text()).toContain('2026')
    // Song title
    expect(wrapper.text()).toContain('Amazing Grace')
    // Scripture reference text
    expect(wrapper.text()).toContain('Psalm')
    expect(wrapper.text()).toContain('100')
    // Notes
    expect(wrapper.text()).toContain('Remember to mic the choir')
  })

  it('renders not-found when getDoc throws an error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Permission denied'))
    const wrapper = await mountShareView()
    await flushPromises()
    expect(wrapper.text()).toContain('no longer available')
  })

  it('reads serviceShares/{slug}__service-{date} when no token param is present (memorable route)', async () => {
    delete mockRouteParams.token
    mockRouteParams.slug = 'first-church'
    mockRouteParams.date = '2026-03-08'
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ serviceSnapshot: mockSnapshot }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      'serviceShares',
      'first-church__service-2026-03-08',
    )
    expect(wrapper.text()).toContain('Amazing Grace')
  })

  it('renders not-found for a nonexistent memorable share doc (no unhandled error)', async () => {
    delete mockRouteParams.token
    mockRouteParams.slug = 'first-church'
    mockRouteParams.date = '2099-01-01'
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => null,
    })
    const wrapper = await mountShareView()
    await flushPromises()
    expect(wrapper.text()).toContain('no longer available')
  })

  it('renders the Who\'s Serving section with role names and person names', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        serviceSnapshot: {
          ...mockSnapshot,
          roleAssignments: [
            { roleId: 'r1', roleName: 'Worship Leader', group: 'band', personNames: ['Alice Smith'] },
            { roleId: 'r2', roleName: 'Sound', group: 'tech', personNames: ['Bob Jones', 'Cara Lee'] },
          ],
        },
      }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    expect(wrapper.text()).toContain("Who's Serving")
    expect(wrapper.text()).toContain('Worship Leader')
    expect(wrapper.text()).toContain('Alice Smith')
    expect(wrapper.text()).toContain('Sound')
    expect(wrapper.text()).toContain('Bob Jones, Cara Lee')
  })

  it('omits the Who\'s Serving section when roleAssignments is absent (legacy shares)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ serviceSnapshot: mockSnapshot }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    expect(wrapper.text()).not.toContain("Who's Serving")
  })

  it('omits the Who\'s Serving section when roleAssignments is an empty array', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ serviceSnapshot: { ...mockSnapshot, roleAssignments: [] } }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    expect(wrapper.text()).not.toContain("Who's Serving")
  })

  // ── 43-04: ANNOUNCEMENTS/MISC branches and body rendering ───────────────────
  // T-43-12 — before this plan, the v-else-if chain had no trailing arm, so
  // these two kinds rendered as nothing at all.

  it('renders an ANNOUNCEMENTS slot as its own labelled line, with its body (43-04)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        serviceSnapshot: {
          ...mockSnapshot,
          notes: '',
          slots: [{ kind: 'ANNOUNCEMENTS', position: 0, body: 'Potluck this Sunday after service' }],
        },
      }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    expect(wrapper.text()).toContain('Announcements')
    expect(wrapper.text()).toContain('Potluck this Sunday after service')
  })

  it('renders a MISC slot as its own labelled line, with its body (43-04)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        serviceSnapshot: {
          ...mockSnapshot,
          notes: '',
          slots: [{ kind: 'MISC', position: 0, body: 'Building closes early Monday' }],
        },
      }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    expect(wrapper.text()).toContain('Miscellaneous')
    expect(wrapper.text()).toContain('Building closes early Monday')
  })

  it('preserves an embedded newline in a MESSAGE body (43-04)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        serviceSnapshot: {
          ...mockSnapshot,
          notes: '',
          slots: [{ kind: 'MESSAGE', position: 0, body: 'Line one\nLine two' }],
        },
      }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    // notes is blanked above so this is the only whitespace-pre-wrap paragraph
    // in the DOM — .text() collapses the embedded newline, so read textContent
    // directly to prove the line break survives.
    const bodyEl = wrapper.find('p.whitespace-pre-wrap')
    expect(bodyEl.exists()).toBe(true)
    expect(bodyEl.element.textContent).toBe('Line one\nLine two')
  })

  it('renders a MISC slot with no body as a label-only line, with no not-assigned placeholder (43-04)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        serviceSnapshot: {
          ...mockSnapshot,
          notes: '',
          slots: [{ kind: 'MISC', position: 0 }],
        },
      }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    expect(wrapper.text()).toContain('Miscellaneous')
    expect(wrapper.text()).not.toContain('[not assigned]')
    expect(wrapper.find('p.whitespace-pre-wrap').exists()).toBe(false)
  })

  // ── 260812-izz: notes render for every slot kind on the share link ─────────

  it('renders a SONG slot\'s notes on the share view (260812-izz)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        serviceSnapshot: {
          ...mockSnapshot,
          notes: '',
          slots: [
            {
              kind: 'SONG',
              position: 0,
              requiredVwType: 1,
              songId: 'song-abc',
              songTitle: 'Amazing Grace',
              songKey: 'G',
              notes: 'Sarah leads',
            },
          ],
        },
      }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    expect(wrapper.text()).toContain('Sarah leads')
  })

  it('renders a MESSAGE slot\'s notes on the share view, not just legacy body (260812-izz)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        serviceSnapshot: {
          ...mockSnapshot,
          notes: '',
          slots: [{ kind: 'MESSAGE', position: 0, notes: 'Guest speaker this week' }],
        },
      }),
    })
    const wrapper = await mountShareView()
    await flushPromises()

    expect(wrapper.text()).toContain('Guest speaker this week')
  })
})
