# Project Research Summary

**Project:** WorshipPlanner
**Domain:** Brownfield milestone on a shipped Vue 3 + Firebase worship-planning app (v1.4 "Service and Slides")
**Researched:** 2026-07-28
**Confidence:** MEDIUM-HIGH

## Executive Summary

v1.4 is a trust-repair milestone on a shipped app: 26 user-reported items reduce to about ten root causes. The drag-and-drop corruption reported in service ZTXcpNRcJTalEQp42fTx is caused by three compounding bugs in ServiceEditorView.vue's onEnd handler: using evt.oldIndex/newIndex (which count non-draggable section-header DOM siblings) instead of evt.oldDraggableIndex/newDraggableIndex, a DOM-revert that only undoes a single adjacent swap, and an unstable v-for key that changes on every reorder. The same pattern is copy-pasted into SlideGrid.vue. PITFALLS.md independently confirms the D-16 DOM-revert fix already exists and works correctly in both files -- the two researchers agree on the underlying SortableJS/Vue divergence mechanism, but the deeper trace found it is not sufficient on its own: the wrong-index-source and unstable-key bugs are separate, still-unfixed defects. No re-application of D-16 is needed; what is needed is fixing the index source and the v-for key, plus restructuring the five sections as independent per-section Sortable.create() containers.

The remaining work splits into two categories. Six items are structural fixes to production data (Service/ServiceSlot) that must preserve existing user documents: the ordering-model fix, adding Post-Service, hard-locking slide groups to service order (deleting reconciliation), draft-only editing with a genuine three-layer lock (Firestore rules -- currently absent -- plus store guard plus UI), the autosave race fix, and a save-status aggregator. Four items are net-new capability with infrastructure risk: server-side PPTX-to-image rendering (needs a standalone Cloud Run service with a custom Dockerfile since Firebase Functions buildpacks cannot install LibreOffice/Poppler), LLM-assisted scripture splitting (needs an Anthropic SDK upgrade from the stale pin for structured outputs), background images (low risk, additive), and a contextual-action-bar audit. PPTX rendering is the single highest-uncertainty item -- STACK.md's cost/latency figures are grounded estimates, not benchmarked against this app's real deck corpus, and PITFALLS.md flags cold starts, OOM, silent font substitution, and orphaned partial-render Storage objects as failure modes requiring async job architecture.

The mitigation strategy threads through every phase: fix cheap/foundational things first (stable key, then ordering model) before anything that depends on trustworthy ordering; treat the autosave bug as MEDIUM-confidence and unreproduced -- write a failing repro test before fixing, since the evidenced mechanism (a self-echo updatedAt mismatch resetting an autosaveInitialized flag) is strongly argued but never run against the live app; and keep the AI feature narrowly scoped to structural labeling (indices into already-fetched ESV text, never model-regenerated text) so scripture correctness is structurally guaranteed.

## Key Findings

### Recommended Stack

Server-side PPTX rendering uses self-hosted headless LibreOffice + Poppler on a dedicated Cloud Run service, invoked asynchronously from the existing parsePptx Cloud Function via service-to-service IAM auth. LLM scripture splitting requires upgrading the Anthropic SDK from the old, stale pin (predates structured outputs) to current, using output_config.format to constrain output to verse/clause indices only on claude-haiku-4-5. Background images need no new libraries -- add backgroundImageUrl at three data-model levels and install the official storage-resize-images Firebase Extension. Save-status/toast should be hand-rolled on top of a new Pinia useSaveStatus aggregator (vue-toastification is stale since 2022; vue-sonner is fine but unnecessary here). Drag-and-drop stays on sortablejs 1.15.7 (confirmed current) -- the fix is in how onEnd calls it, not a library swap; keyboard-accessible reordering uses up/down buttons calling the same reorder function.

