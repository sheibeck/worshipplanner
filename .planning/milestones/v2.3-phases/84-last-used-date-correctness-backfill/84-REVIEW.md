---
phase: 84-last-used-date-correctness-backfill
reviewed: 2026-08-26T03:24:05Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - functions/src/backfillLastUsed.ts
  - functions/src/backfillLastUsed.test.ts
  - src/stores/services.ts
  - src/stores/__tests__/services.test.ts
  - src/utils/lastUsed.ts
  - src/utils/__tests__/lastUsed.test.ts
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: fixed
fix_report: 84-REVIEW-FIX.md
fixed_at: 2026-08-26T00:00:00Z
---

> **Fix status (2026-08-26): all 5 findings fixed.** CR-01/CR-02/WR-01/WR-02/WR-03
> were each addressed and committed atomically; see `84-REVIEW-FIX.md` for the
> per-finding summary, commit hashes, and final gate results
> (`npm run type-check`, `npx vitest run`, `cd functions && npx vitest run`).

# Phase 84: Code Review Report

**Reviewed:** 2026-08-26T03:24:05Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The pure derivation helper (`src/utils/lastUsed.ts`), its Admin-SDK mirror
(`functions/src/backfillLastUsed.ts`), and the unit tests for both are correct and
well-covered: lock-gated `MAX(service.date)`, string-lexical date comparison, the
draft-never-contributes rule, the never-blank-a-no-service-song rule, dry-run
default/`--apply` gating, single-org scope, idempotency via `Timestamp.isEqual`, and
mirrored-copy parity are all implemented as specified and exercised by tests.

`src/stores/services.ts`'s own unit tests (`markAsPlanned`/`reopenService` recompute,
draft-assignment no-stamp) also pass in isolation. **However, tracing the only real
production caller of `markAsPlanned` (`src/views/ServiceEditorView.vue`, not itself
touched by this phase) shows the fix does not actually take effect for a user pressing
"Mark as Planned": a pre-existing sibling write path re-stamps `lastUsedAt` with
`serverTimestamp()` immediately after the correct recompute lands, silently reproducing
the exact bug this phase exists to fix.** This was missed because the store-level tests
mock `serviceStore.markAsPlanned` when testing `ServiceEditorView.vue`, and the
`ServiceEditorView.vue` tests never construct a real `services.ts` store, so the
interaction between the two write paths was never exercised end-to-end. This is the
review's most severe finding (CR-01) and should block sign-off until resolved — the
in-scope work is otherwise solid, but ships a fix that does not reach production
through its primary trigger.

A second correctness issue (CR-02) is internal to the reviewed diff: the new
`lastUsedAt` recompute inside `markAsPlanned`/`reopenService` is not soft-failed, unlike
every other secondary side effect in this same file (share-link refresh, lock-notify,
export bookkeeping), so a transient failure in the recompute step (after the critical
status write has already succeeded) makes the entire lock/unlock transition appear to
have failed to the caller — reproducing the "it didn't save" defect class this
codebase's own `ServiceLockedError` doc comment explicitly calls out as the thing to
avoid.

## Critical Issues

### CR-01: The live UI's only `markAsPlanned` call site re-stamps `lastUsedAt` with wall-clock time immediately after the correct recompute, defeating R247 in production

**File:** `src/views/ServiceEditorView.vue:3054-3065` and `:3088-3111` (not part of this
phase's diff, but is the sole caller of the reviewed `src/stores/services.ts:424`
`markAsPlanned`, and directly undoes its effect)

**Issue:** `src/stores/services.ts`'s `markAsPlanned` (this phase's fix) correctly writes
each scheduled song's `lastUsedAt` to `Timestamp.fromMillis(serviceDateToMillis(maxDate))`
— the locked service's calendar date. `ServiceEditorView.vue::onMarkAsPlanned` (the only
place `markAsPlanned` is called from application code — confirmed via
`grep -rn "markAsPlanned("` across `src/`) does this:

