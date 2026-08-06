import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to ensure mockCreate/mockParse are available at mock factory
// hoisting time. `messages.parse()` is a distinct SDK method from
// `messages.create()` (it wraps create() + parseMessage() internally, per the
// installed SDK's own source — see 34-03-PLAN.md's "Resolved spike"), so the
// mock needs its own key: a call to `.parse()` against a factory exposing
// only `create` would throw.
const { mockCreate, mockParse } = vi.hoisted(() => {
  const mockCreate = vi.fn()
  const mockParse = vi.fn()
  return { mockCreate, mockParse }
})

// The proxy holds the real key server-side; the client only attaches an app-auth
// token. Mock the helper so unit tests don't touch Firebase Auth.
vi.mock('@/utils/appAuth', () => ({
  getAppAuthHeaders: vi.fn().mockResolvedValue({ 'X-App-Auth': 'test-token' }),
}))

// Getter-mock precedent: src/components/__tests__/SongTable.test.ts:39. A
// module-scope mutable variable read through a getter lets a test flip the
// toggle mid-suite without re-importing the module under test. Defaults to
// true so every pre-existing test in this file keeps its current behavior.
let mockAiEnabled = true
// WR-03 (39-REVIEW) regression hook: when true, `useAuthStore()` itself
// throws (simulating "no active Pinia"), so a test can prove the isAiEnabled
// guard's own never-throw contract — the guard now runs INSIDE each gated
// export's `try` block specifically so this throw resolves to `null` instead
// of rejecting the returned promise.
let mockAuthStoreThrows = false
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => {
    if (mockAuthStoreThrows) {
      throw new Error('no active Pinia')
    }
    return {
      settings: {
        get aiEnabled() {
          return mockAiEnabled
        },
      },
    }
  },
}))

// Reset unconditionally after every test so a toggle-off case in one describe
// block can never leak into an unrelated test regardless of run order.
afterEach(() => {
  mockAiEnabled = true
  mockAuthStoreThrows = false
})

