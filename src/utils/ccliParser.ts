import type { LyricSection, CopyrightInfo, ParsedCCLI } from '@/types/songLyrics'

/**
 * Regex matching a CCLI SongSelect section header line.
 *
 * Matches: Verse, Verse 1, Chorus, Bridge, Pre-Chorus, Ending, Tag, Misc, Intro
 * Case-insensitive, optional trailing number.
 */
const SECTION_HEADER_RE =
  /^(Verse|Chorus|Bridge|Pre-Chorus|Ending|Tag|Misc|Intro)(\s+\d+)?$/i

/**
 * Regex matching a parenthetical section marker embedded in a lyric line.
 * e.g. "(PRE-CHORUS)" or "(BRIDGE)" as the first line of a section.
 */
const PAREN_MARKER_RE =
  /^\((Verse|Chorus|Bridge|Pre-Chorus|Ending|Tag|Misc|Intro)(\s*\d+)?\)$/i

/** Regex matching a CCLI Song # line (with or without space before #). */
const CCLI_SONG_RE = /^CCLI\s+Song\s*#\s*(\d+)/i

/** Regex matching a CCLI License # line (with or without space before #). */
const CCLI_LICENSE_RE = /^CCLI\s+License\s*#\s*(\d+)/i

/** Regex matching a copyright line — Unicode © or ASCII (c)/(C). */
const COPYRIGHT_LINE_RE = /^(?:©|\(c\)|\(C\))\s*/

/** Regex matching the SongSelect terms-of-use boilerplate line. */
const TERMS_LINE_RE = /^For use solely with the SongSelect/i

/**
 * Slugify a section label: lowercase, collapse whitespace to hyphens.
 * 'Verse 1' → 'verse-1', 'Pre-Chorus' → 'pre-chorus', 'Chorus' → 'chorus'
 */
function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

/**
 * Normalise a raw section header to its display label.
 * Title-cases the keyword and appends the number (if any).
 */
function normaliseLabel(keyword: string, number?: string): string {
  // Title-case each part of the keyword (e.g. "pre-chorus" → "Pre-Chorus")
  const titled = keyword
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('-')

  const num = number?.trim()
  return num ? `${titled} ${num}` : titled
}

/**
 * Split raw paste text into logical line groups separated by blank lines.
 * Returns an array of line-group arrays.
 */
function splitBlocks(lines: string[]): string[][] {
  const blocks: string[][] = []
  let current: string[] = []

  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        blocks.push(current)
        current = []
      }
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) {
    blocks.push(current)
  }
  return blocks
}

/**
 * Detect whether a block is part of the CCLI footer.
 * The footer contains CCLI Song #, authors, copyright line(s), and CCLI License #.
 */
function isFooterLine(line: string): boolean {
  return (
    CCLI_SONG_RE.test(line) ||
    CCLI_LICENSE_RE.test(line) ||
    COPYRIGHT_LINE_RE.test(line) ||
    TERMS_LINE_RE.test(line)
  )
}

/**
 * Parse the CCLI footer blocks into a CopyrightInfo object.
 *
 * Handles two variants:
 * - Legacy:  CCLI Song # → Authors (pipe-delimited) → © Copyright → CCLI License #
 * - 2023+:   Authors (comma-delimited) → CCLI Song # → © Copyright → CCLI License #
 */
function parseFooter(footerLines: string[], title: string): CopyrightInfo {
  const copyright: CopyrightInfo = {
    title,
    authors: [],
    ccliSongNumber: '',
    copyrightLines: [],
    ccliLicenseNumber: '',
  }

  // Collect unclassified lines — these are author lines.
  const authorCandidates: string[] = []

  for (const line of footerLines) {
    const songMatch = line.match(CCLI_SONG_RE)
    if (songMatch) {
      // CCLI_SONG_RE's capture group is mandatory (\d+, no '?'), so a match
      // guarantees group 1 is present; '?? ""' is an unreachable fallback.
      copyright.ccliSongNumber = songMatch[1] ?? ''
      continue
    }

    const licenseMatch = line.match(CCLI_LICENSE_RE)
    if (licenseMatch) {
      // Same reasoning: CCLI_LICENSE_RE's capture group is mandatory.
      copyright.ccliLicenseNumber = licenseMatch[1] ?? ''
      continue
    }

    if (COPYRIGHT_LINE_RE.test(line)) {
      copyright.copyrightLines.push(line.trim())
      continue
    }

    if (TERMS_LINE_RE.test(line)) {
      continue
    }

    authorCandidates.push(line.trim())
  }

  // Parse authors: try pipe-delimited first (legacy), then comma-delimited (2023)
  if (authorCandidates.length > 0) {
    const joined = authorCandidates.join(' ')
    if (joined.includes('|')) {
      copyright.authors = joined.split('|').map((a) => a.trim()).filter(Boolean)
    } else {
      copyright.authors = joined.split(',').map((a) => a.trim()).filter(Boolean)
    }
  }

  return copyright
}

