# Pending Human Verification — carried forward into the next milestone

**Reset:** 2026-08-12, at the close of v1.6 (deployed to prod 2026-08-12).

The full historical record for v1.4 → v1.6 (phases 31–57, all owner-accepted or
satisfied by production use) was archived to
[`milestones/v1.6-PENDING-VERIFICATION.md`](./milestones/v1.6-PENDING-VERIFICATION.md).
Only the items below were **still genuinely open** at that boundary and must not
be lost. Line references point into the archived file.

These are **not visual-polish deferrals** — they are unfinished ops/security work
and recorded open decisions. Review them during new-milestone scoping
(`/gsd-review-backlog` + requirements intake). C6/C7 are cheap confirmations that
can be closed in minutes; the rest are future-phase candidates or explicit
owner decisions.

---

## ✅ C1 — Phase 40 auth-claim migration — COMPLETE (Deploy 2 shipped 2026-08-12)

**Deploy 2 released to production 2026-08-12 ~21:39 UTC.** `storage.rules` is now
claim-only; the cross-service `firestore.exists()` fallback is gone. Post-deploy
verification: all 3 users confirmed to carry `{orgId: 6vyK2…, role: editor}`
server-side; `test:rules` green 149/149 (storage allow-cases now emulator-provable).
**Remaining owner spot-check (non-blocking):** do one real upload (PPTX import or
media) in the LIVE Berean app to confirm end-to-end — the one thing not provable
without a real user session.

Owner decided (2026-08-12) to FINISH the migration. What was done this session:
- **Accidental multi-org cleanup — DONE (prod).** The pre-check found 2 of 3 users
  were members of accidental, abandoned orgs (`1dcn4…`, `vi9Xw…`) beyond Berean
  (`6vyK2…`). Owner confirmed those orgs are unused/abandonable. A one-off admin
  script (dry-run then `--apply`) deleted the 2 orphaned `members/{uid}` docs. All
  3 users are now single-org (Berean).
- **40.4 MANDATORY pre-check — PASSES.** Backfill dry-run now shows 3 users, all
  single-org in Berean. No multi-org user remains.
- **40.2 backfill — DONE (prod).** `node lib/backfillOrgClaims.js --apply` set
  `{orgId: 6vyK2…, role: editor}` for all 3 users (processed 3, failed 0).
- **Deploy-2 rules change — PREPARED & LOCALLY VERIFIED (not yet deployed).**
  `storage.rules` `isOrgMember` is now claim-only; the `storage.rules.test.ts`
  guard was rewritten to assert the fallback stays removed. type-check clean;
  `test:rules` green **149/149** — and the storage allow-cases now pass in the
  emulator (they never could under the fallback: firestore.exists() is inert there).

**Remaining:**
- **40.3 soak** — wait ≥1 hour after the backfill (done ~20:35 UTC 2026-08-12) so
  every live token re-mints carrying the claim. **Do NOT deploy before then.**
- **40.5 Deploy 2** — `firebase deploy --only storage --project worship-planner-bc515`,
  then confirm all users can still upload/read Berean media.
- **40.6** — exercise the one real pending invite end-to-end after deploy.

**Multi-org note:** the claim still carries the primary org only. Safe now (all
single-org). Before any user ever joins a second real org, widen the claim — see
ROADMAP backlog **999.5**.

## C2 — 2 known-open rules findings (onboarding half CONFIRMED 2026-08-23)

Tightened `firestore.rules` deployed 2026-08-10 (archived 781–803).

**✅ New-org onboarding + access isolation — CONFIRMED IN PRODUCTION 2026-08-23 (owner).**
The v2.1 super-admin Owner Console (Organizations tab → `onboardOrganization` /
`assignOrgAdmin` callables) is deployed. Owner verified end-to-end: onboard a new
church, assign an admin, log in as that admin and see **only** that church (no rogue
churches — claim isolation holds); and logging in as a user assigned to **no** church
hits the "not assigned to a church" gate and cannot proceed further. This retires the
original "create a genuinely new organization" / new-church-onboarding risk.

**🔴 Still open — 2 recorded-but-unfixed rules findings** (future-phase candidates, NOT
addressed by the Owner Console):
1. `organizations/{orgId}` `allow write: if isOrgEditor` lets an editor rewrite `createdBy` (`firestore.rules:31`);
2. `inviteLookup/{email}` `allow create: if isSignedIn()` is a self-invite vector (`firestore.rules:173`).

## C3 — Phase 37 render-service: package sign-off + cleanup-job safety gate

Archived 489–514:
- **37.5** — package-legitimacy checkpoints (`express`, `@google-cloud/storage`, `@types/*` in `render-service/`; `google-auth-library` in `functions/`) were deferred, never formally owner-signed-off. Packages are live in prod.
- **37.6 (operational gate)** — `cleanupOrphanRenders` runs daily 03:00 UTC, dry-run by default. **`PPTX_RENDER_CLEANUP_ENABLED` must stay UNSET until a real dry-run log is read** and confirmed to target only stale renders (never a `source.pptx` / `images/` / `ready` render).

## C4 — Phase 42 pending-slide data-loss gap (owner decision pending)

Archived 919–952. Per-entry customization attached to a deck slide **before its
render completes is lost** when the render flips `pending → ready`. Not fixable
by index pairing (would mis-attach). `EditSlideDrawer.vue` has no `renderState`
awareness — the UI invites customizing a pending slide it will then discard. At
minimum warrants disabling/warning on customization of a pending slide. Owner's
call whether to do a follow-up phase.

## C5 — Phase 41 `deleteService` share-revocation gap (future phase)

Archived 871–886. `deleteService` does not revoke a service's
`shareTokens`/`serviceShares`/`serviceShareLinks` (unlike `deleteQuarter`), so the
public share token is now permanent. `allow delete` rules are already in place, so
a future phase can implement revocation with no rules change.

## ✅ C6 — `NLT_API_KEY` secret is set — CONFIRMED IN PRODUCTION 2026-08-12

Owner confirmed the secret is set and NLT scripture fetch works in prod. Closed.
(Archived detail: v1.6-PENDING-VERIFICATION.md 1114–1116.)

## ✅ C7 — Phase 41/42 rules clauses are live — CONFIRMED IN PRODUCTION 2026-08-12

Owner confirmed in the Firebase console that the deployed ruleset carries the
`shareTokens` `allow create: if isOrgEditor(...)` clause (CR-01) and the
`pptxRenders` write-hole fix (Phase 42 T-37-15/T-42-01). Closed.
(Archived detail: v1.6-PENDING-VERIFICATION.md 864–869.)

---

## ⏳ 58-05 — per-service Messaging defaults panel: Draft→locked read-only (R132) — DEFERRED

Automated gates pass (store action + panel unit tests, type-check, full-suite
baseline). The manual visual confirmation is deferred to owner at
`/gsd-verify-work 58` per the v1.7 grant: on a **Draft** service edit a Messaging
defaults override (e.g. Lock notification → On), then **lock** the service (Mark
as Planned) and confirm the panel switches to the static read-only summary with no
editable select. Coverage id D4 in `58-05-SUMMARY.md`.

---

## ⏳ 59-01 — Resend SDK pin re-confirmation before deploy (R131) — OWNER, PRE-DEPLOY

Phase 59-01 added `resend` as a **functions-only** dependency, pinned **exactly**
to `6.19.0` in `functions/package.json` (never `^`, never the <24h-old 6.20.0), and
it appears nowhere in the root `package.json` or under `src/` (R131 — the provider
SDK never reaches the client bundle). The package is **installed, built, and tested
but UNDEPLOYED**, and no `RESEND_API_KEY` secret was set this phase.

Legitimacy was **discharged by orchestrator npm-registry diligence on 2026-08-14**
(recorded in `59-01-SUMMARY.md`): resend@6.19.0 published 2026-08-10 by the official
Resend org maintainers, **no install/preinstall/postinstall scripts** (so
`npm install` runs no package code), valid `dist.integrity` sha512, canonical
registry tarball, ~9.5M weekly downloads. Residual risk this phase is ~zero because
resend is functions-only, undeployed, and `vi.mock`'d in every test — the real
module never executes until deploy.

