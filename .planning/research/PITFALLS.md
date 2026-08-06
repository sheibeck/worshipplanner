# Pitfalls Research: v1.5 Settings, Sharing, and Fidelity

**Domain:** Adding settings/sharing/fidelity features to a shipped Vue 3 + Firebase church-planning
app with real production data and a live congregation-facing share surface.
**Researched:** 2026-08-06
**Confidence:** HIGH for codebase-grounded findings (read directly from `src/`, `functions/src/`,
`firestore.rules`, `storage.rules`, `.planning/PROJECT.md`, `.planning/STATE.md`); HIGH for Firebase
custom-claims mechanics (cross-checked against `firebase.google.com/docs/auth/admin/custom-claims`
directly, two independent passes).

This milestone's own scoping record already contains one production incident (`storage.rules`
deny-everyone, fixed by IAM grant 2026-08-06) and one previously-mislabelled test (see CLAUDE.md).
Every pitfall below is written against that backdrop — not generic security/mobile advice.

---

## Critical Pitfalls

### Pitfall 1: Custom auth claims lock out signed-in users, or silently under-authorize them

**What goes wrong:**
Moving org membership onto a Firebase custom claim (`request.auth.token.orgId` /
`request.auth.token.role` in rules, in place of `firestore.exists()`/`get()`) touches every
existing session at once. The specific ways this fails in production, all confirmed against
Firebase's documented behavior:

- **1000-byte payload ceiling.** `setCustomUserClaims()` throws if the JSON-serialized claims
  object exceeds 1000 bytes. This app's own `users/{uid}.orgIds` field is already an **array** —
  `auth.ts:86` reads `userData?.orgIds ?? []` and `loadOrgContext` picks `ids[0]` — so a user who
  belongs to more than one org (the schema already allows it; only the UI never exercises it) needs
  more than a single `{orgId, role}` pair encoded. A naive `{ orgs: { <20-char-orgId>: 'editor', ... } }`
  map hits the ceiling at a handful of orgs. Design the claim shape (short org keys, or a capped
  list, or a single "active org" claim with per-org checks staying in Firestore for anyone in >1
  org) *before* writing the Cloud Function, not after the first `auth/claims-too-large` error in
  production.
- **Claims are stale until the ID token refreshes** — normally up to one hour, and the Firebase SDK
  does not proactively refresh just because Firestore data changed. A member added to an org (or
  promoted editor→admin, or removed) will not see the new claim take effect until: (a) their token
  naturally refreshes, (b) they sign out/in, or (c) the client explicitly calls
  `getIdToken(true)`/`getIdTokenResult(true)`. **Every existing signed-in tab, right now, has zero
  claim.** If a rule is written as `isOrgMember(orgId)` → "has the claim," every currently-open
  session fails every check the instant that rule deploys, until each tab force-refreshes.
- **The backfill can miss users.** A one-time Cloud Function that iterates `organizations/*/members/*`
  and calls `setCustomUserClaims` per uid is a full collection-group scan with pagination, retry, and
  idempotency concerns of its own — an interrupted run silently leaves a subset of users claim-less.
  There is no current collection-group query anywhere in `src/` to reuse (grep confirmed no
  `collectionGroup('members')` usage today) — this is new code, unexercised by any existing pattern.
- **A client can read but never trust its own claims.** `request.auth.token.role` inside
  `firestore.rules`/`storage.rules` is authoritative because only the Admin SDK can set it; but
  `getIdTokenResult()` output in the browser is just as trustable as any other server-issued value —
  the *bug* to avoid is writing app logic that trusts *Firestore-stored* role fields (which the
  client itself can write, per the existing `isOrgEditor` `write` grant on the `members/{uid}` doc)
  as if they were the claim. The two must not silently diverge: a member's Firestore `role` field
  and their claim's `role` need one write path, not two.
- **Membership changes need a claims refresh path, not a fire-and-forget `setCustomUserClaims` call.**
  If `setCustomUserClaims` runs but nothing tells the client to refresh, the client's *current*
  claim (from up to an hour ago) can be more permissive than intended — e.g. a removed member keeps
  write access to Storage for up to an hour after removal, or (worse for this app) a demoted editor
  keeps editor-level Firestore rule access even though the UI now hides editor controls.

**Why it happens:**
Custom claims look like a drop-in replacement for a Firestore membership check, but they are a
*second, independently-cached* copy of the same fact with its own propagation delay. Teams that have
only ever used Firestore rules (synchronous, always current as of the write) underestimate the
staleness window because nothing in local dev (where tokens are freshly minted every session) ever
exposes it.

**How to avoid — the safe rollout order:**
1. **Design the claim shape against the 1000-byte ceiling first**, explicitly handling the
   multi-org case the schema already permits (`orgIds` array). Prefer a *minimal* claim — e.g. just
   `{ o: [orgId, ...], r: { [orgId]: 'e'|'a' } }` with short keys — over embedding anything that
   isn't needed by a rule. If the true byte math is still tight, fall back to "claims cover the
   *first N* orgs, `firestore.exists()`/Firestore reads cover the rest" rather than erroring.
2. **Dual-read rules before cutover.** Change `isOrgMember(orgId)`/`isOrgEditor(orgId)` in BOTH
   `firestore.rules` and `storage.rules` to `OR` the claim and the existing `exists()`/`get()` check
   — never AND, never claim-only — for at least one full deploy cycle:
   ```
   function isOrgMember(orgId) {
     return isSignedIn() && (
       orgId in request.auth.token.get('orgIds', []) ||
       exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid))
     );
   }
   ```
   This is the only rollout order that cannot lock anyone out: a stale/absent claim simply falls
   through to the check that has worked in production since v1.0.
3. **Backfill via a Cloud Function, idempotent and resumable** (checkpoint the last processed uid;
   safe to re-run). Verify completion by comparing count of claims-set users against count of
   distinct `organizations/*/members/*` docs — not by "the function returned 200."
2. **Write path unification.** Every place that changes a member's role or removes a member
   (`isOrgEditor` writes to `members/{uid}`) must, in the same transaction/trigger, call
   `setCustomUserClaims` — via a Firestore-triggered Cloud Function (`onDocumentWritten` on
   `organizations/{orgId}/members/{uid}`), not a client-invoked callable, so a client can never skip
   the claim update.
