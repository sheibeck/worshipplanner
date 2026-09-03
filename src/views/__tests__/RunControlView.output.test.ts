/**
 * Phase 95 Plan 06 (R261/R266). Behavioral coverage for RunControlView.vue's
 * OUTPUT-WINDOW ORCHESTRATION — the Go-live gesture that opens (and, when the
 * live monitors match a saved mapping, places) the audience + confidence output
 * windows, degrades to un-positioned pop-outs on every not-matched path, and
 * surfaces an HONEST blocked state when the browser refuses the pop-ups.
 *
 * This suite drives the REAL view through the EXPLICIT run-go-live-btn click
 * (NEVER an on-mount open — the open requires a fresh transient activation, so
 * the view opens ONLY from the gesture). Every screen and every window is faked:
 *  - window.getScreenDetails is installed/deleted per test (jsdom omits the
 *    Window Management API by default), mirroring MonitorSetupView.test.ts.
 *  - window.open is vi.spyOn'd to return a fresh fake window per call (moveTo +
 *    document.documentElement.requestFullscreen spies) — or null in the blocked
 *    case — so no real window is ever opened.
 *  - the saved monitor mapping is seeded through the REAL saveMapping/
 *    computeFingerprint so the matched-placement path exercises the true
 *    loadMapping/matchMapping logic, not a mock.
 *
 * Harness lineage: AudienceOutputView.test.ts (the shared base — injected fake
 * BroadcastChannel factory + stubbed SlideCanvas + enableAutoUnmount so the
 * keydown listener + channel close cleanup run) and MonitorSetupView.test.ts
 * (per-test install/delete of window.getScreenDetails + fake ScreenLike shape).
 * useServiceAssembly is mocked so the test is about THIS view's output
 * orchestration, not Firestore.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Service } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelLike, BroadcastChannelFactory } from '@/utils/runChannel'
import {
  computeFingerprint,
  saveMapping,
  type ScreenLike,
} from '@/utils/monitorConfig'
import { useToasts } from '@/stores/toasts'
import { windowNameFor } from '@/composables/useRunControl'
import RunControlView from '../RunControlView.vue'

// onUnmounted must run so the document keydown listener + channel close this
// view registers on mount are torn down between tests (a leaked keydown handler
// on `document` would fire in later tests).
enableAutoUnmount(afterEach)

// ── Fixtures (hoisted so the vi.mock factory can reference them) ────────────────
const { mockService, mockSlides } = vi.hoisted(() => {
  const ts = {} as unknown
  const service = {
    id: 'service-1',
    date: '2026-03-08',
    name: 'Sunday Gathering',
    progression: '1-2-2-3',
    teams: ['Choir'],
    status: 'planned',
    slots: [
      { kind: 'SONG', id: 'slot-0', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
    ],
    sermonPassage: null,
    notes: '',
    createdAt: ts,
    updatedAt: ts,
  }
  // 96-02: at least 3 assembled slides (here 4) so ArrowRight navigation advances
  // the index past 0 — the position-preserved (→index 2) and rapid-nav (3 fwd, 1
  // back → index 2) blocks need a runway. slotIndex 0 for all is fine (only length
  // matters for goBySlide's clamp); the pre-96 blocks never assert slide count.
  const slides = [
    { slide: { id: 'a', position: 0, contentKind: 'lyric', sectionId: 'verse-1', sectionLabel: 'Verse 1', lines: ['line a'] }, slotIndex: 0, slotKind: 'SONG', section: 'worship', sourceId: 'song-1' },
    { slide: { id: 'b', position: 1, contentKind: 'lyric', sectionId: 'verse-1', sectionLabel: 'Verse 1', lines: ['line b'] }, slotIndex: 0, slotKind: 'SONG', section: 'worship', sourceId: 'song-1' },
    { slide: { id: 'c', position: 2, contentKind: 'lyric', sectionId: 'chorus', sectionLabel: 'Chorus', lines: ['line c'] }, slotIndex: 0, slotKind: 'SONG', section: 'worship', sourceId: 'song-1' },
    { slide: { id: 'd', position: 3, contentKind: 'lyric', sectionId: 'chorus', sectionLabel: 'Chorus', lines: ['line d'] }, slotIndex: 0, slotKind: 'SONG', section: 'worship', sourceId: 'song-1' },
  ]
  return { mockService: service, mockSlides: slides }
})

// ── Mocks ───────────────────────────────────────────────────────────────────
// vue-router: RunControlView calls useRouter() (exit navigation) and renders a
// <router-link to="/monitor-setup"> in the fallback banner. Stub RouterLink to a
// plain anchor exposing `to` so the monitor-setup link is assertable. Owner UAT:
// CAPTURE the onBeforeRouteLeave guard + a stable router.push spy so the true-live
// leave-guard behavior (only a real go-live blocks an in-app leave) is assertable
// against a REAL placed session.
const mockRouterPush = vi.fn()
let capturedRouteLeaveGuard: ((to: unknown) => boolean | void) | undefined
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  onBeforeRouteLeave: (guard: (to: unknown) => boolean | void) => {
    capturedRouteLeaveGuard = guard
  },
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="to"><slot /></a>',
  },
}))

// The shared load core: fixed serviceId/org + a locked service with one
// assembled slide, so the URLs the output windows open read service-1?org=org-1.
vi.mock('@/composables/useServiceAssembly', async () => {
  const { ref } = await import('vue')
  return {
    useServiceAssembly: () => ({
      serviceId: ref('service-1'),
      orgIdRef: ref('org-1'),
      localService: ref(mockService as unknown as Service),
      assembledSlideshow: ref(mockSlides as unknown as AssembledSlide[]),
    }),
  }
})

// Replace SlideCanvas with a lightweight stub so the preview stage renders
// without pulling the real slide-rendering machinery into this suite.
vi.mock('@/components/slides/SlideCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'SlideCanvasStub',
      props: { slide: { type: Object, required: false, default: undefined }, interactive: { type: Boolean, default: false } },
      setup: () => () => h('div', { 'data-testid': 'slide-canvas' }),
    }),
  }
})

// ── In-memory run-channel fake (AudienceOutputView.test.ts lineage) ────────────
// 96-02 upgrade: the fake now CAPTURES the 'message' listener the handle registers
// and exposes deliver(data) to fire an inbound message as { data } — so a test can
// simulate a reopened output's { type:'hello' } and drive the control's
// onHello(resendCurrent) handshake. posted carries the full state shape (index/seq)
// so the position-preserved + rapid-nav tests can inspect the resent index.
type PostedMessage = { type?: string; index?: number; blackout?: boolean; seq?: number }
function createFakeChannel() {
  const posted: PostedMessage[] = []
  const close = vi.fn()
  let messageCb: ((event: { data: unknown }) => void) | undefined
  const channel: BroadcastChannelLike = {
    postMessage(message: unknown) {
      posted.push(message as PostedMessage)
    },
    addEventListener(type: 'message', callback: (event: { data: unknown }) => void) {
      if (type === 'message') messageCb = callback
    },
    close,
  }
  const factory: BroadcastChannelFactory = () => channel
  // Fire an inbound message through the captured listener (e.g. a reopened
  // output's { type:'hello' }). No-op if nothing has subscribed yet.
  const deliver = (data: unknown) => {
    messageCb?.({ data })
  }
  return { factory, posted, close, deliver }
}

// ── Fake screens + window plumbing ─────────────────────────────────────────────
function makeScreen(overrides: Partial<ScreenLike> = {}): ScreenLike {
  return { label: 'Screen', width: 1920, height: 1080, left: 0, top: 0, isPrimary: true, ...overrides }
}

const screenA = makeScreen({ label: 'Front Wall', left: 0, top: 0, isPrimary: true })
const screenB = makeScreen({ label: 'Stage Monitor', left: 1920, top: 0, isPrimary: false })

// Every fake window openWindow() returns is captured here so per-window
// moveTo/requestFullscreen/close spies are inspectable after the gesture.
// 96-02: `closed` is MUTABLE (default false) — the impl's ~1s poll reads
// outputWindows[name]?.closed, so a test flips openedWins[i].closed = true to
// simulate a closed output. Pre-96 tests never set it, so their poll never latches.
type FakeWin = {
  moveTo: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  closed: boolean
  // postMessage — the target of the opener's Fullscreen Capability Delegation
  // ({ type:'wp-fullscreen-delegate' }) once the output posts wp-output-ready.
  postMessage: ReturnType<typeof vi.fn>
  document: { documentElement: { requestFullscreen: ReturnType<typeof vi.fn> } }
}
let openedWins: FakeWin[] = []
function makeFakeWin(): Window {
  const win: FakeWin = {
    moveTo: vi.fn(),
    close: vi.fn(),
    closed: false,
    postMessage: vi.fn(),
    document: { documentElement: { requestFullscreen: vi.fn().mockResolvedValue(undefined) } },
  }
  openedWins.push(win)
  return win as unknown as Window
}

// 96-02: the ScreenDetails-like fake the upgraded install returns — a MUTABLE
// screens set (read live via the getter each time the impl re-reads .screens) plus
// a CAPTURING addEventListener and a removeEventListener spy. control lets a test
// mutate the live set and fire the captured screenschange listener directly.
type FakeScreenDetails = {
  readonly screens: ScreenLike[]
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}
type ScreenDetailsControl = {
  setScreens: (next: ScreenLike[]) => void
  fireScreensChange: () => void
}

/**
 * Install a resolving getScreenDetails() returning a ScreenDetails-like object.
 * 96-02 upgrade: it resolves { screens (mutable via control.setScreens),
 * addEventListener (captures the 'screenschange' listener), removeEventListener
 * (a spy) } rather than a bare { screens }. The matched/fallback pre-96 blocks
 * only read .screens so they stay green; Task 2 uses the captured listener + the
 * mutable set to exercise the REAL onScreensChange/matchMapping.
 */
