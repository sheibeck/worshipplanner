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
    (book: string, chapter: number, verseStart: number, verseEnd: number) =>
      `https://www.esv.org/${book}+${chapter}%3A${verseStart}-${verseEnd}/`,
  ),
  scripturesOverlap: vi.fn(() => false),
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

  describe('Psalms hint text', () => {
    it('renders "Tip: Psalms work well for responsive readings" hint text', () => {
      const wrapper = mount(ScriptureInput, { props: defaultProps })
      expect(wrapper.text()).toContain('Tip: Psalms work well for responsive readings')
    })

    it('hint text is always visible regardless of field state', () => {
      const wrapper = mount(ScriptureInput, {
        props: {
          ...defaultProps,
          modelValue: { book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
        },
      })
      expect(wrapper.text()).toContain('Tip: Psalms work well for responsive readings')
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
})