**OWNER, before the eventual send-path deploy (59-02/59-03):** re-confirm the
`resend` pin is still legitimate at deploy time (unchanged version, no advisory),
then perform the deploy-side setup that is intentionally NOT done here:
- create the Resend account and `firebase functions:secrets:set RESEND_API_KEY`,
- add the sending-domain SPF / DKIM / DMARC DNS records,
- `firebase deploy` the functions send path.

Do **not** treat this item as passed — it is a pre-deploy gate, not a satisfied one.

---

## ⏳ 59-02 — queueServiceMessage enqueue Function ships UNDEPLOYED (R131/R137/R141) — OWNER, PRE-DEPLOY

Phase 59-02 added the **queue half** of the send path to `functions/src/index.ts`: the
`queueServiceMessage` (`onCall`) Function + its exported `queueServiceMessageHandler` body,
and the shared `createQueuedMessage()` doc-shaper. It re-authorizes the caller server-side
(independent editor-tier membership re-check of the path-derived org — never the client-declared
orgId), re-reads the org messaging kill-switch (`settings.messaging.enabled`) server-side, validates
the type enum + `scheduledFor` sanity, then writes ONE `messages/{id}` doc and returns its id. It
**resolves no recipients and sends nothing** and holds **NO secret** — `RESEND_API_KEY` is declared
in the file but bound to no Function this plan (it binds only to `sendQueuedMessage` in 59-03).

**Built, unit-tested, and UNDEPLOYED.** No `RESEND_API_KEY` secret was set. No Firestore rules
changed (the `messages` create rule shipped deploy-gated in Phase 58; `queueServiceMessage` writes via
the Admin SDK, which bypasses rules — its own editor + kill-switch re-checks are the real control).

**OWNER, once 59-03 (the `sendQueuedMessage` trigger) also lands and legitimacy is re-confirmed
(see item 59-01), deploy BOTH send Functions together:**
```
firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage
```
Before deploy, complete the owner setup still open in item 59-01 (create the Resend account,
`firebase functions:secrets:set RESEND_API_KEY`, add sending-domain SPF/DKIM/DMARC DNS records).

Do **not** treat this item as passed — it is a pre-deploy gate, not a satisfied one. The end-to-end
live send (a real queued message reaching a real inbox) can only be verified after 59-03 + deploy.

---

## ⏳ 59-03 — sendQueuedMessage send trigger ships UNDEPLOYED against a mocked Resend (R131/R138/R139) — OWNER, PRE-DEPLOY

