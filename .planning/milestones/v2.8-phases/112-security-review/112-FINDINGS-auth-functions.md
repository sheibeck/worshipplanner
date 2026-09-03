# 112-02 Findings: Auth/Custom-Claims + Route Guards + Cloud Functions Authorization

**Plan:** 112-02 (dimension A: auth/custom-claims; dimension B: route guards; dimension C: Cloud
Functions authorization), plus the Phase 110 handoff items ARCH-005 and ARCH-018.
**Reviewed:** 2026-09-02
**Reviewer:** executor agent, self-conducted (no sub-agent spawning available)
**Scope:** `src/stores/auth.ts` (946 lines), `src/router/index.ts` (256 lines), `functions/src/index.ts`
(2898 lines — every `onCall`/`onRequest`/`onDocumentCreated`/`onDocumentWritten`/`onSchedule` export),
`functions/src/orgProvisioning.ts`, `functions/src/claimsHelpers.ts`, `functions/src/superAdminClaims.ts`,
`functions/src/orgMembershipClaims.ts`, `functions/src/bootstrapSuperAdmin.ts`,
`functions/src/inviteOnboarding.ts`, `functions/src/orgDeletion.ts`, `firestore.rules` (super-admin/
appConfig block, ~425-449). Review-only — no code, rules, or config files were modified; nothing was
deployed. `firebase functions:list` was run as a **read-only** evidence-gathering command (confirmed
against `worship-planner-bc515`, the live prod project via `.firebaserc`) — it lists deployed function
metadata and performs no write/deploy action.

Out of scope for this file (see plan boundary): Firestore/Storage rules text and multi-tenant isolation
depth are plan 112-01's scope (`112-FINDINGS-rules-isolation.md`); share-token/public-page PII and
cost/abuse controls are plan 112-03's scope (`112-FINDINGS-share-cost.md`). Where this file's review
surfaces a rules-level or cost-control observation, it is cross-referenced with a pointer, not
independently re-scored, to avoid duplicate/conflicting severities across the three files.

---

## Method

Static code reading of every privileged/authenticated code path across the three dimensions, plus one
piece of live deploy-state evidence (`firebase functions:list`, read-only) that directly bears on
ARCH-005. No emulator test run was required for this plan (auth/claims and Cloud Functions authorization
are proven by reading the server-side re-verification code itself, not by rules-emulator allow/deny
behavior — that evidence class belongs to 112-01).

**Source/rules modification check:**
```
git status --porcelain -- src functions firestore.rules storage.rules
```
Empty — confirmed no source, functions, or `*.rules` files were modified during this review, and no
deploy occurred (`firebase functions:list` is read-only).

---

## Critical/High

*(No Critical or High findings identified for this plan's own three dimensions in isolation. One
cross-dimension amplification is noted below under "Cross-Reference Notes" rather than re-scored here —
see that section for why.)*

None of the reviewed callable/HTTP/trigger handlers were found trusting a client-declared `orgId` or
`role` without an independent server-side re-verification (member-doc read, `superAdmins/{uid}` doc
read, or both). Every super-admin-gated callable uses the two-layer `assertSuperAdminCaller` pattern
(token claim check + independent Firestore re-read of `superAdmins/{uid}`) rather than trusting the
`superAdmin` custom claim alone. Route guards correctly treat client-side state as convenience only,
with the real boundary enforced server-side.

---

## Medium/Low

### SEC-A-01 — [Medium] `/api/planningcenter` is reachable with no authentication, unlike every sibling proxy route

**Location:** `functions/src/index.ts:77-82` (`PROXY_TARGETS`, includes `planningcenter:
"https://api.planningcenteronline.com"`); `functions/src/index.ts:87` (`SECRET_INJECTED = new
Set(["anthropic", "esv", "nlt"])` — `planningcenter` deliberately excluded); `functions/src/index.ts:496-505`
(the `if (SECRET_INJECTED.has(service))` auth gate, which never runs for `service === "planningcenter"`);
`functions/src/index.ts:475-677` (`export const api = onRequest(...)`, the whole proxy handler).

