---
phase: 80-security-data-integrity-hardening
verified: 2026-08-24T09:20:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
# All 5/5 automated must-haves verified in source (rules 219/219 under the emulator,
# 735 targeted tests, type-check clean, app suite at the 2-file baseline). The items
# below are by-design deploy-gated + live checks; per the v2.2 standing grant they are
# DEFERRED to the owner (/gsd-verify-work 80) and preserved in PENDING-VERIFICATION.md
# (Phase 80 entry, which also carries the `firebase deploy --only firestore:rules` hand-over).
# WR-02 (orphaned subcollections on deleteService) is deferred to backlog 999.12, not a gap.
human_uat_deferred: true
human_verification:
  - test: "Deploy `firestore.rules` (`firebase deploy --only firestore:rules`) and, as a signed-in non-editor of a target org, attempt to `setDoc` an `inviteLookup/{email}` doc whose payload targets that org (e.g. via a forged network request or browser console call)."
    expected: "Create is denied (permission-denied) in production, mirroring the emulator DENY tests in `src/rules.test.ts`'s `inviteLookup create — R232 target-org-editor gate` block."
    why_human: "R232 ships built + tested + UNDEPLOYED per the phase's own deploy policy — production enforcement only exists after the owner runs the deploy command. No automated test can exercise the deployed rule."
  - test: "After the same deploy, as an org editor, attempt a direct client `updateDoc(organizations/{orgId}, { createdBy: 'someoneElse' })` (or via `deleteField()`)."
    expected: "Update is denied (permission-denied) in production, mirroring the emulator DENY tests for R233 in `src/rules.test.ts`."
    why_human: "R233 ships built + tested + UNDEPLOYED alongside R232 — same deploy-gated reasoning."
  - test: "Create a service, generate its public share link (opaque token and/or memorable `/:slug/service-:date` URL), delete the service, then open the previously-generated share URL in a browser."
    expected: "The old share URL no longer resolves to the deleted service's content (404 / not-found / access-denied), proving the shareTokens/serviceShareLinks/serviceShares revocation in `deleteService` actually breaks live public access, not just the Firestore documents in isolation."
    why_human: "Requires a live share link and a real browser navigation — cannot be proven by a mocked-Firestore unit test alone (which `src/stores/__tests__/services.test.ts` already covers at the call-shape level)."
  - test: "Import a PPTX deck, immediately open `EditSlideDrawer` on a slide whose render is still in flight (`renderState: 'pending'`), and observe the amber notice and disabled controls; then wait for the render to complete and confirm the notice disappears and controls re-enable."
    expected: "The amber `aria-live=\"polite\"` notice with the locked copy is visible while pending, footer actions and background-attach controls are disabled, and the slide becomes editable again once the render flips to ready — with the real async render timing (not a mocked renderState prop)."
    why_human: "Real PPTX render timing is asynchronous and environment-dependent (render-service); `EditSlideDrawer.test.ts`'s component tests already prove the wiring against a mocked `renderState`, but the live pending→ready transition needs a real import."
---

# Phase 80: Security & Data-Integrity Hardening Verification Report

