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

/**
 * Synthetic markers embedded in the model-facing copy of the text at every
 * legal boundary so the model can choose among them by index — never asked
 * to count characters blind. U+27E6/U+27E7 (mathematical white square
 * brackets) are chosen because they cannot occur in ESV API output.
 */
export const BOUNDARY_MARKER_OPEN = '⟦'
export const BOUNDARY_MARKER_CLOSE = '⟧'

/**
 * Produces a model-facing copy of `text` with a `⟦i⟧` marker inserted
 * immediately before the character at `boundaries[i]`, for every boundary.
 * The untouched `text` remains the only slicing source — this output is for
 * display to the model only, never fed back into `sliceAtBoundaries`.
 *
 * Returns `null` — a hard refusal — when `text` already contains either
 * marker delimiter, since an ambiguous marker set would let the model index
 * into text the caller did not mean.
 */
export function embedBoundaryMarkers(text: string, boundaries: number[]): string | null {
  if (text.includes(BOUNDARY_MARKER_OPEN) || text.includes(BOUNDARY_MARKER_CLOSE)) {
    return null
  }

  let out = ''
  let previous = 0
  boundaries.forEach((boundary, index) => {
    out += text.slice(previous, boundary) + BOUNDARY_MARKER_OPEN + index + BOUNDARY_MARKER_CLOSE
    previous = boundary
  })
  return out
}

/**
 * THE ENCODING BACKSTOP. This is the byte-exactness guarantee at the core of
 * R064: it performs exactly one `String.prototype.slice` call against the
 * untouched source and nothing else. Do NOT add `.normalize()`, `.trim()`,
 * `.replace()`, `.toLowerCase()`, or any comparison here — any such
 * transform would silently defeat the structural claim that a sliced
 * section is character-for-character identical to the ESV source,
 * including non-ASCII punctuation (curly quotes, curly apostrophes, em
 * dashes, etc.). The boundary array passed in must be the exact same array
 * used to build the prompt — never recomputed here.
 */
export function sliceAtBoundaries(
  text: string,
  boundaries: number[],
  startBoundary: number,
  endBoundary: number,
): string {
  return text.slice(boundaries[startBoundary], boundaries[endBoundary])
}

/**
 * Removes bracketed-digit verse-number runs (and their trailing whitespace)
 * and trims the outer edges — the only two permitted display transforms,
 * for display only, matching `scriptureSplitter.ts`'s existing convention
 * of keeping verse numbers OUT of a section's `.text` and surfacing them
 * separately via `verseRangeForSlice`. Everything else in the slice —
 * including non-ASCII punctuation — is left untouched.
 */
export function stripVerseMarkers(slice: string): string {
  return slice.replace(VERSE_MARKER_PATTERN, '').trim()
}

/**
 * Reads the bracketed verse numbers present in `slice` and returns a single
 * number as a string, a hyphenated first-last range when several are
 * present, or `undefined` when the slice carries no verse marker at all.
 *
 * CAUTION (47-REVIEW WR-01): this scans `slice` for every `[N]` occurrence,
 * with no awareness of WHERE the slice's boundary was cut. When a verse runs
 * on into the next without terminal clause punctuation, there is no legal
 * boundary at "end of this verse's words" — only at the START of the next
 * verse's own marker — so a segment's raw slice can legitimately extend
 * through the next verse's `[N]` marker even though none of that verse's
 * words are included. Calling this on such a slice reports the next verse
 * as part of the range even though it isn't. Callers that have boundary
 * indices available (not just raw slice text) should prefer
 * `verseRangeForBoundaryRange` below, which is immune to this.
 */
export function verseRangeForSlice(slice: string): string | undefined {
  const numbers = [...slice.matchAll(/\[(\d+)\]/g)].map((match) => match[1]!)
  if (numbers.length === 0) return undefined
  if (numbers.length === 1) return numbers[0]
  return `${numbers[0]}-${numbers[numbers.length - 1]}`
}

/**
 * WR-01 fix (47-REVIEW): the verse range that actually belongs to a segment
 * spanning `boundaries[startBoundary]..boundaries[endBoundary]`, computed
 * from WHERE each verse marker's own boundary sits — never by re-scanning
 * the raw slice text for every `[N]` occurrence it happens to contain (see
 * the caution on `verseRangeForSlice` above).
 *
 * A verse belongs to this segment only if the boundary its own `[N]` marker
 * created lies in `[startBoundary, endBoundary)` — i.e. strictly BEFORE
 * `endBoundary`. This is what excludes a verse whose marker only appears
 * because the segment's raw span had nowhere legal to end except at that
 * verse's own start (the exact WR-01 scenario): that verse's marker
 * boundary equals `endBoundary` itself, which fails the strict `<` and is
 * correctly attributed to the NEXT segment instead.
 */
export function verseRangeForBoundaryRange(
  text: string,
  boundaries: number[],
  startBoundary: number,
  endBoundary: number,
): string | undefined {
  const numbers: number[] = []
  for (const match of text.matchAll(/\[(\d+)\]\s*/g)) {
    const boundaryPosition = match.index! + match[0].length
    const boundaryIndex = boundaries.indexOf(boundaryPosition)
    if (boundaryIndex === -1) continue
    if (boundaryIndex >= startBoundary && boundaryIndex < endBoundary) {
      numbers.push(parseInt(match[1]!, 10))
    }
  }
  if (numbers.length === 0) return undefined
  if (numbers.length === 1) return String(numbers[0])
  return `${numbers[0]}-${numbers[numbers.length - 1]}`
}
