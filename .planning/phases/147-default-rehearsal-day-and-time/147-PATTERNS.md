# Phase 147: Default Rehearsal Day and Time - Pattern Map

**Mapped:** 2026-11-06
**Files analyzed:** 13 (code) + docs
**Analogs found:** 12 / 13 (spec/ADR docs follow templates in `docs/specs/TEMPLATE.md` and existing ADRs)

All line numbers are as read on 2026-11-06. `services.ts`, `rehearsalTimes.ts`, `rehearseAccess.ts`, `service.ts`, `organization.ts` and `SettingsView.vue` are CRLF in the working tree: use single-line edit anchors.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `docs/specs/default-rehearsal.md` | spec | n/a | `docs/specs/TEMPLATE.md` (and the Phase 146 spec) | template |
| `src/utils/rehearsalTimes.ts` (add helpers, `StoredRehearsal`, `toPublicRehearsal`) | utility | transform | itself (`sortRehearsals`, `isDisplayableRehearsal`) | exact |
| `src/types/organization.ts` (`rehearsalDefaultWeekday`) | config/type | CRUD | `rehearsalTimeDefaults` / `reportTimeDefault` in same file (lines 102-106, 185) | exact |
| `src/types/service.ts:~282` | model | n/a | inline rehearsal row type there | exact |
| `src/stores/services.ts` `createService` (auto-add) | service | CRUD | itself, lines 456-515 | exact |
| `src/stores/services.ts` `updateService` (retire old serviceShares doc) | service | CRUD, soft-fail | `deleteService` step 3, lines 923-941 | exact |
| `src/stores/services.ts` `buildServiceSnapshot` (narrow) | utility | transform | itself, lines 196-206 | exact |
| `src/utils/rehearseAccess.ts:~281` (narrow) | utility | transform | `buildServiceSnapshot` | exact |
| `src/views/SettingsView.vue` (select, save, rollback, watcher) | component | request-response | `onSaveRehearsalDefaults` 1344-1376 | exact |
| `src/components/ServiceTimesPanel.vue` (`defaultWeekday`, `newDateOverride`) | component | event-driven | `newTimeOverride`/`newTime` lines 68-76 | exact |
| `src/views/ServiceEditorView.vue` (`onDateChange`, marker clear, `onSave` date, prop) | component | event-driven | `onRehearsalDateChange` 2780-2787, `onSave` 4760-4831 | exact |
| tests (`rehearsalTimes.test.ts`, `services.rehearsalDefaults.test.ts`, `services.rehearsalProjection.test.ts`, `rehearseAccess.test.ts`, `SettingsView.test.ts`, `ServiceTimesPanel.test.ts`, `ServiceEditorView.timesSection.test.ts`) | test | n/a | the existing files themselves | exact |
| `src/__tests__/defaultRehearsalAdr.test.ts` + ADR-0249 | test/doc | n/a | other doc-guard tests in `src/__tests__/` (e.g. `brandName.test.ts`) | role-match |

## Pattern Assignments

### `src/stores/services.ts`: retire the old `serviceShares` doc on date change (service, CRUD, soft-fail)

CONTEXT overrides RESEARCH here: the old `serviceShares/{slug}__service-{oldDate}` doc is removed, not accepted as a stale residual.

**Analog:** `deleteService` step 3, `src/stores/services.ts:923-941`. Copy it nearly verbatim, with `service.date` replaced by the OLD date:

```typescript
if (service) {
  try {
    const orgSnap = await getDoc(doc(db, 'organizations', orgId.value))
    const slug = orgSnap.exists() ? (orgSnap.data().slug as string | undefined) : undefined
    if (slug) {
      const shareRef = doc(db, 'serviceShares', `${slug}__service-${service.date}`)
      const shareSnap = await getDoc(shareRef)
      // See ADR-0163 (...)
      if (shareSnap.exists() && shareSnap.data().serviceId === id) {
        await deleteDoc(shareRef)
      }
    }
  } catch (err) {
    console.error(`deleteService: failed to revoke serviceShares for service ${id} — continuing`, err)
  }
}
```

Key traits to keep: existence guard before delete (a delete on a missing doc is DENIED, not a no-op); the `serviceId === id` ownership check (ADR-0163, the doc is keyed only by slug+date and may belong to another service); `try/catch` with `console.error(... — continuing)`; never rethrown.

