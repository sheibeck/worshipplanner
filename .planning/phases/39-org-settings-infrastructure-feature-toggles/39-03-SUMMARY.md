---
phase: 39-org-settings-infrastructure-feature-toggles
plan: 03
subsystem: ui
tags: [vue, firestore, settings, feature-flags, org-settings]

# Dependency graph
requires:
  - phase: 39-02
    provides: "authStore.settings (OrgSettings), DEFAULT_ORG_SETTINGS, vwModeEnabled dual-read"
provides:
  - "SettingsView.vue AI Features section (explanation-before-switch, all three AI features named)"
  - "SettingsView.vue Planning Center enable toggle inside the existing PC Integration section"
  - "Three concurrency-safe dot-path save handlers: onToggleAiEnabled, onTogglePcEnabled, onToggleVwMode (relocated write target)"
  - "SettingsView.test.ts extended with R073 payload-shape and R089 credential-retention coverage"
affects: [39-04, 39-05, 39-06, 44, 45, 46]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Firestore dot-path leaf-key writes for settings.* fields (updateDoc(ref, { 'settings.<key>': value }), never a whole-map write) — precedent: src/stores/services.ts:325-332 setRoleOverride"
    - "Display-only v-if wrapper around pre-existing markup as the sole mechanism for a feature-off UI state, with no handler/write coupling"

key-files:
  created: []
  modified:
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts

key-decisions:
  - "onToggleVwMode's Firestore write target moved from the flat vwModeEnabled field to the nested settings.vwModeEnabled dot-path — this IS the lazy backfill (R073); authStore.vwModeEnabled = newValue (the store-facing API) was left untouched"
  - "The PC credentials block's v-if=\"pcEnabledInput\" wrapper is strictly a display condition — it is not wired to onClearPcCredentials, setPcCredentials, or any Firestore write; onTogglePcEnabled writes only the settings.pcEnabled leaf key"
  - "Checkbox selection in tests uses DOM order (findAll('input[type=\"checkbox\"]')[N]) rather than data-testid, since the markup has none and adding one was out of this task's scope; order is documented as PC=0, VW=1, AI=2 matching the template's section order"
  - "Added setters alongside the Wave 0 mock's getter-only settings/vwModeEnabled accessors — the component's mirror-write (authStore.settings.aiEnabled = newValue) throws a TypeError against a getter-only accessor in strict-mode ESM, a case Wave 0 never exercised because no test triggered a toggle handler"

patterns-established:
  - "Pattern: three-toggle save handler shape (early-return on !orgId/!isEditor, clear error ref, dot-path updateDoc, mirror-assign to store, 2s saved-feedback timeout, catch reverts checkbox + shared failure string) — byte-for-byte copy across onToggleVwMode/onToggleAiEnabled/onTogglePcEnabled"

requirements-completed: [R073, R088, R089]

