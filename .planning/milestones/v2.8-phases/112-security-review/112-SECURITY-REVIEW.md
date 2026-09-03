# Phase 112 Security Review — Consolidated Report

**Consolidated:** 2026-09-02
**Consolidator:** plan 112-04 (executor, self-conducted — no sub-agent spawning available)
**Source files:** `112-FINDINGS-rules-isolation.md` (plan 112-01), `112-FINDINGS-auth-functions.md`
(plan 112-02), `112-FINDINGS-sharetoken-pii-abuse.md` (plan 112-03)

## Scope

This is a **review-only** report covering all six ROADMAP areas for Phase 112: (1) Firestore &
Storage security rules, (2) auth/custom-claims and route guards, (3) multi-tenant data isolation,
(4) Cloud Functions authorization, (5) share-token/public-page exposure and PII handling, and
(6) cost/abuse controls. No code, rules, or config files were changed to produce this report or
its three source findings files, and nothing was deployed. `git status --porcelain -- src functions
firestore.rules storage.rules` was empty after each of the three review plans and remains empty now.

Firestore-rules findings are grounded in a live run of `npx vitest run --config
vitest.rules.config.ts` against a real Firestore emulator on `127.0.0.1:8080` (`src/rules.test.ts`:
**200/200 PASS**, 0 failures — see 112-01's "Live rules-test evidence" section for the full
transcript and interpretation) plus a scratch, never-committed collection-query probe run the same
way in plan 112-03 (3/3 assertions, proving `SEC-S-01` below live). `src/storage.rules.test.ts`
could **not** run in either session — the Storage emulator (`127.0.0.1:9199`) was never reachable
this milestone, a suite-level `ECONNREFUSED` connection failure before any of its 26 tests executed.
This is a materially different failure mode than the "2 known cross-service-`firestore.exists()`
allow-case failures" CLAUDE.md documents for an older `storage.rules` — 112-01's static read
confirms that fallback arm was removed at Deploy 2 (2026-08-12); Storage-side findings in this
report (`SEC-ISO-02`) are therefore grounded in **static code reading only**, not live emulator
evidence, and that gap is called out explicitly wherever it matters. Two further pieces of
read-only live evidence ground Cloud-Functions/infra findings: `firebase functions:list` (confirms
`ARCH-005`) and `gcloud run services describe/get-iam-policy pptx-render` (confirms `SEC-C-04`).

Consolidation method: every finding below keeps its originating id, severity, and location from its
source file. No severity was re-classified from what its source plan assigned — each was re-checked
against the CONTEXT rubric (Critical = data loss / cross-tenant leak / auth bypass; High = a real
isolation/authz weakness likely exploitable under real use; Medium = defense-in-depth gap or a bug
needing specific conditions; Low = nits) and found consistent. Two overlapping pairs were reconciled
rather than double-counted: `SEC-ISO-04` (112-01) and `ARCH-018` (112-02) are the same underlying
`isOrgEditor` super-admin universal-grant condition — 112-02's `ARCH-018` write-up is authoritative
per 112-01's own explicit deferral, so `SEC-ISO-04` is listed once, folded into `ARCH-018`, below.
`SEC-ISO-06` (112-01, informational placeholder for the five publicly-readable collections) is
folded into `SEC-S-01` (112-03, which independently discovered and live-proved the Critical
listability defect for three of those five collections) with a residual Low note for the other two
(`orgSlugs`/`orgNames`), which 112-03 examined but did not escalate to Critical because their
content (a public slug/name pair) is materially less sensitive than `SEC-S-01`'s PII-bearing
service/quarter snapshots.

## Summary table

