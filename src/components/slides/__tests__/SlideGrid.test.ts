import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import { ref } from 'vue'
import type { Options as SortableOptions } from 'sortablejs'
import SlideGrid from '../SlideGrid.vue'
import SlideCard from '../SlideCard.vue'
import SlideGroupMusicControl from '../SlideGroupMusicControl.vue'
import SlideDropTarget from '../SlideDropTarget.vue'
import PptxImportModal from '@/components/PptxImportModal.vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import type { EnsureGroupMaterializedResult } from '../slideDisplay'
import { UNSUPPORTED_FILE_MESSAGE } from '../dropRouting'

// --- 25-05: SlideGrid calls the slideGroups store directly (add-slide, drag-reorder) ---
// --- 25-06 Task 2: also calls setGroupBedMedia directly for the group music bar ---
const mockReplaceGroupSlides = vi.fn().mockResolvedValue(undefined)
const mockSetGroupBedMedia = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    replaceGroupSlides: mockReplaceGroupSlides,
    setGroupBedMedia: mockSetGroupBedMedia,
  }),
}))

// --- 25-06 Task 2: SlideGrid must NEVER touch the service store's write path ---
const mockUpdateService = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/services', () => ({
  useServices: () => ({
    updateService: mockUpdateService,
  }),
}))

// --- 25-07 Task 3: importedSlides store — `getDeck` (SlideGrid's own confirmed
// handler, Pattern 4) AND `createDeck` (the real, mounted PptxImportModal's own
// onConfirm call) share this one mocked module. ---
const mockGetDeck = vi.fn()
const mockCreateDeck = vi.fn()
vi.mock('@/stores/importedSlides', () => ({
  useImportedSlides: () => ({
    getDeck: (...args: unknown[]) => mockGetDeck(...args),
    createDeck: (...args: unknown[]) => mockCreateDeck(...args),
  }),
}))

// --- 25-07 Task 3: PptxImportModal's own transitive dependencies — mounted
// FOR REAL inside SlideGrid (not stubbed), so its module graph must resolve
// exactly like `PptxImportModal.test.ts` already mocks it. ---
const mockGenerateImportId = vi.fn<(...args: unknown[]) => string>(() => 'import-abc')
const mockUploadPptx = vi.fn<(...args: unknown[]) => Promise<string>>(() => Promise.resolve(''))
const mockUploadImage = vi.fn<(...args: unknown[]) => Promise<string>>(() => Promise.resolve(''))
const mockResolveImageUrl = vi.fn<(...args: unknown[]) => Promise<string>>(() => Promise.resolve(''))
vi.mock('@/utils/pptxUpload', () => ({
  generateImportId: (...args: unknown[]) => mockGenerateImportId(...args),
  uploadPptx: (...args: unknown[]) => mockUploadPptx(...args),
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
  resolveImageUrl: (...args: unknown[]) => mockResolveImageUrl(...args),
}))
const mockParsePptxCallable = vi.fn(() => Promise.resolve({ data: { slides: [] } }))
vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockParsePptxCallable,
}))
vi.mock('@/firebase', () => ({ functions: {}, storage: {}, db: {} }))

// --- 25-07 Task 3: the shared drop-triggered upload composable (video append,
// audio bed) — mirrors SlideGroupMusicControl.test.ts's mocking pattern. ---
const mediaUploadProgressRef = ref(0)
const mediaUploadErrorRef = ref<string | null>(null)
const mediaUploadIsUploadingRef = ref(false)
const mockUploadMedia = vi.fn<(file: File, orgId: string) => Promise<string>>()
const mockResetMediaUpload = vi.fn(() => {
  mediaUploadProgressRef.value = 0
  mediaUploadErrorRef.value = null
  mediaUploadIsUploadingRef.value = false
})
vi.mock('@/composables/useMediaUpload', () => ({
  useMediaUpload: () => ({
    progress: mediaUploadProgressRef,
    error: mediaUploadErrorRef,
    isUploading: mediaUploadIsUploadingRef,
    uploadMedia: (file: File, orgId: string) => mockUploadMedia(file, orgId),
    reset: mockResetMediaUpload,
  }),
}))

// --- 25-05 Task 3: capture the options passed to Sortable.create so onEnd can be invoked directly ---
// --- 29-01: widened to a many-instance capture (array of { el, options }) so a
// test can read the REAL container SlideGrid rendered (the element the mock
// captured, which holds the drop tile as a non-.slide-card sibling) rather than
// a synthetic fixture with no sibling at all. `capturedSortableOptions` (the
// single most-recent options object) is kept working unchanged for the
// existing Task-3 drag tests below, which never needed the container itself.
interface SortableCapture {
  el: HTMLElement
  options: SortableOptions
}
let sortableCaptures: SortableCapture[] = []
let capturedSortableOptions: SortableOptions | undefined
const mockSortableDestroy = vi.fn()
vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((el: HTMLElement, options: SortableOptions) => {
      sortableCaptures.push({ el, options })
      capturedSortableOptions = options
      return { destroy: mockSortableDestroy }
    }),
  },
}))

function latestCapture(): SortableCapture | undefined {
  return sortableCaptures[sortableCaptures.length - 1]
}

/**
 * Reads the REAL container SlideGrid rendered (the element the mock
 * captured, which holds the drop tile as a non-`.slide-card` sibling) and
 * derives BOTH SortableJS index pairs from it — never a hand-passed index.
 * `oldIndex`/`newIndex` count every element child (the tile included);
 * `oldDraggableIndex`/`newDraggableIndex` count only `.slide-card` children
 * (29-01, replaces the old `simulateDragEnd`, whose synthetic four-bare-div
 * parent had no non-card sibling at all — exactly why it could go green with
 * the bug present).
 */
