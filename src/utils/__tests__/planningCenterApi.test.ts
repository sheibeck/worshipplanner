import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Service, ServiceSlot, SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ImportedSlot, ScriptureRef } from '@/types/service'
import type { Timestamp } from 'firebase/firestore'
import type { VWType } from '@/types/song'

// Mock esvApi before importing planningCenterApi
vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: vi.fn(),
}))

// Mock nltApi alongside esvApi so the SCRIPTURE branch's version routing can be
// asserted without a network call.
vi.mock('@/utils/nltApi', () => ({
  fetchNltPassageText: vi.fn(),
}))

import { fetchPassageText } from '@/utils/esvApi'
import { fetchNltPassageText } from '@/utils/nltApi'

import {
  validatePcCredentials,
  fetchServiceTypes,
  fetchTemplates,
  fetchServiceTypeTeams,
  createPlan,
  fetchTemplateItems,
  createItem,
  updateItem,
  deleteItem,
  fetchPlanItems,
  fetchPlanNeededPositionTeamIds,
  fetchTeamPositions,
  addNeededPosition,
  addSlotAsItem,
  buildPlanTitle,
  searchSongByCcli,
  fetchSongArrangements,
  fetchLastScheduledItem,
  createItemNote,
  fetchPlanTimes,
  fetchAllPeople,
  mapPcPersonToUpsert,
  fetchAndMapPeople,
  fetchPeopleForTeamPositions,
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
  it('returns the bare scripture ref (no teams suffix) when a single team is present', () => {
    const service = makeService({
      sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
      teams: ['Choir'],
    })
    expect(buildPlanTitle(service)).toBe('Romans 8:1-11')
  })

  it('returns service name when sermonPassage is null and name is non-empty', () => {
    const service = makeService({ sermonPassage: null, name: 'Easter', teams: [] })
    expect(buildPlanTitle(service)).toBe('Easter')
  })

  it('returns "Service" fallback when sermonPassage is null and name is empty', () => {
    const service = makeService({ sermonPassage: null, name: '', teams: [] })
    expect(buildPlanTitle(service)).toBe('Service')
  })

  it('returns the bare scripture ref (no teams suffix) even with multiple teams present', () => {
    const service = makeService({
      sermonPassage: { book: 'Revelation', chapter: 12 },
      teams: ['Choir', 'Orchestra'],
    })
    expect(buildPlanTitle(service)).toBe('Revelation 12')
  })

  it('returns scripture ref without any suffix when no teams', () => {
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
    vi.mocked(fetchPassageText).mockReset()
    vi.mocked(fetchNltPassageText).mockReset()
    vi.mocked(fetchPassageText).mockResolvedValue('In the beginning God created the heavens...')
    vi.mocked(fetchNltPassageText).mockResolvedValue('In the beginning God created the heavens... (NLT)')
  })

  const defaultFetchResponse = () =>
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 }))

  it('maps SONG slot without CCLI match to song_arrangement with bare song title', async () => {
    defaultFetchResponse()
    const slot: SongSlot = {
      kind: 'SONG',
      id: 'slot-song-0',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Come Thou Fount',
      songKey: 'G',
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, [], 'ESV')

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song_arrangement')
    expect(body.data.attributes.title).toBe('Worship Song - Come Thou Fount')
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
      tags: [],
      removedThemes: [],
      vwTypes: [1 as VWType],
      arrangements: [],
      primaryArrangementId: null,
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      id: 'slot-song-0',
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

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs, 'ESV')

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
      tags: [],
      removedThemes: [],
      vwTypes: [1 as VWType],
      arrangements: [],
      primaryArrangementId: null,
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      id: 'slot-song-0',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Custom Song',
      songKey: 'C',
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 }))

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs, 'ESV')

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
      tags: [],
      removedThemes: [],
      vwTypes: [1 as VWType],
      arrangements: [],
      primaryArrangementId: null,
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      id: 'slot-song-0',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'New Song',
      songKey: 'D',
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })) // searchSongByCcli returns empty
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-99' } }), { status: 201 })) // createItem

    const result = await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs, 'ESV')

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
      tags: [],
      removedThemes: [],
      vwTypes: [1 as VWType],
      arrangements: [],
      primaryArrangementId: null,
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      id: 'slot-song-0',
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

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs, 'ESV')

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
      id: 'slot-hymn-1',
      position: 1,
      hymnName: 'Be Thou My Vision',
      hymnNumber: '382',
      verses: '',
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [], 'ESV')

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song_arrangement')
  })

  it('maps HYMN slot to song_arrangement with "Name #Number" format', async () => {
    defaultFetchResponse()
    const slot: HymnSlot = {
      kind: 'HYMN',
      id: 'slot-hymn-1',
      position: 1,
      hymnName: 'Amazing Grace',
      hymnNumber: '337',
      verses: '1, 3, 4',
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [], 'ESV')

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('song_arrangement')
    expect(body.data.attributes.title).toBe('Worship Song - Amazing Grace #337 (vv. 1, 3, 4)')
  })

  it('maps HYMN slot without number using just name', async () => {
    defaultFetchResponse()
    const slot: HymnSlot = {
      kind: 'HYMN',
      id: 'slot-hymn-1',
      position: 1,
      hymnName: 'Holy Holy Holy',
      hymnNumber: '',
      verses: '',
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [], 'ESV')

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.title).toBe('Worship Song - Holy Holy Holy')
  })

  it('maps SCRIPTURE slot to regular item with title and ESV text as description', async () => {
    defaultFetchResponse()
    vi.mocked(fetchPassageText).mockResolvedValueOnce('For God so loved the world...')
    const slot: ScriptureSlot = {
      kind: 'SCRIPTURE',
      id: 'slot-scripture-2',
      position: 2,
      book: 'John',
      chapter: 3,
      verseStart: 16,
      verseEnd: 17,
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'ESV')

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('regular')
    expect(body.data.attributes.title).toBe('Scripture - John 3:16-17')
    expect(body.data.attributes.html_details).toBe('For God so loved the world...')
  })

  // ME-01: the item title AND the ESV query were built inline by the old
  // `verseStart && verseEnd` rule, so a single-verse reading dropped its verse
  // — the plan item was titled "Scripture - Romans 8" and fetchPassageText
  // pulled the WHOLE CHAPTER into the item description, while the projected
  // slide read "Romans 8:28".
  it('maps a single-verse SCRIPTURE slot without widening it to the whole chapter', async () => {
    defaultFetchResponse()
    vi.mocked(fetchPassageText).mockResolvedValueOnce('And we know that for those who love God...')
    const slot: ScriptureSlot = {
      kind: 'SCRIPTURE',
      id: 'slot-scripture-2',
      position: 2,
      book: 'Romans',
      chapter: 8,
      verseStart: 28,
      verseEnd: null,
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'ESV')

    expect(vi.mocked(fetchPassageText)).toHaveBeenCalledWith('Romans 8:28')
    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.title).toBe('Scripture - Romans 8:28')
  })

  it('maps a whole-chapter SCRIPTURE slot as the bare chapter', async () => {
    defaultFetchResponse()
    vi.mocked(fetchPassageText).mockResolvedValueOnce('Bless the LORD, O my soul...')
    const slot: ScriptureSlot = {
      kind: 'SCRIPTURE',
      id: 'slot-scripture-2',
      position: 2,
      book: 'Psalms',
      chapter: 103,
      verseStart: null,
      verseEnd: null,
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'ESV')

    expect(vi.mocked(fetchPassageText)).toHaveBeenCalledWith('Psalms 103')
    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.title).toBe('Scripture - Psalms 103')
  })

  it('maps PRAYER slot to regular item with title "Prayer"', async () => {
    defaultFetchResponse()
    const slot: NonAssignableSlot = { kind: 'PRAYER', id: 'slot-prayer-3', position: 3 }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 3, [], 'ESV')

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('regular')
    expect(body.data.attributes.title).toBe('Prayer')
  })

  it('maps MESSAGE slot to regular item with title "Message" and no description when sermonPassage is null', async () => {
    defaultFetchResponse()
    const slot: NonAssignableSlot = { kind: 'MESSAGE', id: 'slot-message-4', position: 4 }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 4, [], 'ESV', null)

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.item_type).toBe('regular')
    expect(body.data.attributes.title).toBe('Message')
    expect(body.data.attributes.html_details).toBeUndefined()
  })

  it('maps MESSAGE slot with sermonPassage to regular item with formatted passage as description', async () => {
    defaultFetchResponse()
    const slot: NonAssignableSlot = { kind: 'MESSAGE', id: 'slot-message-4', position: 4 }
    const sermonPassage: ScriptureRef = { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 4, [], 'ESV', sermonPassage)

    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.title).toBe('Message')
    expect(body.data.attributes.html_details).toBe('Romans 8:1-11')
  })

  it('skips SONG slots with null songId (does not call fetch)', async () => {
    const slot: SongSlot = {
      kind: 'SONG',
      id: 'slot-song-0',
      position: 0,
      requiredVwType: 1,
      songId: null,
      songTitle: null,
      songKey: null,
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, [], 'ESV')

    // fetch should NOT be called (slot is skipped)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('catches ESV fetch errors silently for SCRIPTURE slots', async () => {
    defaultFetchResponse()
    vi.mocked(fetchPassageText).mockRejectedValueOnce(new Error('ESV API error'))
    const slot: ScriptureSlot = {
      kind: 'SCRIPTURE',
      id: 'slot-scripture-2',
      position: 2,
      book: 'Psalms',
      chapter: 23,
      verseStart: 1,
      verseEnd: 6,
    }

    // Should not throw
    await expect(
      addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'ESV'),
    ).resolves.not.toThrow()
  })

  // A (bug fix): the SCRIPTURE branch used to call fetchPassageText (ESV)
  // unconditionally, ignoring the church's bibleVersion. It must now route by
  // version.
  it('routes a SCRIPTURE slot to NLT when bibleVersion is "NLT" and not ESV', async () => {
    defaultFetchResponse()
    vi.mocked(fetchNltPassageText).mockResolvedValueOnce('[16] For this is how God loved the world... (NLT)')
    const slot: ScriptureSlot = {
      kind: 'SCRIPTURE',
      id: 'slot-scripture-2',
      position: 2,
      book: 'John',
      chapter: 3,
      verseStart: 16,
      verseEnd: 17,
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'NLT')

    expect(vi.mocked(fetchNltPassageText)).toHaveBeenCalledWith('John 3:16-17')
    expect(vi.mocked(fetchPassageText)).not.toHaveBeenCalled()
    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.title).toBe('Scripture - John 3:16-17')
    expect(body.data.attributes.html_details).toBe('[16] For this is how God loved the world... (NLT)')
  })

  it('routes a SCRIPTURE slot to ESV when bibleVersion is "ESV" and not NLT', async () => {
    defaultFetchResponse()
    vi.mocked(fetchPassageText).mockResolvedValueOnce('For God so loved the world... (ESV)')
    const slot: ScriptureSlot = {
      kind: 'SCRIPTURE',
      id: 'slot-scripture-2',
      position: 2,
      book: 'John',
      chapter: 3,
      verseStart: 16,
      verseEnd: 17,
    }

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'ESV')

    expect(vi.mocked(fetchPassageText)).toHaveBeenCalledWith('John 3:16-17')
    expect(vi.mocked(fetchNltPassageText)).not.toHaveBeenCalled()
    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.html_details).toBe('For God so loved the world... (ESV)')
  })

  // A (bug fix): an unresolvable reference (book/chapter null) used to send an
  // empty query that returns HTTP 400. Now NEITHER fetch fires, no throw, and
  // the item is still created with no html_details.
  it('skips BOTH fetches for a SCRIPTURE slot whose ref resolves to empty, still creating the item (ESV)', async () => {
    defaultFetchResponse()
    const slot = {
      kind: 'SCRIPTURE',
      id: 'slot-scripture-empty',
      position: 2,
      book: null,
      chapter: null,
      verseStart: null,
      verseEnd: null,
    } as unknown as ScriptureSlot

    await expect(
      addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'ESV'),
    ).resolves.not.toThrow()

    expect(vi.mocked(fetchPassageText)).not.toHaveBeenCalled()
    expect(vi.mocked(fetchNltPassageText)).not.toHaveBeenCalled()
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.title).toBe('Scripture - ')
    expect(body.data.attributes.html_details).toBeUndefined()
  })

  it('skips BOTH fetches for a SCRIPTURE slot whose ref resolves to empty, still creating the item (NLT)', async () => {
    defaultFetchResponse()
    const slot = {
      kind: 'SCRIPTURE',
      id: 'slot-scripture-empty',
      position: 2,
      book: null,
      chapter: null,
      verseStart: null,
      verseEnd: null,
    } as unknown as ScriptureSlot

    await expect(
      addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'NLT'),
    ).resolves.not.toThrow()

    expect(vi.mocked(fetchPassageText)).not.toHaveBeenCalled()
    expect(vi.mocked(fetchNltPassageText)).not.toHaveBeenCalled()
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    const [, options] = vi.mocked(fetch).mock.calls[0]!
    const body = JSON.parse(options?.body as string)
    expect(body.data.attributes.html_details).toBeUndefined()
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
      tags: [],
      removedThemes: [],
      vwTypes: [1 as VWType],
      arrangements: [],
      primaryArrangementId: null,
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      id: 'slot-song-0',
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

    const result = await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs, 'ESV')

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
      tags: [],
      removedThemes: [],
      vwTypes: [1 as VWType],
      arrangements: [],
      primaryArrangementId: null,
      lastUsedAt: null,
      hidden: false,
      pcSongId: null,
      createdAt: mockTimestampLocal,
      updatedAt: mockTimestampLocal,
    }]
    const slot: SongSlot = {
      kind: 'SONG',
      id: 'slot-song-0',
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
    const result = await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 0, songs, 'ESV')
    expect(result).toBe('item-99')
  })

  // R085 (Phase 43 Plan 02): addSlotAsItem's dispatch was an unguarded if-chain
  // whose final block was an implicit else returning a "Message" item for any
  // unhandled SlotKind. These tests prove every widened kind exports as itself
  // — never silently as Message — and that the exhaustiveness backstop leaves
  // SONG/HYMN/SCRIPTURE/PRAYER (asserted unmodified above) untouched.
  describe('R085 — every SlotKind branch is explicit (Phase 43 Plan 02)', () => {
    it('E-17: two adjacent new-kind slots produce two distinct titles at their own sequence values', async () => {
      // Two calls to addSlotAsItem in one test each read a fetch Response body
      // once (Response.json() is single-use), so this needs two independent
      // mock responses rather than defaultFetchResponse()'s single shared one.
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-ann' } }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-misc' } }), { status: 201 }))
      const announcements: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'slot-ann-0', position: 0 }
      const misc: NonAssignableSlot = { kind: 'MISC', id: 'slot-misc-1', position: 1 }

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', announcements, 2, [], 'ESV')
      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', misc, 3, [], 'ESV')

      const [, opts0] = vi.mocked(fetch).mock.calls[0]!
      const [, opts1] = vi.mocked(fetch).mock.calls[1]!
      const body0 = JSON.parse(opts0?.body as string)
      const body1 = JSON.parse(opts1?.body as string)

      expect(body0.data.attributes.title).toBe('Announcements')
      expect(body0.data.attributes.sequence).toBe(2)
      expect(body1.data.attributes.title).toBe('Miscellaneous')
      expect(body1.data.attributes.sequence).toBe(3)
      expect(body0.data.attributes.title).not.toBe(body1.data.attributes.title)
    })

    it('maps ANNOUNCEMENTS slot to a regular item titled "Announcements", never "Message"', async () => {
      defaultFetchResponse()
      const slot: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'slot-ann-5', position: 5 }

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 5, [], 'ESV')

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(options?.body as string)
      expect(body.data.attributes.item_type).toBe('regular')
      expect(body.data.attributes.title).toBe('Announcements')
      expect(body.data.attributes.title).not.toBe('Message')
    })

    it('maps MISC slot to a regular item titled "Miscellaneous", never "Message"', async () => {
      defaultFetchResponse()
      const slot: NonAssignableSlot = { kind: 'MISC', id: 'slot-misc-6', position: 6 }

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 6, [], 'ESV')

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(options?.body as string)
      expect(body.data.attributes.item_type).toBe('regular')
      expect(body.data.attributes.title).toBe('Miscellaneous')
      expect(body.data.attributes.title).not.toBe('Message')
    })

    it('E-18: an ANNOUNCEMENTS slot with a whitespace-only body exports as itself with no description', async () => {
      defaultFetchResponse()
      const slot: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'slot-ann-7', position: 7, body: '   \n\t  ' }

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 7, [], 'ESV')

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(options?.body as string)
      expect(body.data.attributes.title).toBe('Announcements')
      expect(body.data.attributes.title).not.toBe('Message')
      expect(body.data.attributes.html_details).toBeUndefined()
    })

    it('E-18: a MISC slot with a whitespace-only body exports as itself with no description', async () => {
      defaultFetchResponse()
      const slot: NonAssignableSlot = { kind: 'MISC', id: 'slot-misc-8', position: 8, body: '  ' }

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 8, [], 'ESV')

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(options?.body as string)
      expect(body.data.attributes.title).toBe('Miscellaneous')
      expect(body.data.attributes.title).not.toBe('Message')
      expect(body.data.attributes.html_details).toBeUndefined()
    })

    it('E-19: an ANNOUNCEMENTS slot body reaches html_details verbatim — leading/trailing space, newline, multi-byte char, emoji', async () => {
      defaultFetchResponse()
      const rawBody = ' Line one\ncafé opens at 9am 🎉 '
      const slot: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'slot-ann-9', position: 9, body: rawBody }

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 9, [], 'ESV')

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(options?.body as string)
      expect(body.data.attributes.html_details).toBe(rawBody)
    })

    it('E-20: sequence passes through the ANNOUNCEMENTS and MISC branches unchanged at a non-zero value', async () => {
      // See the E-17 test above: two addSlotAsItem calls need two independent
      // mock responses since Response.json() can only be read once per call.
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-ann' } }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'item-misc' } }), { status: 201 }))
      const announcements: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'slot-ann-10', position: 10 }
      const misc: NonAssignableSlot = { kind: 'MISC', id: 'slot-misc-11', position: 11 }

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', announcements, 42, [], 'ESV')
      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', misc, 43, [], 'ESV')

      const [, opts0] = vi.mocked(fetch).mock.calls[0]!
      const [, opts1] = vi.mocked(fetch).mock.calls[1]!
      expect(JSON.parse(opts0?.body as string).data.attributes.sequence).toBe(42)
      expect(JSON.parse(opts1?.body as string).data.attributes.sequence).toBe(43)
    })

    it('E-10: a MESSAGE slot with neither body nor sermonPassage resolves without throwing and has no description', async () => {
      defaultFetchResponse()
      const slot: NonAssignableSlot = { kind: 'MESSAGE', id: 'slot-msg-12', position: 12 }

      await expect(
        addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 12, [], 'ESV', null),
      ).resolves.not.toThrow()

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(options?.body as string)
      expect(body.data.attributes.title).toBe('Message')
      expect(body.data.attributes.html_details).toBeUndefined()
    })

    it('a MESSAGE slot with both body and sermonPassage prefers body', async () => {
      defaultFetchResponse()
      const sermonPassage: ScriptureRef = { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 }
      const slot: NonAssignableSlot = {
        kind: 'MESSAGE',
        id: 'slot-msg-13',
        position: 13,
        body: 'Series: Hope, week 3',
      }

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 13, [], 'ESV', sermonPassage)

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(options?.body as string)
      expect(body.data.attributes.html_details).toBe('Series: Hope, week 3')
    })

    it('E-14: a HYMN slot with empty hymnNumber and empty verses exports the bare title with no # and no (vv. )', async () => {
      defaultFetchResponse()
      const slot: HymnSlot = {
        kind: 'HYMN',
        id: 'slot-hymn-14',
        position: 14,
        hymnName: 'Holy Holy Holy',
        hymnNumber: '',
        verses: '',
      }

      await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 14, [], 'ESV')

      const [, options] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(options?.body as string)
      expect(body.data.attributes.title).toBe('Worship Song - Holy Holy Holy')
      expect(body.data.attributes.title).not.toContain('#')
      expect(body.data.attributes.title).not.toContain('(vv. ')
    })

    it('an IMPORTED slot returns the empty string and issues no POST', async () => {
      const slot: ImportedSlot = { kind: 'IMPORTED', id: 'slot-imp-15', position: 15, importId: 'import-1' }

      const result = await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 15, [], 'ESV')

      expect(result).toBe('')
      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })

    // 43-04 Task 3 Part B: the exhaustiveness backstop's compile-time guard
    // (proven separately, see 43-04-SUMMARY.md's captured Part A evidence)
    // only protects against a SlotKind this build was compiled with. Data
    // read from Firestore is untyped at the wire and could carry a kind this
    // build has never heard of — this test proves the backstop's throw arm
    // is reachable and informative at RUNTIME for exactly that case, rather
    // than silently exporting the unknown kind under a borrowed title.
    it('an out-of-union kind value (as could arrive from untyped Firestore data) rejects with an error naming that kind, and issues no POST', async () => {
      const slot = { kind: 'BULLETIN_INSERT', id: 'slot-unknown-16', position: 16 } as unknown as ServiceSlot

      await expect(
        addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 16, [], 'ESV'),
      ).rejects.toThrow(/BULLETIN_INSERT/)

      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })
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
      arrangementId: null,
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
    expect(result).toEqual({ notes: [], arrangementId: null })
  })

  it('extracts the arrangement id from the item relationships', async () => {
    const itemResponse = {
      data: { attributes: {}, relationships: { arrangement: { data: { type: 'Arrangement', id: 'arr-77' } } } },
      included: [],
    }
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockScheduleResponse()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(itemResponse), { status: 200 }))

    const result = await fetchLastScheduledItem('app-id', 'secret', 'pc-song-42')
    expect(result).toEqual({ notes: [], arrangementId: 'arr-77' })
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
      arrangementId: null,
    })
  })
})

