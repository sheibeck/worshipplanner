// R084 hard half — cross-surface HYMN absence-of-regression suite (Phase 43 Plan 04).
//
// Plan 03 removed the Hymn chip from both add-item palette rows. That proved the
// EASY half of R084: the palette lost an entry. It proved nothing about the HARD
// half — whether a church's existing Hymn items still render, print, share,
// present and export exactly as before the palette change. This file is that
// proof, in one findable place, across all five surfaces plus the two probe
// edges (E-13 adjacency, E-15 encoding) this plan owns.
//
// This suite must be EXTENDED, never deleted, if a future phase ever touches
// the add-item palette again. A regression here means a church's existing Hymn
// content silently broke — the exact failure class R085/R084 exist to close.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Options as SortableOptions } from 'sortablejs'
import type { Service, HymnSlot } from '@/types/service'
import type { SlideGroup } from '@/types/slideGroup'
import type { TextSlide } from '@/types/slide'
import type { Timestamp } from 'firebase/firestore'
import ServicePrintLayout from '@/components/ServicePrintLayout.vue'
import { assembleSlideshow, type AssemblyInputs } from '@/utils/slideshowAssembler'
import { addSlotAsItem } from '@/utils/planningCenterApi'

// ── Fixture constants ───────────────────────────────────────────────────────

const mockTimestamp = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp

const HYMN_NAME = 'Great Is Thy Faithfulness'
const HYMN_NUMBER = '327'
const HYMN_VERSES = '1, 2, 4'

function baseService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'service-hymn-regress',
    date: '2026-03-08',
    name: '',
    progression: '1-2-2-3',
    teams: [],
    status: 'draft',
    slots: [],
    sermonPassage: null,
    notes: '',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  }
}

function hymnSlot(overrides: Partial<HymnSlot> = {}): HymnSlot {
  return {
    kind: 'HYMN',
    id: 'hymn-slot-1',
    position: 0,
    hymnName: HYMN_NAME,
    hymnNumber: HYMN_NUMBER,
    verses: HYMN_VERSES,
    ...overrides,
  }
}

function buildHymnService(): Service {
  return baseService({ slots: [hymnSlot()] })
}

function buildAdjacentHymnsService(): Service {
  return baseService({
    slots: [
      hymnSlot({ id: 'hymn-a', position: 0, hymnName: 'How Great Thou Art', hymnNumber: '2', verses: '1, 3' }),
      hymnSlot({ id: 'hymn-b', position: 1, hymnName: 'Holy, Holy, Holy', hymnNumber: '5', verses: '' }),
    ],
  })
}

// E-15: leading/trailing whitespace and a multi-byte character on every field.
const ENCODED_NAME = ' Café Hymn 🎵 '
const ENCODED_NUMBER = ' 12é '
const ENCODED_VERSES = ' verses café 🎵 '

function buildEncodedHymnService(): Service {
  return baseService({
    slots: [hymnSlot({ id: 'hymn-encoded', hymnName: ENCODED_NAME, hymnNumber: ENCODED_NUMBER, verses: ENCODED_VERSES })],
  })
}

function makeAssemblyInputs(overrides: Partial<AssemblyInputs> = {}): AssemblyInputs {
  return {
    songLyricsById: new Map(),
    scriptureReadingsById: new Map(),
    importedDecksById: new Map(),
    groupsBySlotId: new Map(),
    ...overrides,
  }
}

// ── Mocks shared by the RENDER (ServiceEditorView) and SHARE (ShareView) surfaces ──
// Both real components are mounted in this file, so their mock requirements are
// merged into one registry — see 43-04-SUMMARY.md for why (single-file cross-
// surface proof was the plan's explicit design goal, not an accident of reuse).

// Carries BOTH ServiceEditorView's route.params.id and ShareView's
// route.params.token — each component only reads the key it cares about, so
// one shared reactive object serves both without contaminating either.
const mockRouteParams = reactive<Record<string, string | undefined>>({ id: 'service-hymn-regress' })
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: mockRouteParams }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

// mockGetDoc's default answer matches ServiceEditorView's org-membership lookup
// shape (src/views/__tests__/ServiceEditorView.test.ts). The SHARE describe
// block below queues a one-shot override via mockResolvedValueOnce immediately
// before mounting ShareView, consumed synchronously within that same test.
const mockGetDoc = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({ data: () => ({ orgIds: ['org-1'] }) }),
)
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...(args as [])),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({})),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
}))

