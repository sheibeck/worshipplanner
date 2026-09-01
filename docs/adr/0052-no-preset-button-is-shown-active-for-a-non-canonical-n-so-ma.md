# 0052. No preset button is shown active for a non-canonical n, so make the

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/AvailabilityDrawer.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-04: no preset button is shown active for a non-canonical n, so make the custom cadence explicit in the readout text too, rather than relying on the reader to notice the number doesn't match any highlighted preset.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-04`):

**`src/components/AvailabilityDrawer.vue:399-409`:**

```

// ── Serve frequency (per-role quarter tier + cadence, D-05/D-06) ───────────
// draft.roleFrequency[roleId] carries both the tier AND the cadence n in one
// write (D-05) — no separate standing frequency field remains. The 'regular'
// tier's active preset is derived from n (weekly n=1, biweek n=2, monthly n=4).
// WR-04: a non-preset n (e.g. "3" or "1-in-6" imported via CSV — both valid,
// supported frequencyLabelToN inputs) must NOT be shown as an active preset —
// 'monthly' previously matched by fallback, misrepresenting the real cadence
// and turning a click on "Monthly" into a silent, no-op-looking overwrite.
// 'custom' is a display-only state: it never matches any rendered preset's
// key, so no preset button is ever wrongly highlighted as active for it.
```

**`src/components/AvailabilityDrawer.vue:437-439`:**

```
  // WR-04: no preset button is shown active for a non-canonical n, so make the custom
  // cadence explicit in the readout text too, rather than relying on the reader to notice
  // the number doesn't match any highlighted preset.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/AvailabilityDrawer.vue:399-409`
- `src/components/AvailabilityDrawer.vue:437-439`