| ID | Severity | Area | Location | Summary | Disposition |
|----|----------|------|----------|---------|--------------|
| SEC-S-01 | **Critical** | (5) Share-token/public-page exposure | `firestore.rules:340-341,387-388,404-405` | `shareTokens`/`quarterShares`/`serviceShares` are publicly LISTABLE, not just gettable — unauthenticated collection-level queries return every org's shared service/quarter data and volunteer names, live-proven. | **Phase 113** |
| SEC-ISO-01 | **High** | (1) Firestore rules / (3) isolation | `firestore.rules:125-130,150-159` | Legacy client-side `organizations` self-creation + Flow-1 `members` create are still rule-live for any signed-in user, though no shipped client path uses them — bypasses the intended super-admin-gated `onboardOrganization` flow and can squat org slugs/names. | **Phase 113** |
| SEC-ISO-02 | **High** | (3) isolation / (1) Storage rules | `functions/src/orgMembershipClaims.ts:245-319`; `storage.rules:13-49` | Member removal clears Firestore access immediately but never calls `revokeRefreshTokens`, so claim-only Storage access (PPTX/media) can outlive removal by up to ~55 min (Storage-side evidence static-only this session). | **Phase 113** |
| SEC-A-01 | Medium | (4) Cloud Functions authorization | `functions/src/index.ts:77-87,496-505` | `/api/planningcenter` has zero authentication, unlike its `anthropic`/`esv`/`nlt` sibling routes — open-relay/DoS risk on a shared concurrency pool (see cross-ref note). | Backlog |
| ARCH-018 | Medium | (2) auth/custom-claims / (3) isolation privilege scope | `firestore.rules:28-43,141-143`; `src/stores/auth.ts:670-705` | Super-admin's unconditional `isOrgEditor` disjunct grants every super-admin full write on every org's `members/{uid}` — enforced only by client-code discipline (`enterOrgAsSuperAdmin` choosing not to write), not a rule. Folds in `SEC-ISO-04` (112-01). Re-evaluated from Phase 78/110 "accepted" to a genuine, unmitigated finding. | Backlog |
| SEC-R-03 | Medium | (1) Firestore rules | `firestore.rules:197-201` | `services/{docId}`'s draft-edit branch has no field-diff restriction — any org editor can forge `createdBy`/provenance fields while a service is draft. | Backlog |
| SEC-S-02 | Medium | (5) Share-token exposure | `src/stores/services.ts:761`; `src/stores/quarters.ts:416`; `firestore.rules:369` | Memorable-URL doc ids (`{slug}__service-{date}`, `{slug}__q{Q}-{Y}`) are deterministic and guessable from a public slug + plausible date — independent of `SEC-S-01`, survives its fix. | Backlog |
| SEC-C-01 | Medium | (6) cost/abuse controls | `functions/src/index.ts:543-624` | ESV/NLT Bible-API proxy branches require auth + org-enablement but are NOT covered by the per-uid rate limiter that guards `anthropic` — unlimited-frequency calls once enabled. | Backlog |
| SEC-ISO-05 | Low | (3) isolation (role semantics) | `firestore.rules:28-43`; `src/stores/auth.ts:585,592,595` | `role: 'admin'` is functionally identical to `'editor'` everywhere checked today (self-escalation possible but currently grants nothing extra) — a future `'admin'`-specific gate would silently inherit the self-escalation path. | Backlog |
| SEC-ISO-06 (residual) | Low | (1) Firestore rules / (5) exposure | `firestore.rules:369,381` | `orgSlugs`/`orgNames` use the same unsplit `allow read: if true` as `SEC-S-01`'s three collections and are therefore also fully listable — lower sensitivity (slug/name only), not escalated to Critical. | Backlog |
| SEC-S-03 | Low | (5) Share-token exposure | `src/stores/services.ts:860-934` | Share links never expire/rotate; only explicit editor deletion or manual revoke closes access — intentional product design, recorded for completeness. | Backlog |
| SEC-S-04 | Low | (5) PII handling | `src/stores/services.ts:70-99`; `src/views/ShareView.vue:105,110-113` | Free-text `notes`/slot-body fields render verbatim on the public share page with no PII filter, unlike the deliberately-guarded `roleAssignments` names-only field. | Backlog |
| SEC-A-02 | Low (confirmed sound, null result) | (2) auth/custom-claims | `src/stores/auth.ts:280-299` | `refreshOrgClaim`'s bounded retry is a latency race only, never a privilege race (every claim value is server-issued and independently re-verified server-side). No finding. | Backlog (no action) |
| ARCH-005 | Low (resolved — corrects a stale Medium) | (4) Cloud Functions authorization | `functions/src/orgProvisioning.ts`, `orgDeletion.ts`; `functions/src/index.ts:2882,2898` | Live `firebase functions:list` confirms all 7 org-provisioning/deletion functions ARE deployed to prod, 1:1 with source — Phase 110's "UNDEPLOYED" premise was stale. Authorization model (double-checked `assertSuperAdminCaller`) confirmed sound. No live gap. | Backlog (no action) |
| SEC-S-05 | Confirmed sound | (5) PII handling | `src/stores/services.ts:133-172`; `ShareView.vue`/`QuarterShareView.vue` | Structured "Who's Serving"/stage-layout PII allowlists and fail-closed "not found" error handling are correctly implemented. No finding. | N/A |
| SEC-C-02 | Confirmed sound | (6) cost/abuse controls | `functions/src/index.ts:496-661` | `anthropic` proxy path is fully capped end-to-end (auth, enablement, model/token clamp, rate limit, instance ceilings, usage ledger). No finding. | N/A |
| SEC-C-03 | Confirmed sound | (6) cost/abuse controls | `functions/src/index.ts:595-602,309-351,2624-2634` | Rate-limiter fail-OPEN vs. enablement-check fail-CLOSED postures are each correctly assigned to their risk class. No finding. | N/A |
| SEC-C-04 | Confirmed sound (live-verified) | (6) cost/abuse controls | `render-service/DEPLOY.md`; live `gcloud run` evidence | Render-service concurrency=1/max-instances=3/no-public-invoker ceilings (R173) are confirmed live in prod, not just documented. No finding. | N/A |
| SEC-C-05 | Low | (6) cost/abuse controls | `functions/src/index.ts:2205-2303` | `queueServiceMessage` has no per-uid/per-org enqueue-rate limit of its own; bounded only by downstream per-message/per-org-daily caps and the shared instance ceiling. Self-inflicted abuse only (org can only exhaust its own quota). | Backlog |
| SEC-C-06 | Low | (6) cost/abuse controls | `functions/src/index.ts:716-782` | `parsePptx` has no per-uid/per-org daily import quota (unlike R161/R171); bounded by auth, org-membership re-check, and the render service's own concurrency ceiling. | Backlog |
| — | — | (2) Route guards | `src/router/index.ts` | Every route's `requiresAuth`/`requiresEditor`/`requiresSuperAdmin` meta reviewed against view sensitivity; all convenience-tier only, with real enforcement server-side (rules/functions). **No findings for this area.** | N/A |

