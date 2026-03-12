import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Service, ServiceSlot, SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ScriptureRef } from '@/types/service'
import type { Timestamp } from 'firebase/firestore'
import type { VWType } from '@/types/song'

// Mock esvApi before importing planningCenterApi
vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: vi.fn(),
}))

import { fetchPassageText } from '@/utils/esvApi'

import {
  validatePcCredentials,
  fetchServiceTypes,
  fetchTemplates,
  createPlan,
  fetchTemplateItems,
  createItem,
  updateItem,
  addSlotAsItem,
  buildPlanTitle,
  searchSongByCcli,
  fetchSongArrangements,
  fetchLastScheduledItem,
  createItemNote,
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

describe('fetchTemplates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns array of {id, name} from JSON:API response at /service_types/{id}/plan_templates', async () => {
    const mockResponse = {
      data: [
        { id: 'tmpl-1', attributes: { name: 'Standard Template' } },
        { id: 'tmpl-2', attributes: { name: 'Holiday Template' } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))
    const result = await fetchTemplates('app-id', 'secret', 'svc-type-1')
    expect(result).toEqual([
      { id: 'tmpl-1', name: 'Standard Template' },
      { id: 'tmpl-2', name: 'Holiday Template' },
    ])
    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/svc-type-1/plan_templates')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))
    await expect(fetchTemplates('app-id', 'secret', 'svc-type-1')).rejects.toThrow('Failed to fetch templates: 400')
  })
})

describe('fetchTemplateItems', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('fetches items from template endpoint and returns mapped array', async () => {
    const mockResponse = {
      data: [
        { id: '1', attributes: { title: 'Worship Song', item_type: 'song', sequence: 1 } },
        { id: '2', attributes: { title: 'Prayer', item_type: 'regular', sequence: 2 } },
        { id: '3', attributes: { title: 'Scripture Reading', item_type: 'regular', sequence: 3, html_details: '<p>Read aloud</p>' } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

    const result = await fetchTemplateItems('app-id', 'secret', 'svc-type-1', 'tmpl-42')

    expect(result).toEqual([
      { title: 'Worship Song', itemType: 'song', sequence: 1, description: undefined },
      { title: 'Prayer', itemType: 'regular', sequence: 2, description: undefined },
      { title: 'Scripture Reading', itemType: 'regular', sequence: 3, description: '<p>Read aloud</p>' },
    ])

    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/svc-type-1/plan_templates/tmpl-42/items')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    await expect(fetchTemplateItems('app-id', 'secret', 'svc-type-1', 'tmpl-42')).rejects.toThrow('Failed to fetch template items: 404')
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
    expect(body.data.type).toBe('Plan')
    expect(body.data.attributes.title).toBe('Romans 8:1-11')
  })

  it('sends only title in attributes (no date fields)', async () => {
    const mockResponse = { data: { id: 'plan-456' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    await createPlan('app-id', 'secret', 'svc-type-1', 'Easter')

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes).toEqual({ title: 'Easter' })
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
      title: 'Come Thou Fount',
      itemType: 'song_arrangement',
    })

    expect(result).toBe('item-001')

    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/svc-type-1/plans/plan-1/items')
    expect(options?.method).toBe('POST')

    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song_arrangement')
    expect(body.data.attributes.title).toBe('Come Thou Fount')
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

describe('updateItem', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sends PATCH to /service_types/{id}/plans/{planId}/items/{itemId}', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await updateItem('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-5', {
      title: 'Come Thou Fount',
      itemType: 'song_arrangement',
    })

    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/svc-type-1/plans/plan-1/items/item-5')
    expect(options?.method).toBe('PATCH')

    const body = JSON.parse(options?.body as string)
    expect(body.data.type).toBe('Item')
    expect(body.data.id).toBe('item-5')
    expect(body.data.attributes.title).toBe('Come Thou Fount')
    expect(body.data.attributes.item_type).toBe('song_arrangement')
  })

  it('only includes provided attributes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await updateItem('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-5', {
      title: 'Updated Title',
    })

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes).toEqual({ title: 'Updated Title' })
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
    await expect(
      updateItem('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-5', { title: 'X' }),
    ).rejects.toThrow('Failed to update item: 403')
  })
})

