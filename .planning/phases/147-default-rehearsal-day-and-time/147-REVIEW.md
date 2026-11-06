---
phase: 147-default-rehearsal-day-and-time
reviewed: 2026-11-06T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - docs/adr/0245-rehearsals-are-always-dated-defaults-prefill-the-add-form.md
  - docs/adr/0249-new-services-start-with-a-default-rehearsal.md
  - docs/specs/default-rehearsal.md
  - src/__tests__/defaultRehearsalAdr.test.ts
  - src/components/ServiceTimesPanel.vue
  - src/components/__tests__/ServiceCard.test.ts
  - src/components/__tests__/ServiceTimesPanel.test.ts
  - src/stores/__tests__/auth.test.ts
  - src/stores/__tests__/services.publicDocs.test.ts
  - src/stores/__tests__/services.rehearsalDefaults.test.ts
  - src/stores/__tests__/services.rehearsalProjection.test.ts
  - src/stores/services.ts
  - src/types/organization.ts
  - src/types/service.ts
  - src/utils/__tests__/inZone.ts
  - src/utils/__tests__/rehearsalTimes.test.ts
  - src/utils/rehearsalTimes.ts
  - src/utils/rehearseAccess.ts
  - src/views/ServiceEditorView.vue
  - src/views/SettingsView.vue
  - src/views/__tests__/DashboardView.rehearsalTimes.test.ts
  - src/views/__tests__/ServiceEditorView.timesSection.test.ts
  - src/views/__tests__/SettingsView.test.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 147: Code Review Report

**Reviewed:** 2026-11-06
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed `git diff 9c0756c5..HEAD` for each file plus the surrounding code. The three probes that carry the most risk came back clean, traced with concrete inputs:

- **Public-page removal:**
  - It cannot delete a page that records another service. The `serviceId === id` guard is applied to both the new and the old page.
  - It cannot run before the new page is written. The new page is re-read and must record this service, so a soft-failed `setDoc` leaves the old page in place.
  - A save with no `date`, or the same date, reads no page.
  - The cold-cache read is wrapped in a try/catch and returns `undefined` on failure.
- **Marker leak:** `toPublicRehearsal` narrows rows in both `buildServiceSnapshot` and `buildRehearseAccess`. No other source file projects `rehearsals`, and `functions/src` never mentions it.
- **Date maths and Sunday:**
  - The maths is UTC-only, with `setUTCFullYear` handling years below 100 and a round-trip check rejecting 2026-02-30 and 2027-02-29.
  - Year ends and leap days are correct.
  - `0` is never tested by truthiness. `normalizeWeekday`, `mostRecentWeekdayOnOrBefore`, `weekdayOfYmd`, `moveAutoRehearsals` and the Settings select all use `=== null`, `??` or integer checks.
- **`isDirty` stranding:** `date` sits at the same key position in `payload` and in the mirror comparison.

I ran `rehearsalTimes.test.ts`, `services.publicDocs.test.ts` and `services.rehearsalDefaults.test.ts`: 79 passed. The `publicDocs` tests exercise a real in-memory document store, with ordering, ownership and failure-injection cases, and I found them meaningful.

Three real findings remain, all WARNING.

## Warnings

### WR-01: The in-place church switch reseeds only the weekday, so "Save defaults" writes the old church's times into the new church

**File:** `src/views/SettingsView.vue:810-819` (new watch), `:747` and `:751` (not reseeded), `:1385-1390` (save)

**Issue:**
- `<RouterView v-else />` in `src/App.vue:16` has no `:key`, so an in-place sidebar church switch keeps `SettingsView` mounted. `loadOrgSlug` and the `aiEnabled`/`vwMode` watches exist for exactly this reason.
- This phase added a reseed watch for `rehearsalDefaultWeekday` only. `rehearsalTimeDefaultsInput` and `reportTimeDefaultInput` are seeded once at setup and never re-seeded.
- Concrete input: an editor of churches A and B opens Settings on A, switches to B in the sidebar, and sees B's day beside A's times. Pressing "Save defaults" sends `settings.rehearsalTimeDefaults` and `settings.reportTimeDefault` with A's values, plus B's weekday, to B's org doc. B's default times and report time are silently overwritten.
- The stale times and report time pre-date this phase. The new reseed makes the card look correct for the one field it updates, and AC-RHD-67 and its test assert the card is right after a switch.
- `rehearsalTimeDefaultsInput` also drives which time `createService` copies onto every new service of B.

