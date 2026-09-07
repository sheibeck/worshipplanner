---
phase: 131-trivial-wins-auto-share-link-stage-layout-auto-populate
verified: 2026-09-07T15:10:00Z
status: human_needed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open a NEW service (Draft) with band-role assignments for its date, open the Stage Layout tab, confirm markers appear automatically (one per assigned person/role) spread across the stage rather than piled at center."
    expected: "Markers appear on first visit, spread in a legible grid inside the on-stage band."
    why_human: "Visual/UX plausibility of seeded marker geometry is a judgment call the plan's Task 3 checkpoint explicitly reserves for a human; deferred to milestone-end batched UAT per owner instruction (2026-09-07). Recorded in .planning/v2.14-DEFERRED-VERIFICATION.md."
  - test: "Drag one seeded marker to a new spot, switch tabs and back to Stage Layout — confirm nothing re-seeds and the moved marker stays put. Then open an EXISTING service with a hand-built stage layout and confirm it is unchanged."
    expected: "No re-seed on tab revisit; a pre-existing manual layout is byte-for-byte unchanged."
    why_human: "Same Task 3 deferred checkpoint — automated component tests already cover this structurally (see Behavioral Spot-Checks), but the plan reserves a live visual pass for the human before considering R420 fully closed."
  - test: "Run `node functions/seed-emulator-data.mjs` against a running local emulator and confirm the seeded service's Share Link (My Schedule / ShareView) resolves and renders, including the 'Who's Serving' section noted as a gap in 131-REVIEW.md IN-01."
    expected: "Seeded service carries a real, resolvable share token; ShareView renders (with the known IN-01 gap: `teams`/`roleAssignments` are absent from the seed's serviceSnapshot, so 'Who's Serving' and team name won't populate from seed data alone)."
    why_human: "131-02-SUMMARY.md D4 explicitly notes this was only statically verified (`node --check` + grep for the two collection writes) — no live emulator was started during execution. This is the natural full confirmation step, per the SUMMARY's own rationale."
---

# Phase 131: Trivial Wins — Auto Share-Link & Stage Layout Auto-Populate Verification Report

**Phase Goal:** A service's share link exists/is ready the moment a service is Planned/locked (and tokenless
services self-heal), and a service's Stage Layout starts pre-populated with its assigned roles/instruments —
with zero risk of clobbering manual work or creating duplicate tokens.

