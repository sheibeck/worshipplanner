/**
 * Phase 94 Plan 03 (R272). Direct unit test of the shared output-window
 * lifecycle-core `useOutputWindow` (extracted in 94-01), driven through a trivial
 * host component so its onMounted/onUnmounted hooks actually fire.
 *
 * The two output views (audience + confidence) exercise this composable through
 * their own render bodies; this suite asserts the shared lifecycle ONCE, centrally,
 * against the composable's returned surface + the in-memory run-channel fake:
 *  - index set from onState (+ higher-seq advance + stale/lower-seq drop);
 *  - postHello on mount, NEVER postState across the whole lifecycle;
 *  - the WR-02 org-scoped subscribe gate (fresh / different-org / same-org);
 *  - Screen Wake Lock acquire-on-mount + re-acquire-on-visibilitychange +
 *    release-on-unmount, and the absent-API no-throw case;
 *  - isFullscreen tracking a dispatched fullscreenchange WITHOUT ever tearing the
 *    channel down (Pitfall 6);
 *  - the bounded font gate resolving fontReady true;
 *  - handle.close() + serviceStore.unsubscribeAll() firing on unmount.
 *
 * Harness lineage: AudienceOutputView.test.ts — its mock shapes (reactive route,
 * inert @/firebase, mocked stores + useSlideshowAssembly), the in-memory channel
 * fake, the wake-lock install/delete idiom, and the Fullscreen/fonts/visibility
 * stubs are reused verbatim. No SlideCanvas stub — the composable never imports it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { reactive, defineComponent, h, type PropType } from 'vue'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelLike, BroadcastChannelFactory } from '@/utils/runChannel'
import { useOutputWindow } from '../useOutputWindow'

// onUnmounted must run so the channel-close, wake-lock-release, and
// unsubscribeAll cleanup this suite asserts actually fire.
enableAutoUnmount(afterEach)

// ── Mocks (mirrored from AudienceOutputView.test.ts) ────────────────────────────

const mockRoute = reactive({ params: { serviceId: 'service-1' }, query: { org: 'org-1' } })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
}))

const { serviceStoreMock, fakeSlides } = vi.hoisted(() => {
  function fakeSlide(id: string): unknown {
    return {
      slide: {
        id,
        position: 0,
        contentKind: 'lyric',
        sectionId: 'verse-1',
        sectionLabel: 'Verse 1',
        lines: [`line for ${id}`],
      },
      slotIndex: 0,
      slotKind: 'SONG',
      section: 'worship',
      sourceId: 'song-1',
    }
  }
  return {
    serviceStoreMock: {
      services: [] as unknown[],
      orgId: null as string | null,
      subscribe: vi.fn(),
      unsubscribeAll: vi.fn(),
    },
    fakeSlides: [fakeSlide('a'), fakeSlide('b'), fakeSlide('c')],
  }
})

vi.mock('@/firebase', () => ({ auth: {}, db: {}, functions: {} }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    orgId: 'org-1',
    settings: {
      slideTypography: { fontFamily: 'Inter', fontWeight: 400, fontScale: 'md' },
    },
  }),
}))

vi.mock('@/stores/services', () => ({
  useServiceStore: () => serviceStoreMock,
}))

vi.mock('@/composables/useSlideshowAssembly', async () => {
  const { ref } = await import('vue')
  return {
    useSlideshowAssembly: () => ({ assembledSlideshow: ref(fakeSlides as AssembledSlide[]) }),
  }
})

// ── In-memory run-channel fake (identical to AudienceOutputView.test.ts) ────────
function createFakeChannel() {
  const posted: Array<{ type?: string }> = []
  let listener: ((event: { data: unknown }) => void) | undefined
  const close = vi.fn()
  const channel: BroadcastChannelLike = {
    postMessage(message: unknown) {
      posted.push(message as { type?: string })
    },
    addEventListener(_type, callback) {
      listener = callback
    },
    close,
  }
  const factory: BroadcastChannelFactory = () => channel
  return {
    factory,
    posted,
    close,
    emitState(index: number, seq: number, blackout = false) {
      listener?.({ data: { type: 'state', index, blackout, seq } })
    },
  }
}

function setFullscreenElement(value: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', {
    value,
    configurable: true,
    writable: true,
  })
}

// ── Host component: runs the composable inside a real setup() so its lifecycle
// hooks register, and captures the returned surface into a module-scope closure so
// the tests read the raw refs directly. ────────────────────────────────────────
let capturedApi: ReturnType<typeof useOutputWindow> | null = null

const Host = defineComponent({
  name: 'UseOutputWindowHost',
  props: {
    channelFactory: {
      type: Function as PropType<BroadcastChannelFactory>,
      required: false,
      default: undefined,
    },
  },
  setup(props) {
    capturedApi = useOutputWindow({ channelFactory: props.channelFactory })
    return () => h('div')
  },
})

function mountHost(channelFactory: BroadcastChannelFactory) {
  return mount(Host, { props: { channelFactory } })
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  Element.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
  setFullscreenElement(null)
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve(), load: vi.fn().mockResolvedValue([]) },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
    writable: true,
  })
  serviceStoreMock.subscribe.mockClear()
  serviceStoreMock.unsubscribeAll.mockClear()
  serviceStoreMock.orgId = null
  mockRoute.params.serviceId = 'service-1'
  mockRoute.query.org = 'org-1'
  capturedApi = null
})

afterEach(() => {
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock
  // Remove any Permissions API installed by an Automatic-Fullscreen test so every
  // other suite sees jsdom's default (navigator.permissions absent → the granted
  // branch never runs and no mount-time requestFullscreen fires).
  delete (navigator as unknown as { permissions?: unknown }).permissions
  delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
  vi.restoreAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useOutputWindow — receive-only index from onState', () => {
  it('sets index from an inbound state, advances on a higher seq, and drops a lower/stale seq', async () => {
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    // Before any state — index null (pure black).
    expect(capturedApi!.index.value).toBeNull()

    fake.emitState(2, 1)
    await flushPromises()
    expect(capturedApi!.index.value).toBe(2)

    // Higher seq advances.
    fake.emitState(0, 2)
    await flushPromises()
    expect(capturedApi!.index.value).toBe(0)

    // seq 1 <= highest delivered 2 → dropped by openRunChannel; index stays 0.
    fake.emitState(1, 1)
    await flushPromises()
    expect(capturedApi!.index.value).toBe(0)
  })
})

describe('useOutputWindow — receive-only handshake', () => {
  it('posts a hello on mount and NEVER posts a state across the whole lifecycle', async () => {
    const fake = createFakeChannel()
    const wrapper = mountHost(fake.factory)
    await flushPromises()

    expect(fake.posted.some((m) => m.type === 'hello')).toBe(true)

    fake.emitState(0, 1)
    await flushPromises()
    fake.emitState(1, 2)
    await flushPromises()
    wrapper.unmount()

    expect(fake.posted.some((m) => m.type === 'state')).toBe(false)
  })
})

describe('useOutputWindow — org-scoped subscribe gate (WR-02)', () => {
  it('subscribes to the requested ?org= on a fresh (unsubscribed) store', async () => {
    serviceStoreMock.orgId = null
    mockRoute.query.org = 'org-1'
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    expect(serviceStoreMock.subscribe).toHaveBeenCalledWith('org-1')
  })

  it('re-subscribes to the requested ?org= when the store is already on a DIFFERENT org', async () => {
    serviceStoreMock.orgId = 'org-other'
    mockRoute.query.org = 'org-1'
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    expect(serviceStoreMock.subscribe).toHaveBeenCalledWith('org-1')
  })

  it('does NOT re-subscribe when the store is already on the requested org', async () => {
    serviceStoreMock.orgId = 'org-1'
    mockRoute.query.org = 'org-1'
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    expect(serviceStoreMock.subscribe).not.toHaveBeenCalled()
  })
})

describe('useOutputWindow — Screen Wake Lock', () => {
  it('requests a screen wake lock on mount and re-requests on visibilitychange→visible', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined) }
    const request = vi.fn().mockResolvedValue(sentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
      writable: true,
    })

    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('screen')

    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('releases the acquired wake-lock sentinel on unmount', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined) }
    const request = vi.fn().mockResolvedValue(sentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
      writable: true,
    })

    const fake = createFakeChannel()
    const wrapper = mountHost(fake.factory)
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    await flushPromises()
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('does not throw on mount when navigator.wakeLock is absent', async () => {
    expect('wakeLock' in navigator).toBe(false)
    const fake = createFakeChannel()

    let error: unknown = null
    try {
      mountHost(fake.factory)
      await flushPromises()
    } catch (e) {
      error = e
    }
    expect(error).toBeNull()
  })
})

describe('useOutputWindow — fullscreen toggle without teardown (Pitfall 6)', () => {
  it('tracks isFullscreen across a dispatched fullscreenchange and NEVER closes the channel', async () => {
    setFullscreenElement(null)
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    // Windowed at mount.
    expect(capturedApi!.isFullscreen.value).toBe(false)

    // Enter fullscreen.
    setFullscreenElement(document.createElement('div'))
    document.dispatchEvent(new Event('fullscreenchange'))
    await flushPromises()
    expect(capturedApi!.isFullscreen.value).toBe(true)

    // Lose fullscreen.
    setFullscreenElement(null)
    document.dispatchEvent(new Event('fullscreenchange'))
    await flushPromises()
    expect(capturedApi!.isFullscreen.value).toBe(false)

    // No teardown on any fullscreen transition.
    expect(fake.close).not.toHaveBeenCalled()
  })

  it('handleReenterFullscreen calls requestFullscreen on the root element', async () => {
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    // The view binds rootRef to its root element; simulate that binding so the
    // handler has an element to request fullscreen on.
    const el = document.createElement('div')
    el.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    capturedApi!.rootRef.value = el

    capturedApi!.handleReenterFullscreen()
    expect(el.requestFullscreen).toHaveBeenCalledTimes(1)
  })
})

describe('useOutputWindow — bounded font gate', () => {
  it('resolves fontReady to true after mount', async () => {
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    expect(capturedApi!.fontReady.value).toBe(true)
  })
})

describe('useOutputWindow — unmount cleanup', () => {
  it('closes the channel and unsubscribes the services store on unmount', async () => {
    const fake = createFakeChannel()
    const wrapper = mountHost(fake.factory)
    await flushPromises()

    wrapper.unmount()
    await flushPromises()

    expect(fake.close).toHaveBeenCalledTimes(1)
    expect(serviceStoreMock.unsubscribeAll).toHaveBeenCalledTimes(1)
  })
})

// ── Fullscreen Capability Delegation (child side) ───────────────────────────────
// A popup opened via window.open loses its OWN transient user-activation once its
// SPA/auth bootstrap runs, so a mount-time requestFullscreen() (without the browser's
// Automatic Fullscreen content setting, which proved unreliable across Chrome + Edge)
// rejects. Fullscreen is therefore driven by Capability Delegation: on receiving the
// opener's same-origin { type:'wp-fullscreen-delegate' } message — sent when the
// operator clicks a per-display "Go fullscreen" button on the control's Displays
// panel — the child calls requestFullscreen() with the delegated gesture, WITHOUT its
// own. The child does NOT auto-announce readiness on mount anymore (that auto-delegation
// raced the automatic path and caused the intermittent "every other open" fullscreen);
// the buttons are the explicit, reliable trigger.
describe('useOutputWindow — Fullscreen Capability Delegation (child side)', () => {
  function fireMessage(data: unknown, origin: string) {
    const evt = new Event('message') as MessageEvent
    Object.defineProperty(evt, 'data', { value: data })
    Object.defineProperty(evt, 'origin', { value: origin })
    window.dispatchEvent(evt)
  }

  it('does NOT self-request fullscreen on mount (the un-gestured call is removed — the console-error fix)', async () => {
    setFullscreenElement(null)
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    // No opener present (jsdom default) → no delegation → NO requestFullscreen.
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
  })

  it('does NOT auto-announce wp-output-ready on mount (fullscreen is button-driven, not auto-delegated)', async () => {
    const openerPost = vi.fn()
    Object.defineProperty(window, 'opener', {
      value: { postMessage: openerPost },
      configurable: true,
      writable: true,
    })
    try {
      const fake = createFakeChannel()
      mountHost(fake.factory)
      await flushPromises()
      // Auto-announcing readiness made the opener auto-delegate on mount, which raced
      // the automatic path and caused the intermittent fullscreen. The output stays
      // silent on mount now; the per-display "Go fullscreen" buttons drive fullscreen
      // explicitly via a wp-fullscreen-delegate message (see the delegation test below).
      expect(openerPost).not.toHaveBeenCalledWith({ type: 'wp-output-ready' }, window.location.origin)
    } finally {
      Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true })
    }
  })

  it('requests fullscreen on a same-origin { type:"wp-fullscreen-delegate" } message', async () => {
    setFullscreenElement(null)
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()

    fireMessage({ type: 'wp-fullscreen-delegate' }, window.location.origin)
    await flushPromises()

    // document.documentElement inherits the prototype-stubbed requestFullscreen.
    expect(vi.mocked(Element.prototype.requestFullscreen)).toHaveBeenCalledTimes(1)
  })

  it('ignores a CROSS-ORIGIN delegate message', async () => {
    setFullscreenElement(null)
    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    fireMessage({ type: 'wp-fullscreen-delegate' }, 'https://evil.example')
    await flushPromises()
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
  })

  it('removes the message listener on unmount (no leak) — a later delegate does nothing', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    setFullscreenElement(null)
    const fake = createFakeChannel()
    const wrapper = mountHost(fake.factory)
    await flushPromises()

    wrapper.unmount()
    await flushPromises()
    expect(removeSpy.mock.calls.some((c) => c[0] === 'message')).toBe(true)

    // After unmount the delegate is inert.
    vi.mocked(Element.prototype.requestFullscreen).mockClear()
    fireMessage({ type: 'wp-fullscreen-delegate' }, window.location.origin)
    await flushPromises()
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
  })
})

// ── Automatic Fullscreen content setting (Chrome 126+, permission-gated mount) ───
// The PRIMARY zero-click path. When the origin is granted Chrome's "Automatic
// Fullscreen" content setting, `navigator.permissions.query({ name:'fullscreen',
// allowWithoutGesture:true })` resolves { state:'granted' } and the composable
// self-requests fullscreen on mount WITHOUT a gesture — a PLAIN requestFullscreen()
// (no getScreenDetails), because the control already positioned the window on its
// monitor. When not granted (or the descriptor is unsupported / query throws), the
// mount path does NOTHING and the delegation + one-tap fallbacks remain.
describe('useOutputWindow — Automatic Fullscreen content setting (permission-gated)', () => {
  function installPermissions(query: (descriptor: unknown) => Promise<{ state: string }>) {
    Object.defineProperty(navigator, 'permissions', {
      value: { query: vi.fn(query) },
      configurable: true,
      writable: true,
    })
    return (navigator as unknown as { permissions: { query: ReturnType<typeof vi.fn> } }).permissions
      .query
  }

  function installGetScreenDetails() {
    const fn = vi.fn(() =>
      Promise.resolve({ screens: [], addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    )
    ;(window as unknown as { getScreenDetails: unknown }).getScreenDetails = fn
    return fn
  }

  it('self-requests fullscreen on mount (no gesture, no getScreenDetails) when the setting is granted', async () => {
    setFullscreenElement(null)
    const query = installPermissions(() => Promise.resolve({ state: 'granted' }))
    // Install getScreenDetails to PROVE the granted path stays plain and never
    // resolves the Window Management API (the prompt's explicit requirement).
    const getScreenDetails = installGetScreenDetails()

    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    // Queried the Automatic-Fullscreen descriptor…
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]![0]).toMatchObject({ name: 'fullscreen', allowWithoutGesture: true })
    // …then plain-requested fullscreen on the document element, WITHOUT any gesture.
    expect(vi.mocked(Element.prototype.requestFullscreen)).toHaveBeenCalledTimes(1)
    // Plain path: getScreenDetails is never touched.
    expect(getScreenDetails).not.toHaveBeenCalled()
  })

  it('does NOT auto-request fullscreen on mount when the setting is denied', async () => {
    setFullscreenElement(null)
    const query = installPermissions(() => Promise.resolve({ state: 'denied' }))

    const fake = createFakeChannel()
    mountHost(fake.factory)
    await flushPromises()

    expect(query).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
  })

  it('does NOT auto-request fullscreen (and does not throw) when query() rejects', async () => {
    setFullscreenElement(null)
    installPermissions(() => Promise.reject(new TypeError('unsupported descriptor')))

    const fake = createFakeChannel()
    let error: unknown = null
    try {
      mountHost(fake.factory)
      await flushPromises()
    } catch (e) {
      error = e
    }
    expect(error).toBeNull()
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
  })

  it('does NOT auto-request fullscreen (and does not throw) when the Permissions API is absent', async () => {
    setFullscreenElement(null)
    // jsdom default: navigator.permissions is undefined — accessing .query throws
    // synchronously and is swallowed. Assert the absent-API path is inert.
    expect('permissions' in navigator).toBe(false)

    const fake = createFakeChannel()
    let error: unknown = null
    try {
      mountHost(fake.factory)
      await flushPromises()
    } catch (e) {
      error = e
    }
    expect(error).toBeNull()
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
  })
})
