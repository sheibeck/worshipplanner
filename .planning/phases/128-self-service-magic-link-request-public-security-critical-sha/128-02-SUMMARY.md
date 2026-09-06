---
phase: 128-self-service-magic-link-request-public-security-critical-sha
plan: 02
subsystem: ui (Vue views/router) -- self-service volunteer magic-link request client wiring
tags: [vue-router, firebase-firestore, firebase-functions, public-route, enumeration-safety]

requires:
  - phase: 128-01
    provides: "requestVolunteerLink onCall callable ({orgId, email, slug} -> {message}), public/unauthenticated, roster-gated, rate-limited, enumeration-safe"
provides:
  - "src/views/VolunteerRequestView.vue -- the public /:slug/volunteer request page"
  - "router named route 'volunteer-request' at /:slug/volunteer"
  - "the 'volunteer-home' (/volunteer) route made public (meta.requiresAuth removed, isVolunteerRoute retained) -- BLOCKER fix"
  - "LoginView.vue 'Are you a volunteer?' entry point"
  - "VolunteerSignInView.vue 'Find your church' orgSlugs lookup"
  - "VolunteerLinkCompleteView.vue 'Request a new link' recovery affordance"
  - "src/utils/slug.ts claimSlug() optional orgName denormalization onto orgSlugs/{slug}"
affects: [129-admin-resend, volunteer-onboarding]

tech-stack:
  added: []
  patterns:
    - "Public getDoc(orgSlugs/{slug}) client read for slug->orgId(+name) resolution (ADR-0007), mirroring ShareView.vue's onMounted try/catch/finally idiom"
    - "httpsCallable client invocation ignoring the resolved response body entirely, to enforce enumeration-safety at the UI layer too (R395)"
    - "Named-route-only navigation for cross-view targets (never a string-built path), consistent with 128-RESEARCH Pitfall 5"
    - "Plain <button>+router.push instead of RouterLink for computed navigation targets, for testability under a fully mocked 'vue-router' module (matches LoginView.vue's existing convention)"

key-files:
  created:
    - src/views/VolunteerRequestView.vue
    - src/views/__tests__/VolunteerRequestView.test.ts
    - src/views/__tests__/VolunteerLinkCompleteView.test.ts
  modified:
    - src/router/index.ts
    - src/router/__tests__/router.test.ts
    - src/views/LoginView.vue
    - src/views/__tests__/LoginView.test.ts
    - src/views/VolunteerSignInView.vue
    - src/views/VolunteerLinkCompleteView.vue
    - src/utils/slug.ts
    - src/stores/services.ts
    - src/stores/quarters.ts
    - src/views/SettingsView.vue

key-decisions:
  - "orgSlugs/{slug} only ever stored {orgId}; organizations/{orgId} requires org membership to read, so an unauthenticated volunteer had no sanctioned path to the church's display name R394 requires. Extended claimSlug to optionally denormalize {orgId, name} onto the (create-only, immutable) orgSlugs doc at claim time. Accepted, documented limitation: a later org rename does not propagate (orgSlugs disallows update by design, ADR-0007's first-writer-wins anti-hijack invariant) -- cosmetic-only, never security-relevant. VolunteerRequestView falls back to generic copy when name is absent (pre-existing slugs claimed before this change)."
  - "The verify-failure 'Request a new link' affordance and the login-page entry both use a plain <button>+router.push rather than <RouterLink>, since VolunteerLinkCompleteView.test.ts and LoginView.test.ts fully mock the 'vue-router' module (no installed router plugin for RouterLink to resolve against) -- mirrors the codebase's existing LoginView.vue convention."
  - "'volunteer-request-generic' (RESEARCH.md's placeholder fallback name) was never created; the concrete, already-public 'volunteer-home' route is the fallback target, per the plan's WARNING-1 resolution."

requirements-completed: [R394, R395, R398, R399]

