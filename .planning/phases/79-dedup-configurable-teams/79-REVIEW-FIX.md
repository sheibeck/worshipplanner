---
phase: 79-dedup-configurable-teams
fixed_at: 2026-08-24T03:57:59Z
review_path: .planning/phases/79-dedup-configurable-teams/79-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
excluded: 2
status: all_fixed
---

# Phase 79: Code Review Fix Report

**Fixed at:** 2026-08-24T03:57:59Z
**Source review:** .planning/phases/79-dedup-configurable-teams/79-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01, WR-02, WR-04, IN-01, IN-02) — per explicit `<apply>` instruction
- Fixed: 5 / 5 in-scope findings
- Excluded (out of scope, not attempted): 2 (WR-03, IN-03) — explicitly named as SKIP in the
  `<apply>` instruction, so they were never in scope for this run rather than fixes that failed
  or were skipped mid-attempt

## Fixed Issues

### WR-01: Duplicate team names are unprevented and break checkbox selection + AI-filter matching

**Files modified:** `src/components/TeamsConfigPanel.vue`, `src/components/__tests__/TeamsConfigPanel.test.ts`
**Commit:** `9eeb325e`
**Applied fix:** Added an `isDuplicateName(name, excludeId?)` helper (trimmed, case-insensitive
compare against `teamsStore.teams`, excluding the row being edited). `onAddTeam()` and
`onSaveTeam()` both call it before touching the store; on collision they push a message via the
app's existing `useToasts()` failure-toast store (the same pattern already used by
`CongregationalEditor.vue`/`saveStatus.ts` for surfacing errors — this panel had no local
error-display pattern of its own to reuse) and return without calling `addTeam`/`updateTeam`.
Added 2 new tests covering rejection on rename and on add (case/whitespace-insensitive), plus
confirmed a same-name self-save (no name change) still succeeds.

### WR-02: Renaming a team silently orphans it from every service that already selected it, with no warning

**Files modified:** `src/components/TeamsConfigPanel.vue`, `src/components/__tests__/TeamsConfigPanel.test.ts`
**Commit:** `e2800528`
**Applied fix:** Added a `confirmRenameId` ref and an inline amber soft-warn banner (mirroring the
existing red delete-confirm banner's structure/copy pattern exactly: warning text + a primary
confirm button + a Cancel button). `onSaveTeam()` now detects `trimmedName !== team.name`; on the
first click it sets `confirmRenameId` and returns instead of saving; a second click (either the
row's own "Save Team" button or the banner's "Rename Team" button) proceeds with the actual
`updateTeam` call. Song-tag-only edits (no name change) are unaffected and save immediately.
Updated the pre-existing "editing a name then clicking Save Team calls updateTeam" test (its old
assertion — immediate save on first click — was superseded by this fix) and added 3 new tests:
confirm-then-save, cancel-dismisses-without-saving, and non-rename saves skip confirmation.

### WR-04: `onAddTeam()` has no in-flight guard, unlike `onSaveTeam()`'s `savingTeamId` disable