**Phase Goal:** Known security and data-integrity gaps around invite creation, org identity, service deletion, song clearing, and pending slide renders are closed.
**Verified:** 2026-08-24T09:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Only an editor of the target org can create an `inviteLookup` record for that org — self-invite forgery closed — while invite → first-login acceptance still works (R232) | ✓ VERIFIED | `firestore.rules:495` `allow create: if isSignedIn() && isOrgEditor(request.resource.data.orgId);`. `src/rules.test.ts` `describe('inviteLookup create — R232 target-org-editor gate')` (ALLOW target-editor, DENY non-member, DENY mismatched-orgId) + `describe('Members create — R104 self-service membership hole')` Tests B/D (invite acceptance regression) re-confirmed green. `allow read`/`allow delete` untouched. Full rules suite: 193/193 `rules.test.ts` tests pass under the live Firestore emulator (independently re-run, not taken from SUMMARY). |
| 2 | An organization's `createdBy` field cannot be changed after creation by an org editor (R233) | ✓ VERIFIED | `firestore.rules:142-144` new `preservesCreatedBy()` sibling helper (`diff().affectedKeys().hasAny(['createdBy'])`), composed at line 179: `allow update: if isOrgEditor(orgId) && preservesLifecycleFields() && preservesCreatedBy();`. `src/rules.test.ts` DENY on reassignment (line 172), DENY on removal via `deleteField()` (line 190, added per 80-REVIEW IN-01 fix), ALLOW on an ordinary edit leaving `createdBy` unchanged (line 202). Independently re-run: all pass under the emulator. |
| 3 | Deleting a service revokes every one of its public share artifacts (`shareTokens`, `serviceShares`, `serviceShareLinks`), so a deleted service's share URL no longer resolves (R234) | ✓ VERIFIED | `src/stores/services.ts:414-493` `deleteService` — query-deletes every `shareTokens` doc (`serviceId == id`), existence-guards `serviceShareLinks/{id}`, existence-and-ownership-guards `serviceShares/{slug}__service-{date}` (`shareSnap.data().serviceId === id`, the CR-01 same-date-sibling fix), each step independently try/caught (WR-01 fix) so one failure doesn't block the others or the final service-doc delete. `writeSharePayload` (line ~685) confirmed to write `serviceId: service.id` onto the `serviceShares` doc, closing the loop the guard depends on. `src/stores/__tests__/services.test.ts`: multi-token deletion, present/absent link, present-and-owned/absent/owned-by-a-different-service share doc (CR-01 regression test), never-shared no-throw — all independently re-run and passing (102 tests in file). |
| 4 | Removing a song from a service clears that song's slides even when reprised elsewhere — no orphaned slides (R235) | ✓ VERIFIED | `src/utils/slideGroupMaterializer.ts:603-616` `rebuildSongGroup`'s `!songId` branch now returns `{changed: true, slides: []}` for a non-empty group and `{changed: false, slides: []}` (idempotent) for an already-empty one — fixing the Phase 30 W-03 stale-slides defect. Groups are keyed 1:1 by `slot.id`, so a reprise's two slots hold independent group docs. `src/utils/__tests__/slideGroupMaterializer.test.ts:686-727`: bug-lock test rewritten to assert the clear, idempotence case, and an explicit two-slot same-`songId` reprise-independence probe (clearing slot-a leaves slot-b's group untouched) — all pass. |
| 5 | When a deck slide's render is still pending, the edit UI warns and blocks customization so an edit is never silently discarded when the render flips pending → ready (R236) | ✓ VERIFIED | `src/components/slides/EditSlideDrawer.vue:720` `isPendingRender = computed(() => props.assembledSlide?.slide.renderState === 'pending')`, composed into both `canMutate` (line 636) and `canMutateBackground` (line 1036). Amber `aria-live="polite"` notice (lines 73-83) with the documented locked copy, notice precedence pending-render > song-group > serviceLocked encoded as one ternary chain (never stacked v-ifs). `src/components/slides/__tests__/EditSlideDrawer.test.ts:2364-2416`: notice text + aria-live, both gates disabled while pending, precedence-over-serviceLocked, and a dedicated ready-state regression — all pass. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firestore.rules` | `inviteLookup` create gate (R232) + `preservesCreatedBy()` on organizations update (R233) | ✓ VERIFIED | Both clauses present, correctly scoped, wired into the correct `allow` blocks. |
| `src/stores/services.ts` | `deleteService` share-artifact revocation (R234) | ✓ VERIFIED | Present, substantive, wired; independently confirmed the CR-01 and WR-01 review-fix commits landed in the file (not just the SUMMARY narrative). |
| `src/utils/slideGroupMaterializer.ts` | `rebuildSongGroup` reprise-safe clear (R235) | ✓ VERIFIED | Present, substantive, correctly isolated to the `!songId` branch. |
| `src/components/slides/EditSlideDrawer.vue` | Pending-render edit guard (R236) | ✓ VERIFIED | Present, substantive, composed into both mutation gates, correct precedence. |
| `src/rules.test.ts`, `src/stores/__tests__/services.test.ts`, `src/utils/__tests__/slideGroupMaterializer.test.ts`, `src/components/slides/__tests__/EditSlideDrawer.test.ts` | New/rewritten test coverage for all 5 requirements | ✓ VERIFIED | All four files independently re-run (not sourced from SUMMARY claims); all target tests pass. |
| `.planning/PENDING-VERIFICATION.md` | Phase 80 deploy hand-over for R232/R233 | ✓ VERIFIED | Exact `firebase deploy --only firestore:rules` command present at line 762, with post-deploy-only behaviors and two owner manual verifications documented. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `TeamView.vue` `onInvite()` | `inviteLookup/{email}` create | writeBatch payload already carries `orgId` | WIRED | No client change needed or made; confirmed by SUMMARY and cross-checked against the rules test using a real `writeBatch` shape (Tests B/D). |
| `writeSharePayload` (`services.ts`) | `deleteService`'s CR-01 ownership guard | `serviceId` field on `serviceShares/{slug}__service-{date}` | WIRED | `writeSharePayload` writes `serviceId: service.id`; `deleteService` reads `shareSnap.data().serviceId === id` before deleting — the write and the guard match. |
| `ServiceEditorView.vue` `onDelete()` | `deleteService` throw | try/catch surfacing `deleteError`, dialog stays open on failure | WIRED | WR-01 fix confirmed: caller no longer silently closes the confirm dialog on a `deleteService` rejection. |
| `EditSlideDrawer.vue` template | `isPendingRender` computed | `canMutate` / `canMutateBackground` / notice `v-if` | WIRED | All three consumption points confirmed present and correctly composed. |

