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

## Milestone: v1.8 — Cost & Billing Hardening

**Shipped:** 2026-08-20 | **Phases:** 3 (65–67) | **Plans:** 6 | **Tasks:** 13

### What Was Built
Capped and made observable every runaway cost surface on the live Blaze-plan app: AI-proxy rate limit +
model/token enforcement + usage ledger + instance cap (65); dry-run retention sweeps for media, orphan
renders, backgrounds (3-tier reference detection + fail-safes) and PPTX sources (66); reminder-cron gate,
Resend volume caps, project-wide + Cloud Run instance ceilings (67). Safe config deployed to production;
cleanup crons live in dry-run. Follow-up made the retention windows env-tunable (media 14→30d).

### What Worked
- **Grounding requirements in a code investigation first.** A single thorough investigation agent mapped
  the five real exposures (with file:line) before any planning — every phase's plan and each REVIEW cited
  real code, and the plan-checkers verified line refs rather than guessing.
- **Deploy classification baked into the plans.** Splitting "autonomous bounded config" vs "owner-gated
  data-deletion" at plan time (and staging every deploy for the orchestrator, not the executor) meant no
  subagent ever fired a production deploy, and the one broad `firebase deploy` was a single reviewed step.
- **Adversarial review caught real deletion-safety bugs.** The code-review→fix loop closed a quota
  overshoot (P67 WR-01), a fail-open gap (P67 WR-02), and hardened the R167 background fail-safe against a
  non-array field and a silently-empty scan — none blocking, all real, in code about to delete user data.

### What Was Inefficient
- **Env-configurability drifted from intent.** The plan said retention windows should be env-tunable; the
  executor shipped them as hardcoded constants, and the orchestrator's handover doc then wrongly listed
  them as env knobs — surfaced only when the owner asked. A quick follow-up fixed it, but a plan-checker
  or verifier check on "config knobs are actually env-readable" would have caught it earlier.
- **Recurring stale `.git/index.lock`** from finished subagents forced several manual lock clears mid-run.

### Patterns Established
- **Dry-run-by-default deletion crons** with a path guard + age gate + an env enable-flag + a per-run
  delete cap + a fail-safe that forces the whole run to dry-run on any incomplete/ambiguous input — the
  template every new sweep copied, and the safest shape for destructive background jobs.
- **Deploy-the-mechanism-dry-run (autonomous) / owner-flips-the-switch (gated)** as the split for shipping
  destructive automation to a live app without waiting on the owner for the harmless part.

### Key Lessons
- A handover doc is only as good as its claims — verify "there's a setting for X" against the code before
  writing it down. The owner catching the env-knob misstatement is the same class of lesson this project
  already learned about tests-explained-away (CLAUDE.md): an unverified assertion is a latent defect.

### Cost Observations
- Model mix: planning/planner on **opus**; discuss/plan-check/execute/verify/review/fix on **sonnet**;
  orchestration on the session model. Every phase ran the full discuss→plan→check→execute→verify→review→fix
  chain with independent subagents per gate.
- Notable: shipping deletion logic to production with zero real deletions (dry-run default) meant the
  risky half of the milestone could deploy autonomously and be observed before the owner ever enables it.

---

## Milestone: v2.2 — Configurability, Hardening & Cleanup

**Shipped:** 2026-08-25 | **Phases:** 5 (79–83) | **Plans:** 13 | **Tasks:** 35

### What Was Built
Made the app fit churches other than Berean and cleared v1.x–v2.1 backlog debt. Per-org configurable
**Teams** (own team list modeled on roster roles) replacing the hard-coded Berean list + dropped the
ordinal-Sunday auto-select (79); security/data-integrity hardening — `inviteLookup` create gate,
`createdBy` immutability, `deleteService` share revocation, reprise-safe slide clear, pending-render guard
(80); polish/ops — PC-export coverage, Resend domain runbook, Owner Console a11y, shared `SongBrowser`
(81); per-org **AI enablement** OFF-by-default behind a super-admin master gate + fail-closed proxy (82);
Roles/Teams tab width + real Delete button + corrected copy (83). Phases 82–83 were added mid-milestone
from owner testing feedback. Hosting deployed to production at close; Phase 80 + 82 backend owner-gated.

