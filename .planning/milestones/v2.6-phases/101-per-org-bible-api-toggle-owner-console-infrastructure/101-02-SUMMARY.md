---
phase: 101-per-org-bible-api-toggle-owner-console-infrastructure
plan: 02
subsystem: ui
tags: [vue3, pinia, owner-console, firebase-functions]

requires:
  - phase: 101-per-org-bible-api-toggle-owner-console-infrastructure
    provides: "Organization.bibleApiEnabled master field + super-admin-gated setOrgBibleEnabled callable + listOrganizations echo + firestore.rules client-write deny (Plan 01)"
provides:
  - "authStore.bibleApiEnabled / isBibleApiEnabled — the single-leg master gate Phases 102/103 will read"
  - "OrgConfigDrawer 'Enable Bible API' checkbox bound to org.bibleApiEnabled, emitting toggle-bible"
  - "OrganizationsTab.onToggleBible calling setOrgBibleEnabled({orgId, enabled}) with refresh + double-submit guard + friendly-error handling"
  - "Per-row 'Bible API' at-a-glance badge on the Organizations list (R301)"
affects: [102-bible-api-fetch-dispatcher, 103-manual-fallback]

tech-stack:
  added: []
  patterns:
    - "Single-leg client store gate (isBibleApiEnabled = bibleApiEnabled.value, no settings.* AND-leg) — deliberately simpler than isAiEnabled's two-gate AND, since no church-editable settings leaf exists for the Bible API this milestone"

key-files:
  created: []
  modified:
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts
    - src/components/admin/OrgConfigDrawer.vue
    - src/components/admin/__tests__/OrgConfigDrawer.test.ts
    - src/components/admin/OrganizationsTab.vue
    - src/components/admin/__tests__/OrganizationsTab.test.ts

key-decisions:
  - "isBibleApiEnabled is single-leg (bibleApiEnabled.value only) per the plan's explicit instruction — no settings.bibleApiEnabled leaf exists this milestone, so it does not AND against settings the way isAiEnabled does."
  - "R301's per-row affordance is a new indigo 'Bible API' badge reusing the exact badge markup/classes already used by the adjacent Deactivated/pending badges — the AI toggle has no list-level badge (drawer-only), so this is the minimal list-level surface required by R301, not a new design token."
  - "Callable request field is `enabled` (not `bibleEnabled`), matching Plan 01's finalized cross-plan contract."

patterns-established: []

requirements-completed: [R295, R301]

coverage:
  - id: D1
    description: "authStore exposes bibleApiEnabled ref + isBibleApiEnabled computed, defaulting OFF when the org doc field is absent, resetting to false on every org-context reset/logout/no-org site"
    requirement: "R295"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#bibleApiEnabled / isBibleApiEnabled (Phase 101, R295) — 6 tests (default-off, explicit true/false, logout reset, no-org reset, single-leg independence)"
        status: pass
    human_judgment: false
  - id: D2
    description: "OrgConfigDrawer renders an 'Enable Bible API' checkbox bound to org.bibleApiEnabled, disabled while bibleToggling, showing bibleError, emitting toggle-bible (no payload) on change"
    requirement: "R295"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrgConfigDrawer.test.ts#OrgConfigDrawer -- Bible API enablement checkbox (Phase 101, R295) — 3 tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "OrganizationsTab.onToggleBible calls setOrgBibleEnabled with the inverted {orgId, enabled}, refreshes the list on success, no-ops on double-submit, and surfaces a friendly error on rejection without throwing"
    requirement: "R295"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- Bible API on/off toggle via drawer (Phase 101, R295) — 7 tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each Organizations list row surfaces its Bible API on/off state at a glance (a 'Bible API' badge for enabled orgs, none for default-OFF orgs)"
    requirement: "R301"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#Bible (R301): an enabled org renders the row \"Bible API\" badge; a default-OFF org renders none"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-31
status: complete
---

# Phase 101 Plan 02: Per-Org Bible API Toggle — Owner Console + Client Store Summary

**`authStore.bibleApiEnabled`/`isBibleApiEnabled` single-leg master gate + `OrgConfigDrawer` "Enable Bible API" checkbox + `OrganizationsTab.onToggleBible` + a per-row "Bible API" list badge (R301), mirroring the shipped v2.2 AI-enablement toggle 1:1 with only names, binding, and default-OFF semantics changed.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-31T17:32:00Z (approx.)
- **Completed:** 2026-08-31T17:52:17Z
- **Tasks:** 3/3 completed
- **Files modified:** 6

## Accomplishments
- `authStore` gained `bibleApiEnabled` (ref) + `isBibleApiEnabled` (computed), mirroring `aiMasterEnabled`/`isAiEnabled` exactly except single-leg (no `settings.*` AND-leg — there is no church-editable Bible API leaf this milestone). Wired into `applyOrgSnapshot` (default `?? false`) and zeroed at all three reset sites: `resetOrgContext`, the `onAuthStateChanged` null-user branch, and `logout`.
- `OrgConfigDrawer.vue` gained an "Enable Bible API" section immediately below "Enable AI features", identical markup/classes, checkbox `data-testid="org-config-bible-checkbox"` bound to `org.bibleApiEnabled`, `:disabled="bibleToggling"`, rendering `bibleError`, emitting `toggle-bible` (no payload) on change. Helper copy: "Allow this church to auto-fetch ESV/NLT scripture text. When off, they use the manual BibleGateway / paste path (no API cost)." — matching the 101-UI-SPEC.md copywriting contract precisely (never implies scripture is unavailable when off).
- `OrganizationsTab.vue` gained `onToggleBible(org)` (double-submit guard via `togglingBibleOrgId`, inverts `org.bibleApiEnabled`, calls `httpsCallable(functions, 'setOrgBibleEnabled')({ orgId, enabled })`, refreshes the org list on success, maps rejections through `friendlyCallableError` into `bibleToggleError`), plus drawer wiring (`bible-toggling`/`bible-error` props, `toggle-bible` emit → `onToggleBible`).
- R301: each Organizations-list row now shows a "Bible API" badge (indigo, reusing the exact badge markup used by the adjacent Deactivated/pending badges) when `org.bibleApiEnabled` is true, and no badge for default-OFF orgs — giving a super-admin at-a-glance visibility without opening the drawer.

