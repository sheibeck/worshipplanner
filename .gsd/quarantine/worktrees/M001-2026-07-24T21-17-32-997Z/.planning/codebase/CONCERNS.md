# Codebase Concerns

**Analysis Date:** 2026-07-16

## Tech Debt

**Large monolithic ServiceEditorView component:**
- Issue: `./src/views/ServiceEditorView.vue` is 2176 lines, containing complex autosave logic, AI suggestions, Planning Center export, multiple watchers, event listeners, and state management all in one file
- Files: `./src/views/ServiceEditorView.vue`
- Impact: Hard to maintain, difficult to test, high cognitive load, increased risk of regression. Component manages 20+ reactive refs and multiple watchers, making state changes difficult to reason about
- Fix approach: Break into smaller composables and sub-components (e.g., autosave, AI suggestions, export flow, slot management as separate modules)

**Incomplete test coverage for Vue components:**
- Issue: Only 36 test files exist for ~71 source files. Most Vue components lack unit tests. Examples: `./src/components/AppShell.vue`, `./src/components/AppSidebar.vue`, `./src/components/SongFilters.vue`, `./src/components/ServiceCard.vue`, `./src/views/DashboardView.vue`
- Files: Multiple files in `./src/components/` and `./src/views/`
- Impact: UI bugs can slip through undetected. Refactoring is risky. No safety net for component behavior changes
- Fix approach: Add Vitest + Vue Test Utils tests for key components, starting with ServiceCard, SongSlideOver, and modal components

**Scattered API rate-limiting logic:**
- Issue: Planning Center API rate limiting is implemented with hardcoded batch sizes (BATCH_SIZE = 3) in multiple functions (`fetchAndMapPeople`, `fetchAndMapPcSongs`). No unified rate limiter
- Files: `./src/utils/planningCenterApi.ts` (lines ~1152, ~230)
- Impact: If PC rate limits change, multiple locations must be updated. Fragile to future API changes
- Fix approach: Extract a reusable rate limiter utility with configurable batch size and delay

**Silent error swallowing in export flow:**
- Issue: Three `createPlanTime` calls in PC export silently catch errors with `.catch(() => {})` (lines 1937, 1944, 1950 in ServiceEditorView.vue)
- Files: `./src/views/ServiceEditorView.vue:1937, 1944, 1950`
- Impact: Rehearsal times fail silently during export. User doesn't know export is partially failed. Could mask network/auth issues
- Fix approach: Log errors and show warning toast if rehearsal time creation fails (non-fatal, but user should be informed)

## Known Bugs

**Autosave race condition risk:**
- Symptoms: If user makes rapid edits while autosave is in progress, state mutations could happen during save, leading to inconsistent data
- Files: `./src/views/ServiceEditorView.vue:1196-1240` (autosave watcher), line 946 (autosaveTimer)
- Trigger: Rapidly editing service slots while autosave is saving
- Workaround: Current implementation has guard checks (`autosaveStatus`) but race window still exists if remote listener fires during save

**Firebase listener subscription leak risk:**
- Symptoms: If user navigates away during listener setup, subscription might not be cleaned up properly
- Files: `./src/stores/auth.ts:114-138` (member snapshot listener)
- Trigger: User logs out or switches orgs while member document is being subscribed
- Workaround: Existing `memberUnsub?.()` check mitigates this, but the check doesn't guard the subscription setup itself

## Security Considerations

**Planning Center credentials storage:**
- Risk: PC App ID and Secret are stored in Firestore org documents unencrypted
- Files: `./src/stores/auth.ts` (lines 39-40, 107-108), `./firestore.rules` (lines 50-54)
- Current mitigation: Firestore rules require editor role to read/write these fields. However, any editor can export credentials
- Recommendations: (1) Never store PC Secret at rest; (2) Use time-limited OAuth tokens instead of permanent credentials; (3) Store Secret only in server-side Cloud Function environment, never in client Firestore; (4) Implement audit logging for credential access

**Email validation on invite acceptance:**
- Risk: `firestore.rules` line 47 uses `request.auth.token.email.lower() == email` but email normalization may not match all edge cases (+ addressing, domain case sensitivity)
- Files: `./firestore.rules:47`, `./firestore.rules:69`
- Current mitigation: Firebase Auth handles email normalization for most cases
- Recommendations: Add unit tests for email case-sensitivity edge cases in Firestore rules (use `firebase emulators:exec`)

