---
status: complete
date: 2026-08-23
type: ui-polish
deploy: none (client-only)
commit: b2dc4788
---

# Summary: Consistent side-by-side Organizations-tab row buttons

Owner UI polish on `src/components/admin/OrganizationsTab.vue` (the Organizations
tab row Actions cell). Client-only, no deploy.

## Changes
- **Consistent button styling** — the four row actions (Assign admin,
  Deactivate/Reactivate, Enter church, Delete) were mismatched text-links; now
  they use the app's standard button family: `bg-gray-800 hover:bg-gray-700
  text-gray-200` (secondary) for Assign/Deactivate-Reactivate/Enter, `bg-red-600`
  (destructive) for Delete, `bg-indigo-600` (primary) for the inline Assign
  confirm — all compact `rounded-md px-3 py-1.5 text-xs font-medium`.
- **Side-by-side layout** — `flex flex-col gap-2 sm:flex-row sm:flex-wrap
  sm:items-center`: buttons sit side by side on ≥ sm, stack only on mobile.
- **Delete gated** — the Delete button is now RENDERED only for an
  already-deactivated org (`v-if="org.active === false"`), replacing the prior
  shown-but-`:disabled` behavior.
- Per-row feedback/error lines moved below the button row.

## Verification
- `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` — 40/40
  (updated the Delete-gating test to assert absent-for-active / present-for-deactivated).
- `npm run type-check` (vue-tsc --build) — clean.