coverage:
  - id: D1
    description: "Toggling AI features off/on in Settings writes a single dot-path leaf key (settings.aiEnabled) and mirrors the value onto authStore.settings.aiEnabled"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView dot-path writes (R073) — Wave 2 (39-03) > writes a dot-path leaf key when the AI toggle changes"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView dot-path writes (R073) — Wave 2 (39-03) > mirrors the saved value onto the store for all three toggles"
        status: pass
    human_judgment: false
  - id: D2
    description: "Toggling Planning Center integration off/on in Settings writes a single dot-path leaf key (settings.pcEnabled) and mirrors the value onto authStore.settings.pcEnabled"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView dot-path writes (R073) — Wave 2 (39-03) > writes a dot-path leaf key when the PC toggle changes"
        status: pass
    human_judgment: false
  - id: D3
    description: "onToggleVwMode's write target relocated to the nested settings.vwModeEnabled leaf path (the lazy backfill), never the flat field, while the store-facing API (authStore.vwModeEnabled) stays unchanged"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView dot-path writes (R073) — Wave 2 (39-03) > writes the nested leaf path when the Vertical Worship toggle changes (lazy backfill)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The AI Features section explains all three AI features (song suggestions, scripture discovery, congregational reading split) before offering the off switch, using 39-UI-SPEC.md's Copywriting Contract verbatim"
    requirement: "R088"
    verification:
      - kind: unit
        ref: "src/views/SettingsView.vue — AI Features section source (grep-verified: AI Features|Song suggestions|Scripture discovery|Congregational reading split, count 7)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Turning Planning Center off never invokes the clear-credentials path or setPcCredentials, and no updateDoc payload names pcAppId/pcSecret — stored credentials are retained, not cleared"
    requirement: "R089"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView Planning Center credential retention (R089) — Wave 2 (39-03) > never clears Planning Center credentials when the integration is turned off"
        status: pass
    human_judgment: false
  - id: D6
    description: "The credentials display/edit block hides when Planning Center is off and reappears identically when turned back on; the section heading and toggle itself always render"
    requirement: "R089"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView Planning Center credential retention (R089) — Wave 2 (39-03) > hides the credentials block when the integration is off and shows it again when on"
        status: pass
    human_judgment: false
  - id: D7
    description: "A rejected write reverts the checkbox to its prior value and surfaces the shared 'Failed to save. Please try again.' failure string"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView dot-path writes (R073) — Wave 2 (39-03) > reverts the checkbox and surfaces the shared failure string when the write rejects"
        status: pass
    human_judgment: false
  - id: D8
    description: "Credential retention survives a REAL off -> reload -> on cycle against live Firestore (jsdom cannot prove this — the durable half of R089's guarantee)"
    verification: []
    human_judgment: true
    rationale: "Backstop must_have (39-03-PLAN.md). A unit test proves the handler never issues a clear/credential-touching call; only a real Firestore round-trip plus a page reload proves the value actually survives. Deferred to PENDING-VERIFICATION.md item 39.03-1 per the v1.5 standing autonomy grant."
  - id: D9
    description: "AI feature list does not wrap past two lines at a standard desktop viewport"
    verification: []
    human_judgment: true
    rationale: "Backstop must_have (39-03-PLAN.md). Visual line-wrap judgment cannot be asserted by jsdom. Deferred to PENDING-VERIFICATION.md item 39.03-2."
  - id: D10
    description: "Defaults render correctly (both checkboxes checked, both feature sets visible) against a genuinely pre-v1.5 organization document, not just a fixture"
    verification: []
    human_judgment: true
    rationale: "Carried forward from 39-02-SUMMARY.md's D7 — the Settings screen the defaults-merge point feeds did not exist until this plan shipped. Deferred to PENDING-VERIFICATION.md item 39.03-3."

# Metrics
duration: ~20min
completed: 2026-08-06
status: complete
---

# Phase 39 Plan 03: Feature Toggle Settings UI Summary

**Two new Settings toggles (AI Features, Planning Center enable) and a relocated `vwModeEnabled` write target, all three now writing concurrency-safe Firestore dot-path leaf keys instead of flat or whole-map fields.**

## Performance

- **Duration:** ~20 min
- **Started:** ~2026-08-06T15:20-04:00
- **Completed:** 2026-08-06T15:39:00-04:00
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Two new ref trios (`aiEnabledInput`/`aiSavedFeedback`/`aiSaveError`, `pcEnabledInput`/`pcEnabledSavedFeedback`/`pcEnabledSaveError`) added beside the existing `vwModeInput` trio, initialized from `authStore.settings` and kept in sync via new watchers
- `onToggleAiEnabled` and `onTogglePcEnabled` added as byte-for-byte structural copies of `onToggleVwMode` — same editor/org guard, same try/catch/revert shape, same shared `'Failed to save. Please try again.'` failure string — writing `{ 'settings.aiEnabled': v }` / `{ 'settings.pcEnabled': v }` dot-path leaf keys
- `onToggleVwMode`'s Firestore write target relocated from the flat `vwModeEnabled` field to the nested `settings.vwModeEnabled` leaf path — completes the lazy backfill 39-CONTEXT.md specifies; `authStore.vwModeEnabled = newValue` (the store-facing API) is unchanged
- New "AI Features" card added last on the page: heading → explanatory intro → three named features (song suggestions, scripture discovery, congregational reading split) → toggle → helper text, in that order — the deliberate mirror of the Vertical Worship section's own order, per the owner's requirement that a church sees what it's giving up before reaching the switch
- New "Enable Planning Center integration" toggle added at the top of the existing Planning Center Integration section; the pre-existing credentials display/edit `<template>` pair is now wrapped in `v-if="pcEnabledInput"` — a display-only condition wired to no handler and no Firestore write
- `SettingsView.test.ts` extended from 2 to 9 tests: three dot-path key-set assertions (`Object.keys(payload)` has length 1), a combined mirror-to-store test, a credential-retention test (no `setPcCredentials` call, no `updateDoc` payload naming `pcAppId`/`pcSecret`), a credentials-block show/hide test, and a failure-path revert test
- Read `firestore.rules` and confirmed the security finding required by the plan's threat model (T-39-01) — see "Security Finding" below

