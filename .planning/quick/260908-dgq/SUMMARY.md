---
quick_id: 260908-dgq
slug: messaging-off-notice
status: complete
date: 2026-09-08
commit: b2847586
---

# Summary: Messaging-off notice on the Service Messages tab

**Status: complete ✓** — committed `b2847586`, type-check clean, full
ServiceEditorView suite 348/348, full app suite at baseline.

## What shipped

The Messages tab on the Service planning screen now **always shows for editors**
(previously hidden when org messaging was off). When messaging is off, the panel
shows a notice instead of empty/editable controls:

> Messaging is off. **Configure messaging** so your team gets service plan updates.

"Configure messaging" is a `router-link` to `{ name: 'settings' }`. Editors only
(the tab and notice are both editor-gated); viewers still never see the tab.

## Implementation (`src/views/ServiceEditorView.vue`)

- Messages **tab button** (`#svc-tab-messages`) and `visibleTabOrder`: gated on
  `authStore.isEditor` only (dropped `&& isMessagingEnabled()`).
- New `messaging-off-notice` card inside `messages-panel`,
  `v-if="authStore.isEditor && !isMessagingEnabled()"` — amber info card, mirrors
  the existing `pc-credentials-missing-note` "configure in Settings" idiom.
- `messaging-defaults-panel` now `v-if="isMessagingEnabled()"`, so the notice
  replaces it when off.
- `service-message-history`'s own `isMessagingEnabled() && isEditor` gate is
  unchanged — it stays hidden when off.

## Tests (`src/views/__tests__/ServiceEditorView.test.ts`)

- Rewrote "HIDES the Messages tab button when org messaging is OFF" → "SHOWS the
  tab for an editor even when OFF".
- Added: messaging OFF → `messaging-off-notice` present (with a Settings link),
  `messaging-defaults-panel` absent; messaging ON → notice absent, defaults present.
- The "Messaging defaults panel (58-05, R132)" describe now runs with
  `messaging.enabled = true` (its subject requires messaging on — it previously
  relied on the panel always being in the DOM).

## Non-goals

- No change to the kill-switch semantics, compose/send flow, or the history gate.