### What Worked
- **Modeling new config on a proven sibling.** Teams copied the roster-Roles store/UX/seed patterns almost
  verbatim — low-risk, fast, and its tests fell out of the existing shape.
- **Two-gate AI enablement with a fail-closed proxy.** `isAiEnabled = aiMasterEnabled && church setting`
  put the on/off decision in exactly one computed, and the proxy defaulting to deny meant a missing field
  reads as OFF — the safe direction for a metered cost.
- **Audit → owner-decision → reconcile discipline at close.** The pre-close artifact audit surfaced real
  dormant items; closing them (harvested/deferred/resolved frontmatter) gave a genuinely clean slate.

### What Was Inefficient
- **A feature shipped, then removed days later.** The per-team song-tag filter (R230) was built in Phase 79,
  then removed at close when owner testing showed it only fed AI suggestions, did nothing with AI off, and
  presented a live-looking control with no effect. The signal ("what does this actually do when AI is off?")
  was answerable at scoping — a "does this affordance do anything in every state?" check would have caught it
  before it was built. Removal was clean, but it was build-then-delete churn across 8 files + tests + docs.
- **Post-milestone UI-copy leaks.** Turning AI off still left "AI" mentions in two static strings and a dead
  dropdown — found only by an explicit "where do we still mention AI?" sweep after the toggle shipped.

### Patterns Established
- **Reconcile a post-close scope reversal across every layer.** When R230 was removed after the audit
  passed, the fix touched REQUIREMENTS traceability, STATE decisions log, the audit banner, the seed, and
  MILESTONES — a shipped-then-removed requirement is honest only if every record says so.
- **Close-time artifact hygiene.** `audit-open` flags dormant seeds and un-frontmattered debug files;
  `status: harvested|deferred|resolved` is the lever that clears them without losing the idea.

### Key Lessons
- **An affordance that does nothing in a reachable state is a scoping bug, not a polish bug.** R230's filter
  was inert whenever AI was off; that was knowable before building it. Ask "what does this control do in
  every on/off combination?" at scope time.
- Removing a delivered requirement is fine — but the milestone only closes *honestly* if the delivered
  record is amended in the same breath, not left claiming 19/19 with no asterisk.

### Cost Observations
- Model mix: orchestration + close-out on the session model (opus); the autonomous phase chain
  (discuss→plan→check→execute→verify→review→fix) on sonnet with opus fallback when sonnet timed out.
- Notable: the most expensive churn this milestone was building R230 and then unwinding it — a scoping
  check would have been far cheaper than the build+remove+reconcile cycle.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.4 | 10 | `workflow.verifier` enabled (2026-07-28) — first milestone with real per-phase VERIFICATION.md |
| v1.5 | 13 | Autonomous run with deferred human-verify; deploy-gated security work (custom auth claim) built undeployed |
| v1.6 | 7 | Client-side reliability milestone; owner-attributed close, deployed same day |
| v1.7 | 7 | First messaging/backend-send milestone; deploy-gated Functions built against a mocked provider, one owner deploy at close; two stacked milestones combined at archive |
| v2.2 | 5 | Phases added mid-milestone from owner testing feedback; a delivered requirement (R230) removed at close and reconciled across all records; hosting deployed at close with backend owner-gated |

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
4. **An affordance that does nothing in a reachable state is a scoping bug** (v2.2 R230). Ask "what does
   this control do in every on/off combination?" before building it — and if a delivered requirement is
   later removed, amend every record (requirements, audit, decisions log) in the same breath so the close
   stays honest.
