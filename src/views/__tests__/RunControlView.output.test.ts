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
import type { Service } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelLike, BroadcastChannelFactory } from '@/utils/runChannel'
import {
  computeFingerprint,
  saveMapping,
  type ScreenLike,
} from '@/utils/monitorConfig'
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
// plain anchor exposing `to` so the monitor-setup link is assertable.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
  document: { documentElement: { requestFullscreen: ReturnType<typeof vi.fn> } }
}
let openedWins: FakeWin[] = []
function makeFakeWin(): Window {
  const win: FakeWin = {
    moveTo: vi.fn(),
    close: vi.fn(),
    closed: false,
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

function seedNonMatchingMapping() {
  // Fingerprints for screens that are NOT among the live screens → needs-reprompt.
  const otherA = makeScreen({ label: 'Old Front', left: 100, top: 100 })
  const otherB = makeScreen({ label: 'Old Stage', left: 3000, top: 0, isPrimary: false })
  saveMapping({
    assignments: [
      { fingerprint: computeFingerprint(otherA), role: 'audience' },
      { fingerprint: computeFingerprint(otherB), role: 'confidence' },
    ],
    savedAt: Date.now(),
  })
}

const AUDIENCE_URL = '/present/audience/service-1?org=org-1'
const CONFIDENCE_URL = '/present/confidence/service-1?org=org-1'

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
  localStorage.clear()
  openedWins = []
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
    // Idle never claims a display opened.
    expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(false)
  })
})

// ── 1. MATCHED — open + place both windows on their assigned screens ────────────
describe('RunControlView output — matched placement (R261/R266)', () => {
  it('opens the audience + confidence windows with stable names, fullscreens each on its screen, and shows run-status-placed', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)

    // Both windows opened with the exact URLs (incl. ?org=) + stable names, and
    // WITH placement features (a non-empty third arg).
    expect(openSpy).toHaveBeenCalledWith(AUDIENCE_URL, 'wp-audience', expect.stringMatching(/width=/))
    expect(openSpy).toHaveBeenCalledWith(CONFIDENCE_URL, 'wp-confidence', expect.stringMatching(/width=/))

    // Each opened window was fullscreened with a { screen } option.
    expect(openedWins).toHaveLength(2)
    for (const win of openedWins) {
      expect(win.document.documentElement.requestFullscreen).toHaveBeenCalledWith(
        expect.objectContaining({ screen: expect.anything() }),
      )
    }

    // The honest success status renders; no fallback/blocked banner.
    expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(true)
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

    // Both windows opened, but with NO placement features (un-positioned).
    expect(openSpy).toHaveBeenCalledWith(AUDIENCE_URL, 'wp-audience', '')
    expect(openSpy).toHaveBeenCalledWith(CONFIDENCE_URL, 'wp-confidence', '')
    for (const win of openedWins) {
      expect(win.document.documentElement.requestFullscreen).not.toHaveBeenCalled()
    }

    const banner = wrapper.find('[data-testid="run-fallback-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.find('a[data-to="/monitor-setup"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(false)
  })

  it('no saved mapping at all: still opens both un-positioned + fallback banner', async () => {
    // localStorage cleared in beforeEach → loadMapping() returns null.
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)

    expect(openSpy).toHaveBeenCalledWith(AUDIENCE_URL, 'wp-audience', '')
    expect(openSpy).toHaveBeenCalledWith(CONFIDENCE_URL, 'wp-confidence', '')
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

    expect(openSpy).toHaveBeenCalledWith(AUDIENCE_URL, 'wp-audience', '')
    expect(openSpy).toHaveBeenCalledWith(CONFIDENCE_URL, 'wp-confidence', '')
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

    expect(openSpy).toHaveBeenCalledWith(AUDIENCE_URL, 'wp-audience', '')
    expect(openSpy).toHaveBeenCalledWith(CONFIDENCE_URL, 'wp-confidence', '')
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
    expect(openSpy).toHaveBeenCalledWith(AUDIENCE_URL, 'wp-audience', expect.any(String))
    expect(openSpy).toHaveBeenCalledWith(CONFIDENCE_URL, 'wp-confidence', expect.any(String))
    expect(openedWins).toHaveLength(0)

    // The HONEST blocked state — never a success/opened claim while zero opened.
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
  })
})

