# Deferred Items — Phase 46

Out-of-scope discoveries logged per the executor's SCOPE BOUNDARY rule (only auto-fix issues
directly caused by the current task's changes; everything else is logged here, not fixed).

## 46-01: `render-service/src/render.test.ts` fails under bare `npx vitest run`

**Found during:** Plan 46-01 Task 2 full-suite verification.

**Observed:** `npx vitest run` (bare, per CLAUDE.md's documented command) reports 3 failed test
files, not the documented 2-file baseline (`src/storage.rules.test.ts`, `RosterView.test.ts`).
The third is `render-service/src/render.test.ts`, failing with:

```
Error: [vitest] No "default" export is defined on the "node:child_process" mock.
```

**Root cause (not investigated further — out of scope):** `render-service/` has its own Vitest
version (4.1.10) distinct from the root project's (4.0.18) — CLAUDE.md documents this exact
mismatch as the reason `npx vitest run src/` explicitly must not be used. This run shows the same
class of failure surfaces even under the bare `npx vitest run` form CLAUDE.md recommends as safe.

**Why not fixed here:** `render-service/src/render.test.ts` was last touched in Phase 37
(`846eaec`) and is untouched by Plan 46-01 (which only added `@fontsource/*` deps and
`src/config/slideFonts.ts`). This is a pre-existing workspace/tooling issue unrelated to slide
typography — outside this task's scope per the executor's SCOPE BOUNDARY rule.

**Suggested follow-up:** A future phase or quick task should either exclude `render-service/`
from the root Vitest workspace discovery, or reconcile the two Vitest versions, so
`npx vitest run` reliably reports only the true 2-file baseline.