**Core technologies:**
- LibreOffice + Poppler on Cloud Run (custom Dockerfile) -- real PPTX layout fidelity, MPL 2.0, near-zero cost, must be a separate deployment surface from firebase deploy --only functions
- Anthropic SDK upgrade + structured outputs (output_config.format) -- the only way to make scripture-split output schema-validated rather than free-text-parsed
- storage-resize-images Firebase Extension -- zero-code server-side image optimization
- Hand-rolled save-status component + aria-live regions -- no toast library warranted

### Expected Features

**Must have:** Draft-only editability with state-scoped lock (an improvement over Planning Center's role-only permissions, not a copy); explicit Reopen-for-editing with export-aware warning; persistent inline Saving/Saved status with toast-on-failure-only; copyright/CCLI notice at least once per song group with correct content; group-level background with per-slide override; consistent contextual action bar per tab, primary actions always visible; Post-Service as a purely structural fifth section.

**Should have:** Song-level background inherited from the canonical Song Lyrics editor; LLM-assisted responsive-reading split with role-tagged segments (only MediaShout has a manual comparable); compliance-margin CCLI placement (first AND last slide) explicitly documented as exceeding the legal once-per-song floor.

**Defer:** Live auto-advance/loop timer engine (belongs to the live-presentation layer this app does not own); full audit-log screen for reopen actions; approval workflow on reopening.

### Architecture Approach

Service/ServiceSlot are the production data boundary (must preserve); SlideGroup/ImportedDeck/SongLyrics are greenfield (reshape freely). The core move is collapsing three overlapping concerns onto single sources of truth: per-section Sortable containers for ordering, one unconditional slide-group rebuild path (replacing reconciliation's three-branch logic with two), and one save-status aggregator above the existing useAutoSave composable (ServiceEditorView.vue still hand-rolls a duplicate ~150-line implementation predating that extraction).

**Major components:**
1. Per-section Sortable.create() containers -- makes oldIndex/newIndex trustworthy again, makes sections structurally non-draggable
2. slideGroupMaterializer.ts reconcile functions stripped of confirm branches -- unconditional replace, no dismissedSignature, no ReconcileConfirmModal
3. Three-layer draft lock (Firestore rules -- currently absent -- plus store guard plus UI) -- only rules are adversary-proof
4. New Cloud Function plus Cloud Run render service for PPTX, writing under orgs/orgId/pptx-imports/importId/rendered/ (exempt from cleanupExpiredMedia by prefix)
5. useSaveStatus Pinia aggregator above per-surface useAutoSave instances

### Critical Pitfalls

1. **SortableJS/Vue DOM divergence** -- D-16 DOM-revert already works; still-open bugs are index source and unstable key. Fix both, do not reapply D-16.
2. **Optimistic state racing its own Firestore echo** -- ServiceEditorView.vue already gates on autosaveStatus; Slides tab's separate slideGroupsStore subscription lacks this guard.
3. **UI-only lock enforcement** -- firestore.rules has zero status-based write guard today; all three layers (rules, store, UI) must be built, rules first, plus any Cloud Function writing to a locked service (Admin SDK bypasses rules).
4. **Headless PPTX rendering in serverless** -- cold starts, OOM, silent font substitution, orphaned partial-render objects. Must be async-job architecture; orphan-cleanup deletion must default to dry-run (this exact mismatch already caused a real incident in this codebase).
5. **Deleting reconciliation leaves orphaned fields, dead imports, vacuous tests** -- dismissedSignature is a persisted Firestore field; trace via knowledge graph before deletion, record the leave-vs-backfill decision explicitly.
6. **Post-Service touches production data with scattered section lists and non-exhaustive switches** -- convert switches to exhaustiveness-guarded patterns before adding the fifth section.

## Implications for Roadmap

The ~26 scoped items reduce to roughly 8-10 phases, sequenced by dependency:

### Phase 1: Stable v-for key + fixed ordering model
**Rationale:** Cheapest fix plus foundational restructuring must land before anything depending on trustworthy order.
**Delivers:** Correct drag-and-drop in ServiceEditorView.vue and SlideGrid.vue together (same root-cause fix).
**Addresses:** Order structure; half of Slides interaction.
**Avoids:** Pitfall 1 -- note DOM-revert is NOT broken, only index source and key are.

### Phase 2: Post-Service section
**Rationale:** Additive type change, only safe once ordering is trustworthy.
**Delivers:** Fifth section with section-list inventory + exhaustiveness-guard conversion as prerequisite.
**Addresses:** Post-Service milestone item; audit print/share/plan-rail/PC export.
**Avoids:** Pitfall 9.

### Phase 3: Delete reconciliation, hard-lock slide groups
**Rationale:** Depends on ordering being stable first; is one unit of work, not two phases.
**Delivers:** Unconditional slide-group rebuild; removal of ReconcileConfirmModal, dismissedSignature, confirm branches.
**Addresses:** Slides mirror the plan.
**Avoids:** Pitfall 8 -- graph-trace consumers before deletion, delete (not skip) the test suite.

### Phase 4: Draft-only editing + reopen (three-layer lock)
**Rationale:** Independent, can build in parallel, but rules change must be sequenced against Phase 1's immediate-save path.
**Delivers:** Firestore rules status check + store guard + centralized UI isEditable + dedicated reopenService action.
**Addresses:** Service lifecycle.
**Avoids:** Pitfall 5 -- extend firestore.rules.test.ts, not just UI tests.

### Phase 5: Save-status aggregator + autosave bug fix
**Rationale:** Root-cause fix must land before the global UI is wired to it.
**Delivers:** useSaveStatus aggregator; persistent inline status; toast-on-failure-only; autosave bug fix.
**Addresses:** Save reliability.
**Avoids:** Pitfall 4 -- write the failing repro test FIRST; the root cause is MEDIUM confidence, not reproduced live.

### Phase 6: PPTX server-side rendering
**Rationale:** Independent, can run in parallel; highest-uncertainty item in the milestone, should not sit adjacent to a tight deadline.
**Delivers:** Standalone Cloud Run service (custom Dockerfile, LibreOffice + Poppler + Carlito/Caladea/Liberation fonts) + bridging Cloud Function; async job architecture with completeness checks.
**Note on tension:** STACK.md frames async-Cloud-Run as the cost-driven recommendation; PITFALLS.md arrives at the same architecture from a risk-mitigation angle (cold starts/OOM/font substitution) -- convergence from two angles raises confidence, but neither source's latency/cost figures are benchmarked against real decks, so budget real test-deck validation time.

### Phase 7: LLM-assisted scripture splitting
**Rationale:** Enhances existing AI integration; SDK upgrade is a hard prerequisite since structured outputs postdate the current pin.
**Delivers:** Upgraded SDK; new Cloud Function proxy path using output_config.format constrained to indices only.
**Addresses:** Smarter content.

### Phase 8: Backgrounds + drawer split
**Rationale:** Depends on Phase 3's unconditional rebuild being stable; drawer split sequenced after backgrounds exist as fields to display.
**Delivers:** Three-tier background cascade (song > group > slide); EditSlideDrawer split into Edit details / Edit lyrics via 3-dot menu.
**Addresses:** Backgrounds; part of Slides interaction.

### Phase 9: Presentation correctness + CCLI placement + contextual action bars
**Rationale:** Lower-complexity, trails the structural work; CCLI documentation-language fix belongs here.
**Delivers:** No org labels when presenting; copyright first+last slide (documented as safety margin, not CCLI mandate); one action-bar pattern audited across every tab, after Service Order/Slides layouts finalize.
**Addresses:** Presentation correctness; UI rework.

### Phase Ordering Rationale

- Ordering must be trustworthy before Post-Service, the slide-group hard-lock, or draft-lock rules interacting with the immediate-save path
- Reconciliation deletion and background data model are coupled -- sequence backgrounds after the unconditional rebuild lands
- Claude SDK upgrade is a hard gate for the scripture-split feature
- Draft-lock, autosave-fix, and PPTX rendering are mutually independent and can run in parallel once Phase 1 lands
- Contextual action bar work is explicitly last -- building it before the two tab reworks finalize risks rework

### Research Flags

Needs deeper research during planning:
- **Phase 4:** Firestore rules field-level diff logic for the reopen-transition special case
- **Phase 6:** Highest-uncertainty item -- needs a real multi-font, multi-slide test deck and cost/latency validation
- **Phase 7:** Re-verify SDK version and output_config.format call shape at implementation time; validate Haiku split determinism empirically
- **Phase 3:** Needs a graph-trace pass to build the full reconciliation consumer inventory before deletion

Standard patterns (skip research-phase):
- **Phase 1:** Root cause and fix already fully derived with line-level citations
- **Phase 2:** Well-enumerated consumer checklist already exists
- **Phase 5:** Fix shape well-evidenced, only needs repro-test-first discipline
- **Phase 8:** Directly extends an existing precedent (audio's slide-beats-bed); no new libraries

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH for versions (npm registry, 2026-07-28); MEDIUM for PPTX cost/latency (grounded estimates, not benchmarked) |
| Features | MEDIUM -- websearch-only, cross-checked across 2+ sources per finding; CCLI section flags an unresolved primary source |
| Architecture | HIGH -- cited to real file/line reads; autosave root cause explicitly flagged MEDIUM (strong hypothesis, not reproduced) |
| Pitfalls | HIGH for codebase-specific findings; MEDIUM for general SortableJS/LibreOffice/LLM integration patterns |

**Overall confidence:** MEDIUM-HIGH -- brownfield-specific findings are unusually well-grounded, all traced to actual code. External/competitive findings are solid but MEDIUM by design given limited authoritative documentation for this niche domain.

### Gaps to Address

- Autosave root cause is a hypothesis, not confirmed -- write a failing repro test before fixing.
- CCLI's own binding license text was never directly retrieved (site returned marketing copy / 403) -- fix the internal justification language ("exceeds the legal minimum," not "CCLI requires this"), not the requirement itself.
- PPTX rendering latency/cost are estimates -- budget real test-deck validation in Phase 6.
- slideshowAssembler.ts and Planning Center export's exact section-count assumptions were flagged "likely automatic" but not fully confirmed -- verify at Phase 2 plan time.
- Whether Haiku's scripture splits are reliably near-deterministic on real passages is asserted, not validated -- add an explicit evaluation step in Phase 7.

## Sources

### Primary (HIGH confidence)
- Direct repository reads: ServiceEditorView.vue, SlideGrid.vue, slideGroupMaterializer.ts, useSlideshowAssembly.ts, slideGroups.ts, slideGroup.ts, service.ts, slotTypes.ts, useAutoSave.ts, services.ts, functions/src/index.ts, pptxParser.ts, firestore.rules, router/index.ts, sortablejs v1.15.7 source
- npm registry version checks, run 2026-07-28
- .planning/PROJECT.md, .planning/STATE.md

### Secondary (MEDIUM confidence)
- claude-api skill (cached 2026-06-24 pricing)
- WebSearch: Gotenberg/LibreOffice/Cloud Run buildpacks, CloudConvert/Aspose/Syncfusion pricing, storage-resize-images docs, accessible drag-and-drop patterns
- Planning Center Help, Google Docs/Notion/Linear/Primer save-feedback patterns, ProPresenter/EasyWorship/FreeShow/MediaShout docs, CCLI placement blogs, Adobe Spectrum/Mobbin toolbar patterns

### Tertiary (LOW confidence)
- Great Plains UMC CCLI blog post -- single-source, not cross-checked
- CCLI's own site -- attempted fetch returned only marketing copy, flagged as unresolved primary source

---
*Research completed: 2026-07-28*
*Ready for roadmap: yes*
