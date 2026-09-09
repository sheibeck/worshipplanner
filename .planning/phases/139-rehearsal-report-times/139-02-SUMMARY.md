# Plan 139-02 Summary — Rehearsal & Report Times: Editor UI, Settings Defaults & Display

**Status:** COMPLETE (implementation committed; SUMMARY reconstructed by orchestrator after the executor
hit a mid-run session rate-limit — all three task commits landed with a clean working tree, and the
orchestrator re-ran the full gate to confirm before closing out).

**Wave:** 2 (depends on 139-01 foundation) · **Tasks:** 3/3 · **Autonomous**

## Commits
- `932ad405` — feat(139-02): service-editor Times subsection + Settings rehearsal/report defaults
- `e3f94df0` — feat(139-02): rehearsal/report-time display on My Schedule, share, and volunteer views
- `02a0dd2d` — feat(139-02): rehearsal/report-time display on services-list card + dashboard

## What was built
- **Editor "Times" subsection** (`src/views/ServiceEditorView.vue`, +152) — add/edit/remove multiple dated
  rehearsals (native date + time inputs) + a single day-of report-time input, gated by `canEditService`,
  persisted via the existing debounced-autosave path.
- **Settings "Rehearsal & Report Defaults"** (`src/views/SettingsView.vue`, +138; `SettingsView.test.ts`,
  +58) — org-level default rehearsal time(s) + default report time, saved through the existing
  `updateOrgSettings` handler (mirrors the Messaging-defaults card). Copied onto new services by 139-01's
  `createService`.
- **Display everywhere the date shows**, using 139-01's shared `formatWallClockTime` + `sortRehearsals`
  (chronological; undated rehearsals hidden from read-only surfaces):
  - `src/components/ScheduleServiceCard.vue` (+40) + `ScheduleServiceCard.test.ts` (+48) — threaded through
    its 3 `MyScheduleView.vue` call sites (+6).
  - `src/components/ServiceCard.vue` (+34) and `src/views/DashboardView.vue` (+32) — live-`Service` reads with
    an undefined-guard before formatting (per the plan-checker warning) and client-side dated-filter/sort.
  - `src/views/ShareView.vue` (+33) and `src/views/VolunteerServiceView.vue` (+34) — projection-fed
    (`ServiceSnapshot` / `RehearseAccessDoc`), rendered as-is.

## Requirements
R429 (Settings defaults UI), R430 (multi-rehearsal editor CRUD + display), R431 (report-time input + display),
R433 (display on all 5 read-only surfaces). R432 (copy-not-live-bind) landed in 139-01.

## Verification (orchestrator-run gate, 2026-09-09)
- `npm run type-check` (vue-tsc --build) — **clean**.
- `npx vitest run` (full) — **229/230 files pass**; the only failing file is `src/storage.rules.test.ts`
  (34 Storage-emulator-timeout tests), the documented CLAUDE.md baseline — **no regression** from this plan.
- New/extended component tests (`ScheduleServiceCard.test.ts`, `SettingsView.test.ts`) pass.

## Deferred (batched UAT — v2.15-DEFERRED-VERIFICATION.md)
Cross-surface visual/layout rendering and the org-defaults settings interaction are human/visual UAT items.

## Notes for orchestrator
Implementation + automated verification complete. Proceed to phase code-review / verifier / nyquist /
security gates. (No SUMMARY-vs-commit divergence: the 3 feat commits are the whole plan; only the docs/wrap-up
commit was interrupted, now completed here.)
