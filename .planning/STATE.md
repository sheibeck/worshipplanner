---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Organization Lifecycle & Super-Admin Access
status: planning
last_updated: "2026-08-22T17:57:45.419Z"
last_activity: 2026-08-22
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# ▶ ACTIVE MILESTONE — v2.0 Multi-Church Onboarding & Owner Console Tabs (started 2026-08-21)

**Goal:** Turn the owner console into a tabbed shell and add platform-level multi-tenancy management —
onboard new churches and assign their first admin from one place — while closing the multi-org Storage
auth-claim gap that onboarding a second-org admin would otherwise trip. Requirements R193+ in
REQUIREMENTS.md. Phase numbering continues from v1.9 (68–71); this milestone is Phases 72–74.

**Scoping decisions (owner, 2026-08-21):** v2.0 major increment · **stacks on v1.9** (code-complete; its
deploy + UAT + milestone-complete remain parked with the owner — v1.9 archives as-is once those run) · a
church admin **reuses the existing editor role** (no new role/claim) · onboarding creates org record +
default `OrgSettings` + seeds the default service template + assigns the first admin by email · backlog
**999.5** (multi-org Storage auth claim) **pulled into scope** as a hard prerequisite for onboarding a
second-org admin · milestone-level research skipped (all patterns already exist in-repo from v1.5–v1.9) ·
run autonomous with human verification deferred to the end.

## ★★ STANDING AUTONOMY GRANT — v2.0, granted 2026-08-21

**This is the ACTIVE grant.** Same pattern as v1.6/v1.7/v1.8/v1.9: run autonomous, defer human
verification to the end. Re-read before deciding to stop — it survives context compaction.

- **Run all v2.0 phases autonomously** (discuss → plan → execute per phase). Pick the reasonable default
  on ordinary grey areas, state it, keep moving. Stop and ask only when a wrong assumption would be
  unsafe or waste the work.

- **Defer human verification to the end.** Route each `human_needed` check to
  `.planning/PENDING-VERIFICATION.md` and continue; **never record a deferred check as passed.**

- **STOP BEFORE THE MILESTONE LIFECYCLE.** When all v2.0 phases are code-complete, STOP and hand over the
  `/gsd-verify-work` list + the owner-gated deploy commands (including v1.9's still-outstanding hand-over
  items, if not already run). Do NOT run audit → complete → cleanup.

- **Deploy policy — HAND OVER all deploys this milestone (carried from v1.5–v1.9).** Every auth-claim /
  `firestore.rules` / `storage.rules` / new org-provisioning-callable change ships **built + tested +
  UNDEPLOYED** with the exact `firebase deploy --only …` command handed over, plus any owner-run backfill
  script (mirroring `backfillOrgClaims.ts`). This covers essentially all of Phase 73 (claim + rules +
  backfill) and the two new callables in Phase 74 (org onboarding, admin assignment). Phase 72 (tab
  restructure, no new writes/rules) is the one phase with no auth/rules surface to hand over.

- **No `.env.local` / `functions/.env` secret writes.** `RESEND_API_KEY` and all other secrets stay
  server-side and never move into a client-readable doc.

