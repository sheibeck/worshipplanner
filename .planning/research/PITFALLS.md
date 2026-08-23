# Pitfalls Research

**Domain:** Multi-tenant Vue 3 + Firebase worship-planning app — v2.2 Configurability, Hardening & Cleanup
**Researched:** 2026-08-23
**Confidence:** HIGH (every finding below is grounded in a direct read of the current `firestore.rules`,
`functions/src/index.ts`, `src/stores/*.ts`, and `src/views/*.vue` — not inferred from the seed catalog alone.
Several seed-catalog claims were re-verified against source and one was found to already be resolved; see
Pitfall 1.)

## Critical Pitfalls

### Pitfall 1: Trusting the SEED-002 catalog's line/file counts as current

**What goes wrong:**
`SEED-002-church-specific-rules-configurability.md` claims `VW_TYPE_LABELS` is "copy-pasted in 6+ files"
(`ShareView`, `SongSlideOver`, `BatchQuickAssign`, `VwExplainer`, `SettingsView`, `claudeApi`). A direct grep of
`src/` as of 2026-08-23 shows it now lives in exactly **one** file (`src/types/song.ts`) with exactly **one**
consumer (`src/utils/songSearch.ts`) — the de-dup this seed calls "a real maintenance bug" has apparently
already happened, likely during unrelated v2.0/v2.1 work, without the seed being updated. If a phase plan
is written straight off the seed's numbers, it will "fix" a duplication that's gone and skip re-verifying the
things that are still true (A1's team list IS still duplicated at `ServiceEditorView.vue:1675` and
`NewServiceDialog.vue:145` — confirmed live).

**Why it happens:**
Seeds are planted once and read as gospel months later; nobody re-diffs them against `git blame`/grep before
scoping a phase. The seed itself is dated 2026-08-23 (the audit date) but the codebase has moved since backlog
items were catalogued across several prior milestones.

**How to avoid:**
Before writing any phase plan or requirement off SEED-002, re-run the greps it implies (file paths + line
numbers for A1/A2/A3/A4/B1/B2/C1) and update the phase plan to match what's actually there, not what the seed
says. Treat the seed as a hypothesis to confirm, not a spec to implement blind.

**Warning signs:**
A plan that cites "6+ files" for `VW_TYPE_LABELS` consolidation, or that budgets work for a de-dup that a
2-minute grep shows is already 1 file.

**Phase to address:**
The "Configurable Teams" phase (999.8/A1+A2+B1) — do the re-grep as the first plan-phase step, before writing
any tasks.

---

### Pitfall 2: Per-org team-list backfill breaks existing Berean data or silently no-ops for other orgs

**What goes wrong:**
Two default-merge patterns already coexist in this codebase for "per-org config that didn't exist before":
(a) `OrgSettings` — a field merged at **read time** in `loadOrgContext` via `settings?.field ?? DEFAULT_ORG_SETTINGS.field`
(no doc write until the org saves Settings), and (b) roster roles — actual **subcollection documents** seeded
once via `seedDefaultRolesIfEmpty()`, gated on `roles.value.length === 0` so it never re-seeds. SEED-002 says
"model exactly like `DEFAULT_ROLES`" for the team list, which means pattern (b): real docs, not a settings
array. If the phase instead bolts `teams: string[]` onto `OrgSettings` (pattern a) to save time, the two
existing places that read the hard-coded `AVAILABLE_TEAMS = ['Choir','Orchestra','Communion','Special']`
(`ServiceEditorView.vue:1675`, `NewServiceDialog.vue:145`) must BOTH be repointed to the same merged value —
miss one and the two surfaces show different team lists for the same org, silently reintroducing the exact
2-copy drift this feature exists to kill.
If pattern (b) is chosen (a `teams` subcollection, correctly modeled on roles), the seeding function has the
same theoretical double-seed race `seedDefaultRolesIfEmpty` already has: two editors opening the Services page
simultaneously in a brand-new org can both observe `teams.length === 0` before either write lands, and both
fire the seed loop, producing duplicate default team docs. This is a pre-existing, never-fixed race in
`seedDefaultRolesIfEmpty` (roster.ts:240) — copying that pattern verbatim copies the race, too.

