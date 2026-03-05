import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Service, ServiceSlot, SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ScriptureRef } from '@/types/service'
import type { Timestamp } from 'firebase/firestore'

// Mock esvApi before importing planningCenterApi
vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: vi.fn(),
}))

import { fetchPassageText } from '@/utils/esvApi'

import {
  validatePcCredentials,
  fetchServiceTypes,
  createPlan,
  createItem,
  addSlotAsItem,
  buildPlanTitle,
} from '@/utils/planningCenterApi'

const mockTimestamp = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc-001',
    date: '2026-03-08',
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'planned',
    slots: [],
    sermonPassage: null,
    sermonTopic: '',
    notes: '',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  }
}

describe('buildPlanTitle', () => {
  it('returns scripture ref with teams in parens when sermonPassage and teams are present', () => {
    const service = makeService({
      sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
      teams: ['Choir'],
    })
    expect(buildPlanTitle(service)).toBe('Romans 8:1-11 (Choir)')
  })

  it('returns service name when sermonPassage is null and name is non-empty', () => {
    const service = makeService({ sermonPassage: null, name: 'Easter', teams: [] })
    expect(buildPlanTitle(service)).toBe('Easter')
  })

  it('returns "Service" fallback when sermonPassage is null and name is empty', () => {
    const service = makeService({ sermonPassage: null, name: '', teams: [] })
    expect(buildPlanTitle(service)).toBe('Service')
  })

  it('returns scripture ref with multiple teams joined by comma', () => {
    const service = makeService({
      sermonPassage: { book: 'Revelation', chapter: 12 },
      teams: ['Choir', 'Orchestra'],
    })
    expect(buildPlanTitle(service)).toBe('Revelation 12 (Choir, Orchestra)')
  })

  it('returns scripture ref without parens when no teams', () => {
    const service = makeService({
      sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
      teams: [],
    })
    expect(buildPlanTitle(service)).toBe('Romans 8:1-11')
  })
})

describe('validatePcCredentials', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns {valid: true} when fetch returns 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const result = await validatePcCredentials('app-id', 'secret')
    expect(result).toEqual({ valid: true })
  })

  it('returns {valid: false, error: "Invalid credentials"} when fetch returns 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
    const result = await validatePcCredentials('app-id', 'secret')
    expect(result).toEqual({ valid: false, error: 'Invalid credentials' })
  })

  it('returns {valid: false, error: "Network error"} when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))
    const result = await validatePcCredentials('app-id', 'secret')
    expect(result).toEqual({ valid: false, error: 'Network error' })
  })

  it('returns {valid: false, error: "API error: 500"} when fetch returns other non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
    const result = await validatePcCredentials('app-id', 'secret')
    expect(result).toEqual({ valid: false, error: 'API error: 500' })
  })

  it('sends Authorization header with Basic auth', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    await validatePcCredentials('myapp', 'mysecret')
    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const headers = options?.headers as Record<string, string>
    expect(headers?.Authorization).toBe('Basic ' + btoa('myapp:mysecret'))
  })
})

describe('fetchServiceTypes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns array of {id, name} from JSON:API response', async () => {
    const mockResponse = {
      data: [
        { id: '123', attributes: { name: 'Sunday Gathering' } },
        { id: '456', attributes: { name: 'Wednesday Night' } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))
    const result = await fetchServiceTypes('app-id', 'secret')
    expect(result).toEqual([
      { id: '123', name: 'Sunday Gathering' },
      { id: '456', name: 'Wednesday Night' },
    ])
  })

  it('returns empty array when data is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    const result = await fetchServiceTypes('app-id', 'secret')
    expect(result).toEqual([])
  })
})

describe('createPlan', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sends POST to /service_types/{id}/plans with JSON:API body and returns plan ID', async () => {
    const mockResponse = { data: { id: 'plan-123' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    const result = await createPlan('app-id', 'secret', 'svc-type-1', 'Romans 8:1-11')

    expect(result).toBe('plan-123')

    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/svc-type-1/plans')
    expect(options?.method).toBe('POST')

    const body = JSON.parse(options?.body as string)
    expect(body).toEqual({
      data: {
        type: 'Plan',
        attributes: {
          title: 'Romans 8:1-11',
        },
      },
    })
  })

  it('includes dates in body when provided', async () => {
    const mockResponse = { data: { id: 'plan-456' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    await createPlan('app-id', 'secret', 'svc-type-1', 'Easter', '2026-04-05')

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.dates).toBe('2026-04-05')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))
    await expect(createPlan('app-id', 'secret', 'svc-type-1', 'Title')).rejects.toThrow()
  })
})

