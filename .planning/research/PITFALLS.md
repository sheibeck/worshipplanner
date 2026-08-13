# Pitfalls Research

**Domain:** Adding volunteer/transactional email + change-notifications to an existing, in-production
Firebase/Firestore app (WorshipPlanner v1.7)
**Researched:** 2026-08-13
**Confidence:** MEDIUM (web-sourced, cross-checked against 2+ independent sources per topic; Firebase/GCF
idempotency guidance corroborated by official Google Cloud Blog + Firebase docs; deliverability numbers
from a single benchmark source are flagged LOW and should not be treated as precise)

## Critical Pitfalls

### Pitfall 1: Sending without domain authentication (SPF/DKIM/DMARC) or from a free address

**What goes wrong:**
The app sends "Your service is locked" mail from a Gmail/Outlook address, or from a domain with no SPF/DKIM
records. Mail lands in spam, gets silently dropped, or (worse) succeeds in testing because the developer's
own inbox trusts the sender, then fails for real volunteers on Gmail/Outlook/Yahoo who enforce stricter
filtering. Google's bulk-sender rules (effective Feb 2024) require at minimum a DMARC record at `p=none` for
any domain sending meaningfully to Gmail recipients — a domain with none is disadvantaged for deliverability
even at low volume.

**Why it happens:**
SPF/DKIM/DMARC are DNS-level owner setup (the church's domain), not application code — easy to defer because
"the app doesn't need it to compile or deploy." Nobody notices until real volunteers report missing mail
weeks later, by which time it looks like an app bug, not a DNS gap.

**How to avoid:**
- Pick a provider (Postmark/Resend/SendGrid/Mailgun) and configure sending from a subdomain of the church's
  own domain (e.g. `notify.<church-domain>.org`), never a free consumer address — this is an owner action on
  their DNS, must be scoped explicitly as an early setup step, not assumed done.
- Have the owner add the provider's SPF `include:`, DKIM CNAME/TXT records, and a DMARC TXT record at
  `p=none` (report-only) to their domain DNS before first send; tighten to `p=quarantine` only after
  confirming legitimate mail passes.
- Use the provider's own sandbox/test-domain to validate the *code path* before the owner's DNS work lands,
  but do not ship the "it works" milestone claim off sandbox-domain sends — verify against the real domain.
- If the church has no controllable domain (e.g. only a Gmail Workspace group address), scope that
  constraint explicitly at Settings/provider-setup time rather than discovering it after building the send
  path.

**Warning signs:** Test sends succeed only to the developer's own inbox; the owner hasn't been asked for DNS
access; no DMARC/SPF/DKIM record exists on the sending domain; "From" address is `@gmail.com` or similar.

**Phase to address:** Provider selection & infrastructure setup phase (first phase of v1.7) — before any
send-path code is built, block on the owner completing domain DNS setup for the chosen provider.

---

### Pitfall 2: Non-idempotent sends on a Cloud Function that Firebase will retry

**What goes wrong:**
A Firestore-triggered or scheduled Cloud Function sends email as a side effect. GCF/Firebase background
functions are **at-least-once delivery** — a timeout, cold start, or transient failure causes Firebase to
retry the same event, and a naive send function fires the email again. A volunteer gets the same "you're
locked in for Sunday" notice 2–3 times; worse, a scheduled reminder scanner that doesn't mark its own work
done can re-send to everyone on its next tick if the write that marks "reminder sent" fails after the email
already went out.

**Why it happens:** Retry-safety is invisible in local/manual testing (one clean run, no retries triggered)
and only shows up under real production conditions — a slow provider API call near the function's timeout,
a cold start, a burst of concurrent triggers.

**How to avoid:**
- **Mark-before-send is unsafe on its own (a crash before the API call succeeds under-reports), but
  mark-after-send is unsafe against retries (a crash between the API call and the mark re-sends).** The
  standard pattern: write a `sent/{idempotencyKey}` record inside a Firestore **transaction** that first
  checks whether the record already exists — if it does, exit without calling the provider API at all; if
  not, create the record (e.g. status `pending`) in the same transaction, THEN call the send API, THEN
  update the record to `sent`/`failed`. The idempotency key should be deterministic from the event: for a
  lock notification, `{serviceId}_{lockedAt-timestamp-or-version}_locked`; for a scheduled reminder,
  `{serviceId}_{reminderDate}_reminder`; for a re-lock diff notice, `{serviceId}_{relockedAt}_relock`.
- For the scheduled share-link reminder specifically: query only services where a `reminderSentAt` (or
  equivalent) field is unset, and set it **transactionally alongside** the send record for that run, so a
  re-invocation (Cloud Scheduler retries, or two overlapping invocations) is a no-op for services already
  marked.
- Reuse the org's own event ID / Firestore document write as the idempotency key wherever the provider API
  supports one (Postmark, Resend, SendGrid, Mailgun all accept an idempotency/message-ID style header or
  param) so even a duplicate function invocation doesn't produce a duplicate provider-side send.
- Rate-limit the composer's own "send now" onCall function server-side (not just optimistic UI disable) so a
  double-click or a stuck retry from the client can't fire two provider calls for one recipient list.

**Warning signs:** No `sent/` or `messageLog` collection keyed by a deterministic idempotency key; the send
function's only guard against duplicates is a client-side disabled button; the scheduled reminder function
queries "not yet reminded" and updates that flag in a *separate* write after the send loop, not atomically
per-recipient-batch.

**Phase to address:** Send-path/infrastructure phase — the idempotency pattern must be baked into the very
first onCall/onSchedule function written, not retrofitted after the composer ships. Verification: manually
re-invoke the same function twice with the same input in staging and confirm exactly one email per recipient.

---

### Pitfall 3: Provider API key exposed to the client, or stored the deprecated way

**What goes wrong:**
The email provider's API key ends up in a `VITE_*` env var (bundled into the client JS, visible to anyone who
opens devtools), or is stored via the deprecated `functions.config()` (which Google has already shut off for
new projects and is being fully retired) instead of a proper secret.

