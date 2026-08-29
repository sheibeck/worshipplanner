/**
 * Phase 93 Plan 02 (R270/R271). Behavioral coverage for AudienceOutputView.vue —
 * the receive-only, chrome-free congregation-facing output window.
 *
 * This suite proves the six must-haves against the REAL view (93-01):
 *  - the live slide follows the receive-only run channel (real openRunChannel
 *    stale-drop exercised through an injected in-memory BroadcastChannelLike);
 *  - postHello() fires on mount and the view NEVER posts a `state` message —
 *    control is the single writer — and the channel is close()d on unmount;
 *  - ZERO operator chrome renders and `cursor: none` applies while fullscreen;
 *  - the loading/empty (index null) and out-of-range states are pure black;
 *  - Screen Wake Lock is acquired on mount and re-acquired on visibility return,
 *    and its absence is non-fatal;
 *  - fullscreen loss surfaces the calm "Re-enter fullscreen" affordance WITHOUT
 *    closing the channel or unmounting (the OPPOSITE of PresentationViewer).
 *
 * Harness lineage: ServiceEditorView.test.ts (reactive vue-router mock + inert
 * @/firebase + enableAutoUnmount so onUnmounted cleanup runs), MonitorSetupView
 * .test.ts (per-test install/delete of a navigator.* capability), and
 * PresentationViewer.test.ts (Fullscreen-API stubbing + dispatched
 * fullscreenchange). Stores and useSlideshowAssembly are mocked so the test is
 * about THIS view's behavior, not Firestore.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelLike, BroadcastChannelFactory } from '@/utils/runChannel'
import { type ScreenLike } from '@/utils/monitorConfig'
import AudienceOutputView from '../AudienceOutputView.vue'

// onUnmounted must run so the channel-close, wake-lock-release, and
// unsubscribeAll cleanup this suite asserts actually fire.
enableAutoUnmount(afterEach)

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Reactive so a route change could be simulated without a remount (mirrors
// ServiceEditorView.test.ts's mockRoute); seeds params.serviceId + query.org
// (the ?org= self-scoping convention the view reads).
const mockRoute = reactive({ params: { serviceId: 'service-1' }, query: { org: 'org-1' } })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
}))

// A stable, Firestore-free services store: the view watches `services` (initial-
// load only), reads `orgId` to gate subscribe(), and calls unsubscribeAll() on
// unmount. Hoisted so the vi.mock factory can reference it.
const { serviceStoreMock, fakeSlides, slideCanvasSpies } = vi.hoisted(() => {
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
    // WR-01 (93-REVIEW): real spies for the play/pause handles the SlideCanvas
    // stub exposes, so the T-23-08 pause→nextTick→play ordering is assertable —
    // matching how the real SlideCanvas exposes play/pause via defineExpose.
    slideCanvasSpies: { play: vi.fn(), pause: vi.fn() },
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

// Return a fixed assembled slideshow so the test drives currentSlide purely from
// the channel index, never from Firestore assembly.
vi.mock('@/composables/useSlideshowAssembly', async () => {
  const { ref } = await import('vue')
  return {
    useSlideshowAssembly: () => ({ assembledSlideshow: ref(fakeSlides as AssembledSlide[]) }),
  }
})

// Replace SlideCanvas with a lightweight stub that renders its slide id (so the
// test can assert WHICH slide is showing) and exposes the play/pause handles the
// view drives via its ref.
vi.mock('@/components/slides/SlideCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'SlideCanvasStub',
      props: {
        slide: { type: Object, required: false, default: undefined },
        interactive: { type: Boolean, default: false },
      },
      setup(props, { expose }) {
        // WR-01: expose the shared spies (not bare no-ops) so the parent's
        // slideCanvasRef.pause()/play() calls land on inspectable mocks.
        expose({ play: slideCanvasSpies.play, pause: slideCanvasSpies.pause })
        return () =>
          h(
            'div',
            { 'data-testid': 'slide-canvas' },
            ((props.slide as { slide?: { id?: string } } | undefined)?.slide?.id) ?? '',
          )
      },
    }),
  }
})

// ── In-memory run-channel fake ─────────────────────────────────────────────────
// A BroadcastChannelLike whose postMessage records every message and whose
// addEventListener stores the message listener, so the test can (a) read what the
// view posted and (b) push `state` messages INTO the view. The view opens the
// REAL openRunChannel with this fake, so emitState() exercises runChannel's true
// stale-drop guard rather than bypassing it.
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

function mountView(channelFactory: BroadcastChannelFactory) {
  return mount(AudienceOutputView, { props: { channelFactory } })
}

// ── Self-fullscreen fixtures (R278) ─────────────────────────────────────────────
// Two screens with DISTINCT fingerprints so a seeded role→fingerprint mapping
// resolves to exactly one of them. `installGetScreenDetails` mirrors the
// MonitorSetupView.test.ts idiom: a resolved { screens, addEventListener,
// removeEventListener } object on window.getScreenDetails (jsdom lacks the Window
// Management API by default). Deleted in afterEach so the "absent API" fallback
// path stays clean.
const screenA: ScreenLike = { label: 'Front Wall', width: 1920, height: 1080, left: 0, top: 0, isPrimary: true }
const screenB: ScreenLike = { label: 'Stage Monitor', width: 1280, height: 720, left: 1920, top: 0, isPrimary: false }

function installGetScreenDetails(screens: ScreenLike[]) {
  const addEventListener = vi.fn()
  const removeEventListener = vi.fn()
  const fn = vi.fn(() => Promise.resolve({ screens, addEventListener, removeEventListener }))
  ;(window as unknown as { getScreenDetails: unknown }).getScreenDetails = fn
  return fn
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  // jsdom's Fullscreen API is unimplemented — stub per test (PresentationViewer
  // idiom). Default: not fullscreen.
  Element.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
  setFullscreenElement(null)
  // The font-load gate reads document.fonts; stub it so waitForSlideFont resolves
  // deterministically and fontReady flips true (SlideCanvas only renders once
  // fontReady is true).
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
  // Reset state the org-scoping tests (WR-02) mutate, so each test starts from
  // the fresh-store / org-1 baseline the other suites assume.
  serviceStoreMock.orgId = null
  mockRoute.params.serviceId = 'service-1'
  mockRoute.query.org = 'org-1'
  // WR-01: fresh invocationCallOrder per test for the pause→play ordering check.
  slideCanvasSpies.play.mockClear()
  slideCanvasSpies.pause.mockClear()
  // R278 self-fullscreen tests seed a localStorage monitor mapping; clear so each
  // test starts from a known-empty mapping (no cross-test bleed).
  localStorage.clear()
})

afterEach(() => {
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock
  // Remove any getScreenDetails installed by an R278 test so the "absent API"
  // fallback path (and every other suite) sees jsdom's default: no Window
  // Management API.
  delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
  vi.restoreAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AudienceOutputView — channel-driven slide (R270/R271)', () => {
  it('renders the slide the channel index selects, and a HIGHER-seq state advances it', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Before any state, pure black — no slide.
    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)

    fake.emitState(0, 1)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('a')

    // Higher seq advances.
    fake.emitState(2, 2)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('c')
  })

  it('drops a lower/stale-seq state (runChannel real stale-drop) — the slide does not go backward', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(2, 5)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('c')

    // seq 3 <= highest delivered 5 → dropped by openRunChannel, never delivered.
    fake.emitState(0, 3)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('c')
  })
})

describe('AudienceOutputView — media pause→nextTick→play invariant (T-23-08)', () => {
  it('pauses the outgoing slide before playing the incoming on a slide change (pause → tick → play)', async () => {
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    // null → 0: the canvas mounts and play() runs; there is no outgoing media to
    // pause yet (slideCanvasRef is still null when the pre-flush watcher fires).
    fake.emitState(0, 1)
    await flushPromises()

    // 0 → 1: the default pre-flush watcher pauses the outgoing slide's media,
    // then after nextTick the canvas holds slide 1 and play() starts it.
    fake.emitState(1, 2)
    await flushPromises()

    expect(slideCanvasSpies.pause).toHaveBeenCalled()
    expect(slideCanvasSpies.play).toHaveBeenCalled()
    // The pause on the outgoing slide is invoked before the play on the incoming.
    // A regression that dropped `await nextTick()` or reordered the two would
    // play the outgoing slide's media (or a black frame) and fail here.
    const playOrder = slideCanvasSpies.play.mock.invocationCallOrder
    expect(slideCanvasSpies.pause.mock.invocationCallOrder[0]!).toBeLessThan(
      playOrder[playOrder.length - 1]!,
    )
  })
})

describe('AudienceOutputView — receive-only handshake (R270/R271)', () => {
  it('posts a hello on mount and NEVER posts a state across the whole lifecycle', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(fake.posted.some((m) => m.type === 'hello')).toBe(true)

    // Drive several inbound states, then tear down.
    fake.emitState(0, 1)
    await flushPromises()
    fake.emitState(1, 2)
    await flushPromises()
    wrapper.unmount()

    expect(fake.posted.some((m) => m.type === 'state')).toBe(false)
  })

  it('closes the channel on unmount', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    wrapper.unmount()
    expect(fake.close).toHaveBeenCalledTimes(1)
  })
})

describe('AudienceOutputView — no operator chrome + cursor (R270)', () => {
  it('renders ZERO operator chrome and no buttons while fullscreen', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(0, 1)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('a')

    // None of PresentationViewer's operator affordances exist here.
    expect(wrapper.find('[data-testid="presentation-progress"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="presentation-next"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="presentation-prev"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="presentation-exit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="presentation-chrome"]').exists()).toBe(false)
    // While fullscreen even the re-enter affordance is hidden → zero buttons.
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('applies cursor: none while fullscreen', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const root = wrapper.get('[data-testid="audience-output"]')
    expect((root.element as HTMLElement).style.cursor).toBe('none')
  })
})

describe('AudienceOutputView — pure-black loading/empty gate (R270)', () => {
  // Mount fullscreen so the (windowed-only) re-enter affordance is hidden,
  // isolating the "no slide, no spinner, no copy" claim to the pure-black gate.
  it('renders no SlideCanvas, no spinner, and no copy before any state (index null)', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('renders pure black for an out-of-range index — no SlideCanvas, no error copy', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(99, 1)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})

describe('AudienceOutputView — Screen Wake Lock (R271)', () => {
  it('requests a screen wake lock on mount and re-requests on visibilitychange→visible', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined) }
    const request = vi.fn().mockResolvedValue(sentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
      writable: true,
    })

    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('screen')

    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('releases the acquired wake-lock sentinel on unmount (R271 released-on-unmount)', async () => {
    const sentinel = { release: vi.fn().mockResolvedValue(undefined) }
    const request = vi.fn().mockResolvedValue(sentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
      writable: true,
    })

    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()
    // Sentinel acquired on mount.
    expect(request).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    await flushPromises()
    // onUnmounted awaits wakeLock.value?.release() — the held sentinel is freed.
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('does not throw on mount when navigator.wakeLock is absent', async () => {
    expect('wakeLock' in navigator).toBe(false)
    const fake = createFakeChannel()

    let error: unknown = null
    try {
      mountView(fake.factory)
      await flushPromises()
    } catch (e) {
      error = e
    }
    expect(error).toBeNull()
  })
})

describe('AudienceOutputView — fullscreen-loss recovery (R271; Pitfall 6)', () => {
  it('does NOT render the re-enter affordance while fullscreen', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(wrapper.find('[data-testid="audience-reenter-fullscreen"]').exists()).toBe(false)
  })

  it('surfaces the re-enter affordance on fullscreen loss WITHOUT closing the channel or unmounting, and restores the cursor', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Keep a live slide underneath the affordance.
    fake.emitState(0, 1)
    await flushPromises()

    // Lose fullscreen.
    setFullscreenElement(null)
    document.dispatchEvent(new Event('fullscreenchange'))
    await flushPromises()

    const affordance = wrapper.find('[data-testid="audience-reenter-fullscreen"]')
    expect(affordance.exists()).toBe(true)
    expect(affordance.attributes('aria-label')).toBe('Re-enter fullscreen')

    // No teardown: channel stays open, component stays mounted, live slide stays.
    expect(fake.close).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="audience-output"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('a')

    // Cursor restored while windowed so the affordance stays clickable.
    const root = wrapper.get('[data-testid="audience-output"]')
    expect((root.element as HTMLElement).style.cursor).toBe('auto')
  })

  it('clicking the re-enter affordance calls requestFullscreen', async () => {
    setFullscreenElement(null)
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const affordance = wrapper.get('[data-testid="audience-reenter-fullscreen"]')
    await affordance.trigger('click')

    expect(Element.prototype.requestFullscreen).toHaveBeenCalled()
  })
})

describe('AudienceOutputView — org-scoped service subscription (WR-02)', () => {
  it('subscribes the services store to the requested ?org= on a fresh (unsubscribed) store', async () => {
    serviceStoreMock.orgId = null
    mockRoute.query.org = 'org-1'
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    expect(serviceStoreMock.subscribe).toHaveBeenCalledWith('org-1')
  })

  it('re-subscribes to the requested ?org= when the store is already on a DIFFERENT org (no cross-org bleed)', async () => {
    // Same-tab navigation: the services store is still subscribed to org-other
    // (the operator was elsewhere in the SPA), but this audience URL requests
    // org-1. The view must re-key the service source to the SAME org
    // useSlideshowAssembly subscribes content to, or the congregation surface
    // silently desyncs (X's service assembled against Y's content maps).
    serviceStoreMock.orgId = 'org-other'
    mockRoute.query.org = 'org-1'
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    expect(serviceStoreMock.subscribe).toHaveBeenCalledWith('org-1')
  })

  it('does NOT re-subscribe when the store is already on the requested org', async () => {
    // A matching org means the existing subscription already targets the right
    // content — re-subscribing would tear down and re-listen for no reason.
    serviceStoreMock.orgId = 'org-1'
    mockRoute.query.org = 'org-1'
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    expect(serviceStoreMock.subscribe).not.toHaveBeenCalled()
  })
})

describe('AudienceOutputView — blackout overlay obeys the channel field (R280)', () => {
  it('renders the audience-blackout overlay OVER the live slide on blackout:true and clears it on blackout:false', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // A live slide underneath, no blackout yet.
    fake.emitState(0, 1, false)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('a')
    expect(wrapper.find('[data-testid="audience-blackout"]').exists()).toBe(false)

    // blackout:true → the full-bleed overlay renders; the SlideCanvas is NOT torn
    // down underneath (the overlay is additive, painting on top).
    fake.emitState(0, 2, true)
    await flushPromises()
    expect(wrapper.find('[data-testid="audience-blackout"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(true)

    // The overlay is a LATER sibling of the SlideCanvas → it paints ABOVE it
    // (non-vacuous DOM-order proof, not merely "both exist").
    const children = Array.from(wrapper.get('[data-testid="audience-output"]').element.children)
    const canvasPos = children.findIndex((el) => el.getAttribute('data-testid') === 'slide-canvas')
    const blackoutPos = children.findIndex((el) => el.getAttribute('data-testid') === 'audience-blackout')
    expect(canvasPos).toBeGreaterThanOrEqual(0)
    expect(blackoutPos).toBeGreaterThan(canvasPos)

    // blackout:false → overlay removed, the slide is visible again.
    fake.emitState(0, 3, false)
    await flushPromises()
    expect(wrapper.find('[data-testid="audience-blackout"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('a')
  })

  it('does not tear down the re-enter affordance while blacked out (windowed)', async () => {
    // Windowed (isFullscreen false) so the re-enter affordance renders; a blackout
    // overlay must not remove the re-enter path — it sits AFTER the overlay.
    setFullscreenElement(null)
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(0, 1, true)
    await flushPromises()
    expect(wrapper.find('[data-testid="audience-blackout"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="audience-reenter-fullscreen"]').exists()).toBe(true)
  })
})

describe('AudienceOutputView — no un-gestured mount fullscreen + one-tap fallback (delegation model)', () => {
  it('does NOT self-request fullscreen on mount and does NOT touch getScreenDetails (the console-error fix)', async () => {
    // The old mount-time requestFullscreen() always rejected with "API can only be
    // initiated by a user gesture" — a popup loses its own activation to its SPA/
    // auth bootstrap. That was the console error. Auto-fullscreen is now driven by
    // Fullscreen Capability Delegation FROM THE OPENER, so mount fires NO
    // self-request and never resolves the Window Management API. Install
    // getScreenDetails to prove the mount path no longer touches it.
    const getScreenDetails = installGetScreenDetails([screenA, screenB])

    setFullscreenElement(null)
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    // No opener in this test → no delegation → no requestFullscreen at all.
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
    expect(getScreenDetails).not.toHaveBeenCalled()
  })

  it('renders a FULL-SURFACE one-tap affordance while windowed — a tap ANYWHERE re-enters fullscreen', async () => {
    setFullscreenElement(null)
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const affordance = wrapper.get('[data-testid="audience-reenter-fullscreen"]')
    // Full-bleed: the WHOLE display surface is the tap target (inset-0), not just a
    // small centered button — one tap anywhere on the display goes fullscreen.
    expect(affordance.classes()).toContain('inset-0')
    await affordance.trigger('click')
    expect(Element.prototype.requestFullscreen).toHaveBeenCalled()
  })

  it('hides the one-tap affordance once fullscreen (never blocks the live slide)', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(wrapper.find('[data-testid="audience-reenter-fullscreen"]').exists()).toBe(false)
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
  })
})
