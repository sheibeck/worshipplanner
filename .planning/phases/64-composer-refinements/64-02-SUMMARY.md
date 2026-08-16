---
phase: 64-composer-refinements
plan: 02
subsystem: messaging
tags: [merge-tokens, cloud-functions, resend, send-path, r154, vitest, tdd]

# Dependency graph
requires:
  - phase: 59-messaging-send
    provides: "renderMessageTokens pure server renderer + MessageTokenContext (per-recipient token substitution)"
provides:
  - "Per-recipient {{name}} server merge token in renderMessageTokens (functions/src/messageTokens.ts)"
  - "MessageTokenContext.recipientName required per-recipient field"
  - "index.ts send-path call site passes recipientName: target.name"
affects: [64-03-client-token-palette, messaging, send-path-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-recipient server token substitution (mirrors {{their_roles}} R139 shape): one replaceToken line + one required MessageTokenContext field + call-site literal"

key-files:
  created: []
  modified:
    - functions/src/messageTokens.ts
    - functions/src/index.ts
    - functions/src/messageTokens.test.ts

key-decisions:
  - "recipientName is a REQUIRED field on MessageTokenContext (not optional) so the build gate catches a missed supplier at both the call site and the test ctx() helper"
  - "{{song_list}} server support retained unchanged — only the client palette (64-03) drops the chip; legacy/scheduled/relock docs may still carry it"
  - "Refreshed stale 'four token' doc comments to match the now-five supported tokens (correctness/doc only)"

patterns-established:
  - "New per-recipient token = required MessageTokenContext field + one replaceToken(out, token, ctx.field) line + call-site literal, gated by cd functions && npm run build"

requirements-completed: [R154]

coverage:
  - id: D1
    description: "renderMessageTokens substitutes {{name}} with the current recipient's own display name, per-recipient (the SAME template renders different names for recipient A vs B), and replaces every occurrence"
    requirement: R154
    verification:
      - kind: unit
        ref: "functions/src/messageTokens.test.ts#replaces {{name}} with the CURRENT recipient's own display name (R154 server)"
        status: pass
      - kind: unit
        ref: "functions/src/messageTokens.test.ts#R154: the SAME body template renders different {{name}} for recipient A vs recipient B"
        status: pass
      - kind: unit
        ref: "functions/src/messageTokens.test.ts#replaces every occurrence of a repeated {{name}} token, not just the first"
        status: pass
    human_judgment: false
  - id: D2
    description: "{{song_list}} stays supported server-side (not removed) — existing regression cases stay green"
    requirement: R154
    verification:
      - kind: unit
        ref: "functions/src/messageTokens.test.ts#replaces {{song_list}} with the SONG titles in the given order, comma-joined"
        status: pass
      - kind: unit
        ref: "functions/src/messageTokens.test.ts#renders {{song_list}} as empty when there are no songs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Call site (index.ts:1738) passes recipientName: target.name and the functions project builds clean (required-field supplied at both call site and test ctx helper)"
    requirement: R154
    verification:
      - kind: unit
        ref: "cd functions && npm run build (tsc)"
        status: pass
      - kind: unit
        ref: "cd functions && npm test (260 tests, 8 files)"
        status: pass
    human_judgment: false
  - id: D4
    description: "In production, each recipient sees their own name in a sent message body — end-to-end via the deployed send trigger + real Resend key"
    verification: []
    human_judgment: true
    rationale: "Ships UNDEPLOYED per v1.8 grant (NO deploy, NO secret). The send path needs an owner redeploy before {{name}} takes effect in production; end-to-end personalization is verified by the owner at /gsd-verify-work 64 (verification_deferred_human)"

# Metrics
duration: 6 min
completed: 2026-08-15
status: complete
---

# Phase 64 Plan 02: R154 Server `{{name}}` Merge Token Summary

**Added a per-recipient `{{name}}` merge token to the authoritative server renderer `renderMessageTokens`, mirroring the existing `{{their_roles}}` per-recipient shape, while retaining `{{song_list}}` server support — built + tested, shipped UNDEPLOYED.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-15T21:34:00Z
- **Completed:** 2026-08-15T21:41:00Z
- **Tasks:** 1 (TDD)
- **Files modified:** 3

## Accomplishments
- `renderMessageTokens` (functions/src/messageTokens.ts) now substitutes `{{name}}` with the current recipient's own display name, per-recipient — one `replaceToken(out, "name", ctx.recipientName)` line mirroring the `{{their_roles}}` line, using the same regex-escape helper.
- `MessageTokenContext` gained a required `recipientName: string` field, documented like `theirRoles`.
- The single send-path call site (functions/src/index.ts:1738) now passes `recipientName: target.name` — `target.name` was already in scope on every `SendTarget` (roster name, or `"You"` for the self-copy).
- `{{song_list}}` server support left intact (messageTokens.ts) — the existing regression cases stay green; only the client palette (64-03) drops the chip.
- Full functions suite (260 tests, 8 files) and `tsc` build both clean.

## Task Commits

Each task was committed atomically (TDD):

1. **Task 1 (RED): failing {{name}} tests + ctx() default** - `27e101a` (test)
2. **Task 1 (GREEN): {{name}} token + interface field + call site** - `34871f6` (feat)

_No REFACTOR commit needed — the GREEN change was minimal and clean._

## Files Created/Modified
- `functions/src/messageTokens.ts` - Added required `recipientName` field to `MessageTokenContext`; added the `{{name}}` substitution line; refreshed stale "four token" doc comments to reflect five supported tokens.
- `functions/src/index.ts` - Send-path `tokenCtx` literal (:1738) now passes `recipientName: target.name`.
- `functions/src/messageTokens.test.ts` - Added `recipientName` default to the `ctx()` helper; added three `{{name}}` cases (own-name render, per-recipient A-vs-B, repeated-token). Existing four-token + `{{song_list}}` cases retained.

## Decisions Made
- `recipientName` is a REQUIRED (not optional) field on `MessageTokenContext`, so `cd functions && npm run build` fails TS on any missed supplier — this is the gate that guarantees both the call-site literal and the test `ctx()` helper were updated.
- `{{song_list}}` server support retained unchanged; server must still substitute it for older/scheduled/relock docs. The client-side chip removal is 64-03's scope, not this plan's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness/Docs] Refreshed stale "four token" doc comments**
- **Found during:** Task 1 (GREEN)
- **Issue:** The file header, the `MessageTokenContext` doc, and the `renderMessageTokens` JSDoc all said "four tokens" / "the four supported tokens", which became inaccurate once the fifth (`{{name}}`) was added.
- **Fix:** Updated the three comments to describe the supported tokens generically and to note `{{name}}` alongside `{{their_roles}}` as per-recipient (R139/R154). No behavior change.
- **Files modified:** functions/src/messageTokens.ts
- **Verification:** `cd functions && npm test` (260 pass) and `npm run build` (clean).
- **Committed in:** `34871f6` (GREEN task commit)