**Why it happens:** This codebase's convention is `VITE_*` for **client**-consumed config (Firebase web
config, ESV/PC keys used client-side) — a developer moving fast on a new feature can pattern-match "add
another env var" without noticing this one must never leave the server. The existing `functions/src/index.ts`
already sets the right precedent (`CLAUDE_API_KEY`, `ESV_API_KEY`, `NLT_API_KEY` are all declared with
`defineSecret()` from `firebase-functions/params`, bound at deploy time via Secret Manager, never bundled) —
the risk is a new contributor not following it for the email provider key.

**How to avoid:**
- Declare the provider key with `defineSecret('EMAIL_PROVIDER_API_KEY')` in `functions/src/index.ts`,
  matching the existing `CLAUDE_API_KEY`/`ESV_API_KEY` pattern exactly. Never prefix it `VITE_`.
- The send path must be a callable/HTTPS Cloud Function (`onCall`), never a client-side call to the
  provider's API — the composer's "Send" button calls the Function, the Function holds the secret.
  (PROJECT.md already confirms this direction: "Send path is an owner-gated Cloud Function.")
  same deploy-owner-gate as existing functions; the key itself lives only in the owner's
  `.env.local`/Secret Manager, per the project's standing no-`.env.local`-writes-by-agent rule.
- Grep the diff before any commit for the literal key pattern (`re_...` for Resend, `SG.` for SendGrid, etc.)
  and for `VITE_EMAIL` / `VITE_RESEND` / `VITE_POSTMARK` style names — treat any hit as a blocking defect.

**Warning signs:** Any new `VITE_*` env var containing "email"/"resend"/"sendgrid"/"postmark"/"mailgun"; the
provider SDK imported anywhere under `src/` (client) rather than only under `functions/src/`; a
`functions.config()` call anywhere in a new file.

**Phase to address:** Send-path/infrastructure phase — same phase as Pitfall 2, since both concern the shape
of the send Cloud Function. Verification: `npm run build` output contains no provider key substring; the
provider SDK/`fetch` call to the provider's API exists only in `functions/`.

---

### Pitfall 4: Open bounce-webhook endpoint accepting forged callbacks

**What goes wrong:**
The chosen provider posts hard-bounce events to an HTTPS endpoint (an `onRequest` Cloud Function, matching
the existing `api` pattern in `functions/src/index.ts`). Without verifying the request is genuinely from the
provider, anyone who discovers the URL can POST a fake "bounced" payload for any address, which the app then
surfaces as a delivery failure — at minimum a nuisance, at worst usable to make the app hide/flag a real
volunteer's address as bad indefinitely, or to probe which addresses are in the system.