// Mock the Anthropic SDK using the hoisted mockCreate/mockParse.
vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return {
      messages: {
        create: mockCreate,
        parse: mockParse,
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
  splitCongregationalReading,
} from '@/utils/claudeApi'
import type { AiSongSuggestion, AiScriptureSuggestion } from '@/utils/claudeApi'
import {
  computeBoundaries,
  sliceAtBoundaries,
  stripVerseMarkers,
  verseRangeForSlice,
  BOUNDARY_MARKER_OPEN,
} from '@/utils/scriptureBoundaries'

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

  it('aiEnabled: returns null and never invokes the SDK when the AI toggle is off', async () => {
    mockAiEnabled = false

    const result = await getSongSuggestions({
      sermonTopic: 'Grace',
      sermonPassage: null,
      slotVwType: 1,
      alreadySelectedSongIds: [],
      songLibrary: [{ id: 'song-1', title: 'Amazing Grace', ccliNumber: '1234567', vwTypes: [1], themes: [], lastUsedAt: null }],
      recentServiceSongIds: [],
    })

    expect(result).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
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

  it('aiEnabled: returns null and never invokes the SDK when the AI toggle is off', async () => {
    mockAiEnabled = false

    const result = await getScriptureSuggestions({
      sermonTopic: 'Forgiveness',
      sermonPassage: null,
      query: 'passages about forgiveness',
      recentScriptures: [],
    })

    expect(result).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
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

// ─── Congregational Split (34-03) — splitCongregationalReading ────────────────
//
// This is the one place the model's output and real scripture meet. Every
// guarantee built in 34-01/34-02 either holds here or is bypassed here:
// section text must be sliced from the untouched source (never
// model-echoed), the call shape must match this pre-4.6-family model exactly
// (no thinking, no effort), and every failure path — unsplittable passage,
// poisoned source, network error, unparseable reply, invalid reply — must
// resolve to `null` with no partial application and no thrown error.

describe('splitCongregationalReading', () => {
  const RAW_TEXT =
    '[1] The Lord is my shepherd; I shall not want. [2] He makes me lie down in green pastures.'
  const boundaries = computeBoundaries(RAW_TEXT)
  const maxIndex = boundaries.length - 1
  const midIndex = Math.max(1, Math.floor(maxIndex / 2))

  // No verse marker and no clause-ending punctuation followed by whitespace
  // — computeBoundaries collapses to just the two anchors [0, length], which
  // is below hasSplittableBoundaries' 3-entry minimum.
  const NO_BOUNDARY_TEXT = 'HelloWorld'

  // Has plenty of internal boundaries (same shape as RAW_TEXT) but already
  // contains the marker delimiter character, forcing embedBoundaryMarkers'
  // hard refusal.
  const DELIMITER_COLLISION_TEXT = `${RAW_TEXT}${BOUNDARY_MARKER_OPEN}`

  beforeEach(() => {
    mockParse.mockReset()
  })

  it('resolves to CongregationalSection[] whose text is a byte-exact slice of the source and whose speaker is carried through from the model', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: {
        sections: [
          { speaker: 'LEADER', startBoundary: 0, endBoundary: midIndex },
          { speaker: 'CONGREGATION', startBoundary: midIndex, endBoundary: maxIndex },
        ],
      },
    })

    const result = await splitCongregationalReading(RAW_TEXT)

    expect(result).not.toBeNull()
    expect(result).toHaveLength(2)
    expect(result![0]!.speaker).toBe('LEADER')
    expect(result![0]!.text).toBe(
      stripVerseMarkers(sliceAtBoundaries(RAW_TEXT, boundaries, 0, midIndex)),
    )
    expect(result![1]!.speaker).toBe('CONGREGATION')
    expect(result![1]!.text).toBe(
      stripVerseMarkers(sliceAtBoundaries(RAW_TEXT, boundaries, midIndex, maxIndex)),
    )
  })

  it('every returned section text is a substring of the marker-stripped source — proving it was sliced, not echoed', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: {
        sections: [
          { speaker: 'LEADER', startBoundary: 0, endBoundary: midIndex },
          { speaker: 'CONGREGATION', startBoundary: midIndex, endBoundary: maxIndex },
        ],
      },
    })

    const result = await splitCongregationalReading(RAW_TEXT)
    const strippedSource = stripVerseMarkers(RAW_TEXT)

    expect(result).not.toBeNull()
    for (const section of result!) {
      expect(strippedSource.includes(section.text)).toBe(true)
    }
  })

  it('(call shape) sends the exact dated Haiku model id', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: { sections: [{ speaker: 'LEADER', startBoundary: 0, endBoundary: maxIndex }] },
    })

    await splitCongregationalReading(RAW_TEXT)

    const request = mockParse.mock.calls[0]![0] as Record<string, unknown>
    expect(request.model).toBe('claude-haiku-4-5-20251001')
  })

  it('(call shape) sets max_tokens to 1024', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: { sections: [{ speaker: 'LEADER', startBoundary: 0, endBoundary: maxIndex }] },
    })

    await splitCongregationalReading(RAW_TEXT)

    const request = mockParse.mock.calls[0]![0] as Record<string, unknown>
    expect(request.max_tokens).toBe(1024)
  })

  it('(call shape) sets output_config.format to a json_schema-typed format constraining the reply to indices', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: { sections: [{ speaker: 'LEADER', startBoundary: 0, endBoundary: maxIndex }] },
    })

    await splitCongregationalReading(RAW_TEXT)

    const request = mockParse.mock.calls[0]![0] as {
      output_config: { format: { type: string; schema: { properties: Record<string, unknown> } } }
    }
    expect(request.output_config).toBeDefined()
    expect(request.output_config.format).toBeDefined()
    expect(request.output_config.format.type).toBe('json_schema')
    // The schema passed through jsonSchemaOutputFormat is transformed (deep
    // cloned), so it will not be `===` SPLIT_SCHEMA — assert its shape
    // instead: it still constrains the reply to a `sections` array, never a
    // free-text field.
    expect(request.output_config.format.schema.properties).toHaveProperty('sections')
  })

  it('(call shape) never sets thinking or effort — both error on this pre-4.6-family model', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: { sections: [{ speaker: 'LEADER', startBoundary: 0, endBoundary: maxIndex }] },
    })

    await splitCongregationalReading(RAW_TEXT)

    const request = mockParse.mock.calls[0]![0] as Record<string, unknown>
    expect('thinking' in request).toBe(false)
    expect('effort' in request).toBe(false)
    expect('effort' in (request.output_config as Record<string, unknown>)).toBe(false)
  })

  it('(call shape) sends the marked-up passage as the sole user message and forwards the app-auth header', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: { sections: [{ speaker: 'LEADER', startBoundary: 0, endBoundary: maxIndex }] },
    })

    await splitCongregationalReading(RAW_TEXT)

    const request = mockParse.mock.calls[0]![0] as {
      messages: { role: string; content: string }[]
    }
    const options = mockParse.mock.calls[0]![1] as { headers: Record<string, string> }
    expect(request.messages).toHaveLength(1)
    expect(request.messages[0]!.role).toBe('user')
    expect(request.messages[0]!.content).toContain(BOUNDARY_MARKER_OPEN)
    expect(options.headers).toEqual({ 'X-App-Auth': 'test-token' })
  })

  it('(P-02) the system prompt never asks for or quotes passage text', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: { sections: [{ speaker: 'LEADER', startBoundary: 0, endBoundary: maxIndex }] },
    })

    await splitCongregationalReading(RAW_TEXT)

    const request = mockParse.mock.calls[0]![0] as { system: string }
    expect(typeof request.system).toBe('string')
    expect(request.system.length).toBeGreaterThan(0)
    // The system prompt instructs the model about markers/indices only — it
    // must never itself carry scripture words from the passage.
    expect(request.system).not.toContain('shepherd')
    expect(request.system).not.toContain('pastures')
  })

  it('returns null and never calls the API when the passage has no internal boundary', async () => {
    const result = await splitCongregationalReading(NO_BOUNDARY_TEXT)

    expect(result).toBeNull()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('returns null and never calls the API when the source already contains a boundary-marker delimiter', async () => {
    const result = await splitCongregationalReading(DELIMITER_COLLISION_TEXT)

    expect(result).toBeNull()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('returns null (not a rejected promise) when the API call rejects, and logs once', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockParse.mockRejectedValueOnce(new Error('Network error'))

    const result = await splitCongregationalReading(RAW_TEXT)

    expect(result).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it('returns null when the reply has no parsed output', async () => {
    mockParse.mockResolvedValueOnce({ parsed_output: null })

    const result = await splitCongregationalReading(RAW_TEXT)

    expect(result).toBeNull()
  })

  it('returns null with no partial array when a section has an out-of-range index', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: {
        sections: [
          { speaker: 'LEADER', startBoundary: 0, endBoundary: midIndex },
          { speaker: 'CONGREGATION', startBoundary: midIndex, endBoundary: maxIndex + 50 },
        ],
      },
    })

    const result = await splitCongregationalReading(RAW_TEXT)

    expect(result).toBeNull()
  })

  it('returns null with no partial array when there is a gap between sections', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: {
        sections: [
          { speaker: 'LEADER', startBoundary: 0, endBoundary: 1 },
          { speaker: 'CONGREGATION', startBoundary: 2, endBoundary: maxIndex },
        ],
      },
    })

    const result = await splitCongregationalReading(RAW_TEXT)

    expect(result).toBeNull()
  })

  it('(boundary identity) the highest index the validator accepts agrees with the highest marker index embedded in the prompt', async () => {
    mockParse.mockResolvedValueOnce({
      parsed_output: { sections: [{ speaker: 'LEADER', startBoundary: 0, endBoundary: maxIndex }] },
    })

    const result = await splitCongregationalReading(RAW_TEXT)

    const request = mockParse.mock.calls[0]![0] as { messages: { content: string }[] }
    const markerIndices = [...request.messages[0]!.content.matchAll(/⟦(\d+)⟧/g)].map((m) =>
      Number(m[1]),
    )
    const highestMarkerIndexInPrompt = Math.max(...markerIndices)

    // The reply's endBoundary was set to `maxIndex` above and was ACCEPTED
    // (result is non-null) — proving the highest index the validator accepts
    // is the same highest index embedded in the prompt, i.e. one single
    // `boundaries` array/length was threaded through both, never recomputed.
    expect(result).not.toBeNull()
    expect(highestMarkerIndexInPrompt).toBe(maxIndex)
  })

  it('no failure path throws out of splitCongregationalReading', async () => {
    mockParse.mockResolvedValueOnce({ parsed_output: { sections: 'not-an-array' } })

    await expect(splitCongregationalReading(RAW_TEXT)).resolves.toBeNull()
  })

  it('aiEnabled: returns null and never invokes the SDK when the AI toggle is off', async () => {
    mockAiEnabled = false

    const result = await splitCongregationalReading(RAW_TEXT)

    expect(result).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })
})

