# Phase 75: Pending-Invite Visibility - Context

**Gathered:** 2026-08-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous smart-discuss — defaults chosen per the standing v2.1 grant; low-risk phase, no grey area warranted a stop)

<domain>
## Phase Boundary

Extend v2.0's existing super-admin `listOrganizations` callable + the Organizations tab list so each church
row distinguishes **active** members (people who have logged in) from **pending** invitees (onboarded/
assigned by email but never logged in). Purely additive visibility — no change to onboarding, invites, or
the invite→first-login claim flow. Requirements R222, R223.

</domain>

<decisions>
## Implementation Decisions

### Data model (what "active" vs "pending" means)
- **Active** = documents under `organizations/{orgId}/members` (a member doc exists only after login/claim).
- **Pending** = documents under `organizations/{orgId}/invites` (written by onboard/assignOrgAdmin's invite
  branch; deleted on first-login claim by `ensureUserDocument`). So a live invite doc == a not-yet-logged-in
  invitee.
- Both counts are computed **server-side** with Firestore `count()` aggregates, exactly like the existing
  `memberCount` — no per-doc reads, no new client cross-org reads (R223).

### Server contract (`listOrganizations`)
- Extend `OrgSummary` with `pendingCount: number` alongside the existing `memberCount` (which stays the
  ACTIVE member count). Add one `count()` aggregate over the `invites` subcollection per org, in the same
  `Promise.all` that already computes `memberCount`.
- No new callable; no rules change. Ships built + tested + UNDEPLOYED with
  `firebase deploy --only functions:listOrganizations` handed to the owner.

### Display (Organizations tab, Members column)
- Show the active count as today; when `pendingCount > 0`, append a compact muted badge, e.g.
  `3 · 1 pending` (active `text-gray-200`, pending as a small `amber`/`gray` pill), so an org with only an
  unclaimed admin reads `0 · 1 pending`, never a bare `0`.
- Keep it inside the existing Members cell — no new column — matching ConfigurationTab's dark idiom.
- An org with 0 active and 0 pending still reads `0` (genuinely empty).

### Claude's Discretion
- Exact badge wording/color and whether pending is a suffix vs a separate pill — pick what reads cleanest
  against the existing table; keep it accessible (not color-only — include the word "pending").

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/orgProvisioning.ts` — `listOrganizationsHandler` (lines ~387-408) already maps every org
  and computes `memberCount` via a `members` `count()` aggregate in `Promise.all`; `OrgSummary` type at
  ~369. Extend both here.
- `functions/src/orgProvisioning.test.ts` — existing `listOrganizationsHandler` tests (N-orgs + empty) to
  extend with a pending-count case.
- `src/components/admin/OrganizationsTab.vue` — the list table (Members cell at ~line 55 area); client
  `OrgSummary`-shaped interface (~line 126-129) to extend with `pendingCount`.
- `src/components/admin/__tests__/OrganizationsTab.test.ts` — `makeOrg` fixture (extend with pendingCount)
  + list-render tests.

### Established Patterns
- Super-admin-gated callable re-verifies caller (`assertSuperAdminCaller`); client is a pure `httpsCallable`
  consumer (no Firestore writes/reads for org data). Firestore `count()` aggregates already used for
  `memberCount`.

### Integration Points
- Server: `listOrganizations` return shape. Client: the Organizations tab Members cell + the client
  `OrgSummary` interface + `makeOrg` test fixture.

</code_context>

<specifics>
## Specific Ideas

Owner's words: an onboarded-but-unclaimed admin should read as "pending login," not a confusing "0 members"
— so the super-admin can see whether an invited admin has claimed their login yet.

</specifics>

<deferred>
## Deferred Ideas

- Listing the actual pending email addresses / a per-org invite drill-down, resend-invite, or revoke-invite
  — visibility only this phase; management is future scope.

</deferred>
