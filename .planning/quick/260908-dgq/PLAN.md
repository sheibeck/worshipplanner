---
quick_id: 260908-dgq
slug: messaging-off-notice
status: in-progress
date: 2026-09-08
---

# Quick task: Messaging-off notice on the Service Messages tab

## Description

When org messaging is OFF (settings kill-switch), the Messages tab on the
Service planning screen used to be hidden entirely, giving an editor no hint the
feature exists. Instead, always show the Messages tab (editors only) and, when
messaging is off, show a notice inside it:

> Messaging is off. Configure messaging so your team gets service plan updates.

with "Configure messaging" linking to the Settings page. Editors only.

## Changes

- `src/views/ServiceEditorView.vue`
  - Messages **tab button** (`#svc-tab-messages`): gate on `authStore.isEditor`
    only (drop `&& isMessagingEnabled()`), so it always shows for editors.
  - `visibleTabOrder`: push `'messages'` for any editor (drop the messaging term)
    so roving-tabindex keyboard nav stays consistent.
  - Inside `messages-panel`:
    - New `messaging-off-notice` card, `v-if="authStore.isEditor && !isMessagingEnabled()"`,
      with the copy above and a `router-link :to="{ name: 'settings' }"` on
      "Configure messaging" (mirrors the existing pc-credentials-missing-note idiom).
    - Gate the `messaging-defaults-panel` on `isMessagingEnabled()` so it's
      replaced by the notice when off.
  - The `service-message-history` card is ALREADY gated
    `isMessagingEnabled() && authStore.isEditor` — unchanged (stays hidden when off).

## Tests (`src/views/__tests__/ServiceEditorView.test.ts`)

- Rewrite "HIDES the Messages tab button when org messaging is OFF" → now SHOWS
  the tab for an editor when messaging is off.
- Add: messaging OFF → `messaging-off-notice` present (with a Settings router-link),
  `messaging-defaults-panel` absent; messaging ON → notice absent, defaults present.
- Existing "HIDES the history card when messaging is OFF" stays valid (history
  still gated on the kill-switch).

## Non-goals

- No change to the kill-switch semantics, the send/compose flow, or the history gate.
- Viewers still never see the Messages tab (editor-gated).
