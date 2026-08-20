---
phase: 70-admin-console-ui
plan: 02
subsystem: ui
tags: [vue, pinia, firebase, firestore, admin-console, config]

requires:
  - phase: 70-admin-console-ui (Plan 01)
    provides: appConfigDefaults.ts (AppConfig/mergeAppConfig/isExplicitlySet), appConfig Pinia store (onSnapshot + setDoc-merge saveField), ConfigNumberField/ConfigTextField reusable admin form components
provides:
  - Four config cards (CleanupConfigCard, AiProxyConfigCard, MessagingConfigCard, SenderConfigCard) composing Plan 01's store + field components
  - OwnerConsoleView.vue's "Platform configuration" section (replaces the Phase 68 placeholder) with the four cards, single global provenance stamp, and read-only deploy-time note
  - Additive update:modelValue emit on ConfigNumberField/ConfigTextField enabling live cross-field/format validation in a parent card
affects: [71-cleanup-dry-run-flow]

tech-stack:
  added: []
  patterns:
    - "Per-field save-state Record<string, {saving,saved,error}> with a stateFor() non-null-assertion helper (noUncheckedIndexedAccess-safe), replacing SettingsView.vue's one-ref-per-field convention for cards with several fields"
    - "Live cross-field/format validation via a field component's update:modelValue emit, decoupled from the modelValue prop (which stays the saved/effective value for the field's own dirty-check)"
    - "Card-level test harness mocking @/stores/appConfig directly (getters forwarding to a vi.hoisted module-scope object) instead of mocking firebase/firestore, for fast per-card unit tests"

key-files:
  created:
    - src/components/admin/CleanupConfigCard.vue
    - src/components/admin/AiProxyConfigCard.vue
    - src/components/admin/MessagingConfigCard.vue
    - src/components/admin/SenderConfigCard.vue
    - src/components/admin/__tests__/CleanupConfigCard.test.ts
    - src/components/admin/__tests__/AiProxyConfigCard.test.ts
    - src/components/admin/__tests__/MessagingConfigCard.test.ts
    - src/components/admin/__tests__/SenderConfigCard.test.ts
    - src/views/__tests__/OwnerConsoleView.test.ts
  modified:
    - src/views/OwnerConsoleView.vue
    - src/components/admin/ConfigNumberField.vue
    - src/components/admin/ConfigTextField.vue
    - src/components/admin/__tests__/ConfigNumberField.test.ts
    - src/components/admin/__tests__/ConfigTextField.test.ts

key-decisions:
  - "Added an additive update:modelValue emit to ConfigNumberField.vue/ConfigTextField.vue (Rule 2 — missing critical functionality), not in the plan's files_modified list. The AI Proxy cross-field rule and the Sender format/unverifiable-host warning both need the LIVE edited value, not just the last-saved effective value passed via modelValue — without it, a user could type an invalid rateLimitPerDay/fromAddress and see no error until after a page reload. The emit never feeds back into modelValue, so every existing dirty-check/re-sync consumer (Plan 01's own tests) is unaffected — verified by re-running ConfigNumberField.test.ts/ConfigTextField.test.ts unchanged plus one new test each for the emit."
  - "AiProxyConfigCard's rateLimitPerDay cross-field error is computed from a local rateLimitPerDayLive ref fed by the new update:modelValue emit and compared against store.resolvedConfig.aiProxy.rateLimitPerMin (the current effective per-minute limit) — reacts to what the owner is typing right now, matching RESEARCH Pitfall 4's intent rather than only validating the last-saved pair."
  - "SenderConfigCard duplicates OwnerConsoleView.vue's isValidEmailFormat (3-line body) rather than importing it, since that function is not exported from OwnerConsoleView.vue and Task 2 (Sender card) executes before Task 3 (view wiring) in this plan's own task order. Comment cross-references the original, per UI-SPEC decision #5 (do NOT introduce a stricter regex)."
  - "Per-card field save-state uses a Record<string, {saving,saved,error}> plus a stateFor(path) helper (returns fieldStates[path]!) instead of one ref-triad per field (SettingsView.vue's convention) — this repo's tsconfig has noUncheckedIndexedAccess enabled, and a card with 2-5 fields would otherwise need 6-15 separate refs; centralizing the one non-null assertion in stateFor() kept each card's script readable."

