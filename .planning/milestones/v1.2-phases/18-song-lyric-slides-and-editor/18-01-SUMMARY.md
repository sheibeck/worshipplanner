---
phase: 18-song-lyric-slides-and-editor
plan: 01
status: complete
requirements: [R001, R002, R019]
commits:
  - 05ab4bd feat(M001-S01-T01): add CCLI paste parser and core lyric/slide types
key-files:
  created:
    - src/types/slide.ts
    - src/types/songLyrics.ts
    - src/utils/ccliParser.ts
    - src/utils/__tests__/ccliParser.test.ts
---

# Phase 18 Plan 01: CCLI Paste Parser and Core Types — Summary

**COMPLETE.** Established the foundational type system and the CCLI SongSelect paste parser — the highest-risk, zero-UI-dependency seam every downstream plan builds on.

## What Was Built

- **`src/types/slide.ts`** — the unified `Slide` type with a `contentKind` discriminator (R019). This phase implements `contentKind: 'lyric'`; the type is shaped so later phases add `'scripture'` and `'imported'` variants. Consumers narrow on `contentKind` to reach shape-specific fields.
- **`src/types/songLyrics.ts`** — `LyricSection` (slug id + display label + lines), `CopyrightInfo` (title, authors[], ccliSongNumber, copyrightLines[], ccliLicenseNumber), `SongLyrics` (the persisted subcollection doc, with sections/copyright/performanceOrder/timestamps), and `ParsedCCLI` (the parser's output shape).
- **`src/utils/ccliParser.ts`** — `parseCCLIPaste(rawText)` extracts the title from the first non-blank line, matches section headers via `/^(Verse|Chorus|Bridge|Pre-Chorus|Ending|Tag|Misc|Intro)\s*\d*$/i`, handles parenthetical markers like `(PRE-CHORUS)`/`(BRIDGE)`, collects lyric lines per section, and parses both legacy (pipe-delimited authors, `CCLI Song #` first) and 2023 (comma-delimited authors, authors first) footer formats. Section ids are slugified labels (`Verse 1` → `verse-1`); the default performance order is each section once in definition order.

## Edge Cases Covered

Unicode `©` vs ASCII `(c)`, varying spaces before `#`, missing section numbers (default 1), multiple copyright lines, empty paste, and title-only paste.

## Verification

`npx vitest run src/utils/__tests__/ccliParser.test.ts` — 19 tests pass (legacy + 2023 formats, section headers, copyright parsing, slugification, CRLF handling, empty/title-only edge cases). Confirmed at phase UAT.
