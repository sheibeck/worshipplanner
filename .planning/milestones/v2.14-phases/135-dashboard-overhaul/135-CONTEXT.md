# Phase 135: Dashboard Overhaul - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grounded in a codebase scan + the milestone research (dashboard = "needs your attention" feed). Depends on Phase 133 (confirmations) + Phase 134 (presence), both shipped.

<domain>
## Phase Boundary

Replace the current dashboard's undefined "Volunteer coverage" metric with an actionable "needs your
attention" feed. Requirements: R414 (remove Volunteer coverage), R415 (upcoming-services list), R416
(per-service readiness signal — REUSE the v2.12 computation), R417 (unconfirmed-volunteers widget — uses
Phase 133 confirmations), R418 (editor-presence roll-up — uses Phase 134 presence), R419 (empty/first-run
state). Editor-facing dashboard at route `/` (`src/views/DashboardView.vue`).
</domain>

<decisions>
## Implementation Decisions

### R414 — Remove "Volunteer coverage"
- Delete the "Volunteer coverage" section in `DashboardView.vue` (the "Active volunteers" count + per-role
  volunteer-count list + "Every role has at least 2 volunteers" line, ~lines 92-127). It's the undefined
  BI-style metric the milestone explicitly rejects. Keep the useful parts (Next service, Song library) and
  reframe around the "needs your attention" feed.

### R415 — Upcoming-services list (the feed)
- Keep/evolve the existing "Next service" + `upcomingAfterNext` list into the primary "needs your
  attention" feed: upcoming services, soonest first, each a row/card. Editors land here (route `/`).

### R416 — Per-service readiness signal (REUSE, don't reinvent)
- **REUSE `readinessOf()` from `@/utils/myScheduleGrouping`** (states: `ready` / `partial` {missingCount} /
  waiting) — the exact v2.12 My Schedule media-readiness computation (ScheduleServiceCard uses it). Do NOT
  invent a second media-readiness definition.
- The dashboard readiness signal COMBINES: (a) `readinessOf` media state (charts/tracks per song), (b) the
  existing song-assignment stat (`serviceSongStats` filled/total — roles/songs filled), and (c) Draft vs
  Planned/locked lock state. Present as a compact per-service readiness indicator (e.g. a dot/label:
  ready / N songs missing media / songs still needed / draft). **Rollup rule (research-flagged decision,
  now pinned):** surface the WORST-of the sub-signals rather than an all-or-nothing single boolean — a
  service is "ready" only when songs are assigned AND media is ready AND (as relevant) it's Planned; otherwise
  show the most actionable gap. Keep it a signal, not a gate.

### R417 — Unconfirmed-volunteers widget (uses Phase 133)
- A widget listing who hasn't yet confirmed their assignment for upcoming services, reading the Phase 133
  `services/{id}/confirmations` subcollection + the `roleAssignmentsByEmailLower` projection. Bounded fan-out:
  only the next N upcoming (Planned) services (e.g. ≤6, same window as the feed). An assignment with no
  confirmation doc (or `needsReconfirmation`) counts as unconfirmed. Links to the service. This is the hard
  dependency that required Phase 133 to land first.

### R418 — Editor-presence roll-up (uses Phase 134)
- A roll-up of who is currently editing what, reusing the Phase 134 `services/{id}/presence` data +
  `isPresenceStale`/`useServicePresence` primitives (client soft-TTL staleness applies — don't show stale
  editors). Bounded to the org's active/upcoming services. Read-only aggregation; do NOT write presence from
  the dashboard (the dashboard viewer isn't "editing" a specific service). Reuse the presence read shape from
  134 (kept reusable per 134's deferred note).

### R419 — Empty / first-run state
- A clear empty state when there's nothing needing attention (no upcoming services, nothing unconfirmed, no
  one editing) — a friendly "you're all caught up" / first-run pointer, not a blank page.

### Layout
- Reframe DashboardView as a "needs your attention" feed: the upcoming-services feed (with readiness) as the
  spine, plus the unconfirmed-volunteers and editor-presence widgets as attention cards, and Song library
  kept as a secondary card. Match the app's dark gray-950 card language. Editor-only (route already gates to
  editors).

### Claude's Discretion
- Exact card ordering/layout, the readiness indicator's visual treatment, and how many upcoming services the
  feed + fan-out reads cover (≤6 is the working default).
- Whether the presence roll-up and unconfirmed widgets are always shown or conditionally (hide when empty vs
  show an empty sub-state).
</decisions>

<code_context>
## Existing Code Insights (verified landmarks)

### Reusable Assets
- `src/views/DashboardView.vue` — the dashboard to overhaul (route `/`, name `dashboard`, editor-only). Has
  `upcomingServices`/`nextService`/`upcomingAfterNext`, `serviceSongStats(service)`, `isServiceReady(s)`, and
  the "Volunteer coverage" section to remove (~lines 92-127).
- `readinessOf()` + `countdownLabel()` in `src/utils/myScheduleGrouping.ts` — the v2.12 readiness computation
  to REUSE for R416 (over `RehearseSong[]`-shaped song+attachment data).
- Phase 133: `src/utils/confirmations.ts` (`ConfirmationDoc`, `confirmationKey`, statuses) + the
  `roleAssignmentsByEmailLower` rehearseAccess projection — for R417.
- Phase 134: `src/utils/presence.ts` (`PresenceDoc`, `isPresenceStale`) + `useServicePresence` — for R418.

### Integration Points
- DashboardView template + script; bounded fan-out reads of confirmations/presence subcollections for the
  upcoming-services window.
</code_context>

<specifics>
## Specific Ideas

Reuse over reinvent: `readinessOf` (media), the existing song-assignment stats, Phase 133 confirmations, and
Phase 134 presence primitives. The dashboard AGGREGATES existing data into a "needs your attention" feed — it
introduces no new data model. Keep fan-out reads bounded (≤6 upcoming services) — this is a cost-hardened
Blaze app.
</specifics>

<deferred>
## Deferred Ideas

Generic BI / analytics widgets (attendance trends, engagement charts), customizable/drag-drop widget layout —
explicitly OUT (milestone backlog). The dashboard is a needs-attention feed, not a BI surface.
</deferred>
