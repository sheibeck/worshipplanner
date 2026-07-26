import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import SlidesTab from '../SlidesTab.vue'
import SlidePlanRail from '../SlidePlanRail.vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup } from '@/types/slideGroup'

function makeSlot(overrides: Partial<ServiceSlot> & { kind: ServiceSlot['kind']; id: string; position: number }): ServiceSlot {
  return { kind: 'PRAYER', ...overrides } as ServiceSlot
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
})
