import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import SlideGroupSetupStrip from '../SlideGroupSetupStrip.vue'
import BackgroundControl from '../BackgroundControl.vue'
import SlideGroupMusicControl from '../SlideGroupMusicControl.vue'
import { bedAudioLabel, backgroundImageLabel } from '../slideDisplay'
import type { ServiceSlot } from '@/types/service'
import type { SlideGroup } from '@/types/slideGroup'
import type { Vamp } from '@/types/vamp'

vi.mock('@/firebase', () => ({ functions: {}, storage: {}, db: {} }))

// --- SlideGroupMusicControl.test.ts's mocking pattern for useMediaUpload —
// the real control mounts inside the Audio popover, so its upload composable
// needs the same shape. ---
const mediaUploadProgressRef = ref(0)
const mediaUploadErrorRef = ref<string | null>(null)
const mediaUploadIsUploadingRef = ref(false)
const mockUploadMedia = vi.fn<(file: File, orgId: string) => Promise<string>>()
const mockResetMediaUpload = vi.fn(() => {
  mediaUploadProgressRef.value = 0
  mediaUploadErrorRef.value = null
  mediaUploadIsUploadingRef.value = false
})
vi.mock('@/composables/useMediaUpload', () => ({
  useMediaUpload: () => ({
    progress: mediaUploadProgressRef,
    error: mediaUploadErrorRef,
    isUploading: mediaUploadIsUploadingRef,
    uploadMedia: (file: File, orgId: string) => mockUploadMedia(file, orgId),
    reset: mockResetMediaUpload,
  }),
}))

// --- BackgroundControl.test.ts's mocking pattern for useBackgroundUpload —
// the real control mounts inside the Background popover. ---
const bgProgressRef = ref(0)
const bgErrorRef = ref<string | null>(null)
const bgIsUploadingRef = ref(false)
const mockUploadBackground = vi.fn<(file: File, orgId: string) => Promise<string>>()
const mockResetBackgroundUpload = vi.fn(() => {
  bgProgressRef.value = 0
  bgErrorRef.value = null
  bgIsUploadingRef.value = false
})
vi.mock('@/composables/useBackgroundUpload', () => ({
  useBackgroundUpload: () => ({
    progress: bgProgressRef,
    error: bgErrorRef,
    isUploading: bgIsUploadingRef,
    uploadBackground: mockUploadBackground,
    reset: mockResetBackgroundUpload,
  }),
}))

function makeSlot(overrides: Partial<ServiceSlot> = {}): ServiceSlot {
  return { kind: 'MISC', id: 'slot-1', position: 0, ...overrides } as ServiceSlot
}

function makeGroup(overrides: Partial<SlideGroup> = {}): SlideGroup {
  return {
    id: 'slot-1',
    slotId: 'slot-1',
    serviceId: 'service-1',
    slides: [],
    createdAt: {} as never,
    updatedAt: {} as never,
    ...overrides,
  }
}

interface StripTestProps {
  selectedSlot?: ServiceSlot
  group?: SlideGroup | null
  editable?: boolean
  slideCount?: number
  orgId?: string
  inheritedBackground?: { url: string; label: string }
  recentBackgrounds?: { url: string; label: string }[]
  vamps?: Vamp[]
  vampsLoading?: boolean
}

function mountStrip(overrides: StripTestProps = {}, slots: { trailing?: string } = {}) {
  return mount(SlideGroupSetupStrip, {
    props: {
      selectedSlot: makeSlot(),
      group: null,
      editable: true,
      slideCount: 1,
      orgId: 'org-1',
      ...overrides,
    },
    attachTo: document.body,
    slots,
  })
}

enableAutoUnmount(afterEach)

function stripTestidOrder(wrapper: ReturnType<typeof mountStrip>): (string | null)[] {
  const strip = wrapper.get('[data-testid="slide-group-setup-strip"]')
  return Array.from(strip.element.querySelectorAll('[data-testid]')).map((el) => el.getAttribute('data-testid'))
}

/**
 * Clicks the given chip and drains the async openChip watcher (which itself
 * awaits `nextTick()` before computing `alignRight`/focus) — a single
 * `trigger('click')` await is not enough because that watcher continuation
 * is queued one microtask behind the outer await; `flushPromises()` drains
 * both.
 */
async function openChip(wrapper: ReturnType<typeof mountStrip>, id: 'display' | 'background' | 'audio') {
  await wrapper.get(`[data-testid="slide-group-setup-chip-${id}"]`).trigger('click')
  await flushPromises()
}