function installGetScreenDetails(initialScreens: ScreenLike[]) {
  let live = [...initialScreens]
  let listener: () => void = () => {}
  const details: FakeScreenDetails = {
    get screens() {
      return live
    },
    addEventListener: vi.fn((type: string, l: () => void) => {
      if (type === 'screenschange') listener = l
    }),
    removeEventListener: vi.fn(),
  }
  const control: ScreenDetailsControl = {
    setScreens(next: ScreenLike[]) {
      live = next
    },
    fireScreensChange() {
      listener()
    },
  }
  const fn = vi.fn(() => Promise.resolve(details))
  ;(window as unknown as { getScreenDetails: unknown }).getScreenDetails = fn
  return { fn, details, control }
}

/** Install a REJECTING getScreenDetails() (the denied path). */
function installDeniedGetScreenDetails() {
  const fn = vi.fn(() => Promise.reject(new Error('permission denied')))
  ;(window as unknown as { getScreenDetails: unknown }).getScreenDetails = fn
  return fn
}

/**
 * Install a DEFERRED getScreenDetails() whose resolution is controlled by the
 * caller — the promise stays pending until `resolve()` is invoked. Lets a test
 * interleave an exit/unmount BETWEEN the Go-live click and the getScreenDetails
 * resolution to exercise the WR-01 stale-resolution guard.
 */
function installDeferredGetScreenDetails(screens: ScreenLike[]) {
  let release: () => void = () => {}
  const promise = new Promise<{ screens: ScreenLike[] }>((res) => {
    release = () => res({ screens })
  })
  const fn = vi.fn(() => promise)
  ;(window as unknown as { getScreenDetails: unknown }).getScreenDetails = fn
  return { fn, resolve: release }
}

function seedMatchingMapping() {
  saveMapping({
    assignments: [
      { fingerprint: computeFingerprint(screenA), role: 'audience' },
      { fingerprint: computeFingerprint(screenB), role: 'confidence' },
    ],
    savedAt: Date.now(),
  })
}

// Fingerprints for screens that are NOT among the live screens → needs-reprompt.
const OTHER_A = makeScreen({ label: 'Old Front', left: 100, top: 100 })
const OTHER_B = makeScreen({ label: 'Old Stage', left: 3000, top: 0, isPrimary: false })

function seedNonMatchingMapping() {
  saveMapping({
    assignments: [
      { fingerprint: computeFingerprint(OTHER_A), role: 'audience' },
      { fingerprint: computeFingerprint(OTHER_B), role: 'confidence' },
    ],
    savedAt: Date.now(),
  })
}

// ── Window-name/URL expectations, 114-03: fingerprint-keyed (wp-output-<fp>),
//    not the old fixed 'wp-audience'/'wp-confidence'. Each opened URL now also
//    carries the assignment's fingerprint as the SCREEN_QUERY_PARAM (?screen=).
const AUDIENCE_ASSIGNMENT = { fingerprint: computeFingerprint(screenA), role: 'audience' as const }
const CONFIDENCE_ASSIGNMENT = { fingerprint: computeFingerprint(screenB), role: 'confidence' as const }
const AUDIENCE_WIN_NAME = windowNameFor(AUDIENCE_ASSIGNMENT)
const CONFIDENCE_WIN_NAME = windowNameFor(CONFIDENCE_ASSIGNMENT)
const AUDIENCE_URL = `/present/audience/service-1?org=org-1&screen=${encodeURIComponent(AUDIENCE_ASSIGNMENT.fingerprint)}`
const CONFIDENCE_URL = `/present/confidence/service-1?org=org-1&screen=${encodeURIComponent(CONFIDENCE_ASSIGNMENT.fingerprint)}`

// The stale/non-matching saved mapping (seedNonMatchingMapping) opens un-positioned
// with ITS OWN (stale) fingerprints — never the live screenA/screenB ones.
const OTHER_AUDIENCE_ASSIGNMENT = { fingerprint: computeFingerprint(OTHER_A), role: 'audience' as const }
const OTHER_CONFIDENCE_ASSIGNMENT = { fingerprint: computeFingerprint(OTHER_B), role: 'confidence' as const }
const OTHER_AUDIENCE_WIN_NAME = windowNameFor(OTHER_AUDIENCE_ASSIGNMENT)
const OTHER_CONFIDENCE_WIN_NAME = windowNameFor(OTHER_CONFIDENCE_ASSIGNMENT)
const OTHER_AUDIENCE_URL = `/present/audience/service-1?org=org-1&screen=${encodeURIComponent(OTHER_AUDIENCE_ASSIGNMENT.fingerprint)}`
const OTHER_CONFIDENCE_URL = `/present/confidence/service-1?org=org-1&screen=${encodeURIComponent(OTHER_CONFIDENCE_ASSIGNMENT.fingerprint)}`

