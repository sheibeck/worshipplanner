---
phase: 112-security-review
plan: 03
subsystem: security
tags: [firestore-rules, share-tokens, pii, cost-controls, rate-limiting, cloud-functions, gcloud]

# Dependency graph
requires:
  - phase: 112
    provides: "112-01's firestore.rules/isolation review (SEC-ISO-06 pointer to this file) and 112-02's Cloud-Functions-authorization review (SEC-A-01 cross-referenced here)"
provides:
  - "112-FINDINGS-sharetoken-pii-abuse.md — severity-ranked share-token/public-page exposure, PII-handling, and cost/abuse-controls findings, live-evidence-backed"
  - "Live proof (Firestore-emulator probe) that shareTokens/quarterShares/serviceShares are publicly LISTABLE, not merely gettable — a Critical cross-tenant PII leak"
  - "Live proof (read-only gcloud run) that the R173 render-service instance/concurrency ceilings and no-public-invoker IAM policy are actually deployed in production"
affects: [112-04-consolidation, 113-remediation]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Firestore allow read: if true grants BOTH get AND list — a collection needing token-gated single-doc access only must split into allow get: if true; allow list: if false;"]

key-files:
  created: [.planning/phases/112-security-review/112-FINDINGS-sharetoken-pii-abuse.md]
  modified: []

key-decisions:
  - "Wrote and ran a scratch Firestore-rules probe test (outside the repo, in the session scratchpad, never committed) to get live emulator evidence for the listability question rather than relying on static reading alone — the CONTEXT explicitly permits an emulator probe at Claude's discretion when a rule's behavior is ambiguous from reading."
  - "Ran two read-only `gcloud run` commands (describe + get-iam-policy) against the live worship-planner-bc515 project to verify R173's render-service ceilings are actually deployed, mirroring 112-02's read-only firebase functions:list precedent."
  - "Rated the shareTokens/quarterShares/serviceShares full-collection-listability finding (SEC-S-01) Critical, matching the CONTEXT rubric's 'cross-tenant data leak' bar exactly, rather than folding it into 112-01's SEC-ISO-06 (which only knew about the public-read grant, not that it also permits listing)."

requirements-completed: [R322]

coverage:
  - id: D1
    description: "Share-token/public-page exposure and PII-handling review, written to 112-FINDINGS-sharetoken-pii-abuse.md with severity-ranked, concretely-located findings (SEC-S-01..05)"
    requirement: "R322"
    verification:
      - kind: other
        ref: "grep -q '## Critical/High' .planning/phases/112-security-review/112-FINDINGS-sharetoken-pii-abuse.md && grep -qi 'ShareView\\|shareTokens\\|/share/' .planning/phases/112-security-review/112-FINDINGS-sharetoken-pii-abuse.md"
        status: pass
    human_judgment: true
    rationale: "Severity assignment (Critical/High/Medium/Low) and completeness of the review's coverage are judgment calls the Phase 113/Plan 04 consolidator and eventually the owner must weigh in on; automated grep only proves the file's structural shape, not the correctness of its security conclusions."
  - id: D2
    description: "Cost/abuse-controls review (api proxy caps, email/message fan-out) written to the same findings file (SEC-C-01..06)"
    requirement: "R322"
    verification:
      - kind: other
        ref: "grep -qiE 'rate.?limit|maxInstances|quota|proxy|fan-out|email' .planning/phases/112-security-review/112-FINDINGS-sharetoken-pii-abuse.md"
        status: pass
    human_judgment: true
    rationale: "Same as D1 — severity/completeness of a security review is not mechanically verifiable; a human (Phase 113 planner, then the owner) must weigh the findings before acting on them."

duration: ~50min
completed: 2026-09-02
status: complete
---

# Phase 112 Plan 03: Share-Token/PII/Cost-Abuse Security Review Summary

**Live Firestore-emulator probe proves `shareTokens`/`quarterShares`/`serviceShares` are fully LISTABLE (not just gettable) via `allow read: if true`, exposing every organization's shared service plans and volunteer names cross-tenant with no token needed — the review's single Critical finding, plus 4 Medium/Low share/PII findings and 6 cost/abuse findings (2 Medium, 4 confirmed-sound-or-Low), all written to `112-FINDINGS-sharetoken-pii-abuse.md`.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-02
- **Tasks:** 2/2 completed
- **Files modified:** 1 (the findings file, written across two commits)

## Accomplishments

- **SEC-S-01 [Critical]:** Live-proved (via a scratch, non-committed Firestore-emulator probe test)
  that `shareTokens`, `quarterShares`, and `serviceShares` — all three using unsplit `allow read: if
  true` — are enumerable by ANY unauthenticated caller via a plain collection-level query, not merely
  readable by exact token/id. This bypasses the entire "opaque 144-bit token" security model these
  collections were designed around and exposes every org's shared service snapshots (volunteer names,
  sermon notes, dates) cross-tenant, with zero token guessing required. No existing test in
  `src/rules.test.ts` exercised this query shape for any of the three collections.