describe('addSlotAsItem - Worship Song prefix', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('SONG with songTitle produces title "Worship Song - I Believe"', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'new-item-1' } }), { status: 201 }),
    )
    const slot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'song-abc',
      songTitle: 'I Believe',
      songKey: 'G',
    } as unknown as import('@/types/service').ServiceSlot

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [], 'ESV')

    // Find the fetch call whose URL ends with /items (createItem POST)
    const createCall = vi.mocked(fetch).mock.calls.find(([url]) =>
      (url as string).endsWith('/items'),
    )
    expect(createCall).toBeDefined()
    const body = JSON.parse((createCall![1] as RequestInit).body as string)
    expect(body.data.attributes.title).toBe('Worship Song - I Believe')
  })

  it('SONG with undefined songTitle produces title "Worship Song - [Empty Song]"', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'new-item-1' } }), { status: 201 }),
    )
    const slot = {
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId: 'abc',
      songTitle: undefined,
      songKey: null,
    } as unknown as import('@/types/service').ServiceSlot

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 1, [], 'ESV')

    const createCall = vi.mocked(fetch).mock.calls.find(([url]) =>
      (url as string).endsWith('/items'),
    )
    expect(createCall).toBeDefined()
    const body = JSON.parse((createCall![1] as RequestInit).body as string)
    expect(body.data.attributes.title).toBe('Worship Song - [Empty Song]')
  })

  it('HYMN with hymnName, hymnNumber, and verses produces "Worship Song - Holy, Holy, Holy #1 (vv. 1-3)"', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'new-item-1' } }), { status: 201 }),
    )
    const slot = {
      kind: 'HYMN',
      position: 1,
      hymnName: 'Holy, Holy, Holy',
      hymnNumber: '1',
      verses: '1-3',
    } as unknown as import('@/types/service').ServiceSlot

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'ESV')

    const createCall = vi.mocked(fetch).mock.calls.find(([url]) =>
      (url as string).endsWith('/items'),
    )
    expect(createCall).toBeDefined()
    const body = JSON.parse((createCall![1] as RequestInit).body as string)
    expect(body.data.attributes.title).toBe('Worship Song - Holy, Holy, Holy #1 (vv. 1-3)')
  })

  it('HYMN with bare hymnName (no number, no verses) produces "Worship Song - Amazing Grace"', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'new-item-1' } }), { status: 201 }),
    )
    const slot = {
      kind: 'HYMN',
      position: 1,
      hymnName: 'Amazing Grace',
      hymnNumber: undefined,
      verses: undefined,
    } as unknown as import('@/types/service').ServiceSlot

    await addSlotAsItem('app-id', 'secret', 'svc-type-1', 'plan-1', slot, 2, [], 'ESV')

    const createCall = vi.mocked(fetch).mock.calls.find(([url]) =>
      (url as string).endsWith('/items'),
    )
    expect(createCall).toBeDefined()
    const body = JSON.parse((createCall![1] as RequestInit).body as string)
    expect(body.data.attributes.title).toBe('Worship Song - Amazing Grace')
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

