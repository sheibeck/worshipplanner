# 0162. Mirrors TeamView.vue's onCancelInvite pattern — surface the failure

## Status

Accepted

## Context

This rationale is applied consistently at 3 call site(s) across 2 files: `src/stores/services.ts`, `src/views/ServiceEditorView.vue`. Documented at the time in `80-REVIEW`.

WR-01 (80-REVIEW): mirrors TeamView.vue's onCancelInvite pattern — surface the failure and keep the confirm dialog open (do NOT close it here) so the user can see the error and retry, instead of the dialog silently closi...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/stores/services.ts:602-611`:**

```

    // WR-01 (80-REVIEW): each revocation step below is independently
    // try/caught. Before this, a single mid-sequence failure (permission-
    // denied on a stale/cross-org doc, a transient network error) would
    // throw out of deleteService entirely, skipping BOTH the remaining
    // revocation steps AND the actual service-doc delete — leaving the
    // service partially-revoked yet still fully present, while the caller
    // (ServiceEditorView.vue's onDelete) silently closed the confirm dialog
    // with no error surfaced. Revocation is now best-effort: a failure here
    // is logged and does not block the other artifacts' revocation or the
```

**`src/views/ServiceEditorView.vue:1938-1942`:**

```
// WR-01 (80-REVIEW): deleteService's revocation steps are now best-effort,
// but the service-doc delete itself (the last step) is unguarded and can
// still throw. Before this, onDelete had no catch — a failure closed the
// confirm dialog silently, looking like success while the service was NOT
// actually deleted.
```

**`src/views/ServiceEditorView.vue:4748-4751`:**

```
    // WR-01 (80-REVIEW): mirrors TeamView.vue's onCancelInvite pattern —
    // surface the failure and keep the confirm dialog open (do NOT close it
    // here) so the user can see the error and retry, instead of the dialog
    // silently closing while the service was never actually deleted.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/services.ts:602-611`
- `src/views/ServiceEditorView.vue:1938-1942`
- `src/views/ServiceEditorView.vue:4748-4751`