**Observed behavior:** The `api` Cloud Function is a single `onRequest` handler that proxies
`/api/<service>/...` to one of four fixed upstream hosts. For `anthropic`/`esv`/`nlt` — the three
services where the function injects one of *our own* server-held secrets — the handler requires a valid
Firebase ID token in `X-App-Auth` before doing anything else (`verifyAppCaller`, line 500; 401 on
failure). `planningcenter` is deliberately excluded from `SECRET_INJECTED` because it forwards the
caller's own `authorization` header (their Planning Center OAuth token) rather than injecting a secret
of ours — a reasonable reason not to protect *our* credentials on that route. But the code comment at
line 84-86 ("the caller has to be a signed-in app user") frames the entire `SECRET_INJECTED` design as
the sole rationale for requiring authentication at all — and as written, `planningcenter` requires **no**
authentication of any kind: no `X-App-Auth` check, no org-membership check, nothing. Any unauthenticated
caller on the public internet can `POST`/`GET` `https://<region>-worship-planner-bc515.cloudfunctions.net/api/planningcenter/<any-PC-path>`
and have this deployed Cloud Function relay the request to `api.planningcenteronline.com`, forwarding
whatever `authorization` header the caller supplies.

**Impact:** No `worship-planner` secret is exposed (the caller supplies their own PC token, so this is
not a credential-leak vector). The practical risk is that the function becomes an **unauthenticated
open relay**: (1) it can be used to pivot/obscure the true origin of requests to Planning Center's API
(anyone with a PC OAuth token — including one stolen or obtained elsewhere, unrelated to this app — can
route traffic through our infrastructure); (2) it consumes this project's Cloud Functions invocation
quota/billing from callers who are not, and never need to become, app users; (3) it is the only proxy
target with zero application-level authorization of any kind, which is inconsistent with every sibling
route and with the security posture the code comment claims for the whole handler. `PROXY_TARGETS` is a
fixed, hardcoded map (no SSRF to arbitrary hosts is possible), and no per-service rate limiting exists
for `planningcenter` today (R161-R164's rate limiter only wraps the `anthropic` branch) — but rate
limiting/cost-abuse depth is plan 112-03's assigned dimension; noted here only as a pointer, not scored.
Rated Medium: a genuine, concrete authorization gap on a deployed, internet-reachable endpoint, but with
no cross-tenant data exposure, no `worship-planner` secret leakage, and a fixed (non-arbitrary) upstream
host, so it falls short of the rubric's High bar ("a real isolation/authz weakness likely exploitable
under real use" in the cross-tenant/data sense) while clearly exceeding a Low/nit.

**Suggested remediation direction (not applied — review-only):** require the same `X-App-Auth` /
`verifyAppCaller` check on the `planningcenter` branch as the other three services (auth-only, no
org-membership check needed since no org-scoped secret/data is touched), or, if intentionally left open
for a documented reason, update the header comment at line 84-86 so it no longer implies universal
authentication and add an explicit rationale for the one exception.

---

### SEC-A-02 — [Low, informational] `refreshOrgClaim`'s bounded retry window is latency, not a privilege race

**Location:** `src/stores/auth.ts:280-299` (`refreshOrgClaim`); `src/stores/auth.ts:62-63`
(`CLAIM_REFRESH_MAX_ATTEMPTS = 4`, `CLAIM_REFRESH_DELAY_MS = 1500`).

**Observed behavior:** Per the plan's read_first instruction to check "whether claim refresh/retry can
be raced into an elevated state" — reviewed in detail. `refreshOrgClaim` polls `getIdTokenResult(user,
true)` (force-refresh) up to 4 times, 1.5s apart, checking only whether `result.claims.orgId ===
targetOrgId`; it never writes any claim itself, and every value it reads (`orgId`, `role`,
`superAdmin`) comes straight from the server-issued, cryptographically-verified ID token — there is no
client-side path that could cause this function to observe or apply a claim value the server did not
actually set. The only "race" possible is a **timing** one (the claim not yet propagated after a fresh
membership write, so `orgId` mismatches for up to ~4.5s and the caller proceeds with a stale/absent
claim) — not a privilege-elevation race. This matches ARCH-019's confirmed finding (server-side handlers
independently re-verify membership rather than trusting the client's current claim state), so even a
stale claim on the client cannot itself grant elevated server-side access.

**Impact:** None identified. Recorded because the plan's read_first explicitly asked this question;
confirming a null result here (rather than silently omitting it) is the useful output.

---

## ARCH-005 (re-evaluated under a security lens) — org-provisioning Cloud Functions ARE deployed to production; the Phase 110 "UNDEPLOYED" premise is stale

**Location:** `functions/src/orgProvisioning.ts` (all seven exported handlers); `functions/src/index.ts:2882`
(`export { onboardOrganization, assignOrgAdmin, listOrganizations, setOrgActive, setOrgAiEnabled,
setOrgBibleEnabled }`); `functions/src/orgDeletion.ts` (`deleteOrganization`, re-exported at
`functions/src/index.ts:2898`).

**Phase 110's premise (quoted, `110-ARCHITECTURE-REVIEW.md:211-228`):** "Org-provisioning Cloud
Functions (`onboardOrganization`/`assignOrgAdmin`/`listOrganizations`/`setOrgActive`) are built+tested
but UNDEPLOYED per their own hand-over notes; isolation architecture cannot be verified against live
production state until deployed" — rated Medium, explicitly handed to Phase 112 as a "deploy-state audit"
action item.

**New evidence gathered this session (live, read-only, against the actual prod project):**
```
$ firebase use
worship-planner-bc515          # confirmed against .firebaserc's { "projects": { "default":
                                # "worship-planner-bc515" } } -- this is the live prod project,
                                # not a test/staging project.