**How the slug is obtained (two existing precedents):**
1. `deleteService` (above): re-reads `organizations/{orgId}` with `getDoc` and takes `orgSnap.data().slug as string | undefined`; skips if absent.
2. `writeSharePayload` (`services.ts:1141-1152`) reads the same doc, and if no slug yet derives and claims one (`deriveSlug`, `claimSlug`, `updateDoc(orgRef, { slug })`). `maybeRefreshShareLink` (`:1268-1315`) does NOT read the slug itself: it only resolves the token (`shareLinkCache` or `serviceShareLinks/{id}`), merges `overrides` over the local service (`{ ...localService, ...overrides }`, line 1298), then calls `writeSharePayload`. So the slug comes from `writeSharePayload`'s own org read. For the removal, use the `deleteService` read-only form (no claim), because an org with no slug has no memorable doc to retire.

**Where the old date comes from:** `maybeRefreshShareLink` shows the pre-write state is still in `services.value` while `updateService` runs (comment at 1291-1297). In `updateService` (`:626-644`), read `services.value.find(s => s.id === id)?.date` BEFORE the `updateDoc`, with one direct read on a cache miss for a write carrying `date` (Plan 03 has the detail), compare with `data.date`, and after the `updateDoc` plus `maybeRefreshShareLink` call a new soft-failing helper (e.g. `retireOldServiceShare(id, oldDate)`) only when `typeof data.date === 'string' && oldDate && data.date !== oldDate`. Do the removal after the new doc is written so the link never has a gap. Soft-fail: wrapped in its own try/catch, so a failure never fails the save.

**updateService shape to extend** (`:626-644`):
```typescript
async function updateService(id: string, data: Record<string, unknown>) {
  if (!orgId.value) return
  assertWritable(id, data)
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  })
  await maybeRefreshShareLink(id, data as Partial<Service>)
}
```
The regular token link is untouched: `maybeRefreshShareLink` rewrites `shareTokens/{token}` with the merged (new) date.

**Test analog:** the `deleteService` serviceShares tests and the `getDoc` queued-in-call-order note at `src/stores/__tests__/services.test.ts:1733`. Responses are queued in call order, so a new removal adds getDoc calls after the refresh's own reads.

---

### `src/stores/services.ts` `createService` (auto-add)

**Analog:** itself, lines 474-489. Current:
```typescript
// R442 — report time is copied once at creation; rehearsals start empty ... See ADR-0245 (...)
const rehearsals: { id: string; date: string; time: string }[] = []
const reportTime = authStore.settings.reportTimeDefault
const ref = await addDoc(collection(db, 'organizations', orgId.value, 'services'), {
  ...data, progression: '1-2-2-3', slots, status: 'draft', notes: '', sermonPassage: null,
  sermonTopic: '', rehearsals, reportTime, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
})
```
Replace the empty array with `buildAutoRehearsal(data.date, authStore.settings.rehearsalDefaultWeekday, authStore.settings.rehearsalTimeDefaults[0])` (returns `StoredRehearsal | null`), pushing the row (with `id: crypto.randomUUID()`, `autoAdded: true`) when non-null. The same `rehearsals` array is reused for the `created` object passed to `ensureShareLink` (lines 498-511), which is why `buildServiceSnapshot` must narrow. The share-link block is already soft-fail (`try/catch` with `console.error('createService: ... (non-blocking)')`); do not change it. Update the ADR-0245 pointer comment to add ADR-0249 (single-line comment).

### `src/stores/services.ts` `buildServiceSnapshot` and `src/utils/rehearseAccess.ts` (narrow)

**Analog:** `services.ts:201-205`:
```typescript
const datedRehearsals = (service.rehearsals ?? []).filter(isDisplayableRehearsal)
return {
  date: service.date,
  ...(datedRehearsals.length > 0 ? { rehearsals: sortRehearsals(datedRehearsals) } : {}),
```
Change to `sortRehearsals(datedRehearsals).map(toPublicRehearsal)` in both files (`rehearseAccess.ts:281`; import at `rehearseAccess.ts:14`, `services.ts:34`: `import { isDisplayableRehearsal, sortRehearsals } from '@/utils/rehearsalTimes'` gains `toPublicRehearsal`). Payload tests go in `services.rehearsalProjection.test.ts` and `rehearseAccess.test.ts`; assert on actual `setDoc` payloads (JSON.stringify must not contain `autoAdded`).