**All six ROADMAP areas represented:** (1) Firestore & Storage rules — `SEC-ISO-01`, `SEC-ISO-02`
(Storage side, static-only), `SEC-R-03`, `SEC-ISO-06` residual. (2) auth/custom-claims + route
guards — `ARCH-018`, `SEC-A-02`, route guards (no findings). (3) multi-tenant isolation —
`SEC-ISO-01`, `SEC-ISO-02`, `SEC-ISO-05`, `ARCH-018`. (4) Cloud Functions authorization —
`SEC-A-01`, `ARCH-005`. (5) share-token/public-page exposure + PII — `SEC-S-01` through `SEC-S-05`.
(6) cost/abuse controls — `SEC-C-01` through `SEC-C-06`.

---

## Critical/High (→ Phase 113)

### SEC-S-01 — [Critical] `shareTokens`, `quarterShares`, and `serviceShares` are publicly LISTABLE, not merely gettable — full cross-tenant enumeration of every org's shared service plans and volunteer names, no token required

**Area:** (5) share-token/public-page exposure, with a rules-text root cause under (1).

**Location:** `firestore.rules:340-341` (`match /shareTokens/{token} { allow read: if true; ... }`),
`firestore.rules:387-388` (`match /quarterShares/{shareId} { allow read: if true; ... }`),
`firestore.rules:404-405` (`match /serviceShares/{shareId} { allow read: if true; ... }`).

**Behavior:** Firestore Security Rules' `read` permission is shorthand for both `get` (single-doc,
by known id) and `list` (collection/query reads that can return every document). These three
collections use the unsplit `allow read: if true`, granting `list` with the exact same unconditional
grant as `get`. The shipped client only ever calls `getDoc` by exact id, but a caller is not bound to
the app's shipped code — any unauthenticated party with this project's public Firebase Web SDK
config (not a secret; required for the app to function) can run
`getDocs(collection(db, 'shareTokens'))` (or `quarterShares`/`serviceShares`) directly. **Live-proven
this session:** a scratch, never-committed probe test ran 3/3
`assertSucceeds(getDocs(collection(db, <name>)))` against the tracked `firestore.rules` text on the
live emulator, and each call returned every seeded doc across two different `orgId`s. No existing
test in `src/rules.test.ts` (lines 974-1422) exercises a collection-level query against any of the
three — this gap was previously untested, not merely unfixed.

**Impact:** A cross-tenant data leak in the CONTEXT rubric's own Critical definition, trivially
exploitable with no token guessing, no slug knowledge, and no special tooling. What leaks per
document: the full `ServiceSnapshot` (service date, name, all slot content — songs, scripture
references, sermon passage, prayer/announcement notes) and the "Who's Serving" volunteer **names**
for every role, or (for `quarterShares`) every serving volunteer's name across an entire quarter —
plus stage-layout element labels/volunteer names when present. The token-based security model
(`mintShareToken()`'s 144-bit opaque id) is rendered moot: an attacker does not need any token,
because listing the collection returns every token doc (including its `orgId` and `serviceId`
fields) directly. This is full, unauthenticated, cross-tenant enumeration of every church using this
product's sharing features.

**Related, lower-sensitivity instance of the same mechanism:** `orgSlugs/{slug}`
(`firestore.rules:369`) and `orgNames/{nameKey}` (`firestore.rules:381`) use the identical unsplit
`allow read: if true` and are therefore also fully listable — the complete registry of every org's
public slug/display name is enumerable in one query. Recorded as the `SEC-ISO-06` residual row in
the Medium/Low section below (lower severity: this content is arguably intended to be public, since
these ARE the memorable-URL identifiers — materially lower sensitivity than the PII-bearing
service/quarter snapshots above).

**Required ALLOW-case + DENY-case emulator tests for the Phase 113 fix:** split each of the three
collections' `allow read: if true` into `allow get: if true; allow list: if false;` (the narrowest
change that closes enumeration while preserving the exact `getDoc`-by-known-id flow every shipped
client already uses).
- **ALLOW-case (must keep passing / must be added):**
  `assertSucceeds(getDoc(doc(db, 'shareTokens', '<seeded-token>')))` for an unauthenticated caller —
  mirrors the existing test at `src/rules.test.ts:1242-1246`, which must keep passing unchanged — plus
  the equivalent `getDoc`-by-id ALLOW assertions for `quarterShares` and `serviceShares`.
- **DENY-case (new, the regression proof for this fix):**
  `assertFails(getDocs(collection(db, 'shareTokens')))` for an unauthenticated caller, and the
  `quarterShares`/`serviceShares` equivalents — the exact query shape this session's probe proved
  currently succeeds.
- The scratch probe file used to gather this session's evidence lived outside the repository and was
  not left behind; Phase 113 must author its own tracked version of these three DENY-case tests (plus
  the three unaffected/added ALLOW-case gets) inside `src/rules.test.ts`.

---

### SEC-ISO-01 — [High] Legacy client-side org self-provisioning path is still rule-live, bypassing the intended super-admin-gated provisioning flow

**Area:** (1) Firestore rules / (3) multi-tenant isolation.

