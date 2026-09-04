/**
 * Phase 94 Plan 03 (R272). Behavioral coverage for ConfidenceOutputView.vue —
 * the band-facing confidence monitor: a two-pane current/next 70/30 split with
 * BOTH backgrounds suppressed to plain black, the next pane a STATIC preview
 * that never autoplays, and last-slide safety with no reflow.
 *
 * This suite proves the R272-critical properties against the REAL view:
 *  - two-pane render (current + next) for a mid-deck index, distinguishable by
 *    slide id + the "Next" tag on the next pane only;
 *  - BOTH panes wired suppressBackground=true + interactive=false (stub-level),
 *    AND — closing the R272 DOM chain end-to-end — the REAL SlideCanvas
 *    (vi.importActual, unstubbed) emits NEITHER presentation-background NOR
 *    presentation-background-scrim under suppressBackground=true for a
 *    background-carrying slide AND a video slide, with a NON-VACUOUS false
 *    control (suppressBackground=false DOES render presentation-background);
 *  - last-slide (next==null) renders the next pane empty with the "Next" tag
 *    HIDDEN, no wrap to slide 0, no crash, and BOTH 70/30 regions still present;
 *  - the NEXT pane never autoplays — only the current pane's canvas is driven
 *    (pause before play), the next pane's play spy is never called.
 *
 * It also re-proves the Phase 93 lifecycle now that it lives in the shared
 * useOutputWindow composable: channel-driven index + higher-seq advance +
 * stale-seq drop, postHello on mount / NEVER postState / close on unmount,
 * chrome absence + cursor:none while fullscreen, wake-lock present/re-acquire/
 * absent, fullscreen-loss -> Re-enter affordance WITHOUT teardown, and the
 * WR-02 org-scoped subscribe gate.
 *
 * Harness lineage: AudienceOutputView.test.ts (mirrored verbatim in shape) —
 * reactive vue-router mock, inert @/firebase, mocked stores + useSlideshowAssembly,
 * an injectable in-memory run-channel fake, Fullscreen/fonts/visibility stubs, and
 * enableAutoUnmount so onUnmounted cleanup runs. The SlideCanvas stub is EXTENDED
 * to record suppressBackground/interactive and expose PER-INSTANCE play/pause
 * spies into a module-scope registry so both panes' wiring and the next-pane
 * static invariant are assertable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelLike, BroadcastChannelFactory } from '@/utils/runChannel'
import { type ScreenLike } from '@/utils/monitorConfig'
import ConfidenceOutputView from '../ConfidenceOutputView.vue'

// onUnmounted must run so the channel-close, wake-lock-release, and
// unsubscribeAll cleanup this suite asserts actually fire.
enableAutoUnmount(afterEach)

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Reactive route (mirrors AudienceOutputView.test.ts); seeds params.serviceId +
// query.org (the ?org= self-scoping convention useOutputWindow reads).
const mockRoute = reactive({ params: { serviceId: 'service-1' }, query: { org: 'org-1' } })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
}))

// Hoisted so the vi.mock factories can reference them. `canvasRegistry` collects a
// record per mounted SlideCanvas stub instance so the test can assert both panes
// suppressed and the next pane never played.
const { serviceStoreMock, fakeSlides, canvasRegistry } = vi.hoisted(() => {
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
    // Per-instance record: { slideId, suppressBackground, interactive, play, pause }.
    // Cleared in beforeEach.
    canvasRegistry: [] as Array<{
      slideId: string | undefined
      suppressBackground: boolean
      interactive: boolean
      play: ReturnType<typeof vi.fn>
      pause: ReturnType<typeof vi.fn>
    }>,
  }
})

vi.mock('@/firebase', () => ({ auth: {}, db: {}, functions: {} }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    orgId: 'org-1',
    settings: {
      slideTypography: { fontFamily: 'Inter', fontWeight: 400 },
    },
  }),
}))

vi.mock('@/stores/services', () => ({
  useServiceStore: () => serviceStoreMock,
}))

// Fixed assembled slideshow so the panes are driven purely from the channel index.
vi.mock('@/composables/useSlideshowAssembly', async () => {
  const { ref } = await import('vue')
  return {
    useSlideshowAssembly: () => ({ assembledSlideshow: ref(fakeSlides as AssembledSlide[]) }),
  }
})

// EXTENDED SlideCanvas stub: renders its slide id as text (so panes are
// identifiable), declares suppressBackground + interactive so both are
// inspectable, and — per instance — creates play/pause vi.fns, exposes them (so
// the parent's currentCanvasRef.play()/pause() land on inspectable mocks), and
// records { slideId, suppressBackground, interactive, play, pause } into the
// module-scope registry. Instances are REUSED across slide changes (no :key), so
// the current-region instance and the next-region instance each appear once —
// the current pane's play spy is driven, the next pane's is never called.
vi.mock('@/components/slides/SlideCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'SlideCanvasStub',
      props: {
        slide: { type: Object, required: false, default: undefined },
        suppressBackground: { type: Boolean, default: false },
        interactive: { type: Boolean, default: false },
      },
      setup(props, { expose }) {
        const play = vi.fn()
        const pause = vi.fn()
        expose({ play, pause })
        canvasRegistry.push({
          slideId: (props.slide as { slide?: { id?: string } } | undefined)?.slide?.id,
          suppressBackground: props.suppressBackground,
          interactive: props.interactive,
          play,
          pause,
        })
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

// ── Real-SlideCanvas fixtures (for the black-suppression integration test) ──────
// Typed AssembledSlide builders mirroring SlideCanvas.test.ts so the REAL canvas
// receives the exact data shape it does in production.
function lyricSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 1,
      contentKind: 'lyric',
      sectionId: 'verse-1',
      sectionLabel: 'Verse 1',
      lines: ['Amazing grace, how sweet the sound'],
    },
    slotIndex: 0,
    slotKind: 'SONG',
    section: 'worship',
    sourceId: 'song-1',
  } as AssembledSlide
}

function videoSlide(id: string, url: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 5,
      contentKind: 'video',
      videoSrc: url,
    },
    slotIndex: 4,
    slotKind: 'IMPORTED',
    section: 'worship',
    sourceId: 'video-1',
  } as AssembledSlide
}

function withBackground(assembled: AssembledSlide, url: string): AssembledSlide {
  return {
    ...assembled,
    slide: {
      ...assembled.slide,
      backgroundImageUrl: url,
      backgroundSource: 'slide',
    },
  } as AssembledSlide
}

// An AUTHORED blackout SLIDE (contentKind:'blackout', Phase 105) — content,
// distinct from the runtime "Go to black" control this file's R305 suite
// proves is gone from the confidence surface. Used only by the real-SlideCanvas
// content-path test below.
function blackoutSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 3,
      contentKind: 'blackout',
    },
    slotIndex: 2,
    slotKind: 'SONG',
    section: 'worship',
    sourceId: 'song-1',
  } as AssembledSlide
}

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

function mountView(channelFactory: BroadcastChannelFactory) {
  return mount(ConfidenceOutputView, { props: { channelFactory } })
}

// ── Self-fullscreen fixtures (R278) ─────────────────────────────────────────────
// Two screens with DISTINCT fingerprints; the confidence role is seeded to
// screenB (the AUDIENCE window claims screenA in its own suite). installGet-
// ScreenDetails mirrors the MonitorSetupView.test.ts idiom; deleted in afterEach.
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
  // Fresh per-instance registry each test.
  canvasRegistry.length = 0
  // R278 self-fullscreen tests seed a localStorage monitor mapping; clear so each
  // test starts from a known-empty mapping (no cross-test bleed).
  localStorage.clear()
})

afterEach(() => {
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock
  // Remove any getScreenDetails installed by an R278 test so the rest of the suite
  // sees jsdom's default: no Window Management API.
  delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
  vi.restoreAllMocks()
})

// ── R272 confidence-specific behavior ──────────────────────────────────────────

describe('ConfidenceOutputView — two-pane current+next render (R272)', () => {
  it('renders a current pane (b) and a next pane (c) for a mid-deck index, with the "Next" tag on the next pane only', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(1, 1)
    await flushPromises()

    const currentRegion = wrapper.get('[data-testid="confidence-current-region"]')
    const nextRegion = wrapper.get('[data-testid="confidence-next-region"]')

    // Two distinct panes: current shows 'b', next shows 'c'.
    expect(currentRegion.find('[data-testid="slide-canvas"]').text()).toBe('b')
    expect(nextRegion.find('[data-testid="slide-canvas"]').text()).toBe('c')

    // The "Next" tag lives on the next pane only.
    expect(nextRegion.find('[data-testid="confidence-next-label"]').exists()).toBe(true)
    expect(currentRegion.find('[data-testid="confidence-next-label"]').exists()).toBe(false)
  })

  it('wires BOTH panes suppressBackground=true and interactive=false (view R272 wiring)', async () => {
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    fake.emitState(1, 1)
    await flushPromises()

    // Both panes mounted; every recorded instance is black-suppressed + inert.
    expect(canvasRegistry).toHaveLength(2)
    expect(canvasRegistry.every((c) => c.suppressBackground === true)).toBe(true)
    expect(canvasRegistry.every((c) => c.interactive === false)).toBe(true)
  })
})

describe('ConfidenceOutputView — real-SlideCanvas black suppression (R272 DOM chain)', () => {
  it('emits NO presentation-background/scrim under suppressBackground=true for a background-carrying slide AND a video slide, with a non-vacuous false control', async () => {
    // jsdom media stubs so the REAL SlideCanvas's VideoPlayer mounts without throwing.
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    window.HTMLMediaElement.prototype.pause = vi.fn()

    // The REAL SlideCanvas, bypassing this file's stub.
    const mod = await vi.importActual<typeof import('@/components/slides/SlideCanvas.vue')>(
      '@/components/slides/SlideCanvas.vue',
    )
    const Real = mod.default

    const bgSlide = withBackground(lyricSlide('bg'), 'https://example.com/bg.jpg')
    const videoBgSlide = withBackground(videoSlide('v1', 'https://example.com/clip.mp4'), 'https://example.com/bg.jpg')

    // Background-carrying slide, suppressed → NEITHER element renders.
    const suppressedBg = mount(Real, { props: { slide: bgSlide, suppressBackground: true } })
    await flushPromises()
    expect(suppressedBg.find('[data-testid="presentation-background"]').exists()).toBe(false)
    expect(suppressedBg.find('[data-testid="presentation-background-scrim"]').exists()).toBe(false)

    // Video slide, suppressed → same absence.
    const suppressedVideo = mount(Real, { props: { slide: videoBgSlide, suppressBackground: true } })
    await flushPromises()
    expect(suppressedVideo.find('[data-testid="presentation-background"]').exists()).toBe(false)
    expect(suppressedVideo.find('[data-testid="presentation-background-scrim"]').exists()).toBe(false)

    // NON-VACUOUS false control: the SAME background-carrying slide with
    // suppressBackground=false DOES render presentation-background, so the
    // suppressed assertions above cannot pass trivially.
    const control = mount(Real, { props: { slide: bgSlide, suppressBackground: false } })
    await flushPromises()
    const controlBg = control.find('[data-testid="presentation-background"]')
    expect(controlBg.exists()).toBe(true)
    expect(controlBg.attributes('style')).toContain('https://example.com/bg.jpg')

    suppressedBg.unmount()
    suppressedVideo.unmount()
    control.unmount()
  })
})

describe('ConfidenceOutputView — last-slide safety, no reflow (R272)', () => {
  it('renders the last slide (c) with the next pane empty, the "Next" tag hidden, no wrap, no throw, and both regions still present', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // index 2 == last slide 'c'; nextSlide resolves to null (no wrap to 'a').
    fake.emitState(2, 1)
    await flushPromises()

    const currentRegion = wrapper.get('[data-testid="confidence-current-region"]')
    const nextRegion = wrapper.get('[data-testid="confidence-next-region"]')

    // Current pane shows the LAST slide — not a wrap-around to 'a'.
    const currentCanvas = currentRegion.find('[data-testid="slide-canvas"]')
    expect(currentCanvas.text()).toBe('c')

    // Next pane empty: no SlideCanvas, "Next" tag hidden.
    expect(nextRegion.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="confidence-next-label"]').exists()).toBe(false)

    // Both 70/30 region wrappers still present — the layout did not collapse.
    expect(wrapper.find('[data-testid="confidence-current-region"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confidence-next-region"]').exists()).toBe(true)
  })
})

describe('ConfidenceOutputView — next pane never autoplays (R272)', () => {
  it('drives only the current pane on a slide change (pause before play); the next pane play spy is never called', async () => {
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    fake.emitState(0, 1) // current 'a', next 'b'
    await flushPromises()
    fake.emitState(1, 2) // current 'b', next 'c' (both region instances reused)
    await flushPromises()

    // Instances are reused across the advance: exactly one current-region record
    // and one next-region record. The current pane is the only one ever driven.
    const played = canvasRegistry.filter((c) => c.play.mock.calls.length > 0)
    const notPlayed = canvasRegistry.filter((c) => c.play.mock.calls.length === 0)
    expect(played).toHaveLength(1)
    expect(notPlayed).toHaveLength(1)

    const currentPane = played[0]!
    const nextPane = notPlayed[0]!

    // Current pane: pause fires before its (last) play on the slide change.
    expect(currentPane.pause).toHaveBeenCalled()
    const pauseOrder = currentPane.pause.mock.invocationCallOrder
    const playOrder = currentPane.play.mock.invocationCallOrder
    expect(Math.min(...pauseOrder)).toBeLessThan(Math.max(...playOrder))

    // Next pane: STATIC preview — never played.
    expect(nextPane.play).not.toHaveBeenCalled()
  })
})

// ── Inherited Phase 93 lifecycle (retargeted to confidence testids) ─────────────

describe('ConfidenceOutputView — channel-driven index (R272 via useOutputWindow)', () => {
  it('renders the slide the channel index selects, and a HIGHER-seq state advances it', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const current = () =>
      wrapper.find('[data-testid="confidence-current-region"] [data-testid="slide-canvas"]')

    // Before any state, pure black — no current slide.
    expect(current().exists()).toBe(false)

    fake.emitState(0, 1)
    await flushPromises()
    expect(current().text()).toBe('a')

    fake.emitState(2, 2)
    await flushPromises()
    expect(current().text()).toBe('c')
  })

  it('drops a lower/stale-seq state (runChannel real stale-drop) — the slide does not go backward', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const current = () =>
      wrapper.find('[data-testid="confidence-current-region"] [data-testid="slide-canvas"]')

    fake.emitState(2, 5)
    await flushPromises()
    expect(current().text()).toBe('c')

    fake.emitState(0, 3) // seq 3 <= 5 → dropped by openRunChannel
    await flushPromises()
    expect(current().text()).toBe('c')
  })
})

describe('ConfidenceOutputView — receive-only handshake (R272)', () => {
  it('posts a hello on mount and NEVER posts a state across the whole lifecycle', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(fake.posted.some((m) => m.type === 'hello')).toBe(true)

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

describe('ConfidenceOutputView — no operator chrome + cursor (R272)', () => {
  it('renders ZERO operator chrome and no buttons while fullscreen', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(0, 1)
    await flushPromises()
    expect(
      wrapper.find('[data-testid="confidence-current-region"] [data-testid="slide-canvas"]').text(),
    ).toBe('a')

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

    const root = wrapper.get('[data-testid="confidence-output"]')
    expect((root.element as HTMLElement).style.cursor).toBe('none')
  })
})

describe('ConfidenceOutputView — pure-black loading/empty gate (R272)', () => {
  it('renders no SlideCanvas before any state (index null)', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('renders pure black for an out-of-range index — no SlideCanvas, no copy', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(99, 1)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  // WR-01 (94-REVIEW): the RunState-arrives-BEFORE-the-font-gate race. Every other
  // test lets fontReady resolve before emitting state, so nextSlide is only ever
  // non-null once the panes can render. Here we hold the font gate open (a pending
  // document.fonts.ready) and emit a mid-deck state UNDERNEATH it: index is set
  // (current+next both non-null) while fontReady is still false. The panes are
  // correctly hidden — and the "Next" label MUST be too, or a stray gray NEXT
  // renders on the otherwise pure-black loading surface (the label was previously
  // gated on `nextSlide` only). Resolving the gate then reveals label + panes.
  it('does NOT render the "Next" label when a state arrives before the font gate resolves, then reveals it once fontReady resolves', async () => {
    setFullscreenElement(document.createElement('div')) // hide the re-enter affordance → isolate the label

    // Hold the font gate open: a pending document.fonts.ready keeps fontReady false
    // (the FONT_LOAD_TIMEOUT_MS fallback uses real timers and never fires in-test).
    let resolveFonts: () => void = () => {}
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve
    })
    Object.defineProperty(document, 'fonts', {
      value: { ready: fontsReady, load: vi.fn().mockResolvedValue([]) },
      configurable: true,
      writable: true,
    })

    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises() // onMounted synchronous portion ran; fontReady still false (gate pending)

    // Reproduce the race: emit a mid-deck state (current 'b', next 'c') while the
    // gate still holds. index is set, currentSlide + nextSlide are both non-null.
    fake.emitState(1, 1)
    await flushPromises()

    // Pure-black loading contract: both panes hidden AND the "Next" label absent.
    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="confidence-next-label"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')

    // Once the font gate resolves, the panes AND the "Next" label appear.
    resolveFonts()
    await flushPromises()
    expect(wrapper.find('[data-testid="confidence-next-label"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="confidence-current-region"] [data-testid="slide-canvas"]').text(),
    ).toBe('b')
    expect(
      wrapper.find('[data-testid="confidence-next-region"] [data-testid="slide-canvas"]').text(),
    ).toBe('c')
  })
})

describe('ConfidenceOutputView — Screen Wake Lock (R272)', () => {
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

  it('releases the acquired wake-lock sentinel on unmount', async () => {
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
      mountView(fake.factory)
      await flushPromises()
    } catch (e) {
      error = e
    }
    expect(error).toBeNull()
  })
})

describe('ConfidenceOutputView — fullscreen-loss recovery (R272; Pitfall 6)', () => {
  it('does NOT render the re-enter affordance while fullscreen', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(wrapper.find('[data-testid="confidence-reenter-fullscreen"]').exists()).toBe(false)
  })

  it('surfaces the re-enter affordance on fullscreen loss WITHOUT closing the channel or unmounting, and restores the cursor', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Keep a live slide underneath the affordance.
    fake.emitState(0, 1)
    await flushPromises()

    setFullscreenElement(null)
    document.dispatchEvent(new Event('fullscreenchange'))
    await flushPromises()

    const affordance = wrapper.find('[data-testid="confidence-reenter-fullscreen"]')
    expect(affordance.exists()).toBe(true)
    expect(affordance.attributes('aria-label')).toBe('Re-enter fullscreen')

    // No teardown: channel stays open, component stays mounted, live slide stays.
    expect(fake.close).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="confidence-output"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="confidence-current-region"] [data-testid="slide-canvas"]').text(),
    ).toBe('a')

    const root = wrapper.get('[data-testid="confidence-output"]')
    expect((root.element as HTMLElement).style.cursor).toBe('auto')
  })

  it('clicking the re-enter affordance calls requestFullscreen', async () => {
    setFullscreenElement(null)
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const affordance = wrapper.get('[data-testid="confidence-reenter-fullscreen"]')
    await affordance.trigger('click')

    expect(Element.prototype.requestFullscreen).toHaveBeenCalled()
  })
})

describe('ConfidenceOutputView — org-scoped service subscription (WR-02)', () => {
  it('subscribes the services store to the requested ?org= on a fresh (unsubscribed) store', async () => {
    serviceStoreMock.orgId = null
    mockRoute.query.org = 'org-1'
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    expect(serviceStoreMock.subscribe).toHaveBeenCalledWith('org-1')
  })

  it('re-subscribes to the requested ?org= when the store is already on a DIFFERENT org', async () => {
    serviceStoreMock.orgId = 'org-other'
    mockRoute.query.org = 'org-1'
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    expect(serviceStoreMock.subscribe).toHaveBeenCalledWith('org-1')
  })

  it('does NOT re-subscribe when the store is already on the requested org', async () => {
    serviceStoreMock.orgId = 'org-1'
    mockRoute.query.org = 'org-1'
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    expect(serviceStoreMock.subscribe).not.toHaveBeenCalled()
  })
})

describe('ConfidenceOutputView — runtime "Go to black" is Audience-only, no overlay (R305)', () => {
  it('never renders a confidence-blackout overlay on blackout:true; current + next panes keep showing the real slides throughout', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Live current + next panes underneath, no runtime blackout yet.
    fake.emitState(0, 1, false)
    await flushPromises()
    expect(wrapper.find('[data-testid="confidence-blackout"]').exists()).toBe(false)
    expect(
      wrapper.find('[data-testid="confidence-current-region"] [data-testid="slide-canvas"]').text(),
    ).toBe('a')
    expect(
      wrapper.find('[data-testid="confidence-next-region"] [data-testid="slide-canvas"]').text(),
    ).toBe('b')

    // blackout:true — the control's "Go to black" — is now Audience-only
    // (R305): the confidence monitor renders NO overlay at all, and both
    // region panes keep rendering the actual current/next slides, unchanged.
    fake.emitState(0, 2, true)
    await flushPromises()
    expect(wrapper.find('[data-testid="confidence-blackout"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="confidence-current-region"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confidence-next-region"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="confidence-current-region"] [data-testid="slide-canvas"]').text(),
    ).toBe('a')
    expect(
      wrapper.find('[data-testid="confidence-next-region"] [data-testid="slide-canvas"]').text(),
    ).toBe('b')

    // blackout:false — still no overlay, nothing changes on this surface.
    fake.emitState(0, 3, false)
    await flushPromises()
    expect(wrapper.find('[data-testid="confidence-blackout"]').exists()).toBe(false)
  })
})

describe('ConfidenceOutputView — authored blackout SLIDE still renders black content (distinct from the removed R305 runtime overlay)', () => {
  it('a contentKind:"blackout" current slide renders through the REAL SlideCanvas (as used on the confidence current pane) with no lyric body and no background', async () => {
    // The REAL SlideCanvas, bypassing this file's stub — proves the confidence
    // CURRENT pane still goes solid black for an AUTHORED blackout slide (real
    // slide content), independent of the runtime "Go to black" control that
    // R305 above proves no longer reaches this surface. suppressBackground=true
    // mirrors ConfidenceOutputView's own current-pane wiring.
    const mod = await vi.importActual<typeof import('@/components/slides/SlideCanvas.vue')>(
      '@/components/slides/SlideCanvas.vue',
    )
    const Real = mod.default

    const wrapper = mount(Real, { props: { slide: blackoutSlide('bk'), suppressBackground: true } })
    await flushPromises()

    expect(wrapper.find('[data-testid="presentation-body"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="presentation-background"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="presentation-background-scrim"]').exists()).toBe(false)

    wrapper.unmount()
  })
})

describe('ConfidenceOutputView — left/right split layout (R279) + next-scale (R276)', () => {
  it('is a horizontal flex-row split with current-region LEFT before next-region RIGHT (border-l seam), both panes suppressed, each on its own canonical stage', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(0, 1) // current 'a', next 'b'
    await flushPromises()

    // Horizontal split (flex-row), NOT the pre-97 vertical flex-col.
    const root = wrapper.get('[data-testid="confidence-output"]')
    expect(root.classes()).toContain('flex-row')

    // The next-region carries the bright, thick vertical seam between the panes
    // (owner UAT: visible from a distance — a 6px solid white rule).
    const currentRegion = wrapper.get('[data-testid="confidence-current-region"]')
    const nextRegion = wrapper.get('[data-testid="confidence-next-region"]')
    expect(nextRegion.classes()).toContain('border-l-[6px]')
    expect(nextRegion.classes()).toContain('border-white')

    // Current-region appears BEFORE next-region in DOM order (left → right).
    const children = Array.from(root.element.children)
    const currentPos = children.findIndex((el) => el.getAttribute('data-testid') === 'confidence-current-region')
    const nextPos = children.findIndex((el) => el.getAttribute('data-testid') === 'confidence-next-region')
    expect(currentPos).toBeGreaterThanOrEqual(0)
    expect(nextPos).toBeGreaterThan(currentPos)

    // BOTH panes keep suppressBackground (Phase 94 invariant) — non-vacuous: two
    // recorded canvas instances, every one suppressed, none carrying the
    // presentation-background the un-suppressed control WOULD render.
    expect(canvasRegistry).toHaveLength(2)
    expect(canvasRegistry.every((c) => c.suppressBackground === true)).toBe(true)

    // R329 — each pane wraps its SlideCanvas in its own canonical 1280x720 stage
    // (useContainScale), REPLACING the old fixed transform: scale(0.8) next-pane
    // hack — no element anywhere carries that literal value any more.
    const currentStage = currentRegion.find('[data-testid="confidence-current-stage"]')
    const nextStage = nextRegion.find('[data-testid="confidence-next-stage"]')
    expect(currentStage.exists()).toBe(true)
    expect(nextStage.exists()).toBe(true)
    expect(currentStage.find('[data-testid="slide-canvas"]').exists()).toBe(true)
    expect(nextStage.find('[data-testid="slide-canvas"]').exists()).toBe(true)
    // No rendered element's inline style carries the old fixed scale(0.8) value
    // (checked against `style` attributes only — a template comment mentioning
    // the hack by name would otherwise false-positive a plain HTML substring scan).
    const styledEls = wrapper.findAll('[style]')
    expect(styledEls.some((el) => (el.attributes('style') ?? '').includes('scale(0.8)'))).toBe(false)
  })

  it('keeps both region wrappers present with only the inner canvas + "Next" label toggling on the last slide (no reflow)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // index 2 == last slide 'c'; nextSlide resolves null (no wrap to 'a').
    fake.emitState(2, 1)
    await flushPromises()

    // Both region wrappers stay present — the layout must NOT collapse the next
    // pane (that would jump-resize the current pane in front of the band).
    expect(wrapper.find('[data-testid="confidence-current-region"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confidence-next-region"]').exists()).toBe(true)

    // Only the inner next canvas + "Next" label toggle off.
    const nextRegion = wrapper.get('[data-testid="confidence-next-region"]')
    expect(nextRegion.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="confidence-next-label"]').exists()).toBe(false)

    // The current pane still shows the last slide (no wrap-around).
    expect(
      wrapper.find('[data-testid="confidence-current-region"] [data-testid="slide-canvas"]').text(),
    ).toBe('c')
  })
})

describe('ConfidenceOutputView — no un-gestured mount fullscreen + one-tap fallback (delegation model)', () => {
  it('does NOT self-request fullscreen on mount and does NOT touch getScreenDetails (the console-error fix)', async () => {
    // The old mount-time requestFullscreen() always rejected with "API can only be
    // initiated by a user gesture" — a popup loses its own activation to its SPA/
    // auth bootstrap. That was the console error. Auto-fullscreen is now driven by
    // Fullscreen Capability Delegation FROM THE OPENER, so mount fires NO
    // self-request and never resolves the Window Management API.
    const getScreenDetails = installGetScreenDetails([screenA, screenB])

    setFullscreenElement(null)
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
    expect(getScreenDetails).not.toHaveBeenCalled()
  })

  it('renders a FULL-SURFACE one-tap affordance while windowed — a tap ANYWHERE re-enters fullscreen', async () => {
    setFullscreenElement(null)
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const affordance = wrapper.get('[data-testid="confidence-reenter-fullscreen"]')
    // Full-bleed: the WHOLE display surface is the tap target (inset-0), not just a
    // small centered button — one tap anywhere on the display goes fullscreen.
    expect(affordance.classes()).toContain('inset-0')
    await affordance.trigger('click')
    expect(Element.prototype.requestFullscreen).toHaveBeenCalled()
  })

  it('hides the one-tap affordance once fullscreen (never blocks the live panes)', async () => {
    setFullscreenElement(document.createElement('div'))
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(wrapper.find('[data-testid="confidence-reenter-fullscreen"]').exists()).toBe(false)
    expect(vi.mocked(Element.prototype.requestFullscreen)).not.toHaveBeenCalled()
  })
})
