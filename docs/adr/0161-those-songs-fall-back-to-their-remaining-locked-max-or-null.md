# 0161. Those songs fall back to their remaining locked MAX (or null if this

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/stores/services.ts`. Documented at the time in `84-REVIEW`.

Those songs fall back to their remaining locked MAX (or null if this was their only locked service) — see buildLastUsedSnapshot's doc comment for the status-override rationale.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-02`):

**`src/stores/services.ts:502-512`:**

```
    // R247 — this service is now locked; recompute lastUsedAt for its songs
    // so they pick up this service's date (advancing to MAX over every
    // locked service that contains them). See buildLastUsedSnapshot's doc
    // comment for why the snapshot below overrides THIS service's status
    // rather than relying on services.value, which still shows 'draft' here.
    //
    // CR-02 (84-REVIEW): soft-fail, mirroring maybeRefreshShareLink's pattern
    // in this same file. The status write above already landed — a transient
    // recompute failure (permission edge case, network blip, quota) must not
    // reject the whole transition and make the caller report "it didn't
    // save" for a service that is now genuinely planned.
```

**`src/stores/services.ts:554-562`:**

```

    // Those songs fall back to their remaining locked MAX (or null if this
    // was their only locked service) — see buildLastUsedSnapshot's doc
    // comment for the status-override rationale.
    //
    // CR-02 (84-REVIEW): soft-fail, mirroring markAsPlanned's identical guard
    // above and maybeRefreshShareLink's pattern in this same file — the
    // status write already landed, so a transient recompute failure must not
    // reject the reopen itself.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/services.ts:502-512`
- `src/stores/services.ts:554-562`
