import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import PresentationViewer from '../PresentationViewer.vue'
import type { AssembledSlide } from '@/types/slide'
import { FONT_LOAD_TIMEOUT_MS, loadFontCss } from '@/utils/slideTypography'

// --- 46-04: PresentationViewer reads authStore.settings.slideTypography for
// its CSS-variable wrapper (R093) and the R094 font-load gate. Mutable so the
// non-default-family test (below) can override it per-test; every other test
// in this file gets the Inter/400/md default, matching
// DEFAULT_ORG_SETTINGS.slideTypography. ---
let mockSlideTypography: { fontFamily: string; fontWeight: number; fontScale: 'sm' | 'md' | 'lg' } = {
  fontFamily: 'Inter',
  fontWeight: 400,
  fontScale: 'md',
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    settings: {
      get slideTypography() {
        return mockSlideTypography
      },
    },
  }),
}))

// --- 46-04 (R094): only `loadFontCss` is mocked (asserted on directly below)
// — `cssVarsFor`/`snapWeight`/`waitForSlideFont`/`FONT_LOAD_TIMEOUT_MS` stay
// real so the font-load gate's actual race/timeout logic is exercised, not a
// stand-in for it. ---
vi.mock('@/utils/slideTypography', async () => {
  const actual = await vi.importActual<typeof import('@/utils/slideTypography')>('@/utils/slideTypography')
  return {
    ...actual,
    loadFontCss: vi.fn().mockResolvedValue(undefined),
  }
})

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

// 38-02: a ScriptureSlide carries at most ONE congregational section — the
// fixture takes a single section (or undefined for the no-section fallback
// case), never a list.
function congregationalScriptureSlide(
  id: string,
  section: import('@/types/slide').CongregationalSection | undefined,
): AssembledSlide {
  return {
    slide: {
      id,
      position: 2,
      contentKind: 'scripture',
      reference: 'Psalm 136:1-4',
      bookRef: { book: 'Psalm', chapter: 136, verseStart: 1, verseEnd: 4 },
      text: section?.text ?? 'Give thanks to the LORD, for he is good. His love endures forever.',
      verseRange: 'vv. 1-4',
      readingMode: 'congregational',
      ...(section !== undefined && { section }),
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

/**
 * Attaches `renderState`/`renderFailureReason` to an existing fixture's
 * `slide` rather than writing new render-state-only fixtures from scratch —
 * `SlideBase.renderState` sits alongside `contentKind`, so any fixture can
 * carry it (R080/D-15, 42-03).
 */
function withRenderState(
  assembled: AssembledSlide,
  renderState: 'pending' | 'failed',
  renderFailureReason?: string,
): AssembledSlide {
  return {
    ...assembled,
    slide: {
      ...assembled.slide,
      renderState,
      ...(renderFailureReason !== undefined && { renderFailureReason }),
    },
  }
}

/**
 * Attaches a resolved `backgroundImageUrl` (+ its provenance tier) to an
 * existing fixture rather than writing a new slide fixture from scratch —
 * the viewer only ever reads these two fields off `slide`, so any fixture
 * can carry them (Task 2, R070).
 */
function withBackground(
  assembled: AssembledSlide,
  url: string,
  source: 'slide' | 'group' | 'song' = 'slide',
): AssembledSlide {
  return {
    ...assembled,
    slide: {
      ...assembled.slide,
      backgroundImageUrl: url,
      backgroundSource: source,
    },
  }
}

function markupSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 3,
      contentKind: 'text',
      title: '<script>alert(1)</script>',
      body: '<script>alert(1)</script> <b>bold</b> & <i>italic</i>',
    },
    slotIndex: 2,
    slotKind: 'MESSAGE',
    section: 'message',
    sourceId: null,
  }
}

/**
 * 46-04 (R094): jsdom does not implement the Font Loading API at all — every
 * mount needs SOME `document.fonts` stub or `waitForSlideFont`'s internal
 * `document.fonts.ready`/`.load()` calls throw. Default (used by every
 * pre-existing test in this file, unchanged): both settle immediately, so
 * the gate resolves on the next microtask flush exactly like the real
 * default-family case. `stubPendingFonts()` overrides this per-test with a
 * controllable, never-resolving-until-told promise for the gate tests below.
 */
function stubResolvedFonts(): void {
  Object.defineProperty(document, 'fonts', {
    value: {
      ready: Promise.resolve(),
      load: vi.fn().mockResolvedValue([]),
    },
    configurable: true,
    writable: true,
  })
}

