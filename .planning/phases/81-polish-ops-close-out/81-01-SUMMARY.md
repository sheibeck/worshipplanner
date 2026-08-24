---
phase: 81-polish-ops-close-out
plan: 01
subsystem: ops
tags: [planning-center, resend, email-deliverability, verification, documentation]

# Dependency graph
requires:
  - phase: quick/260809-vvq
    provides: "PC-export coverage for PRAYER/MESSAGE/ANNOUNCEMENTS/MISC slots + the exhaustive SlotKind dispatch backstop in addSlotAsItem"
  - phase: 69-70 (v1.9)
    provides: "Firestore-backed appConfig.sender.fromAddress read live by both send paths via getAppConfig()"
provides:
  - "Re-confirmed R237 PC-export coverage across all 3 export modes, with the IMPORTED-excluded decision explicitly documented"
  - "functions/DEPLOY-EMAIL-DOMAIN.md owner runbook for Resend domain verification (SPF/DKIM/DMARC) + fromAddress cutover"
  - "R238 PENDING-VERIFICATION.md owner entry recording the outstanding DNS/domain verification steps"
  - "Re-confirmed both live send paths (sendQueuedMessageHandler, sendAdminOnboardingEmail) read config.sender.fromAddress, not a hard-coded sender"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - functions/DEPLOY-EMAIL-DOMAIN.md
  modified:
    - .planning/PENDING-VERIFICATION.md
    - .planning/phases/81-polish-ops-close-out/81-01-SUMMARY.md

key-decisions:
  - "IMPORTED slots (PPTX/image import slides) intentionally stay excluded from Planning Center export — they have no analogous Planning Center item type, the exclusion is already asserted by the existing R237 tests (kinds never contains IMPORTED), and it is consistent with R237's own examples (prayer/offering/welcome/message/announcements), which never mention PPTX/image imports. This is Claude's Discretion per 81-CONTEXT.md, exercised as: keep the current, tested behavior."
  - "No source rebuild for R237 or R238 — both were already shipped (R237 by quick/260809-vvq commit 8c602bc0; R238 across Phases 69-70). This plan is verification + documentation only."
  - "R238's owner runbook uses placeholder domains only (no real domains/secrets committed to the repo) per the threat model's T-81-01-02 mitigation."

requirements-completed: [R237, R238]

coverage:
  - id: D1
    description: "All 3 PC-export code paths (new-plan no-template, new-plan with-template, existing-plan) append PRAYER/MESSAGE/ANNOUNCEMENTS/MISC slots in every export mode, never IMPORTED; addSlotAsItem's per-SlotKind dispatch is compiler-enforced exhaustive"
    requirement: "R237"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts -t \"IMPORTED|previously dropped\" (3 tests)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build) — confirms addSlotAsItem's never-typed exhaustiveness backstop still compiles"
        status: pass
    human_judgment: false
  - id: D2
    description: "Owner runbook functions/DEPLOY-EMAIL-DOMAIN.md documents Resend domain add + SPF/DKIM/DMARC DNS records + verify-before-flip sequencing + setting fromAddress in the Owner Console + a real external-inbox test send"
    requirement: "R238"
    verification:
      - kind: manual_procedural
        ref: "functions/DEPLOY-EMAIL-DOMAIN.md — owner-run DNS/Resend dashboard steps, not app-verifiable"
        status: unknown
    human_judgment: true
    rationale: "DNS/domain verification is owner-run and external to the app; no automated check can confirm the runbook's real-world correctness, only its presence/content (grep-verified in the task gate)."
  - id: D3
    description: "Both live send paths (sendQueuedMessageHandler, sendAdminOnboardingEmail) build the From address from config.sender.fromAddress (Firestore-backed), not a hard-coded onboarding@resend.dev override"
    requirement: "R238"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts -t \"config.sender.fromAddress\""
        status: pass
      - kind: unit
        ref: "functions/src/adminEmail.test.ts (full file)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-24
status: complete
---

# Phase 81 Plan 01: R237 PC-Export Traceability + R238 Verified-Domain Email Runbook Summary

**Re-confirmed already-shipped R237 PC-export coverage and R238 sender wiring via existing tests; delivered the R238 owner runbook (`functions/DEPLOY-EMAIL-DOMAIN.md`) and a PENDING-VERIFICATION.md entry — no source rebuild.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-24T10:05:00Z
- **Completed:** 2026-08-24T10:30:00Z
- **Tasks:** 3
- **Files modified:** 2 (1 created: `functions/DEPLOY-EMAIL-DOMAIN.md`; 1 modified: `.planning/PENDING-VERIFICATION.md`), plus this SUMMARY.

