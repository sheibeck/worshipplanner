# Plan 31-02 Summary — The slideGroups lock, and not attempting writes it will reject

**Completed:** 2026-07-30
**Requirements:** R036 (rules layer + client suppression)

## What shipped, in one commit

| Change | File |
|---|---|
| `/slideGroups` rule block with `parentDraft()`/`parentGone()` and an immutable `serviceId` | `firestore.rules` |
| `&& collection != 'slideGroups'` on the catch-all write clause | `firestore.rules` |
| `canWriteSlideGroups` — narrows the composable's `canWrite` to editor **AND** draft | `src/views/ServiceEditorView.vue:1367-1389` |
| 13 rules tests | `src/rules.test.ts` |
| 4 load-time regression tests | `src/views/__tests__/ServiceEditorView.test.ts` |

## Why these could not be separated

Two failure modes, in opposite directions, and each half alone triggers one:

- **Rule without the exclusion** → the catch-all still grants write to `slideGroups`, so the new block
  is a no-op. Same bypass wave 1 closed for `/services`.
- **Exclusion without the rule** → the catch-all was the ONLY rule granting write to `slideGroups`
  (verified: zero occurrences of the collection in `firestore.rules` before this wave), so every
  slide-group write is denied, including on DRAFT services.
- **Rule without the client narrowing** → `useSlideshowAssembly`'s materialization watcher runs with
  `{ immediate: true }`; it writes on service LOAD, no user action. Every locked service would throw
  permission-denied the moment it opened — a worse failure than the one being fixed.

## Suppress, not carve out

The rules layer cannot distinguish a load-time materialization from a user edit, so a carve-out would
have to be "allow any write" — i.e. no lock. Narrowing `canWrite` instead closes all three composable
write sites at their single shared gate.

`canWriteSlideGroups` defaults a missing status to `'draft'`, matching the rule's own
`resource.data.get('status','draft')`, so the two layers agree on legacy documents and a transient
null during load cannot wedge materialization.

## `allow delete` is deliberately more permissive than `allow update`

An orphan (parent service deleted) or a legacy doc with no `serviceId` must stay deletable, or it is
wedged in the database forever with no cleanup path. An earlier research iteration had exactly that
defect. Both cases are asserted.

## Verification

**Rules** — `npx vitest run --config vitest.rules.config.ts`: `src/rules.test.ts` **96 passed, 0
failed** (83 before this wave, +13). Covers update at each parent status, create/materialization,
create without `serviceId`, re-parenting rejection, cascade delete both ways, orphan delete, legacy
no-`serviceId` delete, the catch-all regression, and viewers.

**Client** — `npx vitest run src/views/__tests__/ServiceEditorView.test.ts`: **78 passed, 0 failed.**

**★ Red-before-green confirmed by execution.** With `canWrite` reverted to bare
`computed(() => authStore.isEditor)` and nothing else changed, **3 of the 4 new tests fail**:
`ZERO ... when the service is planned`, `... is exported`, and the reopen case. The draft case passes
in both states, which is the correct result — it asserts the narrowing did not over-reach.

**Full suite** — `npx vitest run --maxWorkers=2`: 1761 passed, 2 failing files, both the documented
baseline (`src/storage.rules.test.ts` needs the Storage emulator; `RosterView.test.ts` stale
assertion). `npx vue-tsc --noEmit -p tsconfig.app.json` clean. Lint on the three touched files: 14 / 19
/ 1 errors — byte-identical to the pre-existing baseline, zero new.

## Deviation from the plan

- **Executed by the orchestrator, not a `gsd-executor`.** The wave-1 executor stalled for ~11 hours
  without committing and four planner/checker agents died to API 529s; its orphaned hook process was
  killed. Waves 1 and 2 were done directly.
- **The reopen test drives `localService` rather than swapping `mockServicesList`.** That mock hands
  `useServiceStore()` the array reference it holds at creation time — its own declaration comment says
  to reassign it *before* `mountView()` — so a post-mount swap cannot reach a mounted view. Mutating
  `localService` is also the closer analogue of the real path, where the store write lands and the
  snapshot updates it in place. Documented inline so the next reader does not "fix" it back.
- **`npm run test:rules` still unusable as-written** — `firebase emulators:exec` fails with "port
  taken" against the owner's running emulator. Tests were run through the same vitest config directly
  against it, scoped to projectId `test-project` (the app's is `worship-planner-bc515`), so the owner's
  data is untouched.

## Not in this wave

The store guard and the status transitions (31-03); the tab gate migration (31-04). After this commit
a locked service's Slides tab still *offers* Add slide and drag while materialization is suppressed —
the source is deliberately out of step until wave 4 closes it. Do not release mid-phase.
