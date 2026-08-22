# Phase 74: Organizations — List, Onboard & Admin Assignment - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (frontend + backend phase; grey areas auto-decided per the v2.0 standing autonomy grant — reasonable defaults chosen and stated, grounded in a direct read of the org-founding flow, the `setSuperAdminClaim` callable, `OrgSettings`/template seeding, and the `orgNames` registry)

<domain>
## Phase Boundary

Fill the Phase 72 Organizations-tab placeholder with real platform multi-tenancy management, gated to
super-admins: (1) LIST every organization on the platform; (2) ONBOARD a new church end-to-end — create the
org record + default `OrgSettings`, seed the default service template, and assign its first admin by email;
(3) ASSIGN additional admins (existing editor role) to any org — all via super-admin-gated server callables
that never let the client perform privileged writes. Depends on Phase 72 (the tab shell to host this UI) and
Phase 73 (the widened multi-org claim, so assigning a second-org admin doesn't break their Storage access).
Requirements R196–R206.

**Explicitly NOT in this phase:** editing/renaming/suspending/deleting an existing org; bulk multi-admin
management, per-org role changes, or member removal UI; self-service church signup; billing. A church admin
is the EXISTING editor role — no new role or claim type.
</domain>

<decisions>
## Implementation Decisions

### Server-side: three super-admin-gated onCall callables (R200, R204 — no privileged client writes)
Mirror `functions/src/superAdminClaims.ts`'s `setSuperAdminClaim` exactly for the caller gate: reject
`!request.auth` (unauthenticated) and `request.auth.token.superAdmin !== true` (permission-denied), AND
independently re-read `superAdmins/{callerUid}` from Firestore (never trust the client-declared flag alone).
Resolve target users via `getAuth().getUserByEmail()`. Put them in a new `functions/src/orgProvisioning.ts`
(+ export from `functions/src/index.ts`). All writes use the Admin SDK (bypasses rules for the privileged
org/members/orgNames writes — which is exactly why the client never needs, and never gets, those write rules).

1. **`onboardOrganization({ name, adminEmail })`** (R197–R202, R199):
   - Validate `name` non-empty; `normalizeOrgName(name)`; **enforce uniqueness in a Firestore transaction** on
     `orgNames/{nameKey}` (create-only: if the doc exists → throw `already-exists` "That church name is taken"
     → R201). The Admin SDK bypasses the create-only rule, so the callable MUST implement the check itself in
     the transaction (get-then-create).
   - Create `organizations/{orgId}` (auto-id) `{ name, createdAt: serverTimestamp(), createdBy: callerUid }`
     and seed default `OrgSettings` with `defaultServiceTemplate` = the Suggested Template (R197/R198). Port
     `buildSuggestedTemplateEntries()` (src/utils/slotTypes.ts) into a small self-contained functions module
     (mirrors the v1.7 `functions/src/serviceRoles.ts` client-util port precedent) so the seeded template is
     byte-identical to what a normally-created org gets. Where the settings live (on the org doc vs a settings
     subdoc) must match how `loadOrgContext`/`OrgSettings` is read today — planner confirms and matches it.
   - **Assign the first admin (R199)** via the shared assignment logic below.
   - **Ordering / no half-created org (R202):** claim the `orgNames` entry (transaction) FIRST so a duplicate
     name is rejected before anything else is created; then batch-write org doc + settings; then run the admin
     assignment. On a mid-flow failure, the orgName is bound to `{orgId}` so a retry with the same name+org is
     idempotent (the name check finds its own claim and proceeds) rather than stranding a nameless/adminless
     org. Planner decides the exact transaction/batch boundaries; the invariant is: a retry after fixing the
     input succeeds without manual cleanup, and a duplicate name never creates a second org.

2. **`assignOrgAdmin({ orgId, email })`** (R203–R206): resolve `email` → uid via `getUserByEmail`.
   - **Existing account:** create `organizations/{orgId}/members/{uid}` `{ role: 'editor', joinedAt,
     displayName, email }` (the existing member-doc shape) AND **append** `orgId` to `users/{uid}.orgIds` with
     `FieldValue.arrayUnion(orgId)` — **NOT** a `set([orgId])` overwrite. This is the R206 additive guarantee:
     RESEARCH from Phase 73 proved the client org-founding/invite paths (`src/stores/auth.ts:426,455`)
     OVERWRITE `orgIds`; this callable must not repeat that, or a user already in another org would lose it.
     The Phase 73 `syncOrgMembershipClaim` trigger fires on the members write and sets the widened `orgs`
     claim automatically — no manual claim write here.
   - **No account (R205):** do NOT create a dangling membership. Instead create the existing invite artifacts
     — `organizations/{orgId}/invites/{email}` `{ role: 'editor', ... }` and the `inviteLookup/{email}` entry —
     so the person is added at editor via the existing invite-acceptance flow (`src/stores/auth.ts`) on their
     first sign-in. The callable returns a clear `{ status: 'invited' }` vs `{ status: 'added' }` so the UI can
     say which happened. (If preferred, return a typed "no account — invited" result rather than an error;
     never a silent failure.)

3. **`listOrganizations()`** (R196): super-admin-gated; Admin SDK reads all `organizations` docs and returns a
   summary array `[{ orgId, name, createdAt, memberCount }]` (memberCount via a members subcollection
   count/aggregate per org). A callable (not a broadened client read rule) keeps `firestore.rules` unchanged
   and computes member counts server-side. One-shot fetch (refetched after onboarding/assignment) — realtime
   is unnecessary for an admin console list.

### Client: Organizations tab UI (fills the Phase 72 placeholder — R196–R206)
- Replace `src/components/admin/OrganizationsTab.vue`'s placeholder with the real surface (still inside the
  already-super-admin-gated `/owner-console`, no new gate):
  - **List (R196):** on mount call `listOrganizations` (httpsCallable); render a table/list — church name, org
    id, created date, member count — with loading/empty/error states matching the console's existing card
    idiom (mirror `OwnerConsoleView`/`ConfigurationTab` styling; dark palette).
  - **Onboard (R197–R202):** an "Onboard a church" form — church name + first-admin email → call
    `onboardOrganization`; on success refresh the list and show a confirmation naming the church + whether the
    admin was added or invited; on failure surface the specific reason (name taken, invalid/failed email)
    inline. Disable/spinner while in flight.
  - **Assign admin (R203–R206):** a per-org "Assign admin" affordance (email input) → call `assignOrgAdmin`;
    surface added-vs-invited and errors clearly.