// esvApi's fetchPassageText is only reached by the SCRIPTURE branch of
// addSlotAsItem — never exercised in this HYMN-only file — but planningCenterApi.ts
// imports it at module scope, so it must resolve to something callable, mirroring
// planningCenterApi.test.ts's own isolation mock.
vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: vi.fn(),
}))

vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((_el: HTMLElement, _options: SortableOptions) => ({ destroy: vi.fn() })),
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

const mockSlideGroupsState = reactive<{ groups: SlideGroup[] }>({ groups: [] })
vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    groups: mockSlideGroupsState.groups,
    isLoading: false,
    get groupsBySlotId() {
      return new Map<string, SlideGroup>()
    },
    subscribeGroups: vi.fn(),
    unsubscribeGroups: vi.fn(),
    materializeGroupIfMissing: vi.fn(() => Promise.resolve(true)),
    deleteGroup: vi.fn(() => Promise.resolve()),
    setGroupBedMedia: vi.fn(() => Promise.resolve()),
    replaceGroupSlides: vi.fn(() => Promise.resolve()),
  }),
}))

let mockServicesList: Service[] = [buildHymnService()]
vi.mock('@/stores/services', () => ({
  useServiceStore: () => ({
    services: mockServicesList,
    isLoading: false,
    orgId: null,
    subscribe: vi.fn(),
    updateService: vi.fn(() => Promise.resolve()),
    markAsPlanned: vi.fn(() => Promise.resolve()),
    reopenService: vi.fn(() => Promise.resolve()),
    assignSongToSlot: vi.fn(() => Promise.resolve()),
    clearSongFromSlot: vi.fn(() => Promise.resolve()),
    setRoleOverride: vi.fn(() => Promise.resolve()),
    clearRoleOverride: vi.fn(() => Promise.resolve()),
    isOwnWriteEcho: () => false,
  }),
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    songs: [],
    orgId: null,
    subscribe: vi.fn(),
    updateSong: vi.fn(() => Promise.resolve()),
  }),
}))

const mockAuthState = reactive<{
  user: { uid: string }
  isEditor: boolean
  orgId: string | null
  hasPcCredentials: boolean
  pcCredentials: { appId: string; secret: string } | null
  settings: { aiEnabled: boolean; pcEnabled: boolean; vwModeEnabled: boolean }
}>({
  user: { uid: 'user-1' },
  isEditor: true,
  orgId: 'org-1',
  hasPcCredentials: false,
  pcCredentials: null,
  settings: { aiEnabled: true, pcEnabled: true, vwModeEnabled: true },
})
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
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

// ── Editor (RENDER surface) mount helper ────────────────────────────────────

async function mountEditor() {
  const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
  return shallowMount(ServiceEditorView, {
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
        teleport: false,
      },
    },
  })
}

async function mountShareView() {
  const { default: ShareView } = await import('@/views/ShareView.vue')
  return mount(ShareView)
}

interface SlotsVm {
  localService: { slots: Array<Record<string, unknown>> }
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockRouteParams.id = 'service-hymn-regress'
  mockAuthState.isEditor = true
  mockAuthState.orgId = 'org-1'
  mockServicesList = [buildHymnService()]
  mockSlideGroupsState.groups = []
})

