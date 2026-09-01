# 0114. Which display was refused when EXACTLY ONE of the two window.open

## Status

Accepted

## Context

This rationale is applied at 5 call site(s) within `src/composables/useRunControl.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-02: which display was refused when EXACTLY ONE of the two window.open calls came back null (the honest 'partial' state names the dark monitor).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/composables/useRunControl.ts:83-88`:**

```
  // Shared service-load + read-only assembly core (95-01). Owns ?org=/:serviceId
  // scoping, the localService initial-load watch, the read-only assembly, and the
  // WR-02 subscribe gate — do NOT re-do any of it here, and (deliberately) it
  // registers NO unsubscribeAll, so this in-app route never tears down peers.
  // Called FIRST so its onMounted subscribe registers before this composable's
  // channel-opening onMounted (subscribe-before-channel ordering preserved).
```

**`src/composables/useRunControl.ts:363-364`:**

```
  // WR-02: which display was refused when EXACTLY ONE of the two window.open
  // calls came back null (the honest 'partial' state names the dark monitor).
```

**`src/composables/useRunControl.ts:694-704`:**

```

  /**
   * WR-02 — honest gate on the TWO output handles before any success claim.
   * A "placed"/"fallback" claim requires BOTH windows to have real (non-null)
   * handles, because some browsers grant only ONE window per user activation:
   *  - both null → 'blocked' (pop-ups refused, nothing opened)
   *  - one null  → 'partial' (one display is live, the other is dark) — the
   *                banner names the refused role and offers retry, NEVER green
   *  - both open → returns true so the caller may make its success claim
   * Returns true ONLY when both windows opened.
   */
```

**`src/composables/useRunControl.ts:723-725`:**

```
    // Gate the success claim on BOTH real windows (WR-02): fewer than two → an
    // honest blocked/partial state, never a green "Displays ready" over a dark
    // monitor.
```

**`src/composables/useRunControl.ts:747-748`:**

```
    // WR-02: the amber "two windows opened" fallback claim requires BOTH handles;
    // both-null is blocked, exactly-one-null is the honest partial state.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useRunControl.ts:83-88`
- `src/composables/useRunControl.ts:363-364`
- `src/composables/useRunControl.ts:694-704`
- `src/composables/useRunControl.ts:723-725`
- `src/composables/useRunControl.ts:747-748`
