# 0018. Patches (or deletes) ONE key inside a NESTED map claim (e.g

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/claimsHelpers.ts`. Documented at the time in `76-RESEARCH.md`.

Patches (or deletes) ONE key inside a NESTED map claim (e.g. `deactivatedOrgs[orgId]`), preserving every other top-level claim key AND every other key already inside that same nested map -- mirrors `mergeSetAndClearCusto...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/claimsHelpers.ts:100-113`:**

```

/**
 * Patches (or deletes) ONE key inside a NESTED map claim (e.g.
 * `deactivatedOrgs[orgId]`), preserving every other top-level claim key AND
 * every other key already inside that same nested map -- mirrors
 * `mergeSetAndClearCustomClaims`'s TOCTOU-safe shape (76-RESEARCH.md Pitfall
 * 3): a SINGLE `getUser` read, an in-memory patch of the ONE nested key, then
 * a SINGLE `setCustomUserClaims` write. Never a bare replace of the nested
 * map -- `mergeAndSetCustomClaims(uid, { deactivatedOrgs: {...} })` would
 * REPLACE the whole nested object, silently wiping a sibling org's
 * deactivated-flag for a user who belongs to more than one deactivated org.
 *
 * `value === true` sets `nested[nestedKey] = true`. `value === undefined`
 * deletes `nested[nestedKey]` -- deleting the LAST remaining nested key
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/claimsHelpers.ts:100-113`