## Task Commits

1. **Task 1: Toggle state and three dot-path save handlers** - `39363a8` (feat)
2. **Task 2: AI Features section, PC enable toggle, and the credentials wrapper** - `994139d` (feat)
3. **Task 3: Prove the write shape and the credential-retention guarantee** - `917e375` (test)

## Files Created/Modified
- `src/views/SettingsView.vue` - Two new ref trios, two new watchers, two new save handlers, `onToggleVwMode`'s write target relocated, AI Features card, PC enable toggle, credentials block wrapper
- `src/views/__tests__/SettingsView.test.ts` - Extended from 2 to 9 tests: dot-path key-set assertions, mirror-to-store assertion, credential-retention and display assertions, failure-path assertion; auth-store mock given setters alongside its existing getters; `mockUpdateDoc` given explicit parameter types

## Security Finding (T-39-01, required by this plan's threat model)

**Read `firestore.rules` directly rather than trusting `39-RESEARCH.md`'s analogy to Phase 16.1.**
Finding: **the existing rule is confirmed to cover the new nested `settings.*` writes.**

```
match /organizations/{orgId} {
  allow read: if isOrgMember(orgId);
  allow write: if isOrgEditor(orgId);
  allow create: if isSignedIn() && request.resource.data.createdBy == request.auth.uid;
  ...
}
```

This is a **document-level** `allow write` rule with no field-level `hasOnly()`/`affectedKeys()`
restriction (unlike the `/services/{docId}` block 60 lines below it in the same file, which *does*
gate specific fields). A document-level `allow write: if isOrgEditor(orgId)` grants or denies the
entire write regardless of which top-level or nested-map keys the write touches — Firestore rules
evaluate the whole incoming document write against the boolean condition, not per-field. Since
`updateDoc(doc(db, 'organizations', orgId), { 'settings.aiEnabled': v })` is a write to
`organizations/{orgId}`, it is gated by exactly this rule, identically to every other field ever
written to that document (`name`, `slug`, `pcAppId`, the pre-existing flat `vwModeEnabled`, and now
`settings.*`). No new nested path introduces a gap — the rule was never scoped to a fixed field
list in the first place.

**`firestore.rules` was read and NOT modified**, per the plan's explicit instruction that rules
changes are deploy-gated and belong to Phases 40/41.

## Decisions Made
- Reused the exact `onToggleVwMode` structure for both new handlers, changing only the four items the plan specified (write key, mirror target, feedback/error refs, console tag) — no new error-handling shape was introduced.
- Selected the credentials-wrapper's `v-if` binding on `pcEnabledInput` (the local ref) rather than `authStore.settings.pcEnabled` (the store value) — consistent with every other toggle's checkbox binding (`v-model="pcEnabledInput"`) and with how the pre-existing `vwModeInput`/`authStore.vwModeEnabled` pair already separates "what the checkbox shows" from "what's persisted," so an in-flight save doesn't cause the credentials block to flicker before the write resolves.
- In `SettingsView.test.ts`, selected checkboxes by DOM order (`findAll('input[type="checkbox"]')[N]`) rather than adding `data-testid` attributes, since 39-UI-SPEC.md's markup blocks are specified as copy-paste-verbatim and adding test-only attributes was out of this task's scope. Order is documented in a comment: PC=0 (top of page, first section with a checkbox), VW=1, AI=2 (last section).
- Added setters to the Wave 0 auth-store mock's getter-only `settings`/`vwModeEnabled` accessors (see Deviations) rather than reworking the component to avoid direct property assignment, since the mirror-write pattern (`authStore.settings.aiEnabled = newValue`) is the established codebase convention (39-PATTERNS.md, `onToggleVwMode` precedent) and changing it would have diverged from that pattern for no behavioral gain.

## Deviations from Plan

### Auto-fixed Issues (Rule 3 — blocking issue)

