---
phase: 31
plan: 05
subsystem: service-lifecycle
tags: [R038, D-12, D-13, D-14]
requires: [31-04]
provides:
  - "utils: nextFreeSunday(from, takenDates, maxWeeks) — pure, forward-only, bounded Sunday walk"
  - "utils: the strictly-forward Sunday convention is now stated once, in a comment, and pinned by test"
  - "component: NewServiceDialog takes an optional takenDates prop and has a single date source"
  - "component: NewServiceDialog has a test file at all — it had none before"
  - "view: ServicesView.takenServiceDates feeds the dialog from the list it already subscribes to"
affects: [31-06]
tech-stack:
  patterns:
    - "a new date helper goes INSIDE quarterDates.ts so it reuses the module-private fmtDate instead of forking a copy"
    - "withDefaults(defineProps<...>(), { takenDates: () => [] }) — additive prop with a safe default so existing mount sites are untouched"
    - "pure date helpers take `from: Date` rather than reading the clock; the component supplies new Date() at the call site"
key-files:
  created:
    - src/components/__tests__/NewServiceDialog.test.ts
  modified:
    - src/utils/quarterDates.ts
    - src/utils/__tests__/quarterDates.test.ts
    - src/components/NewServiceDialog.vue
    - src/views/ServicesView.vue
    - .planning/PENDING-VERIFICATION.md
decisions:
  - "Strictly-forward Sunday convention chosen (a Sunday `from` yields the FOLLOWING Sunday), because D-13 requires the fallback to degrade to exactly the pre-R038 behaviour"
  - "NewServiceDialog's private nextSunday() DELETED rather than kept as the fallback — the bound and the fallback both live inside nextFreeSunday, so there is one date source, not two"
  - "takenDates is a prop from ServicesView (RESEARCH § R038 wiring), not a store read (PATTERNS §8's general dialog convention) — the trade was made to keep the component Pinia-free and testable"
  - "Signature takes Iterable<string> rather than ReadonlySet<string>, so the view can pass its array without building a Set at the call site"
metrics:
  duration: ~40m
  completed: 2026-07-30
  tasks: 4
  commits: 3
  tests_added: 27
status: complete
---

# Phase 31 Plan 05: The next-free-Sunday default Summary

Creating a service now defaults its date to the nearest **future** Sunday that has no plan yet
(R038) — forward-only (D-12), bounded at 52 weeks with a never-blank fallback (D-13), fed by a
`takenDates` prop from the view that already subscribes to the service list (D-14).

## What shipped

| Task | Change | Commit |
|---|---|---|
| 1 | `nextFreeSunday` added inside `src/utils/quarterDates.ts` + 14 tests | `3e6b6fa` |
| 2 | `NewServiceDialog` takes `takenDates`, drops its private `nextSunday()`; `ServicesView` passes `takenServiceDates` | `3ed7ff4` |
| 3, 4 | `src/components/__tests__/NewServiceDialog.test.ts` — new file, 13 tests, including the team side effect | `968f213` |

Tasks 3 and 4 shipped in one commit: Task 3 is an assertion inside the file Task 4 creates, and
there is no way to commit the assertion before the file that holds it.

## ★ The 7-day divergence, resolved

Two Sunday conventions existed in this codebase and disagreed by a week on a Sunday:

- `NewServiceDialog.nextSunday()` — `day === 0 ? 7 : 7 - day`, i.e. **strictly forward**, never today.
- `generateSundaysInQuarter` — `(7 - d.getDay()) % 7`, i.e. **on or after**, which yields *today*.

**Strictly forward wins**, and that choice is now stated in a comment above `nextFreeSunday` that
names D-13 as the reason: D-13 requires the exhaustion fallback to "degrade to exactly the behaviour
that exists now", and the behaviour that existed was `nextSunday()`'s. The comment explicitly tells a
future reader NOT to unify the two advances without re-reading D-13, because
`generateSundaysInQuarter`'s "on or after" is correct for *its* job (a quarter's first Sunday) and
wrong for this one.

Both conventions are pinned by tests that run *on* a Sunday — `nextFreeSunday(new Date(2026, 7, 30))`
→ `2026-09-06` at the util level, and a dialog mounted with the clock set to Sunday 2026-08-30 at the
component level. The two do not coexist unreconciled: there is one call site for each and a comment
joining them.

## Why the function went inside `quarterDates.ts`

`fmtDate` (`quarterDates.ts:4`) is a module-private `const`. A new sibling file could not import it
and would have written a fourth copy of the same six-line formatter — copies one and two being
`NewServiceDialog.vue:142-145` and `ServicesView.vue:205-209`. That is the duplication that produced
Phase 30's four-way scripture-formatter drift and two review findings.

Net formatter count actually went **down**: the new function reuses `fmtDate`, and deleting
`NewServiceDialog`'s `nextSunday()` removed copy one. `ServicesView`'s `todayStr`/`rotationServices`
copies were left alone — out of this plan's scope, and touching them would have put unrelated churn
in a wave-5 commit.

## ★ The team side effect is real, deliberate, and tested

`sundayOrdinal()` derives which Sunday-of-the-month a date is, and the default TEAM selection is
derived from that (1st → Orchestra + Communion, 3rd → Choir, otherwise none). Changing the default
date therefore changes the default teams. This is a **visible behaviour change beyond R038's
wording** — flagged in RESEARCH, and now nailed down rather than left to surface in UAT:

