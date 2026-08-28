import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import SlideCanvas from '../SlideCanvas.vue'
import type { AssembledSlide } from '@/types/slide'

// Phase 90 — SlideCanvas is NOT teleported (unlike PresentationViewer), so
// every assertion here goes through the mounted wrapper's own DOM, not
// document.body. Auto-unmount keeps each test's mount isolated.
enableAutoUnmount(afterEach)

// ── Fixture builders — copied from PresentationViewer.test.ts's builders
// (same shapes, same AssembledSlide contract) so this suite exercises the
// exact same data SlideCanvas receives from PresentationViewer today. ──────

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

function scriptureSlide(id: string): AssembledSlide {
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
    section: 'message',
    sourceId: 'reading-1',
  }
}

function congregationalScriptureSlide(
  id: string,
  section: import('@/types/slide').CongregationalSection,
): AssembledSlide {
  return {
    slide: {
      id,
      position: 2,
      contentKind: 'scripture',
      reference: 'Psalm 136:1-4',
      bookRef: { book: 'Psalm', chapter: 136, verseStart: 1, verseEnd: 4 },
      text: section.text,
      verseRange: 'vv. 1-4',
      readingMode: 'congregational',
      section,
    },
    slotIndex: 1,
    slotKind: 'SCRIPTURE',
    section: 'worship',
    sourceId: 'reading-2',
  }
}

function textSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 3,
      contentKind: 'text',
      title: 'Message',
      body: 'Please stand for the reading of the Word.',
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

function videoSlide(id: string, url: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 5,
      contentKind: 'video',
      videoSrc: url,
    },
    slotIndex: 4,
    slotKind: 'IMPORTED',
    section: 'worship',
    sourceId: 'video-1',
  }
}

function audioSlide(id: string, url: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 6,
      contentKind: 'text',
      body: `Audio slide ${id}`,
      audioUrl: url,
    },
    slotIndex: 5,
    slotKind: 'IMPORTED',
    section: 'worship',
    sourceId: 'audio-1',
  }
}

function withBackground(assembled: AssembledSlide, url: string): AssembledSlide {
  return {
    ...assembled,
    slide: {
      ...assembled.slide,
      backgroundImageUrl: url,
      backgroundSource: 'slide',
    },
  }
}

