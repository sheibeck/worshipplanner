---
phase: 112-security-review
plan: 01
subsystem: security
tags: [firestore-rules, storage-rules, multi-tenant-isolation, custom-claims, security-review]

# Dependency graph
requires:
  - phase: 110-architectural-review
    provides: multi-tenant isolation architecture confirmed "otherwise sound"; ARCH-005/ARCH-018 handoff pointers
  - phase: 111-architectural-remediation
    provides: ARCH-001 fix + backlog entries, closing the way for the security-specific pass
provides:
  - "112-FINDINGS-rules-isolation.md: severity-ranked Firestore/Storage rules + multi-tenant isolation findings, grounded in live emulator evidence"
  - "Live rules-suite evidence (200/200 Firestore pass; Storage suite environment-blocked, not a rules defect)"
  - "Two High findings (legacy org self-provisioning bypass; member-removal Storage-claim revocation gap) ready for Phase 113 remediation"
affects: [112-04-consolidation, 113-security-remediation]

# Tech tracking
tech-stack:
  added: []
  patterns: [live-emulator-grounded rules review, ALLOW-case regression discipline for rules fixes]

key-files:
  created:
    - .planning/phases/112-security-review/112-FINDINGS-rules-isolation.md
  modified: []

key-decisions:
  - "Ran the rules suite exactly as specified (npx vitest run --config vitest.rules.config.ts) rather than starting a second emulator; Storage suite's connection failure (no :9199 emulator) is recorded as an environment gap distinct from the stale CLAUDE.md-documented firestore.exists() defect (storage.rules is claim-only since Deploy 2, 2026-08-12)."
  - "ARCH-005 and ARCH-018 are explicitly NOT re-scored in this file (owned by plan 112-02); IN-02/ARCH-018 is cross-referenced with a pointer only, to avoid conflicting severities across the three dimension files."
  - "Share-token/public-read collections (shareTokens, orgSlugs, orgNames, quarterShares, serviceShares) are noted but not independently scored — that depth-of-exposure review is plan 112-03's assigned dimension."

patterns-established:
  - "Each Critical/High rules finding names the specific ALLOW-case regression test Phase 113's fix must add, per R323 discipline."

requirements-completed: [R322]

coverage:
  - id: D1
    description: "Firestore rules test suite executed against the live :8080 emulator with verbatim pass/fail evidence recorded"
    requirement: R322
    verification:
      - kind: other
        ref: "npx vitest run --config vitest.rules.config.ts (200 passed, 0 failed in src/rules.test.ts)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Firestore & Storage rules + multi-tenant isolation reviewed; severity-ranked, concretely-located findings written to 112-FINDINGS-rules-isolation.md, split Critical/High vs Medium/Low, each C/H rules finding naming its required ALLOW-case test"
    requirement: R322
    verification: []
    human_judgment: true
    rationale: "Security-finding severity calls and completeness are a judgment review, not something a script can auto-verify — Phase 112-04 consolidation and Phase 113 remediation are the downstream checks on this work."

duration: 45min
completed: 2026-09-02
status: complete
---

# Phase 112 Plan 01: Firestore/Storage Rules + Multi-Tenant Isolation Security Review Summary

**Reviewed firestore.rules/storage.rules and multi-tenant isolation grounded in a live 200/200-passing Firestore rules-emulator run; found a legacy client-side org self-provisioning bypass (High) and a member-removal Storage-claim revocation gap (High), plus one Medium provenance-forgery gap and three Low/informational notes.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-02T15:54Z
- **Completed:** 2026-09-02T16:39Z
- **Tasks:** 2 (both auto)
- **Files modified:** 1 (created)

