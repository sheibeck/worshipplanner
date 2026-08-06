---
phase: 39-org-settings-infrastructure-feature-toggles
reviewed: 2026-08-06T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/types/organization.ts
  - src/stores/auth.ts
  - src/utils/claudeApi.ts
  - src/views/SettingsView.vue
  - src/views/serviceEditorActionBar.ts
  - src/views/ServiceEditorView.vue
  - src/views/RosterView.vue
  - src/views/SongsView.vue
  - src/components/SongSlotPicker.vue
  - src/components/ScriptureInput.vue
  - src/components/CongregationalEditor.vue
  - src/stores/__tests__/auth.test.ts
  - src/utils/__tests__/claudeApi.test.ts
  - src/views/__tests__/SettingsView.test.ts
  - src/views/__tests__/SongsView.test.ts
  - src/views/__tests__/serviceEditorActionBar.test.ts
  - src/views/__tests__/RosterView.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/components/__tests__/ScriptureInput.test.ts
  - src/components/__tests__/CongregationalEditor.test.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: resolved
fixed_at: 2026-08-06T20:00:00Z
fix_report: 39-REVIEW-FIX.md
---

# Phase 39: Code Review Report

**Reviewed:** 2026-08-06
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found — all 4 in-scope findings (1 Critical, 3 Warning) fixed; see
[39-REVIEW-FIX.md](./39-REVIEW-FIX.md) for commit-level detail.

## Summary

The five properties called out as "what matters most" were each traced against the actual diff
(`git diff 0e7c82e..HEAD`), not just read for plausibility:

1. **3-of-7 `claudeApi.ts` gating** — verified exact. `getSongSuggestions`, `getScriptureSuggestions`,
   `splitCongregationalReading` each carry `if (!isAiEnabled()) return null` as their first statement;
   `safeParseJsonArray`, `validateSongSuggestions`, `validateScriptureSuggestions`, `validateSplitResult`
   are genuinely ungated. Confirmed by diff, not just JSDoc claims.
2. **Dot-path Firestore writes** — verified. All three new/changed `SettingsView.vue` save handlers
   (`onToggleVwMode`, `onToggleAiEnabled`, `onTogglePcEnabled`) write a single quoted leaf key
   (`{ 'settings.aiEnabled': v }` etc.), never a whole-object `settings` write. `SettingsView.test.ts`
   asserts this at the key-set level (`Object.keys(payload)).toHaveLength(1)`), which is the strong
   form of this check.
3. **`vwModeEnabled` dual-read** — **partially fails**. The standalone `authStore.vwModeEnabled` ref is
   computed with the correct three-way dual-read. However `authStore.settings.vwModeEnabled` — the
   field the phase's own type contract (`OrgSettings`) documents as the canonical value "every consumer
   downstream of the auth store" should read — is populated by a naive default-merge that never
   consults the legacy flat field. See CR-01 below; this is the single highest-value bug in the phase
   given how explicitly CONTEXT.md/CLAUDE.md flag this exact failure mode.
4. **PC credential retention** — verified. `onTogglePcEnabled` never touches `pcAppId`/`pcSecret`, never
   calls `onClearPcCredentials`/`setPcCredentials`; `SettingsView.test.ts` asserts this against every
   `updateDoc` call made during the toggle. `serviceEditorActionBar.ts` and `ServiceEditorView.vue`
   compose `pcEnabled` onto the *existing* credentials gate rather than replacing it.
5. **Test non-vacuity** — `claudeApi.test.ts`'s three `aiEnabled: ...` tests assert
   `expect(mockCreate).not.toHaveBeenCalled()` / `expect(mockParse).not.toHaveBeenCalled()` against the
   SDK-level mocks, not `fetch` — this is the correct assertion shape and would fail against a
   deliberately-broken (missing) guard. No vacuous test was found in the reviewed test files. One real
   coverage gap was found (WR-02) — not a vacuous test, but a genuinely missing one.

One Critical and three Warnings follow.

## Critical Issues

### CR-01: `authStore.settings.vwModeEnabled` skips the mandatory dual-read migration, silently disagreeing with `authStore.vwModeEnabled`

