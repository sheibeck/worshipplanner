# Phase 79: Dedup & Configurable Teams - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas auto-accepted from the v2.2 standing grant + research; no interactive Q&A per owner grant)

<domain>
## Phase Boundary

Replace the hard-coded, Berean-specific team rules with per-org configuration that drives every
service-planning surface showing teams. In scope: a per-org team list (add/rename/remove) editable in
Settings; the service-plan team checkboxes (new-service dialog + service editor) driven by that list; an
optional per-team song-tag filter generalizing the hard-coded "Orchestra → Orchestra-tagged" rule; removal
of the ordinal-Sunday auto-team-selection rule; and collapsing the still-duplicated team-list / Orchestra
constants to a single source (R228, R229, R230, R231, R241).

OUT of scope this phase: PC-export team names (`DEFAULT_PC_TEAM_NAMES`) — SEED-002 bucket A3, deferred;
`VW_TYPE_LABELS` de-dup — already single-source, must NOT be touched.
</domain>

<decisions>
## Implementation Decisions

### Team data model & storage
- Store teams as an `organizations/{orgId}/teams` **subcollection**, mirroring the existing `roles`
  subcollection exactly (per research + grant). Needs **NO firestore.rules change** — it falls through the
  generic per-org wildcard the same way `roles` does today.
- Team doc shape: `{ name: string, order: number, songFilterTag?: string }` (+ any timestamps the roles
  pattern uses). `songFilterTag` optional.
- Seed defaults idempotently via a `seedDefaultTeamsIfEmpty()` that mirrors `roster.ts`'s
  `seedDefaultRolesIfEmpty()` (first-writer-wins, no double-seed race).
- Seed value = the current `['Choir','Orchestra','Communion','Special']` so **Berean's existing behavior is
  unchanged** and new orgs get a sensible starter set they can edit.

### Editor UX (Settings)
- Copy `RolesConfigPanel.vue`'s shape exactly: seeded defaults, per-row local drafts with an explicit **Save**
  (not autosave), inline (not modal) delete-confirmation carrying consequence text, and an Add-row affordance
  at the bottom. Do not invent a second pattern.
- The new Teams editor ships **accessible from the start** (real `<label>`/`aria-label`, not placeholder-only)
  — the broader Owner Console a11y retrofit remains Phase 81 (R239), but a newly-authored panel should not add
  to that debt.
- Deleting a team currently referenced by services → **soft-warn** (a confirmation noting services may
  reference it), NOT a hard block. A live in-use count is deferred (future enhancement).

### Per-team song-tag filter (generalizes Orchestra rule)
- Each team optionally carries a single `songFilterTag`. When a service selects a team that has a filter tag,
  AI song suggestions are constrained to songs carrying that tag — the exact generalization of the old
  Orchestra rule.
- The tag field offers existing song tags (type-ahead/select over the org's known song tags); empty = no
  filter (default), so a church that configures nothing keeps the full pool.
- When multiple selected teams each carry a filter tag, restrict to songs matching **any** of those tags
  (union / OR) — least-surprising, keeps the pool from collapsing to empty. (The legacy single-Orchestra case
  is preserved exactly: one filtered team → that one tag.)

### Consuming surfaces, de-dup & ordinal removal
- A single shared source (a Pinia teams store / composable, mirroring `useRosterStore`) replaces the
  duplicated `AVAILABLE_TEAMS` array in BOTH `ServiceEditorView.vue:1675` and `NewServiceDialog.vue:145`.
- The Orchestra filter — duplicated twice within `ServiceEditorView.vue` (`:3426`, `:3537`) — is replaced by
  one generic per-team-tag filter helper reading team config. (R241 de-dup is a prerequisite for R228–R231.)
- The ordinal-Sunday auto-team pre-selection (`NewServiceDialog.vue` `defaultForm` ~:170 and the date-change
  watcher ~:190) is **removed**; a new service starts with **no teams pre-selected** and the planner picks
  them manually (R231 — no default auto-selection, per grant).

### Claude's Discretion
- Exact team doc field names/timestamps, store file layout, and the Settings panel's placement (standalone
  panel vs. beside the Roles panel) — follow the roster-roles precedent; either placement is acceptable.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/roster.ts` — `DEFAULT_ROLES`, `seedDefaultRolesIfEmpty()`, per-org subcollection CRUD: the
  direct template for a `teams` store/subcollection.
- `src/components/RolesConfigPanel.vue` — the editable-list UX to copy (drafts + explicit Save + inline
  delete-confirm + Add-row).
- `src/types/song.ts` — `VW_TYPE_LABELS` is ALREADY single-source (do not re-dedup — research confirmed the
  seed's "6+ files" claim is stale).

### Established Patterns
- Per-org subcollections fall through the generic `firestore.rules` per-org wildcard (no rule per collection).
- Settings-page panels bind a local draft and commit on explicit Save.

### Integration Points
- `ServiceEditorView.vue` (`AVAILABLE_TEAMS` :1675; Orchestra filter :3426/:3537) and
  `NewServiceDialog.vue` (`availableTeams` :145; ordinal rule :170/:190) are the consumers to rewire.
- Settings page gains the Teams editor panel.
</code_context>

<specifics>
## Specific Ideas

- Preserve Berean's current behavior byte-for-byte via the seed defaults (existing 4 teams; Orchestra tag
  filter reproducible by setting Orchestra's `songFilterTag = 'Orchestra'` if desired — but seeding the tag is
  optional and left to the admin, since the generalized mechanism replaces the hard-coded coupling).
- Full per-rule catalog + verdicts: `seeds/SEED-002-church-specific-rules-configurability.md`.
</specifics>

<deferred>
## Deferred Ideas

- `DEFAULT_PC_TEAM_NAMES` (PC-export team preselection) → SEED-002 A3, future milestone.
- Live "in use by N services" count on team delete → future enhancement (soft-warn only this phase).
- Configurable VW category labels / ServiceSection list / PC service-times → SEED-002 future requirements.
</deferred>
