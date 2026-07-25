import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
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
})
