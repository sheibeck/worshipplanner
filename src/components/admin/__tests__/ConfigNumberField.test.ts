import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfigNumberField from '../ConfigNumberField.vue'

function mountField(props: Partial<InstanceType<typeof ConfigNumberField>['$props']> = {}) {
  return mount(ConfigNumberField, {
    props: {
      label: 'Media retention (days)',
      modelValue: 30,
      min: 1,
      max: 365,
      integer: true,
      required: true,
      ...props,
    },
  })
}

describe('ConfigNumberField', () => {
  it('renders the label', () => {
    const wrapper = mountField()
    expect(wrapper.text()).toContain('Media retention (days)')
  })

  it('shows the (default) badge only when isDefault is true', async () => {
    const withoutBadge = mountField({ isDefault: false })
    expect(withoutBadge.text()).not.toContain('(default)')

    const withBadge = mountField({ isDefault: true })
    expect(withBadge.text()).toContain('(default)')
  })

  it('shows an inline error and disables Save when the value is below min', async () => {
    const wrapper = mountField()
    await wrapper.find('input').setValue(0)
    expect(wrapper.text()).toContain('Must be at least 1.')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('shows an inline error and disables Save when the value is above max (upper bound)', async () => {
    const wrapper = mountField()
    await wrapper.find('input').setValue(9999)
    expect(wrapper.text()).toContain('Must be 365 or less.')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('shows an inline error and disables Save for a non-integer value when integer=true', async () => {
    const wrapper = mountField()
    await wrapper.find('input').setValue(30.5)
    expect(wrapper.text()).toContain('Must be a whole number.')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('disables Save when the value equals modelValue (not dirty)', () => {
    const wrapper = mountField({ modelValue: 30 })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('enables Save for a valid, changed value and emits save with the numeric value on click', async () => {
    const wrapper = mountField({ modelValue: 30 })
    await wrapper.find('input').setValue(45)
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('save')).toBeTruthy()
    expect(wrapper.emitted('save')![0]).toEqual([45])
  })

  it('renders externalError and disables Save even when own bounds pass', async () => {
    const wrapper = mountField({ modelValue: 30, externalError: 'Daily limit must be at least the per-minute limit.' })
    await wrapper.find('input').setValue(45)
    expect(wrapper.text()).toContain('Daily limit must be at least the per-minute limit.')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('shows "Saving..." while saving', () => {
    const wrapper = mountField({ saving: true })
    expect(wrapper.find('button').text()).toBe('Saving...')
  })

  it('shows "Saved!" when saved', () => {
    const wrapper = mountField({ saved: true })
    expect(wrapper.find('button').text()).toBe('Saved!')
  })

  it('renders the generic saveError line', () => {
    const wrapper = mountField({ saveError: 'Failed to save. Please try again.' })
    expect(wrapper.text()).toContain('Failed to save. Please try again.')
  })
})
