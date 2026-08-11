---
phase: 41
slug: sharing-correctness
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| **Measured runtime** | ~10s targeted · ~178s full app suite · ~16s rules suite |

> ⚠ **Command discipline, from CLAUDE.md — do not deviate.** `npx vitest run src/` picks up
> `render-service/src/render.test.ts` by substring match and dies on a Vitest version mismatch.
> `npx vitest run --dir src` bypasses `vite.config.ts`'s relative exclude and runs `src/rules.test.ts`
> without an emulator. Use **`npx vitest run --dir src --exclude '**/rules.test.ts'`** or bare
> `npx vitest run`.
>
> ⚠ **`src/rules.test.ts` is EXCLUDED from the default `npx vitest run`.** A clean app-suite run
> proves *nothing* about Firestore rules. Rules changes must be proven by the rules suite, separately.
>
> ⚠ **Type-check gate is `npm run type-check`** (`vue-tsc --build`), never `-p tsconfig.app.json`.

---

## Sampling Rate

- **After every task commit:** targeted quick command for the files touched.
- **After every plan wave:** `npx vitest run` + `npm run type-check`.
- **After any task touching `firestore.rules`:** the rules suite. A rules change with no rules-suite run
  is an untested assertion.
- **Before `/gsd-verify-work`:** full app suite green against the documented baseline, rules suite green,
  `npm run type-check` at 0 errors.
- **Max feedback latency:** 180 seconds (measured).

---

## Per-Task Verification Map

All 12 seeded rows resolved to real, named, passing tests. Line numbers are as of commit `6bf8de6`.

