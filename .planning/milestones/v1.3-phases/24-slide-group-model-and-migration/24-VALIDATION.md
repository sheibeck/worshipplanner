---
phase: 24
slug: slide-group-model-and-migration
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 24 — Validation Strategy

> Derived from `24-RESEARCH.md` § Validation Architecture. That section is the authoritative
> long form; this file is the tracked contract.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @vue/test-utils ^2.4.6 |
| **Config file** | `vite.config.ts` (no dedicated unit config). `vitest.rules.config.ts` exists ONLY for the rules suite — **not run this phase**. |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npx vitest run src/` |
| **Estimated runtime** | ~5s quick / ~4 min full |

**Emulator constraint (STATE.md — hard):** do NOT run `npm run test:rules`, do NOT start/stop/restart
the Firebase emulator. A live user session may hold ports 8080/9199.

**This phase needs no `firestore.rules` change** — research verified the existing generic
`match /{collection}/{docId}` catch-all under `organizations/{orgId}` already covers a new
single-segment sibling collection, exactly as `scriptureReadings` and `importedSlides` are covered
today. This holds **only if slides stay an embedded array field on the group document, not a nested
subcollection.** If planning deviates to a subcollection, rules DO change and the rules suite must be
run later, when the emulator is free — call that out rather than skipping it.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <the new/extended test file for that task>`
- **After every plan wave:** `npx vitest run src/`
- **Before `/gsd-verify-work`:** full suite green + `npm run type-check` 0 + `npm run build` 0
- **Max feedback latency:** ~4 minutes

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows are keyed by behavior and bound to task IDs when plans land.

| Task ID | Req | Behavior | Test Type | Automated Command | File | Status |
|---------|-----|----------|-----------|-------------------|------|--------|
| TBD | R028 | Reordering slots never re-points a group — `slideGroups` write count stays zero across a reorder | unit | `npx vitest run src/composables/__tests__/useSlideGroupAssembly.test.ts` | ❌ W0 | ⬜ |
| TBD | R028 | `ServiceSlot.id` backfill on load marks nothing dirty and triggers no autosave write | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ⚠️ extend | ⬜ |
| TBD | R029 | Deleting a slot deletes its group; confirm copy names slide count + attached media/notes; declining leaves both intact | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ⚠️ extend | ⬜ |
| TBD | R030 | Per-slide audio overrides the group bed for that slide only; bed resumes on the next slide with no override | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` | ⚠️ extend | ⬜ |
| TBD | R030 | `audioLoop` emitted only when the source per-slide entry set it — the group bed never carries loop | unit | same as above | ⚠️ extend | ⬜ |
| TBD | D-02 | Song reconciliation is **additive**: a new lyric section appears as a new entry; a removed section's customized entry is retained, not deleted | unit | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` | ❌ W0 | ⬜ |
| TBD | D-02 | Scripture/imported reconciliation with existing customization raises a confirm-required flag rather than silently replacing | unit | same as above | ❌ W0 | ⬜ |
| TBD | D-05 | A slot with `audioUrl`/`videoUrl` and no group produces a group whose bed equals those values, in one atomic create | unit | `npx vitest run src/stores/__tests__/slideGroups.test.ts` | ❌ W0 | ⬜ |
| TBD | D-05 | Materialization is idempotent under simulated concurrent double-call — deterministic id de-dupes, no duplicate document | unit | same as above | ❌ W0 | ⬜ |
| TBD | — | **Regression guard:** assembler output stays compatible with `PresentationViewer.vue` | unit | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` | ✅ must stay green | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/types/slideGroup.ts` — new types (`SlideGroup`, `GroupSlideEntry`, `SourceRef`). Pure declarations, no test file, but everything below depends on it.
- [ ] `src/stores/__tests__/slideGroups.test.ts` — new. Mirror `src/stores/__tests__/scriptureSlides.test.ts`'s convention: mock `firebase/firestore` module functions, mock `@/firebase`'s `db`, capture the `snapshotCallback`. Covers subscribe/unsubscribe, delete, and deterministic-id materialize-if-missing.
- [ ] `src/utils/__tests__/slideGroupMaterializer.test.ts` — new. Pure input/output, no mocking, matching `slideshowAssembler.test.ts`'s style. Covers derive-from-source and reconcile-diff.
- [ ] `src/composables/__tests__/useSlideGroupAssembly.test.ts` — new (or extend `useSlideshowAssembly.test.ts`). Reactive wiring: subscribe-on-org-change, materialize-on-missing, and reorder-writes-nothing.
- [ ] Framework install: **none** — Vitest + @vue/test-utils already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Firestore round-trip of a materialized group (create → reload → same doc, no duplicate) | R028, D-05 | Unit tests mock Firestore; deterministic-id de-dupe under a real backend is unproven until it runs against one | Open a service, let groups materialize, hard-reload, confirm exactly one group per slot and no data change |
| Migration of a real Phase 22 service carrying slot `audioUrl`/`videoUrl` | R030, D-05 | Needs an actual pre-migration document | Open a service saved before this phase with slot media attached; confirm the media appears as the group bed and still plays |
| Confirm-on-delete copy reads correctly with real counts | R029 | Wording judgment against real data | Delete a slot with slides + attached audio; confirm the warning names the true count and the media |
| Rules coverage for the new collection **if** planning deviates to a subcollection | R028 | `test:rules` is blocked this phase by the emulator constraint | Run `npm run test:rules` when no live session holds 8080/9199 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`npx vitest run`, never bare `npm run test:unit`)
- [ ] `PresentationViewer.test.ts` still green (Phase 23 regression guard)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