// CONTEXT.md dev/nothing-assigned fallback (no saved mapping at all) — the two
// virtual default assignments useRunControl.ts opens when nothing is configured.
const DEFAULT_AUDIENCE_ASSIGNMENT = { fingerprint: 'default-audience', role: 'audience' as const }
const DEFAULT_CONFIDENCE_ASSIGNMENT = { fingerprint: 'default-confidence', role: 'confidence' as const }
const DEFAULT_AUDIENCE_WIN_NAME = windowNameFor(DEFAULT_AUDIENCE_ASSIGNMENT)
const DEFAULT_CONFIDENCE_WIN_NAME = windowNameFor(DEFAULT_CONFIDENCE_ASSIGNMENT)
const DEFAULT_AUDIENCE_URL = `/present/audience/service-1?org=org-1&screen=${encodeURIComponent('default-audience')}`
const DEFAULT_CONFIDENCE_URL = `/present/confidence/service-1?org=org-1&screen=${encodeURIComponent('default-confidence')}`

let openSpy: ReturnType<typeof vi.spyOn>

function mountView() {
  const fake = createFakeChannel()
  const wrapper = mount(RunControlView, {
    props: { channelFactory: fake.factory },
    // <router-link> is resolved by the router plugin in the app; register the
    // same anchor stub here so the fallback banner's monitor-setup link renders
    // as an <a data-to="…"> rather than an unresolved custom element.
    global: {
      stubs: {
        RouterLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' },
      },
    },
  })
  return { wrapper, fake }
}

/**
 * Drive the EXPLICIT Go-live gesture: mount settles idle, then the
 * run-go-live-btn click opens the outputs (the ONLY open entry — never mount).
 */
async function goLive(wrapper: ReturnType<typeof mountView>['wrapper']) {
  await flushPromises()
  await wrapper.find('[data-testid="run-go-live-btn"]').trigger('click')
  await flushPromises()
}

/**
 * 96-02 — the Go-live gesture under FAKE timers. flushPromises leans on real
 * timers, so with vi.useFakeTimers() active we settle the mount + flush the
 * getScreenDetails().then microtasks via vi.advanceTimersByTimeAsync(0) instead
 * (it drains the microtask queue between ticks). After this the outputs are open
 * and the impl's ~1s startClosedPoll interval is live under fake timers.
 */
async function goLiveFake(wrapper: ReturnType<typeof mountView>['wrapper']) {
  await vi.advanceTimersByTimeAsync(0)
  await wrapper.find('[data-testid="run-go-live-btn"]').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  // Phase 104: useRunControl now reads the notifications store (@/stores/toasts)
  // for the monitor-reassign sticky — an active Pinia instance is required.
  setActivePinia(createPinia())
  localStorage.clear()
  openedWins = []
  mockRouterPush.mockClear()
  capturedRouteLeaveGuard = undefined
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => makeFakeWin())
  // jsdom does not implement Element.prototype.scrollIntoView; the rail's
  // active-row auto-scroll watch calls it after postIndex(0) on mount. Stub it
  // so that watch does not raise an unhandled rejection.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
  vi.restoreAllMocks()
})

// ── 0. PRE-OPEN — the open is gesture-driven, nothing opens on mount ────────────
describe('RunControlView output — pre-open idle state (R261; T-95-19)', () => {
  it('does NOT call window.open on mount, shows run-go-live-btn, and claims nothing opened', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await flushPromises()

    // The open is driven by the click, NOT by mounting.
    expect(openSpy).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="run-go-live-btn"]').exists()).toBe(true)
    // Idle never claims a display opened — pre-live State A renders no Displays panel.
    expect(wrapper.find('[data-testid="run-displays-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(false)
  })
})

// ── N-ASSIGNMENT ORCHESTRATION (114-03) — multiple Audience monitors + the
//    ≥1-Audience go-live gate ───────────────────────────────────────────────
const screenC = makeScreen({ label: 'Second Wall', left: 3840, top: 0, isPrimary: false })

function seedTwoAudienceMapping() {
  saveMapping({
    assignments: [
      { fingerprint: computeFingerprint(screenA), role: 'audience' },
      { fingerprint: computeFingerprint(screenC), role: 'audience' },
      { fingerprint: computeFingerprint(screenB), role: 'confidence' },
    ],
    savedAt: Date.now(),
  })
}

describe('RunControlView output — N-assignment orchestration (114-03)', () => {
  it('two Audience assignments + one Confidence: opens THREE windows, each with a distinct fingerprint-derived name and its own screen param', async () => {
    seedTwoAudienceMapping()
    installGetScreenDetails([screenA, screenB, screenC])
    const { wrapper } = mountView()

    await goLive(wrapper)

    expect(openSpy).toHaveBeenCalledTimes(3)
    const names = openSpy.mock.calls.map((c: unknown[]) => c[1])
    expect(new Set(names).size).toBe(3) // three DISTINCT window names — no collision
    const urls = openSpy.mock.calls.map((c: unknown[]) => c[0])
    expect(urls.every((u: unknown) => typeof u === 'string' && u.includes('&screen='))).toBe(true)
    expect(wrapper.find('[data-testid="run-live-status"]').classes()).toContain('run-status--live')
  })

  it('canGoLive is false when the saved mapping has no Audience assignment — Go-live is a no-op', async () => {
    saveMapping({
      assignments: [{ fingerprint: computeFingerprint(screenB), role: 'confidence' }],
      savedAt: Date.now(),
    })
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="run-go-live-btn"]').trigger('click')
    await flushPromises()

    // The ≥1-Audience gate (CONTEXT.md) blocked go-live entirely — nothing
    // opened, and the session never becomes live (still honest pre-flight).
    expect(openSpy).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="run-live-status"]').classes()).not.toContain('run-status--live')
    expect(wrapper.find('[data-testid="run-displays-panel"]').exists()).toBe(false)
  })
})

// ── 1. MATCHED — open + place both windows on their assigned screens ────────────
describe('RunControlView output — matched placement (R261/R266)', () => {
  it('opens the audience + confidence windows with stable names + placement features, and shows both outputs green/ready in the Displays panel', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)

    // Both windows opened with the exact URLs (incl. ?org=) + stable names, and
    // WITH placement features (a non-empty third arg).
    expect(openSpy).toHaveBeenCalledWith(AUDIENCE_URL, AUDIENCE_WIN_NAME, expect.stringMatching(/width=/))
    expect(openSpy).toHaveBeenCalledWith(CONFIDENCE_URL, CONFIDENCE_WIN_NAME, expect.stringMatching(/width=/))

    // Both handles came back (the placement features position each window).
    expect(openedWins).toHaveLength(2)
    // NOTE: the opener no longer calls the child document's requestFullscreen
    // (that cross-document call targeted the child's blank/loading doc and never
    // worked). Auto-fullscreen is now Fullscreen Capability Delegation — proven in
    // the dedicated delegation suite below — so no per-window requestFullscreen is
    // expected here.
    for (const win of openedWins) {
      expect(win.document.documentElement.requestFullscreen).not.toHaveBeenCalled()
    }

    // The honest success surface renders — both outputs green/ready in the Displays
    // panel (owner fix #4, replacing the removed "Displays ready" status band); no
    // fallback/blocked banner.
    expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-ready-confidence"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(false)
  })
})

