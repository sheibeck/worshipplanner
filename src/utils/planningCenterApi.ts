import type { Service, ServiceSlot, ScriptureRef } from '@/types/service'
import type { Song } from '@/types/song'
import { formatScriptureRef } from '@/utils/planningCenterExport'
import { fetchPassageText } from '@/utils/esvApi'

/**
 * Base URL for Planning Center API calls.
 * Always uses the /api/planningcenter proxy path.
 * In dev: Vite proxy forwards to the real API.
 * In prod: Firebase Hosting rewrite forwards to a Cloud Function proxy.
 */
export const PC_BASE_URL = '/api/planningcenter/services/v2'

/**
 * Generate a Basic Auth header from App ID and Secret.
 */
function basicAuthHeader(appId: string, secret: string): string {
  return 'Basic ' + btoa(appId + ':' + secret)
}

/**
 * Validate PC credentials by making a test API call.
 * Returns {valid: true} on success, {valid: false, error} on failure.
 */
export async function validatePcCredentials(
  appId: string,
  secret: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${PC_BASE_URL}/service_types?per_page=1`, {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    })

    if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials' }
    }

    if (!response.ok) {
      return { valid: false, error: `API error: ${response.status}` }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Network error' }
  }
}

/**
 * Fetch all service types from Planning Center.
 * Returns an array of {id, name} objects.
 */
export async function fetchServiceTypes(
  appId: string,
  secret: string,
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(`${PC_BASE_URL}/service_types?per_page=100`, {
    headers: {
      Authorization: basicAuthHeader(appId, secret),
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch service types: ${response.status}`)
  }

  const json = (await response.json()) as { data: Array<{ id: string; attributes: { name: string } }> }
  return json.data.map((st) => ({ id: st.id, name: st.attributes.name }))
}

/**
 * Fetch plan templates for a service type from Planning Center.
 * Returns an array of {id, name} objects.
 */
export async function fetchTemplates(
  appId: string,
  secret: string,
  serviceTypeId: string,
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plan_templates?per_page=100`,
    {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.status}`)
  }
  const json = (await response.json()) as {
    data: Array<{ id: string; attributes: { name: string } }>
  }
  return json.data.map((t) => ({ id: t.id, name: t.attributes.name }))
}

/**
 * Fetch teams configured for a service type.
 * Returns an array of {id, name} objects.
 */
export async function fetchServiceTypeTeams(
  appId: string,
  secret: string,
  serviceTypeId: string,
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/teams?per_page=100`,
    {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.status}`)
  }
  const json = (await response.json()) as {
    data: Array<{ id: string; attributes: { name: string } }>
  }
  return json.data.map((t) => ({ id: t.id, name: t.attributes.name }))
}

/**
 * Fetch plans for a service type, optionally filtered to a date range.
 * Returns array of {id, title, sortDate, dates}.
 */
