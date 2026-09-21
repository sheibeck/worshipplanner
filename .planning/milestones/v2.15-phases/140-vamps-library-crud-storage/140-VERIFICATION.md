---
phase: 140-vamps-library-crud-storage
verified: 2026-09-13T17:10:00Z
status: human_needed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open Songs → Vamps tab. Create a vamp (name, key chip, optional tempo), save (drawer stays open), attach a real MP3, confirm it uploads, plays, and downloads; edit name/key/tempo on an existing vamp and save; remove the MP3 then re-attach a different one (replace flow); delete a vamp via the inline confirm; search by vamp name and by key."
    expected: "The Nocturne→gray-950 visual mapping matches Vamps.dc.html Turn-12 (tab bar, flat table, slide-out editor); a real MP3 round-trips through Firebase Storage in a deployed environment (upload, playback, download) — the Storage emulator cannot fully model prod upload/CORS behavior; search filters visually match by name and key."
    why_human: "Visual/layout design-fidelity judgment and a real Storage-backed upload/playback/download round-trip in a deployed environment are explicitly out of automated verify's reach per 140-03-PLAN.md's <verification> section and the v2.15 owner policy (STATE.md) batching such checks to milestone end in .planning/v2.15-DEFERRED-VERIFICATION.md. Automated coverage already proves the underlying logic (store CRUD, path/validation helpers, storage.rules, church-switch reset, component wiring) — this item is the remaining visual/deployed-environment confirmation, not a functional gap."
---

# Phase 140: Vamps Library — CRUD & Storage Verification Report

**Phase Goal:** Editors can build and maintain a keyed library of vamp audio, mirroring how they manage Songs.
**Verified:** 2026-09-13
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An editor creates a vamp (name, key, optional tempo, one MP3 ≤50MB) from a "Vamps" tab on the Songs page, not a separate sidebar route (SC1, R435) | ✓ VERIFIED | `src/views/SongsView.vue:78-101` renders a `Songs \| Vamps` tab bar (`data-testid="songs-vamps-tab-bar"`) inside the existing Songs page; page `<h1>` stays "Songs" (line 17) regardless of tab. `src/components/VampSlideOver.vue` provides Name/Key-chip/Tempo fields + MP3 attach. `src/stores/vamps.ts#addVamp` writes to `organizations/{orgId}/vamps`. Confirmed **no** `/vamps` route exists in `src/router/index.ts` and **no** entry in `src/components/AppSidebar.vue` (both greps returned zero matches) — satisfies "not a separate sidebar route." |
| 2 | An editor edits a vamp's name/key, replaces or removes its MP3, and deletes the vamp (SC2, R435) | ✓ VERIFIED | `VampSlideOver.vue#onSave` calls `vampStore.updateVamp(id, { name, key, tempo })` for an existing vamp (else-branch, line 397-400), unit-proven at the store level (`vamps.test.ts:170` "calls updateDoc on the vamp doc with serverTimestamp updatedAt"). MP3 replace/remove routes through `useVampStore.setAttachment`/`removeAttachment` (`vamps.ts:73-88`), which best-effort deletes the *previous* Storage object only when the path changes (WR-02 fix, commit `19c9fbc6`) — 4 dedicated store tests cover replace/remove/no-previous/swallowed-failure (`vamps.test.ts:284-343`). `deleteVamp` (`vamps.ts:93-104`) is a single-step hard delete with a best-effort Storage cascade, proven in `vamps.test.ts:207-260`, and wired to a UI inline-confirm (`VampSlideOver.vue:246-282`, tested at `VampSlideOver.test.ts:138-150`). |
| 3 | The Vamps list is browsable and searchable, including by key, matching the Songs list UX, built to Vamps.dc.html (SC3, R436) | ✓ VERIFIED (logic); visual fidelity routed to human review | `VampTable.vue` renders a flat one-row-per-vamp table (Vamp/Key/Tempo/Audio columns, lines 58-93), a search input bound to `vampStore.searchQuery` (line 7), rows sourced from `vampStore.filteredVamps` — which filters by name OR key, case-insensitive (`vamps.ts:106-112`, tested at `vamps.test.ts:354,364`). Amber "No MP3 attached" state (`VampTable.vue:84-89`, tested). Sub-head "N vamps · M with audio" (line 13, tested). WR-01 fix (commit `7659595f`) makes the empty-vs-no-match distinction correct: `SongsView.vue:241` passes the unfiltered `vampStore.vamps`, `VampTable` reads rows from `filteredVamps` — proven by `VampTable.test.ts:134-149`. The Nocturne→gray-950 visual match to `Vamps.dc.html` Turn-12 is a design-fidelity judgment call — see Human Verification. |
| 4 | Vamp files upload into a retention-exempt, org-scoped Storage prefix (orgs/{orgId}/vamp-files/…) that is editor-gated in storage.rules and structurally excluded from every cleanup sweep (SC4, R435) | ✓ VERIFIED | `src/utils/vampFiles.ts#vampFileStoragePath` builds `orgs/{orgId}/vamp-files/{vampId}/{uploadId}/{sanitizedName}` (mandatory per-upload segment for replace-safety), tested in `vampFiles.test.ts`. `storage.rules:122-138` has a `vamp-files/` block mirroring `song-files/`: read `isOrgMember`, create `isOrgEditor` + `size<52428800` + `contentType=='audio/mpeg'`, `update: if false`, delete `isOrgEditor`. Both catch-all exclusion regexes widened to `(song-files\|vamp-files)` (`storage.rules:150,157`), closing the OR-combination bypass. `functions/src/cleanupSweeps.ts:54` `MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//` structurally excludes `vamp-files/` (it is outside `media/`) with zero code change needed. 8 Storage-rules-emulator cases (`src/storage.rules.test.ts:512-609`, incl. the catch-all-OR-override regression proof) and 2 Firestore catch-all cases for the `vamps` collection (`src/rules.test.ts:114-130`) all pass — confirmed green at 310/310 by the 140-02 executor (not re-run per verification-environment instructions; emulator-dependent). |