describe('createItem', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sends POST with item_type "song_arrangement" for songs', async () => {
    const mockResponse = { data: { id: 'item-001' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    const result = await createItem('app-id', 'secret', 'svc-type-1', 'plan-1', {
      title: 'Come Thou Fount (Key: G)',
      itemType: 'song_arrangement',
    })

    expect(result).toBe('item-001')

    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/svc-type-1/plans/plan-1/items')
    expect(options?.method).toBe('POST')

    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song_arrangement')
    expect(body.data.attributes.title).toBe('Come Thou Fount (Key: G)')
  })

  it('sends POST with item_type "regular" for non-song items', async () => {
    const mockResponse = { data: { id: 'item-002' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    await createItem('app-id', 'secret', 'svc-type-1', 'plan-1', {
      title: 'Prayer',
      itemType: 'regular',
    })

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('regular')
  })

  it('includes html_details when description is provided', async () => {
    const mockResponse = { data: { id: 'item-003' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    await createItem('app-id', 'secret', 'svc-type-1', 'plan-1', {
      title: 'Scripture',
      itemType: 'regular',
      description: 'In the beginning...',
    })

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.html_details).toBe('In the beginning...')
  })

  it('does not include html_details when description is not provided', async () => {
    const mockResponse = { data: { id: 'item-004' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    await createItem('app-id', 'secret', 'svc-type-1', 'plan-1', {
      title: 'Prayer',
      itemType: 'regular',
    })

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.html_details).toBeUndefined()
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))
    await expect(
      createItem('app-id', 'secret', 'svc-type-1', 'plan-1', { title: 'Test', itemType: 'regular' }),
    ).rejects.toThrow()
  })
})

describe('addSlotAsItem', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(fetchPassageText).mockResolvedValue('In the beginning God created the heavens...')
  })

  const defaultFetchResponse = () =>
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 }))

  it('maps SONG slot to song_arrangement with "Title (Key: X)" format', async () => {
    defaultFetchResponse()
    const slot: SongSlot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Come Thou Fount',
      songKey: 'G',
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, [])

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song_arrangement')
    expect(body.data.attributes.title).toBe('Come Thou Fount (Key: G)')
  })

  it('maps HYMN slot to song_arrangement with "Name #Number" format', async () => {
    defaultFetchResponse()
    const slot: HymnSlot = {
      kind: 'HYMN',
      position: 1,
      hymnName: 'Amazing Grace',
      hymnNumber: '337',
      verses: '1, 3, 4',
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [])

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song_arrangement')
    expect(body.data.attributes.title).toBe('Amazing Grace #337')
  })

  it('maps HYMN slot without number using just name', async () => {
    defaultFetchResponse()
    const slot: HymnSlot = {
      kind: 'HYMN',
      position: 1,
      hymnName: 'Holy Holy Holy',
      hymnNumber: '',
      verses: '',
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [])

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.title).toBe('Holy Holy Holy')
  })

  it('maps SCRIPTURE slot to regular item with title and ESV text as description', async () => {
    defaultFetchResponse()
    vi.mocked(fetchPassageText).mockResolvedValueOnce('For God so loved the world...')
    const slot: ScriptureSlot = {
      kind: 'SCRIPTURE',
      position: 2,
      book: 'John',
      chapter: 3,
      verseStart: 16,
      verseEnd: 17,
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [])

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('regular')
    expect(body.data.attributes.title).toBe('John 3:16-17')
    expect(body.data.attributes.html_details).toBe('For God so loved the world...')
  })

  it('maps PRAYER slot to regular item with title "Prayer"', async () => {
    defaultFetchResponse()
    const slot: NonAssignableSlot = { kind: 'PRAYER', position: 3 }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 3, [])

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('regular')
    expect(body.data.attributes.title).toBe('Prayer')
  })

  it('maps MESSAGE slot to regular item with title "Message" and no description when sermonPassage is null', async () => {
    defaultFetchResponse()
    const slot: NonAssignableSlot = { kind: 'MESSAGE', position: 4 }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 4, [], null)

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('regular')
    expect(body.data.attributes.title).toBe('Message')
    expect(body.data.attributes.html_details).toBeUndefined()
  })

  it('maps MESSAGE slot with sermonPassage to regular item with formatted passage as description', async () => {
    defaultFetchResponse()
    const slot: NonAssignableSlot = { kind: 'MESSAGE', position: 4 }
    const sermonPassage: ScriptureRef = { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 4, [], sermonPassage)

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.title).toBe('Message')
    expect(body.data.attributes.html_details).toBe('Romans 8:1-11')
  })

  it('skips SONG slots with null songId (does not call fetch)', async () => {
    const slot: SongSlot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: null,
      songTitle: null,
      songKey: null,
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, [])

    // fetch should NOT be called (slot is skipped)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('catches ESV fetch errors silently for SCRIPTURE slots', async () => {
    defaultFetchResponse()
    vi.mocked(fetchPassageText).mockRejectedValueOnce(new Error('ESV API error'))
    const slot: ScriptureSlot = {
      kind: 'SCRIPTURE',
      position: 2,
      book: 'Psalms',
      chapter: 23,
      verseStart: 1,
      verseEnd: 6,
    }

    // Should not throw
    await expect(
      addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, []),
    ).resolves.not.toThrow()
  })
})
