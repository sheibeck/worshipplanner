# 0053. The DISABLE branch writes BOTH aiMasterEnabled: false AND

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/orgProvisioning.ts`. Documented at the time in `82-RESEARCH.md`.

the DISABLE branch writes BOTH `aiMasterEnabled: false` AND `settings.aiEnabled: false` in the SAME merge write, using the EXPLICIT dot-path key form (`'settings.aiEnabled': false`), never a nested `{ settings: { aiEnabl...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/orgProvisioning.ts:662-676`:**

```
 * the DISABLE branch writes BOTH `aiMasterEnabled: false` AND
 * `settings.aiEnabled: false` in the SAME merge write, using the EXPLICIT
 * dot-path key form (`'settings.aiEnabled': false`), never a nested
 * `{ settings: { aiEnabled: false } }` object literal -- the dot-path form is
 * unambiguously a single-field merge and matches SettingsView.vue:1047's own
 * client-side save shape, so a sibling settings field (bibleVersion, etc.)
 * can never be clobbered (82-RESEARCH.md Pitfall 4).
 *
 * EDGE-CASE short-circuit (plan-checker warning #3): a DISABLE call short-
 * circuits ONLY when BOTH `aiMasterEnabled` is already false AND
 * `settings.aiEnabled` is already false -- never on `aiMasterEnabled` alone.
 * A repeat disable call must still re-force `settings.aiEnabled` off if it
 * somehow drifted back on (e.g. write-ordering with a concurrent settings
 * save), so the forced-off write is never silently skipped. ENABLE keeps the
 * plain same-state short-circuit -- there is no forced-on side effect to
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgProvisioning.ts:662-676`
