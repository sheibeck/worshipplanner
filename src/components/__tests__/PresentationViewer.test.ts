import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import PresentationViewer from '../PresentationViewer.vue'
import type { AssembledSlide } from '@/types/slide'

// The viewer renders its content via <Teleport to="body">, so the mounted
// wrapper's own DOM tree does not contain it — every assertion in this suite
// goes through body(), a DOMWrapper over document.body, per Vue Test Utils'
// documented Teleport testing pattern. Auto-unmount is enabled so each test
// starts clean.
enableAutoUnmount(afterEach)
function body() {
  return new DOMWrapper(document.body)
}
function slideText() {
  return body().find('[data-testid="presentation-slide"]').text()
}

// ── Fixture builders (same shape as SlideshowPreview.test.ts's builders) ──────

function copyrightSlide(id: string, section: AssembledSlide['section'] = 'worship'): AssembledSlide {
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
    section,
    sourceId: 'song-1',
  }
}

function lyricSlide(id: string, section: AssembledSlide['section'] = 'worship'): AssembledSlide {
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
    section,
    sourceId: 'song-1',
  }
}

/** Removes the `section` key entirely — distinct from passing `section: undefined`
 * as a default-parameter argument, which JS would treat identically to omission. */
function withoutSection(assembled: AssembledSlide): AssembledSlide {
  const { section: _section, ...rest } = assembled
  return rest as AssembledSlide
}

function scriptureSlide(id: string, section: AssembledSlide['section'] = 'message'): AssembledSlide {
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

function congregationalScriptureSlide(
  id: string,
  sections: import('@/types/slide').CongregationalSection[] | undefined,
): AssembledSlide {
  return {
    slide: {
      id,
      position: 2,
      contentKind: 'scripture',
      reference: 'Psalm 136:1-4',
      bookRef: { book: 'Psalm', chapter: 136, verseStart: 1, verseEnd: 4 },
      text: 'Give thanks to the LORD, for he is good. His love endures forever.',
      verseRange: 'vv. 1-4',
      readingMode: 'congregational',
      ...(sections !== undefined && { sections }),
    },
    slotIndex: 1,
    slotKind: 'SCRIPTURE',
    section: 'worship',
    sourceId: 'reading-2',
  }
}

function longScriptureSlide(id: string): AssembledSlide {
  const longText = 'For God so loved the world '.repeat(15).trim() // > 400 chars
  return {
    slide: {
      id,
      position: 2,
      contentKind: 'scripture',
      reference: 'John 3:16',
      bookRef: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 },
      text: longText,
      verseRange: 'v. 16',
      readingMode: 'normal',
    },
    slotIndex: 1,
    slotKind: 'SCRIPTURE',
    section: 'worship',
    sourceId: 'reading-3',
  }
}

function textSlide(id: string, title?: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 3,
      contentKind: 'text',
      ...(title !== undefined && { title }),
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

function markupSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 3,
      contentKind: 'text',
      title: '<script>alert(1)</script>',
      body: '<b>bold</b> & <i>italic</i>',
    },
    slotIndex: 2,
    slotKind: 'MESSAGE',
    section: 'message',
    sourceId: null,
  }
}