// ── 2-4. FALLBACK — every not-matched path degrades to un-positioned pop-outs ───
describe('RunControlView output — fallback pop-outs (R261)', () => {
  it('needs-reprompt (saved mapping does not match live screens): opens both UN-POSITIONED + amber banner + monitor-setup link, no requestFullscreen, no throw', async () => {
    seedNonMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)

    // Both windows opened, but with NO placement features (un-positioned) — and
    // with the STALE saved fingerprints (never the live screenA/screenB ones).
    expect(openSpy).toHaveBeenCalledWith(OTHER_AUDIENCE_URL, OTHER_AUDIENCE_WIN_NAME, '')
    expect(openSpy).toHaveBeenCalledWith(OTHER_CONFIDENCE_URL, OTHER_CONFIDENCE_WIN_NAME, '')
    for (const win of openedWins) {
      expect(win.document.documentElement.requestFullscreen).not.toHaveBeenCalled()
    }

    const banner = wrapper.find('[data-testid="run-fallback-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.find('a[data-to="/monitor-setup"]').exists()).toBe(true)
    // The amber fallback banner (not a green "Displays ready") is the honest signal.
  })

  it('no saved mapping at all: still opens both un-positioned + fallback banner', async () => {
    // localStorage cleared in beforeEach → loadMapping() returns null.
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)

    // Nothing configured (CONTEXT.md dev fallback) — the default virtual pair opens.
    expect(openSpy).toHaveBeenCalledWith(DEFAULT_AUDIENCE_URL, DEFAULT_AUDIENCE_WIN_NAME, '')
    expect(openSpy).toHaveBeenCalledWith(DEFAULT_CONFIDENCE_URL, DEFAULT_CONFIDENCE_WIN_NAME, '')
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(true)
  })

  it('unavailable (getScreenDetails absent): opens both un-positioned + fallback banner, no throw', async () => {
    delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
    expect('getScreenDetails' in window).toBe(false)
    const { wrapper } = mountView()

    let error: unknown = null
    try {
      await goLive(wrapper)
    } catch (e) {
      error = e
    }
    expect(error).toBeNull()

    expect(openSpy).toHaveBeenCalledWith(DEFAULT_AUDIENCE_URL, DEFAULT_AUDIENCE_WIN_NAME, '')
    expect(openSpy).toHaveBeenCalledWith(DEFAULT_CONFIDENCE_URL, DEFAULT_CONFIDENCE_WIN_NAME, '')
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(true)
    for (const win of openedWins) {
      expect(win.document.documentElement.requestFullscreen).not.toHaveBeenCalled()
    }
  })

  it('denied (getScreenDetails rejects): the .catch path opens both un-positioned + fallback banner, no throw', async () => {
    installDeniedGetScreenDetails()
    const { wrapper } = mountView()

    let error: unknown = null
    try {
      await goLive(wrapper)
    } catch (e) {
      error = e
    }
    expect(error).toBeNull()

    expect(openSpy).toHaveBeenCalledWith(DEFAULT_AUDIENCE_URL, DEFAULT_AUDIENCE_WIN_NAME, '')
    expect(openSpy).toHaveBeenCalledWith(DEFAULT_CONFIDENCE_URL, DEFAULT_CONFIDENCE_WIN_NAME, '')
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(true)
  })
})

// ── 5. BLOCKED — window.open returns null for BOTH → honest blocked banner ──────
describe('RunControlView output — blocked (pop-up refused) (R261; T-95-16/T-95-19)', () => {
  it('window.open null for BOTH windows: surfaces run-blocked-banner (NOT placed/fallback), attempts no requestFullscreen, and never throws', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    openSpy.mockReturnValue(null)
    const { wrapper } = mountView()

    let error: unknown = null
    try {
      await goLive(wrapper)
    } catch (e) {
      error = e
    }
    expect(error).toBeNull()

    // window.open WAS attempted, but zero handles came back.
    expect(openSpy).toHaveBeenCalledWith(AUDIENCE_URL, AUDIENCE_WIN_NAME, expect.any(String))
    expect(openSpy).toHaveBeenCalledWith(CONFIDENCE_URL, CONFIDENCE_WIN_NAME, expect.any(String))
    expect(openedWins).toHaveLength(0)

    // The HONEST blocked state — never a success/opened claim while zero opened.
    // live stayed false, so State B (and its Displays panel) never rendered.
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-displays-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
  })
})

// ── 5b. ≥1-AUDIENCE GATE (CONTEXT.md; 114-03) ────────────────────────────────
//    A refused CONFIDENCE window no longer blocks go-live (Confidence is
//    optional) — only a refused AUDIENCE window does. This is a deliberate
//    114-03 behavior change from the pre-multi-monitor "both must open" rule.
describe('RunControlView output — ≥1-Audience gate replaces the old both-must-open rule (114-03)', () => {
  it('matched but the CONFIDENCE window.open returns null: STILL a live success (Audience opened) — Confidence simply shows not-open', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    // First open (audience) succeeds; second (confidence) is refused → null.
    openSpy
      .mockImplementationOnce(() => makeFakeWin())
      .mockImplementationOnce(() => null)
    const { wrapper } = mountView()

    await goLive(wrapper)

    // Live succeeded on the strength of the Audience window alone.
    expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-partial-banner"]').exists()).toBe(false)

    // Confidence never opened — it reads "Not open", never a false "ready" claim.
    expect(wrapper.find('[data-testid="run-display-ready-confidence"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-display-closed-confidence"]').exists()).toBe(false)
  })

  it('matched but the AUDIENCE window.open returns null (Confidence opens): NOT a live success — the ≥1-Audience gate blocks it', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    // First open (audience) refused → null; second (confidence) succeeds.
    openSpy
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => makeFakeWin())
    const { wrapper } = mountView()

    await goLive(wrapper)

    // No green "Displays ready" (live stayed false → no Displays panel).
    expect(wrapper.find('[data-testid="run-displays-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(false)

    // The honest partial banner renders and names the missing Audience display.
    const banner = wrapper.find('[data-testid="run-partial-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text().toLowerCase()).toContain('audience')
    expect(wrapper.find('[data-testid="run-partial-retry"]').exists()).toBe(true)
  })

  it('fallback path with the AUDIENCE window.open null: NOT the both-opened fallback banner — honest partial state naming the audience display', async () => {
    // No saved mapping → openUnplaced (fallback) path.
    installGetScreenDetails([screenA, screenB])
    // First open (audience) refused → null; second (confidence) succeeds.
    openSpy
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => makeFakeWin())
    const { wrapper } = mountView()

    await goLive(wrapper)

    // The amber fallback banner claims BOTH windows opened — it must NOT show, and
    // live stayed false so no Displays panel rendered.
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-displays-panel"]').exists()).toBe(false)

    const banner = wrapper.find('[data-testid="run-partial-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text().toLowerCase()).toContain('audience')
  })
})

// ── 5d. DISMISSIBLE MONITOR WARNINGS + FALLBACK RELOCATED INTO THE DISPLAYS
//    PANEL (v2.9) — the "finish setting up your displays" help no longer sits
//    stuck in the top band; it renders inside RunDisplaysPanel (State B) and is
//    dismissible, and the State-A blocked/partial banners gain a dismiss X. ────
describe('RunControlView output — dismissible monitor warnings (v2.9)', () => {
  it('the "finish setting up your displays" fallback help renders INSIDE the Displays panel (off the top band), with the monitor-setup link', async () => {
    // No saved mapping (localStorage cleared in beforeEach) → fallback path, live.
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)

    const panel = wrapper.find('[data-testid="run-displays-panel"]')
    expect(panel.exists()).toBe(true)
    // The relocated help is a DESCENDANT of the Displays panel now, not a sibling
    // top banner, and keeps the monitor-setup link.
    const notice = panel.find('[data-testid="run-fallback-banner"]')
    expect(notice.exists()).toBe(true)
    expect(notice.find('a[data-to="/monitor-setup"]').exists()).toBe(true)
  })

  it('the fallback help is dismissible — run-fallback-dismiss hides it while the session stays live', async () => {
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(true)

    await wrapper.find('[data-testid="run-fallback-dismiss"]').trigger('click')

    // Dismiss only hides the help — the outputs / Displays panel stay live.
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-displays-panel"]').exists()).toBe(true)
  })

  it('the blocked banner is dismissible — run-blocked-dismiss hides it', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    openSpy.mockReturnValue(null) // BOTH windows refused → blocked (State A)
    const { wrapper } = mountView()

    await goLive(wrapper)
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(true)

    await wrapper.find('[data-testid="run-blocked-dismiss"]').trigger('click')

    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(false)
  })

  it('the partial banner is dismissible — run-partial-dismiss hides it', async () => {
    // No saved mapping → fallback path; audience refused (null) → honest partial.
    installGetScreenDetails([screenA, screenB])
    openSpy.mockImplementationOnce(() => null).mockImplementationOnce(() => makeFakeWin())
    const { wrapper } = mountView()

    await goLive(wrapper)
    expect(wrapper.find('[data-testid="run-partial-banner"]').exists()).toBe(true)

    await wrapper.find('[data-testid="run-partial-dismiss"]').trigger('click')

    expect(wrapper.find('[data-testid="run-partial-banner"]').exists()).toBe(false)
  })
})

