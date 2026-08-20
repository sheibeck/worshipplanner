---
phase: 70-admin-console-ui
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/config/appConfigDefaults.ts
  - src/stores/appConfig.ts
  - src/components/admin/ConfigNumberField.vue
  - src/components/admin/ConfigTextField.vue
  - src/components/admin/CleanupConfigCard.vue
  - src/components/admin/AiProxyConfigCard.vue
  - src/components/admin/MessagingConfigCard.vue
  - src/components/admin/SenderConfigCard.vue
  - src/views/OwnerConsoleView.vue
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 70: Code Review Report

**Reviewed:** 2026-08-20
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Owner Console config surface (store, defaults mirror, two reusable field components, four
area cards, and the wiring view). No Critical/security findings: the `setDoc(..., {merge:true})` dot-path
write pattern is correct and matches the codebase's established `updateDoc` dotted-key precedent
(`SettingsView.vue`); the cleanup toggles are genuinely non-interactive (no handler, `disabled`, no way to
flip them from this phase); the Sender card never renders or collects any secret; `isExplicitlySet` is
correctly presence-driven (not value-equality-driven), matching the documented provenance semantics.

Three Warning-level findings and three Info-level findings were found, all around validation-logic edge
cases and the defaults drift-guard's actual guarantee. None of the Warnings has a currently-reachable path
to bad data landing in Firestore (each is masked today by a coincidence of the current call sites), but
each is a real logic defect that the next consumer of this code (Phase 71's cleanup-toggle flow, or any new
admin field) could trip over without warning.

## Warnings

### WR-01: One-directional cross-field rate-limit validation — `rateLimitPerMin` can be saved above `rateLimitPerDay`

