---
phase: 110-architectural-review
plan: 02
subsystem: architecture-review
tags: [review-only, module-boundaries, coupling, data-flow]
dependency-graph:
  requires: []
  provides:
    - 110-FINDINGS-boundaries-coupling-dataflow.md (consumed by 110-03 consolidation)
  affects: []
tech-stack:
  added: []
  patterns:
    - "Review-only executor pass: no sub-agents, self-review reading real source"
key-files:
  created:
    - .planning/phases/110-architectural-review/110-FINDINGS-boundaries-coupling-dataflow.md
  modified: []
decisions:
  - "No Critical/High findings surfaced in module boundaries, coupling, or data flow — every finding lands Medium or Low per the phase's severity rubric, so none require Phase 111 action; all Mediums are backlog-triage candidates."
  - "CONCERNS.md's 'Large monolithic ServiceEditorView' entry (2176 lines, dated 2026-07-16) is stale and under-scoped — live file is 4612 lines with several newer responsibilities (re-lock notifications, congregational editing, stage-marker CRUD, share links, role/messaging overrides) not named in the map."
  - "CONCERNS.md's 'JSON.parse on Firestore snapshots' Fragile-Areas entry is also stale — the current implementation is a hardened own-write-echo-tracked, byte-compare-gated merge, not a naive parse; corrected in ARCH-D-02 rather than re-flagged as still-fragile in its original description."
metrics:
  duration: "~55 min"
  tasks_completed: 3
  files_changed: 1
  completed: 2026-09-02
status: complete
---

# Phase 110 Plan 02: Module Boundaries, Coupling, Data Flow Review Summary

Self-reviewed (no sub-agents, per plan's review_method_note) module boundaries, coupling, and data flow
across `src/**` and `functions/src/**` against live source, producing 16 severity-ranked findings (0
Critical/High, 12 Medium, 4 Low/confirmed) with concrete file:line locations in
`110-FINDINGS-boundaries-coupling-dataflow.md`.

## What Was Reviewed

**Task 1 — Module boundaries:** Spot-checked `.planning/codebase/ARCHITECTURE.md`'s documented
anti-patterns (direct Firestore calls in components, mutating Firestore without a store) against live
source. Confirmed 4 real instances: `ServiceTemplateEditor.vue` writing to Firestore directly instead of
through a store method (ARCH-B-02); `GettingStarted.vue` and `ConfigurationTab.vue` each opening their own
`onSnapshot` listener with no owning store (ARCH-B-03); and `useSlideshowAssembly.ts`'s default lyrics
subscriber duplicating (and already drifting from) `songLyricsStore`'s own query (ARCH-B-04). Also
re-measured `ServiceEditorView.vue` against its own stale map entry — the file has grown to 4612 lines
(script block ~2894 lines) with a dozen distinct feature responsibilities inline, more than twice what
`CONCERNS.md` (2026-07-16) documents (ARCH-B-01). On the backend, found `functions/src/index.ts` (2898
lines) holds five unrelated concerns inline — API proxy, PPTX pipeline, four cleanup sweeps, messaging
pipeline — unlike sibling concerns (`orgProvisioning.ts`, `superAdminClaims.ts`) that were properly
extracted into their own modules (ARCH-B-06).

**Task 2 — Coupling:** Confirmed the ONE documented cross-store write (services → songs `lastUsedAt`)
follows the sanctioned "call storeB's method" pattern correctly (ARCH-C-01, no violation) — but found its
per-song loop has no per-item failure isolation, so a mid-loop failure leaves `lastUsedAt` inconsistent
across a service's songs with only a swallowed console log (ARCH-C-02). Confirmed no circular import
chains across `src/stores/*.ts` (ARCH-C-06). Cross-referenced 110-01's F-LC-06
(`useSlideshowAssembly`/`pptxRenders` fan-in) rather than re-deriving it.

**Task 3 — Data flow:** Traced the service-editor autosave round-trip and found it substantially more
hardened than `CONCERNS.md`'s stale "JSON.parse on Firestore snapshots" entry describes — own-write-echo
tracking and a byte-compare merge guard are both present and correctly gate the remote-merge watcher
(ARCH-D-02, corrects the map). Found a genuine, always-reproducible (if cosmetically low-impact) bug in
the SAME deep-clone idiom: every `localService` clone in `ServiceEditorView.vue` goes through
`JSON.parse(JSON.stringify(...))`, which strips Firestore `Timestamp` instances to plain objects with no
`.toDate()` — making `reopenPcWarning`'s date-formatting branch permanently unreachable dead code
(ARCH-D-01). Found a narrower, still-open race window between the reorder-save path and the remote-merge
watcher's status check (ARCH-D-03). Traced the Planning Center song-import write path
(`upsertSongs`) and found it performs hundreds of unbatched sequential Firestore writes with no
per-song failure isolation, unlike its sibling CSV `importSongs` in the same file which explicitly
chunks via `writeBatch` — though the existing match-by-pcSongId/ccliNumber/title logic makes a retry
idempotency-safe, limiting the impact to UX/performance rather than data corruption (ARCH-D-04).

## Findings Summary

0 Critical, 0 High, 12 Medium, 4 Low/confirmed. Full table with IDs, severities, and locations is in
`110-FINDINGS-boundaries-coupling-dataflow.md`'s Summary Table. All Medium findings are backlog-triage
candidates (per the phase's severity rubric, only Critical/High feed Phase 111 remediation) — this plan
found none.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<verify>` automated checks passed (grep
assertions for section headers, severity tokens, and file-path citations). The `git diff --name-only --
src functions firestore.rules storage.rules` verification confirms zero source/rules files were touched.

## Known Stubs

None — this plan produces a single findings document, no application code.

## Threat Flags

None — review-only plan, no new runtime surface introduced. Per the plan's own threat model (T-110-03,
T-110-04), the findings file itself is an internal `.planning/` artifact with no secrets and no
executable content.

## Self-Check: PASSED

- FOUND: `.planning/phases/110-architectural-review/110-FINDINGS-boundaries-coupling-dataflow.md`
- FOUND commit: `811ccb6` (`git log --oneline --all | grep 811ccb6` matches)
- Verified: `git diff --name-only -- src functions firestore.rules storage.rules` is empty (no source
  modified)
