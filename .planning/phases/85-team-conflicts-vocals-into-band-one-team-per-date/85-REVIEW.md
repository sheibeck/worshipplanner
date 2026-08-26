---
phase: 85-team-conflicts-vocals-into-band-one-team-per-date
reviewed: 2026-08-26T21:15:00Z
depth: deep
files_reviewed: 20
files_reviewed_list:
  - src/components/AvailabilityRosterTable.vue
  - src/components/QuarterGrid.vue
  - src/components/RolesConfigPanel.vue
  - src/components/__tests__/AvailabilityDrawer.test.ts
  - src/components/__tests__/MessageComposer.test.ts
  - src/components/__tests__/QuarterGrid.test.ts
  - src/components/__tests__/ReLockNotifyPrompt.test.ts
  - src/components/__tests__/RolesConfigPanel.test.ts
  - src/stores/__tests__/roster.test.ts
  - src/stores/quarters.ts
  - src/stores/roster.ts
  - src/types/roster.ts
  - src/utils/__tests__/messagingRecipients.test.ts
  - src/utils/__tests__/scheduler.test.ts
  - src/utils/__tests__/serviceLockDiff.test.ts
  - src/utils/messagingRecipients.ts
  - src/utils/scheduler.ts
  - src/views/RosterView.vue
  - src/views/__tests__/RosterView.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: fixed
fixed_at: 2026-08-26T21:00:00Z
fix_summary:
  fixed: 3
  skipped: 0
  commits:
    - id: CR-01
      hash: f4c9648e
      files: [functions/src/serviceRoles.ts, functions/src/serviceRoles.test.ts, functions/src/index.ts]
    - id: IN-01
      hash: 97ca9525
      files: [functions/seed-emulator-data.mjs]
    - id: WR-01
      hash: d9800503
      files: [src/components/RolesConfigPanel.vue, src/components/__tests__/RolesConfigPanel.test.ts]
  deploy_required: true
  deploy_note: >-
    CR-01 modifies functions/ (the sendQueuedMessageHandler messaging send path).
    This phase is no longer client-only — a Cloud Functions deploy is required for
    the fix to take effect in production. Not deployed by this fixer run; owner-gated.
---

# Phase 85: Code Review Report

**Reviewed:** 2026-08-26T21:15:00Z
**Depth:** deep
**Files Reviewed:** 20 (plus cross-service consumers of the changed `Role`/`RoleGroup` shape traced outside `src/`)
**Status:** issues_found

## Summary