**Public read on share tokens:**
- Risk: `./firestore.rules:79` allows `allow read: if true;` — anyone with a share token URL can read the quarter data
- Files: `./firestore.rules:78-86`
- Current mitigation: Share tokens are long UUIDs (guessable in theory but not in practice). Tokens can be revoked
- Recommendations: Consider adding rate limiting on public share reads in Cloud Function proxy to prevent brute-force attacks

## Performance Bottlenecks

**Synchronous DOM reflow in QuarterGrid:**
- Problem: `./src/components/QuarterGrid.vue` renders a large table with dynamic row highlighting (`isChanged(date)` computed on every cell). Changing status badge can trigger full grid re-render
- Files: `./src/components/QuarterGrid.vue:26-27` (class binding on `isChanged`)
- Cause: `isChanged` is a computed property checking `lastRegenerate` ref, which changes for many dates at once
- Improvement path: Memoize `isChanged` results, use CSS custom properties for dynamic colors instead of computed classes, or virtualize the table for large quarters

**AI suggestion API calls without debouncing:**
- Problem: AI song/scripture suggestions are fetched per slot, potentially triggering many parallel Claude API calls
- Files: `./src/views/ServiceEditorView.vue` (around line 2000+, suggestion fetch logic)
- Cause: Each slot picker can independently request suggestions without coordination
- Improvement path: Implement request debouncing, combine multi-slot requests into one batch, or cache suggestions per sermon context

**Large ServiceEditorView re-renders:**
- Problem: ServiceEditorView watches deeply (`watch(..., { immediate: true, deep: true })`). Any nested slot change triggers full component re-render
- Files: `./src/views/ServiceEditorView.vue:1196-1200` (autosave watcher with deep: true)
- Cause: Deep watching on `localService` object
- Improvement path: Watch specific sub-paths instead of entire object; split slot management into child components with shallow re-renders

## Fragile Areas

