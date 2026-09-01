# 0136. SlideTypography is deep-merged specifically — the plain

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/auth.ts`. Documented at the time in `46-REVIEW.md`.

WR-01 (46-REVIEW.md): `slideTypography` is deep-merged specifically — the plain `...orgSettings` spread above is shallow, so a partial/legacy stored value (e.g.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/stores/auth.ts:426-435`:**

```

    // WR-01 (46-REVIEW.md): `slideTypography` is deep-merged specifically
    // — the plain `...orgSettings` spread above is shallow, so a
    // partial/legacy stored value (e.g. a hand-edited Firestore document,
    // or any future write path that persists fewer than all three leaf
    // keys) would otherwise replace the whole nested object wholesale,
    // leaving `fontWeight`/`fontScale` `undefined` rather than falling
    // back to the per-field defaults. `cssVarsFor` already tolerates this
    // at render time, but `SettingsView.vue`'s local refs are initialized
    // directly from this object with no equivalent guard.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/auth.ts:426-435`
