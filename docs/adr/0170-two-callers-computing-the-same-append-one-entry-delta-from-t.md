# 0170. (two callers computing the same "append one entry" delta from the

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/slideGroups.ts`. Documented at the time in `26-REVIEW, 38-REVIEW`.

(two callers computing the same "append one entry" delta from the same stale base) and the append-vs-reorder race (a reorder's full-array overwrite landing after a concurrent append), because whichever write loses the co...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-01, CR-02`):

**`src/stores/slideGroups.ts:284-312`:**

```
   * (two callers computing the same "append one entry" delta from the same
   * stale base) and the append-vs-reorder race (a reorder's full-array
   * overwrite landing after a concurrent append), because whichever write
   * loses the commit race re-derives against the OTHER write's already-landed
   * result rather than blindly replacing it.
   *
   * 26-REVIEW CR-02: this also reconciles a concurrent DELETION (Phase 26
   * ships the first delete-a-slide path, `EditSlideDrawer.vue`'s Delete Slide
   * action). `mergeConcurrentlyAddedEntries` strips any entry that this
   * caller's stale `next` still carries (derived from `base`, which had not
   * yet observed the deletion) but that is absent from the live document —
   * without this, a slower stale-base write (e.g. a debounced label/notes
   * edit scheduled before the delete, committing after it) would silently
   * resurrect the slide the user explicitly deleted. This does not re-derive
   * a drag-reorder's index math against a changed live array — reordering
   * still only recovers/strips entries by id, never recomputes positions
   * against a live array it never saw. `baseSlides` is optional: omitting it
   * keeps the previous plain-overwrite behavior for any caller that has not
   * been updated to track a base snapshot.
   *
   * 38-REVIEW CR-01: `sourceSignature` is a tri-state, mirroring
   * `setGroupBedMedia`'s `clearAudio` precedent (documented above) — an
   * `undefined` value means "no opinion, leave the stored field alone" and is
   * simply omitted from the write (via `stripUndefined`, as before); an
   * explicit `null` means "clear this field" and is written as a real
   * `deleteField()` sentinel, because `stripUndefined` cannot distinguish
   * "no opinion" from "clear" for a plain `undefined`. Only
   * `rebuildScriptureGroup`'s CLEARED REFERENCE branch (via
   * `useSlideshowAssembly.ts`'s `freshSignature`) passes `null` today — the
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/slideGroups.ts:284-312`