describe('searchSongByCcli', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('calls GET /songs?where[ccli_number]=<ccli> and returns {id, title} on match', async () => {
    const mockResponse = {
      data: [
        { id: 'pc-song-42', attributes: { title: 'Great Is Thy Faithfulness' } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

    const result = await searchSongByCcli('app-id', 'secret', '1234567')

    expect(result).toEqual({ id: 'pc-song-42', title: 'Great Is Thy Faithfulness' })
    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/songs?where[ccli_number]=1234567')
  })

  it('returns null when PC returns empty data array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )

    const result = await searchSongByCcli('app-id', 'secret', '9999999')
    expect(result).toBeNull()
  })

  it('returns null (does not throw) on network/API errors', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))

    const result = await searchSongByCcli('app-id', 'secret', '1234567')
    expect(result).toBeNull()
  })
})

describe('fetchSongArrangements', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('calls GET /songs/{songId}/arrangements and returns array of {id, name, key}', async () => {
    const mockResponse = {
      data: [
        { id: 'arr-1', attributes: { name: 'Default Arrangement', chord_chart_key: 'G' } },
        { id: 'arr-2', attributes: { name: 'Acoustic', chord_chart_key: null } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

    const result = await fetchSongArrangements('app-id', 'secret', 'pc-song-42')

    expect(result).toEqual([
      { id: 'arr-1', name: 'Default Arrangement', key: 'G' },
      { id: 'arr-2', name: 'Acoustic', key: '' },
    ])
    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/songs/pc-song-42/arrangements')
  })

  it('returns empty array on error (does not throw)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))

    const result = await fetchSongArrangements('app-id', 'secret', 'pc-song-42')
    expect(result).toEqual([])
  })
})

describe('createItem with arrangement', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('includes arrangement relationship in POST body when arrangementId provided', async () => {
    const mockResponse = { data: { id: 'item-song-1' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    await createItem('app-id', 'secret', 'svc-type-1', 'plan-1', {
      title: 'Come Thou Fount',
      itemType: 'song',
      arrangementId: 'arr-1',
    })

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.relationships.arrangement.data).toEqual({
      type: 'Arrangement',
      id: 'arr-1',
    })
    expect(body.data.attributes.item_type).toBe('song')
  })

  it('does not include relationships when arrangementId is not provided', async () => {
    const mockResponse = { data: { id: 'item-2' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    await createItem('app-id', 'secret', 'svc-type-1', 'plan-1', {
      title: 'Prayer',
      itemType: 'regular',
    })

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.relationships).toBeUndefined()
  })
})

describe('createItem type union', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('accepts "song" as a valid itemType for createItem', async () => {
    const mockResponse = { data: { id: 'item-song-1' } }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201 }))

    const result = await createItem('app-id', 'secret', 'svc-type-1', 'plan-1', {
      title: 'Test Song',
      itemType: 'song',
    })

    expect(result).toBe('item-song-1')
    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song')
  })

  it('accepts "song" as a valid itemType for updateItem', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))

    await updateItem('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-5', {
      itemType: 'song',
    })

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song')
  })
})

