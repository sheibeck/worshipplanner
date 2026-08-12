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
 * Factory function to create a new slot of the given kind.
 * Position defaults to 0 — it will be set to the array index via reindexSlots.
 */
export function createSlot(
  kind: SlotKind,
  vwType?: VWType,
  section?: ServiceSection,
  body?: string,
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
      return { kind: 'MISC', id, position: 0, ...bodyFields, ...sectionFields } as NonAssignableSlot
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
 * buckets, plus a trailing `legacy` bucket for members whose section is
 * absent or not a recognized `SERVICE_SECTIONS` member (D005). Total and
 * stable: every input item lands in exactly one bucket, in its original
 * relative order within that bucket — nothing is dropped, cloned, or
 * reordered within a bucket.
 *
 * Generic on purpose: the editor view groups `{ slot, index }` pairs for
 * rendering while a reorder handler groups bare `ServiceSlot`s for
 * persistence, and both must use the identical bucketing rule.
 *
 * Every `SERVICE_SECTIONS` key is initialized to an empty array up front, so
 * an empty section is always present as a key — this is what lets the view
 * render an empty section unconditionally (R043), and it's why the "adding a
 * fifth section" story is free: this function iterates `SERVICE_SECTIONS`
 * and never names a section as a string literal.
 *
 * `legacy` mirrors the trailing "Ungrouped" bucket `useSlideshowAssembly.ts`'s
 * `assembledSections` (lines 544-559) already ships for section-less slides —
 * do not invent a second placement rule for section-less members. A section
 * value that is present but outside `SERVICE_SECTIONS` (production data
 * corruption, or a stale value from a since-removed section) also routes to
 * `legacy` rather than being silently dropped (T-29-03).
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
 * the one source of truth for "what order are the slots in," shared by the
 * rendered grouping and the array that gets persisted, so the two can never
 * disagree.
 *
 * Identity-preserving: when the section-major result is element-for-element
 * reference-equal to the input, returns the ORIGINAL `slots` array rather
 * than the freshly-built one. Same reason `backfillSlotIds` (above) returns
 * the original `service` reference when nothing changed — a fresh array
 * reference in an autosave-watched view manufactures a false `isDirty`, and
 * on the load path's remote-merge branch, a comparison that never converges.
 *
 * Does NOT call `reindexSlots` — ordering and position-renumbering are
 * separate concerns. Callers compose `reindexSlots(orderSlotsBySection(slots))`.
 */
export function orderSlotsBySection(slots: ServiceSlot[]): ServiceSlot[] {
  const ordered = flattenBySection(groupBySection(slots, (slot) => slot.section))

  const alreadyOrdered = ordered.length === slots.length && ordered.every((slot, index) => slot === slots[index])

  return alreadyOrdered ? slots : ordered
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
 *
 * Intentionally position-keyed, not section-count-keyed: it contains no
 * arithmetic over `SERVICE_SECTIONS.length` and no "last section" derivation,
 * so widening `SERVICE_SECTIONS` (Phase 29 adds Post-Service) does not change
 * which default section a template slot gets. Audited by reading during
 * Phase 29 plan 02 — confirmed, not assumed; pinned by the
 * `buildSlots section defaults` test block for both progressions.
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

/**
 * Reads `PROGRESSION_SLOT_TYPES[progression]` as an ORDERED SEQUENCE of VW
 * types, not a position lookup (Pitfall #2, 44-RESEARCH.md). The map's keys
 * are absolute array indices that only mean anything against `buildSlots()`'s
 * fixed 9-slot layout — sorting those keys ascending and mapping to their
 * values yields the sequence a custom (arbitrary-shape) template must walk
 * by SONG ordinal instead.
 *
 * '1-2-2-3' → [1, 2, 2, 3, 3]   '1-2-3-3' → [1, 2, 3, 3, 3]
 */
export function progressionVwTypeSequence(progression: Progression): VWType[] {
  const map = PROGRESSION_SLOT_TYPES[progression]
  return Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b)
    .map((pos) => map[pos] as VWType)
}

/**
 * Builds a new service's `ServiceSlot[]` from the church's stored
 * `defaultServiceTemplate` (R086/R087). Composes `progressionVwTypeSequence`,
 * `createSlot`, and `reindexSlots` — no duplicated logic.
 *
 * VW typing is computed HERE, at creation, and never read back from the
 * template: a running `songOrdinal` counter (starting at 0) increments only
 * on `SONG` entries, indexing `sequence[songOrdinal % sequence.length]` —
 * the modulo-cycle choice for templates with more than 5 SONG entries is a
 * deliberate discretionary decision (Open Question 1 / Assumption A1 in
 * 44-RESEARCH.md); the alternative considered and rejected was clamping to
 * the sequence's last value instead of cycling. When `vwModeEnabled` is
 * false, `vwType` is left `undefined` so `createSlot`'s own `?? 2` default
 * applies — the ordinal sequence is not consulted at all in that case.
 *
 * An entry whose `kind` is not a recognized `SlotKind` is skipped (T-44-03
 * defensive guard) rather than passed into `createSlot`'s exhaustive switch.
 *
 * An empty `entries` array returns `[]` — buildSlotsFromTemplate is NEVER a
 * vehicle for reinstating `buildSlots()` as a fallback; that call is the
 * caller's decision. Under R115, `services.ts::createService` DOES resolve a
 * fallback (empty stored template → `buildSuggestedTemplateEntries()`), but it
 * does so at the call site before calling this function — this function stays
 * pure (`[]` → `[]`, pinned by `slotTypes.test.ts:798`).
 *
 * An entry's optional `body` (R116) is threaded through to `createSlot` for
 * body-bearing kinds; a bodyless entry leaves the created slot's `body` key
 * absent.
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
    slots.push(createSlot(entry.kind, vwType, entry.section, entry.body))
  }
  return reindexSlots(slots)
}

/**
 * Builds the Suggested Template's `ServiceTemplateEntry[]` — the single shared
 * definition of the suggested-template content (R114 button `applyReset` in
 * plan 52-02 and the R115 `createService` empty-template fallback BOTH call
 * this, so the preset can never fork into two copies).
 *
 * Derived from `buildSlots('1-2-2-3')` so the suggested order and section
 * defaults stay in lockstep with the canonical progression preset. Fresh
 * `crypto.randomUUID()` ids are minted per call (the editor draft needs unique
 * per-row keys; `buildSlotsFromTemplate` never reads `entry.id`, so fresh ids
 * are harmless on the createService path). Carries no `body` — the suggested
 * entries are bodyless; a church adds recurring MISC body text itself.
 */
export function buildSuggestedTemplateEntries(): ServiceTemplateEntry[] {
  return buildSlots('1-2-2-3').map((slot) => ({
    id: crypto.randomUUID(),
    kind: slot.kind,
    ...(slot.section ? { section: slot.section } : {}),
  }))
}