describe('deleteItem', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sends DELETE to /service_types/ST/plans/P/items/I and resolves on 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await deleteItem('app', 'sec', 'ST', 'P', 'I')

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/ST/plans/P/items/I')
    expect((options as RequestInit).method).toBe('DELETE')
    const headers = (options as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Basic ' + btoa('app:sec'))
  })

  it('throws on non-ok response with status in message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    await expect(deleteItem('app', 'sec', 'ST', 'P', 'I')).rejects.toThrow('Failed to delete item: 404')
  })
})

describe('fetchPlanItems', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('maps id, title, sequence, itemType, and length (preserving null)', async () => {
    const mockResponse = {
      data: [
        { id: 'i1', attributes: { title: 'Worship Song - A', sequence: 1, item_type: 'song', length: 300 } },
        { id: 'i2', attributes: { title: 'Message', sequence: 2, item_type: 'regular', length: null } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

    const result = await fetchPlanItems('app', 'sec', 'ST', 'P')

    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/ST/plans/P/items')
    expect(result).toEqual([
      { id: 'i1', title: 'Worship Song - A', sequence: 1, itemType: 'song', length: 300 },
      { id: 'i2', title: 'Message', sequence: 2, itemType: 'regular', length: null },
    ])
  })

  it('coerces a missing length attribute to null', async () => {
    const mockResponse = {
      data: [{ id: 'i1', attributes: { title: 'Item', sequence: 1, item_type: 'regular' } }],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

    const result = await fetchPlanItems('app', 'sec', 'ST', 'P')
    expect(result[0]?.length).toBeNull()
  })
})

describe('fetchServiceTypeTeams', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('maps response data to {id, name}[] and hits correct URL', async () => {
    const mockResponse = {
      data: [
        { id: 't1', attributes: { name: 'Orchestra' } },
        { id: 't2', attributes: { name: 'Choir' } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

    const result = await fetchServiceTypeTeams('app', 'sec', 'ST')

    expect(result).toEqual([
      { id: 't1', name: 'Orchestra' },
      { id: 't2', name: 'Choir' },
    ])
    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/ST/teams')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }))

    await expect(fetchServiceTypeTeams('app', 'sec', 'ST')).rejects.toThrow('Failed to fetch teams: 500')
  })
})

describe('addNeededPosition', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('POSTs to needed_positions with team and team_position relationships', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 201 }))

    await addNeededPosition('app', 'sec', 'ST', 'P', 'TEAM1', 'POS1')

    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/ST/plans/P/needed_positions')
    expect((options as RequestInit).method).toBe('POST')
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.data.type).toBe('NeededPosition')
    expect(body.data.attributes.quantity).toBe(1)
    expect(body.data.relationships.team.data).toEqual({ type: 'Team', id: 'TEAM1' })
    expect(body.data.relationships.team_position.data).toEqual({ type: 'TeamPosition', id: 'POS1' })
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Error', { status: 422 }))

    await expect(addNeededPosition('app', 'sec', 'ST', 'P', 'TEAM1', 'POS1')).rejects.toThrow(
      'Failed to add position POS1 for team TEAM1: 422',
    )
  })
})