- The client calls ONLY the three callables with a recipient SELECTOR (name/email) — it never writes
  `organizations/*`, `orgNames/*`, or another org's `members/*` directly (R200/R204).

### Rules (expected: no change)
- No `firestore.rules` / `storage.rules` change is expected — every privileged read/write is an Admin-SDK
  callable, and the assigned admin reads their org through the existing `isOrgMember` (exists(members/uid))
  rule once their membership doc exists. If the planner finds a genuine gap (e.g. an invite-lookup read path),
  it may add a narrowly-scoped rule with emulator ALLOW/DENY proof — but the default is: no rules change.

### Deploy (HAND OVER — v2.0 grant)
- The three new callables ship built + tested + UNDEPLOYED. Hand the owner the exact
  `firebase deploy --only functions:onboardOrganization,functions:assignOrgAdmin,functions:listOrganizations`
  command. No secrets involved. (If any narrowly-scoped rule is added, its deploy is handed over too.)

### Claude's Discretion
- Callable payload/return exact shapes; whether onboarding's admin-assignment reuses `assignOrgAdmin`'s core
  as a shared internal helper (recommended — no drift); table vs card list layout; the exact members-count
  aggregation method (count query vs read); functions file organization. Planner's call within the above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/superAdminClaims.ts` — `setSuperAdminClaim` onCall: the caller-gate + `getUserByEmail`
  pattern to mirror for all three new callables (dual check: `token.superAdmin === true` AND fresh
  `superAdmins/{callerUid}` re-read; `HttpsError` for unauthenticated/permission-denied).