- `2026-08-30` (5th Sunday → no teams) taken ⇒ default becomes `2026-09-06` (1st Sunday) and the
  emitted payload carries `['Orchestra', 'Communion']`.
- `2026-09-13` (2nd Sunday → no teams) taken ⇒ default becomes `2026-09-20` (3rd Sunday) and the
  payload carries `['Choir']`.

Each pair asserts the un-skipped baseline first, so the test proves the *skip* caused the change
rather than merely observing a team list. A third test checks the rendered checkboxes, not just the
emitted payload, so the user-visible state is covered too. A human judgement call remains — whether
those teams are the ones you actually want for the skipped-to date — and it is filed as **31.23**.

## Verification

**Plan gate 1** — `npx vitest run src/utils/__tests__/quarterDates.test.ts
src/components/__tests__/NewServiceDialog.test.ts`:

```
✓ src/utils/__tests__/quarterDates.test.ts (22 tests)
✓ src/components/__tests__/NewServiceDialog.test.ts (13 tests)
Test Files  2 passed (2)     Tests  35 passed (35)
```

(22 = 8 pre-existing + 14 new; 13 all new. 27 tests added.)

**Plan gate 2** — `npx vue-tsc --noEmit -p tsconfig.app.json`: **clean, no output.**

**Plan gate 3** — full suite, `npx vitest run`:

```
Test Files  2 failed | 70 passed (72)
     Tests  9 failed | 1880 passed (1889)
```

The two failing files are exactly the documented baseline — `src/storage.rules.test.ts` (needs the
Storage emulator) and `src/views/__tests__/RosterView.test.ts`. **No new failing file.** Passing
count moved 1853 → 1880, which is precisely the 27 tests this plan added, so nothing was displaced
or silently skipped.

**Lint** — `npx eslint` on all five touched source/test files: clean (the only output is the
repo-wide `eslint-plugin-oxlint: could not find oxlint config file` notice, present on every run).
Lint was scoped to touched files; no project-wide `--fix` was run.

**Rules** — `firestore.rules` was not touched this wave, so `npm run test:rules` was not re-run.
31-02's 96 green tests still describe the current file.

## One thing the plan's gate does not cover, reported honestly

`npx vue-tsc --build` (the `npm run type-check` script, which includes the test tsconfig that
`-p tsconfig.app.json` omits) reports **5 errors, all in `src/components/__tests__/ScriptureInput.test.ts`**
(`TS2339: Property 'value' does not exist on type 'VueNode<Element>'`, lines 118-142). That file was
last touched by Phase 30 (`71bb770`) and is untouched by this plan — a pre-existing baseline, not a
new defect. It is recorded here because the plan's stated gate (`-p tsconfig.app.json`) does not see
it, and a future wave running `npm run type-check` should not mistake it for its own. This plan's new
test file casts DOM elements explicitly (`.element as HTMLInputElement`) and contributes no such
error.

## Deviations from plan

**1. [Plan discretion] Signature is `nextFreeSunday(from, takenDates: Iterable<string> = [], maxWeeks = 52)`.**
The plan wrote `takenDates: ReadonlySet<string>` and prefixed the signature with "roughly". `Iterable`
accepts both the array `ServicesView` already has and a `Set`, without forcing a `new Set()` at the
call site; a `ReadonlySet` still type-checks and is covered by a test. Parameter order, purity and the
default bound are exactly as planned.

**2. [Documented conflict] `takenDates` is a prop, contradicting `31-PATTERNS.md` §8.**
PATTERNS §8 recommends the opposite — "`useServiceStore()` inside `NewServiceDialog.vue` matches the
dominant convention". `31-RESEARCH.md` § "Wiring — prop from `ServicesView`, not store access in the
dialog" argues the other way and the plan's must-haves mandate the prop. The prop was implemented, per
the plan. The trade is recorded so it is not re-litigated: the dialog stays Pinia-free, which is what
made this file's first-ever test cheap to write; the cost is one prop on the single mount site. (The
executor brief cited "§6" for the prop-drilling convention; §6 is the Firestore-rules test precedent —
the wiring argument is RESEARCH's, and §8 leans the other way. Noted for accuracy, not as a blocker.)

**3. [Task grouping] Three commits for four tasks.** Tasks 3 and 4 are one commit, as explained above.

No Rule 1/2/3 auto-fixes were needed — nothing was found broken en route. No architectural (Rule 4)
question arose.

## Deferred to human verification

Appended to `.planning/PENDING-VERIFICATION.md` under Phase 31 as **31.23** (the team side effect seen
with real data — the product judgement a unit test cannot make) and **31.24** (opening the dialog on a
real Sunday, and the never-blank fallback). **Neither was performed. Neither is recorded as passed.**
Pre-existing item 31.12 already covers the basic "skips to the third Sunday" check.

## Not in this wave

The phase verification pass (31-06). `ServicesView`'s two remaining inline date formatters
(`todayStr`, `rotationServices.fmt`) were deliberately left in place.

## Self-Check: PASSED

All three commits (`3e6b6fa`, `3ed7ff4`, `968f213`) resolve in `git log`. Every file this summary
claims to have created or modified exists on disk with the claimed changes:
`src/utils/quarterDates.ts` exports `nextFreeSunday`, `src/components/NewServiceDialog.vue` imports it
and no longer defines `nextSunday`, `src/views/ServicesView.vue` binds `:taken-dates`, and
`src/components/__tests__/NewServiceDialog.test.ts` exists with 13 passing tests.