## Accomplishments
- Ran `npx vitest run --config vitest.rules.config.ts` against the live `:8080` Firestore emulator (`test-project` scope, prod `worship-planner-bc515` untouched): `src/rules.test.ts` 200/200 pass, 0 failures. `src/storage.rules.test.ts` could not connect (`ECONNREFUSED 127.0.0.1:9199` — no Storage emulator this session, confirmed independently via `curl`), which is a materially different failure mode than the CLAUDE.md-documented "2 known ALLOW-case failures" — static review confirmed `storage.rules` is now claim-only (Deploy 2, 2026-08-12) and CLAUDE.md's defect description is stale.
- Reviewed all 450 lines of `firestore.rules` and 79 lines of `storage.rules` area-by-area (org lifecycle guards, members/invites, services draft-lock, slideGroups, songs, pptxRenders, the `/{collection}/{docId}` wildcard, share-token/orgSlug/orgName/quarterShare/serviceShare public-read collections, aiUsage/aiRateLimits, appConfig/superAdmins, and storage.rules' `isOrgMemberByClaim`/`deactivatedOrgs` logic), plus the org-creation and member-removal code paths in `src/stores/auth.ts` and `functions/src/orgMembershipClaims.ts`/`orgProvisioning.ts`.
- Found **SEC-ISO-01 [High]**: a legacy client-side org self-provisioning path (`firestore.rules:125-130`, `150-159`) is still rule-live and lets any signed-in user self-create unlimited organizations and squat `orgSlugs`/`orgNames`, directly bypassing the documented current provisioning model ("Organizations are created only by a super-admin via the `onboardOrganization` callable," `src/stores/auth.ts:803-806`). Confirmed via repo-wide grep that no client code writes this shape anymore — only `src/rules.test.ts`'s own pinning test still exercises it.
- Found **SEC-ISO-02 [High]**: member removal (`organizations/{orgId}/members/{uid}` delete) clears the removed user's custom claims but never calls `getAuth().revokeRefreshTokens(uid)` (unlike org deactivation, `orgProvisioning.ts:461`, and super-admin revocation, `superAdminClaims.ts:126`, which both do). Since `storage.rules`' membership check is claim-only by deliberate design, a removed member can retain Storage read/write on org media/PPTX files for up to the client's next token refresh (~55 min).
- Found one Medium (`SEC-R-03`: `services/{docId}` draft-edit branch has no field-diff guard, so `createdBy` is forgeable while draft, unlike `organizations/{orgId}`'s ADR-0003-guarded equivalent) and three Low/informational notes (ARCH-018/IN-02 cross-reference deferred to 112-02; `'admin'` vs `'editor'` role self-escalation with no found real capability difference; public-read collections deferred to 112-03).

## Task Commits

Both tasks' deliverable was written in a single cohesive pass to the same output file (the live-evidence section and the full findings section were authored together, since the evidence directly informs the findings' grounding), then committed once:

1. **Task 1 + Task 2: Run rules suite for live evidence; review rules + isolation and write severity-ranked findings** - `b835704a` (docs)

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `.planning/phases/112-security-review/112-FINDINGS-rules-isolation.md` - Live rules-suite evidence + severity-ranked Firestore/Storage rules and multi-tenant isolation findings (2 High, 1 Medium, 3 Low/informational)

## Decisions Made
- Recorded the Storage-suite connection failure as an environment gap (no `:9199` emulator reachable this session) rather than re-litigating the CLAUDE.md-documented defect, and explicitly noted that defect is now stale relative to the current claim-only `storage.rules` — this is itself a documentation-currency observation worth a maintainer follow-up, but not a new security finding.
- Deliberately did not re-score ARCH-005/ARCH-018 (explicitly plan 112-02's assignment per the phase CONTEXT) or the public-read share/slug/name collections' PII depth (explicitly plan 112-03's assignment) — cross-referenced with pointers instead, to keep each dimension file's severities authoritative and non-conflicting for the 112-04 consolidation.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were met in a single authoring pass since the live-evidence section and the findings section are tightly coupled (findings cite the evidence directly).

## Issues Encountered
- The Storage emulator (`:9199`) was not running this session (only Firestore `:8080` was, matching the plan's stated assumption) — `src/storage.rules.test.ts` failed to connect entirely rather than exercising its 26 tests. This is recorded explicitly in the findings file's "Coverage gap" note: every Storage-side claim in the findings is grounded in static code reading, not live emulator evidence, for this reason. No emulator was started to work around this (out of scope for a review-only plan; starting a second emulator process is also excluded by the plan's own read_first guidance).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `112-FINDINGS-rules-isolation.md` is ready for plan 112-04's consolidation into `112-SECURITY-REVIEW.md`.
- Both High findings (SEC-ISO-01, SEC-ISO-02) are scoped with their required ALLOW-case regression tests already named, ready for Phase 113 remediation without further investigation.
- Follow-up worth flagging outside this plan's scope: CLAUDE.md's "storage.rules IS A REAL DEFECT" section should be refreshed to reflect the Deploy 2 (2026-08-12) claim-only migration — it currently describes a defect class that no longer exists in the code, which could mislead a future reviewer the same way the pre-2026-08-06 mislabel once did in the opposite direction.

---
*Phase: 112-security-review*
*Completed: 2026-09-02*