**Why it happens:** Webhook endpoints are easy to stand up (`onRequest` is a public URL by default) and easy
to forget to lock down, especially since the payload *looks* like ordinary JSON with no auth header required
by naive testing (curl a fake payload, see it work "great, it's live").

**How to avoid:**
- Verify every inbound webhook request's signature before processing: most providers (Resend, Mailgun,
  SendGrid) sign with HMAC-SHA256 (SendGrid uses ECDSA) over the raw request body using a signing secret
  distinct from the API key — store that secret via `defineSecret()` too, and use a constant-time comparison
  (`crypto.timingSafeEqual`) to check it. Reject with 401 before touching Firestore if verification fails.
  (Postmark is an exception — it offers only Basic Auth / custom header, not cryptographic signing; if
  Postmark is the chosen provider, gate the endpoint on that shared secret instead, treating the URL itself
  as sensitive.)
- Read the **raw** body for signature verification — Express/Functions body-parsing middleware that
  JSON-parses before your handler sees it can break signature verification if the provider signs the exact
  raw bytes; confirm the provider's verification recipe before wiring `express.json()` globally on that
  route (the existing `api` onRequest function already runs its own Express app — mount the webhook route
  with `express.raw()` for that path specifically, ahead of the JSON body parser).
- Scope the webhook to only *update the bounce status of an existing message log entry it can prove it owns*
  (e.g. keyed by the provider's message ID, which was stored on send) — never let the webhook payload create
  new documents, alter recipient lists, or write anything outside a `bounces`/`deliveryStatus` field.
- Rate-limit / log unexpected/malformed webhook POSTs distinctly from real events, so a probing attacker is
  visible in Cloud Functions logs.

**Warning signs:** The webhook handler trusts `req.body` without any header/signature check; the signing
secret isn't in Secret Manager; the handler can write to fields other than delivery/bounce status; no logging
of rejected requests.

**Phase to address:** Delivery-history & bounce-tracking phase — must be built with signature verification
from the first commit, not added after a demo. Verification: send a manually-crafted unsigned POST to the
deployed webhook URL in staging and confirm a 401, no Firestore write.

---

### Pitfall 5: Firestore rules letting the wrong people trigger sends or read recipient lists

**What goes wrong:**
The composer's "send" action and the delivery-history log are new attack surface on top of the existing
editor/viewer RBAC. Two concrete failure modes: (a) a **viewer** (read-only role) can call the send Cloud
Function or read the `messages`/`deliveryLog` subcollection that lists volunteers' emails, exceeding their
intended read-only access; (b) the send Cloud Function itself trusts a `recipients` array passed from the
client instead of re-deriving it server-side from the service's actual assigned roles, letting any caller
(with a forged/tampered request) email arbitrary addresses.

**Why it happens:** The existing RBAC (editor/viewer, org-scoped custom claims per the v1.5 decision) governs
Firestore document read/write, but a new `onCall` function is a *separate* trust boundary that must
explicitly re-check the caller's role and org membership — it does not automatically inherit Firestore rules.
It's easy to build the callable function's authorization check as "is this user authenticated" rather than
"is this user an editor in this org," especially when copy-pasting from an existing `onCall` (e.g.
`parsePptx`) whose authorization needs may differ.

**How to avoid:**
- The send `onCall` function must verify the caller's custom claim shows `editor` role for the service's org
  before doing anything — same claim check pattern already established for org membership (v1.5, custom auth
  claims). Reject non-editors with `HttpsError('permission-denied', ...)`.
- The function must **re-derive the recipient list server-side** from the service's live assigned roles at
  send time (never trust a client-supplied recipient array beyond it being a *subset filter* of the
  server-derived set) — this also closes the door on a stale-client sending to people removed from the
  service since the composer was opened (see Pitfall 6).
- Firestore rules for any new `messages`/`deliveryLog`/`bounces` collection: reads scoped to org
  editors/viewers of that service only (mirroring existing service-document read rules), writes restricted to
  the Cloud Function's admin SDK context only (never a direct client write) — add rules tests analogous to
  the existing `src/rules.test.ts` allow/deny pairs.
- Do not let the kill-switch live only in the UI — the send `onCall` function must itself check the org's
  Settings kill-switch server-side before sending, so a stale client (kill-switch flipped after page load)
  can't bypass it.

**Warning signs:** The send function's only check is `request.auth != null`; a `recipients` array is taken
verbatim from `request.data` and passed straight to the provider; no new rules tests added for the
delivery-log collection; the kill-switch check exists only in Vue component logic.

**Phase to address:** Send-path/infrastructure phase for the auth + recipient re-derivation; a dedicated
Firestore-rules-and-tests pass (mirroring the existing rules-test discipline) before the composer ships to
production. Verification: rules tests with an allow case (editor) and explicit deny cases (viewer, wrong-org
editor, unauthenticated).

---

### Pitfall 6: Recipient correctness — stale, unassigned, deduped, and kill-switch-aware sending

**What goes wrong:** Several distinct correctness bugs cluster under "who actually gets this email":
- Emailing a **role with no assigned person** (composer or auto-notify computes a role slot with `email:
  undefined` and either crashes or silently skips without surfacing that the role was unreachable).
- Sending to a **stale roster email** — a volunteer's email changed in the roster after they were assigned to
  the service, and the service's own denormalized snapshot (this app snapshots data at plan time, per its
  "denormalize song snapshots into service slots" architecture) still holds the old address, so the "who's
  actually reachable" logic must resolve against live roster state, not a frozen assignment snapshot — or,
  if it intentionally uses the snapshot for stability, that tradeoff needs to be a conscious decision, not an
  accident.
