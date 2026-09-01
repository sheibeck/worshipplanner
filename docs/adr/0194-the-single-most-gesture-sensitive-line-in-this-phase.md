# 0194. The single most gesture-sensitive line in this phase

## Status

Accepted

## Context

This rationale is applied at 4 call site(s) within `src/views/MonitorSetupView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

The single most gesture-sensitive line in this phase: getScreenDetails() MUST be the first statement here (after the plain feature-detect guard, which consumes no event-loop turn) with NO await/store dispatch/router call...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/MonitorSetupView.vue:341-342`:**

```
    // Layout changed since the mapping was saved — never guess the new
    // mapping from the stale one (PITFALLS Pitfall 2).
```

**`src/views/MonitorSetupView.vue:411-416`:**

```

// The single most gesture-sensitive line in this phase: getScreenDetails()
// MUST be the first statement here (after the plain feature-detect guard,
// which consumes no event-loop turn) with NO await/store dispatch/router
// call before it — an intervening await loses user activation and the
// permission prompt silently fails to appear (PITFALLS Pitfall 1/9).
```

**`src/views/MonitorSetupView.vue:423-424`:**

```
  // Synchronous ref bump, NOT an await — preserves user activation for the
  // getScreenDetails() call immediately below (PITFALLS Pitfall 1/9).
```

**`src/views/MonitorSetupView.vue:466-466`:**

```
      // Pre-read for UI state only — never the actual gate (PITFALLS Pitfall 1).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/MonitorSetupView.vue:341-342`
- `src/views/MonitorSetupView.vue:411-416`
- `src/views/MonitorSetupView.vue:423-424`
- `src/views/MonitorSetupView.vue:466-466`
