# Phase 125: Passwordless Magic-Link Access & Scoped Read Isolation - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous smart-discuss; owner authorized `/gsd-autonomous`)

<domain>
## Phase Boundary

Deliver the volunteer authentication + authorization foundation for v2.12: a volunteer signs in with **no
password** via a Firebase email-link (`signInWithEmailLink`) tied to their **roster email**, delivered
through the **existing v1.7 volunteer-messaging emails**; and once signed in, their access is **provably
read-only and scoped** to their own org's **Planned (locked), assigned** services — never the planner/editor
surfaces, another org's data, or Draft services. This phase owns the **R377 isolation guarantee** (threat
model + Firestore/Storage emulator ALLOW/DENY tests), which gates the volunteer read surfaces built in
Phases 126–127. It does NOT build My Schedule (126) or the Rehearse view (127) — only the auth/session +
the scoped-read data contract those phases consume.
</domain>

<decisions>
## Implementation Decisions

### Sign-in flow & link delivery (R374, R375)
- Use Firebase Authentication **email-link (passwordless) sign-in** — `sendSignInLinkToEmail` +
  `signInWithEmailLink`. No password is ever set, requested, or stored. Uniform for all volunteers
  (including Gmail/Google-account holders) — do NOT branch to Google sign-in the way v2.5 invites do; the
  magic link is the single promoted path.
- The sign-in link is embedded in the **existing v1.7 volunteer-messaging emails** (reminder + share types)
  as a "Rehearse / My Schedule" CTA. Reuse the Resend send path (`functions/src/adminEmail.ts` pattern) and
  the existing recipient resolution — **do NOT build a new email system**. Only the link is added.
- The address used is the volunteer's **roster email** (already resolved by the messaging recipient
  resolver). Follow Firebase's documented email-link flow: persist the target email in `localStorage` when
  the link is requested/opened, and if it is absent (link opened on a different device) prompt the volunteer
  to re-enter their email to complete sign-in.
