## graphify

This project has a knowledge graph at `.planning/graphs/`, built and maintained by the
**gsd graphify** tooling (god nodes, community structure, cross-file relationships).

Rules:
- For codebase questions, query the graph before grepping raw source. It returns a scoped
  subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output:
  - `/gsd:graphify query "<term>"` (or directly:
    `node "$HOME/.claude/gsd-core/bin/gsd-tools.cjs" graphify query "<term>"`)
- Read `.planning/graphs/GRAPH_REPORT.md` only for broad architecture review, or when a
  query does not surface enough context.
- Check freshness with `/gsd:graphify status`; see changes since the last build with
  `/gsd:graphify diff`.
- After modifying code, run `/gsd:graphify build` to keep the graph current.

> ⚠ **The graph needs a rebuild.** It was last built while `.gsd/` still existed, so it resolves
> symbols to `.gsd/quarantine/worktrees/**` copies that are now deleted (e.g. `ServiceSlot` → a
> quarantined `service.ts`). Run `/gsd:graphify build` before trusting a query; until then, verify any
> graph hit against the real path under `src/`.

## The `.gsd/` directory is gone

This project used to run on **gsdpi**, which kept its state in `.gsd/`. It now runs on regular
**gsd-core**, whose state lives in `.planning/`. The entire `.gsd/` tree — the frozen gsdpi planning
record and 1461 files of quarantined worktree snapshots — was deleted on 2026-07-29 at the owner's
instruction: *"We are no longer using anything in there and we don't want it to be influencing our
decisions."*

The quarantined copies were not merely dead weight. Their test files import through the `@/` alias,
which the root Vite config resolves to the **real** `src/` — so a correct change to live source could
fail a frozen snapshot. They also contributed 10 of the 14 failing files in the test baseline, hiding
real failures behind permanent noise.

`.planning/` is the only planning state. Do not resurrect `.gsd/` or cite it as precedent; recover it
from git history only if explicitly asked.

## Environment: `.env.local` is REQUIRED in every worktree

`.env.local` is gitignored (it holds Firebase/ESV/Claude/Planning Center secrets) and is
therefore **absent from freshly-created git worktrees**. The canonical copy lives in the
main checkout at `C:\projects\worshipplanner\.env.local`. Without these values you cannot:

- run the Firebase emulator or `npm run test:rules` (Firebase config fails to load),
- run the full unit suite (component tests that import Firebase config fail to *load*), or
- produce a valid production build — `vite.config.ts` now **aborts `vite build`** when any
  `VITE_FIREBASE_*` var is missing (guard added so an empty-apiKey bundle can never ship
  again; the original incident was a build from a worktree lacking `.env.local`).

**Setup in a new worktree (do this before running emulator/tests/build):**

- Preferred — symlink to the single source of truth (needs Windows admin / Developer Mode):
  `New-Item -ItemType SymbolicLink -Path .\.env.local -Target C:\projects\worshipplanner\.env.local`
- Fallback — copy it (works without elevation, but goes stale if the source changes):
  `Copy-Item C:\projects\worshipplanner\.env.local .\.env.local`

The `vite build` guard only checks `VITE_FIREBASE_*`, but the file also carries `ESV_API_KEY`,
`CLAUDE_API_KEY`, and `VITE_PLANNINGCENTER_*` — copy/symlink the whole file, don't cherry-pick.