$ firebase functions:list
```
returned 23 deployed `v2` functions, us-central1, nodejs22 — including, verbatim from the table:
`assignOrgAdmin` (callable), `deleteOrganization` (callable), `listOrganizations` (callable),
`onboardOrganization` (callable), `setOrgActive` (callable), `setOrgAiEnabled` (callable),
`setOrgBibleEnabled` (callable). **Every single function `orgProvisioning.ts` and `orgDeletion.ts`
export, and every function `functions/src/index.ts` re-exports from them, is live in production today.**
Cross-checked exhaustively: the 23 deployed function names match the 23 `export`/`export {...}` bindings
in `functions/src/index.ts` **1:1 with zero drift in either direction** — nothing exported from the
source tree is missing from the deployed set, and nothing is deployed that the current source tree does
not also export (no orphaned/stale deployed function from a prior version either).

**Security-lens severity call: Low (resolved) — corrects a stale Medium, not a new Critical/High.**
The ORIGINAL Medium rating existed because the architecture *could not be verified live*; that
uncertainty is now fully resolved with a definitive, positive result: the functions are deployed, they
match the current source exactly, and — per this plan's own Task 1 review — their authorization model is
sound (every handler in `orgProvisioning.ts`/`orgDeletion.ts` routes through `assertSuperAdminCaller`,
which itself double-checks both the caller's ID-token `superAdmin` claim AND an independent Firestore
re-read of `superAdmins/{uid}` before proceeding — no handler trusts the client-declared `orgId`/target
without re-deriving or re-validating it server-side). There is no live authorization gap in the
provisioning surface itself. **Not escalated to Critical/High; does not belong in Phase 113's
remediation scope** — it is a "confirms, resolves" finding for the backlog, documenting that the Phase
110 handoff's premise was itself stale (a legitimate finding in its own right: an architecture review's
deploy-state claim went unverified for at least one full milestone cycle) rather than a live security
gap requiring a fix.

**Cross-reference note (does not change this finding's own severity, see below):** this confirmed-deployed
state has a direct bearing on 112-01's `SEC-ISO-01` (High) — see "Cross-Reference Notes" at the end of
this file.

---

## ARCH-018 (re-evaluated under a security lens) — super-admin's universal `isOrgEditor` grant is a genuine, currently-unmitigated privilege-scope weakness, not merely an accepted architectural residual

**Location:** `firestore.rules:28-43` (`isOrgEditor(orgId)` — the `isSuperAdmin() ||` disjunct at line 38
grants editor-tier write access on EVERY org's `members/{uid}` subcollection to every super-admin,
unconditionally); `firestore.rules:141-143` (`members/{uid}` `allow write: if isOrgEditor(orgId)` — the
concrete write surface this grant reaches); `src/stores/auth.ts:670-705` (`enterOrgAsSuperAdmin` — read
in full this session, reproduced below) and `src/stores/auth.ts:707-...` (`exitSuperAdminView`).

**What the client code actually does (confirmed, `src/stores/auth.ts:670-705`):**
`enterOrgAsSuperAdmin(targetOrgId)` reads the target org's document (`getDoc`), sets local reactive
state (`orgId.value`, `viewingAsSuperAdmin.value`, `applyOrgSnapshot(...)`, `userRole.value = 'editor'`),
and returns — it performs **zero** Firestore writes (`getDoc` only; no `setDoc`/`writeBatch`/`updateDoc`
appears anywhere in the function body). The R226 guarantee ("entering a church as a super-admin creates
no membership document") is real and is exactly what today's shipped client code does.

**Why this is a genuine security finding under a security lens, not merely a confirmed architectural
note (re-evaluating past the Phase 78 "accepted" framing, per this plan's explicit instruction):**
1. **The guarantee is enforced by a promise, not a rule.** `firestore.rules:28-43`'s `isOrgEditor`
   grants full editor-tier write access on `members/{uid}` (and by extension every rule keyed off
   `isOrgEditor`) to *every* super-admin, for *every* org, unconditionally — there is no
   `isOrgMember(orgId)`-scoped narrower grant for super-admins anywhere in the rules file. The ONLY
   thing preventing a super-admin's authenticated Firestore SDK session from writing a
   `members/{anyOrg}/{theirOwnUid}` document with `role: 'editor'` for an org they were never invited to
   is that today's `enterOrgAsSuperAdmin` function chooses not to call `setDoc`. This is client-code
   discipline, not a server-enforced invariant — the exact distinction a security review (as opposed to
   an architecture review confirming "no new finding") exists to flag independently.
2. **The blast radius is broader than R226's own framing suggests.** R226 is stated in terms of "no
   membership document is created," but `isOrgEditor`'s universal grant is not scoped to *creating* a
   membership doc for oneself — `firestore.rules:141-143`'s `allow write` covers create, update, AND
   delete on **any** `members/{uid}` doc in **any** org. A compromised super-admin session (stolen
   token, XSS, a malicious browser extension with page access, or a rogue super-admin) could, via the
   raw Firestore JS SDK (bypassing the app's UI entirely, exactly as `SEC-ISO-01` in 112-01 documents for
   the analogous org-self-creation gap), write, modify, or delete **any** member's role in **any**
   organization — not just self-grant membership in one they're viewing. This is a materially larger
   privilege surface than the "creates no member doc" framing implies.
3. **The privilege check that exists (`isSuperAdmin()`) is not the same shape as the privilege being
   granted.** `isSuperAdmin()` is documented as a *platform-level* claim (`R177`, granted via the
   double-checked `setSuperAdminClaim` callable) intended to gate the Owner Console. Its `isOrgEditor`
   disjunct silently widens that platform-level grant into *unbounded per-org data-mutation authority*
   across every tenant's membership records — a materially different and much larger privilege than
   "can view the Owner Console," collapsed into the same boolean without an intermediate scoping step
   (e.g., an explicit "acting as editor of org X" grant, time-boxed or audit-logged).

**Security-lens severity call: Medium — a genuine, currently-unmitigated privilege-scope weakness (an
authz control that exists only as client-code contract where a rules-level invariant would be the
correct place for it), NOT re-classified as Critical/High.** Reasoning against a higher rating: no
observed exploitation path today (no shipped client code calls the missing write), reaching the residual
requires a *compromised or malicious super-admin session* (already a high-trust, small, owner-controlled
population per this app's model — see `bootstrapSuperAdmin.ts`'s single-owner-run chicken-and-egg
design), and cross-org membership tampering by a super-admin is a scenario the platform's own trust model
already partially accepts (super-admins are trusted to view any org's data via the same `isOrgEditor`
disjunct, by design, elsewhere in the rules file). This is a defense-in-depth gap ("a bug needing
specific conditions" per the rubric — the condition being an already-compromised or rogue super-admin
identity, not an ordinary editor/viewer) rather than a directly, independently exploitable auth bypass
for an ordinary user. **Re-evaluated and NOT deferred to "accepted, no action" as Phase 78/110 framed
it** — it is placed here in Medium/Low with an explicit fix-shape recommendation below, available for
Phase 113 to pick up if desired, rather than silently re-confirmed as a closed residual.

**Required ALLOW-case emulator test for a Phase 113 fix (per this plan's instruction, provided since this
finding could be picked up):** the fix shape is narrowing `members/{uid}`'s `allow write` for the
super-admin arm specifically to require an explicit, auditable "acting as editor of orgId X" signal
(e.g., a short-lived custom claim or a server-set Firestore field written by `enterOrgAsSuperAdmin`'s
Cloud-Functions-mediated equivalent, checked via `request.auth.token.viewingAsSuperAdmin == orgId` or
similar) rather than the unconditional `isSuperAdmin() ||` disjunct. A Phase 113 fix would need an
**ALLOW-case** test proving a super-admin who HAS the new scoped signal for org X can still write
`members/{uid}` under org X (the legitimate cross-org support/admin path this grant exists to serve must
not regress), alongside the natural DENY-case proving a super-admin with no signal for org Y cannot write
`members/{uid}` under org Y.

---

## Cross-Reference Notes

### ARCH-005's new "confirmed deployed" evidence sharpens 112-01's `SEC-ISO-01` (High) — not re-scored here, but the connection is load-bearing

112-01's `SEC-ISO-01` (High) found that `firestore.rules`' legacy client-side org-self-creation path
(`organizations/{orgId}` `allow create` + the `members/{uid}` "Flow 1" companion) is still rule-live even
though no current client code path uses it, because "org provisioning (`orgProvisioning.ts`) always
writes via the Admin SDK" is the documented sanctioned replacement. This plan's live deploy-state
evidence for ARCH-005 **confirms, with production evidence, that the sanctioned replacement
(`onboardOrganization`) is not merely written and tested but is actually live and reachable in
production today** — which means the redundant legacy rules path is not a theoretical gap "in case the
proper flow is never deployed," it is a **duplicate, unprotected route to an outcome the app already has
a properly-authorized, deployed path for**. This strengthens the case that `SEC-ISO-01`'s rules-level fix
(tightening `organizations/{orgId}` `allow create` to `isSuperAdmin()`-only, or removing the legacy
branch) is safe to ship without breaking any dependency on the legacy path — there is a confirmed-live
alternative already in production. `SEC-ISO-01`'s own severity (High) and required-test guidance are
authoritative per 112-01's file; this note is provided so Plan 04's consolidation has the full picture
without this file re-scoring a finding that belongs to 112-01.

### `SEC-ISO-04` (112-01, Low, pointer to this file) — resolved by this file's ARCH-018 section above

112-01's rules-focused pass flagged the same `isOrgEditor` universal-grant condition as `SEC-ISO-04` and
explicitly deferred its severity call to this file ("112-02's assessment is authoritative for
ARCH-018/IN-02"). This file's ARCH-018 section above (Medium) is that authoritative assessment.

### `SEC-ISO-02` (112-01, High) — the member-removal `revokeRefreshTokens` gap — independently corroborated by this session's read of the same trigger

112-01's `SEC-ISO-02` (High) documents that `syncOrgMembershipClaimHandler`
(`functions/src/orgMembershipClaims.ts:245-319`) never calls `getAuth().revokeRefreshTokens(uid)` on its
"clear" branch (ordinary member removal), unlike `setOrgActive`'s org-deactivation handler
(`orgProvisioning.ts:461`) and `setSuperAdminClaim`'s revoke branch (`superAdminClaims.ts:126`), both of
which this file independently read in full this session (Task 1, Cloud-Functions-authorization
dimension) and can confirm DO call it. This is the same underlying auth/claims-propagation-latency class
of issue this plan's dimension A is scoped to review, and this file's independent read of all three
call sites corroborates 112-01's finding with no contradicting evidence found. Not re-scored here — High
severity and required-test guidance remain 112-01's, cited here only for cross-file consistency.

---

## Artifacts this phase produces

This file (`112-FINDINGS-auth-functions.md`) is one of three disjoint per-dimension findings files for
Phase 112 (alongside `112-FINDINGS-rules-isolation.md` from plan 112-01 and `112-FINDINGS-share-cost.md`
from plan 112-03, not yet written as of this file). Plan 112-04 consolidates all three into the single
ranked `.planning/phases/112-security-review/112-SECURITY-REVIEW.md`, which Phase 113 reads to scope its
Critical/High remediation (Medium/Low findings route to backlog per the CONTEXT-locked severity rubric).

## Summary

| ID | Severity | Dimension | Location |
|----|----------|-----------|----------|
| SEC-A-01 | Medium | Cloud Functions authorization | functions/src/index.ts:77-87,496-505 |
| SEC-A-02 | Low (informational, null result) | Auth/custom-claims | src/stores/auth.ts:280-299 |
| ARCH-005 | Low (resolved — corrects a stale Medium; confirmed deployed + sound) | Cloud Functions authorization | functions/src/orgProvisioning.ts, orgDeletion.ts; functions/src/index.ts:2882,2898 |
| ARCH-018 | Medium (re-evaluated from "accepted" to a genuine, unmitigated finding) | Auth/custom-claims (privilege scope) | firestore.rules:28-43,141-143; src/stores/auth.ts:670-705 |

**Route guards (dimension B):** no findings — every route's `requiresAuth`/`requiresEditor`/
`requiresSuperAdmin` meta was checked against the sensitivity of its view and found consistent with its
documented rationale (R261/R267/R270/R272/R275 for the auth-only presentation/output routes;
`requiresSuperAdmin` on `/owner-console` forces a fresh server-verified claim via
`refreshSuperAdminClaim()` rather than trusting a possibly-stale cached claim). Every guard is
convenience-tier, as designed — the real enforcement for every route reviewed lives server-side
(Firestore/Storage rules or a Cloud Function's own re-verification), consistent with ARCH-019's confirmed
finding.

No source, functions, or `*.rules` files were modified during this review (`git status --porcelain --
src functions firestore.rules storage.rules` is empty, verified above). No deploy occurred
(`firebase functions:list` is a read-only listing command).
