# Phase 78: Super-Admin Enter-Any-Church - Context

**Gathered:** 2026-08-22
**Status:** Ready for research → planning
**Mode:** Auto-generated (autonomous smart-discuss). Settled decisions below; the exact RULES COMPOSITION (adding a super-admin access arm WITHOUT re-opening the Phase-76 lifecycle-field guard or Phase-77's client-delete DENY) is deferred to research (§research_question) — a wrong composition would re-introduce a just-closed privilege hole.

<domain>
## Phase Boundary

A super-admin can step into ANY church for support/setup — visible to them (a "viewing as super-admin"
banner), invisible to that church's member/team list (NO membership doc created) — via a super-admin arm in
`firestore.rules` + `storage.rules`. Requirements R224–R227. Depends on Phase 76 (composes on top of its
deactivation-aware rules; must also compose cleanly with Phase 77's client-delete DENY).

</domain>

<decisions>
## Implementation Decisions

### Rules super-admin arm (R225) — the core
- `firestore.rules`: grant a super-admin the SAME org-scoped CONTENT read/write an org member/editor has,
  for ANY org, WITHOUT a membership doc — i.e. `isOrgMember(orgId)` effectively becomes
  `exists(members/uid) || isSuperAdmin()` and `isOrgEditor(orgId)` similarly (the exact placement is the
  research question). `isSuperAdmin()` already exists (v1.9, claim-based).
- `storage.rules`: `isOrgMemberByClaim(orgId)` ORs `request.auth.token.superAdmin == true` — a super-admin
  reads/writes any org's Storage. (Phase 76 already added a super-admin exemption to the *deactivation*
  guard; this adds it to the membership check itself.)
- **HARD CONSTRAINT — the super-admin arm must NOT re-grant, via a client write:** (a) org-doc DELETE
  (Phase 77's `allow delete: if false` stays absolute for ALL clients incl. super-admins — deletion is
  Admin-SDK-only); (b) lifecycle-field writes (`active`/`deactivatedAt`/`deactivatedBy`/`reactivatedAt`/
  `reactivatedBy` — these go only through `setOrgActive`'s Admin-SDK path so the `deactivatedOrgs` claim
  fan-out runs; a super-admin client-writing `active:false` directly would skip it → half-deactivated
  state, the CR-01/T-76-10 class of bug). See §research_question.
- Non-member, non-super-admin access stays DENIED (R225) — proven by emulator DENY tests.

### Client "enter church" (R224, R227)
- Add an `enterOrgAsSuperAdmin(orgId)` action to `src/stores/auth.ts` that sets the active org context to
  ANY org for a super-admin — it BYPASSES the `memberships.some(...)` guard in the existing `selectOrg`
  (a super-admin is not a member), reads the org doc (now allowed by the super-admin rules arm) to populate
  `orgName`/`orgSlug`/`settings`, and sets a `viewingAsSuperAdmin` flag (the org id being viewed). Add
  `exitSuperAdminView()` that clears it and returns to the owner console.
- A per-row "Enter church" / "Sign in" action in `OrganizationsTab.vue` calls `enterOrgAsSuperAdmin(org.orgId)`
  then navigates into the app (e.g. `/services`).
- A persistent "Viewing <Church> as super-admin" banner (app-shell level) shows while `viewingAsSuperAdmin`
  is set, with a one-click "Exit to owner console" → `exitSuperAdminView()` + navigate to `/owner-console`.

### Hidden membership (R226)
- Entering as super-admin creates NO `organizations/{orgId}/members/{uid}` doc — so the super-admin never
  appears in the church's team list (`TeamView`) or the member count. Confirm `TeamView`/member-count read
  only the `members` subcollection and inject no super-admin identity. `userRole` while viewing-as-super-admin
  is a client-side effective role (treat as editor for UI gating) NOT backed by a member doc.

### Claude's Discretion
- Where the banner lives (AppShell vs a global component); the exact "effective role" a super-admin gets in
  the viewed org's UI (recommend editor-equivalent so they can actually help); the enter action's landing
  route.

</decisions>

<research_question>
## OPEN — resolve in RESEARCH.md before planning

1. **Exact rules composition** (`firestore.rules` + `storage.rules`) that adds the super-admin content arm
   to `isOrgMember`/`isOrgEditor`/`isOrgMemberByClaim` WHILE PRESERVING:
   - Phase 77's `allow delete: if false` on `organizations/{orgId}` (super-admin client delete still DENIED);
   - the Phase-76 lifecycle-field write guard — CRITICALLY, evaluate whether the guard's current
     `preservesLifecycleFields() || isSuperAdmin()` shape (which would let a super-admin client-write
     `active:false`, skipping `setOrgActive`'s claim fan-out) should be TIGHTENED so lifecycle fields are
     Admin-SDK-only for EVERYONE including super-admins (recommended — with an emulator test proving a
     super-admin client `update({active:false})` is denied and must use `setOrgActive`);
   - the Phase-76 deactivation guard (a super-admin is exempt from being blocked — fine);
   - the members-subcollection create/write rules (a super-admin entering must NOT auto-create a member doc,
     and the arm must not weaken the R104 self-join protection).
   Give the exact rule-by-rule diff and confirm the ordering/precedence.
2. **Emulator test matrix** for BOTH rules files: super-admin ALLOW (read + content-write) on an org they are
   NOT a member of; non-member non-super-admin DENY; super-admin org-doc DELETE still DENIED; super-admin
   client lifecycle-field write DENIED (must use setOrgActive); an ordinary member of that org unaffected.
3. **Client mechanism** — the `enterOrgAsSuperAdmin`/`exitSuperAdminView` shape in `auth.ts` (how it sets
   active org for a non-member without a member doc, what `userRole`/effective-role it grants for UI gating,
   how it interacts with `memberships`/`requiresOrgSelection`/the church picker, and the members `onSnapshot`
   — which won't find a member doc for the super-admin, so `userRole` must be set another way). Confirm no
   regression to the Phase 75/76/77 Organizations-tab controls or the normal member sign-in flow.
4. **R226 hidden-ness** — confirm `TeamView` + member-count read only the `members` subcollection (so a
   super-admin with no member doc is invisible), and that nothing injects a super-admin into a team list.
5. A **Validation Architecture** section for a VALIDATION.md.

Deliverable: an implementation-ready rules composition (exact diffs) + the client enter/exit design + the
emulator test matrix, grounded in the current (post-76/77) `firestore.rules`/`storage.rules`/`auth.ts`.
</research_question>

<code_context>
## Existing Code Insights

### Reusable Assets
- `firestore.rules` — `isOrgMember`/`isOrgEditor`/`isSuperAdmin`/`isOrgActive`/`preservesLifecycleFields` +
  the `allow delete: if false` (Phase 77). `storage.rules` — `isOrgMemberByClaim`/`isOrgDeactivatedForCaller`.
- `src/stores/auth.ts` — `selectOrg` (the member-guarded active-org switch to generalize), `loadOrgContext`,
  `memberships`, `isSuperAdmin`, `userRole`, the members `onSnapshot`, `resetOrgContext`.
- `src/components/admin/OrganizationsTab.vue` — the row controls (Deactivate/Reactivate, Delete) to add the
  Enter-church action beside.
- `src/views/TeamView.vue` — the per-org member/team list (verify it reads only `members`).
- The app shell / router for the persistent banner + exit.

### Established Patterns
- `isSuperAdmin()` claim-based gate (v1.9); rules changes ship UNDEPLOYED with genuine emulator ALLOW+DENY
  tests; destructive/lifecycle writes are Admin-SDK-only.

### Integration Points
- Rules: `firestore.rules` + `storage.rules` super-admin arm. Client: `auth.ts` enter/exit + the
  Organizations-row action + the app-shell banner.

</code_context>

<specifics>
## Specific Ideas

Owner's words: "Allow a super user to sign into any church… put a sign-in button on the organization tab
rows… a super user is a member of every organization, but this should be a hidden user they don't see in
their list."

</specifics>

<deferred>
## Deferred Ideas

- An audit log of super-admin enter-church sessions (who entered which church, when) — future scope
  (REQUIREMENTS Future: super-admin action audit log).
- Read-only vs. read-write super-admin modes — this pass grants editor-equivalent access; a scoped
  read-only mode is future scope.

</deferred>
