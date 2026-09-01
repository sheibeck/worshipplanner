# 0204. This application has no per-song address today — /songs is a flat

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/songEditLink.ts`. Documented at the time in `26-RESEARCH.md`.

This application has no per-song address today — `/songs` is a flat list route with no id segment, and the song editor (`SongSlideOver.vue`) is opened purely from local click state inside `SongsView.vue`.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/songEditLink.ts:5-16`:**

```
 * This application has no per-song address today — `/songs` is a flat list route
 * with no id segment, and the song editor (`SongSlideOver.vue`) is opened purely
 * from local click state inside `SongsView.vue`. Adding a real per-song route
 * would be a larger change than this phase's scope allows. This module instead
 * extends the query-param convention `SongsView.vue` already uses for its
 * existing `?import=true` auto-open-import parameter (read on mount, act, then
 * clear via a non-navigating `router.replace`) — see 26-RESEARCH.md Pitfall 4.
 *
 * This module is pure: it imports nothing from Vue, the router, or any store, so
 * the sender (a future drawer) and the receiver (`SongsView.vue`) can never drift
 * apart on the shape of the link they share.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/songEditLink.ts:5-16`
