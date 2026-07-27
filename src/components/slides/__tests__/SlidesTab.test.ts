import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import SlidesTab from '../SlidesTab.vue'
import SlidePlanRail from '../SlidePlanRail.vue'
import SlideGrid from '../SlideGrid.vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup } from '@/types/slideGroup'

function makeSlot(overrides: Partial<ServiceSlot> & { kind: ServiceSlot['kind']; id: string; position: number }): ServiceSlot {
  return { ...overrides } as ServiceSlot
}

function makeAssembled(slotIndex: number, id: string): AssembledSlide {
  return {
    slide: { id, position: 0, contentKind: 'text', body: 'body' },
    slotIndex,
    slotKind: 'PRAYER',
    sourceId: null,
  } as AssembledSlide
}

function mountTab(props: {
  slots: ServiceSlot[]
  assembledSlideshow?: AssembledSlide[]
  groupsBySlotId?: Map<string, SlideGroup>
  pendingReconciliations?: unknown[]
  active?: boolean
}) {
  return shallowMount(SlidesTab, {
    props: {
      slots: props.slots,
      serviceId: 'service-1',
      orgId: 'org-1',
      assembledSlideshow: props.assembledSlideshow ?? [],
      groupsBySlotId: props.groupsBySlotId ?? new Map(),
      pendingReconciliations: (props.pendingReconciliations ?? []) as never,
      isEditor: true,
      groupsLoading: false,
      active: props.active ?? true,
      ensureGroupMaterialized: vi.fn().mockResolvedValue(undefined),
    },
  })
}

