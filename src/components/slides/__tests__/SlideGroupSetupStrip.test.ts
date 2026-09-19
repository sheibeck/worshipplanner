import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { ref } from 'vue'
import SlideGroupSetupStrip from '../SlideGroupSetupStrip.vue'
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
