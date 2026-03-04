export async function fetchPassageText(query: string): Promise<string> {
  const params = new URLSearchParams({
    q: query,
    'include-headings': 'false',
    'include-footnotes': 'false',
    'include-verse-numbers': 'true',
    'include-short-copyright': 'false',
    'include-passage-references': 'false',
  })

  const response = await fetch(`https://api.esv.org/v3/passage/text/?${params.toString()}`, {
    headers: {
      Authorization: `Token ${import.meta.env.VITE_ESV_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch passage')
  }

  const data = (await response.json()) as { passages: string[] }
  return data.passages[0]?.trim() ?? ''
}
