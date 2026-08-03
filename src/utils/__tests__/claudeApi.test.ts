import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mockCreate is available at mock factory hoisting time
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn()
  return { mockCreate }
})

// The proxy holds the real key server-side; the client only attaches an app-auth
// token. Mock the helper so unit tests don't touch Firebase Auth.
vi.mock('@/utils/appAuth', () => ({
  getAppAuthHeaders: vi.fn().mockResolvedValue({ 'X-App-Auth': 'test-token' }),
}))

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
  SPLIT_SCHEMA,
  validateSplitResult,
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
    expect(result[0]!.songId).toBe('song-1')
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
    expect(result[0]!.book).toBe('Psalms')
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
      songLibrary: [{ id: 'song-1', title: 'Amazing Grace', ccliNumber: '1234567', vwTypes: [1], themes: [], lastUsedAt: null }],
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
      songLibrary: [{ id: 'song-1', title: 'Amazing Grace', ccliNumber: '1234567', vwTypes: [1], themes: [], lastUsedAt: null }],
      recentServiceSongIds: [],
    })

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0]!.songId).toBe('song-1')
    expect(result![0]!.reason).toBe('Matches grace theme')
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
      songLibrary: [{ id: 'real-song', title: 'Real Song', ccliNumber: '1234567', vwTypes: [1], themes: [], lastUsedAt: null }],
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
    expect(result![0]!.book).toBe('Psalms')
    expect(result![0]!.chapter).toBe(103)
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

// ─── Congregational Split (34-02) — SPLIT_SCHEMA ──────────────────────────────
//
// SPLIT_SCHEMA is half of R064's entire correctness guarantee: the contract the
// model is allowed to speak must contain no field capable of carrying scripture
// words. These tests assert that structurally, not by eye.

describe('SPLIT_SCHEMA', () => {
  it('has additionalProperties: false at the root object and the per-section object', () => {
    expect(SPLIT_SCHEMA.additionalProperties).toBe(false)
    expect(SPLIT_SCHEMA.properties.sections.items.additionalProperties).toBe(false)
  })

  it('declares exactly the three expected properties on a section, all required', () => {
    const itemProps = SPLIT_SCHEMA.properties.sections.items.properties
    expect(Object.keys(itemProps).sort()).toEqual(['endBoundary', 'speaker', 'startBoundary'])
    expect([...SPLIT_SCHEMA.properties.sections.items.required].sort()).toEqual([
      'endBoundary',
      'speaker',
      'startBoundary',
    ])
    expect([...SPLIT_SCHEMA.required]).toEqual(['sections'])
  })

  it('(P-02) has no string-typed property anywhere except speaker, and speaker enum is exactly LEADER/CONGREGATION', () => {
    // A deep walk of the whole schema — not a spot-check — because P-02 says
    // there must be NO field anywhere the model could populate with scripture
    // words, including one added later without anyone re-reading this test.
    const stringTypedNodes: { path: string; node: { type: string; enum?: readonly string[] } }[] = []

    function walk(node: unknown, path: string): void {
      if (node === null || typeof node !== 'object') return
      if (Array.isArray(node)) {
        node.forEach((child, i) => walk(child, `${path}[${i}]`))
        return
      }
      const obj = node as Record<string, unknown>
      if (obj.type === 'string') {
        stringTypedNodes.push({ path, node: obj as { type: string; enum?: readonly string[] } })
      }
      for (const [key, value] of Object.entries(obj)) {
        walk(value, `${path}.${key}`)
      }
    }

    walk(SPLIT_SCHEMA, 'SPLIT_SCHEMA')

    expect(stringTypedNodes).toHaveLength(1)
    expect(stringTypedNodes[0]!.path.endsWith('.speaker')).toBe(true)
    expect(stringTypedNodes[0]!.node.enum).toEqual(['LEADER', 'CONGREGATION'])
  })

  it('declares startBoundary and endBoundary as integer type', () => {
    const itemProps = SPLIT_SCHEMA.properties.sections.items.properties
    expect(itemProps.startBoundary.type).toBe('integer')
    expect(itemProps.endBoundary.type).toBe('integer')
  })
})

// ─── Congregational Split (34-02) — validateSplitResult ───────────────────────
//
// validateSplitResult() is the sole gate between untrusted model output and
// scripture a congregation will read aloud. A happy-path-only suite would be
// the single most misleading form of green available in this phase — every
// bullet below is its own rejection test.

