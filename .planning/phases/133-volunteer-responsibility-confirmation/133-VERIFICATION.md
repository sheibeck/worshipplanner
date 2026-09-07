---
phase: 133-volunteer-responsibility-confirmation
verified: 2026-09-07T19:10:00Z
status: human_needed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "A volunteer on a Planned service taps 'I've got it' on VolunteerServiceView; confirm it flips to a green Confirmed chip with Undo; tap Undo and confirm it returns to the 'I've got it' button."
    expected: "Confirm -> green Confirmed chip + Undo; Undo -> reverts to Unconfirmed ('I've got it' button reappears)."
    why_human: "Requires a real browser session against a live/emulated Firestore; unit tests stub onSnapshot/setDoc/deleteDoc and cannot prove the real click->write->re-render round trip."
  - test: "With the planner's ServiceEditorView Roles tab open in one browser tab and the volunteer's VolunteerServiceView open in a second tab/session for the same service, confirm in the volunteer tab and watch the planner tab's chip flip from Unconfirmed to Confirmed without a reload."
    expected: "The planner's chip updates live, in place, within a few seconds, with no manual refresh."
    why_human: "Requires two concurrent live browser sessions sharing a real Firestore backend; the onSnapshot wiring is proven by mocked unit tests (ServiceEditorView.confirmations.test.ts) but not by a genuine cross-session round trip."
  - test: "Confirm a role as a volunteer, then as the planner: reopen the service, reassign that role to someone else, and relock (Mark as Planned). Confirm the original volunteer's confirmation now shows 'Needs reconfirmation' on the roster, while a confirmation for an untouched role on the same service still shows Confirmed."
    expected: "Reassigned role's stale confirmation flips to Needs reconfirmation; unrelated unchanged confirmations are untouched."
    why_human: "Requires driving the full confirm -> reopen -> reassign -> relock cycle against a real service and Firestore; reconcileConfirmations' flip/preserve logic is unit-tested with mocked Firestore but the end-to-end relock cycle needs a live UI session."
  - test: "In MessageComposer, with one role confirmed and a sibling role not confirmed for the same service, toggle 'Unconfirmed only' and send a nudge; confirm delivery (or the Resend test-mode inbox) shows only the unconfirmed person's assignment was targeted, and the composer's live 'Reaches N' preview narrows correctly when the toggle is flipped."
    expected: "Only the unconfirmed person is targeted server-side; the client preview count matches; the toggle's visual placement/labeling reads clearly."
    why_human: "Requires a live send against a real service's confirmations state (or the Resend test-mode inbox) and a visual/UX judgment of the toggle chip; resolver logic is unit-tested on both client and server but the live send path and visual toggle placement are not."
---

# Phase 133: Volunteer Responsibility Confirmation Verification Report

