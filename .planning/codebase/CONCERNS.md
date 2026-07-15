<!-- refreshed: 2026-07-15 -->
# Codebase Concerns

**Analysis Date:** 2026-07-15

## Tech Debt

### Monolithic Service Editor Component

**Issue:** `src/views/ServiceEditorView.vue` is 2,176 lines with 20+ reactive state refs, 11 lifecycle hooks, and complex nested watchers. This is the most critical component in the app but is extremely difficult to maintain, test, and reason about.

**Files:** `src/views/ServiceEditorView.vue`

**Impact:** 
- Hard to debug state interactions
- Difficult to add new features without unintended side effects
- No test coverage for the component
- High risk of introducing bugs during modifications
- Poor performance potential due to deep reactivity tracking

**Fix approach:**
Extract functionality into smaller, composable pieces:
1. Separate autosave logic into a custom composable (`useAutosave.ts`)
2. Extract PC export workflow into a dedicated service module (`src/utils/pcExportOrchestrator.ts`)
3. Create separate sub-components for distinct sections (AI suggestions UI, export dialog, slot list, etc.)
4. Use a state machine library or explicit state management for the export dialog flow

### Org Document Not Live-Synced (Pitfall 2)

**Issue:** The `organizations` document is loaded once via `getDoc()` in `src/stores/auth.ts:loadOrgContext()` but is never listened to with `onSnapshot()`. Changes made by other users (e.g., another browser tab changing settings) are not reflected until a full page reload.

**Files:** `src/stores/auth.ts` (line 82-110), `src/views/SettingsView.vue` (lines 315-322)

**Impact:**
- Multi-tab browsing shows stale data (vwModeEnabled, pcAppId, pcSecret, orgName, orgSlug)
- Collaborative settings changes are not immediately visible to all users of the organization
- Users may overwrite each other's settings unknowingly
- PC credentials could become out of sync

**Fix approach:**
Replace the one-time `getDoc()` in `loadOrgContext()` with a persistent `onSnapshot()` listener that updates the store whenever the org document changes. Clean up the listener in `logout()`.

### Silent Failures in Service Store

**Issue:** `src/stores/services.ts` functions `updateService()`, `deleteService()` return early if `orgId.value` is null without throwing or logging errors (lines 79, 87). This can lead to silent data loss where the user thinks their changes were saved but nothing was persisted.

**Files:** `src/stores/services.ts` (lines 78-89)