// ─── AI toggle: pure helpers stay ungated (39-04) ─────────────────────────────
//
// The guard is applied to exactly the three network-calling exports above.
// These four exports make no network call and must keep working identically
// with AI off — gating them would be a functional regression, since existing
// AI-generated content (e.g. an already-split congregational reading) must
// remain parseable and editable even when the toggle is off.
describe('pure helpers remain callable with AI off (aiEnabled)', () => {
  it('safeParseJsonArray, validateSongSuggestions, validateScriptureSuggestions and validateSplitResult all return their normal results with the AI toggle off', () => {
    mockAiEnabled = false

    expect(safeParseJsonArray('[{"a":1}]')).toEqual([{ a: 1 }])

    expect(
      validateSongSuggestions(
        [{ songId: 'song-1', reason: 'fits' }],
        [{ id: 'song-1' }],
      ),
    ).toEqual([{ songId: 'song-1', reason: 'fits' }])

    expect(
      validateScriptureSuggestions([
        {
          book: 'Psalms',
          chapter: 103,
          verseStart: 1,
          verseEnd: 12,
          reason: 'fits',
          recentlyUsed: false,
          weeksAgoUsed: null,
        },
      ]),
    ).toHaveLength(1)

    const boundaries = [0, 1, 2]
    expect(
      validateSplitResult(
        { sections: [{ speaker: 'LEADER', startBoundary: 0, endBoundary: 2 }] },
        boundaries,
      ),
    ).toEqual([{ speaker: 'LEADER', startBoundary: 0, endBoundary: 2 }])
  })
})