**Why it happens:**
The codebase has a proven, working precedent (`DEFAULT_ORG_SETTINGS` + lazy backfill, comment: "lazily
backfilled by a Settings save — never a bulk migration script") right next to a second, structurally different
precedent (`DEFAULT_ROLES` seeded subcollection docs). Picking whichever is faster to type, rather than the one
SEED-002 actually specifies, is the easy mistake — and even picking the right one (subcollection) inherits an
un-audited race condition nobody has hit yet only because roles are rarely created by two people at once.

**How to avoid:**
- Decide explicitly, in the phase plan, which pattern the team list follows, and justify it against SEED-002's
  "model exactly like DEFAULT_ROLES" instruction rather than defaulting to whichever is less code.
- Whichever pattern is chosen, grep for every read site of the hard-coded array (currently 2:
  `ServiceEditorView.vue:1675`, `NewServiceDialog.vue:145`) and repoint ALL of them in the same commit — do not
  leave one on the old constant "for now."
- If subcollection-seeded: either accept the same idempotent-retry race `DEFAULT_ROLES` already has (it's
  low-blast-radius — duplicate default team docs, not data loss) and document that it's a known, accepted
  limitation shared with roster roles, or close it with a transaction/existence-check-then-batch-write — don't
  silently introduce a NEW race while believing you copied a safe pattern.
- Write a unit/store test asserting: an org with zero team docs and zero `settings.teams` gets the default four
  teams on first load, an org with a customized team list keeps its customization untouched by any later
  redeploy, and calling the seed function twice in immediate succession does not double the list (or the test
  explicitly documents that it can, matching roles' known behavior).

**Warning signs:**
A phase plan that only updates one of the two team-list read sites; a store function that writes team docs
without an existence/length guard; no test asserting an EXISTING (pre-feature) org still sees the same four
teams it always had (Choir/Orchestra/Communion/Special) after the migration ships — i.e. the default-merge
literally must reproduce today's `AVAILABLE_TEAMS` values as the seed data, not some new set.

**Phase to address:**
"Configurable Teams" phase (999.8 A1). Verification: an existing-org fixture (no `teams` field/subcollection
docs) must still resolve to `['Choir','Orchestra','Communion','Special']` after the change — this is the actual
regression test for "doesn't break Berean."

---

### Pitfall 3: Dropping the ordinal-Sunday rule (B1) breaks its dedicated test file without anyone noticing the manual-selection UX regressed

**What goes wrong:**
`sundayOrdinal()` in `NewServiceDialog.vue:148` drives automatic team pre-selection (1st Sunday →
Orchestra+Communion, 3rd Sunday → Choir), and `NewServiceDialog.test.ts:118` has a dedicated block ("Task 3 —
the team side effect") asserting this behavior. SEED-002 recommends dropping it outright (B1) as part of the
first slice. The easy failure mode: delete/neuter `sundayOrdinal()` and its call sites, then "fix" the failing
test by simply deleting or gutting its assertions to make CI green — without checking that the REPLACEMENT
behavior (no team pre-selected; user picks manually every time, or pre-selects from the org's saved defaults if
that's what A1 becomes) is what was actually intended, and without checking `sundayOrdinal` isn't leaned on
elsewhere for date-arithmetic reasons beyond team selection.

**Why it happens:**
Deleting a feature and deleting its test in the same commit looks like a clean removal, but it's the one
place regressions hide — a test rewritten to match new (unreviewed) behavior stops being a regression check
and becomes a tautology.

**How to avoid:**
Treat the ordinal-rule removal as a UX decision, not just a code deletion: confirm explicitly (in the phase
plan or with the owner) what the new-service dialog should default teams to once B1 lands — no team
pre-selected at all? The org's default from A1 pre-applied? Then update `NewServiceDialog.test.ts` to assert
THAT new, deliberate behavior, not merely to stop failing.

**Warning signs:**
A diff that removes `sundayOrdinal()` and simultaneously deletes/weakens its test block rather than replacing
the assertions with a new expected-default assertion.

**Phase to address:**
"Configurable Teams" phase (999.8 B1) — same phase as A1, since B1's replacement behavior is "pick manually" or
"use org default," both of which depend on A1 existing first. Sequence B1 after A1 lands, not before.

---

### Pitfall 4: Tightening `inviteLookup` create looks safe but the actual risk is in what ISN'T re-checked

**What goes wrong:**
Current rule: `match /inviteLookup/{email} { allow create: if isSignedIn(); ... }` — any authenticated user can
create an invite-lookup doc for any email, including their own (self-invite escalation: sign up with email X,
then write `inviteLookup/X` naming yourself editor of an org you don't belong to, then re-trigger
`ensureUserDocument`'s login-time invite consumption to join that org). The fix is
`allow create: if isOrgEditor(request.resource.data.orgId);`. Verified by tracing the ONE legitimate client
write path (`TeamView.vue:274`, inside `onInviteMember`, called only from a TeamView UI gated to org editors)
— tightening to `isOrgEditor(request.resource.data.orgId)` does not break it, because the caller is already
viewing TeamView as an editor of `authStore.orgId`, which is the exact `orgId` written into the lookup doc.
The two things that MUST also be re-verified, not assumed, before calling this "done":
1. **The read/consume path is untouched by this change.** `ensureUserDocument` (auth.ts:694) only ever
   `getDoc`s and later `delete`s `inviteLookup/{email}` — never creates it — so tightening `allow create` has
   zero effect on first-login consumption. But this must be *proven* (traced), not assumed from the rule name
   alone, because a rules mistake here (e.g. accidentally also touching `allow read`/`allow delete`) would
   silently break every future invited user's first login — a much worse regression than the self-invite hole
   it fixes, and one that would only surface when a *new* person tries to accept an invite, not in everyday
   testing by existing members.
2. **The admin-provisioning write path is Admin-SDK, not client-SDK.** `orgProvisioning.ts:217` also writes
   `inviteLookup/{email}` (for the "assign additional admin" flow from the Organizations tab), but via the
   Admin SDK inside a callable Function — which bypasses `firestore.rules` entirely. This path is unaffected by
   the rules tightening either way; conflating it with the client path (and writing a test that exercises the
   callable instead of the direct client write) would give false confidence that the client-side hole is closed.

**Why it happens:**
"Gate creation to org-editor" sounds like an isolated, one-line rule change, but `inviteLookup` has THREE
distinct write/read actors (TeamView's client create, ensureUserDocument's client read+delete at login,
orgProvisioning's Admin-SDK create) and it's easy to reason about only the one you're fixing and assume the
others are unaffected rather than tracing each one.

**How to avoid:**
- Grep every reference to `inviteLookup` across `src/` AND `functions/src/` (not just `firestore.rules`)
  before touching the rule, and classify each as client-SDK (rules apply) or Admin-SDK (rules don't apply).
- Write BOTH an ALLOW and a DENY rules test in `src/rules.test.ts` (this repo's established convention — every
  prior rules change in this file ships with paired allow/deny cases, e.g. the `shareTokens`/`quarterShares`
  CR-01 fixes cited in the rules file's own comments): DENY a non-editor (or an editor of a DIFFERENT org)
  creating `inviteLookup/{email}` with `orgId: <target org>`; ALLOW an editor of the target org creating it.
  Then add a THIRD test proving the existing login-consumption flow (an invited user's own-email `getDoc` +
  `delete`) still passes unchanged — this is the regression guard for point 1 above, and it doesn't exist
  today because the create-tightening doesn't exist today.
- Do not let "fixing 999.11" be scoped as one line in `firestore.rules` with no accompanying trace-through of
  `auth.ts`, `TeamView.vue`, and `orgProvisioning.ts`.

**Warning signs:**
A phase that changes only `firestore.rules` and adds only one new test case (the DENY case) without an ALLOW
case and without a regression test for the first-login consume path; a PR that doesn't mention checking
`orgProvisioning.ts`.

**Phase to address:**
Security & data-integrity hardening phase (999.11). Ships as an UNDEPLOYED `firestore.rules` change per this
project's standing deploy discipline — hand off the exact `firebase deploy --only firestore:rules` command,
do not deploy autonomously.

---

### Pitfall 5: Assuming the `createdBy` finding (999.11's other half) is stale because the rules were "reworked in v2.1" — it is not

**What goes wrong:**
PROJECT.md flags this as needing re-verification "since the rules were reworked in v2.1." Direct inspection of
the CURRENT `firestore.rules` (post Phase 76–78 rework) shows: `allow update: if isOrgEditor(orgId) &&
preservesLifecycleFields();` on `organizations/{orgId}`. `preservesLifecycleFields()` protects exactly 5 fields
(`active`, `deactivatedAt`, `deactivatedBy`, `reactivatedAt`, `reactivatedBy`) via a `diff().affectedKeys()`
check — and **`createdBy` is not in that list**. The v2.1 rework added lifecycle-field protection for an
unrelated reason (the deactivate/delete feature) and never touched `createdBy`. The finding is still fully
open: any org editor can still `updateDoc(organizations/{orgId}, { createdBy: 'someone-else' })` and rewrite
provenance. The risk here is doing a shallow "was this fixed?" check (skimming the rework's changelog/commit
messages, which talk about lifecycle fields, not `createdBy`) and marking 999.11 as "half already handled by
v2.1" without opening the actual rule text.

**Why it happens:**
The v2.1 rework touched the exact same rule block for a different, well-documented reason, creating a false
sense that "this area was already hardened." Reading the phase-78 commentary about `preservesLifecycleFields()`
without reading which fields it actually lists is the trap.

**How to avoid:**
Re-verify by reading the literal `preservesLifecycleFields()` field list (5 fields, no `createdBy`) rather than
trusting the rework's narrative. Fix by extending the SAME established pattern — add `createdBy` to an
immutable-fields helper (either folded into `lifecycleFields()`'s array or a sibling `immutableFields()` used
the same way) — reusing the proven `diff().affectedKeys()` idiom rather than inventing a new mechanism. This is
lower-risk than it looks precisely because the pattern to copy already exists and is already tested for
lifecycle fields; mirror the test shape (ALLOW: editor updates unrelated field; DENY: editor's update diff
touches `createdBy`) directly.

**Warning signs:**
A phase plan that lists 999.11 as "just the self-invite half, createdBy already resolved by v2.1" without a
quoted excerpt of `preservesLifecycleFields()`'s field array.

**Phase to address:**
Security & data-integrity hardening phase (999.11), same phase and same rules-test file as Pitfall 4 — both are
`organizations`-collection rule tightenings and belong in one rules-review pass, not two.

---

### Pitfall 6: Porting `deleteQuarter`'s share-revocation pattern to `deleteService` naively misses that services can have MULTIPLE stale `shareTokens` docs

**What goes wrong:**
`deleteQuarter` (quarters.ts:460) revokes shares via a **direct reference**: the quarter document stores a
single `shareToken` field, so revocation is "does `shareTokens/{quarter.shareToken}` exist? delete it" plus one
deterministic `quarterShares/{slug}__q{N}-{year}` doc. Services do NOT have this single-pointer shape: the
share-adoption logic (`services.ts:676`, `pickAdoptableToken`) explicitly QUERIES
`shareTokens where serviceId == service.id` because more than one `shareTokens` doc can exist for the same
service over its lifetime (the code adopts the newest compatible one rather than assuming exactly one exists).
A `deleteService` implementation that copies `deleteQuarter`'s single-reference pattern (e.g. reads
`service.shareToken` if such a field is even added, deletes just that one doc) will leave orphaned OLDER
`shareTokens` docs for the same `serviceId` still publicly readable and pointing at slide/roster data belonging
to a deleted service — a partial revocation that looks complete in manual testing (the "current" token is
revoked) but isn't.

**Why it happens:**
`deleteQuarter` is the obvious, nearby precedent and its code comments explicitly invite reuse ("Deleting
shareTokens/quarterShares requires the org-editor delete rules added alongside this action"). But quarters and
services have genuinely different share-token cardinality (one vs. potentially-many), and that structural
difference is easy to miss when pattern-matching on the surface shape of the code rather than the underlying
data model.

**How to avoid:**
- Model `deleteService` on the QUERY-based lookup already used by `pickAdoptableToken`
  (`query(collection(db,'shareTokens'), where('serviceId','==', service.id))`), not on `deleteQuarter`'s single
  `shareToken`-field lookup. Delete every doc the query returns, not just the newest/adopted one.
- Also delete `serviceShareLinks/{serviceId}` (the identity doc, single-doc-per-service, straightforward) and
  the deterministic `serviceShares/{slug}__service-{date}` memorable-URL doc (same pattern as `quarterShares`).
- Revoke public docs BEFORE deleting the service document itself (mirrors `deleteQuarter`'s explicit ordering
  rationale: "revoked FIRST so a deleted [service] can never leave a live, unauthenticated share link
  dangling") — if revocation throws partway through, the service itself should NOT be deleted yet, so a retry
  doesn't leave a half-deleted orphan.
- Confirm (already true per PROJECT.md/PENDING-VERIFICATION.md C5) that the existing `allow delete` rules on
  `shareTokens`/`serviceShareLinks`/`serviceShares` are already editor-scoped and need NO rules change — verify
  this by reading the rules directly (they are: `shareTokens` delete is `isOrgEditor(resource.data.orgId)`,
  confirmed at rules line ~502) rather than re-deriving it, but DO add a rules test if one doesn't already
  exist proving an editor can delete a service's stale share docs.

**Warning signs:**
A `deleteService` implementation that reads a single `service.shareToken`-like field instead of querying by
`serviceId`; a manual test that only checks "the CURRENT share link 404s" without first minting a second/older
token for the same service (via a re-share) and confirming it's ALSO gone.

**Phase to address:**
Security & data-integrity hardening phase (999.10). Add a unit test that seeds 2+ `shareTokens` docs for the
same `serviceId` (simulating repeated share/re-share) and asserts `deleteService` removes all of them, plus the
`serviceShareLinks` and `serviceShares` docs.

---

### Pitfall 7: Resend domain verification is an EXTERNAL, asynchronous prerequisite that the app cannot detect or block on

**What goes wrong:**
Switching `config.sender.fromAddress` away from `onboarding@resend.dev` is a **live, admin-editable config
value with no redeploy** (per the code comment at `index.ts:2658-2667`) — which makes it deceptively easy to
flip in the Owner Console before the domain is actually verified in the Resend dashboard. If the DNS records
(SPF/DKIM, and ideally DMARC) haven't finished propagating — or were entered wrong — every send from that
address gets a `403 domain is not verified` from Resend's API, caught by the existing per-recipient try/catch
in `sendQueuedMessageHandler` (index.ts:3007+), which marks that ONE recipient `status: 'failed'` and moves on.
With a full roster, this means volunteers silently don't get scheduled reminders or composer sends, while the
message doc shows a `partial`/`failed` status rollup that's easy to miss if nobody's watching the Messages tab
that week — the failure mode is invisible unless someone is actively checking send outcomes right after the
switch. Separately, `*.web.app`/`*.firebaseapp.com` addresses can never be verified (Google-managed, no DNS
access the owner controls) — picking one as the "verified" address is a dead end that looks plausible because
it's the app's own domain.

**Why it happens:**
DNS propagation is asynchronous and can take minutes to 48 hours; Resend's dashboard will show "pending" or
"verified" per record (SPF/DKIM/DMARC) but nothing in THIS app checks that status before honoring a changed
`fromAddress` — the config write and the domain's actual DNS state are two unrelated systems with no
cross-check. A person switching the address in the console has no in-app signal that the domain isn't ready
yet; they find out only when a send fails, minutes or days later.

**How to avoid:**
- Sequence: verify the domain fully in Resend's dashboard (all DNS records show "Verified," not "Pending")
  BEFORE editing `config.sender.fromAddress` in the Owner Console — never flip the config value first "to get
  ahead of it."
- Send a real test message to a real external inbox (not the Resend account owner's own address, which is the
  ONLY address test-mode `onboarding@resend.dev` ever actually delivers to) immediately after the switch, and
  manually check for `partial`/`failed` on that message's delivery-history rollup — this is the closest thing
  to a smoke test available today, since there's no automated verification-status check.
- Never choose a `*.web.app`/`*.firebaseapp.com`/other platform-managed subdomain as the target — pick a
  domain the owner controls DNS for.
- Consider (as a follow-up, not necessarily this phase) surfacing Resend's own domain-verification API/webhook
  status in the Owner Console next to the `fromAddress` field, so a not-yet-verified domain is visibly flagged
  rather than silently failing on first real send. If out of scope for v2.2, at minimum document in the Owner
  Console UI (a warning string near the field) that this is an external, unchecked prerequisite.
- Confirm DKIM AND SPF are both configured (Resend requires both for full deliverability, and DMARC is
  recommended) — a domain that shows "verified" for DKIM alone can still land in spam industry-wide for
  volunteer email providers (Gmail/Outlook) that weight SPF/DMARC alignment heavily.

**Warning signs:**
The Owner Console lets `fromAddress` be saved to any string with no format/domain validation at all
(`coerceSender` in `appConfig.ts` only checks it's a non-empty string, not that it's a plausible verified
address); a switch to a new address with no accompanying test-send-and-check step; anyone treating "I changed
the setting" as equivalent to "volunteers now receive mail."

**Phase to address:**
Polish & ops phase (999.6). This is fundamentally an OWNER-run operational task (DNS is external to this
repo), so the phase's deliverable is: the in-app config surface + guidance/warning copy + a documented
manual verification runbook — not an automated guarantee, since the app genuinely cannot see Resend's DNS
verification state without new API integration.

---

### Pitfall 8: a11y retrofit on the Owner Console tab strips regresses the `v-show`-always-mounted invariant or the route-query deep-link behavior

**What goes wrong:**
`OwnerConsoleView.vue` deliberately uses `v-show` (never `v-if`) between its Configuration/Organizations panes,
with an explicit comment: "`ConfigurationTab`'s roster `onSnapshot` … stays alive for the life of this console
regardless of which tab is active." The existing tab strip is "plain buttons, no ARIA tab roles" by deliberate
prior design choice (per the component's own comment citing the UI-SPEC). Retrofitting standard
`role="tablist"`/`role="tab"`/`aria-selected` ARIA-tabs semantics commonly comes bundled (from copy-pasted
patterns/tutorials) with: (a) switching panels from `v-show` to conditional rendering or `hidden` attribute
toggling tied to `v-if`-like unmount semantics, which would kill the always-subscribed `onSnapshot` invariant
and reintroduce a bug class already fixed once; (b) adding roving-tabindex + arrow-key handlers that don't
account for the existing `@click="setTab(...)"` + `router.replace({ query: { ...route.query, tab } })`
deep-link sync, potentially causing keyboard nav to update `aria-selected` without updating the route query (or
vice versa if implemented sloppily), desyncing the URL from the visible tab; (c) doing this ONLY in
`OwnerConsoleView` and forgetting `ServiceEditorView.vue`'s tab strip, which PROJECT.md explicitly says mirrors
the SAME pattern and is called out as part of the SAME 999.7 backlog item ("best done as one cross-surface
pass").

**Why it happens:**
Standard ARIA-tabs reference implementations (WAI-ARIA APG tab pattern) assume a simpler component that owns
both selection state and panel mounting; this codebase's actual requirements (always-mounted panels for live
listeners, URL-synced state) are project-specific constraints that a generic a11y retrofit tutorial won't know
about, and a11y work is often done by pattern-matching against "the" accessible-tabs example rather than
adapting it to the existing component's real constraints.

**How to avoid:**
- Add ARIA attributes (`role="tablist"` on the button container, `role="tab"` + `aria-selected` on each button,
  `aria-controls`/`id` linking button to panel, `role="tabpanel"` on each `v-show` div) WITHOUT changing how
  panels are shown/hidden — `v-show` + `aria-hidden`/`hidden` (via `:hidden="activeTab !== 'x'"`, which is just
  a CSS-affecting attribute, not a Vue conditional-render directive) can coexist with the existing
  `onSnapshot`-stays-alive requirement; verify this explicitly by checking the roster listener is STILL firing
  updates while a non-Configuration tab is displayed, after the change.
  wire it to `setTab()` (which already updates the route query) so the two are never a second source of truth.
  and OWNER onboard/assign forms (999.7's OTHER half) in the same pass, per PROJECT.md's own "best done as one
  cross-surface pass" framing — don't split into two phases where the second forgets the first's approach.
- Add a regression check (manual or automated) that the roster onSnapshot listener is still active / the
  Organizations tab's live list still updates while the Configuration tab is visible, after the retrofit —
  this is the one behavior most likely to silently break and least likely to be caught by an a11y-focused
  review (a11y reviewers check ARIA correctness, not Firestore listener lifecycle).

**Warning signs:**
A diff that changes `v-show` to `v-if` "to make the tabpanel semantics cleaner"; new keyboard-arrow-key handler
code with no corresponding `router.replace` call; a PR that touches only `OwnerConsoleView.vue`/`ConfigurationTab.vue`/`OrganizationsTab.vue`
without also touching `ServiceEditorView.vue`'s tab strip or the super-admins/onboard/assign form inputs also
named in 999.7.

**Phase to address:**
Polish & ops phase (999.7), as one cross-surface pass covering both the tab-strip ARIA semantics AND the
plain-`<label>`/`aria-label` form-input retrofit (super-admins grant form, Organizations onboard + assign
forms) — do not split across phases.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Adding `teams` as an `OrgSettings` array field instead of a seeded subcollection (skipping the "model like DEFAULT_ROLES" instruction) | Less code, reuses existing `loadOrgContext` merge machinery | Diverges from the roster-roles precedent SEED-002 explicitly asked to mirror; team CRUD UX (add/rename/delete a team) has no analog to build from if it's just an array, unlike roles which already have full CRUD | Only acceptable if the phase plan explicitly re-justifies this over subcollection docs, with the tradeoff written down |
| Leaving `sundayOrdinal()`'s dead helper code in `NewServiceDialog.vue` after removing its call sites (comment it out "in case we want it back") | Fast, reversible | Dead code that will confuse the next person auditing this exact file for "hard-coded church rules" (the very audit that produced SEED-002) | Never — delete it; git history is the undo button |
| Treating the Resend "test-mode only delivers to account owner" behavior as sufficient smoke-testing for the verified-domain switch | No extra test-recipient setup needed | Gives false confidence — test-mode success proves nothing about the NEW verified-domain path, which is the one thing actually changing | Never for this specific migration — a real external test recipient is required post-switch |
| Reusing `deleteQuarter`'s exact code shape for `deleteService` via copy-paste instead of adapting for the query-based multi-token lookup | Fast, "looks the same as the working precedent" | Orphaned `shareTokens` docs for re-shared services stay publicly readable after "deletion" — a real data-exposure bug, not cosmetic debt | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|------------------|--------------------|
| Resend (verified domain) | Flip `config.sender.fromAddress` in the Owner Console before Resend's dashboard shows all DNS records (SPF/DKIM) as "Verified" | Verify in Resend's dashboard first; only then edit the live config value; test-send to a real external inbox immediately after |
| Resend (verified domain) | Assume `*.web.app`/`*.firebaseapp.com` can be used as a "verified" sending domain since it's already the app's own domain | Use a domain the owner actually controls DNS for; Google-managed platform domains can never be verified in Resend |
| Firestore rules (`firestore.exists()` cross-service) | Assuming a Storage-emulator rules test failure for a NEW rule means the rule is wrong, without checking whether the rule relies on `firestore.exists()` (permanently inert in the Storage emulator per firebase-js-sdk#6803) | For any new/changed `storage.rules` touching this milestone's features, check whether it needs a cross-service Firestore read; if so, treat local Storage-emulator ALLOW-case failures as an environment limitation ONLY after confirming the same signature (all DENY pass, all ALLOW fail) that the documented prior incident showed — don't assume, re-derive |
| Firestore rules deploy discipline | Deploying a `firestore.rules`/`storage.rules`/new-callable change autonomously because "it's just a tightening, low risk" | Per this project's standing discipline, EVERY such change ships built + tested + UNDEPLOYED with the exact `firebase deploy` command handed to the owner — 999.11's rules tightenings are no exception even though they're narrowing (not widening) access |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| `deleteService`'s new share-revocation query (`shareTokens where serviceId ==`) run without a composite index if later combined with an `orgId` filter | Deploy-time Firestore error demanding a composite index, or a silent full-collection-ish scan | Confirm the existing `pickAdoptableToken` query (already same shape) works today without a new index requirement before assuming `deleteService`'s reuse of it needs one too | Only at deploy time if an index truly is required — verify by testing against the emulator, which surfaces missing-index errors identically to prod |
| Per-org team list read on every `ServiceEditorView`/`NewServiceDialog` mount, if implemented as a full subcollection fetch rather than reusing the already-subscribed roster/org-context store | Extra Firestore reads per service-editor open, multiplied across concurrent editors | Piggyback the team list onto the existing per-org context subscription (same store/pattern already loading `OrgSettings`/roles) rather than adding a new independent listener | Negligible at this app's team size (2–3 active planners); flag only if team count or editor concurrency grows significantly |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Fixing `inviteLookup` create without also re-checking the `read`/`delete` rules for unintended collateral tightening | A rules typo could accidentally deny the first-login invite-consumption read/delete, locking out every newly invited user until noticed | Add the explicit regression test for the read+delete-at-login path (own-email `getDoc`+`delete`) alongside the new create-tightening tests, not just the DENY case for the vulnerability being fixed |
| Leaving `createdBy` unprotected on `organizations/{orgId}` while believing v2.1's rework already covered it | An org editor can rewrite provenance (`createdBy`) undetected; audit trails become unreliable | Extend the existing `preservesLifecycleFields()`-style `diff().affectedKeys()` guard to include `createdBy`, verified by reading the current field list, not by trusting the v2.1 changelog narrative |
| Orphaned `shareTokens` docs left live after `deleteService` (partial revocation) | A deleted service's roster names/song slides/schedule remain publicly viewable via an old share link forever | Query-delete ALL `shareTokens` docs matching `serviceId`, not just the currently-adopted one; add a multi-token regression test |
| Storing a `MESSAGE_FROM_ADDRESS`-equivalent value with no domain-plausibility validation | An admin can silently misconfigure sending to a value that will 403 every send (typo domain, unverifiable platform domain) | `coerceSender` currently accepts any non-empty string; consider adding, at minimum, a warning/format hint in the Owner Console UI even if full verification-status checking is out of scope |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Silent `partial`/`failed` message status after a botched domain switch | Volunteers stop getting reminders/composer sends with zero visible error to the admin unless they happen to check the Messages tab | Treat the first send after any `fromAddress` change as a manual verification step (send + check delivery rollup), and consider surfacing a banner/warning if the address was recently changed and no successful send has been recorded yet |
| Ordinal-Sunday auto-team-selection removed with no replacement guidance | A planner who relied on the app pre-selecting Orchestra/Communion/Choir now has to remember and manually pick teams every time, with no discoverable default | Decide and document what fills the gap (org-level default from A1, or explicit "no default, always ask") rather than leaving new-service team selection blank with no explanation |
| a11y retrofit changes visual focus order/keyboard behavior on the Owner Console tab strip that owners are already used to | Muscle-memory click behavior still works, but adding roving-tabindex incorrectly could make Tab-key navigation skip or trap unexpectedly | Test keyboard navigation manually (Tab, Shift+Tab, Arrow keys, Enter/Space) after the retrofit against the ACTUAL super-admin flows this console serves, not just automated ARIA-role assertions |

## "Looks Done But Isn't" Checklist

- [ ] **Per-org team list (999.8/A1):** Often missing a repoint of BOTH duplicated read sites — verify
      `ServiceEditorView.vue` AND `NewServiceDialog.vue` both read the same merged/seeded source, not just one.
- [ ] **`inviteLookup` create tightening (999.11):** Often missing the regression test for the login-time
      read+delete-at-first-invite path — verify a NEW rules test exists proving an invited user can still
      accept their invite, not just that a non-editor can no longer create one.
- [ ] **`createdBy` immutability (999.11):** Often "verified" by reading the v2.1 changelog instead of the
      literal current rule text — verify by quoting `preservesLifecycleFields()`'s actual field array and
      confirming `createdBy` was added to it (or an equivalent guard).
- [ ] **`deleteService` share revocation (999.10):** Often tested against only the single currently-active
      share link — verify by seeding 2+ `shareTokens` docs for one `serviceId` (simulating re-share) and
      confirming ALL are gone after delete, plus `serviceShareLinks` and `serviceShares`.
- [ ] **Resend verified domain (999.6):** Often "done" once the config value is saved — verify a real send to
      a real EXTERNAL inbox (not the Resend account owner's address) succeeds AFTER the domain shows fully
      "Verified" (all DNS records) in Resend's dashboard, not merely "added."
- [ ] **Owner Console a11y retrofit (999.7):** Often done on one tab strip and forgotten on the other — verify
      BOTH `OwnerConsoleView.vue` and `ServiceEditorView.vue` tab strips got the same ARIA treatment, and the
      roster `onSnapshot` listener is still confirmed alive while the Configuration tab is hidden.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-------------------|
| Team-list backfill breaks an existing org's team display (shows empty/wrong teams) | LOW | The merge/seed is additive and non-destructive by design (mirrors `DEFAULT_ORG_SETTINGS`'s pattern); revert the read-site repoint commit, or fix the merge default value to the known-correct four teams — no data was overwritten if the pattern was followed correctly |
| `inviteLookup` create tightening accidentally blocks legitimate first-login invite acceptance | MEDIUM | Undeployed rules are reversible with zero data loss (revert the rule, redeploy); if ALREADY deployed and a user is stuck, an org editor can manually re-invite them via the same UI, or an admin can hand-write the member doc via the Firebase console |
| `deleteService` share-revocation leaves an orphaned `shareTokens` doc | LOW | Query `shareTokens where serviceId == <id>` manually (Firebase console or a one-off script) and delete any remaining docs for since-deleted services — no schema change needed, purely a cleanup pass |
| Resend domain switch causes a silent send outage | LOW–MEDIUM | Revert `config.sender.fromAddress` to `onboarding@resend.dev` immediately (live config, no redeploy) to restore the AI-proxy-style "known working" fallback while DNS/verification is fixed; no messages are lost, only delayed — queued messages remain in Firestore for reprocessing once the address is fixed |
| a11y retrofit breaks the always-mounted `onSnapshot` invariant | LOW | Revert the `v-if`/conditional-render change back to `v-show`; ARIA attributes themselves are additive and don't need reverting |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|-----------------|
| Trusting stale SEED-002 catalog numbers | Configurable Teams (999.8) | Phase plan opens with a fresh grep of every SEED-002 file/line reference, diffed against the seed's claims |
| Team-list backfill/default-merge safety | Configurable Teams (999.8, A1) | Test: existing-org fixture (no teams field/docs) resolves to today's exact 4-team default after the change |
| Ordinal-Sunday removal test regression | Configurable Teams (999.8, B1) | `NewServiceDialog.test.ts` asserts the DELIBERATE new default-team behavior, not a gutted/deleted assertion |
| `inviteLookup` create tightening breaking first-login | Security & Data-Integrity Hardening (999.11) | New rules test: ALLOW org-editor create, DENY non-editor/cross-org create, ALLOW existing invited-user own-email read+delete unaffected |
| `createdBy` immutability re-verification | Security & Data-Integrity Hardening (999.11) | Rules test extending `preservesLifecycleFields()`'s pattern to `createdBy`; quote the literal field-array diff in the PR/plan |
| `deleteService` partial share-token revocation | Security & Data-Integrity Hardening (999.10) | Unit test seeding 2+ `shareTokens` docs for one serviceId; assert all + `serviceShareLinks` + `serviceShares` removed |
| Resend verified-domain silent failure | Polish & Ops (999.6) | Manual runbook step: real external test-send after Resend shows full DNS verification; no automated check exists, so this is a documented manual gate |
| a11y retrofit regressing `v-show`/route-query invariants | Polish & Ops (999.7) | Manual/automated check: Organizations tab's live listener still updates while Configuration tab is displayed; keyboard nav tested against actual console flows; both tab strips (`OwnerConsoleView` + `ServiceEditorView`) covered in one pass |

## Sources

- `C:\projects\worshipplanner\firestore.rules` — direct read of `isOrgEditor`/`isOrgMember`/`isOrgActive`,
  the `organizations/{orgId}` update rule + `preservesLifecycleFields()`, `inviteLookup/{email}`,
  `shareTokens`/`serviceShareLinks`/`serviceShares` delete rules (2026-08-23 state).
- `C:\projects\worshipplanner\src\stores\auth.ts` (`ensureUserDocument`, lines ~670-730) — first-login invite
  consumption flow.
- `C:\projects\worshipplanner\src\views\TeamView.vue` (`onInviteMember`, lines ~240-315) — client-side
  `inviteLookup` create call site.
- `C:\projects\worshipplanner\functions\src\orgProvisioning.ts` (line ~217) — Admin-SDK `inviteLookup` write
  for the assign-additional-admin flow.
- `C:\projects\worshipplanner\src\stores\quarters.ts` (`deleteQuarter`, lines ~452-483) and
  `C:\projects\worshipplanner\src\stores\services.ts` (`deleteService` line ~403, `pickAdoptableToken`
  query line ~676) — compared share-revocation shapes (single-reference vs. query-based).
- `C:\projects\worshipplanner\functions\src\index.ts` (lines ~2630-2670, ~2980-3030) —
  `sendQueuedMessageHandler`, `config.sender.fromAddress` resolution, Resend send call + comments on
  verified-domain requirement and `onboarding@resend.dev` test-mode behavior.
- `C:\projects\worshipplanner\functions\src\appConfig.ts` (`DEFAULT_APP_CONFIG`, `coerceSender`) — sender
  config defaults and validation (or lack thereof).
- `C:\projects\worshipplanner\src\types\organization.ts` (`DEFAULT_ORG_SETTINGS`, `settings?` JSDoc) and
  `C:\projects\worshipplanner\src\stores\roster.ts` (`seedDefaultRolesIfEmpty`, `DEFAULT_ROLES`) — the two
  coexisting default-merge/backfill precedents.
- `C:\projects\worshipplanner\src\views\ServiceEditorView.vue` (`AVAILABLE_TEAMS` line 1675, Orchestra filter
  lines 3426/3537) and `C:\projects\worshipplanner\src\components\NewServiceDialog.vue`
  (`sundayOrdinal`/ordinal team pre-selection, lines ~145-201) plus its test file — hard-coded team-rule
  duplication, verified live as of this research pass (contra the seed's stale VW_TYPE_LABELS count).
- `C:\projects\worshipplanner\src\views\OwnerConsoleView.vue` — tab-strip `v-show` + route-query sync +
  explicit "no ARIA tab roles" prior design comment.
- `C:\projects\worshipplanner\.planning\seeds\SEED-002-church-specific-rules-configurability.md` — catalog
  and A/B/C verdicts (re-verified, not taken at face value — see Pitfall 1).
- `C:\projects\worshipplanner\.planning\PROJECT.md` — v2.2 scope, backlog items 999.1–999.11, deploy
  discipline statement.
- `C:\projects\worshipplanner\CLAUDE.md` — rules-testing discipline, Storage-emulator `firestore.exists()`
  limitation precedent, deploy-hand-over discipline.

---
*Pitfalls research for: WorshipPlanner v2.2 Configurability, Hardening & Cleanup*
*Researched: 2026-08-23*