describe('addSlotAsItem', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(fetchPassageText).mockResolvedValue('In the beginning God created the heavens...')
  })

  const defaultFetchResponse = () =>
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 }))

  it('maps SONG slot without CCLI match to song_arrangement with bare song title', async () => {
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
    expect(body.data.attributes.title).toBe('Come Thou Fount')
    expect(body.data.relationships).toBeUndefined()
  })

  it('looks up CCLI first and creates song item with arrangement relationship in POST', async () => {
    const mockTimestampLocal = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp
    const songs = [{
      id: 'song-1',
      title: 'Come Thou Fount',
      ccliNumber: '1234567',
      author: 'Robert Robinson',
      themes: [],
      notes: '',
      vwTypes: [1 as VWType],
      teamTags: [],
      arrangements: [],
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Come Thou Fount',
      songKey: 'G',
    }

    // Mock: searchSongByCcli (found), fetchSongArrangements, song_schedules (no history), then createItem
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'pc-song-42', attributes: { title: 'Come Thou Fount' } }] }), { status: 200 })) // searchSongByCcli
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'arr-1', attributes: { name: 'Default' } }] }), { status: 200 })) // fetchSongArrangements
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })) // song_schedules (no history)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })) // createItem

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)

    // 4 fetch calls: search, arrangements, song_schedules, createItem
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4)
    // 1st call is searchSongByCcli
    const [searchUrl] = vi.mocked(fetch).mock.calls[0]!
    expect(searchUrl).toContain('/songs?where[ccli_number]=1234567')
    // 2nd call is fetchSongArrangements
    const [arrUrl] = vi.mocked(fetch).mock.calls[1]!
    expect(arrUrl).toContain('/songs/pc-song-42/arrangements')
    // 3rd call is song_schedules
    const [schedUrl] = vi.mocked(fetch).mock.calls[2]!
    expect(schedUrl).toContain('/songs/pc-song-42/song_schedules?filter=three_most_recent')
    // 4th call is createItem with song + arrangement relationships
    const [, createOpts] = vi.mocked(fetch).mock.calls[3]!
    const createBody = JSON.parse(createOpts?.body as string)
    expect(createBody.data.attributes.item_type).toBe('song')
    expect(createBody.data.relationships.song.data).toEqual({ type: 'Song', id: 'pc-song-42' })
    expect(createBody.data.relationships.arrangement.data).toEqual({ type: 'Arrangement', id: 'arr-1' })
  })

  it('does not search PC when song has empty ccliNumber', async () => {
    const mockTimestampLocal = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp
    const songs = [{
      id: 'song-1',
      title: 'Custom Song',
      ccliNumber: '',
      author: '',
      themes: [],
      notes: '',
      vwTypes: [1 as VWType],
      teamTags: [],
      arrangements: [],
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Custom Song',
      songKey: 'C',
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 }))

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)

    // Only 1 fetch call (createItem), no search
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('creates item as song_arrangement when searchSongByCcli returns null', async () => {
    const mockTimestampLocal = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp
    const songs = [{
      id: 'song-1',
      title: 'New Song',
      ccliNumber: '9999999',
      author: '',
      themes: [],
      notes: '',
      vwTypes: [1 as VWType],
      teamTags: [],
      arrangements: [],
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'New Song',
      songKey: 'D',
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })) // searchSongByCcli returns empty
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })) // createItem

    const result = await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)

    expect(result).toBe('item-99')
    // 2 fetch calls: search (no match) + createItem (as song_arrangement)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
    const [, createOpts] = vi.mocked(fetch).mock.calls[1]!
    const body = JSON.parse(createOpts?.body as string)
    expect(body.data.attributes.item_type).toBe('song_arrangement')
    expect(body.data.relationships).toBeUndefined()
  })

  it('creates item as song with song relationship when CCLI matches but no arrangements', async () => {
    const mockTimestampLocal = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp
    const songs = [{
      id: 'song-1',
      title: 'Song',
      ccliNumber: '1234567',
      author: '',
      themes: [],
      notes: '',
      vwTypes: [1 as VWType],
      teamTags: [],
      arrangements: [],
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Song',
      songKey: 'E',
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'pc-song-42', attributes: { title: 'Song' } }] }), { status: 200 })) // searchSongByCcli
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })) // fetchSongArrangements returns empty
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })) // song_schedules (no history)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })) // createItem

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)

    // 4 fetch calls: search + arrangements (empty) + song_schedules + createItem (as song with song relationship)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4)
    const [, createOpts] = vi.mocked(fetch).mock.calls[3]!
    const body = JSON.parse(createOpts?.body as string)
    expect(body.data.attributes.item_type).toBe('song')
    expect(body.data.relationships.song.data).toEqual({ type: 'Song', id: 'pc-song-42' })
    expect(body.data.relationships.arrangement).toBeUndefined()
  })

  it('HYMN slot still uses item_type "song_arrangement"', async () => {
    defaultFetchResponse()
    const slot: HymnSlot = {
      kind: 'HYMN',
      position: 1,
      hymnName: 'Be Thou My Vision',
      hymnNumber: '382',
      verses: '',
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [])

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song_arrangement')
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
    expect(body.data.attributes.title).toBe('Amazing Grace #337 (vv. 1, 3, 4)')
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

  it('copies item notes per category from last scheduled item via POST', async () => {
    const mockTimestampLocal = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp
    const songs = [{
      id: 'song-1',
      title: 'Come Thou Fount',
      ccliNumber: '1234567',
      author: 'Robert Robinson',
      themes: [],
      notes: '',
      vwTypes: [1 as VWType],
      teamTags: [],
      arrangements: [],
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Come Thou Fount',
      songKey: 'G',
    }

    const scheduleResponse = {
      data: [{
        id: 'sched-1',
        relationships: {
          item: { data: { id: 'last-item-1' } },
          plan: { data: { id: 'plan-prev' } },
          service_type: { data: { id: 'st-prev' } },
        },
      }],
    }
    const lastItemResponse = {
      data: { attributes: {} },
      included: [
        {
          type: 'ItemNote',
          id: 'note-1',
          attributes: { content: 'John Smith' },
          relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-person' } } },
        },
        {
          type: 'ItemNote',
          id: 'note-2',
          attributes: { content: 'Lead vocals' },
          relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-vocals' } } },
        },
      ],
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'pc-song-42', attributes: { title: 'Come Thou Fount' } }] }), { status: 200 })) // searchSongByCcli
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'arr-1', attributes: { name: 'Default' } }] }), { status: 200 })) // fetchSongArrangements
      .mockResolvedValueOnce(new Response(JSON.stringify(scheduleResponse), { status: 200 })) // song_schedules
      .mockResolvedValueOnce(new Response(JSON.stringify(lastItemResponse), { status: 200 })) // fetch last item with notes
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })) // createItem
      .mockResolvedValueOnce(new Response('{}', { status: 201 })) // createItemNote for note-1
      .mockResolvedValueOnce(new Response('{}', { status: 201 })) // createItemNote for note-2

    const result = await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)

    expect(result).toBe('item-99')
    // 7 fetch calls: search + arrangements + song_schedules + lastItem + createItem + 2 note POSTs
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(7)

    // Note POSTs
    const [noteUrl1, noteOpts1] = vi.mocked(fetch).mock.calls[5]!
    expect(noteUrl1).toContain('/items/item-99/item_notes')
    const noteBody1 = JSON.parse(noteOpts1?.body as string)
    expect(noteBody1.data.attributes.item_note_category_id).toBe('cat-person')
    expect(noteBody1.data.attributes.content).toBe('John Smith')

    const [noteUrl2, noteOpts2] = vi.mocked(fetch).mock.calls[6]!
    expect(noteUrl2).toContain('/items/item-99/item_notes')
    const noteBody2 = JSON.parse(noteOpts2?.body as string)
    expect(noteBody2.data.attributes.item_note_category_id).toBe('cat-vocals')
    expect(noteBody2.data.attributes.content).toBe('Lead vocals')
  })

  it('createItemNote failure does not abort export', async () => {
    const mockTimestampLocal = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp
    const songs = [{
      id: 'song-1',
      title: 'Come Thou Fount',
      ccliNumber: '1234567',
      author: '',
      themes: [],
      notes: '',
      vwTypes: [1 as VWType],
      teamTags: [],
      arrangements: [],
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Come Thou Fount',
      songKey: 'G',
    }

    const scheduleResponse = {
      data: [{
        id: 'sched-1',
        relationships: {
          item: { data: { id: 'last-item-1' } },
          plan: { data: { id: 'plan-prev' } },
          service_type: { data: { id: 'st-prev' } },
        },
      }],
    }
    const lastItemResponse = {
      data: { attributes: {} },
      included: [
        {
          type: 'ItemNote',
          id: 'note-1',
          attributes: { content: 'John Smith' },
          relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-person' } } },
        },
      ],
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'pc-song-42', attributes: { title: 'Come Thou Fount' } }] }), { status: 200 })) // searchSongByCcli
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'arr-1', attributes: { name: 'Default' } }] }), { status: 200 })) // fetchSongArrangements
      .mockResolvedValueOnce(new Response(JSON.stringify(scheduleResponse), { status: 200 })) // song_schedules
      .mockResolvedValueOnce(new Response(JSON.stringify(lastItemResponse), { status: 200 })) // fetch last item
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })) // createItem
      .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 })) // createItemNote fails

    // Should not throw despite note POST failing
    const result = await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs)
    expect(result).toBe('item-99')
  })

})

