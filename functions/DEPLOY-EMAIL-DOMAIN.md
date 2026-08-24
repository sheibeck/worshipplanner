# Verified-domain email — owner runbook (R238)

> ★★ **NOTHING IN THIS REPOSITORY RUNS ANY COMMAND IN THIS FILE.** This entire runbook is
> **owner-run, external DNS/Resend-dashboard configuration** — it has no `firebase deploy`
> step, because there is nothing to deploy. Both live send paths already read the sender
> address from Firestore at runtime (`config.sender.fromAddress` via `getAppConfig()`) — see
> "Why no deploy is needed" below. Reaching a verified sending domain IS the whole point of
> this file; nothing here is code this phase built or needs to build.

This file lives next to `functions/src/appConfig.ts` and `functions/src/adminEmail.ts` — it
follows the same placement precedent as `functions/DEPLOY-SUPER-ADMIN.md`,
`functions/DEPLOY-ORG-CLAIMS.md`, and `functions/DEPLOY-RUNTIME-CONFIG.md` (all live directly
in `functions/`).

---

## What this closes

Volunteer emails (invites, reminders, lock notifications, share links, one-off messages) are
sent via the Resend API. Until a verified sending domain is configured, the sender falls back
to `onboarding@resend.dev` — Resend's own test address, which **only delivers to the Resend
account owner's own inbox**, not to real volunteers. This runbook is what unlocks sending to
arbitrary volunteer email addresses in production.

**This is real external ops work.** The owner must control DNS for a real domain, and DNS
propagation + Resend's own verification are entirely outside this app's control. Nothing here
can be automated or verified by app code — see "Why the app can't do this for you" below.

---

## Why no deploy is needed (Firestore-backed sender, not a build-time value)

Both live send paths already read the sender address **live from Firestore**, not from a
build-time environment value:

```
Owner Console → Configuration tab → Sender card ("From address")
        │  onSaveText → store.saveField('sender.fromAddress', v)
        ▼
Firestore appConfig/global.sender.fromAddress
        │
        ├─► sendQueuedMessageHandler (functions/src/index.ts)
        │     config = await getAppConfig(db)
        │     fromEmail = bareEmailAddress(config.sender.fromAddress)
        │     resend.emails.send({ from: fromAddress, ... })   ◄── NOT hard-coded
        │
        └─► sendAdminOnboardingEmail (functions/src/adminEmail.ts)
              config = await getAppConfig(db)
              fromEmail = bareEmailAddress(config.sender.fromAddress)
              resend.emails.send({ from: fromEmail, ... })     ◄── NOT hard-coded
```

`onboarding@resend.dev` appears in the codebase **only** as
`DEFAULT_APP_CONFIG.sender.fromAddress` (`functions/src/appConfig.ts`) — the correct fallback
used only when `appConfig/global` has no explicit `sender.fromAddress` set. Setting the "From
address" field in the Owner Console Sender card writes directly to Firestore and takes effect
on the **very next send** — no functions redeploy, no code change, no `.env.local` change.

Both send paths' From-construction logic is covered by existing, passing regression tests
(`functions/src/index.test.ts`, `functions/src/adminEmail.test.ts`) that assert the `from`
value is built from the injected `config.sender.fromAddress` — re-confirmed as part of this
phase (see `81-01-SUMMARY.md`).

**`SERVICE_SHARE_BASE_URL` is intentionally left alone.** Per the locked project decision, this
runbook changes ONLY the sender address — `SERVICE_SHARE_BASE_URL` (the base URL embedded in
share links) stays on the Firebase Hosting default (`https://worship-planner-bc515.web.app`).
It is independent of the sending domain and does not need to match it. Only touch it if the
owner separately decides share links should also originate from a custom domain — that is a
Functions `defineString` param and DOES require a redeploy, which is out of scope here.

---

## Step 1 — Choose a real domain you control DNS for

