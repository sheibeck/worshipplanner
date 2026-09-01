# 0119. The drawer has one body, so there is no mode to set — Duplicate and

## Status

Accepted

## Context

This rationale is applied at 4 call site(s) within `src/components/slides/SlidesTab.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

the drawer has one body, so there is no mode to set — Duplicate and Delete simply open it, because that is where their EXISTING write paths live (the duplicate write, the inline delete confirm) — this dispatcher itself n...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-04`):

**`src/components/slides/SlidesTab.vue:175-181`:**

```

/**
 * WR-04: a ref to the mounted drawer so `onMenuAction`'s navigation keys
 * ("edit-in-song"/"edit-in-scripture") can gate on the drawer's OWN unsaved
 * edit guard before routing away — the one path this component owns that the
 * drawer itself cannot self-guard, since 33-09 relocated the navigation here.
 */
```

**`src/components/slides/SlidesTab.vue:303-313`:**

```

/**
 * 34-07 (owner UAT F1) — the drawer's Slide Text scripture-route control.
 * Runs the SAME unsaved-drawer guard the menu path runs (WR-04), then closes
 * the drawer and calls the SAME `requestEditInScripture` relay the menu's
 * `edit-in-scripture` key calls, so both routes converge on one relay and
 * therefore one mounted editor. The drawer is closed because the editor now
 * opens as a modal over this tab rather than by navigating away — leaving
 * the drawer open behind it would leave two editing surfaces stacked on the
 * same entry.
 */
```

**`src/components/slides/SlidesTab.vue:442-455`:**

```
 * the drawer has one body, so there is no mode to set — Duplicate and Delete
 * simply open it, because that is where their EXISTING write paths live (the
 * duplicate write, the inline delete confirm) — this dispatcher itself never
 * calls a delete or duplicate store action; it only ever sets a pending
 * request for the drawer to act on (P-01).
 *
 * WR-04: "edit-in-song"/"edit-in-scripture" are checked against the OPEN
 * drawer's own unsaved-edit guard BEFORE `selectedSlideId` is reassigned
 * below — the drawer's own `watch(() => props.entry)` starts flushing/
 * resetting for the new entry the moment the selection changes, so asking
 * afterward would already be asking about the wrong entry. A cancelled
 * confirm leaves the selection and drawer state untouched, so an in-flight
 * edit on the entry being left is never silently abandoned.
 */
```

**`src/components/slides/SlidesTab.vue:475-483`:**

```

/**
 * The read-only song badge (SlideGrid's `edit-in-song` emit, owner UAT) — a
 * discoverable route to the SAME song-lyrics editor the 3-dot menu's
 * `edit-in-song` key opens. Takes the exact same path as that menu case: honour
 * an open drawer's unsaved-edit guard first (WR-04), then `router.push` the
 * song-edit link on its lyrics tab. The `songId` is the group's own, read off
 * the selected SONG slot inside SlideGrid — never off the DOM event.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlidesTab.vue:175-181`
- `src/components/slides/SlidesTab.vue:303-313`
- `src/components/slides/SlidesTab.vue:442-455`
- `src/components/slides/SlidesTab.vue:475-483`