## Task Commits

Each task was committed atomically:

1. **Task 1: authStore bibleApiEnabled ref + isBibleApiEnabled computed (mirror aiMasterEnabled)** - `8021dfc5` (feat)
2. **Task 2: OrgConfigDrawer "Enable Bible API" checkbox (mirror the AI checkbox)** - `24b24346` (feat)
3. **Task 3: OrganizationsTab onToggleBible + drawer wiring + per-row Bible API state badge (R301)** - `2cd02985` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/stores/auth.ts` - added `bibleApiEnabled` ref + `isBibleApiEnabled` computed; wired into `applyOrgSnapshot` and all three reset sites; exported from the store's returned object
- `src/stores/__tests__/auth.test.ts` - new `describe('bibleApiEnabled / isBibleApiEnabled (Phase 101, R295)')` block (6 tests: default-off, explicit true/false, logout reset, no-org reset, single-leg independence from settings)
- `src/components/admin/OrgConfigDrawer.vue` - new "Enable Bible API" section (checkbox, helper copy, error text); `bibleToggling`/`bibleError` props; `toggle-bible` emit; `bibleApiEnabled?: boolean` added to the local `OrgSummary` interface
- `src/components/admin/__tests__/OrgConfigDrawer.test.ts` - `bibleApiEnabled` added to `makeOrg` + default props; new describe block mirroring the AI checkbox tests (checked/unchecked, emit, disabled+error)
- `src/components/admin/OrganizationsTab.vue` - `bibleApiEnabled?: boolean` on `OrgSummary`; `SetOrgBibleEnabledRequest`/`Response` interfaces; `togglingBibleOrgId`/`bibleToggleError` state; `onToggleBible` handler; drawer prop/emit wiring; per-row "Bible API" badge (R301)
- `src/components/admin/__tests__/OrganizationsTab.test.ts` - `mockSetOrgBibleEnabled` wired into the name-keyed `httpsCallable` mock; `bibleApiEnabled` added to fixtures/`makeOrg`; new describe block (7 tests: checked/unchecked, enable call, disable call, refresh-on-success, double-submit no-op, friendly-error, permission-denied) plus an R301 row-badge assertion

## Decisions Made
- `isBibleApiEnabled` is single-leg (`bibleApiEnabled.value` alone) per the plan's explicit instruction — unlike `isAiEnabled`, it does not AND against a `settings.*` leaf, since no church-editable Bible API setting exists this milestone (deferred).
- R301's list-level affordance is a new "Bible API" badge (indigo, reusing the exact badge markup/classes of the adjacent Deactivated/pending badges) rather than inventing a new design token — the AI toggle has no list-level state indicator (drawer-only), so this is genuinely new per-row UI, scoped to the minimum R301 requires.
- Callable request field is `enabled` (not `bibleEnabled`), matching Plan 01's finalized cross-plan contract exactly.

## Deviations from Plan

None - plan executed exactly as written. All three tasks implemented the mirror-1:1 shape the plan specified with no architectural surprises.

## Issues Encountered
None specific to this plan's files. The full `npx vitest run` gate reproduced the same 2 pre-existing failing files documented in `deferred-items.md` from Plan 01 (`src/storage.rules.test.ts` — Storage-emulator limitation; `src/stores/appConfig.test.ts` — pre-existing dot-path/nested-object drift from commit `b365a1b9`, unrelated to this plan). Neither file was touched by this plan; both are correctly excluded from the pass/fail assessment per CLAUDE.md's documented baseline guidance.

## User Setup Required
None - no external service configuration required. Per CLAUDE.md and this plan's deferred deploy hand-over note, `firebase deploy` was NOT run — build/test/commit only, batched for owner confirmation at milestone end.

## Next Phase Readiness
- Phase 101 (both plans) is complete: super-admins can enable/disable the Bible API per org from the Owner Console, the state is denied to all direct client writes, and `authStore.isBibleApiEnabled` is the single gate Phases 102/103 will read.
- Verification gates all green for this plan's scope: `npx vitest run src/stores/__tests__/auth.test.ts` (110/110), `npx vitest run src/components/admin/__tests__/OrgConfigDrawer.test.ts` (28/28), `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` (68/68), `npm run type-check` clean (vue-tsc --build, includes test files).
- Full `npx vitest run` app suite: 4756/4782 pass; the 26 failures are the same 2 pre-existing files from Plan 01's `deferred-items.md`, neither touched by this plan.
- Phase 102 (Bible API fetch dispatcher) can now gate its ESV/NLT fetch calls on `authStore.isBibleApiEnabled`; Phase 103 (manual fallback UX) can hide/show the manual BibleGateway/paste path on the same gate.

---
*Phase: 101-per-org-bible-api-toggle-owner-console-infrastructure*
*Completed: 2026-08-31*

## Self-Check: PASSED

All 6 modified source files confirmed present on disk with the expected content. All three task commits (`8021dfc5`, `24b24346`, `2cd02985`) confirmed present in `git log --oneline`.
