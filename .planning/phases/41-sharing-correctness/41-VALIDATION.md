---
phase: 41
slug: sharing-correctness
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 (app suite) + `@firebase/rules-unit-testing` (rules suite) |
| **Config file** | `vite.config.ts` (app, excludes `src/rules.test.ts`) · `vitest.rules.config.ts` (rules) |
| **Quick run command** | `npx vitest run --dir src --exclude '**/rules.test.ts' src/stores/__tests__/services.test.ts` |
| **Full suite command** | `npx vitest run` then `npm run type-check` |
| **Rules suite command** | `npm run test:rules` (starts its own emulator; if one is already up, use `npx vitest run --config vitest.rules.config.ts`) |
| **Estimated runtime** | ~10s targeted · ~90s full app suite · ~40s rules suite |

> ⚠ **Command discipline, from CLAUDE.md — do not deviate.** `npx vitest run src/` picks up
> `render-service/src/render.test.ts` by substring match and dies on a Vitest version mismatch.
> `npx vitest run --dir src` bypasses `vite.config.ts`'s relative exclude and runs `src/rules.test.ts`
> without an emulator. Use **`npx vitest run --dir src --exclude '**/rules.test.ts'`** or bare
> `npx vitest run`. A run reporting `src/rules.test.ts` failing is a tooling artifact of the command,
> not a regression.
>
> ⚠ **Type-check gate is `npm run type-check` (`vue-tsc --build`), never `-p tsconfig.app.json`** —
> the narrow form silently skips test files and has already let five `TS2339` errors survive two
> full phases.

---

## Sampling Rate

- **After every task commit:** Run the targeted quick command for the files touched by that task.
- **After every plan wave:** Run `npx vitest run` (full app suite) + `npm run type-check`.
- **After any task touching `firestore.rules`:** Run the rules suite. A rules change with no rules-suite
  run is an untested assertion — see the CLAUDE.md incident where a deny-everyone `storage.rules`
  shipped behind an all-deny suite.
- **Before `/gsd-verify-work`:** Full app suite green against the documented 2-file baseline
  (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), rules suite green,
  `npm run type-check` at 0 errors.
- **Max feedback latency:** 90 seconds.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. This table is seeded with the requirement-to-verification
> mapping the plans must satisfy; the planner and executor fill in concrete task IDs and commands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | R076 | — | Repeat `share` on the same service returns the same token; `serviceShareLinks/{serviceId}` is written once and its `token` never changes | unit | `npx vitest run --dir src --exclude '**/rules.test.ts' src/stores/__tests__/services.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | R076 | T-41-01 | A `{shareToken}` write is never issued against `services/{docId}` — asserted as the *absence* of a call, so the R036 draft-lock is not re-entered | unit | same as above | ✅ | ⬜ pending |
| TBD | TBD | 2 | R077 | — | After `updateService`, the shared payload reflects the new plan without a re-share | unit | same as above | ✅ | ⬜ pending |
| TBD | TBD | 2 | R077 | — | After `setRoleOverride` / `clearRoleOverride`, the shared payload reflects the new overrides | unit | same as above | ✅ | ⬜ pending |
| TBD | TBD | 2 | R077 | T-41-02 | Refresh writes **only** to `shareTokens`/`serviceShares`; asserted as no write back to `services/{docId}` (loop safety) | unit | same as above | ✅ | ⬜ pending |
| TBD | TBD | 2 | R077 | T-41-03 | PII guard intact — the snapshot carries `personNames` only, never a raw `Person` (no email / phone / pcPersonId), on **both** the create and the refresh path | unit | same as above | ✅ | ⬜ pending |
| TBD | TBD | 2 | R078 | — | Adoption picks the most recent of several pre-existing `shareTokens` docs rather than minting a new one | unit | same as above | ✅ | ⬜ pending |
| TBD | TBD | 2 | R078 | — | Adoption of a stale token refreshes its payload in place immediately | unit | same as above | ✅ | ⬜ pending |
| TBD | TBD | 3 | R077 | T-41-04 | **ALLOW case** — an org editor CAN update `shareTokens/{token}` for their own org, run against the real emulator | rules | `npm run test:rules` | ✅ | ⬜ pending |
| TBD | TBD | 3 | R077 | T-41-04 | **DENY case** — an editor of a *different* org CANNOT update that `shareTokens` doc (no cross-org overwrite; the CR-01 bug class) | rules | `npm run test:rules` | ✅ | ⬜ pending |
| TBD | TBD | 3 | R077 | T-41-05 | **DENY case** — an update that changes `orgId` is rejected (a share can never be reassigned to another org) | rules | `npm run test:rules` | ✅ | ⬜ pending |
| TBD | TBD | 3 | R076 | T-41-06 | **ALLOW + DENY** — `serviceShareLinks/{serviceId}` is readable/writable by an org editor of that org and by nobody else; **not** publicly readable | rules | `npm run test:rules` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/__tests__/services.test.ts` — extend the `firebase/firestore` mock with `where`,
      `query`, `orderBy`, `limit`, and `getDocs`. The research pass found this mock has **none** of
      them: this phase introduces the first filtered Firestore query anywhere in the codebase, so
      every R078 adoption test fails to even load without this. **This is a genuine Wave 0 blocker,
      not a nicety.**
- [ ] `src/rules.test.ts` — replace the existing assertion at `src/rules.test.ts:621-629` that
      `shareTokens` update is denied for everyone. That assertion becomes **intentionally false** this
      phase; it must be rewritten as an allow-case + deny-cases pair, never deleted and never left
      failing as a "known regression."

*Everything else: existing infrastructure covers the phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A share link circulated before this change still resolves after the rework | R078 | Requires a real pre-existing `shareTokens` document created by the old mint-fresh code path against live data; the unit test proves the adoption *logic*, not that production data matches the assumed shape | Open a share URL captured before this phase shipped; confirm it loads and shows current plan data. |
| `firestore.rules` deploy | R077 | **Owner-gated by the v1.5 standing autonomy grant — no deploys during an autonomous run** | Owner runs `firebase deploy --only firestore:rules`. Until then, the loosened update rule is inert in production and refresh writes will be rejected live. This is expected and by design. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the `where`/`getDocs` mock gap above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] Every `firestore.rules` change has a **passing ALLOW case that actually executed** against the
      emulator — not a deny-only suite, and not a read of the rules file
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
