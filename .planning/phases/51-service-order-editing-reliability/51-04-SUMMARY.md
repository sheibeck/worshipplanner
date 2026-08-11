---
phase: 51-service-order-editing-reliability
plan: 04
subsystem: services-read-surfaces
tags: [vue, pinia, service-slots, ordering, share-snapshot, R112]
requires:
  - "src/utils/slotTypes.ts::orderSlotsBySection (identity-preserving ordering contract)"
provides:
  - "ServiceCard listing renders slots in section-major order (matches editor)"
  - "buildServiceSnapshot serializes slots in section-major order (share link matches editor)"
affects:
  - "src/components/ServiceCard.vue"
  - "src/stores/services.ts (buildServiceSnapshot)"
tech-stack:
  added: []
  patterns:
    - "Both read surfaces route through the editor's single orderSlotsBySection contract so all three surfaces agree without a save"
key-files:
  created: []
  modified:
    - "src/components/ServiceCard.vue"
    - "src/components/__tests__/ServiceCard.test.ts"
    - "src/stores/services.ts"
    - "src/stores/__tests__/services.test.ts"
decisions:
  - "Read-surface fix only — no data migration; orderSlotsBySection is identity-preserving so already-ordered services incur no churn"
  - "Editor load/remote-merge watcher deliberately NOT touched (Pitfall 3) — a fresh array reference there manufactures a false isDirty / non-converging merge"
  - "buildServiceSnapshot reorders WHAT is serialized only, not WHEN/WHETHER — Phase 41 refresh cadence untouched; PII name-only block untouched"
metrics:
  duration: "~15m"
  completed: "2026-08-11"
  tasks: 2
  files: 4
status: complete
---

# Phase 51 Plan 04: Fix R112 — read surfaces render raw slot order Summary

Routed both service read surfaces — the Services listing card (`ServiceCard.vue`) and the public share snapshot (`buildServiceSnapshot` in `services.ts`) — through the editor's `orderSlotsBySection` contract, so empty-bodied items (e.g. a blank Miscellaneous) render in their section band instead of sinking to the bottom until text is typed. Repro-test-first; identity-preserving; no data migration.

## What was built

- **RED baseline (Task 1, commit c314683):**
  - Extended `src/components/__tests__/ServiceCard.test.ts` with an 8th test asserting a non-section-major fixture renders the empty worship MISC before the `--- Message ---` divider (worship band) and the sending song after it. All 7 pre-existing tests preserved.
  - Extended `src/stores/__tests__/services.test.ts` with a `buildServiceSnapshot` unit test asserting the returned slots come back in explicit section-major id order (`['slot-a','slot-c','slot-d','slot-b']`).
  - Both failed on pre-fix code (raw persisted order); every pre-existing test stayed green (89 passed, 2 failed).

- **GREEN fix (Task 2, commit f3f1e4e):**
  - `ServiceCard.vue`: added `orderSlotsBySection` import; introduced `orderedSlots = computed(() => orderSlotsBySection(props.service.slots))`; `messageIndex`/`openingSlots`/`sendingSlots` now slice from `orderedSlots.value`. `:key="slot.position"` bindings unchanged (positions preserved, still unique).
  - `services.ts::buildServiceSnapshot`: added `orderSlotsBySection` to the existing `@/utils/slotTypes` import; compute `const orderedSlots = orderSlotsBySection(service.slots)` at the top and map BPM over it. `roleAssignments` PII name-only resolution block and the Phase 41 `maybeRefreshShareLink`/`ensureShareLink` cadence untouched.

## Verification

- `npx vitest run src/components/__tests__/ServiceCard.test.ts src/stores/__tests__/services.test.ts` → 91 passed (both RED repros now GREEN; all 7 original ServiceCard tests + all pre-existing services tests pass).
- `npm run type-check` (`vue-tsc --build`, includes test files) → clean.
- Broad gate `npx vitest run --dir src --exclude '**/rules.test.ts'` → 2994 passed, 13 failed across exactly the 2 known-baseline files and no others:
  - `src/storage.rules.test.ts` — environment limitation (Storage emulator / cross-service `firestore.exists`); documented in CLAUDE.md.
  - `src/views/__tests__/RosterView.test.ts` — stale "Roles config" assertion; documented in CLAUDE.md.
  No regression beyond the 2-file baseline.

## Deviations from Plan

None - plan executed exactly as written.

## Threat surface

No new surface. T-51-04-01 (PII guard) and T-51-04-02 (autosave/isDirty stability) both held: the change reorders `service.slots` only, maps BPM over the ordered array, leaves the `roleAssignments` name-only block byte-unchanged, and applies ordering in read surfaces only (the editor load/merge watcher was not touched; `orderSlotsBySection` is identity-preserving). The PII guard test (`no email/phone/pcPersonId keys anywhere`) remains green.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/components/ServiceCard.vue (orderSlotsBySection routing)
- FOUND: src/components/__tests__/ServiceCard.test.ts (R112 test, 8 tests total)
- FOUND: src/stores/services.ts (buildServiceSnapshot ordering)
- FOUND: src/stores/__tests__/services.test.ts (R112 snapshot ordering test)
- FOUND commit c314683 (RED baseline)
- FOUND commit f3f1e4e (GREEN fix)
