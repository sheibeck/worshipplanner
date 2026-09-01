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

/** See ADR-0191 (docs/adr/0191-matches-a-clause-ending-mark-followed-by-whitespace-delibera.md) */
const CLAUSE_END_PATTERN = /[.!?;:]\s+/g

/** See ADR-0192 (docs/adr/0192-always-included-as-the-passage-s-own-start-end-anchors-even.md) */
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

/** See ADR-0193 (docs/adr/0193-fix-47-review-the-verse-range-that-actually-belongs-to-a-seg.md) */
export function verseRangeForSlice(slice: string): string | undefined {
  const numbers = [...slice.matchAll(/\[(\d+)\]/g)].map((match) => match[1]!)
  if (numbers.length === 0) return undefined
  if (numbers.length === 1) return numbers[0]
  return `${numbers[0]}-${numbers[numbers.length - 1]}`
}

/** See ADR-0193 (docs/adr/0193-fix-47-review-the-verse-range-that-actually-belongs-to-a-seg.md) */
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
