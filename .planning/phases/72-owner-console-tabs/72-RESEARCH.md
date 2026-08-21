# Phase 72: Owner Console Tabs - Research

**Researched:** 2026-08-21
**Domain:** Vue 3 SPA client-side tab shell driven by a `vue-router` query param
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tab mechanism & deep-linking (R193, R195)**
- Active tab is driven by a route **query param** `?tab=configuration|organizations`, defaulting to
  `configuration` when the param is absent or unrecognized — this makes the open tab survive a refresh and be
  directly linkable/bookmarkable (R195), the specific mechanism R195 calls for.
- Clicking a tab updates the query via `router.replace` (no history spam), keeping the URL and the visible
  pane in sync in both directions (URL→pane on load, pane→URL on click).
- Keep the route name/path unchanged (`/owner-console`, name `owner-console`); tabs are a query concern, not
  new routes — avoids touching the router guard that gates super-admin access.

**Tab UI pattern (R193)**
- Reuse the app's existing in-view tab pattern from `ServiceEditorView.vue` (a button row with active-state
  classes, `activeTab === 'x'` conditional panes) for visual and interaction consistency with the rest of the
  app — dark-theme styling (indigo active accent) matching the current console header.
- `OwnerConsoleView.vue` becomes a **thin tab shell**: it renders the header, the tab strip, and the active
  pane. Configuration selected by default.

**Configuration tab = current console body, unchanged (R194)**
- The Configuration pane contains the **entire existing console body verbatim**: the super-admins roster
  (grant/revoke via `setSuperAdminClaim`, inline revoke-confirm, empty/loading states) and the four config
  cards (`CleanupConfigCard`, `AiProxyConfigCard`, `MessagingConfigCard`, `SenderConfigCard`) plus the
  provenance stamp and the dashed deploy-time note.
- **No behavior change**: the `superAdmins` onSnapshot subscription and `appConfigStore.subscribe()` /
  `unsubscribe()` lifecycle, all grant/revoke handlers, and all card validation/provenance behavior are
  preserved exactly — only their location moves under the Configuration pane. Planner's discretion whether to
  extract the body into a `ConfigurationTab.vue` child or wrap it inline under a `v-if` pane; either is
  acceptable as long as behavior and the existing subscriptions are byte-preserved and the pane still mounts
  its subscriptions when the console loads (do not lazy-defer the roster/appConfig subscriptions behind a tab
  click — they must remain active on load exactly as today, so provenance and roster are current regardless of
  which tab is open).

