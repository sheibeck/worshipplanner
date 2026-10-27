# Phase 143: Dated Rehearsals & Times Tab - Research

**Researched:** 2026-10-27
**Domain:** Vue 3 SFC refactor + data-rule change in a brownfield Firebase/Pinia app (service editor tab, store pre-fill, settings copy, regression guards)
**Confidence:** HIGH (everything below was verified by reading/running the actual repo code; the few browser-behavior claims are tagged `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**How a rehearsal gets its date (R441, R442)**
- Adding uses an **inline add form** in the Times tab: a date input + a time input + an "Add rehearsal" button that is **disabled until both date and time are set**. The rehearsal row is created only on submit, so a row is never created undated and no date is guessed. The form resets after adding.
- **No rehearsal rows are seeded at service creation.** `createService` stops mapping `rehearsalTimeDefaults` into undated rows. Instead the add form's **time pre-fills from the org default** (first default); when the org has more than one default time, each default is offered as a one-click **time chip** that sets the form's time. The org-default **report time is still copied** onto a new service at creation (unchanged). Changing an org default never alters an existing service.
- **Clearing a date is rejected:** an edit that sets an existing rehearsal's date to '' reverts to the previous value (Remove is the way to delete a rehearsal).
- **Time is required too:** clearing an existing rehearsal's time is likewise reverted — every new rehearsal has both date and time (matches `isDisplayableRehearsal`).
- Settings (`SettingsView.vue`) org-defaults helper copy is updated to say the default rehearsal time(s) pre-fill the time when a planner adds a rehearsal. The defaults' data shape (`rehearsalTimeDefaults: string[]`, `reportTimeDefault: string`) is unchanged — no new org setting.

**Legacy undated rows from v2.15 (R443)**
- Undated rows already stored on services render in the Times tab (editor view) with an amber **"Needs a date"** marker and a highlighted empty date input; setting a date clears the marker (the reject-clear rule only applies to rows that already have a date); Remove deletes the row.
- **No migration** — stored rows stay as-is until the planner acts. Read-only/public surfaces and both projections keep filtering them via the existing `isDisplayableRehearsal` predicate.
- A small **amber dot on the Times tab button** (editors only) when the service holds any non-displayable rehearsal row, so planners notice without opening the tab.
- Locked services holding undated rows get no special handling — rows stay hidden; Reopen to fix.

**Times tab placement & gating (R444)**
- The tab is **visible to everyone, like Slides** (not editor-gated like Roles/Stage/Messages): editable when `canEditService` (editor + Draft), read-only otherwise. Editor order: Service Order · Slides · Roles · Stage Layout · Messages · **Times**; viewer order: Service Order · Slides · Times. Added to `visibleTabOrder`, `tabButtonRef`, the `activeTab`/`ServiceEditorTabId` unions and roving-tabindex keyboard handling exactly like the sibling tabs (same classes, `role="tab"`, `aria-controls`, `v-show` panel).
- Read-only tab content: a simple list — "Report time: 8:00 AM" and each **dated** rehearsal (date, time) using the existing `formatWallClockTime` / `formatRehearsalDateShort`; an empty state when none.
- **Nothing time-related remains above the tab strip** — the header Times block (`data-testid="service-times-section"`) is removed entirely.
- Editable tab layout: two sections — **Report time** (single time input, helper "Day-of call time on {service date}") and **Rehearsals** (chronologically sorted rows: date, time, Remove; then the inline add form + default-time chips). Rows stack on mobile. Same debounced autosave + persistent save status as today (writes still go through `updateService(id, { rehearsals, reportTime })`).

### Claude's Discretion
- Exact component split (e.g. extracting a `ServiceTimesPanel.vue` from `ServiceEditorView.vue` is encouraged — the view is ~4k lines), test-id names, chip styling, and the precise empty-state copy.
- Whether the "Needs a date" row also catches a dated-but-untimed legacy row (recommended: flag any non-displayable row, label "Needs a date" / "Needs a time" accordingly).

### Deferred Ideas (OUT OF SCOPE)
- Org-level "default rehearsal day" (e.g. "the Thursday before") that could auto-create dated rows — v2 requirement in REQUIREMENTS.md.
- Rehearsal location / venue — carried v2 requirement.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R441 | A rehearsal always has a date; add produces a dated row; an existing date cannot be cleared; editor can no longer create an undated row | Add-form pattern (Pattern 2), reject-clear handler + forced DOM revert (Pattern 3, Pitfall 1), parent handler validation (Pattern 4) |
| R442 | Org-default time(s) apply without creating undated rows; new service gets no placeholder rehearsals; default pre-fills time; changing a default never mutates an existing service | `createService` change (Code Example 1), reactive pre-fill via nullable ref (Pattern 2), Settings copy, rewritten `services.rehearsalDefaults.test.ts` |
| R443 | v2.15 undated rows lose no data; flagged "needs a date"; planner can date or remove; hidden from every read-only/public surface until dated; no migration | Partition-first row ordering (Pattern 5), flag predicate `!isDisplayableRehearsal`, no-write-on-load guarantee, projection regression tests already exist |
| R444 | Controls move into a Times tab after Messages; same tab styling/keyboard; visible to all, editable only when `canEditService`; nothing time-related above the tab strip | Tab wiring checklist (Pattern 1), ActionBar widening (Pitfall 2), list of tests that must change |
| R445 | All display surfaces + both projections unchanged for dated rehearsals (R433 regression guard) | Surfaces verified read-only via `isDisplayableRehearsal`; existing `services.rehearsalProjection.test.ts` (7 tests) passes today and stays unmodified |
</phase_requirements>

## Summary

This is a pure in-repo refactor plus a small data-rule change; **no new packages, no new services, no Firestore rules change, no Cloud Function change** (verified: `firestore.rules`, `storage.rules`, and `functions/src` contain no reference to `rehearsals`). The work is: (1) a new `ServiceTimesPanel.vue` (extracted from the ~4k-line `ServiceEditorView.vue`) holding the Report time + Rehearsals sections in editable and read-only states; (2) wiring a 6th/3rd `times` tab through five places in the view plus one place **outside** the view (`serviceEditorActionBar.ts`); (3) deleting the header `service-times-section` block; (4) stopping `createService` from seeding undated rows; (5) Settings helper-copy change; (6) test updates.

The biggest risks are not in the new UI but in what it touches: **`buildActionBarItems` silently falls through to the Service Order action list for any tab it does not know** (so a naive `'times'` addition would show Suggest/Export/Print/Share/Save on the Times tab), **a rejected edit leaves reactive state unchanged so Vue will not repaint the input** (the DOM must be forced back by hand), and **~10 existing tests across 3 files hard-code the old tab order / header block** and will fail in specific, predictable ways. The projections (`buildServiceSnapshot`, `buildRehearseAccess`) and all display surfaces already filter with `isDisplayableRehearsal`; they need regression-guarding only (7 existing tests already cover it and pass today).

**Primary recommendation:** Extract `ServiceTimesPanel.vue` (props in, events out, parent keeps R036-gated handlers and the unchanged `updateService` autosave path), put the add-form state and revert-message UI inside the panel, put the same no-clear invariant in the parent handlers as defense-in-depth, widen `ActionBarTab` with an explicit `'times' -> []` branch, and leave `rehearsalTimes.ts`/projections/display surfaces byte-for-byte untouched except for moving `formatRehearsalDateShort` into `rehearsalTimes.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Add/edit/remove rehearsal rows, report time input | Browser / Client (Vue view + new panel) | Database (Firestore via `updateService`) | Pure client-editor state in `localService`; persistence rides the existing debounced autosave |
| "Date and time required" invariant | Browser / Client (panel UI + parent handlers) | — | Firestore rules do not validate rehearsal fields (verified); enforcement is client-side by design, same as before. The projections' `isDisplayableRehearsal` filter is the backstop that keeps bad rows off every read surface |
| Org-default pre-fill of the add-form time | Browser / Client (reads `authStore.settings`) | — | Read at form time, not copied into the service, so "changing a default never alters an existing service" holds trivially |
| Report-time default copy at creation | Frontend store (`useServiceStore.createService`) | Database | Unchanged behavior; copy-not-live-bind |
| Undated legacy row flagging | Browser / Client (editor only) | — | Derived from `localService.rehearsals`; no data migration |
| Public/volunteer display filtering | Frontend store projections (`buildServiceSnapshot`, `buildRehearseAccess`) | Display components (live `isDisplayableRehearsal` filter in Dashboard/ServiceCard) | Unchanged; regression-guarded |
| Tab strip, roving tabindex, panel `v-show` | Browser / Client (`ServiceEditorView.vue`) | — | Existing ADR-0217 pattern |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | ^3.5.29 (package.json) | SFC panel, `defineProps`/`defineEmits`, `v-show` | Already the app framework [VERIFIED: package.json] |
| pinia | existing | `useServiceStore`/`useAuthStore` | Already used; no change |
| tailwindcss v4 | existing | All styling via utility classes copied from the UI-SPEC | Brownfield; UI-SPEC forbids new tokens [CITED: 143-UI-SPEC.md] |
| vitest | ^4.0.18 | Unit/component tests (jsdom) | Existing app suite [VERIFIED: package.json] |
| @vue/test-utils | existing | `mount`/`shallowMount` | Existing pattern |
| vue-tsc | ^3.2.5 | `npm run type-check` (`vue-tsc --build`, includes test files) | Required gate per CLAUDE.md |

### Supporting
None. **No new dependencies are needed** (native `<input type="date|time">`, native `<form>`).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extract `ServiceTimesPanel.vue` | Inline everything in `ServiceEditorView.vue` | CONTEXT encourages extraction; view is ~4k lines; panel is independently unit-testable with `mount` (no 30 s view warm-up) |
| Parent-held add-form state | Panel-held add-form state | Panel-held keeps `v-show` form persistence and keeps the view slim; parent only receives validated `add({date,time})` |

**Installation:** none.

**Version verification:** not applicable — no packages are added. Installed baseline confirmed by running the relevant suites: 5 files / 77 tests pass today (`ServiceEditorView.timesSection`, `services.rehearsalDefaults`, `services.rehearsalProjection`, `rehearsalTimes`, `serviceEditorActionBar`) on Node v22.23.2.

## Package Legitimacy Audit

No external packages are installed by this phase. `gsd-tools query package-legitimacy check` not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 Settings (SettingsView)                    New service dialog
   rehearsalTimeDefaults[], reportTimeDefault        |
        |  (unchanged shape)                         v
        |                              createService() ──> addDoc { rehearsals: [], reportTime: <org default> }
        |                                                         (NO seeded undated rows — R442)
        v
 authStore.settings ──(defaultTimes prop, `?? []`)──┐
                                                    v
 Firestore services/{id} ──> serviceStore ──> localService (ref) ──────────────┐
   (may hold v2.15 undated rows)                    |                          |
                                                    v                          v
                             ServiceEditorView ── tab strip (…Messages · Times[•amber dot if editor && any non-displayable row])
                                    |   activeTab === 'times'  → <div v-show id=svc-panel-times role=tabpanel>
                                    v
                         ┌──────────────────────── ServiceTimesPanel ────────────────────────┐
                         │ props: rehearsals, reportTime, serviceDate, canEdit, defaultTimes  │
                         │  canEdit ? editable : read-only list (displayable only, sorted)    │
                         │  editable: Report time input ─ emit report-time-change             │
                         │            rows (legacy first, then sortRehearsals)                │
                         │              date/time @change:                                    │
                         │                 clearing a non-empty value? → revert DOM + message │
                         │                 else emit date-change / time-change                │
                         │              Remove → emit remove                                  │
                         │            add form (date, time pre-filled from defaultTimes[0],   │
                         │              chips if >1 defaults) → submit → emit add({date,time})│
                         └──────────────┬─────────────────────────────────────────────────────┘
                                        v   (events)
              parent handlers (each re-checks canEditService; re-validate; mutate localService)
                                        v
                    isDirty → debounced autosave → onSave → updateService(id,{rehearsals,reportTime})
                                        v
                    projections (UNCHANGED): buildServiceSnapshot / buildRehearseAccess
                      filter(isDisplayableRehearsal) → sortRehearsals → share / volunteer / dashboard surfaces
```

### Recommended Project Structure
```
src/
├── components/
│   ├── ServiceTimesPanel.vue            # NEW — the two sections, both states, add form, revert message
│   └── __tests__/ServiceTimesPanel.test.ts   # NEW — mount() component tests
├── utils/
│   └── rehearsalTimes.ts                # + export formatRehearsalDateShort (moved from the view)
├── views/
│   ├── ServiceEditorView.vue            # - header block, + tab button, + panel wrapper, + 3 handlers changed
│   └── serviceEditorActionBar.ts        # ActionBarTab += 'times'; explicit return [] for it
└── stores/services.ts                   # createService: rehearsals = []
docs/adr/0245-…md                        # NEW — rationale ADR (next free number; 0244 is current max)
.planning/codebase/ARCHITECTURE.md       # behavior narration entry for ServiceTimesPanel (comment convention)
```

### Pattern 1: Wire the tab exactly like siblings (verified touch-points)
**What:** A complete checklist — missing any one item is a compile error or a silent bug.
1. `ServiceEditorView.vue` L1959 `activeTab` union and L1963 `ServiceEditorTabId` union: add `'times'`.
2. L1964-1971 `visibleTabOrder`: `tabs.push('times')` **unconditionally, after the `messages` push** (editor: `[service-order, slides, roles, stage, messages, times]`; viewer: `[service-order, slides, times]`).
3. L1972-1976 add `const timesTabButtonRef = ref<HTMLButtonElement | null>(null)`; L1978-1991 `tabButtonRef` switch: add `case 'times'` (the switch has no default — TS errors on a non-exhaustive return).
4. Tab button after Messages (L914) — copy the Slides button (no `v-if`): `id="svc-tab-times"`, `ref="timesTabButtonRef"`, etc., plus the amber dot span + `sr-only` span.
5. Panel: `<div v-show="activeTab === 'times'" id="svc-panel-times" role="tabpanel" aria-labelledby="svc-tab-times" data-testid="times-panel">` containing `<ServiceTimesPanel …/>`.
6. **`src/views/serviceEditorActionBar.ts` L8** `ActionBarTab` union and **L220-231** `buildActionBarItems`: add `'times'`. See Pitfall 2.
7. `handleTabKeydown` (L1998) needs no change — it is driven by `visibleTabOrder`.
8. Comment on L1961-1962 of the view is already truncated mid-sentence (pre-existing); leave or tidy, but keep the `See ADR-0217` pointer.

**Recommendation (discretion):** keep the `id`/`role`/`aria-labelledby`/`v-show`/`data-testid` on a **parent wrapper `<div>`** (as every sibling panel does) with `<ServiceTimesPanel>` inside, rather than relying on attribute fallthrough onto the child root. Under the existing `shallowMount` view tests the child is replaced by a stub, and a parent-owned wrapper keeps `#svc-panel-times` assertions (role, aria-labelledby, `v-show`) independent of the stub. This is functionally identical to the UI-SPEC's contract (same ids/roles) and is tagged discretionary.

### Pattern 2: Add form with a reactive, race-free time pre-fill
**What:** `authStore.settings` can still be loading (or change) after the panel mounts, so do **not** copy `defaultTimes[0]` into a ref at `setup`. Hold a nullable override and derive the effective value.
**When to use:** the add-form time input and the chip "selected" state.
```typescript
// ServiceTimesPanel.vue <script setup lang="ts">
const newDate = ref('')
const newTimeOverride = ref<string | null>(null)        // null = "follow the org default"
const newTime = computed({
  get: () => newTimeOverride.value ?? props.defaultTimes[0] ?? '',
  set: (v: string) => { newTimeOverride.value = v },
})
const canAdd = computed(() => props.canEdit && newDate.value !== '' && newTime.value !== '')

function onSubmitAdd() {
  if (!canAdd.value) return
  emit('add', { date: newDate.value, time: newTime.value })
  newDate.value = ''
  newTimeOverride.value = null                          // re-pre-fills from defaultTimes[0] (or '')
  void nextTick(() => addDateInput.value?.focus())
}
```
Template: `<form data-testid="add-rehearsal-form" @submit.prevent="onSubmitAdd">` with the button `type="submit"` and `:disabled="!canAdd"` (satisfies "Enter in either input adds when enabled"). Chips: `v-if="defaultTimes.length > 1"`, `type="button"`, `:aria-pressed="newTime === t"`, `@click="newTime = t"`.
Note: if the user clears the time input in the add form, `newTimeOverride` becomes `''` (not `null`) so the default does **not** snap back mid-edit — that is correct; the Add button stays disabled.

### Pattern 3: Reject-clear with forced DOM revert (panel) + invariant in parent (defense in depth)
**What:** `:value="rehearsal.date"` is a one-way controlled binding. When the handler declines to mutate state, Vue sees no change and **does not re-render the input**, so the native input keeps the cleared value. You must reset `event.target.value` yourself.
```typescript
function onDateChange(r: Rehearsal, e: Event) {
  const input = e.target as HTMLInputElement
  const next = input.value
  if (r.date !== '' && next === '') {                   // reject-clear applies only once a value exists
    input.value = r.date                                // force the native control back
    showRevert(r.id, 'date')                            // role="status", clears on next change or after 4 s
    return
  }
  clearRevert()
  emit('date-change', { id: r.id, date: next })
}
```
Identical rule for time. A legacy row (`r.date === ''`) and `next === ''` is a harmless no-op (nothing to revert to); do not show the message.
Revert message: `data-testid` e.g. `rehearsal-revert-message`, `role="status"`, `text-xs text-amber-300 mt-1`; hold one `{ id, field } | null` ref; `setTimeout(clear, 4000)` — store the handle and `clearTimeout` on the next change and in `onBeforeUnmount`.

**Autosave/isDirty interaction (verified):** `isDirty` is `JSON.stringify(localService) !== JSON.stringify(originalService)` (L2860). A rejected edit never mutates `localService`, so `isDirty` does not change and **no autosave is armed** — no extra work needed and nothing to roll back. The only residual hazard is the stale DOM value above.

### Pattern 4: Parent handlers (keep R036 self-gating, add validation)
The existing handlers are at L2827-2858 of `ServiceEditorView.vue`. Keep their names (`onAddRehearsal`, `onRemoveRehearsal`, `onRehearsalDateChange`, `onRehearsalTimeChange`, `onReportTimeChange`) so the existing direct-`vm` test style keeps working, but change semantics:
```typescript
function onAddRehearsal(payload: { date: string; time: string }): void {
  if (!canEditService.value) return
  if (!localService.value) return
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date) || !/^\d{2}:\d{2}$/.test(payload.time)) return   // never create a partial row
  if (!localService.value.rehearsals) localService.value.rehearsals = []
  localService.value.rehearsals.push({ id: crypto.randomUUID(), date: payload.date, time: payload.time })
}
function onRehearsalDateChange(id: string, newDate: string): void {
  if (!canEditService.value) return
  const r = localService.value?.rehearsals?.find((x) => x.id === id)
  if (!r) return
  if (r.date !== '' && newDate === '') return           // R441: a dated row can never go undated
  r.date = newDate
}
// onRehearsalTimeChange: same shape, `r.time !== '' && newTime === ''` → return
```
The old zero-arg `onAddRehearsal` pushed `{date:'',time:''}` — that is the code path R441 removes; there must be **no remaining caller** that can create an empty-date row (grep after the change: `date: ''` should appear only in tests/legacy fixtures).

### Pattern 5: Row ordering — legacy rows first, panel-local
UI-SPEC says non-displayable legacy rows sort **first** so planners see them; the existing `sortRehearsals` puts undated rows **last** (`rehearsalTimes.ts` L21-28, pinned by `rehearsalTimes.test.ts`). **Do not change `sortRehearsals`** — it feeds both projections. Partition inside the panel:
```typescript
const rows = computed(() => {
  const legacy = props.rehearsals.filter((r) => !isDisplayableRehearsal(r))
  const dated = sortRehearsals(props.rehearsals.filter(isDisplayableRehearsal))
  return [...legacy, ...dated]
})
```
Marker text: `r.date === '' ? 'Needs a date' : 'Needs a time'` (only reached when not displayable, so date-set implies time-empty). Row `data-testid="rehearsal-row-needs-fix"` only on legacy rows. Because rows are keyed by `id`, a row moves from the legacy group into the sorted group the instant its last missing field is filled — expected.

### Pattern 6: Read-only panel
`canEdit === false` → no inputs/form/chips/Remove/markers. Report time line via `formatWallClockTime`; rehearsal `<ul data-testid="times-readonly">` of `isDisplayableRehearsal` rows sorted by `sortRehearsals`; empty state when `!reportTime && displayable.length === 0`. Use the existing label format `${formatRehearsalDateShort(date)}, ${formatWallClockTime(time)}` (e.g. "Nov 6, 7:00 PM") — see Open Question 1 about the UI-SPEC's weekday example.

### Anti-Patterns to Avoid
- **Creating a `{date:'',time:''}` row "to be filled in":** exactly what R441 forbids; creation happens only on submit with both values.
- **Changing `sortRehearsals`/`isDisplayableRehearsal`/projection builders:** R445 is a regression guard; they are shared by both projections and every display surface.
- **Copying `defaultTimes[0]` into a ref at setup:** breaks when settings load late (Pattern 2).
- **Relying on `v-model`/state to revert a rejected edit:** state didn't change, so nothing re-renders (Pattern 3).
- **Reading `authStore.settings.rehearsalTimeDefaults` from a display component:** the existing comment in `createService` forbids it for *display*; the add-form reading it at input time is the sanctioned new use (it supplies an input default, not a displayed fact).
- **Adding `'times'` to `ActionBarTab` without an explicit branch:** Pitfall 2.
- **Long inline comments:** CLAUDE.md comment convention — short pointers; rationale → ADR, narration → `.planning/codebase/ARCHITECTURE.md`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date + time display strings | Custom formatter / `new Date('YYYY-MM-DD')` | `formatWallClockTime` + moved `formatRehearsalDateShort` (split-then-construct) | `new Date(str)` is timezone-ambiguous and parses date-only as UTC (off-by-one day); the repo convention forbids it [VERIFIED: rehearsalTimes.ts L31-46, view L2820-2825] |
| "Is this row real enough to show" | A second predicate | `isDisplayableRehearsal` | Single shared predicate used by both projections, Dashboard, ServiceCard |
| Chronological order | Own comparator | `sortRehearsals` for the dated group | Same util as projections |
| Tab keyboard nav | New key handling | Existing `handleTabKeydown` + `visibleTabOrder` | ADR-0217 roving tabindex |
| Persistence | New write path | Existing `onSave` → `updateService(id,{rehearsals,reportTime})` | Autosave, save-status, R036 draft guard, `ServiceLockedError` handling all hang off it |
| Enter-to-submit | Keydown handlers | Native `<form @submit.prevent>` + `type="submit"` | Free, accessible, testable via `trigger('submit')` |

**Key insight:** the phase moves existing behavior and tightens one invariant; every durable piece (save path, projections, tab a11y, formatters) already exists and must be reused unchanged.

## Runtime State Inventory

> This is not a rename, but it is a data-rule change with legacy stored rows, so the five categories are answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Firestore `organizations/{org}/services/{id}.rehearsals[]` on services created under v2.15 may contain `{id, date:'', time:'HH:mm'}` rows (seeded by the old `createService`). Also date-only/time-less in-progress rows are possible (editor autosaved mid-edit). | **No migration** (locked). Code edit only: render them flagged; never rewrite on load. Verify no code path writes on load (the autosave fires only when `isDirty`, and loading sets `localService`/`originalService` identical) |
| Live service config | None — verified: no rehearsal field in `firestore.rules`, `storage.rules`, `functions/src`, or the Cloud Functions | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new secret or env var | None |
| Build artifacts / installed packages | None. The projections `lockSnapshots/current`, public `shareTokens`/`serviceShareLinks` payloads, and `rehearseAccess/{id}` already filter non-displayable rows at write time; previously written projection docs remain valid | None — no re-projection needed because the filter is unchanged |

**Canonical question — after all files change, what still holds old state?** Only the legacy undated rows in already-created service docs, by design. They stay hidden everywhere read-only (already true) and flagged in the editor (new).

## Common Pitfalls

### Pitfall 1: Rejected edit leaves the native input showing the cleared value
**What goes wrong:** Planner clears a date; handler returns early; input still displays blank while state holds the old date → UI/state divergence, and the next unrelated edit looks like it "lost" the date.
**Why it happens:** `:value` is a one-way binding; no reactive change means no patch.
**How to avoid:** `input.value = previous` in the panel (Pattern 3); assert in a test that `(input.element as HTMLInputElement).value` equals the old date after a simulated clear.
**Warning signs:** a test that only checks emitted events/state and never reads the DOM value.
**Related risk `[ASSUMED]`:** Chrome's date input fires `change` with `''` when the user backspaces a single segment (value becomes incomplete). That would revert mid-typing, snapping the field back. Typing *over* a segment does not clear first, and the picker always yields a full date, so this is acceptable and matches the locked "revert" decision; note it for the batched human UAT (milestone-end) rather than engineering around it.

### Pitfall 2: `buildActionBarItems` falls through to Service Order items for an unknown tab
**What goes wrong:** `serviceEditorActionBar.ts` L220-231 ends with `return buildServiceOrderItems(ctx)` for anything not explicitly matched. Adding `'times'` to the union but not adding `if (tab === 'times') return []` makes the Times tab show Suggest-all-songs / Export / Print / Messages / Share / Save in the contextual action bar.
**Why it happens:** the function is a chain of early returns, not an exhaustive switch; and the view passes `activeTab.value` straight in (L2916), so the **view's `activeTab` type must be assignable to `ActionBarTab`** or `vue-tsc` fails.
**How to avoid:** widen `ActionBarTab`, add `if (tab === 'times') return []` with a short comment (precedent: Roles/Messages/Stage), and add a `times` row to the GATING MATRIX plus a "TIMES EMPTY across the cartesian product" test mirroring the existing `ROLES EMPTY`/`MESSAGES EMPTY` tests (`serviceEditorActionBar.test.ts` ~L140-200, plus the cartesian generator at L88-105).
**Warning signs:** type-check passes (the union widening compiles either way) but the tab shows service-order buttons — only a behavior test catches it.

### Pitfall 3: Existing tests that hard-code the old tab order will fail (known, enumerated)
- `src/views/__tests__/ServiceEditorView.stage.test.ts` L345-358 — `tabIds` `toEqual` the 5-id editor list → append `'svc-tab-times'`.
- `ServiceEditorView.stage.test.ts` L512-527 — "ArrowLeft from Service Order wraps to Messages" → now wraps to **Times**; second ArrowLeft lands on **Messages**, a third on Stage.
- `src/views/__tests__/ServiceEditorView.test.ts` L9075-9085 — ArrowRight sequence: add `'svc-tab-times'` after `'svc-tab-messages'` before `'svc-tab-service-order'`.
- `ServiceEditorView.test.ts` L9087-9094 (ArrowLeft wrap) and L9096-9105 (End) — last visible tab is now Times.
- `ServiceEditorView.test.ts` L9107-9117 — viewer: visible tabs are now Service Order · Slides · **Times**; ArrowLeft from Service Order wraps to **Times** (not Slides).
- `ServiceEditorView.test.ts` L9063-9071 roving tabindex test: add `svc-tab-times` `tabindex === '-1'`.
- `ServiceEditorView.test.ts` L9017-9027 ("does not render Roles/Messages for a non-editor"): add `expect(wrapper.find('#svc-tab-times').exists()).toBe(true)` for a viewer.
- `ServiceEditorView.timesSection.test.ts` — the whole file targets the removed header block (`service-times-readonly`, `add-rehearsal-btn` zero-arg handler) → rewrite (see Validation Architecture).
- `src/stores/__tests__/services.rehearsalDefaults.test.ts` L86-104 (asserts 2 undated rows) and L106-148, L150-161 — rewrite expectations to `rehearsals: []`; keep the report-time and copy-not-live-bind assertions.
- A tab button containing the `sr-only` "(needs attention)" span changes `wrapper.get('#svc-tab-times').text()` to `"Times(needs attention)"` for editors with legacy rows; use `toContain('Times')` in those tests and exact `'Times'` only in no-legacy fixtures.
**How to avoid:** make these test edits part of the same plan/task as the tab wiring, not a later cleanup.

### Pitfall 4: `shallowMount` stubs the extracted panel
**What goes wrong:** Every existing view test uses `shallowMount(ServiceEditorView, …)`; a child `ServiceTimesPanel` is stubbed, so `wrapper.find('[data-testid="add-rehearsal-btn"]')` returns nothing even though the feature works.
**How to avoid:** unit-test the panel itself with `mount(ServiceTimesPanel, { props })` (fast, no view warm-up — the view's `beforeAll` warm-up is ~9 s per file); at view level assert wiring via `wrapper.findComponent(ServiceTimesPanel).props()` and by emitting from it (`panel.vm.$emit('add', {...})`), or add `ServiceTimesPanel: false` to the `stubs` map (same trick the file already uses with `ContextualActionBar: false`) for the few tests that need real DOM.

### Pitfall 5: Mock auth stores lack `rehearsalTimeDefaults`
**What goes wrong:** The view tests' `mockAuthState.settings` (e.g. `ServiceEditorView.timesSection.test.ts` L180-200) has no `rehearsalTimeDefaults`. `authStore.settings.rehearsalTimeDefaults` is `undefined` there; passing it as a required array prop and then reading `.length`/`[0]` throws as soon as the real panel renders.
**How to avoid:** in the view pass `:default-times="authStore.settings.rehearsalTimeDefaults ?? []"` (harmless on the real typed store, saves editing ~6 test fixtures), and give the panel prop a default (`withDefaults(..., { defaultTimes: () => [] })`). Same for `settings.reportTimeDefault` — not needed by the panel (report time is read from `localService`).

### Pitfall 6: Focus management is untestable without attaching to the document
**What goes wrong:** "Focus returns to the add form's date input after add/remove" — `document.activeElement` assertions are always `body` in a detached jsdom mount.
**How to avoid:** `mount(ServiceTimesPanel, { props, attachTo: document.body })` for those two tests, and `await nextTick()` after the action. `enableAutoUnmount(afterEach)` (already used in the sibling test) cleans the attach.

### Pitfall 7: `isDirty`/autosave key-order and stranded dirty
**What goes wrong:** `isDirty` compares `JSON.stringify` of whole objects, so key order matters. A new row pushed as `{ id, date, time }` matches the stored order; building rows with a different key order would not break correctness (both sides of the comparison come from the same writer) but keep `{id,date,time}` for consistency with `services.rehearsalProjection` fixtures.
`onSave` already mirrors `rehearsals`/`reportTime` in both the payload and the post-save comparison (L4848-4849, L4883-4884) — **no change to `onSave` is needed**; do not touch it.

### Pitfall 8: Existing dated-but-untimed legacy rows
**What goes wrong:** A v2.15 autosave mid-edit can have stored `{date:'2026-09-11', time:''}`. If the flag predicate were `date === ''` only, this row would be hidden everywhere *and* not flagged in the editor.
**How to avoid:** flag `!isDisplayableRehearsal(r)` (CONTEXT discretion item, recommended). Tab dot uses the same predicate. Highlight the empty input(s) with the amber border classes.

### Pitfall 9: Settings test/helper copy and comment
`SettingsView.vue` L553-556 helper text and the L545-549 HTML comment both describe "copied into a service's OWN rehearsals[]". Update both (comment: short pointer only). `SettingsView.test.ts` has no assertion on that copy (verified by grep — only mock plumbing), so no test change is required, but add one assertion for the new sentence if desired.

## Code Examples

### 1. `createService` after the change (`src/stores/services.ts` L474-484)
```typescript
// Org default report time is copied once at creation; rehearsals start empty and
// are added dated by the planner (the default rehearsal time only pre-fills the
// add form). See ADR-0245.
const rehearsals: { id: string; date: string; time: string }[] = []
const reportTime = authStore.settings.reportTimeDefault
```
Keep `rehearsals` (empty array) in both the `addDoc` payload (L493) and the `created` object (L516) — the existing test "empty defaults produce `[]`, not undefined" remains valid and an explicit `[]` keeps `isDirty` stable for new docs. Delete the now-misleading "planner dates each rehearsal" comment.

### 2. Amber tab dot (view)
```vue
<button id="svc-tab-times" ref="timesTabButtonRef" role="tab" type="button"
  :aria-selected="activeTab === 'times'" aria-controls="svc-panel-times"
  :tabindex="activeTab === 'times' ? 0 : -1"
  class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
  :class="activeTab === 'times' ? 'text-indigo-300 border-indigo-500 bg-gray-900' : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
  @click="activeTab = 'times'">
  Times
  <template v-if="authStore.isEditor && hasNonDisplayableRehearsal">
    <span data-testid="times-tab-attention-dot" class="inline-block h-2 w-2 rounded-full bg-amber-400 ml-1.5 align-middle" aria-hidden="true" />
    <span class="sr-only">(needs attention)</span>
  </template>
</button>
```
```typescript
const hasNonDisplayableRehearsal = computed(() =>
  (localService.value?.rehearsals ?? []).some((r) => !isDisplayableRehearsal(r)),
)
```
`isDisplayableRehearsal` is already imported in the view (L2817 uses it); remove `editableRehearsals`/`readOnlyRehearsals` (L2809-2818) once the panel owns ordering, and keep `sortRehearsals` import only if still used (type-check/oxlint will flag unused imports).

### 3. Moved formatter (`src/utils/rehearsalTimes.ts`)
```typescript
/** 'YYYY-MM-DD' -> short local label ("Sep 11"); never `new Date(str)`. */
export function formatRehearsalDateShort(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number) as [number, number, number]
  if ([year, month, day].some(Number.isNaN)) return ''
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```
Add unit tests beside `rehearsalTimes.test.ts` (valid date, empty string → `''`). The report-time helper "Day-of call time on {service date}" calls this with `localService.date`; fall back to "Day-of call time" when it returns `''`.

### 4. Panel test skeleton (mount, no view warm-up)
```typescript
import { mount, enableAutoUnmount } from '@vue/test-utils'
import ServiceTimesPanel from '@/components/ServiceTimesPanel.vue'
enableAutoUnmount(afterEach)

const base = { rehearsals: [], reportTime: '', serviceDate: '2026-11-08', canEdit: true, defaultTimes: ['19:00'] }
it('Add is disabled until both date and time are set; pre-fills time from the first default', async () => {
  const w = mount(ServiceTimesPanel, { props: base })
  const btn = w.get('[data-testid="add-rehearsal-btn"]')
  expect((w.get('[data-testid="new-rehearsal-time"]').element as HTMLInputElement).value).toBe('19:00')
  expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  await w.get('[data-testid="new-rehearsal-date"]').setValue('2026-11-05')
  expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  await w.get('[data-testid="add-rehearsal-form"]').trigger('submit')
  expect(w.emitted('add')![0]).toEqual([{ date: '2026-11-05', time: '19:00' }])
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v2.15 R430/R432: org default time seeded as **undated** placeholder rows at creation; header Times block | Phase 143: no seeding; time pre-fills an add form; dedicated Times tab; every row dated | v2.16 (this phase) | Revises archived Phase 139 decisions; projections/display unchanged (R433) |
| Zero-arg `+ Add rehearsal` pushing `{date:'',time:''}` | Submit-only add with both values | this phase | Closes the only undated-row creation path |

**Deprecated/outdated:** `service-times-section` / `service-times-readonly` test ids; `editableRehearsals`/`readOnlyRehearsals` in the view; the "undated rows are seed state" comments in `rehearsalTimes.ts` L10 and `services.ts` L196-200 and `rehearseAccess.ts` L270-273 (update wording to "legacy v2.15 rows / in-progress edits" — comment-only, short).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Chrome fires `change` with value `''` when a single date/time segment is backspaced, so the reject-clear revert can snap the field back mid-typing | Pitfall 1 | Low — locked decision already accepts the revert; only affects feel. Check in the batched human UAT |
| A2 | `stubs: { ServiceTimesPanel: false }` under `shallowMount` renders the real child (same mechanism as the existing `ContextualActionBar: false`) | Pitfall 4 | Low — fall back to `mount` for the panel and `findComponent(...).props()` at view level |
| A3 | ADR number 0245 is the next free number | Project Structure | Trivial — check `docs/adr/` max at write time (0244 at research time, 245 files incl. README) |

## Open Questions (RESOLVED)

1. **Read-only list format: UI-SPEC example vs. its own rule**
   - RESOLVED: use the existing formatter output, e.g. "Nov 6, 7:00 PM" (`formatRehearsalDateShort` + ", " + `formatWallClockTime`), with no weekday. Adopted in 143-02 Task 2.
   - What we know: UI-SPEC L172 gives the example "Thu, Nov 6 · 7:00 PM" but in the same sentence says the format "follows `formatRehearsalDateShort` + ', ' as in the current read-only string", which yields "Nov 6, 7:00 PM" (no weekday, comma not "·"). `formatRehearsalDateShort` has `{month:'short', day:'numeric'}` only.
   - What's unclear: whether a weekday is wanted.
   - Recommendation: use the existing formatter output ("Nov 6, 7:00 PM") — it is the stated rule, avoids changing a function other callers/tests depend on, and the example is plainly illustrative. Do not add a weekday formatter.

2. **Non-displayable rows sort first (UI-SPEC) vs. last (`sortRehearsals`)**
   - RESOLVED: partition inside the panel (legacy rows first, dated rows via the unchanged `sortRehearsals`); `sortRehearsals` is untouched. Adopted in 143-02 Task 2.
   - Recommendation: panel-local partition (Pattern 5); leave `sortRehearsals` untouched (pinned by tests and used by projections).

3. **Should the panel or the parent own the "revert" UI?**
   - RESOLVED: the panel owns the DOM revert and the `role="status"` message; the parent handlers silently re-enforce the same invariant (defense in depth). Adopted in 143-02 Task 2 and 143-03 Task 3.
   - Recommendation: panel (it owns DOM + message); parent re-enforces the invariant silently (Pattern 4). Both are tested.

4. **Duplicate rehearsals (same date and time)**
   - RESOLVED: allowed. No new rule; no plan adds a uniqueness check.
   - What we know: nothing in R441-R445 forbids them; real services carry 0-3 rows.
   - Recommendation: allow (no new rule). Out of scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | v22.23.2 | — |
| vitest (jsdom) | app suite | ✓ | ^4.0.18 | — |
| vue-tsc | `npm run type-check` | ✓ (package.json) | ^3.2.5 | — |
| Firebase emulator | **not required** — no rules change, no Firestore-touching test added | n/a | — | — |
| `.env.local` | full-suite/build only in fresh worktrees | n/a (main checkout) | — | `worktree-env-setup` skill if a worktree is used (`use_worktrees: false` in config) |

**Missing dependencies with no fallback:** none. **With fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 + @vue/test-utils, environment jsdom |
| Config file | `vite.config.ts` (`test:` block; excludes `src/rules.test.ts` and `render-service/**`) |
| Quick run command | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts src/utils/__tests__/rehearsalTimes.test.ts src/stores/__tests__/services.rehearsalDefaults.test.ts src/stores/__tests__/services.rehearsalProjection.test.ts src/views/__tests__/serviceEditorActionBar.test.ts` |
| View-level command | `npx vitest run src/views/__tests__/ServiceEditorView.timesSection.test.ts src/views/__tests__/ServiceEditorView.stage.test.ts src/views/__tests__/ServiceEditorView.test.ts` (each view file has a ~9-30 s warm-up; `ServiceEditorView.test.ts` is 9000+ lines) |
| Full suite command | `npx vitest run` (bare — correct per CLAUDE.md; baseline: only `src/storage.rules.test.ts` fails) |
| Type gate | `npm run type-check` (`vue-tsc --build`, includes test files — mandatory; `-p tsconfig.app.json` is not sufficient) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R441 | Add disabled until date+time; emits only `{date,time}` both non-empty; no empty-date row creatable | component | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts -t "Add"` | ❌ Wave 0 |
| R441 | Clearing a dated row's date/time reverts DOM value, shows `role=status` message, emits nothing, clears after 4 s (fake timers) | component | `… ServiceTimesPanel.test.ts -t "revert"` | ❌ Wave 0 |
| R441 | Parent `onRehearsalDateChange/TimeChange` no-op on clearing a non-empty value; `onAddRehearsal` rejects partial/malformed payloads; handlers no-op when `!canEditService` | view (vm) | `… ServiceEditorView.timesSection.test.ts` | ♻️ rewrite |
| R441 | Edit through the view → `updateService` called with `rehearsals` (autosave path unchanged; fake timers 800 ms) | view | `… ServiceEditorView.timesSection.test.ts -t "autosave"` | ♻️ new case |
| R442 | `createService` writes `rehearsals: []` and still copies `reportTime`; copy-not-live-bind retained | unit | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts` | ♻️ rewrite |
| R442 | Add-form time pre-fills from `defaultTimes[0]`; re-prefills after reset; follows late-arriving defaults; chips only when >1 default, click sets form time only, `aria-pressed` | component | `… ServiceTimesPanel.test.ts -t "default"` | ❌ Wave 0 |
| R442 | Settings helper copy updated | view | `npx vitest run src/views/__tests__/SettingsView.test.ts` | ♻️ optional assertion |
| R443 | Legacy undated / date-only rows render first with "Needs a date"/"Needs a time" + amber input; setting the field clears the marker; Remove deletes; unflagged for fully valid rows | component | `… ServiceTimesPanel.test.ts -t "legacy"` | ❌ Wave 0 |
| R443 | Tab dot present only for editor with any non-displayable row; absent for viewer; disappears once fixed; `sr-only` text | view | `… ServiceEditorView.timesSection.test.ts -t "dot"` | ❌ Wave 0 |
| R443/R445 | Projections still drop undated/untimed rows and keep raw doc | unit | `npx vitest run src/stores/__tests__/services.rehearsalProjection.test.ts` | ✅ exists (7 tests, unchanged, must stay green) |
| R444 | Editor tab order incl. `svc-tab-times` last; viewer sees Service Order·Slides·Times; aria wiring (`aria-controls=svc-panel-times`, panel `role=tabpanel`, `aria-labelledby`) | view | `… ServiceEditorView.stage.test.ts`, `… ServiceEditorView.test.ts -t "tab strip"` | ♻️ update (Pitfall 3) |
| R444 | Roving tabindex/Arrow/Home/End include Times (editor + viewer) | view | `… ServiceEditorView.test.ts -t "keyboard navigation"` | ♻️ update |
| R444 | Times tab exposes no action-bar items (`[]` over the full cartesian context product) | unit | `npx vitest run src/views/__tests__/serviceEditorActionBar.test.ts` | ♻️ add row + "TIMES EMPTY" test |
| R444 | Header block gone: `[data-testid="service-times-section"]` absent; no time controls outside `#svc-panel-times` | view | `… ServiceEditorView.timesSection.test.ts -t "header"` | ❌ Wave 0 |
| R444 | Read-only: viewer or locked editor sees list of displayable rows + report time, no inputs/Remove/form/markers; empty state | component + view | `… ServiceTimesPanel.test.ts -t "read-only"` | ❌ Wave 0 |
| R445 | `formatRehearsalDateShort` (moved) unit tests; display surfaces untouched | unit | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts src/components/__tests__/ScheduleServiceCard.test.ts` | ♻️ add cases |
| R445 | No source diff in Dashboard/ServiceCard/ScheduleServiceCard/ShareView/VolunteerServiceView/MyScheduleView/`rehearseAccess.ts`/`buildServiceSnapshot` body | review gate | `git diff --stat -- src/views/DashboardView.vue src/components/ServiceCard.vue src/components/ScheduleServiceCard.vue src/views/ShareView.vue src/views/VolunteerServiceView.vue src/views/MyScheduleView.vue src/utils/rehearseAccess.ts` expect empty | manual check in verify |

### Sampling Rate
- **Per task commit:** the Quick run command (≈20 s) plus `npx vue-tsc --noEmit -p tsconfig.app.json` as an inner-loop check
- **Per wave merge:** Quick + View-level commands + `npm run type-check`
- **Phase gate:** bare `npx vitest run` (only `storage.rules.test.ts` may fail) **and** `npm run type-check` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/__tests__/ServiceTimesPanel.test.ts` — covers R441/R442/R443/R444 panel behavior (use `mount`, `attachTo: document.body` for focus tests, `vi.useFakeTimers()` for the 4 s message)
- [ ] `src/views/__tests__/ServiceEditorView.timesSection.test.ts` — rewrite for the Times tab/dot/header-removal/handler invariants (reuse its existing mock scaffold; add `ServiceTimesPanel: false` stub only where real DOM is needed)
- [ ] `formatRehearsalDateShort` cases in `src/utils/__tests__/rehearsalTimes.test.ts`
- [ ] Framework install: none — existing infrastructure covers the phase

### Human/visual items to defer (milestone-end batched UAT, mark PENDING not accepted)
Real-browser date/time input revert feel (A1); 360 px tab-strip overflow scroll-into-view of the 6th tab (UI-SPEC backstop); amber contrast on `bg-gray-950`; mobile stacking <640 px; sr-only dot announcement.

## Security Domain

`security_enforcement` is absent in config → enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (unchanged) |
| V3 Session Management | no | — |
| V4 Access Control | yes (unchanged) | `canEditService` gate in every handler + `:disabled`/`v-if`; store-level R036 draft-only guard in `updateService` mirrors `firestore.rules` services update rule; no rule change |
| V5 Input Validation | yes | Add handler validates `YYYY-MM-DD` / `HH:mm` before creating a row; native `type=date|time` inputs; values are stored as plain strings and rendered via Vue text interpolation (auto-escaped) |
| V6 Cryptography | no | `crypto.randomUUID()` for row ids (existing) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-editor/locked-service mutation via stale handler reference | Tampering / Elevation | Handlers re-check `canEditService`; server-side R036 guard + Firestore rules reject non-draft updates |
| Malformed/partial rehearsal data reaching a public surface | Information integrity | `isDisplayableRehearsal` filter in both projections (unchanged, regression-tested) — client editor rules are not a security boundary (rules do not validate rehearsal fields; pre-existing and acceptable because read surfaces filter) |
| Injection via free-text | Tampering | None — no free-text field is introduced (date/time only); no `v-html` |
| Cross-tenant data via org defaults | Information disclosure | Defaults read from the signed-in org's own `authStore.settings` only |

## Project Constraints (from CLAUDE.md)

- **Comment convention:** keep comments short; rationale → ADR under `docs/adr/` (cite `// See ADR-NNNN (…)`), behavior narration → `.planning/codebase/` map docs (cite `// See .planning/codebase/ARCHITECTURE.md (§ …)`). Add one ADR (next number) for "dated rehearsals / no seeding / reject-clear / no migration", and one Component Behavioral Notes entry in `ARCHITECTURE.md` for `ServiceTimesPanel.vue`.
- **Type-check gate:** `npm run type-check` (`vue-tsc --build`), not just `-p tsconfig.app.json` — test files are typechecked (five TS2339 errors once survived two phases).
- **Testing:** bare `npx vitest run` is the correct app-suite command (excludes `src/rules.test.ts` and `render-service/**`); do not use `--dir src`; baseline known-failing file is `src/storage.rules.test.ts` only (a real defect, do not "fix" the rule to `request.auth != null`).
- **graphify:** graph needs a rebuild (stale `.gsd/` paths) — verify any graph hit against real `src/` paths; run `/gsd:graphify build` after code changes. Not used in this research (code was read directly).
- **`.gsd/` is gone:** do not cite it; `.planning/` is the only planning store. (Archived v2.15 Phase 139 docs under `.planning/milestones/v2.15-phases/139-*` are legitimate planning history.)
- **Proxy calls need `X-App-Auth`** / **Cloud Functions re-export / deploy policy:** not triggered — no proxy fetch and no new function in this phase. Deploys need per-deploy owner confirmation (STATE.md run instructions).
- **`.env.local`** is required in any fresh worktree (config `use_worktrees: false`).
- **Handler-gates-itself (R036):** every mutation handler re-checks `canEditService` — preserve in all five handlers.

## Sources

### Primary (HIGH confidence) — read/executed in this session
- `src/views/ServiceEditorView.vue` L225-335 (header block), L810-915 (tab strip), L1700-1710 (Messages panel pattern), L1954-2021 (tab state/keyboard), L2562 (activeTab watch), L2780-2863 (rehearsal handlers, `isDirty`), L2915-2950 (action bar wiring), L2990-3130 (autosave/merge), L4798-4892 (`onSave`)
- `src/views/serviceEditorActionBar.ts` L1-10, L205-232
- `src/utils/rehearsalTimes.ts`, `src/utils/rehearseAccess.ts`, `src/stores/services.ts` (L185-215, L456-525), `src/types/service.ts`, `src/types/organization.ts`, `src/views/SettingsView.vue` L545-614
- Display surfaces: `DashboardView.vue`, `ServiceCard.vue`, `ScheduleServiceCard.vue`, `ShareView.vue`, `VolunteerServiceView.vue`, `MyScheduleView.vue` (grep of `rehearsals`/`isDisplayableRehearsal`)
- Tests read: `ServiceEditorView.timesSection.test.ts`, `ServiceEditorView.stage.test.ts` (tab tests), `ServiceEditorView.test.ts` L8940-9118, `services.rehearsalDefaults.test.ts`, `services.rehearsalProjection.test.ts` (test names), `serviceEditorActionBar.test.ts`, `StageLayoutEditor.test.ts` (mount pattern)
- `vite.config.ts`, `package.json`, `.planning/config.json`, `CLAUDE.md`, `.planning/codebase/CONVENTIONS.md` (Comment Convention)
- Executed: `npx vitest run` over 5 relevant files → 5 files / 77 tests passed

### Secondary (MEDIUM confidence)
- `.planning/phases/143-dated-rehearsals-times-tab/143-CONTEXT.md`, `143-UI-SPEC.md`, `.planning/REQUIREMENTS.md` (R441-R445), `.planning/STATE.md`

### Tertiary (LOW confidence)
- Browser date-input `change`-on-incomplete behavior (A1) — training knowledge, `[ASSUMED]`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing stack confirmed in package.json and by running tests
- Architecture: HIGH — every touch-point located by line number and cross-checked against sibling tab wiring and the action-bar fall-through
- Pitfalls: HIGH for repo-derived items (1-3, 4-5, 7-9 verified in code); MEDIUM for the Chrome date-input behavior (A1)

**Research date:** 2026-10-27
**Valid until:** 2026-11-26 (stable brownfield code; re-verify line numbers if `ServiceEditorView.vue` changes before planning)
