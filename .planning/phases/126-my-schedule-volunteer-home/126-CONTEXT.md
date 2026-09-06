# Phase 126: My Schedule — Volunteer Home - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous smart-discuss; owner authorized `/gsd-autonomous`)

<domain>
## Phase Boundary

Build **"My Schedule"** — the volunteer home a magic-link volunteer lands on after sign-in (Phase 125). A
read-and-go page that lists every **Planned (locked)** service the volunteer is **assigned to**
(roster-email → assignment match), soonest first, grouped **This week / Later this month** (plus past
services), each card showing the volunteer's roles, media readiness, counts, countdown/call time, and a
**Rehearse →** action into the standalone service view (built in Phase 127). Consumes Phase 125's
`rehearseAccess` scoped-read projection + volunteer session; does NOT build the Rehearse/Order/Stage view
itself (that is Phase 127). Read-only — no editing.
</domain>

<decisions>
## Implementation Decisions

### Data source & assignment matching (R378, R379)
- My Schedule is powered by the **Phase 125 `rehearseAccess` projection**, not by live org-scoped reads.
  Query `rehearseAccess` for docs whose `assignedEmailsLower` array-contains the volunteer's lowercased,
  **verified** email (the CR-01 `email_verified` rule arm governs read access). Because the projection is
  written only at lock time (`markAsPlanned`) and deleted on reopen/delete, **"Planned-only" is automatic**
  — draft services simply have no projection doc, so R379 is satisfied structurally.
- This requires a Firestore composite index: `rehearseAccess` `array-contains` on `assignedEmailsLower`
  plus `orderBy` service date. (Phase 125 RESEARCH flagged this index as the Phase 126 need.) Add it to
  `firestore.indexes.json` and note deploy in the owner steps.
- If the projection lacks a field My Schedule needs (service name, date, time, venue, per-song
  chart/track counts, the volunteer's own roles, call time), **extend `buildRehearseAccess`** (Phase 125's
  builder) to denormalize it — keep the projection PII-safe (no free-text notes/slot bodies), mirroring
  `buildServiceSnapshot`. Prefer extending the existing projection over adding new reads.

### Layout, grouping & ordering (R380)
- Soonest-first. Group upcoming into **This week / Later this month**; show **past** services the volunteer
  served in a separate section (openable, CTA "Open"/read rather than "Rehearse"). A **"Next up"** badge on
  the single soonest upcoming service.
- Match the owner's Volunteer Home mock (Turn 14): a "Good morning, {name}" header + a summary line
  ("You're assigned to N upcoming services · next one is …"), a date block (Mon / big day / weekday) per
  card, and a footer note explaining the list is roster-built.

### Card content (R381)
- Each card: date, service name, time · venue, the volunteer's own **role chips** (with instrument icons —
  reuse the v2.7 band-role instrument iconography), **song / chart / track counts**, a **readiness**
  indicator, and a **countdown + call time**.
- **Readiness** is derived from the projection's per-song attachment presence vs song count: all songs have
  media → "All rehearsal files ready"; some missing → "N songs still missing media"; none/charts pending →
  "Waiting on charts from the leader". (Design's three states.)

### Navigation into Rehearse (R382)
- Each upcoming card's **Rehearse →** action navigates to the standalone volunteer service view route that
  **Phase 127** registers (e.g. `/volunteer/service/:serviceId` or `/rehearse/:serviceId`). Past cards use
  an "Open" affordance to the same view.
- **Build-safety (125 lesson):** do NOT add a lazy `import()` to a Phase-127 component that does not exist
  yet — that breaks `vite build`. Acceptable options (planner's choice): (a) a `<router-link>`/push to the
  future route *by path* (a click before Phase 127 lands 404s gracefully — documented 126→127 seam), or
  (b) a minimal placeholder route/view in 126 that Phase 127 replaces. My Schedule itself is not editable.

### Empty state & different-email (R383)
- A "check a different email" affordance (sign out + retry with another address), and, when the signed-in
  email matches no assignment, an empty state explaining the list is built from roster assignments and how
  to be added (ask the worship leader) — per the mock's footer.

### Claude's Discretion
- Exact route path, component split, the projection-field additions, and the index shape are the planner's
  choice within the constraints above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 125:** `rehearseAccess` projection + `buildRehearseAccess` (`src/utils/rehearseAccess.ts`), the
  `firestore.rules` `rehearseAccess` read arm (verified-email + Planned), `volunteerAuth` store, the
  `/volunteer` route + `isVolunteerRoute` meta, `VolunteerLinkCompleteView`/`VolunteerSignInView`.
- **Design language:** the app's dark gray-950 Tailwind system; v2.7 stage-layout band-role instrument
  icons + person "Name - Role" model (reuse for role chips); existing card/list patterns.
- **Date/time:** existing service date formatting + org-timezone handling (v1.7 messaging added org tz);
  the `teamMatchesDate`/service-date helpers.
- **Precedent for a read-only, snapshot-fed public-ish page:** `ShareView.vue`.

### Established Patterns
- Pinia store + `onSnapshot`/`getDocs` scoped queries; `firestore.indexes.json` for composite indexes.
- Volunteer surface is fully separate from the planner app shell (Phase 125 routing).

### Integration Points
- New My Schedule route/view under the volunteer surface; a volunteer-scoped query on `rehearseAccess`;
  possibly an extended `buildRehearseAccess` + a new composite index; the Rehearse CTA → Phase 127 route.

## ⚠ Baseline test note (CLAUDE.md)
- Type gate `npm run type-check`; app suite `npx vitest run` (1 known-failing baseline `storage.rules.test.ts`);
  rules suite `npm run test:rules`. `.env.local` present. Any new composite index must be added to
  `firestore.indexes.json`.
</code_context>

<specifics>
## Specific Ideas
- Design reference: the owner's Claude Design `Volunteer Home.dc.html` (Turn 14) — grouped assignment list,
  date blocks, role chips, readiness, countdown/call-time, "Next up" badge, Rehearse → CTA, roster-built
  footer note. Nocturne palette → mapped to app dark gray-950 (UI-SPEC will produce app-fidelity mocks).
</specifics>

<deferred>
## Deferred Ideas
- The Rehearse/Order-of-Service/Stage-Layout service view itself → Phase 127.
- Calendar sync / per-volunteer annotations → backlog (Future Requirements).
</deferred>
