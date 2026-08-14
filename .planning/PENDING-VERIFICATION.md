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

## C2 — Phase 40.1 prod exercises undone + 2 known-open rules findings

Tightened `firestore.rules` deployed 2026-08-10, but (archived 781–803):
- **Exercise the one real pending invite in production** — not done.
- **Create a genuinely new organization through a real signup** — not done; this is the failure mode most likely to silently block new-church onboarding. No new org verified since deploy.
- Recorded but **NOT fixed** (future-phase candidates): (1) `organizations/{orgId}` `allow write: if isOrgEditor` lets an editor rewrite `createdBy` (`firestore.rules:31`); (2) `inviteLookup/{email}` `allow create: if isSignedIn()` is a self-invite vector (`firestore.rules:173`).

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

## ⚠ DISCOVERED DEFECT (found during Phase 61 discuss, Phase 59 origin) — composer success toast misrenders

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
