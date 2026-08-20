---
phase: 71
slug: cleanup-deletion-toggle-safety
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
---

# Phase 71 — Validation Strategy

> Per-phase validation contract. Derived from 71-RESEARCH.md §Validation Architecture + 71-UI-SPEC.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (functions)** | Vitest (`functions/`), `cd functions && npm test` |
| **Framework (app)** | Vitest + `@vue/test-utils` (jsdom), `npx vitest run` |
| **Quick run (functions)** | `cd functions && npx vitest run index.test.ts -t "previewCleanupDryRun"` |
| **Quick run (app)** | `npx vitest run src/components/admin/__tests__/CleanupConfigCard.test.ts` |
| **Build gate (REQUIRED)** | `cd functions && npm run build` (functions-standalone tsc) |
| **Type gate** | `npm run type-check` (vue-tsc --build) |
| **Full suites** | `cd functions && npm test` + `npx vitest run` (app baseline = 2 known-failing files) |

---

## Sampling Rate

- **After every task commit:** the relevant quick-run (functions `index.test.ts` or the app card/dialog test).
- **After every wave:** `cd functions && npm run build && npm test`; `npm run type-check && npx vitest run`.
- **Before `/gsd-verify-work`:** functions suite green + functions build clean + type-check clean + app baseline held.

---

## Per-Requirement Verification Map

| Req | Behavior | Type | Command (`-t`) | File | Status |
|-----|----------|------|-----------------|------|--------|
| R188 | `previewCleanupDryRun` returns correct `wouldDeleteCount`/`wouldDeleteBytes` per type (field-map: media/orphanRenders/pptxSources→`deletedObjectCount`, backgrounds→`orphanCount`) | functions unit | `"previewCleanupDryRun"` | ❌ W0 | ⬜ |
| R188 | Rejects a non-super-admin caller (no auth / no token claim / no `superAdmins/{uid}` doc — 3 cases) | functions unit | `"previewCleanupDryRun"` | ❌ W0 | ⬜ |
| R188 | **NEVER deletes** even when `getAppConfig` is mocked with the cleanup flag ENABLED (forced dryRun, load-bearing) | functions unit | `"previewCleanupDryRun"` | ❌ W0 | ⬜ |
| R188 | Invalid `type` → `invalid-argument` (allow-list of 4) | functions unit | `"previewCleanupDryRun"` | ❌ W0 | ⬜ |
| R189 | Enable → callable → dialog echoes count → Confirm calls `saveField('cleanup.{x}Enabled', true)`; Cancel writes nothing | component | `CleanupConfigCard.test.ts` | ❌ W0 | ⬜ |
| R189 | Disable writes `false` immediately with NO preview call | component | `CleanupConfigCard.test.ts` | ❌ W0 | ⬜ |
| R189 | Zero-count preview still opens the dialog and allows confirming (arms cron) | component | `CleanupConfigCard.test.ts` | ❌ W0 | ⬜ |
| R189 | Preview-error + write-error states surface, no flag flipped on error | component | `CleanupConfigCard.test.ts` | ❌ W0 | ⬜ |
| R190 | Existing `cleanupOrphanBackgroundsHandler` tests (references-incomplete/floor-guard/path-guard/tier detection) pass UNCHANGED after `forceDryRun` param added | functions unit (regression) | `"cleanupOrphanBackgroundsHandler"` | ✅ exists (index.test.ts:1315+) — ZERO edits | ⬜ |
| R190 | Backgrounds preview surfaces `referencesComplete:false` via the SAME scan a live run uses | functions unit | `"previewCleanupDryRun.*backgrounds"` | ❌ W0 | ⬜ |
| R190 | Confirm dialog HARD-BLOCKS Confirm when `referencesComplete===false` (no click handler fires) | component | `CleanupEnableConfirmDialog.test.ts` | ❌ W0 | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] New describe block(s) in `functions/src/index.test.ts` for `previewCleanupDryRun` — auth/claim/doc re-checks (3), invalid-`type` (1), per-type dispatch + field-mapping (4), the never-deletes-when-live-enabled case, backgrounds `referencesComplete` pass-through. Reuse the file's existing `mockBucket`/`fakeFile`/`mockBackgroundDb`/`fakeBackgroundFile` helpers.
- [ ] `src/components/admin/__tests__/CleanupConfigCard.test.ts` — extend the Phase 70 file (check `src/components/admin/__tests__/` first): Enable→preview→confirm→`saveField`, Disable-immediate, preview-error/write-error, zero-count dialog.
- [ ] `src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts` — hard-block on `referencesComplete:false`, focus-on-open, Escape-as-Cancel, destructive-red-vs-indigo Confirm color branch.
- [ ] Framework install: none — Vitest + Vue Test Utils already present.

---

## Manual-Only Verifications (deferred to `/gsd-verify-work 71`)

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| Real dry-run count against production Storage/Firestore (a genuine backlog) matches the preview | R188 | Needs deployed functions + real data; unit tests mock Storage/Firestore |
| The full Enable→confirm→next-cron-actually-deletes cycle in production (the owner's button) | R189 | The first real deletion is an owner action, post-deploy |
| Visual pass of the confirm dialog + danger affordance + the referencesComplete hard-block | R188/R190 | Frontend visual review + a real super-admin session |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (real-data preview + production enable + visual are manual-only, disclosed above — not silently skipped)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] `nyquist_compliant: true` set in frontmatter (by validate-phase)

**Approval:** pending
