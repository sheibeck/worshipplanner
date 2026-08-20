import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfigTextField from '../ConfigTextField.vue'

function mountField(props: Partial<InstanceType<typeof ConfigTextField>['$props']> = {}) {
  return mount(ConfigTextField, {
    props: {
      label: 'From address',
      modelValue: 'onboarding@resend.dev',
      required: true,
      ...props,
    },
  })
}

describe('ConfigTextField', () => {
  it('renders the label', () => {
    const wrapper = mountField()
    expect(wrapper.text()).toContain('From address')
  })

  it('shows the (default) badge only when isDefault is true', () => {
    const withoutBadge = mountField({ isDefault: false })
    expect(withoutBadge.text()).not.toContain('(default)')

    const withBadge = mountField({ isDefault: true })
    expect(withBadge.text()).toContain('(default)')
  })

  it('disables Save when required and the value is empty', async () => {
    const wrapper = mountField({ modelValue: 'onboarding@resend.dev' })
    await wrapper.find('input').setValue('')
    expect(wrapper.text()).toContain('This field is required.')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('enables Save when dirty and valid, and emits save with the trimmed value', async () => {
    const wrapper = mountField({ modelValue: 'onboarding@resend.dev' })
    await wrapper.find('input').setValue('  owner@church.org  ')
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('save')).toBeTruthy()
    expect(wrapper.emitted('save')![0]).toEqual(['owner@church.org'])
  })

  it('does not appear dirty on mount when the stored value carries incidental whitespace (IN-03)', () => {
    const wrapper = mountField({ modelValue: '  onboarding@resend.dev  ' })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('disables Save when a value over maxLength is entered', async () => {
    const wrapper = mountField({ label: 'Display name', modelValue: '', required: false, maxLength: 10 })
    await wrapper.find('input').setValue('this is way too long')
    expect(wrapper.text()).toContain('Must be 10 characters or less.')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('disables Save when the parent-owned valid prop is false, even if dirty', async () => {
    const wrapper = mountField({ modelValue: 'onboarding@resend.dev', valid: false })
    await wrapper.find('input').setValue('not-an-email')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('renders a non-null warning in amber and never disables Save', async () => {
    const wrapper = mountField({
      modelValue: 'onboarding@resend.dev',
      warning: "This domain can't be verified in Resend.",
    })
    await wrapper.find('input').setValue('noreply@myapp.web.app')

    const warningEl = wrapper.find('.text-yellow-500')
    expect(warningEl.exists()).toBe(true)
    expect(warningEl.text()).toContain("This domain can't be verified in Resend.")
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
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

  // 70-02 addition: a parent card (SenderConfigCard) needs the LIVE edited
  // value to compute format-validity and the unverifiable-host warning while
  // the user types.
  it('emits update:modelValue with the live input value on every edit', async () => {
    const wrapper = mountField({ modelValue: 'onboarding@resend.dev' })
    await wrapper.find('input').setValue('owner@example.com')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![emitted!.length - 1]).toEqual(['owner@example.com'])
  })
})
