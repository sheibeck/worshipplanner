import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SlidePlanRail from '../SlidePlanRail.vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup } from '@/types/slideGroup'
import type { Timestamp } from 'firebase/firestore'

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp

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

function makeGroup(overrides: Partial<SlideGroup> & { id: string; slotId: string }): SlideGroup {
  return {
    serviceId: 'service-1',
    slides: [],
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  } as SlideGroup
}

function mountRail(props: {
  slots: ServiceSlot[]
  assembledSlideshow?: AssembledSlide[]
  groupsBySlotId?: Map<string, SlideGroup>
  selectedSlotId?: string | null
  groupsLoading?: boolean
}) {
  return mount(SlidePlanRail, {
    props: {
      slots: props.slots,
      assembledSlideshow: props.assembledSlideshow ?? [],
      groupsBySlotId: props.groupsBySlotId ?? new Map(),
      selectedSlotId: props.selectedSlotId ?? null,
      groupsLoading: props.groupsLoading ?? false,
    },
  })
}

describe('SlidePlanRail', () => {
  it('renders rows in position order even when the array order differs', () => {
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'MESSAGE', id: 'slot-c', position: 2 }),
      makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
      makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
    ]
    const wrapper = mountRail({ slots })
    const rowEls = wrapper.findAll('button[data-testid^="rail-row-"]')
    expect(rowEls.map((r) => r.attributes('data-testid'))).toEqual([
      'rail-row-slot-a',
      'rail-row-slot-b',
      'rail-row-slot-c',
    ])
  })

  it("derives a row's count from assembled slides matching its array index, not group.slides.length", () => {
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'SONG', id: 'slot-0', position: 0, songId: 's1', songTitle: 'Song A', songKey: null, requiredVwType: 1 } as never),
    ]
    // Group document absent entirely — the slot's fallback-path slides still
    // resolve through the assembler, so the count must come from those, not
    // from a (non-existent) group.
    const assembledSlideshow: AssembledSlide[] = [
      makeAssembled(0, 'a1'),
      makeAssembled(0, 'a2'),
      makeAssembled(0, 'a3'),
    ]
    const wrapper = mountRail({ slots, assembledSlideshow, groupsBySlotId: new Map() })
    expect(wrapper.get('[data-testid="rail-row-slot-0"] [data-testid="rail-row-count"]').text()).toBe('3')
  })

  it('still renders a row showing count 0 for a plan item with zero assembled slides', () => {
    const slots: ServiceSlot[] = [makeSlot({ kind: 'PRAYER', id: 'slot-empty', position: 0 })]
    const wrapper = mountRail({ slots, assembledSlideshow: [] })
    expect(wrapper.get('[data-testid="rail-row-slot-empty"] [data-testid="rail-row-count"]').text()).toBe('0')
  })

  it('renders the music line only for a group with a bed', () => {
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'SONG', id: 'slot-bed', position: 0, songId: 's1', songTitle: 'Has Bed', songKey: null, requiredVwType: 1 } as never),
      makeSlot({ kind: 'SONG', id: 'slot-nobed', position: 1, songId: 's2', songTitle: 'No Bed', songKey: null, requiredVwType: 1 } as never),
    ]
    const groupsBySlotId = new Map<string, SlideGroup>([
      ['slot-bed', makeGroup({ id: 'slot-bed', slotId: 'slot-bed', bedAudioUrl: 'https://example.com/pad.mp3' })],
      ['slot-nobed', makeGroup({ id: 'slot-nobed', slotId: 'slot-nobed' })],
    ])
    const wrapper = mountRail({ slots, groupsBySlotId })
    expect(wrapper.find('[data-testid="rail-row-slot-bed"] [data-testid="rail-row-bed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rail-row-slot-nobed"] [data-testid="rail-row-bed"]').exists()).toBe(false)
  })

  it('emits select with the clicked row\'s slot id', async () => {
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
      makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
    ]
    const wrapper = mountRail({ slots })
    await wrapper.get('[data-testid="rail-row-slot-b"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['slot-b']])
  })

  it('applies the accent classes only to the selected row', () => {
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
      makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
    ]
    const wrapper = mountRail({ slots, selectedSlotId: 'slot-b' })
    const rowA = wrapper.get('[data-testid="rail-row-slot-a"]')
    const rowB = wrapper.get('[data-testid="rail-row-slot-b"]')
    expect(rowA.attributes('data-selected')).toBe('false')
    expect(rowB.attributes('data-selected')).toBe('true')
    expect(rowB.classes()).toContain('border-indigo-500')
    expect(rowA.classes()).not.toContain('border-indigo-500')
  })

  it('renders the empty-state heading and body and no rows when there are no plan items', () => {
    const wrapper = mountRail({ slots: [] })
    expect(wrapper.find('[data-testid="rail-empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Nothing planned yet')
    expect(wrapper.text()).toContain('Service Order')
    expect(wrapper.findAll('button[data-testid^="rail-row-"]')).toHaveLength(0)
  })

  it('renders skeleton rows while groups are loading and there is nothing to show yet', () => {
    const wrapper = mountRail({ slots: [], groupsLoading: true })
    expect(wrapper.find('[data-testid="rail-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rail-empty-state"]').exists()).toBe(false)
  })

  describe('D-06 negative assertions — no drag affordance of any kind', () => {
    it('renders no drag-handle class, no grab-cursor class, no draggable attribute and no drop handler', () => {
      const slots: ServiceSlot[] = [
        makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 }),
        makeSlot({ kind: 'PRAYER', id: 'slot-b', position: 1 }),
      ]
      const wrapper = mountRail({ slots })
      expect(wrapper.find('.drag-handle').exists()).toBe(false)
      expect(wrapper.find('.cursor-grab').exists()).toBe(false)
      expect(wrapper.find('[draggable]').exists()).toBe(false)
      expect(wrapper.html()).not.toContain('@drop')
      expect(wrapper.html()).not.toContain('ondrop')
    })
  })

  describe('cut mockup affordances — must never reappear (D-01, D-02, D-03)', () => {
    it('renders no orphan/unanchored block, no page-level import control and no generate-missing-slides control', () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 })]
      const wrapper = mountRail({ slots })
      const text = wrapper.text()
      expect(text).not.toContain('UNANCHORED')
      expect(text).not.toContain('Orphaned')
      expect(text).not.toContain('reassign')
      expect(text).not.toContain('Import')
      expect(text).not.toContain('Generate missing slides')
    })
  })
})

