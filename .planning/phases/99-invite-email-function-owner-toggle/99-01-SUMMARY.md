---
phase: 99-invite-email-function-owner-toggle
plan: 01
subsystem: config, owner-console
tags: [appConfig, owner-console, feature-flag, R293]
dependency-graph:
  requires: []
  provides:
    - "AppConfig.onboarding.emailsEnabled (server + client mirror)"
    - "OnboardingConfigCard.vue"
  affects:
    - functions/src/appConfig.ts
    - src/config/appConfigDefaults.ts
    - src/components/admin/ConfigurationTab.vue
tech-stack:
  added: []
  patterns:
    - "Fail-closed boolean coercion (coerceEnableFlag) for a new appConfig group"
    - "Immediate-save Owner Console checkbox card (mirrors MessagingConfigCard.vue)"
key-files:
  created:
    - src/components/admin/OnboardingConfigCard.vue
    - src/components/admin/__tests__/OnboardingConfigCard.test.ts
  modified:
    - functions/src/appConfig.ts
    - functions/src/appConfig.test.ts
    - src/config/appConfigDefaults.ts
    - src/config/__tests__/appConfigDefaults.test.ts
    - src/components/admin/ConfigurationTab.vue
decisions:
  - "onboarding.emailsEnabled defaults to false (fail-safe until the Resend domain is verified), per CONTEXT.md's flagged leaning default"
  - "No (default) provenance badge on the checkbox — mirrors MessagingConfigCard's own cron-toggle precedent (badges are only on numeric fields in that card)"
metrics:
  duration: "~25 minutes"
  completed: 2026-08-30
status: complete
---

# Phase 99 Plan 01: AppConfig onboarding.emailsEnabled + Owner Console toggle Summary

Added a global, fail-closed `onboarding.emailsEnabled` boolean to both AppConfig mirrors
(server `functions/src/appConfig.ts` and client `src/config/appConfigDefaults.ts`) and a new
Owner Console "Onboarding Emails" card that toggles it with immediate save — the config
foundation the Wave 2 Cloud Function will read.

## What Was Built

**Task 1 — AppConfig mirrors (server + client) + tests:**
- `functions/src/appConfig.ts`: added `onboarding: { emailsEnabled: boolean }` to the `AppConfig`
  interface, `DEFAULT_APP_CONFIG.onboarding = { emailsEnabled: false }`, a module-private
  `coerceOnboarding(raw)` using the existing fail-closed `coerceEnableFlag` (only literal `true`
  enables), and wired `onboarding: coerceOnboarding(p.onboarding)` into `mergeAppConfig`.
- `src/config/appConfigDefaults.ts`: mirrored all four additions byte-identically (interface
  member, `DEFAULT_APP_CONFIG.onboarding` leaf, and the client's per-group spread
  `{ ...DEFAULT_APP_CONFIG.onboarding, ...p.onboarding }` in `mergeAppConfig`).
- `functions/src/appConfig.test.ts`: extended the `DEFAULT_APP_CONFIG` shape assertion; added
  R293 fail-closed cases (`onboarding.emailsEnabled` resolves `false` for `"true"`, `1`, `null`,
  `{}`, an absent/empty `onboarding` group) and a case confirming literal `true` is honored.
- `src/config/__tests__/appConfigDefaults.test.ts`: added an explicit
  `DEFAULT_APP_CONFIG.onboarding` shape assertion (`{ emailsEnabled: false }`) alongside the
  existing cross-file drift-guard `toEqual`.

**Task 2 — OnboardingConfigCard.vue mounted in ConfigurationTab:**
- New `src/components/admin/OnboardingConfigCard.vue`: a titled card ("Onboarding Emails") with a
  description of the set-password/Google-notify behavior, a single checkbox bound to
  `store.resolvedConfig.onboarding.emailsEnabled` via a local `emailsEnabledInput` ref (seeded +
  `watch`-synced), and an `onToggleEmailsEnabled` handler that calls
  `store.saveField('onboarding.emailsEnabled', value)`, shows a transient "Saved!" line on
  success, and on failure logs `[OnboardingConfigCard] ...`, shows "Failed to save. Please try
  again.", and reverts the checkbox — mirrors `MessagingConfigCard.vue`'s cron-toggle block
  exactly.
- `src/components/admin/ConfigurationTab.vue`: imported and mounted `<OnboardingConfigCard />`
  in the Platform-configuration card list (between `MessagingConfigCard` and `SenderConfigCard`).
- New `src/components/admin/__tests__/OnboardingConfigCard.test.ts` (mirrors
  `MessagingConfigCard.test.ts`'s hoisted-mock harness): asserts the checkbox reflects live
  state (both `true` and default `false`), a successful toggle calls
  `saveField('onboarding.emailsEnabled', true)` and shows "Saved!", and a rejected save reverts
  the checkbox and shows the error line.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `cd functions && npx vitest run src/appConfig.test.ts` — 32 passed
- `npx vitest run src/config/__tests__/appConfigDefaults.test.ts` — 12 passed (drift-guard green)
- `npx vitest run src/components/admin/__tests__/OnboardingConfigCard.test.ts src/components/admin/__tests__/ConfigurationTab.test.ts` — 7 passed
- `npm run type-check` (vue-tsc --build) — clean, no new errors, twice (after Task 1 and after Task 2)
- Wave-merge gate: bare `npx vitest run` — 172/173 files passed, 4695 tests passed, 26 skipped; the
  single failing file is the documented `src/storage.rules.test.ts` baseline (Storage emulator
  `ECONNREFUSED 127.0.0.1:8080` — no emulator running locally), exactly matching CLAUDE.md's
  documented baseline. No regression introduced.

## Known Stubs

None.

## Threat Flags

None — this plan's threat model (T-99-07, T-99-08) covers exactly the surface touched:
`store.saveField` reuses the existing rules-gated super-admin write path with no new write
surface, and `coerceOnboarding` uses the existing fail-closed `coerceEnableFlag` so a corrupt
doc can never silently turn emails ON.

## Self-Check: PASSED

- FOUND: src/components/admin/OnboardingConfigCard.vue
- FOUND: src/components/admin/__tests__/OnboardingConfigCard.test.ts
- FOUND: .planning/phases/99-invite-email-function-owner-toggle/99-01-SUMMARY.md
- FOUND commit: 1b6f590b (Task 1)
- FOUND commit: c08c4384 (Task 2)
