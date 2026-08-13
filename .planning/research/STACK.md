# Stack Research: Email/Transactional-Mail Provider (v1.7 Volunteer Messaging & Notifications)

**Domain:** Transactional email sending from a Firebase Cloud Functions backend (low-volume church app, ~50–2,000 emails/month)
**Researched:** 2026-08-13
**Confidence:** MEDIUM-HIGH (pricing/feature claims cross-checked across 2+ independent web sources per provider; Firebase secret-injection pattern confirmed directly against this repo's existing code, not just docs)

## Answer to the owner's headline questions

**What email service do we use?** **Resend.**

**How much does it cost?** **$0 (Free plan) at this project's realistic volume.** Resend's free tier is 3,000 emails/month and 100/day, with one verified sending domain. A church of 20–60 volunteers sending one-off messages, lock notifications, re-lock diffs, and a weekly 7-day-out reminder will land in the low hundreds of emails/month — nowhere near 3,000. If usage ever exceeds that, the next tier (Pro) is **$20/month for 50,000 emails**, an order of magnitude of headroom past anything this app will generate. Budget for **$0/month**, with a plausible ceiling of $20/month only if the org list grows dramatically.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|------------------|
| Resend | API (no version pin) + `resend` npm SDK `^6.19.0` | Transactional email send + delivery/bounce webhooks | Best fit for this exact shape of app: generous free tier at this volume, first-class Node SDK, native `scheduledAt` for delayed sends, webhook-based bounce events (not a separate SNS/SQS stack like SES), and the fastest domain-auth setup of the group (DNS records generated for you, single "Verify" click) — all while being a from-scratch integration effort the size of the existing NLT/Claude proxy Functions already in `functions/src/index.ts`. |
| `firebase-functions/params` `defineSecret` | already `^7.2.5` in `functions/package.json` | Injects `RESEND_API_KEY` into the send Cloud Function at runtime, backed by Google Secret Manager | Already the established pattern in this repo — `CLAUDE_API_KEY`, `ESV_API_KEY`, and `NLT_API_KEY` are all wired this exact way in `functions/src/index.ts` (see `defineSecret(...)` calls, `secrets: [...]` on the function, and `.value()` at call time). `RESEND_API_KEY` is a fourth secret following the identical, already-proven pattern — no new plumbing to design. |
| `onSchedule` (`firebase-functions/v2/scheduler`) | already `^7.2.5` | Drives the "N days before service" reminder and any other cron-style send | Already used twice in this codebase (`cleanupExpiredMedia`, `cleanupOrphanRenders`), so the "scheduled share-link reminder" (default 7 days out) is not new infrastructure — it's a third `onSchedule` function that queries upcoming services and calls the same send path. Do **not** rely on Resend's own `scheduledAt` for this recurring, condition-checked reminder (it needs "skip if still Draft" logic evaluated at send time, which only a server-side scheduled function can do); reserve `scheduledAt` for the composer's one-off "schedule for later" option on a single already-composed message. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `resend` (npm) | `^6.19.0` (latest as of 2026-08-13; requires Node ≥20 — this repo's Functions run Node 22, compatible) | Official Node SDK: `resend.emails.send()`, `resend.emails.batch()`, `resend.webhooks.*` | The only library needed on the Functions side to send mail and to verify inbound webhook payloads. |
| `svix` (npm, transitively used by Resend's webhook verify helper) — or just call `resend.webhooks.verify()` directly | current via `resend` SDK | Verifies the `svix-id` / `svix-timestamp` / `svix-signature` headers on the inbound bounce-webhook HTTP Function so a forged POST can't fake a "delivered" or fabricate/hide a bounce | Required on the bounce-webhook receiving endpoint (an `onRequest` HTTPS Function). Use the raw request body — do not let Express/Firebase's JSON body-parser re-serialize it before verification, or the signature check breaks. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Resend dashboard (Domains tab) | Add + verify the sending domain, view generated SPF/DKIM/DMARC DNS records | One-time setup by the owner (who controls DNS for the church's domain). Records go under a `send.` subdomain, not the apex — a common failure mode is publishing them at the wrong host or leaving a conflicting MX (e.g. Google Workspace) on that subdomain. |
| Resend dashboard (Webhooks tab) | Register the production webhook URL (the Cloud Function's HTTPS trigger) and subscribe to `email.bounced` (+ optionally `email.delivered`, `email.sent`) | Copy the generated webhook signing secret into a second `defineSecret` (e.g. `RESEND_WEBHOOK_SECRET`). |
| `firebase functions:secrets:set RESEND_API_KEY` / `firebase functions:secrets:set RESEND_WEBHOOK_SECRET` | Populates Secret Manager the same way `CLAUDE_API_KEY` etc. are already set | Owner-run, consistent with the standing "deploys and secret writes are owner-gated" rule already governing this milestone. |

## Installation

```bash
# In functions/
npm install resend
```

No client-side (`src/`) package is needed or wanted — see "What NOT to Use" below.

## Provider Comparison (verified 2026-08-13)

| Provider | Free tier | Paid entry tier (small-church volume) | Hard-bounce webhook? | Domain auth (SPF/DKIM/DMARC) | Firebase/Node integration effort |
|---|---|---|---|---|---|
| **Resend** (recommended) | 3,000 emails/mo, 100/day, 1 domain | Pro: **$20/mo for 50,000 emails** | **Yes** — `email.bounced` webhook event (Svix-delivered, HMAC-verifiable), fires instead of `email.delivered` for the same message | Easiest of the group: dashboard generates the exact DNS records, single "Verify" button, guided troubleshooting for common misconfig | Lowest effort: one official `resend` npm package, `resend.emails.send()`, native `scheduledAt`, webhook verify helper built into the same SDK |
| Postmark | Permanent free dev tier, but capped at **100 emails/month total** (not per-domain) and does not allow overage — sending simply stops at 100 | Basic: **$15/mo for 10,000 emails**, $1.80/1K overage | **Yes** — dedicated bounce webhook, classifies `HardBounce` explicitly via a `Type` field, very mature/purpose-built for this | Strong — separates transactional vs. broadcast streams, good reputation defaults | Good — official `postmark` npm package exists, similar shape to Resend, but the 100/mo free cap means this app would likely need the $15/mo tier from day one given roster sizes × message types (composer + lock + re-lock + weekly reminder easily exceeds 100/mo for an active church) |
| SendGrid (Twilio) | Time-limited **60-day trial**, 100/day during trial; no indefinite free production tier as of 2026 | Essentials: **$19.95/mo for 100,000 emails** | Yes — Event Webhook with a `bounce` event type, further split into hard/soft via classification fields | Solid, well-documented, but historically the most complaint-prone reputation of this group (shared-IP spam history under the SendGrid brand) | Good SDK (`@sendgrid/mail`), but heavier/more enterprise-flavored API surface than needed here; no meaningfully-usable free production tier undercuts the "low volume, low cost" fit |
| Amazon SES | 3,000 msgs/mo for the **first 12 months only** (post-2023 tier cut; old 62,000/mo EC2 allowance is gone); after that, **$0.10 per 1,000 emails** — cheapest at scale | Effectively pay-as-you-go: at 2,000 emails/mo, roughly **$0.20/month** in raw send cost | Yes, but **not a simple webhook** — bounces arrive via an SNS topic subscription (HTTPS endpoint or SQS), meaningfully more infrastructure than a POST endpoint: create an SNS topic, subscribe an HTTPS/Lambda endpoint, wire it to the SES identity's notification settings | Cheapest in dollars but most manual: you manage verified identities, SPF/DKIM (Easy DKIM via Route 53 or manual CNAMEs) yourself in the AWS console — no single guided flow | Highest integration effort of the group: `@aws-sdk/client-sesv2` (or client-ses) plus SNS plumbing for bounce handling, IAM policy setup, and — notably — **new AWS accounts start in a "sandbox" that can only send to verified addresses until a manual production-access request is approved**, an extra approval step none of the other providers require |
| Mailgun | 3-month free trial only (Flex plan); **no indefinite free tier** as of late 2025 pricing changes | Foundation: **$35/mo** flat (better than Flex's now-doubled $2/1,000 pay-as-you-go rate once you're past ~17,500 emails/mo, but at 50–2,000 emails/mo Flex's $2/1K means **under $4/month** in raw cost after the trial — cheaper in dollars than Resend's $20 tier, but with no permanent free option) | Yes — mature webhook system, bounce/complaint/delivered events | Solid, established, EU/US region choice | Decent SDK (`mailgun.js`), but Mailgun's 2025 reputation/pricing churn (Flex doubled from $1→$2/1K, deliverability complaints in community reviews) makes it a worse long-term bet than Resend for a "set it and don't think about it again" church tool |
| Firebase Extension: **Trigger Email from Firestore** (`firestore-send-email`) | Free (the extension itself); cost is entirely whatever SMTP provider you point it at | N/A — pass-through | **No** — the extension only writes a document and relies on SMTP `send`; it has no built-in bounce/delivery event pipeline. Bounce handling would have to come from whatever provider's SMTP credentials you plug in, observed completely outside the extension | Depends entirely on the underlying SMTP provider (commonly SendGrid, Mailgun, or Mailchimp Transactional creds) | Lowest code-effort to get a first email out (write a Firestore doc, extension does the rest) but this is a trap for this milestone: it needs an SMTP-capable provider behind it anyway (so you still pick and pay for one of the rows above), and it gives up the structured send API, native scheduling, and native webhook events that the recommended direct-SDK approach gets for free. **Not recommended** — it re-adds a middle layer without removing the underlying provider decision, and the delivery-history/bounce-tracking requirement (R "Sent on this service" log) needs the provider's own API/webhook, which this extension doesn't expose. |

### Why Resend over the close alternatives

- **vs. Postmark:** Postmark's free tier (100 emails/month, no overage) is very likely to run out immediately given four message types (one-off, lock, re-lock, weekly reminder) across a volunteer roster — meaning Postmark effectively starts this project at $15/mo, while Resend's 3,000/mo free tier realistically covers this app's entire lifetime volume at zero cost.
- **vs. SendGrid:** No durable free production tier (60-day trial only) and a materially worse sender-reputation history under the shared SendGrid brand; heavier API for no benefit at this scale.
- **vs. SES:** Cheapest per-email in isolation, but the bounce pipeline requires standing up SNS + a subscription endpoint (more moving parts than a signed webhook POST), plus a sandbox-approval step for new accounts before it can send to arbitrary recipients — friction this milestone doesn't need to accept to save a few dollars a month that are already $0 with Resend.
- **vs. Mailgun:** No indefinite free tier post-2025 changes, and 2025's Flex price doubling plus community deliverability complaints make it the least "set and forget" choice, which matters for a volunteer team with no dedicated ops person.
- **vs. the Firebase Trigger Email extension:** Doesn't remove the provider decision (still needs SMTP creds from one of the above), and gives up native bounce webhooks and scheduling — both explicit v1.7 requirements — for a marginal reduction in the Cloud Function code this app already knows how to write (it has three `defineSecret`-backed integrations already).

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Building/running your own SMTP server | Deliverability (SPF/DKIM/DMARC reputation, IP warm-up, feedback loops) takes months to earn and one misconfiguration tanks it; nothing here justifies owning that infrastructure | A managed transactional provider (Resend) |
| Sending email from the client (`src/`) with the provider's API key embedded in the SPA | The API key would be exposed in the shipped JS bundle — anyone could read it from devtools and send arbitrary mail as the org's verified domain | Send only from a Cloud Function holding the key via `defineSecret`, exactly like the existing Claude/ESV/NLT integrations |
| `firebase functions:config` for the provider API key | Deprecated; Google will **decommission it in March 2027** and deployments using it will start failing before then | `defineSecret()` from `firebase-functions/params`, set via `firebase functions:secrets:set RESEND_API_KEY` — already this repo's established pattern |
| Open-tracking pixels / click-tracking | Explicitly out of scope for v1.7 (Key Decision: "tracks sent + hard bounces, not opens") — also raises privacy questions for volunteer emails and adds webhook/complexity for no v1.7 requirement | Track only `email.sent` and `email.bounced` webhook events for the delivery-history log |
| The Firebase "Trigger Email from Firestore" extension as the whole solution | It's a thin SMTP wrapper, not a send API — no native bounce webhooks, no native scheduling, and it still needs a provider's SMTP credentials behind it, so it doesn't actually avoid the provider-selection decision this research exists to make | Call the Resend SDK directly from a purpose-built Cloud Function |
| Amazon SES for this specific app, despite lowest raw per-email cost | The SNS-based bounce pipeline and sandbox production-access approval step are meaningfully more infrastructure than this milestone's scope justifies, for a savings of pennies/month that Resend's free tier already erases to $0 | Resend |
| Resend's `onboarding@resend.dev` sending address in production | It can only send to the account owner's own signed-up address — unusable for a volunteer roster of many distinct recipients | Verify the church's real domain (or a `send.` subdomain of it) in Resend before going live |

## Cloud Function Secret Injection Pattern (current, non-deprecated)

This repo already has the exact pattern to follow — confirmed directly in `functions/src/index.ts`:

```typescript
import { defineSecret } from "firebase-functions/params";

// Set once by the owner (deploy-gated, per standing project rule):
//   firebase functions:secrets:set RESEND_API_KEY
//   firebase functions:secrets:set RESEND_WEBHOOK_SECRET
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const RESEND_WEBHOOK_SECRET = defineSecret("RESEND_WEBHOOK_SECRET");

export const sendVolunteerEmail = onCall(
  { secrets: [RESEND_API_KEY] },
  async (request) => {
    const resend = new Resend(RESEND_API_KEY.value());
    await resend.emails.send({ /* ... */ });
  }
);

export const resendWebhook = onRequest(
  { secrets: [RESEND_WEBHOOK_SECRET] },
  async (req, res) => {
    // verify svix-id / svix-timestamp / svix-signature against RESEND_WEBHOOK_SECRET.value()
    // using the RAW body, then update the per-service delivery-history doc on `email.bounced`
  }
);
```

This mirrors `CLAUDE_API_KEY` / `ESV_API_KEY` / `NLT_API_KEY` already in the codebase — no new secret-management pattern to introduce. `firebase functions:config()` must **not** be used for this (deprecated, decommissioned March 2027).

## Stack Patterns by Variant

**If the org's volunteer count/messaging cadence ever pushes past ~3,000 emails/month:**
- Upgrade to Resend Pro ($20/mo for 50,000 emails) — no code change required, only a billing-tier change on the same account/API key.

**If the owner ever wants marketing-style broadcast sends (not this milestone's scope):**
- Resend has a separate contacts/broadcast product billed by contact count — do not conflate it with the transactional send path used here; v1.7 is transactional only.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|------------------|-------|
| `resend@^6.19.0` | Node ≥20 (this repo's Functions run Node 22 per `functions/package.json` `engines.node: "22"`) | No conflict. |
| `resend@^6.19.0` | `firebase-functions@^7.2.5`, `firebase-admin@^13.10.0` (already in `functions/package.json`) | No known incompatibility; Resend's SDK has no Firebase-specific dependency, it's a generic REST wrapper. |

## Sources

- WebSearch, cross-checked 2+ sources each, 2026-08-13 (MEDIUM confidence per this project's `classify-confidence --provider websearch --verified` tier):
  - Resend pricing: automationatlas.io/tools/resend, tiergauge.com/tools/resend, nuntly.com/resend-pricing
  - SendGrid pricing: sendx.io/blog/sendgrid-pricing, costbench.com/software/email-api/sendgrid
  - Postmark pricing: saaspricepulse.com/tools/postmark, sendx.io/blog/postmark-pricing
  - Amazon SES pricing: aws.amazon.com/ses/pricing (official), saaspricepulse.com/blog/amazon-ses-pricing-per-1000-emails-2026
  - Mailgun pricing: gmass.co/blog/mailgun-review, saaspricepulse.com/tools/mailgun
  - Resend bounce webhooks: resend.com/docs/webhooks/introduction, resend.com/blog/webhooks (official)
  - Postmark bounce webhook: postmarkapp.com/developer/webhooks/bounce-webhook (official)
  - SendGrid event webhook: twilio.com/docs/sendgrid/for-developers/tracking-events/event (official)
  - SES bounce/SNS setup: docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications-sns.html (official)
  - Firebase Trigger Email extension: firebase.google.com/docs/extensions/official/firestore-send-email (official)
  - `resend` npm version: verified directly via `npm registry` (`registry.npmjs.org/resend/latest` → `6.19.0`, `engines.node: ">=20"`) — HIGH confidence, primary source
  - `functions.config()` deprecation date (March 2027): firebase.google.com/docs/functions/config-env (official), corroborated by github.com/firebase/firebase-tools issue discussion
  - `defineSecret` pattern: firebase.google.com/docs/functions/config-env (official), and directly verified against this repo's own `functions/src/index.ts` (PRIMARY, HIGH confidence — not just docs, the working pattern already in production)
  - Resend webhook signature verification (Svix): resend.com/docs/dashboard/webhooks/verify-webhooks-requests (official)
  - Resend `resend.dev` domain restriction: resend.com/docs/knowledge-base/403-error-resend-dev-domain (official)

---
*Stack research for: Volunteer email messaging provider, v1.7*
*Researched: 2026-08-13*
