# Phase 72: Owner Console Tabs - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas auto-accepted per the v2.0 standing autonomy grant — reasonable defaults chosen and stated; none unsafe or work-wasting enough to warrant a pause)

<domain>
## Phase Boundary

Restructure the existing single-scroll `OwnerConsoleView.vue` into a **tabbed shell** with two tabs —
**Configuration** and **Organizations** — without changing any existing behavior. The Configuration tab holds
the entire current console body (super-admins roster + the four platform-config cards + the deploy-time note);
the Organizations tab is a **placeholder shell only** this phase (its real content — list + onboard + assign
admin — is Phase 74). Both tabs remain behind the existing super-admin gate on `/owner-console`. Delivers
R193, R194, R195.

**Explicitly NOT in this phase:** any organization data, listing, onboarding, admin-assignment UI, or new
callables/rules (all Phase 74); any change to the config cards' or roster's behavior, validation, or
subscriptions beyond relocating them under a tab pane.
</domain>

<decisions>
## Implementation Decisions

### Tab mechanism & deep-linking (R193, R195)
- Active tab is driven by a route **query param** `?tab=configuration|organizations`, defaulting to
  `configuration` when the param is absent or unrecognized — this makes the open tab survive a refresh and be
  directly linkable/bookmarkable (R195), the specific mechanism R195 calls for.
- Clicking a tab updates the query via `router.replace` (no history spam), keeping the URL and the visible
  pane in sync in both directions (URL→pane on load, pane→URL on click).
- Keep the route name/path unchanged (`/owner-console`, name `owner-console`); tabs are a query concern, not
  new routes — avoids touching the router guard that gates super-admin access.

### Tab UI pattern (R193)
- Reuse the app's existing in-view tab pattern from `ServiceEditorView.vue` (a button row with active-state
  classes, `activeTab === 'x'` conditional panes) for visual and interaction consistency with the rest of the
  app — dark-theme styling (indigo active accent) matching the current console header.
- `OwnerConsoleView.vue` becomes a **thin tab shell**: it renders the header, the tab strip, and the active
  pane. Configuration selected by default.

### Configuration tab = current console body, unchanged (R194)
- The Configuration pane contains the **entire existing console body verbatim**: the super-admins roster
  (grant/revoke via `setSuperAdminClaim`, inline revoke-confirm, empty/loading states) and the four config
  cards (`CleanupConfigCard`, `AiProxyConfigCard`, `MessagingConfigCard`, `SenderConfigCard`) plus the
  provenance stamp and the dashed deploy-time note.
- **No behavior change**: the `superAdmins` onSnapshot subscription and `appConfigStore.subscribe()` /
  `unsubscribe()` lifecycle, all grant/revoke handlers, and all card validation/provenance behavior are
  preserved exactly — only their location moves under the Configuration pane. Planner's discretion whether to
  extract the body into a `ConfigurationTab.vue` child or wrap it inline under a `v-if` pane; either is
  acceptable as long as behavior and the existing subscriptions are byte-preserved and the pane still mounts
  its subscriptions when the console loads (do not lazy-defer the roster/appConfig subscriptions behind a tab
  click — they must remain active on load exactly as today, so provenance and roster are current regardless of
  which tab is open).

### Organizations tab = placeholder shell only (R193, scope guard)
- The Organizations pane renders a simple **empty-state placeholder** this phase (e.g. a heading + muted
  "Organization management is coming in this milestone" line, matching the console's card styling). No data
  fetch, no callables, no forms. Phase 74 replaces this placeholder with the real list + onboarding UI.

### Access gate (unchanged)
- No new access surface: both panes live inside the already-super-admin-gated `/owner-console` route and its
  existing router guard + `isSuperAdmin()` rules. This phase introduces no new gate, claim, rule, or callable.

### Tests (SC4)
- Carry forward and adapt `OwnerConsoleView.test.ts` so every pre-existing assertion (roster grant/revoke
  flow, the four cards' presence, provenance stamp) still passes under the tab shell — proving the restructure
  changed location, not behavior. Add coverage for: default tab = Configuration, tab switch via query param,
  deep-link to `?tab=organizations` landing on the Organizations pane on load.

### Claude's Discretion
- Exact component decomposition (thin-shell + extracted `ConfigurationTab.vue`/`OrganizationsTab.vue` vs.
  inline `v-if` panes), tab-strip markup details, and placeholder copy — all at the planner's/executor's
  discretion within the decisions above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/views/OwnerConsoleView.vue` — the current single-scroll console (super-admins roster + four config
  cards + deploy-time note); becomes the tab shell.
- `src/components/admin/{CleanupConfigCard,AiProxyConfigCard,MessagingConfigCard,SenderConfigCard}.vue` — the
  four config cards, unchanged, rendered inside the Configuration pane.
- `src/views/ServiceEditorView.vue` — the in-view tab pattern to mirror (`activeTab` state, active-state
  button classes, conditional panes) for a 4-tab strip; adapt to 2 tabs sourced from the route query.
- `src/components/AppShell.vue` — the console is wrapped in `<AppShell>`; keep that wrapper.
- `src/router/index.ts` — `/owner-console` route (name `owner-console`), already super-admin gated; tabs are a
  query concern, do not add routes.
- `src/stores/appConfig.ts` (`useAppConfigStore`) and the `superAdmins` collection subscription — the two
  live subscriptions the Configuration pane must keep active on load.

### Established Patterns
- In-view tabs use local `activeTab` reactive state + `activeTab === 'x'` conditional rendering with
  Tailwind active-state classes (indigo accent on dark gray) — see ServiceEditorView tab strip.
- Route-query reading via `vue-router` `useRoute()`/`useRouter()`; dark-theme palette gray-950/900/800.

### Integration Points
- `OwnerConsoleView.vue` template + `<script setup>` (the tab strip, query-driven `activeTab`, two panes).
- `OwnerConsoleView.test.ts` (carried-forward assertions + new tab tests).
- Possibly `src/router/index.ts` only if a query-param default needs normalizing (prefer handling in-view to
  avoid touching the guard).
</code_context>

<specifics>
## Specific Ideas

- Default tab is **Configuration**; the Configuration pane must be a behavior-identical relocation of today's
  console — this is the SC that proves the restructure is safe.
- Deep-link target for R195 is `?tab=organizations` — opening that URL (or refreshing on it) lands on the
  Organizations pane, not a reset to Configuration.
</specifics>

<deferred>
## Deferred Ideas

- Organizations list, onboarding flow, and admin assignment → **Phase 74** (this phase ships only the tab
  shell + placeholder).
- Multi-org Storage auth claim widening → **Phase 73**.
</deferred>
