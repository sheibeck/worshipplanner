## graphify

This project has a knowledge graph at `.planning/graphs/`, built and maintained by the
**gsd graphify** tooling (god nodes, community structure, cross-file relationships).

Rules:
- For codebase questions, query the graph before grepping raw source. It returns a scoped
  subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output:
  - `/gsd:graphify query "<term>"` (or directly:
    `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" graphify query "<term>"`)
- Read `.planning/graphs/GRAPH_REPORT.md` only for broad architecture review, or when a
  query does not surface enough context.
- Check freshness with `/gsd:graphify status`; see changes since the last build with
  `/gsd:graphify diff`.
- After modifying code, run `/gsd:graphify build` to keep the graph current.
