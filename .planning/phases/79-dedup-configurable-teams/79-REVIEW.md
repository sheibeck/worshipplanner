---
phase: 79-dedup-configurable-teams
reviewed: 2026-08-24T03:24:08Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - src/types/team.ts
  - src/stores/teams.ts
  - src/stores/orgScopedStores.ts
  - src/components/TeamsConfigPanel.vue
  - src/views/RosterView.vue
  - src/components/NewServiceDialog.vue
  - src/views/ServiceEditorView.vue
  - src/views/ServicesView.vue
  - src/stores/__tests__/teams.test.ts
  - src/components/__tests__/TeamsConfigPanel.test.ts
  - src/components/__tests__/NewServiceDialog.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 79: Code Review Report

**Reviewed:** 2026-08-24T03:24:08Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Phase 79 diff (dedup + configurable teams: `Team` type/store, church-switch teardown
registration, `TeamsConfigPanel.vue`, `RosterView.vue`'s Teams tab, and the `NewServiceDialog`/
`ServiceEditorView`/`ServicesView` rewiring + ordinal removal + generic union tag-filter) against the six
focus areas in scope.

No Critical/BLOCKER-tier findings — no auth bypass, no cross-tenant data leak, no crash-causing null
deref. The seed idempotency guard, the union-tag-filter's empty-selection behavior, the
`resetOrgScopedStores()` registration, and the ordinal-removal in `NewServiceDialog.vue` are all
correctly implemented and match their documented intent.

The real risk in this phase is a **structural one the phase itself introduces**: teams are now
user-renameable and admin-defined, but every consuming surface (service checkboxes, the AI
song-tag filter, the `'Special'`-name coupling) still identifies a team by its **name string**, not
its Firestore doc ID, and neither the new store nor the new panel enforces name uniqueness. That
combination produces two provable defects below (WR-01, WR-02) that did not exist for the old
hard-coded 4-team list (where names were fixed and never edited). Two lower-severity issues
(WR-03, WR-04) round out the store/UI layer. All are Warning-tier — none causes data loss, but WR-01
and WR-02 can produce genuinely confusing, silently-broken UI state for an admin who edits their team
list, which is the entire point of this phase.

## Warnings

### WR-01: Duplicate team names are unprevented and break checkbox selection + AI-filter matching

**File:** `src/components/TeamsConfigPanel.vue:181-197` (add), `src/components/TeamsConfigPanel.vue:148-165` (rename)
**Issue:** Neither `onAddTeam()` nor `onSaveTeam()` checks the new/edited name against
`teamsStore.teams` for a collision before calling `addTeam`/`updateTeam`. Unlike Roles — where
`RolesConfigPanel.vue`/`RosterView.vue` key every consumer off `role.id` (`:value="role.id"`,
`src/views/RosterView.vue:119`) — Teams are consumed by **name** everywhere a service selects them:
- `src/components/NewServiceDialog.vue:86-89`: `<input type="checkbox" :value="team.name" v-model="form.teams">`
- `src/views/ServiceEditorView.vue` (post-f77bbeef): `:checked="localService.teams.includes(team.name)"` / `@change="toggleTeam(team.name)"`
- `src/views/ServiceEditorView.vue:3436-3444` (`filterSongsByTeamTags`): `teamsStore.teams.find((t) => t.name === name)`

If an admin creates (or renames into) two teams sharing one name, both of the resulting checkbox
rows are driven by the **same string** in the `v-model` array — checking/unchecking one visually
checks/unchecks both simultaneously (Vue's array-checkbox binding matches by value, not by row
identity), making the two teams impossible to select independently. Separately,
`filterSongsByTeamTags`'s `.find()` silently picks only the *first* team matching that name and
ignores the second team's `songFilterTag`, so the AI filter behaves inconsistently depending on
Firestore document ordering.
**Fix:** Validate name uniqueness (case-insensitive trim compare against `teamsStore.teams`,
excluding the row being edited) before calling `addTeam`/`updateTeam`, and surface an inline error
if it collides — mirroring the kind of guard `roster.ts` doesn't need only because Roles never
select by name.