**Impact:**
- User edits to services may silently fail to save
- No error feedback to the user (UI shows successful, but data wasn't persisted)
- Debugging failed operations is difficult

**Fix approach:**
1. Throw an error instead of silently returning: `throw new Error('No organization selected')`
2. Add error boundary in calling code (`src/views/ServiceEditorView.vue` line 2147) to surface errors to the user
3. Add logging to track when this happens in production

## Known Bugs

### Nested onUnmounted Inside onMounted

**Issue:** `src/views/ServiceEditorView.vue:1276` registers the onUnmounted cleanup inside onMounted. While this works, it's a code smell that suggests the cleanup pattern might not behave as intended if the component remounts.

**Files:** `src/views/ServiceEditorView.vue` (lines 1261-1277)

**Symptom:** Potential keyboard event listener leaks if component rapidly mounts/unmounts

**Workaround:** None currently; works but not idiomatic Vue

**Fix approach:** Move the onUnmounted call to the top level (outside onMounted):
```typescript
onMounted(() => { ... })
onUnmounted(() => { document.removeEventListener('keydown', handleUndoKey) })
```

## Security Considerations

### Planning Center Credentials Exposure

**Issue:** `src/utils/planningCenterApi.ts` and related functions accept appId and secret as parameters throughout the codebase. While they are stored server-side in Firestore, multiple code paths handle them in memory.

**Files:** `src/utils/planningCenterApi.ts`, `src/stores/auth.ts` (pcAppId, pcSecret), `src/views/SettingsView.vue` (lines 410-468)

**Risk:** 
- Credentials passed as function parameters can be logged in stack traces
- Credentials stored in Firestore (even encrypted) could be compromised
- No audit trail of who accessed PC credentials or when

**Current mitigation:** Credentials are validated before use and stored server-side only

**Recommendations:**
1. Never log or serialize PC credentials in error messages
2. Add rate limiting to validatePcCredentials() to prevent brute-force attempts
3. Implement credential rotation policy (e.g., require re-entry every 90 days)
4. Add audit logging when credentials are used to fetch data from Planning Center

### v-html in AppSidebar (Safe but Notable)

**Issue:** `src/components/AppSidebar.vue:32` uses `v-html` with `item.icon`. While currently safe (hardcoded SVG strings in `src/components/AppSidebar.vue:84-152`), this is a potential XSS vector if navigation items ever become dynamic.

**Files:** `src/components/AppSidebar.vue` (line 32)

**Current mitigation:** Icons are hardcoded in component source code, not user input

**Recommendations:** Replace with static SVG components or icon library instead of v-html

## Performance Bottlenecks

### AI Suggestion API Calls Under Network Constraints

**Issue:** `src/utils/claudeApi.ts` makes sequential Claude API calls during the "Suggest All Songs" feature. Each call waits for a response before making the next one. Under slow network or high API latency, this could block the UI for several seconds.

**Files:** `src/views/ServiceEditorView.vue:1443-1522` (suggestAllSongs), `src/utils/claudeApi.ts:227-250`

**Problem:**
- No request timeout configured
- No request cancellation if user navigates away
- Sequential API calls are slow (should be batched if possible)
- No caching between subsequent suggestions for the same sermon context

**Improvement path:**
1. Add `timeout` parameter to `getClient().messages.create()` to fail fast on slow connections
2. Add AbortController to cancel in-flight requests when component unmounts
3. Batch all song suggestions into a single API call if possible (violates current UX but worth exploring)
4. Implement client-side caching for sermon context combinations

### Large Object Deep Copies in Service Watchers

**Issue:** `src/views/ServiceEditorView.vue` performs `JSON.parse(JSON.stringify())` copies frequently in watchers (lines 1154, 1155, 1168, 1169, 1228) to track state changes. This is inefficient for large service data with many slots.

**Files:** `src/views/ServiceEditorView.vue` (watchers section, lines 1146-1240)

**Impact:** Performance degrades with more service slots, especially during autosave

**Improvement path:**
1. Use a shallow comparison library (e.g., Immer.js) instead of deep cloning
2. Implement a more targeted dirty-check that only compares changed fields
3. Consider using Vue's `cloneDeep` or similar if data grows larger

## Fragile Areas

### Export to Planning Center Workflow

**Issue:** The `onConfirmExport()` function in `src/views/ServiceEditorView.vue` (lines 1784-2046) orchestrates a complex multi-step workflow with 30+ sequential await calls across different PC API operations. Each step can fail independently, and failure handling is catch-all per pass (not per-step).

**Files:** `src/views/ServiceEditorView.vue:1784-2046`, `src/utils/planningCenterApi.ts`

**Why fragile:**
- No transaction safety — partial exports can leave the PC plan in an inconsistent state
- Failures are collected but the export continues, potentially with partial data
- Network interruptions could leave dangling resources on PC
- No rollback mechanism if export partially succeeds but overall operation fails
- Complex branching logic for "new plan" vs "existing plan" modes with different code paths

**Safe modification:**
1. Add unit tests covering the matching/update logic (lines 1814-1839)
2. Implement a pre-flight validation step that checks all slots are compatible before starting
3. Add detailed logging for each step so failures can be traced
4. Consider breaking into smaller testable functions

**Test coverage:** No tests for `onConfirmExport()`, `checkForExistingPlan()`, or the planning center export logic

### Autosave State Machine

**Issue:** The autosave mechanism in `src/views/ServiceEditorView.vue` (lines 1046-1240) uses multiple mutable refs (`autosaveStatus`, `autosaveTimer`, `autosaveSaving`, `autosaveInitialized`) that must be kept in sync. There's an intentional guard pattern at line 1051 (`autosaveSaving`) to prevent concurrent saves, but it's not formalized.

**Files:** `src/views/ServiceEditorView.vue` (lines 944-947, 1040-1240)

**Why fragile:**
- State machine is implicit, not explicit — developers must infer the valid state transitions
- No explicit states like IDLE, PENDING, SAVING, SAVED
- Manual re-arming of the timer at line 1224 inside the timeout callback is error-prone
- Comment at line 1216 indicates this was a known pitfall ("D-17")

**Safe modification:**
Extract autosave into a composable with explicit state machine:
```typescript
type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved'
// Centralize transitions and guards
```

## Scaling Limits

### Firestore Listener Subscriptions

**Issue:** Each store (`auth.ts`, `services.ts`, `songs.ts`, `quarters.ts`, `roster.ts`) manages its own Firestore snapshot listener. If an organization has 1000+ services or 10,000+ songs, the real-time sync could become slow or hit Firestore bandwidth limits.

**Files:** `src/stores/auth.ts:114`, `src/services.ts:44`, `src/songs.ts:108+`, `src/quarters.ts:103+`

**Current capacity:** No known limit, but likely breaks at 10k+ records

**Limit:** Firestore document reads + writes; no pagination used on large collections

**Scaling path:**
1. Implement pagination/cursor-based loading for large collections
2. Use Firestore sharding for high-write collections
3. Consider moving song library to a separate read-optimized database

## Dependencies at Risk

### Anthropic SDK (`@anthropic-ai/sdk` ^0.78.0)

**Risk:** The SDK is vendored with a placeholder API key in client-side code (`src/utils/claudeApi.ts:68`) and relies on a server-side proxy (`/api/anthropic`). If the proxy goes down or the SDK changes a breaking way, AI suggestions break.

**Impact:** AI song/scripture suggestions become unavailable; users fall back to manual selection

**Migration plan:** 
- Implement a fallback suggestion service (e.g., simple keyword matching)
- Document the proxy dependency clearly
- Have a manual API key input as a backup

## Missing Critical Features

No critical features identified, but the following are at risk of becoming bugs if not addressed:

### Test Coverage for Critical Paths

**Issue:** Large, complex views like `ServiceEditorView.vue`, `SettingsView.vue`, `QuarterView.vue`, and `RosterView.vue` have zero test coverage. This increases regression risk during refactors.

**Blocks:** Confident refactoring of monolithic components

**Priority:** High — these are the core workflows

## Test Coverage Gaps

### Critical Views Untested

**Untested area:** Core service editing and export workflow

**Files:** 
- `src/views/ServiceEditorView.vue` (2,176 lines, 0 tests)
- `src/views/SettingsView.vue` (495 lines, 0 tests)
- `src/views/QuarterView.vue` (855 lines, 0 tests)
- `src/views/RosterView.vue` (676 lines, 0 tests)

**Risk:** Breaking changes to these views are only caught in manual QA or production

**Priority:** High

### Planning Center Integration Untested

**Untested area:** PC credential validation, song import, and export workflows

**Files:** 
- `src/utils/planningCenterApi.ts` (1,228 lines, 0 tests)
- `src/utils/pcSongImport.ts` (no direct tests)

**Risk:** PC API changes, authentication failures, or malformed responses could break silently in production

**Priority:** High

### Roster Store and Scheduler Logic Undertested

**Untested area:** Complex volunteer scheduling algorithm and conflict detection

**Files:** `src/utils/scheduler.ts`, `src/stores/roster.ts` (partial tests)

**Risk:** Scheduling conflicts could go undetected; edge cases in group co-occurrence rules are not validated

**Priority:** Medium

---

*Concerns audit: 2026-07-15*