coverage:
  - id: D1
    description: "Public /:slug/volunteer page resolves orgId+church name from orgSlugs, or shows a graceful 'church not found' state for an unknown slug"
    requirement: R394
    verification:
      - kind: unit
        ref: "src/views/__tests__/VolunteerRequestView.test.ts#shows the request form with the resolved church name after a found slug"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/VolunteerRequestView.test.ts#shows the church-not-found state for an unknown slug"
        status: pass
    human_judgment: false
  - id: D2
    description: "Submitting any email renders the identical enumeration-safe confirmation regardless of the callable's resolved message"
    requirement: R395
    verification:
      - kind: unit
        ref: "src/views/__tests__/VolunteerRequestView.test.ts#renders the identical confirmation regardless of the resolved message value (no branching on response, R395)"
        status: pass
    human_judgment: false
  - id: D3
    description: "/volunteer (volunteer-home) is made PUBLIC (meta.requiresAuth removed, isVolunteerRoute retained) -- the BLOCKER fix proving an unauthenticated visitor is not bounced to /login"
    requirement: R398
    verification:
      - kind: unit
        ref: "src/router/__tests__/router.test.ts#an UNAUTHENTICATED visitor to /volunteer reaches the landing, NOT a /login redirect (R398/R399 blocker fix: requiresAuth removed, isVolunteerRoute retained)"
        status: pass
      - kind: unit
        ref: "src/router/__tests__/router.test.ts#production router meta (direct import, R398/R399 blocker gate) > volunteer-home no longer carries meta.requiresAuth (isVolunteerRoute retained)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Login page 'Are you a volunteer?' entry navigates to the volunteer landing by name; VolunteerSignInView's 'Find your church' lookup resolves orgSlugs and routes to the church-scoped request page"
    requirement: R398
    verification:
      - kind: unit
        ref: "src/views/__tests__/LoginView.test.ts#renders the \"Are you a volunteer?\" entry and navigates to the volunteer landing route by name"
        status: pass
    human_judgment: true
    rationale: "VolunteerSignInView.vue's 'Find your church' lookup itself has no dedicated component test file (not in this plan's file list; acceptance criteria explicitly allow inspection/manual coverage) -- verified by code inspection only, so a human should confirm the live interaction."
  - id: D5
    description: "Verify-failure error state offers a one-tap 'Request a new link' targeting the same church via route.query.slug, falling back to the generic volunteer-home landing"
    requirement: R399
    verification:
      - kind: unit
        ref: "src/views/__tests__/VolunteerLinkCompleteView.test.ts#renders the button in the error state and targets volunteer-request with the query slug"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/VolunteerLinkCompleteView.test.ts#falls back to volunteer-home when route.query.slug is absent"
        status: pass
    human_judgment: false

duration: ~1h
completed: 2026-09-06
status: complete
---

# Phase 128 Plan 02: Self-Service Magic-Link Request — Client Wiring Summary

**Public `/{slug}/volunteer` request page + login-page volunteer entry + verify-failure re-request, closing the R398 dead-end (`/volunteer` was auth-gated) so a volunteer can actually reach and use 128-01's server core end-to-end.**

## Performance

- **Duration:** ~1h
- **Tasks:** 3
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments

- `VolunteerRequestView.vue` — the public `/:slug/volunteer` page: resolves `orgId` (+ an optional
  denormalized church name) from the public-read `orgSlugs/{slug}` registry, renders a loading /
  church-not-found / form / confirmation state machine, and calls `requestVolunteerLink({orgId, email,
  slug})`. The confirmation render path is identical on every resolved outcome — the resolved message is
  never read or branched on (R395).
- **BLOCKER fix (R398/R399):** removed `meta.requiresAuth` from the `/volunteer` (`volunteer-home`) route
  while keeping `meta.isVolunteerRoute` — an unauthenticated volunteer now reaches the landing instead of
  being bounced to `/login`. Proven both via the hand-rolled router-guard mirror and a direct assertion
  against the real production router's route meta.
