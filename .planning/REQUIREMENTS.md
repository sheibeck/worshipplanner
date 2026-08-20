# Requirements — v1.9 Owner Admin Console

**Milestone goal:** A private, owner-only super-admin console that lifts the v1.8 cost/cleanup levers and
the no-reply sender out of `functions/.env` into an admin-only Firestore config doc the Cloud Functions
read at runtime (no redeploy to change), gated by a super-admin custom auth claim distinct from per-org
RBAC — with a dry-run blast-radius preview before any deletion toggle is flipped, and the
song-linked-background protection preserved.

**Scoping decisions (owner, 2026-08-20):** v1.9 minor · Firestore-backed **live** config · **custom-claim**
super-admin gate (builds on v1.5 claims) · research-first. Research: `.planning/research/SUMMARY.md`.

REQ-IDs continue from v1.8 (last R173).

---

## v1.9 Requirements

### Super-admin access gate

- [ ] **R174**: A super-admin can be granted access via a `superAdmins/{uid}` record, and that grant is
      reflected as a `superAdmin: true` custom auth claim on the user's ID token.
- [ ] **R175**: Setting or clearing any custom claim preserves the user's other claims — writing
      `superAdmin` never wipes the existing org-membership `{orgId, role}` claim, and an org-membership
      sync never wipes `superAdmin` — via one shared merge-and-set helper used by both claim writers.
      *(Closes the `setCustomUserClaims`-replaces-not-merges live gap in `orgMembershipClaims.ts`.)*
- [ ] **R176**: The owner can bootstrap the first super-admin with a dry-run-by-default, `--apply`-gated,
      owner-run Node script (no pre-existing super-admin required), mirroring `backfillOrgClaims.ts`.
- [ ] **R177**: The admin console route and its nav entry are reachable only by a signed-in super-admin;
      a non-super-admin is denied/redirected client-side, and the route is distinctly named (not `/admins`,
      which the per-org TeamView already owns).
- [ ] **R178**: Firestore security rules permit read/write of the admin-only collections (`appConfig/*`,
      `superAdmins/*`) to super-admins only, via a claim-based `isSuperAdmin()` check (no cross-document
      `get()`/`exists()`), proven by genuine ALLOW **and** DENY emulator tests.
- [ ] **R179**: A super-admin can grant and revoke another user's super-admin access from the console;
      revocation takes effect on the target's next token refresh. *(Minimal roster — serves the owner's
      "whoever I give access to" goal; full multi-admin management UI stays deferred.)*

### Firestore runtime config

- [ ] **R180**: The v1.8 levers are stored in an admin-only `appConfig/global` Firestore doc: the four
      `*_CLEANUP_ENABLED` flags, retention windows (media/orphan-render/background/pptx-source), the delete
      blast-radius cap, the AI-proxy knobs (per-min/per-day rate limits, model allow-list, max_tokens
      ceiling), and the messaging/fan-out knobs (`SCHEDULED_MESSAGING_CRON_ENABLED`, message recipient cap,
      per-org daily email quota).
- [ ] **R181**: The Cloud Functions read each managed value from `appConfig/global` at runtime; changing a
      value in the console takes effect **without a redeploy**.
- [ ] **R182**: A missing or empty `appConfig/global` doc reproduces today's exact behavior — code defaults
      (identical to the current env fallbacks) are deep-merged, so an absent doc is safe by construction.
- [ ] **R183**: Config reads are cached with a short TTL on hot paths (`api` proxy, `sendQueuedMessage`) and
      read fresh (uncached) on the daily cleanup crons and `sendScheduledReminders`, so an emergency disable
      takes effect on the very next scheduled run.
- [ ] **R184**: Per-knob fail-safe defaults apply on a missing/malformed value: cleanup enable-flags and the
      AI model allow-list fail **closed** (off / restrictive), AI rate limits fail **open** but with capped
      fallback values — never a single blanket all-permissive or all-restrictive default.
- [ ] **R185**: The instance-ceiling knobs (`AI_PROXY_MAX_INSTANCES`, `GLOBAL_MAX_INSTANCES`, render-service
      caps) remain deploy-time config and are **not** presented as live-editable; if surfaced in the console
      they are read-only and labeled "requires redeploy." *(Cloud Functions v2 reads them at module load.)*

### Admin console UI

- [ ] **R186**: The console shows the current effective value of every managed setting, grouped by area
      (cleanup, AI proxy, messaging, sender), each with a last-changed-by / last-changed-at stamp.
