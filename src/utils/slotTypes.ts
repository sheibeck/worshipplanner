import {
  SERVICE_SECTIONS,
  type Progression,
  type Service,
  type ServiceSlot,
  type SongSlot,
  type ScriptureSlot,
  type NonAssignableSlot,
  type HymnSlot,
  type ImportedSlot,
  type SlotKind,
  type ServiceSection,
} from '@/types/service'
import type { VWType } from '@/types/song'
import type { ServiceTemplateEntry } from '@/types/organization'

/** Every SlotKind value, for the T-44-03 defensive guard in
 *  `buildSlotsFromTemplate` — a stored template entry with a `kind` outside
 *  this set (e.g. tampered/corrupt data) is skipped rather than passed into
 *  `createSlot`'s exhaustive switch. */
const KNOWN_SLOT_KINDS: readonly SlotKind[] = [
  'SONG',
  'SCRIPTURE',
  'PRAYER',
  'MESSAGE',
  'ANNOUNCEMENTS',
  'MISC',
  'HYMN',
  'IMPORTED',
]

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
    case 'ANNOUNCEMENTS':
      return 'Announcements'
    case 'MISC':
      return 'Miscellaneous'
    case 'HYMN':
      return 'Hymn'
    case 'IMPORTED':
      return 'Imported Slides'
  }
}

/**
 * The MISC item's displayed name (R127, Phase 56). Returns the slot's custom
 * `label` when set (trimmed), else the default "Miscellaneous". This is the
 * SINGLE helper used by the editor display, the PC export title, and print, so
 * "label-or-Miscellaneous" can never diverge across surfaces (D-01). A
 * whitespace-only or absent label coerces to "Miscellaneous" — the same value
 * that shipped before this field existed.
 */
export function miscLabel(slot: NonAssignableSlot): string {
  return slot.label?.trim() || 'Miscellaneous'
}

/**
 * The single per-kind pill-tint source (260811-vsr / DESIGN-SPEC), shared by
 * BOTH ServiceEditorView.vue and ServiceTemplateEditor.vue so the two editors'
 * badge colors can never fork (Phase 57, D — "share, don't fork"). Maps each
 * SlotKind to the app's muted/dark gray+indigo Tailwind theme (not the mockup's
 * raw hex). Returns a byte-identical class string to the local copy this was
 * extracted from — behavior-identical, no test change.
 */
export function kindBadgeClass(kind: SlotKind): string {
  switch (kind) {
    case 'SONG': return 'bg-indigo-950 border border-indigo-800 text-indigo-300'
    case 'SCRIPTURE': return 'bg-cyan-950 border border-cyan-800 text-cyan-300'
    case 'ANNOUNCEMENTS':
    case 'MESSAGE': return 'bg-rose-950 border border-rose-900 text-rose-300'
    case 'PRAYER':
    case 'MISC': return 'bg-gray-800 border border-gray-600 text-gray-300'
    case 'HYMN': return 'bg-amber-950 border border-amber-900 text-amber-300'
    case 'IMPORTED': return 'bg-gray-800 border border-gray-700 text-gray-400'
    default: return 'bg-gray-800 border border-gray-600 text-gray-300'
  }
}

/**
 * Factory function to create a new slot of the given kind.
 * Position defaults to 0 — it will be set to the array index via reindexSlots.
 */
export function createSlot(
  kind: SlotKind,
  vwType?: VWType,
  section?: ServiceSection,
  body?: string,
  label?: string,
): ServiceSlot {
  // Omit the `section` key entirely when not provided — preserves the legacy
  // (section === undefined, key absent) shape for backward compatibility.
  const sectionFields = section ? { section } : {}
  // Omit the `body` key entirely when not provided (R116) — a bodyless MISC/
  // ANNOUNCEMENTS/MESSAGE slot must keep the SAME absent-body shape as every
  // stored legacy slot (`'body' in slot === false`, pinned by tests @643/@656).
  // NEVER set `body: ''` or `body: undefined` — Firestore rejects raw
  // `undefined`, and an empty string would break the absent-key contract.
  const bodyFields = body ? { body } : {}
  // Omit the `label` key entirely when not provided (R127, Phase 56) — a MISC
  // slot created with no custom label must keep the SAME absent-label shape as
  // every legacy MISC slot (`'label' in slot === false`). NEVER set `label: ''`
  // or `label: undefined` — Firestore rejects raw `undefined`, and an empty
  // string would break the absent-key contract. MISC-only per D-01.
  const labelFields = label ? { label } : {}
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
      return { kind: 'MESSAGE', id, position: 0, ...bodyFields, ...sectionFields } as NonAssignableSlot
    case 'ANNOUNCEMENTS':
      return { kind: 'ANNOUNCEMENTS', id, position: 0, ...bodyFields, ...sectionFields } as NonAssignableSlot
    case 'MISC':
      return { kind: 'MISC', id, position: 0, ...bodyFields, ...labelFields, ...sectionFields } as NonAssignableSlot
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
 * Groups any section-bearing collection into `SERVICE_SECTIONS`-ordered
 * buckets, plus a trailing `legacy` bucket (D005). Total and stable — nothing
 * is dropped, cloned, or reordered within a bucket. Generic on purpose so the
 * editor view and a reorder handler share the identical bucketing rule.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slotTypes.ts)
 */
