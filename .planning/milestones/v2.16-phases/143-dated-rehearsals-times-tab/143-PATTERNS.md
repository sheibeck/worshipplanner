# Phase 143: Dated Rehearsals & Times Tab - Pattern Map

**Mapped:** 2026-10-27
**Files analyzed:** 14 (2 new source/test, 1 new ADR, 11 modified)
**Analogs found:** 13 / 14 (ServiceTimesPanel has only role-match analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/ServiceTimesPanel.vue` (NEW) | component (props-in/events-out panel) | CRUD (form, local edit events) | `src/components/RolesConfigPanel.vue` + header Times block in `ServiceEditorView.vue` L261-326 | role-match |
| `src/components/__tests__/ServiceTimesPanel.test.ts` (NEW) | test | request-response | `src/components/__tests__/RolesConfigPanel.test.ts` | role-match |
| `src/views/ServiceEditorView.vue` (MOD) | view | CRUD, event-driven | itself: Messages/Slides tab wiring L905-914, L1703-1709, L1959-1991, L2800-2862 | exact |
| `src/views/serviceEditorActionBar.ts` (MOD) | utility (pure builder) | transform | itself: `messages`/`stage`/`roles` early-return branches L220-231 | exact |
| `src/views/__tests__/serviceEditorActionBar.test.ts` (MOD) | test | transform | itself: ROLES EMPTY / MESSAGES EMPTY L124-144, GATING MATRIX L146+ | exact |
| `src/utils/rehearsalTimes.ts` (MOD) | utility | transform | itself (+ `formatRehearsalDateShort` moved from view L2820-2825) | exact |
| `src/utils/__tests__/rehearsalTimes.test.ts` (MOD) | test | transform | itself | exact |
| `src/stores/services.ts` (MOD, `createService` ~L474-484) | store | CRUD | itself | exact |
| `src/stores/__tests__/services.rehearsalDefaults.test.ts` (REWRITE) | test | CRUD | itself | exact |
| `src/views/SettingsView.vue` (MOD, copy L545-556) | view | CRUD | itself | exact |
| `src/views/__tests__/ServiceEditorView.timesSection.test.ts` (REWRITE) | test | request-response | itself (mock scaffold L270-300) | exact |
| `src/views/__tests__/ServiceEditorView.test.ts`, `ServiceEditorView.stage.test.ts` (MOD) | test | request-response | themselves (tab-order tests; see RESEARCH Pitfall 3 for L-numbers) | exact |
| `docs/adr/0245-*.md` (NEW) | doc | n/a | `docs/adr/0244-suggest-all-songs-is-a-live-ai-entry-point-calls.md` | exact |
| `.planning/codebase/ARCHITECTURE.md` (MOD) | doc | n/a | `### src/components/ContextualActionBar.vue` entry in "Component & Composable Behavioral Notes (R318)" L1589+ | exact |

## Pattern Assignments

### `src/components/ServiceTimesPanel.vue` (component, props-in/events-out)

**Analog A (structure/events):** `src/components/RolesConfigPanel.vue` - a panel extracted from the view, props in, `defineEmits` out, no store writes.
**Analog B (markup/classes to move verbatim):** `ServiceEditorView.vue` L261-326 (header Times block that this phase deletes).

**Emits pattern** (RolesConfigPanel.vue L72):
```typescript
const emit = defineEmits<{ edit: [role: Role]; add: [] }>()
```
Panel emits (typed tuple form): `add: [payload: {date:string; time:string}]`, `'date-change': [{id,date}]`, `'time-change': [{id,time}]`, `remove: [id]`, `'report-time-change': [time]`. Use `withDefaults(defineProps<...>(), { defaultTimes: () => [] })` (RESEARCH Pitfall 5).

**Panel chrome** (RolesConfigPanel.vue L2-3, L14): `rounded-lg border border-gray-800 overflow-hidden` outer, `px-4 py-3 bg-gray-900/50 border-b border-gray-800` section header, `text-sm font-medium text-gray-300` h2, `text-xs text-gray-500 mt-0.5` helper. Primary button class: `px-3 py-1.5 rounded-md text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors`. Check 143-UI-SPEC.md for the final class contract; the above are the in-repo precedents.

**Row inputs - copy classes verbatim** (ServiceEditorView.vue L289-303):
```html
<input type="date" :value="rehearsal.date" :disabled="!canEditService" data-testid="rehearsal-date-input"
  class="bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
  @change="onRehearsalDateChange(rehearsal.id, ($event.target as HTMLInputElement).value)" />
<button type="button" data-testid="remove-rehearsal-btn" class="text-xs text-red-400 hover:text-red-300 transition-colors" ...>Remove</button>
```
In the panel replace `canEditService` with the `canEdit` prop; `@change` calls local `onDateChange(r, $event)` (revert logic, RESEARCH Pattern 3). Report time input (L318-327) keeps `id="report-time-input"`, `data-testid="report-time-input"`, `<label for>` pairing.

**Read-only string format to reuse** (ServiceEditorView.vue L267-272):
```html
{{ readOnlyRehearsals.map((r) => `${formatRehearsalDateShort(r.date)}, ${formatWallClockTime(r.time)}`).join('; ') }}
```
Panel renders a `<ul data-testid="times-readonly">` of `sortRehearsals(rows.filter(isDisplayableRehearsal))` instead of joined text.

**Imports:** `import { computed, nextTick, onBeforeUnmount, ref } from 'vue'` and `import { formatRehearsalDateShort, formatWallClockTime, isDisplayableRehearsal, sortRehearsals, type Rehearsal } from '@/utils/rehearsalTimes'`.

**Add-form / reject-clear / legacy-first ordering:** no in-repo analog; use RESEARCH.md Patterns 2, 3, 5 verbatim (nullable `newTimeOverride`, forced `input.value = r.date` revert, `[...legacy, ...sortRehearsals(dated)]`).

**Comment convention:** short pointer only, e.g. `// See ADR-0245 (...)`; narration goes to ARCHITECTURE.md.

---

### `src/components/__tests__/ServiceTimesPanel.test.ts` (test)

**Analog:** `src/components/__tests__/RolesConfigPanel.test.ts` (L1-30): `mount` the component directly, plain `describe/it`, requirement-id-prefixed test names (`'R246: ...'`). No stores needed for this panel (props only), so drop the pinia/`vi.mock` scaffolding.
```typescript
import { describe, it, expect } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import ServiceTimesPanel from '../ServiceTimesPanel.vue'
enableAutoUnmount(afterEach)
```
Use RESEARCH Code Example 4 skeleton. `attachTo: document.body` for focus tests, `vi.useFakeTimers()` for the 4 s revert message. After a simulated clear, assert `(input.element as HTMLInputElement).value` (Pitfall 1). Test names should lead with `R441:`/`R442:`/`R443:`/`R444:`.

---

### `src/views/ServiceEditorView.vue` (view, MODIFY)

**Tab button after Messages** - copy the Messages button (L905-914) verbatim; id/aria swapped to `times`; NO `v-if` (Slides precedent); add the amber dot block from RESEARCH Code Example 2:
```html
<button ... aria-controls="svc-panel-messages" :tabindex="activeTab === 'messages' ? 0 : -1"
  class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
  :class="activeTab === 'messages' ? 'text-indigo-300 border-indigo-500 bg-gray-900' : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
  @click="activeTab = 'messages'">Messages</button>
```

**Panel wrapper** (L1703-1709; keep ids/roles on the parent wrapper, `<ServiceTimesPanel>` inside):
```html
<div v-show="activeTab === 'messages'" id="svc-panel-messages" role="tabpanel"
  aria-labelledby="svc-tab-messages" data-testid="messages-panel">
```

**Tab state** (L1959-1991): extend `activeTab` ref union and `ServiceEditorTabId` with `'times'`; in `visibleTabOrder` add `tabs.push('times')` UNCONDITIONALLY after the `messages` push (L1969); add `const timesTabButtonRef = ref<HTMLButtonElement | null>(null)`; add `case 'times': return timesTabButtonRef` to `tabButtonRef` (no default - TS exhaustiveness). `handleTabKeydown` needs no change.

**Handlers** (L2827-2858): keep names and the `if (!canEditService.value) return` first line (R036). Changes: `onAddRehearsal(payload)` validates `/^\d{4}-\d{2}-\d{2}$/` and `/^\d{2}:\d{2}$/` then pushes `{ id: crypto.randomUUID(), date, time }`; date/time change handlers return early if `r.date !== '' && newDate === ''` (same for time). Remove `editableRehearsals`/`readOnlyRehearsals`/local `formatRehearsalDateShort` (L2809-2825) and the header block L261-326; drop now-unused imports (`sortRehearsals`, `formatWallClockTime` if unused).

**Data wiring:** pass `:default-times="authStore.settings.rehearsalTimeDefaults ?? []"` (test mocks lack the field - RESEARCH Pitfall 5). Add `hasNonDisplayableRehearsal` computed (RESEARCH Ex. 2). Do not touch `onSave`.

---

### `src/views/serviceEditorActionBar.ts` (utility, MODIFY)

**Analog:** same file L8 and L220-231.
```typescript
export type ActionBarTab = 'service-order' | 'roles' | 'slides' | 'messages' | 'stage'   // + 'times'
...
  if (tab === 'messages') return []
  // Phase 107 (R313): the Stage Layout tab exposes no action-bar items either ...
  if (tab === 'stage') return []
  if (tab === 'slides') return buildSlidesItems(ctx)
  return buildServiceOrderItems(ctx)   // <- silent fall-through for unknown tabs (Pitfall 2)
```
Add `if (tab === 'times') return []` before the fall-through, with a short comment. The view passes `activeTab.value` directly, so the unions must stay assignable.

### `src/views/__tests__/serviceEditorActionBar.test.ts` (test, MODIFY)

**Analog:** L124-144 (copy `MESSAGES EMPTY`):
```typescript
it('MESSAGES EMPTY: the messages item list has length 0 across the same cartesian product', () => {
  for (const ctx of cartesianContexts()) {
    expect(buildActionBarItems('messages', ctx).length).toBe(0)
  }
})
```
Add `'TIMES EMPTY'` the same way plus GATING MATRIX rows (L147-148 shape): `{ name: 'times, editor', tab: 'times', overrides: { canEditService: true }, expected: [] }` and a viewer row.

---

### `src/stores/services.ts` `createService` (store, MODIFY, L474-484)

**Current code to replace:**
```typescript
const rehearsals = authStore.settings.rehearsalTimeDefaults.map((time) => ({
  id: crypto.randomUUID(),
  date: '', // planner dates each rehearsal ...
  time,
}))
const reportTime = authStore.settings.reportTimeDefault
```
New: `const rehearsals: { id: string; date: string; time: string }[] = []` (keep the explicit `[]` in the `addDoc` payload and `created` object; keep `reportTime` copy unchanged). Shorten the comment to an ADR-0245 pointer. Do not change `buildServiceSnapshot` (L196-205) or `rehearseAccess.ts` apart from optional comment wording.

### `src/stores/__tests__/services.rehearsalDefaults.test.ts` (REWRITE expectations)
Keep file/mocks; change the 2-undated-rows assertion (L86-104) to `rehearsals: []`; keep reportTime copy and copy-not-live-bind assertions.

### `src/views/SettingsView.vue` (copy, MODIFY L545-556)
Replace helper text at ~L555-556 ("Starting rehearsal time(s) and a report time copied onto every new service...") so it states default rehearsal time(s) pre-fill the time when a planner adds a rehearsal and the report time is copied to every new service. Shorten the L545-549 HTML comment to an ADR pointer. No data-shape change.

### `src/views/__tests__/ServiceEditorView.timesSection.test.ts` (REWRITE)
**Analog:** itself, L272-300 scaffold:
```typescript
const wrapper = shallowMount(ServiceEditorView, { global: { stubs: {
  AppShell: { template: '<div><slot /></div>' }, ContextualActionBar: false,
  RouterLink: { template: '<a><slot /></a>' }, SaveStatusIndicator: false,
  ServicePrintLayout: true, SongBadge: true, ... } } })
```
Add `ServiceTimesPanel: false` to `stubs` only where real DOM is needed (same trick as `ContextualActionBar: false`); otherwise use `wrapper.findComponent(ServiceTimesPanel).props()` / `.vm.$emit('add', {...})`. Tests: header block absent, tab dot (editor only), handler invariants, autosave path. Use `toContain('Times')` for tab text when the sr-only span may be present.

### `src/views/__tests__/ServiceEditorView.test.ts` / `ServiceEditorView.stage.test.ts` (MOD)
Update the enumerated tab-order, roving-tabindex, ArrowLeft/End wrap and viewer-visible-tab assertions listed in RESEARCH Pitfall 3 in the same task as the tab wiring.

### `src/utils/rehearsalTimes.ts` (+ test)
Add exported `formatRehearsalDateShort` (RESEARCH Code Example 3, with the NaN guard returning `''`) next to `formatWallClockTime`/`isDisplayableRehearsal`. Do not change `sortRehearsals`. Add cases in `src/utils/__tests__/rehearsalTimes.test.ts` (valid date; empty string -> `''`).

### `docs/adr/0245-<slug>.md` (NEW)
**Analog:** `docs/adr/0244-suggest-all-songs-is-a-live-ai-entry-point-calls.md` section skeleton: `# 0245. <title>` / `## Status` (Accepted) / `## Context` / `## Decision` / `## Consequences` / `## Source comments`. Content: dated rehearsals only, no seeding at creation, reject-clear, no migration, panel-local legacy-first ordering. Confirm 0245 is still the next free number (`ls docs/adr`; 0244 is max, plus `README.md`), and check whether `docs/adr/README.md` has an index to update.

### `.planning/codebase/ARCHITECTURE.md` (MOD)
Append a `### src/components/ServiceTimesPanel.vue` entry under "## Component & Composable Behavioral Notes (R318)" (L1589), following the `### src/components/ContextualActionBar.vue` shape (bold `**Module overview (...)**` lead paragraph). Cite from the component as `// See .planning/codebase/ARCHITECTURE.md (Component & Composable Behavioral Notes (R318) -> src/components/ServiceTimesPanel.vue)`, matching the `serviceEditorActionBar.ts` header-comment style.

## Shared Patterns

### Handler-gates-itself (R036)
**Source:** `ServiceEditorView.vue` L2827-2858. **Apply to:** all five rehearsal/report handlers.
```typescript
function onRemoveRehearsal(id: string): void {
  if (!canEditService.value) return
  if (!localService.value?.rehearsals) return
  ...
}
```

### Display-eligibility predicate
**Source:** `src/utils/rehearsalTimes.ts` `isDisplayableRehearsal`. **Apply to:** panel read-only list, legacy flag, tab dot. Never write a second predicate; both projections and display surfaces stay untouched (R445).

### Plain-string dates/times
`'YYYY-MM-DD'` / `'HH:mm'` only; never `new Date(str)`; use split-then-construct (`formatRehearsalDateShort`).

### Comment convention
Short comment + ADR/ARCHITECTURE.md pointer (CLAUDE.md, `.planning/codebase/CONVENTIONS.md` Comment Convention). Format: `// See ADR-NNNN (docs/adr/NNNN-slug.md)`.

### Test conventions
Requirement-id-prefixed test names; `enableAutoUnmount(afterEach)`; view tests use `shallowMount` with explicit stubs (child components are stubbed unless `Name: false`). Gate: `npm run type-check` (not just `-p tsconfig.app.json`), then bare `npx vitest run`.

## No Analog Found

| File / Behavior | Role | Data Flow | Reason |
|---|---|---|---|
| Inline add form with disabled-until-complete submit + time chips (in ServiceTimesPanel) | component | form submit | No existing inline add-form in the editor; use RESEARCH Pattern 2 |
| Reject-clear with forced native-input revert + 4 s `role="status"` message | component | event-driven | No existing revert-on-clear input; use RESEARCH Pattern 3 |

## Metadata

**Analog search scope:** `src/components`, `src/components/__tests__`, `src/views`, `src/views/__tests__`, `src/stores`, `src/utils`, `docs/adr`, `.planning/codebase/ARCHITECTURE.md`
**Note:** there is no `StageLayoutEditor.test.ts` under `src/components/__tests__` (RESEARCH cites it); `RolesConfigPanel.test.ts` is the verified mount-pattern analog. Stage components live under `src/components/stage/`.
**Pattern extraction date:** 2026-10-27
