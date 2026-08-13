# Project Research Summary

**Project:** WorshipPlanner
**Domain:** Volunteer/team transactional messaging & notifications, bolted onto an existing Vue 3 + Firebase worship-service planning SPA
**Researched:** 2026-08-13
**Confidence:** MEDIUM-HIGH

## Executive Summary

v1.7 adds email to a mature app that already has everything messaging needs to lean on: a roster with
emails (Roles tab), a lock/reopen service lifecycle, a share-link/snapshot-builder discipline, and three
`defineSecret`-backed Cloud Function integrations to copy the pattern from. All four research passes
converge on the same shape: this is an **integration** project, not a greenfield one — zero new
architectural primitives, only new wiring on proven precedent (queue-then-trigger send, `onSchedule`
cron, `defineSecret` secrets, nested-subcollection data model, org-settings kill-switch). The provider
recommendation is **Resend** (free at this app's volume, cleanest Node SDK, first-class webhook bounce
events, easiest domain-auth setup) sending through a single owner-gated Cloud Function that is the only
code holding the API key.

The recommended approach: stand up provider infrastructure and the kill-switch first, build one shared
server-side recipient resolver that every send surface (composer, lock, re-lock, scheduled reminder)
calls — never a per-surface reimplementation — then layer the composer, the lock/re-lock triggers, and
the scheduled reminder on top of that resolver and the same queue-then-trigger send primitive. The
re-lock scoped change-diff is explicitly the outlier: no peer tool (Planning Center, Elvanto, Rock RMS)
does anything like it, it is the single highest-complexity net-new piece of logic in the milestone, and
it depends on everything else (lock snapshotting, the send primitive, the recipient resolver) already
being solid — so it belongs in its own phase, sequenced last.

Key risks, all converged on across research files: (1) sending without SPF/DKIM/DMARC on a real
church-controlled domain silently lands in spam — this is DNS-level owner work that must be scoped as an
explicit early step, not assumed done; (2) Cloud Functions are at-least-once, so every send path needs a
transactional idempotency-key check or volunteers get duplicate emails; (3) an unauthenticated bounce
webhook is a forgeable write surface unless HMAC-verified from the first commit; (4) recipient
correctness (dedup by email, unassigned-role handling, stale roster data, kill-switch enforcement) must
live in exactly one shared resolver, or four independently-written send surfaces will each get it
slightly wrong. None of these is exotic — they're all "apply the discipline this codebase already has
once more, consistently" — but they are the difference between a trustworthy feature and a silent-failure
one, which is explicitly why this milestone exists (delivery visibility beats doing nothing).

## Key Findings

### Recommended Stack

**Resend** is the recommended email provider: $0/month at this app's realistic volume (3,000/mo free
tier vs. a low-hundreds-per-month usage pattern), the cleanest Node SDK of the group, native
`scheduledAt` for one-off delayed sends, webhook-based hard-bounce events (Svix-signed, HMAC-verifiable
— no SNS/SQS plumbing like SES), and the fastest domain-auth setup (dashboard generates exact DNS
records, one-click verify). It slots into the existing `defineSecret` pattern used for
`CLAUDE_API_KEY`/`ESV_API_KEY`/`NLT_API_KEY` with zero new secret-management design. The scheduled
reminder should use this app's own `onSchedule` (already used twice, for `cleanupExpiredMedia` and
`cleanupOrphanRenders`) rather than Resend's `scheduledAt`, because it needs Draft-state-aware logic
evaluated at fire time — reserve `scheduledAt` for the composer's single-message "schedule for later."

**Core technologies:**
- `resend` npm SDK (`^6.19.0`) — official Node SDK for send + webhook signature verification, no
  Firebase-specific dependency, Node >=20 compatible with this repo's Node 22 Functions
- `defineSecret` (`firebase-functions/params`, already `^7.2.5`) — injects `RESEND_API_KEY` and
  `RESEND_WEBHOOK_SECRET`, exactly mirroring the three existing secrets in `functions/src/index.ts`
