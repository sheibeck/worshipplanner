# 112-03 Findings: Share-Token/Public-Page Exposure + PII Handling + Cost/Abuse Controls

**Plan:** 112-03 (dimension A: share-token/public-page exposure; dimension B: PII handling;
dimension C: cost/abuse controls)
**Reviewed:** 2026-09-02
**Reviewer:** executor agent, self-conducted (no sub-agent spawning available)
**Scope:** `src/router/index.ts` (public route registration), `src/views/ShareView.vue`,
`src/views/QuarterShareView.vue`, `src/stores/services.ts` (`buildServiceSnapshot`,
`ensureShareLink`/`maybeRefreshShareLink`/`writeSharePayload`, `deleteService` revocation),
`src/stores/quarters.ts` (`finalizeAndShare`, `deleteQuarter` revocation), `src/utils/shareTokens.ts`,
`firestore.rules` (`shareTokens`/`serviceShareLinks`/`quarterShares`/`serviceShares`/`orgSlugs`/
`orgNames`/`lockSnapshots`/`messages`+`recipients`), `functions/src/index.ts` (the `api` proxy —
`PROXY_TARGETS`/`SECRET_INJECTED`/`verifyAppCaller`/`resolveOrgId`/`readAiProxyLimits`/
`enforceModelAndTokens`/`checkOrgAiEnablement`/`checkOrgBibleEnablement`/`checkAndConsumeRateLimit`/
`checkAndConsumeOrgEmailQuota`/`setGlobalOptions`; the messaging fan-out —
`sendScheduledRemindersHandler`/`runScheduledMessagingCron`/`dispatchDueScheduledMessagesHandler`/
`queueServiceMessageHandler`/`sendQueuedMessageHandler`), `functions/src/renderInvoker.ts`,
`render-service/DEPLOY.md`, `docs/adr/0164-*.md` (memorable-URL rationale), and one piece of live
Firestore-emulator probe evidence plus two pieces of live, read-only `gcloud run` evidence (see below).
Review-only — no code, rules, or config files were modified; nothing was deployed.

Out of scope for this file (see plan boundary): Firestore/Storage rules text and multi-tenant
isolation depth are plan 112-01's scope (`112-FINDINGS-rules-isolation.md`); auth/custom-claims,
route guards, and Cloud-Functions authorization are plan 112-02's scope
(`112-FINDINGS-auth-functions.md`). Where this file's review surfaces a rules-level or
authorization-level observation outside its own two dimensions, it is cross-referenced with a
pointer, not independently re-scored, to avoid duplicate/conflicting severities across the three
files.

---

## Live evidence gathered this session

### 1. Firestore-emulator probe (read-only, scratch test file — never added to the tracked suite)

The Firestore emulator confirmed running on `127.0.0.1:8080` this session (same emulator 112-01's
live-evidence section used). To answer the plan's explicit review question — "whether the public
shareTokens/serviceShareLinks/quarterShares read scope exposes more than the token holder should
see" — a scratch probe test was written to the session scratchpad (a temp directory entirely outside
this repository, never under `src/`, never committed) and run against the SAME `firestore.rules` text
already in the tree, via `npx vitest run --root C:/projects/worshipplanner --dir <scratchpad>`. This
is read-only evidence-gathering, identical in spirit to `src/rules.test.ts`'s existing `getDoc`
assertions, except it exercises a **collection-level query** (`getDocs(collection(db, 'shareTokens'))`)
rather than a single-document `getDoc` — a distinction Firestore Security Rules treats specially (see
SEC-S-01 below) that no existing test in `src/rules.test.ts` exercises for any of these three
collections.

**Verbatim result:**
```
✓ shareTokens-listable.probe.test.ts (3 tests) 812ms
  ✓ unauthenticated collection-level query against shareTokens returns ALL docs across ALL orgs
  ✓ unauthenticated collection-level query against quarterShares returns ALL docs across ALL orgs
  ✓ unauthenticated collection-level query against serviceShares returns ALL docs across ALL orgs

Test Files  1 passed (1)
     Tests  3 passed (3)
```
All three `assertSucceeds(getDocs(collection(db, <name>)))` calls succeeded, and each returned every
seeded doc across two different `orgId`s. See **SEC-S-01** below for the full analysis.

### 2. `gcloud run` live, read-only checks (against the real `worship-planner-bc515` prod project)