**Location:** `firestore.rules:125-130` (`organizations/{orgId}` `allow create`);
`firestore.rules:150-159` (`members/{uid}` `allow create`, Flow 1 — "org creation"). Cross-referenced
against `src/stores/auth.ts:744-808` (`ensureUserDocument`) and `src/rules.test.ts:268-287`.

**Behavior:** `firestore.rules` grants `allow create` on `organizations/{orgId}` to any signed-in
user (`isSignedIn() && request.resource.data.createdBy == request.auth.uid`) — no super-admin check,
no invite, no pre-existing org relationship required. The companion `members/{uid}` "Flow 1" grants
the same caller the right to write their own first membership doc with `role: 'editor'` in the same
atomic batch. `src/rules.test.ts:268` currently exercises and expects this to succeed. But
`src/stores/auth.ts`'s `ensureUserDocument` — the only client function the test claims to mirror —
no longer contains this org-creation branch: its documented behavior (verbatim, lines 803-806) is
"No pending invite: a signed-in user is NEVER auto-provisioned an organization. Organizations are
created only by a super-admin via the `onboardOrganization` callable." A repo-wide search found zero
client code paths that write an `organizations/{orgId}` doc — the only writer of this shape left in
the codebase is the test file pinning the rule's own, now-legacy contract. The rule's own comment
(lines 125-128) concedes the sanctioned path (`orgProvisioning.ts`) always writes via the Admin SDK,
bypassing this rule entirely — leaving the rule itself open to anyone calling the Firestore SDK
directly.

**Impact:** Any authenticated user — no invite, no legitimate relationship to the product — can
self-provision unlimited organizations directly via the Firebase JS SDK, becoming each org's founding
editor. This contradicts the current, documented provisioning model. Compounding: `orgSlugs/{slug}`
and `orgNames/{nameKey}` are create-once (first-writer-wins), gated only by
`isOrgEditor(request.resource.data.orgId)` — since self-provisioning makes the attacker an editor
immediately, they can squat a legitimate church's slug/name before that church is ever onboarded
through the sanctioned flow, denying the real church that name permanently. This plan's live
`ARCH-005` evidence (below, Medium/Low) sharpens the urgency: the sanctioned replacement
(`onboardOrganization`) is confirmed deployed and live in production today, so this legacy path is
not a fallback for an undeployed feature — it is a duplicate, unprotected route to an outcome the app
already has a properly-authorized, deployed path for.

**Required ALLOW-case emulator test for the Phase 113 fix:** tighten `organizations/{orgId}`
`allow create` (and the `members/{uid}` Flow 1 branch) to require `isSuperAdmin()`, or remove the
legacy branch outright.
- **ALLOW-case (must keep passing / must be proven post-fix):** (1) invite acceptance (Flow 2,
  `members/{uid}` create via `inviteLookup`) still succeeds for an ordinary signed-in user with a real
  invite — unaffected by this fix since Flow 2 is untouched; (2) if the path is narrowed rather than
  removed, a genuine super-admin performing the same self-service org-creation batch still succeeds.
- The existing test at `src/rules.test.ts:268` ("ALLOWS the founder of a brand-new org...", currently
  an ordinary non-super-admin context) must be updated to either `assertFails` (path removed) or
  reseeded with `superAdmin: true` (path narrowed) — whichever Phase 113 selects — so the suite
  continues to pin the corrected contract.

---

### SEC-ISO-02 — [High] Member removal does not revoke refresh tokens; Storage access (claim-only) can outlive Firestore-doc-based membership by up to the token's remaining lifetime

**Area:** (3) multi-tenant isolation / (1) Storage rules (evidence static-only, Storage emulator
unreachable this session — see Scope note above).

**Location:** `functions/src/orgMembershipClaims.ts:245-319` (`syncOrgMembershipClaimHandler`,
triggered by `onDocumentWritten("organizations/{orgId}/members/{uid}")`); `storage.rules:13-49`
(`isOrgMemberByClaim`, claim-only membership).

**Behavior:** Firestore-side membership is checked via a live `exists()`/`get()` — deleting the
member doc revokes Firestore access immediately, no propagation lag. Storage-side membership is
claim-only by deliberate design (Deploy 2, 2026-08-12) — it reads `request.auth.token.orgId`/`.role`/
`.orgs`, never the live Firestore doc. `syncOrgMembershipClaimHandler` does update/clear these claims
on member-doc delete, but a custom-claim update alone does not invalidate an already-issued ID/
refresh token; the Admin SDK requires an explicit `getAuth().revokeRefreshTokens(uid)` call to force
re-authentication before stale claims stop being honored. `revokeRefreshTokens` exists in exactly two
other places in the codebase (`orgProvisioning.ts:461`'s org-deactivation handler, T-76-10; and
`superAdminClaims.ts:126`'s super-admin grant/revoke) — `orgMembershipClaims.ts`, which handles
ordinary per-member removal, calls it nowhere. This is a direct asymmetry with the org-deactivation
path, which already established the correct pattern for this exact problem class but never extended
it to individual member removal.

**Impact:** When an org editor removes a member (a routine, common operational action — offboarding a
volunteer or terminated staff member), Firestore access is cut off immediately, but Storage access
(PPTX imports, media attachments under `orgs/{orgId}/**`) remains valid on the already-issued,
unrevoked auth claims until the client's next forced token refresh (~55 minutes under normal Firebase
JS SDK behavior). A real, currently-unmitigated authz weakness under a realistic, common trigger, not
a contrived edge case.

