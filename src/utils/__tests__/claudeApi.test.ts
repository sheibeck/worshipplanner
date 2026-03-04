import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mockCreate is available at mock factory hoisting time
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn()
  return { mockCreate }
})

// Mock import.meta.env
vi.stubEnv('VITE_CLAUDE_API_KEY', 'test-key')

// Mock the Anthropic SDK using the hoisted mockCreate
vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return {
      messages: {
        create: mockCreate,
      },
    }
  }
  return {
    default: MockAnthropic,
  }
})

import {
  safeParseJsonArray,
  validateSongSuggestions,
  validateScriptureSuggestions,
  getSongSuggestions,
  getScriptureSuggestions,
} from '@/utils/claudeApi'
import type { AiSongSuggestion, AiScriptureSuggestion } from '@/utils/claudeApi'

describe('safeParseJsonArray', () => {
  it('parses clean JSON array', () => {
    const result = safeParseJsonArray('[ {"a":1} ]')
    expect(result).toEqual([{ a: 1 }])
  })

  it('extracts JSON array from prose-wrapped response', () => {
    const result = safeParseJsonArray('Here are results: [{"a":1}]')
    expect(result).toEqual([{ a: 1 }])
  })

  it('returns null when no JSON array present', () => {
    const result = safeParseJsonArray('no json here')
    expect(result).toBeNull()
  })

  it('extracts JSON array from markdown code fences', () => {
    const result = safeParseJsonArray('```json\n[{"a":1}]\n```')
    expect(result).toEqual([{ a: 1 }])
  })

  it('returns null for empty string', () => {
    const result = safeParseJsonArray('')
    expect(result).toBeNull()
  })

  it('returns null for plain object (not array)', () => {
    const result = safeParseJsonArray('{"a":1}')
    expect(result).toBeNull()
  })

  it('parses nested objects in array', () => {
    const result = safeParseJsonArray('[{"songId":"abc","reason":"Good match"}]')
    expect(result).toEqual([{ songId: 'abc', reason: 'Good match' }])
  })
})

describe('validateSongSuggestions', () => {
  const songs = [
    { id: 'song-1' },
    { id: 'song-2' },
    { id: 'song-3' },
  ]

  it('filters out suggestions with songId not in provided song list (hallucinated IDs)', () => {
    const suggestions: AiSongSuggestion[] = [
      { songId: 'hallucinated-id', reason: 'Thematic match' },
      { songId: 'song-1', reason: 'Valid match' },
    ]
    const result = validateSongSuggestions(suggestions, songs)
    expect(result).toHaveLength(1)
    expect(result[0].songId).toBe('song-1')
  })

  it('keeps suggestions whose songId matches a provided song', () => {
    const suggestions: AiSongSuggestion[] = [
      { songId: 'song-1', reason: 'Call to worship' },
      { songId: 'song-2', reason: 'Intimate praise' },
      { songId: 'song-3', reason: 'Ascription' },
    ]
    const result = validateSongSuggestions(suggestions, songs)
    expect(result).toHaveLength(3)
  })

  it('returns empty array when all suggestions are hallucinated', () => {
    const suggestions: AiSongSuggestion[] = [
      { songId: 'fake-1', reason: 'Hallucinated' },
      { songId: 'fake-2', reason: 'Also hallucinated' },
    ]
    const result = validateSongSuggestions(suggestions, songs)
    expect(result).toHaveLength(0)
  })

  it('returns empty array when input is empty', () => {
    const result = validateSongSuggestions([], songs)
    expect(result).toHaveLength(0)
  })
})

describe('validateScriptureSuggestions', () => {
  it('filters out suggestions with book not in BIBLE_BOOKS', () => {
    const suggestions: AiScriptureSuggestion[] = [
      {
        book: 'Psalm 151',
        chapter: 1,
        verseStart: 1,
        verseEnd: 7,
        reason: 'Invalid book',
        recentlyUsed: false,
        weeksAgoUsed: null,
      },
    ]
    const result = validateScriptureSuggestions(suggestions)
    expect(result).toHaveLength(0)
  })

  it('keeps suggestions whose book is in BIBLE_BOOKS', () => {
    const suggestions: AiScriptureSuggestion[] = [
      {
        book: 'Psalms',
        chapter: 23,
        verseStart: 1,
        verseEnd: 6,
        reason: 'Shepherd psalm',
        recentlyUsed: false,
        weeksAgoUsed: null,
      },
      {
        book: 'Romans',
        chapter: 8,
        verseStart: 28,
        verseEnd: 39,
        reason: 'Nothing separates us',
        recentlyUsed: true,
        weeksAgoUsed: 3,
      },
    ]
    const result = validateScriptureSuggestions(suggestions)
    expect(result).toHaveLength(2)
  })

  it('filters mixed valid and invalid books', () => {
    const suggestions: AiScriptureSuggestion[] = [
      {
        book: 'Psalms',
        chapter: 23,
        verseStart: 1,
        verseEnd: 6,
        reason: 'Valid',
        recentlyUsed: false,
        weeksAgoUsed: null,
      },
      {
        book: 'Hezekiah',
        chapter: 1,
        verseStart: 1,
        verseEnd: 5,
        reason: 'Invalid book',
        recentlyUsed: false,
        weeksAgoUsed: null,
      },
    ]
    const result = validateScriptureSuggestions(suggestions)
    expect(result).toHaveLength(1)
    expect(result[0].book).toBe('Psalms')
  })

  it('returns empty array when input is empty', () => {
    const result = validateScriptureSuggestions([])
    expect(result).toHaveLength(0)
  })
})

