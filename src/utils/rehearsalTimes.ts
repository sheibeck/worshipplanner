// See .planning/phases/139-rehearsal-report-times/139-RESEARCH.md (§ Verified Integration
// Points 5, Pattern 1/2) — shared, store-free rehearsal-time helpers consumed by BOTH
// buildServiceSnapshot (src/stores/services.ts) and buildRehearseAccess
// (src/utils/rehearseAccess.ts), plus every display component. Kept dependency-free (no
// Firestore/Pinia imports) so both projection builders can import it without a
// dependency-direction violation.

export interface Rehearsal {
  id: string
  /** 'YYYY-MM-DD'; '' only on a legacy v2.15 row or in-progress edit — the editor flags it, read-only surfaces filter it (ADR-0245). */
  date: string
  /** 'HH:mm' (24h, native <input type="time"> value format). */
  time: string
}

/** Shape guards shared by the Times panel and the editor's handler guards (143 WR-01). */
export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
export const HM_RE = /^\d{2}:\d{2}$/

/**
 * Chronological order by date then time — NEVER trust array/storage order.
 * Undated rehearsals (date === '') sort last, since they have no real position
 * in a timeline yet. Returns a new array; input is not mutated.
 */
export function sortRehearsals(rehearsals: Rehearsal[]): Rehearsal[] {
  return [...rehearsals].sort((a, b) => {
    if (a.date === '' && b.date === '') return a.time.localeCompare(b.time)
    if (a.date === '') return 1
    if (b.date === '') return -1
    return a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  })
}

/**
 * Format an 'HH:mm' string as 12-hour wall-clock text, e.g. "8:00 AM". Never
 * parse date+time as a combined ISO string (timezone-ambiguous) — construct a
 * throwaway local Date purely to borrow toLocaleTimeString, so the result is
 * stable regardless of the runner/viewer's system timezone.
 *
 * CR-01 (139-REVIEW.md) — defensive: an empty/malformed input degrades to
 * '' rather than the literal string "Invalid Date" reaching a display
 * surface. `isDisplayableRehearsal` is the primary guard; this is the
 * second line of defense for any caller that skips it.
 */
export function formatWallClockTime(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  if (Number.isNaN(h) || Number.isNaN(m)) return ''
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** 'YYYY-MM-DD' to a short local label, e.g. "Sep 11"; '' for empty/malformed. */
export function formatRehearsalDateShort(ymd: string): string {
  if (!ymd) return ''
  const parts = ymd.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ''
  const [year, month, day] = parts as [number, number, number]
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * CR-01 (139-REVIEW.md) / IN-02 — the single shared "is this rehearsal real
 * enough for a read-only display" predicate. Requires BOTH date and time:
 * a date-only row (planner picked a date, hasn't picked a time yet) is a
 * plausible mid-edit state that autosaves immediately and must not reach any
 * read-only surface, including the public Share page.
 */
export function isDisplayableRehearsal(r: Rehearsal): boolean {
  return r.date !== '' && r.time !== ''
}

// See ADR-0249 (docs/adr/0249-new-services-start-with-a-default-rehearsal.md)
/** A stored/editor row. `autoAdded` is absent unless the row came from a default; never false or undefined. */
export interface StoredRehearsal extends Rehearsal {
  autoAdded?: true
}

/** The only shape that reaches a share link or volunteer projection: exactly id, date and time. */
export function toPublicRehearsal(r: Rehearsal): Rehearsal {
  return { id: r.id, date: r.date, time: r.time }
}

/** A whole number 0 (Sunday) to 6 (Saturday), else null. Never test the weekday by truthiness: 0 is Sunday. */
export function normalizeWeekday(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6 ? v : null
}

/** UTC midnight of a real 'YYYY-MM-DD', else null. UTC maths only: local construction is a day off at UTC-11 and UTC+14. */
function ymdToUtcMs(ymd: string): number | null {
  if (typeof ymd !== 'string' || !YMD_RE.test(ymd)) return null
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  const dt = new Date(0)
  dt.setUTCFullYear(y, m - 1, d)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt.getTime()
}

function utcMsToYmd(ms: number): string | null {
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  if (y < 0 || y > 9999) return null
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${String(y).padStart(4, '0')}-${mm}-${dd}`
}

/** 'YYYY-MM-DD' shape and a real calendar date (rejects 2026-02-30). */
export function isRealYmd(ymd: string): boolean {
  return ymdToUtcMs(ymd) !== null
}

/** 0 (Sunday) to 6 (Saturday) of a real 'YYYY-MM-DD', else null. */
export function weekdayOfYmd(ymd: string): number | null {
  const ms = ymdToUtcMs(ymd)
  return ms === null ? null : new Date(ms).getUTCDay()
}

/** The most recent day with the weekday on or before the date; the date itself when it falls on it. Null on bad input. */
export function mostRecentWeekdayOnOrBefore(ymd: string, weekday: unknown): string | null {
  const ms = ymdToUtcMs(ymd)
  const wd = normalizeWeekday(weekday)
  if (ms === null || wd === null) return null
  const back = (new Date(ms).getUTCDay() - wd + 7) % 7
  return utcMsToYmd(ms - back * 86_400_000)
}

/** The row `createService` adds, or null when there is nothing to add. `makeId` runs only after every guard passes. */
export function buildAutoRehearsal(
  serviceDate: string,
  weekday: unknown,
  time: unknown,
  makeId: () => string = () => crypto.randomUUID(),
): StoredRehearsal | null {
  const date = mostRecentWeekdayOnOrBefore(serviceDate, weekday)
  if (date === null || typeof time !== 'string' || !HM_RE.test(time)) return null
  return { id: makeId(), date, time, autoAdded: true }
}

/**
 * Move every marked row to the most recent day with its OWN weekday on or before the new service date.
 * A marked row that lands on an unmarked row, or an earlier marked row, at the same date and time is dropped.
 */
export function moveAutoRehearsals(rows: StoredRehearsal[], newServiceDate: string): StoredRehearsal[] {
  if (!isRealYmd(newServiceDate)) return rows
  const moved = rows.map((r) => {
    if (!r.autoAdded) return r
    const date = mostRecentWeekdayOnOrBefore(newServiceDate, weekdayOfYmd(r.date))
    return date === null ? r : { ...r, date }
  })
  const kept: StoredRehearsal[] = []
  for (const r of moved) {
    const clash =
      r.autoAdded === true &&
      isRealYmd(r.date) &&
      moved.some((o) => o !== r && o.date === r.date && o.time === r.time && (!o.autoAdded || kept.includes(o)))
    if (!clash) kept.push(r)
  }
  return kept
}
