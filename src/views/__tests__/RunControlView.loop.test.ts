/**
 * Phase 106 Plan 02 (R306/R308). Behavioral coverage for the RUN-TIME per-item
 * loop timer: auto-advance/wrap-to-first-slide (R306), manual-nav reset,
 * item-change/unmount teardown, and "Go to black PAUSES the loop" verified in
 * an OUTPUT-WINDOW context (R308 #4) — the same standard this codebase uses
 * everywhere else (fake channel + fake output windows + `fake.posted` state
 * assertions, never just the control screen).
 *
 * Harness lineage: RunControlView.output.test.ts (in-memory fake
 * BroadcastChannel factory with posted/deliver, fake window/getScreenDetails
 * plumbing, installGetScreenDetails + seedMatchingMapping, goLiveFake,
 * Element.prototype.scrollIntoView stub, enableAutoUnmount, an active Pinia
 * instance for the notifications store useRunControl now reads). This suite
 * supplies its OWN useServiceAssembly fixture: a looping 3-slide SONG at
 * slotIndex 0 (loop.enabled, intervalSeconds:10) plus a non-looping SONG at
 * slotIndex 1 (for the item-change case), and a separate 1-slide looping
 * fixture for the single-slide no-op case.
 *
 * 106-REVIEW WR-01 addition: the useServiceAssembly mock now stashes the LIVE
 * assembledSlideshow ref on H (H.assembledSlideshowRef) so a test can mutate
 * it AFTER mount — this powers the WR-01 case (a looping item's slide count
 * growing past 1 via a mid-run async render, with no navigation, must still
 * arm the timer).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Ref } from 'vue'
import type { Service } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelLike, BroadcastChannelFactory } from '@/utils/runChannel'
import { computeFingerprint, saveMapping, type ScreenLike } from '@/utils/monitorConfig'
import RunControlView from '../RunControlView.vue'

enableAutoUnmount(afterEach)

// ── Fixtures (hoisted, MUTABLE via H.state so a test can swap fixtures before
//    mounting) ────────────────────────────────────────────────────────────────
const H = vi.hoisted(() => {
  function songSlot(
    id: string,
    position: number,
    title: string,
    loop?: { enabled: boolean; intervalSeconds: number },
  ): unknown {
    return {
      id,
      kind: 'SONG',
      position,
      requiredVwType: 1,
      songId: `song-${position}`,
      songTitle: title,
      songKey: 'C',
      section: 'worship',
      ...(loop ? { loop } : {}),
    }
  }
  function fakeSlide(id: string, slotIndex: number, label: string): unknown {
    return {
      slide: {
        id,
        position: 0,
        contentKind: 'lyric',
        sectionId: `sec-${id}`,
        sectionLabel: label,
        lines: [`line ${id}`],
      },
      slotIndex,
      slotKind: 'SONG',
      section: 'worship',
      sourceId: `song-${slotIndex}`,
    }
  }
  // Slot 0: 3-slide looping item (global indices 0,1,2). Slot 1: 1-slide
  // NON-looping item (global index 3) — the item-change target.
  function threeSlideLoopingService(): unknown {
    return {
      id: 'service-1',
      date: '2026-09-01',
      name: 'Sunday Gathering',
      progression: '1-2-2-3',
      teams: [],
      status: 'planned',
      slots: [
        songSlot('slot-0', 0, 'Looping Song', { enabled: true, intervalSeconds: 10 }),
        songSlot('slot-1', 1, 'Second Song'),
      ],
      sermonPassage: null,
      notes: '',
    }
  }
  function threeSlideLoopingSlides(): unknown[] {
    return [
      fakeSlide('a', 0, 'Verse 1'),
      fakeSlide('b', 0, 'Verse 2'),
      fakeSlide('c', 0, 'Chorus'),
      fakeSlide('d', 1, 'Verse 1'),
    ]
  }
  // A single-slide looping item — R306's harmless-no-op case.
  function singleSlideLoopingService(): unknown {
    return {
      id: 'service-1',
      date: '2026-09-01',
      name: 'Sunday Gathering',
      progression: '1-2-2-3',
      teams: [],
      status: 'planned',
      slots: [songSlot('slot-0', 0, 'One Slide Loop', { enabled: true, intervalSeconds: 10 })],
      sermonPassage: null,
      notes: '',
    }
  }
  function singleSlideLoopingSlides(): unknown[] {
    return [fakeSlide('a', 0, 'Verse 1')]
  }
  return {
    threeSlideLoopingService,
    threeSlideLoopingSlides,
    singleSlideLoopingService,
    singleSlideLoopingSlides,
    // 106-REVIEW WR-01: exposed so a test can append a slide for the SAME
    // slotIndex after mount, simulating a late-resolving async render.
    fakeSlide,
    state: {
      service: threeSlideLoopingService(),
      slides: threeSlideLoopingSlides(),
    },
    // 106-REVIEW WR-01: set by the useServiceAssembly mock factory below (at
    // actual mount time) so a test can mutate .value AFTER mount to simulate
    // an async render (e.g. PPTX deck) growing the CURRENT item's assembled
    // slide count with no accompanying navigation.
    assembledSlideshowRef: null as Ref<AssembledSlide[]> | null,
  }
})

/** Reset the mock fixture to the default 3-slide-looping + non-looping-item shape. */
function useDefaultFixture() {
  H.state.service = H.threeSlideLoopingService()
  H.state.slides = H.threeSlideLoopingSlides()
}
/** Swap in the 1-slide looping fixture (the no-op case). */
function useSingleSlideFixture() {
  H.state.service = H.singleSlideLoopingService()
  H.state.slides = H.singleSlideLoopingSlides()
}

