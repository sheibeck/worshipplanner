# Phase 89: Multi-Role Scheduling — Research

**Researched:** 2026-08-27
**Domain:** Deterministic scheduling algorithm design (internal `src/utils/scheduler.ts`) + a per-role flag rename ripple across the roster/quarter model
**Confidence:** HIGH (whole design derived by reading the exact source that ships today; no external dependencies)

## Summary

This is a codebase-internal algorithm-design phase, not a library-integration one. There is **nothing to install** and **no external API** — the entire "research" is (a) a precise map of every consumer of the Phase-85 `Role.vocal` flag that the R259 rename touches, (b) the exact new `evaluateGroupCombo` predicate, and (c) a concrete, order-independent design for the R260 same-date bundling weight built as a `propagateMultiRole` pass that mirrors the existing `propagatePairing`.

The central finding for Part B is that **the owner's "anchor on the rarest multi-role" behavior emerges for free from the existing `withinCadence` even-spread gate — it does not require sorting roles by rarity or perturbing the deficit scoring.** Because a rarer role (higher `n`) passes its `withinCadence` gate only on a sparse, evenly-spaced subset of the dates a denser role passes it on (both counters start at 0 and advance monotonically with `dateIndex`), a person's rare-role serve-dates are always a subset of their common-role serve-dates. If we trigger bundling from *every* multi-role assignment and gate each pulled role by its *own* `withinCadence` + slot capacity, the pulls are commutative and cadence-bounded, so the final bundle on any date is identical regardless of the template's role-iteration order. That gives determinism, rarity-anchoring, and the coverage-bounded "fills solo rather than empty, never exceeds cadence" guarantee in one mechanism.

The second material finding is a **deploy de-risk**: unlike Phase 85 (which narrowed `RoleGroup` and changed server-side team matching), Phase 89 does **not** change the group model and the `vocal`/`multiRole` flag is **never read in server logic** (`functions/src/serviceRoles.ts` carries it for shape parity only). So **no owner-gated Cloud Functions deploy is required**.

**Primary recommendation:** Rename `Role.vocal` → `Role.multiRole`; rewrite `evaluateGroupCombo` to *filter out multi-role roles first, then apply the existing Band↔Tech + ≤1-instrument rule to the remainder*; and add a non-recursive `propagateMultiRole(personId, date, dateIndex)` pass invoked after every multi-role assignment in both the main loop and `propagatePairing`, gated by the same `withinCadence` + capacity checks. Skip the server edit (or do a parity-only rename with no deploy).

<user_constraints>
## User Constraints (from 89-CONTEXT.md)

### Locked Decisions

**R259 — the multi-role flag + co-occurrence rule**
- Generalize `Role.vocal` → a per-role multi-role flag (name is planner's discretion within the owner's "multi-role" intent; candidates `multiRole`, `combinable`). Settable on ANY role in ANY group (not Band-only).
- Vocals ships with the flag ON by default — the generic flag REPLACES the Phase-85 vocals-specific exemption (no more special-casing vocals in the rule).
- Helper text on the control, e.g.: *"Multi-role: this person can serve this role alongside their other roles on the same date, and the scheduler tries to put their roles on the same day (e.g. sing + play bass + lead together) instead of spreading them out."*
- New co-occurrence rule (generalize `evaluateGroupCombo`): a multi-role role NEVER causes a conflict — it may co-occur with anything, crossing Band/Tech/Other. Concretely: filter the person's roles for a date down to the NON-multi-role ones, then apply the EXISTING rule to just those — Band↔Tech mutually exclusive, ≤1 Band **instrument**. So: sing (multi) + one instrument = OK; sound (tech) + sing (multi) = OK (cross-type); guitar + drums (both non-multi band) = still blocked; sound + guitar (both non-multi, cross-type) = still blocked. Non-multi-role roles keep the normal one-role-per-date exclusivity.
- The rule stays in the ONE shared pure function consumed by `proposeQuarterSchedule` (main loop + `propagatePairing`) AND `QuarterGrid.vue`'s warn badge — do not fork it.

**R260 — same-date bundling weight**
- Anchor on the person's RAREST multi-role. The lowest-cadence multi-role sets the bundling dates; the person's higher-cadence multi-role roles ride along on those dates AND fill their extra occurrences on other days.
- Riding along consumes cadence — a bundled assignment counts toward that role's 1-in-N cadence like any other.
- Strong preference, coverage-bounded ("more hard than soft"). When it can't bundle (e.g. the person is the only bassist that week but already at their vocals cap), the role is still filled solo rather than left empty, and NO role ever exceeds its per-role cadence cap. It yields to other people's cadence/availability and to coverage.
- Cross-type bundling is unrestricted — any of a person's multi-role roles may be bundled regardless of group; there are no forbidden auto-bundle pairings.
- Closest existing analog: `propagatePairing`. Multi-role bundling is the same shape but co-schedules a single person's other multi-role roles instead of a partner. Extend/parallel that path (and its `withinCadence` gate + slot-capacity checks), NOT a second divergent scheduling pass.

