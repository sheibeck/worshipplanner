---
phase: 69
slug: firestore-runtime-config
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
---

# Phase 69 — Validation Strategy

> Per-phase validation contract. Derived from 69-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (functions-standalone, `functions/package.json`) |
| **Config file** | implicit default (`npm test` → `vitest run` from `functions/`) |
| **Quick run** | `cd functions && npx vitest run src/appConfig.test.ts` |
| **Full suite** | `cd functions && npm test` |
| **Build gate (REQUIRED)** | `cd functions && npm run build` (functions-standalone `tsc` — root `vue-tsc --build` does NOT cover `functions/`) |
| **Root type gate** | `npm run type-check` |
| **Estimated runtime** | functions unit ~10–20s |

---

## Sampling Rate

- **After every task commit:** `cd functions && npx vitest run src/appConfig.test.ts` (or the specific handler file touched).
- **After every plan wave:** `cd functions && npm test` AND `cd functions && npm run build`.
- **Before `/gsd-verify-work`:** functions suite green + functions build clean + root type-check clean; app-suite baseline (`storage.rules.test.ts`, `RosterView.test.ts`) unchanged (this phase is functions-only, should not touch it).

---

## Per-Requirement Verification Map

| Req | Behavior | Test | Automated Command | File | Status |
|-----|----------|------|-------------------|------|--------|
| R180 | `AppConfig` shape covers every managed knob | unit | `... appConfig.test.ts -t "shape"` | ❌ W0 | ⬜ |
| R181 | Handlers read values from `getAppConfig()`, not `process.env` | unit | `... index.test.ts -t "reads from config"` | ❌ W0 | ⬜ |
| R182-empty | Empty/missing doc → `getAppConfig()` deep-equals `DEFAULT_APP_CONFIG` | unit (invariant) | `... appConfig.test.ts -t "empty doc reproduces defaults"` | ❌ W0 | ⬜ |
| R182-partial | Partial doc → only set keys change; siblings keep defaults | unit | `... appConfig.test.ts -t "partial doc deep-merge"` | ❌ W0 | ⬜ |
| R183-cache | Two cached calls within TTL → exactly ONE Firestore read | unit | `... appConfig.test.ts -t "TTL cache hit"` | ❌ W0 | ⬜ |
| R183-fresh | `{fresh:true}` always re-reads even with a warm cache | unit | `... appConfig.test.ts -t "fresh bypasses cache"` | ❌ W0 | ⬜ |
| R183-expiry | Cache expires after TTL and re-fetches | unit | `... appConfig.test.ts -t "TTL expiry"` | ❌ W0 | ⬜ |
| R184-closed | Each fail-closed knob → restrictive default on malformed input | unit (parametrized) | `... appConfig.test.ts -t "fail closed"` | ❌ W0 | ⬜ |
| R184-open | Each fail-open-capped knob → capped default, never `0`/`Infinity` | unit (parametrized) | `... appConfig.test.ts -t "fail open capped"` | ❌ W0 | ⬜ |
| R185 | `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` still from `process.env` after the swap | unit (regression) | `... index.test.ts -t "setGlobalOptions"` | ✅ existing | ⬜ |
| R190 (preserved) | `cleanupOrphanBackgroundsHandler` fail-safe tests pass unchanged after enable-flag swap | unit (existing, converted setup) | `... index.test.ts -t "cleanupOrphanBackgroundsHandler"` | ✅ existing | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] `functions/src/appConfig.ts` — module under test (new): `AppConfig` type, `DEFAULT_APP_CONFIG`, deep-merge, `getAppConfig(db,{fresh})` TTL cache, per-knob `coerce*` guards.
- [ ] `functions/src/appConfig.test.ts` — new; owns R180/R182/R183/R184 invariants.
- [ ] `functions/src/index.test.ts` — MODIFIED (not new): convert the ~80+ env-var `beforeEach`/`afterEach` mutations to mocking the `./appConfig` module (mirror the existing `./pptxParser`/`./renderInvoker` `vi.mock` pattern). No new file.
- [ ] Framework install: none — vitest already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A live config change takes effect with no redeploy | R181 | Requires the functions DEPLOYED + a real `appConfig/global` write | After owner deploys `functions:…`, write a value to `appConfig/global` and observe a hot-path (e.g. AI rate limit) and a cron (next scheduled run) reflect it without redeploy. Deferred to `/gsd-verify-work 69`. |
| Real TTL staleness window on a hot path | R183 | Real cross-instance warm-cache timing | Observed only against deployed functions; the TTL/fresh logic is unit-proven. Deferred to `/gsd-verify-work 69`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (R181/R183 live-deploy behaviors are manual-only, disclosed above — not silently skipped)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] `nyquist_compliant: true` set in frontmatter (by validate-phase)

**Approval:** pending
