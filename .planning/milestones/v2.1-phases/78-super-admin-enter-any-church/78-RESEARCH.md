# Phase 78: Super-Admin Enter-Any-Church - Research

**Researched:** 2026-08-23
**Domain:** Firestore/Storage security rules composition + Pinia auth-store multi-tenant context switching
**Confidence:** HIGH (grounded in direct reads of the CURRENT post-76/77 `firestore.rules`, `storage.rules`,
`src/rules.test.ts`, `src/storage.rules.test.ts`, `src/stores/auth.ts`, `src/router/index.ts`,
`src/views/TeamView.vue`, `src/components/admin/OrganizationsTab.vue`, `src/stores/__tests__/auth.test.ts`
— no external library research needed, this phase touches zero new dependencies)

## Summary

The dominant risk named in the task brief is real and independently confirmed by reading the router: adding
a naive `|| isSuperAdmin()` arm to `isOrgMember`/`isOrgEditor` is *not* the dangerous part (Phase 77's
`allow delete: if false` has no reference to either helper, so it is structurally immune). The two actual
landmines are (1) the org-doc `allow update` rule, which currently reads
`isOrgEditor(orgId) && (preservesLifecycleFields() || isSuperAdmin())` — once `isOrgEditor` itself grants
super-admins editor status, that clause's `|| isSuperAdmin()` becomes a live lifecycle-field bypass and must
be deleted, not kept; and (2) a client-side regression invisible to the rules layer entirely: `authStore`'s
`hasNoOrg` computed (`memberships.value.length === 0`) does not know about a super-admin's *temporary*
viewed org, so the very first navigation after "Enter church" would bounce the super-admin straight back to
`/select-church` via the router's `requiresOrgSelection` guard (`src/router/index.ts:138-145`) — a pure
regression with zero rules-file involvement, found only by reading the router.

The recommended rules change is a two-line restructure of `isOrgMember`/`isOrgEditor` (move `isSuperAdmin()`
to the front of an OR, dropping the now-dead inner `|| isSuperAdmin()` active-check exemption since the
outer arm subsumes it) plus a one-clause deletion on the org-doc `allow update` rule
(`preservesLifecycleFields() || isSuperAdmin()` → `preservesLifecycleFields()`, unconditionally, for
everyone). `storage.rules`' `isOrgMemberByClaim` gets the same shape: `request.auth.token.superAdmin == true`
ORed in front of the existing membership-AND-not-deactivated clause, which also lets the now-redundant
`|| request.auth.token.superAdmin == true` inside `isOrgDeactivatedForCaller`'s caller be dropped. Neither
file's `allow delete` or org-doc `allow create` needs to change at all.

**Primary recommendation:** Restructure `isOrgMember`/`isOrgEditor` (firestore.rules) and
`isOrgMemberByClaim` (storage.rules) to OR `isSuperAdmin()`/`token.superAdmin==true` in FRONT of the existing
membership check (not merely into the deactivation sub-clause), and — this is the load-bearing follow-on —
delete the `|| isSuperAdmin()` disjunct from the org-doc `allow update` lifecycle guard so lifecycle fields
stay Admin-SDK-only for literally everyone. On the client, add `enterOrgAsSuperAdmin`/`exitSuperAdminView` to
`auth.ts` as new functions (not a `selectOrg` variant), set `userRole` directly (there is no member doc for
the `onSnapshot` listener to find), and fix `hasNoOrg`/`needsOrgSelection` to exclude the viewing-as-super-
admin state or the router will strand the super-admin on `/select-church`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Super-admin content read/write on any org | API/Backend (Firestore/Storage rules) | — | Enforcement must live in `firestore.rules`/`storage.rules` — the actual security boundary; client code only reflects it |
| Org-doc lifecycle field protection (active/deactivatedAt/etc.) | API/Backend (rules) + Cloud Function | — | Admin-SDK-only write path (`setOrgActive`); rules must deny ALL client writes to these fields, super-admin included |
| Org-doc DELETE protection | API/Backend (rules) | — | Unconditional `allow delete: if false` (Phase 77); zero exemptions, including super-admin |
| Active-org context switch ("Enter church") | Frontend Server/Client store (Pinia `auth.ts`) | — | Client-side session state; the org context switch itself carries no privilege — the rules layer independently re-authorizes every subsequent read/write |
| Hidden membership (no member doc, invisible in team list) | Frontend Client (no write emitted) + API/Backend (rules don't auto-create) | — | Achieved by omission: neither the client code nor any rule creates a doc; `TeamView`/`listOrganizations` read only the `members` subcollection, which stays empty for the super-admin |
| "Viewing as super-admin" banner + exit | Browser/Client (Vue component, `AppShell.vue`) | — | Pure UI state, driven by the store's `viewingAsSuperAdmin` ref |

## Standard Stack

No new libraries. This phase edits `firestore.rules`, `storage.rules`, `src/stores/auth.ts`,
`src/components/admin/OrganizationsTab.vue`, `src/components/AppShell.vue`, `src/router/index.ts` (one
computed fix), and their existing test files (`src/rules.test.ts`, `src/storage.rules.test.ts`,
`src/stores/__tests__/auth.test.ts`, `src/components/admin/__tests__/OrganizationsTab.test.ts`).

## Package Legitimacy Audit

Not applicable — this phase installs zero new packages (pure Firestore/Storage rules text + existing-stack
TypeScript/Vue changes). No `npm view`/`package-legitimacy check` run needed.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ OrganizationsTab.vue (owner console, any org row)                       │
│   [Enter church] button --------------------------------------------┐   │
└───────────────────────────────────────────────────────────────────┼───┘
                                                                      │
                                                                      v
                                                    authStore.enterOrgAsSuperAdmin(orgId)
                                                                      │
                          ┌───────────────────────────────────────────┤
                          │ 1. resetOrgContext() -- wipe any prior     │
                          │    viewed org / stale state                │
                          │ 2. orgId.value = target; viewingAsSuperAdmin│
                          │    .value = target                         │
                          │ 3. getDoc(organizations/{orgId})  ────────►│  firestore.rules:
                          │    (no membership doc exists -- ALLOWED    │  isOrgMember(orgId) now
                          │    by the NEW isOrgMember super-admin arm) │  ORs isSuperAdmin() FIRST
                          │ 4. applyOrgSnapshot(orgData) -- name/slug/ │
                          │    settings/typography (shared w/          │
                          │    loadOrgContext)                         │
                          │ 5. userRole.value = 'editor'  (SET          │
                          │    DIRECTLY -- no member doc, so the        │
                          │    members onSnapshot in loadOrgContext     │
                          │    is never subscribed for this path)       │
                          └───────────────────────────────────────────┘
                                                                      │
                                                                      v
                                                        router.push({ name: 'services' })
                                                                      │
                                                                      v
                          ┌───────────────────────────────────────────────┐
                          │ Router guard (src/router/index.ts:138-145)    │
                          │   authStore.requiresOrgSelection MUST be      │
                          │   false here -- FIX REQUIRED (see Pitfall 1)  │
                          └───────────────────────────────────────────────┘
                                                                      │
                                                                      v
                          ┌───────────────────────────────────────────────┐
                          │ AppShell.vue banner:                          │
                          │  v-if="authStore.viewingAsSuperAdmin"         │
                          │  "Viewing {{ orgName }} as super-admin"       │
                          │  [Exit to owner console] → exitSuperAdminView │
                          │   () + router.push('/owner-console')          │
                          └───────────────────────────────────────────────┘
                                                                      │
                                                                      v
                          Every subsequent Firestore/Storage read or write from
                          this session is independently re-authorized by
                          isOrgMember/isOrgEditor/isOrgMemberByClaim's super-
                          admin arm -- NOT cached from the enter-flow's one-time
                          getDoc. TeamView.vue's onSnapshot(members subcollection)
                          never returns a doc for this uid -- invisible per R226.
```

### Recommended Project Structure

No new files/folders. Edits land in:
```
firestore.rules                                  # isOrgMember / isOrgEditor / org-doc allow update
storage.rules                                     # isOrgMemberByClaim
src/stores/auth.ts                                # enterOrgAsSuperAdmin, exitSuperAdminView,
                                                   #   applyOrgSnapshot extraction, hasNoOrg/needsOrgSelection fix
src/components/admin/OrganizationsTab.vue         # per-row "Enter church" button
src/components/AppShell.vue                       # persistent banner + exit
src/rules.test.ts                                 # new describe blocks (R225 super-admin content arm)
src/storage.rules.test.ts                         # new describe block (R225 storage side)
src/stores/__tests__/auth.test.ts                 # enter/exit unit tests
src/components/admin/__tests__/OrganizationsTab.test.ts   # Enter-church button test
```

### Pattern 1: OR the super-admin arm in FRONT of the membership check, not into a sub-clause

**What:** The Phase 76 pattern ORed `isSuperAdmin()` only into the deactivation sub-clause
(`isOrgActive(orgId) || isSuperAdmin()`), which is a NARROW exemption that still required
`exists(.../members/$(uid))` to be true first (confirmed by the AND in both functions and by
`src/rules.test.ts`'s own comment at line 340-344: *"a super-admin with no membership doc gets nothing new
from this exemption — that is Phase 78's explicit deliverable"*). R225 requires the OPPOSITE shape: access
WITHOUT a membership doc. That means `isSuperAdmin()` must be ORed at the OUTERMOST level, replacing the
`exists() && ...` requirement entirely for a super-admin, not merely waiving one inner condition of it.

**When to use:** Any helper function gating org-scoped access where a "super-user, no local record required"
arm is being added on top of an existing "genuine member record required" arm.

**Example (firestore.rules, exact diff):**
```javascript
// BEFORE (current, post-Phase-76):
function isOrgMember(orgId) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
    (isOrgActive(orgId) || isSuperAdmin());
}

