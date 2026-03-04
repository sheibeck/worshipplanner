import type { Progression, ServiceSlot, SongSlot, ScriptureSlot, NonAssignableSlot, SlotKind } from '@/types/service'
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
export function slotLabel(slot: ServiceSlot, _index: number): string {
  switch (slot.kind) {
    case 'SONG':
      return 'Song'
    case 'SCRIPTURE':
      return 'Scripture Reading'
    case 'PRAYER':
      return 'Prayer'
    case 'MESSAGE':
      return 'Message'
  }
}

/**
 * Factory function to create a new slot of the given kind.
 * Position defaults to 0 — it will be set to the array index via reindexSlots.
 */
export function createSlot(kind: SlotKind, vwType?: VWType): ServiceSlot {
  switch (kind) {
    case 'SONG':
      return {
        kind: 'SONG',
        position: 0,
        requiredVwType: vwType ?? 2,
        songId: null,
        songTitle: null,
        songKey: null,
      } as SongSlot
    case 'SCRIPTURE':
      return {
        kind: 'SCRIPTURE',
        position: 0,
        book: null,
        chapter: null,
        verseStart: null,
        verseEnd: null,
      } as ScriptureSlot
    case 'PRAYER':
      return { kind: 'PRAYER', position: 0 } as NonAssignableSlot
    case 'MESSAGE':
      return { kind: 'MESSAGE', position: 0 } as NonAssignableSlot
  }
}

/**
 * Normalizes slot positions to match their array index.
 * Call this after any add, remove, or reorder operation.
 */
export function reindexSlots(slots: ServiceSlot[]): ServiceSlot[] {
  return slots.map((slot, index) => ({ ...slot, position: index }))
}

export function buildSlots(progression: Progression): ServiceSlot[] {
  const songTypeMap = PROGRESSION_SLOT_TYPES[progression]

  const songSlot = (position: number): SongSlot => ({
    kind: 'SONG',
    position,
    requiredVwType: songTypeMap[position],
    songId: null,
    songTitle: null,
    songKey: null,
  })

  const scriptureSlot = (position: number): ScriptureSlot => ({
    kind: 'SCRIPTURE',
    position,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
  })

  const nonAssignableSlot = (
    kind: 'PRAYER' | 'MESSAGE',
    position: number,
  ): NonAssignableSlot => ({
    kind,
    position,
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
