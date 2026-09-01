# 0213. State: dirtyEdits tracks whether the operator has made unsaved

## Status

Accepted

## Context

This rationale is applied at 10 call site(s) within `src/views/MonitorSetupView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-02 state: `dirtyEdits` tracks whether the operator has made unsaved in-progress role selections (a fresh/reprompt selection, or a "Reassign roles" edit from the matched summary).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/views/MonitorSetupView.vue:83-84`:**

```

          <!-- WR-02: a re-detect / OS screenschange whose physical screen set
```

**`src/views/MonitorSetupView.vue:186-192`:**

```

// WR-02 state: `dirtyEdits` tracks whether the operator has made unsaved
// in-progress role selections (a fresh/reprompt selection, or a "Reassign
// roles" edit from the matched summary). `refreshNoticeVisible` surfaces a
// non-blocking notice when a mid-session refresh (Re-detect / OS
// screenschange) was suppressed to protect those edits because the physical
// screen set had not actually changed.
```

**`src/views/MonitorSetupView.vue:232-233`:**

```
  // The operator has an unsaved edit now — a same-layout refresh must not
  // clobber it (WR-02). Clear any prior "we kept your choices" notice too.
```

**`src/views/MonitorSetupView.vue:237-240`:**

```

// Expanding the matched B2 summary into the editable grid is itself the start
// of an unsaved edit — mark it dirty so a same-layout Re-detect / screenschange
// can't collapse it back to the read-only summary (WR-02).
```

**`src/views/MonitorSetupView.vue:288-288`:**

```
    // The edit is now the saved baseline — no longer dirty (WR-02).
```

**`src/views/MonitorSetupView.vue:318-321`:**

```
  // A full (re)resolution establishes a clean baseline from persisted state —
  // any prior in-progress edit is intentionally being replaced here, so clear
  // the dirty/notice flags (WR-02). Callers that must PROTECT an unsaved edit
  // (applyDetectedScreens on a same-set refresh) skip calling this entirely.
```

**`src/views/MonitorSetupView.vue:349-351`:**

```

// A stable, order-independent key of the physical screen SET, used to decide
// whether a mid-session refresh actually changed the monitors (WR-02).
```

**`src/views/MonitorSetupView.vue:360-368`:**

```
 * `isRefresh` distinguishes a mid-session re-detect / OS screenschange (the
 * operator is already looking at the granted grid, possibly mid-edit) from an
 * initial detection. On a refresh whose physical screen SET is unchanged, an
 * unconditional `resolveGrantedBranch()` would silently discard the operator's
 * unsaved role selections (and collapse a "Reassign roles" edit back to the
 * read-only summary) — so we keep the in-progress edit and show a non-blocking
 * notice instead (WR-02). A genuine layout change still re-resolves, since
 * selections made against screens that are gone are no longer valid.
 */
```

**`src/views/MonitorSetupView.vue:382-382`:**

```
    // Same monitors, unsaved edit in flight — protect it (WR-02).
```

**`src/views/MonitorSetupView.vue:449-450`:**

```
      // Refresh path — protect any unsaved in-progress edit when the physical
      // screen set is unchanged (WR-02).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/MonitorSetupView.vue:83-84`
- `src/views/MonitorSetupView.vue:186-192`
- `src/views/MonitorSetupView.vue:232-233`
- `src/views/MonitorSetupView.vue:237-240`
- `src/views/MonitorSetupView.vue:288-288`
- `src/views/MonitorSetupView.vue:318-321`
- `src/views/MonitorSetupView.vue:349-351`
- `src/views/MonitorSetupView.vue:360-368`
- `src/views/MonitorSetupView.vue:382-382`
- `src/views/MonitorSetupView.vue:449-450`