// ── 5c. STALE RESOLUTION — a late getScreenDetails resolve after exit/unmount ─────
//        must open NO orphaned output windows (WR-01 / Pitfall 6).
describe('RunControlView output — stale-resolution guard (WR-01)', () => {
  it('a confirmed EXIT between Go live and the getScreenDetails resolution opens NO output windows', async () => {
    seedMatchingMapping()
    const deferred = installDeferredGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await flushPromises()

    // Click Go live — getScreenDetails is now IN FLIGHT (still pending).
    await wrapper.find('[data-testid="run-go-live-btn"]').trigger('click')
    await flushPromises()
    expect(openSpy).not.toHaveBeenCalled() // nothing opened yet

    // Operator exits run mode BEFORE the promise resolves.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await flushPromises()

    // NOW the late getScreenDetails resolves — the stale guard must no-op it.
    deferred.resolve()
    await flushPromises()

    // No windows opened after exit → no orphans.
    expect(openSpy).not.toHaveBeenCalled()
    expect(openedWins).toHaveLength(0)
  })

  it('an UNMOUNT between Go live and the getScreenDetails resolution opens NO output windows', async () => {
    seedMatchingMapping()
    const deferred = installDeferredGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="run-go-live-btn"]').trigger('click')
    await flushPromises()
    expect(openSpy).not.toHaveBeenCalled()

    // The view tears down while the resolve is still pending.
    wrapper.unmount()
    deferred.resolve()
    await flushPromises()

    expect(openSpy).not.toHaveBeenCalled()
    expect(openedWins).toHaveLength(0)
  })
})

// ── 6. CLOSE ON EXIT — exit tears down every opened output window ────────────────
describe('RunControlView output — close on exit (R266)', () => {
  it('the Escape → run-exit-confirm exit calls close() on each previously-opened window', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)
    expect(openedWins).toHaveLength(2)

    // Escape opens the confirm dialog (teleported to body), then confirm exits.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await flushPromises()

    // Every output window was closed before navigation.
    for (const win of openedWins) {
      expect(win.close).toHaveBeenCalledTimes(1)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Phase 96 Plan 02 (R273/R274) — LIVE-OPS HARDENING behavioral coverage.
//
// Everything below stays CLIENT-ONLY: no firebase/firestore/emulator module is
// imported anywhere in this file, and no assertion touches a server path. R273
// (single source of truth; a reopened output re-syncs to the exact current index
// via the existing hello→resend handshake) and R274 (one-click reopen/reassign
// without losing the slide) are pure client + BroadcastChannel + localStorage, so
// `npm run test:rules` is NOT a gate for this phase. Every window/screen/timer/
// channel message is faked — no real window opens, no real getScreenDetails runs.
// ════════════════════════════════════════════════════════════════════════════

// ── 7. CLOSED DETECTION + PER-ROLE REOPEN + POSITION PRESERVED (R273/R274) ──────
//    Fake timers are SCOPED to this block so the impl's ~1s closed-poll can be
//    driven with vi.advanceTimersByTimeAsync (which flushes microtasks between
//    ticks, so the getScreenDetails().then settles too).
describe('RunControlView output — closed detection, per-role reopen, position preserved (R273/R274)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a closed AUDIENCE handle surfaces run-display-closed-audience + run-display-reopen-audience for that role ONLY, session stays live', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLiveFake(wrapper)
    // Go-live succeeded — the Displays panel shows both outputs green/ready.
    expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-ready-confidence"]').exists()).toBe(true)
    expect(openedWins).toHaveLength(2)

    // Audience opens first in openPlaced, so openedWins[0] is the audience handle.
    openedWins[0]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)

    // Only the audience line turns amber; confidence stays green; the session
    // stays live (the closed flags do NOT change outputStatus).
    expect(wrapper.find('[data-testid="run-display-closed-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-reopen-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-closed-confidence"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-display-reopen-confidence"]').exists()).toBe(false)
    // The cluster stays live — confidence is still green/ready in the Displays panel.
    expect(wrapper.find('[data-testid="run-display-ready-confidence"]').exists()).toBe(true)
  })

  it('a closed CONFIDENCE handle surfaces run-display-closed-confidence + run-display-reopen-confidence for that role ONLY', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLiveFake(wrapper)

    // openedWins[1] is the confidence handle (opened second in openPlaced).
    openedWins[1]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)

    expect(wrapper.find('[data-testid="run-display-closed-confidence"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-reopen-confidence"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-closed-audience"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-display-reopen-audience"]').exists()).toBe(false)
  })

  it('clicking run-display-reopen-audience re-opens the AUDIENCE window only (not confidence) and clears the amber row on a non-null handle', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLiveFake(wrapper)
    openedWins[0]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.find('[data-testid="run-display-closed-audience"]').exists()).toBe(true)

    const callsBefore = openSpy.mock.calls.length
    await wrapper.find('[data-testid="run-display-reopen-audience"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    // Exactly ONE more window.open — the audience name, placed (matched → features).
    expect(openSpy.mock.calls.length).toBe(callsBefore + 1)
    expect(openSpy).toHaveBeenLastCalledWith(AUDIENCE_URL, AUDIENCE_WIN_NAME, expect.stringMatching(/width=/))
    // The reopen never touched the confidence window in this click.
    const reopenCall = openSpy.mock.calls[openSpy.mock.calls.length - 1]!
    expect(reopenCall[0]).not.toBe(CONFIDENCE_URL)
    // A non-null handle cleared the amber row back to green.
    expect(wrapper.find('[data-testid="run-display-closed-audience"]').exists()).toBe(false)
  })

  it('a REFUSED reopen (window.open returns null) keeps the amber closed row — never a false "recovered" claim (T-96-12)', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLiveFake(wrapper)
    openedWins[0]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.find('[data-testid="run-display-closed-audience"]').exists()).toBe(true)

    // The pop-up blocker refuses the reopen → null handle → the row must remain.
    openSpy.mockReturnValueOnce(null as unknown as Window)
    await wrapper.find('[data-testid="run-display-reopen-audience"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="run-display-closed-audience"]').exists()).toBe(true)
  })

  it('POSITION PRESERVED: after ArrowRight→index 2, close→reopen→deliver({type:"hello"}), the last posted state.index === the pre-close index (T-96-13)', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper, fake } = mountView()

    await goLiveFake(wrapper)

    // Navigate to a non-zero index (0 → 1 → 2) so the pre-close slide is not slide 0.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await vi.advanceTimersByTimeAsync(0)
    const stateBefore = fake.posted.filter((m) => m.type === 'state')
    const preCloseIndex = stateBefore[stateBefore.length - 1]!.index
    expect(preCloseIndex).toBe(2)

    // Close the audience output, latch it via the poll, then reopen.
    openedWins[0]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)
    await wrapper.find('[data-testid="run-display-reopen-audience"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    // The reopened output announces itself with a hello → onHello(resendCurrent)
    // resends the CURRENT index. Nothing is persisted; the channel restores place.
    fake.deliver({ type: 'hello' })
    await vi.advanceTimersByTimeAsync(0)

    const stateAfter = fake.posted.filter((m) => m.type === 'state')
    const lastState = stateAfter[stateAfter.length - 1]!
    expect(lastState.index).toBe(2)
    expect(lastState.index).toBe(preCloseIndex)
  })
})