### `src/utils/rehearsalTimes.ts` (utility, transform)

**Analog:** the file itself. Keep it dependency-free (comment lines 1-6). Follow the existing style: exported pure functions with JSDoc, `YMD_RE`/`HM_RE` reused (lines 17-18). Add `StoredRehearsal extends Rehearsal { autoAdded?: true }`, `toPublicRehearsal`, `normalizeWeekday`, `weekdayOfYmd`, `mostRecentWeekdayOnOrBefore`, `buildAutoRehearsal`, `moveAutoRehearsals` using the RESEARCH Pattern 1-3 code (UTC arithmetic via `setUTCFullYear`, never `formatRehearsalDateShort`-style local `new Date(y, m-1, d)`, which is display-only, lines 52-59).

### `src/types/organization.ts`

**Analog:** lines 102-106 (interface) and 185 (`rehearsalTimeDefaults: []` in `DEFAULT_ORG_SETTINGS`).
```typescript
rehearsalTimeDefaults: string[]
/** Org-level default day-of report time (R429), `'HH:mm'`, `''` = unset. */
reportTimeDefault: string
```
Add `rehearsalDefaultWeekday: number | null` after them and `rehearsalDefaultWeekday: null` in the defaults. Fix the doc comment at 102-103 ("never copied into a service"), now false.

### `src/views/SettingsView.vue` (component, request-response)

**Analog:** `onSaveRehearsalDefaults`, `:1344-1376`. Extend in place:
```typescript
const previousRehearsalDefaults = [...authStore.settings.rehearsalTimeDefaults]
const previousReportTimeDefault = authStore.settings.reportTimeDefault
...
await authStore.updateOrgSettings({
  'settings.rehearsalTimeDefaults': newRehearsalDefaults,
  'settings.reportTimeDefault': newReportTimeDefault,
})
...
} catch (err) {
  console.error('[SettingsView] save rehearsalTimeDefaults/reportTimeDefault error:', err)
  rehearsalDefaultsSaveError.value = 'Failed to save. Please try again.'
  rehearsalTimeDefaultsInput.value = previousRehearsalDefaults
  reportTimeDefaultInput.value = previousReportTimeDefault
}
```
Add `rehearsalDefaultWeekdayInput = ref<number | null>(normalizeWeekday(authStore.settings.rehearsalDefaultWeekday))` next to the seeds at `:728-732`, a `'settings.rehearsalDefaultWeekday'` key in the update, and a rollback line. Template: card at ~`:554-603`; `<option :value="null">` and `:value="0"`.. so `v-model` keeps real values (Sunday = 0 must not be coerced; no `||`). Add a `watch(() => authStore.settings.rehearsalDefaultWeekday, ...)` like the existing `timezone` watcher. Existing `SettingsView.test.ts:365-367` (help text) and `:375` (WR-02 exact `toHaveBeenCalledWith`) change on purpose; mock `settings` needs a `rehearsalDefaultWeekday` getter/setter.

### `src/components/ServiceTimesPanel.vue` (component, event-driven)

**Analog:** `:68-92`.
```typescript
const newDate = ref('')
const newTimeOverride = ref<string | null>(null)
const newTime = computed<string>({
  get: () => newTimeOverride.value ?? props.defaultTimes[0] ?? '',
  set: (v) => { newTimeOverride.value = v },
})
...
function onSubmitAdd(): void {
  if (!canAdd.value) return
  emit('add', { date: newDate.value, time: newTime.value })
  newDate.value = ''
  newTimeOverride.value = null
```
Mirror for the date (RESEARCH Pattern 4): `newDateOverride`, `defaultDate` computed (blank if a row already on that date), writable `newDate` computed; in submit set `newDateOverride.value = null`. `canAdd` (line 79) reads `newDate.value` unchanged. Add `defaultWeekday?: number | null` to props (`:16-24`, default `null` in `withDefaults`). Props pass-through in the editor at `ServiceEditorView.vue:1756` (`:default-times="authStore.settings.rehearsalTimeDefaults ?? []"`).