export async function fetchPlans(
  appId: string,
  secret: string,
  serviceTypeId: string,
  filter?: { after: string; before: string },
): Promise<Array<{ id: string; title: string; sortDate: string; dates: string }>> {
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  let url = `${PC_BASE_URL}/service_types/${serviceTypeId}/plans?order=sort_date&per_page=25`
  if (filter) {
    // PC filters are exclusive, so widen the range by 1 day on each side
    const afterDate = new Date(filter.after + 'T00:00:00')
    afterDate.setDate(afterDate.getDate() - 1)
    const beforeDate = new Date(filter.before + 'T00:00:00')
    beforeDate.setDate(beforeDate.getDate() + 1)
    url += `&filter=after,before&after=${fmtDate(afterDate)}&before=${fmtDate(beforeDate)}`
  }

  const response = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(appId, secret),
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch plans: ${response.status}`)
  }

  const json = (await response.json()) as {
    data: Array<{
      id: string
      attributes: {
        title: string
        sort_date: string
        dates: string
      }
    }>
  }

  return json.data.map((p) => ({
    id: p.id,
    title: p.attributes.title,
    sortDate: p.attributes.sort_date,
    dates: p.attributes.dates,
  }))
}

/**
 * Fetch existing items from a plan.
 * Returns id, title, sequence, and item_type for each item.
 * item_type is used to distinguish song items ('song', 'song_arrangement') from
 * other regular items ('regular', 'header') when matching for re-export.
 */
export async function fetchPlanItems(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
): Promise<Array<{ id: string; title: string; sequence: number; itemType: string }>> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items?per_page=100`,
    {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch plan items: ${response.status}`)
  }

  const json = (await response.json()) as {
    data: Array<{
      id: string
      attributes: { title: string; sequence: number; item_type: string }
    }>
  }

  return json.data.map((item) => ({
    id: item.id,
    title: item.attributes.title,
    sequence: item.attributes.sequence,
    itemType: item.attributes.item_type,
  }))
}

/**
 * Create a new plan in Planning Center.
 * Returns the plan ID.
 * Note: PC API only allows title, public, series_title, reminders_disabled on creation.
 * Dates and templates must be handled separately.
 */
export async function createPlan(
  appId: string,
  secret: string,
  serviceTypeId: string,
  title: string,
): Promise<string> {
  const response = await fetch(`${PC_BASE_URL}/service_types/${serviceTypeId}/plans`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(appId, secret),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'Plan',
        attributes: { title },
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to create plan: ${response.status} ${text}`)
  }

  const json = (await response.json()) as { data: { id: string } }
  return json.data.id
}

/**
 * Fetch items from a plan template.
 * GET /service_types/{id}/plan_templates/{templateId}/items
 */
export async function fetchTemplateItems(
  appId: string,
  secret: string,
  serviceTypeId: string,
  templateId: string,
): Promise<Array<{ title: string; itemType: string; sequence: number; description?: string; length?: number }>> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plan_templates/${templateId}/items?per_page=100`,
    {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch template items: ${response.status}`)
  }

  const json = (await response.json()) as {
    data: Array<{
      id: string
      attributes: {
        title: string
        item_type: string
        sequence: number
        length?: number
        description?: string
        html_details?: string
      }
    }>
  }

  return json.data.map((item) => ({
    title: item.attributes.title,
    itemType: item.attributes.item_type,
    sequence: item.attributes.sequence,
    length: item.attributes.length,
    description: item.attributes.html_details || item.attributes.description,
  }))
}

/**
 * Create a plan time (service time or rehearsal) on a Planning Center plan.
 * POST /service_types/{id}/plans/{planId}/plan_times
 */
export async function createPlanTime(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  params: {
    startsAt: string // ISO 8601
    endsAt: string   // ISO 8601
    timeType: 'service' | 'rehearsal' | 'other'
    name?: string
  },
): Promise<string> {
  const attributes: Record<string, unknown> = {
    starts_at: params.startsAt,
    ends_at: params.endsAt,
    time_type: params.timeType,
  }
  if (params.name) {
    attributes.name = params.name
  }

  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/plan_times`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'PlanTime',
          attributes,
        },
      }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to create plan time: ${response.status} ${text}`)
  }

  const json = (await response.json()) as { data: { id: string } }
  return json.data.id
}

/**
 * Fetch plan times for a plan.
 * Returns an array of {id, timeType} objects sorted by starts_at.
 * Used to supply a time relationship when creating needed_positions.
 */
export async function fetchPlanTimes(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
): Promise<Array<{ id: string; timeType: string }>> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/plan_times?order=starts_at`,
    {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch plan times: ${response.status}`)
  }
  const json = (await response.json()) as {
    data: Array<{ id: string; attributes: { time_type: string } }>
  }
  return json.data.map((t) => ({ id: t.id, timeType: t.attributes.time_type }))
}

/**
 * Create an item in a Planning Center plan.
 * Returns the item ID.
 *
 * When `arrangementId` is provided, the arrangement relationship is included
 * in the POST body so PC creates a proper song item linked to that arrangement.
 */
