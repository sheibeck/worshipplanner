import type { Service, ServiceSlot, ScriptureRef } from '@/types/service'
import type { Song } from '@/types/song'
import { formatScriptureRef } from '@/utils/planningCenterExport'
import { fetchPassageText } from '@/utils/esvApi'

/**
 * Base URL for Planning Center API calls.
 * Uses a dev proxy in development to avoid CORS issues.
 */
export const PC_BASE_URL = import.meta.env.DEV
  ? '/api/planningcenter/services/v2'
  : 'https://api.planningcenteronline.com/services/v2'

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
 * Create a new plan in Planning Center.
 * Returns the plan ID.
 */
export async function createPlan(
  appId: string,
  secret: string,
  serviceTypeId: string,
  title: string,
  dates?: string,
): Promise<string> {
  const attributes: Record<string, string> = { title }
  if (dates) attributes.dates = dates

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
        attributes,
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
 * Create an item in a Planning Center plan.
 * Returns the item ID.
 */
export async function createItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  params: {
    title: string
    itemType: 'song_arrangement' | 'regular'
    description?: string
    sequence?: number
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

  const response = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'Item',
          attributes,
        },
      }),
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
): Promise<string> {
  if (slot.kind === 'SONG') {
    // Skip empty song slots (no songId assigned)
    if (!slot.songId) {
      return ''
    }
    const title = slot.songTitle
      ? `${slot.songTitle} (Key: ${slot.songKey ?? ''})`
      : '[Empty Song]'
    return createItem(appId, secret, serviceTypeId, planId, {
      title,
      itemType: 'song_arrangement',
      sequence,
    })
  }

  if (slot.kind === 'HYMN') {
    const numPart = slot.hymnNumber ? ` #${slot.hymnNumber}` : ''
    const title = `${slot.hymnName}${numPart}`
    return createItem(appId, secret, serviceTypeId, planId, {
      title,
      itemType: 'song_arrangement',
      sequence,
    })
  }

  if (slot.kind === 'SCRIPTURE') {
    const verseRange =
      slot.verseStart && slot.verseEnd ? `:${slot.verseStart}-${slot.verseEnd}` : ''
    const title = `${slot.book ?? ''} ${slot.chapter ?? ''}${verseRange}`.trim()

    let description: string | undefined
    try {
      description = await fetchPassageText(title)
    } catch {
      // silently ignore ESV fetch errors
    }

    return createItem(appId, secret, serviceTypeId, planId, {
      title,
      itemType: 'regular',
      description,
      sequence,
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