describe('SlidesTab', () => {
  it('auto-selects the first plan item in PLAN order (not array order) when activated', async () => {
    // Array order: b, a — position order: a (0), b (1).
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
      makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
    ]
    const wrapper = mountTab({ slots })
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { selectedSlotId: string | null }).selectedSlotId).toBe('slot-a')
  })

  it('auto-selects once plan items arrive after the tab is already active', async () => {
    const wrapper = mountTab({ slots: [] })
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { selectedSlotId: string | null }).selectedSlotId).toBeNull()

    await wrapper.setProps({
      slots: [
        makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
        makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
      ],
    })
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { selectedSlotId: string | null }).selectedSlotId).toBe('slot-a')
  })

  it('clears the selected slide id when the selected plan item changes', async () => {
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
      makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
    ]
    const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'slide-1')]
    const wrapper = mountTab({ slots, assembledSlideshow })
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as unknown as { selectedSlotId: string | null; selectedSlideId: string | null }
    expect(vm.selectedSlotId).toBe('slot-a')
    vm.selectedSlideId = 'slide-1'
    await wrapper.vm.$nextTick()
    expect(vm.selectedSlideId).toBe('slide-1')

    wrapper.findComponent(SlidePlanRail).vm.$emit('select', 'slot-b')
    await wrapper.vm.$nextTick()
    expect(vm.selectedSlotId).toBe('slot-b')
    expect(vm.selectedSlideId).toBeNull()
  })

  it('clears a selected slide id that no longer resolves against the selected group\'s assembled slides', async () => {
    const slots: ServiceSlot[] = [makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 })]
    const wrapper = mountTab({ slots, assembledSlideshow: [makeAssembled(0, 'fallback-id')] })
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as unknown as { selectedSlideId: string | null }
    vm.selectedSlideId = 'fallback-id'
    await wrapper.vm.$nextTick()
    expect(vm.selectedSlideId).toBe('fallback-id')

    // Simulate id churn at materialization (Pitfall 4): the assembled
    // slideshow now resolves the same slot to a different (stored) id.
    await wrapper.setProps({ assembledSlideshow: [makeAssembled(0, 'materialized-id')] })
    await wrapper.vm.$nextTick()
    expect(vm.selectedSlideId).toBeNull()
  })

  it('moves the selection to a surviving plan item when the selected one is removed', async () => {
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
      makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
    ]
    const wrapper = mountTab({ slots })
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { selectedSlotId: string | null }
    expect(vm.selectedSlotId).toBe('slot-a')

    await wrapper.setProps({ slots: [makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 })] })
    await wrapper.vm.$nextTick()
    expect(vm.selectedSlotId).toBe('slot-b')
  })

  it('selects nothing and does not throw when there are no plan items', async () => {
    expect(() => mountTab({ slots: [] })).not.toThrow()
    const wrapper = mountTab({ slots: [] })
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as { selectedSlotId: string | null }).selectedSlotId).toBeNull()
  })

  it("passes the slots prop through to the rendered rail", () => {
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
      makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
    ]
    const wrapper = mountTab({ slots })
    const rail = wrapper.findComponent(SlidePlanRail)
    expect(rail.exists()).toBe(true)
    expect(rail.props('slots')).toEqual(slots)
  })

  describe('grid wiring (Task 3)', () => {
    it('mounts the grid with the selected plan item and its array index in the slots array', async () => {
      const slots: ServiceSlot[] = [
        makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
        makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
      ]
      const wrapper = mountTab({ slots })
      await wrapper.vm.$nextTick()
      const grid = wrapper.findComponent(SlideGrid)
      expect(grid.exists()).toBe(true)
      expect(grid.props('selectedSlot')).toMatchObject({ id: 'slot-a' })
      expect(grid.props('slotArrayIndex')).toBe(0)
    })

    it('computes the array index and one-based position independently when array order and position order differ', async () => {
      // Array order: a, b, c — position order: b (0), a (1), c (2).
      const slots: ServiceSlot[] = [
        makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 1 }), // array index 0
        makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 0 }), // array index 1
        makeSlot({ kind: 'PRAYER', id: 'slot-c', position: 2 }), // array index 2
      ]
      const wrapper = mountTab({ slots })
      await wrapper.vm.$nextTick()
      wrapper.findComponent(SlidePlanRail).vm.$emit('select', 'slot-a')
      await wrapper.vm.$nextTick()

      const grid = wrapper.findComponent(SlideGrid)
      // slot-a is array index 0, but second in plan-position order (b=1st, a=2nd).
      expect(grid.props('slotArrayIndex')).toBe(0)
      expect(grid.props('position')).toBe(2)
      expect(grid.props('slotArrayIndex')).not.toBe(grid.props('position'))
    })

    it("emits from the grid's card selection and passes that id back down as the selected slide", async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 })]
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'slide-1')]
      const wrapper = mountTab({ slots, assembledSlideshow })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('select', 'slide-1')
      await wrapper.vm.$nextTick()

      expect(wrapper.findComponent(SlideGrid).props('selectedSlideId')).toBe('slide-1')
    })

    it("changes the grid's plan item and clears the selected slide id when the rail selection changes", async () => {
      const slots: ServiceSlot[] = [
        makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
        makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
      ]
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'slide-1')]
      const wrapper = mountTab({ slots, assembledSlideshow })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('select', 'slide-1')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(SlideGrid).props('selectedSlideId')).toBe('slide-1')

      wrapper.findComponent(SlidePlanRail).vm.$emit('select', 'slot-b')
      await wrapper.vm.$nextTick()

      const grid = wrapper.findComponent(SlideGrid)
      expect(grid.props('selectedSlot')).toMatchObject({ id: 'slot-b' })
      expect(grid.props('selectedSlideId')).toBeNull()
    })

    it('renders the grid without throwing when there are no plan items', async () => {
      const wrapper = mountTab({ slots: [] })
      await wrapper.vm.$nextTick()
      const grid = wrapper.findComponent(SlideGrid)
      expect(grid.exists()).toBe(true)
      expect(grid.props('selectedSlot')).toBeNull()
    })

    it('passes ensureGroupMaterialized and orgId through to the grid unchanged (25-05 Tasks 1/2)', async () => {
      const ensureGroupMaterialized = vi.fn().mockResolvedValue(undefined)
      const wrapper = shallowMount(SlidesTab, {
        props: {
          slots: [makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 })],
          serviceId: 'service-1',
          orgId: 'org-1',
          assembledSlideshow: [],
          groupsBySlotId: new Map(),
          pendingReconciliations: [],
          isEditor: true,
          groupsLoading: false,
          active: true,
          ensureGroupMaterialized,
        },
      })
      await wrapper.vm.$nextTick()
      const grid = wrapper.findComponent(SlideGrid)
      expect(grid.props('ensureGroupMaterialized')).toBe(ensureGroupMaterialized)
      expect(grid.props('orgId')).toBe('org-1')
    })
  })

  describe('"Edit in scripture" relay (Phase 26-03, D-15)', () => {
    it("emits navigate-to-scripture-editor with the selected plan item's raw array index when requested", async () => {
      // Array order: b, a — position order: a (0), b (1). Selection auto-lands
      // on slot-a (plan-position 0), whose raw array index is 1.
      const slots: ServiceSlot[] = [
        makeSlot({ kind: 'SCRIPTURE', id: 'slot-b', position: 1 }),
        makeSlot({ kind: 'SCRIPTURE', id: 'slot-a', position: 0 }),
      ]
      const wrapper = mountTab({ slots })
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as { requestEditInScripture: () => void }
      vm.requestEditInScripture()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('navigate-to-scripture-editor')).toBeTruthy()
      expect(wrapper.emitted('navigate-to-scripture-editor')![0]).toEqual([1])
    })

    it('emits the raw ARRAY index, not the plan POSITION, when they diverge', async () => {
      // Array order: a, b, c — position order: b (0), a (1), c (2).
      // Selecting slot-a (array index 0, plan position 2) must emit 0, not 2.
      const slots: ServiceSlot[] = [
        makeSlot({ kind: 'SCRIPTURE', id: 'slot-a', position: 1 }), // array index 0
        makeSlot({ kind: 'SCRIPTURE', id: 'slot-b', position: 0 }), // array index 1
        makeSlot({ kind: 'SCRIPTURE', id: 'slot-c', position: 2 }), // array index 2
      ]
      const wrapper = mountTab({ slots })
      await wrapper.vm.$nextTick()
      wrapper.findComponent(SlidePlanRail).vm.$emit('select', 'slot-a')
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as { requestEditInScripture: () => void }
      vm.requestEditInScripture()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('navigate-to-scripture-editor')![0]).toEqual([0])
    })

    it('emits nothing when no plan item is selected', async () => {
      const wrapper = mountTab({ slots: [] })
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as { requestEditInScripture: () => void }
      vm.requestEditInScripture()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('navigate-to-scripture-editor')).toBeFalsy()
    })

    it('exposes requestEditInScripture so a future drawer can bind to it without another round of plumbing', () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SCRIPTURE', id: 'slot-a', position: 0 })]
      const wrapper = mountTab({ slots })
      const vm = wrapper.vm as unknown as { requestEditInScripture: unknown }
      expect(typeof vm.requestEditInScripture).toBe('function')
    })
  })
})