// ── 31-04: the rail's only lock-sensitive surface is its empty state (R036) ───
describe('SlidePlanRail - locked service (R036)', () => {
  it('replaces the dead "go add them on the Service Order tab" instruction when locked', () => {
    const wrapper = mount(SlidePlanRail, {
      props: {
        slots: [],
        assembledSlideshow: [],
        groupsBySlotId: new Map(),
        selectedSlotId: null,
        groupsLoading: false,
        serviceLocked: true,
      },
    })

    const empty = wrapper.get('[data-testid="rail-empty-state"]')
    expect(empty.text()).toContain('Nothing planned yet')
    expect(empty.text()).toContain('This service has no plan items. Reopen it for editing to add some.')
    // The unlocked body sends the user to a tab where they can no longer add.
    expect(empty.text()).not.toContain("they'll show up here automatically")
  })

  it('defaults serviceLocked to false, keeping the shipped copy for every existing caller', () => {
    const wrapper = mountRail({ slots: [] })
    expect(wrapper.get('[data-testid="rail-empty-state"]').text()).toContain('Service Order')
  })

  it('★ leaves the standing "order locked" caption alone — a different lock entirely', () => {
    const wrapper = mount(SlidePlanRail, {
      props: {
        slots: [makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 })],
        assembledSlideshow: [],
        groupsBySlotId: new Map(),
        selectedSlotId: null,
        groupsLoading: false,
        serviceLocked: true,
      },
    })
    // That caption is about slide ORDER following the plan (Phase 25, D-06),
    // not the lifecycle lock. Unfortunate word collision, deliberate no-op.
    expect(wrapper.text()).toContain('order locked')
  })
})
