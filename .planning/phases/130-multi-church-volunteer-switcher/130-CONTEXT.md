# Phase 130: Multi-Church Volunteer Switcher - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss); enriched with the owner's settled decisions + a live-UAT addition.

<domain>
## Phase Boundary

A volunteer serving at more than one church can switch/filter My Schedule (and the volunteer service view
context) by church, each labeled by name; a single-church volunteer sees an unchanged, switcher-free
experience. Requirements: R403, R404, R405. Builds on shipped v2.12 `rehearseAccess` / My Schedule.
</domain>

<decisions>
## Implementation Decisions (owner-settled — honor these)

- **`orgName` on the projection:** add `orgName` to the `rehearseAccess` projection so a zero-membership
  volunteer can label churches WITHOUT reading `organizations/{orgId}` (which membership rules forbid).
  Add it in `src/utils/rehearseAccess.ts` `buildRehearseAccess` (+ its `RehearseAccessDoc` type), and
  ensure it's written by BOTH write paths that call it: `markAsPlanned` and `resyncRehearseAccessForSong`
  (src/stores/services.ts). `buildRehearseAccess` currently receives `orgId` but not the org name — pass
  the org name through from the caller (authStore.orgName at write time).
  - **Existing-doc caveat (like the readiness resync):** already-Planned services' `rehearseAccess` docs
    won't have `orgName` until re-projected (re-lock, or a song-file change triggers the resync). My
    Schedule must DEGRADE GRACEFULLY when `orgName` is absent (fall back to a neutral label, never crash).
    Flag a possible one-time backfill for the batched UAT.
- **My Schedule church switcher/filter (R403/R404/R405):** the `mySchedule` store already aggregates the
  volunteer's `rehearseAccess` docs across every church (collectionGroup by email). Derive the DISTINCT
  churches (orgId → orgName) from those docs. Add a volunteer-local `selectedChurch` filter (default: all,
  or the only church). Show the switcher/filter ONLY when the volunteer has >1 distinct church (R405: a
  single-church volunteer sees no switcher — unchanged). It is a FILTER over already-loaded docs, NOT a
  data-scope switch — it is DISTINCT from AppSidebar's admin membership switcher and MUST NEVER call
  `selectOrg` / touch `authStore` org context (volunteers have zero memberships).
- **Selected church carries into the volunteer service view (R404):** when a volunteer opens a service from
  a filtered My Schedule, the church context (name) is consistent.
- **Volunteer sidebar church-name label (LIVE-UAT ADDITION, owner 2026-09-06):** when signed in as a
  volunteer (zero membership — only the "My Schedule" nav item shows), the church name must appear in the
  AppSidebar org-name slot, JUST LIKE it does for an admin (AppSidebar.vue:16-27 shows `authStore.orgName`).
  For a volunteer that slot is currently empty (no membership → no `orgName`). Source it from the
  volunteer's `mySchedule` context: the SELECTED church (multi) or the ONLY church (single). Must not
  disturb the admin path (which keeps using `authStore.orgName`).
</decisions>

<code_context>
## Existing Code Insights (plan-phase research will deepen)

- Projection: `src/utils/rehearseAccess.ts` `buildRehearseAccess` + `RehearseAccessDoc` type (add `orgName`).
- Write paths: `src/stores/services.ts` `markAsPlanned` (~L610 buildRehearseAccess call) and
  `resyncRehearseAccessForSong` (the Phase-shipped resync) — both must pass the org name.
- Store: `src/stores/mySchedule.ts` (aggregates rehearseAccess docs; add distinct-church derivation +
  selectedChurch filter). Docs carry `orgId`; add `orgName`.
- View: `src/views/MyScheduleView.vue` (add the switcher/filter UI, gated on >1 church) + the grouping in
  `src/utils/myScheduleGrouping.ts` if the filter interacts with grouping.
- Volunteer service view context: `src/composables/useVolunteerServiceDoc.ts` / `src/views/VolunteerServiceView.vue`.
- Sidebar: `src/components/AppSidebar.vue` (the org-name block ~L16-27) — show the volunteer's church name
  there for a zero-membership session, sourced from mySchedule, without disturbing the admin `authStore.orgName` path.
- Admin membership switcher (the DISTINCT precedent NOT to reuse for volunteers): AppSidebar.vue `hasSwitcher`
  / church-switcher panel — volunteers must NOT use `selectOrg`.
</code_context>

<specifics>
## Specific Ideas
- The switcher is a client-side FILTER over the aggregated `mySchedule.docs`, not a re-subscribe.
- Single church (0 or 1 distinct org) → no switcher, no behavior change (R405).
- Graceful fallback label when `orgName` is missing on an older projection doc (e.g. "Your church" or the
  service's own context) — never blank/crash.
- Persist the volunteer's selected church for the session (e.g. localStorage) is optional/nice-to-have.
</specifics>

<deferred>
## Deferred Ideas
- One-time backfill of `orgName` onto existing `rehearseAccess` docs (surface for batched UAT; not required
  for the feature to work on newly-locked/re-synced services).
</deferred>
