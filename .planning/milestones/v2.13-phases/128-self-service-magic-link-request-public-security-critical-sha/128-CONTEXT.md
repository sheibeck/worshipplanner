# Phase 128: Self-Service Magic-Link Request (public, security-critical) + shared mint/send core - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss); enriched with the owner's already-settled architecture from the v2.13 milestone brief.

<domain>
## Phase Boundary

A volunteer can obtain their own passwordless sign-in link on demand from a **public, church-scoped page**
— safely (enumeration-safe, roster-gated, rate-limited) through a **shared server-side Admin-SDK
mint/send core** — and can recover from an expired or invalid link without help.

Requirements: R394, R395, R396, R397, R398, R399. **Security-critical** (R397): a public, unauthenticated
email-sending endpoint — carries a threat model + rate-limit/enumeration/roster ALLOW/DENY tests, not just
a UI guard. Mirror Phase 125's `rehearseAccess` security-gate discipline.
</domain>

<decisions>
## Implementation Decisions (owner-settled — honor these)

- **URL shape:** public page at `/{church-slug}/volunteer` (slug FIRST). Resolve slug → orgId via the
  existing **public-read `orgSlugs/{slug}` registry** (ADR-0007) from the unauthenticated client. Unknown/
  expired slug → a clear "church not found" state, never a broken page.
- **Shared server core:** a single server-side helper mints the link via `getAuth().generateSignInWithEmailLink`
  (Admin SDK — the client CANNOT mint) and sends via Resend. This SAME core is reused by Phase 129's admin
  resend (R402: one code path, one authz model). Build it here.
- **Public callable** `requestVolunteerLink({ orgId, email })` (unauthenticated, `onCall`):
  - (a) roster-gated — looks up the email ONLY in `organizations/{orgId}/people`, never cross-org;
  - (b) enumeration-safe — ALWAYS the same response ("If you're on this church's team, a sign-in link is
    on its way") whether or not the email is on the roster; no timing/again-error leak either;
  - (c) rate-limited per (email + orgId) to stop inbox spam / email-cost fan-out — reuse the existing
    messaging limiter pattern (Firestore-doc limiter; see the `queueServiceMessage` / api-proxy limiter);
  - (d) mints + sends via the shared core with a **standalone link email template** (subject/body its own,
    NOT a service reminder). continueUrl carries the church slug so verify-failure can re-request in one tap.
- **Entry points wired:** login page gets an "Are you a volunteer? Get your sign-in link" affordance
  leading to the church-scoped request (R398); the `/volunteer/verify` expired/invalid state
  (VolunteerLinkCompleteView) gets a one-tap "request a new link" that returns to the same church's request
  (R399) — the slug travels in the link/continueUrl so no re-selection.
- **Reuse, don't rebuild:** the Resend send block + `config.sender.fromAddress` / `bareEmailAddress` /
  `fromDisplayName` (functions/src/params.ts + getAppConfig), the messaging limiter, the `orgSlugs`
  registry, and v2.12's `volunteerAuth` / router `isVolunteerRoute` / `VolunteerLinkCompleteView`.
- **Any new Cloud Function MUST be re-exported from `functions/src/index.ts`** (else `firebase deploy`
  can't find it; there is no predeploy build hook — rebuild functions before deploy).
- **UAT deferred** to a single batched pass at milestone end (PENDING, not accepted). Do NOT deploy to prod
  in this phase.
</decisions>

<code_context>
## Existing Code Insights (starting points — plan-phase research will deepen)

- **Link minting reference:** `functions/src/index.ts` ~L2085 `rehearseActionCodeSettings` and ~L2199
  `getAuth().generateSignInWithEmailLink(...)` inside `sendQueuedMessageHandler` — the exact mint call to
  factor into the shared core.
- **Resend send + From header:** `functions/src/index.ts` ~L2172 (`new Resend`, `config.sender.fromAddress`,
  `bareEmailAddress`, org-name From wrap). Helpers in `functions/src/params.ts`.
- **Authz re-check pattern** (for the admin path next phase): `queueServiceMessageHandler` ~L1712 (members
  doc → role editor/admin). The self-service callable here is PUBLIC (no auth) — its gate is roster + rate
  limit, NOT membership.
- **Limiter pattern:** the messaging volume guardrails in `sendQueuedMessageHandler` + the api-proxy
  limiter (`readAiProxyLimits`) — reuse a Firestore-doc rate limiter keyed by email+orgId.
- **orgSlugs registry:** `firestore.rules` ~L550 `match /orgSlugs/{slug}` (public read) → maps slug→orgId.
- **Client verify + email-store:** `src/stores/volunteerAuth.ts` (`completeSignIn`, EMAIL_FOR_SIGN_IN_KEY),
  `src/views/VolunteerLinkCompleteView.vue` (verify page — add the "request a new link" affordance),
  `src/views/VolunteerSignInView.vue` (existing volunteer landing/guidance), `src/views/LoginView.vue`
  (add the "Are you a volunteer?" entry), `src/router/index.ts` (`isVolunteerRoute`; add `/{slug}/volunteer`
  as a public route placed AFTER the static routes so it never shadows /songs, /volunteers, etc. — mirror
  the existing `/:slug/service-...` memorable-share route placement, D-19).
</code_context>

<specifics>
## Specific Ideas

- The new public route must not shadow existing top-level static routes — append after static routes like
  the existing `/:slug/quarter...` and `/:slug/service-...` memorable-share routes (D-19).
- Enumeration-safety includes NOT leaking via distinct error codes, response shape, or obvious timing.
- Rate-limit response stays enumeration-safe (a throttled request shows the same confirmation, not a
  "too many requests for this member" message).
- The standalone link email is a NEW template (own subject/body); do not reuse a service-reminder body.
- Local testing: the Auth emulator prints/mints the link (the `mint-volunteer-link.cjs` scratchpad script
  already proves the mint path); Resend won't actually send locally.
</specifics>

<deferred>
## Deferred Ideas

None — scope is fixed by R394–R399.
</deferred>