function stubPendingFonts(): { resolve: () => void } {
  let resolveFn!: () => void
  const pending = new Promise<void>((resolve) => {
    resolveFn = resolve
  })
  Object.defineProperty(document, 'fonts', {
    value: {
      ready: pending,
      load: vi.fn(() => pending),
    },
    configurable: true,
    writable: true,
  })
  return { resolve: resolveFn }
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
    stubResolvedFonts()
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400, fontScale: 'md' }
    vi.mocked(loadFontCss).mockClear()
  })

  it('mounts with 3 slides, renders slide at index 0, and shows "Worship · 1 / 3" for a sectioned slide', async () => {
    const slides: AssembledSlide[] = [
      lyricSlide('a', 'worship'),
      withoutSection(copyrightSlide('b')),
      scriptureSlide('c', 'message'),
    ]
    mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    expect(body().find('[data-testid="presentation-viewer"]').exists()).toBe(true)
    expect(slideText()).toContain('Amazing grace, how sweet the sound')
    expect(body().find('[data-testid="presentation-progress"]').text()).toBe('Worship · 1 / 3')
  })

  it('a slide with section undefined produces exactly "2 / 3" — no label, no separator', async () => {
    const slides: AssembledSlide[] = [
      lyricSlide('a', 'worship'),
      withoutSection(copyrightSlide('b')),
      scriptureSlide('c', 'message'),
    ]
    mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    await body().find('[data-testid="presentation-next"]').trigger('click')
    expect(body().find('[data-testid="presentation-progress"]').text()).toBe('2 / 3')
  })

  it('ArrowRight on the viewer root advances to index 1', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b'), scriptureSlide('c')]
    mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    await body().find('[data-testid="presentation-viewer"]').trigger('keydown', { key: 'ArrowRight' })
    expect(slideText()).toContain('Amazing Grace')
  })

  it('Space advances and calls preventDefault', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b'), scriptureSlide('c')]
    mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    body().find('[data-testid="presentation-viewer"]').element.dispatchEvent(event)
    await flushPromises()

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(slideText()).toContain('Amazing Grace')
  })

  it('ArrowLeft and Backspace go back', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b'), scriptureSlide('c')]
    mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    const viewer = body().find('[data-testid="presentation-viewer"]')
    await viewer.trigger('keydown', { key: 'ArrowRight' })
    await viewer.trigger('keydown', { key: 'ArrowRight' })
    expect(slideText()).toContain('Romans 8:28-30')

    await viewer.trigger('keydown', { key: 'ArrowLeft' })
    expect(slideText()).toContain('Amazing Grace')

    await viewer.trigger('keydown', { key: 'Backspace' })
    expect(slideText()).toContain('Amazing grace, how sweet the sound')
  })

  it('ArrowRight at the last index does not change the rendered slide; ArrowLeft at index 0 does not change it', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b')]
    mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    const viewer = body().find('[data-testid="presentation-viewer"]')
    await viewer.trigger('keydown', { key: 'ArrowLeft' })
    expect(slideText()).toContain('Amazing grace, how sweet the sound')

    await viewer.trigger('keydown', { key: 'ArrowRight' })
    expect(slideText()).toContain('Amazing Grace')
    await viewer.trigger('keydown', { key: 'ArrowRight' })
    expect(slideText()).toContain('Amazing Grace')
  })

  it('with exactly 1 slide, the progress pill reads "1 / 1" and both nav buttons are disabled but present', async () => {
    const slides: AssembledSlide[] = [withoutSection(lyricSlide('a'))]
    mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    expect(body().find('[data-testid="presentation-progress"]').text()).toBe('1 / 1')
    expect(body().find('[data-testid="presentation-prev"]').exists()).toBe(true)
    expect(body().find('[data-testid="presentation-next"]').exists()).toBe(true)
    expect(body().find('[data-testid="presentation-prev"]').attributes('disabled')).toBeDefined()
    expect(body().find('[data-testid="presentation-next"]').attributes('disabled')).toBeDefined()
  })

  it('keydown Escape emits exit exactly once', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a')]
    const wrapper = mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    await body().find('[data-testid="presentation-viewer"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('exit')).toHaveLength(1)
  })

  it('clicking presentation-exit emits exit', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a')]
    const wrapper = mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    await body().find('[data-testid="presentation-exit"]').trigger('click')
    expect(wrapper.emitted('exit')).toBeTruthy()
  })

  it('the teleported viewer root carries role="dialog" and aria-modal="true" (WR-06)', async () => {
    const slides: AssembledSlide[] = [lyricSlide('a')]
    mount(PresentationViewer, { props: { slides } })
    await flushPromises()

    const viewer = body().find('[data-testid="presentation-viewer"]')
    expect(viewer.attributes('role')).toBe('dialog')
    expect(viewer.attributes('aria-modal')).toBe('true')
  })

  describe('focus trap (WR-06)', () => {
    it('Tab on the last focusable element wraps focus to the first', async () => {
      const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b')]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      const exitEl = body().find('[data-testid="presentation-exit"]').element as HTMLElement
      const nextEl = body().find('[data-testid="presentation-next"]').element as HTMLElement
      nextEl.focus()
      expect(document.activeElement).toBe(nextEl)

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      body().find('[data-testid="presentation-viewer"]').element.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(document.activeElement).toBe(exitEl)
    })

    it('Shift+Tab on the first focusable element wraps focus to the last', async () => {
      const slides: AssembledSlide[] = [lyricSlide('a'), copyrightSlide('b')]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      const exitEl = body().find('[data-testid="presentation-exit"]').element as HTMLElement
      const nextEl = body().find('[data-testid="presentation-next"]').element as HTMLElement
      exitEl.focus()
      expect(document.activeElement).toBe(exitEl)

      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      body().find('[data-testid="presentation-viewer"]').element.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(document.activeElement).toBe(nextEl)
    })

    it('with only one focusable element (both nav buttons disabled), Tab keeps focus on it rather than escaping the viewer', async () => {
      const slides: AssembledSlide[] = [withoutSection(lyricSlide('a'))]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      const exitEl = body().find('[data-testid="presentation-exit"]').element as HTMLElement
      exitEl.focus()

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      body().find('[data-testid="presentation-viewer"]').element.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(document.activeElement).toBe(exitEl)
    })
  })

  it('with requestFullscreen mocked to reject, the viewer still renders its slide and chrome and emits no error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const slides: AssembledSlide[] = [lyricSlide('a')]
    mount(PresentationViewer, { props: { slides } })
    await flushPromises()
    await flushPromises()

    expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(true)
    expect(body().find('[data-testid="presentation-chrome"]').exists()).toBe(true)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('after a successful fullscreen enter, a fullscreenchange with fullscreenElement null emits exit', async () => {
    Element.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const slides: AssembledSlide[] = [lyricSlide('a')]
    const wrapper = mount(PresentationViewer, { props: { slides } })
    await flushPromises()
    await flushPromises()

    document.dispatchEvent(new Event('fullscreenchange'))
    await flushPromises()

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
      await flushPromises()

      await vi.advanceTimersByTimeAsync(3100)

      expect(body().find('[data-testid="presentation-chrome"]').classes()).toContain('opacity-0')
      expect(body().find('[data-testid="presentation-exit"]').classes()).toContain('opacity-0')

      await body().find('[data-testid="presentation-viewer"]').trigger('mousemove')

      expect(body().find('[data-testid="presentation-chrome"]').classes()).toContain('opacity-100')
      expect(body().find('[data-testid="presentation-exit"]').classes()).toContain('opacity-100')
    })

    it('the exit button stays fully opaque and interactive through the idle timeout while isLoading (WR-04)', async () => {
      mount(PresentationViewer, { props: { slides: [], isLoading: true } })
      await flushPromises()

      await vi.advanceTimersByTimeAsync(3100)

      const exit = body().find('[data-testid="presentation-exit"]')
      expect(exit.classes()).toContain('opacity-100')
      expect(exit.classes()).not.toContain('opacity-0')
      expect(exit.classes()).not.toContain('pointer-events-none')
    })

    it('the exit button stays fully opaque and interactive through the idle timeout in the empty state (WR-04)', async () => {
      mount(PresentationViewer, { props: { slides: [] } })
      await flushPromises()

      await vi.advanceTimersByTimeAsync(3100)

      const exit = body().find('[data-testid="presentation-exit"]')
      expect(exit.classes()).toContain('opacity-100')
      expect(exit.classes()).not.toContain('opacity-0')
      expect(exit.classes()).not.toContain('pointer-events-none')
    })
  })

  it('slides: [] and isLoading: true renders presentation-loading with the loading copy, no empty-state', async () => {
    mount(PresentationViewer, { props: { slides: [], isLoading: true } })
    await flushPromises()

    expect(body().find('[data-testid="presentation-loading"]').text()).toContain('Loading slideshow…')
    expect(body().find('[data-testid="presentation-empty-state"]').exists()).toBe(false)
  })

  it('slides: [] and isLoading absent/false renders the empty-state copy with a reachable exit and no nav', async () => {
    mount(PresentationViewer, { props: { slides: [] } })
    await flushPromises()

    expect(body().find('[data-testid="presentation-empty-state"]').text()).toBe(
      'No slides yet — add songs or scripture to see the assembled slideshow.',
    )
    expect(body().find('[data-testid="presentation-exit"]').exists()).toBe(true)
    expect(body().find('[data-testid="presentation-prev"]').exists()).toBe(false)
    expect(body().find('[data-testid="presentation-next"]').exists()).toBe(false)
    expect(body().find('[data-testid="presentation-progress"]').exists()).toBe(false)
  })

  // ── Task 2: per-slide-kind rendering ──────────────────────────────────────

  it('R059: a LyricSlide does not project its sectionLabel, and renders exactly one paragraph of body text', async () => {
    mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
    await flushPromises()

    expect(slideText()).not.toContain('Verse 1')
    expect(body().find('[data-testid="presentation-slide"]').findAll('p')).toHaveLength(1)
    const bodyText = body().find('[data-testid="presentation-body"]').text()
    expect(bodyText).toContain('Amazing grace, how sweet the sound')
    expect(bodyText).toContain('That saved a wretch like me')
  })

  it('R059: a LyricSlide with an empty-string sectionLabel still adds no extra element beyond the single body paragraph', async () => {
    const emptyLabelSlide = lyricSlide('a')
    ;(emptyLabelSlide.slide as import('@/types/slide').LyricSlide).sectionLabel = ''
    mount(PresentationViewer, { props: { slides: [emptyLabelSlide] } })
    await flushPromises()

    expect(body().find('[data-testid="presentation-slide"]').findAll('p')).toHaveLength(1)
    const bodyText = body().find('[data-testid="presentation-body"]').text()
    expect(bodyText).toContain('Amazing grace, how sweet the sound')
    expect(bodyText).toContain('That saved a wretch like me')
  })

  it('a CopyrightSlide renders title, authors, and CCLI lines at fine-print scale with no line-limiting/ellipsis', async () => {
    mount(PresentationViewer, { props: { slides: [copyrightSlide('a')] } })
    await flushPromises()

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

  it('a normal-mode ScriptureSlide renders reference in presentation-scripture-reference and the FULL text in presentation-body', async () => {
    mount(PresentationViewer, { props: { slides: [longScriptureSlide('a')] } })
    await flushPromises()

    expect(body().find('[data-testid="presentation-scripture-reference"]').text()).toBe('John 3:16')
    const text = body().find('[data-testid="presentation-body"]').text()
    expect(text.length).toBeGreaterThan(400)
    // 45-04/R091: a field-less slide (this fixture sets no translationSource)
    // resolves to the '(ESV)' attribution suffix appended to the full text.
    expect(text).toBe('For God so loved the world '.repeat(15).trim() + ' (ESV)')
  })

  it('D1: a normal-mode ScriptureSlide renders its reference in the same treatment as song lyrics, not an accented label', async () => {
    mount(PresentationViewer, { props: { slides: [longScriptureSlide('a')] } })
    await flushPromises()

    const classes = body().find('[data-testid="presentation-scripture-reference"]').classes()
    expect(classes).toContain('text-gray-100')
    expect(classes).toContain('text-5xl')
    expect(classes).toContain('font-normal')
    expect(classes).toContain('leading-[1.4]')
    expect(classes).toContain('whitespace-pre-line')
    expect(classes).toContain('mb-8')
    expect(classes).not.toContain('text-2xl')
    expect(classes).not.toContain('font-semibold')
    expect(classes).not.toContain('text-indigo-400')
    expect(classes).not.toContain('uppercase')
    expect(classes).not.toContain('tracking-wider')
  })

  it('D1: a congregational ScriptureSlide renders its reference in the unified body treatment too, and its speaker tag is coloured but otherwise unaccented, in a LEADER section slide showing that section\'s words', async () => {
    const section = { speaker: 'LEADER' as const, text: 'Give thanks to the LORD, for he is good.' }
    mount(PresentationViewer, { props: { slides: [congregationalScriptureSlide('a', section)] } })
    await flushPromises()

    const classes = body().find('[data-testid="presentation-scripture-reference"]').classes()
    expect(classes).toContain('text-gray-100')
    expect(classes).toContain('text-5xl')
    expect(classes).toContain('font-normal')
    expect(classes).toContain('leading-[1.4]')
    expect(classes).toContain('whitespace-pre-line')
    expect(classes).toContain('mb-8')
    expect(classes).not.toContain('text-2xl')
    expect(classes).not.toContain('font-semibold')
    expect(classes).not.toContain('text-indigo-400')
    expect(classes).not.toContain('uppercase')
    expect(classes).not.toContain('tracking-wider')

    // Owner follow-up 2026-08-05: the speaker tag carries COLOUR again, and
    // colour is the ONLY thing 260805-kzd removed that came back. The size,
    // weight and casing negatives below are the load-bearing half of this
    // assertion — they are what distinguishes "a bit of colour" from a revert
    // to the old text-2xl font-semibold uppercase tracking-wider treatment.
    const leaderTag = body().find('[data-testid="presentation-speaker"]')
    expect(leaderTag.classes()).toContain('text-sky-300')
    expect(leaderTag.classes()).not.toContain('text-gray-100')
    expect(leaderTag.classes()).toContain('text-5xl')
    expect(leaderTag.classes()).toContain('font-normal')
    expect(leaderTag.classes()).toContain('leading-[1.4]')
    expect(leaderTag.classes()).not.toContain('text-2xl')
    expect(leaderTag.classes()).not.toContain('font-semibold')
    expect(leaderTag.classes()).not.toContain('uppercase')
    expect(leaderTag.classes()).not.toContain('tracking-wider')
    expect(leaderTag.text()).toBe('Leader:')

    const words = body().find('[data-testid="presentation-congregational-section"]')
    expect(words.exists()).toBe(true)
    // 45-04/R091: field-less section -> '(ESV)' attribution suffix appended.
    expect(words.text()).toBe(`${section.text} (ESV)`)
  })

  it('N-1 (D1 regression): an unfetched scripture passage still projects its reference as the entire visible content of the slide, never a blank one', async () => {
    const emptyPassageSlide = scriptureSlide('a')
    ;(emptyPassageSlide.slide as import('@/types/slide').ScriptureSlide).text = ''
    mount(PresentationViewer, { props: { slides: [emptyPassageSlide] } })
    await flushPromises()

    const reference = body().find('[data-testid="presentation-scripture-reference"]')
    expect(reference.text()).toBe('Romans 8:28-30')
    expect(reference.classes()).toContain('text-gray-100')
    expect(reference.classes()).toContain('text-5xl')
    expect(slideText().replace(/\s+/g, ' ').trim()).toBe('Romans 8:28-30')
  })

  // ── 45-04 Task 3: shared (ESV)/(NLT) attribution suffix (R091/R092) ──────
  describe('scripture attribution suffix (45-04, R091/R092)', () => {
    it('a normal-mode slide with a stamped NLT translationSource shows (NLT), not (ESV)', async () => {
      const slide = scriptureSlide('a')
      ;(slide.slide as import('@/types/slide').ScriptureSlide).translationSource = 'NLT'
      mount(PresentationViewer, { props: { slides: [slide] } })
      await flushPromises()

      const text = body().find('[data-testid="presentation-body"]').text()
      expect(text.endsWith('(NLT)')).toBe(true)
      expect(text).not.toContain('(ESV)')
    })

    it('a field-less normal-mode slide (no translationSource) shows (ESV) — proving no reliance on the current org setting', async () => {
      const slide = scriptureSlide('a')
      expect((slide.slide as import('@/types/slide').ScriptureSlide).translationSource).toBeUndefined()
      mount(PresentationViewer, { props: { slides: [slide] } })
      await flushPromises()

      const text = body().find('[data-testid="presentation-body"]').text()
      expect(text.endsWith('(ESV)')).toBe(true)
    })

    it('a reference-only slide (empty text) shows no attribution suffix — nothing to attribute', async () => {
      const emptyPassageSlide = scriptureSlide('a')
      ;(emptyPassageSlide.slide as import('@/types/slide').ScriptureSlide).text = ''
      mount(PresentationViewer, { props: { slides: [emptyPassageSlide] } })
      await flushPromises()

      expect(slideText()).not.toContain('(ESV)')
      expect(slideText()).not.toContain('(NLT)')
    })

    it('a congregational section slide with a stamped NLT translationSource shows (NLT) on the section paragraph', async () => {
      const section = { speaker: 'LEADER' as const, text: 'Give thanks to the LORD, for he is good.' }
      const slide = congregationalScriptureSlide('a', section)
      ;(slide.slide as import('@/types/slide').ScriptureSlide).translationSource = 'NLT'
      mount(PresentationViewer, { props: { slides: [slide] } })
      await flushPromises()

      const words = body().find('[data-testid="presentation-congregational-section"]')
      expect(words.text()).toBe(`${section.text} (NLT)`)
    })

    it('two consecutive congregational sections each carry their own suffix, independently — not just the first or last slide of the reading', async () => {
      const leaderSection = { speaker: 'LEADER' as const, text: 'Give thanks to the LORD, for he is good.' }
      const congregationSection = { speaker: 'CONGREGATION' as const, text: 'His love endures forever.' }
      const leaderSlide = congregationalScriptureSlide('a', leaderSection)
      ;(leaderSlide.slide as import('@/types/slide').ScriptureSlide).translationSource = 'NLT'
      const congregationSlide = congregationalScriptureSlide('b', congregationSection)
      ;(congregationSlide.slide as import('@/types/slide').ScriptureSlide).translationSource = 'NLT'

      mount(PresentationViewer, { props: { slides: [leaderSlide, congregationSlide] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-congregational-section"]').text()).toBe(
        `${leaderSection.text} (NLT)`,
      )
      await body().find('[data-testid="presentation-next"]').trigger('click')
      expect(body().find('[data-testid="presentation-congregational-section"]').text()).toBe(
        `${congregationSection.text} (NLT)`,
      )
    })

    it('the suffix renders as plain text interpolation, not v-html — no markup executes even if section text contained HTML-looking characters', async () => {
      const section = { speaker: 'LEADER' as const, text: 'He said <b>this</b> & that.' }
      const slide = congregationalScriptureSlide('a', section)
      mount(PresentationViewer, { props: { slides: [slide] } })
      await flushPromises()

      const words = body().find('[data-testid="presentation-congregational-section"]')
      expect(words.text()).toBe('He said <b>this</b> & that. (ESV)')
      expect(words.find('b').exists()).toBe(false)
    })
  })

  it('two consecutive sections produce two slides, each showing only its own speaker and words, in document order speaker-then-words', async () => {
    const leaderSection = { speaker: 'LEADER' as const, text: 'Give thanks to the LORD, for he is good.' }
    const congregationSection = { speaker: 'CONGREGATION' as const, text: 'His love endures forever.' }
    mount(PresentationViewer, {
      props: {
        slides: [
          congregationalScriptureSlide('a', leaderSection),
          congregationalScriptureSlide('b', congregationSection),
        ],
      },
    })
    await flushPromises()

    // Slide 1: only the LEADER section's speaker and words are present.
    const speaker1 = body().find('[data-testid="presentation-speaker"]')
    const words1 = body().find('[data-testid="presentation-congregational-section"]')
    expect(speaker1.text()).toBe('Leader:')
    expect(words1.text()).toBe(`${leaderSection.text} (ESV)`)
    expect(slideText()).not.toContain(congregationSection.text)

    // Snapshot the class lists NOW, before advancing. `speaker1`/`words1` hold
    // live element references, and Vue patches this v-if branch's nodes in
    // place across the slide change — so reading `.classes()` off them after
    // the click would report slide 2's classes and make the comparison below
    // pass against itself.
    const speaker1Classes = speaker1.classes().slice().sort()
    const words1Classes = words1.classes().slice().sort()

    // Document order: the speaker element precedes the section-text element.
    expect(speaker1.element.compareDocumentPosition(words1.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Advance to slide 2: only the CONGREGATION section's speaker and words —
    // slide 1's speaker/words do not leak onto it.
    await body().find('[data-testid="presentation-next"]').trigger('click')
    const speaker2 = body().find('[data-testid="presentation-speaker"]')
    const words2 = body().find('[data-testid="presentation-congregational-section"]')
    expect(speaker2.text()).toBe('Congregation:')
    expect(words2.text()).toBe(`${congregationSection.text} (ESV)`)
    expect(slideText()).not.toContain(leaderSection.text)
    expect(
      speaker2.element.compareDocumentPosition(words2.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // The PASSAGE text is treated identically on both slides — the words are
    // never colour-coded by who says them.
    expect(words1Classes).toEqual(words2.classes().slice().sort())

    // The SPEAKER line is the one deliberate difference (owner follow-up
    // 2026-08-05): Leader reads sky, Congregation reads amber, so a
    // congregation can tell "is this my line?" without reading the label.
    // Everything else about the two tags is identical — asserted by diffing
    // the class lists and requiring the colour to be the ONLY delta.
    const speaker2Classes = speaker2.classes().slice().sort()
    expect(speaker1Classes).toContain('text-sky-300')
    expect(speaker2Classes).toContain('text-amber-300')
    expect(speaker1Classes.filter((c) => !speaker2Classes.includes(c))).toEqual(['text-sky-300'])
    expect(speaker2Classes.filter((c) => !speaker1Classes.includes(c))).toEqual(['text-amber-300'])
  })

  it('readingMode congregational with no section falls back to normal-mode rendering', async () => {
    mount(PresentationViewer, { props: { slides: [congregationalScriptureSlide('a', undefined)] } })
    await flushPromises()

    expect(body().find('[data-testid="presentation-body"]').text()).toContain(
      'Give thanks to the LORD, for he is good.',
    )
    expect(body().find('[data-testid="presentation-speaker"]').exists()).toBe(false)
    expect(body().find('[data-testid="presentation-congregational-section"]').exists()).toBe(false)
  })

  it('D2: a TextSlide with a title projects only its body — the title never reaches the projector', async () => {
    mount(PresentationViewer, { props: { slides: [textSlide('a', 'Message')] } })
    await flushPromises()

    expect(body().find('[data-testid="presentation-body"]').text()).toContain(
      'Please stand for the reading of the Word.',
    )
    expect(slideText()).not.toContain('Message')
    expect(body().find('[data-testid="presentation-slide"]').findAll('p')).toHaveLength(1)
  })

  it('D2: a TextSlide without a title projects identically to one with a title — same single-paragraph structure', async () => {
    mount(PresentationViewer, { props: { slides: [textSlide('a')] } })
    await flushPromises()

    expect(body().find('[data-testid="presentation-body"]').text()).toContain(
      'Please stand for the reading of the Word.',
    )
    expect(body().find('[data-testid="presentation-slide"]').findAll('p')).toHaveLength(1)
  })

  // D1/D2/D3: every projected text element converges on the same size,
  // proven per kind. The copyright branch is deliberately EXCLUDED from this
  // group — a credits card is a different layout from projected reading
  // text, and CONTEXT.md's discretion default leaves it untouched.
  describe('unified text-5xl size across every projected kind (D1/D2/D3)', () => {
    it('a lyric slide body renders at text-5xl', async () => {
      mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-body"]').classes()).toContain('text-5xl')
    })

    it('a normal-mode scripture slide renders both its reference and its body at text-5xl', async () => {
      mount(PresentationViewer, { props: { slides: [scriptureSlide('a')] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-scripture-reference"]').classes()).toContain('text-5xl')
      expect(body().find('[data-testid="presentation-body"]').classes()).toContain('text-5xl')
    })

    it('a congregational scripture slide renders its reference, its speaker and its section text all at text-5xl', async () => {
      const section = { speaker: 'LEADER' as const, text: 'Give thanks to the LORD, for he is good.' }
      mount(PresentationViewer, { props: { slides: [congregationalScriptureSlide('a', section)] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-scripture-reference"]').classes()).toContain('text-5xl')
      expect(body().find('[data-testid="presentation-speaker"]').classes()).toContain('text-5xl')
      expect(body().find('[data-testid="presentation-congregational-section"]').classes()).toContain('text-5xl')
    })

    it('a text slide body renders at text-5xl', async () => {
      mount(PresentationViewer, { props: { slides: [textSlide('a', 'Message')] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-body"]').classes()).toContain('text-5xl')
    })
  })

  it('an ImageSlide renders an img with src/alt and object-contain/max-h-[80vh] classes', async () => {
    mount(PresentationViewer, { props: { slides: [imageSlide('a')] } })
    await flushPromises()

    const img = body().find('[data-testid="presentation-image"]')
    expect(img.attributes('src')).toBe('https://example.com/announcement.png')
    expect(img.attributes('alt')).toBe('Announcement slide')
    expect(img.classes()).toContain('object-contain')
    expect(img.classes()).toContain('max-h-[80vh]')
  })

  it('a slide with angle-bracket markup renders those characters literally, not as child elements', async () => {
    mount(PresentationViewer, { props: { slides: [markupSlide('a')] } })
    await flushPromises()

    const slideContainer = body().find('[data-testid="presentation-slide"]')
    expect(slideContainer.find('script').exists()).toBe(false)
    expect(slideContainer.find('b').exists()).toBe(false)
    expect(slideContainer.find('i').exists()).toBe(false)
    expect(slideContainer.text()).toContain('<script>alert(1)</script>')
    expect(slideContainer.text()).toContain('<b>bold</b>')
  })

  // ── 42-07 Task 1: the presenter's pending/failed canvas states (R080/D-15) ──

  describe('render-pending and render-failed canvas states (R080/D-15)', () => {
    it('a pending current slide renders presentation-render-pending with the rendering heading, and neither presentation-image nor presentation-body', async () => {
      mount(PresentationViewer, { props: { slides: [withRenderState(imageSlide('a'), 'pending')] } })
      await flushPromises()

      const pending = body().find('[data-testid="presentation-render-pending"]')
      expect(pending.exists()).toBe(true)
      expect(pending.text()).toContain('This slide is still rendering.')
      expect(body().find('[data-testid="presentation-image"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-body"]').exists()).toBe(false)
    })

    it('a failed current slide renders presentation-render-failed with the failed heading and mapped caption, and neither presentation-image nor presentation-body', async () => {
      mount(PresentationViewer, {
        props: { slides: [withRenderState(imageSlide('a'), 'failed', 'missing-render-doc')] },
      })
      await flushPromises()

      const failed = body().find('[data-testid="presentation-render-failed"]')
      expect(failed.exists()).toBe(true)
      expect(failed.text()).toContain("This slide couldn't be rendered.")
      expect(failed.text()).toContain("This deck's render record is missing.")
      expect(body().find('[data-testid="presentation-image"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-body"]').exists()).toBe(false)
    })

    it('a failed slide with an unmapped renderFailureReason shows the generic fallback and never the raw slug', async () => {
      mount(PresentationViewer, {
        props: { slides: [withRenderState(imageSlide('a'), 'failed', 'some-unmapped-future-reason')] },
      })
      await flushPromises()

      const html = document.body.innerHTML
      expect(html).not.toContain('some-unmapped-future-reason')
      expect(body().find('[data-testid="presentation-render-failed"]').text()).toContain(
        "This slide couldn't be rendered.",
      )
    })

    it('the pending and failed headings share the same text-4xl font-semibold size and weight — failed is never louder', async () => {
      let wrapper = mount(PresentationViewer, { props: { slides: [withRenderState(imageSlide('a'), 'pending')] } })
      await flushPromises()
      const pendingHeading = body().find('[data-testid="presentation-render-pending"] h2')
      expect(pendingHeading.classes()).toContain('text-4xl')
      expect(pendingHeading.classes()).toContain('font-semibold')
      wrapper.unmount()

      wrapper = mount(PresentationViewer, { props: { slides: [withRenderState(imageSlide('a'), 'failed')] } })
      await flushPromises()
      const failedHeading = body().find('[data-testid="presentation-render-failed"] h2')
      expect(failedHeading.classes()).toContain('text-4xl')
      expect(failedHeading.classes()).toContain('font-semibold')
    })

    it('a slide with no renderState and contentKind image still renders presentation-image byte-identically', async () => {
      mount(PresentationViewer, { props: { slides: [imageSlide('a')] } })
      await flushPromises()

      const img = body().find('[data-testid="presentation-image"]')
      expect(img.exists()).toBe(true)
      expect(img.classes()).toContain('object-contain')
      expect(img.classes()).toContain('max-h-[80vh]')
      expect(body().find('[data-testid="presentation-render-pending"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-render-failed"]').exists()).toBe(false)
    })
  })

  // ── 42-07 Task 2: the presenter never skips a pending or failed slide (R080/D-15) ──

  describe('never skips a pending or failed slide (R080/D-15)', () => {
    it('a pending slide in the middle position is counted, reached by next (not jumped over), and re-reached by prev', async () => {
      const slides: AssembledSlide[] = [
        withoutSection(imageSlide('a')),
        withRenderState(withoutSection(imageSlide('b')), 'pending'),
        withoutSection(imageSlide('c')),
      ]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      // Mounted at slide 1: the pending slide is counted in the denominator.
      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('1 / 3')
      expect(body().find('[data-testid="presentation-prev"]').attributes('disabled')).toBeDefined()
      expect(body().find('[data-testid="presentation-next"]').attributes('disabled')).toBeUndefined()

      // Advancing once lands ON the pending slide, not past it.
      await body().find('[data-testid="presentation-next"]').trigger('click')
      expect(body().find('[data-testid="presentation-render-pending"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('2 / 3')

      // Advancing again lands on slide 3.
      await body().find('[data-testid="presentation-next"]').trigger('click')
      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('3 / 3')
      expect(body().find('[data-testid="presentation-next"]').attributes('disabled')).toBeDefined()

      // Going back from slide 3 lands on the pending slide again — prev does not skip it either.
      await body().find('[data-testid="presentation-prev"]').trigger('click')
      expect(body().find('[data-testid="presentation-render-pending"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('2 / 3')
    })

    it('a failed slide in the same middle position is counted, reached by next, and re-reached by prev', async () => {
      const slides: AssembledSlide[] = [
        withoutSection(imageSlide('a')),
        withRenderState(withoutSection(imageSlide('b')), 'failed'),
        withoutSection(imageSlide('c')),
      ]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('1 / 3')

      await body().find('[data-testid="presentation-next"]').trigger('click')
      expect(body().find('[data-testid="presentation-render-failed"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('2 / 3')

      await body().find('[data-testid="presentation-next"]').trigger('click')
      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('3 / 3')

      await body().find('[data-testid="presentation-prev"]').trigger('click')
      expect(body().find('[data-testid="presentation-render-failed"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('2 / 3')
    })

    it('an all-pending three-slide deck shows the pending block, reads "1 / 3", and is never the empty state', async () => {
      const slides: AssembledSlide[] = [
        withRenderState(withoutSection(imageSlide('a')), 'pending'),
        withRenderState(withoutSection(imageSlide('b')), 'pending'),
        withRenderState(withoutSection(imageSlide('c')), 'pending'),
      ]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('1 / 3')
      expect(body().find('[data-testid="presentation-render-pending"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-empty-state"]').exists()).toBe(false)
    })
  })

  // ── Task 1: mount the chromeless players and drive play/pause across transitions ──

  /**
   * A genuine VideoSlide (D-17/D-18) — video is slide-only and has no bed,
   * so a video slide's own `videoSrc` is its entire content; unlike the
   * pre-D-18 fixture, it carries no `body` text (VideoSlide has none).
   */
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

  // ── Phase 24 (R030/D-04): group-bed-resolved fixtures ──────────────────────

  function bedAudioSlide(id: string, groupId: string, url: string): AssembledSlide {
    return {
      slide: {
        id,
        position: 6,
        contentKind: 'text',
        body: `Bed audio slide ${id}`,
        audioUrl: url,
      },
      slotIndex: 5,
      slotKind: 'IMPORTED',
      section: 'worship',
      sourceId: 'audio-1',
      groupId,
      groupSlideId: id,
      audioFromBed: true,
    }
  }

  function loopingAudioSlide(id: string, url: string): AssembledSlide {
    return {
      slide: {
        id,
        position: 6,
        contentKind: 'text',
        body: `Looping audio slide ${id}`,
        audioUrl: url,
        audioLoop: true,
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

    // ── Task 3 (Phase 24, R030/D-04): loop pass-through + group-bed keying ──

    it("passes the current slide's audioLoop through to AudioPlayer, rendering the native loop attribute", async () => {
      mount(PresentationViewer, {
        props: { slides: [loopingAudioSlide('a1', 'https://example.com/clip.mp3')] },
      })
      await flushPromises()

      expect(body().find('[data-testid="presentation-audio"] audio').attributes('loop')).toBeDefined()
    })

    it('a slide with no audioLoop renders the AudioPlayer with no loop attribute', async () => {
      mount(PresentationViewer, { props: { slides: [audioSlide('a1', 'https://example.com/clip.mp3')] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-audio"] audio').attributes('loop')).toBeUndefined()
    })

    it('advancing between two bed-carrying audio slides of the SAME group leaves the AudioPlayer key unchanged, so the bed keeps playing (R030)', async () => {
      const sharedUrl = 'https://example.com/bed.mp3'
      const slides = [bedAudioSlide('a1', 'group-1', sharedUrl), bedAudioSlide('a2', 'group-1', sharedUrl)]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      const firstAudioEl = body().find('[data-testid="presentation-audio"] audio').element as HTMLAudioElement

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()

      const secondAudioEl = body().find('[data-testid="presentation-audio"] audio').element as HTMLAudioElement
      expect(secondAudioEl).toBe(firstAudioEl)
    })

    it('advancing between two DIFFERENT video slides always forces a fresh VideoPlayer instance (video has no bed continuity, D-18)', async () => {
      const sharedUrl = 'https://example.com/clip.mp4'
      const slides = [videoSlide('v1', sharedUrl), videoSlide('v2', sharedUrl)]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      const firstVideoEl = body().find('[data-testid="presentation-video"] video').element as HTMLVideoElement

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()

      const secondVideoEl = body().find('[data-testid="presentation-video"] video').element as HTMLVideoElement
      expect(secondVideoEl).not.toBe(firstVideoEl)
    })

    it('advancing between two slides with PER-SLIDE audio (no groupId) still forces a fresh AudioPlayer instance', async () => {
      const slides = [audioSlide('a1', 'https://example.com/clip1.mp3'), audioSlide('a2', 'https://example.com/clip2.mp3')]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      const firstAudioEl = body().find('[data-testid="presentation-audio"] audio').element as HTMLAudioElement

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()

      const secondAudioEl = body().find('[data-testid="presentation-audio"] audio').element as HTMLAudioElement
      expect(secondAudioEl).not.toBe(firstAudioEl)
    })

    it('two adjacent PER-SLIDE-audio slides sharing the identical url with no groupId still force a fresh AudioPlayer instance (byte-identical to the pre-refactor key formula)', async () => {
      const sharedUrl = 'https://example.com/shared-clip.mp3'
      const slides = [audioSlide('a1', sharedUrl), audioSlide('a2', sharedUrl)]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      const firstAudioEl = body().find('[data-testid="presentation-audio"] audio').element as HTMLAudioElement

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()

      const secondAudioEl = body().find('[data-testid="presentation-audio"] audio').element as HTMLAudioElement
      expect(secondAudioEl).not.toBe(firstAudioEl)
    })

    it('an audio-only slide renders its body at full text-5xl scale (no caption demotion — video is slide-only under D-18, so no slide ever has both a body and an attached video to demote it)', async () => {
      mount(PresentationViewer, {
        props: { slides: [audioSlide('a1', 'https://example.com/clip.mp3')] },
      })
      await flushPromises()

      expect(body().find('[data-testid="presentation-body"]').classes()).toContain('text-5xl')
    })
  })

  // ── Task 2: graceful degradation — media-unavailable notice, blocked affordances ──

  describe('media degradation', () => {
    beforeEach(() => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
      window.HTMLMediaElement.prototype.pause = vi.fn()
    })

    it('triggering error on the video removes presentation-video and shows the media-unavailable notice (D-17/D-18: a video slide has no other content to fall back to)', async () => {
      mount(PresentationViewer, { props: { slides: [videoSlide('v1', 'https://example.com/clip.mp4')] } })
      await flushPromises()

      await body().find('[data-testid="presentation-video"] video').trigger('error')
      await flushPromises()

      expect(body().find('[data-testid="presentation-video"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-media-unavailable"]').text()).toBe('Media unavailable')
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
        await flushPromises()
        await flushPromises()

        await body().find('[data-testid="presentation-video"] video').trigger('error')
        await flushPromises()

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

    it('two adjacent slides sharing the identical videoUrl still force a fresh VideoPlayer instance, so muted state never leaks across slides (WR-02)', async () => {
      window.HTMLMediaElement.prototype.play = vi
        .fn()
        .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError')) // slide 1: unmuted attempt blocked
        .mockResolvedValueOnce(undefined) // slide 1: muted retry succeeds
        .mockResolvedValue(undefined) // slide 2 onward: resolves (would also resolve on a REUSED, already-muted element — that's the bug this test catches)

      const sharedUrl = 'https://example.com/shared-clip.mp4'
      const slides = [videoSlide('v1', sharedUrl), videoSlide('v2', sharedUrl)]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      // Slide 1 went through the muted-retry path — muted chip shown, element muted.
      expect(body().find('[data-testid="presentation-muted-chip"]').exists()).toBe(true)
      const firstVideoEl = body().find('[data-testid="presentation-video"] video').element as HTMLVideoElement
      expect(firstVideoEl.muted).toBe(true)

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()

      // Slide 2 carries the SAME videoUrl. If the child instance were reused
      // (keyed on URL alone), its internal `muted` ref would still be true
      // from slide 1 — the video would keep playing silently muted with no
      // affordance at all (the discriminator never fires because play()
      // never rejects when already muted). Keying on the slide id as well
      // forces a fresh instance: a new DOM node, muted reset to false, and no
      // stale chip.
      expect(body().find('[data-testid="presentation-muted-chip"]').exists()).toBe(false)
      const secondVideoEl = body().find('[data-testid="presentation-video"] video').element as HTMLVideoElement
      expect(secondVideoEl).not.toBe(firstVideoEl)
      expect(secondVideoEl.muted).toBe(false)
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

  // ── WR-03: the slides-length watcher must route through the same
  //    pause/reset/play lifecycle as goToIndex() when a live edit clamps
  //    currentIndex onto a different slide while presenting ──
  describe('slides-length watcher (live edit clamp)', () => {
    beforeEach(() => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
      window.HTMLMediaElement.prototype.pause = vi.fn()
    })

    it('clamping currentIndex when a live edit shortens the show resets stale degraded-state flags and plays the clamped-to slide media (WR-03)', async () => {
      const slides = [
        textSlide('t1'),
        videoSlide('v2', 'https://example.com/clip2.mp4'),
        videoSlide('v3', 'https://example.com/clip3.mp4'),
      ]
      const wrapper = mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()
      await body().find('[data-testid="presentation-next"]').trigger('click')
      await flushPromises()
      expect(body().find('[data-testid="presentation-video"] video').attributes('src')).toBe(
        'https://example.com/clip3.mp4',
      )

      // v3's media fails — sets the stale mediaFailed flag this watcher must clear.
      await body().find('[data-testid="presentation-video"] video').trigger('error')
      await flushPromises()
      expect(body().find('[data-testid="presentation-media-unavailable"]').exists()).toBe(true)

      const playCallsBefore = (window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>).mock.calls.length

      // Live edit shortens the show to 2 slides — index 2 (v3) no longer
      // exists; the watcher must clamp currentIndex to 1 (v2) THROUGH the
      // pause/reset/play lifecycle, not via a bare assignment.
      await wrapper.setProps({ slides: slides.slice(0, 2) })
      await flushPromises()

      expect(body().find('[data-testid="presentation-video"] video').attributes('src')).toBe(
        'https://example.com/clip2.mp4',
      )
      // The stale mediaFailed flag from v3 must not suppress v2's fine media.
      expect(body().find('[data-testid="presentation-media-unavailable"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-video"]').exists()).toBe(true)
      // And the clamped-to slide's media must actually be driven (played),
      // not left silently unplayed.
      expect((window.HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        playCallsBefore,
      )
    })
  })

  describe('initialIndex — presenting starts where you were looking (R061)', () => {
    // `withoutSection()` keeps the progress pill in its plain "n / m" shape
    // (no `SERVICE_SECTION_LABELS` prefix), so index math is legible.
    it('mounting with initialIndex: 2 against a 5-slide deck opens on slide index 2 ("3 / 5")', async () => {
      const slides: AssembledSlide[] = [
        withoutSection(lyricSlide('a')),
        withoutSection(copyrightSlide('b')),
        withoutSection(scriptureSlide('c')),
        withoutSection(lyricSlide('d')),
        withoutSection(copyrightSlide('e')),
      ]
      mount(PresentationViewer, { props: { slides, initialIndex: 2 } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('3 / 5')
    })

    it('omitting initialIndex entirely opens on index 0 — unchanged pre-R061 behavior', async () => {
      const slides: AssembledSlide[] = [
        withoutSection(lyricSlide('a')),
        withoutSection(copyrightSlide('b')),
        withoutSection(scriptureSlide('c')),
      ]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('1 / 3')
    })

    it('initialIndex: 99 against a 3-slide deck clamps to index 2, the last slide', async () => {
      const slides: AssembledSlide[] = [
        withoutSection(lyricSlide('a')),
        withoutSection(copyrightSlide('b')),
        withoutSection(scriptureSlide('c')),
      ]
      mount(PresentationViewer, { props: { slides, initialIndex: 99 } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('3 / 3')
    })

    it('initialIndex: -1 clamps to 0', async () => {
      const slides: AssembledSlide[] = [
        withoutSection(lyricSlide('a')),
        withoutSection(copyrightSlide('b')),
        withoutSection(scriptureSlide('c')),
      ]
      mount(PresentationViewer, { props: { slides, initialIndex: -1 } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('1 / 3')
    })

    it('initialIndex: 4 against an empty deck resolves to 0 without throwing', async () => {
      expect(() => {
        mount(PresentationViewer, { props: { slides: [], initialIndex: 4 } })
      }).not.toThrow()
      await flushPromises()

      expect(body().find('[data-testid="presentation-empty-state"]').exists()).toBe(true)
    })

    it('starting mid-deck renders identical chrome to starting at 0 — no extra badge or notice', async () => {
      const slides: AssembledSlide[] = [
        withoutSection(lyricSlide('a')),
        withoutSection(copyrightSlide('b')),
        withoutSection(scriptureSlide('c')),
      ]
      mount(PresentationViewer, { props: { slides, initialIndex: 1 } })
      await flushPromises()

      // Same chrome elements as any other mount — no additional "started
      // partway through" element exists anywhere in the viewer.
      expect(body().find('[data-testid="presentation-chrome"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-exit"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-progress"]').text()).toBe('2 / 3')
      expect(body().findAll('[data-testid="presentation-progress"]')).toHaveLength(1)
    })
  })

  // ── Task 2: background rendering at presentation time (R070, UAT F3) ──────
  describe('background rendering (R070, UAT F3)', () => {
    it('a lyric slide with a resolved backgroundImageUrl renders a background element with that url inline, plus a scrim', async () => {
      const slide = withBackground(lyricSlide('a'), 'https://example.com/bg.jpg')
      mount(PresentationViewer, { props: { slides: [slide] } })
      await flushPromises()

      const bg = body().find('[data-testid="presentation-background"]')
      expect(bg.exists()).toBe(true)
      expect(bg.attributes('style')).toContain('https://example.com/bg.jpg')
      expect(body().find('[data-testid="presentation-background-scrim"]').exists()).toBe(true)
    })

    it("the same slide's text still renders unchanged", async () => {
      const slide = withBackground(lyricSlide('a'), 'https://example.com/bg.jpg')
      mount(PresentationViewer, { props: { slides: [slide] } })
      await flushPromises()

      const text = body().find('[data-testid="presentation-body"]').text()
      expect(text).toContain('Amazing grace, how sweet the sound')
      expect(text).toContain('That saved a wretch like me')
    })

    it('a slide with no resolved backgroundImageUrl renders neither the background nor scrim element', async () => {
      mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-background"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-background-scrim"]').exists()).toBe(false)
    })

    it('a video slide carrying a resolved background renders neither background element while still rendering presentation-video', async () => {
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
      window.HTMLMediaElement.prototype.pause = vi.fn()
      const slide = withBackground(videoSlide('v1', 'https://example.com/clip.mp4'), 'https://example.com/bg.jpg')
      mount(PresentationViewer, { props: { slides: [slide] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-background"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-background-scrim"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-video"]').exists()).toBe(true)
    })

    it('a congregational scripture slide with a background renders the background AND its one section', async () => {
      const section = { speaker: 'LEADER' as const, text: 'Give thanks to the LORD, for he is good.' }
      const slide = withBackground(congregationalScriptureSlide('a', section), 'https://example.com/bg.jpg')
      mount(PresentationViewer, { props: { slides: [slide] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-background"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-speaker"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-congregational-section"]').text()).toBe(
        `${section.text} (ESV)`,
      )
    })

    it('advancing from a slide with a background to a slide without one removes both elements', async () => {
      const slides = [withBackground(lyricSlide('a'), 'https://example.com/bg.jpg'), copyrightSlide('b')]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-background"]').exists()).toBe(true)

      await body().find('[data-testid="presentation-next"]').trigger('click')
      expect(body().find('[data-testid="presentation-background"]').exists()).toBe(false)
      expect(body().find('[data-testid="presentation-background-scrim"]').exists()).toBe(false)
    })

    it('advancing between two slides with different backgrounds updates the url', async () => {
      const slides = [
        withBackground(lyricSlide('a'), 'https://example.com/bg1.jpg'),
        withBackground(copyrightSlide('b'), 'https://example.com/bg2.jpg'),
      ]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-background"]').attributes('style')).toContain('bg1.jpg')

      await body().find('[data-testid="presentation-next"]').trigger('click')
      expect(body().find('[data-testid="presentation-background"]').attributes('style')).toContain('bg2.jpg')
    })

    it('a slide whose backgroundSource is \'slide\' renders that slide\'s own url; a slide whose backgroundSource is \'group\' renders the url it inherited — the viewer distinguished nothing, it just rendered what it was given', async () => {
      const slides = [
        withBackground(lyricSlide('a'), 'https://example.com/own.jpg', 'slide'),
        withBackground(copyrightSlide('b'), 'https://example.com/inherited.jpg', 'group'),
      ]
      mount(PresentationViewer, { props: { slides } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-background"]').attributes('style')).toContain('own.jpg')

      await body().find('[data-testid="presentation-next"]').trigger('click')
      expect(body().find('[data-testid="presentation-background"]').attributes('style')).toContain('inherited.jpg')
    })
  })

  // ── 46-04 Task 2/3: the R094 presenter first-paint font-load gate ──────────
  describe('R094 presenter font-load gate', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('font gate: holds presentation-loading and keeps presentation-slide absent while the font-load promise is pending, then releases once it resolves', async () => {
      const { resolve } = stubPendingFonts()
      mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-loading"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(false)

      resolve()
      await flushPromises()

      expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-loading"]').exists()).toBe(false)
    })

    it('font gate: proceeds after the bounded FONT_LOAD_TIMEOUT_MS timeout even when the font-load promise never resolves', async () => {
      vi.useFakeTimers()
      stubPendingFonts()
      mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
      await vi.advanceTimersByTimeAsync(0)

      expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(false)

      await vi.advanceTimersByTimeAsync(FONT_LOAD_TIMEOUT_MS)

      expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(true)
    })

    it('font gate: a non-default chosen family triggers loadFontCss for that family/weight before rendering', async () => {
      mockSlideTypography = { fontFamily: 'Lora', fontWeight: 600, fontScale: 'md' }
      mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
      await flushPromises()

      expect(loadFontCss).toHaveBeenCalledWith('Lora', 600)
      expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(true)
    })

    it('font gate: the default (Inter/400) chosen family never calls loadFontCss — it is already eager-imported', async () => {
      mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
      await flushPromises()

      expect(loadFontCss).not.toHaveBeenCalled()
      expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(true)
    })

    it('font gate: does not hold the empty state hostage — isEmptyState renders immediately regardless of font-load progress', async () => {
      stubPendingFonts()
      mount(PresentationViewer, { props: { slides: [] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-empty-state"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-loading"]').exists()).toBe(false)
    })

    // CR-02 (46-REVIEW.md): a rejected loadFontCss (e.g. a stale-chunk
    // deploy or flaky venue Wi-Fi failing the dynamic CSS import) must
    // release the gate — never permanently strand fontReady at false.
    // Distinct from the timeout test above: this promise REJECTS, it
    // never merely stalls.
    it('font gate: releases fontReady when loadFontCss REJECTS — never permanently hangs "Loading slideshow…"', async () => {
      mockSlideTypography = { fontFamily: 'Lora', fontWeight: 600, fontScale: 'md' }
      vi.mocked(loadFontCss).mockRejectedValueOnce(new Error('chunk load failed'))
      mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-loading"]').exists()).toBe(false)
    })

    // CR-02: a rejected document.fonts.load() (surfaced through
    // waitForSlideFont) must degrade the same way as a timeout, not throw
    // out of the onMounted callback and leave fontReady stuck false.
    it('font gate: releases fontReady when document.fonts.load() REJECTS', async () => {
      Object.defineProperty(document, 'fonts', {
        value: {
          ready: Promise.resolve(),
          load: vi.fn().mockRejectedValue(new Error('font decode error')),
        },
        configurable: true,
        writable: true,
      })
      mount(PresentationViewer, { props: { slides: [lyricSlide('a')] } })
      await flushPromises()

      expect(body().find('[data-testid="presentation-slide"]').exists()).toBe(true)
      expect(body().find('[data-testid="presentation-loading"]').exists()).toBe(false)
    })
  })
})