describe('fetchLastScheduledItem', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  const mockScheduleResponse = (itemId = 'item-last-1', planId = 'plan-prev', stId = 'st-1') => ({
    data: [{
      id: 'sched-1',
      relationships: {
        item: { data: { id: itemId } },
        plan: { data: { id: planId } },
        service_type: { data: { id: stId } },
      },
    }],
  })

  const mockItemResponse = (notes: Array<{ id: string; content: string; catId: string }> = []) => ({
    data: { attributes: {} },
    included: notes.map((n) => ({
      type: 'ItemNote',
      id: n.id,
      attributes: { content: n.content },
      relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: n.catId } } },
    })),
  })

  it('returns { notes } on success when song has been scheduled before', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockItemResponse([
        { id: 'note-1', content: 'John Smith', catId: 'cat-person' },
        { id: 'note-2', content: 'Lead vocals', catId: 'cat-vocals' },
      ])), { status: 200 }))

    const result = await fetchLastScheduledItem('app-id', 'secret', 'pc-song-42')

    expect(result).toEqual({
      notes: [
        { categoryId: 'cat-person', content: 'John Smith' },
        { categoryId: 'cat-vocals', content: 'Lead vocals' },
      ],
    })
    const [schedUrl] = vi.mocked(fetch).mock.calls[0]!
    expect(schedUrl).toContain('/songs/pc-song-42/song_schedules?filter=three_most_recent')
    const [itemUrl] = vi.mocked(fetch).mock.calls[1]!
    expect(itemUrl).toContain('/service_types/st-1/plans/plan-prev/items/item-last-1?include=item_notes')
  })

  it('returns { notes: [] } when no item notes exist', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockItemResponse()), { status: 200 }))

    const result = await fetchLastScheduledItem('app-id', 'secret', 'pc-song-42')
    expect(result).toEqual({ notes: [] })
  })

  it('returns null when song_schedules returns empty array (song never scheduled)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const result = await fetchLastScheduledItem('app-id', 'secret', 'pc-song-42')
    expect(result).toBeNull()
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('returns null when song_schedules response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    const result = await fetchLastScheduledItem('app-id', 'secret', 'pc-song-42')
    expect(result).toBeNull()
  })

  it('returns null when item fetch response is not ok', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    const result = await fetchLastScheduledItem('app-id', 'secret', 'pc-song-42')
    expect(result).toBeNull()
  })

  it('returns null (does not throw) on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))
    const result = await fetchLastScheduledItem('app-id', 'secret', 'pc-song-42')
    expect(result).toBeNull()
  })

  it('ignores included items that are not ItemNote type', async () => {
    const itemResponse = {
      data: { attributes: {} },
      included: [
        {
          type: 'Song',
          id: 'song-1',
          attributes: { content: 'Should be ignored' },
          relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-1' } } },
        },
        {
          type: 'ItemNote',
          id: 'note-1',
          attributes: { content: 'Actual note' },
          relationships: { item_note_category: { data: { type: 'ItemNoteCategory', id: 'cat-2' } } },
        },
      ],
    }
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(itemResponse), { status: 200 }))

    const result = await fetchLastScheduledItem('app-id', 'secret', 'pc-song-42')
    expect(result).toEqual({
      notes: [{ categoryId: 'cat-2', content: 'Actual note' }],
    })
  })
})

describe('createItemNote', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sends POST to /service_types/{stId}/plans/{planId}/items/{itemId}/item_notes with correct body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 201 }))

    await createItemNote('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-99', 'cat-person', 'John Smith')

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/svc-type-1/plans/plan-1/items/item-99/item_notes')
    expect(options?.method).toBe('POST')

    const body = JSON.parse(options?.body as string)
    expect(body.data.type).toBe('ItemNote')
    expect(body.data.attributes.item_note_category_id).toBe('cat-person')
    expect(body.data.attributes.content).toBe('John Smith')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))

    await expect(
      createItemNote('app-id', 'secret', 'svc-type-1', 'plan-1', 'item-99', 'cat-1', 'content'),
    ).rejects.toThrow('Failed to create item note: 400')
  })
})