// ── 8. MONITOR-UNPLUG → REASSIGN (R274; migrated to the shared notification
//    store in Phase 104, R310) ────────────────────────────────────────────────
//    The screenschange tests invoke the CAPTURED listener directly (no timers),
//    avoiding the flushPromises/fake-timer interaction entirely. The old
//    run-reassign-banner/-reopen/-setup-link testids are gone (the inline v-if
//    banner was removed); the host that would render this sticky is mounted at
//    App.vue, not inside this RunControlView-only test tree, so these assert
//    directly against the notifications store's 'monitor-reassign' sticky.
function reassignSticky() {
  return useToasts().toasts.find((t) => t.key === 'monitor-reassign')
}

describe('RunControlView output — monitor-unplug reassign sticky (R274/R310)', () => {
  it('a screenschange that drops an assigned monitor (needs-reprompt) sets the monitor-reassign sticky with a working reopen action + monitor-setup link', async () => {
    seedMatchingMapping()
    const { control } = installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)
    // Go-live succeeded (audience green/ready in the Displays panel); no reassign yet.
    expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(true)
    expect(reassignSticky()).toBeUndefined()

    // The confidence monitor (screenB) is unplugged → the live set drops it →
    // matchMapping returns needs-reprompt.
    control.setScreens([screenA])
    control.fireScreensChange()
    await flushPromises()

    const sticky = reassignSticky()
    expect(sticky).toBeTruthy()
    expect(sticky?.variant).toBe('warning')
    expect(sticky?.heading).toBe('Your monitor setup changed')
    // WR-01: the PRIMARY action is an in-place reopen (place-preserving), and the
    // monitor-setup affordance opens in a NEW TAB so the running control is not
    // torn down.
    expect(sticky?.action?.label).toContain('Reopen')
    expect(sticky?.link).toEqual({ label: 'Open monitor setup in a new tab', href: '/monitor-setup' })
  })

  it('a still-matching screenschange (benign refresh) sets NO monitor-reassign sticky (no false alarm)', async () => {
    seedMatchingMapping()
    const { control } = installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)

    // The live set is unchanged (both monitors still present) → matched → silent.
    control.fireScreensChange()
    await flushPromises()

    expect(reassignSticky()).toBeUndefined()
  })

  it('the IN-PLACE reassign reopen (the sticky action) re-opens the affected role WITHOUT unmounting the control and WITHOUT losing index (WR-01; R274)', async () => {
    seedMatchingMapping()
    const { control } = installGetScreenDetails([screenA, screenB])
    const { wrapper, fake } = mountView()

    await goLive(wrapper)

    // Navigate to a non-zero index (0 → 1 → 2) so a lost session would show.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await flushPromises()
    const before = fake.posted.filter((m) => m.type === 'state')
    const preChangeIndex = before[before.length - 1]!.index
    expect(preChangeIndex).toBe(2)

    // Unplug the CONFIDENCE monitor (screenB gone) → needs-reprompt → sticky up,
    // with the confidence role named as the one that lost its screen.
    control.setScreens([screenA])
    control.fireScreensChange()
    await flushPromises()
    const sticky = reassignSticky()
    expect(sticky).toBeTruthy()

    const callsBefore = openSpy.mock.calls.length
    // Invoke the sticky's PRIMARY action — re-resolves confidence against the
    // CURRENT screens (gone → un-positioned honest fallback) and reopens it.
    sticky!.action!.onClick()
    await flushPromises()

    // Exactly one reopen for the affected (confidence) role, un-positioned since
    // its saved monitor is gone — NOT a control-destroying navigation.
    expect(openSpy.mock.calls.length).toBe(callsBefore + 1)
    expect(openSpy).toHaveBeenLastCalledWith(CONFIDENCE_URL, CONFIDENCE_WIN_NAME, '')

    // The control is STILL mounted (its top-bar heading still renders) and the
    // channel was NOT closed — the running session survived the recovery.
    expect(wrapper.find('[data-testid="run-service-name"]').exists()).toBe(true)
    expect(fake.close).not.toHaveBeenCalled()
    // Sticky cleared now that the reopen ran.
    expect(reassignSticky()).toBeUndefined()

    // The reopened output announces itself → onHello(resendCurrent) resends the
    // CURRENT index; position is restored by the handshake, nothing persisted.
    fake.deliver({ type: 'hello' })
    await flushPromises()

    const after = fake.posted.filter((m) => m.type === 'state')
    const lastState = after[after.length - 1]!
    expect(lastState.index).toBe(2)
    expect(lastState.index).toBe(preChangeIndex)
  })

  it('exiting the run while the sticky is up clears it (R309 — no message may stay stuck across routes)', async () => {
    seedMatchingMapping()
    const { control } = installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)
    control.setScreens([screenA])
    control.fireScreensChange()
    await flushPromises()
    expect(reassignSticky()).toBeTruthy()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
    confirmBtn!.click()
    await flushPromises()

    expect(reassignSticky()).toBeUndefined()
  })
})

// ── 9. PRECEDENCE — the reassign sticky's presence suppresses the reopen chip
//    (R274; 96-UI-SPEC §B; the sticky itself migrated to the shared store in
//    Phase 104) ─────────────────────────────────────────────────────────────
describe('RunControlView output — closed-vs-unplug precedence (R274)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('with BOTH a closed audience window AND a monitor change, the monitor-reassign sticky is set and run-display-reopen-audience is SUPPRESSED', async () => {
    seedMatchingMapping()
    const { control } = installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLiveFake(wrapper)

    // Close the audience output AND latch it via the poll (chip would show alone).
    openedWins[0]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)
    // Then a monitor unplug (needs-reprompt) → monitorChanged wins precedence.
    control.setScreens([screenA])
    control.fireScreensChange()
    await vi.advanceTimersByTimeAsync(0)

    expect(reassignSticky()).toBeTruthy()
    // The reopen chip is gated on !monitorChanged → suppressed until reassignment.
    expect(wrapper.find('[data-testid="run-display-reopen-audience"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-display-closed-audience"]').exists()).toBe(false)
    // WR-02: under close+unplug precedence the closed audience line must NOT fall
    // through to the GREEN "ready" label — a closed window is never rendered green.
    expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(false)
    // Instead it shows the muted amber "reassign displays" indicator (no chip).
    expect(wrapper.find('[data-testid="run-display-closed-audience-muted"]').exists()).toBe(true)
  })
})

