---
phase: 114-multi-monitor-assignment-rework
reviewed: 2026-09-03T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - src/utils/monitorConfig.ts
  - src/views/MonitorSetupView.vue
  - src/components/MonitorCard.vue
  - src/composables/useRunControl.ts
  - src/composables/useOutputWindow.ts
  - src/components/run/RunDisplaysPanel.vue
  - src/components/run/RunPreflightPanel.vue
  - src/views/RunControlView.vue
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: resolved
resolved_at: 2026-09-03
resolution: All 6 findings (WR-01, WR-02, IN-01..IN-05) fixed. type-check clean; app suite at documented baseline (only storage.rules.test.ts fails — Storage-emulator env limit).
---

# Phase 114: Code Review Report

**Reviewed:** 2026-09-03
**Depth:** deep (cross-file: monitorConfig ↔ useRunControl ↔ output views ↔ run panels)
**Files Reviewed:** 7 source (+ paired tests skimmed)
**Status:** issues_found (no Critical/High — 2 Medium, 4 Low)

## Summary

The core of the rework is sound. The delta `matchMapping` is correct across the edge cases called out in the brief (add-only, remove-only, simultaneous add+remove, all-removed, empty-mapping), the v2 fingerprint drops the macOS-volatile `left/top/isPrimary` and disambiguates identical monitors by sorted-position index as designed, and the per-assignment window records are keyed by fingerprint so two Audience windows never collide and a reopen targets the same window. `isValidMapping` treats localStorage as untrusted and validates every field including nickname type + length; `attemptScreenTargetedFullscreen` reads the untrusted `?screen=` query, is fully wrapped in try/catch, and fails closed on absent-API / permission-denied / fingerprint-mismatch. No `v-html`/`innerHTML` touches any phase-114 output path (nickname and reassign labels are text-interpolated, so no stored-XSS via the nickname field). **AudienceOutputView.vue and ConfidenceOutputView.vue are confirmed untouched** by this phase's diff. No debug artifacts (`console.*`, TODO, `debugger`) in any changed file.

The two Medium findings are both **consequences of RunHeader not being reworked** — the phase retained role-collapsed compatibility shims (`audienceOpen`/`confidenceOpen` etc.) so the unchanged header keeps compiling, and left `savedAssignments` on the pre-existing non-reactive `loadMapping()` read. Neither breaks the primary configure→run flow, but both degrade the *headline* multiple-Audience feature at the edges. The Lows are robustness/quality.

## Verdict on brief focus points

- Delta `matchMapping` (add+remove, identical-monitor index, empty mapping): **correct.**
- Fingerprint stability when position/isPrimary change: **correct** (identity ignores those fields).
- ≥1-Audience gate vs empty-mapping dev-fallback exemption: **correct and internally consistent** (`canGoLive`, `fallbackAssignments`, `canSave` all agree).
- Per-assignment window keying / reopen targeting: **correct** (see WR-02 for a narrow sanitization edge).
- `isValidMapping` untrusted-read hardening: **complete.**
- `?screen=` untrusted fingerprint handling + `attemptScreenTargetedFullscreen` fail-closed: **correct.**
- Output views untouched: **confirmed.**

## Warnings

### WR-01: Multiple-Audience state is misrepresented and only partly recoverable from RunHeader

**File:** `src/composables/useRunControl.ts:434-451`, consumed by `src/components/run/RunHeader.vue:12-13,32-35,92,113` (via `src/views/RunControlView.vue:22-23,26,312-313`)
**Severity:** Medium
**Status:** FIXED — `audienceOpen`/`confidenceOpen` now aggregate over ALL same-role assignments via `roleOpen()` (healthy only when the role has ≥1 assignment and every one is open), so the header dot no longer reads GREEN while a second Audience display is dark. `reopenOutput('audience'|'confidence')` now reopens EVERY not-open monitor of that role (fingerprint ids still target one row). Removed the now-dead shims `audienceLabel`, `confidenceLabel`, `audience`, `confidence`, `audienceClosed`, `confidenceClosed`, `audienceFullscreen`, `confidenceFullscreen` (plus the internal `mappingLabel`/`firstAssignment`) — verified unused by RunHeader.vue (binds only `audienceOpen`/`confidenceOpen`) and all tests.