patterns-established:
  - "Card composes ConfigNumberField/ConfigTextField with :model-value from store.resolvedConfig and :is-default from !isExplicitlySet(store.rawDoc, path), and an onSave*(path, value) handler wrapping store.saveField in the shared saving/saved/error triad"
  - "Cross-field/format validation lives in the PARENT card (computed over a live shadow ref), never inside the shared field components, keeping ConfigNumberField/ConfigTextField generic"

requirements-completed: [R186, R187, R191, R192]

coverage:
  - id: D1
    description: "Cleanup card renders four disabled cleanup.*Enabled toggles reflecting live state, with no click handler that ever calls saveField, plus five editable retention/delete-cap numbers with min/max/required validation"
    requirement: R186
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupConfigCard.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "AI Proxy card validates rateLimitPerMin/rateLimitPerDay/maxTokensCeiling bounds, enforces the rateLimitPerDay >= rateLimitPerMin cross-field rule with the exact message, and saves allowedModels as a cleaned non-empty string[] parsed from one comma-separated text field"
    requirement: R187
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/AiProxyConfigCard.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Messaging card's scheduledCronEnabled toggle saves immediately on change and reverts on a rejected save; maxRecipients/orgDailyEmailQuota validate their bounds and save via the dot-path key"
    requirement: R187
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/MessagingConfigCard.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Sender card renders exactly two inputs (fromName, fromAddress) with no secret/API-key field anywhere, format-validates fromAddress, saves the trimmed address, and shows the non-blocking amber .web.app/.firebaseapp.com warning without disabling Save"
    requirement: R192
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/SenderConfigCard.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "OwnerConsoleView subscribes/unsubscribes the appConfig store alongside the untouched roster subscription, renders the four cards + single global provenance line (present/absent) + deploy-time note in place of the Phase 68 placeholder, and shows correct effective values for doc-missing (defaults+badge) and doc-present (merged, no badge) snapshots"
    requirement: R186
    verification:
      - kind: unit
        ref: "src/views/__tests__/OwnerConsoleView.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live Firestore round-trip (a real super-admin save landing in appConfig/global and surviving reload), real-cron pickup of a saved retention value, and real-email delivery from a saved fromAddress on a genuinely Resend-verified domain"
    requirement: R187
    verification: []
    human_judgment: true
    rationale: "Component tests mock firebase/firestore entirely (per 70-VALIDATION.md's Manual-Only Verifications table); these require a live/emulated Firestore, deployed Cloud Functions, and a real Resend account with DNS access. Deferred to /gsd-verify-work 70, not silently skipped."

duration: 55min
completed: 2026-08-20
status: complete
---

# Phase 70 Plan 02: Owner Console config panels Summary

**Four Tailwind config cards (Cleanup/AI Proxy/Messaging/Sender) wired into OwnerConsoleView.vue with a single global provenance stamp, composing Plan 01's appConfig store + ConfigNumberField/ConfigTextField — the human-usable surface for R186/R187/R191/R192.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-20T16:20:00-04:00 (approx, first read)
- **Completed:** 2026-08-20T17:15:00-04:00 (approx)
- **Tasks:** 3
- **Files modified:** 14 (9 created, 5 modified)