**Required ALLOW-case + DENY-case tests for the Phase 113 fix:** add
`getAuth().revokeRefreshTokens(uid)` to the "clear" branch of `syncOrgMembershipClaimHandler`
(mirroring `orgProvisioning.ts:461`'s pattern). Because `revokeRefreshTokens` has no
Storage-Rules-emulator-observable side effect by itself, the regression proof is two-part:
1. **ALLOW-case** (once the Storage emulator is reachable, in `src/storage.rules.test.ts`): a
   REMAINING member of the same org, with an unrelated member's doc having just been deleted, still
   has unaffected read/write access — proving the revoke targets only the removed uid, not the whole
   org's blast radius. This must be an ALLOW, not a deny, to prove no over-broad revocation.
2. **Functions-level unit test** (mirroring `orgProvisioning.test.ts`'s existing
   `revokeRefreshTokens`-assertion pattern, e.g.
   `expect(revokeRefreshTokens).toHaveBeenCalledWith(uid)`), proving the "clear" branch now calls it
   on removal.

Note for Phase 113 planning: this finding's Storage-rules evidence is static-only this session (the
Storage emulator was unreachable); Phase 113 should re-confirm current claim-only `storage.rules`
behavior live once the emulator (or `firebase emulators:start`) is available, before relying solely
on this review's static read.

---

## Medium/Low (→ backlog)

### SEC-A-01 — [Medium] `/api/planningcenter` is reachable with no authentication, unlike every sibling proxy route

**Area:** (4) Cloud Functions authorization.

**Location:** `functions/src/index.ts:77-82` (`PROXY_TARGETS`), `:87` (`SECRET_INJECTED` excludes
`planningcenter`), `:496-505` (the auth gate, which never runs for `planningcenter`), `:475-677`
(`api = onRequest(...)`).

**Behavior:** The `api` proxy requires a valid Firebase ID token (`X-App-Auth`) before proxying
`anthropic`/`esv`/`nlt` (services where it injects one of our own secrets). `planningcenter` is
excluded from that gate because it forwards the caller's own PC OAuth token rather than injecting
ours — but as written it requires **no** authentication of any kind. Any unauthenticated internet
caller can relay requests to `api.planningcenteronline.com` through this deployed function.

**Impact:** No `worship-planner` secret is exposed. Risk: (1) the function becomes an unauthenticated
open relay that can obscure the true origin of PC-API traffic; (2) it consumes this project's Cloud
Functions invocation quota/billing from non-app callers; (3) it is the only proxy target with zero
application-level authorization, inconsistent with its sibling routes. `PROXY_TARGETS` is a fixed map
(no SSRF to arbitrary hosts). **Cross-dimension amplification (from 112-03's cost/abuse pass):**
`AI_PROXY_MAX_INSTANCES=10` is function-level, shared across all four proxy targets — unauthenticated
`planningcenter` traffic can saturate that shared pool, starving legitimate authenticated
`anthropic`/`esv`/`nlt` requests (a de facto DoS on the paid AI/Bible features), which raises this
finding's remediation urgency without changing its Medium severity call.

**Suggested remediation direction (not applied):** require the same `X-App-Auth`/`verifyAppCaller`
check on the `planningcenter` branch (auth-only, no org-membership check needed), or, if
intentionally left open, update the header comment (lines 84-86) so it no longer implies universal
authentication and document the exception's rationale. Not rules-related — no ALLOW/DENY-case
emulator test required.

---

### ARCH-018 — [Medium] Super-admin's universal `isOrgEditor` grant is a genuine, unmitigated privilege-scope weakness (re-evaluated from Phase 78/110 "accepted"; folds in `SEC-ISO-04`)

**Area:** (2) auth/custom-claims / (3) isolation privilege scope.

**Location:** `firestore.rules:28-43` (`isOrgEditor(orgId)` — the `isSuperAdmin() ||` disjunct grants
editor-tier write access on every org's `members/{uid}` subcollection to every super-admin,
unconditionally); `firestore.rules:141-143` (`members/{uid}` `allow write: if isOrgEditor(orgId)`);
`src/stores/auth.ts:670-705` (`enterOrgAsSuperAdmin`).

**Behavior:** `enterOrgAsSuperAdmin` reads the target org's doc and sets local reactive state only —
it performs zero Firestore writes. The R226 "entering a church as super-admin creates no membership
document" guarantee is real in today's shipped client code. But that guarantee is enforced by a
promise, not a rule: `isOrgEditor`'s universal grant is not scoped to self-creation — it covers
create, update, AND delete on any `members/{uid}` doc in any org. A compromised super-admin session
(stolen token, XSS, malicious extension, or a rogue super-admin) could, via the raw Firestore JS SDK,
write/modify/delete any member's role in any org — a materially larger privilege surface than the
"creates no member doc" framing implies. `isSuperAdmin()` is documented as a platform-level claim
gating the Owner Console; its `isOrgEditor` disjunct silently widens that into unbounded per-org
data-mutation authority across every tenant's membership records, with no intermediate scoping step.

**Impact:** No observed exploitation path today (no shipped client code calls the missing write);
reaching the residual requires an already-compromised or malicious super-admin session (a small,
owner-controlled, high-trust population). Rated Medium — a defense-in-depth gap requiring an
already-compromised/rogue privileged identity, not an ordinary-user auth bypass. **Not deferred to
"accepted, no action"** as Phase 78/110 framed it — carried forward here with an explicit fix shape
for Phase 113 to pick up if desired.

**Required ALLOW-case + DENY-case tests, if picked up:** narrow `members/{uid}`'s `allow write` for
the super-admin arm to require an explicit, auditable "acting as editor of orgId X" signal (e.g. a
short-lived custom claim or server-set field via a Cloud-Functions-mediated `enterOrgAsSuperAdmin`
equivalent) instead of the unconditional `isSuperAdmin() ||` disjunct.
- **ALLOW-case:** a super-admin who HAS the new scoped signal for org X can still write
  `members/{uid}` under org X — the legitimate cross-org support/admin path this grant exists to
  serve must not regress.
- **DENY-case:** a super-admin with no signal for org Y cannot write `members/{uid}` under org Y.

---

### SEC-R-03 — [Medium] `services/{docId}` draft-edit branch has no field-diff restriction, permitting `createdBy` (and other) provenance-field forgery

**Area:** (1) Firestore rules.

**Location:** `firestore.rules:197-201` (`services/{docId}` `allow update`, branch 1: `storedStatus()
== 'draft'`).

**Behavior:** Unlike `organizations/{orgId}`'s update rule (guarded by `preservesCreatedBy()` per
ADR-0003), the "ordinary editing while draft" branch has no field-diff restriction — any key,
including `createdBy`, can be rewritten by any org editor while the doc is draft. `slideGroups`,
`messages`, and `lockSnapshots` share this characteristic.