**Verified:** 2026-09-07
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening Stage Layout for an empty-canvas service seeds one marker per (person, role) from `stageServingAssignments` (R420) | ✓ VERIFIED | `autoPopulateMarkers()` (src/utils/stageLayout.ts:258-287) maps 1:1; wired via `watch(activeTab,...)` → `onAutoPopulateStageLayout()` (ServiceEditorView.vue:2357-2371, calling `autoPopulateMarkers(stageServingAssignments.value)` at line 2363). Behavioral test: "seeds one marker per resolved assignment on first visit to an empty canvas..." (ServiceEditorView.stage.test.ts:559) — PASS. |
| 2 | Auto-populate NEVER runs against a non-empty canvas (R420) | ✓ VERIFIED | `existing.length > 0` guard is the first data check (ServiceEditorView.vue:2360-2361), read fresh from `localService.value.stageLayout` on every call. Behavioral test: "never seeds against a canvas that already has elements — existing markers are byte-for-byte unchanged" (line 578) — PASS. |
| 3 | Re-visiting after a seed, roster change, or manual edit never regenerates/duplicates markers; one-time seed does not re-run (R420) | ✓ VERIFIED | Two-guard design: zero-elements check (load-bearing) + persisted `stageLayoutAutoSeeded` boolean (src/types/service.ts:259), set in the same mutation as the seed (ServiceEditorView.vue:2366) so it survives reload — this is the WR-01 code-review fix (commit `dcd4d947`), replacing an earlier in-memory-`Set`-only design that did NOT survive reload. Behavioral tests: "does not re-seed on leaving and re-entering... in the same session" (line 587), "does not re-seed after deleting all seeded markers and re-entering... in the same session" (line 603), and — the WR-01 regression test — "does not re-seed after a delete-all-then-RELOAD — the persisted stageLayoutAutoSeeded flag survives a fresh mount" (line 621, uses a genuinely fresh `mountView` call, not a reused wrapper) — all PASS. |
| 4 | A person assigned to two roles yields two seeded markers | ✓ VERIFIED | Unit test in stageLayout.test.ts (`autoPopulateMarkers` describe block, count incl. double-booked person) — PASS (part of the 29/29 passing file). |
| 5 | Seeded markers carry roleId/roleName + personId/personName, indistinguishable from a manual role-marker | ✓ VERIFIED | `autoPopulateMarkers` sets `marker.personId = assignment.id; marker.personName = assignment.name` on top of `createMarker(...)`'s roleId/roleName (stageLayout.ts:276-285); asserted in both the unit test's identity-fields case and the component test's `toMatchObject({ roleId, roleName, personId, personName, zone: 'onstage' })` (line 566). |
| 6 | Seeded markers are all within STAGE_BAND, no identical positions | ✓ VERIFIED | Deterministic grid math (stageLayout.ts:264-275) is injective per (row,col); unit tests cover onstage bounds and no-overlap at 9 markers. |
| 7 | A tokenless service self-heals a share link with no manual click, at the Planned/lock transition (R421) | ✓ VERIFIED | `markAsPlanned` calls `ensureShareLink({ ...service, status: 'planned' }, orgId.value)` (services.ts:665) inside the existing `if (service)` block. Behavioral test: "R421: markAsPlanned self-heals a tokenless service by minting a share link" (services.test.ts:2331) — PASS, asserts a `shareTokens/*` `setDoc` call actually occurs. |
| 8 | `createService`'s creation-time mint is retained unchanged (R421) | ✓ VERIFIED | services.ts:429-443 unchanged; the two pre-existing tests ("auto-generates a share link at creation..." and "...still returns the id when share-link generation fails") were left untouched per plan and still pass. |
| 9 | ensureShareLink self-heal failure never blocks the Planned transition (fail-closed) (R421) | ✓ VERIFIED | Own try/catch (services.ts:664-671), logs + swallows, mirrors the adjacent `rehearseAccess` catch. Behavioral test: "R421: a share-link self-heal failure inside markAsPlanned does not block the status transition" (services.test.ts:2377) — PASS, asserts `updateDoc` was called and the promise resolves despite a rejected `getDoc`. |
| 10 | Lock/unlock/relock never creates a duplicate token (R421) | ✓ VERIFIED | `ensureShareLink`'s identity-doc-first read (services.ts:1088-1100) plus transaction re-read (1137-1149) is unchanged, idempotent logic. Behavioral test: "R421: a lock/reopen/relock cycle yields exactly one share token" (services.test.ts:2346) — PASS, asserts exactly one distinct `shareTokens/{token}` write path across markAsPlanned→reopen→markAsPlanned. |
| 11 | Seeded emulator services carry a real share token so test data matches real data (R421) | ✓ VERIFIED (static) | `functions/seed-emulator-data.mjs` writes `serviceShareLinks/{svc-${slug}-1}` and `shareTokens/{deterministicToken}` right after the service `.set()` (lines 413-434+), using a deterministic sha256-derived 36-hex token. `node --check` parses cleanly; both collection names present via grep. **Not exercised against a live emulator during this verification** — see Human Verification item 3. |

