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

### Auto Share-Link (R421)
- **Trigger point:** call the existing, already-idempotent `ensureShareLink(service, orgId)` from
  `markAsPlanned()` in `src/stores/services.ts`, mirroring the existing fail-closed, try/catch-wrapped
  `rehearseAccess` side-write already in that function. Do NOT change `maybeRefreshShareLink()`
  (auto-refresh-only-if-exists) — that is intentionally restricted and is the wrong hook.
- **Gate:** generation is strictly gated to the Planned/lock transition. A Draft (unlocked) service never
  gets a share link created — this preserves the one manual "I'm ready to show this" signal and avoids
  exposing an unfinished plan via a guessable URL (PITFALL 3 / the v2.8 SEC-S-01 share-token history).
- **Idempotency:** rely on `ensureShareLink()`'s existing idempotency so lock → unlock → relock never
  creates a duplicate token. No new token format, no change to share security rules.
- **Failure handling:** the side-write is best-effort/fail-closed (try/catch) exactly like `rehearseAccess`
  — a share-link failure must not block the Planned transition itself.

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
entirely in the guards (no Draft exposure, no duplicate token, no clobber on re-run), so those are
first-class test/acceptance targets, not happy-path afterthoughts.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>
