# 0153. DeleteField() is the only way to actually remove a field. If the

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/stores/slideGroups.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

`deleteField()` is the only way to actually remove a field. If the group has not materialized yet, creates a skeleton document (`slotId`, `serviceId`, `slides: []`, the supplied bed field, both server timestamps) so atta...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/stores/slideGroups.ts:155-169`:**

```
   * `deleteField()` is the only way to actually remove a field.
   *
   * If the group has not materialized yet, creates a skeleton document
   * (`slotId`, `serviceId`, `slides: []`, the supplied bed field, both server
   * timestamps) so attaching media to a slot with no group yet cannot throw.
   *
   * WR-01: this skeleton create races `materializeGroupIfMissing` — both
   * functions independently `getDoc` the same not-yet-existing doc and, on
   * absence, `setDoc`. If a user attaches bed media in the same round-trip
   * window as first materialization, whichever write lands last would win
   * outright under a plain (non-merge) `setDoc`, and since this skeleton's
   * payload always carries `slides: []`, landing after materialization's
   * fully-populated write would silently reset the group's real derived
   * `slides` back to empty. `{ merge: true }` makes this create idempotent
   * against that race: a concurrently-landing `materializeGroupIfMissing`
```

**`src/stores/slideGroups.ts:214-227`:**

```
   * `setGroupBedMedia` above exactly rather than extending its patch type: the
   * same existence check, the same single-field `updateDoc` on the existing
   * branch, the same explicit `clearBackground` flag (an undefined url would
   * be stripped by `stripUndefined()` before the intent reached Firestore —
   * `deleteField()` is the only way to actually remove the field), and the
   * same merging skeleton `setDoc` on the missing branch for the identical
   * WR-01 race reason documented on `setGroupBedMedia`.
   *
   * Touches only `backgroundImageUrl` and `updatedAt` on the existing-doc
   * branch — never `slides`, never `bedAudioUrl`. Setting a group's
   * background must never overwrite or clear any slide's own background (the
   * R055 adjacency truth) — this function reads and writes nothing about
   * `slides` at all.
   */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/slideGroups.ts:155-169`
- `src/stores/slideGroups.ts:214-227`
