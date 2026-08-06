# Deferred Items — Phase 37

Out-of-scope discoveries logged per the executor's SCOPE BOUNDARY rule (not fixed, not
part of any task's acceptance criteria).

## 37-04: root-level `npx vitest run src/` cross-workspace contamination on `render-service/src/render.test.ts`

**Found during:** 37-04's project-gate verification pass (running the app suite to confirm
no regression, per this plan's `<constraints>`).

**Observation:** Running `npx vitest run src/` from the repo root (`C:\projects\worshipplanner`)
picks up `render-service/src/render.test.ts` and `functions/src/*.test.ts` in addition to the
app's own `src/**` files — Vitest's positional CLI argument matches by substring across the
whole monorepo, not by directory anchor, so any path containing the literal substring `src/`
is included regardless of which package it belongs to.

When picked up this way, `render-service/src/render.test.ts` fails outright (0 tests, a
suite-level error) with:

```
Error: [vitest] No "default" export is defined on the "node:child_process" mock.
```

This is NOT a regression from this plan — 37-04 touched only `functions/src/index.ts` and
`functions/src/index.test.ts` (plus the one-line `pptxParser.test.ts` mock fix documented in
the plan SUMMARY). `render-service/` and the root `vite.config.ts` were not modified. Root's
installed Vitest is `v4.0.18`; `functions/` and `render-service/` each have their own
`node_modules` pinning `v4.1.10`. Running `render-service`'s suite in its own directory
(`cd render-service && npx vitest run`) passes 39/39 — the failure only appears when the file
is transformed by the ROOT workspace's older Vitest/Vite under the app's `jsdom` environment
instead of `render-service`'s own `vitest.config.ts` (node environment). This points to a
Vitest-version-skew-across-workspaces issue, not a code defect.

**Why not fixed here:** Root-causing and fixing this would mean either pinning a single
Vitest version across all three package.json files, or adding `render-service/**` (and
arguably `functions/**`, which currently passes only by luck of substring overlap) to root's
`vite.config.ts` test.exclude list — a cross-workspace tooling change outside this plan's
`files_modified` scope (`functions/src/index.ts`, `functions/src/index.test.ts`) and outside
R062 entirely.

**Correct verification path (used by this plan and prior 37-0x plans):** run each workspace's
own suite in its own directory — `cd functions && npx vitest run`, `cd render-service && npx
vitest run`, and the app suite via `npx vitest run` from root scoped to files that don't
collide (or accept that `render-service/src/render.test.ts` will show as a spurious failure
if invoked with a bare `src/` positional filter from root). Do not use the bare root
`npx vitest run src/` (or unscoped `npx vitest run`) as an authoritative gate for
`render-service/`'s own correctness — its own `cd render-service && npx vitest run` command is
authoritative and passed 39/39 for this plan.

**Suggested follow-up (not actioned):** Either pin Vitest to one version repo-wide, or add
`render-service/**` to root `vite.config.ts`'s `test.exclude` array (mirroring the existing
`functions/lib/**` exclude and its documented rationale) so the root app suite can never
cross-contaminate with a sibling workspace's tests again.