describe('fetchTeamPositions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns positions for a team from /teams/{id}/team_positions', async () => {
    const mockPayload = {
      data: [
        { id: 'P1', attributes: { name: 'Lead Guitar' } },
        { id: 'P2', attributes: { name: 'Drums' } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockPayload), { status: 200 }))

    const result = await fetchTeamPositions('app', 'sec', 'TEAM1')

    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/teams/TEAM1/team_positions')
    expect(result).toEqual([{ id: 'P1', name: 'Lead Guitar' }, { id: 'P2', name: 'Drums' }])
  })

  it('returns empty array on non-ok response (non-fatal)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Error', { status: 404 }))

    const result = await fetchTeamPositions('app', 'sec', 'TEAM1')
    expect(result).toEqual([])
  })
})

describe('fetchPlanNeededPositionTeamIds', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns a Set of team IDs from existing needed_positions', async () => {
    const mockPayload = {
      data: [
        { relationships: { team: { data: { id: 'T1', type: 'Team' } } } },
        { relationships: { team: { data: { id: 'T2', type: 'Team' } } } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockPayload), { status: 200 }))

    const result = await fetchPlanNeededPositionTeamIds('app', 'sec', 'ST', 'P')
    expect(result).toEqual(new Set(['T1', 'T2']))
  })

  it('returns empty Set on non-ok response (non-fatal)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Error', { status: 500 }))

    const result = await fetchPlanNeededPositionTeamIds('app', 'sec', 'ST', 'P')
    expect(result).toEqual(new Set())
  })
})