export async function createItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  params: {
    title: string
    itemType: 'song' | 'song_arrangement' | 'regular' | 'header'
    description?: string
    sequence?: number
    length?: number
    songId?: string
    arrangementId?: string
  },
): Promise<string> {
  const attributes: Record<string, unknown> = {
    title: params.title,
    item_type: params.itemType,
  }

  if (params.description) {
    attributes.html_details = params.description
  }

  if (params.sequence !== undefined) {
    attributes.sequence = params.sequence
  }

  if (params.length !== undefined) {
    attributes.length = params.length
  }

  const data: Record<string, unknown> = {
    type: 'Item',
    attributes,
  }

  const relationships: Record<string, unknown> = {}

  if (params.songId) {
    relationships.song = {
      data: { type: 'Song', id: params.songId },
    }
  }

  if (params.arrangementId) {
    relationships.arrangement = {
      data: { type: 'Arrangement', id: params.arrangementId },
    }
  }

  if (Object.keys(relationships).length > 0) {
    data.relationships = relationships
  }

  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to create item: ${response.status} ${text}`)
  }

  const json = (await response.json()) as { data: { id: string } }
  return json.data.id
}

/**
 * Update an existing item in a Planning Center plan.
 * PATCH /service_types/{id}/plans/{planId}/items/{itemId}
 */
export async function updateItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  itemId: string,
  params: {
    title?: string
    itemType?: 'song' | 'song_arrangement' | 'regular' | 'header'
    description?: string
    length?: number
  },
): Promise<void> {
  const attributes: Record<string, unknown> = {}

  if (params.title !== undefined) {
    attributes.title = params.title
  }
  if (params.itemType !== undefined) {
    attributes.item_type = params.itemType
  }
  if (params.description !== undefined) {
    attributes.html_details = params.description
  }
  if (params.length !== undefined) {
    attributes.length = params.length
  }

  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'Item',
          id: itemId,
          attributes,
        },
      }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to update item: ${response.status} ${text}`)
  }
}

/**
 * Delete an item from a plan.
 */