// ── Mocks (vue-router lineage, output.test.ts) ──────────────────────────────
const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  onBeforeRouteLeave: () => {},
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="to"><slot /></a>',
  },
}))

vi.mock('@/composables/useServiceAssembly', async () => {
  const { ref } = await import('vue')
  return {
    useServiceAssembly: () => {
      // 106-REVIEW WR-01: stash the LIVE ref on H so a test can mutate
      // .value after mount (simulating a late-resolving async render) without
      // needing a fresh mount — mirrors how the real assembledSlideshow
      // computed changes underneath an already-mounted Run screen.
      const assembledSlideshow = ref(H.state.slides as unknown as AssembledSlide[])
      H.assembledSlideshowRef = assembledSlideshow
      return {
        serviceId: ref('service-1'),
        orgIdRef: ref('org-1'),
        localService: ref(H.state.service as unknown as Service),
        assembledSlideshow,
      }
    },
  }
})

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

// ── In-memory run-channel fake (output.test.ts lineage) ─────────────────────
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
  const deliver = (data: unknown) => messageCb?.({ data })
  return { factory, posted, close, deliver }
}

// ── Fake screens + window plumbing (output.test.ts lineage, trimmed) ────────
function makeScreen(overrides: Partial<ScreenLike> = {}): ScreenLike {
  return { label: 'Screen', width: 1920, height: 1080, left: 0, top: 0, isPrimary: true, ...overrides }
}
const screenA = makeScreen({ label: 'Front Wall', left: 0, top: 0, isPrimary: true })
const screenB = makeScreen({ label: 'Stage Monitor', left: 1920, top: 0, isPrimary: false })