### WR-02: Renaming a team silently orphans it from every service that already selected it, with no warning (unlike delete)

**File:** `src/components/TeamsConfigPanel.vue:148-165` (`onSaveTeam`)
**Issue:** CONTEXT.md's decision (`79-CONTEXT.md:42-43`) requires a **soft-warn confirmation** before
delete ("services may reference it"), but applies no equivalent warning to rename — even though
rename has the identical practical consequence for a name-keyed reference: a service whose
`teams: string[]` array already contains `'Choir'` continues to store that literal string forever
(`79-RESEARCH.md:263`: "existing `services.teams` docs... are NOT foreign keys... unaffected by the
new collection's existence"). If the team is renamed from `'Choir'` to `'Vocal Team'`, that
service's checkbox row for `'Choir'` simply disappears from the UI (no team in `teamsStore.teams`
has that name anymore) — the selection becomes an invisible, unremovable, unrenderable leftover on
that service doc, and any AI filter tag that was keyed to the old name via `filterSongsByTeamTags`
silently stops matching. `onSaveTeam` performs this rename with a single click and no confirmation
step at all (contrast with `onConfirmDelete`, which requires the two-step inline warning).
**Fix:** At minimum, warn on rename the same way delete does ("services that already selected
`'{{ oldName }}'` will no longer show it as checked"), or — better long-term — switch service
`teams` storage from name strings to team IDs so a rename never orphans the reference. The former is
the low-risk fix inside this phase's existing pattern; the latter is the correct fix but a larger
migration (flagged for awareness, not required to land now).

### WR-03: `seedDefaultTeamsIfEmpty()`/`addTeam()` have no protection against concurrent first-writer races across multiple clients

**File:** `src/stores/teams.ts:56-66`
**Issue:** The idempotency guard (`if (teams.value.length !== 0) return`) only protects a *single*
store instance's already-loaded snapshot. If two clients (e.g., two admins in two browser tabs, or
two devices) open a view that seeds teams (RosterView, ServiceEditorView, ServicesView) for the same
brand-new org at nearly the same moment, both will observe an empty first snapshot and both will
call `addDoc` four times, producing 8 duplicate team docs. This mirrors the pre-existing
`roster.ts`'s `seedDefaultRolesIfEmpty()` design (same race exists there too), so it is not a new
class of bug introduced by this phase, but it is new *surface area* for the same class, and the
phase's own doc comment ("first-writer-wins, never clobbers an org that already edited its list")
somewhat overstates the guarantee — it protects against re-seeding an *established* org, not against
a simultaneous-first-open race for a *brand-new* one.
**Fix:** Out of scope to fully fix here (would need a transaction or a sentinel "seeded" flag on the
org doc), but worth a one-line doc-comment correction so the guarantee isn't overstated, and/or a
follow-up ticket shared with the identical `roster.ts` risk.

### WR-04: `onAddTeam()` has no in-flight guard, unlike `onSaveTeam()`'s `savingTeamId` disable

**File:** `src/components/TeamsConfigPanel.vue:91`, `181-197`
**Issue:** The Add-Team button's `:disabled="!newTeamName.trim() && !teamAdded"` only disables on an
empty name; it does not disable while `onAddTeam()`'s `await teamsStore.addTeam(...)` is in flight
(compare `onSaveTeam`, which sets `savingTeamId.value` and disables via
`:disabled="savingTeamId === row.team.id"`). A fast double-click before the round-trip resolves calls
`addTeam` twice with the same name and the same `maxOrder + 1` (computed from the same pre-write
`teamsStore.teams` snapshot both times), creating two teams with identical `order` values — and,
combined with WR-01, two same-named teams whose checkboxes become inseparable. Additionally, once
`teamAdded.value` flips true after a successful add, the disabled expression
(`!newTeamName.trim() && !teamAdded` → `true && false` → `false`) makes the button clickable again
even though the name field was just cleared to `''` — a confusing but harmless dead-click state
(`onAddTeam` early-returns on empty name).
**Fix:** Add an `adding` ref (mirroring `savingTeamId`) and disable on `adding || !newTeamName.trim()`
for the duration of the request; simplify the `:disabled` expression to drop the `!teamAdded` clause
entirely, since it doesn't do what it appears to be doing.

