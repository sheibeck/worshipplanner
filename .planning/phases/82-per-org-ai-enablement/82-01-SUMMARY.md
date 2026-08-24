---
phase: 82-per-org-ai-enablement
plan: 01
subsystem: api
tags: [firestore-rules, cloud-functions, firebase-admin, ai-proxy, super-admin]

# Dependency graph
requires:
  - phase: 76-church-deactivation-reactivation
    provides: "lifecycleFields() allow-list pattern + setOrgActiveHandler shape to mirror"
  - phase: 78-super-admin-enter-any-church
    provides: "assertSuperAdminCaller dual-check gate, reused verbatim"
provides:
  - "organizations/{orgId}.aiMasterEnabled -- a distinct, Admin-SDK-write-only boolean, absent/false = AI OFF"
  - "setOrgAiEnabled super-admin callable (enable/disable + R243 forced-off settings.aiEnabled write)"
  - "checkOrgAiEnablement -- fail-closed live gate wired into the api proxy's anthropic branch"
  - "OrgSummary.aiMasterEnabled on listOrganizations for the Owner Console table (Plan 02 consumer)"
affects: [82-02-owner-console-and-settings-ui, ai-proxy, owner-console]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin-SDK-only field via lifecycleFields() allow-list extension (no new rules function)"
    - "Super-admin callable mirroring an existing handler's shape without its unrelated side effects (no member-claim fan-out here)"
    - "Live per-request Firestore read as a fail-closed security gate, contrasted explicitly with the rate limiter's fail-open posture"

key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts
    - functions/src/orgProvisioning.ts
    - functions/src/orgProvisioning.test.ts
    - functions/src/index.ts
    - functions/src/index.test.ts
    - .planning/PENDING-VERIFICATION.md
    - .planning/phases/82-per-org-ai-enablement/82-VALIDATION.md

key-decisions:
  - "Field named aiMasterEnabled (never a bare aiEnabled) to avoid colliding with the pre-existing settings.aiEnabled -- per 82-RESEARCH.md Pitfall 1"
  - "DISABLE branch writes settings.aiEnabled:false via an explicit dot-path key, never a nested settings:{} object literal, so sibling settings fields are never clobbered"
  - "DISABLE short-circuit requires BOTH aiMasterEnabled AND settings.aiEnabled already false -- not aiMasterEnabled alone -- so a repeat disable still re-forces the church setting off"
  - "AI-proxy server gate fails CLOSED (503) on a Firestore read error, a deliberate departure from the rate limiter's fail-open posture, because this is the actual security control"
  - "setOrgAiEnabled omits setOrgActive's member-claim fan-out entirely -- AI enablement has no Storage-side enforcement or refresh-token revocation requirement"

patterns-established:
  - "New per-org master-gate fields extend the SHARED lifecycleFields() array rather than growing a parallel guard mechanism"
  - "A testable server-side security gate is extracted as a small async helper returning an ok/reject verdict object, mirroring enforceModelAndTokens' shape, so an onRequest handler with no HTTP test harness stays fully unit-testable"

requirements-completed: [R242, R243]

coverage:
  - id: D1
    description: "aiMasterEnabled added to firestore.rules lifecycleFields() -- an ordinary org editor and a super-admin's own client SDK are both DENIED writing it directly; a normal create-time payload (no aiMasterEnabled key) still succeeds"
    requirement: "R242"
    verification:
      - kind: integration
        ref: "npx vitest run --config vitest.rules.config.ts -t \"aiMasterEnabled\" (3/3 pass); full rules suite 222/222"
        status: pass
    human_judgment: false
  - id: D2
    description: "setOrgAiEnabled super-admin callable: caller gate, input validation, org-existence check, ENABLE/DISABLE writes, same-state short-circuit (with the edge-case guard requiring BOTH fields off before a DISABLE short-circuits), listOrganizations aiMasterEnabled field"
    requirement: "R242, R243"
    verification:
      - kind: unit
        ref: "cd functions && npx vitest run src/orgProvisioning.test.ts -t \"setOrgAiEnabled\" (11/11 pass); full file 62/62"
        status: pass
    human_judgment: false
  - id: D3
    description: "checkOrgAiEnablement gate helper wired into the api proxy's anthropic branch, ahead of appConfig/rate-limit/enforceModelAndTokens: deny/allow/fail-closed verdicts, plus full api() end-to-end wiring proving the 403/503 responses fire before fetch"
    requirement: "R243"
    verification:
      - kind: unit
        ref: "cd functions && npx vitest run src/index.test.ts -t \"org AI\" (8/8 pass); full functions suite 574/574"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live production toggle of AI for a real org, and a real direct-fetch 403 against the deployed proxy"
    verification: []
    human_judgment: true
    rationale: "Requires the owner-gated deploy (firestore:rules,functions:setOrgAiEnabled,functions:api) recorded in PENDING-VERIFICATION.md; nothing in this plan is deployed."

