# Phase 12: Advanced song search and multi-select persistent tag filtering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 12-advanced-song-search-and-multi-select-persistent-tag-filteri
**Areas discussed:** Search behavior, Tag checklist scope + logic, Persistence model, Delete-confirm scope

---

## Search behavior

| Option | Description | Selected |
|--------|-------------|----------|
| prefix:value, space tolerated | Accept both `key:E` and `key: E` | ✓ |
| Strict prefix:value | No space allowed | |
| prefix=value | Use = instead of : | |

| Option | Description | Selected |
|--------|-------------|----------|
| type, key, tag, theme, team | Disambiguates the 3 tag types | ✓ |
| type, key, tag only | Roadmap-named only | |
| Extended set | + author, ccli, notes | |

| Option | Description | Selected |
|--------|-------------|----------|
| AND — each term must match | Combinable, narrows as you type | ✓ |
| Single substring (current) | Whole query as one match | |

| Option | Description | Selected |
|--------|-------------|----------|
| Coexist | Keep VW-type/Key dropdowns + add syntax | ✓ |
| Replace with search-only | Remove dropdowns | |
| Replace only tag dropdowns | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Recognize type N / key X phrases | Pre-parse before AND-split | ✓ |
| Require colon syntax | Only type:1 / key:A | |
| Map bare number/letter | Infer lone 1 / A | |

| Option | Description | Selected |
|--------|-------------|----------|
| Partial for text, exact for key | tag/theme/team/type substring; key exact | ✓ |
| Exact match for all | | |
| Partial for all incl. key | | |

**User's choice:** Space-tolerant `prefix:value`; prefixes type/key/tag/theme/team; AND-combine; coexist with dropdowns; recognize `type N`/`key X` phrases; partial value match except exact key.

---

## Tag checklist scope + logic

| Option | Description | Selected |
|--------|-------------|----------|
| User tags only | Song.tags field only | ✓ |
| User tags + team tags | | |
| All three (user, team, themes) | | |

| Option | Description | Selected |
|--------|-------------|----------|
| OR — song has ANY checked tag | Broadens as you check | ✓ |
| AND — song has ALL checked tags | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Global toggle flips all checked | One Hide toggle inverts | ✓ |
| Per-tag show/hide tri-state | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Uncheck all + reset Hide toggle | Tag-scoped reset | ✓ |
| Clear everything (tags + search + dropdowns) | | |

**User's choice:** User tags only; OR logic; global Hide toggle; Clear = uncheck all + reset Hide (tag-scoped).

---

## Persistence model

| Option | Description | Selected |
|--------|-------------|----------|
| Tag checklist + Hide toggle only | | ✓ |
| Tag filter + VW/Key dropdowns | | |
| All filter state incl. search text | | |

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage (across sessions) | Survives restarts, per-user keyed | ✓ |
| sessionStorage (this session only) | | |
| Firestore (per-user, synced) | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Independent per surface | Picker/panel separate memory | |
| Shared single state | One tag filter everywhere | ✓ |

**User's choice:** Persist tag checklist + Hide toggle only; localStorage across sessions (per-user); SHARED single state across picker + Songs panel (tradeoff accepted).

---

## Delete-confirm scope (item 4)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm ALL element removals | Includes empty rows | ✓ |
| Keep populated-only (D-14 as-is) | | |
| Confirm all except truly-empty default slots | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse D-14 modal, generic wording | | ✓ |
| Reuse modal, distinct empty-vs-populated copy | | |
| Lightweight inline confirm for empty | | |

**User's choice:** Confirm ALL element removals including empty rows; reuse D-14 modal with generic wording.

## Claude's Discretion

- Parser implementation details; tag checklist layout/sort order; localStorage key naming + per-user scoping derivation; search result ordering; store vs composable for shared tag-filter state.

## Deferred Ideas

None — discussion stayed within phase scope.
