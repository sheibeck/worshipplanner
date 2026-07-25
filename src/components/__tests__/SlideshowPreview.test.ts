import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SlideshowPreview from '../SlideshowPreview.vue'
import type { AssembledSection, AssembledSlide } from '@/types/slide'

function copyrightSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 0,
      contentKind: 'lyric',
      title: 'Amazing Grace',
      authors: ['John Newton'],
      ccliSongNumber: '22025',
      copyrightLines: ['Public Domain'],
      ccliLicenseNumber: '12345',
    },
    slotIndex: 0,
    slotKind: 'SONG',
    section: 'worship',
    sourceId: 'song-1',
  }
}

function lyricSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 1,
      contentKind: 'lyric',
      sectionId: 'verse-1',
      sectionLabel: 'Verse 1',
      lines: ['Amazing grace, how sweet the sound', 'That saved a wretch like me'],
    },
    slotIndex: 0,
    slotKind: 'SONG',
    section: 'worship',
    sourceId: 'song-1',
  }
}

function scriptureSlide(id: string, section: AssembledSlide['section']): AssembledSlide {
  return {
    slide: {
      id,
      position: 2,
      contentKind: 'scripture',
      reference: 'Romans 8:28-30',
      bookRef: { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 30 },
      text: 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.',
      verseRange: 'vv. 28-29',
      readingMode: 'normal',
    },
    slotIndex: 1,
    slotKind: 'SCRIPTURE',
    section,
    sourceId: 'reading-1',
  }
}

function textSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 3,
      contentKind: 'text',
      title: 'Message',
      body: 'Message',
    },
    slotIndex: 2,
    slotKind: 'MESSAGE',
    section: 'message',
    sourceId: null,
  }
}

function imageSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 4,
      contentKind: 'image',
      imageUrl: 'https://example.com/announcement.png',
      altText: 'Announcement slide',
    },
    slotIndex: 3,
    slotKind: 'IMPORTED',
    section: 'pre-service',
    sourceId: 'deck-1',
  }
}

