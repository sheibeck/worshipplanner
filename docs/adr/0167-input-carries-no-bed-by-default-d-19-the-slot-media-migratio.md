# 0167. Input carries no bed by default (D-19 — the slot-media migration is

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/slideGroups.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

`input` carries no bed by default (D-19 — the slot-media migration is gone; a freshly materialized group always starts with no bed) and lands in this SAME `setDoc` as the slides.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-01, WR-01`):

**`src/stores/slideGroups.ts:89-103`:**

```
   *
   * `input` carries no bed by default (D-19 — the slot-media migration is
   * gone; a freshly materialized group always starts with no bed) and lands
   * in this SAME `setDoc` as the slides. The bed is audio-only (D-18) —
   * there is no video bed field.
   *
   * CR-01 (asymmetric WR-01 fix): this create is now ALSO `{ merge: true }`.
   * `setGroupBedMedia`'s skeleton-create was made a merge write specifically
   * because it races this function — both independently `getDoc` the same
   * not-yet-existing doc and, on absence, `setDoc`. Only guarding
   * `setGroupBedMedia`'s half left this function's plain, non-merge `setDoc`
   * able to win the race and silently erase a `bedAudioUrl` a user had JUST
   * attached (a concurrently-landing bed-media skeleton write's `bedAudioUrl`
   * key, which is absent from `input`, would otherwise be wiped by a full
   * replace). Since this branch only ever runs when `getDoc` found NO
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/slideGroups.ts:89-103`