- A person **removed from the service after locking** but before a re-lock notification fires still gets the
  re-lock diff email meant for currently-assigned people, because the send list was computed from an earlier
  snapshot rather than the service's current roster.
- A person on **two teams for the same service** (e.g. Vocals AND Hosts) gets deduped to one email, not two,
  when "send to Worship + Hosts" is selected — the recipient set must be built by email address, not by
  (role, team) pair.
- The **draft-skip rule** for the scheduled reminder ("skipped while still a draft") and the **Settings
  kill-switch** must be checked at every send surface — lock notification, re-lock notice, one-off composer,
  scheduled reminder — not just the scheduled job. A common miss: the kill-switch is checked in the
  scheduled-reminder Cloud Function but not in the lock-notification code path invoked from a different
  onWrite trigger or onCall.

**Why it happens:** Recipients are computed in at least four different code paths (composer, lock-notify,
re-lock-notify, scheduled reminder), each written at a different time by different logic — without one shared
"resolve recipients for this service" function, each path re-implements (and re-breaks) the same rules
slightly differently.

**How to avoid:**
- Build **one** shared server-side function, e.g. `resolveRecipients(serviceId, { teams?, individuals?,
  excludeDrafts? })`, used by all four send surfaces (composer, lock, re-lock, scheduled reminder) — it
  reads the service's *current* assigned roles, joins against the roster for current email addresses,
  drops roles with no assigned person or no email, dedupes by lowercased email address across multiple
  team memberships, and returns both the final recipient list and an explicit "unreachable roles" list
  the caller can surface in the UI (composer's "Reaches N people" count and delivery history).
- That same shared function checks the org's kill-switch and (for the scheduled path) the service's
  draft status, so no send surface can accidentally bypass either — this belongs in the resolver, not
  duplicated at each call site.
- For "N people removed since lock," decide and document explicitly whether re-lock notifications target
  "everyone currently assigned" (live) or "everyone assigned at lock time" (snapshot) — the PROJECT.md spec
  says "affected teams" for the diff, implying live/current assignment is correct; make sure a person removed
  between lock and re-lock is excluded, and a person newly added is included only if the diff logic intends
  that.
- Surface unreachable roles ("Sound Tech — unassigned, not notified") in the composer's live count so
  planners see gaps instead of silently missing coverage.

**Warning signs:** Recipient-building logic duplicated (copy-pasted) across composer/lock/re-lock/reminder
files instead of one shared resolver; the "Reaches N people" count doesn't match the actual send count in
delivery history; dedup keyed on person+team pair rather than email address; kill-switch check present in
only one of the four send paths.

**Phase to address:** A dedicated "recipient resolution" unit built early (either its own small phase or the
first task of the composer phase) that every later phase (lock-notify, re-lock-notify, scheduled reminder)
consumes rather than reimplements. Verification: unit tests for the resolver covering unassigned role,
stale/changed email, dual-team dedup, draft-skip, and kill-switch-off, run once and reused by every send
surface's own tests.

---

### Pitfall 7: Re-lock diff missing or over-reporting changes; snapshot drift

**What goes wrong:** The re-lock feature needs to diff "what the service looked like at last lock" against
"what it looks like now" to produce the typed SONG/ORDER/ROLE/NOTES/SLIDES diff entries and compute "affected
teams." Two failure directions: (a) the diff **misses** real changes because it compares against a stale or
wrong baseline snapshot (e.g. it diffs against the *live* document's own prior in-memory state rather than a
persisted snapshot taken exactly at lock time, so a browser refresh between lock and edit loses the baseline
and the diff falls back to "nothing changed"); (b) the diff **over-reports**, flagging fields that changed for
reasons unrelated to real content (e.g. `updatedAt` timestamp bumps, denormalized snapshot rewrites,
non-user-visible internal field churn) as if they were meaningful edits, causing "affected teams" to include
teams that saw no actual change and alarm-fatiguing volunteers.

**Why it happens:** This is not a hypothetical risk for this codebase — it is the *same shape of bug* already
diagnosed and fixed once this milestone cycle: the v1.5 decision log records that "the share token was
re-minted per share and the snapshot frozen at share time" was "one root cause behind both 'the link changed'
and 'my role overrides aren't showing.'" The `services.ts` store already carries an explicit persisted-snapshot
discipline (`mintShareToken`/snapshot builder, single shared builder function per the code comments) precisely
because ad hoc, per-caller snapshot logic drifted before. A change-diff feature is a second instance of the
identical "compare live state against a captured-earlier state" problem, and it's easy to underestimate as
"just compute a diff" without the persisted-snapshot discipline that fixed the share-link bug.

**How to avoid:**
- Persist an explicit **lock-time snapshot** document (or field) at the moment of lock, containing exactly the
  fields the diff will compare — not "whatever's in the live doc when we happen to read it." Use the same
  single-shared-snapshot-builder pattern already established for share tokens, so lock-time capture and
  re-lock-time comparison read from one function, not two independently-maintained code paths.
  reconstructs it differently in composer versus reminder path.
- Diff **only** the fields that map to the typed categories (SONG/ORDER/ROLE/NOTES/SLIDES) — explicitly
  exclude `updatedAt`, internal snapshot-refresh fields, and any field not user-visible, so a re-render that
  touches unrelated metadata doesn't manufacture a false diff entry.
- Compute "affected teams" from the diff entries' own team tags (each diff entry already carries which
  team(s) it affects, per PROJECT.md's spec), not from a separate re-derivation — one source of truth for
  "what changed" drives both the displayed diff and the affected-teams recipient filter, closing the same gap
  Pitfall 6 warns about for the resolver.
- After a re-lock notification sends, refresh the lock-time snapshot to the new state (so the *next* re-lock
  diffs against this one, not the original) — forgetting this makes every subsequent re-lock diff since the
  first one balloon to include all cumulative changes, not just the newest ones.

**Warning signs:** No explicit lock-time snapshot field/document — the diff is computed by fetching "current"
twice at different times; diff entries include timestamp or internal-only fields; "affected teams" is
recomputed from current assignments rather than from the diff entries themselves; a second re-lock's diff
includes changes already notified about in the first re-lock.

**Phase to address:** Re-lock change-diff phase, built directly on the existing snapshot-builder pattern in
`services.ts` rather than a new ad hoc comparison. Verification: lock a service, make an ORDER change,
re-lock, confirm the diff shows exactly that one change; make a second, different change and re-lock again,
confirm the second diff shows only the second change (not the first repeated).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-----------------|
| Skip signature verification on the bounce webhook "for now" | Faster to demo delivery-history UI | Open endpoint accepting forged bounce data indefinitely; hard to retrofit once the URL is public | Never — verify from the first deployed version |
| Compute recipients inline per send-surface instead of one shared resolver | Faster first feature (composer) ships sooner | Each of lock/re-lock/reminder re-implements dedup/kill-switch/draft-skip slightly differently, and bugs diverge | Only for the very first spike/prototype, never merged to the phase that ships to real volunteers |
| Use `console.log`-only bounce handling instead of a `bounces` collection | Simpler webhook code | No delivery-history UI possible without a schema; retrofitting means backfilling or losing early bounce data | Never for this milestone — bounce tracking is explicit in-scope |
| Reuse the composer's client-computed recipient count as the actual send list | Simpler code, one calculation | A stale client (someone edited roles in another tab) sends to the wrong set | Never — server must re-derive at send time regardless of UI convenience |
| Defer DMARC to `p=reject` immediately instead of starting at `p=none` | "More secure" sounding from day one | Legitimate mail can be silently rejected before you've confirmed SPF/DKIM alignment is correct, with no visibility into why | Never for first rollout — always start at `p=none`, monitor, then tighten |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|----------------|-------------------|
| Email provider (any of Postmark/Resend/SendGrid/Mailgun) | Calling the provider API directly from the Vue client with the key exposed | Provider SDK/API call lives only inside a `defineSecret`-backed Cloud Function (`onCall`), matching the existing `CLAUDE_API_KEY`/`ESV_API_KEY` pattern |
| Bounce webhook | Trusting `req.body` without HMAC/signature verification | Verify signature over the raw body with the provider's signing secret (also a `defineSecret`), reject unverified requests with 401 before any Firestore write |
| Firestore triggers / Cloud Scheduler | Assuming exactly-once delivery for send-triggering events | Design every send path (trigger or scheduled) as idempotent via a transactional `sent/{key}` check, since Firebase functions are at-least-once |
| Firestore rules for new collections (`messages`, `deliveryLog`, `bounces`) | Copy-pasting an existing rule without adding new allow/deny test pairs | Add explicit rules tests (editor-allow, viewer-deny, wrong-org-deny, unauthenticated-deny) before shipping, mirroring `src/rules.test.ts` discipline |
| Settings kill-switch | Checking the kill-switch only in the Vue composer component | Check it server-side inside every send Cloud Function (via the shared recipient resolver), so a stale client can't bypass a switch flipped after page load |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Sending recipients one-at-a-time via sequential provider API calls inside a single Cloud Function invocation | Function timeout on services with many assigned roles; partial-send state (some got the email, some didn't, function crashed mid-loop) | Batch-send via the provider's bulk/batch send API where available, and make each recipient's send its own idempotent unit (not "all-or-nothing" for the whole invocation) so a partial failure is recoverable, not a stuck half-sent state | Once a service has enough assigned roles that sequential per-recipient API round-trips approach the function's timeout — modest scale for a church (a few dozen roles), but worth designing for from the start since retrofitting batching after a partial-send incident is harder |
| Re-fetching the full roster and full service document inside the recipient resolver on every one of four send surfaces | Slower composer "Reaches N people" live count, more Firestore reads billed per send | Resolver reads should be scoped (only assigned roles' person IDs, not the whole roster) and the composer's live count can debounce/cache against the already-loaded service store data rather than a fresh resolver call on every token/keystroke | Not a hard threshold for this app's scale, but worth avoiding from the start since the composer's live count updates on every recipient-selection change |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Send `onCall` function trusts a client-supplied recipient list | Any caller can attempt to email addresses outside the service's actual assignments, or bypass per-role targeting | Server re-derives recipients from live assigned roles; client selection is only a filter over that server-truth set |
| Bounce webhook has no signature check | Forged bounce events can mislabel real addresses as undeliverable, hiding future real notifications from a volunteer, or leak which addresses exist in the system via response timing/behavior | HMAC/signature verification before processing, as in Pitfall 4 |
| Provider API key or webhook signing secret stored as `VITE_*` or in `functions.config()` | Client-bundle key exposure (attacker can send arbitrary email as the church) or reliance on a config store Google is retiring | `defineSecret()` in Secret Manager, server-only, per Pitfall 3 |
| New `messages`/`deliveryLog` Firestore collection readable by any authenticated org member without role check | Viewers can read other volunteers' email addresses via the delivery log, beyond their intended read-only scope | Rules scope reads to the existing editor/viewer org-membership check already used elsewhere, with explicit tests |
| Kill-switch enforced only in UI | A user with a stale page load (switch flipped after their session started) can still trigger sends via a direct function call | Server-side kill-switch check inside the send function itself, not just conditional UI rendering |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| No visible "sending as..." / kill-switch state feedback in the composer | Planner doesn't realize messaging is globally off and wonders why "send" appears to do nothing, or why recipients show 0 | Composer surfaces the kill-switch state explicitly (disabled with an explanatory banner) rather than silently no-op-ing |
| Auto lock-notification and scheduled reminder fire without the planner previewing content first time | A first send with a typo/wrong token substitution reaches real volunteers before anyone reviewed it | Default new automatic-send settings to off (or require an explicit first-time confirm) until the planner has seen at least one composer preview of the token-substituted text |
| Re-lock diff surfaces every changed field including trivial ones (a note punctuation fix) as a checkable, seemingly-equal-weight item next to a real song change | Alert fatigue — planners routinely uncheck everything and volunteers who needed the real update miss it because it looked identical to noise | Group/typé diff entries as scoped in PROJECT.md (SONG/ORDER/ROLE/NOTES/SLIDES) with clear per-type labeling, and consider defaulting notes-only whitespace changes to unchecked |
| No unsubscribe/opt-out path even though messaging is "mostly" transactional | A volunteer who wants fewer reminder emails has no self-service way to reduce them, and CAN-SPAM's transactional exemption doesn't cover a message that reads as promotional/optional | Design a lightweight per-person notification preference (e.g. "opt out of scheduled reminders" only, not lock notices tied to their actual assignment) even if full unsubscribe infrastructure is deferred |
| Scheduled reminder computed in server (UTC) time without accounting for the church's local timezone | "7 days before" reminder arrives at 2am or a day off from what the planner expects, especially around DST | Compute the reminder send window against the org's configured timezone (or a sane fixed local-time default), not naive UTC date math |

## "Looks Done But Isn't" Checklist

- [ ] **Idempotent sends:** Often missing the transactional `sent/{key}` check-before-send — verify by
  manually re-invoking the send function with identical input twice in staging and confirming exactly one
  provider API call and one delivery-history entry.
- [ ] **Domain authentication:** Often missing DMARC entirely (SPF/DKIM alone still lands mail in spam for
  many providers) — verify with a DMARC record checker against the sending domain, not just "the email
  arrived in my test inbox."
- [ ] **Bounce webhook security:** Often missing signature verification because an unsigned POST "works" in
  manual testing — verify by sending a hand-crafted unsigned request to the deployed endpoint and confirming
  it's rejected.
- [ ] **Recipient correctness:** Often missing the "unassigned role has no email" and "dedup across two
  teams" cases because they don't show up with a small test roster — verify with a service that has at least
  one unassigned role and one person on two teams before considering the composer done.
- [ ] **Kill-switch coverage:** Often checked in only the UI or only the scheduled function — verify by
  flipping the kill-switch off and attempting a send via each of the four surfaces (composer, lock, re-lock,
  scheduled reminder) directly against the backend, not just the disabled button in the UI.
- [ ] **Re-lock diff accuracy:** Often correct on the first re-lock but wrong on the second (diffing against
  a stale un-refreshed baseline) — verify with two sequential re-locks with different changes each, confirming
  each diff shows only its own changes.
- [ ] **Draft-skip for the scheduled reminder:** Often works when tested against a locked service but not
  verified against a genuinely-still-draft one — verify the scheduled function explicitly skips (and ideally
  logs why) for draft services rather than relying on "there won't be a link to send yet."

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Duplicate sends from a non-idempotent function already in production | MEDIUM | Add the idempotency key + transactional check retroactively; audit `deliveryLog` for pre-fix duplicates so the history UI can be manually deduped/annotated; apologize-and-explain is usually the real-world mitigation for already-sent duplicates |
| Missing domain auth causing spam-folder landing after go-live | LOW–MEDIUM | Add SPF/DKIM/DMARC records (owner DNS change, no app redeploy needed), then send a fresh test batch and check inbox placement; some providers offer a "warm-up" period recommendation for new sending domains |
| Forged bounce webhook payloads already accepted before signature verification was added | MEDIUM | Add verification going forward; manually review/clear any bounce flags set from before the fix by cross-referencing provider's own dashboard/logs for genuine bounce events |
| Re-lock diff under/over-reporting already shipped | LOW | Because diffs are computed fresh from persisted snapshots at diff-time, fixing the snapshot/comparison logic self-corrects for all *future* re-locks without needing a data migration — only already-sent notifications are unrecoverable |
| Recipient resolver missing dedup/kill-switch check already shipped | LOW–MEDIUM | Centralize into the shared resolver (Pitfall 6's fix) and have every send surface call it; no data migration needed, just consolidating duplicated logic |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Deliverability/domain auth (Pitfall 1) | Provider selection & infrastructure setup (first v1.7 phase) | DMARC/SPF/DKIM records present on sending domain; test send lands in inbox (not spam) at a real Gmail/Outlook test address |
| Duplicate/runaway sends (Pitfall 2) | Send-path/infrastructure phase | Re-invoke send function twice with identical input in staging; exactly one send, one delivery-history entry |
| Secrets in the wrong place (Pitfall 3) | Send-path/infrastructure phase | No provider key substring in client bundle; provider SDK usage confined to `functions/` |
| Open/forged bounce webhook (Pitfall 4) | Delivery-history & bounce-tracking phase | Unsigned POST to deployed webhook endpoint rejected with 401 |
| RBAC on send/recipient-read (Pitfall 5) | Send-path/infrastructure phase + dedicated rules-tests pass | Rules tests: editor-allow, viewer-deny, wrong-org-deny, unauthenticated-deny on new collections |
| Recipient correctness/dedup/kill-switch (Pitfall 6) | Shared recipient-resolver built early, consumed by composer/lock/re-lock/reminder phases | Unit tests: unassigned role, stale email, dual-team dedup, draft-skip, kill-switch-off — reused across all four send surfaces' tests |
| Re-lock diff/snapshot drift (Pitfall 7) | Re-lock change-diff phase | Two sequential re-locks with distinct changes each; each diff reflects only its own change, none repeated |
| CAN-SPAM/UX pitfalls (unsubscribe, timezone, surprise mail) | Composer & Settings kill-switch phase | Manual review: automatic sends default off until previewed once; reminder timezone matches church local time, not naive UTC |

## Sources

- [Mailgun: Implementing SPF, DKIM, and DMARC](https://www.mailgun.com/blog/dev-life/how-to-setup-email-authentication/) — MEDIUM confidence (cross-checked against multiple independent sources)
- [Google Cloud Blog: Cloud Functions pro tips — Building idempotent functions](https://cloud.google.com/blog/products/serverless/cloud-functions-pro-tips-building-idempotent-functions) — MEDIUM confidence, official Google Cloud source
- [Google Cloud Blog: Cloud Functions pro tips — Retries and idempotency in action](https://cloud.google.com/blog/products/serverless/cloud-functions-pro-tips-retries-and-idempotency-in-action) — MEDIUM confidence, official Google Cloud source
- [Firebase Docs: Retry asynchronous functions](https://firebase.google.com/docs/functions/retries) — MEDIUM confidence, official Firebase documentation
- [GoogleCloudPlatform/cloud-functions-reliability-nodejs (idempotency reference implementation)](https://github.com/GoogleCloudPlatform/cloud-functions-reliability-nodejs/blob/master/idempotency/README.md) — MEDIUM confidence, official Google reference repo
- [Webhook Signature Verification: Complete Security Guide](https://inventivehq.com/blog/webhook-signature-verification-guide) — MEDIUM confidence (cross-checked against multiple sources including HMAC-specific guides)
- [SocketLabs: CAN-SPAM & Transactional Emails](https://www.socketlabs.com/blog/transactional-email-can-spam/) — MEDIUM confidence, cross-checked against MailerSend/Element451/Salesforce guidance
- [Mailtrap: 6 Best Transactional Email Services Compared](https://mailtrap.io/blog/transactional-email-services/) — LOW confidence, single-vendor benchmark; treat specific inbox-placement percentages as directional, not precise
- Internal codebase precedent: `functions/src/index.ts` (`defineSecret` pattern for `CLAUDE_API_KEY`/`ESV_API_KEY`/`NLT_API_KEY`; `onSchedule` pattern for `cleanupExpiredMedia`/`cleanupOrphanRenders`), `src/stores/services.ts` (shared share-token/snapshot-builder discipline, R036/R037 status-transition guards), `.planning/PROJECT.md` Key Decisions (v1.5 "share token re-minted... snapshot frozen at share time" root-cause entry) — HIGH confidence, primary source (own codebase)

---
*Pitfalls research for: WorshipPlanner v1.7 Volunteer Messaging & Notifications*
*Researched: 2026-08-13*
