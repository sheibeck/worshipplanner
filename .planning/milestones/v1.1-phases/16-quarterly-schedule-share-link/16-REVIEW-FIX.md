---
phase: 16-quarterly-schedule-share-link
fixed_at: 2026-07-10T22:43:00Z
review_path: .planning/phases/16-quarterly-schedule-share-link/16-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-07-10T22:43:00Z
**Source review:** .planning/phases/16-quarterly-schedule-share-link/16-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (1 critical, 6 warnings, 1 info)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: `quarterShares` write rule has no ownership check — any signed-in user can overwrite another org's public share page

**Files modified:** `firestore.rules`, `src/stores/quarters.ts`, `src/rules.test.ts`
**Commit:** `b9a5907`
**Applied fix:** `finalizeAndShare` now stores the owning `orgId` on the `quarterShares` doc (the
actual write payload did not include it, unlike `shareTokens` — adapted the review's suggested
fix to match the real code). `firestore.rules` scopes `create` to `isOrgEditor(request.resource.data.orgId)`
and `update` to `isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId`
(also forbids reassigning a doc to a different org on update). Inverted the existing
`rules.test.ts` test that asserted an unaffiliated user's overwrite SUCCEEDED (which encoded the
vulnerability) to assert DENIED, and added positive/negative coverage for owning-org-editor,
different-org-editor, and orgId-reassignment cases.

### WR-01: `orgSlugs` create has no ownership check — slug squatting with an arbitrary `orgId`

**Files modified:** `firestore.rules`, `src/rules.test.ts`
**Commit:** `0daa61a`
**Applied fix:** `orgSlugs` create now requires `isOrgEditor(request.resource.data.orgId)`.
Updated the existing "allows a signed-in user to create an unclaimed orgSlugs doc" test to seed
org membership for the positive case, and added tests for an unaffiliated user and a different
org's editor both being denied.

### WR-02: R-12 cadence gate never limits a `fillin`-tier paired partner (n=0 → Infinity budget)

**Files modified:** `src/utils/scheduler.ts`, `src/utils/__tests__/scheduler.test.ts`
**Commit:** `62ac971`
**Applied fix:** `roleBudget` now returns `0` for `n<=0` instead of dividing by it, so the
`withinCadence` gate in `propagatePairing` never lets a fill-in-tier (or otherwise n<=0)
partner be proactively pulled in via pairing. Added a regression test using the drawer's exact
`n: 0` fillin shape (Tim/Casey scenario mirroring the existing Nolan/Tim R-12 test).

### WR-03: CSV `"1-in-0"` silently produces N=0, causing `Infinity` scheduler deficit scores

**Files modified:** `src/utils/volunteerCsv.ts`, `src/utils/__tests__/volunteerCsv.test.ts`
**Commit:** `1a7fce2`
**Applied fix:** `frequencyLabelToN`'s `"1-in-N"` branch now requires the parsed N to be `> 0`
before accepting it, falling back to the default-4 path otherwise — mirroring the bare-integer
branch's existing guard. `parseVolunteerCsvRow`'s `isKnownLabel` check was also updated so
`"1-in-0"` no longer suppresses the "Frequency unrecognized — defaulted" warning. Added tests for
both `frequencyLabelToN('1-in-0')` and the row-level warning.

### WR-04: Drawer's preset highlighting silently offers to downgrade a non-preset cadence to Monthly

**Files modified:** `src/components/AvailabilityDrawer.vue`, `src/components/__tests__/AvailabilityDrawer.test.ts`
**Commit:** `70877a5`
**Applied fix:** `activeRoleTierPresetKey` now returns a distinct `'custom'` state (instead of
falling back to `'monthly'`) when a regular-tier person's `n` doesn't match any of the three
canonical presets — no preset button is ever wrongly highlighted as active for it. The readout
text also now explicitly shows `"Custom (1-in-N)"` for this case. Added a regression test seeding
`n: 3` and asserting no preset button is active plus the custom readout text is shown.

### WR-05: Matrix view shows a factually wrong "No service dates" message when a name filter matches zero dates

**Files modified:** `src/components/QuarterShareMatrix.vue`, `src/views/QuarterShareView.vue`, `src/views/__tests__/QuarterShareView.test.ts`
**Commit:** `30fa19e`
**Applied fix:** `QuarterShareMatrix` now takes a `totalDateCount` prop (the raw/unfiltered
service-date count, passed from `QuarterShareView`) and an optional `activeNameFilter` prop.
"No service dates" is shown only when `totalDateCount === 0`; a filtered zero-match instead shows
`"No dates found for {name}"`. List view's own (intentionally different, per the plan's summary)
zero-match handling was left unchanged. Added a regression test hydrating `nameFilter` via
route query to a non-existent name and asserting the new message (not "No service dates") appears.

### WR-06: Empty-derived slug can partially fail `finalizeAndShare`, leaving inconsistent state

**Files modified:** `src/stores/quarters.ts`, `src/stores/__tests__/quarters.test.ts`
**Commit:** `af9beb6`
**Applied fix:** An empty `deriveSlug(...)` result now falls back to a generic `'org'` base
before calling `claimSlug` (still unique via its existing numeric-suffix retry loop), and the
entire slug-resolution + `quarterShares` write step is now wrapped in try/catch — any failure is
logged via `console.error` and swallowed rather than thrown, so the already-committed opaque
`shareTokens` write and `finalized` status are never masked by a downstream failure. Added two
regression tests: one for the empty-derived-slug fallback, one asserting `finalizeAndShare`
does not throw (and still returns the token) when the memorable-URL step fails.

### IN-01: `nToFrequencyLabel` is now dead code in production

**Files modified:** `src/utils/volunteerCsv.ts`, `src/utils/__tests__/volunteerCsv.test.ts`
**Commit:** `0326da4`
**Applied fix:** Removed the unused `nToFrequencyLabel` export and its test block/import
(verified no remaining references anywhere in `src/`).

## Skipped Issues

None — all findings were fixed.

## Verification

- `find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete` then `npx vue-tsc --build`: clean, no errors.
- `npx vitest run` (full suite): **688 tests passed** across 33 files.
- `npm run test:rules` (firestore rules emulator suite): **37 tests passed**, including all new
  CR-01/WR-01 ownership regression tests.

---

_Fixed: 2026-07-10T22:43:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
