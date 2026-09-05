---
phase: 120-architecture-god-module-decomposition
reviewed: 2026-09-05T05:36:39Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - src/composables/useAiSongSuggestions.ts
  - src/views/ServiceEditorView.vue
  - functions/src/cleanupSweeps.ts
  - functions/src/index.ts
  - functions/src/index.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 120: Code Review Report

**Reviewed:** 2026-09-05T05:36:39Z
**Depth:** deep (cross-file: import graph, re-export completeness, behavior-preservation line diff)
**Files Reviewed:** 5
**Status:** clean

## Summary

Phase 120 is two behavior-preserving MOVES out of the two god modules: R358 extracts the
AI song-suggestion cluster from `ServiceEditorView.vue` into a `useAiSongSuggestions.ts`
composable; R359 extracts the four scheduled Storage-retention sweeps from
`functions/src/index.ts` into `functions/src/cleanupSweeps.ts`. R360 was documentation-only
(no source touched) and is out of code-review scope.

I reviewed adversarially against the phase's highest-risk failure mode — a Cloud Function
silently dropped from the deploy surface — plus circular-import risk, logic drift, and lost
reactivity. **All critical checks pass.** No blockers, no warnings. Two Info-level
observations, both intentional and non-actionable.

Verification performed (independent, not trusting the SUMMARY):

1. **Re-export completeness (the critical availability check).** All four deploy-facing
   wrappers — `cleanupExpiredMedia`, `cleanupOrphanRenders`, `cleanupOrphanBackgrounds`,
   `cleanupPptxSources` — are re-exported from `index.ts` at line 2425
   (`export { cleanupExpiredMedia, cleanupOrphanRenders, cleanupOrphanBackgrounds, cleanupPptxSources };`).
   `firebase deploy` will still find all four.
2. **No dropped/collateral export loss.** Diffed the exported-symbol set of `index.ts` before
   vs after the move. Every symbol that left `index.ts`'s export surface
   (`RETENTION_DAYS`, `MEDIA_PATH_GUARD`, `RENDERED_OBJECT_GUARD`, the four `*Handler`s, the
   summary interfaces, `readDeleteCap`, `renderedPrefixFor`, `sourcePrefixFor`,
   `extractBackgroundObjectPath`, etc.) is either (a) a non-deploy constant/helper now homed in
   `cleanupSweeps.ts`, or (b) a Cloud Function re-exported at line 2425. **No other pre-existing
   `export const <fn> = on*(...)` was disturbed** — the five other re-export blocks
   (`syncOrgMembershipClaim`, `syncSuperAdminClaim`/`setSuperAdminClaim`, the `orgProvisioning`
   sextet, `sendInviteOnboardingEmail`, `deleteOrganization`) all survive unchanged. No external
   module or test imports any moved symbol *from `./index`*; the only external consumer,
   `index.test.ts`, was correctly repointed to `./cleanupSweeps`.
3. **No circular import.** `index.ts → cleanupSweeps.ts` is one-way. `cleanupSweeps.ts` imports
   only `firebase-functions`, `firebase-admin`, and `./appConfig`; it imports **nothing** from
   `./index`. `appConfig.ts` imports neither `index` nor `cleanupSweeps`, so no cycle is closed
   transitively. The `renderedPrefixFor` deviation is sound: homing it in `cleanupSweeps.ts` and
   importing it back into `index.ts` (used by `requestPptxRenderHandler` at index.ts:1022) keeps
   the direction one-way, exactly as the SUMMARY claims.
4. **Zero logic drift.** Line-diffed every code line removed from `index.ts` (excluding comments,
   imports, and the re-export line) against the full text of `cleanupSweeps.ts`: **every removed
   code line is present in the new file.** The four handlers, `readDeleteCap`, the guards,
   retention constants, and `onSchedule` wrappers moved verbatim — schedules (02:00/03:00/05:00/
   06:00 UTC), guards, dry-run gates, and cap logic all unchanged. `previewCleanupDryRunHandler`
   stays in `index.ts` and calls the four handlers via the `./cleanupSweeps` import with the same
   `{ forceDryRun: true }` contract and the same `dryRun`-assertion guards.
5. **R358 wiring is correct.** The composable exposes the same reactive surface (six refs + four
   functions); `ServiceEditorView.vue` destructures them at a single top-level call placed before
   `activeActionItems` (which reads `aiSuggestingAll`/`suggestAllSongs`). All composable inputs are
   declared earlier in setup — `songStore` (1770/1771), `serviceStore`/`serviceId` (1770/2543),
   `canEditService` (2130), `hasSermonContext` (2580), `recentServiceSongIds` (moved up to 2584);
   `onSelectSong` is a hoisted `function` declaration (3468), so passing it at 2622 is safe. No
   orphaned references to moved-only symbols (`aiCacheKey`, `aiSongCache`, `getSongSuggestions`,
   `getPrimaryKey`, `AiSongSuggestion`) remain in the view. The moved sermon-context cache-clear
   `watch` (watched expression, callback, and `{ deep: true }`) is verbatim.
6. **Test integrity.** `index.test.ts`'s cleanup-symbol imports were repointed to `./cleanupSweeps`
   with no assertion changes; the three SOURCE-INSPECTION tests now `readFileSync("cleanupSweeps.ts")`
   — the correct new home of the handler bodies they pin — with identical substring/gate assertions.

Gates re-run independently: `cd functions && npm run build` (tsc) compiles clean, proving the
re-exports and the `renderedPrefixFor` back-import resolve; `npm run type-check`
(`vue-tsc --build`, which also typechecks test files) passes clean.

## Info

### IN-01: Composable returns `aiSongCache`, but no consumer reads it

**File:** `src/composables/useAiSongSuggestions.ts:32,275`
**Issue:** `aiSongCache` is declared in `UseAiSongSuggestionsReturn` and included in the returned
object, but `ServiceEditorView.vue` deliberately does not destructure it (only the composable's
internal `fetchAiForSlot` and the cache-clear watcher touch it), and it is the composable's sole
consumer. The exposed ref is therefore dead API surface.
**Fix:** Intentional per the plan ("expose the same reactive surface the inline code did") and the
120-01 SUMMARY. No action needed; if a future cleanup wants a tighter surface, `aiSongCache` can be
dropped from both the return type and the returned object without touching any caller. Left as an
observation only.

### IN-02: Store dependency passed as a structurally-typed plain object

**File:** `src/composables/useAiSongSuggestions.ts:15-18,25`
**Issue:** `AiSongSuggestionsSongStore` types only `aiCandidateSongs`/`songs`, and the full Pinia
store is passed in and read at call-time (`songStore.aiCandidateSongs`, `songStore.songs`). This is
correct and reactivity-preserving (the store proxy is never destructured), but the hand-rolled
narrow interface will silently drift if the store renames or changes the type of either property —
the composable would keep compiling against its own stale shape.
**Fix:** Optional — derive the parameter type from the store (e.g. `Pick<ReturnType<typeof useSongStore>, 'aiCandidateSongs' | 'songs'>`)
so a store-side rename surfaces as a type error at the call site. Not a defect in current behavior;
matches the established `useAutoSave`/`useSlideshowAssembly` options-object convention.

---

_Reviewed: 2026-09-05T05:36:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
