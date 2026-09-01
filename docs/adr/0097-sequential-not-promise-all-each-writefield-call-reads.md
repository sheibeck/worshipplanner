# 0097. Sequential, NOT Promise.all. Each writeField call reads

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/slides/EditSlideDrawer.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-01: sequential, NOT Promise.all. Each `writeField` call reads `props.group.slides` fresh at the moment it runs — if two fields' debounces both fired concurrently, both would read the exact same stale base and each wri...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/components/slides/EditSlideDrawer.vue:1269-1276`:**

```
  // CR-01: sequential, NOT Promise.all. Each `writeField` call reads
  // `props.group.slides` fresh at the moment it runs — if two fields'
  // debounces both fired concurrently, both would read the exact same
  // stale base and each write's `next` would silently clobber the other's
  // field with the stale value. Awaiting each flush in turn means the
  // second flush's `writeField` reads the post-commit base the first
  // flush just wrote (props.group updates from the store's own snapshot
  // round-trip before the next await resumes), so both edits survive.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/EditSlideDrawer.vue:1269-1276`