describe('getSongSuggestions', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns null when API throws an error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Unauthorized'))

    const result = await getSongSuggestions({
      sermonTopic: 'Grace',
      sermonPassage: null,
      slotVwType: 1,
      alreadySelectedSongIds: [],
      songLibrary: [{ id: 'song-1', title: 'Amazing Grace', vwType: 1, themes: [], lastUsedAt: null }],
      recentServiceSongIds: [],
    })

    expect(result).toBeNull()
  })

  it('returns validated array when API returns valid JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '[{"songId":"song-1","reason":"Matches grace theme"}]',
        },
      ],
    })

    const result = await getSongSuggestions({
      sermonTopic: 'Grace',
      sermonPassage: null,
      slotVwType: 1,
      alreadySelectedSongIds: [],
      songLibrary: [{ id: 'song-1', title: 'Amazing Grace', vwType: 1, themes: [], lastUsedAt: null }],
      recentServiceSongIds: [],
    })

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].songId).toBe('song-1')
    expect(result![0].reason).toBe('Matches grace theme')
  })

  it('returns null when API returns response with no valid JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'I cannot suggest songs at this time.',
        },
      ],
    })

    const result = await getSongSuggestions({
      sermonTopic: 'Grace',
      sermonPassage: null,
      slotVwType: 1,
      alreadySelectedSongIds: [],
      songLibrary: [],
      recentServiceSongIds: [],
    })

    expect(result).toBeNull()
  })

  it('returns null when validated results are empty (all hallucinated IDs)', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '[{"songId":"hallucinated-id","reason":"Hallucinated"}]',
        },
      ],
    })

    const result = await getSongSuggestions({
      sermonTopic: 'Grace',
      sermonPassage: null,
      slotVwType: 1,
      alreadySelectedSongIds: [],
      songLibrary: [{ id: 'real-song', title: 'Real Song', vwType: 1, themes: [], lastUsedAt: null }],
      recentServiceSongIds: [],
    })

    expect(result).toBeNull()
  })
})

describe('getScriptureSuggestions', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns null when API throws an error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Network error'))

    const result = await getScriptureSuggestions({
      sermonTopic: 'Forgiveness',
      sermonPassage: null,
      query: 'passages about forgiveness',
      recentScriptures: [],
    })

    expect(result).toBeNull()
  })

  it('returns validated array when API returns valid JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '[{"book":"Psalms","chapter":103,"verseStart":1,"verseEnd":12,"reason":"God forgives all our sins","recentlyUsed":false,"weeksAgoUsed":null}]',
        },
      ],
    })

    const result = await getScriptureSuggestions({
      sermonTopic: 'Forgiveness',
      sermonPassage: null,
      query: 'passages about forgiveness',
      recentScriptures: [],
    })

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].book).toBe('Psalms')
    expect(result![0].chapter).toBe(103)
  })

  it('returns null when API returns response with invalid book names', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '[{"book":"Hezekiah","chapter":1,"verseStart":1,"verseEnd":5,"reason":"Invalid book","recentlyUsed":false,"weeksAgoUsed":null}]',
        },
      ],
    })

    const result = await getScriptureSuggestions({
      sermonTopic: 'Forgiveness',
      sermonPassage: null,
      query: 'forgiveness passages',
      recentScriptures: [],
    })

    expect(result).toBeNull()
  })

  it('returns null when API returns response with no valid JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'No suggestions available.',
        },
      ],
    })

    const result = await getScriptureSuggestions({
      sermonTopic: 'Forgiveness',
      sermonPassage: null,
      query: 'forgiveness',
      recentScriptures: [],
    })

    expect(result).toBeNull()
  })
})
