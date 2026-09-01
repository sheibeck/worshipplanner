# Phase 108 Comment Inventory — Decision-Rationale, Behavioral/Architectural, Genuinely-Local Triage

_This document is being assembled across Plan 108-01's three tasks. Bucket A (Decision-Rationale) is complete as of Task 1. Header/scope/summary-table and the Phase 109 handoff section are added last, in Task 3._

## Bucket A — Decision-Rationale
Every load-bearing comment tagged with the `R-`/`WR-`/`CR-`/`Pitfall` decision-rationale vocabulary (per `108-CONTEXT.md`'s ADR convention), collected grep-first across all four in-scope trees (`src/**`, `functions/src/**`, `render-service/src/**`, `firestore.rules`; `storage.rules` carries no tagged hits). Grouped by file, ordered by line number. Each entry carries the tag id(s) it contains, any qualifying source document found in the same comment block (e.g. `73-REVIEW.md`, `26-RESEARCH.md`), an auto-extracted summary (the comment's own leading sentence, cleaned of comment syntax), and the full verbatim text for plan 108-02 to lift into an ADR.
**★ IMPORTANT — tag ids are locally scoped, not globally unique.** This codebase reuses bare `WR-01`, `WR-02`, `CR-01`, `CR-02`, `R-02`, and `Pitfall` as **per-file / per-review-round** labels, not as a single flat decision-id namespace. A `WR-01` in one file's comment and a `WR-01` in another's are frequently **two entirely different decisions** that happen to share a short label — see the plan's own illustrative example (`useRunControl.ts`'s WR-01 vs. `orgMembershipClaims.ts`'s WR-01): the former is an unqualified, file-local "claim a fresh Go-live token" guard; the latter is qualified to `73-REVIEW.md`/`76-REVIEW.md` and covers an unrelated claims-computation guard. **Plan 108-02 must group ADR candidates by (bare tag id + qualifying doc), never by bare tag id alone** — grouping on the bare tag would silently merge unrelated rationale into one ADR. The **Tag Collision Index** at the end of this section lists every bare tag id that recurs across more than one file, with each occurrence's qualifier (or `unqualified`), so 108-02 can tell a genuine shared decision (same tag + same qualifying doc, across files) from a coincidental label reuse (same tag, different or no qualifying doc).

### `firestore.rules`

**`firestore.rules:112-126`** — tags: Pitfall — qualifier: 82-RESEARCH.md

_Summary:_ specifically an ORDINARY editor forging these fields. Phase 82 (R242/R243): `aiMasterEnabled` -- the super-admin-only master AI gate -- is appended to this SAME allow-list, not given its own guard function.

```js
      // specifically an ORDINARY editor forging these fields.
      // Phase 82 (R242/R243): `aiMasterEnabled` -- the super-admin-only master
      // AI gate -- is appended to this SAME allow-list, not given its own
      // guard function. It is a DISTINCT top-level field from the pre-existing
      // `settings.aiEnabled` (the church's own AI preference, editor-writable
      // via the settings map) -- never a bare `aiEnabled` at this depth, to
      // avoid the exact name collision 82-RESEARCH.md's Pitfall 1 warns
      // against. Written ONLY by the setOrgAiEnabled Cloud Function via the
      // Admin SDK (functions/src/orgProvisioning.ts), which bypasses these
      // rules entirely -- mirrors `active`'s posture verbatim, INCLUDING the
      // "no exemption for a super-admin's own client SDK" posture (see the
      // CRITICAL test at src/rules.test.ts:682 and its aiMasterEnabled twin):
      // a super-admin client write here would skip setOrgAiEnabled's R243
      // forced-off side effect on `settings.aiEnabled`, reopening the same
      // partial-state hole Phase 78 closed for `active`.
```

**`firestore.rules:133-140`** — tags: WR-01 — qualifier: 82-REVIEW

_Summary:_ WR-01 (82-REVIEW): aiMasterEnabled's own audit-trail siblings (aiEnabledAt/aiEnabledBy/aiDisabledAt/aiDisabledBy, written by setOrgAiEnabledHandler) must ride along in this same allow-list -- otherwise an ordinary editor...

```js
        // WR-01 (82-REVIEW): aiMasterEnabled's own audit-trail siblings
        // (aiEnabledAt/aiEnabledBy/aiDisabledAt/aiDisabledBy, written by
        // setOrgAiEnabledHandler) must ride along in this same allow-list --
        // otherwise an ordinary editor can forge them directly, the exact
        // T-76-06 audit-forgery class already closed for `active`'s siblings.
        // bibleApiEnabled's own audit siblings (bibleApiEnabledAt/By,
        // bibleApiDisabledAt/By, written by setOrgBibleEnabledHandler) ride
        // along here too, for the same reason (Phase 101, R295).
```

**`firestore.rules:156-170`** — tags: Pitfall — qualifier: 80-RESEARCH.md

_Summary:_ R233/T-80-02/T-80-03: `createdBy` is a provenance/audit field that must be settable exactly once (at create) and frozen forever after -- an editor rewriting it is authorship tampering (Tampering) and destroys the audit t...

```js

      // R233/T-80-02/T-80-03: `createdBy` is a provenance/audit field that must
      // be settable exactly once (at create) and frozen forever after -- an
      // editor rewriting it is authorship tampering (Tampering) and destroys
      // the audit trail of who actually provisioned the org (Repudiation).
      // Deliberately a SIBLING helper, not folded into lifecycleFields()'s
      // array (80-RESEARCH.md Pitfall 2): that array is also consulted on
      // CREATE to assert those keys are ABSENT from the incoming doc, but
      // createdBy is REQUIRED on create (see the `allow create` clause below,
      // `request.resource.data.createdBy == request.auth.uid`) -- widening the
      // shared list would deny every legitimate org-create. This helper is
      // scoped to update only: the only call site below is `allow update`,
      // which is reached only when `resource` (the stored doc) already exists,
      // so no `resource == null` branch is needed here (unlike
      // preservesLifecycleFields(), which is also reachable from create).
```

**`firestore.rules:195-207`** — tags: CR-01 — qualifier: unqualified

_Summary:_ super-admin without one could never reach this line -- the exemption was safe.

```js
      // super-admin without one could never reach this line -- the
      // exemption was safe. Phase 78's super-admin arm (see isOrgEditor
      // above) makes isOrgEditor(orgId) true for EVERY super-admin on EVERY
      // org, so keeping `|| isSuperAdmin()` here would let ANY super-admin
      // client-write active/deactivatedAt/deactivatedBy/reactivatedAt/
      // reactivatedBy directly, skipping setOrgActive's deactivatedOrgs
      // claim fan-out and revokeRefreshTokens -- the CR-01/T-76-10 class of
      // bug, reopened by composition. Lifecycle fields are now
      // Admin-SDK-only for LITERALLY EVERYONE, super-admins included;
      // setOrgActive/deleteOrganization (both Admin SDK, bypassing rules
      // entirely) remain the only path. Proven by src/rules.test.ts: a
      // super-admin client updateDoc({active:false}) is DENIED and must use
      // the setOrgActive callable.
```

**`firestore.rules:219-230`** — tags: Pitfall — qualifier: 77-RESEARCH.md

_Summary:_ legitimate deletion path. It exists solely to close the client-side gap the `write`->`update` narrowing above just opened up: before that narrowing, `preservesLifecycleFields()`'s `request.resource == null -> true` branc...

```js
      // legitimate deletion path. It exists solely to close the client-side
      // gap the `write`->`update` narrowing above just opened up: before
      // that narrowing, `preservesLifecycleFields()`'s `request.resource ==
      // null -> true` branch meant the old `allow write` rule granted an
      // ordinary editor unconditional delete access to the org doc.
      // Deliberately UNCONDITIONAL -- NO `isSuperAdmin()` exemption
      // (77-RESEARCH.md Pitfall 5): writing this as `allow delete: if
      // isSuperAdmin()` would re-open a client-side deletion path for any
      // super-admin using the client SDK directly, which conflicts with the
      // design intent that deletion is Admin-SDK-only. Proven by an emulator
      // DENY for both an ordinary editor and a super-admin client context
      // (src/rules.test.ts).
```

**`firestore.rules:259-267`** — tags: CR-01 — qualifier: unqualified

_Summary:_ Flow 1: org creation. CR-01: getAfter() alone only proves "createdBy CURRENTLY equals my uid" -- createdBy is set once and never cleared, so without the !exists() guard below, ANY past founder (even one explicitly remove...

```js
          // Flow 1: org creation. CR-01: getAfter() alone only proves "createdBy
          // CURRENTLY equals my uid" -- createdBy is set once and never cleared, so
          // without the !exists() guard below, ANY past founder (even one explicitly
          // removed via TeamView's "Remove member") could re-grant themselves
          // role: 'editor' at any later time with a bare setDoc, no batch required.
          // !exists() reflects state as of the START of this operation -- unlike
          // getAfter(), it CANNOT see this batch's own sibling org-create write, so
          // it is only true when the org genuinely did not exist before this batch
          // began. Combined with getAfter()'s post-batch createdBy check, the two
```

**`firestore.rules:535-543`** — tags: CR-01 — qualifier: 41-REVIEW

_Summary:_ 41-REVIEW CR-01: was `isSignedIn()` with no org check. Phase 41's adoption logic (`pickAdoptableToken`/`ensureShareLink` in src/stores/services.ts) reads and TRUSTS the `orgId`/`createdAt` of arbitrary pre-existing share...

```js
      // 41-REVIEW CR-01: was `isSignedIn()` with no org check. Phase 41's
      // adoption logic (`pickAdoptableToken`/`ensureShareLink` in
      // src/stores/services.ts) reads and TRUSTS the `orgId`/`createdAt` of
      // arbitrary pre-existing shareTokens docs to decide a service's
      // permanent public link, so a signed-in non-editor (or non-member,
      // given a known serviceId) could plant a document that gets adopted as
      // the official token. Every legitimate create (writeSharePayload,
      // reached only via ensureShareLink/maybeRefreshShareLink from
      // editor-gated UI actions) always writes the real orgId, so this is not
```

**`firestore.rules:547-552`** — tags: CR-01 — qualifier: unqualified

_Summary:_ R077/CR-01: refreshed in place by an editor of the owning org so the frozen snapshot never goes stale — mirrors quarterShares/serviceShares' org-scoped idiom verbatim.

```js
      // R077/CR-01: refreshed in place by an editor of the owning org so the
      // frozen snapshot never goes stale — mirrors quarterShares/serviceShares'
      // org-scoped idiom verbatim. The equality guard makes orgId immutable, so
      // a share can never be reassigned to another org. isSignedIn() alone is
      // deliberately rejected: it would reintroduce the exact cross-org-overwrite
      // bug (T-41-04) already fixed for quarterShares/serviceShares (CR-01).
```

**`firestore.rules:560-565`** — tags: CR-01 — qualifier: unqualified

_Summary:_ Persistent share-link index (R076): token + provenance only, keyed by serviceId.

```js

    // Persistent share-link index (R076): token + provenance only, keyed by
    // serviceId. Org-editor-scoped CRUD, NEVER publicly readable — this is an
    // internal index, not a link ever handed to anyone (unlike shareTokens /
    // serviceShares above it, which ARE the public payload). orgId is immutable
    // on update, mirroring the CR-01 idiom.
```

**`firestore.rules:587-592`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Org slug claims: public read, org-editor-scoped create-only (first-writer-wins). Reassignment abandons a slug, never reclaims it — no update/delete allowed.

```js

    // Org slug claims: public read, org-editor-scoped create-only (first-writer-wins).
    // Reassignment abandons a slug, never reclaims it — no update/delete allowed. WR-01:
    // isSignedIn() alone let any authenticated user claim a slug for an arbitrary orgId
    // (slug-squatting), so create requires the caller to be an editor of the orgId in the
    // payload.
```

**`firestore.rules:610-616`** — tags: CR-01 — qualifier: unqualified

_Summary:_ Memorable-URL quarter shares: public read, org-editor-scoped create/update (overwritten in place on every finalize, unlike frozen shareTokens).

```js

    // Memorable-URL quarter shares: public read, org-editor-scoped create/update
    // (overwritten in place on every finalize, unlike frozen shareTokens). CR-01: shareId is
    // a guessable, deterministic string (`${slug}__q${N}-${year}`), so isSignedIn() alone let
    // any authenticated user of ANY org overwrite another org's public share doc. Both create
    // and update require the caller to be an editor of the orgId embedded in the doc, and
    // update additionally forbids changing orgId (no reassigning a share to a different org).
```

### `functions/src/appConfig.ts`

**`functions/src/appConfig.ts:111-122`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Mirrors readNumericKnob's zero-vs-falsy discipline (index.ts's documented WR-01 fix: `Number(x) || fallback` silently discards a genuine `0`), adapted for a Firestore field typed `unknown` instead of always-a-string env...

```ts

/**
 * Mirrors readNumericKnob's zero-vs-falsy discipline (index.ts's documented
 * WR-01 fix: `Number(x) || fallback` silently discards a genuine `0`),
 * adapted for a Firestore field typed `unknown` instead of always-a-string
 * env var. A real, in-range value -- including 0 -- is honored; only an
 * absent/blank/non-numeric/wrong-type/negative value falls back. Every knob
 * this guards (rate limits, retention windows, caps) is fail-OPEN-but-CAPPED
 * (R184): a negative number is nonsensical for all of them (no such thing as
 * -1 requests/min or -1 days of retention), so it is treated as malformed
 * input rather than honored, the same as NaN/Infinity.
 */
```

### `functions/src/backfillLastUsed.ts`

**`functions/src/backfillLastUsed.ts:79-93`** — tags: WR-03 — qualifier: 84-REVIEW

_Summary:_ The single shared calendar-date parse convention for a `Service.date` `"YYYY-MM-DD"` string.

```ts
/**
 * The single shared calendar-date parse convention for a `Service.date`
 * `"YYYY-MM-DD"` string. BOTH the live store adapter (`services.ts`) and the
 * 84-02 backfill must use this exact expression so the `Timestamp` each
 * environment writes is identical.
 *
 * WR-03 (84-REVIEW): parses as UTC midnight (`Date.UTC`) rather than the
 * previous `new Date(\`${date}T00:00:00\`)`, which resolved "local midnight"
 * against whichever timezone the running process defaulted to -- the end
 * user's browser on the client, but the HOST MACHINE's ambient `TZ` for this
 * Admin-SDK script (a CI runner, cloud shell, or Docker container commonly
 * defaults to UTC). Two environments computing a different midnight for the
 * identical `"YYYY-MM-DD"` string would make `Timestamp.isEqual` never
 * converge -- the idempotency check would "correct" an already-correct
 * song's `lastUsedAt` forever, off by a fixed offset, with no error raised.
```

**`functions/src/backfillLastUsed.ts:145-152`** — tags: WR-02 — qualifier: 84-REVIEW

_Summary:_ WR-02 (84-REVIEW): service doc ids excluded from the MAX computation because `date` was missing or not a `YYYY-MM-DD` string -- distinct from `failed` (which is per-SONG).

```ts
  /**
   * WR-02 (84-REVIEW): service doc ids excluded from the MAX computation
   * because `date` was missing or not a `YYYY-MM-DD` string -- distinct from
   * `failed` (which is per-SONG). A non-empty list here is a materially
   * different, worth-investigating condition ("this org has a service with
   * no/bad date") that a human should see before `--apply`, not something
   * that should silently fall through to a per-song NaN Timestamp failure.
   */
```

**`functions/src/backfillLastUsed.ts:176-183`** — tags: WR-02 — qualifier: 84-REVIEW

_Summary:_ WR-02 (84-REVIEW): a missing/malformed `date` used to fall through as `data.date ?? ""`, letting a bogus service silently feed `serviceDateToMillis("")` -> NaN -> a `Timestamp.fromMillis(NaN)` attempt, "safely" caught on...

```ts

  // WR-02 (84-REVIEW): a missing/malformed `date` used to fall through as
  // `data.date ?? ""`, letting a bogus service silently feed
  // `serviceDateToMillis("")` -> NaN -> a `Timestamp.fromMillis(NaN)`
  // attempt, "safely" caught only incidentally by the per-song try/catch
  // below and indistinguishable from an unrelated song-doc read failure.
  // Explicitly excluded and reported here instead, BEFORE any song is
  // classified against it.
```

### `functions/src/backfillOrgClaims.ts`

**`functions/src/backfillOrgClaims.ts:211-219`** — tags: WR-01 — qualifier: unqualified

_Summary:_ decision.action is "skip" (reason "not-primary-org" or "already-current") or "clear" (not reachable from this call site: decideMembershipClaim only ever returns 'clear' when documentExists is false (WR-01), and decidePri...

```ts

      // decision.action is "skip" (reason "not-primary-org" or "already-current")
      // or "clear" (not reachable from this call site: decideMembershipClaim only
      // ever returns 'clear' when documentExists is false (WR-01), and
      // decidePrimaryClaim always passes documentExists: true). Either way the
      // primary keys are unaffected, but `orgs` still needs its own
      // skip-if-matching check -- this is what lets a non-primary-org membership
      // (or a primary membership whose claim is already current) still pick up a
      // changed orgs map.
```

**`functions/src/backfillOrgClaims.ts:237-240`** — tags: WR-02 — qualifier: 73-REVIEW.md

_Summary:_ WR-02 (73-REVIEW.md): give the ~1000-byte custom-claims cap's auth/claims-too-large error a distinguishable, greppable log line -- mirrors syncOrgMembershipClaimHandler's identical carve-out.

```ts
      // WR-02 (73-REVIEW.md): give the ~1000-byte custom-claims cap's
      // auth/claims-too-large error a distinguishable, greppable log line --
      // mirrors syncOrgMembershipClaimHandler's identical carve-out. Still
      // recorded in `failed` exactly as before; only the logging changes.
```

**`functions/src/backfillOrgClaims.ts:264-278`** — tags: WR-02 — qualifier: unqualified

_Summary:_ node lib/backfillOrgClaims.js # dry run (default) node lib/backfillOrgClaims.js --apply # writes claims for real Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth application-default login`, exactly...

```ts
//   node lib/backfillOrgClaims.js            # dry run (default)
//   node lib/backfillOrgClaims.js --apply    # writes claims for real
//
// Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or
// `gcloud auth application-default login`, exactly like any other Admin SDK script.
//
// WR-02: the whole body is wrapped in try/catch. The initial
// `getFirestore().collectionGroup('members').get()` inside backfillOrgMembershipClaims
// is NOT covered by that function's own per-uid try/catch (only the loop body is) --
// a rejection there (bad/expired credentials, wrong project, network failure) previously
// propagated out of this IIFE as a raw unhandled rejection instead of the script's own
// diagnostic output, with no process.exitCode set. The owner runs this by hand against
// production credentials, so a readable "aborted before processing any account" message
// plus a non-zero exit code mirrors the per-account failure reporting already present.
//
```

### `functions/src/bootstrapSuperAdmin.ts`

**`functions/src/bootstrapSuperAdmin.ts:16-30`** — tags: Pitfall — qualifier: unqualified

_Summary:_ requires no pre-existing super-admin. RESOLVES BY EMAIL: exactly like backfillOrgClaims.ts and setSuperAdminClaimHandler, the target is resolved email -> uid via getAuth().getUserByEmail(), never a hand-typed uid.

```ts
// requires no pre-existing super-admin.
//
// RESOLVES BY EMAIL: exactly like backfillOrgClaims.ts and setSuperAdminClaimHandler,
// the target is resolved email -> uid via getAuth().getUserByEmail(), never a
// hand-typed uid.
//
// WRITES BOTH THE DOC AND THE CLAIM DIRECTLY (T-68-06, Pitfall 6): unlike the
// in-console grant path (which only ever writes the superAdmins/{uid} document
// and relies on the syncSuperAdminClaim trigger to react), this script calls
// mergeAndSetCustomClaims directly in addition to writing the document. The
// very first grant must not depend on the trigger being deployed yet -- if the
// owner runs this bootstrap before `firebase deploy --only functions` has ever
// shipped syncSuperAdminClaim, the doc-only path would leave the claim unset
// forever (no trigger exists yet to react to the write). Writing both here
// means the claim lands regardless of deploy ordering; if the trigger IS
```

**`functions/src/bootstrapSuperAdmin.ts:103-116`** — tags: WR-02 — qualifier: unqualified

_Summary:_ node lib/bootstrapSuperAdmin.js --email owner@example.com # dry run (default) node lib/bootstrapSuperAdmin.js --email owner@example.com --apply # writes for real Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or...

```ts
//   node lib/bootstrapSuperAdmin.js --email owner@example.com             # dry run (default)
//   node lib/bootstrapSuperAdmin.js --email owner@example.com --apply     # writes for real
//
// Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or
// `gcloud auth application-default login`, exactly like backfillOrgClaims.ts.
//
// The whole body is wrapped in try/catch, mirroring runBackfillCli's WR-02 --
// a rejection (bad/expired credentials, wrong project, unknown email, network
// failure) prints a readable diagnostic and sets a non-zero exit code instead
// of propagating as a raw unhandled rejection.
//
// Extracted into a named, exported function (mirrors runBackfillCli's own
// separation from its require.main guard) so this top-level error path is
// itself unit-testable without requiring require.main === module.
```

### `functions/src/claimsHelpers.ts`

**`functions/src/claimsHelpers.ts:17-31`** — tags: WR-02 — qualifier: 68-REVIEW.md

_Summary:_ two call sites this module was extracted to fix. No try/catch here -- these helpers throw through.

```ts
// two call sites this module was extracted to fix.
//
// No try/catch here -- these helpers throw through. Callers (the trigger
// handlers) wrap the call and convert a failure into a { action: "failed" }
// outcome rather than rethrowing out of a Firestore trigger.
//
// KNOWN LIMITATION -- residual concurrent-write race (WR-02, 68-REVIEW.md):
// both helpers are read-then-write (getUser -> setCustomUserClaims) with no
// compare-and-swap or transaction. This phase's fix closes the *sequential*
// replace-clobbers-unrelated-key hazard described above, but it does NOT
// close a *concurrent* race: if syncOrgMembershipClaim and syncSuperAdminClaim
// both fire for the SAME uid within the same short window (e.g. an owner
// grants super-admin to a user at nearly the same moment that user's org role
// changes), both handlers read claims independently and whichever
// setCustomUserClaims call lands second overwrites the first with a claims
```

**`functions/src/claimsHelpers.ts:74-85`** — tags: WR-01 — qualifier: 73-REVIEW.md

_Summary:_ The atomic counterpart to calling clearClaimKeys then mergeAndSetCustomClaims as two SEPARATE writes (73-REVIEW.md WR-01).

```ts

/**
 * The atomic counterpart to calling clearClaimKeys then mergeAndSetCustomClaims
 * as two SEPARATE writes (73-REVIEW.md WR-01). Reads current claims ONCE,
 * removes `opts.clear` keys and applies `opts.set` on top -- all in memory --
 * then issues a SINGLE setCustomUserClaims call. This closes the TOCTOU window
 * a two-write clear+set sequence opens: a token minted between the two writes
 * could carry a claim state that was never a deliberate end-state (e.g.
 * cleared primary `orgId`/`role` keys but a still-stale `orgs` map that lists
 * the org whose membership was just removed).
 *
 * Same null-vs-{} handling as clearClaimKeys: the Admin SDK requires `null`
```

**`functions/src/claimsHelpers.ts:100-113`** — tags: Pitfall — qualifier: 76-RESEARCH.md

_Summary:_ Patches (or deletes) ONE key inside a NESTED map claim (e.g. `deactivatedOrgs[orgId]`), preserving every other top-level claim key AND every other key already inside that same nested map -- mirrors `mergeSetAndClearCusto...

```ts

/**
 * Patches (or deletes) ONE key inside a NESTED map claim (e.g.
 * `deactivatedOrgs[orgId]`), preserving every other top-level claim key AND
 * every other key already inside that same nested map -- mirrors
 * `mergeSetAndClearCustomClaims`'s TOCTOU-safe shape (76-RESEARCH.md Pitfall
 * 3): a SINGLE `getUser` read, an in-memory patch of the ONE nested key, then
 * a SINGLE `setCustomUserClaims` write. Never a bare replace of the nested
 * map -- `mergeAndSetCustomClaims(uid, { deactivatedOrgs: {...} })` would
 * REPLACE the whole nested object, silently wiping a sibling org's
 * deactivated-flag for a user who belongs to more than one deactivated org.
 *
 * `value === true` sets `nested[nestedKey] = true`. `value === undefined`
 * deletes `nested[nestedKey]` -- deleting the LAST remaining nested key
```

**`functions/src/claimsHelpers.ts:136-143`** — tags: WR-02 — qualifier: 73-REVIEW.md

_Summary:_ Detects the Firebase Admin SDK's `auth/claims-too-large` error -- thrown by `setCustomUserClaims` when the serialized custom-claims object exceeds the ~1000-byte cap (73-REVIEW.md WR-02).

```ts

/**
 * Detects the Firebase Admin SDK's `auth/claims-too-large` error -- thrown by
 * `setCustomUserClaims` when the serialized custom-claims object exceeds the
 * ~1000-byte cap (73-REVIEW.md WR-02). Shared by every claim-write call site
 * so a claims-too-large failure logs a distinguishable, greppable line rather
 * than being indistinguishable from any other transient Auth API failure.
 */
```

### `functions/src/index.ts`

**`functions/src/index.ts:91-112`** — tags: Pitfall — qualifier: 45-RESEARCH.md

_Summary:_ NLT auth travels as a `key` QUERY PARAMETER, not a header — unlike the esv/ anthropic branches, which only ever rewrite `headers`.

```ts
/**
 * NLT auth travels as a `key` QUERY PARAMETER, not a header — unlike the esv/
 * anthropic branches, which only ever rewrite `headers`. `upstreamUrl` is built
 * once as a `const` before any service-specific branching runs (see below), so
 * this is a small pure helper rather than an inline mutation, both to avoid
 * restructuring that `const` into a `let` inline in the handler body and to be
 * unit-testable in isolation (Pitfall 6 / Assumption A2 — the `api` onRequest
 * handler otherwise has zero existing test precedent).
 *
 * For `esv`/`anthropic` (and any other service), the URL is returned
 * byte-unchanged — their secrets are injected into `headers` elsewhere, never
 * into the URL.
 *
 * For `nlt`, the `key` search param is always SET (overwritten, never merged)
 * to the server-held secret — a client-supplied `key=attacker` on the inbound
 * request must never survive onto the outbound URL (T-45-11, spoofing/quota
 * theft). This holds even though NLT's own upstream does not actually enforce
 * the key (verified live, 45-RESEARCH.md Pitfall 4: a missing or garbage key
 * still returns HTTP 200 with correct content) — the point of injecting here
 * is keeping NLT_API_KEY out of the client bundle, independent of whether the
 * upstream enforces it. Do NOT "fix" this by removing the injection.
 */
```

**`functions/src/index.ts:201-209`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01 fix: parses an env-var numeric knob so an operator's explicit `0` (e.g. an emergency full-stop on `AI_RATELIMIT_MAX_PER_MIN=0`) is honored rather than discarded.

```ts

/**
 * WR-01 fix: parses an env-var numeric knob so an operator's explicit `0`
 * (e.g. an emergency full-stop on `AI_RATELIMIT_MAX_PER_MIN=0`) is honored
 * rather than discarded. `Number(x) || fallback` treats a genuinely-parsed
 * `0` as falsy and silently replaces it with the default -- the opposite of
 * the caller's intent. Only an unset, blank/whitespace-only, or non-numeric
 * value falls back to `fallback`.
 */
```

**`functions/src/index.ts:232-241`** — tags: WR-02 — qualifier: unqualified

_Summary:_ R164: an explicit maxInstances ceiling motivated by the highest-cost route (the anthropic branch of `api` spends real money per call).

```ts

// R164: an explicit maxInstances ceiling motivated by the highest-cost route
// (the anthropic branch of `api` spends real money per call). NOTE (WR-02,
// accepted as won't-fix): `maxInstances` is a Cloud Functions v2 /
// Cloud Run FUNCTION-level setting on the single shared `onRequest` below --
// it caps the whole `api` function (esv/nlt/planningcenter traffic included),
// not just the anthropic upstream. That's intentional: esv/nlt/planningcenter
// also cost money to run, and there is no way to scope maxInstances to one
// upstream within a single function. Env-overridable so the owner can tune
// fan-out without a logic redeploy.
```

**`functions/src/index.ts:299-307`** — tags: WR-03 — qualifier: unqualified

_Summary:_ WR-03: reject a streamed request outright rather than forward it.

```ts
  // WR-03: reject a streamed request outright rather than forward it. The
  // aiUsage ledger write below parses the upstream response body as a single
  // JSON object (`JSON.parse(body) as { usage?: AnthropicUsage }`) -- an SSE
  // stream's raw text is not valid JSON, so a `stream: true` request would
  // still be billed/rate-limited but silently never recorded in the ledger
  // (the `catch (ledgerErr)` swallows the JSON.parse throw). The server
  // dictates non-streaming so every proxied request records a usage entry
  // (R163), matching the "reject, don't silently trust" posture already used
  // for `model` above.
```

**`functions/src/index.ts:483-497`** — tags: WR-01 — qualifier: 67-REVIEW.md

_Summary:_ check-then-increment, no double-count on a rejected send) but on ONE top-level `orgEmailCounters` doc keyed `${orgId}__day__${dayWindow}`, and increments by an arbitrary `count` -- the number of emails THIS send is about...

```ts
 * check-then-increment, no double-count on a rejected send) but on ONE
 * top-level `orgEmailCounters` doc keyed `${orgId}__day__${dayWindow}`, and
 * increments by an arbitrary `count` -- the number of emails THIS send is
 * about to attempt -- rather than always by 1 (a single 50-recipient send
 * costs 50 against the quota, not 1). Rejects when the PROJECTED total
 * (`dayCount + count`) would EXCEED the limit, not merely when `dayCount`
 * already meets it (WR-01, 67-REVIEW.md) -- because `count` can be well
 * above 1, a check against only the pre-send count could let one accepted
 * send push the day's total past `limit` by up to `count - 1`. On rejection,
 * returns not-allowed WITHOUT incrementing -- the org's quota is not
 * consumed by a send that never happens. Kept TOP-LEVEL (not nested under
 * organizations/{orgId}) for the same T-37-15 reason as aiRateLimits/aiUsage: the firestore.rules
 * catch-all deny already blocks client reads, so no rules change is needed.
 *
 * Deliberately does NOT catch its own Firestore errors -- the caller
```

**`functions/src/index.ts:514-523`** — tags: WR-01 — qualifier: 67-REVIEW.md

_Summary:_ WR-01 (67-REVIEW.md): PROJECTED check, not a check against the pre-send count.

```ts

    // WR-01 (67-REVIEW.md): PROJECTED check, not a check against the
    // pre-send count. `count` (this send's recipient count, up to
    // MESSAGE_MAX_RECIPIENTS) can be far more than 1, so comparing only
    // `dayCount` to `limit` (the checkAndConsumeRateLimit shape, correct
    // there because it always increments by exactly 1) let an accepted send
    // push the day total past `limit` by up to `count - 1`. Rejecting when
    // the PROJECTED total would exceed the limit keeps the daily total from
    // ever exceeding `limit`, at the cost of possibly rejecting a send that
    // would fit under a smaller one -- the correct tradeoff for a hard cap.
```

**`functions/src/index.ts:656-667`** — tags: CR-01 — qualifier: 82-REVIEW

_Summary:_ -- a disabled org must never reach even the cheapest of those checks. decodedCaller is always non-null here (anthropic is in SECRET_INJECTED, so the auth gate above already returned 401 for a null caller).

```ts
      // -- a disabled org must never reach even the cheapest of those checks.
      // decodedCaller is always non-null here (anthropic is in
      // SECRET_INJECTED, so the auth gate above already returned 401 for a
      // null caller). resolveOrgId is used ONLY as a pointer to which org --
      // see checkOrgAiEnablement's own doc comment for why the live get()
      // inside it, not the claim payload, is the enforcement source.
      // CR-01 (82-REVIEW): an unresolvable org context must be a DENIAL, not
      // a skip. This proxy is a paid, per-org-gated resource -- a caller
      // whose token carries no `orgId` claim (an org-less authenticated
      // user, or a super-admin who entered an org with no synced membership
      // doc, R226) must never fall through to the Anthropic fetch below
      // un-gated.
```

**`functions/src/index.ts:678-689`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Cached form (no {fresh:true}) -- the api handler is a hot request path (R183); getFirestore() is already called later in this same handler (checkAndConsumeRateLimit/writeUsageLedger), so this is no new Firestore dependen...

```ts

      // Cached form (no {fresh:true}) -- the api handler is a hot request
      // path (R183); getFirestore() is already called later in this same
      // handler (checkAndConsumeRateLimit/writeUsageLedger), so this is no
      // new Firestore dependency class, only an additional cached read.
      // Scoped to the anthropic branch only (review WR-01): esv/nlt/
      // planningcenter have no relationship to AI cost controls and must
      // stay Firestore-independent, exactly as before this phase. The read
      // itself is fail-open (same guardrail-not-security-control rationale
      // as the rate limiter below): a Firestore hiccup degrades the
      // anthropic route to DEFAULT_APP_CONFIG's limits rather than failing
      // the request outright.
```

**`functions/src/index.ts:850-864`** — tags: Pitfall — qualifier: 21-RESEARCH.md

_Summary:_ Firestore read (organizations/{orgId}/members/{uid}) -- the client-declared orgId is never trusted alone, matching firestore.rules' isOrgMember pattern.

```ts
 *   Firestore read (organizations/{orgId}/members/{uid}) -- the client-declared
 *   orgId is never trusted alone, matching firestore.rules' isOrgMember pattern.
 * - Returns Storage PATHS for extracted images (never signed URLs); the client
 *   resolves getDownloadURL() under storage.rules' org gate.
 * - On any parse failure, throws a friendly HttpsError and never deletes the
 *   source object at storagePath -- this function never issues a delete call
 *   at all, on any path (CONTEXT D004 / 21-RESEARCH.md Pitfall 5).
 * - ★ R062 additive write: on a successful parse, also queues a render by
 *   writing organizations/{orgId}/pptxRenders/{importId} (status "pending").
 *   This write is wrapped in its own nested try/catch and can NEVER fail this
 *   call -- a queue-write failure is swallowed and logged, not surfaced to
 *   the caller, because the parsed text layer above is already a complete,
 *   successful result and a render is only an enhancement over it. This
 *   handler never awaits or imports invokeRenderService; rendering happens
 *   asynchronously via a separate trigger (37-04), never on this onCall path.
```

**`functions/src/index.ts:2067-2069`** — tags: Pitfall — qualifier: unqualified

_Summary:_ NOTE: orphanCount, NOT deletedObjectCount -- deletedObjectCount only increments on the live-delete branch and is always 0 in forced-dry-run mode for this handler (71-PATTERNS.md Pitfall 1).

```ts
      // NOTE: orphanCount, NOT deletedObjectCount -- deletedObjectCount only
      // increments on the live-delete branch and is always 0 in forced-dry-run
      // mode for this handler (71-PATTERNS.md Pitfall 1).
```

**`functions/src/index.ts:2192-2194`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Load the org settings for THIS org (cached). Read settings.messaging.* and settings.timezone -- NOT messaging.* (research Pitfall 2).

```ts

      // Load the org settings for THIS org (cached). Read settings.messaging.*
      // and settings.timezone -- NOT messaging.* (research Pitfall 2).
```

**`functions/src/index.ts:2777-2791`** — tags: Pitfall — qualifier: 59-RESEARCH.md

_Summary:_ The send half of the queue-then-trigger path: an onDocumentCreated trigger on .../messages/{messageId}, the ONLY Function bound to RESEND_API_KEY.

```ts
// The send half of the queue-then-trigger path: an onDocumentCreated trigger
// on .../messages/{messageId}, the ONLY Function bound to RESEND_API_KEY. Its
// handler body (sendQueuedMessageHandler) is exported separately from the
// wrapper (requestPptxRenderHandler precedent) so the idempotency + send logic
// is directly unit-tested with Resend mocked. It runs a transactional
// queued->sending claim (GENUINELY NEW code — the PPTX precedent has NO status
// claim, 59-RESEARCH.md Pitfall 1), re-resolves recipients server-side (never
// the client's stored list — Anti-Pattern 1), renders per-recipient tokens
// (R139), sends once per recipient (per-recipient try/catch so one bad address
// is a failed recipient, not an aborted batch), writes one recipients/{id} doc
// per recipient, rolls up deliveryCounts, and flips the message status.

// SERVICE_SHARE_BASE_URL (the app's public share-link base origin) now lives in
// ./params -- imported and re-exported at the top of this file (moved so
// adminEmail.ts can reuse it without a circular import).
```

**`functions/src/index.ts:2810-2816`** — tags: Pitfall — qualifier: 59-RESEARCH.md

_Summary:_ (Google-managed, no DNS access). fromDisplayName + bareEmailAddress (the pure From-header helpers) now live in ./params -- imported and re-exported at the top of this file (moved so adminEmail.ts can reuse them without a...

```ts
// (Google-managed, no DNS access).

// fromDisplayName + bareEmailAddress (the pure From-header helpers) now live in
// ./params -- imported and re-exported at the top of this file (moved so
// adminEmail.ts can reuse them without a circular import).

/** Resend tag names AND values allow only these chars (59-RESEARCH.md Pitfall 3). */
```

**`functions/src/index.ts:2975-2977`** — tags: Pitfall — qualifier: unqualified

_Summary:_ The three message-level ids become Resend tags (Pitfall 3). If any is not tag-safe the send is unsafe for the whole message — fail closed.

```ts

  // The three message-level ids become Resend tags (Pitfall 3). If any is not
  // tag-safe the send is unsafe for the whole message — fail closed.
```

**`functions/src/index.ts:3012-3016`** — tags: CR-01 — qualifier: 85-REVIEW.md

_Summary:_ Read-time compat shim (R250, mirrors src/stores/roster.ts's onSnapshot shim): the narrowed RoleGroup drops 'vocals' as a team identity, but existing per-org roles may still be stored with group 'vocals' from before Phase...

```ts
  // Read-time compat shim (R250, mirrors src/stores/roster.ts's onSnapshot shim): the
  // narrowed RoleGroup drops 'vocals' as a team identity, but existing per-org roles may
  // still be stored with group 'vocals' from before Phase 85. Coerce those to
  // { group: 'band', vocal: true } on read ONLY — no Firestore write migration — so the
  // server send list agrees with the client's "Reaches N" estimate (CR-01, 85-REVIEW.md).
```

**`functions/src/index.ts:3093-3106`** — tags: WR-02 — qualifier: 67-REVIEW.md

_Summary:_ R171: per-org daily Resend send quota -- a fixed-window Admin-SDK counter backstopping a loop/cron fan-out. Also checked BEFORE `new Resend(...)` / the send loop, so an over-quota message sends zero emails.

```ts
  // R171: per-org daily Resend send quota -- a fixed-window Admin-SDK
  // counter backstopping a loop/cron fan-out. Also checked BEFORE `new
  // Resend(...)` / the send loop, so an over-quota message sends zero
  // emails. Skipped entirely for a zero-recipient send -- nothing to
  // consume, and an org already at quota should not block an empty send.
  //
  // WR-02 (67-REVIEW.md): wrapped in try/catch and failed OPEN on a thrown
  // Firestore error, matching this file's own documented cost-guardrail
  // fail-open precedent for checkAndConsumeRateLimit (`// Fail OPEN: the
  // limiter is a cost guardrail, not a security control`, locked decision,
  // 65-CONTEXT.md). By this point the message doc has already been claimed
  // `queued` -> `sending`, so a fail-CLOSED error here would leave the
  // message stuck with no terminal status and no retry -- worse than
  // letting one send through uncounted against the quota.
```

### `functions/src/inviteOnboarding.ts`

**`functions/src/inviteOnboarding.ts:32-43`** — tags: Pitfall — qualifier: unqualified

_Summary:_ never stranded (R290, R291). The onboarding.emailsEnabled owner toggle (Plan 99-01) is read via the existing TTL-cached getAppConfig(db) and gates BOTH branches before any Auth or Resend call (R293).

```ts
//    never stranded (R290, R291).
//
// The onboarding.emailsEnabled owner toggle (Plan 99-01) is read via the
// existing TTL-cached getAppConfig(db) and gates BOTH branches before any
// Auth or Resend call (R293).
//
// DEFERRED (RESEARCH Pitfall 1): the per-org email quota
// (checkAndConsumeOrgEmailQuota) is NOT folded in here -- it lives in
// index.ts, which already imports this module for its re-export, so
// importing it back would be a circular import. Left as a documented future
// lever (see the threat register's T-99-05, disposition "accept").
```

**`functions/src/inviteOnboarding.ts:66-72`** — tags: Pitfall — qualifier: 99-RESEARCH.md

_Summary:_ Resolve the app's usable share/sign-in base URL, or '' when unconfigured.

```ts

/**
 * Resolve the app's usable share/sign-in base URL, or '' when unconfigured.
 * Fresh module-private copy, verbatim shape ported from
 * functions/src/adminEmail.ts:50-54 -- resolveAppBaseUrl is module-private
 * there too (99-RESEARCH.md Pitfall 5), so it cannot be imported.
 */
```

**`functions/src/inviteOnboarding.ts:78-85`** — tags: WR-01 — qualifier: 99-REVIEW

_Summary:_ WR-01 (99-REVIEW): collapse any CR/LF out of a header-bound value (the email subject) before it reaches the Resend send.

```ts

/**
 * WR-01 (99-REVIEW): collapse any CR/LF out of a header-bound value (the email
 * subject) before it reaches the Resend send. `orgName` is org-doc-sourced
 * (super-admin controlled) so the risk is low, but this applies the SAME
 * header-injection defense the codebase already documents for the From display
 * name (params.ts's fromDisplayName) consistently to the subject line.
 */
```

**`functions/src/inviteOnboarding.ts:202-211`** — tags: CR-01 — qualifier: 99-REVIEW

_Summary:_ CR-01 (99-REVIEW): bind every provisioning + send to a REAL pending invite record.

```ts

  // CR-01 (99-REVIEW): bind every provisioning + send to a REAL pending invite
  // record. This callable creates Firebase Auth accounts and emails
  // caller-supplied addresses; without this gate an org editor could invoke it
  // directly with attacker-chosen emails to send convincing "invited to {org}"
  // messages -- carrying genuine password-reset links -- to arbitrary third
  // parties from our own Resend sending domain. TeamView.onInvite writes the
  // authoritative invite doc (same trim().toLowerCase() normalization) BEFORE
  // calling this function, so the doc's absence means this is not a legitimate
  // invite send. Ties the blast radius to invites the org actually created.
```

**`functions/src/inviteOnboarding.ts:257-259`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Non-Google branch: resolve-or-create the Auth user FIRST (Pitfall 2 -- generatePasswordResetLink requires the user to already exist).

```ts

  // Non-Google branch: resolve-or-create the Auth user FIRST (Pitfall 2 --
  // generatePasswordResetLink requires the user to already exist).
```

**`functions/src/inviteOnboarding.ts:285-288`** — tags: WR-02 — qualifier: 99-REVIEW

_Summary:_ WR-02 (99-REVIEW): surface a friendly HttpsError instead of the raw Firebase error object (which would reach the client as an opaque 'internal' with leaked provider detail) for any non-user-not-found lookup failure.

```ts
      // WR-02 (99-REVIEW): surface a friendly HttpsError instead of the raw
      // Firebase error object (which would reach the client as an opaque
      // 'internal' with leaked provider detail) for any non-user-not-found
      // lookup failure.
```

### `functions/src/orgDeletion.ts`

**`functions/src/orgDeletion.ts:14-37`** — tags: Pitfall — qualifier: 77-RESEARCH.md

_Summary:_ operation in this codebase. It is gated by the SAME assertSuperAdminCaller dual re-verification every other owner-console callable uses (T-77-01), plus two independent server-side re-checks the client cannot bypass: - th...

```ts
// operation in this codebase. It is gated by the SAME assertSuperAdminCaller
// dual re-verification every other owner-console callable uses (T-77-01),
// plus two independent server-side re-checks the client cannot bypass:
//   - the org must already be deactivated (active === false) -- T-77-06
//   - confirmName must match the org's SERVER-STORED name, exactly -- T-77-02
//
// Cascade order (77-RESEARCH.md Cascade Order / Pattern 2 / Pitfall 1):
// every cross-reference this handler needs (member uids, inviteLookup docs,
// the orgNames guard read, and the 5 extra orgId-keyed collections) is READ
// and held in memory BEFORE any delete fires -- recursiveDelete/deleteFiles
// remove the very data those reads depend on, so reversing this order would
// silently orphan every affected user's `orgIds` claim (T-77-03/T-77-08).
//
// Deliberately OUT OF SCOPE (documented, not an oversight): `aiUsage` and
// `aiRateLimits` are a platform cost-observability ledger, not tenant
// content -- 77-RESEARCH.md Open Question 2 recommends leaving them alone.

/**
 * The 5 top-level collections that store `orgId` as a plain document field
 * (NOT nested under `organizations/{orgId}`, so `recursiveDelete` cannot see
 * them -- 77-RESEARCH.md Pitfall 2 / T-77-07). Exported as a single source of
 * truth so `orgDeletion.test.ts` can iterate this exact list rather than
 * duplicating the literal.
 */
```

**`functions/src/orgDeletion.ts:121-128`** — tags: WR-02 — qualifier: 77-RESEARCH.md, 77-REVIEW.md

_Summary:_ T-77-02: the client's echoed confirmName proves nothing on its own -- compare against the SERVER's own stored name, case-sensitive (77-RESEARCH.md Assumption A1).

```ts

  // T-77-02: the client's echoed confirmName proves nothing on its own --
  // compare against the SERVER's own stored name, case-sensitive (77-RESEARCH.md
  // Assumption A1). WR-02 (77-REVIEW.md): trim BOTH sides -- onboardOrganizationHandler
  // stores `name` verbatim, untrimmed, so a stray leading/trailing space on a
  // legacy/foreign-written org must not permanently strand it: the dialog's
  // own `.trim()` on typed input makes it structurally impossible to type a
  // trailing/leading space back in.
```

**`functions/src/orgDeletion.ts:138-141`** — tags: Pitfall — qualifier: unqualified

_Summary:_ --- READ phase (Pattern 2 / Pitfall 1): everything below MUST complete before any delete/recursiveDelete/deleteFiles fires. -----------------

```ts

  // --- READ phase (Pattern 2 / Pitfall 1): everything below MUST complete
  // before any delete/recursiveDelete/deleteFiles fires. -----------------
```

**`functions/src/orgDeletion.ts:187-192`** — tags: Pitfall — qualifier: 77-RESEARCH.md

_Summary:_ --- Storage: every object under orgs/{orgId}/ (media, backgrounds, pptx-imports, rendered, ...) -- a single prefix covers all of them (77-RESEARCH.md Standard Stack).

```ts

  // --- Storage: every object under orgs/{orgId}/ (media, backgrounds,
  // pptx-imports, rendered, ...) -- a single prefix covers all of them
  // (77-RESEARCH.md Standard Stack). force:true so a transient per-object
  // failure never aborts the whole sweep (Pitfall 4). ---------------------
```

**`functions/src/orgDeletion.ts:214-229`** — tags: WR-01 — qualifier: 77-REVIEW.md

_Summary:_ WR-01 (77-REVIEW.md): this cascade is comparably or more expensive than parsePptx (functions/src/index.ts's { memory: "1GiB", timeoutSeconds: 120 }) -- 5 concurrent READ queries, N sequential batch commits, a full Storag...

```ts

// WR-01 (77-REVIEW.md): this cascade is comparably or more expensive than
// parsePptx (functions/src/index.ts's { memory: "1GiB", timeoutSeconds: 120 })
// -- 5 concurrent READ queries, N sequential batch commits, a full Storage
// prefix sweep, and a recursiveDelete over every subcollection at every
// depth. timeoutSeconds: 540 is the v2 callable maximum, giving the sweep
// generous headroom to complete well within budget for a single church.
//
// Resumability boundary (documented, not solved here -- WR-01 scope):
// the cross-ref batch deletes + Storage sweep are each idempotent, so a
// retry against that same state re-runs cleanly WHILE the org doc still
// exists (see "idempotent retry" in orgDeletion.test.ts). A timeout that
// fires mid-recursiveDelete, AFTER the org doc itself is gone, is NOT
// resumable -- there is no code path to resume a cascade once the parent
// doc no longer exists. A generous timeout is the mitigation; building a
// not-found-parent resume path is out of scope for this phase.
```

### `functions/src/orgMembershipClaims.ts`

**`functions/src/orgMembershipClaims.ts:150-160`** — tags: CR-01 — qualifier: 76-REVIEW.md

_Summary:_ CR-01 fix (76-REVIEW.md): recomputes the FULL `deactivatedOrgs` claim map for a set of surviving org memberships, reading each org's live `active` field.

```ts

/**
 * CR-01 fix (76-REVIEW.md): recomputes the FULL `deactivatedOrgs` claim map
 * for a set of surviving org memberships, reading each org's live `active`
 * field. This is the self-heal that closes the gap `setOrgActive`'s one-time
 * member fan-out (orgProvisioning.ts) cannot: a member who joins an
 * ALREADY-deactivated org AFTER that fan-out ran (via pending-invite
 * acceptance or assignOrgAdminHandler) never had `deactivatedOrgs[orgId]`
 * set for them. Calling this on EVERY `syncOrgMembershipClaim` write (any
 * members/{uid} create/update/delete) means the very write that adds the new
 * member also computes their deactivatedOrgs entry from the org's CURRENT
```

**`functions/src/orgMembershipClaims.ts:200-206`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Whether the member document exists AFTER this write. false only for a genuine delete -- this is the real create/update/delete signal, threaded explicitly rather than inferred from `role` (WR-01: `role === undefined` alon...

```ts
  /**
   * Whether the member document exists AFTER this write. false only for a
   * genuine delete -- this is the real create/update/delete signal, threaded
   * explicitly rather than inferred from `role` (WR-01: `role === undefined`
   * alone is ambiguous between "document deleted" and "document exists but
   * has no role field").
   */
```

**`functions/src/orgMembershipClaims.ts:276-283`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Step 3b (WR-01): the document exists but has no `role` field -- e.g. a manual Firestore Console edit, or a future write path that creates a members/{uid} doc without setting role.

```ts

  // Step 3b (WR-01): the document exists but has no `role` field -- e.g. a
  // manual Firestore Console edit, or a future write path that creates a
  // members/{uid} doc without setting role. This is NOT a delete, so it must
  // never take the clear branch above: clearing here would silently revoke a
  // still-valid membership's claim on ambiguous input. Skip defensively
  // instead -- a stale claim is the lesser harm; the delete path above
  // already handles genuine revocation explicitly.
```

**`functions/src/orgMembershipClaims.ts:342-348`** — tags: CR-01 — qualifier: 76-REVIEW.md

_Summary:_ The `deactivatedOrgs`-map counterpart to orgsMapsEqual, same undefined-as-{} treatment (CR-01, 76-REVIEW.md): a legacy token with no `deactivatedOrgs` key at all compares equal to a freshly-computed empty map, so a membe...

```ts

/**
 * The `deactivatedOrgs`-map counterpart to orgsMapsEqual, same undefined-as-{}
 * treatment (CR-01, 76-REVIEW.md): a legacy token with no `deactivatedOrgs`
 * key at all compares equal to a freshly-computed empty map, so a member of
 * zero deactivated orgs never triggers a spurious claim write.
 */
```

**`functions/src/orgMembershipClaims.ts:375-396`** — tags: CR-01, WR-03 — qualifier: 76-REVIEW.md

_Summary:_ two cases, extended unchanged. The whole body is wrapped in try/catch and resolves with a failure outcome rather than rethrowing -- a throw out of a Firestore trigger causes Cloud Functions retries that would hammer the...

```ts
 * two cases, extended unchanged.
 *
 * The whole body is wrapped in try/catch and resolves with a failure
 * outcome rather than rethrowing -- a throw out of a Firestore trigger
 * causes Cloud Functions retries that would hammer the Auth API (T-40-08).
 *
 * CR-01 fix (76-REVIEW.md): ALSO recomputes the `deactivatedOrgs` claim on
 * every write that reaches computeOrgsClaimForUid (i.e. every write except
 * the two fully-conservative skips below), from the SAME surviving-orgs list
 * `orgs` is built from. This is the self-heal that closes the gap in
 * `setOrgActive`'s one-time member fan-out (orgProvisioning.ts): a member who
 * joins an ALREADY-deactivated org (pending-invite acceptance, or
 * assignOrgAdminHandler) fires THIS trigger, which now independently reads
 * that org's live `active` field and sets `deactivatedOrgs[orgId]`
 * accordingly -- no dependency on `setOrgActive` running again after they
 * join. It is also the WR-03 fix: a member removed then re-added mid-
 * deactivation recomputes fresh on rejoin rather than keeping a stale
 * fan-out-time value. `computeDeactivatedOrgsClaimForUid` reads ONLY the
 * orgs the recomputed `orgs` map actually lists (never a stale prior claim),
 * so a genuinely-active org always yields NO entry -- deactivatedOrgs never
 * grows a phantom key for a normal/reactivated membership.
 */
```

**`functions/src/orgMembershipClaims.ts:409-413`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Fully-conservative skips: the write is too ambiguous to act on at all (no user doc, or a create/update with no role field -- WR-01). Never touch orgs/deactivatedOrgs here either -- identical to pre-widening behaviour.

```ts

    // Fully-conservative skips: the write is too ambiguous to act on at
    // all (no user doc, or a create/update with no role field -- WR-01).
    // Never touch orgs/deactivatedOrgs here either -- identical to
    // pre-widening behaviour.
```

**`functions/src/orgMembershipClaims.ts:419-420`** — tags: CR-01 — qualifier: unqualified

_Summary:_ CR-01: recomputed from the SAME surviving-org list `orgs` was just built from -- every org this uid currently has a resolved role in.

```ts
    // CR-01: recomputed from the SAME surviving-org list `orgs` was just
    // built from -- every org this uid currently has a resolved role in.
```

**`functions/src/orgMembershipClaims.ts:425-432`** — tags: CR-01 — qualifier: unqualified

_Summary:_ R175: ONE merge call carries the primary keys AND the recomputed orgs map, preserving superAdmin (or any other unrelated claim).

```ts
        // R175: ONE merge call carries the primary keys AND the recomputed
        // orgs map, preserving superAdmin (or any other unrelated claim).
        // Spread decision.claims into a fresh object literal: OrgMembershipClaim
        // has no index signature, so passing it directly fails TS2345
        // against Record<string, unknown>. CR-01: deactivatedOrgs rides along
        // in this SAME write -- the write that creates/updates this member's
        // primary claim is exactly the moment their deactivated-org status
        // (if any) must also be established.
```

**`functions/src/orgMembershipClaims.ts:440-456`** — tags: CR-01, Pitfall, WR-01 — qualifier: 73-RESEARCH.md, 73-REVIEW.md

_Summary:_ A genuine primary-membership delete. Clearing the primary keys and recomputing `orgs` are INDEPENDENT effects (73-RESEARCH.md Pitfall 2) -- NEVER blanket-clear orgs here; a still-valid second-org membership must survive....

```ts
        // A genuine primary-membership delete. Clearing the primary keys and
        // recomputing `orgs` are INDEPENDENT effects (73-RESEARCH.md Pitfall
        // 2) -- NEVER blanket-clear orgs here; a still-valid second-org
        // membership must survive. WR-01 (73-REVIEW.md): this used to be TWO
        // sequential Admin SDK writes (clearClaimKeys then
        // mergeAndSetCustomClaims), which opened a brief TOCTOU window --
        // a token minted between the two writes could carry no orgId/role
        // but a STALE orgs map still listing the org just removed, retaining
        // Storage access via storage.rules' orgs[orgId] arm. Collapsed into
        // ONE atomic setCustomUserClaims call via mergeSetAndClearCustomClaims
        // (claimsHelpers.ts), which reads current claims once and applies the
        // clear+set in memory before the single write -- preserving
        // everything it doesn't explicitly touch (e.g. superAdmin).
        // CR-01: deactivatedOrgs is recomputed from the survivors here too,
        // so a primary-org delete that leaves the user still a member of a
        // deactivated second org keeps that entry, and drops the deleted
        // org's entry (if any) since it's no longer in desiredOrgs' keys.
```

**`functions/src/orgMembershipClaims.ts:487-491`** — tags: WR-02 — qualifier: 73-REVIEW.md

_Summary:_ WR-02 (73-REVIEW.md): the ~1000-byte custom-claims cap throws auth/claims-too-large -- give it a distinguishable, greppable log line rather than letting it blend into the generic failure path below.

```ts
    // WR-02 (73-REVIEW.md): the ~1000-byte custom-claims cap throws
    // auth/claims-too-large -- give it a distinguishable, greppable log line
    // rather than letting it blend into the generic failure path below.
    // Still fail-closed (return { action: "failed" }) -- this only changes
    // logging, never success behavior.
```


### `functions/src/orgProvisioning.ts`

**`functions/src/orgProvisioning.ts:68-78`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Cheap server-side email-format guard (WR-02). Both callables use the admin email as a Firestore doc id (`invites/{email}` and `inviteLookup/{email}` inside `writeAdminAssignment`) -- an email containing `/` (or an otherw...

```ts

/**
 * Cheap server-side email-format guard (WR-02). Both callables use the
 * admin email as a Firestore doc id (`invites/{email}` and
 * `inviteLookup/{email}` inside `writeAdminAssignment`) -- an email
 * containing `/` (or an otherwise malformed/empty value slipping past a
 * naive client check) would otherwise throw an opaque internal error
 * mid-transaction/batch instead of a clean, actionable one. Mirrors the
 * client's `isValidEmailFormat` (src/components/admin/OrganizationsTab.vue)
 * plus an explicit `/` rejection for the doc-id-safety concern -- not
 * RFC-perfect, just rejects empty/`/`-containing/obviously-invalid values.
```

**`functions/src/orgProvisioning.ts:117-127`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Resolves an admin-assignment target by email -- the ONLY network/Auth step in either onboarding or admin-assignment, deliberately run BEFORE any Firestore write (R202): a rethrown transient Auth error here creates NOTHIN...

```ts
 * Resolves an admin-assignment target by email -- the ONLY network/Auth step
 * in either onboarding or admin-assignment, deliberately run BEFORE any
 * Firestore write (R202): a rethrown transient Auth error here creates
 * NOTHING, so a same-input retry after the transient failure clears is
 * naturally clean.
 *
 * Discriminates `err.code === 'auth/user-not-found'` specifically (Pitfall 5)
 * -- ONLY that code takes the invite branch; any other code (network outage,
 * malformed email, etc.) is RETHROWN so a real Auth failure surfaces instead
 * of silently masquerading as a successful "invited" outcome.
 */
```

**`functions/src/orgProvisioning.ts:171-185`** — tags: WR-01 — qualifier: unqualified

_Summary:_ orgId to users/{uid}.orgIds via FieldValue.arrayUnion in a merge-set -- NEVER a literal-array overwrite and NEVER `.update` (R206; do not replicate src/stores/auth.ts:426,455's overwrite bug).

```ts
 * orgId to users/{uid}.orgIds via FieldValue.arrayUnion in a merge-set --
 * NEVER a literal-array overwrite and NEVER `.update` (R206; do not
 * replicate src/stores/auth.ts:426,455's overwrite bug). arrayUnion is a
 * transform that needs no prior read, so this is transaction-safe with no
 * extra tx.get.
 *
 * `existingJoinedAt` (WR-01): when the caller already read a prior
 * members/{uid} doc and it exists, pass its `joinedAt` here so a
 * re-assignment (assignOrgAdmin on someone already a member of this org)
 * preserves the original join date instead of resetting it. Left
 * `undefined` for a brand-new member (onboardOrganization's target is
 * always new -- the org was just minted -- and assignOrgAdmin's caller
 * passes `undefined` when its pre-batch read found no existing doc), which
 * falls through to a fresh `FieldValue.serverTimestamp()`.
 *
```

**`functions/src/orgProvisioning.ts:375-384`** — tags: CR-01 — qualifier: 76-REVIEW.md

_Summary:_ CR-01 belt-and-suspenders (76-REVIEW.md): refuse to grow membership on a deactivated org at all.

```ts

  // CR-01 belt-and-suspenders (76-REVIEW.md): refuse to grow membership on a
  // deactivated org at all. The PRIMARY fix (orgMembershipClaims.ts's
  // syncOrgMembershipClaim trigger self-heal) already ensures that IF this
  // write goes through, the new member's deactivatedOrgs claim is set
  // correctly -- but rejecting the assignment outright here is both simpler
  // to reason about for the super-admin (the org row's Deactivate/Reactivate
  // control is right there) and avoids creating a membership doc for an org
  // its own admin cannot use. Same default-true posture as isOrgActive()/
  // setOrgActiveHandler -- only an EXPLICIT active:false refuses.
```

**`functions/src/orgProvisioning.ts:391-396`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: if this admin is already a member of this org, preserve their original joinedAt instead of letting writeAdminAssignment's fresh serverTimestamp silently reset it.

```ts

  // WR-01: if this admin is already a member of this org, preserve their
  // original joinedAt instead of letting writeAdminAssignment's fresh
  // serverTimestamp silently reset it. This read is pre-batch (same as the
  // org-existence check above) -- there is no transaction constraint here
  // since assignOrgAdmin uses a WriteBatch, not a Transaction.
```

**`functions/src/orgProvisioning.ts:509-524`** — tags: Pitfall, WR-02 — qualifier: 76-RESEARCH.md, 76-REVIEW.md

_Summary:_ Count of members whose `deactivatedOrgs[orgId]` claim PATCH rejected (76-RESEARCH.md Pitfall 4) -- the org-doc write (the authoritative, firestore.rules-enforced source of truth) always succeeds independently of this.

```ts
  /** Count of members whose `deactivatedOrgs[orgId]` claim PATCH rejected
   * (76-RESEARCH.md Pitfall 4) -- the org-doc write (the authoritative,
   * firestore.rules-enforced source of truth) always succeeds independently
   * of this. A nonzero count means Storage enforcement did NOT reach that
   * member; retrying `setOrgActive` is a safe, idempotent way to finish the
   * job (patchNestedClaimKey is itself idempotent per-key).
   *
   * WR-02 (76-REVIEW.md): this NEVER counts a `revokeRefreshTokens` failure
   * -- that outcome is tracked separately in `revokeFailures` below, since
   * the two are not equivalent: a claim-patch failure means the Storage-side
   * deny never took effect (needs a retry), while a revoke failure only
   * means the bounded-exposure token-revocation step didn't fire (the deny
   * IS in place; cosmetic, self-heals within the token's remaining
   * lifetime). Conflating them (as the pre-fix single `claimFailures` count
   * did) made a retry decision impossible to make correctly.
   */
```

**`functions/src/orgProvisioning.ts:526-528`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Count of members whose `revokeRefreshTokens` call rejected on the deactivate branch (never populated on reactivate, which never revokes). See `claimFailures`'s doc for why this is tracked separately (WR-02).

```ts
  /** Count of members whose `revokeRefreshTokens` call rejected on the
   * deactivate branch (never populated on reactivate, which never revokes).
   * See `claimFailures`'s doc for why this is tracked separately (WR-02). */
```

**`functions/src/orgProvisioning.ts:532-557`** — tags: Pitfall, WR-02 — qualifier: 76-RESEARCH.md, 76-REVIEW.md

_Summary:_ The testable handler body, exported separately from the onCall wrapper below -- mirrors onboardOrganizationHandler/assignOrgAdminHandler's structure (caller gate, then input validation, then the org read, then the writes...

```ts
/**
 * The testable handler body, exported separately from the onCall wrapper
 * below -- mirrors onboardOrganizationHandler/assignOrgAdminHandler's
 * structure (caller gate, then input validation, then the org read, then the
 * writes).
 *
 * Write sequencing (76-RESEARCH.md Pitfall 4 / Code Examples):
 *   1. org-existence check (`not-found` if missing).
 *   2. the same-state-aware `organizations/{orgId}` merge write -- this is
 *      the AUTHORITATIVE write: firestore.rules' isOrgActive() reads it
 *      LIVE, so Firestore-side enforcement is already complete once this
 *      commits, regardless of the claim fan-out's outcome below.
 *   3. the SCOPED `organizations/{orgId}/members` query -- never
 *      `collectionGroup('members')` (T-40-05-class scope guard).
 *   4. a `Promise.allSettled` fan-out patching each member's
 *      `deactivatedOrgs[orgId]` claim key (Task 1 `patchNestedClaimKey`) --
 *      PLUS `revokeRefreshTokens` on the deactivate branch only (bounded
 *      exposure, not an instant cutoff -- 76-RESEARCH.md Pitfall 2). WR-02
 *      (76-REVIEW.md): the two steps are tracked as INDEPENDENT outcomes
 *      per member (`claimFailed`/`revokeFailed`) rather than one shared
 *      try/catch, so a revoke failure is never miscounted as a claim
 *      failure or vice versa. A claim-patch failure skips the revoke
 *      attempt entirely for that member (same as the original sequential
 *      await order: revoke was never reached past a thrown patch).
 *
 * Same-state short-circuit: when the org's CURRENT active status (default
```

**`functions/src/orgProvisioning.ts:606-609`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: never attempt the revoke after a failed claim patch -- mirrors the original sequential-await behavior (a thrown patch never reached the revoke call either), and a claim-patch retry is the correct next step regardl...

```ts
      // WR-02: never attempt the revoke after a failed claim patch -- mirrors
      // the original sequential-await behavior (a thrown patch never reached
      // the revoke call either), and a claim-patch retry is the correct next
      // step regardless of what revoke would have done.
```

**`functions/src/orgProvisioning.ts:662-676`** — tags: Pitfall — qualifier: 82-RESEARCH.md

_Summary:_ the DISABLE branch writes BOTH `aiMasterEnabled: false` AND `settings.aiEnabled: false` in the SAME merge write, using the EXPLICIT dot-path key form (`'settings.aiEnabled': false`), never a nested `{ settings: { aiEnabl...

```ts
 * the DISABLE branch writes BOTH `aiMasterEnabled: false` AND
 * `settings.aiEnabled: false` in the SAME merge write, using the EXPLICIT
 * dot-path key form (`'settings.aiEnabled': false`), never a nested
 * `{ settings: { aiEnabled: false } }` object literal -- the dot-path form is
 * unambiguously a single-field merge and matches SettingsView.vue:1047's own
 * client-side save shape, so a sibling settings field (bibleVersion, etc.)
 * can never be clobbered (82-RESEARCH.md Pitfall 4).
 *
 * EDGE-CASE short-circuit (plan-checker warning #3): a DISABLE call short-
 * circuits ONLY when BOTH `aiMasterEnabled` is already false AND
 * `settings.aiEnabled` is already false -- never on `aiMasterEnabled` alone.
 * A repeat disable call must still re-force `settings.aiEnabled` off if it
 * somehow drifted back on (e.g. write-ordering with a concurrent settings
 * save), so the forced-off write is never silently skipped. ENABLE keeps the
 * plain same-state short-circuit -- there is no forced-on side effect to
```

### `functions/src/pptxParser.ts`

**`functions/src/pptxParser.ts:44-54`** — tags: Pitfall — qualifier: 21-RESEARCH.md

_Summary:_ Mixed-content heuristic threshold (21-RESEARCH.md Pitfall 4 / Open Question 1): a slide's flattened non-image text must exceed this many characters to be treated as "text-dominant" and win over any images on the same sli...

```ts

/**
 * Mixed-content heuristic threshold (21-RESEARCH.md Pitfall 4 / Open Question 1):
 * a slide's flattened non-image text must exceed this many characters to be
 * treated as "text-dominant" and win over any images on the same slide. Chosen
 * against the real mixed.pptx fixture deck (21-03): short image captions/alt
 * text and single-line titles observed there run well under 40 characters,
 * while genuine body/bullet content reliably exceeds it. Below this threshold,
 * a slide with image children maps to image slide(s) instead; the import
 * preview (21-05) is the user's manual escape hatch for any mis-mapped slide.
 */
```

**`functions/src/pptxParser.ts:216-218`** — tags: Pitfall — qualifier: 21-RESEARCH.md

_Summary:_ OCR is never enabled -- this phase only needs text/image extraction, and officeparser's OCR path pulls in a heavy tesseract.js dependency for a capability this phase does not use (21-RESEARCH.md Pitfall 3).

```ts
    // OCR is never enabled -- this phase only needs text/image extraction, and
    // officeparser's OCR path pulls in a heavy tesseract.js dependency for a
    // capability this phase does not use (21-RESEARCH.md Pitfall 3).
```

**`functions/src/pptxParser.ts:251-253`** — tags: Pitfall — qualifier: 21-RESEARCH.md

_Summary:_ Custom metadata (not the GCS-reserved top-level fields) -- Phase 22's retention sweep reads this to age out old imports without a follow-up migration (21-RESEARCH.md Pitfall 5).

```ts
          // Custom metadata (not the GCS-reserved top-level fields) -- Phase
          // 22's retention sweep reads this to age out old imports without a
          // follow-up migration (21-RESEARCH.md Pitfall 5).
```

### `functions/src/serviceRoles.ts`

**`functions/src/serviceRoles.ts:52-59`** — tags: CR-01 — qualifier: 85-REVIEW.md

_Summary:_ "no data migration" decision as the client). Exported (rather than inlined at the call site) so the server's one role-load boundary (functions/src/index.ts, sendQueuedMessageHandler) and this file's own tests share exact...

```ts
 * "no data migration" decision as the client). Exported (rather than inlined at the
 * call site) so the server's one role-load boundary
 * (functions/src/index.ts, sendQueuedMessageHandler) and this file's own tests share
 * exactly one coercion implementation — the drift this function exists to close was
 * that a raw, un-shimmed Admin SDK read let a legacy vocalist silently drop out of a
 * "Band" team send while the client's "Reaches N" estimate still counted them
 * (CR-01, 85-REVIEW.md).
 */
```

### `functions/src/superAdminClaims.ts`

**`functions/src/superAdminClaims.ts:134-142`** — tags: WR-01 — qualifier: 68-REVIEW.md

_Summary:_ WR-01 (68-REVIEW.md): `grant` must be validated as an actual boolean, not branched on with bare truthiness.

```ts
  // WR-01 (68-REVIEW.md): `grant` must be validated as an actual boolean, not
  // branched on with bare truthiness. `CallableRequest<SetSuperAdminClaimRequest>`
  // is a compile-time-only guarantee -- a raw httpsCallable invocation, a
  // curl/Postman call, or a future client bug can send `grant` missing/
  // undefined/null/0/"". Falling through to `if (grant)` would silently take
  // the REVOKE branch (deleting the target's superAdmins/{targetUid} doc and
  // revoking their refresh tokens) on any malformed call, even when intent was
  // to grant -- the more dangerous of the two failure directions. Reject
  // outright instead of guessing.
```

### `render-service/src/render.ts`

**`render-service/src/render.ts:110-113`** — tags: Pitfall — qualifier: 37-RESEARCH.md

_Summary:_ Per-request-unique profile directory INSIDE the request's own working directory.

```ts
  // Per-request-unique profile directory INSIDE the request's own working directory.
  // LibreOffice's own lock file makes a shared/reused UserInstallation profile unreliable
  // under concurrency (37-RESEARCH.md Pitfall 3) -- a fresh mkdtemp per request sidesteps
  // that class of failure entirely, independent of Cloud Run's own --concurrency setting.
```

**`render-service/src/render.ts:119-121`** — tags: Pitfall — qualifier: 37-RESEARCH.md

_Summary:_ Step 1: PPTX -> PDF. Explicit timeout bounds the DoS blast radius of an adversarial or pathological .pptx (zip bomb, deeply nested embeds -- 37-RESEARCH.md Pitfall 5).

```ts

    // Step 1: PPTX -> PDF. Explicit timeout bounds the DoS blast radius of an adversarial
    // or pathological .pptx (zip bomb, deeply nested embeds -- 37-RESEARCH.md Pitfall 5).
```

### `src/components/AppSidebar.vue`

**`src/components/AppSidebar.vue:240-249`** — tags: WR-03 — qualifier: 104-REVIEW

_Summary:_ SlideActionMenu.vue's ARIA-menu pattern, reused verbatim: opening the panel moves focus to its first menuitem.

```vue

// SlideActionMenu.vue's ARIA-menu pattern, reused verbatim: opening the
// panel moves focus to its first menuitem.
//
// 104-REVIEW WR-03: the active-church row renders as a non-focusable
// `<div role="menuitem">` (no tabindex) — calling .focus() on it is a
// browser no-op. Since authStore.memberships lists the active org first more
// often than not, a plain `[role="menuitem"]` match frequently lands on that
// row and silently focuses nothing. Scope to the first FOCUSABLE menuitem
// (the `<button role="menuitem">` rows) instead.
```

**`src/components/AppSidebar.vue:286-289`** — tags: WR-02 — qualifier: 104-REVIEW

_Summary:_ 104-REVIEW WR-02: `push()` only arms its auto-dismiss timer when `opts` is omitted entirely OR `opts.autoDismissMs` is set — passing `{ variant: 'error' }` alone falls into neither branch and stays sticky forever.

```vue
    // 104-REVIEW WR-02: `push()` only arms its auto-dismiss timer when `opts`
    // is omitted entirely OR `opts.autoDismissMs` is set — passing
    // `{ variant: 'error' }` alone falls into neither branch and stays sticky
    // forever. 'error' is already push()'s default variant, so omit opts.
```

### `src/components/AudioPlayer.vue`

**`src/components/AudioPlayer.vue:96-101`** — tags: WR-01 — qualifier: unqualified

_Summary:_ A pause()-interrupted play() rejects with AbortError, not NotAllowedError (HTML media spec) — this is an expected, silent outcome (see WR-01): the presentation driver calls pauseCurrentMedia() at the start of every navig...

```vue
    // A pause()-interrupted play() rejects with AbortError, not
    // NotAllowedError (HTML media spec) — this is an expected, silent
    // outcome (see WR-01): the presentation driver calls pauseCurrentMedia()
    // at the start of every navigation, which can legitimately race a
    // still-pending play() on this exact element. Never surface it as an
    // unhandled rejection.
```

### `src/components/AvailabilityDrawer.vue`

**`src/components/AvailabilityDrawer.vue:399-409`** — tags: WR-04 — qualifier: unqualified

_Summary:_ ── Serve frequency (per-role quarter tier + cadence, D-05/D-06) ─────────── draft.roleFrequency[roleId] carries both the tier AND the cadence n in one write (D-05) — no separate standing frequency field remains.

```vue

// ── Serve frequency (per-role quarter tier + cadence, D-05/D-06) ───────────
// draft.roleFrequency[roleId] carries both the tier AND the cadence n in one
// write (D-05) — no separate standing frequency field remains. The 'regular'
// tier's active preset is derived from n (weekly n=1, biweek n=2, monthly n=4).
// WR-04: a non-preset n (e.g. "3" or "1-in-6" imported via CSV — both valid,
// supported frequencyLabelToN inputs) must NOT be shown as an active preset —
// 'monthly' previously matched by fallback, misrepresenting the real cadence
// and turning a click on "Monthly" into a silent, no-op-looking overwrite.
// 'custom' is a display-only state: it never matches any rendered preset's
// key, so no preset button is ever wrongly highlighted as active for it.
```

**`src/components/AvailabilityDrawer.vue:437-439`** — tags: WR-04 — qualifier: unqualified

_Summary:_ WR-04: no preset button is shown active for a non-canonical n, so make the custom cadence explicit in the readout text too, rather than relying on the reader to notice the number doesn't match any highlighted preset.

```vue
  // WR-04: no preset button is shown active for a non-canonical n, so make the custom
  // cadence explicit in the readout text too, rather than relying on the reader to notice
  // the number doesn't match any highlighted preset.
```

### `src/components/CongregationalEditor.vue`

**`src/components/CongregationalEditor.vue:162-176`** — tags: WR-04 — qualifier: unqualified

_Summary:_ click-between-verses divider UX per direct owner feedback: the divider UX was unintuitive).

```vue
// click-between-verses divider UX per direct owner feedback: the divider UX
// was unintuitive). The user edits a plain `---`-delimited textarea, exactly
// like the song-lyrics paste flow; `src/utils/congregationalText.ts` is the
// single source of truth for the text<->sections grammar.
//
// Controlled component (R064): it persists NOTHING itself. It seeds its
// editable `text` ONCE at mount (WR-04 — keyed on slot id by the parent, not
// reactive to later prop changes) and reports upward only on Save via
// `update:sections`, on Delete via `delete`, and closes via `close`.
//
// R092 (translationSource): `capturedVersion` is captured ONCE — from the
// existing sections at mount, or from the church's bibleVersion setting at the
// moment of the auto-fetch — and every Save stamps from that captured value,
// never a fresh read of the org's current setting.
//
```

**`src/components/CongregationalEditor.vue:295-300`** — tags: WR-02 — qualifier: 102-REVIEW

_Summary:_ WR-02 (102-REVIEW): the refactor to status-branching dropped the generic catch, leaving `stripVerseMarkers(result.text)` and the subsequent state writes with no safety net — an exception there previously set fetchError;...

```vue
    // WR-02 (102-REVIEW): the refactor to status-branching dropped the
    // generic catch, leaving `stripVerseMarkers(result.text)` and the
    // subsequent state writes with no safety net — an exception there
    // previously set fetchError; it would otherwise now become an unhandled
    // rejection. The dispatcher itself never throws, but this restores the
    // documented "anything in here degrades gracefully" contract.
```

**`src/components/CongregationalEditor.vue:348-356`** — tags: WR-02 — qualifier: 103-REVIEW

_Summary:_ WR-02 (103-REVIEW): the org's stored bibleVersion has no relationship to "any version" text typed directly into the textarea while the Bible API is off -- capturedVersion is only ever set inside autoFetch's 'ok' branch,...

```vue
    // WR-02 (103-REVIEW): the org's stored bibleVersion has no relationship to
    // "any version" text typed directly into the textarea while the Bible API
    // is off -- capturedVersion is only ever set inside autoFetch's 'ok'
    // branch, which never runs while the API is off, so it always falls
    // through to here on the manual-entry path. Falling back to the org
    // default there would falsely stamp e.g. ESV on manually-entered NIV
    // text. Guarded so the org-default fallback is only used on the
    // fetch-backed (enabled) path; the manual-entry path leaves
    // translationSource unset.
```

**`src/components/CongregationalEditor.vue:373-377`** — tags: WR-02 — qualifier: 103-REVIEW

_Summary:_ WR-02 (103-REVIEW): same guard as onAiSplit's stampVersion -- the per-item override (props.bibleVersion) is a deliberate, explicit choice and still applies; only the final catch-all org-default fallback is nulled out whe...

```vue
  // WR-02 (103-REVIEW): same guard as onAiSplit's stampVersion -- the
  // per-item override (props.bibleVersion) is a deliberate, explicit choice
  // and still applies; only the final catch-all org-default fallback is
  // nulled out when the Bible API is off, since that setting has no
  // relationship to whatever the user actually typed into the textarea.
```

### `src/components/GettingStarted.vue`

**`src/components/GettingStarted.vue:119-125`** — tags: CR-01 — qualifier: 104-REVIEW

_Summary:_ 104-REVIEW CR-01: the sidebar's in-place church switcher changes authStore.orgId without a route change/remount (this panel stays mounted across a switch on the Dashboard), so the member-count listener must react to the...

```vue

// 104-REVIEW CR-01: the sidebar's in-place church switcher changes
// authStore.orgId without a route change/remount (this panel stays mounted
// across a switch on the Dashboard), so the member-count listener must react
// to the org id itself rather than only reading it once in onMounted —
// otherwise it keeps counting the previous church's members after a switch.
// `immediate: true` replaces the old onMounted-only subscribe.
```

### `src/components/NewServiceDialog.vue`

**`src/components/NewServiceDialog.vue:210-219`** — tags: WR-1 — qualifier: unqualified

_Summary:_ WR-1: `teamsStore.subscribe()`'s `onSnapshot` is async, so if the dialog mounts/opens before the first snapshot lands, the calls above compute zero matches against an empty `teamsStore.teams`.

```vue

// WR-1: `teamsStore.subscribe()`'s `onSnapshot` is async, so if the dialog
// mounts/opens before the first snapshot lands, the calls above compute zero
// matches against an empty `teamsStore.teams`. `onSnapshot` always REASSIGNS
// `teams.value` to a brand-new array on every emission (see teams.ts), so a
// plain (non-deep) watch on the array reference fires once the real snapshot
// arrives, recomputing auto-select for the CURRENT form date. Guarded to
// `props.open` so it can't fight a manual toggle before the dialog is even
// shown; `applyRecurrenceAutoSelect` itself already skips
// `manuallyTouchedTeams`, so a team the planner has already unchecked stays
```

### `src/components/PresentationViewer.vue`

**`src/components/PresentationViewer.vue:220-230`** — tags: WR-04 — qualifier: unqualified

_Summary:_ WR-04: the exit button must stay reachable even if the idle-hide timer has already fired while there is still nothing else on screen to interact with (assembly taking >3s, or the rare empty/race state) — on a touch-only...

```vue

/**
 * WR-04: the exit button must stay reachable even if the idle-hide timer has
 * already fired while there is still nothing else on screen to interact
 * with (assembly taking >3s, or the rare empty/race state) — on a
 * touch-only device there would otherwise be no way to trigger Escape.
 * `chromeVisible`'s own value (and its 3s timer) are untouched; this only
 * overrides what's DISPLAYED while loading/empty. Widened (46-04) to also
 * cover the R094 font-load gate — the exit affordance must stay reachable
 * for however long that gate holds too.
 */
```

**`src/components/PresentationViewer.vue:250-259`** — tags: WR-03 — qualifier: unqualified

_Summary:_ change: the provenance helpers in `@/utils/scripture` and the per-slide `translationSource` field are untouched (R092 preserved), and the version can still be typed into a slide's own editable text.

```vue
// change: the provenance helpers in `@/utils/scripture` and the per-slide
// `translationSource` field are untouched (R092 preserved), and the version
// can still be typed into a slide's own editable text.

// A live edit that shortens the show cannot leave currentIndex out of range.
// Clamping must route through the same pause/play lifecycle as goToIndex()
// (WR-03) — otherwise nothing ever calls .play() on whatever media element
// SlideCanvas mounts for the new slide. SlideCanvas's own internal watcher
// (Phase 90) resets the OLD slide's degraded-state flags on this same
// slide-identity change, so they never leak onto the clamped-to slide.
```

**`src/components/PresentationViewer.vue:310-321`** — tags: WR-06 — qualifier: unqualified

_Summary:_ ── Keyboard — bound on the viewer root only, never window/document ────────── WR-06: the viewer is teleported to `document.body` and covers the viewport visually, but the rest of the app remains in the DOM behind it (hid...

```vue

// ── Keyboard — bound on the viewer root only, never window/document ──────────

/**
 * WR-06: the viewer is teleported to `document.body` and covers the
 * viewport visually, but the rest of the app remains in the DOM behind it
 * (hidden only visually, not removed) — without a focus trap, Tab could walk
 * keyboard focus straight past the viewer's own buttons into that
 * still-present app content. Queries only the viewer's own currently-enabled
 * focusable elements (prev/next are excluded via `:not([disabled])` when at
 * either end of the show).
 */
```

**`src/components/PresentationViewer.vue:414-425`** — tags: CR-02 — qualifier: 46-REVIEW.md

_Summary:_ R094 — the font-load gate. Runs regardless of whether there are slides yet (`fontReady` only ever gates rendering when `hasSlides` is true, see `fontGateActive` above), so it never races the assembly-in-flight state.

```vue

  // R094 — the font-load gate. Runs regardless of whether there are slides
  // yet (`fontReady` only ever gates rendering when `hasSlides` is true, see
  // `fontGateActive` above), so it never races the assembly-in-flight state.
  //
  // CR-02 (46-REVIEW.md): the whole sequence — including loadFontCss's
  // unbounded network fetch, NOT just waitForSlideFont's own internal
  // timeout — is raced against ONE shared FONT_LOAD_TIMEOUT_MS timeout and
  // wrapped in try/catch/finally, so a rejected dynamic import (stale-chunk
  // deploy, flaky venue Wi-Fi) or a rejected document.fonts.load() can
  // never permanently strand fontReady at false and hang "Loading
  // slideshow…" for the rest of the service.
```

### `src/components/QuarterShareMatrix.vue`

**`src/components/QuarterShareMatrix.vue:29`** — tags: WR-05 — qualifier: unqualified

_Summary:_ WR-05: distinguish "quarter genuinely has no service dates" from "a name filter

```vue
    <!-- WR-05: distinguish "quarter genuinely has no service dates" from "a name filter
```

**`src/components/QuarterShareMatrix.vue:53-55`** — tags: WR-05 — qualifier: unqualified

_Summary:_ WR-05: raw/unfiltered service-date count for the quarter, independent of any active name filter narrowing `dates` — lets this component tell "genuinely empty quarter" apart from "filter matched zero dates" instead of col...

```vue
  // WR-05: raw/unfiltered service-date count for the quarter, independent of any active name
  // filter narrowing `dates` — lets this component tell "genuinely empty quarter" apart from
  // "filter matched zero dates" instead of collapsing both into "No service dates".
```

### `src/components/RoleSlideOver.vue`

**`src/components/RoleSlideOver.vue:223-231`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01 (Phase 88 review): the pre-Phase-88 inline "Add Role" flow guarded its payload with `defaultCount: newRoleCount.value || 1`.

```vue

// WR-01 (Phase 88 review): the pre-Phase-88 inline "Add Role" flow guarded its
// payload with `defaultCount: newRoleCount.value || 1`. Save here is a plain
// button (not a native form submit), so the input's `min="1"` never runs HTML5
// constraint validation — clearing the field leaves `form.value.defaultCount`
// as an empty string (v-model.number's looseToNumber falls back to the raw
// string when parseFloat is NaN), which would otherwise write straight to
// Firestore and corrupt scheduler auto-fill math. Coerce to a valid positive
// number, floored to 1 when empty/NaN/less than 1.
```

### `src/components/ScriptureInput.vue`

**`src/components/ScriptureInput.vue:3-4`** — tags: WR-02 — qualifier: 82-REVIEW

_Summary:_ AI Scripture Search (only for reading slots) WR-02 (82-REVIEW): two-gate authStore.isAiEnabled, not the bare

```vue
    <!-- AI Scripture Search (only for reading slots) -->
    <!-- WR-02 (82-REVIEW): two-gate authStore.isAiEnabled, not the bare
```

**`src/components/ScriptureInput.vue:136`** — tags: WR-01 — qualifier: 103-REVIEW

_Summary:_ authStore.isBibleApiEnabled (WR-01, 103-REVIEW) so it doesn't render

```vue
         authStore.isBibleApiEnabled (WR-01, 103-REVIEW) so it doesn't render
```

**`src/components/ScriptureInput.vue:452-457`** — tags: WR-02 — qualifier: 102-REVIEW

_Summary:_ WR-02 (102-REVIEW): defensive safety net restored. The dispatcher itself never throws (its own errors map to `{status:'error'}` above), but this still protects against an exception anywhere else in the try block (e.g.

```vue
    // WR-02 (102-REVIEW): defensive safety net restored. The dispatcher
    // itself never throws (its own errors map to `{status:'error'}` above),
    // but this still protects against an exception anywhere else in the try
    // block (e.g. `useAuthStore()` inside the dispatcher, or future
    // post-fetch processing) degrading gracefully instead of becoming an
    // unhandled rejection.
```

**`src/components/ScriptureInput.vue:549-550`** — tags: WR-02 — qualifier: 102-REVIEW

_Summary:_ WR-02 (102-REVIEW): defensive safety net restored — see fetchPreview above for the full rationale.

```vue
    // WR-02 (102-REVIEW): defensive safety net restored — see fetchPreview
    // above for the full rationale.
```

### `src/components/ScriptureSlideEditor.vue`

**`src/components/ScriptureSlideEditor.vue:137-143`** — tags: WR-01 — qualifier: 102-REVIEW

_Summary:_ WR-01 (102-REVIEW): routed through the scriptureApi.ts dispatcher — the single client-side choke point (R297) — instead of calling fetchPassageText directly.

```vue
    // WR-01 (102-REVIEW): routed through the scriptureApi.ts dispatcher — the
    // single client-side choke point (R297) — instead of calling
    // fetchPassageText directly. This component is currently unmounted
    // anywhere in the app, but leaving a direct esvApi call here would
    // silently reintroduce an ungated ESV proxy call the moment it's wired
    // into a view. Still ESV-only (pre-existing gap, out of this phase's
    // scope — no NLT dispatch existed here before either).
```

**`src/components/ScriptureSlideEditor.vue:256-268`** — tags: WR-04 — qualifier: 32-REVIEW

_Summary:_ Test-only seam (matches PptxImportModal.vue's existing defineExpose precedent and CongregationalEditor.vue's identical comment) — needed for the E4 `partial` backstop test.

```vue

// Test-only seam (matches PptxImportModal.vue's existing defineExpose
// precedent and CongregationalEditor.vue's identical comment) — needed for
// the E4 `partial` backstop test.
//
// ★ WR-04 (32-REVIEW), CALL-SITE CONTRACT — same as CongregationalEditor.vue:
// `currentReadingId`/`surfaceId`/`referenceText`/`rawText`/`localSlides` are
// all captured/seeded ONCE at mount and are NOT reactive to `props.readingId`
// changing afterward. The caller MUST always mount this component with a
// `:key` tied to `readingId` — swapping the prop in place on a persistent
// instance is not supported and would silently misattribute saves to the
// wrong reading. See CongregationalEditor.vue's identical comment for why a
// partial (surfaceId-only) prop-watcher was considered and rejected.
```

### `src/components/SongBrowser.vue`

**`src/components/SongBrowser.vue:74-76`** — tags: WR-03 — qualifier: 81-REVIEW

_Summary:_ Consumer-owned row/list markup — receives the shared tag-filtered pool. WR-03 (81-REVIEW): neither current production consumer destructures

```vue

  <!-- Consumer-owned row/list markup — receives the shared tag-filtered pool.
       WR-03 (81-REVIEW): neither current production consumer destructures
```

### `src/components/SongLyricEditor.vue`

**`src/components/SongLyricEditor.vue:480-489`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: a stable identity per `performanceOrder` SLOT (not per section id, not per position) — kept in lockstep with `editableState.performanceOrder` by every mutation below (drag reorder, duplicate, remove, add-section)....

```vue

// WR-01: a stable identity per `performanceOrder` SLOT (not per section id,
// not per position) — kept in lockstep with `editableState.performanceOrder`
// by every mutation below (drag reorder, duplicate, remove, add-section).
// `buildSectionRows` exposes it as `SectionRow.stableKey`, which
// `expandedRowKeys` is keyed by instead of the positionally-derived
// `rowKey`, so a reorder can never silently reattach expand/collapse state
// to a different physical row. Component-local only — never persisted, so a
// document reload naturally starts expand state fresh (see the
// `currentLyrics` watcher below for the one case that must NOT reseed: our
```

**`src/components/SongLyricEditor.vue:523-529`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02 (105 code review): compare `kind` too — today the only way a section's `kind` is set is at mint time in `addSection('BLACKOUT')`, which always mints a fresh id, so an id/label match currently implies a `kind` match...

```vue
    // WR-02 (105 code review): compare `kind` too — today the only way a
    // section's `kind` is set is at mint time in `addSection('BLACKOUT')`,
    // which always mints a fresh id, so an id/label match currently implies
    // a `kind` match as well. But this is a field-by-field equality check
    // (it already goes out of its way to catch slideBreaks-only changes
    // above), so a future in-place `kind` mutation (e.g. a "convert to
    // black slide" affordance) must not be silently missed by autosave.
```

**`src/components/SongLyricEditor.vue:599-606`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: only reseed slot ids when the order actually changed from what is already held.

```vue

    // WR-01: only reseed slot ids when the order actually changed from what
    // is already held. This watcher re-fires after our OWN autosave writes
    // round-trip back through the Firestore subscription with an unchanged
    // order — reseeding unconditionally would silently collapse every
    // expanded row on every save. A genuinely different order (first load,
    // a different document, or a load-time repair) still reseeds, which is
    // correct: those rows are not the ones the user had open.
```

**`src/components/SongLyricEditor.vue:628-634`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: a textarea value ending in a newline (Enter after the last line, or a paste with a trailing newline) produces a trailing empty-string element from `split('\n')`.

```vue

// WR-02: a textarea value ending in a newline (Enter after the last line, or
// a paste with a trailing newline) produces a trailing empty-string element
// from `split('\n')`. That empty line is not cosmetic here — it renders as a
// blank line on the projected slide. Strip exactly one trailing empty
// element (the artifact of how textareas serialize), not all trailing
// blanks — a user may legitimately want internal blank-line spacing.
```

**`src/components/SongLyricEditor.vue:643-648`** — tags: Pitfall — qualifier: unqualified

_Summary:_ R117: the write-source complement to `sliceSectionIntoSlides`'s read-time clamp (Pitfall 5).

```vue

// R117: the write-source complement to `sliceSectionIntoSlides`'s read-time
// clamp (Pitfall 5). After the line list shrinks, a break index that now falls
// out of `[1, lines.length)` can never point past the text or slice into
// emptiness — drop it here so it is never persisted. An empty result removes
// the field entirely, keeping an unsplit section byte-identical to today (BWC).
```

**`src/components/SongLyricEditor.vue:706-712`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Duplicate/Remove/Add-section all mutate through 28-01's pure helpers — no ordering or pool logic is re-implemented here.

```vue

// Duplicate/Remove/Add-section all mutate through 28-01's pure helpers —
// no ordering or pool logic is re-implemented here. Each mirrors its
// performanceOrder splice onto `orderSlotIds` at the same index, so
// `SectionRow.stableKey` (and therefore expand/collapse state) tracks the
// physical row rather than its position (WR-01).
```

**`src/components/SongLyricEditor.vue:829-831`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Mirror the same move on the stable-id array (WR-01) — `moveRow` is a generic index-based splice, agnostic to what the array holds, so it applies unchanged here.

```vue
          // Mirror the same move on the stable-id array (WR-01) — `moveRow`
          // is a generic index-based splice, agnostic to what the array
          // holds, so it applies unchanged here.
```

**`src/components/SongLyricEditor.vue:846-848`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: keyed by the row's stable, order-slot-derived identity, not the positionally-derived `rowKey`, so a reorder/duplicate/remove can never silently reattach expand state to a different physical row.

```vue
  // WR-01: keyed by the row's stable, order-slot-derived identity, not the
  // positionally-derived `rowKey`, so a reorder/duplicate/remove can never
  // silently reattach expand state to a different physical row.
```

### `src/components/SongSlotPicker.vue`

**`src/components/SongSlotPicker.vue:56-58`** — tags: WR-02 — qualifier: 82-REVIEW

_Summary:_ AI Picks section WR-02 (82-REVIEW): gate on the two-gate authStore.isAiEnabled

```vue

          <!-- AI Picks section -->
          <!-- WR-02 (82-REVIEW): gate on the two-gate authStore.isAiEnabled
```

**`src/components/SongSlotPicker.vue:303-304`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Resolve against visibleSongs so a cached suggestion for a since-hidden song never surfaces in the picker (WR-01).

```vue
      // Resolve against visibleSongs so a cached suggestion for a since-hidden song
      // never surfaces in the picker (WR-01).
```

### `src/components/TeamSlideOver.vue`

**`src/components/TeamSlideOver.vue:78-79`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Rename soft-warn (WR-02)

```vue

          <!-- Rename soft-warn (WR-02) -->
```

**`src/components/TeamSlideOver.vue:238-240`** — tags: WR-2 — qualifier: unqualified

_Summary:_ WR-2: dedupe on read (see TeamRecurrenceSlideOver.vue) — a duplicate entering via a direct console edit/migration/future writer would otherwise leave toggleOrdinal splicing only one copy per click.

```vue
      // WR-2: dedupe on read (see TeamRecurrenceSlideOver.vue) — a duplicate
      // entering via a direct console edit/migration/future writer would
      // otherwise leave toggleOrdinal splicing only one copy per click.
```

**`src/components/TeamSlideOver.vue:275-279`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: teams are consumed by NAME everywhere a service selects them (the service checkboxes), so two teams sharing a name break checkbox independence.

```vue

// WR-01: teams are consumed by NAME everywhere a service selects them (the
// service checkboxes), so two teams sharing a name break checkbox
// independence. Compare trimmed + case-insensitive, excluding the row being
// edited (so saving a team without changing its name never collides with itself).
```

**`src/components/TeamSlideOver.vue:289-290`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: reject a save whose name collides with another existing team.

```vue

  // WR-01: reject a save whose name collides with another existing team.
```

**`src/components/TeamSlideOver.vue:295-299`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: renaming orphans the name-keyed reference on every service that already selected the old name (same practical consequence as delete) — require a soft-warn confirm step before committing the rename.

```vue

  // WR-02: renaming orphans the name-keyed reference on every service that
  // already selected the old name (same practical consequence as delete) —
  // require a soft-warn confirm step before committing the rename. Not
  // triggered on create, on an unchanged name, or on a recurrence-only edit.
```

**`src/components/TeamSlideOver.vue:308-311`** — tags: WR-2 — qualifier: unqualified

_Summary:_ WR-2: dedupe on write too, in case a duplicate slipped past the read-side seed (e.g. this component instance stayed open across a direct Firestore edit landing mid-session).

```vue

  // WR-2: dedupe on write too, in case a duplicate slipped past the read-side
  // seed (e.g. this component instance stayed open across a direct Firestore
  // edit landing mid-session).
```

### `src/components/ToastHost.vue`

**`src/components/ToastHost.vue:45`** — tags: WR-01 — qualifier: 104-REVIEW

_Summary:_ 104-REVIEW WR-01: deliberately NO rel="noopener". The only current

```vue
          <!-- 104-REVIEW WR-01: deliberately NO rel="noopener". The only current
```

### `src/components/VideoPlayer.vue`

**`src/components/VideoPlayer.vue:76-83`** — tags: WR-01 — qualifier: unqualified

_Summary:_ `NotAllowedError` (autoplay policy) and `AbortError` (the play() request was interrupted by a same-element `pause()` call, per the HTML media spec — see WR-01) are both expected, silent outcomes here: the presentation dr...

```vue

/**
 * `NotAllowedError` (autoplay policy) and `AbortError` (the play() request
 * was interrupted by a same-element `pause()` call, per the HTML media spec
 * — see WR-01) are both expected, silent outcomes here: the presentation
 * driver calls `pauseCurrentMedia()` at the start of every navigation, which
 * can legitimately race a still-pending `play()` on this exact element.
 */
```

### `src/components/admin/AiProxyConfigCard.vue`

**`src/components/admin/AiProxyConfigCard.vue:71-74`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Phase 70-02 (R186/R187) — AI Proxy card: three ConfigNumberField number knobs (incl.

```vue
// Phase 70-02 (R186/R187) — AI Proxy card: three ConfigNumberField number
// knobs (incl. the rateLimitPerDay >= rateLimitPerMin cross-field rule, RESEARCH
// Pitfall 4) plus allowedModels as ONE comma-separated ConfigTextField (RESEARCH
// Pitfall 3 — split/trim/filter/require-non-empty before saving a string[]).
```

**`src/components/admin/AiProxyConfigCard.vue:121-126`** — tags: Pitfall — qualifier: unqualified

_Summary:_ ── Cross-field rule: rateLimitPerDay >= rateLimitPerMin (RESEARCH Pitfall 4) ── ConfigNumberField's `update:modelValue` (70-02 addition) exposes the LIVE edited value so this reacts to what the owner is currently typing,...

```vue

// ── Cross-field rule: rateLimitPerDay >= rateLimitPerMin (RESEARCH Pitfall 4) ──
// ConfigNumberField's `update:modelValue` (70-02 addition) exposes the LIVE
// edited value so this reacts to what the owner is currently typing, not just
// the last-saved effective value — a naive "compare only saved values" check
// would let a genuinely invalid save through.
```

**`src/components/admin/AiProxyConfigCard.vue:141-148`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Mirror of the above (review WR-01): the original cross-field rule was only wired onto the rateLimitPerDay field, so an owner could raise rateLimitPerMin above the (unchanged) rateLimitPerDay with no warning and Save woul...

```vue

// Mirror of the above (review WR-01): the original cross-field rule was only
// wired onto the rateLimitPerDay field, so an owner could raise
// rateLimitPerMin above the (unchanged) rateLimitPerDay with no warning and
// Save would succeed. Bidirectional by construction — both computeds react
// to the OTHER field's live edited value the same way, so raising either
// field past the other's current effective value blocks Save on the field
// being edited.
```

### `src/components/admin/CleanupEnableConfirmDialog.vue`

**`src/components/admin/CleanupEnableConfirmDialog.vue:166-170`** — tags: WR-01 — qualifier: 71-UI-SPEC.md

_Summary:_ The element that had focus immediately before the dialog opened (almost always the row's Enable button that triggered it) -- captured on open, restored on close per 71-UI-SPEC.md Accessibility: "on close, focus returns t...

```vue

// The element that had focus immediately before the dialog opened (almost
// always the row's Enable button that triggered it) -- captured on open,
// restored on close per 71-UI-SPEC.md Accessibility: "on close, focus
// returns to the row's Enable button that opened the dialog" (review WR-01).
```

**`src/components/admin/CleanupEnableConfirmDialog.vue:190-196`** — tags: CR-01 — qualifier: 71-UI-SPEC.md

_Summary:_ Gated on `confirming` so EVERY dismissal path (backdrop click, panel @click.self, Escape, and the Cancel button itself) is a genuine no-op while the enable write is in flight -- matches 71-UI-SPEC.md's "Cancel also disab...

```vue

// Gated on `confirming` so EVERY dismissal path (backdrop click, panel
// @click.self, Escape, and the Cancel button itself) is a genuine no-op
// while the enable write is in flight -- matches 71-UI-SPEC.md's "Cancel
// also disabled during the enabling state (prevents closing mid-write)"
// requirement, which previously only the Cancel <button>'s :disabled
// attribute honored (review CR-01).
```

### `src/components/admin/ConfigNumberField.vue`

**`src/components/admin/ConfigNumberField.vue:94-102`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: `v-model.number` on a native `type="number"` input leaves `inputValue` as the raw string `''` (not `NaN`) when the user backspaces the field to empty — Vue's `looseToNumber` only converts on a successful `parseFlo...

```vue
  // WR-02: `v-model.number` on a native `type="number"` input leaves
  // `inputValue` as the raw string `''` (not `NaN`) when the user backspaces
  // the field to empty — Vue's `looseToNumber` only converts on a
  // successful `parseFloat`; on failure it returns the original string
  // unchanged. Detect that empty-string case explicitly, independent of
  // `min`, so a required field correctly reports "This field is required."
  // instead of silently passing the required guard and falling through to a
  // misleading min/integer message (or, if `min` were absent/<=0, saving an
  // empty string where Firestore/the functions coerce* layer expect a
```

### `src/components/admin/DeleteOrgConfirmDialog.vue`

**`src/components/admin/DeleteOrgConfirmDialog.vue:138-147`** — tags: Pitfall, WR-02 — qualifier: 77-RESEARCH.md

_Summary:_ Exact, case-sensitive comparison (trim only, no lowercasing -- 77-RESEARCH.md Assumption A1/Pitfall 3: "grace church" must NOT satisfy "Grace Church").

```vue

// Exact, case-sensitive comparison (trim only, no lowercasing --
// 77-RESEARCH.md Assumption A1/Pitfall 3: "grace church" must NOT satisfy
// "Grace Church"). Structurally disabled, not just visually -- there is no
// code path that can click through this button with a non-matching value.
// Trim BOTH sides so a stored org name with stray leading/trailing whitespace
// (not reachable via the onboarding UI today, but possible via a future/foreign
// write path) can still be confirmed — mirrors the server-side both-sides trim
// in orgDeletion.ts (77 WR-02), which would otherwise accept a value this
// button could never enable.
```

### `src/components/admin/OrganizationsTab.vue`

**`src/components/admin/OrganizationsTab.vue:362-364`** — tags: WR-01 — qualifier: 76-REVIEW.md

_Summary:_ WR-01 (76-REVIEW.md): tracks whether a given org's current toggleFeedback message is a partial-failure warning (claimFailures > 0) rather than a clean success, so the template can style it distinctly (amber, not green).

```vue
// WR-01 (76-REVIEW.md): tracks whether a given org's current toggleFeedback
// message is a partial-failure warning (claimFailures > 0) rather than a
// clean success, so the template can style it distinctly (amber, not green).
```

**`src/components/admin/OrganizationsTab.vue:489-493`** — tags: WR-03 — qualifier: unqualified

_Summary:_ WR-03: the Enter-key handler on the admin-email input isn't gated by :disabled the way the submit button is, so a fast double-Enter could double-submit while a prior onboard call is still in flight.

```vue
  // WR-03: the Enter-key handler on the admin-email input isn't gated by
  // :disabled the way the submit button is, so a fast double-Enter could
  // double-submit while a prior onboard call is still in flight. Guard here
  // (shared by both the click and keydown.enter triggers) to match the
  // button's :disabled="isOnboarding".
```

**`src/components/admin/OrganizationsTab.vue:545-546`** — tags: WR-03 — qualifier: unqualified

_Summary:_ WR-03: same double-Enter guard as onOnboard -- the row's Enter-key handler isn't gated by :disabled the way the Assign button is.

```vue
  // WR-03: same double-Enter guard as onOnboard -- the row's Enter-key
  // handler isn't gated by :disabled the way the Assign button is.
```

**`src/components/admin/OrganizationsTab.vue:593`** — tags: WR-03 — qualifier: unqualified

_Summary:_ WR-03: same double-submit guard shape as isOnboarding/isAssigning above.

```vue
  // WR-03: same double-submit guard shape as isOnboarding/isAssigning above.
```

**`src/components/admin/OrganizationsTab.vue:606-610`** — tags: Pitfall, WR-01 — qualifier: 76-RESEARCH.md, 76-REVIEW.md

_Summary:_ WR-01 (76-REVIEW.md): claimFailures is the resilience signal 76-RESEARCH.md's Pitfall 4 designs around ("calling setOrgActive again is a safe, idempotent retry") -- previously dropped on the floor, so an operator had no...

```vue
    // WR-01 (76-REVIEW.md): claimFailures is the resilience signal
    // 76-RESEARCH.md's Pitfall 4 designs around ("calling setOrgActive again
    // is a safe, idempotent retry") -- previously dropped on the floor, so an
    // operator had no way to know Storage enforcement never reached anyone.
    // Surface it as a non-blocking warning instead of an unqualified success.
```

**`src/components/admin/OrganizationsTab.vue:779-789`** — tags: WR-02 — qualifier: 78-REVIEW.md

_Summary:_ ── Enter-church action (R224) ──────────────────────────────────────────── Pure authStore consumer -- no direct Firestore reads/writes here; all authorization lives in enterOrgAsSuperAdmin (auth.ts) + firestore.rules' su...

```vue
// ── Enter-church action (R224) ────────────────────────────────────────────
// Pure authStore consumer -- no direct Firestore reads/writes here; all
// authorization lives in enterOrgAsSuperAdmin (auth.ts) + firestore.rules'
// super-admin arm (78-01-PLAN.md). Not gated on org.active -- entering a
// deactivated org is an explicit, intended support scenario.

// WR-02 (78-REVIEW.md): mirrors this file's other row-action in-flight
// guards (isOnboarding/isAssigning/togglingOrgId/isDeleting) -- previously
// this button had no double-submit guard at all, so a rapid double-click
// (or two different rows in quick succession) could fire two overlapping
// enterOrgAsSuperAdmin calls that interleave.
```

**`src/components/admin/OrganizationsTab.vue:791-792`** — tags: WR-03 — qualifier: 78-REVIEW.md

_Summary:_ WR-03 (78-REVIEW.md), keyed per orgId to match this file's other per-row error state (assignError/toggleError).

```vue
// WR-03 (78-REVIEW.md), keyed per orgId to match this file's other
// per-row error state (assignError/toggleError).
```

**`src/components/admin/OrganizationsTab.vue:802-806`** — tags: WR-03 — qualifier: 78-REVIEW.md

_Summary:_ WR-03 (78-REVIEW.md): enterOrgAsSuperAdmin now signals success/failure instead of silently no-oping (not a super-admin, denied/errored read, or a stale/missing org doc).

```vue
    // WR-03 (78-REVIEW.md): enterOrgAsSuperAdmin now signals success/failure
    // instead of silently no-oping (not a super-admin, denied/errored read,
    // or a stale/missing org doc). Only navigate on a genuine entry --
    // otherwise the super-admin was previously bounced to /select-church by
    // the router's org-selection gate with zero explanation.
```


### `src/components/run/RunHeader.vue`

**`src/components/run/RunHeader.vue:45-55`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01 (R283): a display dot is a REOPEN affordance ONLY when it represents a genuinely CLOSED output within a live session — i.e. `live && !open`.

```vue

/**
 * WR-01 (R283): a display dot is a REOPEN affordance ONLY when it represents a
 * genuinely CLOSED output within a live session — i.e. `live && !open`. Pre-live
 * (State A) the dot is a PASSIVE status indicator: it must NOT emit `reopen`,
 * because pre-live there is no held go-live session and reaching `reopenOutput`
 * would open an un-positioned output window OUTSIDE the go-live gesture (bypassing
 * the honest open state machine and violating "rehearse opens no windows"). An
 * already-open display needs no reopen either, so the affordance is live-and-closed
 * only. The parent's `reopenOutput` also no-ops defensively, but gating the button
 * here keeps the affordance honest (disabled = not actionable).
```

### `src/components/settings/ServiceTemplateEditor.vue`

**`src/components/settings/ServiceTemplateEditor.vue:3-4`** — tags: Pitfall — qualifier: 26-RESEARCH.md

_Summary:_ Deliberately NO scrim, structurally ported from EditSlideDrawer.vue (26-RESEARCH.md Pitfall 7 / R033-era decision) — the settings page

```vue
    <!-- Deliberately NO scrim, structurally ported from EditSlideDrawer.vue
         (26-RESEARCH.md Pitfall 7 / R033-era decision) — the settings page
```

**`src/components/settings/ServiceTemplateEditor.vue:322-328`** — tags: Pitfall — qualifier: unqualified

_Summary:_ ── Draft state (Pitfall #3 — critical) ───────────────────────────────────── Cloned fresh from the store every time the drawer opens.

```vue

// ── Draft state (Pitfall #3 — critical) ─────────────────────────────────────
// Cloned fresh from the store every time the drawer opens. Every mutation below
// (add/remove/reorder/section-change/reset) touches ONLY this local array —
// nothing reaches Firestore or the store until Save Template is clicked. This
// is what keeps a draft edit from mutating DEFAULT_ORG_SETTINGS's shared array
// instance in place for every org that has never configured a template.
```

### `src/components/slides/EditSlideDrawer.vue`

**`src/components/slides/EditSlideDrawer.vue:5`** — tags: Pitfall — qualifier: 26-RESEARCH.md, 26-UI-SPEC.md

_Summary:_ must actively DROP it (26-RESEARCH.md Pitfall 7, 26-UI-SPEC.md Mockup

```vue
         must actively DROP it (26-RESEARCH.md Pitfall 7, 26-UI-SPEC.md Mockup
```

**`src/components/slides/EditSlideDrawer.vue:281`** — tags: WR-01 — qualifier: 25-REVIEW

_Summary:_ for its own duration (25-REVIEW-FIX WR-01), so offering a

```vue
               for its own duration (25-REVIEW-FIX WR-01), so offering a
```

**`src/components/slides/EditSlideDrawer.vue:309-310`** — tags: Pitfall — qualifier: 26-RESEARCH.md

_Summary:_ This drawer's OWN failure ref/handler (26-RESEARCH.md Pitfall 6) — AudioPlayer itself renders no degraded-state

```vue
              <!-- This drawer's OWN failure ref/handler (26-RESEARCH.md
                   Pitfall 6) — AudioPlayer itself renders no degraded-state
```

**`src/components/slides/EditSlideDrawer.vue:503-512`** — tags: Pitfall — qualifier: 26-RESEARCH.md

_Summary:_ open. It follows the selection — it never closes itself on a selection change, only on its own close control or Escape.

```vue
 * open. It follows the selection — it never closes itself on a selection
 * change, only on its own close control or Escape.
 *
 * Renders nothing when closed, and nothing when `entry` is null — the latter
 * covers both "nothing selected" and the pre-materialization window where a
 * selected slide's synthetic fallback id has no stored entry behind it yet
 * (26-RESEARCH.md Pitfall 1). This is a plain `v-if` guard, not a loading
 * state — the window is sub-second in practice and the caller (`SlidesTab.vue`)
 * already handles clearing a dangling selection.
 */
```

**`src/components/slides/EditSlideDrawer.vue:638-647`** — tags: WR-04 — qualifier: unqualified

_Summary:_ WR-04: `confirmDiscard()` is instantiated below (`unsavedGuard`, Task 3), but this is the point where its ONLY still-real usage site is missing — every other consumer (AvailabilityDrawer.vue, RosterView.vue, SongSlideOve...

```vue

// WR-04: `confirmDiscard()` is instantiated below (`unsavedGuard`, Task 3),
// but this is the point where its ONLY still-real usage site is missing —
// every other consumer (AvailabilityDrawer.vue, RosterView.vue,
// SongSlideOver.vue) gates its own close handler on it. 33-09 deleted this
// drawer's in-body "Edit in song"/"Edit in scripture" links (and the guard
// check that used to gate them) without re-wiring the guard anywhere else,
// leaving `capture()` calls that fed a check nothing read. Restoring it here
// closes the gap for the × button and Escape; the menu-dispatched
// navigation path (`SlidesTab.vue`'s `onMenuAction`) is closed separately via
```

**`src/components/slides/EditSlideDrawer.vue:778-789`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Flips the selected section entry's speaker to the next one in the 3-way cycle (RESEARCH Pitfall 5 — the old binary ternary silently mapped ANY non-LEADER value, including ALL, straight to LEADER, corrupting an ALL slide...

```vue

/**
 * Flips the selected section entry's speaker to the next one in the 3-way
 * cycle (RESEARCH Pitfall 5 — the old binary ternary silently mapped ANY
 * non-LEADER value, including ALL, straight to LEADER, corrupting an ALL
 * slide on a single click). Modeled on `onLoopToggle`'s immediate-write
 * shape (this plan's key_links): re-checks `canMutate` inside the handler
 * (not just the template `v-if`), reads the group's CURRENT slides as the
 * base, maps only the selected entry, and awaits the store call so a
 * rejected write reaches Vue's handler like every other write here.
 * Deliberately NOT debounced — a discrete choice, not a stream of
 * keystrokes, so routing it through the debounced `body` machinery could
```

**`src/components/slides/EditSlideDrawer.vue:928-929`** — tags: Pitfall — qualifier: 26-RESEARCH.md

_Summary:_ This drawer's OWN failure state (26-RESEARCH.md Pitfall 6) — `AudioPlayer` is a deliberately dumb primitive that only emits `error`, it renders no degraded-state text of its own.

```vue

/** This drawer's OWN failure state (26-RESEARCH.md Pitfall 6) — `AudioPlayer` is a deliberately dumb primitive that only emits `error`, it renders no degraded-state text of its own. Reset whenever the attached file or the edited slide changes, so a stale failure never sticks to a different file (see the two watchers below). */
```

**`src/components/slides/EditSlideDrawer.vue:1189-1201`** — tags: CR-02, Pitfall — qualifier: 25-REVIEW, 26-RESEARCH.md

_Summary:_ The fresh-base write (T-26-05-01, 26-RESEARCH.md Pattern 2/Pitfall 2).

```vue

/**
 * The fresh-base write (T-26-05-01, 26-RESEARCH.md Pattern 2/Pitfall 2). Reads
 * `props.group.slides` FRESH at the moment this function actually runs — never
 * a copy captured when the drawer opened or when the debounce timer was
 * scheduled. A stale base would silently discard any change that landed
 * elsewhere during a long-open session; this is the exact data-loss class
 * 25-REVIEW CR-02 already had to fix once, and every later write this drawer
 * adds must route through this same helper for that reason. `entryId` is
 * captured separately, at schedule time — it names WHICH entry to update even
 * if the drawer's selection has since moved on to a different slide (see
 * `flushField`, called when the edited entry changes).
 */
```

**`src/components/slides/EditSlideDrawer.vue:1269-1276`** — tags: CR-01 — qualifier: unqualified

_Summary:_ CR-01: sequential, NOT Promise.all. Each `writeField` call reads `props.group.slides` fresh at the moment it runs — if two fields' debounces both fired concurrently, both would read the exact same stale base and each wri...

```vue
  // CR-01: sequential, NOT Promise.all. Each `writeField` call reads
  // `props.group.slides` fresh at the moment it runs — if two fields'
  // debounces both fired concurrently, both would read the exact same
  // stale base and each write's `next` would silently clobber the other's
  // field with the stale value. Awaiting each flush in turn means the
  // second flush's `writeField` reads the post-commit base the first
  // flush just wrote (props.group updates from the store's own snapshot
  // round-trip before the next await resumes), so both edits survive.
```

**`src/components/slides/EditSlideDrawer.vue:1518-1524`** — tags: WR-04 — qualifier: unqualified

_Summary:_ WR-04: exposes the unsaved-edit guard so `SlidesTab.vue`'s `onMenuAction` can gate the menu-dispatched "Edit in song"/"Edit in scripture" navigations on THIS drawer's own dirty state before routing away from it — the one...

```vue

// WR-04: exposes the unsaved-edit guard so `SlidesTab.vue`'s `onMenuAction`
// can gate the menu-dispatched "Edit in song"/"Edit in scripture"
// navigations on THIS drawer's own dirty state before routing away from it —
// the one navigation path this component itself no longer owns (33-09
// relocated it), so it cannot gate it internally the way `onClose`/
// `onKeydown` above do.
```

### `src/components/slides/SlideActionMenu.vue`

**`src/components/slides/SlideActionMenu.vue:83-97`** — tags: WR-03 — qualifier: unqualified

_Summary:_ optimal, and recorded as a decision rather than an oversight. `@click.stop` on the trigger is the exact idiom `SlideCard.vue`'s drag grip already established: the click must never bubble to the card's own select handler,...

```vue
 * optimal, and recorded as a decision rather than an oversight.
 *
 * `@click.stop` on the trigger is the exact idiom `SlideCard.vue`'s drag
 * grip already established: the click must never bubble to the card's own
 * select handler, so opening the menu never re-fires selection.
 *
 * WR-03: opening the panel moves focus onto its first `menuitem`. The
 * trigger `<button>` and the `role="menu"` panel `<div>` are DOM siblings,
 * not ancestor/descendant, and nothing previously moved focus into the
 * panel when `open` became `true` — so `onPanelKeydown`'s `Escape` handler
 * (bound to the panel's own `@keydown`) never received the event until the
 * user had separately tabbed focus into the panel. Focusing the first item
 * on open both fixes Escape and matches the WAI-ARIA menu-button pattern's
 * expectation that opening a menu moves focus onto it.
 */
```

### `src/components/slides/SlideCanvas.vue`

**`src/components/slides/SlideCanvas.vue:299-306`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Phase 90 — extracted from PresentationViewer.vue. SlideCanvas owns ONLY per-slide rendering + media (video/audio) playback lifecycle + the background layer.

```vue

/**
 * Phase 90 — extracted from PresentationViewer.vue. SlideCanvas owns ONLY
 * per-slide rendering + media (video/audio) playback lifecycle + the
 * background layer. It does NOT own exit chrome, nav chrome, keyboard,
 * fullscreen, Escape teardown, or the font-load gate — those stay in
 * PresentationViewer.vue (PITFALLS Pitfall 6/19 — a deliberate NON-copy).
 */
```

**`src/components/slides/SlideCanvas.vue:379-386`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Keys the VideoPlayer instance on the SLIDE (WR-02) so switching between two video slides always remounts the player — even two adjacent video slides sharing an identical `videoSrc` must not reuse the child instance, or a...

```vue

/**
 * Keys the VideoPlayer instance on the SLIDE (WR-02) so switching between two
 * video slides always remounts the player — even two adjacent video slides
 * sharing an identical `videoSrc` must not reuse the child instance, or a
 * slide that went through the muted-retry path would silently stay muted on
 * the next one with zero on-screen indication.
 */
```

**`src/components/slides/SlideCanvas.vue:388-395`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Keys the AudioPlayer instance on the SLIDE, not just the media URL (WR-02).

```vue

/**
 * Keys the AudioPlayer instance on the SLIDE, not just the media URL (WR-02).
 * Phase 24 (R030/D-04): a GROUP BED (`audioFromBed` true, with a `groupId`)
 * is deliberately kept as ONE continuous instance across every slide of that
 * group (R030 bed continuity). A slide with no `groupId` always falls
 * through to the per-slide key.
 */
```

### `src/components/slides/SlideCard.vue`

**`src/components/slides/SlideCard.vue:104-105`** — tags: WR-03 — qualifier: 48-REVIEW

_Summary:_ WR-03 (48-REVIEW): the invisible hit-area padding is asymmetric, not

```vue
      <!--
        WR-03 (48-REVIEW): the invisible hit-area padding is asymmetric, not
```

### `src/components/slides/SlideGrid.vue`

**`src/components/slides/SlideGrid.vue:357-371`** — tags: Pitfall — qualifier: 25-RESEARCH.md

_Summary:_ slide-group mutation in the codebase does (never the `localService` deep-watch autosave).

```vue
 * slide-group mutation in the codebase does (never the `localService`
 * deep-watch autosave).
 *
 * Filters `assembledSlideshow` by the selected plan item's ARRAY index
 * (`slotArrayIndex`), never by `groupId` — `groupId` is only set on the
 * group-resolved emission path and is absent for the entire window before a
 * group's Firestore snapshot lands (25-RESEARCH.md Pitfall 2), even though
 * the fallback-path slides being shown are already real and correct.
 *
 * Ships no Grid/List toggle (D-09). The reconciliation confirm/review surface
 * (26-06) was removed entirely in Phase 30 (R048) — every group write is now
 * unconditional; only `replaceGroupSlides` (the concurrent-write transaction
 * merge) remains.
 *
 * 25-07 adds the drop tile (always the grid's last item, D-13), a whole-grid
```

**`src/components/slides/SlideGrid.vue:635-643`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: reset whenever the selected plan item changes. `openMenuEntryId` is local, persistent state on this instance — it is NOT remounted when `SlidesTab.vue`'s rail selection changes plan item, only `selectedSlot`/ `gro...

```vue

// WR-02: reset whenever the selected plan item changes. `openMenuEntryId` is
// local, persistent state on this instance — it is NOT remounted when
// `SlidesTab.vue`'s rail selection changes plan item, only `selectedSlot`/
// `group` props change and `cards` recomputes to a different filtered list.
// Without this, returning to a previously-selected plan item whose group
// still contains a `GroupSlideEntry.id` matching the stale `openMenuEntryId`
// (stable ids, so this reliably recurs) makes that card's menu reopen with
// no click, tap, or keypress from the user.
```

**`src/components/slides/SlideGrid.vue:661-668`** — tags: WR-01 — qualifier: unqualified

_Summary:_ No on-demand materialization step is needed here, unlike every slide-appending path above: `setGroupBedMedia` already creates a skeleton group document when none exists, and it does so with a merging write (`{ merge: tru...

```vue
//
// No on-demand materialization step is needed here, unlike every
// slide-appending path above: `setGroupBedMedia` already creates a skeleton
// group document when none exists, and it does so with a merging write
// (`{ merge: true }`) specifically so a concurrently-landing
// `ensureGroupMaterialized`/`materializeGroupIfMissing` call cannot be
// clobbered (WR-01). Adding a redundant materialization call here would only
// reintroduce that race, not prevent it.
```

**`src/components/slides/SlideGrid.vue:699-711`** — tags: WR-01 — qualifier: unqualified

_Summary:_ --- Task 2: group background control — the caller-does-the-write idiom, mirroring `onAttachGroupMusic`/`onRemoveGroupMusic` exactly.

```vue
// --- Task 2: group background control — the caller-does-the-write idiom,
// mirroring `onAttachGroupMusic`/`onRemoveGroupMusic` exactly. Background is
// group MEDIA, so writes go through `canWriteGroupMedia`, never
// `canMutateGroup` (same reasoning as the music control above). No
// on-demand materialization step is needed for the same reason the music
// handlers need none — `setGroupBackground`'s own merging skeleton-create
// already covers a plan item with no group document yet (WR-01). ---

/**
 * `applies to all {N} slides in this group, unless a slide sets its own` —
 * the Copywriting Contract's group-background caption, with the real card
 * count substituted (R055).
 */
```

**`src/components/slides/SlideGrid.vue:767-774`** — tags: CR-02 — qualifier: unqualified

_Summary:_ handler in this file does the same. Entries are sorted by their existing `order` before filtering, mirroring the drag-reorder handler's own defensive sort, so the survivors' relative PLAY order (not raw array insertion o...

```vue
// handler in this file does the same. Entries are sorted by their existing
// `order` before filtering, mirroring the drag-reorder handler's own
// defensive sort, so the survivors' relative PLAY order (not raw array
// insertion order) is what gets renumbered. Does NOT touch
// `group.sourceSignature` — a removal changes no source (R107 territory is
// untouched here) — and passes `group.slides` as `baseSlides` so the write
// routes through the CR-02 concurrent-write transaction merge, exactly like
// every other group-slides write in this file.
```

**`src/components/slides/SlideGrid.vue:841-847`** — tags: CR-02 — qualifier: unqualified

_Summary:_ CR-02: `entries` (unsorted, as returned) is the snapshot this append was computed FROM — passed through as `baseSlides` so a concurrent write (a double-click's other call, or a drag-reorder landing first) is detected and...

```vue
    // CR-02: `entries` (unsorted, as returned) is the snapshot this append
    // was computed FROM — passed through as `baseSlides` so a concurrent
    // write (a double-click's other call, or a drag-reorder landing first)
    // is detected and merged rather than silently overwritten. See
    // `replaceGroupSlides`'s doc comment. Re-sorting THIS argument would
    // defeat the merge — only the payload passed as `slides` goes through
    // `appendToGroup`.
```

**`src/components/slides/SlideGrid.vue:920`** — tags: CR-02 — qualifier: unqualified

_Summary:_ CR-02: see `onAddSlide` — `entries` (unsorted) is this append's base snapshot.

```vue
    // CR-02: see `onAddSlide` — `entries` (unsorted) is this append's base snapshot.
```

**`src/components/slides/SlideGrid.vue:941-945`** — tags: CR-02 — qualifier: unqualified

_Summary:_ CR-02: `baseEntries` is the snapshot this whole drop's appends were computed FROM (captured once, before the loop below builds up its own list of new entries) — passed through to `replaceGroupSlides` as `baseSlides` so a...

```vue
    // CR-02: `baseEntries` is the snapshot this whole drop's appends were
    // computed FROM (captured once, before the loop below builds up its own
    // list of new entries) — passed through to `replaceGroupSlides` as
    // `baseSlides` so a concurrent write is detected and merged rather than
    // silently overwritten.
```

**`src/components/slides/SlideGrid.vue:1179-1183`** — tags: CR-02 — qualifier: unqualified

_Summary:_ CR-02: `currentGroup.slides` (read from props above, same as `sorted`/`reordered` were derived from) is this write's base snapshot — passed through so a concurrent append that lands between this read and this write is de...

```vue
            // CR-02: `currentGroup.slides` (read from props above, same as
            // `sorted`/`reordered` were derived from) is this write's base
            // snapshot — passed through so a concurrent append that lands
            // between this read and this write is detected and merged rather
            // than silently overwritten by the reorder's full-array replace.
```

### `src/components/slides/SlidesTab.vue`

**`src/components/slides/SlidesTab.vue:79-114`** — tags: Pitfall, WR-02 — qualifier: 25-RESEARCH.md, 26-RESEARCH.md

_Summary:_ present (D-05). - `selectedSlideId` — the individual slide (an assembled slide's own id, which equals the stored `GroupSlideEntry.id` once the group has materialized) the future drawer opens against.

```vue
 *    present (D-05).
 *  - `selectedSlideId` — the individual slide (an assembled slide's own id,
 *    which equals the stored `GroupSlideEntry.id` once the group has
 *    materialized) the future drawer opens against. Always cleared when the
 *    selected slot changes (a slide selection belongs to its own group), and
 *    cleared again if it stops resolving against the selected slot's own
 *    assembled slides — 25-RESEARCH.md Pitfall 4 documents that a slide's id
 *    changes shape the moment its group materializes (a slot-derived
 *    fallback id gives way to the stored entry id). Fixing the id-minting
 *    scheme itself is Phase 23's WR-02 contract, not this component's job.
 *
 * "Edit in scripture" relay (Phase 26-03, D-15): `ServiceEditorView`'s tab
 * state and its per-plan-item scripture-editor expansion set are local state
 * it alone owns — nothing under this component may reach them directly
 * (26-RESEARCH.md Pitfall 5). `requestEditInScripture` emits
 * `navigate-to-scripture-editor` carrying the selected plan item's raw array
 * index, the one upward channel a page-level action can travel through.
 * Phase 33-09 (R051/R052): the trigger moved from an in-drawer link to the
 * 3-dot menu's `edit-in-scripture` key — `onMenuAction` calls this exact
 * function directly, so the drawer never reaches page state and this
 * component's own relay plumbing is unchanged.
 *
 * Edit Slide drawer seam (Phase 26-05, R033): `selectedEntry` resolves
 * `selectedSlideId` against the selected group's stored slides by a DIRECT id
 * lookup — for a materialized group, `AssembledSlide.slide.id` equals
 * `GroupSlideEntry.id` verbatim (26-RESEARCH.md Pattern 1), so no mapping
 * layer exists or is needed. A selection with no matching entry (the
 * pre-materialization fallback-id window, Pitfall 1) resolves to `null` and
 * the drawer renders nothing — not a loading state.
 *
 * Phase 33-09 (R051): selecting a card no longer opens the drawer — that
 * coupling is exactly what R051 exists to break, so a slide can be dragged
 * without triggering edit. `drawerOpen` is now set true only by
 * `onMenuAction`'s edit key and by the post-duplicate follow-selection
 * handler (`selectSlideById`), and false only by the drawer's own `close`
 * emit or by the selection itself disappearing (below). It is still NEVER
```

**`src/components/slides/SlidesTab.vue:175-181`** — tags: WR-04 — qualifier: unqualified

_Summary:_ WR-04: a ref to the mounted drawer so `onMenuAction`'s navigation keys ("edit-in-song"/"edit-in-scripture") can gate on the drawer's OWN unsaved edit guard before routing away — the one path this component owns that the...

```vue

/**
 * WR-04: a ref to the mounted drawer so `onMenuAction`'s navigation keys
 * ("edit-in-song"/"edit-in-scripture") can gate on the drawer's OWN unsaved
 * edit guard before routing away — the one path this component owns that the
 * drawer itself cannot self-guard, since 33-09 relocated the navigation here.
 */
```

**`src/components/slides/SlidesTab.vue:250-252`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Clear a dangling slide selection rather than chasing the id-minting scheme itself (Pitfall 4).

```vue

// Clear a dangling slide selection rather than chasing the id-minting
// scheme itself (Pitfall 4).
```

**`src/components/slides/SlidesTab.vue:303-313`** — tags: WR-04 — qualifier: unqualified

_Summary:_ 34-07 (owner UAT F1) — the drawer's Slide Text scripture-route control.

```vue

/**
 * 34-07 (owner UAT F1) — the drawer's Slide Text scripture-route control.
 * Runs the SAME unsaved-drawer guard the menu path runs (WR-04), then closes
 * the drawer and calls the SAME `requestEditInScripture` relay the menu's
 * `edit-in-scripture` key calls, so both routes converge on one relay and
 * therefore one mounted editor. The drawer is closed because the editor now
 * opens as a modal over this tab rather than by navigating away — leaving
 * the drawer open behind it would leave two editing surfaces stacked on the
 * same entry.
 */
```

**`src/components/slides/SlidesTab.vue:351-359`** — tags: Pitfall — qualifier: 26-RESEARCH.md

_Summary:_ DIRECT id lookup against `selectedGroup.slides`, with no mapping step.

```vue
 * DIRECT id lookup against `selectedGroup.slides`, with no mapping step. For
 * a materialized group `AssembledSlide.slide.id` equals `GroupSlideEntry.id`
 * verbatim (26-RESEARCH.md Pattern 1, verified against
 * `slideshowAssembler.ts`'s `emitFromGroup`). Resolves to `null` — treated by
 * the drawer as "nothing selected," never a loading state — for the
 * pre-materialization fallback-id window where a selected slide's synthetic
 * id has no `GroupSlideEntry` counterpart yet (Pitfall 1); do not "fix" that
 * window with a spinner.
 */
```

**`src/components/slides/SlidesTab.vue:442-455`** — tags: WR-04 — qualifier: unqualified

_Summary:_ the drawer has one body, so there is no mode to set — Duplicate and Delete simply open it, because that is where their EXISTING write paths live (the duplicate write, the inline delete confirm) — this dispatcher itself n...

```vue
 * the drawer has one body, so there is no mode to set — Duplicate and Delete
 * simply open it, because that is where their EXISTING write paths live (the
 * duplicate write, the inline delete confirm) — this dispatcher itself never
 * calls a delete or duplicate store action; it only ever sets a pending
 * request for the drawer to act on (P-01).
 *
 * WR-04: "edit-in-song"/"edit-in-scripture" are checked against the OPEN
 * drawer's own unsaved-edit guard BEFORE `selectedSlideId` is reassigned
 * below — the drawer's own `watch(() => props.entry)` starts flushing/
 * resetting for the new entry the moment the selection changes, so asking
 * afterward would already be asking about the wrong entry. A cancelled
 * confirm leaves the selection and drawer state untouched, so an in-flight
 * edit on the entry being left is never silently abandoned.
 */
```

**`src/components/slides/SlidesTab.vue:475-483`** — tags: WR-04 — qualifier: unqualified

_Summary:_ The read-only song badge (SlideGrid's `edit-in-song` emit, owner UAT) — a discoverable route to the SAME song-lyrics editor the 3-dot menu's `edit-in-song` key opens.

```vue

/**
 * The read-only song badge (SlideGrid's `edit-in-song` emit, owner UAT) — a
 * discoverable route to the SAME song-lyrics editor the 3-dot menu's
 * `edit-in-song` key opens. Takes the exact same path as that menu case: honour
 * an open drawer's unsaved-edit guard first (WR-04), then `router.push` the
 * song-edit link on its lyrics tab. The `songId` is the group's own, read off
 * the selected SONG slot inside SlideGrid — never off the DOM event.
 */
```

### `src/composables/useAutoSave.ts`

**`src/composables/useAutoSave.ts:86-94`** — tags: CR-01 — qualifier: unqualified

_Summary:_ CR-01: a newer mutation may have already run its own watcher while this save was in flight, advancing status to 'pending' and arming its own follow-up timer.

```ts
        // CR-01: a newer mutation may have already run its own watcher while
        // this save was in flight, advancing status to 'pending' and arming
        // its own follow-up timer. Don't stomp that back to 'saved' — doing
        // so lies about an edit that hasn't actually been persisted, and
        // (worse, for callers whose "is there anything left to save" check
        // is keyed off something other than this status) can make the
        // follow-up timer believe there's nothing left to do.
        //
        // The `as AutoSaveStatus` widen is required, not decorative: TS's
```

**`src/composables/useAutoSave.ts:133-141`** — tags: CR-02 — qualifier: unqualified

_Summary:_ CR-02: check for an inflight save BEFORE clearing the debounce timer, not after.

```ts
    // CR-02: check for an inflight save BEFORE clearing the debounce timer,
    // not after. A newer mutation can have set status back to 'pending' and
    // armed its own follow-up timer while a PREVIOUS save is still in
    // flight; clearing the timer unconditionally here — as this used to —
    // destroys that follow-up timer, and then the `if (saving) return`
    // below no-ops without ever performing a save. The edit becomes
    // unreachable: no timer is armed, and this call already returned. By
    // returning here first, the already-armed timer survives to retry the
    // edit on its own schedule once the inflight save clears `saving`.
```

**`src/composables/useAutoSave.ts:159-161`** — tags: CR-01 — qualifier: unqualified

_Summary:_ CR-01, mirrored from scheduleSave's success handler above (including the `as AutoSaveStatus` widen — see that comment for why it's required).

```ts
      // CR-01, mirrored from scheduleSave's success handler above (including
      // the `as AutoSaveStatus` widen — see that comment for why it's
      // required).
```

### `src/composables/useOutputWindow.ts`

**`src/composables/useOutputWindow.ts:1-15`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Shared output-window lifecycle-core (Phase 94, R272 reuse-not-fork).

```ts
/**
 * Shared output-window lifecycle-core (Phase 94, R272 reuse-not-fork).
 *
 * Extracted verbatim-in-behavior from AudienceOutputView.vue so the audience
 * window and the Phase 94 confidence window share ONE lifecycle-core instead of
 * copy-pasting it. This composable owns: the `?org=`/`:serviceId` scoping, the
 * WR-02 org-mismatch subscribe gate, the read-only `useSlideshowAssembly`
 * (canWrite omitted), the receive-only run channel (onState/postHello/close —
 * NEVER postState), the bounded font gate, `rootStyle` (CSS-var wrapper +
 * cursor:none-while-fullscreen), non-teardown fullscreen-loss recovery, and the
 * Screen Wake Lock.
 *
 * It MUST be called from inside a component `setup()` — it registers
 * `onMounted`/`onUnmounted` on the calling instance so cleanup (channel close,
 * listener removal, wake-lock release, unsubscribeAll) runs on that view's
```

**`src/composables/useOutputWindow.ts:58-67`** — tags: WR-02 — qualifier: unqualified

_Summary:_ ── Shared service-load + read-only assembly slice (Phase 95) ─────────────── useServiceAssembly owns the serviceId/org scoping, the localService initial-load watch, the read-only useSlideshowAssembly (canWrite omitted),...

```ts

  // ── Shared service-load + read-only assembly slice (Phase 95) ───────────────
  // useServiceAssembly owns the serviceId/org scoping, the localService
  // initial-load watch, the read-only useSlideshowAssembly (canWrite omitted),
  // and the WR-02 org-mismatch subscribe gate (in ITS onMounted). It is called
  // FIRST here so that onMounted registers BEFORE this composable's onMounted —
  // preserving the subscribe-before-channel ordering (the subscribe fires before
  // the run channel opens). This composable keeps the output-only lifecycle
  // (channel, font gate, cursor, fullscreen recovery, wake lock, and the
  // onUnmounted serviceStore.unsubscribeAll()).
```

**`src/composables/useOutputWindow.ts:102-105`** — tags: Pitfall — qualifier: unqualified

_Summary:_ This listener ONLY updates isFullscreen. It must NEVER call any exit/teardown/ close/unmount path — the single most dangerous copy-paste risk from PresentationViewer.handleFullscreenChange (Pitfall 6).

```ts

  // This listener ONLY updates isFullscreen. It must NEVER call any exit/teardown/
  // close/unmount path — the single most dangerous copy-paste risk from
  // PresentationViewer.handleFullscreenChange (Pitfall 6).
```

**`src/composables/useOutputWindow.ts:129-130`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Pitfall 5 — only a synchronous in-window gesture can re-enter; the requestFullscreen() call MUST be the handler's first statement, no await.

```ts
    // Pitfall 5 — only a synchronous in-window gesture can re-enter; the
    // requestFullscreen() call MUST be the handler's first statement, no await.
```

**`src/composables/useOutputWindow.ts:226-231`** — tags: WR-02 — qualifier: unqualified

_Summary:_ ── Lifecycle ────────────────────────────────────────────────────────────── NOTE: the WR-02 org-mismatch subscribe gate now lives in useServiceAssembly's onMounted, which — because useServiceAssembly() is called first in...

```ts

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  // NOTE: the WR-02 org-mismatch subscribe gate now lives in useServiceAssembly's
  // onMounted, which — because useServiceAssembly() is called first in this
  // setup — registers and fires BEFORE this onMounted. So the service source is
  // (re)keyed to the resolved org before this handler opens the run channel.
```

### `src/composables/useRunControl.ts`

**`src/composables/useRunControl.ts:5-19`** — tags: WR-01 — qualifier: unqualified

_Summary:_ entire Phase 92-96 control machinery lives in one seam — mirroring how useOutputWindow.ts owns the output-window lifecycle.

```ts
 * entire Phase 92-96 control machinery lives in one seam — mirroring how
 * useOutputWindow.ts owns the output-window lifecycle. This composable owns: the
 * single-writer wp-run-{serviceId} channel (index/seq/handle + postIndex +
 * resendCurrent + the onHello resend + the on-mount slide-0 post + the
 * late-arriving-assembly post), the navigation model, the rail derivations, the
 * honest open state machine (OutputStatus + openOutputs/openPlaced/openUnplaced +
 * bothOpened), the WR-01 stale guard (goLiveRequestId/isUnmounted), the Phase
 * 96-01 live-ops recovery (closed-poll + screenschange reassign + per-role
 * reopen), the exit/teardown ordering (stopRecoveryWatchers before closeOutputs),
 * and the document keyboard handler.
 *
 * It MUST be called from inside a component setup() — it registers
 * onMounted/onUnmounted on the calling instance so the channel open + keyboard
 * listener and their teardown run on that view's lifecycle exactly as the
 * un-extracted view did. useServiceAssembly() is called FIRST so its onMounted
```

**`src/composables/useRunControl.ts:83-88`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Shared service-load + read-only assembly core (95-01). Owns ?org=/:serviceId scoping, the localService initial-load watch, the read-only assembly, and the WR-02 subscribe gate — do NOT re-do any of it here, and (delibera...

```ts
  // Shared service-load + read-only assembly core (95-01). Owns ?org=/:serviceId
  // scoping, the localService initial-load watch, the read-only assembly, and the
  // WR-02 subscribe gate — do NOT re-do any of it here, and (deliberately) it
  // registers NO unsubscribeAll, so this in-app route never tears down peers.
  // Called FIRST so its onMounted subscribe registers before this composable's
  // channel-opening onMounted (subscribe-before-channel ordering preserved).
```

**`src/composables/useRunControl.ts:280-286`** — tags: WR-01, WR-02 — qualifier: unqualified

_Summary:_ PRE-LIVE (State A, !live): ONLY Enter (go live) and Escape act.

```ts
    // PRE-LIVE (State A, !live): ONLY Enter (go live) and Escape act. The
    // transport (arrows/Space) and blackout (B) keys are INERT — there is nothing
    // on the screens to navigate or black out before go-live, and an inert
    // pre-live keyboard complements WR-01's no-action-pre-live posture (a stray
    // keypress can no longer silently change what go-live will show). WR-02: Enter
    // fires the SAME go-live action as run-go-live-btn, wiring the "Press Enter to
    // go live" hint the pre-flight panel advertises.
```

**`src/composables/useRunControl.ts:363-364`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: which display was refused when EXACTLY ONE of the two window.open calls came back null (the honest 'partial' state names the dark monitor).

```ts
  // WR-02: which display was refused when EXACTLY ONE of the two window.open
  // calls came back null (the honest 'partial' state names the dark monitor).
```

**`src/composables/useRunControl.ts:419-432`** — tags: WR-01 — qualifier: unqualified

_Summary:_ PER-ROLE REOPEN (R274) — re-runs the open+place for THAT role ONLY.

```ts

  /**
   * PER-ROLE REOPEN (R274) — re-runs the open+place for THAT role ONLY. It is
   * SYNCHRONOUS: it resolves the role's screen from the already-HELD
   * liveScreenDetails.screens via the existing resolveScreen (NO fresh
   * getScreenDetails), so it opens no stale-resolution window and needs no new
   * token — the original openOutputs().then WR-01 guard stays intact.
   * openWindow re-stores outputWindows[name] and best-effort moveTo +
   * requestFullscreen({ screen }). The closed ref is cleared ONLY on a non-null
   * handle: a pop-up-blocker-refused reopen keeps the amber row and never flips the
   * line back to green (honesty rule). Position is NOT persisted — the reopened
   * output's hello → onHello(resendCurrent) resends the CURRENT index, so it
   * returns to the exact current slide; index.value is never touched here.
   */
```

**`src/composables/useRunControl.ts:439-446`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01 (defense-in-depth): NEVER open an output window outside a real live session that has already gone live.

```ts
    // WR-01 (defense-in-depth): NEVER open an output window outside a real live
    // session that has already gone live. A reopen is only ever legitimate as a
    // recovery of a genuinely-closed output — which requires (a) live===true and
    // (b) a HELD go-live ScreenDetails (liveScreenDetails). Pre-flight (live=false)
    // and Rehearse (live=true but no getScreenDetails was ever resolved, so
    // liveScreenDetails===null) both NO-OP here, so a stray dot/panel emit can
    // never open an un-positioned window that bypasses the honest open state
    // machine (outputStatus would still read idle while a real window was live).
```

**`src/composables/useRunControl.ts:457-467`** — tags: WR-01 — qualifier: unqualified

_Summary:_ IN-PLACE reassign recovery (R274 / WR-01) — the reassign banner's PRIMARY action.

```ts

  /**
   * IN-PLACE reassign recovery (R274 / WR-01) — the reassign banner's PRIMARY
   * action. Reopens the affected output role(s) against the CURRENT (post-change)
   * live screens WITHOUT unmounting the control, reusing the reopenOutput →
   * resolveScreen → openWindow path. Position is NOT persisted here: each reopened
   * output announces itself with a hello → onHello(resendCurrent) resends the
   * CURRENT index, so it returns to the exact live slide. If a monitor is truly
   * gone resolveScreen yields null and the output opens un-positioned (honest
   * fallback) — either way the running session (index/seq/channel + the other open
   * output) survives, unlike the old same-tab /monitor-setup navigation that tore
```

**`src/composables/useRunControl.ts:554-560`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: monotonic Go-live token + unmount flag guarding a LATE getScreenDetails() resolution from re-opening orphaned output windows after the operator has moved on (a fresh Go-live click, a confirmed exit, or an unmount)...

```ts

  // WR-01: monotonic Go-live token + unmount flag guarding a LATE
  // getScreenDetails() resolution from re-opening orphaned output windows after
  // the operator has moved on (a fresh Go-live click, a confirmed exit, or an
  // unmount). Mirrors MonitorSetupView's detectRequestId precedent: every new
  // attempt bumps the token, and confirmExit/onUnmounted invalidate any in-flight
  // resolve so its .then/.catch is a no-op — no window is ever opened after exit.
```

**`src/composables/useRunControl.ts:694-704`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02 — honest gate on the TWO output handles before any success claim.

```ts

  /**
   * WR-02 — honest gate on the TWO output handles before any success claim.
   * A "placed"/"fallback" claim requires BOTH windows to have real (non-null)
   * handles, because some browsers grant only ONE window per user activation:
   *  - both null → 'blocked' (pop-ups refused, nothing opened)
   *  - one null  → 'partial' (one display is live, the other is dark) — the
   *                banner names the refused role and offers retry, NEVER green
   *  - both open → returns true so the caller may make its success claim
   * Returns true ONLY when both windows opened.
   */
```

**`src/composables/useRunControl.ts:723-725`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Gate the success claim on BOTH real windows (WR-02): fewer than two → an honest blocked/partial state, never a green "Displays ready" over a dark monitor.

```ts
    // Gate the success claim on BOTH real windows (WR-02): fewer than two → an
    // honest blocked/partial state, never a green "Displays ready" over a dark
    // monitor.
```

**`src/composables/useRunControl.ts:747-748`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: the amber "two windows opened" fallback claim requires BOTH handles; both-null is blocked, exactly-one-null is the honest partial state.

```ts
    // WR-02: the amber "two windows opened" fallback claim requires BOTH handles;
    // both-null is blocked, exactly-one-null is the honest partial state.
```

**`src/composables/useRunControl.ts:773-781`** — tags: Pitfall — qualifier: unqualified

_Summary:_ The Go-live gesture entry — bound to the run-go-live-btn click, run SYNCHRONOUSLY.

```ts
  /**
   * The Go-live gesture entry — bound to the run-go-live-btn click, run
   * SYNCHRONOUSLY. getScreenDetails() is the FIRST statement after the plain
   * feature-detect (the only line before it is a synchronous ref set), with NO
   * await/store/router before it, so its .then runs while the click's transient
   * activation is still live and window.open + requestFullscreen({ screen })
   * inside openPlaced act within the sanctioned one-gesture window (Pitfall 1/5).
   * Mirrors MonitorSetupView.onDetectClick.
   */
```

**`src/composables/useRunControl.ts:783-785`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: claim a fresh token for THIS gesture. A second Go-live click, a confirmed exit, or an unmount bumps goLiveRequestId, so an earlier in-flight getScreenDetails() resolve becomes stale and is dropped below.

```ts
    // WR-01: claim a fresh token for THIS gesture. A second Go-live click, a
    // confirmed exit, or an unmount bumps goLiveRequestId, so an earlier in-flight
    // getScreenDetails() resolve becomes stale and is dropped below.
```

**`src/composables/useRunControl.ts:809-810`** — tags: Pitfall, WR-01 — qualifier: unqualified

_Summary:_ Stale (a newer attempt superseded us) or the view has torn down — do NOT open windows that would be orphaned (Pitfall 6 / WR-01).

```ts
        // Stale (a newer attempt superseded us) or the view has torn down — do
        // NOT open windows that would be orphaned (Pitfall 6 / WR-01).
```

**`src/composables/useRunControl.ts:812-817`** — tags: WR-01 — qualifier: unqualified

_Summary:_ MONITOR-UNPLUG (R274): HOLD this Go-live ScreenDetails and attach the screenschange listener — AFTER the WR-01 stale guard so a late resolve after exit attaches nothing.

```ts
        // MONITOR-UNPLUG (R274): HOLD this Go-live ScreenDetails and attach the
        // screenschange listener — AFTER the WR-01 stale guard so a late resolve
        // after exit attaches nothing. Swap off any prior handle first (mirrors
        // MonitorSetupView). The typeof guard is load-bearing: a ScreenDetails
        // without listener support (older engines / a partial test fake) is
        // skipped rather than throwing into the .catch.
```

**`src/composables/useRunControl.ts:908-909`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: invalidate any in-flight Go-live resolve so a late getScreenDetails() cannot re-open orphaned output windows after the operator has exited.

```ts
    // WR-01: invalidate any in-flight Go-live resolve so a late getScreenDetails()
    // cannot re-open orphaned output windows after the operator has exited.
```

**`src/composables/useRunControl.ts:937-942`** — tags: WR-04 — qualifier: 104-REVIEW

_Summary:_ 104-REVIEW WR-04: monitorChanged is RunDisplaysPanel's own source of truth for the per-output "reassigning" chip (:reassigning="monitorChanged" in RunControlView.vue) and must be reset in lockstep with the sticky above,...

```ts
    // 104-REVIEW WR-04: monitorChanged is RunDisplaysPanel's own source of
    // truth for the per-output "reassigning" chip (:reassigning="monitorChanged"
    // in RunControlView.vue) and must be reset in lockstep with the sticky
    // above, or a later go-live in the SAME mounted instance (no unmount, so
    // onMounted never re-initializes it) renders a stale "reassigning" chip
    // before anything has actually changed in the new session.
```

**`src/composables/useRunControl.ts:968-972`** — tags: WR-02 — qualifier: 106-REVIEW

_Summary:_ 106-REVIEW WR-02: explicit, mirrors endServiceTeardown's defense-in-depth (useRunControl.ts:903-907).

```ts
    // 106-REVIEW WR-02: explicit, mirrors endServiceTeardown's defense-in-depth
    // (useRunControl.ts:903-907). This exit path does NOT unmount the component
    // (State A re-renders in place), so useLoopTimer's own onUnmounted(disarm)
    // safety net does not apply here — without this call, disarming depends
    // solely on the async watch(live, reconcileLoop) below.
```

**`src/composables/useRunControl.ts:1196-1204`** — tags: WR-01 — qualifier: 106-REVIEW

_Summary:_ 106-REVIEW WR-01: reconcileLoop() reads filmstrip.value.slides.length as a PLAIN function call from the triggers above — none of which fire when the CURRENT item's assembled slide count changes for a reason other than na...

```ts
  // 106-REVIEW WR-01: reconcileLoop() reads filmstrip.value.slides.length as a
  // PLAIN function call from the triggers above — none of which fire when the
  // CURRENT item's assembled slide count changes for a reason other than
  // navigation (e.g. a PPTX/IMPORTED item's deck finishing its async render
  // mid-Run, growing a looping item from <=1 slide, which correctly did not
  // arm, past 1). Without this watch a looping item that starts short stays
  // silently disarmed until the operator happens to navigate. Watching the
  // slide count directly (not just currentSlotIndex/live) closes that gap in
  // both directions — arms as soon as a looping item becomes multi-slide, and
```

**`src/composables/useRunControl.ts:1278-1279`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: mark torn down so a late getScreenDetails() resolve short-circuits instead of opening windows into a dead component.

```ts
    // WR-01: mark torn down so a late getScreenDetails() resolve short-circuits
    // instead of opening windows into a dead component.
```

**`src/composables/useRunControl.ts:1296-1297`** — tags: WR-04 — qualifier: 104-REVIEW

_Summary:_ 104-REVIEW WR-04: keep monitorChanged in lockstep with the sticky clear above — see the matching comment in endServiceTeardown().

```ts
    // 104-REVIEW WR-04: keep monitorChanged in lockstep with the sticky clear
    // above — see the matching comment in endServiceTeardown().
```

### `src/composables/useServiceAssembly.ts`

**`src/composables/useServiceAssembly.ts:2-25`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Shared service-load + read-only assembly slice (Phase 95, R262/R263/R264 foundation — "reuse, don't fork").

```ts
 * Shared service-load + read-only assembly slice (Phase 95, R262/R263/R264
 * foundation — "reuse, don't fork").
 *
 * This composable owns ONLY the small load core the standalone output windows
 * and the in-app Run/control screen must resolve IDENTICALLY: the
 * `?org=`/`:serviceId` scoping, the `localService` initial-load watch, the
 * read-only `useSlideshowAssembly` (canWrite omitted), and the WR-02
 * org-mismatch subscribe gate (registered in its OWN `onMounted`).
 *
 * It deliberately holds NONE of the output-only lifecycle — no run channel, no
 * wake lock, no font gate, no cursor/fullscreen machinery — and, crucially, it
 * registers NO `onUnmounted` and NEVER calls `serviceStore.unsubscribeAll()`.
 * It is consumed by BOTH useOutputWindow (the standalone output windows, which
 * keep their own `unsubscribeAll()` teardown) AND RunControlView (a normal
 * in-app SPA route that shares the store with peers and must NOT tear the
 * subscription down on its unmount). Placing a store teardown here would kill
 * those peers' subscriptions.
 *
 * It MUST be called from inside a component `setup()` — it registers one
 * `onMounted` (the WR-02 subscribe gate) on the calling instance. Call it
 * FIRST in the consumer's setup so its `onMounted` runs before any later
 * `onMounted` (e.g. useOutputWindow opening its channel) — subscribe-before-
 * channel ordering is preserved by call order.
 */
```

**`src/composables/useServiceAssembly.ts:62-63`** — tags: WR-02 — qualifier: unqualified

_Summary:_ ── Lifecycle: WR-02 subscribe gate ONLY (no unsubscribeAll) ────────────────

```ts

  // ── Lifecycle: WR-02 subscribe gate ONLY (no unsubscribeAll) ────────────────
```

**`src/composables/useServiceAssembly.ts:65-76`** — tags: WR-02 — qualifier: 93-REVIEW

_Summary:_ Service subscription — key the service source off the SAME resolved orgId useSlideshowAssembly subscribes content to, not off "is the store fresh?".

```ts
    // Service subscription — key the service source off the SAME resolved orgId
    // useSlideshowAssembly subscribes content to, not off "is the store fresh?".
    //
    // WR-02 (93-REVIEW): the old `!serviceStore.orgId` gate assumed a fresh Pinia
    // singleton (the standalone window.open path). But this is also a directly-
    // loadable SPA route: on a same-tab navigation where the store is ALREADY
    // subscribed to org X while this URL's `?org=` is Y, that gate skipped the
    // re-subscribe, leaving `services` sourced from X while the assembly reads Y —
    // a silent cross-org desync on the congregation surface (never-found service →
    // permanent black, or an X service assembled against Y's content maps). Gate on
    // an org MISMATCH instead: subscribe() is idempotent (it tears down the prior
    // listener first), so re-subscribing when the requested org differs re-keys the
```

### `src/composables/useSlideshowAssembly.ts`

**`src/composables/useSlideshowAssembly.ts:82-90`** — tags: WR-02 — qualifier: 42-REVIEW.md

_Summary:_ WR-02 (42-REVIEW.md): `pptxRendersStore` is a Pinia singleton, but this composable's `cleanup()` calls its `unsubscribeAll()`, which tears down EVERY outstanding listener in the store, not just the ones this particular i...

```ts

// WR-02 (42-REVIEW.md): `pptxRendersStore` is a Pinia singleton, but this composable's
// `cleanup()` calls its `unsubscribeAll()`, which tears down EVERY outstanding listener
// in the store, not just the ones this particular instance opened. That is safe only
// under the "single call site" assumption documented on `pptxRenders.ts` and below — an
// assumption nothing in the store enforces. This module-level counter is a dev-mode
// tripwire for exactly that assumption: it does not change teardown behavior (still a
// full `unsubscribeAll()`, since scoping it per-instance is a real design change no plan
// here authorizes), it only makes a violation loud instead of silent.
```

**`src/composables/useSlideshowAssembly.ts:189-190`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: see the module-level counter's doc comment above.

```ts

  // WR-02: see the module-level counter's doc comment above.
```

**`src/composables/useSlideshowAssembly.ts:289-296`** — tags: Pitfall — qualifier: 42-RESEARCH.md

_Summary:_ --- Phase 42 (R079/R080): resolve and cache rendered-page download URLs --- Keyed `${renderImportId}:${renderedCount}` — the count is load-bearing TWICE (42-RESEARCH.md Pitfall 4 / T-42-07): it invalidates the cache the...

```ts

  // --- Phase 42 (R079/R080): resolve and cache rendered-page download URLs ---
  //
  // Keyed `${renderImportId}:${renderedCount}` — the count is load-bearing TWICE
  // (42-RESEARCH.md Pitfall 4 / T-42-07): it invalidates the cache the instant a
  // re-render changes the page count, AND it makes serving a previous render's
  // URL array structurally impossible, since a differently-counted re-render can
  // never collide with the old key.
```

**`src/composables/useSlideshowAssembly.ts:339-343`** — tags: WR-01 — qualifier: 42-REVIEW.md

_Summary:_ WR-01 (42-REVIEW.md): only the CURRENT count's entry is ever read again (`renderedImageUrlsByImportId` above looks up exactly one key per id), so every other `(id, count)` pair for this SAME id is now unreachable — evict...

```ts
          // WR-01 (42-REVIEW.md): only the CURRENT count's entry is ever read again
          // (`renderedImageUrlsByImportId` above looks up exactly one key per id), so
          // every other `(id, count)` pair for this SAME id is now unreachable — evict
          // it rather than let it stay resident forever across re-renders/retries
          // within one composable instance's lifetime.
```

**`src/composables/useSlideshowAssembly.ts:725-737`** — tags: CR-01 — qualifier: 38-REVIEW

_Summary:_ Precomputed here (synchronously, inside the tracked computed) rather than re-derived in the async apply step.

```ts
    /**
     * Precomputed here (synchronously, inside the tracked computed) rather
     * than re-derived in the async apply step.
     *
     * 38-REVIEW CR-01: `undefined` means "no opinion, leave the stored
     * signature alone"; `null` means "explicitly clear it." `result.sourceSignature`
     * (set only by `rebuildScriptureGroup`'s CLEARED REFERENCE branch) takes
     * precedence over the ordinary recomputed `sourceSignature(slot, inputs)`
     * when present, because that branch's freshly-computed signature is
     * `undefined` for the wrong reason (no reference to sign, not "no
     * opinion") and would otherwise leave a stale value stored via
     * `stripUndefined`.
     */
```

**`src/composables/useSlideshowAssembly.ts:784-792`** — tags: CR-02 — qualifier: unqualified

_Summary:_ CR-02: `outcome.group.slides` is the snapshot this rebuild was computed FROM — passed through as `baseSlides` so a concurrent SlideGrid.vue write (add-slide/import/video-append/reorder) that lands between this computatio...

```ts

      // CR-02: `outcome.group.slides` is the snapshot this rebuild was
      // computed FROM — passed through as `baseSlides` so a concurrent
      // SlideGrid.vue write (add-slide/import/video-append/reorder) that
      // lands between this computation and this write is detected and merged
      // rather than silently overwritten. See `replaceGroupSlides`'s doc
      // comment in `src/stores/slideGroups.ts`. This matters MORE now than
      // pre-Phase-30, since every rebuild outcome writes unconditionally —
      // there is no confirm step left to catch a lost concurrent edit.
```

**`src/composables/useSlideshowAssembly.ts:858-863`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: `activeSlideshowAssemblyInstances` still includes THIS instance at this point (it decrements below), so > 1 here means at least one other instance is still live — the single-call-site assumption `unsubscribeAll()`...

```ts

    // WR-02: `activeSlideshowAssemblyInstances` still includes THIS instance at this
    // point (it decrements below), so > 1 here means at least one other instance is
    // still live — the single-call-site assumption `unsubscribeAll()`'s teardown-of-
    // EVERY-listener behavior relies on is violated. Warn loudly rather than let this
    // instance's unmount silently kill another instance's still-open render listeners.
```

**`src/composables/useSlideshowAssembly.ts:870`** — tags: WR-02 — qualifier: 42-REVIEW.md

_Summary:_ 'killed by this unmount. See WR-02, 42-REVIEW.md.',

```ts
          'killed by this unmount. See WR-02, 42-REVIEW.md.',
```


### `src/config/appConfigDefaults.ts`

**`src/config/appConfigDefaults.ts:2-15`** — tags: Pitfall — qualifier: 70-RESEARCH.md

_Summary:_ `AppConfig` interface + `DEFAULT_APP_CONFIG` (lines 24-97 as of Phase 69). This file is a DELIBERATE DUPLICATE, not an import.

```ts
// `AppConfig` interface + `DEFAULT_APP_CONFIG` (lines 24-97 as of Phase 69).
//
// This file is a DELIBERATE DUPLICATE, not an import. `src/` (Vite build) and
// `functions/` (Cloud Functions build) are separate build targets in this
// repo — a relative import across that boundary would either fail to resolve
// at build time or silently bundle server-only code into the client. See
// 70-RESEARCH.md Pitfall 2 / Anti-Patterns for the full rationale.
//
// If functions/src/appConfig.ts's DEFAULT_APP_CONFIG values ever change, this
// file MUST be updated by hand to match — that file carries a matching
// forward-pointing comment. `appConfigDefaults.test.ts`'s drift-guard/
// snapshot test hard-codes the values below so an unmirrored change fails
// loudly at test time, not just via a stale docs comment.
```

### `src/main.ts`

**`src/main.ts:2-7`** — tags: Pitfall — qualifier: 46-RESEARCH.md

_Summary:_ Eager-load the DEFAULT slide face (R094) so the default family+weight is resident before the very first paint.

```ts
// Eager-load the DEFAULT slide face (R094) so the default family+weight is
// resident before the very first paint. This is a static import evaluated
// at module load, before app.mount() — the eager path Pitfall 4
// (46-RESEARCH.md) warns against skipping. Non-default org faces are loaded
// on demand by the presenter gate (46-04) and the Settings preview (46-03)
// via src/utils/slideTypography.ts::loadFontCss.
```

### `src/router/index.ts`

**`src/router/index.ts:229-240`** — tags: Pitfall, WR-03 — qualifier: 68-REVIEW.md

_Summary:_ WR-03 (68-REVIEW.md) — wait for the store's own onAuthStateChanged listener to have populated authStore.user, mirroring requiresEditor's waitForRole() wait above, BEFORE calling refreshSuperAdminClaim().

```ts
    // WR-03 (68-REVIEW.md) — wait for the store's own onAuthStateChanged
    // listener to have populated authStore.user, mirroring requiresEditor's
    // waitForRole() wait above, BEFORE calling refreshSuperAdminClaim(). Without
    // this, a fresh page-load/reload directly on /owner-console could read
    // authStore.user before it was populated, causing refreshSuperAdminClaim to
    // bail with isSuperAdmin = false and wrongly redirect a real super-admin.
    //
    // R177 (Pitfall 4) — then force a fresh claim read BEFORE deciding to
    // redirect, so a just-granted super-admin's very next navigation sees it
    // rather than waiting out the token's normal refresh cadence. Convenience
    // gate only — the real enforcement is firestore.rules' isSuperAdmin() +
    // the setSuperAdminClaim onCall's server-side caller re-check.
```

### `src/stores/auth.ts`

**`src/stores/auth.ts:92`** — tags: R-02 — qualifier: unqualified

_Summary:_ Memorable share-URL slug (R-02/D-18) — used to build /{slug}/quarterN-YYYY links.

```ts
  // Memorable share-URL slug (R-02/D-18) — used to build /{slug}/quarterN-YYYY links.
```

**`src/stores/auth.ts:106-110`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Church-level Vertical Worship 1-2-3 methodology toggle (D-15). Default ON — missing field on legacy org docs means VW mode is enabled. Single source of truth every VW surface gates on (D-16).

```ts

  // Church-level Vertical Worship 1-2-3 methodology toggle (D-15). Default ON —
  // missing field on legacy org docs means VW mode is enabled. Single source of
  // truth every VW surface gates on (D-16). Mirror-written from Settings; NOT
  // live-synced via onSnapshot (Pitfall 2).
```

**`src/stores/auth.ts:121-129`** — tags: Pitfall — qualifier: 82-RESEARCH.md

_Summary:_ Phase 82 (R242/R243) — the super-admin MASTER AI gate, read from the org doc's top-level `aiMasterEnabled` field (distinct from `settings.aiEnabled` above).

```ts
  // Phase 82 (R242/R243) — the super-admin MASTER AI gate, read from the org
  // doc's top-level `aiMasterEnabled` field (distinct from
  // `settings.aiEnabled` above). Absent/false => OFF (default) — DELIBERATELY
  // the inverse of vwModeEnabled's `?? true` default, since AI must be off by
  // default for every org (R242). Mirror-written from applyOrgSnapshot, NOT
  // live-synced via onSnapshot — same latency posture as vwModeEnabled/
  // settings (Pitfall 2, 82-RESEARCH.md). Consumed as the first AND-gate leg
  // in `src/utils/claudeApi.ts`'s isAiEnabled() and as SettingsView.vue's AI
  // Features card v-if.
```

**`src/stores/auth.ts:164-170`** — tags: Pitfall — qualifier: unqualified

_Summary:_ via enterOrgAsSuperAdmin, with NO membership document of their own. Null means no such visit is in effect.

```ts
  // via enterOrgAsSuperAdmin, with NO membership document of their own.
  // Null means no such visit is in effect. Purely client/UI-gating state —
  // never the security boundary; every Firestore/Storage op made while set
  // is independently re-checked by firestore.rules/storage.rules' own
  // super-admin arm (78-01-PLAN.md). Must be cleared alongside orgId/etc. in
  // ALL THREE places that reset org context inline: resetOrgContext, logout,
  // and the onAuthStateChanged null-user branch (Pitfall 4).
```

**`src/stores/auth.ts:175-182`** — tags: WR-02 — qualifier: 82-REVIEW

_Summary:_ WR-02 (82-REVIEW): the single shared two-gate AI-affordance check -- mirrors src/utils/claudeApi.ts's isAiEnabled() exactly (master gate AND church setting).

```ts

  // WR-02 (82-REVIEW): the single shared two-gate AI-affordance check --
  // mirrors src/utils/claudeApi.ts's isAiEnabled() exactly (master gate AND
  // church setting). Every UI site that decides whether to SHOW an AI
  // affordance (not just claudeApi.ts's functions that actually CALL the
  // proxy) must read this computed instead of the bare `settings.aiEnabled`,
  // so a super-admin disabling AI for an org hides those affordances
  // consistently, not just the Settings card.
```

**`src/stores/auth.ts:268-277`** — tags: WR-03 — qualifier: 68-REVIEW.md

_Summary:_ WR-03 (68-REVIEW.md) — the requiresSuperAdmin router guard read authStore.user without waiting for the store's own onAuthStateChanged listener to have populated it, unlike requiresEditor's waitForRole() above.

```ts

  // WR-03 (68-REVIEW.md) — the requiresSuperAdmin router guard read
  // authStore.user without waiting for the store's own onAuthStateChanged
  // listener to have populated it, unlike requiresEditor's waitForRole()
  // above. That listener is only registered on the FIRST useAuthStore() call
  // anywhere in the app (Pinia stores are lazy), so a fresh page-load/reload
  // directly on a super-admin-only route had an implicit, untested ordering
  // dependency on when that first call happened to occur. waitForReady()
  // gives requiresSuperAdmin the same explicit wait shape as waitForRole():
  // it resolves immediately once isReady is already true, otherwise it waits
```

**`src/stores/auth.ts:340-346`** — tags: Pitfall — qualifier: unqualified

_Summary:_ R177 (Pitfall 4) — forces a single getIdTokenResult(user, true) read and updates isSuperAdmin from it.

```ts

  // R177 (Pitfall 4) — forces a single getIdTokenResult(user, true) read and
  // updates isSuperAdmin from it. Used by the requiresSuperAdmin route guard
  // so a just-granted super-admin's next navigation picks up the fresh claim
  // instead of relying on the token's normal hourly refresh cadence. Never
  // throws: a failed refresh just leaves isSuperAdmin at its last known
  // value, and the guard's redirect-on-false still applies safely.
```

**`src/stores/auth.ts:360-374`** — tags: WR-01 — qualifier: 78-REVIEW.md

_Summary:_ R213 (Phase 76) — the SAME full org-context reset the pre-existing `activeId === null` branch performs, factored out so the two new deactivation-detection branches below share it exactly rather than drifting from that br...

```ts

  // R213 (Phase 76) — the SAME full org-context reset the pre-existing
  // `activeId === null` branch performs, factored out so the two new
  // deactivation-detection branches below share it exactly rather than
  // drifting from that branch's field list over time.
  //
  // WR-01 (78-REVIEW.md): `deactivatedOrgMessage` is cleared HERE, not just
  // by loadOrgContext's own unconditional clear at its top. Before this,
  // `enterOrgAsSuperAdmin`/`exitSuperAdminView` were the first callers of
  // resetOrgContext() that bypass loadOrgContext entirely, so a stale
  // non-null deactivatedOrgMessage from an earlier deactivated-org bounce
  // survived a super-admin's enter/exit and kept `hasDeactivatedOrg` (and
  // therefore `requiresOrgSelection`) true — stranding them at
  // /select-church on the very next navigation, the same router-strand
  // class `hasNoOrg`'s viewingAsSuperAdmin guard was written to close.
```

**`src/stores/auth.ts:426-435`** — tags: WR-01 — qualifier: 46-REVIEW.md

_Summary:_ WR-01 (46-REVIEW.md): `slideTypography` is deep-merged specifically — the plain `...orgSettings` spread above is shallow, so a partial/legacy stored value (e.g.

```ts

    // WR-01 (46-REVIEW.md): `slideTypography` is deep-merged specifically
    // — the plain `...orgSettings` spread above is shallow, so a
    // partial/legacy stored value (e.g. a hand-edited Firestore document,
    // or any future write path that persists fewer than all three leaf
    // keys) would otherwise replace the whole nested object wholesale,
    // leaving `fontWeight`/`fontScale` `undefined` rather than falling
    // back to the per-field defaults. `cssVarsFor` already tolerates this
    // at render time, but `SettingsView.vue`'s local refs are initialized
    // directly from this object with no equivalent guard.
```

**`src/stores/auth.ts:468-481`** — tags: CR-01, WR-03 — qualifier: 46-REVIEW.md, 46-UI-SPEC.md

_Summary:_ CR-01 (46-REVIEW.md) — eager-load the org's actual chosen slide face here, the ONE point every render site's settings flow through.

```ts

    // CR-01 (46-REVIEW.md) — eager-load the org's actual chosen slide
    // face here, the ONE point every render site's settings flow
    // through. Without this, SlideGrid.vue and EditSlideDrawer.vue (the
    // grid and the Edit Slide drawer preview — soft-gate surfaces per
    // 46-UI-SPEC.md, font-display: swap) bind `--slide-font-family` to a
    // family whose @font-face rule was never registered, so the browser
    // silently falls through to its generic fallback instead of the
    // chosen font for any org whose choice differs from main.ts's eager
    // Inter default — until something ELSE (Settings, or the Presenter)
    // happens to load it first in that session. Fire-and-forget: a
    // rejected dynamic import degrades to the CSS stack's native
    // fallback, never a user-visible error (same posture as WR-03's
    // SettingsView.vue fix).
```

**`src/stores/auth.ts:710-720`** — tags: WR-03 — qualifier: 78-REVIEW.md

_Summary:_ to find — if started, its first callback would immediately null userRole back out).

```ts
  // to find — if started, its first callback would immediately null userRole
  // back out). Deliberately performs NO isOrgActive/deactivation check,
  // unlike loadOrgContext — the rules layer already grants a super-admin
  // unconditional access to a deactivated org's doc, and entering one for
  // support is intended, not a bug to guard against.
  //
  // WR-03 (78-REVIEW.md): returns a boolean so the caller (OrganizationsTab's
  // onEnterChurch) can tell a genuine entry apart from a silent no-op (not a
  // super-admin / no user, a denied or errored read, or a missing/stale org
  // doc) instead of navigating unconditionally and stranding the super-admin
  // at the router's org-selection gate with zero explanation.
```

### `src/stores/quarters.ts`

**`src/stores/quarters.ts:170-174`** — tags: Pitfall — qualifier: unqualified

_Summary:_ D-19: replace ONLY the CSV-present people's quarter-scoped entries wholesale; standing fields are upserted through the roster store (Pitfall 3).

```ts

  // D-19: replace ONLY the CSV-present people's quarter-scoped entries wholesale; standing
  // fields are upserted through the roster store (Pitfall 3). People absent from `rows` keep
  // their existing personQuarterData entry untouched — except for a bidirectional pairing
  // merge below, which only ever adds a partner id to an existing (or fresh) entry.
```

**`src/stores/quarters.ts:406-417`** — tags: Pitfall, R-02, WR-06 — qualifier: unqualified

_Summary:_ R-02/D-18: resolve (or claim, on first share) the org's memorable-URL slug, then write the quarterShares/{slug}__q{N}-{year} doc — a stable doc ID so every finalize OVERWRITES in place (Pitfall 2), never accumulates like...

```ts

    // R-02/D-18: resolve (or claim, on first share) the org's memorable-URL slug, then
    // write the quarterShares/{slug}__q{N}-{year} doc — a stable doc ID so every finalize
    // OVERWRITES in place (Pitfall 2), never accumulates like shareTokens above. Reuses the
    // exact calendarWithNames/roles/label/serviceDates snapshot already built — names only,
    // no email/phone (D-24).
    //
    // WR-06: by this point the opaque shareTokens doc AND the quarter's finalized status
    // have already been committed above — a failure in this memorable-URL step must NOT
    // surface as a hard "Failed to finalize and share" to the caller, since the finalize
    // itself already succeeded. This whole step is therefore soft-fail: any error here is
    // logged and swallowed, and the opaque token is still returned.
```

**`src/stores/quarters.ts:437-440`** — tags: CR-01 — qualifier: unqualified

_Summary:_ CR-01: the owning orgId is stored on the doc so firestore.rules can scope create/update to editors of the org that actually owns this share (the shareId itself is a guessable, deterministic string, so this field is what...

```ts
        // CR-01: the owning orgId is stored on the doc so firestore.rules can scope
        // create/update to editors of the org that actually owns this share (the shareId
        // itself is a guessable, deterministic string, so this field is what closes the
        // cross-tenant write gap).
```

### `src/stores/roster.ts`

**`src/stores/roster.ts:70-82`** — tags: Pitfall — qualifier: unqualified

_Summary:_ 1. Legacy group 'vocals' (R250, pre-Phase-85 docs) — the narrowed RoleGroup dropped 'vocals' as a team identity; existing docs may still carry it and are coerced to group 'band' here. 2.

```ts
      //   1. Legacy group 'vocals' (R250, pre-Phase-85 docs) — the narrowed RoleGroup dropped
      //      'vocals' as a team identity; existing docs may still carry it and are coerced to
      //      group 'band' here.
      //   2. Legacy field name `vocal` (Phase-85/88 docs persisted before the R259 rename) —
      //      docs on disk still carry `vocal`, not `multiRole`, since there is no data
      //      migration; every role (not just the vocals-group branch) must map it or a live
      //      pre-Phase-89 role would silently lose its flag (RESEARCH Pitfall R1).
      // Branch-specific defaulting (R259 — the plan-checker BLOCKER fix):
      //   - vocals-group branch: (data.multiRole ?? data.vocal ?? true) === true — the `?? true`
      //     preserves the pre-existing `vocal: data.vocal ?? true` default so a pre-Phase-85
      //     legacy vocals doc with NEITHER field still surfaces as multiRole:true.
      //   - default branch: (data.multiRole ?? data.vocal) === true — NO `?? true`; a
      //     non-vocals role with neither field is multiRole:false.
```

### `src/stores/saveStatus.ts`

**`src/stores/saveStatus.ts:11-16`** — tags: WR-01 — qualifier: 32-REVIEW, 32-UI-SPEC

_Summary:_ WR-01 (32-REVIEW): module-level (not store-internal) so both the toast fallback below AND SaveStatusIndicator.vue's inline-error fallback share the identical string — 32-UI-SPEC § 4's "toast body always mirrors the inlin...

```ts

// WR-01 (32-REVIEW): module-level (not store-internal) so both the toast
// fallback below AND SaveStatusIndicator.vue's inline-error fallback share
// the identical string — 32-UI-SPEC § 4's "toast body always mirrors the
// inline text, word for word" contract would otherwise depend on two
// separately-maintained copies never drifting apart.
```

**`src/stores/saveStatus.ts:33-47`** — tags: WR-03 — qualifier: 32-REVIEW, 32-UI-SPEC

_Summary:_ Keyed by surfaceId so several autosaving surfaces can be mounted simultaneously without one surface's 'saved' erasing another's 'saving'.

```ts
 *
 * Keyed by surfaceId so several autosaving surfaces can be mounted
 * simultaneously without one surface's 'saved' erasing another's 'saving'.
 * This store holds no Firestore state at all — no orgId, no subscribe, no
 * unsubscribeAll.
 *
 * WR-03 (32-REVIEW): a `mostUrgent` cross-surface rollup (deterministic
 * urgency ranking + tie-break) used to live here, fully built and tested,
 * with no production consumer anywhere in `src/` — dead code as shipped.
 * Removed rather than kept "for later," per this codebase's own "don't
 * build more than is needed" convention (32-UI-SPEC § 4's toast-stacking
 * note makes the same call). Re-add it if/when a real cross-surface
 * indicator is planned — the deleted logic is in this phase's own review
 * fix commit for reference.
 */
```

### `src/stores/services.ts`

**`src/stores/services.ts:287-290`** — tags: WR-03 — qualifier: 41-REVIEW

_Summary:_ WR-03 (41-REVIEW): shareLinkCache is subscription-scoped state exactly like everything else reset above, but was missed — clear it on org switch too, so a cached token/false from the previous org's services can never lea...

```ts
    // WR-03 (41-REVIEW): shareLinkCache is subscription-scoped state exactly
    // like everything else reset above, but was missed — clear it on org
    // switch too, so a cached token/false from the previous org's services
    // can never leak into the newly-subscribed org's resolution.
```

**`src/stores/services.ts:419-425`** — tags: WR-01 — qualifier: 84-REVIEW

_Summary:_ SONG-slot songIds present in a service, deduped source for both lock/unlock hooks. WR-01 (84-REVIEW): a song repeated across multiple SONG slots (e.g.

```ts

  /**
   * SONG-slot songIds present in a service, deduped source for both
   * lock/unlock hooks. WR-01 (84-REVIEW): a song repeated across multiple
   * SONG slots (e.g. a repeated chorus) must trigger exactly ONE recompute
   * per `markAsPlanned`/`reopenService` call, not one per occurrence.
   */
```

**`src/stores/services.ts:502-512`** — tags: CR-02 — qualifier: 84-REVIEW

_Summary:_ R247 — this service is now locked; recompute lastUsedAt for its songs so they pick up this service's date (advancing to MAX over every locked service that contains them).

```ts
    // R247 — this service is now locked; recompute lastUsedAt for its songs
    // so they pick up this service's date (advancing to MAX over every
    // locked service that contains them). See buildLastUsedSnapshot's doc
    // comment for why the snapshot below overrides THIS service's status
    // rather than relying on services.value, which still shows 'draft' here.
    //
    // CR-02 (84-REVIEW): soft-fail, mirroring maybeRefreshShareLink's pattern
    // in this same file. The status write above already landed — a transient
    // recompute failure (permission edge case, network blip, quota) must not
    // reject the whole transition and make the caller report "it didn't
    // save" for a service that is now genuinely planned.
```

**`src/stores/services.ts:554-562`** — tags: CR-02 — qualifier: 84-REVIEW

_Summary:_ Those songs fall back to their remaining locked MAX (or null if this was their only locked service) — see buildLastUsedSnapshot's doc comment for the status-override rationale.

```ts

    // Those songs fall back to their remaining locked MAX (or null if this
    // was their only locked service) — see buildLastUsedSnapshot's doc
    // comment for the status-override rationale.
    //
    // CR-02 (84-REVIEW): soft-fail, mirroring markAsPlanned's identical guard
    // above and maybeRefreshShareLink's pattern in this same file — the
    // status write already landed, so a transient recompute failure must not
    // reject the reopen itself.
```

**`src/stores/services.ts:602-611`** — tags: WR-01 — qualifier: 80-REVIEW

_Summary:_ WR-01 (80-REVIEW): each revocation step below is independently try/caught.

```ts

    // WR-01 (80-REVIEW): each revocation step below is independently
    // try/caught. Before this, a single mid-sequence failure (permission-
    // denied on a stale/cross-org doc, a transient network error) would
    // throw out of deleteService entirely, skipping BOTH the remaining
    // revocation steps AND the actual service-doc delete — leaving the
    // service partially-revoked yet still fully present, while the caller
    // (ServiceEditorView.vue's onDelete) silently closed the confirm dialog
    // with no error surfaced. Revocation is now best-effort: a failure here
    // is logged and does not block the other artifacts' revocation or the
```

**`src/stores/services.ts:650-656`** — tags: CR-01 — qualifier: 80-REVIEW

_Summary:_ CR-01 (80-REVIEW): this doc is keyed by slug+date, NOT serviceId — two services on the same date share one serviceShares doc.

```ts
          // CR-01 (80-REVIEW): this doc is keyed by slug+date, NOT serviceId —
          // two services on the same date share one serviceShares doc. Only
          // delete it if it still records THIS service as owner; otherwise a
          // same-date sibling service's live public share page would be
          // silently destroyed. A doc written before this guard existed (no
          // serviceId field) is treated as "not mine" and left alone rather
          // than deleted on an undefined === id false match.
```

**`src/stores/services.ts:670-674`** — tags: WR-03 — qualifier: 41-REVIEW

_Summary:_ WR-03 (41-REVIEW): drop the deleted service's shareLinkCache entry so it cannot accumulate as a dead entry, and so a same-session, same-org serviceId reuse (however unlikely with Firestore's random doc ids) never resolve...

```ts
    // WR-03 (41-REVIEW): drop the deleted service's shareLinkCache entry so
    // it cannot accumulate as a dead entry, and so a same-session, same-org
    // serviceId reuse (however unlikely with Firestore's random doc ids)
    // never resolves against a stale cached token/false for a service that
    // no longer exists.
```

**`src/stores/services.ts:878-884`** — tags: R-02, WR-06 — qualifier: unqualified

_Summary:_ R-02/D-18: memorable-URL secondary write, mirroring quarters.ts::finalizeAndShare exactly — resolve (or claim, on first share) the org's slug, then overwrite serviceShares/{slug}__service-{date} in place.

```ts

    // R-02/D-18: memorable-URL secondary write, mirroring
    // quarters.ts::finalizeAndShare exactly — resolve (or claim, on first share)
    // the org's slug, then overwrite serviceShares/{slug}__service-{date} in
    // place. WR-06: the opaque shareTokens doc above has already succeeded, so
    // this whole step is soft-fail — any error here is logged and swallowed, the
    // token is still returned (T-17-03-03).
```

**`src/stores/services.ts:898-903`** — tags: CR-01 — qualifier: 80-REVIEW

_Summary:_ CR-01 (80-REVIEW): this doc is keyed purely by slug+date, and the app enforces no per-org date uniqueness, so two services can share one serviceShares doc.

```ts
        // CR-01 (80-REVIEW): this doc is keyed purely by slug+date, and the
        // app enforces no per-org date uniqueness, so two services can share
        // one serviceShares doc. serviceId lets deleteService tell "this doc
        // is mine" from "this doc belongs to a same-date sibling service"
        // before deleting it — without this field the doc has no way to
        // disambiguate ownership.
```

**`src/stores/services.ts:1023-1032`** — tags: WR-06 — qualifier: unqualified

_Summary:_ subscribes to `shareTokens` or `serviceShareLinks`, so a write to either has no path back into the editor's remote-merge watcher or autosave — PROVIDED this function itself never writes to `services/{docId}`, which it do...

```ts
   * subscribes to `shareTokens` or `serviceShareLinks`, so a write to either
   * has no path back into the editor's remote-merge watcher or autosave —
   * PROVIDED this function itself never writes to `services/{docId}`, which
   * it does not: it calls `writeSharePayload` only, never `updateDoc`/`setDoc`
   * against a services path.
   *
   * Never rejects — the whole body is one try/catch (WR-06 soft-fail,
   * mirroring `writeSharePayload`'s memorable-URL catch above). A share
   * problem must never fail the user's save.
   */
```

**`src/stores/services.ts:1069-1077`** — tags: WR-02 — qualifier: 41-REVIEW

_Summary:_ WR-02 (41-REVIEW): only a genuine `permission-denied` is treated as permanent-for-session.

```ts
      // WR-02 (41-REVIEW): only a genuine `permission-denied` is treated as
      // permanent-for-session. Before this distinction, ANY error — including
      // a transient network blip or a brief rules-propagation delay —
      // permanently disabled refresh for the service for the rest of the
      // Pinia instance's lifetime, silently drifting an already-public
      // service out of sync with no way to recover short of a page reload.
      // Caching `false` on permission-denied specifically is still
      // deliberate: before the owner deploys Plan 01's rules, every attempt
      // is denied, and retrying on every keystroke would flood the console
```

### `src/stores/slideGroups.ts`

**`src/stores/slideGroups.ts:89-103`** — tags: CR-01, WR-01 — qualifier: unqualified

_Summary:_ `input` carries no bed by default (D-19 — the slot-media migration is gone; a freshly materialized group always starts with no bed) and lands in this SAME `setDoc` as the slides.

```ts
   *
   * `input` carries no bed by default (D-19 — the slot-media migration is
   * gone; a freshly materialized group always starts with no bed) and lands
   * in this SAME `setDoc` as the slides. The bed is audio-only (D-18) —
   * there is no video bed field.
   *
   * CR-01 (asymmetric WR-01 fix): this create is now ALSO `{ merge: true }`.
   * `setGroupBedMedia`'s skeleton-create was made a merge write specifically
   * because it races this function — both independently `getDoc` the same
   * not-yet-existing doc and, on absence, `setDoc`. Only guarding
   * `setGroupBedMedia`'s half left this function's plain, non-merge `setDoc`
   * able to win the race and silently erase a `bedAudioUrl` a user had JUST
   * attached (a concurrently-landing bed-media skeleton write's `bedAudioUrl`
   * key, which is absent from `input`, would otherwise be wiped by a full
   * replace). Since this branch only ever runs when `getDoc` found NO
```

**`src/stores/slideGroups.ts:155-169`** — tags: WR-01 — qualifier: unqualified

_Summary:_ `deleteField()` is the only way to actually remove a field. If the group has not materialized yet, creates a skeleton document (`slotId`, `serviceId`, `slides: []`, the supplied bed field, both server timestamps) so atta...

```ts
   * `deleteField()` is the only way to actually remove a field.
   *
   * If the group has not materialized yet, creates a skeleton document
   * (`slotId`, `serviceId`, `slides: []`, the supplied bed field, both server
   * timestamps) so attaching media to a slot with no group yet cannot throw.
   *
   * WR-01: this skeleton create races `materializeGroupIfMissing` — both
   * functions independently `getDoc` the same not-yet-existing doc and, on
   * absence, `setDoc`. If a user attaches bed media in the same round-trip
   * window as first materialization, whichever write lands last would win
   * outright under a plain (non-merge) `setDoc`, and since this skeleton's
   * payload always carries `slides: []`, landing after materialization's
   * fully-populated write would silently reset the group's real derived
   * `slides` back to empty. `{ merge: true }` makes this create idempotent
   * against that race: a concurrently-landing `materializeGroupIfMissing`
```

**`src/stores/slideGroups.ts:214-227`** — tags: WR-01 — qualifier: unqualified

_Summary:_ `setGroupBedMedia` above exactly rather than extending its patch type: the same existence check, the same single-field `updateDoc` on the existing branch, the same explicit `clearBackground` flag (an undefined url would...

```ts
   * `setGroupBedMedia` above exactly rather than extending its patch type: the
   * same existence check, the same single-field `updateDoc` on the existing
   * branch, the same explicit `clearBackground` flag (an undefined url would
   * be stripped by `stripUndefined()` before the intent reached Firestore —
   * `deleteField()` is the only way to actually remove the field), and the
   * same merging skeleton `setDoc` on the missing branch for the identical
   * WR-01 race reason documented on `setGroupBedMedia`.
   *
   * Touches only `backgroundImageUrl` and `updatedAt` on the existing-doc
   * branch — never `slides`, never `bedAudioUrl`. Setting a group's
   * background must never overwrite or clear any slide's own background (the
   * R055 adjacency truth) — this function reads and writes nothing about
   * `slides` at all.
   */
```

**`src/stores/slideGroups.ts:261-275`** — tags: CR-02 — qualifier: unqualified

_Summary:_ The apply half of reconciliation — writes only `slides`/`sourceSignature`/ `updatedAt`, never a bed field.

```ts
  /**
   * The apply half of reconciliation — writes only `slides`/`sourceSignature`/
   * `updatedAt`, never a bed field. The decision of WHETHER to apply a
   * reconciled slide list lives in 24-03's pure functions and 24-05's
   * composable, never here.
   *
   * CR-02: every call site (add-slide, import, video-append, drag-reorder in
   * `SlideGrid.vue`, and the reconciliation watcher in
   * `useSlideshowAssembly.ts`) reads a LOCAL snapshot of the group's current
   * `entries`/`slides` BEFORE computing its own next `slides` array, with no
   * shared in-process lock across those independent call sites. A plain
   * `updateDoc` here is therefore a last-write-wins race — a fast
   * double-click on "+ Add slide", or an append racing a drag-reorder, would
   * silently discard whichever write lands first.
   *
```

**`src/stores/slideGroups.ts:284-312`** — tags: CR-01, CR-02 — qualifier: 26-REVIEW, 38-REVIEW

_Summary:_ (two callers computing the same "append one entry" delta from the same stale base) and the append-vs-reorder race (a reorder's full-array overwrite landing after a concurrent append), because whichever write loses the co...

```ts
   * (two callers computing the same "append one entry" delta from the same
   * stale base) and the append-vs-reorder race (a reorder's full-array
   * overwrite landing after a concurrent append), because whichever write
   * loses the commit race re-derives against the OTHER write's already-landed
   * result rather than blindly replacing it.
   *
   * 26-REVIEW CR-02: this also reconciles a concurrent DELETION (Phase 26
   * ships the first delete-a-slide path, `EditSlideDrawer.vue`'s Delete Slide
   * action). `mergeConcurrentlyAddedEntries` strips any entry that this
   * caller's stale `next` still carries (derived from `base`, which had not
   * yet observed the deletion) but that is absent from the live document —
   * without this, a slower stale-base write (e.g. a debounced label/notes
   * edit scheduled before the delete, committing after it) would silently
   * resurrect the slide the user explicitly deleted. This does not re-derive
   * a drag-reorder's index math against a changed live array — reordering
   * still only recovers/strips entries by id, never recomputes positions
   * against a live array it never saw. `baseSlides` is optional: omitting it
   * keeps the previous plain-overwrite behavior for any caller that has not
   * been updated to track a base snapshot.
   *
   * 38-REVIEW CR-01: `sourceSignature` is a tri-state, mirroring
   * `setGroupBedMedia`'s `clearAudio` precedent (documented above) — an
   * `undefined` value means "no opinion, leave the stored field alone" and is
   * simply omitted from the write (via `stripUndefined`, as before); an
   * explicit `null` means "clear this field" and is written as a real
   * `deleteField()` sentinel, because `stripUndefined` cannot distinguish
   * "no opinion" from "clear" for a plain `undefined`. Only
   * `rebuildScriptureGroup`'s CLEARED REFERENCE branch (via
   * `useSlideshowAssembly.ts`'s `freshSignature`) passes `null` today — the
```

**`src/stores/slideGroups.ts:355-373`** — tags: CR-02 — qualifier: unqualified

_Summary:_ CR-02 helper: entries present on the LIVE document but absent from both the caller's own snapshot (`base`) and its computed payload (`next`) were added by a concurrent write that landed after `base` was read — append the...

```ts

  /**
   * CR-02 helper: entries present on the LIVE document but absent from both
   * the caller's own snapshot (`base`) and its computed payload (`next`) were
   * added by a concurrent write that landed after `base` was read — append
   * them rather than let `next`'s write silently erase them. Reassigns
   * `order` to trail whatever `next` already contains so the recovered
   * entries sort after it; ids are never regenerated (invariant 2,
   * `slideGroup.ts`).
   *
   * CR-02 fix: this function must ALSO recognize a concurrent *deletion*, not
   * just a concurrent addition. `next` is always derived from `base`
   * (`base.map(...)` / `base.filter(...)`), so a caller whose own write has
   * nothing to do with a given entry still carries that entry in `next`
   * (present in both `base` and `next`) even after a different writer has
   * since deleted it (absent from `live`). Left unchecked, this caller's
   * commit would resurrect the deleted entry. An entry present in `base` AND
   * still present in `next` (this caller did not itself intend to remove it)
   * but MISSING from `live` (a concurrent writer's delete already landed) is
```

### `src/stores/teams.ts`

**`src/stores/teams.ts:51-55`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Seeds the default team list (Choir/Orchestra/Communion/Special) only when the org has no teams yet.

```ts

  // Seeds the default team list (Choir/Orchestra/Communion/Special) only when
  // the org has no teams yet. Calling this again once teams exist writes
  // nothing — first-writer-wins, never clobbers an org that already edited
  // its list (RESEARCH Pitfall 4).
```

### `src/types/organization.ts`

**`src/types/organization.ts:187-195`** — tags: Pitfall — qualifier: 82-RESEARCH.md

_Summary:_ super-admin explicitly enables it. Written ONLY by the `setOrgAiEnabled` Cloud Function (Admin SDK, `functions/src/orgProvisioning.ts`, Plan 01); `firestore.rules`'s `lifecycleFields()` guard denies every client write pa...

```ts
   * super-admin explicitly enables it. Written ONLY by the `setOrgAiEnabled`
   * Cloud Function (Admin SDK, `functions/src/orgProvisioning.ts`, Plan 01);
   * `firestore.rules`'s `lifecycleFields()` guard denies every client write
   * path, including a super-admin's own client SDK — mirrors `active`'s
   * write-authority shape exactly. Deliberately a distinct top-level name
   * (never a bare `aiEnabled`) so it can never be confused with or
   * accidentally overwritten via `settings.aiEnabled` (Pitfall 1,
   * 82-RESEARCH.md).
   */
```

### `src/types/roster.ts`

**`src/types/roster.ts:22`** — tags: Pitfall — qualifier: unqualified

_Summary:_ APP-ONLY / manual — NOT fetchable from Planning Center Services v2 (D-14, RESEARCH Pitfall 5)

```ts
  /** APP-ONLY / manual — NOT fetchable from Planning Center Services v2 (D-14, RESEARCH Pitfall 5) */
```

### `src/types/slide.ts`

**`src/types/slide.ts:244-249`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Equals the stored `GroupSlideEntry.id` this slide was resolved from. Never recomputed from slot index or emission order — Phase 23's WR-02 keys `PresentationViewer`'s media children on this id.

```ts
  /**
   * Equals the stored `GroupSlideEntry.id` this slide was resolved from.
   * Never recomputed from slot index or emission order — Phase 23's WR-02
   * keys `PresentationViewer`'s media children on this id. Absent on the
   * fallback path.
   */
```

### `src/types/slideGroup.ts`

**`src/types/slideGroup.ts:11-25`** — tags: WR-02 — qualifier: unqualified

_Summary:_ 1. `SlideGroup.id === SlideGroup.slotId === the anchoring ServiceSlot.id`.

```ts
 * 1. `SlideGroup.id === SlideGroup.slotId === the anchoring ServiceSlot.id`.
 *    This is the deterministic Firestore doc id every later plan in this
 *    phase relies on — groups anchor to `slot.id`, never to array index or
 *    `position`, so a drag-reorder on the Service Order tab can never
 *    re-point a group at the wrong plan item (D-01).
 * 2. `GroupSlideEntry.id` is minted ONCE (`crypto.randomUUID()`) at
 *    materialization and is NEVER regenerated afterward. Phase 23's WR-02
 *    contract keys `PresentationViewer`'s per-slide `AudioPlayer`/
 *    `VideoPlayer` child component instances on this id specifically so a
 *    reorder or reconciliation never leaks stale muted/blocked media state
 *    from one slide onto another.
 * 3. Slide TEXT is never stored on this document — it resolves LIVE from
 *    the canonical song / scripture / imported-deck record via `sourceRef`
 *    (D-02). Editing a song's lyrics updates every service referencing it;
 *    there is no per-service text override and no "Generate missing slides"
```

### `src/types/team.ts`

**`src/types/team.ts:20-25`** — tags: Pitfall — qualifier: unqualified

_Summary:_ D-79 default team list — byte-identical to the pre-Phase-79 hard-coded `['Choir', 'Orchestra', 'Communion', 'Special']` so existing orgs (Berean) see the same team names in the checkboxes on first load post-deploy (RESEA...

```ts

// D-79 default team list — byte-identical to the pre-Phase-79 hard-coded
// `['Choir', 'Orchestra', 'Communion', 'Special']` so existing orgs (Berean)
// see the same team names in the checkboxes on first load post-deploy
// (RESEARCH Pitfall 4). DEFAULT_TEAMS omits `id` (assigned by Firestore on
// seed).
```

### `src/utils/claudeApi.ts`

**`src/utils/claudeApi.ts:51-65`** — tags: WR-03 — qualifier: 39-REVIEW

_Summary:_ remain parseable and editable even with AI off. The auth store is read inside this function body, never at module evaluation time — Pinia requires an active app instance that does not exist when this module is first impo...

```ts
 * remain parseable and editable even with AI off.
 *
 * The auth store is read inside this function body, never at module
 * evaluation time — Pinia requires an active app instance that does not exist
 * when this module is first imported.
 *
 * WR-03 (39-REVIEW): the guard is called INSIDE each export's `try` block,
 * not before it. `useAuthStore()` throws if invoked with no active Pinia
 * instance — placing the guard ahead of the `try` would let that throw
 * escape as a rejected promise, contradicting this module's documented
 * never-throw contract ("returns null on any error... never throw from
 * service/utility functions; let callers handle null"). Inside the `try`,
 * that same throw is caught and mapped to the same `null` every other
 * failure mode already returns.
 *
```

**`src/utils/claudeApi.ts:244-246`** — tags: WR-03 — qualifier: 39-REVIEW

_Summary:_ WR-03 (39-REVIEW): guard lives INSIDE the try so a throw from useAuthStore() (e.g. no active Pinia) resolves to null, matching this module's documented never-throw contract, instead of rejecting.

```ts
    // WR-03 (39-REVIEW): guard lives INSIDE the try so a throw from
    // useAuthStore() (e.g. no active Pinia) resolves to null, matching this
    // module's documented never-throw contract, instead of rejecting.
```

**`src/utils/claudeApi.ts:368-370`** — tags: WR-03 — qualifier: 39-REVIEW

_Summary:_ WR-03 (39-REVIEW): guard lives INSIDE the try so a throw from useAuthStore() (e.g. no active Pinia) resolves to null, matching this module's documented never-throw contract, instead of rejecting.

```ts
    // WR-03 (39-REVIEW): guard lives INSIDE the try so a throw from
    // useAuthStore() (e.g. no active Pinia) resolves to null, matching this
    // module's documented never-throw contract, instead of rejecting.
```

**`src/utils/claudeApi.ts:487-495`** — tags: Pitfall — qualifier: unqualified

_Summary:_ because the structured-outputs JSON Schema subset supports no numerical constraint and no cross-field relationship: shape conformance says nothing about range, ordering, adjacency, or coverage.

```ts
 * because the structured-outputs JSON Schema subset supports no numerical
 * constraint and no cross-field relationship: shape conformance says nothing
 * about range, ordering, adjacency, or coverage.
 *
 * A single violation discards the ENTIRE result — never a partial array,
 * never a repair, never a re-sort. `boundaries` MUST be the exact same array
 * used to build the prompt (scriptureBoundaries.ts's Pitfall 5 discipline —
 * never recompute it here).
 */
```

**`src/utils/claudeApi.ts:580-594`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Two invariants a future editor is most likely to break: 1. `boundaries` is computed exactly once here and threaded unchanged through prompt-building, validation, and slicing.

```ts
 *
 * Two invariants a future editor is most likely to break:
 * 1. `boundaries` is computed exactly once here and threaded unchanged
 *    through prompt-building, validation, and slicing. Recomputing it
 *    anywhere in this function (even by calling `computeBoundaries` again on
 *    the same `rawText`) risks desyncing the indices the model saw from the
 *    indices used to validate/slice its answer (RESEARCH Pitfall 5). This is
 *    not an optional discipline — do not "simplify" it away.
 * 2. A `validateSplitResult` failure discards the ENTIRE result. There is no
 *    partial-application path here, and none should ever be added — a
 *    result that fails validation must never leak a single section to the
 *    caller.
 *
 * Returns `null` on any failure — no internal boundary to split on, a source
 * already containing a marker delimiter, a network/API error, an unparseable
```

**`src/utils/claudeApi.ts:602-604`** — tags: WR-03 — qualifier: 39-REVIEW

_Summary:_ WR-03 (39-REVIEW): guard lives INSIDE the try so a throw from useAuthStore() (e.g. no active Pinia) resolves to null, matching this module's documented never-throw contract, instead of rejecting.

```ts
    // WR-03 (39-REVIEW): guard lives INSIDE the try so a throw from
    // useAuthStore() (e.g. no active Pinia) resolves to null, matching this
    // module's documented never-throw contract, instead of rejecting.
```

### `src/utils/importedRenderReconciler.ts`

**`src/utils/importedRenderReconciler.ts:14-38`** — tags: Pitfall — qualifier: 42-RESEARCH.md

_Summary:_ async `getDownloadURL()` work happens upstream in the composable layer (`useSlideshowAssembly.ts`), never here. Three load-bearing facts a future editor must not lose: 1.

```ts
 * async `getDownloadURL()` work happens upstream in the composable layer
 * (`useSlideshowAssembly.ts`), never here.
 *
 * Three load-bearing facts a future editor must not lose:
 *
 * 1. **No positional pairing exists between `deck.slides[i]` and rendered
 *    page `i+1`** (42-RESEARCH.md Pitfall 1). `functions/src/index.ts`'s own
 *    "★ Trap 1" comment (lines ~294-303) is unambiguous: `mapAstToSlides`
 *    (pptxParser.ts) SKIPS slides with neither substantial text nor images,
 *    and emits ONE ENTRY PER IMAGE on a multi-image slide — the parsed
 *    array's length is structurally decoupled from the deck's real page
 *    count in BOTH directions. `deck.slides` is a COUNT source for the
 *    non-ready modes (parsed/pending/failed) and a CONTENT source only in
 *    `parsed` mode. Anything that indexes `deck.slides` by a rendered page
 *    number is a defect.
 * 2. **Gate on `render.status`, never on `render.renderedCount` truthiness**
 *    (42-RESEARCH.md Pitfall 3). `functions/src/index.ts:396-415`'s own
 *    three-conjunct ready gate (`actualCount > 0 && actualCount ===
 *    reportedCount && contiguous`) means `status` already encodes every
 *    failure mode. A `failed` document CAN carry a non-zero `renderedCount`
 *    (the `incomplete-render` outcome still writes the partial `actualCount`,
 *    `functions/src/index.ts:411-415`); a `pending` document legitimately
 *    carries none.
 * 3. **`renderedCount` wins in every ready case** (D-05), with ONE named
 *    carve-out: `status: 'ready'` with `renderedCount` absent or `< 1` is
```

**`src/utils/importedRenderReconciler.ts:49-51`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Prefix for the synthetic ready-state entry identity this module mints — `rendered-page-N`, never `deck.slides[N-1].id` (Pitfall 1).

```ts

/** Prefix for the synthetic ready-state entry identity this module mints —
 * `rendered-page-N`, never `deck.slides[N-1].id` (Pitfall 1). */
```

**`src/utils/importedRenderReconciler.ts:114-123`** — tags: WR-04 — qualifier: 42-REVIEW.md

_Summary:_ WR-04 (42-REVIEW.md): an EXPLICIT `render.status === 'ready'` check, not an implicit fall-through by elimination.

```ts

  // WR-04 (42-REVIEW.md): an EXPLICIT `render.status === 'ready'` check, not
  // an implicit fall-through by elimination. `PptxRenderDoc` is cast from
  // `snap.data()` with no runtime validation (`pptxRenders.ts`), so a future
  // status value the client hasn't deployed for yet (`functions/src/index.ts`
  // can add one without a client deploy — the sibling `failureReason` slug
  // space already works this way) or a malformed document must degrade
  // safely to `failed`, never be silently treated as `ready` merely because
  // it fell through the `pending`/`failed` checks above and happened to
  // carry a truthy `renderedCount`.
```

**`src/utils/importedRenderReconciler.ts:146-160`** — tags: CR-01 — qualifier: 42-REVIEW.md

_Summary:_ Mints the stable per-entry identity `derivedIdentityKey`/ `carryStoredDerivedEntries` key on across a rebuild.

```ts
 * Mints the stable per-entry identity `derivedIdentityKey`/
 * `carryStoredDerivedEntries` key on across a rebuild. `ready` mode mints
 * synthetic `rendered-page-N` identities (Fact 1 — no `deck.slides[i].id`
 * pairing); every other mode (`parsed`/`pending`/`failed`) reuses
 * `deck.slides[i].id`.
 *
 * CR-01 (42-REVIEW.md) — corrected 2026-08-07: a `pending`/`failed` ->
 * `ready` transition does NOT carry forward per-entry customization. A
 * previous version of this comment claimed it could — that was false.
 * `pending`/`failed` identities key on `deck.slides[i].id` (a parsed-slide
 * UUID); `ready` identities key on the synthetic `rendered-page-N` string
 * minted above. The two key spaces never overlap, so
 * `carryStoredDerivedEntries` cannot match a stored pending/failed entry to
 * its post-render counterpart: any label, per-slide `audioUrl`/`audioLoop`,
 * or `notes` a user attached via "Edit details" while the render was still
```

**`src/utils/importedRenderReconciler.ts:166-176`** — tags: CR-01 — qualifier: unqualified

_Summary:_ the promise — a positional `deck.slides[i]` <-> rendered-page-`i+1` pairing — because `mapAstToSlides` (pptxParser.ts) skips slides and emits one entry per image on a multi-image slide, so an index-based carry-forward wo...

```ts
 * the promise — a positional `deck.slides[i]` <-> rendered-page-`i+1` pairing
 * — because `mapAstToSlides` (pptxParser.ts) skips slides and emits one entry
 * per image on a multi-image slide, so an index-based carry-forward would
 * attach a user's note to the WRONG slide, which is worse than dropping it.
 * Neither `slideActionMenuItems` nor `EditSlideDrawer.vue` currently warns a
 * user that edits made while a deck's render is pending/failed will not
 * survive the transition to `ready` — see CR-01 for the follow-up options
 * (a render-stable identity scheme, or a UI warning) if this trade-off ever
 * needs revisiting. The returned array's length always equals
 * `resolution.entryCount`.
 */
```

### `src/utils/lastUsed.ts`

**`src/utils/lastUsed.ts:58-72`** — tags: WR-03 — qualifier: 84-REVIEW

_Summary:_ The single shared calendar-date parse convention for a `Service.date` `"YYYY-MM-DD"` string.

```ts
/**
 * The single shared calendar-date parse convention for a `Service.date`
 * `"YYYY-MM-DD"` string. BOTH the live store adapter (`services.ts`) and the
 * 84-02 backfill must use this exact expression so the `Timestamp` each
 * environment writes is identical.
 *
 * WR-03 (84-REVIEW): parses as UTC midnight (`Date.UTC`) rather than the
 * previous `new Date(\`${date}T00:00:00\`)`, which resolved "local midnight"
 * against whichever timezone the running process defaulted to — the end
 * user's browser on the client, but the HOST MACHINE's ambient `TZ` for the
 * Admin-SDK backfill script (a CI runner, cloud shell, or Docker container
 * commonly defaults to UTC). Two environments computing a different midnight
 * for the identical `"YYYY-MM-DD"` string would make `Timestamp.isEqual`
 * never converge — the backfill's idempotency check would "correct" an
 * already-correct song's `lastUsedAt` forever, off by a fixed offset, with
```

### `src/utils/monitorConfig.ts`

**`src/utils/monitorConfig.ts:7-27`** — tags: Pitfall, WR-04 — qualifier: 91-REVIEW.md

_Summary:_ this describes the physical cable plugged into THIS device, not an org/user preference, so the storage key is a SINGLE FIXED constant deliberately UNSCOPED by uid/org — a divergence from `stores/songs.ts`'s uid-scoped `w...

```ts
// this describes the physical cable plugged into THIS device, not an org/user
// preference, so the storage key is a SINGLE FIXED constant deliberately
// UNSCOPED by uid/org — a divergence from `stores/songs.ts`'s uid-scoped
// `wp:tagFilter:v2:${org}:${uid}` precedent, made on purpose (91-CONTEXT.md).
//
// A screen's `label`/id is not a stable hardware key across replug or a
// browser data-clear (PITFALLS Pitfall 2), so the persisted identity is a
// SYNTHESIZED fingerprint composed from label + resolution + position +
// isPrimary, never a raw screen id or array index.
//
// The module never calls the Window Management API itself (no
// `getScreenDetails()`) — screens are always passed in by the caller, keeping
// this pure and testable with plain object fixtures.
//
// `matchMapping`'s saved-vs-live comparison is BIDIRECTIONAL set-equality
// (WR-04, 91-REVIEW.md), not a one-way "every saved fingerprint is still
// live" subset check: a screen removed since the mapping was saved AND a
// screen newly added since are both genuine layout changes and both force
// `needs-reprompt` (R268 / PITFALLS Pitfall 2).

/** Minimal structural shape this module needs from a live screen object. */
```

### `src/utils/planningCenterApi.ts`

**`src/utils/planningCenterApi.ts:993-1002`** — tags: CR-01, WR-02 — qualifier: 102-REVIEW

_Summary:_ CR-01 (102-REVIEW): routed through the scriptureApi.ts dispatcher — the phase's single choke point — rather than calling fetchPassageText/fetchNltPassageText directly.

```ts
      // CR-01 (102-REVIEW): routed through the scriptureApi.ts dispatcher —
      // the phase's single choke point — rather than calling
      // fetchPassageText/fetchNltPassageText directly. That kept this "push
      // to Planning Center" flow ungated even after the server-side R297 gate
      // deployed, silently 403ing on every SCRIPTURE slot for a disabled org.
      // Kept wrapped in try/catch (the pre-existing shape) as a defensive
      // safety net: the dispatcher's gate check runs BEFORE its own internal
      // try/catch, so a throw from useAuthStore() there would otherwise
      // propagate here uncaught (same edge case WR-02, 102-REVIEW, restored
      // a catch for in the two Vue components).
```

**`src/utils/planningCenterApi.ts:1105-1110`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Raw PC person shape returned from the Planning Center Services v2 People API. NOTE: Services v2 has no phone-number vertex (RESEARCH.md Pitfall 5 / Assumption A1) — only name fields are read from this endpoint.

```ts

/**
 * Raw PC person shape returned from the Planning Center Services v2 People API.
 * NOTE: Services v2 has no phone-number vertex (RESEARCH.md Pitfall 5 / Assumption A1) —
 * only name fields are read from this endpoint.
 */
```

**`src/utils/planningCenterApi.ts:1116-1124`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Fetch all people from Planning Center Services v2, following pagination via links.next. Mirrors fetchAllPcSongs's pagination + 429-retry + proxy-URL-rewrite pattern (src/utils/pcSongImport.ts).

```ts
/**
 * Fetch all people from Planning Center Services v2, following pagination via links.next.
 * Mirrors fetchAllPcSongs's pagination + 429-retry + proxy-URL-rewrite pattern
 * (src/utils/pcSongImport.ts).
 *
 * Do NOT add any phone-number related include or nested resource fetch here — Services v2
 * has no such vertex and it would 404 (RESEARCH.md Pitfall 5 / Assumption A1). Phone is an
 * app-only field (D-14), always set to '' by mapPcPersonToUpsert.
 */
```

**`src/utils/planningCenterApi.ts:1182-1193`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Fetch the distinct people currently serving one of the caller's selected team positions (D-08/D-09/D-10 — selective import scoped by team AND role/position).

```ts

/**
 * Fetch the distinct people currently serving one of the caller's selected team positions
 * (D-08/D-09/D-10 — selective import scoped by team AND role/position). Uses the team-scoped
 * `/teams/{teamId}/person_team_position_assignments?include=person` endpoint (NOT the
 * service_type-scoped sibling — RESEARCH.md Pitfall 4) so the included Person resources are
 * returned inline, avoiding an N+1 per-person fetch. Mirrors fetchAllPeople's pagination +
 * 429-retry + proxy-URL-rewrite loop.
 *
 * Choir/orchestra positions are excluded simply by never being in `selectedPositionIds` (D-09).
 * Emails are NOT fetched here — that is Plan 04's concern if/when needed downstream.
 */
```

**`src/utils/planningCenterApi.ts:1271-1277`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Pure: PC person + its resolved emails → UpsertPersonInput. `phone` is ALWAYS '' — PC Services v2 has no phone vertex (D-14 app-only field, RESEARCH.md Pitfall 5).

```ts

/**
 * Pure: PC person + its resolved emails → UpsertPersonInput.
 * `phone` is ALWAYS '' — PC Services v2 has no phone vertex (D-14 app-only field,
 * RESEARCH.md Pitfall 5). Standing fields (active/roles) are left to the
 * store's upsert defaults and intentionally omitted here.
 */
```


### `src/utils/scheduler.ts`

**`src/utils/scheduler.ts:55-61`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Whether adding `candidateRoleId` to a person's already-assigned roleIds for a given date (`assignedRoleIdsThisDate`) keeps the resulting combo legal (D-10/D-12).

```ts

/**
 * Whether adding `candidateRoleId` to a person's already-assigned roleIds for a given date
 * (`assignedRoleIdsThisDate`) keeps the resulting combo legal (D-10/D-12). Pure/deterministic —
 * used by BOTH the main `eligible()` filter and `propagatePairing`'s role selection so paired
 * partners can never be pulled into an illegal combo (RESEARCH Pitfall 2).
 */
```

**`src/utils/scheduler.ts:78-89`** — tags: Pitfall — qualifier: unqualified

_Summary:_ (person, role), not blended across a person's roles). Blackout dates (D-07) and pairings (D-09) are hard constraints — never violated.

```ts
 * (person, role), not blended across a person's roles). Blackout dates (D-07) and pairings
 * (D-09) are hard constraints — never violated. Unfillable slots are reported in `unfilled`
 * rather than fabricating an assignment (D-10); pairings that can't be honored (partner
 * blacked out, out-tier for every eligible role, or no group-compatible role available) are
 * reported in `pairingConflicts` rather than silently dropped or forced. Group co-occurrence
 * rules (D-10) are enforced identically in both the main assignment loop and the pairing
 * propagation path via the shared `isGroupCompatible` helper (RESEARCH Pitfall 2).
 *
 * Pure function: no database reads/writes, no framework imports, no wall-clock reads, no
 * non-deterministic randomness — fully deterministic and unit-testable, mirroring the
 * pattern established by src/utils/suggestions.ts.
 */
```

**`src/utils/scheduler.ts:96-98`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Caller (quarters.ts) builds this from rosterStore.roles. Unknown roleIds default to 'other' (safe default) so existing call-sites that omit this param keep compiling and behave as "everything combines" (RESEARCH Pitfall...

```ts
  // Caller (quarters.ts) builds this from rosterStore.roles. Unknown roleIds default to 'other'
  // (safe default) so existing call-sites that omit this param keep compiling and behave as
  // "everything combines" (RESEARCH Pitfall 1).
```

**`src/utils/scheduler.ts:117-127`** — tags: WR-02 — qualifier: unqualified

_Summary:_ a person stays eligible for a role on the date at `dateIndex` ONLY while their per-role served count is still below the running even-spread target (dateIndex+1)/n — i.e. while they are behind their ideal pace.

```ts
  // a person stays eligible for a role on the date at `dateIndex` ONLY while their per-role served
  // count is still below the running even-spread target (dateIndex+1)/n — i.e. while they are
  // behind their ideal pace. This is what spreads a monthly (n=4) person evenly across the WHOLE
  // quarter (weeks 1, 5, 9, 13…) instead of greedily booking them every week until a flat
  // whole-quarter budget runs out and then leaving the rest blank (the front-loading bug: the
  // sole guitarist getting every Sunday in June, then nothing). A simple count ceiling can't do
  // this — the target has to advance with the calendar. WR-02: n<=0 (the drawer's "As-needed
  // (fill-in)" preset writes n:0, and malformed/legacy entries could too) has no valid cadence,
  // so the person is NEVER proactively scheduled — no divide-by-zero into Infinity. Used by BOTH
  // the main assignment loop and propagatePairing so direct picks and pull-ins are spaced
  // identically (no front-loading on either path).
```

**`src/utils/scheduler.ts:212-214`** — tags: Pitfall — qualifier: unqualified

_Summary:_ D-12/Pitfall 2 — the CONFIRMED landmine: propagatePairing is a second, independent role-selection path.

```ts
        // D-12/Pitfall 2 — the CONFIRMED landmine: propagatePairing is a second, independent
        // role-selection path. It MUST apply the exact same shared group-compatibility check as
        // the main loop below, or a paired partner can silently be pulled into an illegal combo.
```

**`src/utils/scheduler.ts:236-241`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Residual scope boundary (RESEARCH Pitfall 4 / Open Question 1, consciously accepted): this gate only constrains pull-ins via propagation.

```ts
        // Residual scope boundary (RESEARCH Pitfall 4 / Open Question 1, consciously accepted):
        // this gate only constrains pull-ins via propagation. If the partner independently holds
        // a role the anchor does not, the main loop's spacing pass could in principle still pick
        // the partner directly on a date the anchor isn't serving at all, which a maximally strict
        // reading of containment would forbid. The canonical pairing shape (co-vocalists /
        // parent-child sharing the same role) does not hit this edge case, so it's shipped as-is.
```

**`src/utils/scheduler.ts:247-250`** — tags: Pitfall — qualifier: unqualified

_Summary:_ R260 — a pulled-in paired partner who is themselves a multi-role holder also bundles their own other multi-roles onto this date (RESEARCH Open Question 1: implement the consistent version).

```ts
        // R260 — a pulled-in paired partner who is themselves a multi-role holder also bundles
        // their own other multi-roles onto this date (RESEARCH Open Question 1: implement the
        // consistent version). Composes cleanly since propagateMultiRole is independent per
        // person (RESEARCH Pitfall 4).
```

**`src/utils/scheduler.ts:255-262`** — tags: Pitfall — qualifier: unqualified

_Summary:_ R260 — same-date bundling of a person's OTHER multi-role assignments (RESEARCH B.2).

```ts

    // R260 — same-date bundling of a person's OTHER multi-role assignments (RESEARCH B.2). A
    // NON-recursive single sweep (Pitfall 2: no infinite propagation) over the person's whole
    // role set for this date, triggered after every multi-role assignment (both here and inside
    // propagatePairing above). Each pulled role is gated by its OWN withinCadence + slot
    // capacity + isGroupCompatible via the shared assignToRole (never a parallel writer —
    // Pitfall 1, dedupes and increments servedByRole exactly once). No rarity sort, no deficit
    // scoring change — rarity-anchoring is emergent from withinCadence's even-spread gate (B.3).
```

### `src/utils/scriptureBoundaries.ts`

**`src/utils/scriptureBoundaries.ts:17-25`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Matches a clause-ending mark followed by whitespace. Deliberately excludes the comma: including it fragments nearly every line of scripture into unreadably tiny pieces (RESEARCH § Common Pitfalls, Pitfall 4) and defeats...

```ts

/**
 * Matches a clause-ending mark followed by whitespace. Deliberately excludes
 * the comma: including it fragments nearly every line of scripture into
 * unreadably tiny pieces (RESEARCH § Common Pitfalls, Pitfall 4) and defeats
 * the point of "clause, not sentence, granularity." This is a tuning knob
 * owned by the empirical determinism check (RESEARCH Assumption A2/A3), not
 * an oversight — revisit if real Haiku output on Psalm 136/24 looks wrong.
 */
```

**`src/utils/scriptureBoundaries.ts:33-40`** — tags: Pitfall — qualifier: unqualified

_Summary:_ always included as the passage's own start/end anchors, even when the passage has no internal boundary at all. Pure and synchronous — reads no global state, fetches nothing, mutates nothing.

```ts
 * always included as the passage's own start/end anchors, even when the
 * passage has no internal boundary at all.
 *
 * Pure and synchronous — reads no global state, fetches nothing, mutates
 * nothing. Callers must compute this once and thread the SAME array through
 * both prompt-building and validation; recomputing between the two silently
 * desyncs indices from meaning (RESEARCH § Common Pitfalls, Pitfall 5).
 */
```

**`src/utils/scriptureBoundaries.ts:131-145`** — tags: WR-01 — qualifier: 47-REVIEW

_Summary:_ Reads the bracketed verse numbers present in `slice` and returns a single number as a string, a hyphenated first-last range when several are present, or `undefined` when the slice carries no verse marker at all.

```ts

/**
 * Reads the bracketed verse numbers present in `slice` and returns a single
 * number as a string, a hyphenated first-last range when several are
 * present, or `undefined` when the slice carries no verse marker at all.
 *
 * CAUTION (47-REVIEW WR-01): this scans `slice` for every `[N]` occurrence,
 * with no awareness of WHERE the slice's boundary was cut. When a verse runs
 * on into the next without terminal clause punctuation, there is no legal
 * boundary at "end of this verse's words" — only at the START of the next
 * verse's own marker — so a segment's raw slice can legitimately extend
 * through the next verse's `[N]` marker even though none of that verse's
 * words are included. Calling this on such a slice reports the next verse
 * as part of the range even though it isn't. Callers that have boundary
 * indices available (not just raw slice text) should prefer
```

**`src/utils/scriptureBoundaries.ts:154-169`** — tags: WR-01 — qualifier: 47-REVIEW

_Summary:_ WR-01 fix (47-REVIEW): the verse range that actually belongs to a segment spanning `boundaries[startBoundary]..boundaries[endBoundary]`, computed from WHERE each verse marker's own boundary sits — never by re-scanning th...

```ts

/**
 * WR-01 fix (47-REVIEW): the verse range that actually belongs to a segment
 * spanning `boundaries[startBoundary]..boundaries[endBoundary]`, computed
 * from WHERE each verse marker's own boundary sits — never by re-scanning
 * the raw slice text for every `[N]` occurrence it happens to contain (see
 * the caution on `verseRangeForSlice` above).
 *
 * A verse belongs to this segment only if the boundary its own `[N]` marker
 * created lies in `[startBoundary, endBoundary)` — i.e. strictly BEFORE
 * `endBoundary`. This is what excludes a verse whose marker only appears
 * because the segment's raw span had nowhere legal to end except at that
 * verse's own start (the exact WR-01 scenario): that verse's marker
 * boundary equals `endBoundary` itself, which fails the strict `<` and is
 * correctly attributed to the NEXT segment instead.
 */
```

### `src/utils/slideGroupMaterializer.ts`

**`src/utils/slideGroupMaterializer.ts:7-21`** — tags: WR-02 — qualifier: unqualified

_Summary:_ store or Vue reactivity — callers (the composable) load data, decide, and write. Mirrors `slideshowAssembler.ts`'s stated purity contract.

```ts
 * store or Vue reactivity — callers (the composable) load data, decide, and
 * write. Mirrors `slideshowAssembler.ts`'s stated purity contract.
 *
 * The load-bearing id invariant is that an entry id is minted ONCE and never
 * REgenerated for an existing entry — `PresentationViewer.vue` keys its
 * per-slide `AudioPlayer`/`VideoPlayer` child components on this id (Phase 23's
 * WR-02 contract), so regenerating one leaks stale muted/blocked media state
 * from one slide onto another. Every carry/merge path below therefore spreads
 * the stored entry (`{ ...stored }`) rather than rebuilding it, and the
 * assembler (24-04) never mints at all.
 *
 * This is NOT the same as "only `deriveGroupEntries` mints", which this comment
 * used to claim and which has been false for several phases (LO-04):
 * `rebuildSongGroup` mints for a newly-resolved section and for absent
 * leading/trailing copyright entries, and `SlideGrid.vue` and
```

**`src/utils/slideGroupMaterializer.ts:142-149`** — tags: Pitfall — qualifier: 42-RESEARCH.md

_Summary:_ In the ready state an identity is the reconciler's synthetic `rendered-page-N` string, page-scoped rather than a parsed inner slide id — never `deck.slides[i].id` (no positional pairing exists, 42-RESEARCH.md Pitfall 1)....

```ts

      // In the ready state an identity is the reconciler's synthetic
      // `rendered-page-N` string, page-scoped rather than a parsed inner
      // slide id — never `deck.slides[i].id` (no positional pairing exists,
      // 42-RESEARCH.md Pitfall 1). In every other mode it IS a parsed inner
      // slide id, unchanged from before this phase. A deck with no
      // `renderImportId` resolves to `parsed` mode here, which is
      // byte-identical to the pre-Phase-42 behaviour (D-16).
```

**`src/utils/slideGroupMaterializer.ts:577-597`** — tags: CR-01, Pitfall — qualifier: unqualified

_Summary:_ Additive-only song rebuild (D-02, RESEARCH.md Pattern 3 strategy 1 / Pitfall 4): diffs the fresh resolved section order against the stored entries by `sourceRef.sectionId` — the ONE content-stable key available for songs...

```ts

/**
 * Additive-only song rebuild (D-02, RESEARCH.md Pattern 3 strategy 1 /
 * Pitfall 4): diffs the fresh resolved section order against the stored
 * entries by `sourceRef.sectionId` — the ONE content-stable key available for
 * songs, since `ccliParser.ts` mints ids by slugifying labels. A section
 * newly present in the source is INSERTED; a stored entry whose section
 * still resolves is KEPT BY VALUE (never rebuilt — only `order` may be
 * renumbered); a stored entry whose section no longer resolves is RETAINED,
 * never deleted. The leading/trailing `copyright` entries are matched by
 * kind and position, never by `sectionId`, and are never duplicated.
 *
 * A full song-IDENTITY swap (CR-01) is detected FIRST, before any of the
 * above additive logic runs: if the group's stored lyric/copyright entries
 * reference a `songId` different from the slot's CURRENT `songId`, the slot
 * was reassigned to a different song entirely — a source-identity change,
 * not a section-level edit within the same song. The additive by-sectionId
 * merge is only valid for edits WITHIN the same song; running it across a
 * song swap would blend the old song's copyright/lyric entries with the new
 * song's (every old entry's `sectionId` looks "unresolvable" against the new
 * song and gets retained forever). Phase 30 makes this branch UNCONDITIONAL —
```

**`src/utils/slideGroupMaterializer.ts:735-737`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Retained-but-unresolvable entries — kept relative to each other, appended after the resolvable run and before the trailing copyright (Pitfall 4).

```ts

  // Retained-but-unresolvable entries — kept relative to each other, appended
  // after the resolvable run and before the trailing copyright (Pitfall 4).
```

**`src/utils/slideGroupMaterializer.ts:769-781`** — tags: CR-01 — qualifier: 38-REVIEW

_Summary:_ Two-field result shape shared by every `rebuild*Group` function, dispatched via {@link rebuildGroup}.

```ts

/**
 * Two-field result shape shared by every `rebuild*Group` function, dispatched via {@link rebuildGroup}. Phase 30 deleted the old six-field confirm-shaped result along with the confirm gate itself — every rebuild now decides and writes unconditionally.
 *
 * 38-REVIEW CR-01: `sourceSignature` is an OPTIONAL third field, read only by
 * the composable's write step (`useSlideshowAssembly.ts`) when present.
 * `undefined` (the field simply absent, the default for every branch except
 * the one below) means "no opinion — the composable's own freshly-recomputed
 * signature governs, exactly as before this field existed." An explicit
 * `null` means "clear the stored signature," which the composable and
 * `replaceGroupSlides` must turn into a real Firestore `deleteField()`, not
 * an omitted key — `stripUndefined` treats an omitted key and `undefined` as
 * "no change," which cannot express "remove this," the same distinction
```

**`src/utils/slideGroupMaterializer.ts:912-920`** — tags: CR-01 — qualifier: 38-REVIEW

_Summary:_ 38-REVIEW CR-01: this is the one branch that empties a Congregational group's section entries via a reference clear, where the freshly computed `sourceSignature(slot, inputs)` is `undefined` because there is no reference...

```ts
      // 38-REVIEW CR-01: this is the one branch that empties a Congregational
      // group's section entries via a reference clear, where the freshly
      // computed `sourceSignature(slot, inputs)` is `undefined` because there
      // is no reference left to sign — NOT because there is "no opinion."
      // Without an explicit `sourceSignature: null` here, the write path's
      // `stripUndefined` would leave the group's stale congregational
      // signature stored, and a later re-entry of the identical reading would
      // hit the DETACHED short-circuit above against a permanently-empty
      // `slides` array. See `RebuildResult`'s doc comment.
```

### `src/utils/slideTypography.ts`

**`src/utils/slideTypography.ts:123-127`** — tags: WR-02 — qualifier: 46-REVIEW.md

_Summary:_ WR-02 (46-REVIEW.md): a rejected document.fonts.load() is a FAILED load, not a stalled one — resolve `false` (same as a timeout) instead of letting the rejection propagate through Promise.race below, which would break th...

```ts
    // WR-02 (46-REVIEW.md): a rejected document.fonts.load() is a FAILED
    // load, not a stalled one — resolve `false` (same as a timeout)
    // instead of letting the rejection propagate through Promise.race
    // below, which would break this function's documented "never hangs
    // the caller" contract for the reject case.
```

### `src/utils/slideshowAssembler.ts`

**`src/utils/slideshowAssembler.ts:12-26`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Two resolution paths, per slot: 1. A slot with a materialized `SlideGroup` (`inputs.groupsBySlotId`) joins that group's stored structure against LIVE canonical content resolved through each entry's `sourceRef` (D-02) — e...

```ts
 *
 * Two resolution paths, per slot:
 * 1. A slot with a materialized `SlideGroup` (`inputs.groupsBySlotId`) joins
 *    that group's stored structure against LIVE canonical content resolved
 *    through each entry's `sourceRef` (D-02) — editing a song's lyrics
 *    changes the assembled text with no group write. Slide ids equal the
 *    stored `GroupSlideEntry.id`, never recomputed (Phase 23 WR-02). Audio
 *    resolves via D-04's two-level precedence (`resolveEntryMedia`); video
 *    has no bed layer (D-18) and resolves only from a video slide's own
 *    `sourceRef` in `resolveEntryContent`.
 * 2. A slot with NO materialized group yet falls back to deriving the
 *    slideshow directly from the slot's own source (today's pre-Phase-24
 *    behaviour), so the app stays coherent before 24-05/24-06 wire up
 *    reactive group subscription and lazy materialization. Fallback slide
 *    ids are derived from the slot's stable `id` (not slot array index), so
```

**`src/utils/slideshowAssembler.ts:184-190`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01 (105 code review): no blackout arm here — this whole `case 'lyric':` branch is unreachable via `assembleSlideshow` (every `'lyric'`-kind entry is fully handled and `continue`s in the entry loop before this function...

```ts
      // WR-01 (105 code review): no blackout arm here — this whole `case
      // 'lyric':` branch is unreachable via `assembleSlideshow` (every
      // `'lyric'`-kind entry is fully handled and `continue`s in the entry
      // loop before this function is ever called for it; see the R117
      // comment at this file's `assembleSlideshow` entry loop). Blackout
      // resolution lives in the loop itself, not here — adding a blackout
      // arm to this dead branch would just be more dead code.
```

**`src/utils/slideshowAssembler.ts:314-324`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01 behavioral decision (confirm at human-verify): a `video`-kind entry NEVER resolves the group's bed audio, even when it has no `entry.audioUrl` of its own and the group DOES have a `bedAudioUrl`.

```ts

/**
 * WR-01 behavioral decision (confirm at human-verify): a `video`-kind entry
 * NEVER resolves the group's bed audio, even when it has no `entry.audioUrl`
 * of its own and the group DOES have a `bedAudioUrl`. This extends D-04's
 * "slide beats group" precedence to video — a dropped video slide carries its
 * own soundtrack inside `videoSrc` (rendered by `PresentationViewer`'s own
 * `VideoPlayer`, unmuted by default), so layering the group's `AudioPlayer`
 * underneath it would play two unrelated audio sources at once with no
 * on-screen indication. The bed is not paused/stopped globally — it simply
 * resolves normally on whatever slide follows, since this function runs
```

**`src/utils/slideshowAssembler.ts:333-341`** — tags: Pitfall — qualifier: 33-RESEARCH.md, 33-UI-SPEC.md

_Summary:_ R055/R056/R057: slide → group → song, most specific wins. Computed BEFORE the video early return below (★ Pitfall 1, 33-RESEARCH.md) — a video slide's own audio bed is deliberately suppressed (two audio sources would col...

```ts
  // R055/R056/R057: slide → group → song, most specific wins. Computed
  // BEFORE the video early return below (★ Pitfall 1, 33-RESEARCH.md) — a
  // video slide's own audio bed is deliberately suppressed (two audio
  // sources would collide audibly), but a video slide's background is NOT
  // suppressed the same way: a video's own picture already covers the
  // background, and there is no collision to avoid. See 33-UI-SPEC.md §9.
  // ★ Pitfall 3: `song` is legitimately `undefined` for non-SONG groups
  // (PRAYER/SCRIPTURE/MESSAGE/HYMN/IMPORTED) — optional-chain the song tier
  // so resolving a group with no owning song never throws.
```

**`src/utils/slideshowAssembler.ts:421-426`** — tags: WR-02 — qualifier: unqualified

_Summary:_ R117 (Phase 53): a manually-split lyric section resolves LIVE to N slides that all share ONE stored entry; each needs a distinct, stable slide id. The caller passes `${entry.id}:${i}` for a split's i-th slice.

```ts
    // R117 (Phase 53): a manually-split lyric section resolves LIVE to N
    // slides that all share ONE stored entry; each needs a distinct, stable
    // slide id. The caller passes `${entry.id}:${i}` for a split's i-th slice.
    // When absent (every non-lyric entry AND every unsplit lyric section) the
    // slide keeps `entry.id` verbatim — byte-identical to today, preserving the
    // Phase 23 WR-02 media-keying invariant (id === groupSlideId === entry.id).
```

**`src/utils/slideshowAssembler.ts:429-438`** — tags: Pitfall, WR-01 — qualifier: unqualified

_Summary:_ WR-01: song lookup keyed on the GROUP's owning song (via the slot), not the individual entry's own `sourceRef.kind`.

```ts
    // WR-01: song lookup keyed on the GROUP's owning song (via the slot),
    // not the individual entry's own `sourceRef.kind`. A SONG group's
    // `slides` array can legitimately contain `text`/`video` entries
    // (slideGroupMaterializer.ts's reconciler carries them through by value,
    // preserved from before R054's Phase-30 lockdown) — keying on
    // `entry.sourceRef.kind` alone left those entries unable to resolve the
    // song background tier even though every sibling lyric/copyright slide
    // in the SAME group correctly fell through to it. Every other slot kind
    // (PRAYER/SCRIPTURE/MESSAGE/HYMN/IMPORTED) has no owning song document,
    // so `song` stays `undefined` for them (★ Pitfall 3).
```

**`src/utils/slideshowAssembler.ts:446-448`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Never recompute the base id — the stored GroupSlideEntry.id IS the slide id (Phase 23 WR-02 keys media children on it). A split's positional `${entry.id}:${i}` override is likewise stable across recomputes.

```ts
    // Never recompute the base id — the stored GroupSlideEntry.id IS the slide
    // id (Phase 23 WR-02 keys media children on it). A split's positional
    // `${entry.id}:${i}` override is likewise stable across recomputes.
```

**`src/utils/slideshowAssembler.ts:456-460`** — tags: CR-01 — qualifier: 105-UI-SPEC.md

_Summary:_ CR-01 (105 code review): a blackout slide never carries a background, matching src/types/slide.ts's BlackoutSlide doc comment and 105-UI-SPEC.md's R303 content contract.

```ts
      // CR-01 (105 code review): a blackout slide never carries a background,
      // matching src/types/slide.ts's BlackoutSlide doc comment and 105-UI-SPEC.md's
      // R303 content contract. `resolveEntryMedia` only special-cases 'video' for
      // suppression — it has no view of `content.contentKind` — so blackout must be
      // suppressed here, the one place both are in scope.
```

**`src/utils/slideshowAssembler.ts:486-494`** — tags: WR-02 — qualifier: unqualified

_Summary:_ from the GROUP tier (`backgroundSource: 'group'`), bed audio from `group.bedAudioUrl` with `audioFromBed: true` and `groupId: group.id` set, so the presenter's `AudioPlayer` key `group:{groupId}:{url}` stays continuous a...

```ts
   * from the GROUP tier (`backgroundSource: 'group'`), bed audio from
   * `group.bedAudioUrl` with `audioFromBed: true` and `groupId: group.id` set,
   * so the presenter's `AudioPlayer` key `group:{groupId}:{url}` stays
   * continuous across the reference->section transition (AC7). NO
   * `groupSlideId` is set — there is no entry, and media never keys on a
   * fabricated entry id (background reads `slide.backgroundImageUrl`, audio
   * keys on `groupId`); omitting it is what preserves the Phase 23 WR-02
   * invariant rather than inventing an id to violate it.
   */
```

**`src/utils/slideshowAssembler.ts:519`** — tags: WR-02 — qualifier: unqualified

_Summary:_ No groupSlideId — there is no entry (WR-02 boundary, see above).

```ts
      // No groupSlideId — there is no entry (WR-02 boundary, see above).
```

### `src/utils/slotTypes.ts`

**`src/utils/slotTypes.ts:372-382`** — tags: Pitfall — qualifier: 44-RESEARCH.md

_Summary:_ Reads `PROGRESSION_SLOT_TYPES[progression]` as an ORDERED SEQUENCE of VW types, not a position lookup (Pitfall #2, 44-RESEARCH.md).

```ts

/**
 * Reads `PROGRESSION_SLOT_TYPES[progression]` as an ORDERED SEQUENCE of VW
 * types, not a position lookup (Pitfall #2, 44-RESEARCH.md). The map's keys
 * are absolute array indices that only mean anything against `buildSlots()`'s
 * fixed 9-slot layout — sorting those keys ascending and mapping to their
 * values yields the sequence a custom (arbitrary-shape) template must walk
 * by SONG ordinal instead.
 *
 * '1-2-2-3' → [1, 2, 2, 3, 3]   '1-2-3-3' → [1, 2, 3, 3, 3]
 */
```

### `src/utils/songEditLink.ts`

**`src/utils/songEditLink.ts:5-18`** — tags: Pitfall — qualifier: 26-RESEARCH.md

_Summary:_ This application has no per-song address today — `/songs` is a flat list route with no id segment, and the song editor (`SongSlideOver.vue`) is opened purely from local click state inside `SongsView.vue`.

```ts
 * This application has no per-song address today — `/songs` is a flat list route
 * with no id segment, and the song editor (`SongSlideOver.vue`) is opened purely
 * from local click state inside `SongsView.vue`. Adding a real per-song route
 * would be a larger change than this phase's scope allows. This module instead
 * extends the query-param convention `SongsView.vue` already uses for its
 * existing `?import=true` auto-open-import parameter (read on mount, act, then
 * clear via a non-navigating `router.replace`) — see 26-RESEARCH.md Pitfall 4.
 *
 * This module is pure: it imports nothing from Vue, the router, or any store, so
 * the sender (a future drawer) and the receiver (`SongsView.vue`) can never drift
 * apart on the shape of the link they share.
 */

/** The only tabs `SongSlideOver.vue` actually has. */
```

### `src/utils/songSectionOrder.ts`

**`src/utils/songSectionOrder.ts:31-38`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Unique within a single `buildSectionRows` result. Positionally derived (`${sectionId}#${occurrenceIndex}`) — used for display/testid purposes only.

```ts
   * Unique within a single `buildSectionRows` result. Positionally derived
   * (`${sectionId}#${occurrenceIndex}`) — used for display/testid purposes
   * only. NOT stable across a mutation that changes which occurrence of a
   * repeated section comes first (drag reorder, duplicate/remove of an
   * earlier occurrence). Callers that need to track UI state (e.g.
   * expand/collapse) per physical row across such mutations must use
   * `stableKey` instead (WR-01).
   */
```

**`src/utils/songSectionOrder.ts:82-93`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Derives the numbered row list option 2a draws from a (sections, order) pair. Skips an order id that resolves to no pooled section rather than emitting a row with an undefined section. Never mutates its arguments.

```ts
 * Derives the numbered row list option 2a draws from a (sections, order)
 * pair. Skips an order id that resolves to no pooled section rather than
 * emitting a row with an undefined section. Never mutates its arguments.
 *
 * `slotIds`, when supplied, must be the same length as `order` — element
 * `i` is a stable identity for the order slot at `order[i]`, independent of
 * section id or position, exposed as `SectionRow.stableKey` (WR-01: lets a
 * caller track UI state, e.g. expand/collapse, per physical row across a
 * reorder/duplicate/remove instead of by the positionally-derived
 * `rowKey`). Omitted or mismatched-length `slotIds` falls back to `rowKey`
 * for `stableKey`, preserving prior behavior for callers that don't pass it.
 */
```

**`src/utils/songSectionOrder.ts:120-129`** — tags: Pitfall — qualifier: unqualified

_Summary:_ R304 / PITFALLS Pitfall 5: a blackout section is excluded from per-kind lyric numbering ENTIRELY — it never consumes a kindOrdinals slot or a numberBySectionId entry, so inserting/duplicating/removing a blackout can neve...

```ts

    // R304 / PITFALLS Pitfall 5: a blackout section is excluded from
    // per-kind lyric numbering ENTIRELY — it never consumes a kindOrdinals
    // slot or a numberBySectionId entry, so inserting/duplicating/removing a
    // blackout can never renumber a Verse/Chorus row. Its displayLabel is
    // its own stored label (already unique — minted via addSection's
    // uniqueSectionLabel collision guard), not a derived "Kind N" number.
    // Everything else below (position, occurrenceIndex, isRepeat,
    // repeatOfPosition, rowKey/stableKey) is computed identically to a
    // lyric row — a blackout is a first-class row in the order.
```

### `src/utils/volunteerCsv.ts`

**`src/utils/volunteerCsv.ts:52-55`** — tags: WR-03 — qualifier: unqualified

_Summary:_ WR-03: mirror the bareInt branch's `> 0` guard — "1-in-0" (and any other non-positive N) must fall through to the same default-4 path as an invalid bare integer, never accepted as a literal 0 (which would produce an Infi...

```ts

  // WR-03: mirror the bareInt branch's `> 0` guard — "1-in-0" (and any other non-positive N)
  // must fall through to the same default-4 path as an invalid bare integer, never accepted
  // as a literal 0 (which would produce an Infinity deficit score in scheduler.ts).
```

**`src/utils/volunteerCsv.ts:111-113`** — tags: WR-03 — qualifier: unqualified

_Summary:_ WR-03: a "1-in-N" cell only counts as a known/recognized label when N is actually a positive integer — "1-in-0" must surface the same unrecognized/defaulted warning as an invalid bare integer, not be silently accepted as...

```ts
  // WR-03: a "1-in-N" cell only counts as a known/recognized label when N is actually a
  // positive integer — "1-in-0" must surface the same unrecognized/defaulted warning as an
  // invalid bare integer, not be silently accepted as N=0.
```

**`src/utils/volunteerCsv.ts:139-143`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Normalize a name for comparison: trim, collapse internal whitespace, lowercase. Used to match CSV names against roster people (D-16, Pitfall 4).

```ts

/**
 * Normalize a name for comparison: trim, collapse internal whitespace,
 * lowercase. Used to match CSV names against roster people (D-16, Pitfall 4).
 */
```

### `src/views/AudienceOutputView.vue`

**`src/views/AudienceOutputView.vue:38-39`** — tags: Pitfall — qualifier: unqualified

_Summary:_ R271 / Pitfall 6 — the ONE interactive element in this view, shown

```vue

    <!-- R271 / Pitfall 6 — the ONE interactive element in this view, shown
```

**`src/views/AudienceOutputView.vue:96-101`** — tags: WR-02 — qualifier: unqualified

_Summary:_ The shared output-window lifecycle-core (R272 reuse-not-fork): ?org=/serviceId scoping, WR-02 subscribe gate, read-only assembly, receive-only run channel, font gate, rootStyle cursor coupling, non-teardown fullscreen re...

```vue

// The shared output-window lifecycle-core (R272 reuse-not-fork): ?org=/serviceId
// scoping, WR-02 subscribe gate, read-only assembly, receive-only run channel,
// font gate, rootStyle cursor coupling, non-teardown fullscreen recovery, and the
// Screen Wake Lock — all registered on THIS view's instance via its onMounted/
// onUnmounted. The per-canvas media plumbing stays view-local below.
```

### `src/views/ConfidenceOutputView.vue`

**`src/views/ConfidenceOutputView.vue:78-79`** — tags: Pitfall — qualifier: unqualified

_Summary:_ R271 / Pitfall 6 — the ONE interactive element, shown ONLY when

```vue

    <!-- R271 / Pitfall 6 — the ONE interactive element, shown ONLY when
```

**`src/views/ConfidenceOutputView.vue:136-144`** — tags: WR-02 — qualifier: unqualified

_Summary:_ The shared output-window lifecycle-core (R272 reuse-not-fork): ?org=/serviceId scoping, WR-02 subscribe gate, read-only assembly, receive-only run channel, font gate, rootStyle cursor coupling, non-teardown fullscreen re...

```vue

// The shared output-window lifecycle-core (R272 reuse-not-fork): ?org=/serviceId
// scoping, WR-02 subscribe gate, read-only assembly, receive-only run channel,
// font gate, rootStyle cursor coupling, non-teardown fullscreen recovery, and the
// Screen Wake Lock — all inherited identically from the audience window. The
// per-canvas media plumbing stays view-local below (current pane only).
// `blackout` is intentionally NOT destructured here (R305): the confidence
// monitor no longer consumes it. useOutputWindow keeps returning it unchanged
// for AudienceOutputView.
```

### `src/views/DashboardView.vue`

**`src/views/DashboardView.vue:275-285`** — tags: CR-01 — qualifier: 104-REVIEW

_Summary:_ 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue -> authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or remount, so an onMounted-only subscribe (guarded by `if (!store.orgId)`, whic...

```vue
// 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so an onMounted-only subscribe (guarded by `if (!store.orgId)`,
// which would also defeat re-subscription since resetOrgScopedStores() nulls
// orgId before this fires) never re-points the shared stores on switch.
// Watching with `immediate: true` replaces the onMounted-only subscribe
// (mirrors TeamView.vue 104-REVIEW CR-01). Always pass the LIVE new orgId the
// watcher hands in — never a mount-time captured value — so no write can land
// on the wrong church. Dashboard shares these stores with other views and has
// no onUnmounted of its own; the unsubscribe-then-resubscribe here is
// idempotent and null-guarded.
```

### `src/views/MonitorSetupView.vue`

**`src/views/MonitorSetupView.vue:83-84`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: a re-detect / OS screenschange whose physical screen set

```vue

          <!-- WR-02: a re-detect / OS screenschange whose physical screen set
```

**`src/views/MonitorSetupView.vue:186-192`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02 state: `dirtyEdits` tracks whether the operator has made unsaved in-progress role selections (a fresh/reprompt selection, or a "Reassign roles" edit from the matched summary).

```vue

// WR-02 state: `dirtyEdits` tracks whether the operator has made unsaved
// in-progress role selections (a fresh/reprompt selection, or a "Reassign
// roles" edit from the matched summary). `refreshNoticeVisible` surfaces a
// non-blocking notice when a mid-session refresh (Re-detect / OS
// screenschange) was suppressed to protect those edits because the physical
// screen set had not actually changed.
```

**`src/views/MonitorSetupView.vue:199-203`** — tags: WR-03 — qualifier: unqualified

_Summary:_ Monotonic token guarding against a stale getScreenDetails() resolution overriding a newer detection attempt (REVIEW-FIX WR-03).

```vue

// Monotonic token guarding against a stale getScreenDetails() resolution
// overriding a newer detection attempt (REVIEW-FIX WR-03). Bumped by every
// new detection attempt, so a resolution/rejection that arrives after a newer
// attempt started is a no-op.
```

**`src/views/MonitorSetupView.vue:232-233`** — tags: WR-02 — qualifier: unqualified

_Summary:_ The operator has an unsaved edit now — a same-layout refresh must not clobber it (WR-02). Clear any prior "we kept your choices" notice too.

```vue
  // The operator has an unsaved edit now — a same-layout refresh must not
  // clobber it (WR-02). Clear any prior "we kept your choices" notice too.
```

**`src/views/MonitorSetupView.vue:237-240`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Expanding the matched B2 summary into the editable grid is itself the start of an unsaved edit — mark it dirty so a same-layout Re-detect / screenschange can't collapse it back to the read-only summary (WR-02).

```vue

// Expanding the matched B2 summary into the editable grid is itself the start
// of an unsaved edit — mark it dirty so a same-layout Re-detect / screenschange
// can't collapse it back to the read-only summary (WR-02).
```

**`src/views/MonitorSetupView.vue:288`** — tags: WR-02 — qualifier: unqualified

_Summary:_ The edit is now the saved baseline — no longer dirty (WR-02).

```vue
    // The edit is now the saved baseline — no longer dirty (WR-02).
```

**`src/views/MonitorSetupView.vue:318-321`** — tags: WR-02 — qualifier: unqualified

_Summary:_ A full (re)resolution establishes a clean baseline from persisted state — any prior in-progress edit is intentionally being replaced here, so clear the dirty/notice flags (WR-02).

```vue
  // A full (re)resolution establishes a clean baseline from persisted state —
  // any prior in-progress edit is intentionally being replaced here, so clear
  // the dirty/notice flags (WR-02). Callers that must PROTECT an unsaved edit
  // (applyDetectedScreens on a same-set refresh) skip calling this entirely.
```

**`src/views/MonitorSetupView.vue:341-342`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Layout changed since the mapping was saved — never guess the new mapping from the stale one (PITFALLS Pitfall 2).

```vue
    // Layout changed since the mapping was saved — never guess the new
    // mapping from the stale one (PITFALLS Pitfall 2).
```

**`src/views/MonitorSetupView.vue:349-351`** — tags: WR-02 — qualifier: unqualified

_Summary:_ A stable, order-independent key of the physical screen SET, used to decide whether a mid-session refresh actually changed the monitors (WR-02).

```vue

// A stable, order-independent key of the physical screen SET, used to decide
// whether a mid-session refresh actually changed the monitors (WR-02).
```

**`src/views/MonitorSetupView.vue:360-368`** — tags: WR-02 — qualifier: unqualified

_Summary:_ `isRefresh` distinguishes a mid-session re-detect / OS screenschange (the operator is already looking at the granted grid, possibly mid-edit) from an initial detection.

```vue
 * `isRefresh` distinguishes a mid-session re-detect / OS screenschange (the
 * operator is already looking at the granted grid, possibly mid-edit) from an
 * initial detection. On a refresh whose physical screen SET is unchanged, an
 * unconditional `resolveGrantedBranch()` would silently discard the operator's
 * unsaved role selections (and collapse a "Reassign roles" edit back to the
 * read-only summary) — so we keep the in-progress edit and show a non-blocking
 * notice instead (WR-02). A genuine layout change still re-resolves, since
 * selections made against screens that are gone are no longer valid.
 */
```

**`src/views/MonitorSetupView.vue:382`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Same monitors, unsaved edit in flight — protect it (WR-02).

```vue
    // Same monitors, unsaved edit in flight — protect it (WR-02).
```

**`src/views/MonitorSetupView.vue:411-416`** — tags: Pitfall — qualifier: unqualified

_Summary:_ The single most gesture-sensitive line in this phase: getScreenDetails() MUST be the first statement here (after the plain feature-detect guard, which consumes no event-loop turn) with NO await/store dispatch/router call...

```vue

// The single most gesture-sensitive line in this phase: getScreenDetails()
// MUST be the first statement here (after the plain feature-detect guard,
// which consumes no event-loop turn) with NO await/store dispatch/router
// call before it — an intervening await loses user activation and the
// permission prompt silently fails to appear (PITFALLS Pitfall 1/9).
```

**`src/views/MonitorSetupView.vue:423-424`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Synchronous ref bump, NOT an await — preserves user activation for the getScreenDetails() call immediately below (PITFALLS Pitfall 1/9).

```vue
  // Synchronous ref bump, NOT an await — preserves user activation for the
  // getScreenDetails() call immediately below (PITFALLS Pitfall 1/9).
```

**`src/views/MonitorSetupView.vue:429-430`** — tags: WR-03 — qualifier: unqualified

_Summary:_ Stale-resolution guard (REVIEW-FIX WR-03): ignore if a newer detection attempt started while this was still pending.

```vue
      // Stale-resolution guard (REVIEW-FIX WR-03): ignore if a newer
      // detection attempt started while this was still pending.
```

**`src/views/MonitorSetupView.vue:449-450`** — tags: WR-02 — qualifier: unqualified

_Summary:_ Refresh path — protect any unsaved in-progress edit when the physical screen set is unchanged (WR-02).

```vue
      // Refresh path — protect any unsaved in-progress edit when the physical
      // screen set is unchanged (WR-02).
```

**`src/views/MonitorSetupView.vue:466`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Pre-read for UI state only — never the actual gate (PITFALLS Pitfall 1).

```vue
      // Pre-read for UI state only — never the actual gate (PITFALLS Pitfall 1).
```

### `src/views/OwnerConsoleView.vue`

**`src/views/OwnerConsoleView.vue:13`** — tags: WR-01 — qualifier: 81-REVIEW

_Summary:_ below is unchanged. WR-01 (81-REVIEW): roving tabindex requires the

```vue
           below is unchanged. WR-01 (81-REVIEW): roving tabindex requires the
```

**`src/views/OwnerConsoleView.vue:90-93`** — tags: Pitfall — qualifier: unqualified

_Summary:_ `useRoute()`/`useRouter()` return undefined when this view is mounted without a router (existing OwnerConsoleView.test.ts harness) — every read below is optional-chained (RosterView.vue precedent, RESEARCH Pitfall 2).

```vue

// `useRoute()`/`useRouter()` return undefined when this view is mounted
// without a router (existing OwnerConsoleView.test.ts harness) — every read
// below is optional-chained (RosterView.vue precedent, RESEARCH Pitfall 2).
```

**`src/views/OwnerConsoleView.vue:113-117`** — tags: WR-01 — qualifier: 81-REVIEW

_Summary:_ WR-01 (81-REVIEW): roving tabindex (above) removes inactive tabs from the Tab key order per the WAI-ARIA APG Tabs pattern, which requires arrow-key navigation to compensate.

```vue

// WR-01 (81-REVIEW): roving tabindex (above) removes inactive tabs from the
// Tab key order per the WAI-ARIA APG Tabs pattern, which requires arrow-key
// navigation to compensate. ArrowLeft/ArrowRight move + activate the
// adjacent tab (wrapping); Home/End jump to the first/last tab.
```

### `src/views/QuarterView.vue`

**`src/views/QuarterView.vue:313-314`** — tags: R-10 — qualifier: unqualified

_Summary:_ Add-quarter modal (R-10/D-13) — secondary, separate from the quarter switcher

```vue

    <!-- Add-quarter modal (R-10/D-13) — secondary, separate from the quarter switcher -->
```

**`src/views/QuarterView.vue:610-612`** — tags: R-10 — qualifier: unqualified

_Summary:_ ── New quarter creation (Add-quarter modal, R-10/D-13) ───────────────────── The quarter chronologically after (year, quarter). Q4 rolls over to Q1 next year.

```vue

// ── New quarter creation (Add-quarter modal, R-10/D-13) ─────────────────────
// The quarter chronologically after (year, quarter). Q4 rolls over to Q1 next year.
```

**`src/views/QuarterView.vue:784-787`** — tags: R-02 — qualifier: unqualified

_Summary:_ Prefer the memorable, slug-based public URL (/{slug}/quarterN-YYYY) that finalizeAndShare also writes (R-02/D-18). Fall back to the opaque token URL only when the org has no configured slug yet.

```vue

// Prefer the memorable, slug-based public URL (/{slug}/quarterN-YYYY) that
// finalizeAndShare also writes (R-02/D-18). Fall back to the opaque token URL
// only when the org has no configured slug yet.
```

**`src/views/QuarterView.vue:844-851`** — tags: CR-01 — qualifier: 104-REVIEW

_Summary:_ 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue -> authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or remount, so an onMounted-only subscribe never re-fires on switch.

```vue

// 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so an onMounted-only subscribe never re-fires on switch. Watching
// with `immediate: true` replaces the old onMounted-only subscribe (mirrors
// TeamView.vue 104-REVIEW CR-01). Always pass the LIVE new orgId the watcher
// hands in — never a mount-time captured value — so no write can land on the
// wrong church.
```

### `src/views/RosterView.vue`

**`src/views/RosterView.vue:759-767`** — tags: CR-01 — qualifier: 104-REVIEW

_Summary:_ 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue -> authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or remount, so an onMounted-only subscribe never re-fires on switch.

```vue

// 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so an onMounted-only subscribe never re-fires on switch. Watching
// with `immediate: true` replaces the old onMounted-only subscribe (mirrors
// TeamView.vue 104-REVIEW CR-01). Always pass the LIVE new orgId the watcher
// hands in — never a mount-time captured value — so no write can land on the
// wrong church. Stop any prior seed watches first so a switch never leaks the
// old church's seed watchers.
```

### `src/views/RunControlView.vue`

**`src/views/RunControlView.vue:118-119`** — tags: WR-02 — qualifier: unqualified

_Summary:_ PARTIAL (WR-02): EXACTLY ONE output window opened; the other was refused.

```vue

    <!-- PARTIAL (WR-02): EXACTLY ONE output window opened; the other was refused. -->
```

**`src/views/RunControlView.vue:307-313`** — tags: WR-01 — qualifier: unqualified

_Summary:_ R276 (97-08/09): the ENTIRE Phase 92-96 control-core — the single-writer channel, navigation model, rail derivations, honest open state machine, WR-01 stale guard, 96-01 recovery, exit/teardown ordering, the timers, blac...

```vue

// R276 (97-08/09): the ENTIRE Phase 92-96 control-core — the single-writer
// channel, navigation model, rail derivations, honest open state machine, WR-01
// stale guard, 96-01 recovery, exit/teardown ordering, the timers, blackout,
// rehearse, pre-flight readiness, filmstrip/rail expansion, and the document
// keyboard handler — lives in useRunControl. This view is template + this
// destructure; the composable registers its own onMounted/onUnmounted lifecycle.
```

### `src/views/ServiceEditorView.vue`

**`src/views/ServiceEditorView.vue:587`** — tags: WR-04 — qualifier: unqualified

_Summary:_ `localService`. Keyed on `congregationalSlot.id` (WR-04,

```vue
             `localService`. Keyed on `congregationalSlot.id` (WR-04,
```

**`src/views/ServiceEditorView.vue:719`** — tags: WR-01 — qualifier: 81-REVIEW

_Summary:_ WR-01 (81-REVIEW): roving tabindex requires the companion

```vue
        <!-- WR-01 (81-REVIEW): roving tabindex requires the companion
```

**`src/views/ServiceEditorView.vue:1414-1415`** — tags: CR-01 — qualifier: unqualified

_Summary:_ Roles tab: seeded from the quarterly schedule for this service's date, editor-only data (CR-01/02/03/05)

```vue

        <!-- Roles tab: seeded from the quarterly schedule for this service's date, editor-only data (CR-01/02/03/05) -->
```

**`src/views/ServiceEditorView.vue:1422`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Non-editor: no roster/quarters data was ever subscribed to (Pitfall 4) — read-only note only

```vue
          <!-- Non-editor: no roster/quarters data was ever subscribed to (Pitfall 4) — read-only note only -->
```

**`src/views/ServiceEditorView.vue:1668`** — tags: Pitfall — qualifier: unqualified

_Summary:_ row now does that job directly (Anti-Patterns / Pitfall 4).

```vue
             row now does that job directly (Anti-Patterns / Pitfall 4). -->
```

**`src/views/ServiceEditorView.vue:1812-1821`** — tags: WR-01 — qualifier: 81-REVIEW

_Summary:_ WR-01 (81-REVIEW): roving tabindex on the tab bar (above) removes inactive tabs from the Tab key order per the WAI-ARIA APG Tabs pattern, which requires arrow-key navigation to compensate.

```vue

// WR-01 (81-REVIEW): roving tabindex on the tab bar (above) removes inactive
// tabs from the Tab key order per the WAI-ARIA APG Tabs pattern, which
// requires arrow-key navigation to compensate. Roles/Messages are
// conditionally rendered (authStore.isEditor / isMessagingEnabled()), so the
// order used for Arrow/Home/End navigation is recomputed from what is
// actually visible rather than a static list.
// Stage Layout (Phase 107, R313/R314): inserted right after Roles in both the
// rendered tab strip AND this navigation order — gated on the SAME
// `authStore.isEditor` check as Roles (tech/sound planning is an editor
```

**`src/views/ServiceEditorView.vue:1938-1942`** — tags: WR-01 — qualifier: 80-REVIEW

_Summary:_ WR-01 (80-REVIEW): deleteService's revocation steps are now best-effort, but the service-doc delete itself (the last step) is unguarded and can still throw.

```vue
// WR-01 (80-REVIEW): deleteService's revocation steps are now best-effort,
// but the service-doc delete itself (the last step) is unguarded and can
// still throw. Before this, onDelete had no catch — a failure closed the
// confirm dialog silently, looking like success while the service was NOT
// actually deleted.
```

**`src/views/ServiceEditorView.vue:2602-2610`** — tags: CR-01 — qualifier: unqualified

_Summary:_ CR-01 fix: do NOT restore a closure-captured pre-drag snapshot here.

```vue
    // CR-01 fix: do NOT restore a closure-captured pre-drag snapshot here.
    // SortableJS calls `onEnd` fire-and-forget (never awaited), so a second,
    // faster drag can start — and its write can succeed and persist — before
    // THIS drag's write settles. A stale pre-drag snapshot would then discard
    // that already-persisted second edit from local state, and because the
    // revert makes `localService` differ from `originalService` again, the
    // general 800ms debounce watcher would treat it as a new unsaved change
    // and silently re-write the stale array back over the successful edit.
    //
```

**`src/views/ServiceEditorView.vue:2614-2620`** — tags: CR-01 — qualifier: unqualified

_Summary:_ (today's simple case, unchanged). If a later drag/save already succeeded, `originalService` already reflects it (every successful write sets `originalService.value = clone(localService.value)`), so this revert becomes a...

```vue
    // (today's simple case, unchanged). If a later drag/save already
    // succeeded, `originalService` already reflects it (every successful
    // write sets `originalService.value = clone(localService.value)`), so
    // this revert becomes a no-op against that newer state instead of
    // clobbering it — and because local now matches original exactly, the
    // debounce watcher's `isDirty` check is false, so it never re-arms and
    // never re-persists the reverted array (T-29-09 / CR-01).
```

**`src/views/ServiceEditorView.vue:2729-2731`** — tags: WR-02 — qualifier: 82-REVIEW

_Summary:_ WR-02 (82-REVIEW): two-gate authStore.isAiEnabled, not the bare church setting alone -- so a super-admin-disabled org hides the action-bar AI item too.

```vue
    // WR-02 (82-REVIEW): two-gate authStore.isAiEnabled, not the bare
    // church setting alone -- so a super-admin-disabled org hides the
    // action-bar AI item too.
```

**`src/views/ServiceEditorView.vue:2834-2839`** — tags: CR-03 — qualifier: unqualified

_Summary:_ Declared before the watcher below (rather than down with the rest of the R037 transition state) because CR-03's `!editable` branch reads it — hoisting keeps that read after its own declaration rather than relying on the...

```vue

// Declared before the watcher below (rather than down with the rest of the
// R037 transition state) because CR-03's `!editable` branch reads it —
// hoisting keeps that read after its own declaration rather than relying on
// the (currently true, but fragile) fact that `status` can't be 'error' on
// the watcher's own `{ immediate: true }` first run.
```

**`src/views/ServiceEditorView.vue:2851-2859`** — tags: CR-03 — qualifier: 31-UI-SPEC

_Summary:_ CR-03: an outstanding 'error' means a real, unsaved edit is still sitting in localService — handleAutosaveFailure's "kept dirty" branch deliberately never reverts it, precisely so it can be retried.

```vue
      // CR-03: an outstanding 'error' means a real, unsaved edit is still
      // sitting in localService — handleAutosaveFailure's "kept dirty"
      // branch deliberately never reverts it, precisely so it can be
      // retried. Silently reporting 'idle' here would make that edit vanish
      // with zero on-screen trace the instant the service locks: the status
      // bar disappears along with `canEditService` regardless of what this
      // writes, so route the failure into `lifecycleError` instead — it is
      // NOT gated behind `canEditService` in the locked banner path
      // (31-UI-SPEC § 1) — rather than reporting a falsely-clean 'idle'.
```

**`src/views/ServiceEditorView.vue:2887-2893`** — tags: WR-01 — qualifier: unqualified

_Summary:_ ── Delivery-history subscription (60-03) ──────────────────────────────────── Subscribe to this service's messages (newest-first) when the panel is eligible — editor + messaging on.

```vue

// ── Delivery-history subscription (60-03) ────────────────────────────────────
// Subscribe to this service's messages (newest-first) when the panel is
// eligible — editor + messaging on. Re-subscribes on serviceId change or once
// isEditor resolves (WR-01-style late role flip). The store's single-listener
// guard makes repeat calls idempotent. Editor-only + nested-path reads run
// under the Phase 58 isOrgMember rules (no new client rule).
```

**`src/views/ServiceEditorView.vue:3031-3034`** — tags: CR-05, Pitfall — qualifier: unqualified

_Summary:_ Roles tab data (Pitfall 4 / T-17-04-01 / CR-05): /services/:id has no requiresEditor route guard, so a non-editor viewer can land here — the editor-only roles/quarters/people collections must never be subscribed to for a...

```vue
  // Roles tab data (Pitfall 4 / T-17-04-01 / CR-05): /services/:id has no
  // requiresEditor route guard, so a non-editor viewer can land here — the
  // editor-only roles/quarters/people collections must never be subscribed to
  // for a viewer (Phase 16.2 removal decision: no expanded viewer read access).
```

**`src/views/ServiceEditorView.vue:3063-3072`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: authStore.isEditor resolves asynchronously (loadOrgContext runs off the auth-state-changed flow, not synchronously at mount), and /services/:id has no requiresEditor guard forcing waitForRole() first.

```vue

// WR-01: authStore.isEditor resolves asynchronously (loadOrgContext runs off
// the auth-state-changed flow, not synchronously at mount), and /services/:id
// has no requiresEditor guard forcing waitForRole() first. If a real editor
// lands directly on this route before isEditor flips true, initStores() ran
// its one-time check with isEditor still false and never subscribed
// roster/quarters. Re-run initStores() when isEditor becomes true so the
// subscription retries once the role resolves; initStores()'s own
// `if (!rosterStore.orgId)` / `if (!quartersStore.orgId)` guards make this
// idempotent (no double-subscribe on repeated calls).
```

**`src/views/ServiceEditorView.vue:3082-3094`** — tags: WR-01 — qualifier: unqualified

_Summary:_ 260901-lua: /services/:id is keyed to a serviceId that belongs to the CURRENT (old) church.

```vue
// 260901-lua: /services/:id is keyed to a serviceId that belongs to the
// CURRENT (old) church. On the sidebar's in-place Switch Church, that same
// serviceId cannot exist in the newly-selected church, so staying would
// attempt a cross-org read/write. Fail safe by navigating away to /services
// on a genuine org CHANGE only. Deliberately no `{ immediate: true }`, so this
// never fires on first mount; the `if (oldOrgId)` guard also skips the
// initial null -> value org resolution (WR-01 late auth, when a user lands
// directly on this route before authStore.orgId resolves) — oldOrgId is
// null/undefined on that first callback. It fires ONLY when an
// already-established church changes to another value (or to null), i.e. a
// genuine switch away. Because we navigate away, this view unmounts and
// ServicesView's own orgId watcher subscribes the new church — no store
// re-point needed here.
```

**`src/views/ServiceEditorView.vue:3146-3153`** — tags: CR-03 — qualifier: 61-UI-SPEC

_Summary:_ lifecycleError is declared earlier (with the autosave watcher block) — see CR-03's comment there for why.

```vue
// lifecycleError is declared earlier (with the autosave watcher block) —
// see CR-03's comment there for why.

// ── R144 (61-04): first-lock auto-notification state ────────────────────────────
//
// The subordinate confirmation line inside the lock banner reads this. `null`
// renders nothing (messaging off, default off, or a re-lock — the SC2 neutral
// no-op). Discriminated by `kind` (61-UI-SPEC § Component #0).
```

**`src/views/ServiceEditorView.vue:3282-3284`** — tags: Pitfall — qualifier: 61-RESEARCH

_Summary:_ READ BEFORE WRITE: the snapshot's prior existence is the first-lock signal. Reading AFTER the setDoc would make every lock look like a re-lock (61-RESEARCH Pitfall 4).

```vue
        // READ BEFORE WRITE: the snapshot's prior existence is the first-lock
        // signal. Reading AFTER the setDoc would make every lock look like a
        // re-lock (61-RESEARCH Pitfall 4).
```

**`src/views/ServiceEditorView.vue:4120-4126`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Collect our songs (SONG + HYMN) and scriptures from service slots.

```vue

    // Collect our songs (SONG + HYMN) and scriptures from service slots.
    // IMPORTED slots (Phase 21) have no analogous PC item type and are
    // intentionally excluded from both buckets below — the 'existing plan'
    // branch below only ever touches songSlots/scriptureSlots (same as
    // PRAYER/MESSAGE), so IMPORTED is already skipped there without further
    // (slot as any) narrowing (RESEARCH Pitfall 2).
```

**`src/views/ServiceEditorView.vue:4370-4374`** — tags: Pitfall — qualifier: unqualified

_Summary:_ IMPORTED slots reference PPTX/image decks with no analogous PC item type; skip export entirely rather than falling through addSlotAsItem's default MESSAGE-item branch and mislabeling it (RESEARCH Pitfall 2) — no (slot as...

```vue
          // IMPORTED slots reference PPTX/image decks with no analogous PC item
          // type; skip export entirely rather than falling through
          // addSlotAsItem's default MESSAGE-item branch and mislabeling it
          // (RESEARCH Pitfall 2) — no (slot as any) narrowing needed here since
          // we skip before ever reaching the label-building catch block below.
```

**`src/views/ServiceEditorView.vue:4466-4470`** — tags: WR-01 — qualifier: 48-REVIEW

_Summary:_ WR-01 (48-REVIEW): re-entrancy guard — the action-bar button's own `disabled: ctx.isSharing` is the primary defense, but this backstop ensures a second concurrent invocation (e.g.

```vue
  // WR-01 (48-REVIEW): re-entrancy guard — the action-bar button's own
  // `disabled: ctx.isSharing` is the primary defense, but this backstop
  // ensures a second concurrent invocation (e.g. a rapid double-click before
  // the disabled state re-renders) can never fire a second createShareToken
  // write while one is already in flight.
```

**`src/views/ServiceEditorView.vue:4585-4593`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02: optimistic local update. `assignment.effectivePersonIds` is derived (via resolvedRoleAssignments) from localService.value, but without this it only reflects a write once it round-trips through serviceStore.service...

```vue

  // WR-02: optimistic local update. `assignment.effectivePersonIds` is derived
  // (via resolvedRoleAssignments) from localService.value, but without this it
  // only reflects a write once it round-trips through serviceStore.services.
  // Two rapid clicks on the same role's checkbox group (e.g. selecting two
  // different people) would otherwise both read the same stale
  // effectivePersonIds baseline, and the second write would silently clobber
  // the first. Mutating localService.value synchronously here means a
  // same-tick second click reads the just-applied state instead.
```

**`src/views/ServiceEditorView.vue:4686-4695`** — tags: WR-02 — qualifier: unqualified

_Summary:_ WR-02-style optimistic update, mirroring onToggleOverridePerson: mutate localService.value.messaging synchronously (so a same-tick second change reads the just-applied state), fire the scoped store write, and roll back o...

```vue

/**
 * WR-02-style optimistic update, mirroring onToggleOverridePerson: mutate
 * localService.value.messaging synchronously (so a same-tick second change
 * reads the just-applied state), fire the scoped store write, and roll back
 * on failure. `onSave`'s payload is a fixed field allowlist that does not
 * include `messaging` (same as `roleAssignmentOverrides`), so this optimistic
 * mutation cannot leak into a generic autosave write — only
 * setServiceMessagingDefaults' own scoped updateDoc ever persists it.
 */
```

**`src/views/ServiceEditorView.vue:4748-4751`** — tags: WR-01 — qualifier: 80-REVIEW

_Summary:_ WR-01 (80-REVIEW): mirrors TeamView.vue's onCancelInvite pattern — surface the failure and keep the confirm dialog open (do NOT close it here) so the user can see the error and retry, instead of the dialog silently closi...

```vue
    // WR-01 (80-REVIEW): mirrors TeamView.vue's onCancelInvite pattern —
    // surface the failure and keep the confirm dialog open (do NOT close it
    // here) so the user can see the error and retry, instead of the dialog
    // silently closing while the service was never actually deleted.
```

**`src/views/ServiceEditorView.vue:4806-4810`** — tags: CR-01, WR-01 — qualifier: unqualified

_Summary:_ CR-01: snapshot exactly what is about to be sent, so the "mark clean" step below (after the WR-01 slots sync-back, which is also compared against `normalizedSlots`, not the pre-normalization value) can tell a genuinely-c...

```vue
    // CR-01: snapshot exactly what is about to be sent, so the "mark clean"
    // step below (after the WR-01 slots sync-back, which is also compared
    // against `normalizedSlots`, not the pre-normalization value) can tell a
    // genuinely-concurrent edit — made to localService while this write is
    // in flight — from that intentional sync-back.
```

**`src/views/ServiceEditorView.vue:4813-4829`** — tags: CR-01, WR-01 — qualifier: unqualified

_Summary:_ WR-01: sync the just-persisted, normalized slot order back into localService so display and persisted state agree in ORDER, not only content — otherwise a legacy/corrupted document's first non-reorder save silently reord...

```vue

    // WR-01: sync the just-persisted, normalized slot order back into
    // localService so display and persisted state agree in ORDER, not only
    // content — otherwise a legacy/corrupted document's first non-reorder
    // save silently reorders what's persisted without updating what's
    // displayed (self-heals on the next remote snapshot, but is a real,
    // avoidable mismatch until then).
    //
    // Guarded by reference equality against `data.slots` (captured before
    // any `await` above, including the scheduledSongIds loop and the write
    // itself): if something else reassigned `localService.value.slots` to a
    // NEW array during those awaits — most plausibly a reorder drag racing
    // this save, the same failure class CR-01 closed — the reference no
    // longer matches, and we must NOT clobber that newer, more current
    // array with this stale, pre-await snapshot. Skip the sync-back in that
    // case; the existing remote-merge watcher already reconciles any
    // resulting order mismatch on the next Firestore snapshot.
```

**`src/views/ServiceEditorView.vue:4833-4844`** — tags: CR-01 — qualifier: unqualified

_Summary:_ Mark current local state as clean (don't overwrite localService — user may still be typing) — but ONLY if it still matches exactly what was just persisted above.

```vue

    // Mark current local state as clean (don't overwrite localService — user
    // may still be typing) — but ONLY if it still matches exactly what was
    // just persisted above. CR-01: a distinct mutation made to localService
    // while the write was in flight (e.g. a different field edited between
    // the snapshot above and this line resolving) must NOT be marked clean
    // against a payload that never included it — doing so silently and
    // permanently drops that edit, because the next debounce timer's own
    // `isDirty` re-check would then see nothing to save. Leaving
    // originalService untouched in that case keeps isDirty accurately true,
    // so the still-armed follow-up timer performs a real save carrying the
    // concurrent edit instead of a false-positive no-op.
```


### `src/views/ServicesView.vue`

**`src/views/ServicesView.vue:381-388`** — tags: CR-01 — qualifier: 104-REVIEW

_Summary:_ 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue -> authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or remount, so an onMounted-only subscribe never re-fires on switch and this vie...

```vue

// 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so an onMounted-only subscribe never re-fires on switch and this
// view sticks on "Loading services…" forever. Watching with `immediate: true`
// replaces the old onMounted-only subscribe (mirrors TeamView.vue 104-REVIEW
// CR-01). Always pass the LIVE new orgId the watcher hands in — never a
// mount-time captured value — so no write can land on the wrong church.
```

### `src/views/SettingsView.vue`

**`src/views/SettingsView.vue:37-38`** — tags: R-02 — qualifier: unqualified

_Summary:_ Share URL slug field (R-02, D-18)

```vue

        <!-- Share URL slug field (R-02, D-18) -->
```

**`src/views/SettingsView.vue:621-623`** — tags: R-02 — qualifier: unqualified

_Summary:_ ── Share URL slug state (R-02, D-18) ──────────────────────────────────────────

```vue

// ── Share URL slug state (R-02, D-18) ──────────────────────────────────────────
```

**`src/views/SettingsView.vue:806-809`** — tags: Pitfall — qualifier: unqualified

_Summary:_ Keep the local checkbox in sync if the store's org context finishes loading after this component mounts (org doc is not live-synced — Pitfall 2 — so this only reflects our own mirror-writes and the initial async loadOrgC...

```vue

// Keep the local checkbox in sync if the store's org context finishes loading
// after this component mounts (org doc is not live-synced — Pitfall 2 — so this
// only reflects our own mirror-writes and the initial async loadOrgContext read).
```

**`src/views/SettingsView.vue:900-904`** — tags: R-02 — qualifier: unqualified

_Summary:_ ── Save action (Share URL slug, R-02/D-18) ──────────────────────────────────── Uniqueness always goes through claimSlug's create-only orgSlugs claim — never a raw updateDoc of organizations/{orgId}.slug alone.

```vue

// ── Save action (Share URL slug, R-02/D-18) ────────────────────────────────────
// Uniqueness always goes through claimSlug's create-only orgSlugs claim — never a raw
// updateDoc of organizations/{orgId}.slug alone.
```

**`src/views/SettingsView.vue:1020-1024`** — tags: Pitfall — qualifier: unqualified

_Summary:_ ── Vertical Worship toggle action (D-15/D-16) ───────────────────────────────── Mirror-write template follows onSaveSlug: updateDoc the org doc, then immediately reassign the store ref (org doc is not live-synced — Pitfa...

```vue

// ── Vertical Worship toggle action (D-15/D-16) ─────────────────────────────────
// Mirror-write template follows onSaveSlug: updateDoc the org doc, then
// immediately reassign the store ref (org doc is not live-synced — Pitfall 2).
```

**`src/views/SettingsView.vue:1183-1188`** — tags: WR-03 — qualifier: 46-REVIEW.md

_Summary:_ WR-03 (46-REVIEW.md): a genuinely failed dynamic import here would otherwise surface as an unhandled promise rejection on every affected family switch.

```vue
  // WR-03 (46-REVIEW.md): a genuinely failed dynamic import here would
  // otherwise surface as an unhandled promise rejection on every affected
  // family switch. Not user-visible either way — the preview box's native
  // CSS-stack fallback already covers a failed/missing asset — but every
  // other async handler in this file is careful to swallow non-fatal
  // failures rather than leave one loose.
```

**`src/views/SettingsView.vue:1266-1270`** — tags: Pitfall — qualifier: 58-RESEARCH.md

_Summary:_ reminderDaysBefore MUST persist as a number — `v-model.number` already coerces the local ref, but the write itself re-wraps in Number(...) so a revert-on-error restores a real numeric prior value, never a stringified one...

```vue

// reminderDaysBefore MUST persist as a number — `v-model.number` already coerces
// the local ref, but the write itself re-wraps in Number(...) so a revert-on-error
// restores a real numeric prior value, never a stringified one (58-RESEARCH.md
// Pitfall 5).
```

### `src/views/SongsView.vue`

**`src/views/SongsView.vue:352-359`** — tags: CR-01 — qualifier: 104-REVIEW

_Summary:_ 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue -> authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or remount, so an onMounted-only subscribe never re-fires on switch.

```vue

// 260901-lua: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so an onMounted-only subscribe never re-fires on switch. Watching
// with `immediate: true` replaces the old onMounted-only subscribe (mirrors
// TeamView.vue 104-REVIEW CR-01). Always pass the LIVE new orgId the watcher
// hands in — never a mount-time captured value — so no write can land on the
// wrong church.
```

**`src/views/SongsView.vue:413-419`** — tags: WR-01 — qualifier: unqualified

_Summary:_ Clear query param without navigation. WR-01: AWAITED — `route.query` does not update until this navigation resolves, so if a song-edit request is ALSO present in the query, resolveSongEditRequest()'s own synchronous clea...

```vue
    // Clear query param without navigation. WR-01: AWAITED — `route.query`
    // does not update until this navigation resolves, so if a song-edit
    // request is ALSO present in the query, resolveSongEditRequest()'s own
    // synchronous clearSongEditQueryParam() call below must not read a
    // pre-clear route.query snapshot and race this replace (whichever one's
    // navigation resolved last would otherwise win, silently dropping the
    // other's clear).
```

### `src/views/TeamView.vue`

**`src/views/TeamView.vue:520-528`** — tags: CR-01 — qualifier: 104-REVIEW

_Summary:_ 104-REVIEW CR-01: the sidebar's in-place church switcher (AppSidebar.vue -> authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or remount, so this view's own onSnapshot listeners — not covered by reset...

```vue

// 104-REVIEW CR-01: the sidebar's in-place church switcher (AppSidebar.vue ->
// authStore.selectOrg()) changes authStore.orgId WITHOUT a route change or
// remount, so this view's own onSnapshot listeners — not covered by
// resetOrgScopedStores(), which only knows about the Pinia store layer — must
// react to the org id themselves instead of reading it once. Watching with
// `immediate: true` replaces the old onMounted-only subscribe and guarantees a
// switch tears down the previous church's listeners before pointing new ones
// at the newly-selected church.
```

### `src/views/serviceEditorActionBar.ts`

**`src/views/serviceEditorActionBar.ts:72-78`** — tags: WR-01 — qualifier: 39-REVIEW

_Summary:_ Org-level AI features toggle (WR-01, 39-REVIEW). Required (not optional) so the compiler forces every call site to supply it — an `undefined` here would silently show "Suggest All Songs" with AI off, the one AI entry poi...

```ts
  /**
   * Org-level AI features toggle (WR-01, 39-REVIEW). Required (not
   * optional) so the compiler forces every call site to supply it — an
   * `undefined` here would silently show "Suggest All Songs" with AI off,
   * the one AI entry point that was missed by 39-05's hide-don't-disable
   * pass. Follows the same threading pattern as `pcEnabled` below.
   */
```

**`src/views/serviceEditorActionBar.ts:187-194`** — tags: Pitfall — qualifier: unqualified

_Summary:_ R101 (48-03): Print, relocated verbatim from the page-bottom button (ServiceEditorView.vue:1303-1314) — unconditional, same as the button it replaces (no editor gate on Print today).

```ts

/**
 * R101 (48-03): Print, relocated verbatim from the page-bottom button
 * (ServiceEditorView.vue:1303-1314) — unconditional, same as the button it
 * replaces (no editor gate on Print today). testId is preserved so the
 * `print-btn` selector keeps working once the bottom button is deleted
 * (Pitfall 3 / Anti-Patterns: exactly one print-btn must exist).
 */
```

**`src/views/serviceEditorActionBar.ts:219-223`** — tags: WR-01 — qualifier: 48-REVIEW

_Summary:_ WR-01 (48-REVIEW): the pre-migration bottom-row button was `:disabled="!localService || isSharing"` — the `!localService` half is moot here (the whole action bar only mounts once localService is truthy), but `isSharing`...

```ts
    // WR-01 (48-REVIEW): the pre-migration bottom-row button was
    // `:disabled="!localService || isSharing"` — the `!localService` half is
    // moot here (the whole action bar only mounts once localService is
    // truthy), but `isSharing` must be preserved so a double-click can't fire
    // concurrent createShareToken writes while a share is in flight.
```

**`src/views/serviceEditorActionBar.ts:233-243`** — tags: WR-01 — qualifier: 59-UI-SPEC.md

_Summary:_ HIDE-ON-FAIL when messaging is off (owner UAT, 2026-08-17): "The messages button ... shows up even if Messaging setting is turned off.

```ts
 *
 * HIDE-ON-FAIL when messaging is off (owner UAT, 2026-08-17): "The messages
 * button ... shows up even if Messaging setting is turned off. It should be
 * hidden if message setting is turned off." This REVERSES 59-04's deliberate
 * disabled+tooltip-for-discoverability choice (59-UI-SPEC.md #0). The item now
 * returns `undefined` when `!ctx.messagingEnabled`, matching `buildShareItem`
 * and the WR-01 AI "hide-don't-disable" rule. The server kill-switch re-check
 * in `queueServiceMessage` (59-02) remains the real boundary; this UI gate is
 * convenience. Do NOT "restore" the disabled+tooltip form — the owner asked
 * for the opposite.
 */
```

**`src/views/serviceEditorActionBar.ts:256-259`** — tags: WR-01 — qualifier: unqualified

_Summary:_ WR-01: "Suggest All Songs" is a live AI entry point (calls getSongSuggestions for every SONG slot) and must be hidden — not disabled — when the org has turned AI off, per the UI-SPEC's Hide-Don't-Disable Contract.

```ts
  // WR-01: "Suggest All Songs" is a live AI entry point (calls
  // getSongSuggestions for every SONG slot) and must be hidden — not
  // disabled — when the org has turned AI off, per the UI-SPEC's
  // Hide-Don't-Disable Contract.
```

_Bucket A total: 382 entries._

### Tag Collision Index (bare tag ids appearing in more than one file)

For each bare tag id below, every file:line occurrence and its qualifier. Occurrences that share BOTH the bare tag AND the same qualifying doc are the same underlying decision (a genuine ADR-sharing candidate for 108-02); occurrences with a different qualifier, or no qualifier at all, are almost certainly unrelated decisions that merely reused a short label — treat each as its own ADR unless 108-02's own reading of the verbatim text says otherwise.

**`CR-01`** (48 occurrences across 26 files):
- `src/components/GettingStarted.vue:119` — 104-REVIEW
- `src/components/admin/CleanupEnableConfirmDialog.vue:190` — 71-UI-SPEC.md
- `src/components/slides/EditSlideDrawer.vue:1269` — unqualified
- `src/composables/useAutoSave.ts:86` — unqualified
- `src/composables/useAutoSave.ts:159` — unqualified
- `src/composables/useSlideshowAssembly.ts:725` — 38-REVIEW
- `src/stores/auth.ts:468` — 46-REVIEW.md, 46-UI-SPEC.md
- `src/stores/quarters.ts:437` — unqualified
- `src/stores/services.ts:650` — 80-REVIEW
- `src/stores/services.ts:898` — 80-REVIEW
- `src/stores/slideGroups.ts:89` — unqualified
- `src/stores/slideGroups.ts:284` — 26-REVIEW, 38-REVIEW
- `src/utils/importedRenderReconciler.ts:146` — 42-REVIEW.md
- `src/utils/importedRenderReconciler.ts:166` — unqualified
- `src/utils/planningCenterApi.ts:993` — 102-REVIEW
- `src/utils/slideGroupMaterializer.ts:577` — unqualified
- `src/utils/slideGroupMaterializer.ts:769` — 38-REVIEW
- `src/utils/slideGroupMaterializer.ts:912` — 38-REVIEW
- `src/utils/slideshowAssembler.ts:456` — 105-UI-SPEC.md
- `src/views/DashboardView.vue:275` — 104-REVIEW
- `src/views/QuarterView.vue:844` — 104-REVIEW
- `src/views/RosterView.vue:759` — 104-REVIEW
- `src/views/ServiceEditorView.vue:1414` — unqualified
- `src/views/ServiceEditorView.vue:2602` — unqualified
- `src/views/ServiceEditorView.vue:2614` — unqualified
- `src/views/ServiceEditorView.vue:4806` — unqualified
- `src/views/ServiceEditorView.vue:4813` — unqualified
- `src/views/ServiceEditorView.vue:4833` — unqualified
- `src/views/ServicesView.vue:381` — 104-REVIEW
- `src/views/SongsView.vue:352` — 104-REVIEW
- `src/views/TeamView.vue:520` — 104-REVIEW
- `functions/src/index.ts:656` — 82-REVIEW
- `functions/src/index.ts:3012` — 85-REVIEW.md
- `functions/src/inviteOnboarding.ts:202` — 99-REVIEW
- `functions/src/orgMembershipClaims.ts:150` — 76-REVIEW.md
- `functions/src/orgMembershipClaims.ts:342` — 76-REVIEW.md
- `functions/src/orgMembershipClaims.ts:375` — 76-REVIEW.md
- `functions/src/orgMembershipClaims.ts:419` — unqualified
- `functions/src/orgMembershipClaims.ts:425` — unqualified
- `functions/src/orgMembershipClaims.ts:440` — 73-RESEARCH.md, 73-REVIEW.md
- `functions/src/orgProvisioning.ts:375` — 76-REVIEW.md
- `functions/src/serviceRoles.ts:52` — 85-REVIEW.md
- `firestore.rules:195` — unqualified
- `firestore.rules:259` — unqualified
- `firestore.rules:535` — 41-REVIEW
- `firestore.rules:547` — unqualified
- `firestore.rules:560` — unqualified
- `firestore.rules:610` — unqualified

**`CR-02`** (14 occurrences across 7 files):
- `src/components/PresentationViewer.vue:414` — 46-REVIEW.md
- `src/components/slides/EditSlideDrawer.vue:1189` — 25-REVIEW, 26-RESEARCH.md
- `src/components/slides/SlideGrid.vue:767` — unqualified
- `src/components/slides/SlideGrid.vue:841` — unqualified
- `src/components/slides/SlideGrid.vue:920` — unqualified
- `src/components/slides/SlideGrid.vue:941` — unqualified
- `src/components/slides/SlideGrid.vue:1179` — unqualified
- `src/composables/useAutoSave.ts:133` — unqualified
- `src/composables/useSlideshowAssembly.ts:784` — unqualified
- `src/stores/services.ts:502` — 84-REVIEW
- `src/stores/services.ts:554` — 84-REVIEW
- `src/stores/slideGroups.ts:261` — unqualified
- `src/stores/slideGroups.ts:284` — 26-REVIEW, 38-REVIEW
- `src/stores/slideGroups.ts:355` — unqualified

**`Pitfall`** (109 occurrences across 51 files):
- `src/components/SongLyricEditor.vue:643` — unqualified
- `src/components/admin/AiProxyConfigCard.vue:71` — unqualified
- `src/components/admin/AiProxyConfigCard.vue:121` — unqualified
- `src/components/admin/DeleteOrgConfirmDialog.vue:138` — 77-RESEARCH.md
- `src/components/admin/OrganizationsTab.vue:606` — 76-RESEARCH.md, 76-REVIEW.md
- `src/components/settings/ServiceTemplateEditor.vue:3` — 26-RESEARCH.md
- `src/components/settings/ServiceTemplateEditor.vue:322` — unqualified
- `src/components/slides/EditSlideDrawer.vue:5` — 26-RESEARCH.md, 26-UI-SPEC.md
- `src/components/slides/EditSlideDrawer.vue:309` — 26-RESEARCH.md
- `src/components/slides/EditSlideDrawer.vue:503` — 26-RESEARCH.md
- `src/components/slides/EditSlideDrawer.vue:778` — unqualified
- `src/components/slides/EditSlideDrawer.vue:928` — 26-RESEARCH.md
- `src/components/slides/EditSlideDrawer.vue:1189` — 25-REVIEW, 26-RESEARCH.md
- `src/components/slides/SlideCanvas.vue:299` — unqualified
- `src/components/slides/SlideGrid.vue:357` — 25-RESEARCH.md
- `src/components/slides/SlidesTab.vue:79` — 25-RESEARCH.md, 26-RESEARCH.md
- `src/components/slides/SlidesTab.vue:250` — unqualified
- `src/components/slides/SlidesTab.vue:351` — 26-RESEARCH.md
- `src/composables/useOutputWindow.ts:102` — unqualified
- `src/composables/useOutputWindow.ts:129` — unqualified
- `src/composables/useRunControl.ts:773` — unqualified
- `src/composables/useRunControl.ts:809` — unqualified
- `src/composables/useSlideshowAssembly.ts:289` — 42-RESEARCH.md
- `src/config/appConfigDefaults.ts:2` — 70-RESEARCH.md
- `src/main.ts:2` — 46-RESEARCH.md
- `src/router/index.ts:229` — 68-REVIEW.md
- `src/stores/auth.ts:106` — unqualified
- `src/stores/auth.ts:121` — 82-RESEARCH.md
- `src/stores/auth.ts:164` — unqualified
- `src/stores/auth.ts:340` — unqualified
- `src/stores/quarters.ts:170` — unqualified
- `src/stores/quarters.ts:406` — unqualified
- `src/stores/roster.ts:70` — unqualified
- `src/stores/teams.ts:51` — unqualified
- `src/types/organization.ts:187` — 82-RESEARCH.md
- `src/types/roster.ts:22` — unqualified
- `src/types/team.ts:20` — unqualified
- `src/utils/claudeApi.ts:487` — unqualified
- `src/utils/claudeApi.ts:580` — unqualified
- `src/utils/importedRenderReconciler.ts:14` — 42-RESEARCH.md
- `src/utils/importedRenderReconciler.ts:49` — unqualified
- `src/utils/monitorConfig.ts:7` — 91-REVIEW.md
- `src/utils/planningCenterApi.ts:1105` — unqualified
- `src/utils/planningCenterApi.ts:1116` — unqualified
- `src/utils/planningCenterApi.ts:1182` — unqualified
- `src/utils/planningCenterApi.ts:1271` — unqualified
- `src/utils/scheduler.ts:55` — unqualified
- `src/utils/scheduler.ts:78` — unqualified
- `src/utils/scheduler.ts:96` — unqualified
- `src/utils/scheduler.ts:212` — unqualified
- `src/utils/scheduler.ts:236` — unqualified
- `src/utils/scheduler.ts:247` — unqualified
- `src/utils/scheduler.ts:255` — unqualified
- `src/utils/scriptureBoundaries.ts:17` — unqualified
- `src/utils/scriptureBoundaries.ts:33` — unqualified
- `src/utils/slideGroupMaterializer.ts:142` — 42-RESEARCH.md
- `src/utils/slideGroupMaterializer.ts:577` — unqualified
- `src/utils/slideGroupMaterializer.ts:735` — unqualified
- `src/utils/slideshowAssembler.ts:333` — 33-RESEARCH.md, 33-UI-SPEC.md
- `src/utils/slideshowAssembler.ts:429` — unqualified
- `src/utils/slotTypes.ts:372` — 44-RESEARCH.md
- `src/utils/songEditLink.ts:5` — 26-RESEARCH.md
- `src/utils/songSectionOrder.ts:120` — unqualified
- `src/utils/volunteerCsv.ts:139` — unqualified
- `src/views/AudienceOutputView.vue:38` — unqualified
- `src/views/ConfidenceOutputView.vue:78` — unqualified
- `src/views/MonitorSetupView.vue:341` — unqualified
- `src/views/MonitorSetupView.vue:411` — unqualified
- `src/views/MonitorSetupView.vue:423` — unqualified
- `src/views/MonitorSetupView.vue:466` — unqualified
- `src/views/OwnerConsoleView.vue:90` — unqualified
- `src/views/ServiceEditorView.vue:1422` — unqualified
- `src/views/ServiceEditorView.vue:1668` — unqualified
- `src/views/ServiceEditorView.vue:3031` — unqualified
- `src/views/ServiceEditorView.vue:3282` — 61-RESEARCH
- `src/views/ServiceEditorView.vue:4120` — unqualified
- `src/views/ServiceEditorView.vue:4370` — unqualified
- `src/views/SettingsView.vue:806` — unqualified
- `src/views/SettingsView.vue:1020` — unqualified
- `src/views/SettingsView.vue:1266` — 58-RESEARCH.md
- `src/views/serviceEditorActionBar.ts:187` — unqualified
- `functions/src/bootstrapSuperAdmin.ts:16` — unqualified
- `functions/src/claimsHelpers.ts:100` — 76-RESEARCH.md
- `functions/src/index.ts:91` — 45-RESEARCH.md
- `functions/src/index.ts:850` — 21-RESEARCH.md
- `functions/src/index.ts:2067` — unqualified
- `functions/src/index.ts:2192` — unqualified
- `functions/src/index.ts:2777` — 59-RESEARCH.md
- `functions/src/index.ts:2810` — 59-RESEARCH.md
- `functions/src/index.ts:2975` — unqualified
- `functions/src/inviteOnboarding.ts:32` — unqualified
- `functions/src/inviteOnboarding.ts:66` — 99-RESEARCH.md
- `functions/src/inviteOnboarding.ts:257` — unqualified
- `functions/src/orgDeletion.ts:14` — 77-RESEARCH.md
- `functions/src/orgDeletion.ts:138` — unqualified
- `functions/src/orgDeletion.ts:187` — 77-RESEARCH.md
- `functions/src/orgMembershipClaims.ts:440` — 73-RESEARCH.md, 73-REVIEW.md
- `functions/src/orgProvisioning.ts:117` — unqualified
- `functions/src/orgProvisioning.ts:509` — 76-RESEARCH.md, 76-REVIEW.md
- `functions/src/orgProvisioning.ts:532` — 76-RESEARCH.md, 76-REVIEW.md
- `functions/src/orgProvisioning.ts:662` — 82-RESEARCH.md
- `functions/src/pptxParser.ts:44` — 21-RESEARCH.md
- `functions/src/pptxParser.ts:216` — 21-RESEARCH.md
- `functions/src/pptxParser.ts:251` — 21-RESEARCH.md
- `render-service/src/render.ts:110` — 37-RESEARCH.md
- `render-service/src/render.ts:119` — 37-RESEARCH.md
- `firestore.rules:112` — 82-RESEARCH.md
- `firestore.rules:156` — 80-RESEARCH.md
- `firestore.rules:219` — 77-RESEARCH.md

**`R-02`** (7 occurrences across 5 files):
- `src/stores/auth.ts:92` — unqualified
- `src/stores/quarters.ts:406` — unqualified
- `src/stores/services.ts:878` — unqualified
- `src/views/QuarterView.vue:784` — unqualified
- `src/views/SettingsView.vue:37` — unqualified
- `src/views/SettingsView.vue:621` — unqualified
- `src/views/SettingsView.vue:900` — unqualified

**`WR-01`** (86 occurrences across 39 files):
- `src/components/AudioPlayer.vue:96` — unqualified
- `src/components/RoleSlideOver.vue:223` — unqualified
- `src/components/ScriptureInput.vue:136` — 103-REVIEW
- `src/components/ScriptureSlideEditor.vue:137` — 102-REVIEW
- `src/components/SongLyricEditor.vue:480` — unqualified
- `src/components/SongLyricEditor.vue:599` — unqualified
- `src/components/SongLyricEditor.vue:706` — unqualified
- `src/components/SongLyricEditor.vue:829` — unqualified
- `src/components/SongLyricEditor.vue:846` — unqualified
- `src/components/SongSlotPicker.vue:303` — unqualified
- `src/components/TeamSlideOver.vue:275` — unqualified
- `src/components/TeamSlideOver.vue:289` — unqualified
- `src/components/ToastHost.vue:45` — 104-REVIEW
- `src/components/VideoPlayer.vue:76` — unqualified
- `src/components/admin/AiProxyConfigCard.vue:141` — unqualified
- `src/components/admin/CleanupEnableConfirmDialog.vue:166` — 71-UI-SPEC.md
- `src/components/admin/OrganizationsTab.vue:362` — 76-REVIEW.md
- `src/components/admin/OrganizationsTab.vue:606` — 76-RESEARCH.md, 76-REVIEW.md
- `src/components/run/RunHeader.vue:45` — unqualified
- `src/components/slides/EditSlideDrawer.vue:281` — 25-REVIEW
- `src/components/slides/SlideGrid.vue:661` — unqualified
- `src/components/slides/SlideGrid.vue:699` — unqualified
- `src/composables/useRunControl.ts:5` — unqualified
- `src/composables/useRunControl.ts:280` — unqualified
- `src/composables/useRunControl.ts:419` — unqualified
- `src/composables/useRunControl.ts:439` — unqualified
- `src/composables/useRunControl.ts:457` — unqualified
- `src/composables/useRunControl.ts:554` — unqualified
- `src/composables/useRunControl.ts:783` — unqualified
- `src/composables/useRunControl.ts:809` — unqualified
- `src/composables/useRunControl.ts:812` — unqualified
- `src/composables/useRunControl.ts:908` — unqualified
- `src/composables/useRunControl.ts:1196` — 106-REVIEW
- `src/composables/useRunControl.ts:1278` — unqualified
- `src/composables/useSlideshowAssembly.ts:339` — 42-REVIEW.md
- `src/stores/auth.ts:360` — 78-REVIEW.md
- `src/stores/auth.ts:426` — 46-REVIEW.md
- `src/stores/saveStatus.ts:11` — 32-REVIEW, 32-UI-SPEC
- `src/stores/services.ts:419` — 84-REVIEW
- `src/stores/services.ts:602` — 80-REVIEW
- `src/stores/slideGroups.ts:89` — unqualified
- `src/stores/slideGroups.ts:155` — unqualified
- `src/stores/slideGroups.ts:214` — unqualified
- `src/utils/scriptureBoundaries.ts:131` — 47-REVIEW
- `src/utils/scriptureBoundaries.ts:154` — 47-REVIEW
- `src/utils/slideshowAssembler.ts:184` — unqualified
- `src/utils/slideshowAssembler.ts:314` — unqualified
- `src/utils/slideshowAssembler.ts:429` — unqualified
- `src/utils/songSectionOrder.ts:31` — unqualified
- `src/utils/songSectionOrder.ts:82` — unqualified
- `src/views/OwnerConsoleView.vue:13` — 81-REVIEW
- `src/views/OwnerConsoleView.vue:113` — 81-REVIEW
- `src/views/RunControlView.vue:307` — unqualified
- `src/views/ServiceEditorView.vue:719` — 81-REVIEW
- `src/views/ServiceEditorView.vue:1812` — 81-REVIEW
- `src/views/ServiceEditorView.vue:1938` — 80-REVIEW
- `src/views/ServiceEditorView.vue:2887` — unqualified
- `src/views/ServiceEditorView.vue:3063` — unqualified
- `src/views/ServiceEditorView.vue:3082` — unqualified
- `src/views/ServiceEditorView.vue:4466` — 48-REVIEW
- `src/views/ServiceEditorView.vue:4748` — 80-REVIEW
- `src/views/ServiceEditorView.vue:4806` — unqualified
- `src/views/ServiceEditorView.vue:4813` — unqualified
- `src/views/SongsView.vue:413` — unqualified
- `src/views/serviceEditorActionBar.ts:72` — 39-REVIEW
- `src/views/serviceEditorActionBar.ts:219` — 48-REVIEW
- `src/views/serviceEditorActionBar.ts:233` — 59-UI-SPEC.md
- `src/views/serviceEditorActionBar.ts:256` — unqualified
- `functions/src/appConfig.ts:111` — unqualified
- `functions/src/backfillOrgClaims.ts:211` — unqualified
- `functions/src/claimsHelpers.ts:74` — 73-REVIEW.md
- `functions/src/index.ts:201` — unqualified
- `functions/src/index.ts:483` — 67-REVIEW.md
- `functions/src/index.ts:514` — 67-REVIEW.md
- `functions/src/index.ts:678` — unqualified
- `functions/src/inviteOnboarding.ts:78` — 99-REVIEW
- `functions/src/orgDeletion.ts:214` — 77-REVIEW.md
- `functions/src/orgMembershipClaims.ts:200` — unqualified
- `functions/src/orgMembershipClaims.ts:276` — unqualified
- `functions/src/orgMembershipClaims.ts:409` — unqualified
- `functions/src/orgMembershipClaims.ts:440` — 73-RESEARCH.md, 73-REVIEW.md
- `functions/src/orgProvisioning.ts:171` — unqualified
- `functions/src/orgProvisioning.ts:391` — unqualified
- `functions/src/superAdminClaims.ts:134` — 68-REVIEW.md
- `firestore.rules:133` — 82-REVIEW
- `firestore.rules:587` — unqualified

**`WR-02`** (82 occurrences across 39 files):
- `src/components/AppSidebar.vue:286` — 104-REVIEW
- `src/components/CongregationalEditor.vue:295` — 102-REVIEW
- `src/components/CongregationalEditor.vue:348` — 103-REVIEW
- `src/components/CongregationalEditor.vue:373` — 103-REVIEW
- `src/components/ScriptureInput.vue:3` — 82-REVIEW
- `src/components/ScriptureInput.vue:452` — 102-REVIEW
- `src/components/ScriptureInput.vue:549` — 102-REVIEW
- `src/components/SongLyricEditor.vue:523` — unqualified
- `src/components/SongLyricEditor.vue:628` — unqualified
- `src/components/SongSlotPicker.vue:56` — 82-REVIEW
- `src/components/TeamSlideOver.vue:78` — unqualified
- `src/components/TeamSlideOver.vue:295` — unqualified
- `src/components/admin/ConfigNumberField.vue:94` — unqualified
- `src/components/admin/DeleteOrgConfirmDialog.vue:138` — 77-RESEARCH.md
- `src/components/admin/OrganizationsTab.vue:779` — 78-REVIEW.md
- `src/components/slides/SlideCanvas.vue:379` — unqualified
- `src/components/slides/SlideCanvas.vue:388` — unqualified
- `src/components/slides/SlideGrid.vue:635` — unqualified
- `src/components/slides/SlidesTab.vue:79` — 25-RESEARCH.md, 26-RESEARCH.md
- `src/composables/useOutputWindow.ts:1` — unqualified
- `src/composables/useOutputWindow.ts:58` — unqualified
- `src/composables/useOutputWindow.ts:226` — unqualified
- `src/composables/useRunControl.ts:83` — unqualified
- `src/composables/useRunControl.ts:280` — unqualified
- `src/composables/useRunControl.ts:363` — unqualified
- `src/composables/useRunControl.ts:694` — unqualified
- `src/composables/useRunControl.ts:723` — unqualified
- `src/composables/useRunControl.ts:747` — unqualified
- `src/composables/useRunControl.ts:968` — 106-REVIEW
- `src/composables/useServiceAssembly.ts:2` — unqualified
- `src/composables/useServiceAssembly.ts:62` — unqualified
- `src/composables/useServiceAssembly.ts:65` — 93-REVIEW
- `src/composables/useSlideshowAssembly.ts:82` — 42-REVIEW.md
- `src/composables/useSlideshowAssembly.ts:189` — unqualified
- `src/composables/useSlideshowAssembly.ts:858` — unqualified
- `src/composables/useSlideshowAssembly.ts:870` — 42-REVIEW.md
- `src/stores/auth.ts:175` — 82-REVIEW
- `src/stores/services.ts:1069` — 41-REVIEW
- `src/types/slide.ts:244` — unqualified
- `src/types/slideGroup.ts:11` — unqualified
- `src/utils/planningCenterApi.ts:993` — 102-REVIEW
- `src/utils/scheduler.ts:117` — unqualified
- `src/utils/slideGroupMaterializer.ts:7` — unqualified
- `src/utils/slideTypography.ts:123` — 46-REVIEW.md
- `src/utils/slideshowAssembler.ts:12` — unqualified
- `src/utils/slideshowAssembler.ts:421` — unqualified
- `src/utils/slideshowAssembler.ts:446` — unqualified
- `src/utils/slideshowAssembler.ts:486` — unqualified
- `src/utils/slideshowAssembler.ts:519` — unqualified
- `src/views/AudienceOutputView.vue:96` — unqualified
- `src/views/ConfidenceOutputView.vue:136` — unqualified
- `src/views/MonitorSetupView.vue:83` — unqualified
- `src/views/MonitorSetupView.vue:186` — unqualified
- `src/views/MonitorSetupView.vue:232` — unqualified
- `src/views/MonitorSetupView.vue:237` — unqualified
- `src/views/MonitorSetupView.vue:288` — unqualified
- `src/views/MonitorSetupView.vue:318` — unqualified
- `src/views/MonitorSetupView.vue:349` — unqualified
- `src/views/MonitorSetupView.vue:360` — unqualified
- `src/views/MonitorSetupView.vue:382` — unqualified
- `src/views/MonitorSetupView.vue:449` — unqualified
- `src/views/RunControlView.vue:118` — unqualified
- `src/views/ServiceEditorView.vue:2729` — 82-REVIEW
- `src/views/ServiceEditorView.vue:4585` — unqualified
- `src/views/ServiceEditorView.vue:4686` — unqualified
- `functions/src/backfillLastUsed.ts:145` — 84-REVIEW
- `functions/src/backfillLastUsed.ts:176` — 84-REVIEW
- `functions/src/backfillOrgClaims.ts:237` — 73-REVIEW.md
- `functions/src/backfillOrgClaims.ts:264` — unqualified
- `functions/src/bootstrapSuperAdmin.ts:103` — unqualified
- `functions/src/claimsHelpers.ts:17` — 68-REVIEW.md
- `functions/src/claimsHelpers.ts:136` — 73-REVIEW.md
- `functions/src/index.ts:232` — unqualified
- `functions/src/index.ts:3093` — 67-REVIEW.md
- `functions/src/inviteOnboarding.ts:285` — 99-REVIEW
- `functions/src/orgDeletion.ts:121` — 77-RESEARCH.md, 77-REVIEW.md
- `functions/src/orgMembershipClaims.ts:487` — 73-REVIEW.md
- `functions/src/orgProvisioning.ts:68` — unqualified
- `functions/src/orgProvisioning.ts:509` — 76-RESEARCH.md, 76-REVIEW.md
- `functions/src/orgProvisioning.ts:526` — unqualified
- `functions/src/orgProvisioning.ts:532` — 76-RESEARCH.md, 76-REVIEW.md
- `functions/src/orgProvisioning.ts:606` — unqualified

**`WR-03`** (30 occurrences across 18 files):
- `src/components/AppSidebar.vue:240` — 104-REVIEW
- `src/components/PresentationViewer.vue:250` — unqualified
- `src/components/SongBrowser.vue:74` — 81-REVIEW
- `src/components/admin/OrganizationsTab.vue:489` — unqualified
- `src/components/admin/OrganizationsTab.vue:545` — unqualified
- `src/components/admin/OrganizationsTab.vue:593` — unqualified
- `src/components/admin/OrganizationsTab.vue:791` — 78-REVIEW.md
- `src/components/admin/OrganizationsTab.vue:802` — 78-REVIEW.md
- `src/components/slides/SlideActionMenu.vue:83` — unqualified
- `src/components/slides/SlideCard.vue:104` — 48-REVIEW
- `src/router/index.ts:229` — 68-REVIEW.md
- `src/stores/auth.ts:268` — 68-REVIEW.md
- `src/stores/auth.ts:468` — 46-REVIEW.md, 46-UI-SPEC.md
- `src/stores/auth.ts:710` — 78-REVIEW.md
- `src/stores/saveStatus.ts:33` — 32-REVIEW, 32-UI-SPEC
- `src/stores/services.ts:287` — 41-REVIEW
- `src/stores/services.ts:670` — 41-REVIEW
- `src/utils/claudeApi.ts:51` — 39-REVIEW
- `src/utils/claudeApi.ts:244` — 39-REVIEW
- `src/utils/claudeApi.ts:368` — 39-REVIEW
- `src/utils/claudeApi.ts:602` — 39-REVIEW
- `src/utils/lastUsed.ts:58` — 84-REVIEW
- `src/utils/volunteerCsv.ts:52` — unqualified
- `src/utils/volunteerCsv.ts:111` — unqualified
- `src/views/MonitorSetupView.vue:199` — unqualified
- `src/views/MonitorSetupView.vue:429` — unqualified
- `src/views/SettingsView.vue:1183` — 46-REVIEW.md
- `functions/src/backfillLastUsed.ts:79` — 84-REVIEW
- `functions/src/index.ts:299` — unqualified
- `functions/src/orgMembershipClaims.ts:375` — 76-REVIEW.md

**`WR-04`** (16 occurrences across 10 files):
- `src/components/AvailabilityDrawer.vue:399` — unqualified
- `src/components/AvailabilityDrawer.vue:437` — unqualified
- `src/components/CongregationalEditor.vue:162` — unqualified
- `src/components/PresentationViewer.vue:220` — unqualified
- `src/components/ScriptureSlideEditor.vue:256` — 32-REVIEW
- `src/components/slides/EditSlideDrawer.vue:638` — unqualified
- `src/components/slides/EditSlideDrawer.vue:1518` — unqualified
- `src/components/slides/SlidesTab.vue:175` — unqualified
- `src/components/slides/SlidesTab.vue:303` — unqualified
- `src/components/slides/SlidesTab.vue:442` — unqualified
- `src/components/slides/SlidesTab.vue:475` — unqualified
- `src/composables/useRunControl.ts:937` — 104-REVIEW
- `src/composables/useRunControl.ts:1296` — 104-REVIEW
- `src/utils/importedRenderReconciler.ts:114` — 42-REVIEW.md
- `src/utils/monitorConfig.ts:7` — 91-REVIEW.md
- `src/views/ServiceEditorView.vue:587` — unqualified

**`WR-06`** (4 occurrences across 3 files):
- `src/components/PresentationViewer.vue:310` — unqualified
- `src/stores/quarters.ts:406` — unqualified
- `src/stores/services.ts:878` — unqualified
- `src/stores/services.ts:1023` — unqualified


## Bucket B — Behavioral/Architectural

Untagged, load-bearing multi-line "how this works" narration and non-obvious cross-cutting behavior notes, found via a lightweight grep-first scan (block comments >= ~10 lines, plus any comment carrying an explicit `NOTE:`/`WARNING:`/`HACK:`/`IMPORTANT:` label) across the same four in-scope trees, EXCLUDING every range already claimed by a Bucket A entry above. This is the Phase 109 / R318 relocation target — each entry below is re-listed verbatim in the "Phase 109 Handoff" section at the end of this document. Every entry carries a `file:line`, a short description, and a suggested `.planning/codebase/` target doc.

**Method note (scope, not exhaustiveness claim):** this scan is deliberately "lightweight," per the plan's own framing of Task 2 — it surfaces the highest-confidence untagged load-bearing comments (long block comments and explicitly-labeled notes) rather than manually re-reading every comment in every file. This codebase's comment density is unusually high (see CLAUDE.md), so a maximal scan would revisit thousands of ordinary JSDoc blocks with no rationale content. Every entry below was individually read and classified, not just pattern-matched — but a handful of shorter untagged comments elsewhere in the tree may carry load-bearing behavioral content this pass did not surface. Recommend a targeted follow-up pass in Phase 109 for any file this inventory shows zero hits against, if that file is known to carry complex behavior.

### `firestore.rules`
- **`firestore.rules:11-27`** -> _ARCHITECTURE.md_ — Phase 76 (R213): org lifecycle gate. `active` is absent on every org created before this phase and must read as active (default-true, backward-compatible) -- only an EXPLICIT `active: false` denies.
- **`firestore.rules:35-45`** -> _ARCHITECTURE.md_ — Phase 78 (R225): checked FIRST, before the exists() cross-document read, both for correctness (no membership doc will ever exist for a super-admin entering a church they don't belong to) and for cost (Firestore rules short-circuit && / ||,...
- **`firestore.rules:60-67`** -> _ARCHITECTURE.md_ — Phase 78 (R225): same outer-arm shape as isOrgMember above -- a super-admin is granted editor-tier access on ANY org with zero membership doc, replacing the exists()+role check entirely (not merely waiving isOrgActive()).
- **`firestore.rules:75-84`** -> _ARCHITECTURE.md_ — Phase 68 (R178): super-admin gate. Deliberately CLAIM-ONLY — NO get()/exists() cross-document lookup — unlike isOrgMember/isOrgEditor above.
- **`firestore.rules:233-248`** -> _ARCHITECTURE.md_ — Members subcollection IN-02 (78-REVIEW.md) / T-78-03 accepted residual: Phase 78's super-admin arm makes isOrgEditor(orgId) true for EVERY super-admin on EVERY org (see isOrgEditor above), which means `allow write` below legally permits a s...
- **`firestore.rules:335-346`** -> _INTEGRATIONS.md_ — Messages — the queue of volunteer notifications for this service (R130). No client code writes this collection yet (Phase 58); the Admin SDK (a Phase 59+ Cloud Function) is the intended sole owner of the send lifecycle.
- **`firestore.rules:405-418`** -> _ARCHITECTURE.md_ — resource == null MUST be the first operand and MUST stay first.
- **`firestore.rules:446-458`** -> _INTEGRATIONS.md_ — pptxRenders — render-status doc for an imported PowerPoint deck (R062, Phase 42).
- **`firestore.rules:463-504`** -> _ARCHITECTURE.md_ — All other nested collections — editors only. ★ `collection != 'services'`, `collection != 'slideGroups'` AND `collection != 'pptxRenders'` are all LOAD-BEARING. Do not remove any of the three.
- **`firestore.rules:567-579`** -> _ARCHITECTURE.md_ — T-41-09: the `resource == null` branch is load-bearing, not decorative.
- **`firestore.rules:644-654`** -> _INTEGRATIONS.md_ — AI usage ledger (R163) — one entry per proxied Claude request, written ONLY by the api Cloud Function via the Admin SDK (functions/src/index.ts, Phase 65 Plan 01), which bypasses rules entirely.

### `functions/src/adminEmail.ts`
- **`functions/src/adminEmail.ts:11-32`** -> _INTEGRATIONS.md_ — --- adminEmail (quick task 260823) ------------------------------------------ A reusable, best-effort admin-notification email helper.

### `functions/src/appConfig.ts`
- **`functions/src/appConfig.ts:3-22`** -> _ARCHITECTURE.md_ — --- appConfig (R180-R184: Firestore-backed runtime config) -------------- This module deliberately does NOT call initializeApp()/getFirestore() at module scope -- mirrors claimsHelpers.ts's convention.
- **`functions/src/appConfig.ts:63-73`** -> _ARCHITECTURE.md_ — DEFAULT_APP_CONFIG holds the EXACT current env/defineString fallback values (R182 source of truth) -- every field cites its origin read-site in index.ts so a future diff of that file's defaults can be checked against this constant.
- **`functions/src/appConfig.ts:285-303`** -> _ARCHITECTURE.md_ — Reads appConfig/global, deep-merges it onto DEFAULT_APP_CONFIG, and returns the resolved config.

### `functions/src/backfillLastUsed.ts`
- **`functions/src/backfillLastUsed.ts:4-48`** -> _INTEGRATIONS.md_ — --- backfillLastUsedForOrg (R248: retroactively correct existing songs' lastUsedAt) --- PURPOSE: the live R247 fix (84-01-PLAN.md) corrects `lastUsedAt` GOING FORWARD by recomputing it on the service lock/unlock lifecycle -- but songs whose...
- **`functions/src/backfillLastUsed.ts:156-166`** -> _ARCHITECTURE.md_ — Reads all `organizations/{orgId}/services` and `organizations/{orgId}/songs` docs ONCE (SCALE note above), then for each song computes `MAX(locked service date)` via the mirrored `computeLastUsedDate` and applies the conservative write rule...
- **`functions/src/backfillLastUsed.ts:273-291`** -> _ARCHITECTURE.md_ — --- CLI wrapper ----------------------------------------------------------- Guarded so importing this module (as backfillLastUsed.test.ts does) never calls initializeApp() or touches a live project -- only running it directly does (mirrors...

### `functions/src/backfillOrgClaims.ts`
- **`functions/src/backfillOrgClaims.ts:15-72`** -> _ARCHITECTURE.md_ — --- backfillOrgMembershipClaims (R074/R075: give the two existing users the claim) --- PURPOSE: syncOrgMembershipClaim (./orgMembershipClaims.ts) only fires on FUTURE writes to organizations/{orgId}/members/{uid}.
- **`functions/src/backfillOrgClaims.ts:125-141`** -> _ARCHITECTURE.md_ — Iterates every organizations/*\/members/* document ONCE, grouped by uid in memory, and for each uid reconciles ONE Admin SDK write carrying: - the PRIMARY `{ orgId, role }` claim, via the shared decideMembershipClaim on the user's primary-o...

### `functions/src/index.ts`
- **`functions/src/index.ts:59-69`** -> _INTEGRATIONS.md_ — The Resend email provider key (RESEND_API_KEY) now lives in ./params (moved so orgProvisioning.ts can bind it too without a circular import) -- imported and re-exported at the top of this file.
- **`functions/src/index.ts:147-149`** -> _ARCHITECTURE.md_ — Headers we forward from the client to the upstream API. Note: `x-api-key` and `authorization` for secret-injected services are overwritten below, never trusted from the client.
- **`functions/src/index.ts:159-168`** -> _INTEGRATIONS.md_ — verifyAppCaller replaces the old boolean `callerIsAuthenticated` gate with the SAME accept/reject decision (valid token -> proceed, missing/invalid -> 401), but resolves to the decoded ID token itself rather than throwing it away -- the ant...
- **`functions/src/index.ts:345-363`** -> _INTEGRATIONS.md_ — R242/R243: the real, server-side half of the per-org master AI gate -- a live `organizations/{orgId}` read on EVERY anthropic call, extracted so it is unit-testable without an HTTP harness (the `api` onRequest has none, see the "AI proxy co...
- **`functions/src/index.ts:391-400`** -> _INTEGRATIONS.md_ — R297: the server-side half of the per-org Bible-API (ESV/NLT) gate -- defense-in-depth behind the client dispatcher (Plan 102-01).
- **`functions/src/index.ts:435-447`** -> _INTEGRATIONS.md_ — R161: per-uid fixed-window Firestore rate limit. Two top-level `aiRateLimits` counter docs per call -- `${uid}__min__${minuteWindow}` and `${uid}__day__${dayWindow}` -- read inside a single transaction so the check-then-increment is atomic...
- **`functions/src/index.ts:812-822`** -> _CONCERNS.md_ — --- pptxRenders queue (R062: async server-side render bridge) ---------- One canonical path builder so parsePptxHandler (37-03, this plan), the requestPptxRenderHandler trigger (37-04), and cleanupOrphanRendersHandler (37-05) cannot drift a...
- **`functions/src/index.ts:965-985`** -> _INTEGRATIONS.md_ — The requestPptxRender trigger body, exported separately from the onDocumentCreated wrapper (mirroring parsePptxHandler/parsePptx and cleanupExpiredMediaHandler/cleanupExpiredMedia) so it is directly unit-testable against mocked Firestore/St...
- **`functions/src/index.ts:1072-1081`** -> _ARCHITECTURE.md_ — ★ The gate (T-37-13). Three independent conjuncts, all required: - actualCount > 0 -- the empty-render guard. A deck that rendered nothing must be "failed", never "ready" -- its parsed text layer stays usable either way.
- **`functions/src/index.ts:1114-1129`** -> _ARCHITECTURE.md_ — --- Shared cleanup-sweep safety knob (66-01: T-66-01-02) ---------------- Bounds how many objects a SINGLE LIVE cleanup run may delete.
- **`functions/src/index.ts:1134-1170`** -> _ARCHITECTURE.md_ — --- cleanupExpiredMedia (R015: 2-week Storage retention) --------------- SAFETY CONTRACT (see 22-03 threat model, T-22-03-01..05): - MEDIA_PATH_GUARD is applied to every candidate BEFORE any delete decision.
- **`functions/src/index.ts:1292-1337`** -> _ARCHITECTURE.md_ — --- cleanupOrphanRenders (R062: dry-run-by-default orphan sweep) -------- A second, SEPARATE scheduled job from cleanupExpiredMedia above.
- **`functions/src/index.ts:1503-1563`** -> _ARCHITECTURE.md_ — --- cleanupOrphanBackgrounds (R167: orphan+age background sweep) -------- A NEW sweep, never shipped before this phase.
- **`functions/src/index.ts:1768-1815`** -> _CONCERNS.md_ — --- cleanupPptxSources (R168: prune consumed/failed import sources) ----- A NEW sweep, never shipped before this phase.
- **`functions/src/index.ts:1960-1985`** -> _ARCHITECTURE.md_ — --- previewCleanupDryRun (R188/R190: on-demand blast-radius preview) ---- A super-admin-only onCall that gives the Owner Console a truthful, on-demand "what would this cleanup delete right now" count for any of the four *_CLEANUP_ENABLED sw...
- **`functions/src/index.ts:2090-2114`** -> _ARCHITECTURE.md_ — --- sendScheduledReminders daily reminder cron (61-02: R145/R133/SC3/SC4) -- The R145 reminder engine: a daily onSchedule cron that auto-enqueues the shared service link to everyone assigned N days before a service, reckoned in the org's LO...
- **`functions/src/index.ts:2286-2313`** -> _ARCHITECTURE.md_ — NO secrets: array -- the cron only ENQUEUES; RESEND_API_KEY binds solely to sendQueuedMessage (R131). 04:00 UTC is a NEW slot, offset from the taken 02:00 (media) and 03:00 (renders) so the three daily sweeps never overlap.
- **`functions/src/index.ts:2349-2360`** -> _ARCHITECTURE.md_ — --- dispatchDueScheduledMessagesHandler (61-03: R141 schedule-for-later) --- The Phase 59 carryover -- actually SEND user-scheduled messages.
- **`functions/src/index.ts:2390-2401`** -> _ARCHITECTURE.md_ — Finds due user-scheduled messages and dispatches each by (1) transactionally claiming the ORIGINAL scheduled->dispatched (only if still 'scheduled' -- the idempotency guard that makes an at-least-once cron retry a no-op) and (2) creating a...
- **`functions/src/index.ts:2496-2514`** -> _ARCHITECTURE.md_ — --- queueServiceMessage send-path enqueue (59-02: R131/R137/R141) ------ The thin enqueue half of the send path, mirroring the parsePptxHandler -> pptxRenders queue -> requestPptxRender triad above: an onCall Function whose handler body (qu...
- **`functions/src/index.ts:2619-2629`** -> _ARCHITECTURE.md_ — The single canonical messages/{id} doc-shaper — pure, no Firestore I/O (its role mirrors pptxRenderDocRef's "one canonical shape so the callable and the trigger cannot drift", and buildServiceSnapshot's pure field-assembly).
- **`functions/src/index.ts:2648-2669`** -> _ARCHITECTURE.md_ — The queueServiceMessage handler body, exported separately from the onCall wrapper (parsePptxHandler/parsePptx precedent) so tests invoke it directly with a fake CallableRequest.
- **`functions/src/index.ts:3249-3265`** -> _INTEGRATIONS.md_ — --- messageWebhook (60-02: R143 — Resend delivery/bounce receiver) --------- The milestone's new UNAUTHENTICATED trust boundary.
- **`functions/src/index.ts:3272-3289`** -> _INTEGRATIONS.md_ — Resolve the bounced recipient's DocumentReference. PRIMARY (tags): when the echoed Resend tags carry all four path segments, build the recipients/{id} ref DIRECTLY at the exact nested path — a single doc() with NO query and NO index depende...
- **`functions/src/index.ts:3311-3323`** -> _ARCHITECTURE.md_ — Idempotently record a hard bounce against an addressed recipient. Runs ONE transaction that reads the recipient status AND the message's current count BEFORE any write (mirrors sendQueuedMessageHandler's transition-guarded claim).
- **`functions/src/index.ts:3350-3371`** -> _INTEGRATIONS.md_ — The messageWebhook handler body, exported separately from the onRequest wrapper (the sendQueuedMessageHandler/parsePptxHandler convention) so it is unit-testable directly with a fake rawBody+headers and no res — firebase-functions/v2/https...
- **`functions/src/index.ts:3424-3438`** -> _ARCHITECTURE.md_ — --- syncOrgMembershipClaim (R074/R075: the claim storage.rules reads) -- Sets the { orgId, role } custom auth claim that storage.rules' dual-read isOrgMemberByClaim(orgId) arm reads as request.auth.token.orgId / request.auth.token.role (pla...
- **`functions/src/index.ts:3441-3451`** -> _ARCHITECTURE.md_ — --- superAdminClaims (68-02: syncSuperAdminClaim trigger + setSuperAdminClaim onCall, R174/R175-B/R176/R179) ------------------------------------------ Implementation lives in ./superAdminClaims so its testable handlers (syncSuperAdminClaim...
- **`functions/src/index.ts:3454-3466`** -> _ARCHITECTURE.md_ — --- orgProvisioning (Phase 74: onboardOrganization/assignOrgAdmin/ listOrganizations, R196-R206; Phase 76: setOrgActive, R212-R214) ---------- Implementation lives in ./orgProvisioning so its testable handlers (onboardOrganizationHandler/as...

### `functions/src/inviteOnboarding.ts`
- **`functions/src/inviteOnboarding.ts:90-99`** -> _ARCHITECTURE.md_ — Domain-suffix classifier for the invitee-type branch (99-CONTEXT.md's leaning default). Normalize FIRST (.trim().toLowerCase()) before calling -- mirrors resolveAdminTarget's normalizedEmail discipline.
- **`functions/src/inviteOnboarding.ts:136-152`** -> _INTEGRATIONS.md_ — The testable handler body, exported separately from the onCall wrapper below -- mirrors onboardOrganizationHandler/queueServiceMessageHandler.

### `functions/src/messageTokens.ts`
- **`functions/src/messageTokens.ts:1-17`** -> _STACK.md_ — Pure server-side token renderer for the send path (Phase 59, R138/R139). `sendQueuedMessage` (functions/src/index.ts) renders each recipient's subject and body from the RAW token template stored on the message doc.

### `functions/src/orgMembershipClaims.ts`
- **`functions/src/orgMembershipClaims.ts:6-20`** -> _ARCHITECTURE.md_ — --- syncOrgMembershipClaim (R074/R075: the claim storage.rules reads) -- This module deliberately does NOT call initializeApp() at module scope.
- **`functions/src/orgMembershipClaims.ts:93-102`** -> _ARCHITECTURE.md_ — Structural guard, in the spirit of index.ts's MEDIA_PATH_GUARD -- mirrors backfillOrgClaims.ts's resolveOrgId byte-for-byte (D-11: one guard shared by the trigger and the backfill).
- **`functions/src/orgMembershipClaims.ts:110-137`** -> _ARCHITECTURE.md_ — Recomputes the full `orgs` map for `uid` from the SURVIVING organizations/*\/members/{uid} documents -- NEVER from users/{uid}.orgIds.
- **`functions/src/orgMembershipClaims.ts:228-242`** -> _CONCERNS.md_ — The single shared decision function (40-02-PLAN.md DISC-02). Both the trigger below and plan 40-04's backfill import this rather than reimplementing the rule, so the two can never drift.
- **`functions/src/orgMembershipClaims.ts:318-331`** -> _ARCHITECTURE.md_ — Shallow-equal for two `orgs` maps. `undefined` (no `orgs` claim key at all -- a legacy pre-widening token) is treated as equivalent to `{}` (a freshly-computed empty map for a user with zero surviving memberships), so a legacy claim for a u...

### `functions/src/orgProvisioning.ts`
- **`functions/src/orgProvisioning.ts:15-44`** -> _ARCHITECTURE.md_ — --- orgProvisioning (Phase 74, R196-R206: the owner-console org-provisioning callables) ---------------------------------------------------------------- This module deliberately does NOT call initializeApp() at module scope -- mirrors super...
- **`functions/src/orgProvisioning.ts:87-96`** -> _ARCHITECTURE.md_ — The single caller-gate helper applied verbatim by all three handlers below (R200/R204) -- mirrors setSuperAdminClaimHandler (superAdminClaims.ts:106-128) exactly.
- **`functions/src/orgProvisioning.ts:239-254`** -> _ARCHITECTURE.md_ — The testable handler body, exported separately from the onCall wrapper below -- mirrors setSuperAdminClaimHandler/setSuperAdminClaim.
- **`functions/src/orgProvisioning.ts:342-354`** -> _ARCHITECTURE.md_ — The testable handler body, exported separately from the onCall wrapper below. Orphan guard (T-74-06): rejects a typo'd/nonexistent `orgId` BEFORE any write, so no orphaned membership is ever created under an id with no matching org.
- **`functions/src/orgProvisioning.ts:757-769`** -> _INTEGRATIONS.md_ — The testable handler body, exported separately from the onCall wrapper below -- modeled on setOrgActiveHandler's SIMPLER shape (caller gate, input validation, org-existence check, same-state-aware merge write), NOT setOrgAiEnabledHandler's...

### `functions/src/orgTemplateSeed.ts`
- **`functions/src/orgTemplateSeed.ts:3-28`** -> _ARCHITECTURE.md_ — Phase 74 (R197/R198): pure, data-only ported seed content for a newly onboarded org — the Suggested Template (`buildSuggestedTemplateEntries()`) and the default `OrgSettings` literal.

### `functions/src/params.ts`
- **`functions/src/params.ts:3-18`** -> _INTEGRATIONS.md_ — --- params (shared, dependency-free) ---------------------------------------- A tiny module with NO local imports beyond firebase-functions/params, so it can be imported by BOTH index.ts and orgProvisioning.ts/adminEmail.ts without creating...

### `functions/src/pptxParser.ts`
- **`functions/src/pptxParser.ts:1-10`** -> _ARCHITECTURE.md_ — PPTX -> native slide mapping (Phase 21, R010/R011/R012). `functions/` is a standalone TypeScript project (its own tsconfig, cannot import from `src/`), so the slide shapes below are hand-mirrored from the app's canonical types rather than i...
- **`functions/src/pptxParser.ts:87-111`** -> _INTEGRATIONS.md_ — Pure mapping from an officeparser AST to an ordered array of native (text | image) slide objects, using the mixed-content heuristic documented above.
- **`functions/src/pptxParser.ts:193-202`** -> _INTEGRATIONS.md_ — Validates, parses, and maps a .pptx buffer into native slides, uploading any extracted images to org-scoped Storage along the way.

### `functions/src/renderInvoker.ts`
- **`functions/src/renderInvoker.ts:3-15`** -> _INTEGRATIONS.md_ — The single, mockable seam that mints a Google-issued ID token and invokes the private "pptx-render" Cloud Run service (R062: bridging function's IAM-authenticated invocation of a Cloud Run service).

### `functions/src/serviceRoles.ts`
- **`functions/src/serviceRoles.ts:1-33`** -> _ARCHITECTURE.md_ — Server-side recipient resolver (Phase 59, R131/R139). `functions/` is a standalone TypeScript project (its own tsconfig with include:["src"], no `@/` alias — it cannot import from the client `src/` tree), so this file is a DUPLICATE of the...
- **`functions/src/serviceRoles.ts:152-172`** -> _ARCHITECTURE.md_ — Resolves a { teams, individualPersonIds, includeEveryone } selection into deduped (by person id), reachability-split recipient lists with per-recipient roleNames. Server-side enrichment of the client resolveRecipients split.

### `functions/src/superAdminClaims.ts`
- **`functions/src/superAdminClaims.ts:7-22`** -> _ARCHITECTURE.md_ — --- superAdminClaims (R174/R175-B/R176/R179: the owner-console access gate) --- This module deliberately does NOT call initializeApp() at module scope -- mirrors orgMembershipClaims.ts: functions/src/index.ts already does that for the deplo...
- **`functions/src/superAdminClaims.ts:36-49`** -> _ARCHITECTURE.md_ — The testable handler body, exported separately from the onDocumentWritten wrapper below -- mirrors syncOrgMembershipClaimHandler/syncOrgMembershipClaim.
- **`functions/src/superAdminClaims.ts:93-105`** -> _ARCHITECTURE.md_ — The testable handler body, exported separately from the onCall wrapper below -- mirrors parsePptxHandler/parsePptx and queueServiceMessageHandler/queueServiceMessage.

### `functions/src/webhookSignature.ts`
- **`functions/src/webhookSignature.ts:26-47`** -> _INTEGRATIONS.md_ — Verify a Resend/Svix (Standard Webhooks) HMAC-SHA256 signature over the RAW request body.

### `src/components/ContextualActionBar.vue`
- **`src/components/ContextualActionBar.vue:136-158`** -> _ARCHITECTURE.md_ — ContextualActionBar.vue — the one shared action bar (36-02, R068).

### `src/components/MiscLabelBadge.vue`
- **`src/components/MiscLabelBadge.vue:2-14`** -> _ARCHITECTURE.md_ — Inline-editable MISC label pill (2026-08-12 owner request). Replaces the separate MISC "label" input added in Phase 56 (R127): the colored badge pill IS the editable surface — click it (or its pencil) to rename a Miscellaneous item directly...

### `src/components/PptxImportModal.vue`
- **`src/components/PptxImportModal.vue:449-461`** -> _ARCHITECTURE.md_ — ── External drop-zone entry point (25-07 Task 1, D-15) ───────────────────── Lets an external drop zone (the Slides tab's grid-wide/tile drop handling, 25-07) hand this modal an already-picked File without touching its own <input> elements...

### `src/components/SongLyricEditor.vue`
- **`src/components/SongLyricEditor.vue:793-804`** -> _STACK.md_ — ── Drag reorder (D-01): the list is always draggable by handle, no mode to enter first.

### `src/components/SongSlotPicker.vue`
- **`src/components/SongSlotPicker.vue:267-277`** -> _ARCHITECTURE.md_ — Visible songs filtered by the shared store tag-filter state (D-09/D-10: independent per-tag Show/Hide sets — exclusion always wins; include set OR-combines when non-empty).

### `src/components/SongTable.vue`
- **`src/components/SongTable.vue:438-444`** -> _ARCHITECTURE.md_ — Note: Tags/Themes on this listing are display-only + click-to-filter (filterByPill above).

### `src/components/actionBarItems.ts`
- **`src/components/actionBarItems.ts:1-31`** -> _ARCHITECTURE.md_ — ActionBarItem contract — 36-02, R068. The declarative shape `ContextualActionBar.vue` renders and `buildActionBarItems` (`src/views/serviceEditorActionBar.ts`) produces.

### `src/components/admin/CleanupEnableConfirmDialog.vue`
- **`src/components/admin/CleanupEnableConfirmDialog.vue:112-123`** -> _ARCHITECTURE.md_ — Phase 71-02 (R189/R190) — Confirm-to-flip modal for the Owner Console's Cleanup card.

### `src/components/admin/DeactivateOrgConfirmDialog.vue`
- **`src/components/admin/DeactivateOrgConfirmDialog.vue:88-99`** -> _ARCHITECTURE.md_ — Quick task 260824 — reversible-lifecycle confirm dialog for deactivating a church.

### `src/components/run/RunDisplaysPanel.vue`
- **`src/components/run/RunDisplaysPanel.vue:2-28`** -> _CONCERNS.md_ — RunDisplaysPanel — the State-B Displays panel (R276), now relocated to the right column beside/under the next-up preview (owner fix #4) and carrying the closed-window RECOVERY (R274) that the removed top status band used to surface (owner f...

### `src/components/run/RunFilmstrip.vue`
- **`src/components/run/RunFilmstrip.vue:41-51`** -> _ARCHITECTURE.md_ — R282 — the in-item filmstrip, extracted as a PURE presentational child (97-05).

### `src/components/run/RunHeader.vue`
- **`src/components/run/RunHeader.vue:2-20`** -> _ARCHITECTURE.md_ — RunHeader — the State-B live header (R277). PURE presentation: props-in / emits-out, no channel, no store, no timer logic.

### `src/components/run/RunPreviewPair.vue`
- **`src/components/run/RunPreviewPair.vue:114-134`** -> _ARCHITECTURE.md_ — R276 owner fix #2/#4 — the program + next-up preview pair, extracted as a PURE display child (97-05).

### `src/components/run/RunRail.vue`
- **`src/components/run/RunRail.vue:2-16`** -> _ARCHITECTURE.md_ — RunRail — the order-of-service rail (R276, R262/R263), extracted as PURE presentation from RunControlView.vue (:388-463 markup + the Phase 95 captureActiveRow/watch(index) auto-scroll at useRunControl.ts:184-193).

### `src/components/run/RunTransportBar.vue`
- **`src/components/run/RunTransportBar.vue:2-11`** -> _ARCHITECTURE.md_ — RunTransportBar — the State-B bottom transport bar (R276). PURE presentation: props-in / emits-out, no channel, no store.

### `src/components/settings/ServiceTemplateEditor.vue`
- **`src/components/settings/ServiceTemplateEditor.vue:309-318`** -> _ARCHITECTURE.md_ — The six kinds a church can add here — a closed set, never derived from the `SlotKind` union (which also contains HYMN, palette-retired in Phase 43/R084, and IMPORTED, which has no pre-creation meaning).

### `src/components/slides/BackgroundControl.vue`
- **`src/components/slides/BackgroundControl.vue:73-101`** -> _ARCHITECTURE.md_ — Shared, presentational background-image control (R055/R057, Phase 33 Plan 03) — mounted at BOTH the group level (`SlideGrid.vue`, 33-08) and the song level (`SongLyricEditor.vue`, 33-06), a mechanical sibling of `SlideGroupMusicControl.vue`...
- **`src/components/slides/BackgroundControl.vue:139-151`** -> _ARCHITECTURE.md_ — Owner follow-up (side-by-side group media panel): when true, this control renders NO caption line of its own in either state — the caller is taking responsibility for placing `caption`'s copy itself.

### `src/components/slides/EditSlideDrawer.vue`
- **`src/components/slides/EditSlideDrawer.vue:542-555`** -> _ARCHITECTURE.md_ — R036 — the service's lifecycle lock, kept DISTINCT from `isEditor` because this drawer is the one surface that must tell the two apart: a viewer and a locked editor need different read-only copy (31-UI-SPEC § 6).
- **`src/components/slides/EditSlideDrawer.vue:565-577`** -> _CONCERNS.md_ — Phase 33 UI-audit fix — the selected slide's GROUP siblings, already resolved (same array `SlidesTab.vue`'s `selectedGroupAssembledSlides` computes for the position/total props above, at the same altitude, no new resolver).
- **`src/components/slides/EditSlideDrawer.vue:827-836`** -> _ARCHITECTURE.md_ — `scripture`-kind entries: the UI-SPEC calls for the passage text alone, not `slideBodyText`'s reference-prefixed form (the reference is already shown in the context line above).
- **`src/components/slides/EditSlideDrawer.vue:1023-1035`** -> _ARCHITECTURE.md_ — ★ Deliberately NOT `canMutate` — omits the song-group exclusion.
- **`src/components/slides/EditSlideDrawer.vue:1038-1059`** -> _ARCHITECTURE.md_ — ★ Phase 33 UI-audit fix (previously a known, scoped gap documented in 33-07-SUMMARY.md): this drawer still receives no `song` document, so the GROUP branch keeps reading `props.group.backgroundImageUrl` directly (a raw field read, not a re-...
- **`src/components/slides/EditSlideDrawer.vue:1390-1408`** -> _ARCHITECTURE.md_ — ── Phase 26-09 Task 2: Duplicate — insert a copy directly after the original ── Mints a FRESH id for the copy (D-04, this plan's key_links) — never the original's, and never derived from label/source/position: `PresentationViewer.vue` keys...
- **`src/components/slides/EditSlideDrawer.vue:1448-1458`** -> _ARCHITECTURE.md_ — Filters the entry out and renumbers the rest contiguous, writing through the same fresh-base helper every other write in this drawer uses.
- **`src/components/slides/EditSlideDrawer.vue:1485-1502`** -> _ARCHITECTURE.md_ — ★ P-01: the delete key sets the EXISTING `showDeleteConfirm` state and never calls the delete action directly. A menu puts destruction one click closer than the drawer did; it must not also make it quieter.

### `src/components/slides/SlideCanvas.vue`
- **`src/components/slides/SlideCanvas.vue:360-372`** -> _ARCHITECTURE.md_ — R070 (UAT F3) — the slide → group → song background cascade was already resolved upstream, once, by the assembler; this reads only the single winning value already sitting on the current slide.
- **`src/components/slides/SlideCanvas.vue:542-555`** -> _STACK.md_ — R093 (46-04) — per-element font-weight/font-size overrides reading the `--slide-font-*` custom properties `PresentationViewer`'s `typographyStyle` sets on its viewer root, which these elements inherit into (moved here unchanged, Phase 90).

### `src/components/slides/SlideCard.vue`
- **`src/components/slides/SlideCard.vue:169-194`** -> _CONCERNS.md_ — Presentational, prop-driven slide card (Phase 25 Task 1, drag grip added 25-05 Task 3). Renders one assembled slide inside `SlideGrid.vue` — text body plus metadata only; real formatted-slide rendering remains deferred (D-10).

### `src/components/slides/SlideDropTarget.vue`
- **`src/components/slides/SlideDropTarget.vue:33-60`** -> _STACK.md_ — The drop tile itself (D-13) — always the LAST item the grid renders, including at zero slides (D-08), and NEVER inside SortableJS's draggable set: `.slide-card` is deliberately absent from this component's root class, so a tile mounted insi...

### `src/components/slides/SlideGrid.vue`
- **`src/components/slides/SlideGrid.vue:537-552`** -> _ARCHITECTURE.md_ — ★ R036 — the two composed gates this component uses everywhere. Both fold the lifecycle lock into the existing R054 seam rather than running beside it. `canMutateGroup` — create/import/reorder the group's SLIDES.
- **`src/components/slides/SlideGrid.vue:797-808`** -> _ARCHITECTURE.md_ — --- R050: the one append contract every write path below routes through --- Sorts a copy of `entries` by `order`, concatenates `additions` (in the order given), then renumbers every element to its array index — so array order and `order` ar...
- **`src/components/slides/SlideGrid.vue:1100-1109`** -> _STACK.md_ — --- Task 3: drag-reorder within the selected group (D-11) --- Reuses the exact SortableJS pattern already established in `ServiceEditorView.vue`'s slot list: `handle`/`draggable` scoping and splice-and-reindex.
- **`src/components/slides/SlideGrid.vue:1192-1201`** -> _ARCHITECTURE.md_ — T-29-13: surface the failure inline and force the card list to rebuild from props (via `gridRenderNonce`) — the DOM revert this used to lean on is gone, and `props.assembledSlideshow` changes no prop on a rejected write, so nothing re-rende...

### `src/components/slides/SlideGroupMusicControl.vue`
- **`src/components/slides/SlideGroupMusicControl.vue:76-91`** -> _ARCHITECTURE.md_ — Group-level audio bed control (Phase 25 Task 1, R032) — scoped to the SELECTED GROUP rather than a service slot, and audio-only per D-14 (group music is never a slide; dropped video is a slide, that path is 25-07's).

### `src/components/slides/SlidesTab.vue`
- **`src/components/slides/SlidesTab.vue:137-148`** -> _ARCHITECTURE.md_ — ★ R036 — the lifecycle lock, threaded DISTINCT from `isEditor` rather than folded into it upstream.
- **`src/components/slides/SlidesTab.vue:184-196`** -> _ARCHITECTURE.md_ — Whether there is anything assembled to present — the same condition SlideshowPreview's own `canPresent` (aliased to `hasAnySlides`, Phase 23-04) used, restated directly against `assembledSlideshow` rather than reintroducing the `AssembledSe...
- **`src/components/slides/SlidesTab.vue:272-281`** -> _ARCHITECTURE.md_ — Phase 33-09 — a menu-dispatched Duplicate/Delete request, relayed verbatim into the drawer's own `pendingAction` prop (33-07's seam).
- **`src/components/slides/SlidesTab.vue:383-392`** -> _ARCHITECTURE.md_ — R061 — the (group, slide) → flat-deck-index mapping `present` hands to `PresentationViewer`.

### `src/components/slides/SlotLoopControl.vue`
- **`src/components/slides/SlotLoopControl.vue:2-15`** -> _ARCHITECTURE.md_ — Per-item Run auto-advance / LOOP authoring control (R306/R307, Phase 106).

### `src/components/slides/dropRouting.ts`
- **`src/components/slides/dropRouting.ts:1-19`** -> _ARCHITECTURE.md_ — Pure module partitioning a native drop's raw `File[]` into the four accepted kinds (PPTX deck, image, video, audio) plus a rejected bucket (25-07 Task 2, R018/R032).
- **`src/components/slides/dropRouting.ts:97-106`** -> _ARCHITECTURE.md_ — Applies the documented resolution order for a multi-kind drop (25-07 Task 2, D-14 discretion): the first audio file becomes the group's music; every video file appends a slide, in drop order; for the two modal-backed kinds, a PPTX takes pre...

### `src/components/slides/slideDisplay.ts`
- **`src/components/slides/slideDisplay.ts:58-69`** -> _ARCHITECTURE.md_ — Static, fully-spelled-out failure-reason → human-sentence lookup — the copywriting-contract table from 42-UI-SPEC.md, reproduced verbatim, in the same shape as `KIND_BADGE_CLASSES` above: a complete literal `Record`, never a value built by...
- **`src/components/slides/slideDisplay.ts:78-91`** -> _ARCHITECTURE.md_ — The ONE sanctioned route from a render document's raw `failureReason` slug to the DOM (`SlideBase.renderFailureReason`'s own doc comment names this function as its only legal consumer). Never render `failureReason` any other way.
- **`src/components/slides/slideDisplay.ts:131-142`** -> _ARCHITECTURE.md_ — Readable, natural-case speaker name for a congregational section's `speaker` enum value (Phase 38-03, widened Phase 47 R095) — `'LEADER'` -> `'Leader'`, `'CONGREGATION'` -> `'Congregation'`, `'ALL'` -> `'All'`.
- **`src/components/slides/slideDisplay.ts:197-219`** -> _INTEGRATIONS.md_ — R047: a Reference-state slide (no congregational section) defaults to reference-only (empty text) — return just the reference, with no trailing blank line.
- **`src/components/slides/slideDisplay.ts:278-287`** -> _ARCHITECTURE.md_ — The Edit Slide drawer's delete-confirm body (26-UI-SPEC.md § "Duplicate and Delete Slide", Phase 24 D-03 precedent) — the four wordings, reproduced verbatim, branching on whether THIS entry (never the group) has its own attached audio and/o...
- **`src/components/slides/slideDisplay.ts:346-365`** -> _ARCHITECTURE.md_ — 34-07 (owner UAT F1): this key now opens the congregational-reading editor in place (a modal over the Slides tab), not a navigation away from it — 'edit-in-song' stays 'nav' below because IT still routes to the song editor.
- **`src/components/slides/slideDisplay.ts:384-435`** -> _ARCHITECTURE.md_ — Pure per-kind 3-dot slide action menu item list (R063). Synchronous, no store/composable reads — follows this file's established pure-helper convention (`KIND_BADGE_CLASSES`, `deleteSlideConfirmBody`).

### `src/components/stage/StageKindIcon.vue`
- **`src/components/stage/StageKindIcon.vue:2-13`** -> _ARCHITECTURE.md_ — Inline-SVG glyph for a stage-marker kind (Phase 107 redesign).

### `src/components/stage/StageLayoutEditor.vue`
- **`src/components/stage/StageLayoutEditor.vue:2-28`** -> _ARCHITECTURE.md_ — The AUTHORING half of the visual stage layout (R313/R314, Phase 107), redesigned to the single-room "Nocturne" diagram: a left PALETTE of typed chips, one continuous room CANVAS (StageRoom), and — for editing a marker — the app's existing r...

### `src/components/stage/StageLayoutPrintDocument.vue`
- **`src/components/stage/StageLayoutPrintDocument.vue:2-14`** -> _ARCHITECTURE.md_ — The tech team's printable STAGE LAYOUT sheet (quick task 2026-09-01): hidden on screen, shown only when printing, and printed LANDSCAPE + BLACK AND WHITE (see ServiceEditorView.printStageLayout, which injects the `@page { size: landscape }`...

### `src/components/stage/StageLayoutView.vue`
- **`src/components/stage/StageLayoutView.vue:2-14`** -> _STACK.md_ — Shared READ-ONLY stage-plot renderer (R313/R314/R315, Phase 107; redesigned to the single-room diagram).

### `src/components/stage/StageMarkerChip.vue`
- **`src/components/stage/StageMarkerChip.vue:2-17`** -> _ARCHITECTURE.md_ — A single stage-marker tile (Phase 107 redesign): a rounded icon tile with the kind glyph, the label beneath it, plus the type, an assigned person, and a tech note.

### `src/components/stage/StageRoom.vue`
- **`src/components/stage/StageRoom.vue:2-20`** -> _ARCHITECTURE.md_ — The stage-room BACKDROP (Phase 107 redesign): one continuous room drawn the way it reads when you stand in it — the platform is a shape at the top, the audience sits below, and "off stage" is the floor in the side wings.

### `src/composables/useAutoSave.ts`
- **`src/composables/useAutoSave.ts:19-44`** -> _ARCHITECTURE.md_ — Reusable auto-save composable extracted from ServiceEditorView's pattern. Watches a reactive source with a deep watcher, debounces changes, and calls `saveFn` after the debounce period elapses.

### `src/composables/useBackgroundUpload.ts`
- **`src/composables/useBackgroundUpload.ts:5-14`** -> _ARCHITECTURE.md_ — Background-image-cap constant (R055/R057, Phase 33 Plan 03) — a client-side pre-validation figure that sits well under the authoritative server-side cap for this prefix.
- **`src/composables/useBackgroundUpload.ts:48-69`** -> _INTEGRATIONS.md_ — Firebase Storage upload composable for background images (R055/R057, Phase 33 Plan 03).

### `src/composables/useLoopTimer.ts`
- **`src/composables/useLoopTimer.ts:1-18`** -> _ARCHITECTURE.md_ — useLoopTimer — the single-active-timer primitive behind per-item Run loop playback (Phase 106, R306/R308). Owns EXACTLY ONE interval id.

### `src/composables/useMediaUpload.ts`
- **`src/composables/useMediaUpload.ts:41-50`** -> _INTEGRATIONS.md_ — Firebase Storage upload composable for audio/video media attachments (Phase 22, R013/R014). Mirrors `src/utils/pptxUpload.ts`'s resumable-upload + createdAt-custom-metadata pattern, reactively, for the media-attachment upload UI.

### `src/composables/useOutputWindow.ts`
- **`src/composables/useOutputWindow.ts:41-51`** -> _STACK.md_ — Each output view passes its OWN static role ('audience' | 'confidence') — the routes /present/audience|confidence make the role statically known. Retained as a harmless identity option; fullscreen is no longer resolved from it.
- **`src/composables/useOutputWindow.ts:137-148`** -> _STACK.md_ — ── Fullscreen Capability Delegation (best-effort zero-tap) ───────────────── A popup opened via window.open loses its OWN transient user-activation the moment its SPA/auth bootstrap runs, so a mount-time requestFullscreen() here always reje...
- **`src/composables/useOutputWindow.ts:164-191`** -> _ARCHITECTURE.md_ — ── Automatic Fullscreen content setting (Chrome 126+ — the ZERO-CLICK primary) ─ Chrome's "Automatic Fullscreen" content setting (a one-time per-computer allow, or the AutomaticFullscreenAllowedForUrls enterprise policy) lets an allowed ori...
- **`src/composables/useOutputWindow.ts:284-286`** -> _CONCERNS.md_ — NOTE: the deferred first-play (audience old onMounted 256-259) is NOT here — it references the view's canvas ref and is re-homed to a view-local watch(fontReady) in each consuming view.

### `src/composables/useRunControl.ts`
- **`src/composables/useRunControl.ts:336-352`** -> _ARCHITECTURE.md_ — ── Output-window orchestration (R261 / R266) ────────────────────────────── The Go live gesture opens BOTH standalone output windows and (when the live monitors match a saved mapping) places each on its assigned screen.
- **`src/composables/useRunControl.ts:574-588`** -> _STACK.md_ — Owner UAT — auto-fullscreen the output windows. Chrome's Window Management API supports opening a popup DIRECTLY in fullscreen via the `fullscreen` window feature (with the window-management permission — already granted in monitor setup — a...
- **`src/composables/useRunControl.ts:605-614`** -> _STACK.md_ — ── Fullscreen Capability Delegation (opener side) ────────────────────────── A popup cannot self-fullscreen (it loses its own activation to its bootstrap), but WE (the control window) still hold transient activation from the Go-live click.
- **`src/composables/useRunControl.ts:635-645`** -> _ARCHITECTURE.md_ — Owner UAT — per-display fullscreen. Bound to a "Go fullscreen" button on each card in the control's Displays panel.
- **`src/composables/useRunControl.ts:847-858`** -> _CONCERNS.md_ — Owner UAT — keep the CONTROL screen fullscreen while running. openOutputs requests control fullscreen SYNCHRONOUSLY in the click path (so a non-policy machine still gets its one gesture-authorized attempt), but opening the two output popups...
- **`src/composables/useRunControl.ts:954-966`** -> _INTEGRATIONS.md_ — END REHEARSAL (owner UAT) — return to the pre-flight "Ready when you are" screen (State A) WITHOUT tearing down or navigating away.
- **`src/composables/useRunControl.ts:1129-1139`** -> _ARCHITECTURE.md_ — ── Per-item loop timer (R306/R308, Phase 106) ────────────────────────────── The SINGLE loop timer lives HERE — never in an output window (AudienceOutputView/ConfidenceOutputView stay receive-only, ARCHITECTURE anti-patterns).
- **`src/composables/useRunControl.ts:1249-1258`** -> _ARCHITECTURE.md_ — Open the monitor-setup screen in a NEW TAB so the running control (index/seq/ channel + any open outputs) survives — mirrors the reassign banner's new-tab rule. Owner fix #5: NO 'noopener'.

### `src/composables/useRunTimers.ts`
- **`src/composables/useRunTimers.ts:3-19`** -> _ARCHITECTURE.md_ — useRunTimers — the Run screen's wall clock + elapsed-since-go-live timer (R281).

### `src/composables/useSlideshowAssembly.ts`
- **`src/composables/useSlideshowAssembly.ts:1-14`** -> _STACK.md_ — Reactive wrapper over the pure `assembleSlideshow` engine (20-02), delivering R006: reorder/add/remove a service element and the assembled slideshow follows with no manual re-sync.
- **`src/composables/useSlideshowAssembly.ts:34-43`** -> _ARCHITECTURE.md_ — Opens a LIVE subscription to a song's current (newest) lyrics document.
- **`src/composables/useSlideshowAssembly.ts:127-139`** -> _ARCHITECTURE.md_ — On-demand group materializer (25-05 Task 1): resolves to `{ entries, sourceSignature }` for `slotId`'s group, creating it first if it does not exist yet — including when the derived input has ZERO slides, unlike the automatic `materializeCa...
- **`src/composables/useSlideshowAssembly.ts:141-157`** -> _ARCHITECTURE.md_ — ME-04 (R045 membership). Marks `slotId` as having a delete in flight and returns the release; call it in a `finally`.
- **`src/composables/useSlideshowAssembly.ts:159-169`** -> _ARCHITECTURE.md_ — HI-01. Resolves once no group write issued by this composable is still in flight.
- **`src/composables/useSlideshowAssembly.ts:253-262`** -> _ARCHITECTURE.md_ — 2. `imported` ENTRIES living inside ANY slot's slide group. A PPTX deck's rendered slides can be added straight into a non-IMPORTED slot's group (e.g.
- **`src/composables/useSlideshowAssembly.ts:456-467`** -> _ARCHITECTURE.md_ — --- Part 2: live structure for a stale SONG group, in-memory only --- True when a SONG slot's PERSISTED slide group no longer matches the verse structure the song's CURRENT lyrics would produce — a verse added, removed, or reordered in `per...
- **`src/composables/useSlideshowAssembly.ts:482-493`** -> _ARCHITECTURE.md_ — The group map the assembler renders from. For an EDITABLE session (`canWrite`) this is the store's map UNCHANGED — the rebuild loop persists any regenerated group, so the stored group is authoritative and behavior is identical to before.
- **`src/composables/useSlideshowAssembly.ts:529-538`** -> _ARCHITECTURE.md_ — --- Task 2: lazy materialization, zero writes on reorder --- `materializationCandidates` is a fully SYNCHRONOUS computed that decides WHAT needs materializing.
- **`src/composables/useSlideshowAssembly.ts:600-610`** -> _ARCHITECTURE.md_ — HI-01. Both apply loops below are invoked fire-and-forget (`void …`) from `{ immediate: true }` watchers, so nothing awaits them and nothing can observe when their writes settle.
- **`src/composables/useSlideshowAssembly.ts:659-668`** -> _ARCHITECTURE.md_ — --- 25-05 Task 1: on-demand materialization for an explicit user write --- Concurrent calls for the SAME slot are deduped through `ensureInFlight` so at most one create is issued and every caller resolves the same result.

### `src/composables/useUnsavedGuard.ts`
- **`src/composables/useUnsavedGuard.ts:3-22`** -> _ARCHITECTURE.md_ — Tracks a baseline snapshot of a drawer's editable form state (captured when the drawer opens) and exposes a reactive dirty-check plus a confirm-before-discard guard for Cancel / backdrop / × close actions.

### `src/config/appConfigDefaults.ts`
- **`src/config/appConfigDefaults.ts:108-119`** -> _ARCHITECTURE.md_ — A client-side mirror of functions/src/appConfig.ts's mergeAppConfig — deliberately a PER-GROUP merge (not a naive recursive deep-merge or a generic deep-merge library), so a doc that sets only e.g.

### `src/config/slideFonts.ts`
- **`src/config/slideFonts.ts:1-41`** -> _CONCERNS.md_ — Curated registry of self-hosted slide fonts (R093 success criterion 4).

### `src/firebase/index.ts`
- **`src/firebase/index.ts:23-41`** -> _STACK.md_ — Emulator wiring — DEV BUILDS ONLY. ★ `import.meta.env.DEV` is load-bearing, not belt-and-braces. Do not remove it, and do not "simplify" this back to a bare VITE_USE_EMULATORS check.

### `src/main.ts`
- **`src/main.ts:16-25`** -> _STACK.md_ — NOTE (output-window fullscreen): there is deliberately NO module-load requestFullscreen() here for /present/* windows.

### `src/stores/appConfig.ts`
- **`src/stores/appConfig.ts:52-65`** -> _ARCHITECTURE.md_ — Every appConfig/global write MUST use setDoc(..., {merge:true}), NEVER updateDoc — R182 made an absent doc a valid, expected state (e.g.

### `src/stores/auth.ts`
- **`src/stores/auth.ts:142-153`** -> _ARCHITECTURE.md_ — The organizations the signed-in user belongs to ({id, name, active, role}) — the source the login church-picker AND (Phase 104, R311/R312) the sidebar church switcher render when a user belongs to more than one.
- **`src/stores/auth.ts:296-319`** -> _ARCHITECTURE.md_ — R075 (D-06/D-07) / P-01 — force the custom `orgId`/`role` claim (set by functions/src/orgMembershipClaims.ts's syncOrgMembershipClaim trigger) onto the active session's ID token so a member does not wait out a full 1-hour token lifetime for...
- **`src/stores/auth.ts:414-423`** -> _ARCHITECTURE.md_ — Dual-read migration (R073): nested settings value first, then the legacy flat field, then the hardcoded default.
- **`src/stores/auth.ts:508-519`** -> _ARCHITECTURE.md_ — Bug 1b (quick 260830-l9c) — self-heal a clobbered orgIds array from the authoritative `orgs` custom claim.
- **`src/stores/auth.ts:537-549`** -> _ARCHITECTURE.md_ — Build the membership list ({id, name, active}) the church picker renders. Each org doc is read individually and guarded: an org the user has an orgIds entry for but can't cleanly read (e.g.

### `src/stores/orgScopedStores.ts`
- **`src/stores/orgScopedStores.ts:13-47`** -> _STACK.md_ — Tear down EVERY org-scoped Pinia store — unsubscribe its Firestore listener and clear its cached state — in one call.

### `src/stores/pptxRenders.ts`
- **`src/stores/pptxRenders.ts:7-33`** -> _STACK.md_ — Pinia store for render-status documents (Phase 42, R079/R080) — `organizations/{orgId}/pptxRenders/{importId}`. ★ Genuinely new design (42-PATTERNS.md "No Analog Found").

### `src/stores/quarters.ts`
- **`src/stores/quarters.ts:215-224`** -> _ARCHITECTURE.md_ — D-03/D-05/D-06: single-person quarter-data save from the availability drawer.

### `src/stores/services.ts`
- **`src/stores/services.ts:49-66`** -> _ARCHITECTURE.md_ — R036 — thrown by the store's draft-only write guard (enforcement layer 2 of 3). The guard is defence-in-depth, NOT the primary enforcement: the Firestore rule added in 31-01 is what actually stops a determined client.
- **`src/stores/services.ts:103-114`** -> _ARCHITECTURE.md_ — Read-only public projection of `Service.stageLayout` (R315, Phase 107).
- **`src/stores/services.ts:166-180`** -> _ARCHITECTURE.md_ — Stage layout projection (T-107-01): map to EXACTLY the 6 display fields — id, label, kind, zone, xPct, yPct — never a raw spread of the source marker, so a future non-display StageMarker field cannot silently reach the public page.
- **`src/stores/services.ts:188-192`** -> _ARCHITECTURE.md_ — `note` is planner-authored tech instruction (non-PII free text, e.g. "XLR run from stage left") and belongs on the printed/shared plot the tech team reads.
- **`src/stores/services.ts:359-375`** -> _ARCHITECTURE.md_ — ── R036 draft-only write guard ────────────────────────────────────────────── The three shapes below mirror `firestore.rules`' `/services` `allow update` clause one-for-one.
- **`src/stores/services.ts:380-393`** -> _ARCHITECTURE.md_ — ── R247 (84-01) — lastUsedAt recompute on lock/unlock ────────────────────── A song's lastUsedAt reflects MAX(service.date) over the LOCKED (non-draft) services it's in — never the wall-clock moment it was assigned to a draft (see src/utils...
- **`src/stores/services.ts:481-491`** -> _ARCHITECTURE.md_ — ── R037 status transitions ────────────────────────────────────────────────── D-02: explicit, named actions — one per legal transition — replacing the deleted `toggleStatus` cycle.
- **`src/stores/services.ts:529-539`** -> _INTEGRATIONS.md_ — R037 — reopen a locked service for editing. ★ The payload is `status` + `updatedAt` and NOTHING ELSE.
- **`src/stores/services.ts:575-596`** -> _INTEGRATIONS.md_ — D-15: deliberately NOT guarded. Delete stays available at every status — the UI warns about an orphaned Planning Center plan instead of locking.
- **`src/stores/services.ts:848-867`** -> _ARCHITECTURE.md_ — The `shareTokens/{token}` payload write plus the soft-fail memorable-URL `serviceShares/{slug}__service-{date}` write.
- **`src/stores/services.ts:919-928`** -> _ARCHITECTURE.md_ — R076/R078 — resolves THE one stable token for a service: reading the `serviceShareLinks/{serviceId}` identity doc if it exists, else adopting the most recent compatible already-circulated `shareTokens` document, else minting a fresh one — t...

### `src/stores/slideGroups.ts`
- **`src/stores/slideGroups.ts:22-37`** -> _STACK.md_ — Pinia store for slide groups (Phase 24). Mirrors useImportedSlides / useScriptureSlides (src/stores/importedSlides.ts, src/stores/scriptureSlides.ts) against the organizations/{orgId}/slideGroups sibling collection, with `slides` as an EMBE...

### `src/stores/songLyrics.ts`
- **`src/stores/songLyrics.ts:136-153`** -> _ARCHITECTURE.md_ — Sets or clears the song-level background image (R057) — the least specific tier of the slide/group/song cascade `resolveEntryMedia` resolves.

### `src/stores/toasts.ts`
- **`src/stores/toasts.ts:55-66`** -> _ARCHITECTURE.md_ — The app-wide dismissible-message store (R309/R310), generalized in place from the original narrow failure-toast store (R041).

### `src/types/importedDeck.ts`
- **`src/types/importedDeck.ts:19-29`** -> _STACK.md_ — The Storage-side import id (Phase 37, R062) -- the same crypto.randomUUID() value pptxUpload.ts's generateImportId() produces, which scopes orgs/{orgId}/pptx-imports/{importId}/ and organizations/{orgId}/pptxRenders/{importId}.

### `src/types/organization.ts`
- **`src/types/organization.ts:3-14`** -> _ARCHITECTURE.md_ — A single entry in a church's default service template (R086/R087).
- **`src/types/organization.ts:30-51`** -> _ARCHITECTURE.md_ — Church-level settings stored on `organizations/{orgId}.settings` (R073).
- **`src/types/organization.ts:72-83`** -> _ARCHITECTURE.md_ — Church-defined default set/order of items for a new service (R086/R087).
- **`src/types/organization.ts:93-108`** -> _CONCERNS.md_ — Church's one house font, applied to every slide surface — the Slides grid, the Edit Slide drawer preview, and the presenter (`PresentationViewer.vue`) — via CSS custom properties (R093).
- **`src/types/organization.ts:170-180`** -> _CONCERNS.md_ — LEGACY flat storage location for the Vertical Worship toggle, in use before this phase (Phase 16.1, D-15/D-16).
- **`src/types/organization.ts:197-209`** -> _INTEGRATIONS.md_ — Phase 101 (R295) — the super-admin MASTER gate for the Bible **API** (paid ESV/NLT proxy), NOT scripture features in general — an OFF org still does scripture manually (Phases 102/103).

### `src/types/pptxRender.ts`
- **`src/types/pptxRender.ts:1-18`** -> _ARCHITECTURE.md_ — Client-side render-status type for `organizations/{orgId}/pptxRenders/{importId}` (Phase 42, R079/R080). This is a CONSUMED-FIELDS PROJECTION of the server document defined in `functions/src/index.ts:150-157`, not a wire mirror.

### `src/types/service.ts`
- **`src/types/service.ts:48-59`** -> _ARCHITECTURE.md_ — Slot-level free-text notes (R122, Phase 54). Plain text only — a planner jots who leads / who sings which parts beside the item's selector. Lives on the shared base so `slot.notes` is reachable cast-free on all five slot kinds.
- **`src/types/service.ts:61-76`** -> _ARCHITECTURE.md_ — Per-item Run auto-advance/loop configuration (R306/R307, Phase 106). Lives on the shared base so `slot.loop` is reachable cast-free on all five slot kinds, exactly like `notes` above.
- **`src/types/service.ts:130-140`** -> _INTEGRATIONS.md_ — Optional custom display name for a MISC item (R127, Phase 56).
- **`src/types/service.ts:175-191`** -> _ARCHITECTURE.md_ — A single stage-plot marker (R313/R314/R315, Phase 107). `label` is free text and the source of truth (an owner may label a marker for a one-off speaker's mic); `kind` is an OPTIONAL light visual accent only — never a required constrained pi...
- **`src/types/service.ts:280-298`** -> _STACK.md_ — Visual stage plot for tech/sound (R313/R314/R315, Phase 107). Additive, optional, no-migration — mirrors `messaging`/`notes`/`loop`'s lifecycle exactly: absent on every service written before this field existed (old behavior, no backfill ne...

### `src/types/slide.ts`
- **`src/types/slide.ts:1-12`** -> _ARCHITECTURE.md_ — Unified Slide type with contentKind discriminator. S01 defines 'lyric' only; later slices add 'scripture', 'imported', 'text', 'image', and 'video'.
- **`src/types/slide.ts:20-29`** -> _ARCHITECTURE.md_ — Render carrier for attached audio (Phase 22 R013/R014, refactored Phase 24 D-04).
- **`src/types/slide.ts:54-65`** -> _ARCHITECTURE.md_ — Phase 42 (R079/R080) render-state discriminator for a slide sourced from a PPTX deck whose server-side render (`organizations/{orgId}/pptxRenders/ {importId}`) has not yet produced a usable page for it.
- **`src/types/slide.ts:67-76`** -> _ARCHITECTURE.md_ — The raw machine slug copied unchanged off the render document's own `failureReason` (e.g. `'incomplete-render'`, `'render-service-error'`). Present only alongside `renderState: 'failed'`.
- **`src/types/slide.ts:109-118`** -> _INTEGRATIONS.md_ — R092 (Phase 45): which Bible translation this section's text was fetched from, stamped ONCE by `CongregationalEditor.vue` at fetch time from the church's CURRENT `bibleVersion` setting.
- **`src/types/slide.ts:203-214`** -> _ARCHITECTURE.md_ — A blackout slide — an authored inline black interlude (R302/R303, 105-CONTEXT.md).

### `src/types/slideGroup.ts`
- **`src/types/slideGroup.ts:54-63`** -> _ARCHITECTURE.md_ — Opaque signature of the source content this group was last rebuilt against.
- **`src/types/slideGroup.ts:97-164`** -> _ARCHITECTURE.md_ — Discriminated union of every kind of content a `GroupSlideEntry` can point at, narrowed on `kind`.

### `src/types/songLyrics.ts`
- **`src/types/songLyrics.ts:3-13`** -> _ARCHITECTURE.md_ — A single section of song lyrics (e.g. Verse 1, Chorus). A member of the canonical POOL (`SongLyrics.sections` / `ParsedCCLI.sections`) — each `id` appears at most once across a document's pool.
- **`src/types/songLyrics.ts:31-41`** -> _ARCHITECTURE.md_ — Optional content kind (Phase 105, R302/R303/R304). Absent means 'lyric' - every section persisted before this phase, and every section minted by the normal `addSection` path, carries no `kind` field at all (additive, no migration).

### `src/utils/claudeApi.ts`
- **`src/utils/claudeApi.ts:165-178`** -> _INTEGRATIONS.md_ — Classifies and logs a failed proxied AI call. Phase 65's cost controls (R161/R162) mean the proxy can now legitimately reject a request with HTTP 429 (per-uid rate/cost limit exceeded) or HTTP 400 (disallowed model / server-side policy reje...
- **`src/utils/claudeApi.ts:444-462`** -> _ARCHITECTURE.md_ — The structural contract the model is allowed to speak — nothing else.

### `src/utils/congregationalText.ts`
- **`src/utils/congregationalText.ts:1-10`** -> _ARCHITECTURE.md_ — Pure, testable text<->sections conversion for the `---`-delimited congregational-reading editor (supersedes Phase 47's click-between-verses divider model per owner feedback: the divider UX was unintuitive). The editor is a plain textarea.
- **`src/utils/congregationalText.ts:32-43`** -> _ARCHITECTURE.md_ — Parse `---`-delimited textarea content into congregational sections. - Chunks are split on lines that are exactly `---`. - An empty (whitespace-only) chunk is skipped.

### `src/utils/firestoreListener.ts`
- **`src/utils/firestoreListener.ts:1-10`** -> _ARCHITECTURE.md_ — Bug 2b (quick 260830-l9c) — shared onSnapshot error-handling helper. A handful of Firestore snapshot listeners only unsubscribe on view unmount, which happens AFTER the router redirects to /login on sign-out.

### `src/utils/importedRenderReconciler.ts`
- **`src/utils/importedRenderReconciler.ts:239-261`** -> _ARCHITECTURE.md_ — R108 (Phase 50, part 2 of 2 — CONSUME the page): an imported deck's slides can be manually added into ANOTHER slot's group (e.g. a Prayer group, alongside auto-generated slides).
- **`src/utils/importedRenderReconciler.ts:281-308`** -> _ARCHITECTURE.md_ — Cheap change-detection proxy for the IMPORTED slot kind, mirroring `slideGroupMaterializer.ts`'s `sourceSignature` contract for every other slot kind.

### `src/utils/lastUsed.ts`
- **`src/utils/lastUsed.ts:1-27`** -> _ARCHITECTURE.md_ — Canonical last-used-date derivation (R247/R248, Phase 84). Pure and framework-free — NO firebase, NO vue imports — so this module can be copied verbatim into `functions/src/backfillLastUsed.ts` (84-02).

### `src/utils/messaging.ts`
- **`src/utils/messaging.ts:3-18`** -> _STACK.md_ — ─── Messaging Toggle Guard ───────────────────────────────────────────────── Single shared choke point for the org-level volunteer-email messaging kill switch (`authStore.settings.messaging.enabled`, R130).

### `src/utils/messagingRecipients.ts`
- **`src/utils/messagingRecipients.ts:35-50`** -> _ARCHITECTURE.md_ — Resolves a { teams, individualPersonIds, includeEveryone } selection into deduped (by person id), reachability-split recipient lists.

### `src/utils/monitorConfig.ts`
- **`src/utils/monitorConfig.ts:137-148`** -> _ARCHITECTURE.md_ — Decides whether a saved mapping can be silently reused against the CURRENT live screens, or whether a genuine layout change requires re-prompting (R268).

### `src/utils/nltApi.ts`
- **`src/utils/nltApi.ts:3-15`** -> _INTEGRATIONS.md_ — Fetches an NLT passage and returns it reformatted into the exact `[N] text` bracketed-verse-number convention `scriptureSplitter.ts::parseVerses` (and, transitively, `scriptureBoundaries.ts::computeBoundaries`'s VERSE_MARKER_PATTERN) depend...
- **`src/utils/nltApi.ts:64-92`** -> _INTEGRATIONS.md_ — Parses NLT's HTML response with native `DOMParser` and reduces it to plain `[N] text` verse strings joined with a single space.

### `src/utils/orgName.ts`
- **`src/utils/orgName.ts:5-15`** -> _ARCHITECTURE.md_ — Normalize an organization display name into a stable, Firestore-doc-id-safe uniqueness KEY (for the `orgNames/{key}` registry).
- **`src/utils/orgName.ts:27-37`** -> _ARCHITECTURE.md_ — Claim a unique org name via a create-only write against `orgNames/{nameKey}`, mirroring `claimSlug`'s `orgSlugs` pattern (the rule denies any overwrite, so a create against an existing doc fails permission-denied).

### `src/utils/pcSongImport.ts`
- **`src/utils/pcSongImport.ts:252-264`** -> _ARCHITECTURE.md_ — Split mapped PC songs into "new" (not yet in the library) and "already-imported" (matches an existing song) based on the shared triple-key matching rule: pcSongId (exact) OR ccliNumber (exact, non-empty) OR title (case-insensitive).

### `src/utils/planningCenterApi.ts`
- **`src/utils/planningCenterApi.ts:1091-1101`** -> _ARCHITECTURE.md_ — Exhaustiveness backstop (R085). Binds on `slot.kind` rather than `slot` itself: PRAYER/ANNOUNCEMENTS/MISC/MESSAGE all share the single `NonAssignableSlot` interface (one object type, a 4-literal `kind` union), and TypeScript's control-flow...

### `src/utils/pptxUpload.ts`
- **`src/utils/pptxUpload.ts:4-20`** -> _CONCERNS.md_ — Client-side upload helpers for the PPTX/image import flow (Phase 21, R010/R011). Uploads always land under orgs/{orgId}/pptx-imports/{importId}/...
- **`src/utils/pptxUpload.ts:25-44`** -> _ARCHITECTURE.md_ — 25MB — the SAME ceiling `storage.rules` enforces on the generic `orgs/{orgId}/{allPaths=**}` match (`request.resource.size < 26214400`), which is the match `pptx-imports/` falls into. ★ These two numbers must stay in lockstep.
- **`src/utils/pptxUpload.ts:47-56`** -> _ARCHITECTURE.md_ — Thrown when a file exceeds PPTX_MAX_BYTES. A distinct class rather than a bare Error because `PptxImportModal.vue`'s catch block replaces every failure with one generic "we couldn't read this file" message.
- **`src/utils/pptxUpload.ts:69-79`** -> _ARCHITECTURE.md_ — Narrows an unknown caught value to a too-large error, by NAME rather than `instanceof`. Callers live in components whose tests `vi.mock` this module with a full-replacement factory.

### `src/utils/quarterDates.ts`
- **`src/utils/quarterDates.ts:25-42`** -> _ARCHITECTURE.md_ — R038 / D-12 / D-13: the nearest FUTURE Sunday that does not already have a plan.

### `src/utils/renderedPagePaths.ts`
- **`src/utils/renderedPagePaths.ts:1-22`** -> _ARCHITECTURE.md_ — Client-side rendered-page Storage-path convention (Phase 42, R079/R080).

### `src/utils/rotationTable.ts`
- **`src/utils/rotationTable.ts:9-22`** -> _ARCHITECTURE.md_ — Computes a rotation table from an array of services. For each song that appears in at least one service, returns an entry with the song's ID, title, and the ISO date strings of services where it appears.

### `src/utils/runChannel.ts`
- **`src/utils/runChannel.ts:1-25`** -> _STACK.md_ — Run-mode control->output message protocol (Phase 91, consumed by Phases 92-96's multi-window Run mode).

### `src/utils/scheduler.ts`
- **`src/utils/scheduler.ts:12-29`** -> _ARCHITECTURE.md_ — Pure group co-occurrence rule (D-10, derived purely from group + the multi-role flag, NOT configurable).
- **`src/utils/scheduler.ts:283-293`** -> _ARCHITECTURE.md_ — Only 'regular'-tier people are auto-scheduled. 'fillin'-tier is manual-only — the coordinator fills those gaps by hand (there is intentionally NO last-resort fillin auto-fill), and 'out'-tier is excluded for the whole quarter.

### `src/utils/scripture.ts`
- **`src/utils/scripture.ts:106-119`** -> _INTEGRATIONS.md_ — R298: BibleGateway deep-link for a reference, usable with ANY version — the manual fallback when an org's Bible API is off.
- **`src/utils/scripture.ts:192-209`** -> _INTEGRATIONS.md_ — The canonical human-readable form of a reference: "Romans 8:1-11", "Romans 8:28", or "Romans 8".
- **`src/utils/scripture.ts:218-230`** -> _INTEGRATIONS.md_ — R047: a SCRIPTURE slot's OWN reference fields are the slide's source.
- **`src/utils/scripture.ts:245-266`** -> _ARCHITECTURE.md_ — R064/D1: the ONE congregational-ness predicate on the SLOT side — which sections seed a Reference -> Congregational conversion (`deriveGroupEntries` SCRIPTURE case) and, once seeded, which sections a rebuild diffs the stored signature again...
- **`src/utils/scripture.ts:274-284`** -> _ARCHITECTURE.md_ — R064/D1: the mirror predicate on the ENTRY side — the ONLY place any consumer decides whether a stored `GroupSlideEntry` is a congregational section slide (`resolveEntryContent`'s scripture case, and `rebuildScriptureGroup`'s cleared-refere...
- **`src/utils/scripture.ts:313-324`** -> _INTEGRATIONS.md_ — R092: the ONE field-less-fallback decision point for translation provenance.
- **`src/utils/scripture.ts:329-345`** -> _ARCHITECTURE.md_ — Writes a new reference onto a `ScriptureSlot` (the same four-field spread `ServiceEditorView.onScriptureChange` performs inline today) and owns ONE additional rule: a stored congregational reading is never carried onto a passage it was not...

### `src/utils/scriptureApi.ts`
- **`src/utils/scriptureApi.ts:19-43`** -> _INTEGRATIONS.md_ — ─── Dispatcher ────────────────────────────────────────────────────────────── The single client-side choke point for scripture-passage fetches — the `isAiEnabled()` analog for the Bible API (Phase 102, R296/R297).

### `src/utils/scriptureBoundaries.ts`
- **`src/utils/scriptureBoundaries.ts:1-15`** -> _INTEGRATIONS.md_ — Pure functions computing and using the "legal boundary index" contract that makes AI-assisted congregational-reading splitting structurally safe (R064).
- **`src/utils/scriptureBoundaries.ts:76-85`** -> _ARCHITECTURE.md_ — Produces a model-facing copy of `text` with a `⟦i⟧` marker inserted immediately before the character at `boundaries[i]`, for every boundary.
- **`src/utils/scriptureBoundaries.ts:100-110`** -> _INTEGRATIONS.md_ — THE ENCODING BACKSTOP. This is the byte-exactness guarantee at the core of R064: it performs exactly one `String.prototype.slice` call against the untouched source and nothing else.

### `src/utils/serviceLockDiff.ts`
- **`src/utils/serviceLockDiff.ts:1-19`** -> _CONCERNS.md_ — Pure service-lock diff + slide-group fingerprint (Phase 62, R146/R147).
- **`src/utils/serviceLockDiff.ts:141-153`** -> _ARCHITECTURE.md_ — PURE diff of two locked ServiceSnapshots plus their two slide fingerprint maps.

### `src/utils/serviceSlots.ts`
- **`src/utils/serviceSlots.ts:1-17`** -> _STACK.md_ — The slotIndex <-> first-assembled-slide-index lookup (Phase 91, consumed by the Run rail in Phases 92-96).

### `src/utils/shareTokens.ts`
- **`src/utils/shareTokens.ts:1-23`** -> _STACK.md_ — R078 — share-token minting and adoption selection, extracted into a pure module so both decisions ("what does a freshly-minted token look like" and "which of several already- circulated tokens is the one to adopt") can be proven exhaustivel...
- **`src/utils/shareTokens.ts:42-57`** -> _ARCHITECTURE.md_ — Coerces any timestamp shape a `shareTokens` document can actually carry in this codebase into milliseconds, without ever throwing and without ever returning `NaN` (a `NaN` leaking into a comparator would silently destroy sort order rather t...
- **`src/utils/shareTokens.ts:89-107`** -> _ARCHITECTURE.md_ — Selects which already-circulated `shareTokens` document to adopt for a service, or `null` when there is nothing adoptable (the caller mints instead). Three steps, in this order — the order matters: 1.

### `src/utils/slideGroupMaterializer.ts`
- **`src/utils/slideGroupMaterializer.ts:36-50`** -> _ARCHITECTURE.md_ — Derives a slide group's structure from its slot's canonical source.
- **`src/utils/slideGroupMaterializer.ts:83-102`** -> _ARCHITECTURE.md_ — R047/D1: no reference means no slides, exactly as before. Once a reference exists, the group has exactly two possible shapes — never a mix — decided by `congregationalSectionsFromSlot`, R064's ONE congregational-ness predicate: - Reference...
- **`src/utils/slideGroupMaterializer.ts:199-214`** -> _INTEGRATIONS.md_ — R047/D1: the slot's reference is always the base of the signature.
- **`src/utils/slideGroupMaterializer.ts:232-243`** -> _ARCHITECTURE.md_ — D-09: `importedSourceSignature` folds in BOTH the resolved mode and, for a ready render, the page count — a re-render that changes the count while staying `ready` therefore produces a different signature.
- **`src/utils/slideGroupMaterializer.ts:277-299`** -> _ARCHITECTURE.md_ — True when an entry's `sourceRef` is something THIS SLOT's own derivation could have produced — i.e. the entry is source-derived and the rebuild owns it. Everything else on the group is user work.
- **`src/utils/slideGroupMaterializer.ts:317-330`** -> _ARCHITECTURE.md_ — The one place any rebuild path decides what a user added by hand — every stored entry this slot's own derivation could not have produced, in stored order.
- **`src/utils/slideGroupMaterializer.ts:335-359`** -> _ARCHITECTURE.md_ — The content-stable identity a stored entry of an unstable-id kind (scripture, imported) is matched against by `carryStoredDerivedEntries`.
- **`src/utils/slideGroupMaterializer.ts:379-411`** -> _ARCHITECTURE.md_ — Re-sorts a rebuilt slide list into the group's STORED order (BL-02, Phase 30 review). The stored order is the USER's: `SlideGrid.vue` offers drag-reorder on every non-song group, and the drop paths append at a user-chosen position.
- **`src/utils/slideGroupMaterializer.ts:458-490`** -> _ARCHITECTURE.md_ — Generalized survival+carry for the two unstable-id source kinds (scripture, imported deck) — the exact positional-consumption-plus-last-occurrence- surplus shape `rebuildSongGroup`'s additive merge already uses for lyric sections (28-03's f...
- **`src/utils/slideGroupMaterializer.ts:530-552`** -> _ARCHITECTURE.md_ — R047 (HI-01): surplus is meaningful only for kinds with real fresh-side multiplicity.
- **`src/utils/slideGroupMaterializer.ts:656-681`** -> _ARCHITECTURE.md_ — Phase 26-09 Task 1 + Plan 28-03 (D-02): indexed as an ARRAY per sectionId, never collapsed to a single entry, and consumed POSITIONALLY below rather than re-emitted wholesale.
- **`src/utils/slideGroupMaterializer.ts:796-816`** -> _ARCHITECTURE.md_ — Unconditional rebuild for the two unstable-id source kinds (scripture, imported deck).
- **`src/utils/slideGroupMaterializer.ts:830-886`** -> _ARCHITECTURE.md_ — Scripture inner slide ids are purely positional (`id: \`scripture-${position}\``, minted in `src/utils/scriptureSplitter.ts::buildSlide`) and are reassigned wholesale by every re-split of the passage — there is no content-stable key to diff...

### `src/utils/slideTypography.ts`
- **`src/utils/slideTypography.ts:3-13`** -> _ARCHITECTURE.md_ — Pure, independently-testable slide-typography helpers (46-RESEARCH.md Pattern 1-3).
- **`src/utils/slideTypography.ts:70-79`** -> _ARCHITECTURE.md_ — Computes the three `--slide-font-*` CSS custom properties from a stored (or possibly undefined/tampered) `slideTypography` value.
- **`src/utils/slideTypography.ts:145-167`** -> _STACK.md_ — On-demand loader for a non-eager curated family (RESEARCH's "bundle strategy": only the org's chosen default face is eager-imported in `main.ts`; the other five curated families load lazily when previewed in Settings — 46-03 — or requested...

### `src/utils/slideshowAssembler.ts`
- **`src/utils/slideshowAssembler.ts:58-68`** -> _ARCHITECTURE.md_ — Phase 42 (R079/R080) render-status documents, keyed by `ImportedDeck.renderImportId` — NOT by `ImportedDeck.id`/ `ImportedSlot.importId`, which is what the sibling `importedDecksById` above is keyed by.
- **`src/utils/slideshowAssembler.ts:70-79`** -> _ARCHITECTURE.md_ — Phase 42 (R079/R080) resolved rendered-page download URLs, keyed by `ImportedDeck.renderImportId` (same keying caveat as `pptxRendersByImportId` above — NOT `ImportedDeck.id`).
- **`src/utils/slideshowAssembler.ts:87-96`** -> _ARCHITECTURE.md_ — R105 (Phase 49): the SINGLE producer of reference-only scripture slide content — a plain scripture reference slide AND the dedicated leading reference slide of a congregational reading are byte-identical by construction (AC3).
- **`src/utils/slideshowAssembler.ts:217-230`** -> _ARCHITECTURE.md_ — D1/D2: `congregationalSectionFromRef` is the ONE place this function decides which of the group's two states `entry` belongs to.

### `src/utils/slotTypes.ts`
- **`src/utils/slotTypes.ts:189-213`** -> _ARCHITECTURE.md_ — Groups any section-bearing collection into `SERVICE_SECTIONS`-ordered buckets, plus a trailing `legacy` bucket for members whose section is absent or not a recognized `SERVICE_SECTIONS` member (D005).
- **`src/utils/slotTypes.ts:250-265`** -> _ARCHITECTURE.md_ — Composition of `groupBySection` + `flattenBySection` over `slot.section` — the one source of truth for "what order are the slots in," shared by the rendered grouping and the array that gets persisted, so the two can never disagree.
- **`src/utils/slotTypes.ts:274-293`** -> _CONCERNS.md_ — Backfills a missing `ServiceSlot.id` (D-01) for services read before this field existed.
- **`src/utils/slotTypes.ts:306-318`** -> _ARCHITECTURE.md_ — Default position -> section mapping for the M001 progression template (D005).
- **`src/utils/slotTypes.ts:391-419`** -> _ARCHITECTURE.md_ — Builds a new service's `ServiceSlot[]` from the church's stored `defaultServiceTemplate` (R086/R087). Composes `progressionVwTypeSequence`, `createSlot`, and `reindexSlots` — no duplicated logic.
- **`src/utils/slotTypes.ts:440-452`** -> _STACK.md_ — Builds the Suggested Template's `ServiceTemplateEntry[]` — the single shared definition of the suggested-template content (R114 button `applyReset` in plan 52-02 and the R115 `createService` empty-template fallback BOTH call this, so the pr...

### `src/utils/songSearch.ts`
- **`src/utils/songSearch.ts:82-93`** -> _ARCHITECTURE.md_ — Multi-term AND search over a song's metadata. Supports field-scoped prefixes (`type:`, `key:`, `tag:`, `theme:`, `team:`, with optional space after the colon) whose value may contain multiple words (e.g.
- **`src/utils/songSearch.ts:131-141`** -> _ARCHITECTURE.md_ — Filters a song list by the shared per-tag Show/Hide include/exclude sets (D-08/D-09/D-10, R240 extraction). Both sets empty returns `songs` unchanged.

### `src/utils/songSectionOrder.ts`
- **`src/utils/songSectionOrder.ts:3-14`** -> _ARCHITECTURE.md_ — PURE module — imports only types from `@/types/songLyrics`. No Vue, no store, no Firestore. Mirrors the purity contract of `slideshowAssembler.ts`.
- **`src/utils/songSectionOrder.ts:166-178`** -> _ARCHITECTURE.md_ — Slices a section's `lines` into consecutive slide line-groups at its `slideBreaks` (R117).
- **`src/utils/songSectionOrder.ts:198-213`** -> _ARCHITECTURE.md_ — Enforces the pool/order invariants over a (sections, order) pair: - the pool is de-duplicated by id, keeping the first occurrence; - order ids with no pooled section are dropped; - if the surviving order is empty while the pool is not, the...
- **`src/utils/songSectionOrder.ts:413-436`** -> _ARCHITECTURE.md_ — Normalises freshly-parsed CCLI sections into the pool/order model.

### `src/utils/stageLayout.ts`
- **`src/utils/stageLayout.ts:3-19`** -> _STACK.md_ — Pure geometry + kind-registry helpers for the visual stage layout (R313/R314, Phase 107; redesigned to the single-room "Nocturne" diagram).

### `src/utils/stripUndefined.ts`
- **`src/utils/stripUndefined.ts:1-11`** -> _ARCHITECTURE.md_ — Recursively remove properties whose value is `undefined` so the result is safe to write to Firestore, which rejects any `undefined` field value at any depth with "Unsupported field value: undefined (found in document ...)".

### `src/utils/suggestions.ts`
- **`src/utils/suggestions.ts:14-29`** -> _ARCHITECTURE.md_ — Returns songs ranked for a given slot. Every song is always eligible — there is no hard team filter (D-03).

### `src/utils/teamRecurrence.ts`
- **`src/utils/teamRecurrence.ts:1-19`** -> _ARCHITECTURE.md_ — Nth-Sunday-of-month recurrence matching (R254/R255, Phase 86).

### `src/views/ServiceEditorView.vue`
- **`src/views/ServiceEditorView.vue:2044-2057`** -> _INTEGRATIONS.md_ — D-15 — Delete stays available at every status, but must not stay un-warned. The reasoning that justifies NO friction on Reopen runs the opposite way here: reopening is reversible, deleting is not.
- **`src/views/ServiceEditorView.vue:2087-2102`** -> _ARCHITECTURE.md_ — Handles the "Set up congregational reading" request (relabelled from "Edit scripture text" on 2026-08-05 — see slideDisplay.ts) relayed up through SlidesTab's `navigate-to-scripture-editor` event (T-26-03-01: the index is validated against...
- **`src/views/ServiceEditorView.vue:2173-2182`** -> _ARCHITECTURE.md_ — ── Computed: editing guard ───────────────────────────────────────────────────── ── R036 / R037 — the lifecycle lock seams ──────────────────────────────────── `isLocked` widened the retired `isExportedLocked` (`=== 'exported'`) to `!== 'dr...
- **`src/views/ServiceEditorView.vue:2225-2235`** -> _INTEGRATIONS.md_ — ★ D-04 — the Planning Center warning gates on EVIDENCE, never on the status string.
- **`src/views/ServiceEditorView.vue:2271-2281`** -> _ARCHITECTURE.md_ — ── Sections (D005/R007/R043/R044) + live slideshow assembly (R005/R006 visible) ─ `{ slot, index }` pairs (index = the slot's ABSOLUTE position in `localService.slots`) grouped into `SERVICE_SECTIONS`-ordered buckets plus a trailing `legacy...
- **`src/views/ServiceEditorView.vue:2431-2449`** -> _ARCHITECTURE.md_ — R036 — whether this session may write slide-group documents at all. ★ This is NOT only a UI concern, and narrowing it is not optional. The `/slideGroups` Firestore rule rejects every write whose parent service is not draft.
- **`src/views/ServiceEditorView.vue:2495-2509`** -> _STACK.md_ — ── Sortable ─────────────────────────────────────────────────────────────────── One Sortable instance PER SECTION list container (29-03/R044) — this codebase's first multi-instance Sortable and first use of SortableJS `group` (cross-section...
- **`src/views/ServiceEditorView.vue:2571-2583`** -> _STACK.md_ — R110: reclaim any node SortableJS physically relocated across containers.
- **`src/views/ServiceEditorView.vue:2711-2723`** -> _ARCHITECTURE.md_ — 36-03 (R068) — the page-header's per-tab action list, replacing the four unconditional buttons that used to render regardless of `activeTab`.
- **`src/views/ServiceEditorView.vue:2988-2998`** -> _ARCHITECTURE.md_ — ── Autosave failure handling ──────────────────────────────────────────────── BL-02 — a rejected autosave must leave the view USABLE, never stranded at 'saving'.
- **`src/views/ServiceEditorView.vue:3225-3237`** -> _ARCHITECTURE.md_ — R247 (84-01) — `lastUsedAt` for a service's scheduled songs is now recomputed by `serviceStore.markAsPlanned` itself (lock-gated `MAX(locked service date)`, see `src/utils/lastUsed.ts`), not by a view-level `serverTimestamp()` stamp.
- **`src/views/ServiceEditorView.vue:3262-3277`** -> _ARCHITECTURE.md_ — R247 (84-01) — the `lastUsedAt` recompute for this service's scheduled songs already happened inside `serviceStore.markAsPlanned` above, gated on the service's locked date.
- **`src/views/ServiceEditorView.vue:3475-3487`** -> _ARCHITECTURE.md_ — ── Dynamic slot add/remove ──────────────────────────────────────────────────── Per-band assembled-slide count for a section-band header's "{n} slides" caption (36-04, UI-SPEC §9).
- **`src/views/ServiceEditorView.vue:3890-3902`** -> _ARCHITECTURE.md_ — ── Scripture ────────────────────────────────────────────────────────────────── ME-02: the canonical primitive, not a private four-field variant.
- **`src/views/ServiceEditorView.vue:4089-4101`** -> _INTEGRATIONS.md_ — ME-01 — pre-flight against the STORED status, before any Planning Center work.
- **`src/views/ServiceEditorView.vue:4762-4771`** -> _ARCHITECTURE.md_ — ★ 31-PATTERNS § 4a row 24 (BL-02). 31-04-SUMMARY recorded the decision to leave this ungated because "the store guard already refuses it" — but this phase made that refusal a THROW, so an ungated `onSave` is not a harmless no-op, it is a re...

### `src/views/serviceEditorActionBar.ts`
- **`src/views/serviceEditorActionBar.ts:1-52`** -> _INTEGRATIONS.md_ — serviceEditorActionBar.ts — the pure per-tab item builder behind R068 (36-02 Task 2). `buildActionBarItems(tab, ctx)` turns `ServiceEditorView.vue`'s header state into the declarative list `ContextualActionBar.vue` renders.
- **`src/views/serviceEditorActionBar.ts:129-140`** -> _INTEGRATIONS.md_ — Owner follow-up (post-36-02): returns `undefined` — no item at all — when there are no Planning Center credentials, instead of the `copy-pc` fallback button this used to build.

### `storage.rules`
- **`storage.rules:3-21`** -> _ARCHITECTURE.md_ — Org-scoped Storage access control, mirroring firestore.rules' isOrgMember pattern.
- **`storage.rules:24-43`** -> _INTEGRATIONS.md_ — Reads request.auth.token.orgId / .role — a direct JWT claim read set server-side by Cloud Function syncOrgMembershipClaim (functions/src/orgMembershipClaims.ts, phase 40-02) via the Admin SDK, plus the one-off backfill.

_Bucket B total: 309 entries._

## Bucket C — Genuinely-Local

Load-bearing but inherently tied to one exact call site — removing the comment loses information, but the information has no cross-cutting relevance beyond that one spot, so it stays in the code rather than relocating to a `.planning/codebase/` map doc or an ADR.

### `src/components/slides/SlideCard.vue`
- **`src/components/slides/SlideCard.vue:222-231`** — CSS custom-property + font-family style for this card's own root (46-04, R093) — computed once by `SlideGrid.vue` from `cssVarsFor(authStore.settings.slideTypography)` and passed down rather than read from the store here: this component sti...

### `src/components/slides/SlidePlanRail.vue`
- **`src/components/slides/SlidePlanRail.vue:106-115`** — R036 — used ONLY to swap the empty-state body copy. This rail renders no mutation control at all (D-06: no drag handle, no drop handler), so the lock has nothing else to close here.

### `src/utils/planningCenterApi.ts`
- **`src/utils/planningCenterApi.ts:226-231`** — Create a new plan in Planning Center. Returns the plan ID. Note: PC API only allows title, public, series_title, reminders_disabled on creation. Dates and templates must be handled separately.

### `src/views/ServiceEditorView.vue`
- **`src/views/ServiceEditorView.vue:3539-3548`** — ── Per-kind badge tint (260811-vsr / DESIGN-SPEC) ────────────────────────────── kindBadgeClass now lives in @/utils/slotTypes (Phase 57 — shared by both the service editor and the template editor so their per-kind badge tints can never for...

### `src/views/SettingsView.vue`
- **`src/views/SettingsView.vue:673-676`** — ── Messaging kill-switch + automatic email defaults state (R130/R132, Phase 58) ── IMPORTANT: seeded from authStore.settings.messaging.enabled, which resolves to `false` for a fresh org via DEFAULT_ORG_SETTINGS — the one deliberate divergen...

_Bucket C total: 5 entries._

### Excluded as not load-bearing (trivial JSDoc restatement)

The untagged scan's grep patterns also surfaced a few pure `@param`/`@returns` function-doc blocks with no rationale content — trivial restatements per this plan's own exclusion rule, not load-bearing, and not classified into any bucket:
- `src/utils/pcSongImport.ts:43`
- `src/utils/pcSongImport.ts:211`
- `src/utils/pcSongImport.ts:292`