**SortableJS integration:**
- Files: `./src/views/ServiceEditorView.vue:1024-1040` (Sortable initialization and watch)
- Why fragile: Direct DOM manipulation with Sortable.js after slots are dynamically rendered. If slot template changes (IDs, classes, structure), drag-drop breaks silently. No error handling for Sortable initialization failures
- Safe modification: (1) Keep slot HTML structure stable (e.g., don't rename data attributes); (2) Add try-catch around Sortable.create; (3) Reset Sortable if slots array changes
- Test coverage: No tests for drag-drop behavior; manual testing only

**JSON.parse on Firestore snapshots:**
- Files: `./src/views/ServiceEditorView.vue:1168-1169` (JSON.parse on remoteJson)
- Why fragile: Assumes `found` (Firestore document) serializes perfectly. If Firestore changes field types or adds Timestamp serialization issues, parse could fail silently (caught but logged only)
- Safe modification: Add schema validation after parse (e.g., zod or similar); add explicit error handling with user feedback, not just console.error
- Test coverage: No tests for corrupt/invalid Firestore data

**Scheduler algorithm correctness:**
- Files: `./src/utils/scheduler.ts:74-200+` (proposeQuarterSchedule function)
- Why fragile: Complex algorithm with many edge cases (blackout dates, pairings, role groups, frequency tiers). Despite good documentation, any change to the scoring logic could silently produce suboptimal or invalid schedules
- Safe modification: (1) Run full test suite before any changes; (2) Add property-based testing (e.g., generative testing with random quarters); (3) Add regression tests for known edge cases
- Test coverage: Existing test file `./src/utils/__tests__/scheduler.test.ts` but may not cover all edge cases (no line coverage visible)

**Firestore listener lifecycle in auth store:**
- Files: `./src/stores/auth.ts:112-138` (onSnapshot setup inside loadOrgContext)
- Why fragile: Listener is set on component lifecycle boundaries. If Firebase initialization is slow or if user navigates during subscription, listener could fire with stale data. No explicit error handling on listener subscription failures
- Safe modification: (1) Add try-catch around onSnapshot; (2) Add unsub guard in case of rapid org switches; (3) Log listener errors
- Test coverage: Auth store has tests but listener lifecycle not explicitly tested

## Scaling Limits

**Planning Center export pagination:**
- Current capacity: Fetches up to 100 plan items per page, 25 plans per page. No built-in pagination loop for large quarters
- Limit: Quarters with more than 100 slots could overflow page limits. Plans endpoint returns only 25 results, requiring manual pagination for service type history
- Scaling path: Implement automatic pagination in `fetchPlanItems`, `fetchPlans`, etc. Add progress indicator for large exports

**Song library size and search performance:**
- Current capacity: Song library can store thousands of songs. Filter/search is client-side on full library
- Limit: As library grows beyond 5000+ songs, search and AI suggestion compilation may become slow
- Scaling path: Implement server-side song filtering, add full-text search index in Firestore, paginate song library on initial load

**Firestore write batches:**
- Current capacity: Batches are limited to 500 operations (Firestore hard limit)
- Limit: Importing many volunteers (1000+) or songs (1000+) could hit this limit
- Scaling path: Split imports into multiple batches automatically; show progress per batch

## Dependencies at Risk

**@anthropic-ai/sdk version 0.78.0:**
- Risk: Claude API SDK is pinned to specific version. Breaking changes in future versions could require rewrite of suggestion logic
- Impact: Song and scripture suggestion features would break if SDK API changes
- Migration plan: Pin to stable major version only (^0.78.0), set up monitoring for new releases, add tests for API contract

**firebase library (^12.0.0):**
- Risk: Major version pinned but within major version range. Firebase v13+ could have breaking changes in auth, Firestore listeners
- Impact: Auth flow, real-time sync, could break
- Migration plan: Set up CI to test against latest Firebase version, maintain compatibility layer for major API changes

**Vite dev proxy configuration:**
- Risk: Development proxies for Anthropic, ESV, Planning Center APIs are hardcoded in `vite.config.ts:30-59`
- Impact: If any external API changes base URL or auth scheme, dev server breaks. Production uses Cloud Functions for these proxies (no Vite dependency), but dev experience degrades
- Migration plan: Move proxy config to environment file, add validation that proxies are reachable at startup, provide clear error messages if proxy targets are down

## Missing Critical Features

**Error boundary for Vue components:**
- Problem: No Vue error boundary component exists. If a component throws during render, entire page crashes
- Blocks: Cannot safely isolate errors to individual panels/modals
- Recommendation: Implement `<ErrorBoundary>` component using Vue 3's onErrorCaptured hook; wrap each major view/modal

**Real-time collaboration conflict resolution:**
- Problem: Multiple editors editing same service simultaneously can cause data loss if they save concurrently
- Blocks: Can't safely enable simultaneous editing by multiple users
- Recommendation: Implement Operational Transformation or CRDT-based conflict resolution; add "last write wins" indicator with conflict warning

**API request retry logic:**
- Problem: Network failures in Planning Center export are fatal. No exponential backoff or retry logic
- Blocks: Flaky networks cause complete export failure
- Recommendation: Add exponential backoff retry wrapper for fetch calls; max 3 retries with 1s base delay

## Test Coverage Gaps

**Planning Center API integration:**
- What's not tested: Full export flow end-to-end (fetch → validate → create plan → add items → add times). Individual functions are tested but orchestration logic isn't
- Files: `./src/utils/planningCenterApi.ts`, `./src/views/ServiceEditorView.vue:1900-2100` (export flow)
- Risk: Export can partially fail (items created but times not, etc) without feedback to user
- Priority: High

**Firebase Firestore rules:**
- What's not tested: Edge cases like email case sensitivity, org slug reassignment (should fail), cross-org data access (should fail)
- Files: `./firestore.rules`
- Risk: Security rules could have gaps allowing unauthorized access
- Priority: High (security-critical)

**Vue component behavior under error conditions:**
- What's not tested: Component rendering when API calls fail, null data arrives, network timeouts occur
- Files: Most components in `./src/components/` and `./src/views/`
- Risk: UI could become unresponsive or show confusing error states
- Priority: Medium

**Autosave conflict resolution:**
- What's not tested: User edits while remote update arrives, autosave saves during listener update, race between save and fetch
- Files: `./src/views/ServiceEditorView.vue:1196-1240`
- Risk: Data could be lost or corrupted in edge cases
- Priority: High

**Scheduler algorithm edge cases:**
- What's not tested: Person paired with unavailable person, role group violations with pairings, frequency tier changes mid-quarter
- Files: `./src/utils/scheduler.ts`
- Risk: Scheduler could produce invalid or unexpected assignments
- Priority: Medium

---

*Concerns audit: 2026-07-16*
