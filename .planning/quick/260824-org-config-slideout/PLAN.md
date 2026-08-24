---
phase: quick-260824-org-config-slideout
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/admin/DeactivateOrgConfirmDialog.vue
  - src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts
  - src/components/admin/OrgConfigDrawer.vue
  - src/components/admin/OrganizationsTab.vue
  - src/components/admin/__tests__/OrganizationsTab.test.ts
autonomous: true
requirements:
  - QUICK-260824-ORG-CONFIG-SLIDEOUT
must_haves:
  truths:
    - "The Owner Console org row no longer shows Enable/Disable AI or Deactivate/Reactivate buttons; it shows a single Configure entry point instead."
    - "Clicking Configure opens a right-side slideout for THAT org, with backdrop, close (x), Escape, and focus handling matching the app's existing drawer."
    - "Inside the slideout, AI enablement and Active are CHECKBOXES (checked = on) that reflect the org's current state and show in-flight/disabled + error states."
    - "Unchecking Active (deactivating) opens a confirmation dialog warning that members can't log in until reactivated; the org is only deactivated on confirm."
    - "Re-checking Active (reactivating) applies directly with no destructive confirmation."
    - "Assign admin, Enter church, and Delete remain per-row actions; the row is visibly less crowded."
  artifacts:
    - src/components/admin/DeactivateOrgConfirmDialog.vue
    - src/components/admin/OrgConfigDrawer.vue
    - src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts
  key_links:
    - "OrgConfigDrawer AI checkbox @change -> OrganizationsTab.onToggleAi(org) -> setOrgAiEnabled callable (unchanged, still UNDEPLOYED, friendly-error path kept)."
    - "OrgConfigDrawer Active checkbox @change (deactivate) -> request-deactivate -> DeactivateOrgConfirmDialog -> onConfirmDeactivate -> onToggleActive(org) -> setOrgActive callable."
    - "configOrg is a computed lookup into orgs.value by configOrgId, so after refreshOrgs() the open drawer's checkboxes reflect the just-changed state without closing."
---

# Quick Task: Owner Console org configuration moves into a right-side slideout (checkboxes + deactivate confirm)

**Date:** 2026-08-24
**Type:** Client-only UI rework (no firestore.rules / functions / deploy changes; reuses existing callables)

## Problem

`src/components/admin/OrganizationsTab.vue`'s per-row Actions cell is crowded: Assign admin,
Deactivate/Reactivate, Enable/Disable AI, Enter church, and (for deactivated orgs) Delete all sit
side by side. The lifecycle/config toggles are hard to read as buttons, and Deactivate — which blocks
every member of a church from logging in — fires immediately with no confirmation.

## Directives

1. Move per-org CONFIGURATION into a right-side SLIDEOUT that mirrors the app's established drawer
   pattern (`AvailabilityDrawer.vue` / `EditSlideDrawer.vue`). Do NOT invent a new drawer style.
2. Present configuration as CHECKBOXES, not toggle buttons.
3. AI enablement checkbox reuses the SAME `setOrgAiEnabled` callable (Phase 82) — do not change the
   callable or its undeployed status; keep the friendly-error handling.
4. Active/Deactivate moves into the slideout. DEACTIVATE must confirm first (new
   `DeactivateOrgConfirmDialog.vue`); REACTIVATE applies directly.
5. Keep Assign admin, Enter church, and Delete as per-row actions.

## Established patterns to mirror (already read)

- **Right-side drawer shell:** `AvailabilityDrawer.vue` — `Teleport` to body; backdrop `Transition`
  (`fixed inset-0 z-40 bg-black/60`, `@click` closes); panel `Transition`
  (`translate-x-full` -> `translate-x-0`) on `fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg
  bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col`; header with title + `x` close button;
  scrollable body.