type FakeWin = {
  moveTo: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  closed: boolean
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

function installGetScreenDetails(initialScreens: ScreenLike[]) {
  const details = {
    screens: initialScreens,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const fn = vi.fn(() => Promise.resolve(details))
  ;(window as unknown as { getScreenDetails: unknown }).getScreenDetails = fn
  return { fn, details }
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

let openSpy: ReturnType<typeof vi.spyOn>

function mountView() {
  const fake = createFakeChannel()
  const wrapper = mount(RunControlView, {
    props: { channelFactory: fake.factory },
    global: {
      stubs: {
        RouterLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' },
      },
    },
  })
  return { wrapper, fake }
}

/** Enter live via REHEARSE (no output windows) — sufficient for every case that
 * does not need the output-window channel proof (that one uses goLiveFake). */
async function rehearseFake(wrapper: ReturnType<typeof mountView>['wrapper']) {
  await vi.advanceTimersByTimeAsync(0)
  await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
}

/** Matched go-live under fake timers (output.test.ts lineage) — both output
 * windows open, so blackout genuinely posts to the output-window channel. */
async function goLiveFake(wrapper: ReturnType<typeof mountView>['wrapper']) {
  await vi.advanceTimersByTimeAsync(0)
  await wrapper.find('[data-testid="run-go-live-btn"]').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
}

function states(fake: ReturnType<typeof createFakeChannel>) {
  return fake.posted.filter((m) => m.type === 'state')
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  openedWins = []
  mockRouterPush.mockClear()
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => makeFakeWin())
  Element.prototype.scrollIntoView = vi.fn()
  useDefaultFixture()
  vi.useFakeTimers()
})

afterEach(() => {
  delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('RunControlView — per-item loop (R306/R308)', () => {
  it('auto-advances 0→1→2 then wraps to the item FIRST slide, never leaving slotIndex 0 (R306)', async () => {
    const { wrapper, fake } = mountView()
    await rehearseFake(wrapper)

    expect(states(fake).map((m) => m.index)).toEqual([0])

    await vi.advanceTimersByTimeAsync(10000)
    expect(states(fake).map((m) => m.index)).toEqual([0, 1])

    await vi.advanceTimersByTimeAsync(10000)
    expect(states(fake).map((m) => m.index)).toEqual([0, 1, 2])

    // From the LAST slide (global index 2), the next tick wraps to the item's
    // FIRST global index (0) — never into slot 1's global index 3.
    await vi.advanceTimersByTimeAsync(10000)
    expect(states(fake).map((m) => m.index)).toEqual([0, 1, 2, 0])
    expect(states(fake).some((m) => m.index === 3)).toBe(false)
  })

  it('a single-slide looping item never auto-advances (the timer never arms) across 30s', async () => {
    useSingleSlideFixture()
    const { wrapper, fake } = mountView()
    await rehearseFake(wrapper)

    expect(states(fake).map((m) => m.index)).toEqual([0])

    await vi.advanceTimersByTimeAsync(30000)

    expect(states(fake).map((m) => m.index)).toEqual([0])
  })

  it('a manual nav mid-interval restarts the clock — the next auto-advance is a full interval later, never a stale leftover tick (R308)', async () => {
    const { wrapper, fake } = mountView()
    await rehearseFake(wrapper)

    // Half the interval elapses with no manual nav.
    await vi.advanceTimersByTimeAsync(5000)
    expect(states(fake).map((m) => m.index)).toEqual([0])

    // Manual ArrowRight takes effect immediately (0 -> 1) and restarts the clock.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(states(fake).map((m) => m.index)).toEqual([0, 1])

    // The OLD clock's remaining ~5s must NOT fire — the new interval only
    // started at the manual nav, so 5s more (10s total elapsed, but only 5s
    // since the manual nav) is not yet a full interval from the reset point.
    await vi.advanceTimersByTimeAsync(5000)
    expect(states(fake).map((m) => m.index)).toEqual([0, 1])

    // A FULL interval after the manual nav, the auto-advance fires.
    await vi.advanceTimersByTimeAsync(5000)
    expect(states(fake).map((m) => m.index)).toEqual([0, 1, 2])
  })

  it('navigating to a non-looping item disarms the timer — advancing 30s produces no further auto-advance posts (R308)', async () => {
    const { wrapper, fake } = mountView()
    await rehearseFake(wrapper)

    // ArrowDown moves to the next item (slot 1, non-looping, global index 3).
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(states(fake).map((m) => m.index)).toEqual([0, 3])

    await vi.advanceTimersByTimeAsync(30000)

    expect(states(fake).map((m) => m.index)).toEqual([0, 3])
  })

  it('unmounting the view while looping clears the timer — advancing 60s afterward posts nothing further and raises no error (R308)', async () => {
    const { wrapper, fake } = mountView()
    await rehearseFake(wrapper)

    const postedBefore = states(fake).length

    let error: unknown = null
    wrapper.unmount()
    try {
      await vi.advanceTimersByTimeAsync(60000)
    } catch (e) {
      error = e
    }

    expect(error).toBeNull()
    expect(states(fake).length).toBe(postedBefore)
  })

  it('"Go to black" PAUSES the loop and clearing it RESUMES — verified against fake.posted on a matched go-live with BOTH output windows open (R308 #4)', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper, fake } = mountView()

    await goLiveFake(wrapper)
    // Matched go-live places both outputs — the honest live surface renders.
    expect(wrapper.find('[data-testid="run-display-ready-audience"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-display-ready-confidence"]').exists()).toBe(true)
    expect(openedWins).toHaveLength(2)
    expect(states(fake).map((m) => m.index)).toEqual([0])

    // Blackout ON (the header toggle, output.test.ts §13's exact affordance) —
    // this must PAUSE the loop: no further content-advancing state for 30s.
    const toggle = wrapper.find('[data-testid="run-blackout-toggle"]')
    expect(toggle.exists()).toBe(true)
    await toggle.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    const afterBlack = states(fake)
    expect(afterBlack[afterBlack.length - 1]!.blackout).toBe(true)
    const indexAtBlack = afterBlack[afterBlack.length - 1]!.index

    await vi.advanceTimersByTimeAsync(30000)

    // The ONLY new posted state while black is the blackout toggle itself —
    // no auto-advance content change occurred behind the blackout.
    const stillBlack = states(fake)
    expect(stillBlack.every((m) => m.index === indexAtBlack)).toBe(true)

    // Clearing blackout RESUMES the loop.
    await wrapper.find('[data-testid="run-blackout-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    const afterClear = states(fake)
    expect(afterClear[afterClear.length - 1]!.blackout).toBe(false)
    expect(afterClear[afterClear.length - 1]!.index).toBe(indexAtBlack)

    // Exactly one auto-advance fires a full interval after resuming.
    await vi.advanceTimersByTimeAsync(10000)
    const afterResume = states(fake)
    expect(afterResume[afterResume.length - 1]!.index).toBe((indexAtBlack as number) + 1)
    expect(afterResume[afterResume.length - 1]!.blackout).toBe(false)
  })

  it('a looping item that starts at <=1 slide arms once its slide count grows past 1 with NO navigation — a mid-run async render (e.g. a PPTX deck) resolving late (106-REVIEW WR-01)', async () => {
    useSingleSlideFixture()
    const { wrapper, fake } = mountView()
    await rehearseFake(wrapper)

    expect(states(fake).map((m) => m.index)).toEqual([0])

    // No navigation, no slide-count change yet: still correctly a no-op
    // (matches the existing single-slide-no-op coverage).
    await vi.advanceTimersByTimeAsync(30000)
    expect(states(fake).map((m) => m.index)).toEqual([0])

    // Simulate the item's async render finishing mid-Run: two more slides
    // resolve for the SAME item (slotIndex 0), growing it from 1 slide to 3
    // with NO accompanying navigation — reconcileLoop must re-evaluate off
    // the slide-count watch alone.
    const grown = [
      ...H.assembledSlideshowRef!.value,
      H.fakeSlide('b', 0, 'Verse 2'),
      H.fakeSlide('c', 0, 'Chorus'),
    ]
    H.assembledSlideshowRef!.value = grown as unknown as AssembledSlide[]
    await vi.advanceTimersByTimeAsync(0)

    // The timer is now armed with no navigation in between — a full interval
    // later it auto-advances.
    await vi.advanceTimersByTimeAsync(10000)
    expect(states(fake).map((m) => m.index)).toEqual([0, 1])
  })
})
