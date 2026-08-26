---
phase: 84-last-used-date-correctness-backfill
verified: 2026-08-26T00:20:00Z
status: passed
status_note: "Auto-verified 8/8; the two human_verification items below are owner-only (production backfill --apply + live click-through) and deferred to PENDING-VERIFICATION.md per owner decision 2026-08-26 (v1.4–v2.2 precedent)."
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Owner runs `node functions/lib/backfillLastUsed.js --apply` locally with Admin credentials against the production Berean org (after `cd functions && npm run build`)."
    expected: "Every song with >=1 locked service gets `lastUsedAt` set to the MAX date of its locked services; songs with no locked service (including songs in no service at all) are left completely untouched; a dry run first shows the intended changes for owner review before `--apply`."
    why_human: "This is a production-data write against the live Berean org's Firestore, explicitly scoped as an owner-run, owner-confirmed action outside GSD execution scope (per the 2026-08-25 confirm-then-deploy policy and the plan's own 'Owner-run step' note). It cannot and must not be executed by the verifier."
  - test: "In the real app UI, open a draft service, add a song, then click 'Mark as Planned'. Confirm the song's last-used date shown elsewhere in the UI (e.g. song list / suggestions) now reads the service's date, not today's date. Then reopen the service and confirm the song's last-used date falls back correctly."
    expected: "The last-used date visibly reflects the service date after locking, and updates correctly after reopen — matching the automated store-level proof end-to-end in the real browser/Firestore environment."
    why_human: "Visual/UX confirmation in the live app is outside what grep/unit-test evidence can certify, even though the underlying store logic is fully proven by passing tests (see Goal Achievement below)."
---

# Phase 84: Last-Used Date Correctness & Backfill Verification Report