Phase 59-03 added the **send half** of the path to `functions/src/index.ts`: the
`sendQueuedMessage` (`onDocumentCreated` on `.../messages/{messageId}`) trigger + its
exported `sendQueuedMessageHandler` body, plus the pure `functions/src/messageTokens.ts`
token renderer. `sendQueuedMessage` is the **ONLY Function bound to `RESEND_API_KEY`**
(`secrets: [RESEND_API_KEY]` — verified by a source-inspection test that the binding occurs
exactly once in the file). It runs a **transactional `queued→sending` idempotency claim** (a
retried at-least-once trigger, or a `sending`/`sent`/`scheduled` doc, sends ZERO emails —
explicitly tested), **re-resolves recipients server-side** via the 59-01 port (never the
client's stored list — Anti-Pattern 1), renders per-recipient `{{their_roles}}` (R139), sends
via a **fully MOCKED Resend** (`vi.mock("resend")`), writes one `recipients/{id}` doc per
recipient, rolls up `deliveryCounts`, and flips the message status to `sent`|`partial`|`failed`.

**Built, unit-tested, and UNDEPLOYED.** No real email is sent, no `RESEND_API_KEY` secret was
set, and no Firestore rules changed. Two new config `defineString`s were added with tested
empty/placeholder defaults: `SERVICE_SHARE_BASE_URL` (empty default → `{{service_link}}`
renders `''`) and `MESSAGE_FROM_ADDRESS` (placeholder default; the owner sets a verified
sending-domain address at deploy time).

**OWNER, before the send path goes live — re-confirm the `resend@6.19.0` pin (item 59-01),
then complete the deploy-side setup that is intentionally NOT done here:**
- create the Resend account and `firebase functions:secrets:set RESEND_API_KEY`,
- add the sending-domain SPF / DKIM / DMARC DNS records,
- set the two configs to production values (`SERVICE_SHARE_BASE_URL` = the app origin,
  `MESSAGE_FROM_ADDRESS` = a verified Resend sender),
- **deploy both send Functions together:**
  ```
  firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage
  ```

The end-to-end live send (a real queued message reaching a real inbox) is owner-verified at
`/gsd-verify-work 59` (59-VALIDATION.md Manual-Only). Do **not** treat this item as passed —
it is a pre-deploy gate, not a satisfied one.

---

## ⏳ 59-04 — ✉ Messages composer visual/interaction UAT — DEFERRED (owner at /gsd-verify-work 59)

Phase 59-04 shipped the **client** send surface: the ✉ **Messages** action-bar entry point
(`src/views/serviceEditorActionBar.ts`, editor-gated, **present-but-disabled with a Settings tooltip
when messaging is off** per UI-SPEC #0) and `src/components/MessageComposer.vue` — teams-first recipient
chips + Everyone + addable individuals, three message types seeding subject/body behind a dirty guard,
subject/body with caret-inserted merge tokens (raw template stored), a live pluralized "Reaches N"
count via the Phase 58 `resolveRecipients`, the three options (attach-link default on, send-me-a-copy,
schedule-for-later reveal), and a dynamic Send calling the `queueServiceMessage` client callable with
the recipient **selector only** (no email list crosses the boundary; the server re-resolves in 59-03).

**Automated gates all pass** (2026-08-14): `serviceEditorActionBar.test.ts` (47) green,
`MessageComposer.test.ts` (19) green, `npm run type-check` (vue-tsc --build) clean, full app suite at
the 2-file known-failing baseline (storage.rules.test.ts + RosterView.test.ts), no new regressions.

**The client calls the (still-UNDEPLOYED) `queueServiceMessage` callable** — that is expected under the
v1.7 grant; the send path is exercised by tests, not a live deploy. No deploy, no `.env.local`, no
secret changes were made this plan.

**OWNER, at `/gsd-verify-work 59` — manual visual/interaction UAT (do NOT mark passed here):**
- open a service, click **✉ Messages**, and compare the composer to
  `.planning/research/DESIGN-messaging.md` §5a (teams-first layout, indigo accent, live "Reaches N").
- toggle recipients and confirm the per-chip counts, "Reaches N", and the Send enabled-state update live.
- turn **Messaging off** in Settings and confirm the ✉ item renders **disabled with the tooltip**
  ("Turn on Messaging in Settings to email volunteers"), not hidden.
- the end-to-end **live send** (a real queued message reaching a real inbox) remains gated on the
  59-01/59-02/59-03 pre-deploy steps above — it cannot be verified until the send Functions deploy.

---

## Also still open (tracked in ROADMAP `## Backlog`, not here)

- **999.3** — firestore.rules are deployed, but the **production devtools bypass check** (set a service to Planned, attempt a direct Firestore write, expect permission denied) was never performed against prod.

---

## Phase 60 (Delivery History & Bounce Webhook) — 60-01, built/tested/UNDEPLOYED 2026-08-14

Plan 60-01 shipped the pure Svix HMAC signature verifier (`functions/src/webhookSignature.ts`) and the
deploy-gated collection-group index for 60-02's addressing fallback. No secret set, no deploy, no
`.env.local` change this plan (v1.7 grant). The following are **OWNER pre-deploy steps — do NOT mark
passed here:**

- **Deploy the collection-group index** so 60-02's fallback query does not throw `FAILED_PRECONDITION`
  in production:
  ```
  firebase deploy --only firestore:indexes
  ```
  This enables `collectionGroup('recipients').where('providerMessageId','==', data.email_id)`. The
  index build is async on Firebase's side — confirm it reaches **Enabled** in the console before the
  fallback path is exercised live.
- **Confirm `REPLAY_TOLERANCE_SEC` (±300s / 5 min) against a real Resend event** at `/gsd-verify-work 60`.
  The 5-minute window is the Svix library default `[ASSUMED]` (research A1 / Open Question 1); if
  legitimate, slightly-delayed events are being rejected, loosen the named constant in
  `functions/src/webhookSignature.ts` and redeploy the webhook (60-02).
- (60-02 will add) `firebase functions:secrets:set RESEND_WEBHOOK_SECRET`, `firebase deploy --only
  functions:messageWebhook`, and the Resend dashboard webhook-URL + signing-secret configuration — those
  are handed over when 60-02's `messageWebhook` Function lands.

---

## ⏳ 60-02 — messageWebhook bounce receiver ships UNDEPLOYED against a mocked secret (R143) — OWNER, PRE-DEPLOY

Plan 60-02 added the milestone's new **unauthenticated trust boundary** to `functions/src/index.ts`:
the `messageWebhook` (`onRequest`) HTTP Function + its exported `messageWebhookHandler` body, and the
exported `resolveRecipientRef` + `recordBounce` helpers. `messageWebhook` is the **ONLY Function bound
to `RESEND_WEBHOOK_SECRET`** (`secrets: [RESEND_WEBHOOK_SECRET]` — verified by a source-inspection test
that the binding occurs exactly once and lives in the wrapper). The handler **verifies the Svix HMAC over
`req.rawBody` FIRST** (60-01's `verifySvixSignature`): a non-Buffer body → 400, any
missing/tampered/stale/wrong-secret signature → 401 with **ZERO Firestore access** (a test asserts
`getFirestore` is never called on a bad-signature request). Only `email.bounced` with a `Permanent` bounce
surfaces — it addresses the recipient via the echoed tags (direct doc) or the `providerMessageId`
collectionGroup fallback and, in one transition-guarded transaction, flips `recipients/{id}` to
`status:'bounced'` and writes a **literal** `deliveryCounts.bounced = prev+1` **only** on the
not-bounced → bounced transition (a duplicate delivery keeps the count at 1). Every other valid event
(soft/`Transient`, `email.delivered`, complaint, unknown type, unresolvable recipient) → **200 with no
write** (a non-2xx would make Resend retry forever).

**Built, unit-tested, and UNDEPLOYED against a MOCKED secret and a hand-computed valid signature.** No
`RESEND_WEBHOOK_SECRET` was set, no deploy, no `.env.local` change, no Resend dashboard config (v1.7 grant).
`RESEND_WEBHOOK_SECRET` appears in **no file under the client `src/`** and is **not in `.env.local`**.

**OWNER, before the webhook goes live — do NOT mark passed here:**
- `firebase functions:secrets:set RESEND_WEBHOOK_SECRET` — set the `whsec_`-prefixed Svix signing secret
  (distinct from `RESEND_API_KEY`).
- `firebase deploy --only firestore:indexes` — the 60-01 `recipients.providerMessageId` collection-group
  index must reach **Enabled** in the console before the addressing fallback query runs live.
- `firebase deploy --only functions:messageWebhook` — deploy the receiver.
- **Configure the Resend dashboard webhook**: point it at the deployed `messageWebhook` URL and paste the
  **same** signing secret that was set above.
- At `/gsd-verify-work 60`: confirm a **real hard bounce** flips a recipient's history to `bounced` and
  increments `deliveryCounts.bounced` once, and re-confirm the tags echo (research A2) and the ±5-min
  `REPLAY_TOLERANCE_SEC` (A1) against one real event; keep tags as the fast path.

Do **not** treat this item as passed — it is a pre-deploy gate, and the live bounce is owner-verified
(`deferred_human`).

---

## 60-03 — "Sent on this service" delivery-history panel — DEFERRED (visual/interaction UAT)

**Status: built, fully unit-tested, NOT visually verified — do NOT mark passed.** The read-only
per-service delivery-history panel (R142) with per-message hard-bounce surfacing (R143) ships this plan:
a `serviceMessages` read store (nested `services/{id}/messages` onSnapshot + lazy `messages/{id}/recipients`
`status=='bounced'` getDocs — NESTED-path reads only, under the already-shipped Phase 58 `isOrgMember`
rules; **no new Firestore rule, no deploy, no `.env.local`**), the `ServiceMessageHistory.vue` card, its
mount + kill-switch/editor gate in `ServiceEditorView.vue`, and the RosterView `?edit={personId}` deep-link.

Automated coverage is green (serviceMessages.test.ts, ServiceMessageHistory.test.ts, ServiceEditorView.test.ts
present/absent, RosterViewEditQuery.test.ts; type-check clean; full app suite at the 2-file known-failing
baseline). What no test can assert is the **visual/interaction** contract — that is owner UAT at
`/gsd-verify-work 60`:

- **Layout matches DESIGN-messaging.md §5b / 60-UI-SPEC.md:** open a service with sent messages and confirm
  the card renders below the messaging-defaults panel — newest-first rows, type badge (One-off / Reminder /
  Share link / Automatic), the `{N} sent` count + send time (or "Scheduled for …"), and the correct status
  pills (none for a clean sent; Partial/Failed/Scheduled/Sending…).
- **Real bounce surfaces (needs 60-01/60-02 DEPLOYED first):** after the webhook is live and a real hard
  bounce lands, confirm the red "N bounced" indicator appears on the affected row and expands to the bounced
  recipients (name / email / reason).
- **Fix-email deep-link navigates:** click "Fix email →" and confirm it lands on `/volunteers?edit={personId}`
  with that volunteer's edit form open on the exact record.
- **Kill-switch hides the panel:** with messaging OFF (Settings), confirm the history card is absent from the
  Service Order tab (the composer's disabled ✉ action-bar item carries discoverability instead).

Do **not** treat this item as passed — it is `deferred_human` visual/interaction UAT, and the live-bounce
arm additionally depends on the 60-01/60-02 webhook deploy gate above.

---

## ✅ RESOLVED (by 64-03, 2026-08-16) — composer success toast misrenders

**Fixed via Option A:** `MessageComposer.vue`'s success `toasts.push(...)` call (and the now-unused
`useToasts` import) were removed in Phase 64 Plan 03 (R155). A successful send now relies on
`emit('sent', …)` + the modal close + the Phase 60 delivery-history panel — no toast, so the
failure-only `ToastHost.vue` "Save failed." prefix can no longer misrender success as failure. The
composer test that asserted the toast was flipped to `expect(mockToastPush).not.toHaveBeenCalled()`.
The original disclosure is retained below for the record.

**Not a Phase 61 item — a shipped Phase 59 UX bug, disclosed here for the owner to decide + fix.**

`src/components/MessageComposer.vue:592` calls `toasts.push('Message queued to N people')` (or
`'Message scheduled'`) on a SUCCESSFUL send. But `src/components/ToastHost.vue:18` hard-codes a red
`<span class="font-medium">Save failed.</span> {{ toast.message }}` prefix on every toast — the toast
store is a **failure-only** stack (R041 "Save failed" incident). So a successful send renders as:

> **Save failed.** Message queued to 5 people

i.e. success reads as failure. It fires on every composer send. Two independent agents (Phase 61
UI-researcher + UI-checker) flagged it. Phase 61's own lock-notification deliberately AVOIDS the toast
(it uses an inline amber lock-banner confirmation line) precisely because of this.

**Recommended fix (owner's choice, small, out of Phase 61 scope so NOT auto-applied):**
- **Option A (minimal):** remove the `toasts.push(...)` success call from `MessageComposer.vue` — the
  composer already closes on success (`emit('sent', …)`) and the Phase 60 delivery-history panel now shows
  the sent message, so the toast is redundant. Zero toast-system change. Update the composer test that
  asserts the toast.
- **Option B (durable):** add a success/info variant to `toasts`/`ToastHost.vue` (drop the hardcoded
  "Save failed." prefix; carry a `variant: 'error' | 'success' | 'info'` on each toast). Larger,
  project-wide feedback pass — benefits any future success toast.

Recommendation: A now (stops the misrender immediately), B as a later feedback-system pass. Do NOT mark
passed — this is a disclosed defect awaiting the owner's decision.

---

## ⏳ 61-02 — sendScheduledReminders daily reminder cron ships UNDEPLOYED against a mocked provider (R145/R133/SC3/SC4) — OWNER, PRE-DEPLOY

Plan 61-02 added the **R145 reminder engine** to `functions/src/index.ts`: the exported
`sendScheduledRemindersHandler` body + the `sendScheduledReminders` (`onSchedule`, **04:00 UTC**) wrapper.
It mirrors `cleanupOrphanRendersHandler` exactly — a broad
`collectionGroup('services').where('status','in',['planned','exported'])` scan (**NEVER `draft`**, so a
draft is structurally unreachable — SC4), org recovered from the parent chain, per-item try/catch. Per due
candidate (org-local `minusDays(service.date, effectiveN) === todayInTimeZone(org.settings.timezone)` — R133)
it enqueues **one** `type:'reminder'` message via the shared `createQueuedMessage()` shaper
(`includeEveryone:true`, `attachServiceLink:true`, `requestedByUid:'system'`), then sets
`messaging.reminderSentAt` via an Admin-SDK dot-path merge (fires on a LOCKED service). It reads
`settings.messaging.*` (kill-switch `enabled === true`, `reminderEnabled`, `reminderDaysBefore ?? 7`).

**Built, unit-tested (139 functions/index tests, 240 full functions suite), and UNDEPLOYED against a MOCKED
provider.** The cron holds **NO secret** — it only enqueues; `RESEND_API_KEY` binds solely to
`sendQueuedMessage`. **No new npm package, no new Firestore index** (single-field collection-group scan; the
~366-day lookahead is a CODE filter), **no deploy, no `.env.local` change** (v1.7 grant).

**Idempotency note:** `reminderSentAt` is set AFTER the enqueue, satisfying SC4's same-window no-double-send
(proven: a second same-window run enqueues zero). A rare crash-between-writes single double-send remains at
daily cadence; the claim-first transactional upgrade is documented as future hardening in `61-02-SUMMARY.md`.

**OWNER, before the reminder cron goes live — do NOT mark passed here:**
- **Deploy the cron:** `firebase deploy --only functions:sendScheduledReminders`.
- **NO new index is expected.** If (and only if) a real deploy throws `FAILED_PRECONDITION` on the
  `status`-in collection-group scan, add the single-field `services.status` `COLLECTION_GROUP` `fieldOverride`
  (research A3 documented contingency) and `firebase deploy --only firestore:indexes`.
- **NO new secret** — the cron enqueues only; the send still flows through `sendQueuedMessage` (its
  `RESEND_API_KEY` + sending-domain setup are the still-open 59-01/59-03 pre-deploy gates above).
- At `/gsd-verify-work 61`: confirm a **real reminder email** arrives N days before a service, reckoned in the
  **org-local timezone** (`verification_deferred_human` — no automated test can send a real email or drive
  Cloud Scheduler).

Do **not** treat this item as passed — it is a pre-deploy gate, not a satisfied one.

---

## ⏳ 61-03 — dispatch of due USER-SCHEDULED messages ships UNDEPLOYED inside the SAME cron (R141 schedule-for-later carryover) — OWNER, PRE-DEPLOY

Plan 61-03 completed R141's deferred **dispatch half** (Phase 59 shipped only the compose-and-store
half). The composer writes a `status:'scheduled'` messages doc that `sendQueuedMessage` (an
`onDocumentCreated` trigger) leaves inert. Plan 61-03 added the exported
`dispatchDueScheduledMessagesHandler` to `functions/src/index.ts` and wired it into the EXISTING
`sendScheduledReminders` onSchedule wrapper (61-02), AFTER the reminder sweep, in its own try/catch
(so a failure in either sweep never aborts the other).

The sweep scans `collectionGroup('messages').where('status','==','scheduled')` (single-field equality —
**no composite index**), code-filters `scheduledFor <= now`, runs a Firestore transaction that claims
each original `scheduled→dispatched` **only if still `'scheduled'`** (the idempotency guard mirroring
`sendQueuedMessage`'s `queued→sending` claim), and then **CREATES A FRESH `status:'queued'` doc** via
the shared `createQueuedMessage()` shaper (`scheduledFor:null`, original type/subject/body/
recipientSelector/options/requestedByUid preserved). A fresh create is required because flipping the
existing doc's status would NOT re-fire the `onDocumentCreated` trigger — the whole trap this resolves.

**Built, unit-tested (147 functions/index tests incl. the idempotency + future-dated + per-item-throw
cases, 248 full functions suite), and UNDEPLOYED against a MOCKED provider.** Holds **NO secret** — it
only re-creates a `queued` doc; `RESEND_API_KEY` binds solely to `sendQueuedMessage`. **No new npm
package, no new Firestore index** (single-field scan; due-ness is a CODE filter), **no deploy, no
`.env.local` change** (v1.7 grant).

**Idempotency:** proven in the suite — a second run over an already-`'dispatched'` doc fails the claim
guard and creates NOTHING (no double-dispatch under onSchedule at-least-once retry).

**OWNER, before schedule-for-later goes live — do NOT mark passed here:**
- **No additional deploy command.** The dispatch sweep ships INSIDE the same `sendScheduledReminders`
  cron, so the single `firebase deploy --only functions:sendScheduledReminders` from the 61-02 gate
  above covers it — **no separate onSchedule Function and no new index to deploy.**
- **NO new secret, NO new index** (same rationale as 61-02; the send still flows through
  `sendQueuedMessage`, whose `RESEND_API_KEY` + sending-domain setup are the still-open 59-01/59-03
  pre-deploy gates).
- At `/gsd-verify-work 61`: schedule a message for a near-future time in the LIVE app and confirm a
  **real email actually sends** once the daily cron runs (`verification_deferred_human` — no automated
  test can send a real email or drive Cloud Scheduler).

Do **not** treat this item as passed — it is a pre-deploy gate, not a satisfied one.

## ⏳ 61-04 — first-lock auto-notification: banner render + real lock email — DEFERRED (owner at /gsd-verify-work 61)

Plan 61-04 shipped the **R144 client hook**: locking a DRAFT service for the FIRST time (behind the
Phase 58 messaging kill-switch + effective lock-notify default + ≥1 reachable recipient) writes
`services/{id}/lockSnapshots/current` and auto-enqueues one `type:'lock-notification'` via the 59-04
`queueServiceMessage` client wrapper, then shows a subordinate amber confirmation line inside the
existing lock banner. Every behavior below is proven by `ServiceEditorView.test.ts` (13 new specs:
first-lock-only, gated no-sends on messaging-off / default-off / re-lock / zero-reachable, the
non-blocking failed-enqueue path, and the banner line's states incl. pluralization + aria-live).

**What only a human at `/gsd-verify-work 61` can confirm (`verification_deferred_human`):**
- **The real lock email actually sends.** The client calls the **UNDEPLOYED** `queueServiceMessage`
  (fine for tests; a real send needs the still-open 59-01/59-03 pre-deploy gates — `RESEND_API_KEY` +
  sending domain). In the LIVE app: lock a draft service (messaging on, lock-notify default on, ≥1
  assigned volunteer with an email) and confirm the assigned volunteers receive the roles/song-list/
  service-link email, and that the row lands in the Phase 60 "Sent on this service" history panel.
- **The banner confirmation renders as designed.** Confirm the amber line reads "Notified N assigned
  volunteers." on a sent first lock; shows the muted zero-reachable line when everyone assigned lacks
  an email; and shows the muted "Locked — but the notification couldn't be sent. Open Messages…" line
  (never red) when the enqueue fails, with the link opening the composer.
- **SC2 by eyeball:** turn messaging OFF (or the default off), lock a draft, and confirm NO line
  appears and NO email is sent; re-lock an already-locked service and confirm no auto-send.

**Client-only plan — NO deploy, NO `.env.local`, NO functions change this plan.** Do **not** treat
this item as passed — the visual + real-email UAT is deferred to the owner, gated behind the same
undeployed send path as 59/60/61-02/61-03.

## ⏳ 62-04 — re-lock change-notice prompt: scoped diff + real send + "Lock quietly" — DEFERRED (owner at /gsd-verify-work 62)

Plan 62-04 wired the Phase 62 pieces into the shipped lock hook. `onMarkAsPlanned` now computes a REAL
`slideGroupsFingerprint` on every lock (the Phase 61 `slideGroupsFingerprint: null` stub is realized),
and on a **re-lock** (a prior `lockSnapshots/current` exists) it reads the prior snapshot + fingerprint
BEFORE writing, runs `diffServiceSnapshots`, and — for a non-empty diff with messaging on — opens
`ReLockNotifyPrompt` while **DEFERRING** the `lockSnapshots/current` overwrite to the modal's confirm.
An empty diff or messaging off overwrites silently with no prompt. Every behavior below is proven by
`ServiceEditorView.test.ts` (8 new re-lock specs + the updated first-lock fingerprint assertions):
prompt-opens/no-overwrite-while-open, `sent`→overwrite, `cancel`→overwrite, a **send-failure**→
no-overwrite (SC4 safe basis), empty-diff/messaging-off silent overwrite, and first-lock-never-opens.

**What only a human at `/gsd-verify-work 62` can confirm (`verification_deferred_human`):**
- **The scoped diff prompt renders + sends for real.** In the LIVE app (messaging on): lock a draft,
  reopen it, edit it (change a song / reorder / a role assignment / notes / slides), and re-lock —
  confirm `ReLockNotifyPrompt` opens listing exactly the typed changes with the right affected-team
  tags, and that **Send notice** actually emails the chosen recipients (Affected teams vs Everyone) via
  the **UNDEPLOYED** `queueServiceMessage`, landing a row in the Phase 60 "Sent on this service" history
  panel. Requires the still-open 59-01/59-03 pre-deploy gates (`RESEND_API_KEY` + sending domain).
- **SC4 overwrite timing by eyeball.** Confirm **Lock quietly** re-locks with NO email AND resets the
  diff basis (a subsequent immediate re-lock shows "no changes"); confirm a **failed send** leaves the
  prompt open and does NOT reset the basis (retry still diffs against the pre-edit state).
- **Empty-diff / messaging-off:** re-lock with no edits → no prompt; turn messaging OFF and re-lock an
  edited service → no prompt, silent re-lock.

**Client-only plan — NO deploy, NO `.env.local`, NO functions change this plan** (v1.7 grant). Do
**not** treat this item as passed — the visual + real-email + overwrite-timing UAT is deferred to the
owner, gated behind the same undeployed send path as 59/60/61/62-03. **This is the FINAL plan of
milestone v1.7; the phase is code-complete — the milestone lifecycle (audit/complete) is the owner's.**

## ⏳ 63-01 — Messages tab + always-visible delivery history — DEFERRED (owner at /gsd-verify-work 63)

Plan 63-01 added a dedicated **Messages** tab to the Service Editor (4th button, after Roles, gated
`authStore.isEditor && isMessagingEnabled()`) and MOVED the messaging-defaults panel + the "Sent on this
service" `ServiceMessageHistory` out of the Service Order tab into a `v-show="activeTab === 'messages'"`
panel. The R150 gate fix dropped `canEditService` from the history's `v-if` (now
`isMessagingEnabled() && authStore.isEditor`) so it renders on a LOCKED service. Every behavior is proven
by unit tests: tab presence/absence (editor+on / viewer / messaging-off), relocation asserted by CONTAINER
(defaults + history inside `messages-panel`, not `service-order-panel`), `buildActionBarItems('messages')`
returns `[]` with the ✉ composer key still on the Service Order bar, and the R150 locked-service regression
(history still renders; viewer / messaging-off still hidden). Scoped suite 373/373 green; type-check clean;
full app suite at the 2-file baseline.

**What only a human at `/gsd-verify-work 63` can confirm (`verification_deferred_human`):**
- **The Messages tab looks right.** In the LIVE app (messaging on, as an editor): open a service, click
  **Messages**, and confirm the tab reads Service Order · Slides · Roles · Messages, the messaging-defaults
  controls and the "Sent on this service" history render there, and both are GONE from the Service Order tab.
- **History visible when locked.** Lock the service (Mark as Planned / exported) and confirm the delivery
  history is STILL shown (read-only) on the Messages tab — the R150 point. Confirm a viewer (shared link)
  and a messaging-off org see no Messages tab and no history.

**Client-only plan — NO deploy, NO `.env.local`, NO functions change this plan** (v1.8 grant). Do **not**
treat this item as passed — the visual UAT (tab layout + locked-service history) is deferred to the owner.
**This is the FIRST plan of milestone v1.8.**

---

## ⏳ 64-03 — ✉ composer refinements visual/interaction UAT — DEFERRED (owner at /gsd-verify-work 64)

Plan 64-03 (the FINAL plan of v1.8) reworked `src/components/MessageComposer.vue` (+ its test) with five
owner-UAT refinements: R152 a visible standalone add-someone `<select>` (disabled `＋ Add someone…`
placeholder, disabled `No one left to add` when empty), R153 the sample-preview renders always and updates
live (Preview button + `showPreview` removed), R154 client dropped the `{{song_list}}` chip / added
`{{name}}` and the sample renders `{{name}}` as the recipient's own name, R155 a white in-button Send
spinner with Send + Cancel disabled in flight and the misrendering success toast removed, and R156 aligned
per-type seeds with Reminder defaulting to Everyone behind a new `recipientDirty` guard.

**Automated gates all green:** `MessageComposer.test.ts` (28 tests) passes, `npm run type-check`
(`vue-tsc --build`) is clean, and the full app suite sits at the 2-file known-failing baseline
(`storage.rules.test.ts`, `RosterView.test.ts`) with no new failing file.

**What only a human at `/gsd-verify-work 64` can confirm (`verification_deferred_human`):** open a service,
click **✉ Messages**, and in the LIVE app — add a person via the visible picker and watch **Reaches N**
bump; watch the always-on preview update live as you type the subject/body and as you switch message types;
click Send and see the in-button spinner with **no** "Save failed." toast on success.

**Client-only plan — NO deploy, NO `.env.local`, callable stays UNDEPLOYED (mocked in tests)** (v1.8 grant).
Do **not** treat this item as passed — the composer end-to-end visual UAT is deferred to the owner.
**This is the FINAL plan of milestone v1.8.**

---

## Phase 68 — Super-Admin Access Gate & Claim-Merge Fix (v1.9) — `verification_deferred_human`

**Code-complete + automatically verified 2026-08-20** (verifier re-ran every gate independently: `cd functions && npm test` 397/397; `cd functions && npm run build` clean; `npm run type-check` clean; rules ALLOW/DENY 6/6 against a **live Firestore emulator**; app suite at the documented 2-file baseline). Code review: no Critical findings; 3 Warnings fixed (W1 grant-boolean validation, W3 router auth-ready gate) / documented (W2 residual same-uid claim TOCTOU). **Nothing deployed** — auth + rules + bootstrap are owner hand-over per the v1.9 grant (see `functions/DEPLOY-SUPER-ADMIN.md`).

**What only a human at `/gsd-verify-work 68` can confirm — do NOT mark these passed:**

1. **R177 — real route/nav gate:** sign in as a super-admin → the "Owner Console" nav entry shows and `/owner-console` loads; sign in as an ordinary user → the nav entry is absent and a direct visit to `/owner-console` redirects to the app home. (No router-guard unit precedent in this repo — needs a real signed-in browser session, and needs the rules + functions DEPLOYED, or the local emulator.)
2. **R179 — real grant/revoke E2E:** from the Owner Console roster, grant another user super-admin by email and confirm they gain access on their next token refresh; revoke and confirm they lose it. (Needs the deployed `setSuperAdminClaim` callable + `syncSuperAdminClaim` trigger.)
3. **R176 — production first-super-admin bootstrap:** the real `node lib/bootstrapSuperAdmin.js --email <owner> --apply` run against production, after deploying rules + functions (the dry-run path is unit-tested; the real `--apply` is owner-run once). See `functions/DEPLOY-SUPER-ADMIN.md`.
4. **R179 — real revoke session-cutoff timing:** confirm the ≤1hr `revokeRefreshTokens` residual window behaves as documented (the unit test only mock-verifies the call is made; actual propagation timing is a live-Firebase behavior).

**Owner deploy hand-over (from `functions/DEPLOY-SUPER-ADMIN.md`):** `firebase deploy --only firestore:rules` · `firebase deploy --only functions:syncSuperAdminClaim,functions:setSuperAdminClaim` · then the bootstrap `--apply`.

**Owner infra check flagged for before Phase 71's live deletion toggles ship:** confirm Cloud Storage Object Versioning / bucket retention is enabled as a delete safety-net (this milestone's code can't verify it).

---

## Phase 69 — Firestore Runtime Config (v1.9) — `verification_deferred_human`

**Code-complete + automatically verified 2026-08-20** (verifier ran every gate: `cd functions && npm test` 419/419 after review fixes; `cd functions && npm run build` clean; `npm run type-check` clean; app baseline held; grep confirms only `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` remain `process.env`; `MESSAGE_FROM_ADDRESS` fully removed). R190 `cleanupOrphanBackgrounds` fail-safe block byte-identical (diff-confirmed). Code review: 0 Critical; the api-proxy/send fail-open Warning + Info fixed. Test-count delta (428→416→419) audited: no coverage lost (24 redundant coercion tests moved to `appConfig.test.ts`'s 29; 12 behavioral tests preserved 1:1; +3 fail-open tests added). **Nothing deployed** — functions ship built/tested/UNDEPLOYED (`functions/DEPLOY-RUNTIME-CONFIG.md`).

**What only a human at `/gsd-verify-work 69` can confirm — do NOT mark passed:**

1. **R181 — live no-redeploy change:** after the owner deploys the 7 managed functions + Phase 68 rules, write a value to `appConfig/global` (e.g. flip an AI rate limit or a retention window) and confirm a hot-path handler and a cron reflect it **without a redeploy**.
2. **R183 — real cross-instance TTL staleness:** confirm a hot-path change is picked up within ~60s (the TTL window) and a cron/emergency-disable takes effect on the very next scheduled run. (Unit-proven with fake timers; real warm-instance timing is a live behavior.)

**Owner deploy hand-over (`functions/DEPLOY-RUNTIME-CONFIG.md`):** deploy the Phase 68 `firestore.rules` (appConfig/superAdmins gate) first/together, then `firebase deploy --only functions:api,functions:cleanupExpiredMedia,functions:cleanupOrphanRenders,functions:cleanupOrphanBackgrounds,functions:cleanupPptxSources,functions:sendScheduledReminders,functions:sendQueuedMessage`. Behavior-neutral until a value is written to `appConfig/global` (defaults-merge). `RESEND_API_KEY` stays a server secret — never in the config doc.

**Carry-forward note for Phase 70 (from review Info-2):** the numeric config knobs have no UPPER bound in `appConfig.ts` coercion — the Phase 70 admin form should enforce sensible min/max on each field (defense-in-depth; the rules gate WHO writes, not WHAT magnitude).

---

## Phase 70 — Admin Console UI & No-Reply Sender (v1.9) — `verification_deferred_human`

**Code-complete + automatically verified 2026-08-20** (verifier ran gates: `npx vitest run` 3861/3875 after review fixes — only the 2 documented baseline files fail; `npm run type-check` clean; `DEFAULT_APP_CONFIG` client mirror byte-identical to functions, now guarded by a REAL cross-file import test that empirically fires on drift). Code review: 0 Critical; 3 Warnings + top UI finding fixed (bidirectional rate-limit cross-field, empty-number required, real drift-guard, allowedModels proactive Save-disable). **UI review: 21/24** (copywriting/visuals/typography/spacing clean). Client-only — nothing deployed.

**What only a human at `/gsd-verify-work 70` can confirm — do NOT mark passed:**

1. **Visual UI pass:** open `/owner-console` as a super-admin and eyeball the four config cards (Cleanup read-only, AI Proxy, Messaging, Sender) against the dark theme — effective values + `(default)` badges, provenance stamp, inline validation errors, the read-only cleanup note, and the amber "must be a Resend-verified domain" sender warning all render correctly and legibly on desktop + mobile.
2. **Live Firestore round-trip (R187):** as a real super-admin, edit a field (e.g. a retention window or an AI rate limit), Save, reload — the value persists in `appConfig/global` and shows as explicitly-set (badge cleared). Requires the emulator or deployed rules+functions.
3. **Real-cron pickup (R181 spot-check, the milestone's point):** after deploy, a saved `retention.mediaDays` is honored by the real `cleanupMedia` cron with no redeploy.
4. **Real-email (R191):** a saved `sender.fromAddress` on a genuinely Resend-verified domain delivers mail (needs a live Resend account + DNS).

**No deploy for this phase itself** (client-only UI) — but it is only USABLE once the Phase 68 rules + Phase 69 functions are deployed (owner hand-over: `functions/DEPLOY-SUPER-ADMIN.md` + `functions/DEPLOY-RUNTIME-CONFIG.md`).

---

## Phase 71 — Cleanup Deletion-Toggle Safety (v1.9, FINAL) — `verification_deferred_human`

**Code-complete + automatically verified 2026-08-20** (verifier ran gates + git-diff review: `cd functions && npm test` 429/429; `cd functions && npm run build` clean; `npm run type-check` clean; `npx vitest run` at the 2-file baseline. `previewCleanupDryRun` forces dry-run via a `forceDryRun===true ? true : !enabled` ternary — NOT `||` — with a load-bearing test proving it never deletes even when config is mocked ENABLED; dual super-admin re-check; per-type field mapping correct (backgrounds→`orphanCount`). **R190 byte-identical (git-diff confirmed)** — only the signature + one dryRun line changed in each handler; the 15-test backgrounds fail-safe block passes unedited). Code review: 1 Critical (dialog dismissal-during-write) + 1 Warning + polish all FIXED; UI review 21/24. **Nothing deployed, nothing enabled** — the `previewCleanupDryRun` callable is owner hand-over; enabling a cleanup in production is the owner's button.

**What only a human at `/gsd-verify-work 71` can confirm — do NOT mark passed:**

1. **Real dry-run preview:** after deploy, open the Owner Console → Cleanup card → click Enable on a cleanup and confirm the dry-run blast-radius count matches a genuine production backlog (unit tests mock Storage/Firestore).
2. **The production enable→delete cycle (the owner's button, the milestone's whole point):** Enable a cleanup via the confirm flow, then confirm the NEXT scheduled cron run actually deletes exactly the previewed objects — and NOTHING is deleted in-band on the flag flip itself.
3. **Visual + a11y pass of the confirm dialog:** the echoed count, "cannot be undone" + "on the next scheduled run" copy, the destructive-red-vs-indigo Confirm, and especially the **background hard-block** (`referencesComplete:false` → un-clickable Confirm + warning) render correctly; mobile reflow at ~375px (UI-review Fix #2, not live-verified).
4. **Song-background safety (owner's hard constraint) end-to-end:** confirm that with reference detection incomplete, background cleanup CANNOT be enabled, and that a real run never deletes a song-linked background — only transient slideshow backgrounds tied to a service.

**Owner deploy hand-over:** `firebase deploy --only functions:previewCleanupDryRun` (fold in with the Phase 69 runtime-config functions deploy). No `.env` writes.

---

## Phase 72 — Owner Console Tabs (v2.0, FIRST) — `verification_deferred_human`

**Code-complete + automatically verified 2026-08-21** (verifier ran gates directly: `npm run type-check` clean; `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` 13/13 (7 carried-forward tests unchanged + 6 new); full app suite `npx vitest run` 3900/3913 at the documented 2-file baseline (`storage.rules.test.ts`, `RosterView.test.ts`), no new regressions). `ConfigurationTab.vue` diff-confirmed byte-identical to the pre-refactor `OwnerConsoleView.vue` body (only wrapper-div removal + 3 cosmetic log-prefix corrections). Code review (`72-REVIEW.md`): 0 Critical, 1 Warning (WR-01 v-show single-subscribe invariant untested) + 1 Info (IN-01 stale log prefix) both fixed in follow-up commits `7e746fbb`/`95edbd15`, confirmed present on master. Router guard (`requiresSuperAdmin` on `/owner-console`) untouched — no new route, claim, rule, or callable introduced. See `72-VERIFICATION.md` for the full per-truth breakdown.

**What only a human at `/gsd-verify-work 72` can confirm — do NOT mark passed:**

1. **Real-browser deep-link + refresh (R195):** open `/owner-console?tab=organizations` in a real signed-in super-admin session — both a fresh navigation and a hard refresh — and confirm it lands on the Organizations pane, not a reset to Configuration. The automated test only proves this against a mocked `vue-router`.
2. **Tab-strip visual active-state styling:** confirm the Configuration/Organizations tab strip's indigo active-accent vs. muted-gray inactive styling renders correctly and matches `ServiceEditorView.vue`'s existing tab pattern — not assertable from jsdom class-string checks.

**No deploy involved** — this is a client-only layout refactor; nothing to hand over for deployment. `OrganizationsTab.vue` ships as an inert placeholder, ready for Phase 74's org-management UI build-out.

---

## Phase 73 — Multi-Org Storage Auth Claim (v2.0) — `verification_deferred_human`

**Code-complete + automatically verified 2026-08-21** (verifier ran every gate independently: `cd functions && npx vitest run` 452/452; `npm run type-check` (`vue-tsc --build`) clean; rules-emulator suite `npx vitest run --config vitest.rules.config.ts` 183/183 — including the 3 new genuine multi-org ALLOW / cross-org DENY / legacy-claim ALLOW emulator tests (R209/R211); full app suite `npx vitest run` at the documented 2-file baseline (`RosterView.test.ts` pre-existing stale assertion, `storage.rules.test.ts` needs the rules-specific vitest config to talk to the emulator — the authoritative run of that file is the 183/183 rules-suite run above), no new regressions. `git diff --stat` over the phase's full commit range confirms `firestore.rules` and `src/stores/auth.ts` were NOT touched.). Code review (`73-REVIEW.md`): 0 Critical, 2 Warnings + 1 Info fixed in follow-up commits `455935fa` (WR-01: primary-org claim delete collapsed to a single atomic `setCustomUserClaims` write, closing a TOCTOU window where a removed member's refreshed token could briefly retain Storage access via a stale `orgs` map), `788b1806` (WR-02: `auth/claims-too-large` failures now log a distinguishable, greppable line), `5decfda4` (IN-01: `orgsMapsEqual` deduplicated into one shared export) — all three confirmed present on master by reading the diffs directly. See `73-VERIFICATION.md` for the full per-truth breakdown (R207–R211, 5/5 verified).

**What only the owner at `/gsd-verify-work 73` can confirm — do NOT mark passed:**

1. **Real production deploy + real multi-org Storage access.** Run the owner-gated rollout in `functions/DEPLOY-ORG-CLAIMS.md`'s "Phase 73" section, IN ORDER: STEP 1 `firebase deploy --only functions:syncOrgMembershipClaim --project worship-planner-bc515`; STEP 2 `cd functions && npm run build && node lib/backfillOrgClaims.js` (dry-run — read the summary), then `node lib/backfillOrgClaims.js --apply`; STEP 3 `firebase deploy --only storage --project worship-planner-bc515`. After all three steps, confirm a real user belonging to two organizations can read/write Storage under BOTH org paths, and that no existing single-org user lost access at any point during the rollout (the legacy arm bridges STEP 1→STEP 3).

**Everything in this phase ships built, tested, and UNDEPLOYED** — no `firebase deploy` and no backfill `--apply` were run by this phase, per the v2.0 milestone deploy policy. This is the hard prerequisite Phase 74 (admin assignment into a second org) needs deployed before it can safely be exercised in production.

---

## Phase 74 — Organizations: List, Onboard & Admin Assignment (v2.0, FINAL) — `verification_deferred_human`

**Code-complete + automatically verified 2026-08-21** (verifier ran every gate independently: `cd functions && npx vitest run` 486/486 (14 files); `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` 18/18; `npm run type-check` (`vue-tsc --build`) clean; `cd functions && npm run build` (`tsc`) clean; full app suite `npx vitest run` 3975 passed, 16 failed across exactly the documented 2-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), no new regressions. `git log` over the phase's full commit range (`256c5795`..HEAD) confirms `firestore.rules`/`storage.rules`/`src/stores/auth.ts` were NOT touched — last touch was Phase 73's `f781af39`.). The seeded template (`orgTemplateSeed.ts`'s 9-entry `{kind,section}` sequence) and default settings were traced field-by-field against `src/utils/slotTypes.ts::buildSlots('1-2-2-3')` and `src/types/organization.ts::DEFAULT_ORG_SETTINGS` — byte-accurate match. Code review (`74-REVIEW.md`): 0 Critical, 3 Warnings + 2 Info, all 3 Warnings fixed in follow-up commits `99072c32` (WR-01: preserve an existing member's `joinedAt` on re-assignment instead of silently resetting it), `facf1b93` (WR-02: server-side email-format validation before using the email as a Firestore doc id), `50d25aca` (WR-03: guard onboard/assign Enter-key handlers against double-submit) — all three confirmed present on master with matching regression tests. See `74-VERIFICATION.md` for the full per-truth breakdown (R196–R206, 5/5 verified).

**What only the owner at `/gsd-verify-work 74` can confirm — do NOT mark passed:**

1. **Real production deploy + real onboarding/assignment.** Run `firebase deploy --only functions:onboardOrganization,functions:assignOrgAdmin,functions:listOrganizations --project worship-planner-bc515`, then in the live Owner Console Organizations tab onboard a real new church with a real admin email (confirm org+settings+template+first-admin land atomically in production Firestore with no manual cleanup step), and assign a real second admin to an existing org for a user who already belongs to another org (confirm that user retains full Storage access to BOTH orgs via Phase 73's widened claim, and neither org's existing memberships/roles are overwritten).
2. **Real-browser visual confirmation of the Organizations tab.** List table (Church/Org ID/Created/Members/Actions), onboard-a-church form, and the per-org inline "Assign admin" control — dark-palette match, spacing, focus rings, loading/empty/error states, per `74-UI-SPEC.md`.

**Everything in this phase ships built, tested, and UNDEPLOYED** — no `firebase deploy` was run by this phase, per the v2.0 milestone deploy policy. This is the final phase of v2.0 — once the owner runs the deploy + confirms both items above, the milestone is ready to close.

---

## Phase 75 — Pending-Invite Visibility (v2.1) — `verification_deferred_human`

**Code-complete + automatically verified 2026-08-22** (verifier ran the gates independently: `cd functions && npx vitest run src/orgProvisioning.test.ts` 30/30; `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` 23/23; `npm run type-check` (`vue-tsc --build`) clean; full app suite at the documented 2-file baseline, no new regressions). 3/3 code truths verified (R222/R223): `listOrganizations` now returns `pendingCount` from a second `invites` `count()` aggregate run concurrently with the `members` aggregate — active vs pending, both server-side, no new client cross-org read — and the Organizations tab Members cell renders an accessible "N pending" amber badge when `pendingCount > 0`. Code review (`75-REVIEW.md`): 0 Critical, 0 Warning, 2 Info (accepted — loose test substrings; the non-optional `pendingCount` shares `memberCount`'s pre-existing deploy-lockstep pattern).

**What only the owner at `/gsd-verify-work 75` can confirm — do NOT mark passed:**

1. **Owner-gated deploy + production confirmation.** Run `firebase deploy --only functions:listOrganizations --project worship-planner-bc515`, then in the live Owner Console Organizations tab confirm an onboarded-but-never-logged-in admin's church shows as "1 pending" (not a bare "0 members"), and that the active count and pending count read correctly for a real church.
2. **Real-browser visual of the pending badge** — contrast/spacing of the amber "N pending" pill against the live dark table.

**Ships built + tested + UNDEPLOYED** — the client badge half needs no deploy; the `listOrganizations` server change is the single owner-gated deploy above.

---

## Phase 76 — Church Deactivation & Reactivation (v2.1) — `verification_deferred_human`

**Code-complete + auto-verified + SECURED 2026-08-22** (verifier ran gates independently: `cd functions && npx vitest run` 520/520; rules-emulator `npx vitest run --config vitest.rules.config.ts` 201/201 incl. the deactivation ALLOW/DENY + CR-01 new-member-self-heal + T-76-10 editor-lifecycle-field-DENY regression tests; `npm run type-check` clean; full app suite at the documented 2-file baseline). 4/4 SC verified (R212–R214): a super-admin-gated `setOrgActive` callable persists `active`/`deactivatedAt`/`deactivatedBy`; `firestore.rules` `isOrgActive()` + a field-level lifecycle-write guard (ordinary editors can't forge status/audit fields) + `storage.rules` `isOrgDeactivatedForCaller()` (wrapping the whole `isOrgMemberByClaim` OR) + the trigger-computed `deactivatedOrgs` claim independently deny a deactivated org's members while a super-admin-member stays in; the client login-block shows a clear message (no blank app); reactivate fully restores. Security: `76-SECURITY.md` SECURED, 11/11 threats closed — code review caught CR-01 (a member joining an already-deactivated org kept Storage access), fixed by having `syncOrgMembershipClaim` recompute `deactivatedOrgs` on every member write + `assignOrgAdmin` refusing deactivated orgs; the security audit caught + closed T-76-10/T-76-06 (an ordinary editor could directly write org status/audit fields via `updateDoc`) with a field-level `firestore.rules` write guard + regression tests.

**What only the owner at `/gsd-verify-work 76` can confirm — do NOT mark passed:**

1. **Owner-gated deploy + production confirmation.** Run `firebase deploy --only firestore:rules,storage,functions:setOrgActive --project worship-planner-bc515`, then confirm: a super-admin deactivates a real church → that church's real member is blocked at login with the "deactivated" message AND denied Storage access (not just Firestore); a super-admin can still enter the deactivated church; reactivate restores the member's access with no manual fix-up; and an ordinary editor CANNOT deactivate via a direct client write (T-76-10).
2. **Real-browser visual** of the Deactivate/Reactivate control on the Organizations tab and the greyed-out/labeled deactivated entry in the church picker.

**Ships built + tested + UNDEPLOYED** — the owner-gated deploy above is the single hand-over for the server+rules half; the client half needs no deploy beyond normal hosting.

---

## Phase 77 — Church Deletion — Cascade Cleanup (v2.1) — `verification_deferred_human`

**Code-complete + auto-verified + SECURED 2026-08-23** (verifier ran gates independently: `cd functions && npm run build` exit 0; `cd functions && npx vitest run` 544/544; rules-emulator `npx vitest run --config vitest.rules.config.ts` 203/203 incl. both new `organizations/{orgId}` client-delete-DENY tests; `npm run type-check` clean; full app suite at the documented 2-file baseline). 5/5 SC verified (R215–R221): a super-admin-gated `deleteOrganization({orgId, confirmName})` callable — refuses an ACTIVE org (deactivate-first) and a name-mismatch — cascades the org doc + all subcollections (`recursiveDelete`), the 5 orgId-keyed top-level collections (shareTokens/serviceShareLinks/orgSlugs/quarterShares/serviceShares), `orgNames`, all `inviteLookup`, each member's `users/{uid}.orgIds` (arrayRemove, other orgs preserved), and all Storage under `orgs/{orgId}/`; read-before-delete ordering + ≤500-op chunked idempotent retry + a summary. `firestore.rules` denies ALL client deletes of `organizations/{orgId}` (`allow write`→`update` + unconditional `allow delete: if false`). Client type-to-confirm dialog (type the exact church name; irreversible). Security: `77-SECURITY.md` SECURED, 11/11 threats closed — code review caught a functions build-break (an unused local tripping `noUnusedLocals`, invisible to vitest + the root type-check) + timeout/confirmName-trim warnings, all fixed; the security audit independently confirmed no unauthorized-delete / wrong-org / cross-tenant-arrayRemove / orphan path and the residual WR-02 client-trim mirror was then closed.

**What only the owner at `/gsd-verify-work 77` can confirm — do NOT mark passed:**

1. **Owner-gated deploy + real cascade confirmation.** Run `firebase deploy --only functions:deleteOrganization,firestore:rules --project worship-planner-bc515`, then as a super-admin deactivate + delete a real TEST church by typing its name, and confirm in production Firestore + Storage that the org doc, all subcollections, `orgNames`, all `inviteLookup`, the members' `users.orgIds` entries, the 5 orgId-keyed collections, and every `orgs/{orgId}/` Storage object are gone — and NO other org was affected. Also confirm an ACTIVE org's delete is refused and a non-super-admin cannot delete.
2. **Real-browser visual** of the type-to-confirm dialog + the Delete control (enabled only for a deactivated org).

**Ships built + tested + UNDEPLOYED** — the owner-gated deploy above is the single hand-over; the client dialog/control needs no deploy beyond normal hosting.

---

## Phase 78 — Super-Admin Enter-Any-Church (v2.1, FINAL) — `verification_deferred_human`

**Code-complete + auto-verified + SECURED 2026-08-23** (verifier ran gates independently: `npm run type-check` clean; rules-emulator `npx vitest run --config vitest.rules.config.ts` 213/213 incl. the R225 super-admin ALLOW/DENY matrix + the super-admin lifecycle-write DENY + delete DENY + all pre-existing Phase 76/77 rules tests; targeted client suites 138/138; full app suite at the documented 2-file baseline). 4/4 SC verified (R224–R227): a per-row "Enter church" action switches a super-admin's active org context; a super-admin arm ORed in FRONT of `isOrgMember`/`isOrgEditor` (`firestore.rules`) and `isOrgMemberByClaim` (`storage.rules`) grants read/write to ANY org without a member doc; entering writes NOTHING to Firestore (no member doc → hidden from the church's team list/count — `TeamView` reads only `members`); a persistent "viewing as super-admin" banner (AppShell) with one-click exit. Composition safety (the crux): the org-doc lifecycle-field write guard was TIGHTENED (the `|| isSuperAdmin()` disjunct removed) so a super-admin can NOT client-write `active:false` and skip `setOrgActive`'s claim fan-out, and Phase 77's `allow delete: if false` stays absolute (super-admin client org-delete DENIED). Security: `78-SECURITY.md` SECURED, 7/7 threats closed (super-admin claim non-forgeable; T-78-03 member-doc-create is an accepted client-contract residual, documented inline). Code review's 3 warnings (stale-message router-strand, double-submit guard, navigate-only-on-success) all fixed.

**What only the owner at `/gsd-verify-work 78` can confirm — do NOT mark passed:**

1. **Owner-gated deploy + production confirmation.** Run `firebase deploy --only firestore:rules,storage --project worship-planner-bc515`, then as a super-admin click "Enter church" on an org you don't belong to and confirm you can view/edit that church's data + Storage; confirm you do NOT appear in that church's team list; confirm a non-super-admin non-member still cannot access it; confirm a super-admin still CANNOT client-write a lifecycle field (deactivate is `setOrgActive`-only) or delete an org via the client.
2. **Real-browser visual** of the Enter-church control + the "viewing as super-admin" banner + its exit to the owner console.

**Ships built + tested + UNDEPLOYED** — the owner-gated `firebase deploy --only firestore:rules,storage` is the single hand-over; the client half needs no deploy beyond normal hosting.
