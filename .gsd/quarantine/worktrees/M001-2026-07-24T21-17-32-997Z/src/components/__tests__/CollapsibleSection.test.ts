import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CollapsibleSection from '../CollapsibleSection.vue'

describe('CollapsibleSection', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to expanded (body slot visible) when no localStorage value exists (D-17)', () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: 'Volunteer Availability', storageKey: 'schedule.section.volunteerAvailability' },
      slots: { default: '<p>Body content</p>' },
    })

    expect(wrapper.text()).toContain('Volunteer Availability')
    expect(wrapper.find('p').exists()).toBe(true)
    expect(wrapper.text()).toContain('Body content')
  })

  it('clicking the header collapses the body and writes "closed" to localStorage', async () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: 'Service dates', storageKey: 'schedule.section.serviceDates' },
      slots: { default: '<p>Body content</p>' },
    })

    expect(wrapper.find('p').exists()).toBe(true)

    await wrapper.find('[data-role="collapsible-header"]').trigger('click')

    expect(wrapper.find('p').exists()).toBe(false)
    expect(localStorage.getItem('schedule.section.serviceDates')).toBe('closed')
  })

  it('remounting with a "closed" localStorage value starts collapsed', () => {
    localStorage.setItem('schedule.section.generateControls', 'closed')

    const wrapper = mount(CollapsibleSection, {
      props: { title: 'Generate controls', storageKey: 'schedule.section.generateControls' },
      slots: { default: '<p>Body content</p>' },
    })

    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('clicking again on a collapsed section re-expands it and writes "open" to localStorage', async () => {
    localStorage.setItem('schedule.section.generateControls', 'closed')

    const wrapper = mount(CollapsibleSection, {
      props: { title: 'Generate controls', storageKey: 'schedule.section.generateControls' },
      slots: { default: '<p>Body content</p>' },
    })

    expect(wrapper.find('p').exists()).toBe(false)

    await wrapper.find('[data-role="collapsible-header"]').trigger('click')

    expect(wrapper.find('p').exists()).toBe(true)
    expect(localStorage.getItem('schedule.section.generateControls')).toBe('open')
  })
})
