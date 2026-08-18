---
phase: 59-messages-composer-send-path
plan: 01
subsystem: infra
tags: [resend, cloud-functions, messaging, recipient-resolver, supply-chain, tdd]

# Dependency graph
requires:
  - phase: 17-seeding-join-resolver
    provides: resolveServiceRoleAssignments + findQuarterForDate pure resolver (client original ported here)
  - phase: 58-messages-composer
    provides: resolveRecipients reachability split + RecipientSelection shape (client original ported here)
provides:
  - resend@6.19.0 as an exact-pinned, functions-only dependency (never in the client bundle, R131)
  - functions/src/serviceRoles.ts — self-contained port of the pure resolver with zero ../src or @/ imports
  - resolveMessageRecipients — server-enriched recipient split carrying per-recipient roleNames (R139)
  - functions/src/serviceRoles.test.ts — 14 lockstep tests with the client resolver coverage
affects: [59-02, 59-03, sendQueuedMessage, their_roles-templating]

# Tech tracking
tech-stack:
  added: [resend@6.19.0 (functions-only, exact pin, UNDEPLOYED)]
  patterns:
    - "functions/ duplicates client pure utils rather than importing them (pptxParser precedent) — separate tsconfig, no @/ alias"
    - "server-side recipient resolution stays PURE (types only, no Firestore); the Admin-SDK load happens in the 59-03 caller and feeds arrays through"

key-files:
  created:
    - functions/src/serviceRoles.ts
    - functions/src/serviceRoles.test.ts
  modified:
    - functions/package.json
    - functions/package-lock.json

key-decisions:
  - "Pinned resend EXACTLY to 6.19.0 (not ^, not the <24h-old 6.20.0); npm rewrote it to ^6.19.0 on install and the caret was reverted by hand"
  - "resolveMessageRecipients takes already-resolved assignments (not service/quarters/roles) so the send trigger owns the Admin-SDK load and this function stays pure"
  - "roleNames accumulate in resolve order with per-person dedup; an individual-only match carries roleNames === []"

patterns-established:
  - "Functions-local domain types (PortedRole/PortedService/PortedQuarter/PortedPerson) hand-mirror the minimal fields the algorithm touches — no client-type import"
  - "Supply-chain legitimacy for a new dep is discharged by direct npm-registry diligence and recorded in the SUMMARY + routed to PENDING-VERIFICATION for owner pre-deploy re-confirm"

requirements-completed: [R131, R139]

coverage:
  - id: D1
    description: "resend pinned exactly to 6.19.0 in functions/package.json only, resolvable under functions/node_modules, absent from root package.json and all of src/ (R131)"
    requirement: R131
    verification:
      - kind: unit
        ref: "cd functions && node -e \"require('./package.json').dependencies.resend==='6.19.0' && require.resolve('resend')\""
        status: pass
      - kind: other
        ref: "grep -ri resend src/ -> no files found; root package.json has resend: false"
        status: pass
    human_judgment: false
  - id: D2
    description: "functions/src/serviceRoles.ts is a self-contained port (zero ../src or @/ imports) of findQuarterForDate + resolveServiceRoleAssignments, compiling under functions/tsconfig.json"
    requirement: R131
    verification:
      - kind: unit
        ref: "functions/src/serviceRoles.test.ts#findQuarterForDate + #resolveServiceRoleAssignments"
        status: pass
      - kind: integration
        ref: "cd functions && npm run build (tsc, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "resolveMessageRecipients returns per-reachable-person roleNames (person A's roles != person B's) so sendQueuedMessage can render {{their_roles}} per recipient (R139)"
    requirement: R139
    verification:
      - kind: unit
        ref: "functions/src/serviceRoles.test.ts#Test I (R139 per-recipient roleNames divergence)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The port's dedup + empty-email-unreachable + stale-person-skip semantics match the client resolveRecipients exactly, proven by lockstep tests"
    requirement: R139
    verification:
      - kind: unit
        ref: "functions/src/serviceRoles.test.ts#Test D/E/G/H (dedup, empty-email, stale-skip, stale-vs-unreachable)"
        status: pass
    human_judgment: false
  - id: D5
    description: "resend@6.19.0 legitimacy re-confirmed and deploy-side setup (Resend account, RESEND_API_KEY secret, SPF/DKIM/DMARC DNS, firebase deploy) performed"
    requirement: R131
    verification: []
    human_judgment: true
    rationale: "Deploy-gated by the v1.7 grant — nothing is deployed and no secret set this phase. Owner re-confirms the pin and does the deploy-side setup in 59-02/59-03. Routed to PENDING-VERIFICATION.md; must NOT be marked passed here."

