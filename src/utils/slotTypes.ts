import type { Progression, ServiceSlot, SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ImportedSlot, SlotKind, ServiceSection } from '@/types/service'
import type { VWType } from '@/types/song'

export const PROGRESSION_SLOT_TYPES: Record<Progression, Record<number, VWType>> = {
  '1-2-2-3': {
    0: 1, // Song 1 — Call to Worship
    2: 2, // Song 2 — Intimate
    5: 2, // Song 3 — Intimate
    6: 3, // Song 4 — Ascription
    8: 3, // Sending Song — Ascription
  },
  '1-2-3-3': {
    0: 1, // Song 1 — Call to Worship
    2: 2, // Song 2 — Intimate
    5: 3, // Song 3 — Ascription
    6: 3, // Song 4 — Ascription
    8: 3, // Sending Song — Ascription
  },
}

/**
 * Returns a human-readable label for a slot based on its kind.
 * Replaces the old SLOT_LABELS position-keyed map.
 */
export function slotLabel(slot: ServiceSlot, _index?: number | string): string {
  switch (slot.kind) {
    case 'SONG':
      return 'Song'
    case 'SCRIPTURE':
      return 'Scripture Reading'
    case 'PRAYER':
      return 'Prayer'
    case 'MESSAGE':
      return 'Message'
    case 'HYMN':
      return 'Hymn'
    case 'IMPORTED':
      return 'Imported Slides'
  }
}

/**
 * Factory function to create a new slot of the given kind.
 * Position defaults to 0 — it will be set to the array index via reindexSlots.
 */
export function createSlot(kind: SlotKind, vwType?: VWType, section?: ServiceSection): ServiceSlot {
  // Omit the `section` key entirely when not provided — preserves the legacy
  // (section === undefined, key absent) shape for backward compatibility.
  const sectionFields = section ? { section } : {}
  switch (kind) {
    case 'SONG':
      return {
        kind: 'SONG',
        position: 0,
        requiredVwType: vwType ?? 2,
        songId: null,
        songTitle: null,
        songKey: null,
        ...sectionFields,
      } as SongSlot
    case 'SCRIPTURE':
      return {
        kind: 'SCRIPTURE',
        position: 0,
        book: null,
        chapter: null,
        verseStart: null,
        verseEnd: null,
        ...sectionFields,
      } as ScriptureSlot
    case 'PRAYER':
      return { kind: 'PRAYER', position: 0, ...sectionFields } as NonAssignableSlot
    case 'MESSAGE':
      return { kind: 'MESSAGE', position: 0, ...sectionFields } as NonAssignableSlot
    case 'HYMN':
      return { kind: 'HYMN', position: 0, hymnName: '', hymnNumber: '', verses: '', ...sectionFields } as HymnSlot
    case 'IMPORTED':
      return { kind: 'IMPORTED', position: 0, importId: null, ...sectionFields } as ImportedSlot
  }
}

/**
 * Normalizes slot positions to match their array index.
 * Call this after any add, remove, or reorder operation.
 */
export function reindexSlots(slots: ServiceSlot[]): ServiceSlot[] {
  return slots.map((slot, index) => ({ ...slot, position: index }))
}

/**
 * Default position -> section mapping for the M001 progression template (D005).
 * There is no default Pre-Service slot in the template (announcements arrive
 * in Phase 21) — positions 0-6 are 'worship', 7 (MESSAGE) is 'message',
 * 8 (sending song) is 'sending'.
 */
function defaultSectionForPosition(position: number): ServiceSection {
  if (position === 7) return 'message'
  if (position === 8) return 'sending'
  return 'worship'
}

export function buildSlots(progression: Progression): ServiceSlot[] {
  const songTypeMap = PROGRESSION_SLOT_TYPES[progression]

  const songSlot = (position: number): SongSlot => ({
    kind: 'SONG',
    position,
    requiredVwType: songTypeMap[position] as VWType,
    songId: null,
    songTitle: null,
    songKey: null,
    section: defaultSectionForPosition(position),
  })

  const scriptureSlot = (position: number): ScriptureSlot => ({
    kind: 'SCRIPTURE',
    position,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    section: defaultSectionForPosition(position),
  })

  const nonAssignableSlot = (
    kind: 'PRAYER' | 'MESSAGE',
    position: number,
  ): NonAssignableSlot => ({
    kind,
    position,
    section: defaultSectionForPosition(position),
  })

  return [
    songSlot(0),
    scriptureSlot(1),
    songSlot(2),
    nonAssignableSlot('PRAYER', 3),
    scriptureSlot(4),
    songSlot(5),
    songSlot(6),
    nonAssignableSlot('MESSAGE', 7),
    songSlot(8),
  ]
}