3. **Force-refresh on the client after a relevant write.** Mirror the pattern Firebase's own docs
   recommend: the member doc write already triggers `onSnapshot` listeners in this app
   (`auth.ts` subscribes to the member doc) — on a role/removal change observed via that listener,
   call `getIdToken(true)` proactively so the *acting* user's own session (if they changed their own
   membership, e.g. leaving an org) doesn't run on a stale token for up to an hour. This does not
   fix *other* affected users' open tabs (they legitimately wait for natural refresh or their own
   next sign-in) — that gap is exactly why dual-read must stay in place through the token's max
   lifetime (1 hour) after cutover, not just through deploy.
4. **Verify before it can lock anyone out.** Before removing the dual-read fallback: (a) run the
   emulator rules suite with the claim present, claim absent, and claim stale-but-Firestore-current,
   proving all three pass; (b) in a real (non-prod) project, sign in as an existing pre-migration
   user, confirm they are NOT locked out with zero claim; (c) only after 1+ hour (max token lifetime)
   with dual-read live and no error-rate spike, remove the `exists()`/`get()` fallback in a *separate*
   deploy from the one that added the claim.
5. **Rollback plan once tokens carry the claim.** Rolling back `firestore.rules`/`storage.rules` to
   the pre-claim version is safe and instant (rules deploys are independent of token state — an
   old-shape rule simply ignores whatever claim is present). The one-way door is the claim *data*
   itself: once claims are backfilled, leaving them in place while reverting rules is harmless (an
   unused claim in the token costs nothing). Never remove the dual-read `OR` branch until the team is
   certain no rollback is coming.

**Warning signs:**
- Any `firestore.rules`/`storage.rules` diff that replaces (rather than adds an `OR` to) an
  `exists()`/`get()` check with a claim check in the same deploy.
- A backfill Cloud Function with no resumability/idempotency and no post-run count verification.
- `setCustomUserClaims` called from anywhere reachable by client-supplied input without server-side
  membership verification first (claims are as dangerous to set wrongly as they are trustworthy once
  set correctly).
- No test exercising a user who belongs to 2+ orgs against the real claim-shape byte count.

**Phase to address:**
The "move org membership onto a custom auth claim" phase (carried-forward v1.4 item, R062-adjacent).
This should be its own phase, sequenced *early* in the milestone but not first — it should land
*after* the sharing rework's Firestore/Storage-rules changes are stable, so this phase isn't
debugging two rules rewrites in the same window. It must not be bundled with any UI-facing settings
work; it is pure infrastructure risk and deserves an isolated blast radius.

---

### Pitfall 2: A security-rules change proves it denies the wrong thing, not that it allows the right thing

**What goes wrong:**
This project has already shipped a rule that denied every legitimate user while the emulator test
suite reported green, because — per CLAUDE.md — **`firestore.exists()` is permanently inert in the
Storage emulator** (firebase-js-sdk#6803): a rule reduced to nothing but that cross-service clause
denies identically whether the membership doc exists or not. All the *deny* test cases passed
(correctly denying non-members) while both *allow* cases failed (incorrectly denying members) — and
the failures were mislabelled "needs the Storage emulator" instead of investigated, for an entire
milestone, until a real PPTX import hit `storage/unauthorized` in production.

**Why it happens:** Deny-path tests are trivially easy to write and pass even when a rule is
completely broken (an unconditional `allow: if false` also passes every deny test). Allow-path tests
against a rule with an inert clause fail in a way that *looks* like an environment limitation rather
than a rule bug, especially when a prior comment in the codebase already says "emulator can't do
this" for something else.

**How to avoid — the concrete testing discipline for this milestone's rules changes** (custom
claims, sharing rework, settings docs, service-item type additions all touch `firestore.rules`
and/or `storage.rules`):
1. **Every rules change ships with both a positive and negative test, and the positive test is
   written and run FIRST.** A rule that only has deny tests is not tested — treat "I added deny
   tests" as incomplete work, not as a checkpoint.
2. **Any test failure attributed to "environment limitation" must be proven, not asserted.** The
   proof pattern this project already established (CLAUDE.md, 2026-08-06): strip the rule down to
   *only* the suspect clause, observe identical pass/fail with the underlying condition proven true
   by an out-of-band admin read AND proven false — if the rule behaves identically either way, it's
   provably inert, not merely "probably an emulator quirk." Do this proof before writing the words
   "known limitation" into any test file or plan.
