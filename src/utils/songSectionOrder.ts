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

/** The six quick-add kinds the option 2a mockup draws, in mockup order (R119 adds 'Pre-Chorus'). */
export const ADD_SECTION_KINDS = ['Verse', 'Chorus', 'Pre-Chorus', 'Bridge', 'Tag', 'Ending'] as const

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
  /**
   * Unique within a single `buildSectionRows` result. Positionally derived
   * (`${sectionId}#${occurrenceIndex}`) — used for display/testid purposes
   * only. NOT stable across a mutation that changes which occurrence of a
   * repeated section comes first (drag reorder, duplicate/remove of an
   * earlier occurrence). Callers that need to track UI state (e.g.
   * expand/collapse) per physical row across such mutations must use
   * `stableKey` instead (WR-01).
   */
  rowKey: string
  /**
   * Stable across a mutation of the order — set from the caller-supplied
   * `slotIds` (see `buildSectionRows`'s third parameter) when provided,
   * otherwise falls back to `rowKey` (i.e. no stability guarantee) so
   * callers that don't need it are unaffected.
   */
  stableKey: string
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
  /**
   * The per-kind position-numbered label rendered by the editor (R120), e.g.
   * "Verse 3". Derived at render time from the section's stored `label` via
   * `deriveSectionKind` and its ordinal among UNIQUE same-kind sections; both
   * rows of a repeat (and both slides of a split, which live on one section)
   * share the section's single number. NEVER written back into
   * `section.label` — this is display-only (BWC).
   */
  displayLabel: string
}

/**
 * Derives a section's KIND from its stored `label` (R120) by stripping a
 * single trailing whitespace-plus-digits run: 'Verse 1' -> 'Verse',
 * 'Pre-Chorus 2' -> 'Pre-Chorus', bare 'Verse' -> 'Verse', 'Chorus' ->
 * 'Chorus'. CCLI uses arabic numerals only, so this reliably yields the kind
 * for every real label shape with no hard-coded kind list. Pure — never
 * mutates and never touches the stored label.
 */
export function deriveSectionKind(label: string): string {
  return label.replace(/\s+\d+$/, '').trim()
}

/**
 * Derives the numbered row list option 2a draws from a (sections, order)
 * pair. Skips an order id that resolves to no pooled section rather than
 * emitting a row with an undefined section. Never mutates its arguments.
 *
 * `slotIds`, when supplied, must be the same length as `order` — element
 * `i` is a stable identity for the order slot at `order[i]`, independent of
 * section id or position, exposed as `SectionRow.stableKey` (WR-01: lets a
 * caller track UI state, e.g. expand/collapse, per physical row across a
 * reorder/duplicate/remove instead of by the positionally-derived
 * `rowKey`). Omitted or mismatched-length `slotIds` falls back to `rowKey`
 * for `stableKey`, preserving prior behavior for callers that don't pass it.
 */
export function buildSectionRows(
  sections: LyricSection[],
  order: string[],
  slotIds?: string[],
): SectionRow[] {
  const pool = new Map(sections.map((section) => [section.id, section] as const))
  const occurrenceCounts = new Map<string, number>()
  const firstPositionBySectionId = new Map<string, number>()
  // R120: per-kind ordinal assigned on a section's FIRST occurrence, reused by
  // repeats. `kindOrdinals` counts UNIQUE sections seen per derived kind;
  // `numberBySectionId` remembers the number minted for each section id.
  const kindOrdinals = new Map<string, number>()
  const numberBySectionId = new Map<string, number>()
  const rows: SectionRow[] = []
  const hasSlotIds = slotIds !== undefined && slotIds.length === order.length

  for (let i = 0; i < order.length; i++) {
    const sectionId = order[i]!
    const section = pool.get(sectionId)
    if (!section) continue

    const occurrenceIndex = occurrenceCounts.get(sectionId) ?? 0
    occurrenceCounts.set(sectionId, occurrenceIndex + 1)

    const position = rows.length + 1
    const isRepeat = occurrenceIndex > 0

    // R304 / PITFALLS Pitfall 5: a blackout section is excluded from
    // per-kind lyric numbering ENTIRELY — it never consumes a kindOrdinals
    // slot or a numberBySectionId entry, so inserting/duplicating/removing a
    // blackout can never renumber a Verse/Chorus row. Its displayLabel is
    // its own stored label (already unique — minted via addSection's
    // uniqueSectionLabel collision guard), not a derived "Kind N" number.
    // Everything else below (position, occurrenceIndex, isRepeat,
    // repeatOfPosition, rowKey/stableKey) is computed identically to a
    // lyric row — a blackout is a first-class row in the order.
    let displayLabel: string
    if (section.kind === 'blackout') {
      displayLabel = section.label
    } else {
      const kind = deriveSectionKind(section.label)
      let number = numberBySectionId.get(sectionId)
      if (number === undefined) {
        number = (kindOrdinals.get(kind) ?? 0) + 1
        kindOrdinals.set(kind, number)
        numberBySectionId.set(sectionId, number)
      }
      displayLabel = `${kind} ${number}`
    }

    if (!isRepeat) {
      firstPositionBySectionId.set(sectionId, position)
    }

    const rowKey = `${sectionId}${ROW_KEY_SEPARATOR}${occurrenceIndex}`

    rows.push({
      rowKey,
      stableKey: hasSlotIds ? slotIds![i]! : rowKey,
      sectionId,
      section,
      position,
      occurrenceIndex,
      isRepeat,
      repeatOfPosition: isRepeat ? (firstPositionBySectionId.get(sectionId) ?? null) : null,
      displayLabel,
    })
  }

  return rows
}

