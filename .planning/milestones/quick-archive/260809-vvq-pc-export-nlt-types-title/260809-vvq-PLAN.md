---
phase: quick/260809-vvq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/planningCenterApi.ts
  - src/utils/__tests__/planningCenterApi.test.ts
  - src/views/ServiceEditorView.vue
  - src/views/__tests__/ServiceEditorView.test.ts
autonomous: true
requirements:
  - A-NLT-ROUTING-AND-EMPTY-REF-GUARD
  - B-EXPORT-PRAYER-MESSAGE-ANNOUNCEMENTS-MISC
  - C-PLAN-TITLE-PASSAGE-ONLY

must_haves:
  truths:
    - "A church whose bibleVersion is 'NLT' gets NLT scripture text in exported Planning Center items (never ESV silently)."
    - "A SCRIPTURE slot with no resolvable reference produces NO passage fetch (no HTTP 400) and still creates its plan item without a description."
    - "PRAYER, MESSAGE, ANNOUNCEMENTS and MISC slots are created as Planning Center items in ALL export paths (existing-plan, new-plan-with-template, new-plan-no-template); IMPORTED is still excluded."
    - "A newly created Planning Center plan is titled with the sermon passage only (no '(Teams)' suffix); the existing-plan path never sets a title."
  artifacts:
    - src/utils/planningCenterApi.ts
    - src/utils/__tests__/planningCenterApi.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
  key_links:
    - "addSlotAsItem's new required bibleVersion param <-> authStore.settings.bibleVersion at all 9 ServiceEditorView call sites"
    - "SCRIPTURE branch fetch dispatch <-> fetchNltPassageText / fetchPassageText"
    - "onConfirmExport otherSlots bucket <-> addSlotAsItem branches for PRAYER/MESSAGE/ANNOUNCEMENTS/MISC"
    - "buildPlanTitle (new-plan branch, ServiceEditorView.vue:3337) <-> createPlan title"
---

<objective>
Fix and extend the Planning Center export with three confirmed sub-tasks:

