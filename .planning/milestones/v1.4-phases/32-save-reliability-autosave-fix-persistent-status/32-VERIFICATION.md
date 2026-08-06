---
phase: 32-save-reliability-autosave-fix-persistent-status
verified: 2026-08-03T00:52:54Z
status: passed
status_source: owner-attributed
status_prior: human_needed
status_changed: "2026-08-05 — owner closed milestone v1.4 and accepted all outstanding phase verification without running it"
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "E1/E4 overflow backstop — real-browser visual wrap. Open SongLyricEditor.vue (narrowest of the four headers), force the error state, and confirm the 59-char sentence \"Couldn't save your changes — they're still here. Try again.\" wraps onto multiple lines rather than clipping or causing horizontal overflow."
    expected: "Text wraps within the header row; no clipping, no horizontal scroll."
    why_human: "jsdom cannot measure real layout. The automated test (SaveStatusIndicator.test.ts / SongLyricEditor.test.ts \"overflow backstop\") only proves no truncation class and full text content are present — not that it visually wraps in a real browser. Already recorded as PENDING-VERIFICATION.md items 32-04.1 and 32-06.2."
  - test: "Toast real-viewport placement — bottom-right on normal width, full-width-minus-margins on narrow/mobile, no overlap with the sticky status bar or the Phase 31 lock banner at the top."
    expected: "Toast renders bottom-right (>=640px) or bottom full-width (<640px) without overlapping top-anchored chrome."
    why_human: "CSS breakpoint/position behavior at real viewport sizes cannot be verified from jsdom. PENDING-VERIFICATION.md item 32-04.2."
  - test: "Sticky status bar stays pinned while scrolling a long Service Order list to the bottom (ServiceEditorView)."
    expected: "The bar remains visible at the top of the editing surface throughout the scroll."
    why_human: "Real scroll/sticky-positioning behavior cannot be exercised in jsdom. PENDING-VERIFICATION.md item 32-05.1."
  - test: "Saved h:mm persists on screen over real wall-clock time (>=10 seconds), not just under fake timers."
    expected: "Saved h:mm remains visible the whole time, no fade."
    why_human: "The automated suite uses vi.useFakeTimers(); it proves the 3-second fade code path is deleted, not that the DOM text visually persists in a real tab over real time. PENDING-VERIFICATION.md item 32-05.2."
  - test: "Real-Firestore serverTimestamp() echo timing: debounced save fires, its own echo lands, then an immediate song pick still saves, against the real emulator (not the mocked hasPendingWrites)."
    expected: "The pick's write count increments; the echo does not swallow it."
    why_human: "jsdom mocks metadata.hasPendingWrites/updatedAt; only a real Firestore round-trip proves the two-snapshot (optimistic + server-ack) timing this fix depends on. PENDING-VERIFICATION.md item 32-05.3."
  - test: "Confirm the \"above the fold\" reading (sticky sub-header of the editing surface, not the app's global header) is what the owner actually meant for R040."
    expected: "Owner confirms or requests the alternate placement."
    why_human: "This is an explicit, disclosed interpretive call made under the STATE.md standing autonomy grant, not an owner statement — 32-05's own <flagged_reading> section asks for this confirmation. PENDING-VERIFICATION.md item 32-05.4."
  - test: "SongLyricEditor visual confirmation: edit a section, confirm the header shows Saving… then a persisting Saved h:mm, replacing the old dot-and-tick."
    expected: "Real-browser visual match to the four-state contract."
    why_human: "Visual confirmation of rendered text/state transitions in a live browser. PENDING-VERIFICATION.md item 32-06.1. (CongregationalEditor/ScriptureSlideEditor cannot be checked this way today — both are unmounted dead weight pending Phase 34, per plan 06's own SUMMARY.)"
  - test: "Screen-reader announcement behavior: a routine save (Saving soon…/Saving…/Saved h:mm) is announced politely and does not interrupt; a failure raises the assertive toast in addition to the polite inline announcement."
    expected: "aria-live=\"polite\" region reads routine transitions without interrupting; role=\"alert\" toast interrupts on failure."
    why_human: "Live screen-reader announcement timing/politeness cannot be verified by static analysis or jsdom. PENDING-VERIFICATION.md item 32-06.3."