function simulateCardDrag(fromPos: number, toPos: number) {
  const capture = latestCapture()
  if (!capture) throw new Error('simulateCardDrag: no Sortable capture resolved')
  const container = capture.el
  const cardEls = Array.from(container.children).filter((c) =>
    (c as HTMLElement).classList.contains('slide-card'),
  ) as HTMLElement[]
  const item = cardEls[fromPos]
  if (!item) throw new Error(`simulateCardDrag: no .slide-card at position ${fromPos}`)

  const elementIndex = (node: HTMLElement) => Array.from(container.children).indexOf(node)
  const draggableIndex = (node: HTMLElement) => cardEls.indexOf(node)

  const oldIndex = elementIndex(item)
  const oldDraggableIndex = draggableIndex(item)

  // Destination cards EXCLUDING the dragged card itself — `toPos` indexes
  // into this post-removal ordering, matching the splice-out/splice-in
  // mental model the handler itself uses.
  const cardsExcludingSelf = cardEls.filter((c) => c !== item)
  const destAnchor = cardsExcludingSelf[toPos] ?? null

  let newIndex: number
  let newDraggableIndex: number
  if (destAnchor) {
    newIndex = elementIndex(destAnchor)
    newDraggableIndex = draggableIndex(destAnchor)
  } else if (cardsExcludingSelf.length > 0) {
    const lastEl = cardsExcludingSelf[cardsExcludingSelf.length - 1]!
    newIndex = elementIndex(lastEl) + 1
    newDraggableIndex = draggableIndex(lastEl) + 1
  } else {
    // Only card in the group — nowhere else to land.
    newIndex = oldIndex
    newDraggableIndex = oldDraggableIndex
  }

  return capture.options.onEnd!({
    oldIndex,
    newIndex,
    oldDraggableIndex,
    newDraggableIndex,
    item,
    from: container,
    to: container,
  } as never)
}

function makeFile(name: string, type: string): File {
  return new File(['bytes'], name, { type })
}

// PptxImportModal is mounted FOR REAL inside SlideGrid (25-07 Task 3) and
// teleports to <body> — auto-unmount is required so each test's teleported
// content is cleaned out of the shared document.body before the next mounts
// (established convention, see PptxImportModal.test.ts).
enableAutoUnmount(afterEach)

function body() {
  return new DOMWrapper(document.body)
}

function makeSlot(overrides: Partial<ServiceSlot> & { kind: ServiceSlot['kind']; id: string; position: number }): ServiceSlot {
  return { ...overrides } as ServiceSlot
}

function makeAssembled(slotIndex: number, id: string, slotKind: AssembledSlide['slotKind'] = 'PRAYER'): AssembledSlide {
  return {
    slide: { id, position: 0, contentKind: 'text', body: `body-${id}` },
    slotIndex,
    slotKind,
    sourceId: null,
  } as AssembledSlide
}

function makeGroup(overrides: Partial<SlideGroup> & { slides: GroupSlideEntry[] }): SlideGroup {
  return {
    id: 'slot-1',
    slotId: 'slot-1',
    serviceId: 'service-1',
    createdAt: {} as never,
    updatedAt: {} as never,
    ...overrides,
  }
}

function mountGrid(props: {
  selectedSlot: ServiceSlot | null
  slotArrayIndex?: number
  position?: number
  totalPlanItems?: number
  assembledSlideshow?: AssembledSlide[]
  selectedSlideId?: string | null
  group?: SlideGroup | null
  isEditor?: boolean
  orgId?: string
  serviceId?: string
  ensureGroupMaterialized?: (slotId: string) => Promise<EnsureGroupMaterializedResult | undefined>
}) {
  return mount(SlideGrid, {
    props: {
      selectedSlot: props.selectedSlot,
      slotArrayIndex: props.slotArrayIndex ?? 0,
      position: props.position ?? 1,
      totalPlanItems: props.totalPlanItems ?? 1,
      assembledSlideshow: props.assembledSlideshow ?? [],
      selectedSlideId: props.selectedSlideId ?? null,
      group: props.group ?? null,
      isEditor: props.isEditor ?? true,
      orgId: props.orgId ?? 'org-1',
      serviceId: props.serviceId ?? 'service-1',
      ensureGroupMaterialized: props.ensureGroupMaterialized ?? vi.fn().mockResolvedValue(undefined),
    },
  })
}

beforeEach(() => {
  mockReplaceGroupSlides.mockClear()
  mockSetGroupBedMedia.mockClear()
  mockUpdateService.mockClear()
  mockSortableDestroy.mockClear()
  capturedSortableOptions = undefined
  sortableCaptures = []

  mockGetDeck.mockReset()
  mockCreateDeck.mockReset()
  mockGenerateImportId.mockReturnValue('import-abc')
  mockUploadPptx.mockReset().mockResolvedValue('orgs/org-1/pptx-imports/import-abc/source.pptx')
  mockUploadImage.mockReset().mockImplementation((...args: unknown[]) => {
    const [orgId, importId, , index] = args as [string, string, File, number]
    return Promise.resolve(`orgs/${orgId}/pptx-imports/${importId}/images/${index}.png`)
  })
  mockResolveImageUrl.mockReset().mockImplementation((...args: unknown[]) => {
    const [path] = args as [string]
    return Promise.resolve(`https://example.com/${path}`)
  })
  mockParsePptxCallable.mockReset().mockResolvedValue({ data: { slides: [] } })

  mockUploadMedia.mockReset()
  mockResetMediaUpload.mockClear()
  mediaUploadProgressRef.value = 0
  mediaUploadErrorRef.value = null
  mediaUploadIsUploadingRef.value = false
})

