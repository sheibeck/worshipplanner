import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { shallowMount } from '@vue/test-utils'
import SlidesTab from '../SlidesTab.vue'
import SlidePlanRail from '../SlidePlanRail.vue'
import SlideGrid from '../SlideGrid.vue'
import EditSlideDrawer from '../EditSlideDrawer.vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'

// 33-09 Task 2: the song-navigation menu key is a real router.push — mocked
// here so these tests never touch a real router, mirroring
// EditSlideDrawer.test.ts's own identical convention for the link button
// this key replaces.
const mockRouterPush = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

function makeEntry(overrides: Partial<GroupSlideEntry> & { id: string }): GroupSlideEntry {
  return {
    order: 0,
    sourceRef: { kind: 'text', title: 'New slide', body: '' },
    ...overrides,
  }
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
  active?: boolean
}) {
  return shallowMount(SlidesTab, {
    props: {
      slots: props.slots,
      serviceId: 'service-1',
      orgId: 'org-1',
      assembledSlideshow: props.assembledSlideshow ?? [],
      groupsBySlotId: props.groupsBySlotId ?? new Map(),
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

  describe('Edit Slide drawer wiring (Phase 26-05 Task 2)', () => {
    it('resolves the selected slide to its stored entry by a direct id lookup, but does NOT open the drawer (33-09, R051 — region-scoped gate for the deleted `onSelectSlide` line)', async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const entryOne = makeEntry({ id: 'entry-1', label: 'First' })
      const entryTwo = makeEntry({ id: 'entry-2', label: 'Second' })
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [entryOne, entryTwo] })
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'entry-1'), makeAssembled(0, 'entry-2')]
      const wrapper = mountTab({
        slots,
        assembledSlideshow,
        groupsBySlotId: new Map([['slot-a', group]]),
      })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('select', 'entry-1')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.exists()).toBe(true)
      expect(drawer.props('open')).toBe(false)
      expect(drawer.props('entry')).toEqual(entryOne)
    })

    it('resolves to nothing (and the drawer does not open) when the selected slide id has no matching stored entry', async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [makeEntry({ id: 'entry-1' })] })
      // The fallback-path id has no corresponding GroupSlideEntry (26-RESEARCH.md Pitfall 1).
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'slot-a:0')]
      const wrapper = mountTab({
        slots,
        assembledSlideshow,
        groupsBySlotId: new Map([['slot-a', group]]),
      })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('select', 'slot-a:0')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('entry')).toBeNull()
    })

    it('swaps to the second entry (and leaves the drawer closed) when a different slide is selected', async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const entryOne = makeEntry({ id: 'entry-1' })
      const entryTwo = makeEntry({ id: 'entry-2' })
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [entryOne, entryTwo] })
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'entry-1'), makeAssembled(0, 'entry-2')]
      const wrapper = mountTab({ slots, assembledSlideshow, groupsBySlotId: new Map([['slot-a', group]]) })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('select', 'entry-1')
      await wrapper.vm.$nextTick()
      wrapper.findComponent(SlideGrid).vm.$emit('select', 'entry-2')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('open')).toBe(false)
      expect(drawer.props('entry')).toEqual(entryTwo)
    })

    it('does NOT reopen the drawer when the same slide is merely re-selected after it was closed (33-09 — selection alone never opens it; only a menu action does)', async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const entryOne = makeEntry({ id: 'entry-1' })
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [entryOne] })
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'entry-1')]
      const wrapper = mountTab({ slots, assembledSlideshow, groupsBySlotId: new Map([['slot-a', group]]) })
      await wrapper.vm.$nextTick()

      // Opened via the exposed select-by-id function (unaffected by this
      // plan — mirrors the post-duplicate follow-selection path), since a
      // plain card `select` no longer opens the drawer at all.
      const vm = wrapper.vm as unknown as { selectSlideById: (id: string) => void }
      vm.selectSlideById('entry-1')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(true)

      wrapper.findComponent(EditSlideDrawer).vm.$emit('close')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(false)

      // Re-selecting the SAME slide via a plain card select must NOT reopen it.
      wrapper.findComponent(SlideGrid).vm.$emit('select', 'entry-1')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(false)
      expect(wrapper.findComponent(EditSlideDrawer).props('entry')).toEqual(entryOne)
    })

    it('closes the drawer (via the existing seam) when the selected plan item changes', async () => {
      const slots: ServiceSlot[] = [
        makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 }),
        makeSlot({ kind: 'SONG', id: 'slot-b', position: 1 }),
      ]
      const entryOne = makeEntry({ id: 'entry-1' })
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [entryOne] })
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'entry-1')]
      const wrapper = mountTab({ slots, assembledSlideshow, groupsBySlotId: new Map([['slot-a', group]]) })
      await wrapper.vm.$nextTick()

      // Opened via the exposed select-by-id function so this exercises the
      // "drawer was actually open" case rather than the no-longer-true
      // "select opens it".
      const vm = wrapper.vm as unknown as { selectSlideById: (id: string) => void }
      vm.selectSlideById('entry-1')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(true)

      wrapper.findComponent(SlidePlanRail).vm.$emit('select', 'slot-b')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('entry')).toBeNull()
    })

    it("passes the selected slide's correct one-based position and the group's total", async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const entries = [
        makeEntry({ id: 'entry-1' }),
        makeEntry({ id: 'entry-2' }),
        makeEntry({ id: 'entry-3' }),
      ]
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: entries })
      const assembledSlideshow: AssembledSlide[] = [
        makeAssembled(0, 'entry-1'),
        makeAssembled(0, 'entry-2'),
        makeAssembled(0, 'entry-3'),
      ]
      const wrapper = mountTab({ slots, assembledSlideshow, groupsBySlotId: new Map([['slot-a', group]]) })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('select', 'entry-2')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('position')).toBe(2)
      expect(drawer.props('total')).toBe(3)
    })

    it('moves the selection and opens the drawer when the exposed select-by-id function is invoked', async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const entryOne = makeEntry({ id: 'entry-1' })
      const entryTwo = makeEntry({ id: 'entry-2' })
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [entryOne, entryTwo] })
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'entry-1'), makeAssembled(0, 'entry-2')]
      const wrapper = mountTab({ slots, assembledSlideshow, groupsBySlotId: new Map([['slot-a', group]]) })
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as { selectSlideById: (id: string) => void }
      expect(typeof vm.selectSlideById).toBe('function')
      vm.selectSlideById('entry-2')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('open')).toBe(true)
      expect(drawer.props('entry')).toEqual(entryTwo)
    })

    // 33-09 Task 3: the drawer no longer emits `edit-in-scripture` at all —
    // the trigger moved to the 3-dot menu's `edit-in-scripture` key (see the
    // "Menu dispatch" describe block below for its replacement case, which
    // covers the identical relay-through-requestEditInScripture behaviour).

    it('leaves every prop the grid received before this change unchanged', async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'PRAYER', id: 'slot-a', position: 0 })]
      const ensureGroupMaterialized = vi.fn().mockResolvedValue(undefined)
      const wrapper = shallowMount(SlidesTab, {
        props: {
          slots,
          serviceId: 'service-1',
          orgId: 'org-1',
          assembledSlideshow: [],
          groupsBySlotId: new Map(),
          isEditor: true,
          groupsLoading: false,
          active: true,
          ensureGroupMaterialized,
        },
      })
      await wrapper.vm.$nextTick()
      const grid = wrapper.findComponent(SlideGrid)
      expect(grid.props('orgId')).toBe('org-1')
      expect(grid.props('serviceId')).toBe('service-1')
      expect(grid.props('isEditor')).toBe(true)
      expect(grid.props('ensureGroupMaterialized')).toBe(ensureGroupMaterialized)
      expect(grid.props('totalPlanItems')).toBe(1)
    })
  })

  describe('Present CTA (D-05, Phase 27-05, WR-01) — relocated to the header in 36-03', () => {
    // MOVED-CONTROL: 36-03 deletes this component's own Present button and
    // relocates it into ServiceEditorView's header, driven via `slidesTabRef`.
    // The condition, the emit and the payload are all identical — only the
    // render site changed — so these assertions now target the exposed API
    // (`canPresent`/`onPresentClick`) instead of a DOM click on the old CTA.
    function exposedVm(wrapper: ReturnType<typeof mountTab>) {
      return wrapper.vm as unknown as { canPresent: boolean; onPresentClick: () => void }
    }

    it('renders no Present button of its own — the control moved to the page header', () => {
      const wrapper = mountTab({ slots: [] })
      expect(wrapper.find('[data-testid="present-slideshow-cta"]').exists()).toBe(false)
    })

    it('canPresent is false with no assembled slides, and true once there are', async () => {
      const wrapper = mountTab({ slots: [], assembledSlideshow: [] })
      await wrapper.vm.$nextTick()
      expect(exposedVm(wrapper).canPresent).toBe(false)

      await wrapper.setProps({ assembledSlideshow: [makeAssembled(0, 'slide-1')] })
      await wrapper.vm.$nextTick()
      expect(exposedVm(wrapper).canPresent).toBe(true)
    })

    it('onPresentClick() emits present exactly once', async () => {
      const wrapper = mountTab({ slots: [], assembledSlideshow: [makeAssembled(0, 'slide-1')] })
      await wrapper.vm.$nextTick()

      exposedVm(wrapper).onPresentClick()

      expect(wrapper.emitted('present')).toBeTruthy()
      expect(wrapper.emitted('present')).toHaveLength(1)
    })

    it('exposes the four pre-existing members alongside the two new ones', () => {
      const wrapper = mountTab({ slots: [] })
      const vm = wrapper.vm as unknown as Record<string, unknown>
      expect(vm.selectedSlotId).toBeDefined()
      expect(vm.selectedSlideId).toBeDefined()
      expect(vm.requestEditInScripture).toBeDefined()
      expect(vm.selectSlideById).toBeDefined()
      expect(vm.canPresent).toBeDefined()
      expect(vm.onPresentClick).toBeDefined()
    })

    it('the rail and grid still render — the deleted wrapper was the tab root\'s only other child', () => {
      const wrapper = mountTab({ slots: [] })
      expect(wrapper.find('[data-testid="slides-tab"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="slides-tab-content"]').exists()).toBe(true)
    })
  })

  describe('presentStartIndex — present starts where you were looking (R061)', () => {
    // Three groups of differing slide counts (1, 4, 2) mapped onto three
    // slots, in the same array order as slotIndex — this is what makes
    // `selectedSlotArrayIndex` (props.slots.findIndex) agree with the
    // `slotIndex` recorded on each fixture below.
    // Flat deck order: [g0-0(0), g1-0(1), g1-1(2), g1-2(3), g1-3(4), g2-0(5), g2-1(6)]
    const slots: ServiceSlot[] = [
      makeSlot({ kind: 'SONG', id: 'slot-0', position: 0 }),
      makeSlot({ kind: 'SONG', id: 'slot-1', position: 1 }),
      makeSlot({ kind: 'SONG', id: 'slot-2', position: 2 }),
    ]
    const assembledSlideshow: AssembledSlide[] = [
      makeAssembled(0, 'g0-0'),
      makeAssembled(1, 'g1-0'),
      makeAssembled(1, 'g1-1'),
      makeAssembled(1, 'g1-2'),
      makeAssembled(1, 'g1-3'),
      makeAssembled(2, 'g2-0'),
      makeAssembled(2, 'g2-1'),
    ]

    function mountWithSelection() {
      return mountTab({ slots, assembledSlideshow, active: true })
    }

    /** MOVED-CONTROL (36-03): calls the exposed `onPresentClick()` instead of
     * clicking the now-deleted CTA, and returns the payload of the LATEST
     * `present` emit — the only public surface `presentStartIndex` has (it
     * is deliberately not in `defineExpose`). */
    async function presentPayload(wrapper: ReturnType<typeof mountWithSelection>): Promise<number> {
      ;(wrapper.vm as unknown as { onPresentClick: () => void }).onPresentClick()
      await wrapper.vm.$nextTick()
      const emitted = wrapper.emitted('present')
      return (emitted?.[emitted.length - 1] as [number])[0]
    }

    it('a selected slide resolves to its own flat index', async () => {
      const wrapper = mountWithSelection()
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as unknown as { selectedSlideId: string | null }
      vm.selectedSlideId = 'g1-2'
      await wrapper.vm.$nextTick()

      expect(await presentPayload(wrapper)).toBe(3)
    })

    it('a slide at its group\'s first or last position resolves to its own flat index — no off-by-one', async () => {
      const wrapper = mountWithSelection()
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as unknown as { selectedSlideId: string | null }

      vm.selectedSlideId = 'g1-0' // group-1's first slide
      await wrapper.vm.$nextTick()
      expect(await presentPayload(wrapper)).toBe(1)

      vm.selectedSlideId = 'g1-3' // group-1's last slide
      await wrapper.vm.$nextTick()
      expect(await presentPayload(wrapper)).toBe(4)
    })

    it('a slot selected with no slide within it resolves to that group\'s first assembled slide', async () => {
      const wrapper = mountWithSelection()
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as unknown as { selectedSlotId: string | null; selectedSlideId: string | null }
      vm.selectedSlotId = 'slot-1'
      vm.selectedSlideId = null // slot-only selection — the watch already clears this on a real slot change
      await wrapper.vm.$nextTick()

      expect(await presentPayload(wrapper)).toBe(1) // g1-0, group-1's first slide
    })

    it('nothing selected resolves to 0', async () => {
      // No slots at all — the D-05 auto-select watch has nothing to select,
      // so both selectedSlotId and selectedSlideId stay null.
      const wrapper = mountTab({ slots: [], assembledSlideshow, active: true })
      await wrapper.vm.$nextTick()

      expect(await presentPayload(wrapper)).toBe(0)
    })

    it('a stale selectedSlideId falls back to the group\'s first slide, then to 0 if the group is gone too', async () => {
      const wrapper = mountWithSelection()
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as unknown as { selectedSlotId: string | null; selectedSlideId: string | null }

      // Stale slide id, but the selected slot's group still resolves.
      vm.selectedSlotId = 'slot-1'
      await wrapper.vm.$nextTick()
      vm.selectedSlideId = 'deleted-slide-id'
      await wrapper.vm.$nextTick()
      expect(await presentPayload(wrapper)).toBe(1) // g1-0, group-1's first slide

      // Both the slide AND the slot are stale/gone — falls all the way to 0.
      vm.selectedSlotId = 'deleted-slot-id'
      await wrapper.vm.$nextTick()
      expect(await presentPayload(wrapper)).toBe(0)
    })

    it('groups with differing slide counts (1, 4, 2) each map their selection to the correct flat index', async () => {
      const wrapper = mountWithSelection()
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as unknown as { selectedSlideId: string | null }

      vm.selectedSlideId = 'g0-0' // the 1-slide group
      await wrapper.vm.$nextTick()
      expect(await presentPayload(wrapper)).toBe(0)

      vm.selectedSlideId = 'g2-1' // the 2-slide group, second slide
      await wrapper.vm.$nextTick()
      expect(await presentPayload(wrapper)).toBe(6)
    })

    it('calling onPresentClick() emits present with the computed start index as its payload', async () => {
      // MOVED-CONTROL (36-03): was a DOM click on the deleted CTA.
      const wrapper = mountWithSelection()
      await wrapper.vm.$nextTick()
      const vm = wrapper.vm as unknown as { selectedSlideId: string | null; onPresentClick: () => void }
      vm.selectedSlideId = 'g1-2'
      await wrapper.vm.$nextTick()

      vm.onPresentClick()

      expect(wrapper.emitted('present')?.[0]).toEqual([3])
    })
  })

  describe('Duplicate follows the copy (Phase 26-09 Task 2)', () => {
    it("selects the new entry and shows it in the panel when the drawer's duplicate event fires", async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const entryOne = makeEntry({ id: 'entry-1' })
      const entryCopy = makeEntry({ id: 'entry-copy' })
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [entryOne, entryCopy] })
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'entry-1'), makeAssembled(0, 'entry-copy')]
      const wrapper = mountTab({ slots, assembledSlideshow, groupsBySlotId: new Map([['slot-a', group]]) })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('select', 'entry-1')
      await wrapper.vm.$nextTick()

      wrapper.findComponent(EditSlideDrawer).vm.$emit('duplicate', 'entry-copy')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('open')).toBe(true)
      expect(drawer.props('entry')).toEqual(entryCopy)
    })
  })

  describe('Menu dispatch (Phase 33-09 Task 2 — onMenuAction, the single dispatcher for all six keys)', () => {
    beforeEach(() => {
      mockRouterPush.mockClear()
    })

    function mountWithEntry(sourceRef: GroupSlideEntry['sourceRef']) {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const entry = makeEntry({ id: 'entry-1', sourceRef })
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [entry] })
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'entry-1')]
      return mountTab({ slots, assembledSlideshow, groupsBySlotId: new Map([['slot-a', group]]) })
    }

    it('menu: the edit-details key opens the drawer', async () => {
      const wrapper = mountWithEntry({ kind: 'text', title: 'New slide', body: '' })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-1', 'edit-details')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('open')).toBe(true)
    })

    // D2 (260805-bvo): 'edit-lyrics' still exists as a MenuItemKey until
    // Task 3 removes it from slideDisplay.ts — it opens the identical
    // single-body drawer in the meantime.
    it('menu: the edit-lyrics key opens the drawer', async () => {
      const wrapper = mountWithEntry({ kind: 'text', title: 'New slide', body: '' })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-1', 'edit-lyrics')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('open')).toBe(true)
    })

    it('menu: dispatching the lyrics key then the details key on the SAME entry leaves the drawer open throughout', async () => {
      const wrapper = mountWithEntry({ kind: 'text', title: 'New slide', body: '' })
      await wrapper.vm.$nextTick()

      const grid = wrapper.findComponent(SlideGrid)
      grid.vm.$emit('menu-action', 'entry-1', 'edit-lyrics')
      await wrapper.vm.$nextTick()
      let drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('open')).toBe(true)

      grid.vm.$emit('menu-action', 'entry-1', 'edit-details')
      await wrapper.vm.$nextTick()
      drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('open')).toBe(true)
    })

    it("menu: the delete key sets the drawer's pendingAction to a { key: 'delete' } request — this component calls no delete action itself (P-01; it has no store import at all, see its own file header)", async () => {
      const wrapper = mountWithEntry({ kind: 'text', title: 'New slide', body: '' })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-1', 'delete')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('pendingAction')).toMatchObject({ key: 'delete' })
      expect(drawer.props('open')).toBe(true)
    })

    it("menu: the duplicate key sets the drawer's pendingAction to a { key: 'duplicate' } request", async () => {
      const wrapper = mountWithEntry({ kind: 'text', title: 'New slide', body: '' })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-1', 'duplicate')
      await wrapper.vm.$nextTick()

      const drawer = wrapper.findComponent(EditSlideDrawer)
      expect(drawer.props('pendingAction')).toMatchObject({ key: 'duplicate' })
    })

    it('menu: the same key dispatched twice produces two pendingAction requests with DIFFERENT nonces', async () => {
      const wrapper = mountWithEntry({ kind: 'text', title: 'New slide', body: '' })
      await wrapper.vm.$nextTick()

      const grid = wrapper.findComponent(SlideGrid)
      grid.vm.$emit('menu-action', 'entry-1', 'delete')
      await wrapper.vm.$nextTick()
      const first = wrapper.findComponent(EditSlideDrawer).props('pendingAction') as { key: string; nonce: number }

      grid.vm.$emit('menu-action', 'entry-1', 'delete')
      await wrapper.vm.$nextTick()
      const second = wrapper.findComponent(EditSlideDrawer).props('pendingAction') as { key: string; nonce: number }

      expect(second.nonce).not.toBe(first.nonce)
    })

    it("menu: the drawer's pending-action-consumed emit clears pendingAction back to null", async () => {
      const wrapper = mountWithEntry({ kind: 'text', title: 'New slide', body: '' })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-1', 'delete')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(EditSlideDrawer).props('pendingAction')).not.toBeNull()

      wrapper.findComponent(EditSlideDrawer).vm.$emit('pending-action-consumed')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(EditSlideDrawer).props('pendingAction')).toBeNull()
    })

    it('menu: the edit-in-song key pushes the lyrics tab for a lyric-kind entry and leaves the drawer closed', async () => {
      const wrapper = mountWithEntry({ kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-1', 'edit-in-song')
      await wrapper.vm.$nextTick()

      expect(mockRouterPush).toHaveBeenCalledWith({ name: 'songs', query: { edit: 'song-1', tab: 'lyrics' } })
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(false)
    })

    it('menu: the edit-in-song key pushes the details tab for a copyright-kind entry', async () => {
      const wrapper = mountWithEntry({ kind: 'copyright', songId: 'song-1' })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-1', 'edit-in-song')
      await wrapper.vm.$nextTick()

      expect(mockRouterPush).toHaveBeenCalledWith({ name: 'songs', query: { edit: 'song-1', tab: 'details' } })
    })

    it('menu: the edit-in-scripture key emits navigate-to-scripture-editor and leaves the drawer closed', async () => {
      const wrapper = mountWithEntry({ kind: 'scripture', scriptureReadingId: 'read-1', innerSlideId: 'inner-1' })
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-1', 'edit-in-scripture')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('navigate-to-scripture-editor')).toBeTruthy()
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(false)
    })

    // 34-07 (owner UAT F1) — the drawer's Slide Text scripture-route control
    // converges on the SAME requestEditInScripture() the menu path calls.
    it('drawer: the edit-scripture-text emit produces exactly one navigate-to-scripture-editor with the selected slot\'s array index, and leaves the drawer closed', async () => {
      // Uses the default auto-stub (no drawer opened first) — the
      // `mountWithControllableGuard` tests below in the WR-04 describe block
      // separately prove the guard/close interaction when a drawer IS open.
      const wrapper = mountWithEntry({ kind: 'scripture', scriptureReadingId: 'read-1', innerSlideId: 'inner-1' })
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(false)

      wrapper.findComponent(EditSlideDrawer).vm.$emit('edit-scripture-text')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('navigate-to-scripture-editor')).toHaveLength(1)
      expect(wrapper.emitted('navigate-to-scripture-editor')?.[0]).toEqual([0])
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(false)
    })

    it('menu: a menu action on a slide id that was NOT already selected selects it first, so the grid receives it as selectedSlideId', async () => {
      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const entryOne = makeEntry({ id: 'entry-1' })
      const entryTwo = makeEntry({ id: 'entry-2' })
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [entryOne, entryTwo] })
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'entry-1'), makeAssembled(0, 'entry-2')]
      const wrapper = mountTab({ slots, assembledSlideshow, groupsBySlotId: new Map([['slot-a', group]]) })
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(SlideGrid).props('selectedSlideId')).toBeNull()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-2', 'edit-details')
      await wrapper.vm.$nextTick()

      expect(wrapper.findComponent(SlideGrid).props('selectedSlideId')).toBe('entry-2')
      expect(wrapper.findComponent(EditSlideDrawer).props('entry')).toEqual(entryTwo)
    })
  })

  describe('WR-04 — unsaved-edit guard gates menu-dispatched navigation', () => {
    beforeEach(() => {
      mockRouterPush.mockClear()
    })

    // The default `mountTab` auto-stub of `EditSlideDrawer` exposes nothing,
    // so `editSlideDrawerRef.value?.confirmDiscard()` resolves via the `??
    // true` fallback — every OTHER test in this file relies on that safe
    // default. These tests substitute a minimal real stub that DOES expose a
    // controllable `confirmDiscard`, so `onMenuAction`'s own gating logic
    // (not the drawer's internals, already covered by EditSlideDrawer.test.ts)
    // can be exercised directly.
    function mountWithControllableGuard(
      sourceRef: GroupSlideEntry['sourceRef'],
      confirmDiscardResult: boolean,
    ) {
      const confirmDiscard = vi.fn(() => confirmDiscardResult)
      const EditSlideDrawerStub = defineComponent({
        name: 'EditSlideDrawer',
        props: [
          'open', 'pendingAction', 'entry', 'group', 'planItem',
          'assembledSlide', 'position', 'total', 'orgId', 'serviceId',
          'isEditor', 'serviceLocked',
        ],
        emits: ['close', 'duplicate', 'pending-action-consumed', 'edit-scripture-text'],
        setup(_, { expose }) {
          expose({ confirmDiscard })
          return () => null
        },
      })

      const slots: ServiceSlot[] = [makeSlot({ kind: 'SONG', id: 'slot-a', position: 0 })]
      const entry = makeEntry({ id: 'entry-1', sourceRef })
      const group = makeGroup({ id: 'slot-a', slotId: 'slot-a', slides: [entry] })
      const assembledSlideshow: AssembledSlide[] = [makeAssembled(0, 'entry-1')]

      const wrapper = shallowMount(SlidesTab, {
        props: {
          slots,
          serviceId: 'service-1',
          orgId: 'org-1',
          assembledSlideshow,
          groupsBySlotId: new Map([['slot-a', group]]),
          isEditor: true,
          groupsLoading: false,
          active: true,
          ensureGroupMaterialized: vi.fn().mockResolvedValue(undefined),
        },
        global: { stubs: { EditSlideDrawer: EditSlideDrawerStub } },
      })
      return { wrapper, confirmDiscard }
    }

    it('a cancelled confirm blocks edit-in-song navigation and leaves the selection untouched', async () => {
      const { wrapper, confirmDiscard } = mountWithControllableGuard(
        { kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' },
        false,
      )
      await wrapper.vm.$nextTick()
      const grid = wrapper.findComponent(SlideGrid)

      // Open the drawer first — the guard only asks `confirmDiscard` when a
      // drawer is actually open (`drawerOpen.value` true).
      grid.vm.$emit('menu-action', 'entry-1', 'edit-details')
      await wrapper.vm.$nextTick()
      expect(grid.props('selectedSlideId')).toBe('entry-1')

      grid.vm.$emit('menu-action', 'entry-1', 'edit-in-song')
      await wrapper.vm.$nextTick()

      expect(confirmDiscard).toHaveBeenCalledTimes(1)
      expect(mockRouterPush).not.toHaveBeenCalled()
      expect(grid.props('selectedSlideId')).toBe('entry-1')
    })

    it('a confirmed discard allows edit-in-song navigation to proceed', async () => {
      const { wrapper, confirmDiscard } = mountWithControllableGuard(
        { kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' },
        true,
      )
      await wrapper.vm.$nextTick()
      const grid = wrapper.findComponent(SlideGrid)

      grid.vm.$emit('menu-action', 'entry-1', 'edit-details')
      await wrapper.vm.$nextTick()

      grid.vm.$emit('menu-action', 'entry-1', 'edit-in-song')
      await wrapper.vm.$nextTick()

      expect(confirmDiscard).toHaveBeenCalledTimes(1)
      expect(mockRouterPush).toHaveBeenCalledWith({ name: 'songs', query: { edit: 'song-1', tab: 'lyrics' } })
    })

    it('never calls confirmDiscard for edit-in-scripture when the drawer was never opened this session', async () => {
      const { wrapper, confirmDiscard } = mountWithControllableGuard(
        { kind: 'scripture', scriptureReadingId: 'read-1', innerSlideId: 'inner-1' },
        false,
      )
      await wrapper.vm.$nextTick()

      wrapper.findComponent(SlideGrid).vm.$emit('menu-action', 'entry-1', 'edit-in-scripture')
      await wrapper.vm.$nextTick()

      expect(confirmDiscard).not.toHaveBeenCalled()
      expect(wrapper.emitted('navigate-to-scripture-editor')).toBeTruthy()
    })

    // 34-07 (owner UAT F1) — the drawer route runs the SAME guard the menu
    // route runs: a cancelled confirm leaves the drawer open and relays
    // nothing.
    it('drawer route: a cancelled confirm from the drawer emit blocks the relay and leaves the drawer open', async () => {
      const { wrapper, confirmDiscard } = mountWithControllableGuard(
        { kind: 'scripture', scriptureReadingId: 'read-1', innerSlideId: 'inner-1' },
        false,
      )
      await wrapper.vm.$nextTick()
      const grid = wrapper.findComponent(SlideGrid)

      // Open the drawer first — the guard only asks `confirmDiscard` when a
      // drawer is actually open (`drawerOpen.value` true).
      grid.vm.$emit('menu-action', 'entry-1', 'edit-details')
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(true)

      wrapper.findComponent(EditSlideDrawer).vm.$emit('edit-scripture-text')
      await wrapper.vm.$nextTick()

      expect(confirmDiscard).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('navigate-to-scripture-editor')).toBeUndefined()
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(true)
    })

    it('drawer route: a confirmed discard allows the drawer emit to relay and close the drawer', async () => {
      const { wrapper, confirmDiscard } = mountWithControllableGuard(
        { kind: 'scripture', scriptureReadingId: 'read-1', innerSlideId: 'inner-1' },
        true,
      )
      await wrapper.vm.$nextTick()
      const grid = wrapper.findComponent(SlideGrid)

      grid.vm.$emit('menu-action', 'entry-1', 'edit-details')
      await wrapper.vm.$nextTick()

      wrapper.findComponent(EditSlideDrawer).vm.$emit('edit-scripture-text')
      await wrapper.vm.$nextTick()

      expect(confirmDiscard).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('navigate-to-scripture-editor')).toHaveLength(1)
      expect(wrapper.findComponent(EditSlideDrawer).props('open')).toBe(false)
    })
  })
})