> **RESOLVED — commit `5663b90`.** `loadOrgContext` now computes the dual-read
> (`orgSettings.vwModeEnabled ?? orgData.vwModeEnabled ?? true`) exactly once
> into `resolvedVwModeEnabled` and applies that single value to both
> `settings.value.vwModeEnabled` and `vwModeEnabled.value`, so the two can no
> longer diverge. The regression test in `auth.test.ts`
> (`'keeps a flat vwModeEnabled false when there is no settings key'`) now
> asserts `store.settings.vwModeEnabled` in addition to `store.vwModeEnabled` —
> confirmed to fail against the pre-fix code (pre-fix, `DEFAULT_ORG_SETTINGS
> .vwModeEnabled` is `true`, so the added assertion would resolve to `true`
> instead of the expected `false`).

**File:** `src/stores/auth.ts:121-136`

**Issue:** `loadOrgContext` computes two different values for the same underlying setting, and only one
of them is correct for the migration case CONTEXT.md calls "the single most important test in the
phase":

```ts
const orgSettings = (orgData.settings as Partial<OrgSettings> | undefined) ?? {}
settings.value = { ...DEFAULT_ORG_SETTINGS, ...orgSettings }        // (A)

vwModeEnabled.value =
  orgSettings.vwModeEnabled ?? (orgData.vwModeEnabled as boolean | undefined) ?? true  // (B)
```

Line (A) merges `orgSettings` over `DEFAULT_ORG_SETTINGS` with a plain object spread. If the org
document has no nested `settings.vwModeEnabled` key — true of every real pre-v1.5 organization, which
is exactly the population this migration exists to protect — `orgSettings.vwModeEnabled` is `undefined`,
so the spread falls through to `DEFAULT_ORG_SETTINGS.vwModeEnabled`, which is hardcoded `true`. The
legacy flat field `orgData.vwModeEnabled` is **never consulted** by this line.

Line (B), immediately below and clearly labelled "Dual-read migration," *does* perform the correct
three-way fallback and lands on the right answer.

Net effect: for an org document shaped `{ vwModeEnabled: false }` (no `settings` key — a church that
turned Vertical Worship off before this phase shipped and has not yet saved anything in Settings since):

- `authStore.vwModeEnabled` → `false` (correct)
- `authStore.settings.vwModeEnabled` → `true` (**wrong** — silently re-enables VW in the object the
  type contract promises is authoritative)

This is provably untested: `auth.test.ts`'s `'keeps a flat vwModeEnabled false when there is no settings
key'` test (the one CLAUDE.md/CONTEXT.md single out) only asserts `store.vwModeEnabled`, never
`store.settings.vwModeEnabled` — so the suite is green while carrying exactly the bug it was written to
catch, just one field away from where the assertion is looking.

No current UI component reads `authStore.settings.vwModeEnabled` (all consumers — `SongSlotPicker.vue`,
`ServiceEditorView.vue`, `SettingsView.vue`'s own `vwModeInput` — read the standalone `vwModeEnabled`
ref), so this does not manifest as a visible bug today. But `organization.ts`'s own JSDoc states the
opposite intent explicitly: *"Components read one typed `settings` computed on the auth store, not one
ref per setting"* (39-CONTEXT.md) and *"every consumer downstream of the auth store reads
`authStore.settings.<field>`... no consumer anywhere writes its own `?? default` fallback."* The whole
point of `OrgSettings`/`settings.value` is to become the one thing future phases (44/45/46) and any
refactor read. The moment anything switches from `authStore.vwModeEnabled` to
`authStore.settings.vwModeEnabled` — which is the documented, intended direction — this silently
re-enables Vertical Worship for every church that had explicitly turned it off and hadn't yet re-saved
Settings, with no error and no log, which is precisely the regression this phase was built to prevent.

**Fix:** compute the dual-read once and use it for both:

```ts
const orgSettings = (orgData.settings as Partial<OrgSettings> | undefined) ?? {}
const resolvedVwModeEnabled =
  orgSettings.vwModeEnabled ?? (orgData.vwModeEnabled as boolean | undefined) ?? true

settings.value = { ...DEFAULT_ORG_SETTINGS, ...orgSettings, vwModeEnabled: resolvedVwModeEnabled }
vwModeEnabled.value = resolvedVwModeEnabled
```

Also strengthen the existing regression test to assert both fields:

```ts
it('keeps a flat vwModeEnabled false when there is no settings key', async () => {
  mockOrgDocPath({ name: 'Test Org', vwModeEnabled: false })
  const { useAuthStore } = await import('../auth')
  const store = useAuthStore()
  await triggerAuthStateChange(mockUser)
  expect(store.vwModeEnabled).toBe(false)
  expect(store.settings.vwModeEnabled).toBe(false) // currently fails: resolves to true
})
```

## Warnings

### WR-01: "Suggest All Songs" is a live AI entry point that is never hidden when AI is off

