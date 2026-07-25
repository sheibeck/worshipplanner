import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PerformanceOrderBuilder from '../PerformanceOrderBuilder.vue'
import type { LyricSection } from '@/types/songLyrics'

// Mock SortableJS — we test drag-and-drop behavior via the reactive array,
// not through real DOM drag events (jsdom does not support them).
vi.mock('sortablejs', () => {
  const mockCreate = vi.fn(() => ({ destroy: vi.fn() }))
  return {
    default: { create: mockCreate },
  }
})

function makeSections(): LyricSection[] {
  return [
    { id: 'verse-1', label: 'Verse 1', lines: ['Amazing grace'] },
    { id: 'chorus', label: 'Chorus', lines: ['How sweet the sound'] },
    { id: 'verse-2', label: 'Verse 2', lines: ['Through many dangers'] },
  ]
}

describe('PerformanceOrderBuilder', () => {
  const sections = makeSections()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders available sections as clickable buttons', () => {
    const wrapper = mount(PerformanceOrderBuilder, {
      props: { sections, performanceOrder: [] },
    })

    const buttons = wrapper.findAll('[data-role="add-section"]')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]!.text()).toBe('Verse 1')
    expect(buttons[1]!.text()).toBe('Chorus')
    expect(buttons[2]!.text()).toBe('Verse 2')
  })

  it('clicking a section adds it to the performance order', async () => {
    const wrapper = mount(PerformanceOrderBuilder, {
      props: { sections, performanceOrder: [] },
    })

    const btn = wrapper.find('button[data-section-id="chorus"]')
    await btn.trigger('click')
    await wrapper.vm.$nextTick()

    // Check DOM updated (proves handler ran and reactive state changed)
    const orderItems = wrapper.findAll('[data-role="order-item"]')
    expect(orderItems).toHaveLength(1)
    expect(orderItems[0]!.text()).toContain('Chorus')

    const emitted = wrapper.emitted('update:performanceOrder')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([['chorus']])
  })

  it('clicking a section multiple times adds repeats', async () => {
    const wrapper = mount(PerformanceOrderBuilder, {
      props: { sections, performanceOrder: ['verse-1'] },
    })

    await wrapper.find('[data-section-id="chorus"]').trigger('click')

    let emitted = wrapper.emitted('update:performanceOrder')!
    expect(emitted[0]).toEqual([['verse-1', 'chorus']])

    // Update props to reflect the emitted state and click again
    await wrapper.setProps({ performanceOrder: ['verse-1', 'chorus'] })
    await wrapper.find('[data-section-id="chorus"]').trigger('click')

    emitted = wrapper.emitted('update:performanceOrder')!
    expect(emitted[1]).toEqual([['verse-1', 'chorus', 'chorus']])
  })

  it('removing a section from the order emits updated array', async () => {
    const wrapper = mount(PerformanceOrderBuilder, {
      props: {
        sections,
        performanceOrder: ['verse-1', 'chorus', 'verse-2'],
      },
    })

    const orderItems = wrapper.findAll('[data-role="order-item"]')
    expect(orderItems).toHaveLength(3)

    // Remove the second item (chorus)
    const removeButtons = wrapper.findAll('[data-role="remove-section"]')
    await removeButtons[1]!.trigger('click')

    const emitted = wrapper.emitted('update:performanceOrder')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([['verse-1', 'verse-2']])
  })

  it('reset to default restores definition order (each section once)', async () => {
    const wrapper = mount(PerformanceOrderBuilder, {
      props: {
        sections,
        performanceOrder: ['chorus', 'chorus', 'verse-2', 'verse-1'],
      },
    })

    await wrapper.find('[data-role="reset-order"]').trigger('click')

    const emitted = wrapper.emitted('update:performanceOrder')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([['verse-1', 'chorus', 'verse-2']])
  })

  it('displays order items with correct labels', () => {
    const wrapper = mount(PerformanceOrderBuilder, {
      props: {
        sections,
        performanceOrder: ['chorus', 'verse-1'],
      },
    })

    const items = wrapper.findAll('[data-role="order-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Chorus')
    expect(items[1]!.text()).toContain('Verse 1')
  })

  it('shows empty state when no sections are in the order', () => {
    const wrapper = mount(PerformanceOrderBuilder, {
      props: { sections, performanceOrder: [] },
    })

    expect(wrapper.text()).toContain('Click sections to build the order')
  })

  it('hides reset button when order is empty', () => {
    const wrapper = mount(PerformanceOrderBuilder, {
      props: { sections, performanceOrder: [] },
    })

    expect(wrapper.find('[data-role="reset-order"]').exists()).toBe(false)
  })
})