/**
 * Slices a section's `lines` into consecutive slide line-groups at its
 * `slideBreaks` (R117). This is the SINGLE definition of what a split means —
 * both assembler paths (Plan 02) and the editor split affordance (Plan 03)
 * consume this one helper.
 *
 * Read-tolerant: keeps only integer break indices `k` with
 * `1 <= k < lines.length`, sorts ascending and de-duplicates. An absent, empty
 * or fully-invalid break set yields exactly one group equal to `section.lines`
 * (today's behavior — backward compatible). Never throws, never mutates its
 * argument (builds new arrays only). Pure — imports only the `LyricSection`
 * type, no Vue/store/Firestore.
 */
export function sliceSectionIntoSlides(section: LyricSection): string[][] {
  const n = section.lines.length
  const breaks = (section.slideBreaks ?? [])
    .filter((k) => Number.isInteger(k) && k >= 1 && k < n)
    .sort((a, b) => a - b)
  const unique = [...new Set(breaks)]

  if (unique.length === 0) return [section.lines]

  const groups: string[][] = []
  let start = 0
  for (const k of unique) {
    groups.push(section.lines.slice(start, k))
    start = k
  }
  groups.push(section.lines.slice(start))
  return groups
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
  const existingIds = sections.map((section) => section.id)

  // R302: the literal 'BLACKOUT' kind mints a distinct content kind, not a
  // lyric kind — its own fixed label ('Black Slide', numbered 'Black Slide
  // 2' on collision via the same uniqueSectionLabel collision guard every
  // other kind uses) and `kind: 'blackout'`, so buildSectionRows below
  // excludes it from per-kind lyric numbering (R304) and the assembler
  // resolves it to a solid-black slide instead of lyric content. Every other
  // kind keeps today's behavior byte-identical — no `kind` field written.
  if (kind === 'BLACKOUT') {
    const label = uniqueSectionLabel('Black Slide', existingLabels)
    const id = mintSectionId(label, existingIds)
    const newSection: LyricSection = { id, label, lines: [], kind: 'blackout' }
    return {
      sections: [...sections, newSection],
      performanceOrder: [...order, id],
      newSectionId: id,
    }
  }

  const label = uniqueSectionLabel(kind, existingLabels)
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

/**
 * Compares two line arrays for the "repeat marker" test: empty incoming
 * lines always count as a repeat; otherwise the arrays must be
 * value-equal after trimming each line, so trailing-whitespace
 * differences in a CCLI paste don't split one section into two pooled
 * entries.
 */
function linesAreEquivalent(pooledLines: string[], incomingLines: string[]): boolean {
  if (incomingLines.length === 0) return true

  const trimmedIncoming = incomingLines.map((line) => line.trim())
  const trimmedPooled = pooledLines.map((line) => line.trim())
  if (trimmedIncoming.length !== trimmedPooled.length) return false

  return trimmedIncoming.every((line, index) => line === trimmedPooled[index])
}

/**
 * Normalises freshly-parsed CCLI sections into the pool/order model.
 *
 * This is the ONLY collision guard over `ccliParser.ts`'s unguarded
 * `slugify(label)` ids — that parser mints ids with no uniqueness check
 * across four mint sites, so two `Chorus` markers in one paste arrive as
 * two `LyricSection` objects both carrying id `chorus`. This function
 * resolves that collision:
 *
 * - Id not yet pooled: pool the section, append its id to the order.
 * - Id already pooled and the incoming lines are empty or value-equal
 *   (after trimming) to the pooled section's lines: a REPEAT MARKER —
 *   append the pooled id again, add nothing to the pool (D-02).
 * - Id already pooled and the incoming lines differ and are non-empty:
 *   two sections that merely share a label — mint a fresh id, pool the
 *   incoming section under it (keeping its original label), append the
 *   new id to the order.
 *
 * Accepts anything carrying a `sections` array (a bare array wrapper, or
 * a full `ParsedCCLI`) so this module never needs to import from
 * `ccliParser.ts` itself. The returned pair already satisfies the
 * pool/order invariants — feeding it to `normalizeLyricOrder` changes
 * nothing. Never mutates its argument.
 */
export function normalizeParsedSections(parsed: { sections: LyricSection[] }): {
  sections: LyricSection[]
  performanceOrder: string[]
} {
  const pool: LyricSection[] = []
  const poolById = new Map<string, LyricSection>()
  const order: string[] = []

  for (const incoming of parsed.sections) {
    const existing = poolById.get(incoming.id)

    if (!existing) {
      poolById.set(incoming.id, incoming)
      pool.push(incoming)
      order.push(incoming.id)
      continue
    }

    if (linesAreEquivalent(existing.lines, incoming.lines)) {
      order.push(existing.id)
      continue
    }

    const existingIds = pool.map((section) => section.id)
    const newId = mintSectionId(incoming.label, existingIds)
    const distinctSection: LyricSection = { ...incoming, id: newId }
    poolById.set(newId, distinctSection)
    pool.push(distinctSection)
    order.push(newId)
  }

  return { sections: pool, performanceOrder: order }
}