The core client-side rule rewrite is correct and well-tested. `evaluateGroupCombo` in
`src/utils/scheduler.ts` implements the locked semantics precisely: Band↔Tech mutual
exclusivity, Other combining freely with either, a ≤1 Band-instrument cap with Vocals exempt,
and no new per-vocals cap. The `isVocal` predicate is threaded through both
`isGroupCompatible` call sites (`proposeQuarterSchedule`'s main loop and `propagatePairing`),
so the auto-scheduler and the pairing pull-in path stay in lockstep — verified directly against
`src/utils/__tests__/scheduler.test.ts`, which I ran and confirmed passing (33 tests, including
every case the plan called for: tech+band blocked both directions, tech+other allowed,
band+other allowed, two-instruments blocked, one-instrument+vocals allowed, vocals
multi-person allowed, vocals-folds-into-band-for-Tech-exclusivity, and the propagatePairing
Pitfall-2 case). `QuarterGrid.vue`'s warn badge calls the same `evaluateGroupCombo` with its own
`isVocal`/`roleGroupOf` projections built from `props.roles`, so there is no second divergent
copy of the rule on the client.

The `roster.ts` read-time compat shim is correct: it coerces `group: 'vocals'` docs to
`{ group: 'band', vocal: true }` on every snapshot, issues no `updateDoc`, and the old
reverse (`band` → `vocals`) write migration is fully removed — confirmed by both direct code
reading and by running `src/stores/__tests__/roster.test.ts` (32 tests pass, including the new
shim assertions and an `updateDoc` not-called check). `RolesConfigPanel.vue` no longer offers a
standalone Vocals group option, and a vocal Band role can be created via the new "sing & play"
checkbox at Add-Role time — confirmed by `RolesConfigPanel.test.ts`.

`npm run type-check` (`vue-tsc --build`) is clean and the six directly-relevant test files pass
in full (118/118 tests). Test-fixture migration off the old `'vocals'` team literal is thorough
and correct across all 9 touched test files, including the non-trivial dedup case in
`serviceLockDiff.test.ts` and the deliberately-not-literal-swapped zero-reachable fixture in
`ReLockNotifyPrompt.test.ts`.

However, a deep cross-service trace surfaced one real, silent, production-facing data-integrity
bug: **the server-side messaging recipient resolver (`functions/src/serviceRoles.ts` /
`functions/src/index.ts`) was not updated to match the client's new Role/RoleGroup model**, and
it reads role docs directly from Firestore with no compat shim. For any org that still has a
legacy `group: 'vocals'` role doc (exactly the population this phase's compat shim exists to
support — CONTEXT.md states such data exists in production), a message sent to the "Band" team
will silently under-deliver to that org's vocalists: the composer's client-side "Reaches N
people" estimate (built from `rosterStore.roles`, which the shim coerces to `band`) will count
them, but the actual Cloud-Function send (built from a raw, un-shimmed Admin SDK read whose
`RoleGroup` type still includes `'vocals'` as a distinct team) will not, because `'vocals' !==
'band'` in the raw stored data. See CR-01 below.

## Critical Issues

### CR-01: Server-side messaging recipient resolver was not migrated off the old vocals-as-a-team model — legacy vocalists silently drop out of "Band" team sends

**File:** `functions/src/serviceRoles.ts:26` and `functions/src/index.ts:2950,2959-2963`
**Issue:**

`functions/src/serviceRoles.ts` is an explicitly-documented hand-mirror of the client's pure
recipient resolvers (its own header comment: *"Keep the resolve body in lockstep with the
client originals — a drift would make the server send list disagree with the composer's
'Reaches N' estimate"*). This phase changed the client model (`RoleGroup` narrowed to
`'band'|'tech'|'other'`, vocals folded into Band via a `vocal` flag, and a read-time compat
shim so `rosterStore.roles` always resolves legacy `group:'vocals'` docs to `{group:'band',
vocal:true}`), but did **not** update the server-side mirror:

```ts
// functions/src/serviceRoles.ts:26 — still the OLD 4-team union
export type RoleGroup = "band" | "tech" | "vocals" | "other";
```

`functions/src/index.ts`'s `sendQueuedMessageHandler` re-resolves recipients "from scratch" via
the Admin SDK (by design — the client's stored list is never trusted as the send list), reading
role docs **raw**, with no compat coercion:

```ts
// functions/src/index.ts:2950
const roles = rolesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as PortedRole);
...
// functions/src/index.ts:2959-2963
const selection: RecipientSelection = {
  teams: (message.recipientSelector?.teams ?? []) as RoleGroup[],
  ...
};
const { reachable } = resolveMessageRecipients(assignments, people, selection);
```

`resolveMessageRecipients` (serviceRoles.ts:157) matches purely on `a.group === team` string
equality. For an org with a legacy Firestore role doc still stored `group: 'vocals'` (the exact
data shape this phase's client-side compat shim was built to tolerate — no write migration was
performed, by design), the raw server-side read still sees `group: 'vocals'`. Meanwhile the
composer client-side (`src/utils/messagingRecipients.ts`, fed by `rosterStore.roles`, which IS
shim-coerced) counts that same vocalist as reachable under the "Band" team. Net effect: a
coordinator selects the Band team, the UI shows "Reaches N people" including the vocalist(s),
they click Send, and the actual Cloud Function send silently omits them — because
`selection.teams = ['band']` (the client can no longer even select `'vocals'` — that option was
removed from `MESSAGING_TEAM_LABELS`) never matches the raw doc's `group: 'vocals'`. No error is
raised anywhere; the discrepancy is invisible to the coordinator and only shows up as
"why didn't so-and-so get the email."

I verified there is no compat shim anywhere in the `functions/` read path (`functions/src/
index.ts:2942-2951` is a plain `Promise.all` of raw collection reads) and that
`functions/src/serviceRoles.test.ts` has zero test coverage for a `'vocals'`-group role, so
nothing catches this drift today.

**Fix:** Apply the equivalent read-time coercion in the Cloud Function's role load (mirroring
`src/stores/roster.ts`'s shim), and drop `'vocals'` from the functions-local `RoleGroup` union
now that it is provably dead on the client:

```ts
// functions/src/index.ts, where roles are loaded (~line 2950)
const roles = rolesSnap.docs.map((d) => {
  const data = d.data() as { group?: string; vocal?: boolean; [k: string]: unknown };
  const group = data.group === "vocals" ? "band" : (data.group as RoleGroup);
  const vocal = data.group === "vocals" ? (data.vocal ?? true) : data.vocal;
  return { id: d.id, ...data, group, vocal } as PortedRole;
});
```

and in `functions/src/serviceRoles.ts:26`, narrow the type to match the client
(`"band" | "tech" | "other"`) once the coercion above is in place, so a future accidental
`'vocals'` team string is caught at compile time rather than silently matching nothing.

## Warnings

### WR-01: RolesConfigPanel has no in-app way to fix a role's `group`/`vocal` flag after creation

**File:** `src/components/RolesConfigPanel.vue:163-194`
**Issue:** The per-row edit draft only tracks `{ name, defaultCount }` (`RoleRow` interface,
line 163-166) and `onSaveRole` (line 177-194) only ever writes `{ name, defaultCount }` to
`updateRole`. There is no UI path to change an existing role's `group` or the new `vocal` flag
once it has been created — the "sing & play" checkbox only exists in the Add-Role form. If a
coordinator forgets to check the box when adding a vocals role (or needs to convert an
instrument role to a vocal one, or vice versa), the only in-app recovery is Delete + re-add,
and the Delete confirmation itself warns "Existing assignments to this role across all quarters
will be cleared. This cannot be undone" (line 53) — a destructive, unrecoverable action to fix
what should be a one-checkbox correction. This is technically a pre-existing limitation for
`group` (it was never editable before this phase either), but the phase newly introduces
`vocal` as a field with exactly the same one-way-only limitation, in a phase whose entire
purpose is getting the vocal/band modeling right.

**Fix:** Extend the per-row edit draft to include `group` and (when `group === 'band'`) `vocal`,
mirroring the Add-Role form's fields, and pass them through to `updateRole` on save:

```ts
const roleDrafts = ref<Record<string, { name: string; defaultCount: number; group: RoleGroup; vocal: boolean }>>({})
// ...
await rosterStore.updateRole(roleId, {
  name: draft.name.trim(),
  defaultCount: draft.defaultCount,
  group: draft.group,
  ...(draft.group === 'band' ? { vocal: draft.vocal } : { vocal: false }),
})
```

## Info

### IN-01: Emulator seed data still seeds a legacy `group: 'vocals'` role, never exercising the new band+vocal shape locally

**File:** `functions/seed-emulator-data.mjs:140`
**Issue:** The emulator seed script (not part of this phase's file list, not TypeScript-checked)
still writes `{ id: 'role-vocals', name: 'vocals', group: 'vocals', defaultCount: 1, order: 2 }`
rather than the new `{ group: 'band', vocal: true }` shape `DEFAULT_ROLES` now uses
(`src/types/roster.ts:105`). Functionally this is harmless today — `roster.ts`'s compat shim
coerces it correctly on every client read (`vocal: data.vocal ?? true` defaults to `true` when
absent) — but it means every local emulator run only ever exercises the legacy/coerced code
path, never the "role stored natively as band+vocal:true" path a fresh production org would
actually have, and it is also the same raw shape that would trip CR-01 above if exercised
against a locally-run `sendQueuedMessageHandler`.
**Fix:** Update the seed entry to `{ id: 'role-vocals', name: 'vocals', group: 'band', vocal: true, defaultCount: 1, order: 2 }` to match `DEFAULT_ROLES`, and optionally add one deliberately-legacy `group: 'vocals'` fixture elsewhere in the seed set if exercising the compat path locally is still valuable.

## Fix Status (2026-08-26)

All 3 findings were fixed and committed atomically:

- **CR-01 — fixed (`f4c9648e`):** `functions/src/serviceRoles.ts` narrowed `RoleGroup` to
  `"band" | "tech" | "other"` and gained an exported `coerceLegacyRoleGroup` helper (mirroring
  `src/stores/roster.ts`'s onSnapshot shim). `functions/src/index.ts`'s `sendQueuedMessageHandler`
  now applies that coercion at its one role-load boundary (~line 2950) before feeding roles into
  `resolveServiceRoleAssignments`/`resolveMessageRecipients`, so a legacy `group:'vocals'` doc
  resolves as Band server-side, matching the client's "Reaches N" estimate. Added a regression
  suite in `functions/src/serviceRoles.test.ts` (`coerceLegacyRoleGroup` unit cases + an
  end-to-end case proving a raw `group:'vocals'` doc reaches a person under a `teams:['band']`
  selection). `functions/src/index.ts` build is clean; the full functions suite (594 tests) passes.
  **Deploy required** — see frontmatter `fix_summary.deploy_note`; this fix touches the Cloud
  Function messaging send path and will not take effect in production until deployed.

- **IN-01 — fixed (`97ca9525`):** `functions/seed-emulator-data.mjs`'s vocals seed entry updated
  to `{ group: 'band', vocal: true }`, matching `DEFAULT_ROLES`.

- **WR-01 — fixed (`d9800503`):** Low-effort in scope — extended `RolesConfigPanel.vue`'s per-row
  edit draft to include `group` (a select, mirroring Add-Role) and `vocal` (a checkbox, shown only
  when the row's draft group is Band), persisted via the existing `updateRole` call. Existing and
  new component tests (9 total) pass; the pre-existing "editing a row name…" test's expected
  `updateRole` payload was updated to include the new `group`/`vocal` fields.

**Full gate results after all 3 fixes:**
- Client `npm run type-check` (`vue-tsc --build`): clean.
- Client `npx vitest run` (bare, no `--dir`): 147/149 files, 4358/4359 non-skipped tests pass.
  The only 2 failing files are the documented pre-existing baseline —
  `src/storage.rules.test.ts` (Storage emulator `firestore.exists()` cross-service limitation,
  not a regression) and `src/views/__tests__/RosterView.test.ts` (stale assertion, pre-existing).
  No new failures.
- Functions `npm run build` (`tsc`): clean.
- Functions `npx vitest run` (standalone package, Admin SDK): 594/594 tests pass, including the
  4 new CR-01 regression tests.

---

_Reviewed: 2026-08-26T21:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Fixed: 2026-08-26T21:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
