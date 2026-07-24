---
phase: 16-quarterly-schedule-share-link
reviewed: 2026-07-10T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - firestore.rules
  - src/components/AvailabilityDrawer.vue
  - src/components/AvailabilityRosterTable.vue
  - src/components/CollapsibleSection.vue
  - src/components/QuarterGrid.vue
  - src/components/QuarterShareMatrix.vue
  - src/components/VolunteerCsvImportModal.vue
  - src/components/useIsMobile.ts
  - src/router/index.ts
  - src/stores/quarters.ts
  - src/stores/roster.ts
  - src/types/roster.ts
  - src/utils/planningCenterApi.ts
  - src/utils/scheduler.ts
  - src/utils/slug.ts
  - src/utils/volunteerCsv.ts
  - src/views/QuarterShareView.vue
  - src/views/QuarterView.vue
  - src/views/RosterView.vue
  - src/views/SettingsView.vue
findings:
  critical: 1
  warning: 6
  info: 1
  total: 8
status: fixed
fixed_at: 2026-07-10T22:43:00Z
fixed_summary:
  fixed: 8
  skipped: 0
  fix_status: all_fixed
---

# Phase 16: Code Review Report

## Fix Summary (2026-07-10)

All 8 findings (1 critical, 6 warnings, 1 info) were fixed, each in its own atomic commit.
Full test suite (688 tests across 33 files) and the firestore rules emulator suite (37 tests)
pass; `npx vue-tsc --build` is clean.

| Finding | Commit | Status |
|---|---|---|
| CR-01 | `b9a5907` | fixed |
| WR-01 | `0daa61a` | fixed |
| WR-02 | `62ac971` | fixed |
| WR-03 | `1a7fce2` | fixed |
| WR-04 | `70877a5` | fixed |
| WR-05 | `30fa19e` | fixed |
| WR-06 | `af9beb6` | fixed |
| IN-01 | `0326da4` | fixed |

See `16-REVIEW-FIX.md` for full details on each fix.

**Reviewed:** 2026-07-10
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found (all fixed — see Fix Summary above)

## Summary

Reviewed the full phase-16 file set: the public share matrix/route/name-filter, the memorable-URL
slug claim flow, the R-12 cadence-gated pairing fix, the roleFrequency consolidation, and the
Schedule/Roster UX redesign (collapsible sections, slide-out group editor, add-quarter modal).

The public **read** path is sound: `QuarterShareView.vue`/`QuarterShareMatrix.vue` derive
everything from the fetched `shareTokens`/`quarterShares` snapshot, never touch `rosterStore` or
`quartersStore`, and the snapshot itself carries names only (no email/phone), matching D-24.

The **write** path for the two new public collections has a real access-control gap: `firestore.rules`
gates `quarterShares` create/update on `isSignedIn()` alone, with no check that the writer belongs to
the org that owns the target doc. Any authenticated user of *any* org can overwrite *another* org's
public, already-published schedule snapshot — this is a genuine cross-tenant vulnerability, and the
project's own `src/rules.test.ts` inadvertently proves it (the "allows a signed-in user to update... an
existing quarterShares doc" test uses an unaffiliated user with no membership in the seeded org and it
passes). `orgSlugs` create has the same missing-ownership pattern, one level less severe (create-once,
no PII, but enables slug-squatting with an attacker-chosen `orgId`).

On the scheduler side, the R-12 cadence-budget gate is correct for the canonical regular-tier
Nolan/Tim scenario, but it silently breaks down for a `fillin`-tier partner: the UI's own "As-needed
(fill-in)" preset writes `n: 0`, and `roleBudget = Math.ceil(serviceDates.length / 0) = Infinity`,
which means the cadence gate can never exclude a fill-in-tier partner — exactly the bug this plan
was meant to fix, just for one tier the test suite never actually exercises with the real UI-produced
value (the existing fillin fixtures in `scheduler.test.ts` all use `n: 1`, not the `n: 0` the drawer
writes).

