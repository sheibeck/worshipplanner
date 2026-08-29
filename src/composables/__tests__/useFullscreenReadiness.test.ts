// Phase 98 Plan 01 (R285/R287). Direct unit test of the read-only
// useFullscreenReadiness composable, driven through a trivial host component
// so its onMounted/onUnmounted hooks actually fire — mirroring
// useOutputWindow.test.ts's mountHost pattern and its exact
// navigator.permissions mocking idiom.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useFullscreenReadiness } from '../useFullscreenReadiness'

enableAutoUnmount(afterEach)

function installPermissions(query: (descriptor: unknown) => Promise<{ state: string }>) {
  Object.defineProperty(navigator, 'permissions', {
    value: { query: vi.fn(query) },
    configurable: true,
    writable: true,
  })
  return (navigator as unknown as { permissions: { query: ReturnType<typeof vi.fn> } }).permissions.query
}

function uninstallPermissions() {
  // Delete (not just set undefined) so `'permissions' in navigator` reports
  // false again, matching jsdom's real default-absent state.
  delete (navigator as unknown as { permissions?: unknown }).permissions
}

const TestHost = defineComponent({
  setup() {
    return useFullscreenReadiness()
  },
  template: '<div data-testid="status">{{ status }}</div>',
})

beforeEach(() => {
  Element.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
})

afterEach(() => {
  uninstallPermissions()
})

describe('useFullscreenReadiness', () => {
  it('resolves ready when the permission state is granted', async () => {
    const query = installPermissions(() => Promise.resolve({ state: 'granted' }))
    const wrapper = mount(TestHost)
    await flushPromises()

    expect(wrapper.vm.status).toBe('ready')
    expect(query.mock.calls[0]![0]).toMatchObject({ name: 'fullscreen', allowWithoutGesture: true })
  })

  it('resolves not-ready when the permission state is denied', async () => {
    installPermissions(() => Promise.resolve({ state: 'denied' }))
    const wrapper = mount(TestHost)
    await flushPromises()

    expect(wrapper.vm.status).toBe('not-ready')
  })

  it('resolves not-ready when the permission state is prompt', async () => {
    installPermissions(() => Promise.resolve({ state: 'prompt' }))
    const wrapper = mount(TestHost)
    await flushPromises()

    expect(wrapper.vm.status).toBe('not-ready')
  })

  it('resolves unsupported when navigator.permissions is absent', async () => {
    uninstallPermissions()
    expect('permissions' in navigator).toBe(false)

    const wrapper = mount(TestHost)
    await flushPromises()

    expect(wrapper.vm.status).toBe('unsupported')
  })

  it('resolves unsupported when query() throws', async () => {
    installPermissions(() => Promise.reject(new TypeError('unsupported descriptor')))
    const wrapper = mount(TestHost)
    await flushPromises()

    expect(wrapper.vm.status).toBe('unsupported')
  })

  it('NEVER calls requestFullscreen — it is a read-only status query', async () => {
    installPermissions(() => Promise.resolve({ state: 'granted' }))
    const wrapper = mount(TestHost)
    await flushPromises()

    expect(wrapper.vm.status).toBe('ready')
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
  })

  it('re-queries on window focus while not-ready', async () => {
    const query = installPermissions(() => Promise.resolve({ state: 'denied' }))
    mount(TestHost)
    await flushPromises()
    expect(query).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('does NOT re-query on window focus once ready', async () => {
    const query = installPermissions(() => Promise.resolve({ state: 'granted' }))
    mount(TestHost)
    await flushPromises()
    expect(query).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('degrades ready back to not-ready when a manual recheck resolves non-granted', async () => {
    let state = 'granted'
    installPermissions(() => Promise.resolve({ state }))
    const wrapper = mount(TestHost)
    await flushPromises()
    expect(wrapper.vm.status).toBe('ready')

    state = 'denied'
    await wrapper.vm.recheck()
    await flushPromises()
    expect(wrapper.vm.status).toBe('not-ready')
  })

  it('removes the focus listener on unmount', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    installPermissions(() => Promise.resolve({ state: 'denied' }))
    const wrapper = mount(TestHost)
    await flushPromises()

    wrapper.unmount()
    expect(removeSpy.mock.calls.some((c) => c[0] === 'focus')).toBe(true)
  })
})