### `src/views/ServiceEditorView.vue` (component, event-driven)

**`onDateChange`** (`:2749-2758`), keep the `canEditService` gate first, add `YMD_RE` guard, then one synchronous mutation:
```typescript
if (!canEditService.value) return
if (!localService.value || !newDate) return
localService.value.date = newDate
```
becomes: also `if (!YMD_RE.test(newDate)) return`, `localService.value.rehearsals = moveAutoRehearsals(localService.value.rehearsals ?? [], newDate)`.

**Marker clear** in `onRehearsalDateChange`/`onRehearsalTimeChange` (`:2780-2795`): `delete rehearsal.autoAdded` only AFTER the early-return guards pass (a rejected edit must not clear it), never `= false`.
```typescript
if (newDate === '' ? rehearsal.date !== '' : !YMD_RE.test(newDate)) return
rehearsal.date = newDate   // <- delete rehearsal.autoAdded after this
```
`onAddRehearsal` (`:2766`) pushes `{id, date, time}` with no flag; leave it.

**`onSave` date fix** (`:4760-4831`): add `date: data.date` to `payload` and `date: localService.value.date` to the mirror `JSON.stringify` object at the SAME key position (JSON.stringify is order-sensitive; ADR-0235). Insert both immediately after `name`, e.g.:
```typescript
const payload = { name: data.name, date: data.date, teams: data.teams, ... }
...
JSON.stringify({ name: localService.value.name, date: localService.value.date, teams: ..., })
```
Otherwise `isDirty` (`:2803-2806`) never clears and autosave loops. Existing rehearsals line already survives (`rehearsals: data.rehearsals ?? []`, `:4791`, mirror `:4826`).

## Shared Patterns

### Soft-failing share-side writes
**Source:** `services.ts:923-941` (deleteService), `:498-514` (createService), `:1141-1174` (writeSharePayload memorable-URL block), `:1303-1315` (maybeRefreshShareLink catch).
**Apply to:** the old-`serviceShares` removal. Wrap in its own try/catch, `console.error('...— continuing' , err)`, never throw; the user's own save already succeeded.

### Existence-guarded delete
**Source:** `services.ts:899-902, 913-918, 931-935`. A delete on a nonexistent doc is DENIED by rules; always `getDoc().exists()` first, and check `serviceId === id` for slug+date-keyed docs.

### Editor handler gate
**Source:** `ServiceEditorView.vue:2755, 2767, 2775, 2781` (`if (!canEditService.value) return` first, R036).
**Apply to:** `onDateChange` and any new handler.

### Org settings write
**Source:** `SettingsView.vue:1358` via `authStore.updateOrgSettings({'settings.x': v})`, rolled back in the catch. `applyOrgSnapshot` spreads `DEFAULT_ORG_SETTINGS`, so an old org reads `null`. Use `normalizeWeekday`, never truthiness.

### Timezone-free test proof
**Source:** RESEARCH `inZone` helper (in-process `process.env.TZ` plus `getTimezoneOffset()` canary; shell `TZ=` prefix is silently ignored on this machine). Zones: Pacific/Pago_Pago (660), UTC (0), Pacific/Kiritimati (-840).

### Spec citation
Criterion ID goes in the test title, e.g. `it('adds it on the prior Wednesday (AC-RHD-17)')`; comments do not count. Source comments are pointers only (`// See ADR-0249 (docs/adr/0249-....md)`), per CLAUDE.md comment convention.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| Retire-old-date share doc inside `updateService` | service | No existing code removes a `serviceShares` doc on update, only on delete; compose from `deleteService` step 3 plus pre-write state read as in `maybeRefreshShareLink` |
| `docs/adr/0249-*.md`, `docs/specs/default-rehearsal.md` | docs | Follow `docs/adr/0245-rehearsals-are-always-dated-defaults-prefill-the-add-form.md` and `docs/specs/TEMPLATE.md`; filename for 0249 chosen by the planner; add criteria for AC date-saved and AC old page removed (CONTEXT) |

## Metadata

**Analog search scope:** `src/stores`, `src/utils`, `src/views`, `src/components`, `src/types`
**Files read:** CONTEXT, RESEARCH (lines 1-512 of 696; the remainder is validation and open questions), and the code ranges above
**Pattern extraction date:** 2026-11-06