function isOrgEditor(orgId) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('role', '') in ['editor', 'admin'] &&
    (isOrgActive(orgId) || isSuperAdmin());
}

// AFTER (Phase 78, R225):
function isOrgMember(orgId) {
  return isSignedIn() && (
    // Phase 78 (R225): checked FIRST, before the exists() cross-document
    // read, both for correctness (no membership doc will ever exist for a
    // super-admin entering a church they don't belong to) and for cost
    // (Firestore rules short-circuit && / ||, so this skips the billed
    // exists() read entirely on the super-admin path). Deliberately
    // unconditional on isOrgActive() too -- a super-admin can enter a
    // DEACTIVATED org for support (same posture Phase 76 already granted a
    // super-admin WITH a membership doc; R225 extends it to one without).
    isSuperAdmin() ||
    (exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
      isOrgActive(orgId))
  );
}

function isOrgEditor(orgId) {
  return isSignedIn() && (
    isSuperAdmin() ||
    (exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
      get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('role', '') in ['editor', 'admin'] &&
      isOrgActive(orgId))
  );
}
```
Note the inner `|| isSuperAdmin()` that used to live beside `isOrgActive(orgId)` is REMOVED, not kept
alongside the new outer arm — it is now dead code (unreachable: if a super-admin reaches that inner branch,
the outer `isSuperAdmin() ||` already short-circuited true, so the inner disjunct can only be evaluated when
`isSuperAdmin()` is false). Removing it is a pure simplification with no behavior change for the "super-admin
WITH a genuine membership doc on a deactivated org" case — that case is still covered, now by the outer arm.
**This preserves `src/rules.test.ts`'s existing two tests at lines 372-388 ("ALLOWS a super-admin WITH a
genuine membership doc to read/write a deactivated org") verbatim — they must still pass unmodified.**

### Pattern 2: Delete the lifecycle-guard's super-admin exemption, don't keep it

**What:** `organizations/{orgId}`'s `allow update` (firestore.rules:124) currently reads:
```javascript
allow update: if isOrgEditor(orgId) && (preservesLifecycleFields() || isSuperAdmin());
```
This was SAFE before Phase 78 because `isSuperAdmin()` alone never made someone `isOrgEditor(orgId)` — a
super-admin still needed `exists(.../members/$(uid))` to pass the outer `isOrgEditor(orgId)` conjunct, so a
super-admin with NO membership doc could never even reach this update rule (denied by `isOrgEditor` itself,
before the lifecycle disjunct was ever evaluated). **Once Pattern 1 ships, `isOrgEditor(orgId)` is true for
EVERY super-admin on EVERY org — including ones they've never been a member of.** At that point,
`preservesLifecycleFields() || isSuperAdmin()` degenerates to "always true for a super-admin," meaning any
super-admin can `updateDoc(organizations/{orgId}, {active: false, deactivatedAt: ..., deactivatedBy: 'x'})`
directly from the client SDK — the exact CR-01/T-76-10 class of bug the Phase 76 SECURITY follow-up closed
for ordinary editors, now reopened for super-admins by composition. This is the ONE clause in the entire
diff that is dangerous if left unchanged, and it is dangerous *because* of Pattern 1's own OR-composition
rather than because of anything new written for R225 specifically.

**Recommended fix (per CONTEXT.md's own recommendation, confirmed correct by this analysis):**
```javascript
// BEFORE:
allow update: if isOrgEditor(orgId) && (preservesLifecycleFields() || isSuperAdmin());