---

# Phase 32: Save Reliability — Autosave Fix & Persistent Status Verification Report

**Phase Goal:** Every mutation on the Service Order reliably fires autosave, and the whole app has one persistent inline save-status indicator.
**Verified:** 2026-08-03T00:52:54Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Changing a song on a service item reliably triggers a save, including immediately after a prior save's own echo lands | ✓ VERIFIED | `src/stores/services.ts` `subscribe()` classifies own-write echoes from `metadata.hasPendingWrites` (both the pending edge and the settle edge) via `ownWriteEchoIds`/`isOwnWriteEcho`. `ServiceEditorView.vue`'s remote-merge watcher (line 2020) skips merging on a self-echo. Repro test committed RED-before-fix at `7cd2821` (test-only commit, verified by `git show --stat`), fix commits `4456431`/`5f49871` follow chronologically and by diff scope. Both R039 cases pass through the real code path today (`npx vitest run` confirmed, 2/2 green, plus 360/360 across the phase's touched test files). |
| 2 | Every surface with autosave shows a persistent inline "Saving… / Saved HH:MM" status anchored to the content being edited, visible without scrolling | ✓ VERIFIED (structural) — real-browser scroll/visual confirmation deferred to human | All four surfaces (`ServiceEditorView.vue`, `CongregationalEditor.vue`, `ScriptureSlideEditor.vue`, `SongLyricEditor.vue`) render the shared `SaveStatusIndicator` bound to a `surfaceId`. `useAutoSave.ts`'s 3-second fade is deleted (`grep -c '3000'` returns 0; a positive test asserts `'saved'` survives 60000ms). `ServiceEditorView.vue` gets a `sticky top-0 z-10` bar (verified in source, mutually exclusive with the Phase 31 lock banner). The three editors rely on a pre-existing `shrink-0` header above a `flex-1 overflow-y-auto` body — structurally true by inspection (header is outside the scroll container), not newly built or tested against real scrolling this phase. Real-browser "stays pinned while scrolling" / "persists over real wall-clock time" is deferred to human verification (already logged in PENDING-VERIFICATION.md, items 32-05.1/32-05.2/32-06.1). |
| 3 | A save failure raises a toast; a save success does not | ✓ VERIFIED | `useSaveStatus.set()` (`src/stores/saveStatus.ts`) is the single edge-detector: pushes to `useToasts` only on the `!== 'error' -> === 'error'` transition. Unit-tested: one toast per failure episode, zero toasts for idle/pending/saving/saved statuses, two independent toasts for two concurrently-failing surfaces. `ServiceEditorView.vue`'s `handleAutosaveFailure` and the three editors' reporting watchers only ever call `saveStatus.set(..., {status:'error', errorText: <fixed sentence>})` on rejection — no path sets `'saved'` through anything but a resolved `await saveFn()`. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/services.ts` | `ownWriteEchoIds`/`isOwnWriteEcho`, read-path only | ✓ VERIFIED | Present, tested (5 R039 tests), `assertWritable`/`updateService` untouched per `git diff` acceptance criterion in 32-01's own gate. |
| `src/views/ServiceEditorView.vue` | Remote-merge echo guard; migrated onto `useAutoSave`/`useSaveStatus`; sticky bar; `handleAutosaveFailure` | ✓ VERIFIED | All present at the cited lines; 157/157 tests pass including the R039, R028, BL-02 and 32-05 blocks. |
| `src/composables/useAutoSave.ts` | 5-member `AutoSaveStatus`; catch on both save paths; no fade | ✓ VERIFIED | Read directly — `catch { status.value = 'error' }` on both the debounced path and `flush()`; no `setTimeout(..., 3000)` remains; 16/16 tests pass. |
| `src/stores/saveStatus.ts` | `useSaveStatus` — per-surface entries, deterministic rollup, edge-triggered toast | ✓ VERIFIED | Present; determinism backstop has a real test (two Pinia instances, both insertion orders, same winner); 15 tests pass. |
| `src/stores/toasts.ts` | `useToasts` — array-backed, 6000ms self-dismiss, idempotent dismiss | ✓ VERIFIED | Present; 8 tests pass; timer lives in the store (survives raising component unmount, tested). |
| `src/components/SaveStatusIndicator.vue` | One shared component, 4 states + idle-renders-nothing, single `aria-live` region | ✓ VERIFIED | Matches 32-UI-SPEC.md § 2 verbatim; 12 tests pass including the single-live-region count assertion. |
| `src/components/ToastHost.vue` | `role="alert"` stack, mirrored copy, `z-[60]` | ✓ VERIFIED | Matches 32-UI-SPEC.md § 4 verbatim; 9 tests pass; mounted exactly once in `AppShell.vue` (grep-confirmed no second mount). |
| `src/components/CongregationalEditor.vue`, `ScriptureSlideEditor.vue`, `SongLyricEditor.vue` | Shared indicator swap; retired 3-per-status handles; capture-once surface id; clear on unmount | ✓ VERIFIED | All three retired handles (`status-pending`/`status-saving`/`status-saved`) confirmed absent anywhere under `src/` via grep; capture-once id pattern present in source; unmount clears confirmed; 90 combined tests pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `onSnapshot(q, {includeMetadataChanges:true}, cb)` | `ownWriteEchoIds` | synchronous assignment inside the callback | ✓ WIRED | Confirmed at `src/stores/services.ts` `subscribe()`. |
| `ServiceEditorView.vue` remote-merge watcher | `serviceStore.isOwnWriteEcho` | early-return guard before the JSON diff | ✓ WIRED | Line 2020, confirmed order (initial-load branch still runs on echo). |
| `saveStatus.set()` | `useToasts().push()` | edge-detected inside `set()`, not at any caller | ✓ WIRED | Every caller (`ServiceEditorView`, the three editors) calls `saveStatus.set()` only; none calls `useToasts()` directly — grep-confirmed. |
| `SaveStatusIndicator` | `useSaveStatus().entryFor(surfaceId)` | reactive `computed` | ✓ WIRED | Confirmed in source; unknown surfaceId resolves to idle, tested. |
| `AppShell.vue` | `ToastHost` | single mount, sibling after `</main>` | ✓ WIRED | Confirmed; no other `.vue` file renders `ToastHost` (grep-confirmed). |
| `useAutoSave` catch | `saveStatus.set(..., {status:'error'})` | via `handleAutosaveFailure` (ServiceEditorView) or the reporting watcher (three editors) | ✓ WIRED | No path sets `'saved'` without a resolved `await saveFn()`; confirmed by reading both call sites. |

### Prohibitions

| # | Statement | Status | Evidence |
|---|-----------|--------|----------|
| P-01 | The status must never report a save as succeeded when it was not persisted; no catch may swallow a rejection to keep the indicator looking clean | ✓ kept | `useAutoSave.ts`'s two `catch` blocks always set `status.value = 'error'`, never `'saved'`. `handleAutosaveFailure` sets `'idle'` (locked, reverted — nothing to retry) or `'error'` (transport failure, edit kept) — never `'saved'`. No `catch` block anywhere in the touched files is empty or silently discards. |
| P-02 | Opening or merely viewing a service must never write to it | ✓ kept | Real test (`src/views/__tests__/ServiceEditorView.test.ts:4096`, "mounting the view and touching nothing issues no write... even for a service with zero slots") mounts, waits past the debounce window, and asserts `mockUpdateService` was never called and the entry stays idle. This test does NOT call `warmUp()` — it is a genuine no-touch mount, not neutralized by any warm-up idiom. Passes. |
| P-03 | The R039 repro test must genuinely fail against the unfixed code, not be authored to pass, not weakened to green | ✓ kept | Commit history confirms `7cd2821` (test only, `git show --stat` shows a single file, `+183` lines, zero `src/` changes) precedes `4456431` and `5f49871` (the fix commits) chronologically (`2026-08-02 18:31:03` -> `18:35:50` -> `18:42:33`) and by commit content. SUMMARY records the verbatim red output (`expected 2 times, but got 1 times`) and discloses in detail an investigation into an initially-false-green draft, resolved by correcting test timing rather than weakening the assertion — the disproof protocol was consulted and consciously not triggered, with reasoning recorded. |

### Backstop Must-Haves (7 declared in 32-UI-SPEC.md § UI Considerations)

| # | Backstop | Resolution | Status |
|---|----------|-----------|--------|
| 1 | E1/E4 overflow — 59-char string must not clip in the narrowest header (jsdom cannot measure real layout) | Automated test proves "no truncation class + full text present"; real-browser wrap is explicitly NOT claimed by the SUMMARYs and is logged as a human-verification item (32-04.1, 32-06.2) | Correctly routed to human — not silently passed |
| 2 | E2/E4 `loading` — a stale status must not carry over on record switch | Real jsdom test: switch record, assert no inherited saved timestamp (ServiceEditorView, all three editors) | ✓ VERIFIED by real test |
| 3 | E2 `partial` (ServiceEditorView) — an entry must not outlive its surface | Real jsdom test: unmount, assert store holds no entry | ✓ VERIFIED by real test |
| 4 | E3 `partial` (ToastHost) — a toast raised by an unmounting surface must not leak its timer | Real jsdom test: unmount host, advance timers, assert no throw and empty array (timer lives in the store, structurally provable in jsdom) | ✓ VERIFIED by real test |
| 5 | E4 `partial` (the three editors) — mid-save id switch must not misattribute | Real jsdom test for both readings editors (genuinely reachable, via a test-only `defineExpose`); a defensive equivalent for SongLyricEditor, explicitly labeled as guarding a not-currently-reachable path | ✓ VERIFIED by real test (2 reachable, 1 defensive-but-tested) |
| 6 | Determinism — same-status tie-break must be stable across re-renders | Real test: two fresh Pinia instances, both insertion orders, same winner | ✓ VERIFIED by real test |
| 7 | Toast simultaneous-failure independence | Real test: two surfaces fail, two toasts, independent timers | ✓ VERIFIED by real test |

Six of the seven declared backstops have genuine automated evidence (jsdom can observe store state, timers, and DOM text/attributes — none of those six require real browser layout or a screen reader). Only #1 (real visual wrap) is genuinely jsdom-unprovable and is correctly abstained on and routed to human verification, not silently marked passed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R039 | 32-01 | Discrete mutations reliably fire autosave, including immediately after a prior save's own echo; repro-before-fix mandate | ✓ SATISFIED | See Truth 1 above. REQUIREMENTS.md checkbox flip is corroborated by independent evidence (commit order, live test run), not trusted at face value. |
| R040 | 32-02 through 32-06 (declared) | Every surface with autosave shows a persistent inline status, one `useSaveStatus` aggregator, `ServiceEditorView` stops hand-duplicating `useAutoSave` | ✓ SATISFIED | REQUIREMENTS.md flipped this to `[x]` after plan 32-02 (before the UI shipped) — per the verification brief, this was NOT trusted at face value. Independently confirmed: all four surfaces render `SaveStatusIndicator`, `useSaveStatus` is the single aggregator, `ServiceEditorView.vue`'s inline autosave block is deleted (confirmed via `git diff --stat` history and current source read) and delegates to `useAutoSave`. |
| R041 | 32-02 through 32-06 (declared) | Save failure raises a toast, success does not, `aria-live` status region | ✓ SATISFIED | Same caution applied — independently confirmed via `saveStatus.set()`'s edge-triggered toast logic and its unit tests, plus `SaveStatusIndicator.vue`'s `aria-live="polite"` wrapper covering all four states. |

No orphaned requirements: REQUIREMENTS.md maps exactly R039/R040/R041 to Phase 32, and all three appear in at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and "coming soon"/"not yet implemented" style strings across all 22 files touched by this phase's six plans returned zero matches. No stub returns (`return null`/`return {}`/empty arrow handlers) found in the new/modified save-status code paths — every `catch` sets a real status, every store write is backed by a real mutation.

### Behavioral Spot-Checks / Full Suite

- `npx vitest run` across the 10 directly relevant test files (`ServiceEditorView.test.ts`, `useAutoSave.test.ts`, `saveStatus.test.ts`, `toasts.test.ts`, `SaveStatusIndicator.test.ts`, `ToastHost.test.ts`, `CongregationalEditor.test.ts`, `ScriptureSlideEditor.test.ts`, `SongLyricEditor.test.ts`, `services.test.ts`): **360/360 passed**, re-run independently by this verifier (not merely trusted from SUMMARY.md).
- Full-suite gate figures from the orchestrator (`npx vitest run src/`: 1977/1986, 74/76 files, both failing files pre-existing baseline; `npm run type-check`: clean) are consistent with every plan's own SUMMARY-reported baseline and were not contradicted by any file this verifier inspected.
- R039 repro commit-ordering audit: `git log` timestamps and `git show --stat` confirm `7cd2821` (test-only) precedes `4456431`/`5f49871` (fix) both in time and in diff scope.

### Human Verification Required

All eight items below were already disclosed by the executing plans and appended to `.planning/PENDING-VERIFICATION.md` under the STATE.md standing autonomy grant — none were self-approved, and this verifier is not marking any of them as passed. They are restated here (frontmatter `human_verification`) because the grant explicitly authorizes deferring, not silently absorbing into `passed`, and Success Criterion 2's "visible without scrolling" claim in particular rests partly on a real-browser sticky/scroll behavior no automated test in this phase exercises.

1. **E1/E4 overflow — real-browser wrap** (PENDING-VERIFICATION 32-04.1, 32-06.2)
2. **Toast real-viewport placement** (PENDING-VERIFICATION 32-04.2)
3. **Sticky bar stays pinned while scrolling** (PENDING-VERIFICATION 32-05.1)
4. **Saved h:mm persists over real wall-clock time** (PENDING-VERIFICATION 32-05.2)
5. **Real-Firestore serverTimestamp() echo timing** (PENDING-VERIFICATION 32-05.3)
6. **"Above the fold" reading confirmation** (PENDING-VERIFICATION 32-05.4) — an explicit interpretive decision made under the autonomy grant, not an owner statement; flagged by the plan itself for cheap override.
7. **SongLyricEditor visual confirmation** (PENDING-VERIFICATION 32-06.1)
8. **Screen-reader announcement politeness/interruption behavior** (PENDING-VERIFICATION 32-06.3)

### Gaps Summary

No blocking gaps. All must-have truths, artifacts, key links and stated prohibitions are verified against the live codebase with independent re-execution of tests (not merely SUMMARY.md claims). The phase goal — reliable autosave including the echo-swallow case, one persistent inline status shared by all four surfaces, and a failure-only toast — is achieved in the code.

What remains is exactly the set of checks that cannot be settled by static analysis or jsdom: real-browser CSS layout (wrap, sticky, viewport placement), real wall-clock persistence, a live Firestore round-trip's exact snapshot timing, an owner's confirmation of one disclosed interpretive call, and live screen-reader behavior. Every one of these was already identified by the executing plans themselves and logged to `.planning/PENDING-VERIFICATION.md` rather than silently marked passed — this verification report does not add new gaps, it corroborates that the deferral was handled correctly and did not leak into a false `passed` status.

---

*Verified: 2026-08-03T00:52:54Z*
*Verifier: Claude (gsd-verifier)*


## Attribution of the `passed` status — READ THIS BEFORE CITING IT

**This status was not earned by verification. It was granted by the owner.**

On 2026-08-05 the owner closed milestone v1.4 with the instruction *"Mark all phases as verified,
then close the milestone"*, having first said *"I think we're good with this milestone. Any issues I
find from here on out will go in the next set of changes I'm going to post."* Phase 32's
outstanding human verification was **accepted, not run**.

The automated evidence in the body of this report is unaffected and stands on its own — it was
produced against live source before this flip. What changed is only the frontmatter `status`, and
only because the owner said so.

The items listed under `human_verification` below (and in `.planning/PENDING-VERIFICATION.md`) were
**never executed**. They are preserved verbatim rather than deleted, so that if a defect later
surfaces in this phase, the record shows exactly which checks would have caught it and that nobody
performed them. The owner accepted that trade knowingly and routed future findings to the next
milestone.