export function groupBySection<T>(
  items: readonly T[],
  getSection: (item: T) => ServiceSection | undefined,
): { sections: Record<ServiceSection, T[]>; legacy: T[] } {
  const sections = Object.fromEntries(SERVICE_SECTIONS.map((section) => [section, [] as T[]])) as Record<
    ServiceSection,
    T[]
  >
  const legacy: T[] = []

  for (const item of items) {
    const section = getSection(item)
    if (section !== undefined && SERVICE_SECTIONS.includes(section)) {
      sections[section].push(item)
    } else {
      legacy.push(item)
    }
  }

  return { sections, legacy }
}

/**
 * Flattens a `groupBySection` result back into a single array: the section
 * buckets concatenated in `SERVICE_SECTIONS` order, then the `legacy` bucket
 * last. Pure — never mutates the input buckets.
 */
export function flattenBySection<T>(grouped: { sections: Record<ServiceSection, T[]>; legacy: T[] }): T[] {
  const result: T[] = []
  for (const section of SERVICE_SECTIONS) {
    result.push(...grouped.sections[section])
  }
  result.push(...grouped.legacy)
  return result
}

/**
 * Composition of `groupBySection` + `flattenBySection` over `slot.section` —
 * the one source of truth for "what order are the slots in." Identity-
 * preserving: returns the ORIGINAL `slots` array when nothing changed (avoids
 * a false `isDirty`). Does NOT call `reindexSlots` — callers compose
 * `reindexSlots(orderSlotsBySection(slots))`.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slotTypes.ts)
 */
export function orderSlotsBySection(slots: ServiceSlot[]): ServiceSlot[] {
  const ordered = flattenBySection(groupBySection(slots, (slot) => slot.section))

  const alreadyOrdered = ordered.length === slots.length && ordered.every((slot, index) => slot === slots[index])

  return alreadyOrdered ? slots : ordered
}

/**
 * Backfills a missing `ServiceSlot.id` (D-01) for services read before this
 * field existed. Pure — returns the ORIGINAL `service` reference when every
 * slot already has an id. Accepted residual limitation: a concurrent editor
 * insert/remove in the same window can shift positional alignment.
 * See .planning/codebase/CONCERNS.md (Utils Concern Notes — src/utils/slotTypes.ts)
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
 * Default position -> section mapping for the M001 progression template
 * (D005): positions 0-6 'worship', 7 (MESSAGE) 'message', 8 (sending) 'sending'.
 * Intentionally position-keyed, not section-count-keyed, so widening
 * `SERVICE_SECTIONS` does not change which default section a slot gets.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slotTypes.ts)
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

/** See ADR-0203 (docs/adr/0203-reads-progressionslottypes-progression-as-an-ordered-sequenc.md) */
export function progressionVwTypeSequence(progression: Progression): VWType[] {
  const map = PROGRESSION_SLOT_TYPES[progression]
  return Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b)
    .map((pos) => map[pos] as VWType)
}

/**
 * Builds a new service's `ServiceSlot[]` from the church's stored
 * `defaultServiceTemplate` (R086/R087). VW typing is computed HERE, at
 * creation, via a cycling `songOrdinal` counter — never read back from the
 * template. An empty `entries` array returns `[]`; this function is NEVER a
 * vehicle for reinstating `buildSlots()` as a fallback (pinned by
 * `slotTypes.test.ts:798`).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slotTypes.ts)
 */
export function buildSlotsFromTemplate(
  entries: ServiceTemplateEntry[],
  vwModeEnabled: boolean,
  progression: Progression = '1-2-2-3',
): ServiceSlot[] {
  const sequence = progressionVwTypeSequence(progression)
  let songOrdinal = 0
  const slots: ServiceSlot[] = []
  for (const entry of entries) {
    if (!KNOWN_SLOT_KINDS.includes(entry.kind)) continue
    let vwType: VWType | undefined
    if (entry.kind === 'SONG' && vwModeEnabled) {
      vwType = sequence[songOrdinal % sequence.length]
      songOrdinal++
    }
    slots.push(createSlot(entry.kind, vwType, entry.section, entry.body, entry.label))
  }
  return reindexSlots(slots)
}

/**
 * Builds the Suggested Template's `ServiceTemplateEntry[]` — the single
 * shared definition (R114/R115) so the preset can never fork into two copies.
 * See .planning/codebase/STACK.md (Utils Stack Notes — src/utils/slotTypes.ts)
 */
export function buildSuggestedTemplateEntries(): ServiceTemplateEntry[] {
  return buildSlots('1-2-2-3').map((slot) => ({
    id: crypto.randomUUID(),
    kind: slot.kind,
    ...(slot.section ? { section: slot.section } : {}),
  }))
}