export async function deleteItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  itemId: string,
): Promise<void> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to delete item: ${response.status} ${text}`)
  }
}

/**
 * Add a team to a plan by creating a needed_positions resource with quantity:1
 * and a team relationship. Optionally include a time relationship when available.
 *
 * NOTE: PC API may require a time relationship depending on service type config.
 * Callers should treat failures as non-fatal (see CONTEXT.md D-05).
 */
export async function addTeamToPlan(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  teamId: string,
  timeId?: string,
): Promise<void> {
  const relationships: Record<string, unknown> = {
    team: { data: { type: 'Team', id: teamId } },
  }
  if (timeId) {
    relationships.time = { data: { type: 'PlanTime', id: timeId } }
  }
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/needed_positions`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'NeededPosition',
          attributes: { quantity: 1 },
          relationships,
        },
      }),
    },
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to add team to plan: ${response.status} ${text}`)
  }
}

/**
 * Fetch existing needed_positions (team slots) for a plan.
 * Returns the set of team IDs already assigned to the plan.
 * Used to skip teams that are already present before calling addTeamToPlan,
 * preventing duplicate needed_positions on re-export to an existing plan.
 */
export async function fetchPlanNeededPositionTeamIds(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
): Promise<Set<string>> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/needed_positions?per_page=100&include=team`,
    {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch needed positions: ${response.status}`)
  }
  const json = (await response.json()) as {
    data: Array<{
      relationships: { team: { data: { id: string } | null } }
    }>
  }
  const ids = new Set<string>()
  for (const pos of json.data) {
    const teamId = pos.relationships.team.data?.id
    if (teamId) ids.add(teamId)
  }
  return ids
}

/**
 * Search Planning Center for a song by CCLI number.
 * Returns {id, title} of the first match, or null if not found.
 * Non-critical lookup — returns null on any error.
 */
export async function searchSongByCcli(
  appId: string,
  secret: string,
  ccliNumber: string,
): Promise<{ id: string; title: string } | null> {
  try {
    const response = await fetch(
      `${PC_BASE_URL}/songs?where[ccli_number]=${ccliNumber}`,
      {
        headers: {
          Authorization: basicAuthHeader(appId, secret),
          Accept: 'application/json',
        },
      },
    )

    if (!response.ok) return null

    const json = (await response.json()) as {
      data: Array<{ id: string; attributes: { title: string } }>
    }

    const first = json.data[0]
    if (!first) return null

    return { id: first.id, title: first.attributes.title }
  } catch {
    return null
  }
}

/**
 * Fetch arrangements for a Planning Center song.
 * Returns array of {id, name, key}. Returns empty array on error.
 */
export async function fetchSongArrangements(
  appId: string,
  secret: string,
  pcSongId: string,
): Promise<Array<{ id: string; name: string; key: string }>> {
  const headers = {
    Authorization: basicAuthHeader(appId, secret),
    Accept: 'application/json',
  }
  const url = `${PC_BASE_URL}/songs/${pcSongId}/arrangements?per_page=25`
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers })
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 60_000
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      if (!response.ok) return []
      const json = (await response.json()) as {
        data: Array<{ id: string; attributes: { name: string; chord_chart_key: string | null } }>
      }
      return json.data.map((a) => ({
        id: a.id,
        name: a.attributes.name,
        key: a.attributes.chord_chart_key ?? '',
      }))
    } catch {
      return []
    }
  }
  return []
}

/**
 * Fetch the last scheduled item for a PC song, including its item_notes.
 * Uses song_schedules to find the most recent usage, then fetches that item.
 * Returns null when the song has no prior schedule history or on any error.
 */
export async function fetchLastScheduledItem(
  appId: string,
  secret: string,
  pcSongId: string,
): Promise<{ notes: Array<{ categoryId: string; content: string }> } | null> {
  try {
    const scheduleResponse = await fetch(
      `${PC_BASE_URL}/songs/${pcSongId}/song_schedules?filter=three_most_recent&order=-plan_sort_date&per_page=1`,
      {
        headers: {
          Authorization: basicAuthHeader(appId, secret),
          Accept: 'application/json',
        },
      },
    )

    if (!scheduleResponse.ok) return null

    const scheduleJson = (await scheduleResponse.json()) as {
      data: Array<{
        id: string
        relationships: {
          item: { data: { id: string } }
          plan: { data: { id: string } }
          service_type: { data: { id: string } }
        }
      }>
    }

    const schedule = scheduleJson.data[0]
    if (!schedule) return null

    const itemId = schedule.relationships.item.data.id
    const planId = schedule.relationships.plan.data.id
    const serviceTypeId = schedule.relationships.service_type.data.id

    const itemResponse = await fetch(
      `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}?include=item_notes`,
      {
        headers: {
          Authorization: basicAuthHeader(appId, secret),
          Accept: 'application/json',
        },
      },
    )

    if (!itemResponse.ok) return null

    const itemJson = (await itemResponse.json()) as {
      data: { attributes: Record<string, unknown> }
      included?: Array<{
        type: string
        attributes: { content: string }
        relationships: { item_note_category: { data: { id: string } } }
      }>
    }

    const notes = (itemJson.included ?? [])
      .filter((inc) => inc.type === 'ItemNote' && inc.attributes.content?.trim())
      .map((inc) => ({
        categoryId: inc.relationships.item_note_category.data.id,
        content: inc.attributes.content,
      }))

    return { notes }
  } catch {
    return null
  }
}

/**
 * Create an item note on a Planning Center plan item.
 * POST /service_types/{stId}/plans/{planId}/items/{itemId}/item_notes
 * 422 errors are expected when PC already has a note for that category — ignored by caller.
 */
export async function createItemNote(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  itemId: string,
  categoryId: string,
  content: string,
): Promise<void> {
  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items/${itemId}/item_notes`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'ItemNote',
          attributes: {
            item_note_category_id: categoryId,
            content,
          },
        },
      }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to create item note: ${response.status} ${text}`)
  }
}

/**
 * Build a plan title from a service.
 * Format: "Sermon Scripture (Teams)" or "Service Name" or "Service" as fallback.
 */
export function buildPlanTitle(service: Pick<Service, 'sermonPassage' | 'name' | 'teams'>): string {
  let base: string
  if (service.sermonPassage) {
    base = formatScriptureRef(service.sermonPassage)
  } else if (service.name && service.name.trim() !== '') {
    base = service.name.trim()
  } else {
    base = 'Service'
  }

  if (service.teams && service.teams.length > 0) {
    return `${base} (${service.teams.join(', ')})`
  }

  return base
}

/**
 * Add a service slot as a Planning Center item.
 * Maps each SlotKind to the appropriate item type and attributes.
 */
export async function addSlotAsItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  slot: ServiceSlot,
  sequence: number,
  songs: Song[],
  sermonPassage?: ScriptureRef | null,
  length?: number,
): Promise<string> {
  if (slot.kind === 'SONG') {
    // Skip empty song slots (no songId assigned)
    if (!slot.songId) {
      return ''
    }
    const title = `Worship Song - ${slot.songTitle ?? '[Empty Song]'}`

    // Look up PC song and arrangement BEFORE creating the item so we can include them in the POST
    let pcSongId: string | undefined
    let arrangementId: string | undefined
    let lastItemNotes: Array<{ categoryId: string; content: string }> = []
    try {
      const song = songs.find((s) => s.id === slot.songId)
      if (song && song.ccliNumber) {
        const pcSong = await searchSongByCcli(appId, secret, song.ccliNumber)
        if (pcSong) {
          pcSongId = pcSong.id
          const arrangements = await fetchSongArrangements(appId, secret, pcSong.id)
          if (arrangements.length > 0 && arrangements[0]) {
            arrangementId = arrangements[0].id
          }
          // Fetch last scheduled item to carry forward item note categories
          const lastItem = await fetchLastScheduledItem(appId, secret, pcSong.id)
          if (lastItem) {
            lastItemNotes = lastItem.notes
          }
        }
      }
    } catch {
      // Non-fatal: fall through and create item without song link
    }

    const newItemId = await createItem(appId, secret, serviceTypeId, planId, {
      title,
      itemType: pcSongId ? 'song' : 'song_arrangement',
      sequence,
      length,
      songId: pcSongId,
      arrangementId,
    })

    // Copy item notes (per category) from last scheduled item
    for (const note of lastItemNotes) {
      try {
        await createItemNote(appId, secret, serviceTypeId, planId, newItemId, note.categoryId, note.content)
      } catch {
        // Non-fatal: 422 expected when category already exists
      }
    }

    return newItemId
  }

  if (slot.kind === 'HYMN') {
    const numPart = slot.hymnNumber ? ` #${slot.hymnNumber}` : ''
    const versesPart = slot.verses ? ` (vv. ${slot.verses})` : ''
    const title = `Worship Song - ${slot.hymnName}${numPart}${versesPart}`
    return createItem(appId, secret, serviceTypeId, planId, {
      title,
      itemType: 'song_arrangement',
      sequence,
      length,
    })
  }

  if (slot.kind === 'SCRIPTURE') {
    const verseRange =
      slot.verseStart && slot.verseEnd ? `:${slot.verseStart}-${slot.verseEnd}` : ''
    const refText = `${slot.book ?? ''} ${slot.chapter ?? ''}${verseRange}`.trim()
    const title = `Scripture - ${refText}`

    let description: string | undefined
    try {
      description = await fetchPassageText(refText)
    } catch {
      // silently ignore ESV fetch errors
    }

    return createItem(appId, secret, serviceTypeId, planId, {
      title,
      itemType: 'regular',
      description,
      sequence,
      length,
    })
  }

  if (slot.kind === 'PRAYER') {
    return createItem(appId, secret, serviceTypeId, planId, {
      title: 'Prayer',
      itemType: 'regular',
      sequence,
    })
  }

  // MESSAGE
  const description =
    sermonPassage ? formatScriptureRef(sermonPassage) : undefined

  return createItem(appId, secret, serviceTypeId, planId, {
    title: 'Message',
    itemType: 'regular',
    description,
    sequence,
  })
}
