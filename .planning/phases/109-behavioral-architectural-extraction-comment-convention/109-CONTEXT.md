# Phase 109: Behavioral/Architectural Extraction & Comment Convention - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Relocate the **behavioral/architectural** ("how this works") comment bucket — Bucket B of the
Phase 108 inventory, 309 entries, already handed off with a suggested `.planning/codebase/` target
doc per entry — into the `.planning/codebase/` map docs, reducing each source comment to what the
code alone cannot convey. Then write a durable comment-convention document (R319) so the standard
holds for future work.

In scope: relocating Bucket B "how it works" narration into the map docs, shrinking those source
comments, and authoring the comment-convention doc.

Out of scope: the decision-rationale bucket (done in Phase 108 → ADRs), genuinely-local comments
(Bucket C — left alone), any behavior change, any production deploy. Comment/docs-only edits —
`npm run type-check` and the full test suite must pass unchanged.
</domain>

<decisions>
## Implementation Decisions

### Behavioral Extraction & Comment Convention (accepted by owner 2026-09-01)
- **Convention doc home:** Append a "Comment Convention" section to the existing
  `.planning/codebase/CONVENTIONS.md` (co-located with the behavior docs that now bear the load),
  plus a one-line pointer from `CLAUDE.md` so future sessions discover it.
- **Shrink policy:** Keep inline only what the code alone cannot convey at the point of reading —
  non-obvious "why", gotchas, invariants. Relocate multi-paragraph "how the whole feature works"
  narration into the relevant map doc and leave a short pointer.
- **Pointer format:** `// See .planning/codebase/<DOC>.md (<section>)` — relative path + section,
  mirroring the Phase 108 ADR-pointer style.
- **Doc strategy:** Prefer UPDATING the 7 existing map docs (ARCHITECTURE, STRUCTURE, INTEGRATIONS,
  CONCERNS, TESTING, CONVENTIONS, STACK) per the Phase 108 handoff's suggested targets. Create a new
  map doc only when a Bucket-B cluster has no fitting home. The maps are stale (dated Jul 22, before
  v1.1→v2.7) — refresh the sections you touch as you relocate, but do not undertake a full rewrite.

### Locked at milestone start (REQUIREMENTS.md v2.8 scope)
- Behavioral/architectural → `.planning/codebase/`. Decision-rationale already went to ADRs (Phase 108).
- Only load-bearing comments are in scope; short/local comments (Bucket C) are left alone.
- No behavior change; comment/docs-only edits verified by unchanged type-check + full test suite.
- No production deploy in this milestone (build/commit only).

### Claude's Discretion
- Exact section anchors within each map doc, ordering of relocated content, and whether a new map
  doc is warranted for any orphan cluster.
- How much stale-map refresh to do in touched sections (bounded — relocation is the goal, not a
  full re-map).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/phases/108-comment-audit-decision-rationale-extraction/108-COMMENT-INVENTORY.md` — Bucket B
  (309 entries) with file:line refs and a "Phase 109 Handoff — Behavioral/Architectural Subset"
  section that already suggests a target map doc per entry. This is the primary input.
- The 7 existing `.planning/codebase/*.md` map docs are the relocation targets.

### Established Patterns
- Phase 108 set the pointer-shrink pattern (`// See ADR-NNNN (...)`); this phase mirrors it for map
  docs (`// See .planning/codebase/<DOC>.md (<section>)`).
- The `.gsd/`-era graph is stale — rely on the inventory's verified file:line refs, not graph queries.

### Integration Points
- Source comments across `src/**`, `functions/src/**`, `render-service/src/**`, and the rules files —
  the same trees Phase 108 audited (Bucket B spans them).
- CLAUDE.md gets a one-line pointer to the new convention section.

</code_context>

<specifics>
## Specific Ideas

- The Phase 108 handoff is the authoritative worklist — every Bucket B entry must be accounted for
  (relocated + shrunk, or explicitly kept inline because the code alone cannot convey it). No silent
  drops.
- Success criterion 3: a spot-check across affected files shows no paragraph-length inline "how it
  works" narration remaining where a map doc now covers it.

</specifics>

<deferred>
## Deferred Ideas

- Full re-map/refresh of the stale `.planning/codebase/` docs beyond the sections touched during
  relocation — out of scope; this phase relocates + lightly refreshes touched sections only.

</deferred>
