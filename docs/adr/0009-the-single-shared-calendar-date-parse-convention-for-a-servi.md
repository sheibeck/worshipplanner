# 0009. The single shared calendar-date parse convention for a Service.date

## Status

Accepted

## Context

This rationale is applied consistently at 2 call site(s) across 2 files: `functions/src/backfillLastUsed.ts`, `src/utils/lastUsed.ts`. Documented at the time in `84-REVIEW`.

The single shared calendar-date parse convention for a `Service.date` `"YYYY-MM-DD"` string.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`functions/src/backfillLastUsed.ts:79-93`:**

```
/**
 * The single shared calendar-date parse convention for a `Service.date`
 * `"YYYY-MM-DD"` string. BOTH the live store adapter (`services.ts`) and the
 * 84-02 backfill must use this exact expression so the `Timestamp` each
 * environment writes is identical.
 *
 * WR-03 (84-REVIEW): parses as UTC midnight (`Date.UTC`) rather than the
 * previous `new Date(\`${date}T00:00:00\`)`, which resolved "local midnight"
 * against whichever timezone the running process defaulted to -- the end
 * user's browser on the client, but the HOST MACHINE's ambient `TZ` for this
 * Admin-SDK script (a CI runner, cloud shell, or Docker container commonly
 * defaults to UTC). Two environments computing a different midnight for the
 * identical `"YYYY-MM-DD"` string would make `Timestamp.isEqual` never
 * converge -- the idempotency check would "correct" an already-correct
 * song's `lastUsedAt` forever, off by a fixed offset, with no error raised.
```

**`src/utils/lastUsed.ts:58-72`:**

```
/**
 * The single shared calendar-date parse convention for a `Service.date`
 * `"YYYY-MM-DD"` string. BOTH the live store adapter (`services.ts`) and the
 * 84-02 backfill must use this exact expression so the `Timestamp` each
 * environment writes is identical.
 *
 * WR-03 (84-REVIEW): parses as UTC midnight (`Date.UTC`) rather than the
 * previous `new Date(\`${date}T00:00:00\`)`, which resolved "local midnight"
 * against whichever timezone the running process defaulted to — the end
 * user's browser on the client, but the HOST MACHINE's ambient `TZ` for the
 * Admin-SDK backfill script (a CI runner, cloud shell, or Docker container
 * commonly defaults to UTC). Two environments computing a different midnight
 * for the identical `"YYYY-MM-DD"` string would make `Timestamp.isEqual`
 * never converge — the backfill's idempotency check would "correct" an
 * already-correct song's `lastUsedAt` forever, off by a fixed offset, with
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/backfillLastUsed.ts:79-93`
- `src/utils/lastUsed.ts:58-72`