A parallel gap exists in the CSV frequency parser (`"1-in-0"` is silently accepted as N=0, producing
`Infinity` deficit scores in the main scheduling loop), and the drawer's own preset-highlighting logic
misrepresents any non-preset N value as "Monthly," risking a silent, unintended cadence downgrade.

## Critical Issues

### CR-01: `quarterShares` write rule has no ownership check — any signed-in user can overwrite another org's public share page

**File:** `firestore.rules:92-98`
**Issue:** The rule is:
```
match /quarterShares/{shareId} {
  allow read: if true;
  allow create, update: if isSignedIn();
  allow delete: if false;
}
```
There is no check that the writer is a member/editor of the org that owns `shareId` (or that
`request.resource.data` even references an org the caller belongs to). Since `shareId` is the
guessable, deterministic string `${slug}__q${N}-${year}` (slugs are derived from public org names by
design, per this phase's own accepted tradeoff), **any authenticated user of any organization** can
`setDoc` arbitrary content — including a full replacement of `quarterSnapshot.calendar`/`roles`/
`serviceDates` — into another org's already-published, publicly-readable share page. This is a
cross-tenant integrity/spoofing vulnerability: an attacker with a throwaway signed-in account (no org
membership required at all, since `isSignedIn()` is the only gate) can deface or fabricate the public
schedule of a church they have no relationship with.

This is not hypothetical — `src/rules.test.ts:199-209`'s own "allows a signed-in user to update
(overwrite-in-place) an existing quarterShares doc" test uses `userA` with **no membership seeded for
any org** and asserts the overwrite **succeeds**, which is the exact behavior described above. The
phase's own `16-RESEARCH.md` (Open Question 2) explicitly flagged this as an unresolved question
("Should `orgSlugs`/`quarterShares` security rules be `isOrgEditor`-scoped instead of
`isSignedIn()`-only?") that was never actually confirmed with the user before shipping.

**Fix:** Store the owning `orgId` on the `quarterShares` doc (it already exists in the write payload
in `quarters.ts::finalizeAndShare`) and scope create/update to org editors of that org:
```
match /quarterShares/{shareId} {
  allow read: if true;
  allow create: if isSignedIn() && isOrgEditor(request.resource.data.orgId);
  allow update: if isSignedIn() && isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
  allow delete: if false;
}
```
(`isOrgEditor` is already defined at the top of `firestore.rules`.)

## Warnings

### WR-01: `orgSlugs` create has no ownership check — slug squatting with an arbitrary `orgId`

**File:** `firestore.rules:84-90`; `src/utils/slug.ts:42-62`
**Issue:** `allow create: if isSignedIn();` lets any authenticated user claim `orgSlugs/{candidate}`
with any `orgId` value in the payload — not necessarily an org they belong to. Because the doc is
create-once (`update, delete: if false`), a malicious or careless client can permanently squat every
desirable slug (pointed at a bogus or victim `orgId`), forcing legitimate orgs into numeric-suffixed
fallback slugs (`grace-2`, `grace-3`, …) with no recourse. Lower severity than CR-01 (no existing data
is overwritten and no PII is exposed), but it is the same missing-authorization pattern.
**Fix:** Require `request.resource.data.orgId` to match an org the caller is an editor of:
`allow create: if isOrgEditor(request.resource.data.orgId);`

### WR-02: R-12 cadence gate never limits a `fillin`-tier paired partner (n=0 → Infinity budget)

**File:** `src/utils/scheduler.ts:96-99, 184-199`
**Issue:** `roleBudget(personId, roleId) = Math.ceil(serviceDates.length / roleFrequencyOf(personId, roleId).n)`.
`AvailabilityDrawer.vue`'s `FREQ_PRESETS` writes `{ tier: 'fillin', n: 0 }` for the "As-needed
(fill-in)" preset (`src/components/AvailabilityDrawer.vue:278`). A `fillin`-tier partner passes the
`notOutTier` filter (fillin !== 'out'), so `propagatePairing` reaches `roleBudget`, which evaluates to
`Math.ceil(x / 0) === Infinity`. The subsequent `withinCadence` filter
(`getServedByRole(...) < roleBudget(...)`) is therefore always true for that role, so a fill-in-tier
partner is pulled onto **every** occurrence the anchor serves — the exact "partner inflated past their
own cadence" bug R-12 was written to fix, just for `tier: 'fillin'` instead of `tier: 'regular'`.
This is untested: `scheduler.test.ts`'s existing fillin fixtures (`freq('guitar', 'fillin', 1)`,
lines 241/263) all use `n: 1`, never the `n: 0` the real UI produces, so the gap is invisible to the
current suite.
**Fix:** Special-case `n === 0` (fillin/out) in `roleBudget` — e.g. treat it as budget `0` (never
proactively pull a fill-in partner in via pairing propagation) rather than dividing by it, and add a
regression test using the drawer's actual `n: 0` fillin shape.

### WR-03: CSV `"1-in-0"` silently produces N=0, causing `Infinity` scheduler deficit scores

**File:** `src/utils/volunteerCsv.ts:41-59` (specifically the `oneInNMatch` branch, lines 53-56)
**Issue:** `frequencyLabelToN`'s bare-integer branch explicitly requires `bareInt > 0`, but the
`"1-in-N"` branch has no equivalent guard:
```js
const oneInNMatch = normalized.match(/^1-in-(\d+)$/)
if (oneInNMatch) {
  return Number(oneInNMatch[1])   // "1-in-0" -> 0, no validation
}
```
A CSV `Frequency` cell of `"1-in-0"` is matched by `isKnownLabel`'s own `/^1-in-\d+$/i` check (so no
"unrecognized" warning is surfaced) and is committed as `roleFrequency[roleId] = { tier: 'regular',
n: 0 }` via `VolunteerCsvImportModal.vue`'s `onCommit`. In `scheduler.ts`'s main assignment loop, the
per-candidate deficit score is `(dateIndex + 1) / n - servedByRole`, which becomes `Infinity` for
`n === 0`, making that person a guaranteed top-priority pick for every date/role regardless of
fairness, blackout-adjacent scoring, or actual availability intent. Not covered by
`volunteerCsv.test.ts` (only `"1-in-6"` is tested).
**Fix:** Require `Number(oneInNMatch[1]) > 0` before accepting the parsed value, falling back to the
same default-4 path (and warning) as an invalid bare integer.