describe('validateSplitResult', () => {
  const boundaries = [0, 10, 20, 30] // maxIndex = 3

  it('accepts a well-formed result: ascending, gapless, alternating speakers, spanning the whole passage, and does not mutate the input', () => {
    const wellFormed = {
      sections: [
        { speaker: 'LEADER', startBoundary: 0, endBoundary: 1 },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 2 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 3 },
      ],
    }
    // Freezing every level means any attempted mutation inside
    // validateSplitResult throws (this file is compiled as an ES module,
    // which is strict-mode by default) — a structural proof of "does not
    // mutate the input," not just a before/after equality check.
    wellFormed.sections.forEach((s) => Object.freeze(s))
    Object.freeze(wellFormed.sections)
    Object.freeze(wellFormed)

    const result = validateSplitResult(wellFormed, boundaries)

    expect(result).not.toBeNull()
    expect(result).toEqual(wellFormed.sections)
  })

  it('rejects null', () => {
    expect(validateSplitResult(null, boundaries)).toBeNull()
  })

  it('rejects a non-object', () => {
    expect(validateSplitResult('not an object', boundaries)).toBeNull()
  })

  it('rejects an object with no sections key', () => {
    expect(validateSplitResult({ notSections: [] }, boundaries)).toBeNull()
  })

  it('rejects sections that is not an array', () => {
    expect(validateSplitResult({ sections: 'not-an-array' }, boundaries)).toBeNull()
  })

  it('rejects an empty sections array', () => {
    expect(validateSplitResult({ sections: [] }, boundaries)).toBeNull()
  })

  it('rejects a startBoundary below 0', () => {
    const bad = {
      sections: [
        { speaker: 'LEADER', startBoundary: -1, endBoundary: 1 },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 2 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects an endBoundary above the last valid index', () => {
    const bad = {
      sections: [
        { speaker: 'LEADER', startBoundary: 0, endBoundary: 1 },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 2 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 4 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects a non-integer float index', () => {
    const bad = {
      sections: [
        { speaker: 'LEADER', startBoundary: 0, endBoundary: 1.5 },
        { speaker: 'CONGREGATION', startBoundary: 1.5, endBoundary: 2 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects a NaN index', () => {
    const bad = {
      sections: [
        { speaker: 'LEADER', startBoundary: 0, endBoundary: Number.NaN },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 2 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects a numeric-string index', () => {
    const bad = {
      sections: [
        { speaker: 'LEADER', startBoundary: '0', endBoundary: 1 },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 2 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects a startBoundary greater than or equal to its endBoundary (inverted or zero-length)', () => {
    const bad = {
      sections: [{ speaker: 'LEADER', startBoundary: 1, endBoundary: 1 }],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects overlapping sections (section N+1 starts before section N ends)', () => {
    const bad = {
      sections: [
        { speaker: 'LEADER', startBoundary: 0, endBoundary: 2 },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects a gap (section N+1 starts after section N ends)', () => {
    const bad = {
      sections: [
        { speaker: 'LEADER', startBoundary: 0, endBoundary: 1 },
        { speaker: 'CONGREGATION', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects a result that does not start at boundary 0', () => {
    const bad = {
      sections: [
        { speaker: 'LEADER', startBoundary: 1, endBoundary: 2 },
        { speaker: 'CONGREGATION', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects a result that does not end at the last boundary index', () => {
    const bad = {
      sections: [
        { speaker: 'LEADER', startBoundary: 0, endBoundary: 1 },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 2 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects an out-of-order result, and a companion assertion proves it was not silently re-sorted to accept it', () => {
    const outOfOrder = {
      sections: [
        { speaker: 'LEADER', startBoundary: 1, endBoundary: 2 },
        { speaker: 'CONGREGATION', startBoundary: 0, endBoundary: 1 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(outOfOrder, boundaries)).toBeNull()

    // If validateSplitResult secretly sorted its input before validating, the
    // rejection above would be meaningless — it would just mean "the raw
    // input order was wrong," not "out-of-order input is rejected." This
    // proves the function truly rejects rather than repairs: the identical
    // set of sections, pre-sorted by the TEST (not by the function under
    // test), IS accepted, showing the function only ever validates the order
    // it is given and never silently re-sorts to rescue a bad result.
    const sorted = {
      sections: [...outOfOrder.sections].sort((a, b) => a.startBoundary - b.startBoundary),
    }
    expect(validateSplitResult(sorted, boundaries)).not.toBeNull()
  })

  it('rejects an unrecognised speaker value', () => {
    const bad = {
      sections: [
        { speaker: 'NARRATOR', startBoundary: 0, endBoundary: 1 },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 2 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('rejects a lowercase variant of a legal speaker value', () => {
    const bad = {
      sections: [
        { speaker: 'leader', startBoundary: 0, endBoundary: 1 },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 2 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })

  it('(P-02 defence in depth) rejects a section carrying an extra property beyond the three expected, including one carrying scripture words', () => {
    const bad = {
      sections: [
        {
          speaker: 'LEADER',
          startBoundary: 0,
          endBoundary: 1,
          text: 'For God so loved the world that he gave his only Son',
        },
        { speaker: 'CONGREGATION', startBoundary: 1, endBoundary: 2 },
        { speaker: 'LEADER', startBoundary: 2, endBoundary: 3 },
      ],
    }
    expect(validateSplitResult(bad, boundaries)).toBeNull()
  })
})
