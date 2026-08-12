import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ScriptureInput from '../ScriptureInput.vue'

// Use real BIBLE_BOOKS since it's a pure constant (no side effects)
// Mock esvLink, scripturesOverlap, and parseScriptureInput for controlled testing
vi.mock('@/utils/scripture', () => ({
  BIBLE_BOOKS: [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
    'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
    'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
    'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
    'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
    '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
    'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation',
  ],
  esvLink: vi.fn(
    (book: string, chapter: number) =>
      `https://www.esv.org/${book}+${chapter}`,
  ),
  nltLink: vi.fn(
    (book: string, chapter: number) =>
      `https://www.biblegateway.com/passage/?search=${book}+${chapter}&version=NLT`,
  ),
  // Version-aware reader link — routes by the church's bibleVersion so an NLT
  // church's "View on ..." link lands on BibleGateway, not ESV.org.
  scriptureWebLink: vi.fn(
    (book: string, chapter: number, version: 'ESV' | 'NLT') =>
      version === 'NLT'
        ? `https://www.biblegateway.com/passage/?search=${book}+${chapter}&version=NLT`
        : `https://www.esv.org/${book}+${chapter}`,
  ),
  scripturesOverlap: vi.fn(() => false),
  // Use a simple real implementation so component behaviour is testable
  parseScriptureInput: vi.fn((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return null
    const match = trimmed.match(/^(.+?)\s+(\d+)(?::(.+))?$/)
    if (!match) return null
    const [, bookToken, chapterToken, verseExpr] = match
    const BOOKS = [
      'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
      'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
      '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
      'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
      'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
      'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
      'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
      'Haggai', 'Zechariah', 'Malachi',
      'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
      '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
      'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
      '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
      'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
      'Jude', 'Revelation',
    ]
    const inputLower = bookToken!.trim().toLowerCase()
    const exactMatch = BOOKS.find((b) => b.toLowerCase() === inputLower)
    let resolvedBook: string | null = null
    if (exactMatch) {
      resolvedBook = exactMatch
    } else {
      if (inputLower.length < 4) return null
      const prefixMatches = BOOKS.filter((b) => b.toLowerCase().startsWith(inputLower))
      if (prefixMatches.length === 1) resolvedBook = prefixMatches[0]!
      else return null
    }
    const chapter = parseInt(chapterToken!, 10)
    if (isNaN(chapter) || chapter <= 0) return null
    let verseStart: number | undefined
    let verseEnd: number | undefined
    if (verseExpr !== undefined) {
      const nums = (verseExpr.trim().match(/\d+/g) ?? []).map(Number)
      if (nums.length === 0) return null
      if (nums.length === 1) { verseStart = nums[0] }
      else { verseStart = Math.min(...nums); verseEnd = Math.max(...nums) }
    }
    const result: Record<string, unknown> = { book: resolvedBook, chapter }
    if (verseStart !== undefined) result.verseStart = verseStart
    if (verseEnd !== undefined) result.verseEnd = verseEnd
    return result
  }),
  // W-02: the component now delegates its input formatting here rather than
  // keeping a private fourth copy. Real implementation, including HI-02's
  // collapse of a degenerate `16-16` range to `16`.
  formatScriptureReference: vi.fn(
    (ref: { book: string; chapter: number; verseStart?: number; verseEnd?: number }) => {
      if (ref.verseStart && ref.verseEnd && ref.verseEnd !== ref.verseStart) {
        return `${ref.book} ${ref.chapter}:${ref.verseStart}-${ref.verseEnd}`
      }
      if (ref.verseStart) return `${ref.book} ${ref.chapter}:${ref.verseStart}`
      return `${ref.book} ${ref.chapter}`
    },
  ),
}))

vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: vi.fn(() => Promise.resolve('Mocked passage text')),
}))

// 45-04: sibling mock to the ESV client above, for the NLT routing path.
vi.mock('@/utils/nltApi', () => ({
  fetchNltPassageText: vi.fn(() => Promise.resolve('Mocked passage text')),
}))

vi.mock('@/utils/claudeApi', () => ({
  getScriptureSuggestions: vi.fn(() => Promise.resolve(null)),
}))