describe('fetchPlanTimes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('maps response data to {id, timeType}[] and hits correct URL', async () => {
    const mockResponse = {
      data: [
        { id: 'pt1', attributes: { time_type: 'service' } },
        { id: 'pt2', attributes: { time_type: 'rehearsal' } },
      ],
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

    const result = await fetchPlanTimes('app', 'sec', 'ST', 'P')

    expect(result).toEqual([
      { id: 'pt1', timeType: 'service' },
      { id: 'pt2', timeType: 'rehearsal' },
    ])
    const [url] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toContain('/service_types/ST/plans/P/plan_times')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }))

    await expect(fetchPlanTimes('app', 'sec', 'ST', 'P')).rejects.toThrow('Failed to fetch plan times: 500')
  })
})

describe('fetchAllPeople', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('follows links.next across 2 pages and returns the concatenated people array', async () => {
    const page1 = {
      data: [
        { id: 'p1', attributes: { first_name: 'Ann', last_name: 'Lee', name: 'Ann Lee' } },
      ],
      links: {
        self: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=0',
        next: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=100',
      },
    }
    const page2 = {
      data: [
        { id: 'p2', attributes: { first_name: 'Bo', last_name: 'Ray', name: 'Bo Ray' } },
      ],
      links: {
        self: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=100',
      },
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))

    const result = await fetchAllPeople('app-id', 'secret')

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(2)
    expect(result[0]?.id).toBe('p1')
    expect(result[1]?.id).toBe('p2')
  })

  it('rewrites the absolute PC next-link URL to the proxy path before the second fetch', async () => {
    const page1 = {
      data: [{ id: 'p1', attributes: { name: 'Ann Lee' } }],
      links: {
        self: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=0',
        next: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=100',
      },
    }
    const page2 = {
      data: [{ id: 'p2', attributes: { name: 'Bo Ray' } }],
      links: { self: 'https://api.planningcenteronline.com/services/v2/people?per_page=100&offset=100' },
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))

    await fetchAllPeople('app-id', 'secret')

    const [secondUrl] = vi.mocked(fetch).mock.calls[1]!
    expect(secondUrl as string).not.toContain('api.planningcenteronline.com')
    expect(secondUrl as string).toContain('/api/planningcenter/services/v2/people')
  })

  it('retries a 429 response respecting Retry-After, then succeeds', async () => {
    const okResponse = {
      data: [{ id: 'p1', attributes: { name: 'Ann Lee' } }],
      links: { self: 'https://api.planningcenteronline.com/services/v2/people' },
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okResponse), { status: 200 }))

    const result = await fetchAllPeople('app-id', 'secret')

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('p1')
  })

  it('throws when the final response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
    await expect(fetchAllPeople('app-id', 'secret')).rejects.toThrow('Failed to fetch people: 500')
  })
})