**Phasing / dependencies**
- Depends on Phase 88 (the RoleSlideOver that surfaces the flag control). Phase 88 keeps the current `vocal` Band-only checkbox as-is; Phase 89 renames/generalizes it (label → "Multi-role", show for any group, add helper text, vocals default-on).
- The flag rename ripples through `src/types/roster.ts`, `src/utils/scheduler.ts`, `src/stores/roster.ts`/`quarters.ts`, `RolesConfigPanel.vue`/RoleSlideOver, `QuarterGrid.vue`, and the read-time `group:'vocals'` compat shim. If `functions/src/serviceRoles.ts` references the vocal/group model, update it too — that would carry an owner-gated Cloud Functions deploy (like Phase 85's).

### Claude's Discretion
- The flag NAME (within the owner's "multi-role" intent).

### Deferred Ideas (OUT OF SCOPE)
- None specific.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R259 | Generalize the vocals "sing & play" exemption into a per-role multi-role flag settable on any role in any group (vocals ON by default; helper text). Multi-role roles may co-occur crossing Band/Tech/Other; non-multi roles keep one-role-per-date exclusivity and the ≤1-Band-instrument cap. | Part A: exact rename consumer list; new `evaluateGroupCombo` predicate + edge cases; RoleSlideOver/RolesConfigPanel changes; compat-shim update; server no-op finding. |
| R260 | The scheduler weights a person's multi-role assignments onto the same date — anchored on the rarest multi-role, higher-cadence roles riding along and filling extras elsewhere — a strong preference that yields to coverage and per-role cadence caps. | Part B: `propagateMultiRole` pass design; emergent rarity anchoring via `withinCadence`; commutativity/determinism proof; pitfalls; canonical test fixture. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Type-check gate is `npm run type-check`** (`vue-tsc --build`, which typechecks test files too), NOT `vue-tsc --noEmit -p tsconfig.app.json`. The rename touches many `.ts`/`.vue` files plus their tests; the phase is only type-clean when `npm run type-check` passes. `-p tsconfig.app.json` silently skips tests and will hide errors in the renamed test fixtures.
- **App unit suite = bare `npx vitest run`** (excludes `src/rules.test.ts` and `render-service/**`). Do not use `--dir src` (it bypasses the `vite.config.ts` excludes). This phase's tests all live in the app suite.
- **Known-failing baseline (pre-existing, do not chase):** `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` (stale assertion). Note `RosterView.test.ts` fixture at line 22 uses `vocal: true` — the rename will require editing that fixture, which may or may not resolve the stale assertion; treat the *stale assertion* itself as out of scope unless the rename edit trivially fixes it.
- **Cloud Functions deploy policy:** Claude may deploy but must confirm with the owner per-deploy. See the deploy finding below — this phase does **not** require a functions deploy.
- `.env.local` required for emulator/tests/build (not relevant to the pure scheduler unit tests, which import no Firebase config, but relevant if any touched component test loads Firebase).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-role flag storage | Database (Firestore `organizations/{org}/roles`) | — | The flag is a per-role config field, persisted with the role doc. |
| Flag read/normalization | Frontend store (`roster.ts` onSnapshot shim) | — | Single read boundary that coerces legacy shapes; every consumer reads the normalized `roles`. |
| Co-occurrence rule | Pure util (`scheduler.ts` `evaluateGroupCombo`) | Frontend component (`QuarterGrid.vue` warn badge) | One pure function, two consumers; must not fork (Phase-85 D-10/D-12). |
| Same-date bundling | Pure util (`scheduler.ts` `proposeQuarterSchedule`) | — | Deterministic, framework-free algorithm; unit-tested in isolation. |
| Flag control UI | Frontend component (`RoleSlideOver.vue`) | `RolesConfigPanel.vue` badge | Phase-88 slide-over surfaces the control; panel shows the badge. |
| Server role/group model | Cloud Functions (`functions/src/serviceRoles.ts`) | — | Group used for team matching; the flag is unused server-side (see deploy finding). |

## Standard Stack

No new packages. Everything is in-repo TypeScript/Vue 3 (Composition API) + Pinia + Firestore, already present. The scheduler is a pure function pattern mirrored on `src/utils/suggestions.ts` (no DB, no wall-clock, no randomness) `[VERIFIED: src/utils/scheduler.ts:76-80]`.

---

# Part A — R259: the multi-role flag + generalized co-occurrence rule

## A.1 Recommended flag name: `multiRole`

`[VERIFIED: reasoning from CONTEXT + codebase naming]` Recommend `Role.multiRole?: boolean` over `combinable`:
- It is the owner's working term ("multi-role") — matches the domain language and the helper text.
- It reads correctly on the projection helpers: `buildIsVocal` → `buildIsMultiRole`, `isVocal` → `isMultiRole`.
- `combinable` invites confusion with the existing group-compat "combines freely" language in `evaluateGroupCombo`'s comments.

Below, `multiRole` is used throughout; if the planner picks another name, apply it uniformly.

## A.2 Exact consumer list (every site that must change)

Grep basis: `\.vocal\b|isVocal|buildIsVocal|vocal\?|vocal:` across `*.{ts,vue}` `[VERIFIED: Grep 2026-08-27]`. Distinguish the **flag** `vocal` (renames) from the **role name string** `"vocals"` (a seeded role name — unaffected).

### Production code

| # | File | Site | Change |
|---|------|------|--------|
| 1 | `src/types/roster.ts:11` | `Role.vocal?: boolean` | Rename → `multiRole?: boolean`; rewrite JSDoc from "singing role exempt from cap" to "role that may co-occur with a person's other roles on the same date, crossing groups; excluded from the one-instrument cap and Band↔Tech exclusivity." |
| 2 | `src/types/roster.ts:105` | `DEFAULT_ROLES` vocals entry `vocal: true` | → `multiRole: true` (vocals ships ON). |
| 3 | `src/utils/scheduler.ts:25-46` | `evaluateGroupCombo(roleIds, roleGroupOf, isVocal)` | Rename 3rd param `isVocal`→`isMultiRole`; **rewrite predicate** (A.3). |
| 4 | `src/utils/scheduler.ts:54-61` | `isGroupCompatible(..., isVocal)` | Rename param → `isMultiRole` (pass-through). |
| 5 | `src/utils/scheduler.ts:91-94` | `proposeQuarterSchedule` param `isVocal = () => false` | Rename → `isMultiRole = () => false`; keep the safe default. |
| 6 | `src/utils/scheduler.ts:207,266` | `isGroupCompatible(..., isVocal)` call sites | Rename arg. |
| 7 | `src/stores/quarters.ts:270-273` | `buildIsVocal(roles)` reading `r.vocal === true` | Rename → `buildIsMultiRole`, read `r.multiRole === true`. |
| 8 | `src/stores/quarters.ts:291` | call `buildIsVocal(rosterStore.roles)` in `generateProposal` | Rename call. |
| 9 | `src/stores/quarters.ts:510` | store return object exports `buildIsVocal` | Rename exported key (check consumers — only tests import it). |
| 10 | `src/stores/roster.ts:66-78` | read-time compat shim | See A.4 — must map both legacy `group:'vocals'` AND the legacy `vocal` field name to `multiRole`. |
| 11 | `src/components/RoleSlideOver.vue:106-116,181,185,193,246,253` | `FormState.vocal`, `emptyForm`, `roleToForm`, checkbox (Band-only `v-if`), `onSave` conditional writes, `data-testid="role-vocal-checkbox"` | Generalize — see A.5. |
| 12 | `src/components/RolesConfigPanel.vue:48-53` | badge `v-if="role.vocal"` + label "Vocal" | → `role.multiRole`, label "Multi-role". |
| 13 | `src/components/QuarterGrid.vue:322-345` | `isVocalById`/`isVocal` computed reading `r.vocal`, threaded into `evaluateGroupCombo` | Rename → `isMultiRoleById`/`isMultiRole`, read `r.multiRole`. |

### Server code

| # | File | Site | Change |
|---|------|------|--------|
| 14 | `functions/src/serviceRoles.ts:36-46,60-69` | `PortedRole.vocal`, `coerceLegacyRoleGroup` returning `vocal` | **Optional / parity-only.** The flag is never read in server logic (the file comment at lines 40-45 states it explicitly: "Not used by resolveMessageRecipients' team matching"). See deploy finding A.6. |

### Test fixtures to update (part of the same change; `npm run type-check` will fail otherwise)

`[VERIFIED: Grep]` — `src/utils/__tests__/scheduler.test.ts` (helper `makeIsVocal` + ~14 positional `isVocal` args + two behavior-changing tests, see A.3), `src/components/__tests__/RoleSlideOver.test.ts:80,122,159,175,179-194` (incl. a test asserting "checkbox only while group===band" that now inverts), `src/components/__tests__/RolesConfigPanel.test.ts:24,88`, `src/components/__tests__/QuarterGrid.test.ts:256`, `src/views/__tests__/ServiceEditorView.test.ts:588`, `src/views/__tests__/RosterView.test.ts:22`, `src/stores/__tests__/roster.test.ts:75,578-604` (the compat-shim test), and `DEFAULT_ROLES` consumers.

## A.3 The new `evaluateGroupCombo` predicate

`[VERIFIED: derived from src/utils/scheduler.ts:25-46 + CONTEXT decision]`

**Semantic shift:** the current rule *folds* vocals into Band (a vocalist still can't run Tech — `[VERIFIED: test scheduler.test.ts:505-520]`). The new rule *removes* multi-role roles from the analysis entirely, then applies the untouched rule to the remainder. Exact predicate:

```typescript
export function evaluateGroupCombo(
  roleIds: string[],
  roleGroupOf: (roleId: string) => RoleGroup,
  isMultiRole: (roleId: string) => boolean,
): { ok: boolean; reason?: string } {
  // Multi-role roles never cause a conflict and may cross Band/Tech/Other.
  // Filter them out; apply the existing rule only to the non-multi remainder.
  const nonMulti = roleIds.filter((id) => !isMultiRole(id))
  const groups = nonMulti.map((id) => roleGroupOf(id))
  const hasBand = groups.includes('band')
  const hasTech = groups.includes('tech')
  if (hasBand && hasTech) {
    return { ok: false, reason: 'Band and Tech are mutually exclusive on the same date' }
  }
  // At most one non-multi Band role (the one-instrument cap). Multi-role band
  // roles (e.g. vocals) are already excluded above, so they never count here.
  const bandInstrumentCount = groups.filter((g) => g === 'band').length
  if (bandInstrumentCount > 1) {
    return {
      ok: false,
      reason: 'at most 1 Band instrument role per person per date (multi-role exempt)',
    }
  }
  return { ok: true }
}
```

`isGroupCompatible` is unchanged in body (still `evaluateGroupCombo([...held, candidate], ...).ok`), only the param name.

### Behavior-changing consequence (must flag to planner + owner)

The vocalist-can't-run-Tech behavior is **intentionally removed** by R259 ("sound (tech) + sing (multi) = OK cross-type"). The existing test **`scheduler.test.ts:505-520`** ("group Band<->Tech exclusivity via vocals") asserts the OLD behavior (vocalist + sound → sound unfilled). Under the new rule, vocals is multi → filtered → a vocalist **can** hold sound. **That test must be rewritten** to assert the new cross-type allowance (or re-pointed at a genuinely non-multi Band role to keep an exclusivity regression test). This is a deliberate R259 behavior change, not a defect.

### Edge cases (exact outcomes)

| Case | Roles held (group, multi?) | `nonMulti` | Result | Note |
|------|----------------------------|-----------|--------|------|
| All-multi set | vocals(band,✓)+bass(band,✓)+lead(other,✓) | `[]` | OK | Empty set → no band/tech → always legal. Any purely-multi combo passes. |
| Multi + one instrument | vocals(band,✓)+guitar(band,✗) | `[guitar]` | OK | 1 band instrument. "Sing and play." |
| Multi + two instruments | vocals(band,✓)+guitar(band,✗)+bass(band,✗) | `[guitar,bass]` | **Blocked** | 2 non-multi band → cap. Two real instruments still blocked. |
| Sound + sing cross-type | sound(tech,✗)+vocals(band,✓) | `[sound]` | OK | Tech-only remainder. Cross-type now allowed (was blocked). |
| Multi-instrument + non-multi instrument | bass(band,✓)+guitar(band,✗) | `[guitar]` | OK | Flagging bass multi **removes it from the one-instrument cap** — a semantic consequence. Owner's worship-leader bass IS meant to be multi. Two *multi* band roles never conflict; a multi + a non-multi band role is allowed. Document so orgs don't accidentally flag every instrument multi. |
| Non-multi cross-type | sound(tech,✗)+guitar(band,✗) | `[sound,guitar]` | **Blocked** | Band↔Tech on the non-multi remainder. Unchanged. |
| Two non-multi band | guitar(band,✗)+drums(band,✗) | `[guitar,drums]` | **Blocked** | Cap. Unchanged. |
| Legacy `group:'vocals'` under new flag | coerced to band + multiRole:true | — | Treated as multi | Requires the shim update (A.4). |

## A.4 Compat-shim update (`src/stores/roster.ts:66-78`)

`[VERIFIED: src/stores/roster.ts:72-78]` Two legacy shapes must map to `multiRole`, and **no Firestore write migration** is performed (Phase-85 precedent):

1. **Legacy group `'vocals'`** (pre-Phase-85 docs): currently coerced to `{group:'band', vocal: data.vocal ?? true}`. Change to `{group:'band', multiRole: data.multiRole ?? data.vocal ?? true}`.
2. **Legacy `vocal` field name** (Phase-85/88 docs persisted with `vocal: true`, group already `'band'`): since there is no data migration, existing role docs on disk still carry `vocal`, not `multiRole`. The single read boundary must map it: `multiRole: data.multiRole ?? data.vocal ?? false` (or `=== true` normalization). Do this for **every** returned role, not only the `group==='vocals'` branch — otherwise a live vocals role saved before Phase 89 would silently lose its flag.

Recommended shim body:
```typescript
roles.value = snap.docs.map((d) => {
  const data = d.data() as Role & { vocal?: boolean }
  const multiRole = (data.multiRole ?? data.vocal) === true
  if ((data.group as string) === 'vocals') {
    return { ...data, id: d.id, group: 'band', multiRole } as Role
  }
  return { ...data, id: d.id, multiRole } as Role
})
```
The shim-test at `src/stores/__tests__/roster.test.ts:578-604` must be updated to assert `multiRole` and to add a case for the legacy `vocal`-field mapping.

## A.5 RoleSlideOver.vue generalization (`src/components/RoleSlideOver.vue`)

`[VERIFIED: src/components/RoleSlideOver.vue:106-116,177-195,232-260]` Phase 88 shipped a **Band-only** "Vocal role (can sing & play)" checkbox. Phase 89 generalizes:

- **Remove the `v-if="form.group === 'band'"` wrapper (line 106)** — show the control for any group.
- **Relabel** "Vocal role (can sing & play)" → **"Multi-role"** with helper text (CONTEXT copy): *"This person can serve this role alongside their other roles on the same date, and the scheduler tries to put their roles on the same day (e.g. sing + play bass + lead together) instead of spreading them out."*
- **`FormState.vocal` → `multiRole`** (lines 181, 185, 193); `data-testid="role-vocal-checkbox"` → `role-multirole-checkbox` (update the RoleSlideOver test).
- **`onSave` (lines 246, 253):** currently gates the write on `group === 'band'`. Change to write `multiRole` for any group: create → `...(form.value.multiRole ? { multiRole: true } : {})`; update → `multiRole: form.value.multiRole`. Drop the group condition.
- **Default for a brand-new arbitrary role:** OFF (`emptyForm().multiRole = false`). Vocals-default-ON is realized only via `DEFAULT_ROLES` seed, not by defaulting every new role on. (No requirement to auto-detect a role named "vocals.")
- The Phase-88 review guards (unsaved guard, `normalizedDefaultCount`) are unaffected.

## A.6 Deploy consideration — `functions/src/serviceRoles.ts` (KEY FINDING)

`[VERIFIED: functions/src/serviceRoles.ts:34-69,127-219 + Grep of server usage]`

- The server's `RoleGroup` is `"band" | "tech" | "other"` and **Phase 89 does not change the group model** — only the per-role flag renames. Team matching uses `group` only (`resolveMessageRecipients`, line 193: `selection.teams.includes(a.group)`).
- The `vocal` field is carried on `PortedRole` purely for **shape parity** and is **never read in any server code path** (the file's own comment, lines 40-45, says so). `coerceLegacyRoleGroup` sets it but nothing consumes it.
- **Therefore: no functional server change is required, and NO owner-gated Cloud Functions deploy is needed.** This is a notable de-risk vs. Phase 85 (which changed server team-matching via the group narrowing and did require a deploy).

**Recommendation:** Leave `functions/src/serviceRoles.ts` unchanged, OR do a parity-only rename of the unused `vocal` field → `multiRole` with **no deploy** (the persisted field name diverging from an unused type field causes zero runtime divergence — the server never reads it). If the planner does the parity rename, mark it clearly as non-deploying and keep it out of any deploy-gated task. Do **not** manufacture a deploy task for this phase.

---

# Part B — R260: same-date bundling in `proposeQuarterSchedule` (the hard part)

## B.1 How the current greedy loop works (baseline)

`[VERIFIED: src/utils/scheduler.ts:81-298]`

- **Outer:** `serviceDates.forEach((date, dateIndex) => …)` — chronological.
- **Middle:** `for (const { roleId, count } of rolesForDate)` — roles in **template order** (`role.order`, via `buildResolveRolesForDate`), NOT by rarity `[VERIFIED: quarters.ts:251-256]`.
- **Inner:** `while (calendar[date][roleId].length < count)` — fill slots one at a time.
- **Candidate filter (lines 257-267):** active, holds role, not blacked out, not already in role, `tier === 'regular'`, `withinCadence(p, roleId, dateIndex)`, `isGroupCompatible(rolesHeldThisDate(p), roleId, …)`.
- **Scoring (273-290):** `deficit = (dateIndex+1)/n - servedByRole(p, roleId)`, sort desc; tie-breaks `servedByRole` asc, then `name.localeCompare` (deterministic, no wall-clock/random).
- **After a pick (291-292):** `assignToRole(roleId, chosen.id)` then `propagatePairing(chosen.id, new Set([chosen.id]))`.
- **`withinCadence(p, role, dateIndex)` (119-123):** `n > 0 && servedByRole(p,role) < (dateIndex+1)/n`. This is the even-spread gate that both the main loop and `propagatePairing` share.
- **`propagatePairing` (174-240):** for each of the person's `pairedWith` partners not already assigned today, pick one of the partner's *own* eligible roles (regular tier, group-compatible, `withinCadence`, prefer one with remaining capacity), `assignToRole`, and recurse for chained pairings. Cadence-driven skips are **silent** (not pushed to `pairingConflicts`); genuine failures (blackout, no eligible role, out-tier, group violation) are recorded.

**Key structural fact:** `propagatePairing` is already a *second, independent role-selection path* that co-schedules onto the anchor's date under `withinCadence` + capacity + group-compat, reusing `assignToRole` and the shared `isGroupCompatible`. R260 is the same shape but co-schedules **one person's own other multi-role roles** instead of a partner.

## B.2 Recommended design: a `propagateMultiRole` pass (parallel to `propagatePairing`)

`[VERIFIED: design derived from scheduler.ts structure]`

Add a **non-recursive** closure inside `proposeQuarterSchedule` (alongside `propagatePairing`, so it closes over the same `date`, `calendar`, `assignToRole`, `withinCadence`, `rolesHeldThisDate`, `roleGroupOf`, `isMultiRole`, `rolesForDate`, `tierOf`, `isBlackedOut`):

```typescript
const propagateMultiRole = (personId: string) => {
  const person = people.find((p) => p.id === personId)
  if (!person) return
  // Iterate the person's OTHER multi-roles for this date, in stable template order.
  for (const { roleId, count } of rolesForDate) {
    if (!isMultiRole(roleId)) continue                 // only bundle multi-role roles
    if (!person.roles.includes(roleId)) continue       // must actually hold it (D-09 spirit)
    if (calendar[date]![roleId]?.includes(personId)) continue  // already on it today
    if (tierOf(personId, roleId) !== 'regular') continue       // fill-in/out never auto
    if (!withinCadence(personId, roleId, dateIndex)) continue  // consume, never exceed cadence
    if ((calendar[date]![roleId]?.length ?? 0) >= count) continue // no slot capacity -> yield
    // Group-compat is always true for a multi-role role, but call it for uniformity/safety:
    if (!isGroupCompatible(rolesHeldThisDate(personId), roleId, roleGroupOf, isMultiRole)) continue
    assignToRole(roleId, personId)
  }
}
```

**Trigger points** — invoke it right after every assignment of a multi-role role, in BOTH paths:
- **Main loop, after line 291** `assignToRole(roleId, chosen.id)`: if `isMultiRole(roleId)` → `propagateMultiRole(chosen.id)`. (Call it before or after `propagatePairing`; order does not affect the final set — see B.4. Recommend after `propagatePairing` so a pulled partner is already present, though it is independent.)
- **`propagatePairing`, after line 237** `assignToRole(target.roleId, partnerId)`: if `isMultiRole(target.roleId)` → `propagateMultiRole(partnerId)`. This lets a paired partner who is themselves a multi-role holder also bundle their own roles (composes cleanly; see Pitfall 4).

**Why non-recursive:** the pass has full visibility of the person's entire role set for the date, so a single sweep pulls in every currently-eligible multi-role. There is no need for the recursion `propagatePairing` uses (which chains across *different people*). Non-recursive ⇒ no infinite-propagation risk (Pitfall 2).

### Recommendation vs. the scoring-bias alternative

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **`propagateMultiRole` pull-in (RECOMMENDED)** | Mirrors the proven `propagatePairing` shape; reuses `assignToRole`/`withinCadence`/capacity; additive so it never removes a solo fill; commutative ⇒ deterministic & order-independent; cadence-bounded ⇒ auto "never exceeds cadence" and "yields to coverage." | Like `propagatePairing`, a bundled pull-in can edge out a marginally-higher-deficit peer for a contested slot (accepted residual, same as Phase-15 Open Question 1). | **Adopt.** |
| **Bias the deficit score with a "bundle bonus"** | Could make the person *win* a contested slot to bundle. | Perturbs the tuned fairness math; risks starving fairer candidates (violates "yields to other people's cadence/fairness"); order-dependent & non-commutative; hard to bound; harder determinism reasoning. | **Reject.** Owner explicitly wants bundling to yield to others' fairness — biasing to win contested slots is the wrong direction. |

## B.3 The anchor-ordering problem — and why it dissolves

`[VERIFIED: analysis of withinCadence monotonicity, scheduler.ts:119-123]`

CONTEXT flags that "the template iterates roles in template order, not by rarity." The concern: will the rare role (bass, `n=4`) get its scarce occurrences wasted on dates chosen by a common role (vocals, `n=2`)? **No — rarity anchoring emerges from `withinCadence`:**

- A role passes `withinCadence` on date index `i` iff `servedByRole < (i+1)/n`. Both counters start at 0 and advance monotonically.
- For bass (`n=4`) the eligible indices over an 8-date quarter are `{0, 4}`; for vocals (`n=2`) they are `{0, 2, 4, 6}`. **The rarer role's serve-dates are always a subset of the denser role's** (same start, sparser gate). Worked example matches the owner's: bass anchors on 0 and 4; vocals bundles on 0 and 4 and *also* serves solo on 2 and 6 ("the second vocals+lead date happens without bass").
- Because we trigger `propagateMultiRole` from **any** multi-role pick, the bundle forms from either direction: on a bass date, the bass main-loop pick pulls vocals+lead; on a vocals-only date, the vocals pick tries to pull bass but bass fails its own `withinCadence` (not behind pace) and is correctly left off.

So **no explicit rarity sort and no scoring change are needed.** The rare role naturally rides only on its sparse cadence dates, which are a subset of the common roles' dates, so the bundle anchors on the rarest for free.

**The one case where they misalign** is when, on a rare-role date, the person is *not* the top-scored candidate for the common role and loses that slot to a fairer peer (capacity/competition). Then the rare role fills solo — exactly the coverage-bounded yield the owner wants ("fills solo rather than empty"). Accepted.

## B.4 Determinism & fairness preservation

`[VERIFIED: analysis]`

- **Commutativity ⇒ order-independence:** two of a person's multi-roles are distinct roleIds with independent slots and independent `servedByRole` keys (`${personId}::${roleId}`). Multi-roles never group-conflict (A.3), so adding one never blocks another. Assigning role `r2` mutates only `servedByRole[person::r2]`, which does not affect `r3`'s `withinCadence`. Therefore the final set of a person's roles on a date = `{ all their regular multi-roles that are withinCadence at dateIndex and have remaining capacity }`, **independent of trigger order and template order**.
- **No wall-clock / no randomness:** the pass adds none; it reuses `assignToRole`, `withinCadence`, and stable `rolesForDate` iteration. Existing tie-breaks (deficit, `servedByRole`, `name.localeCompare`) are untouched.
- **Fairness bound:** the `withinCadence` gate on each *pulled* role is the fairness limiter — a person can only bundle a role they are genuinely behind on, so they cannot hoard beyond their own cadence. Capacity bound prevents overfill. This is the same containment `propagatePairing` uses (`[VERIFIED: scheduler.ts:220-236]`), so bundling inherits its accepted asymmetry rather than inventing a new fairness model.
- **`assignToRole` idempotency (lines 165-172):** dedupes (`if (!includes)`) and increments served only on an actual push — reusing it is what prevents double-counting (Pitfall 1).

## B.5 Pitfalls (enumerated)

1. **Double-counting served.** Reuse `assignToRole` (never a parallel writer) — it dedupes and increments `served`/`servedByRole` exactly once. A role bundled first is then skipped by its own main-loop `while` (slot already filled, `alreadyInRole` set). `[VERIFIED: scheduler.ts:165-172,244-267]`
2. **Infinite propagation.** Keep `propagateMultiRole` **non-recursive** (single sweep over `rolesForDate`). The person's role set is finite and each role is considered once; termination is trivial. Do not have it re-invoke itself.
3. **Multi-roles across different groups.** By A.3 a multi-role never group-conflicts, so bundling sound(tech)+sing(band)+lead(other) is legal and `isGroupCompatible` returns true. Each pulled role is still independently gated by `withinCadence` + capacity. No group restriction on bundling (owner: cross-type unrestricted).
4. **Interaction with must-serve-with pairings.** Compose them: after `propagatePairing` assigns a partner to a multi-role, fire `propagateMultiRole(partnerId)` so the partner bundles their own multi-roles too. Order is immaterial (B.4). Do not entangle the two `visited`/sweep mechanisms — pairing recurses across people; multi-role sweeps within one person. The anchor person's pick triggers pairing (pull partner) and its own multi-role sweep independently.
5. **"Only bassist this week but at vocals cap" coverage case.** Person is sole bassist, behind on bass, but already served vocals to cadence (`withinCadence(person, vocals, i)` false). `propagateMultiRole` skips vocals (cadence) → bass is still assigned solo by its own main loop. Never exceeds cadence; fills solo not empty. This is the canonical yield. `[VERIFIED: withinCadence semantics]`
6. **Blackout dates.** Bundling only pulls onto a date the person is *already* serving; a blacked-out person is never picked there in the first place (main-loop `isBlackedOut` filter, line 260), and blackout is per-date not per-role, so all their other roles on that date are equally clear. No extra check needed, but the pass touches only `date` (the current one) so it cannot cross into a blacked-out date.
7. **`existingCalendar` / fillGaps mode.** The seeding loop (lines 141-151) only tallies counts; it does **not** call `propagateMultiRole`. So a *locked* bass assignment does not auto-bundle vocals — bundling applies only to newly proposed picks. Seeded served counts DO feed `withinCadence`, so a role already at cadence from a lock won't be pulled. Document: bundling is for fresh proposals; locked cells are respected, not re-bundled. `[VERIFIED: scheduler.ts:141-151]`
8. **Capacity contention / fairness residual.** Eager bundling can fill a common-role slot for the bundled person ahead of a marginally-higher-deficit peer (mirrors the accepted `propagatePairing` residual, Phase-15 Open Question 1). Bounded by `withinCadence` (person must be behind) + capacity (`< count`). Accept and document; it is the price of the "strong/more-hard-than-soft" preference the owner asked for.
9. **A person's multi-roles spanning the ≤1-instrument cap.** If two of a person's multi-roles are both non-exempt band *instruments*, they'd normally hit the cap — but if both are flagged `multiRole` they are exempt (A.3) and both can bundle. Note the semantic: flagging an instrument multi-role removes it from the cap. Owner's bass IS meant to be multi; a stray double-flag would allow two instruments — a config-time caution, not an algorithm bug.

## B.6 Note on rarity edge — differing cadences that don't start aligned

`[ASSUMED]` The subset property (B.3) holds cleanly when all of a person's multi-roles start from `servedByRole = 0` at quarter start (the normal case). In `fillGaps` mode with pre-seeded uneven served counts, a rare role could momentarily pass `withinCadence` on a date a denser role does not (if the denser role was locked ahead). Bundling still behaves correctly (each role gated independently; worst case the rare role rides solo that date), but the perfect subset alignment is not guaranteed under arbitrary seeds. This is acceptable and consistent with fillGaps semantics; flagged for the planner as a known, benign boundary rather than a target behavior. **Confirm with owner only if fillGaps bundling is expected to be pixel-perfect** — the owner's motivating example is a fresh proposal, so this is low-risk.

---

## Runtime State Inventory

> This phase is a flag **rename** + algorithm addition, so the rename half warrants the inventory. No user-facing data key changes.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Firestore role docs under `organizations/{org}/roles` persist the flag as **field name `vocal`** (no data migration was done in Phase 85 either). Renaming the TS field to `multiRole` does NOT rewrite these docs. | **Code (read-time shim only)** — `roster.ts` shim must map legacy `data.vocal` → `multiRole` for every role, plus the legacy `group:'vocals'` branch (A.4). NO Firestore write migration (matches Phase-85 decision). |
| Live service config | None — the flag is a per-org config field already in Firestore, not an external service. | None. |
| OS-registered state | None. | None — verified: this is pure app/algorithm code. |
| Secrets/env vars | None — no key or env var references the flag. | None. |
| Build artifacts / installed packages | `functions/` is a standalone TS project; if its `serviceRoles.ts` type is renamed it must rebuild before any deploy — but **no deploy is required** (A.6), so no artifact action. Client build is Vite; no artifact carries the old name. | None (server edit optional and non-deploying). |

**Canonical question — after every file is updated, what still holds the old string?** Only the **persisted Firestore `vocal` field on existing role docs**, handled by the read-time shim (no migration). Everything else is source-level rename.

## Common Pitfalls (rename half)

### Pitfall R1: Forgetting the legacy `vocal`-field mapping in the shim
**What goes wrong:** existing vocals roles (saved with `vocal: true`, group already `band`) silently lose the flag after the rename, so vocalists stop bundling and stop being cap-exempt.
**Why:** no data migration; docs still store `vocal`, but code now reads `multiRole`.
**Avoid:** map `data.multiRole ?? data.vocal` for **every** role in the `roster.ts` onSnapshot shim (A.4), not just the `group:'vocals'` branch. Mirror in the shim-test.
**Warning sign:** vocals badge disappears in `RolesConfigPanel` for existing orgs; scheduler stops co-scheduling vocals.

### Pitfall R2: Using `-p tsconfig.app.json` as the type gate
**What goes wrong:** renamed test fixtures (14+ `isVocal` sites, RoleSlideOver/RolesConfigPanel/QuarterGrid/ServiceEditor/RosterView fixtures) still say `vocal:` and won't be caught.
**Avoid:** gate on `npm run type-check` (`vue-tsc --build`) per CLAUDE.md.

### Pitfall R3: Manufacturing an unnecessary functions deploy
**What goes wrong:** a deploy task gets added for a server field that is never read, burning an owner-gated deploy for zero behavior change.
**Avoid:** leave `functions/src/serviceRoles.ts` alone or parity-rename with no deploy (A.6).

### Pitfall R4: Leaving the behavior-changing vocals/Tech test asserting the old rule
**What goes wrong:** `scheduler.test.ts:505-520` will fail because vocalist+sound is now allowed.
**Avoid:** rewrite that test to assert the new cross-type allowance (or re-point it at a non-multi Band role to preserve an exclusivity regression).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.x (root), jsdom env | 
| Config file | `vite.config.ts` (excludes `src/rules.test.ts`, `render-service/**`) |
| Quick run command | `npx vitest run src/utils/__tests__/scheduler.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R259 | New `evaluateGroupCombo` predicate (filter-multi-first) + all edge cases in A.3 | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts` | ✅ (extend; rewrite line 505 test) |
| R259 | Compat shim maps legacy `vocal` + `group:'vocals'` → `multiRole` | unit | `npx vitest run src/stores/__tests__/roster.test.ts` | ✅ (update 578-604, add vocal-field case) |
| R259 | RoleSlideOver shows Multi-role for any group, writes `multiRole`, helper text | component | `npx vitest run src/components/__tests__/RoleSlideOver.test.ts` | ✅ (invert the "band-only" test) |
| R259 | RolesConfigPanel Multi-role badge | component | `npx vitest run src/components/__tests__/RolesConfigPanel.test.ts` | ✅ (update 88) |
| R259 | QuarterGrid warn badge uses new rule (cross-type no longer warns) | component | `npx vitest run src/components/__tests__/QuarterGrid.test.ts` | ✅ (update fixture 256 + assertions) |
| R260 | Bundling: rare-role anchor, ride-along, extras-elsewhere, never-exceed-cadence, solo-when-can't-bundle, determinism | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts` | ❌ Wave 0 — new `describe('multi-role bundling')` block |

### Sampling Rate
- **Per task commit:** `npx vitest run src/utils/__tests__/scheduler.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** full app suite green (baseline caveats: `storage.rules.test.ts`, `RosterView.test.ts`) + `npm run type-check` clean before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] New `describe('multi-role bundling', …)` block in `scheduler.test.ts` covering R260 (canonical fixture below).
- [ ] Rewrite `scheduler.test.ts:505-520` (vocals/Tech behavior change).
- [ ] Update `makeIsVocal`→`makeIsMultiRole` helper + all positional args.
- [ ] Add compat-shim legacy-`vocal`-field case to `roster.test.ts`.

### B.7 Canonical bundling test fixture (deterministic)

`[VERIFIED: modeled on existing buildNolanTimScenario pattern, scheduler.test.ts:638-657]`

The worship-leader example is the canonical fixture. Construct deterministically (helper `freq(roleId, tier, n)` already exists):

- Person `wl` ("Worship Leader"), `roles: ['bass','vocals','lead']`, all three flagged multi-role via `makeIsMultiRole(['bass','vocals','lead'])`.
- `roleFrequency`: `bass {regular, 4}` (rarest anchor), `vocals {regular, 2}`, `lead {regular, 2}`.
- `roleGroupOf`: `bass→band, vocals→band, lead→other` (proves cross-group bundling; bass+vocals both band but both multi so no cap conflict).
- Resolver: `[{bass,1},{vocals,1},{lead,1}]`; 8 weekly dates.

Assertions:
1. **Ride-along:** on every date `wl` serves bass, `wl` also serves vocals AND lead (bundled). Expect bass dates `{index 0, 4}`, and vocals+lead present on both.
2. **Extras elsewhere:** vocals+lead also served on `{2, 6}` **without** bass (bass not withinCadence those dates).
3. **Never exceeds cadence:** `servedCounts` per role ≤ `ceil(8/n)` — bass 2, vocals 4, lead 4.
4. **Determinism:** two runs produce identical calendars (deep-equal).
5. **Coverage-bounded solo (separate fixture):** add a second bassist competing; make `wl` at vocals cap on a bass date (seed via `existingCalendar` or a competitor winning vocals) → assert bass fills solo, vocals not exceeded.
6. **Cross-type (separate fixture):** person with `sound` (tech, multi) + `vocals` (band, multi) → both assigned same date (no group violation), proving the A.3 cross-type allowance and that bundling crosses Band/Tech.

Isolation trick from the existing suite (adding a stronger competitor so the person only reaches a role via a specific path) applies if a test needs to force bundling-vs-direct-pick separation.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treat as enabled), but this phase adds **no** authentication, session, access-control, cryptography, or external-input surface. The scheduler is a pure in-memory function over already-authenticated Firestore data; the flag is a boolean config field written through the existing org-editor-gated role CRUD (`updateRole`/`addRole`, already covered by `firestore.rules`). No new ASVS controls apply. `[VERIFIED: no auth/crypto/network code touched]`

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Minor | Role flag is a boolean; `normalizedDefaultCount` already guards the numeric field. No new untrusted input. |
| V4 Access Control | No (unchanged) | Role writes already gated by existing org-editor Firestore rules. |
| V6 Cryptography | No | None. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Under `fillGaps` with uneven pre-seeded served counts, perfect rare⊆common date-subset alignment is not guaranteed but bundling still behaves benignly (rare rides solo worst-case). | B.6 | Low — owner's example is a fresh proposal; if pixel-perfect fillGaps bundling is required, a small extra ordering rule is needed. Confirm only if owner cares about fillGaps bundling precision. |

**All other claims are `[VERIFIED]` against the current source read this session.**

## Open Questions

1. **Should a paired partner's own multi-roles bundle too?**
   - What we know: the cleanest, most consistent behavior is yes (fire `propagateMultiRole` after a pairing pull-in of a multi-role). CONTEXT scopes R260 to "a person's own multi-roles" but the partner *is* such a person once pulled in.
   - What's unclear: whether the owner wants a pulled-in partner to also fan out into their multi-roles, or stay minimal.
   - Recommendation: implement the consistent version (partner bundles their own), document it, and surface in `/gsd-verify-work` UAT. It composes deterministically (B.4) and is easy to gate off if the owner objects.

2. **Flag name confirmation.** `multiRole` recommended; owner's working term. If the planner/owner prefers `combinable`, apply uniformly. Low risk — mechanical.

## Sources

### Primary (HIGH confidence — read this session)
- `src/utils/scheduler.ts` (full) — greedy loop, `withinCadence`, `propagatePairing`, `evaluateGroupCombo`, `isGroupCompatible`.
- `src/utils/__tests__/scheduler.test.ts` (full) — behavior contract + `buildNolanTimScenario` determinism pattern.
- `src/types/roster.ts` — `Role.vocal`, `RoleGroup`, `RoleFrequencyEntry`, `DEFAULT_ROLES`.
- `src/stores/quarters.ts` — `buildIsVocal`/`buildRoleGroupOf`, `generateProposal` wiring, fillGaps.
- `src/stores/roster.ts` — read-time `group:'vocals'` compat shim, role CRUD.
- `src/components/QuarterGrid.vue:246,312-346` — warn badge reusing `evaluateGroupCombo`.
- `src/components/RoleSlideOver.vue` — Phase-88 Band-only vocal checkbox + save logic.
- `src/components/RolesConfigPanel.vue:40-57` — Vocal badge.
- `functions/src/serviceRoles.ts` — server RoleGroup model; `vocal` carried but unused (deploy finding).
- `.planning/phases/89-multi-role-scheduling/89-CONTEXT.md` — locked owner decisions.
- Grep `\.vocal\b|isVocal|buildIsVocal|vocal\?|vocal:` — exhaustive consumer + test-fixture list.

### Secondary / Tertiary
- None (no external research needed).

## Metadata

**Confidence breakdown:**
- Rename consumer map (Part A): HIGH — exhaustive grep + file reads.
- New `evaluateGroupCombo` predicate + edge cases: HIGH — derived directly from current source + CONTEXT.
- Bundling design (Part B): HIGH — mirrors verified `propagatePairing`; commutativity/anchoring argued from `withinCadence` math.
- Deploy no-op finding: HIGH — server code path inspected; flag provably unused.
- fillGaps alignment edge (B.6/A1): MEDIUM/ASSUMED — benign boundary, flagged.

**Research date:** 2026-08-27
**Valid until:** stable (internal code) — revalidate only if `scheduler.ts` or the role model changes before planning.
