// See .planning/phases/139-rehearsal-report-times/139-RESEARCH.md (§ Verified Integration
// Points 5, Pattern 1/2) — shared, store-free rehearsal-time helpers consumed by BOTH
// buildServiceSnapshot (src/stores/services.ts) and buildRehearseAccess
// (src/utils/rehearseAccess.ts), plus every display component. Kept dependency-free (no
// Firestore/Pinia imports) so both projection builders can import it without a
// dependency-direction violation.

export interface Rehearsal {
  id: string
  /** 'YYYY-MM-DD', may be '' (undated — editor-only state, filtered from read-only surfaces). */
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
 */
export function formatWallClockTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
