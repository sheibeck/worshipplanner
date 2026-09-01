# 0055. Same guard as onAiSplit's stampVersion -- the per-item override

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/CongregationalEditor.vue`. Documented at the time in `103-REVIEW`.

WR-02 (103-REVIEW): same guard as onAiSplit's stampVersion -- the per-item override (props.bibleVersion) is a deliberate, explicit choice and still applies; only the final catch-all org-default fallback is nulled out whe...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/CongregationalEditor.vue:348-356`:**

```
    // WR-02 (103-REVIEW): the org's stored bibleVersion has no relationship to
    // "any version" text typed directly into the textarea while the Bible API
    // is off -- capturedVersion is only ever set inside autoFetch's 'ok'
    // branch, which never runs while the API is off, so it always falls
    // through to here on the manual-entry path. Falling back to the org
    // default there would falsely stamp e.g. ESV on manually-entered NIV
    // text. Guarded so the org-default fallback is only used on the
    // fetch-backed (enabled) path; the manual-entry path leaves
    // translationSource unset.
```

**`src/components/CongregationalEditor.vue:373-377`:**

```
  // WR-02 (103-REVIEW): same guard as onAiSplit's stampVersion -- the
  // per-item override (props.bibleVersion) is a deliberate, explicit choice
  // and still applies; only the final catch-all org-default fallback is
  // nulled out when the Bible API is off, since that setting has no
  // relationship to whatever the user actually typed into the textarea.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/CongregationalEditor.vue:348-356`
- `src/components/CongregationalEditor.vue:373-377`