- `src/stores/auth.ts` (~lines 400–470) — the current client org-founding + invite-acceptance flow: the exact
  shapes for `organizations/{orgId}` `{name, createdAt, createdBy}`, `members/{uid}` `{role, joinedAt,
  displayName, email}`, the `invites` + `inviteLookup` artifacts, and the `orgIds` write the callable must do
  as `arrayUnion` (NOT the overwrite this file uses).
- `src/utils/orgName.ts` — `normalizeOrgName` (uniqueness key) + `claimOrgName` (create-only `orgNames/{key}`
  semantics the callable replicates transactionally under the Admin SDK).
- `src/types/organization.ts` — `OrgSettings` (line 52) + `defaultServiceTemplate: ServiceTemplateEntry[]`
  (line 84) + defaults (line ~197); `src/utils/slotTypes.ts:453` `buildSuggestedTemplateEntries()` — the seed
  template to port to functions.
- `src/components/admin/OrganizationsTab.vue` — the Phase 72 placeholder to replace; `ConfigurationTab.vue` /
  `OwnerConsoleView.vue` — the console styling + httpsCallable usage idiom to mirror (`setSuperAdminClaim` is
  called from `OwnerConsoleView.vue` via `httpsCallable(functions, 'setSuperAdminClaim')`).
- `functions/src/orgMembershipClaims.ts` (Phase 73) — the `syncOrgMembershipClaim` trigger that auto-sets the
  widened `orgs` claim when the new members doc is written (so the callable does not touch claims directly).

### Established Patterns
- Server-verified super-admin onCall with dual caller check + `getUserByEmail` target resolution; Admin-SDK
  privileged writes; `httpsCallable` from the client with a selector-only payload; org/member/invite doc
  shapes; the `orgNames` create-only uniqueness registry; `buildSuggestedTemplateEntries()` seeding.

### Integration Points
- New: `functions/src/orgProvisioning.ts` (+ tests) exporting `onboardOrganization`, `assignOrgAdmin`,
  `listOrganizations`; export wiring in `functions/src/index.ts`; a small ported seed-template module in
  functions.
- Changed: `src/components/admin/OrganizationsTab.vue` (real UI) + its test.
- Deploy runbook note for the three callables. `firestore.rules`/`storage.rules`/`src/stores/auth.ts` expected
  unchanged.
</code_context>

<specifics>
## Specific Ideas

- A church admin IS the existing **editor** role — reuse it; introduce no new role/claim (owner decision).
- R206 is the load-bearing correctness point: assignment appends to `users/{uid}.orgIds` via `arrayUnion` and
  writes an additive membership doc — a user already in another org keeps it. (Phase 73's claim recompute +
  this arrayUnion together make multi-org real.)
- No-account email → invite (reuse the existing invite-acceptance flow), never a dangling membership or a
  silent failure (R205).
- Duplicate church name → rejected via the `orgNames` transaction before any org is created (R201/R202).
</specifics>

<deferred>
## Deferred Ideas

- Editing/renaming/suspending/deleting an org; bulk multi-admin management; per-org role changes; member
  removal UI; self-service signup; billing — all out of scope (Future Requirements in REQUIREMENTS.md).
- The pre-existing client `orgIds`-OVERWRITE bug in `src/stores/auth.ts:426,455` (invite-accept/auto-create
  set `orgIds` to a one-element array) — a real latent multi-org limitation surfaced by Phase 73 research. This
  phase does NOT fix the client flow (out of scope); it only ensures the SERVER assignment path is additive
  (`arrayUnion`). Flagged for a future phase if client-side multi-org org-switching is ever wanted. Noted in
  PENDING/backlog rather than fixed here.
</deferred>
