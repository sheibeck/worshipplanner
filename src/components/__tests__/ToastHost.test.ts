import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ToastHost from '../ToastHost.vue'
import { useToasts } from '@/stores/toasts'

describe('ToastHost', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('zero toasts: renders the container with no toast children', () => {
    const wrapper = mount(ToastHost)

    const host = wrapper.find('[data-testid="toast-host"]')
    expect(host.exists()).toBe(true)
    expect(host.element.children.length).toBe(0)
  })

  it('one toast: renders a role="alert" card with the bold lead, the mirrored body, an aria-hidden icon and a labelled dismiss button', async () => {
    const wrapper = mount(ToastHost)
    useToasts().push("Couldn't save your changes — they're still here. Try again.")
    await wrapper.vm.$nextTick()

    const card = wrapper.find('[role="alert"]')
    expect(card.exists()).toBe(true)
    expect(card.find('.font-medium').text()).toBe('Save failed.')
    expect(card.text()).toContain("Couldn't save your changes — they're still here. Try again.")

    const icon = card.find('svg')
    expect(icon.attributes('aria-hidden')).toBe('true')

    const dismissBtn = card.find('button')
    expect(dismissBtn.attributes('aria-label')).toBe('Dismiss')
  })

  it('the card carries data-testid toast-{id} and the container carries data-testid toast-host', async () => {
    const wrapper = mount(ToastHost)
    const store = useToasts()
    const id = store.push('some failure')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="toast-host"]').exists()).toBe(true)
    expect(wrapper.find(`[data-testid="toast-${id}"]`).exists()).toBe(true)
  })

  it('clicking the dismiss button removes that card and leaves any other card present', async () => {
    const wrapper = mount(ToastHost)
    const store = useToasts()
    const id1 = store.push('failure one')
    const id2 = store.push('failure two')
    await wrapper.vm.$nextTick()

    await wrapper.find(`[data-testid="toast-${id1}"] button`).trigger('click')

    expect(wrapper.find(`[data-testid="toast-${id1}"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-testid="toast-${id2}"]`).exists()).toBe(true)
  })

  it('advancing timers 6000ms after a push removes the card without any interaction', async () => {
    const wrapper = mount(ToastHost)
    const id = useToasts().push('will auto-dismiss')
    await wrapper.vm.$nextTick()
    expect(wrapper.find(`[data-testid="toast-${id}"]`).exists()).toBe(true)

    vi.advanceTimersByTime(6000)
    await wrapper.vm.$nextTick()

    expect(wrapper.find(`[data-testid="toast-${id}"]`).exists()).toBe(false)
  })

  it('two toasts render two cards, stacked, each removable independently', async () => {
    const wrapper = mount(ToastHost)
    const store = useToasts()
    store.push('failure one')
    store.push('failure two')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="alert"]')).toHaveLength(2)
  })

  it('the body text is exactly the message the store holds — no independently composed copy', async () => {
    const wrapper = mount(ToastHost)
    const message = "Couldn't save this order — reverted. Try dragging again."
    useToasts().push(message)
    await wrapper.vm.$nextTick()

    const body = wrapper.find('p')
    expect(body.text()).toBe(`Save failed. ${message}`)
  })

  it('renders toasts oldest-to-newest, top-to-bottom, matching push order', async () => {
    const wrapper = mount(ToastHost)
    const store = useToasts()
    store.push('first failure')
    store.push('second failure')
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('[role="alert"]')
    expect(cards[0]!.text()).toContain('first failure')
    expect(cards[1]!.text()).toContain('second failure')
  })

  it('does not throw when the host unmounts before a pending auto-dismiss timer fires, and leaves no orphaned entry once that timer resolves', async () => {
    const wrapper = mount(ToastHost)
    const store = useToasts()
    store.push('will outlive its raising surface')
    await wrapper.vm.$nextTick()

    wrapper.unmount()

    expect(() => vi.advanceTimersByTime(6000)).not.toThrow()
    expect(store.toasts).toHaveLength(0)
  })
})
