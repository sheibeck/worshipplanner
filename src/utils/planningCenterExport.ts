import type { Service } from '@/types/service'
import type { Song } from '@/types/song'
import type { ScriptureRef } from '@/types/service'

// Human-readable labels for each of the 9 service slots
const SLOT_EXPORT_LABELS: Record<number, string> = {
  0: 'Song 1 (Call to Worship)',
  1: 'Scripture',
  2: 'Song 2',
  3: 'Prayer',
  4: 'Scripture',
  5: 'Song 3',
  6: 'Song 4',
  7: 'Message',
  8: 'Sending Song',
}

/**
 * Format a ScriptureRef as "Book Chapter:VerseStart-VerseEnd"
 */
export function formatScriptureRef(ref: ScriptureRef): string {
  return `${ref.book} ${ref.chapter}:${ref.verseStart}-${ref.verseEnd}`
}

/**
 * Format a service date string ("YYYY-MM-DD") as "Month Day, Year"
 * e.g., "2026-03-08" => "March 8, 2026"
 */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format a service as a plain-text block suitable for Planning Center manual entry.
 *
 * @param service - The service to format
 * @param songs - The full songs array (used for CCLI number lookup)
 * @returns A multi-line plain text string
 */
export function formatForPlanningCenter(service: Service, songs: Song[]): string {
  const songMap = new Map<string, Song>(songs.map((s) => [s.id, s]))

  const lines: string[] = []

  // Header
  lines.push(`ORDER OF SERVICE -- ${formatDate(service.date)}`)
  if (service.name) {
    lines.push(service.name)
  }
  lines.push(`Teams: ${service.teams.length > 0 ? service.teams.join(', ') : 'Standard Band'}`)
  lines.push(`Progression: ${service.progression}`)
  lines.push('')

  // Slots
  for (const slot of service.slots) {
    const label = SLOT_EXPORT_LABELS[slot.position] ?? `Slot ${slot.position}`

    if (slot.kind === 'SONG') {
      if (!slot.songId) {
        lines.push(`${label} -- [empty]`)
      } else {
        const song = songMap.get(slot.songId)
        if (!song) {
          lines.push(`${label} -- [empty]`)
        } else {
          const keyPart = `Key: ${slot.songKey}`
          const ccliPart = song.ccliNumber ? ` | CCLI #${song.ccliNumber}` : ''
          lines.push(`${label} -- ${song.title} (${keyPart}${ccliPart})`)
        }
      }
    } else if (slot.kind === 'SCRIPTURE') {
      if (!slot.book) {
        lines.push(`${label} -- [empty]`)
      } else {
        lines.push(
          `${label} -- ${slot.book} ${slot.chapter}:${slot.verseStart}-${slot.verseEnd}`,
        )
      }
    } else if (slot.kind === 'PRAYER') {
      lines.push('Prayer')
    } else if (slot.kind === 'MESSAGE') {
      if (service.sermonPassage) {
        lines.push(`Message -- ${formatScriptureRef(service.sermonPassage)}`)
      } else {
        lines.push('Message')
      }
    }
  }

  // Notes
  if (service.notes) {
    lines.push('')
    lines.push('Notes:')
    lines.push(service.notes)
  }

  return lines.join('\n')
}
