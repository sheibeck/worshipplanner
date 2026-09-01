# Phase 108: Comment Audit & Decision-Rationale Extraction - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Inventory and classify every load-bearing comment across the codebase into three buckets
(decision-rationale, behavioral/architectural, genuinely-local), then relocate the
**decision-rationale** bucket (the `R-`/`WR-`/`CR-`/`Pitfall`-tagged "why we did it this way" notes)
into ADRs under `docs/adr/`, reducing each source comment to a short pointer.

In scope: the audit/triage inventory (drives both R317 here and R318 in Phase 109), ADR creation for
the decision-rationale bucket, and shrinking those source comments to pointers.

Out of scope: relocating the behavioral/architectural bucket (Phase 109), the comment convention doc
(Phase 109), any behavior change, any production deploy. Comment-only edits — `npm run type-check` and
the full test suite must pass unchanged.
</domain>

<decisions>
## Implementation Decisions

### ADR Authoring & Audit Convention (accepted by owner 2026-09-01)
- **ADR template:** MADR-lite — Title, Status, Context, Decision, Consequences, plus an optional
  "Source comments" backlink list enumerating the file:line locations whose rationale the ADR now
  carries.
- **Numbering / filename:** `docs/adr/NNNN-kebab-title.md`, 4-digit sequential starting at `0001`.
  The comment pointer uses the id form `ADR-0001`.
- **Granularity:** Group by decision — one ADR per distinct rationale. Multiple comments across
  different files may point to the same ADR id (avoids ADR explosion and duplicated rationale).
- **"Load-bearing" scope:** A comment is load-bearing if removing it loses information not recoverable
  from the code itself — the `R-`/`WR-`/`CR-`/`Pitfall` "why" notes, multi-line "how it works"
  narration, and non-obvious constraint/gotcha notes. Exclude trivial restatements, TODOs, section
  dividers, and JSDoc param docs.
- **Pointer text format:** `// See ADR-0001 (docs/adr/0001-title.md)` — id + relative path, so it is
  clickable and greppable both directions.

### Locked at milestone start (REQUIREMENTS.md v2.8 scope)
- Decision-rationale → ADRs (`docs/adr/`). Behavioral/architectural → `.planning/codebase/` (Phase 109).
- Only load-bearing comments are in scope; short/local comments are left alone.
- No behavior change; comment-only edits verified by unchanged type-check + full test suite.
- No production deploy in this milestone (build/commit only).

### Claude's Discretion
- ADR ordering/id assignment, exact title wording, and how the triage inventory is stored/formatted
  (a single markdown inventory doc under the phase dir is expected).
- Whether to create `docs/adr/README.md` (index / template reference) — encouraged but optional.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/codebase/` already holds six map docs (ARCHITECTURE.md, CONCERNS.md, CONVENTIONS.md,
  INTEGRATIONS.md, STACK.md, STRUCTURE.md, TESTING.md) — these are the Phase 109 relocation targets and
  useful orientation for classifying behavioral comments during the audit.
- No `docs/adr/` exists yet — this phase creates the directory and its first entries.

### Established Patterns
- The `R-`/`WR-`/`CR-`/`Pitfall` tag vocabulary is already used in code comments and in planning docs;
  the audit keys off these tags to find the decision-rationale bucket cheaply (grep-first).
- CLAUDE.md documents several load-bearing rationale notes (e.g. storage.rules cross-service `exists()`
  limitation, type-check gate, test-suite exclusions) — mirrors of the kind of "why" the ADRs capture.

### Integration Points
- Source comments across `src/**`, `functions/src/**`, `render-service/src/**`, and the rules files
  (`firestore.rules`, `storage.rules`) — the audit spans all runtime code, not just `src/`.
- The graph at `.planning/graphs/` is stale (needs rebuild) — prefer grep over graph queries for the
  audit, per CLAUDE.md.

</code_context>

<specifics>
## Specific Ideas

- The triage inventory must hand off the behavioral/architectural subset to Phase 109 complete and
  unambiguous — nothing dropped, nothing double-classified (success criterion 3).
- Grep-first audit: the tagged vocabulary (`R-`, `WR-`, `CR-`, `Pitfall`) makes the decision-rationale
  bucket findable without a full manual read; a lightweight scan catches untagged multi-line "why"
  notes.

</specifics>

<deferred>
## Deferred Ideas

- Relocating behavioral/architectural "how it works" comments into `.planning/codebase/` map docs → Phase 109.
- The written comment convention document → Phase 109.

</deferred>