// ── 31-04: serviceLocked is threaded, and kept DISTINCT from isEditor (R036) ──
describe('SlidesTab - lifecycle lock threading (R036)', () => {
  function mountLockedTab(serviceLocked: boolean) {
    return shallowMount(SlidesTab, {
      props: {
        slots: [makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })],
        serviceId: 'service-1',
        orgId: 'org-1',
        assembledSlideshow: [makeAssembled(0, 'c1')],
        groupsBySlotId: new Map(),
        isEditor: true,
        serviceLocked,
        groupsLoading: false,
        active: true,
        ensureGroupMaterialized: vi.fn().mockResolvedValue(undefined),
      },
    })
  }

  it('defaults serviceLocked to false, so a fixture that omits it behaves exactly as before', () => {
    const wrapper = mountTab({ slots: [makeSlot({ kind: 'PRAYER', id: 'slot-1', position: 0 })] })
    expect(wrapper.findComponent(SlideGrid).props('serviceLocked')).toBe(false)
    expect(wrapper.findComponent(EditSlideDrawer).props('serviceLocked')).toBe(false)
    expect(wrapper.findComponent(SlidePlanRail).props('serviceLocked')).toBe(false)
  })

  it('passes serviceLocked to the rail, the grid and the drawer WITHOUT touching isEditor', async () => {
    const wrapper = mountLockedTab(true)
    await wrapper.vm.$nextTick()

    for (const child of [SlidePlanRail, SlideGrid, EditSlideDrawer] as const) {
      expect(wrapper.findComponent(child).props('serviceLocked')).toBe(true)
    }
    // ★ The distinction the drawer's read-only copy depends on: a locked editor
    // is not a viewer, and overloading isEditor here would erase that.
    expect(wrapper.findComponent(SlideGrid).props('isEditor')).toBe(true)
    expect(wrapper.findComponent(EditSlideDrawer).props('isEditor')).toBe(true)
  })

  it('D-08: canPresent stays true while locked — Present is not an editing action', () => {
    // MOVED-CONTROL (36-03): the CTA and its `disabled` attribute no longer
    // render here; `serviceLocked` never fed `canPresent`'s condition either
    // way, so the assertion moves to the exposed boolean the header now reads.
    const wrapper = mountLockedTab(true)
    expect((wrapper.vm as unknown as { canPresent: boolean }).canPresent).toBe(true)
  })
})