/**
 * Parse a raw CCLI SongSelect paste into structured lyric data.
 *
 * Handles both legacy and 2023+ format variants, parenthetical section
 * markers, and various edge cases (Unicode ©, missing section numbers, etc.).
 *
 * @param rawText - The raw text pasted from CCLI SongSelect
 * @returns Parsed title, sections, and copyright info
 */
export function parseCCLIPaste(rawText: string): ParsedCCLI {
  const empty: ParsedCCLI = {
    title: '',
    sections: [],
    copyright: {
      title: '',
      authors: [],
      ccliSongNumber: '',
      copyrightLines: [],
      ccliLicenseNumber: '',
    },
  }

  if (!rawText || rawText.trim() === '') {
    return empty
  }

  const rawLines = rawText.split(/\r?\n/)
  const blocks = splitBlocks(rawLines)

  if (blocks.length === 0) {
    return empty
  }

  // First non-blank line is the title.
  // blocks.length === 0 already returned above, so blocks[0] exists; splitBlocks
  // only ever pushes non-empty arrays, so blocks[0][0] exists too.
  const firstBlock = blocks[0]!
  const title = firstBlock[0]!.trim()

  // If the title block has only the title line, start sections from block 1.
  // If the title block has more lines, those are part of the first section.
  const titleBlockRemainder = firstBlock.length > 1 ? firstBlock.slice(1) : []

  const sections: LyricSection[] = []
  const footerLines: string[] = []
  let inFooter = false

  // Process remaining blocks (after title)
  const remainingBlocks = blocks.slice(1)

  // If the title block had extra lines, prepend them as a virtual block
  if (titleBlockRemainder.length > 0) {
    remainingBlocks.unshift(titleBlockRemainder)
  }

  for (const block of remainingBlocks) {
    // Check if this block is footer content
    if (!inFooter && block.some((l) => isFooterLine(l))) {
      inFooter = true
    }

    if (inFooter) {
      footerLines.push(...block)
      continue
    }

    // Check if the first line is a section header.
    // remainingBlocks entries are always non-empty (blocks from splitBlocks are
    // never empty, and titleBlockRemainder is only unshifted when non-empty).
    const headerMatch = block[0]!.match(SECTION_HEADER_RE)
    if (headerMatch) {
      // SECTION_HEADER_RE's first group is mandatory, so it's always present on a match.
      const label = normaliseLabel(headerMatch[1]!, headerMatch[2])
      const lyricLines = block.slice(1).map((l) => l.trim())

      // Check if the first lyric line is a parenthetical marker for a sub-section
      // If so, split into two sections
      if (lyricLines.length > 0) {
        const parenMatch = lyricLines[0]!.match(PAREN_MARKER_RE)
        if (parenMatch) {
          // The header section has no lines (the paren marker starts a new section)
          // Actually, there might be lines between header and paren marker — but
          // per CCLI format, the paren marker is typically the first line after a header.
          // We treat the paren marker as starting a NEW section.
          if (lyricLines.length > 1) {
            // First, add the header section with no lines if there are none before paren
            // Then add the paren-marked section
            // PAREN_MARKER_RE's first group is mandatory, so it's always present on a match.
            const parenLabel = normaliseLabel(parenMatch[1]!, parenMatch[2])
            sections.push({
              id: slugify(parenLabel),
              label: parenLabel,
              lines: lyricLines.slice(1).map((l) => l.trim()),
            })
          }
          // If only the paren marker and nothing else, just create the paren section
          else {
            // PAREN_MARKER_RE's first group is mandatory, so it's always present on a match.
            const parenLabel = normaliseLabel(parenMatch[1]!, parenMatch[2])
            sections.push({
              id: slugify(parenLabel),
              label: parenLabel,
              lines: [],
            })
          }
          continue
        }
      }

      sections.push({
        id: slugify(label),
        label,
        lines: lyricLines.filter((l) => l !== ''),
      })
      continue
    }

    // Check if the first line is a parenthetical marker (standalone, no header).
    // block[0] exists — see the remainingBlocks non-empty note above.
    const parenMatch = block[0]!.match(PAREN_MARKER_RE)
    if (parenMatch) {
      const label = normaliseLabel(parenMatch[1]!, parenMatch[2])
      sections.push({
        id: slugify(label),
        label,
        lines: block.slice(1).map((l) => l.trim()).filter((l) => l !== ''),
      })
      continue
    }

    // No header — treat as continuation or unnamed section.
    // This can happen with the title block remainder or unexpected blocks.
    // If there's a previous section, append lines; otherwise create an unnamed section.
    if (sections.length > 0) {
      // Guaranteed non-empty by the length check above.
      const prev = sections[sections.length - 1]!
      prev.lines.push(...block.map((l) => l.trim()).filter((l) => l !== ''))
    } else {
      // Unlabeled section at the beginning — rare but handle gracefully
      sections.push({
        id: 'section-1',
        label: 'Section 1',
        lines: block.map((l) => l.trim()).filter((l) => l !== ''),
      })
    }
  }

  const copyright = parseFooter(footerLines, title)

  return {
    title,
    sections,
    copyright,
  }
}
