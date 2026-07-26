import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SlideGrid from '../SlideGrid.vue'
import SlideCard from '../SlideCard.vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import type { PendingReconciliation, EnsureGroupMaterializedResult } from '../slideDisplay'

// --- 25-05 Task 2: SlideGrid calls the slideGroups store directly (add-slide) ---
const mockReplaceGroupSlides = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    replaceGroupSlides: mockReplaceGroupSlides,
  }),
}))

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
      ensureGroupMaterialized: props.ensureGroupMaterialized ?? vi.fn().mockResolvedValue(undefined),
    },
  })
}

beforeEach(() => {
  mockReplaceGroupSlides.mockClear()
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
      const [orgIdArg, slotIdArg, slidesArg, sigArg] = mockReplaceGroupSlides.mock.calls[0]!
      expect(orgIdArg).toBe('org-1')
      expect(slotIdArg).toBe('slot-1')
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides).toHaveLength(3)
      expect(slides[0]).toBe(existingEntries[0])
      expect(slides[1]).toBe(existingEntries[1])
      expect(slides[2]!.order).toBe(3)
      expect(sigArg).toBe('sig-abc')
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
})