describe('SlideGrid', () => {
  it('renders one card per assembled slide matching the selected slot array index, and none for other slots', () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const assembledSlideshow = [
      makeAssembled(1, 'other-1'),
      makeAssembled(0, 'mine-1'),
      makeAssembled(0, 'mine-2'),
      makeAssembled(2, 'other-2'),
    ]
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, assembledSlideshow })
    const cards = wrapper.findAllComponents(SlideCard)
    expect(cards).toHaveLength(2)
    expect(cards.map((c) => c.props('assembledSlide').slide.id)).toEqual(['mine-1', 'mine-2'])
  })

  it('renders cards even when the group document has not materialized (fallback path)', () => {
    const slot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'Grace', songKey: null, requiredVwType: 1 } as never)
    const assembledSlideshow = [makeAssembled(0, 'fallback-1'), makeAssembled(0, 'fallback-2')]
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, assembledSlideshow })
    expect(wrapper.findAllComponents(SlideCard)).toHaveLength(2)
  })

  it('numbers cards from one within the group even when the group is not first in the service', () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-3', position: 3 })
    const assembledSlideshow = [makeAssembled(3, 'c1'), makeAssembled(3, 'c2'), makeAssembled(3, 'c3')]
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 3, assembledSlideshow })
    const cards = wrapper.findAllComponents(SlideCard)
    expect(cards.map((c) => c.props('number'))).toEqual([1, 2, 3])
  })

  it('renders the header title, position line with "follows plan" phrasing, and reading-order line', () => {
    const slot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 2, songId: 's1', songTitle: 'This Is Our God', songKey: null, requiredVwType: 1 } as never)
    const assembledSlideshow = [makeAssembled(0, 'c1'), makeAssembled(0, 'c2')]
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, position: 3, totalPlanItems: 9, assembledSlideshow })
    expect(wrapper.get('[data-testid="slide-grid-title"]').text()).toBe('Song — This Is Our God')
    const positionLine = wrapper.get('[data-testid="slide-grid-position"]').text()
    expect(positionLine).toContain('group 3 of 9')
    expect(positionLine).toContain('follows plan')
    expect(wrapper.get('[data-testid="slide-grid-reading-order"]').text()).toContain('Plays 1 → 2')
  })

  it('omits the reading-order line and renders the empty state when there are zero cards', () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, assembledSlideshow: [] })
    expect(wrapper.find('[data-testid="slide-grid-reading-order"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="slide-grid-empty-state"]').text()).toContain('No slides in this group yet')
    expect(wrapper.text()).toContain('Add a slide, or drop a file below.')
    expect(wrapper.findAllComponents(SlideCard)).toHaveLength(0)
  })

  it('renders no reconciliation notice or review affordance for any group state (R048)', () => {
    const slot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'X', songKey: null, requiredVwType: 1 } as never)
    const group = makeGroup({ slides: [] })
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, group })
    expect(wrapper.find('[data-testid="slide-grid-reconciliation-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slide-grid-reconciliation-review"]').exists()).toBe(false)
  })

  it('marks the card matching the selected slide id as selected, and clicking another emits its id', async () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const assembledSlideshow = [makeAssembled(0, 'c1'), makeAssembled(0, 'c2')]
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, assembledSlideshow, selectedSlideId: 'c1' })
    const cards = wrapper.findAllComponents(SlideCard)
    expect(cards[0]!.props('selected')).toBe(true)
    expect(cards[1]!.props('selected')).toBe(false)
    await cards[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['c2']])
  })

  it('renders no view-mode toggle control', () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 0 })
    const text = wrapper.text()
    expect(text).not.toContain('Grid')
    expect(text).not.toContain('List')
  })

  // --- Task 2: ＋ Add slide, appended at the end of the selected group (D-16) ---
  describe('add-slide control (Task 2)', () => {
    it('renders the add-slide control for an editor and not for a viewer', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const editorWrapper = mountGrid({ selectedSlot: slot, isEditor: true })
      const viewerWrapper = mountGrid({ selectedSlot: slot, isEditor: false })
      expect(editorWrapper.find('[data-testid="slide-grid-add-slide"]').exists()).toBe(true)
      expect(viewerWrapper.find('[data-testid="slide-grid-add-slide"]').exists()).toBe(false)
    })

    it('appends exactly one new entry, sorted-then-appended, with every order renumbered contiguously from zero (R050)', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      // Non-contiguous existing orders (0, 2) — the R050 fix renumbers the
      // WHOLE payload to its array index, not just the newly appended entry,
      // so array order and `order` values can never drift apart again.
      const existingEntries: GroupSlideEntry[] = [
        { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
        { id: 'e2', order: 2, sourceRef: { kind: 'text' } },
      ]
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({
        entries: existingEntries,
        sourceSignature: 'sig-abc',
      })
      const wrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })
      await wrapper.get('[data-testid="slide-grid-add-slide"]').trigger('click')
      await Promise.resolve()
      await Promise.resolve()

      expect(ensureGroupMaterialized).toHaveBeenCalledWith('slot-1')
      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [orgIdArg, slotIdArg, slidesArg, sigArg, baseSlidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      expect(orgIdArg).toBe('org-1')
      expect(slotIdArg).toBe('slot-1')
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides).toHaveLength(3)
      // `appendToGroup` copies every entry (even unchanged ones) while
      // renumbering, so identity is no longer preserved — compare by value.
      expect(slides.map((e) => e.id)).toEqual(['e1', 'e2', slides[2]!.id])
      expect(slides.map((e) => e.order)).toEqual([0, 1, 2])
      expect(sigArg).toBe('sig-abc')
      // CR-02: the pre-append snapshot (unsorted, original reference) is
      // passed through as `baseSlides` unchanged, so the store can detect
      // and merge a concurrent write instead of silently overwriting it —
      // see `replaceGroupSlides`'s doc comment.
      expect(baseSlidesArg).toBe(existingEntries)
    })

    it('computes order zero for an empty group', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({ entries: [], sourceSignature: undefined })
      const wrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })
      await wrapper.get('[data-testid="slide-grid-add-slide"]').trigger('click')
      await Promise.resolve()
      await Promise.resolve()

      const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides).toHaveLength(1)
      expect(slides[0]!.order).toBe(0)
    })

    it("gives the new entry its own authored text source ref", async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({ entries: [], sourceSignature: undefined })
      const wrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })
      await wrapper.get('[data-testid="slide-grid-add-slide"]').trigger('click')
      await Promise.resolve()
      await Promise.resolve()

      const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides[0]!.sourceRef.kind).toBe('text')
      expect(slides[0]!.id).toBeTruthy()
      if (slides[0]!.sourceRef.kind === 'text') {
        expect(slides[0]!.sourceRef.body).toBeDefined()
      }
    })

    it('awaits the on-demand materializer before calling the slide-replacing action when the plan item has no group yet', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const callOrder: string[] = []
      const ensureGroupMaterialized = vi.fn().mockImplementation(async () => {
        callOrder.push('materialize')
        return { entries: [], sourceSignature: undefined }
      })
      mockReplaceGroupSlides.mockImplementationOnce(async () => {
        callOrder.push('replace')
      })
      const wrapper = mountGrid({ selectedSlot: slot, group: null, ensureGroupMaterialized })
      await wrapper.get('[data-testid="slide-grid-add-slide"]').trigger('click')
      await Promise.resolve()
      await Promise.resolve()

      expect(callOrder).toEqual(['materialize', 'replace'])
    })

    it('does not throw and leaves the grid unchanged when the write rejects', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const assembledSlideshow = [makeAssembled(0, 'c1')]
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({ entries: [], sourceSignature: undefined })
      mockReplaceGroupSlides.mockRejectedValueOnce(new Error('write failed'))
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, ensureGroupMaterialized })

      await expect(
        wrapper.get('[data-testid="slide-grid-add-slide"]').trigger('click'),
      ).resolves.not.toThrow()
      await Promise.resolve()
      await Promise.resolve()

      expect(wrapper.findAllComponents(SlideCard)).toHaveLength(1)
    })
  })

  // --- Task 3: drag-reorder within the selected group (D-11) ---
  describe('drag-reorder (Task 3)', () => {
    it('renders the grip for an editor with a stored group and does not render it for a viewer', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }] })
      const assembledSlideshow = [makeAssembled(0, 'e1')]
      const editorWrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })
      const viewerWrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: false })
      expect(editorWrapper.find('[data-testid="slide-card-drag-handle"]').exists()).toBe(true)
      expect(viewerWrapper.find('[data-testid="slide-card-drag-handle"]').exists()).toBe(false)
    })

    it('does not render the grip when the group has no stored document', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const assembledSlideshow = [makeAssembled(0, 'e1')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group: null, isEditor: true })
      expect(wrapper.find('[data-testid="slide-card-drag-handle"]').exists()).toBe(false)
    })

    it('clicking the grip does not emit card selection, while clicking the card body does', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }] })
      const assembledSlideshow = [makeAssembled(0, 'e1')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })

      await wrapper.get('[data-testid="slide-card-drag-handle"]').trigger('click')
      expect(wrapper.emitted('select')).toBeUndefined()

      await wrapper.get('[data-testid="slide-card-e1"]').trigger('click')
      expect(wrapper.emitted('select')).toEqual([['e1']])
    })

    it('persists a drag end in new entry order, renumbered from zero, with the signature passed through unchanged', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({
        sourceSignature: 'sig-xyz',
        slides: [
          { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
          { id: 'e2', order: 1, sourceRef: { kind: 'text' } },
          { id: 'e3', order: 2, sourceRef: { kind: 'text' } },
        ],
      })
      const assembledSlideshow = [makeAssembled(0, 'e1'), makeAssembled(0, 'e2'), makeAssembled(0, 'e3')]
      mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })
      await Promise.resolve()
      await Promise.resolve()

      expect(capturedSortableOptions).toBeDefined()
      await simulateCardDrag(0, 2)
      await Promise.resolve()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [orgIdArg, slotIdArg, slidesArg, sigArg, baseSlidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      expect(orgIdArg).toBe('org-1')
      expect(slotIdArg).toBe('slot-1')
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides.map((e) => e.id)).toEqual(['e2', 'e3', 'e1'])
      expect(slides.map((e) => e.order)).toEqual([0, 1, 2])
      expect(sigArg).toBe('sig-xyz')
      // CR-02: the pre-reorder group snapshot is passed through as
      // `baseSlides` so a concurrent append landing between this read and
      // this write is detected and merged, not silently overwritten. (Vue
      // wraps the prop in a reactive proxy, so this compares by value, not
      // reference.)
      expect(baseSlidesArg).toEqual(group.slides)
    })

    it('issues no write when the drag ends at its starting index', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }] })
      const assembledSlideshow = [makeAssembled(0, 'e1')]
      mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })
      await Promise.resolve()
      await Promise.resolve()

      await simulateCardDrag(0, 0)
      await Promise.resolve()

      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    })

    it('gives the grip an accessible name', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }] })
      const assembledSlideshow = [makeAssembled(0, 'e1')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })
      expect(wrapper.get('[data-testid="slide-card-drag-handle"]').attributes('aria-label')).toBe('Reorder slide')
    })
  })

  // --- 25-06 Task 2: group music bar mount + bed persistence ---
  describe('group music bar (25-06 Task 2)', () => {
    it('renders the music control between the header and the card grid, receiving the bed audio and slide count', () => {
      const slot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'X', songKey: null, requiredVwType: 1 } as never)
      const group = makeGroup({
        bedAudioUrl: 'https://storage.example.com/pad.mp3',
        slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }],
      })
      const assembledSlideshow = [makeAssembled(0, 'e1'), makeAssembled(0, 'e2')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group })

      const html = wrapper.html()
      const headerIndex = html.indexOf('slide-grid-title')
      const musicIndex = html.indexOf('slide-group-music-control')
      const cardsIndex = html.indexOf('slide-grid-cards')
      expect(headerIndex).toBeGreaterThan(-1)
      expect(musicIndex).toBeGreaterThan(headerIndex)
      expect(cardsIndex).toBeGreaterThan(musicIndex)

      const musicControl = wrapper.findComponent(SlideGroupMusicControl)
      expect(musicControl.props('audioUrl')).toBe('https://storage.example.com/pad.mp3')
      expect(musicControl.props('slideCount')).toBe(2)
    })

    it('writes an emitted URL to the selected group bed via the scoped write, with the selected slot id', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot, serviceId: 'service-9' })

      await wrapper.findComponent(SlideGroupMusicControl).vm.$emit('attach', 'https://storage.example.com/new.mp3')
      await Promise.resolve()

      expect(mockSetGroupBedMedia).toHaveBeenCalledTimes(1)
      expect(mockSetGroupBedMedia).toHaveBeenCalledWith('org-1', 'slot-1', {
        serviceId: 'service-9',
        bedAudioUrl: 'https://storage.example.com/new.mp3',
      })
    })

    it('writes an emitted clear using the explicit clear flag rather than an undefined URL', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot, serviceId: 'service-9' })

      await wrapper.findComponent(SlideGroupMusicControl).vm.$emit('remove')
      await Promise.resolve()

      expect(mockSetGroupBedMedia).toHaveBeenCalledTimes(1)
      const [, , patch] = mockSetGroupBedMedia.mock.calls[0]!
      expect(patch).toEqual({ serviceId: 'service-9', clearAudio: true })
      expect('bedAudioUrl' in patch).toBe(false)
    })

    it('attaching music to a plan item with no group document yet still writes, with no materialization call made', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({ entries: [], sourceSignature: undefined })
      const wrapper = mountGrid({ selectedSlot: slot, group: null, ensureGroupMaterialized })

      await wrapper.findComponent(SlideGroupMusicControl).vm.$emit('attach', 'https://storage.example.com/new.mp3')
      await Promise.resolve()

      expect(mockSetGroupBedMedia).toHaveBeenCalledTimes(1)
      expect(ensureGroupMaterialized).not.toHaveBeenCalled()
    })

    it('switching the selected plan item switches which bed audio the control receives', async () => {
      const slotA = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const groupA = makeGroup({ id: 'slot-1', slotId: 'slot-1', bedAudioUrl: 'https://storage.example.com/a.mp3', slides: [] })
      const wrapper = mountGrid({ selectedSlot: slotA, group: groupA })
      expect(wrapper.findComponent(SlideGroupMusicControl).props('audioUrl')).toBe('https://storage.example.com/a.mp3')

      const slotB = makeSlot({ kind: 'PRAYER', id: 'slot-2', position: 1 })
      const groupB = makeGroup({ id: 'slot-2', slotId: 'slot-2', bedAudioUrl: 'https://storage.example.com/b.mp3', slides: [] })
      await wrapper.setProps({ selectedSlot: slotB, group: groupB })

      expect(wrapper.findComponent(SlideGroupMusicControl).props('audioUrl')).toBe('https://storage.example.com/b.mp3')
    })

    it('never calls the service store update action from either the attach or the remove path', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot })

      await wrapper.findComponent(SlideGroupMusicControl).vm.$emit('attach', 'https://storage.example.com/new.mp3')
      await wrapper.findComponent(SlideGroupMusicControl).vm.$emit('remove')
      await Promise.resolve()

      expect(mockUpdateService).not.toHaveBeenCalled()
    })

    it('does not throw when the bed write rejects', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      mockSetGroupBedMedia.mockRejectedValueOnce(new Error('write failed'))
      const wrapper = mountGrid({ selectedSlot: slot })

      expect(() => {
        wrapper.findComponent(SlideGroupMusicControl).vm.$emit('attach', 'https://storage.example.com/new.mp3')
      }).not.toThrow()
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  // --- 25-07 Task 2: drop tile placement, grid-wide highlight, viewer gating ---
  describe('drop tile and grid-wide dragover highlight (25-07 Task 2)', () => {
    it('renders the drop tile as the last item in the grid at zero slides and at several slides', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const zeroWrapper = mountGrid({ selectedSlot: slot, assembledSlideshow: [] })
      expect(zeroWrapper.find('[data-testid="slide-grid-empty-state"]').exists()).toBe(true)
      expect(zeroWrapper.findComponent(SlideDropTarget).exists()).toBe(true)

      const assembledSlideshow = [makeAssembled(0, 'c1'), makeAssembled(0, 'c2')]
      const populatedWrapper = mountGrid({ selectedSlot: slot, assembledSlideshow })
      const cardsContainer = populatedWrapper.get('[data-testid="slide-grid-cards"]')
      const children = Array.from(cardsContainer.element.children)
      expect(children[children.length - 1]?.getAttribute('data-testid')).toBe('slide-drop-target')
    })

    it('does not give the tile the class SortableJS is scoped to', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const assembledSlideshow = [makeAssembled(0, 'c1')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow })
      const tile = wrapper.get('[data-testid="slide-drop-target"]')
      expect(tile.classes()).not.toContain('slide-card')
    })

    it('is absent for a viewer, and a drop on the container does nothing', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot, isEditor: false })
      expect(wrapper.find('[data-testid="slide-drop-target"]').exists()).toBe(false)

      const file = makeFile('deck.pptx', '')
      await wrapper.get('[data-testid="slide-grid-drop-area"]').trigger('drop', { dataTransfer: { files: [file] } })
      await flushPromises()

      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
      expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
    })

    it('applies the highlight on a file-carrying dragenter, and clears it on dragleave', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot })
      const dropArea = wrapper.get('[data-testid="slide-grid-drop-area"]')

      await dropArea.trigger('dragenter', { dataTransfer: { types: ['Files'] } })
      expect(dropArea.classes()).toContain('border-indigo-500/50')

      await dropArea.trigger('dragleave', { dataTransfer: { types: ['Files'] } })
      expect(dropArea.classes()).not.toContain('border-indigo-500/50')
    })

    it('clears the highlight on drop', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot })
      const dropArea = wrapper.get('[data-testid="slide-grid-drop-area"]')

      await dropArea.trigger('dragenter', { dataTransfer: { types: ['Files'] } })
      expect(dropArea.classes()).toContain('border-indigo-500/50')

      await dropArea.trigger('drop', { dataTransfer: { files: [], types: ['Files'] } })
      expect(dropArea.classes()).not.toContain('border-indigo-500/50')
    })

    it('does not apply the highlight when the drag carries no files', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot })
      const dropArea = wrapper.get('[data-testid="slide-grid-drop-area"]')

      await dropArea.trigger('dragenter', { dataTransfer: { types: ['text/plain'] } })
      expect(dropArea.classes()).not.toContain('border-indigo-500/50')
    })

    it('does not flicker the highlight off from a child-element dragleave while still over the container (depth counter)', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const assembledSlideshow = [makeAssembled(0, 'c1')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow })
      const dropArea = wrapper.get('[data-testid="slide-grid-drop-area"]')

      // Entering the container, then entering a child (nested dragenter),
      // then leaving the child (nested dragleave) should NOT clear the
      // highlight while the pointer is still over the container overall.
      await dropArea.trigger('dragenter', { dataTransfer: { types: ['Files'] } })
      await dropArea.trigger('dragenter', { dataTransfer: { types: ['Files'] } })
      await dropArea.trigger('dragleave', { dataTransfer: { types: ['Files'] } })
      expect(dropArea.classes()).toContain('border-indigo-500/50')

      await dropArea.trigger('dragleave', { dataTransfer: { types: ['Files'] } })
      expect(dropArea.classes()).not.toContain('border-indigo-500/50')
    })
  })

  // --- 25-07 Task 2/3: dropRouting integration — tile and container routing ---
  describe('drop routing — tile and whole-grid container (25-07 Task 2/3)', () => {
    it('dropping the same file set on the tile and on the container produces identical routing', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      mockUploadMedia.mockResolvedValue('https://storage.example.com/clip.mp4')
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({ entries: [], sourceSignature: undefined })

      const file = makeFile('clip.mp4', 'video/mp4')

      const tileWrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })
      await tileWrapper.findComponent(SlideDropTarget).vm.$emit('drop', [file])
      await flushPromises()

      const containerWrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })
      await containerWrapper.get('[data-testid="slide-grid-drop-area"]').trigger('drop', { dataTransfer: { files: [file] } })
      await flushPromises()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(2)
      const tileCallEntries = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
      const containerCallEntries = mockReplaceGroupSlides.mock.calls[1]![2] as GroupSlideEntry[]
      expect(tileCallEntries[0]!.sourceRef).toEqual(containerCallEntries[0]!.sourceRef)
    })

    it('drops an unsupported file: the rejection message renders and no upload is attempted', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot })
      const file = makeFile('notes.txt', 'text/plain')

      await wrapper.get('[data-testid="slide-grid-drop-area"]').trigger('drop', { dataTransfer: { files: [file] } })
      await flushPromises()

      expect(wrapper.get('[data-testid="slide-grid-rejection-notice"]').text()).toBe(UNSUPPORTED_FILE_MESSAGE)
      expect(mockUploadMedia).not.toHaveBeenCalled()
      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
      expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
    })
  })

  // --- 25-07 Task 3: the group header's import action ---
  describe('import action and PPTX/image append (25-07 Task 3)', () => {
    it('renders the import action for an editor, not for a viewer, and opens the modal on click', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const editorWrapper = mountGrid({ selectedSlot: slot, isEditor: true })
      const viewerWrapper = mountGrid({ selectedSlot: slot, isEditor: false })
      expect(editorWrapper.find('[data-testid="slide-grid-import"]').exists()).toBe(true)
      expect(viewerWrapper.find('[data-testid="slide-grid-import"]').exists()).toBe(false)

      expect(editorWrapper.findComponent(PptxImportModal).props('open')).toBe(false)
      await editorWrapper.get('[data-testid="slide-grid-import"]').trigger('click')
      expect(editorWrapper.findComponent(PptxImportModal).props('open')).toBe(true)
    })

    it("passes the selected plan item's own section to the modal, falling back to the first service section when absent", () => {
      const withSection = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0, section: 'message' } as never)
      const wrapperWithSection = mountGrid({ selectedSlot: withSection })
      expect(wrapperWithSection.findComponent(PptxImportModal).props('section')).toBe('message')

      const withoutSection = makeSlot({ kind: 'PRAYER', id: 'slot-2', position: 0 })
      const wrapperWithoutSection = mountGrid({ selectedSlot: withoutSection })
      expect(wrapperWithoutSection.findComponent(PptxImportModal).props('section')).toBe('pre-service')
    })

    it('appends one entry per deck slide, after the existing entries, at the end of the selected group — no new plan item or service-store write', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const existingEntries: GroupSlideEntry[] = [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }]
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({
        entries: existingEntries,
        sourceSignature: 'sig-abc',
      })
      mockGetDeck.mockResolvedValue({
        id: 'deck-1',
        sourceFileName: 'deck.pptx',
        section: 'pre-service',
        slides: [
          { id: 'inner-1', position: 0, contentKind: 'text', body: 'First' },
          { id: 'inner-2', position: 1, contentKind: 'text', body: 'Second' },
        ],
      })
      const wrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })

      await wrapper.findComponent(PptxImportModal).vm.$emit('confirmed', { importId: 'deck-1', section: 'pre-service' })
      await flushPromises()

      expect(mockGetDeck).toHaveBeenCalledWith('org-1', 'deck-1')
      expect(ensureGroupMaterialized).toHaveBeenCalledWith('slot-1')
      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [orgIdArg, slotIdArg, slidesArg, sigArg] = mockReplaceGroupSlides.mock.calls[0]!
      expect(orgIdArg).toBe('org-1')
      expect(slotIdArg).toBe('slot-1')
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides).toHaveLength(3)
      // `appendToGroup` copies every entry while renumbering (R050) — the
      // reference is no longer preserved, compare by value.
      expect(slides[0]).toEqual(existingEntries[0])
      expect(slides[1]!.sourceRef).toEqual({ kind: 'imported', importId: 'deck-1', innerSlideId: 'inner-1' })
      expect(slides[1]!.order).toBe(1)
      expect(slides[2]!.sourceRef).toEqual({ kind: 'imported', importId: 'deck-1', innerSlideId: 'inner-2' })
      expect(slides[2]!.order).toBe(2)
      expect(sigArg).toBe('sig-abc')
      expect(mockUpdateService).not.toHaveBeenCalled()
    })

    it('closes the modal on confirmed', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      mockGetDeck.mockResolvedValue({ id: 'deck-1', sourceFileName: 'deck.pptx', section: 'pre-service', slides: [] })
      const wrapper = mountGrid({ selectedSlot: slot })
      await wrapper.get('[data-testid="slide-grid-import"]').trigger('click')
      expect(wrapper.findComponent(PptxImportModal).props('open')).toBe(true)

      await wrapper.findComponent(PptxImportModal).vm.$emit('confirmed', { importId: 'deck-1', section: 'pre-service' })
      await flushPromises()

      expect(wrapper.findComponent(PptxImportModal).props('open')).toBe(false)
    })

    it('a dropped PPTX opens the modal and hands it the file via the exposed entry point', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot })
      const file = makeFile('deck.pptx', '')

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [file])
      await flushPromises()

      expect(wrapper.findComponent(PptxImportModal).props('open')).toBe(true)
      expect(mockUploadPptx).toHaveBeenCalledWith('org-1', 'import-abc', file, expect.any(Function))
      expect(body().find('[data-testid="step-preview"]').exists()).toBe(true)
    })

    it('a dropped image (no PPTX in the drop) opens the modal and hands it the image via the exposed entry point', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot })
      const file = makeFile('photo.png', 'image/png')

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [file])
      await flushPromises()

      expect(wrapper.findComponent(PptxImportModal).props('open')).toBe(true)
      expect(mockUploadImage).toHaveBeenCalledWith('org-1', 'import-abc', file, 0)
    })
  })

  // --- 25-07 Task 3: dropped video appends a slide (D-17) ---
  describe('video drop appends a slide, never the bed (25-07 Task 3, D-17)', () => {
    it('appends one video entry carrying the uploaded URL and file name', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({ entries: [], sourceSignature: undefined })
      mockUploadMedia.mockResolvedValueOnce('https://storage.example.com/clip.mp4')
      const wrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })
      const file = makeFile('clip.mp4', 'video/mp4')

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [file])
      await flushPromises()

      expect(mockUploadMedia).toHaveBeenCalledWith(file, 'org-1')
      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides).toHaveLength(1)
      expect(slides[0]!.sourceRef).toEqual({
        kind: 'video',
        videoSrc: 'https://storage.example.com/clip.mp4',
        originalFileName: 'clip.mp4',
      })
      expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
    })

    it('appends several dropped videos in drop order', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({ entries: [], sourceSignature: undefined })
      mockUploadMedia
        .mockResolvedValueOnce('https://storage.example.com/1.mp4')
        .mockResolvedValueOnce('https://storage.example.com/2.mp4')
      const wrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })
      const file1 = makeFile('1.mp4', 'video/mp4')
      const file2 = makeFile('2.mp4', 'video/mp4')

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [file1, file2])
      await flushPromises()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides).toHaveLength(2)
      expect(slides[0]!.order).toBe(0)
      expect(slides[1]!.order).toBe(1)
      if (slides[0]!.sourceRef.kind === 'video') expect(slides[0]!.sourceRef.originalFileName).toBe('1.mp4')
      if (slides[1]!.sourceRef.kind === 'video') expect(slides[1]!.sourceRef.originalFileName).toBe('2.mp4')
    })

    it('renumbers all entries contiguously after appending, regardless of gaps in existing order values (R050)', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const existingEntries: GroupSlideEntry[] = [
        { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
        { id: 'e2', order: 4, sourceRef: { kind: 'text' } },
      ]
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({ entries: existingEntries, sourceSignature: 'sig-1' })
      mockUploadMedia.mockResolvedValueOnce('https://storage.example.com/clip.mp4')
      const wrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [makeFile('clip.mp4', 'video/mp4')])
      await flushPromises()

      const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides).toHaveLength(3)
      expect(slides.map((e) => e.order)).toEqual([0, 1, 2])
    })

    it('awaits the on-demand materializer before appending when the plan item has no group yet', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const callOrder: string[] = []
      const ensureGroupMaterialized = vi.fn().mockImplementation(async () => {
        callOrder.push('materialize')
        return { entries: [], sourceSignature: undefined }
      })
      mockUploadMedia.mockImplementationOnce(async () => {
        callOrder.push('upload')
        return 'https://storage.example.com/clip.mp4'
      })
      mockReplaceGroupSlides.mockImplementationOnce(async () => {
        callOrder.push('replace')
      })
      const wrapper = mountGrid({ selectedSlot: slot, group: null, ensureGroupMaterialized })

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [makeFile('clip.mp4', 'video/mp4')])
      await flushPromises()

      expect(callOrder).toEqual(['materialize', 'upload', 'replace'])
    })

    it('a failed upload appends nothing and renders the error text', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const ensureGroupMaterialized = vi.fn().mockResolvedValue({ entries: [], sourceSignature: undefined })
      mockUploadMedia.mockImplementationOnce(async () => {
        mediaUploadErrorRef.value = 'Upload failed.'
        throw new Error('Upload failed.')
      })
      const wrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [makeFile('clip.mp4', 'video/mp4')])
      await flushPromises()
      await wrapper.vm.$nextTick()

      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
      expect(wrapper.get('[data-testid="slide-grid-media-error"]').text()).toBe('Upload failed.')
    })
  })

  // --- 25-07 Task 3: dropped audio sets the bed, appends nothing (D-14/D-18) ---
  describe('audio drop sets the group bed, never a slide (25-07 Task 3)', () => {
    it('calls setGroupBedMedia with the uploaded URL, and never the slide-replacing action', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0, serviceId: 'service-1' } as never)
      mockUploadMedia.mockResolvedValueOnce('https://storage.example.com/pad.mp3')
      const wrapper = mountGrid({ selectedSlot: slot, serviceId: 'service-9' })
      const file = makeFile('pad.mp3', 'audio/mpeg')

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [file])
      await flushPromises()

      expect(mockUploadMedia).toHaveBeenCalledWith(file, 'org-1')
      expect(mockSetGroupBedMedia).toHaveBeenCalledWith('org-1', 'slot-1', {
        serviceId: 'service-9',
        bedAudioUrl: 'https://storage.example.com/pad.mp3',
      })
      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    })

    it('a failed upload attaches nothing and renders the error text', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      mockUploadMedia.mockImplementationOnce(async () => {
        mediaUploadErrorRef.value = 'Upload failed.'
        throw new Error('Upload failed.')
      })
      const wrapper = mountGrid({ selectedSlot: slot })

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [makeFile('pad.mp3', 'audio/mpeg')])
      await flushPromises()
      await wrapper.vm.$nextTick()

      expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
      expect(wrapper.get('[data-testid="slide-grid-media-error"]').text()).toBe('Upload failed.')
    })
  })

})

