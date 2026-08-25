---
quick_id: 260824-org-config-slideout
slug: org-config-slideout
date: 2026-08-24
status: complete
scope: client-only
deploy: firebase deploy --only hosting (owner-run)
gates:
  type_check: pass (vue-tsc --build)
  organizations_tab_tests: 56/56
  deactivate_confirm_dialog_tests: 14/14
  full_app_suite: 4278/4304 (2 known-failing baseline files unchanged — src/storage.rules.test.ts, src/views/__tests__/RosterView.test.ts; no new failures)
---

# Summary — Owner Console org configuration moves into a right-side slideout

Reworked the Owner Console Organizations screen: per-org configuration (AI enablement, Active)
moved into a right-side slideout with checkboxes, and Deactivate is now gated behind a
confirmation dialog. Client-only — no firestore.rules, functions, or deploy changes; every
existing callable is reused unchanged.

## Task Commits

1. **Task 1: DeactivateOrgConfirmDialog + its test** — `d5db3eba`
   (`feat(quick-260824-01): add DeactivateOrgConfirmDialog with reversible-action copy`)
2. **Task 2: OrgConfigDrawer slideout, rework OrganizationsTab, extend its test** — `738c2b85`
   (`feat(quick-260824-02): move org config into a right-side slideout with checkboxes`)

## Files Created/Modified

- `src/components/admin/DeactivateOrgConfirmDialog.vue` — new. Mirrors `DeleteOrgConfirmDialog.vue`'s
  shell (Teleport, backdrop/dialog transitions, `role="dialog"`, hand-rolled focus trap,
  focus-on-Cancel on open, `previouslyFocusedElement` restore, `confirming` guard on every
  dismissal path) but omits the type-to-confirm text input — deactivation is reversible, so a
  plain Confirm/Cancel with clear consequence copy ("members can't log in until reactivated") is
  proportionate. Emits `confirm` (no payload) / `cancel`.
- `src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts` — new, 14 tests.
- `src/components/admin/OrgConfigDrawer.vue` — new. Right-side slideout mirroring
  `AvailabilityDrawer.vue`'s shell (Teleport, backdrop + panel `Transition`, right-side panel
  layout) and `EditSlideDrawer.vue`'s Escape/focus handling (remember `document.activeElement` on
  open, focus the panel via `tabindex="-1"` after `nextTick`, restore + remove the `window`
  keydown listener on close/unmount). Purely presentational: props carry `org`, in-flight flags,
  and error/feedback strings; emits `close` / `toggle-ai` / `request-deactivate` / `reactivate`
  with no payloads — the parent derives intent from current state. AI and Active are one-way
  checkboxes (`:checked` + `@change`, never `v-model`).
- `src/components/admin/OrganizationsTab.vue` — reworked. Row Actions cell lost its
  Enable/Disable AI and Deactivate/Reactivate buttons; gained a single "Configure" button that
  sets `configOrgId`. Added `configOrg` as a **computed** lookup into `orgs.value` by id (not a
  captured snapshot) so the open drawer reflects state after `refreshOrgs()` without needing to be
  reopened. Added `deactivateDialogOrg`, `closeDeactivateDialog()`, `onConfirmDeactivate()`.
  `onToggleActive`/`onToggleAi` are unchanged — only their triggers moved from row buttons into the
  drawer's emitted events. Assign admin, Enter church, and Delete (still deactivated-only) remain
  per-row actions. Per-row `toggleError`/`toggleFeedback`/`aiToggleError` `<p>` displays were
  removed from the row; those flows now surface through the drawer's `activeError` /
  `activeFeedback` / `aiError` props instead.
- `src/components/admin/__tests__/OrganizationsTab.test.ts` — rewrote the AI on/off and
  deactivate/reactivate suites to drive the Configure drawer + checkboxes instead of removed row
  buttons; added a "Configure drawer shell" suite (Configure opens it, backdrop/x/Escape all close
  it). 56 tests total, all passing. The name-keyed `httpsCallable` mock introduces no new callable
  names, preserving the "no direct Firestore writes from this component" proof.

## Decisions Made

