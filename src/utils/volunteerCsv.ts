import type { Person } from '@/types/roster'

/**
 * One parsed CSV row before name reconciliation. rolesRaw/serveWithRaw are
 * names as typed in the CSV (matched to Role.id / Person.id later, in the
 * store/UI — this module stays pure and has no roster/role lookup side effects).
 */
export interface ParsedVolunteerRow {
  name: string
  rolesRaw: string[]
  frequencyTargetN: number
  blackoutCellRaw: string
  serveWithRaw: string[]
  warnings: string[]
}

export type NameMatchStatus = 'matched' | 'unmatched' | 'ambiguous'

export interface NameMatchResult {
  status: NameMatchStatus
  personId: string | null
  candidates: string[]
}

/**
 * Split a ';'-separated multi-value cell, trimming each part and dropping
 * empties (D-15). Mirrors the comma-split pattern in csvImport.ts but for ';'.
 */
function splitMultiValueCell(cell: string): string[] {
  if (!cell || !cell.trim()) return []
  return cell
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

/**
 * Map a friendly frequency label (or bare integer, or "1-in-N" string) to a
 * 1-in-N integer. Unknown labels default to 4 (~monthly).
 */
export function frequencyLabelToN(label: string): number {
  const normalized = label.trim().toLowerCase()

  if (normalized === 'weekly') return 1
  if (normalized === 'twice a month') return 2
  if (normalized === 'once a month') return 4

  const bareInt = Number(normalized)
  if (normalized !== '' && Number.isInteger(bareInt) && bareInt > 0) {
    return bareInt
  }

  const oneInNMatch = normalized.match(/^1-in-(\d+)$/)
  if (oneInNMatch) {
    return Number(oneInNMatch[1])
  }

  return 4
}

/**
 * Map a 1-in-N integer back to its friendly label, for the known round-trip
 * values (1, 2, 4). Other values return a generic "1-in-N" string.
 */
export function nToFrequencyLabel(n: number): string {
  if (n === 1) return 'weekly'
  if (n === 2) return 'twice a month'
  if (n === 4) return 'once a month'
  return `1-in-${n}`
}

/**
 * Expand a blackout cell against the quarter's generated Sundays (D-17).
 * Iterates only the finite serviceDates list (never a raw day-by-day walk),
 * so malformed or enormous ranges cannot blow up memory (T-13-03-01).
 * Dates outside serviceDates are silently ignored (no matching Sunday) —
 * surfaced as a per-row import warning by the caller, not a hard failure here.
 */
export function expandBlackoutCell(cell: string, serviceDates: string[]): string[] {
  const parts = cell
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  const result = new Set<string>()

  for (const part of parts) {
    if (part.includes('..')) {
      const [start, end] = part.split('..').map((s) => s.trim())
      if (!start || !end) continue
      for (const date of serviceDates) {
        if (date >= start && date <= end) result.add(date)
      }
    } else if (serviceDates.includes(part)) {
      result.add(part)
    }
  }

  return Array.from(result).sort()
}

/**
 * Parse a single quarterly volunteer CSV row into a ParsedVolunteerRow.
 * Mirrors mapRowToSong's defensive-header + warnings-array pattern, but
 * splits multi-value cells on ';' (D-15) rather than ','.
 */
export function parseVolunteerCsvRow(row: Record<string, string>): ParsedVolunteerRow {
  const warnings: string[] = []

  const name = row['Name']?.trim() ?? ''
  if (!name) {
    warnings.push('Missing name')
  }

  const rolesRaw = splitMultiValueCell(row['Roles']?.trim() ?? '')

  const frequencyRaw = row['Frequency']?.trim() ?? ''
  const frequencyTargetN = frequencyLabelToN(frequencyRaw)
  const isKnownLabel =
    frequencyRaw.trim().toLowerCase() === 'weekly' ||
    frequencyRaw.trim().toLowerCase() === 'twice a month' ||
    frequencyRaw.trim().toLowerCase() === 'once a month' ||
    /^\d+$/.test(frequencyRaw.trim()) ||
    /^1-in-\d+$/i.test(frequencyRaw.trim())
  if (frequencyRaw !== '' && !isKnownLabel) {
    warnings.push(`Frequency unrecognized — defaulted to N=${frequencyTargetN}`)
  }

  const blackoutCellRaw = row['Blackout Dates']?.trim() ?? ''

  const serveWithRaw = splitMultiValueCell(row['Serve-With']?.trim() ?? '')

  return {
    name,
    rolesRaw,
    frequencyTargetN,
    blackoutCellRaw,
    serveWithRaw,
    warnings,
  }
}

/**
 * Normalize a name for comparison: trim, collapse internal whitespace,
 * lowercase. Used to match CSV names against roster people (D-16, Pitfall 4).
 */
function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Match a CSV name to an existing roster person, normalizing both sides
 * (trim + collapse whitespace + lowercase) before comparing. Never
 * fuzzy-matches beyond that — any non-exact-after-normalization case is
 * surfaced as 'unmatched'/'ambiguous' for human resolution (D-16, T-13-03-02).
 */
export function matchNameToPerson(name: string, roster: Person[]): NameMatchResult {
  const target = normalizeName(name)
  const matches = roster.filter((person) => normalizeName(person.name) === target)

  if (matches.length === 0) {
    return { status: 'unmatched', personId: null, candidates: [] }
  }

  if (matches.length === 1) {
    return { status: 'matched', personId: matches[0]!.id, candidates: [] }
  }

  return {
    status: 'ambiguous',
    personId: null,
    candidates: matches.map((p) => p.id),
  }
}