**`*.web.app` and `*.firebaseapp.com` (the Firebase Hosting defaults) CANNOT be verified** —
they are Google-managed DNS zones with no owner DNS access. The Owner Console Sender card
already warns about this (an "unverifiable host" warning appears if you try to use one).

You need a domain you genuinely control DNS records for — for example your church's own
domain, or a domain purchased specifically for this app. A **dedicated sending subdomain**
(e.g. `send.example-church.org`) is Resend's own recommendation: it isolates your sending
reputation from your root domain's other mail (website, other providers, etc.).

> Every domain/address below is a **placeholder**. Substitute your organization's real domain
> throughout — do not commit real domains or DNS values into this file or anywhere in the repo.

---

## Step 2 — Add the domain in Resend

1. Sign in to the [Resend Dashboard](https://resend.com/domains).
2. **Domains → Add Domain.**
3. Enter your chosen domain (the dedicated sending subdomain from Step 1, e.g.
   `send.example-church.org`).
4. Resend generates a unique set of DNS records for this domain — do not reuse records from a
   different domain or a tutorial; the values below are per-domain and per-account.

---

## Step 3 — Publish the DNS records at your DNS provider

Resend will show you exact values to paste. In general shape:

| Record | Type | Host | Value | Purpose |
|--------|------|------|-------|---------|
| SPF | TXT | the sending subdomain itself | Resend-generated value authorizing Resend's sending infrastructure | Lets receiving mail servers confirm Resend is allowed to send on your behalf |
| DKIM | TXT | `resend._domainkey.<subdomain>` | Resend-generated **literal value** (not a CNAME) | Cryptographically signs outgoing mail so receivers can verify it wasn't tampered with |
| MX | MX | the sending subdomain | Resend-issued mail exchanger | Lets Resend receive bounce/complaint feedback for that subdomain |
| DMARC | TXT | `_dmarc.<yourdomain>` | `v=DMARC1; p=none; rua=mailto:<owner-address>;` | Tells receivers what to do with mail that fails SPF/DKIM, and where to send aggregate reports |

**DMARC policy progression — start in monitoring mode.** Publish `p=none` first (monitor only,
no enforcement). Only progress to `p=quarantine` and then `p=reject` after you've confirmed —
via the `rua` aggregate reports, or simply by confirming real sends succeed for a few weeks —
that all of this app's legitimate mail passes. Flipping straight to `p=reject` before that
confirmation risks silently rejecting legitimate transactional mail (invites, reminders,
onboarding) with no visible in-app error, because DMARC enforcement happens at the *receiving*
mail server — the sending Cloud Function has no way to see it fail.

Add all four record types at your DNS provider's control panel (the same place you manage the
domain's other DNS records). Save.

---

## Step 4 — Wait for Resend to show every record as Verified

Back in the Resend Dashboard, click **Verify** on the domain.

- DNS propagation is typically minutes, but can take **up to 48 hours** depending on your DNS
  provider's TTL settings.
- Resend's dashboard shows **per-record** status (SPF / DKIM / MX each individually Pending or
  Verified) — so a partial failure is visible immediately, not an opaque all-or-nothing state.

**Do not proceed to Step 5 until ALL records show "Verified", not "Pending".** This is the
single most important sequencing rule in this runbook (see "Why sequencing matters" below).

---

## Step 5 — Set the verified "From address" in the Owner Console

Only after every DNS record above shows Verified in Resend:

1. Sign in to the app as a super-admin.
2. Open the **Owner Console → Configuration tab → Sender card**.
3. Set **"From address"** to an address on your now-verified domain (e.g.
   `noreply@send.example-church.org` or `worship@send.example-church.org`).
4. Save.

This is a **live Firestore write** to `appConfig/global.sender.fromAddress` — it takes effect
on the very next email send, with **no functions redeploy**. `SERVICE_SHARE_BASE_URL` is
untouched (see "Why no deploy is needed" above) — leave it on the Firebase default.