# Metrics
duration: 36min
completed: 2026-08-14
status: complete
---

# Phase 59 Plan 01: Send-Path Infrastructure Summary

**resend@6.19.0 added as an exact-pinned functions-only dependency plus functions/src/serviceRoles.ts — a self-contained port of the pure recipient resolver that additionally yields per-recipient roleNames for {{their_roles}} (R131/R139), all UNDEPLOYED.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-08-14T15:08Z
- **Completed:** 2026-08-14T15:44:23Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Added `resend` to `functions/package.json` pinned **exactly** to `6.19.0` (no caret), server-only — absent from the root `package.json` and all of `src/`, so the provider SDK never reaches the client bundle (R131).
- Ported the pure resolver into `functions/src/serviceRoles.ts` (`findQuarterForDate`, `resolveServiceRoleAssignments`) with functions-local domain types and **zero `../src`/`@/` imports**, matching the `functions/src/pptxParser.ts` duplicate precedent and compiling cleanly under `functions/tsconfig.json`.
- Added `resolveMessageRecipients(assignments, people, selection)` — the server-enriched reachability split that carries **per-recipient roleNames** (person A `["guitar"]` != person B `["sound","livestream"]`), the R139 basis for `{{their_roles}}`, while preserving the client's dedup / empty-email-unreachable / stale-person-skip semantics.
- Wrote `functions/src/serviceRoles.test.ts` (14 tests) kept in lockstep with the client resolver coverage, asserting the per-person roleNames divergence explicitly so R139 cannot silently regress.

## Task Commits

1. **Task 1: Legitimacy record for resend@6.19.0** — no code commit (evidence recorded in this SUMMARY + routed to PENDING-VERIFICATION.md; registry verify `npm view resend@6.19.0` confirmed the version and integrity hash)
2. **Task 2: Add resend@6.19.0 (server-only, exact pin)** — `f953db6` (chore)
3. **Task 3 (TDD RED):** add failing tests for the functions serviceRoles port — `a9a902d` (test)
4. **Task 3 (TDD GREEN):** port the pure resolver + roleNames split — `ec365d0` (feat)

No REFACTOR commit — the GREEN implementation was already clean.

## Gate Output

**Functions unit suite** — `cd functions && npx vitest run src/serviceRoles.test.ts`:
```
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

**Functions build (proves zero ../src/@ imports resolve-fail)** — `cd functions && npm run build`:
```
> build
> tsc
BUILD_EXIT=0
```

**Root app suite (stays at 2-file known-failing baseline)** — `npx vitest run`:
```
 Test Files  2 failed | 106 passed (108)
      Tests  13 failed | 3322 passed (3335)