### Anti-Patterns Found

None in the 5 phase-modified source files (`firestore.rules`, `src/stores/services.ts`, `src/utils/slideGroupMaterializer.ts`, `src/components/slides/EditSlideDrawer.vue`) relevant to R232-R236's own logic. No unresolved `TBD`/`FIXME`/`XXX` markers introduced by this phase.

### Behavioral Spot-Checks / Gates (independently re-run, not sourced from SUMMARY)

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Targeted test files (4) for all 5 requirements | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts src/components/slides/__tests__/EditSlideDrawer.test.ts src/stores/__tests__/services.test.ts src/views/__tests__/ServiceEditorView.test.ts` | 4 files / 735 tests passed | ✓ PASS |
| Rules suite under live Firestore+Storage emulator | `npx vitest run --config vitest.rules.config.ts` | 2 files / 219 tests passed (193 `rules.test.ts` + 26 `storage.rules.test.ts`) | ✓ PASS |
| Type gate | `npm run type-check` (`vue-tsc --build`) | clean, no output | ✓ PASS |
| Full app suite baseline | `npx vitest run` | 139/141 files passed, 4162/4188 tests passed; the 2 failing files are exactly the documented baseline (`src/storage.rules.test.ts` under jsdom env mismatch, `src/views/__tests__/RosterView.test.ts` stale assertion) — nothing new failing | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R232 | 80-01 | inviteLookup create gate | ✓ SATISFIED | `firestore.rules:495`, `src/rules.test.ts` |
| R233 | 80-01 | createdBy immutability | ✓ SATISFIED | `firestore.rules:142-144,179`, `src/rules.test.ts` |
| R234 | 80-02 | deleteService share revocation | ✓ SATISFIED | `src/stores/services.ts:414-493`, `src/stores/__tests__/services.test.ts` |
| R235 | 80-03 | Reprise-safe slide clear | ✓ SATISFIED | `src/utils/slideGroupMaterializer.ts:603-616`, `src/utils/__tests__/slideGroupMaterializer.test.ts` |
| R236 | 80-03 | Pending-render edit guard | ✓ SATISFIED | `src/components/slides/EditSlideDrawer.vue`, `src/components/slides/__tests__/EditSlideDrawer.test.ts` |

No orphaned requirements — REQUIREMENTS.md maps exactly R232-R236 to Phase 80, and all five appear in a plan's `requirements` field and are satisfied above.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `deleteService` orphans `services/{id}`'s `messages`/`lockSnapshots` subcollections (80-REVIEW WR-02) | Backlog 999.12 (`.planning/PROJECT.md:347-349`) | Explicitly deferred by the code-fixer per orchestrator instruction as out-of-scope for R234's share-artifact-revocation fix pass; recorded as a future Cloud-Function-based cascade delete, not silently dropped. |

This is not a Phase 80 gap: R234's own scope (per ROADMAP Success Criterion 3) is the three named public share artifacts (`shareTokens`/`serviceShares`/`serviceShareLinks`), not the service's private subcollections — WR-02 is a related but out-of-scope data-integrity item, correctly captured rather than silently dropped.

### Human Verification Required

1. **Deployed R232 self-invite denial** — deploy `firestore.rules`, attempt a forged `inviteLookup` create as a non-editor of the target org; expect denial. *Why human:* ships UNDEPLOYED per the phase's own deploy policy; no automated test reaches production.
2. **Deployed R233 createdBy-immutability denial** — same deploy, attempt an editor `updateDoc`/`deleteField()` on `createdBy`; expect denial. *Why human:* same deploy-gated reasoning.
3. **Live deleted-share-URL check (R234)** — share a service, delete it, open the old share URL; expect it dead. *Why human:* needs a live share link and real browser navigation, not just the mocked-Firestore unit assertions already covered.
4. **Live pending-render warning (R236)** — import a real PPTX deck, open a still-rendering slide in `EditSlideDrawer`, confirm the notice/disabled controls, then confirm it clears on completion. *Why human:* real async render-service timing, not a mocked `renderState` prop.

### Gaps Summary

None. All 5 ROADMAP success criteria (R232-R236) are verified in the actual codebase — not just claimed in SUMMARY.md — with independently re-run tests (735 targeted tests + 219 rules-suite tests + clean type-check + full-suite baseline confirmed unchanged) and a code-review-fix cycle (CR-01, WR-01, IN-01) confirmed landed in source. The only reason overall status is `human_needed` rather than `passed` is the phase's own by-design deploy-gated and live-environment checks (R232/R233 production deploy confirmation, R234 live share-URL death, R236 live render timing) — exactly as the phase description anticipated ("deploy hand-over is EXPECTED, not a gap").

---

*Verified: 2026-08-24T09:20:00Z*
*Verifier: Claude (gsd-verifier)*