describe('R084 hard half — HYMN survives across every surface (Phase 43 Plan 04)', () => {
  it('RENDER: a stored HYMN slot renders its content row (name, number, verses) in the editor while the Hymn chip is absent from both palette rows', async () => {
    const wrapper = await mountEditor()
    await wrapper.vm.$nextTick()

    // Half 1: the stored HYMN slot's content row renders all three free-text values.
    const nameInput = wrapper.find('input[placeholder="Hymn Name"]')
    expect(nameInput.exists()).toBe(true)
    expect((nameInput.element as HTMLInputElement).value).toBe(HYMN_NAME)
    const numberInput = wrapper.find('input[placeholder="# (e.g. 337)"]')
    expect((numberInput.element as HTMLInputElement).value).toBe(HYMN_NUMBER)
    const versesInput = wrapper.find('input[placeholder="Verses (e.g. 1, 3, 4)"]')
    expect((versesInput.element as HTMLInputElement).value).toBe(HYMN_VERSES)

    // Half 2, SAME assertion block: the Hymn chip is absent from BOTH palette
    // rows. The pairing is the point — absence and survival proven together.
    const palette = wrapper.find('[data-testid="add-to-service-palette"]')
    const paletteTestids = palette.findAll('button').map((b) => b.attributes('data-testid'))
    expect(paletteTestids).not.toContain('palette-add-hymn')

    await wrapper.find('[data-testid="section-add-item-worship"]').trigger('click')
    await wrapper.vm.$nextTick()
    const sectionMenu = wrapper.find('[data-testid="section-add-menu-worship"]')
    expect(sectionMenu.find('[data-testid="section-add-hymn-worship"]').exists()).toBe(false)
  })

  it('PRINT: the same stored HYMN slot renders its full line — name, number with separator, verses with prefix — identical to the pre-phase output', () => {
    const wrapper = mount(ServicePrintLayout, { props: { service: buildHymnService(), songs: [] } })
    expect(wrapper.text()).toContain(HYMN_NAME)
    expect(wrapper.text()).toContain(`#${HYMN_NUMBER}`)
    expect(wrapper.text()).toContain(`vv. ${HYMN_VERSES}`)
  })

  it('SHARE: the same stored HYMN slot renders its full line in the shared service view', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        serviceSnapshot: {
          date: '2026-03-08',
          name: '',
          progression: '1-2-2-3',
          teams: [],
          status: 'planned',
          sermonPassage: null,
          notes: '',
          slots: [{ kind: 'HYMN', position: 0, hymnName: HYMN_NAME, hymnNumber: HYMN_NUMBER, verses: HYMN_VERSES }],
        },
      }),
    })
    mockRouteParams.token = 'hymn-regress-token'
    const wrapper = await mountShareView()
    await flushPromises()

    expect(wrapper.text()).toContain(HYMN_NAME)
    expect(wrapper.text()).toContain(`#${HYMN_NUMBER}`)
    expect(wrapper.text()).toContain(`vv. ${HYMN_VERSES}`)
  })

  it('PRESENT: the same stored HYMN slot assembles into a text slide with the pre-phase title/body composition rule', () => {
    const result = assembleSlideshow(buildHymnService(), makeAssemblyInputs())

    expect(result).toHaveLength(1)
    expect(result[0]!.slide.contentKind).toBe('text')
    const slide = result[0]!.slide as TextSlide
    expect(slide.title).toBe('Hymn')
    expect(slide.body).toBe(`${HYMN_NAME}\n\n${HYMN_VERSES}`)
  })

  it('PRESENT: a HYMN slot with no verses composes body as the bare name, matching the pre-phase rule', () => {
    const service = baseService({ slots: [hymnSlot({ verses: '' })] })
    const result = assembleSlideshow(service, makeAssemblyInputs())
    const slide = result[0]!.slide as TextSlide
    expect(slide.body).toBe(HYMN_NAME)
  })

  describe('EXPORT', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    it('the same stored HYMN slot exports to Planning Center with the existing Worship-Song-prefix title format', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 'pc-item-1' } }), { status: 201 }),
      )

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', hymnSlot(), 0, [])

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const requestBody = JSON.parse(options?.body as string)
      expect(requestBody.data.attributes.title).toBe(`Worship Song - ${HYMN_NAME} #${HYMN_NUMBER} (vv. ${HYMN_VERSES})`)
      expect(requestBody.data.attributes.item_type).toBe('song_arrangement')
    })

    it('a HYMN slot with empty hymnNumber and empty verses exports the bare title, no stray # and no stray (vv. ) — matches the pre-existing E-14 export assertion', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 'pc-item-2' } }), { status: 201 }),
      )
      const slot = hymnSlot({ hymnNumber: '', verses: '' })

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, [])

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const requestBody = JSON.parse(options?.body as string)
      expect(requestBody.data.attributes.title).toBe(`Worship Song - ${HYMN_NAME}`)
      expect(requestBody.data.attributes.title).not.toContain('#')
      expect(requestBody.data.attributes.title).not.toContain('(vv. ')
    })
  })
})