**Impact:** An org editor can forge authorship attribution on a draft service (or similarly-unguarded
nested docs). Nothing in the reviewed rules keys authorization off `services.createdBy`, so this is a
provenance/audit-trail integrity gap within a single org, not cross-tenant or privilege-escalation.
Medium per rubric ("a bug needing specific conditions"). No ALLOW-case test required at this tier.

---

### SEC-S-02 — [Medium] Memorable-URL shares use deterministic, guessable document ids by design

**Area:** (5) share-token/public-page exposure.

**Location:** `src/stores/services.ts:761` (`serviceShares/${slug}__service-${date}`),
`src/stores/quarters.ts:416` (`quarterShares/${slug}__q${quarter}-${year}`);
`firestore.rules:369` (`orgSlugs/{slug}`, publicly readable).

**Behavior:** Unlike `shareTokens`' 144-bit random id, memorable-URL doc ids are fully deterministic.
Given a church's public slug and a plausible service date/quarter (a small, guessable search space),
any caller can construct the exact doc id and `getDoc` it directly — no link ever needs to have been
shared with them. A deliberate, documented "memorable URL" design tradeoff, never assessed for its
enumeration-risk consequence.

**Impact:** Once a church has shared even one service/quarter, its shared-service history is
browsable by iterating dates. Superseded in practice today by `SEC-S-01` (listing makes guessing
unnecessary), but **independent** — `SEC-S-01`'s fix (splitting `get`/`list`) does not close this;
deterministic ids remain guessable via ordinary `getDoc` even after `list` is denied. Rated Medium.
Fix shape (moving away from deterministic ids, or adding a per-request signal) is a larger design
change than this review is scoped to prescribe — left to Phase 113's judgment, not mandated.

---

### SEC-C-01 — [Medium] ESV/NLT Bible-API proxy branches are not covered by the per-uid rate limiter that guards `anthropic`

**Area:** (6) cost/abuse controls.

**Location:** `functions/src/index.ts:543-603` (the only branch calling
`checkAndConsumeRateLimit`/`enforceModelAndTokens` is `service === "anthropic"`); `:605-624` (the
`esv`/`nlt` branch — auth + `checkOrgBibleEnablement` only, no rate limit).

**Behavior:** All three of `anthropic`/`esv`/`nlt` require a valid ID token, and `esv`/`nlt` are
correctly gated behind per-org Bible-API enablement. But the R161 per-uid fixed-window rate limiter is
scoped exclusively to the `anthropic` branch. Once an authenticated caller from an enabled org passes
the enablement check, there is no per-uid or per-org throttle on ESV/NLT request volume — only the
shared `AI_PROXY_MAX_INSTANCES=10` concurrency ceiling (shared across all four proxy targets) bounds
simultaneous in-flight requests.

**Impact:** An authenticated org member can hammer `/api/esv/...`/`/api/nlt/...` at whatever rate the
shared concurrency ceiling allows, consuming the owner's ESV/NLT quota with no per-caller throttle.
Medium, not High: requires an already-authenticated org member (not anonymous/cross-tenant), ESV/NLT
are typically low-cost APIs, and the shared ceiling caps worst-case concurrency regardless. Suggested
direction: extend `checkAndConsumeRateLimit`'s call site to cover `esv`/`nlt` (the function is
already generic). Not rules-related — no ALLOW/DENY-case emulator test required.

---

### SEC-ISO-05 — [Low] Org member role `'admin'` is functionally identical to `'editor'` in every rule and client check found

**Area:** (3) multi-tenant isolation (role semantics).

**Location:** `firestore.rules:28-43` (`isOrgEditor` — `role in ['editor', 'admin']`, no rule
distinguishes the two); `src/stores/auth.ts:585,592,595` (client normalizes `'admin'` down to
`'editor'` on read).

