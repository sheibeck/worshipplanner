# 0181. Mints the stable per-entry identity derivedIdentityKey/

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/importedRenderReconciler.ts`. Documented at the time in `42-REVIEW.md`.

Mints the stable per-entry identity `derivedIdentityKey`/ `carryStoredDerivedEntries` key on across a rebuild.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/utils/importedRenderReconciler.ts:146-160`:**

```
 * Mints the stable per-entry identity `derivedIdentityKey`/
 * `carryStoredDerivedEntries` key on across a rebuild. `ready` mode mints
 * synthetic `rendered-page-N` identities (Fact 1 — no `deck.slides[i].id`
 * pairing); every other mode (`parsed`/`pending`/`failed`) reuses
 * `deck.slides[i].id`.
 *
 * CR-01 (42-REVIEW.md) — corrected 2026-08-07: a `pending`/`failed` ->
 * `ready` transition does NOT carry forward per-entry customization. A
 * previous version of this comment claimed it could — that was false.
 * `pending`/`failed` identities key on `deck.slides[i].id` (a parsed-slide
 * UUID); `ready` identities key on the synthetic `rendered-page-N` string
 * minted above. The two key spaces never overlap, so
 * `carryStoredDerivedEntries` cannot match a stored pending/failed entry to
 * its post-render counterpart: any label, per-slide `audioUrl`/`audioLoop`,
 * or `notes` a user attached via "Edit details" while the render was still
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/importedRenderReconciler.ts:146-160`