**Organizations tab = placeholder shell only (R193, scope guard)**
- The Organizations pane renders a simple **empty-state placeholder** this phase (e.g. a heading + muted
  "Organization management is coming in this milestone" line, matching the console's card styling). No data
  fetch, no callables, no forms. Phase 74 replaces this placeholder with the real list + onboarding UI.

**Access gate (unchanged)**
- No new access surface: both panes live inside the already-super-admin-gated `/owner-console` route and its
  existing router guard + `isSuperAdmin()` rules. This phase introduces no new gate, claim, rule, or callable.

**Tests (SC4)**
- Carry forward and adapt `OwnerConsoleView.test.ts` so every pre-existing assertion (roster grant/revoke
  flow, the four cards' presence, provenance stamp) still passes under the tab shell — proving the restructure
  changed location, not behavior. Add coverage for: default tab = Configuration, tab switch via query param,
  deep-link to `?tab=organizations` landing on the Organizations pane on load.

### Claude's Discretion
- Exact component decomposition (thin-shell + extracted `ConfigurationTab.vue`/`OrganizationsTab.vue` vs.
  inline `v-if` panes), tab-strip markup details, and placeholder copy — all at the planner's/executor's
  discretion within the decisions above. *(This research recommends the extracted-component option — see
  Summary and Architecture Patterns below — but both remain valid per CONTEXT.)*

### Deferred Ideas (OUT OF SCOPE)
- Organizations list, onboarding flow, and admin assignment → **Phase 74** (this phase ships only the tab
  shell + placeholder).
- Multi-org Storage auth claim widening → **Phase 73**.
</user_constraints>

## Summary

This is a low-risk, in-repo layout refactor with zero new libraries and zero new attack surface.
Every pattern this phase needs already exists in this codebase: `ServiceEditorView.vue` already
runs a query-agnostic local-`activeTab` tab strip with `v-show` panes; `RosterView.vue` already
reads a route query param (`?edit=`) with `useRoute()` guarded for the no-router-in-test case; and
`OwnerConsoleView.vue`'s own test file (`src/views/__tests__/OwnerConsoleView.test.ts`) already
mounts the view with no router installed at all, which is the single biggest constraint on the
implementation: `useRoute()`/`useRouter()` return `undefined` in that harness, so every access to
`route`/`router` must be optional-chained, and the default (no query) path must still resolve to
the Configuration tab so the 7 existing tests keep passing unmodified.

The two panes' behavioral asymmetry drives the architecture: the Configuration pane owns two live
Firestore subscriptions (`superAdmins` collection `onSnapshot`, `appConfigStore.subscribe()`) that
are **not** idempotency-guarded in `appConfig.ts` — calling `subscribe()` twice leaks a listener,
calling it zero times on tab-switch-back leaves the roster/config stale. The only way to guarantee
"subscriptions active on load regardless of which tab is open" (CONTEXT, R194) without special-casing
is to keep the Configuration pane's owning component permanently mounted — i.e. **`v-show`, never
`v-if`**, for both panes — exactly the choice `ServiceEditorView.vue` already made for its own tabs.

The one non-obvious codebase-specific gotcha, already documented in-repo
(`ServiceEditorView.test.ts:269-282`): this project's jsdom test environment does not make VTU's own
`wrapper.isVisible()` reliably reflect an ancestor's inline `display:none` from `v-show`, so
`wrapper.text()`-based assertions cannot distinguish "which pane is showing." The existing test suite
already solved this with a hand-rolled `isVShowHidden()` walking-ancestor helper — the Phase 72 tests
for R195's deep-link/tab-switch behavior must reuse this exact pattern (or the `data-testid` +
`.isVisible()`/style-check idiom `ServiceEditorView.vue:748` already uses), not add new fragile
`wrapper.text()` assertions.

**Primary recommendation:** Extract the current console body into a new `ConfigurationTab.vue`
(byte-identical move of the existing template + script) and a new placeholder `OrganizationsTab.vue`,
both under `src/components/admin/`, alongside the four existing config cards. `OwnerConsoleView.vue`
becomes a thin shell: header, a 2-button tab strip mirroring `ServiceEditorView.vue:695-746`, and two
`v-show`-toggled panes wrapping those two child components. Drive `activeTab` from `route?.query.tab`
on load with a `normalizeTab()` helper (default `'configuration'` for absent/unrecognized/array
values), and write it back via `router?.replace({ query: { ...route.query, tab } })` on tab click —
no new route, no router-guard change.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Active-tab selection & URL sync | Browser / Client | — | Pure client-side SPA state (`vue-router` `createWebHistory`, no SSR in this project); the query param lives entirely in the browser's history/URL |
| Super-admin roster display + grant/revoke | Browser / Client | API / Backend | Client subscribes via Firestore `onSnapshot`; the actual privileged write happens server-side in the existing `setSuperAdminClaim` onCall (Phase 68, unchanged) |
| Platform config cards (Cleanup/AI Proxy/Messaging/Sender) | Browser / Client | Database / Storage | Client subscribes to `appConfig/global` via the existing `appConfigStore`; Firestore is the source of truth (unchanged) |
| Organizations placeholder | Browser / Client | — | Static render only this phase — no data fetch, no backend call (Phase 74 adds the backend) |
| Super-admin access gate | API / Backend (rules) + Browser / Client (guard) | — | Unchanged — enforced by `firestore.rules`' `isSuperAdmin()` and `router/index.ts`'s `requiresSuperAdmin` guard; this phase adds no new gate |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vue-router` | `^5.0.3` (installed `5.0.3`; latest on npm `5.2.0` `[VERIFIED: npm registry]`) | Client-side routing + reactive `route.query` for the tab param | Already the project's sole router; no alternative under consideration |

No new package installation is required — `vue-router` is already a `package.json` dependency and
already used throughout the app (`RosterView.vue`, `ServiceEditorView.vue`, `ShareView.vue`, etc.).

**Version verification:** `npm view vue-router version` → `5.2.0` (latest); this project's installed
`node_modules/vue-router/package.json` → `5.0.3`, satisfying the `^5.0.3` range. `[VERIFIED: npm registry]`

`useRoute()`/`useRouter()` behavior and the query-based navigation API are unchanged between
`vue-router` 4.x and 5.x for a project that does **not** use file-based routing (this project defines
routes explicitly in `src/router/index.ts`) — v5 only adds an opt-in file-based routing layer and folds
in `unplugin-vue-router`; a plain v4-style app upgrades with no code changes.
`[CITED: router.vuejs.org/guide/migration/v4-to-v5]`

### Supporting

None — no additional library is needed for a 2-tab, query-driven strip. Reaching for a headless-UI
tabs primitive (e.g. Radix/Headless UI) would be a Don't-Hand-Roll violation in the *other* direction:
this project has zero component-library dependency (`UI-SPEC.md` confirms "no shadcn, no
`components.json`") and already has a working hand-rolled tab-strip idiom used twice
(`ServiceEditorView.vue`, and — per this phase's UI-SPEC — about to become three). Introducing a new
UI-primitive dependency for a 2-tab strip would be inconsistent with the established project
convention and unnecessary.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Query param (`?tab=`) | A nested child route (`/owner-console/organizations`) | CONTEXT explicitly locks the query-param mechanism (R195's stated mechanism) and explicitly avoids touching the router guard; a nested route would require duplicating/moving the `requiresSuperAdmin` meta and is unnecessary for 2 static panes |
| `v-show` panes | `v-if` panes with subscriptions hoisted to the parent shell | Both satisfy "subscriptions never torn down on tab switch," but `v-if` requires manually lifting `superAdmins`/`appConfigStore` ownership out of `ConfigurationTab.vue` into the shell, which fights the "thin shell" decomposition CONTEXT recommends. `v-show` gets the always-mounted guarantee for free by keeping the owning component mounted, matching `ServiceEditorView.vue`'s own precedent exactly |
| Extracted `ConfigurationTab.vue`/`OrganizationsTab.vue` | Inline `v-if`/`v-show` panes directly in `OwnerConsoleView.vue` | CONTEXT calls both "acceptable." Extraction is recommended because Phase 74 is about to add substantial Organizations-tab content (list + onboard + admin-assignment UI) into whichever file hosts that pane — starting from a dedicated `OrganizationsTab.vue` keeps Phase 74's diff contained and keeps `OwnerConsoleView.vue` from growing past a thin shell |

**Installation:** None required.

## Package Legitimacy Audit

No external packages are installed by this phase. `vue-router` is an existing, already-vetted project
dependency (in use since the app's initial routing setup) — not a new install, so the Package
Legitimacy Gate protocol does not apply. No SLOP/SUS packages to report.

## Architecture Patterns

### System Architecture Diagram

```
Browser (SPA)
  │
  ├─ Page load / refresh / shared-link open on /owner-console?tab=organizations
  │     │
  │     ▼
  │  router/index.ts beforeEach guard
  │     │  requiresAuth → requiresSuperAdmin (unchanged, R177/R178)
  │     │  query string ("?tab=...") passes through untouched — not read by the guard
  │     ▼
  │  OwnerConsoleView.vue mounts (thin shell)
  │     │
  │     ├─ const route = useRoute()   // reactive; undefined only in router-less unit tests
  │     ├─ const router = useRouter() // undefined only in router-less unit tests
  │     ├─ activeTab = ref(normalizeTab(route?.query.tab))   ◄── URL → pane (on load)
  │     ├─ watch(() => route?.query.tab, v => activeTab.value = normalizeTab(v))
  │     │
  │     ├─ Tab strip render (2 buttons, active-state classes)
  │     │     └─ click → setTab(tab): activeTab.value = tab；router?.replace({query:{...route.query, tab}})
  │     │                                                      ◄── pane → URL (on click, no history entry)
  │     │
  │     ├─ <ConfigurationTab v-show="activeTab === 'configuration'" />
  │     │     │  onMounted (fires once, regardless of which pane is visible)
  │     │     ├─ onSnapshot(collection(db,'superAdmins'), ...)   [unchanged from today]
  │     │     └─ appConfigStore.subscribe()                       [unchanged from today]
  │     │           │
  │     │           ▼
  │     │     Firestore: superAdmins/*, appConfig/global (existing, no schema change)
  │     │
  │     └─ <OrganizationsTab v-show="activeTab === 'organizations'" />
  │           └─ static placeholder card — no fetch, no callable (Phase 74 fills this in)
  │
  └─ unmount → ConfigurationTab's onUnmounted fires once → unsubscribes both listeners (unchanged)
```

### Recommended Project Structure
```
src/
├── views/
│   └── OwnerConsoleView.vue          # thin shell: header + tab strip + 2 panes (rewritten)
├── components/admin/
│   ├── ConfigurationTab.vue          # NEW — verbatim relocation of today's console body
│   ├── OrganizationsTab.vue          # NEW — placeholder card only this phase
│   ├── CleanupConfigCard.vue         # unchanged, rendered inside ConfigurationTab
│   ├── AiProxyConfigCard.vue         # unchanged
│   ├── MessagingConfigCard.vue       # unchanged
│   └── SenderConfigCard.vue          # unchanged
└── views/__tests__/
    └── OwnerConsoleView.test.ts       # existing 7 tests carried forward unmodified + new tab tests
```

### Pattern 1: Query-driven local `activeTab` (URL↔pane bidirectional sync)
**What:** A local `ref<'configuration'|'organizations'>` initialized from and kept in sync with
`route.query.tab`, written back via `router.replace` on click — not a `computed` derived purely from
the route, so a click updates the visible pane instantly without waiting on the (technically async)
navigation to resolve.
**When to use:** Exactly this phase's 2-tab, single-view case.
**Example (new code for `OwnerConsoleView.vue`):**
```typescript
// Source: pattern synthesized from RosterView.vue's useRoute() guard
// (src/views/RosterView.vue:435-447) + ServiceEditorView.vue's local activeTab
// tab strip (src/views/ServiceEditorView.vue:695-748), adapted per 72-CONTEXT.md
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type OwnerConsoleTab = 'configuration' | 'organizations'

// `useRoute()`/`useRouter()` return undefined when mounted without a router
// (OwnerConsoleView.test.ts does this) — every access below is optional-chained,
// mirroring RosterView.vue's documented precedent.
const route = useRoute()
const router = useRouter()

function normalizeTab(raw: unknown): OwnerConsoleTab {
  return raw === 'organizations' ? 'organizations' : 'configuration'
}

const activeTab = ref<OwnerConsoleTab>(normalizeTab(route?.query.tab))

// Keeps the pane in sync with external query changes (browser back/forward,
// or a future in-app link straight to ?tab=organizations) — not just the
// initial load. CONTEXT's minimum bar is "URL→pane on load"; this watcher is
// the low-cost way to also cover the "any subsequent external query change"
// case without extra plumbing.
watch(
  () => route?.query.tab,
  (v) => { activeTab.value = normalizeTab(v) },
)

function setTab(tab: OwnerConsoleTab) {
  if (activeTab.value === tab) return // avoid a no-op replace/duplicate-navigation warning
  activeTab.value = tab
  router?.replace({ query: { ...route?.query, tab } })
}
```

### Pattern 2: `v-show` panes, never `v-if`, for any pane owning a live subscription
**What:** Keep both tab panes permanently mounted; toggle visibility with `v-show`, not `v-if`.
**When to use:** Whenever a pane's child component's `onMounted`/`onUnmounted` drives a
non-idempotent `subscribe()`/`unsubscribe()` pair (this phase: `appConfigStore.subscribe()` and the
`superAdmins` `onSnapshot`, both currently un-guarded against double-subscription in
`src/stores/appConfig.ts:24-38`).
**Example:**
```html
<!-- Source: pattern from src/views/ServiceEditorView.vue:748
     (v-show + data-testid, not v-if, for its own tab panes) -->
<div v-show="activeTab === 'configuration'" data-testid="configuration-panel">
  <ConfigurationTab />
</div>
<div v-show="activeTab === 'organizations'" data-testid="organizations-panel">
  <OrganizationsTab />
</div>
```

### Pattern 3: Tab strip markup (mirrors `ServiceEditorView.vue:695-746`, locked by `72-UI-SPEC.md`)
```html
<!-- Source: src/views/ServiceEditorView.vue:695-731, adapted to 2 static tabs
     per 72-UI-SPEC.md "Component Spec: Tab Strip" -->
<div class="flex items-center gap-1 mb-3 border-b border-gray-800 pb-0">
  <button
    type="button"
    class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'configuration'
      ? 'text-indigo-300 border-indigo-500 bg-gray-900'
      : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="setTab('configuration')"
  >
    Configuration
  </button>
  <button
    type="button"
    class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'organizations'
      ? 'text-indigo-300 border-indigo-500 bg-gray-900'
      : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="setTab('organizations')"
  >
    Organizations
  </button>
</div>
```

### Anti-Patterns to Avoid
- **`v-if` on the Configuration pane:** Unmounts/remounts `ConfigurationTab.vue` on every tab switch,
  which re-fires `onMounted`/`onUnmounted` and therefore re-subscribes on every return to the tab —
  directly contradicts CONTEXT's "must remain active on load exactly as today, so provenance and
  roster are current regardless of which tab is open."
- **`computed` activeTab with no local `ref`:** Deriving `activeTab` purely as `computed(() =>
  normalizeTab(route.query.tab))` means a click has to round-trip through `router.replace()`'s
  navigation resolution (a microtask, at minimum) before the pane visually updates — works, but adds
  an avoidable frame of lag and complicates testing (must `await flushPromises()` after every click
  just to see the pane change). The local-`ref` + `watch` pattern above updates instantly on click and
  still catches external query changes via the watcher.
- **`router.push` for tab clicks:** CONTEXT explicitly calls for `router.replace` to avoid a browser
  history entry per tab click (a `push` would mean the back button steps through each tab visited,
  not back to the previous page).
- **`wrapper.text()` to assert which `v-show` pane is active:** `v-show` never removes the hidden
  pane's markup from the DOM (only `display:none`s it), so `.text()` still returns the hidden pane's
  text content. See Pitfall 1 below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-synced UI state | A custom `window.location`/`popstate` listener, or a bespoke tabs state machine | `vue-router`'s reactive `route.query` + `router.replace` | Already the project's router; reactive query is a solved, well-tested primitive — no reason to hand-roll history/URL parsing |
| Tab visual/keyboard behavior | A new ARIA `role="tablist"` implementation, a headless-UI tabs component | The plain-`<button>` pattern already used twice in this codebase (`ServiceEditorView.vue`) | `72-UI-SPEC.md` explicitly locks this: "No ARIA `role=\"tablist\"`/`role=\"tab\"` pattern is introduced... mirrors that precedent exactly rather than inventing a new (more accessible but inconsistent) pattern." |

**Key insight:** There is no genuinely hard problem in this phase — it is a pure reuse of two
already-proven in-repo patterns (query-param deep-linking from `RosterView.vue`, tab-strip UI from
`ServiceEditorView.vue`). The risk in this phase is entirely in *fidelity* (not silently changing
Configuration-tab behavior) and *test correctness* (proving the fidelity), not in algorithm or
library choice.

## Common Pitfalls

### Pitfall 1: `wrapper.text()` cannot distinguish which `v-show` pane is visible in this project's test environment
**What goes wrong:** A test like `expect(wrapper.text()).not.toContain('Organizations')` when
Configuration is active will pass or fail unpredictably (or simply always pass, hiding a bug) because
`v-show` leaves the other pane's markup — and its text — in the DOM the whole time.
**Why it happens:** `v-show` toggles inline `style="display: none"` rather than removing the element,
and this project's jsdom test environment does not make VTU's own `wrapper.isVisible()` reliably
reflect that ancestor style — this is already documented in-repo, not a hypothetical:
`src/views/__tests__/ServiceEditorView.test.ts:269-282` carries a comment explaining exactly this and
a hand-rolled `isVShowHidden(wrapper)` helper (walks the ancestor chain checking
`el.style?.display === 'none'`) built specifically to work around it for that file's own Slides-tab
panel-visibility tests (Phase 25-03).
**How to avoid:** Reuse (or port into `OwnerConsoleView.test.ts`) the same `isVShowHidden()` helper,
or assert on `wrapper.find('[data-testid="organizations-panel"]').attributes('style')` /
`element.style.display` directly, matching the `data-testid="service-order-panel"` idiom already at
`ServiceEditorView.vue:748`. Do not rely on `wrapper.text()` to prove tab-switch behavior.
**Warning signs:** A new R195 test asserting via `.toContain()`/`.not.toContain()` on `wrapper.text()`
that "passes" on the very first try without ever exercising `setTab()` — a strong signal the assertion
isn't actually distinguishing the two panes.

### Pitfall 2: `useRoute()`/`useRouter()` are `undefined` in `OwnerConsoleView.test.ts`'s existing harness
**What goes wrong:** A naive `route.query.tab` (no optional chaining) or `router.replace(...)` (no
optional chaining) throws `Cannot read properties of undefined` the moment the existing test file's 7
tests mount the view, because that file mounts `OwnerConsoleView` with no `global.plugins: [router]`
and no `vi.mock('vue-router', ...)` — confirmed by reading `src/views/__tests__/OwnerConsoleView.test.ts`
in full.
**Why it happens:** `vue-router`'s `useRoute()`/`useRouter()` are `inject()`-based with no default
value; they resolve to `undefined` whenever the component tree wasn't given the router plugin.
**How to avoid:** Optional-chain every access (`route?.query.tab`, `router?.replace(...)`) — this
mirrors the exact precedent already in `RosterView.vue:444-447` ("`useRoute()` returns undefined when
RosterView is mounted without a router (some unit tests do this); every read below is
optional-chained"). For the **new** R195 tab-switch/deep-link tests, add a `vi.mock('vue-router', ...)`
block to `OwnerConsoleView.test.ts` mirroring `RosterViewEditQuery.test.ts:10-14`'s reactive mock
route + a mock `router.replace` that writes back into that same reactive object, so click→URL→pane
round-trips are actually testable. The existing 7 tests are unaffected either way, since `undefined`
route correctly normalizes to the default `'configuration'` tab — exactly what those tests already
assume.

### Pitfall 3: `appConfigStore.subscribe()` and the roster `onSnapshot` are not idempotency-guarded
**What goes wrong:** If `ConfigurationTab.vue`'s owning component were ever mounted twice (e.g. by
using `v-if` and having some other trigger cause a double-mount, or by accidentally calling
`subscribe()` from two places), `src/stores/appConfig.ts:24-38`'s `subscribe()` simply overwrites
`unsub` with the new listener's unsubscribe function, silently leaking the first `onSnapshot`
listener forever (it is never called again, its Firestore connection stays open).
**Why it happens:** `subscribe()` has no re-entrancy guard (`if (unsub) return`) — it is written on
the assumption of "called exactly once per component lifetime," which was true when
`OwnerConsoleView.vue` was a single un-tabbed view.
**How to avoid:** Confirmed by Pattern 2 above — use `v-show`, keep `ConfigurationTab.vue` mounted for
the entire life of the console (not per-tab), and call `subscribe()`/`onSnapshot()` exactly once in
its `onMounted`, `unsubscribe()` exactly once in its `onUnmounted` — i.e., don't change the
subscription lifecycle at all, only its file location.
**Warning signs:** Duplicate Firestore reads in the Network tab, or a flaky test where `mockOnSnapshot`
is called more than twice for a single mount.

### Pitfall 4: Redundant `router.replace` on repeated same-tab clicks
**What goes wrong:** Clicking the already-active tab still fires a navigation to an identical
`{ query }`, which can log a Vue Router "avoided redundant navigation" warning to the console in dev
mode, or (in stricter test setups) reject the returned promise.
**Why it happens:** No no-op guard before calling `router.replace`.
**How to avoid:** The `if (activeTab.value === tab) return` guard in Pattern 1's `setTab()` above.
**Warning signs:** Console warnings during manual click-testing, or an unhandled-rejection warning in
a test that clicks an already-active tab.

## Code Examples

Verified patterns from this codebase (all read directly this session):

### Reading a route query param defensively (existing precedent)
```typescript
// Source: src/views/RosterView.vue:444-447, 534-536 (in-repo, read this session)
const route = useRoute()
function applyEditQuery() {
  const editId = typeof route?.query?.edit === 'string' ? route.query.edit : null
  if (!editId) return
  // ...
}
```

### Mocking `vue-router` for a query-driven test (existing precedent)
```typescript
// Source: src/views/__tests__/RosterViewEditQuery.test.ts:1-14 (in-repo, read this session)
import { reactive } from 'vue'
const mockRoute = reactive<{ query: Record<string, string | undefined> }>({ query: {} })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  // For Phase 72's tab-click tests, additionally mock useRouter so setTab's
  // router.replace(...) can write straight back into mockRoute.query:
  useRouter: () => ({
    replace: vi.fn(({ query }: { query: Record<string, string> }) => {
      Object.assign(mockRoute.query, query)
      return Promise.resolve()
    }),
  }),
}))
```

### `v-show` + `data-testid` panel pattern (existing precedent)
```html
<!-- Source: src/views/ServiceEditorView.vue:748 (in-repo, read this session) -->
<div v-show="activeTab === 'service-order'" data-testid="service-order-panel">
```

## State of the Art

No prior art in this domain to supersede — this is the first tabbed shell added to
`OwnerConsoleView.vue` (it has been a single-scroll view since Phase 68). No deprecated approach is
being replaced.

## Project Constraints (from CLAUDE.md)

| Directive | Applicability to Phase 72 |
|-----------|---------------------------|
| Use `npm run type-check` (not `-p tsconfig.app.json`) as the gate — it also typechecks test files | Applies: run after adding `ConfigurationTab.vue`/`OrganizationsTab.vue` and editing `OwnerConsoleView.test.ts` |
| Bare `npx vitest run` is the correct default app-suite command; excludes `src/rules.test.ts` and `render-service/**` | Applies: this phase's tests are pure component tests, no Firestore-rules or render-service surface — bare `npx vitest run` is sufficient, no `--config`/`--dir` needed |
| `.env.local` must be present in the working checkout for the app to load Firebase config in tests | Applies generally (component tests that import `@/firebase` need it) — already present per repo convention, no action needed this phase |
| `.gsd/` is gone; `.planning/` is the only planning store; the knowledge graph is stale (built pre-`.gsd/`-deletion) | This research relied on direct file reads (not the stale graph) for exactly this reason — graph query was skipped per the CLAUDE.md warning |

No CLAUDE.md directive is contradicted by this phase's recommended approach.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R193 | Owner Console shows Configuration + Organizations tabs, Configuration default, both super-admin-gated | Pattern 1 (query-driven `activeTab`, default via `normalizeTab`), Pattern 3 (tab strip markup), Architecture Diagram — the existing `requiresSuperAdmin` router guard is untouched, gating both panes identically since they share one route |
| R194 | Configuration tab = existing console body, byte-identical, no behavior change | Pattern 2 (`v-show`, not `v-if`, to keep `ConfigurationTab.vue` permanently mounted so `appConfigStore.subscribe()`/roster `onSnapshot` never re-fire), Pitfall 3 (why re-mounting would break this), Recommended Project Structure (verbatim relocation into `ConfigurationTab.vue`) |
| R195 | Open tab survives refresh, directly linkable via route/query | Pattern 1 (`activeTab` initialized from `route?.query.tab` on load, `watch` keeps it in sync, `router?.replace` writes back), Pitfall 2 (test-time `undefined` route/router handling), Pitfall 1 (how to actually test this given `v-show`'s DOM-retention behavior) |
</phase_requirements>

## Assumptions Log

No claims in this research are tagged `[ASSUMED]`. Every architectural claim is either read directly
from this repository's source this session (`[VERIFIED: codebase]`, treated as HIGH — direct
first-party evidence, not third-party training knowledge) or backed by an explicit `npm view`
registry check / official migration-guide fetch (`[VERIFIED: npm registry]` / `[CITED:
router.vuejs.org/guide/migration/v4-to-v5]`).

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | — |

**This table is empty:** all claims in this research were verified in-repo or cited from official
sources — no user confirmation needed before planning proceeds.

## Open Questions

1. **Should the `watch(() => route?.query.tab, ...)` (external-query-change sync) be included, or is
   the simpler "read once on load" sufficient?**
   - What we know: CONTEXT's stated minimum is "URL→pane on load, pane→URL on click" — it does not
     explicitly demand reacting to a query change that happens *after* mount without a click (e.g.
     browser back/forward within the page, since it's the same route/component instance and won't
     remount).
   - What's unclear: Whether the planner considers browser back/forward parity in-scope for R195's
     "reflected in the route/query" wording, or strictly out of scope this phase (Phase 74 will add
     real interactive content to the Organizations tab, at which point this matters more).
   - Recommendation: Include the `watch` — it is a 3-line addition, has no behavior cost when unused,
     and closes an otherwise-easy-to-miss edge case for free. Treat as included by default rather than
     a discretionary call.

## Environment Availability

Skipped — this phase has no external tool/service dependency beyond what the existing dev environment
already provides (Node, npm, the already-installed `vue-router`). No emulator, no new CLI, no new
runtime.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` (root `vite.config.ts`, jsdom environment) |
| Config file | `vite.config.ts` (root) — excludes `src/rules.test.ts` and `render-service/**` |
| Quick run command | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` |
| Full suite command | `npx vitest run` (bare command is correct per CLAUDE.md 2026-08-12 update — do not add `--dir`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R193 | Default mount (no query) shows Configuration pane active, Organizations tab button present but its pane hidden | unit (component mount) | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts -t "default"` | ❌ Wave 0 — new test, add to existing file |
| R193 | Both panes still gated by existing `requiresSuperAdmin` router guard (unchanged) | unit (existing) | covered by `src/router/__tests__/router.test.ts` (pre-existing, out of this phase's diff) | ✅ pre-existing |
| R194 | Roster grant/revoke flow, empty/loading states, all 4 config cards' presence, provenance stamp — unchanged | unit (component mount, carried forward) | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` (existing 7 tests) | ✅ carried forward, must still pass unmodified |
| R195 | Mounting/refreshing with `?tab=organizations` renders the Organizations pane active, Configuration pane hidden (via `v-show`) | unit (component mount + query mock) | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts -t "deep-link"` | ❌ Wave 0 — new test, requires the `vi.mock('vue-router', ...)` addition (Pitfall 2) |
| R195 | Clicking the Organizations tab updates both the visible pane and calls `router.replace` with `?tab=organizations` (no `push`) | unit (component mount + query mock + click) | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts -t "tab switch"` | ❌ Wave 0 — new test |
| R194 (SC4 invariant) | Configuration pane's subscriptions fire exactly once on mount regardless of tab clicks, unsubscribe exactly once on unmount | unit (component mount, `mockOnSnapshot` call-count assertion) | existing `mockOnSnapshot` call-count test at `OwnerConsoleView.test.ts:115-124`, re-verify it still holds after the `v-show` restructure | ✅ carried forward (assertion itself doesn't change; behavior under test does) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` + `npm run type-check`
- **Per wave merge:** `npx vitest run` (full app suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Add `vi.mock('vue-router', ...)` block to `src/views/__tests__/OwnerConsoleView.test.ts`, mirroring
      `RosterViewEditQuery.test.ts`'s reactive-mock-route pattern, extended with a mock `useRouter()`
      whose `replace` writes back into the same reactive `mockRoute.query` object (Code Examples above)
- [ ] Add (or port) an `isVShowHidden()` helper into `OwnerConsoleView.test.ts`, matching
      `ServiceEditorView.test.ts:275-282`, for asserting which pane is visible
- [ ] Add `data-testid="configuration-panel"` / `data-testid="organizations-panel"` to the two panes in
      `OwnerConsoleView.vue`, matching the `data-testid="service-order-panel"` idiom
- [ ] No new test framework/config install needed — Vitest is already fully configured for this file

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled), so this section is
included per protocol — but this phase introduces **no new access surface**. Confirmed directly:
`.planning/STATE.md:51-52` — *"Phase 72 (tab restructure, no new writes/rules) is the one phase with
no auth/rules surface to hand over."* No new route, no new Firestore/Storage rule, no new callable, no
new claim.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — Firebase Auth session, untouched by this phase |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes (unchanged) | Existing `router/index.ts`'s `requiresSuperAdmin` guard (client convenience gate) + `firestore.rules`' `isSuperAdmin()` (real enforcement, Phase 68) — both continue to gate the entire `/owner-console` route, including both tab panes identically, since tabs are a query concern within the one already-gated route |
| V5 Input Validation | Marginal | The only new "input" is the `tab` query value itself; `normalizeTab()` (Pattern 1) whitelists it to exactly `'configuration' \| 'organizations'`, defaulting any other value (including injected/malformed strings) to `'configuration'` — no reflected-XSS surface since the value is never rendered as HTML, only used in a `===` comparison |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Query-param tampering (`?tab=<script>...` or arbitrary string) | Tampering | `normalizeTab()`'s whitelist-to-two-values approach (Pattern 1) — any unrecognized value silently falls back to `'configuration'`, never echoed into the DOM or used in a lookup/eval |
| Bypassing the super-admin gate by navigating directly to `?tab=organizations` | Elevation of Privilege | Not a new bypass vector — the query param is read only *after* the `requiresSuperAdmin` guard has already resolved (or redirected away) for the underlying route; a non-super-admin never reaches `OwnerConsoleView.vue`'s `<script setup>` at all, regardless of query string |

## Sources

### Primary (HIGH confidence — direct in-repo reads this session)
- `src/views/OwnerConsoleView.vue` — current console body, subscriptions, script structure
- `src/views/__tests__/OwnerConsoleView.test.ts` — existing 7-test harness, no-router mount pattern
- `src/views/ServiceEditorView.vue` (lines 690-748) — tab strip markup + `v-show` panel pattern
- `src/views/__tests__/ServiceEditorView.test.ts` (lines 269-282) — documented `v-show`/`isVisible()`
  jsdom gotcha and the `isVShowHidden()` workaround
- `src/views/RosterView.vue` (lines 433-540) — `useRoute()` optional-chaining precedent, `?edit=` deep-link
- `src/views/__tests__/RosterViewEditQuery.test.ts` — `vi.mock('vue-router', ...)` reactive-route test pattern
- `src/router/index.ts` — `/owner-console` route definition, `requiresSuperAdmin` guard
- `src/stores/appConfig.ts` — `subscribe()`/`unsubscribe()` non-idempotency (lines 24-43)
- `.planning/phases/72-owner-console-tabs/72-CONTEXT.md` — locked decisions
- `.planning/phases/72-owner-console-tabs/72-UI-SPEC.md` — locked visual/interaction contract
- `.planning/ROADMAP.md` (Phase 72 detail block) — goal, success criteria, dependencies
- `.planning/REQUIREMENTS.md` — R193, R194, R195 text
- `.planning/STATE.md` (lines 48-52, 700-765) — confirms no auth/rules surface this phase

### Secondary (MEDIUM confidence)
- `npm view vue-router version` — confirms `5.2.0` latest on registry, installed `5.0.3` satisfies range
- [Migrating to Vue Router 5](https://router.vuejs.org/guide/migration/v4-to-v5) — confirms
  `useRoute()`/`useRouter()`/query-based navigation are unchanged for non-file-based-routing apps

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, existing `vue-router` usage confirmed by direct grep across the codebase
- Architecture: HIGH — every pattern recommended is a verbatim reuse of code read this session, not a novel design
- Pitfalls: HIGH — all four pitfalls are grounded in either this codebase's own committed comments (Pitfalls 1, 2) or direct reads of the exact non-idempotent store code they warn about (Pitfall 3)

**Research date:** 2026-08-21
**Valid until:** 2026-11-19 (90 days — this is a stable, low-churn internal pattern with no external
API surface; not time-sensitive like a fast-moving third-party library)