| Requirement | Threat Ref | Secure Behavior | Test Type | Evidence | Status |
|-------------|------------|-----------------|-----------|----------|--------|
| R076 | — | Repeat share returns the same token and mints nothing (idempotency edge) | unit | `services.test.ts:967` — *"repeat share returns the same token and mints nothing (R076 idempotency edge)"*. **Asserts call counts, not string equality** — the `crypto.getRandomValues` stub is deterministic, so a string comparison would be vacuous | ✅ green |
| R076 | — | First share on a virgin service mints exactly one token and records it once | unit | `services.test.ts:943` | ✅ green |
| R076 | T-41-01 | No write is ever issued against `services/{docId}` from a share path | unit | `services.test.ts:1093` — asserted as an **absence** | ✅ green |
| R076 | T-41-11 | Concurrent first-shares converge on a single token (**the `backstop` must-have**) | unit | `services.test.ts:1134` — *"concurrent first-share convergence: a link created mid-flight wins over the local mint (backstop)"*. Implemented via `runTransaction` with an in-transaction re-read, so this **resolves rather than abstaining** to `human_needed` | ✅ green |
| R077 | — | Refresh reflects the current plan after `updateService` | unit | `services.test.ts` refresh block | ✅ green |
| R077 | — | Refresh reflects current role overrides after `setRoleOverride`/`clearRoleOverride` | unit | `services.test.ts:1391` (+ role-override refresh cases) | ✅ green |
| R077 | T-41-02 | Refresh writes **only** `shareTokens`/`serviceShares`; **no** write-back to `services/{docId}` | unit | `services.test.ts:1230` — *"the only services write is the user's own save — no write-back — while the two forward share writes DO happen"*. Absence + presence in one assertion | ✅ green |
| R077 | T-41-03 | PII guard on the **create** path — `personNames` only | unit | `services.test.ts:880`, `:1114` | ✅ green |
| R077 | T-41-03 | PII guard on the **refresh** path — ROADMAP criterion 5's other half | unit | `services.test.ts:1256` | ✅ green |
| R077 | T-41-12 | An ordinary edit never publishes a never-shared service | unit | `services.test.ts:1351` — *"an ordinary edit never creates a share link — the transaction set spy is never called"* | ✅ green |
| R077 | T-41-13 | Transient refresh failure retries; only `permission-denied` disables for the session | unit | `services.test.ts:1421`, `:1454` (both directions) | ✅ green |
| R078 | — | Adoption picks the most recent of several pre-existing tokens, mints none | unit | `services.test.ts:993` | ✅ green |
| R078 | — | Adoption over exactly one adopts it; over zero mints exactly one (empty edge) | unit | `services.test.ts:1020` | ✅ green |
| R078 | T-41-07 | `pickAdoptableToken` org-filters **before** sorting, incl. the newer-foreign-org case | unit | `shareTokens.test.ts` org-filter cases | ✅ green |
| R078 | — | The adoption query is equality-only — **no composite index required** | unit | `services.test.ts:1075` — *"the adoption query is equality-only (no composite index)"* | ✅ green |
| R077 | T-41-04 | **ALLOW** — an org editor CAN refresh a `shareTokens` doc in place | **rules (emulator)** | `rules.test.ts:698` — *"ALLOW (ROADMAP criterion 3) — an editor of the owning org can refresh a shareTokens doc in place"* | ✅ green |
| R077 | T-41-04 | **DENY** — cross-org update, no-membership update, unauthenticated update | rules | `rules.test.ts:712`, `:726`, `:752` | ✅ green |
| R077 | T-41-05 | **DENY** — `orgId` reassignment rejected on both collections | rules | `rules.test.ts:739`, `:914` | ✅ green |
| R077 | T-41-08 | **DENY** — a viewer-role member cannot update a `shareTokens` doc | rules | `rules.test.ts:765` | ✅ green |
| R076 | T-41-06 | `serviceShareLinks` ALLOW for owning-org editor; DENY for public, foreign org, viewer | rules | `rules.test.ts:782`, `:806`, `:813`, `:825` | ✅ green |
| R076 | T-41-09 | **ALLOW, load-bearing** — reading a NEVER-SEEDED link doc yields a clean not-found, not `PERMISSION_DENIED` | rules | `rules.test.ts:798` | ✅ green |
| R076 | **T-41-14** | **ALLOW + 3 DENY** — `shareTokens` create is org-editor-scoped (the CR-01 fix) | rules | `rules.test.ts:606`, `:619`, `:632`, `:644`, `:657` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/stores/__tests__/services.test.ts` — `firebase/firestore` mock extended with `where`,
      `getDocs`, `limit`, and `runTransaction`. This was a genuine blocker: Phase 41 introduced the
      first filtered Firestore query in the codebase, and every R078 adoption test failed to *load*
      until it landed. Done standalone in plan 41-03 Task 1 (`812de86`).
- [x] `src/rules.test.ts` — the stale assertion that `shareTokens` update is denied for everyone was
      **replaced** (not deleted, never left red) with allow + deny cases. Done in plan 41-01
      (`873a4c5`).

---

## Manual-Only Verifications

These are manual by nature, not by omission — neither can be made automated without changing what is
being tested.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A share link circulated **before** this change still resolves | R078 | Requires a real pre-existing `shareTokens` document created by the old mint-fresh code path against live production data. The unit tests prove the adoption *logic*; they cannot prove production data matches the assumed shape | Open a share URL captured before this phase shipped; confirm it loads and shows current plan data. **Do this after the rules deploy, not before** |
| `firestore.rules` deploy | R077, R076 | **Owner-gated by the v1.5 standing autonomy grant — no deploys during an autonomous run** | Owner runs `firebase deploy --only firestore:rules`. Until then every rules-level mitigation in this phase is **inert in production** and refresh writes will be rejected live. Expected and by design. See `.planning/PENDING-VERIFICATION.md` |

---

## Validation Audit 2026-08-07

| Metric | Count |
|--------|-------|
| Requirements in scope | 3 (R076, R077, R078) |
| Gaps found | 0 |
| Resolved | 0 (none needed) |
| Escalated to manual-only | 2 (both inherently manual — see above) |
| Probe edges covered | 9/9 (8 `truths` + 1 `backstop`, which **resolved** rather than abstaining) |

**Evidence, re-run independently at audit time rather than taken from the summaries:**
- `npx vitest run --config vitest.rules.config.ts` → **133/133 passing** (120 `rules.test.ts` + 13 `storage.rules.test.ts`)
- `npx vitest run` → **2733 passed**, 13 failed across 3 pre-existing baseline files
  (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`, `render-service/src/render.test.ts`)
  — none touched by this phase
- `npm run type-check` → **0 errors**

---

## Sign-Off

- [x] All tasks have automated verification or a documented manual-only entry
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the `where`/`getDocs` mock gap — closed)
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] Every `firestore.rules` change has a **passing ALLOW case that actually executed** against the
      emulator — not a deny-only suite, and not a read of the rules file
- [x] Token-stability assertions verified **non-vacuous** (call counts, not string equality against a
      deterministic `crypto.getRandomValues` stub)
- [x] Loop safety asserted as an **absence**, not merely as the presence of the forward writes
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-07
