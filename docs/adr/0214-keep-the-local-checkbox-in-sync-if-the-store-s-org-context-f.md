# 0214. Keep the local checkbox in sync if the store's org context finishes

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/views/SettingsView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Keep the local checkbox in sync if the store's org context finishes loading after this component mounts (org doc is not live-synced — Pitfall 2 — so this only reflects our own mirror-writes and the initial async loadOrgC...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/SettingsView.vue:806-809`:**

```

// Keep the local checkbox in sync if the store's org context finishes loading
// after this component mounts (org doc is not live-synced — Pitfall 2 — so this
// only reflects our own mirror-writes and the initial async loadOrgContext read).
```

**`src/views/SettingsView.vue:1020-1024`:**

```

// ── Vertical Worship toggle action (D-15/D-16) ─────────────────────────────────
// Mirror-write template follows onSaveSlug: updateDoc the org doc, then
// immediately reassign the store ref (org doc is not live-synced — Pitfall 2).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/SettingsView.vue:806-809`
- `src/views/SettingsView.vue:1020-1024`