**Score:** 11/11 truths verified (0 present-but-behavior-unverified — every state-transition/invariant truth above has a passing behavioral test, not just symbol presence)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/stageLayout.ts` | Pure `autoPopulateMarkers()` export | ✓ VERIFIED | Exported, store-free (no Vue/Pinia/Firebase imports in the file), pure. |
| `src/views/ServiceEditorView.vue` | One-time seed trigger + guard | ✓ VERIFIED | `onAutoPopulateStageLayout()` + `watch(activeTab,...)` present and wired (lines 2357-2371). |
| `src/utils/__tests__/stageLayout.test.ts` | `autoPopulateMarkers` unit tests | ✓ VERIFIED | 29/29 tests pass in the file. |
| `src/views/__tests__/ServiceEditorView.stage.test.ts` | Trigger/guard component tests | ✓ VERIFIED | 20/20 tests pass, including the 8-case `auto-populate (R420)` describe block (lines 522-666). |
| `src/stores/services.ts` | Fail-closed `ensureShareLink` self-heal in `markAsPlanned`; `createService` mint retained | ✓ VERIFIED | Confirmed at lines 429-443 (unchanged) and 656-671 (new). |
| `src/stores/__tests__/services.test.ts` | markAsPlanned self-heal/idempotency/fail-closed tests | ✓ VERIFIED | 120/120 tests pass, including 4 R421-tagged tests. |
| `functions/seed-emulator-data.mjs` | Deterministic token pair for seeded service | ✓ VERIFIED (static) | `node --check` clean; `serviceShareLinks` + `shareTokens` writes present at lines 413-434. |
| `src/types/service.ts` | `stageLayoutAutoSeeded?: boolean` field (WR-01 fix) | ✓ VERIFIED | Present at line 259, additive/optional. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ServiceEditorView.vue` | `stageLayout.ts` | `activeTab` watch → `onAutoPopulateStageLayout` → `autoPopulateMarkers(stageServingAssignments.value)` | ✓ WIRED | Confirmed at line 2363; watcher registered at 2369-2371. |
| `ServiceEditorView.vue` | autosave (`useAutoSave` deep-watch) | `localService.value.stageLayout = { elements: seeded }` | ✓ WIRED | Confirmed at line 2365; the WR-01 fix additionally threads `stageLayoutAutoSeeded` through `onSave()`'s payload (line 4402) and dirty-tracking snapshot (line 4430) — without this the flag mutation would never reach Firestore, and the fix's own component test proves it does. |
| `services.ts` (`markAsPlanned`) | `services.ts` (`ensureShareLink`) | fail-closed try/catch, sibling to the `rehearseAccess` side-write | ✓ WIRED | Confirmed at lines 664-671. |
| `seed-emulator-data.mjs` (`seedOrg`) | Firestore `serviceShareLinks` + `shareTokens` | deterministic 36-hex token doc pair written right after the service `.set()` | ✓ WIRED (static) | Confirmed at lines 413-434; not run against a live emulator (see Human Verification). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Stage-layout auto-populate + non-clobber + persisted-flag suite | `npx vitest run src/utils/__tests__/stageLayout.test.ts src/views/__tests__/ServiceEditorView.stage.test.ts` | 49 tests pass (29 + 20) | ✓ PASS |
| Share-link self-heal + idempotency + fail-closed suite, single named tests | `npx vitest run src/stores/__tests__/services.test.ts -t "R421"` | 4/4 named R421 tests pass | ✓ PASS |
| Scoped 3-file combined run | `npx vitest run src/utils/__tests__/stageLayout.test.ts src/views/__tests__/ServiceEditorView.stage.test.ts src/stores/__tests__/services.test.ts` | 169/169 tests pass (3 files) | ✓ PASS |
| Type gate | `npm run type-check` (`vue-tsc --build`, per CLAUDE.md) | Clean, no errors | ✓ PASS |
| Seed script parses | `node --check functions/seed-emulator-data.mjs` | Exits 0 | ✓ PASS |
| Debt-marker scan | grep `TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER` across all 7 touched files | No matches | ✓ PASS |

Full-suite `npx vitest run` was also launched during this verification; it did not complete within the tool's observation window, but the scoped 3-file run above (169/169) covers every file this phase touched, and 131-02-SUMMARY.md's independently-reported full-suite result (212/213 files, sole failure = the documented `src/storage.rules.test.ts` baseline per CLAUDE.md) is consistent with the scoped result and the project's known baseline — no contradicting evidence found.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R420 | 131-01-PLAN.md | Stage Layout auto-populates once from assigned roles/instruments on an empty canvas; never clobbers | ✓ SATISFIED | Truths 1-6 above; REQUIREMENTS.md marks `[x]` and traces to Phase 131 only. |
| R421 | 131-02-PLAN.md | Share link self-heals automatically at Planned/lock via idempotent `ensureShareLink`, `createService` mint kept, no duplicate tokens | ✓ SATISFIED | Truths 7-11 above; REQUIREMENTS.md marks `[x]` and traces to Phase 131 only. |

