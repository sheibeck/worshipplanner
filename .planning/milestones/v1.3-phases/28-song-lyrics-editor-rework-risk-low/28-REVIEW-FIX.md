---
phase: 28-song-lyrics-editor-rework-risk-low
fixed_at: 2026-07-27T23:45:00Z
review_path: .planning/phases/28-song-lyrics-editor-rework-risk-low/28-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 28: Code Review Fix Report

**Fixed at:** 2026-07-27T23:45:00Z
**Source review:** .planning/phases/28-song-lyrics-editor-rework-risk-low/28-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02 — both Warnings)
- Fixed: 2
- Skipped: 0

Scope note: IN-01 (missing error handling around autosave/save-version/revert/paste writes)
was explicitly excluded from this fix pass per the task's `<scope>` instruction — see
"Deferred Issues" below.

## Fixed Issues

### WR-02: Trailing newline in the section textarea persists a spurious blank line

**Files modified:** `src/components/SongLyricEditor.vue`, `src/components/__tests__/SongLyricEditor.test.ts`
**Commit:** `52d0a5d`

**Applied fix:** `onSectionInput` strips exactly one trailing empty element from
`value.split('\n')` before assigning `section.lines`, matching the review's suggested fix
verbatim (guarded by `lines.length > 1` so a fully-cleared textarea still stores a single
empty line rather than zero lines). Fixed this one first per the task's design guidance,
since it is the more consequential of the two (a live-projected blank line).

**Tests added:**
- `a trailing newline in the textarea does not persist a spurious blank line (WR-02)` —
  types `'Line one\nLine two\n'` into the textarea, saves, and asserts the persisted
  `section.lines` is `['Line one', 'Line two']` with no trailing empty string.
- `clearing a textarea entirely still stores a single empty line, not zero lines (WR-02 guard
  does not over-strip)` — regression guard on the `lines.length > 1` condition itself.

### WR-01: Row expand/collapse state can silently reattach to the wrong occurrence after a reorder

**Files modified:** `src/utils/songSectionOrder.ts`, `src/components/SongLyricEditor.vue`,
`src/utils/__tests__/songSectionOrder.test.ts`, `src/components/__tests__/SongLyricEditor.test.ts`
**Commit:** `51b9c68`

**Applied fix:** Followed the task's design guidance (which preferred the full fix over the
review's own smaller-mitigation fallback) — minted a stable per-row identity at the point
each row enters `performanceOrder`, rather than continuing to re-derive it from position:

- `buildSectionRows(sections, order, slotIds?)` in `songSectionOrder.ts` gained an optional
  third parameter: a parallel array of caller-minted slot ids. When supplied (and
  length-matched to `order`), each `SectionRow` exposes a new `stableKey` field set from
  `slotIds[i]`; when omitted, `stableKey` falls back to the existing positionally-derived
  `rowKey`, so every pre-existing 2-argument caller (including the full
  `songSectionOrder.test.ts` suite) is unaffected. This keeps the module PURE — no new
  imports, same signature contract for existing callers.
- `SongLyricEditor.vue` now maintains a component-local `orderSlotIds` ref in lockstep with
  `editableState.performanceOrder`: `moveRow` (generic, reused unchanged) mirrors a drag;
  `onDuplicate` mints a fresh slot id for the new occurrence (it is a distinct physical row,
  D-02's reference model notwithstanding — same words, own reorder/remove identity);
  `onRemove` splices out the matching slot id; `onAddSection` appends one. `expandedRowKeys`,
  `isExpanded`, and `toggleRow` now key off `row.stableKey` instead of `row.rowKey`.
- The `currentLyrics` watcher only reseeds `orderSlotIds` (freshly minting one id per slot)
  when the incoming normalized order actually differs from what's already held. This matters
  because the watcher re-fires after the component's own autosave round-trips back through
  the Firestore subscription with an *unchanged* order — reseeding unconditionally there
  would have silently collapsed every expanded row after every single save, a regression the
  fix specifically avoids.
- All `data-testid` attributes and the `rowKey`/`:key` binding were deliberately left on the
  old positional scheme — only the internal expand-state bookkeeping moved to `stableKey` —
  so none of the ~30 pre-existing tests asserting on `section-row-chorus#0`-style testids
  needed to change.

**Tests added:**
- `songSectionOrder.test.ts`: a `describe('stableKey (WR-01)')` block — fallback to `rowKey`
  when `slotIds` is omitted or length-mismatched; correct positional use of supplied
  `slotIds`; and a direct assertion that a slot id "travels with its order slot" rather than
  with "being a repeat" when two same-section slots swap position in the order array.
- `SongLyricEditor.test.ts`: `reordering a twice-referenced section keeps expand state
  attached to the physical row the user opened, not the stale positional key (WR-01)` —
  reproduces the review's exact repro (order `[chorus, verse-1, chorus]`, expand the repeat,
  drag the followed chorus past it to `[verse-1, chorus, chorus]`) and asserts the physically
  -expanded row is still expanded (now rendered as the non-repeat occurrence) while the row
  that was never expanded stays collapsed.

## Deferred Issues (not attempted — explicitly out of scope)

### IN-01: Save/paste/revert failures are silent — no error surfaced to the user

**File:** `src/components/SongLyricEditor.vue:330-339` (`doAutoSave`), `:509-517`
(`onSaveVersion`), `:519-521` (`onRevertVersion`); `src/components/LyricPasteDialog.vue:184-203`

**Rationale for deferral:** Per the task's `<scope>` instruction, this Info finding was
explicitly excluded from this fix pass. It describes a broader pre-existing pattern (no
`catch` around Firestore writes) that predates Phase 28 and spans multiple components beyond
this phase's boundary (`LyricPasteDialog.vue`, `useAutoSave.ts`'s own bare `try/finally`).
Addressing it well requires a decision on the app-wide error-surfacing mechanism (toast vs.
inline banner vs. a new `useAutoSave` status value), which belongs in its own scoped piece of
work rather than at the tail of a risk:low phase's warning-fix pass.

## Verification

- `npx vitest run src/utils/__tests__/songSectionOrder.test.ts
  src/components/__tests__/SongLyricEditor.test.ts
  src/components/__tests__/SongLyricsTab.r035.test.ts` — 120/120 passed (48 in
  `SongLyricEditor.test.ts`, up from 44 pre-fix; 39 in `songSectionOrder.test.ts`, up from 35;
  R035's 7 tests unaffected).
- Full `npx vitest run src/` — 10 failed test files (156 passed / 166), matching the documented
  baseline file set (8 `.gsd/quarantine/worktrees/**` files + `src/storage.rules.test.ts` +
  `src/views/__tests__/RosterView.test.ts`) exactly. None of the files touched by these fixes
  appear in the failing set.
- `npm run type-check` — 0 errors.
- `npm run build` — succeeded (pre-existing chunk-size warnings only, unrelated to this change).

---

_Fixed: 2026-07-27T23:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
