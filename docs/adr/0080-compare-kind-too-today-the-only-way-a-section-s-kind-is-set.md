# 0080. Compare kind too — today the only way a section's kind is set is at

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/SongLyricEditor.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-02 (105 code review): compare `kind` too — today the only way a section's `kind` is set is at mint time in `addSection('BLACKOUT')`, which always mints a fresh id, so an id/label match currently implies a `kind` match...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/SongLyricEditor.vue:523-529`:**

```
    // WR-02 (105 code review): compare `kind` too — today the only way a
    // section's `kind` is set is at mint time in `addSection('BLACKOUT')`,
    // which always mints a fresh id, so an id/label match currently implies
    // a `kind` match as well. But this is a field-by-field equality check
    // (it already goes out of its way to catch slideBreaks-only changes
    // above), so a future in-place `kind` mutation (e.g. a "convert to
    // black slide" affordance) must not be silently missed by autosave.
```

**`src/components/SongLyricEditor.vue:628-634`:**

```

// WR-02: a textarea value ending in a newline (Enter after the last line, or
// a paste with a trailing newline) produces a trailing empty-string element
// from `split('\n')`. That empty line is not cosmetic here — it renders as a
// blank line on the projected slide. Strip exactly one trailing empty
// element (the artifact of how textareas serialize), not all trailing
// blanks — a user may legitimately want internal blank-line spacing.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/SongLyricEditor.vue:523-529`
- `src/components/SongLyricEditor.vue:628-634`
