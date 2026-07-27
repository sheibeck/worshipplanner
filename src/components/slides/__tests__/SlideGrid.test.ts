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
import type { PendingReconciliation, EnsureGroupMaterializedResult } from '../slideDisplay'
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
let capturedSortableOptions: SortableOptions | undefined
const mockSortableDestroy = vi.fn()
vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((_el: HTMLElement, options: SortableOptions) => {
      capturedSortableOptions = options
      return { destroy: mockSortableDestroy }
    }),
  },
}))

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
  pendingReconciliations?: PendingReconciliation[]
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
      pendingReconciliations: props.pendingReconciliations ?? [],
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

  it("renders the passive reconciliation notice for the selected plan item's slot id, and nothing for a different one", () => {
    const slot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'X', songKey: null, requiredVwType: 1 } as never)
    const pendingForMine: PendingReconciliation = {
      slotId: 'slot-1',
      proposed: [],
      loss: { customizedEntries: 3, withAudio: 1, withNotes: 0 },
    }
    const wrapperMine = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, pendingReconciliations: [pendingForMine] })
    expect(wrapperMine.get('[data-testid="slide-grid-reconciliation-notice"]').text()).toContain('3')

    const pendingForOther: PendingReconciliation = { slotId: 'slot-other', proposed: [] }
    const wrapperOther = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, pendingReconciliations: [pendingForOther] })
    expect(wrapperOther.find('[data-testid="slide-grid-reconciliation-notice"]').exists()).toBe(false)
  })

  it('keeps cards selectable while a reconciliation is pending', async () => {
    const slot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'X', songKey: null, requiredVwType: 1 } as never)
    const assembledSlideshow = [makeAssembled(0, 'c1')]
    const pending: PendingReconciliation = { slotId: 'slot-1', proposed: [] }
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, assembledSlideshow, pendingReconciliations: [pending] })
    await wrapper.findComponent(SlideCard).trigger('click')
    expect(wrapper.emitted('select')).toEqual([['c1']])
  })

  it('renders no apply, reject or confirm control alongside the notice', () => {
    const slot = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songId: 's1', songTitle: 'X', songKey: null, requiredVwType: 1 } as never)
    const pending: PendingReconciliation = { slotId: 'slot-1', proposed: [] }
    const wrapper = mountGrid({ selectedSlot: slot, slotArrayIndex: 0, pendingReconciliations: [pending] })
    const text = wrapper.text().toLowerCase()
    expect(text).not.toContain('apply')
    expect(text).not.toContain('reject')
    expect(text).not.toContain('confirm')
    expect(text).not.toContain('dismiss')
    expect(wrapper.find('[data-testid="slide-grid-reconciliation-notice"] button').exists()).toBe(false)
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

    it('appends exactly one new entry, in the existing entries plus one, and computes order one past the highest', async () => {
      const slot = makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })
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
      expect(slides[0]).toBe(existingEntries[0])
      expect(slides[1]).toBe(existingEntries[1])
      expect(slides[2]!.order).toBe(3)
      expect(sigArg).toBe('sig-abc')
      // CR-02: the pre-append snapshot is passed through as `baseSlides` so
      // the store can detect and merge a concurrent write instead of
      // silently overwriting it — see `replaceGroupSlides`'s doc comment.
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
    function simulateDragEnd(oldIndex: number, newIndex: number) {
      const parent = document.createElement('div')
      const children = Array.from({ length: 4 }, () => document.createElement('div'))
      children.forEach((c) => parent.appendChild(c))
      const item = children[oldIndex]!
      return capturedSortableOptions!.onEnd!({ oldIndex, newIndex, item } as never)
    }

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
      await simulateDragEnd(0, 2)
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

      await simulateDragEnd(0, 0)
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
      expect(slides[0]).toBe(existingEntries[0])
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

    it('continues order from the highest existing entry', async () => {
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
      expect(slides[2]!.order).toBe(5)
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