## Info

### IN-01: `team.ts`'s "zero behavior change" doc comment overstates what the seed actually preserves

**File:** `src/types/team.ts:17-21`
**Issue:** The comment states "existing orgs (Berean) see zero behavior change on first load
post-deploy" — true for the *team-name list* shown in checkboxes, but the AI song-tag filter's
actual behavior **does** change: pre-Phase-79, any service with `'Orchestra'` selected always
constrained AI suggestions to `Orchestra`-tagged songs (hardcoded in
`src/views/ServiceEditorView.vue`, pre-`f694c3ee`); post-deploy, `DEFAULT_TEAMS` seeds `Orchestra`
with **no** `songFilterTag`, so `filterSongsByTeamTags` returns the unfiltered pool for every
service until an admin manually visits Volunteers → Teams and sets Orchestra's filter tag back to
`'Orchestra'`. This is a documented, deliberate product decision (`79-CONTEXT.md:93-95`: "seeding the
tag is optional and left to the admin"), not a bug — but the doc-comment's phrase "zero behavior
change" is misleading for a future reader who doesn't cross-reference CONTEXT.md, and no in-app
migration note/banner tells an admin this manual step exists.
**Fix:** Tighten the comment to scope "zero behavior change" to the team *list*, not the AI filter,
e.g.: "...so existing orgs see the same team names in the checkboxes; the Orchestra AI-filter
behavior is NOT auto-preserved — see CONTEXT.md, admin must re-set the tag manually if wanted."

### IN-02: Delete button text carries no per-row context for assistive tech

**File:** `src/components/TeamsConfigPanel.vue:37-41`
**Issue:** The per-row `<button>Delete</button>` has no `aria-label` distinguishing which team it
deletes (unlike the adjacent name input and song-tag select, which both correctly carry
`` `Team name for ${row.team.name}` ``-style labels per the CONTEXT.md "accessible from the start"
requirement). A screen-reader user tabbing through a multi-team list hears "Delete" repeated with no
row context. This mirrors `RolesConfigPanel.vue`'s identical pre-existing gap (not introduced by this
phase), but since CONTEXT.md specifically calls out that *this new panel* "ships accessible from the
start," the gap is worth closing here rather than perpetuating.
**Fix:** `:aria-label="`Delete ${row.team.name} team`"` on the button at line 40.

### IN-03: Stale `songFilterTag` can point at a tag no longer in `songStore.allUserTags`, producing a `<select>` with no matching visible `<option>`

**File:** `src/components/TeamsConfigPanel.vue:22-29`
**Issue:** If a team's `songFilterTag` was set to a tag that all songs have since lost (tag no longer
appears in `songStore.allUserTags`), the bound `<select v-model="row.draft.songFilterTag">` has no
`<option>` matching the current value — the browser will typically render it as blank/first-option
even though the underlying draft (and stored) value is still the stale tag string. Not a data-loss
bug (the value is preserved until the row is explicitly re-saved), but a confusing display
inconsistency an admin has no way to notice or clear without knowing to re-open the row.
**Fix:** Low priority; consider surfacing the raw stale value as an extra `<option>` (e.g.,
`<option v-if="row.draft.songFilterTag && !songStore.allUserTags.includes(row.draft.songFilterTag)" :value="row.draft.songFilterTag">{{ row.draft.songFilterTag }} (unused)</option>`) so the select never silently misrepresents state.

---

_Reviewed: 2026-08-24T03:24:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