**Phase Goal:** A worship-team volunteer can confirm ("I've got it") a per-assignment
responsibility; a planner sees live status on the roster and can nudge only the unconfirmed —
without going stale across reassignment/relock, and without broadening volunteer access.
**Verified:** 2026-09-07
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A volunteer can confirm ("I've got it") and un-confirm (Undo) a per-assignment responsibility in their own surface — two-state only, no Decline | ✓ VERIFIED | `src/components/rehearse/VolunteerConfirmBar.vue` — confirm writes `setDoc` with the 6 allowlisted fields, undo `deleteDoc`s; mounted in `VolunteerServiceView.vue` (`myAssignments` computed from `doc.roleAssignmentsByEmailLower`); 7 passing behavioral component tests (confirm write payload, undo delete, live-flip, needsReconfirmation state, re-subscribe) in `VolunteerConfirmBar.test.ts` |
| 2 | A planner sees each assignment's confirmation status (Confirmed/Unconfirmed/Needs reconfirmation) on the roster, read LIVE via `onSnapshot` (never a one-time fetch) | ✓ VERIFIED | `ServiceEditorView.vue:4255-4301` — `subscribeConfirmations()` uses `onSnapshot` on `organizations/{orgId}/services/{id}/confirmations`, re-subscribes on org/service-id change via `watch(..., {immediate:true})`, tears down via `unsubscribeConfirmations` on unmount; grep-confirmed zero `getDoc`/`getDocs` in the display path; `ServiceEditorView.confirmations.test.ts` (4/4 pass) drives fake snapshot emissions and asserts in-place chip flips with no remount |
| 3 | On relock (reassignment/unlock→relock), a prior Confirmed whose assignment is no longer valid flips to Needs reconfirmation; an unchanged assignment's confirmation is left untouched — no stale checkmark | ✓ VERIFIED | `src/stores/services.ts:340-364` `reconcileConfirmations()` diffs `computeValidConfirmationKeys()` against stored `confirmed` docs and `updateDoc`s only stale ones; wired into `markAsPlanned` immediately after `writeRehearseAccessDoc` (services.ts:710-725), in its own best-effort try/catch; 7 behavioral unit tests in `services.test.ts` cover stale-flip, unchanged-untouched, already-needsReconfirmation-not-rewritten, no-create-for-unconfirmed, and two best-effort-failure cases — all pass |
| 4 | A planner can send reminder nudges targeting ONLY unconfirmed/needs-reconfirmation assignments, reusing the v1.7 messaging send pipeline (no new send primitive) | ✓ VERIFIED | `unconfirmedOnly?: boolean` added identically to client `RecipientSelection` (`messagingRecipients.ts`) and server `RecipientSelection`/`RecipientSelector` (`functions/src/serviceRoles.ts`, `functions/src/index.ts`); per-assignment (not per-person) qualification logic hand-mirrored in both; `MessageComposer.vue` toggle persists `unconfirmedOnly` on `queueServiceMessage`'s `recipientSelector`; no new quota/kill-switch/send-path code added (confirmed by reading `sendQueuedMessageHandler` — it reuses the existing `Promise.all`/`resolveMessageRecipients` call) |
| 5 | The authoritative unconfirmed-only send list is re-resolved SERVER-SIDE from the confirmations subcollection — the client's declared intent is never trusted as the final list | ✓ VERIFIED | `functions/src/index.ts:2049-2093` — `sendQueuedMessageHandler` conditionally reads `serviceRef.collection('confirmations').get()` via the Admin SDK only when `unconfirmedOnly` is true, builds `confirmedKeys` from doc ids where `status==='confirmed'`, and passes it into `resolveMessageRecipients` — the client only ever supplies the boolean flag, never a resolved id list; functions suite 707/707 pass, `tsc` build clean |
| 6 | Volunteer access is NOT broadened: a volunteer can write ONLY their own confirmation doc for a service they're assigned to; no new write surface is added to `services/{serviceId}` itself; the CR-01 privilege-escalation gap (editor arm gated on `isOrgMember` instead of `isOrgEditor`) is genuinely closed | ✓ VERIFIED | Independently re-read `firestore.rules:278-344` — both the `create, update` (line 331) and `delete` (line 342) editor-arm disjuncts now read `isOrgEditor(orgId)`, not `isOrgMember(orgId)`; independently re-ran `npx vitest run --config vitest.rules.config.ts -t "Volunteer confirmation scoped write"` against the already-running emulator — all 15 tests pass, including (10b)/(10c) proving a plain non-editor member is now DENIED, and (4b) proving a forged `roleName` is DENIED (WR-02); test (8) proves zero new write surface on `services/{docId}` |