- `LoginView.vue` gained the "Are you a volunteer? Get your sign-in link" entry (below the existing
  "Invited by email?" fine print), navigating by name to `volunteer-home`.
- `VolunteerSignInView.vue` gained a "Find your church" lookup: normalizes typed input (or a pasted link's
  last path segment), resolves it via `getDoc(orgSlugs/{candidate})`, and `router.push`es to
  `volunteer-request` by name on a hit.
- `VolunteerLinkCompleteView.vue`'s error state gained a one-tap "Request a new link" button, targeting
  `{ name: 'volunteer-request', params: { slug: route.query.slug } }` when present, else the concrete
  `volunteer-home` fallback (not the superseded `volunteer-request-generic` placeholder name).

## Task Commits

1. **Task 1: VolunteerRequestView.vue + /:slug/volunteer route** — `49a62178` (feat) — also includes the
   `claimSlug` orgName-denormalization deviation and the router BLOCKER fix (see note below).
2. **Task 2: Login-page entry + VolunteerSignInView "find your church"** — `bff9f16b` (feat)
3. **Task 3: "Request a new link" recovery affordance** — `2caeac2a` (feat)

_Note on commit boundaries:_ the router BLOCKER fix (removing `meta.requiresAuth` from `volunteer-home`)
and its `router.test.ts` coverage were edited before the Task 1 commit was created, so they landed in
`49a62178` rather than a separate Task-2-scoped commit. Functionally this is a correct, fully-tested fix —
only the commit grouping is imprecise relative to the plan's per-task boundaries. No code is missing or
duplicated across commits.

## Files Created/Modified

- `src/views/VolunteerRequestView.vue` — new public request page
- `src/views/__tests__/VolunteerRequestView.test.ts` — new component test (8 tests)
- `src/router/index.ts` — added `volunteer-request` route; removed `meta.requiresAuth` from `volunteer-home`
- `src/router/__tests__/router.test.ts` — extended (new route coverage + blocker-gate proof, direct production-router meta assertions)
- `src/views/LoginView.vue` — "Are you a volunteer?" entry
- `src/views/__tests__/LoginView.test.ts` — extended (1 new test)
- `src/views/VolunteerSignInView.vue` — "Find your church" lookup section
- `src/views/VolunteerLinkCompleteView.vue` — "Request a new link" affordance
- `src/views/__tests__/VolunteerLinkCompleteView.test.ts` — new component test (4 tests)
- `src/utils/slug.ts` — `claimSlug` gained an optional `orgName` param, denormalized onto `orgSlugs/{slug}` as `name`
- `src/stores/services.ts`, `src/stores/quarters.ts`, `src/views/SettingsView.vue` — pass the org's current name at their existing `claimSlug` call sites

## Decisions Made

See frontmatter `key-decisions`. Summary: (1) denormalize an optional church `name` onto `orgSlugs/{slug}`
at claim time since no other public read path exists, accepting point-in-time-snapshot staleness as a
documented, cosmetic-only limitation; (2) use plain buttons + `router.push` instead of `RouterLink` for
computed navigation targets, matching the existing `LoginView.vue` convention and keeping component tests
independent of the router plugin; (3) the verify-failure fallback route is the concrete `volunteer-home`,
never the superseded `volunteer-request-generic` placeholder name from RESEARCH.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] `orgSlugs/{slug}` had no church-name field for the client to read**
- **Found during:** Task 1 (building `VolunteerRequestView.vue`)
- **Issue:** The plan's `key_links` state "VolunteerRequestView reads orgSlugs/{slug} ... to resolve orgId +
  church name," but the actual `orgSlugs/{slug}` doc (per `src/utils/slug.ts`'s `claimSlug` and
  `src/rules.test.ts`) only ever stores `{ orgId }`. `organizations/{orgId}` (which does carry `name`)
  requires `isOrgMember(orgId)` per `firestore.rules:113` — unreadable by an unauthenticated volunteer.
  Without a fix, R394's "sees the church name" truth was unachievable via any sanctioned client-side path.