describe('fetchPeopleForTeamPositions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('filters by selectedPositionIds, dedupes a person on two selected positions, and paginates across pages', async () => {
    const page1 = {
      data: [
        { id: 'a1', relationships: { person: { data: { id: 'p1' } }, team_position: { data: { id: 'POS1' } } } },
        { id: 'a2', relationships: { person: { data: { id: 'p1' } }, team_position: { data: { id: 'POS2' } } } },
        { id: 'a3', relationships: { person: { data: { id: 'p2' } }, team_position: { data: { id: 'POS_UNSELECTED' } } } },
      ],
      included: [
        { type: 'Person', id: 'p1', attributes: { name: 'Ann Lee' } },
        { type: 'Person', id: 'p2', attributes: { name: 'Bo Ray' } },
      ],
      links: {
        self: 'https://api.planningcenteronline.com/services/v2/teams/TEAM1/person_team_position_assignments?per_page=100&offset=0',
        next: 'https://api.planningcenteronline.com/services/v2/teams/TEAM1/person_team_position_assignments?per_page=100&offset=100',
      },
    }
    const page2 = {
      data: [
        { id: 'a4', relationships: { person: { data: { id: 'p3' } }, team_position: { data: { id: 'POS1' } } } },
      ],
      included: [{ type: 'Person', id: 'p3', attributes: { name: 'Cy Doe' } }],
      links: {
        self: 'https://api.planningcenteronline.com/services/v2/teams/TEAM1/person_team_position_assignments?per_page=100&offset=100',
      },
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))
      // Per-person email lookups (batched) after pagination — Map order: p1, p3
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ attributes: { address: 'ann@example.com' } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ attributes: { address: 'cy@example.com' } }] }), { status: 200 }))

    const result = await fetchPeopleForTeamPositions('app', 'sec', 'TEAM1', new Set(['POS1', 'POS2']))

    // 2 assignment pages + 2 per-person email lookups
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4)
    const [firstUrl] = vi.mocked(fetch).mock.calls[0]!
    expect(firstUrl as string).toContain('/teams/TEAM1/person_team_position_assignments')
    expect(firstUrl as string).toContain('include=person')
    const [secondUrl] = vi.mocked(fetch).mock.calls[1]!
    expect(secondUrl as string).not.toContain('api.planningcenteronline.com')
    expect(vi.mocked(fetch).mock.calls[2]![0] as string).toContain('/people/p1/emails')

    expect(result).toHaveLength(2)
    expect(result).toEqual(
      expect.arrayContaining([
        { pcPersonId: 'p1', name: 'Ann Lee', email: 'ann@example.com' },
        { pcPersonId: 'p3', name: 'Cy Doe', email: 'cy@example.com' },
      ]),
    )
    expect(result.find((r) => r.pcPersonId === 'p2')).toBeUndefined()
  })

  it('retries a 429 response respecting Retry-After, then succeeds', async () => {
    const okPayload = {
      data: [
        { id: 'a1', relationships: { person: { data: { id: 'p1' } }, team_position: { data: { id: 'POS1' } } } },
      ],
      included: [{ type: 'Person', id: 'p1', attributes: { name: 'Ann Lee' } }],
      links: { self: 'https://api.planningcenteronline.com/services/v2/teams/TEAM1/person_team_position_assignments' },
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okPayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ attributes: { address: 'ann@example.com' } }] }), { status: 200 }))

    const result = await fetchPeopleForTeamPositions('app', 'sec', 'TEAM1', new Set(['POS1']))

    // 429 retry + ok assignment page + 1 per-person email lookup
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
    expect(result).toEqual([{ pcPersonId: 'p1', name: 'Ann Lee', email: 'ann@example.com' }])
  })

  it('throws when the final response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
    await expect(
      fetchPeopleForTeamPositions('app', 'sec', 'TEAM1', new Set(['POS1'])),
    ).rejects.toThrow('Failed to fetch team position assignments: 500')
  })
})