3. **When a rule depends on a cross-service read (Storage rule reading Firestore, as `storage.rules`
   currently does and as any interim dual-read claim rule will also do during Pitfall 1's rollout),
   assume the emulator cannot validate it until proven otherwise for that specific service pair.**
   `firestore.exists()` from Storage rules is confirmed inert; do not assume the reverse (Firestore
   rules reading `request.auth.token`, which is native and always evaluable) has the same problem —
   custom-claims-based rules are, in fact, the fix for this exact blind spot, which is the whole
   rationale for Pitfall 1's phase.
4. **`npm run test:rules` (the real emulator-backed suite) is the gate, not a mental read of the
   `.rules` file.** Any rules change lands with an actual run of that suite (or
   `npx vitest run --config vitest.rules.config.ts` against an already-running emulator, per
   CLAUDE.md) attached as evidence, not "the logic looks right."
5. **New collections added this milestone (settings doc, org font/template config) need read AND
   write, allow AND deny tests from the day the rule is written** — not retrofitted later. The
   `serviceShares`/`quarterShares` rules already in this file are the right model to copy: paired
   comments explaining *why* each clause exists (e.g. the CR-01 slug-squatting fix), not just what it
   does.

**Warning signs:**
- A rules test file where every test name starts with "denies" / "rejects" / "blocks" and none start
  with "allows".
- A code comment or commit message containing "known limitation" or "emulator can't" attached to a
  test that has never been isolated and proven inert by the strip-down method above.
- A rules change reviewed only by reading the `.rules` file, with no emulator run cited as evidence.

**Phase to address:** Every phase that touches `firestore.rules` or `storage.rules` this milestone —
custom claims, sharing (new `serviceShares`-adjacent fields/collections), settings (new org-scoped
settings doc), and the Announcements/Miscellaneous item additions if they need new field-level
validation. This is a *discipline*, not a single phase's deliverable — call it out explicitly in
every such phase's plan verification checklist.

---

### Pitfall 3: Persisted-token share-link migration breaks links already in the congregation's hands, or amplifies writes into a cost/loop problem

**What goes wrong:**
Today, `createShareToken()` (`src/stores/services.ts:353`) mints a brand-new random 36-char token and
a frozen `serviceSnapshot` **every time it's called**, and separately overwrites the memorable
`serviceShares/{slug}__service-{date}` doc in place. v1.5's fix is to persist one token on the
service doc (minted once, never rotated) and auto-refresh the snapshot on every service change. Four
concrete hazards in that migration:

- **Backfilling a token onto existing service documents.** Services that already have a `shareTokens`
  doc from a prior `createShareToken()` call have a token *already circulated* to the congregation
  (e.g. printed in a bulletin, texted to a volunteer). If the backfill mints a *second, different*
  token and only the new one gets persisted on the service doc, the old link (still resolvable
  because its `shareTokens/{token}` doc is never deleted, per the rules' `allow read: if true`)
  becomes a permanent stale fork — it will silently stop tracking the service once the new one takes
  over autosave-refresh, showing whatever plan existed at the moment of the last manual share
  forever. The correct backfill re-uses the **most recently created** existing token for that service
  (if one exists) as the persisted token, rather than minting fresh — this preserves every link
  already in someone's hands.
- **Auto-refresh on every service write is a second write, and it must not become a trigger loop.**
  If the refresh is implemented as a Cloud Function trigger (`onDocumentWritten` on
  `organizations/{orgId}/services/{docId}`) that writes the refreshed snapshot to
  `shareTokens/{token}` and/or `serviceShares/{slug}__service-{date}`, that is safe *only* as long as
  neither of those writes touches the `services/{docId}` document itself. If, instead, refresh is
  implemented as an extra client-side write appended to every service save that happens to touch
  `services/{docId}` (e.g. caching "last refreshed" on the service doc), a Firestore-triggered
  function watching `services/{docId}` for exactly that purpose will re-fire on its own write —
  classic infinite trigger loop. **Design constraint: the refresh write's target must never be a
  document the refresh trigger itself watches.**
- **Cost/write amplification.** Every keystroke-debounced service autosave (this app already
  debounces autosave, per PROJECT.md's save-reliability history) would, under a naive "refresh
  snapshot on every write" design, also re-run the roster/quarter resolution
  (`resolveServiceRoleAssignments`, a cross-collection read) and write two more documents
  (`shareTokens` + `serviceShares`) per save. At current scale (2-3 planners, one org) this is
  immaterial; the actual risk is *unshared* services (never presented to anyone, no `shareTokens`
  doc yet) paying this cost on every autosave for no reader. **Only refresh a service that has
  already been shared at least once** (i.e., a `shareTokens` doc already exists) — do not eagerly
  create share docs for services nobody has shared.
- **PII scope creep on refresh.** `createShareToken()`'s `serviceSnapshot` deliberately carries
  `personNames` only (D-04/D-24 guard — resolved via a `Map<id, name>`, never the raw `Person`
  object with email/phone/`pcPersonId`). A refresh path implemented as "just re-run the same
  snapshot-building code on write" is safe *only if it reuses the exact same resolution function*.
  The hazard is a future edit to that resolver (e.g. someone adding a phone number for a "text the
  team" feature) that widens what a **public, unauthenticated** read (`allow read: if true` on both
  `shareTokens` and `serviceShares`) exposes — and because refresh now runs automatically on every
  save instead of only at explicit "Share" click time, a PII leak introduced this way would appear
  on *every* service silently and immediately, not just on the next manual share.

**How to avoid:**
- Backfill script: for each service with an existing `shareTokens` doc, reuse its token (most recent
  by `createdAt` if multiple) rather than minting new.
- Implement the refresh as a Cloud Functions Firestore trigger on `services/{docId}` writing *only*
  to `shareTokens/{token}` and `serviceShares/{shareId}` — never back to `services/{docId}` — and add
  a test asserting the trigger does not re-fire itself.
- Gate the refresh on "a share already exists for this service" to avoid amplifying every autosave.
- Add an explicit test (unit or rules) pinning the snapshot shape to `{name, roleId, roleName,
  group, personNames}` — no email/phone/id fields — so a future PII widening fails CI, not just code
  review.

**Warning signs:**
- A backfill script that calls `crypto.getRandomValues` / mints a new token instead of reading
  existing `shareTokens` docs for the service first.
- A refresh implementation where the Cloud Function trigger's watch path and write path overlap.
- Firestore write-count graphs (or local emulator debug logs) showing N writes per single service
  save where N was previously 1.
- Any new field on `serviceSnapshot.roleAssignments` beyond `roleId/roleName/group/personNames`.

**Phase to address:** The "sharing correctness" phase (persisted token, auto-refresh). Backfill
should be a discrete, reviewable step within that phase — not folded silently into the schema
migration — precisely because it's the one step that can strand already-circulated links.

---

### Pitfall 4: Widening `SlotKind` breaks in the gap between "old data, new code" and "new data, old code"

**What goes wrong:**
`SlotKind` (`src/types/service.ts:7`) is a closed union:
`'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE' | 'HYMN' | 'IMPORTED'`. Adding `'ANNOUNCEMENT'` and
`'MISC'` this milestone touches at least six confirmed exhaustive `switch (slot.kind)` sites across
`slotTypes.ts`, `slideGroupMaterializer.ts` (multiple switches), and others — all currently written
**without a `default:` clause**, which means TypeScript's exhaustiveness checking will hard-fail the
build at every site that isn't updated. That is the *good* half of the news: `npm run type-check`
(the `vue-tsc --build` gate CLAUDE.md insists on, not the narrower `-p tsconfig.app.json` form) will
catch every missed switch at compile time for code that ships in the same deploy.

The real hazard is runtime, not compile-time, and has two directions:
- **Old documents, new code:** already-created services will never contain `ANNOUNCEMENT`/`MISC`
  slots — no migration needed, nothing to backfill. Low risk.
- **New documents, old code — the actual danger.** Once `ANNOUNCEMENT`/`MISC` slots exist in
  Firestore, any client still running a **previously-cached JS bundle** (a browser tab left open
  since before deploy, or a service worker/CDN edge cache serving a stale asset) receives those slots
  over `onSnapshot` and runs them through *its* compiled switch — which, being the old bundle, has no
  case for the new kind. Because these are exhaustive switches with **no `default:`**, the *old*
  bundle's JS (TypeScript exhaustiveness is erased at build time — it produces ordinary
  fall-through-to-nothing JS, not a runtime guard) returns `undefined` from `slotLabel`, and the
  grouped-switch sites in `slideGroupMaterializer.ts`/`useSlideshowAssembly.ts` likely fall through to
  whatever their nearest matched case's behavior is *not* — i.e., silently produce no slide content,
  no label, or (worse) misroute the slot into the PRAYER/MESSAGE/HYMN "no slide" bucket, making a
  real Announcement silently vanish from an old tab's rendered service order or presenter view with
  no error.
- **The Slides tab / presenter view** is the sharpest edge: a slide-group materializer that doesn't
  recognize the kind may produce zero slides for it, and a presenter mid-service on a stale tab could
  simply skip an Announcement or Miscellaneous item with no visible failure.

**How to avoid:**
- Before adding the new kinds, grep every `switch (…kind)` / `switch (…\.kind)` site (six-plus
  confirmed) and add the new cases in the **same commit**, relying on the compiler to enumerate every
  site — do not trust memory.
- **Explicitly decide and document** whether `ANNOUNCEMENT`/`MISC` join the "no slide generated"
  group (with `PRAYER`/`MESSAGE`/`HYMN`) or the "generates a slide" group (with `SONG`/`SCRIPTURE`/
  `IMPORTED`) at each of the six sites — PROJECT.md describes both as "plain input boxes," which
  argues for the no-slide-generated group, matching `MESSAGE`'s current treatment (v1.5 also reduces
  MESSAGE itself to a plain input box, so precedent already exists in this same milestone).
- **Mitigate the stale-client window deliberately**, since it cannot be eliminated by server-side
  code alone: ship a version banner / forced-reload prompt on new deploy (if the app has one) or
  accept the window and scope it — a service with no Announcement/Misc items visible to a stale tab
  degrades to "item invisible," not "app crashes," as long as every switch defaults to the no-op
  branch rather than throwing.
- Add a unit test per switch site asserting a not-yet-existing hypothetical kind is unreachable
  (TypeScript will already enforce this, but an explicit "every SlotKind member is handled" test
  documents the invariant for the next person adding a kind).

**Warning signs:**
- Any `switch (slot.kind)` gaining a `default:` clause "to be safe" — this silently defeats the
  compiler's exhaustiveness check for every *future* kind addition, trading a build-time guarantee
  for a runtime guess.
- `npm run type-check` passing while `npx vue-tsc --noEmit -p tsconfig.app.json` also passes — the
  narrower form should never be treated as sufficient per CLAUDE.md; confirm the wide gate ran.
- QA that only tests against a freshly-loaded tab — the stale-client failure mode requires
  deliberately testing with an old bundle against new data (e.g. open the app, deploy, then interact
  with the already-open tab).

**Phase to address:** The "service items — Announcements/Miscellaneous/Message-as-input-box" phase.
Do this widening in isolation from the sharing/claims work so a `type-check` failure has one obvious
cause, and pair it with the "org service template replaces `buildSlots()`" work only if the template
also needs to reference the new kinds (likely, since a template author would want to include them).

---

### Pitfall 5: A feature toggle hides UI but leaves the code path callable, corrupting data or stranding mid-workflow state

**What goes wrong:**
Both the AI toggle and the Planning Center toggle interact with state that outlives the toggle
flip:
- **AI toggle.** `src/utils/claudeApi.ts` is confirmed as the single choke point for all three AI
  surfaces (song suggestions, scripture discovery, congregational split) — per PROJECT.md's own
  Key Decisions table, this was chosen specifically because it "doubles as the future paywall seam."
  The anti-pattern to avoid: gating only the *UI* (hide the "Suggest with AI" button) while
  `claudeApi.ts`'s functions remain callable from anywhere that still imports them — a component that
  wasn't updated, a stale cached bundle (same class of problem as Pitfall 4), or a direct
  store-action call from dev tools would still spend the org's Claude quota/budget after the org
  believed AI was off. The gate must live *inside* `claudeApi.ts` itself (throw/no-op before any
  network call), not only in the components that call it — matching the "choke point" framing
  PROJECT.md already committed to.
  A second, subtler hazard: **services that already used an AI feature** (an AI-generated
  congregational split already saved into a scripture slot's leader/congregation text) must not be
  mutated or blanked when AI is switched off later — the toggle governs *future* AI invocation, not
  *past* AI-derived content. Turning AI off must never cascade into "delete AI-authored slide text,"
  which would silently corrupt an already-planned service.
- **Planning Center toggle.** `pcAppId`/`pcSecret` live on the `organizations/{orgId}` doc
  (`auth.ts:107-108`) and `hasPcCredentials` gates whether PC calls are attempted. Switching PC off
  should not delete these credentials — a church "porting off" PC (PROJECT.md: "once they have fully
  ported off it") may reconsider, and re-entering an API secret is real friction. But the toggle
  needs to gate every PC-touching code path consistently: CSV import already exists independent of
  the API path (PROJECT.md: "Complement Planning Center... no API integration, data flows via CSV
  import" was the *original* constraint, though the export write path
  `keys().hasOnly(['status','pcExportedAt','pcPlanId','updatedAt'])` in `firestore.rules` shows a
  real, rules-enforced PC-export status transition exists in production today). **A service already
  `exported` to Planning Center (status `exported`, carrying `pcExportedAt`/`pcPlanId`) must not be
  treated as "needs export" or have its exported status silently reverted** when the org turns PC
  off — that status is historical fact about what already happened, not a live PC connection
  indicator.

**How to avoid:**
- Gate `claudeApi.ts` at its own entry points (every exported function checks the toggle and
  fails soft/no-ops before any network call), not only at call sites.
- Never write a migration or toggle-flip handler that mutates already-saved AI-derived slide content
  or already-exported PC status fields. The toggle changes future behavior only.
- Write an explicit test: "toggle AI off, call a `claudeApi.ts` function directly (bypassing UI),
  assert it does not make a network request" — this is the only test that actually proves the choke
  point, as opposed to testing that a button is hidden.
- Keep `pcAppId`/`pcSecret` on the org doc even when the toggle is off; only gate their *use*.

**Warning signs:**
- A toggle implementation that lives only in `v-if`s in `.vue` files, with no corresponding guard in
  `claudeApi.ts` or the PC API utility.
- Any code path (migration, toggle handler, "reset" button) that writes to a scripture slot's
  congregational-split fields or to a service's `pcExportedAt`/`pcPlanId`/`status` in response to a
  *settings* change rather than a direct user edit of that service.

**Phase to address:** The "Settings — AI/Planning Center toggles" phase. Write the choke-point test
before building the UI toggle, not after — it is cheap now and expensive to retrofit once multiple
call sites exist.

---

### Pitfall 6: Self-hosted fonts render the projector or the print layout with the wrong font mid-service

**What goes wrong:**
The milestone decision already commits to curated self-hosted `woff2` files specifically because "a
projector without internet at service time cannot fetch a remote font" (PROJECT.md). The specific
failure modes this must guard against:
- **FOIT/FOUT on the presenter view.** If the font isn't loaded before the presenter view first
  paints a slide, the browser either shows invisible text until the font loads (FOIT, with the
  default `font-display` behavior in many browsers) or shows a fallback-font flash that then reflows
  (FOUT) — either is visible to the congregation on a live projector, which is a materially worse
  failure than a slow page load anywhere else in the app.
- **A font must be loaded before a slide is *measured*, not just before it's painted.** Any slide
  layout logic that measures text (auto-sizing lyrics to fit a slide, wrapping congregational-reading
  text) that runs against a fallback font's metrics before the real font swaps in will compute wrong
  wrap points/sizes, then visibly reflow once the real font arrives — or, if the measurement result is
  cached/persisted rather than recomputed live, could bake in a wrong layout that only self-corrects
  on next edit.
- **Print has the same measurement hazard** without even the FOUT/FOIT recovery — a print job that
  starts before the font is loaded may rasterize with the fallback font permanently (no repaint on a
  printed page).
- **Licensing/attribution.** Self-hosted `woff2` files carry redistribution terms independent of
  where they're served from — bundling a font that is not licensed for embedding/redistribution (as
  opposed to just "free to view on a webpage via a hosted service") is a real legal exposure distinct
  from the runtime font-loading problem. `Inter` (named as the Helvetica Neue stand-in) is
  SIL-licensed and safe to bundle, but any additional font added to the "curated list" needs the same
  check before being added, not assumed by analogy.

**How to avoid:**
- Use the CSS Font Loading API (`document.fonts.load(...)`/`document.fonts.ready`) to gate the
  presenter view's *first paint* — do not rely on `@font-face` + `font-display: swap` alone, since
  swap is exactly the FOUT behavior to avoid on a projector.
- Any measurement-then-persist logic (auto-fit sizing) must await `document.fonts.ready` before
  measuring, every time it measures — not just once at app boot, since the presenter/print views can
  be the first place in a session that font is needed.
- Preload the org's configured font (`<link rel="preload" as="font">` or equivalent) as soon as the
  org's font setting is known — on app boot from the settings store, not lazily at first slide
  render.
- Record the license for every font added to the curated list in the codebase (a comment or a data
  file next to the font list), and verify embedding/redistribution rights before adding — don't
  assume "free download" implies "free to bundle."

**Warning signs:**
- A presenter view or print layout with no `document.fonts.ready`/font-loading gate before first
  render.
- Visible text reflow in manual testing of the presenter view on a fresh page load (throttle network
  to reproduce reliably).
- Any curated font added without a recorded license check.

**Phase to address:** The "Slides slide-out — global font family/weight/size" phase, specifically its
UI-research sub-step (PROJECT.md: "Final list settled by the UI research phase against projection
legibility") — legibility research and font-loading-safety research belong together, not split
across phases, since both gate the same curated list.

---

### Pitfall 7: A second Bible translation creates copyright exposure on cached/persisted text and stale slides when a church switches translations

**What goes wrong:**
`src/utils/esvApi.ts` fetches passage text fresh via `/api/esv/...` on every call (no client-side
cache observed) — but once fetched, that text is **persisted** into scripture slots and slide-group
documents (confirmed: scripture text flows into slides via `slideGroupMaterializer.ts`/
`useSlideshowAssembly.ts`, which are the exhaustive-switch sites from Pitfall 4). ESV and NLT are
separate copyright holders (Crossway vs. Tyndale House) with independently-negotiated API terms —
common real-world restrictions include a maximum verse/word count per single display and a required
attribution/copyright notice on each display. Two concrete hazards specific to *adding* NLT to an
app that already persists ESV text:
- **Persisting fetched text beyond what each license permits** is a real risk distinct from simply
  *displaying* it: this app already writes passage text into Firestore documents (slide groups),
  which is storage, not just transient display — the NLT API terms (and, on renewal, the ESV terms)
  need to be checked for whether *storage* (as opposed to real-time API display) requires different
  handling, since `NLT_API_KEY` joining `.env.local` (already decided, per PROJECT.md) only covers
  fetching, not the storage question.
- **Switching a church's translation setting does not retroactively touch already-generated slides.**
  A scripture slide generated from an ESV passage, viewed after the org's setting flips to NLT,
  should keep showing its already-persisted ESV text (with ESV's attribution) — not silently
  re-fetch/re-render as NLT (which would violate the *original* passage's boundaries, e.g. exact
  verse start/end, that were chosen against ESV's text) and not show mismatched attribution (ESV text
  with an NLT copyright notice, or vice versa). Each already-generated slide needs to remember which
  translation it came from, independent of the org's *current* setting, and render the correct
  attribution regardless of which translation is currently selected in Settings.
- **Re-generating** an existing scripture slide after a translation switch (a normal user action —
  editing a scripture item) should re-fetch from the newly-selected translation and require the same
  6-10-verse-range validation this app already applies to ESV, not silently reuse cached ESV text
  under an NLT label.

**How to avoid:**
- Store the source translation code (`'ESV'`/`'NLT'`) alongside any persisted scripture text, at the
  slide/slot level, not only at the org-settings level — this is the field that resolves the
  "does switching invalidate existing slides" question without ambiguity.
- Render the copyright/attribution notice from the *persisted* translation code on each slide, never
  from the org's current setting.
- Confirm with both API terms (ESV already integrated; NLT is new) whether Firestore persistence of
  fetched text is within the redistribution/display license, not just within a "per API response"
  read limit — this is a "verify before shipping," not an assumption, since NLT's terms may differ
  from ESV's even though both are proxied through the identical Cloud Function pattern.

**Warning signs:**
- A scripture slide document with no field recording which translation its text came from.
- A translation switch that causes previously-generated slides to change on the next page load with
  no user action.
- Any UI surface displaying scripture text with no visible copyright/attribution string.

**Phase to address:** The "ESV/NLT Bible version selection" phase. The per-slide translation-source
field is a schema decision that should be made in this phase, not deferred, since retrofitting it
onto slides already created during this same milestone (with only ESV available) is exactly the
kind of migration Pitfall 4's "old documents, new code" pattern warns about.

---

### Pitfall 8: Mobile/touch retrofit of SortableJS-based drag-and-drop reproduces this app's own documented index bugs

**What goes wrong:**
SortableJS drives drag-and-drop in at least three places already (`ServiceEditorView.vue`,
`SlideGrid.vue`, `SongLyricEditor.vue`), and this app has a **documented, reproducible index bug** —
PROJECT.md's own "Reproduction case for the drag-and-drop defect" (service `ZTXcpNRcJTalEQp42fTx`:
sections rendered out of order after repeated reordering, correct again only after a page refresh).
That class of bug — the DOM's post-drag order and the underlying array/Firestore order silently
diverging — is exactly what a touch-target/viewport retrofit is likely to reintroduce or worsen,
because:
- **Touch drag needs different SortableJS options** (`delay`, `touchStartThreshold`, `forceFallback`)
  than mouse drag, and mismatched settings commonly cause a drag to register as a tap-scroll instead
  (the item doesn't move) or, worse, register a drop at the wrong index because touch move events fire
  at a different granularity than mouse move events feeding the same reorder handler.
- **Small touch targets on a narrow viewport** (the Slides tab's slide-group cards, the service-order
  drag handles) are the most likely place a retrofit either shrinks hit areas below usable size or
  overlaps a drag handle with a tap-to-edit affordance, producing accidental drags/accidental edits.
- **The existing fixed-section constraint** (five sections — Pre-Service through Post-Service — that
  "are fixed, always visible, and never reorderable," per v1.4's completed work) must survive the
  mobile retrofit unchanged; a naive mobile reorder implementation that treats the whole list as one
  flat sortable group (rather than per-section, matching the desktop implementation) would silently
  reintroduce cross-section reordering on mobile only.

**How to avoid:**
- Do not write new reorder logic for mobile — reuse the exact same SortableJS instance/config used on
  desktop, adding only touch-specific *options* (`delay`, `touchStartThreshold`), so the
  index-computation code path stays identical between input methods and any regression is
  immediately visible on desktop too (rather than mobile-only, and easy to miss in review).
- Add a regression test/manual repro step specifically mirroring the documented
  `ZTXcpNRcJTalEQp42fTx` case, run under touch-simulated interaction (Playwright/Cypress touch
  events or manual device testing), before considering the mobile retrofit done.
- Keep drag handles visually and functionally distinct from tap targets (a dedicated handle icon,
  not "drag the whole card"), sized to touch-target minimums (commonly cited as ~44x44px) — this is
  as much an index-bug-prevention measure as it is accessibility, since ambiguous touch input is what
  produces wrong-index drops.

**Warning signs:**
- A drop that "looks right" immediately but reverts or duplicates after the next autosave/refresh —
  the exact signature of the documented bug.
- Reorder logic branching on `window.innerWidth`/a mobile flag to use different array-splice logic
  for touch vs. mouse, rather than one shared handler.
- Manual testing performed only via browser devtools' responsive-mode mouse emulation, which does not
  exercise real touch event timing/granularity.

**Phase to address:** The "mobile & layout" phase (mobile-friendly Slides tab, stacked buttons). This
should be sequenced *after* any other phase that touches drag-and-drop order logic this milestone
(none currently planned, but if scope shifts), so the mobile retrofit isn't chasing a moving target.

---

### Pitfall 9: A 22-cluster milestone overruns by under-sequencing independent-looking work that shares hidden dependencies

**What goes wrong:**
v1.5's target-feature list spans at least nine independent-sounding areas (custom claims, PPTX
display, sharing, four settings toggles/pickers, five service-item changes, congregational-reading
UX, image-order determinism, and five mobile/layout items) plus four carried-forward items. Broad
milestones like this typically fail in one of these specific ways, each with a specific tell in
*this* codebase:
- **The riskiest item (custom claims) gets scheduled last "because it's infrastructure," and then
  rushed** when everything else runs over — exactly backwards, since Pitfall 1 shows it needs the
  longest verification window (the dual-read soak period) and the most room to roll back cleanly.
  It should be sequenced early precisely because a slow, careful rollout with time to observe is safe
  and a rushed one is not.
- **Items that look independent but share a choke point collide.** The AI toggle (Pitfall 5) and the
  congregational-reading UX both touch `claudeApi.ts` and scripture-slide generation; the sharing
  rework (Pitfall 3) and the custom-claims work (Pitfall 1) both touch `firestore.rules`/
  `storage.rules` in the same file. Planning these as fully parallel phases risks two phases editing
  the same rules file or the same choke-point module in overlapping windows, producing merge/rules
  conflicts that don't show up until integration.
- **The carried-forward PPTX display item (R062) is scoped as "half done" and has "never had a home
  in the roadmap"** per PROJECT.md's own language — the exact phrasing that predicts it slipping
  again unless it's given an explicit, named phase with its own acceptance criteria (client reads
  `pptxRenders`/`rendered/*.png`, draws the PNG in grid and presenter, per the milestone decision
  table) rather than being folded as a sub-task into a larger fidelity phase.
- **Settings items that look like simple toggles (font, template, translation) are each schema
  decisions** (Pitfalls 6, 7, and the org-template-replaces-`buildSlots()` decision) that, if
  under-scoped as "just add a settings field," skip the migration/backward-compatibility questions
  each one actually raises (old services with no font setting; slides generated before a template
  existed; slides generated under the previous sole translation).

**How to avoid:**
- Sequence Pitfall-1 (custom claims) early, with the dual-read soak period budgeted as real elapsed
  time in the schedule, not "as long as it takes between two adjacent phases."
- Group phases by *shared file/choke-point*, not by feature-area label — e.g. don't split "AI
  toggle" and "congregational reading AI-split" into fully independent, parallel phases if both edit
  `claudeApi.ts`'s gating logic; sequence or merge them.
- Give the PPTX-display carryover its own phase with the milestone decision table's stated
  acceptance criterion ("the rendered PNG *is* the slide... drawn in the grid and in the presenter")
  as its explicit success condition, since it has already slipped one milestone.
- Treat each settings picker (font, template, translation) as carrying a migration question for
  already-existing data, and require that question answered in the phase's plan before implementation
  starts — not discovered during execution.

**Warning signs:**
- A roadmap where the custom-claims phase is scheduled after most other phases "so it doesn't block
  anything."
- Two phases with overlapping edits to `firestore.rules`, `storage.rules`, or `claudeApi.ts` planned
  to run in parallel.
- A settings-picker phase plan with no line addressing what happens to data created before the
  setting existed.

**Phase to address:** This is a roadmap-structure concern, not a single phase's — it should shape
phase *ordering* directly (see Sources/roadmap-implications note below).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Rules dual-read `OR` left in place indefinitely instead of removed after cutover | Zero extra work, never locks anyone out | Every future rules change must remember to preserve both branches; masks whether the claim path actually works if the Firestore fallback is silently doing all the work | Acceptable to leave for one milestone as a safety net, but track removal as a follow-up item — don't let it become permanent by default |
| Gate a toggle only in the UI, defer the `claudeApi.ts`/PC choke-point guard | Ships the visible feature faster | Silent quota spend / stray PC calls from any code path that bypasses the UI gate (dev tools, stale bundle, missed call site) | Never acceptable for AI (real API cost) or PC (real external write risk) — do the choke-point guard first |
| Skip the per-slide translation-source field, key attribution off the org's current setting | Simpler schema, less migration work | Breaks the moment a church switches translations mid-use; wrong attribution is a licensing violation, not just a bug | Never acceptable given both translations are actively supported and switchable |
| Backfill custom claims without idempotency/resume support | Faster to write | An interrupted run leaves an unknown subset of users un-migrated with no easy way to find them | Never acceptable — this directly risks the lockout Pitfall 1 exists to prevent |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|--------------------|
| Firebase custom claims | Treating `setCustomUserClaims` as synchronous with client state | Dual-read rules through at least one full max-token-lifetime (1 hour) after every claims-affecting deploy |
| Storage emulator + Firestore rules | Assuming any cross-service check is testable locally just because *some* emulator tests pass | Isolate the suspect clause and prove pass/fail is identical regardless of the underlying condition before calling it an environment limitation |
| ESV/NLT proxy (`functions/src/index.ts`) | Assuming both APIs share identical storage/redistribution terms because they're proxied through the same Cloud Function pattern | Check each API's terms independently for the storage (not just display) question before persisting fetched text |
| SortableJS (multi-instance: ServiceEditorView, SlideGrid, SongLyricEditor) | Writing separate touch-specific reorder logic per surface | Reuse one shared config/handler, add touch-only *options*, keep index-computation code identical across input methods |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Share-snapshot refresh on every service write, including unshared services | Firestore write-count spike disproportionate to actual sharing usage; unnecessary roster/quarter cross-reads on every autosave | Gate refresh on "a `shareTokens` doc already exists for this service" | Immaterial at current scale (2-3 planners) but wastes writes/reads from day one — cheap to prevent now |
| Claims-backfill as an unbounded single-invocation function | Cloud Function timeout on orgs with many members; partial backfill | Paginate + checkpoint + resumable | Breaks once member count exceeds what fits in one function invocation's time budget |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting a client-writable Firestore `role` field as equivalent to the auth-claim `role` | The two can diverge (client can write its own Firestore role field per today's `isOrgEditor` write grant on `members/{uid}`, but cannot write its own claim) — code that reads the wrong one for an authorization decision can be tricked | Rules use the claim (server-set only); app UI can read either for *display*, but any access decision must go through the claim or the existing Firestore check, never a client-writable field |
| Widening the public `shareTokens`/`serviceShares` snapshot fields without a pinned-shape test | A future edit anywhere in the snapshot-building path silently exposes new PII to an unauthenticated `allow read: if true` reader | A test asserting the exact field set of `serviceSnapshot.roleAssignments`, failing CI on any addition |
| Removing the `exists()`/`get()` fallback in the same deploy that adds the claim check | Any user without the claim yet (not-yet-refreshed token, backfill miss) is locked out instantly | Two separate deploys: add-with-dual-read, then (after the soak period) remove-fallback |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Presenter view painting before the org's configured font loads | Visible font flash/reflow on a live projection in front of the congregation | Gate first paint on `document.fonts.ready` for the specific configured font |
| Toggling a feature off with no indication of what happens to data that already used it | A planner turning off AI worries their already-split congregational reading will vanish or was never real | Explicit copy: "Existing AI-assisted content is unaffected; this only disables future AI suggestions" |
| Auto-refreshing share snapshot silently changing role names shown on a link already sent out | A volunteer clicks a link they were sent last week and sees names that don't match what they were told verbally, with no explanation | This is by design (v1.5's whole point — role overrides publish without re-sharing), but the share view itself should show a "last updated" timestamp so recipients can tell it's current, not stale |

## "Looks Done But Isn't" Checklist

- [ ] **Custom claims rollout:** Often missing the dual-read window — verify `firestore.rules`/
      `storage.rules` still contain the `exists()`/`get()` fallback branch, not just the claim check,
      immediately after the phase that adds claims.
- [ ] **Rules changes:** Often missing a passing *allow* test — verify at least one allow-case test
      exists and is run against the real emulator (`npm run test:rules` or the direct
      `vitest.rules.config.ts` invocation), not just deny-case tests.
- [ ] **Share-link migration:** Often missing the backfill-reuses-existing-token step — verify a
      service that already had a `shareTokens` doc before this migration keeps resolving through its
      original token afterward.
- [ ] **SlotKind widening:** Often missing one of the six-plus exhaustive switch sites — verify
      `npm run type-check` (the `vue-tsc --build` form, not `-p tsconfig.app.json`) passes clean after
      adding `ANNOUNCEMENT`/`MISC`.
- [ ] **AI/PC toggles:** Often missing the module-level guard — verify calling a `claudeApi.ts`
      function directly (bypassing the UI) with the toggle off does not issue a network request.
- [ ] **Font settings:** Often missing the pre-measurement font-load gate — verify presenter/print
      views await `document.fonts.ready` before rendering, not just before showing a loading spinner.
- [ ] **Second Bible translation:** Often missing a per-slide translation-source field — verify a
      slide created under ESV still shows ESV's attribution after the org's setting switches to NLT.
- [ ] **Mobile drag-and-drop:** Often missing a repro of the documented index bug under touch —
      verify the `ZTXcpNRcJTalEQp42fTx`-style reorder-then-refresh case is retested on a touch input
      path, not just visually spot-checked in devtools responsive mode.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Custom claims lock out users despite dual-read (bug in the `OR` logic itself) | LOW | Revert the rules deploy only (instant, independent of token state) — claim data already backfilled is harmless to leave in place |
| Share-link backfill mints new tokens instead of reusing existing ones, orphaning circulated links | MEDIUM | Re-run backfill with corrected reuse logic; old orphaned `shareTokens` docs can be identified by comparing `createdAt` timestamps against the persisted-token migration's run time, then manually re-pointed if the original link is still needed |
| SlotKind widening ships with a missed switch site (compile passed via the narrow tsconfig form) | LOW | Add the missing case, redeploy — no data migration needed since this is a pure code defect, not a data-shape problem |
| AI toggle only gates UI, quota spent via a bypassed path | MEDIUM | Add the choke-point guard retroactively in `claudeApi.ts`; audit Claude API usage logs for the affected window to confirm no further leakage, no data corruption to undo since AI output was already treated as additive/non-blocking |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Custom claims lockout / staleness / size limit | Custom auth claims phase (sequence early; own phase, not bundled) | Emulator rules suite passes with claim present/absent/stale; real (non-prod) sign-in test with a pre-migration user shows no lockout; 1-hour soak with dual-read before fallback removal |
| Rules "denies everyone" repeat | Every phase touching `firestore.rules`/`storage.rules` | At least one passing allow-case test per rule change, run against the real emulator, cited as evidence in the phase's verification |
| Share-link backfill / write amplification / PII widening | Sharing correctness phase | Backfill reuses existing tokens (test against a pre-migration service); refresh trigger's write target excludes its own watch path; snapshot field-shape test pinned |
| SlotKind widening breaks old bundles / silent fallthrough | Service items (Announcements/Misc/Message) phase | `npm run type-check` clean; explicit decision recorded for which switch-group (slide-generating vs. not) each new kind joins |
| Feature toggle leaves code path callable | Settings — AI/PC toggles phase | Direct call to `claudeApi.ts`/PC utility with toggle off makes no network request; already-exported PC status and already-AI-generated slide content untouched by the toggle flip |
| Font FOUT/FOIT on presenter/print | Slides slide-out — font phase (with its UI-research sub-step) | Manual throttled-network test shows no visible reflow on presenter first paint; license recorded for every curated font |
| Second translation copyright/staleness | ESV/NLT Bible version phase | Per-slide translation-source field present and tested; translation switch doesn't retroactively alter existing slides |
| Mobile drag-and-drop index bugs | Mobile & layout phase | Documented `ZTXcpNRcJTalEQp42fTx`-style repro retested under touch input, not just devtools mouse emulation |
| Broad-milestone scope overrun | Roadmap phase ordering itself | Custom claims sequenced early with soak time budgeted; choke-point-sharing phases (AI toggle + congregational-AI-split; sharing + claims on rules files) sequenced, not parallelized; PPTX display given its own named phase with the stated acceptance criterion |

## Sources

- Direct codebase reads (HIGH confidence, primary source): `.planning/PROJECT.md`, `CLAUDE.md`,
  `firestore.rules`, `storage.rules`, `src/stores/services.ts` (`createShareToken`),
  `src/stores/auth.ts` (`loadOrgContext`, `orgIds`), `src/utils/slotTypes.ts`,
  `src/utils/slideGroupMaterializer.ts`, `src/utils/esvApi.ts`, `functions/src/index.ts`,
  `.planning/codebase/CONCERNS.md`, `.planning/STATE.md` (storage.rules incident record).
- [Control Access with Custom Claims and Security Rules | Firebase Authentication](https://firebase.google.com/docs/auth/admin/custom-claims) — 1000-byte payload limit, token-refresh propagation, `getIdToken(true)` force-refresh pattern (HIGH confidence, official documentation, fetched and cross-checked directly).
- [firebase-js-sdk#6803](https://github.com/firebase/firebase-js-sdk/issues/6803) — cited in CLAUDE.md as the root cause of `firestore.exists()` being inert in the Storage emulator; not independently re-verified in this pass, taken as established project fact per CLAUDE.md's own investigation record.

---
*Pitfalls research for: WorshipPlanner v1.5 Settings, Sharing, and Fidelity*
*Researched: 2026-08-06*
