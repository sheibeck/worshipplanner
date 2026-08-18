# Phase 63: Messages Tab & Always-Visible History - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (v1.8 grant; grounded in the shipped v1.7 messaging surfaces in `ServiceEditorView.vue`)

<domain>
## Phase Boundary

A UI restructure of the per-service messaging surfaces in the Service Editor. Add a dedicated **Messages
tab**; move the per-service **"Messaging defaults"** panel and the **"Sent on this service"** delivery
history into it (out of the Service Order tab); and fix the history so it is **visible at all times**,
including when the service is locked.

Requirements: R149 (Messages tab hosts the defaults + history, moved out of Service Order), R150 (history
visible whether draft/locked/exported — no longer gated on `canEditService`).

Out of this phase: the composer (stays an action-bar modal, untouched here) and all composer-internal fixes
(labels, +Add someone, live preview, tokens, spinner, message types) → Phase 64.
</domain>

<decisions>
## Implementation Decisions

### New Messages tab (R149)
- `ServiceEditorView.vue` has a three-tab bar (`activeTab` ∈ `'service-order' | 'slides' | 'roles'`, tab
  buttons ~L690-731, panels via `v-show`). Add a fourth **"Messages"** tab button + a
  `v-show="activeTab === 'messages'"` panel.
- **Gating:** editor-only (like the Roles tab — `authStore.isEditor`) AND only shown when
  `isMessagingEnabled()` (a messaging-off org has no messaging surfaces; consistent with the composer's
  disabled ✉ entry). So the Messages tab button renders `v-if="authStore.isEditor && isMessagingEnabled()"`.
- **Move both panels into the new panel, unchanged in behavior:**
  - The **Messaging defaults** panel (`data-testid="messaging-defaults-panel"`, currently ~L844 in the
    service-order panel) — keep its Draft-editable / locked-read-only branch behavior exactly (58-05/62).
  - The **`ServiceMessageHistory`** component (currently mounted ~L908) — see R150.
- Tab order: **Service Order · Slides · Roles · Messages** (append Messages last; least disruption to the
  established order). Confirm placement in the UI-SPEC.

### History always visible (R150) — the real bug fix
- The history is mounted `v-if="isMessagingEnabled() && canEditService"` (`ServiceEditorView.vue:909`).
  `canEditService = isEditor && !isLocked`, so it DISAPPEARS the moment the service is locked — the Phase
  60 / 60-03 defect the owner hit. **Fix:** gate it `v-if="isMessagingEnabled() && authStore.isEditor"`
  (drop `canEditService`) so it shows for any org editor regardless of lock state. It is already read-only
  (Phase 60), so showing it on a locked service is safe. Now that it lives in the editor-gated + messaging-
  gated Messages tab, the tab's own `v-if` already covers `isEditor && isMessagingEnabled()`, so inside the
  panel the history can render unconditionally (or keep a defensive `isMessagingEnabled()` check).

### Empty / lock states
- The Messages tab shows both panels stacked (defaults on top, history below), matching their current
  vertical order. The defaults panel already renders a locked-read-only summary; the history already has
  its empty ("Nothing sent yet") / loading / bounce states (Phase 60). No new states invented — only the
  `canEditService` gate removed.

### Claude's Discretion
- Exact tab label ("Messages"), the tab button's active-styling (mirror the existing tab buttons), whether
  the two panels get a light section spacing inside the new tab, and whether to keep a defensive
  `isMessagingEnabled()` guard on the history inside the already-gated tab — implementer discretion.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/views/ServiceEditorView.vue` — tab bar (~L690-731), `activeTab` state, the service-order panel
  (`data-testid="service-order-panel"`, L734) currently containing both messaging panels; the
  messaging-defaults panel (~L844) and `ServiceMessageHistory` mount (~L908, the `canEditService` bug).
- `src/components/ServiceMessageHistory.vue` (Phase 60) — the read-only history; unchanged except its
  mount gate.
- `src/utils/messaging.ts::isMessagingEnabled()` — the kill-switch gate the tab uses.
- The Roles tab (`activeTab === 'roles'`, editor-only, ~L1398) — the exact analog for an editor-gated tab.

### Established Patterns
- Tab buttons toggle `activeTab`; panels use `v-show`/`v-if`; editor-only tabs gate the button on `isEditor`.
- Messaging surfaces gate on `isMessagingEnabled()`.

### Integration Points
- `ServiceEditorView.vue` only (tab button + new panel + moving two existing blocks + the R150 gate fix)
  and its test. No change to `ServiceMessageHistory.vue` internals or the messaging-defaults panel logic.
</code_context>

<specifics>
## Specific Ideas
- Pure relocation of two existing, already-tested panels + one gate fix (drop `canEditService`) — keep
  their internal behavior byte-for-byte; only their PARENT (which tab, which gate) changes.
- The history must survive a lock; that is the whole point of R150.
</specifics>

<deferred>
## Deferred Ideas
- All composer-internal fixes (team labels, +Add someone, live preview, tokens, spinner, message-type
  seeding) → Phase 64.
- Any "Sending… forever" → failed/timeout affordance in the history → Phase 64 (R155's history side).
</deferred>