# Metrics
duration: 22min
completed: 2026-08-24
status: complete
---

# Phase 82 Plan 01: Per-Org AI Enablement — backend master gate Summary

**Super-admin-only `aiMasterEnabled` field + `setOrgAiEnabled` callable + fail-closed AI-proxy enforcement, all mirroring the existing `active`/`setOrgActive` pattern — ships BUILT + TESTED + UNDEPLOYED**

## Performance

- **Duration:** ~22 min (first commit 13:17:32 → last commit 13:36:01 local, plus verification/docs)
- **Started:** 2026-08-24T17:16:00Z (approx.)
- **Completed:** 2026-08-24T17:38:59Z
- **Tasks:** 3/3 completed
- **Files modified:** 8

## Accomplishments
- `firestore.rules`' `lifecycleFields()` allow-list extended with `aiMasterEnabled` — a distinct top-level field (never confused with `settings.aiEnabled`), Admin-SDK-write-only, denied to both an ordinary org editor and a super-admin's own client SDK.
- New `setOrgAiEnabled` super-admin callable in `functions/src/orgProvisioning.ts` mirroring `setOrgActiveHandler`'s shape (caller gate → validate → org-existence → same-state short-circuit → Admin SDK merge), with the R243 forced-off DISABLE branch writing `settings.aiEnabled: false` via an explicit dot-path key in the same write, and a same-state short-circuit that requires BOTH fields already off before skipping a redundant DISABLE.
- Real server-side enforcement: a new `checkOrgAiEnablement` helper does a live `organizations/{orgId}` read on every anthropic proxy request (before any billed work), denying 403 when the master gate is off and failing CLOSED with 503 on a Firestore read error — the actual security boundary, not merely UI hiding.
- `OrgSummary`/`listOrganizations` extended with `aiMasterEnabled` (defaults false) so the Owner Console table (Plan 02) can render current state.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the master-gate field to the firestore.rules lifecycle allow-list + ALLOW/DENY tests** - `3e4d6dd8` (feat)
2. **Task 2: Add the setOrgAiEnabled super-admin callable + forced-off disable branch + OrgSummary field** - `8249c1a2` (feat)
3. **Task 3: Fail-closed AI-proxy enforcement in the anthropic branch + record deploy hand-over** - `73fcefe9` (feat, includes PENDING-VERIFICATION.md + 82-VALIDATION.md doc updates)

**Plan metadata:** pending (this SUMMARY + STATE/ROADMAP update commit, see below)

## Files Created/Modified
- `firestore.rules` - `lifecycleFields()` array extended with `aiMasterEnabled`
- `src/rules.test.ts` - editor-DENY, super-admin-client-DENY (CRITICAL twin), and create-time no-regression tests for `aiMasterEnabled`
- `functions/src/orgProvisioning.ts` - `SetOrgAiEnabledRequest`/`Response` types, `setOrgAiEnabledHandler`, `setOrgAiEnabled` export, `OrgSummary.aiMasterEnabled`, `listOrganizationsHandler` extended
- `functions/src/orgProvisioning.test.ts` - caller-gate, validation, ENABLE/DISABLE, short-circuit (incl. the edge-case guard), and listOrganizations field tests
- `functions/src/index.ts` - `checkOrgAiEnablement` helper + wiring into the `api` onRequest anthropic branch, ahead of appConfig/rate-limit/enforceModelAndTokens
- `functions/src/index.test.ts` - unit tests for the helper (allow/deny/fail-closed) + two full `api()` end-to-end wiring tests (403 before fetch, 503 before fetch); `mockCombinedDb` extended with an `organizations` collection stub (defaults `aiMasterEnabled: true`) so the pre-existing WR-04 wiring tests keep testing what they tested before
- `.planning/PENDING-VERIFICATION.md` - Phase 82 Plan 01 UNDEPLOYED hand-over entry with the exact deploy command and the Berean post-deploy re-enable note
- `.planning/phases/82-per-org-ai-enablement/82-VALIDATION.md` - `nyquist_compliant: true`, 82-01 task rows marked done, sign-off checklist checked

