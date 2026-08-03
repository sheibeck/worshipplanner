/**
 * Pure functions computing and using the "legal boundary index" contract that
 * makes AI-assisted congregational-reading splitting structurally safe (R064).
 *
 * The model is never shown raw character offsets and never asked to reproduce
 * scripture words. It is shown a copy of the ESV passage with a visible marker
 * embedded at every position where a legal split is allowed (immediately after
 * a verse number, and immediately after clause-ending punctuation followed by
 * whitespace) and asked only to choose indices INTO that pre-computed array.
 * Because every value the model can represent is, by construction, a real
 * position in the untouched source text, a mid-sentence split is not merely
 * discouraged — it cannot be expressed by the model at all.
 */

/** Matches an inline ESV verse-number marker, e.g. "[12] ", "[3]". */
const VERSE_MARKER_PATTERN = /\[\d+\]\s*/g

/**
 * Matches a clause-ending mark followed by whitespace. Deliberately excludes
 * the comma: including it fragments nearly every line of scripture into
 * unreadably tiny pieces (RESEARCH § Common Pitfalls, Pitfall 4) and defeats
 * the point of "clause, not sentence, granularity." This is a tuning knob
 * owned by the empirical determinism check (RESEARCH Assumption A2/A3), not
 * an oversight — revisit if real Haiku output on Psalm 136/24 looks wrong.
 */
const CLAUSE_END_PATTERN = /[.!?;:]\s+/g

/**
 * Every position in `text` where a congregational-reading section may
 * legally start or end: immediately after a "[N]" verse marker (and its
 * trailing whitespace), and immediately after clause-ending punctuation
 * (. ! ? ; :) followed by whitespace. Position 0 and `text.length` are
 * always included as the passage's own start/end anchors, even when the
 * passage has no internal boundary at all.
 *
 * Pure and synchronous — reads no global state, fetches nothing, mutates
 * nothing. Callers must compute this once and thread the SAME array through
 * both prompt-building and validation; recomputing between the two silently
 * desyncs indices from meaning (RESEARCH § Common Pitfalls, Pitfall 5).
 */
export function computeBoundaries(text: string): number[] {
  const boundaries = new Set<number>([0, text.length])

  for (const match of text.matchAll(VERSE_MARKER_PATTERN)) {
    boundaries.add(match.index! + match[0].length)
  }

  for (const match of text.matchAll(CLAUSE_END_PATTERN)) {
    boundaries.add(match.index! + match[0].length)
  }

  return [...boundaries].sort((a, b) => a - b)
}

/**
 * `computeBoundaries` always emits the two anchors (0 and text.length), so
 * three entries is the minimum that admits at least one internal division —
 * and therefore two or more sections. Fewer than that means the passage
 * offers no legal place to divide; callers must not make the model call at
 * all in that case (the affordance is unavailable, not merely likely to
 * fail).
 */
export function hasSplittableBoundaries(boundaries: number[]): boolean {
  return boundaries.length >= 3
}