**Score:** 4/4 phase-level truths verified (0 present-behavior-unverified). Plan-level must_haves (9 across the 3 plans) all traced to passing tests below.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/vamp.ts` | `Vamp`/`VampAttachment`/`UpsertVampInput`, no `hidden` | ✓ VERIFIED | Matches plan exactly (read in full) |
| `src/constants/keys.ts` | `VAMP_KEYS` — 12 entries, one enharmonic spelling each | ✓ VERIFIED | `['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B']` — exactly 12, no dupes |
| `src/utils/vampFiles.ts` | Constants + 4-arg `vampFileStoragePath` reusing `sanitizeFileName` | ✓ VERIFIED | Reuses `@/utils/songFiles`'s `sanitizeFileName`, correct path shape |
| `src/stores/vamps.ts` | `useVampStore` CRUD + search + Storage-cascade delete | ✓ VERIFIED | Includes post-review `setAttachment`/`removeAttachment` (WR-02 fix) |
| `src/composables/useVampFileUpload.ts` | Single-file resumable MP3 upload | ✓ VERIFIED | Fresh `uploadId` per upload; persists via `setAttachment` (post-fix); best-effort duration capture |
| `src/components/VampTable.vue` | Flat searchable table | ✓ VERIFIED | Reads `filteredVamps` for rows, `vamps` prop for counts (post-WR-01-fix) |
| `src/components/VampSlideOver.vue` | Slide-out editor | ✓ VERIFIED | 12-chip picker, MP3 attach/play/remove, create→edit transition, single-step delete, upload feedback (post-CR-01-fix) |
| `src/views/SongsView.vue` | `Songs \| Vamps` tab bar + church-switch watch | ✓ VERIFIED | Tab bar, count badges, "New Vamp" button, second `authStore.orgId` watch (lines 442-449) |
| `storage.rules` | `vamp-files/` block + widened catch-all exclusions | ✓ VERIFIED | Lines 122-157, matches plan verbatim |
| `src/stores/orgScopedStores.ts` | `useVampStore().unsubscribeAll()` registered | ✓ VERIFIED | Line 42, inside `resetOrgScopedStores()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `resetOrgScopedStores()` | `useVampStore` | `.unsubscribeAll()` call | ✓ WIRED | `orgScopedStores.ts:13,42` |
| `useVampFileUpload` upload-complete | `useVampStore` | `.setAttachment(vampId, attachment)` | ✓ WIRED | `useVampFileUpload.ts:182` (post-WR-02-fix; was `updateVamp` pre-fix) |
| `vampFiles.ts` | `songFiles.ts` | imports `sanitizeFileName` | ✓ WIRED | `vampFiles.ts:4` — no duplicate sanitizer |
| `SongsView.vue` Vamps tab | `VampTable`/`VampSlideOver` | props/emits (`vamps`, `loading`, `select`, `add`, `open`, `vamp`, `close`/`saved`/`deleted`) | ✓ WIRED | `SongsView.vue:240-267` |
| `VampSlideOver.vue` MP3 section | `useVampFileUpload().addFile` | drop-zone/file-input handlers | ✓ WIRED | `VampSlideOver.vue:437-445` |
| `storage.rules` catch-all | `vamp-files/` dedicated block | exclusion regex `(song-files\|vamp-files)` | ✓ WIRED | `storage.rules:150,157`; regression-proven by `storage.rules.test.ts`'s small-non-MP3-upload deny case |
| `vampFileStoragePath` path shape | `storage.rules` `vamp-files/` block | path scoping (`orgs/{orgId}/vamp-files/{vampId}/{uploadId}/{name}`) | ✓ WIRED | Rules tests target this exact shape (`storage.rules.test.ts:516` etc.) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All phase-140 targeted unit/component tests pass | `npx vitest run src/utils/__tests__/vampFiles.test.ts src/stores/__tests__/vamps.test.ts src/stores/__tests__/orgScopedStores.test.ts src/composables/__tests__/useVampFileUpload.test.ts src/components/__tests__/VampTable.test.ts src/components/__tests__/VampSlideOver.test.ts src/views/__tests__/SongsView.test.ts` | 7 files / 61 tests, all passed | ✓ PASS |
| Type-check is clean | `npm run type-check` (vue-tsc --build) | Exit 0, no errors | ✓ PASS |
| Full app suite matches documented baseline (no regressions) | `npx vitest run` (bare) | 236/237 files, 5793 passed / 43 skipped; only `src/storage.rules.test.ts` failed (`ECONNREFUSED 127.0.0.1:8080` — no emulator running locally, the documented emulator-dependent baseline, not a Phase 140 regression) | ✓ PASS |
| No new `/vamps` route or sidebar nav entry | `grep -n vamps src/router/index.ts src/components/AppSidebar.vue` | Zero matches in both files | ✓ PASS |
| No debt markers in phase-140 files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 10 created/modified source files | No matches | ✓ PASS |
| Rules suite (Storage + Firestore) | `npm run test:rules` | Not re-run (per verification-environment instructions — needs its own emulator, minutes-long); 140-02-SUMMARY.md reports 310/310 passing including all 10 new vamp cases, confirmed by direct source read of the 10 test cases in `storage.rules.test.ts`/`rules.test.ts` matching the plan's required allow/deny matrix | ✓ PASS (evidence: test source + prior run report, not re-executed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R435 | 140-01, 140-02, 140-03 | Create/manage vamps (name/key/tempo/one MP3≤50MB) from a Vamps tab, editor-gated storage, retention-exempt, edit/replace/remove/delete | ✓ SATISFIED | See Truths #1, #2, #4 above |
| R436 | 140-01, 140-03 | Flat, browsable, searchable (name/key) one-vamp-per-row table + slide-out editor, built to Vamps.dc.html | ✓ SATISFIED (logic); visual fidelity → human review | See Truth #3 above |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps only R435/R436 to Phase 140, and both are declared in the plans' frontmatter (`140-01-PLAN.md`, `140-02-PLAN.md`, `140-03-PLAN.md`).

