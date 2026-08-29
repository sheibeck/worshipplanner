# Phase 98: Fullscreen Setup Helper - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 8 (approx. new/modified surfaces)
**Analogs found:** 6 / 8 (2 net-new, no analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/monitor/AutoFullscreenSetup.vue` (new component, embedded in `MonitorSetupView.vue`) | component | request-response (permission query + user-triggered download) | `src/components/MonitorFallbackPanel.vue` | role-match (structure) + `src/components/MonitorCard.vue` (visual idiom) |
| `src/composables/useFullscreenReadiness.ts` (new composable — readiness state + re-check) | composable/hook | event-driven (permission query, on-demand + window focus) | `src/composables/useOutputWindow.ts` (`attemptAutoFullscreen`) | exact (same permission descriptor, same try/catch shape) |
| `src/utils/fullscreenPolicyFiles.ts` (new — `.reg`/`.mobileconfig`/JSON string generators) | utility | transform (pure string generation from origin) | `src/utils/monitorConfig.ts` | role-match (pure, framework-free, testable module pattern) |
| `src/utils/osDetect.ts` (new — OS/browser detection) | utility | transform | `src/utils/monitorConfig.ts` / `src/utils/serviceSlots.ts` | role-match (small pure-function module, one concern) |
| `src/utils/downloadTextFile.ts` (new — Blob + `<a download>` helper) | utility | file-I/O | **NO ANALOG** — see below | net-new |
| `src/views/MonitorSetupView.vue` (modified — mount the new section) | view | request-response | itself (existing file, Phase 92) | exact (extend existing conditional-phase layout) |
| `src/components/monitor/__tests__/AutoFullscreenSetup.test.ts` (new) | test | — | `src/components/__tests__/MonitorCard.test.ts` | exact (component test idiom) |
| `src/composables/__tests__/useFullscreenReadiness.test.ts` + `src/utils/__tests__/fullscreenPolicyFiles.test.ts` + `src/utils/__tests__/downloadTextFile.test.ts` (new) | test | — | `src/composables/__tests__/useOutputWindow.test.ts` (permissions mocking) + `src/utils/__tests__/monitorConfig.test.ts` (pure-module test shape) | exact / role-match |

## Pattern Assignments

### `src/components/monitor/AutoFullscreenSetup.vue` (component)

**Analogs:** `src/components/MonitorFallbackPanel.vue` (structure/props/emits) and `src/components/MonitorCard.vue` (visual idiom, testid convention).

Note: existing monitor components live flat under `src/components/` (`MonitorCard.vue`, `MonitorFallbackPanel.vue`), NOT under a `src/components/monitor/` subfolder — despite the phase brief's suggested path. **Recommend placing the new component at `src/components/AutoFullscreenSetup.vue`** to match the existing flat convention, unless the planner deliberately wants to start a `monitor/` subfolder (flag this as a naming decision for the planner, not something this mapper should silently override).

**Script setup / props+emits pattern** (`MonitorFallbackPanel.vue` lines 24-33):
```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  reason: 'denied' | 'unavailable' | 'manual'
}>()

defineEmits<{
  retry: []
}>()
```
Copy this shape for `AutoFullscreenSetup.vue`: a small discriminated-union prop or internal `ref` for the three readiness states (`'ready' | 'not-ready' | 'unsupported'`), a `computed` for heading/body copy per state (see the `heading`/`body` computeds at lines 35-53 — same pattern: an `if/else if` chain keyed on the state, each branch returning honest, state-specific copy), and an emit for the "Confirm fullscreen support" action if the parent view needs to react (or keep it self-contained with an internal composable call — see below).

**Container + copy idiom** (`MonitorFallbackPanel.vue` lines 1-21):
```vue
<div class="rounded-lg bg-gray-900 border border-gray-800 p-6">
  <h2 class="text-base font-semibold text-gray-100">{{ heading }}</h2>
  <p class="text-sm text-gray-400 mt-1">{{ body }}</p>
  <ol class="text-sm text-gray-300 mt-4 space-y-2 list-decimal list-inside"> ... </ol>
  <button type="button" class="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 mt-3" @click="$emit('retry')">
