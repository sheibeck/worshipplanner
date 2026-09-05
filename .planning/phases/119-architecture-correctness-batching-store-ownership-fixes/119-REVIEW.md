---
phase: 119-architecture-correctness-batching-store-ownership-fixes
reviewed: 2026-09-05T00:00:00Z
depth: deep
files_reviewed: 17
files_reviewed_list:
  - src/stores/songs.ts
  - src/stores/songLyrics.ts
  - src/stores/services.ts
  - src/stores/auth.ts
  - src/stores/members.ts
  - src/stores/superAdmins.ts
  - src/stores/orgScopedStores.ts
  - src/composables/useSlideshowAssembly.ts
  - src/components/PcImportModal.vue
  - src/components/GettingStarted.vue
  - src/components/admin/ConfigurationTab.vue
  - src/components/settings/ServiceTemplateEditor.vue
  - src/components/SongLyricEditor.vue
  - src/components/ScriptureSlideEditor.vue
  - src/views/ServicesView.vue
  - src/views/ServiceEditorView.vue
  - src/stores/__tests__/songs.test.ts
findings:
  critical: 0
  high: 0
  medium: 2
  low: 4
  total: 6
status: findings
---

# Phase 119: Code Review Report

**Reviewed:** 2026-09-05
**Depth:** deep (cross-file: import graph, call chains, store teardown ordering, test-intent parity)
**Files Reviewed:** 17 (source + the migrated songs test)
**Status:** issues_found

## Summary

Phase 119 is nine behavior-preserving refactors/correctness fixes (R349-R357). I traced the
highest-risk changes end-to-end against the pre-119 code and confirmed the **success paths are
behavior-preserving** for the batching, query-convergence, store-extraction, and lifecycle work.
Specifically verified sound:

- **R350 success path** — the `writeBatch` `set`/`update` payloads are byte-identical to the old
  `addDoc`/`updateDoc` payloads (same match order pcSongId→ccli→title, same grow-only tag/theme
  union, same vwTypes/primaryArrangement preservation). Chunk boundaries are correct (0→empty,
  499→1 batch, 600→2 batches; 1 op/song under the 500 limit). A failed chunk is surfaced in
  `summary.failed`, not silently swallowed. Migrated tests still assert the same write intent (now
  via `mockBatchOps`) — not weakened.
- **R351** — both callers now build from the single `lyricsQuery()`; `docs[0]` over the shared
  `orderBy('createdAt','desc')` returns the identical newest doc that `limit(1)` used to. Rendered
  lyrics unchanged. (One efficiency caveat below.)
- **R356 members teardown** — `resetOrgScopedStores()` runs in `auth.ts:680` (selectOrg) *before*
  `loadOrgContext` flips `orgId`, so the newly-registered members store is torn down **before**
  GettingStarted's `watch(orgId, …, {immediate})` re-subscribes. No teardown-after-resubscribe
  leak; no cross-org listener leak. superAdmins is correctly global (not registered).
- **R355** — writes the same `settings.defaultServiceTemplate` dot-path and mirror-syncs the same
  leaf; component + store guards (`orgId` + `isEditor`) are consistent. (Latent nested-key caveat
  below.)
- **R349** — both callers (`markAsPlanned`, `reopenService`) already wrapped `recomputeLastUsedFor`
  in a log-only try/catch, so losing propagation changes nothing user-facing; more songs now get
  their `lastUsedAt` on a partial failure. Safe improvement.
- **R352** — all four `localService.value =` sites round-trip through `JSON.parse(JSON.stringify)`
  (verified lines 2795, 2823, 2862, 4601), stripping the `Timestamp.toDate`, so the removed date
  branch was genuinely unreachable. Behavior-preserving.
- **R353** — hoisted `stopTeamsSeedWatch` teardown is balanced; `initStore` is only ever entered
  after a stop+null, so no double-subscribe.
- **R357** — the added test genuinely holds `updateService` pending, injects a non-echo remote
  snapshot mid-flight, and asserts the reordered slot order survives. Non-trivial.

The findings below are the residue: two Medium behavior/contract issues and four Low items. No
Critical or High defect was proven.

## Critical Issues

None.

## High Issues

None.

## Medium Issues

### MD-01: Total PC-import failure now shows the green "Import complete!" success screen instead of the error state

**File:** `src/components/PcImportModal.vue:132-152` (done step) and `:319-326` (`onConfirmImport`)
**Issue:** Before R350, `upsertSongs` threw on any failed write, so `onConfirmImport`'s
`catch` routed to the red **"Import failed"** error step. After R350, `upsertSongs` catches every
`batch.commit()` rejection internally and **always resolves** — the only remaining path into the
`catch` is a non-Firestore programming error. So when *every* chunk fails (e.g. a
permission-denied on all writes, or an offline import), the modal now lands on the `done` step
showing a green checkmark and the header **"Import complete!"**, with the real outcome
("0 songs added, 0 updated, N failed") only in the sub-line below. The primary visual signal
(green check + "complete") directly contradicts a zero-success outcome. This is an observable
behavior change from the pre-119 error-step behavior.
**Fix:** On the `done` step, branch the header/icon on outcome — e.g. when
`importSummary.added + importSummary.updated === 0 && importSummary.failed.length > 0`, render the
red/error treatment (or route back to `step = 'error'` with a summary message) instead of the
green "Import complete!" chrome:
```ts
// in onConfirmImport, after getting the summary:
importSummary.value = await songStore.upsertSongs(songsToImport)
const wrote = importSummary.value.added + importSummary.value.updated
step.value = wrote === 0 && importSummary.value.failed.length > 0 ? 'error' : 'done'
```
(and set `errorMessage` from the failed titles when routing to `error`).

