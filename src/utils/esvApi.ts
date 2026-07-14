import { getAppAuthHeaders } from '@/utils/appAuth'

export async function fetchPassageText(query: string): Promise<string> {
  const params = new URLSearchParams({
    q: query,
    'include-headings': 'false',
    'include-footnotes': 'false',
    'include-verse-numbers': 'true',
    'include-short-copyright': 'false',
    'include-passage-references': 'false',
  })

  // Routed through the /api/esv proxy (Cloud Function) so the ESV API key stays
  // server-side and never ships in the client bundle. The proxy injects the
  // Authorization header; we only send our app-identity token for the auth gate.
  const response = await fetch(`/api/esv/v3/passage/text/?${params.toString()}`, {
    headers: await getAppAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch passage')
  }

  const data = (await response.json()) as { passages: string[] }
  return data.passages[0]?.trim() ?? ''
}