// This component did not use the auth store before 39-04. Getter-mock
// precedent: src/components/__tests__/SongTable.test.ts:39. Defaults to
// `true`/`'ESV'` so every pre-existing test in this file keeps its current
// behavior — none of them mounted with showAiSuggest before this phase, and
// every pre-45-04 preview-fetch test asserts against the ESV mock.
let mockAiEnabled = true
let mockBibleVersion: 'ESV' | 'NLT' = 'ESV'
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    settings: {
      get aiEnabled() {
        return mockAiEnabled
      },
      get bibleVersion() {
        return mockBibleVersion
      },
    },
  }),
}))

beforeEach(() => {
  // Only clears call/result history, not the default implementations set
  // via the vi.fn(() => ...) factories above — those stay intact.
  vi.clearAllMocks()
})

afterEach(() => {
  mockAiEnabled = true
  mockBibleVersion = 'ESV'
})

describe('ScriptureInput', () => {
  const defaultProps = {
    modelValue: null,
    sermonPassage: null,
    showOverlapWarning: true,
    label: 'Scripture Reading',
  }

  // W-02: this component held a FOURTH private copy of the reference
  // formatter. Phase 30 consolidated the other three, and HI-02's collapse of a
  // degenerate `16-16` range then left this one disagreeing with the Slides
  // rail, the projected slide and the Planning Center export.
  describe('W-02 — the input renders the canonical reference form', () => {
    // `find()` returns DOMWrapper<Element>, whose `element` has no `.value`.
    // The generic is required for `vue-tsc --build`; `-p tsconfig.app.json`
    // does not typecheck this file, which is how the original omission shipped.
    const inputValue = (w: ReturnType<typeof mount>) =>
      w.find<HTMLInputElement>('input[type="text"]').element.value

    it('collapses a degenerate range, matching every other surface', () => {
      const wrapper = mount(ScriptureInput, {
        props: { ...defaultProps, modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 } },
      })
      expect(inputValue(wrapper)).toBe('John 3:16')
    })

    it('renders a real range unchanged', () => {
      const wrapper = mount(ScriptureInput, {
        props: { ...defaultProps, modelValue: { book: 'Isaiah', chapter: 53, verseStart: 1, verseEnd: 6 } },
      })
      expect(inputValue(wrapper)).toBe('Isaiah 53:1-6')
    })

    it('renders a single-verse and a whole-chapter reference', () => {
      const single = mount(ScriptureInput, {
        props: { ...defaultProps, modelValue: { book: 'Romans', chapter: 8, verseStart: 28 } },
      })
      expect(inputValue(single)).toBe('Romans 8:28')

      const chapter = mount(ScriptureInput, {
        props: { ...defaultProps, modelValue: { book: 'Psalms', chapter: 103 } },
      })
      expect(inputValue(chapter)).toBe('Psalms 103')
    })

    it('renders empty for a null reference', () => {
      const wrapper = mount(ScriptureInput, { props: { ...defaultProps, modelValue: null } })
      expect(inputValue(wrapper)).toBe('')
    })
  })

  describe('Freeform text input', () => {
    it('renders a single text input (no select element)', () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      expect(wrapper.find('select').exists()).toBe(false)
      expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    })

    it('shows placeholder text for Scripture Reading label', () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      const input = wrapper.find('input[type="text"]')
      expect(input.attributes('placeholder')).toContain('Isaiah 53:1-6')
    })

    it('shows placeholder text for Sermon Passage label', () => {
      const wrapper = mount(ScriptureInput, {
        props: { ...defaultProps, label: 'Sermon Passage' },
      })
      const input = wrapper.find('input[type="text"]')
      expect(input.attributes('placeholder')).toContain('Romans 8:28')
    })

    it('typing "Isaiah 53:1-6" emits the correct ScriptureRef', async () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      const input = wrapper.find('input[type="text"]')
      await input.setValue('Isaiah 53:1-6')
      await input.trigger('input')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      const lastEmit = emitted![emitted!.length - 1]!
      expect(lastEmit[0]).toEqual({ book: 'Isaiah', chapter: 53, verseStart: 1, verseEnd: 6 })
    })

    it('typing "Romans 8:28" emits ScriptureRef with single verse', async () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      const input = wrapper.find('input[type="text"]')
      await input.setValue('Romans 8:28')
      await input.trigger('input')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      const lastEmit = emitted![emitted!.length - 1]!
      expect(lastEmit[0]).toEqual({ book: 'Romans', chapter: 8, verseStart: 28 })
    })

    it('typing "John 3" emits ScriptureRef with book and chapter only', async () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      const input = wrapper.find('input[type="text"]')
      await input.setValue('John 3')
      await input.trigger('input')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      const lastEmit = emitted![emitted!.length - 1]!
      expect(lastEmit[0]).toEqual({ book: 'John', chapter: 3 })
    })

    it('typing junk text emits null and shows parse error', async () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      const input = wrapper.find('input[type="text"]')
      await input.setValue('junk text here')
      await input.trigger('input')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      const lastEmit = emitted![emitted!.length - 1]!
      expect(lastEmit[0]).toBeNull()
      expect(wrapper.text()).toContain('Unrecognized reference')
    })

    it('clearing the input emits null with no parse error', async () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      const input = wrapper.find('input[type="text"]')
      await input.setValue('')
      await input.trigger('input')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      const lastEmit = emitted![emitted!.length - 1]!
      expect(lastEmit[0]).toBeNull()
      expect(wrapper.text()).not.toContain('Unrecognized reference')
    })
  })

  describe('ESV link', () => {
    it('does not show ESV link when input is empty', () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      expect(wrapper.text()).not.toContain('ESV')
    })

    it('shows a link containing "ESV" text when modelValue has book and chapter', async () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
        },
      })
      expect(wrapper.text()).toContain('ESV')
    })

    it('shows ESV link when modelValue has only book+chapter (no verses)', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3 },
        },
      })
      expect(wrapper.text()).toContain('ESV')
    })

    it('does not show ESV link when modelValue is null', () => {
      const wrapper = mount(ScriptureInput, {
        props: { ...defaultProps, modelValue: null },
      })
      expect(wrapper.text()).not.toContain('ESV')
    })

    it('shows a BibleGateway (NLT) link, not ESV.org, when bibleVersion=NLT', () => {
      mockBibleVersion = 'NLT'
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 },
        },
      })
      expect(wrapper.text()).toContain('View on BibleGateway')
      expect(wrapper.text()).not.toContain('ESV')
      const link = wrapper.find('a[target="_blank"]')
      expect(link.attributes('href')).toContain('version=NLT')
      expect(link.attributes('href')).toContain('biblegateway.com')
    })

    it('the per-item bibleVersion override drives the reader link, overriding the org default (2026-08-12)', async () => {
      mockBibleVersion = 'ESV' // church default is ESV…
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 },
          bibleVersion: 'NLT', // …but this item overrides to NLT
        },
      })
      // …so the reader link follows the override, not the org default.
      expect(wrapper.text()).toContain('View on BibleGateway')
      const link = wrapper.find('a[target="_blank"]')
      expect(link.attributes('href')).toContain('version=NLT')

      // Changing the override back to ESV updates the link live.
      await wrapper.setProps({ bibleVersion: 'ESV' })
      expect(wrapper.text()).toContain('View on ESV.org')
      expect(wrapper.find('a[target="_blank"]').attributes('href')).toContain('esv.org')
    })
  })

  describe('Overlap warning', () => {
    it('shows overlap warning when showOverlapWarning=true and overlap is detected', async () => {
      const { scripturesOverlap } = await import('@/utils/scripture')
      vi.mocked(scripturesOverlap).mockReturnValue(true)

      const wrapper = mount(ScriptureInput, {
        props: {
          modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
          sermonPassage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
          showOverlapWarning: true,
          label: 'Scripture Reading',
        },
      })

      expect(wrapper.text()).toContain('overlaps with the sermon passage')

      vi.mocked(scripturesOverlap).mockReturnValue(false)
    })

    it('does not show overlap warning when showOverlapWarning=false even with overlapping passages', async () => {
      const { scripturesOverlap } = await import('@/utils/scripture')
      vi.mocked(scripturesOverlap).mockReturnValue(true)

      const wrapper = mount(ScriptureInput, {
        props: {
          modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
          sermonPassage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
          showOverlapWarning: false,
          label: 'Scripture Reading',
        },
      })

      expect(wrapper.text()).not.toContain('overlaps with the sermon passage')

      vi.mocked(scripturesOverlap).mockReturnValue(false)
    })
  })

  describe('Preview dismiss', () => {
    it('close button dismisses the preview panel and re-shows the Preview passage button', async () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
        },
      })

      // Preview passage button should be visible
      const previewBtn = wrapper.findAll('button').find((b) => b.text().includes('Preview passage'))
      expect(previewBtn).toBeTruthy()
      await previewBtn!.trigger('click')

      // Wait for async fetch to resolve
      await nextTick()
      await flushPromises()

      // Passage text should be visible
      expect(wrapper.text()).toContain('Mocked passage text')

      // Close button should exist
      const closeBtn = wrapper.find('button[aria-label="Close preview"]')
      expect(closeBtn.exists()).toBe(true)
      await closeBtn.trigger('click')
      await nextTick()

      // Passage text should be gone
      expect(wrapper.text()).not.toContain('Mocked passage text')

      // Preview passage button should be visible again
      expect(wrapper.text()).toContain('Preview passage')
    })
  })

  describe('Preview passage', () => {
    it('shows preview button when book and chapter are present', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3 },
        },
      })
      expect(wrapper.text()).toContain('Preview passage')
    })

    it('shows preview button when all 4 fields are filled', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
        },
      })
      expect(wrapper.text()).toContain('Preview passage')
      expect(wrapper.text()).toContain('ESV')
    })

    it('ESV link is still visible when all 4 fields are filled', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
        },
      })
      expect(wrapper.text()).toContain('ESV')
    })
  })

  describe('modelValue population', () => {
    it('populates text input from modelValue on mount', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'Isaiah', chapter: 53, verseStart: 1, verseEnd: 6 },
        },
      })
      const input = wrapper.find('input[type="text"]')
      expect((input.element as HTMLInputElement).value).toBe('Isaiah 53:1-6')
    })

    it('populates text input with chapter only when no verses in modelValue', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3 },
        },
      })
      const input = wrapper.find('input[type="text"]')
      expect((input.element as HTMLInputElement).value).toBe('John 3')
    })

    it('populates text input with single verse when only verseStart set', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'Romans', chapter: 8, verseStart: 28 },
        },
      })
      const input = wrapper.find('input[type="text"]')
      expect((input.element as HTMLInputElement).value).toBe('Romans 8:28')
    })

    it('clears text input when modelValue becomes null externally', async () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3 },
        },
      })
      await wrapper.setProps({ modelValue: null })
      const input = wrapper.find('input[type="text"]')
      expect((input.element as HTMLInputElement).value).toBe('')
    })
  })
})