**Issue:** The retained shims collapse N same-role monitors to `firstAssignment(role)`:
```ts
const audienceOpen = computed(() => isAssignmentOpen(firstAssignment('audience')))
```
RunHeader (not reworked in this phase) renders exactly one Audience dot and one Confidence dot bound to these. With two Audience monitors where #1 is open and #2 is closed, `firstAssignment('audience')` is #1, so the header dot reads GREEN/"open" while a congregation display is actually dark — the operator's at-a-glance status lies for the phase's headline feature. Worse, the header's `@reopen('audience')` routes through `resolveTargetAssignment('audience', …)` → `firstAssignment('audience')`, so the second Audience window **cannot be reopened from the header at all**. `RunDisplaysPanel` (State B) does render per-display rows correctly and is the primary recovery surface, so this is a degraded-summary gap, not a total failure — hence Medium not High.

**Fix:** Either (a) drive the header dots from an aggregate over all same-role assignments (`displays.filter(d => d.role==='audience').every(d => d.open)` for open, and reopen *all* not-open audience displays), or (b) explicitly document RunHeader as a first-of-role summary and lean on RunDisplaysPanel for multi-monitor recovery. Also delete the now-unused shims (`audienceLabel`, `confidenceLabel`, `audience`, `confidence`, `audienceClosed`, `confidenceClosed`, `audienceFullscreen`, `confidenceFullscreen`) that RunControlView no longer consumes after the rewiring — they are dead exports and a footgun inviting future first-of-role reuse.

### WR-02: `savedAssignments` is cached off a non-reactive `loadMapping()`, so a mid-session reconfigure is invisible to the go-live gate and display list

**File:** `src/composables/useRunControl.ts:406`
**Severity:** Medium
**Status:** FIXED — `savedAssignments` now derives from a reactive `savedMapping = ref<MonitorMapping|null>`, refreshed via `refreshSavedMapping()` on mount, on the cross-tab `storage` event (keyed to `MONITOR_CONFIG_STORAGE_KEY`, which is how the "Open monitor setup in a new tab" recovery save reaches this tab), on window `focus`, in the go-live path, and in `reopenReassignedOutputs`. `canGoLive`/`displays` no longer ride a stale first-read cache. Listeners are removed in `onUnmounted`.

**Issue:**
```ts
const savedAssignments = computed<MonitorAssignment[]>(() => loadMapping()?.assignments ?? [])
```
`loadMapping()` reads `localStorage` and touches no reactive state, so this `computed` evaluates once and memoizes forever. `canGoLive`, `displays`, `audienceLabel`, `confidenceLabel` all derive only from `savedAssignments.value`, so the **assignment set is frozen at first read** (the per-row `open/closed/fullscreen` fields *do* update, since they read reactive refs). The reassign-recovery flow explicitly offers "Open monitor setup in a new tab" (`useRunControl.ts:591`); if the operator reconfigures and saves there mid-service, the Run view's Displays/Preflight panels and the ≥1-Audience gate keep showing the stale set. `reopenReassignedOutputs`/`reopenOutput` dodge this by re-reading `loadMapping()` fresh (lines 525, 672), so the primary reopen action still works — which is why this is Medium, and it mirrors the pre-existing `mappingLabel` pattern. But `canGoLive` is now a real gate, so a stale cache here is more load-bearing than before.

**Fix:** Make the mapping a reactive source — e.g., hold a `ref<MonitorMapping | null>` refreshed on mount, on the `storage` event, and after `reopenReassignedOutputs`, and derive `savedAssignments` from it — so the gate and the display list reflect the live configuration. At minimum, refresh it in the reassign path so a mid-service reconfigure surfaces.

## Info

### IN-01: Any single display change at go-live drops auto-placement for the unchanged monitors

**File:** `src/composables/useRunControl.ts:833-838`
**Severity:** Low
**Status:** FIXED — the go-live `partial` branch now calls a new `openMixed(kept, changed, screens)`: still-matched (`kept`) assignments open PLACED on their resolved screens (R327 preserved) and only the changed delta opens un-positioned. `no-mapping` still uses the dev-fallback pair. Reported as `fallback` because some output still needs manual placement.

**Issue:** At go-live, `matchMapping !== 'matched'` falls to `openAllUnplaced(fallbackAssignments(saved))`, opening *every* assignment un-positioned. So if one display is added/removed, the still-matched monitors also lose the R327 screen-targeted placement and must be dragged, even though their fingerprints resolve cleanly. The elsewhere-in-phase delta model keeps matched assignments; the launch path is all-or-nothing.

