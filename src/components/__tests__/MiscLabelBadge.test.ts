import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MiscLabelBadge from '@/components/MiscLabelBadge.vue'

const BASE = {
  badgeClass: 'bg-gray-800',
  testidBase: 'misc-x',
}

describe('MiscLabelBadge', () => {
  it('non-editable: renders a static span with the label, no button, no input', async () => {
    const w = mount(MiscLabelBadge, { props: { ...BASE, editable: false, modelValue: 'Communion' } })
    const badge = w.get('[data-testid="misc-x-badge"]')
    expect(badge.element.tagName).toBe('SPAN')
    expect(badge.text()).toContain('Communion')
    // Clicking a static badge does nothing.
    await badge.trigger('click')
    expect(w.find('[data-testid="misc-x-input"]').exists()).toBe(false)
  })

  it('non-editable + no label: shows the "Miscellaneous" placeholder', () => {
    const w = mount(MiscLabelBadge, { props: { ...BASE, editable: false } })
    expect(w.get('[data-testid="misc-x-badge"]').text()).toContain('Miscellaneous')
  })

  it('editable: the pill is a button; clicking reveals the inline input pre-filled', async () => {
    const w = mount(MiscLabelBadge, { props: { ...BASE, editable: true, modelValue: 'Communion' } })
    const badge = w.get('[data-testid="misc-x-badge"]')
    expect(badge.element.tagName).toBe('BUTTON')
    expect(w.find('[data-testid="misc-x-input"]').exists()).toBe(false)

    await badge.trigger('click')
    const input = w.get('[data-testid="misc-x-input"]')
    expect((input.element as HTMLInputElement).value).toBe('Communion')
  })

  it('typing + blur emits the trimmed value; Enter also commits', async () => {
    const w = mount(MiscLabelBadge, { props: { ...BASE, editable: true } })
    await w.get('[data-testid="misc-x-badge"]').trigger('click')
    const input = w.get('[data-testid="misc-x-input"]')
    await input.setValue('  Offering  ')
    await input.trigger('blur')
    const ev = w.emitted('update:modelValue')!
    expect(ev[ev.length - 1]).toEqual(['Offering'])
  })

  it('clearing to empty emits undefined (stripUndefined-friendly)', async () => {
    const w = mount(MiscLabelBadge, { props: { ...BASE, editable: true, modelValue: 'Communion' } })
    await w.get('[data-testid="misc-x-badge"]').trigger('click')
    const input = w.get('[data-testid="misc-x-input"]')
    await input.setValue('')
    await input.trigger('blur')
    const ev = w.emitted('update:modelValue')!
    expect(ev[ev.length - 1]).toEqual([undefined])
  })

  it('Escape cancels without emitting and closes the input', async () => {
    const w = mount(MiscLabelBadge, { props: { ...BASE, editable: true, modelValue: 'Communion' } })
    await w.get('[data-testid="misc-x-badge"]').trigger('click')
    const input = w.get('[data-testid="misc-x-input"]')
    await input.setValue('Changed')
    await input.trigger('keyup.esc')
    await input.trigger('blur') // esc blurs; the guard makes this a no-op
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.find('[data-testid="misc-x-input"]').exists()).toBe(false)
  })

  it('a no-op edit (value unchanged) does not emit', async () => {
    const w = mount(MiscLabelBadge, { props: { ...BASE, editable: true, modelValue: 'Communion' } })
    await w.get('[data-testid="misc-x-badge"]').trigger('click')
    await w.get('[data-testid="misc-x-input"]').trigger('blur')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
