---
phase: 75-pending-invite-visibility
verified: 2026-08-22T15:40:00Z
status: human_needed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "In a real browser against the live dark theme, view the Organizations tab and confirm the amber 'N pending' pill renders legibly against `bg-gray-900`/`border-gray-800`, and that an org whose only admin was onboarded-but-never-logged-in visually reads as '0 · 1 pending' rather than a bare, ambiguous '0'."
    expected: "The pending pill is visually distinct, readable in the dark theme, and the word 'pending' is present (not color-only) exactly as unit-tested."
    why_human: "Visual/contrast rendering in a real browser cannot be verified by grep or unit tests (jsdom does not render actual pixel contrast/legibility)."
  - test: "Owner runs the hand-over deploy command `firebase deploy --only functions:listOrganizations`, then opens the Organizations tab in production and confirms a real onboarded-but-unclaimed admin's org shows as pending."
    expected: "Deploy succeeds; the production `listOrganizations` callable returns `pendingCount` computed from live `invites` docs; the affected org visibly shows the pending badge in production."
    why_human: "Deploying to production and confirming against real production Firestore data requires owner-gated cloud access this verifier does not have. Per plan/SUMMARY, the callable ships built + tested + UNDEPLOYED by design (DEPLOY = HAND OVER)."
---

# Phase 75: Pending-Invite Visibility Verification Report

**Phase Goal:** The Organizations list shows which of a church's people have actually logged in versus are
still invited-but-pending, so an onboarded-but-unclaimed admin reads as "1 pending," never a confusing
"0 members."
**Verified:** 2026-08-22T15:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each org row's Members cell shows an active-member count separate from a "pending login" count/badge (R222, SC1) | VERIFIED | `src/components/admin/OrganizationsTab.vue` L57-64: Members `<td>` renders `{{ org.memberCount }}` followed by a `v-if="org.pendingCount > 0"` `<span>` reading `{{ org.pendingCount }} pending`. Test suite: `OrganizationsTab.test.ts` 23/23 passing, including new case "renders an accessible 'N pending' badge when pendingCount > 0". |
| 2 | An org whose only admin was onboarded by email but never logged in shows as pending, not a bare "0" (R222, SC2) | VERIFIED | `OrganizationsTab.test.ts` new case "shows '0' active plus '1 pending' for an onboarded-but-unclaimed admin" (mount `makeOrg({ memberCount: 0, pendingCount: 1 })`, asserts text contains both "0" and "1 pending") — confirmed passing in this run (23/23 green). Regression guard case "renders no 'pending' text for a genuinely empty org (0 active, 0 pending)" also passing, so the badge only appears when actually pending. |
| 3 | Active-vs-pending computed SERVER-SIDE in the existing super-admin-gated `listOrganizations` callable via `count()` aggregates, with NO new client cross-org Firestore read (R223, SC3) | VERIFIED | `functions/src/orgProvisioning.ts` L397-412: `listOrganizationsHandler`'s per-org `Promise.all` mapper runs `orgDoc.ref.collection("members").count().get()` and `orgDoc.ref.collection("invites").count().get()` concurrently via an inner `Promise.all`, mapping to `memberCount`/`pendingCount`. Confirmed no new callable was added (still `assertSuperAdminCaller` gate, unchanged). Confirmed client has zero Firestore imports: `grep '^import'` on `OrganizationsTab.vue` shows only `vue`, `firebase/functions` (`httpsCallable`), and `@/firebase` (`functions` instance) — no `firebase/firestore` import, no `collection`/`getDocs`/`onSnapshot` call anywhere in the file (only a code-comment match for "firestore write"). `functions/src/orgProvisioning.test.ts`: 30/30 passing, including new cases for varying per-org pendingCount and the explicit `pendingCount: 0` default. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/orgProvisioning.ts` | `OrgSummary.pendingCount` field + invites `count()` aggregate in `listOrganizationsHandler` | VERIFIED | `OrgSummary` interface (L369-375) carries `pendingCount: number` directly after `memberCount`; handler (L390-415) computes both aggregates concurrently and returns `pendingCount: invitesCountSnap.data().count` (explicit, never omitted). |
| `src/components/admin/OrganizationsTab.vue` | client `OrgSummary.pendingCount` field + Members-cell pending badge | VERIFIED | Client `OrgSummary` interface (L134-140) mirrors the server shape with `pendingCount: number`; Members `<td>` (L57-64) renders the conditional amber pill. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `listOrganizationsHandler` per-org mapper | `invites.count().get()` aggregate | direct Admin-SDK call inside `Promise.all` | WIRED | L401: `orgDoc.ref.collection("invites").count().get()`, fired alongside `members` count in the same `Promise.all` (not serialized). |
| aggregate result | `OrgSummary.pendingCount` | mapped field | WIRED | L409: `pendingCount: invitesCountSnap.data().count`. |
| `ListOrganizationsResponse` | client `httpsCallable('listOrganizations')` result | unchanged callable wrapper `onCall(listOrganizationsHandler)` | WIRED | No new callable; response shape widened by one field, consumed as-is by the existing client call site. |
| client `OrgSummary` | Members `<td>` badge render | template binding `org.pendingCount` | WIRED | L57-64 template renders `org.pendingCount` directly from the fetched list. |

