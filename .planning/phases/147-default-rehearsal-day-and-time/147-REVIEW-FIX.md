---
phase: 147-default-rehearsal-day-and-time
fixed_at: 2026-11-06T18:00:00Z
review_path: .planning/phases/147-default-rehearsal-day-and-time/147-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 147: Code Review Fix Report

**Fixed at:** 2026-11-06
**Source review:** .planning/phases/147-default-rehearsal-day-and-time/147-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### WR-01: After "Save defaults", the time inputs are the same array as the store, so unsaved edits change the live defaults

**Files modified:** `docs/specs/default-rehearsal.md`, `src/views/__tests__/SettingsView.defaultsWrites.test.ts`, `src/views/SettingsView.vue`
**Commits (spec, then failing test, then fix):**
- `ababec4a` spec: new criterion `AC-RHD-69 (R459)` after AC-RHD-03
- `435e9ed1` test: two tests citing AC-RHD-69, run against the real auth store. Both failed before the fix. Edit after save: store read `['20:00']`, expected `['19:00']`. Add after save: store read `['19:00', '']`.
- `44d6baa9` fix: `SettingsView.vue:1398` now assigns `[...newRehearsalDefaults]`

**Applied fix:** The save handler no longer hands the store's array to the inputs. Other places that could link the inputs to the store are already copies. The initial seed (line 747) and the watch reseed (line 824) both spread the store array. `previousRehearsalDefaults` (line 1381) is a spread copy. The failed-save rollback assigns that copy, and `updateDoc` rejects before the store's mirror write, so the store is never touched on that path. `auth.ts:467` stores whatever array it is given, so the copy at the view boundary is the fix.

**Verification:** `npx vitest run src/views/__tests__/SettingsView.test.ts src/views/__tests__/SettingsView.defaultsWrites.test.ts src/__tests__/specCoverage.test.ts` passed, 3 files and 229 tests. `npm run type-check` exited 0. `git ls-files --eol` shows `SettingsView.vue` as `i/lf w/crlf`, with no `w/mixed`. The `.planning/graphs/*` files were not staged.

---

_Fixed: 2026-11-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