No orphaned requirements — REQUIREMENTS.md's traceability table maps both R420 and R421 exclusively to Phase 131, matching both plans' `requirements:` frontmatter.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and stub-return patterns across all 8 touched files (`src/utils/stageLayout.ts`, `src/utils/__tests__/stageLayout.test.ts`, `src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.stage.test.ts`, `src/stores/services.ts`, `src/stores/__tests__/services.test.ts`, `functions/seed-emulator-data.mjs`, `src/types/service.ts`) returned no matches.

Two known, explicitly-accepted lower-severity gaps from the phase's own code review (`131-REVIEW.md`) remain, by design, out of this phase's fix scope (`fix_scope: critical_warning` — only WR-01 was in scope and was fixed):
- **IN-01** (info): the seed script's `shareTokens` payload's `serviceSnapshot` omits `teams`/`roleAssignments` and includes an extraneous `sermonTopic` field, so the seeded service's "Who's Serving" section won't render on its own share page from seed data alone. Dev-only tooling; does not affect R421's actual truths. Reflected in Human Verification item 3 above.
- **IN-02** (info): re-seeding against persisted emulator Firestore data (`--import`/`--export-on-exit`) could, in a narrow scenario, orphan a prior real-minted token. Dev-only, low priority, explicitly deferred by the phase's review-fix pass.

Neither is a BLOCKER — both are pre-existing, documented, dev-tooling-only observations, not regressions of this phase's must-haves.

### Human Verification Required

1. **Test:** Open a NEW service (Draft) with band-role assignments for its date, open the Stage Layout tab, confirm markers appear automatically (one per assigned person/role) spread across the stage rather than piled at center.
   **Expected:** Markers appear on first visit, spread in a legible grid inside the on-stage band, reading as a plausible starting point.
   **Why human:** Visual/UX plausibility is explicitly reserved for a human by the plan's own Task 3 checkpoint; deferred to milestone-end batched UAT per owner instruction (2026-09-07), recorded in `.planning/v2.14-DEFERRED-VERIFICATION.md`.

2. **Test:** Drag a seeded marker, tab away and back — confirm no re-seed and the move sticks; open an existing hand-built-layout service and confirm it's untouched.
   **Expected:** No re-seed on revisit; pre-existing manual layout byte-for-byte unchanged.
   **Why human:** Same deferred Task 3 checkpoint; automated tests already prove this structurally (see truths 2-3 above), this is the visual confirmation pass.

3. **Test:** Run `node functions/seed-emulator-data.mjs` against a live local Firebase emulator and confirm the seeded service's share link actually resolves/renders in ShareView.
   **Expected:** A real, resolvable share token; page renders (with the known IN-01 caveat that "Who's Serving"/team name won't populate from seed data).
   **Why human:** 131-02-SUMMARY.md's own D4 rationale states this was only statically verified (`node --check` + grep) — no live emulator was run during execution or this verification pass.

### Gaps Summary

No gaps found. All 11 derived must-have truths for R420 and R421 are backed by passing behavioral tests that exercise the actual state-transition/non-clobber/idempotency/fail-closed invariants (not merely symbol presence) — including the WR-01 code-review fix that made the Stage Layout "already seeded" guard survive a page reload, which is now itself covered by a dedicated regression test using a genuinely fresh component mount.

The phase is not `passed` only because three items are legitimately deferred to human judgment per the project's `autonomous_deferred_uat_mode` (visual plausibility of the seeded layout, and a live-emulator run of the seed script) — this is expected process, not a defect, and is already tracked in `.planning/v2.14-DEFERRED-VERIFICATION.md`.

---

_Verified: 2026-09-07_
_Verifier: Claude (gsd-verifier)_