### Behavioral Spot-Checks / Test Gates

| Gate | Command | Result | Status |
|------|---------|--------|--------|
| Functions unit tests (targeted) | `cd functions && npx vitest run src/orgProvisioning.test.ts` | 30/30 passed | PASS |
| Functions unit tests (full suite) | `cd functions && npx vitest run` | 14/14 files, 488/488 tests passed | PASS |
| Client component tests (targeted) | `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` | 23/23 passed | PASS |
| App suite (full) | `npx vitest run` | 133/135 files passed; 3993/4009 tests passed. 2 failing files exactly match the documented pre-existing baseline: `src/storage.rules.test.ts` (Storage-emulator `firestore.exists()` cross-service limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). No new failures attributable to this phase. | PASS (no regression) |
| Type-check | `npm run type-check` (`vue-tsc --build`) | Clean, exit 0, no output | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R222 | 75-01-PLAN.md | Organizations list distinguishes active vs pending per org | SATISFIED | Truths 1-2 above; badge + tests. |
| R223 | 75-01-PLAN.md | Active-vs-pending computed server-side, no new client cross-org read | SATISFIED | Truth 3 above; code trace + import check. |

No orphaned requirements found for Phase 75 in REQUIREMENTS.md (R222, R223 both mapped and covered by 75-01-PLAN.md's `requirements` field).

### Anti-Patterns Found

None. Scanned both modified source files (`functions/src/orgProvisioning.ts`, `src/components/admin/OrganizationsTab.vue`) for `TODO|FIXME|XXX|TBD|HACK|PLACEHOLDER` and "not yet implemented"/"coming soon" phrasing — no matches (the only `placeholder=` hits are ordinary HTML input placeholder attributes, unrelated to stub markers).

### Human Verification Required

### 1. Visual/contrast confirmation of the pending badge in a live browser

**Test:** Open the Organizations tab in a real browser against the deployed dark theme and view an org row with a live invite.
**Expected:** The amber "N pending" pill is legible against `bg-gray-900`/`border-gray-800`, and the onboarded-but-unclaimed-admin case visually reads as "0 · 1 pending," not a bare "0."
**Why human:** jsdom-based unit tests confirm the text and conditional rendering logic but cannot confirm real-browser visual contrast/legibility.

### 2. Owner-gated production deploy + real-data confirmation

**Test:** Owner runs `firebase deploy --only functions:listOrganizations`, then loads the production Organizations tab and confirms a real onboarded-but-unclaimed admin's org shows as pending.
**Expected:** Deploy succeeds; production callable returns live `pendingCount`; the affected org visibly shows "N pending" in production.
**Why human:** This phase intentionally ships built + tested + UNDEPLOYED (deploy is a hand-over step requiring owner cloud credentials/authorization this verifier does not have). Per ROADMAP.md's carried-forward deploy policy, human verification against production is deferred to end-of-milestone routing (`PENDING-VERIFICATION.md`).

### Gaps Summary

No code-level gaps found. All three ROADMAP success criteria (SC1-SC3) and both requirements (R222, R223) are verified directly against current source: `OrgSummary.pendingCount` is computed server-side via a concurrent `invites` `count()` aggregate alongside the existing `memberCount` aggregate inside the unchanged, super-admin-gated `listOrganizations` callable; the client introduces no new Firestore import/read and consumes the widened response purely via the existing `httpsCallable`; the Members-cell badge renders the required "N pending" text conditionally, verified by 3 new passing unit tests including the onboarded-but-unclaimed-admin scenario. Type-check is clean and the full test suites (functions: 488/488; app: 133/135 files, matching the pre-existing documented 2-file baseline exactly) show no regressions.

The only open items are the two human-only checks (real-browser visual confirmation, and the owner-gated production deploy + live-data confirmation), which this phase's own success criteria explicitly deferred to the owner as a hand-over step (`firebase deploy --only functions:listOrganizations`). Per the standing v2.1 grant, these are recorded as `human_needed`, not treated as gaps.

---

*Verified: 2026-08-22T15:40:00Z*
*Verifier: Claude (gsd-verifier)*
