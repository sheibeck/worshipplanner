import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SlideActionMenu from '../SlideActionMenu.vue'
import type { MenuItem } from '../slideDisplay'

// Fixed enum labels from 33-UI-SPEC.md § Copywriting Contract — used for the
// E2 overflow backstop below, kept local since this test asserts against the
// contract's exact wording, not against slideDisplay's internal map.
// D2 (260805-bvo): 'Edit lyrics' removed — the drawer has one edit
// affordance now, so this vocabulary is five labels, not six.
const ALL_LABELS = ['Edit details', 'Edit in song', 'Edit in scripture', 'Duplicate', 'Delete Slide']

const FOUR_ITEMS: MenuItem[] = [
  { key: 'edit-details', label: 'Edit details', tone: 'default' },
  { key: 'edit-in-scripture', label: 'Edit in scripture', tone: 'nav' },
  { key: 'duplicate', label: 'Duplicate', tone: 'default' },
  { key: 'delete', label: 'Delete Slide', tone: 'destructive' },
]

describe('SlideActionMenu', () => {
  it('with open: false, renders the trigger but not the panel, and aria-expanded is the string "false"', () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: false },
    })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    const trigger = wrapper.get('[data-testid="slide-action-trigger-entry-1"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
  })

  it('with open: true, renders the panel with role="menu" and one role="menuitem" per item, and aria-expanded is the string "true"', () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: true },
    })

    const panel = wrapper.get('[data-testid="slide-action-panel-entry-1"]')
    expect(panel.attributes('role')).toBe('menu')
    expect(wrapper.findAll('[role="menuitem"]').length).toBe(FOUR_ITEMS.length)
    expect(wrapper.get('[data-testid="slide-action-trigger-entry-1"]').attributes('aria-expanded')).toBe('true')
  })

  it('clicking the trigger emits toggle once with the entryId, and no select', async () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: false },
    })

    await wrapper.get('[data-testid="slide-action-trigger-entry-1"]').trigger('click')

    expect(wrapper.emitted('toggle')).toEqual([['entry-1']])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it("the trigger's click does not propagate to an ancestor click handler", async () => {
    const ancestorHandler = vi.fn()
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: false },
      attachTo: document.body,
    })
    wrapper.element.parentElement?.addEventListener('click', ancestorHandler)

    await wrapper.get('[data-testid="slide-action-trigger-entry-1"]').trigger('click')

    expect(ancestorHandler).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('clicking an item emits select once with that item\'s key', async () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: true },
    })

    await wrapper.get('[data-testid="slide-action-item-delete"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['delete']])
  })

  it('WR-03: activating the trigger moves focus onto the first menuitem, and Escape from there emits toggle and returns focus to the trigger', async () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: false },
      attachTo: document.body,
    })

    // The real event path a keyboard (or mouse) user goes through: activate
    // the trigger, which emits `toggle` — the PARENT is the one that actually
    // flips `open` (this component holds no state of its own), so the test
    // reproduces that round trip via `setProps` rather than asserting on an
    // internal ref.
    await wrapper.get('[data-testid="slide-action-trigger-entry-1"]').trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([['entry-1']])
    await wrapper.setProps({ open: true })
    // The component's own focus-on-open watcher awaits its own `nextTick()`
    // internally (a second microtask hop beyond the render VTU's `setProps`
    // already waited for) — `flushPromises` drains that too.
    await flushPromises()

    const firstItem = wrapper.get('[data-testid="slide-action-item-edit-details"]')
    expect(document.activeElement).toBe(firstItem.element)

    // Escape dispatched from the ACTUAL focused element inside the panel —
    // not directly on the panel div. Dispatching straight at the panel (the
    // pre-fix version of this test) bypasses the real DOM focus/bubble path
    // a keyboard user is actually in immediately after opening the menu, and
    // was why this test kept passing while Escape did nothing for a real
    // user (WR-03).
    await firstItem.trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('toggle')).toEqual([['entry-1'], ['entry-1']])
    expect(document.activeElement).toBe(wrapper.get('[data-testid="slide-action-trigger-entry-1"]').element)
    wrapper.unmount()
  })

  it('a non-Escape keydown inside the panel emits nothing', async () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: true },
    })

    const panel = wrapper.get('[data-testid="slide-action-panel-entry-1"]')
    await panel.trigger('keydown', { key: 'ArrowDown' })

    expect(wrapper.emitted('toggle')).toBeUndefined()
  })

  it('clicking the click-away backdrop emits toggle', async () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: true },
    })

    await wrapper.get('div.fixed.inset-0').trigger('click')

    expect(wrapper.emitted('toggle')).toEqual([['entry-1']])
  })

  it("each item's rendered class carries the tone-appropriate color: nav indigo, destructive red, default gray", () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: true },
    })

    expect(wrapper.get('[data-testid="slide-action-item-edit-details"]').classes()).toContain('text-gray-200')
    expect(wrapper.get('[data-testid="slide-action-item-edit-in-scripture"]').classes()).toContain('text-indigo-400')
    expect(wrapper.get('[data-testid="slide-action-item-delete"]').classes()).toContain('text-red-400')
  })

  it('R099 (48-02 Task 2): gives the trigger a >=44px hit area via unconditional padding + compensating negative margin, without enlarging the icon', () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: false },
    })

    const trigger = wrapper.get('[data-testid="slide-action-trigger-entry-1"]')
    expect(trigger.classes()).toContain('p-3')
    expect(trigger.classes()).toContain('-m-3')
    const svg = trigger.find('svg')
    expect(svg.classes()).toContain('h-5')
    expect(svg.classes()).toContain('w-5')
  })

  it('backstop: the panel carries the fixed width token and the right-edge anchor, so it cannot grow past the narrowest card', () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: true },
    })

    const panelClasses = wrapper.get('[data-testid="slide-action-panel-entry-1"]').classes()
    expect(panelClasses).toContain('w-40')
    expect(panelClasses).toContain('right-0')
  })

  it('backstop: no label contains an unbroken word long enough to force a wrap at the fixed w-40 (160px) panel width', () => {
    const longestWord = Math.max(...ALL_LABELS.flatMap((label) => label.split(' ').map((word) => word.length)))
    // w-40 (160px) with px-3 py-2 padding and text-sm comfortably fits words
    // well under 20 characters without wrapping; the longest word among all
    // five fixed labels ("scripture", 9 chars) is far under this ceiling.
    expect(longestWord).toBeLessThanOrEqual(12)
  })
})
