# 0053. Click-between-verses divider UX per direct owner feedback: the

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/CongregationalEditor.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

click-between-verses divider UX per direct owner feedback: the divider UX was unintuitive).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-04`):

**`src/components/CongregationalEditor.vue:162-176`:**

```
// click-between-verses divider UX per direct owner feedback: the divider UX
// was unintuitive). The user edits a plain `---`-delimited textarea, exactly
// like the song-lyrics paste flow; `src/utils/congregationalText.ts` is the
// single source of truth for the text<->sections grammar.
//
// Controlled component (R064): it persists NOTHING itself. It seeds its
// editable `text` ONCE at mount (WR-04 — keyed on slot id by the parent, not
// reactive to later prop changes) and reports upward only on Save via
// `update:sections`, on Delete via `delete`, and closes via `close`.
//
// R092 (translationSource): `capturedVersion` is captured ONCE — from the
// existing sections at mount, or from the church's bibleVersion setting at the
// moment of the auto-fetch — and every Save stamps from that captured value,
// never a fresh read of the org's current setting.
//
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/CongregationalEditor.vue:162-176`
