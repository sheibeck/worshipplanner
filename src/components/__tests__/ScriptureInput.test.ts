import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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
}))

vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: vi.fn(() => Promise.resolve('Mocked passage text')),
}))

vi.mock('@/utils/claudeApi', () => ({
  getScriptureSuggestions: vi.fn(() => Promise.resolve(null)),
}))

describe('ScriptureInput', () => {
  const defaultProps = {
    modelValue: null,
    sermonPassage: null,
    showOverlapWarning: true,
    label: 'Scripture Reading',
  }

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
      expect(input.element.value).toBe('Isaiah 53:1-6')
    })

    it('populates text input with chapter only when no verses in modelValue', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3 },
        },
      })
      const input = wrapper.find('input[type="text"]')
      expect(input.element.value).toBe('John 3')
    })

    it('populates text input with single verse when only verseStart set', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'Romans', chapter: 8, verseStart: 28 },
        },
      })
      const input = wrapper.find('input[type="text"]')
      expect(input.element.value).toBe('Romans 8:28')
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
      expect(input.element.value).toBe('')
    })
  })
})
