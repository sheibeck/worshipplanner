import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SlideActionMenu from '../SlideActionMenu.vue'
import type { MenuItem } from '../slideDisplay'

// Fixed enum labels from 33-UI-SPEC.md § Copywriting Contract — used for the
// E2 overflow backstop below, kept local since this test asserts against the
// contract's exact wording, not against slideDisplay's internal map.
const ALL_LABELS = ['Edit details', 'Edit lyrics', 'Edit in song', 'Edit in scripture', 'Duplicate', 'Delete Slide']

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

  it('pressing Escape inside the open panel emits toggle and moves focus back to the trigger', async () => {
    const wrapper = mount(SlideActionMenu, {
      props: { entryId: 'entry-1', items: FOUR_ITEMS, open: true },
      attachTo: document.body,
    })

    const panel = wrapper.get('[data-testid="slide-action-panel-entry-1"]')
    await panel.trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('toggle')).toEqual([['entry-1']])
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
    // six fixed labels ("scripture", 9 chars) is far under this ceiling.
    expect(longestWord).toBeLessThanOrEqual(12)
  })
})
