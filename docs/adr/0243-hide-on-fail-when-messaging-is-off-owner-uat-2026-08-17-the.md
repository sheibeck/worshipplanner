# 0243. HIDE-ON-FAIL when messaging is off (owner UAT, 2026-08-17): "The

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/serviceEditorActionBar.ts`. Documented at the time in `59-UI-SPEC.md`.

HIDE-ON-FAIL when messaging is off (owner UAT, 2026-08-17): "The messages button ... shows up even if Messaging setting is turned off.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/views/serviceEditorActionBar.ts:233-243`:**

```
 *
 * HIDE-ON-FAIL when messaging is off (owner UAT, 2026-08-17): "The messages
 * button ... shows up even if Messaging setting is turned off. It should be
 * hidden if message setting is turned off." This REVERSES 59-04's deliberate
 * disabled+tooltip-for-discoverability choice (59-UI-SPEC.md #0). The item now
 * returns `undefined` when `!ctx.messagingEnabled`, matching `buildShareItem`
 * and the WR-01 AI "hide-don't-disable" rule. The server kill-switch re-check
 * in `queueServiceMessage` (59-02) remains the real boundary; this UI gate is
 * convenience. Do NOT "restore" the disabled+tooltip form — the owner asked
 * for the opposite.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/serviceEditorActionBar.ts:233-243`