// AFTER (Phase 78):
// Phase 78 (R225 composition fix): the `|| isSuperAdmin()` disjunct here is
// DELETED, not preserved. Before Phase 78, isOrgEditor(orgId) required a
// genuine membership doc, so a super-admin without one could never reach
// this line -- the exemption was safe. Phase 78's super-admin arm makes
// isOrgEditor(orgId) true for EVERY super-admin on EVERY org, so keeping
// `|| isSuperAdmin()` here would let ANY super-admin client-write
// active/deactivatedAt/deactivatedBy/reactivatedAt/reactivatedBy directly,
// skipping setOrgActive's deactivatedOrgs claim fan-out and
// revokeRefreshTokens -- the CR-01/T-76-10 class of bug, reopened by
// composition. Lifecycle fields are now Admin-SDK-only for LITERALLY
// EVERYONE, super-admins included; setOrgActive/deleteOrganization (both
// Admin SDK, bypassing rules entirely) remain the only path. Proven by
// src/rules.test.ts: a super-admin client updateDoc({active:false}) is
// DENIED and must use the setOrgActive callable.
allow update: if isOrgEditor(orgId) && preservesLifecycleFields();
```
The `preservesLifecycleFields()` function itself needs NO changes — it already has no super-admin awareness;
only its caller's disjunct is removed. The org-doc `allow create` (firestore.rules:129-130) already calls
`preservesLifecycleFields()` unconditionally with no super-admin exemption at all — it needs no change and
was never at risk.

**When to use:** Whenever a new "super-admin bypass" arm is ORed into a base capability check
(`isOrgEditor`), audit every OTHER rule that already contains its own, narrower `|| isSuperAdmin()` — the
new arm can silently widen that narrower exemption's blast radius without the narrower rule's own text
changing at all. This is a composition hazard, not a syntax error, so it will not be caught by a linter or a
diff review of the narrower rule in isolation — it must be caught by re-reading every OTHER caller of the
function being widened. (Confirmed: a repo-wide grep for `isSuperAdmin()` inside `firestore.rules` turns up
exactly three other call sites — `isOrgMember`, `isOrgEditor` themselves [being changed], the org-doc
`allow update` [this pattern], `appConfig`/`superAdmins` [unrelated, no `isOrgEditor` involvement, no
change needed]. The audit is exhaustive at 4 total call sites in the file.)

### Pattern 3: `storage.rules` — OR the super-admin arm around the WHOLE membership-and-deactivation clause

**What:** Mirrors Pattern 1 but for the claim-based Storage function. Current shape
(`storage.rules:48-61`):
```javascript
function isOrgMemberByClaim(orgId) {
  return request.auth != null
    && (
      (request.auth.token.orgs != null && request.auth.token.orgs[orgId] != null)
      || (request.auth.token.orgId == orgId && request.auth.token.role != null)
    )
    && (!isOrgDeactivatedForCaller(orgId) || request.auth.token.superAdmin == true);
}
```
Today a super-admin with NO membership claim entry for `orgId` gets `false` overall — the trailing
`|| request.auth.token.superAdmin == true` only waives the deactivation sub-clause, exactly mirroring
firestore.rules' pre-Phase-78 narrow exemption. R225 needs the super-admin arm to bypass BOTH the membership
clause AND the deactivation clause.

**Exact diff:**
```javascript
// AFTER (Phase 78, R225):
function isOrgMemberByClaim(orgId) {
  return request.auth != null
    && (
      // Phase 78 (R225): checked first -- a super-admin gets Storage
      // read/write on ANY org's path with NO orgId/orgs/role claim entry at
      // all, and regardless of deactivatedOrgs (mirrors the Phase 76
      // deactivation exemption, now unconditional rather than
      // membership-gated). The old `|| request.auth.token.superAdmin ==
      // true` that lived ONLY inside the deactivation sub-clause below is
      // removed as dead code -- this outer arm already subsumes it.
      request.auth.token.superAdmin == true
      ||
      (
        (
          (request.auth.token.orgs != null && request.auth.token.orgs[orgId] != null)
          || (request.auth.token.orgId == orgId && request.auth.token.role != null)
        )
        && !isOrgDeactivatedForCaller(orgId)
      )
    );
}
```
`isOrgDeactivatedForCaller(orgId)` itself is untouched. `isOrgMember(orgId) { return isOrgMemberByClaim(orgId); }`
(the storage.rules wrapper, line 68-70) and both `orgs/{orgId}/media/**` / `orgs/{orgId}/{allPaths=**}` match
blocks need NO changes — they already call `isOrgMember`, which now transparently carries the super-admin
arm through unchanged. **This preserves `src/storage.rules.test.ts`'s existing test at line 225 ("ALLOWS a
super-admin with deactivatedOrgs set for the org, plus a valid membership claim") — it still passes, now
trivially via the new outer arm instead of the old inner one.**

### Anti-Patterns to Avoid

- **Adding `|| isSuperAdmin()` to `organizations/{orgId}`'s `allow delete` rule:** Already correctly avoided
  in the current file (Pitfall 5 of 77-RESEARCH.md, cited in the rule's own comment at firestore.rules:140).
  Confirm the diff touches NOTHING on that line — `allow delete: if false;` stays byte-for-byte identical.
  Grep-verifiable: `isOrgEditor`/`isOrgMember` do not appear anywhere in the delete rule's condition, so
  Pattern 1's changes to those two functions cannot reach it by composition (unlike Pattern 2's hazard).
- **Reusing `selectOrg` for the super-admin enter flow:** `selectOrg` (auth.ts:531-537) hard-guards on
  `memberships.value.some((m) => m.id === targetOrgId)` and returns early if false — a super-admin viewing an
  org they don't belong to will never satisfy that guard. CONTEXT.md's decision to add a SEPARATE
  `enterOrgAsSuperAdmin` function (not a `selectOrg` parameter/overload) is correct; do not try to make
  `selectOrg` "smart" about super-admins, as that couples two conceptually distinct flows and risks a
  membership-guard regression for ordinary multi-org users.
- **Subscribing the `members/{uid}` `onSnapshot` listener for the super-admin's own uid in the viewed org:**
  `loadOrgContext`'s `onSnapshot(doc(db, 'organizations', activeId, 'members', uid), ...)` (auth.ts:472-496)
  is what NORMALLY sets `userRole` from the member doc's `role` field. For a super-admin with no member doc,
  this listener would fire once with `snap.exists() === false` and set `userRole.value = null` — silently
  undoing whatever `enterOrgAsSuperAdmin` set. **Do not call this subscription in the super-admin entry
  path at all** — set `userRole.value = 'editor'` directly and skip the subscription entirely (see Pattern 4).

### Pattern 4: Client enter/exit shape in `auth.ts`

**What:** `enterOrgAsSuperAdmin(orgId)` performs a ONE-TIME read (not a live subscription) of the org doc,
sets `orgId`/`orgName`/`orgSlug`/settings directly, sets `userRole` directly (no member doc exists to derive
it from), and flags `viewingAsSuperAdmin`. `exitSuperAdminView()` reverses it via the existing
`resetOrgContext()` helper. Neither function touches the `members` subcollection in any way — no `setDoc`,
no `onSnapshot` — which is what keeps R226 satisfied (see Runtime State Inventory below for the residual risk
this does NOT close).

```typescript
// New refs (alongside the existing orgId/orgName/... refs):
const viewingAsSuperAdmin = ref<string | null>(null)  // the orgId being viewed, or null
const isViewingAsSuperAdmin = computed(() => viewingAsSuperAdmin.value !== null)

// Recommended refactor (avoids duplicating ~50 lines of settings-merge /
// typography-load logic between loadOrgContext and the new function):
// extract loadOrgContext's "org snapshot -> store state" hydration
// (orgName/orgSlug/pcApp/settings-merge/typography-eager-load, lines
// 370-467 today) into a private function `applyOrgSnapshot(orgData:
// DocumentData): void`, called from BOTH loadOrgContext and
// enterOrgAsSuperAdmin. Do not duplicate the merge logic verbatim; a later
// settings-shape change (another dual-read migration, like R073's) would
// only get applied to one of the two call sites otherwise.

async function enterOrgAsSuperAdmin(targetOrgId: string): Promise<void> {
  const currentUser = user.value
  if (!currentUser || !isSuperAdmin.value) return  // convenience guard only;
    // the real boundary is firestore.rules' isSuperAdmin() -- this local
    // check just avoids a doomed getDoc for a non-super-admin caller.

  resetOrgContext()  // wipe any PRIOR viewed org (or the super-admin's own
                      // normal context, if any) before switching -- same
                      // discipline every other org switch gets.

  const orgRef = doc(db, 'organizations', targetOrgId)
  let orgSnap
  try {
    orgSnap = await getDoc(orgRef)
  } catch (err) {
    console.error('[auth] enterOrgAsSuperAdmin:', err)
    return  // resetOrgContext() already ran; nothing further to undo
  }
  if (!orgSnap.exists()) return  // orgId typo / stale row; leave context empty

  orgId.value = targetOrgId
  viewingAsSuperAdmin.value = targetOrgId
  applyOrgSnapshot(orgSnap.data())  // shared with loadOrgContext (see above)

  // R226 -- effective role for UI gating ONLY, not backed by a members doc.
  // Recommend editor-equivalent (CONTEXT.md's own recommendation) so the
  // super-admin can actually help. Set DIRECTLY: there is no member doc for
  // the onSnapshot listener to find, and loadOrgContext's onSnapshot
  // subscription is deliberately NOT started for this path (see Anti-
  // Patterns above) -- if it were, its first (only) callback would fire with
  // snap.exists() === false and immediately null this back out.
  userRole.value = 'editor'

  // Deliberately no isOrgActive/deactivation check here (unlike
  // loadOrgContext's post-76-01 try/catch around the org-doc read) -- the
  // rules layer (Pattern 1/3) already grants a super-admin unconditional
  // access to a deactivated org's doc, so the read above never throws for
  // that reason, and R225/decisions confirm entering a deactivated org for
  // support is intended, not a bug to guard against.
}

function exitSuperAdminView(): void {
  if (viewingAsSuperAdmin.value === null) return
  resetOrgContext()
  viewingAsSuperAdmin.value = null
}
```

**Router-guard fix (REQUIRED, see Pitfall 1):**
```typescript
// auth.ts -- BEFORE:
const hasNoOrg = computed(
  () => isReady.value && isAuthenticated.value && memberships.value.length === 0,
)
// AFTER:
const hasNoOrg = computed(
  () =>
    isReady.value &&
    isAuthenticated.value &&
    memberships.value.length === 0 &&
    viewingAsSuperAdmin.value === null,
)
```
`needsOrgSelection` already requires `orgId.value === null` (line 147), which is FALSE once
`enterOrgAsSuperAdmin` sets `orgId.value`, so it does NOT need the same fix — only `hasNoOrg` is vulnerable,
because it never inspects `orgId` at all. Confirm this with the emulator/unit test in the Validation
Architecture section below; do not assume the fix is unnecessary just because `needsOrgSelection` happens to
be safe.

**`resetOrgContext()` and `logout()`/`onAuthStateChanged`'s null-user branch:** both must ALSO clear
`viewingAsSuperAdmin.value = null` — `logout()` (auth.ts:645-661) and the `onAuthStateChanged` null-user
branch (auth.ts:512-524) each independently duplicate `resetOrgContext`'s field list rather than calling it,
so `viewingAsSuperAdmin` must be added to BOTH of those inline blocks, not just to `resetOrgContext()` itself
— otherwise a super-admin who logs out while viewing a church leaves `viewingAsSuperAdmin` set across the
next sign-in in the same tab (a stale-banner / stale-role leak, not a security hole since the rules layer
re-authorizes independently, but a real UI bug).

**"Enter church" row action (`OrganizationsTab.vue`):**
```typescript
// New import:
import { useRouter } from 'vue-router'
// ... inside setup:
const router = useRouter()  // undefined in the existing router-less test harness
                             // (OrganizationsTab.test.ts mounts with no global.plugins
                             // router) -- guard every use with `router?.`, mirroring
                             // OwnerConsoleView.vue's own established `router?.replace(...)`
                             // pattern (src/views/OwnerConsoleView.vue:83).

async function onEnterChurch(org: OrgSummary) {
  await authStore.enterOrgAsSuperAdmin(org.orgId)
  router?.push({ name: 'services' })  // landing route -- Claude's discretion per
                                        // CONTEXT.md; 'services' works for both roles
                                        // (unlike 'dashboard', which requiresEditor --
                                        // moot here since userRole is forced to 'editor',
                                        // but 'services' also has no such gate at all,
                                        // making it the safer universal landing route)
}
```
The Enter-church button should NOT be gated on `org.active !== false` the way Delete is — entering a
deactivated org is an explicit, intended support scenario (verifying state before Reactivate), so the button
stays enabled regardless of `org.active`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Super-admin cross-tenant access | A new Cloud Function / custom claim scheme for "enter mode" | The existing `isSuperAdmin()` claim-based gate (v1.9) + a rules-layer OR | The claim already exists, is already proven emulator-safe (claim-only, no cross-service lookup per the storage.rules incident this repo has already suffered), and every other privileged surface (`appConfig`, `superAdmins`) already trusts it |
| Effective-role UI gating for a non-member | A parallel "virtual member" Firestore doc, or a second claim map | A plain client-side ref (`userRole.value = 'editor'`), set directly by `enterOrgAsSuperAdmin` | Any doc-backed approach reintroduces exactly the "member doc created" problem R226 forbids; the UI gate does not need to survive a page reload mid-support-session as a hard requirement (Claude's discretion notes this) |
| Detecting an org's active/deactivated status for the enter flow | A second isOrgActive-style client check before allowing enter | Nothing — just attempt the `getDoc`; the rules layer (Pattern 1) already allows it unconditionally for a super-admin | Duplicating the deactivation check client-side when the rule already grants unconditional access adds a redundant round-trip and a second place that can drift from the rule's actual behavior |

**Key insight:** Every piece of this phase that could be hand-rolled (a virtual membership record, a
parallel claim, a client-side deactivation pre-check) already has a rules-layer or existing-pattern
equivalent that is simpler and strictly more consistent with the rest of the codebase's established
"claim-only super-admin, Admin-SDK-only lifecycle writes" architecture.

## Runtime State Inventory

Not a rename/refactor/migration phase (no strings are being renamed) — this section is included anyway
because the task brief specifically asks to confirm no runtime state gets created as a side effect of the
new "enter church" flow (R226's hidden-ness guarantee). Answering the five categories explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `enterOrgAsSuperAdmin` (Pattern 4) performs exactly one Firestore READ (`getDoc(organizations/{orgId})`) and zero writes. No `members/{uid}` doc, no new top-level collection, nothing added to `users/{uid}.orgIds`. | None. Verified by design (the function contains no `setDoc`/`updateDoc`/`writeBatch` call at all) — enforce with a unit test asserting `setDoc`/`writeBatch` mocks are never invoked by `enterOrgAsSuperAdmin` (see Validation Architecture). |
| Live service config | None — no external service (n8n, Datadog, Tailscale, Cloudflare) is touched by this phase; it is entirely internal to Firestore/Storage rules + the Vue SPA. | None. |
| OS-registered state | None — no scheduled task, pm2 process, or systemd unit is created or renamed by this phase. | None. |
| Secrets/env vars | None — no new secret or env var is introduced; `isSuperAdmin()`/`superAdmin` claim already exists from Phase 68 and is read-only here. | None. |
| Build artifacts / installed packages | None — no new dependency, no `package.json` change. | None. |

**One residual finding that IS a real (pre-existing, not newly-introduced) risk to R226**, surfaced by
reading `firestore.rules:150-152` closely — see Common Pitfalls #3 below: the members subcollection's
`allow write: if isOrgEditor(orgId);` rule already grants ANY genuine org editor (not just super-admins)
the power to `setDoc` an arbitrary NEW member doc for an arbitrary uid, bypassing the narrower R104
`allow create` predicate entirely, because Firestore's `write` operation category legally includes `create`
and rules are OR-evaluated across every matching `allow` statement for the same operation. Once Pattern 1
ships, a super-admin viewing any org also inherits this pre-existing power. **This is not a new hole Phase
78 opens** (a real editor of that org already has it today, for their own org) — but it IS a new *scope*
widening (every super-admin now has it for EVERY org, not just their own), and it means R226's "no member
doc created" guarantee is a **client-code contract**, not a rules-enforced invariant: nothing in
`firestore.rules` stops a super-admin's client from `setDoc`-ing their own member doc if some future code
path ever called it. See Common Pitfalls #3 and Open Questions #1 for the recommended mitigation (a targeted
unit test, not a rules change, since tightening `allow write` on `members/{uid}` to exclude create is
unrelated scope-creep for this phase — flagged as a candidate future hardening, not blocking R225-R227).

## Common Pitfalls

### Pitfall 1: The router strands the super-admin on `/select-church` immediately after entering — found by reading `router/index.ts`, not the rules files

**What goes wrong:** `src/router/index.ts:138-145` redirects to `/select-church` whenever
`authStore.requiresOrgSelection` is true for any `requiresAuth` route that isn't `select-church` or
`requiresSuperAdmin`. `requiresOrgSelection = needsOrgSelection || hasNoOrg || hasDeactivatedOrg`. `hasNoOrg`
is `memberships.value.length === 0` with NO reference to `orgId` at all (auth.ts:149-151). A pure super-admin
with zero org memberships of their own (the expected case — the owner's console account typically belongs to
no church) will have `memberships.value.length === 0` even AFTER `enterOrgAsSuperAdmin` successfully sets
`orgId.value` to the target church. The very next navigation to `/services` (or wherever the enter action
lands) re-evaluates the guard, sees `hasNoOrg === true`, and bounces straight back to `/select-church` —
undoing the entire enter flow on the first router transition.

**Why it happens:** `hasNoOrg` was written before any code path could set `orgId` without also growing
`memberships` (every existing path — invite acceptance, org creation, `selectOrg` — only ever sets `orgId` to
a value already present in `memberships`). `enterOrgAsSuperAdmin` is the first code path that breaks that
invariant on purpose.

**How to avoid:** Add `&& viewingAsSuperAdmin.value === null` to `hasNoOrg`'s computed (Pattern 4, exact
diff given above). Do NOT "fix" this by adding the super-admin's viewed org to `memberships.value` — that
array is what the CHURCH PICKER renders (`SelectChurchView`), and R226/the owner's own words ("a hidden user
they don't see in their list") require the super-admin's OWN picker to stay empty, not to sprout every org
in existence.

**Warning signs:** A manual/UAT test where "Enter church" appears to succeed (network tab shows the
`getDoc` succeeding, `orgName` briefly populates) but the browser immediately redirects to `/select-church`
showing an empty church list — this is exactly the `hasNoOrg` regression, not a rules-denial (a rules denial
would show a permission-denied console error and a blank/loading state, not a redirect to the picker).

### Pitfall 2: The lifecycle-guard composition hazard is invisible to a diff of the lifecycle-guard rule itself

**What goes wrong:** Reviewing ONLY the diff to `organizations/{orgId}`'s `allow update` line in isolation
(Pattern 2) looks like a no-op if the reviewer doesn't also connect it to the `isOrgEditor` change (Pattern
1) landing in the SAME commit. Someone reviewing "what changed in the lifecycle guard" sees only the
disjunct removal and might ask "why remove a working exemption?" without realizing the exemption became
unsafe as a SIDE EFFECT of a change 80 lines above it.

**Why it happens:** Firestore security rules have no call-graph tooling; a function's callers are found only
by grep, and a change to a shared helper's semantics can silently reinterpret every caller's intent.

**How to avoid:** Land Pattern 1 and Pattern 2 in the SAME commit/plan-step, with a comment on the lifecycle
guard's diff explicitly cross-referencing the `isOrgEditor` widening as the reason the exemption must go (the
comment text given in Pattern 2 above does this). Do not split "add the super-admin arm" and "tighten the
lifecycle guard" into separate plans that could land independently — landing Pattern 1 alone (even
temporarily, e.g. across two plan steps in the same phase with a verification gate between them) reopens
T-76-10 for the window between the two commits.

**Warning signs:** A grep of `firestore.rules` for `isSuperAdmin()` returning MORE than 4 matches after this
phase's diff (the audit in Pattern 2 counts exactly 4 legitimate post-diff call sites: inside `isOrgMember`,
inside `isOrgEditor`, inside `appConfig`'s `allow read, write`, inside `superAdmins`' `allow read, write` —
the org-doc `allow update` rule should have ZERO direct `isSuperAdmin()` references after Pattern 2, since
its access to super-admin now flows exclusively through `isOrgEditor(orgId)`).

### Pitfall 3: `allow write` on `members/{uid}` already includes `create` — the R226 "no member doc" guarantee is a code contract, not a rules invariant

**What goes wrong:** (Detailed under Runtime State Inventory above.) `firestore.rules:152`
(`allow write: if isOrgEditor(orgId);`) legally authorizes `create` for that path (Firestore's `write`
category = create+update+delete, OR-evaluated against every other matching `allow` clause for the same
operation — confirmed against this exact codebase's own established idiom, e.g. the `services/{docId}`
block's comment at firestore.rules:370-380 explicitly documents this OR-evaluation behavior for a DIFFERENT
collection). Once Pattern 1 ships, a super-admin is `isOrgEditor(orgId)` for every org, meaning the RULES
LAYER does not, by itself, prevent a super-admin's client from creating a member doc for themselves. R226 is
satisfied only because the CLIENT CODE (`enterOrgAsSuperAdmin`) never issues that write.

**Why it happens:** The R104 `allow create` predicate (firestore.rules:159-190) was written to close a
DIFFERENT hole (an uninvited stranger self-joining any org) and was never designed to be the ONLY path to
member-doc creation — it coexists with the broader, older `allow write: if isOrgEditor(orgId)` grant, which
predates R104 and was not revisited when R104 shipped.

**How to avoid:** Do not attempt to close this by tightening `allow write` on `members/{uid}` as part of
THIS phase — that is unrelated scope creep (it would need its own threat model and regression tests against
TeamView's role-toggle/remove flows, which currently rely on that same `allow write` grant for `update`/
`delete`). Instead: (1) write a unit test on `enterOrgAsSuperAdmin`/`exitSuperAdminView` asserting neither
function calls `setDoc`/`writeBatch` at all (see Validation Architecture); (2) document this finding in the
phase's SECURITY.md / threat model as an accepted residual risk (suggested ID T-78-03) with the mitigation
being code-review discipline + the unit test, not a rules change; (3) flag it as a candidate for a FUTURE
hardening phase (tighten `members/{uid}`'s `allow write` to exclude `create`, mirroring the
`collection != 'services'` exclusion idiom already used elsewhere in this file) — out of scope for R224-R227.

**Warning signs:** Any future code change that adds a `setDoc`/`updateDoc` call reachable from
`enterOrgAsSuperAdmin` (e.g., "let's also record last-entered timestamp" as a well-intentioned future
feature) would silently create the exact member doc R226 forbids, with no rules-layer warning — the write
would simply succeed.

### Pitfall 4: Forgetting to clear `viewingAsSuperAdmin` in `logout()`/the null-user branch (not just `resetOrgContext`)

**What goes wrong:** `logout()` (auth.ts:645-661) and the `onAuthStateChanged` null-user branch
(auth.ts:512-524) each duplicate `resetOrgContext()`'s field-clearing list inline rather than calling the
shared function — this duplication already exists today (pre-dating Phase 78) and is exactly the kind of
drift the `resetOrgContext()` extraction comment (auth.ts:282-285) was written to prevent for the OTHER
fields, but the extraction was never applied to `logout()`/the null-user branch themselves. Adding
`viewingAsSuperAdmin` only to `resetOrgContext()` misses these two other reset sites, leaving a stale
"viewing as X church" banner state across a sign-out/sign-in cycle in the same tab.

**Why it happens:** Three independent "reset all org context" code paths exist in this file
(`resetOrgContext()`, `logout()`, and the `onAuthStateChanged` null branch) and they are not DRY with each
other today — a new field must be added to all three, and it is easy to add it to only the one most obviously
named function.

**How to avoid:** grep `auth.ts` for `settings.value = { ...DEFAULT_ORG_SETTINGS }` before considering this
task done — it appears exactly 3 times (resetOrgContext, logout, the null-user branch), and
`viewingAsSuperAdmin.value = null` must be added next to every one of those 3 occurrences.

**Warning signs:** A UAT scenario where a super-admin exits, logs out, and a different super-admin logs in
on the same browser tab without a full page reload, and briefly sees a stale "Viewing X as super-admin"
banner from the PRIOR session before the new session's own state settles.

## Code Examples

### Emulator test — R225 super-admin content ALLOW on a non-member org (`src/rules.test.ts`)

```typescript
// Source: mirrors this file's own established pattern (seedMembershipDoc /
// seedDoc / authenticatedContext), applied to the NEW Phase 78 arm.
describe('Super-admin content access without a membership doc (R225, Phase 78)', () => {
  it('ALLOWS a super-admin with NO membership doc to read organizations/{orgId}', async () => {
    await seedDoc('organizations/orgA', { name: "Someone Else's Church", createdBy: 'someoneElse' })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('ALLOWS a super-admin with NO membership doc to write a content collection (songs)', async () => {
    await seedDoc('organizations/orgA', { name: "Someone Else's Church" })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1'), { title: 'Amazing Grace' }),
    )
  })

  it('ALLOWS a super-admin with NO membership doc to enter a DEACTIVATED org (Phase 76 exemption extended)', async () => {
    await seedDoc('organizations/orgA', { name: "Deactivated Church", active: false })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('DENIES a non-member, non-super-admin from reading organizations/{orgId} -- R225 negative case', async () => {
    await seedDoc('organizations/orgA', { name: "Someone Else's Church" })
    const context = testEnv.authenticatedContext('randomUid') // no membership doc, no superAdmin claim
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('DOES NOT REGRESS an ordinary member of that same org', async () => {
    await seedMembershipDoc('orgA', 'realMemberUid', 'viewer')
    await seedDoc('organizations/orgA', { name: "Someone Else's Church" })
    const context = testEnv.authenticatedContext('realMemberUid')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('CRITICAL -- DENIES a super-admin from writing a lifecycle field directly (must use setOrgActive)', async () => {
    await seedDoc('organizations/orgA', { name: "Someone Else's Church" })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA'), { active: false }),
    )
  })

  it('CRITICAL -- a super-admin using the client SDK still cannot delete organizations/{orgId} (Phase 77 stays absolute)', async () => {
    await seedDoc('organizations/orgA', { name: "Someone Else's Church", active: false })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'organizations', 'orgA')))
    // NOTE: this exact scenario is ALREADY covered verbatim by the existing
    // test at rules.test.ts:496-501 ("DENIES a super-admin using the client
    // SDK from deleting organizations/{orgId} -- no exemption") -- that test
    // was written during Phase 77 IN ANTICIPATION of this phase and requires
    // NO changes; it is cited here only to confirm it still applies and
    // should not be duplicated.
  })
})
```

### Emulator test — R225 storage-side ALLOW (`src/storage.rules.test.ts`)

```typescript
// Source: mirrors this file's authenticatedContext(uid, claims) pattern.
describe('Super-admin Storage access without a membership claim (R225, Phase 78)', () => {
  it('ALLOWS a super-admin with NO orgId/orgs/role claim at all to write under any org path', async () => {
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/superadmin-enter/source.pptx')
    await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('DENIES a non-member, non-super-admin -- R225 negative case unchanged', async () => {
    const context = testEnv.authenticatedContext('randomUid') // no claims at all
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/random/source.pptx')
    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })
})
```

### Unit test — `enterOrgAsSuperAdmin` never writes a member doc, and fixes `hasNoOrg` (`src/stores/__tests__/auth.test.ts`)

```typescript
// Source: mirrors this file's existing path-aware doc()/getDoc() mock setup
// (setMockOrgDoc-style helpers already established around lines 116-211).
describe('enterOrgAsSuperAdmin / exitSuperAdminView (R224/R225/R226/R227, Phase 78)', () => {
  it('sets orgId/orgName/userRole and viewingAsSuperAdmin without touching memberships', async () => {
    // ... sign in as a super-admin with memberships.value === [] (the expected
    // shape for a pure owner-console account) ...
    await store.enterOrgAsSuperAdmin('someChurchOrgId')
    expect(store.orgId).toBe('someChurchOrgId')
    expect(store.userRole).toBe('editor')
    expect(store.memberships).toEqual([])  // R226 -- picker stays empty
    expect(store.hasNoOrg).toBe(false)      // Pitfall 1 -- router must not strand here
    expect(store.requiresOrgSelection).toBe(false)
  })

  it('never calls setDoc/writeBatch -- R226 no member doc is created', async () => {
    await store.enterOrgAsSuperAdmin('someChurchOrgId')
    expect(vi.mocked(setDoc)).not.toHaveBeenCalled()
    expect(vi.mocked(writeBatch)).not.toHaveBeenCalled()
  })

  it('exitSuperAdminView clears viewingAsSuperAdmin and the viewed org context', async () => {
    await store.enterOrgAsSuperAdmin('someChurchOrgId')
    store.exitSuperAdminView()
    expect(store.orgId).toBe(null)
    expect(store.userRole).toBe(null)
  })
})
```

## State of the Art

Not applicable — no external framework/library churn is relevant to this phase; the "state of the art" for
this codebase's own security-rules pattern is Phase 76/77 themselves, both already reflected in the diffs
above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `'services'` is the best landing route after "Enter church" (rather than `'dashboard'`, which `requiresEditor`) | Pattern 4 | Low — Claude's discretion per CONTEXT.md; either route works once `userRole` is forced to `'editor'`, since `services` has no editor gate at all and is therefore the more universally-safe choice regardless of role-forcing correctness |
| A2 | A pure super-admin/owner account typically has `memberships.value.length === 0` (no org of their own) | Pitfall 1 | Low-Medium — if the owner's actual account DOES belong to a real org, `hasNoOrg` would already be false and Pitfall 1 would not manifest for that specific account, but the fix is still correct and required for the general case (any super-admin with zero memberships) |
| A3 | The banner belongs in `AppShell.vue` (used by all org-scoped views: dashboard/songs/volunteers/schedule/admins/settings, and mountable for services too) rather than a separate global-layout component | Pattern 4 / Architecture | Low — `AppShell.vue` is confirmed (by direct read) to be the single shared wrapper across every org-scoped view; placing the banner here means it appears everywhere the super-admin would actually be while viewing a church |

**If this table is empty:** N/A — see entries above; none of them are compliance/security-boundary claims
(the rules-composition claims are all `[VERIFIED]` against the actual current file contents read in this
session, not `[ASSUMED]`).

## Open Questions

1. **Should `members/{uid}`'s `allow write` be tightened to exclude `create` (closing the Pitfall 3 /
   Runtime-State-Inventory residual gap) as part of this phase, or deferred?**
   - What we know: the gap is real, pre-existing (not introduced by Phase 78's diff), and would need its own
     regression tests against TeamView's role-toggle (`update`) and remove-member (`delete`) flows, which
     both currently rely on the SAME `allow write` grant.
   - What's unclear: whether the owner considers a super-admin's THEORETICAL ability to self-create a member
     doc (never exercised by any shipped code path) an acceptable residual risk for this milestone, or wants
     it closed now while the file is already being touched.
   - Recommendation: defer — treat as an accepted risk documented in the phase's threat model (T-78-03),
     mitigated by the unit test in the Code Examples section above (asserting `enterOrgAsSuperAdmin` never
     calls `setDoc`/`writeBatch`). Revisit in a future hardening phase if the owner wants rules-layer closure
     rather than a code-contract.

2. **Does the super-admin's OWN `users/{uid}` doc need any changes (e.g., should `orgIds` ever include a
   viewed org)?**
   - What we know: `enterOrgAsSuperAdmin` never touches `users/{uid}` at all in this design.
   - What's unclear: whether any future feature (e.g., "recently visited churches" for the super-admin) would
     want this — explicitly OUT of scope per CONTEXT.md's Deferred Ideas (audit log is future scope; this is
     adjacent but not listed).
   - Recommendation: do not touch `users/{uid}.orgIds` — R226's "hidden" requirement extends naturally to
     "the super-admin's own user doc should not accumulate every org they've ever supported," even though
     this isn't explicitly stated in R224-R227.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (both suites) — app suite pinned via root `package.json`; rules suite via `@firebase/rules-unit-testing` against a live Firestore/Storage emulator |
| Config file | App: default Vite/Vitest config (`vitest.config.ts`/`vite.config.ts` exclude clause per CLAUDE.md). Rules: `vitest.rules.config.ts` |
| Quick run command | `npx vitest run src/stores/__tests__/auth.test.ts src/components/admin/__tests__/OrganizationsTab.test.ts` (component/store layer, no emulator needed, <5s) |
| Full suite command | `npm run test:rules` (starts its own emulator via `firebase emulators:exec`) OR, if an emulator is already running, `npx vitest run --config vitest.rules.config.ts` directly (per CLAUDE.md's documented port-conflict workaround) — PLUS a bare `npx vitest run` for the app suite |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R224 | "Enter church" row action switches active org context | unit | `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts -t "enter"` | ❌ Wave 0 — new test case in existing file |
| R225 | Super-admin ALLOW without membership doc (Firestore) | integration (emulator) | `npx vitest run --config vitest.rules.config.ts -t "R225"` | ❌ Wave 0 — new describe block in existing `src/rules.test.ts` |
| R225 | Super-admin ALLOW without membership claim (Storage) | integration (emulator) | `npx vitest run --config vitest.rules.config.ts -t "R225"` | ❌ Wave 0 — new describe block in existing `src/storage.rules.test.ts` |
| R225 | Lifecycle-field write still DENIED for super-admin (composition regression guard) | integration (emulator) | same rules-config run, `-t "lifecycle field directly"` | ❌ Wave 0 — new test case, existing file |
| R225 | Org-doc DELETE still DENIED for super-admin | integration (emulator) | already covered — `src/rules.test.ts:496-501` | ✅ existing, no new test needed (cite, don't duplicate) |
| R226 | No member doc auto-created by enter flow | unit | `npx vitest run src/stores/__tests__/auth.test.ts -t "never calls setDoc"` | ❌ Wave 0 — new test case, existing file |
| R226 | `TeamView`/`listOrganizations` unaffected (still read only `members` subcollection) | manual-only (no code change to TeamView.vue in this phase — confirmed by direct read that it already reads ONLY `collection(db, 'organizations', orgId, 'members')`, no other identity source) | n/a | n/a — verification is a code-reading confirmation, not a new test; already TRUE today per this research |
| R227 | Persistent banner renders + one-click exit | component | `npx vitest run src/components/__tests__/AppShell.test.ts -t "super-admin"` | ❌ Wave 0 — `AppShell.vue` currently has NO test file at all; this is the one genuinely new test file needed |

### Sampling Rate

- **Per task commit:** the relevant quick-run command from the table above for whatever file the task touched
- **Per wave merge:** `npx vitest run` (app suite, bare command per CLAUDE.md) + `npm run test:rules` (or the
  direct `--config vitest.rules.config.ts` form against an already-running emulator)
- **Phase gate:** both suites green, PLUS `npm run type-check` (per CLAUDE.md — NOT `-p tsconfig.app.json`,
  which silently skips test files) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/rules.test.ts` — new `describe('Super-admin content access without a membership doc (R225, Phase 78)')` block (Code Examples above)
- [ ] `src/storage.rules.test.ts` — new `describe('Super-admin Storage access without a membership claim (R225, Phase 78)')` block
- [ ] `src/stores/__tests__/auth.test.ts` — new `describe('enterOrgAsSuperAdmin / exitSuperAdminView ...')` block
- [ ] `src/components/admin/__tests__/OrganizationsTab.test.ts` — new test case for the "Enter church" button + `router?.push` call (guard for the router-less mount harness, per Pattern 4)
- [ ] `src/components/__tests__/AppShell.test.ts` — NEW FILE (none exists today); needs a minimal mount harness with a mocked `authStore` exposing `viewingAsSuperAdmin`/`orgName`/`exitSuperAdminView`
- [ ] No new test framework or config needed — both harnesses (Vitest + `@firebase/rules-unit-testing`) are already fully wired

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No change | Existing Firebase Auth + custom `superAdmin` claim (v1.9), unchanged by this phase |
| V3 Session Management | Yes | `viewingAsSuperAdmin` is pure client-side session state; the actual authorization boundary is re-evaluated by the rules layer on EVERY request, never cached from the one-time enter-flow read (Pattern 4's design deliberately avoids any client-side "I already checked, trust me" shortcut) |
| V4 Access Control | Yes — the core of this phase | `isSuperAdmin()` claim-based rules arm (Patterns 1/3), with the lifecycle-field and delete-rule composition hazards (Pattern 2, Pitfall 2) as the specific access-control risks under test |
| V5 Input Validation | No change | No new user-controllable input surface (the "Enter church" action takes an `orgId` already sourced from the `listOrganizations` callable's server-computed response, not free client text) |
| V6 Cryptography | No change | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege-widening-by-composition (a broad OR added to a shared helper silently reinterprets an unrelated caller's narrower exemption) | Elevation of Privilege | Exhaustive grep-audit of every OTHER caller of the widened helper BEFORE landing the widening (Pattern 2's 4-call-site audit); land the widening and its downstream fix in the same commit |
| Client-enforced-only session/UI state mistaken for a security boundary | Elevation of Privilege | Every read/write during a super-admin's viewed session is independently re-authorized by `firestore.rules`/`storage.rules`; `viewingAsSuperAdmin`/`userRole` are UI-gating convenience only, mirroring the codebase's own established `isSuperAdmin` client ref (auth.ts:97-100, explicitly commented "must never be treated as access control on its own") |
| Router-guard logic gap for a state the guard's author never anticipated (`hasNoOrg` not knowing about a super-admin's temporary org) | Denial of Service (self-inflicted, not attacker-driven, but a genuine availability bug for the feature) | Explicit unit test asserting `requiresOrgSelection === false` immediately after `enterOrgAsSuperAdmin` (Pitfall 1's test) |
| Rules-layer write-category over-grant (`allow write` silently including `create`) treated as a rules-enforced invariant when it is actually a code-contract | Tampering / Elevation of Privilege (residual, low severity) | Documented as an accepted risk (T-78-03) with a code-level unit test as the mitigation, not a rules change, per Pitfall 3 |

## Sources

### Primary (HIGH confidence — direct reads of the current, post-76/77 repository state this session)
- `firestore.rules` (full file, 587 lines) — `isOrgMember`/`isOrgEditor`/`isSuperAdmin`/`isOrgActive`/
  `preservesLifecycleFields`/the org-doc `allow update`/`allow delete: if false`/the `members/{uid}` block
- `storage.rules` (full file, 101 lines) — `isOrgMemberByClaim`/`isOrgDeactivatedForCaller`
- `src/rules.test.ts` — existing describe blocks for `isOrgActive`, the lifecycle-field guard, and the
  Phase-77 delete-DENY test at lines 487-502 (confirmed still applicable, cited not duplicated)
- `src/storage.rules.test.ts` — existing `deactivatedOrgs` claim describe block, confirmed compatible
- `src/stores/auth.ts` (full file, 706 lines) — `selectOrg`, `loadOrgContext`, `resetOrgContext`, `logout`,
  the `onAuthStateChanged` handler, all `computed()` gates
- `src/router/index.ts` (full file) — the `requiresOrgSelection` guard at lines 138-145 (source of Pitfall 1)
- `src/views/TeamView.vue` (full file) — confirmed member list reads only
  `collection(db, 'organizations', orgId, 'members')`, no other identity source
- `src/components/admin/OrganizationsTab.vue` (full file) — row-action patterns (Deactivate/Reactivate/
  Delete) to mirror for "Enter church"
- `src/views/OwnerConsoleView.vue` (partial, grep) — the `router?.replace(...)` optional-chaining precedent
- `src/stores/__tests__/auth.test.ts` (partial) — mocking conventions for `getDoc`/`setDoc`/`onSnapshot`
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 78 section), `.planning/config.json`

### Secondary (MEDIUM confidence)
None used — this phase required no external library/framework research.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new dependencies
- Architecture/rules composition: HIGH — every claim is grounded in a direct read of the current file
  contents and cross-checked against the existing test suite's own comments (which explicitly anticipate
  Phase 78 in three places: firestore.rules:19-21, src/rules.test.ts:340-344, src/rules.test.ts:485-486)
- Pitfalls: HIGH for Pitfalls 1-3 (each traced to an exact line number and confirmed by reading the
  dependent code, not inferred); MEDIUM for Pitfall 4 (the exact 3-occurrence count was grep-confirmed but
  the "stale banner across same-tab logout/login" UX severity is a reasonable inference, not emulator-tested)

**Research date:** 2026-08-23
**Valid until:** Indefinite for the rules-composition findings (tied to the current file contents, which
this research reads in full — any further phase touching `firestore.rules`/`storage.rules` after Phase 78
should re-verify against the THEN-current file, same discipline this research applied to Phase 76/77's
output). 30 days for the Vitest/Firebase-emulator tooling specifics (versions/commands), consistent with
CLAUDE.md's own currency note on the test-command guidance.