### WR-04: Drawer's preset highlighting silently offers to downgrade a non-preset cadence to Monthly

**File:** `src/components/AvailabilityDrawer.vue:387-393`
**Issue:**
```js
function activeRoleTierPresetKey(roleId: string): FreqPresetKey {
  const entry = draft.roleFrequency[roleId] ?? { tier: 'regular' as FrequencyTier, n: 4 }
  if (entry.tier === 'fillin') return 'fillin'
  if (entry.tier === 'out') return 'out'
  const preset = FREQ_PRESETS.find((p) => p.tier === 'regular' && p.n === entry.n)
  return preset?.key ?? 'monthly'   // any non-{1,2,4} n falls back to "monthly"
}
```
Any `regular`-tier person with a non-canonical `n` (very plausible — CSV Frequency values like `"3"`
or `"1-in-6"` are valid, supported inputs per `frequencyLabelToN`) is displayed with the **"Monthly"**
preset button highlighted as active, even though the true cadence differs. The readout text below
(`roleFreqReadout`) correctly reflects the real `n`, so the UI shows two inconsistent signals
side-by-side. Worse, because "Monthly" already renders as selected, an editor who clicks it (believing
it's a no-op / confirming the current setting) silently overwrites the person's real cadence with
`n: 4`, with no warning that a change occurred.
**Fix:** Add an explicit "Custom (1-in-N)" display state (or otherwise visually indicate no preset
matches) instead of defaulting to `'monthly'`, so clicking a preset is never a no-op-looking data
change.

### WR-05: Matrix view shows a factually wrong "No service dates" message when a name filter matches zero dates

**File:** `src/components/QuarterShareMatrix.vue:29`; `src/views/QuarterShareView.vue:90-95, 113-115`
**Issue:** `QuarterShareMatrix` receives the already-name-filtered `dates` prop and shows
`<p v-if="dates.length === 0">No service dates</p>`. When a viewer selects a name filter that matches
zero dates, `filteredDates` (passed as `dates`) is `[]`, so the matrix incorrectly displays "No service
dates" even though the quarter plainly has service dates — the name filter just excluded all of them.
The list view (the sibling branch in the same component) uses a different, correctly-scoped condition
(`quarterSnapshot.serviceDates.length === 0`, the raw/unfiltered count) for the same situation and
instead renders nothing at all. The two views give inconsistent, and in the matrix's case incorrect,
feedback for the identical zero-match state — this was called out in the plan's own summary as a
deliberate decision for the list view, but the matrix component's independent zero-length check was
not covered by that decision.
**Fix:** Distinguish "no service dates at all" from "name filter matched zero dates" — e.g. pass an
explicit `noMatches` flag (or the raw total date count) into `QuarterShareMatrix` so it can render "No
service dates" only when the quarter is genuinely empty, and something like "No dates found for
{name}" when a filter is active but empty.

### WR-06: Empty-derived slug can partially fail `finalizeAndShare`, leaving inconsistent state

**File:** `src/utils/slug.ts:42-62`; `src/stores/quarters.ts:400-425`
**Issue:** `deriveSlug('')` (or a name with no `[a-z0-9]` characters after lowercasing, e.g. a
non-Latin-script church name, or an org doc missing/blank `name`) returns `''`. `claimSlug('', orgId)`
then attempts `setDoc(doc(db, 'orgSlugs', ''), { orgId })` — Firestore's client SDK rejects an empty
document-ID path with a synchronous, non-`permission-denied` error, which `claimSlug`'s catch block
re-throws (`if (code === 'permission-denied') { retry } else { throw err }`). By the time this runs
inside `finalizeAndShare`, the function has **already** written `shareTokens/{token}` and marked the
quarter `status: 'finalized'` with a live `shareToken` (lines 386-398, executed before the slug
resolution block). The thrown error then propagates to `QuarterView.vue::onFinalizeAndShare`'s
`catch`, which shows "Failed to finalize and share" — but the opaque share link and finalized status
are already committed. The user sees a hard failure for an operation that mostly succeeded, and no
`quarterShares`/memorable-URL doc is ever created for that org until the org name is fixed.
**Fix:** Guard against an empty derived slug before calling `claimSlug` (e.g. fall back to a
generated/random short slug, or skip the memorable-URL write with a soft-fail instead of throwing), and
don't let a slug-claim failure mask the fact that the opaque-token finalize already succeeded.

## Info

### IN-01: `nToFrequencyLabel` is now dead code in production

**File:** `src/utils/volunteerCsv.ts:65-70`
**Issue:** `nToFrequencyLabel` is exported but, after this phase's removal of the standing-frequency
UI from `RosterView.vue` (16-06) and the rewrite of `AvailabilityDrawer.vue` to its own hardcoded
`FREQ_PRESETS` labels (16-04/16-05), it is no longer called from any production code path — the only
remaining reference is its own test file (`src/utils/__tests__/volunteerCsv.test.ts`).
**Fix:** Remove the function (and its test block) or, if it's intentionally being kept for a
near-future consumer, add a comment noting it's currently unused so a future cleanup pass doesn't
have to re-derive that fact.

---

_Reviewed: 2026-07-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
