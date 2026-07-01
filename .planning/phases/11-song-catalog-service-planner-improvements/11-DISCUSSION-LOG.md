# Phase 11: Song Catalog & Service Planner Improvements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 11-song-catalog-service-planner-improvements
**Areas discussed:** Tagging system, Search/metadata/sorting, Planner song picker, Edit reliability & safety

---

## Tagging System

### Tag storage
| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated `tags` field | Add `tags: string[]`, user-controlled, import-safe | ✓ |
| Reuse `teamTags` | No schema change but pollutes team filtering | |
| Reuse `themes` | Thematic but PC re-import can overwrite | |

**User's choice:** New dedicated `tags` field.

### Tag filter direction
| Option | Description | Selected |
|--------|-------------|----------|
| Hide-by-tag only | Exclude songs carrying a tag | |
| Both hide and show-only | Exclude AND include/show-only | ✓ |

**User's choice:** Both hide and show-only (in song list AND planner search).

### Tag editing surfaces
| Option | Description | Selected |
|--------|-------------|----------|
| Editor + inline + bulk | Editor form, inline rows, bulk multi-select | ✓ |
| Editor + inline rows | No bulk | |
| Song editor only | Editor form only | |

**User's choice:** Editor + inline + bulk multi-select.

---

## Search, Metadata & Sorting

### Additional searchable fields
| Option | Description | Selected |
|--------|-------------|----------|
| Add key + notes + tags | Complete "any field" | ✓ |
| Add key + tags only | Skip notes | |
| Just the new tags field | Search already broad | |

**User's choice:** Add key + notes + tags.

### Row metadata display
| Option | Description | Selected |
|--------|-------------|----------|
| Themes + user tags, distinct styles | Both pill types, visually distinct from team tags | ✓ |
| Themes + tags + BPM | Also show BPM | |
| Just add themes pills | Themes only | |

**User's choice:** Themes + user tags pills, distinct styles.

### Sortable columns + default
| Option | Description | Selected |
|--------|-------------|----------|
| All columns, default Title A–Z | Title/Category/Key/CCLI/Last Used sortable | ✓ |
| All columns, default Last Used | Same, default oldest-used first | |
| Title, Category, Last Used only | Subset | |

**User's choice:** All columns sortable, default Title ascending.

---

## Planner Song Picker

### VW-type signal after removing the filter
| Option | Description | Selected |
|--------|-------------|----------|
| Keep badge + soft ranking | Badge + type ranking bonus | |
| Badge only, no ranking | Badge as info, order by rotation/search only | ✓ |
| Remove type influence entirely | No badge emphasis, flat list | |

**User's choice:** Badge only, no ranking influence.

### AI Picks type-awareness
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, stay type-aware | AI weights slot VW type | |
| No, suggest broadly | AI ignores slot type | ✓ |

**User's choice:** No — AI Picks suggest broadly.

### Picker scroll/browsability
| Option | Description | Selected |
|--------|-------------|----------|
| Show all matches, scrollable | Full lists, no slicing | |
| Incremental load-more batching | Intersection-Observer batches like SongTable | ✓ |

**User's choice:** Incremental load-more batching.

---

## Edit Reliability & Safety

### Preview close behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Close never deletes | Close just closes; delete is separate + confirmed | ✓ |
| Keep close-deletes, add confirm | Close still deletes but prompts | |

**User's choice:** Close never deletes. Clarified: the delete button is near the close-preview button causing misclicks; the service-element delete button should have a confirm-delete action.

### Delete-confirmation scope
| Option | Description | Selected |
|--------|-------------|----------|
| Any populated item | Confirm removing any element with content | ✓ |
| Scripture & text only | Only scripture/message | |
| Full-slot removal only | Song-clear stays instant | |

**User's choice:** Any populated item.

### Reorder persistence
| Option | Description | Selected |
|--------|-------------|----------|
| Persist immediately | Save reorder right away, fix snap-back | ✓ |
| Keep debounce, fix integrity | Keep 800ms, guarantee capture | |

**User's choice:** Persist immediately (+ fix snap-back and stuck-dirty autosave).

---

## Claude's Discretion

- Pill colors distinguishing team tags / themes / user tags (dark-mode palette).
- Bulk-tagging UI affordance.
- Whether immediate reorder-save reuses `onSave()` or a lighter persist call.
- SortableJS fix in place vs migrate to `vuedraggable`.
- Firestore backfill/default (`[]`) for new `tags` field.

## Locked (no discussion)

- Item 2 — capture `themes` on Planning Center import (field exists).
- Item 5 — AI suggestions exclude `hidden` songs (fix `suggestAllSongs()` to use non-hidden list).

## Deferred Ideas

None — discussion stayed within phase scope.