- `onSchedule` (already `^7.2.5`) — drives the daily reminder scan as a third cron job alongside the two
  that already exist

### Expected Features

Peer landscape (Planning Center Services, Elvanto, Rock RMS) validates nearly every element of the
already-imported design as table stakes, with one clear standout differentiator.

**Must have (table stakes) — P1, all locked into v1.7 scope:**
- Recipients derived from who's scheduled on the service (teams-first, matches every peer tool)
- Auto-notify on lock (maps onto PCO's "send scheduling email" / Elvanto's "publish" moment)
- Configurable pre-service reminder (PCO ships 0-7 days out as a first-class feature)
- Ad-hoc one-off message to teams/individuals
- Live recipient count before send ("Reaches N")
- Skip/exclude unreachable (no-email) roster entries silently
- Basic delivery log (sent/pending, matching Rock RMS's confirmation-status tracking)
- Org-wide kill switch (PCO has an equivalent org/browser-level disable)

**Should have (differentiators) — the standout is the re-lock scoped diff:**
- Explicit, typed, team-tagged change diff on re-lock (SONG/ORDER/ROLE/NOTES/SLIDES) — **no peer tool
  surveyed does this**; it directly exploits this app's unique lock/reopen lifecycle
- Insertable merge tokens in free-text composer — PCO only does fixed auto-included blocks, not
  user-insertable tokens
- Hard-bounce surfacing per service — PCO's docs don't describe bounce visibility to the planner at all
- Draft-aware reminder suppression — peers have no equivalent Draft concept to skip against

**Defer (v2+, explicit anti-features):**
- Accept/Decline RSVP + response tracking (duplicates PCO's core scheduling job — explicitly out of scope
  per PROJECT.md's "complement, not replace")
- Open-tracking/read receipts (locked decision: sent + hard bounces only)
- SMS channel, rich HTML template builder, two-way reply threading, general-purpose contact list/CRM —
  all over-scoped for a 2-3-planner tool already served by PCO for anything beyond messaging

### Architecture Approach

Every new element reuses an existing pattern rather than inventing one: nested `services/{id}/messages/{id}/recipients/{id}`
subcollections (mirroring the `songs/{id}/lyrics/{id}` two-segment-nesting precedent, kept out of the
hot `services` list-read path exactly like `slideGroups`); a queue-then-trigger send split
(`onCall` enqueues -> `onDocumentCreated` sends), the *exact* shape `parsePptxHandler` ->
`pptxRenders` -> `requestPptxRender` already proves out in this codebase; one shared pure recipient
resolver built on the existing `resolveServiceRoleAssignments`; and reuse of `buildServiceSnapshot`
verbatim for the re-lock diff's lock-time baseline (zero new serialization logic).

**Major components:**
1. `src/utils/messagingRecipients.ts` + a server-side port under `functions/src/` — pure recipient
   resolution (team->RoleGroup mapping, dedup by email, unreachable-count), consumed identically by the
   composer's live count and the Function's authoritative re-resolve at send time
2. `queueServiceMessage` (onCall) -> `messages/{id}` doc -> `sendQueuedMessage` (onDocumentCreated) —
   the single code path and single secret-holder for every trigger type (one-off, lock, re-lock,
   scheduled reminder all terminate here)
3. `sendScheduledReminders` (onSchedule, daily cron) — scans due services, creates `messages` docs;
   never calls the provider directly, so there remains exactly one send code path
4. `messageWebhook` (onRequest, HMAC-verified, no Firebase Auth) — the one genuinely new public/unauthenticated
   trust boundary, updating `recipients/{id}.status` from the echoed `{orgId, serviceId, messageId, recipientId}` metadata
5. `serviceLockDiff.ts` — pure diff of two `ServiceSnapshot`s into typed, team-tagged `ChangeEntry[]`,
   built on the same snapshot-builder discipline that already fixed a prior share-link bug (v1.5 root
   cause: "snapshot frozen at share time")

### Critical Pitfalls

1. **No domain authentication (SPF/DKIM/DMARC)** — sending from an unauthenticated or free-address
   domain silently lands in spam or gets dropped; this is owner DNS work, must be scoped as an explicit
   first-phase blocking step, not assumed done before "it works" is claimed.
2. **Non-idempotent sends on at-least-once Cloud Functions** — a retried trigger without a transactional
   `sent/{key}`-check-before-send re-sends duplicate emails; must be baked into the very first send
   Function, not retrofitted.
3. **Provider key exposed to the client or stored via deprecated `functions.config()`** — must be
   `defineSecret`-only, never a `VITE_*` var, matching the existing three-secret pattern exactly.
4. **Open/forgeable bounce webhook** — must verify HMAC signature over the raw request body before any
   Firestore write, reject with 401 first; a naive `onRequest` endpoint is public by default.
5. **Recipient correctness scattered across four send surfaces** — one shared server-side resolver
   (dedup by email, unassigned-role handling, kill-switch + draft-skip checks) must be built once and
   consumed by composer/lock/re-lock/reminder, or each surface will independently re-break the same rules.

## Implications for Roadmap

Based on combined research, the four researchers agree on this backbone: **(a)** a single shared
server-side recipient resolver and idempotent send-record consumed by ALL send surfaces; **(b)** the
Settings kill-switch ships before or with any auto-send path; **(c)** the re-lock scoped diff is the
highest-complexity differentiator and should be its own phase, sequenced last; **(d)** an
infrastructure/provider-setup phase (Resend account, domain SPF/DKIM/DMARC, secrets — all owner-gated)
comes first, before any send-path code is built.

### Phase 1: Provider infrastructure & settings foundation
**Rationale:** Every other phase depends on the provider secret existing and the kill-switch existing
before any auto-send is possible; PITFALLS' Pitfall 1 requires DNS/domain-auth work to be scoped and
completed by the owner before any "it works" claim is credible, and ARCHITECTURE's default-off kill
switch must exist before a fresh org's send Function has anything real to call.
**Delivers:** Resend account (owner step) + `RESEND_API_KEY`/`RESEND_WEBHOOK_SECRET` via `defineSecret`;
`OrgSettings.messaging` block (`enabled: false` default) merged into `loadOrgContext`; the
`isMessagingEnabled()` client choke point (mirroring `claudeApi.ts`); `firestore.rules` additions for
`messages`/`recipients`/`lockSnapshots` added early, locked-down by default per this codebase's
rules-first discipline.
**Addresses:** Settings kill-switch (P1 feature), email provider infra (P1 feature)
**Avoids:** Pitfall 1 (domain auth), Pitfall 3 (secret handling)

### Phase 2: Shared recipient resolver
**Rationale:** FEATURES' dependency graph and PITFALLS' Pitfall 6 both single this out as the thing that
must exist once, consumed everywhere, before the composer or any auto-send is built — building it inline
per-surface is explicitly named technical debt that's "never acceptable past a spike."
**Delivers:** `src/utils/messagingRecipients.ts` (pure, client-side, unit-testable with no Firestore
mocking) wrapping `resolveServiceRoleAssignments`; a server-side port under `functions/src/` kept in
lockstep; dedup-by-email, unreachable-role surfacing, kill-switch + draft-skip checks centralized here.
**Uses:** `resolveServiceRoleAssignments` (existing, `src/utils/serviceRoles.ts`)
**Implements:** the recipient-resolution architecture component

### Phase 3: Messages composer + send path (queue-then-trigger)
**Rationale:** ARCHITECTURE's queue-then-trigger split (mirroring `parsePptxHandler`->`pptxRenders`->
`requestPptxRender`) is the one new send primitive every later trigger reuses; PITFALLS' Pitfall 2
(idempotency) and Pitfall 5 (RBAC re-check) must be baked into this Function from its first commit, since
retrofitting after other phases build on it is harder. The composer UI itself can build in parallel once
Phase 2's resolver and Phase 1's rules land.
**Delivers:** `MessageComposer.vue` (teams-first recipients, One-off/Reminder/Share-link types, tokens,
"Reaches N" live count, send-copy/schedule-for-later); `queueServiceMessage` (onCall, thin) ->
`messages/{id}` doc -> `sendQueuedMessage` (onDocumentCreated, the only Function holding the provider
secret, transactional idempotency check, server-side re-resolution of recipients, per-recipient token
rendering).
**Addresses:** Messages composer (P1 feature)
**Avoids:** Pitfall 2 (idempotency), Pitfall 5 (RBAC/recipient trust), Pitfall 3 (secret confined to
Functions)

### Phase 4: Delivery history & bounce webhook
**Rationale:** ARCHITECTURE and PITFALLS both flag the webhook as the one genuinely new
unauthenticated-by-Firebase trust boundary in the whole feature — it must ship with HMAC verification
from its first deploy, never added after a demo. It depends on Phase 3's `messages`/`recipients` doc
shape and provider message-id capture already existing.
**Delivers:** `messageWebhook` (onRequest, HMAC-verified against raw body, rejects unsigned/malformed
requests with 401 before touching Firestore); per-service delivery-history panel reading
`messages`+`recipients`; `deliveryCounts` rollup.
**Addresses:** Delivery history & hard-bounce surfacing (P1 feature)
**Avoids:** Pitfall 4 (forged webhook)

### Phase 5: Lock / re-lock triggers (first-lock notification only)
**Rationale:** Depends on Phases 2-4 all being solid (a stable send primitive + delivery visibility to
hang the lock-notify prompt off of). This phase covers the simpler "first lock" case only — no diff —
deliberately separated from the diff-engine work per FEATURES' explicit dependency-note ("scope [the diff]
as its own phase; it should not share a phase with the simpler lock-notification... work").
**Delivers:** `lockSnapshots/current` write hooked into `onMarkAsPlanned`; first-lock notification prompt
(no diff) using org/service messaging defaults; per-service automatic-email defaults toggle
(Settings-inherited).
**Addresses:** Lock notification (P1 feature)
**Avoids:** Pitfall 6 recurrence (kill-switch/draft-skip must be checked here too, not just in the
scheduled path)

### Phase 6: Scheduled share-link reminder
**Rationale:** Independent of Phase 5 (FEATURES' dependency graph marks it "independent of D"); depends
only on Phase 3's send primitive existing. Grouping it separately lets it land in parallel with or after
Phase 5 without blocking either.
**Delivers:** `sendScheduledReminders` (onSchedule daily cron, mirroring `cleanupExpiredMedia`/
`cleanupOrphanRenders`'s shape exactly); Draft-state skip logic; reminder-days-before Settings UI;
idempotency via `reminderSentAt`.
**Addresses:** Scheduled share-link reminder (P1 feature)
**Avoids:** Pitfall 2 (idempotent reminder sends), UX Pitfall (timezone — flagged as open question below)

### Phase 7: Re-lock scoped change-diff notification
**Rationale:** All four research files agree this is the single highest-complexity, highest-differentiation
piece and should be sequenced last — it depends on the lock-snapshot mechanism (Phase 5), the send
primitive (Phase 3), and the recipient resolver (Phase 2) all already being proven. PITFALLS' Pitfall 7
(snapshot drift, the same bug class already diagnosed once in v1.5's share-link work) means this phase
must build directly on the existing snapshot-builder discipline rather than ad hoc comparison logic.
**Delivers:** `src/utils/serviceLockDiff.ts` (pure diff of two `ServiceSnapshot`s into typed,
team-tagged `ChangeEntry[]`); checkable re-lock diff UI feeding the same composer/queue path
(`type='relock-notification'`); "Lock quietly" always-available escape hatch; snapshot overwrite on
confirm so the *next* re-lock diffs against the new state, not the original.
**Addresses:** Re-lock change notice (P1 feature, standout differentiator per FEATURES)
**Avoids:** Pitfall 7 (snapshot drift / over- or under-reporting)

### Phase Ordering Rationale

- **Infrastructure-first (Phase 1) is non-negotiable**: PITFALLS' Pitfall 1 explicitly names this the
  "first v1.7 phase," and STACK's provider choice is a prerequisite input every other phase's Function
  code depends on.
- **Shared resolver before any send surface (Phase 2)**: FEATURES' dependency graph and PITFALLS'
  Pitfall 6 both call out duplicated per-surface recipient logic as a "never acceptable past a spike"
  shortcut — building it once, early, prevents four independent implementations from drifting.
- **Send primitive before any trigger that uses it (Phase 3 before 5, 6, 7)**: ARCHITECTURE's
  queue-then-trigger design is reused identically by every later phase; building it once with idempotency
  and RBAC baked in avoids retrofitting those properties into four call sites.
- **Delivery history/webhook (Phase 4) before the auto-send paths mature**: shipping lock-notify or the
  scheduled reminder without bounce visibility "recreates the silent-failure problem this milestone exists
  to solve" (FEATURES' dependency notes) — sequenced right after the send primitive, before the auto-send
  triggers that make failures likely to matter in volume.
- **Re-lock diff last (Phase 7)**: unanimous across FEATURES, ARCHITECTURE, and PITFALLS — it is the
  highest-complexity, most novel logic (no peer-tool precedent to crib from) and depends on every other
  piece (snapshot builder, send primitive, resolver) being stable first.

### Research Flags

Phases likely needing deeper research during planning (`--research-phase`):
- **Phase 7 (re-lock diff):** ARCHITECTURE flags real open design questions (SLIDES-diff granularity,
  `affectedTeams` inference for non-ROLE entries) that were deliberately left unresolved for
  requirements/roadmap — worth a focused research or discussion pass before planning this phase in detail.
- **Phase 6 (scheduled reminder):** the timezone approach (naive UTC vs. org-local time) is flagged as an
  open UX pitfall with no resolution in any research file — needs a decision before implementation.
- **Phase 3 (composer/send path):** the "their roles" token's per-recipient personalization — true
  per-recipient rendering vs. a merged blast for the initial cut — is explicitly deferred to a P2 decision
  in FEATURES; the roadmap should decide up front whether Phase 3 ships the simpler merged version or the
  full personalized version, since it changes the phase's scope materially.

Phases with standard, well-documented patterns (skip research-phase, plan directly from this SUMMARY +
ARCHITECTURE.md):
- **Phase 1 (infra/settings):** directly copies the existing `defineSecret`/`OrgSettings` merge pattern,
  no open design questions.
- **Phase 2 (resolver):** pure-function port of existing, already-tested logic (`resolveServiceRoleAssignments`).
- **Phase 4 (webhook):** standard HMAC-verification pattern, well-documented by the provider and by PITFALLS.
- **Phase 5 (first-lock notify):** direct application of the Phase 3 send primitive to an existing trigger
  point (`onMarkAsPlanned`), no new logic beyond what Phase 3 already establishes.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Provider pricing/features cross-checked across 2+ independent web sources each; the `defineSecret` pattern verified directly against this repo's own `functions/src/index.ts`, not just docs — the strongest-grounded of the four files |
| Features | MEDIUM | Peer-tool behavior (PCO especially) is grounded in official first-party help-center docs; broader "industry consensus" claims (tokens, bounce UX) are lower-confidence general web search |
| Architecture | HIGH | Every recommendation is anchored to a real, currently-shipping file in this codebase by path; only two genuinely new decisions (provider choice, SLIDES-diff shape) are flagged as open rather than asserted |
| Pitfalls | MEDIUM | Firebase/GCF idempotency guidance corroborated by official Google Cloud Blog + Firebase docs (HIGH within that topic); deliverability/inbox-placement specifics from a single benchmark source are explicitly flagged LOW and treated as directional only |

**Overall confidence:** MEDIUM-HIGH — the architecture and stack conclusions are strongly grounded in
this specific codebase's existing precedent; the open questions below are genuine product decisions, not
research gaps.

### Gaps to Address

- **SLIDES-diff granularity** (coarse yes/no changed vs. per-slide-group fingerprint) — ARCHITECTURE
  proposes a lightweight per-group text-hash fingerprint stored only on `lockSnapshots/current`, but flags
  this as needing requirements/roadmap confirmation before implementation (Phase 7).
- **`affectedTeams` inference for non-ROLE diff entries** (SONG/ORDER/NOTES/SLIDES) — ARCHITECTURE
  proposes a broad "every team with an assigned role" default, but notes a narrower mapping (e.g.
  SONG->vocals+band only) is equally defensible and changes default recipient selection materially; needs
  an owner/roadmap call before Phase 7 is planned in detail.
- **Per-recipient "their roles" token rendering** — true per-recipient personalized rendering vs. a single
  merged blast for the initial cut is explicitly P2 in FEATURES' prioritization matrix; the roadmap should
  decide which version Phase 3 ships, since it changes that phase's scope.
- **Scheduled-reminder timezone approach** — naive UTC date math vs. org-configured local time is flagged
  as an unresolved UX pitfall with no research-file answer; needs a decision before Phase 6 is planned.
- **Per-service messaging defaults on a locked service** — ARCHITECTURE recommends keeping
  `services/{id}.messaging` draft-only-editable (no new rules carve-out), but flags this as needing
  confirmation that toggling automatic-email defaults on an already-locked service isn't actually needed
  for v1.7.

## Sources

### Primary (HIGH confidence)
- `functions/src/index.ts` — existing `defineSecret` pattern (`CLAUDE_API_KEY`/`ESV_API_KEY`/`NLT_API_KEY`),
  `onSchedule` cron precedent (`cleanupExpiredMedia`/`cleanupOrphanRenders`), queue-then-trigger precedent
  (`parsePptxHandler`->`pptxRenders`->`requestPptxRender`) — verified directly, not from docs
- `src/stores/services.ts` — `buildServiceSnapshot`, `markAsPlanned`, `reopenService`, `setRoleOverride`
  scoped dot-path write precedent
- `src/utils/serviceRoles.ts`, `src/utils/claudeApi.ts`, `src/types/organization.ts` — recipient
  resolution and settings-choke-point precedent
- `firestore.rules` — nested-vs-wildcard subcollection precedent (`songs/{id}/lyrics/{id}`, `pptxRenders`)
- npm registry (`registry.npmjs.org/resend/latest` -> `6.19.0`) — direct primary-source version check
- firebase.google.com/docs/functions/config-env — official `functions.config()` deprecation (March 2027)
- Google Cloud Blog (idempotent/retry Cloud Functions guidance, 2 posts) + firebase.google.com/docs/functions/retries — official at-least-once delivery documentation

### Secondary (MEDIUM confidence)
- help.planningcenter.com / pcoservices.zendesk.com (official PCO help docs) — scheduling-email, reminder,
  and communicate-with-teams behavior
- help.elvanto.com (official Elvanto docs) — publish-triggers-notify and contact-volunteers behavior
- resend.com/docs (webhooks, verify-webhooks-requests, domain restriction) — official Resend docs
- Provider pricing cross-checks (automationatlas.io, tiergauge.com, nuntly.com, saaspricepulse.com,
  sendx.io, costbench.com) — 2+ independent sources per provider
- Mailgun SPF/DKIM/DMARC setup guide; webhook signature verification guide (inventivehq.com) — cross-checked
  against multiple independent sources

### Tertiary (LOW confidence)
- itsupport.life.church (Rock RMS operational guide) — third-party, single source
- theleadpastor.com and similar WorshipTools-vs-PCO blog comparisons — secondary, cross-checked across
  two write-ups only
- mailtrap.io transactional-email-services benchmark — single-vendor inbox-placement percentages, treated
  as directional only, not precise

---
*Research completed: 2026-08-13*
*Ready for roadmap: yes*
