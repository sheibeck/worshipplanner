/**
 * RunRail.test.ts — the order-of-service rail (R276). RunRail is PURE
 * presentation: it takes RailRow[] + an activeIndex + optional expandedSlides
 * and emits @jump(slotIndex) / @jump-slide(arrayIndex). These tests pin the
 * contract the wired parent (97-09) depends on and the control suite asserts:
 *   - a has-slides row carries data-testid=rail-item with :data-active derived
 *     from activeIndex, and clicking it emits @jump with that row's slot index;
 *   - a no-slides row is rail-item-empty and inert (emits nothing on click);
 *   - a zero-has-slides mount shows the run-rail-empty "Nothing to present yet".
 *
 * jsdom has no layout engine, so Element.prototype.scrollIntoView is stubbed —
 * the component's self-scroll watcher calls it on activeIndex change.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import RunRail from '../RunRail.vue'
import type { RailRow } from '@/composables/useRunControl'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function row(overrides: Partial<RailRow> & { index: number }): RailRow {
  return {
    section: 'Songs',
    title: `Item ${overrides.index}`,
    count: 3,
    hasSlides: true,
    isActive: false,
    ...overrides,
  }
}

// index 0 has-slides (active), index 1 no-slides (inert), index 2 has-slides.
const threeRows: RailRow[] = [
  row({ index: 0, title: 'Amazing Grace' }),
  row({ index: 1, title: 'Empty Slot', hasSlides: false, count: 0 }),
  row({ index: 2, title: 'How Great Thou Art' }),
]

describe('RunRail — order-of-service rail (R276)', () => {
  it('marks the active row and renders its title', () => {
    const wrapper = mount(RunRail, { props: { rows: threeRows, activeIndex: 0 } })

    const active = wrapper
      .findAll('[data-testid="rail-item"]')
      .find((w) => w.attributes('data-active') === 'true')
    expect(active).toBeTruthy()
    expect(active!.text()).toContain('Amazing Grace')
  })

  it('emits @jump with the row slot index when a has-slides row is clicked', async () => {
    const wrapper = mount(RunRail, { props: { rows: threeRows, activeIndex: 0 } })

    const slot2 = wrapper
      .findAll('[data-testid="rail-item"]')
      .find((w) => w.text().includes('How Great Thou Art'))
    await slot2!.trigger('click')

    expect(wrapper.emitted('jump')).toEqual([[2]])
  })

  it('renders a no-slides row as inert rail-item-empty (no emit on click)', async () => {
    const wrapper = mount(RunRail, { props: { rows: threeRows, activeIndex: 0 } })

    const empty = wrapper.find('[data-testid="rail-item-empty"]')
    expect(empty.exists()).toBe(true)
    await empty.trigger('click')

    expect(wrapper.emitted('jump')).toBeUndefined()
  })

  it('expands the active item to its slides, each emitting @jump-slide(arrayIndex)', async () => {
    const wrapper = mount(RunRail, {
      props: {
        rows: threeRows,
        activeIndex: 0,
        expandedSlides: [
          { arrayIndex: 0, label: 'Title', isCurrent: true },
          { arrayIndex: 1, label: 'Verse 1', isCurrent: false },
        ],
      },
    })

    const slides = wrapper.findAll('[data-testid="run-rail-slide"]')
    expect(slides).toHaveLength(2)
    await slides[1]!.trigger('click')
    expect(wrapper.emitted('jump-slide')).toEqual([[1]])
  })

  it('renders the "Nothing to present yet" empty state when no row has slides', () => {
    const wrapper = mount(RunRail, { props: { rows: [], activeIndex: null } })

    const emptyState = wrapper.find('[data-testid="run-rail-empty"]')
    expect(emptyState.exists()).toBe(true)
    expect(emptyState.text()).toContain('Nothing to present yet')
    expect(wrapper.find('[data-testid="rail-item"]').exists()).toBe(false)
  })
})