// ── 10. NO-LEAK / SINGLE-TEARDOWN (R274 endurance; T-96-11) ──────────────────────
describe('RunControlView output — no-leak / single teardown (R274)', () => {
  it('removeEventListener("screenschange", …) fires on the run-exit-confirm EXIT', async () => {
    seedMatchingMapping()
    const { details } = installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)
    expect(details.addEventListener).toHaveBeenCalledWith('screenschange', expect.any(Function))
    expect(details.removeEventListener).not.toHaveBeenCalled()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await flushPromises()

    expect(details.removeEventListener).toHaveBeenCalledWith('screenschange', expect.any(Function))
  })

  it('removeEventListener("screenschange", …) fires on wrapper.unmount()', async () => {
    seedMatchingMapping()
    const { details } = installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)
    expect(details.removeEventListener).not.toHaveBeenCalled()

    wrapper.unmount()

    expect(details.removeEventListener).toHaveBeenCalledWith('screenschange', expect.any(Function))
  })

  it('after a deliberate EXIT, advancing timers surfaces NO reopen chip — the poll was cleared (the load-bearing gotcha)', async () => {
    vi.useFakeTimers()
    try {
      seedMatchingMapping()
      installGetScreenDetails([screenA, screenB])
      const { wrapper } = mountView()

      await goLiveFake(wrapper)
      expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(true)

      // Deliberate exit: Escape → confirm. confirmExit runs stopRecoveryWatchers,
      // clearing the poll BEFORE closeOutputs (which never nulls the handles).
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await vi.advanceTimersByTimeAsync(0)
      const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
      expect(confirmBtn).not.toBeNull()
      confirmBtn!.click()
      await vi.advanceTimersByTimeAsync(0)

      // A window the operator closed on exit stays non-nulled in outputWindows; if
      // the poll had leaked it would latch audienceClosed and re-surface a chip.
      openedWins[0]!.closed = true
      await vi.advanceTimersByTimeAsync(2000)

      expect(wrapper.find('[data-testid="run-display-closed-audience"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="run-display-reopen-audience"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── 11. RAPID NAV SYNC (R273) ────────────────────────────────────────────────────
describe('RunControlView output — rapid navigation stays in sync (R273)', () => {
  it('a burst of ArrowRight×3 / ArrowLeft×1 posts state messages with strictly increasing seq and the correct final index', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper, fake } = mountView()

    await goLive(wrapper)

    // Rapid navigation: 0 → 1 → 2 → 3 (clamped runway of 4 slides) then 3 → 2.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await flushPromises()

    const stateMsgs = fake.posted.filter((m) => m.type === 'state')
    // Strictly increasing seq — no drop/reorder from the single-writer channel.
    for (let i = 1; i < stateMsgs.length; i++) {
      expect(stateMsgs[i]!.seq!).toBeGreaterThan(stateMsgs[i - 1]!.seq!)
    }
    // The final broadcast lands on the expected slide (3 forward, 1 back → 2).
    expect(stateMsgs[stateMsgs.length - 1]!.index).toBe(2)
  })
})

// ── 12. GO-LIVE FROM THE PRE-FLIGHT PANEL + GREEN LIVE STATUS (R276 owner fix #5 / R277)
//    run-go-live-btn now lives in State-A's RunPreflightPanel (relocated from the
//    old idle corner); the same testid drives go-live, only its location changed.
describe('RunControlView output — go-live from the pre-flight panel (R276/R277)', () => {
  it('a matched go-live via the pre-flight run-go-live-btn shows both outputs green/ready AND turns run-live-status green', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await flushPromises()

    // Pre-flight State A: the go-live button is in the pre-flight panel and the
    // live status is NOT yet green (honest — no screens open).
    expect(wrapper.find('[data-testid="run-preflight"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-go-live-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-live-status"]').classes()).not.toContain('run-status--live')

    await goLive(wrapper)

    // Placed AND genuinely live (green) — owner fix #5 (Go-live relocated) end-to-end.
    // A REAL go-live shows both outputs green/ready in the Displays panel and turns
    // the header status green (never the yellow "Rehearsing" tile), with "End Service".
    expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-ready-confidence"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-live-status"]').classes()).toContain('run-status--live')
    expect(wrapper.find('[data-testid="run-live-status"]').classes()).not.toContain('run-status--rehearsing')
    expect(wrapper.find('[data-testid="run-exit-btn"]').text()).toBe('End Service')
  })
})

// ── 13. BLACKOUT DURING A REAL PLACED LIVE SESSION (R280) ────────────────────────
//    Complements the rehearse-path blackout coverage in RunControlView.test.ts by
//    exercising blackout on the REAL placed path (both output windows faked-open).
describe('RunControlView output — blackout during a live session (R280)', () => {
  it('after a matched go-live, B / Black / Clear post blackout true/false with strictly increasing seq', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper, fake } = mountView()

    await goLive(wrapper)
    expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(true)

    const states = () => fake.posted.filter((m) => m.type === 'state')
    const seqBefore = states()[states().length - 1]!.seq!

    // 'B' blacks out the real placed session — blackout:true with a higher seq.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    await flushPromises()
    const last = states()[states().length - 1]!
    expect(last.blackout).toBe(true)
    expect(last.seq!).toBeGreaterThan(seqBefore)

    // 'B' again clears it.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    await flushPromises()
    expect(states()[states().length - 1]!.blackout).toBe(false)

    // The header blackout toggle (owner UAT — replaces the old Black/Clear panel)
    // renders ONLY in the truly-live state, which a matched go-live satisfies.
    const toggle = wrapper.find('[data-testid="run-blackout-toggle"]')
    expect(toggle.exists()).toBe(true)

    // It drives the SAME single-writer postBlackout: first click blacks out, the
    // second clears — each posting with a strictly higher seq.
    await toggle.trigger('click')
    await flushPromises()
    expect(states()[states().length - 1]!.blackout).toBe(true)

    await wrapper.find('[data-testid="run-blackout-toggle"]').trigger('click')
    await flushPromises()
    expect(states()[states().length - 1]!.blackout).toBe(false)

    // Monotonic seq across the whole live session — no blackout post swallowed.
    const seqs = states().map((m) => m.seq!)
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]!).toBeGreaterThan(seqs[i - 1]!)
    }
  })
})

// ── 14. CONTROL-SCREEN FULLSCREEN ON GO-LIVE / EXIT (owner UAT) ──────────────────
//    The operator asked for the CONTROL window to also enter fullscreen when
//    Running the service (Go-live), and to leave fullscreen on exit. openOutputs
//    requests fullscreen on the document root SYNCHRONOUSLY in the click path (so
//    the click activation authorizes it); confirmExit exits it only when the
//    document is actually fullscreen (a rehearse-only exit never entered it).
describe('RunControlView output — control-screen fullscreen on go-live/exit (owner UAT)', () => {
  function setDocFullscreenElement(value: Element | null) {
    Object.defineProperty(document, 'fullscreenElement', {
      value,
      configurable: true,
      writable: true,
    })
  }

  let rfsSpy: ReturnType<typeof vi.fn>
  let exitSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    rfsSpy = vi.fn().mockResolvedValue(undefined)
    exitSpy = vi.fn().mockResolvedValue(undefined)
    ;(document.documentElement as unknown as { requestFullscreen: unknown }).requestFullscreen = rfsSpy
    ;(document as unknown as { exitFullscreen: unknown }).exitFullscreen = exitSpy
    setDocFullscreenElement(null)
  })

  afterEach(() => {
    delete (document.documentElement as unknown as { requestFullscreen?: unknown }).requestFullscreen
    delete (document as unknown as { exitFullscreen?: unknown }).exitFullscreen
    setDocFullscreenElement(null)
  })

  it('go-live requests PLAIN fullscreen on the control document root (synchronously in the click path)', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)

    expect(rfsSpy).toHaveBeenCalledTimes(1)
    // Plain request — the control never passes a { screen } option.
    expect(rfsSpy.mock.calls[0]?.[0]).toBeUndefined()
  })

  it('confirmExit exits control fullscreen when the document IS fullscreen', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLive(wrapper)

    // Simulate the control window being fullscreen after go-live.
    setDocFullscreenElement(document.documentElement)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await flushPromises()

    expect(exitSpy).toHaveBeenCalledTimes(1)
  })

  it('confirmExit does NOT call exitFullscreen when the document is NOT fullscreen', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLive(wrapper)

    // Control never entered fullscreen (e.g. the request was refused).
    setDocFullscreenElement(null)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await flushPromises()

    expect(exitSpy).not.toHaveBeenCalled()
  })
})