- **Fix:** Extended `claimSlug(baseSlug, orgId, orgName?)` to optionally write `{ orgId, name: orgName }`
  instead of `{ orgId }`, and passed the org's current name through at all three existing call sites
  (`SettingsView.vue`'s `onSaveSlug`, `services.ts`'s and `quarters.ts`'s first-share auto-claim, both of
  which already had the org doc's `name` in scope). No `firestore.rules` change needed (the `create` rule
  already permits arbitrary fields). `VolunteerRequestView.vue` renders generic copy (no name-specific
  heading/sentence) when `name` is absent, so pre-existing slugs claimed before this change degrade
  gracefully rather than showing "undefined". Documented, accepted limitation: because `orgSlugs` disallows
  `update`/`delete` by design (create-once, first-writer-wins anti-hijack invariant, ADR-0007), a later org
  rename does not propagate to an already-claimed slug's `name` — cosmetic-only, never a security concern.
- **Files modified:** `src/utils/slug.ts`, `src/stores/services.ts`, `src/stores/quarters.ts`,
  `src/views/SettingsView.vue`, `src/views/VolunteerRequestView.vue`
- **Verification:** `src/utils/__tests__/slug.test.ts`, `src/stores/__tests__/quarters.test.ts`,
  `src/stores/__tests__/services.test.ts` (via full suite run), `src/views/__tests__/SettingsView.test.ts`,
  `src/views/__tests__/VolunteerRequestView.test.ts` (both name-present and name-absent cases) — all pass.
- **Committed in:** `49a62178` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality)
**Impact on plan:** Necessary to satisfy R394's must-have truth; no architectural surface added (no new
Cloud Function, no `firestore.rules` change, no new writable public surface) — purely an optional field on
an already-public, already-create-only doc. No scope creep beyond what R394 required.

## Issues Encountered

None beyond the documented deviation above.

## User Setup Required

None — no external service configuration required. This phase does not deploy to production (per
CONTEXT.md's explicit "Do NOT deploy to prod in this phase").

## Next Phase Readiness

- Phase 128 (both plans) is code-complete: the shared mint/send core + public callable (128-01) and the
  full client wiring (128-02) are done, tested, and type-clean.
- Manual-only verifications remain PENDING (not accepted) per CONTEXT.md/VALIDATION.md: real Resend
  email delivery end-to-end, and felt rate-limit behavior — deferred to a single batched UAT pass at
  milestone end, consistent with v2.13's stated plan.
- Phase 129 (admin resend) can safely import and reuse `mintAndSendVolunteerLink` from
  `functions/src/volunteerLink.ts` (R402's "one code path") — unchanged by this plan.
- Pre-existing production `orgSlugs` docs (claimed before this change) will show generic
  ("your church"/"this church") copy on `VolunteerRequestView` rather than their real name, until/unless
  their org re-claims a slug — a known, low-severity, cosmetic gap, not a functional blocker.

---
*Phase: 128-self-service-magic-link-request-public-security-critical-sha*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: src/views/VolunteerRequestView.vue
- FOUND: src/views/__tests__/VolunteerRequestView.test.ts
- FOUND: src/views/__tests__/VolunteerLinkCompleteView.test.ts
- FOUND: src/router/index.ts
- FOUND: src/views/LoginView.vue
- FOUND: src/views/VolunteerSignInView.vue
- FOUND: src/views/VolunteerLinkCompleteView.vue
- FOUND: src/utils/slug.ts
- FOUND commit: 49a62178 (Task 1 + router BLOCKER fix)
- FOUND commit: bff9f16b (Task 2)
- FOUND commit: 2caeac2a (Task 3)
