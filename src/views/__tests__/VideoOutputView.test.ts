/**
 * Phase 136 Plan 02 (R424/R426). Behavioral coverage for VideoOutputView.vue —
 * the thin wrapper delegating to the shared FullscreenSlideOutput render.
 *
 * This suite proves the three Plan 02 must-haves:
 *  - mounting VideoOutputView with an injected channel factory renders the
 *    shared fullscreen surface under `video-output`; a state message selects a
 *    slide that renders inside `video-stage` (same structure as
 *    `audience-stage` — same SlideCanvas, same canonical stage), and a null /
 *    out-of-range index stays pure black (no slide-canvas, no copy);
 *  - a blackout:true state renders `video-blackout` over the live slide;
 *    blackout:false clears it — same behavior as Audience, because it is the
 *    same shared render;
 *  - `urlForAssignment({ fingerprint: 'fp', role: 'video' }, 'svc-1', 'org-1')`
 *    returns a path starting with `/present/video/svc-1` — the launch URL the
 *    ≥1-Audience-gated openOutputs machinery opens for a saved Video
 *    assignment (no run-control change).
 *
 * Harness lineage: AudienceOutputView.test.ts (reactive vue-router mock,
 * inert @/firebase, hoisted service-store mock, SlideCanvas stub, in-memory
 * channel fake), retargeted to VideoOutputView and the `video-*` testids.
 * This is NOT a re-derivation of the full Audience suite (that suite is the
 * extraction's safety net, unedited) — it is the minimal proof this second
 * wrapper renders through the same shared component + resolves its own route.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelLike, BroadcastChannelFactory } from '@/utils/runChannel'
import VideoOutputView from '../VideoOutputView.vue'

enableAutoUnmount(afterEach)

// ── Mocks (mirrors AudienceOutputView.test.ts) ──────────────────────────────

const mockRoute = reactive({ params: { serviceId: 'service-1' }, query: { org: 'org-1' } })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
}))

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
    slideCanvasSpies: { play: vi.fn(), pause: vi.fn() },
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

vi.mock('@/composables/useSlideshowAssembly', async () => {
  const { ref } = await import('vue')
  return {
    useSlideshowAssembly: () => ({ assembledSlideshow: ref(fakeSlides as AssembledSlide[]) }),
  }
})

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
  return mount(VideoOutputView, { props: { channelFactory } })
}

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
  slideCanvasSpies.play.mockClear()
  slideCanvasSpies.pause.mockClear()
  localStorage.clear()
})

afterEach(() => {
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock
  delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
  vi.restoreAllMocks()
})

describe('VideoOutputView — shared fullscreen render (R426)', () => {
  it('renders no slide, no spinner, and no copy before any state (index null) — pure black', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    expect(wrapper.find('[data-testid="video-output"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="video-stage"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('renders the channel-selected slide inside the canonical video-stage (same structure as audience-stage)', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(0, 1)
    await flushPromises()

    const stage = wrapper.find('[data-testid="video-stage"]')
    expect(stage.exists()).toBe(true)
    expect(stage.find('[data-testid="slide-canvas"]').text()).toBe('a')
  })

  it('renders pure black for an out-of-range index — no SlideCanvas, no error copy', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(99, 1)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('renders video-blackout over the live slide on blackout:true and clears it on blackout:false', async () => {
    const fake = createFakeChannel()
    const wrapper = mountView(fake.factory)
    await flushPromises()

    fake.emitState(0, 1, false)
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('a')
    expect(wrapper.find('[data-testid="video-blackout"]').exists()).toBe(false)

    fake.emitState(0, 2, true)
    await flushPromises()
    expect(wrapper.find('[data-testid="video-blackout"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(true)

    fake.emitState(0, 3, false)
    await flushPromises()
    expect(wrapper.find('[data-testid="video-blackout"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slide-canvas"]').text()).toBe('a')
  })
})

describe('VideoOutputView — launch URL (R424)', () => {
  it('urlForAssignment builds a /present/video/... path for a role "video" assignment', async () => {
    const { urlForAssignment } = await import('@/composables/useRunControl')
    const url = urlForAssignment({ fingerprint: 'fp', role: 'video' }, 'svc-1', 'org-1')
    expect(url.startsWith('/present/video/svc-1')).toBe(true)
  })
})
