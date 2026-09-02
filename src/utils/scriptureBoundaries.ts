/**
 * Pure functions computing and using the "legal boundary index" contract that
 * makes AI-assisted congregational-reading splitting structurally safe (R064).
 * See .planning/codebase/INTEGRATIONS.md (Utils Integration Notes — src/utils/scriptureBoundaries.ts)
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
 * Produces a model-facing copy of `text` marked at each legal boundary.
 * Returns `null` (hard refusal) if `text` already contains a marker delimiter.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/scriptureBoundaries.ts)
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
 * THE ENCODING BACKSTOP (R064): exactly one untouched `.slice()` call — do
 * NOT add `.normalize()`, `.trim()`, `.replace()`, `.toLowerCase()`, or any
 * comparison here.
 * See .planning/codebase/INTEGRATIONS.md (Utils Integration Notes — src/utils/scriptureBoundaries.ts)
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
