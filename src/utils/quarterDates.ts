// Pure date-math helpers for quarter service-date generation (D-01).
// No Firestore, no Vue, no Date.now() — dates are derived entirely from year/quarter inputs.

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Returns every Sunday in the given quarter as zero-padded YYYY-MM-DD strings, ascending.
 * Q1 = Jan-Mar, Q2 = Apr-Jun, Q3 = Jul-Sep, Q4 = Oct-Dec.
 */
export function generateSundaysInQuarter(year: number, quarter: 1 | 2 | 3 | 4): string[] {
  const startMonth = (quarter - 1) * 3 // 0, 3, 6, 9
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, startMonth + 3, 0) // last day of the quarter
  const sundays: string[] = []
  const d = new Date(start)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)) // advance to first Sunday on/after start
  while (d <= end) {
    sundays.push(fmtDate(d))
    d.setDate(d.getDate() + 7)
  }
  return sundays
}

/**
 * R038 / D-12 / D-13: the nearest FUTURE Sunday that does not already have a
 * plan. ★ Deliberately STRICTLY FORWARD — NOT the same convention as
 * `generateSundaysInQuarter`'s advance above (do not "unify" these).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/quarterDates.ts)
 */
export function nextFreeSunday(
  from: Date,
  takenDates: Iterable<string> = [],
  maxWeeks = 52,
): string {
  const taken = new Set(takenDates)
  // Normalize away any time component so date math never straddles a DST boundary.
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + (d.getDay() === 0 ? 7 : 7 - d.getDay())) // strictly forward — see above
  const plainNextSunday = fmtDate(d)
  for (let i = 0; i < maxWeeks; i++) {
    const candidate = fmtDate(d)
    if (!taken.has(candidate)) return candidate
    d.setDate(d.getDate() + 7)
  }
  return plainNextSunday
}

/**
 * Applies one-off date additions/removals to a base list of service dates.
 * Returns a sorted, de-duplicated array of YYYY-MM-DD strings.
 */
export function applyDateAdditionsRemovals(
  dates: string[],
  changes: { add?: string[]; remove?: string[] },
): string[] {
  const set = new Set(dates)
  for (const d of changes.add ?? []) set.add(d)
  for (const d of changes.remove ?? []) set.delete(d)
  return Array.from(set).sort()
}