- **Owner prerequisite (tracked, like v2.5's Email/Password enablement):** the Firebase console must have
  **Email/Password → Email link (passwordless sign-in)** enabled for `worship-planner-bc515`, and the
  sign-in continue-URL domain must be authorized. Note this in the plan's owner-run steps; do not assume it.

### Session, identity & sign-out (R376)
- The volunteer becomes a real Firebase Auth user (uid) with standard local persistence — the session
  survives a browser refresh. Reuse the existing `auth.ts` / auth-store initialization; add a volunteer
  session shape rather than forking auth.
- Playback position + downloads are attributed to that uid (not anonymous). Keep persistence **light for
  v1**: playback position may live in `localStorage` keyed by uid+track (no Firestore writes required);
  "downloads are theirs" is satisfied simply by the action happening as the authenticated user.
- Explicit **sign out** from the volunteer surface (the My Schedule header user chip), returning to a
  volunteer sign-in landing.

### Scoped read-access mechanism & isolation (R377 — SECURITY CORE)
- A magic-link volunteer is an authenticated Firebase user but is **NOT an org member** (no `members/{uid}`
  doc, no editor/admin/superAdmin claim). Existing org-scoped rules key on the membership claim, so they
  **DENY this session by default** — the correct, fail-closed baseline. This phase adds only a **narrow,
  purpose-built read path**, never a broad grant.
- **Hard constraint:** the mechanism MUST be provable in the Firestore/Storage emulator. **No cross-service
  `firestore.exists()` in `storage.rules`** (the documented deny-everyone blind spot, firebase-js-sdk#6803 —
  see CLAUDE.md). Attachment **files** are served to volunteers via **Firebase Storage download-token URLs**
  (the bearer capability v2.11 already generates for downloads) carried in the data — NOT by widening
  `storage.rules` on `orgs/{orgId}/**`.
- **Recommended direction (finalize in phase-research/planning):** a **denormalized rehearse-access
  projection**, mirroring how `buildServiceSnapshot()` / `ShareView.vue` freeze a PII-safe projection rather
  than opening the live org tree. Research chooses between:
  - **(a) Assignment-indexed rehearse docs** — when a service becomes Planned (locked), write a
    volunteer-readable projection keyed so a volunteer's rules read only rows where their uid/roster-email is
    an assigned participant; media referenced by download-token URL. (Preferred — emulator-testable, no
    cross-service reads, no `orgs/**` widening.)
  - **(b) Scoped live rules** — allow a volunteer to read a Planned service + its songs' attachment metadata
    only when expressible **without** cross-service `exists()`; use only if it can be proven in the emulator.
- **Isolation guarantee (must be tested, not asserted):** a STRIDE-lite threat model + Firestore/Storage
  emulator **ALLOW/DENY** tests proving, at minimum: cross-org read DENIED; Draft (unlocked) service read
  DENIED; not-assigned service read DENIED; planner/editor collection writes DENIED; no cross-org
  list/enumeration. This is the phase's **security gate — non-negotiable, runs inline (not deferred UAT)**.

### Volunteer routing / surface separation (R377 defense-in-depth)
- Volunteer routes are **separate** from planner routes (e.g. `/my-schedule`, `/rehearse/:serviceId`). A
  volunteer session is routed to My Schedule and **never** the planner app shell / service editor.
- Router guards: a volunteer (authenticated, non-member) may reach only volunteer routes; planner routes
  require membership/editor and deny/redirect a volunteer session. This is **UI defense-in-depth layered on
  top of** the data-layer rules — R377's guarantee lives at the data layer, per the success criteria.
- A user who is BOTH a member (planner) and assigned can use both surfaces; My Schedule is reachable by
  anyone assigned, keyed off assignment (not role).

### Claude's Discretion
- Exact denormalization shape (a) vs (b), the projection's document schema, route paths, and the
  playback-position storage key are at the planner's discretion within the constraints above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Auth:** `src/stores/auth.ts` (auth store, `loadOrgContext`, claim handling), the Firebase Auth init;
  `LoginView.vue` (existing sign-in surfaces, v2.5 added set/reset-password + `auth/operation-not-allowed`).
- **Messaging (link delivery):** `functions/src/adminEmail.ts` (Resend send pattern), the v1.7 recipient
  resolver (`resolveRecipients` / `serviceRoles.ts`), `messageTokens.ts` (merge tokens incl. per-recipient
  `{{name}}`) — the reminder/share emails are where the magic link is added.
- **Attachments + tokenized media (v2.11):** `songFiles.ts` (path helper, `orgs/{orgId}/song-files/…`),
  the download-token URL generation used by the v2.11 download button, `SongAttachment` schema on the Song.
- **PII-safe projection precedent:** `buildServiceSnapshot()` + `ShareView.vue` (the-link-is-the-auth,
  frozen snapshot, `roleAssignments` PII-safe projection) — the model for the volunteer read projection.
- **Rules + tests:** `firestore.rules`, `storage.rules`, and the rules-emulator harness (`src/rules.test.ts`
  via `npm run test:rules` / `vitest.rules.config.ts`); the v2.11 storage-rules allow/deny cases and the
  `isOrgEditor` helper are the pattern to mirror for a volunteer read arm.
- **Router guards:** the existing Vue Router membership/editor guards (planner routes).

### Established Patterns
- Fail-closed, claim-based org scoping; deny-by-default rules with explicit ALLOW/DENY emulator tests.
- Server-issued Cloud Functions for privileged/cross-tenant operations (callables, super-admin gating).
- Download-token URLs as a bearer capability for media (avoids storage.rules cross-service reads).

### Integration Points
- New volunteer sign-in route + a `signInWithEmailLink` completion handler.
- The reminder/share email templates gain a volunteer link CTA.
- New Firestore/Storage rule arm(s) (or a denormalized rehearse projection + its write trigger on lock).
- New volunteer router area + guards.

## ⚠ Baseline test note (from CLAUDE.md — do not chase)
- `npx vitest run` app suite = **1 known-failing file** (`src/storage.rules.test.ts`, Storage-emulator
  cross-service limitation). `npm run type-check` (vue-tsc --build) is the type gate. Rules suite via
  `npm run test:rules` (or `vitest run --config vitest.rules.config.ts` against a running emulator).
  `.env.local` is present in this main checkout.
</code_context>

<specifics>
## Specific Ideas

- Design reference: the owner's Claude Design project — the volunteer surfaces show a signed-in user chip
  ("Dana R.", roster email) with the caption "Signing in is only so each person's playback position and
  their own downloads stay theirs" — i.e. auth is deliberately minimal-friction and per-person, not a
  gate for its own sake.
- Cost context (SEED-003): email-link/password auth is free to 50k MAU; ~4,000 MAU at 100 churches × 40
  users = 8% of the free tier. Avoid phone/SMS auth (the one paid method).
</specifics>

<deferred>
## Deferred Ideas

- Per-org storage quota + egress/budget alerting (owner-deferred to backlog for the whole milestone).
- Server-side playback-position sync across devices (localStorage per-uid is enough for v1).
- Rehearse UI (Phase 127) and My Schedule (Phase 126) consume this phase's session + scoped-read contract.
</deferred>
