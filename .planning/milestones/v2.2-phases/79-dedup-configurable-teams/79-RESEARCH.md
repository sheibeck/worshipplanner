# Phase 79: Dedup & Configurable Teams - Research

**Researched:** 2026-08-23
**Domain:** Vue 3 + Pinia + Firestore per-org configuration (structural copy of an existing pattern)
**Confidence:** HIGH

## Summary

This phase has almost no open design questions — CONTEXT.md and 79-UI-SPEC.md already lock the
data model, editor UX, and consuming-surface rewiring. What remained to confirm was: (1) that the
exact line references cited in CONTEXT.md still match the live source (they do, re-verified below
with fresh reads, not trusted from the seed/milestone-research text), (2) that "no firestore.rules
change" is actually true (confirmed — there is a generic `match /{collection}/{docId}` wildcard at
`firestore.rules:458` that grants `isOrgEditor(orgId)` read/write to every per-org subcollection
except `services`/`slideGroups`/`pptxRenders`; `teams` is not excluded, so it falls through exactly
like `roles`/`people`/`quarters` do today with zero rule edits), and (3) two integration points
CONTEXT.md does not mention that will break silently if skipped: the new `teams` store must be
registered in `src/stores/orgScopedStores.ts`'s `resetOrgScopedStores()` (added the same day as this
research, per the church-switch-cache fix in `11064ac5`) or Teams will reintroduce the exact
stale-data-flash bug that commit just fixed for every other store; and `NewServiceDialog.vue` is
currently deliberately Pinia-free for testability (its own comment says so), so wiring it to a
Pinia teams store is an architectural change to that component's test contract, not just a data-
source swap — its test file has zero store mocks today and needs a `createPinia()`/mock setup added,
mirroring the pattern already used in `ServiceEditorView.test.ts`.

No new libraries, no new external services, and no firestore.rules deploy are needed. Every piece of
this phase has a direct, working precedent already in this repo (`src/stores/roster.ts` +
`src/components/RolesConfigPanel.vue`), so implementation is a structural copy, not new pattern design.

**Primary recommendation:** Copy `roster.ts`'s roles half (not the people half) verbatim into a new
`src/types/team.ts` + `src/stores/teams.ts`, copy `RolesConfigPanel.vue` verbatim into a new "Teams"
tab panel in `RosterView.vue`, repoint both `ServiceEditorView.vue:1675`/`:765` and
`NewServiceDialog.vue:145`/`:79` to the store's ordered team-name list, replace the two duplicated
`isOrchestraService` blocks (`ServiceEditorView.vue:3426`, `:3537`) with one shared union-of-selected-
tags helper, delete `sundayOrdinal()` and its two call sites in `NewServiceDialog.vue`, and register
the new store in `resetOrgScopedStores()`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Team list CRUD (add/rename/remove/reorder) | API/Backend (Firestore per-org subcollection) | Frontend (Pinia store + Settings panel) | Mirrors `roles`: persisted org data lives in Firestore, UI is a thin CRUD wrapper — no server-side logic needed beyond the existing per-org rules wildcard |
| Team-list backfill/seeding for orgs with none | API/Backend (Firestore write, client-triggered) | — | `seedDefaultTeamsIfEmpty()` runs client-side (mirrors `seedDefaultRolesIfEmpty()`), gated on `teams.value.length === 0` — no Cloud Function/Admin-SDK involvement |
| Service-plan team checkboxes (2 consumers) | Frontend (Vue components reading Pinia store) | — | Pure rendering + local form state; no backend logic changes |
| Per-team song-tag filter (AI suggestion constraint) | Frontend (client-side array filter before calling the AI proxy) | — | The filter narrows `songLibrary` client-side before it's ever sent to `getSongSuggestions()`; the AI backend/proxy itself is untouched |
| Ordinal-Sunday auto-select removal | Frontend (Vue component, `defaultForm()`) | — | Pure client-side default-value logic; no persisted schema involved |
| Firestore access control for `teams` subcollection | API/Backend (`firestore.rules`) | — | Already covered by the existing generic wildcard (`firestore.rules:458`) — zero new rule needed, verified below |

## Package Legitimacy Audit

