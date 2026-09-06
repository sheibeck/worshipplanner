# Requirements: WorshipPlanner — v2.13 Volunteer Self-Service & Multi-Church Access

**Defined:** 2026-09-06
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating
through the full song stable and respecting team configurations.
**Milestone goal:** Let volunteers obtain their own passwordless sign-in link on demand and see their
schedule organized by church — extending v2.12's account-level email-link access with a self-service
request path, an admin resend affordance, and a multi-church switcher.

> **Numbering:** continues the project's global `R###` scheme from v2.12 (which ended at R393).
> **Scope decisions (owner, 2026-09-06):** the magic link is **account-level** (one link = the person's
> whole schedule across every church they serve); the **church slug scopes only the request/branding and
> the roster check**, not what a volunteer sees after sign-in. A link is **only ever sent to an email
> already on that church's volunteer roster**. Admin resend offers **both email and copy**. The public
> self-service endpoint is **security-gated** (enumeration-safe + rate-limited + roster-gated) — it is a
> public, unauthenticated email-sending endpoint. **No project-research pass** — all patterns exist in
> the codebase (v2.11/v2.12 + the messaging/Resend infra). Prod caveat: Resend is still test-mode until
> DNS domain verification (backlog 999.6); the copy path sidesteps email entirely.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Self-Service Magic-Link Request

- [x] **R394**: A volunteer can open a public, church-scoped page at `/{church-slug}/volunteer` that
  resolves the slug to a church via the public `orgSlugs` registry, shows the church's name, and offers to
  send their sign-in link by entering their email address. An unknown/expired slug shows a clear "church
  not found" state rather than a broken page.

- [x] **R395**: Requesting a link is **enumeration-safe** — the page shows the same confirmation ("If
  you're on this church's team, a sign-in link is on its way") whether or not the entered email is on the
  roster, never revealing whether a given email is a member.

- [ ] **R396**: A sign-in link is sent **only** to an email already present on **that specific church's**
  volunteer roster (`organizations/{orgId}/people`). A non-roster email produces no email (but the same
  enumeration-safe confirmation). The link is minted server-side (Admin SDK) and delivered via Resend.

- [ ] **R397**: The self-service request endpoint is **rate-limited** per email + church so it cannot be
  used to spam a volunteer's inbox or fan out email cost. (Security-critical — carries a threat model +
  rate-limit/enumeration ALLOW/DENY tests.)

- [x] **R398**: The login page offers an "Are you a volunteer? Get your sign-in link" entry point that
  leads a volunteer to the church-scoped self-service request.

- [x] **R399**: When a magic link is expired or invalid at `/volunteer/verify`, the volunteer is offered a
  one-tap "request a new link" that returns them to the self-service request for the same church (the
  church context travels with the link so no re-selection is needed).

### Admin Resend

- [ ] **R400**: From the Volunteers page, an editor/admin can **email** a rostered volunteer their sign-in
  link as a standalone message (not tied to any one service).

- [ ] **R401**: From the Volunteers page, an editor/admin can **copy** a rostered volunteer's sign-in link
  to the clipboard, to share through their own channel (works even while Resend is test-mode in prod).

- [ ] **R402**: Admin resend only mints links for people who are on the church roster with an email
  address, and reuses the same server-side mint/send core as the self-service request (single code path,
  one authorization model).

### Multi-Church Volunteer Switcher

- [ ] **R403**: A volunteer serving at more than one church sees a church switcher/filter on My Schedule
  that scopes the displayed services to a selected church. It is distinct from the admin membership
  switcher (volunteers have zero org memberships) and never calls `selectOrg`.

- [ ] **R404**: The switcher labels each church by name, sourced from an `orgName` field added to the
  `rehearseAccess` projection (so no org-document read is required), and the selected-church context
  carries into the volunteer service view.

- [ ] **R405**: A volunteer serving at only one church sees no switcher — the single-church experience is
  unchanged.

## Future Requirements (deferred)

- Per-org email/egress quota + cost alerting for volunteer link sends (relates to backlog 999.x cost
  guardrails deferred from v2.12).

- Resend DNS domain verification so real self-service emails reach any volunteer inbox, not just the owner
  (backlog 999.6) — an ops task, not app code.

## Out of Scope

- **Changing the link's trust model** — a magic link remains an account-level bearer credential; we do not
  add per-church link restriction (the account-level design is intentional, see Scope decisions).

- **Cross-org email lookup** — the self-service request is always church-scoped (slug → one org); we do not
  build a global "type your email, we'll find all your churches" endpoint (larger enumeration surface).

- **A standalone volunteer account/profile UI** — sign-in stays link-only; no password, no profile editing.

## Traceability

| Requirement | Phase |
|-------------|-------|
| R394 | Phase 128 |
| R395 | Phase 128 |
| R396 | Phase 128 |
| R397 | Phase 128 |
| R398 | Phase 128 |
| R399 | Phase 128 |
| R400 | Phase 129 |
| R401 | Phase 129 |
| R402 | Phase 129 |
| R403 | Phase 130 |
| R404 | Phase 130 |
| R405 | Phase 130 |

*Coverage: 12/12 v1 requirements mapped (R394–R405). No orphans, no duplicates. Phase 128 = Self-Service Magic-Link Request + shared mint/send core; Phase 129 = Admin Resend; Phase 130 = Multi-Church Switcher.*