describe('PresentationViewer', () => {
  beforeEach(() => {
    // jsdom does not implement the Fullscreen API at all — stub per test.
    Element.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('not supported'))
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
      writable: true,
    })
  })

  it('mounts with 3 slides, renders slide at index 0, and shows "Worship · 1 / 3" for a sectioned slide', async () => {
    const slides: AssembledSlide[] = [
      lyricSlide('a', 'worship'),
      withoutSection(copyrightSlide('b')),
      scriptureSlide('c', 'message'),
    ]
    mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-viewer"]').exists()).toBe(true)
    expect(slideText()).toContain('Verse 1')
    expect(body().find('[data-testid="presentation-progress"]').text()).toBe('Worship · 1 / 3')
  })

  it('a slide with section undefined produces exactly "2 / 3" — no label, no separator', async () => {
    const slides: AssembledSlide[] = [
      lyricSlide('a', 'worship'),
      withoutSection(copyrightSlide('b')),
      scriptureSlide('c', 'message'),
    ]
    mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()

    await body().find('[data-testid="presentation-next"]').trigger('click')
    expect(body().find('[data-testid="presentation-progress"]').text()).toBe('2 / 3')
  })

  it('ArrowRight on the viewer root advances to index 1', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b'), scriptureSlide('c')]
    mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()

    await body().find('[data-testid="presentation-viewer"]').trigger('keydown', { key: 'ArrowRight' })
    expect(slideText()).toContain('Amazing Grace')
  })

  it('Space advances and calls preventDefault', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b'), scriptureSlide('c')]
    mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    body().find('[data-testid="presentation-viewer"]').element.dispatchEvent(event)
    await Promise.resolve()

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(slideText()).toContain('Amazing Grace')
  })

  it('ArrowLeft and Backspace go back', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b'), scriptureSlide('c')]
    mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()

    const viewer = body().find('[data-testid="presentation-viewer"]')
    await viewer.trigger('keydown', { key: 'ArrowRight' })
    await viewer.trigger('keydown', { key: 'ArrowRight' })
    expect(slideText()).toContain('Romans 8:28-30')

    await viewer.trigger('keydown', { key: 'ArrowLeft' })
    expect(slideText()).toContain('Amazing Grace')

    await viewer.trigger('keydown', { key: 'Backspace' })
    expect(slideText()).toContain('Verse 1')
  })

  it('ArrowRight at the last index does not change the rendered slide; ArrowLeft at index 0 does not change it', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b')]
    mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()

    const viewer = body().find('[data-testid="presentation-viewer"]')
    await viewer.trigger('keydown', { key: 'ArrowLeft' })
    expect(slideText()).toContain('Verse 1')

    await viewer.trigger('keydown', { key: 'ArrowRight' })
    expect(slideText()).toContain('Amazing Grace')
    await viewer.trigger('keydown', { key: 'ArrowRight' })
    expect(slideText()).toContain('Amazing Grace')
  })

  it('with exactly 1 slide, the progress pill reads "1 / 1" and both nav buttons are disabled but present', async () => {
    const slides: AssembledSlide[] = [withoutSection(lyricSlide('a'))]
    mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-progress"]').text()).toBe('1 / 1')
    expect(body().find('[data-testid="presentation-prev"]').exists()).toBe(true)
    expect(body().find('[data-testid="presentation-next"]').exists()).toBe(true)
    expect(body().find('[data-testid="presentation-prev"]').attributes('disabled')).toBeDefined()
    expect(body().find('[data-testid="presentation-next"]').attributes('disabled')).toBeDefined()
  })

  it('keydown Escape emits exit exactly once', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a')]
    const wrapper = mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()

    await body().find('[data-testid="presentation-viewer"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('exit')).toHaveLength(1)
  })

  it('clicking presentation-exit emits exit', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a')]
    const wrapper = mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()

    await body().find('[data-testid="presentation-exit"]').trigger('click')
    expect(wrapper.emitted('exit')).toBeTruthy()
  })

  it('with requestFullscreen mocked to reject, the viewer still renders its slide and chrome and emits no error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const slides: AssembledSlide[] = [lyricSlide('a')]
    mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(true)
    expect(body().find('[data-testid="presentation-chrome"]').exists()).toBe(true)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('after a successful fullscreen enter, a fullscreenchange with fullscreenElement null emits exit', async () => {
    Element.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const slides: AssembledSlide[] = [lyricSlide('a')]
    const wrapper = mount(PresentationViewer, { props: { slides } })
    await Promise.resolve()
    await Promise.resolve()

    document.dispatchEvent(new Event('fullscreenchange'))
    await Promise.resolve()

    expect(wrapper.emitted('exit')).toBeTruthy()
  })

  describe('auto-hiding chrome', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('hides chrome and exit button after 3100ms idle, restores on mousemove', async () => {
      const slides: AssembledSlide[] = [lyricSlide('a')]
      mount(PresentationViewer, { props: { slides } })
      await Promise.resolve()

      await vi.advanceTimersByTimeAsync(3100)

      expect(body().find('[data-testid="presentation-chrome"]').classes()).toContain('opacity-0')
      expect(body().find('[data-testid="presentation-exit"]').classes()).toContain('opacity-0')

      await body().find('[data-testid="presentation-viewer"]').trigger('mousemove')

      expect(body().find('[data-testid="presentation-chrome"]').classes()).toContain('opacity-100')
      expect(body().find('[data-testid="presentation-exit"]').classes()).toContain('opacity-100')
    })
  })

  it('slides: [] and isLoading: true renders presentation-loading with the loading copy, no empty-state', async () => {
    mount(PresentationViewer, { props: { slides: [], isLoading: true } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-loading"]').text()).toContain('Loading slideshow…')
    expect(body().find('[data-testid="presentation-empty-state"]').exists()).toBe(false)
  })

  it('slides: [] and isLoading absent/false renders the empty-state copy with a reachable exit and no nav', async () => {
    mount(PresentationViewer, { props: { slides: [] } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-empty-state"]').text()).toBe(
      'No slides yet — add songs or scripture to see the assembled slideshow.',
    )
    expect(body().find('[data-testid="presentation-exit"]').exists()).toBe(true)
    expect(body().find('[data-testid="presentation-prev"]').exists()).toBe(false)
    expect(body().find('[data-testid="presentation-next"]').exists()).toBe(false)
    expect(body().find('[data-testid="presentation-progress"]').exists()).toBe(false)
  })

  // ── Task 2: per-slide-kind rendering ──────────────────────────────────────

  it('a LyricSlide renders sectionLabel in presentation-label and lines joined by newline in presentation-body', async () => {
    mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-label"]').text()).toBe('Verse 1')
    const bodyText = body().find('[data-testid="presentation-body"]').text()
    expect(bodyText).toContain('Amazing grace, how sweet the sound')
    expect(bodyText).toContain('That saved a wretch like me')
  })

  it('a CopyrightSlide renders title, authors, and CCLI lines at fine-print scale with no line-limiting/ellipsis', async () => {
    mount(PresentationViewer, { props: { slides: [copyrightSlide('a')] } })
    await Promise.resolve()

    const titleEl = body().find('[data-testid="presentation-body"]')
    expect(titleEl.text()).toBe('Amazing Grace')
    expect(titleEl.classes()).toContain('text-6xl')

    const finePrint = body().find('[data-testid="presentation-copyright-fine-print"]')
    expect(finePrint.classes()).toContain('text-xs')
    expect(finePrint.text()).not.toContain('John Newton') // authors render outside fine print
    expect(slideText()).toContain('John Newton')
    expect(finePrint.text()).toContain('Public Domain')
    expect(finePrint.text()).toContain('CCLI Song #22025')
    expect(finePrint.text()).toContain('CCLI License #12345')
    expect(slideText()).not.toContain('…')
  })

  it('a normal-mode ScriptureSlide renders reference in presentation-label and the FULL text in presentation-body', async () => {
    mount(PresentationViewer, { props: { slides: [longScriptureSlide('a')] } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-label"]').text()).toBe('John 3:16')
    const text = body().find('[data-testid="presentation-body"]').text()
    expect(text.length).toBeGreaterThan(400)
    expect(text).toBe('For God so loved the world '.repeat(15).trim())
  })

  it('a congregational ScriptureSlide with two sections renders Leader/Congregation blocks with the correct classes', async () => {
    const sections = [
      { speaker: 'LEADER' as const, text: 'Give thanks to the LORD, for he is good.' },
      { speaker: 'CONGREGATION' as const, text: 'His love endures forever.' },
    ]
    mount(PresentationViewer, { props: { slides: [congregationalScriptureSlide('a', sections)] } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-congregational-section-0"]').exists()).toBe(true)
    expect(body().find('[data-testid="presentation-congregational-section-1"]').exists()).toBe(true)

    const leaderTag = body().find('[data-testid="presentation-speaker-0"]')
    expect(leaderTag.text()).toBe('Leader:')
    expect(leaderTag.classes()).toContain('text-indigo-300')

    const congregationTag = body().find('[data-testid="presentation-speaker-1"]')
    expect(congregationTag.text()).toBe('Congregation:')
    expect(congregationTag.classes()).toContain('text-amber-300')

    const congregationSection = body().find('[data-testid="presentation-congregational-section-1"]')
    expect(congregationSection.html()).toContain('pl-8')
  })

  it('readingMode congregational with sections undefined falls back to normal-mode rendering', async () => {
    mount(PresentationViewer, { props: { slides: [congregationalScriptureSlide('a', undefined)] } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-body"]').text()).toContain(
      'Give thanks to the LORD, for he is good.',
    )
    expect(body().find('[data-testid="presentation-congregational-section-0"]').exists()).toBe(false)
  })

  it('readingMode congregational with sections: [] falls back to normal-mode rendering', async () => {
    mount(PresentationViewer, { props: { slides: [congregationalScriptureSlide('a', [])] } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-body"]').text()).toContain(
      'Give thanks to the LORD, for he is good.',
    )
    expect(body().find('[data-testid="presentation-congregational-section-0"]').exists()).toBe(false)
  })

  it('a TextSlide with a title renders it in presentation-label and body in presentation-body', async () => {
    mount(PresentationViewer, { props: { slides: [textSlide('a', 'Message')] } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-label"]').text()).toBe('Message')
    expect(body().find('[data-testid="presentation-body"]').text()).toContain(
      'Please stand for the reading of the Word.',
    )
  })

  it('a TextSlide without a title renders only the body (no presentation-label)', async () => {
    mount(PresentationViewer, { props: { slides: [textSlide('a')] } })
    await Promise.resolve()

    expect(body().find('[data-testid="presentation-label"]').exists()).toBe(false)
    expect(body().find('[data-testid="presentation-body"]').text()).toContain(
      'Please stand for the reading of the Word.',
    )
  })

  it('an ImageSlide renders an img with src/alt and object-contain/max-h-[80vh] classes', async () => {
    mount(PresentationViewer, { props: { slides: [imageSlide('a')] } })
    await Promise.resolve()

    const img = body().find('[data-testid="presentation-image"]')
    expect(img.attributes('src')).toBe('https://example.com/announcement.png')
    expect(img.attributes('alt')).toBe('Announcement slide')
    expect(img.classes()).toContain('object-contain')
    expect(img.classes()).toContain('max-h-[80vh]')
  })

  it('a slide with angle-bracket markup renders those characters literally, not as child elements', async () => {
    mount(PresentationViewer, { props: { slides: [markupSlide('a')] } })
    await Promise.resolve()

    const slideContainer = body().find('[data-testid="presentation-slide"]')
    expect(slideContainer.find('script').exists()).toBe(false)
    expect(slideContainer.find('b').exists()).toBe(false)
    expect(slideContainer.find('i').exists()).toBe(false)
    expect(slideContainer.text()).toContain('<script>alert(1)</script>')
    expect(slideContainer.text()).toContain('<b>bold</b>')
  })

  // ── Task 1: mount the chromeless players and drive play/pause across transitions ──

  function videoSlide(id: string, url: string): AssembledSlide {
    return {
      slide: {
        id,
        position: 5,
        contentKind: 'text',
        body: `Video slide ${id}`,
        videoUrl: url,
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

  describe('media playback', () => {
    beforeEach(() => {
      // jsdom does not implement HTMLMediaElement.play/pause — stub per test.
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
      window.HTMLMediaElement.prototype.pause = vi.fn()
    })

    it('a slide with videoUrl renders presentation-video containing a chromeless VideoPlayer with the correct src', async () => {
      mount(PresentationViewer, { props: { slides: [videoSlide('v1', 'https://example.com/clip.mp4')] } })
      await flushPromises()

      const wrapper = body().find('[data-testid="presentation-video"]')
      expect(wrapper.exists()).toBe(true)
      const video = wrapper.find('video')
      expect(video.attributes('src')).toBe('https://example.com/clip.mp4')
      expect(video.attributes('controls')).toBeUndefined()
    })

    it('a slide with audioUrl renders presentation-audio containing a chromeless AudioPlayer occupying no layout space', async () => {
      mount(PresentationViewer, { props: { slides: [audioSlide('a1', 'https://example.com/clip.mp3')] } })
      await flushPromises()

      const wrapper = body().find('[data-testid="presentation-audio"]')
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.classes()).toContain('h-0')
      const audio = wrapper.find('audio')
      expect(audio.attributes('controls')).toBeUndefined()
    })

    it('a slide with neither url renders neither media wrapper', async () => {
      mount(PresentationViewer, { props: { slides: [textSlide('t1')] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-video"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-audio"]').exists()).toBe(false)
    })

    it('mounting on a media-carrying first slide calls play once after the DOM settles', async () => {
      mount(PresentationViewer, { props: { slides: [videoSlide('v1', 'https://example.com/clip.mp4')] } })
      await flushPromises()

      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
    })

    it('advancing from a media-carrying slide to another calls pause before the incoming play (ordered)', async () => {
      const calls: string[] = []
      window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(function playImpl() {
        calls.push('play')
        return Promise.resolve()
      })
      window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(function pauseImpl() {
        calls.push('pause')
      })

      const slides = [videoSlide('v1', 'https://example.com/clip1.mp4'), videoSlide('v2', 'https://example.com/clip2.mp4')]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()
      calls.length = 0 // discard the initial mount play

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()

      const lastPauseIdx = calls.lastIndexOf('pause')
      const lastPlayIdx = calls.lastIndexOf('play')
      expect(lastPauseIdx).toBeGreaterThanOrEqual(0)
      expect(lastPlayIdx).toBeGreaterThan(lastPauseIdx)
    })

    // Regression test for WR-01 (see IN-02): a realistic test double whose
    // play() returns a promise that stays pending until either (a) the
    // element's pause() is called on it before it settles — which rejects it
    // with an AbortError, matching real browser behavior for "the play()
    // request was interrupted by a call to pause()" — or (b) the test lets it
    // resolve explicitly. Unlike the always-synchronously-resolving mocks
    // used elsewhere in this suite, this reproduces the actual race WR-01
    // fixes: pauseCurrentMedia() (called at the top of every goToIndex())
    // pausing the OUTGOING slide's element while its play() is still pending.
    function createInterruptiblePlayPause() {
      const pendingRejectors = new Map<HTMLMediaElement, (err: unknown) => void>()
      const play = vi.fn(function (this: HTMLMediaElement) {
        return new Promise<void>((_resolve, reject) => {
          pendingRejectors.set(this, reject)
        })
      })
      const pause = vi.fn(function (this: HTMLMediaElement) {
        const reject = pendingRejectors.get(this)
        if (reject) {
          pendingRejectors.delete(this)
          reject(new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'))
        }
      })
      return { play, pause }
    }

    it('pause()-interrupting a still-pending play() during rapid navigation never surfaces as an unhandled rejection (WR-01)', async () => {
      const { play, pause } = createInterruptiblePlayPause()
      window.HTMLMediaElement.prototype.play = play
      window.HTMLMediaElement.prototype.pause = pause

      const unhandledRejections: unknown[] = []
      const onUnhandledRejection = (reason: unknown) => {
        unhandledRejections.push(reason)
      }
      process.on('unhandledRejection', onUnhandledRejection)

      try {
        const slides = [
          videoSlide('v1', 'https://example.com/clip1.mp4'),
          videoSlide('v2', 'https://example.com/clip2.mp4'),
        ]
        mount(PresentationViewer, { props: { slides } })
        await flushPromises()

        // Rapid navigation: the first slide's play() is still pending (our
        // double never auto-resolves) when goToIndex() calls pause() on it.
        await body().find('[data-testid="presentation-next"]').trigger('click')
        await flushPromises()
        // Give Node's microtask queue a turn to flag any unhandled rejection.
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(unhandledRejections).toHaveLength(0)
      } finally {
        process.off('unhandledRejection', onUnhandledRejection)
      }
    })

    it('advancing from a media-carrying slide onto a sibling with no media calls pause and issues no further play', async () => {
      const calls: string[] = []
      window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(function playImpl() {
        calls.push('play')
        return Promise.resolve()
      })
      window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(function pauseImpl() {
        calls.push('pause')
      })

      const slides = [videoSlide('v1', 'https://example.com/clip1.mp4'), textSlide('t1')]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()
      calls.length = 0

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()

      expect(calls).toEqual(['pause'])
    })

    it('going back (ArrowLeft) obeys the same pause-then-play ordering', async () => {
      const calls: string[] = []
      window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(function playImpl() {
        calls.push('play')
        return Promise.resolve()
      })
      window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(function pauseImpl() {
        calls.push('pause')
      })

      const slides = [videoSlide('v1', 'https://example.com/clip1.mp4'), videoSlide('v2', 'https://example.com/clip2.mp4')]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()
      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()
      calls.length = 0

      await body().find('[data-testid="presentation-viewer"]').trigger('keydown', { key: 'ArrowLeft' })
      await flushPromises()

      const lastPauseIdx = calls.lastIndexOf('pause')
      const lastPlayIdx = calls.lastIndexOf('play')
      expect(lastPauseIdx).toBeGreaterThanOrEqual(0)
      expect(lastPlayIdx).toBeGreaterThan(lastPauseIdx)
    })

    it('clicking presentation-exit calls pause', async () => {
      mount(PresentationViewer, { props: { slides: [videoSlide('v1', 'https://example.com/clip.mp4')] } })
      await flushPromises()
      ;(window.HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>).mockClear()

      await body().find('[data-testid="presentation-exit"]').trigger('click')

      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    })

    it('unmounting the viewer calls pause', async () => {
      const wrapper = mount(PresentationViewer, { props: { slides: [videoSlide('v1', 'https://example.com/clip.mp4')] } })
      await flushPromises()
      ;(window.HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>).mockClear()

      wrapper.unmount()

      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    })

    it('a video-carrying slide renders presentation-body at text-2xl (caption), not text-5xl; an audio-only slide renders text-5xl', async () => {
      mount(PresentationViewer, {
        props: {
          slides: [videoSlide('v1', 'https://example.com/clip.mp4'), audioSlide('a1', 'https://example.com/clip.mp3')],
        },
      })
      await flushPromises()

      const videoSlideBody = body().find('[data-testid="presentation-body"]')
      expect(videoSlideBody.classes()).toContain('text-2xl')
      expect(videoSlideBody.classes()).not.toContain('text-5xl')

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()

      const audioSlideBody = body().find('[data-testid="presentation-body"]')
      expect(audioSlideBody.classes()).toContain('text-5xl')
    })
  })

  // ── Task 2: graceful degradation — media-unavailable notice, blocked affordances ──

  describe('media degradation', () => {
    beforeEach(() => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
      window.HTMLMediaElement.prototype.pause = vi.fn()
    })

    it('triggering error on the video removes presentation-video, shows the media-unavailable notice, and leaves the body unchanged', async () => {
      mount(PresentationViewer, { props: { slides: [videoSlide('v1', 'https://example.com/clip.mp4')] } })
      await flushPromises()

      await body().find('[data-testid="presentation-video"] video').trigger('error')
      await flushPromises()

      expect(body().find('[data-testid="presentation-video"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-media-unavailable"]').text()).toBe('Media unavailable')
      expect(body().find('[data-testid="presentation-body"]').text()).toContain('Video slide v1')
    })

    it('triggering error on the audio removes presentation-audio and shows the same notice', async () => {
      mount(PresentationViewer, { props: { slides: [audioSlide('a1', 'https://example.com/clip.mp3')] } })
      await flushPromises()

      await body().find('[data-testid="presentation-audio"] audio').trigger('error')
      await flushPromises()

      expect(body().find('[data-testid="presentation-audio"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-media-unavailable"]').text()).toBe('Media unavailable')
    })

    it('after a media error, ArrowRight still advances', async () => {
      const slides = [videoSlide('v1', 'https://example.com/clip.mp4'), textSlide('t1')]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      await body().find('[data-testid="presentation-video"] video').trigger('error')
      await flushPromises()

      await body().find('[data-testid="presentation-viewer"]').trigger('keydown', { key: 'ArrowRight' })
      await flushPromises()

      expect(slideText()).toContain('Please stand for the reading of the Word.')
    })

    describe('media-unavailable notice not part of auto-hiding chrome', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })
      afterEach(() => {
        vi.useRealTimers()
      })

      it('presentation-media-unavailable does not carry opacity-0 after the idle timer fires, while presentation-chrome does', async () => {
        mount(PresentationViewer, { props: { slides: [videoSlide('v1', 'https://example.com/clip.mp4')] } })
        await Promise.resolve()
        await Promise.resolve()

        await body().find('[data-testid="presentation-video"] video').trigger('error')
        await Promise.resolve()

        await vi.advanceTimersByTimeAsync(3100)

        expect(body().find('[data-testid="presentation-media-unavailable"]').classes()).not.toContain('opacity-0')
        expect(body().find('[data-testid="presentation-chrome"]').classes()).toContain('opacity-0')
      })
    })

    it('play rejecting with NotAllowedError on an audio slide renders the audio affordance; clicking it calls play() again', async () => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
      mount(PresentationViewer, { props: { slides: [audioSlide('a1', 'https://example.com/clip.mp3')] } })
      await flushPromises()

      const affordance = body().find('[data-testid="presentation-audio-affordance"]')
      expect(affordance.exists()).toBe(true)
      expect(affordance.text()).toBe('Tap to play audio')

      const callsBefore = (window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>).mock.calls.length
      await affordance.trigger('click')
      await flushPromises()

      expect((window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        callsBefore,
      )
    })

    it('play rejecting once then resolving on a video slide shows the muted chip, not the hard-block affordance; clicking it unmutes', async () => {
      window.HTMLMediaElement.prototype.play = vi
        .fn()
        .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
        .mockResolvedValue(undefined)
      mount(PresentationViewer, { props: { slides: [videoSlide('v1', 'https://example.com/clip.mp4')] } })
      await flushPromises()

      const chip = body().find('[data-testid="presentation-muted-chip"]')
      expect(chip.exists()).toBe(true)
      expect(chip.text()).toBe('Playing muted — tap to unmute')
      expect(body().find('[data-testid="presentation-video-affordance"]').exists()).toBe(false)

      await chip.trigger('click')
      await flushPromises()

      expect((body().find('[data-testid="presentation-video"] video').element as HTMLVideoElement).muted).toBe(false)
    })

    it('play always rejecting on a video slide shows the hard-block affordance, not the muted chip', async () => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
      mount(PresentationViewer, { props: { slides: [videoSlide('v1', 'https://example.com/clip.mp4')] } })
      await flushPromises()

      const affordance = body().find('[data-testid="presentation-video-affordance"]')
      expect(affordance.exists()).toBe(true)
      expect(affordance.text()).toBe('Tap to play video')
      expect(body().find('[data-testid="presentation-muted-chip"]').exists()).toBe(false)
    })

    it('advancing to the next slide clears every degraded-state flag', async () => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
      const slides = [videoSlide('v1', 'https://example.com/clip.mp4'), textSlide('t1')]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-video-affordance"]').exists()).toBe(true)

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()

      expect(body().find('[data-testid="presentation-media-unavailable"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-audio-affordance"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-video-affordance"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-muted-chip"]').exists()).toBe(false)
    })
  })
})
