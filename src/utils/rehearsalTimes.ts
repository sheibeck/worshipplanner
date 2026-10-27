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