- **Escape + focus handling:** `EditSlideDrawer.vue` — a `window` `keydown` listener that closes on
  `Escape`; on open, remember `document.activeElement`, `await nextTick()`, then focus the panel
  (`tabindex="-1"`); on close/unmount remove the listener and restore focus.
- **One-way checkbox binding (never `v-model`):** `AvailabilityDrawer.vue` Roles checklist and
  `EditSlideDrawer.vue` audio-loop row both use `:checked="…"` + `@change="handler"` where the handler
  derives the next value from current state. Checkbox classes:
  `rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900`.
- **Confirm dialog shell:** `DeleteOrgConfirmDialog.vue` — `Teleport`; backdrop `Transition` (`.z-40`);
  centered dialog `Transition` (opacity/scale); `role="dialog"` `aria-modal` `aria-labelledby`/
  `aria-describedby` via `useId`; hand-rolled focus trap (Escape cancels, Tab cycles the two buttons);
  focus lands on Cancel on open; `previouslyFocusedElement` restored on close; every dismissal path is a
  no-op while `confirming` is true.

## Plan

### Task 1 (create): DeactivateOrgConfirmDialog + its test

**Files:** `src/components/admin/DeactivateOrgConfirmDialog.vue`,
`src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts`

**Action:**
Create `DeactivateOrgConfirmDialog.vue` by mirroring `DeleteOrgConfirmDialog.vue`'s structural shell
verbatim (Teleport + backdrop/dialog Transitions, `role="dialog"`/`aria-modal`/`aria-labelledby`/
`aria-describedby` via `useId`, the hand-rolled focus trap in `onKeydown`, focus-on-Cancel on open,
`previouslyFocusedElement` restore on close, and the `confirming` guard on `onCancel`). Intentionally
DIVERGE from DeleteOrgConfirmDialog in one way — DO NOT include the type-to-confirm text input:
deactivation is reversible, so a single Confirm button suffices. State this divergence in a header
comment referencing DeleteOrgConfirmDialog.

Props: `open: boolean`, `orgName: string`, `memberCount: number`, `confirming: boolean`,
`confirmError: string | null`. Emits: `confirm: []` (NO payload) and `cancel: []`.

Copy: heading names the org and the action, e.g. "Deactivate {orgName}?". Body states the consequence
plainly — deactivating blocks all {memberCount} member(s) of this church from logging in until it is
reactivated, and that it can be reversed by reactivating. Confirm button label "Deactivate" (while
`confirming`: "Deactivating…"), destructive styling (amber/red family, e.g. `bg-red-600 hover:bg-red-500`),
`:disabled="confirming"` only (no name-match gate). Render `confirmError` in a red line when set.
`onConfirm` emits `confirm` (guarded so it is a no-op while `confirming`). `onCancel` emits `cancel`,
gated on `confirming` for backdrop click / `@click.self` / Escape / the Cancel button alike.

Create `DeactivateOrgConfirmDialog.test.ts` mirroring `DeleteOrgConfirmDialog.test.ts`'s conventions
(`mount` with `attachTo: document.body`, the `Teleport` stub, `setTimeout(0)` for nextTick-deferred
focus). Cover: renders nothing when `open` is false; heading names the org; body echoes
`memberCount` and the "can't log in until reactivated" consequence; clicking Confirm (formerly Delete)
emits `confirm` with no payload; Cancel emits `cancel`; backdrop click emits `cancel`; Escape emits
`cancel` and never `confirm`; while `confirming` is true, Cancel/backdrop/Escape all no-op; `confirmError`
renders visibly; focus lands on Cancel on open; focus restores to the previously-focused element on close.

**Verify:**
<verify>
  <automated>npx vitest run src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts</automated>
</verify>

**Done:** `DeactivateOrgConfirmDialog.vue` exists and its test file passes; the dialog has no
type-to-confirm input, warns that members cannot log in until reactivated, emits `confirm`/`cancel`,
and refuses every dismissal path while `confirming`.

