import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SaveStatusIndicator from '../SaveStatusIndicator.vue'
import { useSaveStatus } from '@/stores/saveStatus'

const REORDER_ERROR_TEXT = "Couldn't save this order — reverted. Try dragging again."
const GENERIC_ERROR_TEXT = "Couldn't save your changes — they're still here. Try again."

describe('SaveStatusIndicator', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function mountIndicator(surfaceId = 'service:svc-1') {
    return mount(SaveStatusIndicator, {
      props: { surfaceId },
    })
  }

  it('renders nothing at idle — no placeholder box, empty text content', () => {
    const wrapper = mountIndicator()

    expect(wrapper.text()).toBe('')
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('renders "Saving soon…" at pending', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'pending' })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('Saving soon…')
  })

  it('renders "Saving…" at saving', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'saving' })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('Saving…')
  })

  it('renders "Saved 2:47 PM" for a savedAt of 14:47 local', async () => {
    const wrapper = mountIndicator()
    const savedAt = new Date()
    savedAt.setHours(14, 47, 0, 0)
    useSaveStatus().set('service:svc-1', { status: 'saved', savedAt })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('Saved 2:47 PM')
  })

  it('matches the general "Saved h:mm AM/PM" pattern for any saved time', async () => {
    const wrapper = mountIndicator()
    const savedAt = new Date()
    savedAt.setHours(9, 5, 0, 0)
    useSaveStatus().set('service:svc-1', { status: 'saved', savedAt })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toMatch(/^Saved \d{1,2}:\d{2} (AM|PM)$/)
  })

  it('renders the exact reorder error sentence and carries data-testid="save-status-error"', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'error', errorText: REORDER_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    const errorEl = wrapper.find('[data-testid="save-status-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toBe(REORDER_ERROR_TEXT)
  })

  it('renders the exact generic error sentence', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'error', errorText: GENERIC_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="save-status-error"]').text()).toBe(GENERIC_ERROR_TEXT)
  })

  it('wrapper always carries aria-live="polite", aria-atomic="true" and data-testid="save-status", including in the error state', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'error', errorText: GENERIC_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    const root = wrapper.find('[data-testid="save-status"]')
    expect(root.attributes('aria-live')).toBe('polite')
    expect(root.attributes('aria-atomic')).toBe('true')
  })

  it('has exactly one element with an aria-live attribute in the mounted subtree, even in the error state', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'error', errorText: GENERIC_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[aria-live]')).toHaveLength(1)
  })

  it('WR-01 (32-REVIEW): falls back to the generic sentence when errorText is missing, rather than rendering blank', async () => {
    const wrapper = mountIndicator()
    // No errorText — nothing in the type system currently prevents a caller
    // from omitting it (SaveStatusEntry.errorText is optional).
    useSaveStatus().set('service:svc-1', { status: 'error' })
    await wrapper.vm.$nextTick()

    const errorEl = wrapper.find('[data-testid="save-status-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toBe(GENERIC_ERROR_TEXT)
  })

  it('renders idle for an unknown surfaceId rather than throwing', () => {
    useSaveStatus().set('service:svc-1', { status: 'saving' })
    const wrapper = mountIndicator('service:never-registered')

    expect(wrapper.text()).toBe('')
  })

  it('re-renders reactively when the store entry changes', async () => {
    const wrapper = mountIndicator()
    const store = useSaveStatus()

    store.set('service:svc-1', { status: 'pending' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('Saving soon…')

    store.set('service:svc-1', { status: 'saving' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('Saving…')

    store.clear('service:svc-1')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('')
  })

  it('E1 overflow backstop: the 59-char generic error string renders without a truncation class inside a narrow fixed-width host', async () => {
    const wrapper = mount(
      {
        components: { SaveStatusIndicator },
        template: `<div style="width: 120px"><SaveStatusIndicator surface-id="song-lyrics:song-1" /></div>`,
      },
      { attachTo: document.body },
    )
    useSaveStatus().set('song-lyrics:song-1', { status: 'error', errorText: GENERIC_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    const errorEl = wrapper.find('[data-testid="save-status-error"]')
    expect(errorEl.classes().join(' ')).not.toMatch(/truncate|overflow-hidden|text-ellipsis|line-clamp/)
    expect(errorEl.text()).toBe(GENERIC_ERROR_TEXT)
    expect(GENERIC_ERROR_TEXT.length).toBe(59)

    wrapper.unmount()
  })
})
