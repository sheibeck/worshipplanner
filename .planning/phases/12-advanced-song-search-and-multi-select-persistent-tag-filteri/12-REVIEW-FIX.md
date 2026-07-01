---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
fixed_at: 2026-07-01T17:41:35-04:00
review_path: .planning/phases/12-advanced-song-search-and-multi-select-persistent-tag-filteri/12-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-07-01T17:41:35-04:00
**Source review:** .planning/phases/12-advanced-song-search-and-multi-select-persistent-tag-filteri/12-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Critical + Warning; 0 Critical, 2 Warning)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Tag filter does not reset to defaults when switching to an org/user with no saved filter

**Files modified:** `src/stores/songs.ts`, `src/stores/__tests__/songs.test.ts`
**Commit:** 6ed85a1
**Applied fix:** Updated `hydrateTagFilter()` in `src/stores/songs.ts` so that all three exit paths — missing storage key (no uid/org), no stored entry for the current key, and corrupt/unparseable JSON — now explicitly reset `tagFilterChecked` to an empty `Set` and `tagFilterHide` to `false`, instead of silently leaving whatever in-memory state was carried over from a previous `subscribe()` call. This closes the gap where User A's non-default tag filter could remain visibly applied after User B logs in within the same tab/session and has no saved filter of their own, restoring the store's stated T-12-03 guarantee that state never bleeds across accounts on a shared browser. Added a new store test, `resets in-memory tag filter when switching to a user/org with no stored entry (WR-01, T-12-03)`, which sets a non-default filter for `uid-a`/`org-a`, waits for it to persist, then calls `subscribe('org-b')` under `uid-b` (no stored entry) and asserts the in-memory filter resets to defaults. All 57 store tests pass (56 pre-existing + 1 new).

### WR-02: Multi-word field-scoped filter values silently fail to match (`tag: christmas eve`)

**Files modified:** `src/utils/songSearch.ts`, `src/utils/__tests__/songSearch.test.ts`
**Commit:** 8544bd1
**Applied fix:** Reworked the tokenization step in `songMatchesQuery()` in `src/utils/songSearch.ts`. Instead of collapsing `"prefix: value"` to `"prefix:value"` and then splitting the whole query on whitespace (which broke multi-word values into a field token plus stray bare terms), the function now first extracts all field-scoped spans via a new `FIELD_SPAN_RE` regex that greedily captures everything after a recognized `prefix:` keyword up to the next recognized prefix keyword or end of string. Each captured span becomes a single `field:value` term (value may contain spaces). Whatever text remains after removing the matched spans is then split into bare whitespace-separated terms as before. All extracted terms (field-scoped + bare) are AND'd together via the existing `matchesToken()` dispatcher, whose signature and per-field switch logic were left unchanged — `songMatchesQuery(song, query): boolean` signature (D-07) is preserved. Added four new tests covering: a multi-word tag value matching as a single phrase (`tag: christmas eve`), a non-matching multi-word value asserting no false positive, ANDing a multi-word field value with a following `key:` field span, and ANDing a bare term placed *before* a multi-word field span (documenting that a field span with no following recognized prefix greedily consumes to end-of-string, so a bare term after it would currently be absorbed into the field value rather than treated as separate — this is the documented behavior of the greedy-to-end-of-string design chosen in the REVIEW.md fix suggestion). All 28 songSearch tests pass (24 pre-existing + 4 new; note REVIEW.md described 25 pre-existing tests including the `describe` block for `getPrimaryArrangement`/`getPrimaryKey`, which remain unaffected). Full project test suite (484 tests across 21 files) and `npm run type-check` both pass cleanly after both fixes.

## Skipped Issues

None — both in-scope findings were fixed.

---

_Fixed: 2026-07-01T17:41:35-04:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
