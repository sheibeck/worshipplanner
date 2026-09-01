# 0104. This drawer's OWN failure state (26-RESEARCH.md Pitfall 6)

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/slides/EditSlideDrawer.vue`. Documented at the time in `26-RESEARCH.md`.

This drawer's OWN failure state (26-RESEARCH.md Pitfall 6) — `AudioPlayer` is a deliberately dumb primitive that only emits `error`, it renders no degraded-state text of its own.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/components/slides/EditSlideDrawer.vue:309-310`:**

```
              <!-- This drawer's OWN failure ref/handler (26-RESEARCH.md
                   Pitfall 6) — AudioPlayer itself renders no degraded-state
```

**`src/components/slides/EditSlideDrawer.vue:928-929`:**

```

/** This drawer's OWN failure state (26-RESEARCH.md Pitfall 6) — `AudioPlayer` is a deliberately dumb primitive that only emits `error`, it renders no degraded-state text of its own. Reset whenever the attached file or the edited slide changes, so a stale failure never sticks to a different file (see the two watchers below). */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/EditSlideDrawer.vue:309-310`
- `src/components/slides/EditSlideDrawer.vue:928-929`