describe('SlideGroupSetupStrip — chips (142)', () => {
  it('mounts three chips then the caption, in DOM order, with correct copy/classes (editable, no media)', () => {
    const wrapper = mountStrip({ slideCount: 3, group: null })

    const order = stripTestidOrder(wrapper).filter((id) =>
      [
        'slide-group-setup-chip-display',
        'slide-group-setup-chip-background',
        'slide-group-setup-chip-audio',
        'slide-group-setup-caption',
      ].includes(id ?? ''),
    )
    expect(order).toEqual([
      'slide-group-setup-chip-display',
      'slide-group-setup-chip-background',
      'slide-group-setup-chip-audio',
      'slide-group-setup-caption',
    ])

    const display = wrapper.get('[data-testid="slide-group-setup-chip-display"]')
    expect(display.element.tagName).toBe('BUTTON')
    expect(display.text()).toContain('Display')
    expect(display.text()).toContain('Full-screen')
    expect(display.text()).toContain('▾')

    const background = wrapper.get('[data-testid="slide-group-setup-chip-background"]')
    expect(background.element.tagName).toBe('BUTTON')
    expect(background.text()).toContain('Background')
    expect(background.text()).toContain('Add')
    expect(background.classes()).toContain('border-dashed')
    expect(background.get('span.truncate').classes()).toContain('text-gray-500')

    const audio = wrapper.get('[data-testid="slide-group-setup-chip-audio"]')
    expect(audio.element.tagName).toBe('BUTTON')
    expect(audio.text()).toContain('Audio')
    expect(audio.text()).toContain('Add')
    expect(audio.classes()).toContain('border-dashed')

    const caption = wrapper.get('[data-testid="slide-group-setup-caption"]')
    expect(caption.text()).toBe('applies to all 3 slides in this group, unless a slide sets its own')
  })

  it('slideCount: 1 renders the singular caption', () => {
    const wrapper = mountStrip({ slideCount: 1 })
    expect(wrapper.get('[data-testid="slide-group-setup-caption"]').text()).toBe(
      'applies to all 1 slide in this group, unless a slide sets its own',
    )
  })

  it('selectedSlot.videoOutput.mode "banner" renders the Display chip value as Banner', () => {
    const wrapper = mountStrip({ selectedSlot: makeSlot({ videoOutput: { mode: 'banner' } }) })
    expect(wrapper.get('[data-testid="slide-group-setup-chip-display"]').text()).toContain('Banner')
  })

  it('group.backgroundImageUrl renders the filename, a solid (non-dashed) pill, and a gray-200 value', () => {
    const url = 'https://storage.googleapis.com/bucket/orgs/org-1/backgrounds/bg-1/dusk_gradient.jpg'
    const wrapper = mountStrip({ group: makeGroup({ backgroundImageUrl: url }) })
    const chip = wrapper.get('[data-testid="slide-group-setup-chip-background"]')
    expect(chip.text()).toContain(backgroundImageLabel(url))
    expect(chip.classes()).not.toContain('border-dashed')
    expect(chip.classes()).toContain('border-gray-700')
    expect(chip.classes()).toContain('bg-gray-800')
    expect(chip.get('span.truncate').classes()).toContain('text-gray-200')
  })

  it('inheritedBackground with no group background renders "{label} (song)" on a solid pill with a gray-300 value', () => {
    const wrapper = mountStrip({ inheritedBackground: { url: 'https://x/song-bg.jpg', label: 'dusk.jpg' } })
    const chip = wrapper.get('[data-testid="slide-group-setup-chip-background"]')
    expect(chip.text()).toContain('dusk.jpg (song)')
    expect(chip.classes()).not.toContain('border-dashed')
    expect(chip.get('span.truncate').classes()).toContain('text-gray-300')
  })

  it('group.bedAudioUrl only renders the filename via bedAudioLabel with a gray-200 value', () => {
    const url = 'https://storage.googleapis.com/bucket/orgs/org-1/media/m-1/pad_Cmaj_soft.mp3'
    const wrapper = mountStrip({ group: makeGroup({ bedAudioUrl: url }) })
    const chip = wrapper.get('[data-testid="slide-group-setup-chip-audio"]')
    expect(chip.text()).toContain(bedAudioLabel(url))
    expect(chip.get('span.truncate').classes()).toContain('text-gray-200')
  })

  it('bedVampId + bedVampLabel + bedAudioUrl renders "♪ {label}" with a gray-200 value', () => {
    const wrapper = mountStrip({
      group: makeGroup({ bedVampId: 'vamp-1', bedVampLabel: 'Vamp C · C', bedAudioUrl: 'https://x/vamp.mp3' }),
    })
    const chip = wrapper.get('[data-testid="slide-group-setup-chip-audio"]')
    expect(chip.text()).toContain('♪ Vamp C · C')
    expect(chip.get('span.truncate').classes()).toContain('text-gray-200')
  })

  it('bedVampId + bedVampLabel with no bedAudioUrl renders the amber no-MP3 value on a solid pill', () => {
    const wrapper = mountStrip({ group: makeGroup({ bedVampId: 'vamp-1', bedVampLabel: 'Vamp C · C' }) })
    const chip = wrapper.get('[data-testid="slide-group-setup-chip-audio"]')
    expect(chip.text()).toContain('♪ Vamp C · no MP3')
    expect(chip.classes()).not.toContain('border-dashed')
    expect(chip.get('span.truncate').classes()).toContain('text-amber-400')
  })

  it('closed editable chip carries the correct aria-label/aria-haspopup/aria-expanded, and aria-controls matches the popover id once opened', async () => {
    const wrapper = mountStrip({ group: makeGroup({ bedVampId: 'vamp-1', bedVampLabel: 'Vamp C · C' }) })
    const chip = wrapper.get('[data-testid="slide-group-setup-chip-audio"]')
    expect(chip.attributes('aria-label')).toBe('Audio: ♪ Vamp C · no MP3. Opens Audio options.')
    expect(chip.attributes('aria-haspopup')).toBe('dialog')
    expect(chip.attributes('aria-expanded')).toBe('false')
    const controls = chip.attributes('aria-controls')
    expect(controls).toBeTruthy()

    await chip.trigger('click')
    const popover = wrapper.get('[data-testid="slide-group-setup-popover-audio"]')
    expect(popover.attributes('id')).toBe(controls)
  })

  it('editable: false renders all three chips as inert spans, no caret, no aria-* control attributes, and no popover on click', async () => {
    const wrapper = mountStrip({
      editable: false,
      group: makeGroup({ bedVampId: 'vamp-1', bedVampLabel: 'Vamp C · C' }),
    })
    const display = wrapper.get('[data-testid="slide-group-setup-chip-display"]')
    const background = wrapper.get('[data-testid="slide-group-setup-chip-background"]')
    const audio = wrapper.get('[data-testid="slide-group-setup-chip-audio"]')

    for (const chip of [display, background, audio]) {
      expect(chip.element.tagName).toBe('SPAN')
      expect(chip.attributes('aria-haspopup')).toBeUndefined()
      expect(chip.attributes('aria-expanded')).toBeUndefined()
      expect(chip.attributes('aria-label')).toBeUndefined()
    }
    expect(display.text()).not.toContain('▾')

    await audio.trigger('click')
    expect(wrapper.find('[data-testid^="slide-group-setup-popover-"]').exists()).toBe(false)

    expect(audio.text()).toContain('♪ Vamp C · no MP3')
    expect(audio.get('span.truncate').classes()).toContain('text-amber-400')
  })

  it('the trailing slot renders between the audio chip and the caption, in DOM order', () => {
    const wrapper = mountStrip({}, { trailing: '<button data-testid="trailing-marker">Loop</button>' })
    const order = stripTestidOrder(wrapper)
    const audioIdx = order.indexOf('slide-group-setup-chip-audio')
    const trailingIdx = order.indexOf('trailing-marker')
    const captionIdx = order.indexOf('slide-group-setup-caption')
    expect(audioIdx).toBeGreaterThanOrEqual(0)
    expect(trailingIdx).toBeGreaterThan(audioIdx)
    expect(captionIdx).toBeGreaterThan(trailingIdx)
  })

  it('the strip root and caption carry the required layout classes', () => {
    const wrapper = mountStrip({})
    const strip = wrapper.get('[data-testid="slide-group-setup-strip"]')
    expect(strip.classes()).toEqual(expect.arrayContaining(['flex', 'flex-wrap', 'items-center', 'gap-2']))
    const caption = wrapper.get('[data-testid="slide-group-setup-caption"]')
    expect(caption.classes()).toEqual(
      expect.arrayContaining(['basis-full', 'sm:basis-auto', 'sm:ms-auto', 'text-right', 'text-gray-500']),
    )
  })
})