## Decisions Made
- Field name `aiMasterEnabled`, not the CONTEXT.md-illustrative bare `aiEnabled`, per 82-RESEARCH.md's Pitfall 1 recommendation — avoids colliding with `settings.aiEnabled`.
- DISABLE writes the church setting off via the dot-path key form (`'settings.aiEnabled': false`), matching `SettingsView.vue:1047`'s own client-side save shape, so sibling `settings` fields (`bibleVersion`, etc.) can never be clobbered by an accidental nested-object merge.
- The same-state short-circuit for DISABLE is a conjunction (`aiMasterEnabled === false && settings.aiEnabled === false`), not `aiMasterEnabled` alone — plan-checker warning #3's edge case, now covered by a dedicated test proving a repeat disable still re-forces the setting off.
- `checkOrgAiEnablement` fails CLOSED (503) on a Firestore read error, explicitly contrasted in a code comment with the rate limiter's fail-open posture a few lines below it — this check IS the security control the owner asked to be "real."
- `setOrgAiEnabled` deliberately omits `setOrgActive`'s member-claim (`deactivatedOrgs`) fan-out and `revokeRefreshTokens` call — AI enablement has no Storage-side enforcement surface and no need to force a re-auth.

## Deviations from Plan

None — plan executed exactly as written. All three tasks landed with automated verification as specified; no Rule 1-4 auto-fixes were needed beyond the plan's own explicit edge-case guard (which was itself a stated task requirement, not a discovered deviation).

## Issues Encountered

Pre-existing tests in `functions/src/index.test.ts`'s "api (WR-04: anthropic branch end-to-end wiring)" describe block broke when the new anthropic-branch gate started requiring an `organizations` Firestore collection stub that `mockCombinedDb()` didn't provide (those tests authenticate as `uid1`/`org1`, so the new gate's live read now fires on every one of them). Fixed by extending `mockCombinedDb()` with an `organizations` collection defaulting to `{ aiMasterEnabled: true }`, keeping every pre-existing WR-04 assertion testing exactly what it tested before, plus two new dedicated wiring tests (403 deny, 503 fail-closed) proving the gate itself is reachable end-to-end through the real `api()` handler.

## User Setup Required

None - no external service configuration required. This plan required no `.env.local` changes and no secret was added.

## Deploy Discipline (do NOT deploy from this record)

Everything in this plan ships **BUILT + TESTED + UNDEPLOYED**, per the standing v1.5+ deploy discipline. The exact owner hand-over (deploy command + Berean re-enable note + post-deploy verification checklist) is recorded in `.planning/PENDING-VERIFICATION.md` under "Phase 82 Plan 01 — Per-Org AI Enablement: backend master gate (v2.2) — OWNER, PRE-DEPLOY":

```
firebase deploy --only firestore:rules,functions:setOrgAiEnabled,functions:api --project worship-planner-bc515
```

Deploying this turns AI OFF for every existing org (including Berean) until a super-admin explicitly re-enables it — this is the correct, intended behavior per R242, not a bug.

## Next Phase Readiness

The backend security boundary (R242/R243) is complete and independently enforceable — even before Plan 02's UI lands, a super-admin could call `setOrgAiEnabled` directly and the proxy would already refuse a disabled org. Plan 02 (Owner Console toggle + Settings-panel client gating) can now build purely on top of this: `OrgSummary.aiMasterEnabled` is already on the `listOrganizations` response shape, and the callable contract (`{orgId, aiEnabled}` → `{orgId, aiEnabled}`) is stable. No blockers.

---
*Phase: 82-per-org-ai-enablement*
*Completed: 2026-08-24*

## Self-Check: PASSED
