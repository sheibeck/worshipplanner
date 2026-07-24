---
estimated_steps: 22
estimated_files: 4
skills_used: []
---

# T01: CCLI Paste Parser and Core Types

Create the foundational types and the CCLI SongSelect paste parser.

1. Create src/types/slide.ts with the unified Slide type:
   - contentKind discriminator field ('lyric' initially, 'scripture'/'imported' in later slices)
   - Common fields: id, position, contentKind
   - Lyric-specific fields: sectionId, sectionLabel, lines (string[])
   - Copyright-specific fields: title, authors, ccliSongNumber, copyrightLines, ccliLicenseNumber

2. Create src/types/songLyrics.ts with:
   - LyricSection interface: id (slug like 'verse-1', 'chorus'), label (display name like 'Verse 1'), lines (string[])
   - CopyrightInfo interface: title, authors (string[]), ccliSongNumber, copyrightLines (string[]), ccliLicenseNumber
   - SongLyrics interface: id, songId, sections (LyricSection[]), copyright (CopyrightInfo), performanceOrder (string[]), createdAt, updatedAt
   - ParsedCCLI interface (parser output): title, sections (LyricSection[]), copyright (CopyrightInfo)

3. Create src/utils/ccliParser.ts with parseCCLIPaste(rawText: string): ParsedCCLI:
   - Extract title from first non-blank line
   - Match section headers with regex: /^(Verse|Chorus|Bridge|Pre-Chorus|Ending|Tag|Misc|Intro)\s*\d*$/i
   - Handle parenthetical section markers like (PRE-CHORUS) and (BRIDGE) as first line of a section
   - Collect lyric lines between section header and next double-blank-line
   - Detect footer by 'CCLI Song' prefix; parse both legacy format (pipe-delimited authors, CCLI Song # first) and 2023 format (comma-delimited authors, authors first)
   - Handle edge cases: Unicode copyright symbol vs ASCII (c), varying spaces before #, missing section numbers (default to 1), multiple copyright lines, empty paste, title-only paste
   - Generate section IDs as slugified label: 'Verse 1' -> 'verse-1', 'Chorus' -> 'chorus'
   - Default performanceOrder: sections in definition order, each once

4. Create src/utils/__tests__/ccliParser.test.ts with comprehensive tests:
   - Legacy format, 2023 format, missing section numbers, Pre-Chorus edge cases, multiple copyright lines, Unicode/ASCII copyright symbols, empty paste, title-only paste, section ID generation

## Inputs

- `src/types/song.ts`
- `src/types/service.ts`

## Expected Output

- `src/types/slide.ts`
- `src/types/songLyrics.ts`
- `src/utils/ccliParser.ts`
- `src/utils/__tests__/ccliParser.test.ts`

## Verification

npx vitest run src/utils/__tests__/ccliParser.test.ts --reporter=verbose