describe('SlideGroupSetupStrip — popover lifecycle (142)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('click display chip opens its own popover with the correct dialog attributes, the open pill styling, and no sibling popovers', async () => {
    const wrapper = mountStrip({})
    await openChip(wrapper, 'display')

    const chip = wrapper.get('[data-testid="slide-group-setup-chip-display"]')
    const popover = wrapper.get('[data-testid="slide-group-setup-popover-display"]')
    expect(popover.attributes('role')).toBe('dialog')
    expect(popover.attributes('aria-modal')).toBe('false')
    expect(popover.attributes('aria-label')).toBe('Display options')
    expect(popover.attributes('tabindex')).toBe('-1')
    expect(popover.attributes('id')).toBe(chip.attributes('aria-controls'))

    expect(chip.attributes('aria-expanded')).toBe('true')
    expect(chip.attributes('aria-label')).toBe('Display options, expanded')
    expect(chip.classes()).toContain('border-indigo-700')
    expect(chip.classes()).toContain('bg-indigo-950/40')

    expect(popover.find('[data-testid="slot-video-output-row"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-group-setup-popover-background"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(false)
  })

  it('opening a second chip closes the first — exactly one popover, exactly one expanded chip', async () => {
    const wrapper = mountStrip({})
    await openChip(wrapper, 'display')
    await openChip(wrapper, 'background')

    expect(wrapper.find('[data-testid="slide-group-setup-popover-display"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slide-group-setup-popover-background"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid^="slide-group-setup-popover-"]')).toHaveLength(1)
    expect(wrapper.findAll('[aria-expanded="true"]')).toHaveLength(1)
  })

  it('re-clicking the open chip closes its popover', async () => {
    const wrapper = mountStrip({})
    await openChip(wrapper, 'audio')
    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(true)
    await openChip(wrapper, 'audio')
    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(false)
  })

  it('the audio popover carries w-[258px]; display and background popovers carry w-[232px]', async () => {
    const wrapper = mountStrip({})
    await openChip(wrapper, 'audio')
    expect(wrapper.get('[data-testid="slide-group-setup-popover-audio"]').classes()).toContain('w-[258px]')
    await openChip(wrapper, 'audio') // close audio

    await openChip(wrapper, 'display')
    expect(wrapper.get('[data-testid="slide-group-setup-popover-display"]').classes()).toContain('w-[232px]')
    await openChip(wrapper, 'display') // close display

    await openChip(wrapper, 'background')
    expect(wrapper.get('[data-testid="slide-group-setup-popover-background"]').classes()).toContain('w-[232px]')
  })

  it('focus moves into the popover on open — Audio: active tab, Display: first tile, Background: None swatch', async () => {
    const audioWrapper = mountStrip({})
    await openChip(audioWrapper, 'audio')
    expect(document.activeElement?.getAttribute('data-testid')).toBe('group-music-audio-tab-none')
    expect(document.activeElement?.getAttribute('aria-selected')).toBe('true')
    audioWrapper.unmount()

    const displayWrapper = mountStrip({})
    await openChip(displayWrapper, 'display')
    expect(document.activeElement?.getAttribute('data-testid')).toBe('slot-video-output-fullscreen-btn')
    displayWrapper.unmount()

    const backgroundWrapper = mountStrip({})
    await openChip(backgroundWrapper, 'background')
    expect(document.activeElement?.getAttribute('data-testid')).toBe('background-control-swatch-none')
    backgroundWrapper.unmount()
  })

  it('Escape closes the popover and returns focus to the chip that opened it', async () => {
    const wrapper = mountStrip({})
    await openChip(wrapper, 'audio')
    const chipEl = wrapper.get('[data-testid="slide-group-setup-chip-audio"]').element

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(false)
    expect(document.activeElement).toBe(chipEl)
  })

  it('pointerdown outside closes the popover; inside the popover or on the open chip itself does not', async () => {
    const wrapper = mountStrip({})
    await openChip(wrapper, 'audio')

    const popoverEl = wrapper.get('[data-testid="slide-group-setup-popover-audio"]').element
    popoverEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(true)

    const chipEl = wrapper.get('[data-testid="slide-group-setup-chip-audio"]').element
    chipEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(true)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(false)
  })

  it('switching selectedSlot while open closes the popover', async () => {
    const wrapper = mountStrip({})
    await openChip(wrapper, 'audio')
    await wrapper.setProps({ selectedSlot: makeSlot({ id: 'slot-2' }) })
    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(false)
  })

  it('pointerdown/keydown listeners are added once on open, removed once on close, and removed on unmount while open', async () => {
    const docAddSpy = vi.spyOn(document, 'addEventListener')
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener')
    const winAddSpy = vi.spyOn(window, 'addEventListener')
    const winRemoveSpy = vi.spyOn(window, 'removeEventListener')

    const wrapper = mountStrip({})
    await openChip(wrapper, 'audio')
    expect(docAddSpy.mock.calls.filter((c) => c[0] === 'pointerdown')).toHaveLength(1)
    expect(winAddSpy.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(1)

    await openChip(wrapper, 'audio') // close
    expect(docRemoveSpy.mock.calls.filter((c) => c[0] === 'pointerdown')).toHaveLength(1)
    expect(winRemoveSpy.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(1)

    await openChip(wrapper, 'audio') // open again
    wrapper.unmount()
    expect(docRemoveSpy.mock.calls.filter((c) => c[0] === 'pointerdown')).toHaveLength(2)
    expect(winRemoveSpy.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(2)
  })

  it('edge flip: flips to right-0 when the popover would overflow the viewport, stays left-0 otherwise', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      right: window.innerWidth + 50,
      left: 0,
      top: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
    const overflowWrapper = mountStrip({})
    await openChip(overflowWrapper, 'audio')
    const overflowPopover = overflowWrapper.get('[data-testid="slide-group-setup-popover-audio"]')
    expect(overflowPopover.classes()).toContain('right-0')
    expect(overflowPopover.classes()).not.toContain('left-0')
    rectSpy.mockRestore()

    const fitWrapper = mountStrip({})
    await openChip(fitWrapper, 'audio')
    const fitPopover = fitWrapper.get('[data-testid="slide-group-setup-popover-audio"]')
    expect(fitPopover.classes()).toContain('left-0')
    expect(fitPopover.classes()).not.toContain('right-0')
  })

  it('Tab does not close the popover (no focus trap, no blur-close)', async () => {
    const wrapper = mountStrip({})
    await openChip(wrapper, 'audio')
    const popover = wrapper.get('[data-testid="slide-group-setup-popover-audio"]')
    await popover.trigger('keydown', { key: 'Tab' })
    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(true)
  })
})

describe('SlideGroupSetupStrip — passthrough emits (142)', () => {
  it('passthrough — display: clicking the Banner tile emits video-output-change with { mode: "banner" }', async () => {
    const wrapper = mountStrip({})
    await openChip(wrapper, 'display')
    await wrapper.get('[data-testid="slot-video-output-banner-btn"]').trigger('click')
    expect(wrapper.emitted('video-output-change')).toEqual([[{ mode: 'banner' }]])
  })

  it('passthrough — background: props bind through; attach/remove relay to attach-background/remove-background', async () => {
    const recents = [{ url: 'https://x/a.jpg', label: 'a.jpg' }]
    const inherited = { url: 'https://x/song.jpg', label: 'song.jpg' }
    const wrapper = mountStrip({ recentBackgrounds: recents, inheritedBackground: inherited, group: makeGroup({}) })
    await openChip(wrapper, 'background')

    const bg = wrapper.getComponent(BackgroundControl)
    expect(bg.props('variant')).toBe('chip-popover')
    expect(bg.props('recents')).toEqual(recents)
    expect(bg.props('inheritedFrom')).toEqual(inherited)
    expect(bg.props('isEditor')).toBe(true)
    expect(bg.props('orgId')).toBe('org-1')

    await bg.vm.$emit('attach', 'https://x/bg.jpg')
    expect(wrapper.emitted('attach-background')).toEqual([['https://x/bg.jpg']])

    await bg.vm.$emit('remove')
    expect(wrapper.emitted('remove-background')).toHaveLength(1)
  })

  it('passthrough — audio: props bind through; attach/remove/attach-vamp/close relay correctly', async () => {
    const vamp: Vamp = { id: 'v-1', name: 'Vamp A', key: 'C', createdAt: {} as never, updatedAt: {} as never }
    const wrapper = mountStrip({
      group: makeGroup({ bedAudioUrl: 'https://x/track.mp3' }),
      vamps: [vamp],
      vampsLoading: false,
    })
    await openChip(wrapper, 'audio')

    const music = wrapper.getComponent(SlideGroupMusicControl)
    expect(music.props('audioUrl')).toBe('https://x/track.mp3')
    expect(music.props('bedVampId')).toBeUndefined()
    expect(music.props('bedVampLabel')).toBeUndefined()
    expect(music.props('vamps')).toEqual([vamp])
    expect(music.props('vampsLoading')).toBe(false)
    expect(music.props('isEditor')).toBe(true)

    await music.vm.$emit('attach', 'https://x/new-track.mp3')
    expect(wrapper.emitted('attach-music')).toEqual([['https://x/new-track.mp3']])

    await music.vm.$emit('remove')
    expect(wrapper.emitted('remove-music')).toHaveLength(1)

    await music.vm.$emit('attach-vamp', vamp)
    expect(wrapper.emitted('attach-vamp')).toEqual([[vamp]])

    await music.vm.$emit('close')
    expect(wrapper.find('[data-testid="slide-group-setup-popover-audio"]').exists()).toBe(false)
  })
})