**File:** `src/components/admin/AiProxyConfigCard.vue:10-22` (vs. `23-37` and `131-136`)
**Issue:** The `rateLimitPerDay >= rateLimitPerMin` rule (UI-SPEC's one documented cross-field rule) is
wired only onto the `rateLimitPerDay` field via `externalError` / `rateLimitPerDayCrossFieldError`
(lines 131-136). The `rateLimitPerMin` `ConfigNumberField` (lines 10-22) has no `external-error` binding
at all. Concrete failure: with the defaults (`rateLimitPerMin=20`, `rateLimitPerDay=500`), an owner can
open the console and directly raise "Requests per minute" to e.g. `600` (within its own 1-1000 bounds) and
Save succeeds with no error — producing a saved config where `rateLimitPerMin (600) > rateLimitPerDay
(500)`, exactly the inconsistent state the cross-field rule exists to prevent. `functions/src/appConfig.ts`'s
`coerce*` layer does not enforce this relationship either (confirmed: `coerceAiProxy` coerces each field
independently), so nothing downstream catches it.
**Fix:** Add the mirror check to the `rateLimitPerMin` field — either bind a symmetric `external-error`
computed off `store.resolvedConfig.aiProxy.rateLimitPerDay` (using the day field's live value the same way
`rateLimitPerDayLive` is threaded today), or centralize the rule so editing either field validates against
the other's current effective/live value:
```ts
const rateLimitPerMinCrossFieldError = computed<string | null>(() => {
  if (rateLimitPerMinLive.value > store.resolvedConfig.aiProxy.rateLimitPerDay) {
    return 'Per-minute limit cannot exceed the daily limit.'
  }
  return null
})
```

### WR-02: `ConfigNumberField`'s required-check does not catch an emptied input (masked only by every current caller also setting `min`)

**File:** `src/components/admin/ConfigNumberField.vue:92-101`
**Issue:** `v-model.number` on a native `type="number"` input leaves `inputValue` as the raw string `''`
(not `NaN`) when the user backspaces the field to empty — Vue's number-modifier (`looseToNumber`) only
converts on a successful `parseFloat`; on failure it returns the original string unchanged. `ownError`'s
required check is `n === null || n === undefined || Number.isNaN(n)` (line 94), which does **not** match
the string `''`, so the required guard silently fails to fire. Every current call site happens to also set
`min` (all ≥ 1), so `'' < min` coerces to `0 < min` → `true`, and the `min` check (line 98) accidentally
catches it with a misleading message ("Must be at least 1.") instead of "This field is required." — so no
field can currently be saved empty. But this is incidental: a future required numeric field added without
a `min` (or with `min <= 0`) would let Save go through with `value=''`, writing a string into what Firestore
and the functions `coerce*` layer both expect to be a number.
**Fix:** Detect the empty-string case explicitly, independent of `min`:
```ts
const ownError = computed<string | null>(() => {
  const n = inputValue.value
  if (n === null || n === undefined || (n as unknown) === '' || Number.isNaN(n)) {
    return props.required ? 'This field is required.' : null
  }
  ...
```

### WR-03: The "drift-guard" test only checks `appConfigDefaults.ts` against its own hardcoded snapshot, not against `functions/src/appConfig.ts`

**File:** `src/config/__tests__/appConfigDefaults.test.ts:63-100` (cf. `functions/src/appConfig.ts:71-101`)
**Issue:** The comment on `appConfigDefaults.ts:10-14` and the CONTEXT/UI-SPEC both frame this test as a
"drift guard" that will "fail loudly" if the two files fall out of sync. In reality the test does not read
`functions/src/appConfig.ts` at all — it compares `DEFAULT_APP_CONFIG` (from `appConfigDefaults.ts`)
against a second, independently hand-typed literal inside the test file itself (lines 69-98). This catches
someone editing `appConfigDefaults.ts` alone without updating the test. It does **not** catch the scenario
the comment describes as the actual risk: someone changes a default in `functions/src/appConfig.ts` (e.g.
bumps `rateLimitPerDay`) and simply forgets `src/config/appConfigDefaults.ts` exists — nothing in the test
suite reads the functions source, so CI stays green while the Owner Console's `(default)` badge and
effective-value display quietly go stale.
**Fix:** Either (a) have the test import `functions/src/appConfig.ts`'s `DEFAULT_APP_CONFIG` directly (if a
test-only cross-package import is feasible in this repo's tooling, unlike the client bundle) and assert
deep-equality against it instead of a second hand-typed literal, or (b) if that import truly isn't
feasible, downgrade the comment/doc claims from "drift-guard" to what it actually is — a same-file
regression guard — so a future reader doesn't over-trust it as cross-file protection.

## Info

### IN-01: `allowedModels` comma-parsing allows duplicate entries

**File:** `src/components/admin/AiProxyConfigCard.vue:142-151`
**Issue:** `onSaveAllowedModels` splits/trims/filters empty segments but never de-duplicates, so an input
like `"claude-haiku-4-5-20251001, claude-haiku-4-5-20251001"` saves `['claude-haiku-4-5-20251001',
'claude-haiku-4-5-20251001']`. Harmless as an allow-list (functions-side checks likely use `.includes()`),
but it's stored data hygiene noise that the console itself creates.
**Fix:** `const parsed = [...new Set(rawInput.split(',').map((s) => s.trim()).filter((s) => s.length > 0))]`

### IN-02: Misleading error message when a required+integer number field is cleared

**File:** `src/components/admin/ConfigNumberField.vue:92-101`
**Issue:** Companion to WR-02 — for the fields that do have `integer: true` (all current numeric fields),
clearing the input to empty shows "Must be a whole number." (or, for non-integer fields, "Must be at least
N.") instead of the more accurate "This field is required." Save is still correctly blocked in every
current case, so this is cosmetic only.
**Fix:** Resolved automatically by the WR-02 fix (explicit empty-string check ordered before the
integer/min/max checks).

### IN-03: `ConfigTextField` can appear "dirty" on load if the stored value has incidental whitespace

**File:** `src/components/admin/ConfigTextField.vue:100`
**Issue:** `isDirty` compares `trimmed.value !== props.modelValue` — i.e., the *trimmed* local input against
the *raw, untrimmed* prop. If `resolvedConfig`'s value for a text field (e.g. `sender.fromName`) ever
carries leading/trailing whitespace — plausible from a direct Firestore console edit, a migration, or any
future write path other than this component's own `onSave` (which always emits `trimmed.value`) — the field
renders as dirty (Save enabled) the instant it mounts, before the owner has typed anything. Not a data-loss
risk (clicking Save just re-persists the same value trimmed, which is idempotent and arguably a quiet
self-heal), but it's a confusing false-dirty state.
**Fix:** Compare trimmed-to-trimmed: `const isDirty = computed(() => trimmed.value !== props.modelValue.trim())`.

---

_Reviewed: 2026-08-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
