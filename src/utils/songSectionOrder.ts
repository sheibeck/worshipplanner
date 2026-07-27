import type { LyricSection } from '@/types/songLyrics'

/**
 * PURE module — imports only types from `@/types/songLyrics`. No Vue, no
 * store, no Firestore. Mirrors the purity contract of `slideshowAssembler.ts`.
 *
 * Establishes the section-order model Phase 28's editor is built on:
 * `sections` is an unordered POOL (each id unique), and `performanceOrder`
 * is THE ordered list of section-id references that IS the slide order
 * (D-01/D-03). A repeated id in the order is a REFERENCE to the same
 * pooled section, not a copy (D-02).
 */

/** The five quick-add kinds the option 2a mockup draws, in mockup order. */
export const ADD_SECTION_KINDS = ['Verse', 'Chorus', 'Bridge', 'Tag', 'Ending'] as const

export type AddSectionKind = (typeof ADD_SECTION_KINDS)[number]

/**
 * Separator joining a section id and its occurrence index to form a
 * `rowKey`. A slugified section id legitimately contains hyphens (the
 * Phase 18 builder's `${sectionId}-${index}` row-key form is therefore
 * unsafe here), so `#` is used instead — it cannot occur inside a
 * slugified id.
 */
const ROW_KEY_SEPARATOR = '#'

/** One row of option 2a's numbered, always-draggable section list. */
export interface SectionRow {
  /** Unique within a single `buildSectionRows` result. */
  rowKey: string
  sectionId: string
  /** The resolved pooled section this row displays. */
  section: LyricSection
  /** 1-based display number. */
  position: number
  /** 0-based count of this section id among preceding rows. */
  occurrenceIndex: number
  /** `occurrenceIndex > 0`. */
  isRepeat: boolean
  /** The 1-based position of occurrence zero, or null on a non-repeat. */
  repeatOfPosition: number | null
}

/**
 * Derives the numbered row list option 2a draws from a (sections, order)
 * pair. Skips an order id that resolves to no pooled section rather than
 * emitting a row with an undefined section. Never mutates its arguments.
 */
export function buildSectionRows(sections: LyricSection[], order: string[]): SectionRow[] {
  const pool = new Map(sections.map((section) => [section.id, section] as const))
  const occurrenceCounts = new Map<string, number>()
  const firstPositionBySectionId = new Map<string, number>()
  const rows: SectionRow[] = []

  for (const sectionId of order) {
    const section = pool.get(sectionId)
    if (!section) continue

    const occurrenceIndex = occurrenceCounts.get(sectionId) ?? 0
    occurrenceCounts.set(sectionId, occurrenceIndex + 1)

    const position = rows.length + 1
    const isRepeat = occurrenceIndex > 0
    if (!isRepeat) {
      firstPositionBySectionId.set(sectionId, position)
    }

    rows.push({
      rowKey: `${sectionId}${ROW_KEY_SEPARATOR}${occurrenceIndex}`,
      sectionId,
      section,
      position,
      occurrenceIndex,
      isRepeat,
      repeatOfPosition: isRepeat ? (firstPositionBySectionId.get(sectionId) ?? null) : null,
    })
  }

  return rows
}

/**
 * Enforces the pool/order invariants over a (sections, order) pair:
 * - the pool is de-duplicated by id, keeping the first occurrence;
 * - order ids with no pooled section are dropped;
 * - if the surviving order is empty while the pool is not, the order is
 *   seeded from the pool's stored sequence;
 * - pooled sections referenced zero times are dropped.
 *
 * This runs on the WRITE path — the editor normalises what it holds and
 * lets its existing dirty-check decide whether to persist. It is
 * deliberately not a read-time fallback (D-19 forbids that).
 *
 * Returns a value-equal result for input that already satisfies the
 * invariants, so a caller can detect "nothing needed changing" via a deep
 * comparison. Never mutates its arguments.
 */
export function normalizeLyricOrder(
  sections: LyricSection[],
  order: string[],
): { sections: LyricSection[]; performanceOrder: string[] } {
  const seenIds = new Set<string>()
  const dedupedSections: LyricSection[] = []
  for (const section of sections) {
    if (seenIds.has(section.id)) continue
    seenIds.add(section.id)
    dedupedSections.push(section)
  }

  const pool = new Map(dedupedSections.map((section) => [section.id, section] as const))
  let survivingOrder = order.filter((id) => pool.has(id))

  if (survivingOrder.length === 0 && dedupedSections.length > 0) {
    survivingOrder = dedupedSections.map((section) => section.id)
  }

  const referencedIds = new Set(survivingOrder)
  const finalSections = dedupedSections.filter((section) => referencedIds.has(section.id))

  return { sections: finalSections, performanceOrder: survivingOrder }
}