## Accomplishments
- `CleanupConfigCard.vue` renders the four `cleanup.*Enabled` flags as a visually distinct, always-`disabled` sub-block with no `@change`/`@click` handler (the Phase 71 scope fence), plus five editable retention/delete-cap numbers.
- `AiProxyConfigCard.vue` implements the one cross-field rule in the whole bounds table (`rateLimitPerDay >= rateLimitPerMin`, exact inline message) reactively against what the owner is currently typing, and parses `allowedModels` from one comma-separated text field into a cleaned, non-empty `string[]` before saving — never the raw string.
- `MessagingConfigCard.vue` mirrors `SettingsView.vue`'s immediate-save toggle pattern exactly for `messaging.scheduledCronEnabled` (save-on-change, revert-on-failure, no Save button) alongside two editable numbers.
- `SenderConfigCard.vue` renders exactly two inputs with no secret/credential field anywhere by construction, reuses `OwnerConsoleView.vue`'s lax `isValidEmailFormat`, and shows the non-blocking amber Resend-unverifiable-host warning for `*.web.app`/`*.firebaseapp.com` addresses.
- `OwnerConsoleView.vue`'s Phase 68 placeholder is replaced with the four cards + a single global "Last changed by X at Y" provenance line (renders nothing when absent) + a read-only deploy-time settings note; the roster card and its subscription are untouched.
- `ConfigNumberField.vue`/`ConfigTextField.vue` (Plan 01) gained an additive `update:modelValue` emit so a parent card can validate the LIVE edited value, not just the last-saved one — required for the cross-field and format/warning checks to be correct, not just testable.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cleanup + AI Proxy config cards** (incl. the ConfigNumberField/ConfigTextField `update:modelValue` addition) - `7d23d6f6` (feat)
2. **Task 2: Messaging + Sender config cards** - `a3e3420c` (feat)
3. **Task 3: Wire OwnerConsoleView + fresh view test** - `2a69a243` (feat)

**Plan metadata:** (this commit) `docs(70-02): complete Owner Console config panels plan`

## Files Created/Modified
- `src/components/admin/CleanupConfigCard.vue` - four read-only cleanup toggles + five editable retention/delete-cap numbers
- `src/components/admin/AiProxyConfigCard.vue` - rate-limit/model/token-ceiling fields, cross-field rule, allowedModels parse-on-save
- `src/components/admin/MessagingConfigCard.vue` - immediate-save cron toggle + two editable numbers
- `src/components/admin/SenderConfigCard.vue` - fromName/fromAddress, no secret field, format + unverifiable-host warning
- `src/components/admin/__tests__/CleanupConfigCard.test.ts` - read-only/validation/save/default-badge coverage
- `src/components/admin/__tests__/AiProxyConfigCard.test.ts` - validation/cross-field/allowed-models/default-badge coverage
- `src/components/admin/__tests__/MessagingConfigCard.test.ts` - immediate-save/revert-on-error/validation/save coverage
- `src/components/admin/__tests__/SenderConfigCard.test.ts` - no-secret/sender/unverifiable-host coverage
- `src/views/OwnerConsoleView.vue` - "Platform configuration" section replacing the Phase 68 placeholder; appConfig store subscribe/unsubscribe; formatStamp helper
- `src/views/__tests__/OwnerConsoleView.test.ts` - fresh file; subscribe/unsubscribe, effective-value, provenance, roster-regression coverage
- `src/components/admin/ConfigNumberField.vue` - additive `update:modelValue` emit
- `src/components/admin/ConfigTextField.vue` - additive `update:modelValue` emit
- `src/components/admin/__tests__/ConfigNumberField.test.ts` - added one test for the new emit
- `src/components/admin/__tests__/ConfigTextField.test.ts` - added one test for the new emit

