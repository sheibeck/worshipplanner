import type { Progression, ServiceSlot, SongSlot, ScriptureSlot, NonAssignableSlot } from '@/types/service'
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

export const SLOT_LABELS: Record<number, string> = {
  0: 'Worship Song',
  1: 'Scripture Reading',
  2: 'Worship Song',
  3: 'Prayer',
  4: 'Scripture Reading',
  5: 'Worship Song',
  6: 'Worship Song',
  7: 'Message',
  8: 'Sending Song',
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