**Phase Goal:** A song's last-used / last-scheduled date always reflects the most recent service the song was actually added to — including locked and exported services — and every existing song's date is corrected retroactively by a one-time backfill.
**Verified:** 2026-08-26T00:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (SC1/R247) | A song added to a service shows a last-used date matching that service's date once the service is LOCKED (status !== 'draft'), including exported services — no lag behind reality | ✓ VERIFIED | `src/utils/lastUsed.ts::isLockedStatus` = `status !== 'draft'` (covers `'planned'`/`'exported'`); `computeLastUsedDate` MAX over locked services. Wired via `markAsPlanned` in `src/stores/services.ts:430-464`. Proven by `src/stores/__tests__/services.test.ts:2262` `"markAsPlanned writes lastUsedAt as the Timestamp for the service date, for each song in the service"` (pass). |
| 2 (SC1/R247, critical) | No remaining code path re-stamps `serverTimestamp()` for song last-used on mark-as-planned/lock or reopen (the CR-01 fix removed `bumpScheduledSongsLastUsed`) | ✓ VERIFIED | `grep -n "bumpScheduledSongsLastUsed" src/views/ServiceEditorView.vue` returns zero matches (function and call site fully deleted, commit `e1200a31`). Remaining `serverTimestamp()` calls in `ServiceEditorView.vue` are for `lockedAt`/other fields, none for `lastUsedAt`. `assignSongToSlot` in `services.ts` has an explicit comment (line 637-641) confirming the old `lastUsedAt: serverTimestamp()` stamp was removed and replaced by lock-time recompute. Explicit regression test `src/views/__tests__/ServiceEditorView.test.ts:7570` `"CR-01 regression: does NOT bump SONG documents directly — serviceStore.markAsPlanned is the only lastUsedAt writer"` asserts zero `songStore.updateSong` calls with a `lastUsedAt` patch from the view (pass). |
| 3 (SC1/R247) | Adding a song to a DRAFT service does NOT set/advance lastUsedAt | ✓ VERIFIED | `src/stores/__tests__/services.test.ts:2251` `"assignSongToSlot on a DRAFT service does NOT call songStore.updateSong (no wall-clock stamp)"` (pass). |
| 4 (SC2/R247) | Adding the same song to a later-dated locked service advances its lastUsedAt (MAX over locked services); an earlier locked service does not regress it | ✓ VERIFIED | `computeLastUsedDate` implements MAX via string comparison over locked services (`src/utils/lastUsed.ts:46-56`). Proven at the store level by `services.test.ts:2301` `"locking a later-dated service advances lastUsedAt beyond an already-locked earlier service"` (pass) and at the unit level by 17 cases in `src/utils/__tests__/lastUsed.test.ts` including max/tie. |
| 5 (R247) | Reopening a locked service recomputes lastUsedAt from remaining locked services (may become null) | ✓ VERIFIED | `reopenService` in `services.ts:477-506` captures songIds pre-write, recomputes post-write with the service forced to `'draft'` in the snapshot. `services.test.ts:2318` `"reopenService on the only locked service containing a song recomputes its lastUsedAt to null"` (pass). |
| 6 (SC3/R248) | The single-org backfill recomputes every song's last-used date from its locked services, dry-run default + `--apply`, and is not deployed | ✓ VERIFIED | `functions/src/backfillLastUsed.ts` — dry run is default (`apply = process.argv.includes('--apply')`, line 296); `grep backfillLastUsed functions/src/index.ts` returns no match (not re-exported/not deployed); single-org via `--org` arg or sole `organizations` doc (`resolveOrgIdFromArgsOrSoleOrg`). |
| 7 (SC3/R248) | The backfill is conservative: writes only when >=1 locked service, never blanks a no-service or draft-only song, and preserves Planning-Center-import dates | ✓ VERIFIED | `functions/src/backfillLastUsed.test.ts` — `"conservative write rule: a song with no locked service (draft-only, or no service) is NEVER blanked"` (pass, part of 15/15 passing suite). Also idempotent (`"idempotent: re-running --apply against the post-write state writes nothing on the second run"`, pass). |
| 8 (R247/R248 parity) | The live path and the backfill derive the date from the identical logic and cannot disagree | ✓ VERIFIED | `functions/src/backfillLastUsed.ts` mirrors `computeLastUsedDate`/`serviceDateToMillis`/`isLockedStatus` byte-identical from `src/utils/lastUsed.ts` (verified via scripted diff per SUMMARY, and both sides' `serviceDateToMillis` use the identical WR-03 `Date.UTC` fix). `functions/src/backfillLastUsed.test.ts`'s "mirrored derivation parity with src/utils/lastUsed.ts" 8-case block passes. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/lastUsed.ts` | Canonical pure last-used derivation (computeLastUsedDate, isLockedStatus, serviceDateToMillis, serviceToLastUsedInput) | ✓ VERIFIED | Present, exports all 4 symbols + interface; no `firebase*`/`vue` imports (confirmed by reading file). |
| `src/utils/__tests__/lastUsed.test.ts` | Unit tests for the helper | ✓ VERIFIED | 17/17 tests pass (`npx vitest run src/utils/__tests__/lastUsed.test.ts`). |
| `src/stores/services.ts` | assignSongToSlot stamp removed; markAsPlanned/reopenService recompute wired | ✓ VERIFIED | Confirmed via grep + read: `recomputeLastUsedFor`, `buildLastUsedSnapshot`, `songIdsInService` (deduped) present; both call sites wrapped in try/catch (CR-02 soft-fail). |
| `src/stores/__tests__/services.test.ts` | Store tests for lock/unlock recompute + draft no-stamp | ✓ VERIFIED | `"lastUsedAt recompute (R247)"` describe block, 7 tests covering draft-no-stamp, lock-writes-date, dedup (WR-01), later-lock-advances, reopen-recomputes-to-null, and 2 CR-02 soft-fail regression tests. All pass (109/109 file total). |
| `functions/src/backfillLastUsed.ts` | Admin-SDK backfill script, dry-run default, --apply, single-org, conservative, idempotent | ✓ VERIFIED | Present; compiles clean (`npx tsc --noEmit -p tsconfig.json`); not exported from `index.ts`; includes WR-02 malformed-date guard (`malformedServices` field) and WR-03 UTC-midnight parse fix. |
| `functions/src/backfillLastUsed.test.ts` | Dry-run/apply/idempotency/conservative-write/parity coverage | ✓ VERIFIED | 15/15 tests pass (`cd functions && npx vitest run src/backfillLastUsed.test.ts`). |
| `src/views/ServiceEditorView.vue` (CR-01 fix target) | `bumpScheduledSongsLastUsed` removed | ✓ VERIFIED | Zero matches for the function name in the file; explicit scope-note comments left at lines 3023-3062 and 4494-4497 documenting the removal and why `services.ts::markAsPlanned` is now the sole writer. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `services.ts::markAsPlanned`/`reopenService` | `computeLastUsedDate(songId, services)` | direct function call inside `recomputeLastUsedFor` | ✓ WIRED | Confirmed by reading `services.ts:345-355`. |
| `services.ts::recomputeLastUsedFor` | `songStore.updateSong(id, { lastUsedAt })` | `await songStore.updateSong(...)` | ✓ WIRED | `services.ts:353`. |
| `ServiceEditorView.vue::onMarkAsPlanned` | `serviceStore.markAsPlanned` | sole caller, no competing write | ✓ WIRED (and un-clobbered) | Confirmed via grep across `src/` that `markAsPlanned(` has exactly one application call site, and the former competing `bumpScheduledSongsLastUsed` write no longer exists. |
| `functions/src/backfillLastUsed.ts` | `organizations/{orgId}/services`, `organizations/{orgId}/songs` | Admin SDK `.get()` reads | ✓ WIRED | Confirmed via read of `backfillLastUsedForOrg`. |
| `functions/src/backfillLastUsed.ts::computeLastUsedDate`/`serviceDateToMillis` | `src/utils/lastUsed.ts` (source of truth) | verbatim mirror, cross-package (no import possible) | ✓ WIRED (via mirror + parity tests) | Parity block in `backfillLastUsed.test.ts` passes; both use identical `Date.UTC` convention post-WR-03. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Helper unit suite | `npx vitest run src/utils/__tests__/lastUsed.test.ts` | 17/17 passed | ✓ PASS |
| Store recompute suite (targeted) | `npx vitest run src/stores/__tests__/services.test.ts` | 109/109 passed (part of combined 3-file run: 461/461) | ✓ PASS |
| View regression (CR-01) suite | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | 335/335 passed | ✓ PASS |
| Backfill unit suite | `cd functions && npx vitest run src/backfillLastUsed.test.ts` | 15/15 passed | ✓ PASS |
| App type-check gate | `npm run type-check` (vue-tsc --build, includes tests) | 0 errors | ✓ PASS |
| Functions type-check gate | `cd functions && npx tsc --noEmit -p tsconfig.json` | 0 errors | ✓ PASS |
| Full app suite (bare `npx vitest run`) | per CLAUDE.md's documented command | 4347 passed, 1 failed (RosterView.test.ts, known stale-assertion baseline), 2 test files failed total (2nd being `src/storage.rules.test.ts`, known no-emulator baseline) | ✓ PASS (matches documented baseline exactly, no new failures) |
| Full functions suite | `cd functions && npx vitest run` | 590/590 passed (17/17 files) | ✓ PASS |
| `backfillLastUsed` not deployed | `grep backfillLastUsed functions/src/index.ts` | no match | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R247 | 84-01 | Last-used date reflects most recent LOCKED service, not wall-clock assignment time | ✓ SATISFIED | `.planning/REQUIREMENTS.md:12` marked `[x]` / "Complete"; live-path code, tests, and CR-01 review-fix all confirmed above. |
| R248 | 84-02 | One-time backfill recomputes every song's last-used date from locked services | ✓ SATISFIED | `.planning/REQUIREMENTS.md:13` marked `[x]` / "Complete"; script + tests confirmed above. The `--apply` production run itself is an owner action (see Human Verification). |

No orphaned requirements found in REQUIREMENTS.md for Phase 84.

### Anti-Patterns Found

None. Scanned `src/utils/lastUsed.ts`, `src/stores/services.ts`, `functions/src/backfillLastUsed.ts`, and `src/views/ServiceEditorView.vue` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers — zero matches in the phase's touched code. No stub returns, no hardcoded-empty stand-ins for the lastUsedAt derivation.

### Code Review Findings

The phase went through a deep code review (`84-REVIEW.md`) that found 2 critical + 3 warning issues, most severely CR-01 — a pre-existing, un-touched-by-this-phase view-level write path (`ServiceEditorView.vue::bumpScheduledSongsLastUsed`) that silently re-stamped `serverTimestamp()` immediately after the correct recompute, defeating R247 in production through the only UI action users actually take. All 5 findings (CR-01, CR-02, WR-01, WR-02, WR-03) were fixed and independently verified in this pass:
- CR-01 (clobbering write path) — verified removed, with an explicit regression test.
- CR-02 (unguarded recompute failing the whole transition) — verified soft-failed via try/catch in both `markAsPlanned` and `reopenService`.
- WR-01 (dedup comment mismatch) — verified `songIdsInService` now dedupes with `[...new Set(ids)]`.
- WR-02 (NaN Timestamp on malformed service date) — verified explicit pre-filter + `malformedServices` summary field in the backfill.
- WR-03 (ambient-timezone parse) — verified `serviceDateToMillis` now uses `Date.UTC` identically on both sides.

### Human Verification Required

### 1. Owner-run production backfill (`--apply`)

**Test:** Run `cd functions && npm run build`, then `node functions/lib/backfillLastUsed.js --apply` locally with Admin credentials against the production Berean org (dry run first, review output, then `--apply`, per the standing confirm-then-deploy policy).
**Expected:** Every song with >=1 locked service is corrected to `MAX(locked service date)`; songs with no locked service (including songs in no service) are left completely untouched, preserving their Planning-Center-import dates.
**Why human:** Writes production Firestore data via Admin SDK (which bypasses security rules); explicitly scoped in both `84-CONTEXT.md` and `84-02-PLAN.md` as an owner-run, owner-confirmed step outside GSD execution/verification scope. The verifier must not and cannot run this.

### 2. Live UI end-to-end confirmation

**Test:** In the deployed/dev app, add a song to a draft service, click "Mark as Planned", and observe the song's last-used date in the UI (song list / suggestions view). Then reopen the service and re-observe.
**Expected:** The date shown matches the service's date immediately after locking (not today's date), and correctly falls back after reopen.
**Why human:** Visual/UX confirmation in a real browser + live Firestore round-trip is outside what static/unit-test evidence can certify — though the underlying logic is already fully proven at the store level by passing automated tests (see Observable Truths #1-5 above), a human click-through is the standard closing check for a reported UI-visible bug fix.

### Gaps Summary

No gaps. All 8 derived must-have truths are VERIFIED against the current codebase (not just SUMMARY claims): the canonical helper exists and is framework-free; the live store correctly gates on lock status and computes MAX; the critical CR-01 clobbering bug found by code review has been fixed and is covered by an explicit regression test verified to still pass; the backfill script is dry-run-safe, conservative, idempotent, and mirrors the live derivation byte-for-byte; and all gates (type-check x2, targeted suites, full app suite, full functions suite) are clean against the documented baseline with zero new failures. The two items below the fold are inherently human-only actions (a production data write, and a live-browser click-through) — the phase's code and tests are otherwise complete and correct.

---

_Verified: 2026-08-26T00:20:00Z_
_Verifier: Claude (gsd-verifier)_