**Files modified:** `src/components/TeamsConfigPanel.vue`, `src/components/__tests__/TeamsConfigPanel.test.ts`
**Commit:** `7004a1b6`
**Applied fix:** Added an `adding` ref mirroring `savingTeamId`. `onAddTeam()` early-returns if
`adding.value` is already true, sets it before the `await teamsStore.addTeam(...)` call, and
clears it in a `finally` block. The Add-Team button's `:disabled` expression is simplified to
`adding || !newTeamName.trim()` (dropping the `!teamAdded` clause the review noted "doesn't do
what it appears to be doing"), and the button label shows "Saving…" while in flight. Added a test
that fires two back-to-back clicks on the Add-Team button before the mocked `addTeam` promise
resolves and asserts it was called exactly once.

### IN-01: `team.ts`'s "zero behavior change" doc comment overstates what the seed actually preserves

**Files modified:** `src/types/team.ts`
**Commit:** `f8a0cb77`
**Applied fix:** Comment-only change. Rewrote the `DEFAULT_TEAMS` doc comment to scope "zero
behavior change" explicitly to the team *list* (checkbox names), and added an explicit note that
the Orchestra AI-filter behavior is NOT auto-preserved — no `songFilterTag` is seeded, so
`filterSongsByTeamTags` returns the unfiltered pool until an admin manually re-sets the tag via
Volunteers → Teams. No runtime behavior change; verified via type-check only (Tier 3 — comment
change, no test assertions apply).

### IN-02: Delete button text carries no per-row context for assistive tech

**Files modified:** `src/components/TeamsConfigPanel.vue`, `src/components/__tests__/TeamsConfigPanel.test.ts`
**Commit:** `6ce02285`
**Applied fix:** Added `:aria-label="`Delete ${row.team.name} team`"` to the per-row Delete
button, matching the existing `aria-label` pattern already used on that row's name input and
song-tag select. Added a test asserting each row's Delete button aria-label names its team
(`'Delete Choir team'`, `'Delete Orchestra team'`).

## Excluded Findings (out of scope, not attempted)

These 2 findings from REVIEW.md were explicitly named in the `<apply>` SKIP list — they were never
in scope for this run, as distinct from a fix that was attempted and skipped mid-way.

### WR-03: `seedDefaultTeamsIfEmpty()`/`addTeam()` have no protection against concurrent first-writer races

**File:** `src/stores/teams.ts:56-66`
**Reason excluded:** "seed-race is a pre-existing class identical to `roster.ts`, not newly
introduced by this phase — leave it, matching the established pattern."
**Original issue:** The idempotency guard only protects a single already-loaded store snapshot;
two clients opening a seeding view for the same brand-new org near-simultaneously can both seed,
producing duplicate team docs. Mirrors the pre-existing `roster.ts` risk.

### IN-03: Stale `songFilterTag` can point at a tag no longer in `songStore.allUserTags`

**File:** `src/components/TeamsConfigPanel.vue:22-29`
**Reason excluded:** "stale-songFilterTag `<select>` display mismatch INFO (minor, leave)."
**Original issue:** If a team's `songFilterTag` no longer appears in `songStore.allUserTags`, the
bound `<select>` has no matching `<option>` and renders blank/first-option despite the underlying
value being preserved. Display-only confusion, no data loss.

## Verification

- `npx vitest run src/components/__tests__/TeamsConfigPanel.test.ts` — 15/15 passing (after each
  layered commit, re-verified incrementally: 11 → 13 → 14 → 15 tests as each fix landed).
- `npm run type-check` (`vue-tsc --build`, full form) — clean after every commit and on the final
  state.
- `npx vitest run` (full app suite) — 3783 passed, 27 failed, but all 27 failures fall inside
  exactly the 2 files CLAUDE.md documents as the known-failing baseline:
  `src/storage.rules.test.ts` (times out without a running Storage emulator; even with the
  emulator up, 2 of its allow-cases are a documented pre-existing defect, not a regression) and
  `src/views/__tests__/RosterView.test.ts` (stale assertion). No new file failures were introduced
  by any of the 5 fixes.

## Notes

- `fix_scope` for this run was determined by the explicit `<apply>`/`<gates>` instructions in the
  fixer's prompt rather than the default `critical_warning` scope: the prompt named 5 specific
  findings to fix (WR-01, WR-02, WR-04, and the two Info findings — a11y and doc-comment) and 2 to
  explicitly skip (WR-03, the stale-`songFilterTag` Info finding). `findings_in_scope` above
  reflects that 5, not REVIEW.md's full 7.
- Each finding was applied and committed in its own atomic commit, verified independently
  (component test suite + type-check) before moving to the next, so a `git bisect`/revert of any
  single commit is safe and does not depend on later commits.
- Ran inside an isolated worktree (`gsd-reviewfix/79-119073`, at a `mktemp`-generated path) per the
  fixer's isolation protocol; cleanly fast-forwarded onto `master` and torn down (worktree +
  branch + recovery sentinel) after all 5 commits landed and gates passed.

---

_Fixed: 2026-08-24T03:57:59Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