```
The 2 failing files are exactly the documented baseline — `src/storage.rules.test.ts`
(Storage-emulator cross-service `firestore.exists()` limitation) and
`src/views/__tests__/RosterView.test.ts` (stale assertion). The new
`functions/src/serviceRoles.test.ts` is self-contained (plain fixtures, node-safe),
so it is collected under the root jsdom run and **passes** without adding a failure.

## Files Created/Modified
- `functions/src/serviceRoles.ts` — self-contained pure resolver port + `resolveMessageRecipients` roleNames split (created)
- `functions/src/serviceRoles.test.ts` — 14 lockstep tests, plain-object fixtures (created)
- `functions/package.json` — `resend` pinned exactly to `6.19.0` under dependencies (modified)
- `functions/package-lock.json` — lockfile entry for resend@6.19.0 and its 5 transitive deps (modified)

## Package Legitimacy Evidence (Task 1 — DISCHARGED, not blocking)
The 59-RESEARCH.md SUS/too-new flag keyed on the LATEST release (6.20.0, published 2026-08-13); the **pin is 6.19.0**, which is not too-new. Orchestrator npm-registry diligence (2026-08-14) recorded:
- resend@6.19.0 published **2026-08-10** (prior release 6.18.0 was 2026-07-21) — 4 days old, not a same-day drop.
- Maintainers are the official **Resend org** (zenorocha = Zeno Rocha, jopcmelo@resend.com, carolmoreschi@resend.com, gabrielmfern, lucasfcosta, vcapretz, et al.).
- **No install-time scripts** — package.json has no preinstall/install/postinstall; the only lifecycle hook is `prepublishOnly` (runs on the maintainer's publish, never on consumer install), so `npm install` executes no package code.
- Valid `dist.integrity` sha512 (`sha512-JnEdYnd9WyBDIzunsEZtUF8n3cBKM9SlmySaos/7wwi4sEXKG1Zz4M64VFAyk+278erX01Fq2wHQ3p7OIdPriA==`), canonical `registry.npmjs.org/resend` tarball, repo github.com/resend/resend-node, ~9.5M weekly downloads — not a slopsquat.
- Residual risk this phase ~zero: resend is functions-only, UNDEPLOYED, and `vi.mock`'d wherever it will be used — the real module never executes until the owner deploys, at which point the owner re-confirms the pin (PENDING-VERIFICATION 59-01).

## Decisions Made
- **Exact pin enforced by hand.** `npm install resend@6.19.0` rewrote the manifest to `^6.19.0`; the caret was reverted to the bare `6.19.0` the plan requires (avoids ever floating onto the too-new 6.20.0).
- **resolveMessageRecipients takes resolved assignments**, not `(service, quarters, roles, ...)` — the 59-03 send handler owns the Admin-SDK Firestore load and feeds arrays through, keeping this function pure and unit-testable with plain objects.
- **roleNames accrue only from team/everyone matches**; a person included solely via `individualPersonIds` carries `roleNames: []` (they have no matched role to name).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm rewrote the exact pin to a caret range**
- **Found during:** Task 2 (add resend to functions/package.json)
- **Issue:** `npm install resend@6.19.0` wrote `"resend": "^6.19.0"` into `functions/package.json`; the plan requires an EXACT pin (no caret) to prevent floating onto the <24h-old 6.20.0.
- **Fix:** Reverted the manifest entry to `"resend": "6.19.0"`; re-verified with `require.resolve` and the exact-string check.
- **Files modified:** functions/package.json
- **Verification:** `node -e "require('./package.json').dependencies.resend==='6.19.0'"` passes; module resolves.
- **Committed in:** `f953db6` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The auto-fix restores the exact-pin invariant the plan mandates. No scope creep.

## Issues Encountered
None. All three gates passed on the first implementation. The root-suite `grep`-based file listing during verification was noisy (case-insensitive "fail" matched test descriptions/stack lines), so the baseline was confirmed against the authoritative `Test Files` summary and the real `FAIL <path>` headers — exactly the 2 documented baseline files.

## User Setup Required
None this plan — DEPLOY-GATED. The Resend account, `RESEND_API_KEY` secret, SPF/DKIM/DMARC DNS, and `firebase deploy` are owner steps handed to 59-02/59-03 and recorded in `.planning/PENDING-VERIFICATION.md` (item 59-01). They must NOT be marked passed here.

## Next Phase Readiness
- `resend` is present and resolvable under `functions/node_modules` so 59-03's `functions/src/index.ts` can `import { Resend }` and compile.
- `resolveMessageRecipients` is ready for the 59-03 `sendQueuedMessageHandler` to consume for per-recipient `{{their_roles}}` rendering.
- **Blocker (intentional):** nothing is deployed and no secret is set — the owner must complete the PENDING-VERIFICATION 59-01 pre-deploy steps before the send path goes live.

---
*Phase: 59-messages-composer-send-path*
*Completed: 2026-08-14*

## Self-Check: PASSED
- `functions/src/serviceRoles.ts` — FOUND
- `functions/src/serviceRoles.test.ts` — FOUND
- Commit `f953db6` (chore: resend dep) — FOUND
- Commit `a9a902d` (test RED) — FOUND
- Commit `ec365d0` (feat GREEN) — FOUND