- **`OrgConfigDrawer.vue` as a standalone presentational component**, not inline markup — the
  faithful mirror of `AvailabilityDrawer.vue`/`EditSlideDrawer.vue` (both standalone), keeps
  `OrganizationsTab.vue` from ballooning, and keeps every callable + friendly-error handling in the
  tab (mirrors how `DeleteOrgConfirmDialog` is already wired).
- **`configOrg` as a computed lookup, not a captured snapshot** — after a toggle + `refreshOrgs()`,
  the open drawer must reflect the new state without being reopened; deriving it from
  `orgs.value.find(...)` guarantees that.
- **`DeactivateOrgConfirmDialog` has no type-to-confirm input**, unlike `DeleteOrgConfirmDialog` —
  deactivation is reversible (a super-admin can reactivate any time), so a plain Confirm/Cancel with
  clear consequence copy is proportionate; type-to-confirm stays reserved for the irreversible
  Delete.
- **Reactivate applies directly**, no destructive confirmation — reactivating cannot lock anyone
  out.

## Deviations from Plan

None — plan executed exactly as written (both tasks, both `<verify>` gates, plus the full-suite
baseline check from the "Verification (gates)" section).

## Gates

- `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts` — 56 + 14 = 70/70 passing.
- `npm run type-check` (`vue-tsc --build`, full form per CLAUDE.md) — clean.
- Bare `npx vitest run` (full app suite) — 4278/4304 passing; the only 2 failing files are the
  pre-existing known baseline (`src/storage.rules.test.ts` — Storage-emulator `firestore.exists()`
  limitation, and `src/views/__tests__/RosterView.test.ts` — stale assertion). No new failures
  introduced by this change.

## Outstanding

- **Owner redeploy:** `firebase deploy --only hosting --project worship-planner-bc515`
  (client-only; no functions/rules changes in scope).

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (`d5db3eba`, `738c2b85`)
verified present in git history.

## Follow-up fix pass (2026-08-24) — owner testing feedback

Applied a client-only follow-up pass addressing owner UAT feedback on the just-shipped slideout.
Commit: `176274fa`
(`fix(quick-260824): owner testing follow-up for org-config slideout`)

### Fixes applied

1. **Active is now a Deactivate/Reactivate BUTTON, not a checkbox** — `OrgConfigDrawer.vue`.
   The owner's read: deactivate/reactivate is an *action*, not a *setting*. `onActiveChange`
   (checkbox `@change`) became `onActiveClick` (button `@click`) with identical intent-signaling
   logic (deactivating routes through the confirm dialog, reactivating applies directly);
   `onToggleActive`/`setOrgActive` are reused unchanged. AI enablement **stays a checkbox** — it
   is genuinely a setting.
2. **Cancel-state bug fixed by construction** — with no local `:checked` state left behind by a
   button (unlike a checkbox), cancelling the deactivate confirm cannot leave a stuck/out-of-sync
   UI state. Verified with a rewritten test asserting the org stays active and the button still
   reads "Deactivate" after Cancel.
