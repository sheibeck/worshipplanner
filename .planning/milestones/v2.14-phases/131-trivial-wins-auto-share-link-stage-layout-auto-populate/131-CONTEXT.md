# Phase 131: Trivial Wins — Auto Share-Link & Stage Layout Auto-Populate - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — decisions grounded in `.planning/research/ARCHITECTURE.md` + `PITFALLS.md`

<domain>
## Phase Boundary

Two small, self-contained integration features with zero new schema:
1. **Auto-generated share link** — a service's share link exists automatically at the Planned/lock
   transition, so the user never clicks "Share Link" manually (R421).
2. **Stage Layout auto-populate** — a service's Stage Layout seeds itself once from the roster's assigned
   roles/instruments on first visit to an empty canvas (R420).

This phase does NOT touch presence, the dashboard, confirmation, or the Video output. It deliberately
ships first to de-risk the milestone with the smallest review surface.
</domain>

<decisions>
## Implementation Decisions

### Auto Share-Link (R421) — RESOLVED 2026-09-07 (owner decision after planner surfaced a conflict)

**Root cause of the owner's symptom, confirmed in code:** `createService()` in `src/stores/services.ts`
ALREADY mints a share link at creation (added 2026-08-17 so volunteer-message `{{service_link}}` is never
empty), so real UI-created services already have a link automatically. The owner's "link isn't
auto-generated unless I click Share Link" symptom comes from **seeded test data**:
`functions/seed-emulator-data.mjs:406` writes the seeded service with `shareToken: null`, bypassing
`createService()`. So there is NO app bug for real services — the gap is tokenless services (seeded data,
or any service created before the 2026-08-17 mint).

**Resolved scope (owner chose "Safety-net + fix seed"):**
- **KEEP** the existing `createService()` mint-at-creation — do NOT remove it (removing it regresses the
  2026-08-17 empty-`{{service_link}}` fix for volunteer messaging composed before lock).
- **ADD an idempotent "ensure share link exists" safety net** so any tokenless service self-heals
  automatically (no manual "Share Link" click). Use the existing idempotent `ensureShareLink(service, orgId)`
  (NOT `maybeRefreshShareLink()`), called from a natural read/lifecycle point — opening a service and/or
  `markAsPlanned()` — wrapped fail-closed (try/catch) exactly like the existing `rehearseAccess` side-write
  so a failure never blocks the user. Idempotency guarantees no duplicate token on repeat (lock→unlock→relock
  included). Planner chooses the precise hook point(s); "on service open if token missing" is the primary
  self-heal, and `markAsPlanned` is a fine additional safety point.
- **FIX the seed script** (`functions/seed-emulator-data.mjs`) so seeded services get a real share token
  (mint one in the seed, or leave it tokenless deliberately and rely on the app's self-heal — but the owner
  asked to fix the seed, so give seeded services a token so test data matches real data).
- **DROP the "no Draft exposure / gate-to-Planned" constraint.** Drafts already carry a share link today
  (intentionally, for `{{service_link}}`), and `ShareView.vue` renders any token regardless of status;
  My Schedule / Rehearse already gate on Planned (v2.12). This phase does NOT change draft-sharing behavior
  and does NOT add a ShareView status gate.

### Stage Layout Auto-Populate (R420)
- **Input:** the already-computed `stageServingAssignments` (resolved roster/role data) read in
  `ServiceEditorView.vue`; add a pure `autoPopulateMarkers()` function in `src/utils/stageLayout.ts` that
  maps those assignments to stage markers.
- **Trigger:** one-time seed — fires only when the Stage Layout tab first becomes active for a service
  whose canvas has **zero** elements. Never runs against a non-empty canvas.
- **Non-clobber invariant (load-bearing):** auto-populate must NEVER regenerate, wipe, re-order, or
  duplicate markers on re-run — not on reload, not on a later roster change, not on tab re-visit. Roster
  changes right up until lock, so the common case is "canvas already has manual placements"; that case is
  strictly left alone (PITFALL 4).
- **Identity:** seeded markers key on stable assignment identity so a later manual edit is distinguishable
  from a fresh seed.

### Claude's Discretion
- Exact marker geometry/default placement of seeded instruments on the canvas (reasonable default layout;
  the user rearranges freely afterward).
- Whether the "zero elements" check keys on marker count or a dedicated "seeded" flag — planner's choice,
  as long as the non-clobber invariant holds.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ensureShareLink()` + `maybeRefreshShareLink()` in `src/stores/services.ts` (share-link minting; the
  former is idempotent and is the one to reuse).
- `markAsPlanned()` in `src/stores/services.ts` — already performs a fail-closed `rehearseAccess`
  side-write; the auto-share-link call slots into the same pattern.
- `stageServingAssignments` computed in `ServiceEditorView.vue`; `src/utils/stageLayout.ts` marker/geometry
  helpers; `StageLayoutEditor.vue` (v2.7) marker model.

### Established Patterns
- Fail-closed try/catch side-writes on the Planned transition (rehearseAccess precedent).
- Stage markers persisted to Firestore on the service doc (v2.7).

### Integration Points
- `markAsPlanned()` (share-link generation) and the Stage Layout tab activation path (auto-populate seed).
</code_context>

<specifics>
## Specific Ideas

Reuse over invent — both features are a single call site / one pure function plus a guard. The risk is
entirely in the guards: for R421, **idempotency** (no duplicate token on self-heal / repeat locks) and
**fail-closed** (a share-link failure never blocks service open or the Planned transition); for R420,
**no clobber on re-run** (never regenerate/wipe/duplicate against a non-empty canvas). Those are first-class
test/acceptance targets. Note the R421 "no Draft exposure" guard was REMOVED by owner decision (2026-09-07)
— drafts keep their link as today.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>