describe('SlideshowPreview', () => {
  beforeEach(() => {
    // jsdom does not implement HTMLMediaElement.play/pause — stub per test,
    // since AudioPlayer/VideoPlayer render <audio>/<video> here (no play()
    // is invoked in these tests, but mounting still exercises the elements).
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    window.HTMLMediaElement.prototype.pause = vi.fn()
  })

  it('renders a labeled divider per section using SERVICE_SECTION_LABELS', () => {
    const sections: AssembledSection[] = [
      { section: 'worship', label: 'Worship', slides: [copyrightSlide('a'), lyricSlide('b')] },
      { section: 'message', label: 'Message', slides: [textSlide('c')] },
    ]
    const wrapper = mount(SlideshowPreview, { props: { sections } })

    const dividers = wrapper.findAll('[data-testid="preview-section-divider"]')
    expect(dividers).toHaveLength(2)
    expect(dividers[0]?.text()).toContain('Worship')
    expect(dividers[1]?.text()).toContain('Message')
  })

  it('renders compact slide cards varying by contentKind', () => {
    const sections: AssembledSection[] = [
      {
        section: 'worship',
        label: 'Worship',
        slides: [copyrightSlide('a'), lyricSlide('b'), scriptureSlide('c', 'worship'), textSlide('d')],
      },
    ]
    const wrapper = mount(SlideshowPreview, { props: { sections } })

    const cards = wrapper.findAll('[data-testid="preview-slide"]')
    expect(cards).toHaveLength(4)
    expect(wrapper.text()).toContain('Amazing Grace') // copyright title
    expect(wrapper.text()).toContain('Verse 1') // lyric section label
    expect(wrapper.text()).toContain('Amazing grace, how sweet the sound') // lyric line
    expect(wrapper.text()).toContain('Romans 8:28-30') // scripture reference
    expect(wrapper.text()).toContain('Message') // text title/body
  })

  it('renders an img element with the correct src for an image slide', () => {
    const sections: AssembledSection[] = [
      { section: 'pre-service', label: 'Pre-Service', slides: [imageSlide('e')] },
    ]
    const wrapper = mount(SlideshowPreview, { props: { sections } })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/announcement.png')
  })

  it('renders an undefined-section group under an "Ungrouped" heading', () => {
    const sections: AssembledSection[] = [
      { section: undefined, label: 'Ungrouped', slides: [scriptureSlide('c', undefined)] },
    ]
    const wrapper = mount(SlideshowPreview, { props: { sections } })

    const dividers = wrapper.findAll('[data-testid="preview-section-divider"]')
    expect(dividers).toHaveLength(1)
    expect(dividers[0]?.text()).toContain('Ungrouped')
  })

  it('renders an empty-state message when sections is empty', () => {
    const wrapper = mount(SlideshowPreview, { props: { sections: [] } })

    expect(wrapper.find('[data-testid="preview-empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preview-section-divider"]').exists()).toBe(false)
  })

  it('renders an empty-state message when all sections have no slides', () => {
    const sections: AssembledSection[] = [
      { section: 'worship', label: 'Worship', slides: [] },
    ]
    const wrapper = mount(SlideshowPreview, { props: { sections } })

    expect(wrapper.find('[data-testid="preview-empty-state"]').exists()).toBe(true)
  })

  it('renders an AudioPlayer for a slide with audioUrl and a VideoPlayer for a slide with videoUrl, and neither for a slide with no media', () => {
    const audioSlide = textSlide('audio-slide')
    audioSlide.slide.audioUrl = 'https://example.com/track.mp3'
    const videoSlide = imageSlide('video-slide')
    videoSlide.slide.videoUrl = 'https://example.com/clip.mp4'
    const plainSlide = textSlide('plain-slide')

    const sections: AssembledSection[] = [
      { section: 'message', label: 'Message', slides: [audioSlide, videoSlide, plainSlide] },
    ]
    const wrapper = mount(SlideshowPreview, { props: { sections } })

    const audioWrappers = wrapper.findAll('[data-testid="preview-slide-audio"]')
    const videoWrappers = wrapper.findAll('[data-testid="preview-slide-video"]')
    expect(audioWrappers).toHaveLength(1)
    expect(videoWrappers).toHaveLength(1)
    expect(audioWrappers[0]?.find('audio').attributes('src')).toBe('https://example.com/track.mp3')
    expect(videoWrappers[0]?.find('video').attributes('src')).toBe('https://example.com/clip.mp4')

    // The plain slide's card still renders its text content, with no player wrapper.
    const cards = wrapper.findAll('[data-testid="preview-slide"]')
    const plainCard = cards[2]
    expect(plainCard?.find('[data-testid="preview-slide-audio"]').exists()).toBe(false)
    expect(plainCard?.find('[data-testid="preview-slide-video"]').exists()).toBe(false)
    expect(plainCard?.text()).toContain('Message')
  })

  it('renders an enabled "Present Slideshow" CTA that emits present exactly once when there are slides', async () => {
    const sections: AssembledSection[] = [
      { section: 'worship', label: 'Worship', slides: [textSlide('a')] },
    ]
    const wrapper = mount(SlideshowPreview, { props: { sections } })

    const cta = wrapper.find('[data-testid="present-slideshow-cta"]')
    expect(cta.exists()).toBe(true)
    expect(cta.attributes('disabled')).toBeUndefined()
    expect(cta.attributes('title')).toBeUndefined()

    await cta.trigger('click')
    expect(wrapper.emitted('present')).toHaveLength(1)
  })

  it('disables the "Present Slideshow" CTA and carries the explanatory title when sections is empty', async () => {
    const wrapper = mount(SlideshowPreview, { props: { sections: [] } })

    const cta = wrapper.find('[data-testid="present-slideshow-cta"]')
    expect(cta.exists()).toBe(true)
    expect(cta.attributes('disabled')).toBeDefined()
    expect(cta.attributes('title')).toBe('Add songs or scripture to build a slideshow to present.')

    await cta.trigger('click')
    expect(wrapper.emitted('present')).toBeUndefined()
  })

  it('still renders the "Slideshow Preview" heading alongside the CTA', () => {
    const wrapper = mount(SlideshowPreview, { props: { sections: [] } })

    expect(wrapper.find('h3').text()).toBe('Slideshow Preview')
  })

  it('imports no Pinia store', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const filePath = path.resolve(process.cwd(), 'src/components/SlideshowPreview.vue')
    const source = fs.readFileSync(filePath, 'utf-8')
    expect(source).not.toMatch(/use\w*Store/)
  })
})