## Accomplishments
- Re-ran the 3 existing R237 export-mode tests (`ServiceEditorView.test.ts`, the `260809-vvq` block) — all pass unchanged, confirming PRAYER/MESSAGE/ANNOUNCEMENTS/MISC slots export in all three PC-export modes (new-plan no-template, new-plan with-template, existing-plan) and `IMPORTED` never appears in the exported `kinds`.
- Confirmed `npm run type-check` (`vue-tsc --build`, which also typechecks test files per CLAUDE.md) stays clean, keeping `addSlotAsItem`'s `never`-typed exhaustiveness backstop (`src/utils/planningCenterApi.ts:1080-1081`) load-bearing — a future 9th `SlotKind` without a matching branch is a compile error, not a silent drop.
- Documented the intentional `IMPORTED`-excluded decision explicitly (this section, and the `key-decisions` frontmatter above): `IMPORTED` slides have no analogous Planning Center item type, so they correctly stay excluded from every export mode. This is not an oversight — it is a deliberate, tested design choice consistent with R237's own requirement examples.
- Wrote `functions/DEPLOY-EMAIL-DOMAIN.md`, a step-by-step owner runbook covering: choosing a real owner-controlled domain (Firebase-managed `*.web.app`/`*.firebaseapp.com` hosts cannot be verified), adding the domain in the Resend dashboard, publishing the generated SPF/DKIM/MX/DMARC DNS records, waiting for ALL records to verify before flipping the live sender, setting the Owner Console Sender "From address" to the verified address (a live Firestore write, no functions redeploy), and sending a real test message to a real external inbox.
- Appended an R238 entry to `.planning/PENDING-VERIFICATION.md` recording the owner-run DNS/domain-verification steps as an outstanding manual verification, pointing to the new runbook.
- Re-ran the existing functions send-path regression tests confirming both `sendQueuedMessageHandler` (`functions/src/index.test.ts`) and `sendAdminOnboardingEmail` (`functions/src/adminEmail.test.ts`) build the From address from `config.sender.fromAddress` (Firestore-backed, owner-editable), not a hard-coded sender. `onboarding@resend.dev` exists only as `DEFAULT_APP_CONFIG.sender.fromAddress` — the correct fallback until the owner sets a real value.

## Task Commits

Each task was committed atomically:

1. **Task 1 (R237): Re-confirm PC-export slot coverage and exhaustive SlotKind dispatch** - `9a3a99f4` (docs)
2. **Task 2 (R238): Write the owner email-domain runbook and PENDING-VERIFICATION entry** - `20df99b9` (docs)
3. **Task 3 (R238): Re-confirm both live send paths read config.sender.fromAddress** - verification-only, no files modified (evidence: passing `functions/src/index.test.ts -t "config.sender.fromAddress"` (2 tests) and `functions/src/adminEmail.test.ts` (6 tests) runs recorded in `coverage:` D3 above)

**Plan metadata:** (docs: complete plan — final commit, recorded after this update)

_Note: Task 3 is verification-only (no source files touched); its evidence is the passing test runs recorded above and in `coverage:`._

## Files Created/Modified
- `functions/DEPLOY-EMAIL-DOMAIN.md` - New owner runbook: Resend domain add, SPF/DKIM/MX/DMARC DNS records, verify-before-flip sequencing, setting `fromAddress` in the Owner Console, real external-inbox test send.
- `.planning/PENDING-VERIFICATION.md` - Appended an R238 owner entry recording the outstanding DNS/domain verification steps.
- `.planning/phases/81-polish-ops-close-out/81-01-SUMMARY.md` - This summary.

No changes to `src/utils/planningCenterApi.ts`, `src/views/ServiceEditorView.vue`, `functions/src/index.ts`, or `functions/src/adminEmail.ts` — per the plan, this was verification + documentation only.

## Decisions Made
- **IMPORTED stays excluded from PC export.** See `key-decisions` frontmatter above. This is the one edge case R237's "no dropped items" wording could have been read to cover, and the deliberate call (matching the existing tests and CONTEXT.md's own examples) is to keep it excluded, not add a generic placeholder item for it.
- **No coverage assertion added** — RESEARCH.md found no real gap in the exhaustive dispatch against the current `SlotKind` union, so none was added, per the plan's explicit guidance.
- **Runbook uses placeholder domains only** — no real domains, secrets, or DNS record values are embedded in `functions/DEPLOY-EMAIL-DOMAIN.md`, per the threat model's T-81-01-02 mitigation.

## Deviations from Plan

None - plan executed exactly as written. All three tasks were verification/documentation as scoped; no source rebuild occurred for either R237 or R238.

## Issues Encountered
None.

## User Setup Required

**External services require manual configuration.** See `functions/DEPLOY-EMAIL-DOMAIN.md` for:
- Adding a real sending domain in the Resend dashboard.
- Publishing the generated SPF/DKIM/MX/DMARC DNS records at the domain's DNS provider.
- Waiting for all records to show Verified before changing the live sender.
- Setting the Owner Console Sender "From address" to the verified address.
- Sending a real test message to a real external inbox to confirm delivery.

This is recorded as an outstanding owner-run item in `.planning/PENDING-VERIFICATION.md` (R238 entry) — not something this plan or any automated gate can complete.

## Next Phase Readiness
R237 and R238 are closed for this milestone from a code-and-test-coverage standpoint. R238's real-world completion (a verified Resend sending domain actually delivering mail) remains gated on the owner running the runbook — tracked in PENDING-VERIFICATION.md, not a blocker for this phase's other plans (R239, R240).

---
*Phase: 81-polish-ops-close-out*
*Completed: 2026-08-24*
