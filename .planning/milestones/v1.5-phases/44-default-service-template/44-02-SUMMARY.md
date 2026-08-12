---
phase: 44-default-service-template
plan: 02
subsystem: ui
tags: [vue3, sortablejs, settings, service-template, teleport, vertical-worship]

# Dependency graph
requires:
  - phase: 44-default-service-template (Plan 44-01)
    provides: "ServiceTemplateEntry type, OrgSettings.defaultServiceTemplate field, and buildSlotsFromTemplate() in slotTypes.ts"
  - phase: 43-service-item-types
    provides: "Finalized SlotKind add-item palette (Song/Scripture/Prayer/Message/Announcements/Miscellaneous — no Hymn, no Imported)"
  - phase: 26-slide-editing
    provides: "EditSlideDrawer.vue's Teleport/Transition/no-scrim slide-out panel shell, structurally ported here"
provides:
  - "ServiceTemplateEditor.vue — the Settings slide-out template editor (structural port of EditSlideDrawer.vue + Phase 43's palette + ServiceEditorView.vue's per-section SortableJS reorder)"
  - "Services card in SettingsView.vue with a live '{N} items across {M} sections' summary and the Edit Default Template open control"
affects: [settings, service-creation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOMWrapper(document.body) test pattern for a Teleported panel — mirrors EditSlideDrawer.test.ts's own body() helper; wrapper.find()/text() cannot see Teleport content, only a DOMWrapper over document.body can"
    - "sortablejs capture-harness mock (ServiceEditorView.test.ts's pattern) reused for a second, independent per-section-Sortable component — Sortable.create() is captured per container and onEnd invoked directly rather than simulating a real jsdom drag"

key-files:
  created:
    - src/components/settings/ServiceTemplateEditor.vue
    - src/components/settings/__tests__/ServiceTemplateEditor.test.ts
  modified:
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "Row label/aria-label text is derived via slotLabel(createSlot(kind)) rather than a second hand-written kind→label switch — reuses slotTypes.ts's existing exhaustive switch instead of duplicating it, at the cost of minting one throwaway crypto.randomUUID() per label render (negligible for a settings-drawer-sized list)"
  - "Per-item remove fires immediately with no confirmation dialog (UI-SPEC Copywriting Contract) — a template entry holds no user content (Area 1 lock: {id, kind, section} only), unlike ServiceEditorView.vue's own removeSlot, which does confirm because a live slot can carry an assigned song/scripture/body"
  - "The five SERVICE_SECTIONS containers (plus the trailing unlabeled/legacy bucket for section-less entries) are always rendered as live SortableJS drop targets once the draft is non-empty — mirrors ServiceEditorView.vue's own always-present per-section containers, needed so a user can drag an item into a currently-empty section"

patterns-established:
  - "A settings-level slide-out editor edits a cloned local draft and writes only on an explicit Save — the drawer's draft array is never the store's own array reference (Pitfall #3), so no in-drawer edit can leak into DEFAULT_ORG_SETTINGS's shared instance for every org that has never saved a template"

requirements-completed: [R086]

coverage:
  - id: D1
    description: "ServiceTemplateEditor.vue — slide-out editor with the closed six-button add-item palette (no Hymn/Imported), per-section SortableJS reorder keyed on entry id, per-item section <select>, immediate per-item remove, Reset to 1-2-3 default (content-free, confirms only on a non-empty draft), and Save Template (stripUndefined dot-path write + store reassignment, empty draft stays saveable)"
    requirement: "R086"
    verification:
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts (20 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Services card in SettingsView.vue — live '{N} items across {M} sections' / empty-template summary (section-less entries excluded from M), and the isEditor-gated Edit Default Template button opening the drawer"
    requirement: "R086"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts — 'SettingsView Services card (R086) — Wave 2 (44-02)' block (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real pointer drag-and-drop reorder feel (within and across sections), the drawer's no-scrim/no-reflow-underneath behavior, and the Services card summary reading naturally in a running browser"
    human_judgment: true
    rationale: "jsdom cannot render a real pointer drag or judge visual absence of a scrim/dimming overlay; the automated suite proves the SortableJS wiring and onEnd reducer logic by invoking captured options directly, not that a real drag feels right. Deferred to .planning/PENDING-VERIFICATION.md § Phase 44 → Plan 44-02, per the standing v1.5 autonomy grant — never self-approved."

duration: 30min
completed: 2026-08-07
status: complete
---

# Phase 44 Plan 02: Settings Template Editor UI Summary

**`ServiceTemplateEditor.vue` — a Teleported, no-scrim slide-out that structurally ports `EditSlideDrawer.vue`'s panel shell around Phase 43's closed six-chip palette and `ServiceEditorView.vue`'s per-section SortableJS reorder, wired into a new "Services" card on `SettingsView.vue` with a live item/section-count summary — completing R086's UI half on top of Plan 44-01's storage engine.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-07T22:12:00Z
- **Completed:** 2026-08-07T22:36:25Z
- **Tasks:** 2 (both TDD — RED/GREEN commit pairs)
- **Files modified:** 5

## Accomplishments
- `src/components/settings/ServiceTemplateEditor.vue` — a new right-edge slide-out (`fixed inset-y-0 right-0 z-50 w-full max-w-[480px]`, `Teleport to="body"`, no scrim, structurally copied from `EditSlideDrawer.vue`) whose add-item palette is Phase 43's finalized six-button set (Song/Scripture/Prayer/Message/Announcements/Miscellaneous) copied verbatim from `ServiceEditorView.vue:1174-1182` — never Hymn, never Imported.
- Draft-based editing (Pitfall #3): opening the drawer clones `authStore.settings.defaultServiceTemplate` into a fresh local `ref` (`.map((entry) => ({ ...entry }))`) — every add/remove/reorder/section-change mutates only that draft, never the store's shared array, until Save Template is clicked.
- Per-section SortableJS reorder — one `Sortable.create()` instance per `SERVICE_SECTIONS` container plus a trailing unlabeled/legacy bucket for section-less entries, `v-for` keyed on each entry's own stable `id`, mirroring `ServiceEditorView.vue`'s proven `sectionSortables` map (cross-section drag shares one group name; the unlabeled bucket is pull-only).
- "Reset to 1-2-3 default" maps `buildSlots('1-2-2-3')` to content-free `{id, kind, section}` entries — no `songId`/`requiredVwType`/other content fields — applying directly on an empty draft or after a "Replace Template" confirm on a non-empty one.
- Save Template writes `stripUndefined(draft)` to the `'settings.defaultServiceTemplate'` dot-path via `updateDoc`, then reassigns `authStore.settings.defaultServiceTemplate` — a quoted leaf-key mirror-write, never a whole-map write. An empty draft is a valid, always-saveable state (no disabled state on empty).
- Icon-only controls (remove ×, drag handle) carry `aria-label="Remove {kindLabel}"` / `aria-label="Drag to reorder {kindLabel}"` per the UI-SPEC accessibility requirement.
- New "Services" card in `SettingsView.vue`, matching the existing four sections' shape, with a live summary line — "{N} items across {M} sections" (M counts only non-empty named `SERVICE_SECTIONS` buckets, consistent with the editor's own `groupBySection`) or the exact empty-template sentence — and an isEditor-gated "Edit Default Template" button opening the editor.

## Task Commits

Each task followed the RED/GREEN TDD cycle:

1. **Task 1: ServiceTemplateEditor.vue slide-out + test harness**
   - RED: `2031ada` (test)
   - GREEN: `96adae0` (feat)
2. **Task 2: Services card in SettingsView.vue + summary/open wiring**
   - RED: `8ecff68` (test)
   - GREEN: `a33e30c` (feat)

_No metadata/final commit is included in this list — it is created in a subsequent step._

## Files Created/Modified
- `src/components/settings/ServiceTemplateEditor.vue` — the slide-out template editor (new file)
- `src/components/settings/__tests__/ServiceTemplateEditor.test.ts` — 20 tests: panel shell, empty state, closed palette, add/section-change/remove + aria-labels, Reset (empty/confirm/apply), Save (dot-path payload/error/store reassignment), draft cloning, and per-section SortableJS reorder (same-section and cross-section) via a capture-harness mock
- `src/views/SettingsView.vue` — new Services card + `templateEditorOpen`/`templateSummary` state, `ServiceTemplateEditor` import and mount
- `src/views/__tests__/SettingsView.test.ts` — `mockAuthState.settings.defaultServiceTemplate` added to the existing mock; new "SettingsView Services card (R086) — Wave 2 (44-02)" describe block (7 tests); `enableAutoUnmount`/`DOMWrapper(document.body)` added for the newly Teleported child
- `.planning/PENDING-VERIFICATION.md` — new "Plan 44-02" subsection under Phase 44, recording the four human-only checks (real drag feel, no-scrim, summary readability, open/close) deferred per the standing v1.5 autonomy grant

## Decisions Made
- Row labels/aria-labels reuse `slotLabel(createSlot(kind))` rather than a second hand-written kind→label switch, keeping the label vocabulary in one place (`slotTypes.ts`) at the cost of a throwaway `crypto.randomUUID()` per label render — negligible for a template list this small.
- Per-item remove fires immediately with no confirm, per the UI-SPEC Copywriting Contract — a template entry is `{id, kind, section}` only (no user content), unlike `ServiceEditorView.vue`'s live-slot `removeSlot`, which does confirm because a real slot can carry an assigned song, scripture reference, or body text.
- All five `SERVICE_SECTIONS` containers (plus the trailing legacy bucket) render as live Sortable drop targets whenever the draft is non-empty, even when a given section currently holds zero items — mirrors `ServiceEditorView.vue`'s always-present per-section containers, and is what lets a user drag an item into a section that has nothing in it yet.

## Deviations from Plan

None — plan executed exactly as written. The plan's `must_haves`, `key_links`, and threat-model dispositions (T-44-01, T-44-05, T-44-06) are all satisfied as specified:
- T-44-01 (non-editor bypassing the UI): the "Edit Default Template" button is `:disabled="!authStore.isEditor"`, and `onSave` itself re-checks `authStore.isEditor` before writing — belt-and-braces, matching every other Settings section's toggle-handler pattern.
- T-44-05 (malformed kind/section): the palette is a closed six-button set of literal `SlotKind` values and the section control is a closed `<select>` over `SERVICE_SECTIONS` + "No section" — no free-text path exists to enter a malformed value.
- T-44-06 (undefined/content fields leaking into Firestore): Save writes `stripUndefined(draft)`, and every entry is built directly as `{id, kind, section?}` — never a raw `createSlot()` result — so no content field (`songId`/`body`/etc.) or literal `section: undefined` key ever reaches the payload; proven by the "no undefined, no content fields" assertions in `ServiceTemplateEditor.test.ts`.

No `firestore.rules`/`storage.rules` changes were made (out of scope, confirmed by 44-RESEARCH.md Pitfall #5) — nothing was deployed.

## Issues Encountered

One self-caught bug during Task 1's own authoring (not a deviation — fixed before the RED/GREEN commits, not a pre-existing defect discovered in someone else's code): the drawer's `immediate: true` open-watcher referenced `showResetConfirm`/`saveError`/`savedFeedback` refs that were declared further down the `<script setup>` block, throwing `ReferenceError: Cannot access 'showResetConfirm' before initialization` the moment the component mounted. Fixed by moving those four `ref()` declarations above the watcher. Caught immediately by the first test run — `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` — before any commit was made.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- R086 is now fully delivered end to end: a church can define its default service template in Settings (this plan) and every new blank service is built from it (Plan 44-01's engine). `defaultServiceTemplate` has exactly one write path (this editor's Save) and exactly one read path for slot construction (`buildSlotsFromTemplate`, Plan 44-01) — no second consumer or defaults-merge point was introduced.
- Phase 44 is structurally complete across both plans (R086 + R087). No further plans are scoped for this phase.
- **Human verification deferred, per the standing v1.5 autonomy grant** (STATE.md ★★): real pointer drag-and-drop feel, the drawer's no-scrim/no-reflow-underneath behavior, and the Services card summary's real-world readability have not been performed by the owner. Recorded in `.planning/PENDING-VERIFICATION.md` § Phase 44 → Plan 44-02, alongside Plan 44-01's still-outstanding "empty-by-default new service" and "configured-template new service" checks.

---
*Phase: 44-default-service-template*
*Completed: 2026-08-07*

## Self-Check: PASSED

All 5 created/modified files verified present on disk (plus `.planning/PENDING-VERIFICATION.md`);
all 4 task commit hashes (2031ada, 96adae0, 8ecff68, a33e30c) verified present in git log.