**Score:** 6/6 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/confirmations.ts` | pure model: `ConfirmationStatus`, `ConfirmationDoc`, `confirmationKey()`, `computeValidConfirmationKeys()` | ✓ VERIFIED | Exists, 69 lines, all four exports present and used by 4+ downstream files |
| `firestore.rules` (`confirmations` match block) | volunteer scoped write rule | ✓ VERIFIED | Lines 278-344; nested under `services/{docId}`; independently confirmed `isOrgEditor` gate post-fix |
| `src/rules.test.ts` (R410 describe block) | 12+ ALLOW/DENY tests | ✓ VERIFIED | 15 tests present and independently re-run, all pass |
| `src/components/rehearse/VolunteerConfirmBar.vue` | per-role confirm/undo control | ✓ VERIFIED | Exists, wired into `VolunteerServiceView.vue`, 7 tests pass |
| `src/views/__tests__/ServiceEditorView.confirmations.test.ts` | live-status render test | ✓ VERIFIED | Exists, 4/4 pass |
| `src/stores/services.ts` (`reconcileConfirmations`) | relock invalidation | ✓ VERIFIED | Exists, wired into `markAsPlanned`, 7 tests pass |
| `functions/src/index.ts` (`sendQueuedMessageHandler`) | server-authoritative unconfirmedOnly re-resolve | ✓ VERIFIED | Confirmed read + filter logic present; functions build clean; 707/707 functions tests pass |
| `src/utils/messagingRecipients.ts` / `functions/src/serviceRoles.ts` | client/server resolver filter | ✓ VERIFIED | Both carry matching `unconfirmedOnly`/`confirmedKeys` logic |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `confirmations` rule | `rehearseAccess/{serviceId}` | exists()-guarded sibling `get()` | ✓ WIRED | `firestore.rules:279-290, 310-319` |
| `buildRehearseAccess.roleIdsByEmailLower` | confirmations rule's roleId check | shared field | ✓ WIRED | `rehearseAccess.ts` populates it; `firestore.rules:317` reads it |
| `VolunteerServiceView.doc.roleAssignmentsByEmailLower[myEmailLower]` | `VolunteerConfirmBar` props | computed | ✓ WIRED | `VolunteerServiceView.vue:238-240` |
| `VolunteerConfirmBar` confirm/undo | `confirmations/{roleId}_{emailLower}` | `setDoc`/`deleteDoc` | ✓ WIRED | `VolunteerConfirmBar.vue:152-186` |
| `ServiceEditorView` `onSnapshot(confirmations)` | `confirmationStatusFor` chip render | live Map | ✓ WIRED | `ServiceEditorView.vue:4255-4301, 1459-1474` |
| `markAsPlanned` | `reconcileConfirmations` | best-effort call after `writeRehearseAccessDoc` | ✓ WIRED | `services.ts:710-725` |
| `MessageComposer` `unconfirmedOnly` toggle | `queueServiceMessage.recipientSelector` | persisted field | ✓ WIRED | `MessageComposer.vue:689` |
| `sendQueuedMessageHandler` | `serviceRef.collection('confirmations').get()` | conditional Admin-SDK read | ✓ WIRED | `functions/src/index.ts:2056-2093` |

### Behavioral Spot-Checks / Independent Re-Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Confirmation rules ALLOW/DENY (15 cases incl. CR-01/WR-01/WR-02 fixes) | `npx vitest run --config vitest.rules.config.ts -t "Volunteer confirmation scoped write"` (against already-running emulator) | 15/15 pass, including (10b)/(10c) DENY-for-non-editor and (4b) DENY-forged-roleName | ✓ PASS |
| Phase 133 unit/component test files | `npx vitest run <8 phase-specific test files>` | 232/232 pass | ✓ PASS |
| Functions suite | `cd functions && npm test` | 707/707 pass | ✓ PASS |
| Functions build | `cd functions && npm run build` | clean, zero errors | ✓ PASS |
| Full app suite baseline | `npx vitest run` (bare, no `--dir`) | 215/216 files pass, 5567/5602 tests pass; the ONE failing file is `src/storage.rules.test.ts` (documented Storage-emulator `firestore.exists()` cross-service limitation per CLAUDE.md, not a regression) | ✓ PASS (matches documented baseline) |
| Type-check | `npm run type-check` (`vue-tsc --build`) | clean, zero errors | ✓ PASS |
| firestore.rules confirmations block manual read | Read `firestore.rules:260-344` directly | Confirmed both `create/update` and `delete` editor-arm disjuncts use `isOrgEditor`, not `isOrgMember`; WR-01's single-`get()` collapse and WR-02's roleName pair validation both present in code (not just claimed in REVIEW-FIX.md) | ✓ PASS |

### Anti-Patterns Found

None. Scanned all 11 phase-modified files for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and stub patterns — zero hits (one incidental "not a TODO" comment, not a marker). No empty implementations, no hardcoded-empty stub returns, no hollow props found in any confirmation read/write path.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R410 | 133-01, 133-02 | Two-state volunteer confirm/un-confirm | ✓ SATISFIED | VolunteerConfirmBar.vue + confirmations rule + 12+ rules tests |
| R411 | 133-03 | Planner-visible live status via onSnapshot | ✓ SATISFIED | ServiceEditorView.vue live subscription + chips |
| R412 | 133-01, 133-04 | Invalidate on reassignment/relock, keyed on stable identity | ✓ SATISFIED | computeValidConfirmationKeys + reconcileConfirmations |
| R413 | 133-05 | Unconfirmed-only nudge, server-authoritative, reusing v1.7 pipeline | ✓ SATISFIED | unconfirmedOnly filter (client+server) + sendQueuedMessageHandler read |

No orphaned requirements — REQUIREMENTS.md maps exactly R410-R413 to Phase 133, and all four are claimed across the five plans.

### Code Review Findings (independently confirmed closed)

A code review (`133-REVIEW.md`) found 1 critical (CR-01: the confirmations editor-write arm was gated on `isOrgMember` instead of `isOrgEditor`, granting any plain org member — not just editors — unrestricted forge/delete access over every volunteer's confirmation, directly underminable the R413 targeting guarantee) plus 2 warnings (WR-01 redundant `get()`, WR-02 unvalidated `roleName`). `133-REVIEW-FIX.md` claims all 3 were fixed. This verification independently re-read the fixed `firestore.rules` block and independently re-ran the 15 confirmation rules tests against the emulator (not trusting the REVIEW-FIX or SUMMARY narration) — the fix is genuinely present in the code and the corrected ALLOW/DENY boundary is proven by passing tests, including two new DENY cases (10b, 10c) and one new DENY case (4b) that specifically lock in the fix.

### Human Verification Required

4 items need human/live-browser testing (see YAML frontmatter for the full test/expected/why_human detail):

1. **Volunteer confirm/undo round trip** — tap "I've got it" → Confirmed; Undo → back to Unconfirmed, in a real browser against live/emulated Firestore.
2. **Cross-session live planner chip flip** — a volunteer confirming in one session flips the planner's Roles-tab chip in another session without reload.
3. **Full relock invalidation cycle** — confirm → reopen → reassign → relock → confirm the reassigned role shows Needs reconfirmation while an unchanged role's confirmation is untouched.
4. **Live unconfirmed-only nudge send** — with a mixed confirmed/unconfirmed roster, toggle "Unconfirmed only" and confirm only the unconfirmed person is targeted, plus a visual/UX check of the toggle's placement.

All four are already documented by the phase's own plans/summaries as deferred UAT under this milestone's `/gsd-autonomous` (UAT-deferred) execution mode — consistent with v2.14's established pattern (see `v2.14-DEFERRED-VERIFICATION.md`, which does not yet list Phase 133; the milestone orchestrator is expected to batch these in at milestone end per the SUMMARY notes). This verification surfaces them here so they are not lost.

### Gaps Summary

No code-level gaps found. Every observable truth for R410-R413 is backed by real, wired, behaviorally-tested code (not stubs, not presence-only). The one critical security finding from the phase's own code review (CR-01) was independently confirmed to be genuinely fixed in `firestore.rules`, with the corrected boundary proven by 15 independently-re-run ALLOW/DENY tests. The full app suite, functions suite, and type-check all pass at (or better than) the documented baseline. The phase is blocked from a final `passed` verdict only by the 4 human-verification items above, which require a live browser session and are expected/deferred under this milestone's autonomous execution mode.

---

_Verified: 2026-09-07_
_Verifier: Claude (gsd-verifier)_
