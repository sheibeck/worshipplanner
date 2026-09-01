# 0167. This describes the physical cable plugged into THIS device, not an

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/monitorConfig.ts`. Documented at the time in `91-REVIEW.md`.

this describes the physical cable plugged into THIS device, not an org/user preference, so the storage key is a SINGLE FIXED constant deliberately UNSCOPED by uid/org — a divergence from `stores/songs.ts`'s uid-scoped `w...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `Pitfall, WR-04`):

**`src/utils/monitorConfig.ts:7-27`:**

```
// this describes the physical cable plugged into THIS device, not an org/user
// preference, so the storage key is a SINGLE FIXED constant deliberately
// UNSCOPED by uid/org — a divergence from `stores/songs.ts`'s uid-scoped
// `wp:tagFilter:v2:${org}:${uid}` precedent, made on purpose (91-CONTEXT.md).
//
// A screen's `label`/id is not a stable hardware key across replug or a
// browser data-clear (PITFALLS Pitfall 2), so the persisted identity is a
// SYNTHESIZED fingerprint composed from label + resolution + position +
// isPrimary, never a raw screen id or array index.
//
// The module never calls the Window Management API itself (no
// `getScreenDetails()`) — screens are always passed in by the caller, keeping
// this pure and testable with plain object fixtures.
//
// `matchMapping`'s saved-vs-live comparison is BIDIRECTIONAL set-equality
// (WR-04, 91-REVIEW.md), not a one-way "every saved fingerprint is still
// live" subset check: a screen removed since the mapping was saved AND a
// screen newly added since are both genuine layout changes and both force
// `needs-reprompt` (R268 / PITFALLS Pitfall 2).

/** Minimal structural shape this module needs from a live screen object. */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/monitorConfig.ts:7-27`