**1. `vi.hoisted` mock for `updateDoc` needed explicit parameter types to satisfy `vue-tsc --build`**
- **Found during:** Task 3's `npm run type-check` gate run
- **Issue:** `mockUpdateDoc: vi.fn(() => Promise.resolve())` (Wave 0's original shape, zero-arg) caused TypeScript to infer `mock.calls` as a tuple of length 0, so `mockUpdateDoc.mock.calls[0]![1]` failed with `TS2493: Tuple type '[]' of length '0' has no element at index '1'` at all four new call sites that read the captured payload.
- **Fix:** Gave the mock explicit parameter types: `vi.fn((_ref: unknown, _data: Record<string, unknown>) => Promise.resolve())`. No behavior change — the mock still resolves to `undefined` on every call.
- **Files modified:** `src/views/__tests__/SettingsView.test.ts`
- **Commit:** `917e375`

**2. Auth-store mock's getter-only accessors needed setters to support the mirror-write pattern**
- **Found during:** writing the "mirrors the saved value onto the store" and credential-retention tests
- **Issue:** The Wave 0 mock defined `settings.aiEnabled`/`settings.pcEnabled`/`settings.vwModeEnabled` and top-level `vwModeEnabled` as getter-only accessors (`get aiEnabled() { return mockAiEnabled }`, no setter). `SettingsView.vue`'s handlers perform `authStore.settings.aiEnabled = newValue` after a successful write — assigning to a getter-only accessor on a plain object throws `TypeError: Cannot set property ... which has only a getter` in strict-mode ESM. Every module in this codebase runs in strict mode, so this was a real runtime throw inside the handler's `try` block, silently caught and misreported as a save failure.
- **Fix:** Added matching setters (`set aiEnabled(v) { mockAiEnabled = v }`, etc.) for all four accessors. This is additive to the Wave 0 mock shape — no existing getter or test-observable behavior changed.
- **Files modified:** `src/views/__tests__/SettingsView.test.ts`
- **Commit:** `917e375`

### Documented (not auto-fixed) discrepancies

**1. `'Failed to save. Please try again.'` occurs 4 times in `SettingsView.vue`, not the plan's stated 3**
- **Found during:** Task 1's acceptance-criteria check
- **Detail:** `grep -c "Failed to save. Please try again." src/views/SettingsView.vue` returns 4, not the plan's expected 3. The fourth occurrence is `onSave`'s (the Organization Name save handler) pre-existing `saveError.value = 'Failed to save. Please try again.'` at line 370 — a handler this plan did not touch, unrelated to the three toggles. The plan's acceptance criteria assumed the string appears only in toggle handlers; it also happens to be the org-name save handler's pre-existing error string. All three toggle handlers (`onToggleVwMode`, `onToggleAiEnabled`, `onTogglePcEnabled`) do use the byte-identical shared string as required.
- **Impact:** None on behavior or on the plan's actual requirement ("Keep the failure string byte-identical to the one `onToggleVwMode` already uses... do not invent a new message"). Only the plan's own count estimate was off by one, for a reason outside this task's scope.

**Total deviations:** 2 auto-fixed (both Rule 3, test-infrastructure-only, zero production-code impact); 1 documented-only discrepancy (benign, explained above).

## Issues Encountered
None beyond the two Rule 3 fixes documented above.

## User Setup Required
None — no external service configuration required. `firestore.rules` was read but not modified.

## Next Phase Readiness

`onToggleAiEnabled`/`onTogglePcEnabled`/`authStore.settings.{aiEnabled,pcEnabled}` are live and
proven; 39-04 (`claudeApi.ts` AI guard) and 39-05 (Planning Center hide points in
`serviceEditorActionBar.ts`/`RosterView.vue`/`SongsView.vue`) can now read `authStore.settings.aiEnabled`
/`authStore.settings.pcEnabled` as real, editor-controllable booleans rather than the Wave-0-seeded
mock shape.

**Not yet verified (deferred to `.planning/PENDING-VERIFICATION.md` under the v1.5 standing autonomy
grant, items 39.03-1 through 39.03-4):**
- Credential retention across a real off → reload → on cycle (R089's durable guarantee)
- AI feature list visual line-wrap at a standard desktop viewport
- Defaults rendering correctly against a genuinely pre-v1.5 organization document (carried forward from 39-02's D7)
- The `vwModeEnabled` migration not silently re-enabling a real church that deliberately turned it off

---
*Phase: 39-org-settings-infrastructure-feature-toggles*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: src/views/SettingsView.vue
- FOUND: src/views/__tests__/SettingsView.test.ts
- FOUND: 39363a8 (Task 1 commit)
- FOUND: 994139d (Task 2 commit)
- FOUND: 917e375 (Task 3 commit)
