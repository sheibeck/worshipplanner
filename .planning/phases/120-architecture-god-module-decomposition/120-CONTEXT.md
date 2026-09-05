# Phase 120: Architecture — God-Module Decomposition - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous / yolo). The milestone's final phase. Scoped as **"begin
decomposing"** — extract at least ONE cohesive responsibility from each god module, NOT a full rewrite.
Highest behavior-preservation bar in the milestone (moving code within two very large files) but bounded.

<domain>
## Phase Boundary

Begin decomposing the two largest modules the ARCH review flagged (ARCH-006 `ServiceEditorView.vue`
4606 lines, ARCH-010 `functions/src/index.ts` 3082 lines) plus the ARCH-020 utils dependency-direction
nit — R358, R359, R360. This is the last phase of v2.10; after it, the milestone audit + completion run.
</domain>

<decisions>
## Implementation Decisions

### R358 (ARCH-006) — extract one responsibility from ServiceEditorView.vue
- Extract ONE cohesive, self-contained feature responsibility into its own composable, continuing the
  existing `useAutoSave`/`useSlideshowAssembly` extraction pattern. **Candidate (planner's pick): the
  Planning Center export flow** (self-contained: takes the service, produces the PC export write +
  status) — or AI song-suggestions if it extracts more cleanly with less coupling.
- **Behavior-preserving MOVE, not a rewrite.** The extracted composable must expose the same reactive
  surface the inline code did; the view wires to it with import/wiring changes only.
- Acceptance: `ServiceEditorView.test.ts` passes with ONLY import/wiring changes (no behavior-change
  edits to the tests), and the view file is measurably smaller (report before/after line count).
- Be surgical — pick the single cleanest block; do NOT attempt to decompose the whole monolith.

### R359 (ARCH-010) — extract one concern from functions/src/index.ts  ⚠ RE-EXPORT TRAP
- Extract ONE of the five inline concerns into its own module file, matching the existing
  `orgProvisioning.ts`/`orgMembershipClaims.ts`/`superAdminClaims.ts` pattern (import at top, `export {…}`
  at the bottom of index.ts). **Candidate (planner's pick): the four cleanup sweeps** —
  `cleanupExpiredMedia` (:1188), `cleanupOrphanRenders` (:1359), `cleanupOrphanBackgrounds` (:1576),
  `cleanupPptxSources` (:1728) — one cohesive theme, into `functions/src/cleanupSweeps.ts`. The PPTX
  pipeline (`parsePptxHandler`/`parsePptx`/the bridging trigger) is the alternative if cleanup sweeps
  share too many local helpers.
- **⚠ CRITICAL — the re-export trap (see [[functions-must-reexport-from-index]]):** every `export const`
  Cloud Function moved into the new module MUST be re-exported from `index.ts` (`export { cleanupExpiredMedia, … } from "./cleanupSweeps"` or import+re-export), or **`firebase deploy` fails with "No function matches the filter"** and the function silently disappears from prod. There is NO predeploy build hook. **The functions test suite does NOT catch this** — its handler-direct tests import handlers directly and pass even when the deploy-facing export is missing. So a green `cd functions && npm test` is NOT proof. The plan MUST include an explicit verification step: `grep` index.ts to confirm EVERY moved `export const <fn>` name still appears in a re-export, AND run `cd functions && npm run build` (tsc) to confirm the module compiles and the re-exports resolve.
- Move any shared helpers the concern needs either into the new module (if only it uses them) or leave
  them in index.ts and import them (if shared) — do not duplicate.
- Acceptance: the moved functions' existing tests pass with behavior unchanged; every moved function is
  re-exported from index.ts; `cd functions && npm run build` succeeds; functions suite green.

### R360 (ARCH-020) — utils → useAuthStore dependency inversion  [DOCUMENT, low-risk branch]
- The three files `src/utils/claudeApi.ts`, `messaging.ts`, `scriptureApi.ts` import `useAuthStore()` for
  read-only settings gating. ARCH-020 is a **Low** finding — "mild inversion, no correctness/circular
  risk." **Take the criterion's document-as-sanctioned branch: record it as a sanctioned exception in
  `.planning/codebase/ARCHITECTURE.md`** (the utility-layer dependency-direction section), explaining
  that these three utils read gating settings via the store deliberately and why it's safe (read-only, no
  circular import). Rationale: a pass-in refactor changes every call site's signature (ripple across
  callers) for a Low nit on the milestone's last phase — not worth the behavior-preservation risk.
- Bonus (optional, planner's discretion): if ONE of the three refactors cleanly to pass-in with no
  caller ripple, do it — but documenting all three is the accepted deliverable.

### Claude's Discretion
- Which ServiceEditorView responsibility (PC export vs AI suggestions) and which index.ts concern
  (cleanup sweeps vs PPTX pipeline) extract most cleanly — pick on inspection, favoring least coupling.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / patterns to COPY
- `useAutoSave` / `useSlideshowAssembly` composables — the extraction template for R358.
- `functions/src/orgProvisioning.ts` + its `import`(top)/`export {…}`(bottom :3066) wiring in index.ts —
  the extraction template for R359. Other bottom-of-file re-exports: :3058, :3062, :3076, :3082.

### Established Patterns
- Cloud Functions are declared `export const <name> = onRequest/onCall/onSchedule(...)` and re-exported
  from index.ts's bottom. `firebase.json` has no predeploy build hook — rebuild (`npm run build`) before
  reasoning about deploy.

### Integration Points
- src/views/ServiceEditorView.vue (+ a new src/composables/use<Thing>.ts) + ServiceEditorView.test.ts (R358).
- functions/src/index.ts (+ a new functions/src/<concern>.ts) + the moved functions' test files (R359).
- src/utils/{claudeApi,messaging,scriptureApi}.ts + .planning/codebase/ARCHITECTURE.md (R360).

</code_context>

<specifics>
## Specific Ideas

- **Behavior-preserving MOVES.** Gates: `npm run type-check` (full vue-tsc --build) + `npx vitest run`
  (app suite; accepted baseline `src/storage.rules.test.ts` only) for R358/R360; **`cd functions && npm
  test` AND `cd functions && npm run build`** for R359 (build proves the re-exports resolve — the suite
  alone does NOT prove deploy-safety).
- Full per-finding detail: `.planning/milestones/v2.8-phases/110-architectural-review/110-ARCHITECTURE-REVIEW.md` (ARCH-006, ARCH-010, ARCH-020).
- This is the LAST phase — keep extractions minimal and safe; the goal is to establish the pattern +
  shrink the god modules a bit, not to finish decomposition (future backlog can continue it).

</specifics>

<deferred>
## Deferred Ideas

- Full decomposition of either god module — this phase does "at least one" extraction each; the rest is
  future backlog.
- The confirmed-sound ARCH verification-note findings — no action (out of scope).

</deferred>