- A (bug): the SCRIPTURE branch of `addSlotAsItem` fetches ESV unconditionally (ignores the church's `bibleVersion`) and, when the reference is empty, sends an empty query that returns HTTP 400.
- B (feature): the export loop in `onConfirmExport` only buckets SONG/HYMN and SCRIPTURE; PRAYER/MESSAGE/ANNOUNCEMENTS/MISC are silently dropped in the existing-plan and new-plan-with-template paths.
- C (feature): `buildPlanTitle` appends a `(Teams)` suffix; the title must be the sermon passage only, and only on new plans.

Purpose: correct scripture translation + reference handling in the export, stop dropping four slot kinds, and clean up the generated plan title.
Output: modified `planningCenterApi.ts` and `ServiceEditorView.vue`, with extended unit tests in both existing test files.
</objective>

<context>
@.planning/STATE.md
@CLAUDE.md
@src/utils/planningCenterApi.ts
@src/utils/esvApi.ts
@src/utils/nltApi.ts
@src/utils/scripture.ts
@src/components/ScriptureInput.vue
@src/views/ServiceEditorView.vue
@src/types/service.ts
@src/types/organization.ts
@src/utils/__tests__/planningCenterApi.test.ts
@src/views/__tests__/ServiceEditorView.test.ts
</context>

<design_notes>
DECISION — `bibleVersion` is a REQUIRED parameter, inserted after `songs` (not a defaulted trailing param).

Justification (the context asked to decide and justify):
1. `DEFAULT_ORG_SETTINGS.bibleVersion` is `'NLT'` (owner's locked v1.5 override). A silent `'ESV'` default at any missed call site is therefore a LIVE correctness bug (church chose NLT, export ships ESV), not a harmless fallback.
2. The current signature ends with optional `sermonPassage?`, `length?`. TypeScript forbids a required parameter after an optional one, so a required `bibleVersion` cannot be appended at the end — it is inserted immediately after `songs` (the last required param). This makes `npm run type-check` flag every one of the 9 call sites that is not updated, so no site can silently keep the old behavior.
3. Test churn (adding an explicit `'ESV'` arg to existing `addSlotAsItem` test calls) is mechanical and compiler-guided; the tests are being extended in this plan anyway.

DECISION — Sub-task B appends the four kinds "like the leftover passes" (LOCKED).
The four new kinds are collected into an `otherSlots` bucket (service-array order preserved by `Array.filter`) and appended after the existing leftover passes in both the existing-plan branch and the new-plan-with-template branch. The no-template new-plan branch (`for (const slot of localService.value.slots)` at ServiceEditorView.vue:3430) already exports these kinds and needs NO change.

RE-EXPORT / DEDUP consideration (documented, accepted): a service flips to status `'exported'` after a successful export, so ordinary re-export is gated. The existing-plan branch can still target a plan with pre-existing items. Because the four kinds are APPENDED (not title-matched/replaced like songs/scriptures), exporting into a plan/template that already contains an "Announcements"/"Miscellaneous"/"Prayer"/"Message" item can produce a duplicate. This matches the locked "append like leftovers" design and the pre-existing behavior for songs/scriptures' own leftover passes. As reconciliation hygiene, the existing-plan classifier's `NON_SCRIPTURE_REGULAR_TITLES` set is extended so newly-supported regular-item titles are not mis-consumed as scripture match targets (see Task 2).
</design_notes>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: NLT routing + empty-ref guard in addSlotAsItem, and passage-only buildPlanTitle</name>
  <files>src/utils/planningCenterApi.ts, src/utils/__tests__/planningCenterApi.test.ts</files>
  <behavior>
    - SCRIPTURE branch with bibleVersion 'NLT' calls fetchNltPassageText(refText) and NOT fetchPassageText.
    - SCRIPTURE branch with bibleVersion 'ESV' calls fetchPassageText(refText) and NOT fetchNltPassageText.
    - SCRIPTURE slot whose ref resolves to empty (book or chapter null -> scriptureRefFromSlot returns null -> refText '') calls NEITHER fetch, does not throw, and still creates the item (createItem invoked) with no html_details.
    - A fetch rejection (ESV or NLT) is still swallowed by try/catch; the item is created with no description.
    - buildPlanTitle returns the sermon passage only when sermonPassage is present, even when teams are present (no '(Teams)' suffix); falls back to trimmed name, then 'Service'.
  </behavior>
  <action>
Sub-task A (SCRIPTURE branch, planningCenterApi.ts ~L976-1001):
- Add import at top of file: `import { fetchNltPassageText } from '@/utils/nltApi'` (alongside the existing `import { fetchPassageText } from '@/utils/esvApi'`).
- Add a REQUIRED parameter `bibleVersion: 'ESV' | 'NLT'` to `addSlotAsItem`, inserted immediately AFTER `songs: Song[]` and BEFORE `sermonPassage?: ScriptureRef | null`. Do not give it a default value (see design_notes).
- In the SCRIPTURE branch, keep `const ref = scriptureRefFromSlot(slot)` and `const refText = ref ? formatScriptureReference(ref) : ''`. Replace the unconditional `description = await fetchPassageText(refText)` with: only attempt a fetch when `refText` is non-empty, and route by version — `fetchNltPassageText(refText)` when `bibleVersion === 'NLT'`, else `fetchPassageText(refText)`. Keep the surrounding `try/catch` that swallows fetch errors and leaves `description` undefined. When `refText` is empty, skip the fetch entirely (no `q=`/`ref=` empty request) and leave `description` undefined; the `createItem` call at the end of the branch is unchanged (title remains `Scripture - ${refText}`).
- Other branches (SONG/HYMN/PRAYER/ANNOUNCEMENTS/MISC/MESSAGE/IMPORTED) do not consume `bibleVersion`; the exhaustiveness backstop stays as-is.

Sub-task C (buildPlanTitle, planningCenterApi.ts ~L859-878):
- Change the return so the title is the sermon passage ONLY: return `formatScriptureRef(service.sermonPassage)` when `sermonPassage` is present; else the trimmed `service.name` when non-empty; else `'Service'`. Remove the `if (service.teams && service.teams.length > 0) return \`${base} (${service.teams.join(', ')})\`` block entirely.
- Narrow the parameter type from `Pick<Service, 'sermonPassage' | 'name' | 'teams'>` to `Pick<Service, 'sermonPassage' | 'name'>` (teams is no longer read). The sole call site passes a full `Service`, so this is safe.
- Update the doc comment to describe the new format: "Sermon Scripture" or "Service Name" or "Service" (no teams).

Tests (planningCenterApi.test.ts):
- Add an nltApi mock next to the esvApi mock: `vi.mock('@/utils/nltApi', () => ({ fetchNltPassageText: vi.fn() }))` and `import { fetchNltPassageText } from '@/utils/nltApi'`. Reset/mock it in the addSlotAsItem `beforeEach` the same way `fetchPassageText` is (`vi.mocked(fetchNltPassageText).mockResolvedValue(...)`).
- Update EVERY existing `addSlotAsItem(...)` call in this file to insert the new `bibleVersion` argument immediately after the songs-array argument. `npm run type-check` (and the vitest run) will point out each one. Existing behavior tests pass `'ESV'`; e.g. `addSlotAsItem('app-id','secret','svc-type-1','plan-1', slot, 0, [], 'ESV')`, and for calls that already pass sermonPassage the version goes before it: `addSlotAsItem(..., slot, 4, [], 'ESV', null)`.
- Add a test: SCRIPTURE slot exported with `'NLT'` calls `fetchNltPassageText` (assert `toHaveBeenCalledWith('John 3:16-17')` or similar) and `fetchPassageText` was NOT called; the returned NLT text becomes `html_details`.
- Add a test: SCRIPTURE slot exported with `'ESV'` calls `fetchPassageText` and NOT `fetchNltPassageText`.
- Add a test: a SCRIPTURE slot with `book: null, chapter: null` exported with either version calls NEITHER fetch (`expect(vi.mocked(fetchPassageText)).not.toHaveBeenCalled()` and same for NLT), does not throw, and still POSTs a create-item (fetch/createItem stub invoked once) with title `Scripture - ` and no `html_details`.
- Update the `buildPlanTitle` describe block: the two tests that assert a `(Choir)` / `(Choir, Orchestra)` suffix must now assert the bare passage (`Romans 8:1-11`, `Revelation 12`); keep the name-fallback and `'Service'`-fallback tests; keep/one test asserting that teams present does NOT append a suffix.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/planningCenterApi.test.ts</automated>
  </verify>
  <done>
    - `addSlotAsItem` has a required `bibleVersion: 'ESV' | 'NLT'` param after `songs`; SCRIPTURE fetch routes by version and is skipped for an empty ref.
    - `buildPlanTitle` returns passage-only (no teams suffix) with unchanged fallbacks; its `Pick` no longer includes `teams`.
    - `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` passes, including the new NLT-routing, ESV-routing, empty-ref-skip, and passage-only-title assertions.
  </done>
</task>

<task type="auto">
  <name>Task 2: Thread bibleVersion through onConfirmExport and export PRAYER/MESSAGE/ANNOUNCEMENTS/MISC in all branches</name>
  <files>src/views/ServiceEditorView.vue, src/views/__tests__/ServiceEditorView.test.ts</files>
  <action>
Sub-task A wiring (ServiceEditorView.vue, onConfirmExport ~L3178-3448):
- Update ALL 9 `addSlotAsItem(...)` call sites to pass `authStore.settings.bibleVersion` as the new argument, inserted immediately after the `songStore.songs` argument (before the `localService.value.sermonPassage` argument). The 9 sites are at approximately L3276, L3293, L3310, L3325, L3391, L3394, L3413, L3423, L3438. Because `bibleVersion` is a required param, `npm run type-check` will flag each un-updated site — fix each flagged site the same way.

Sub-task B (export the four remaining kinds), ServiceEditorView.vue onConfirmExport:
- Add a bucket alongside `songSlots` (L3220) and `scriptureSlots` (L3221):
  `const otherSlots = localService.value.slots.filter(s => s.kind === 'PRAYER' || s.kind === 'MESSAGE' || s.kind === 'ANNOUNCEMENTS' || s.kind === 'MISC')`
  (IMPORTED stays excluded; SONG/HYMN/SCRIPTURE handled by the existing buckets. `.filter` preserves service slot order.)
- Existing-plan branch: after the fifth-pass leftover-scripture loop (ends ~L3333, still inside `if (exportMode.value === 'existing' && existingPlan.value)`), add a sixth pass that appends each slot in `otherSlots` via `addSlotAsItem(appId, secret, serviceTypeId, planId, slot, sequence, songStore.songs, authStore.settings.bibleVersion, localService.value.sermonPassage)`, incrementing the same `sequence` variable, wrapped in the same per-slot try/catch that pushes a failure label (use `slot.kind` as the label) so one failed item does not abort the export.
- New-plan-with-template branch: after the leftover-scripture loop (ends ~L3428, still inside `if (templateId)`), add the same append pass over `otherSlots`, reusing that block's `sequence` variable and the same try/catch failure-label pattern.
- New-plan-no-template branch (`for (const slot of localService.value.slots)` ~L3430): NO change — it already iterates all slots and skips only IMPORTED. Confirm by reading that IMPORTED is still `continue`d and the four kinds fall through to `addSlotAsItem`.
- Reconciliation hygiene (existing-plan first pass, `NON_SCRIPTURE_REGULAR_TITLES` ~L3246): extend the set to `new Set(['message', 'prayer', 'announcements', 'miscellaneous'])` so a pre-existing regular item with one of the now-supported titles is not mis-classified as a scripture match target. (Append-not-replace is intentional; see design_notes RE-EXPORT/DEDUP.)

Tests (ServiceEditorView.test.ts, extend the existing ME-01 export describe block ~L5794-5919, which already mocks `@/utils/planningCenterApi` with `mockAddSlotAsItem`, `mockCreatePlan`, `mockFetchPlanItems`, `mockFetchTemplateItems`, and drives `vm.onConfirmExport()` via the `armExport` helper):
- Add a fixture service whose slots include one of each: SONG (with songId), SCRIPTURE (valid ref), PRAYER, MESSAGE, ANNOUNCEMENTS, MISC, IMPORTED. Set it via `mockServicesList = [{ ...mockService, status: 'planned', slots: [...] }]`.
- new-plan no-template (regression): run `onConfirmExport` with `exportMode='new'`, empty template id; assert `mockAddSlotAsItem` was called with a slot of each kind PRAYER, MESSAGE, ANNOUNCEMENTS, MISC (inspect the 5th positional arg of the mock calls), and NEVER with an IMPORTED slot.
- new-plan with template: set `vm.exportSelectedTemplateId` to a non-empty id and make `mockFetchTemplateItems` resolve to at least one template item; run export; assert the four kinds are still passed to `mockAddSlotAsItem` (this is the newly-fixed path — previously dropped).
- existing-plan: set `vm.exportMode='existing'` and `vm.existingPlan = { id: 'pc-plan-existing' }` (read the armExport harness / vm bindings to confirm the exact handle) with `mockFetchPlanItems` resolving to `[]`; run export; assert the four kinds are appended via `mockAddSlotAsItem`.
- Assert `mockAddSlotAsItem` is called with `authStore.settings.bibleVersion` in the bibleVersion argument position (the arg immediately after the songs array) for at least one call, confirming Sub-task A wiring.
- Keep the three existing ME-01 tests passing.
  </action>
  <verify>
    <automated>npx vitest run src/views/__tests__/ServiceEditorView.test.ts</automated>
  </verify>
  <done>
    - All 9 `addSlotAsItem` call sites pass `authStore.settings.bibleVersion`.
    - `otherSlots` (PRAYER/MESSAGE/ANNOUNCEMENTS/MISC) are appended in the existing-plan and new-plan-with-template branches; the no-template branch is unchanged; IMPORTED remains excluded.
    - `NON_SCRIPTURE_REGULAR_TITLES` extended to include 'announcements' and 'miscellaneous'.
    - `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` passes with the new kind-coverage assertions across all three export modes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> /api/nlt, /api/esv proxies | Scripture text fetch. Both proxies already inject their upstream API key server-side and enforce the x-app-auth gate; this change only chooses WHICH already-authenticated proxy to call — no new boundary. |
| client -> Planning Center API | Item/plan creation. Unchanged auth (Basic auth via existing pcCredentials). |

No new external dependencies, no package installs, no new secrets. The empty-ref guard REMOVES a malformed upstream request (empty `q=`/`ref=`) rather than adding one. No STRIDE-relevant change beyond correcting request formation.
</threat_model>

<verification>
- `npm run type-check` (vue-tsc --build; per CLAUDE.md this is the authoritative gate — it typechecks test files too) passes clean. The required `bibleVersion` param means a clean type-check is positive evidence every call site was updated.
- `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` passes.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` passes.
- Full app suite `npx vitest run` shows only the documented 2-file baseline failing (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) — these are NOT regressions per CLAUDE.md. No new failing file.
</verification>

<success_criteria>
- Sub-task A: exported SCRIPTURE items use NLT text when the org's `bibleVersion` is 'NLT' and ESV otherwise; an empty scripture reference never triggers a fetch (no HTTP 400) and still yields an item without a description.
- Sub-task B: PRAYER, MESSAGE, ANNOUNCEMENTS and MISC slots are exported as Planning Center items in the existing-plan, new-plan-with-template, and new-plan-no-template paths, preserving service slot order; IMPORTED remains excluded.
- Sub-task C: new plans are titled with the sermon passage only (no '(Teams)' suffix), with unchanged name/'Service' fallbacks; the existing-plan path sets no title.
- `npm run type-check` clean; both targeted test files pass; full suite at the documented 2-file baseline.
</success_criteria>

<output>
Modify the four files listed in `files_modified`. No SUMMARY file required for this quick task unless the quick-task harness requests one.
</output>
