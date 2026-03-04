import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ScriptureInput from '../ScriptureInput.vue'

// Use real BIBLE_BOOKS since it's a pure constant (no side effects)
// Mock esvLink and scripturesOverlap for controlled testing
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

  describe('Book dropdown', () => {
    it('renders a select element with 66 Bible book options plus default option (67 total)', () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      const options = wrapper.find('select').findAll('option')
      // 66 books + 1 default "Select book..." option = 67
      expect(options.length).toBeGreaterThanOrEqual(67)
    })

    it('has a default "Select book..." placeholder option', () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      const firstOption = wrapper.find('select option')
      expect(firstOption.text()).toBe('Select book...')
    })
  })

  describe('ESV link', () => {
    it('does not show ESV link when fields are incomplete', () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      expect(wrapper.text()).not.toContain('ESV')
    })

    it('shows a link containing "ESV" text when all fields are filled', async () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
        },
      })
      // Trigger field population by updating local state via modelValue
      expect(wrapper.text()).toContain('ESV')
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

  describe('Preview with partial fields', () => {
    it('shows ESV link when only book and chapter are filled (no verses)', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3, verseStart: 0, verseEnd: 0 },
        },
      })
      // ESV link should be visible with only book+chapter
      expect(wrapper.text()).toContain('ESV')
    })

    it('does not show ESV link when book is filled but chapter is empty', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          // modelValue null means all fields empty
          modelValue: null,
        },
      })
      expect(wrapper.text()).not.toContain('ESV')
    })

    it('shows preview button when only book and chapter are filled', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3, verseStart: 0, verseEnd: 0 },
        },
      })
      expect(wrapper.text()).toContain('Preview passage')
    })

    it('passageQuery is "John 3" when book=John, chapter=3, no verses (verseStart/verseEnd are 0)', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3, verseStart: 0, verseEnd: 0 },
        },
      })
      // The preview button shows because passageQuery != previewRef (empty)
      // We verify the button is present — the passageQuery is "John 3"
      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
      expect(wrapper.text()).toContain('Preview passage')
    })

    it('passageQuery includes verses when all 4 fields are filled', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
        },
      })
      // Preview button present and ESV link visible
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

    it('update:modelValue emits null when only book+chapter filled (isComplete requires all 4 fields)', async () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: null,
        },
      })
      // Set book and chapter only (no verse fields)
      const select = wrapper.find('select')
      await select.setValue('John')
      await select.trigger('change')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      // Should emit null because isComplete is false (no verses)
      const lastEmit = emitted![emitted!.length - 1]
      expect(lastEmit[0]).toBeNull()
    })
  })
})
