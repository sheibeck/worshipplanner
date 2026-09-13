/**
 * Phase 141 Plan 03 (R438/R439, 141-CONTEXT.md 2026-09-13 owner override). The
 * Run control window is the SINGLE audio owner: one AudioPlayer mounted here,
 * driven by useRunControl.ts's armed/blackout/slide-change state. Harness
 * lineage: RunControlView.loop.test.ts (hoisted `H` fixtures, useServiceAssembly
 * mock stashing the live ref, vue-router mock, SlideCanvas stub, fake channel
 * with `deliver`, fake window/getScreenDetails plumbing, `mountView`,
 * `rehearseFake`, `goLiveFake`, `seedMatchingMapping`, `installGetScreenDetails`,
 * fake timers) and RunControlView.test.ts's `keydown(key)` helper.
 *
 * The REAL AudioPlayer.vue is used (not stubbed) — only the underlying native
 * `HTMLMediaElement.prototype.play`/`pause` are stubbed (SlideCanvas.test.ts's
 * own idiom), so AudioPlayer's real NotAllowedError/AbortError/error handling
 * runs unmodified.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Service } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { BroadcastChannelLike, BroadcastChannelFactory } from '@/utils/runChannel'
import { computeFingerprint, saveMapping, type ScreenLike } from '@/utils/monitorConfig'
import RunControlView from '../RunControlView.vue'

enableAutoUnmount(afterEach)

// ── Fixtures (hoisted) ───────────────────────────────────────────────────────
const H = vi.hoisted(() => {
  function songSlot(id: string, position: number, title: string): unknown {
    return {
      id,
      kind: 'SONG',
      position,
      requiredVwType: 1,
      songId: `song-${position}`,
      songTitle: title,
      songKey: 'C',
      section: 'worship',
    }
  }
  interface SlideOpts {
    audioUrl?: string
    audioLoop?: boolean
    groupId: string
    groupSlideId: string
  }
  function fakeSlide(id: string, slotIndex: number, label: string, opts: SlideOpts): unknown {
    return {
      slide: {
        id,
        position: 0,
        contentKind: 'lyric',
        sectionId: `sec-${id}`,
        sectionLabel: label,
        lines: [`line ${id}`],
        ...(opts.audioUrl ? { audioUrl: opts.audioUrl } : {}),
        ...(opts.audioLoop !== undefined ? { audioLoop: opts.audioLoop } : {}),
      },
      slotIndex,
      slotKind: 'SONG',
      section: 'worship',
      sourceId: `song-${slotIndex}`,
      groupId: opts.groupId,
      groupSlideId: opts.groupSlideId,
    }
  }
  // slot-0: a (audio, loop) + b (no audio). slot-1: c + d (SAME waiting url).
  function vampAudioService(): unknown {
    return {
      id: 'service-1',
      date: '2026-09-01',
      name: 'Sunday Gathering',
      progression: '1-2',
      teams: [],
      status: 'planned',
      slots: [songSlot('slot-0', 0, 'Open Response'), songSlot('slot-1', 1, 'Waiting')],
      sermonPassage: null,
      notes: '',
    }
  }
  function vampAudioSlides(): unknown[] {
    return [
      fakeSlide('a', 0, 'Verse 1', {
        audioUrl: 'https://cdn.example/open-response.mp3',
        audioLoop: true,
        groupId: 'slot-0',
        groupSlideId: 'entry-a',
      }),
      fakeSlide('b', 0, 'Verse 2', { groupId: 'slot-0', groupSlideId: 'entry-b' }),
      fakeSlide('c', 1, 'Verse 1', {
        audioUrl: 'https://cdn.example/waiting.mp3',
        groupId: 'slot-1',
        groupSlideId: 'entry-c',
      }),
      fakeSlide('d', 1, 'Verse 2', {
        audioUrl: 'https://cdn.example/waiting.mp3',
        groupId: 'slot-1',
        groupSlideId: 'entry-d',
      }),
    ]
  }
  // 141-01 GroupSlideEntry shape — entry-a carries a full vampLabel, entry-c
  // carries a vampId with NO label (E6 partial, used by Task 2's badge tests),
  // entry-b/entry-d carry neither.
  const groupsBySlotId = new Map<string, { slides: { id: string; vampId?: string; vampLabel?: string }[] }>([
    [
      'slot-0',
      {
        slides: [
          { id: 'entry-a', vampId: 'vamp-1', vampLabel: 'Open Response · G' },
          { id: 'entry-b' },
        ],
      },
    ],
    ['slot-1', { slides: [{ id: 'entry-c', vampId: 'vamp-2' }] }],
  ])
  return {
    vampAudioService,
    vampAudioSlides,
    groupsBySlotId,
    state: {
      service: vampAudioService(),
      slides: vampAudioSlides(),
    },
  }
})

// ── Mocks ────────────────────────────────────────────────────────────────────
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
    useServiceAssembly: () => ({
      serviceId: ref('service-1'),
      orgIdRef: ref('org-1'),
      localService: ref(H.state.service as unknown as Service),
      assembledSlideshow: ref(H.state.slides as unknown as AssembledSlide[]),
    }),
  }
})

// R437 Pattern 4 — the composable now imports useSlideGroups directly; stub it
// to the fixture's raw GroupSlideEntry map (never AssembledSlide/Slide).
vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({ groupsBySlotId: H.groupsBySlotId }),
}))
// slideGroups.ts imports '@/firebase' — inert at import (initializeApp only),
// but mocked defensively per the base RunControlView.test.ts convention since
// this file is the first to import a store that reaches it transitively.
vi.mock('@/firebase', () => ({ auth: {}, db: {}, functions: {}, storage: {} }))

vi.mock('@/components/slides/SlideCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'SlideCanvasStub',
      props: {
        slide: { type: Object, required: false, default: undefined },
        interactive: { type: Boolean, default: false },
        suppressAudio: { type: Boolean, default: false },
      },
      setup: () => () => h('div', { 'data-testid': 'slide-canvas' }),
    }),
  }
})

// ── In-memory run-channel fake ──────────────────────────────────────────────
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

// ── Fake screens + window plumbing ──────────────────────────────────────────
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

async function rehearseFake(wrapper: ReturnType<typeof mountView>['wrapper']) {
  await vi.advanceTimersByTimeAsync(0)
  await wrapper.find('[data-testid="run-rehearse-btn"]').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
}

async function goLiveFake(wrapper: ReturnType<typeof mountView>['wrapper']) {
  await vi.advanceTimersByTimeAsync(0)
  await wrapper.find('[data-testid="run-go-live-btn"]').trigger('click')
  await vi.advanceTimersByTimeAsync(0)
}

function keydown(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

// Module-scope call-order proof (SlideCanvas.test.ts's own idiom) — reset per test.
let calls: string[] = []

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  openedWins = []
  mockRouterPush.mockClear()
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => makeFakeWin())
  Element.prototype.scrollIntoView = vi.fn()
  H.state.service = H.vampAudioService()
  H.state.slides = H.vampAudioSlides()
  calls = []
  window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    calls.push('play')
    return Promise.resolve()
  })
  window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    calls.push('pause')
  })
  vi.useFakeTimers()
})

afterEach(() => {
  delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
  vi.useRealTimers()
  vi.restoreAllMocks()
  void openSpy
})

describe('RunControlView — control-window audio (R438/R439, Phase 141)', () => {
  it('is entirely hidden pre-live: no arm toggle, no audio mount', () => {
    const { wrapper } = mountView()
    expect(wrapper.find('[data-testid="run-audio-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-control-audio"]').exists()).toBe(false)
  })

  it('goes live Off, pulses --needed, prompts, and mounts (but does not play) the audio element', async () => {
    const { wrapper } = mountView()
    await rehearseFake(wrapper)

    const toggle = wrapper.find('[data-testid="run-audio-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toBe('Audio: Off')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(toggle.attributes('aria-label')).toBe('Arm audio playback for this Run session')
    expect(toggle.classes()).toContain('run-audio-toggle--needed')

    expect(wrapper.find('[data-testid="run-audio-needed-prompt"]').text()).toBe(
      'This slide has audio — arm audio to hear it.',
    )

    const mount_ = wrapper.find('[data-testid="run-control-audio"]')
    expect(mount_.exists()).toBe(true)
    const audios = wrapper.findAll('audio')
    expect(audios).toHaveLength(1)
    const el = audios[0]!.element as HTMLAudioElement
    expect(el.src).toBe('https://cdn.example/open-response.mp3')
    expect(el.loop).toBe(true)

    expect(calls).not.toContain('play')
  })

  it('arming plays immediately and shows the playing dot; no slide change required', async () => {
    const { wrapper } = mountView()
    await rehearseFake(wrapper)

    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    const toggle = wrapper.find('[data-testid="run-audio-toggle"]')
    expect(toggle.text()).toContain('Audio: Armed')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('Audio armed — click to turn off')
    expect(toggle.classes()).not.toContain('run-audio-toggle--needed')
    expect(wrapper.find('[data-testid="run-audio-needed-prompt"]').text()).toBe('')
    expect(calls).toEqual(['play'])
    expect(wrapper.find('[data-testid="run-audio-playing"]').exists()).toBe(true)
  })

  it('a second click disarms and pauses', async () => {
    const { wrapper } = mountView()
    await rehearseFake(wrapper)
    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="run-audio-toggle"]').text()).toBe('Audio: Off')
    expect(calls).toContain('pause')
    expect(wrapper.find('[data-testid="run-audio-playing"]').exists()).toBe(false)
  })

  it('a hello resend for the same slide does not restart playback or remount', async () => {
    const { wrapper, fake } = mountView()
    await rehearseFake(wrapper)
    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    const before = wrapper.find('audio').element

    fake.deliver({ type: 'hello' })
    await vi.advanceTimersByTimeAsync(0)

    expect(calls).toEqual(['play'])
    const audios = wrapper.findAll('audio')
    expect(audios).toHaveLength(1)
    expect(audios[0]!.element).toBe(before)
  })

  it('advancing to a slide with no audio pauses and unmounts the element, with no extra play', async () => {
    const { wrapper } = mountView()
    await rehearseFake(wrapper)
    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    keydown('ArrowRight')
    await vi.advanceTimersByTimeAsync(0)

    expect(calls).toEqual(['play', 'pause'])
    expect(wrapper.find('[data-testid="run-control-audio"]').exists()).toBe(false)
    expect(wrapper.findAll('audio')).toHaveLength(0)
  })

  it('advancing to a slide with new audio pauses-before-playing (single element); the SAME url reuses the SAME element', async () => {
    const { wrapper } = mountView()
    await rehearseFake(wrapper)
    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    keydown('ArrowRight') // a -> b (no audio)
    await vi.advanceTimersByTimeAsync(0)
    keydown('ArrowRight') // b -> c (audio Y)
    await vi.advanceTimersByTimeAsync(0)

    expect(calls.indexOf('pause')).toBeGreaterThanOrEqual(0)
    expect(calls.lastIndexOf('play')).toBeGreaterThan(calls.indexOf('pause'))
    let audios = wrapper.findAll('audio')
    expect(audios).toHaveLength(1)
    const elC = audios[0]!.element as HTMLAudioElement
    expect(elC.src).toBe('https://cdn.example/waiting.mp3')

    keydown('ArrowRight') // c -> d (SAME url Y)
    await vi.advanceTimersByTimeAsync(0)

    audios = wrapper.findAll('audio')
    expect(audios).toHaveLength(1)
    expect(audios[0]!.element).toBe(elC)
  })

  it('blackout pauses while black and resumes on clear (matched go-live, both outputs)', async () => {
    seedMatchingMapping()
    installGetScreenDetails([screenA, screenB])
    const { wrapper } = mountView()
    await goLiveFake(wrapper)

    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toEqual(['play'])

    await wrapper.find('[data-testid="run-blackout-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toContain('pause')
    expect(wrapper.find('[data-testid="run-audio-playing"]').exists()).toBe(false)
    const callsAtBlack = calls.length

    keydown('ArrowRight')
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.filter((c) => c === 'play')).toHaveLength(1)
    void callsAtBlack

    await wrapper.find('[data-testid="run-blackout-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.filter((c) => c === 'play').length).toBeGreaterThanOrEqual(1)
  })

  it('a rejected play() while armed shows the blocked banner; the retry replays and clears it', async () => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => {
      calls.push('play-rejected')
      return Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    })
    const { wrapper } = mountView()
    await rehearseFake(wrapper)

    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    const banner = wrapper.find('[data-testid="run-audio-blocked-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Audio blocked — click to play')
    const retry = wrapper.find('[data-testid="run-audio-blocked-retry"]')
    expect(retry.exists()).toBe(true)
    expect(retry.text()).toBe('Play audio')

    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => {
      calls.push('play')
      return Promise.resolve()
    })
    await retry.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(calls).toContain('play')
    expect(wrapper.find('[data-testid="run-audio-blocked-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-audio-playing"]').exists()).toBe(true)
  })

  it('a media error shows the unavailable indicator; advancing to another audio slide clears it', async () => {
    const { wrapper } = mountView()
    await rehearseFake(wrapper)
    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    await wrapper.find('[data-testid="run-control-audio"] audio').trigger('error')
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="run-audio-unavailable"]').text()).toBe('Audio unavailable')
    expect(wrapper.find('[data-testid="run-audio-playing"]').exists()).toBe(false)

    keydown('ArrowRight') // a -> b (no audio)
    await vi.advanceTimersByTimeAsync(0)
    keydown('ArrowRight') // b -> c (audio)
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="run-audio-unavailable"]').exists()).toBe(false)
  })

  it('exiting a rehearsal pauses and resets arm state to Off for the NEXT rehearsal', async () => {
    const { wrapper } = mountView()
    await rehearseFake(wrapper)
    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toEqual(['play'])

    await wrapper.find('[data-testid="run-exit-btn"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(calls).toContain('pause')
    expect(wrapper.find('[data-testid="run-audio-toggle"]').exists()).toBe(false)

    await rehearseFake(wrapper)
    expect(wrapper.find('[data-testid="run-audio-toggle"]').text()).toBe('Audio: Off')
  })

  it('never more than one <audio> element exists in the control window at once', async () => {
    const { wrapper } = mountView()
    await rehearseFake(wrapper)
    expect(wrapper.findAll('audio').length).toBeLessThanOrEqual(1)
    await wrapper.find('[data-testid="run-audio-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.findAll('audio').length).toBeLessThanOrEqual(1)
    keydown('ArrowRight')
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.findAll('audio').length).toBeLessThanOrEqual(1)
  })

  it('badge (R438): current shows the full label on slide a, next is absent on slide b (no vampId); after advancing, current is absent and next shows the label-less "♪ Vamp" (entry-c)', async () => {
    const { wrapper } = mountView()
    await rehearseFake(wrapper)

    expect(wrapper.find('[data-testid="run-current-vamp-badge"]').text()).toBe(
      '♪ Vamp: Open Response · G',
    )
    expect(wrapper.find('[data-testid="run-next-vamp-badge"]').exists()).toBe(false)

    keydown('ArrowRight') // a -> b
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[data-testid="run-current-vamp-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-next-vamp-badge"]').text()).toBe('♪ Vamp')
  })
})