### MD-02: `updateOrgSettings` mirror-write silently targets the wrong level for a nested key whose parent object is missing

**File:** `src/stores/auth.ts:424-433`
**Issue:** The method is documented and shaped to "walk an arbitrary dot-path… so it stays correct
for any future multi-segment settings key." For `settings.a.b`, the inner loop walks into
`settings.a`; if `settings.a` does not yet exist locally, `typeof next !== 'object'` triggers
`break` — but control then **falls through** to
`cursor[segments[segments.length - 1]!] = value`, assigning `b` onto `cursor`, which is still the
top-level `settings` object. Result: Firestore's dot-path `updateDoc` correctly creates
`settings.a.b`, while the local mirror writes `settings.b` at the wrong level — a silent
mirror/server divergence. The current sole caller uses a single-leaf key
(`settings.defaultServiceTemplate`), so the broken path is currently unreachable, but the code
advertises a contract it does not honor and is a trap for the next caller.
**Fix:** On a missing intermediate, skip the assignment for that key rather than falling through —
either `continue` the outer `for…of` on `break`, or create the missing intermediate object:
```ts
let broke = false
for (let i = 1; i < segments.length - 1; i++) {
  const key = segments[i]!
  let next = cursor[key]
  if (typeof next !== 'object' || next === null) { next = {}; cursor[key] = next }
  cursor = next as Record<string, unknown>
}
cursor[segments[segments.length - 1]!] = value
```

## Low Issues

### LW-01: R351 drops `limit(1)`, so the composable's live listener now downloads every lyrics doc per song

**File:** `src/composables/useSlideshowAssembly.ts:41` (`lyricsQuery(orgId, songId)`),
`src/stores/songLyrics.ts:24-29`
**Issue:** Converging on the shared `lyricsQuery` (no `limit`) is correct for the *result*
(`snap.docs[0]` is the same newest doc `limit(1)` returned). But the composable's live
`onSnapshot` now receives **all** lyrics docs for the song on every update and discards all but
`docs[0]`. For a song with many historical lyrics docs this increases read count and snapshot
payload. Performance is out of v1 scope and rendered lyrics are unchanged, so this is
informational — but it is a real efficiency guarantee that was silently dropped by the
convergence.
**Fix:** If read cost matters, keep the single query source but expose an optional
`limit`-applying variant for the newest-only consumer, or document that `lyricsQuery` intentionally
returns the full ordered set and both consumers accept that cost.

### LW-02: `useSuperAdminsStore.subscribe()` has no unsubscribe-first guard and `unsubscribe()` leaves stale state

**File:** `src/stores/superAdmins.ts:29-49`
**Issue:** Two inconsistencies versus the sibling `members.ts` created in the same plan:
(a) `subscribe()` assigns `unsub = onSnapshot(...)` without first calling `unsub?.()`. As a Pinia
singleton, a second `subscribe()` (double mount, or a future second consumer) leaks the prior
listener. `members.ts:19-31` guards this; `superAdmins` does not. This preserves the *old*
component behavior (which also didn't guard), so it is not a regression — but it is an
inconsistency introduced by the extraction. (b) `unsubscribe()` does not reset `superAdmins`/
`loaded`, so remounting ConfigurationTab now shows the previous roster instead of the
"Loading roster..." state the old component-local refs showed on each mount (`members.ts`
resets `memberCount` to 0 on teardown for exactly this reason).
**Fix:** Mirror `members.ts`: `unsub?.(); unsub = null` at the top of `subscribe()`, and reset
`superAdmins.value = []; loaded.value = false` in `unsubscribe()` (or deliberately document the
cached-roster-on-remount behavior as intended).

### LW-03: R350 batching changes which songs persist on a partial-failure import (all-or-nothing per 499-chunk)

**File:** `src/stores/songs.ts:392-419`
**Issue:** On the success path the writes are identical to the old per-doc path (verified). On a
*partial* failure the semantics differ: a single malformed/rejected song now fails its entire
≤499-song `writeBatch` (all-or-nothing), so up to 498 otherwise-valid songs in that chunk are not
written and are reported as `failed`. The old sequential path persisted every song before the
failing one. This is the intended tradeoff of batching (and is surfaced in `summary.failed`), but
it is an observable change to *which* songs land on a partial-failure import and is not currently
covered by a test asserting the intra-chunk atomicity (the failure test uses uniform whole-chunk
success/failure).
**Fix:** No code change required if the tradeoff is accepted; consider a test that mixes a valid
and an invalid song in one chunk to lock in the documented all-or-nothing behavior, and ensure the
UI copy ("N songs failed") makes clear those songs were not partially saved.

### LW-04: PcImportModal `done` summary can mislabel a real update as "skipped" in newOnly mode

**File:** `src/components/PcImportModal.vue:143-146` (done-summary) and `:339-341` (`onDoneClose`)
**Issue:** In `newOnly` mode the summary hardcodes `preview.toUpdate` as the "skipped" count and
always renders the word "skipped", while `upsertSongs` performs its *own* pcSongId→ccli→title
match against the current `songs.value`. If a song the preview partitioned as "new" actually
matches an existing song at import time (e.g. `songs.value` changed after the preview), it is
written as an **update**, so `importSummary.updated` becomes non-zero — but the display ignores
`importSummary.updated` in newOnly mode and labels it "skipped", hiding the real update. Meanwhile
`onDoneClose` emits `added + updated`, so the emitted count and the on-screen count can disagree.
Low-probability edge case.
**Fix:** In newOnly mode, surface `importSummary.updated` when it is non-zero (e.g. "X added,
Y updated, Z skipped") rather than assuming zero updates, keeping the displayed and emitted counts
consistent.

---

_Reviewed: 2026-09-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
