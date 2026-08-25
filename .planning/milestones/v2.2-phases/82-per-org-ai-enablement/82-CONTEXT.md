# Phase 82: Per-Org AI Enablement - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (owner testing-feedback item; grant defaults below, with the genuinely-open design questions handed to phase research)

<domain>
## Phase Boundary

Give a super-admin per-organization control over AI functionality from the Owner Console, defaulting AI
**OFF** for every org, and hide an org's AI settings panel whenever AI is disabled for it — forcing the
church's own AI state off if a super-admin disables it while the church had it on (R242, R243).
</domain>

<decisions>
## Implementation Decisions (grant defaults — research/plan may refine with evidence)

### Where the per-org AI flag lives + how a super-admin writes it
- A per-org **master gate** — a boolean on the org record (e.g. `organizations/{orgId}.aiEnabled`), ABSENT or
  false ⇒ AI **OFF** (default). Existing orgs have no field ⇒ AI off until a super-admin enables it
  (**migration note: Berean and any current AI user go dark until re-enabled — this is the owner's stated
  intent**).
- Written **only by a super-admin**. Reuse the established secure per-org super-admin write pattern — a
  super-admin-gated Cloud Function (mirror `setOrgActive`/`setSuperAdminClaim`: Admin-SDK write + two-check
  caller re-verification), NOT a client write — UNLESS research finds a cleaner existing seam. If a
  `firestore.rules` change is used instead, it ships built+tested+UNDEPLOYED with a `firebase deploy --only
  firestore:rules` hand-over.

### Two-layer behavior (master gate vs the church's own AI setting)
- The super-admin flag is the MASTER gate. The church's own AI usage/settings live in the org **Settings AI
  panel**. When the master gate is OFF: the Settings AI panel is **not rendered**, and any org-level AI-on
  state is treated as off (forced off). When the master gate is ON: the church sees/uses AI normally.
- Research must confirm whether a distinct org-editor-controlled "AI on" setting exists today or whether the
  "AI panel" is simply where the church configures/uses AI (in which case hiding it satisfies "turned off,
  then hidden"). Implement whichever matches the real Settings structure.

### Owner Console control
- Add a per-org AI on/off control in the **Organizations tab** as a per-row action (mirroring the existing
  per-row super-admin actions like deactivate/reactivate/assign) OR the Configuration tab if research shows
  that fits better. Reflect the current state and update it via the super-admin write path above.

### Server-side enforcement (recommended, confirm in plan)
- For real security (not just UI hiding), the AI proxy / AI call path should ALSO refuse when the org's
  master gate is off — so disabling AI truly disables it, not merely hides the panel. Research the AI call
  path (`claudeApi`, the AI proxy function, `appConfig.aiProxy`) and decide whether server gating is in scope
  or a fast-follow; at minimum the UI gating (R242/R243) must be delivered.

### Deploy discipline
- If the super-admin write is a Cloud Function and/or a rules change, those ship UNDEPLOYED with the exact
  deploy hand-over recorded in PENDING-VERIFICATION.md. Pure client-side gating (Settings panel v-if) needs
  no deploy.
</decisions>

<code_context>
## Existing Code Insights

### Integration Points (confirm/expand in research)
- Owner Console: `src/views/OwnerConsoleView.vue`, `src/components/admin/OrganizationsTab.vue` (per-row
  super-admin actions), the `setOrgActive`/`setSuperAdminClaim` callable pattern in `functions/src/index.ts`.
- Org record + settings: `src/types/organization.ts`, `src/stores/auth.ts` (`OrgSettings`, org record),
  `src/views/SettingsView.vue` (the AI panel to gate).
- AI call path: `src/utils/claudeApi.ts`, the AI proxy Cloud Function, `functions/src/appConfig.ts`
  (`aiProxy` — currently GLOBAL rate limits, not per-org enablement).

### Established Patterns
- Super-admin per-org writes go through super-admin-gated callables (Admin SDK), verified by rules
  ALLOW/DENY emulator tests.
- Per-org config already exists (`OrgSettings`, `vwModeEnabled` is a close precedent for a per-org feature
  toggle that gates UI visibility).
</code_context>

<specifics>
## Specific Ideas
- `vwModeEnabled` is the closest existing precedent for "a per-org boolean that hides/shows a settings-driven
  feature" — but note the KEY difference: `vwModeEnabled` is org-editor-controlled; the AI master gate is
  **super-admin-controlled**. Reuse the visibility-gating shape from `vwModeEnabled`, but the WRITE authority
  is super-admin, not the church.
</specifics>

<deferred>
## Deferred Ideas
- Per-org AI usage quotas/limits beyond on/off (the global `appConfig.aiProxy` rate limits already exist).
- Any AI-feature redesign — this phase only gates existing AI on/off per org.
</deferred>