- **No destructive / irreversible actions** without asking (no `git stash` in this multi-worktree repo,
  no project-wide lint --fix, no history rewrites, no bulk deletions beyond a plan's scope).

- Gates: type-check via `npm run type-check` (vue-tsc --build); app-suite baseline is the 2 known-failing
  files (`storage.rules.test.ts`, `RosterView.test.ts`); functions suite via `cd functions && npm test`;
  rules suite via the emulator; render-service via `cd render-service && npm test` (not touched this
  milestone).

- **Rules-testing discipline (carried from v1.5 onward, applies to Phase 73's `storage.rules` change):**
  every rules change carries a genuine ALLOW-case test that actually runs against the real emulator, not
  just deny-cases — Phase 73 needs BOTH a genuine multi-org ALLOW and a cross-org DENY. Cross-service
  `firestore.exists()` is inert in the Storage emulator (firebase-js-sdk#6803) — do not gate a Storage
  rule on it; the claim is the sole authority for Storage membership (v1.5 D-01/D-04).

---

## Deferred Verification

Per the v2.0 grant, human UAT is deferred to milestone end and NEVER recorded as passed. On autonomous
re-entry these phases are dropped from the run queue and resumed only via the recorded command. (No
phases code-complete yet — table fills in as phases close.)

| Phase | State | Resume |
|-------|-------|--------|

---

<details>
<summary>Historical — v1.9 active/hand-over state (code-complete 2026-08-20; deploy + UAT + milestone-complete lifecycle parked with owner — v2.0 stacks on top, see PROJECT.md)</summary>

# ▶ ACTIVE MILESTONE — v1.9 Owner Admin Console (started 2026-08-20)

**Goal:** A private, owner-only super-admin console that lifts the v1.8 cost/cleanup levers + the no-reply
sender out of `functions/.env` into an admin-only Firestore config doc the Cloud Functions read at runtime
(no redeploy to change), gated by a super-admin custom auth claim. Requirements R174+ in REQUIREMENTS.md.

**Scoping decisions (owner, 2026-08-20):** v1.9 minor increment · Firestore-backed **live** config (functions
read a config doc at runtime, not `process.env`) · **custom-claim** super-admin gate (builds on v1.5 claims) ·
research-first. Out of scope this pass: billing, church provisioning, multi-admin management UI, in-app
usage/log dashboards.

## ★★ STANDING AUTONOMY GRANT — v1.9, granted 2026-08-20

**This is the ACTIVE grant.** Owner: *"use gsd-autonomous. Defer human verification to the end."* Same
pattern as v1.6/v1.7/v1.8. Re-read before deciding to stop — it survives context compaction.

- **Run all v1.9 phases autonomously** (discuss → plan → execute per phase). Pick the reasonable default on
  ordinary grey areas, state it, keep moving. Stop and ask only when a wrong assumption would be unsafe or
  waste the work.

- **Defer human verification to the end.** Route each `human_needed` check to
  `.planning/PENDING-VERIFICATION.md` and continue; **never record a deferred check as passed.**

- **STOP BEFORE THE MILESTONE LIFECYCLE.** When all v1.9 phases are code-complete, STOP and hand over the
  `/gsd-verify-work` list + the owner-gated deploy commands. Do NOT run audit → complete → cleanup.

- **Deploy policy — HAND OVER all deploys this milestone (default).** v1.9 is dominated by exactly the
  hand-over categories from the v1.8 grant: **auth changes** (the super-admin custom claim + the
  read-merge-write fix to `syncOrgMembershipClaim`), **`firestore.rules` changes** (super-admin gate +
  `appConfig`/grants rules), and **live control of data-loss cleanup toggles**. Every deployable artifact
  ships **built + tested + UNDEPLOYED** with the exact `firebase deploy --only …` command handed over. The
  owner runs the first super-admin bootstrap script and the rules/functions deploys. (If the owner later
  wants the low-risk, non-auth/non-rules pieces auto-deployed, they can say so.)

- **No `.env.local` / `functions/.env` secret writes.** `RESEND_API_KEY` stays server-side and never moves
  into the client-readable config doc. Any secret/env the owner must set for a deploy is handed over.

- **No destructive / irreversible actions** without asking (no `git stash` in this multi-worktree repo, no
  project-wide lint --fix, no history rewrites, no bulk deletions beyond a plan's scope).

- Gates: type-check via `npm run type-check` (vue-tsc --build); app-suite baseline is the 2 known-failing
  files (`storage.rules.test.ts`, `RosterView.test.ts`); functions suite via `cd functions && npm test`;
  rules suite via the emulator; render-service via `cd render-service && npm test`.

- **Rules-testing discipline (carried from v1.5, applies to every `firestore.rules` change here):** every
  rules change carries a genuine ALLOW-case test that actually runs against the real emulator, not just
  deny-cases. Cross-service `firestore.exists()` is inert in the Storage emulator (firebase-js-sdk#6803) —
  do not gate a Storage rule on it.

---

## Deferred Verification

Per the v1.9 grant, human UAT is deferred to milestone end and NEVER recorded as passed. On autonomous
re-entry these phases are dropped from the run queue and resumed only via the recorded command.

| Phase | State | Resume |
|-------|-------|--------|
| 68 | verification_deferred_human | /gsd-verify-work 68 |
| 69 | verification_deferred_human | /gsd-verify-work 69 |
| 70 | verification_deferred_human | /gsd-verify-work 70 |
| 71 | verification_deferred_human | /gsd-verify-work 71 |

**Phase 68 (Super-Admin Access Gate & Claim-Merge Fix)** — code-complete + automatically verified 5/5 SC
on 2026-08-20 (functions 397/397, functions build clean, root type-check clean, rules ALLOW/DENY 6/6 vs a
live emulator, app baseline held; code review: 0 Critical, W1/W3 fixed, W2 documented). UNDEPLOYED — auth +
rules + bootstrap are owner hand-over (`functions/DEPLOY-SUPER-ADMIN.md`). Deferred items detailed in
`.planning/PENDING-VERIFICATION.md` (R176 prod `--apply`, R177 real route/nav, R179 real grant/revoke E2E +
revoke-timing). Owner infra check flagged: enable Cloud Storage Object Versioning before Phase 71's live
deletion toggles ship.

</details>

---

<details>
<summary>Historical — v1.8 active/hand-over state (milestone shipped + safe config deployed 2026-08-20)</summary>

# ▶ ACTIVE MILESTONE — v1.8 Cost & Billing Hardening (started 2026-08-19)

**Goal:** Cap and observe every runaway cost surface in the live app so production billing stays
predictable. Phases 65+ (continuing numbering from v1.7's 58–64). Requirements R161+ in REQUIREMENTS.md.

**Status: v1.8 CODE-COMPLETE (Phases 65–67, R161–R168 + R170–R173) + safe config DEPLOYED to
production 2026-08-20.** Milestone lifecycle (audit/complete/cleanup) NOT run — stopped before it per the
v1.8 autonomy grant; owner steps remain (below).

## ✅ DEPLOYED 2026-08-20 — safe config live in production (`worship-planner-bc515`)

`firebase deploy --only functions` succeeded (assistant ran it under the v1.8 grant's autonomous-deploy
authorization). Now LIVE:

- **Phase 65 (R161–R164):** `api` proxy — per-uid rate limit (429, fail-open), model allow-list (400) +
  max_tokens clamp, `aiUsage` ledger (Admin SDK), `maxInstances: 10`. Anthropic-upstream-only.

- **Phase 66 (R165–R168):** all 4 cleanup crons deployed in **DRY-RUN** mode (delete NOTHING yet) —
  `cleanupExpiredMedia`, `cleanupOrphanRenders`, `cleanupOrphanBackgrounds` (new), `cleanupPptxSources`
  (new). They log what they WOULD delete; no real deletion until the owner enables the flags.

- **Phase 67 (R170–R173 functions):** `sendScheduledReminders` **gated OFF** — the daily cross-org scan
  is STOPPED (immediate read-cost relief); `sendQueuedMessage` recipient cap + per-org daily quota (fail-
  open); project-wide `setGlobalOptions({maxInstances:20})` applied to all functions (`api` keeps its 10).

## ⚠ OWNER STEPS REMAINING (nothing below is done — hand-over)

1. **⚠ Live behavior change now in prod:** gating `sendScheduledReminders` OFF also pauses the composer's
   **"schedule-for-later"** dispatch. If you use scheduled/reminder emails, set
   `SCHEDULED_MESSAGING_CRON_ENABLED=true` in `functions/.env` and redeploy that function. (Reminders were
   reported unused, so default-off is intended — but this is a real, reversible prod change.)

2. **Owner-gated: activate storage deletion (data loss — your button).** Review each dry-run cron's Cloud
   Logging output first (what it WOULD delete), then per path add the flag to `functions/.env` + redeploy:

   - `MEDIA_CLEANUP_ENABLED=true` → `firebase deploy --only functions:cleanupExpiredMedia`
   - `PPTX_RENDER_CLEANUP_ENABLED=true` → `firebase deploy --only functions:cleanupOrphanRenders`
   - `BACKGROUND_CLEANUP_ENABLED=true` → `firebase deploy --only functions:cleanupOrphanBackgrounds`
     (confirm the dry-run log shows `referencesComplete: true` before enabling)

   - `PPTX_SOURCE_CLEANUP_ENABLED=true` → `firebase deploy --only functions:cleanupPptxSources`
3. **Owner-gated: deploy the `firestore.rules` deny** hardening `aiUsage`/`aiRateLimits` against client
   access (Phase 65, defense-in-depth; the ledger works without it): `firebase deploy --only firestore:rules`.

4. **R173 render-service ceiling (staged, not run):** redeploy Cloud Run with the pinned caps —
   `render-service/DEPLOY.md` has the exact command (`--max-instances=3 --concurrency=1`, substitute
   `PROJECT_ID`). Needs `gcloud`/Docker.

5. **Deferred human UAT:** `/gsd-verify-work 65 66 67` (visual/interaction + real-email + a real dry-run
   deletion review) — routed to `.planning/PENDING-VERIFICATION.md` per the grant; none recorded as passed.

6. **Then** run the milestone lifecycle: `/gsd-audit-milestone` → `/gsd-complete-milestone v1.8` →
   `/gsd-cleanup`.

**Tunable env knobs (all have safe code defaults; set in `functions/.env` to override):**
`AI_RATELIMIT_MAX_PER_MIN`=20, `AI_RATELIMIT_MAX_PER_DAY`=500, `AI_ALLOWED_MODELS`=claude-haiku-4-5-20251001,
`AI_MAX_TOKENS_CEILING`=2048, `AI_PROXY_MAX_INSTANCES`=10, `STORAGE_CLEANUP_MAX_DELETES_PER_RUN`=500,
`BACKGROUND_RETENTION_DAYS`=30, `PPTX_SOURCE_RETENTION_DAYS`=30, `MESSAGE_MAX_RECIPIENTS`=200,
`ORG_MAX_EMAILS_PER_DAY`=1000, `GLOBAL_MAX_INSTANCES`=20, `SCHEDULED_MESSAGING_CRON_ENABLED`=off.

Five confirmed exposures (investigation 2026-08-19, `functions/src/index.ts` unless noted):

1. **Claude proxy** `api` (index.ts:156) — authenticated but uncapped; model + `max_tokens` chosen
   client-side (`src/utils/claudeApi.ts:282/362/569`) and forwarded byte-unchanged; no usage logging;
   no `maxInstances`. Largest variable bill.

2. **Storage grows forever** — backgrounds (`useBackgroundUpload.ts:103`) and pptx-import sources are
   never pruned; `cleanupExpiredMedia` (index.ts:658, `MEDIA_CLEANUP_ENABLED`) and `cleanupOrphanRenders`
   (index.ts:812, `PPTX_RENDER_CLEANUP_ENABLED`) both **dry-run by default**.

3. **`sendScheduledReminders`** (index.ts:1025) — two unbounded cross-org collection-group scans daily,
   no early gate. Reminders NOT in production use → disable.

4. **Resend send loop** (index.ts:1782) — no recipient/volume cap.
5. **No instance ceilings / budget guardrails** anywhere (`firebase.json`, render-service Dockerfile).

## ★★ STANDING AUTONOMY GRANT — v1.8, granted 2026-08-19

**This is the ACTIVE grant.** Re-read before deciding to stop — it survives context compaction. Owner
chose "use gsd-autonomous" for v1.8, same pattern as v1.6/v1.7, with two milestone-specific decisions
settled by explicit Q&A at launch (2026-08-19).

### Milestone-specific decisions (owner, 2026-08-19)

- **Reminders are NOT used → disable** the daily `sendScheduledReminders` cross-org scan. (Keep the
  scheduled-message *dispatch* path working only if a phase shows it is independently needed; otherwise
  gate the whole daily function off.)

- **Deploy policy: deploy the low-risk config autonomously; hand over data-loss / lockout deploys.**
  - **Autonomous deploy (bounded, reversible, no user lockout, no data loss):** function `maxInstances`
    / `setGlobalOptions` caps, Claude-proxy rate-limiting + server-side model/`max_tokens` enforcement +
    usage logging, disabling the reminders cron, Resend volume caps, Cloud Run render-service
    max-instances/concurrency, query changes.

  - **HAND OVER (owner runs) — anything that DELETES DATA or could LOCK USERS OUT:** the first activation
    of any pruning that removes existing objects (enabling `MEDIA_CLEANUP_ENABLED`, enabling
    `PPTX_RENDER_CLEANUP_ENABLED`, any Storage lifecycle rule or background/pptx retention job that
    deletes already-stored files), and any `firestore.rules` / `storage.rules` / auth change. Ship these
    built + tested + UNDEPLOYED with the exact command handed over. The *mechanism/caps* may deploy; the
    *first deletion of real data* is the owner's button.

### Standard v1.7 terms carried forward

- **Defer human verification.** Route each `human_needed` check to `.planning/PENDING-VERIFICATION.md`
  and continue; **never record a deferred check as passed.**

- **STOP BEFORE THE MILESTONE LIFECYCLE.** When all v1.8 phases are code-complete (and the autonomous
  deploys done), STOP and hand over the `/gsd-verify-work` list + any owner-gated deploy commands. Do
  NOT run audit → complete → cleanup.

- **No `.env.local` / `functions/.env` secret writes.** Env-var *config* the owner must set for a deploy
  (e.g. flipping `MEDIA_CLEANUP_ENABLED`) is handed over, not written here.

- **No destructive / irreversible actions** without asking (no `git stash` in this multi-worktree repo,
  no project-wide lint --fix, no history rewrites, no bulk deletions beyond a plan's scope).

- Pick the reasonable default on ordinary grey areas, state it, keep moving. Stop and ask only when a
  wrong assumption would be unsafe or waste the work.

- Gates: type-check via `npm run type-check` (vue-tsc --build); app-suite baseline is the 2 known-failing
  files (`storage.rules.test.ts`, `RosterView.test.ts`); functions suite via `cd functions && npm test`;
  render-service via `cd render-service && npm test`.

---

## Deferred Items

Items acknowledged and deferred at v1.8 milestone close on 2026-08-20 (owner-accepted, "Verified"):

| Category | Item | Status | Note |
|----------|------|--------|------|
| debug | knowledge-base | unknown | Stale debug session predating v1.8; unrelated to this milestone. Close/triage separately. |
| seed | SEED-001-admin-settings-interface | dormant | INTENTIONAL — planted for the NEXT milestone (owner admin settings UI). Must remain until then; do not resolve. |

---

## ✅ MILESTONE v1.7 VOLUNTEER MESSAGING — CLOSED & ARCHIVED 2026-08-18

The combined messaging milestone (internal v1.7 Phases 58–62 + v1.8 Phases 63–64, R130–R160) is
**complete, deployed to production 2026-08-17, and archived** to `milestones/v1.7-*` (ROADMAP,
REQUIREMENTS, phases). Tagged `v1.7`. Closed on owner acceptance — the `/gsd-verify-work 58..64`
human-UAT items were accepted as **deferred** (preserved in `PENDING-VERIFICATION.md`), per the
v1.4/v1.5/v1.6 precedent.

**Everything below this banner is HISTORICAL** — the RESUME/hand-over/autonomy-grant blocks describe the
build that is now shipped and archived. They are kept for provenance, not as active state.

**Next:** `/gsd-new-milestone` for the next version. Standing owner follow-ups that outlived the
milestone: verified-domain email harden (backlog 999.6 — email is still test-mode `onboarding@resend.dev`);
production draft-lock devtools check + the multi-org Storage claim (backlog 999.3 / 999.5).

<details>
<summary>Historical — v1.7/v1.8 build state prior to the 2026-08-18 close</summary>

## ★ POST-v1.8 UAT HOTFIXES + PRODUCTION DEPLOY IN PROGRESS (2026-08-17)

After v1.8 was verified GREEN, the owner ran UAT on the shipped messaging feature and requested a batch of
fixes, then **authorized a production deploy**. All fixes are implemented, tested GREEN, committed to master,
and **pushed**. Recorded as **R157–R160** in REQUIREMENTS.md / ROADMAP.md.

**Shipped (direct-to-master, each self-tested):**

- `bece0dc4` **R157** — hide the ✉ Messages action-bar button when org Messaging is off.
- `e866e2f0` **R158** — composer add-someone picker can select the only addable person (controlled placeholder).
- `9f8ccf3c` **R159** — email From = `"<Org Name>" <no-reply@worship-planner-bc515.web.app>` (app-owned
  sending address + org-name display, header-sanitized) + auto Reply-To = sending editor; removed church
  `fromName`/`replyTo` Settings fields. Root cause: Resend 403 on unverified per-church From domains.

- `972bdf04` **R160** — unique org **names** via new `orgNames` create-only registry + rule (mirrors
  `orgSlugs`); rename rejects a taken name, signup auto-suffixes. Slug uniqueness already existed.

- `d34c56c7` — local-emulator send-path unblock (`functions/.secret.local`, placeholders).

**DEPLOY STATUS — ✅ DEPLOYED to production 2026-08-17** (owner granted deploy permission; assistant ran it).

- ✅ `firebase deploy --only firestore:rules,firestore:indexes` — the new `orgNames` uniqueness rule is LIVE.
- ✅ `firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage,functions:sendScheduledReminders`
  — all three CREATED (first-time), `RESEND_API_KEY` accessor granted to the compute SA.

- ✅ `firebase deploy --only hosting` — 443 files, live at https://worship-planner-bc515.web.app.
- ✅ `firebase deploy --only functions:messageWebhook` — DEPLOYED 2026-08-17 with the REAL
  `RESEND_WEBHOOK_SECRET` (version 2; version 1 was a placeholder used only to unblock the initial
  non-interactive deploy, since firebase-tools validates every declared secret across the whole codebase).
  Resend webhook endpoint configured at `https://us-central1-worship-planner-bc515.cloudfunctions.net/messageWebhook`
  (a stable alias for the gen2 Cloud Run URL `https://messagewebhook-d2jqpzommq-uc.a.run.app`), subscribed to
  `email.bounced`. Bounce tracking is LIVE — a Permanent hard bounce flips the recipient to `bounced` and
  bumps `deliveryCounts.bounced`.

**Deploy gotcha (record for next deploy):** non-interactive `firebase deploy --only functions:…` errors
`no value for … SERVICE_SHARE_BASE_URL, MESSAGE_FROM_ADDRESS` because firebase-tools does NOT use a
`defineString` code default at deploy time — it needs the value in a dotenv. Added
`SERVICE_SHARE_BASE_URL=https://worship-planner-bc515.web.app` and `MESSAGE_FROM_ADDRESS=onboarding@resend.dev`
to **`functions/.env`** (LOCAL/untracked — not in git; re-add on a fresh checkout, or deploy interactively).
These are now the DEPLOYED prod param values.

**Share-link base:** `SERVICE_SHARE_BASE_URL` is the ONE app-wide base domain for `{{service_link}}`
(churches never get their own domain — the org is the URL *slug* in the path, not the host). Default is now
`https://worship-planner-bc515.web.app` (was empty); override only for a custom app domain or local dev
(`http://localhost:5173`). The old `.env.local` overrides (`SERVICE_SHARE_BASE_URL=mytestchurch.com`,
`MESSAGE_FROM_ADDRESS=Worship Planner <noreply@worshipplanner.app>`) are stale test values — remove them so
the code defaults apply. Also hardened `bareEmailAddress` so a `Name <email>` config value can't produce the
nested-bracket From that Resend 422'd on.

**Email From (testing):** `MESSAGE_FROM_ADDRESS` default is now `onboarding@resend.dev` (commit after
`972bdf04`) — Resend's zero-setup sender, needs no domain verification, but in test mode only delivers to
the Resend account owner's own email. Sends as `"<Org Name>" <onboarding@resend.dev>`. **Future fix (backlog):
harden to `no-reply@<a Resend-verified domain>`** (add DKIM/SPF DNS) so real volunteers receive mail — a
`*.web.app` address can never be verified.

---

## ⏸ RESUME HERE (2026-08-15 — Phase 63 code-complete via 63-01; Phase 64 not yet planned)

**63-01 executed GREEN (R149, R150).** Added a dedicated **Messages** tab to `ServiceEditorView.vue`
(4th button after Roles, gated `authStore.isEditor && isMessagingEnabled()`), MOVED the messaging-defaults
panel + the "Sent on this service" `ServiceMessageHistory` out of the Service Order tab into a `v-show`
`messages-panel` (byte-for-byte), and fixed **R150**: the history gate dropped `canEditService`
(now `isMessagingEnabled() && authStore.isEditor`) so it renders on a LOCKED service while a viewer /
messaging-off org still hides it. `ActionBarTab` widened with `'messages'`; `buildActionBarItems('messages')`
returns `[]` (the ✉ composer stays on the Service Order bar — SC3 unchanged). Commits `119f038e` (test),
`cb2c0e6c` (feat). Gates: scoped `ServiceEditorView.test.ts` + `serviceEditorActionBar.test.ts` 373/373 green;
`npm run type-check` (vue-tsc --build) clean; full app suite at the 2-file known-failing baseline
(`storage.rules.test.ts`, `RosterView.test.ts`). NO deploy, NO `.env.local` (v1.8 grant). Visual UAT (tab
layout; history visible when locked) DEFERRED to owner at `/gsd-verify-work 63` — `.planning/PENDING-VERIFICATION.md`
§ 63-01 (`verification_deferred_human`, NOT marked passed).

**Next step:** `/gsd-plan-phase 64` (composer refinements, R151–R156) — optionally `/gsd-discuss-phase 64`
first. Phase 63 is the only planned phase so far in v1.8; Phase 64 is independent.

---

## ★★ v1.8 MILESTONE HAND-OVER (2026-08-15) — code-complete + verified GREEN, owner steps remain

**Both v1.8 phases (63, 64) are code-complete and each verified GREEN.** 5/5 plans. App suite at its 2-file
known-failing baseline throughout; functions suite green; `npm run type-check` + `cd functions && npm run
build` clean.

**What shipped (all built/tested; the one functions change — R154 server `{{name}}` — is UNDEPLOYED):**

- **63** Messages tab in the Service Editor holding the per-service Messaging defaults + the "Sent on this
  service" history; the history is now visible when the service is LOCKED (fixed the Phase 60 `canEditService`
  defect). Composer stays an action-bar modal.

- **64** Composer refinements: team labels Band/Vocals/Tech/Other (dropped Worship/Hosts); "+ Add someone"
  is a working visible person picker; live email preview (no click-to-preview); `{{song_list}}` dropped from
  the palette, `{{name}}` per-recipient token added (client + server); Send spinner; the misleading
  success-toast removed (resolved the disclosed Phase 59 defect); history no longer shows a perpetual
  "Sending…" (aged-`queued` >5min or `failed` → red "Failed to send"); message types seed distinct content
  (One-off blank · Reminder `Reminder: {{service_date}}` + link, everyone · Share `Service plan for
  {{service_date}}`, link-only).

**OWNER STEPS:**

1. `/gsd-verify-work 63 64` — the deferred visual/interaction UAT (all in `.planning/PENDING-VERIFICATION.md`).
2. The R154 `{{name}}` server token takes effect only after the send path is (re)deployed — this FOLDS INTO
   the existing v1.7 send-path deploy (no new command); see the v1.7 hand-over below for the full deploy/secret/
   DNS list.

3. Run the milestone lifecycle (audit → complete → cleanup) for v1.8 — and for v1.7 — once verified + deployed.

**Note:** v1.8 stacked on v1.7 without archiving it; BOTH milestones are code-complete + verified but neither
has run its lifecycle (owner-gated on deploy/verify). Phase numbering: v1.7 = 58–62, v1.8 = 63–64.

---

<details>
<summary>Historical — v1.8 RESUME HERE (2026-08-15, roadmap-created; superseded by the hand-over above)</summary>

**v1.8 "Messaging UX & Fixes"** — Phases 63–64, R149–R156. Decisions locked at scoping: message types seed
distinct content (client-only); composer stays an action-bar modal, Messages tab holds defaults + always-visible
history. (Both phases are now code-complete + verified — see the hand-over above.)

</details>

**v1.7 is NOT archived** — it is code-complete + verified GREEN but its send path is UNDEPLOYED and its
owner steps (deploy/secret/DNS + `/gsd-verify-work 58..62`) are still open in
`.planning/PENDING-VERIFICATION.md`. See § v1.7 MILESTONE HAND-OVER below (preserved). Local emulator
sends were unblocked 2026-08-15 via `functions/.secret.local` (gitignored placeholder secrets; debug
session `resolved/functions-emulator-load-failure.md`).

# Project State

## ★★ STANDING AUTONOMY GRANT — v1.8, granted 2026-08-15

**This is the ACTIVE grant** (supersedes the v1.7 grant below, now historical but still relevant because
v1.7's owner deploy/verify remains open). Re-read before deciding to stop — it survives compaction.

Owner request (2026-08-15): run v1.8 "Messaging UX & Fixes" the **same way as v1.7** — chosen explicitly
via the post-milestone menu ("Autonomous, like v1.7").

**What it authorizes / does NOT — identical to the v1.7 grant terms immediately below:**

- Proceed through both v1.8 phases (63, 64) without pausing for ordinary implementation decisions; run
  default smart-discuss, pick the reasonable default for each grey area, state it, keep moving.

- **Defer human verification.** Route each `human_needed` check to `.planning/PENDING-VERIFICATION.md`
  and continue; never record a deferred check as passed.

- **STOP BEFORE THE MILESTONE LIFECYCLE.** When Phases 63+64 are code-complete, STOP and hand over the
  `/gsd-verify-work 63 64` list. Do NOT run audit/complete/cleanup.

- **NO deploys. NO `.env.local` writes.** v1.8 is mostly client-side UI; if a functions change lands it
  ships built/tested/UNDEPLOYED with the command handed over. (The v1.7 send path is still undeployed;
  local sends work via the gitignored `functions/.secret.local` placeholder from the 2026-08-15 debug.)

- **No destructive/irreversible actions** without asking (no `git stash`, no project-wide lint --fix, no
  history rewrites, no bulk deletions beyond a plan's scope).

- Type gate is `npm run type-check` (vue-tsc --build); app-suite baseline is the 2 known-failing files
  (`storage.rules.test.ts`, `RosterView.test.ts`); functions suite via `cd functions && npm test`.

Scoping decisions for v1.8 (message types seed distinct content; composer stays an action-bar modal) are
in the RESUME HERE block above and REQUIREMENTS.md/ROADMAP.md.

---

<details>
<summary>Historical — the v1.7 grant of 2026-08-13 (governed the v1.7 build, now code-complete + verified; owner deploy/verify still open)</summary>

## ★★ STANDING AUTONOMY GRANT — v1.7, granted 2026-08-13

**Superseded by the v1.8 grant above.** Re-read this before deciding to stop for a checkpoint — it survives context compaction.

Owner request: run `/gsd-autonomous` for milestone v1.7 (Volunteer Messaging & Notifications).
Boundaries settled by explicit question and answer at launch, 2026-08-13.

### What this authorizes

- **Do not block on human-verify checkpoints.** When a phase's verification is `human_needed`, record
  each unmet check as DEFERRED in `.planning/PENDING-VERIFICATION.md` and continue to the next phase.
  Owner's choice: "Defer & keep going."

- Proceed through all 5 v1.7 phases (58–62) without pausing for approval on ordinary implementation
  decisions. Run default smart-discuss, pick the reasonable default for each grey area, state it, keep
  moving.

- **Build the deploy-gated send phases against mocked email.** Phases 59 (send path), 60 (bounce
  webhook), and 61 (lock/scheduled cron) build and unit-test with the Resend SDK / webhook signature
  **mocked** — exactly how v1.5's custom-claims / NLT-proxy deploy-gated work shipped. Each Cloud
  Function lands **built, tested, and UNDEPLOYED**, with the exact `firebase deploy --only functions:…`
  command handed to the owner. Owner's choice at launch: "Build all 5 now against mocked email."

### What this does NOT authorize

- **Never record a deferred check as passed.** Defer and disclose, not self-approve.

- **STOP BEFORE THE MILESTONE LIFECYCLE.** Because human verification is being deferred, do NOT run
  audit → complete → cleanup at the end. Archiving phases whose checks were deferred is self-approval by
  another name (the documented v1.4/v1.5/v1.6 lesson). When all 5 phases are code-complete, STOP and
  hand the owner the `/gsd-verify-work` list. The owner runs the lifecycle after verifying + deploying.
  Owner's explicit choice at launch: "Stop before lifecycle + hand over verify list."

- **NO DEPLOYS without an explicit owner ask.** v1.7 has three deploy-gated phases (59, 60, 61). Every
  deployable artifact — the `queueServiceMessage`/`sendQueuedMessage` send Functions, the `messageWebhook`
  HTTP receiver, the `sendScheduledReminders` cron, and any `firestore.rules` change (Phase 58 onward) —
  ships built/tested/undeployed with the exact command handed over. Do NOT deploy to "prove it works";
  build the mock/emulator evidence instead.

- **No `.env.local` changes** — it holds live secrets and is gitignored. `RESEND_API_KEY` and
  `RESEND_WEBHOOK_SECRET` are needed for real sends; the OWNER adds them via
  `firebase functions:secrets:set` and their local `.env.local`. Never write that file. The owner also
  owns the Resend account creation and the domain SPF/DKIM/DMARC DNS records.

- **No destructive or irreversible actions** without asking: no `git stash` (multi-worktree repo), no
  project-wide `lint --fix`, no history rewrites, no bulk deletions of tracked files beyond what a plan
  explicitly scopes.

- **Stop and ask** only when proceeding under an assumption would be unsafe or would waste the work if
  the assumption is wrong. Otherwise pick the reasonable default, state it, and continue.

### Rules-testing discipline (carried from v1.5, applies to Phase 58's firestore.rules)

Every phase touching `firestore.rules` carries a positive (allow-case) test that actually runs against
the real emulator, not merely a deny-case pass — non-negotiable per CLAUDE.md's documented incident
(a deny-everyone `storage.rules` shipped behind an all-deny suite for a whole milestone).

### The bounce webhook is a new unauthenticated trust boundary

Phase 60's `messageWebhook` (onRequest) must verify the provider HMAC signature over the raw request
body before any Firestore write. Treat it with the same rules-first discipline as the security work in
v1.5 — a forgeable webhook is a live write hole.

### Where deferred items go

`.planning/PENDING-VERIFICATION.md` — one running list across all v1.7 phases, written as the owner's
to-do for when they return.

---

<details>
<summary>Historical — the v1.6 grant of 2026-08-11 (superseded by v1.7 above, kept for provenance)</summary>

## ★★ STANDING AUTONOMY GRANT — v1.6, granted 2026-08-11

Owner request: run `/gsd-autonomous` for milestone v1.6. Boundaries settled by explicit question and
answer at launch, 2026-08-11.

### What this authorizes

- **Do not block on human-verify checkpoints.** When a phase's verification is `human_needed`, record
  each unmet check as DEFERRED in `.planning/PENDING-VERIFICATION.md` and continue to the next phase.
  Owner's choice: "Defer & keep going."

- Proceed through every v1.6 phase without pausing for approval on ordinary implementation decisions.
  Owner is **away** — run default smart-discuss, pick the reasonable default for each grey area, state
  it, and keep moving.

### What this does NOT authorize

- **Never record a deferred check as passed.** Defer and disclose, not self-approve.

- **STOP BEFORE THE MILESTONE LIFECYCLE.** Because human verification is being deferred, do NOT run
  audit → complete → cleanup at the end — archiving phases whose checks were deferred is self-approval
  by another name (the documented v1.4/v1.5 lesson; see the ⛔ note further down for v1.4's precedent).
  When all 5 phases are code-complete, STOP and hand the owner the `/gsd-verify-work` list. The owner
  runs the lifecycle after verifying.

- **NO DEPLOYS** without an explicit owner ask. v1.6 has no deploy-gated phases (all client-side Vue —
  drag-and-drop, template UI, song editor, notes field, preview, fonts), so none is expected. If a
  phase somehow needs one, ship it built/tested/undeployed and hand over the command.

- **No `.env.local` changes** — it holds live secrets and is gitignored.

- **No destructive or irreversible actions** without asking: no `git stash` (multi-worktree repo), no
  project-wide `lint --fix`, no history rewrites, no bulk deletions of tracked files beyond what a
  plan explicitly scopes.

- **Stop and ask** only when proceeding under an assumption would be unsafe or would waste the work if
  the assumption is wrong. Otherwise pick the reasonable default, state it, and continue.

### Where deferred items go

`.planning/PENDING-VERIFICATION.md` — one running list across all v1.6 phases, written as the owner's
to-do for when they return.

---

<details>
<summary>Historical — the v1.5 grant of 2026-08-06 (superseded by v1.6 above, kept for provenance)</summary>

## ★★ STANDING AUTONOMY GRANT — v1.5, granted 2026-08-06

**This supersedes the v1.4 grant of 2026-07-30, which was scoped to one weekend and is now
historical (preserved below).** Re-read this before deciding to stop for a checkpoint — it survives
context compaction.

Owner request: run `/gsd-autonomous` for milestone v1.5. Boundaries settled by explicit question and
answer at scoping time, 2026-08-06.

### What this authorizes

- **Do not block on human-verify checkpoints.** Record each as DEFERRED in
  `.planning/PENDING-VERIFICATION.md`, then continue to the next wave/phase. This applies to ALL
  phases including the auth and security-rules work — the owner considered and declined a
  stop-on-security-changes variant, because those phases build without deploying and therefore
  cannot affect live users during the run.

- Complete phases whose only outstanding gate is human verification, marking the gate deferred
  rather than passed.

- Proceed through every v1.5 phase without pausing for approval on ordinary implementation
  decisions.

### What this does NOT authorize

- **Never record a deferred check as passed.** "Skip the checkpoint" means defer and disclose, not
  self-approve. A phase whose verification was deferred says so in its VERIFICATION.md.

- **NO DEPLOYS. `firebase deploy` and `gcloud run deploy` remain the owner's step** — reaffirmed
  2026-08-06, not merely carried over. Every deployable artifact in v1.5 ships **built, tested, and
  undeployed**, with the exact command handed to the owner, exactly as Phase 37 did. This covers:
  the Cloud Function that sets custom auth claims, the one-time backfill over existing users,
  `storage.rules`, `firestore.rules`, the NLT proxy function, and any snapshot-refresh trigger.

  **Why this matters more in v1.5 than it did in v1.4:** the custom-claims change rewrites how every
  existing user's org membership is proven. Deployed carelessly it locks real people out of a live
  app. Undeployed it is inert and harmless. Do not "helpfully" deploy to prove something works —
  build the emulator evidence instead; making the rule verifiable in the emulator IS the phase goal.

- **No `.env.local` changes** — it holds live secrets and is gitignored. `NLT_API_KEY` is needed for
  the Bible-version phase; the owner has the key. Ask them to add it; never write the file.

- **No destructive or irreversible actions** without asking: no `git stash` (multi-worktree repo), no
  project-wide `lint --fix`, no history rewrites, no bulk deletions of tracked files beyond what a
  plan explicitly scopes.

- **Stop and ask** only when proceeding under any assumption would be unsafe or would make the work
  useless if the assumption is wrong. Otherwise pick the reasonable default, state it, and continue.

### The one lesson from v1.4 that must not be repeated

`src/storage.rules.test.ts` was labelled "not a defect, needs the emulator" for an entire milestone,
and that mislabel let a deny-everyone rule reach production. **A test explained away as an
environment quirk is an untested assertion.** When a security-rules test fails during v1.5, treat it
as a real failure until proven otherwise — and prove it by making the assertion runnable, not by
writing a comment. See CLAUDE.md.

### Where deferred items go

`.planning/PENDING-VERIFICATION.md` — one running list across all phases, written as the owner's
to-do for when they return.

### ★ OWNER DECISION 2026-08-07 — Phase 39's dependency is SATISFIED for planning purposes

Asked and answered during the autonomous run, at the point it would first have blocked Phase 44.

**Question:** Phases 44, 45, 46 and 47 all declare `Depends on: Phase 39`. Phase 39 is code-complete
and 4/4 automatically verified, but is still `verification_deferred_human` — so `phase_complete` is
false and the roadmap projection reports `deps_satisfied: false` for all four.

**Owner's answer: proceed — treat Phase 39 as satisfied.** Build 44-47 against the existing, tested
`OrgSettings` shape.

**Rationale, recorded so it is not re-litigated:** what those four phases actually consume from Phase 39
is the typed `OrgSettings` shape and its single defaults-merge in `auth.ts::loadOrgContext` — which
exists, is tested, and passed automated verification. Phase 39's outstanding item is the owner's
hands-on UI pass (5 UI-SPEC backstops, starred item 39.03-1 on Planning Center credential retention),
not the code contract these phases build on.

**The accepted risk, stated plainly:** if the owner's later verification of Phase 39 turns up a real
defect in the settings shape itself, work built on top of it may need rework. That trade was made
knowingly.

**This does NOT mark Phase 39 complete.** It stays `verification_deferred_human`, its
`PENDING-VERIFICATION.md` items stay unchecked, and `/gsd-verify-work 39` remains the resume path. The
decision unblocks *dependent planning*, nothing else — consistent with the grant's rule that a deferred
check is never recorded as passed.

### ★ OWNER DECISION 2026-08-07 — deploys stay prohibited, including for the live T-37-15 hole

Also asked and answered mid-run. Phase 42 **proved by emulator probe** that an org editor can currently
forge a PPTX render `ready` flip on their own org — a live production vulnerability caused by
`firestore.rules`' generic wildcard granting write to any nested collection not explicitly excluded.

The owner was offered a one-time authorization to run `firebase deploy --only firestore:rules` and
**declined**: the deploy prohibition stands. The fix ships built, tested, and undeployed, and the hole
stays open in production until the owner deploys. Bounded — an editor can affect only their own org's
render state, never another org's. One deploy now covers both Phase 41's and Phase 42's rules clauses.
See `.planning/PENDING-VERIFICATION.md` and `42-SECURITY.md`.

---

<details>
<summary>Historical — the v1.4 grant of 2026-07-30 (superseded, kept for provenance)</summary>

Owner instruction, verbatim: *"I'll be leaving for the weekend, so I want you to skip any human
verification points. I want autonomous while I'm away and when we're you're done, we'll do human
verification then. Keep working fully autonomously while I'm away until you get to a point where you
literally can't work because of outstanding issues that must have answers, or until you finish."*

Authorized deferring human-verify checkpoints through Phases 31 → 37; prohibited deploys,
`.env.local` changes, destructive actions, and recording any deferred check as passed. Its deploy
prohibition and its never-self-approve rule are both carried forward above.

</details>

</details>

</details>

</details>

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-06)

**Core value:** Smart weekly service planning following the Vertical Worship 1-2-3 methodology while rotating through the full song stable and respecting team configurations
**Current focus:** Phase 74 — organizations-list-onboard-admin-assignment

> **Historical note (2026-07-25 v1.2 → v1.3 handoff) — OBSOLETE.** A note here formerly explained why
> v1.2 was deliberately left un-archived to preserve `/gsd-verify-work` resume paths. Both v1.2 and
> v1.3 were archived on 2026-07-28 and their phase directories now live under
> `milestones/v1.2-phases/` and `milestones/v1.3-phases/`. Retained only so the reasoning isn't
> rediscovered from scratch.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-08-22 — Milestone v2.1 started

## ★ v2.0 ROADMAP.md phase breakdown (created 2026-08-21)

3 phases (72–74), derived directly from R193–R211 with this project's `coarse` granularity setting
applied: the tabbed-shell restructure (R193–R195) is a low-risk layout refactor with no behavior change,
sequenced first; the multi-org Storage claim widening (R207–R211, backlog 999.5) is sequenced next as a
hard prerequisite — assigning an admin into a second org would otherwise silently break that user's
Storage access; the Organizations list/onboard/admin-assignment work (R196–R206) lands last since it
depends on both the tab shell (UI host) and the widened claim (safe to assign second-org admins).
**Numbering continues from v1.9, which ended at Phase 71** — v2.0 starts at Phase 72, not reset.

| Phase | Goal | Requirements | Depends on | UI hint |
|-------|------|--------------|------------|---------|
| 72 Owner Console Tabs | Restructure OwnerConsoleView into a Configuration tab (existing roster + config cards, unchanged) and a new Organizations tab shell; open tab reflected in route/query | R193-R195 | Nothing (first) | yes |
| 73 Multi-Org Storage Auth Claim | Widen the org-membership claim to carry all of a user's orgs+roles; update storage.rules' isOrgMemberByClaim to match; ship a dry-run/--apply backfill (closes backlog 999.5) | R207-R211 | Nothing (independent; ahead of 74) | no |
| 74 Organizations — List, Onboard & Admin Assignment | List every church; onboard a new one (org + settings + template + first admin); assign admins to any org — all via super-admin-gated callables | R196-R206 | Phase 72, Phase 73 | yes |

See `.planning/ROADMAP.md` § v2.0 Multi-Church Onboarding & Owner Console Tabs for the full phase detail
table (goals, dependencies, success criteria). Next step: `/gsd-plan-phase 72` (optionally preceded by
`/gsd-discuss-phase 72`).

## ★ v1.9 ROADMAP.md phase breakdown (created 2026-08-20)

4 phases (68-71), derived from `research/SUMMARY.md`'s dependency-ordered backbone (super-admin claim +
gate → appConfig doc + rules → Cloud Functions read config → console UI + no-reply sender →
deletion-toggle safety), all four research tracks (Stack, Features, Architecture, Pitfalls) converging on
the same order, with this project's `coarse` granularity setting applied — the config-doc-and-rules phase
merged with the Cloud-Functions-read-config phase into one Firestore Runtime Config phase, and the
no-reply sender folded into the console UI phase. **Numbering continues from v1.8, which ended at Phase
67** — v1.9 starts at Phase 68, not reset.

| Phase | Goal | Requirements | Depends on | UI hint |
|-------|------|--------------|------------|---------|
| 68 Super-Admin Access Gate & Claim-Merge Fix | superAdmin custom claim, grantable/revocable via `superAdmins/{uid}`, merge-safe (never wipes org-membership claims or vice versa via one shared helper), enforced by client route + claim-only Firestore rules; owner bootstrap script | R174-R179 | Nothing (first) | no |
| 69 Firestore Runtime Config | v1.8 cost/cleanup/messaging knobs move into admin-only `appConfig/global`, read at runtime by Cloud Functions with deep-merged safe defaults and per-knob fail-open/closed behavior; asymmetric TTL-vs-fresh caching; MAX_INSTANCES knobs stay deploy-time | R180-R185 | Phase 68 | no |
| 70 Admin Console UI & No-Reply Sender | Console shows/edits every managed setting (validation, last-changed provenance); no-reply From address configurable, secrets never exposed | R186, R187, R191, R192 | Phase 68, Phase 69 | yes |
| 71 Cleanup Deletion-Toggle Safety | On-demand dry-run blast-radius preview + explicit confirm gates every `*_CLEANUP_ENABLED` flip; song-linked-background fail-safes proven intact after the config swap | R188-R190 | Phase 69, Phase 70 | yes |

See `.planning/ROADMAP.md` § v1.9 Owner Admin Console for the full phase detail table (goals,
dependencies, success criteria). Next step: `/gsd-plan-phase 68` (optionally preceded by
`/gsd-discuss-phase 68`).

## ★★ v1.7 MILESTONE HAND-OVER (2026-08-15) — code-complete, owner steps remain

**All 5 phases (58–62) are code-complete and each verified GREEN by goal-backward analysis.** 20/20 plans.
The app suite stays at its documented 2-file known-failing baseline throughout; functions suite green;
`npm run type-check` + `cd functions && npm run build` clean.

**What shipped (all built/tested; the send path + rules + indexes are UNDEPLOYED by design):**

- **58** messaging kill-switch (default OFF) + org timezone + per-service messaging defaults + shared recipient resolver + `firestore.rules` for messages/recipients/lockSnapshots.
- **59** ✉ Messages composer + queue-then-trigger send (`queueServiceMessage`→`sendQueuedMessage`, RESEND_API_KEY confined to the trigger, transactional idempotency).
- **60** delivery-history panel + `messageWebhook` (Svix HMAC verify-first, idempotent hard-bounce) + collection-group index.
- **61** auto lock-notification on first lock + `sendScheduledReminders` daily cron (org-tz N-days-before) + user-scheduled dispatch.
- **62** re-lock scoped change diff (SONG/ORDER/ROLE/NOTES/SLIDES) + team-tagged checkable prompt + Lock-quietly + snapshot-overwrite-on-confirm.

**OWNER STEPS (nothing is deployed; no real email can send until these are done):**

1. `/gsd-verify-work 58 59 60 61 62` — the deferred human UAT list (visual/interaction + real-email), all in `.planning/PENDING-VERIFICATION.md`.
2. Create the Resend account; set secrets: `firebase functions:secrets:set RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET`; set the `SERVICE_SHARE_BASE_URL` / `MESSAGE_FROM_ADDRESS` configs.
3. Domain auth: SPF/DKIM/DMARC DNS records for the sending domain.
4. Deploy: `firebase deploy --only firestore:rules,firestore:indexes` and `firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage,functions:messageWebhook,functions:sendScheduledReminders`.
5. Configure the Resend dashboard webhook URL (the deployed `messageWebhook`) + signing secret.
6. Then run the milestone lifecycle (audit → complete → cleanup).

**Also disclosed (PENDING-VERIFICATION):** a Phase 59 composer success-toast misrender ("Save failed." prefix on the success toast, from the failure-only ToastHost) — recommended fix Option A (drop the redundant toast). NOT auto-applied (out of Phase 59's closed scope).

> **Phase 62 outcome (2026-08-15) — 62-04 (R146/R148/SC4):** `onMarkAsPlanned` now computes a REAL
> `slideGroupsFingerprint` on every lock (the Phase 61 `slideGroupsFingerprint: null` stub is realized —
> Phase 61 first-lock tests updated to the real map, NOT a regression). Read-before-write existence check
> branches: FIRST LOCK writes immediately + keeps the Phase 61 gated auto-send; RE-LOCK reads prior
> snapshot+fingerprint, runs `diffServiceSnapshots`, and on a non-empty diff with messaging ON opens
> `ReLockNotifyPrompt` while DEFERRING the `lockSnapshots/current` overwrite into a `writeSnapshot` closure
> that the modal's `sent` OR `cancel` resolver runs (both overwrite; a failed send emits neither → snapshot
> stays as the safe pre-edit diff basis — SC4). Empty diff OR messaging off overwrites silently, no prompt.
> Whole block stays in its own try/catch, never re-raised into `lifecycleError`. Gates: scoped
> `ServiceEditorView.test.ts` 317 pass (+8 re-lock specs incl. the explicit send-failure-no-overwrite SC4
> test); `npm run type-check` (`vue-tsc --build`) clean; full app suite at the 2-file known-failing baseline
> (`storage.rules.test.ts` emulator limitation + `RosterView.test.ts` stale assertion). NO deploy, NO
> `.env.local` (v1.7 grant). Deferred (NOT defects): visual + real-email + overwrite-timing UAT via the
> UNDEPLOYED `queueServiceMessage` → `/gsd-verify-work 62`, recorded in PENDING-VERIFICATION.md. **All 5
> v1.7 phases (58-62) are now code-complete; the milestone lifecycle is the owner's.**

> **Phase 61 outcome (2026-08-14):** `61-VERIFICATION.md` = passed/GREEN, 4/4 SC + R144/R145, all
> test-exercised. SC1 lock-notification type + client first-lock hook (auto-enqueue on draft→locked, gated,
> everyone assigned, attach-link); SC2 never-draft/off (transition-only + gates; cron excludes draft); SC3
> N-days-before in org IANA timezone (todayInTimeZone/minusDays, no package, default 7); SC4 dual idempotency
> (reminderSentAt same-window no-double-send + transactional scheduled→dispatched claim creating a FRESH
> queued doc since sendQueuedMessage is onDocumentCreated). First-lock read-before-write, slideGroupsFingerprint
> null (deferred to Phase 62), non-blocking enqueue never re-raised, amber banner states + aria-live, no new
> secret/index. Deferred (NOT defects): owner deploy (firebase deploy --only functions:sendScheduledReminders)
> + real lock-email/reminder/banner UAT — PENDING-VERIFICATION.md. Phase 62 (the LAST phase) builds the
> re-lock scoped change diff on the lockSnapshots/current the lock hook now writes.
> Also disclosed (PENDING-VERIFICATION): a Phase 59 composer success-toast misrender ("Save failed." prefix
> on the success toast) — owner to fix (recommended Option A: drop the redundant toast).

> **Phase 60 outcome (2026-08-14):** `60-VERIFICATION.md` = passed/GREEN, 4/4 success criteria +
> supporting truths, R142/R143. Webhook security invariants test-exercised (not presence-only): verify-first
> (bad sig → 401/400 with getFirestore NEVER called), Svix scheme byte-for-byte, transactional idempotent
> bounce count (duplicate → count==1), only-401-for-sig-failure (unprocessable → 200 no write). RESEND_WEBHOOK_SECRET
> bound only to messageWebhook, no new npm package (manual node:crypto), collection-group fallback index
> UNDEPLOYED. Panel is nested-path read-only (no new firestore.rules), hidden when messaging off/non-editor.
> Deferred (NOT defects): owner deploy (secret/deploy/index/Resend-dashboard) + visual/live-bounce/fix-nav UAT —
> PENDING-VERIFICATION.md. Non-blocking note: panel count line shows "N sent" (delivered leaf), within the
> deferred visual UAT. Phase 61 builds the auto lock notification + the scheduled-reminder cron (which also
> dispatches user-scheduled status:'scheduled' messages from Phase 59) on this send path.

> **Phase 59 outcome (2026-08-14):** `59-VERIFICATION.md` = passed/GREEN, 5/5 must-haves, R131/R136–R141
> present, wired, behaviorally exercised. Secret confinement (RESEND_API_KEY bound only to
> sendQueuedMessage; resend@6.19.0 functions-only, absent from src/) and the transactional queued→sending
> idempotency claim (duplicate-trigger sends ZERO emails) both proven by tests. Send path built/tested
> against MOCKED Resend and UNDEPLOYED. Deferred (NOT defects, per v1.7 grant): composer visual/kill-switch
> UAT (`verification_deferred_human`) + owner deploy (Resend account, RESEND_API_KEY secret,
> SERVICE_SHARE_BASE_URL/MESSAGE_FROM_ADDRESS config, SPF/DKIM/DMARC DNS, firebase deploy) — all in
> PENDING-VERIFICATION.md. Phase 60 builds the delivery-history panel + HMAC-verified bounce webhook on
> the messages/recipients/deliveryCounts doc shape Phase 59 established.

> **Phase 58 outcome (2026-08-14):** `58-VERIFICATION.md` = passed/GREEN, 5/5 requirements
> (R130/R132/R133/R134/R135) present, wired, and behaviorally exercised. One manual UAT (Draft→locked
> read-only visual, id D4) is `verification_deferred_human`, routed to `/gsd-verify-work 58` per the
> v1.7 grant — NOT a defect, and covered by passing component tests. `firestore.rules` messaging blocks
> ship built/tested/UNDEPLOYED (owner runs `firebase deploy --only firestore:rules`). Per the v1.5
> precedent (OWNER DECISION 2026-08-07), Phase 58 is treated as SATISFIED for dependent planning while
> its human UAT stays deferred — Phase 59 builds on the tested resolver/rules/kill-switch contract.

## ⏸ RESUME HERE (2026-08-13 — v1.7 ROADMAP.md created, ready to plan Phase 58)

**`.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` traceability are filled for v1.7** (Phases
58-62, 19/19 requirements R130-R148 mapped, 0 unmapped). No plan has been created yet — the milestone
is at the roadmap-created, not-yet-planned stage.

**Next step:** `/gsd-plan-phase 58` (optionally preceded by `/gsd-discuss-phase 58`). Phase 58
(Messaging Infrastructure, Settings & Recipient Resolution — R130, R132, R133, R134, R135) is FIRST per
the research backbone: the Settings kill-switch, org timezone, per-service messaging defaults, and the
one shared recipient resolver must all exist — locked down by `firestore.rules` from commit one —
before any send surface (composer, lock, re-lock, scheduled reminder) is built on top of them. This
phase ships no send capability; it is deliberately inert until Phase 59 adds the send primitive.

See `.planning/ROADMAP.md` § Phase Details for the full phase table, dependencies, and success
criteria.

## ★ v1.7 ROADMAP.md phase breakdown (created 2026-08-13)

5 phases (58-62), derived from `research/SUMMARY.md`'s 7-phase backbone (provider infra+settings →
shared resolver → composer+send → delivery history+webhook → lock/re-lock triggers → scheduled reminder
→ re-lock diff) with this project's `coarse` granularity setting applied. **Numbering continues from
v1.6, which ended at Phase 57** — v1.7 starts at Phase 58, not reset.

| Phase | Goal | Requirements | UI hint |
|-------|------|--------------|---------|
| 58 Messaging Infrastructure, Settings & Recipient Resolution | Kill switch, org timezone, per-service messaging defaults, and one shared recipient resolver — no sends yet | R130, R132, R133, R134, R135 | yes |
| 59 Messages Composer & Send Path | ✉ Messages composer + the queue-then-trigger send primitive; provider key confined to one Function | R131, R136-R141 | yes |
| 60 Delivery History & Bounce Webhook | Per-service sent history; HMAC-verified hard-bounce surfacing | R142, R143 | yes |
| 61 Automatic Notifications — Lock & Scheduled Reminder | Auto-email on first lock; auto-send the share link N days before the service | R144, R145 | yes |
| 62 Re-lock Change Notice — Scoped Diff | Checkable, team-tagged change diff on re-lock, or Lock quietly | R146, R147, R148 | yes |

**Departures from the research default, recorded explicitly per the roadmapper's instructions:**

- **Merged research's Phase 1 (provider infra & settings) and Phase 2 (shared recipient resolver) into
  Phase 58.** Both are foundation-only, no-sending phases; the resolver alone (R134/R135) reads as a
  task rather than an observable outcome under `coarse`. R132 (per-service messaging defaults) and
  R133 (org timezone) were folded in too — both are pure settings/data-model work, testable the moment
  the Settings UI exists, with no send path required.

- **Kept Phase 59 (composer+send) and Phase 60 (delivery+webhook) separate**, despite both being
  deploy-gated — the bounce webhook is flagged by every research pass as a genuinely new unauthenticated
  trust boundary that earns its own explicit HMAC-verification success criterion.

- **Merged research's Phase 5 (lock notification) and Phase 6 (scheduled reminder) into Phase 61** —
  both single-requirement automatic-trigger phases, explicitly noted by research as independent of each
  other and able to land in either order.

- **Kept research's Phase 7 (re-lock scoped diff) as its own phase, last, unmerged** — unanimous across
  all four research files as the highest-complexity, most novel piece; the one hard sequencing
  constraint that overrides `coarse` compression.

**Hard sequencing constraints, all grounded in research:**

- Phase 59 depends on Phase 58 (resolver + rules + kill-switch must exist before any send surface).
- Phase 60 depends on Phase 59 (delivery history reads the `messages`/`recipients` doc shape and
  provider message-id Phase 59 establishes).

- Phase 61 depends on Phase 58 + Phase 59 (consumes the resolver and the send primitive).
- Phase 62 depends on Phase 58 + Phase 59 + Phase 61 — the lock-snapshot mechanism (Phase 61) must exist
  before there is anything to diff against.

**Deploy-gated phases** — per the standing autonomy grant, every deployable artifact ships built,
tested, and undeployed, with the exact command handed to the owner:

- **Phase 58** — `firestore.rules` additions for `messages`/`recipients`/`lockSnapshots`.
- **Phase 59** — `queueServiceMessage` + `sendQueuedMessage` Cloud Functions, plus the owner's Resend
  account creation and domain SPF/DKIM/DMARC DNS setup.

- **Phase 60** — `messageWebhook` Cloud Function, plus configuring the webhook URL in the Resend
  dashboard.

- **Phase 61** — `sendScheduledReminders` Cloud Function (daily cron).
- **Phase 62** — no new Function; reuses Phase 59's send primitive and Phase 58's `lockSnapshots` rules.

**Rules-testing discipline mandate** — Phase 58 (and any later phase touching `firestore.rules`)
carries a success criterion requiring a positive (allow-case) test against the real emulator, not merely
a deny-case pass — per CLAUDE.md's documented `storage.rules` incident.

**Deferred design decisions**, not blocking the roadmap, to resolve at phase discussion:

- SLIDES-diff fingerprint granularity (Phase 62) — confirm at `/gsd-discuss-phase 62`.
- Provider account + domain SPF/DKIM/DMARC DNS work (Phase 59) — confirm at `/gsd-discuss-phase 59`,
  depends on whether the church domain DNS is self-managed.

Full phase table, success criteria, and per-phase notes: `.planning/ROADMAP.md`. Traceability:
`.planning/REQUIREMENTS.md` (19/19 mapped, 0 unmapped).

## Historical — v1.6 RESUME HERE (2026-08-11 — SUPERSEDED; v1.6 shipped 2026-08-12, see the v1.7 RESUME HERE above)

**`.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` traceability are filled for v1.6** (Phases
51–55, 17/17 requirements R110–R126 mapped, 0 unmapped). No plan has been created yet — the milestone
is at the roadmap-created, not-yet-planned stage.

**Next step:** `/gsd-plan-phase 51` (optionally preceded by `/gsd-discuss-phase 51`). Phase 51 (Service
Order Editing Reliability, R110–R112) is FIRST by explicit owner instruction (2026-08-11): the
cross-section drag phantom-duplicate (R110), the "No Section" dropdown save error (R111), and the
empty-body ordering defect on the listing/share surfaces (R112) are the most disruptive bugs and block
trust in every other editing surface. **Write a FAILING reproduction test before touching the reorder
handlers** — the same discipline the v1.4 drag fix used. The corrupting machinery is
`ServiceEditorView.vue`'s Sortable `onEnd` with its copy in `SlideGrid.vue`; all three symptoms clear on
refresh → a client/persisted-state desync, not lost data. v1.4 Phase 29 already fixed the earlier
index/key/DOM-revert bugs, so these are NEW symptoms on top of that rebuild. See STATE.md § "v1.4
RESEARCH FINDINGS" for the reorder-machinery map.

See `.planning/ROADMAP.md` § Phase Details for the full phase table, dependencies, and success criteria.

## ★ v1.6 ROADMAP.md phase breakdown (created 2026-08-11)

5 phases (51–55), derived directly from `.planning/REQUIREMENTS.md` (no `research/SUMMARY.md` this
milestone — research was skipped) with this project's `coarse` granularity setting applied. **Numbering
continues from v1.5, which ended at Phase 50** — v1.6 starts at Phase 51, not reset to 1.

| Phase | Goal | Requirements | UI hint |
|-------|------|--------------|---------|
| 51 Service Order Editing Reliability | Cross-section drags never corrupt item state; items keep true order everywhere | R110, R111, R112 | yes |
| 52 Default Service Template | Template lives on the Services page behind a cog, is the universal new-service starting point, pre-fills Misc content | R113, R114, R115, R116 | yes |
| 53 Song Lyric Editing | Hand-split sections into slides, duplicate a split as one unit, Pre-Chorus, position numbering, "Save" button | R117–R121 | yes |
| 54 Service Item Enhancements | Responsive notes field beside every item's selector; Misc items default to no slides | R122, R123 | yes |
| 55 Preview & Export Polish | No auto-appended Bible version in preview; PC export spinner; Roboto slide font | R124, R125, R126 | no |

**Hard sequencing constraint (owner instruction, non-negotiable):** R110/R111/R112 are Phase 51, FIRST.
R110/R111 are the same cross-section drag machinery (`ServiceEditorView.vue` Sortable `onEnd` + the
`SlideGrid.vue` copy); R112 is an ordering/serialization defect on the same surface (empty-bodied items
sort last until text is typed). Grouped as one foundational reliability phase.

**Other sequencing & dependencies:**

- **Phase 52** (template) depends on Phase 51 — the template editor (`ServiceTemplateEditor.vue`) reuses
  the same per-section SortableJS reorder, and R110 explicitly covers the default-template editor, so it
  must inherit the reliability fix before becoming the universal starting point. Builds on v1.5 Phase 44's
  template infrastructure and Phase 43's item-type palette. **R115 supersedes v1.5 Phase 44's "no template
  → EMPTY service"** — the Suggested Template is now the universal start, decoupled from Vertical Worship
  (PROJECT.md Key Decision, "Blank service template eliminated").

- **Phase 53** (song editing, the largest new-build) depends on Phase 51 — R117/R118 build on the slide
  reorder/duplicate machinery. Owner decision (PROJECT.md, "A split song section is one logical unit"): a
  split section duplicates together and keeps one position-based number. Editor is `SongLyricEditor.vue`
  (v1.3 Phase 28 `songSectionOrder.ts`); R121's button is on `LyricPasteRegion.vue` (v1.4 Phase 35).

- **Phase 54** (item enhancements) depends on Phase 51 — R122 re-lays-out the same item row Phase 51
  stabilizes; use `QuarterView.vue`'s responsive stacking recipe (as v1.5 Phase 48 did). R123's Misc item
  is the `MISC` slot kind from v1.5 Phase 43.

- **Phase 55** (polish) is independent, sequenced last. **R124 partially reverses v1.5 Phase 45's R091
  auto-attribution in preview** (the "(ESV)"/"(NLT)" suffix at `PresentationViewer.vue` /
  `slideDisplay.ts::slideBodyText()`) — reconcile with the per-slide `translationSource` provenance so
  required attribution is not regressed elsewhere. R126 adds Roboto to v1.5 Phase 46's `SLIDE_FONTS`
  @fontsource registry (self-hosted woff2 only), confirming Inter stays.

**Granularity note:** under `coarse`, the two smallest requirement groups are kept as coherent,
user-observable phases rather than split into thin single-requirement phases — service-item enhancements
(R122–R123) as one phase, and the three unrelated polish items (R124–R126) combined into one phase.

Full phase table, success criteria, and per-phase notes: `.planning/ROADMAP.md`. Traceability:
`.planning/REQUIREMENTS.md` (17/17 mapped, 0 unmapped).

## Historical — v1.5 RESUME HERE (2026-08-06 — SUPERSEDED; v1.5 shipped 2026-08-10, see the v1.6 RESUME HERE above)

**`.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` traceability are filled for v1.5** (Phases
39-48, 31/31 requirements R073–R103 mapped, 0 unmapped). No plan has been created yet — the milestone
is at the roadmap-approved, not-yet-planned stage.

**Next step:** `/gsd-plan-phase 39` (optionally preceded by `/gsd-discuss-phase 39`) — Phase 39 (Org
Settings Infrastructure & Feature Toggles) is first: every later phase that stores a setting (Phase 44
default template, Phase 45 Bible version, Phase 46 typography) depends on the typed `OrgSettings` shape
it establishes, and the AI/Planning Center toggles it also delivers are the first user-visible settings
surface. Phase 40 (Custom Auth Claim) is independent of Phase 39 and is sequenced second deliberately —
its dual-read soak window is the longest-running thing in the milestone, so starting it early leaves
the most possible time for the owner's two gated deploys.

See `.planning/ROADMAP.md` § Phase Details for the full phase table, dependencies, success criteria
and research flags.

## ★ v1.5 ROADMAP.md phase breakdown (created 2026-08-06)

10 phases (39-48), derived from `research/SUMMARY.md`'s 12-phase default (Phases 39-50) with this
project's `coarse` granularity setting applied. Departures from the research default, recorded
explicitly per the roadmapper's instructions:

- **Merged SUMMARY's Phase 39 (Org Settings Infrastructure, R073 alone) and Phase 45 (AI and Planning
  Center Settings Toggles, R088–R089) into one Phase 39.** R073 by itself is a single-requirement,
  UI-invisible infrastructure phase — a typed `OrgSettings` shape with no consuming screen until a
  later phase writes into it — which reads as a task, not an observable outcome, under `coarse`
  granularity. The AI/PC toggles are both flagged standard-pattern/skip-research in SUMMARY.md and are
  the first feature that actually puts a control on a Settings screen, so folding them together gives
  Phase 39 real user-observable success criteria while still landing first — ahead of every phase that
  depends on R073 (R086 in Phase 44, R090 in Phase 45, R093 in Phase 46).

- **Merged SUMMARY's Phase 49 (Multi-Image Import Ordering, R098 alone) and Phase 50 (Mobile & Layout
  Polish, R099–R103) into one Phase 48.** R098 alone is a single-requirement bug-fix phase. SUMMARY's
  own rationale for both phases already calls them "independent, low-risk... good candidate to slot in
  wherever convenient" / "sequenced last... independent" — nothing in either phase's scope conflicts
  with the other, so combining them under `coarse` granularity avoids two adjacent thin phases without
  changing what either delivers.

- **Renumbered** SUMMARY's Phase 46 (ESV/NLT) → Phase 45, Phase 47 (Typography) → Phase 46, and
  Phase 48 (Congregational Reading) → Phase 47, purely to close the numbering gap left by the two
  merges above. Ordering rationale, dependencies, and content are otherwise unchanged from SUMMARY.

**Hard sequencing constraints applied, all from research and all grounded in read source:**

- Phase 40 (custom claims) and Phase 41 (sharing) both edit rules files — sequenced, not parallel
  (Phase 41 depends on Phase 40).

- Phase 39 (AI toggle) and Phase 47 (congregational reading, whose AI-split option gates through the
  same toggle) both route through `claudeApi.ts` — sequenced, not parallel (Phase 47 depends on
  Phase 39).

- Phase 43 (service item types, the finalized `SlotKind` palette) precedes Phase 44 (default template,
  whose editor needs that palette).

- Phase 39 (settings infrastructure) is a hard prerequisite for every phase that stores a setting:
  Phase 44 (R086), Phase 45 (R090), Phase 46 (R093).

- Phase 45 (Bible translation/attribution) precedes Phase 47 (congregational reading), since the
  divider operates on already-fetched, already-attributed scripture text.

**Deploy-gated phases** — per the v1.5 standing autonomy grant, every deployable artifact ships built,
tested, and undeployed, with the exact command handed to the owner:

- **Phase 40** (custom claims Cloud Function, its backfill, and `storage.rules`) — structurally TWO
  owner deploys with a mandatory 1-hour soak between them (dual-read first, fallback removal second).
  This phase cannot fully close inside an autonomous run — note this explicitly so it is never later
  mistaken for incomplete rather than deploy-gated-by-design.

- **Phase 41** (`firestore.rules` update-rule loosening for `shareTokens`/`serviceShares`) — one owner
  deploy.

- **Phase 45** (the new NLT proxy Cloud Function) — one owner deploy.

**Rules-testing discipline mandate** — every phase touching `firestore.rules` or `storage.rules`
(Phases 40 and 41) carries a success criterion requiring a positive (allow-case) test that actually
runs against the real emulator, not merely a deny-case pass. This is non-negotiable per CLAUDE.md's
documented incident: a deny-everyone `storage.rules` shipped to production behind an all-deny test
suite for an entire milestone.

Full phase table, success criteria, and per-phase research/notes: `.planning/ROADMAP.md`. Traceability:
`.planning/REQUIREMENTS.md` (31/31 mapped, 0 unmapped).

## ★ Phase 36's remaining gap is a DECISION, not missing code — read before planning it

`36-VERIFICATION.md` records exactly one gap: ROADMAP criterion 4 clause A says *"'Add slide' lives
in the contextual action bar"*, and it does not — it lives in `SlideGrid.vue`'s own header row
(`slide-grid-add-slide`), and `serviceEditorActionBar.ts` never emits an `add-slide` key.

**This was deliberate.** `36-UI-SPEC.md` § Finding 2 made a reasoned discretionary call to keep the
control grid-local (cross-component event plumbing for a control whose enabled state depends on
per-group selection the page-level bar does not track), and 36-01-PLAN, 36-05-PLAN and 36-05-SUMMARY
all restate it verbatim. The verifier's own assessment: *"honest, well-reasoned, and disclosed at
every layer — but it is a requirement deviation, not a completed criterion."*

The gap's own `missing` field offers two resolutions, neither of which is "move the button":

1. an owner-accepted override recorded in `36-VERIFICATION.md`'s frontmatter, accepting the
   interaction-pattern-only resolution as satisfying R053 / criterion 4; **or**

2. a dated ROADMAP.md / REQUIREMENTS.md correction rewriting criterion 4's first clause to describe
   the actual resolution — **the precedent already exists**: the sibling "Add music to this group"
   clause was corrected exactly this way and never re-implemented.

Do not plan an implementation for this without first deciding between (1) and (2). Reimplementing to
satisfy stale ROADMAP prose would undo a documented design decision.

## ⚠ Three UI changes landed OUT OF BAND on 2026-08-05 — one inside Phase 36's own territory

Owner requests made during the Phase 38 run, committed but belonging to no phase or quick task. Listed
here because a Phase 36 gap-closure pass will touch the same button row as the first one.

| Commit | Change | Why Phase 36 cares |
|---|---|---|
| `136fd0a` | The autosave failure message moved OUT of the save-area button row onto its own `flex justify-end -mt-1 mb-3` line below it | **Directly adjacent to `ContextualActionBar`** — it used to render inline between "Mark as Planned" and the bar. Anything re-laying-out that row must not put it back inline. |
| `58000e0` | Leader/Congregation speaker tags on projected slides coloured sky/amber | Partially reverses 260805-kzd (colour only — size, weight and casing stay stripped) |
| `d70104c` | 3-dot menu item "Edit scripture text" → "Set up congregational reading" | Renamed in both the menu (`slideDisplay.ts`) and the drawer button (`EditSlideDrawer.vue`); emit name and testid deliberately unchanged |

## ⛔ AUTONOMOUS RUN STOPPED BEFORE MILESTONE LIFECYCLE — 2026-08-05, and why

Phase 38 was the last phase with implementation work. The autonomous workflow's next step is the
milestone lifecycle: **audit → complete → cleanup**, which archives v1.4 and deletes phase
directories. **That was deliberately NOT run.**

**Why.** Every phase from 32 onward is code-complete but carries owner verification that has never
been run — 32, 33, 34, 35, 37 and now 38 are all `verification_deferred_human`, and 36 is
`deferred_by_owner`. Archiving the milestone in that state would, in substance, bless six phases of
deferred checks. The standing autonomy grant is explicit that this is the one thing deferral must
never become:

> "**Never record a deferred check as passed.** 'Skip the checkpoint' means defer and disclose, not
> self-approve."

Completing and archiving a milestone whose every remaining phase is unverified is self-approval by
another name, so the run stops here rather than doing it. This is the grant's own boundary —
"outstanding issues that must have answers" — reached at the lifecycle gate, not at a blocker.

**Nothing is lost by stopping.** No phase work remains; only the owner's verification pass does.

### What the owner does on return

1. Work through `.planning/PENDING-VERIFICATION.md` — items for phases 31–38, with **38.1–38.7**
   newest. Item 38.4 is starred as historically the hardest: delete one section slide, reload, and
   confirm it stays deleted.

2. `/gsd-verify-work 32` · `33` · `34` · `35` · `37` · `38` as each phase's items pass.
3. Phase 36 is a separate decision — its wireframe now exists (Turn 3), so `/gsd-autonomous --only 36`
   is unblocked whenever wanted.

4. Only then `/gsd-audit-milestone` → `/gsd-complete-milestone v1.4` → `/gsd-cleanup`.

## ★ v1.4 AUTONOMOUS RUN — standing decisions (2026-07-28)

## ★ v1.4 AUTONOMOUS RUN — standing decisions (2026-07-28)

- **Phase 37 (PPTX rendering): BUILD BUT DO NOT DEPLOY.** Write the Cloud Run service, Dockerfile,
  bridging Cloud Function and tests, then STOP and hand the owner the exact `gcloud run deploy`
  command. Deploying provisions billable infrastructure — it is the owner's call, not the run's.

- **Backlog 999.1 is excluded from autonomous runs.** Phase discovery returns it (it sorts after 37),
  but it must be promoted deliberately via `/gsd-review-backlog`. Scope autonomous with `--to 37`.

## ★ v1.4 RESEARCH FINDINGS — read before planning any v1.4 phase

Full detail in `.planning/research/`. Recorded here because phase planners read STATE.md.

### The drag-and-drop root cause is FOUND (HIGH confidence — verified against sortablejs v1.15.7 source)

Three compounding bugs in `ServiceEditorView.vue`'s Sortable `onEnd` handler. This is **not** a
fundamental SortableJS/Vue incompatibility, and it is **not** the DOM-revert trap already fixed under
`D-16` (`ServiceEditorView.vue:1430`, `SlideGrid.vue:669`) — that earlier fix was real but addressed a
different failure:

| # | Bug | Effect |
|---|-----|--------|
| A | Uses `evt.oldIndex` / `evt.newIndex` | These count section-header nodes. Despite `draggable: '.slot-item'`, only `oldDraggableIndex` / `newDraggableIndex` honor that selector — so every cross-section drag splices at the wrong index. |
| B | DOM-revert undoes ONE adjacent step, not a full revert | Multi-position drags leave DOM and state diverged. |
| C | `v-for` key is `slot.kind + '-' + slot.position` | `reindexSlots()` rewrites `position` on every reorder → every key changes every reorder → Vue's keyed diff is defeated. Should be `slot.id` (stable, already anchors slide groups). |

Explains every reported symptom including "correct again after refresh." **The same pattern is
copy-pasted in `SlideGrid.vue`** — the "new slide lands second-to-last" bug is the same family, not a
separate defect. Open trade-off for phase planning: per-section Sortable instances (recommended, more
robust) vs one flat list read via `*DraggableIndex` (cheaper, less robust).

### Draft-lock enforcement today is effectively ZERO (HIGH confidence)

`firestore.rules` has **no** status check on services (role only); the router doesn't gate role on
`/services/:id`; the sole existing gate `isExportedLocked` is scattered, cosmetic, and doesn't even
cover `planned`. A UI-only lock would be bypassable — the lock needs a rules-level requirement.

### Autosave hypothesis (MEDIUM confidence — NOT reproduced live)

Each save's own Firestore echo carries a server `updatedAt` the client never tracked (`onSave()`
destructures it out of the write payload), tripping the remote-merge watcher, which unconditionally
resets the `autosaveInitialized` guard — swallowing whatever discrete mutation lands next. Continuous
typing self-heals on the next keystroke; a one-shot action like picking a song does not.
`ServiceEditorView.vue` also hand-duplicates the already-tested `useAutoSave` composable.
**Write a failing repro test FIRST** — do not rewrite blind.

### Other confirmed findings

- **Reconciliation deletion** touches 9 files + tests (`slideGroupMaterializer.ts`,
  `useSlideshowAssembly.ts`, `slideGroup.ts`, `slideGroups.ts`, `ReconcileConfirmModal.vue`,
  `SlideGrid.vue`, `SlidesTab.vue`, `slideDisplay.ts`, `ServiceEditorView.vue`). **Keep** the
  concurrent-write transaction merge in `replaceGroupSlides` even after the confirm gate goes.

- **Post-Service** is a one-place additive type change in `src/types/service.ts` (no migration), but
  print / share / plan-rail / PC-export need auditing for hard-coded four-section assumptions.

- **PPTX rendered images** belong under the existing `orgs/{orgId}/pptx-imports/{importId}/` prefix —
  structurally exempt from `cleanupExpiredMedia`'s regex guard with zero changes to that function.

- **CCLI copyright placement:** the real-world convention is "at least once per song, typically the
  last slide." The v1.4 requirement (first AND last) **exceeds** the legal minimum — a deliberate
  safety margin for mid-deck starts and songs cut short. Do NOT justify it as "CCLI requires this."
  Pull the actual license text before finalizing that acceptance criterion.

- **Draft-lock/reopen has no competitor precedent** — Planning Center Services gates on roles only.
  This is an original design call, not a convention being copied.

### v1.4 ROADMAP.md phase breakdown (created 2026-07-28)

9 phases (29-37), derived from `research/SUMMARY.md`'s 9-phase default with hard sequencing applied.
Departures from the research default, recorded explicitly per the roadmapper's instructions:

- Merged SUMMARY's "stable key/ordering model" and "Post-Service" phases into one **Phase 29** — R043
  ("the five sections...") textually presupposes Post-Service already exists, and Post-Service alone
  is too thin a phase under this project's `coarse` granularity setting.

- Moved **Phase 37 (PPTX rendering)** to the true end of the sequence (was mid-sequence in SUMMARY) —
  per the user's explicit milestone decision to schedule it last so an overrun/cut disturbs nothing else.

- Split SUMMARY's final "presentation correctness + CCLI + action bars" phase into two: **Phase 35**
  (presentation correctness + lyric editor, standard-pattern) and **Phase 36** (Service Order rebuild +
  contextual action bars, sequenced last among UI work) — kept separate so each has a coherent goal.

- **R053** (drop-zone-as-import + moving Add-slide/Add-music into the action bar) was moved from the
  Slides-interaction cluster into **Phase 36** because its own requirement text names R068 (the action
  bar) as its target — building it before Phase 36 would mean building it twice.

- **R054** (song groups read-only in Slides tab) was grouped into **Phase 30** (hard-lock/reconciliation
  removal) rather than with the rest of Slides interaction — ARCHITECTURE.md §3 treats it as the same
  "structural shape can no longer diverge" change that makes reconciliation deletable.

Full phase table, success criteria, and per-phase research/notes: `.planning/ROADMAP.md`. Traceability:
`.planning/REQUIREMENTS.md` (34/34 mapped, 0 unmapped).

### v1.3 code-complete record

| Phase | Plans | Code review | Notes |
|-------|-------|-------------|-------|
| 24 Slide Group Model and Migration | 6/6 | 1 critical + 2 warning, all fixed | See `24-REVIEW.md` / `24-REVIEW-FIX.md` |
| 25 Slides Tab Shell — Plan Rail and Slide Grid | 7/7 | 2 critical + 2 warning, all fixed | See `25-REVIEW.md` / `25-REVIEW-FIX.md`. Also carries the mid-phase D-18/D-19 model deletion. |
| 26 Edit Slide Drawer | 9/9 | 3 critical + 1 warning, all fixed | See `26-REVIEW.md` / `26-REVIEW-FIX.md`. **Closed Phase 24+25's deferred reconciliation-confirm debt.** |
| 27 Service Order Tab — Rename and Strip Slide Editing | 5/5 | **0 critical**, 1 warning fixed | See `27-REVIEW.md` / `27-REVIEW-FIX.md`. Clean removal — reviewer traced all load-bearing paths end to end. |
| 28 Song Lyrics Editor Rework | 6/6 | **0 critical**, 2 warnings fixed | See `28-REVIEW.md` / `28-REVIEW-FIX.md`. **Final phase of v1.3.** |

**Phase 28 shipped (design option 2a, chosen by the user — the milestone's one mandated design choice):**
`src/utils/songSectionOrder.ts` (pure pool+order model and helpers), one scroll surface with one
numbered, collapsible, drag-reorderable section list that IS the slide order, `Duplicate` / `Remove` /
`＋ Add section`, and an R035 acceptance suite (`SongLyricsTab.r035.test.ts`) that asserts *no nested
scrollbar* and *exactly one list* as counts over the mounted subtree rather than by eye.
Option **2b** (the "Switch to Sections to reorder" mode toggle, including its `Lyric sheet` segment) is
**deferred, not built**.

**Two latent defects found and fixed during Phase 28:**

- **Compounding reconciliation bug (28-03).** `reconcileSongGroup` pushed the WHOLE `storedBySectionId`
  array on every occurrence of a section id. Once D-02 made repeats first-class, a twice-referenced
  chorus with two stored entries compounded 2 → 4 → 8 → 16 — on the **additive** path, which has no
  confirm gate. Fixed by consuming stored entries positionally (occurrence `i` takes entry `i`, surplus
  emitted after the last occurrence), which keeps Phase 26-09's duplicate-survival case byte-equivalent.
  Idempotence asserted for N=M, N<M and N>M, and independently hand-traced by the reviewer.

- **Two competing order fields (28-02).** Order lived in BOTH `Song.performanceOrder` and
  `SongLyrics.performanceOrder`, behind a 3-tier precedence chain duplicated in `slideshowAssembler.ts`
  and `slideGroupMaterializer.ts` — and `PerformanceOrderBuilder` **read one but wrote the other**, so
  its displayed order never reflected what it saved. Collapsed to one canonical source;
  `Song.performanceOrder`, its writer action, the precedence chain and `PerformanceOrderBuilder.vue`
  are all deleted (D-19).

**One unrequested removal caught and reverted:** plan 28-04 dropped the editor's read-only CCLI
copyright block. No decision authorized it and R035 says nothing about it, so 28-06 restored it inside
the single scroll region. The `CopyrightSlide` emission path was verified never affected.

**Phase 28 items for batch human-verify:** the reworked editor's feel with a real multi-repeat song;
that a CCLI paste of a song with repeated choruses folds into pool references rather than duplicates;
and that editing a repeated section visibly updates every occurrence.
| 28 Song Lyrics Editor Rework | 6/6 | Not run (no `/gsd-code-review` invoked this phase) | R035 proven by assertion in `28-06`'s acceptance block; restored the CCLI copyright display 28-04 dropped without a decision. Full unit suite failing-file-set unchanged from the 10-file baseline. |

**Phase 27 shipped:** first tab renamed **Music → Service Order** (label AND the `activeTab` union value,
now `'service-order' | 'roles' | 'slides'`); the deck editor, both PPTX-import menu entries, the per-slot
media control and the slideshow preview stripped off it; `ImportedSlideEditor`, `SlotMediaAttachment` and
`SlideshowPreview` deleted with their tests (D-02/D-19); and the `▶ Present` CTA moved to the Slides tab.

**Two ROADMAP premises proved false during Phase 27** — it claimed the phase "runs after 25-26 so the
functionality has a new home before it leaves the old one." That was wrong twice, and both were caught
before anything broke:

- **Scripture editing (D-01):** Phase 26's "Edit in scripture" link navigates *back* to this tab.
  Resolved by keeping `ScriptureSlideEditor` on Service Order — choosing the passage and reading mode is
  service-order content, not slide editing.

- **Presenting (D-05, user decision):** `SlideshowPreview` carried the ONLY trigger for Phase 23's
  `PresentationViewer`, and the Slides tab had no present affordance. Resolved by moving `▶ Present` to
  the Slides tab — the one new affordance Phase 27 was authorized to build.

**Phase 27 kept deliberately** (verified intact by review): Phase 24 D-01's lazy `ServiceSlot.id`
backfill (production data), the section-assignment `<select>` (D-04), the group delete cascade + warning,
the `expandScriptureEditor` / `handleNavigateToScriptureEditor` relay, the group-bed audio write path,
and autosave. `PptxImportModal.vue` survived (`SlideGrid` imports it) as did `PresentationViewer`.

**Known pre-existing dead code, deliberately NOT touched:** `isSlotPopulated` in `ServiceEditorView.vue`
has been unreachable since Phase 12-05. Out of scope for a removal phase that had already closed —
flagged in `27-REVIEW.md` as IN-01 for a future cleanup.

**Phase 26 shipped:** `EditSlideDrawer.vue` (scrimless floating panel that follows the grid selection),
`ReconcileConfirmModal.vue`, per-kind slide text keyed on `sourceRef.kind`, "Edit in song" via a new
`songEditLink.ts` query convention (`/songs` had no per-song route), "Edit in scripture" via new
`SlideGrid → SlidesTab → ServiceEditorView` relay plus an expand-only entry point, slide audio with
scope + loop, `Duplicate`, and delete behind a warning naming what is lost.

**Phase 26 closed the reconciliation debt** Phases 24 and 25 both deferred: `SlideGroup.dismissedSignature`

+ `dismissReconciliation` give a per-divergence durable dismissal, and `ReconcileResult.songSwap` carries

the old/new song ids so the song-identity-swap confirm (Phase 24's CR-01 blocker) can name both songs.
The Phase 25 limitation where a diverged group was stuck showing a passive banner is resolved.

**Latent defect found and fixed during Phase 26 (26-09 Task 1):** `reconcileSongGroup` indexed stored
lyric entries into a `Map` keyed by `sectionId`, so a *duplicated* lyric entry would have been silently
dropped on the next additive reconciliation — with no confirm gate, because the additive path has none.
Fixed (`storedBySectionId` is now an array) before `Duplicate` shipped.

**Phase 26 items for batch human-verify:** drawer floats with no reflow underneath (R033); the grid stays
clickable with the drawer open (no scrim, D-03); whether the reconciliation warning is concrete enough
WITHOUT a diff (D-06 — the user traded the diff away, so this is the accepted-trade-off check); and both
"Edit in song" / "Edit in scripture" links landing correctly.

**Known Phase 26 stub:** `audioDurationText` is permanently unset — the shared `AudioPlayer.vue` uses
`preload="none"` and exposes no duration signal. Documented rather than worked around.

**Phase 25 shipped:** the third **Slides** tab in `ServiceEditorView`; `src/components/slides/`
(`SlidesTab`, `SlidePlanRail`, `SlideGrid`, `SlideCard`, `SlideDropTarget`, `SlideGroupMusicControl`,
`slideDisplay.ts`, `dropRouting.ts`); a real `VideoSlide` type (D-17); deletion of the bed-video model
and all slide-area legacy paths (D-18/D-19); `ensureGroupMaterialized`; within-group drag-reorder; and
a four-kind drop target (PPTX/image/video append slides · audio sets the group bed).

**Two Phase 25 items to confirm at batch human-verify:**

- Real OS drag-and-drop of a file onto the grid — jsdom cannot produce a genuine `DataTransfer` with
  real `File` payloads, so this is manual-only. `docs/example.pptx` and `docs/example.mp3` are in the
  tree as fixtures. See `25-07-SUMMARY.md` `<human-check>`.

- **Behavioral decision (25-REVIEW-FIX WR-01):** a video slide now **suppresses the group's bed audio**
  for its own duration, with the bed resuming on the next slide that has none — applying Phase 24
  D-04's "slide beats group" precedence to video. Confirm this is the wanted behavior.

**Known Phase 25 limitation (deliberate, documented in `25-05-SUMMARY.md`):** if a user hand-adds
slides to a plan item and THEN assigns a scripture passage or deck to it, the group's signature
diverges and the hand-added entry counts as customization, so reconciliation routes to the
confirm-required path — whose dialog is Phase 26. Until Phase 26 ships, such a group shows the passive
banner and no source slides. This is correct under Phase 24 D-02 ("never silently drop a user's added
slide"), not a bug. Also: no keyboard reordering (SortableJS doesn't provide it) — flagged, not
silently omitted.

## ★ v1.3 STANDING DECISIONS — apply to every remaining phase (25-28)

Captured from the user mid-run on 2026-07-26. Full text and rationale live in
`.planning/phases/25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium/25-CONTEXT.md` as
**D-18** and **D-19**. Recorded here because later phases read STATE.md, not Phase 25's context.

### No bed video — video is slide-only (D-18)

> "We won't ever have a bed video where a video plays over a whole group of slides. We can do that for
> audio, but a video slide will only ever be a slide and will never play over a group of slides."

`SlideGroup.bedVideoUrl`, `SlideBase.videoUrl`, `videoFromBed` and all bed-video rendering were
**deleted** in 25-02 (not deprecated). The group bed is **audio-only**. Group-bed AUDIO and per-slide
audio (with slide-beats-bed precedence and cross-group continuity) are kept, wanted features.

### No legacy compatibility anywhere in the slide area (D-19)

> "There is no need to keep legacy behavior for any work related to adding slides. That work has never
> been used or seen by anyone yet. So, we don't need to migrate anything or keep any old data."

> "for Phase 28 we can also skip any migration of data. We haven't used that in production either,
> so it's all greenfield." *(user, 2026-07-26 — extends D-19 explicitly to Phase 28)*

**Do NOT write migrations, deprecation shims, or read-time fallbacks for slide-area or song-lyrics
data.** Change the model directly and update the tests.

#### The boundary — check this before deleting anything

| Side | Scope | Rule |
|------|-------|------|
| **GREENFIELD** — delete freely | Everything from **Phase 18 onward**: slide groups, slide/group media, slideshow assembler, PPTX import, scripture slides, presentation/preview surfaces, **and the Phase 18 song-lyrics / performance-order structures Phase 28 reworks** | Never deployed, never seen by a user. No migration, no fallback, no deprecated field. |
| **PRODUCTION** — must preserve | `Service` / `ServiceSlot`, and the `Song` catalog records themselves | Shipped in **v1.0 (2026-03-05)**, human-verified against a real Planning Center account. Real data exists. |

Notably **Phase 24 D-01's lazy `ServiceSlot.id` backfill-on-read STAYS** — it guards real service
documents and is the one legacy path explicitly on the keep side.

For **Phase 28**: `Song` records and the catalog are production data; `Song.lyrics` and
`performanceOrder` as *structured by Phase 18* are greenfield and may be reshaped without migration.

Already actioned under D-19 (in 25-02 + its follow-up): the D-05 slot→group media migration, the
WR-02 `displaySlotAudioUrl`/`displaySlotVideoUrl` fallbacks, `MediaAttachableSlot.audioUrl`/`videoUrl`,
and `SlotMediaAttachment.vue`'s video-attach affordance are all deleted.

> **Migration note (2026-07-24):** This milestone was scoped and partially built in gsdpi
> (`.gsd/` milestone M001, slices S01-S06) and faithfully ported into gsd-core as v1.2.
> The gsdpi `.gsd/` store is now legacy/read-only — continue with regular `/gsd-*` commands.

## ⏸ RESUME HERE (2026-07-28 — v1.4 roadmap created, ready to plan Phase 29)

**v1.2 and v1.3 are both archived; v1.4's ROADMAP.md and REQUIREMENTS.md traceability are now filled**
(Phases 29-37, 34/34 requirements mapped, 0 unmapped). Working tree clean; `npm run type-check` 0,
`npm run build` green, `npx vitest run src/` 3581 passing with the failing FILE SET at the documented
10-file pre-existing baseline (8 `.gsd/quarantine/worktrees/**` duplicates, `storage.rules.test.ts`,
`RosterView.test.ts`).

**Deferred Verification is empty project-wide.** No phase is mid-flight.

### What changed in this cleanup (2026-07-28)

| Change | Why |
|---|---|
| v1.2 archived | Owner accepted its outstanding checkpoints rather than running them |
| v1.3 phases 24-28 marked complete, then archived | Owner verified; owner-attributed VERIFICATION files written so `phase.complete` could run |
| `workflow.verifier` **false → true** | Root cause of both milestones looking permanently unfinished. Before this, `/gsd-autonomous` would have re-executed all of v1.3. |
| Requirements split | R028-R035 extracted from the misnamed `v1.2-REQUIREMENTS.md` into `v1.3-REQUIREMENTS.md` |
| Phase 5 (Tasks & Events) **dropped** | Never started; owner: *"we don't need those"*. TASK-01..03 / EVNT-01..04 marked dropped. |
| Backlog 999.1 **kept** | Shared song-browse extraction — duplication verified still present in `SongSlotPicker.vue` vs `SongFilters.vue` |
| AUTH-03/04 traceability fixed | Pointed at Phase 5 (now gone); actually completed in Phase 7 |
| v1.4 ROADMAP.md created | Phases 29-37, derived from `.planning/research/SUMMARY.md`'s 9-phase sequence with hard sequencing constraints applied (ordering fix first, PPTX rendering deliberately last) |
| v1.4 REQUIREMENTS.md traceability filled | 34/34 requirements (R036-R069) mapped to exactly one phase each, 0 unmapped |

### Next step

**`/gsd-plan-phase 29`** (optionally preceded by `/gsd-discuss-phase 29`) — Phase 29 (Order Structure —
Stable Reordering & Post-Service) is first: it's foundational, everything else in v1.4 either depends on
it directly or transitively. Phase 37 (PowerPoint Server-Side Rendering) is deliberately last — highest
uncertainty, independently cuttable without disturbing anything else. See `.planning/ROADMAP.md` for the
full phase table, success criteria, dependency graph, and per-phase research/notes.

## ✅ RESOLVED 2026-08-03 — the wireframes were re-pulled, and Turn 3 covers the Service Order tab

**The stale-wireframe blocker below is now PARTLY resolved — I fetched the file myself.**

`DesignSync` can read the Claude Design project directly, so no manual export was needed:

```
DesignSync get_project  projectId=e8e6c287-3e88-402f-88e1-7ad6d5101fa2   → readable, canEdit:true
DesignSync list_files   → "Slides Tab.dc.html", support.js, 11 uploads
DesignSync get_file     path="Slides Tab.dc.html"
```

The file had grown **49 KB → 93 KB** since 2026-07-25 and gained **Turn 3 — Service Order tab**
(variant `3a`, "Inline editing inside section bands": five section bands, per-section ＋ Add item,
the add-to-service palette, a slide count on every row). `docs/design/slides-tab.dc.html` and its
README are refreshed.

**What this changes:**

| | Before | Now |
|---|---|---|
| **Phase 35 (R065, R066)** | design source unavailable | ✅ **available** — Turn 3 carries `Paste lyrics` and `No copyright information found`, the exact wireframe for the inline paste treatment and the missing-copyright warning |
| **Phase 36 — Service Order rebuild** | no wireframe | ✅ **Turn 3 is the wireframe** |
| **Phase 36 — contextual action bar (R068)** | no wireframe | ❌ **still absent** — zero matches for `action bar`/`contextual` in the refreshed file |
| Phase 33's affordances | absent | still absent — Phase 33 correctly shipped them as original design work |

**So Phase 36's blocker is half-removed.** Its rebuild half now has a real wireframe; its action-bar
half is still original design work. The owner skipped 36 earlier **on the premise that neither half
had one** — that premise is now outdated and the decision is worth revisiting.

**The original open item, kept for provenance:**

## ⚠ OPEN ITEM FOR THE OWNER — the design wireframes are stale, and Phase 36 depends on them

**Found 2026-08-02 during Phase 33 discuss. Survives compaction deliberately — re-read before Phase 36.**

`docs/design/slides-tab.dc.html` was pulled **2026-07-25**. Its own README states the remote file is
*"cumulative across design turns and is overwritten in place — **re-pull before planning any phase
against it**."* Verified contents of the current copy: **only two screens** — Turn 1 (Slides tab:
plan rail, slide grid, the single Edit Slide drawer) and Turn 2 (Song lyrics editor, options 2a/2b).

**What is NOT in it:**

| Needed by | Missing from the mockup |
|---|---|
| Phase 33 (R051, R052) | any 3-dot / kebab menu; "Edit details" / "Edit lyrics" |
| Phase 33 (R055-R057) | background images as a feature — all 106 `background` matches are CSS declarations |
| **Phase 36 (R068 + the rebuild)** | **any Service Order screen at all; any contextual action bar** |

**Two ROADMAP premises are therefore false as written:**

1. Phase 33's note — *"Confirm against the Claude Design wireframes at plan time which drawer a given
   slide's 3-dot menu opens"* — cannot be satisfied; the mockup predates the menu.

2. **Phase 36's goal — *"The Service Order tab is rebuilt against the Claude Design wireframes"* — has
   no wireframe behind it, nor behind the action-bar half.**

Same class as Phase 27's two false premises, which were caught before anything broke.

**Owner action, if newer turns exist:** re-pull `Slides Tab.dc.html` from the Claude Design project
`e8e6c287-3e88-402f-88e1-7ad6d5101fa2` ("Worship Planner Slideshow Design") into `docs/design/`.

**How the autonomous run is proceeding meanwhile:** Phase 33's new affordances are being treated as
**original design work**, settled and reviewed through the UI-SPEC step rather than transcribed from a
mockup. Phases 34 and 35 do not depend on the wireframes. **Phase 36 does** — if this is still
unresolved when the run reaches it, that phase either becomes original design work too (a materially
different deliverable from "rebuild against wireframes") or should be deferred. Raise it there.

## ⚠ FIVE FALSE ROADMAP/REQUIREMENT PREMISES FOUND THIS RUN — read before trusting a phase note

All five were caught before anything was built on them, and all are recorded in their phase's
CONTEXT.md. Listed together because the pattern matters: **the v1.4 planning docs were written before
several of the things they describe already existed or changed.** Verify a phase note against live
source before planning on it.

| # | Premise as written | Reality |
|---|---|---|
| 1 | Phase 33: *"confirm against the Claude Design wireframes which drawer a given slide's 3-dot menu opens"* | The wireframes predate the menu entirely — no 3-dot menu, no Edit details/Edit lyrics, no background feature |
| 2 | Phase 36: *"the Service Order tab is rebuilt against the Claude Design wireframes"* + the action bar | **No Service Order screen and no action bar exist in the export at all.** See the OPEN ITEM above — still unresolved |
| 3 | R052: the change replaces *"the multi-tab single drawer"* | `EditSlideDrawer.vue` had **sections, not tabs**. Intent honoured, premise corrected — tabs were not built just to remove them |
| 4 | R064: *"requires upgrading `@anthropic-ai/sdk` from the current `^0.78.0` pin, which predates the structured-outputs support this depends on"* | **False.** Structured outputs went GA in SDK **0.72.0**; 0.78.0 already ships `output_config.format`, `messages.parse()`, and `jsonSchemaOutputFormat`. Verified by extracting the installed tarball and reading its `.d.ts`. The upgrade is hygiene, not a gate. |
| 5 | Phase 34: validate *"at the existing single Cloud Function proxy choke point"* | **Unimplementable as written.** `functions/src/index.ts` is a byte-blind pass-through with no SDK dependency that **never sees the ESV source text** (the browser fetches it separately). A proxy that cannot see the source cannot byte-match it. Validation stays client-side. |

**Phase 34 also gained a design stronger than its requirement:** boundary indices instead of raw
character offsets, constraining the model to integer indices into a pre-computed array of legal split
positions. This makes mid-sentence splits **structurally unrepresentable** rather than merely
validated-against — strictly stronger than R064 asks for.

## ★ OWNER DECISION 2026-08-03 — Phase 36 is DEFERRED, this run does 35 and 37 only

Asked mid-run and answered by the owner: **"Do 35 and 37, skip 36."**

**Why 36 was skipped:** its goal — *"the Service Order tab is rebuilt against the Claude Design
wireframes, and one contextual action-bar pattern is applied across every tabbed screen"* — has **no
wireframe behind either half** (see the OPEN ITEM above). Phase 33 absorbed the same gap by treating
its affordances as original design work, but 36 is a *rebuild against* wireframes, so building it from
invented ones risks doing it twice.

**To resume Phase 36:** re-pull `Slides Tab.dc.html` from the Claude Design project
`e8e6c287-3e88-402f-88e1-7ad6d5101fa2` into `docs/design/`, then `/gsd-autonomous --only 36`.
**R053 rides along with it** — the drop-zone-as-import rework and moving Add-slide/Add-music into the
action bar were deferred from Phase 33 into 36 by the ROADMAP's own reasoning.

**Also still open from this run:** Phase 34's reachability gap (`/gsd-plan-phase 34 --gaps`) — see below.

## ▶ v1.4 AUTONOMOUS RUN — SECOND PASS IN PROGRESS (2026-08-03)

**Invoked:** `/gsd-autonomous` (no flags) after the owner supplied five hands-on UAT findings.

**Done this pass:** **Phase 34 COMPLETE** — 8 gap-closure plans (34-05..34-12), 35 commits, re-verified
`human_needed` at **12/12 truths**, zero gaps. The reachability gap that made Phase 34 partial is closed:
`CongregationalEditor` is mounted at `ServiceEditorView.vue:570`, keyed on the slot id, reachable from
two converging slide-side routes. Owner findings F1–F5 all addressed; **R070** (background at
presentation) and **R071** (PC-export gating UX) added. F5 was a misdiagnosis — Export to PC was never
removed, the org document simply has no credentials; no fix was manufactured. ROADMAP checklist
corrected for Phases 32–35, which the first pass left unchecked.

**Remaining in this pass:** **Phase 36** — discuss → ui-phase → plan → execute, then the milestone audit.
Phase 36 is now unblocked: both wireframes its success criteria name (`Turn 3 — Service Order tab` and
`1a Plan rail · slide grid · Edit Slide drawer — two states`) are confirmed present in the re-pulled
`docs/design/slides-tab.dc.html`. R068's action-bar half remains original design work with no wireframe.

**Open human items:** `PENDING-VERIFICATION.md` 34.1, 34.3, 34.4, 34.5, 34.6 — none self-approved.

---

## ✅ v1.4 AUTONOMOUS RUN COMPLETE — 2026-08-03 (first pass)

**Scope run:** Phases 32, 33, 34, 35, 37. **Phase 36 deferred by owner decision** (see above).

| Phase | Result |
|---|---|
| 32 Save Reliability | ✅ complete · 3/3 must-haves · **3 Critical review findings fixed** |
| 33 Backgrounds & Slide Editing | ✅ complete · 5/5 criteria, 7/7 requirements · 4 findings fixed |
| 34 LLM Scripture Split | ✅ **RESOLVED 2026-08-03 (34-07)** · reachability gap closed — `CongregationalEditor` mounted on the scripture slide, R064 marked complete |
| 35 Presentation Correctness | ✅ complete · **5/5 criteria** · 1 Warning + 1 Info fixed |
| 37 PPTX Server-Side Rendering | ⚠ **PARTIAL** · 3/4 · pipeline built & tested, **undeployed by instruction** |

**Suites at end of run:** app 2221/2222 scoped (1 = `RosterView.test.ts` baseline) ·
`functions/` 70/70 · `render-service/` 39/39 · `npm run type-check` clean · `npm run build` succeeds.

### Phase 37 — built, tested, NOT deployed

**`37-VERIFICATION.md` is `human_needed`. R062 is `[~]` partial — the honest call, confirmed by the
verifier.** Criterion 1 ("displays as a true visual rendering") is **uncertain, not failed**: the
pipeline is complete and tested, but the service is **undeployed by explicit owner instruction** and
**no UI consumes the rendered images** (37-CONTEXT.md scoped client-side display out).

**★ NOTHING WAS DEPLOYED, CONTAINERIZED, OR PROVISIONED.** Independently audited twice — every
`gcloud` / `firebase deploy` / `docker build` hit across all Phase 37 commits is documentation prose.
**`render-service/DEPLOY.md` is the handoff**: both IAM directions, Artifact Registry, region,
memory/CPU, timeout, concurrency, and env vars including `STORAGE_BUCKET` and
`PPTX_RENDER_CLEANUP_ENABLED` (documented as safe when unset).

**⚠ A gap in this phase's treatment, stated plainly: no code review was run for Phase 37.** Phases 32,
33 and 35 each got one and each surfaced real defects. Phase 37 was skipped for orchestrator context
budget, not because it was judged unnecessary. **Consider `/gsd-code-review 37`** — its test discipline
was unusually strong (three separate load-bearing proofs), but that is not a substitute.

**⚠ Client-side display of rendered images has NO HOME in the roadmap.** It is not deferred to a later
phase — no phase picks it up (36 is unrelated UI work). It is an owner-decision item, recorded as
`PENDING-VERIFICATION.md` items 37.1/37.4.

**Two package-legitimacy checkpoints are DEFERRED, never approved** — `express`,
`@google-cloud/storage`, `@types/*` (37-01) and `google-auth-library` (37-03). Item 37.5.

**⚠ Bare `npx vitest run src/` is contaminated** — it picks up `render-service/src/render.test.ts` via
substring matching and fails on a Vitest version mismatch (root `4.0.18` vs `4.1.10`). **Not a
regression.** Scope the app run, or run each suite from its own directory.

### What needs the owner, in priority order

1. **`/gsd-plan-phase 34 --gaps`** — the scripture split is unreachable. R047 explicitly handed the
   mount to Phase 34 and it wasn't done. Direction is already decided (slot-as-source-of-truth): extend
   `ScriptureSlot` with `congregationalSections` through `slideGroupMaterializer`, then mount.

2. **`/gsd-autonomous --only 36`** — now unblocked; the wireframe's Turn 3 covers the Service Order
   rebuild. Its action-bar half (R068) remains original design work.

3. **`.planning/PENDING-VERIFICATION.md`** — the human-verify pass across Phases 31-35 and 37.
4. **`render-service/DEPLOY.md`** — when you want the renderer live.
5. **CCLI's primary licence text** — failed retrieval twice; R060's criterion isn't final without it.

## ⏸ RUN STATE (superseded by the completion block above — kept for provenance)

**Owner scoped this run to Phases 35 and 37; Phase 36 deferred (see the decision above).**

| Phase | State |
|---|---|
| 32, 33 | ✅ complete, `verification_deferred_human` |
| 34 | ⚠ **PARTIAL** — `verification_deferred_gaps`, resume `/gsd-plan-phase 34 --gaps` |
| 35 | ✅ complete, `verification_deferred_human` |
| 36 | ⏸ deferred by owner — **wireframe now exists** (Turn 3), resume `/gsd-autonomous --only 36` |
| **37** | **◆ IN PROGRESS — 4 of 6 plans done.** Waves: 1 ✅(37-01, 37-03) · 2 ✅(37-02, 37-04) · **3 ← next (37-05)** · 4 (37-06) |

**Phase 37 remaining work:**

- **37-05** (wave 3) — orphan cleanup with the **dry-run default** mirroring `functions/src/index.ts:257`
  (`process.env.X !== "true"` ⇒ dryRun), plus the `renderImportId` bridge field on
  `src/types/importedDeck.ts` and `PptxImportModal.vue`.

- **37-06** (wave 4) — writes `render-service/DEPLOY.md` (the `gcloud run deploy` handoff), the
  Phase 37 section of `PENDING-VERIFICATION.md`, and runs the three-suite gate. **37-06 owns
  `requirements mark-complete R062`** — every earlier plan correctly declined it.

**★ NOTHING HAS BEEN DEPLOYED, CONTAINERIZED, OR PROVISIONED**, and nothing may be. Verified per plan.

**Two open items for 37-06's DEPLOY.md:** `STORAGE_BUCKET` is a required Cloud Run env var (37-02
found `@google-cloud/storage`'s `bucket()` needs an explicit name, unlike `firebase-admin`'s default
form), and **two package-legitimacy checkpoints are DEFERRED, never approved** — `express`,
`@google-cloud/storage`, `@types/*` (37-01) and `google-auth-library` (37-03). Both are recorded in
their SUMMARYs for 37-06 to transcribe as `PENDING-VERIFICATION.md` item 37.5.

**⚠ A gate command is now contaminated.** Root `npx vitest run src/` picks up
`render-service/src/render.test.ts` via Vitest's substring path filter and fails on a version mismatch
(root `4.0.18` vs render-service's pinned `4.1.10`). **Not a regression** — `cd render-service && npx
vitest run` passes 39/39 directly. Logged in the phase's `deferred-items.md`. Use per-suite commands.

**Suite counts at this point:** app `src/` ~2284 passing / 9 baseline failures ·
`functions/` 55/55 · `render-service/` 39/39.

## ⛔ v1.5 AUTONOMOUS RUN STOPPED BEFORE MILESTONE LIFECYCLE — 2026-08-09, and why

The `/gsd-autonomous --from 46` run executed the last three v1.5 phases (46 Global Slide Typography,
47 Congregational Reading Divider UX, 48 Multi-Image Ordering & Mobile Polish) discuss→plan→execute,
each with code review + fixes and goal-backward verification. **All 11 v1.5 phases are now
code-complete.** The autonomous workflow's next step is the milestone lifecycle — **audit → complete
→ cleanup**, which archives v1.5 and deletes phase directories. **That was deliberately NOT run.**

**Why.** 7 of the 11 phases — **39, 43, 44, 45, 46, 47, 48** — are `verification_deferred_human`:
code-complete and code-verified, but their hands-on owner checks were deferred under the v1.5
standing autonomy grant, never performed. Archiving the milestone in that state would, in substance,
bless seven phases of deferred checks as passed. The grant is explicit that this is the one thing
deferral must never become: *"Never record a deferred check as passed. 'Skip the checkpoint' means
defer and disclose, not self-approve."* This is the same boundary the v1.4 run stopped at
(2026-08-05) for the same reason.

**Nothing is lost by stopping.** No phase work remains — only the owner's verification pass does.
Every deferred phase has code-verified must-haves (39: 4/4, 43: 5/5, 44: 10/10, 45: 7/7, 46: 18/18,
47: 16/16, 48: 13/13), type-check clean, and the app `src/` suite at the documented 2-file baseline.

**Deploy status (v1.5):** Phases 46/47/48 are **NOT deploy-gated** (pure client bundle — self-hosted
`@fontsource` fonts, client-only congregational editor, client-only mobile/layout polish). The
outstanding v1.5 deploys remain the earlier owner-gated ones: Phase 40/40.1 (custom-claims function +
backfill + `storage.rules` + tightened `firestore.rules`, two-deploy soak), Phase 41
(`firestore.rules` sharing loosening), Phase 45 (NLT proxy function + `NLT_API_KEY` secret — and
because `bibleVersion` defaults to NLT, frontend + function must deploy together). See each phase's
section in `PENDING-VERIFICATION.md` and `functions/DEPLOY-ORG-CLAIMS.md`.

### What the owner does on return

1. Work through `.planning/PENDING-VERIFICATION.md` — v1.5 items are under §§ Phase 39, 43, 44, 45,
   46, 47, 48 (Phase 48 newest). Starred/highest-value: **39.03-1** (PC credential retention across
   reload), **48.4** (owner decision: Print/Share narrowed to the Service Order tab).

2. Run `/gsd-verify-work 39` · `43` · `44` · `45` · `46` · `47` · `48` as each phase's items pass.
3. Run the owner-gated deploys (Phases 40/40.1/41/45) per their runbooks when ready.
4. Only then `/gsd-audit-milestone` → `/gsd-complete-milestone v1.5` → `/gsd-cleanup`.

---

## Deferred Verification

### v1.6 — ✅ PHASES 51–57 OWNER-ACCEPTED AT CLOSE 2026-08-12

> **Milestone closed 2026-08-12.** v1.6 deployed to production (`firebase deploy --only hosting`;
> firestore.rules delete-fix deployed same day) and the 2026-08-12 owner follow-up batch confirmed
> working in production. The owner accepted Phases 51–57 as verified (owner-attributed, v1.4/v1.5
> precedent) — the rows below are retained as the accepted-by-use record, not open work. See
> `PENDING-VERIFICATION.md` § "v1.6 PHASES 51–57 ACCEPTED AS VERIFIED".

| Phase | State | Resume |
|-------|-------|--------|
| 51 | verification_deferred_human — **4/4 ROADMAP criteria verified automatically**. All four source fixes present in code: R110 nonce-rebuild + `destroySectionSortables()` in BOTH `ServiceEditorView.vue` (`onSlotSortEnd`) and `ServiceTemplateEditor.vue` (`onTemplateSortEnd`); R111 `stripUndefined` in `updateService`; R112 `orderSlotsBySection` in `ServiceCard.vue` + `buildServiceSnapshot`. RED-first repros genuine (physical DOM node move between section containers, not false-green). `npm run type-check` clean, app suite 2994 pass at the 2-file baseline, 373/373 phase tests. **NOT deploy-gated** (client-only). 3 owner checks in `PENDING-VERIFICATION.md` § Phase 51: real OS cross-section drag (no phantom, no refresh) in both editors, live No-Section save with no error toast, empty-Miscellaneous order on the live listing + share link | /gsd-verify-work 51 |
| 52 | verification_deferred_human — **4/4 ROADMAP criteria verified in code** (R113 cog on ServicesView + Services card/dead-imports removed from SettingsView; R114 "Suggested Template" label, `template-reset` testid kept, no VW gate; R115 `createService` seeds `buildSuggestedTemplateEntries()` when template empty — defined ONCE, shared with the button — purity `buildSlotsFromTemplate([],true)→[]` intact; R116 `ServiceTemplateEntry.body?` + guarded `createSlot` body spread + `template-item-body` textarea, absent-body shape intact). `npm run type-check` clean, app suite 3009 pass at the 2-file baseline. **NOT deploy-gated** (client-only). 3 owner checks in `PENDING-VERIFICATION.md` § Phase 52: cog opens editor + gone from Settings, new service from unset template starts from Suggested Template (not blank), MISC pre-filled body carries into a created service | /gsd-verify-work 52 |
| 53 | verification_deferred_human — **5/5 ROADMAP criteria verified in code** (R117 `slideBreaks?` + pure `sliceSectionIntoSlides` + BOTH lockstep assembler paths sliced + editor click-between-lines divider; R118 duplicate-as-unit test-proven with ZERO slideGroupMaterializer/duplicateRow change; R119 `'Pre-Chorus'` in ADD_SECTION_KINDS; R120 `deriveSectionKind` + per-kind `displayLabel` display-only, stored label immutable, bare-"Verse" bug fixed; R121 "Save" via existing `currentSectionCount`). BWC guards git-confirmed (unsplit sections byte-identical). `npm run type-check` clean, app suite 3050 pass at the 2-file baseline, 390/390 phase tests. **NOT deploy-gated** (client-only). 4 owner UATs in `PENDING-VERIFICATION.md` § Phase 53: hand-split an 8-line chorus → present → 2 slides, duplicate the split → both slides both occurrences, add a Verse after pasted Verse 1/2 → "Verse 3", new-song paste button reads "Save" | /gsd-verify-work 53 |
| 54 | verification_deferred_human — **9/9 must-haves verified in code** (R122 `notes?` on base `MediaAttachableSlot` — one shared `slot-notes-input` in the :891 wrapper, `flex flex-col sm:flex-row` responsive recipe, autosave `= value || undefined` so `stripUndefined` drops an emptied value (store-test-proven), read-only viewer text-interpolated no v-html; R123 `case 'MISC': return []` split, sibling MISC cases + `rebuildGroup` no-op UNCHANGED so existing blank + hand-added slides survive). `npm run type-check` clean, app suite 3059 pass at the 2-file baseline. **NOT deploy-gated** (client-only). 2 owner checks in `PENDING-VERIFICATION.md` § Phase 54: notes side-by-side desktop / stacked mobile consistent across kinds; a new MISC item shows no slides and a slide can still be added | /gsd-verify-work 54 |
| 55 | verification_deferred_human — **8/8 must-haves verified in code** (R124 auto-attribution removed at both render sites + dead imports gone, `scripture.ts`/R092 provenance UNTOUCHED, print/share independent; R125 `export-spinner` animate-spin gated on existing `isExporting`; R126 Roboto 6th `SLIDE_FONTS` family [300,400,500,600,700] OFL-1.1 + loader, Inter first/default + four unchanged, `@fontsource/roboto@^5.3.0` installed). `npm run type-check` clean, app suite 3063 pass at the 2-file baseline. **NOT deploy-gated** (client + one build dep). 4 owner checks + 1 `@fontsource/roboto` legitimacy sign-off in `PENDING-VERIFICATION.md` § Phase 55: no auto-version-in-preview (+ manual add works), export spinner on a real export, Roboto selectable/renders | /gsd-verify-work 55 |
| 56 | verification_deferred_human — **R127 + R128 shipped in code** (owner scope addition 2026-08-12; commits 8f72116, 84da0cd, 4ae5fbd, bde3e84). R127: optional `NonAssignableSlot.label?` + `ServiceTemplateEntry.label?` + shared `miscLabel()` helper drives the item's displayed name AND the PC-export title (`planningCenterApi.ts` MISC branch) AND print, in BOTH editors; distinct compact label input (not a second notes box), non-destructive (absent ⇒ "Miscellaneous"). R128: optional `ScriptureSlot.bibleVersion?` ('ESV'/'NLT') resolved as `slot.bibleVersion ?? org default` — wired into the version-dependent surfaces ONLY (PC export routing, `ScriptureInput` preview, `CongregationalEditor` split); materialization/preview/print are reference-only (documented no-op). `npm run type-check` clean, app suite 3112 pass at the 2-file baseline (+12 tests). **NOT deploy-gated** (client-only). Owner checks in `PENDING-VERIFICATION.md` § Phase 56: rename a MISC item + confirm the PC-export item title uses it; set a Scripture item to the non-default version + confirm PC export/preview fetch that version | /gsd-verify-work 56 |
| 57 | verification_deferred_human — **R129 shipped in code** (owner scope addition 2026-08-12; commits 49135fd, 162f967, 656e842). The 260811-vsr Service Order redesign applied to `ServiceTemplateEditor.vue`: `kindBadgeClass` EXTRACTED to shared `src/utils/slotTypes.ts` (imported by both editors so they can't drift), three-rail rows (handle · colored badge · field column · action rail), per-row ⋯ menu (`template-row-menu-*`) owning Move-to-section + Delete (inline `template-section-select` + `template-item-remove` removed), muted/dashed `template-no-section-band`, mobile stacking. Pure restyle + control-relocation — `ServiceTemplateEntry` shape and all behavior (SortableJS reorder, add-item, MISC label, save) preserved. `npm run type-check` clean, app suite green at the 2-file baseline (ServiceEditorView badge tests still green post-extraction). **NOT deploy-gated** (client-only). Owner check in `PENDING-VERIFICATION.md` § Phase 57: template editor visually matches the service editor (badges, ⋯ menu, No-Section band) on desktop + ~390px mobile | /gsd-verify-work 57 |

### v1.5 (historical — milestone shipped and archived 2026-08-10)

| Phase | State | Resume |
|-------|-------|--------|
| 39 | verification_deferred_human — **4/4 ROADMAP criteria verified automatically**; 5 UI-SPEC backstops outstanding, all recorded unchecked in `PENDING-VERIFICATION.md` § Phase 39 | /gsd-verify-work 39 |
| 43 | verification_deferred_human — **5/5 ROADMAP criteria + 12/12 sampled must-haves verified in code** (type-check 0, full suite at 2-file baseline); 4 owner checkpoints in `PENDING-VERIFICATION.md` § Phase 43. Code review: 0 Critical / 2 Warning / 1 Info — WR-01/WR-02 (PC export bucketing) filed as ROADMAP backlog 999.4 (pre-existing, not a phase regression); IN-01 is a deliberate documented choice | /gsd-verify-work 43 |
| 44 | verification_deferred_human — **10/10 must-haves verified in code** (type-check 0, full suite at 2-file baseline; ordinal VW mapping + empty-by-default createService + single merge point traced). Code review: 0 Critical / 2 Warning / 2 Info — **all 4 fixed** in-phase. 4 live-app owner checkpoints in `PENDING-VERIFICATION.md` § Phase 44 (empty-by-default creation, template round-trip, real drag feel, no-scrim/summary copy). ⚠ R087's "buildSlots fallback" wording was superseded by owner's dated 2026-08-07 EMPTY-fallback correction | /gsd-verify-work 44 |
| 45 | verification_deferred_human — **7/7 must-haves verified in code** (type-check 0, app suite at 2-file baseline, functions 115/115; R092 immutability proven by named invariant tests; NLT proxy key-overwrite + redactUrl + dual empty-body guard + [N] bracket convention verified). Code review: 0 Critical / 2 Warning / 3 Info — WR-01/WR-02/IN-01/IN-02 fixed, IN-03 pre-existing. ⚠ **DEPLOY-GATED**: NLT proxy ships UNDEPLOYED; owner must `firebase functions:secrets:set NLT_API_KEY` + `firebase deploy --only functions` — and because bibleVersion defaults to **NLT**, the frontend + function MUST deploy together or new scripture fetch fails. Live round-trip deferred in `PENDING-VERIFICATION.md` § Phase 45 | /gsd-verify-work 45 |
| 46 | verification_deferred_human — **18/18 must-haves verified in code** (type-check 0; app `src/` suite at 2-file baseline; R093/R094 wired end-to-end: `@fontsource` registry → `slideTypography` OrgSettings field → Settings card → all 3 render sites + presenter first-paint font gate). Code review: **2 Critical / 3 Warning / 2 Info — ALL fixed** (CR-01 grid/drawer bound the CSS var but never loaded the chosen family → now eager-loaded at the single `loadOrgContext` merge point; CR-02 presenter gate could hang on a rejected font load → now try/catch/finally always releases the gate). **NOT deploy-gated** (self-hosted `@fontsource` woff2, pure client bundle — no owner deploy needed). 4 owner items in `PENDING-VERIFICATION.md` § Phase 46: package-legitimacy sign-off (5 @fontsource pkgs, SUS = documented false-positive) + 3 projector checks (font-flash, legibility, Large-scale overflow) | /gsd-verify-work 46 |
| 47 | verification_deferred_human — **16/16 must-haves verified in code** (type-check 0; app `src/` suite at 2-file baseline; R095 hand-divide via click-between-verses snapped to `computeBoundaries` + 3-way chips, R096 three equal seeds → same `CongregationalSection[]` with AI hidden when `aiEnabled` off, R097 first-slide-reference gated on `isFirstSection`; ALL role reaches every render site; `SPLIT_SCHEMA` enum + `validateSplitResult` widened together; R092 capture-once preserved). Code review: **1 Critical / 3 Warning / 2 Info — ALL fixed** (CR-01 stale-AI-response overwrite guard; WR-01/WR-02 alignment correctness; WR-03 stable keys). **NOT deploy-gated** (client-only; the AI call already exists and is gated). 4 owner items in `PENDING-VERIFICATION.md` § Phase 47: touch discoverability, hand-division feel, projected 3-role legibility, WR-01/WR-02 sign-off | /gsd-verify-work 47 |
| 48 | verification_deferred_human — **13/13 must-haves verified in code** (type-check 0; app `src/` suite at 2-file baseline; R098 natural-order images-bucket sort, R099 responsive rail + 44px targets + additive SortableJS touch options with `*DraggableIndex`/`onEnd` byte-unchanged, R100 QuarterView stacking, R101 Print/Share → top bar / Delete stays bottom, R102 Undo→link + unconditional save-status flex, R103 dismissible Getting Started via guarded localStorage). Code review: **0 Critical / 3 Warning / 2 Info** — WR-01/WR-03/IN-01/IN-02 fixed; **WR-02 deferred to owner** (Print/Share narrowed to Service-Order tab). **NOT deploy-gated** (client-only). 4 owner items in `PENDING-VERIFICATION.md` § Phase 48: touch-drag correctness, 44px reachability, ~375px layout, WR-02 cross-tab sign-off | /gsd-verify-work 48 |
| 49 | verification_deferred_human — **8/8 must-haves verified in code** (type-check 0; app `src/` suite at 2-file baseline; R105 congregational reading now assembles to N+1 slides — a synthetic leading reference slide via `buildScriptureReferenceContent` on BOTH the stored-group and fallback paths, gated on `congregationalSectionsFromSlot(slot).length>0`; section slides text-only via `showReference = !slide.section` + PresentationViewer `v-if="!isCongregational"`; `isFirstSection` fully retired; approach B honored — `slideGroupMaterializer.ts` untouched, verified by git log; synthetic id `${slot.id}:ref`; WR-02-safe media — `groupId`+`audioFromBed`, no fabricated `groupSlideId`). No code review run (single-plan quick-style execution). **NOT deploy-gated** (client-only assembly/display). 1 owner item in `PENDING-VERIFICATION.md` § Phase 49: live projected render of a real reading (e.g. "1 John 4:1-2") — slide 1 reference alone, slides 2..N sections only, continuous background/bed across the transition. ✅ **Live render owner-verified 2026-08-10 (1 John 4:1-2) — Phase 49 FULLY VERIFIED** | ✅ done |

> Phase 39 is **code-complete and automatically verified**. Its code review found 1 Critical + 3
> Warnings, all fixed and independently re-verified at iteration 2 (`39-REVIEW.md` status: clean).
> What remains is only the owner's hands-on pass. The starred item is **39.03-1 — Planning Center
> credential retention across a real off → reload → on cycle**: the one item in the phase that could
> silently destroy user data if implemented wrongly. A unit test proves the handler never calls the
> clear path; only a real reload proves the value survives.

### v1.4 (historical — milestone shipped and archived 2026-08-05)

| Phase | State | Resume |
|-------|-------|--------|
| 32 | verification_deferred_human | /gsd-verify-work 32 |
| 33 | verification_deferred_human | /gsd-verify-work 33 |
| 34 | verification_deferred_human | /gsd-verify-work 34 |
| 35 | verification_deferred_human | /gsd-verify-work 35 |
| 36 | deferred_by_owner — **wireframe now EXISTS** (Turn 3) | /gsd-autonomous --only 36 |
| 37 | verification_deferred_human | /gsd-verify-work 37 |
| 38 | verification_deferred_human | /gsd-verify-work 38 |

> **Table corrected 2026-08-05 (autonomous re-entry).** Rows 32/33/34/37 were always deferred in
> substance — code-complete, `human_needed`, and itemised in `PENDING-VERIFICATION.md` under the
> standing autonomy grant — but earlier passes recorded them only there, not here. Autonomous phase
> discovery reads THIS table, so without these rows a re-entry would have re-queued four finished
> phases for discuss→plan→execute. Nothing about their status changed; only the bookkeeping did.

### v1.4 Phase 35 — Presentation Correctness & Lyric Editor (2026-08-03)

**Code complete, all gates green. `35-VERIFICATION.md` is `human_needed` — not `passed`.**
**5/5 success criteria verified against live source.** The four open items are genuinely
jsdom-unverifiable (projector legibility, the congregation-facing presented view, whether a mid-deck
start *feels* natural, wireframe fidelity of the paste region) and are logged as
`PENDING-VERIFICATION.md` items 35.1–35.4.

| Artifact | Outcome |
|---|---|
| Plans | 4/4 across 2 waves |
| Verification | `human_needed`, **5/5 criteria verified** |
| Code review | 0 Critical, 1 Warning, 3 Info; the Warning and one Info fixed (`a409c6e`, `9749385`) |
| Gates at `bd93726` | `npm run type-check` clean · `npx vitest run src/` 2253 passed / 9 failed (the two documented baseline files only) · `npm run build` succeeds |

**R060 was already satisfied and was closed with TESTS ONLY.** All three construction paths already
emitted the leading+trailing copyright bracket unconditionally — verified by `git diff` on
`slideshowAssembler.ts` and `slideGroupMaterializer.ts` coming back **empty for the whole phase**.
17 regression tests now pin it, including the rebuild path's self-healing from 0, 1 and 3 stored
copyright entries converging to exactly 2. **Adding emission code would have triple-emitted.**

**A test that passed for the wrong reason, found and fixed (WR-01).** `slideshowAssembler.test.ts`
asserted `expect(x).not.toBe('undefined')` — comparing against the **string**, so it passed trivially
even when the value was real JS `undefined`. Fixed test-only and **proven load-bearing** by
temporarily hardcoding `title: undefined`, confirming the corrected assertion fails, then reverting.
That is the fourth test-passing-for-the-wrong-reason found this run.

**Deliberate deletions** (recorded so they never read as breakage): `PresentationViewer.vue`'s
`sectionLabel` render (R059 — the field survives for grid organization at `slideDisplay.ts:95,143`);
`LyricPasteDialog.vue` and its test, replaced by the inline `LyricPasteRegion.vue` (R066 permits
exactly one paste path — `grep -rc 'LyricPasteDialog' src/` is 0).

**R065 followed the wireframe over my discuss-time call.** I had decided "advise, never block"; the
wireframe blocks with an **always-available override** (`Add anyway — I'll enter credits later`,
`slides-tab.dc.html:644`). The wireframe is right — an advisory line can be dismissed unread, an
override checkbox guarantees the user saw it, and it is not the hard block I was guarding against.

**CCLI's primary licence text failed retrieval a SECOND time (2026-08-03).** R060 says it "should be
pulled before this criterion is treated as final." Nothing in the phase cites CCLI as a mandate —
`grep -rEin 'ccli (requires|mandates|requirement)' src/` returns 0 — so this does not block, but the
criterion is not finalised until the owner pulls that text from their CCLI account.
| 32 | verification_deferred_human | /gsd-verify-work 32 |
| 33 | verification_deferred_human | /gsd-verify-work 33 |
| 34 | verification_deferred_gaps | /gsd-plan-phase 34 --gaps |

### ★ v1.4 Phase 34 — Smarter Content: LLM Scripture Split (2026-08-03) — **PARTIAL, and the gap is real**

`34-VERIFICATION.md` is **`gaps_found`, 7/8 must-haves** — not passed, not merely human-needed.

**What IS delivered, and verified against live source (not SUMMARY claims):** R064's structural
correctness guarantee, in full.

| Criterion | Verdict |
|---|---|
| 2 — text byte-identical to ESV source | ✅ `SPLIT_SCHEMA` permits **no string field except the speaker enum**, so the model literally cannot emit scripture words. Section text is one `text.slice()` from the untouched source, guarded by a source-inspection test **and** a non-ASCII (curly quotes, em dash) round-trip test with strict `===`. |
| 3 — splits only on clause/verse boundaries | ✅ **Structurally unrepresentable** otherwise: the model picks integer indices into a pre-computed legal-boundary array. Stronger than R064 asks for. |
| 4 — failure never blocks | ✅ Returns `null`, one toast, `sections.value` untouched. P-03 proven by `git diff`: **279 insertions / 0 deletions** on the editor and its test — the 19 pre-existing manual-path tests are byte-for-byte unmodified. |
| **1 — a scripture item can be split** | ❌ **FAILS. No user can reach the feature.** |

**The gap, stated plainly.** `CongregationalEditor.vue` is mounted nowhere — no route, no parent, no
dynamic import outside its own test. **R047 explicitly handed this to Phase 34**: *"both editor
components remain on disk, unmounted, for Phase 34/R064 to reuse."* Phase 34 did not do it.

**The direction is NOT an open question — planning mis-read it as one.** R047 landed
slot-as-source-of-truth and the owner **rejected** the separate-reading-document model (`3da5fe4`
superseded by `5c531b1`). So closing the gap means **extending `ScriptureSlot` with
`congregationalSections` and threading it through `slideGroupMaterializer`**, then mounting the editor.
That is a data-model + assembler change, not a one-line mount — which is why it was recorded rather
than attempted at the end of a long autonomous run, where a half-applied model change would be worse
than an honest gap.

**`REQUIREMENTS.md` was marked `[x]` Complete for R064 in error and has been corrected** to `[~]`
partial, with the traceability row reading "Partial — structural guarantee done, reachability NOT
delivered." Leaving it Complete would have misrepresented an unreachable feature as shipped.

**Resume:** `/gsd-plan-phase 34 --gaps` — the scope is the model/assembler change above plus the mount.
Also tracked as `PENDING-VERIFICATION.md` item 34.2, alongside 34.1 (empirical Haiku split determinism
on Psalm 136 / Psalm 24 — no live API access during the run).

### v1.4 Phase 33 — Backgrounds & Slide Editing (2026-08-03)

**Code complete, all gates green, human checks deferred under the standing autonomy grant.**
`33-VERIFICATION.md` is `human_needed` — **not** `passed`. **5/5 success criteria and 7/7
requirements verified against live source.**

| Artifact | Outcome |
|---|---|
| Plans | 9/9 executed across 4 waves |
| Verification | `human_needed`, 5/5 criteria, 7/7 requirements verified |
| Code review | 0 Critical, 4 Warning, 2 Info; **all 4 in-scope findings fixed** (`8ad301a`…`0c56e88`) |
| UI review | 21/24; 2 of 3 findings fixed (`5963afd`, `f7e1e63`), the third needs a real browser |
| Gates at `c101874` | `npm run type-check` clean · `npx vitest run src/` 2134 passed / 9 failed (the two documented baseline files only) · `npm run build` succeeds |

**Three real defects were caught after the plans "completed" — worth knowing about:**

- **WR-01 (cascade bug).** `resolveEntryMedia`'s song lookup keyed off the **entry's own**
  `sourceRef.kind` rather than the group's owning song. A SONG group's legitimately-preserved
  `text`/`video` entries therefore silently skipped the song background tier while their `lyric`
  siblings did not — two cards in one group disagreeing about the same song's background.

- **WR-03 (a11y bug with a test that hid it).** The 3-dot menu never moved focus into its panel on
  open, so **Escape did nothing** — the one keyboard behaviour the phase mandated. The test passed
  only because it dispatched `keydown` directly on the panel, bypassing the real event path.

- **WR-04 (a removed guard).** Deleting the drawer's in-body nav links removed the "Discard unsaved
  changes?" confirmation with them and it was never ported to the menu path. Resolved by **restoring**
  the guard, wired at both the drawer's close/Escape and the menu-dispatched navigation.

**Design provenance:** this phase's affordances — the 3-dot menu, the details/lyrics split, all three
background controls — are **original design work**, not a wireframe implementation. See the ⚠ OPEN
ITEM above. The per-type menu table in `33-UI-SPEC.md` §3 is a design judgment the owner has not seen
and is listed for human verification.

**Deliberate deletions** (recorded so they never read as breakage): `GroupSlideEntry.audioScope` and
its two write routes · the drawer's audio-scope toggle · `EditSlideDrawer.test.ts`'s audio-scope
describe block · the drawer's in-body "Edit in song"/"Edit in scripture" links and the
`edit-in-scripture` emit · `SlidesTab.vue`'s `drawerOpen = true` inside `onSelectSlide`.

**Two false premises corrected, both recorded rather than silently worked around:** R052 describes
replacing a "multi-tab single drawer" that never had tabs (it had sections), and the ROADMAP's
instruction to confirm the 3-dot menu against the wireframes cannot be satisfied.

**Still open (deferred, not fixed):** `IN-01` permanent Storage orphaning when a background is removed
or replaced — no cleanup path exists for `orgs/{orgId}/backgrounds/**`, which is deliberately exempt
from `cleanupExpiredMedia`'s sweep. Raised as a backlog item, not absorbed into this phase.

### v1.4 Phase 32 — Save Reliability (2026-08-02)

**Code complete, all gates green, 8 human checks deferred under the standing autonomy grant.**
`32-VERIFICATION.md` is `human_needed` — **not** `passed`. 3/3 must-haves verified against the live
codebase; the 8 open items are in `.planning/PENDING-VERIFICATION.md` and are genuinely
jsdom-unprovable (real-browser wrap/sticky/scroll, real wall-clock persistence, real Firestore
snapshot timing, screen-reader politeness) plus one interpretive call flagged for cheap owner override.

| Artifact | Outcome |
|---|---|
| Plans | 6/6 executed across 4 waves |
| Verification | `human_needed`, 3/3 must-haves verified, 8 items deferred |
| Code review | 3 Critical + 4 Warning + 2 Info; **all 7 in-scope findings fixed** (`5a68288`…`2e76d8b`) |
| UI review | 23/24 — spec fidelity essentially byte-identical; the held-back point is unverifiable statically |
| Gates at `c46c408` | `npm run type-check` clean · `npx vitest run src/` 1981 passed / 9 failed (the two documented baseline files only) · `npm run build` succeeds |

**R039's hypothesis is now CONFIRMED, not MEDIUM confidence.** The repro (`7cd2821`, test-only,
committed before any fix) went red on `expected 2 times, got 1 times` and green after. Two corrections
to the prior research record are worth carrying forward:

- **The fix is in `src/stores/services.ts`, not the view.** `onSnapshot` now passes
  `{ includeMetadataChanges: true }` and classifies this client's own write settling via the
  `hasPendingWrites` **pending→settled transition** — `hasPendingWrites` alone is not enough, because
  the server-ack snapshot is the emission that actually defeats the JSON diff. A view-scoped fix would
  have left the D-15 immediate reorder-save (a second entry point through the same `updateService`)
  still broken.

- **A second layer compounds it:** a pending `serverTimestamp()` resolves as `null` in the optimistic
  snapshot and as a real value on server ack — two emissions per save, so the swallow window can open
  twice.

**The code review found a real data-loss bug the phase had introduced and it is fixed (CR-01):** an
edit made *during* an in-flight save was marked clean without ever being written, because `onSave()`
stamped `originalService` from live `localService` rather than the payload actually sent.

**Deliberate breaking rename:** the `status-pending` / `status-saving` / `status-saved` `data-testid`s
are retired app-wide in favour of one `save-status` (+ `save-status-error`). Zero occurrences remain
under `src/`.

**Known bookkeeping artifact:** plans 32-02…32-06 all declare `requirements: [R040, R041]`, so the
executor `mark-complete` protocol flipped both to Complete in `REQUIREMENTS.md` after 32-02 landed —
before the UI shipped. The table is accurate now, but the verifier deliberately did not treat those
checkboxes as evidence.

**Backlog item raised, not actioned:** the other Firestore-subscribing stores (`songs`, `roster`,
`slideGroups`, `scriptureSlides`) were not audited for the same own-echo defect shape. R039 is Service
Order specific and the three migrated editors are structurally not exposed (they load once per mount
rather than via a live subscription watcher), so this was scoped out deliberately.

### v1.2 (Phases 20-23) — CLOSED BY USER ACCEPTANCE, 2026-07-28

> **These were not verified by a passing gate — the user accepted them directly.**
>
> > "close v1.2. I've verified everything I need to anyway. We don't need to verify."
> > — user, 2026-07-28
>
> Recorded plainly so nobody later reads v1.2's archived state as evidence that the checkpoints below
> ran. They did not. The user judged the remaining items unnecessary and authorized archiving on that
> basis. If a v1.2-era bug surfaces, this is the reason it was not caught by a checkpoint.

| Phase | Prior state | Items the user waived |
|-------|-------------|------------------------|
| 20 | verification_deferred_human | section grouping · live reorder-follows-slides · scripture override marker |
| 21 | verification_deferred_human | announcements/image import · corrupted-file error path · source retention (import save was confirmed live 2026-07-25) |
| 22 | verification_deferred_human | cleanup dry-run review · media/autoplay e2e |
| 23 | verification_deferred_human | real fullscreen + Esc-sync · autoplay policy + held-key rapid advance · expired-media degradation · projector legibility · iPad Safari · two overflow judgment calls (23-05-SUMMARY.md) |

Phases **18 and 19** were likewise never verified and are archived with v1.2 on the same acceptance.

### v1.3 (Phases 24-28) — CLOSED, verified by owner 2026-07-28

> "Let's make sure all milestone 1.3 phases are marked as done. I verified"
> — user, 2026-07-28

**Nothing deferred remains.** Phase 28's checkpoint (one scrollbar / one list, drag-reorder persistence,
edit-propagates-to-a-repeat, duplicate/remove semantics, add-section chips, CCLI paste with a repeated
chorus, version-history restore, the Edit-in-song link, live-edit reaching an in-use service, and the
restored copyright block) was **verified by the owner** rather than deferred.

All five phases now carry a `*-VERIFICATION.md` with `status: passed`, each stating explicitly that the
status records owner verification and **not** an automated verifier run. `phase.complete` ran cleanly
for 24-28 with zero warnings; ROADMAP checkboxes are ticked.

**Deferred Verification is now EMPTY across the whole project.**

**Pre-audit hardening TODO (batch before milestone complete):**

- ~~**[SAFETY] Flip `cleanupExpiredMedia` default to dry-run/disabled**~~ — **DONE 2026-07-28** (`9f1b881`).
  Gate inverted: deletion now requires an explicit `MEDIA_CLEANUP_ENABLED="true"`; unset/empty/`"false"`/a
  typo all leave it a dry run, and `MEDIA_CLEANUP_DRY_RUN` is no longer read at all. Worth noting what was
  found: the doc comment above the gate **claimed the opposite of the code** ("Defaults to dry-run
  (MEDIA_CLEANUP_DRY_RUN unset or not 'true')") while `dryRun = process.env.MEDIA_CLEANUP_DRY_RUN === "true"`
  meant unset → LIVE delete on a daily 02:00 UTC schedule. The old test encoded the unsafe default too
  (unset → expects a real delete). Three fail-safe regression guards added; 26/26 functions tests pass.

- ~~Fix `src/views/__tests__/ServiceEditorView.test.ts` — fails at mount since 21-01 added the `importedSlides` store subscription without a Pinia mock stub~~ — **FIXED in 22-04** (`8e3afb2`): added the missing `@/stores/importedSlides` reactive-stub mock; all 14 real tests now pass.
- Run the FULL unit suite green + clean stale `.gsd/quarantine/worktrees/**` debris. Measured on `milestone/M001` after Phase 23 + its code-review fixes (`npx vitest run src/`): **3018 pass / 44 fail**, and every one of the 44 is pre-existing —
  - `.gsd/quarantine/worktrees/**` stale duplicates (35 tests across 6 files) — delete the debris. Note the count is *unstable* run-to-run (32 → 44 total across two runs an hour apart, entirely from the two quarantined `rules.test.ts` copies flapping against the emulator); the real-source failure set never moved.
  - `src/storage.rules.test.ts` (8 tests) — needs the Storage emulator, which is deliberately not started during autonomous runs. Verify separately when no live session holds ports 8080/9199.
  - **NEW — `src/views/__tests__/RosterView.test.ts` (1 test, "wraps Roles config in CollapsibleSection")** — stale assertion expecting the string `"Roles config"`; commit `df1ca34` renamed that tab to `"Roles"` and the test was never updated. One-word fix; unrelated to Phases 18-23, so it was deliberately NOT patched mid-phase.
- Batch human-verify P20 (section grouping / live reorder / override marker) + P21 (PPTX e2e) + P22 (cleanup dry-run + media autoplay) + P23 (fullscreen / autoplay / projector — see 23-05-SUMMARY.md).

Phase 20 code is complete + unit-tested (all plans 20-01..20-04 committed). The blocking
human-verify checkpoint (section grouping, live reorder-follows-slides, scripture override
marker) was deferred by the user to a batch visual-verify at milestone end. Autonomous
continued to Phase 21 per explicit user choice (2026-07-24).

## Deferred UI Follow-up (post-milestone — user request 2026-07-25)

A dedicated UI polish phase is planned AFTER v1.2 feature work completes. Captured items:

- **SlideshowPreview should be its own TAB** in the service editor screen (currently pushed to
  the bottom of the service page — move it into a tab, like the Music/Roles tab bar).

- **Empty sections not visible:** the Pre-Service section doesn't render because it has no
  elements — decide whether to show empty section headers/placeholders so all four sections
  (Pre-Service/Worship/Message/Sending) are always visible.

- General editor UX polish pass (R018) once all content types (lyrics/scripture/PPTX/media/preview) exist.

**Additional UI-phase notes (user, 2026-07-25, from live testing):**

- **All slide editing lives in a "Slides" tab** on the service plan (not scattered / bottom-of-page).
- **Collapsible preview items** to cut scrolling: after importing a PowerPoint, show it in the Slides tab as a **parent node with the slide title**, minimizable; expanding reveals slide content.
- **Render formatted slides**, not just text — show the actual slide visuals/formatting in the preview (currently text-only).
- **Insert a slide deck / image / video at ANY point in the service** — NOT limited to Announcements/Sermon sections. Replace the section-scoped "Import PowerPoint (Sermon/Announcements)" actions with a generic **"Add Slide Deck"**, plus separate **"Add Image"**, **"Add Video"**, etc. Imported decks/media become first-class service **items** that can be dragged/reordered like any other slot. (This reworks the Phase 21 section-scoped import model + relates to how Phase 22 media surfaces — capture only, do not re-architect mid-milestone.)

### ★ Phase 24 core shape (user, 2026-07-25, end of Phase 23) — the organizing idea

This supersedes and unifies most of the captured items above. **Slide functionality keeps getting
tied to the service plan itself; it should be its own surface that MIRRORS the order of service
rather than duplicating it.**

**Tab structure** — three tabs in the service editor:

| Tab | Was | Contains |
|-----|-----|----------|
| **Service** | renamed from "Music" | the order of service (the existing slot list) |
| **Roles** | unchanged | Phase 17 role assignments |
| **Slides** | NEW | **ALL** slide editing, nothing scattered elsewhere |

**The Slides tab mirrors the order of service.** It shows the same service sections
(Pre-Service / Worship / Message / Sending) and, inside each, whatever the user put into the
slideshow — slides, music, videos, imported decks. Because it *mirrors* rather than *copies*,
reordering the service or moving a song on the **Service** tab must NOT require a second manual
reorder on the **Slides** tab. One reorder, both views follow. This is the whole point of the
restructure.

**In the Slides tab the user can:**

- attach music, video, or a slide deck at any point,
- import a PowerPoint,
- **attach music to an individual slide *inside* a deck** — not to a service slot, but to one
  specific slide within one specific deck.

> ⚠ **Architectural conflict to resolve at Phase 24 planning time.** That last bullet directly
> contradicts a Phase 22 decision now in the codebase: *"Media attaches at ServiceSlot level (not
> canonical song/scripture/deck), per D002"*, implemented as `SlotMediaAttachment` mutating
> `localService.slots[index]` and propagated by the assembler onto only the first emitted slide per
> slot. Per-slide-within-a-deck media needs an attachment point the current model does not have.
> Decide deliberately: extend the slide model with its own media field (slide loosely coupled to the
> service, which is what the user described), or keep slot-level media and add a deck-slide override
> layer. Do not let this get decided by accident during implementation.

The slide is **loosely coupled** to the service — that phrasing is the user's and is the design
constraint to hold onto.

Do NOT action during current milestone build — revisit as a follow-up UI phase (Phase 24 candidate).

## Milestone v1.2 Decisions (from gsdpi DECISIONS.md D001-D006)

- **D001** (architecture): Unified slide data model — single slide type with content-kind field (lyric, scripture, image, video, text) rather than distinct types per content. Simpler editor/reordering/mental model.
- **D002** (architecture): Single canonical song lyric version per song; services reference live, not as copies. Eliminates wrong-slides-at-rehearsal; user explicitly rejected per-service copies.
- **D003** (architecture): PowerPoint (.pptx) as the universal import format; Google Slides/Keynote users export to PowerPoint first. One pipeline, avoids OAuth/protobuf complexity.
- **D004** (architecture): Server-side PPTX parsing via Firebase Cloud Function. More reliable, no browser memory limits.
- **D005** (architecture): Four formalized service sections (Pre-Service, Worship, Message, Sending) as default. Clear template; deterministic auto-assembly.
- **D006** (architecture): Manual copy/paste from CCLI SongSelect with auto-parsing of section markers. CCLI provides no API access (hard constraint).

## Performance Metrics

**Velocity:**

- Total plans completed: 121
- Timeline: 2 days (2026-03-03 → 2026-03-04)
- Total commits: 218
- Lines of code: 12,747

**By Phase:**

| Phase | Plans | Commits | Files |
|-------|-------|---------|-------|
| Phase 01-foundation P01 | 47 | 3 tasks | 30 files |
| Phase 01-foundation P02 | 60 | 2 tasks | 7 files |
| Phase 02-song-library P01 | 4 | 2 tasks | 10 files |
| Phase 02-song-library P02 | 5 | 2 tasks | 6 files |
| Phase 02-song-library P03 | 6 | 2 tasks | 5 files |
| Phase 03-service-planning P01 | 5 | 2 tasks | 9 files |
| Phase 03-service-planning P02 | 4 | 2 tasks | 7 files |
| Phase 03-service-planning P03 | 5 | 3 tasks | 4 files |
| Phase 03-service-planning P04 | 3 | 2 tasks | 5 files |
| Phase 04-output P01 | 5 | 2 tasks | 6 files |
| Phase 04-output P02 | 6 | 2 tasks | 7 files |
| Phase 06 P01 | 9 | 1 tasks | 6 files |
| Phase 06-ai-assisted P02 | 7 | 2 tasks | 2 files |
| Phase 06-ai-assisted P03 | 4 | 1 tasks | 3 files |
| Phase 06 P04 | 0 | 1 tasks | 4 files |
| Phase 07 P01 | 8 | 2 tasks | 6 files |
| Phase 07 P02 | 11 | 3 tasks | 8 files |
| Phase 08 P01 | 5 | 2 tasks | 4 files |
| Phase 08 P02 | 8 | 2 tasks | 2 files |
| Phase 08 P03 | 8 | 2 tasks | 1 files |
| Phase 09-pc-song-import-tag-management P01 | 4 | 1 tasks | 3 files |
| Phase 09 P02 | 25 | 2 tasks | 5 files |
| Phase 12 P06 | 20min | 1 tasks | 4 files |
| Phase 12 P07 | 8min | 2 tasks | 2 files |
| Phase 12 P08 | 8min | 1 tasks | 3 files |
| Phase 13 P01 | 5min | 3 tasks | 4 files |
| Phase 13 P06 | 12min | 3 tasks | 2 files |
| Phase 13 P07 | 20min | 2 tasks | 5 files |
| Phase 13 P08 | 18min | 3 tasks | 4 files |
| Phase 13 P09 | ~15min | 3 tasks | 2 files |
| Phase 13 P10 | ~15min | 2 tasks | 4 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 17 P01 | 25min | 2 tasks | 3 files |
| Phase 17 P02 | ~10min | 3 tasks | 4 files |
| Phase 17 P03 | 20min | 2 tasks | 3 files |
| Phase 17 P04 | ~40min | 2 tasks | 2 files |
| Phase 17 P05 | ~25min | 2 tasks | 3 files |
| Phase 20 P01 | 25min | 3 tasks | 4 files |
| Phase 20 P02 | 9min | 2 tasks | 2 files |
| Phase 20 P03 | 33min | 1 tasks | 2 files |
| Phase 20 P04 | 40min | 3 tasks | 5 files |
| Phase 21 P01 | 25min | 3 tasks | 10 files |
| Phase 21 P02 | 55min | 3 tasks | 6 files |
| Phase 21 P03 | 15min | 3 tasks | 7 files |
| Phase 21 P04 | 23min | 3 tasks | 3 files |
| Phase 21 P05 | 25min | 3 tasks | 3 files |
| Phase 21 P06 | 35min | 2 tasks | 3 files |
| Phase 22 P01 | 25min | 3 tasks | 8 files |
| Phase 22 P02 | 20min | 3 tasks | 6 files |
| Phase 22 P03 | 20min | 1 tasks | 2 files |
| Phase 22 P04 | ~35min | 2 tasks | 4 files |
| Phase 23 P01 | 8min | 2 tasks | 4 files |
| Phase 23 P02 | 15min | 2 tasks | 2 files |
| Phase 23 P03 | 20min | 2 tasks | 2 files |
| Phase 23 P04 | 25min | 3 tasks | 4 files |
| Phase 24 P01 | 78min | 3 tasks | 13 files |
| Phase 24 P02 | 17min | 3 tasks | 2 files |
| Phase 24 P03 | 8min | 3 tasks | 2 files |
| Phase 24 P04 | 23min | 3 tasks | 11 files |
| Phase 24 P05 | 14min | 3 tasks | 3 files |
| Phase 24 P06 | 26min | 3 tasks | 2 files |
| Phase 25 P01 | 35min | 3 tasks | 7 files |
| Phase 25 P03 | 2.5h | 3 tasks | 8 files |
| Phase 25 P02 | ~45min | 3 tasks | 16 files |
| Phase 25 P04 | ~2h | 3 tasks | 8 files |
| Phase 25 P05 | ~2h | 3 tasks | 11 files |
| Phase 25 P06 | ~50min | 2 tasks | 5 files |
| Phase 25 P07 | ~2.5h | 3 tasks | 8 files |
| Phase 26 P01 | 6min | 3 tasks | 5 files |
| Phase 26 P02 | 35min | 3 tasks | 5 files |
| Phase 26 P03 | 25min | 2 tasks | 4 files |
| Phase 26 P04 | 20min | 3 tasks | 4 files |
| Phase 26 P05 | 55min | 3 tasks | 4 files |
| Phase 26 P06 | 35min | 3 tasks | 4 files |
| Phase 26 P07 | 55min | 3 tasks | 4 files |
| Phase 26 P08 | 50min | 3 tasks | 2 files |
| Phase 26 P09 | 55 | 3 tasks | 8 files |
| Phase 27 P01 | 5min | 1 tasks | 0 files |
| Phase 27 P02 | 25min | 2 tasks | 2 files |
| Phase 27 P03 | 15min | 3 tasks | 5 files |
| Phase 27 P04 | 20min | 2 tasks | 7 files |
| Phase 27 P05 | 55min | 3 tasks | 6 files |
| Phase 28 P02 | ~40min | 3 tasks | 16 files |
| Phase 28 P03 | 25min | 2 tasks | 2 files |
| Phase 28 P04 | 35min | 2 tasks | 4 files |
| Phase 28 P05 | ~40min | 2 tasks | 2 files |
| Phase 28 P06 | ~55min | 3 tasks | 3 files |
| Phase 29 P02 | 15min | 2 tasks | 2 files |
| Phase 29 P01 | 45min | 3 tasks | 2 files |
| Phase 29 P04 | 55min | 3 tasks | 2 files |
| Phase 29 P03 | 95min | 3 tasks | 2 files |
| Phase 29 P05 | ~55min | 3 tasks | 7 files |
| Phase 30 P01 | 36min | 3 tasks | 12 files |
| Phase 30 P02 | 195 | 3 tasks | 9 files |
| Phase 30 P03 | 21min | 3 tasks | 4 files |
| Phase 30 P04 | 8h30min | 3 tasks | 14 files |
| Phase 31 P04 | ~2h | 6 tasks | 11 files |
| Phase 31 P05 | ~40min | 4 tasks | 5 files |
| Phase 32 P01 | 40min | 3 tasks | 4 files |
| Phase 32 P02 | 25min | 2 tasks | 2 files |
| Phase 32 P03 | 45min | 3 tasks | 4 files |
| Phase 32 P04 | 20min | 3 tasks | 5 files |
| Phase 32 P05 | ~2h | 3 tasks | 3 files |
| Phase 32 P06 | 1h 40min | 3 tasks | 8 files |
| Phase 33 P01 | 5min | 2 tasks | 5 files |
| Phase 33 P02 | 25min | 2 tasks | 4 files |
| Phase 33 P03 | 45min | 2 tasks | 4 files |
| Phase 33 P04 | 35min | 2 tasks | 4 files |
| Phase 33 P05 | 20min | 2 tasks | 2 files |
| Phase 33 P06 | 45min | 2 tasks | 4 files |
| Phase 33 P07 | 50min | 3 tasks | 2 files |
| Phase 33 P08 | 55min | 3 tasks | 4 files |
| Phase 33 P09 | 35min | 3 tasks | 4 files |
| Phase 34 P01 | 15min | 2 tasks | 2 files |
| Phase 34 P02 | 10min | 2 tasks | 2 files |
| Phase 34 P03 | 12min | 2 tasks | 2 files |
| Phase 34 P04 | 35min | 3 tasks | 3 files |
| Phase 35 P01 | 14min | 3 tasks | 5 files |
| Phase 35 P02 | 20min | 2 tasks | 2 files |
| Phase 35 P03 | 45min | 2 tasks | 2 files |
| Phase 35 P04 | 50min | 2 tasks | 6 files |
| Phase 37 P01 | 25min | 3 tasks | 10 files |
| Phase 37 P03 | 15min | 3 tasks | 6 files |
| Phase 37 P02 | 32min | 3 tasks | 5 files |
| Phase 37 P04 | 55min | 3 tasks | 3 files |
| Phase 37 P05 | 50min | 3 tasks | 5 files |
| Phase 37 P06 | 50min | 3 tasks | 3 files |
| Phase 34 P05 | 55min | 3 tasks | 6 files |
| Phase 34 P06 | 35min | 2 tasks | 2 files |
| Phase 34 P09 | 25min | 2 tasks | 4 files |
| Phase 34 P10 | 35min | 2 tasks | 4 files |
| Phase 34 P11 | 25min | 2 tasks | 2 files |
| Phase 34 P07 | 45min | 3 tasks | 8 files |
| Phase 34 P12 | 35min | 3 tasks | 5 files |
| Phase 34 P08 | 60min | 3 tasks | 5 files |
| Phase 36 P01 | 8min | 2 tasks | 4 files |
| Phase 36 P02 | 20min | 2 tasks | 5 files |
| Phase 36 P03 | 35min | 3 tasks | 4 files |
| Phase 36 P04 | 25min | 2 tasks | 2 files |
| Phase 36 P05 | 65min | 2 tasks | 3 files |
| Phase 38 P01 | 40min | 3 tasks | 8 files |
| Phase 38 P02 | 30min | 3 tasks | 6 files |
| Phase 38 P03 | 30min | 3 tasks | 4 files |
| Phase 38 P04 | 35min | 3 tasks | 3 files |
| Phase 39 P02 | 10min | 3 tasks | 3 files |
| Phase 39 P01 | 15min | 2 tasks | 2 files |
| Phase 39 P03 | 20min | 3 tasks | 2 files |
| Phase 39 P04 | 18min | 3 tasks | 8 files |
| Phase 39 P05 | 35min | 2 tasks | 7 files |
| Phase 39 P06 | 15min | 2 tasks | 1 files |
| Phase 40 P01 | 10min | 3 tasks | 2 files |
| Phase 40 P02 | 8min | 2 tasks | 4 files |
| Phase 40 P03 | 35min | 2 tasks | 2 files |
| Phase 40 P04 | 15min | 2 tasks | 3 files |
| Phase 40.1 P01 | 4min | 3 tasks | 3 files |
| Phase 41 P01 | 11min | 3 tasks | 3 files |
| Phase 41 P02 | 20min | 2 tasks | 2 files |
| Phase 41 P03 | 35min | 3 tasks | 2 files |
| Phase 41 P04 | 20min | 2 tasks | 2 files |
| Phase 42 P01 | 8min | 3 tasks | 3 files |
| Phase 42 P02 | 12min | 3 tasks | 6 files |
| Phase 42 P03 | 16min | 2 tasks | 5 files |
| Phase 42 P04 | 18min | 2 tasks | 2 files |
| Phase 42 P05 | 15min | 2 tasks | 2 files |
| Phase 42 P06 | 55min | 2 tasks | 4 files |
| Phase 42 P07 | 40min | 2 tasks | 2 files |
| Phase 42 P08 | 24min | 3 tasks | 3 files |
| Phase 43 P01 | 9min | 3 tasks | 8 files |
| Phase 43 P02 | 22min | 2 tasks | 2 files |
| Phase 43 P04 | 35min | 3 tasks | 6 files |
| Phase 44 P01 | 45min | 3 tasks | 5 files |
| Phase 44 P02 | 30min | 2 tasks | 5 files |
| Phase 45 P01 | 30min | 2 tasks | 4 files |
| Phase 45 P02 | 10min | 2 tasks | 4 files |
| Phase 45 P04 | 50min | 3 tasks | 8 files |
| Phase 46 P01 | 17min | 2 tasks | 6 files |
| Phase 46 P02 | 25min | 3 tasks | 5 files |
| Phase 46 P03 | 35min | 3 tasks | 2 files |
| Phase 46 P04 | 30min | 3 tasks | 9 files |
| Phase 47 P01 | ~25m | 2 tasks | 6 files |
| Phase 47 P02 | 45min | 2 tasks | 2 files |
| Phase 47 P03 | ~35m | 3 tasks | 8 files |
| Phase 48 P01 | 6min | 2 tasks | 4 files |
| Phase 48 P02 | 6min | 3 tasks | 9 files |
| Phase 48 P03 | 25min | 3 tasks | 6 files |
| Phase 50 P01 | 15min | 2 tasks | 2 files |
| Phase 50 P02 | 35min | 2 tasks | 1 files |
| Phase 50 P03 | 40min | 3 tasks | 8 files |
| Phase 50 P04 | 25 min | 2 tasks | 2 files |
| Phase 50 P05 | 6min | 2 tasks | 5 files |
| Phase 52 P03 | 12 | 2 tasks | 4 files |
| Phase 52 P02 | 9min | 2 tasks | 2 files |
| Phase 53 P01 | 15min | 3 tasks | 4 files |
| Phase 53 P02 | 13min | 2 tasks | 3 files |
| Phase 53 P03 | 20min | 2 tasks | 2 files |
| Phase 54 P02 | 40 | 2 tasks | 4 files |
| Phase 55 P03 | 35min | 3 tasks | 7 files |
| Phase 58 P01 | 25min | 2 tasks | 6 files |
| Phase 58 P02 | 25min | 1 tasks | 2 files |
| Phase 58 P03 | 20min | 2 tasks | 2 files |
| Phase 58 P04 | 40min | 2 tasks | 2 files |
| Phase 58 P05 | 25 | 2 tasks | 5 files |
| Phase 59 P01 | 36min | 3 tasks | 4 files |
| Phase 59 P02 | 18min | 2 tasks | 2 files |
| Phase 59 P03 | 13min | 2 tasks | 4 files |
| Phase 59 P04 | 18min | 3 tasks | 7 files |
| Phase 60 P01 | 9min | 2 tasks | 3 files |
| Phase 60 P02 | 14min | 2 tasks | 3 files |
| Phase 60 P03 | 17 min | 3 tasks | 8 files |
| Phase 61 P02 | 14 min | 1 tasks | 2 files |
| Phase 61 P04 | 35min | 2 tasks | 3 files |
| Phase 62 P01 | 6 min | 2 tasks | 2 files |
| Phase 62 P02 | 8 min | 2 tasks | 2 files |
| Phase 62 P03 | 14 min | 2 tasks | 2 files |
| Phase 62 P04 | 34 min | 2 tasks | 2 files |
| Phase 63 P01 | 18 min | 2 tasks | 4 files |
| Phase 64 P01 | 7 min | 1 tasks | 5 files |
| Phase 64 P03 | 13 min | 2 tasks | 2 files |
| Phase 65 P01 | 55min | 3 tasks | 2 files |
| Phase 65 P02 | 25min | 2 tasks | 4 files |
| Phase 66 P01 | 11min | 2 tasks | 2 files |
| Phase 66 P02 | 35min | 2 tasks | 2 files |
| Phase 67 P01 | 30min | 3 tasks | 2 files |
| Phase 67 P02 | 6min | 1 tasks | 1 files |
| Phase 68 P01 | 9min | 2 tasks | 4 files |
| Phase 68 P03 | 18min | 2 tasks | 2 files |
| Phase 68 P04 | 9min | 2 tasks | 5 files |
| Phase 68 P02 | 8min | 2 tasks | 5 files |
| Phase 68 P05 | 6min | 1 tasks | 1 files |
| Phase 69-firestore-runtime-config P01 | 22min | 2 tasks | 2 files |
| Phase 69 P02 | 40min | 3 tasks | 2 files |
| Phase 69 P03 | 5min | 1 tasks | 1 files |
| Phase 70-admin-console-ui P01 | 20min | 3 tasks | 9 files |
| Phase 70 P02 | 55min | 3 tasks | 14 files |
| Phase 71 P01 | 20min | 2 tasks | 2 files |
| Phase 71 P02 | 35min | 2 tasks | 4 files |
| Phase 72 P01 | 25min | 2 tasks | 4 files |
| Phase 73 P01 | 40min | 2 tasks | 2 files |
| Phase 73 P02 | 25min | 2 tasks | 2 files |
| Phase 73 P03 | 24min | 2 tasks | 3 files |
| Phase 74 P01 | 15min | 3 tasks | 5 files |
| Phase 74 P02 | 55min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list with outcomes.

- [Phase 08]: SONG slots with null songId are skipped in addSlotAsItem (no PC item created for empty slots)
- [Phase 08]: pcExportedAt and pcPlanId added as optional fields to Service interface for backward compatibility
- [Phase 08]: Credentials never pre-filled in edit inputs — user must re-enter to change (security)
- [Phase 08]: hasPcCredentials checks both non-null AND non-empty to handle Firestore null vs empty string
- [Phase 08]: Export to PC button shown for all statuses when credentials configured, disabled (not hidden) for non-planned services
- [Phase 08]: sermonPassage passed to addSlotAsItem so MESSAGE slots include sermon passage reference in PC item description
- [Phase 08]: Partial failure tolerance: individual slot failures tracked and reported without rolling back the PC plan
- [Phase 08]: PC API rejects all date fields on createPlan — date parameter omitted entirely from API call
- [Phase 08]: Human verified end-to-end export flow against real Planning Center account — APPROVED 2026-03-05
- [Quick-2]: SONG slots use item_type 'song' (not 'song_arrangement') for proper PC song linking
- [Quick-2]: CCLI-based arrangement linking is best-effort -- errors never cause export failure
- [Quick-2]: First arrangement from PC auto-linked (most songs have one default arrangement)
- [Quick-3]: Song relationship included alongside arrangement in createItem POST body
- [Quick-3]: item_type 'song' keyed on pcSongId (not arrangementId) — CCLI match always yields 'song' type
- [Quick-3]: Last scheduled item metadata copy is best-effort — per-note failures swallowed individually
- [Phase 09-pc-song-import-tag-management]: Song.hidden === true strict check preserves legacy docs without field migration
- [Phase 09-pc-song-import-tag-management]: UpsertSongInput exported from song.ts so Plans 02/03 can import type without store coupling
- [Phase 09-pc-song-import-tag-management]: upsertSongs preserves hidden status and omits null vwType from update payload to protect user-set values
- [Phase 09]: PC_BASE_URL duplicated as PC_SONGS_BASE_URL in pcSongImport.ts to avoid full planningCenterApi module import in tests
- [Phase 09]: upsertSongs uses direct updateDoc/addDoc calls (not writeBatch) to match test expectations
- [Phase 09-pc-song-import-tag-management]: CsvImportModal left as dead code to avoid breaking existing tests
- [Phase 09-pc-song-import-tag-management]: classifySongs triple-key dedup mirrors upsertSongs for consistent import preview counts
- [Phase 09-pc-song-import-tag-management]: SongTable songs-change watch removed -- it reset infinite scroll cursor after soft-delete
- [Phase 09-pc-song-import-tag-management]: PC API batch size reduced to 3 with Retry-After support to survive rate limit windows
- [Phase 12]: Kept teamTags/themes/tags as three separate Song fields (Option A) — unified only the UI/filter surface, not the data model
- [Phase 12]: Store, component, and view filterTag removal landed in a single atomic commit to keep vue-tsc --build green at every commit boundary
- [Phase 12]: Kept TagFilterChecklist.vue fully presentational (internal open ref only, no store import) so both Songs panel and picker inherit the popover for free
- [Phase 12]: D-16 amended to state generic delete-confirmation wording is the intended/accepted behavior (12-UAT test 8); D-08 amended to describe the single combined tag control sourcing teamTags ∪ themes ∪ tags (Option A)
- [Phase 13]: Standing (Person.roles/frequencyTargetN) vs quarter-scoped (PersonQuarterData.blackoutDates/pairedWith) field split encoded in roster.ts type contract (D-18)
- [Phase 13]: DEFAULT_ROLES doc comment reworded to avoid literal 'worship leader' phrase, satisfying both interfaces-block content and acceptance-criteria grep check
- [Phase 13]: quarters.ts cell edits (assignPerson/clearAssignment/swapAssignment) use Firestore dot-path field keys (calendar.${date}.${roleId}) in updateDoc rather than read-modify-write of the whole calendar map — so concurrent edits to different cells never clobber each other
- [Phase 13]: applyCsvToQuarter's bidirectional pairing merge only ever adds the reciprocal id to a partner's pairedWith array — never touches a non-CSV partner's other fields, preserving D-19's absent-people-untouched guarantee
- [Phase 13]: RosterView defers seedDefaultRolesIfEmpty() behind a one-shot watch on the roles snapshot (not synchronously after subscribe) to avoid the async-onSnapshot race that would duplicate-seed default roles for orgs that already have them
- [Phase 13]: RolesConfigPanel holds per-role edit drafts committed only on 'Save Role' so the live Firestore roles snapshot never clobbers an in-progress rename/count edit
- [Phase ?]: [Phase 13]: QuarterView derives hasAssignments from the calendar (any cell with >=1 person) to switch first-run Generate Schedule (no confirm) vs Regenerate/Fill Remaining Gaps, gating Regenerate behind the destructive confirmation
- [Phase ?]: [Phase 13]: CSV import commit is two-pass — resolve/create people then resolve serve-with against a seeded name->id map; unmatched/ambiguous rows require explicit map-to-existing/create-new (no silent auto-create, D-16)
- [Phase ?]: [Phase 13]: QuarterGrid cell edits dispatch straight to the Plan-06 scoped store actions (assignPerson/clearAssignment/swapAssignment) which each write only calendar.{date}.{roleId} via Firestore dot-path — the grid never rewrites the whole calendar map (T-13-09-02)
- [Phase ?]: [Phase 13]: QuarterGrid flags a cell unfilled when assigned count < effective count (roleOverridesByDate else role.defaultCount) OR the cell is in lastProposeResult.unfilled — so manual clears re-flag immediately without regenerating
- [Phase ?]: [Phase 13]: gap-filling panel candidate lists derive purely from personQuarterData + calendar + activePeople; blacked-out people are strikethrough-listed but excluded from assignable candidates (D-23, T-13-09-03)
- [Phase ?]: [Phase 13]: Print/public share surfaces (RosterPrintLayout, QuarterShareView) use the light palette — deliberate existing exception to the dark app theme for output surfaces (D-24)
- [Phase ?]: [Phase 13]: QuarterShareView reads ONLY the self-contained quarterSnapshot (names pre-resolved) and imports no roster/auth store, so the public route cannot touch org-scoped PII (T-13-10-02/03)
- [Phase ?]: 17-01: Adopted first-match-wins tie-break for findQuarterForDate when two quarters share a service date (accepted pre-existing edge case)
- [Phase ?]: 17-01: resolveServiceRoleAssignments stays id-only, never surfaces email/phone (T-17-01-01)
- [Phase ?]: 17-02: serviceShares Firestore collection mirrors quarterShares exactly (public read; org-editor-scoped create/update/delete; orgId immutable on update) — deterministic {slug}__service-{date} doc id requires editor-scoped write to prevent cross-org overwrite (T-17-02-01/02)
- [Phase ?]: 17-02: 'service-share' added to RESERVED_SLUGS proactively even though the opaque /share/:token route is reused (consistency with quarter-share reserved word, T-17-02-04)
- [Phase ?]: 17-03: createShareToken's memorable-URL write uses the orgIdValue param (not orgId ref), consistent with the opaque write's existing usage
- [Phase ?]: 17-03: fixed pre-existing RESERVED_SLUGS count regression from 17-02 (test:rules doesn't catch test:unit staleness)
- [Phase ?]: 17-04: Roles tab is editor-only in-app — the tab button is hidden for viewers AND rosterStore/quartersStore are subscribed only when authStore.isEditor (not just UI hiding), so a viewer on the guard-less /services/:id route never reads editor-only roles/quarters/people (T-17-04-01); viewer visibility ships only via the 17-05 public share link, Phase 16.2 decision intact
- [Phase ?]: 17-04: Roles override picker reuses QuarterGrid.vue's person.roles.includes(roleId) eligibility (no hand-rolled eligibility, D-03); toggles write via 17-03's scoped setRoleOverride/clearRoleOverride so the Quarter/schedule is never mutated from the service editor
- [Phase ?]: [Phase 17] 17-05: ShareView dual-path public read (opaque token vs memorable serviceShares) reads only the snapshot doc, no roster/org/auth store import (T-17-05-01)
- [Phase ?]: [Phase 17] 17-05: Who's Serving section renders serviceSnapshot.roleAssignments, gracefully omitted for legacy shares with no roleAssignments (T-17-05-03)
- [Phase ?]: [Phase 20-01]: SERVICE_SECTIONS kept as single source-of-truth array so per-church configurable sections is a localized future change
- [Phase ?]: [Phase 20-01]: createSlot() omits the section key entirely (conditional spread) rather than section: undefined, preserving byte-identical legacy object shape
- [Phase ?]: [Phase 20-02]: Song order precedence chain implemented as performanceOrderById -> lyrics.performanceOrder -> lyrics.sections stored order (research fallback for missing Song.performanceOrder)
- [Phase ?]: [Phase 20-02]: AssembledSlide.slotIndex captured as the slot's true array index in service.slots (paired before sorting by position), decoupling provenance from position-value correctness for legacy/malformed data
- [Phase ?]: [Phase 20-02]: DistributiveOmit<T,K> type pattern introduced because plain Omit over the Slide discriminated union collapses to only common keys
- [Phase ?]: [Phase 20-03]: assembledSections places the legacy (undefined-section) group TRAILING after named SERVICE_SECTIONS groups; empty section groups are omitted entirely
- [Phase ?]: [Phase 20-03]: scriptureSlides store has no orgId field (unlike songs store) — composable owns a local subscribedOrgId guard ref to prevent double-subscription instead
- [Phase ?]: [Phase 20-03]: songLyricsById reactive Map only grows (never prunes) as songs are removed/re-added from the service — matches the T-20-03-DoS 'only fetch missing songIds' mitigation, harmless since the pure engine only reads entries for songIds in the current service
- [Phase ?]: [Phase 20-04]: Section headers render as sibling divs in the same flat SortableJS list; Sortable's draggable: '.slot-item' option scopes drag/index math to slot items only, keeping onEnd/reindexSlots (MEM008) untouched
- [Phase ?]: [Phase 20-04]: Per-slot section select mutates slot.section directly, routed through the existing deep-watch(localService) autosave path used by every other slot field — no new persistence path
- [Phase ?]: IMPORTED slot mirrors SCRIPTURE exactly (deck-by-id, forEach-emit, tolerate null/unresolved id)
- [Phase ?]: storage.rules uses generic orgs/{orgId} path (not PPTX-specific) so Phase 22 media attachments reuse the same rule
- [Phase ?]: Removed firebase.json emulators.singleProjectMode:false; pinned --project test-project on test:rules instead, fixing cross-service firestore.exists() checks in storage.rules under the emulator
- [Phase ?]: officeparser installed as functions/ runtime dependency post-human-approval (2019 pkg creation, 585K weekly downloads, MIT, real repo — [SUS] 'too-new' verdict overridden as a confirmed false positive)
- [Phase ?]: docs/example.pptx (real user-provided deck) used as the mixed.pptx integration fixture; text-only.pptx/image-only.pptx deferred pending additional human export
- [Phase ?]: PPTX mixed-content heuristic: 40-char flattened-text threshold decides text-dominant vs image-dominant slide, calibrated against the real mixed.pptx fixture.
- [Phase ?]: generateImportId() (crypto.randomUUID) scopes only the upload-session Storage path; the deck's real importId comes from importedSlides.createDeck()'s Firestore auto-id on confirm
- [Phase ?]: Vue Test Utils Teleport testing pattern established: DOMWrapper over document.body + enableAutoUnmount(afterEach), needed since PptxImportModal (like other codebase modals) teleports to <body>
- [Phase ?]: [Phase 21-06]: ImportedSlideEditor omits store subscribeDecks/unsubscribeDecks -- useSlideshowAssembly already owns a single org-scoped importedSlides subscription for the whole ServiceEditorView page; a per-editor unsubscribe would tear that down and break the live Slideshow Preview
- [Phase ?]: [Phase 21-06]: PC-export skips IMPORTED slots via an early continue in the no-template export loop (RESEARCH Pitfall 2); the existing-plan branch already excluded IMPORTED since it only iterates the SONG/HYMN and SCRIPTURE filtered buckets
- [Phase ?]: Media attaches at ServiceSlot level (not canonical song/scripture/deck), per D002
- [Phase ?]: Assembler propagates slot media onto only the first emitted slide per slot via a Set<slotIndex> tracker
- [Phase ?]: storage.rules media cap layered as an additive sibling match block (OR-across-matching-blocks semantics), not a rewrite
- [Phase ?]: VideoPlayer autoplay-fallback: muted-retry success and muted-retry failure both emit 'autoplay-blocked'; driving layer distinguishes by element muted state, not a second event
- [Phase ?]: Both AudioPlayer/VideoPlayer explicitly emit 'play' from inside play() on success (in addition to the native @play listener) so imperative callers get the signal even against jsdom media-element test doubles that don't dispatch native events
- [Phase ?]: [Phase 22-04]: SlotMediaAttachment mutates localService.slots[index] directly (mirrors onSectionChange) so attach/remove rides the EXISTING deep-watch autosave -- no new save path
- [Phase ?]: [Phase 22-04]: Fixed pre-existing ServiceEditorView.test.ts Pinia crash (missing importedSlides mock since 21-01) as a Rule 3 blocking auto-fix -- it blocked this plan's own required test verification
- [Phase ?]: 23-01: muted.value=false set as first statement of VideoPlayer play()'s hard-failure branch, making isMuted the true discriminator between muted-retry-success and hard-block autoplay-blocked emissions
- [Phase ?]: 23-01: unmute() never rethrows NotAllowedError -- restores muted=true and re-emits autoplay-blocked instead, matching play()'s existing convention
- [Phase ?]: 23-02: PresentationViewer congregational-scripture empty/undefined sections falls back to normal-mode text rendering (planner assumption adopted verbatim)
- [Phase ?]: 23-02: PresentationViewer loading state gated on isLoading && slides.length===0 so a background refetch mid-show never re-covers an already-rendered presentation
- [Phase ?]: 23-02: exitPresentation() guarded with a local hasExited boolean so Escape + a browser-driven fullscreenchange cannot double-emit exit
- [Phase ?]: PresentationViewer media layer: pauseCurrentMedia() moved to onBeforeUnmount (Vue nulls child refs before parent onUnmounted runs); bodyIsCaption caption-swap applies to Body-role slides only, not the Display-role copyright title
- [Phase ?]: [Phase 23-04]: SlideshowPreview canPresent computed aliases hasAnySlides (no new prop) - equivalence to assembledSlideshow.length > 0 verified against useSlideshowAssembly grouping
- [Phase ?]: [Phase 23-04]: ServiceEditorView widens existing useSlideshowAssembly destructure to add assembledSlideshow/isLoading instead of re-flattening assembledSections - no new ordering logic
- [Phase ?]: [Phase 24-01]: SourceRef gets a fifth 'copyright' kind member so song groups' leading/trailing copyright entries never abuse sectionId
- [Phase ?]: [Phase 24-01]: backfillSlotIds(service, reference?) two-argument form corrects RESEARCH.md's single-argument design -- reusing the reference's id at the same array index (kind-guarded) keeps the remote-merge JSON.stringify comparison stable across snapshots
- [Phase ?]: [Phase 24-02]: materializeGroupIfMissing writes id/slotId/serviceId/slides + timestamps in one setDoc, never addDoc (deterministic doc id = slot id, per-tab race is a harmless overwrite)
- [Phase ?]: [Phase 24-02]: setGroupBedMedia uses explicit clearAudio/clearVideo flags mapped to deleteField() rather than undefined-means-clear, since stripUndefined() would otherwise erase that intent before Firestore sees it
- [Phase ?]: [Phase 24-02]: RESEARCH.md Open Question 1 resolved -- audioScope:'group' writes directly to bedAudioUrl via setGroupBedMedia; stored audioScope is UI-round-trip-only, the assembler never interprets it
- [Phase ?]: [Phase 24-03]: sourceSignature computed for ALL slot kinds (incl. SONG) for storage parity, even though only scripture/imported reconciliation reads it
- [Phase ?]: [Phase 24-03]: retained-but-unresolvable song-lyric entries appended after the resolvable run in original relative order (not interleaved) -- avoids a generic LCS-style merge RESEARCH.md warns against
- [Phase ?]: [Phase 24-04]: Tasks 1+2 (group join + D-04 audio precedence) combined into one commit since both edit the same emitFromGroup loop body
- [Phase ?]: [Phase 24-04]: Fallback-path slide ids now derive from the slot's stable id rather than array index, so a pre-materialization render cannot churn Vue keys
- [Phase ?]: [Phase 24-05]: materializationCandidates/reconciliationOutcomes split into a synchronous computed (decision) + watch callback (async effect) -- an async watchEffect body only tracks reads before its first await
- [Phase ?]: [Phase 24-05]: SONG slot with no song assigned materializes NO group (buildInitialGroup resolves to zero slides) rather than an empty one, per D-02
- [Phase ?]: [Phase 24-05]: fixed a test-isolation leak (onUnmounted never fires for direct composable calls) by wrapping each test's useSlideshowAssembly() in its own effectScope, stopped in afterEach
- [Phase ?]: [Phase 24-06]: shallowMount auto-stubs <Teleport> unless stubs: { teleport: false } is set explicitly -- required to assert against a Teleported dialog under shallowMount
- [Phase ?]: [Phase 24-06]: confirmSlotDelete resolves the slot id BEFORE the splice, awaits slideGroupsStore.deleteGroup first, and leaves the slot in place on a failed delete (T-24-06-02)
- [Phase ?]: [Phase 25-01]: VideoSlide's own-source field named videoSrc (not videoUrl) to avoid colliding with SlideBase.videoUrl's group-bed carrier role in emitFromGroup's spread
- [Phase ?]: [Phase 25-01]: isNonDerivableEntry (video kind, or authored text kind) is the single predicate hasCustomization/computeLoss consult to gate reconciliation deletion of user-appended entries
- [Phase ?]: 25-03: SlidePlanRail receives raw (unsorted) slots and sorts internally, carrying original array index so counts stay aligned with AssembledSlide.slotIndex
- [Phase ?]: 25-03: PendingReconciliation shape duplicated locally in SlidesTab.vue rather than imported from useSlideshowAssembly, to satisfy the plan's no-composable-reference verification gate
- [Phase ?]: [Phase 25-02]: bedVideoUrl/videoFromBed/SlideBase.videoUrl deleted end-to-end (D-18) -- bed is audio-only; currentVideoUrl/currentVideoKey resolve purely from a video slide's own videoSrc with no group-continuity branch
- [Phase ?]: [Phase 25-02]: bodyIsCaption removed from PresentationViewer as dead code -- video can never coexist with a text-bearing slide once video is slide-only, so the caption-demotion path was provably inert
- [Phase ?]: [Phase 25-02]: SlotMediaAttachment.vue's video attach affordance removed beyond the plan's stated file scope -- leaving it wired to an unbound update:videoUrl after ServiceEditorView drops the listener would silently discard uploaded video files with no error
- [Phase ?]: Centralized PendingReconciliation and added slideBodyText/slideFooterLabel to shared slideDisplay.ts rather than duplicating per-component narrowing
- [Phase ?]: ensureGroupMaterialized returns the entries it wrote rather than expecting the caller to re-read groupsBySlotId, since the store write lags a Firestore snapshot round trip
- [Phase ?]: SlideGrid add-slide handler always calls ensureGroupMaterialized first (even when a stored group already exists) to avoid appending to a stale entries list
- [Phase ?]: SlideGrid imports useSlideGroups() directly for its two write actions while never importing useSlideshowAssembly itself
- [Phase ?]: [Phase 25-06]: SlideGroupMusicControl emits two distinct events (attach/remove) rather than a v-model-style update:audioUrl
- [Phase ?]: [Phase 25-06]: No on-demand materialization added to the group-music write path -- setGroupBedMedia's existing merging skeleton-create (Phase 24 WR-01) already covers a plan item with no group document yet
- [Phase ?]: [Phase 25-06]: Preview control is a chromeless AudioPlayer plus a custom icon-only button carrying the UI-SPEC's aria-label -- native audio controls cannot carry a custom accessible name
- [Phase ?]: [Phase 25-07]: PptxImportModal exposes two functions (importPptxFile/importImageFiles) via defineExpose, calling straight into the existing importPptx/importImages -- second caller, not a second implementation (D-15)
- [Phase ?]: [Phase 25-07]: dropRouting.ts splits classification (five buckets) from resolution (multi-kind precedence + skipped reporting) as two separate pure functions
- [Phase ?]: [Phase 25-07]: SlideGrid mounts its OWN PptxImportModal instance with its OWN confirmed handler, never ServiceEditorView's, which creates a brand-new IMPORTED plan item (D-16 forbids that here)
- [Phase ?]: [Phase 25-07]: Video drop batches all of a drop's videos into ONE replaceGroupSlides call after every upload resolves (not one write per video), appending its own slide never the bed (D-17)
- [Phase ?]: [Phase 25-07]: Audio drop reuses 25-06's setGroupBedMedia write path directly with no materialization call, appending nothing (D-14/D-18)
- [Phase ?]: [Phase 26-01]: ReconcileResult.songSwap populated ids-only in the pure materializer; title resolution deferred to 26-04 where the song catalog is already in scope
- [Phase ?]: [Phase 26-01]: SlideGroup.dismissedSignature is a second, distinct field from sourceSignature -- never collapsed into one comparison (D-07)
- [Phase ?]: [Phase 26-01]: dismissReconciliation has no transaction/CAS -- a lost race between two declines of the same divergence is harmless
- [Phase ?]: 26-02: songEditLink.ts owns the whole query-param link convention (builder/parser/clearer), imports nothing from Vue/router/store
- [Phase ?]: 26-02: opening-tab input applied inside SongSlideOver's existing open-watcher (only place a requested tab survives its unconditional reset)
- [Phase ?]: 26-02: Task 3 (SongsView arrival handling) deliberately has no new test file per its own plan instruction — verified via type-check/build + human-check, documented in SUMMARY
- [Phase ?]: 26-03: Verified toggleScriptureEditor is a strict toggle (A2 confirmed) — added expandScriptureEditor as a sibling rather than reusing/parametrizing it, keeping the existing button's close behaviour untouched.
- [Phase ?]: 26-03: The relay emits the plan item's raw array index (not plan position) since that's what expandedScriptureSlots and the assembled slideshow are both keyed on.
- [Phase ?]: reconciliationConfirmCopy takes both the pending update and the plan item's ServiceSlot; song title miss falls back to 'Unknown Song'
- [Phase ?]: 26-05: EditSlideDrawer.vue built as one cohesive SFC (shell + live-apply); fresh-base write captures entryId at schedule time, base array re-read at write time (T-26-05-01)
- [Phase ?]: 26-05: hand-rolled label/notes debounce/status instead of useAutoSave, so a rejected write reaches a distinct 'error' status rather than a false 'saved'
- [Phase ?]: 26-06: modal prop named planItem (not slot) to avoid confusion with Vue's <slot>; both write handlers close the dialog optimistically before awaiting the store call, matching every other write path in SlideGrid.vue; a missing freshSignature makes both writes a silent no-op, which also satisfies the self-close-cannot-be-triggered guard
- [Phase ?]: 26-07: Slide Text section keyed on GroupSlideEntry.sourceRef.kind (never Slide.contentKind) per D-15's six-row matrix; hand-written slide body writes through 26-05's fresh-base helper extended to a nested sourceRef.body field; both edit-in-song/edit-in-scripture routes guarded by useUnsavedGuard with cancel-before-navigate (not flush) so the confirmation is truthful
- [Phase ?]: 26-08: Slide Audio's scope pill renders in every audio state (not just 'nothing attached'), since whichever route was taken on attach always stamps entry.audioScope to match the state currently shown
- [Phase ?]: 26-08: audioState (what's shown) and scopeChoice (what's chosen next) kept as two independent computed values — Remove always acts on audioState, attach always acts on scopeChoice
- [Phase ?]: 26-09: reconcileSongGroup's per-section index widened from Map<sectionId, entry> to Map<sectionId, entry[]> so a duplicated song-section slide survives the next within-song reconciliation instead of being silently dropped (landed before Duplicate shipped)
- [Phase ?]: 26-09: Duplicate's selection-follows-copy is success-gated -- the drawer emits 'duplicate' (and SlidesTab.vue moves the selection) only after replaceGroupSlides resolves, so a rejected write never leaves the panel pointed at an entry that was never created
- [Phase ?]: 26-09: deleteSlideConfirmBody lives in the pure slideDisplay module (not inline in EditSlideDrawer.vue), keyed on the entry's OWN audio/notes only -- never the group's shared bed music
- [Phase ?]: D-05: Present Slideshow moves to the Slides tab (27-01 checkpoint resolved 2026-07-27)
- [Phase ?]: 27-02: Renamed ServiceEditorView's first tab (label + activeTab union) from Music to service-order (D-03, D009); four unrelated views with same-named activeTab refs left untouched
- [Phase ?]: 27-03: Removed the IMPORTED slot branch's whole editor-toggle-plus-viewer-note half (not just the button+panel) since the interfaces block's two-halves framing places the viewer-only note in the leaving (slide-editing) half
- [Phase ?]: 27-04: Removed the per-plan-item SlotMediaAttachment control, its view-level read/write helpers, and the orphaned component; reworded the slideGroupsStore setup comment and five prose references naming the deleted file, leaving the group-bed audio write path itself (setGroupBedMedia) untouched for the Slides tab's SlideGroupMusicControl/SlideGrid callers
- [Phase ?]: D-05 implemented verbatim: Present Slideshow relocated to the Slides tab (new CTA in SlidesTab.vue), reusing the existing presenting flag and PresentationViewer mount; SlideshowPreview removed from the Service Order tab and deleted (D-02/D-19).
- [Phase ?]: Phase 27 closed: full unit suite failing FILE SET verified unchanged at the 10-file baseline (8 quarantine debris + storage.rules.test.ts + RosterView.test.ts); type-check and build both green.
- [Phase ?]: [Phase 28-02]: Song.performanceOrder deleted outright (D-19); SongLyrics.performanceOrder is now the single source of a song's slide order, replacing the three-tier resolveSongOrder precedence chain duplicated across slideshowAssembler.ts and slideGroupMaterializer.ts
- [Phase ?]: [Phase 28-02]: Task 2/Task 3 boundary is intentionally not independently type-check-clean — Task 2 deletes the order field/action, Task 3 (same non-checkpointed plan) removes the two Vue consumers immediately after; documented rather than treated as a blocking deviation
- [Phase ?]: 28-03: Surplus stored entries for a repeated section are emitted at the LAST occurrence, not the first — keeps Phase 26-09's N=1/M=2 output byte-identical while bounding growth for N>1
- [Phase ?]: 28-04: Rebuilt SongLyricEditor as option 2a's single-scroll-region row list; dropped copyright display (not in 2a design); load-time repair persisted via a direct doAutoSave() call since useAutoSave suppresses its first watcher invocation.
- [Phase ?]: 28-05: which occurrence of a repeat is 'followed' vs. 'repeat' is re-derived by buildSectionRows every render, never stored as separate state
- [Phase ?]: 28-05: SortableJS drag config for the lyrics row list reproduces ServiceEditorView/SlideGrid verbatim (handle/.section-row/animation 150/ghostClass opacity-30) so drag means the same thing app-wide
- [Phase ?]: 28-05: the dashed Add-section row is a sibling of section-rows, not a child, so it stays outside both the row-count contract and Sortable's .section-row draggable scope
- [Phase ?]: Restored the CCLI copyright display 28-04 dropped without an authorizing decision — R035 only requires one scroll surface and one list, and the display's absence removed the only place to verify CCLI licensing data before it reaches the presented copyright slide.
- [Phase ?]: R035's acceptance block mounts SongSlideOver + SongLyricEditor together, unstubbed, since the nested-scrollbar defect only appears once panel and editor are mounted together — proven at the composed level, not just per-component.
- [Phase ?]: 29-02: orderSlotsBySection/groupBySection/flattenBySection are total, SERVICE_SECTIONS-driven, identity-preserving; defaultSectionForPosition audited as position-keyed, no change needed for post-service
- [Phase ?]: makeSectionedService() and Sortable capture accessors placed at module scope so Task 1/Task 2 land as separate, independently-verifiable commits (29-01)
- [Phase ?]: 29-04: R050's live mechanism was SlideGrid's own array-order/order-value divergence (closed by a shared appendToGroup sort-append-renumber contract), not slideGroupMaterializer.ts's trailing-copyright placement — that placement is correct, Phase-35-owned SONG-group behavior and was left untouched.
- [Phase ?]: 29-04: added destroySortable() to the reorder-failure catch block (Rule 2) so the :key-driven gridRenderNonce re-render doesn't leave a stale Sortable instance bound to a discarded DOM node, which would otherwise silently disable real drag-and-drop after any single reorder failure.
- [Phase ?]: onEnd never reassigns moved.section for a within-ungrouped-list reorder (put:false blocks any other case) — avoids silently normalizing a legacy/out-of-union section value
- [Phase ?]: onSectionChange now composes reindexSlots(orderSlotsBySection(...)) — a genuine behavior change from silent-set-only, required so a dropdown section change produces the same section-major array a drag does
- [Phase ?]: 29-05: Post-Service section is purely additive (union/array/label map) with zero migration; the four downstream consumers (assembly, print, PC export, plan rail) needed zero source changes, confirmed by dedicated tests per consumer rather than assumed
- [Phase ?]: Followed Phase 27's exact commit sequencing (test -> feat -> chore) for the reconciliation-UI deletion so each commit compiles clean against the prior one
- [Phase ?]: Left useSlideshowAssembly.ts and slideGroupMaterializer.ts's confirm engine untouched -- 30-02's job, landing with the generalized non-derivable-entry-survival fix
- [Phase ?]: Generalized 28-03's positional-consumption + 26-09's array-per-key survival fixes from SONG-only to all three group kinds (derivedIdentityKey/carryStoredDerivedEntries), in the same commit that deleted the confirm gate protecting SCRIPTURE/IMPORTED groups
- [Phase ?]: A same-scriptureReadingId passage edit is a no-op at the materializer level; only a reading-id swap or a legacy-shaped stored entry triggers a rebuild write, since GroupSlideEntry stores no content
- [Phase ?]: R054: song groups block all slide CRUD/reorder in the Slides tab via a plain isSongGroup/canMutate v-if gate — no new prop/mechanism; group-level bed audio and the Edit in song link stay open.
- [Phase ?]: R047 ripple: scripturePassageText falls back to the slide's reference when resolved text is empty, so the drawer's Slide Text block never goes blank for a scripture slide.
- [Phase ?]: R045 proven with this codebase's first permutation-property test (50 shuffles, no fast-check dependency added, per 30-CONTEXT.md)
- [Phase ?]: R047 rebuilt around the SCRIPTURE slot's own book/chapter/verse fields as the slide's source, replacing the reading-document model an initial human-verify fix (3da5fe4) had linked -- the owner rejected that model live and required slot-as-source-of-truth (5c531b1)
- [Phase ?]: Phase 30 human-verify failed twice on first pass (R054 drop-tile copy, R047 no slide appearing) and was fixed and re-verified live before final approval -- recorded honestly in 30-04-SUMMARY.md rather than presented as a clean pass
- [Phase ?]: [Phase 31-04]: The gate migration is five classes, not a substitution — class C :disabled bindings are DELETED, class D inverse branches keep pointing at isLocked
- [Phase ?]: [Phase 31-04]: The lifecycle lock composes INTO canMutate/canReorder, which is what makes Sortable teardown and rebuild automatic
- [Phase ?]: [Phase 31-04]: serviceLocked is a prop distinct from isEditor — the drawer must tell a viewer from a locked editor to pick its copy
- [Phase ?]: [Phase 31-05]: The two Sunday conventions in this repo were reconciled in favour of STRICTLY FORWARD (a Sunday `from` yields the FOLLOWING Sunday), because D-13 requires the fallback to degrade to the pre-R038 behaviour — commented in quarterDates.ts and pinned by tests at both the util and component level
- [Phase ?]: [Phase 31-05]: nextFreeSunday went INSIDE quarterDates.ts to reuse its module-private fmtDate; deleting NewServiceDialog's nextSunday() removed a formatter copy, so the net count went down rather than up
- [Phase ?]: [Phase 31-05]: R038's date skip changes the DEFAULT TEAM selection (teams derive from sundayOrdinal) — a real behaviour change, now tested with two ordinal pairs rather than left to surface in UAT (human judgement filed as 31.23)
- [Phase ?]: R039 fix lives in the services store (subscribe()'s onSnapshot echo classifier), not the view's onSave() payload — RESEARCH found a second write path (D-15 reorder-save) sharing the identical bug mechanism
- [Phase ?]: R039 repro must dispatch the echo simulation and the discrete mutation in the SAME synchronous tick (no awaited nextTick between them) — Vue's reactivity scheduler dedups multiple watch(localService) triggers within one flush, so a tick in between lets the merge's own reassignment self-consume the swallow guard and produces a false green
- [Phase ?]: useAutoSave: 5-status union ('error' added), fade removed — saved is now terminal; test-count baseline in plan was stale (12 not 13), added 4 net-new tests to hit the literal >=16 floor
- [Phase ?]: useSaveStatus/useToasts: edge-detection for the failure toast lives inside saveStatus.set() (the writer), not inside a component watch (the reader), so no caller of set() needs to know a toast store exists.
- [Phase ?]: SaveStatusIndicator.vue and ToastHost.vue built verbatim from 32-UI-SPEC.md, consuming plan 03's real useSaveStatus/useToasts stores; both component tests install real Pinia rather than mocking, matching the new-precedent pattern 32-03 set.
- [Phase ?]: ToastHost mounted once in AppShell.vue inside the inner content flex column (sibling after </main>), confirmed via grep as the sole mount point across src/.
- [Phase ?]: 32-05: useAutoSave is declared before the immediate remote-merge watcher that reads its status; deleted autosaveInitialized outright (no reset() API added) since the R039 fix already makes a genuine merge leave local==original, which the composable's own dirty check suppresses
- [Phase ?]: 32-05: handleAutosaveFailure writes the definitive useSaveStatus entry directly and re-throws so useAutoSave's own generic catch also lands on 'error' without double-reporting — the reporting watcher skips the 'error' transition rather than mirroring it
- [Phase ?]: 32-06: capture-once surface id (a dedicated ref assigned exactly once when the driving record id/prop first resolves) applied identically across all three editors, closing the E4 partial/loading backstops
- [Phase ?]: 32-06: added defineExpose({ currentReadingId }) to CongregationalEditor.vue/ScriptureSlideEditor.vue as a minimal, precedented test-only seam to drive the E4 partial backstop
- [Phase ?]: 32-06: SongLyricEditor's E4 partial backstop is written defensively (not a live repro) since a mid-mount songId swap is not reachable in production today
- [Phase ?]: 33-01: backgroundImageUrl/backgroundSource live on SlideBase only (not mirrored onto AssembledSlide) so the pair can never drift apart like audioUrl/audioFromBed did
- [Phase ?]: 33-01: background cascade computed before resolveEntryMedia's video early-return and returned from that branch too — a video slide inherits a background but never inherits bed audio (deliberate divergence)
- [Phase ?]: canMutateBackground is not threaded into slideActionMenuItems (33-02) — nothing in UI-SPEC §3's table branches on it, and it would trip the lint config's args:'after-used' rule
- [Phase ?]: Hymn discriminator (33-02) is entry.sourceRef.body !== undefined combined with planItemKind, not sourceRef.kind alone — a HYMN group's auto-derived text slide has no body while a hand-added blank slide always does
- [Phase ?]: 33-03: confirmed orgs/{orgId}/backgrounds/** storage path is exempt from cleanupExpiredMedia's sweep and needs no storage.rules change
- [Phase ?]: 33-03: BackgroundControl.vue's addLabel is an additive prop beyond UI-SPEC's stated list since group/song call sites need different add-affordance copy
- [Phase ?]: R058: audioScope deleted outright (D-19, no migration) — GroupSlideEntry, EditSlideDrawer.vue's scope UI, and slideGroups.ts's stale doc comment all removed together; group-wide audio remains reachable via SlideGroupMusicControl.vue
- [Phase ?]: SlideCard.vue root element changed from native <button> to role="button" div so SlideActionMenu's real button trigger can legally nest inside it
- [Phase ?]: Both 33-05 tasks landed in a single commit (55d6b6c) since Task 2's chip markup sits adjacent to Task 1's closing-tag change in the same file diff
- [Phase ?]: SongLyricEditor.vue's isEditor gate is read directly from useAuthStore (new import) rather than a new component prop, scoped only to the new background control — the rest of the editor remains ungated by design, per Firestore rule enforcement
- [Phase ?]: No removeLabel prop added to BackgroundControl.vue for 33-06 — plan's exact prop list excluded it; flagged forward to 33-08 in case per-level aria-label wording matters at UAT
- [Phase ?]: canMutateBackground deliberately omits the song-group exclusion canMutate carries — a song group's reduced menu still offers background-setting per 33-CONTEXT.md
- [Phase ?]: 'Set for this slide only' performs a direct copy-then-override write of the resolved url (per plan text), not a toggle into upload UI (33-UI-SPEC's looser prose)
- [Phase ?]: pendingAction's remove-caption song branch is unreachable from EditSlideDrawer's available props (no song document threaded in) — documented as a known gap rather than guessed at
- [Phase ?]: 33-08: BackgroundControl's Remove aria-label stays generic ('Remove background') — no acceptance criterion tests the per-level wording, and this is the last wave-3 mount site; flagged as a small optional removeLabel prop for a future follow-up if UAT needs it.
- [Phase ?]: 33-09: onMenuAction dispatches duplicate/delete via the drawer's pendingAction seam (open + pending, never a direct store call) per the plan's explicit text, overriding 33-08's stale handoff note
- [Phase ?]: 34-01: implemented the boundary-index contract exactly per RESEARCH.md — computeBoundaries/hasSplittableBoundaries/embedBoundaryMarkers/sliceAtBoundaries/stripVerseMarkers/verseRangeForSlice, with an encoding backstop enforced both behaviorally and via source-inspection
- [Phase ?]: 34-02: Split model contract into SplitSection/SPLIT_SCHEMA (integer boundary indices + speaker enum, additionalProperties:false everywhere) and validateSplitResult() with total-rejection semantics — a single adjacency equality check rejects gap/overlap/out-of-order identically; no repair, coercion, or re-sort.
- [Phase ?]: Combined PLAN.md's two tasks (call shape / failure paths) into a single feat commit rather than four RED/GREEN commits, since both tasks' tests were authored coherently in one describe block with no scope/design impact
- [Phase ?]: jsonSchemaOutputFormat() deep-clones/transforms SPLIT_SCHEMA before request attachment; call-shape tests assert the transformed schema's shape (properties.sections present) rather than strict identity against SPLIT_SCHEMA
- [Phase ?]: 34-04: wholesale-replace-on-success + untouched-plus-toast-on-any-failure is the additive AI pattern (canAiSplit gated by 34-01's hasSplittableBoundaries; onAiSplit never merges, never partially applies)
- [Phase ?]: 34-04: sectionsSnapshot() in tests reads the DOM rather than exposing sections internally — matches the component's existing minimal test seam (only currentReadingId is exposed, for the unrelated E4 backstop)
- [Phase ?]: R059/R061 (35-01): sectionLabel render deleted from PresentationViewer lyric branch; presentStartIndex computed in SlidesTab, threaded via initialIndex prop through ServiceEditorView, reusing the existing clamp formula
- [Phase ?]: R060 closed by regression test only; no production code added — every group-construction path already emitted the copyright bracket unconditionally
- [Phase ?]: First-and-last copyright placement is framed only as a deliberate safety margin, never a CCLI licensing requirement (P-01); CCLI's primary license text failed retrieval a second time (2026-08-03)
- [Phase ?]: R065/R066 governed by 35-UI-SPEC's approved contract, not probe-derived edge coverage (#1110 flagged unclassified); canConfirm holds exactly three clauses (sections, copyright-or-override, not-saving)
- [Phase ?]: 35-04: hosted LyricPasteRegion inline behind pasteMode (v-if/v-else, never v-show) and deleted LyricPasteDialog.vue + its test file — R066 closes with exactly one paste surface.
- [Phase ?]: 35-04: two host-mechanism tests (empty-textarea exit via each of paste-back-btn/paste-cancel-btn) added beyond the plan's specified seven so -t "paste" clears the plan's own >=9 acceptance floor without renaming any pre-existing test.
- [Phase 37]: Package legitimacy checkpoint (render-service deps: express, @google-cloud/storage, @types/express, @types/node) recorded DEFERRED per standing autonomy grant, not owner-approved
- [Phase 37]: render-service/src/placeholder.ts added (Rule 1 fix) to keep tsc --noEmit satisfiable until 37-02 lands render.ts/server.ts/main.ts; delete once those exist
- [Phase ?]: 37-03: google-auth-library checkpoint recorded DEFERRED (not owner-approved) per STATE.md standing autonomy grant
- [Phase ?]: 37-03: nested try/catch around the pptxRenders queue write verified load-bearing by temporarily removing it and observing the regression test fail
- [Phase ?]: STORAGE_BUCKET env var added (read lazily via requiredBucketName()) -- @google-cloud/storage's Storage#bucket() requires an explicit bucket name, unlike firebase-admin's default-bucket form; flagged for 37-06's DEPLOY.md
- [Phase ?]: Render page ordering fixed and verified load-bearing: renderedObjectName/pageNumberFromOutputName sort numerically on parsed page number, never lexically or by array index; confirmed by temporarily breaking RENDERED_PAGE_PAD and observing 4 test failures, then restoring
- [Phase ?]: 37-04: completeness gate requires three independent conjuncts (positive count, reported-vs-actual equality, contiguous 1..N) -- never derived from parsePptxBuffer's MappedSlide[] length, which is structurally decoupled from real page count
- [Phase ?]: cleanupOrphanRendersHandler: second scheduled job (03:00 UTC), dry-run gate process.env.PPTX_RENDER_CLEANUP_ENABLED !== "true" mirroring the post-9f1b881 shape exactly, RENDERED_OBJECT_GUARD applied before any delete decision
- [Phase ?]: ImportedDeck.renderImportId links the Storage-side import id to the confirmed deck, set only on the PPTX path and explicitly cleared (not just left default) on the image-only path to prevent leaking a cancelled PPTX import's id
- [Phase ?]: R062 marked [~] partial (not complete): pipeline built+tested end to end, but undeployed by owner instruction and no UI consumes rendered images yet -- followed the R064 precedent format
- [Phase ?]: No-deploy audit passed: zero executed gcloud/docker/firebase-deploy invocations across all Phase 37 commits and summaries
- [Phase ?]: 34-05: congregationalSlideFieldsFromSlot ignores ScriptureSlot.readingMode entirely, gating only on non-empty congregationalSections, matching PresentationViewer's isCongregational computed and avoiding the two-competing-fields defect class
- [Phase ?]: 34-05: slideGroupMaterializer.ts needs no structural change for congregational sections — sections resolve live at assembly time, proven by executable test and git diff --exit-code rather than assumed
- [Phase ?]: 34-06: CongregationalEditor.vue converted to a controlled prop/emit component (reference/sections in, update:sections/update:reference/close out) — no store, no auto-save, no save-status of its own; the rejected separate-ScriptureReading-document persistence model (useScriptureSlides) is fully removed from this file
- [Phase ?]: 34-06: draftSections/referenceText seeded once at setup from props, not reactive to later prop changes — carries forward the pre-existing WR-04 keyed-mount contract into 34-07's mount point
- [Phase ?]: R070 written as a NEW requirement (not folded under R055/R056) — owner UAT F3 exposed that R055/R056 only ever described SETTING a background, never rendering it while presenting
- [Phase ?]: PresentationViewer's currentBackgroundUrl consumes the single already-resolved slide.backgroundImageUrl with zero re-derivation (no group/song lookup, no branch on backgroundSource) — negative-grep enforced to avoid the two-disagreeing-fields defect class hit twice before
- [Phase ?]: 34-10: chrome-only gate on the save-status bar (not v-if on the wrapper) — this wrapper hosts the aria-live region, so unmounting at idle would cost the first status announcement of every session
- [Phase ?]: 34-10: exhaustiveness enumeration for the save-status agreement test is Record<AutoSaveStatus, true>, not a typed array — arrays only constrain elements, never completeness, so a typed array would silently stop guarding after a sixth status was added and omitted
- [Phase ?]: 34-11: merged group music and group background into one panel (UAT F2); corrected Task 2's permission-carve-out test direction to match verified canWriteGroupMedia behavior (song groups keep group-media write access) rather than the plan's literal wording, which contradicted the gate's own code comment and a pre-existing pinned test
- [Phase ?]: 34-07: mount seam for CongregationalEditor is the scripture slide (menu + drawer, converging on one relay), per owner UAT finding F1 — closes the R064 reachability gap 34-VERIFICATION.md recorded
- [Phase ?]: 34-07: no free-text scripture override anywhere — owner shown the D-13/D-15 shadow-copy tension and declined it; fetch-then-split inside CongregationalEditor is the only route to slide text
- [Phase ?]: 34-12: F5 diagnosed as cause 1 (org doc lacks credentials, not a load-order regression); no fix to auth.ts, R071 written and delivered as a UX explanation note beside Copy for PC
- [Phase ?]: Phase 34 gap closure complete (34-08): composed slot->group->slide pipeline proven end to end; phase gate green (type-check, vitest --dir src at documented baseline, build); R064/R070/R071 corrected to match delivery; 12/12 Phase 34 plans executed.
- [Phase ?]: 36-01: SlideDropTarget's clickable prop is independent of audioOnly; SlideGrid alone binds :clickable="canMutateGroup" (never canWriteGroupMedia), replicating the deleted import button's exact prior gating
- [Phase ?]: 36-02: Preserved ServiceEditorView.vue's live ungated Export/Copy-to-PC gate over 36-UI-SPEC's illustrative canEditService-gated code and its inaccurate E3 row
- [Phase ?]: 36-02: Implemented R071's future hint as a dynamic hint-{key} slot on ContextualActionBar instead of the spec's lossy hint?: string field
- [Phase ?]: 36-03: SlidesTab exposes canPresent/onPresentClick; header's Present handler is a zero-argument relay with no logic of its own, keeping R061's index math in one place
- [Phase ?]: 36-03: preserved the live ungated export/copy visibility (36-02's recorded divergence) rather than 36-UI-SPEC's illustrative canEditService-gated version
- [Phase ?]: 36-03: unstubbed ContextualActionBar across all 24 pre-existing ServiceEditorView.test.ts mountView helpers (one replace_all edit) rather than rewriting selectors — every pre-existing assertion passed unmodified
- [Phase ?]: 36-04: addSlot gains additive targetSection param; section-band headers gain slide count + per-band Add item chip row; Task 1 unit-observable only via Task 2's UI (no defineExpose on ServiceEditorView)
- [Phase ?]: 36-05: ROADMAP criterion 4 stays recorded as satisfied in interaction pattern only (Add slide stays grid-local per 36-UI-SPEC Finding 2; Add music superseded by owner F2) — dated corrections in REQUIREMENTS.md/ROADMAP.md re-confirmed, not upgraded.
- [Phase ?]: 36-05: the mandated gate command 'npx vitest run --dir src' bypasses vite.config.ts's relative exclude for src/rules.test.ts (path-rebase side effect of --dir), leaking the emulator-dependent rules suite in as a false third failure in this environment; documented and worked around with an explicit basename exclude, not silently smoothed over.
- [Phase ?]: D1 signature encoding: formatted reference alone with no sections, else reference + ASCII-control-char-separated field-explicit section encoding (no JSON.stringify, key-order independent) — the durable marker rebuildScriptureGroup reads to decide DETACH vs rebuild
- [Phase ?]: 38-02: ScriptureSlide.section (singular) replaces sections[] — compiler-enforced one-section-per-slide; testid anchors presentation-speaker/presentation-congregational-section finalized for 38-03/38-04
- [Phase ?]: 38-03: slideActionMenuItems needed no change for section entries — confirmed by reading, duplicate/delete were already offered under canMutate regardless of speaker
- [Phase ?]: 38-03: the editable scripture passage field's stable test-id is drawer-slide-text-editable-scripture; the speaker control's are drawer-speaker-toggle/drawer-speaker-readonly/drawer-speaker-row
- [Phase ?]: 38-03: the speaker flip write is deliberately not debounced (mirrors onLoopToggle's immediate-write shape) to avoid losing a flip to a pending flush for a different field
- [Phase ?]: 38-04: tick() helper mirrors useSlideshowAssembly's apply shape exactly (writes slides AND freshly recomputed sourceSignature); its own fidelity is asserted against the written signature value, not just the changed flag, since carry-by-position idempotence can mask a broken helper
- [Phase ?]: 38-04: comment audit found slideGroup.ts/slideshowAssembler.ts/scripture.ts already reconciled by 38-01/38-02; only slideGroupMaterializer.ts had 4 stale unqualified claims, all fixed with no behavioral change
- [Phase ?]: 38-04: Task 3's owner-verification checkpoint deferred under the standing autonomy grant, recorded as PENDING-VERIFICATION.md items 38.1-38.7 — not run, not self-approved
- [Phase ?]: Wave 0 harness auth-store mock: settings shape backed by per-key module-scope getters (SongTable.test.ts:39 precedent), not a single collapsed getter
- [Phase ?]: findImportSongsButton typed as ReturnType<typeof mountSongsView> instead of VueWrapper<any> to satisfy eslint's no-explicit-any rule
- [Phase ?]: 39-02: OrgSettings members are required, not optional — the auth.ts::loadOrgContext merge point is the single place any consumer coalesces to a default
- [Phase ?]: 39-02: vwModeEnabled dual-read (settings.vwModeEnabled ?? orgData.vwModeEnabled ?? true) implemented once in loadOrgContext; backfill is write-triggered (39-03), never a bulk migration script
- [Phase ?]: onToggleVwMode's write target moved to the nested settings.vwModeEnabled dot-path (39-03) — completes the lazy backfill; authStore.vwModeEnabled store API unchanged
- [Phase ?]: T-39-01 threat verified against real firestore.rules: organizations/{orgId}'s allow write: if isOrgEditor(orgId) is document-level (no field restriction), so it already covers new nested settings.* writes with no rule change needed
- [Phase ?]: 39-04: AI split button v-if reads authStore.settings.aiEnabled alone (not AND-composed with canAiSplit) to preserve pre-existing E5 states exactly
- [Phase ?]: 39-05: buildExportOrCopyItem's PC gate stays one composed early return (hasPcCredentials || pcEnabled), not two competing checks
- [Phase ?]: 39-05: RosterView.test.ts's bare hand-rolled auth mock extended with getter-backed settings.pcEnabled, proactively avoiding the breakage class 39-04 found in ServiceEditorView.test.ts
- [Phase ?]: Phase 39 gate closed: type-check and full suite clean at documented baseline; R073/R088/R089 each traced to a real passing command; firestore.rules org-write rule reconfirmed to already cover nested settings.* writes with no rule change needed; all five UI-SPEC manual backstops recorded DEFERRED in PENDING-VERIFICATION.md (39-03 had recorded 4 of 5; this plan added the missing congregational-editor button-row reflow item).
- [Phase ?]: Phase 40 Plan 01: storage.rules dual-read (isOrgMemberByClaim || isOrgMemberByFirestore, claim first) turned the measured baseline 2 failed|96 passed into 0 failed|103 passed. Helper-function form worked without needing the plan's inline-expression fallback.
- [Phase ?]: 40-02: syncOrgMembershipClaim (functions/src/orgMembershipClaims.ts) built and unit-tested, never deployed -- shares decideMembershipClaim with plan 40-04's backfill so the two claim-setting code paths cannot drift.
- [Phase ?]: Phase 40 Plan 03: refreshOrgClaim called sequentially before the org-doc read (not concurrently) to keep the ordinary-path exactly-one-refresh-no-delay assertion simple
- [Phase ?]: Phase 40 Plan 03: fixed a pre-existing auth.test.ts mock leak (onAuthStateChanged callbacks accumulated across tests) that was inflating getIdTokenResult call counts once exact-count assertions were added
- [Phase ?]: 40-04: None - plan executed exactly as written
- [Phase ?]: 40-04: Backfill and runbook both confirmed against real artifacts: firebase.json deploy targets, plan 40-01's exact guard test title, and plan 40-03's exact CLAIM_REFRESH constants -- nothing invented or stale.
- [Phase ?]: R104 fix: getAfter() for org-creation branch, get()/exists() for invite-acceptance branch — recommended arrangement worked on first emulator run, no swap needed
- [Phase ?]: shareTokens/serviceShareLinks rules: null-resource-tolerant read clause overrides PATTERNS.md's bare isOrgEditor proposal to avoid bricking ensureShareLink's first call
- [Phase ?]: deleteService share revocation left out of scope for Phase 41; recorded in PENDING-VERIFICATION.md as a future-phase candidate
- [Phase ?]: R078 adoption query stays equality-only (no orderBy) with client-side sort in a new pure src/utils/shareTokens.ts, avoiding the composite-index trap that would pass emulator tests and fail in production
- [Phase ?]: pickAdoptableToken filters candidates by orgId strictly BEFORE sorting, proven by a foreign-org-candidate-is-newer test case (T-41-07)
- [Phase ?]: ensureShareLink's steady-state branch skips the transaction entirely, returning early after writeSharePayload when serviceShareLinks/{serviceId} already exists
- [Phase ?]: Token stability proven by call-count (transaction set, getDocs), never by string equality, because the suite's deterministic crypto.getRandomValues stub makes every mint produce the identical string
- [Phase ?]: R077 auto-refresh hook calls writeSharePayload only (never ensureShareLink), hooked into exactly updateService/setRoleOverride/clearRoleOverride, with a per-session negative cache and WR-06 soft-fail
- [Phase ?]: WR-06 soft-fail must be tested with two independent Pinia instances — after a refresh failure, shareLinkCache caches false for that service, so a shared-store test of a second action's resolution would short-circuit silently
- [Phase ?]: 42-01: proved D-01/D-02 write-hole premise via emulator PROBE before fixing; kept pptxRenders read at member tier (isOrgMember), not editor tier, per D-02
- [Phase ?]: 42-01: amended Phase 41's existing PENDING-VERIFICATION.md deploy checkbox rather than adding a second handoff, per D-18 — one firebase deploy --only firestore:rules now covers both phases
- [Phase ?]: PptxRenderDoc omits storagePath entirely (T-42-05) — the only sanctioned producer of a rendered-page path is renderedPagePath(orgId, renderImportId, pageNumber)
- [Phase ?]: One onSnapshot listener per distinct renderImportId (D-20/A2), not a single in-query — recorded default, revisit only if listener count becomes a measured problem
- [Phase ?]: Absence from rendersByImportId is the sole representation of 'no render document yet' — never a synthesized placeholder (T-42-07 stale-render guard)
- [Phase ?]: SlideCard.vue and PresentationViewer.vue both consume an already-resolved imageUrl and never call Storage — neither needs a resolveImageUrl/getDownloadURL test mock (Wave 0 Q3, recorded for 42-06/42-07)
- [Phase ?]: resolveImportedRender checks the absent-renderImportId case first, unconditionally, so a deck with no renderImportId is byte-identical to today's parsed path (D-16, T-42-07 defense in depth)
- [Phase ?]: The self-contradictory 'ready' + renderedCount<1 render doc resolves to failed with no failureReason, never zero entries -- the server's own ready gate makes this state unproducible in practice
- [Phase ?]: IMPORTED sourceSignature switches from an unsafe pipe-delimited encoding to the SCRIPTURE branch's control-character separators (importedRenderReconciler.ts); slideGroupMaterializer.ts is rewired to call it in 42-04
- [Phase ?]: 42-05: slideshowAssembler.ts's two IMPORTED paths now route through the shared importedRenderReconciler (resolveImportedRender/importedEntryIdentities/importedEntryContent), keyed on deck.renderImportId — matching 42-04's materializer wiring so the grid and presenter provably agree
- [Phase ?]: 42-06: renderFailureSentence lookup deliberately leaves incomplete-render unmapped per UI-SPEC's contract; routes through generic fallback
- [Phase ?]: PresentationViewer's failed-render icon uses h-8 w-8 amber-300 (smaller than the pending spinner) per UI-SPEC wording; the never-louder guarantee is enforced at the heading level (identical text-4xl font-semibold on both states).
- [Phase ?]: Switched useSlideshowAssembly's lifecycle hook from onUnmounted to onScopeDispose so render-listener teardown is testable outside a mounted component and works identically inside one
- [Phase ?]: distinctRenderImportIds/renderReadySignal follow the existing synchronous-computed-decides-WHAT / async-watch-does-the-work split; renderedUrlCache is keyed renderImportId:renderedCount so a re-render's page-count change cannot serve a stale URL array
- [Phase ?]: 43-01: One shared NonAssignableSlot.body?: string (not per-kind fields) for MESSAGE/ANNOUNCEMENTS/MISC; ANNOUNCEMENTS/MISC reuse PRAYER's neutral badge colour; projected slide shows kind label not body (deferred owner check in PENDING-VERIFICATION.md)
- [Phase ?]: Exhaustiveness backstop binds on slot.kind, not slot — NonAssignableSlot's shared 4-literal kind union doesn't narrow to never at the whole-object level via sequential if-return checks
- [Phase ?]: MESSAGE branch prefers body over sermonPassage; ANNOUNCEMENTS/MISC pass length through per plan instruction
- [Phase ?]: 43-04: SlotKind is a parallel, non-structural type — widening it alone does not reach addSlotAsItem's exhaustiveness backstop; the probe must widen NonAssignableSlot['kind'] to actually prove the backstop fires
- [Phase ?]: 43-04: body renders on ServicePrintLayout.vue/ShareView.vue via each surface's own free-text vocabulary (whitespace-pre-wrap notes precedent), text interpolation only, absent body renders label-only like PRAYER — no shared component, no v-html
- [Phase ?]: 43-04: T-43-03 (body visible in published share snapshot) accepted not mitigated — buildServiceSnapshot already copied slots wholesale since plan 01, and notes has published under the same share token since v1.0; recorded in PENDING-VERIFICATION.md for owner confirmation
- [Phase ?]: Empty/unset defaultServiceTemplate produces an EMPTY new service (owner's 2026-08-07 override) — buildSlots() is never called from createService
- [Phase ?]: VW-type ordinal mapping cycles via modulo for templates with more than 5 SONG entries (44-RESEARCH.md Assumption A1)
- [Phase ?]: Row aria-labels/kind labels reuse slotLabel(createSlot(kind)) instead of a second hand-written switch
- [Phase ?]: Per-item remove fires immediately with no confirm (template entries carry no user content, unlike live ServiceEditorView slots)
- [Phase ?]: All five SERVICE_SECTIONS containers render as live Sortable drop targets whenever the draft is non-empty, even when currently empty
- [Phase ?]: 45-01: buildUpstreamUrl extracted as an exported pure function for testability; .vn glyph span stripped (not just ignored as source) to prevent a leaked duplicate digit before [N]; RESEARCH.md fixtures used in place of a fresh live NLT fetch (.env.local unreadable in this sandbox)
- [Phase ?]: 45-02: bibleVersion field defaults to NLT (owner override) via the single existing loadOrgContext merge; no second defaults path
- [Phase ?]: 45-04: AI-split-produced congregational sections are stamped from the version captured at the ORIGINAL fetch (lastFetchedVersion), never a live re-read of authStore.settings.bibleVersion at split time, since a split transforms already-fetched text rather than re-fetching (R092).
- [Phase ?]: 45-04: both ScriptureInput.vue preview fetch call sites (reference-preview panel + AI-suggestion expanded preview) route through one shared fetchPassageByOrgSetting() helper by the church's bibleVersion setting, not just the primary one, for consistency.
- [Phase ?]: 45-04: discovered and worked around a pre-existing test-harness race in src/stores/auth.ts — its real onAuthStateChanged listener resets settings.value to defaults on a microtask after store creation, which can silently discard a test's synchronous settings mutation if read back across an async gap. Not a production bug; fixed only in test mutation timing.
- [Phase ?]: 46-01: Built SLIDE_FONTS from RESEARCH.md's corrected weight table (Open Sans/Source Serif 4 ship 500; Source Serif 4 also ships 300; Lora excludes 300), not the UI-SPEC's unverified draft
- [Phase ?]: 46-01: Task 1 package-legitimacy checkpoint pre-resolved and recorded DEFERRED in PENDING-VERIFICATION.md per v1.5 standing autonomy grant; RESEARCH.md's direct tarball verification stands in for the owner's pending sign-off
- [Phase ?]: 46-02: cssVarsFor falls back to the FULL Inter/400/md default (not a partial per-field snap) when family/weight/scale fails validation
- [Phase ?]: 46-02: loadFontCss hardcodes one dynamic-import per curated family (static @fontsource/<package> prefix) so Vite can bundle the weight chunks
- [Phase ?]: Slide Typography save mirrors the whole authStore.settings.slideTypography object in one assignment (not three independent field mirrors), since family/weight/scale are always saved together as one selection; the Firestore write itself stays three separate leaf dot-paths.
- [Phase ?]: Split 46-03 Task 1/Task 2 so each commit leaves the Slide Typography card in a working, testable state: Task 1 wires save directly on change; Task 2 replaces the family-change handler with snapWeight + loadFontCss and adds the live Preview panel.
- [Phase ?]: 46-04: SlideCard receives typography via a parent-computed prop rather than importing the auth store itself, preserving its 'reads no store' contract
- [Phase ?]: 46-04: PresentationViewer's playCurrentMedia() moved to fire after the font gate resolves, since AudioPlayer/VideoPlayer refs don't exist until the gated canvas mounts
- [Phase ?]: 47-01: isFirstSection added only to ScriptureSlide (not any other slide variant) since it is meaningless without a section field
- [Phase ?]: 47-01: splitPerVerse reuses parseVerses directly rather than splitPassage/splitBySentences, so it never groups multiple verses onto one segment
- [Phase ?]: 47-02: kept claudeApi.ts's splitCongregationalReading return contract unchanged; editor maps AI text back to boundary indices via alignSegmentsToBoundaries instead of refactoring claudeApi.ts
- [Phase ?]: 47-03: isFirstSection set as a plain boolean directly inside each content-resolution path's section-present branch (not a conditional-spread) — the surrounding branch already guarantees a Reference-state slide never reaches it.
- [Phase ?]: 47-03: PresentationViewer's 3-way speaker label/colour kept as its own literal-string computed rather than routed through slideDisplay.ts's speakerDisplayName, matching the file's existing independent style.
- [Phase ?]: 47-03: EditSlideDrawer's 3-way speaker cycle expressed as one NEXT_SPEAKER lookup table so a future 4th role touches only one place.
- [Phase ?]: 48-01: Sort only images bucket in classifyFiles via Intl.Collator (numeric, base sensitivity); decks/videos/audio keep drop order (D-098)
- [Phase ?]: 48-01: GettingStarted dismiss uses flat unscoped localStorage key wp:gettingStartedDismissed, matching CollapsibleSection.vue precedent for per-device UI chrome
- [Phase ?]: 48-02: 44px hit-area padding applied unconditionally (not breakpoint-gated) per 48-UI-SPEC; SortableJS touch options (delay/delayOnTouchOnly/touchStartThreshold) added strictly additively to preserve the ZTXcpNRcJTalEQp42fTx index-bug guard
- [Phase ?]: 48-03: Task 1 landed the full ActionBarContext/ActionBarHandlers type contract AND its one consumer (ServiceEditorView.vue's activeActionItems) in the same commit, so npm run type-check stayed green on every committed intermediate.
- [Phase ?]: 48-03: The save-status wrapper's 'flex items-center gap-2' is now unconditional (only border/background/padding/sticky stay tied to serviceSaveStatusVisible) so the relocated Undo link lays out correctly beside SaveStatusIndicator even at idle.
- [Phase ?]: R109: firebase.json hosting.headers serves /index.html with Cache-Control no-cache, no-store, must-revalidate; assets/* left untouched; deploy-gated per standing NO-DEPLOYS grant
- [Phase ?]: R107 (50-02): the existing slideGroupMaterializer.ts survivor mechanism (isSlotDerivableRef/survivingEntries/carryStoredDerivedEntries/orderedByStoredPosition) already satisfies manual-add preservation across every rebuild path — proven by a 9-case suite (manualAddPreservation.test.ts) with zero production code changed
- [Phase ?]: R108 requirement left unchecked after 50-03: this plan is part 1 of 2 (RECORD sourcePage/renderedPage); part 2 (CONSUME, plan 50-05) is what actually resolves multi-image decks and will mark R108 complete.
- [Phase ?]: renderedPage deliberately excluded from SourceRef.derivedIdentityKey (documented in slideGroup.ts) -- it is provenance, not identity, so existing carry/survival matching (R107) is unaffected.
- [Phase ?]: R106: per-group 'Remove imported slides' bulk action, gated on window.confirm reusing the existing codebase confirm pattern — Removal is irreversible and multi-slide; reused the established window.confirm pattern from useUnsavedGuard.ts/LyricPasteRegion.vue rather than inventing a new modal
- [Phase ?]: R108: importedEntryContent resolution order strictly extends ec217aa — synthetic rendered-page-N identity, then supplied renderedPage (50-03), then the 1:1 positional fallback for legacy entries, then pending; legacy multi-image entries stay unfixed by design (fallback, no migration, per 50-CONTEXT.md).
- [Phase ?]: 52-02: template body input scoped to MISC + ANNOUNCEMENTS; editor seed + createService fallback share the one buildSuggestedTemplateEntries() preset
- [Phase ?]: R117 split = additive slideBreaks LINE indices over section.lines (not a slides array); sliceSectionIntoSlides is the single pure definition, read-tolerant clamp
- [Phase ?]: R120 numbering derived at render time in buildSectionRows (deriveSectionKind + per-kind displayLabel); stored LyricSection.label never rewritten (BWC)
- [Phase ?]: 53-02: split lyric sections resolve LIVE to N slides at both assembler call sites via sliceSectionIntoSlides; ids ${entry.id}:${i} (stored) / advancing localSeq (fallback), unsplit byte-identical; R118 falls out for free, no group-model change
- [Phase ?]: R122: slot-level notes? on the base MediaAttachableSlot (cast-free on all 5 kinds, distinct from Service.notes); one shared responsive notes input beside every selector; emptied value dropped by stripUndefined
- [Phase ?]: Roboto added as sixth curated @fontsource slide font (^5.3.0, OFL-1.1); Inter stays first/default; adding a font = one registry entry + one static-prefix loader line + test count bump
- [Phase ?]: Quick task 260812-izz: removed BPM from share link and print, added universal per-item notes for all slot kinds on both surfaces, confirmed MISC-0-slides (R123) still correct with no code change. Full vitest run surfaced a third failing suite (render-service/src/render.test.ts, pre-existing vitest 4.0.18/4.1.10 version mismatch) not in CLAUDE.md's documented 2-file baseline — unrelated to this task, flagged for the owner.
- [Phase ?]: DEFAULT_ORG_SETTINGS.messaging.enabled defaults false (fail-closed, R130) — deliberate deviation from aiEnabled/pcEnabled, asserted by a unit test
- [Phase ?]: messaging deep-merged in loadOrgContext parallel to slideTypography's WR-01 fix; timezone flat-merges via the existing outer spread; no dual-read/migration needed for either new field
- [Phase ?]: 58-02: resolveRecipients silently skips stale/deleted personIds without inflating unreachableCount (resolves 58-RESEARCH.md Open Question 1)
- [Phase ?]: 58-02: MESSAGING_TEAM_LABELS is its own standalone RoleGroup label constant, independent of RolesConfigPanel.vue's groupLabels
- [Phase ?]: 58-03: firestore.rules ships built/tested/UNDEPLOYED for messages/recipients/lockSnapshots per v1.7 deploy-gated grant; owner runs 'firebase deploy --only firestore:rules'
- [Phase ?]: Messaging card kill-switch seeded from authStore.settings.messaging.enabled (fail-closed default false, per 58-01)
- [Phase ?]: reminderDaysBefore explicitly wrapped in Number(...) on write and revert, verified typeof === 'number' in tests
- [Phase ?]: From-name/Reply-to use explicit-Save (not auto-save), mirroring Organization Name's debounce-boundary pattern
- [Phase ?]: 58-05: per-service messaging overrides write via scoped setServiceMessagingDefaults dot-path (never updateService), bypassing the R036 draft-content affectedKeys() guard (R132)
- [Phase 60]: 60-01: verify Svix webhook signatures manually with node:crypto (no svix package); REPLAY_TOLERANCE_SEC=300 tagged confirm-against-real-event; recipients.providerMessageId collection-group index ships UNDEPLOYED (owner deploy).
- [Phase ?]: aiUsage/aiRateLimits kept top-level (not nested under organizations/{orgId}) so the firestore.rules catch-all deny blocks client reads with zero rules change
- [Phase ?]: Rate limiter fails OPEN on its own Firestore error (cost guardrail, not security control) — a datastore hiccup never takes AI down
- [Phase ?]: logAiProxyError classifies proxy 429/400 by err.status structurally (console.warn) vs generic failure (console.error), added to the existing src/utils/__tests__/claudeApi.test.ts per repo convention
- [Phase ?]: firestore.rules aiUsage/aiRateLimits deny blocks committed but NOT deployed (owner-gated per v1.8 grant); firebase deploy --only firestore:rules handed to owner
- [Phase ?]: readDeleteCap() shared per-run delete cap (STORAGE_CLEANUP_MAX_DELETES_PER_RUN, default 500) bounds cleanupExpiredMediaHandler/cleanupOrphanRendersHandler LIVE runs; dry-run is never capped so owner sees true backlog before enabling
- [Phase ?]: R167/R168: added a floor guard beyond the plan's original spec -- a background reference scan that succeeds but returns zero references while candidates exist is treated as incomplete (forces dry-run), per explicit orchestrator hardening instruction.
- [Phase ?]: R170: gated the WHOLE sendScheduledReminders function off by default (SCHEDULED_MESSAGING_CRON_ENABLED); this also disables schedule-for-later dispatch until enabled
- [Phase ?]: R171: reject-over-cap (never truncate) for MESSAGE_MAX_RECIPIENTS; fixed-window per-org ORG_MAX_EMAILS_PER_DAY quota via new checkAndConsumeOrgEmailQuota
- [Phase ?]: R172: one setGlobalOptions maxInstances=20 ceiling at module top; api keeps its own tighter maxInstances=10 (not clobbered)
- [Phase ?]: R173: kept --concurrency=1 on render-service (not the 4 floated in 67-CONTEXT.md) — LibreOffice shared-profile-lock makes concurrent conversions on one instance unreliable; --max-instances tightened to 3 as the explicit cost ceiling.
- [Phase ?]: 68-01: Shared mergeAndSetCustomClaims/clearClaimKeys helper closes the org-membership claim replace/wipe hazard (R175); both write branches refactored, SC1 regression proves superAdmin survives an org-membership clear.
- [Phase ?]: isSuperAdmin() Firestore rules helper is claim-only (no get()/exists()) per R178, avoiding the storage.rules deny-everyone fragility class
- [Phase ?]: appConfig/* and superAdmins/* gated on isSuperAdmin() with genuine ALLOW + DENY emulator tests; no appConfig doc contents written (Phase 69 boundary)
- [Phase ?]: 68-04: reused the existing shared functions export (httpsCallable(functions, 'setSuperAdminClaim')) instead of a fresh getFunctions() call, matching the codebase's established onCall convention.
- [Phase ?]: 68-02: setSuperAdminClaim onCall never sets the claim itself -- writes/deletes superAdmins/{targetUid} only; syncSuperAdminClaim trigger remains the sole claim writer (source-doc->trigger->claim indirection).
- [Phase ?]: 68-02: bootstrapSuperAdmin.ts calls mergeAndSetCustomClaims directly (bypassing the trigger) so the first super-admin grant lands even before syncSuperAdminClaim is deployed.
- [Phase ?]: Phase 68 Plan 05: mirrored DEPLOY-ORG-CLAIMS.md structure for functions/DEPLOY-SUPER-ADMIN.md; split rules deploy and Functions deploy into two independent steps; consolidated all deferred R176/R177/R179 UAT items from Plans 02-04 into one owner-facing section
- [Phase ?]: coerceConfigNumber rejects negative values in addition to NaN/Infinity/non-numeric (fail-open-capped extends to negatives, per plan's own R184 test spec)
- [Phase ?]: sender.fromName defined in AppConfig schema now but dormant this phase (Phase 70 forward-compat); sender.fromAddress wired in Plan 02
- [Phase ?]: 69-02: kept the six env-wrapper helpers (readAiProxyLimits/readDeleteCap/readMediaRetentionDays/readOrphanRenderStaleHours/readBackgroundRetentionDays/readPptxSourceRetentionDays) as thin passthroughs over a resolved AppConfig rather than deleting-and-inlining, minimizing diff/test churn
- [Phase ?]: 69-02: MESSAGE_FROM_ADDRESS defineString removed outright (declaration + read-site + all comment references) in favor of config.sender.fromAddress; sender.fromName stays dormant, per-message display name remains the org's own name (R159 unchanged)
- [Phase ?]: 69-03: documentation-only runbook plan strictly scoped to functions/DEPLOY-RUNTIME-CONFIG.md; deferred R181/R183 manual UAT pointed at 69-VALIDATION.md rather than duplicated into PENDING-VERIFICATION.md
- [Phase ?]: AppConfigInput deep-partial type introduced for mergeAppConfig/isExplicitlySet since Partial<AppConfig> is only shallow-optional
- [Phase ?]: (default) badge reuses OwnerConsoleView.vue's existing (read-only) badge style (text-xs text-gray-500 italic) for visual consistency
- [Phase ?]: Added additive update:modelValue emit to ConfigNumberField/ConfigTextField (Plan 01 files) so cross-field/format validation in AiProxyConfigCard/SenderConfigCard reacts to the live-edited value, not just the last-saved effective value.
- [Phase ?]: Per-field save-state uses a Record<string,{saving,saved,error}> plus a stateFor(path) non-null-assertion helper across all four config cards, since noUncheckedIndexedAccess makes a bare Record index access T|undefined.
- [Phase ?]: previewCleanupDryRun: one shared onCall with a type-param dispatch over the four cleanup handlers, forceDryRun OR'd in via a forceDryRun-first ternary rather than a forked pure compute function
- [Phase ?]: R190 hard block implemented as a structurally separate disabled Confirm button with no click handler wired at all (not a conditional disabled attribute) when referencesComplete===false
- [Phase ?]: Card rows carry data-testid=cleanup-row-{type} so tests can disambiguate the row Enable button from the dialog's own Confirm button, which is also labeled Enable per the UI-SPEC copy
- [Phase ?]: ConfigurationTab owns its own subscriptions (not lifted to shell) since v-show guarantees exactly one mount for the console's lifetime
- [Phase ?]: Tab strip mirrors ServiceEditorView.vue's plain-button pattern with no ARIA tablist/tab roles, per UI-SPEC precedent
- [Phase ?]: 73-01: decideMembershipClaim's contract stays unchanged; orgs recompute lives in the handler + buildOrgsMapClaim/computeOrgsClaimForUid so plan 73-03's backfill needs zero changes
- [Phase ?]: 73-01: primary-membership delete uses two sequential merge-preserving writes (clearClaimKeys then mergeAndSetCustomClaims) rather than a combined raw setCustomUserClaims, per critical constraint 5
- [Phase ?]: Kept the orgs-map equality check as a small local copy in backfillOrgClaims.ts (not exported from orgMembershipClaims.ts) to respect the plan's declared files_modified boundary
- [Phase ?]: For a multi-org uid, resolve the primary decision by trying decideMembershipClaim against each membership until one is not skipped for not-primary-org, rather than pre-fetching orgIds ourselves
- [Phase ?]: Rewrote the non-primary-org backfill test to expect an orgs-only write (previously a no-op skip) -- the widened behavior is the point of R210/R207
- [Phase ?]: Used a structural AdminWriter interface (just .set) instead of a Transaction|WriteBatch union so writeAdminAssignment is shared verbatim between onboardOrganization's transaction and assignOrgAdmin's batch
- [Phase ?]: OrganizationsTab.vue is a pure httpsCallable consumer (no firestore writes); friendlyCallableError extended inline with already-exists -> 'That church name is taken.'
- [Phase ?]: OwnerConsoleView.test.ts's generic httpsCallable mock extended to resolve organizations:[] since OrganizationsTab now calls listOrganizations unconditionally on mount

### Roadmap Evolution

- Phase 6 added: AI assisted service suggesting and scripture searching
- Phase 7 added: Invite users, manage members with admin/viewer roles, and enforce role-based access control
- Phase 8 added: Planning Center API export for published service plans
- Phase 9 added: PC Song Import & Tag Management
- Phase 10 added: Worship song export naming, template import improvements, auto-add teams on import, orchestra filter for song suggestions
- Phase 11 added: Song catalog & service planner improvements (catalog browsing/search, themes, metadata search, drag-drop ordering & autosave bug fixes, hide-by-tag, AI hidden-song exclusion, column sorting, delete confirmation)
- Phase 12 added: Advanced song search (metadata-aware + field-scoped syntax) and multi-select persistent tag filtering across the service-plan picker and Songs panel
- Phase 13 added: Volunteer Role Scheduling — roster + PC people import (name/email/phone), editable roles (band/tech/scripture reader; worship leader intentionally NOT a role — leaders self-assign) with multi-person-per-role and multi-role-per-person, per-person 1-in-N serve-frequency target, quarterly blackout dates + must-serve-with pairings via name-matched CSV, auto-proposed frequency-balanced quarterly grid (dates×roles) with manual editing. NOTE: reverses PROJECT.md "Musician scheduling — out of scope" decision.
- Phase 15 added: Per-Role Frequency & Role-Category Co-occurrence Rules — frequency per (person, role) instead of per person; same-service role compatibility by category (TECH exclusive; BAND/VOCALS/OTHER combine; max 1 instrument/service). Reshapes Phase 14's per-person frequency model. Requested during Phase 14 execution; full context in .planning/todos/completed/per-role-frequency-and-vocal-instrument-pairing.md.
- Phase 16 added: Quarterly Schedule share link — matrix view + list/matrix toggle, memorable /{church}/quarterN-YYYY URL, filter-by-name, cross-screen (Schedule ↔ Volunteer) editing of pairings/roles/per-role frequency/unavailable Sundays, remove Schedule's separate frequency + volunteer date-range picker, pairing that honors per-role frequency (paired only on the occurrences the lower-frequency person serves), collapsible sections, calendar-format UX research, and a right-side slide-out group editor with whole-cell hit target. See ROADMAP.md R-01..R-14.
- Phase 16.1 inserted after Phase 16: Song list tags & columns customization: fold Team tags into Tags, Themes as separate column + column-visibility cog, document 1-2-3 methodology (URGENT)
- Phase 16.2 inserted then REMOVED (2026-07-13): Admin permissions hardening was found redundant — Phase 7 already enforces viewer read-only at the route (requiresEditor guards), navigation (isEditor-gated sidebar), and Firestore rules (editor-only writes; songs/other collections editor-only). The only net change 16.2 described was EXPANDING viewer read access to Songs/Schedule/Volunteers, which is a feature, not hardening, and was not wanted. Removed from ROADMAP.
- Phase 17 added: Sync schedule with planned services — add a Roles tab to service plans that seeds each role and its scheduled person from the quarterly schedule for that service date, allows per-service overrides (without mutating the schedule), and exposes a public shared service link (like the Phase 16 schedule share link) showing who is serving. Marries the schedule to services so a planned service carries both music AND people-per-role.
- Phase 29-37 added (v1.4 Service and Slides, roadmap created 2026-07-28): 9 phases covering the ordering-model fix, Post-Service, the slide-mirror hard lock (reconciliation deletion), draft-only editing + reopen, save reliability, backgrounds + slide editing, LLM scripture split, presentation correctness + lyric editor, UI rework (Service Order rebuild + contextual action bars), and PowerPoint server-side rendering (deliberately last). Derived from `.planning/research/SUMMARY.md`'s 9-phase default with the hard sequencing constraints from ARCHITECTURE.md/PITFALLS.md applied. See ROADMAP.md Phase Details and REQUIREMENTS.md Traceability.

### Quick Tasks Completed

14 quick-task UX improvements shipped during v1.0 (tasks 6-21). See milestones/v1.0-ROADMAP.md for full list.

- [Quick-1]: PC export dialog refactored with template-based item matching, existing plan detection, plan times
- [Quick-2]: SONG slots use item_type 'song' with CCLI-based arrangement auto-linking
- [Quick-3]: Auto-populate PC item metadata (length, notes) from song's last scheduled item
- [Quick-4]: Import dialog requires explicit button click to close — backdrop/wrapper click-to-dismiss removed
- [Quick-5]: Songs support multiple VW types (vwTypes: VWType[]); PC import captures all category tags; service slot shows selected song's actual types
- [Quick-6]: autosaveSaving boolean guard serialises concurrent onSave() calls; reschedules at 200ms if inflight; debounce increased to 800ms for drag sequences
- [Quick-7]: PC export item titles use bare songTitle only — (Key: X) annotation removed from PC item names
- [Quick-8]: Scripture input replaced with single freeform text field — parses "Isaiah 53:1-6", "John 1:1-10,15-20" etc. into ScriptureRef
- [Quick-9]: ServiceEditorView merges remote Firestore snapshots into localService when autosaveStatus is idle/saved; skips when pending/saving to prevent conflicts
- [Quick-10]: dismissPreview resets all three preview refs (previewText, previewRef, previewError) so showPreviewButton computed re-evaluates to true automatically

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 9 | Subscribe to updates so that if 2 or more people are looking at the Services listing or the Edit Service screen they can see updates made by other people who are looking at the same thing | 2026-03-12 | e0ce5e1 | [9-subscribe-to-updates-so-that-if-2-or-mor](.planning/milestones/quick-archive/9-subscribe-to-updates-so-that-if-2-or-mor/) |
| 10 | Allow closing the scripture preview in edit mode | 2026-03-12 | 9c3bd1f | [10-allow-closing-the-scripture-preview-in-e](.planning/milestones/quick-archive/10-allow-closing-the-scripture-preview-in-e/) |
| 260701-awp | Fix song-picker sticky header (search + tag filters) rendering behind scrolling song list | 2026-07-01 | 5de0ae2 | [260701-awp-fix-song-picker-sticky-header-search-tag](.planning/milestones/quick-archive/260701-awp-fix-song-picker-sticky-header-search-tag/) |
| 260703-246 | Exclude soft-deleted (hidden) songs from AI suggestions via shared aiCandidateSongs getter + regression test | 2026-07-03 | 87b6de4 | [260703-246-make-sure-that-when-the-ai-makes-song-su](.planning/milestones/quick-archive/260703-246-make-sure-that-when-the-ai-makes-song-su/) |
| 260710-s7f | Scheduler honors hard per-role frequency caps AND spreads serves evenly across the quarter (no front-loading); fill-in tier is manual-only, not auto-filled | 2026-07-11 | 8b2aa1a, 0d4d127 | [260710-s7f-schedule-generator-honor-hard-per-role-f](.planning/milestones/quick-archive/260710-s7f-schedule-generator-honor-hard-per-role-f/) |
| 260711-dto | UI-consistency cleanup: renamed Roster/Users routes+titles to Volunteers/Admins (/volunteers, /admins), active-only song counts on Dashboard/Songs, chevron + full-row-click edit affordance on Songs/Volunteers, Add-quarter button moved to Schedule header top-right, sidebar reordered/grouped {Services,Songs}\|{Schedule,Volunteers}\|{Admins,Settings} | 2026-07-11 | a6fedca | [260711-dto-menu-page-route-naming-cleanup-drawer-ed](.planning/milestones/quick-archive/260711-dto-menu-page-route-naming-cleanup-drawer-ed/) |
| 260713-d60 | Volunteers page — active + inactive merged into one table with a Show-inactive toggle (default off, inactive rows dimmed), Actions column replaced by a Status badge, and Deactivate/Reactivate + permanent Delete moved into the edit drawer as immediate-apply status actions; table headers normalized to the SongTable Title-Case convention | 2026-07-13 | fd1b933, 6d631ba | [260713-d60-volunteers-merge-active-inactive](.planning/milestones/quick-archive/260713-d60-volunteers-merge-active-inactive/) |
| 260713-wm9 | Schedule page split into Volunteers/Schedule/Service-dates tabs (default Schedule; generate/fill/regenerate → Schedule tab, add-quarter → Volunteers tab, delete-quarter Danger Zone → Service dates tab); Volunteers page split into Volunteers/Roles-config tabs (Import/Add Volunteer → Volunteers tab). Replaces collapsible sections; reuses ServicesView tab-bar styling | 2026-07-13 | 51a93e1, 8a54d99 | [260713-wm9-schedule-and-volunteers-tabbed-layout](.planning/milestones/quick-archive/260713-wm9-schedule-and-volunteers-tabbed-layout/) |
| 260714-dlt | Schedule matrix redesign: pills replaced with plain comma-separated names + same-size unfilled/conflict/group markers; whole date-row clickable opening a single full-row drawer (all roles, Clear/Swap/Add/gap-fill); store `lastRegenerate` diffs prev vs new calendar to flag changed dates; "Show changes (N)" checkbox highlights changed rows (accent bar + tint + badge). QuarterGrid tests rewritten to row-drawer model (52 tests pass) | 2026-07-14 | 2cdeccd, 977014d, b7cab81 | [260714-dlt-regenerate-change-highlights-and-row-dra](.planning/milestones/quick-archive/260714-dlt-regenerate-change-highlights-and-row-dra/) |
| 260714-e7o | Roles tab (Volunteers → Roles) Save buttons now give visible feedback: per-role Save shows "Saving…" then a green "Saved ✓" flash (~1.8s); Add Role flashes "Added ✓" | 2026-07-14 | 895af68 | [260714-e7o-roles-save-button-feedback](.planning/milestones/quick-archive/260714-e7o-roles-save-button-feedback/) |
| 260714-f4p | PC song import: "Import new songs only" checkbox (default on) skips already-imported songs; matching centralized into exported `partitionPcSongs()` (pcSongId OR non-empty ccliNumber OR lowercased title) with 8 new unit tests; checkbox drives preview counts, confirm upsert, and done summary | 2026-07-14 | fed36d8, d3ceb87 | [260714-f4p-on-song-import-from-pc-only-look-for-son](.planning/milestones/quick-archive/260714-f4p-on-song-import-from-pc-only-look-for-son/) |
| 260805-bvo | Two owner-reported defects: (1) the Present screen's scripture reference rendered `text-indigo-400 uppercase` — restyled to `text-gray-100` so it reads as slide content (it IS the whole slide under R047's reference-only default); (2) non-song slides showed both "Edit details" and "Edit lyrics" — collapsed to one affordance, with the drawer's single body now editing label AND text. Removed the `edit-lyrics` MenuItemKey, its label, its SlidesTab dispatch case, and the drawer's `mode` prop. **Owner-authorised reversal of 33-UI-SPEC §3 row 3a's Hymn anti-shadow-copy carve-out** — every text slide is now editable; only SONG slides stay read-only. | 2026-08-05 | 2d63b0d, d92ecd9, b250a9e | [260805-bvo-scripture-slide-text-renders-as-blue-lab](.planning/milestones/quick-archive/260805-bvo-scripture-slide-text-renders-as-blue-lab/) |
| 260805-kzd | Projected slides carry no label/header text and all slide text is one size. Both `presentation-label` elements are gone: the scripture reference became body content (`presentation-scripture-reference`, `text-5xl text-gray-100`) — it renders unconditionally because the assembler builds scripture slides with `text: ''`, so it is frequently the slide's entire content; the TextSlide title element (the blue "Message"/"Prayer") was deleted outright. Congregational speaker tags lost their indigo/amber uppercase accent and match the body size, keeping the "Leader:"/"Congregation:" wording. **Supersedes 260805-bvo's deliberate-divergence comment and 35-UI-SPEC §R059's label-scoping note.** Owner visual checkpoint still pending (see PENDING-VERIFICATION 37.1). | 2026-08-05 | 5a6befe, aaa60e5, 3d36779 | [260805-kzd-remove-slide-labels-unify-slide-text-size](.planning/milestones/quick-archive/260805-kzd-remove-slide-labels-unify-slide-text-size/) |
| 260805-b5h | Slide-grid group media panel laid out as a horizontal row so add-music and add-background sit side by side. Owner follow-up in the same session removed the per-child `min-w-[14rem] flex-1` (it made each button a half-width column) and relocated the "applies to all N slides…" caption out of `BackgroundControl` (new opt-in `hideCaption` prop) onto its own `basis-full` line below both buttons. Owner visual checkpoint (Task 2) still pending. | 2026-08-05 | 8cc6c28, c3dc559 | [260805-b5h-put-the-group-add-music-and-add-backgrou](.planning/milestones/quick-archive/260805-b5h-put-the-group-add-music-and-add-backgrou/) |
| 260809-vvq | Planning Center export fixes: (1) scripture item description now routes by the church's `bibleVersion` (`fetchNltPassageText` for NLT, `fetchPassageText` for ESV) AND skips the fetch when the reference is empty — this eliminated the empty-`q=` HTTP 400 the owner hit exporting with NLT selected; (2) export now sends ALL remaining slot kinds (PRAYER/MESSAGE/ANNOUNCEMENTS/MISC via a new `otherSlots` bucket; IMPORTED still excluded — no PC analog); (3) `buildPlanTitle` returns the sermon passage ONLY (dropped the `(Teams)` suffix), new plans only. `addSlotAsItem` gained a required `bibleVersion` param (all 9 ServiceEditorView call sites + tests updated). | 2026-08-09 | d97ea02, 8c602bc | [260809-vvq-pc-export-nlt-types-title](.planning/milestones/quick-archive/260809-vvq-pc-export-nlt-types-title/) |
| 20260811-del | Service-plan item delete blocked by Firestore `PERMISSION_DENIED` ("Null value error" in the `slideGroups` delete rule, `ServiceEditorView.vue:2791`): a present-but-null `serviceId` fell through the missing-key orphan-guard into `parentGone(null)`→`svcPath(null)`, and `isOrgEditor` used an unguarded `get().data.role`. Made both null-safe — present-but-null `serviceId` → deletable orphan; `isOrgEditor` `exists()`-guarded like `isOrgMember` + `.data.get('role','')`. +7 emulator rules tests (147/147 pass, 0 regressions); type-check clean. ⚠ **Needs `firebase deploy --only firestore:rules` (owner step)** to take effect in production. | 2026-08-11 | 38df34f | [20260811-service-plan-item-delete-permission](.planning/milestones/quick-archive/20260811-service-plan-item-delete-permission/) |
| 260811-vsr | Service Order editor UI pass, driven by an owner-imported Claude Design mockup (`Slides Tab.dc.html`, Turns 4a desktop / 4b mobile) mapped onto the app's existing dark-indigo theme. **(1)** Plain kinds (Prayer/Misc/Announcements/Message) collapsed to ONE free-text field via `slotFreeText(slot)=notes ?? body` (writes `notes`); the plain-kind `body` textarea + PRAYER link inputs removed from the UI (data retained on the type); `ServicePrintLayout` + Planning Center export migrated to `notes ?? body` (non-destructive, no data migration). **(2)** Unified "three-rail" rows — drag handle · colored per-kind badge (`kindBadgeClass`) · stacked full-width field+notes · right action rail — capped at `max-w-[1060px]`, single-stack below `sm` (walked back Phase-54 side-by-side). **(3)** Per-row editor-only ⋯ menu now owns Move-to-section (→`onSectionChange`) and Delete (→`removeSlot`); inline section `<select>` and inline ✕ removed. **(4)** Muted/dashed "No Section" band (`data-testid=no-section-band`) for the ungrouped bucket. Scope calls (disclosed): template-editor write-to-`notes` deferred behind the read-fallback; no new PRAYER PC data-flow; `slideGroupMaterializer` confirmed not a `body` consumer. type-check clean; app suite green at the 2-file baseline. ⚠ Owner visual/mobile feel verification DEFERRED (see `.planning/PENDING-VERIFICATION.md`). | 2026-08-12 | 35cdc0e, 72b4301, d0157d9, 1094282, 100ff68 | [260811-vsr-service-editor-ui-pass-consolidate-redun](.planning/milestones/quick-archive/260811-vsr-service-editor-ui-pass-consolidate-redun/) |
| 260812-izz | Removed BPM (tempo) from the public share link (`ShareView.vue`) and the print output (`ServicePrintLayout.vue` — deleted `getBpmForSlot` + the now-unused `songs` prop, dropped the `:songs` binding in `ServiceEditorView.vue`); song rows now show Key only. Added ONE universal per-item notes paragraph (`slot.notes ?? legacy body`) rendered once per row for EVERY slot kind on both surfaces, replacing the three per-kind free-text blocks; auto-escaped via `{{ }}` only (T-quick-01, public/unauthenticated). Confirmed MISC-defaults-to-0-slides (R123, `slideGroupMaterializer.ts`) still correct — verification-only, no code change. type-check clean; `npx vitest run` green at the documented 2-file baseline (plus a pre-existing, unrelated `render-service/render.test.ts` vitest 4.0.18/4.1.10 version-mismatch, flagged for owner). | 2026-08-12 | 3c3ac2f, f08a8d0 | [260812-izz-remove-bpm-from-song-share-link-and-prin](.planning/milestones/quick-archive/260812-izz-remove-bpm-from-song-share-link-and-prin/) |
| 260812-jjj | Fixed the Roles-tab "Reset to schedule" control (`ServiceEditorView.vue`). **Root cause:** `onResetRoleOverride` called `serviceStore.clearRoleOverride` (a `deleteField()` write) with NO optimistic local update — unlike its sibling `onToggleOverridePerson` — and the store snapshot watcher's R039 `isOwnWriteEcho` guard swallows the client's own delete echo, so `localService.roleAssignmentOverrides` kept the stale key and the "Overridden" pill (and the button) never cleared. Independent of whether a generated schedule exists (owner just hit it in the no-schedule case). **Fix:** handler now synchronously deletes the local override before awaiting the store call, with rollback on rejection (lock/editor guards preserved); added `cursor-pointer` to the button. +2 regression tests (reset-with-no-schedule → pill clears to "Nobody scheduled"; cursor-pointer), RED→GREEN. type-check clean; `npx vitest run` green at the documented baseline. | 2026-08-12 | 1bb81e7, 71229cd | [260812-jjj-reset-to-schedule-button-needs-a-proper-](.planning/milestones/quick-archive/260812-jjj-reset-to-schedule-button-needs-a-proper-/) |
| 260812-khb | Songs library page, 3 changes. **(1/KHB-01+02)** Empty-state import control (`SongTable.vue`) was a `<router-link>` labeled "Import from CSV" that navigated to `/songs?import=true` (a latent no-op when already on /songs) — replaced with a `<button>` labeled "Import Songs" emitting `import`, wired on `<SongTable @import>` in `SongsView.vue` to `importModalOpen=true` so it opens the SAME `PcImportModal` as the top button; gated on `authStore.settings.pcEnabled`. The top "Import Songs" button was ALREADY pc-gated (added a test only). **(2/KHB-03)** New `songStore.hardDeleteSong(id)` — hidden-only guard (no-op unless `hidden===true`, enforcing "delete/hide it first"), batch-deletes the song doc + its `lyrics` subcollection (Firestore doesn't cascade); org-scoped. **(3/KHB-03)** Hidden Songs list gained a red Delete button with an in-app per-row confirmation (mirrors `SongSlideOver`'s `showDeleteConfirm`; no `window.confirm`). No `firestore.rules` change/deploy — existing songs `allow write` already permits delete. type-check clean; `npx vitest run` green at the documented baseline. | 2026-08-12 | 7f03e22, 5399dee, 8c8cc04, 5a30b17 | [260812-khb-rename-the-empty-library-import-from-csv](.planning/milestones/quick-archive/260812-khb-rename-the-empty-library-import-from-csv/) |
| 260819-one-way-serve-with | "Must serve with" pairings changed from **bidirectional to one-way (directional)**. A person's `pairedWith` is now the list of people THEY must serve with; the scheduler pulls those partners in when that person is scheduled ("Nolan needs Tim" no longer implies "Tim needs Nolan"). `setPersonAvailability` (`quarters.ts`) dropped the symmetric added/removed diff and ALL reciprocal partner writes — a save now touches only `personQuarterData.{id}`, so removing a partner edits only this person's list. **Scheduler unchanged**: `propagatePairing` already follows each person's own `pairedWith`, so one-way falls out for free. UI cues flipped: drawer label bidirectional→one-way, roster marker `↔`→`→`; `pairedWith` type comment updated; 4 reciprocal-write `quarters.test.ts` cases rewritten to assert the partner is NOT touched. CSV import (`applyCsvToQuarter`) left untouched per owner (dead feature). Targeted suites 87/87, type-check clean, app suite green at 2-file baseline. ⚠ **Owner data step (LIVE, do AFTER deploy):** split the two existing two-way pairs via scoped UI edits — open **Tim**→remove **Nolan**→Save, open **Gabriel**→remove **Lilly**→Save. Do NOT do these before deploy (old reciprocal code would strip the kept side too). ✅ **Deployed to production (hosting) 2026-08-19** — one-way removal live. ✅ Owner completed both data splits in the UI (Nolan→Tim, Lilly→Gabriel); loop fully closed. | 2026-08-19 | c64502bd | [260819-one-way-serve-with](.planning/quick/260819-one-way-serve-with/) |
| 260822-login-church-picker | Signing in no longer auto-creates an org (removed the `ensureUserDocument` auto-create branch that produced duplicate "<name>'s Church" orgs on a fresh sign-in) — orgs are created only by a super-admin via `onboardOrganization`, and login now only *joins* an org via a pending invite. Added a multi-church login picker (`SelectChurchView`, `/select-church`) with a router org-selection gate: a user in >1 church picks one (choice remembered per session; switch = log out/in), a user in none sees an empty "ask your administrator" state, org-scoped routes redirect accordingly (owner-console exempt). Found in v2.0 emulator UAT; the reported "Zome Church 0 members" was a test-data email typo (`jouctajaxx@` vs `jouctasjaxx@`), not a bug — invites match exact email. Client-only, no deploy. type-check clean; targeted suites 87/87; app suite green at the documented 2-file baseline. | 2026-08-22 | 11464520 | [260822-login-church-picker](.planning/quick/260822-login-church-picker/) |
| 260817-auto-share-link-on-create | Auto-generate a service's share link at creation so every service always has one — a volunteer message's `{{service_link}}` resolves server-side from the newest `shareTokens` doc, which previously only existed after a manual Share click (so an un-shared service emailed an empty link). `createService` now calls the existing `ensureShareLink` (soft-fail try/catch — a share error never fails the create); `maybeRefreshShareLink` keeps it current on later edits. Client-only; no functions/rules change. `services.test.ts` 95/95 (+2), type-check clean. Forward-looking: NEW services only; pre-existing never-shared services still need one explicit **Share** click (an edit does NOT auto-create — `maybeRefreshShareLink` never takes the create branch). | 2026-08-17 | d2cce8bb | [260817-auto-share-link-on-create](.planning/quick/260817-auto-share-link-on-create/) |

### Blockers/Concerns

- Suggestion algorithm scoring weights are first-principles estimates; validate with team's actual song library
- VW slot type enforcement rules should be confirmed with team
- Planning Center CSV column schema should be validated against an actual export
- 22-03: dry-run human-verify checkpoint (Task 2) pending before enabling live deletion in cleanupExpiredMedia
- 22-04: media/autoplay e2e human-verify checkpoint (Task 3) pending before this plan is fully signed off
- 28-06: this phase's human-verify batch (queued in 28-06-SUMMARY.md) is outstanding, alongside Phases 20-23/25-27 — deferred to /gsd-audit-milestone per the documented v1.3 convention.

## 🚀 PRODUCTION DEPLOY — 2026-08-05, `worship-planner-bc515`

v1.4 is **live**. Full `firebase deploy` from `master` at merge commit `3d04569`.

| Target | Result |
|---|---|
| Hosting | ✅ `https://worship-planner-bc515.web.app` serving bundle `index-DaExv7Qk.js` |
| **Firestore rules** | ✅ **released — Phase 31's draft lock now runs on all three layers** |
| Storage rules | ✅ released |
| Firestore indexes | ✅ deployed |
| Functions | ✅ `api`, `parsePptx`, `requestPptxRender`, `cleanupExpiredMedia`, `cleanupOrphanRenders` (all Node 22, 2nd gen, us-central1) |

**Two things went wrong on the first attempt; both are worth knowing about, because neither announced
itself clearly.**

1. **`firebase deploy --non-interactive` refused to start**, demanding a value for
   `PPTX_RENDER_SERVICE_URL`. That param is `defineString(..., { default: "" })` and the EMPTY value
   is a *tested fail-closed branch* (`render-service-not-configured`, T-37-15), not a placeholder —
   but non-interactive mode won't assume a declared default. Fixed by creating `functions/.env` with
   an explicit empty value. **That file is gitignored and holds no secret.** When the Cloud Run render
   service is eventually deployed, set the real URL there and redeploy functions; nothing else changes.

2. **Hosting uploaded but was never released.** The first run printed `file upload complete`, then
   `requestPptxRender` failed on Eventarc service-agent propagation (a first-time-2nd-gen-functions
   warm-up issue), and the whole deploy aborted **before `version finalized` / `release complete`**.
   The retry targeted only the failed function, so production went on serving the OLD bundle while the
   logs read as a mostly-successful deploy. Caught by diffing the live `index.html`'s asset hash
   against `dist/` — not by trusting the CLI. `firebase deploy --only hosting` then completed the
   release. **`file upload complete` is not `release complete`; check the asset hash.**

**~~Still NOT deployed, by design~~ — DEPLOYED 2026-08-06.** See the render-service note below.

## ✅ RESOLVED 2026-08-06 — ALL Storage uploads were broken in production; fixed by one IAM grant

**The fix, for anyone who hits this again:**

On the Cloud Console **IAM** page (not Service Accounts) for `worship-planner-bc515`, **+ GRANT ACCESS**:

- **Principal:** `service-666677495069@gcp-sa-firebasestorage.iam.gserviceaccount.com`
- **Role:** **Firebase Rules Firestore Service Agent**

No redeploy needed — IAM applies on its own. Uploads confirmed working immediately after.

**Two things that made this hard to find, both worth remembering:**

1. **The Storage service agent is invisible by default.** It is Google-managed, so it never appears on
   IAM & Admin → *Service Accounts* (that page lists user-created accounts plus the App Engine/Compute
   defaults). It appears on IAM & Admin → *IAM* only with **"Include Google-provided role grants"**
   ticked. You do NOT need it listed to grant it — **+ GRANT ACCESS** accepts the email typed directly,
   which works whether or not the identity has ever been provisioned.

2. **This project has TWO similarly-named GCP projects** — display names "Worship Planner" and
   "worship planner". The lowercase one is `worship-planner-bc515` (project number `666677495069`).
   Display names are cosmetic; **always select by project ID.** Time was lost looking at the wrong
   project's empty service-account list. `gcloud projects list --format="table(projectId,name,projectNumber)"`
   disambiguates instantly.

**Blast radius was wider than first reported.** The initial symptom was a failed PPTX import, but
*every* Storage upload in the app was dead — an mp3 attach failed identically on the `media/` match.
Both match blocks share the cross-service check, so both denied everyone. Media uploads had shipped
and worked since v1.2; deploying `storage.rules` for the first time on 2026-08-05 without the
accompanying grant took them out.

---

<details>
<summary>Original investigation record (kept — the diagnostic method is reusable)</summary>

## 🔴 OPEN BUG — PPTX upload is blocked in production by storage.rules (2026-08-06)

**Symptom.** A real PPTX import fails at the *upload* step, before the render pipeline is ever
reached: `403` / `storage/unauthorized` on
`orgs/{orgId}/pptx-imports/{importId}/source.pptx`. This has nothing to do with the render service —
that deploy is fine.

**Cause, isolated by experiment (not inferred).** `storage.rules` gates every org path on a
cross-service `firestore.exists(/databases/(default)/documents/organizations/$(orgId)/members/$(uid))`.
That clause is what denies. Two controlled runs against the local emulator:

| Rule under test | Result |
|---|---|
| `storage.rules` as written | **DENIED** |
| identical, cross-service clause removed | ALLOWED |
| clause alone, membership doc **present** (proven via admin read) | **DENIED** |
| clause alone, membership doc **absent** | DENIED |

Identical results present and absent ⇒ **`firestore.exists()` is inert in the Storage emulator — it
always returns false.** The membership doc is not the problem; the app's own Firestore reads prove
membership resolves correctly there.

**Why it reached production.** `storage.rules` had never been deployed until 2026-08-05, and
`src/storage.rules.test.ts` was recorded in CLAUDE.md as a known-failing baseline that "needs the
Storage emulator" and was "not a defect". It fails *with* the emulator running, and the failures are
exactly the two **allow** cases while all deny cases pass. That mislabel is corrected in CLAUDE.md.

**★ Most likely production cause, found 2026-08-06: `--non-interactive` suppressed the grant prompt.**

Cross-service Rules need the **"Firebase Rules Firestore Service Agent"** role. Firebase's docs:
*"once you create and save your first Cloud Storage Security Rules that use these Cloud Firestore
functions, you'll be prompted in the Firebase console or Firebase CLI to enable permissions to connect
the two products."*

**Every deploy in this session passed `--non-interactive`**, which suppresses that prompt. The rules
deployed successfully and the permission was never granted — with no warning. Fix, run interactively
by the owner (no `gcloud` needed):

```
firebase deploy --only storage --project worship-planner-bc515
```

— deliberately WITHOUT `--non-interactive`, answering yes to the permission prompt. Manual fallback:
grant "Firebase Rules Firestore Service Agent" on the Cloud Console IAM page.

Documented constraints, both satisfied here: Storage rules may only read the **default** Firestore
database (ours is `(default)`), and at most two Firestore documents per evaluation (ours reads one).

**This does not make the rule testable.** `firestore.exists()` remains inert in the emulator, so
`storage.rules.test.ts` keeps failing locally and this security-critical rule stays unverifiable on a
dev machine — the exact gap that let it ship. That is the case for option 2 below, scoped as *"make
this rule testable"*, not merely *"make it work"*.

**Two ways out — decide before touching the rule.**

1. **Grant the Firebase Storage service agent read access to Firestore** (production only). Cross-service
   Rules require it. Cheapest if it works, but the emulator still cannot evaluate `firestore.exists()`,
   so this rule would remain **permanently unverifiable locally** — the same condition that hid the bug.

2. **Remove the cross-service dependency** by putting `orgId`/`role` on a custom auth claim, so the rule
   reads `request.auth.token.orgId == orgId`. Works in emulator and production, and makes
   `storage.rules.test.ts` meaningful. Costs real work: a Cloud Function on membership change, client
   token refresh, and a backfill for existing users. This is a phase, not a quick task.

**Do NOT relax the rule to `request.auth != null`.** It would unblock the upload by deleting org
isolation — any authenticated user could read and write any org's Storage.

</details>

## 🚀 RENDER SERVICE DEPLOYED — 2026-08-06

The owner deployed Cloud Run `pptx-render` and added its URL to `functions/.env`; I redeployed
functions so `requestPptxRender` picks it up. All five functions updated successfully.

- **Service:** `https://pptx-render-666677495069.us-central1.run.app`
- **Verified private:** unauthenticated `GET /render` and `POST /render` (with a real JSON body) both
  return `403 Forbidden` from the Google front end. `--no-allow-unauthenticated` was honored.
  *(A body-less POST returns `411 Length Required` — that is the front end rejecting the request
  before IAM, not the service being open. Always probe with a body.)*

- **`PPTX_RENDER_SERVICE_URL`** is set in `functions/.env` (gitignored), replacing the empty value
  that selected the `render-service-not-configured` fail-closed branch.

### ✅ VERIFIED BY OWNER 2026-08-06 — the import works end to end

The owner exercised a real PPTX import against production after the storage.rules IAM grant landed,
and approved it. That single successful run resolves **both** items below by implication, because each
one fails closed and loudly:

- **`run.invoker` binding is present.** Missing, `invokeRenderService` gets a platform 403 before any
  application code runs, and the render doc lands on `render-service-error`.

- **`STORAGE_BUCKET` is correct** (`.firebasestorage.app`, not the `.appspot.com` the docs originally
  said). Wrong, `requiredBucketName()` throws on the first render.

Owner-attributed, consistent with the rest of v1.4: approved from a working import rather than from an
inspection of the `pptxRenders/{importId}` document. If a render ever silently fails later, that
document's `failureReason` is still the first place to look.

**R062 stays `[~]` partial regardless** — for the one reason that has nothing to do with infrastructure:
nothing in `src/` reads the rendered PNGs, so the images exist in Storage and no user ever sees them.
That is v1.5 work.

<details>
<summary>Original open items (kept for provenance — resolved above)</summary>

### Two things NOT verifiable from here — check them on the first real import

Both need `gcloud`, which is not installed on this machine. Neither is a defect; both are unconfirmed.

1. **The `run.invoker` IAM binding.** Without it `invokeRenderService` mints a valid OIDC token and
   still gets a 403 from Cloud Run, because the platform IAM check precedes application code. The
   symptom is a render doc with `failureReason: "render-service-error"` (NOT
   `"render-service-not-configured"` — that one now means the URL is unset, which it no longer is).
   Grant with:
   `gcloud run services add-iam-policy-binding pptx-render --region=us-central1 --member="serviceAccount:worship-planner-bc515@appspot.gserviceaccount.com" --role="roles/run.invoker" --project=worship-planner-bc515`

2. **`STORAGE_BUCKET` on the Cloud Run service.** Must be `worship-planner-bc515.firebasestorage.app`.
   `DEPLOY.md` originally said `.appspot.com` — corrected in `a58a06b`, but if the deploy ran against
   the old text the container will throw on its first render.

</details>

### Still true: NO UI CONSUMES THE RENDERED IMAGES

Deploying changed nothing a user can see. Nothing in `src/` reads `pptxRenders` or `rendered/*.png` —
grep finds only a comment and a type doc. R062 stays `[~]` partial for exactly this reason, and the
display work still has no home in any roadmap.

**One genuinely open item:** backlog 999.3's *verification* half. The rules are live, but nobody has
opened devtools against production and attempted a direct write to a locked service. Live-ness is
confirmed; correct behaviour in production is still inferred from the emulator suite.

## Deferred Items

Acknowledged and deferred at milestone close on 2026-08-05. The owner's instruction was to close v1.4
and route anything found later into the next batch of changes, so these were accepted rather than
resolved.

**Closeout type: `override_closeout`** — not `verified_closeout`. Two reasons, both recorded rather
than smoothed over:

1. **`/gsd-audit-milestone` was never run.** No `.planning/v1.4-MILESTONE-AUDIT.md` exists, so
   requirements coverage, cross-phase integration and E2E flows were never independently audited at
   the milestone level.

2. **Every phase's verification is `status_source: owner-attributed`.** Phases 32–38 were accepted,
   not executed. See `PENDING-VERIFICATION.md`'s CLOSED UNRUN header.

### Quick tasks with missing/unknown completion markers (14)

These predate v1.4 — v1.0-to-v1.3-era task directories whose completion markers are absent or
unreadable. They are bookkeeping debris, not open work: several are demonstrably shipped (task 9's
and task 10's commits are listed in this file's own Quick Tasks table). Deferred as-is.

| Category | Item | Status |
|----------|------|--------|
| quick_task | 1-refactor-pc-export-dialog-with-service-t | missing |
| quick_task | 2-use-song-item-type-and-link-pc-songs-by- | unknown |
| quick_task | 3-auto-populate-pc-item-assignments-person | unknown |
| quick_task | 4-dismissing-the-import-dialog-should-expl | unknown |
| quick_task | 5-support-multiple-types-per-song-and-show | unknown |
| quick_task | 6-fix-service-edit-screen-autosave-inconsi | unknown |
| quick_task | 7-remove-key-x-suffix-from-song-titles-whe | unknown |
| quick_task | 8-replace-separate-book-chapter-verse-scri | unknown |
| quick_task | 9-subscribe-to-updates-so-that-if-2-or-mor | unknown |
| quick_task | 10-allow-closing-the-scripture-preview-in-e | unknown |
| quick_task | 260416-dd1-song-picker-improvements-expand-scrollab | unknown |
| quick_task | 260416-dlb-auto-select-default-teams-in-pc-export-d | missing |
| quick_task | 260711-dto-menu-page-route-naming-cleanup-drawer-ed | unknown |
| quick_task | 260713-d60-volunteers-merge-active-inactive | missing |

### Resolved during close, not deferred

- **Phase 34's UAT** was flagged `gaps_found` by the pre-close audit. That status was **stale, not an
  open defect** — owner findings F1–F5 were closed by gap-closure plans 34-05…34-12 (eight plans, all
  with SUMMARYs) and `34-VERIFICATION.md` reads 12/12 must-haves verified. The file recorded the
  findings but was never re-statused. Corrected to `resolved` at close.

## Session Continuity

Last activity: 2026-07-28 — 29-04 fixed SlideGrid's reorder/append defects (R049, R050)
Last session: 2026-08-21T21:02:15.961Z
Stopped at: Completed 74-02-PLAN.md
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
