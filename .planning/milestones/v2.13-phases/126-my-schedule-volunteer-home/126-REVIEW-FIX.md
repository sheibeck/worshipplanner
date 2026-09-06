---
phase: 126-my-schedule-volunteer-home
fixed_at: 2026-09-06T08:46:03Z
review_path: .planning/phases/126-my-schedule-volunteer-home/126-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 126: Code Review Fix Report

**Fixed at:** 2026-09-06T08:46:03Z
**Source review:** .planning/phases/126-my-schedule-volunteer-home/126-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (4 Warnings + 4 Info, per the fix directive covering all 4 Warnings plus
  the 4 "safe" Info items — see Note on ID numbering below)
- Fixed: 8
- Skipped: 0

**Note on finding-ID numbering:** the fix directive's Info-item numbering (IN-01/IN-03/IN-04) was
off-by-one from 126-REVIEW.md's actual numbering for three of the four Info items. Matched by
*content*, not label, since the directive's descriptions unambiguously identify each finding:

| Directive said | REVIEW.md's actual ID | Content |
|---|---|---|
| IN-01 (swallowed fetch error) | IN-01 | `loadMySchedule` swallows error, no logging |
| IN-03 (silent song-drop) | **IN-02** | song slot referencing missing catalog song dropped silently |
| IN-04 (low-contrast readiness color) | **IN-03** | `partial`/`waiting` amber shades indistinguishable |
| IN-02 (redundant type intersection, skip-if-trivial) | **IN-04** | `MyScheduleDoc`'s `orgId` intersection |

All four were fixed regardless of numbering (the redundant-intersection one was trivial, so it was
applied per the directive's "apply if quick" clause rather than skipped).

## Fixed Issues

### WR-01: `reopenService`'s rehearseAccess revoke had no retry/reconciliation

**Files modified:** `src/stores/services.ts`
**Commit:** `f39266d3`
**Applied fix:** Extracted a shared `revokeRehearseAccessWithRetry()` helper used by both
`reopenService` and `deleteService` (the review flagged `deleteService`'s projection revocation for
the same audit — it had the identical swallow-with-console.error pattern). The delete is now
attempted, and on failure retried exactly once before falling back to a clearly-logged best-effort
miss. Deliberately still non-throwing — the primary action (status transition / service delete) has
already committed and must not be rolled back or reported as failed over a projection-cleanup miss,
matching the existing `markAsPlanned`/lastUsedAt-recompute convention elsewhere in this file. A
durable, client-independent reconciliation (Cloud Function sweep keyed off parent status) remains
the real fix per the review and is out of scope for this pass — noted in a code comment pointing
back to WR-01.
**Verification:** `npm run type-check` clean; `services.test.ts` 112/112 pass (including the
existing CR-02 "still resolves" tests for both functions).

### WR-02: No positive rules test for the nested `rehearseAccess` list arm's `isOrgMember` path

**Files modified:** `src/rules.test.ts`
**Commit:** `f480564f`
**Applied fix:** Added test `(9b)` — seeds an ordinary member (no `superAdmin` claim) and asserts
`getDocs(collection(db, 'organizations', orgA, 'rehearseAccess'))` succeeds, mirroring the existing
`(9)` `getDoc` positive-control test and `(8)`'s volunteer-denied `list` test. Ran against the
already-up Firestore emulator: **the call does NOT throw** — `isOrgMember(orgId)` succeeds cleanly
in this nested (non-collection-group) `list` context, unlike the top-level collection-group arm's
documented throw for the same call shape. No rule change was needed; this closes the test-coverage
gap the review identified so a future regression (e.g. an admin "who's assigned" screen) would be
caught.
**Verification:** `npx vitest run --config vitest.rules.config.ts` — 233/233 pass, 35 skipped
(storage.rules.test.ts, environment-dependent, no Storage emulator running). New test `(9b)` passes.
No DENY case weakened; all existing R377/R378 cases stay green.

### WR-03: Past-only-assignments volunteer sees an effectively empty page

**Files modified:** `src/views/MyScheduleView.vue`, `src/views/__tests__/MyScheduleView.test.ts`
**Commit:** `1ce0536b` (committed together with WR-04 — see note below)
**Applied fix:** `summaryLine` now returns an explicit `"No upcoming services — see your past
services below."` line when `totalUpcoming === 0 && groups.past.length > 0`, instead of `''`. Chose
this over the review's other suggested option (defaulting `showPast` to `true`) because an existing
test (`'reveals the past section on toggle...'`) asserts the past section stays collapsed until
explicitly toggled — the explicit-line approach fixes the "looks broken" UX gap without changing
that documented default-collapsed contract. Added test:
`'WR-03: shows an explicit "no upcoming services" line...'`.
**Verification:** `npm run type-check` clean; `MyScheduleView.test.ts` 11/11 pass (8 existing + 3
new, including the WR-04 tests below).

### WR-04: User-chip menu has no outside-click/Escape dismissal

**Files modified:** `src/views/MyScheduleView.vue`, `src/views/__tests__/MyScheduleView.test.ts`
**Commit:** `1ce0536b` (committed together with WR-03)
**Applied fix:** Mirrored the codebase's existing `SlideActionMenu.vue` convention (ADR-0110) rather
than introducing a new document-level listener or a VueUse dependency: a `fixed inset-0` overlay
sibling closes the menu on click, and a `watch` on `menuOpen` moves focus to the first `menuitem`
when it opens so the panel's own `@keydown.esc` actually receives the Escape key (matching
`SlideActionMenu`'s own focus-management pattern — otherwise focus stays on the trigger button, a
panel sibling, and the keydown event never reaches the panel). Added two tests: outside-click
dismissal and Escape dismissal.
**Verification:** same run as WR-03 above (same file/commit) — 11/11 pass.