### Task 2 (create + modify): OrgConfigDrawer slideout, rework OrganizationsTab, extend its test

**Files:** `src/components/admin/OrgConfigDrawer.vue`,
`src/components/admin/OrganizationsTab.vue`,
`src/components/admin/__tests__/OrganizationsTab.test.ts`

**Action:**

Create `OrgConfigDrawer.vue` as a presentational right-side slideout, copying the drawer shell from
`AvailabilityDrawer.vue` and the Escape+focus handling from `EditSlideDrawer.vue` (see patterns above).
The panel carries `data-testid="org-config-drawer"` and `tabindex="-1"`; the header shows the org name as
title and an `x` close button (`aria-label="Close"`). Reuse the `OrgSummary` shape from
`OrganizationsTab.vue` (define a matching local interface or import a shared type — mirror how the tab
already declares it).

Props: `org: OrgSummary | null` (null = closed; the drawer opens on non-null, mirroring
AvailabilityDrawer's `personId` open-flag), `aiToggling: boolean`, `aiError: string | null`,
`activeToggling: boolean`, `activeError: string | null`, `activeFeedback: string | null`,
`activeFeedbackIsWarning: boolean`. Emits: `close: []`, `toggle-ai: []`, `request-deactivate: []`,
`reactivate: []` (parent derives the desired boolean from current state, so no payloads are needed).

Body — two sections, each using the one-way `:checked` + `@change` checkbox pattern (NEVER `v-model`)
with the checkbox classes named above:
- AI enablement: label such as "Enable AI features"; checkbox `:checked="org.aiMasterEnabled"`
  `:disabled="aiToggling"` `@change` emits `toggle-ai`; `data-testid="org-config-ai-checkbox"`; a short
  helper caption; render `aiError` as a red line when set.
- Active: label "Active"; checkbox `:checked="org.active"` `:disabled="activeToggling"`;
  `data-testid="org-config-active-checkbox"`; `@change` handler emits `request-deactivate` when
  `org.active` is currently true (the user is unchecking to deactivate) and emits `reactivate` when
  `org.active` is currently false (checking to reactivate); helper caption explaining deactivation blocks
  member login until reactivated; render `activeError` as a red line, and `activeFeedback` styled amber
  when `activeFeedbackIsWarning` else green (mirrors the tab's existing toggle-feedback styling).

Rework `OrganizationsTab.vue`:
- Add state `configOrgId = ref<string | null>(null)` and a computed
  `configOrg = computed(() => orgs.value.find((o) => o.orgId === configOrgId.value) ?? null)` so the open
  drawer always reads fresh org state after `refreshOrgs()` (key link — do not pass a captured snapshot).
- Add `deactivateDialogOrg = ref<OrgSummary | null>(null)` plus `closeDeactivateDialog()` (a no-op while
  `togglingOrgId` equals that org's id) and `onConfirmDeactivate()`.
- In the row Actions cell, REMOVE the Deactivate/Reactivate button (the `onToggleActive` trigger) and the
  Enable/Disable AI button (the `onToggleAi` trigger). ADD a single "Configure" button in the secondary
  button family (`bg-gray-800 hover:bg-gray-700`) with a gear or chevron affordance that sets
  `configOrgId = org.orgId`. KEEP Assign admin, Enter church, and Delete (Delete still only for a
  deactivated org). KEEP the "Deactivated" status badge in the Church column (it is status, not an action).
- Move the per-row `<p>` displays for `toggleError`/`toggleFeedback` and `aiToggleError` OUT of the row —
  those flows now live in the drawer, so surface them via the drawer's `activeError`/`activeFeedback`/
  `aiError` props. Keep `assignError`/`assignFeedback`/`enterError` in the row (those actions stay), and
  keep the page-level `deleteFeedback` banner.
- Leave `onToggleActive` and `onToggleAi` UNCHANGED — they remain the sole executors of `setOrgActive`
  and `setOrgAiEnabled` with the existing friendly-error handling, claimFailures warning, and
  `refreshOrgs()`. Only their triggers move.
- Render `<OrgConfigDrawer>` ONCE at component root (outside the `v-for`, next to the existing
  `<DeleteOrgConfirmDialog>`), bound to `:org="configOrg"` and the derived in-flight/error props:
  `:ai-toggling="togglingAiOrgId === configOrg?.orgId"`,
  `:ai-error="configOrg ? (aiToggleError[configOrg.orgId] ?? null) : null"`,
  `:active-toggling="togglingOrgId === configOrg?.orgId"`, and the matching `toggleError`/`toggleFeedback`/
  `toggleFeedbackIsWarning` lookups. Wire `@close="configOrgId = null"`,
  `@toggle-ai="() => configOrg && onToggleAi(configOrg)"`,
  `@reactivate="() => configOrg && onToggleActive(configOrg)"` (direct reactivate), and
  `@request-deactivate="deactivateDialogOrg = configOrg"`.
- Render `<DeactivateOrgConfirmDialog>` ONCE at component root, bound to
  `:open="!!deactivateDialogOrg"`, `:org-name="deactivateDialogOrg?.name ?? ''"`,
  `:member-count="deactivateDialogOrg?.memberCount ?? 0"`,
  `:confirming="togglingOrgId === deactivateDialogOrg?.orgId"`,
  `:confirm-error="deactivateDialogOrg ? (toggleError[deactivateDialogOrg.orgId] ?? null) : null"`,
  `@cancel="closeDeactivateDialog"`, `@confirm="onConfirmDeactivate"`.
- `onConfirmDeactivate()`: guard against re-entry; call `await onToggleActive(deactivateDialogOrg.value)`
  (org is active, so `onToggleActive` issues `setOrgActive({ active: false })`, handles claimFailures,
  refreshes, and sets `toggleError` on failure); after it resolves, if there is no `toggleError` for that
  org id, clear `deactivateDialogOrg` (success closes the dialog; the drawer stays open and its Active
  checkbox re-renders unchecked from the refreshed `configOrg`). On failure, leave the dialog open so its
  `confirmError` shows.

Extend `OrganizationsTab.test.ts` (the global `Teleport` stub already renders teleported content inline,
so the drawer and both dialogs are queryable; the name-keyed `httpsCallable` mock already dispatches
`setOrgActive` and `setOrgAiEnabled`, so NO new callable names are introduced — preserving the
"no direct writes" proof):
- Add a helper that opens the drawer for a row: click the row's "Configure" button, then assert
  `[data-testid="org-config-drawer"]` exists.
- REWRITE the AI on/off suite: instead of row "Enable AI"/"Disable AI" buttons (removed), open the
  Configure drawer, then fire `change` on `[data-testid="org-config-ai-checkbox"]`. Assert the checkbox is
  checked for an org with `aiMasterEnabled: true` and unchecked for `false`; that a change calls
  `setOrgAiEnabled` with `{ orgId, aiEnabled: <derived> }`; that a successful toggle refreshes the list;
  that a second in-flight change fires the callable exactly once; that a rejection surfaces the friendly
  error inside the drawer (via `aiError`) without crashing; and the permission-denied mapping.
- REWRITE the deactivate/reactivate suite: open the Configure drawer, then fire `change` on
  `[data-testid="org-config-active-checkbox"]`. For an ACTIVE org, the change opens
  `DeactivateOrgConfirmDialog` (assert it is found with `orgName`/`memberCount` props) and does NOT call
  `setOrgActive` yet; confirming calls `setOrgActive({ orgId, active: false })` and closes the dialog;
  cancelling calls `setOrgActive` zero times. For a DEACTIVATED org, the change calls
  `setOrgActive({ orgId, active: true })` directly with no confirm dialog. Keep the claimFailures-warning
  and friendly-error assertions, now reading the drawer's `activeFeedback`/`activeError` surfaces.
- Update the badge/label test: keep the "Deactivated" badge assertion; replace the row "Reactivate"
  button assertion with: the drawer's Active checkbox is unchecked for a deactivated org and checked for an
  active org.
- Add drawer-shell tests: each row renders exactly one "Configure" button; clicking it opens the drawer;
  the backdrop click, the `x` close button, and Escape each close it (`org` -> null).

**Verify:**
<verify>
  <automated>npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts && npm run type-check</automated>
</verify>

**Done:** The org row shows Configure + Assign admin + Enter church (+ Delete when deactivated) and no
longer shows AI or Deactivate/Reactivate buttons. Configure opens a right-side slideout with backdrop,
`x`, Escape, and focus handling matching the existing drawer; its AI and Active checkboxes reflect current
state and show in-flight/disabled + error/feedback states. Deactivating routes through
`DeactivateOrgConfirmDialog` before `setOrgActive({ active: false })`; reactivating applies directly.
Both target test files pass and `npm run type-check` (vue-tsc --build) is clean.

## Threat model

Trust boundary: Owner Console (super-admin browser) -> Firebase callables. This task is client-only and
introduces no new boundary; authorization for `setOrgActive`, `setOrgAiEnabled`, `deleteOrganization`,
`assignOrgAdmin`, and `enterOrgAsSuperAdmin` remains enforced server-side by the unchanged callables.

| Threat ID | Category | Component | Severity | Disposition | Mitigation |
|-----------|----------|-----------|----------|-------------|------------|
| T-QCS-01 | Denial of Service | Accidental org deactivation blocks every member's login | high | mitigate | New `DeactivateOrgConfirmDialog` gates deactivate behind an explicit confirm with plain consequence copy; reactivate is reversible and non-destructive. |
| T-QCS-02 | Elevation of Privilege | AI/active toggles from the client | medium | accept | Client only relays existing callables (`setOrgAiEnabled` still UNDEPLOYED; `setOrgActive` deployed); server enforces super-admin authz. No rules/functions change in scope. |
| T-QCS-03 | Tampering | Direct Firestore writes from the tab | low | mitigate | Component remains a pure callable consumer; the test's name-keyed `httpsCallable` mock throws on any unexpected callable, and no new callable names are added. |
| T-QCS-SC | Tampering | npm/pip/cargo installs | n/a | accept | No package installs in this task. |

## Verification (gates)

- `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` — extended for the Configure
  slideout, AI + Active checkboxes, and the deactivate-confirm flow; passes.
- `npx vitest run src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts` — new file; passes.
- `npm run type-check` (`vue-tsc --build`, per CLAUDE.md — typechecks test files too) — clean.
- Full app suite baseline unchanged: bare `npx vitest run` still fails ONLY the known 2-file baseline
  (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`).

## Considered tradeoffs

- **New `OrgConfigDrawer.vue` component vs. inline drawer markup.** A standalone presentational component
  is the faithful mirror of the referenced `AvailabilityDrawer.vue` / `EditSlideDrawer.vue` (both standalone),
  keeps `OrganizationsTab.vue` from ballooning, and keeps the callables + friendly-error handling in the tab
  (matching how `DeleteOrgConfirmDialog` is already wired). The drawer stays dumb; the tab orchestrates.
- **`configOrg` as a computed lookup, not a captured snapshot.** After a toggle + `refreshOrgs()`, the open
  drawer must reflect the new state; deriving `configOrg` from `orgs.value` by id guarantees that without
  reopening.
- **Deactivate confirm has no type-to-confirm input (unlike Delete).** Deactivation is reversible, so a plain
  Confirm/Cancel with clear consequence copy is proportionate; type-to-confirm is reserved for the
  irreversible Delete.
- **Reactivate applies directly.** Reactivating cannot lock anyone out, so it needs no destructive guard.