Run to answer the plan's explicit review question about whether "render caps R173" are actually in
force, mirroring 112-02's `firebase functions:list` precedent (a read-only listing command, no
write/deploy action):
```
$ gcloud run services describe pptx-render --region=us-central1 \
    --format="value(spec.template.spec.containerConcurrency,spec.template.metadata.annotations['autoscaling.knative.dev/maxScale'])"
1   3

$ gcloud run services get-iam-policy pptx-render --region=us-central1 --format=json
{
  "bindings": [
    { "members": ["serviceAccount:worship-planner-bc515@appspot.gserviceaccount.com"], "role": "roles/run.invoker" }
  ],
  "etag": "BwZZedFWPjg=", "version": 1
}
```
Interpretation: the live Cloud Run service's `containerConcurrency` is `1` and
`autoscaling.knative.dev/maxScale` is `3` — an EXACT match to `render-service/DEPLOY.md`'s staged
`--concurrency=1 --max-instances=3` (R173) flags, confirming those ceilings are not merely documented
intent but are live in production today. The IAM policy grants `roles/run.invoker` to exactly one
service account (the Cloud Functions default runtime identity) with **no** `allUsers` or
`allAuthenticatedUsers` binding — confirming `--no-allow-unauthenticated` is also live, i.e. the
render service cannot be invoked by any caller except the Cloud Functions runtime itself. See
**SEC-C-04** below.

**Source/rules modification check:**
```
git status --porcelain -- src functions firestore.rules storage.rules
```
Empty — confirmed no source, functions, or `*.rules` files were modified during this review, no
deploy occurred, and the scratch probe test file was written entirely outside this repository (never
staged, never committed).

---

## Critical/High

### SEC-S-01 — [Critical] `shareTokens`, `quarterShares`, and `serviceShares` are publicly LISTABLE, not merely gettable — full cross-tenant enumeration of every org's shared service plans and volunteer names requires no token, no slug, and no guessing

**Location:** `firestore.rules:340-341` (`match /shareTokens/{token} { allow read: if true; ... }`),
`firestore.rules:387-388` (`match /quarterShares/{shareId} { allow read: if true; ... }`),
`firestore.rules:404-405` (`match /serviceShares/{shareId} { allow read: if true; ... }`). Live-proven
against the current rules text via the emulator probe above.

**Observed behavior:** Firestore Security Rules' `read` permission is a shorthand for **both** `get`
(single-document reads, by known id) **and** `list` (collection/query reads, which can return every
document in the collection) — the two can be split into `allow get` / `allow list` separately, but
these three collections use the unsplit `allow read: if true`, which grants **list** with the exact
same unconditional `if true` as get. The client code this app ships (`ShareView.vue:207-215`,
`QuarterShareView.vue:253-261`) only ever calls `getDoc(doc(db, '<collection>', <exact-id>))` — but a
caller is not bound to the app's shipped code. Any unauthenticated party who obtains this project's
public Firebase Web SDK config (itself not a secret — it is meant to be public; the security boundary
is supposed to be the rules) can run `getDocs(collection(db, 'shareTokens'))` (or `quarterShares` /
`serviceShares`) directly and receive **every** document in that collection, from **every**
organization that has ever shared a service or quarter, in one unauthenticated request — proven live
above (3/3 probe assertions succeeded, cross-org). `src/rules.test.ts`'s existing coverage for these
three collections (lines 974-1422, confirmed by direct inspection this session) tests only `getDoc`-
shaped reads and writes; **no existing test in this repository exercises a collection-level query
against any of the three**, so this gap was previously untested, not merely unfixed.