// ── 5b. PARTIAL — exactly ONE window.open null must NOT claim success (WR-02) ────
describe('RunControlView output — partial open is not full success (WR-02)', () => {
  it('matched but the CONFIDENCE window.open returns null: NOT run-status-placed — honest partial banner naming the dark confidence display', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    // First open (audience) succeeds; second (confidence) is refused → null.
    openSpy
      .mockImplementationOnce(() => makeFakeWin())
      .mockImplementationOnce(() => null)
    const { wrapper } = mountView()

    await goLive(wrapper)

    // No green "Displays ready" and no both-opened fallback claim.
    expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(false)

    // The honest partial banner renders and names the display that stayed dark.
    const banner = wrapper.find('[data-testid="run-partial-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text().toLowerCase()).toContain('confidence')
    // Retry affordance is present.
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

    // The amber fallback banner claims BOTH windows opened — it must NOT show.
    expect(wrapper.find('[data-testid="run-fallback-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(false)

    const banner = wrapper.find('[data-testid="run-partial-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text().toLowerCase()).toContain('audience')
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

  it('a closed AUDIENCE handle surfaces run-output-closed-audience + run-reopen-audience for that role ONLY, cluster stays placed', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLiveFake(wrapper)
    expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(true)
    expect(openedWins).toHaveLength(2)

    // Audience opens first in openPlaced, so openedWins[0] is the audience handle.
    openedWins[0]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)

    // Only the audience line turns amber; confidence stays green; the cluster
    // remains 'placed' (the closed flags do NOT change outputStatus).
    expect(wrapper.find('[data-testid="run-output-closed-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-reopen-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-output-closed-confidence"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-reopen-confidence"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(true)
  })

  it('a closed CONFIDENCE handle surfaces run-output-closed-confidence + run-reopen-confidence for that role ONLY', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLiveFake(wrapper)

    // openedWins[1] is the confidence handle (opened second in openPlaced).
    openedWins[1]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)

    expect(wrapper.find('[data-testid="run-output-closed-confidence"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-reopen-confidence"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-output-closed-audience"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-reopen-audience"]').exists()).toBe(false)
  })

  it('clicking run-reopen-audience re-opens the AUDIENCE window only (not confidence) and clears the amber row on a non-null handle', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLiveFake(wrapper)
    openedWins[0]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.find('[data-testid="run-output-closed-audience"]').exists()).toBe(true)

    const callsBefore = openSpy.mock.calls.length
    await wrapper.find('[data-testid="run-reopen-audience"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    // Exactly ONE more window.open — the audience name, placed (matched → features).
    expect(openSpy.mock.calls.length).toBe(callsBefore + 1)
    expect(openSpy).toHaveBeenLastCalledWith(AUDIENCE_URL, 'wp-audience', expect.stringMatching(/width=/))
    // The reopen never touched the confidence window in this click.
    const reopenCall = openSpy.mock.calls[openSpy.mock.calls.length - 1]!
    expect(reopenCall[0]).not.toBe(CONFIDENCE_URL)
    // A non-null handle cleared the amber row back to green.
    expect(wrapper.find('[data-testid="run-output-closed-audience"]').exists()).toBe(false)
  })

  it('a REFUSED reopen (window.open returns null) keeps the amber closed row — never a false "recovered" claim (T-96-12)', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLiveFake(wrapper)
    openedWins[0]!.closed = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.find('[data-testid="run-output-closed-audience"]').exists()).toBe(true)

    // The pop-up blocker refuses the reopen → null handle → the row must remain.
    openSpy.mockReturnValueOnce(null as unknown as Window)
    await wrapper.find('[data-testid="run-reopen-audience"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="run-output-closed-audience"]').exists()).toBe(true)
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
    await wrapper.find('[data-testid="run-reopen-audience"]').trigger('click')
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

// ── 8. MONITOR-UNPLUG → REASSIGN (R274) ─────────────────────────────────────────
//    The screenschange tests invoke the CAPTURED listener directly (no timers),
//    avoiding the flushPromises/fake-timer interaction entirely.
describe('RunControlView output — monitor-unplug reassign banner (R274; T-96-14)', () => {
  it('a screenschange that drops an assigned monitor (needs-reprompt) surfaces run-reassign-banner with the monitor-setup link', async () => {
    seedMatchingMapping()
    const { control } = installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)
    expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-reassign-banner"]').exists()).toBe(false)

    // The confidence monitor (screenB) is unplugged → the live set drops it →
    // matchMapping returns needs-reprompt.
    control.setScreens([screenA])
    control.fireScreensChange()
    await flushPromises()

    const banner = wrapper.find('[data-testid="run-reassign-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Your monitor setup changed')
    expect(banner.find('a[data-to="/monitor-setup"]').exists()).toBe(true)
  })

  it('a still-matching screenschange (benign refresh) raises NO run-reassign-banner (no false alarm)', async () => {
    seedMatchingMapping()
    const { control } = installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()

    await goLive(wrapper)

    // The live set is unchanged (both monitors still present) → matched → silent.
    control.fireScreensChange()
    await flushPromises()

    expect(wrapper.find('[data-testid="run-reassign-banner"]').exists()).toBe(false)
  })
})

// ── 9. PRECEDENCE — reassign banner suppresses the reopen chip (R274; 96-UI-SPEC §B)
describe('RunControlView output — closed-vs-unplug precedence (R274)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('with BOTH a closed audience window AND a monitor change, run-reassign-banner shows and run-reopen-audience is SUPPRESSED', async () => {
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

    expect(wrapper.find('[data-testid="run-reassign-banner"]').exists()).toBe(true)
    // The reopen chip is gated on !monitorChanged → suppressed until reassignment.
    expect(wrapper.find('[data-testid="run-reopen-audience"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-output-closed-audience"]').exists()).toBe(false)
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
      expect(wrapper.find('[data-testid="run-status-placed"]').exists()).toBe(true)

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

      expect(wrapper.find('[data-testid="run-output-closed-audience"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="run-reopen-audience"]').exists()).toBe(false)
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