- [ ] **R187**: A super-admin can edit each managed toggle/number/text setting inline with min/max/required
      validation, and saving writes the change to `appConfig/global` (validation client-side and enforced by
      rules/functions).

### Cleanup deletion safety

- [ ] **R188**: Before a `*_CLEANUP_ENABLED` flag can be turned on, the console shows an on-demand dry-run
      blast-radius count (what that cron would delete right now), fetched from a callable that forces
      dry-run regardless of the stored flag.
- [ ] **R189**: Enabling a cleanup that deletes data requires an explicit confirm step echoing the dry-run
      count; flipping the flag never triggers an immediate deletion — only the next scheduled cron run acts.
- [ ] **R190**: No cleanup can ever delete a song-linked background — the `cleanupOrphanBackgrounds`
      `referencesComplete` / floor-guard fail-safes remain intact after the config swap (its existing unit
      tests pass unchanged); only transient slideshow backgrounds tied to a service are eligible.

### No-reply sender

- [ ] **R191**: A super-admin can configure the app's no-reply From address (display name + address) from the
      console; it is format-validated, persisted to `appConfig/global`, and used by the Resend send path.
- [ ] **R192**: The sender config never accepts or exposes provider secrets (`RESEND_API_KEY` stays
      server-side); an address on an un-verifiable host (e.g. `*.web.app`) surfaces a "must be a
      Resend-verified domain" warning. *(Domain verification itself is an out-of-band owner action.)*

---

## Future Requirements (deferred)

- **In-app usage visibility (R169, carried from v1.8):** surface the `aiUsage` ledger and the dry-run
  cleanup logs as an in-console dashboard. This pass shows only the single on-demand dry-run count (R188).
- **Church/org provisioning & billing management** from the console — the owner's stated longer-term goal;
  no data model exists yet. Explicitly out of this first pass ("doesn't need to be fully fleshed out").
- **Full multi-admin management UI** (bulk roster, audit history of grants) beyond the minimal grant/revoke
  in R179.
- **Full audit-log collection + browsing UI** (vs. the cheap `updatedBy`/`updatedAt` stamp in R186) and a
  live staleness indicator on config values.
- **Per-org override of the global config knobs** — note the extension point; single/few-org app today.

## Out of Scope

- **Making `RESEND_API_KEY` or any secret editable in the console** — secrets stay in `functions/.env` /
  Firebase secrets, server-side only. The console configures the non-secret sender *address*, not credentials.
- **Provisioning or DNS-verifying an email domain** — the console can store a verified address once the owner
  has it; it cannot create/verify the domain. A `*.web.app` address can never be Resend-verified.
- **Making the `*_MAX_INSTANCES` / render-service caps live-editable** — deploy-time config by nature (R185).
- **Autonomous deploy of the auth/rules/data-loss changes** — every such deploy is handed to the owner per
  the v1.9 grant; the console mechanism ships built/tested/UNDEPLOYED with the command handed over.

## Open questions for the owner (flagged, not blocking — routed to PENDING-VERIFICATION at hand-off)

- **Cloud Storage Object Versioning / bucket retention** as a safety net *before* live deletion toggles are
  enabled in production — an owner-side infra check this milestone's code can't verify.
- **`superAdmin` survival when a user's last org membership is removed** — recommended: preserve the
  `superAdmin` claim (a super-admin need not belong to any org). Resolved in R175's merge design as "preserve
  unless explicitly revoked"; confirm at UAT.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R174 | Phase 68 | Pending |
| R175 | Phase 68 | Pending |
| R176 | Phase 68 | Pending |
| R177 | Phase 68 | Pending |
| R178 | Phase 68 | Pending |
| R179 | Phase 68 | Pending |
| R180 | Phase 69 | Pending |
| R181 | Phase 69 | Pending |
| R182 | Phase 69 | Pending |
| R183 | Phase 69 | Pending |
| R184 | Phase 69 | Pending |
| R185 | Phase 69 | Pending |
| R186 | Phase 70 | Pending |
| R187 | Phase 70 | Pending |
| R188 | Phase 71 | Pending |
| R189 | Phase 71 | Pending |
| R190 | Phase 71 | Pending |
| R191 | Phase 70 | Pending |
| R192 | Phase 70 | Pending |

**Coverage:** 19/19 v1.9 requirements (R174–R192) mapped to exactly one phase. No orphans.
