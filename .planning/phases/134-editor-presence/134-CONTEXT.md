# Phase 134: Editor Presence - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — technical approach inlined from `.planning/research/` (STACK/ARCHITECTURE/PITFALLS) + the Phase 133 confirmations-subcollection precedent just shipped. No separate phase-research pass (presence was fully covered by the milestone research).

<domain>
## Phase Boundary

While a user is viewing/editing a service, other viewers of the SAME service see who else is currently
present — cheaply, safely, and self-cleaning. Requirements: R422 (the presence indicator: Firestore
heartbeat + client soft-TTL staleness + correct teardown), R423 (org-scoped presence subcollection with
get/list-split rules + a cleanup backstop + a forced-disconnect test).

Security-relevant: a new per-service presence subcollection. It must be org-scoped so it can NEVER become a
smaller replay of the v2.8 SEC-S-01 cross-tenant read leak.
</domain>

<decisions>
## Implementation Decisions (technical approach — locked per milestone research)

### Storage (R422/R423)
- **A new subcollection `organizations/{orgId}/services/{serviceId}/presence/{uid}`** — one doc per viewer,
  doc id = the viewer's auth uid. Mirrors the just-shipped `confirmations` subcollection and the existing
  `lockSnapshots`/`messages` subcollections. Firestore-ONLY (no Realtime Database — the app is deliberately
  Firestore-only through 13 milestones).
- Each presence doc carries: `uid`, a denormalized `displayName` (so readers don't need a user-doc read),
  and `lastSeen: serverTimestamp()`. Keep the field set tight (allowlist in the write rule).

### Heartbeat + staleness (R422)
- A `useServicePresence` composable (NOT a Pinia store) writes/refreshes the current user's presence doc on
  a **coarse heartbeat (~25–30s)**, PAUSED while the tab is hidden (Page Visibility) to save writes — this
  is the v1.8 cost-hardening discipline (no uncapped recurring writes). It subscribes to the presence
  subcollection via `onSnapshot` for live "who's here".
- **Staleness is a CLIENT-SIDE filter (~60s):** a presence doc older than ~60s is treated as gone in the UI.
  This is the real-time correctness mechanism — Firestore has NO `onDisconnect()` (that's RTDB-only), so a
  crashed/closed tab leaves a stale doc; the client staleness filter hides it immediately, and the cleanup
  cron (below) removes it eventually.
- **Teardown uses `watch(serviceId, …)`** (immediate) plus `onUnmounted` — because Vue Router REUSES the
  mounted `ServiceEditorView` instance across service→service navigation, so `onUnmounted` alone does not
  fire on a param change. On teardown, delete the current user's presence doc (best-effort) and unsubscribe.

### Cleanup backstop (R423)
- A `cleanupStalePresence` scheduled cron sibling in `functions/src/cleanupSweeps.ts` (mirroring
  `cleanupExpiredMedia`/`cleanupOrphanRenders` — `onSchedule` + a `*_CLEANUP_ENABLED` gate, **dry-run by
  default** until the owner enables it), removing presence docs older than a threshold. Firestore TTL policy
  MAY also be configured out-of-band (gcloud/console) as a secondary backstop, but the cron + client
  staleness are the primary mechanisms; TTL is ~24h-latency, never the real-time signal.

### Security rules (R423 — LOAD-BEARING)
- **Read:** `allow get, list: if isOrgMember(orgId)` — org-scoped, matching the confirmations rule idiom
  (rules:321) and lockSnapshots (rules:257). NEVER `allow read: if true` or an unscoped `isSignedIn()`. The
  get/list split lets the plan add an explicit cross-org DENY list test.
- **Write:** an org member may write/delete ONLY their own presence doc — `isOrgMember(orgId) && <docId> ==
  request.auth.uid` — with a tight field allowlist (uid/displayName/lastSeen) and `uid == request.auth.uid`.
  Cannot write another user's doc, another org (cross-tenant), or any other service field.
- **Tests (R423):** a rules ALLOW/DENY set including: own-doc write ALLOW; other-user's-doc write DENY;
  cross-org read DENY (the SEC-S-01 guard); cross-org write DENY; non-member read/write DENY. Plus a
  **forced-disconnect test** proving stale presence clears via the client staleness filter (component test
  with a fake clock/onSnapshot), not just the happy-path unmount.

### Claude's Discretion
- Exact heartbeat interval (25 vs 30s) and staleness window (45–60s) within the research-recommended range.
- Presence indicator UI treatment (avatar stack / dot + name list) in the ServiceEditorView header, matching
  the app's dark gray-950 language.
- Whether the cleanup threshold is a fixed constant or an app-config knob (prefer reusing the existing
  cleanup-config pattern if cheap).
</decisions>

<code_context>
## Existing Code Insights (verified landmarks)

### Reusable Assets / Precedents
- **Subcollection rules precedent:** `firestore.rules` — `lockSnapshots` (`allow read: if isOrgMember`,
  editor write, ~line 256) and the Phase 133 `confirmations` block (`allow get, list: if isOrgMember(orgId)
  || isAssignedVolunteer()`, ~line 321) — presence read uses the same org-scoped get/list idiom.
- **Cleanup cron precedent:** `functions/src/cleanupSweeps.ts` — `cleanupExpiredMedia`/`cleanupOrphanRenders`
  (`onSchedule` + `*_CLEANUP_ENABLED` gate, dry-run default). `cleanupStalePresence` is a sibling here.
- **Live subscribe/teardown discipline:** `src/stores/mySchedule.ts` (onSnapshot subscribe/teardown) and the
  Phase 133 ServiceEditorView `confirmations` onSnapshot just added — mirror for the presence subscription.
- **Host surface:** `src/views/ServiceEditorView.vue` (the editor header — where the presence indicator
  renders; note the reused-instance-across-serviceId gotcha).

### Integration Points
- ServiceEditorView editor header (indicator + composable mount); firestore.rules (presence match block);
  functions/src/cleanupSweeps.ts (+ re-export from functions/src/index.ts — a NEW function MUST be
  re-exported from index.ts or `firebase deploy` misses it, per the project's known pitfall).
</code_context>

<specifics>
## Specific Ideas

Presence is the CHEAPER, simpler sibling of Phase 133's confirmations subcollection: own-doc write, org
read, heartbeat + client staleness, cleanup cron. The single load-bearing risk is the read rule staying
org-scoped (no SEC-S-01 replay) and the write staying own-doc-only. Cost discipline (coarse heartbeat,
paused-when-hidden) matters — this is a Blaze app with active cost hardening.
</specifics>

<deferred>
## Deferred Ideas

The dashboard editor-presence ROLL-UP (R418) is Phase 135, not here — but 135 reuses this phase's presence
data, so keep the presence read shape reusable. No cursor/field-level live-collaboration (out of scope —
this is a coarse "who's here" indicator only).
</deferred>
