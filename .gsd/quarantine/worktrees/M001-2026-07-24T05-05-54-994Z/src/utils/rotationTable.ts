import type { Service } from '@/types/service'

export interface RotationEntry {
  songId: string
  songTitle: string
  dates: string[]
}

/**
 * Computes a rotation table from an array of services.
 *
 * For each song that appears in at least one service, returns an entry with
 * the song's ID, title, and the ISO date strings of services where it appears.
 *
 * A song appearing in multiple slots within the same service is counted once
 * per service (not once per slot).
 *
 * Pure function — no Firestore reads, operates entirely on in-memory data.
 *
 * @param services - Array of service documents from the service store
 * @returns Array of RotationEntry sorted alphabetically by songTitle
 */
export function computeRotationTable(services: Service[]): RotationEntry[] {
  // Map from songId to { title, Set<date> }
  const songMap = new Map<string, { songTitle: string; dateSet: Set<string> }>()

  for (const service of services) {
    for (const slot of service.slots) {
      if (slot.kind !== 'SONG') continue
      const { songId, songTitle } = slot
      if (!songId || !songTitle) continue

      const existing = songMap.get(songId)
      if (existing) {
        existing.dateSet.add(service.date)
      } else {
        songMap.set(songId, { songTitle, dateSet: new Set([service.date]) })
      }
    }
  }

  const entries: RotationEntry[] = []
  for (const [songId, { songTitle, dateSet }] of songMap.entries()) {
    entries.push({
      songId,
      songTitle,
      dates: Array.from(dateSet),
    })
  }

  // Sort alphabetically by songTitle
  entries.sort((a, b) => a.songTitle.localeCompare(b.songTitle))

  return entries
}