// ── Reorder repro (Phase 29-01, R049/R050) ───────────────────────────────────
// Builds the FAILING reproduction before any source fix lands. Every scenario
// below reads the REAL container SlideGrid rendered via `simulateCardDrag`
// (module-scope, shared with the `drag-reorder (Task 3)` describe above) —
// never a synthetic parent with no drop-tile sibling — and every index handed
// to `onEnd` is derived from that live DOM, never hand-passed. Every
// assertion reads `entry.id` identity, never position/index.
describe('SlideGrid - Phase 29 reorder repro', () => {
  // NOT an `it.fails` — see the Deviations section of 29-01-SUMMARY.md. This
  // scenario was originally written as a repro (R049) mirroring the
  // `ServiceEditorView.vue` header-offset defect, but SlideGrid's drop tile
  // is ALWAYS the container's last child (never interspersed between cards
  // the way section headers sit between service slots), so `oldIndex`/
  // `newIndex` and `oldDraggableIndex`/`newDraggableIndex` are numerically
  // IDENTICAL for any interior drag — there is no header-offset-shaped defect
  // reachable here. The assertion below passes against today's unfixed code;
  // kept as a real regression guard (and the R049 index-source fix is still
  // applied in 29-04, matching `ServiceEditorView.vue`, for symmetry and to
  // guard the one genuine divergence case: dragging a card past the drop
  // tile — not exercised by this fixture).
  it('drags a slide to the position it was dropped in (R049)', async () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const group = makeGroup({
      sourceSignature: 'sig-abc',
      slides: [
        { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
        { id: 'e2', order: 1, sourceRef: { kind: 'text' } },
        { id: 'e3', order: 2, sourceRef: { kind: 'text' } },
        { id: 'e4', order: 3, sourceRef: { kind: 'text' } },
      ],
    })
    const assembledSlideshow = [
      makeAssembled(0, 'e1'),
      makeAssembled(0, 'e2'),
      makeAssembled(0, 'e3'),
      makeAssembled(0, 'e4'),
    ]
    mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })
    await Promise.resolve()
    await Promise.resolve()

    // Drag entry index 3 (e4) to the first position.
    await simulateCardDrag(3, 0)
    await Promise.resolve()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
    const slides = slidesArg as GroupSlideEntry[]
    expect(slides.map((e) => e.id)).toEqual(['e4', 'e1', 'e2', 'e3'])
    expect(slides.map((e) => e.order)).toEqual([0, 1, 2, 3])
  })

  it('persists the correct entry even when the un-prefixed index pair is deliberately wrong (T-29-11)', async () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const group = makeGroup({
      sourceSignature: 'sig-guard-1',
      slides: [
        { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
        { id: 'e2', order: 1, sourceRef: { kind: 'text' } },
        { id: 'e3', order: 2, sourceRef: { kind: 'text' } },
      ],
    })
    const assembledSlideshow = [makeAssembled(0, 'e1'), makeAssembled(0, 'e2'), makeAssembled(0, 'e3')]
    mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })
    await Promise.resolve()
    await Promise.resolve()

    const capture = latestCapture()
    if (!capture) throw new Error('no Sortable capture resolved')
    // `oldIndex`/`newIndex` are deliberately WRONG — if the handler read
    // them instead of the draggable-scoped pair, this would be a no-op
    // (99 === 99) or splice out of range. `oldDraggableIndex`/
    // `newDraggableIndex` are the real "move e1 to the end" pair; only they
    // must be honoured.
    await capture.options.onEnd!({
      oldIndex: 99,
      newIndex: 99,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: capture.el.children[0],
      from: capture.el,
      to: capture.el,
    } as never)
    await Promise.resolve()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
    const slides = slidesArg as GroupSlideEntry[]
    expect(slides.map((e) => e.id)).toEqual(['e2', 'e3', 'e1'])
    expect(slides.map((e) => e.order)).toEqual([0, 1, 2])
  })

  it('persists the correct entry when a non-card sibling sits BEFORE the cards in the container (T-29-11)', async () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const group = makeGroup({
      sourceSignature: 'sig-guard-2',
      slides: [
        { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
        { id: 'e2', order: 1, sourceRef: { kind: 'text' } },
        { id: 'e3', order: 2, sourceRef: { kind: 'text' } },
      ],
    })
    const assembledSlideshow = [makeAssembled(0, 'e1'), makeAssembled(0, 'e2'), makeAssembled(0, 'e3')]
    mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })
    await Promise.resolve()
    await Promise.resolve()

    const capture = latestCapture()
    if (!capture) throw new Error('no Sortable capture resolved')
    // A leading non-`.slide-card` sibling — a shape this component does not
    // render today (25-07's drop tile is always last), but the handler must
    // still tolerate correctly since it no longer trusts element-count
    // indices at all, only the draggable-scoped pair.
    const leadingSibling = document.createElement('div')
    capture.el.insertBefore(leadingSibling, capture.el.firstChild)

    // With the leading sibling counted, element-index 1 is e1. Moving e1
    // (draggable index 0) to the end (draggable index 2).
    await capture.options.onEnd!({
      oldIndex: 1,
      newIndex: 3,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: capture.el.children[1],
      from: capture.el,
      to: capture.el,
    } as never)
    await Promise.resolve()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
    const slides = slidesArg as GroupSlideEntry[]
    expect(slides.map((e) => e.id)).toEqual(['e2', 'e3', 'e1'])
    expect(slides.map((e) => e.order)).toEqual([0, 1, 2])
  })

  // Was `it.fails(... 'R050 — repro, unfix pending')` — now a genuine
  // regression guard for the array-order/`order`-value divergence mechanism
  // `appendToGroup` closes. See 29-04-SUMMARY.md's R050 investigation for the
  // second, materializer-owned candidate mechanism (a SONG group's trailing
  // copyright entry) this scope deliberately does not touch — that placement
  // is correct today and belongs to Phase 35 (R060).
  it('appends a new slide at the true end of the group with contiguous orders (R050)', async () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    // ARRAY order disagrees with the `order` field values — a group that
    // already fell out of sync (e.g. from a prior reorder or reconciliation),
    // exactly the shape the pre-fix `Math.max(...)`-derived `nextOrder` did
    // not defend against.
    const existingEntries: GroupSlideEntry[] = [
      { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
      { id: 'e3', order: 2, sourceRef: { kind: 'text' } },
      { id: 'e2', order: 1, sourceRef: { kind: 'text' } },
    ]
    const ensureGroupMaterialized = vi.fn().mockResolvedValue({
      entries: existingEntries,
      sourceSignature: 'sig-abc',
    })
    const wrapper = mountGrid({ selectedSlot: slot, ensureGroupMaterialized })
    await wrapper.get('[data-testid="slide-grid-add-slide"]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
    const slides = slidesArg as GroupSlideEntry[]
    const newId = slides[slides.length - 1]!.id
    expect(slides.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', newId])
    expect(slides.map((e) => e.order)).toEqual([0, 1, 2, 3])
  })

  // Was `it.fails(... 'R049 — pending')` — the testid now exists (Task 3).
  it('reorder failure surfaces and does not leave the grid showing an unsaved order (R049)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const group = makeGroup({
      sourceSignature: 'sig-xyz',
      slides: [
        { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
        { id: 'e2', order: 1, sourceRef: { kind: 'text' } },
      ],
    })
    const assembledSlideshow = [makeAssembled(0, 'e1'), makeAssembled(0, 'e2')]
    mockReplaceGroupSlides.mockRejectedValueOnce(new Error('write failed'))
    const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })
    await Promise.resolve()
    await Promise.resolve()

    await simulateCardDrag(0, 1)
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="slide-grid-reorder-error"]').text()).toBe(
      "Couldn't save this change — reverted. Try again.",
    )
    // The D-16 DOM revert is gone — the grid renders from props alone, so a
    // rejected write must still show the props-derived order, never a moved
    // card sitting over unchanged data.
    const cards = wrapper.findAllComponents(SlideCard)
    expect(cards.map((c) => c.props('assembledSlide').slide.id)).toEqual(['e1', 'e2'])
    expect(consoleSpy).toHaveBeenCalledWith('[SlideGrid] reorder save failed:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  it('clears the reorder failure row on the next successful write', async () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const group = makeGroup({
      sourceSignature: 'sig-xyz',
      slides: [
        { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
        { id: 'e2', order: 1, sourceRef: { kind: 'text' } },
      ],
    })
    const assembledSlideshow = [makeAssembled(0, 'e1'), makeAssembled(0, 'e2')]
    mockReplaceGroupSlides.mockRejectedValueOnce(new Error('write failed'))
    const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group, isEditor: true })
    await Promise.resolve()
    await Promise.resolve()

    await simulateCardDrag(0, 1)
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="slide-grid-reorder-error"]').exists()).toBe(true)

    // Second attempt resolves (mockRejectedValueOnce only applied once).
    await simulateCardDrag(0, 1)
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="slide-grid-reorder-error"]').exists()).toBe(false)
  })
})
