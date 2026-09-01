# 0206. AuthStore.isEditor resolves asynchronously (loadOrgContext runs off

## Status

Accepted

## Context

This rationale is applied at 3 call site(s) within `src/views/ServiceEditorView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01: authStore.isEditor resolves asynchronously (loadOrgContext runs off the auth-state-changed flow, not synchronously at mount), and /services/:id has no requiresEditor guard forcing waitForRole() first.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/views/ServiceEditorView.vue:2887-2893`:**

```

// ── Delivery-history subscription (60-03) ────────────────────────────────────
// Subscribe to this service's messages (newest-first) when the panel is
// eligible — editor + messaging on. Re-subscribes on serviceId change or once
// isEditor resolves (WR-01-style late role flip). The store's single-listener
// guard makes repeat calls idempotent. Editor-only + nested-path reads run
// under the Phase 58 isOrgMember rules (no new client rule).
```

**`src/views/ServiceEditorView.vue:3063-3072`:**

```

// WR-01: authStore.isEditor resolves asynchronously (loadOrgContext runs off
// the auth-state-changed flow, not synchronously at mount), and /services/:id
// has no requiresEditor guard forcing waitForRole() first. If a real editor
// lands directly on this route before isEditor flips true, initStores() ran
// its one-time check with isEditor still false and never subscribed
// roster/quarters. Re-run initStores() when isEditor becomes true so the
// subscription retries once the role resolves; initStores()'s own
// `if (!rosterStore.orgId)` / `if (!quartersStore.orgId)` guards make this
// idempotent (no double-subscribe on repeated calls).
```

**`src/views/ServiceEditorView.vue:3082-3094`:**

```
// 260901-lua: /services/:id is keyed to a serviceId that belongs to the
// CURRENT (old) church. On the sidebar's in-place Switch Church, that same
// serviceId cannot exist in the newly-selected church, so staying would
// attempt a cross-org read/write. Fail safe by navigating away to /services
// on a genuine org CHANGE only. Deliberately no `{ immediate: true }`, so this
// never fires on first mount; the `if (oldOrgId)` guard also skips the
// initial null -> value org resolution (WR-01 late auth, when a user lands
// directly on this route before authStore.orgId resolves) — oldOrgId is
// null/undefined on that first callback. It fires ONLY when an
// already-established church changes to another value (or to null), i.e. a
// genuine switch away. Because we navigate away, this view unmounts and
// ServicesView's own orgId watcher subscribes the new church — no store
// re-point needed here.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:2887-2893`
- `src/views/ServiceEditorView.vue:3063-3072`
- `src/views/ServiceEditorView.vue:3082-3094`
