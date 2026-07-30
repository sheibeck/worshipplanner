# Plan 31-06 Summary — Phase gate: emulator evidence, deferred deploy, deferred human verify

**Completed:** 2026-07-30
**Requirements:** R036, R037, R038 (gate only — no source code in this plan)

## Task 1 — Emulator gate: PASS

`src/rules.test.ts` — **96/96 passing** against the live emulator, covering both rule blocks: the
`/services` draft lock with its export and reopen carve-outs, and `/slideGroups` gated on its parent
service. Independently re-run by the verifier as part of 32 purpose-written probes (15 of them
emulator-backed), all passing.

`npm run test:rules` could not be used as written — `firebase emulators:exec` fails with
`Port 8080 is not open ... could not start Firestore Emulator` because the owner has an emulator
running. Ran `npx vitest run --config vitest.rules.config.ts` directly against it instead: same rules
file, same emulator, same assertions, scoped to projectId `test-project` while the app uses
`worship-planner-bc515`, so the owner's data was never touched.

## Task 2 — Deploy: DEFERRED by the owner, recorded

Owner instruction, 2026-07-30: *"We have the emulator so firebase rules should be able to be just
local for now until we're all done working. We can deploy to production at a later date."*

Recorded as **ROADMAP backlog Phase 999.3**, marked REQUIRED before v1.4 ships. Nothing was deployed.

**The state this leaves, stated plainly:** with `VITE_USE_EMULATORS=true` the dev app runs against the
emulator and **all three enforcement layers are live locally**. In **production** only two are — the UI
gate and the store guard — because `firestore.rules` deploys separately from the app bundle. Until
999.3 runs, a browser console can still write to a locked service in production.

## Task 3 — Human verification: DEFERRED, NOT PERFORMED

The owner is away under the standing autonomy grant in `.planning/STATE.md`, which directs skipping
human-verify checkpoints and doing them together on their return. **No item was performed and none is
recorded as passed.**

**30 checks** are queued in `.planning/PENDING-VERIFICATION.md`: 12 from the original plan, 5 added by
wave 3, 5 by wave 4, 2 by wave 5, and 6 by the review-fix pass. The file opens with the two setup facts
needed to make local verification meaningful (the `VITE_USE_EMULATORS` flag; rules not in production).

The one to run first is **31.29** — confirm a refused second export leaves no orphaned Planning Center
plan. No unit test can observe that, and it touches an external system.

## Task 4 — This summary

## Phase state at the gate

| Gate | Result |
|---|---|
| `npm run type-check` (`vue-tsc --build`) | clean |
| Full unit suite | 1896 passing; 9 failures across exactly 2 files, both documented baseline |
| Rules vs. live emulator | 96/96 |
| Verifier probes | 32/32 (17 component, 15 emulator), probe files deleted, tree clean |
| Must-haves | 36/36 on automated evidence, 0 failed |

## Why the phase completes at `human_needed`, not `passed`

Three things are outstanding, all disclosed rather than waived:

1. The rules layer is emulator-verified and **not deployed** (Task 2).
2. **30 human checks are deferred** (Task 3).
3. Two findings the verifier surfaced on its third pass are routed to human decision rather than fixed —
   see below.

Under the autonomy grant, *skip* means **defer and disclose**. Marking this `passed` would assert a
verification nobody performed, so the phase completes with the gate explicitly open.

## Findings routed to human decision (not defects, not fixed)

- **★ A `ServiceLockedError` autosave refusal silently discards in-flight typing.** Reproduced by the
  verifier: the field reads `""` after typing while the message says *"…try again"*. The discard is
  deliberate (`ServiceEditorView.vue:2071-2077`) — on a lock error the write can never land, so
  reverting to the persisted state is correct. **The copy is the misleading part**, and this is
  squarely Phase 32's territory (R039-R041, save reliability and status). Carried forward.
- **The accepted `serviceId`-forgery residual is real** — reproduced against the emulator. Correctly
  analysed in `31-RESEARCH.md` (an attacker must already be an org editor who could delete the service
  outright), but `firestore.rules:106-108` documents the immutability fix without noting the create
  side is deliberately unclosable. Comment gap, not a rule gap.

## Dead code confirmed

`serviceStore.assignSongToSlot` is dead after ME-02 removed its only production caller. Recorded rather
than deleted, per the `isSlotPopulated` precedent — removing an exported store action deserves its own
deliberate change. `toggleStatus`, `isExportedLocked` and `NewServiceDialog`'s private `nextSunday()`
were all deleted cleanly; nothing else was orphaned.
