---
phase: 70
slug: admin-console-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
---

# Phase 70 — Validation Strategy

> Per-phase validation contract. Derived from 70-RESEARCH.md §Validation Architecture + 70-UI-SPEC.md bounds table.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (root) + `@vue/test-utils` (jsdom) — same as `SettingsView.test.ts` |
| **Config** | `vite.config.ts` `test` block; no new config |
| **Quick run** | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` (+ any per-card test files) |
| **Full suite** | `npx vitest run` (excludes `rules.test.ts` + `render-service/**`) |
| **Type gate** | `npm run type-check` (vue-tsc --build — checks `.vue` + tests) |
| **Estimated runtime** | component ~5–10s |

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` (or the per-card test files).
- **After every plan wave:** `npx vitest run` (full app suite) — baseline stays the 2 known-failing files (`storage.rules.test.ts`, `RosterView.test.ts`), unrelated to this phase.
- **Before `/gsd-verify-work`:** full suite green + `npm run type-check` clean.

---

## Per-Requirement Verification Map (component tests)

| Req | Behavior | Command (`-t`) | File | Status |
|-----|----------|-----------------|------|--------|
| R186 | Effective value renders from mocked `onSnapshot` (doc-missing→default AND doc-present→merged) | `"effective value"` | ❌ W0 | ⬜ |
| R186 | `(default)` badge reflects raw-doc KEY PRESENCE, not value-equality (saving `mediaDays:30` clears it) | `"default badge"` | ❌ W0 | ⬜ |
| R186 | Global provenance stamp renders `updatedBy`/`updatedAt` when present, nothing when absent | `"provenance"` | ❌ W0 | ⬜ |
| R187 | Save disabled until valid AND dirty; click calls `setDoc` with correct dot-path key + `{merge:true}` | `"save"` | ❌ W0 | ⬜ |
| R187 | Out-of-min/max value shows inline error + blocks Save (≥1 boundary per field group, incl. upper bound) | `"validation"` | ❌ W0 | ⬜ |
| R187 | Cross-field: `rateLimitPerDay < rateLimitPerMin` blocks save with the specific message | `"cross-field"` | ❌ W0 | ⬜ |
| R187 | Save failure (rejected `setDoc`) shows the generic error line and reverts the control | `"save error"` | ❌ W0 | ⬜ |
| R191 | `fromAddress` format validation blocks Save on bad shape; valid save calls `setDoc` with trimmed address | `"sender"` | ❌ W0 | ⬜ |
| R192 | Sender form never renders any secret/API-key input/label (negative: no "RESEND_API_KEY"/"secret"/"api key") | `"no secret"` | ❌ W0 | ⬜ |
| R192 | `.web.app`/`.firebaseapp.com` address → amber "must be Resend-verified" warning; custom domain → none; warning never disables Save | `"unverifiable host"` | ❌ W0 | ⬜ |
| R186/R187 | The four cleanup toggles render `disabled`, reflect live state, no click handler (negative: clicking never calls `setDoc`) | `"cleanup read-only"` | ❌ W0 | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] `src/views/__tests__/OwnerConsoleView.test.ts` — NEW file (no existing file to extend). Reuse `SettingsView.test.ts`'s `vi.hoisted` `firebase/firestore` mock (`doc`/`setDoc`/`onSnapshot`/`serverTimestamp`) and build a trimmed `@/stores/auth` mock that ADDS `isSuperAdmin` + `user.uid`/`user.email` (SettingsView's mock lacks these).
- [ ] (If per-card components are split out) `src/components/admin/__tests__/*.test.ts`.
- [ ] Framework install: none — Vitest + `@vue/test-utils` already present.

---

## Manual-Only Verifications (deferred to `/gsd-verify-work 70`)

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| Live round-trip: real super-admin saves a field → write lands in real/emulated `appConfig/global` → reload shows persisted value | R187 | Component tests mock `firebase/firestore`; needs the emulator or a deployed env |
| A saved `retention.mediaDays` picked up by the real `cleanupMedia` cron with no redeploy | R181 (Phase 69) spot-check | The milestone's whole point; needs deployed functions |
| A saved `sender.fromAddress` on a genuinely Resend-verified domain delivers mail | R191 | Needs a live Resend account + DNS |
| `/owner-console` nav-visibility / route-guard | R177 (Phase 68) | Already a Phase 68 deferred item; not re-tested here |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (live round-trip + real-cron + real-email are manual-only, disclosed above — not silently skipped)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] `nyquist_compliant: true` set in frontmatter (by validate-phase)

**Approval:** pending