---

**Total deviations:** 1 auto-fixed (1 doc/correctness)
**Impact on plan:** Doc-only accuracy fix alongside the planned change. No scope creep; no behavior change beyond the planned `{{name}}` token.

## Issues Encountered
None.

## Gate Results
- `cd functions && npx vitest run src/messageTokens.test.ts` — **16 passed (16)**, 1 file.
- `cd functions && npm test` — **260 passed (260)**, 8 files.
- `cd functions && npm run build` (tsc) — **clean, exit 0.**
- `npx vitest run` (root app suite) — **2 failed | 114 passed (116) files; 13 failed | 3583 passed (3596) tests.** The 2 failing files are exactly the documented known-failing baseline: `src/storage.rules.test.ts` (Storage-emulator `firestore.exists` inert — environment limitation, CLAUDE.md) and `src/views/__tests__/RosterView.test.ts` (stale assertion). This plan touches only `functions/`, so it has zero effect on the root app suite.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- **Ships UNDEPLOYED (v1.8 grant: NO deploy, NO secret, NO `.env.local`).** The `{{name}}` token is built + tested but not live: the send path is undeployed by phase boundary. For `{{name}}` to take effect in production, the **owner must redeploy the send path** — this folds into the existing v1.7 send-path deploy step; NO new deploy command is introduced by this plan.
- **PENDING-VERIFICATION (verification_deferred_human):** after the owner redeploys with a real Resend key, send a message containing `{{name}}` and confirm each recipient sees their own name (recorded at `/gsd-verify-work 64`).
- Ready for 64-03 (client token palette), which drops the `{{song_list}}` chip client-side while server support remains.

## Self-Check: PASSED

- `functions/src/messageTokens.ts` exists on disk.
- `.planning/phases/64-composer-refinements/64-02-SUMMARY.md` exists on disk.
- Commit `27e101a` (RED test) present in git history.
- Commit `34871f6` (GREEN feat) present in git history.

---
*Phase: 64-composer-refinements*
*Completed: 2026-08-15*