**Not applicable this phase.** No new npm packages are introduced — every piece (Pinia store, Vue
SFC, Firestore subcollection CRUD) reuses libraries already installed and in use (`firebase@^12`,
`pinia`, `vue@3`). Skip the Package Legitimacy Gate protocol; there is nothing to audit.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R228 | Org admin defines own team list (add/rename/remove), seeded with sensible defaults, replacing hard-coded `['Choir','Orchestra','Communion','Special']` | `roster.ts`'s `roles`/`DEFAULT_ROLES`/`seedDefaultRolesIfEmpty()` triad is the direct template (read in full below); `RolesConfigPanel.vue` is the direct UI template |
| R229 | Service-plan checkboxes (new-service dialog + service editor) driven by org's configured team list | Exact consumer lines confirmed: `ServiceEditorView.vue:765` (`v-for="team in AVAILABLE_TEAMS"`) and `NewServiceDialog.vue:79` (`v-for="team in availableTeams"`) — both to be repointed to `teamsStore.teamsSorted` (name-derived list) |
| R230 | Optional per-team song-tag filter constrains AI song suggestions to that tag; union when multiple selected teams have filters | Exact duplicated logic confirmed at `ServiceEditorView.vue:3426` and `:3537` (`isOrchestraService` + `librarySource` filter) — both replaced by one shared helper reading `teamsStore` |
| R231 | Ordinal-Sunday auto-team-preselection removed; planner manually selects every service's teams | Exact code confirmed: `sundayOrdinal()` at `NewServiceDialog.vue:148`, called from `defaultForm()` (`:170`) and the date-change watcher (`:190-202`) — all three sites to be deleted; existing regression test at `NewServiceDialog.test.ts:118-131` ("Task 3 — the team side effect") must be replaced, not gutted |
| R241 | Duplicated team-list + Orchestra-filter constants collapsed to one source (prerequisite for R228-R231) | The dedup target is exactly 2 team-list literals (`ServiceEditorView.vue:1675`, `NewServiceDialog.vue:145`) and 2 Orchestra-filter blocks (`ServiceEditorView.vue:3426`, `:3537`) — `VW_TYPE_LABELS` is confirmed already single-source (`src/types/song.ts`), do not touch it |
</phase_requirements>

## Standard Stack

No new libraries. This phase is entirely a structural copy of already-installed, already-in-use
tooling.

### Core (already installed, reused as-is)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase (client SDK) | ^12.0.0 [VERIFIED: package.json] | Firestore subcollection CRUD (`addDoc`/`updateDoc`/`deleteDoc`/`onSnapshot`) | Already the only Firestore client used everywhere else in the app, including `roster.ts` |
| pinia | (installed, version not re-verified this pass — unchanged from rest of app) [CITED: package.json dependency list] | `defineStore` for the new `teams` store | Every other org-scoped collection (`roster`, `quarters`, `songs`, `services`) is a Pinia store — an inconsistent exception would be more surprising than following it |
| vue | ^3.x [ASSUMED — unchanged from rest of app, not re-verified this pass since no upgrade is in scope] | SFC for the new Teams panel | Existing framework, no alternative considered |

### Supporting
None — this phase adds no new supporting libraries (no date/validation/UI-kit additions).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `teams` as a Firestore subcollection (chosen, locked) | `teams: string[]` field bolted onto `OrgSettings` | Rejected by CONTEXT.md and milestone ARCHITECTURE.md: an array field has no CRUD-with-audit-fields analog, forks the read pattern across the two consuming files' merge logic, and reintroduces exactly the two-copy drift this phase exists to kill. Not re-litigated here — locked decision. |
| Passing teams into `NewServiceDialog.vue` as a prop (keeps it Pinia-free) | Wiring `NewServiceDialog.vue` directly to the new Pinia teams store | CONTEXT.md explicitly locks "a Pinia teams store / composable... replaces the duplicated `AVAILABLE_TEAMS` array in BOTH `ServiceEditorView.vue:1675` and `NewServiceDialog.vue:145`" — prop-passing is not the chosen shape. Flagged as a pitfall below (test-file impact), not re-opened as a design choice. |

**Installation:** None required — no `npm install` step this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐        ┌──────────────────────────────────┐
│  RosterView.vue              │        │  organizations/{orgId}/teams      │
│  "Teams" tab (NEW)            │───────▶│  { name, order, songFilterTag? }  │
│  (copies RolesConfigPanel.vue)│  CRUD  │  (Firestore subcollection)        │
└──────────────┬────────────────┘        └───────────────┬────────────────┘
               │  reads/writes via                        │ onSnapshot
               ▼                                           ▼
        ┌──────────────────────────────────────────────────────┐
        │  useTeamsStore() (Pinia, NEW — mirrors roster.ts)      │
        │  teams: Team[]  |  teamsSorted (computed)              │
        │  seedDefaultTeamsIfEmpty()  |  addTeam/updateTeam/deleteTeam │
        └───────────┬───────────────────────────┬──────────────┘
                     │                           │
     read team names/tags                read team names/tags
                     ▼                           ▼
     ┌───────────────────────────┐   ┌───────────────────────────────┐
     │ NewServiceDialog.vue        │   │ ServiceEditorView.vue          │
     │ :79 checkbox v-for          │   │ :765 checkbox v-for            │
     │ form.teams = [] on open     │   │ toggleTeam() localService.teams│
     │ (sundayOrdinal() DELETED)   │   │ :3426/:3537 union-tag filter    │
     └──────────────┬─────────────┘   └───────────────┬───────────────┘
                     │  emit('create', {teams})            │ reads filtered
                     ▼                                       ▼
              serviceStore.createService()          getSongSuggestions()
                     │                              (AI proxy, unchanged)
                     ▼
            organizations/{orgId}/services/{id}
            { teams: string[] }  ← unchanged shape, just org-driven values