describe('mapPcPersonToUpsert', () => {
  it('builds name from attributes.name when present', () => {
    const person = { id: 'p1', attributes: { name: 'Ann Lee', first_name: 'Ann', last_name: 'Lee' } }
    const result = mapPcPersonToUpsert(person, ['ann@example.com'])
    expect(result.name).toBe('Ann Lee')
  })

  it('builds name from first_name + last_name trimmed when attributes.name is absent', () => {
    const person = { id: 'p2', attributes: { first_name: 'Bo', last_name: 'Ray' } }
    const result = mapPcPersonToUpsert(person, [])
    expect(result.name).toBe('Bo Ray')
  })

  it('sets email from the first supplied email', () => {
    const person = { id: 'p3', attributes: { name: 'Cy Doe' } }
    const result = mapPcPersonToUpsert(person, ['cy@example.com', 'other@example.com'])
    expect(result.email).toBe('cy@example.com')
  })

  it('yields email "" (no throw) when emails array is empty', () => {
    const person = { id: 'p4', attributes: { name: 'Dee Fox' } }
    const result = mapPcPersonToUpsert(person, [])
    expect(result.email).toBe('')
  })

  it('sets phone to "" ALWAYS', () => {
    const person = { id: 'p5', attributes: { name: 'Eli Gray' } }
    const result = mapPcPersonToUpsert(person, ['eli@example.com'])
    expect(result.phone).toBe('')
  })

  it('sets pcPersonId to the person id', () => {
    const person = { id: 'pc-99', attributes: { name: 'Fay Hall' } }
    const result = mapPcPersonToUpsert(person, [])
    expect(result.pcPersonId).toBe('pc-99')
  })
})

