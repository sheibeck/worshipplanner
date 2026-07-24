---
type: enhancement
status: done
created: 2026-07-08
source: user-request (during phase 14 execution)
area: role display (cross-cutting) — src/stores/roster.ts roles + all role list UIs
---

# Display role lists sorted alphabetically

**Request:** Whenever a list of roles is displayed, sort them alphabetically.

**How to apply:** Prefer a single source-level fix — e.g. an alphabetically
sorted getter (`rolesSorted`) in `src/stores/roster.ts`, or sort in the shared
place roles are read — so every consumer inherits it: the RosterImportModal
position→Role `<select>` (Phase 14 Plan 14-04), the availability drawer/table
(Plans 14-05/14-06), and any other role pickers. Verify no consumer depends on
insertion order.

**Status:** Cross-cutting convention. Do with the Phase 14 follow-up
enhancements after build waves complete.