```
Use this exact dark-theme Tailwind vocabulary (`bg-gray-900 border-gray-800`, `text-gray-100`/`text-gray-400`/`text-gray-500` hierarchy, `rounded-lg p-6`, ordered-list step instructions, underline secondary-action buttons) for the setup card and its per-OS step list.

**Status-badge / green-check idiom** — reuse `MonitorSetupView.vue`'s inline SVG check pattern (lines 54-57, 131-134) for the "ready ✓" state:
```vue
<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>
```
And the amber warning-box idiom for "not ready" (`MonitorSetupView.vue` lines 75-83, `bg-amber-900/20 border-amber-800/60`) for the not-ready/troubleshooting state.

**Primary action button** — copy the `data-testid` + Tailwind button pattern from `MonitorSetupView.vue` lines 31-39 (`detect-button`) / 118-127 (`save-button`):
```vue
<button
  type="button"
  data-testid="confirm-fullscreen-button"
  class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
  @click="onConfirmClick"
>
```
`data-testid` naming convention observed across the codebase: kebab-case, action-first (`detect-button`, `save-button`, `refresh-kept-notice`) or role-parameterized (`monitor-role-${fingerprint}-${role}` in `MonitorCard.vue` line 29). Recommend `data-testid="fullscreen-readiness-status"`, `data-testid="confirm-fullscreen-button"`, `data-testid="download-policy-button"`, `data-testid="fullscreen-status-{ready|not-ready|unsupported}"` for state-specific assertions.

**Embedding into `MonitorSetupView.vue`:** follow the existing `v-if`/`v-else-if` phase-branch style (lines 13-150) — add the new section as an additive block inside the `phase === 'granted'` branch (per CONTEXT.md: "lives inside the monitor-assignment flow"), imported the same way `MonitorCard`/`MonitorFallbackPanel` are imported (script setup lines 154-167).

---

### `src/composables/useFullscreenReadiness.ts` (composable)

**Analog:** `src/composables/useOutputWindow.ts`, function `attemptAutoFullscreen()` (lines 167-184).

**Exact permission-query pattern to copy** (lines 167-184):
```typescript
async function attemptAutoFullscreen() {
  try {
    // The { name:'fullscreen', allowWithoutGesture:true } descriptor is not in the
    // base TS lib's PermissionDescriptor — cast it. A browser without this
    // descriptor THROWS a TypeError from query(), caught below as "not granted".
    const status = await navigator.permissions.query(
      { name: 'fullscreen', allowWithoutGesture: true } as unknown as PermissionDescriptor,
    )
    if (status.state === 'granted') {
      document.documentElement.requestFullscreen().catch(() => {})
    }
    // state !== 'granted' → do nothing; the delegation/tap fallbacks take over.
  } catch {
    // Absent Permissions API / unsupported descriptor / query rejection — silent;
    // the delegation + one-tap fallbacks remain the path to fullscreen.
  }
}
```
Reuse the SAME `{ name: 'fullscreen', allowWithoutGesture: true }` descriptor (do not re-derive it) and the SAME cast-to-`PermissionDescriptor` + try/catch shape, but for `useFullscreenReadiness.ts` do NOT call `requestFullscreen()` — this is a READ-ONLY status query for UI display, not an action:
```typescript
async function checkReadiness(): Promise<'ready' | 'not-ready' | 'unsupported'> {
  try {
    const status = await navigator.permissions.query(
      { name: 'fullscreen', allowWithoutGesture: true } as unknown as PermissionDescriptor,
    )
    return status.state === 'granted' ? 'ready' : 'not-ready'
  } catch {
    return 'unsupported'
  }
}
```
Note the three-state distinction CONTEXT.md requires (ready / not-ready / unsupported) maps cleanly onto try success-with-granted / try success-without-granted / catch — exactly the shape `useOutputWindow.ts` already discriminates implicitly (`state === 'granted'` vs. the swallowed catch), just returned as a value instead of driving a side effect.

**Composable structure/return convention** — `useOutputWindow.ts` is a large composable (`export function useOutputWindow(options = {}) { ... return {...} }`); for this phase's narrower need, model the smaller/single-purpose composables instead — `src/composables/useUnsavedGuard.ts` or `src/composables/useAutoSave.ts` are better structural analogs for a composable with a `ref` + exposed function(s) and no options object required. Recommend:
```typescript
export function useFullscreenReadiness() {
  const status = ref<'checking' | 'ready' | 'not-ready' | 'unsupported'>('checking')
  async function check() { status.value = 'checking'; status.value = await checkReadiness() }
  onMounted(check)
  // CONTEXT.md: "on window focus" re-check where cheap/reliable
  return { status, check }
}
```
(Planner should confirm whether onMounted auto-check + window `focus` listener belongs in the composable or is left to the component; either is consistent with existing composable patterns — `useOutputWindow.ts`'s own `onMounted` registers listeners the same way, `useUnsavedGuard.ts` similarly wires/tears down a `beforeunload`-style listener.)

---

### `src/utils/fullscreenPolicyFiles.ts` (utility, net-new domain but existing MODULE pattern)

**Analog:** `src/utils/monitorConfig.ts` — pure, framework-free, single-responsibility module style.

**Module-doc-comment convention to copy** (`monitorConfig.ts` lines 1-25): a substantial top-of-file comment block explaining WHY the module is shaped this way, referencing phase/context docs, called out as "Pure and framework-free — no Vue, Firebase, or Pinia imports." Apply the same discipline here: document why the origin must come from `window.location.origin` at call time (never hardcoded — CONTEXT.md decision 2), and why HKCU is generated by default with HKLM as a named alternate export.

**Export style** — named function exports with explicit return/param types, e.g.:
```typescript
export function generateWindowsRegFile(origin: string, scope: 'HKCU' | 'HKLM'): string { ... }
export function generateMacProfile(origin: string): string { ... }
export function generateLinuxPolicyJson(origin: string): string { ... }
```
mirrors `monitorConfig.ts`'s `computeFingerprint`, `saveMapping`, `loadMapping`, `matchMapping` — one function per concern, all pure, all taking their inputs as parameters (never reaching into globals directly inside the function body — `monitorConfig.ts`'s `resolveStorage(storage?: Storage)` takes an OPTIONAL override purely for testability; do the same here by NOT reading `window.location.origin` inside the generator functions — pass `origin: string` in from the caller, which is naturally testable without touching `window` at all).

**Existing localhost proof artifacts to generalize** (per CONTEXT.md decision 3): read `docs/fullscreen-setup/enable-fullscreen-localhost-HKCU-no-admin.reg` and the HKLM sibling to get the exact registry key shape/paths (Chrome + Edge keys in one file) before writing the generator — these are the ground truth for the `.reg` string format, not something to reinvent.

---

### `src/utils/osDetect.ts` (utility, net-new domain, existing pattern)

**Analog:** `src/utils/monitorConfig.ts` / `src/utils/serviceSlots.ts` — same pure-utility-module convention (framework-free, one concern, exported types + functions, unit-testable via injected values rather than reading globals inside the tested function where avoidable).

Recommend:
```typescript
export type DetectedOS = 'windows' | 'macos' | 'linux' | 'unknown'
export type DetectedBrowser = 'chrome' | 'edge' | 'other'
export function detectOS(nav: Pick<Navigator, 'userAgent' | 'userAgentData'> = navigator): DetectedOS { ... }
export function detectBrowser(nav: Pick<Navigator, 'userAgent'> = navigator): DetectedBrowser { ... }
```
The optional-injectable-`navigator`-param pattern mirrors `monitorConfig.ts`'s `resolveStorage(storage?: Storage)` seam (lines 82-89) — same reason: makes the function trivially testable with a fixture object instead of mocking global `navigator` for every case.

---

### `src/utils/downloadTextFile.ts` — NO ANALOG (net-new)

Searched for existing Blob/`createObjectURL`/`<a download>` patterns across `src/`. **No client-side file-download helper exists in this codebase.** The 13 files matching `Blob|download|createObjectURL` are false positives: `slideDisplay.ts`/`slideFonts.ts`/etc. use `Blob` for MEDIA UPLOAD (reading a File into a Blob for Firebase Storage upload, the opposite direction), and `CsvImportModal.vue`'s only "download" hits are copy text instructing the user to use an EXTERNAL tool's export button (Planning Center), not an in-app download.

**Recommended pattern** (net-new, no in-repo precedent — follow standard idiom, keep it pure/framework-free per the `monitorConfig.ts`/`serviceSlots.ts` module convention):
```typescript
export function downloadTextFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
```
Keep this in its own `src/utils/downloadTextFile.ts` (single responsibility, mirrors the rest of `src/utils/`) rather than folding it into `fullscreenPolicyFiles.ts`, so it is independently reusable and independently mockable in tests (see test pattern below).

---

### Tests

**Component test** — `src/components/__tests__/MonitorCard.test.ts` is the exact structural analog for `AutoFullscreenSetup.test.ts`: `mount()` from `@vue/test-utils`, `describe`/`it` blocks named after the fix/requirement they prove, assertions against `wrapper.get(...)`/`wrapper.findAll(...)` and `data-testid` lookups, props built via a small `makeX(overrides)` fixture factory.

**Permissions-API mocking** — `src/composables/__tests__/useOutputWindow.test.ts` lines 470-559 is the exact idiom to copy for `useFullscreenReadiness.test.ts`:
```typescript
function installPermissions(query: (descriptor: unknown) => Promise<{ state: string }>) {
  Object.defineProperty(navigator, 'permissions', {
    value: { query: vi.fn(query) },
    configurable: true,
    writable: true,
  })
  return (navigator as unknown as { permissions: { query: ReturnType<typeof vi.fn> } }).permissions.query
}
```
And the "unsupported" case relies on jsdom's default (`navigator.permissions` is undefined) rather than faking a throw:
```typescript
expect('permissions' in navigator).toBe(false)
```
Also copy the descriptor-shape assertion: `expect(query.mock.calls[0]![0]).toMatchObject({ name: 'fullscreen', allowWithoutGesture: true })`.

**Pure-module test** — `src/utils/__tests__/monitorConfig.test.ts` is the analog for `fullscreenPolicyFiles.test.ts`/`osDetect.test.ts`: `describe`/`it` with `beforeEach`, no component mounting, plain function calls with fixture inputs/outputs, injectable-storage-stub pattern (lines 11-28, 30-41) — mirror this for `osDetect.test.ts` by building fixture `navigator`-shaped objects (`{ userAgent: '...', userAgentData: {...} }`) instead of mutating the real global, and for `fullscreenPolicyFiles.test.ts` by asserting on the exact generated string content for a given `origin` param (snapshot-style substring assertions, e.g. `expect(reg).toContain('AutomaticFullscreenAllowedForUrls')` and `expect(reg).toContain(origin)`).

**Download-helper test (no analog — recommend)**:
```typescript
it('creates a Blob, triggers a download link, and revokes the object URL', () => {
  const createObjectURL = vi.fn(() => 'blob:mock')
  const revokeObjectURL = vi.fn()
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  const clickSpy = vi.fn()
  const anchor = { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement
  vi.spyOn(document, 'createElement').mockReturnValue(anchor)
  downloadTextFile('test.reg', 'contents', 'text/plain')
  expect(clickSpy).toHaveBeenCalledOnce()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
})
```
This follows the same `vi.fn()`/`Object.defineProperty`-style global stubbing already used for `navigator.permissions` in `useOutputWindow.test.ts` — no new mocking idiom needs to be introduced.

---

## Shared Patterns

### Dark-theme Tailwind vocabulary
**Source:** `src/components/MonitorCard.vue`, `src/components/MonitorFallbackPanel.vue`, `src/views/MonitorSetupView.vue`
**Apply to:** `AutoFullscreenSetup.vue` and any sub-elements (status badges, step lists, buttons)
```
Card:      bg-gray-900 border border-gray-800 rounded-lg p-4|p-6
Heading:   text-base font-semibold text-gray-100
Body:      text-sm text-gray-400
Caption:   text-xs text-gray-500
Primary:   bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium
Secondary: bg-gray-800 hover:bg-gray-700 text-gray-200|text-gray-300 rounded-md
Link:      text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2
Warn box:  bg-amber-900/20 border border-amber-800/60 rounded-lg p-4, text-amber-200/text-amber-200/80
Success:   text-green-400, check-circle SVG (see MonitorSetupView.vue lines 54-57)
```

### Permission-query pattern (`navigator.permissions.query`)
**Source:** `src/composables/useOutputWindow.ts` lines 167-184
**Apply to:** `useFullscreenReadiness.ts`
Reuse the exact descriptor `{ name: 'fullscreen', allowWithoutGesture: true } as unknown as PermissionDescriptor` and the try/catch-as-unsupported-signal idiom. Do not duplicate/redefine the descriptor elsewhere — consider exporting a shared constant from `useOutputWindow.ts` or a small shared module if the planner wants single-sourcing (flag as an option, not mandatory).

### `data-testid` naming convention
**Source:** `MonitorCard.vue`, `MonitorSetupView.vue`
**Apply to:** all new interactive elements
kebab-case, action/role first: `detect-button`, `save-button`, `refresh-kept-notice`, `monitor-role-${fingerprint}-${role}`. Recommend: `confirm-fullscreen-button`, `download-policy-button`, `fullscreen-readiness-status`.

### Pure-utility-module discipline (no Vue/Firebase/Pinia imports, injectable seams for testability)
**Source:** `src/utils/monitorConfig.ts` (module doc comment lines 1-25, `resolveStorage` optional-override seam lines 82-89)
**Apply to:** `src/utils/fullscreenPolicyFiles.ts`, `src/utils/osDetect.ts`, `src/utils/downloadTextFile.ts`
Never read `window`/`navigator`/`localStorage` directly inside a function body when it can instead be an optional injected parameter — this is the seam that makes `monitorConfig.test.ts` and `useOutputWindow.test.ts` able to test both the real-global and injected-fixture paths without a global mock in most cases.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/utils/downloadTextFile.ts` | utility | file-I/O | No client-side Blob/`<a download>` file-export exists anywhere in `src/`; recommend the standard `Blob` + `URL.createObjectURL` + synthetic `<a>` idiom, tested per the mocking pattern above. Net-new but low-risk — ~10 lines, no framework dependency. |
| `src/utils/fullscreenPolicyFiles.ts` (content, not module shape) | utility | transform | No existing module in this codebase generates OS-native config-file text (`.reg`/`.mobileconfig`/policy JSON); the MODULE SHAPE has a strong analog (`monitorConfig.ts`) but the actual generation logic/content is net-new domain knowledge — ground truth is `docs/fullscreen-setup/enable-fullscreen-localhost-*.reg` (existing proof artifacts) plus Chrome Enterprise policy docs the researcher confirms per CONTEXT.md's open items. |

## Metadata

**Analog search scope:** `src/components/`, `src/composables/`, `src/utils/`, `src/views/`, their `__tests__/` subfolders, `docs/fullscreen-setup/`
**Files scanned:** ~25 (targeted Glob/Grep + Read of `MonitorCard.vue`, `MonitorFallbackPanel.vue`, `MonitorSetupView.vue`, `monitorConfig.ts`, `useOutputWindow.ts` (attemptAutoFullscreen + mount sections), `useRunControl.ts` (delegateFullscreenToAll), `MonitorCard.test.ts`, `useOutputWindow.test.ts` (permissions section), `monitorConfig.test.ts`, `CsvImportModal.vue` (download false-positive check))
**Pattern extraction date:** 2026-08-29