/**
 * Moves the order entry at `fromIndex` to `toIndex`. An out-of-range
 * from/to index is a no-op returning a value-equal array. Never mutates
 * its argument.
 */
export function moveRow(order: string[], fromIndex: number, toIndex: number): string[] {
  if (
    fromIndex < 0 ||
    fromIndex >= order.length ||
    toIndex < 0 ||
    toIndex >= order.length
  ) {
    return [...order]
  }

  const result = [...order]
  const [moved] = result.splice(fromIndex, 1)
  if (moved === undefined) return [...order]
  result.splice(toIndex, 0, moved)
  return result
}

/**
 * Duplicates the order entry at `index`, landing the copy immediately
 * after the row it was made from — this is D-02's reference model: the
 * duplicate is the same section id shown again, not a copy of the
 * section's text. An out-of-range index is a no-op returning a
 * value-equal array. Never mutates its argument.
 */
export function duplicateRow(order: string[], index: number): string[] {
  if (index < 0 || index >= order.length) return [...order]

  const result = [...order]
  const value = result[index]
  if (value === undefined) return [...order]
  result.splice(index + 1, 0, value)
  return result
}

/**
 * Removes the order entry at `index`. If that was the last occurrence of
 * its section id, the section is also dropped from the pool — an
 * unreferenced-and-unreachable pooled section must never be persisted
 * (T-28-03). An out-of-range index is a no-op returning value-equal
 * arrays. Never mutates its arguments.
 */
export function removeRow(
  sections: LyricSection[],
  order: string[],
  index: number,
): { sections: LyricSection[]; performanceOrder: string[] } {
  if (index < 0 || index >= order.length) {
    return { sections: [...sections], performanceOrder: [...order] }
  }

  const newOrder = [...order]
  const [removedId] = newOrder.splice(index, 1)
  if (removedId === undefined) {
    return { sections: [...sections], performanceOrder: [...order] }
  }

  const stillReferenced = newOrder.includes(removedId)
  const newSections = stillReferenced
    ? [...sections]
    : sections.filter((section) => section.id !== removedId)

  return { sections: newSections, performanceOrder: newOrder }
}

/**
 * Appends a new, empty section of the given `kind` to both the pool and
 * the end of the order, minting a fresh id/label if `kind`'s bare label
 * is already taken. Returns the id it minted so the caller can
 * auto-expand that row. Never mutates its arguments.
 */
export function addSection(
  sections: LyricSection[],
  order: string[],
  kind: string,
): { sections: LyricSection[]; performanceOrder: string[]; newSectionId: string } {
  const existingLabels = sections.map((section) => section.label)
  const label = uniqueSectionLabel(kind, existingLabels)

  const existingIds = sections.map((section) => section.id)
  const id = mintSectionId(label, existingIds)

  const newSection: LyricSection = { id, label, lines: [] }

  return {
    sections: [...sections, newSection],
    performanceOrder: [...order, id],
    newSectionId: id,
  }
}

/**
 * Slugifies a label exactly as `ccliParser.ts::slugify` does, so minted
 * ids stay consistent with pasted ones: lowercase, whitespace collapsed
 * to hyphens.
 */
function slugifyLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '-')
}

/**
 * Mints an id from `label` not present in `existingIds`. Reproduces
 * `ccliParser.ts::slugify`'s transformation for the base case, then
 * appends an incrementing numeric suffix until the id is unused. The
 * suffix search is bounded by the size of `existingIds` (itself bounded
 * by the pool), so it cannot loop unbounded (T-28-02).
 */
export function mintSectionId(label: string, existingIds: readonly string[]): string {
  const base = slugifyLabel(label)
  if (!existingIds.includes(base)) return base

  let suffix = 2
  let candidate = `${base}-${suffix}`
  while (existingIds.includes(candidate)) {
    suffix += 1
    candidate = `${base}-${suffix}`
  }
  return candidate
}

/**
 * Returns `kind` unused as a label, otherwise `kind` followed by the
 * smallest integer above one that makes it unused (e.g. `Chorus 2`,
 * `Chorus 3`, ...).
 */
export function uniqueSectionLabel(kind: string, existingLabels: readonly string[]): string {
  if (!existingLabels.includes(kind)) return kind

  let suffix = 2
  while (existingLabels.includes(`${kind} ${suffix}`)) {
    suffix += 1
  }
  return `${kind} ${suffix}`
}