**Why WR-03 and WR-04 share one commit:** both fixes land in the same computed/script region of
`MyScheduleView.vue` (adjacent hunks around `summaryLine`/the new `watch`), so a surgical per-finding
split would require staging an artificial intermediate diff. Documented in the commit body.

### IN-01: `loadMySchedule` swallows the underlying error with no logging

**Files modified:** `src/stores/mySchedule.ts`
**Commit:** `bad2ca04`
**Applied fix:** Added `console.error('loadMySchedule failed', err)` in the catch block, matching
the `markAsPlanned`/`reopenService` convention in `services.ts`.
**Verification:** `npm run type-check` clean; `mySchedule.test.ts` 6/6 pass (console.error now
visibly fires in the "rejected getDocs" test's stderr, as expected).

### IN-02 (review's numbering): song slot referencing a deleted/missing catalog song dropped silently

**Files modified:** `src/utils/rehearseAccess.ts`, `src/utils/rehearseAccess.test.ts`
**Commit:** `065f6c63`
**Applied fix:** Instead of filtering the slot out entirely (understating the song count), a missing
catalog song now produces a stub `RehearseSong` (`title: '(song removed)'`, `id: <stale songId>`,
no attachments) and a `console.warn` naming the service and missing song id, so a leader
investigating a volunteer's "wrong song count" report has something to search for. Added test
verifying both the stub shape and that the count matches the actual slot count (2 slots, 1 missing
→ 2 songs returned, not 1).
**Verification:** `npm run type-check` clean; `rehearseAccess.test.ts` 12/12 pass; re-ran
`services.test.ts` (112/112) and `mySchedule.test.ts`/`myScheduleGrouping.test.ts` since they also
exercise `buildRehearseAccess` — all green (the new `console.warn` fires harmlessly in a few
existing `services.test.ts` fixtures that reference song ids without seeding them into the song
store, which is expected test-fixture behavior, not a regression).

### IN-03 (review's numbering): `readinessColorClass`'s "partial"/"waiting" colors are nearly indistinguishable

**Files modified:** `src/components/ScheduleServiceCard.vue`
**Commit:** `b82c7bd4`
**Applied fix:** `waiting` now maps to `text-gray-400` (neutral — "nothing uploaded yet" isn't a
warning) instead of `text-amber-300`, which was one shade off `partial`'s `text-amber-400` and
effectively indistinguishable by color. No `ScheduleServiceCard` unit test file exists yet, so
nothing to update there; verified via `MyScheduleView.test.ts` (renders the card) still passing.
**Verification:** `npm run type-check` clean; `MyScheduleView.test.ts` 11/11 pass.

### IN-04 (review's numbering): redundant type intersection in `MyScheduleDoc`

**Files modified:** `src/stores/mySchedule.ts`
**Commit:** `44cb29fe`
**Applied fix:** Applied per the directive's "apply if quick" clause (this was labeled "IN-02, skip
if trivial" in the directive, matched here by content — see numbering note above). Added a short
inline comment clarifying the intersection is a deliberate type-level no-op; the real `orgId`
override happens at the `{ ...data, orgId: ... }` spread call site, not in the type. Did not remove
the field from the type (the review's other option) to avoid changing the type's self-documenting
shape for future readers.
**Verification:** `npm run type-check` clean; `mySchedule.test.ts` 6/6 pass (comment-only change to
a type declaration).

## Skipped Issues

None — all 8 in-scope findings were fixed.

## Verification Summary (full run, after all 8 commits)

- `npx vitest run --config vitest.rules.config.ts` (Firestore emulator already running on :8080,
  matching CLAUDE.md's documented "port taken" fallback): **233/233 pass, 35 skipped**
  (`storage.rules.test.ts` — no Storage emulator running, the documented environment-dependent
  baseline failure). New WR-02 test `(9b)` passes; no existing R377/R378 case changed outcome; no
  DENY case weakened.
- `npm run type-check` (`vue-tsc --build`, the mandated gate per CLAUDE.md — not the narrower
  `-p tsconfig.app.json` form): **clean**, after every commit and again after all 8.
- `npm run build`: **green** (`✓ built in 26.64s`; the "chunks larger than 500kB" notice is
  pre-existing and unrelated to this phase).
- `npx vitest run` (full app suite) for touched files, run individually after each fix:
  `services.test.ts` 112/112, `rules.test.ts` (Firestore portion) covered above,
  `MyScheduleView.test.ts` 11/11 (8 existing + 3 new), `mySchedule.test.ts` 6/6,
  `rehearseAccess.test.ts` 12/12, `myScheduleGrouping.test.ts` 15/15 — all pass.
- `npx vitest run` (**whole repo**, final confirmation after all 8 commits): **201/202 test files
  pass, 5316/5351 tests pass (35 skipped)**. The single failing file is `src/storage.rules.test.ts`
  — `TypeError: fetch failed` / `ECONNREFUSED 127.0.0.1:9199`, because no Storage emulator was
  running in this environment (only Firestore, on :8080). This is exactly the documented baseline in
  this project's `CLAUDE.md` ("A bare `npx vitest run` should show exactly one failing file"). No new
  failures introduced by this fix pass.

## Environment notes (worktree setup, not phase-specific)

This run executed in an isolated git worktree (per this agent's mandatory isolation protocol) at
`/tmp/sv-126-reviewfix-KOiZ2x` off a temp branch `gsd-reviewfix/126-218530`, fast-forwarded onto
`master` on completion. `.env.local` and `node_modules` (root, `functions/`, `render-service/`) were
copied/junction-linked into the worktree since git worktrees don't share either — both are called
out as worktree setup requirements in this project's `CLAUDE.md`.

---

_Fixed: 2026-09-06T08:46:03Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
