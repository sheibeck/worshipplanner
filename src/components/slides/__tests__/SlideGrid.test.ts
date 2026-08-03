import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import { ref } from 'vue'
import type { Options as SortableOptions } from 'sortablejs'
import SlideGrid from '../SlideGrid.vue'
import SlideCard from '../SlideCard.vue'
import SlideGroupMusicControl from '../SlideGroupMusicControl.vue'
import BackgroundControl from '../BackgroundControl.vue'
import SlideDropTarget from '../SlideDropTarget.vue'
import PptxImportModal from '@/components/PptxImportModal.vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import type { EnsureGroupMaterializedResult, MenuItem } from '../slideDisplay'
import { UNSUPPORTED_FILE_MESSAGE } from '../dropRouting'

// --- 25-05: SlideGrid calls the slideGroups store directly (add-slide, drag-reorder) ---
// --- 25-06 Task 2: also calls setGroupBedMedia directly for the group music bar ---
const mockReplaceGroupSlides = vi.fn().mockResolvedValue(undefined)
const mockSetGroupBedMedia = vi.fn().mockResolvedValue(undefined)
const mockSetGroupBackground = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    replaceGroupSlides: mockReplaceGroupSlides,
    setGroupBedMedia: mockSetGroupBedMedia,
    setGroupBackground: mockSetGroupBackground,
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

function makeAssembled(
  slotIndex: number,
  id: string,
  slotKind: AssembledSlide['slotKind'] = 'PRAYER',
  slideOverrides: Record<string, unknown> = {},
): AssembledSlide {
  return {
    slide: { id, position: 0, contentKind: 'text', body: `body-${id}`, ...slideOverrides },
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
  /** R036 (31-04) — defaults false, so every pre-existing call keeps its behaviour. */
  serviceLocked?: boolean
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
      serviceLocked: props.serviceLocked ?? false,
      orgId: props.orgId ?? 'org-1',
      serviceId: props.serviceId ?? 'service-1',
      ensureGroupMaterialized: props.ensureGroupMaterialized ?? vi.fn().mockResolvedValue(undefined),
    },
  })
}

