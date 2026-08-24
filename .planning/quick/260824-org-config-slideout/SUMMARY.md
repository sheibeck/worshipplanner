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