// 39-04: the AI scripture discovery block is AND-composed with the existing
// showAiSuggest prop, not replaced by it — showAiSuggest already scopes this
// block to reading slots only.
describe('AI toggle (39-04)', () => {
  const readingSlotProps = {
    modelValue: null,
    sermonPassage: null,
    showOverlapWarning: true,
    showAiSuggest: true,
    label: 'Scripture Reading',
  }

  it('renders the AI block for a reading slot when the AI toggle is on', () => {
    mockAiEnabled = true
    const wrapper = mount(ScriptureInput, { props: readingSlotProps })
    expect(wrapper.find('input[placeholder^="Search passages"]').exists()).toBe(true)
  })

  it('hides the AI block for a reading slot when the AI toggle is off, and the freeform text input is the first rendered element', () => {
    mockAiEnabled = false
    const wrapper = mount(ScriptureInput, { props: readingSlotProps })
    expect(wrapper.find('input[placeholder^="Search passages"]').exists()).toBe(false)
    const firstInput = wrapper.find('input')
    expect(firstInput.attributes('placeholder')).not.toMatch(/^Search passages/)
  })
})

// 45-04 Task 2: the preview fetch (both the reference-preview panel and the
// AI-suggestion expanded preview) routes to nltApi/esvApi by the church's
// bibleVersion setting — preview-only, nothing persisted, no
// translationSource stamping (that is CongregationalEditor.vue's job, Task
// 1). R090.
describe('ESV/NLT preview routing (45-04, R090)', () => {
  const defaultProps = {
    modelValue: null,
    sermonPassage: null,
    showOverlapWarning: true,
    label: 'Scripture Reading',
  }

  it('bibleVersion=ESV (default in this mock) routes the preview fetch to esvApi, not nltApi', async () => {
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const wrapper = mount(ScriptureInput, {
      props: { ...defaultProps, modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 } },
    })
    const previewBtn = wrapper.findAll('button').find((b) => b.text().includes('Preview passage'))
    await previewBtn!.trigger('click')
    await flushPromises()

    expect(fetchPassageText).toHaveBeenCalledWith('John 3:16-17')
    expect(fetchNltPassageText).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Mocked passage text')
  })

  it('bibleVersion=NLT routes the preview fetch to nltApi, not esvApi', async () => {
    mockBibleVersion = 'NLT'
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const wrapper = mount(ScriptureInput, {
      props: { ...defaultProps, modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 } },
    })
    const previewBtn = wrapper.findAll('button').find((b) => b.text().includes('Preview passage'))
    await previewBtn!.trigger('click')
    await flushPromises()

    expect(fetchNltPassageText).toHaveBeenCalledWith('John 3:16-17')
    expect(fetchPassageText).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Mocked passage text')
  })

  it('a preview fetch failure surfaces the existing previewError message unchanged, regardless of which client is routed to', async () => {
    mockBibleVersion = 'NLT'
    const { fetchNltPassageText } = await import('@/utils/nltApi')
    vi.mocked(fetchNltPassageText).mockRejectedValueOnce(new Error('boom'))

    const wrapper = mount(ScriptureInput, {
      props: { ...defaultProps, modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 } },
    })
    const previewBtn = wrapper.findAll('button').find((b) => b.text().includes('Preview passage'))
    await previewBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Could not load passage. Check your connection and try again.')
  })

  // R128 (Phase 56): a per-item bibleVersion prop overrides the org default for
  // the preview fetch; an absent prop keeps today's org-default routing.
  it('R128: prop bibleVersion=NLT routes the preview fetch to nltApi even though the org default is ESV', async () => {
    // mockBibleVersion stays 'ESV' (the org default) — the prop must win.
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const wrapper = mount(ScriptureInput, {
      props: {
        ...defaultProps,
        modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
        bibleVersion: 'NLT' as const,
      },
    })
    const previewBtn = wrapper.findAll('button').find((b) => b.text().includes('Preview passage'))
    await previewBtn!.trigger('click')
    await flushPromises()

    expect(fetchNltPassageText).toHaveBeenCalledWith('John 3:16-17')
    expect(fetchPassageText).not.toHaveBeenCalled()
  })

  it('R128: prop bibleVersion=ESV routes the preview fetch to esvApi even though the org default is NLT', async () => {
    mockBibleVersion = 'NLT'
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const wrapper = mount(ScriptureInput, {
      props: {
        ...defaultProps,
        modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
        bibleVersion: 'ESV' as const,
      },
    })
    const previewBtn = wrapper.findAll('button').find((b) => b.text().includes('Preview passage'))
    await previewBtn!.trigger('click')
    await flushPromises()

    expect(fetchPassageText).toHaveBeenCalledWith('John 3:16-17')
    expect(fetchNltPassageText).not.toHaveBeenCalled()
  })

  it('R128: no bibleVersion prop keeps the org-default (NLT) routing', async () => {
    mockBibleVersion = 'NLT'
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const wrapper = mount(ScriptureInput, {
      props: {
        ...defaultProps,
        modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
      },
    })
    const previewBtn = wrapper.findAll('button').find((b) => b.text().includes('Preview passage'))
    await previewBtn!.trigger('click')
    await flushPromises()

    expect(fetchNltPassageText).toHaveBeenCalledWith('John 3:16-17')
    expect(fetchPassageText).not.toHaveBeenCalled()
  })

  it('the AI-suggestion expanded preview also routes by the church setting (NLT)', async () => {
    mockBibleVersion = 'NLT'
    const { getScriptureSuggestions } = await import('@/utils/claudeApi')
    vi.mocked(getScriptureSuggestions).mockResolvedValueOnce([
      {
        book: 'John',
        chapter: 3,
        verseStart: 16,
        verseEnd: 17,
        reason: 'test reason',
        recentlyUsed: false,
        weeksAgoUsed: null,
      },
    ])
    const { fetchPassageText } = await import('@/utils/esvApi')
    const { fetchNltPassageText } = await import('@/utils/nltApi')

    const wrapper = mount(ScriptureInput, {
      props: {
        modelValue: null,
        sermonPassage: null,
        showOverlapWarning: true,
        showAiSuggest: true,
        label: 'Scripture Reading',
      },
    })
    await wrapper.find('input[placeholder^="Search passages"]').setValue('comfort')
    await wrapper.find('input[placeholder^="Search passages"]').trigger('keydown.enter')
    await flushPromises()

    const resultButton = wrapper.findAll('button').find((b) => b.text().includes('John'))
    await resultButton!.trigger('click')
    await flushPromises()

    expect(fetchNltPassageText).toHaveBeenCalledWith('John 3:16-17')
    expect(fetchPassageText).not.toHaveBeenCalled()
  })
})
