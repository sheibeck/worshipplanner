/**
 * Phase 137 Plan 02 (R427). Behavioral coverage for FullscreenSlideOutput.vue's
 * Video-only banner branch — the lower-third render extending the Phase 136
 * shared fullscreen output.
 *
 * This suite proves the five Plan 02 must-haves:
 *  - role='video' + a slot flagged videoOutput.mode==='banner' renders
 *    SlideCanvas inside a bottom `video-banner-band` (NOT the full-stage
 *    `video-stage`); the root's inline background is `transparent` by
 *    default (key-color OFF);
 *  - the same slide with the stored key-color setting ON renders the root's
 *    inline background as the stored colorHex;
 *  - role='video' + an unflagged/`mode:'fullscreen'` slot renders the
 *    existing `video-stage` full-bleed with NO inline background override
 *    (pure-black root, byte-identical to Phase 136);
 *  - role='audience' with a banner-flagged slot IGNORES videoOutput and
 *    renders `audience-stage` full-bleed, black root (banner is Video-only);
 *  - a null/out-of-range index renders zero slide elements in every role.
 *
 * Harness lineage: VideoOutputView.test.ts / AudienceOutputView.test.ts
 * (reactive vue-router mock, hoisted service-store mock, SlideCanvas stub,
 * in-memory channel fake), mounting FullscreenSlideOutput.vue directly (role/
 * testid props) and seeding the service store with a slot carrying
 * `videoOutput.mode` so localService resolves it. AudienceOutputView.test.ts
 * and VideoOutputView.test.ts are NOT edited — they are the unedited
 * regression net for the fullscreen path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelLike, BroadcastChannelFactory } from '@/utils/runChannel'
import { VIDEO_KEY_COLOR_STORAGE_KEY } from '@/utils/monitorConfig'
import FullscreenSlideOutput from '../FullscreenSlideOutput.vue'

enableAutoUnmount(afterEach)

// ── Mocks (mirrors VideoOutputView.test.ts / AudienceOutputView.test.ts) ────

const mockRoute = reactive({ params: { serviceId: 'service-1' }, query: { org: 'org-1' } })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn() }),
}))

const { serviceStoreMock, fakeService, fakeSlides, slideCanvasSpies } = vi.hoisted(() => {
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
  const fakeService = {
    id: 'service-1',
    slots: [
      { id: 'slot-banner', videoOutput: { mode: 'banner' } }, // index 0
      { id: 'slot-unflagged' }, // index 1 — absent videoOutput = fullscreen default
      { id: 'slot-fullscreen', videoOutput: { mode: 'fullscreen' } }, // index 2 — explicit fullscreen
    ],
  }
  return {
    serviceStoreMock: {
      services: [] as unknown[],
      orgId: null as string | null,
      subscribe: vi.fn(),
      unsubscribeAll: vi.fn(),
    },
    fakeService,
    fakeSlides: [fakeSlide('a', 0), fakeSlide('b', 1), fakeSlide('c', 2)],
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

function mountOutput(role: 'video' | 'audience', channelFactory: BroadcastChannelFactory) {
  return mount(FullscreenSlideOutput, { props: { role, testid: role, channelFactory } })
}

beforeEach(() => {
  Element.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
  setFullscreenElement(document.createElement('div')) // fullscreen hides the re-enter affordance/one-tap overlay
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
  serviceStoreMock.services = [fakeService]
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

describe('FullscreenSlideOutput — Video banner branch, transparent default (R427)', () => {
  it('renders SlideCanvas inside video-banner-band (not video-stage) with an inline transparent background', async () => {
    const fake = createFakeChannel()
    const wrapper = mountOutput('video', fake.factory)
    await flushPromises()

    fake.emitState(0, 1) // slide 'a' → slotIndex 0 → slot-banner (mode: 'banner')
    await flushPromises()

    expect(wrapper.find('[data-testid="video-banner-band"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="video-stage"]').exists()).toBe(false)
    const band = wrapper.get('[data-testid="video-banner-band"]')
    expect(band.find('[data-testid="slide-canvas"]').text()).toBe('a')

    const root = wrapper.get('[data-testid="video-output"]')
    expect((root.element as HTMLElement).style.background).toBe('transparent')
  })
})

describe('FullscreenSlideOutput — Video banner branch, key-color fallback (R427)', () => {
  it('renders the root inline background as the stored colorHex when key-color is enabled', async () => {
    localStorage.setItem(VIDEO_KEY_COLOR_STORAGE_KEY, JSON.stringify({ enabled: true, colorHex: '#00FF00' }))
    const fake = createFakeChannel()
    const wrapper = mountOutput('video', fake.factory)
    await flushPromises()

    fake.emitState(0, 1)
    await flushPromises()

    const root = wrapper.get('[data-testid="video-output"]')
    expect((root.element as HTMLElement).style.background).toBe('rgb(0, 255, 0)')
  })
})

describe('FullscreenSlideOutput — Video fullscreen path unchanged (R427)', () => {
  it('renders the existing full-stage with NO inline background override for an unflagged slot', async () => {
    const fake = createFakeChannel()
    const wrapper = mountOutput('video', fake.factory)
    await flushPromises()

    fake.emitState(1, 1) // slide 'b' → slotIndex 1 → slot-unflagged (no videoOutput)
    await flushPromises()

    expect(wrapper.find('[data-testid="video-stage"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="video-banner-band"]').exists()).toBe(false)
    const root = wrapper.get('[data-testid="video-output"]')
    expect((root.element as HTMLElement).style.background).toBe('')
  })

  it('renders the existing full-stage with NO inline background override for an explicit mode:"fullscreen" slot', async () => {
    const fake = createFakeChannel()
    const wrapper = mountOutput('video', fake.factory)
    await flushPromises()

    fake.emitState(2, 1) // slide 'c' → slotIndex 2 → slot-fullscreen (mode: 'fullscreen')
    await flushPromises()

    expect(wrapper.find('[data-testid="video-stage"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="video-banner-band"]').exists()).toBe(false)
    const root = wrapper.get('[data-testid="video-output"]')
    expect((root.element as HTMLElement).style.background).toBe('')
  })
})

describe('FullscreenSlideOutput — Audience ignores videoOutput (R427 is Video-only)', () => {
  it('renders audience-stage full-bleed with a black root even for a banner-flagged slot', async () => {
    const fake = createFakeChannel()
    const wrapper = mountOutput('audience', fake.factory)
    await flushPromises()

    fake.emitState(0, 1) // slide 'a' → slotIndex 0 → slot-banner — IGNORED for role='audience'
    await flushPromises()

    expect(wrapper.find('[data-testid="audience-stage"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="audience-banner-band"]').exists()).toBe(false)
    const root = wrapper.get('[data-testid="audience-output"]')
    expect((root.element as HTMLElement).style.background).toBe('')
  })
})

describe('FullscreenSlideOutput — null/out-of-range index renders zero slide elements (T-93-01)', () => {
  it('role="video": no state yet renders zero slide elements, no spinner, no copy', async () => {
    const fake = createFakeChannel()
    const wrapper = mountOutput('video', fake.factory)
    await flushPromises()

    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="video-stage"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="video-banner-band"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('role="video": an out-of-range index renders zero slide elements', async () => {
    const fake = createFakeChannel()
    const wrapper = mountOutput('video', fake.factory)
    await flushPromises()

    fake.emitState(99, 1)
    await flushPromises()

    expect(wrapper.find('[data-testid="slide-canvas"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})
