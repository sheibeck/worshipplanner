---
phase: 72-owner-console-tabs
reviewed: 2026-08-21T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/views/OwnerConsoleView.vue
  - src/components/admin/ConfigurationTab.vue
  - src/components/admin/OrganizationsTab.vue
  - src/views/__tests__/OwnerConsoleView.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 72: Code Review Report

**Reviewed:** 2026-08-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the diff introduced by `6a7fc89c` (extraction of `ConfigurationTab.vue`/`OrganizationsTab.vue` and rewrite of `OwnerConsoleView.vue` into a query-driven tab shell) and `2e7c50fa` (test additions). This is a clean, mechanically careful refactor.

Verified against each of the four review-focus constraints:

1. **Subscription lifecycle** — Confirmed correct. `ConfigurationTab.vue` owns the `superAdmins` `onSnapshot` and `appConfigStore.subscribe()`/`unsubscribe()` pair inside a single `onMounted`/`onUnmounted`. Both panes in `OwnerConsoleView.vue` are rendered under `v-show` (never `v-if`, confirmed by direct read of the template), so `ConfigurationTab` cannot be torn down and remounted by a tab switch — the non-idempotent subscriptions fire exactly once for the life of the view. No double-subscribe or never-fires path found.
2. **Route/router safety** — `route?.query.tab` and `router?.replace(...)` are optional-chained throughout (`OwnerConsoleView.vue:69,74,83`). `normalizeTab()` (line 59-61) whitelists only `'organizations'` and defaults everything else — including `undefined`, arrays, and garbage strings — to `'configuration'`. `setTab()` (line 80-84) guards with `if (activeTab.value === tab) return` before calling `router?.replace`, matching the "no-op guard" requirement, and uses `router.replace` (never `push`). Confirmed against the established `router.replace({ query: {...route.query, ...} })` convention used in `QuarterShareView.vue:245` and `SongsView.vue:359,399` — not a novel/risky pattern.
3. **Behavior preservation** — Diffed `ConfigurationTab.vue` against the pre-refactor `OwnerConsoleView.vue` (`6a7fc89c~1`) line-by-line: the roster grant/revoke callable path (`callSetSuperAdminClaim`), the provenance stamp (`formatStamp`), and all four config-card imports/wiring are byte-identical to the prior implementation, only relocated. No accidental behavior change found.
4. **Scope** — `OrganizationsTab.vue` is a fully inert static placeholder: no imports, no script logic (`<script setup lang="ts"></script>` is empty), no store/data/callable access. No Phase 74 concern leakage.

Two minor items below — neither blocks shipping, but the Warning closes a coverage gap on the exact invariant this phase's design depends on.

## Warnings

### WR-01: No test asserts subscriptions stay single-fire across a tab switch

**File:** `src/views/__tests__/OwnerConsoleView.test.ts:274-297`
**Issue:** The phase's central correctness claim is that `ConfigurationTab`'s `superAdmins` onSnapshot and `appConfigStore.subscribe()` must fire exactly once regardless of tab switching, because `v-show` (not `v-if`) is used specifically to prevent a second subscribe on tab-return. The test suite verifies the *initial* subscribe/unsubscribe pair (`OwnerConsoleView.test.ts:153-162`) and verifies pane visibility after a tab click (`:274-288`), but no test clicks between tabs and then re-asserts `mockOnSnapshot` call counts (e.g., still `2`, not `4`) to prove the pane wasn't torn down and remounted. Today this invariant holds structurally because the template hard-codes `v-show`, but a future edit that swaps `v-show` for `v-if` (an easy, plausible one-line regression, especially since `v-if` is the more common Vue idiom) would pass every existing test in this file while silently reintroducing the double-subscribe bug this refactor was designed to prevent.
**Fix:** Add a test such as:
```ts
it('does not re-subscribe when switching tabs and back (v-show invariant)', async () => {
  const wrapper = await mountView()
  expect(mockOnSnapshot).toHaveBeenCalledTimes(2)

  const orgsButton = wrapper.findAll('button').find((b) => b.text() === 'Organizations')!
  await orgsButton.trigger('click')
  const configButton = wrapper.findAll('button').find((b) => b.text() === 'Configuration')!
  await configButton.trigger('click')

  expect(mockOnSnapshot).toHaveBeenCalledTimes(2) // still 2 — ConfigurationTab was never unmounted
})
```

## Info

### IN-01: Stale `[OwnerConsoleView]` log tags after relocation to ConfigurationTab.vue

**File:** `src/components/admin/ConfigurationTab.vue:264,279,300`
**Issue:** All three `console.error` calls carried over from the pre-refactor `OwnerConsoleView.vue` still prefix their messages with `[OwnerConsoleView]` (grant error, revoke error, roster subscription error), but this code now lives in `ConfigurationTab.vue`. This is cosmetic — it doesn't affect behavior — but it will mislead anyone grepping browser console output or log aggregation by component name during a future incident.
**Fix:** Update the three log prefixes to `[ConfigurationTab]`:
```ts
console.error('[ConfigurationTab] grant error:', err)
...
console.error('[ConfigurationTab] revoke error:', err)
...
console.error('[ConfigurationTab] roster subscription error:', err)
```

---

_Reviewed: 2026-08-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
