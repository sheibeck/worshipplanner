---
phase: 31
plan: 03
subsystem: service-lifecycle
tags: [R036, R037, D-01, D-02, D-03, D-04, D-09, D-10, D-11, D-15]
requires: [31-01, 31-02]
provides:
  - "store: markAsPlanned / reopenService / assertWritable / ServiceLockedError"
  - "view: isLocked, canEditService, hasPcExportEvidence, statusLabel, lifecycleError"
  - "view: the lock banner shell (data-testid=service-lock-banner) that 31-04 fills in"
affects: [31-04, 31-05]
key-files:
  modified:
    - src/stores/services.ts
    - src/views/ServiceEditorView.vue
    - src/stores/__tests__/services.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - .planning/PENDING-VERIFICATION.md
status: complete
---

# Phase 31 Plan 03: Status transitions, the store guard, and the failed-transition surface — Summary

The blind three-way status cycle is deleted and replaced by two named, awaited transitions; the
store gained the middle enforcement layer across all three of its write paths; and a rejected
transition now has somewhere to be seen without ever moving the status.

## Commits

| Commit | Task | What |
|---|---|---|
| `6572744` | 1 | Store: draft-only write guard + `markAsPlanned` / `reopenService` |
| `59f8c9d` | 2 | `toggleStatus` deleted; status pill; Mark as Planned; the lock computeds |
| `96b2f62` | 3 | Reopen confirm, the lock banner shell, both `lifecycleError` surfaces |
| `4e7f65c` | 4 | Delete confirm's evidence-gated Planning Center sentence (D-15) |
| `411a311` | 5 | 21 view tests, two of them red-checked against the defect they catch |

## What the non-negotiables turned into

**`toggleStatus` is gone** (`ServiceEditorView.vue`, was `:1819`), along with its clickable `<button>`
badge branch and the `:135` tooltip that told the user to "cycle badge back to Draft". The
pre-existing viewer `<span>` is now the pill for everyone — a deletion, not a rewrite, so its
`px-2 py-0.5` is untouched and `statusBadgeClasses` is reused verbatim. There is no client path from
any status to `exported` any more; the Planning Center export write is the only one.

**`:134` kept its other two terms.** It is now
`:disabled="!hasSermonContext || aiSuggestingAll"`. A test pins this: Suggest All Songs is still
disabled with no sermon context, and its `title` no longer mentions the deleted control.

**Nothing flips optimistically.** `onMarkAsPlanned` and `runReopen` both await the store action and
call `applyTransitionLocally` only on success. Both red-checked: swapping those two lines fails
2 tests for reopen and 1 for Mark as Planned (see Verification).

**The reopen payload is `status` + `updatedAt`.** Enforced twice — `reopenService` builds no other
key, and a store test asserts `Object.keys(payload).sort() === ['status','updatedAt']` on a service
that DOES carry `pcExportedAt`/`pcPlanId`, so a future "let's also clear the export fields" edit
fails loudly.

**All three store write paths are guarded**, not just `updateService`. `setRoleOverride` and
`clearRoleOverride` carry their own `updateDoc` and now their own guard, with tests in both
directions.

**One `hasPcExportEvidence`**, consumed by the banner body, the reopen dialog and the delete-confirm
sentence. It reads `pcExportedAt || pcPlanId`, never the status string — a test mounts a `planned`
service carrying evidence (E10, the reopened-then-re-planned case) and asserts it still gets the
dialog, and another mounts a legacy `exported` service with no evidence and asserts one-click reopen
with no "Planning Center" text anywhere.

**The banner shipped in this wave**, as the plan directed, because `lifecycleError` needs a host that
renders while locked. It is the full § 1 markup — `sticky top-0 z-10`, opaque `amber-950`,
editor-only, outside all three `v-show` tab panels so "exactly one" is structural. 31-04 fills in the
read-only tab renderings beneath it.

## Decisions taken inside Claude's discretion

**The guard throws; it does not silently return.** `createService`'s `throw` is the in-repo
precedent, and a swallowed write is indistinguishable from a successful one to the caller — the
"it didn't save" class. This introduces no new failure mode for any caller: since 31-01 these exact
writes already rejected at the rules layer, so the guard only makes the rejection immediate and
legible (`ServiceLockedError`, message naming R036 and the stored status).

**The guard mirrors the rule, shape for shape** — `storedStatusOf` (with the same
`?? 'draft'` legacy default as `resource.data.get('status','draft')`), `isExportWrite`,
`isReopenWrite`. It deliberately does not invent a fourth policy: divergence would give either a
phantom lock or an opaque round-trip failure.

**`deleteService` stays unguarded** (D-15), in step with the rule's unconditional `allow delete`.
Tested at all three statuses so a future "tidy-up" cannot quietly add a condition on one side only.

**`isExportedLocked` was left in place.** 31-04 owns the five-class gate migration; deleting the
computed now would have forced that migration into this wave. Both computeds coexist for one wave.

