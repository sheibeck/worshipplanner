/**
 * Phase 95 Plan 05 (R262-R266). Behavioral coverage for RunControlView.vue —
 * the standalone operator control surface and the SINGLE WRITER of the
 * wp-run-{serviceId} channel.
 *
 * This suite proves the operator-facing control contract against the REAL view,
 * driving the REAL openRunChannel through an injected in-memory
 * BroadcastChannelLike (so seq monotonicity + onHello resend are asserted against
 * production stale-drop logic, never a bypass):
 *
 *  - SINGLE-WRITER + seq (R266): the view posts a `state` on mount (slide 0),
 *    posts on EVERY navigation with a STRICTLY INCREASING seq, resends the
 *    CURRENT index with a higher seq on an inbound `hello`, honors the late-
 *    arriving assembly (watch(assembledSlideshow)) with a single go-live post,
 *    and never double-posts slide 0;
 *  - RAIL (R262/R263): the active "you are here" row is the one whose slot index
 *    === current.slotIndex; clicking a has-slides row posts the index from
 *    firstAssembledIndexBySlot; an empty-slot row is inert; and a zero-slide
 *    service renders the "Nothing to present yet" empty state;
 *  - KEYBOARD (R265): Right/Space advance +1, Left goes -1 (clamped), Down/Up
 *    move to the next/previous order item's first slide (skipping an empty slot),
 *    and Escape OPENS the exit-confirm dialog WITHOUT tearing down — nav keys are
 *    inert while it is open, and the red confirm closes the channel and navigates;
 *  - PREVIEW (R264/R266): current shows the slide at the index, next shows
 *    index+1, the last slide's next pane shows "End of service", and there is no
 *    separate push-to-live control (single-selection).
 *
 * Harness lineage: AudienceOutputView.test.ts (reactive vue-router mock, inert
 * @/firebase, mocked stores + useSlideshowAssembly, stubbed SlideCanvas,
 * createFakeChannel, enableAutoUnmount so onUnmounted channel-close fires).
 * RunControlView is the WRITER, so this suite asserts what it POSTS (the inverse
 * of the audience test's never-posts assertion) and pushes hello INTO it. The
 * on-mount path never opens a real window (openOutputs runs only from Go live);
 * window.open is stubbed to null and getScreenDetails deleted defensively so no
 * placement orchestration can throw during the control assertions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelFactory } from '@/utils/runChannel'
import { firstAssembledIndexBySlot } from '@/utils/serviceSlots'
import RunControlView from '../RunControlView.vue'

// onUnmounted must run so the channel close this suite asserts (confirmExit +
// unmount teardown) actually fires.
enableAutoUnmount(afterEach)

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Captured router.push spy so the exit-confirm navigation is assertable; reactive
// route seeds params.serviceId + query.org (the ?org= self-scoping convention
// useServiceAssembly reads).
const mockRouterPush = vi.fn()
const mockRoute = reactive({ params: { serviceId: 'service-1' }, query: { org: 'org-1' } })
// Owner fix #6: the composable registers onBeforeRouteLeave. Capture the guard so a
// test can drive an in-app leave attempt directly (the guard cancels + opens the
// confirm while live). A plain module-level holder the mock factory closes over.
let capturedRouteLeaveGuard: ((to: unknown) => boolean | void) | undefined
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: mockRouterPush }),
  onBeforeRouteLeave: (guard: (to: unknown) => boolean | void) => {
    capturedRouteLeaveGuard = guard
  },
}))

// Firestore-free stores + a mutable slide fixture. `slides` is what the NEXT
// mount's useSlideshowAssembly ref is seeded from; `assembledRef` is the captured
// ref so a test can push a late-arriving assembly through the real
// watch(assembledSlideshow). Hoisted so the vi.mock factories can reference it.
const H = vi.hoisted(() => {
  function fakeSlide(id: string, slotIndex: number): unknown {
    return {
      slide: {
        id,
        position: 0,
        contentKind: 'lyric',
        sectionId: 'verse-1',
        sectionLabel: 'Verse 1',
        lines: [`line for ${id}`],
      },
      slotIndex,
      slotKind: 'SONG',
      section: 'worship',
      sourceId: 'song-1',
    }
  }
  // Default assembly: slotIndex 0, 0, 2 — so slot index 0 has assembled slides,
  // slot 1 is EMPTY (absent from firstAssembledIndexBySlot), slot 2 has a slide.
  function defaultSlides(): unknown[] {
    return [fakeSlide('a', 0), fakeSlide('b', 0), fakeSlide('c', 2)]
  }
  // One service whose slots span original array indices 0/1/2 (slot 1 has no
  // assembled slide), so sortedSlotsWithIndex + firstAssembledIndexBySlot
  // exercise the has-slides / active / empty rail states.
  function defaultService(): unknown {
    function songSlot(id: string, position: number, songTitle: string): unknown {
      return {
        id,
        kind: 'SONG',
        position,
        requiredVwType: 'MAIN',
        songId: `song-${position}`,
        songTitle,
        songKey: 'C',
        section: 'worship',
      }
    }
    return {
      id: 'service-1',
      date: '2026-08-30',
      name: 'Sunday Gathering',
      progression: '1-2-2-3',
      teams: [],
      status: 'planned',
      slots: [
        songSlot('slot-0', 0, 'Amazing Grace'),
        songSlot('slot-1', 1, 'Silent Empty'),
        songSlot('slot-2', 2, 'How Great Thou Art'),
      ],
      sermonPassage: null,
      notes: '',
    }
  }
  return {
    fakeSlide,
    defaultSlides,
    defaultService,
    slides: defaultSlides(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assembledRef: null as any,
    serviceStoreMock: {
      services: [] as unknown[],
      orgId: null as string | null,
      subscribe: vi.fn(),
      unsubscribeAll: vi.fn(),
    },
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
  useServiceStore: () => H.serviceStoreMock,
}))

// useServiceAssembly is REAL — it reads these mocks and the mocked
// useSlideshowAssembly. Return a captured ref seeded from H.slides so a test can
// drive a late-arriving assembly through the view's real watch(assembledSlideshow).
vi.mock('@/composables/useSlideshowAssembly', async () => {
  const { ref } = await import('vue')
  return {
    useSlideshowAssembly: () => {
      const assembledSlideshow = ref(H.slides as AssembledSlide[])
      H.assembledRef = assembledSlideshow
      return { assembledSlideshow }
    },
  }
})

// Lightweight SlideCanvas stub rendering the slide id, so the preview panes'
// text reveals WHICH slide each shows.
vi.mock('@/components/slides/SlideCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'SlideCanvasStub',
      props: {
        slide: { type: Object, required: false, default: undefined },
        interactive: { type: Boolean, default: false },
      },
      setup(props) {
        return () =>
          h(
            'div',
            { 'data-testid': 'slide-canvas' },
            (props.slide as { slide?: { id?: string } } | undefined)?.slide?.id ?? '',
          )
      },
    }),
  }
})

// ── In-memory run-channel fake ─────────────────────────────────────────────────
// A BroadcastChannelLike whose postMessage records every message and whose
// addEventListener stores the message listener, so the test can (a) read what the
// view POSTED (the seq-monotonicity source of truth) and (b) push a `hello` INTO
// the view. The view opens the REAL openRunChannel with this fake, so emitHello()
// reaches the view's onHello through runChannel's true dispatch.
interface PostedMessage {
  type?: string
  index?: number
  blackout?: boolean
  seq?: number
}

function createFakeChannel() {
  const posted: PostedMessage[] = []
  let listener: ((event: { data: unknown }) => void) | undefined
  const close = vi.fn()
  const channel = {
    postMessage(message: unknown) {
      posted.push(message as PostedMessage)
    },
    addEventListener(_type: 'message', callback: (event: { data: unknown }) => void) {
      listener = callback
    },
    close,
  }
  const factory: BroadcastChannelFactory = () => channel
  return {
    factory,
    posted,
    close,
    states(): PostedMessage[] {
      return posted.filter((m) => m.type === 'state')
    },
    emitHello() {
      listener?.({ data: { type: 'hello' } })
    },
  }
}

function keydown(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

function mountView(channelFactory: BroadcastChannelFactory) {
  return mount(RunControlView, {
    props: { channelFactory },
    // The fallback banner references <router-link> (never rendered in these
    // control-behavior tests); a passthrough stub avoids the resolve warning.
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  // The on-mount path never opens a window (openOutputs runs only from Go live),
  // but stub window.open → null and DELETE getScreenDetails so no placement
  // orchestration can open a real window or throw during control assertions.
  vi.spyOn(window, 'open').mockReturnValue(null)
  delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
  // jsdom does not implement scrollIntoView; the active-row auto-scroll watcher
  // calls it after every navigation.
  Element.prototype.scrollIntoView = vi.fn()

  // Fresh fixtures per test.
  H.slides = H.defaultSlides()
  H.assembledRef = null
  H.serviceStoreMock.services = [H.defaultService()]
  H.serviceStoreMock.orgId = null
  H.serviceStoreMock.subscribe.mockClear()
  H.serviceStoreMock.unsubscribeAll.mockClear()
  mockRouterPush.mockClear()
  mockRoute.params.serviceId = 'service-1'
  mockRoute.query.org = 'org-1'
  capturedRouteLeaveGuard = undefined
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RunControlView — single-writer channel + monotonic seq (R266)', () => {
  it('posts state slide 0 on mount and a STRICTLY INCREASING seq on every navigation', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Initial go-live: exactly one state for slide 0.
    const initial = fake.states()
    expect(initial).toHaveLength(1)
    expect(initial[0]!.index).toBe(0)
    expect(initial[0]!.blackout).toBe(false)

    // Transport keys are inert pre-live (State A); rehearse enters live WITHOUT
    // opening a window and WITHOUT re-posting slide 0 (index is already 0), so the
    // initial post count is unchanged before navigation begins.
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()
    expect(fake.states()).toHaveLength(1)

    // Several navigations, each posts a fresh state.
    keydown('ArrowRight') // -> index 1
    await flushPromises()
    keydown('ArrowRight') // -> index 2
    await flushPromises()
    keydown('ArrowLeft') // -> index 1
    await flushPromises()

    const seqs = fake.states().map((m) => m.seq!)
    expect(seqs.length).toBeGreaterThanOrEqual(4)
    // STRICTLY increasing across mount + every navigation — a regression that
    // reset or failed to advance seq (letting a reopened output be driven
    // backward) fails here.
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]!).toBeGreaterThan(seqs[i - 1]!)
    }

    // The posted indices reflect the navigation: 0 (mount), 1, 2, 1.
    expect(fake.states().map((m) => m.index)).toEqual([0, 1, 2, 1])
  })

  it('resends the CURRENT index with a higher seq on an inbound hello (onHello resync)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Enter live (rehearse) so the transport keys act — inert in pre-flight State A.
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    keydown('ArrowRight') // -> index 1
    await flushPromises()

    const beforeHello = fake.states()
    const currentIndex = beforeHello[beforeHello.length - 1]!.index
    const highestSeq = beforeHello[beforeHello.length - 1]!.seq!
    expect(currentIndex).toBe(1)

    // A late-joining output announces itself: the control resends CURRENT index
    // with a higher seq so the output's stale-drop accepts the resync.
    fake.emitHello()
    await flushPromises()

    const afterHello = fake.states()
    expect(afterHello.length).toBe(beforeHello.length + 1)
    const resend = afterHello[afterHello.length - 1]!
    expect(resend.index).toBe(currentIndex)
    expect(resend.seq!).toBeGreaterThan(highestSeq)
  })

  it('goes live once on the late-arriving assembly and never double-posts slide 0', async () => {
    // Mount with NO slides yet: the on-mount go-live guard is skipped.
    H.slides = []
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    expect(fake.states()).toHaveLength(0)

    // Assembly arrives after mount -> watch(assembledSlideshow) posts slide 0.
    H.assembledRef.value = H.defaultSlides()
    await flushPromises()

    const afterArrival = fake.states()
    expect(afterArrival).toHaveLength(1)
    expect(afterArrival[0]!.index).toBe(0)

    // A further assembly change must NOT re-post slide 0 (index is no longer null).
    H.assembledRef.value = H.defaultSlides()
    await flushPromises()
    expect(fake.states()).toHaveLength(1)
    expect(fake.states().filter((m) => m.index === 0)).toHaveLength(1)
  })
})

describe('RunControlView — order-of-service rail (R262/R263)', () => {
  it('highlights the "you are here" row matching current.slotIndex, and moves it on navigation', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // On mount, slide 0 has slotIndex 0 -> the rail row for slot 0 is active.
    const active0 = wrapper
      .findAll('[data-testid="rail-item"]')
      .find((w) => w.attributes('data-active') === 'true')
    expect(active0?.text()).toContain('Amazing Grace')

    // Enter live (rehearse, no window) so the transport keys are active — they are
    // inert in pre-flight State A. The rail renders in both states, so the active
    // row is unchanged by the state flip.
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    // Navigate to the slide with slotIndex 2 (ArrowDown skips the empty slot 1).
    keydown('ArrowDown')
    await flushPromises()

    const active2 = wrapper
      .findAll('[data-testid="rail-item"]')
      .find((w) => w.attributes('data-active') === 'true')
    expect(active2?.text()).toContain('How Great Thou Art')
  })

  it('posts firstAssembledIndexBySlot on a has-slides row click, and nothing on an empty-slot row', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const expectedIndex = firstAssembledIndexBySlot(H.slides as AssembledSlide[]).get(2)
    expect(expectedIndex).toBe(2)

    const slot2 = wrapper
      .findAll('[data-testid="rail-item"]')
      .find((w) => w.text().includes('How Great Thou Art'))
    await slot2!.trigger('click')
    await flushPromises()

    const afterJump = fake.states()
    expect(afterJump[afterJump.length - 1]!.index).toBe(expectedIndex)

    // Clicking the empty-slot row (slot 1, no assembled slides) posts nothing.
    const before = fake.states().length
    const empty = wrapper.find('[data-testid="rail-item-empty"]')
    expect(empty.exists()).toBe(true)
    await empty.trigger('click')
    await flushPromises()
    expect(fake.states().length).toBe(before)
  })

  it('renders the "Nothing to present yet" empty state for a service with zero assembled slides', async () => {
    H.slides = []
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const emptyState = wrapper.find('[data-testid="run-rail-empty"]')
    expect(emptyState.exists()).toBe(true)
    expect(emptyState.text()).toContain('Nothing to present yet')
    expect(wrapper.find('[data-testid="rail-item"]').exists()).toBe(false)
  })
})

describe('RunControlView — keyboard navigation (R265)', () => {
  it('ArrowRight and Space each advance +1; ArrowLeft goes -1 (clamped at 0)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()
    // mount posted index 0. Enter live (rehearse) so the transport keys act — they
    // are inert in pre-flight State A.
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    keydown('ArrowRight')
    await flushPromises()
    expect(fake.states()[fake.states().length - 1]!.index).toBe(1)

    keydown(' ') // Space
    await flushPromises()
    expect(fake.states()[fake.states().length - 1]!.index).toBe(2)

    keydown('ArrowLeft')
    await flushPromises()
    expect(fake.states()[fake.states().length - 1]!.index).toBe(1)

    keydown('ArrowLeft')
    await flushPromises()
    keydown('ArrowLeft') // clamp at 0
    await flushPromises()
    expect(fake.states()[fake.states().length - 1]!.index).toBe(0)
  })

  it('ArrowDown/ArrowUp move to the next/previous order item, skipping the empty slot', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()
    // Start on slotIndex 0 (index 0). Enter live (rehearse) so the transport keys
    // act — they are inert in pre-flight State A.
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    // Down: next order item with slides is slot 2 (slot 1 is empty) -> index 2.
    keydown('ArrowDown')
    await flushPromises()
    expect(fake.states()[fake.states().length - 1]!.index).toBe(2)

    // Up: previous order item with slides is slot 0 -> index 0.
    keydown('ArrowUp')
    await flushPromises()
    expect(fake.states()[fake.states().length - 1]!.index).toBe(0)
  })
})

describe('RunControlView — Escape opens confirm, never teardown (R265)', () => {
  it('Escape OPENS the exit dialog WITHOUT closing the channel or unmounting; nav keys inert while open', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    const postsBeforeEscape = fake.states().length

    keydown('Escape')
    await flushPromises()

    // The confirm dialog (teleported to body) is shown.
    expect(document.body.querySelector('[data-testid="run-exit-dialog"]')).not.toBeNull()
    // No teardown: channel stays open, component stays mounted.
    expect(fake.close).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="run-service-name"]').exists()).toBe(true)

    // While the dialog is open, a nav key posts NOTHING (keys inert).
    keydown('ArrowRight')
    await flushPromises()
    expect(fake.states().length).toBe(postsBeforeEscape)
  })

  it('clicking the red confirm closes the channel and navigates back to the service editor', async () => {
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    keydown('Escape')
    await flushPromises()

    const confirmBtn = document.body.querySelector(
      '[data-testid="run-exit-confirm"]',
    ) as HTMLElement | null
    expect(confirmBtn).not.toBeNull()
    confirmBtn!.click()
    await flushPromises()

    expect(fake.close).toHaveBeenCalledTimes(1)
    expect(mockRouterPush).toHaveBeenCalledTimes(1)
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: 'service-editor',
      params: { id: 'service-1' },
    })
  })
})

describe('RunControlView — dual preview + single-selection (R264/R266)', () => {
  it('shows the current slide and the next slide, and "End of service" past the last slide', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // 97-09 redesign: the program/next-up previews live in State B (live), so the
    // control opens in the pre-flight State A first. Rehearse enters live WITHOUT
    // opening any output window (no window.open), rendering the preview split; the
    // channel/nav stay active from mount, so the assertions below are unchanged.
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    // index 0: current 'a', next 'b'.
    expect(wrapper.find('[data-testid="run-current-preview"]').text()).toBe('a')
    expect(wrapper.find('[data-testid="run-next-preview"]').text()).toBe('b')

    // index 1: current 'b', next 'c'.
    keydown('ArrowRight')
    await flushPromises()
    expect(wrapper.find('[data-testid="run-current-preview"]').text()).toBe('b')
    expect(wrapper.find('[data-testid="run-next-preview"]').text()).toBe('c')

    // Last slide (index 2): current 'c', next pane shows "End of service".
    keydown('ArrowRight')
    await flushPromises()
    expect(wrapper.find('[data-testid="run-current-preview"]').text()).toBe('c')
    expect(wrapper.find('[data-testid="run-next-preview"]').text()).toBe('End of service')
  })

  it('has no separate push-to-live control — navigation posts state immediately (single-selection)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // No preview->program staging control exists.
    expect(wrapper.find('[data-testid="run-push-live"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-take"]').exists()).toBe(false)

    // Enter live (rehearse) so the transport keys act — inert in pre-flight State A.
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    // A single navigation immediately posts a new state (no confirm step).
    const before = fake.states().length
    keydown('ArrowRight')
    await flushPromises()
    expect(fake.states().length).toBe(before + 1)
  })
})

// ── 97-10: rehearse-without-screens + YELLOW "Rehearsing" status (R283/R277 + owner #7)
describe('RunControlView — rehearse without screens + rehearsing-yellow (R283/R277)', () => {
  it('rehearse enters live WITHOUT opening any window, turns the status YELLOW "Rehearsing" (never green), relabels exit "End Rehearsal", and drives slide 0', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Pre-flight State A: the live status is NOT green (muted/amber "Not open"),
    // the pre-flight go-live button is shown, and the live previews are absent.
    const statusBefore = wrapper.find('[data-testid="run-live-status"]')
    expect(statusBefore.exists()).toBe(true)
    expect(statusBefore.classes()).not.toContain('run-status--live')
    expect(statusBefore.classes()).toContain('run-status--idle')
    expect(wrapper.find('[data-testid="run-go-live-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-current-preview"]').exists()).toBe(false)

    // Record window.open's call count BEFORE rehearse (stubbed to null on mount).
    const openCallsBefore = vi.mocked(window.open).mock.calls.length

    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    // R283: rehearse opened NO window — a regression routing it through openOutputs
    // (getScreenDetails/window.open) fails here.
    expect(vi.mocked(window.open).mock.calls.length).toBe(openCallsBefore)

    // Now live (State B): the program preview renders and the pre-flight go-live
    // button is gone.
    expect(wrapper.find('[data-testid="run-current-preview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-go-live-btn"]').exists()).toBe(false)

    // Owner fix #7: a rehearsal reads YELLOW "Rehearsing" — never the green "Live"
    // tile (green is reserved for a real go-live), and the exit says "End Rehearsal".
    const statusAfter = wrapper.find('[data-testid="run-live-status"]')
    expect(statusAfter.classes()).toContain('run-status--rehearsing')
    expect(statusAfter.classes()).not.toContain('run-status--live')
    expect(statusAfter.text()).toContain('Rehearsing')
    expect(wrapper.find('[data-testid="run-exit-btn"]').text()).toBe('End Rehearsal')

    // Slide 0 is driving the channel (posted on mount, still the current state) —
    // rehearse drives the control with no output window opened.
    const states = fake.states()
    expect(states.some((m) => m.index === 0)).toBe(true)
    expect(states[states.length - 1]!.index).toBe(0)
  })
})

// ── 97-10: blackout via the B key during a rehearsal (R280) ─────────────────────
// The blackout toggle now lives in the header and renders ONLY when truly live
// (live && !rehearsing) — a rehearsal opens no output windows, so there is nothing
// to black out and the toggle is deliberately absent. The `B` key, however, still
// toggles the blackout state during a rehearsal (handleKeydown runs whenever live).
// The header-toggle's post-on-click coverage runs on the REAL placed go-live in
// RunControlView.output.test.ts (which can drive a genuine two-window go-live).
describe('RunControlView — blackout via B key during rehearse; toggle hidden in rehearse (R280)', () => {
  it('B toggles blackout true/false with strictly increasing seq, and the header toggle is NOT shown while rehearsing', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Enter live via rehearse (no window). A rehearsal is NOT truly-live, so the
    // header blackout toggle must be ABSENT — there are no outputs to black out.
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="run-blackout-toggle"]').exists()).toBe(false)

    const seqBeforeBlackout = fake.states()[fake.states().length - 1]!.seq!

    // 'B' blacks out the projector — the last state posts blackout:true with a
    // STRICTLY higher seq (a missing seq bump would be swallowed by stale-drop).
    keydown('b')
    await flushPromises()
    let last = fake.states()[fake.states().length - 1]!
    expect(last.blackout).toBe(true)
    expect(last.seq!).toBeGreaterThan(seqBeforeBlackout)

    // 'B' again clears it.
    keydown('b')
    await flushPromises()
    last = fake.states()[fake.states().length - 1]!
    expect(last.blackout).toBe(false)

    // Every posted state kept the seq strictly increasing across the blackout posts.
    const seqs = fake.states().map((m) => m.seq!)
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]!).toBeGreaterThan(seqs[i - 1]!)
    }
  })
})

// ── 97-10: in-item filmstrip click-to-jump + scaled next-up (R282/R276) ─────────
describe('RunControlView — in-item filmstrip jump + scaled next-up (R282/R276)', () => {
  it("clicking a filmstrip thumb posts that slide's GLOBAL array index", async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Enter live so the in-item filmstrip renders. The default fixture's active
    // item (slot 0) has slides at GLOBAL indices 0 and 1.
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    const thumbs = wrapper.findAll('[data-testid="run-filmstrip-slide"]')
    expect(thumbs.length).toBeGreaterThanOrEqual(2)
    const thumb1 = thumbs.find((w) => w.attributes('data-index') === '1')
    expect(thumb1).toBeTruthy()

    await thumb1!.trigger('click')
    await flushPromises()

    // The posted index is the thumb's GLOBAL array index (1), not the local loop
    // index — the array-index contract from 97-05 proven at the view level.
    expect(fake.states()[fake.states().length - 1]!.index).toBe(1)
  })

  it('renders the next-up preview inside a transform:scale container (smaller next-up)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    // At index 0 there is a next slide ('b'); its canvas is wrapped in a
    // transform:scale container so the next-up renders smaller (owner fix #2).
    const nextPreview = wrapper.find('[data-testid="run-next-preview"]')
    expect(nextPreview.exists()).toBe(true)
    expect(nextPreview.html()).toContain('scale(')
  })
})

// ── 97 REVIEW WR-01: pre-live / rehearse display dots open NO window (R283) ──────
// The header Audience/Confidence dots must NOT be a reopen affordance outside a
// live session with a held go-live. Pre-flight the dot is a passive (disabled)
// indicator; during Rehearse (live, but no getScreenDetails was ever resolved) a
// stray emit is caught by reopenOutput's liveScreenDetails===null guard. Either
// way NO output window opens outside the go-live gesture (window.open is stubbed
// to null on mount, so any reopen would register as a call).
describe('RunControlView — pre-live display dots are passive (WR-01/R283)', () => {
  it('clicking a pre-flight Audience/Confidence header dot opens NO window and the dot is disabled', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // State A (pre-live): the dots render but are DISABLED passive indicators.
    const audienceDot = wrapper.find('[data-testid="run-display-dot-audience"]')
    const confidenceDot = wrapper.find('[data-testid="run-display-dot-confidence"]')
    expect(audienceDot.exists()).toBe(true)
    expect(confidenceDot.exists()).toBe(true)
    expect(audienceDot.attributes('disabled')).toBeDefined()
    expect(confidenceDot.attributes('disabled')).toBeDefined()

    const openCallsBefore = vi.mocked(window.open).mock.calls.length
    await audienceDot.trigger('click')
    await confidenceDot.trigger('click')
    await flushPromises()

    // No reopen fired: window.open was never called from a pre-live dot click, so
    // no un-positioned output window was opened outside the go-live gesture.
    expect(vi.mocked(window.open).mock.calls.length).toBe(openCallsBefore)
  })

  it('after rehearse (live, NO windows) clicking a header dot still opens NO window (reopenOutput no-ops)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    // Rehearse never resolved getScreenDetails, so liveScreenDetails is null and the
    // reopenOutput guard no-ops even though the dot is now actionable (live && !open).
    const openCallsBefore = vi.mocked(window.open).mock.calls.length
    await wrapper.find('[data-testid="run-display-dot-audience"]').trigger('click')
    await wrapper.find('[data-testid="run-display-dot-confidence"]').trigger('click')
    await flushPromises()
    expect(vi.mocked(window.open).mock.calls.length).toBe(openCallsBefore)
  })
})

// ── 97 REVIEW WR-02: pre-flight Enter triggers go-live; inert once live ─────────
describe('RunControlView — Enter goes live from pre-flight (WR-02)', () => {
  it('pressing Enter in State A triggers go-live (openOutputs runs)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // getScreenDetails is deleted + window.open stubbed to null in beforeEach, so
    // Enter → openOutputs → openUnplaced attempts both window.open calls (→ blocked).
    const openCallsBefore = vi.mocked(window.open).mock.calls.length
    keydown('Enter')
    await flushPromises()

    // Enter reached the SAME go-live action as run-go-live-btn: window.open was
    // attempted for the two outputs and the honest blocked banner rendered.
    expect(vi.mocked(window.open).mock.calls.length).toBeGreaterThan(openCallsBefore)
    expect(wrapper.find('[data-testid="run-blocked-banner"]').exists()).toBe(true)
  })

  it('Enter does nothing once live (no second go-live)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Enter live via rehearse (opens no window).
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    const openCallsBefore = vi.mocked(window.open).mock.calls.length
    keydown('Enter')
    await flushPromises()

    // No go-live path fires while live — window.open is never called by Enter.
    expect(vi.mocked(window.open).mock.calls.length).toBe(openCallsBefore)
  })
})

// ── 97 REVIEW IN-02: transport + blackout keys inert pre-live ────────────────────
describe('RunControlView — transport/blackout keys inert pre-live (IN-02)', () => {
  it('ArrowRight/ArrowDown/B do nothing in pre-flight State A (no post, no blackout)', async () => {
    const fake = createFakeChannel()
    mountView(fake.factory)
    await flushPromises()

    const before = fake.states().length // slide 0 posted on mount
    keydown('ArrowRight')
    keydown('ArrowDown')
    keydown('b')
    await flushPromises()

    // No new state posted — the transport and blackout keys are inert before go-live.
    expect(fake.states().length).toBe(before)
    // The mount state is still slide 0 with blackout false — B never toggled it, so
    // go-live can never start the projector black from a stray pre-flight keypress.
    const last = fake.states()[fake.states().length - 1]!
    expect(last.index).toBe(0)
    expect(last.blackout).toBe(false)
  })
})

// ── Owner fix #5: Manage opens monitor-setup in a NEW TAB without noopener ────────
// noopener severs the opener relationship, so the fresh tab loses the opener's
// sessionStorage (the picked active org) and the router guard bounces it to
// /select-church. A plain window.open lets it inherit sessionStorage.
// Owner UAT: the redundant header "Manage" link was removed; the single Manage
// surface now lives on RunDisplaysPanel (State B), so this drives that button after
// entering live via rehearse. Same single-writer openManage handler, same contract.
describe('RunControlView — Manage opens monitor-setup without noopener (owner #5)', () => {
  it('clicking the Displays-panel Manage button calls window.open(/monitor-setup, _blank) with NO third feature arg', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // The Displays panel (with its Manage button) only renders in State B — enter
    // live via rehearse (opens no window in this harness).
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="run-displays-manage"]').trigger('click')

    // Exactly the plain new-tab open — no 'noopener' (which would drop sessionStorage).
    expect(window.open).toHaveBeenCalledWith('/monitor-setup', '_blank')
    const manageCall = vi
      .mocked(window.open)
      .mock.calls.find((c) => c[0] === '/monitor-setup')
    expect(manageCall).toBeTruthy()
    expect(manageCall![2]).toBeUndefined()
  })
})

// ── Owner UAT: the leave-guard is scoped to a TRULY-LIVE service ─────────────────
// A REHEARSAL puts nothing on the congregation screens, so leaving it is UNGUARDED
// (End Rehearsal returns to pre-flight instead — covered below). Only a real live
// service (live && !rehearsing) cancels an in-app leave + arms the beforeunload
// prompt; the true-live block of that behavior is proven in
// RunControlView.output.test.ts (which can drive a real go-live). Here we prove the
// rehearse path is unguarded (this harness stubs window.open→null, so a real
// go-live can't succeed).
describe('RunControlView — leave-guard scoped to a truly-live service (owner UAT)', () => {
  it('an in-app leave while NOT live passes straight through (guard returns true, no dialog)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(capturedRouteLeaveGuard).toBeTypeOf('function')
    const result = capturedRouteLeaveGuard!({ fullPath: '/services' })
    await flushPromises()

    expect(result).toBe(true) // allowed
    expect(document.body.querySelector('[data-testid="run-exit-dialog"]')).toBeNull()
    expect(fake.close).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="run-service-name"]').exists()).toBe(true)
  })

  it('an in-app leave while REHEARSING passes straight through unguarded (no confirm, no teardown)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click') // enter rehearse
    await flushPromises()

    const result = capturedRouteLeaveGuard!({ fullPath: '/services' })
    await flushPromises()

    // Rehearse is low-stakes: the guard ALLOWS the leave (true), opens NO confirm
    // dialog, and never closes the channel.
    expect(result).toBe(true)
    expect(document.body.querySelector('[data-testid="run-exit-dialog"]')).toBeNull()
    expect(fake.close).not.toHaveBeenCalled()
  })

  it('rehearse does NOT register a beforeunload listener (the guard is scoped to a truly-live service)', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    // Pre-live: no beforeunload listener yet.
    expect(addSpy.mock.calls.filter((c) => c[0] === 'beforeunload')).toHaveLength(0)

    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click') // enter rehearse
    await flushPromises()

    // A rehearsal puts nothing on the congregation screens, so the beforeunload
    // guard is NOT armed (only a truly-live service arms it).
    expect(addSpy.mock.calls.filter((c) => c[0] === 'beforeunload')).toHaveLength(0)
  })
})

// ── Owner UAT: End Rehearsal returns to the pre-flight screen (State A) ──────────
// Ending a rehearsal must go BACK to "Ready when you are" so the operator can then
// Go Live — NOT close the console or navigate away, and NOT open/close any window.
describe('RunControlView — End Rehearsal returns to pre-flight (owner UAT)', () => {
  it('clicking End Rehearsal returns to State A (run-go-live-btn visible), does NOT navigate, and opens/closes no windows', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    // Now live (State B): the exit button reads "End Rehearsal" and the pre-flight
    // go-live button is gone.
    expect(wrapper.find('[data-testid="run-go-live-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-exit-btn"]').text()).toBe('End Rehearsal')

    const openCallsBefore = vi.mocked(window.open).mock.calls.length
    await wrapper.find('[data-testid="run-exit-btn"]').trigger('click')
    await flushPromises()

    // Back to pre-flight State A: the go-live button is visible again, the live
    // previews are gone, and NO confirm dialog was shown.
    expect(wrapper.find('[data-testid="run-go-live-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="run-current-preview"]').exists()).toBe(false)
    expect(document.body.querySelector('[data-testid="run-exit-dialog"]')).toBeNull()
    // No navigation and no window open/close — End Rehearsal only returns to pre-flight.
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(vi.mocked(window.open).mock.calls.length).toBe(openCallsBefore)
    expect(fake.close).not.toHaveBeenCalled()
  })

  it('Escape during a rehearsal also returns to pre-flight without a confirm dialog', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()
    await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
    await flushPromises()

    keydown('Escape')
    await flushPromises()

    // No confirm dialog — Escape during rehearse ends it straight back to State A.
    expect(document.body.querySelector('[data-testid="run-exit-dialog"]')).toBeNull()
    expect(wrapper.find('[data-testid="run-go-live-btn"]').exists()).toBe(true)
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(fake.close).not.toHaveBeenCalled()
  })
})