```

Reader's path for the primary use case: an admin adds/edits a team + optional `songFilterTag` in
the new Teams tab → the Pinia store's `onSnapshot` pushes it live to both service-planning surfaces
→ a planner checks that team on a service → if it carries a `songFilterTag`, the AI-suggestion
helper narrows the candidate pool to songs carrying that tag (or the union of tags, if multiple
selected teams each have one) before calling the unchanged AI proxy.

### Recommended Project Structure
```
src/
├── types/
│   └── team.ts                  # NEW — Team interface + DEFAULT_TEAMS (mirrors types/roster.ts's Role/DEFAULT_ROLES)
├── stores/
│   ├── teams.ts                 # NEW — useTeamsStore(), mirrors roster.ts's roles half exactly
│   └── orgScopedStores.ts        # MODIFIED — add useTeamsStore().unsubscribeAll() to resetOrgScopedStores()
├── components/
│   ├── RolesConfigPanel.vue      # UNCHANGED — copy target, not modified
│   └── NewServiceDialog.vue      # MODIFIED — repoint :79/:145 to store, delete :148/:170/:190-202 (sundayOrdinal)
└── views/
    ├── RosterView.vue            # MODIFIED — add 3rd "Teams" tab, mount new TeamsConfigPanel
    └── ServiceEditorView.vue     # MODIFIED — repoint :765/:1675 to store, replace :3426/:3537 with shared helper
