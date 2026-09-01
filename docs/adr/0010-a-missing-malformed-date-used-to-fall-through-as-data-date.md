# 0010. A missing/malformed date used to fall through as data.date ?? ""

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `functions/src/backfillLastUsed.ts`. Documented at the time in `84-REVIEW`.

WR-02 (84-REVIEW): a missing/malformed `date` used to fall through as `data.date ?? ""`, letting a bogus service silently feed `serviceDateToMillis("")` -> NaN -> a `Timestamp.fromMillis(NaN)` attempt, "safely" caught on...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/backfillLastUsed.ts:145-152`:**

```
  /**
   * WR-02 (84-REVIEW): service doc ids excluded from the MAX computation
   * because `date` was missing or not a `YYYY-MM-DD` string -- distinct from
   * `failed` (which is per-SONG). A non-empty list here is a materially
   * different, worth-investigating condition ("this org has a service with
   * no/bad date") that a human should see before `--apply`, not something
   * that should silently fall through to a per-song NaN Timestamp failure.
   */
```

**`functions/src/backfillLastUsed.ts:176-183`:**

```

  // WR-02 (84-REVIEW): a missing/malformed `date` used to fall through as
  // `data.date ?? ""`, letting a bogus service silently feed
  // `serviceDateToMillis("")` -> NaN -> a `Timestamp.fromMillis(NaN)`
  // attempt, "safely" caught only incidentally by the per-song try/catch
  // below and indistinguishable from an unrelated song-doc read failure.
  // Explicitly excluded and reported here instead, BEFORE any song is
  // classified against it.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/backfillLastUsed.ts:145-152`
- `functions/src/backfillLastUsed.ts:176-183`
