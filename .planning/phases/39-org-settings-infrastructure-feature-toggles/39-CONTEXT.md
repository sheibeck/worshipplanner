# Phase 39: Org Settings Infrastructure & Feature Toggles - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

This phase delivers two things that later phases depend on:

1. **A typed, defaulted `OrgSettings` shape** — the storage contract every v1.5 setting writes into.
   Phases 44 (default service template), 45 (Bible version) and 46 (slide typography) each add a field
   to this shape; none of them should have to re-solve loading, defaulting, or type-safety.

2. **The first two settings that use it** — AI integration on/off and Planning Center integration
   on/off, each enforced at its module entry point rather than in the UI.

**Out of this phase:** any *other* setting's UI or behavior. The template editor, the Bible-version
picker and the font picker are Phases 44, 45 and 46 respectively. This phase builds the shape they
store into and proves it with two real consumers.

</domain>

<decisions>
## Implementation Decisions

### OrgSettings Shape

- **Nested `settings: {…}` sub-object on the organization document**, not flat top-level fields.
  Eight settings arrive across five phases; nesting isolates them from the org's identity fields
  (`name`, `slug`, `pcAppId`, `pcSecret`).

- **`vwModeEnabled` MIGRATES into `settings`** (owner decision — overrides the initial recommendation
  to leave it flat).
  <br>⚠ **This is live production data and the migration must not flip it.** A church that
  deliberately turned Vertical Worship OFF must not come back ON. Required read shape:
  ```ts
  settings?.vwModeEnabled ?? orgData.vwModeEnabled ?? true
  ```
  Dual-read with **lazy backfill** — write the value into `settings` on the next org write, never a
  bulk migration script. The flat field stays readable until every org has been backfilled; removing
  it is a later cleanup, not this phase's job.

- **One defaults-merge point: `auth.ts::loadOrgContext`.** It returns a fully-populated `OrgSettings`
  so no downstream caller ever writes `?? default`. This is what makes success criterion 1 true on
  *every* screen rather than only the Settings screen.

- **Components read one typed `settings` computed on the auth store**, not one ref per setting.

### Toggle Enforcement

- **`claudeApi.ts` returns `null` when AI is off.** Matches the codebase convention (CONVENTIONS.md:
  "Don't throw from service/utility functions; let callers handle null") and PROJECT.md's standing
  decision that AI is "additive, never blocking" — every call site already handles a null return.

- **The guard imports the auth store inside the guard function.** Pinia permits store access outside
  `setup()` once the app is initialized. Keeps one source of truth rather than threading an
  `aiEnabled` parameter through every call site, where one missed site would silently bypass it.

- **One shared internal guard, called by each exported entry point** of `claudeApi.ts`. No exported
  function can forget it.

- **The proving test calls each exported `claudeApi` function with the toggle off and asserts `fetch`
  was never invoked.** Success criterion 2 explicitly rejects a `v-if` test — the assertion must be at
  the module entry point, not the component layer.

### Off-State Behavior

- **AI entry points hide entirely** when AI is off — not disabled-with-tooltip. `[FEAT]` research found
  hide-don't-grey is the SaaS norm; a greyed control invites "why can't I click this."
  Affects: song suggestions (`SongSlotPicker.vue`), scripture discovery (`ScriptureInput.vue`),
  congregational-reading AI split (`CongregationalEditor.vue`).

- **Turning AI off never alters content AI already generated.** An existing congregational split stays
  exactly as it is and remains fully editable by hand. This is success criterion 4 and is a hard
  guarantee, not a best effort.

- **Planning Center off hides:** Export to PC, roster import, song import, and the credentials block.
  **Stored credentials are retained, not cleared** — turning PC back on must not require re-entering
  them. Already-imported roster data and the status of already-`exported` services are untouched.

### Settings UI

- **The PC toggle lives inside the EXISTING "Planning Center Integration" section** — not a new
  combined Integrations section (owner decision).

- **AI gets its own new section** which **explains which AI features the app supports** before
  offering the off switch. The three features named above are the list.

- **Both toggles default to ON.**

- **No confirmation dialog on either toggle.** Both flip immediately, the way `vwModeEnabled` already
  does.

- **Editors can change these** — the same gating `SettingsView.vue` already applies. No new role tier.

### Claude's Discretion

- Exact `OrgSettings` field names and the `DEFAULT_ORG_SETTINGS` constant's location.
- Whether `Organization` and `OrgSettings` share one file (`src/types/organization.ts`) or split.
- Copy for the AI section's feature explanation, within the constraint that it names all three
  AI features.
- Test file placement, following the existing `__tests__` convention.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/views/SettingsView.vue`** — already hosts a working per-org boolean toggle (`vwModeEnabled`,
  `onToggleVwMode` at line ~474) with save-feedback and error refs. The new toggles copy this shape.
- **`src/stores/auth.ts::loadOrgContext`** (line ~86) — the single place org fields are read from
  Firestore into refs. Currently does `(orgData.x as T) ?? default` inline per field; this phase
  replaces that with one typed merge.
- **`src/utils/claudeApi.ts`** — the single AI choke point. All three AI consumers route through it,
  confirmed by grep: `SongSlotPicker.vue`, `ScriptureInput.vue`, `CongregationalEditor.vue`.
- **`src/utils/planningCenterApi.ts`** — the PC utility entry point, same role for the PC toggle.

### Established Patterns

- Pinia composition-API stores; refs typed explicitly; all public state returned at the end.
- `@/` path alias everywhere, never relative imports.
- Tailwind utility classes only, no scoped CSS; static class maps to survive purging.
- Errors: `console.error('[moduleName] operation:', err)` and return `null` — never throw from utils.
- Tests in `__tests__/` directories parallel to source, `.test.ts` suffix.
- JSDoc on all exported functions and types; design references as `(D-01)` / `(R-02)` comments.

### Integration Points

- `loadOrgContext` is where settings load. It already handles the no-org case by resetting every ref —
  the new `settings` object needs the same reset path.
- The member `onSnapshot` in `loadOrgContext` performs a one-time admin→editor migration; it is the
  established precedent in this file for lazy, read-time backfill — the same technique
  `vwModeEnabled`'s migration should follow.
- `noUncheckedIndexedAccess: true` is on — indexed reads need explicit narrowing.

</code_context>

<specifics>
## Specific Ideas

- The AI section should **explain the AI features before offering to disable them**, per the owner:
  a church turning AI off should be able to see exactly what they are giving up.
- Owner's framing on why the AI toggle matters beyond preference: *"If we need to gate this behind a
  paywall later to offset AI costs this is a good starting point."* The guard should therefore be a
  clean single choke point suitable for later re-gating, not scattered checks.
- The PC toggle's eventual purpose is a full migration off Planning Center: *"Once someone has fully
  ported planning center item over and we have a full replacement system in place for it."* Hiding is
  correct for now; nothing should be built that assumes PC data can be deleted.

</specifics>

<deferred>
## Deferred Ideas

- **Removing the flat `vwModeEnabled` field** once every org document has been backfilled — a cleanup
  task, not this phase. The dual-read must stay until then.
- **Owner-only settings tier** — considered and declined; editors keep full settings access.
- **Clearing PC credentials on disable** — considered and declined; credentials are retained so
  re-enabling is frictionless.

</deferred>
