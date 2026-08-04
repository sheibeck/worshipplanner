import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextualActionBar from '../ContextualActionBar.vue'
import type { ActionBarItem } from '../actionBarItems'

// R068 acceptance, component half (36-02 Task 1). The pure data-level
// acceptance for WHICH keys appear per tab lives in
// src/views/__tests__/serviceEditorActionBar.test.ts (Task 2) — this file
// only proves the generic renderer: given a declarative items array, does it
// render the right buttons, the right chrome, and dispatch the right
// handlers, without deciding anything about content itself.

describe('ContextualActionBar', () => {
  it('items: [] renders the container with zero buttons and no chrome classes (31-UI-SPEC E5)', () => {
    const wrapper = mount(ContextualActionBar, { props: { items: [] } })

    const container = wrapper.get('[data-testid="contextual-action-bar"]')
    expect(wrapper.findAll('button').length).toBe(0)

    const classAttr = container.attributes('class') ?? ''
    for (const forbidden of ['border', 'bg-', 'px-', 'py-', 'rounded', 'mb-', 'mt-']) {
      expect(classAttr).not.toContain(forbidden)
    }
  })

  it('renders one button per item, in array order, each type="button", each default testid action-bar-item-{key}', () => {
    const items: ActionBarItem[] = [
      { key: 'first', label: 'First', onClick: vi.fn() },
      { key: 'second', label: 'Second', onClick: vi.fn() },
      { key: 'third', label: 'Third', onClick: vi.fn() },
    ]
    const wrapper = mount(ContextualActionBar, { props: { items } })

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(3)
    expect(buttons.map((b) => b.attributes('data-testid'))).toEqual([
      'action-bar-item-first',
      'action-bar-item-second',
      'action-bar-item-third',
    ])
    for (const b of buttons) {
      expect(b.attributes('type')).toBe('button')
    }
  })

  it('a testId override replaces the default action-bar-item-{key} testid', () => {
    const items: ActionBarItem[] = [
      { key: 'copy-pc', label: 'Copy for PC', onClick: vi.fn(), testId: 'copy-pc-btn' },
    ]
    const wrapper = mount(ContextualActionBar, { props: { items } })

    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="action-bar-item-copy-pc"]').exists()).toBe(false)
  })

  it('disabled: true sets the disabled attribute and a click does not invoke onClick', async () => {
    const onClick = vi.fn()
    const items: ActionBarItem[] = [{ key: 'save', label: 'Save', onClick, disabled: true }]
    const wrapper = mount(ContextualActionBar, { props: { items } })

    const button = wrapper.get('[data-testid="action-bar-item-save"]')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disabled absent: a click invokes onClick exactly once', async () => {
    const onClick = vi.fn()
    const items: ActionBarItem[] = [{ key: 'save', label: 'Save', onClick }]
    const wrapper = mount(ContextualActionBar, { props: { items } })

    const button = wrapper.get('[data-testid="action-bar-item-save"]')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('title binds to the button title attribute; absent title leaves it undefined', () => {
    const items: ActionBarItem[] = [
      { key: 'with-title', label: 'With title', onClick: vi.fn(), title: 'A tooltip' },
      { key: 'without-title', label: 'Without title', onClick: vi.fn() },
    ]
    const wrapper = mount(ContextualActionBar, { props: { items } })

    expect(wrapper.get('[data-testid="action-bar-item-with-title"]').attributes('title')).toBe('A tooltip')
    expect(wrapper.get('[data-testid="action-bar-item-without-title"]').attributes('title')).toBeUndefined()
  })

  it('tone: primary is filled indigo; tone: present is outlined indigo — the two never collapse into one treatment', () => {
    const items: ActionBarItem[] = [
      { key: 'save', label: 'Save', onClick: vi.fn(), tone: 'primary' },
      { key: 'present', label: 'Present', onClick: vi.fn(), tone: 'present' },
    ]
    const wrapper = mount(ContextualActionBar, { props: { items } })

    const primaryClass = wrapper.get('[data-testid="action-bar-item-save"]').attributes('class') ?? ''
    expect(primaryClass).toContain('bg-indigo-600')

    const presentClass = wrapper.get('[data-testid="action-bar-item-present"]').attributes('class') ?? ''
    expect(presentClass).toContain('border-indigo-400/60')
    expect(presentClass).toContain('text-indigo-300')
    expect(presentClass).not.toContain('bg-indigo-600')
  })

  it('icon: present renders an aria-hidden glyph element and the button text still contains the label; every rendered svg carries aria-hidden="true"', () => {
    const items: ActionBarItem[] = [
      { key: 'present', label: 'Present', onClick: vi.fn(), icon: 'present' },
      { key: 'suggest-all-songs', label: 'Suggest All Songs', onClick: vi.fn(), icon: 'ai-sparkle' },
    ]
    const wrapper = mount(ContextualActionBar, { props: { items } })

    const presentButton = wrapper.get('[data-testid="action-bar-item-present"]')
    const glyph = presentButton.get('[aria-hidden="true"]')
    expect(glyph.exists()).toBe(true)
    expect(presentButton.text()).toContain('Present')

    const svgs = wrapper.findAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) {
      expect(svg.attributes('aria-hidden')).toBe('true')
    }
  })

  it('a hint-{key} slot renders nothing when that key is absent from items, and renders after that button when present', () => {
    const items: ActionBarItem[] = [{ key: 'copy-pc', label: 'Copy for PC', onClick: vi.fn() }]

    const wrapperWithoutMatchingKey = mount(ContextualActionBar, {
      props: { items: [{ key: 'save', label: 'Save', onClick: vi.fn() }] },
      slots: { 'hint-export-pc': '<span data-testid="the-hint">unrelated hint</span>' },
    })
    expect(wrapperWithoutMatchingKey.find('[data-testid="the-hint"]').exists()).toBe(false)

    const wrapperWithMatchingKey = mount(ContextualActionBar, {
      props: { items },
      slots: { 'hint-copy-pc': '<span data-testid="the-hint">configure them in Settings</span>' },
    })
    expect(wrapperWithMatchingKey.find('[data-testid="the-hint"]').exists()).toBe(true)
    expect(wrapperWithMatchingKey.text()).toContain('configure them in Settings')
  })
})
