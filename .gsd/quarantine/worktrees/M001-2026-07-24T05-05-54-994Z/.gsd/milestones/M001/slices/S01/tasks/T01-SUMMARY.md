---
id: T01
parent: S01
milestone: M001
key_files:
  - src/types/slide.ts
  - src/types/songLyrics.ts
  - src/utils/ccliParser.ts
  - src/utils/__tests__/ccliParser.test.ts
key_decisions:
  - Added TERMS_LINE_RE regex to detect and skip the SongSelect terms-of-use boilerplate line in footer parsing
duration: 
verification_result: passed
completed_at: 2026-07-23T20:12:20.093Z
blocker_discovered: false
---

# T01: CCLI paste parser and core lyric/slide types with 19 passing tests

**CCLI paste parser and core lyric/slide types with 19 passing tests**

## What Happened

Created four files: src/types/slide.ts (unified Slide type with contentKind discriminator), src/types/songLyrics.ts (LyricSection, CopyrightInfo, SongLyrics, ParsedCCLI interfaces), src/utils/ccliParser.ts (full CCLI SongSelect paste parser handling legacy and 2023+ formats, parenthetical section markers, and edge cases), and src/utils/__tests__/ccliParser.test.ts (19 comprehensive tests). Fixed a bug where the SongSelect terms-of-use boilerplate line was being treated as an author candidate by adding TERMS_LINE_RE detection to isFooterLine() and parseFooter().

## Verification

All 19 tests pass via npx vitest run src/utils/__tests__/ccliParser.test.ts --reporter=verbose --pool=threads

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/utils/__tests__/ccliParser.test.ts --reporter=verbose --pool=threads` | 0 | 19 passed | 10240ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/types/slide.ts`
- `src/types/songLyrics.ts`
- `src/utils/ccliParser.ts`
- `src/utils/__tests__/ccliParser.test.ts`