**Behavior:** A member with `role: 'editor'` can write any member doc in the org via `isOrgEditor` —
including setting `role: 'admin'` on themselves. No capability found anywhere in the reviewed source
treats `'admin'` differently from `'editor'`, so this "escalation" currently grants nothing extra.

**Impact:** Low/informational today. A FUTURE feature gating specifically on `role === 'admin'`
(e.g. billing, a Cloud Function check) would silently inherit this self-escalation path with no
additional rules change — worth confirming at that time that no callable currently checks for
`'admin'` specifically (112-02 confirmed none does today).

---

### SEC-ISO-06 (residual) — [Low] `orgSlugs`/`orgNames` public-read grants are also fully listable, not just gettable

**Area:** (1) Firestore rules / (5) exposure.

**Location:** `firestore.rules:369` (`orgSlugs/{slug}`), `firestore.rules:381` (`orgNames/{nameKey}`)
— both `allow read: if true`, unsplit like `SEC-S-01`'s three collections.

**Behavior:** Same `get`/`list` unsplit mechanism as `SEC-S-01` — the complete registry of every
org's public slug and display name is enumerable in one query.

**Impact:** Not independently scored as Critical (unlike `SEC-S-01`) because the exposed content — a
slug/name pair — is arguably intended to be public, since these ARE the public-facing memorable-URL
identifiers, and carries materially lower sensitivity than `SEC-S-01`'s PII-bearing service/quarter
snapshots. If Phase 113 applies `SEC-S-01`'s `get`/`list` split fix pattern, extending the same split
to these two collections is a natural, low-cost follow-on (no ALLOW/DENY-case test mandated here
since this is Low tier, but the same test shape as `SEC-S-01` would apply if picked up).

---

### SEC-S-03 — [Low] Share links never expire and are not rotated on content refresh

**Area:** (5) share-token/public-page exposure.

**Location:** `src/stores/services.ts:860-934` (`maybeRefreshShareLink` — overwrites the same token
doc in place, never rotates); `src/stores/services.ts:500-549` / `src/stores/quarters.ts:440-493`
(deletion-triggered revocation).

**Behavior:** A share link, once minted, remains valid indefinitely — no TTL, no expiry, no automatic
revocation on edit/re-lock/reopen. Only explicit deletion (which also deletes share docs) or manual
revoke (rules-permitted delete) closes access. A deliberate product decision, not a defect.

**Impact:** Informational/Low — recorded for completeness per the PII-handling review scope, not
independently exploitable beyond what `SEC-S-01`/`SEC-S-02` already describe.

---

### SEC-S-04 — [Low] Free-text `notes`/slot-body fields render verbatim on the public share page with no PII filtering

**Area:** (5) PII handling.

**Location:** `src/stores/services.ts:70-99` (`ServiceSnapshot.notes` and per-slot `notes`/`body`,
no allowlist, contrasted with the deliberately-guarded `roleAssignments`); `src/views/ShareView.vue:105,110-113`.

**Behavior:** `roleAssignments`/stage-layout go through an explicit field-allowlist because they are
Person-derived data. Free-text fields carry no equivalent guard — whatever an editor types is
published verbatim to the unauthenticated public page (e.g. a phone number typed into a note).

**Impact:** Low/informational — an inherent product tension (restricting free text breaks the notes
feature) rather than a code defect; the structured-field guard shows the correct mitigation pattern
already applied where mechanically enforceable.

---

### SEC-C-05 — [Low] `queueServiceMessage` has no per-uid/per-org enqueue-rate limit of its own

**Area:** (6) cost/abuse controls.

**Location:** `functions/src/index.ts:2205-2303` (`queueServiceMessageHandler`, no rate-limit call);
`:2581-2635` (`sendQueuedMessageHandler`'s downstream per-message/per-org-daily caps, enforced at
SEND time only).

**Behavior:** An already-authenticated editor of the target org could call `queueServiceMessage` in a
tight loop, cheaply creating many `messages/{id}` docs; downstream per-message and per-org-daily caps
correctly bound what actually sends, but nothing throttles the enqueue rate itself (beyond the shared
`GLOBAL_MAX_INSTANCES=20` fan-out ceiling).

**Impact:** Low — self-inflicted (an org can only exhaust its own daily quota), requires an
already-trusted editor credential, bounded to at most 20 concurrent invocations project-wide.

---

### SEC-C-06 — [Low] `parsePptx` has no per-uid/per-org daily import quota

**Area:** (6) cost/abuse controls.

**Location:** `functions/src/index.ts:716-777` (`parsePptxHandler` — independent org-membership
re-check, storage-path-prefix guard, no rate-limit call); `:779-782` (no `maxInstances` override,
inherits the shared 20-instance ceiling).

**Behavior:** Requires org membership (independently re-verified) and an org-scoped storage path
(enforced at both handler and `storage.rules` layers), so not reachable cross-tenant. Unlike the AI
proxy (R161) and messaging fan-out (R171), there is no per-uid/per-org daily cap on PPTX import
count.

**Impact:** Low — bounded to the caller's own org, and the render service's live-confirmed
`--concurrency=1 --max-instances=3` ceiling (`SEC-C-04`) throttles concurrent cost regardless. No
circuit-breaker for many sequential imports over time, but each is fixed/linear cost with no
amplification factor.