```

### Pattern 1: Seeded per-org subcollection (the `roles` precedent)
**What:** A Pinia store holds an array populated by `onSnapshot` on
`organizations/{orgId}/{collection}`, ordered by a stable `order` field, plus a
`seedDefault*IfEmpty()` guarded on `array.value.length === 0` so it never re-seeds an org that
already has data.
**When to use:** Any per-org configuration list that needs full CRUD (not just a settings toggle).
**Example (verbatim from the actual precedent, `src/stores/roster.ts:237-250`):**
```typescript
// Seeds the grouped default role list ... only when the org has no roles yet.
// Calling this again once roles exist writes nothing.
async function seedDefaultRolesIfEmpty(): Promise<void> {
  if (!orgId.value) return
  if (roles.value.length !== 0) return
  for (const role of DEFAULT_ROLES) {
    await addDoc(collection(db, 'organizations', orgId.value, 'roles'), {
      ...role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}
```
The `teams` store's `seedDefaultTeamsIfEmpty()` is a 1:1 copy of this, iterating
`DEFAULT_TEAMS = [{ name: 'Choir', order: 0 }, { name: 'Orchestra', order: 1 }, { name: 'Communion', order: 2 }, { name: 'Special', order: 3 }]`
(no `songFilterTag` seeded — CONTEXT.md is explicit that seeding the Orchestra tag is left to the
admin, not auto-applied).

**Where the seed is actually called today (for the `roles` precedent — the `teams` store needs the
identical call site pattern):** `RosterView.vue:673-681`, inside an `onMounted`/subscribe flow —
confirmed by direct read, not assumed:
```typescript
// seedDefaultRolesIfEmpty() checks roles.value.length synchronously, but
...
      rosterStore.seedDefaultRolesIfEmpty()
```
The planner should locate and copy this exact call-site pattern (guard + timing relative to
`subscribe()`) for `teamsStore.seedDefaultTeamsIfEmpty()`.

### Pattern 2: Draft-based editable list with explicit Save (`RolesConfigPanel.vue`)
**What:** A `Record<id, draft>` local state seeded from the store via a `watch(..., {immediate:true,
deep:true})`, with per-row Save/Delete and an Add-row block at the bottom — never autosave.
**When to use:** Any Settings-style config list where losing an in-progress edit to a live
`onSnapshot` update would be surprising.
**Example — the exact watch/draft pattern to copy (`RolesConfigPanel.vue:140-155`):**
```typescript
const roleDrafts = ref<Record<string, { name: string; defaultCount: number }>>({})

watch(
  () => rosterStore.roles,
  (roles) => {
    for (const role of roles) {
      if (!roleDrafts.value[role.id]) {
        roleDrafts.value[role.id] = { name: role.name, defaultCount: role.defaultCount }
      }
    }
    for (const id of Object.keys(roleDrafts.value)) {
      if (!roles.some((r) => r.id === id)) delete roleDrafts.value[id]
    }
  },
  { immediate: true, deep: true },
)
```
For Teams, the draft shape becomes `{ name: string; songFilterTag: string }` (empty string = "No
filter", per 79-UI-SPEC.md's copywriting contract) — no `group`/`defaultCount` fields, since teams
are a flat list with no grouping (79-UI-SPEC.md explicitly calls out "No group badges section").

### Pattern 3: Generic per-org Firestore wildcard access (no new rule needed)
**What:** `firestore.rules` has one wildcard match nested inside `organizations/{orgId}` that grants
`isOrgEditor(orgId)` read/write to every per-org subcollection except three explicitly-named
exclusions.
**Verbatim confirmation (`firestore.rules:458-464`):**
```
match /{collection}/{docId} {
  allow read: if isOrgEditor(orgId);
  allow write: if isOrgEditor(orgId)
    && collection != 'services'
    && collection != 'slideGroups'
    && collection != 'pptxRenders';
}
```
`teams` is not in the exclusion list, so it falls through exactly like `roles`, `people`, and
`quarters` already do — **confirmed by grep that none of those three collection names appear
anywhere else in `firestore.rules`**; this wildcard is their only access rule. **No firestore.rules
change, no deploy, no rules-test update is needed for this phase's Firestore access control.**

### Anti-Patterns to Avoid
- **Autosave on the Teams panel:** `RolesConfigPanel.vue` has no autosave anywhere — every field
  commits only on explicit "Save Role"/"Save Team" click. Do not introduce autosave debouncing for
  Teams; it would be an inconsistent UX pattern next to Roles in the same tab bar.
- **A second `songTagFilter` mechanism per selected team (intersection instead of union):**
  CONTEXT.md locks union/OR semantics explicitly ("restrict to songs matching **any** of those
  tags") to avoid an empty pool when two filtered teams are both selected. Do not implement AND.
- **Deleting `sundayOrdinal()`'s call sites while leaving the function itself as dead code:** the
  milestone PITFALLS.md explicitly calls this out as a "shortcut" row — delete the whole function,
  not just its callers; git history is the undo button.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-org config list with CRUD | A new Firestore data-access pattern, a new drafts/save UX pattern | Copy `roster.ts`'s roles half + `RolesConfigPanel.vue` verbatim | Both are proven, tested, already-shipped precedents in this exact repo — reinventing a shape 2 pixels different from Roles produces gratuitous UI inconsistency for zero benefit |
| Access control for the new subcollection | A new `firestore.rules` match block | Nothing — the existing `match /{collection}/{docId}` wildcard (line 458) already covers it | Confirmed by direct rule-file inspection; adding a redundant explicit block would only add a second place to keep in sync with the wildcard's semantics |
| Union-of-tags AI filter | A generic boolean-expression rule engine | A single `Set<string>` built from `selectedTeams.filter(t => t.songFilterTag).map(t => t.songFilterTag)`, then `base.filter(s => tags.size === 0 || s.tags.some(t => tags.has(t)))` | Milestone SUMMARY.md explicitly names a general rule-builder as an anti-feature to avoid — the observed need is a single-tag-per-team OR-filter, nothing more |

**Key insight:** Every part of this phase already has a shipped, tested twin somewhere in this
codebase (`roles` for the data model + editor UX, the existing single-Orchestra filter for the
generalized filter's shape). The only genuinely new code is the union-of-tags helper function
itself — everything else is a rename-and-repoint exercise.

## Runtime State Inventory

This phase adds a new Firestore subcollection and repoints two existing consumers, so a runtime-
state check is warranted even though it is not a rename/rebrand in the traditional sense.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `organizations/{orgId}/services/{id}.teams` docs already contain plain string values (`'Choir'`, `'Orchestra'`, `'Communion'`, `'Special'`) written by the OLD hard-coded checkboxes. These strings are NOT foreign keys into the new `teams` subcollection — they are freestanding strings on the service doc, unaffected by the new collection's existence. | None — no data migration on `services` docs. The new `teams` subcollection is additive; existing service docs continue to display/edit correctly as long as the seed reproduces the same 4 team-name strings. |
| Live service config | None found — Teams config lives entirely in Firestore (this app's own database), not in any third-party UI/dashboard outside git (unlike, e.g., n8n workflows in other projects). | None. |
| OS-registered state | None — this is a pure web-app Firestore/Vue change with no OS-level task registration, no pm2/systemd/launchd involvement. | None. |
| Secrets/env vars | None — no secret or env var references the string `'Choir'`/`'Orchestra'`/`'Communion'`/`'Special'` or `'teams'`/`'AVAILABLE_TEAMS'`. | None. |
| Build artifacts | None — no compiled/installed artifact embeds the old constant name; `AVAILABLE_TEAMS`/`availableTeams` are plain in-file `const`s, not exported package symbols. | None. |
| **Non-standard category: Pinia in-memory cache on org switch** | The just-shipped fix in `orgScopedStores.ts` (commit `11064ac5`, "clear org-scoped store data on church switch") tears down every org-scoped store's listener+cache on org switch. The new `teams` store is NOT in that list yet because it doesn't exist yet. | **Required code edit:** add `useTeamsStore().unsubscribeAll()` to `resetOrgScopedStores()` in the SAME commit that introduces the store — otherwise Teams reintroduces the exact stale-data-flash bug across a church switch that `11064ac5` just fixed for everything else. |

**Nothing found in category (data migration on `services` docs):** Verified by direct read of
`ServiceEditorView.vue:786-793` (the read-only viewer branch, which the UI-SPEC also confirms needs
no change) and the seed-value match (`DEFAULT_TEAMS`'s names are byte-identical to the current
`AVAILABLE_TEAMS` values) — an existing service's `teams: string[]` renders identically before and
after this phase ships, for both new AND pre-existing orgs.

## Common Pitfalls

### Pitfall 1: Trusting the milestone research's line numbers instead of re-verifying them
**What goes wrong:** CONTEXT.md and ARCHITECTURE.md cite exact line numbers
(`ServiceEditorView.vue:1675`, `NewServiceDialog.vue:145`, etc.) that could have drifted since the
research pass.
**Why it happens:** Line numbers are the most fragile kind of citation — any unrelated edit above
the cited line shifts everything below it.
**How to avoid:** This research re-ran `grep -n` against the live files (2026-08-23, same day as
CONTEXT.md) and confirmed every cited line number still matches exactly:
`ServiceEditorView.vue:765,1675,3426,3537`, `NewServiceDialog.vue:79,145,148,170,193`. If the
planner starts work on a different day, re-grep before trusting these numbers verbatim — treat them
as a starting search anchor, not a guarantee.
**Warning signs:** A plan that edits "around line 1675" without first grepping
`AVAILABLE_TEAMS` to confirm it's still there.

### Pitfall 2: `NewServiceDialog.vue`'s deliberate Pinia-free test contract breaks silently
**What goes wrong:** `NewServiceDialog.vue`'s own code comment says it is intentionally store-free
("A PROP, not a store read... keeping this component store-free is what lets it be unit-tested
without a Pinia instance"). `NewServiceDialog.test.ts` currently has **zero** `vi.mock()` calls and
mounts the component with no Pinia instance at all. CONTEXT.md locks a Pinia teams store as the
shared source for BOTH consumers — wiring `NewServiceDialog.vue` to `useTeamsStore()` breaks that
test file's ability to mount at all (a component calling `useTeamsStore()` without an active Pinia
instance throws) unless the test file is updated in the same commit.
**Why it happens:** The dialog's original "prop, not store" design was a deliberate choice for one
specific prop (`takenDates`); it's easy to assume that principle extends to the new teams data and
either (a) skip updating the test file until it explodes, or (b) "fix" it by reverting to prop-
passing, silently contradicting CONTEXT.md's locked decision.
**How to avoid:** Add a `createPinia()`/`setActivePinia()` + `vi.mock('@/stores/teams', ...)` setup
to `NewServiceDialog.test.ts`, mirroring the exact pattern already used in
`ServiceEditorView.test.ts:601-609` for its roster mock (seed the mock with the default 4 teams so
existing "Orchestra"/"Choir" assertions keep passing).
**Warning signs:** `NewServiceDialog.test.ts` failing with "no active Pinia" or similar after the
store repoint; or a plan that quietly reintroduces prop-passing for teams to sidestep this, contradicting the locked Pinia-store decision.

### Pitfall 3: New `teams` store omitted from `resetOrgScopedStores()`
**What goes wrong:** The org-switch stale-data-flash bug fixed in `11064ac5` (same day as this
research, "clear org-scoped store data on church switch") enumerates every org-scoped Pinia store
by name in `src/stores/orgScopedStores.ts`. A new store created after that fix landed will NOT be
in that list unless explicitly added — its stale data will flash on screen for a moment during a
church switch, exactly reproducing the bug that commit was written to eliminate.
**Why it happens:** The list is a manual enumeration, not auto-discovered; a new store is invisible
to it until someone remembers to add it.
**How to avoid:** In the same PR/commit that creates `src/stores/teams.ts`, add
`useTeamsStore().unsubscribeAll()` to `resetOrgScopedStores()` in `orgScopedStores.ts`.
**Warning signs:** A UAT session that switches between two orgs with different team lists and
briefly sees the previous org's team names in the checkbox row or Teams tab.

### Pitfall 4: Backfill for existing (pre-feature) orgs must reproduce today's exact 4 teams
**What goes wrong:** If the seed data used by `seedDefaultTeamsIfEmpty()` doesn't byte-match
`['Choir', 'Orchestra', 'Communion', 'Special']`, Berean's (and every existing org's) team list
changes the moment this phase ships — a real regression, not neutral default data.
**Why it happens:** "Sensible defaults" (R228's wording) could tempt a slightly different default
set (e.g., adding a 5th starter team) without realizing every existing org is also going through
this exact seed path on first load post-deploy.
**How to avoid:** `DEFAULT_TEAMS` must be exactly `[{name:'Choir',order:0}, {name:'Orchestra',order:1},
{name:'Communion',order:2}, {name:'Special',order:3}]` — no `songFilterTag` seeded (CONTEXT.md:
"seeding the tag is optional and left to the admin"). Write a test asserting an org with zero team
docs resolves to exactly this 4-team list after first load.
**Warning signs:** A seed constant with different names, different order, or a different count than
today's `AVAILABLE_TEAMS`.

### Pitfall 5: `NewServiceDialog.test.ts`'s ordinal-removal test must assert new behavior, not be gutted
**What goes wrong:** `NewServiceDialog.test.ts:118-131` has a dedicated `describe` block ("Task 3 —
the team side effect") pinning the OLD ordinal-Sunday auto-select behavior. Deleting
`sundayOrdinal()` will break these assertions; the unsafe fix is to delete the whole `describe`
block (or gut its assertions) to make CI green without asserting what SHOULD happen instead.
**Why it happens:** Deleting a feature and deleting its test in the same commit looks like a clean
removal but removes the one place a regression would be caught.
**How to avoid:** Replace the block's assertions with a new one proving `form.teams` is `[]`
regardless of which Sunday is picked (R231's actual new behavior — "no default at all", confirmed
in CONTEXT.md's Decisions section, not left as an open question this time — the milestone-level
PITFALLS.md flagged this as needing an explicit decision, and CONTEXT.md has since made it: "a new
service starts with no teams pre-selected").
**Warning signs:** A diff removing `sundayOrdinal()` with no corresponding new assertion in
`NewServiceDialog.test.ts` about the post-removal default.

### Pitfall 6: `ServiceEditorView.test.ts`'s existing Orchestra-checkbox test needs a teams-store mock
**What goes wrong:** `ServiceEditorView.test.ts:3152` finds a team checkbox by exact label text
`'Orchestra'` (`wrapper.findAll('label').find((l) => l.text() === 'Orchestra')`). Once
`AVAILABLE_TEAMS` is replaced by a store read, this test will find nothing (empty array) unless a
`@/stores/teams` mock is added returning the same 4 default team names, mirroring the existing
`@/stores/roster` mock at `ServiceEditorView.test.ts:601-609`.
**Why it happens:** The component's `vi.mock()` list is enumerated per-store; a brand-new store
import has no corresponding mock until someone adds one.
**How to avoid:** Add `vi.mock('@/stores/teams', () => ({ useTeamsStore: () => ({ teamsSorted:
mockTeams, ... }) }))` with `mockTeams` seeded to the same 4 default names, alongside every other
existing store mock in that file (roster, quarters, songs, auth, etc. — same list at lines
418-623).
**Warning signs:** `ServiceEditorView.test.ts` failing with "orchestraLabel is undefined" after the
repoint lands.

## Code Examples

Verified patterns from the actual in-repo source (not external docs — this phase has no external
dependency):

### Seeded subcollection store shape (source: `src/stores/roster.ts:26-33,60-77`)
```typescript
export const useRosterStore = defineStore('roster', () => {
  const roles = ref<Role[]>([])
  // ...
  let unsubscribeRolesFn: Unsubscribe | null = null

  function subscribe(orgIdValue: string) {
    // ...
    const rolesQuery = query(
      collection(db, 'organizations', orgIdValue, 'roles'),
      orderBy('order'),
    )
    unsubscribeRolesFn = onSnapshot(rolesQuery, (snap) => {
      roles.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Role)
    })
  }
```
The `teams` store's `subscribe()` is a 1:1 copy of this shape, querying
`organizations/{orgId}/teams` ordered by `order`.

### Role/Team type shape (source: `src/types/roster.ts:5-11`)
```typescript
export interface Role {
  id: string
  name: string
  group: RoleGroup
  defaultCount: number
  order: number
}
```
`Team` (new, `src/types/team.ts`) drops `group`/`defaultCount` (teams are flat, no per-team default
headcount) and adds the optional filter field:
```typescript
export interface Team {
  id: string
  name: string
  order: number
  songFilterTag?: string
}
```

### Union-of-selected-team-tags filter helper (new — generalizes `ServiceEditorView.vue:3426-3430`)
The current duplicated logic (verbatim, one of two identical copies):
```typescript
const isOrchestraService = (localService.value?.teams ?? []).includes('Orchestra')
const base = songStore.aiCandidateSongs
const librarySource = isOrchestraService
  ? base.filter((s) => s.tags.includes('Orchestra'))
  : base
```
Generalized replacement (single shared helper, called from both of the two current call sites):
```typescript
function filterSongsByTeamTags(base: Song[], selectedTeamNames: string[]): Song[] {
  const activeTags = new Set(
    selectedTeamNames
      .map((name) => teamsStore.teamsSorted.find((t) => t.name === name)?.songFilterTag)
      .filter((tag): tag is string => !!tag),
  )
  if (activeTags.size === 0) return base
  return base.filter((s) => s.tags.some((t) => activeTags.has(t)))
}
```
Both `suggestAllSongs()` (`:3426`) and `fetchAiForSlot()` (`:3537`) call this one helper with
`localService.value?.teams ?? []` in place of their current inline `isOrchestraService` check.

## State of the Art

Not applicable — this phase does not touch any evolving external API/library surface. The pattern
being copied (`roster.ts`/`RolesConfigPanel.vue`) is the current, only, and already-modern pattern
in this codebase; there is no "old approach" being replaced at the tooling level, only at the
data-model level (hard-coded array → configurable subcollection), which is fully covered above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pinia's installed version is unchanged from the rest of the app (not re-verified via `npm view` this pass, since no Pinia upgrade is in scope) | Standard Stack | Negligible — no new Pinia API surface is used beyond `defineStore`, already used identically elsewhere |
| A2 | Vue's installed version supports the exact composition-API patterns already used in `RolesConfigPanel.vue` (verified indirectly by that file compiling/running today, not by a fresh `npm view`) | Standard Stack | Negligible — copying an already-working file's patterns carries no new version risk |

**If this table is empty:** N/A — see above; both entries are low-risk framework-version assumptions
inherited from the existing codebase, not new claims about this phase's design.

## Open Questions

None blocking. CONTEXT.md and 79-UI-SPEC.md already resolved every design decision this phase needs
(data model, seed values, editor UX, union-vs-intersection semantics, ordinal-removal replacement
behavior). The two items this research surfaced beyond CONTEXT.md (Pitfalls 2 and 3 above — the
`NewServiceDialog.vue` test-contract change and the `resetOrgScopedStores()` registration) are
mechanical follow-ons, not open design questions — they have one correct answer each, given above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 [VERIFIED: package.json] |
| Config file | `vite.config.ts` (root `test` block, `environment: 'jsdom'`) — no separate `vitest.config.ts` for the app suite |
| Quick run command | `npx vitest run src/stores/__tests__/teams.test.ts src/components/__tests__/NewServiceDialog.test.ts src/views/__tests__/ServiceEditorView.test.ts` (scoped to touched files — per CLAUDE.md, do NOT use `--dir` since it bypasses `vite.config.ts`'s excludes) |
| Full suite command | `npx vitest run` (per CLAUDE.md — the correct root command; excludes `src/rules.test.ts` and `render-service/**` by design, not a regression) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R228 | `seedDefaultTeamsIfEmpty()` writes exactly the 4 default teams when the org has zero team docs; writes nothing when teams already exist; add/rename/remove work via `addTeam`/`updateTeam`/`deleteTeam` | unit | `npx vitest run src/stores/__tests__/teams.test.ts` | ❌ Wave 0 — new file, mirrors `src/stores/__tests__/roster.test.ts`'s `roles subscription + seedDefaultRolesIfEmpty` and `addRole/updateRole/deleteRole` describe blocks (lines 482-560 there) |
| R228 | Teams editor panel: draft-based Save (not autosave), inline delete-confirm with soft-warn copy, Add-row affordance, `aria-label`s present | component | `npx vitest run src/components/__tests__/TeamsConfigPanel.test.ts` | ❌ Wave 0 — new file, mirrors the shape of any existing `RolesConfigPanel.vue`-adjacent test if one exists, else authored fresh against the copied component |
| R229 | `NewServiceDialog.vue`'s checkbox row renders one pill per `teamsStore` entry (not the old hard-coded 4); empty-state hint shown when zero org teams | component | `npx vitest run src/components/__tests__/NewServiceDialog.test.ts` | ✅ existing file — needs the Pinia/mock setup from Pitfall 2 added, plus new assertions for store-driven rendering |
| R229 | `ServiceEditorView.vue`'s checkbox row (`:765`) renders from the store; viewer branch (`:786`, read-only) unaffected | component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ existing file — needs the `@/stores/teams` mock from Pitfall 6 added |
| R230 | Selecting a team with a `songFilterTag` narrows `suggestAllSongs()`/`fetchAiForSlot()`'s candidate pool to that tag; multiple filtered teams selected → union (OR), not intersection; zero filtered teams selected → full pool (today's non-Orchestra behavior preserved) | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "song-tag filter"` (new `describe` block) | ❌ Wave 0 — new assertions in the existing file, replacing/extending the current single-Orchestra-only coverage (search that file for `isOrchestraService`/`Orchestra`-tag assertions as the starting point to generalize) |
| R231 | New-service dialog's `form.teams` initializes to `[]` on every open, regardless of the chosen Sunday's ordinal position | unit | `npx vitest run src/components/__tests__/NewServiceDialog.test.ts -t "R038 side effect"` | ✅ existing file, existing `describe` block at line 118 — MUST be rewritten (per Pitfall 5), not deleted, to assert the new empty-default behavior |
| R241 | `AVAILABLE_TEAMS`/`availableTeams` literals no longer exist in either `ServiceEditorView.vue` or `NewServiceDialog.vue`; both read from the same `teamsStore.teamsSorted` computed; the two `isOrchestraService` blocks collapse to one shared helper | static/grep-based regression | `grep -rn "AVAILABLE_TEAMS\|availableTeams = \['Choir'" src/` returns zero matches; `grep -c "isOrchestraService" src/views/ServiceEditorView.vue` returns 0 (or a single shared reference, not two independent definitions) | N/A — a plan-completion grep check, not a Vitest file, but should be an explicit verification step in the phase's PLAN.md |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched-test-files>` (quick run command above)
- **Per wave merge:** `npx vitest run` (full app suite — confirms no cross-file regression, e.g. in
  `orgScopedStores.ts` consumers)
- **Phase gate:** Full suite green (`npx vitest run`) + `npm run type-check` (per CLAUDE.md — the
  `vue-tsc --build` form, NOT `-p tsconfig.app.json`, since the latter silently skips test files)
  before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/stores/__tests__/teams.test.ts` — covers R228 (seed idempotency, CRUD), mirrors
      `src/stores/__tests__/roster.test.ts`'s roles-half describe blocks (lines 482-560)
- [ ] `src/components/__tests__/TeamsConfigPanel.test.ts` — covers R228's editor UX (draft/save/
      delete-confirm/add-row/aria-labels)
- [ ] Pinia + `@/stores/teams` mock added to `NewServiceDialog.test.ts` (currently has none) — blocks
      every R229/R231 assertion in that file until added (Pitfall 2)
- [ ] `@/stores/teams` mock added to `ServiceEditorView.test.ts`'s existing `vi.mock()` block
      (alongside the `@/stores/roster` mock at lines 601-609) — blocks the existing Orchestra-label
      test (line 3152) and any new R230 union-filter test until added (Pitfall 6)
- [ ] Framework install: none — Vitest is already configured and running; no new test dependency
      needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unaffected — no auth flow touched this phase |
| V3 Session Management | no | Unaffected |
| V4 Access Control | yes | The new `teams` subcollection is gated by the existing generic wildcard `isOrgEditor(orgId)` check (`firestore.rules:458-463`) — the SAME access-control mechanism already protecting `roles`/`people`/`quarters`. No new rule is written; the existing control is reused, not weakened (teams is not added to the write-exclusion list, and no broader grant is introduced). |
| V5 Input Validation | yes | `songFilterTag` is a free-text-adjacent field constrained client-side to the org's existing `songStore.allUserTags` (a `<select>`, not a free-text input, per 79-UI-SPEC.md) — this is the standard pattern already used for tag-like fields elsewhere in the app (no new validation library needed; client-side `<select>` constraint plus Firestore rule's editor-only write gate is the existing app-wide posture for this class of field) |
| V6 Cryptography | no | Not applicable — no secrets/crypto involved |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A non-editor org member (or a member of a different org) writing/reading another org's `teams` subcollection | Tampering / Information Disclosure | Already mitigated by the existing `isOrgEditor(orgId)` wildcard gate — verified this phase adds nothing to the exclusion list that would need a NEW test; existing `src/rules.test.ts` coverage for the wildcard's `roles`/`people` behavior already exercises this exact code path for a sibling collection, so no NEW rules-test is strictly required, but the planner may add one for `teams` explicitly for completeness/documentation. |
| Client sending an arbitrary `songFilterTag` string not present in `songStore.allUserTags` | Tampering (low severity) | The `<select>`-only UI (not free text, per 79-UI-SPEC.md) prevents this from the app's own UI; a malicious direct-Firestore-write client could still set an arbitrary string, but the worst-case outcome is a filter that matches zero songs (empty AI pool) — no data exposure, no escalation. Not worth adding a Firestore rules-level enum validation for this phase; consistent with the app's existing posture on similarly free-text-adjacent fields. |

## Sources

### Primary (HIGH confidence)
- Direct repo inspection, all read fresh 2026-08-23 (same session as this research, not carried
  forward from the milestone research pass): `firestore.rules` (full org-wildcard block,
  lines 95-465, 601-635), `src/stores/roster.ts` (full file), `src/components/RolesConfigPanel.vue`
  (full file), `src/types/roster.ts` (full file), `src/views/ServiceEditorView.vue` (lines 750-849,
  3390-3570), `src/components/NewServiceDialog.vue` (full file), `src/stores/orgScopedStores.ts`
  (full file), `src/views/ServicesView.vue` (lines 355-381), `src/views/RosterView.vue` (lines 1-70,
  tab bar), `src/stores/songs.ts` (lines 90-119), `src/components/__tests__/NewServiceDialog.test.ts`
  (`describe`/`it` list + "Task 3" block), `src/views/__tests__/ServiceEditorView.test.ts` (mock
  block lines 214-623, Orchestra-label assertion line 3148-3158), `src/stores/__tests__/roster.test.ts`
  (`describe`/`it` list), `package.json` (test scripts), `vite.config.ts` (test config block),
  `.planning/config.json` (workflow flags — `nyquist_validation`/`security_enforcement` both absent
  → treated as enabled per this agent's defaults)
- `.planning/phases/79-dedup-configurable-teams/79-CONTEXT.md` and `79-UI-SPEC.md` — locked decisions
  for this phase, treated as final, not re-litigated
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — R228-R231/R241 text and Phase 79 success
  criteria

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md`, `.planning/research/SUMMARY.md`,
  `.planning/research/PITFALLS.md` — milestone-level research (dated 2026-08-23, same day) providing
  the initial hypothesis for line numbers and pattern choices, cross-checked against fresh direct
  repo reads above rather than trusted as-is (per that same research's own Pitfall 1 caution about
  re-verifying seed/research claims)

### Tertiary (LOW confidence)
- None — every claim in this document either cites a directly-read file/line from this session, or
  is explicitly logged in the Assumptions Log above as unverified this pass.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new libraries; every tool cited is already installed and in active use
- Architecture: HIGH — every pattern cited is a direct copy of an existing, working, tested file in
  this exact repo, re-read fresh this session
- Pitfalls: HIGH — all 6 pitfalls are grounded in direct evidence (a code comment, a test file's
  current mock list, or a recent commit's stated purpose), not speculation

**Research date:** 2026-08-23
**Valid until:** Stable — re-verify line numbers only if significant unrelated edits land in
`ServiceEditorView.vue`/`NewServiceDialog.vue` before this phase is planned/executed (no external
API/library drift risk exists for this phase).
