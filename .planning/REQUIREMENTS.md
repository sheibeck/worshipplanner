# Requirements — v2.0 Multi-Church Onboarding & Owner Console Tabs

**Milestone goal:** Turn the owner console into a tabbed shell and add platform-level multi-tenancy
management — onboard new churches and assign their first admin from one place — while closing the multi-org
Storage auth-claim gap that onboarding a second-org admin would otherwise trip.

**Scoping decisions (owner, 2026-08-21):** v2.0 major · **stacks on v1.9** (code-complete; its deploy + UAT +
milestone-complete remain parked with the owner) · a church admin **reuses the existing editor role** (no new
role/claim) · onboarding creates org record + default `OrgSettings` + **seeds the default service template** +
**assigns the first admin by email** · backlog **999.5** (multi-org Storage auth claim) **pulled into scope** as
a hard prerequisite · milestone-level research skipped (all patterns already exist in-repo) · run autonomous
with human verification deferred to the end.

**Deploy policy (carried from the standing grant):** every auth-claim / `firestore.rules` / `storage.rules` /
new org-provisioning-callable change ships **built + tested + UNDEPLOYED**, with the exact
`firebase deploy --only …` command and any owner-run backfill script handed over. `RESEND_API_KEY` and all
secrets stay server-side.

REQ-IDs continue from v1.9 (last R192).

---

## v2.0 Requirements

### Owner console tabs

- [x] **R193**: The Owner Console presents its content as two tabs — **Configuration** and **Organizations** —
      with Configuration selected by default, both behind the existing super-admin access gate (R177/R178) so
      no new access surface is introduced.

- [x] **R194**: The Configuration tab contains, with **no behavior change**, the existing super-admins roster
      (grant/revoke via `setSuperAdminClaim`) and the four platform-config cards plus the deploy-time note —
      i.e. the entire current `OwnerConsoleView` body, relocated under a tab.

- [x] **R195**: The open tab survives a page refresh and is directly linkable (reflected in the route/query),
      so a super-admin can bookmark or share a link straight to Organizations.

### Organizations — list & onboard

- [ ] **R196**: The Organizations tab lists every organization on the platform, showing at least each church's
      name and a distinguishing detail (id and/or created date and/or member count), so the super-admin sees
      all churches at a glance.

- [ ] **R197**: A super-admin can onboard a new organization by entering a church name, which creates the
      `organizations/{orgId}` record with default `OrgSettings` deep-merged from the code defaults (identical
      to a normally-created org's settings).

- [ ] **R198**: Onboarding seeds the new org's default service template (`OrgSettings.defaultServiceTemplate`)
      so the church can create a service immediately, without any manual template setup.

- [ ] **R199**: Onboarding assigns the church's first admin by email at **editor** tier as part of the same
      flow, so a freshly-onboarded church has exactly one editor who can sign in and use it.

- [ ] **R200**: Org creation/onboarding runs entirely through a **super-admin-gated server callable** — the
      client never writes `organizations/*`, `orgNames/*`, or another org's `members/*` directly — the callable
      independently re-verifies the caller's `superAdmin` claim server-side.

- [ ] **R201**: Church-name uniqueness is enforced via the existing create-only `orgNames` registry (v1.7
      R160), so onboarding cannot create a duplicate church name and reports the collision clearly.

- [ ] **R202**: A failed onboarding step (name taken, invalid/unknown admin email, write error) surfaces a
      clear error and does not strand a half-created org — the flow is ordered/idempotent so a retry after
      fixing the input succeeds without manual cleanup.

### Church-admin assignment (reuse editor role)

- [ ] **R203**: A super-admin can assign a church admin by email — the target becomes an
      `organizations/{orgId}/members/{uid}` member at the **editor** role, reusing the existing editor/viewer
      RBAC with **no new role or claim type**.

- [ ] **R204**: Admin assignment goes through the super-admin-gated membership callable that resolves the email
      to a user, writes the membership, and syncs the org-membership custom claim — the client never writes
      another org's `members/*` directly.

- [ ] **R205**: Assigning an admin whose email has no existing account is handled gracefully — a clear
      "no account for that email" result (or the app's existing invite path), never a silent failure or a
      dangling membership doc.

- [ ] **R206**: Assigning an admin to an org for a user who **already belongs to another org** preserves the
      user's existing memberships and roles — the new membership is additive, never an overwrite (depends on
      the widened claim below).

### Multi-org Storage auth claim (backlog 999.5)

- [x] **R207**: The org-membership custom auth claim carries **all** of a user's organizations and their
      per-org roles (not just the primary org), in a shape both `firestore.rules` and `storage.rules` can read.

- [x] **R208**: The claim-writer that recomputes the claim on any `members/*` write derives the full multi-org
      set from the user's memberships and preserves the `superAdmin` claim via the shared merge helper (R175) —
      widening the claim never wipes super-admin, and vice-versa.

- [x] **R209**: `storage.rules`' `isOrgMemberByClaim` checks the requested `orgId` against the full multi-org
      claim set, so a user in multiple orgs retains Storage read/write on **every** org — proven by genuine
      multi-org ALLOW **and** cross-org DENY emulator tests.

- [x] **R210**: An idempotent, dry-run-by-default, owner-run backfill recomputes the widened claim for all
      existing users, mirroring `backfillOrgClaims.ts`, so current users get the new claim shape without a
      manual per-user step.

- [x] **R211**: The widened claim shape is backward-compatible during rollout — existing single-org sessions
      keep working before the backfill runs (old/new shapes both tolerated by the rules), so there is no
      Storage-access gap while the claim is being migrated.

---

## Future Requirements (deferred)

- Editing an existing org's name/settings, or suspending/archiving/deleting an org, from the console —
  this pass is list + onboard + assign-admin only.

- Multi-admin management UI (bulk assignment, per-org role changes, removing members) beyond assigning the
  first/additional editor by email.

- Self-service church signup — onboarding is super-admin-driven only this pass.

## Out of Scope

- **Billing / subscription management** — explicitly deferred again (was out of scope for v1.9 too); onboarding
  a church is free-of-charge provisioning only.

- **A distinct per-org "admin" role above editor** — a church admin *is* the existing editor role by owner
  decision; no new role tier or claim key is introduced.

- **Changing per-org RBAC semantics** — editor/viewer behavior is unchanged; only the *claim's org coverage*
  widens (999.5).

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R193 | Phase 72 | Complete |
| R194 | Phase 72 | Complete |
| R195 | Phase 72 | Complete |
| R196 | Phase 74 | Pending |
| R197 | Phase 74 | Pending |
| R198 | Phase 74 | Pending |
| R199 | Phase 74 | Pending |
| R200 | Phase 74 | Pending |
| R201 | Phase 74 | Pending |
| R202 | Phase 74 | Pending |
| R203 | Phase 74 | Pending |
| R204 | Phase 74 | Pending |
| R205 | Phase 74 | Pending |
| R206 | Phase 74 | Pending |
| R207 | Phase 73 | Complete |
| R208 | Phase 73 | Complete |
| R209 | Phase 73 | Complete |
| R210 | Phase 73 | Complete |
| R211 | Phase 73 | Complete |

**Coverage:** 19/19 v2.0 requirements mapped (R193–R211). No orphans, no duplicates.