## Deviations from the plan

### Rule 1 — the export write left the document dirty, and the autosave then attacked it

Not in the plan, found while tracing which paths reach `updateService`. `onConfirmExport` set
`localService.pcExportedAt/pcPlanId/status` after its store write but never touched
`originalService`. So `isDirty` stayed true, and the autosave watcher fired a **full-document**
`onSave` roughly 800ms after every export — against a service whose stored status had just become
`exported`. Since 31-01 that write is denied by the rules layer; with this wave's guard it would also
throw locally. Fixed by mirroring the three fields into the clean snapshot. Committed with task 2.

### Rule 2 — the draft→planned `lastUsedAt` bump would have become dead code

`onSave` bumped songs' `lastUsedAt` on `originalService.status === 'draft' && data.status ===
'planned'`. Status no longer moves through `onSave`, so that branch became unreachable — it would
have looked live while silently never firing again, quietly ageing songs never. Extracted to
`bumpScheduledSongsLastUsed()` and called from `onMarkAsPlanned`.

★ It runs **before** the status write, deliberately: it goes through `assignSongToSlot`, which writes
`slots` to the service — legal while the stored status is still draft and refused the instant it is
`planned`. Ordering it the other way would have made Mark as Planned fail on any service with songs.

### Rule 2 — pending edits are flushed before the lock

`onMarkAsPlanned` awaits `onSave()` first when `isDirty`. Without it, a user typing when they click
Mark as Planned would have their in-flight autosave land after the lock and be refused, losing what
they last typed. Verification item 31.16 records the manual check.

### The delete-confirm date lost its `<span class="text-gray-200">`

31-UI-SPEC § 3 asks for a `deleteServiceConfirmBody` computed rendering plain text, which its own
code block shows. Following it flattens the existing inline markup that highlighted the date. Called
out here because it is a (small) visual change the spec sanctions rather than an oversight.

### Autonomy

No checkpoint was reached. Five verification items that automated tests cannot honestly cover
(31.13–31.17) were appended to `.planning/PENDING-VERIFICATION.md` under the existing Phase 31
heading — the pill being inert, both failed-transition surfaces, the post-export quiet window, the
dirty-then-lock case, and the `lastUsedAt` bump. **None is recorded as passed.**

## Verification

**Store** — `npx vitest run src/stores/__tests__/services.test.ts`: **48 passed, 0 failed**
(26 before, +22).

**View** — `npx vitest run src/views/__tests__/ServiceEditorView.test.ts`: **99 passed, 0 failed**
(78 before, +21).

**★ Red-before-green, confirmed by execution.** Moving `applyTransitionLocally` from after the await
to before it:

| Change | Result |
|---|---|
| `runReopen` flips first | **2 tests fail** — the ★ rejected-Reopen contract and the error-clearing test |
| `onMarkAsPlanned` flips first | **1 test fails** — the ★ rejected Mark as Planned contract |

Both reverted; the suite is green at HEAD and `git diff` on `ServiceEditorView.vue` was confirmed
empty afterwards.

Removing the store's role-override guards and the `markAsPlanned` guard fails 4 store tests. The
`updateService` guard's own red check could not be completed — the test command was blocked by the
sandbox classifier mid-check — but those tests assert both `rejects.toThrow(/R036/)` **and**
`expect(updateDoc).not.toHaveBeenCalled()`, which cannot both hold without the guard.

**Full suite** — `npx vitest run --maxWorkers=2`: **1801 passed**, 2 failing files, both the
documented baseline (`src/storage.rules.test.ts` needs the Storage emulator; `RosterView.test.ts`
stale assertion). **Zero new failures.**

**Types** — `npx vue-tsc --noEmit -p tsconfig.app.json` clean.

**Lint** (scoped to touched files only): `src/stores/services.ts` clean;
`src/stores/__tests__/services.test.ts` 2 errors and
`src/views/__tests__/ServiceEditorView.test.ts` 19 errors — both byte-identical to the pre-existing
baseline recorded in 31-02-SUMMARY. The three new store-mock spies were written as
`vi.fn<(id: string) => Promise<void>>(...)` specifically to avoid adding five more
`no-unused-vars` errors of the class already endemic to that file.

**Rules** — `firestore.rules` was not touched this wave, so `src/rules.test.ts` was not re-run. Its
96 green tests from 31-02 still describe the current file.

## Not in this wave

The tab-by-tab gate migration and the read-only tab renderings (31-04), and R038's Sunday default
(31-05). **The source is deliberately out of step until 31-04 lands:** a locked service now shows the
banner and refuses writes at three layers, but the Service Order, Slides and Roles tabs still *offer*
controls that will now fail loudly instead of silently. Do not release mid-phase.

## Self-Check: PASSED

All five commits resolve in `git log`, and every file this summary claims to have created or
modified exists on disk.
