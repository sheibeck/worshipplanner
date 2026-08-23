# Requirements — v2.1 Organization Lifecycle & Super-Admin Access

**Milestone goal:** Give the super-admin full lifecycle control over churches from the Organizations tab —
deactivate, delete-with-full-cleanup, see pending invites, and drop into any church to help — without
leaking cross-tenant access to ordinary users.

**Scoping decisions (owner, 2026-08-22):** v2.1 minor · **stacks on v2.0** (code-complete; its deploy + UAT +
milestone-complete remain parked with the owner) · deactivate is a **reversible** off-switch that must be set
before an org can be **deleted** (deletion is irreversible + extra-confirmed) · a super-admin can **enter any
church** as a **hidden**, rules-granted participant (no member doc, invisible in the church's member list) ·
church **rename** and the **invite→first-login claim** flow already exist and are NOT re-scoped · built with
**gsd-autonomous**, human verification deferred to the end.

**Deploy policy (carried from the standing grant):** every auth-claim / `firestore.rules` / `storage.rules` /
new-callable change ships **built + tested + UNDEPLOYED**, with the exact `firebase deploy --only …` command
handed over. Features with destructive cascades (deletion) and privileged cross-tenant access (super-admin
enter-any-church) get a STRIDE threat model and genuine emulator ALLOW/DENY rules tests. `RESEND_API_KEY` and
all secrets stay server-side.

REQ-IDs continue from v2.0 (last R211).

---

## v2.1 Requirements

### Church deactivation

- [x] **R212**: A super-admin can deactivate an organization from the Organizations tab, persisting a
      deactivated status on the org record (e.g. `active: false` / `deactivatedAt` + `deactivatedBy`), via a
      super-admin-gated server callable — the client never flips another org's status directly.

- [x] **R213**: While an org is deactivated, all of its members are blocked from using it — enforced both in
      the client sign-in/org-load flow AND by `firestore.rules`/`storage.rules` (a deactivated org's members
      are denied org-scoped reads/writes) — surfaced as a clear "this church is deactivated" message, never a
      silent failure or a blank app. (Server half — `firestore.rules`/`storage.rules` — shipped in 76-01;
      client sign-in/org-load block remains, planned for 76-02.)

- [x] **R214**: A super-admin can reactivate a deactivated organization, restoring its members' normal
      access on their next load.

### Church deletion (deactivate-gated, full cascade)

- [x] **R215**: An organization can be deleted **only while it is deactivated** — a delete attempt on an
      active org is refused with a clear message (the deactivate-first requirement is the first delete
      guardrail).

- [x] **R216**: Deletion runs through a super-admin-gated server callable that independently re-verifies the
      caller's `superAdmin` claim; the client never bulk-deletes `organizations/*`, its subcollections,
      `orgNames/*`, or `inviteLookup/*` directly.

- [x] **R217**: Deleting an organization cascade-removes all of its Firestore data — the org doc and every
      subcollection (members, invites, services, songs, slideGroups, shareTokens/quarter shares,
      quarters/roster, and any other org subcollection) — leaving no orphaned documents under
      `organizations/{orgId}`.

- [x] **R218**: Deletion also removes the org's cross-collection references — `orgNames/{normalizedName}`,
      every `inviteLookup/{email}` pointing at the org, and the org's id from each member's
      `users/{uid}.orgIds` (via `arrayRemove`, preserving that user's other org memberships).

- [x] **R219**: Deletion removes all Cloud Storage objects under the org's path (`orgs/{orgId}/…` — media,
      backgrounds, pptx-imports, rendered), leaving no orphaned files.

- [ ] **R220**: Deleting requires an explicit extra confirmation (e.g. typing the church name) that echoes
      what will be destroyed, and the action is clearly labeled irreversible; a mistaken click cannot delete
      an org.

- [x] **R221**: A partial/interrupted deletion can be safely retried and completes without leaving
      cross-tenant orphans (idempotent/resumable, batched cleanup), returning a clear summary of what was
      removed.

### Pending-invite visibility

- [x] **R222**: The Organizations list distinguishes, per org, members who have logged in (active) from
      people who were invited but have never logged in ("pending login"), so an onboarded-but-unclaimed
      admin is visible rather than the church reading as "0 members".

- [x] **R223**: The active-vs-pending breakdown is computed server-side (from the org's `members` +
      `invites`) by the existing super-admin-gated `listOrganizations` callable — no direct client cross-org
      reads are introduced.

### Super-admin "enter any church"

- [ ] **R224**: Each Organizations row has a "Sign in" / "Enter church" action that switches the
      super-admin's active org context to that church for support/setup.

- [ ] **R225**: A super-admin can read and write a church's Firestore data and Storage **without** a
      membership document, via a super-admin arm added to `firestore.rules` and `storage.rules` — proven by
      genuine emulator tests: ALLOW for a super-admin on any org, and continued DENY for a non-member
      non-super-admin.

- [ ] **R226**: A super-admin operating inside a church does **not** appear in that church's member/team
      list or member count — no member doc is created for the super-admin, and the team list excludes any
      super-admin identity.

- [ ] **R227**: While a super-admin is viewing a church they do not belong to, the UI shows a persistent,
      clear "viewing as super-admin" indicator with a one-click way to exit back to the owner console.

---

## Future Requirements (deferred)

- An audit log of super-admin actions (deactivate/reactivate/delete/enter-church) for accountability.
- Bulk lifecycle actions (deactivate/delete multiple orgs), scheduled/auto-purge of long-deactivated orgs,
  and a soft "trash" with a restore window before hard delete.

- Exporting/downloading an org's data before deletion.

## Out of Scope

- **Billing / subscription** lifecycle — unchanged; deactivation is an access switch, not a billing state.
- **Church rename** — already supported per-church in Settings (`editName` + `orgNames` uniqueness); not
  re-scoped here.

- **The invite → first-login "claim by email" flow** — already implemented and confirmed working; v2.1 only
  adds *visibility* of pending invites, not new claim mechanics.

- **Self-service church signup / deletion by church admins** — org lifecycle stays super-admin-only.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R212 | Phase 76 | Complete |
| R213 | Phase 76 | Complete |
| R214 | Phase 76 | Complete |
| R215 | Phase 77 | Complete |
| R216 | Phase 77 | Complete |
| R217 | Phase 77 | Complete |
| R218 | Phase 77 | Complete |
| R219 | Phase 77 | Complete |
| R220 | Phase 77 | Pending |
| R221 | Phase 77 | Complete |
| R222 | Phase 75 | Complete |
| R223 | Phase 75 | Complete |
| R224 | Phase 78 | Pending |
| R225 | Phase 78 | Pending |
| R226 | Phase 78 | Pending |
| R227 | Phase 78 | Pending |

**Coverage:** 16/16 v2.1 requirements (R212–R227) mapped — Phase 75 (R222-R223), Phase 76 (R212-R214), Phase 77 (R215-R221), Phase 78 (R224-R227). 100% coverage, no orphans, no duplicates.