## Decisions Made
- **Live-value cross-field/format validation over static comparison:** basing `AiProxyConfigCard`'s cross-field check and `SenderConfigCard`'s format/warning checks on the field's live-edited value (via the new emit) rather than the last-saved `resolvedConfig` value, because the latter would let an owner type and save an actually-invalid value as long as the *previously saved* pair happened to be consistent.
- **`stateFor(path)` helper over per-field refs:** this repo's `tsconfig` has `noUncheckedIndexedAccess` enabled, so a `Record<string, FieldSaveState>` indexed by a known-present literal key still types as `T | undefined`. Centralizing one non-null assertion in a `stateFor()` helper (used identically across all four cards) kept the cards readable versus either declaring 2-5 separate ref triads per card or sprinkling `!` at every template binding.
- **`SenderConfigCard` duplicates, not imports, `isValidEmailFormat`:** `OwnerConsoleView.vue` doesn't export the function, and this plan's own task order builds the Sender card (Task 2) before wiring the view (Task 3). A 3-line duplicate with a cross-reference comment matches the plan's own precedent (`appConfigDefaults.ts` duplicates `functions/src/appConfig.ts`'s defaults for the same class of reason — no cross-boundary import available at the time it's needed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added `update:modelValue` emit to ConfigNumberField.vue/ConfigTextField.vue**
- **Found during:** Task 1 (AI Proxy card's cross-field rule)
- **Issue:** The plan's cross-field/warning validation (AI Proxy's `rateLimitPerDay >= rateLimitPerMin`, Sender's format/unverifiable-host checks) needs the field's LIVE edited value to be correct. Neither `ConfigNumberField.vue` nor `ConfigTextField.vue` (shipped in Plan 01) exposed that — only a static `modelValue` prop (the last-SAVED effective value) and a `save` event fired on click. Without a live-value channel, a user could type an invalid `rateLimitPerDay` and see no cross-field error until after Save (never, since Save itself would be silently wrong) or a page reload — the validation would be cosmetic, not real.
- **Fix:** Added an additive `update:modelValue` emit to both field components, fired whenever the local `inputValue` changes. Deliberately does NOT feed back into the `modelValue` prop itself (which both cards still bind to the store's saved/effective value), so the existing dirty-check/re-sync behavior every Plan 01 test exercises is unchanged.
- **Files modified:** `src/components/admin/ConfigNumberField.vue`, `src/components/admin/ConfigTextField.vue`
- **Verification:** Re-ran `ConfigNumberField.test.ts`/`ConfigTextField.test.ts` (Plan 01's existing 21 tests, unchanged, all still pass) plus one new test per file asserting the emit fires with the live value. Full app suite stayed at the 2-file baseline; `npm run type-check` clean.
- **Committed in:** `7d23d6f6` (Task 1 commit — folded in since AiProxyConfigCard directly depends on it)

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** Necessary for the cross-field (R187) and unverifiable-host warning (R192) validation to be functionally correct, not merely present. Purely additive to two Plan 01 files not listed in this plan's `files_modified` — no existing behavior changed, confirmed by Plan 01's own test suite passing unchanged plus new coverage for the addition.

## Issues Encountered
None beyond the emit addition documented above. `noUncheckedIndexedAccess` (`npm run type-check`) initially flagged every `fieldStates[path]` access across all four cards — resolved uniformly via the `stateFor()` helper pattern described in Decisions Made, no functional change.

## User Setup Required
None - no external service configuration required. Client-only, no deploys (per the v1.9 deploy discipline grant).

## Next Phase Readiness
- Phase 70's client-only scope (R186/R187/R191/R192) is now fully implemented and unit-tested. The four cards, provenance stamp, and deploy-time note give a super-admin a working view into and edit surface over `appConfig/global`.
- **Manual UAT deferred to `/gsd-verify-work 70`** (per 70-VALIDATION.md, not silently skipped — see coverage D6):
  - Live round-trip: a real super-admin save landing in a real/emulated `appConfig/global` doc and surviving a reload.
  - A saved `retention.mediaDays` picked up by the real `cleanupMedia` cron with no redeploy (R181, Phase 69 spot-check).
  - A saved `sender.fromAddress` on a genuinely Resend-verified custom domain actually delivering mail (R191).
  - `/owner-console` nav-visibility / route-guard (R177, already a Phase 68 deferred item, not re-tested here).
- Phase 71 (R188-R190) will build the dry-run blast-radius preview + confirm-to-flip UI that makes the four `cleanup.*Enabled` toggles editable — this plan's read-only rendering (no click handler at all) is the exact scope fence Phase 71 needs to build against.
- No blockers.

---
*Phase: 70-admin-console-ui*
*Completed: 2026-08-20*

## Self-Check: PASSED

All 13 created/modified source and test files, plus this SUMMARY, were confirmed present on disk; all 3 task commits (`7d23d6f6`, `a3e3420c`, `2a69a243`) were confirmed present in git history.
