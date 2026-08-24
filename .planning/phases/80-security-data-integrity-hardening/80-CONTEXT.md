# Phase 80: Security & Data-Integrity Hardening - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas auto-accepted from the v2.2 standing grant + milestone research; no interactive Q&A per owner grant)

<domain>
## Phase Boundary

Close five known security/data-integrity gaps: (R232) restrict `inviteLookup` creation to the target org's
editor; (R233) make an org's `createdBy` immutable after creation; (R234) revoke a service's public share
artifacts on delete; (R235) clear a removed song's slides even when the song is reprised; (R236) guard the
edit UI against customizing a deck slide whose render is still pending.

Predominantly a security-rules + data-logic phase with ONE small UI element (the R236 pending-slide warning).
The UI element's contract is fully locked below, so no separate UI-SPEC is needed — plan with `--skip-ui`.
</domain>

<decisions>
## Implementation Decisions

### R232 — inviteLookup create gate (firestore.rules; DEPLOY HAND-OVER)
- Change `match /inviteLookup/{email}` `allow create` from `if isSignedIn()` to
  `if isSignedIn() && isOrgEditor(request.resource.data.orgId)` — mirror the `orgSlugs`/`orgNames` create
  gate. The payload ALREADY carries `orgId` (`TeamView.vue onInvite()` writes it in the same batch as the
  invite doc) → NO client code change needed.
- `assignOrgAdmin` (Cloud Function, Admin SDK) bypasses rules → unaffected.
- Leave `allow read`/`allow delete` unchanged (the first-login acceptance flow in `auth.ts` reads then
  deletes its own invite by email — must keep working).
- Tests (emulator, `src/rules.test.ts`): ALLOW an editor of the target org creating an invite; DENY a
  signed-in non-editor and DENY a mismatched-orgId payload; a regression asserting the invite → first-login
  read+delete acceptance path still passes (RESEARCH: trace all three actors — do not just add a DENY case).

### R233 — createdBy immutability (firestore.rules; DEPLOY HAND-OVER)
- On `organizations/{orgId}` `allow update`, forbid changing `createdBy`. Extend the existing guard using the
  `diff().affectedKeys()` pattern (the milestone research confirmed `preservesLifecycleFields()` guards 5
  named lifecycle fields but NOT `createdBy`) — add `createdBy` to the immutable-on-update set (a companion
  helper or extend the existing one; keep the lifecycle guard intact).
- Tests: DENY an editor `updateDoc` that changes `createdBy`; ALLOW a normal edit that leaves it unchanged.

### R234 — deleteService share revocation (client-only; NO rules change)
- In `deleteService` (`src/stores/services.ts`), revoke ALL of the service's public share artifacts. Unlike
  `deleteQuarter` (single denormalized `shareToken` field), a service can accumulate MULTIPLE — so use
  QUERY-based deletion, not a single-doc delete:
  - `shareTokens` where the token targets this service (query by serviceId — see `pickAdoptableToken`'s query
    shape),
  - `serviceShareLinks/{serviceId}` (direct-keyed identity doc),
  - `serviceShares/{slug}__service-{date}` (keyed by the service's slug+date).
  Reuse the `deleteQuarter` revocation structure but adapt to these key shapes (ARCHITECTURE.md documented the
  exact keys via `ensureShareLink`/`writeSharePayload`).
- `allow delete` rules for all three collections are already in place → NO rules change.
- Test: unit — `deleteService` deletes every one of the three artifact types (incl. the multi-`shareTokens`
  case); a leftover token no longer resolves.

### R235 — clear slides on song removal, reprise-safe (client-only)
- Removing a song from a service must clear THAT song's slides even when the same song is reprised elsewhere
  in the same service (backlog 999.2). Find where slide-clearing happens on song removal and fix the reprise
  case so it clears only the removed occurrence's slides (or all occurrences correctly), never orphaning
  slides. Do not mis-attach across reprises.
- Test: removing a reprised song leaves no orphaned slides and does not wrongly clear an unrelated occurrence.

### R236 — pending-render edit guard (client-only, the one UI element — LOCKED)
- `EditSlideDrawer.vue` already has access to the slide's `renderState?: 'pending' | 'failed'` (type exists;
  the component just never reads it). When `renderState === 'pending'`, show an inline **amber** notice and
  disable the per-entry customization controls (or block Save) so a change can't be silently discarded when
  the render flips pending→ready.
- Copy (locked): **"This slide is still rendering. Wait until it's ready before customizing — changes made
  now would be lost when the render finishes."** Amber inline banner reusing the app's existing amber-notice
  styling (same tone as the lock banner), `aria-live="polite"`. Not a modal, not a toast.
- Test: component test — a `pending` renderState renders the notice and disables/blocks customization; a
  `ready` (undefined) slide behaves exactly as today.

### Deploy discipline (standing grant)
- R232 + R233 are `firestore.rules` changes → ship BUILT + TESTED + **UNDEPLOYED**, with the exact
  `firebase deploy --only firestore:rules` command handed to the owner (recorded in PENDING-VERIFICATION.md).
- R234, R235, R236 are client-only — no deploy.

### Claude's Discretion
- Whether R233 extends `preservesLifecycleFields()` or adds a sibling helper; the exact query for the
  service's `shareTokens`; the precise disabled-vs-blocked treatment for R236 (either satisfies the SC).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / Integration Points
- `firestore.rules`: `inviteLookup` (~:467), the `orgSlugs`/`orgNames` create-gate pattern to mirror, the
  `organizations/{orgId}` update rule + `preservesLifecycleFields()`.
- `src/views/TeamView.vue` `onInvite()` — already writes `orgId` onto the inviteLookup payload (no change).
- `src/stores/auth.ts` — the invite→first-login read+delete acceptance path (must keep passing).
- `src/stores/services.ts` `deleteService` + `src/stores/quarters.ts` `deleteQuarter` (the revocation
  precedent) + the service share-write paths (`ensureShareLink`, `writeSharePayload`).
- `src/components/EditSlideDrawer.vue` + the slide `renderState` field in `src/types/*`.
- Rules tests: `src/rules.test.ts` (emulator; run via `npm run test:rules` or against a running emulator).

### Established Patterns
- Per-collection ALLOW/DENY emulator tests for every rules change (project discipline).
- Deploy-hand-over: rules ship UNDEPLOYED with the exact deploy command.
</code_context>

<specifics>
## Specific Ideas
- 999.11 is ~2 findings after all: the self-invite gate (R232) AND the createdBy immutability (R233) — the
  milestone research confirmed `createdBy` is still genuinely unprotected post-v2.1.
- Full detail lives in `PENDING-VERIFICATION.md` (C2/C5) and `.planning/research/ARCHITECTURE.md`/`PITFALLS.md`.
</specifics>

<deferred>
## Deferred Ideas
- Moving org membership / invite authority onto custom claims (broader auth-model change) — out of scope.
- Any change to the `services`/`slideGroups` rules (excluded from the generic per-org wildcard) — not needed
  for these five gaps.
</deferred>