> **RESOLVED — commit `b9cc91e`.** `ActionBarContext` gained a required
> `aiEnabled: boolean` field, threaded from `ServiceEditorView.vue`'s
> `activeActionItems` computed as `authStore.settings.aiEnabled`, following
> the exact pattern already used for `pcEnabled`. `buildServiceOrderItems`
> now pushes `buildSuggestItem` only when `ctx.canEditService && ctx.aiEnabled`.
> Test coverage added in `serviceEditorActionBar.test.ts` (`describe('aiEnabled
> (WR-01)', ...)`) and folded into the file's cartesian gating matrix via
> `BOOLEAN_FLAG_KEYS`.

**File:** `src/views/serviceEditorActionBar.ts:84-93` (`buildSuggestItem`), wired from
`src/views/ServiceEditorView.vue:2807-2887` (`suggestAllSongs`)

**Issue:** The UI-SPEC's "Hide-Don't-Disable Contract" table enumerates exactly three AI surfaces to
hide (`SongSlotPicker.vue`'s AI Picks, `ScriptureInput.vue`'s AI block, `CongregationalEditor.vue`'s
Split-with-AI button) plus the PC credentials block. `serviceEditorActionBar.ts`'s `buildSuggestItem`
— the "Suggest All Songs" action-bar button, which loops over every SONG slot calling
`getSongSuggestions` — is not in that list and was not gated in this phase:

```ts
function buildSuggestItem(ctx: ActionBarContext): ActionBarItem {
  return {
    key: 'suggest-all-songs',
    label: ctx.aiSuggestingAll ? 'Suggesting...' : 'Suggest All Songs',
    disabled: !ctx.hasSermonContext || ctx.aiSuggestingAll,
    ...
  }
}
```

