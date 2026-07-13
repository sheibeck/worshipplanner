---
type: design-change
status: dismissed
needs_planning: false
created: 2026-07-08
resolved: 2026-07-13
resolution: "Superseded/satisfied by Phase 15 (Per-Role Frequency & Role-Category Co-occurrence Rules), which is Complete. Project owner confirmed 2026-07-13 that the current per-role frequency + vocals/instrument implementation is sufficient. No further work planned."
source: user-request (during phase 14 execution)
area: scheduling model — src/types/roster.ts, src/utils/scheduler.ts, availability editor UI
supersedes_partially: Phase 14 Plan 14-01 (per-person frequencyTier/frequency)
---

# Per-role scheduling frequency + vocals/instrument same-day pairing exception

**Request (two linked changes):**

1. **Schedule frequency BY ROLE, independently.** Some people fill multiple
   roles and should have an independent cadence per role (e.g. Guitar weekly,
   Vocals monthly). Phase 14 modeled frequency per-person; this moves it to
   per-(person, role).
   - Concrete UI target: the RosterView **Edit Volunteer** form/drawer currently
     has ONE "Serve frequency" `<select>` bound to `Person.frequencyTargetN`.
     That single field must become a per-role frequency control (one cadence per
     role the person holds). The `Person.frequencyTargetN` field itself becomes a
     per-role map (or a `roleFrequencies` structure) — schema + migration change.
   - Also revisit Phase 14's per-person quarter `frequencyTier`
     (regular/fillin/out): likely needs to become per-role too, or be reconciled
     with per-role cadence, since a person could be 'out' for one role but
     'regular' for another.

2. **Same-service role co-occurrence rules (category-based).** A person may hold
   more than one role on the same service, governed by role CATEGORY so we are
   not tied to specific role names within a group. Categories:
   **TECH**, **BAND** (instruments), **VOCALS**, **OTHER**.

   Vocals split into its own category (was lumped with band) so the canonical
   "1 instrument + vocals" combo is expressed purely by category.

   **TECH is a fully exclusive responsibility:** if a person is on a TECH role
   for a service, they do ONLY tech that service — TECH cannot combine with BAND,
   VOCALS, or OTHER. Among the non-tech categories, combinations are allowed:

   | Combination on same service | Allowed? |
   |-----------------------------|----------|
   | TECH + anything (BAND / VOCALS / OTHER) | NO — TECH is exclusive |
   | BAND + VOCALS (1 instrument + vocals) | YES — the common case |
   | BAND + OTHER | YES |
   | VOCALS + OTHER | YES |
   | BAND + VOCALS + OTHER | YES |

   Cardinality: **max 1 BAND (instrument) role per person per service** ("you can
   always be assigned to 1 instrument, and vocals"); presumably max 1 VOCALS too.

   Reduced rule: **TECH is exclusive (tech-only that service). Among non-tech
   categories (BAND, VOCALS, OTHER) all combine freely, capped at one instrument
   per service.** The scheduler's blanket one-slot-per-person/service check is
   replaced by this category-aware exclusivity + cardinality check.

**Open design questions (for discuss-phase):**
- Data model: per-role frequency — `frequencyTargetN` / `frequencyTier` become a
  map keyed by roleId? How does this interact with existing per-person quarter data?
- Role categories: does `Role` gain a `category: 'tech' | 'band' | 'vocals' | 'other'`
  field? How are existing roles classified/migrated? Is the co-occurrence matrix
  hardcoded from categories or configurable?
- Scheduler: replace the one-slot-per-person/service check with a category
  exclusivity + cardinality check (TECH exclusive; non-tech BAND/VOCALS/OTHER
  combine freely; max 1 instrument/service). How does pairing (Plan 14-01/14-03
  bidirectional pairedWith) interact with same-person multi-role slots?
- Migration: existing per-person frequency data → per-role; classify existing
  roles into tech/band/vocals/other.

**Status:** Significant scheduling-model change. Route through /gsd:discuss-phase
+ /gsd:plan-phase as its own phase AFTER Phase 14 completes. Do NOT retrofit into
phase 14 execution.