Optionally also set the **"From name"** field (`sender.fromName`) to a display name for the
sender (e.g. your church's name) — this is cosmetic and has no bearing on deliverability.

---

## Step 6 — Send a real test to a real external inbox

**Do not test with the Resend account owner's own email address** — that address already
receives mail from the unverified `onboarding@resend.dev` fallback, so a successful test send
to it proves nothing new.

Send a real message (for example, a one-off message from a service's Messages tab, or trigger
an admin onboarding email) to a **genuinely external** inbox — a volunteer's real email address,
or any inbox you don't own that belongs to the same organization.

Then check the message's delivery-history rollup in the app (the "Sent on this service" panel,
or the Resend dashboard's own send log) for a `partial` or `failed` status. A `403 domain is
not verified` error from Resend is caught by the per-recipient try/catch in the send path and
degrades **silently** to a `partial`/`failed` message status — it will NOT surface as a visible
in-app error banner, so this manual check is the only way to catch a premature or incomplete
domain-verification cutover.

---

## Why sequencing matters (verify-before-flip)

If you set the Owner Console "From address" to an address on a domain that isn't fully verified
yet, the **first real send** after that change will fail at Resend with a `403 domain is not
verified` error — but because sends happen per-recipient inside a try/catch (so one bad
recipient never blocks the others), this degrades to a `partial` or `failed` message status
instead of a loud, visible failure. A volunteer might simply never receive their invite or
reminder, with nothing in the UI calling attention to it.

**The fix is sequencing, not code:** always confirm every DNS record shows Verified in Resend
(Step 4) *before* changing the live Owner Console sender address (Step 5), then always follow up
with a real external test send (Step 6) to catch anything the dashboard's "Verified" status
didn't fully capture.

---

## Why the app can't do this for you

- **DNS is external.** Nothing in Firebase, Cloud Functions, or this app's own infrastructure
  has access to your domain's DNS records — that access lives entirely with your DNS provider
  and requires your own credentials there.
- **Resend's verification is asynchronous and external.** The app has no webhook or polling
  integration against Resend's domain-verification API (deliberately out of scope for this
  phase — see `.planning/phases/81-polish-ops-close-out/81-CONTEXT.md`'s Deferred Ideas). The
  only way to know verification status is the Resend dashboard itself.
- **This runbook IS the fallback** for the app's structural inability to verify or perform any
  of the above — "done" for R238 is a correct, followed runbook plus the code wiring (already
  shipped), not an app-side guarantee that mail is deliverable.

---

## Rollback

If something goes wrong after Step 5 (e.g. the domain's verification silently regresses, or you
need to revert to the known-working fallback while troubleshooting DNS):

1. Open the Owner Console → Configuration tab → Sender card.
2. Clear the "From address" field (or set it back to `onboarding@resend.dev`) and Save.

This is the same live Firestore write pattern as Step 5 — it takes effect immediately, with no
redeploy. Note that `onboarding@resend.dev` only delivers to the Resend account owner's own
inbox, so this rollback restores the pre-verification status quo (a working-but-limited
fallback), not full production deliverability.

---

## Checklist

- [ ] Chose a real domain (or dedicated subdomain) the owner controls DNS for — NOT
      `*.web.app`/`*.firebaseapp.com`.
- [ ] Added the domain in the Resend dashboard.
- [ ] Published the generated SPF (TXT), DKIM (TXT at `resend._domainkey.<subdomain>`), MX, and
      DMARC (TXT at `_dmarc.<yourdomain>`, starting `p=none`) records at the DNS provider.
- [ ] Confirmed **ALL** records show Verified in the Resend dashboard (not Pending).
- [ ] Set the Owner Console Sender "From address" to the verified address. Left
      `SERVICE_SHARE_BASE_URL` on the Firebase default.
- [ ] Sent a real test message to a genuinely external inbox and confirmed no `partial`/`failed`
      status in the delivery history.
- [ ] (Optional, later) Progressed DMARC from `p=none` to `p=quarantine`/`p=reject` after
      confirming legitimate mail passes for a few weeks.