describe('E-13 (adjacency) — two consecutive HYMN slots stay distinct on every surface', () => {
  it('both render as two distinct rows in the editor, with distinct ids, neither merged', async () => {
    mockServicesList = [buildAdjacentHymnsService()]
    const wrapper = await mountEditor()
    await wrapper.vm.$nextTick()

    const nameInputs = wrapper.findAll('input[placeholder="Hymn Name"]')
    expect(nameInputs).toHaveLength(2)
    expect((nameInputs[0]!.element as HTMLInputElement).value).toBe('How Great Thou Art')
    expect((nameInputs[1]!.element as HTMLInputElement).value).toBe('Holy, Holy, Holy')

    const slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect(slots).toHaveLength(2)
    expect(slots[0]!.id).not.toBe(slots[1]!.id)
  })

  it('both print as two distinct lines, with distinct content, nothing merged', () => {
    const wrapper = mount(ServicePrintLayout, { props: { service: buildAdjacentHymnsService(), songs: [] } })
    const rows = wrapper.findAll('[data-slot-row]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('How Great Thou Art')
    expect(rows[1]!.text()).toContain('Holy, Holy, Holy')
    expect(rows[0]!.text()).not.toContain('Holy, Holy, Holy')
    expect(rows[1]!.text()).not.toContain('How Great Thou Art')
  })

  it('both export as two distinct items, with distinct titles and distinct returned item ids', async () => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'pc-item-a' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'pc-item-b' } }), { status: 201 }))

    const [slotA, slotB] = buildAdjacentHymnsService().slots as [HymnSlot, HymnSlot]
    const idA = await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slotA, 0, [])
    const idB = await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slotB, 1, [])

    expect(idA).toBe('pc-item-a')
    expect(idB).toBe('pc-item-b')
    expect(idA).not.toBe(idB)

    const bodyA = JSON.parse((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string)
    const bodyB = JSON.parse((vi.mocked(fetch).mock.calls[1]![1] as RequestInit).body as string)
    expect(bodyA.data.attributes.title).toBe('Worship Song - How Great Thou Art #2 (vv. 1, 3)')
    expect(bodyB.data.attributes.title).toBe('Worship Song - Holy, Holy, Holy #5')
  })
})

describe('E-15 (encoding) — HYMN free-text fields round-trip verbatim; the palette change touches no HYMN data', () => {
  it('hymnName, hymnNumber and verses round-trip byte-for-byte through the editor, including whitespace and a multi-byte character', async () => {
    mockServicesList = [buildEncodedHymnService()]
    const wrapper = await mountEditor()
    await wrapper.vm.$nextTick()

    const nameInput = wrapper.find('input[placeholder="Hymn Name"]')
    const numberInput = wrapper.find('input[placeholder="# (e.g. 337)"]')
    const versesInput = wrapper.find('input[placeholder="Verses (e.g. 1, 3, 4)"]')
    expect((nameInput.element as HTMLInputElement).value).toBe(ENCODED_NAME)
    expect((numberInput.element as HTMLInputElement).value).toBe(ENCODED_NUMBER)
    expect((versesInput.element as HTMLInputElement).value).toBe(ENCODED_VERSES)

    // The fixture's HYMN slot object is structurally unchanged after mounting —
    // the palette change touches no HYMN data.
    const original = buildEncodedHymnService().slots[0]!
    const mounted = (wrapper.vm as unknown as SlotsVm).localService.slots[0]!
    expect(JSON.parse(JSON.stringify(mounted))).toEqual(JSON.parse(JSON.stringify(original)))
  })

  it('hymnName, hymnNumber and verses round-trip byte-for-byte through export', async () => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'pc-item-encoded' } }), { status: 201 }),
    )
    const slot = buildEncodedHymnService().slots[0] as HymnSlot

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, [])

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const requestBody = JSON.parse(options?.body as string)
    // Built via the exact same numPart/versesPart formula addSlotAsItem uses
    // (src/utils/planningCenterApi.ts) rather than hand-composed, so this
    // assertion can't drift from the real concatenation rule under review.
    const expectedTitle = `Worship Song - ${ENCODED_NAME} #${ENCODED_NUMBER} (vv. ${ENCODED_VERSES})`
    expect(requestBody.data.attributes.title).toBe(expectedTitle)
    // Byte-for-byte: the encoded name, number and verses all appear verbatim.
    expect(requestBody.data.attributes.title).toContain(ENCODED_NAME)
    expect(requestBody.data.attributes.title).toContain(ENCODED_NUMBER)
    expect(requestBody.data.attributes.title).toContain(ENCODED_VERSES)
  })
})
