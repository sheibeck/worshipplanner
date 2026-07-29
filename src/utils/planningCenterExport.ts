import type { Service } from '@/types/service'
import type { Song } from '@/types/song'
import type { ScriptureRef } from '@/types/service'
import { formatScriptureReference, scriptureRefFromSlot } from '@/utils/scripture'

/**
 * Format a ScriptureRef as "Book Chapter:VerseStart-VerseEnd".
 *
 * Delegates to `scripture.ts`'s canonical formatter so the export text and the
 * projector slide (R047) can never drift apart. A single-verse reference
 * renders "Romans 8:28" rather than collapsing to "Romans 8", and a degenerate
 * range ("John 3:16-16") collapses to "John 3:16" the way every other surface
 * already renders it (HI-02).
 */
export function formatScriptureRef(ref: ScriptureRef): string {
  return formatScriptureReference(ref)
}

/**
 * Format a service date string ("YYYY-MM-DD") as "Month Day, Year"
 * e.g., "2026-03-08" => "March 8, 2026"
 */
function formatDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
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

  // Track song count for sequential labeling
  let songCount = 0

  // Slots
  for (const slot of service.slots) {
    if (slot.kind === 'SONG') {
      songCount++
      const label = `Song ${songCount}`
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
      const label = 'Scripture'
      // ME-01: routed through the canonical primitives rather than the old
      // inline `verseStart && verseEnd` rule, which dropped the verse entirely
      // from a single-verse reading (verseEnd is null unless the reference is a
      // RANGE) and so exported "Scripture -- Romans 8" for a slide reading
      // "Romans 8:28". Only the sermon-passage path had been delegated.
      const ref = scriptureRefFromSlot(slot)
      if (!ref) {
        lines.push(`${label} -- [empty]`)
      } else {
        lines.push(`${label} -- ${formatScriptureReference(ref)}`)
      }
    } else if (slot.kind === 'PRAYER') {
      lines.push('Prayer')
    } else if (slot.kind === 'MESSAGE') {
      if (service.sermonPassage) {
        lines.push(`Message -- ${formatScriptureRef(service.sermonPassage)}`)
      } else {
        lines.push('Message')
      }
    } else if (slot.kind === 'HYMN') {
      if (!slot.hymnName) {
        lines.push('Hymn -- [empty]')
      } else {
        const numPart = slot.hymnNumber ? ` #${slot.hymnNumber}` : ''
        const versesPart = slot.verses ? ` (vv. ${slot.verses})` : ''
        lines.push(`Hymn -- ${slot.hymnName}${numPart}${versesPart}`)
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