---

### ARCH-005 — [Low, resolved] Org-provisioning Cloud Functions ARE deployed to production; the Phase 110 "UNDEPLOYED" premise is stale

**Area:** (4) Cloud Functions authorization.

**Location:** `functions/src/orgProvisioning.ts` (all 7 exported handlers), `functions/src/orgDeletion.ts`
(`deleteOrganization`), `functions/src/index.ts:2882,2898` (re-exports).

**Behavior:** Phase 110 rated this Medium because deploy state could not be verified live. This
session's live, read-only `firebase functions:list` (against `worship-planner-bc515`, confirmed via
`firebase use`) returned 23 deployed v2 functions including every one of `orgProvisioning.ts`'s and
`orgDeletion.ts`'s exports, matching the current source tree's exports 1:1 with zero drift. Their
authorization model (`assertSuperAdminCaller`, double-checking token claim + independent Firestore
re-read) was confirmed sound.

**Impact:** Corrects a stale Medium to Low/resolved — not escalated to Critical/High, not in Phase
113's remediation scope. It IS a legitimate finding in its own right: an architecture review's
deploy-state claim went unverified for at least one full milestone cycle. Cross-reference: this
confirmed-deployed state sharpens `SEC-ISO-01`'s urgency (the sanctioned replacement is proven live,
so the legacy path is a duplicate unprotected route, not a fallback for an undeployed feature).

---

### SEC-A-02 — [Low, confirmed sound, null result] `refreshOrgClaim`'s bounded retry window is latency, not a privilege race

**Area:** (2) auth/custom-claims.

**Location:** `src/stores/auth.ts:280-299` (`refreshOrgClaim`); `:62-63` (retry constants).

**Behavior:** Polls `getIdTokenResult(user, true)` up to 4 times, 1.5s apart, comparing only against
the server-issued, cryptographically-verified ID token — never writes a claim itself. The only
possible race is timing (claim not yet propagated), not privilege elevation; server-side handlers
independently re-verify membership regardless of client claim state (matches ARCH-019).

**Impact:** None identified. Recorded as a confirmed null result.

---

### SEC-S-05 — [Confirmed sound, no finding] The "Who's Serving" PII guard, stage-layout allowlist, and public-view fail-closed error handling are correctly implemented

**Area:** (5) PII handling.

**Location:** `src/stores/services.ts:133-172`; `src/views/ShareView.vue:216-225`,
`QuarterShareView.vue:262-269`.

**Behavior:** Every structured field reaching the public page is already allowlisted (no raw Person
object — no email/phone/`pcPersonId`); both public views fail closed to an identical "not found" UI
on any error (including `permission-denied`), so no oracle exists for probing existence. `?view=stage`
reads from the same already-fetched, already-allowlisted snapshot — no separate, less-guarded fetch
path.

**Impact:** None. No finding.

---

### SEC-C-02, SEC-C-03, SEC-C-04 — [Confirmed sound, no findings] Cost/abuse controls on the `anthropic` proxy path, the fail-open/fail-closed split, and the render-service instance ceilings

**Area:** (6) cost/abuse controls.

- **SEC-C-02** (`functions/src/index.ts:496-661`): the `anthropic` path is fully capped end-to-end
  (auth gate, fail-closed enablement check ordered first per ADR-0024, server-side model/token clamp
  hardened against a numeric-string bypass, R161 rate limit, instance ceilings, usage ledger). The gap
  identified in this review is `SEC-C-01`'s narrower scope (same controls not extended to
  `esv`/`nlt`), not a weakness in the `anthropic` path itself.
- **SEC-C-03** (`:595-602,309-351,2624-2634`): the rate limiter's fail-OPEN posture (cost guardrail,
  not a security control — locked decision, 65-CONTEXT.md) is correctly differentiated from the
  enablement checks' fail-CLOSED posture (authorization — must never grant access to a disabled org on
  a read hiccup). Deliberate and consistently applied.
- **SEC-C-04** (`render-service/DEPLOY.md`; live `gcloud run` evidence): live, read-only
  `gcloud run services describe/get-iam-policy pptx-render` confirms `containerConcurrency=1`,
  `maxScale=3`, and no public/`allUsers` invoker binding — an exact match to documented R173 flags,
  live-verified in production, not merely documented.

**Impact:** None. No findings.

---

## Artifacts this phase produces

- `.planning/phases/112-security-review/112-FINDINGS-rules-isolation.md` (plan 112-01 — Firestore &
  Storage rules + multi-tenant data isolation)
- `.planning/phases/112-security-review/112-FINDINGS-auth-functions.md` (plan 112-02 — auth/custom-
  claims, route guards, Cloud Functions authorization; ARCH-005/ARCH-018 re-evaluation)
- `.planning/phases/112-security-review/112-FINDINGS-sharetoken-pii-abuse.md` (plan 112-03 —
  share-token/public-page exposure, PII handling, cost/abuse controls)
- `.planning/phases/112-security-review/112-SECURITY-REVIEW.md` (this file — plan 112-04, the single
  ranked deliverable Phase 113 reads to scope its Critical/High remediation)

No source, functions, or `*.rules` files were modified to produce this consolidated report; nothing
was deployed. `git status --porcelain -- src functions firestore.rules storage.rules` is empty.
