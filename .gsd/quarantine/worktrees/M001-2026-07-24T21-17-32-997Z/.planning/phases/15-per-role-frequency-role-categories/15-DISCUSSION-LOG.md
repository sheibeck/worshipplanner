# Phase 15: Per-Role Frequency & Role-Category Co-occurrence Rules - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 15-per-role-frequency-role-categories
**Areas discussed:** Per-role frequency UI, Tier reconciliation, Category & migration, Enforcement scope

---

## Per-role frequency UI

**Q: How should the per-role serve-frequency controls appear in the Edit Volunteer form?**

| Option | Description | Selected |
|--------|-------------|----------|
| One row per held role | Each checked role gets its own frequency dropdown inline | ✓ |
| Separate frequency section | Dedicated 'Frequency per role' block below the roles checkboxes | |

**Q: Default cadence for a role with none set?**

| Option | Description | Selected |
|--------|-------------|----------|
| Carry existing value | Copy single value to all roles; new roles use that baseline | |
| Default to weekly (N=1) | Every role starts weekly | |
| Default to monthly (N=4) | Roles start rarely-scheduled until leader opts up | ✓ |

**Q (clarified): One-time migration of EXISTING people's single cadence?**

| Option | Description | Selected |
|--------|-------------|----------|
| Carry old value forward | Copy existing cadence onto currently-held roles; new/blank roles default monthly | ✓ |
| Reset all to monthly | Discard old single value; all roles start monthly | |

**User's choice:** One row per held role; monthly (N=4) default for unset roles; existing people's cadence carried forward onto held roles on the one-time migration.
**Notes:** User initially asked what "migration" meant — clarified it's a one-time transform of existing Firestore data when the per-role schema ships. Confirmed carry-forward to avoid re-entering tuning done in Phases 13/14.

---

## Tier reconciliation

**Q: How should the per-quarter tier (regular/fill-in/out) relate to per-role cadence?**

| Option | Description | Selected |
|--------|-------------|----------|
| Per-role tier | Each held role gets its own regular/fill-in/out per quarter | ✓ |
| Keep tier per-person | One tier per person; per-role governs only standing cadence | |
| Hybrid | Person-level 'out' global; regular-vs-fill-in per role | |

**Q: Availability drawer layout for per-role tier?**

| Option | Description | Selected |
|--------|-------------|----------|
| One tier control per role | Each held role gets its own tier segmented control | ✓ |
| Per-role + 'Out entirely' shortcut | Per-role controls plus a top-level set-all-to-out toggle | |

**Q: Do blackout dates and pairings also split per-role?**

| Option | Description | Selected |
|--------|-------------|----------|
| Stay per-person | Blackout = unavailable any role that day; pairings person-to-person | ✓ |
| Split per-role too | Blackouts/pairings become per-role | |

**User's choice:** Per-role tier; one tier control per role in the drawer; blackouts + pairings stay per-person.
**Notes:** Matches the todo's "out for one role, regular for another" note.

---

## Category & migration

**Q: How should the new category relate to the existing Role.group field?**

| Option | Description | Selected |
|--------|-------------|----------|
| Replace group with category | Rename/extend field to category enum | |
| Add category alongside group | Keep group + separate category field | |

**User's choice (free-text):** "I think I meant group... just make a new group called vocals. We don't want categories and groups, just make a new group called vocals. I don't think it matters if we call them groups or categories." → **Extend existing `RoleGroup` to add `vocals`; no separate category concept.**

**Q: Classify existing roles into the four groups on migration?**

| Option | Description | Selected |
|--------|-------------|----------|
| Auto: group + vocals by name | band→band, tech→tech, other→other, seeded vocals role → vocals | ✓ |
| Prompt leader to classify each | Migration leaves group flagged for manual pick | |

**Q: Co-occurrence rules hardcoded or configurable?**

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded from categories | Fixed logic from group; leaders only assign group | ✓ |
| Configurable matrix | Expose matrix/caps in settings | |

**User's choice:** Add `vocals` as a fourth `group` value (no separate category); auto-classify existing roles with vocals split by name; rules hardcoded from group.
**Notes:** Terminology indifferent — kept the existing field name `group`.

---

## Enforcement scope

**Q: Where should the co-occurrence rules be enforced?**

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-propose + warn on manual | Proposal obeys rules; manual illegal edits allowed but flagged | ✓ |
| Auto-propose + hard-block manual | Grid refuses to save illegal manual assignment | |
| Auto-propose only | Manual edits unconstrained and unflagged | |

**Q: Cardinality caps per person per service?**

| Option | Description | Selected |
|--------|-------------|----------|
| 1 BAND, 1 VOCALS, OTHER unlimited | One instrument + one vocals; other uncapped | ✓ |
| 1 BAND only, VOCALS/OTHER unlimited | Only instruments capped | |
| 1 of each non-tech category | Max 1 BAND, 1 VOCALS, 1 OTHER | |

**User's choice:** Auto-propose obeys strictly; manual grid edits allowed but warned; caps = 1 BAND + 1 VOCALS, OTHER unlimited; TECH exclusive.
**Notes:** Keeps the leader in control rather than hard-blocking legitimate exceptions.

---

## Claude's Discretion

- Exact persistence shape for the per-role frequency map (D-04) and per-role tier (D-05).
- Whether co-occurrence is an extra `eligible()` predicate vs. a separate post-pick guard in the scheduler.
- Rendering of the manual-grid warning (reuse existing conflict/unfilled flag pattern).
- Research item: how `propagatePairing` interacts with same-person multi-role slots under the new caps.

## Deferred Ideas

- Configurable co-occurrence matrix / cardinality caps (hardcoded this phase).
- Per-role blackout dates / pairings (kept per-person this phase).
- Structured conditional pairing rules (still Phase 14 quarter-note territory).