beforeEach(() => {
  mockReplaceGroupSlides.mockClear()
  mockSetGroupBedMedia.mockClear()
  mockSetGroupBackground.mockClear()
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

  // --- 33-08 Task 2: group background control mounted below the music control (R055) ---
  describe('group background control (33-08 Task 2)', () => {
    it('renders the thumbnail, the filename and the caption with the real card count substituted', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({
        backgroundImageUrl: 'https://storage.example.com/backgrounds/mtn.jpg',
        slides: [
          { id: 'e1', order: 0, sourceRef: { kind: 'text' } },
          { id: 'e2', order: 1, sourceRef: { kind: 'text' } },
          { id: 'e3', order: 2, sourceRef: { kind: 'text' } },
        ],
      })
      const assembledSlideshow = [makeAssembled(0, 'e1'), makeAssembled(0, 'e2'), makeAssembled(0, 'e3')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group })

      const control = wrapper.findComponent(BackgroundControl)
      expect(control.props('imageUrl')).toBe('https://storage.example.com/backgrounds/mtn.jpg')
      expect(control.props('caption')).toBe('applies to all 3 slides in this group, unless a slide sets its own')
    })

    it('does not render the wrapper when there is no group background and no write permission', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot, isEditor: false, group: null })
      expect(wrapper.find('[data-testid="slide-grid-group-background"]').exists()).toBe(false)
    })

    it('renders the wrapper when there is a group background but no write permission', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ backgroundImageUrl: 'https://storage.example.com/bg.jpg', slides: [] })
      const wrapper = mountGrid({ selectedSlot: slot, isEditor: false, group })
      expect(wrapper.find('[data-testid="slide-grid-group-background"]').exists()).toBe(true)
    })

    it('renders the empty-state add affordance label when permitted and nothing is set', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot, isEditor: true, group: null })
      const control = wrapper.findComponent(BackgroundControl)
      expect(control.props('addLabel')).toBe('+ Add background for this group')
    })

    it("relays the control's attach emit to setGroupBackground with the URL, and remove with the clear flag — carrying no slides key", async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot, serviceId: 'service-9' })

      await wrapper.findComponent(BackgroundControl).vm.$emit('attach', 'https://storage.example.com/new.jpg')
      await Promise.resolve()

      expect(mockSetGroupBackground).toHaveBeenCalledTimes(1)
      expect(mockSetGroupBackground).toHaveBeenCalledWith('org-1', 'slot-1', {
        serviceId: 'service-9',
        backgroundImageUrl: 'https://storage.example.com/new.jpg',
      })
      expect('slides' in mockSetGroupBackground.mock.calls[0]![2]).toBe(false)

      await wrapper.findComponent(BackgroundControl).vm.$emit('remove')
      await Promise.resolve()

      expect(mockSetGroupBackground).toHaveBeenCalledTimes(2)
      const removePatch = mockSetGroupBackground.mock.calls[1]![2]
      expect(removePatch).toEqual({ serviceId: 'service-9', clearBackground: true })
      expect('slides' in removePatch).toBe(false)
    })

    it('shows the inherited display for a SONG group with no own background whose slides resolve from the song tier, and undefined for a PRAYER group in the same shape', () => {
      const songSlot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'Grace', songKey: null, requiredVwType: 1 } as never)
      const songGroup = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'lyric', songId: 's1', sectionId: 'v1' } }] })
      const songAssembled = [
        makeAssembled(0, 'e1', 'SONG', {
          backgroundSource: 'song',
          backgroundImageUrl: 'https://storage.example.com/backgrounds/song-bg.jpg',
        }),
      ]
      const songWrapper = mountGrid({ selectedSlot: songSlot, assembledSlideshow: songAssembled, group: songGroup })
      const songControl = songWrapper.findComponent(BackgroundControl)
      expect(songControl.props('inheritedFrom')).toEqual({
        url: 'https://storage.example.com/backgrounds/song-bg.jpg',
        label: 'song-bg.jpg',
      })

      const prayerSlot = makeSlot({ kind: 'PRAYER', id: 'slot-2', position: 0 })
      const prayerGroup = makeGroup({ id: 'slot-2', slotId: 'slot-2', slides: [{ id: 'e2', order: 0, sourceRef: { kind: 'text' } }] })
      const prayerAssembled = [
        makeAssembled(0, 'e2', 'PRAYER', {
          backgroundSource: 'song',
          backgroundImageUrl: 'https://storage.example.com/backgrounds/song-bg.jpg',
        }),
      ]
      const prayerWrapper = mountGrid({ selectedSlot: prayerSlot, assembledSlideshow: prayerAssembled, group: prayerGroup })
      expect(prayerWrapper.findComponent(BackgroundControl).props('inheritedFrom')).toBeUndefined()
    })

    it('does not show the inherited display for a SONG group that already has its own background', () => {
      const songSlot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'Grace', songKey: null, requiredVwType: 1 } as never)
      const songGroup = makeGroup({
        backgroundImageUrl: 'https://storage.example.com/own.jpg',
        slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'lyric', songId: 's1', sectionId: 'v1' } }],
      })
      const songAssembled = [
        makeAssembled(0, 'e1', 'SONG', {
          backgroundSource: 'slide',
          backgroundImageUrl: 'https://storage.example.com/own.jpg',
        }),
      ]
      const wrapper = mountGrid({ selectedSlot: songSlot, assembledSlideshow: songAssembled, group: songGroup })
      expect(wrapper.findComponent(BackgroundControl).props('inheritedFrom')).toBeUndefined()
    })

    it('a SONG group renders the control (background is group media, unlike the read-only slide structure)', () => {
      const songSlot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'Grace', songKey: null, requiredVwType: 1 } as never)
      const wrapper = mountGrid({ selectedSlot: songSlot, isEditor: true, group: null })
      expect(wrapper.find('[data-testid="slide-grid-group-background"]').exists()).toBe(true)
      expect(wrapper.findComponent(BackgroundControl).exists()).toBe(true)
    })

    it('a group with zero slides still renders the control when permitted', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const wrapper = mountGrid({ selectedSlot: slot, isEditor: true, assembledSlideshow: [], group: null })
      expect(wrapper.findComponent(BackgroundControl).exists()).toBe(true)
      expect(wrapper.findComponent(BackgroundControl).props('caption')).toBe(
        'applies to all 0 slides in this group, unless a slide sets its own',
      )
    })

    it("leaves the music control's own wrapper, props and write path unchanged", async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ bedAudioUrl: 'https://storage.example.com/pad.mp3', slides: [] })
      const wrapper = mountGrid({ selectedSlot: slot, group })

      expect(wrapper.find('[data-testid="slide-group-music-control"]').exists()).toBe(true)
      expect(wrapper.findComponent(SlideGroupMusicControl).props('audioUrl')).toBe('https://storage.example.com/pad.mp3')

      await wrapper.findComponent(SlideGroupMusicControl).vm.$emit('attach', 'https://storage.example.com/new.mp3')
      await Promise.resolve()
      expect(mockSetGroupBedMedia).toHaveBeenCalledTimes(1)
    })
  })

  // --- 33-08 Task 3: menu ownership — one open at a time, per-card items, the action relay ---
  describe('menu ownership (33-08 Task 3)', () => {
    function makeTextEntry(id: string, body?: string): GroupSlideEntry {
      return { id, order: 0, sourceRef: body !== undefined ? { kind: 'text', body } : { kind: 'text' } }
    }

    it("each card's menuItems come from slideActionMenuItems for its own stored entry, distinguishing kinds within the same group", () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({
        slides: [
          makeTextEntry('c1', ''),
          { id: 'c2', order: 1, sourceRef: { kind: 'scripture' } },
        ],
      })
      const assembledSlideshow = [makeAssembled(0, 'c1'), makeAssembled(0, 'c2')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group })
      const cards = wrapper.findAllComponents(SlideCard)
      const textKeys = (cards[0]!.props('menuItems') as MenuItem[]).map((i) => i.key)
      const scriptureKeys = (cards[1]!.props('menuItems') as MenuItem[]).map((i) => i.key)
      expect(textKeys).toContain('edit-lyrics')
      expect(scriptureKeys).not.toContain('edit-lyrics')
      expect(scriptureKeys).toContain('edit-in-scripture')
    })

    it('toggles one card open, then toggling a DIFFERENT card menu closes the first and opens the second', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ slides: [makeTextEntry('c1', ''), makeTextEntry('c2', '')] })
      const assembledSlideshow = [makeAssembled(0, 'c1'), makeAssembled(0, 'c2')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group })

      await wrapper.findAllComponents(SlideCard)[0]!.vm.$emit('menu-toggle', 'c1')
      expect(wrapper.findAllComponents(SlideCard)[0]!.props('menuOpen')).toBe(true)
      expect(wrapper.findAllComponents(SlideCard)[1]!.props('menuOpen')).toBe(false)

      await wrapper.findAllComponents(SlideCard)[1]!.vm.$emit('menu-toggle', 'c2')
      expect(wrapper.findAllComponents(SlideCard)[0]!.props('menuOpen')).toBe(false)
      expect(wrapper.findAllComponents(SlideCard)[1]!.props('menuOpen')).toBe(true)
    })

    it('toggling the same card twice leaves its menuOpen prop false', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ slides: [makeTextEntry('c1', '')] })
      const assembledSlideshow = [makeAssembled(0, 'c1')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group })

      await wrapper.findComponent(SlideCard).vm.$emit('menu-toggle', 'c1')
      expect(wrapper.findComponent(SlideCard).props('menuOpen')).toBe(true)
      await wrapper.findComponent(SlideCard).vm.$emit('menu-toggle', 'c1')
      expect(wrapper.findComponent(SlideCard).props('menuOpen')).toBe(false)
    })

    it('a menu-select produces exactly one menu-action on the grid carrying the slide id and the key, and clears the open ref', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ slides: [makeTextEntry('c1', '')] })
      const assembledSlideshow = [makeAssembled(0, 'c1')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group })

      await wrapper.findComponent(SlideCard).vm.$emit('menu-toggle', 'c1')
      expect(wrapper.findComponent(SlideCard).props('menuOpen')).toBe(true)

      await wrapper.findComponent(SlideCard).vm.$emit('menu-select', 'c1', 'edit-details')
      expect(wrapper.emitted('menu-action')).toEqual([['c1', 'edit-details']])
      expect(wrapper.findComponent(SlideCard).props('menuOpen')).toBe(false)
    })

    it("WR-02: opening a menu, selecting a DIFFERENT plan item, then returning to the original does not silently reopen the menu", async () => {
      const slotA = makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 })
      const slotB = makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 })
      // Same GroupSlideEntry id ('c1') reachable from BOTH plan items' props —
      // this is the reproduction: stable entry ids mean re-selecting slot A
      // re-renders a card whose id matches the stale `openMenuEntryId`.
      const groupA = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [makeTextEntry('c1', '')] })
      const assembledForA = [makeAssembled(0, 'c1')]
      const wrapper = mountGrid({ selectedSlot: slotA, slotArrayIndex: 0, assembledSlideshow: assembledForA, group: groupA })

      await wrapper.findComponent(SlideCard).vm.$emit('menu-toggle', 'c1')
      expect(wrapper.findComponent(SlideCard).props('menuOpen')).toBe(true)

      // Select a different plan item — no card matches 'c1' anymore.
      await wrapper.setProps({ selectedSlot: slotB, slotArrayIndex: 1, assembledSlideshow: [], group: null })
      expect(wrapper.findComponent(SlideCard).exists()).toBe(false)

      // Return to the original plan item — same entry id, freshly (re)rendered.
      await wrapper.setProps({ selectedSlot: slotA, slotArrayIndex: 0, assembledSlideshow: assembledForA, group: groupA })
      expect(wrapper.findComponent(SlideCard).props('menuOpen')).toBe(false)
    })

    it('a card whose slide id matches no stored entry receives menuItems of length 0', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ slides: [] })
      const assembledSlideshow = [makeAssembled(0, 'no-entry')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group })
      expect(wrapper.findComponent(SlideCard).props('menuItems')).toHaveLength(0)
    })

    it('with the service locked, no card menuItems contains the duplicate or delete key', () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
      const group = makeGroup({ slides: [makeTextEntry('c1', '')] })
      const assembledSlideshow = [makeAssembled(0, 'c1')]
      const wrapper = mountGrid({
        selectedSlot: slot,
        assembledSlideshow,
        group,
        isEditor: true,
        serviceLocked: true,
      })
      const keys = (wrapper.findComponent(SlideCard).props('menuItems') as MenuItem[]).map((i) => i.key)
      expect(keys).not.toContain('duplicate')
      expect(keys).not.toContain('delete')
    })

    it('for a SONG group, no card menuItems contains edit-lyrics, duplicate or delete', () => {
      const slot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'X', songKey: null, requiredVwType: 1 } as never)
      const group = makeGroup({ slides: [{ id: 'c1', order: 0, sourceRef: { kind: 'lyric', songId: 's1', sectionId: 'v1' } }] })
      const assembledSlideshow = [makeAssembled(0, 'c1', 'SONG')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group })
      const keys = (wrapper.findComponent(SlideCard).props('menuItems') as MenuItem[]).map((i) => i.key)
      expect(keys).not.toContain('edit-lyrics')
      expect(keys).not.toContain('duplicate')
      expect(keys).not.toContain('delete')
    })

    it("a HYMN group's auto-derived pristine text entry has no edit-lyrics key, while a hand-added blank entry in the same group does", () => {
      const slot = makeSlot({ kind: 'HYMN', id: 'slot-1', position: 0, hymnName: 'Amazing Grace', hymnNumber: '1' } as never)
      const group = makeGroup({ slides: [makeTextEntry('pristine'), makeTextEntry('handadded', '')] })
      const assembledSlideshow = [makeAssembled(0, 'pristine', 'HYMN'), makeAssembled(0, 'handadded', 'HYMN')]
      const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow, group })
      const cards = wrapper.findAllComponents(SlideCard)
      const pristineKeys = (cards[0]!.props('menuItems') as MenuItem[]).map((i) => i.key)
      const handAddedKeys = (cards[1]!.props('menuItems') as MenuItem[]).map((i) => i.key)
      expect(pristineKeys).not.toContain('edit-lyrics')
      expect(handAddedKeys).toContain('edit-lyrics')
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

  // --- R054: song groups are read-only in the Slides tab ---
  describe('R054 — song groups are read-only', () => {
    function makeSongSlot(id = 'slot-1') {
      return makeSlot({ kind: 'SONG', id, position: 0, songId: 's1', songTitle: 'X', songKey: null, requiredVwType: 1 } as never)
    }

    it('renders no Add slide or Import button for a song group, and both for a non-song group', () => {
      const songWrapper = mountGrid({ selectedSlot: makeSongSlot() })
      expect(songWrapper.find('[data-testid="slide-grid-add-slide"]').exists()).toBe(false)
      expect(songWrapper.find('[data-testid="slide-grid-import"]').exists()).toBe(false)

      const otherSlot = makeSlot({ kind: 'PRAYER', id: 'slot-2', position: 0 })
      const otherWrapper = mountGrid({ selectedSlot: otherSlot })
      expect(otherWrapper.find('[data-testid="slide-grid-add-slide"]').exists()).toBe(true)
      expect(otherWrapper.find('[data-testid="slide-grid-import"]').exists()).toBe(true)
    })

    it('shows a read-only badge for a song group and none for a non-song group', () => {
      const songWrapper = mountGrid({ selectedSlot: makeSongSlot() })
      expect(songWrapper.find('[data-testid="slide-grid-song-readonly-badge"]').exists()).toBe(true)

      const otherWrapper = mountGrid({ selectedSlot: makeSlot({ kind: 'PRAYER', id: 'slot-2', position: 0 }) })
      expect(otherWrapper.find('[data-testid="slide-grid-song-readonly-badge"]').exists()).toBe(false)
    })

    it('still renders SlideCard for a song group, selectable exactly as before', async () => {
      const assembledSlideshow = [makeAssembled(0, 'c1'), makeAssembled(0, 'c2')]
      const wrapper = mountGrid({ selectedSlot: makeSongSlot(), assembledSlideshow })
      const cards = wrapper.findAllComponents(SlideCard)
      expect(cards).toHaveLength(2)
      await cards[1]!.trigger('click')
      expect(wrapper.emitted('select')).toEqual([['c2']])
    })

    it('hands the cards reorderable=false for a song group even with a stored group document', () => {
      const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'lyric', songId: 's1', sectionId: 'sec-1' } }] })
      const assembledSlideshow = [makeAssembled(0, 'e1')]
      const wrapper = mountGrid({ selectedSlot: makeSongSlot(), assembledSlideshow, group, isEditor: true })
      expect(wrapper.find('[data-testid="slide-card-drag-handle"]').exists()).toBe(false)
    })

    it('an audio-file drop still reaches setGroupBedMedia for a song group, and appends no slide', async () => {
      mockUploadMedia.mockResolvedValueOnce('https://storage.example.com/pad.mp3')
      const wrapper = mountGrid({ selectedSlot: makeSongSlot(), serviceId: 'service-9' })

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [makeFile('pad.mp3', 'audio/mpeg')])
      await flushPromises()

      expect(mockSetGroupBedMedia).toHaveBeenCalledWith('org-1', 'slot-1', {
        serviceId: 'service-9',
        bedAudioUrl: 'https://storage.example.com/pad.mp3',
      })
      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    })

    it('a video-file drop on a song group appends nothing and shows the song-specific refusal notice', async () => {
      const wrapper = mountGrid({ selectedSlot: makeSongSlot() })

      await wrapper.findComponent(SlideDropTarget).vm.$emit('drop', [makeFile('clip.mp4', 'video/mp4')])
      await flushPromises()

      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
      expect(mockUploadMedia).not.toHaveBeenCalled()
      expect(wrapper.get('[data-testid="slide-grid-rejection-notice"]').text()).toBe(
        "This group's slides come from the song and are edited on the Song Lyrics screen.",
      )
    })

    it('a deck (PPTX) drop on a song group appends nothing, opens no import modal, and shows the refusal notice', async () => {
      const wrapper = mountGrid({ selectedSlot: makeSongSlot() })
      const file = makeFile('deck.pptx', '')

      await wrapper.get('[data-testid="slide-grid-drop-area"]').trigger('drop', { dataTransfer: { files: [file] } })
      await flushPromises()

      expect(wrapper.findComponent(PptxImportModal).props('open')).toBe(false)
      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
      expect(wrapper.get('[data-testid="slide-grid-rejection-notice"]').text()).toBe(
        "This group's slides come from the song and are edited on the Song Lyrics screen.",
      )
    })

    it('still renders and wires the group music control for a song group', async () => {
      const group = makeGroup({ bedAudioUrl: 'https://storage.example.com/pad.mp3', slides: [] })
      const wrapper = mountGrid({ selectedSlot: makeSongSlot(), group })

      const musicControl = wrapper.findComponent(SlideGroupMusicControl)
      expect(musicControl.exists()).toBe(true)
      expect(musicControl.props('audioUrl')).toBe('https://storage.example.com/pad.mp3')

      await musicControl.vm.$emit('attach', 'https://storage.example.com/new.mp3')
      await Promise.resolve()
      expect(mockSetGroupBedMedia).toHaveBeenCalledWith('org-1', 'slot-1', {
        serviceId: 'service-1',
        bedAudioUrl: 'https://storage.example.com/new.mp3',
      })
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

// ── 31-04: the lifecycle lock composes into this grid's existing seams (R036) ──
describe('SlideGrid - locked service (R036)', () => {
  function makeSongSlot(id = 'slot-1') {
    return makeSlot({ kind: 'SONG', id, position: 0, songId: 'song-1', songTitle: 'This Is Our God', songKey: null, requiredVwType: 1 } as never)
  }

  it('removes ＋ Add slide, ⇪ Import and the drop tile — removed, never disabled (D-05)', () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const wrapper = mountGrid({ selectedSlot: slot, serviceLocked: true })

    expect(wrapper.find('[data-testid="slide-grid-add-slide"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slide-grid-import"]').exists()).toBe(false)
    expect(wrapper.findComponent(SlideDropTarget).exists()).toBe(false)
    // The header keeps everything that is information rather than affordance.
    expect(wrapper.find('[data-testid="slide-grid-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-grid-position"]').exists()).toBe(true)
  })

  it('adds NO second read-only chip — the page banner already states the reason once (D-06)', () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const wrapper = mountGrid({ selectedSlot: slot, serviceLocked: true })
    // The R054 song chip explains a DIFFERENT restriction and must not appear
    // for a non-song group just because the service is locked.
    expect(wrapper.find('[data-testid="slide-grid-song-readonly-badge"]').exists()).toBe(false)
  })

  it('swaps the empty-state copy instead of leaving a dead "drop a file below" instruction', () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const wrapper = mountGrid({ selectedSlot: slot, assembledSlideshow: [], serviceLocked: true })

    const empty = wrapper.get('[data-testid="slide-grid-empty-state"]')
    expect(empty.text()).toContain('No slides in this group.')
    expect(empty.text()).toContain('Reopen the service for editing to add slides.')
    expect(empty.text()).not.toContain('Add a slide, or drop a file below.')
  })

  it('renders NO group music control at all when locked with no bed audio (E5 — no empty bordered box)', () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const wrapper = mountGrid({ selectedSlot: slot, group: makeGroup({ slides: [] }), serviceLocked: true })
    expect(wrapper.findComponent(SlideGroupMusicControl).exists()).toBe(false)
  })

  it('still renders the group music control when a bed IS attached — playback is not mutation', () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const group = makeGroup({ bedAudioUrl: 'https://storage.example.com/pad.mp3', slides: [] })
    const wrapper = mountGrid({ selectedSlot: slot, group, serviceLocked: true })

    const control = wrapper.findComponent(SlideGroupMusicControl)
    expect(control.exists()).toBe(true)
    // ...but with no remove affordance, because that IS mutation.
    expect(control.props('isEditor')).toBe(false)
  })

  it('hands SlideCard reorderable=false and creates no Sortable instance while locked', () => {
    const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text', title: 'a', body: '' } }] })
    const wrapper = mountGrid({
      selectedSlot: makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 }),
      assembledSlideshow: [makeAssembled(0, 'e1')],
      group,
      serviceLocked: true,
    })
    expect(wrapper.find('[data-testid="slide-card-drag-handle"]').exists()).toBe(false)
    expect(capturedSortableOptions).toBeUndefined()
  })

  it('★ destroys the Sortable instance when the service locks and re-creates it on reopen', async () => {
    const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text', title: 'a', body: '' } }] })
    const wrapper = mountGrid({
      selectedSlot: makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 }),
      assembledSlideshow: [makeAssembled(0, 'e1')],
      group,
    })
    await wrapper.vm.$nextTick()
    expect(capturedSortableOptions).toBeDefined()
    expect(mockSortableDestroy).not.toHaveBeenCalled()

    await wrapper.setProps({ serviceLocked: true })
    await wrapper.vm.$nextTick()
    expect(mockSortableDestroy).toHaveBeenCalled()

    // ★ The regression: without the destroy/re-create pairing, reopening leaves
    // this grid permanently undraggable until a page reload.
    capturedSortableOptions = undefined
    await wrapper.setProps({ serviceLocked: false })
    await wrapper.vm.$nextTick()
    expect(capturedSortableOptions).toBeDefined()
    expect(capturedSortableOptions!.handle).toBe('.drag-handle')
  })

  // ---- ★ Handler-level guards (30-VERIFICATION I-01) ------------------------
  //
  // Six of the seven mutation entry points here were guarded by template `v-if`
  // ALONE. Calling each directly proves the lock is not merely cosmetic.
  it('★ every mutation handler no-ops when locked, called directly rather than through its hidden control', async () => {
    const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
    const group = makeGroup({ slides: [{ id: 'e1', order: 0, sourceRef: { kind: 'text', title: 'a', body: '' } }] })
    const ensure = vi.fn().mockResolvedValue({ entries: group.slides, sourceSignature: null })
    const wrapper = mountGrid({ selectedSlot: slot, group, serviceLocked: true, ensureGroupMaterialized: ensure })
    const vm = wrapper.vm as unknown as {
      onAddSlide: () => Promise<void>
      openImportModal: () => void
      showImportModal: boolean
      onImportConfirmed: (p: { importId: string; section: string }) => Promise<void>
      onFilesDropped: (files: File[]) => Promise<void>
      onAttachGroupMusic: (url: string) => Promise<void>
      onRemoveGroupMusic: () => Promise<void>
    }

    await vm.onAddSlide()
    vm.openImportModal()
    await vm.onImportConfirmed({ importId: 'imp-1', section: 'worship' })
    await vm.onFilesDropped([makeFile('deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')])
    await vm.onFilesDropped([makeFile('pad.mp3', 'audio/mpeg')])
    await vm.onAttachGroupMusic('https://storage.example.com/new.mp3')
    await vm.onRemoveGroupMusic()

    expect(vm.showImportModal).toBe(false)
    expect(ensure).not.toHaveBeenCalled()
    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
    expect(mockUploadMedia).not.toHaveBeenCalled()
  })

  it('a song group on a DRAFT service keeps its group-media affordance — the two locks are distinct', () => {
    const wrapper = mountGrid({ selectedSlot: makeSongSlot(), serviceLocked: false })
    // R054 removes create/import/reorder but NOT group media (30-03).
    expect(wrapper.find('[data-testid="slide-grid-add-slide"]').exists()).toBe(false)
    expect(wrapper.findComponent(SlideGroupMusicControl).props('isEditor')).toBe(true)
  })

  it('a song group on a LOCKED service loses group media too', () => {
    const group = makeGroup({ bedAudioUrl: 'https://storage.example.com/pad.mp3', slides: [] })
    const wrapper = mountGrid({ selectedSlot: makeSongSlot(), group, serviceLocked: true })
    expect(wrapper.findComponent(SlideGroupMusicControl).props('isEditor')).toBe(false)
  })
})