3. **Delete moved into the slideout, deactivated-orgs-only** — removed from the per-row Actions
   cell entirely; added to `OrgConfigDrawer.vue` behind `v-if="!org.active"` (Phase 77's gate).
   The drawer emits `request-delete`; `OrganizationsTab.vue` wires it to the existing
   `openDeleteDialog`/`DeleteOrgConfirmDialog` flow unchanged. Reordered the drawer/dialog
   markup so `OrgConfigDrawer` renders before `DeleteOrgConfirmDialog` (matching the existing
   Deactivate-over-drawer stacking convention) so the confirm dialog paints above an open drawer.
   After a successful delete, `configOrg`'s computed lookup returns `null` once the org drops out
   of the refreshed list, so the drawer auto-closes with no extra wiring.
4. **`>` chevron replaces the "Configure" text button** — `OrganizationsTab.vue`'s row action
   now mirrors `SongTable.vue`'s row-open affordance (`d="M9 5l7 7-7 7"`), icon-only with
   `aria-label="Configure {org name}"` for accessibility.

### Files modified

- `src/components/admin/OrgConfigDrawer.vue` — Active checkbox → button; added the
  deactivated-only Delete section and `request-delete` emit.
- `src/components/admin/OrganizationsTab.vue` — per-row Delete button removed; "Configure" text
  button replaced with an aria-labeled `>` chevron; `OrgConfigDrawer`'s `@request-delete` wired to
  the existing `openDeleteDialog`; reordered the drawer/dialog block for correct stacking.
- `src/components/admin/__tests__/OrganizationsTab.test.ts` — rewrote the `openConfigDrawer`
  helper and all affected suites (deactivate/reactivate, Configure drawer shell, delete) to target
  the button/chevron instead of the removed checkbox/text button; delete tests now open the drawer
  first, then click the drawer's own Delete button.

### Gates

- `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts src/components/admin/__tests__/DeleteOrgConfirmDialog.test.ts` —
  87/87 passing (57 + 14 + 16).
- `npm run type-check` (`vue-tsc --build`) — clean.
- Bare `npx vitest run` (full app suite) — 4286/4312 passing; the only 2 failing files are the
  documented known-failing baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`).
  No new failures introduced.

### Deviations from instructions

None — all four fixes applied exactly as specified; no architectural changes, no rules/functions
changes, no callable signature changes.

### Self-Check: PASSED

All modified files verified present on disk; commit `176274fa` verified present in git history.

## Second follow-up pass (2026-08-25) — full SongTable-style row + drawer relocation

Owner testing feedback continued: the row still carried Assign admin, Configure (chevron), and
Enter church side by side. This pass makes the Organizations table match `SongTable.vue`'s pattern
exactly — the row is now data-only, a trailing right-aligned `>` chevron sits at the end of the
row, the whole row is clickable to open the slideout, and **every** per-org action (Assign admin,
Enter church, AI, Deactivate/Reactivate, Delete) lives inside `OrgConfigDrawer.vue`.
Commit: `7ec35cff` (`fix(quick-260824): move Assign admin + Enter church into the org config drawer`)

### Changes applied

1. **Table row is now data-only + trailing chevron** — `OrganizationsTab.vue`. Removed the entire
   Actions column (`<th>Actions</th>` + its `<td>` holding the Assign-admin inline form,
   Configure button, and Enter-church button). Columns are now Church | Org ID | Created |
   Members | trailing chevron. Added a trailing `<th class="px-4 py-3 w-8"><span
   class="sr-only">Configure</span></th>` and a matching trailing `<td class="px-4 py-3
   text-right">` per row holding the `>` chevron (SongTable's `d="M9 5l7 7-7 7"` icon, gray-500,
   `h-4 w-4`). The chevron stays an icon-only `aria-label="Configure {org name}"` button (so the
   existing aria-label-based test query keeps working) with `@click.stop`. The whole `<tr>` is now
   clickable (`@click="configOrgId = org.orgId"`, `cursor-pointer` class), mirroring SongTable's
   `@click="$emit('select', song)"` row pattern. Empty-state colspan stays `5` (unchanged column
   count).
2. **Assign admin moved into `OrgConfigDrawer.vue`** — new "Admin access" section, presentational:
   collapsed state shows an "Assign admin" trigger button (emits `start-assign`); expanded state
   shows the email input (`:value="assignEmail"` + `@input` emits `update:assign-email`, one-way —
   never `v-model`, matching the AI/Active sections' established convention) plus Assign (emits
   `confirm-assign`, disabled while `isAssigning`) and Cancel assign (emits `cancel-assign`)
   buttons; renders `assignError`/`assignFeedback` props. `OrganizationsTab.vue` still owns
   `assigningOrgId`/`assignEmail`/`isAssigning`/`assignError`/`assignFeedback` and the unchanged
   `startAssign`/`onConfirmAssign`/`cancelAssign` handlers — only the markup and its
   emit-driven triggers moved.
