import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SlideCard from '../SlideCard.vue'
import type { AssembledSlide } from '@/types/slide'
import type { MenuItem } from '../slideDisplay'

function makeAssembled(overrides: Partial<AssembledSlide> & { slide: AssembledSlide['slide'] }): AssembledSlide {
  return {
    slotIndex: 0,
    slotKind: 'SONG',
    sourceId: null,
    ...overrides,
  } as AssembledSlide
}

function mountCard(props: {
  assembledSlide: AssembledSlide
  number?: number
  selected?: boolean
  reorderable?: boolean
  menuItems?: MenuItem[]
  menuOpen?: boolean
}) {
  return mount(SlideCard, {
    props: {
      assembledSlide: props.assembledSlide,
      number: props.number ?? 1,
      selected: props.selected ?? false,
      reorderable: props.reorderable ?? false,
      menuItems: props.menuItems,
      menuOpen: props.menuOpen,
    },
  })
}

describe('SlideCard', () => {
  it('renders a lyric slide\'s section label and lines', () => {
    const assembled = makeAssembled({
      slide: {
        id: 'lyric-1',
        position: 0,
        contentKind: 'lyric',
        sectionId: 'sec-1',
        sectionLabel: 'Verse 1',
        lines: ['Line one', 'Line two'],
      },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    expect(wrapper.get('[data-testid="slide-card-content-label"]').text()).toBe('VERSE 1')
    expect(wrapper.get('[data-testid="slide-card-body"]').text()).toContain('Line one')
    expect(wrapper.get('[data-testid="slide-card-body"]').text()).toContain('Line two')
  })

  it('renders a copyright slide\'s song title', () => {
    const assembled = makeAssembled({
      slide: {
        id: 'copyright-1',
        position: 0,
        contentKind: 'lyric',
        title: 'Amazing Grace',
        authors: ['John Newton'],
        ccliSongNumber: '1',
        copyrightLines: [],
        ccliLicenseNumber: '1',
      },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    expect(wrapper.get('[data-testid="slide-card-content-label"]').text()).toBe('TITLE')
    expect(wrapper.get('[data-testid="slide-card-body"]').text()).toContain('Amazing Grace')
  })

  it('renders a scripture slide\'s reference and text', () => {
    const assembled = makeAssembled({
      slotKind: 'SCRIPTURE',
      slide: {
        id: 'scripture-1',
        position: 0,
        contentKind: 'scripture',
        reference: 'Psalms 23:1-6',
        bookRef: { book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 } as never,
        text: 'The LORD is my shepherd',
        verseRange: '1-6',
        readingMode: 'normal',
      },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    const body = wrapper.get('[data-testid="slide-card-body"]').text()
    expect(body).toContain('Psalms 23:1-6')
    expect(body).toContain('The LORD is my shepherd')
  })

  it('renders a text slide\'s title and body', () => {
    const assembled = makeAssembled({
      slotKind: 'PRAYER',
      slide: {
        id: 'text-1',
        position: 0,
        contentKind: 'text',
        title: 'Welcome',
        body: 'Please stand and join us.',
      },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    expect(wrapper.get('[data-testid="slide-card-content-label"]').text()).toBe('WELCOME')
    expect(wrapper.get('[data-testid="slide-card-body"]').text()).toContain('Please stand and join us.')
  })

  it('renders an image slide\'s image', () => {
    const assembled = makeAssembled({
      slotKind: 'IMPORTED',
      slide: {
        id: 'image-1',
        position: 0,
        contentKind: 'image',
        imageUrl: 'https://example.com/slide.png',
        altText: 'A worship slide',
      },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    const img = wrapper.get('[data-testid="slide-card-image"]')
    expect(img.attributes('src')).toBe('https://example.com/slide.png')
    expect(img.attributes('alt')).toBe('A worship slide')
    expect(wrapper.find('[data-testid="slide-card-body"]').exists()).toBe(false)
  })

  it('renders a video slide, identifying it as video and naming its file when it has one', () => {
    const assembled = makeAssembled({
      slotKind: 'IMPORTED',
      slide: {
        id: 'video-1',
        position: 0,
        contentKind: 'video',
        videoSrc: 'https://example.com/clip.mp4',
        originalFileName: 'intro-clip.mp4',
      },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    expect(wrapper.get('[data-testid="slide-card-content-label"]').text()).toBe('VIDEO')
    expect(wrapper.get('[data-testid="slide-card-body"]').text()).toContain('intro-clip.mp4')
  })

  it('renders the number passed in', () => {
    const assembled = makeAssembled({
      slide: { id: 'n-1', position: 0, contentKind: 'text', body: 'body' },
    })
    const wrapper = mountCard({ assembledSlide: assembled, number: 4 })
    expect(wrapper.get('[data-testid="slide-card-number"]').text()).toBe('4')
  })

  it("uses the shared badge map for the slide's slot kind", () => {
    const assembled = makeAssembled({
      slotKind: 'SCRIPTURE',
      slide: { id: 'k-1', position: 0, contentKind: 'text', body: 'body' },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    const badge = wrapper.get('[data-testid="slide-card-kind-badge"]')
    expect(badge.classes()).toContain('bg-teal-900/50')
    expect(badge.classes()).toContain('text-teal-300')
    expect(badge.classes()).toContain('border-teal-800')
    expect(badge.text()).toBe('SCRIPTURE')
  })

  it('renders an audio chip only when the slide carries audio', () => {
    const withAudio = makeAssembled({
      slide: { id: 'a-1', position: 0, contentKind: 'text', body: 'body', audioUrl: 'https://example.com/a.mp3' },
    })
    const withoutAudio = makeAssembled({
      slide: { id: 'a-2', position: 0, contentKind: 'text', body: 'body' },
    })
    const wrapperWith = mountCard({ assembledSlide: withAudio })
    const wrapperWithout = mountCard({ assembledSlide: withoutAudio })
    expect(wrapperWith.find('[data-testid="slide-card-audio-chip"]').exists()).toBe(true)
    expect(wrapperWithout.find('[data-testid="slide-card-audio-chip"]').exists()).toBe(false)
  })

  it('gives the audio chip an accessible name', () => {
    const assembled = makeAssembled({
      slide: { id: 'a-3', position: 0, contentKind: 'text', body: 'body', audioUrl: 'https://example.com/a.mp3' },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    expect(wrapper.get('[data-testid="slide-card-audio-chip"]').attributes('aria-label')).toBe(
      'Slide has audio attached',
    )
  })

  it('emits select with the slide id when clicked', async () => {
    const assembled = makeAssembled({
      slide: { id: 'click-1', position: 0, contentKind: 'text', body: 'body' },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['click-1']])
  })

  it('applies the accent border class only when selected', () => {
    const assembled = makeAssembled({
      slide: { id: 'sel-1', position: 0, contentKind: 'text', body: 'body' },
    })
    const selected = mountCard({ assembledSlide: assembled, selected: true })
    const unselected = mountCard({ assembledSlide: assembled, selected: false })
    expect(selected.classes()).toContain('border-indigo-500')
    expect(unselected.classes()).not.toContain('border-indigo-500')
    expect(selected.attributes('data-selected')).toBe('true')
    expect(unselected.attributes('data-selected')).toBe('false')
  })

  it('renders the drag grip only when reorderable, and clicking it does not emit selection', async () => {
    const assembled = makeAssembled({
      slide: { id: 'grip-1', position: 0, contentKind: 'text', body: 'body' },
    })
    const reorderable = mountCard({ assembledSlide: assembled, reorderable: true })
    const notReorderable = mountCard({ assembledSlide: assembled, reorderable: false })
    expect(reorderable.find('[data-testid="slide-card-drag-handle"]').exists()).toBe(true)
    expect(notReorderable.find('[data-testid="slide-card-drag-handle"]').exists()).toBe(false)

    await reorderable.get('[data-testid="slide-card-drag-handle"]').trigger('click')
    expect(reorderable.emitted('select')).toBeUndefined()
  })

  it('gives the drag grip an accessible name describing which slide it moves', () => {
    const assembled = makeAssembled({
      slide: { id: 'grip-2', position: 0, contentKind: 'text', title: 'Welcome', body: 'body' },
    })
    const wrapper = mountCard({ assembledSlide: assembled, reorderable: true })
    const grip = wrapper.get('[data-testid="slide-card-drag-handle"]')
    expect(grip.attributes('aria-label')).toBe('Reorder slide')
    const describedBy = grip.attributes('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(wrapper.find(`#${describedBy}`).exists()).toBe(true)
  })

  it('clamps long body text inside a fixed-height preview region', () => {
    const assembled = makeAssembled({
      slide: {
        id: 'long-1',
        position: 0,
        contentKind: 'text',
        body: 'Line '.repeat(200),
      },
    })
    const wrapper = mountCard({ assembledSlide: assembled })
    const preview = wrapper.get('[data-testid="slide-card-preview"]')
    expect(preview.classes()).toContain('h-[140px]')
    const body = wrapper.get('[data-testid="slide-card-body"]')
    expect(body.classes()).toContain('line-clamp-6')
  })

  describe('root element (role="button" div, 33-05 Task 1)', () => {
    it('renders a role="button" div, not a native button', () => {
      const assembled = makeAssembled({
        slide: { id: 'root-1', position: 0, contentKind: 'text', body: 'body' },
      })
      const wrapper = mountCard({ assembledSlide: assembled })
      expect(wrapper.element.tagName).toBe('DIV')
      expect(wrapper.attributes('role')).toBe('button')
      expect(wrapper.attributes('tabindex')).toBe('0')
    })

    it('emits select on Enter', async () => {
      const assembled = makeAssembled({
        slide: { id: 'enter-1', position: 0, contentKind: 'text', body: 'body' },
      })
      const wrapper = mountCard({ assembledSlide: assembled })
      await wrapper.trigger('keydown.enter')
      expect(wrapper.emitted('select')).toEqual([['enter-1']])
    })

    it('emits select on Space and prevents the page from scrolling', async () => {
      const assembled = makeAssembled({
        slide: { id: 'space-1', position: 0, contentKind: 'text', body: 'body' },
      })
      const wrapper = mountCard({ assembledSlide: assembled })
      const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', cancelable: true })
      wrapper.element.dispatchEvent(event)
      await nextTick()
      expect(wrapper.emitted('select')).toEqual([['space-1']])
      expect(event.defaultPrevented).toBe(true)
    })

    it('still carries the slide-card class SortableJS scopes to, and data-selected still flips', () => {
      const assembled = makeAssembled({
        slide: { id: 'root-2', position: 0, contentKind: 'text', body: 'body' },
      })
      const selected = mountCard({ assembledSlide: assembled, selected: true })
      const unselected = mountCard({ assembledSlide: assembled, selected: false })
      expect(selected.classes()).toContain('slide-card')
      expect(selected.attributes('data-selected')).toBe('true')
      expect(unselected.attributes('data-selected')).toBe('false')
    })
  })

  describe('SlideActionMenu mounting (33-05 Task 1)', () => {
    const menuItems: MenuItem[] = [{ key: 'edit-details', label: 'Edit details', tone: 'default' }]

    it('renders no menu when menuItems is empty', () => {
      const assembled = makeAssembled({
        slide: { id: 'menu-1', position: 0, contentKind: 'text', body: 'body' },
      })
      const wrapper = mountCard({ assembledSlide: assembled, menuItems: [] })
      expect(wrapper.find('[data-testid="slide-action-menu"]').exists()).toBe(false)
    })

    it('renders the menu when menuItems is non-empty', () => {
      const assembled = makeAssembled({
        slide: { id: 'menu-2', position: 0, contentKind: 'text', body: 'body' },
      })
      const wrapper = mountCard({ assembledSlide: assembled, menuItems })
      expect(wrapper.find('[data-testid="slide-action-menu"]').exists()).toBe(true)
    })

    it('relays the menu toggle emit as menu-toggle carrying the slide id', async () => {
      const assembled = makeAssembled({
        slide: { id: 'menu-3', position: 0, contentKind: 'text', body: 'body' },
      })
      const wrapper = mountCard({ assembledSlide: assembled, menuItems })
      await wrapper.get('[data-testid="slide-action-trigger-menu-3"]').trigger('click')
      expect(wrapper.emitted('menu-toggle')).toEqual([['menu-3']])
    })

    it('relays the menu select emit as menu-select carrying the slide id and the key', async () => {
      const assembled = makeAssembled({
        slide: { id: 'menu-4', position: 0, contentKind: 'text', body: 'body' },
      })
      const wrapper = mountCard({ assembledSlide: assembled, menuItems, menuOpen: true })
      await wrapper.get('[data-testid="slide-action-item-edit-details"]').trigger('click')
      expect(wrapper.emitted('menu-select')).toEqual([['menu-4', 'edit-details']])
    })
  })

  describe('background provenance chip (33-05 Task 2)', () => {
    it('renders "Background" with the indigo class pair for the slide\'s own value', () => {
      const assembled = makeAssembled({
        slide: { id: 'bg-1', position: 0, contentKind: 'text', body: 'body', backgroundSource: 'slide' },
      })
      const wrapper = mountCard({ assembledSlide: assembled })
      const chip = wrapper.get('[data-testid="slide-card-background-chip"]')
      expect(chip.text()).toBe('Background')
      expect(chip.classes()).toContain('text-indigo-300')
    })

    it('renders "From group" with the gray class pair for the group value', () => {
      const assembled = makeAssembled({
        slide: { id: 'bg-2', position: 0, contentKind: 'text', body: 'body', backgroundSource: 'group' },
      })
      const wrapper = mountCard({ assembledSlide: assembled })
      const chip = wrapper.get('[data-testid="slide-card-background-chip"]')
      expect(chip.text()).toBe('From group')
      expect(chip.classes()).toContain('text-gray-400')
    })

    it('renders "From song" with the gray class pair for the song value', () => {
      const assembled = makeAssembled({
        slide: { id: 'bg-3', position: 0, contentKind: 'text', body: 'body', backgroundSource: 'song' },
      })
      const wrapper = mountCard({ assembledSlide: assembled })
      const chip = wrapper.get('[data-testid="slide-card-background-chip"]')
      expect(chip.text()).toBe('From song')
      expect(chip.classes()).toContain('text-gray-400')
    })

    it('renders no chip element when backgroundSource is absent', () => {
      const assembled = makeAssembled({
        slide: { id: 'bg-4', position: 0, contentKind: 'text', body: 'body' },
      })
      const wrapper = mountCard({ assembledSlide: assembled })
      expect(wrapper.find('[data-testid="slide-card-background-chip"]').exists()).toBe(false)
    })

    it('renders both the audio and background chips together, in that order', () => {
      const assembled = makeAssembled({
        slide: {
          id: 'bg-5',
          position: 0,
          contentKind: 'text',
          body: 'body',
          audioUrl: 'https://example.com/a.mp3',
          backgroundSource: 'slide',
        },
      })
      const wrapper = mountCard({ assembledSlide: assembled })
      expect(wrapper.find('[data-testid="slide-card-audio-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="slide-card-background-chip"]').exists()).toBe(true)
      const footer = wrapper.get('[data-testid="slide-card-footer"]')
      const audioIndex = footer.html().indexOf('slide-card-audio-chip')
      const backgroundIndex = footer.html().indexOf('slide-card-background-chip')
      expect(audioIndex).toBeGreaterThan(-1)
      expect(backgroundIndex).toBeGreaterThan(audioIndex)
    })

    it('★ removes the chip on the next tick when assembledSlide updates so backgroundSource disappears, with no manual refresh', async () => {
      const withBackground = makeAssembled({
        slide: { id: 'bg-6', position: 0, contentKind: 'text', body: 'body', backgroundSource: 'group' },
      })
      const wrapper = mountCard({ assembledSlide: withBackground })
      expect(wrapper.find('[data-testid="slide-card-background-chip"]').exists()).toBe(true)

      const withoutBackground = makeAssembled({
        slide: { id: 'bg-6', position: 0, contentKind: 'text', body: 'body' },
      })
      await wrapper.setProps({ assembledSlide: withoutBackground })
      await nextTick()
      expect(wrapper.find('[data-testid="slide-card-background-chip"]').exists()).toBe(false)
    })
  })
})