### Anti-Patterns Found

None. Scanned all 10 created/modified source files (`src/types/vamp.ts`, `src/utils/vampFiles.ts`, `src/stores/vamps.ts`, `src/composables/useVampFileUpload.ts`, `src/components/VampTable.vue`, `src/components/VampSlideOver.vue`, `src/views/SongsView.vue`, `src/stores/orgScopedStores.ts`, `src/constants/keys.ts`, `storage.rules`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" — zero matches.

One pre-existing **Info**-level (non-blocking) finding remains from `140-REVIEW.md`, explicitly left out of critical/warning fix scope by the owner-approved fix report:
- **IN-01** (`VampSlideOver.vue:442`): `authStore.orgId ?? ''` silently falls back to an empty string instead of guarding, which could construct a malformed double-slash Storage path (`orgs//vamp-files/...`) if `orgId` were ever falsy while the drawer is open. In practice `authStore.orgId` is always set while the Songs page is mounted (the route requires an authenticated, org-scoped session), so this is a defense-in-depth nit, not a reachable defect — informational only, not a phase blocker.

### Human Verification Required

1. **Vamps tab visual fidelity + real MP3 upload/playback/download round-trip**

   **Test:** Open Songs → Vamps tab. Create a vamp (name, key chip, optional tempo), save (drawer stays open), attach a real MP3, confirm it uploads, plays, and downloads; edit an existing vamp's name/key/tempo and save; remove the MP3 then attach a different one (replace flow); delete a vamp via the inline confirm; search by vamp name and by key.

   **Expected:** The Nocturne→gray-950 visual mapping matches `Vamps.dc.html` Turn-12 (tab bar, flat table, slide-out editor); a real MP3 round-trips through Firebase Storage in a deployed environment (upload, playback, download); search filters visually match by name and by key.

   **Why human:** Visual/layout design-fidelity judgment and a real Storage-backed upload/playback/download round-trip in a deployed environment cannot be verified by grep/unit tests — the Storage emulator does not fully model prod upload/CORS behavior. This is explicitly scoped out of automated verify in `140-03-PLAN.md`'s `<verification>` section and batched to milestone end per the v2.15 owner policy (STATE.md) in `.planning/v2.15-DEFERRED-VERIFICATION.md`. All underlying logic (store CRUD, path/validation helpers, storage.rules enforcement, church-switch reset, component wiring, create→edit transition, single-step delete, search-by-name-or-key) is already unit/rules-tested and verified above — this item is the remaining visual/deployed-environment confirmation, not an unresolved functional gap.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria (R435 create/manage/edit/replace/remove/delete; R436 flat searchable table + editor built to design) are backed by passing automated tests and directly-read source code, including the 3 post-SUMMARY code-review fixes (CR-01 upload feedback, WR-01 filtered-vs-unfiltered table props, WR-02 orphaned-Storage-object-on-replace) confirmed present in the current codebase, not merely claimed in 140-REVIEW-FIX.md. The single remaining item is a visual/deployed-environment human check, correctly deferred per the project's established v2.15 batched-UAT policy rather than blocking this phase.

---

_Verified: 2026-09-13_
_Verifier: Claude (gsd-verifier)_