**Impact:** This is a cross-tenant data leak in the CONTEXT rubric's own Critical definition, and it
is trivially exploitable — no token guessing, no slug knowledge, no special tooling beyond the
Firebase JS SDK and this project's already-public config, which is required for the app itself to
function and cannot be treated as secret. What leaks, per org, per document: the full
`ServiceSnapshot` (`src/stores/services.ts:76-99`) — service date, name, all slot content (songs,
scripture references, sermon passage, prayer/announcement labels, free-text notes), and the
`roleAssignments` "Who's Serving" volunteer **names** for every role on that service (or, for
`quarterShares`, every serving volunteer's name across an entire quarter's calendar via
`quarters.ts::finalizeAndShare`'s equivalent snapshot) — plus, when present, the stage-layout
projection (element labels, assigned volunteer names). The entire "opaque 144-bit token" security
model (`mintShareToken()`, `src/utils/shareTokens.ts:23-27`) that `shareTokens` was designed around is
rendered moot: an attacker does not need the token at all, because listing the collection returns
every token doc (including its `orgId` and `serviceId` fields) directly. This is a full, unauthenticated,
cross-tenant enumeration of every church using this product's shared-service and shared-schedule
features, exposing real volunteers' names across organizations that never intended their data to be
grouped or browsed together.

**Related, lower-sensitivity instance of the same mechanism (not independently scored here, cross-
referencing 112-01's `SEC-ISO-06`):** `orgSlugs/{slug}` (`firestore.rules:369`) and
`orgNames/{nameKey}` (`firestore.rules:381`) use the identical unsplit `allow read: if true` pattern
and are therefore ALSO fully listable — meaning the complete registry of every org's public slug and
display name is enumerable in one query. 112-01 flagged these two collections' public-read grant as
`SEC-ISO-06` ("Low, informational — deferred to 112-03") without knowing they were also listable, not
just gettable; this file sharpens that understanding for the Plan 04 consolidator, but does not
re-score `SEC-ISO-06` — the exposed content there (a slug/name pair, arguably intended to be public
since these ARE the public-facing memorable-URL identifiers) carries materially lower sensitivity than
`SEC-S-01`'s PII-bearing service/quarter snapshots, so it does not itself warrant Critical.

**Required ALLOW-case emulator test for a Phase 113 fix:** the fix shape is splitting each of the
three collections' `allow read: if true` into `allow get: if true; allow list: if false;` (the
narrowest change that closes enumeration while preserving the exact `getDoc`-by-known-id flow every
shipped client already uses). The regression proof Phase 113 must add is an **ALLOW-case** proving the
legitimate share-link flow survives: `assertSucceeds(getDoc(doc(db, 'shareTokens', '<seeded-token>')))`
for an unauthenticated caller (mirrors the existing test at `src/rules.test.ts:1242-1246`, which must
keep passing unchanged) for all three collections, alongside the new **DENY-case** proving
`assertFails(getDocs(collection(db, 'shareTokens')))` (and the `quarterShares`/`serviceShares`
equivalents) for an unauthenticated caller — the exact query shape this session's probe proved
currently succeeds. The scratch probe file used to gather this session's evidence lived outside the
repository and was not left behind; Phase 113 will need to author its own tracked version of these
three DENY-case tests (plus the three unaffected ALLOW-case gets) inside `src/rules.test.ts`.

---

## Medium/Low

### SEC-S-02 — [Medium] Memorable-URL shares (`serviceShares`/`quarterShares`) use deterministic, guessable document ids by design — an org's shared history is discoverable from its public slug plus a plausible date, without ever receiving a share link

**Location:** `src/stores/services.ts:761` (`serviceShares/${slug}__service-${service.date}`),
`src/stores/quarters.ts:416` (`quarterShares/${slug}__q${quarter.quarter}-${quarter.year}`);
`firestore.rules:369` (`orgSlugs/{slug}` — publicly readable, so an org's slug is itself discoverable);
`docs/adr/0164-r-02-d-18-memorable-url-secondary-write-mirroring.md` (the "memorable URL" rationale —
mirrors `quarters.ts::finalizeAndShare` deliberately, no security-lens discussion of the guessability
tradeoff itself).

**Observed behavior:** Unlike `shareTokens`' 144-bit random id, the memorable-URL doc ids are fully
deterministic: `{orgSlug}__service-{YYYY-MM-DD}` and `{orgSlug}__q{1-4}-{YYYY}`. Given a church's
public slug (readable by anyone — `orgSlugs` is `allow read: if true`) and a plausible service date or
quarter/year (a small, guessable search space — most churches meet weekly, so a handful of Sunday
dates covers months of history), any caller can construct the exact document id and `getDoc` it
directly — no link ever needs to have been shared with them. `writeSharePayload`
(`src/stores/services.ts:732-782`) and `finalizeAndShare` (`quarters.ts:363-431`) create BOTH the
opaque `shareTokens` doc and this deterministic doc in the same operation, and only when an editor
explicitly shares (not automatically for every service) — so the exposure is scoped to services/
quarters an editor has actually shared at least once, not the org's entire private history. This is a
deliberate, documented design tradeoff ("memorable URL" is the whole point) rather than an
implementation bug, and was never assessed for its enumeration-risk consequence in the ADRs that
introduced it.

**Impact:** Once a church has shared even one service or quarter (common — sharing is the intended
workflow), anyone who knows or guesses its slug can browse its shared-service history by iterating
dates, without needing the actual share link circulated to volunteers. This is superseded in practice
today by `SEC-S-01` (full collection listing makes guessing unnecessary), but is an **independent**
exposure vector that `SEC-S-01`'s fix (splitting `get`/`list`) does **not** close — deterministic ids
remain guessable via ordinary `getDoc` calls even after `list` is denied. Rated Medium (a real,
condition-dependent weakness — requires knowing/guessing the slug and a plausible date — rather than
an unconditional Critical/High cross-tenant bypass) per the rubric's "defense-in-depth gap... needing
specific conditions."

**Not required to carry its own ALLOW-case test note beyond SEC-S-01's** (Medium tier; if Phase 113
elects to address this independently of SEC-S-01, the fix shape would need to move away from
deterministic ids or add an additional per-request signal, which is a larger design change than this
review is scoped to prescribe — flagged for Phase 113's judgment, not mandated here).

---

### SEC-S-03 — [Low] Share links never expire and are not rotated on content refresh — only explicit editor-initiated deletion revokes access

**Location:** `src/stores/services.ts:860-934` (`maybeRefreshShareLink` — calls `writeSharePayload`
which `setDoc`-overwrites the SAME token doc in place, never rotates the token id);
`src/stores/services.ts:500-549` (`deleteService`'s revocation of `serviceShares` on delete);
`src/stores/quarters.ts:440-493` (`deleteQuarter`'s revocation of both `shareTokens` and
`quarterShares`).

**Observed behavior:** A share link (opaque token or memorable URL), once minted, remains valid
indefinitely — there is no TTL, no expiry field, and no automatic revocation when the underlying
service is edited, re-locked, or reopened for editing; the snapshot is simply refreshed in place on
every qualifying edit (`maybeRefreshShareLink`), so the SAME URL continues to work and always reflects
current content. The only revocation path is explicit: an editor deleting the service/quarter (which
also deletes its share docs) or, for `shareTokens`, an editor's own manual revoke action (permitted by
`firestore.rules:352`'s delete rule). This is clearly an intentional product decision (a share link
that silently expired would break the workflow of texting/emailing it to volunteers once), not a
defect.

**Impact:** Informational/Low — recorded because the plan's PII-handling scope asks whether public
exposure is "necessary and consented," and an indefinitely-valid link is a standing fact worth
documenting for Phase 113/the consolidated report, not because it is itself exploitable beyond what
`SEC-S-01`/`SEC-S-02` already describe.

---

### SEC-S-04 — [Low] Free-text `notes`/per-slot body fields are rendered verbatim on the public share page with no PII filtering — unlike the deliberately-guarded `roleAssignments`

**Location:** `src/stores/services.ts:70-99` (`ServiceSnapshot` interface — `notes: string` and each
slot's own `notes`/`body`, both carried through with no allowlist); `src/stores/services.ts:133-145`
(the CONTRASTING deliberate names-only guard on `roleAssignments`, explicit comment: "Map ONLY — never
embed the raw Person object (no email/phone/pcPersonId)"); `src/views/ShareView.vue:105`
(`{{ slot.notes ?? slot.body }}`, rendered unescaped-text but unfiltered) and `:110-113` (the
service-level `notes` section, same pattern).

**Observed behavior:** `roleAssignments`/`personNames` and the stage-layout projection both go through
an explicit field-allowlist specifically because they are Person-derived data (confirmed by the
in-code comments citing a "D-04/D-24 PII guard"). Free-text fields — the service's own `notes` field
and every slot's `notes`/`body` — carry no equivalent guard: whatever an editor types is published
verbatim to the unauthenticated public page. Nothing in the reviewed code stops an editor from typing
a volunteer's phone number, home address, or other incidental PII into a "Prayer" slot's note or the
service-level notes (e.g., "call Sarah at 555-0100 if she's running late") and having it appear on the
public, search-engine-crawlable share page.

**Impact:** Low/informational — this is an inherent product tension (restricting free text would break
the notes feature's purpose) rather than a code defect, and the deliberate names-only guard on the
structured `roleAssignments` field shows the team has already applied the correct mitigation where it
is mechanically enforceable. Recorded per the plan's explicit PII-handling scope so the consolidated
report captures the full exposure surface, not because a code fix is being prescribed here.

---

### SEC-S-05 — [Confirmed sound, no finding] The structured "Who's Serving" PII guard, the stage-layout field-allowlist, and the soft-fail error handling on `ShareView`/`QuarterShareView` are all correctly implemented

**Location:** `src/stores/services.ts:133-145` (names-only `roleAssignments`, no email/phone/
pcPersonId), `src/stores/services.ts:147-172` (stage-layout projection — explicit 6-field allowlist,
"defensively re-clamped (IN-03) as the last line of defense before an unauthenticated public page
renders these values"), `src/views/ShareView.vue:216-225` and `QuarterShareView.vue:262-269` (both
components' `onMounted` wrap the token/slug lookup in try/catch and set `notFound.value = true` on
ANY failure — including a Firestore `permission-denied` — rather than leaking an error message that
could reveal whether a doc exists but is denied vs. genuinely absent).

**Observed behavior:** Reviewed per the plan's explicit instruction to check whether public rendering
exposes more than intended. Every structured (non-free-text) field that reaches the public page has
already been through a deliberate allowlist that keeps out raw Person objects (email, phone,
`pcPersonId`), and both public views fail closed to an identical "not found" UI on any error, so a
denied read is indistinguishable from a genuinely missing doc — no oracle for probing existence.
`?view=stage` and the default portrait view read from the SAME already-fetched, already-allowlisted
snapshot doc (`ShareView.vue:19,35`, both branched off the one `serviceSnapshot` ref) — there is no
separate, less-guarded fetch path for the stage view. No finding; recorded as a confirms-sound result
per the plan's own convention of stating a null result explicitly (mirrors 112-02's `SEC-A-02`).

---

## Artifacts this phase produces

This file (`112-FINDINGS-sharetoken-pii-abuse.md`) is one of three disjoint per-dimension findings
files for Phase 112 (alongside `112-FINDINGS-rules-isolation.md` from plan 112-01 and
`112-FINDINGS-auth-functions.md` from plan 112-02). Plan 112-04 consolidates all three into the single
ranked `.planning/phases/112-security-review/112-SECURITY-REVIEW.md`, which Phase 113 reads to scope
its Critical/High remediation (Medium/Low findings route to backlog per the CONTEXT-locked severity
rubric).

---

## Cost/Abuse Controls Review (dimension C)

### Medium/Low

### SEC-C-01 — [Medium] The ESV/NLT Bible-API proxy branches require auth + per-org enablement but are NOT covered by the per-uid rate limiter — unlike `anthropic`, they can be called at unlimited frequency

**Location:** `functions/src/index.ts:543-603` (the `if (service === "anthropic")` block — the ONLY
branch that calls `checkAndConsumeRateLimit`/`enforceModelAndTokens`); `functions/src/index.ts:605-624`
(the `if (service === "esv" || service === "nlt")` block — auth + `checkOrgBibleEnablement` only, no
rate limit, no request-shape enforcement).

**Observed behavior:** `SECRET_INJECTED` (`functions/src/index.ts:87`) requires a valid Firebase ID
token for all three of `anthropic`/`esv`/`nlt`, and R297's `checkOrgBibleEnablement` correctly gates
`esv`/`nlt` behind the caller's org having Bible API features enabled (`functions/src/index.ts:613-624`,
confirmed present and correctly ordered). But `checkAndConsumeRateLimit` (R161, per-uid fixed-window)
and `enforceModelAndTokens` (R162, model allow-list + token clamp — not applicable to Bible lookups
anyway) are both scoped exclusively inside the `service === "anthropic"` conditional
(`functions/src/index.ts:547`). Once an authenticated caller from an org with `bibleApiEnabled: true`
passes the enablement check, there is no per-uid or per-org THROTTLE on how many ESV/NLT requests they
can issue per minute or per day — only the `api` function's own `AI_PROXY_MAX_INSTANCES=10` concurrency
ceiling (shared across all four proxy targets) bounds simultaneous in-flight requests.

**Impact:** Any authenticated member of an org with Bible API enabled can hammer `/api/esv/...` or
`/api/nlt/...` at whatever rate the 10-instance concurrency ceiling allows, consuming the owner's ESV/
NLT API quota (a shared, billed-or-rate-limited third-party credential) with no per-caller throttle.
Rated Medium, not High: the attacker must already be an authenticated org member (not an anonymous
caller — this is not a `SEC-S-01`-style unauthenticated cross-tenant leak), ESV/NLT are typically
free-tier/low-cost Bible-lookup APIs (materially cheaper to abuse than the metered Anthropic API this
same limiter WAS built to protect), and the shared 10-instance ceiling caps worst-case concurrency
regardless. Still a genuine, concrete inconsistency worth fixing: the R161 limiter's own doc comment
frames it as protecting "the anthropic upstream" cost, but the SAME class of risk (a shared credential,
billed to the owner, gated only by org-enablement) applies to `esv`/`nlt` and was left out.

**Suggested remediation direction (not applied — review-only):** extend `checkAndConsumeRateLimit`'s
call site to cover `esv`/`nlt` as well as `anthropic` (the function itself is already generic — it
takes `uid` and a `limits` object, not an anthropic-specific shape), with either the same or a
separately-tunable `AiProxyLimits`-shaped config for Bible-API rate limits.

---

### SEC-C-02 — [Confirmed sound, no finding] The `anthropic` proxy path itself is thoroughly capped end-to-end

**Location:** `functions/src/index.ts:496-505` (`verifyAppCaller` auth gate), `:547-560`
(`checkOrgAiEnablement`, fail-closed, runs FIRST per ADR-0024), `:562-577` (`enforceModelAndTokens` —
server-side model allow-list + `max_tokens` clamp, IN-01-hardened against a numeric-string bypass),
`:581-602` (`checkAndConsumeRateLimit`, R161, per-uid fixed-window, fail-open per the locked 65-CONTEXT
decision), `:194,204` (`AI_PROXY_MAX_INSTANCES=10` function-level + `GLOBAL_MAX_INSTANCES=20`
project-wide fallback, R172), `:641-661` (`writeUsageLedger`, R163, per-call `aiUsage` ledger entry).

**Observed behavior:** Reviewed per the plan's explicit instruction to assess "whether the api proxy
can be driven as an open relay or past the owner's billed AI/Bible quota." All five independent
controls are present, correctly ordered (enablement gate before any Firestore/rate-limit work per
ADR-0024's explicit rationale — "a disabled org must never reach even the cheapest of those checks"),
and each does what its own doc comment claims. No gap found on the `anthropic` path itself — the gap
identified in this review is `SEC-C-01`'s narrower scope (the SAME controls not extended to `esv`/
`nlt`), not a weakness in the `anthropic` path. Recorded as a confirms-sound result per the plan's own
convention of stating a null result explicitly (mirrors 112-02's `SEC-A-02`).

---

### SEC-C-03 — [Confirmed sound, no finding] The rate-limiter's fail-OPEN posture is correctly differentiated from the enablement checks' fail-CLOSED posture

**Location:** `functions/src/index.ts:595-602` (`checkAndConsumeRateLimit`'s catch block — explicit
comment: "Fail OPEN: the limiter is a cost guardrail, not a security control (locked decision,
65-CONTEXT.md)"); `functions/src/index.ts:309-318` (`checkOrgAiEnablement`'s catch block — explicit
comment: "FAIL CLOSED on a read error"); `functions/src/index.ts:342-351` (`checkOrgBibleEnablement`,
identical fail-closed shape); `functions/src/index.ts:2624-2634` (`checkAndConsumeOrgEmailQuota`'s call
site — same fail-open posture, same "cost guardrail, not a security control" rationale, applied
consistently to the email-quota check).

**Observed behavior:** Reviewed per the plan's explicit instruction to assess "whether the
rate-limiter's fail-open posture vs the enablement checks' fail-closed posture is correct for each
path." The two postures protect DIFFERENT properties and are each assigned correctly: the
enablement/kill-switch checks (`checkOrgAiEnablement`/`checkOrgBibleEnablement`) are AUTHORIZATION —
"is this org even allowed to use this feature at all" — and fail closed so a Firestore read hiccup
never accidentally grants access to a disabled org. The rate limiter and email quota are COST
guardrails, not authorization, and fail open so a Firestore hiccup never takes down an already-
authorized feature for every legitimate user over one transient error. This is a deliberate,
consistently-applied, and correctly-reasoned split — no finding.

---

### SEC-C-04 — [Confirmed sound, live-verified, no finding] The render-service (R173) and project-wide (R172) instance ceilings are live in production, not merely documented

**Location:** `render-service/DEPLOY.md` (`--concurrency=1 --max-instances=3 --no-allow-unauthenticated`,
staged deploy command); `functions/src/renderInvoker.ts:20-50` (`invokeRenderService` — Google-signed
ID-token client, audience pinned to the exact service URL, "There is no fallback path" to an
unauthenticated call); `functions/src/index.ts:194,203-204` (`AI_PROXY_MAX_INSTANCES=10`,
`GLOBAL_MAX_INSTANCES=20` applied via `setGlobalOptions`, R172 — bounds every OTHER function's
fan-out, including `esv`/`nlt` (`SEC-C-01`) and the messaging queue path (`SEC-C-05` below)).

**Observed behavior:** See "Live evidence gathered this session" above — `gcloud run services
describe pptx-render` (read-only) confirms the live Cloud Run service's `containerConcurrency=1` and
`autoscaling.knative.dev/maxScale=3`, an exact match to `DEPLOY.md`'s staged R173 flags; `gcloud run
services get-iam-policy pptx-render` (read-only) confirms the `roles/run.invoker` binding is scoped to
exactly the Cloud Functions runtime service account, with no public/`allUsers` binding. Combined with
`renderInvoker.ts`'s own refusal to call an unauthenticated fallback, this closes the render service as
an abuse surface: it cannot be reached by any caller except this project's own `parsePptx`→
`requestPptxRenderHandler` trigger chain, and even that chain's worst-case fan-out is capped at 3
concurrent instances, serialized to 1 conversion each.

**Impact:** None — recorded as a confirms-sound, live-verified result (not merely a static-code read)
per the plan's own convention.

---

### SEC-C-05 — [Low] `queueServiceMessage` has no per-uid/per-org enqueue-rate limit of its own — bounded only by downstream per-message and per-org-daily caps, not the enqueue call itself

**Location:** `functions/src/index.ts:2205-2303` (`queueServiceMessageHandler` — independent
editor-tier re-check at `:2256-2264`, no rate-limit call anywhere in the body);
`functions/src/index.ts:2581-2635` (`sendQueuedMessageHandler`'s downstream `MESSAGE_MAX_RECIPIENTS`
per-message cap and `checkAndConsumeOrgEmailQuota`/`ORG_MAX_EMAILS_PER_DAY` per-org-daily cap, R171 —
both enforced at SEND time, not at ENQUEUE time).

**Observed behavior:** Reviewed per the plan's explicit instruction to assess "whether the email/
message send path... can be abused to send excessive or unauthorized email." `queueServiceMessage` is
an `onCall` with no rate-limiter call comparable to `checkAndConsumeRateLimit` (R161) guarding it — an
already-authenticated editor of the target org (the only role permitted, independently re-verified
server-side) could call it in a tight loop, cheaply creating many `messages/{id}` docs in rapid
succession. Each resulting `sendQueuedMessage` trigger invocation IS correctly capped downstream (the
per-message recipient cap rejects any single message resolving to too many recipients, and the
per-org daily Resend quota rejects sends once the org's own daily total is exhausted) — but nothing
throttles the RATE of enqueue calls themselves, and both `queueServiceMessage` and `sendQueuedMessage`
inherit only the shared `GLOBAL_MAX_INSTANCES=20` fan-out ceiling (R172), not a per-uid limiter.

**Impact:** Low — the abuse is self-inflicted (an org can only exhaust its OWN daily email quota this
way, never another org's — `checkAndConsumeOrgEmailQuota` is scoped to the caller's own `orgId`),
requires an already-trusted editor credential (not an anonymous or cross-tenant attacker), and is
bounded to at most 20 concurrent Cloud Function invocations project-wide. Flagged because the plan's
review scope explicitly asks whether the enqueue path itself is bounded, and the literal answer is: not
by a rate limiter of its own, only by what happens after the doc is already created.

---

### SEC-C-06 — [Low] `parsePptx` has no per-uid/per-org daily import quota comparable to R161 (AI) or R171 (email) — bounded only by auth, the render service's own concurrency ceiling, and the shared function-level instance cap

**Location:** `functions/src/index.ts:716-777` (`parsePptxHandler` — independent org-membership
re-check at `:738-746`, storage-path-prefix guard at `:732-734`, no rate-limit call anywhere in the
body); `functions/src/index.ts:779-782` (`parsePptx` onCall wrapper — no `maxInstances` override,
inherits `GLOBAL_MAX_INSTANCES=20`).

**Observed behavior:** Every `parsePptx` call requires org membership (independently re-verified
server-side, never trusting the client-declared `orgId` alone) and a storage path already uploaded
under that exact org's own prefix (enforced by both the handler's own string-prefix check and
`storage.rules` at the Storage layer) — so this is not reachable by an anonymous or cross-tenant
caller. But unlike the AI proxy (R161, per-uid rate limit) and the messaging fan-out (R171, per-org
daily email quota), there is no per-uid or per-org DAILY cap on how many PPTX imports (each triggering
a real LibreOffice conversion via the render service) a member can request.

**Impact:** Low — bounded to the caller's own org (no cross-tenant reach), and the downstream render
service's live-confirmed `--concurrency=1 --max-instances=3` ceiling (`SEC-C-04`) throttles CONCURRENT
cost regardless of how many requests are made, but there is no circuit-breaker analogous to R171 if a
compromised or malicious org member decided to trigger many SEQUENTIAL imports over an extended
period — each one bounded in cost (`--timeout=300s --memory=2Gi --cpu=2`) but with no daily ceiling on
count. Kept Low rather than Medium because the per-request cost is fixed and linear (no amplification
factor beyond 1:1 with requests made), and reaching this path at all already requires a trusted,
already-authenticated org credential.

---

### Cross-Reference Note — SEC-A-01 (112-02, Medium) sharpened under the cost/abuse lens: the unauthenticated `planningcenter` route shares the SAME 10-instance concurrency pool as the billed `anthropic`/`esv`/`nlt` routes

112-02's `SEC-A-01` documents that `/api/planningcenter` is reachable with zero authentication, unlike
its three sibling proxy routes — scored Medium there because no `worship-planner` secret is exposed
(the caller supplies their own PC token) and `PROXY_TARGETS` is a fixed, non-arbitrary host map. This
plan's cost/abuse review adds one load-bearing fact 112-02's own authorization-focused pass did not
score: `AI_PROXY_MAX_INSTANCES=10` (`functions/src/index.ts:194,476`) applies to the **entire** `api`
Cloud Function — ALL FOUR proxy targets (`planningcenter`/`anthropic`/`esv`/`nlt`) share the SAME
10-instance concurrency ceiling, because `maxInstances` is a function-level option, not a per-route
one. An attacker driving high-volume, unauthenticated `planningcenter` traffic (trivial — no
credential needed at all) can saturate that shared 10-instance pool, starving legitimate authenticated
`anthropic`/`esv`/`nlt` requests from every real app user — a de facto denial-of-service on the paid AI
and Bible-lookup features, mounted entirely through the one route that requires no authentication.
This does not change `SEC-A-01`'s own severity call (112-02 is authoritative for that finding); it is
recorded here as a cross-dimension amplification the consolidator should weigh when prioritizing
`SEC-A-01`'s remediation urgency, since fixing the authentication gap on `planningcenter` would also
close this shared-pool starvation vector as a side effect.

---

## Summary

| ID | Severity | Dimension | Location |
|----|----------|-----------|----------|
| SEC-S-01 | Critical | Share-token/public-page exposure | firestore.rules:341,388,405 (shareTokens/quarterShares/serviceShares publicly listable) |
| SEC-S-02 | Medium | Share-token/public-page exposure | src/stores/services.ts:761; src/stores/quarters.ts:416; firestore.rules:369 (deterministic memorable-URL ids) |
| SEC-S-03 | Low | Share-token/public-page exposure | src/stores/services.ts:860-934 (no link expiry/rotation) |
| SEC-S-04 | Low | PII handling | src/stores/services.ts:70-99; src/views/ShareView.vue:105,110-113 (unfiltered free-text notes) |
| SEC-S-05 | Confirmed sound | PII handling | src/stores/services.ts:133-172; ShareView.vue/QuarterShareView.vue error handling |
| SEC-C-01 | Medium | Cost/abuse controls | functions/src/index.ts:543-624 (esv/nlt not rate-limited) |
| SEC-C-02 | Confirmed sound | Cost/abuse controls | functions/src/index.ts:496-661 (anthropic path fully capped) |
| SEC-C-03 | Confirmed sound | Cost/abuse controls | functions/src/index.ts:595-602,309-351,2624-2634 (fail-open vs fail-closed correctly split) |
| SEC-C-04 | Confirmed sound (live-verified) | Cost/abuse controls | render-service/DEPLOY.md; live gcloud run evidence |
| SEC-C-05 | Low | Cost/abuse controls | functions/src/index.ts:2205-2303 (queueServiceMessage enqueue not rate-limited) |
| SEC-C-06 | Low | Cost/abuse controls | functions/src/index.ts:716-782 (parsePptx no daily import quota) |

No source, functions, or `*.rules` files were modified during this review (`git status --porcelain --
src functions firestore.rules storage.rules` is empty, verified above and re-verified after this
task). No deploy occurred (the `gcloud run` commands run this session are read-only listing/IAM-policy
queries, not deploy actions).