```ts
// services.ts — CORRECT (this phase)
await serviceStore.markAsPlanned(localService.value.id)
applyTransitionLocally('planned')
...
try {
  await bumpScheduledSongsLastUsed()   // <-- runs immediately after, unconditionally
} catch (bumpErr) {
  console.error('[ServiceEditorView] lastUsedAt bump failed after a successful transition:', bumpErr)
}
```

and `bumpScheduledSongsLastUsed` (`ServiceEditorView.vue:3054-3065`, pre-existing, not
removed by this phase) is:

```ts
async function bumpScheduledSongsLastUsed(): Promise<void> {
  const svc = localService.value
  if (!svc) return
  const scheduledSongIds = new Set(
    svc.slots.filter((s) => s.kind === 'SONG' && (s as SongSlot).songId).map((s) => (s as SongSlot).songId!),
  )
  await Promise.all(
    [...scheduledSongIds].map((songId) =>
      songStore.updateSong(songId, { lastUsedAt: serverTimestamp() as never }),
    ),
  )
}
```

This is the exact `serverTimestamp()`-on-lock write that 84-CONTEXT.md identifies as
"the root cause" ("A service planned ~2 weeks ahead therefore stamps the add date...
never the service date"). It runs a few lines after the new correct write and
unconditionally overwrites it with `now()` for every song in the service, on every
single "Mark as Planned" click. `ServiceEditorView.vue`'s own tests confirm this is
still live and expected behavior today:
`src/views/__tests__/ServiceEditorView.test.ts:7571` — `'bumps the SONG documents
directly and never re-writes the service slots array'` — asserts
`mockUpdateSong` is called with `lastUsedAt: expect.anything()` straight off
`onMarkAsPlanned()`, with `serviceStore.markAsPlanned` fully mocked out (so the real
recompute never runs in that test and the conflict is invisible there).

Net effect in production: pressing "Mark as Planned" on a service dated weeks in the
future still stamps every scheduled song's `lastUsedAt` with **today's date**, not the
service date — the reported "His Mercy Is More" bug reproduces unchanged through the
one UI action users actually take. The backfill (R248) and the pure helper (R247 logic)
are correct in isolation, but the live fix (R247's "going forward" half) never reaches
users through this path. Neither `84-01-PLAN.md` nor `84-01-SUMMARY.md` mentions
`bumpScheduledSongsLastUsed` or `ServiceEditorView.vue`, indicating this conflicting
write path was not identified during implementation, not a deliberate scope
exclusion.

**Fix:** Delete `bumpScheduledSongsLastUsed()` and its call site in `onMarkAsPlanned`
(`ServiceEditorView.vue:3054-3065`, `:3091-3114`) now that `services.ts::markAsPlanned`
performs the correct recompute itself. If any behavior it uniquely provided (e.g.
firing on songs added via a path other than `assignSongToSlot`) is still needed,
replace the body with a call into `serviceStore`'s already-correct recompute rather than
a raw `serverTimestamp()` stamp — but do not leave both writes racing against each
other.

```ts
// ServiceEditorView.vue — remove entirely, or delegate instead of re-stamping:
// async function bumpScheduledSongsLastUsed(): Promise<void> { ... }
// and its call in onMarkAsPlanned:
// try {
//   await bumpScheduledSongsLastUsed()
// } catch (bumpErr) { ... }
```

---

### CR-02: `markAsPlanned`/`reopenService`'s new `lastUsedAt` recompute is not soft-failed, so a transient recompute failure reports the whole lock/unlock transition as failed even though the status write already succeeded

**File:** `src/stores/services.ts:424-445` (`markAsPlanned`), `:458-479`
(`reopenService`), `:345-355` (`recomputeLastUsedFor`)

**Issue:** Both functions perform the critical, must-succeed write first
(`updateDoc(... status: 'planned'|'draft' ...)`), then call
`recomputeLastUsedFor(songIds, ...)` with no `try/catch`:

```ts
await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
  status: 'planned',
  updatedAt: serverTimestamp(),
})
const service = services.value.find((s) => s.id === id)
if (service) {
  const songIds = songIdsInService(service)
  if (songIds.length > 0) {
    await recomputeLastUsedFor(songIds, buildLastUsedSnapshot(id, 'planned'))  // unguarded
  }
}
```

`recomputeLastUsedFor` itself has no `try/catch` either — a single failing
`songStore.updateSong` call (permission edge case, transient network error, quota) makes
`markAsPlanned`/`reopenService` reject as a whole, even though the service's status has
already been durably written to Firestore. The sole caller,
`ServiceEditorView.vue::onMarkAsPlanned`/`runReopen`, treats any rejection from these
calls as a total failure: it does **not** call `applyTransitionLocally`, and shows
`"Couldn't mark this service as Planned. Check your connection and try again."` — even
though the service is now genuinely `planned` (or `draft`) server-side. This is exactly
the "it didn't save" defect class this file's own `ServiceLockedError` doc comment
(`services.ts:48-65`) names as the thing being guarded against, and it is the opposite
of how every other secondary effect in this same file is handled: `writeSharePayload`'s
memorable-URL write, `maybeRefreshShareLink`, and (in `ServiceEditorView.vue`) the
lock-notify/`lockSnapshots` side effects and `bumpScheduledSongsLastUsed` are all
deliberately wrapped in their own soft-fail `try/catch` for precisely this reason. The
new R247 recompute breaks that established pattern.

**Fix:** Wrap the recompute in its own `try/catch` inside `markAsPlanned`/
`reopenService` (or inside `recomputeLastUsedFor` itself), logging and swallowing a
failure instead of letting it propagate — mirroring `writeSharePayload`'s/
`maybeRefreshShareLink`'s pattern in this same file:

```ts
const service = services.value.find((s) => s.id === id)
if (service) {
  const songIds = songIdsInService(service)
  if (songIds.length > 0) {
    try {
      await recomputeLastUsedFor(songIds, buildLastUsedSnapshot(id, 'planned'))
    } catch (err) {
      console.error(`markAsPlanned: lastUsedAt recompute failed for service ${id} — the status transition already succeeded`, err)
    }
  }
}
```

## Warnings

### WR-01: `songIdsInService`'s doc comment claims deduplication it doesn't perform

**File:** `src/stores/services.ts:357-362`

**Issue:** The comment reads "SONG-slot songIds present in a service, **deduped**
source for both lock/unlock hooks," but the implementation is a plain
`filter`+`map` with no `Set`/dedup step:

```ts
function songIdsInService(service: Service): string[] {
  return service.slots
    .filter((slot): slot is SongSlot => slot.kind === 'SONG' && !!slot.songId)
    .map((slot) => slot.songId as string)
}
```

Nothing in `Service`/`SongSlot` prevents the same song being placed in two different
SONG slots within one service (e.g. a repeated chorus). When that happens,
`recomputeLastUsedFor` calls `songStore.updateSong(songId, ...)` twice for the same
song with the same value on a single `markAsPlanned`/`reopenService` call — harmless
to the result, but a misleading comment and a redundant Firestore write per duplicate.

**Fix:** Either dedupe (`[...new Set(...)]`) to match the doc comment, or correct the
comment to say "not deduplicated — callers tolerate a repeated songId."

```ts
function songIdsInService(service: Service): string[] {
  const ids = service.slots
    .filter((slot): slot is SongSlot => slot.kind === 'SONG' && !!slot.songId)
    .map((slot) => slot.songId as string)
  return [...new Set(ids)]
}
```

### WR-02: Backfill silently derives a `NaN`-producing date from a service doc missing `date`, relying on the catch-all `try/catch` rather than an explicit guard

**File:** `functions/src/backfillLastUsed.ts:150-157`, `:166-177`

**Issue:**

```ts
const serviceInputs: LastUsedServiceInput[] = servicesSnap.docs.map((doc) => {
  const data = doc.data() as ServiceDocData;
  return {
    status: data.status ?? "draft",
    date: data.date ?? "",          // <-- malformed/legacy doc with no `date` becomes ""
    songIds: songIdsFromSlots(data.slots),
  };
});
```

If a locked service document is missing `date` (legacy/malformed data) and it is the
*only* locked service containing a given song, `computeLastUsedDate` returns `""` (a
non-null string, so the `maxDate === null` skip does not fire). `serviceDateToMillis("")`
then evaluates `new Date("T00:00:00").getTime()` → `NaN`, and
`Timestamp.fromMillis(NaN)` is attempted. This is only "safe" because it happens to sit
inside the per-song `try/catch` (line 165), so it gets recorded in `summary.failed`
rather than corrupting data — but that's incidental, not a designed guard, and nothing
distinguishes "this song's document is unreadable" from "this org has a service with no
date," which is a materially different, worth-investigating condition for a
production-data script that a human is meant to review before `--apply`.

**Fix:** Explicitly filter out/flag services with a missing or non-`YYYY-MM-DD` `date`
before folding them into `serviceInputs`, and surface it distinctly in the summary
(e.g. a `malformedServices: string[]` field) rather than letting it fall through to a
per-song `NaN` Timestamp failure:

```ts
const serviceInputs: LastUsedServiceInput[] = servicesSnap.docs
  .map((doc) => {
    const data = doc.data() as ServiceDocData;
    return { id: doc.id, status: data.status ?? "draft", date: data.date, songIds: songIdsFromSlots(data.slots) };
  })
  .filter((s) => {
    if (!s.date || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
      console.warn(`[backfillLastUsed] service ${s.id}: missing/malformed date "${s.date}" — excluded from MAX computation`);
      return false;
    }
    return true;
  });
```

### WR-03: `serviceDateToMillis` resolves local-midnight against the executing process's ambient timezone, which can differ between the browser (client recompute) and the Admin-SDK script's host machine (backfill)

**File:** `src/utils/lastUsed.ts:64-66`, mirrored in
`functions/src/backfillLastUsed.ts:85-87`

**Issue:** `new Date(\`${date}T00:00:00\`).getTime()` resolves "local midnight" using
whatever timezone the running process defaults to. On the client this is the end
user's browser timezone; in the backfill script (an Admin-SDK Node process explicitly
documented as "run by the owner with admin credentials," not a deployed Cloud
Function) it is the host machine's `TZ`/OS default. This parse convention is
consistent with existing usage elsewhere in this codebase (`QuarterView.vue`,
`ServicesView.vue`, `MessageComposer.vue`, etc. all use the identical
`` `${date}T00:00:00` `` idiom), so it is not a new pattern — but it is being extended
here to a script whose execution environment is not guaranteed to share a timezone
with the browsers that read the resulting `Timestamp` back. If the backfill (or any
future re-run of it) is ever executed from a machine/container with a different
default timezone than the org's local time (a CI runner, a cloud shell, a Docker
container — all commonly default to UTC), the computed `Timestamp` for the same
calendar date string will silently differ by one day from what the client would have
written for the identical service, and `existing.isEqual(next)` will never converge —
the idempotency check quietly "corrects" an already-correct song's `lastUsedAt`
forever, off by a fixed offset, with no error raised.

**Fix:** Make the calendar-date-to-Timestamp conversion timezone-explicit rather than
ambient-dependent, e.g. parse as UTC midnight consistently on both sides (`` new
Date(`${date}T00:00:00Z`) ``) if the display layer is updated to match, or at minimum
add a startup assertion/log in `runBackfillCli` printing the resolved `TZ` so a future
run from an unexpected environment is caught during the mandatory dry-run review
rather than silently shipping a systematically shifted date.

---

_Reviewed: 2026-08-26T03:24:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