- **SEC-S-02 through SEC-S-05:** Documented the memorable-URL guessability tradeoff (Medium — a real
  but bounded, condition-dependent weakness `SEC-S-01`'s fix does not itself close), the lack of
  share-link expiry/rotation (Low, informational), the free-text `notes` field carrying no PII
  allowlist unlike the deliberately-guarded `roleAssignments` (Low), and confirmed the structured
  names-only PII guard plus both public views' soft-fail error handling are correctly implemented (no
  finding).
- **SEC-C-01 [Medium]:** Found that the ESV/NLT Bible-API proxy branches require auth and per-org
  enablement but are NOT covered by the per-uid rate limiter that protects the Anthropic branch — an
  inconsistency in an otherwise well-built cost-control system.
- **SEC-C-02 through SEC-C-04:** Confirmed the Anthropic proxy path's five-layer cost controls are
  sound end-to-end, the rate-limiter's fail-open vs. the enablement-checks' fail-closed posture is
  correctly and deliberately split, and — via two read-only `gcloud run` commands against the live
  production project — confirmed the R173 render-service instance/concurrency ceilings AND its
  no-public-invoker IAM policy are actually deployed today, not merely documented in `DEPLOY.md`.
- **SEC-C-05/SEC-C-06 [Low]:** Found `queueServiceMessage` and `parsePptx` have no per-uid/per-org
  rate limit or daily quota of their own (unlike R161/R171), bounded only by downstream per-message/
  per-org-daily caps and the shared `maxInstances` ceiling — self-inflicted-only impact, not
  cross-tenant.
- **Cross-reference note:** Sharpened 112-02's `SEC-A-01` (unauthenticated `planningcenter` route)
  under the cost/abuse lens — it shares the SAME 10-instance concurrency pool as the billed
  `anthropic`/`esv`/`nlt` routes, so unauthenticated traffic could starve legitimate paid-feature
  requests, a de facto DoS mounted through the one unauthenticated route.

## Task Commits

Each task was committed atomically:

1. **Task 1: Review share-token/public-page exposure and PII handling; write severity-ranked findings** - `ee2c2846` (feat)
2. **Task 2: Review cost/abuse controls; write severity-ranked findings** - `4450ef2e` (feat)

**Plan metadata:** pending (this SUMMARY + STATE.md/ROADMAP.md commit follows)

## Files Created/Modified

- `.planning/phases/112-security-review/112-FINDINGS-sharetoken-pii-abuse.md` - Severity-ranked
  findings for share-token/public-page exposure (SEC-S-01..05) and cost/abuse controls (SEC-C-01..06),
  each with a stable id, severity, concrete location, and — for the one Critical/High rules-related
  finding — the required ALLOW-case emulator test a Phase 113 fix must add.

## Decisions Made

- Authored a throwaway Firestore-rules probe test in the session scratchpad (never under `src/`, never
  committed) to get live, not merely inferred, evidence for the listability question — the CONTEXT
  explicitly leaves "whether to author a small emulator allow/deny probe" to Claude's discretion when a
  rule's behavior is ambiguous from static reading alone. The probe proved conclusively (3/3 assertions
  succeeded) that all three public-read share collections are listable.
- Ran two read-only `gcloud run` commands (`services describe`, `services get-iam-policy`) against the
  live `worship-planner-bc515` project — the same "read-only evidence, no write/deploy action" pattern
  112-02 established with `firebase functions:list` — to confirm the R173 render-service ceilings are
  actually live, not just documented in `DEPLOY.md`.
- Rated `SEC-S-01` Critical (not High) because it is squarely a cross-tenant data leak per the
  CONTEXT's own rubric definition, trivially exploitable (no tools beyond the Firebase SDK and this
  project's already-public config), and defeats the entire token-based access model rather than merely
  weakening it.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<read_first>` files were read in full, both
dimensions were reviewed area-by-area as instructed, and the one Critical/High rules-related finding
(`SEC-S-01`) names its required ALLOW-case test per the plan's acceptance criteria. The plan's
`<critical_project_notes>` explicitly permitted cross-referencing `SEC-A-01` from 112-02 as a
cost/abuse vector — done, without re-scoring it.

## Issues Encountered

None. The Firestore emulator (port 8080) and `gcloud` CLI (authenticated against the live project,
confirmed by 112-02's prior session) were both already available and were used read-only, as
112-01/112-02 had already established was safe for this phase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `112-FINDINGS-sharetoken-pii-abuse.md` is ready for Plan 04's consolidation into
  `112-SECURITY-REVIEW.md` alongside `112-FINDINGS-rules-isolation.md` (112-01) and
  `112-FINDINGS-auth-functions.md` (112-02).
- `SEC-S-01` (Critical) is the single highest-severity finding produced by any of the three 112
  plans found so far in this review pass and should anchor Phase 113's remediation priority — it is a
  small, well-scoped Firestore rules fix (`allow get`/`allow list` split across three collections) with
  an explicit required-test list already written into the finding.
- No blockers. No code was changed and nothing was deployed during this review.

---
*Phase: 112-security-review*
*Completed: 2026-09-02*

## Self-Check: PASSED
