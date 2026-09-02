---
phase: 110-architectural-review
plan: "01"
subsystem: architecture-review
tags: [review-only, store-lifecycle, firestore-listeners, multi-tenant-isolation, org-scoping]
dependency-graph:
  requires:
    - src/stores/orgScopedStores.ts (resetOrgScopedStores)
    - src/stores/auth.ts (loadOrgContext, memberUnsub, enterOrgAsSuperAdmin, exitSuperAdminView)
    - quick 260901-lua (church-switch re-subscribe fix, ADR-0066)
  provides:
    - .planning/phases/110-architectural-review/110-FINDINGS-lifecycle-isolation.md
  affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/110-architectural-review/110-FINDINGS-lifecycle-isolation.md
  modified: []
decisions:
  - "No sub-agents spawned — plan's review_method_note explicitly forbids it (executor has no Agent/Task tool). Review conducted directly by reading source."
  - "Split the single findings-file write into two commits (one per task) by writing Dimension 2's content first, committing, then appending Dimension 3 + the summary table and committing again — preserves per-task atomic commits despite both tasks targeting the same output file."
  - "F-LC-03 (ServicesView.vue's teamsStore teardown drift) is cross-referenced under BOTH the lifecycle and isolation sections rather than duplicated, since it is simultaneously a teardown-ordering gap and an isolation-relevant stale-org-bleed risk — matches the plan's own framing for why these two dimensions are reviewed together."
metrics:
  duration: "~50 minutes"
  completed: 2026-09-02
status: complete
---

# Phase 110 Plan 01: Store/Firestore-Listener Lifecycle & Multi-Tenant Isolation Review Summary

Read-only architectural review of two Phase 110 dimensions — org-scoped Firestore-listener lifecycle
(including the church-switch teardown/re-subscribe hot spot) and multi-tenant org-isolation
architecture — grounded directly against live `src/`, `functions/src/`, and `firestore.rules` source,
producing one severity-ranked findings file with zero code changes.

## What Was Reviewed

**Task 1 — Store/Firestore-listener lifecycle:** Traced every org-scoped Pinia store's `onSnapshot`
setup/teardown (`services.ts`, `songs.ts`, `roster.ts`, `teams.ts`, `quarters.ts`, `slideGroups.ts`,
`scriptureSlides.ts`, `importedSlides.ts`, `pptxRenders.ts`, `serviceMessages.ts`, `songLyrics.ts`) and
reconciled all 11 against `resetOrgScopedStores()` (`src/stores/orgScopedStores.ts`) — no drift found;
every store's named teardown method is present and correctly wired. Read every migrated view's
`watch(() => authStore.orgId, ...)` pattern from quick 260901-lua (`ServicesView.vue`, `SongsView.vue`,
`DashboardView.vue`, `RosterView.vue`, `QuarterView.vue`, `ServiceEditorView.vue`, `TeamView.vue`) and
the `auth.ts` `memberUnsub`/`loadOrgContext`/`enterOrgAsSuperAdmin`/`exitSuperAdminView` surface.
Confirmed the teardown-before-resubscribe ordering is structurally correct at all 4 real org-switch
call sites (`selectOrg`, `enterOrgAsSuperAdmin`, `exitSuperAdminView`, `logout`) — no stale-org
`onSnapshot` can fire into the new org's UI through this path. Found one **High** finding
(`exitSuperAdminView()` has no re-entrancy guard, unlike its sibling `selectOrg`/`enterOrgAsSuperAdmin`
UI guards, exposing a live `memberUnsub` race/leak on rapid double-click) and three **Medium** findings
(a local teardown drift in `ServicesView.vue`, component-local subscriptions in `SongLyricEditor.vue`/
`ScriptureSlideEditor.vue` with no reactive org-change handling, and a single-consumer coupling note on
`pptxRenders.ts`'s listener pool).

**Task 2 — Multi-tenant (org) isolation architecture:** Verified `authStore.orgId` is the sole source
of truth for org-scoped Firestore path construction across every store/view reviewed; confirmed zero
hardcoded org IDs and zero route-param-driven org access in production `src/` (grep-verified). Reviewed
`firestore.rules`' `isOrgMember`/`isOrgEditor`/`isSuperAdmin` and `functions/src/orgMembershipClaims.ts`
(`decideMembershipClaim`, `computeOrgsClaimForUid`) — confirmed every server-side handler re-derives org
membership from Firestore/Auth-claim state rather than trusting a client-declared `orgId`. Assessed the
isolation implications of the church-switch flow reviewed in Task 1: no proven cross-tenant read/write
vector; F-LC-03 is the one finding with a genuine isolation dimension (reset-order-dependent rather than
self-defending), cross-referenced rather than duplicated. Re-confirmed (not re-litigated) the already-
accepted Phase 78 super-admin `isOrgEditor` residual (T-78-03). Flagged undeployed org-provisioning
Cloud Functions as a Phase 112 deploy-state-audit handoff item (deployment-state observation, not a
code defect).

## Findings Summary

| ID | Dimension | Severity | Location |
|----|-----------|----------|----------|
| F-LC-02 | Lifecycle | **High** | `src/stores/auth.ts:31,301-316,506-532,617-636`; `src/components/AppShell.vue:46-48,74-79` |
| F-LC-03 | Lifecycle + Isolation | Medium | `src/views/ServicesView.vue:364-390` |
| F-LC-04 | Lifecycle | Medium | `src/components/SongLyricEditor.vue:848-856`; `src/components/ScriptureSlideEditor.vue:230-247` |
| F-LC-06 | Lifecycle | Medium | `src/stores/pptxRenders.ts:37-70`; `src/composables/useSlideshowAssembly.ts:206-212` |
| F-ISO-03 | Isolation | Medium (Phase 112 handoff) | `functions/src/index.ts` re-exports of `orgProvisioning.ts` |
| F-LC-01, F-LC-05, F-ISO-01, F-ISO-02, F-ISO-04 | both | Low/informational | see findings file |

**Critical+High for Phase 111:** F-LC-02 only. **Medium for backlog:** F-LC-03, F-LC-04, F-LC-06,
F-ISO-03. Full detail (problem/impact/recommendation per finding) is in
`.planning/phases/110-architectural-review/110-FINDINGS-lifecycle-isolation.md`, consumed by the
consolidation plan 110-03.

## Deviations from Plan

None — plan executed exactly as written. No sub-agents were spawned (plan explicitly forbids it); the
review was conducted directly by the executor reading real source, per the `review_method_note`.

## Verification

- `.planning/phases/110-architectural-review/110-FINDINGS-lifecycle-isolation.md` exists, contains both
  dimension section headers, cites `resetOrgScopedStores` and `authStore.orgId` by name, and every
  finding carries an explicit severity token (Critical/High/Medium/Low) with a concrete file:line
  location.
- `git diff --name-only -- src functions firestore.rules storage.rules` returns empty — confirmed no
  source/rules files were modified by this plan.

## Known Stubs

None — this plan produces a Markdown findings artifact only, no application code.

## Threat Flags

None — matches the plan's own threat model (T-110-01/T-110-02, both `accept`, inert Markdown artifact
with no secrets, no new attack surface).

## Self-Check: PASSED

Verified files exist:
- FOUND: `.planning/phases/110-architectural-review/110-FINDINGS-lifecycle-isolation.md`

Verified commits exist (`git log --oneline --all | grep`):
- FOUND: 5caea65c (Task 1 — lifecycle dimension)
- FOUND: b1e5af43 (Task 2 — isolation dimension)