describe('fetchAndMapPeople', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  function makePeopleListResponse(count: number) {
    return {
      data: Array.from({ length: count }, (_, i) => ({
        id: `p${i + 1}`,
        attributes: { name: `Person ${i + 1}` },
      })),
      links: { self: 'https://api.planningcenteronline.com/services/v2/people' },
    }
  }

  it('fetches all people then their emails, returning UpsertPersonInput[] with name+email and phone ""', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(makePeopleListResponse(1)), { status: 200 })) // people list
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ attributes: { address: 'p1@example.com' } }] }), { status: 200 }),
      ) // p1 emails

    const result = await fetchAndMapPeople('app-id', 'secret')

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'Person 1',
      email: 'p1@example.com',
      phone: '',
      pcPersonId: 'p1',
    })

    const [emailsUrl] = vi.mocked(fetch).mock.calls[1]!
    expect(emailsUrl as string).toContain('/people/p1/emails')
  })

  it('reads the email address from the "address" attribute', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(makePeopleListResponse(1)), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ attributes: { address: 'someone@example.com' } }] }), { status: 200 }),
      )

    const result = await fetchAndMapPeople('app-id', 'secret')
    expect(result[0]?.email).toBe('someone@example.com')
  })

  it('yields email "" and still includes the person when the emails endpoint returns empty data', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(makePeopleListResponse(1)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const result = await fetchAndMapPeople('app-id', 'secret')
    expect(result).toHaveLength(1)
    expect(result[0]?.email).toBe('')
  })

  it('issues email fetches in batches of 3 and returns one UpsertPersonInput per fetched person (no silent drops)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(makePeopleListResponse(4)), { status: 200 }),
    )
    // 4 subsequent email fetches — one per person, in call order p1..p4
    for (let i = 1; i <= 4; i++) {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ attributes: { address: `p${i}@example.com` } }] }), { status: 200 }),
      )
    }

    const result = await fetchAndMapPeople('app-id', 'secret')

    expect(result).toHaveLength(4)
    // 1 people-list call + 4 email calls
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(5)
    // First batch (calls 1-3) covers p1-p3, second batch (call 4) covers p4
    const [batch1Call1] = vi.mocked(fetch).mock.calls[1]!
    const [batch1Call2] = vi.mocked(fetch).mock.calls[2]!
    const [batch1Call3] = vi.mocked(fetch).mock.calls[3]!
    const [batch2Call1] = vi.mocked(fetch).mock.calls[4]!
    expect(batch1Call1 as string).toContain('/people/p1/emails')
    expect(batch1Call2 as string).toContain('/people/p2/emails')
    expect(batch1Call3 as string).toContain('/people/p3/emails')
    expect(batch2Call1 as string).toContain('/people/p4/emails')
  })
})