// ─── WR-03 (39-REVIEW): isAiEnabled() guard never throws ──────────────────────
//
// `isAiEnabled()` calls `useAuthStore()`, which throws if invoked with no
// active Pinia instance. The module's documented contract (39-CONTEXT.md,
// restated in this file's JSDoc) is "returns null on any error... never
// throw from service/utility functions; let callers handle null." Before the
// fix, the guard sat AHEAD of each export's `try` block, so this throw would
// escape as a rejected promise instead of resolving to `null`. These tests
// simulate that throw directly (rather than only exercising the toggle-off
// path, which never reaches `useAuthStore()` throwing) to prove the
// never-throw contract holds even when the guard itself fails.
describe('WR-03: isAiEnabled() guard never throws out of a gated export', () => {
  it('getSongSuggestions resolves to null, not a rejected promise, when useAuthStore() throws', async () => {
    mockAuthStoreThrows = true

    await expect(
      getSongSuggestions({
        sermonTopic: 'Grace',
        sermonPassage: null,
        slotVwType: 1,
        alreadySelectedSongIds: [],
        songLibrary: [{ id: 'song-1', title: 'Amazing Grace', ccliNumber: '1234567', vwTypes: [1], themes: [], lastUsedAt: null }],
        recentServiceSongIds: [],
      }),
    ).resolves.toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('getScriptureSuggestions resolves to null, not a rejected promise, when useAuthStore() throws', async () => {
    mockAuthStoreThrows = true

    await expect(
      getScriptureSuggestions({
        sermonTopic: 'Grace',
        sermonPassage: null,
        query: '',
        recentScriptures: [],
      }),
    ).resolves.toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('splitCongregationalReading resolves to null, not a rejected promise, when useAuthStore() throws', async () => {
    mockAuthStoreThrows = true

    // The guard short-circuits before `computeBoundaries` runs, so the exact
    // text content is irrelevant here — unlike the "no failure path throws"
    // test above (which needs real splittable boundaries), this one only
    // needs to reach the guard.
    await expect(splitCongregationalReading('Leader: Test line\nAll: Response line')).resolves.toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })
})