`ActionBarContext` has no `aiEnabled` field, and `buildServiceOrderItems` pushes this item purely on
`ctx.canEditService`. Because the `claudeApi.ts` guard is unconditional, no network request escapes
(R088's hard requirement — "no AI request from anywhere" — is still satisfied), but the button remains
fully visible and clickable with AI off: clicking it flips `aiSuggestingAll` to `true` (showing
"Suggesting..."), loops through every song slot calling `getSongSuggestions` (which now synchronously
resolves to `null` for each), and flips back to `false` — a silent no-op with zero user-facing
explanation, on the one AI entry point the rest of the phase explicitly hides. No test in
`ServiceEditorView.test.ts` or `serviceEditorActionBar.test.ts` exercises `aiEnabled: false` for this
item — confirmed by grep: none of the "Suggest All Songs" assertions reference `settings.aiEnabled`.

**Fix:** thread `aiEnabled` through `ActionBarContext` the same way `pcEnabled` was threaded for the
export item, and gate the push:

```ts
// ActionBarContext
aiEnabled: boolean

// buildServiceOrderItems
if (ctx.canEditService && ctx.aiEnabled) {
  items.push(buildSuggestItem(ctx))
}
```

```ts
// ServiceEditorView.vue's activeActionItems computed
aiEnabled: authStore.settings.aiEnabled,
```

### WR-02: No integration-level test for the three new `pcEnabled`-composed behaviors in `ServiceEditorView.vue`

> **RESOLVED — commit `d6d7de0`.** Added a `describe('WR-02: authStore.settings
> .pcEnabled composition', ...)` block to `ServiceEditorView.test.ts` with six
> mounted assertions (a toggle-off case and a control case for each of the
> three behaviors): `export-pc-btn` absent from the action bar when
> `pcEnabled` is false and credentialed; the credentials-missing note absent
> when `pcEnabled` is false and uncredentialed; and `onExportToPC` (invoked
> directly on the mounted vm) never opens the export dialog when `pcEnabled`
> is false. Verified against the full file run (242/242 passing) rather than a
> `-t` filtered subset, since filtering skips sibling `beforeEach`/`afterEach`
> hooks and produced an unrelated, pre-existing false failure in isolation.

**File:** `src/views/__tests__/ServiceEditorView.test.ts` (diff only adds a `settings` mock shape, no
new assertions)

**Issue:** `ServiceEditorView.vue` gained three new `pcEnabled`-dependent behaviors this phase:

1. `activeActionItems` now passes `pcEnabled: authStore.settings.pcEnabled` into
   `buildActionBarItems` (`ServiceEditorView.vue:2082`).
2. The credentials-missing hint row's `v-if` gained `&& authStore.settings.pcEnabled`
   (`ServiceEditorView.vue:201`).
3. `onExportToPC` gained a belt-and-suspenders `|| !authStore.settings.pcEnabled` early return
   (`ServiceEditorView.vue:3082-3086`).

`serviceEditorActionBar.test.ts` covers (1) correctly, but only at the pure-function level — it never
proves `ServiceEditorView.vue` actually *wires* `authStore.settings.pcEnabled` into that context object
correctly. Nothing in `ServiceEditorView.test.ts` sets `mockAuthState.settings.pcEnabled = false` and
asserts on the mounted component for any of (1), (2), or (3) — confirmed by grep: the only diff to this
test file is the `settings` mock shape added so `CongregationalEditor.vue`'s new `aiEnabled` read
doesn't throw at mount; no new `describe`/`it` block exists for `pcEnabled`. A regression that hard-coded
`pcEnabled: true` in the `activeActionItems` computed, or dropped the clause from either `v-if`, would
not be caught by any test in this file.

**Fix:** add at minimum three assertions mirroring the existing `hasPcCredentials`-driven cases already
in this file — e.g. `mockAuthState.settings.pcEnabled = false` with credentials present, and assert
`export-pc`/the credentials-missing note are both absent, and that `onExportToPC` (invoked directly or
via the button) does not open the export dialog.

### WR-03: `isAiEnabled()` guard sits outside the `try` block in all three gated `claudeApi.ts` exports

> **RESOLVED — commit `6aa474b`.** The `if (!isAiEnabled()) return null` guard
> now sits as the first statement inside each of `getSongSuggestions`,
> `getScriptureSuggestions`, and `splitCongregationalReading`'s `try` blocks.
> `grep -c "isAiEnabled" src/utils/claudeApi.ts` still returns exactly 4 (one
> definition, three call sites) — the 3-of-7 gating boundary is unchanged.
> Added a `describe('WR-03: isAiEnabled() guard never throws out of a gated
> export', ...)` block to `claudeApi.test.ts` that makes the mocked
> `useAuthStore()` throw and asserts each export resolves to `null` rather
> than rejecting — this is a genuinely new failure mode this suite did not
> previously exercise (the pre-existing `aiEnabled: false` tests never reach
> `useAuthStore()` throwing).

**File:** `src/utils/claudeApi.ts:189, 310, 537`

**Issue:** Each gated export calls the guard before entering its `try`:

```ts
export async function getSongSuggestions(...): Promise<AiSongSuggestion[] | null> {
  if (!isAiEnabled()) return null
  try {
    ...
  } catch (err) {
    console.error(...)
    return null
  }
}
```

The file's own documented contract (39-CONTEXT.md, restated in this file's JSDoc) is "returns null on
any error... never throw from service/utility functions; let callers handle null." `isAiEnabled()` calls
`useAuthStore()`, which throws if invoked with no active Pinia instance. Every current call site already
has Pinia active by the time these functions run, so this has not manifested as a live bug, but it is an
unguarded exception path in a module whose single design principle is "no throw" — if this guard is ever
reached before Pinia is initialized (a future call site, a changed mount order, a test that imports the
real store), the function rejects instead of resolving to `null`, and (per `suggestAllSongs`'s `try {
... } finally { ... }` shape in `ServiceEditorView.vue`, which has no `catch`) would surface as an
unhandled promise rejection at the call site rather than the documented `null`.

**Fix:** move the guard inside the `try`, or wrap it in its own guard:

```ts
try {
  if (!isAiEnabled()) return null
  ...
} catch (err) {
  console.error('[claudeApi] getSongSuggestions failed:', err)
  return null
}
```

---

## Resolution Summary

All 4 in-scope findings (1 Critical, 3 Warning; Info out of scope — there were none this pass) were
fixed, one atomic commit per finding, on `2026-08-06`. Full detail (files touched, verification
performed, non-fix disclosures) is in
[39-REVIEW-FIX.md](./39-REVIEW-FIX.md). Summary:

| ID | Status | Commit |
|----|--------|--------|
| CR-01 | fixed | `5663b90` |
| WR-01 | fixed | `b9cc91e` |
| WR-02 | fixed | `d6d7de0` |
| WR-03 | fixed | `6aa474b` |

Post-fix full-suite verification: `npm run type-check` clean; `npx vitest run --dir src --exclude
'**/rules.test.ts'` shows exactly the pre-existing 2-file baseline (`src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`'s stale assertion) failing — no new failures introduced.

---

_Reviewed: 2026-08-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-08-06_
_Fixer: Claude (gsd-code-fixer)_