// ── 14b. FULLSCREEN CAPABILITY DELEGATION (opener side) ──────────────────────────
//    A popup cannot self-fullscreen (it loses its own activation to its bootstrap),
//    so the control (which HOLDS activation from the Go-live click) delegates its
//    fullscreen capability to each opened output when that output posts
//    { type:'wp-output-ready' } back. Trust is gated on same-origin AND the message
//    source being one of OUR opened window handles; the listener is torn down on
//    exit so it never leaks.
describe('RunControlView output — fullscreen capability delegation (opener side)', () => {
  function fireMessage(data: unknown, origin: string, source: unknown) {
    // Build a plain Event with the MessageEvent fields our handler reads — avoids
    // jsdom's MessageEvent `source` type validation (a fake window is not a real
    // WindowProxy) while still exercising the real window 'message' listener.
    const evt = new Event('message') as MessageEvent
    Object.defineProperty(evt, 'data', { value: data })
    Object.defineProperty(evt, 'origin', { value: origin })
    Object.defineProperty(evt, 'source', { value: source })
    window.dispatchEvent(evt)
  }

  it('delegates fullscreen to an opened output that posts wp-output-ready (same-origin, known source)', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLive(wrapper)
    expect(openedWins).toHaveLength(2)

    // The audience output (openedWins[0]) signals ready → the control delegates
    // fullscreen back to that exact window with the { delegate:'fullscreen' } option.
    const audienceWin = openedWins[0]!
    fireMessage({ type: 'wp-output-ready' }, window.location.origin, audienceWin)

    expect(audienceWin.postMessage).toHaveBeenCalledWith(
      { type: 'wp-fullscreen-delegate' },
      expect.objectContaining({ delegate: 'fullscreen', targetOrigin: window.location.origin }),
    )
  })

  it('per-display "Go fullscreen" button delegates fullscreen to THAT display (owner UAT)', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLive(wrapper)
    expect(openedWins).toHaveLength(2)

    // openedWins[0] is the audience window (opened first in openPlaced). Its per-display
    // "Go fullscreen" button (rendered once the display is open) delegates THIS click's
    // gesture to THAT window — the reliable, explicit path (no automatic race).
    const audienceWin = openedWins[0]!
    const btn = wrapper.find('[data-testid="run-display-fullscreen-audience"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')

    expect(audienceWin.postMessage).toHaveBeenCalledWith(
      { type: 'wp-fullscreen-delegate' },
      expect.objectContaining({ delegate: 'fullscreen', targetOrigin: window.location.origin }),
    )
  })

  it('per-display button reflects REAL fullscreen state — done ✓ when fullscreen, flips back on Escape (owner UAT)', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLive(wrapper)

    // Initially not fullscreen → the action button shows, no done badge.
    expect(wrapper.find('[data-testid="run-display-fullscreen-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-fullscreen-done-audience"]').exists()).toBe(false)

    // The audience output reports it IS fullscreen → button becomes the done ✓ badge.
    fireMessage({ type: 'wp-fullscreen-state', role: 'audience', fullscreen: true }, window.location.origin, openedWins[0])
    await flushPromises()
    expect(wrapper.find('[data-testid="run-display-fullscreen-done-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-fullscreen-audience"]').exists()).toBe(false)

    // Projectionist presses Escape on that display → reports false → flips back to the action.
    fireMessage({ type: 'wp-fullscreen-state', role: 'audience', fullscreen: false }, window.location.origin, openedWins[0])
    await flushPromises()
    expect(wrapper.find('[data-testid="run-display-fullscreen-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-fullscreen-done-audience"]').exists()).toBe(false)
  })

  it('ignores a wp-output-ready from a CROSS-ORIGIN message', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLive(wrapper)

    const audienceWin = openedWins[0]!
    fireMessage({ type: 'wp-output-ready' }, 'https://evil.example', audienceWin)
    expect(audienceWin.postMessage).not.toHaveBeenCalled()
  })

  it('ignores a wp-output-ready whose source is NOT one of our opened windows', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLive(wrapper)

    const stranger = { postMessage: vi.fn() }
    fireMessage({ type: 'wp-output-ready' }, window.location.origin, stranger)
    expect(stranger.postMessage).not.toHaveBeenCalled()
  })

  it('removes the delegation message listener on exit (no leak)', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLive(wrapper)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await flushPromises()

    // After teardown a wp-output-ready no longer delegates (listener removed).
    expect(removeSpy.mock.calls.some((c) => c[0] === 'message')).toBe(true)
    const audienceWin = openedWins[0]!
    audienceWin.postMessage.mockClear()
    fireMessage({ type: 'wp-output-ready' }, window.location.origin, audienceWin)
    expect(audienceWin.postMessage).not.toHaveBeenCalled()
  })
})

// ── 15. LEAVE-GUARD BLOCKS A TRULY-LIVE SERVICE (owner UAT) ──────────────────────
//    Only a REAL go-live (outputs on the congregation screens) blocks an in-app
//    leave + arms the beforeunload prompt; the rehearse path is proven UNGUARDED in
//    RunControlView.test.ts. This block drives a real placed go-live so the
//    live && !rehearsing guard is exercised end-to-end.
describe('RunControlView output — leave-guard blocks a truly-live service (owner UAT)', () => {
  it('after a real go-live, an in-app leave is CANCELLED + opens the confirm; confirm tears down and navigates to the pending destination', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper, fake } = mountView()
    await goLive(wrapper)
    // Genuinely live — both outputs open (rehearsing is false on a real go-live).
    expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(true)

    // The in-app leave is BLOCKED (guard false) and opens the confirm dialog.
    const result = capturedRouteLeaveGuard!({ fullPath: '/services' })
    await flushPromises()
    expect(result).toBe(false)
    expect(document.body.querySelector('[data-testid="run-exit-dialog"]')).not.toBeNull()
    expect(fake.close).not.toHaveBeenCalled()
    expect(mockRouterPush).not.toHaveBeenCalled()

    // Confirming tears the service down (channel close + windows closed) and
    // navigates to the ORIGINAL pending destination — not the editor default.
    const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await flushPromises()
    expect(fake.close).toHaveBeenCalledTimes(1)
    expect(mockRouterPush).toHaveBeenCalledWith('/services')
    for (const win of openedWins) {
      expect(win.close).toHaveBeenCalledTimes(1)
    }
  })

  it('a real go-live registers a beforeunload listener and exit removes it', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLive(wrapper)

    // A real live service arms the beforeunload "Leave site?" guard.
    expect(addSpy.mock.calls.filter((c) => c[0] === 'beforeunload').length).toBeGreaterThanOrEqual(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    const confirmBtn = document.body.querySelector<HTMLElement>('[data-testid="run-exit-confirm"]')
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await flushPromises()

    // Ending the service disarms it (live && !rehearsing → false).
    expect(removeSpy.mock.calls.filter((c) => c[0] === 'beforeunload').length).toBeGreaterThanOrEqual(1)
  })
})
