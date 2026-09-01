# Phase 104: Notification & Multi-Church Foundations - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, auto-optimized from v2.7 research SUMMARY/ARCHITECTURE/PITFALLS + owner decisions)

<domain>
## Phase Boundary

Deliver two decoupled foundations: (1) a **single system-wide dismissible-message system** so no
warning/error/info can get stuck on screen — every message manually dismissible, and condition-tied
messages auto-clear when their condition resolves; and (2) a **user-menu church switcher** letting a
member of multiple churches change active church without signing out. Both reuse existing, already-hardened
code. In scope: R309, R310, R311, R312. Out of scope: any rehearsal/storage work; new notification styling
beyond what the existing host provides.
</domain>

<decisions>
## Implementation Decisions

### Notification system (R309, R310)
- **Generalize the existing `src/stores/toasts.ts` into the one app-wide message store — do NOT build a
  parallel system.** Research (PITFALLS) confirms `toasts.ts` is today a deliberately narrow, failure-only,
  fixed ~6s auto-dismiss store; extend it rather than reusing it as-is (reusing as-is would make a
  persistent warning vanish while still true).
- Support **two lifetimes**: (a) transient auto-dismiss (existing behavior — successes/incidental errors),
  and (b) **persistent/sticky** messages that remain until either their condition clears or the user
  dismisses. **Every message of both kinds gets a working manual-dismiss control** (R309).
- **Condition-tied messages** carry a stable **key/id** so the owning view can clear them
  programmatically when the condition resolves (R310). Adding the same key twice de-dupes (no stacking).
- The **"monitors not configured" warning** currently lives as **ad-hoc markup in `RunControlView.vue`**
  (not routed through `toasts.ts` at all — this is the actual "stuck" bug). Re-implement it as a **keyed
  persistent warning** that (i) auto-clears the moment monitors are configured and (ii) is manually
  dismissible in the meantime.
- **Rendering:** keep `ToastHost.vue` as the single global host; extend it for severities
  (info/success/warning/error) and a dismiss affordance. Accessibility: `aria-live="polite"` for
  info/success, `assertive` for errors/warnings; dismiss button is a real focusable `<button>` with an
  aria-label.
- **Scope of migration:** ship the shared primitive + migrate the known stuck monitor warning as the
  proof case. Opportunistically route other obvious ad-hoc banners found in a quick sweep; a full
  app-wide audit of every message surface is allowed to trail (note any left for follow-up), but the
  primitive + R310 case must land.

### Church switcher (R311, R312)
- **Reuse `authStore.selectOrg()` + `resetOrgScopedStores()`** (built and bug-fixed for the v2.1
  super-admin work). Do NOT write a new switching path.
- Surface a **switcher in the top-bar user/avatar menu**: list each church the user belongs to (from the
  additive `orgs:{orgId:role}` membership/claim), **showing the user's role** in each; selecting one
  switches active church **without signing out**.
- **Keep strictly distinct from the super-admin `enterOrgAsSuperAdmin()` path** — a regular multi-org
  member uses `selectOrg()`; the two must not be conflated in the new UI. A super-admin viewing a church
  they don't actually belong to via enter-any-church is a different mode.
- **Single-org users:** show no switcher (or a non-interactive current-church label) — the control appears
  only when the user belongs to >1 church.
- **Full state reset on switch (R312):** switching must go through `resetOrgScopedStores()` so every
  org-scoped store/view shows only the new church's data — no stale onSnapshot data from the prior org.
  Preserve `selectOrg()`'s existing awaited claim/context refresh.
- **Forward-looking:** Phase 107 adds a `stageLayouts` store — it MUST be registered in
  `resetOrgScopedStores()` when built, or a church switch would leak the prior church's layout. Note this
  as a cross-phase obligation (not built here).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/toasts.ts` — the narrow failure-toast store to generalize.
- `ToastHost.vue` — the existing global toast host component.
- `src/stores/auth.ts` — `selectOrg()` (regular multi-org switch) and `enterOrgAsSuperAdmin()` (separate
  super-admin path).
- `src/stores/orgScopedStores.ts` — `resetOrgScopedStores()` (the store-reset registry; already fixed a
  prior stale-data bug).
- `src/views/RunControlView.vue` — holds the ad-hoc "monitors not configured" banner to migrate.
- `SelectChurchView.vue` — an existing `selectOrg()` caller to model the switcher on.
- The top-bar / user-menu (AppShell header) — where the switcher mounts.

### Established Patterns
- Pinia stores with `onSnapshot`; org-scoped data reset centrally on org change.
- Teleport-to-body for global overlays (toast host, dropdowns).
- Org membership on an additive custom auth claim `orgs:{orgId:role}`.

### Integration Points
- Top-bar user menu component (new switcher UI).
- `RunControlView.vue` (migrate the stuck warning to the store).
- The notification store is the seam every future message surface should use.
</code_context>

<specifics>
## Specific Ideas

- Owner's system-wide requirement, verbatim intent: "no warning messages or errors that get 'stuck' on
  the screen … Allow us to dismiss errors, warnings, etc." — the monitor warning is the canonical case:
  it must auto-clear once monitors are configured AND be manually dismissible.
- Church switcher lives in the **user menu** (owner's explicit choice), not Settings.
</specifics>

<deferred>
## Deferred Ideas

- A full audit/migration of every ad-hoc message surface in the app to the new store (beyond the shared
  primitive + the monitor warning) may trail as follow-up if large — note any surfaces left.
- Rehearsal/storage cluster — deferred out of the whole milestone (SEED-003 / backlog 999.13).
</deferred>
