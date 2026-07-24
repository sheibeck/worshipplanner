---
phase: 13-volunteer-scheduling-import-servers-from-planning-center-col
plan: 10
subsystem: volunteer-scheduling-output
tags: [print, public-share, share-token, light-theme, vue, firestore]
requires:
  - quarters.finalizeAndShare (Plan 06)
  - quarterSnapshot shape (Plan 06)
  - QuarterView grid + hasAssignments (Plan 09)
provides:
  - RosterPrintLayout.vue (print-only light-theme roster)
  - QuarterShareView.vue (public read-only quarter share)
  - /quarter-share/:token public route
  - QuarterView Finalize & Share + Print wiring
affects:
  - src/router/index.ts
  - src/views/QuarterView.vue
tech-stack:
  added: []
  patterns:
    - ServicePrintLayout print-only wrapper (hidden print:block, break-inside-avoid)
    - ShareView public token-load (getDoc shareTokens/{token}, notFound/loading)
    - services.ts share-URL + copy-to-clipboard UI
key-files:
  created:
    - src/components/RosterPrintLayout.vue
    - src/views/QuarterShareView.vue
  modified:
    - src/views/QuarterView.vue
    - src/router/index.ts
decisions:
  - Print/public surfaces use the light palette (bg-white text-gray-900) — deliberate existing exception to the dark app theme (D-24, UI-SPEC)
  - QuarterShareView reads ONLY the self-contained quarterSnapshot (names pre-resolved) and imports no roster/auth store, so it cannot touch org-scoped PII (T-13-10-02/03)
  - shareUrl reflects an already-finalized quarter's shareToken via an immediate watch on selectedQuarter, so switching back to a finalized quarter re-surfaces its link
  - No email-sending code added anywhere; availability collection stays external (D-25)
metrics:
  duration: ~15min
  completed: 2026-07-08
---

# Phase 13 Plan 10: Output Surfaces (Print Roster + Public Share) Summary

Printable light-theme volunteer roster and an auth-free public read-only quarter share link, wired into QuarterView via Print and Finalize & Share actions, reusing the existing ServicePrintLayout/ShareView patterns; no emails are sent (D-24, D-25).

## What Was Built

- **`src/components/RosterPrintLayout.vue`** — a `hidden print:block bg-white text-gray-900 font-sans text-sm p-8` print-only component mirroring `ServicePrintLayout.vue`. Renders a quarter-label header, then one `break-inside-avoid` block per service date (long weekday + date heading) listing each Band/Tech/Other-ordered role → assigned person names (resolved via the roster store), with `[not assigned]` for empty cells. Section labels use `text-xs text-gray-500 uppercase tracking-wider`.
- **`src/views/QuarterShareView.vue`** — a public read-only view mirroring `ShareView.vue`. On mount it reads `route.params.token`, `getDoc(doc(db,'shareTokens',token))`, sets `notFound` when missing, else renders `quarterSnapshot` (label header + each service date → roles → pre-resolved person names) in the light public theme with loading/not-found states. It imports **no** roster/auth store — the snapshot already carries names, so no org-scoped PII collection is ever touched.
- **`src/router/index.ts`** — registered the public `/quarter-share/:token` route (name `quarter-share`) with no `meta`/`requiresAuth`, matching `/share/:token`.
- **`src/views/QuarterView.vue`** — wrapped the on-screen content in `print:hidden` and mounted `<RosterPrintLayout>` outside it (visible only when printing). Added a "Print" button calling `window.print()`, and a "Finalize & Share" button calling `quartersStore.finalizeAndShare()` that displays the resulting `/quarter-share/{token}` URL in a banner with a copy-to-clipboard action. An immediate `watch` on `selectedQuarter` re-surfaces an already-finalized quarter's share link on quarter switch.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vue-tsc --build` clean for all four files (whole-project build passed with no errors).
- RosterPrintLayout uses `hidden print:block` + `bg-white` + `break-inside-avoid`; no `bg-gray-9*` dark-palette classes inside the print wrapper.
- `/quarter-share/:token` route has no `requiresAuth`/`meta` (public).
- QuarterShareView contains no `useRosterStore`/`useAuthStore` imports (grep exit 1 = no matches).
- "Finalize & Share" string present; `finalizeAndShare` called with a copyable `/quarter-share/{token}` URL.
- No `sendmail`/`smtp`/`nodemailer`/`sendEmail` across the four files (count == 0, D-25).

## Checkpoint

Task 3 (human-verify: print output + public share link) — **auto-approved**. The coordinator accepted the implementation and skipped manual browser verification. Dev server was started at http://localhost:5173/ for optional verification.

## Threat Surface

No new trust boundaries beyond the plan's threat model. The public share surface reads only the self-contained `quarterSnapshot` (names + roles + calendar), never the roster/quarter PII collections (T-13-10-02), and the view imports no org-scoped store so it cannot read protected collections even if a snapshot field is missing (T-13-10-03). The `shareTokens` Firestore rule is unchanged and already covers public single-token read.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/components/RosterPrintLayout.vue
- FOUND: src/views/QuarterShareView.vue
- FOUND commit: 8a58da5 (Task 1)
- FOUND commit: 4b2f66e (Task 2)