**Fix:** In the `partial` case, `openAllPlaced(result.kept, details.screens)` for the kept assignments and `openAllUnplaced` only for the delta — preserving placement for the monitors that did not change.

### IN-02: A nickname on a monitor set to "None" is silently discarded on Save

**File:** `src/views/MonitorSetupView.vue:292-297`
**Severity:** Low
**Status:** FIXED (artifact option b) — `onSelectRole` now clears `nicknameByFingerprint[fingerprint]` when the card is set to None, so the nickname loss is VISIBLE immediately rather than a silent drop on Save. Chose the visible-clear over persisting None nicknames because a None monitor never appears in Run mode, so a persisted None nickname would have no consumer, and extending the persisted schema would ripple into `isValidMapping`/`matchMapping` (untrusted-read hardening) for no downstream benefit.

**Issue:** `onSave` builds assignments by iterating `roleByFingerprint` only, so a fingerprint the user nicknamed but left as `None` never reaches the mapping — the typed nickname is lost without warning.

**Fix:** Acceptable if intentional (nicknames only matter for assigned displays); if user input should survive, persist nicknames for `None` monitors too, or clear the input when a card is set to None so the loss is visible.

### IN-03: `windowNameFor` sanitization can collide two distinct fingerprints

**File:** `src/composables/useRunControl.ts:46-48`
**Severity:** Low
**Status:** FIXED — `windowNameFor` now appends a 32-bit FNV-1a hash (base-36) of the RAW fingerprint to the lossy sanitized segment (`wp-output-<readable>-<hash>`), so two fingerprints differing only in punctuation resolve to distinct window names. Deterministic + pure, so callers/tests computing the name via `windowNameFor` stay aligned.

**Issue:** `assignment.fingerprint.replace(/[^a-zA-Z0-9]/g, '_')` maps every non-alphanumeric char to `_`, so two genuinely distinct fingerprints that differ only in punctuation/spacing (e.g. OS labels `"Dell 1"` vs `"Dell-1"` at the same resolution and group index) collapse to the same window name. `window.open` would then reuse one window and one physical monitor would never receive its output. Low likelihood (requires near-identical labels) and the fingerprints themselves stay distinct so `matchMapping` is unaffected — only window orchestration collides.

**Fix:** Derive a collision-free name (e.g. hash the raw fingerprint, or index by array position within a per-session map) rather than a lossy character substitution.

### IN-04: Stale `fullscreenByWindowName` entry not cleared on reopen (brief false "Fullscreen ✓")

**File:** `src/composables/useRunControl.ts:517-534`
**Severity:** Low
**Status:** FIXED — reopen was refactored into `reopenAssignmentWindow`, which now sets `fullscreenByWindowName.value[name] = false` alongside the `closed=false`/`opened=true` resets, so no stale "Fullscreen ✓" shows between reopen and the fresh child's first `reportFullscreenState`.

**Issue:** `reopenOutput` resets `closedByWindowName`/`openedByWindowName` but leaves `fullscreenByWindowName[name]` at its pre-close value. Between reopen and the fresh child window posting its (false) `wp-fullscreen-state`, RunDisplaysPanel can briefly render the "Fullscreen" done badge for a window that is not yet fullscreen. Self-corrects on the child's first `reportFullscreenState`.

**Fix:** Set `fullscreenByWindowName.value[name] = false` alongside the `closed=false`/`opened=true` resets in `reopenOutput`.

### IN-05 (test coverage, not a source defect): `matchMapping` lacks add+remove and all-removed cases

**File:** `src/utils/__tests__/monitorConfig.test.ts:266-327`
**Severity:** Low
**Status:** FIXED — added two `matchMapping` cases: a simultaneous add+remove (B swapped for C — asserts `kept` excludes B and `newScreens` contains only C) and an all-removed case (both saved monitors gone — asserts `kept === []` and `newScreens` = the lone new screen). Both pass.

**Issue:** Tests cover matched / no-mapping / add-only / remove-only, but not the simultaneous add-AND-remove case nor the all-saved-removed case, both explicitly named in the review brief. The source handles both correctly (verified by trace), but they are untested regression guards.

**Fix:** Add a `partial` case where one monitor is removed and another added (assert `kept` excludes the removed and `newScreens` contains the added), and a case where every saved fingerprint is gone (assert `kept === []`, `newScreens === all`).

---

_Reviewed: 2026-09-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