**Fix:** reseed all three inputs on the same trigger, and key it on `authStore.orgId` rather than the weekday value. A switch between two churches with the same weekday never fires the current watch.

```ts
watch(
  () => authStore.orgId,
  () => {
    rehearsalDefaultWeekdayInput.value = normalizeWeekday(authStore.settings.rehearsalDefaultWeekday)
    rehearsalTimeDefaultsInput.value = [...authStore.settings.rehearsalTimeDefaults]
    reportTimeDefaultInput.value = authStore.settings.reportTimeDefault
  },
)
```

Add a test in the AC-RHD-67 block that switches the church and asserts the times and report time also change.

### WR-02: Every autosave now sends `date` and the whole `rehearsals` array, so a stale second tab reverts a date change and the moved rehearsal

**File:** `src/views/ServiceEditorView.vue:4771` (`date: data.date` in the payload), `:3033-3052` (remote-merge guard)

**Issue:**
- Before this phase an autosave could not touch the date. Now every save carries `localService.date`.
- The remote-merge watcher ignores snapshots while the autosave status is `pending`, `saving` or `error` with a dirty document.
- Concrete input: Tab A moves the service X to Y, and the rehearsal moves with it. Tab B was idle on X and the planner types a note in B. If A's snapshot lands during B's 800 ms debounce, or while B is in the `error` state after going offline, B's save writes `date: X` and the old rehearsal rows back over A's change.
- `updateService` then writes X's page and retires Y's page, so the data stays internally consistent and the loss is silent.
- The `rehearsals` half of this exists today. The date makes it more visible, because the page for a link already sent now flips back.
- This sits near the owner's "second tab" probe. It is the existing whole-document-write design, not a new mechanism, so it is a WARNING rather than a blocker.

**Fix:** if closing it is wanted, send `date` only when it differs from `originalService.value.date`, so a tab that never changed the date can't revert another tab's change.

```ts
...(data.date !== originalService.value?.date ? { date: data.date } : {}),
```

The mirror comparison needs the same conditional so `isDirty` still clears. Otherwise, record the residual in ADR-0249's Consequences.

### WR-03: The AC-RHD-10 test is tautological

**File:** `src/stores/__tests__/services.rehearsalDefaults.test.ts:241-253`

**Issue:**
- The test calls `create(...)`, captures the object that was handed to `addDoc` as `payload`, and deep-copies its `rehearsals` into `before`.
- It then changes `mockAuthState.settings` and asserts `payload.rehearsals` equals `before`.
- `payload` is a plain object the store has already finished with. No code path connects a later settings change to it, so the assertion cannot fail whatever the implementation does. It would pass if `createService` re-read settings, and it would pass if a settings save looped over services.
- AC-RHD-10 ("Changing the default day leaves a service created earlier with the rehearsals it already has") therefore has a citing test that proves nothing.
- AC-RHD-09 has a milder version. `mockUpdateDoc` not being called proves nothing about services, because the view never imports that path.

**Fix:** make the test exercise something that could regress.
- Create a service, then run the Settings save through the real `authStore.updateOrgSettings` against the mocked Firestore, and assert that every `updateDoc` or `setDoc` call targets `organizations/{orgId}` and none targets a `services/` path.
- Alternatively, assert that `createService` reads `rehearsalDefaultWeekday` only inside the call, for example by changing the default and calling `updateService` on the cached service and asserting that `rehearsals` is absent from the write.

## Info

### IN-01: `buildAutoRehearsal` accepts any `HH:mm`-shaped time, such as `99:99`

**File:** `src/utils/rehearsalTimes.ts:136`

**Issue:** `HM_RE` is `^\d{2}:\d{2}$`, so a stored default time of `'99:99'` produces an auto-added row that `formatWallClockTime` then renders oddly. `<input type="time">` cannot produce that value, so reaching it takes a hand-edited org doc. This is cosmetic.

**Fix:** none needed. If hardened, add a range check: `/^([01]\d|2[0-3]):[0-5]\d$/`.

---

_Reviewed: 2026-11-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
