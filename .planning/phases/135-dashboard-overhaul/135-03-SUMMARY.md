---
phase: 135-dashboard-overhaul
plan: 03
subsystem: ui
tags: [vue, firestore, onSnapshot, presence, dashboard]

# Dependency graph
requires:
  - phase: 134-editor-presence
    provides: "presence subcollection (organizations/{orgId}/services/{id}/presence), PresenceDoc/isPresenceStale/PRESENCE_STALE_TTL_MS vocabulary, useServicePresence read-shape to mirror"
  - phase: 135-02
    provides: "attention-cards row (Unconfirmed volunteers card) this plan adds the second card into, and the lg:col-span-2 placeholder comment to resolve"
provides:
  - "activePresenceRows pure staleness filter (reuses isPresenceStale)"
  - "usePresenceRollup composable — bounded <=6-service read-only presence fan-out with a nowMs staleness tick"
  - "Currently editing attention card in DashboardView.vue (R418), hide-when-empty + Unconfirmed card col-span expansion"
affects: [dashboard-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only variant of an existing write-capable composable: usePresenceRollup mirrors useServicePresence's onSnapshot read shape and NOW_TICK_MS staleness tick but strips every write path (setDoc/deleteDoc/serverTimestamp/heartbeat/visibilitychange), for a viewer that observes presence without participating in it."

key-files:
  created:
    - src/utils/presenceRollup.ts
    - src/utils/__tests__/presenceRollup.test.ts
    - src/composables/usePresenceRollup.ts
  modified:
    - src/views/DashboardView.vue

key-decisions:
  - "presenceRollup.ts stays a pure PresenceRollupRow[] filter (activePresenceRows), reusing isPresenceStale verbatim rather than re-deriving the TTL comparison — matches the plan's explicit 'do not reimplement staleness' instruction."
  - "usePresenceRollup's window is upcomingServices.value.slice(0, 6) — the feed's own draft-inclusive window, NOT the Planned-only attentionServices window used by useUnconfirmedVolunteers — per 135-CONTEXT.md/135-UI-SPEC.md: a draft service can still be actively edited, so presence should not be Planned-restricted."
  - "The Unconfirmed volunteers card's lg:col-span-2 is now conditional (:class=\"{ 'lg:col-span-2': activeEditors.length === 0 }\") instead of static, resolving Plan 02's inline placeholder comment: it only spans the full row when the presence card is hidden."
  - "On a presence-listener error, the composable maps that service's rows to [] rather than surfacing a banner — matches 135-UI-SPEC.md Widget 3's 'treat as empty/hidden' error state, since presence is a nice-to-have signal, never worth a visible error."

patterns-established:
  - "Read-only fan-out composable variant of a write-capable single-service composable: strip the write path, keep the read shape and staleness tick, generalize the single serviceId to a bounded window via the same per-id listener-map + windowIds diff + version-ref invalidation shape already used by useUnconfirmedVolunteers."

requirements-completed: [R418]

coverage:
  - id: D1
    description: "activePresenceRows pure filter: keeps rows within ttl, drops stale/null/NaN lastSeenMs, empty input -> [], preserves input fields"
    requirement: "R418"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/presenceRollup.test.ts (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "usePresenceRollup composable: bounded <=6-service read-only onSnapshot fan-out over services/{id}/presence, nowMs staleness tick, listener teardown on window/org change and unmount, NO write path (grep-gated)"
    requirement: "R418"
    verification:
      - kind: unit
        ref: "node -e read-only/pure-filter/teardown static-analysis check (plan verify script) — pass"
    human_judgment: false
  - id: D3
    description: "Currently editing card renders active editors read-only, hides entirely when empty, and the Unconfirmed volunteers card expands to lg:col-span-2 when presence is hidden; dashboard writes no presence"
    requirement: "R418"
    verification:
      - kind: unit
        ref: "node -e wiring check (usePresenceRollup wired, lg:col-span-2 conditional present, no write path) — pass"
        status: pass
      - kind: unit
        ref: "npm run type-check — pass"
        status: pass
    human_judgment: true
    rationale: "Visual/interaction correctness (live green dot, row appears/disappears within ~60s of an editor opening/closing a service, col-span reflow at 375px) requires a human looking at two browser sessions against 135-UI-SPEC.md Widget 3 — deferred per autonomous UAT-deferred mode."

# Metrics
duration: 20min
completed: 2026-09-07
status: complete
---

# Phase 135 Plan 03: Editor-Presence Roll-up Card Summary

**Read-only bounded fan-out over Phase 134's per-service presence subcollections, filtered through the shared `isPresenceStale` TTL, surfaced as a hide-when-empty "Currently editing" card that lets the Unconfirmed volunteers card reclaim the full row when nobody is editing (R418).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Pure `activePresenceRows(rows, nowMs, ttlMs)` util in `src/utils/presenceRollup.ts` — filters a flat list of `{serviceId, serviceName, uid, displayName, lastSeenMs}` rows down to non-stale ones via `isPresenceStale` (reused verbatim, never reimplemented) — 6 unit tests (RED then GREEN).
- `usePresenceRollup` composable: for each of the next ≤6 upcoming services (feed's own draft-inclusive window, not Planned-restricted), opens a single READ-ONLY `onSnapshot` on that service's `presence` subcollection, maps docs to rollup rows exactly as `useServicePresence` does, keeps a ~10s `nowMs` tick mirroring `NOW_TICK_MS`, and exposes `activeEditors = activePresenceRows(allRows, nowMs, PRESENCE_STALE_TTL_MS)`. Listeners are torn down on window/org change and unmount. Contains **no** `setDoc`/`deleteDoc`/`serverTimestamp`/heartbeat/`visibilitychange`-write path anywhere — grep-gated in both Task 2 and Task 3 verification.
- "Currently editing" card added to `DashboardView.vue`'s attention-cards row: header, one row per active editor (green pulsing dot, `aria-hidden`, plus "{displayName} is editing {serviceName}" text carrying the meaning) linking to `/services/{id}`, hidden entirely with `v-if="activeEditors.length > 0"` when nobody is editing. The Unconfirmed volunteers card's previously-static `lg:col-span-2` is now conditional on `activeEditors.length === 0`, so it expands to fill the row only when the presence card is absent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure active-presence filter/shape util** — `ba02c1be` (test, RED) → `cd613432` (feat, GREEN)
2. **Task 2: Read-only presence fan-out composable** — `00f5bb13` (feat)
3. **Task 3: Currently editing card + hide-when-empty col-span interplay** — `b6fc2045` (feat)

_Task 1 had multiple commits (test → feat), per its `tdd="true"` frontmatter._

## Files Created/Modified
- `src/utils/presenceRollup.ts` — pure staleness filter, no Firestore/Pinia imports
- `src/utils/__tests__/presenceRollup.test.ts` — 6 unit tests covering all behavior bullets
- `src/composables/usePresenceRollup.ts` — bounded ≤6-service read-only presence fan-out + nowMs tick + lifecycle teardown
- `src/views/DashboardView.vue` — "Currently editing" card, `presenceWindow`/`activeEditors`, conditional `lg:col-span-2` on the Unconfirmed volunteers card

## Decisions Made
- `presenceWindow` reuses `upcomingServices.value.slice(0, 6)` — the feed's own window — rather than the Planned-only `attentionServices` window Plan 02 built for confirmations, since a Draft service can still have an active editor (presence isn't a Planned-only concept).
- Presence-listener errors degrade that service's rows to `[]` (never a visible banner) — matches the UI-SPEC's explicit "treat as empty/hidden" error state for this specific widget, distinct from the generic error copy used elsewhere on the page.
- Resolved Plan 02's inline placeholder comment by making the Unconfirmed card's `lg:col-span-2` conditional instead of static.

## Deviations from Plan
None — plan executed exactly as written. Comment wording in `usePresenceRollup.ts` was adjusted once (Rule 1 — the grep-gate in Task 2's own verify script matched the word "serverTimestamp" inside an explanatory code comment, not just actual code; reworded the comment to describe the same guarantee without the literal token, then re-ran the gate to confirm it passes for the intended reason — no write path exists, not because the word was hidden).

## Issues Encountered
None.

## Deferred UAT

Per `/gsd-autonomous` UAT-deferred mode, Task 3's `<human-check>` (opening a service as an editor in another tab/browser and confirming the dashboard's Currently editing card appears with a live green dot and correct text, disappears within ~60s of that editor closing, and the Unconfirmed card spans the full row when nobody is editing) was **not** run interactively. Code is complete, automated verification (unit tests, type-check, grep-gated read-only/wiring checks) passed, and the plan is treated as complete. Not appended to a DEFERRED-VERIFICATION.md file per the milestone's autonomous-mode instruction for this phase.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

This is the last plan of Phase 135. All five requirements (R414–R419, minus R419 which Plan 01 covered) are now code-complete: R414 (Volunteer coverage removed), R415 (feed), R416 (readiness rollup), R417 (unconfirmed volunteers), R418 (editor presence roll-up, this plan). Phase 135 is ready for phase-level verification/UAT once the milestone resumes interactive checkpoints.

---
*Phase: 135-dashboard-overhaul*
*Completed: 2026-09-07*

## Self-Check: PASSED

All created files verified on disk; all 4 task commit hashes (ba02c1be, cd613432, 00f5bb13, b6fc2045) verified in git log.
