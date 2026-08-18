# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.7 — Volunteer Messaging

**Shipped:** 2026-08-18 (deployed to production 2026-08-17)
**Phases:** 7 (58–64) | **Plans:** 25 | **Tasks:** 41 | **Span:** 5 days (Aug 13→17), 150 commits

### What Was Built
- A Settings **messaging kill-switch** (fail-closed, default OFF) + org timezone + per-service
  automatic-email defaults, and one shared **server-side recipient resolver** (teams → deduped
  reachable people + unreachable count) reused by every send surface.
- A ✉ **composer** (teams-first recipients, merge tokens, live "Reaches N", schedule-for-later) over a
  **queue-then-trigger send primitive** (`queueServiceMessage` → `sendQueuedMessage`) that confines the
  Resend key to a single Function, with a transactional idempotency claim.
- Per-service **delivery history** + an **HMAC-verified bounce webhook** (`messageWebhook`, verify-first
  over the raw body, idempotent hard-bounce), **automatic lock notification** + **N-days-before
  scheduled reminder** cron in org-local time, and a **re-lock scoped change diff** (typed, team-tagged,
  checkable) with Lock-quietly and snapshot-overwrite-on-confirm.
- Messaging-UX refinements: a dedicated **Messages tab**, always-visible history (fixed the Phase 60
  `canEditService` defect), live email preview, corrected `{{name}}` token — plus a post-UAT hotfix
  batch (R157–R160): hide-when-off, add-someone fix, From/Reply-To rework, unique org names.

### What Worked
- **Rules-first, allow-case-included discipline** (carried from the v1.4 storage.rules incident): every
  `firestore.rules` change shipped with a genuine emulator ALLOW-case, not only deny-cases.
- **Deploy-gated Functions built against a mocked provider** landed built/tested/undeployed with the exact
  deploy command handed over — the whole send path was verifiable before a single real email, and the
  eventual production deploy (2026-08-17) went in cleanly.
- **Secret confinement proven by test** (RESEND_API_KEY bound only to `sendQueuedMessage`; resend
  functions-only, absent from `src/`) — a security property asserted, not assumed.

### What Was Inefficient
- **Two milestones stacked without archiving** (v1.7 = 58–62, v1.8 = 63–64). Because the standing grant
  stopped before the lifecycle pending owner deploy/verify, they piled up and had to be **combined at
  close** — the archival tool counted only the `milestone:` marker's 5 phases and had to be corrected by
  hand to 7 phases / 25 plans, with the 63/64 and hotfix accomplishments added manually.
- A composer **success-toast misrender** (Phase 59) surfaced in owner UAT and was fixed in the v1.8/hotfix
  wave rather than caught in-phase — the phase's closed scope deliberately didn't auto-fix it.
- Deploy friction: firebase-tools needs declared secrets present across the **whole** codebase and dotenv
  values (not `defineString` defaults) at deploy time — the `messageWebhook` secret and
  `SERVICE_SHARE_BASE_URL`/`MESSAGE_FROM_ADDRESS` params each cost a round of diagnosis.

### Patterns Established
- **Queue-then-trigger send** (onCall enqueue with no secret → onDocumentCreated sender holding the
  secret, transactional status claim for idempotency) is the reusable shape for any future provider send.
- **Verify-first webhook**: HMAC over the raw request body before any Firestore access; 401/400 + zero
  writes on a bad request; idempotent state overwrite on duplicate delivery.
- **Deferred-verification close on owner acceptance** (v1.4/v1.5/v1.6/v1.7): human-UAT items preserved in
  `PENDING-VERIFICATION.md`, never recorded as passed — the milestone archives with the deferrals intact.

### Key Lessons
1. **A standing "stop before lifecycle" grant plus a stacking follow-up milestone = un-archived debt.**
   When a second milestone builds on an un-closed one, decide the archival story early (combine vs. close
   the base first) rather than at the end — the tool archives by the single `milestone:` marker and will
   undercount a combined close.
2. **`onboarding@resend.dev` unblocks the send path but is not shippable** — test-mode only delivers to
   the Resend account owner. A zero-setup sender is great for proving the pipe end-to-end, but "real
   volunteers receive mail" is a separate, DNS-gated task (backlog 999.6). Don't let the working pipe read
   as a working feature.
3. **Deploy-time config lives in dotenv, not code defaults** — firebase-tools validates every declared
   secret across the codebase and won't read a `defineString` default; record the exact prod param values
   with the deploy runbook so the next deploy isn't a rediscovery.

### Cost Observations
- Model mix: predominantly opus (autonomous multi-phase execution under the v1.7/v1.8 grants).
- Notable: building all deploy-gated Functions against a mocked provider up front (vs. waiting on owner
  deploy) kept the autonomous run unblocked across 7 phases without a single production side effect until
  the owner's one-shot deploy.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.4 | 10 | `workflow.verifier` enabled (2026-07-28) — first milestone with real per-phase VERIFICATION.md |
| v1.5 | 13 | Autonomous run with deferred human-verify; deploy-gated security work (custom auth claim) built undeployed |
| v1.6 | 7 | Client-side reliability milestone; owner-attributed close, deployed same day |
| v1.7 | 7 | First messaging/backend-send milestone; deploy-gated Functions built against a mocked provider, one owner deploy at close; two stacked milestones combined at archive |

### Top Lessons (Verified Across Milestones)

1. **A test explained away as an environment quirk is an untested assertion** (v1.4 storage.rules → v1.5
   rules-first discipline → v1.7 allow-case + secret-confinement tests). Make the assertion runnable, not
   a comment.
2. **Deploy-gated work ships built/tested/undeployed with the exact command handed over** (v1.4 PPTX
   render → v1.5 auth claim → v1.7 send path). The autonomous run stays unblocked; the owner owns the
   irreversible step.
3. **Close on owner acceptance with deferrals preserved, never self-approved** (v1.4→v1.7). Deferred
   human-UAT lives in `PENDING-VERIFICATION.md` so any later defect traces to the check that would have
   caught it.