describe('SlideCanvas', () => {
  // ── Content-kind coverage — same data-testid markers PresentationViewer used ──

  describe('content kinds', () => {
    it('lyric: renders presentation-body with the joined lines, no sectionLabel', async () => {
      const wrapper = mount(SlideCanvas, { props: { slide: lyricSlide('a') } })
      await flushPromises()

      const body = wrapper.find('[data-testid="presentation-body"]')
      expect(body.exists()).toBe(true)
      expect(body.text()).toContain('Amazing grace, how sweet the sound')
      expect(body.text()).toContain('That saved a wretch like me')
      expect(wrapper.text()).not.toContain('Verse 1')
    })

    it('copyright: renders title at text-6xl, authors, and CCLI fine print', async () => {
      const wrapper = mount(SlideCanvas, { props: { slide: copyrightSlide('a') } })
      await flushPromises()

      const title = wrapper.find('[data-testid="presentation-body"]')
      expect(title.text()).toBe('Amazing Grace')
      expect(title.classes()).toContain('text-6xl')

      const finePrint = wrapper.find('[data-testid="presentation-copyright-fine-print"]')
      expect(finePrint.text()).toContain('Public Domain')
      expect(finePrint.text()).toContain('CCLI Song #22025')
      expect(finePrint.text()).toContain('CCLI License #12345')
      expect(wrapper.text()).toContain('John Newton')
    })

    it('scripture (normal): renders presentation-scripture-reference and full presentation-body text', async () => {
      const wrapper = mount(SlideCanvas, { props: { slide: scriptureSlide('a') } })
      await flushPromises()

      expect(wrapper.find('[data-testid="presentation-scripture-reference"]').text()).toBe('Romans 8:28-30')
      expect(wrapper.find('[data-testid="presentation-body"]').text()).toContain(
        'And we know that for those who love God',
      )
    })

    it('scripture (congregational): renders presentation-speaker + presentation-congregational-section, NO reference', async () => {
      const section = { speaker: 'LEADER' as const, text: 'Give thanks to the LORD, for he is good.' }
      const wrapper = mount(SlideCanvas, { props: { slide: congregationalScriptureSlide('a', section) } })
      await flushPromises()

      expect(wrapper.find('[data-testid="presentation-scripture-reference"]').exists()).toBe(false)
      const speaker = wrapper.find('[data-testid="presentation-speaker"]')
      expect(speaker.text()).toBe('Leader:')
      expect(speaker.classes()).toContain('text-sky-300')
      expect(wrapper.find('[data-testid="presentation-congregational-section"]').text()).toBe(section.text)
    })

    it('text: renders presentation-body with the body only', async () => {
      const wrapper = mount(SlideCanvas, { props: { slide: textSlide('a') } })
      await flushPromises()

      expect(wrapper.find('[data-testid="presentation-body"]').text()).toBe(
        'Please stand for the reading of the Word.',
      )
      expect(wrapper.text()).not.toContain('Message')
    })

    it('image: renders presentation-image with src/alt/object-contain/max-h-[80vh]', async () => {
      const wrapper = mount(SlideCanvas, { props: { slide: imageSlide('a') } })
      await flushPromises()

      const img = wrapper.find('[data-testid="presentation-image"]')
      expect(img.attributes('src')).toBe('https://example.com/announcement.png')
      expect(img.attributes('alt')).toBe('Announcement slide')
      expect(img.classes()).toContain('object-contain')
      expect(img.classes()).toContain('max-h-[80vh]')
    })

    it('video: renders presentation-video wrapping a chromeless VideoPlayer with the src', async () => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
      window.HTMLMediaElement.prototype.pause = vi.fn()
      const wrapper = mount(SlideCanvas, { props: { slide: videoSlide('v1', 'https://example.com/clip.mp4') } })
      await flushPromises()

      const wrapperEl = wrapper.find('[data-testid="presentation-video"]')
      expect(wrapperEl.exists()).toBe(true)
      const video = wrapperEl.find('video')
      expect(video.attributes('src')).toBe('https://example.com/clip.mp4')
      expect(video.attributes('controls')).toBeUndefined()
    })
  })

  // ── suppressBackground (Phase 90/94 confidence-monitor contract) ──────────

  describe('suppressBackground', () => {
    it('false/absent with a resolved backgroundImageUrl renders presentation-background + scrim', async () => {
      const slide = withBackground(lyricSlide('a'), 'https://example.com/bg.jpg')
      const wrapper = mount(SlideCanvas, { props: { slide, suppressBackground: false } })
      await flushPromises()

      const bg = wrapper.find('[data-testid="presentation-background"]')
      expect(bg.exists()).toBe(true)
      expect(bg.attributes('style')).toContain('https://example.com/bg.jpg')
      expect(wrapper.find('[data-testid="presentation-background-scrim"]').exists()).toBe(true)
    })

    it('true renders NEITHER the background nor the scrim, even with a resolved url', async () => {
      const slide = withBackground(lyricSlide('a'), 'https://example.com/bg.jpg')
      const wrapper = mount(SlideCanvas, { props: { slide, suppressBackground: true } })
      await flushPromises()

      expect(wrapper.find('[data-testid="presentation-background"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="presentation-background-scrim"]').exists()).toBe(false)
    })
  })

  // ── Exposed play()/pause() ordering + media-error degradation ─────────────

  describe('media pause/play + error', () => {
    beforeEach(() => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
      window.HTMLMediaElement.prototype.pause = vi.fn()
    })

    it('calling the exposed pause() then play() issues pause before play', async () => {
      const calls: string[] = []
      window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(function playImpl() {
        calls.push('play')
        return Promise.resolve()
      })
      window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(function pauseImpl() {
        calls.push('pause')
      })

      const wrapper = mount(SlideCanvas, { props: { slide: videoSlide('v1', 'https://example.com/clip.mp4') } })
      await flushPromises()
      calls.length = 0 // discard mount-time noise (none expected — SlideCanvas never auto-plays)

      const vm = wrapper.vm as unknown as { pause: () => void; play: () => void }
      vm.pause()
      vm.play()
      await flushPromises()

      expect(calls).toEqual(['pause', 'play'])
    })

    it('a video error shows presentation-media-unavailable and removes presentation-video', async () => {
      const wrapper = mount(SlideCanvas, { props: { slide: videoSlide('v1', 'https://example.com/clip.mp4') } })
      await flushPromises()

      await wrapper.find('[data-testid="presentation-video"] video').trigger('error')
      await flushPromises()

      expect(wrapper.find('[data-testid="presentation-video"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="presentation-media-unavailable"]').text()).toBe('Media unavailable')
    })
  })

  // ── interactive gating (Phase 90/94) ───────────────────────────────────────

  describe('interactive', () => {
    it('false suppresses the audio affordance even when play() rejects with NotAllowedError', async () => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
      window.HTMLMediaElement.prototype.pause = vi.fn()
      const wrapper = mount(SlideCanvas, {
        props: { slide: audioSlide('a1', 'https://example.com/clip.mp3'), interactive: false },
      })
      await flushPromises()

      const vm = wrapper.vm as unknown as { play: () => void }
      vm.play()
      await flushPromises()

      expect(wrapper.find('[data-testid="presentation-audio-affordance"]').exists()).toBe(false)
    })

    it('true renders the audio affordance when play() rejects with NotAllowedError', async () => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
      window.HTMLMediaElement.prototype.pause = vi.fn()
      const wrapper = mount(SlideCanvas, {
        props: { slide: audioSlide('a1', 'https://example.com/clip.mp3'), interactive: true },
      })
      await flushPromises()

      const vm = wrapper.vm as unknown as { play: () => void }
      vm.play()
      await flushPromises()

      const affordance = wrapper.find('[data-testid="presentation-audio-affordance"]')
      expect(affordance.exists()).toBe(true)
      expect(affordance.text()).toBe('Tap to play audio')
    })
  })
})
