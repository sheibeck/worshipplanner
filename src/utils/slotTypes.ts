import type { Progression, Service, ServiceSlot, SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot, ImportedSlot, SlotKind, ServiceSection } from '@/types/service'
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
  // `id` is ALWAYS written (D-01) — unlike `section`, there is no legacy
  // absent-id shape to preserve for a brand-new slot; every new slot gets a
  // real, stable id immediately.
  const id = crypto.randomUUID()
  switch (kind) {
    case 'SONG':
      return {
        kind: 'SONG',
        id,
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
        id,
        position: 0,
        book: null,
        chapter: null,
        verseStart: null,
        verseEnd: null,
        ...sectionFields,
      } as ScriptureSlot
    case 'PRAYER':
      return { kind: 'PRAYER', id, position: 0, ...sectionFields } as NonAssignableSlot
    case 'MESSAGE':
      return { kind: 'MESSAGE', id, position: 0, ...sectionFields } as NonAssignableSlot
    case 'HYMN':
      return { kind: 'HYMN', id, position: 0, hymnName: '', hymnNumber: '', verses: '', ...sectionFields } as HymnSlot
    case 'IMPORTED':
      return { kind: 'IMPORTED', id, position: 0, importId: null, ...sectionFields } as ImportedSlot
  }
}

/**
 * Normalizes slot positions to match their array index.
 * Call this after any add, remove, or reorder operation.
 *
 * NO CHANGE needed for `id` (D-01): the spread (`{ ...slot, position: index }`)
 * already carries every existing key — including `id` — through every
 * reorder. Do not "helpfully" rebuild the slot object here; that would
 * re-mint or drop the stable id a slide group is anchored to.
 */
export function reindexSlots(slots: ServiceSlot[]): ServiceSlot[] {
  return slots.map((slot, index) => ({ ...slot, position: index }))
}

/**
 * Backfills a missing `ServiceSlot.id` (D-01) for services read before this
 * field existed. Pure — returns the ORIGINAL `service` object reference when
 * every slot already has an id, so folding this into a load watcher can never
 * manufacture a false `isDirty`.
 *
 * Two-argument form (a planner correction to a single-argument backfill):
 * `ServiceEditorView`'s load watcher has a remote-merge branch that compares
 * `JSON.stringify(remote)` against `JSON.stringify(local)`. A legacy
 * Firestore document has no slot ids, so a one-argument backfill would mint
 * fresh UUIDs on every snapshot; the comparison would never match, and each
 * snapshot would re-anchor every group to a brand-new slot id, silently
 * orphaning group documents. Reusing the `reference` service's id at the
 * same array index (guarded by matching `kind`) makes the comparison stable.
 *
 * Accepted residual limitation: if a concurrent editor inserts or removes a
 * slot in the same window, positional alignment can shift and one slot may
 * take a fresh id. The window closes permanently on the first real save,
 * which persists the ids to Firestore.
 */
export function backfillSlotIds(service: Service, reference?: Service | null): Service {
  let changed = false
  const slots = service.slots.map((slot, index) => {
    if (slot.id) return slot
    const refSlot = reference?.slots[index]
    const id = refSlot && refSlot.id && refSlot.kind === slot.kind ? refSlot.id : crypto.randomUUID()
    changed = true
    return { ...slot, id }
  })
  return changed ? { ...service, slots } : service
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
    id: crypto.randomUUID(),
    position,
    requiredVwType: songTypeMap[position] as VWType,
    songId: null,
    songTitle: null,
    songKey: null,
    section: defaultSectionForPosition(position),
  })

  const scriptureSlot = (position: number): ScriptureSlot => ({
    kind: 'SCRIPTURE',
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
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