3. **Enter church moved into `OrgConfigDrawer.vue`** — new "Enter as this church" section with a
   single button (`data-testid="org-config-enter-church-button"` — queried by testid rather than
   text since the label flips to "Entering..."), disabled via `enterDisabled` prop (covers both
   "this org is entering" and "a different org is entering", preserving the old row button's
   cross-row double-submit guard), emits `enter-church`. `OrganizationsTab.vue` still owns
   `enteringOrgId`/`enterError` and the unchanged `onEnterChurch` handler.
4. **Drawer-close now resets in-progress assign state** — added `onCloseDrawer()` in
   `OrganizationsTab.vue` (`configOrgId = null; cancelAssign()`), wired to the drawer's `@close`.
   Without this, closing the drawer mid-assign-form and reopening it (even for a different org)
   would show a stale expanded email input — a Rule 1 bug caught while building this feature, not
   part of the original directives.
5. **New drawer props/emits**: `assigning`, `assignEmail`, `isAssigning`, `assignError`,
   `assignFeedback`, `entering`, `enterDisabled`, `enterError` (props); `start-assign`,
   `cancel-assign`, `update:assign-email`, `confirm-assign`, `enter-church` (emits). All additive —
   no existing prop/emit renamed or removed.

### Files modified

- `src/components/admin/OrganizationsTab.vue` — table template reworked (data-only row + trailing
  chevron, whole-row click); removed the Actions column entirely; added `onCloseDrawer()`; wired
  8 new drawer props + 5 new drawer emits reusing existing state/handlers unchanged.
- `src/components/admin/OrgConfigDrawer.vue` — added the "Admin access" (Assign admin) and "Enter
  as this church" sections between Active and Delete; added the corresponding props/emits.
- `src/components/admin/__tests__/OrganizationsTab.test.ts` — rewrote every suite that used to
  interact with row-level Assign admin / Enter church buttons directly to open the drawer first
  (`openConfigDrawer` helper, unchanged since it already targeted the aria-labeled chevron); added
  a whole-row-click test, a "drawer surfaces Assign admin/Enter church" test, and a
  close-resets-assign-state regression test. 60 tests total (was 57), all passing.
- `src/components/admin/__tests__/OrgConfigDrawer.test.ts` — **new** (the drawer's first standalone
  test file; previously only exercised indirectly via OrganizationsTab.test.ts). 25 tests covering
  shell/focus, AI checkbox, Active button, the new Assign admin section, the new Enter church
  section, and Delete — all presentational prop-in/event-out assertions, no callables.

### Deviations from instructions

- **[Rule 1 - Bug] Drawer close now resets the in-progress assign form.** Not explicitly requested,
  but without it, closing mid-assign and reopening (same or different org) showed a stale expanded
  email input. Fixed via `onCloseDrawer()` calling the existing `cancelAssign()`; covered by a new
  regression test.

No other deviations — the row-to-drawer relocation, chevron placement, and whole-row click all
follow the SongTable.vue reference pattern and the task's directives exactly; every existing
callable (`assignOrgAdmin`, `onEnterChurch`/`enterOrgAsSuperAdmin`, `setOrgAiEnabled`,
`setOrgActive`, `deleteOrganization`) is reused unchanged.

### Gates

- `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts
  src/components/admin/__tests__/OrgConfigDrawer.test.ts
  src/components/admin/__tests__/DeactivateOrgConfirmDialog.test.ts
  src/components/admin/__tests__/DeleteOrgConfirmDialog.test.ts` — 115/115 passing
  (60 + 25 + 14 + 16).
- `npm run type-check` (`vue-tsc --build`, full form per CLAUDE.md) — clean.
- Bare `npx vitest run` (full app suite) — 4314/4340 passing; the only 2 failing files are the
  documented known-failing baseline (`src/storage.rules.test.ts` — Storage-emulator
  `firestore.exists()` limitation, and `src/views/__tests__/RosterView.test.ts` — stale assertion),
  same 26 failing tests as the prior baseline (4286/4312). No new failures; the +28 new passing
  tests are this pass's additions (3 in OrganizationsTab.test.ts, 25 in the new
  OrgConfigDrawer.test.ts).

### Self-Check: PASSED

All modified/created files verified present on disk; commit `7ec35cff` verified present in git
history.
