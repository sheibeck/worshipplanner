---
phase: 119-architecture-correctness-batching-store-ownership-fixes
verified: 2026-09-05T05:00:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 119: Architecture — Correctness, Batching & Store-Ownership Fixes Verification Report

**Phase Goal:** The nine self-contained architecture findings that don't require touching module
boundaries are fixed — failure isolation, batched writes, a de-duplicated subscription, dead-code
removal, defense-in-depth store teardown, reactive re-subscription, store-mediated writes/reads,
and a tested autosave/reorder-save coordination window.
**Verified:** 2026-09-05
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `recomputeLastUsedFor`'s per-song loop isolates failures; failed id(s) logged (R349) | ✓ VERIFIED | `src/stores/services.ts:482-502` — each `songStore.updateSong` call wrapped in its own try/catch, failures pushed to `failedSongIds` and logged via `console.error` after the loop finishes; test `src/stores/__tests__/services.test.ts` (2 R349 references) proves a mid-loop rejection does not abort the rest |
| 2 | `upsertSongs` writeBatch-chunked like `importSongs` + per-song success/failure surfaced in the import UI (R350) | ✓ VERIFIED | `src/stores/songs.ts:350-465` — `CHUNK = 499`, chunks via `writeBatch(db)`, each `batch.commit()` wrapped in try/catch (failures pushed to `summary.failed`, do not abort later chunks), returns `{added, updated, failed}`; `PcImportModal.vue` `done` step renders added/updated/failed counts + failed titles (lines 143-149); test files confirm (`songs.test.ts`, `PcImportModal.test.ts`, 7 tests) |
| 3 | `useSlideshowAssembly`'s default lyrics subscriber shares a query function with `songLyricsStore.subscribeLyrics` (no `limit(1)` drift) (R351) | ✓ VERIFIED | `src/stores/songLyrics.ts:36-43` exports `lyricsQuery(orgId, songId, limitCount?)`; `subscribeLyrics` calls it unbounded (line 68); `useSlideshowAssembly.ts:44-54`'s `defaultLyricsSubscriber` calls the SAME function (imported from `@/stores/songLyrics`) with `limitCount: 1`, taking `docs[0]` — one shared query builder, no independent inline query left in the composable |
| 4 | `reopenPcWarning` dead branch fixed-or-removed (R352) | ✓ VERIFIED | `src/views/ServiceEditorView.vue:2200-2203` — computed reduced to a single accurate sentence; the `pcExportedAt` read, `toDate` guard, `when` variable, and date-formatted return are gone; confirmed unreachable because all 4 `localService.value =` sites round-trip through `JSON.parse(JSON.stringify(...))` (per 119-REVIEW.md's independent trace) |
| 5 | `ServicesView.vue` org-switch watcher tears down `teamsStore` locally (R353) | ✓ VERIFIED | `src/views/ServicesView.vue:364-407` — `stopTeamsSeedWatch` hoisted to component scope; the org-switch watcher and `onUnmounted` both call `teamsStore.unsubscribeAll()` and stop+null the retained seed watch, matching RosterView/DashboardView/TeamView |
| 6 | `SongLyricEditor` + `ScriptureSlideEditor` reactively re-subscribe on org-prop change (R354) | ✓ VERIFIED | `SongLyricEditor.vue:~995-1007` — `watch([() => props.orgId, () => props.songId], () => { unsubscribeLyrics(); subscribeLyrics(...) }, {immediate:true})` replaces the old one-shot `onMounted`; `ScriptureSlideEditor.vue:230-240` — same idiom via `watch(() => props.orgId, ...)` driving `subscribeReadings` |
| 7 | `ServiceTemplateEditor` writes through a new auth-store method, not direct `updateDoc` (R355) | ✓ VERIFIED | `src/stores/auth.ts:420-442` exports `updateOrgSettings(patch)` (updateDoc + local dot-path mirror-write in one call, guarded on `orgId`+`isEditor`); `ServiceTemplateEditor.vue`'s `onSave` calls it and no longer imports `doc`/`updateDoc`/`db` (per 119-02-SUMMARY.md, confirmed by review) |
| 8 | `GettingStarted` member-count + `ConfigurationTab` super-admins listeners each owned by a store (R356) | ✓ VERIFIED | `src/stores/members.ts` (org-scoped, registered in `orgScopedStores.ts:12,38`) and `src/stores/superAdmins.ts` (global, deliberately NOT registered there) both exist; `GettingStarted.vue:85,119-127,152` drives `membersStore.subscribe`/`unsubscribeAll` and reads `membersStore.memberCount`; `ConfigurationTab.vue:159,284,292` drives `superAdminsStore.subscribe`/`unsubscribe` and reads `superAdminsStore.superAdmins`/`.loaded` |
| 9 | A regression test proves a remote snapshot during an in-flight reorder save is handled safely (R357) | ✓ VERIFIED | `src/views/__tests__/ServiceEditorView.test.ts:8113-8141+` — test `"a differing remote snapshot arriving during an in-flight reorder-save does not clobber it — no stale overwrite, no lost edit (R357/ARCH-013)"` holds `updateService` pending, injects a non-echo remote snapshot mid-flight, resolves the write, asserts the reordered slots survive; test passes (confirmed by full-suite run) |

**Score:** 9/9 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/services.ts` | per-item failure isolation in `recomputeLastUsedFor` | ✓ VERIFIED | present, substantive, wired (called from `markAsPlanned`/`reopenService`) |
| `src/stores/songs.ts` | batched `upsertSongs` returning summary | ✓ VERIFIED | present, substantive, wired (called from `PcImportModal.onConfirmImport`) |
| `src/components/PcImportModal.vue` | per-song feedback UI | ✓ VERIFIED | present, substantive, wired; also carries the MD-01 total-failure→error-step fix |
| `src/composables/useSlideshowAssembly.ts` | shared `lyricsQuery` consumer | ✓ VERIFIED | present, substantive, wired |
| `src/stores/songLyrics.ts` | exported `lyricsQuery()` | ✓ VERIFIED | present, substantive, wired (both call sites use it) |
| `src/stores/auth.ts` | `updateOrgSettings` mutation | ✓ VERIFIED | present, substantive, wired; carries the MD-02 missing-intermediate fix |
| `src/components/settings/ServiceTemplateEditor.vue` | writes through the store method | ✓ VERIFIED | present, substantive, wired |
| `src/stores/members.ts` | org-scoped member-count store | ✓ VERIFIED | present, substantive, wired into `orgScopedStores.ts` + `GettingStarted.vue` |
| `src/stores/superAdmins.ts` | global super-admins store | ✓ VERIFIED | present, substantive, wired into `ConfigurationTab.vue`; carries the LW-02 unsubscribe-first-guard + state-reset fix |
| `src/views/ServicesView.vue` | local `teamsStore` teardown | ✓ VERIFIED | present, substantive, wired |
| `src/components/SongLyricEditor.vue` | reactive re-subscribe | ✓ VERIFIED | present, substantive, wired |
| `src/components/ScriptureSlideEditor.vue` | reactive re-subscribe | ✓ VERIFIED | present, substantive, wired |
| `src/views/ServiceEditorView.vue` | trimmed `reopenPcWarning` + R357 test target | ✓ VERIFIED | present, substantive; monolith otherwise untouched per plan scope |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `PcImportModal.onConfirmImport` | `upsertSongs()` returned summary | `importSummary.value = await songStore.upsertSongs(...)` | ✓ WIRED | consumed on `done` step + the MD-01 error-routing branch |
| `defaultLyricsSubscriber` | `songLyricsStore.lyricsQuery` | direct import + call with `limitCount:1` | ✓ WIRED | confirmed both call sites import from `@/stores/songLyrics` |
| `authStore.updateOrgSettings` | `ServiceTemplateEditor.onSave` | direct call, patch object | ✓ WIRED | confirmed no more `updateDoc`/`db` import in the component |
| `resetOrgScopedStores()` | `useMembersStore().unsubscribeAll()` | direct call | ✓ WIRED | `orgScopedStores.ts:38` |
| `GettingStarted` | `membersStore.memberCount` | `watch(() => authStore.orgId, ..., {immediate:true})` | ✓ WIRED | `GettingStarted.vue:119-127,152` |
| `ConfigurationTab` | `superAdminsStore.superAdmins`/`.loaded` | `onMounted`/`onUnmounted` subscribe/unsubscribe | ✓ WIRED | `ConfigurationTab.vue:159,284,292` |
| `ServicesView` org-switch watcher | `teamsStore.unsubscribeAll()` | direct call | ✓ WIRED | `ServicesView.vue:397,407` |
| `SongLyricEditor`/`ScriptureSlideEditor` | store subscribe/unsubscribe | `watch(() => props.orgId, ..., {immediate:true})` | ✓ WIRED | confirmed both components |
| reorder-save path | remote-merge watcher | proven safe by test | ✓ WIRED | R357 test passes |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R349 | 119-01 | per-item failure isolation | ✓ SATISFIED | services.ts + test |
| R350 | 119-01 | batched PC import + UI feedback | ✓ SATISFIED | songs.ts + PcImportModal.vue + tests |
| R351 | 119-01 | shared lyrics query, no limit(1) drift | ✓ SATISFIED | songLyrics.ts + useSlideshowAssembly.ts + tests |
| R352 | 119-04 | reopenPcWarning dead branch fixed | ✓ SATISFIED | ServiceEditorView.vue + test |
| R353 | 119-03 | ServicesView teamsStore local teardown | ✓ SATISFIED | ServicesView.vue + test |
| R354 | 119-03 | SongLyricEditor/ScriptureSlideEditor reactive re-subscribe | ✓ SATISFIED | both components + tests |
| R355 | 119-02 | ServiceTemplateEditor writes through auth-store method | ✓ SATISFIED | auth.ts + ServiceTemplateEditor.vue + tests |
| R356 | 119-02 | GettingStarted/ConfigurationTab listeners store-owned | ✓ SATISFIED | members.ts + superAdmins.ts + both components + tests |
| R357 | 119-04 | regression test for reorder-save/remote-snapshot window | ✓ SATISFIED | ServiceEditorView.test.ts |

No orphaned requirements — R349-R357 are all claimed by exactly one of the four 119 plans, matching ROADMAP.md's phase scope.

### Code Review Findings — Fix Confirmation

The 119-REVIEW.md deep review (17 files, 0 Critical/0 High, 2 Medium + 4 Low) reported the phase's
success paths as behavior-preserving, with 6 residual findings. All 6 have dedicated fix commits,
verified present in the current source:

| Finding | Fix Commit | Verified In Source |
|---------|-----------|---------------------|
| MD-01 (total-import-failure shows green success) | `3013d4de` | `PcImportModal.vue:322-333` — `onConfirmImport` now branches to `step.value = 'error'` when `wrote === 0 && failed.length > 0` |
| MD-02 (dot-path mirror-write wrong-level on missing intermediate) | `5250b16e` | `auth.ts:427-440` — creates the missing intermediate object instead of falling through |
| LW-01 (dropped `limit(1)`, unbounded live listener) | `46467d87` | `songLyrics.ts:36-43` — `lyricsQuery` grows optional `limitCount`; `useSlideshowAssembly.ts:49` passes `1` |
| LW-02 (`superAdmins` store missing unsubscribe-first guard + no state reset) | `aa4461d3` | `superAdmins.ts:32-33,61-62` — guard + reset added |
| LW-03 (no test locking in the all-or-nothing partial-chunk-failure tradeoff) | `1d772ce3` | new mixed add/update partial-failure test added to `songs.test.ts` |
| LW-04 (newOnly mode can mislabel a real update as "skipped") | `3013d4de` (same commit as MD-01) | `PcImportModal.vue:144` — surfaces `importSummary.updated` alongside the skipped count |

All 6 findings resolved; no outstanding review debt.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers introduced in any of the 15 files
touched by this phase's 4 plans + the 5 review-fix commits. No stub returns, no hardcoded empty
props, no console.log-only implementations found in the changed surfaces.

### Behavioral Spot-Checks / Test Suite

- **`npx vitest run`** (full app suite, per CLAUDE.md's documented convention): **189/190 test files
  passed, 5126/5153 tests passed (27 skipped)**. The single failing file is
  `src/storage.rules.test.ts` — the documented, accepted baseline failure (Storage-emulator
  `firestore.exists()` cross-service limitation, unrelated to this phase; see CLAUDE.md's
  "Known-failing baseline" section). No other file regressed.
- **`npm run type-check`** (`vue-tsc --build`, typechecks test files too): clean, no output, exit 0.
- All requirement-tagged unit tests confirmed present by grep across every file this phase's plans
  declared as modified: `services.test.ts`, `songs.test.ts`, `PcImportModal.test.ts`,
  `useSlideshowAssembly.test.ts`, `songLyrics.test.ts`, `ServicesView.test.ts`,
  `SongLyricEditor.test.ts`, `ScriptureSlideEditor.test.ts`, `auth.test.ts`, `members.test.ts`,
  `superAdmins.test.ts`, `ServiceEditorView.test.ts`.

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` conventions or declarations for this phase; no
migration/CLI-tooling surface.

### Human Verification Required

None. This phase is fully code/test-verifiable per the task's own framing — every one of the 9
success criteria traces to a concrete source-code change plus a concrete passing regression test,
and the full app suite + type-check confirm no regression beyond the pre-existing, documented
`storage.rules.test.ts` baseline.

### Gaps Summary

None. All 9 ROADMAP success criteria are TRUE in the current codebase, all 9 requirements
(R349-R357) are satisfied, and all 6 code-review findings (2 Medium + 4 Low) have confirmed fix
commits present in source. `npx vitest run` and `npm run type-check` are both green against the
documented baseline.

---

_Verified: 2026-09-05_
_Verifier: Claude (gsd-verifier)_
