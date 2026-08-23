# Phase 76: Church Deactivation & Reactivation - Context

**Gathered:** 2026-08-22
**Status:** Ready for research → planning
**Mode:** Auto-generated (autonomous smart-discuss). Settled decisions below; ONE security-critical grey area (Storage-rules enforcement) is deferred to research (§research_question) because a wrong guess would be unsafe.

<domain>
## Phase Boundary

A super-admin can deactivate a church (reversible off-switch) and reactivate it. A deactivated org blocks
ALL its ordinary members from using it — enforced at the client sign-in/org-load AND independently at
`firestore.rules` and `storage.rules` — while a super-admin retains full access. Requirements R212-R214.
Sequenced before Phase 77 (delete is gated on deactivated) and Phase 78 (its super-admin rules arm composes
on this phase's rules change).

</domain>

<decisions>
## Implementation Decisions

### Status model (SC1)
- Persist on `organizations/{orgId}`: `active: false` + `deactivatedAt` (serverTimestamp) + `deactivatedBy`
  (caller uid). ABSENT or `active: true` == active (backward-compatible: every existing org has no `active`
  field and must read as active).
- Reactivate sets `active: true` (and may clear/keep `deactivatedAt` for history — keep as `reactivatedAt`
  provenance; don't delete the audit trail).

### Callable (SC1, R212)
- A super-admin-gated callable flips the status — reuse the `orgProvisioning.ts` pattern:
  `assertSuperAdminCaller` first (re-verifies `superAdmin` claim + re-reads `superAdmins/{callerUid}`), then
  writes the org status. Prefer ONE callable `setOrgActive({ orgId, active })` (or a deactivate/reactivate
  pair — planner's choice) so the client never writes another org's status directly.
- The callable must ALSO perform whatever claim/side-effect the Storage-enforcement mechanism requires (see
  research question) so deactivation takes effect for Storage, and reactivation fully reverses it with no
  manual per-user fix-up (SC4/R214).

### Client login-block (SC2, R213)
- In `src/stores/auth.ts` org-load (`loadOrgContext`/`ensureUserDocument` / the church picker), a member
  whose active/selected org is deactivated is NOT entered — surfaced as a clear "This church is deactivated
  — contact your administrator" message, never a blank app or silent failure. For a multi-org user, a
  deactivated org should be visibly unavailable in the picker (disabled/labeled), not silently dropped.
- A super-admin is exempt (they can still enter a deactivated org — SC "fully accessible to a super-admin").

### firestore.rules (SC3, R213)
- Add an `isOrgActive(orgId)` helper = `get(/organizations/$(orgId)).data.get('active', true) == true`
  (cross-document `get()` is valid in firestore.rules; default-true so legacy orgs stay active). AND it into
  org-scoped member/editor access, EXEMPTING super-admins: effectively
  `isOrgMember(orgId) && (isOrgActive(orgId) || isSuperAdmin())` (and the editor equivalent). `isSuperAdmin()`
  already exists (v1.9, claim-based) — no Phase 78 dependency for the exemption.
- Must not regress the existing rules; carry genuine emulator ALLOW (active-org member, and super-admin on a
  deactivated org) + DENY (deactivated-org member) tests.

### Claude's Discretion
- One `setOrgActive` callable vs. a deactivate/reactivate pair; exact deactivated-message copy; whether the
  picker greys out vs. hides a deactivated org (prefer greyed-out + labeled so the user understands why).

</decisions>

<research_question>
## OPEN — resolve in RESEARCH.md before planning

**How does `storage.rules` independently deny a deactivated org's members (SC3) given it CANNOT read the
org's `active` field?** Cross-service `firestore.get()/exists()` is inert in the Storage service/emulator
(firebase-js-sdk#6803 — documented in CLAUDE.md; it is why `storage.rules` already relies on the
`isOrgMemberByClaim` token-claim check, not a Firestore read). So Storage enforcement must flow through the
**custom auth claim**, updated by the deactivate/reactivate callable. Evaluate and recommend:

1. **Exclude deactivated orgs from the `orgs` claim** — have the Phase-73 claim computation
   (`orgMembershipClaims.ts` `computeOrgsClaimForUid`/`buildOrgsMapClaim`) skip orgs whose `active === false`,
   and have the deactivate/reactivate callable trigger a claim recompute for all affected members.
   `storage.rules isOrgMemberByClaim` then denies naturally (org absent from claim). Reactivate recomputes.
   — Assess: correctness, interaction with the multi-org `orgs` map + legacy single-org arm, and the
   member-fan-out cost of recomputing every member's claim on deactivate/reactivate.
2. **A `deactivatedOrgs` claim key** the `storage.rules` arm checks (deny if requested `orgId` ∈
   `token.deactivatedOrgs`), leaving the `orgs` map intact. — Assess vs. option 1.
3. Super-admin exemption in `storage.rules` (easy: `request.auth.token.superAdmin == true`) — confirm it
   composes with whichever option above.

Deliverable: a recommended mechanism with a concrete `storage.rules` shape + the exact claim side-effect the
callable performs on deactivate AND on reactivate (must fully reverse, no manual per-user fix-up — R214),
the token-propagation implication (a member's already-issued token stays valid up to ~1h — document, and
note the client login-block is the immediate layer while the claim propagates), and the emulator
ALLOW/DENY tests needed. Also confirm the firestore.rules `isOrgActive` get()-based approach above is sound.
</research_question>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/orgProvisioning.ts` — `assertSuperAdminCaller` (super-admin gate), the callable pattern.
- `functions/src/orgMembershipClaims.ts` — the Phase-73 claim-writer (`computeOrgsClaimForUid`,
  `buildOrgsMapClaim`, `mergeAndSetCustomClaims`, `mergeSetAndClearCustomClaims`) — the hook point for any
  claim-based Storage enforcement.
- `functions/src/claimsHelpers.ts` — merge-preserving claim helpers.
- `functions/src/backfillOrgClaims.ts` — precedent for iterating members and recomputing claims.
- `firestore.rules` — `isOrgMember`, `isOrgEditor`, `isSuperAdmin` helpers (extend with `isOrgActive`).
- `storage.rules` — `isOrgMemberByClaim` (the claim-based Storage membership check to compose with).
- `src/stores/auth.ts` — `loadOrgContext` / church picker / `memberships` (the client login-block point).
- `src/components/admin/OrganizationsTab.vue` — the Organizations rows (add the Deactivate/Reactivate control).

### Established Patterns
- Super-admin-gated callables re-verify the caller; the claim is the sole Storage-membership authority
  (v1.5 D-01/D-04); rules changes ship UNDEPLOYED with genuine emulator ALLOW+DENY tests.

### Integration Points
- Server: new callable(s) in `orgProvisioning.ts` (or a new module) + the claim side-effect in
  `orgMembershipClaims.ts`. Rules: `firestore.rules` + `storage.rules`. Client: `auth.ts` login-block +
  `OrganizationsTab.vue` control.

</code_context>

<specifics>
## Specific Ideas

Owner's words: "de-activating a church just prevents anyone from logging in"; deactivate is the guardrail
that must precede deletion (Phase 77); a super-admin can still get in (that's what Phase 78's enter-any-
church builds on).

</specifics>

<deferred>
## Deferred Ideas

- Auto-purge / scheduled deletion of long-deactivated orgs; a soft-trash restore window — future scope.
- Notifying a deactivated org's members by email — out of scope.

</deferred>
