---
type: enhancement
status: done
created: 2026-07-08
source: user-request (during phase 14 execution)
area: src/components/EditVolunteer (roster edit UI)
---

# Convert Edit Volunteer screen to a right-side slideout drawer

**Request:** User likes the right-side slideout editing pattern (the Variant A
availability drawer built in Phase 14, Plan 14-05 `AvailabilityDrawer.vue`).
They want the **Edit Volunteer** screen converted from its current form/modal to
the same right-side slideout, to save space and avoid scrolling to find the edit screen.

**How to apply:** Reuse the drawer shell/pattern from `AvailabilityDrawer.vue`
(Phase 14, Plan 05) for consistency. Find the current Edit Volunteer component
(roster edit) and reshape it into a right-anchored slideout.

**Status:** Out of Phase 14's planned scope. Do as a follow-up after Phase 14
build waves complete.
